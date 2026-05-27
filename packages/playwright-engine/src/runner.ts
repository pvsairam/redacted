/**
 * Replay Runner
 *
 * Main orchestrator for test case replay.
 *
 * Flow:
 * 1. Create run directories
 * 2. Launch Playwright browser with optional video recording
 * 3. Start trace recording if enabled
 * 4. Execute each step sequentially
 * 5. Capture screenshot after each step
 * 6. Capture failure screenshot on step error
 * 7. Save trace and find video file
 * 8. Close browser cleanly
 * 9. Return structured RunResult
 */

import { firefox, webkit } from 'playwright';
import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';

chromium.use(stealth());
import type { Browser, BrowserContext } from '@playwright/test';
import type { RecordedStep, RunResult, PlatformSettings, StepExecutionResult } from '@qa-platform/shared';
import { RunLogger } from './logger.js';
import type { OnLogCallback } from './logger.js';
import { executeStep } from './stepper.js';
import {
  ensureRunDirectories,
  captureStepScreenshot,
  captureFailureScreenshot,
  saveTrace,
  findVideoFile,
  getRunPaths,
} from './capture.js';

export interface RunnerInput {
  runId: string;
  testCaseId: string;
  steps: RecordedStep[];
  settings: PlatformSettings;
  environmentVariables?: Record<string, string>;
  environmentBaseUrl?: string | null;
  /** Called after each step completes (for real-time progress updates) */
  onStepComplete?: (stepNumber: number, result: StepExecutionResult) => void;
  /** Called for each log entry as it is emitted — enables real-time DB writes */
  onLog?: OnLogCallback;
}

/**
 * Main replay entry point.
 */
export async function replayTestCase(input: RunnerInput): Promise<RunResult> {
  const { runId, steps, settings, environmentVariables, environmentBaseUrl, onStepComplete, onLog } = input;
  const logger = new RunLogger(runId, onLog);
  const startedAt = new Date();

  logger.info(`Starting replay run: ${runId}`);
  logger.info(`Total steps: ${steps.length}`);
  logger.info(`Browser: ${settings.browser}, headless: ${settings.headless}`);
  logger.info(`Received environmentBaseUrl: ${environmentBaseUrl}`);

  // Ensure run directories exist
  await ensureRunDirectories(settings.storagePath, runId);

  const { videoDir } = getRunPaths(settings.storagePath, runId);

  let browser: Browser | null = null;
  let context: BrowserContext | null = null;

  const stepResults: StepExecutionResult[] = [];
  let failedAtStep: number | null = null;
  let failureReason: string | null = null;
  let videoPath: string | null = null;
  let tracePath: string | null = null;
  let finalScreenshotPath: string | null = null;

  try {
    // Launch browser
    const browserType =
      settings.browser === 'firefox'
        ? firefox
        : settings.browser === 'webkit'
          ? webkit
          : chromium;

    browser = await browserType.launch({
      headless: settings.headless,
      slowMo: 500, // Slow down execution by 500ms per action for human-readable video
    });

    // Determine the initial URL (resolving environment overrides)
    const firstNavigate = steps.find((s) => s.action === 'navigate');
    if (environmentBaseUrl && firstNavigate) {
      logger.info(`Overriding first navigate URL with environment Base URL: ${environmentBaseUrl}`);
      firstNavigate.url = environmentBaseUrl;
    }
    const initialUrl = firstNavigate?.url ?? steps[0]?.url;

    let landedUrl = initialUrl;
    let initialCookies: any[] = [];
    let twoContextUsed = false;

    /**
     * Detect if a URL belongs to an SSO/identity/login provider.
     * Oracle IDCS, OAM, and similar IdPs redirect to subdomains like:
     *   idcs-*.identity.oraclecloud.com, login.oracle.com, etc.
     */
    function isSsoPage(url: string): boolean {
      try {
        const { hostname, pathname } = new URL(url);
        return (
          hostname.includes('identity.oraclecloud.com') ||
          hostname.includes('oraclecloud.com') && pathname.includes('/ui/v1/') ||
          hostname.includes('login.oracle.com') ||
          hostname.includes('login.microsoftonline.com') ||
          hostname.includes('accounts.google.com') ||
          hostname.includes('okta.com') ||
          pathname.includes('/signin') ||
          pathname.includes('/login') ||
          pathname.includes('/auth')
        );
      } catch {
        return false;
      }
    }

    /**
     * Check if the recording appears to contain login steps
     * (username/password fills early in the sequence — within first 8 steps).
     */
    function recordingHasLoginSteps(): boolean {
      const earlySteps = steps.slice(0, 8);
      return earlySteps.some((s) => {
        if (s.action !== 'fill') return false;
        const loc = s.locator.primary.value.toLowerCase();
        const title = (s.title ?? '').toLowerCase();
        const val = (s.element?.ariaLabel ?? s.element?.label ?? s.element?.placeholder ?? '').toLowerCase();
        return (
          loc.includes('username') || loc.includes('password') ||
          title.includes('username') || title.includes('password') ||
          val.includes('username') || val.includes('password') ||
          (s.element?.isSensitive === true)
        );
      });
    }

    if (initialUrl && steps[0]?.action === 'navigate') {
      logger.info(`Performing initial navigation in temporary context to negotiate session...`);
      twoContextUsed = true;

      // Use a SEPARATE headless browser for SSO negotiation so no second
      // visible window appears when the main run is non-headless.
      const tempBrowser = await browserType.launch({ headless: true });
      const tempContext = await tempBrowser.newContext({
        viewport: { width: settings.viewportWidth, height: settings.viewportHeight },
      });
      const tempPage = await tempContext.newPage();
      try {
        await tempPage.goto(initialUrl, { waitUntil: 'domcontentloaded', timeout: settings.stepTimeoutMs });
        // Wait up to 5 seconds for redirects and network to settle
        await tempPage.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
        landedUrl = tempPage.url();
        initialCookies = await tempContext.cookies();
        logger.info(`Initial navigation complete. Landed URL: ${landedUrl}`);

        // ── Pre-authenticated recording detection ──────────────────────────
        // If the probe landed on an SSO/login page BUT the recording has no
        // login steps, the test was recorded from an already-logged-in session.
        // Redirecting the main context to the SSO page would fail because
        // none of the recorded steps match the login form.
        //
        // In this case: skip the SSO redirect and navigate the main session
        // directly to the first non-navigate step's URL (the authenticated page).
        if (isSsoPage(landedUrl ?? '') && !recordingHasLoginSteps()) {
          logger.info(
            `Probe landed on SSO page but recording has no login steps — ` +
            `treating this as a pre-authenticated recording. ` +
            `Will navigate directly to the first recorded step URL.`,
          );
          // Find the URL of the first real action step (not navigate)
          const firstActionStep = steps.find((s) => s.action !== 'navigate');
          const targetUrl = firstActionStep?.url ?? initialUrl;
          // Override landedUrl so the main context skips the SSO page
          landedUrl = targetUrl ?? landedUrl;
          // Clear SSO cookies — they are useless without completing the SSO flow
          initialCookies = [];
        }
      } catch (err) {
        logger.error(`Initial navigation failed in temporary context: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        await tempPage.close().catch(() => {});
        await tempContext.close().catch(() => {});
        await tempBrowser.close().catch(() => {});
      }
    }

    // Create context with video recording if enabled
    const contextOptions = settings.recordVideo
      ? {
          recordVideo: {
            dir: videoDir,
            size: { width: settings.viewportWidth, height: settings.viewportHeight },
          },
          viewport: { width: settings.viewportWidth, height: settings.viewportHeight },
        }
      : {
          viewport: { width: settings.viewportWidth, height: settings.viewportHeight },
        };

    context = await browser.newContext(contextOptions);
    if (initialCookies.length > 0) {
      await context.addCookies(initialCookies);
    }

    // Inject lightweight virtual mouse cursor for video clarity.
    // KEY: position:fixed + clientX/clientY = cursor stays in viewport even when page scrolls.
    await context.addInitScript(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const win = globalThis as any;

      function injectCursor() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const doc = win.document;
        if (!doc || !doc.body || doc.getElementById('qa-cursor')) return;

        const style = doc.createElement('style');
        style.innerHTML = `
          #qa-cursor {
            pointer-events: none !important;
            position: fixed !important;
            top: 0; left: 0;
            width: 18px; height: 18px;
            background: rgba(239, 68, 68, 0.5);
            border: 2px solid rgba(239, 68, 68, 0.95);
            border-radius: 50%;
            z-index: 2147483647 !important;
            transform: translate(-50%, -50%);
            transition: background 0.15s, transform 0.15s;
            display: none;
          }
          #qa-cursor.click {
            background: rgba(239, 68, 68, 0.95);
            transform: translate(-50%, -50%) scale(0.65);
          }
        `;
        doc.head.appendChild(style);

        const cursor = doc.createElement('div');
        cursor.id = 'qa-cursor';
        doc.body.appendChild(cursor);

        // clientX/clientY are viewport-relative — stay correct regardless of scroll
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        doc.addEventListener('mousemove', (e: any) => {
          cursor.style.display = 'block';
          cursor.style.left = e.clientX + 'px';
          cursor.style.top = e.clientY + 'px';
        }, true);

        doc.addEventListener('mousedown', () => cursor.classList.add('click'), true);
        doc.addEventListener('mouseup', () => cursor.classList.remove('click'), true);
      }

      // Run on initial load
      if (win.document && win.document.readyState !== 'loading') {
        injectCursor();
      } else {
        win.addEventListener('DOMContentLoaded', injectCursor);
      }

      // Re-inject after every client-side navigation (Oracle ADF SPA navigates without reload)
      const origPushState = win.history.pushState.bind(win.history);
      win.history.pushState = (...args: any[]) => {
        origPushState(...args);
        setTimeout(injectCursor, 100);
      };
      win.addEventListener('popstate', () => setTimeout(injectCursor, 100));
    });

    // Start trace recording if enabled
    if (settings.saveTraces) {
      await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
      logger.info('Playwright trace recording started');
    }

    const page = await context.newPage();

    // Set a clean dark background canvas so the user doesn't see a blank white flash
    // while the browser initializes and begins loading the first page.
    await page.setContent(`<html style="background:#0f172a;margin:0;height:100vh"></html>`).catch(() => {});

    let step1ScreenshotPath: string | null = null;
    if (twoContextUsed && landedUrl) {
      logger.info(`Directly navigating recorded session to landed URL: ${landedUrl}`);
      await page.goto(landedUrl, { waitUntil: 'domcontentloaded', timeout: settings.stepTimeoutMs });
      // Wait longer for dynamic sign-in or enterprise app pages to fully render
      // Oracle IDCS login page is slow to inject form fields — allow up to 8s
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
      // Extra buffer for slow Oracle identity pages
      if (isSsoPage(landedUrl)) {
        logger.info(`SSO page detected — waiting extra 2s for login form to render`);
        await new Promise((r) => setTimeout(r, 2000));
      }
      
      // Capture Step 1 screenshot
      const screenshot = await captureStepScreenshot(
        page,
        { runsDir: settings.storagePath, runId, captureScreenshots: settings.captureScreenshots, recordVideo: settings.recordVideo, saveTraces: settings.saveTraces },
        1,
        steps[0]?.title ?? 'Navigate',
        logger,
      );
      step1ScreenshotPath = screenshot?.path ?? null;
    } else if (initialUrl && (!firstNavigate || steps[0]?.action !== 'navigate')) {
      logger.info(`Loading initial URL: ${initialUrl}`);
      await page.goto(initialUrl, { waitUntil: 'domcontentloaded', timeout: settings.stepTimeoutMs });
    }

    // Track last URL reached after navigation to deduplicate screenshots
    // when consecutive navigate steps both redirect to the same page.
    let lastNavigatedUrl: string | null = (twoContextUsed && landedUrl) ? landedUrl : null;

    // Execute each step
    for (const step of steps) {
      const stepStart = Date.now();
      let screenshotPath: string | null = null;
      let stepErrorMessage: string | null = null;
      let stepResult: 'passed' | 'failed' = 'passed';
      let skipScreenshot = false;
      // === SKIP STEP 1: It was already executed in the temporary context ===
      if (twoContextUsed && step.stepNumber === 1 && step.action === 'navigate') {
        logger.info(`Step 1: serving pre-loaded step result`);
        const skippedResult: StepExecutionResult = {
          stepNumber: 1,
          result: 'passed',
          durationMs: Date.now() - stepStart,
          screenshotPath: step1ScreenshotPath,
          errorMessage: null,
        };
        stepResults.push(skippedResult);
        onStepComplete?.(1, skippedResult);
        continue;
      }

      try {
        const stepOptions: any = {
          timeoutMs: settings.stepTimeoutMs,
          retries: 2,
          retryDelayMs: 500,
          onBeforeAction: async () => {
            if (skipScreenshot) return;
            if (step.action === 'click' || step.action === 'hover') {
              const screenshot = await captureStepScreenshot(
                page,
                { runsDir: settings.storagePath, runId, captureScreenshots: settings.captureScreenshots, recordVideo: settings.recordVideo, saveTraces: settings.saveTraces },
                step.stepNumber,
                step.title,
                logger,
              );
              screenshotPath = screenshot?.path ?? null;
            }
          },
          onAfterAction: async () => {
            if (skipScreenshot) return;
            if (step.action !== 'click' && step.action !== 'hover') {
              const screenshot = await captureStepScreenshot(
                page,
                { runsDir: settings.storagePath, runId, captureScreenshots: settings.captureScreenshots, recordVideo: settings.recordVideo, saveTraces: settings.saveTraces },
                step.stepNumber,
                step.title,
                logger,
              );
              screenshotPath = screenshot?.path ?? null;
            }
          }
        };
        if (environmentVariables) {
          stepOptions.environmentVariables = environmentVariables;
        }

        // === FULL STEP SKIP: Redundant navigate ===
        // If this navigate step's URL hostname matches where we ALREADY landed from a
        // previous navigate (i.e., Oracle SSO redirected both URLs to the same login page),
        // skip the ENTIRE navigation — don't call page.goto() at all.
        // This prevents 7+ seconds of redundant page loading from appearing in the video.
        if (step.action === 'navigate' && lastNavigatedUrl) {
          const stepHost = (() => { try { return new URL(step.url).hostname; } catch { return ''; } })();
          const lastHost = (() => { try { return new URL(lastNavigatedUrl).hostname; } catch { return ''; } })();
          const isBothSso = isSsoPage(step.url) && isSsoPage(lastNavigatedUrl);
          if ((stepHost && lastHost && stepHost === lastHost) || isBothSso) {
            logger.info(`Step ${step.stepNumber}: skipping redundant navigate (already on '${lastHost}' from previous navigate)`, step.stepNumber);
            const skippedResult: StepExecutionResult = {
              stepNumber: step.stepNumber,
              result: 'passed',
              durationMs: Date.now() - stepStart,
              screenshotPath: null,
              errorMessage: null,
            };
            stepResults.push(skippedResult);
            onStepComplete?.(step.stepNumber, skippedResult);
            continue;
          }
        }

        // === SCREENSHOT SKIP: Fill that gets overwritten by a later fill on same field ===
        // If a later step fills the exact same locator, skip the screenshot for this step
        // (the final filled value in the later step is more meaningful).
        if (step.action === 'fill') {
          const sameFieldLater = steps
            .filter(s => s.stepNumber > step.stepNumber && s.action === 'fill')
            .some(s =>
              s.locator.primary.strategy === step.locator.primary.strategy &&
              s.locator.primary.value === step.locator.primary.value
            );
          if (sameFieldLater) {
            skipScreenshot = true;
            logger.info(`Step ${step.stepNumber}: skipping screenshot (same field will be filled again in a later step)`);
          }
        }

        // === SCREENSHOT SKIP: Click that focuses a field immediately before filling it ===
        // If a click step is followed immediately by a fill step on the same locator,
        // skip the click's screenshot since the fill screenshot shows the end state.
        if (step.action === 'click') {
          const nextStep = steps.find(s => s.stepNumber === step.stepNumber + 1);
          if (nextStep && nextStep.action === 'fill') {
            const sameLocator = nextStep.locator.primary.strategy === step.locator.primary.strategy &&
                               nextStep.locator.primary.value === step.locator.primary.value;
            if (sameLocator) {
              skipScreenshot = true;
              logger.info(`Step ${step.stepNumber}: skipping screenshot (click focuses same field that will be filled next)`);
            }
          }
        }

        // Wrap onAfterAction for navigate steps to track actual landed URL
        if (step.action === 'navigate') {
          const originalAfterAction = stepOptions.onAfterAction;
          stepOptions.onAfterAction = async () => {
            lastNavigatedUrl = page.url();
            if (originalAfterAction) await originalAfterAction();
          };
        }

        await executeStep(page, step, logger, stepOptions);

        logger.info(`Step ${step.stepNumber} passed (${Date.now() - stepStart}ms)`, step.stepNumber);
      } catch (err) {
        stepResult = 'failed';
        stepErrorMessage = err instanceof Error ? err.message : String(err);
        failedAtStep = step.stepNumber;
        failureReason = stepErrorMessage;

        logger.error(`Step ${step.stepNumber} FAILED: ${stepErrorMessage}`, step.stepNumber);

        // Capture failure screenshot
        const failShot = await captureFailureScreenshot(
          page,
          {
            runsDir: settings.storagePath,
            runId,
            captureScreenshots: true, // Always capture on failure
            recordVideo: settings.recordVideo,
            saveTraces: settings.saveTraces,
          },
          step.stepNumber,
          logger,
        );
        screenshotPath = failShot?.path ?? null;
      }

      const result: StepExecutionResult = {
        stepNumber: step.stepNumber,
        result: stepResult === 'failed' ? 'failed' : 'passed',
        durationMs: Date.now() - stepStart,
        screenshotPath,
        errorMessage: stepErrorMessage,
      };

      stepResults.push(result);
      onStepComplete?.(step.stepNumber, result);

      // Stop on first failure
      if (stepResult === 'failed') {
        logger.info('Stopping replay due to step failure');
        break;
      }
    }

    // Final wait to ensure everything settled
    if (stepResults.every((r) => r.result === 'passed')) {
      try {
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      } catch {
        // ignore
      }
    }

    // Save trace artifacts
    if (settings.saveTraces && context) {
      tracePath = await saveTrace(
        context,
        { runsDir: settings.storagePath, runId, captureScreenshots: settings.captureScreenshots, recordVideo: settings.recordVideo, saveTraces: settings.saveTraces },
        logger,
      );
    }

    // Retrieve video path via the canonical Playwright API BEFORE closing the context.
    // page.video()?.path() is the recommended approach per Playwright docs:
    // https://playwright.dev/docs/videos
    if (settings.recordVideo) {
      try {
        const videoFilePath = await page.video()?.path();
        if (videoFilePath) {
          videoPath = videoFilePath;
          logger.info(`Video file path retrieved: ${videoFilePath}`);
        }
      } catch {
        // Will fall back to directory scan below
      }
    }

    // Stop video recording by closing context — Playwright finalises the video file on context close
    await context.close();
    context = null;

    // If page.video().path() didn't return a path, scan the directory as fallback
    if (!videoPath) {
      videoPath = await findVideoFile(
        { runsDir: settings.storagePath, runId, captureScreenshots: settings.captureScreenshots, recordVideo: settings.recordVideo, saveTraces: settings.saveTraces },
        logger,
      );
    }
  } finally {
    // Always clean up — even if an unexpected error occurs
    try {
      if (context) await context.close();
    } catch {
      /* swallow */
    }
    try {
      if (browser) await browser.close();
    } catch {
      /* swallow */
    }
    logger.info('Browser closed cleanly');
  }

  const completedAt = new Date();
  const passedSteps = stepResults.filter((r) => r.result === 'passed').length;
  const status = failedAtStep !== null ? 'failed' : 'passed';

  logger.info(`Run complete: ${status}. ${passedSteps}/${steps.length} steps passed.`);

  return {
    runId,
    status,
    startedAt,
    completedAt,
    durationMs: completedAt.getTime() - startedAt.getTime(),
    stepResults,
    videoPath,
    tracePath,
    finalScreenshotPath,
    failedAtStep,
    failureReason,
  } as RunResult & { finalScreenshotPath: string | null };
}
