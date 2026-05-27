/**
 * Replay service
 *
 * Orchestrates the full replay lifecycle:
 * 1. Create TestRun record
 * 2. Invoke playwright-engine runner
 * 3. Persist step results, screenshots, video, logs
 * 4. Update TestCase with last run status
 */

import * as path from 'node:path';
import { replayTestCase } from '@qa-platform/playwright-engine';
import type { TestCase } from '@qa-platform/shared';
import { getSettings } from './settingsService.js';
import {
  createTestRun,
  updateTestRun,
  saveExecutionLogs,
  saveScreenshot,
  saveVideo,
} from './testRunService.js';
import { updateTestCaseRunStatus } from './testCaseService.js';
import { getDecryptedEnvironmentVariables } from '../routes/environments.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function startReplay(testCase: TestCase, environmentId?: string): Promise<string> {
  const settings = await getSettings();

  let environmentVariables: Record<string, string> | undefined;
  let environmentBaseUrl: string | undefined;
  if (environmentId) {
    const env = await prisma.environment.findUnique({ where: { id: environmentId } });
    if (env?.baseUrl) {
      environmentBaseUrl = env.baseUrl;
    }
    environmentVariables = await getDecryptedEnvironmentVariables(environmentId);
  }

  // Create the initial run record
  const run = await createTestRun({
    testCaseId: testCase.id,
    totalSteps: testCase.steps.length,
    browser: settings.browser,
  });

  // Run asynchronously — caller gets the runId immediately
  // We intentionally do NOT await this so the HTTP response returns fast
  void executeReplay(run.id, testCase, settings, environmentVariables, environmentBaseUrl);

  return run.id;
}

async function executeReplay(
  runId: string,
  testCase: TestCase,
  settings: Awaited<ReturnType<typeof getSettings>>,
  environmentVariables?: Record<string, string>,
  environmentBaseUrl?: string,
): Promise<void> {
  const startedAt = new Date();

  await updateTestRun(runId, { status: 'running', startedAt });

  try {
    const runSettings = {
      ...settings,
      recordVideo: (testCase as any).recordVideo ?? settings.recordVideo,
      captureScreenshots: (testCase as any).takeScreenshots ?? settings.captureScreenshots,
      headless: (testCase as any).headless ?? settings.headless,
      // Honour the per-test-case saveTraces toggle set in the extension popup.
      // Falls back to the global platform setting if not set.
      saveTraces: (testCase as any).saveTraces ?? settings.saveTraces,
    };

    const runnerInput: any = {
      runId,
      testCaseId: testCase.id,
      steps: testCase.steps,
      settings: runSettings,
      environmentBaseUrl,
      // Real-time log streaming: write each log entry to the DB immediately
      // as it is emitted by the runner. This fixes the "freeze" where the UI
      // showed no logs until the entire run finished.
      onLog: (entry: Omit<import('@qa-platform/shared').ExecutionLog, 'id'>) => {
        void saveExecutionLogs(runId, [entry]);
      },
    };
    if (environmentVariables) {
      runnerInput.environmentVariables = environmentVariables;
    }

    const result = await replayTestCase(runnerInput);
    // Note: execution logs are already persisted per-entry via the onLog callback above.
    // No bulk saveExecutionLogs call needed here.

    // Persist screenshots from step results
    for (const stepResult of result.stepResults) {
      if (stepResult.screenshotPath) {
        const filename = path.basename(stepResult.screenshotPath);
        await saveScreenshot({
          runId,
          stepNumber: stepResult.stepNumber,
          path: stepResult.screenshotPath,
          filename,
          isFailure: stepResult.result === 'failed',
        });
      }
    }

    // Persist final screenshot if available
    const runResult = result as any;
    if (runResult.finalScreenshotPath) {
      const filename = path.basename(runResult.finalScreenshotPath);
      await saveScreenshot({
        runId,
        stepNumber: testCase.steps.length + 1, // Represents the final state validation step
        path: runResult.finalScreenshotPath,
        filename,
        isFailure: false,
      });
    }

    // Persist video if recorded
    if (result.videoPath) {
      const filename = path.basename(result.videoPath);
      await saveVideo({ runId, path: result.videoPath, filename });
    }

    const passedSteps = result.stepResults.filter((r) => r.result === 'passed').length;

    // Update run with final status
    await updateTestRun(runId, {
      status: result.status,
      completedAt: result.completedAt,
      durationMs: result.durationMs,
      passedSteps,
      failedStep: result.failedAtStep,
      failureReason: result.failureReason,
      videoPath: result.videoPath,
      tracePath: result.tracePath,
    });

    // Update test case with last run status
    await updateTestCaseRunStatus(testCase.id, result.status, result.completedAt);

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    await updateTestRun(runId, {
      status: 'failed',
      completedAt: new Date(),
      durationMs: Date.now() - startedAt.getTime(),
      failureReason: `Replay engine error: ${errorMsg}`,
    });
    await updateTestCaseRunStatus(testCase.id, 'failed', new Date());
    console.error(`[Replay] Run ${runId} failed with engine error:`, errorMsg);
  }
}
