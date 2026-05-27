/**
 * Capture Utilities
 *
 * Handles screenshot, video, and Playwright trace artifacts for replay runs.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { Page, BrowserContext } from '@playwright/test';
import type { RunLogger } from './logger.js';

export interface CaptureConfig {
  /** Absolute path to the base runs directory */
  runsDir: string;
  /** Run ID — used as subdirectory name */
  runId: string;
  /** Capture screenshots after each step */
  captureScreenshots: boolean;
  /** Record video */
  recordVideo: boolean;
  /** Save Playwright trace */
  saveTraces: boolean;
}

export interface StepScreenshotResult {
  path: string;
  filename: string;
}

/**
 * Returns the directory paths for a given run.
 */
export function getRunPaths(runsDir: string, runId: string) {
  const runDir = path.join(runsDir, runId);
  return {
    runDir,
    screenshotsDir: path.join(runDir, 'screenshots'),
    videoDir: path.join(runDir, 'video'),
    traceDir: path.join(runDir, 'trace'),
  };
}

/**
 * Creates all directories for a run.
 */
export async function ensureRunDirectories(runsDir: string, runId: string): Promise<void> {
  const paths = getRunPaths(runsDir, runId);
  await fs.mkdir(paths.screenshotsDir, { recursive: true });
  await fs.mkdir(paths.videoDir, { recursive: true });
  await fs.mkdir(paths.traceDir, { recursive: true });
}

/**
 * Slugifies a string for use in filenames.
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 40);
}

/**
 * Captures a screenshot after a step completes.
 *
 * Filename format: step-001-click-submit.png
 */
export async function captureStepScreenshot(
  page: Page,
  config: CaptureConfig,
  stepNumber: number,
  actionDescription: string,
  logger: RunLogger,
): Promise<StepScreenshotResult | null> {
  if (!config.captureScreenshots) return null;

  const { screenshotsDir } = getRunPaths(config.runsDir, config.runId);
  const paddedStep = String(stepNumber).padStart(3, '0');
  const slug = slugify(actionDescription);
  const filename = `step-${paddedStep}-${slug}.png`;
  const filePath = path.join(screenshotsDir, filename);

  try {
    await page.screenshot({ path: filePath, fullPage: false, animations: 'disabled' });
    logger.debug(`Screenshot saved: ${filename}`, stepNumber);
    return { path: filePath, filename };
  } catch (err) {
    logger.warn(
      `Could not capture screenshot for step ${stepNumber}: ${String(err)}`,
      stepNumber,
    );
    return null;
  }
}

/**
 * Captures a failure screenshot.
 *
 * Filename format: failure-step-004.png
 */
export async function captureFailureScreenshot(
  page: Page,
  config: CaptureConfig,
  stepNumber: number,
  logger: RunLogger,
): Promise<StepScreenshotResult | null> {
  const { screenshotsDir } = getRunPaths(config.runsDir, config.runId);
  const paddedStep = String(stepNumber).padStart(3, '0');
  const filename = `failure-step-${paddedStep}.png`;
  const filePath = path.join(screenshotsDir, filename);

  try {
    await page.screenshot({ path: filePath, fullPage: true, animations: 'disabled' });
    logger.info(`Failure screenshot saved: ${filename}`, stepNumber);
    return { path: filePath, filename };
  } catch (err) {
    logger.warn(`Could not capture failure screenshot: ${String(err)}`, stepNumber);
    return null;
  }
}

/**
 * Stops Playwright trace recording and saves the trace zip.
 */
export async function saveTrace(
  context: BrowserContext,
  config: CaptureConfig,
  logger: RunLogger,
): Promise<string | null> {
  if (!config.saveTraces) return null;

  const { traceDir } = getRunPaths(config.runsDir, config.runId);
  const tracePath = path.join(traceDir, 'trace.zip');

  try {
    // sources: true includes source files in the trace per Playwright docs
    await context.tracing.stop({ path: tracePath });
    logger.info(`Playwright trace saved: trace.zip`);
    return tracePath;
  } catch (err) {
    logger.warn(`Could not save Playwright trace: ${String(err)}`);
    return null;
  }
}

/**
 * Finds the video file saved by Playwright in the video directory.
 * Playwright saves videos automatically when recordVideo is set in context.
 */
export async function findVideoFile(
  config: CaptureConfig,
  logger: RunLogger,
): Promise<string | null> {
  if (!config.recordVideo) return null;

  const { videoDir } = getRunPaths(config.runsDir, config.runId);

  try {
    const files = await fs.readdir(videoDir);
    const videoFile = files.find((f) => f.endsWith('.webm') || f.endsWith('.mp4'));
    if (videoFile) {
      const videoPath = path.join(videoDir, videoFile);
      logger.info(`Video file found: ${videoFile}`);
      return videoPath;
    }
    logger.warn('No video file found in video directory');
    return null;
  } catch (err) {
    logger.warn(`Could not read video directory: ${String(err)}`);
    return null;
  }
}
