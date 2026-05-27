import { z } from 'zod';

// ─── Locator Schema ───────────────────────────────────────────────────────────

export const LocatorStrategySchema = z.enum([
  'aria-label',
  'role',
  'label',
  'placeholder',
  'text',
  'data-testid',
  'name',
  'id',
  'css',
  'xpath',
]);

export const LocatorEntrySchema = z.object({
  strategy: LocatorStrategySchema,
  value: z.string().min(1),
  name: z.string().optional(),
});

export const LocatorObjectSchema = z.object({
  primary: LocatorEntrySchema,
  fallbacks: z.array(LocatorEntrySchema),
});

// ─── Element Snapshot Schema ──────────────────────────────────────────────────

export const ElementSnapshotSchema = z.object({
  tagName: z.string(),
  text: z.string().nullable(),
  role: z.string().nullable(),
  ariaLabel: z.string().nullable(),
  placeholder: z.string().nullable(),
  label: z.string().nullable(),
  isSensitive: z.boolean(),
  value: z.string().optional(),
});

// ─── Action Type Schema ───────────────────────────────────────────────────────

export const ActionTypeSchema = z.enum([
  'click',
  'fill',
  'select',
  'check',
  'uncheck',
  'navigate',
  'press',
  'scroll',
  'hover',
  'wait',
]);

// ─── Recorded Step Schema ─────────────────────────────────────────────────────

export const RecordedStepSchema = z.object({
  id: z.string(),
  stepNumber: z.number().int().positive(),
  action: ActionTypeSchema,
  timestamp: z.string().datetime(),
  url: z.string(),
  pageTitle: z.string(),
  title: z.string(),
  description: z.string(),
  element: ElementSnapshotSchema,
  locator: LocatorObjectSchema,
  screenshot: z
    .object({
      path: z.string(),
    })
    .optional(),
  key: z.string().optional(),
  value: z.string().optional(),
  option: z.string().optional(),
});

// ─── Save Recording Request Schema ───────────────────────────────────────────

export const SaveRecordingRequestSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  targetUrl: z.string(),
  steps: z.array(RecordedStepSchema).min(1),
  projectId: z.string().optional(),
  recordVideo: z.boolean().optional(),
  takeScreenshots: z.boolean().optional(),
  headless: z.boolean().optional(),
  saveTraces: z.boolean().optional(),
});

// ─── Settings Schema ──────────────────────────────────────────────────────────

export const PlatformSettingsSchema = z.object({
  browser: z.enum(['chromium', 'firefox', 'webkit']).default('chromium'),
  headless: z.boolean().default(true),
  stepTimeoutMs: z.number().int().min(1000).max(60000).default(10000),
  captureScreenshots: z.boolean().default(true),
  recordVideo: z.boolean().default(true),
  saveTraces: z.boolean().default(false),
  reportAuthor: z.string().default('QA Team'),
  reportCompany: z.string().default(''),
  storagePath: z.string().default('./runs'),
  viewportWidth: z.number().int().min(320).max(3840).default(1280),
  viewportHeight: z.number().int().min(240).max(2160).default(720),
});
