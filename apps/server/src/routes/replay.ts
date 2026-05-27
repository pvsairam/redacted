import { Router } from 'express';
import type { Request, Response } from 'express';
import type { ApiResponse, ApiError } from '@qa-platform/shared';
import { asyncHandler } from '../middleware/errorHandler.js';
import { getTestCaseById } from '../services/testCaseService.js';
import { startReplay } from '../services/replayService.js';

const router = Router();

// POST /api/replay/:testCaseId  — trigger replay
router.post(
  '/:testCaseId',
  asyncHandler(async (req: Request, res: Response) => {
    const testCase = await getTestCaseById(req.params['testCaseId']!);
    if (!testCase) {
      const err: ApiError = { success: false, error: 'Test case not found', code: 'NOT_FOUND' };
      res.status(404).json(err);
      return;
    }

    if (testCase.steps.length === 0) {
      const err: ApiError = {
        success: false,
        error: 'Cannot replay a test case with no steps',
        code: 'NO_STEPS',
      };
      res.status(400).json(err);
      return;
    }

    const { environmentId } = req.body;

    // Start replay async — returns run ID immediately
    const runId = await startReplay(testCase, environmentId);

    const response: ApiResponse<{ runId: string; message: string }> = {
      success: true,
      data: {
        runId,
        message: 'Replay started. Poll /api/runs/:runId for status.',
      },
    };
    res.status(202).json(response);
  }),
);

export default router;
