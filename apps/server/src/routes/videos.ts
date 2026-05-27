import { Router } from 'express';
import type { Request, Response } from 'express';
import * as fs from 'node:fs';
import type { ApiResponse, ApiError } from '@qa-platform/shared';
import { asyncHandler } from '../middleware/errorHandler.js';
import { prisma } from '../lib/prisma.js';

const router = Router();

// GET /api/videos/run/:runId
router.get(
  '/run/:runId',
  asyncHandler(async (req: Request, res: Response) => {
    const video = await prisma.video.findFirst({
      where: { runId: req.params['runId']! },
    });
    if (!video) {
      const err: ApiError = { success: false, error: 'No video for this run', code: 'NOT_FOUND' };
      res.status(404).json(err);
      return;
    }
    const response: ApiResponse<typeof video> = { success: true, data: video };
    res.json(response);
  }),
);

// GET /api/videos/run/:runId/stream — stream video file for a run
router.get(
  '/run/:runId/stream',
  asyncHandler(async (req: Request, res: Response) => {
    const video = await prisma.video.findFirst({ where: { runId: req.params['runId']! } });
    if (!video) {
      const err: ApiError = { success: false, error: 'Video not found', code: 'NOT_FOUND' };
      res.status(404).json(err);
      return;
    }

    if (!fs.existsSync(video.path)) {
      const err: ApiError = {
        success: false,
        error: 'Video file not found on disk',
        code: 'FILE_NOT_FOUND',
      };
      res.status(404).json(err);
      return;
    }

    const stat = fs.statSync(video.path);
    const range = req.headers['range'];

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0]!, 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
      const chunkSize = end - start + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': 'video/webm',
      });
      fs.createReadStream(video.path, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': stat.size,
        'Content-Type': 'video/webm',
      });
      fs.createReadStream(video.path).pipe(res);
    }
  }),
);

export default router;
