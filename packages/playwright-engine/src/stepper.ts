/**
 * Step Executor
 *
 * Executes individual recorded steps using Playwright.
 *
 * For every step:
 * - Resolves the locator (primary → fallbacks)
 * - Smoothly animates mouse to element center (visible in video)
 * - Highlights the element with a red outline
 * - Takes screenshot at the right moment:
 *   - click/hover: BEFORE the action (shows highlighted target)
 *   - fill/select/check/press/navigate: AFTER the action (shows result)
 * - Handles retries with exponential backoff
 * - Generates rich, actionable error messages on failure
 */

import type { Page } from '@playwright/test';
import type { RecordedStep } from '@qa-platform/shared';
import { resolveLocator, describeLocator } from '@qa-platform/locator-utils';
import type { RunLogger } from './logger.js';
import type { Locator } from '@playwright/test';

export interface StepExecuteOptions {
  /** Total step timeout in ms */
  timeoutMs: number;
  /** Number of retry attempts on failure */
  retries: number;
  /** Base delay between retries in ms (doubles each attempt) */
  retryDelayMs: number;
  /** Environment variables to inject */
  environmentVariables?: Record<string, string>;
  /** Callback invoked before action while highlight is present (click/hover: captures target) */
  onBeforeAction?: () => Promise<void>;
  /** Callback invoked after action while highlight is present (fill/select: captures result) */
  onAfterAction?: () => Promise<void>;
}

const DEFAULT_OPTIONS: StepExecuteOptions = {
  timeoutMs: 10000,
  retries: 2,
  retryDelayMs: 500,
};

/**
 * Sleeps for the given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  // eslint-disable-next-line no-restricted-globals
  return new Promise((resolve) => global.setTimeout(resolve, ms));
}

/**
 * Builds a rich, actionable error message when a step fails.
 */
function buildStepErrorMessage(step: RecordedStep, cause: unknown, attempt: number): string {
  const primaryDesc = describeLocator(step.locator.primary);
  const causeMsg = cause instanceof Error ? cause.message : String(cause);
  return [
    `Step ${step.stepNumber} failed (attempt ${attempt}): ${step.title}`,
    `  Action: ${step.action}`,
    `  Locator: ${primaryDesc}`,
    `  URL: ${step.url}`,
    `  Cause: ${causeMsg}`,
  ].join('\n');
}

/**
 * Temporarily highlights an element by injecting CSS.
 * Useful for video recordings to show exactly what the engine is interacting with.
 */
async function highlightLocator(locator: Locator): Promise<void> {
  await locator.evaluate((node: any) => {
    node.style.outline = '3px solid #ef4444'; // Bright Red
    node.style.outlineOffset = '2px';
    node.style.boxShadow = '0 0 0 4px rgba(239, 68, 68, 0.25)';
    node.style.transition = 'outline 0.15s, box-shadow 0.15s';
  }).catch(() => {});
  // Brief pause so the highlight is visible in the video
  await sleep(350);
}

async function removeHighlight(locator: Locator): Promise<void> {
  await locator.evaluate((node: any) => {
    node.style.outline = '';
    node.style.outlineOffset = '';
    node.style.boxShadow = '';
    node.style.transition = '';
  }).catch(() => {});
}

/**
 * Smoothly moves the Playwright mouse to the center of the given locator.
 * Uses 20 interpolated steps so the injected cursor div tracks the movement
 * frame-by-frame in the recorded video.
 */
async function smoothMoveMouse(page: Page, locator: Locator): Promise<void> {
  try {
    const box = await locator.boundingBox();
    if (!box) return;
    const targetX = box.x + box.width / 2;
    const targetY = box.y + box.height / 2;
    await page.mouse.move(targetX, targetY, { steps: 20 });
  } catch {
    // If element disappears mid-move, ignore gracefully
  }
}

/**
 * Executes a single recorded step against a live Playwright page.
 * Retries on failure with exponential backoff.
 */
export async function executeStep(
  page: Page,
  step: RecordedStep,
  logger: RunLogger,
  options: Partial<StepExecuteOptions> = {},
): Promise<Locator | null> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= opts.retries + 1; attempt++) {
    try {
      const locator = await executeStepOnce(page, step, logger, opts.timeoutMs, opts.environmentVariables, opts.onBeforeAction, opts.onAfterAction);
      if (attempt > 1) {
        logger.info(`Step ${step.stepNumber} succeeded on attempt ${attempt}`, step.stepNumber);
      }
      return locator;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const msg = buildStepErrorMessage(step, lastError, attempt);

      if (attempt <= opts.retries) {
        const delay = opts.retryDelayMs * Math.pow(2, attempt - 1);
        logger.warn(`${msg}\n  Retrying in ${delay}ms...`, step.stepNumber);
        await sleep(delay);
      } else {
        logger.error(msg, step.stepNumber);
      }
    }
  }

  // All attempts failed
  throw lastError ?? new Error(`Step ${step.stepNumber} failed after ${opts.retries + 1} attempts`);
}

/**
 * Executes a single step attempt without retry logic.
 */
async function executeStepOnce(
  page: Page,
  step: RecordedStep,
  logger: RunLogger,
  timeoutMs: number,
  environmentVariables?: Record<string, string>,
  onBeforeAction?: () => Promise<void>,
  onAfterAction?: () => Promise<void>,
): Promise<Locator | null> {
  logger.info(`Executing step ${step.stepNumber}: ${step.title}`, step.stepNumber);

  // Smart Wait: Wait for common Enterprise App busy indicators to disappear
  try {
    await page.waitForFunction(() => {
      // Return true when NO busy indicator is visible
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const doc = (globalThis as any).document;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const win = (globalThis as any).window;
      if (!doc || !win) return true;
      const busy = doc.querySelector('[aria-busy="true"], .af_document_busy, .x1h1');
      if (!busy) return true;
      const style = win.getComputedStyle(busy);
      return style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0';
    }, { timeout: 3000 });
  } catch {
    // If it times out, we just proceed anyway.
  }

  switch (step.action) {
    case 'navigate': {
      logger.info(`Navigating to: ${step.url}`, step.stepNumber);
      
      const urlsMatch = (url1Str: string, url2Str: string): boolean => {
        try {
          const url1 = new URL(url1Str);
          const url2 = new URL(url2Str);
          if (url1.hostname !== url2.hostname) return false;
          const p1 = url1.pathname.replace(/\/$/, '');
          const p2 = url2.pathname.replace(/\/$/, '');
          return p1 === p2 || p1.startsWith(p2) || p2.startsWith(p1);
        } catch {
          return false;
        }
      };

      let naturallyTransitioned = false;
      if (urlsMatch(page.url(), step.url)) {
        naturallyTransitioned = true;
        logger.info(`Already on target URL page, skipping manual page.goto`, step.stepNumber);
      } else {
        try {
          // Wait up to 5 seconds to see if the page transitions naturally (e.g. after a login click/redirect)
          await page.waitForFunction((targetUrl) => {
            try {
              const current = (globalThis as any).location?.href || '';
              const url1 = new URL(current);
              const url2 = new URL(targetUrl);
              if (url1.hostname !== url2.hostname) return false;
              const p1 = url1.pathname.replace(/\/$/, '');
              const p2 = url2.pathname.replace(/\/$/, '');
              return p1 === p2 || p1.startsWith(p2) || p2.startsWith(p1);
            } catch {
              return false;
            }
          }, step.url, { timeout: 5000 });
          naturallyTransitioned = true;
          logger.info(`Detected natural transition to target host, skipping manual page.goto`, step.stepNumber);
        } catch {
          // Timeout, did not transition naturally
        }
      }

      if (!naturallyTransitioned) {
        await page.goto(step.url, { waitUntil: 'domcontentloaded', timeout: timeoutMs }).catch(() => {});
      }

      // Wait for full network settle so screenshot captures the completed page
      await page.waitForLoadState('networkidle', { timeout: 2000 }).catch(() => {});
      // Screenshot AFTER full page load
      if (onAfterAction) await onAfterAction();
      return null;
    }

    case 'click': {
      await page.waitForLoadState('networkidle', { timeout: 2000 }).catch(() => {});
      const { locator } = await resolveLocator(page, step.locator, {
        checkTimeoutMs: timeoutMs,
      });
      await locator.waitFor({ state: 'visible', timeout: timeoutMs });

      // 1. Smooth mouse glide to element center
      await smoothMoveMouse(page, locator);
      // 2. Highlight element
      await highlightLocator(locator);
      // 3. Screenshot BEFORE click (captures highlighted target)
      if (onBeforeAction) await onBeforeAction();
      // 4. Perform click
      await locator.click({ timeout: timeoutMs });
      // 5. Remove highlight (may throw if element removed by navigation)
      await removeHighlight(locator).catch(() => {});

      // Wait for any navigation that might be triggered
      await page.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {});
      return locator;
    }

    case 'fill': {
      await page.waitForLoadState('networkidle', { timeout: 2000 }).catch(() => {});
      const { locator } = await resolveLocator(page, step.locator, {
        checkTimeoutMs: timeoutMs,
      });
      await locator.waitFor({ state: 'visible', timeout: timeoutMs });

      // 1. Smooth mouse glide to element
      await smoothMoveMouse(page, locator);
      // 2. Clear and fill
      await locator.clear({ timeout: timeoutMs });
      let value = step.value ?? step.element.value ?? '';

      // Inject environment variables e.g. {{PASSWORD}}
      if (environmentVariables) {
        value = value.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
          return environmentVariables[key] !== undefined ? environmentVariables[key] : match;
        });
      }
      await locator.fill(value, { timeout: timeoutMs });
      // 3. Highlight (shows the typed text highlighted)
      await highlightLocator(locator);
      // 4. Screenshot AFTER fill (captures the filled value)
      if (onAfterAction) await onAfterAction();
      // 5. Remove highlight
      await removeHighlight(locator);

      // Warn if template variables are unresolved (e.g. {{PASSWORD}} when env var not set)
      const unresolvedMatch = value.match(/\{\{([^}]+)\}\}/);
      if (unresolvedMatch) {
        logger.warn(
          `Step ${step.stepNumber}: fill value still contains unresolved template variable '${unresolvedMatch[0]}' — ` +
          `set the ${unresolvedMatch[1]} environment variable in Settings → Environments to avoid invalid credential errors.`,
          step.stepNumber,
        );
      }

      logger.debug(
        `Filled with: ${step.element.isSensitive ? '[REDACTED]' : value}`,
        step.stepNumber,
      );
      return locator;
    }

    case 'select': {
      await page.waitForLoadState('networkidle', { timeout: 2000 }).catch(() => {});
      const { locator } = await resolveLocator(page, step.locator, {
        checkTimeoutMs: timeoutMs,
      });
      await locator.waitFor({ state: 'visible', timeout: timeoutMs });

      await smoothMoveMouse(page, locator);
      const option = step.option ?? step.value ?? '';
      await locator.selectOption(option, { timeout: timeoutMs });
      await highlightLocator(locator);
      if (onAfterAction) await onAfterAction();
      await removeHighlight(locator);

      logger.debug(`Selected option: ${option}`, step.stepNumber);
      return locator;
    }

    case 'check': {
      await page.waitForLoadState('networkidle', { timeout: 2000 }).catch(() => {});
      const { locator } = await resolveLocator(page, step.locator, {
        checkTimeoutMs: timeoutMs,
      });
      await locator.waitFor({ state: 'visible', timeout: timeoutMs });

      await smoothMoveMouse(page, locator);
      await locator.check({ timeout: timeoutMs });
      await highlightLocator(locator);
      if (onAfterAction) await onAfterAction();
      await removeHighlight(locator);

      return locator;
    }

    case 'uncheck': {
      await page.waitForLoadState('networkidle', { timeout: 2000 }).catch(() => {});
      const { locator } = await resolveLocator(page, step.locator, {
        checkTimeoutMs: timeoutMs,
      });
      await locator.waitFor({ state: 'visible', timeout: timeoutMs });

      await smoothMoveMouse(page, locator);
      await locator.uncheck({ timeout: timeoutMs });
      await highlightLocator(locator);
      if (onAfterAction) await onAfterAction();
      await removeHighlight(locator);

      return locator;
    }

    case 'press': {
      const key = step.key ?? 'Enter';
      // If we have a locator, focus that element first; otherwise press globally
      if (step.locator.primary.strategy !== 'css' || step.locator.primary.value !== 'body') {
        try {
          const { locator } = await resolveLocator(page, step.locator, { checkTimeoutMs: 2000 });
          await locator.press(key, { timeout: timeoutMs });
        } catch {
          // Fallback: press key on the page directly
          await page.keyboard.press(key);
        }
      } else {
        await page.keyboard.press(key);
      }
      // Short wait for any triggered navigation to settle
      await sleep(600);
      if (onAfterAction) await onAfterAction();
      logger.debug(`Pressed key: ${key}`, step.stepNumber);
      return null;
    }

    case 'hover': {
      await page.waitForLoadState('networkidle', { timeout: 2000 }).catch(() => {});
      const { locator } = await resolveLocator(page, step.locator, {
        checkTimeoutMs: timeoutMs,
      });
      await locator.waitFor({ state: 'visible', timeout: timeoutMs });

      await smoothMoveMouse(page, locator);
      await locator.hover({ timeout: timeoutMs });
      await highlightLocator(locator);
      if (onBeforeAction) await onBeforeAction();
      await removeHighlight(locator);

      return locator;
    }

    case 'scroll': {
      // Scroll to element if locator is present; otherwise scroll window
      try {
        const { locator } = await resolveLocator(page, step.locator, { checkTimeoutMs: 2000 });
        await locator.scrollIntoViewIfNeeded({ timeout: timeoutMs });
      } catch {
        await page.evaluate('window.scrollBy(0, 300)');
      }
      if (onAfterAction) await onAfterAction();
      return null;
    }

    case 'wait': {
      // Simple pause step — useful for waiting for animations or async loads
      const waitMs = 1000;
      await sleep(waitMs);
      logger.debug(`Waited ${waitMs}ms`, step.stepNumber);
      if (onAfterAction) await onAfterAction();
      return null;
    }

    default: {
      // TypeScript exhaustiveness guard
      const exhaustiveCheck: never = step.action;
      throw new Error(`Unknown action type: ${String(exhaustiveCheck)}`);
    }
  }
}
