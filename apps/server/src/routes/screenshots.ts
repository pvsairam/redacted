import { Router } from 'express';
import type { Request, Response } from 'express';
import * as fs from 'node:fs';
import type { ApiResponse, ApiError } from '@qa-platform/shared';
import { asyncHandler } from '../middleware/errorHandler.js';
import { getRunScreenshots } from '../services/testRunService.js';
import { prisma } from '../lib/prisma.js';

const router = Router();

// GET /api/screenshots/run/:runId
router.get(
  '/run/:runId',
  asyncHandler(async (req: Request, res: Response) => {
    const screenshots = await getRunScreenshots(req.params['runId']!);
    const response: ApiResponse<typeof screenshots> = { success: true, data: screenshots };
    res.json(response);
  }),
);

// GET /api/screenshots/:id/file — serve image file
router.get(
  '/:id/file',
  asyncHandler(async (req: Request, res: Response) => {
    const screenshot = await prisma.screenshot.findUnique({ where: { id: req.params['id']! } });
    if (!screenshot) {
      const err: ApiError = { success: false, error: 'Screenshot not found', code: 'NOT_FOUND' };
      res.status(404).json(err);
      return;
    }

    if (!fs.existsSync(screenshot.path)) {
      const err: ApiError = {
        success: false,
        error: 'Screenshot file not found on disk',
        code: 'FILE_NOT_FOUND',
      };
      res.status(404).json(err);
      return;
    }

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    fs.createReadStream(screenshot.path).pipe(res);
  }),
);

export default router;
