import { Router } from 'express';
import type { Request, Response } from 'express';
import type { ApiResponse, ApiError, TestCase } from '@qa-platform/shared';
import { SaveRecordingRequestSchema } from '@qa-platform/shared';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  getAllTestCases,
  getTestCaseById,
  createTestCase,
  updateTestCaseName,
  deleteTestCase,
  updateTestCaseStep,
  deleteTestCaseStep,
  insertTestCaseStep,
} from '../services/testCaseService.js';

const router = Router();

// GET /api/test-cases
router.get(
  '/',
  asyncHandler(async (_req: Request, res: Response) => {
    const cases = await getAllTestCases();
    const response: ApiResponse<TestCase[]> = { success: true, data: cases };
    res.json(response);
  }),
);

// GET /api/test-cases/:id
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const tc = await getTestCaseById(req.params['id']!);
    if (!tc) {
      const err: ApiError = { success: false, error: 'Test case not found', code: 'NOT_FOUND' };
      res.status(404).json(err);
      return;
    }
    const response: ApiResponse<TestCase> = { success: true, data: tc };
    res.json(response);
  }),
);

// POST /api/test-cases  (save recording from extension)
router.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const body = SaveRecordingRequestSchema.parse(req.body);
    const tc = await createTestCase(body);
    const response: ApiResponse<TestCase> = { success: true, data: tc };
    res.status(201).json(response);
  }),
);

// PUT /api/test-cases/:id
router.put(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { name, description } = req.body as { name?: string; description?: string };
    if (!name) {
      const err: ApiError = { success: false, error: 'name is required', code: 'VALIDATION_ERROR' };
      res.status(400).json(err);
      return;
    }
    const tc = await updateTestCaseName(req.params['id']!, name, description);
    if (!tc) {
      const err: ApiError = { success: false, error: 'Test case not found', code: 'NOT_FOUND' };
      res.status(404).json(err);
      return;
    }
    const response: ApiResponse<TestCase> = { success: true, data: tc };
    res.json(response);
  }),
);

// DELETE /api/test-cases/:id
router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    await deleteTestCase(req.params['id']!);
    res.status(204).send();
  }),
);

// PUT /api/test-cases/:id/steps/:stepId
router.put(
  '/:id/steps/:stepId',
  asyncHandler(async (req: Request, res: Response) => {
    const { value, locator } = req.body as { value?: string | null; locator?: any };
    await updateTestCaseStep(req.params['id']!, req.params['stepId']!, { value, locator });
    res.status(204).send();
  }),
);

// DELETE /api/test-cases/:id/steps/:stepId
router.delete(
  '/:id/steps/:stepId',
  asyncHandler(async (req: Request, res: Response) => {
    await deleteTestCaseStep(req.params['id']!, req.params['stepId']!);
    res.status(204).send();
  }),
);

// POST /api/test-cases/:id/steps
router.post(
  '/:id/steps',
  asyncHandler(async (req: Request, res: Response) => {
    const { stepNumber, stepData } = req.body as {
      stepNumber: number;
      stepData: {
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
      };
    };

    if (typeof stepNumber !== 'number') {
      const err: ApiError = { success: false, error: 'stepNumber must be a number', code: 'VALIDATION_ERROR' };
      res.status(400).json(err);
      return;
    }
    if (!stepData || !stepData.action || !stepData.title) {
      const err: ApiError = { success: false, error: 'stepData with action and title is required', code: 'VALIDATION_ERROR' };
      res.status(400).json(err);
      return;
    }

    await insertTestCaseStep(req.params['id']!, stepNumber, stepData);
    res.status(201).json({ success: true });
  }),
);

export default router;
