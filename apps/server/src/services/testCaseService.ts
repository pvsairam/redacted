/**
 * Test Case service
 */

import { prisma } from '../lib/prisma.js';
import type { TestCase, RecordedStep } from '@qa-platform/shared';

function mapToTestCase(tc: {
  id: string;
  name: string;
  description: string | null;
  targetUrl: string;
  projectId: string | null;
  lastRunStatus: string | null;
  lastRunAt: Date | null;
  recordVideo: boolean;
  takeScreenshots: boolean;
  headless: boolean;
  saveTraces: boolean;
  createdAt: Date;
  updatedAt: Date;
  steps: Array<{
    id: string;
    stepNumber: number;
    action: string;
    timestamp: Date;
    url: string;
    pageTitle: string;
    title: string;
    description: string;
    element: string;
    locator: string;
    screenshot: string | null;
    key: string | null;
    value: string | null;
    option: string | null;
  }>;
}): TestCase {
  return {
    id: tc.id,
    name: tc.name,
    description: tc.description,
    targetUrl: tc.targetUrl,
    projectId: tc.projectId,
    lastRunStatus: tc.lastRunStatus as TestCase['lastRunStatus'],
    lastRunAt: tc.lastRunAt?.toISOString() ?? null,
    recordVideo: tc.recordVideo,
    takeScreenshots: tc.takeScreenshots,
    headless: tc.headless,
    saveTraces: tc.saveTraces,
    createdAt: tc.createdAt.toISOString(),
    updatedAt: tc.updatedAt.toISOString(),
    stepCount: tc.steps.length,
    steps: tc.steps.map((s) => ({
      id: s.id,
      stepNumber: s.stepNumber,
      action: s.action as RecordedStep['action'],
      timestamp: s.timestamp.toISOString(),
      url: s.url,
      pageTitle: s.pageTitle,
      title: s.title,
      description: s.description,
      element: JSON.parse(s.element) as RecordedStep['element'],
      locator: JSON.parse(s.locator) as RecordedStep['locator'],
      ...(s.screenshot ? { screenshot: JSON.parse(s.screenshot) as NonNullable<RecordedStep['screenshot']> } : {}),
      ...(s.key !== null ? { key: s.key } : {}),
      ...(s.value !== null ? { value: s.value } : {}),
      ...(s.option !== null ? { option: s.option } : {}),
    })),
  };
}

export async function getAllTestCases(): Promise<TestCase[]> {
  const cases = await prisma.testCase.findMany({
    include: { steps: { orderBy: { stepNumber: 'asc' } } },
    orderBy: { updatedAt: 'desc' },
  });
  return cases.map(mapToTestCase);
}

export async function getTestCaseById(id: string): Promise<TestCase | null> {
  const tc = await prisma.testCase.findUnique({
    where: { id },
    include: { steps: { orderBy: { stepNumber: 'asc' } } },
  });
  if (!tc) return null;
  return mapToTestCase(tc);
}

export async function createTestCase(data: {
  name: string;
  description?: string;
  targetUrl: string;
  steps: RecordedStep[];
  projectId?: string;
  recordVideo?: boolean;
  takeScreenshots?: boolean;
  headless?: boolean;
  saveTraces?: boolean;
}): Promise<TestCase> {
  const tc = await prisma.testCase.create({
    data: {
      name: data.name,
      description: data.description,
      targetUrl: data.targetUrl,
      projectId: data.projectId,
      recordVideo: data.recordVideo ?? false,
      takeScreenshots: data.takeScreenshots ?? true,
      headless: data.headless ?? false,
      saveTraces: data.saveTraces ?? true,
      steps: {
        create: data.steps.map((s) => ({
          stepNumber: s.stepNumber,
          action: s.action,
          timestamp: new Date(s.timestamp),
          url: s.url,
          pageTitle: s.pageTitle,
          title: s.title,
          description: s.description,
          element: JSON.stringify(s.element),
          locator: JSON.stringify(s.locator),
          screenshot: s.screenshot ? JSON.stringify(s.screenshot) : null,
          key: s.key ?? null,
          value: s.value ?? null,
          option: s.option ?? null,
        })),
      },
    },
    include: { steps: { orderBy: { stepNumber: 'asc' } } },
  });
  return mapToTestCase(tc);
}

export async function updateTestCaseName(
  id: string,
  name: string,
  description?: string,
): Promise<TestCase | null> {
  const updateData: any = { name };
  if (description !== undefined) {
    updateData.description = description;
  }
  const tc = await prisma.testCase.update({
    where: { id },
    data: updateData,
    include: { steps: { orderBy: { stepNumber: 'asc' } } },
  });
  return mapToTestCase(tc);
}

export async function deleteTestCase(id: string): Promise<void> {
  await prisma.testCase.delete({ where: { id } });
}

export async function updateTestCaseRunStatus(
  id: string,
  status: string,
  lastRunAt: Date,
): Promise<void> {
  await prisma.testCase.update({
    where: { id },
    data: { lastRunStatus: status, lastRunAt },
  });
}

export async function updateTestCaseStep(
  testCaseId: string,
  stepId: string,
  data: { value?: string | null; locator?: any }
): Promise<void> {
  // We only allow updating specific fields for now
  const updateData: any = {};
  if (data.value !== undefined) updateData.value = data.value;
  if (data.locator !== undefined) updateData.locator = JSON.stringify(data.locator);

  if (Object.keys(updateData).length === 0) return;

  await prisma.testStep.update({
    where: { id: stepId, testCaseId },
    data: updateData,
  });
}

export async function deleteTestCaseStep(
  testCaseId: string,
  stepId: string,
): Promise<void> {
  // Delete the step
  await prisma.testStep.delete({
    where: { id: stepId, testCaseId },
  });

  // Re-number remaining steps sequentially so there are no gaps
  const remaining = await prisma.testStep.findMany({
    where: { testCaseId },
    orderBy: { stepNumber: 'asc' },
    select: { id: true },
  });

  await Promise.all(
    remaining.map((s, i) =>
      prisma.testStep.update({
        where: { id: s.id },
        data: { stepNumber: i + 1 },
      }),
    ),
  );

  // Touch the test case updatedAt
  await prisma.testCase.update({
    where: { id: testCaseId },
    data: { updatedAt: new Date() },
  });
}

export async function insertTestCaseStep(
  testCaseId: string,
  stepNumber: number,
  data: {
    action: string;
    url: string;
    pageTitle: string;
    title: string;
    description: string;
    element: any;
    locator: any;
    key?: string | null;
    value?: string | null;
    option?: string | null;
  }
): Promise<void> {
  // Find all steps with stepNumber >= target stepNumber and increment them by 1.
  // Shift in descending order (last first) to prevent unique constraint violations on (testCaseId, stepNumber).
  const subsequentSteps = await prisma.testStep.findMany({
    where: { testCaseId, stepNumber: { gte: stepNumber } },
    orderBy: { stepNumber: 'desc' },
  });

  for (const s of subsequentSteps) {
    await prisma.testStep.update({
      where: { id: s.id },
      data: { stepNumber: s.stepNumber + 1 },
    });
  }

  // Create the new step
  await prisma.testStep.create({
    data: {
      testCaseId,
      stepNumber,
      action: data.action,
      timestamp: new Date(),
      url: data.url,
      pageTitle: data.pageTitle,
      title: data.title,
      description: data.description,
      element: JSON.stringify(data.element),
      locator: JSON.stringify(data.locator),
      key: data.key ?? null,
      value: data.value ?? null,
      option: data.option ?? null,
    },
  });

  // Touch the test case updatedAt
  await prisma.testCase.update({
    where: { id: testCaseId },
    data: { updatedAt: new Date() },
  });
}

