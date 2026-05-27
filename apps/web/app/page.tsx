'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  FlaskConical,
  PlayCircle,
  XCircle,
  Clock,
  ChevronRight,
  PlusCircle,
  Activity,
} from 'lucide-react';
import { getDashboardStats } from '@/lib/api';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';

function formatDuration(ms: number | null): string {
  if (!ms) return 'N/A';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatDate(iso: string | null): string {
  if (!iso) return 'N/A';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StatCard({
  label,
  value,
  icon: Icon,
  description,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  description?: string;
}) {
  return (
    <div className="stat-card">
      <div className="flex items-center justify-between">
        <span className="text-label">{label}</span>
        <Icon size={14} className="text-graphite-100" />
      </div>
      <div className="text-3xl font-semibold text-chalk mt-3 tabular-nums tracking-tight truncate">{value}</div>
      {description && <div className="text-xs text-graphite-100 mt-1.5 truncate opacity-80">{description}</div>}
    </div>
  );
}

export default function DashboardPage() {
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: getDashboardStats,
    refetchInterval: 10000,
  });

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Dashboard"
        description="Overview of your test suite health and recent activity."
      >
        <Link href="/tests" className="btn-primary px-5 py-2 text-sm shadow-sm">
          <PlayCircle size={15} />
          Record workflow
        </Link>
      </PageHeader>

      <div className="px-8 py-6 space-y-8">
        {/* Stats grid */}
        {isLoading ? (
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="stat-card animate-pulse">
                <div className="h-3 bg-graphite-600 rounded w-20 mb-4" />
                <div className="h-8 bg-graphite-600 rounded w-12" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="card p-10 flex flex-col items-center justify-center text-center gap-2">
            <div className="w-12 h-12 rounded-xl bg-graphite-700 border border-graphite-400 flex items-center justify-center text-graphite-100 mb-2">
              <XCircle size={22} className="text-danger/80" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-chalk">Backend unavailable</h3>
              <p className="text-sm text-graphite-100 mt-1 max-w-sm">
                The local API service is not reachable. Start the backend server and try again.
              </p>
            </div>
            <div className="flex items-center gap-3 mt-4">
              <button onClick={() => window.location.reload()} className="btn-secondary px-4 py-2 text-sm">
                Retry Connection
              </button>
              <div className="text-xs text-graphite-100/50 font-mono">port 3001</div>
            </div>
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Total Tests"
              value={stats.totalTestCases}
              icon={FlaskConical}
              description="Recorded test cases"
            />
            <StatCard
              label="Total Runs"
              value={stats.totalRuns}
              icon={Activity}
              description="All replay executions"
            />
            <StatCard
              label="Failed Runs"
              value={stats.failedRuns}
              icon={XCircle}
              description={stats.totalRuns > 0 ? `${Math.round((stats.failedRuns / stats.totalRuns) * 100)}% failure rate` : undefined}
            />
            <StatCard
              label="Avg Duration"
              value={formatDuration(stats.avgDurationMs)}
              icon={Clock}
              description="Per replay execution"
            />
          </div>
        ) : null}

        {/* Recent runs */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-chalk">Recent Runs</h2>
            <Link href="/tests" className="text-xs text-graphite-100 hover:text-chalk transition-colors flex items-center gap-1">
              View all tests <ChevronRight size={12} />
            </Link>
          </div>

          {!stats || stats.recentRuns.length === 0 ? (
            <div className="card">
              <EmptyState
                icon={<PlayCircle size={22} />}
                title="No runs recorded yet"
                description="Capture your first workflow, replay it, and generate a clean evidence report."
                action={
                  <Link href="/tests" className="btn-primary px-5 py-2 text-sm mt-2 shadow-sm">
                    <PlayCircle size={15} />
                    Record workflow
                  </Link>
                }
              />
            </div>
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-graphite-400">
                    <th className="text-left px-4 py-3 text-label font-medium">Test Case</th>
                    <th className="text-left px-4 py-3 text-label font-medium">Status</th>
                    <th className="text-left px-4 py-3 text-label font-medium">Steps</th>
                    <th className="text-left px-4 py-3 text-label font-medium">Duration</th>
                    <th className="text-left px-4 py-3 text-label font-medium">Started</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {stats.recentRuns.map((run, i) => (
                    <tr
                      key={run.id}
                      className={`border-b border-graphite-400 hover:bg-graphite-700 transition-colors ${i === stats.recentRuns.length - 1 ? 'border-0' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/tests/${run.testCaseId}`}
                          className="font-medium text-chalk hover:underline"
                        >
                          {run.testCaseName}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={run.status} />
                      </td>
                      <td className="px-4 py-3 text-graphite-100 tabular-nums">
                        {run.passedSteps}/{run.totalSteps}
                      </td>
                      <td className="px-4 py-3 text-graphite-100 tabular-nums">
                        {formatDuration(run.durationMs)}
                      </td>
                      <td className="px-4 py-3 text-graphite-100">
                        {formatDate(run.startedAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/runs/${run.id}`}
                          className="text-2xs text-graphite-100 hover:text-chalk transition-colors"
                        >
                          View →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
