'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Loader2,
  Terminal,
  ImageIcon,
  Video,
  FileText,
  Zap,
} from 'lucide-react';
import {
  getTestRun,
  getRunLogs,
  getRunScreenshots,
  getScreenshotFileUrl,
  generateReport,
  getReportDownloadUrl,
  getTraceDownloadUrl,
} from '@/lib/api';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PageHeader } from '@/components/ui/PageHeader';
import clsx from 'clsx';
import { useState } from 'react';

function formatDuration(ms: number | null): string {
  if (!ms) return 'N/A';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatDate(iso: string | null): string {
  if (!iso) return 'N/A';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

const LOG_COLORS: Record<string, string> = {
  info: 'text-graphite-50',
  debug: 'text-graphite-100',
  warn: 'text-warning',
  error: 'text-danger',
};

export default function RunDetailPage() {
  const params = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'logs' | 'screenshots'>('logs');
  const [generatedReportId, setGeneratedReportId] = useState<string | null>(null);

  const { data: run, isLoading, failureCount } = useQuery({
    queryKey: ['run', params.id],
    queryFn: () => getTestRun(params.id),
    // Poll while run is in progress
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'running' || status === 'pending' ? 2000 : false;
    },
    // Retry up to 5 times with 1s delay - handles the race where the
    // browser navigates to /runs/:id before the server has committed the
    // run record to the DB (common on slower machines).
    retry: 5,
    retryDelay: 1000,
  });

  const { data: logs } = useQuery({
    queryKey: ['run-logs', params.id],
    queryFn: () => getRunLogs(params.id),
    refetchInterval: run?.status === 'running' || run?.status === 'pending' ? 2000 : false,
    enabled: !!run,
  });

  const { data: screenshots } = useQuery({
    queryKey: ['run-screenshots', params.id],
    queryFn: () => getRunScreenshots(params.id),
    enabled: !!run && (run.status === 'passed' || run.status === 'failed'),
  });

  const reportMutation = useMutation({
    mutationFn: () => generateReport(params.id),
    onSuccess: (data) => {
      setGeneratedReportId(data.reportId);
      void queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });

  if (isLoading || (!run && failureCount < 5)) {
    return (
      <div className="px-8 py-6 animate-pulse space-y-4">
        <div className="h-8 bg-graphite-700 rounded w-48" />
        <div className="h-4 bg-graphite-700 rounded w-64" />
        {!isLoading && (
          <div className="text-xs text-graphite-100 flex items-center gap-2 pt-1">
            <Loader2 size={11} className="animate-spin" />
            Initializing run...
          </div>
        )}
      </div>
    );
  }

  if (!run) {
    return <div className="px-8 py-6 text-danger text-sm">Run not found.</div>;
  }

  const isInProgress = run.status === 'running' || run.status === 'pending';

  return (
    <div className="animate-fade-in">
      <PageHeader title={`Run - ${run.testCaseName}`} description={`ID: ${run.id}`}>
        <Link href={`/tests/${run.testCaseId}`} className="btn-ghost px-3 py-2 text-sm">
          <ArrowLeft size={14} />
          Test Case
        </Link>
        {run.tracePath && (
          <a
            href={getTraceDownloadUrl(run.id)}
            download={`trace-${run.id}.zip`}
            className="btn-secondary px-4 py-2 text-sm flex items-center gap-2"
          >
            <Zap size={13} />
            Download Trace
          </a>
        )}
        {!isInProgress && !generatedReportId && (
          <button
            onClick={() => reportMutation.mutate()}
            disabled={reportMutation.isPending}
            className="btn-secondary px-4 py-2 text-sm"
          >
            {reportMutation.isPending ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <FileText size={13} />
            )}
            Generate Report
          </button>
        )}
        {generatedReportId && (
          <a
            href={getReportDownloadUrl(generatedReportId)}
            download
            className="btn-primary px-4 py-2 text-sm"
          >
            <FileText size={13} />
            Download Report
          </a>
        )}
      </PageHeader>

      <div className="px-8 py-6 space-y-6">
        {/* Status banner */}
        <div className={clsx(
          'rounded-lg border p-4 flex items-center gap-3',
          run.status === 'passed' ? 'bg-success-bg border-success-border' :
          run.status === 'failed' ? 'bg-danger-bg border-danger-border' :
          'bg-graphite-700 border-graphite-400',
        )}>
          {isInProgress ? (
            <Loader2 size={16} className="animate-spin text-info flex-shrink-0" />
          ) : run.status === 'passed' ? (
            <CheckCircle size={16} className="text-success flex-shrink-0" />
          ) : (
            <XCircle size={16} className="text-danger flex-shrink-0" />
          )}
          <div>
            <div className="text-sm font-semibold text-chalk">
              {isInProgress ? 'Replay in progress...' : `${run.status === 'passed' ? 'All steps passed' : 'Replay failed'}`}
            </div>
            {run.failureReason && (
              <div className="text-xs text-danger mt-0.5">{run.failureReason}</div>
            )}
          </div>
          <div className="ml-auto">
            <StatusBadge status={run.status} />
          </div>
        </div>

        {/* Metadata grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Browser', value: run.browser },
            { label: 'Steps', value: `${run.passedSteps}/${run.totalSteps} passed` },
            { label: 'Duration', value: formatDuration(run.durationMs) },
            { label: 'Started', value: formatDate(run.startedAt) },
          ].map((item) => (
            <div key={item.label} className="card p-4">
              <div className="text-label mb-1">{item.label}</div>
              <div className="text-sm font-medium text-chalk">{item.value}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div>
          <div className="flex items-center gap-1 border-b border-graphite-400 mb-4">
            {[
              { id: 'logs' as const, label: 'Execution Logs', icon: Terminal },
              { id: 'screenshots' as const, label: `Screenshots (${screenshots?.length ?? 0})`, icon: ImageIcon },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                  activeTab === tab.id
                    ? 'border-chalk text-chalk'
                    : 'border-transparent text-graphite-100 hover:text-chalk',
                )}
              >
                <tab.icon size={13} />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Logs panel - Vercel deployment log style */}
          {activeTab === 'logs' && (
            <div className="card bg-graphite-950 font-mono text-xs overflow-y-auto max-h-[500px] p-0">
              {!logs || logs.length === 0 ? (
                <div className="p-6 text-graphite-100 text-center">
                  {isInProgress ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 size={13} className="animate-spin" />
                      Waiting for logs...
                    </div>
                  ) : (
                    'No logs for this run.'
                  )}
                </div>
              ) : (
                <div className="divide-y divide-graphite-800">
                  {logs.map((log) => (
                    <div key={log.id} className="log-line flex items-start gap-3 px-4 py-1.5 hover:bg-graphite-800 transition-colors">
                      <span className="text-graphite-100 flex-shrink-0 tabular-nums">
                        {log.stepNumber !== null ? `[${String(log.stepNumber).padStart(2, '0')}]` : '[--]'}
                      </span>
                      <span className={clsx('flex-1 break-words', LOG_COLORS[log.level] ?? 'text-graphite-50')}>
                        {log.message}
                      </span>
                    </div>
                  ))}
                  {isInProgress && (
                    <div className="flex items-center gap-2 px-4 py-2 text-graphite-100">
                      <Loader2 size={11} className="animate-spin" />
                      Running...
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Screenshots grid */}
          {activeTab === 'screenshots' && (
            <div>
              {!screenshots || screenshots.length === 0 ? (
                <div className="card p-8 text-center text-graphite-100 text-sm">
                  {isInProgress ? 'Screenshots will appear after the run completes.' : 'No screenshots for this run.'}
                </div>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                  {screenshots.map((shot) => (
                    <div key={shot.id} className="card overflow-hidden">
                      <div className="relative bg-graphite-950 aspect-video flex items-center justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={getScreenshotFileUrl(shot.id)}
                          alt={`Step ${shot.stepNumber ?? 'failure'} screenshot`}
                          className="w-full h-full object-contain"
                          loading="lazy"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      </div>
                      <div className="px-3 py-2 border-t border-graphite-400 flex items-center justify-between">
                        <span className="text-xs text-graphite-100">
                          {shot.isFailure ? (
                            <span className="text-danger">Failure</span>
                          ) : (
                            `Step ${shot.stepNumber ?? '?'}`
                          )}
                        </span>
                        <span className="text-2xs text-graphite-100 truncate max-w-[120px]">
                          {shot.filename}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Video section */}
        {run.videoPath && (
          <div>
            <h2 className="text-base font-semibold text-chalk mb-3 flex items-center gap-2">
              <Video size={15} />
              Recording
            </h2>
            <div className="card overflow-hidden">
              <video
                controls
                className="w-full max-h-96 bg-black"
                src={`/api/backend/videos/run/${run.id}/stream`}
              >
                Your browser does not support video playback.
              </video>
            </div>
          </div>
        )}

        {/* Trace section */}
        {run.tracePath && (
          <div>
            <h2 className="text-base font-semibold text-chalk mb-3 flex items-center gap-2">
              <Zap size={15} />
              Playwright Trace
            </h2>
            <div className="card p-4 flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-chalk mb-1">Trace recorded</div>
                <div className="text-xs text-graphite-100 leading-relaxed">
                  Download the trace and open it at{' '}
                  <a
                    href="https://trace.playwright.dev"
                    target="_blank"
                    rel="noreferrer"
                    className="text-accent underline underline-offset-2"
                  >
                    trace.playwright.dev
                  </a>{' '}
                  to replay every step with DOM snapshots, network logs, and screenshots.
                </div>
              </div>
              <a
                href={getTraceDownloadUrl(run.id)}
                download={`trace-${run.id}.zip`}
                className="btn-secondary px-4 py-2 text-sm flex items-center gap-2 flex-shrink-0"
              >
                <Zap size={13} />
                Download
              </a>
            </div>
          </div>
        )}

        {reportMutation.error && (
          <div className="card p-4 text-danger text-sm">
            Report generation failed: {String(reportMutation.error)}
          </div>
        )}
      </div>
    </div>
  );
}
