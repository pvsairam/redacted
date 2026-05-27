/**
 * Error handling middleware
 */

import type { Request, Response, NextFunction } from 'express';
import type { ApiError } from '@qa-platform/shared';
import { ZodError } from 'zod';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  console.error('[Server Error]', err);

  if (err instanceof ZodError) {
    const response: ApiError = {
      success: false,
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: err.flatten(),
    };
    res.status(400).json(response);
    return;
  }

  if (err instanceof Error) {
    const response: ApiError = {
      success: false,
      error: err.message,
      code: 'INTERNAL_ERROR',
    };
    res.status(500).json(response);
    return;
  }

  const response: ApiError = {
    success: false,
    error: 'An unexpected error occurred',
    code: 'UNKNOWN_ERROR',
  };
  res.status(500).json(response);
}

/**
 * Wraps async route handlers to catch errors and pass them to errorHandler.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}
