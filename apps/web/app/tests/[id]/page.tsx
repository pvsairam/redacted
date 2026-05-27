'use client';

import { useState, useEffect, Fragment } from 'react';
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
import { getTestCase, getTestCaseRuns, triggerReplay, deleteTestCase, updateTestCaseStep, deleteTestCaseStep, insertTestCaseStep } from '@/lib/api';
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
  const [editStrategy, setEditStrategy] = useState(step.locator.primary.strategy);

  useEffect(() => {
    if (isEditing) {
      setEditValue(step.value ?? step.option ?? '');
      setEditLocator(step.locator.primary.value);
      setEditStrategy(step.locator.primary.strategy);
    }
  }, [isEditing, step]);
  
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: (data: { value?: string | null; locator?: any }) => updateTestCaseStep(testCaseId, step.id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['test-case', testCaseId] });
      setIsEditing(false);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteTestCaseStep(testCaseId, step.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['test-case', testCaseId] });
    },
  });

  const handleDelete = () => {
    if (window.confirm(`Delete step ${index + 1}: "${step.title}"?\n\nThis cannot be undone.`)) {
      deleteMutation.mutate();
    }
  };

  const handleSave = () => {
    let newLocator = step.locator;
    if (editLocator !== step.locator.primary.value || editStrategy !== step.locator.primary.strategy) {
      if (!window.confirm("Warning: Changing the locator may break the test replay. Are you sure you want to proceed?")) {
        return;
      }
      newLocator = {
        ...step.locator,
        primary: { ...step.locator.primary, strategy: editStrategy, value: editLocator }
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
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                  className="btn-ghost px-2 py-1 text-xs text-danger hover:bg-danger-bg hover:border-danger-border border border-transparent"
                  title="Delete this step"
                >
                  {deleteMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                  Delete
                </button>
                <button onClick={() => setIsEditing(true)} className="btn-ghost px-2 py-1 text-xs"><Pencil size={12} /> Edit</button>
              </div>
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
                <div className="flex gap-2">
                  <select
                    value={editStrategy}
                    onChange={(e) => setEditStrategy(e.target.value as any)}
                    className="input-text py-1 px-2 text-xs bg-graphite-800 outline-none"
                  >
                    <option value="css">css</option>
                    <option value="xpath">xpath</option>
                    <option value="id">id</option>
                    <option value="data-testid">data-testid</option>
                    <option value="text">text</option>
                    <option value="role">role</option>
                    <option value="aria-label">aria-label</option>
                    <option value="label">label</option>
                    <option value="placeholder">placeholder</option>
                    <option value="name">name</option>
                  </select>
                  <input
                    value={editLocator}
                    onChange={(e) => setEditLocator(e.target.value)}
                    className="input-text py-1 px-2 text-xs flex-1 bg-graphite-800 font-mono"
                  />
                </div>
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

function InsertStepDivider({ onClick }: { onClick: () => void }) {
  return (
    <div 
      className="group relative flex justify-center items-center h-2 hover:h-10 transition-all duration-200 cursor-pointer"
      onClick={onClick}
    >
      <div className="absolute inset-x-0 h-[1px] bg-graphite-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        className="absolute flex items-center gap-1.5 px-3 py-1 bg-graphite-800 border border-graphite-400 hover:border-chalk hover:bg-graphite-700 text-graphite-100 hover:text-chalk rounded-full text-[10px] font-semibold tracking-wider uppercase opacity-0 group-hover:opacity-100 transform scale-90 group-hover:scale-100 transition-all duration-200 shadow-lg pointer-events-none group-hover:pointer-events-auto"
      >
        <span className="text-xs font-bold">+</span> Insert Step
      </button>
    </div>
  );
}

export default function TestCaseDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showJson, setShowJson] = useState(false);
  const [selectedEnvId, setSelectedEnvId] = useState<string>('');

  const [showInsertModal, setShowInsertModal] = useState(false);
  const [insertStepNumber, setInsertStepNumber] = useState(1);
  const [action, setAction] = useState('click');
  const [stepTitle, setStepTitle] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [pageTitle, setPageTitle] = useState('');
  const [strategy, setStrategy] = useState('css');
  const [locatorValue, setLocatorValue] = useState('');
  const [roleName, setRoleName] = useState('');
  const [valueField, setValueField] = useState('');
  const [optionField, setOptionField] = useState('');
  const [keyField, setKeyField] = useState('');

  const suggestTitle = (act: string, loc: string) => {
    let valStr = loc ? ` "${loc}"` : '';
    let defaultTitle = '';
    switch (act) {
      case 'click':
        defaultTitle = `Click on${valStr}`;
        break;
      case 'fill':
        defaultTitle = `Fill input${valStr}`;
        break;
      case 'select':
        defaultTitle = `Select option from${valStr}`;
        break;
      case 'check':
        defaultTitle = `Check checkbox${valStr}`;
        break;
      case 'uncheck':
        defaultTitle = `Uncheck checkbox${valStr}`;
        break;
      case 'navigate':
        defaultTitle = `Navigate to page`;
        break;
      case 'press':
        defaultTitle = `Press key`;
        break;
      case 'hover':
        defaultTitle = `Hover over${valStr}`;
        break;
      case 'scroll':
        defaultTitle = `Scroll page`;
        break;
      case 'wait':
        defaultTitle = `Wait for duration`;
        break;
      default:
        defaultTitle = 'Custom step';
    }
    setStepTitle(defaultTitle);
  };

  const openInsertModal = (stepNum: number) => {
    setInsertStepNumber(stepNum);
    let defaultUrl = testCase?.targetUrl || '';
    let defaultPageTitle = testCase?.name || '';
    
    if (stepNum > 1 && testCase?.steps && testCase.steps[stepNum - 2]) {
      defaultUrl = testCase.steps[stepNum - 2]!.url;
      defaultPageTitle = testCase.steps[stepNum - 2]!.pageTitle;
    }
    
    setAction('click');
    setStepTitle('Click on element');
    setDescription('');
    setUrl(defaultUrl);
    setPageTitle(defaultPageTitle);
    setStrategy('css');
    setLocatorValue('');
    setRoleName('');
    setValueField('');
    setOptionField('');
    setKeyField('');
    setShowInsertModal(true);
  };

  const insertMutation = useMutation({
    mutationFn: (data: { stepNumber: number; stepData: any }) => insertTestCaseStep(params.id, data.stepNumber, data.stepData),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['test-case', params.id] });
      setShowInsertModal(false);
    },
  });

  const handleSubmitStep = (e: React.FormEvent) => {
    e.preventDefault();
    
    const locator = ['navigate', 'wait', 'scroll'].includes(action) 
      ? { primary: { strategy: 'css', value: '' }, fallbacks: [] }
      : {
          primary: {
            strategy: strategy,
            value: locatorValue,
            ...(strategy === 'role' && roleName ? { name: roleName } : {}),
          },
          fallbacks: [],
        };
        
    const element = {
      tagName: action === 'fill' ? 'INPUT' : action === 'select' ? 'SELECT' : 'BUTTON',
      isSensitive: false,
      text: null,
      role: strategy === 'role' ? roleName || null : null,
      ariaLabel: strategy === 'aria-label' ? locatorValue : null,
      placeholder: strategy === 'placeholder' ? locatorValue : null,
      label: strategy === 'label' ? locatorValue : null,
    };

    const stepData = {
      action,
      url,
      pageTitle,
      title: stepTitle,
      description: description || `Manually inserted ${action} step`,
      element,
      locator,
      key: action === 'press' ? keyField : undefined,
      value: ['fill', 'wait', 'scroll'].includes(action) ? valueField : undefined,
      option: action === 'select' ? optionField : undefined,
    };

    insertMutation.mutate({
      stepNumber: insertStepNumber,
      stepData,
    });
  };

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
                <div className="p-8 text-center space-y-4">
                  <div className="text-graphite-100 text-sm">No steps recorded.</div>
                  <button
                    onClick={() => openInsertModal(1)}
                    className="btn-primary px-4 py-2 text-xs"
                  >
                    + Add First Step
                  </button>
                </div>
              ) : (
                <div className="flex flex-col">
                  <InsertStepDivider onClick={() => openInsertModal(1)} />
                  {testCase.steps.map((step, i) => (
                    <Fragment key={step.id}>
                      <StepRow step={step} index={i} testCaseId={testCase.id} />
                      <InsertStepDivider onClick={() => openInsertModal(i + 2)} />
                    </Fragment>
                  ))}
                </div>
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

        {showInsertModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
            <div className="card w-full max-w-lg bg-graphite-900 border-graphite-400 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-graphite-400 bg-graphite-800">
                <h3 className="text-base font-semibold text-chalk">
                  Insert Step at Position {insertStepNumber}
                </h3>
                <button
                  onClick={() => setShowInsertModal(false)}
                  className="text-graphite-100 hover:text-chalk"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body */}
              <form onSubmit={handleSubmitStep} className="p-6 space-y-4 overflow-y-auto flex-1 animate-fade-in">
                {/* Action Type */}
                <div>
                  <label className="text-label mb-1 block">Action Type</label>
                  <select
                    value={action}
                    onChange={(e) => {
                      const val = e.target.value;
                      setAction(val);
                      suggestTitle(val, locatorValue);
                    }}
                    className="input-base bg-graphite-800"
                  >
                    <option value="click">Click</option>
                    <option value="fill">Fill (Input text)</option>
                    <option value="select">Select option</option>
                    <option value="check">Check checkbox</option>
                    <option value="uncheck">Uncheck checkbox</option>
                    <option value="navigate">Navigate to URL</option>
                    <option value="press">Press key</option>
                    <option value="hover">Hover element</option>
                    <option value="scroll">Scroll page</option>
                    <option value="wait">Wait duration</option>
                  </select>
                </div>

                {/* Title */}
                <div>
                  <label className="text-label mb-1 block">Step Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Click Login Button"
                    value={stepTitle}
                    onChange={(e) => setStepTitle(e.target.value)}
                    className="input-base bg-graphite-800"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="text-label mb-1 block">Description</label>
                  <input
                    type="text"
                    placeholder="e.g. Clicks on the primary login button"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="input-base bg-graphite-800"
                  />
                </div>

                {/* URL */}
                <div>
                  <label className="text-label mb-1 block">URL</label>
                  <input
                    type="text"
                    required
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="input-base bg-graphite-800"
                  />
                </div>

                {/* Page Title */}
                <div>
                  <label className="text-label mb-1 block">Page Title</label>
                  <input
                    type="text"
                    value={pageTitle}
                    onChange={(e) => setPageTitle(e.target.value)}
                    className="input-base bg-graphite-800"
                  />
                </div>

                {/* Locator Strategy & Value (Only show if action is not navigate/wait/scroll) */}
                {!['navigate', 'wait', 'scroll'].includes(action) && (
                  <div className="grid grid-cols-3 gap-3 border border-graphite-400/40 p-3 rounded bg-graphite-800/40">
                    <div className="col-span-1">
                      <label className="text-label mb-1 block">Strategy</label>
                      <select
                        value={strategy}
                        onChange={(e) => setStrategy(e.target.value)}
                        className="input-base bg-graphite-800 py-1.5 px-2 text-xs"
                      >
                        <option value="css">CSS</option>
                        <option value="xpath">XPath</option>
                        <option value="id">ID</option>
                        <option value="data-testid">data-testid</option>
                        <option value="text">Text</option>
                        <option value="role">Role</option>
                        <option value="aria-label">Aria-label</option>
                        <option value="label">Label</option>
                        <option value="placeholder">Placeholder</option>
                        <option value="name">Name</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="text-label mb-1 block">Selector Value</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. #login-btn"
                        value={locatorValue}
                        onChange={(e) => {
                          setLocatorValue(e.target.value);
                          suggestTitle(action, e.target.value);
                        }}
                        className="input-base bg-graphite-800 py-1.5 px-2 text-xs font-mono"
                      />
                    </div>
                    
                    {strategy === 'role' && (
                      <div className="col-span-3">
                        <label className="text-label mb-1 block">Role Accessible Name (optional)</label>
                        <input
                          type="text"
                          placeholder="e.g. Login"
                          value={roleName}
                          onChange={(e) => setRoleName(e.target.value)}
                          className="input-base bg-graphite-800 py-1.5 px-2 text-xs"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Dynamic fields based on action */}
                {action === 'fill' && (
                  <div>
                    <label className="text-label mb-1 block">Text to Fill</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. my-username"
                      value={valueField}
                      onChange={(e) => setValueField(e.target.value)}
                      className="input-base bg-graphite-800"
                    />
                  </div>
                )}

                {action === 'select' && (
                  <div>
                    <label className="text-label mb-1 block">Option to Select (Value or Label)</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. US"
                      value={optionField}
                      onChange={(e) => setOptionField(e.target.value)}
                      className="input-base bg-graphite-800"
                    />
                  </div>
                )}

                {action === 'press' && (
                  <div>
                    <label className="text-label mb-1 block">Key to Press</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Enter, Tab, ArrowDown"
                      value={keyField}
                      onChange={(e) => setKeyField(e.target.value)}
                      className="input-base bg-graphite-800"
                    />
                  </div>
                )}

                {action === 'wait' && (
                  <div>
                    <label className="text-label mb-1 block">Wait Duration (in milliseconds)</label>
                    <input
                      type="number"
                      required
                      min="100"
                      max="30000"
                      placeholder="e.g. 2000"
                      value={valueField}
                      onChange={(e) => setValueField(e.target.value)}
                      className="input-base bg-graphite-800"
                    />
                  </div>
                )}

                {action === 'scroll' && (
                  <div>
                    <label className="text-label mb-1 block">Scroll direction / selector (optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. window or selector"
                      value={valueField}
                      onChange={(e) => setValueField(e.target.value)}
                      className="input-base bg-graphite-800"
                    />
                  </div>
                )}

                {/* Modal Footer */}
                <div className="flex justify-end gap-3 pt-4 border-t border-graphite-400">
                  <button
                    type="button"
                    onClick={() => setShowInsertModal(false)}
                    className="btn-ghost px-4 py-2"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={insertMutation.isPending}
                    className="btn-primary px-5 py-2"
                  >
                    {insertMutation.isPending ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Inserting...
                      </>
                    ) : (
                      'Insert Step'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
