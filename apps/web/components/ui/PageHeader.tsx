interface PageHeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
}

export function PageHeader({ title, description, children }: PageHeaderProps) {
  return (
    <div
      data-page-header="true"
      className="flex flex-wrap items-start justify-between gap-4 px-6 sm:px-8 py-5 border-b border-graphite-400 bg-graphite-800 noise-bg"
    >
      <div className="min-w-0 flex-1">
        <h1 className="text-xl sm:text-2xl font-semibold text-chalk tracking-tight truncate">{title}</h1>
        {description && (
          description.startsWith('http') ? (
            <div className="mt-1.5 max-w-full xl:max-w-2xl bg-graphite-950 border border-graphite-400 rounded px-2.5 py-1 flex items-center justify-between gap-3">
              <code className="text-xs text-graphite-50 font-mono truncate select-all flex-1" title={description}>
                {description}
              </code>
            </div>
          ) : (
            <p className="text-sm text-graphite-100 mt-1 break-words line-clamp-2">{description}</p>
          )
        )}
      </div>
      {children && (
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 flex-wrap">
          {children}
        </div>
      )}
    </div>
  );
}
