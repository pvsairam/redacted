import clsx from 'clsx';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={clsx('empty-state noise-bg', className)}>
      {icon && (
        <div className="w-12 h-12 rounded-xl bg-graphite-700 border border-graphite-400 flex items-center justify-center text-graphite-100 mb-1">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-chalk mt-1">{title}</h3>
      <p className="text-sm text-graphite-100 max-w-[280px] leading-relaxed mt-0.5">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
