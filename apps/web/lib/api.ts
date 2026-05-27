/**
 * API client
 *
 * All requests go through the Next.js proxy rewrite at /api/backend/*
 * which forwards to http://localhost:3001/api/*
 *
 * This keeps the browser from needing to know about the backend port directly.
 */

import type {
  TestCase,
  TestRun,
  ExecutionLog,
  Screenshot,
  DashboardStats,
  PlatformSettings,
  ApiResponse,
  ApiError,
} from '@qa-platform/shared';

const BASE = '/api/backend';

class ApiClientError extends Error {
  constructor(
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });

  const json = (await res.json()) as ApiResponse<T> | ApiError;

  if (!json.success) {
    const err = json as ApiError;
    throw new ApiClientError(err.error, err.code);
  }

  return (json as ApiResponse<T>).data;
}

// ─── Health ───────────────────────────────────────────────────────────────────

export async function checkHealth(): Promise<boolean> {
  try {
    await request(`${BASE}/health`);
    return true;
  } catch {
    return false;
  }
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export async function getDashboardStats(): Promise<DashboardStats> {
  return request(`${BASE}/runs/stats`);
}

// ─── Test Cases ───────────────────────────────────────────────────────────────

export async function getTestCases(): Promise<TestCase[]> {
  return request(`${BASE}/test-cases`);
}

export async function getTestCase(id: string): Promise<TestCase> {
  return request(`${BASE}/test-cases/${id}`);
}

export async function updateTestCase(
  id: string,
  data: { name: string; description?: string },
): Promise<TestCase> {
  return request(`${BASE}/test-cases/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteTestCase(id: string): Promise<void> {
  await fetch(`${BASE}/test-cases/${id}`, { method: 'DELETE' });
}

export async function updateTestCaseStep(
  testCaseId: string,
  stepId: string,
  data: { value?: string | null; locator?: any }
): Promise<void> {
  await fetch(`${BASE}/test-cases/${testCaseId}/steps/${stepId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

// ─── Test Runs ────────────────────────────────────────────────────────────────

export async function getTestRun(id: string): Promise<TestRun> {
  return request(`${BASE}/runs/${id}`);
}

export async function getTestCaseRuns(testCaseId: string): Promise<TestRun[]> {
  return request(`${BASE}/runs/by-test-case/${testCaseId}`);
}

export async function getRecentRuns(): Promise<TestRun[]> {
  return request(`${BASE}/runs`);
}

export async function getRunLogs(runId: string): Promise<ExecutionLog[]> {
  return request(`${BASE}/runs/${runId}/logs`);
}

export async function getRunScreenshots(runId: string): Promise<Screenshot[]> {
  return request(`${BASE}/runs/${runId}/screenshots`);
}

export function getScreenshotFileUrl(screenshotId: string): string {
  return `${BASE}/screenshots/${screenshotId}/file`;
}

export function getVideoStreamUrl(videoId: string): string {
  return `${BASE}/videos/${videoId}/stream`;
}

export function getTraceDownloadUrl(runId: string): string {
  return `${BASE}/runs/${runId}/trace`;
}

// ─── Replay ───────────────────────────────────────────────────────────────────

export async function triggerReplay(testCaseId: string, environmentId?: string): Promise<{ runId: string }> {
  return request(`${BASE}/replay/${testCaseId}`, { 
    method: 'POST',
    body: environmentId ? JSON.stringify({ environmentId }) : undefined
  });
}

// ─── Reports ─────────────────────────────────────────────────────────────────

export async function listReports(): Promise<Array<{ id: string; runId: string; testCaseName: string; filename: string; generatedAt: string }>> {
  return request(`${BASE}/reports`);
}

export async function generateReport(runId: string): Promise<{ reportId: string; filename: string }> {
  return request(`${BASE}/reports/generate/${runId}`, { method: 'POST' });
}

export function getReportDownloadUrl(reportId: string): string {
  return `${BASE}/reports/${reportId}/download`;
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export async function getSettings(): Promise<PlatformSettings> {
  return request(`${BASE}/settings`);
}

export async function updateSettings(settings: Partial<PlatformSettings>): Promise<PlatformSettings> {
  return request(`${BASE}/settings`, { method: 'PUT', body: JSON.stringify(settings) });
}
