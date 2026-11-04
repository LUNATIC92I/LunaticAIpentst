import type { MissionStatus } from '@/lib/api';

const STYLES: Record<MissionStatus, string> = {
  DRAFT: 'bg-graphite/40 text-text-muted',
  SCOPING: 'bg-electric/15 text-electric',
  PLANNING: 'bg-electric/15 text-electric',
  RUNNING: 'bg-accent/15 text-accent',
  PAUSED: 'bg-warn/15 text-warn',
  AWAITING_APPROVAL: 'bg-warn/15 text-warn',
  COMPLETED: 'bg-success/15 text-success',
  FAILED: 'bg-danger/15 text-danger',
  ARCHIVED: 'bg-graphite/30 text-text-dim',
};

export function StatusBadge({ status }: { status: MissionStatus }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STYLES[status]}`}>
      {status.replace('_', ' ')}
    </span>
  );
}
