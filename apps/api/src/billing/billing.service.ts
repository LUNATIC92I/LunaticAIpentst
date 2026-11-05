import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { StripeService } from './stripe.service';
import { listPlans, planConfig, remainingCredits, type PlanTier } from './plans';

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly stripe: StripeService,
  ) {}

  plans() {
    return listPlans();
  }

  /** Billing + consumption overview for an organization. */
  async overview(orgId: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
    });
    const tier = (subscription?.tier ?? 'FREE') as PlanTier;
    const plan = planConfig(tier);

    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - 30);

    // Consumption this period, grouped by kind.
    const usage = await this.prisma.usageRecord.groupBy({
      by: ['kind'],
      where: { orgId, createdAt: { gte: periodStart } },
      _sum: { quantity: true },
    });
    const usageByKind: Record<string, number> = {};
    for (const u of usage) usageByKind[u.kind] = u._sum.quantity ?? 0;

    // Credits: purchased balance + plan allowance vs consumed credit-units.
    const creditAgg = await this.prisma.usageCredit.aggregate({ where: { orgId }, _sum: { balance: true } });
    const purchased = creditAgg._sum.balance ?? 0;
    const consumedCredits = await this.prisma.usageRecord.aggregate({
      where: { orgId, createdAt: { gte: periodStart } },
      _sum: { unitCost: true },
    });
    const consumed = consumedCredits._sum.unitCost ?? 0;

    return {
      subscription: subscription
        ? { tier: subscription.tier, status: subscription.status, currentPeriodEnd: subscription.currentPeriodEnd }
        : { tier: 'FREE', status: 'ACTIVE', currentPeriodEnd: null },
      plan,
      credits: {
        planMonthly: plan.monthlyCredits,
        purchased,
        consumed,
        remaining: remainingCredits(plan.monthlyCredits, purchased, consumed),
      },
      usageByKind,
      stripeConfigured: this.stripe.isConfigured(),
    };
  }

  async invoices(orgId: string) {
    return this.prisma.invoice.findMany({ where: { orgId }, orderBy: { issuedAt: 'desc' } });
  }

  async usageRecords(orgId: string, limit = 50) {
    return this.prisma.usageRecord.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /** Begin a checkout for a tier. Honest NOT_CONFIGURED when Stripe is absent. */
  async checkout(orgId: string, tier: PlanTier, email: string, appUrl: string) {
    if (!this.stripe.isConfigured()) {
      return { status: 'NOT_CONFIGURED', message: 'Stripe is not configured on this deployment.' };
    }
    const priceId = process.env[`STRIPE_PRICE_${tier}`];
    if (!priceId) {
      return { status: 'NOT_CONFIGURED', message: `No Stripe price configured for ${tier} (set STRIPE_PRICE_${tier}).` };
    }
    const result = await this.stripe.createCheckoutSession({
      priceId,
      customerEmail: email,
      successUrl: `${appUrl}/settings?billing=success`,
      cancelUrl: `${appUrl}/settings?billing=cancel`,
    });
    await this.audit.record({ orgId, action: 'billing.checkout', metadata: { tier } });
    return result;
  }

  /** Admin: change an org's plan directly (no Stripe). */
  async setTier(orgId: string, tier: PlanTier, actorId: string) {
    const existing = await this.prisma.subscription.findFirst({ where: { orgId }, orderBy: { createdAt: 'desc' } });
    const sub = existing
      ? await this.prisma.subscription.update({ where: { id: existing.id }, data: { tier: tier as never } })
      : await this.prisma.subscription.create({ data: { orgId, tier: tier as never } });
    await this.audit.record({ orgId, actorId, action: 'billing.set_tier', metadata: { tier } });
    return sub;
  }
}
