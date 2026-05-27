/**
 * Prisma client singleton.
 *
 * Exports a single shared PrismaClient instance across all server modules.
 * In development, prevents multiple instances during hot reload.
 */

import { PrismaClient } from '@prisma/client';

declare global {
  // Allow re-use of the prisma instance across hot reloads in dev
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  global.__prisma ??
  new PrismaClient({
    log: process.env['NODE_ENV'] === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env['NODE_ENV'] !== 'production') {
  global.__prisma = prisma;
}
