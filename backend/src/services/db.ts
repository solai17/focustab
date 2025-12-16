// Database adapter - uses Prisma when available, falls back to mock for testing
import { mockDb } from './mockDb';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let prismaClient: any = null;
export let isMockDb = true;

// Try to load Prisma, fall back to mock if unavailable
try {
  // Dynamic import to avoid crashes when Prisma isn't properly generated
  const { PrismaClient } = require('@prisma/client');
  prismaClient = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
  isMockDb = false;
  console.log('✅ Using Prisma database');
} catch (error) {
  console.log('⚠️  Prisma unavailable, using mock database for testing');
  prismaClient = null;
  isMockDb = true;
}

// Export the database client (Prisma or mock)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const prisma: any = prismaClient || mockDb;

export default prisma;
