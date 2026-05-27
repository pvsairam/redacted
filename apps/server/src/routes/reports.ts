import { Router } from 'express';
import type { Request, Response } from 'express';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ApiResponse, ApiError, Report } from '@qa-platform/shared';
import { asyncHandler } from '../middleware/errorHandler.js';
import { getTestRunById, getRunScreenshots } from '../services/testRunService.js';
import { getTestCaseById } from '../services/testCaseService.js';
import { getSettings } from '../services/settingsService.js';
import { generateReport } from '@qa-platform/report-generator';
import { prisma } from '../lib/prisma.js';

const router = Router();

// GET /api/reports — list all reports
router.get(
  '/',
  asyncHandler(async (_req: Request, res: Response) => {
    const reports = await prisma.report.findMany({
      include: { run: { include: { testCase: true } } },
      orderBy: { generatedAt: 'desc' },
    });
    const mapped: (Report & { testCaseName: string })[] = reports.map((r) => ({
      id: r.id,
      runId: r.runId,
      testCaseName: r.run.testCase.name,
      path: r.path,
      filename: r.filename,
      generatedAt: r.generatedAt.toISOString(),
    }));
    const response: ApiResponse<typeof mapped> = { success: true, data: mapped };
    res.json(response);
  }),
);

// POST /api/reports/generate/:runId — generate DOCX
router.post(
  '/generate/:runId',
  asyncHandler(async (req: Request, res: Response) => {
    const runId = req.params['runId']!;
    const run = await getTestRunById(runId);
    if (!run) {
      const err: ApiError = { success: false, error: 'Run not found', code: 'NOT_FOUND' };
      res.status(404).json(err);
      return;
    }

    const testCase = await getTestCaseById(run.testCaseId);
    if (!testCase) {
      const err: ApiError = {
        success: false,
        error: 'Test case not found',
        code: 'NOT_FOUND',
      };
      res.status(404).json(err);
      return;
    }

    const screenshots = await getRunScreenshots(runId);
    const settings = await getSettings();

    // We need StepExecutionResult — reconstruct from screenshots/run data
    const stepResults = testCase.steps.map((s) => {
      const isFailed = run.failedStep === s.stepNumber;
      const isPast = run.failedStep === null || s.stepNumber < run.failedStep;
      const shot = screenshots.find((sc) => sc.stepNumber === s.stepNumber && !sc.isFailure);
      return {
        stepNumber: s.stepNumber,
        result: (isFailed ? 'failed' : isPast ? 'passed' : 'skipped') as
          | 'passed'
          | 'failed'
          | 'skipped',
        durationMs: 0,
        screenshotPath: shot?.path ?? null,
        errorMessage: isFailed ? run.failureReason : null,
      };
    });

    const { buffer, filename } = await generateReport({
      run,
      steps: testCase.steps,
      stepResults,
      screenshots: screenshots.map((s) => ({
        stepNumber: s.stepNumber,
        path: s.path,
        isFailure: s.isFailure,
      })),
      author: settings.reportAuthor,
      company: settings.reportCompany,
    });

    // Save report file
    const reportsDir = path.join(settings.storagePath, runId, 'reports');
    await fs.promises.mkdir(reportsDir, { recursive: true });
    const reportPath = path.join(reportsDir, filename);
    await fs.promises.writeFile(reportPath, buffer);

    // Save to DB
    const report = await prisma.report.create({
      data: { runId, path: reportPath, filename },
    });

    const response: ApiResponse<{ reportId: string; filename: string }> = {
      success: true,
      data: { reportId: report.id, filename },
    };
    res.status(201).json(response);
  }),
);

// GET /api/reports/:id/download — download DOCX
router.get(
  '/:id/download',
  asyncHandler(async (req: Request, res: Response) => {
    const report = await prisma.report.findUnique({ where: { id: req.params['id']! } });
    if (!report) {
      const err: ApiError = { success: false, error: 'Report not found', code: 'NOT_FOUND' };
      res.status(404).json(err);
      return;
    }

    if (!fs.existsSync(report.path)) {
      const err: ApiError = {
        success: false,
        error: 'Report file not found on disk',
        code: 'FILE_NOT_FOUND',
      };
      res.status(404).json(err);
      return;
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${report.filename}"`);
    fs.createReadStream(report.path).pipe(res);
  }),
);

export default router;
