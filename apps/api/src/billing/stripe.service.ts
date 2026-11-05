import { createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';

/**
 * Minimal Stripe adapter over the REST API (dependency-free). When
 * STRIPE_SECRET_KEY is absent it reports NOT_CONFIGURED instead of failing - the
 * rest of billing still works (plans, usage, credits) without live payments.
 */
@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);

  isConfigured(): boolean {
    return Boolean(process.env.STRIPE_SECRET_KEY);
  }

  private async post(path: string, params: Record<string, string>): Promise<Record<string, unknown>> {
    const res = await fetch(`https://api.stripe.com/v1/${path}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(params).toString(),
    });
    const body = (await res.json()) as Record<string, unknown>;
    if (!res.ok) throw new Error(`Stripe ${res.status}: ${JSON.stringify(body)}`.slice(0, 300));
    return body;
  }

  /** Create a Checkout session for a subscription price. */
  async createCheckoutSession(input: { priceId: string; customerEmail: string; successUrl: string; cancelUrl: string }) {
    if (!this.isConfigured()) return { status: 'NOT_CONFIGURED' as const };
    const session = await this.post('checkout/sessions', {
      mode: 'subscription',
      'line_items[0][price]': input.priceId,
      'line_items[0][quantity]': '1',
      customer_email: input.customerEmail,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
    });
    return { status: 'OK' as const, url: session.url as string, id: session.id as string };
  }

  /** Verify a Stripe webhook signature (t=...,v1=... scheme). */
  verifyWebhook(payload: string, sigHeader: string | undefined): boolean {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret || !sigHeader) return false;
    const parts = Object.fromEntries(sigHeader.split(',').map((p) => p.split('=')));
    const t = parts['t'];
    const v1 = parts['v1'];
    if (!t || !v1) return false;
    const expected = createHmac('sha256', secret).update(`${t}.${payload}`).digest('hex');
    try {
      return timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
    } catch {
      return false;
    }
  }
}
