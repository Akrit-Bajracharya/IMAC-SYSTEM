import { vi } from 'vitest';

// Set test environment
process.env['NODE_ENV'] = 'test';
process.env['DATABASE_URL'] = 'postgresql://test:test@localhost:5432/test_db';
process.env['SESSION_SECRET'] = 'test_session_secret_for_vitest_runs_0123456789abcdef0123456789abcdef';
process.env['SESSION_COOKIE_NAME'] = 'IMAC_SESSION';

const mockDb: any = {
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
  employeeProfile: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
  },
  workRole: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  employeeWorkRole: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
  availabilityStatus: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
  },
  workLogDay: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
  workLogEntry: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
};

mockDb.$transaction = vi.fn(async (arg: any) => {
  if (typeof arg === 'function') {
    return arg(mockDb);
  }
  if (Array.isArray(arg)) {
    return Promise.all(arg);
  }
  return arg;
});

// Mock the db module
vi.mock('../db.js', () => ({
  db: mockDb,
}));
