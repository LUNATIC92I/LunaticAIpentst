'use client';

import { useEffect, useState } from 'react';
import { Check, Zap, CreditCard } from 'lucide-react';
import { billing, type Plan, type BillingOverview } from '@/lib/api';

export default function BillingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [overview, setOverview] = useState<BillingOverview | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    billing.plans().then(setPlans).catch(() => undefined);
    billing.overview().then(setOverview).catch(() => undefined);
  }, []);

  async function choose(tier: string) {
    setNotice(null);
    try {
      const r = await billing.checkout(tier);
      if (r.status === 'OK' && r.url) window.location.href = r.url;
      else setNotice(r.message ?? 'Checkout is not available on this deployment.');
    } catch (e) {
      setNotice((e as Error).message);
    }
  }

  const currentTier = overview?.subscription.tier;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-text">
          <CreditCard size={20} className="text-accent" /> Billing & plans
        </h1>
        <p className="text-sm text-text-muted">Manage your subscription and consumption.</p>
      </div>

      {/* Consumption */}
      {overview && (
        <div className="card grid gap-4 p-5 sm:grid-cols-4">
          <Metric label="Current plan" value={overview.plan.name} accent />
          <Metric label="Credits remaining" value={`${overview.credits.remaining.toLocaleString()} / ${overview.credits.planMonthly.toLocaleString()}`} />
          <Metric label="AI tokens (30d)" value={(overview.usageByKind.ai_tokens ?? 0).toLocaleString()} />
          <Metric label="Payments" value={overview.stripeConfigured ? 'Stripe connected' : 'Not configured'} warn={!overview.stripeConfigured} />
        </div>
      )}

      {notice && (
        <div className="card border-warn/30 bg-warn/5 p-4 text-sm text-text-muted">{notice}</div>
      )}

      {/* Plans */}
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
        {plans.map((p) => {
          const current = p.tier === currentTier;
          return (
            <div key={p.tier} className={`card flex flex-col p-5 ${current ? 'border-accent/50 shadow-glow' : ''}`}>
              <div className="mb-3">
                <h3 className="text-lg font-semibold text-text">{p.name}</h3>
                <p className="mt-1 text-2xl font-bold text-text">
                  ${(p.priceCentsMonthly / 100).toFixed(0)}
                  <span className="text-sm font-normal text-text-dim">/mo</span>
                </p>
              </div>
              <ul className="mb-4 flex-1 space-y-1.5 text-sm text-text-muted">
                <li className="flex items-center gap-2"><Zap size={13} className="text-accent" />{p.monthlyCredits.toLocaleString()} credits/mo</li>
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-2"><Check size={13} className="text-success" />{f}</li>
                ))}
              </ul>
              {current ? (
                <span className="rounded-lg bg-accent/15 py-2 text-center text-sm text-accent">Current plan</span>
              ) : p.tier === 'FREE' ? (
                <span className="rounded-lg border border-border py-2 text-center text-sm text-text-dim">Default</span>
              ) : (
                <button className="btn-primary" onClick={() => choose(p.tier)}>Choose {p.name}</button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Metric({ label, value, accent, warn }: { label: string; value: string; accent?: boolean; warn?: boolean }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-text-dim">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${warn ? 'text-warn' : accent ? 'text-accent' : 'text-text'}`}>{value}</p>
    </div>
  );
}
