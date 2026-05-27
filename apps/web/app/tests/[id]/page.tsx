'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Play,
  ChevronDown,
  ChevronRight,
  MousePointer,
  Type,
  CheckSquare,
  ArrowRight,
  Keyboard,
  Globe,
  Eye,
  Code,
  Loader2,
  Trash2,
  Pencil,
  X,
  Save,
} from 'lucide-react';
import { getTestCase, getTestCaseRuns, triggerReplay, deleteTestCase, updateTestCaseStep } from '@/lib/api';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { PageHeader } from '@/components/ui/PageHeader';
import type { RecordedStep } from '@qa-platform/shared';

const ACTION_ICONS: Record<string, React.ElementType> = {
  click: MousePointer,
  fill: Type,
  select: ChevronDown,
  check: CheckSquare,
  uncheck: CheckSquare,
  navigate: Globe,
  press: Keyboard,
  hover: Eye,
  scroll: ArrowRight,
  wait: Loader2,
};

function ActionBadge({ action }: { action: string }) {
  const Icon = ACTION_ICONS[action] ?? ArrowRight;
  const colorMap: Record<string, string> = {
    click: 'text-info bg-info-bg border-info-border',
    fill: 'text-warning bg-warning-bg border-warning-border',
    navigate: 'text-success bg-success-bg border-success-border',
    press: 'text-graphite-50 bg-graphite-700 border-graphite-400',
    select: 'text-warning bg-warning-bg border-warning-border',
    check: 'text-success bg-success-bg border-success-border',
    uncheck: 'text-danger bg-danger-bg border-danger-border',
  };
  const colorClass = colorMap[action] ?? 'text-graphite-50 bg-graphite-700 border-graphite-400';
  return (
    <span className={`badge border ${colorClass} capitalize`}>
      <Icon size={10} />
      {action}
    </span>
  );
}

function StepRow({ step, index, testCaseId }: { step: RecordedStep; index: number; testCaseId: string }) {
  const [expanded, setExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(step.value ?? step.option ?? '');
  const [editLocator, setEditLocator] = useState(step.locator.primary.value);
  
  const queryClient = useQueryClient();
  const updateMutation = useMutation({
    mutationFn: (data: { value?: string | null; locator?: any }) => updateTestCaseStep(testCaseId, step.id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['test-case', testCaseId] });
      setIsEditing(false);
    }
  });

  const handleSave = () => {
    let newLocator = step.locator;
    if (editLocator !== step.locator.primary.value) {
      if (!window.confirm("Warning: Changing the locator may break the test replay. Are you sure you want to proceed?")) {
        return;
      }
      newLocator = {
        ...step.locator,
        primary: { ...step.locator.primary, value: editLocator }
      };
    }
    
    updateMutation.mutate({ 
      value: (step.action === 'fill' || step.action === 'select') ? editValue : undefined,
      locator: newLocator
    });
  };

  const primary = step.locator.primary;

  return (
    <div className="border-b border-graphite-400 last:border-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-graphite-700 transition-colors"
      >
        <span className="text-2xs text-graphite-100 tabular-nums w-7 flex-shrink-0 text-center">
          {index + 1}
        </span>
        <ActionBadge action={step.action} />
        <span className="flex-1 text-sm text-chalk truncate">{step.title}</span>
        <span className="text-2xs text-graphite-100 hidden lg:block max-w-[200px] truncate">
          {step.url}
        </span>
        {expanded ? (
          <ChevronDown size={13} className="text-graphite-100 flex-shrink-0" />
        ) : (
          <ChevronRight size={13} className="text-graphite-100 flex-shrink-0" />
        )}
      </button>
      {expanded && (
        <div className="px-4 pb-4 bg-graphite-900 border-t border-graphite-400 animate-slide-up relative">
          <div className="absolute top-3 right-4">
            {isEditing ? (
              <div className="flex gap-2">
                <button onClick={() => setIsEditing(false)} className="btn-ghost px-2 py-1 text-xs"><X size={12} /> Cancel</button>
                <button onClick={handleSave} disabled={updateMutation.isPending} className="btn-primary px-2 py-1 text-xs">
                  {updateMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save
                </button>
              </div>
            ) : (
              <button onClick={() => setIsEditing(true)} className="btn-ghost px-2 py-1 text-xs"><Pencil size={12} /> Edit</button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4 pt-3 text-xs pr-24">
            <div>
              <div className="text-label mb-1">Description</div>
              <div className="text-graphite-50">{step.description}</div>
            </div>
            <div>
              <div className="text-label mb-1">Value / Input</div>
              {isEditing && (step.action === 'fill' || step.action === 'select') ? (
                <input
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="input-text py-1 px-2 text-xs w-full bg-graphite-800"
                />
              ) : (
                <div className="text-graphite-50 font-medium">
                  {step.value ?? step.option ?? <span className="text-graphite-400 italic">none</span>}
                </div>
              )}
            </div>
            <div>
              <div className="text-label mb-1">Locator (Primary)</div>
              {isEditing ? (
                <input
                  value={editLocator}
                  onChange={(e) => setEditLocator(e.target.value)}
                  className="input-text py-1 px-2 text-xs w-full bg-graphite-800 font-mono"
                />
              ) : (
                <code className="code-text">
                  {primary.strategy}=&quot;{primary.value}&quot;
                  {primary.name ? ` name="${primary.name}"` : ''}
                </code>
              )}
            </div>
            <div>
              <div className="text-label mb-1">Element</div>
              <div className="text-graphite-50">
                {step.element.tagName}
                {step.element.isSensitive && (
                  <span className="ml-2 text-warning text-2xs">sensitive</span>
                )}
              </div>
            </div>
            {step.locator.fallbacks.length > 0 && !isEditing && (
              <div className="col-span-2">
                <div className="text-label mb-1">Fallback Locators</div>
                <div className="flex flex-wrap gap-1">
                  {step.locator.fallbacks.map((f, i) => (
                    <code key={i} className="code-text">
                      {f.strategy}=&quot;{f.value}&quot;
                    </code>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return 'N/A';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(ms: number | null): string {
  if (!ms) return 'N/A';
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function TestCaseDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showJson, setShowJson] = useState(false);
  const [selectedEnvId, setSelectedEnvId] = useState<string>('');

  const { data: environments } = useQuery({
    queryKey: ['environments'],
    queryFn: async () => {
      const res = await fetch('http://localhost:3001/api/environments');
      if (!res.ok) return [];
      const json = await res.json();
      return json.data || json;
    },
  });

  useEffect(() => {
    if (environments && environments.length > 0 && !selectedEnvId) {
      setSelectedEnvId(environments[0].id);
    }
  }, [environments, selectedEnvId]);

  const { data: testCase, isLoading } = useQuery({
    queryKey: ['test-case', params.id],
    queryFn: () => getTestCase(params.id),
  });

  const { data: runs } = useQuery({
    queryKey: ['test-case-runs', params.id],
    queryFn: () => getTestCaseRuns(params.id),
  });

  const replayMutation = useMutation({
    mutationFn: () => triggerReplay(params.id, selectedEnvId || undefined),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['test-case', params.id] });
      router.push(`/runs/${data.runId}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteTestCase(params.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['test-cases'] });
      router.push('/tests');
    },
  });

  const handleDelete = () => {
    if (window.confirm("Are you sure you want to completely delete this test case? This action cannot be undone.")) {
      deleteMutation.mutate();
    }
  };

  if (isLoading) {
    return (
      <div className="px-8 py-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-graphite-700 rounded w-64" />
          <div className="h-4 bg-graphite-700 rounded w-96" />
        </div>
      </div>
    );
  }

  if (!testCase) {
    return (
      <div className="px-8 py-6">
        <div className="text-danger text-sm">Test case not found.</div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <PageHeader title={testCase.name} description={testCase.description ?? testCase.targetUrl}>
        <div className="flex items-center gap-2">
          <Link href="/tests" className="btn-ghost px-3 py-2 text-sm">
            <ArrowLeft size={14} />
            Back
          </Link>
          <button
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="btn-danger px-3 py-2 text-sm text-danger hover:bg-danger/10 border border-danger/20"
          >
            {deleteMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Delete
          </button>
          
          {environments && environments.length > 0 && (
            <select
              value={selectedEnvId}
              onChange={(e) => setSelectedEnvId(e.target.value)}
              className="input-base text-sm py-2 bg-graphite-800"
            >
              <option value="">No Environment (Default)</option>
              {environments.map((env: any) => (
                <option key={env.id} value={env.id}>{env.name}</option>
              ))}
            </select>
          )}

          <button
            id="replay-btn"
            onClick={() => replayMutation.mutate()}
            disabled={replayMutation.isPending}
            className="btn-primary px-4 py-2 text-sm"
          >
            {replayMutation.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Play size={14} />
            )}
            {replayMutation.isPending ? 'Starting...' : 'Replay'}
          </button>
        </div>
      </PageHeader>

      <div className="px-8 py-6 space-y-6">
        {/* Metadata */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Steps', value: testCase.stepCount },
            { label: 'Last Run', value: testCase.lastRunStatus ? <StatusBadge status={testCase.lastRunStatus} /> : 'N/A' },
            { label: 'Last Run At', value: formatDate(testCase.lastRunAt) },
            { label: 'Updated', value: formatDate(testCase.updatedAt) },
          ].map((item) => (
            <div key={item.label} className="card p-4">
              <div className="text-label mb-1">{item.label}</div>
              <div className="text-sm font-medium text-chalk">{item.value}</div>
            </div>
          ))}
        </div>

        {/* Step timeline */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-chalk">Steps</h2>
            <button
              onClick={() => setShowJson(!showJson)}
              className="btn-ghost px-3 py-1.5 text-xs"
            >
              <Code size={12} />
              {showJson ? 'Hide JSON' : 'View JSON'}
            </button>
          </div>

          {showJson ? (
            <div className="card overflow-hidden">
              <pre className="p-4 text-xs text-graphite-50 font-mono overflow-auto max-h-96 leading-relaxed">
                {JSON.stringify(testCase.steps, null, 2)}
              </pre>
            </div>
          ) : (
            <div className="card overflow-hidden">
              {testCase.steps.length === 0 ? (
                <div className="p-8 text-center text-graphite-100 text-sm">No steps recorded.</div>
              ) : (
                testCase.steps.map((step, i) => <StepRow key={step.id} step={step} index={i} testCaseId={testCase.id} />)
              )}
            </div>
          )}
        </div>

        {/* Run history */}
        {runs && runs.length > 0 && (
          <div>
            <h2 className="text-base font-semibold text-chalk mb-3">Run History</h2>
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-graphite-400">
                    <th className="text-left px-4 py-3 text-label">Status</th>
                    <th className="text-left px-4 py-3 text-label">Steps</th>
                    <th className="text-left px-4 py-3 text-label">Duration</th>
                    <th className="text-left px-4 py-3 text-label">Started</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {runs.map((run, i) => (
                    <tr
                      key={run.id}
                      className={`border-b border-graphite-400 hover:bg-graphite-700 transition-colors ${i === runs.length - 1 ? 'border-0' : ''}`}
                    >
                      <td className="px-4 py-3"><StatusBadge status={run.status} /></td>
                      <td className="px-4 py-3 text-graphite-100 tabular-nums">{run.passedSteps}/{run.totalSteps}</td>
                      <td className="px-4 py-3 text-graphite-100">{formatDuration(run.durationMs)}</td>
                      <td className="px-4 py-3 text-graphite-100">{formatDate(run.startedAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/runs/${run.id}`} className="text-xs text-graphite-100 hover:text-chalk">
                          View →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {replayMutation.error && (
          <div className="card p-4 text-danger text-sm">
            Replay failed to start: {String(replayMutation.error)}
          </div>
        )}
      </div>
    </div>
  );
}
