/**
 * Execution Logger
 *
 * Structured, step-level logging for replay runs.
 * Logs are accumulated during a run and returned as part of RunResult
 * for persistence in the database.
 *
 * When an `onLog` callback is provided, each entry is also streamed live
 * so it can be persisted to the DB immediately (real-time log display in UI).
 */

import type { ExecutionLog, LogLevel } from '@qa-platform/shared';

export interface LogEntry {
  stepNumber: number | null;
  level: LogLevel;
  message: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export type OnLogCallback = (entry: Omit<ExecutionLog, 'id'>) => void;

export class RunLogger {
  private readonly runId: string;
  private readonly entries: LogEntry[] = [];
  private readonly onLog: OnLogCallback | undefined;

  constructor(runId: string, onLog?: OnLogCallback) {
    this.runId = runId;
    this.onLog = onLog !== undefined ? onLog : undefined;
  }

  info(message: string, stepNumber?: number, metadata?: Record<string, unknown>): void {
    this.log('info', message, stepNumber ?? null, metadata);
  }

  warn(message: string, stepNumber?: number, metadata?: Record<string, unknown>): void {
    this.log('warn', message, stepNumber ?? null, metadata);
  }

  error(message: string, stepNumber?: number, metadata?: Record<string, unknown>): void {
    this.log('error', message, stepNumber ?? null, metadata);
  }

  debug(message: string, stepNumber?: number, metadata?: Record<string, unknown>): void {
    this.log('debug', message, stepNumber ?? null, metadata);
  }

  private log(
    level: LogLevel,
    message: string,
    stepNumber: number | null,
    metadata?: Record<string, unknown>,
  ): void {
    const entry: LogEntry = {
      stepNumber,
      level,
      message,
      timestamp: new Date(),
      ...(metadata !== undefined ? { metadata } : {}),
    };
    this.entries.push(entry);

    // Also emit to process console for server-side visibility
    const prefix = stepNumber !== null ? `[Step ${stepNumber}]` : '[Run]';
    const formatted = `${prefix} ${message}`;
    if (level === 'error') {
      console.error(formatted);
    } else if (level === 'warn') {
      console.warn(formatted);
    } else {
      console.info(formatted);
    }

    // Stream this log entry live to the DB if a callback is registered
    if (this.onLog) {
      const logRecord: Omit<ExecutionLog, 'id'> = {
        runId: this.runId,
        stepNumber: entry.stepNumber,
        level: entry.level,
        message: entry.message,
        timestamp: entry.timestamp.toISOString(),
        ...(entry.metadata !== undefined ? { metadata: entry.metadata } : {}),
      };
      // Fire-and-forget — don't block logger on DB write latency
      try {
        this.onLog(logRecord);
      } catch {
        // Ignore errors from the streaming callback
      }
    }
  }

  /** Returns all log entries as ExecutionLog records (without DB IDs). */
  toExecutionLogs(): Omit<ExecutionLog, 'id'>[] {
    return this.entries.map((e) => ({
      runId: this.runId,
      stepNumber: e.stepNumber,
      level: e.level,
      message: e.message,
      timestamp: e.timestamp.toISOString(),
      ...(e.metadata !== undefined ? { metadata: e.metadata } : {}),
    }));
  }

  getAllEntries(): LogEntry[] {
    return [...this.entries];
  }
}
