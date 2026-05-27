interface PageHeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
}

export function PageHeader({ title, description, children }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between px-8 py-6 border-b border-graphite-400 bg-graphite-800 noise-bg">
      <div>
        <h1 className="text-2xl font-semibold text-chalk tracking-tight">{title}</h1>
        {description && (
          description.startsWith('http') ? (
            <div className="mt-1.5 max-w-xl xl:max-w-2xl bg-graphite-950 border border-graphite-400 rounded px-2.5 py-1 flex items-center justify-between gap-3">
              <code className="text-xs text-graphite-50 font-mono truncate select-all flex-1" title={description}>
                {description}
              </code>
            </div>
          ) : (
            <p className="text-sm text-graphite-100 mt-1 break-all">{description}</p>
          )
        )}
      </div>
      {children && <div className="flex items-center gap-3 flex-shrink-0">{children}</div>}
    </div>
  );
}
