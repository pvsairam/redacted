/**
 * @qa-platform/shared
 *
 * Canonical TypeScript types for the entire QA Platform.
 * All apps and packages import from this single source of truth.
 */

// ─── Action Types ─────────────────────────────────────────────────────────────

export type ActionType =
  | 'click'
  | 'fill'
  | 'select'
  | 'check'
  | 'uncheck'
  | 'navigate'
  | 'press'
  | 'scroll'
  | 'hover'
  | 'wait';

// ─── Run Status ───────────────────────────────────────────────────────────────

export type RunStatus = 'pending' | 'running' | 'passed' | 'failed' | 'cancelled';

// ─── Log Level ────────────────────────────────────────────────────────────────

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

// ─── Step Result ──────────────────────────────────────────────────────────────

export type StepResult = 'passed' | 'failed' | 'skipped';

// ─── Locator Strategy ─────────────────────────────────────────────────────────

export type LocatorStrategyType =
  | 'aria-label'
  | 'role'
  | 'label'
  | 'placeholder'
  | 'text'
  | 'data-testid'
  | 'name'
  | 'id'
  | 'css'
  | 'xpath';

export interface LocatorEntry {
  strategy: LocatorStrategyType;
  value: string;
  /** For role strategy: the accessible name */
  name?: string;
}

export interface LocatorObject {
  primary: LocatorEntry;
  fallbacks: LocatorEntry[];
}

// ─── Element Snapshot ─────────────────────────────────────────────────────────

export interface ElementSnapshot {
  tagName: string;
  text: string | null;
  role: string | null;
  ariaLabel: string | null;
  placeholder: string | null;
  label: string | null;
  /** True when the field has been detected as sensitive and value is masked */
  isSensitive: boolean;
  /** The typed value — masked to '[REDACTED]' if isSensitive */
  value?: string;
}

// ─── Recorded Step ────────────────────────────────────────────────────────────

export interface RecordedStep {
  id: string;
  stepNumber: number;
  action: ActionType;
  timestamp: string; // ISO 8601
  url: string;
  pageTitle: string;
  title: string;
  description: string;
  element: ElementSnapshot;
  locator: LocatorObject;
  screenshot?: {
    path: string;
  };
  /** Key pressed for 'press' actions */
  key?: string;
  /** Value filled for 'fill' actions */
  value?: string;
  /** Option value/text for 'select' actions */
  option?: string;
}

// ─── Test Case ────────────────────────────────────────────────────────────────

export interface TestCase {
  id: string;
  name: string;
  description: string | null;
  targetUrl: string;
  projectId: string | null;
  steps: RecordedStep[];
  createdAt: string;
  updatedAt: string;
  lastRunStatus: RunStatus | null;
  lastRunAt: string | null;
  stepCount: number;
  recordVideo?: boolean;
  takeScreenshots?: boolean;
  headless?: boolean;
  saveTraces?: boolean;
}

// ─── Test Run ─────────────────────────────────────────────────────────────────

export interface TestRun {
  id: string;
  testCaseId: string;
  testCaseName: string;
  status: RunStatus;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  browser: string;
  targetUrl: string;
  totalSteps: number;
  passedSteps: number;
  failedStep: number | null;
  failureReason: string | null;
  videoPath: string | null;
  tracePath: string | null;
  createdAt: string;
}

// ─── Execution Log ────────────────────────────────────────────────────────────

export interface ExecutionLog {
  id: string;
  runId: string;
  stepNumber: number | null;
  level: LogLevel;
  message: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

// ─── Screenshot ───────────────────────────────────────────────────────────────

export interface Screenshot {
  id: string;
  runId: string;
  stepNumber: number | null;
  path: string;
  /** Filename relative to the run directory */
  filename: string;
  isFailure: boolean;
  capturedAt: string;
}

// ─── Video ────────────────────────────────────────────────────────────────────

export interface Video {
  id: string;
  runId: string;
  path: string;
  filename: string;
  durationMs: number | null;
  createdAt: string;
}

// ─── Report ───────────────────────────────────────────────────────────────────

export interface Report {
  id: string;
  runId: string;
  testCaseName: string;
  path: string;
  filename: string;
  generatedAt: string;
}

// ─── Project ──────────────────────────────────────────────────────────────────

export interface Project {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  testCaseCount: number;
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export interface PlatformSettings {
  /** Browser to use for replay: chromium | firefox | webkit */
  browser: 'chromium' | 'firefox' | 'webkit';
  /** Run browser in headless mode */
  headless: boolean;
  /** Default step timeout in milliseconds */
  stepTimeoutMs: number;
  /** Capture screenshot after each step */
  captureScreenshots: boolean;
  /** Record video for each run */
  recordVideo: boolean;
  /** Save Playwright trace artifacts */
  saveTraces: boolean;
  /** Author name for DOCX reports */
  reportAuthor: string;
  /** Company name for DOCX reports */
  reportCompany: string;
  /** Storage path for run artifacts (relative to server) */
  storagePath: string;
  /** Viewport width */
  viewportWidth: number;
  /** ViewportHeight */
  viewportHeight: number;
}

// ─── API Response Wrappers ────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: string;
  code?: string;
  details?: unknown;
}

export type ApiResult<T> = ApiResponse<T> | ApiError;

// ─── Run Result (from playwright-engine) ─────────────────────────────────────

export interface StepExecutionResult {
  stepNumber: number;
  result: StepResult;
  durationMs: number;
  screenshotPath: string | null;
  errorMessage: string | null;
}

export interface RunResult {
  runId: string;
  status: RunStatus;
  startedAt: Date;
  completedAt: Date;
  durationMs: number;
  stepResults: StepExecutionResult[];
  videoPath: string | null;
  tracePath: string | null;
  failedAtStep: number | null;
  failureReason: string | null;
}

// ─── Extension → Backend ──────────────────────────────────────────────────────

export interface SaveRecordingRequest {
  name: string;
  description?: string;
  targetUrl: string;
  steps: RecordedStep[];
  projectId?: string;
  recordVideo?: boolean;
  takeScreenshots?: boolean;
  headless?: boolean;
  saveTraces?: boolean;
}

export interface SaveRecordingResponse {
  testCaseId: string;
  name: string;
  stepCount: number;
}

// ─── Dashboard Stats ──────────────────────────────────────────────────────────

export interface DashboardStats {
  totalTestCases: number;
  totalRuns: number;
  failedRuns: number;
  passedRuns: number;
  avgDurationMs: number | null;
  recentRuns: TestRun[];
}
