/**
 * Automation Platform - Backend Server
 *
 * Express server providing the API for the web dashboard and extension.
 * All routes are prefixed with /api.
 *
 * Endpoints:
 *   GET  /api/health
 *   GET  /api/test-cases
 *   POST /api/test-cases
 *   GET  /api/test-cases/:id
 *   PUT  /api/test-cases/:id
 *   DELETE /api/test-cases/:id
 *   GET  /api/runs
 *   GET  /api/runs/stats
 *   GET  /api/runs/:id
 *   GET  /api/runs/:id/logs
 *   GET  /api/runs/:id/screenshots
 *   GET  /api/runs/by-test-case/:testCaseId
 *   POST /api/replay/:testCaseId
 *   GET  /api/screenshots/run/:runId
 *   GET  /api/screenshots/:id/file
 *   GET  /api/videos/run/:runId
 *   GET  /api/videos/:id/stream
 *   POST /api/reports/generate/:runId
 *   GET  /api/reports
 *   GET  /api/reports/:id/download
 *   GET  /api/settings
 *   PUT  /api/settings
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import healthRouter from './routes/health.js';
import testCasesRouter from './routes/testCases.js';
import testRunsRouter from './routes/testRuns.js';
import replayRouter from './routes/replay.js';
import screenshotsRouter from './routes/screenshots.js';
import videosRouter from './routes/videos.js';
import reportsRouter from './routes/reports.js';
import settingsRouter from './routes/settings.js';
import { environmentsRouter } from './routes/environments.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();
const PORT = parseInt(process.env['PORT'] ?? '3001', 10);
const CORS_ORIGIN = process.env['CORS_ORIGIN'] ?? 'http://localhost:3000';

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(
  cors({
    origin: [CORS_ORIGIN, 'chrome-extension://'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use('/api/health', healthRouter);
app.use('/api/test-cases', testCasesRouter);
app.use('/api/runs', testRunsRouter);
app.use('/api/replay', replayRouter);
app.use('/api/screenshots', screenshotsRouter);
app.use('/api/videos', videosRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/environments', environmentsRouter);

// ─── 404 ─────────────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Route not found', code: 'NOT_FOUND' });
});

// ─── Error handler ────────────────────────────────────────────────────────────

app.use(errorHandler);

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.info(`[Server] Automation Platform API running on http://localhost:${PORT}`);
  console.info(`[Server] CORS origin: ${CORS_ORIGIN}`);
});

export default app;
