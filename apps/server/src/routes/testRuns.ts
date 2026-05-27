import { Router } from 'express';
import type { Request, Response } from 'express';
import type { ApiResponse, ApiError, TestRun, ExecutionLog } from '@qa-platform/shared';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  getTestRunById,
  getRunsByTestCase,
  getExecutionLogs,
  getRunScreenshots,
  getRecentRuns,
  getDashboardStats,
} from '../services/testRunService.js';

const router = Router();

// GET /api/runs — recent runs
router.get(
  '/',
  asyncHandler(async (_req: Request, res: Response) => {
    const runs = await getRecentRuns(20);
    const response: ApiResponse<TestRun[]> = { success: true, data: runs };
    res.json(response);
  }),
);

// GET /api/runs/stats — dashboard stats
router.get(
  '/stats',
  asyncHandler(async (_req: Request, res: Response) => {
    const stats = await getDashboardStats();
    const response: ApiResponse<typeof stats> = { success: true, data: stats };
    res.json(response);
  }),
);

// GET /api/runs/:id
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const run = await getTestRunById(req.params['id']!);
    if (!run) {
      const err: ApiError = { success: false, error: 'Run not found', code: 'NOT_FOUND' };
      res.status(404).json(err);
      return;
    }
    const response: ApiResponse<TestRun> = { success: true, data: run };
    res.json(response);
  }),
);

// GET /api/runs/:id/logs
router.get(
  '/:id/logs',
  asyncHandler(async (req: Request, res: Response) => {
    const logs = await getExecutionLogs(req.params['id']!);
    const response: ApiResponse<ExecutionLog[]> = { success: true, data: logs };
    res.json(response);
  }),
);

// GET /api/runs/:id/screenshots
router.get(
  '/:id/screenshots',
  asyncHandler(async (req: Request, res: Response) => {
    const screenshots = await getRunScreenshots(req.params['id']!);
    const response: ApiResponse<typeof screenshots> = { success: true, data: screenshots };
    res.json(response);
  }),
);

// GET /api/runs/:id/trace — download the Playwright trace.zip
router.get(
  '/:id/trace',
  asyncHandler(async (req: Request, res: Response) => {
    const run = await getTestRunById(req.params['id']!);
    if (!run) {
      const err: ApiError = { success: false, error: 'Run not found', code: 'NOT_FOUND' };
      res.status(404).json(err);
      return;
    }
    if (!run.tracePath) {
      const err: ApiError = { success: false, error: 'No trace available for this run', code: 'NOT_FOUND' };
      res.status(404).json(err);
      return;
    }

    const { createReadStream } = await import('node:fs');
    const { stat } = await import('node:fs/promises');

    try {
      const stats = await stat(run.tracePath);
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="trace-${run.id}.zip"`);
      res.setHeader('Content-Length', stats.size);
      createReadStream(run.tracePath).pipe(res);
    } catch {
      const err: ApiError = { success: false, error: 'Trace file not found on disk', code: 'NOT_FOUND' };
      res.status(404).json(err);
    }
  }),
);

// GET /api/test-cases/:testCaseId/runs
router.get(
  '/by-test-case/:testCaseId',
  asyncHandler(async (req: Request, res: Response) => {
    const runs = await getRunsByTestCase(req.params['testCaseId']!);
    const response: ApiResponse<TestRun[]> = { success: true, data: runs };
    res.json(response);
  }),
);

export default router;
