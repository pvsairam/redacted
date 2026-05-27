import type { RunStatus } from '@qa-platform/shared';
import clsx from 'clsx';

interface StatusBadgeProps {
  status: RunStatus | string | null;
  className?: string;
}

const STATUS_CONFIG: Record<string, { label: string; className: string; dot: string }> = {
  passed: { label: 'Passed', className: 'badge-success', dot: 'bg-success' },
  failed: { label: 'Failed', className: 'badge-danger', dot: 'bg-danger' },
  running: { label: 'Running', className: 'badge-running', dot: 'bg-info animate-pulse-slow' },
  pending: { label: 'Pending', className: 'badge-neutral', dot: 'bg-graphite-300' },
  cancelled: { label: 'Cancelled', className: 'badge-neutral', dot: 'bg-graphite-300' },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status ?? 'pending'] ?? STATUS_CONFIG['pending']!;
  return (
    <span className={clsx('badge', config.className, className)}>
      <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', config.dot)} />
      {config.label}
    </span>
  );
}
