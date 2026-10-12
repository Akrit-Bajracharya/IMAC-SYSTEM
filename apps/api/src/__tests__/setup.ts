import { vi } from 'vitest';

// Set test environment
process.env['NODE_ENV'] = 'test';
process.env['DATABASE_URL'] = 'postgresql://test:test@localhost:5432/test_db';
process.env['SESSION_SECRET'] = 'test_session_secret_for_vitest_runs_0123456789abcdef0123456789abcdef';
process.env['SESSION_COOKIE_NAME'] = 'IMAC_SESSION';

// Mock the db module
vi.mock('../db.js', () => ({
  db: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
    session: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    systemSetting: {
      findUnique: vi.fn().mockResolvedValue(null), // return null → use defaults
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn(),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({}),
    },
  },
}));
