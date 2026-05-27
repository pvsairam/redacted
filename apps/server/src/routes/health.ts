import { Router } from 'express';
import type { Request, Response } from 'express';
import type { ApiResponse } from '@qa-platform/shared';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  const response: ApiResponse<{ status: string; version: string; timestamp: string }> = {
    success: true,
    data: {
      status: 'ok',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
    },
  };
  res.json(response);
});

export default router;
