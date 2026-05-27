/**
 * Test Run service
 */

import { prisma } from '../lib/prisma.js';
import type { TestRun, ExecutionLog, Screenshot, Video, DashboardStats } from '@qa-platform/shared';

function mapToTestRun(
  run: {
    id: string;
    testCaseId: string;
    status: string;
    startedAt: Date | null;
    completedAt: Date | null;
    durationMs: number | null;
    browser: string;
    totalSteps: number;
    passedSteps: number;
    failedStep: number | null;
    failureReason: string | null;
    videoPath: string | null;
    tracePath: string | null;
    createdAt: Date;
    testCase: { name: string; targetUrl: string };
  },
): TestRun {
  return {
    id: run.id,
    testCaseId: run.testCaseId,
    testCaseName: run.testCase.name,
    status: run.status as TestRun['status'],
    startedAt: run.startedAt?.toISOString() ?? null,
    completedAt: run.completedAt?.toISOString() ?? null,
    durationMs: run.durationMs,
    browser: run.browser,
    targetUrl: run.testCase.targetUrl,
    totalSteps: run.totalSteps,
    passedSteps: run.passedSteps,
    failedStep: run.failedStep,
    failureReason: run.failureReason,
    videoPath: run.videoPath,
    tracePath: run.tracePath,
    createdAt: run.createdAt.toISOString(),
  };
}

export async function createTestRun(data: {
  testCaseId: string;
  totalSteps: number;
  browser: string;
}): Promise<TestRun> {
  const run = await prisma.testRun.create({
    data: {
      testCaseId: data.testCaseId,
      totalSteps: data.totalSteps,
      browser: data.browser,
      status: 'pending',
    },
    include: { testCase: true },
  });
  return mapToTestRun(run);
}

export async function updateTestRun(
  id: string,
  data: Partial<{
    status: string;
    startedAt: Date;
    completedAt: Date;
    durationMs: number;
    passedSteps: number;
    failedStep: number | null;
    failureReason: string | null;
    videoPath: string | null;
    tracePath: string | null;
  }>,
): Promise<TestRun> {
  const run = await prisma.testRun.update({
    where: { id },
    data,
    include: { testCase: true },
  });
  return mapToTestRun(run);
}

export async function getTestRunById(id: string): Promise<TestRun | null> {
  const run = await prisma.testRun.findUnique({
    where: { id },
    include: { testCase: true },
  });
  if (!run) return null;
  return mapToTestRun(run);
}

export async function getRunsByTestCase(testCaseId: string): Promise<TestRun[]> {
  const runs = await prisma.testRun.findMany({
    where: { testCaseId },
    include: { testCase: true },
    orderBy: { createdAt: 'desc' },
  });
  return runs.map(mapToTestRun);
}

export async function getRecentRuns(limit = 10): Promise<TestRun[]> {
  const runs = await prisma.testRun.findMany({
    include: { testCase: true },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return runs.map(mapToTestRun);
}

export async function saveExecutionLogs(
  _runId: string,
  logs: Omit<ExecutionLog, 'id'>[],
): Promise<void> {
  await prisma.executionLog.createMany({
    data: logs.map((l) => ({
      runId: l.runId,
      stepNumber: l.stepNumber,
      level: l.level,
      message: l.message,
      metadata: l.metadata ? JSON.stringify(l.metadata) : null,
      timestamp: l.timestamp ? new Date(l.timestamp) : new Date(),
    })),
  });
}

export async function getExecutionLogs(runId: string): Promise<ExecutionLog[]> {
  const logs = await prisma.executionLog.findMany({
    where: { runId },
    orderBy: { timestamp: 'asc' },
  });
  return logs.map((l) => ({
    id: l.id,
    runId: l.runId,
    stepNumber: l.stepNumber,
    level: l.level as ExecutionLog['level'],
    message: l.message,
    timestamp: l.timestamp.toISOString(),
    ...(l.metadata ? { metadata: JSON.parse(l.metadata) as Record<string, unknown> } : {}),
  }));
}

export async function saveScreenshot(data: {
  runId: string;
  stepNumber: number | null;
  path: string;
  filename: string;
  isFailure: boolean;
}): Promise<Screenshot> {
  const s = await prisma.screenshot.create({ data });
  return {
    id: s.id,
    runId: s.runId,
    stepNumber: s.stepNumber,
    path: s.path,
    filename: s.filename,
    isFailure: s.isFailure,
    capturedAt: s.capturedAt.toISOString(),
  };
}

export async function getRunScreenshots(runId: string): Promise<Screenshot[]> {
  const screenshots = await prisma.screenshot.findMany({
    where: { runId },
    orderBy: [{ isFailure: 'asc' }, { stepNumber: 'asc' }],
  });
  return screenshots.map((s) => ({
    id: s.id,
    runId: s.runId,
    stepNumber: s.stepNumber,
    path: s.path,
    filename: s.filename,
    isFailure: s.isFailure,
    capturedAt: s.capturedAt.toISOString(),
  }));
}

export async function saveVideo(data: {
  runId: string;
  path: string;
  filename: string;
  durationMs?: number;
}): Promise<Video> {
  const v = await prisma.video.create({ data });
  return {
    id: v.id,
    runId: v.runId,
    path: v.path,
    filename: v.filename,
    durationMs: v.durationMs,
    createdAt: v.createdAt.toISOString(),
  };
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const [totalTestCases, totalRuns, failedRuns, passedRuns, durationAgg, recentRuns] =
    await Promise.all([
      prisma.testCase.count(),
      prisma.testRun.count(),
      prisma.testRun.count({ where: { status: 'failed' } }),
      prisma.testRun.count({ where: { status: 'passed' } }),
      prisma.testRun.aggregate({
        _avg: { durationMs: true },
        where: { status: { in: ['passed', 'failed'] } },
      }),
      prisma.testRun.findMany({
        include: { testCase: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

  return {
    totalTestCases,
    totalRuns,
    failedRuns,
    passedRuns,
    avgDurationMs: durationAgg._avg.durationMs,
    recentRuns: recentRuns.map(mapToTestRun),
  };
}
