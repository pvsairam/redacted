import { Router } from 'express';
import type { Request, Response } from 'express';
import type { ApiResponse, PlatformSettings } from '@qa-platform/shared';
import { asyncHandler } from '../middleware/errorHandler.js';
import { getSettings, saveSettings } from '../services/settingsService.js';

const router = Router();

// GET /api/settings
router.get(
  '/',
  asyncHandler(async (_req: Request, res: Response) => {
    const settings = await getSettings();
    const response: ApiResponse<PlatformSettings> = { success: true, data: settings };
    res.json(response);
  }),
);

// PUT /api/settings
router.put(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const updated = await saveSettings(req.body as Partial<PlatformSettings>);
    const response: ApiResponse<PlatformSettings> = { success: true, data: updated };
    res.json(response);
  }),
);

export default router;
