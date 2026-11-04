import type { LucideIcon } from 'lucide-react';

export function StatCard({
  label,
  value,
  icon: Icon,
  accent = 'accent',
  hint,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  accent?: 'accent' | 'electric' | 'warn' | 'danger' | 'success';
  hint?: string;
}) {
  const ring: Record<string, string> = {
    accent: 'text-accent',
    electric: 'text-electric',
    warn: 'text-warn',
    danger: 'text-danger',
    success: 'text-success',
  };
  return (
    <div className="card p-4 transition hover:border-accent/30">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-text-dim">{label}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-text">{value}</p>
          {hint && <p className="mt-1 text-xs text-text-muted">{hint}</p>}
        </div>
        <div className={`rounded-lg bg-bg-elevated p-2 ${ring[accent]}`}>
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}
