/**
 * Settings service
 *
 * Loads and saves platform settings from the database.
 * Falls back to environment variable defaults when DB has no entry.
 */

import { prisma } from '../lib/prisma.js';
import type { PlatformSettings } from '@qa-platform/shared';
import { PlatformSettingsSchema } from '@qa-platform/shared';

const MOCK_USER_ID = 'local-user';

/**
 * Returns default settings from environment variables.
 */
function getEnvDefaults(): PlatformSettings {
  return PlatformSettingsSchema.parse({
    browser: process.env['DEFAULT_BROWSER'] ?? 'chromium',
    headless: process.env['DEFAULT_HEADLESS'] !== 'false',
    stepTimeoutMs: parseInt(process.env['DEFAULT_STEP_TIMEOUT_MS'] ?? '10000', 10),
    captureScreenshots: process.env['DEFAULT_CAPTURE_SCREENSHOTS'] !== 'false',
    recordVideo: process.env['DEFAULT_RECORD_VIDEO'] !== 'false',
    saveTraces: process.env['DEFAULT_SAVE_TRACES'] !== 'false',
    reportAuthor: process.env['DEFAULT_REPORT_AUTHOR'] ?? 'Automation Team',
    reportCompany: process.env['DEFAULT_REPORT_COMPANY'] ?? '',
    storagePath: process.env['RUNS_STORAGE_PATH'] ?? './runs',
    viewportWidth: 1280,
    viewportHeight: 720,
  });
}

/**
 * Loads settings from the database, merged with environment defaults.
 */
export async function getSettings(): Promise<PlatformSettings> {
  const rows = await prisma.settings.findMany({
    where: { userId: MOCK_USER_ID },
  });

  const dbValues: Record<string, string> = {};
  for (const row of rows) {
    dbValues[row.key] = row.value;
  }

  const defaults = getEnvDefaults();

  // Merge database values over defaults
  return PlatformSettingsSchema.parse({
    browser: dbValues['browser'] ?? defaults.browser,
    headless: dbValues['headless'] !== undefined ? dbValues['headless'] === 'true' : defaults.headless,
    stepTimeoutMs: dbValues['stepTimeoutMs'] ? parseInt(dbValues['stepTimeoutMs'], 10) : defaults.stepTimeoutMs,
    captureScreenshots: dbValues['captureScreenshots'] !== undefined ? dbValues['captureScreenshots'] === 'true' : defaults.captureScreenshots,
    recordVideo: dbValues['recordVideo'] !== undefined ? dbValues['recordVideo'] === 'true' : defaults.recordVideo,
    saveTraces: dbValues['saveTraces'] !== undefined ? dbValues['saveTraces'] === 'true' : defaults.saveTraces,
    reportAuthor: dbValues['reportAuthor'] ?? defaults.reportAuthor,
    reportCompany: dbValues['reportCompany'] ?? defaults.reportCompany,
    storagePath: dbValues['storagePath'] ?? defaults.storagePath,
    viewportWidth: dbValues['viewportWidth'] ? parseInt(dbValues['viewportWidth'], 10) : defaults.viewportWidth,
    viewportHeight: dbValues['viewportHeight'] ? parseInt(dbValues['viewportHeight'], 10) : defaults.viewportHeight,
  });
}

/**
 * Saves a partial settings update to the database.
 */
export async function saveSettings(partial: Partial<PlatformSettings>): Promise<PlatformSettings> {
  const current = await getSettings();
  const merged = PlatformSettingsSchema.parse({ ...current, ...partial });

  // Upsert each key
  const entries = Object.entries(merged) as [keyof PlatformSettings, unknown][];
  for (const [key, value] of entries) {
    await prisma.settings.upsert({
      where: { userId_key: { userId: MOCK_USER_ID, key } },
      create: { userId: MOCK_USER_ID, key, value: String(value) },
      update: { value: String(value) },
    });
  }

  return merged;
}
