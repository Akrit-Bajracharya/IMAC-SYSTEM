import 'dotenv/config';
import { PrismaClient, SystemRole } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });
}

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable for seed: ${key}`);
  }
  return value.trim();
}

const DEFAULT_SETTINGS = [
  {
    key: 'auth.lockoutThreshold',
    value: '5',
    description: 'Number of failed login attempts before temporary account lockout',
  },
  {
    key: 'auth.lockoutDurationMinutes',
    value: '15',
    description: 'Duration in minutes an account remains locked after reaching threshold',
  },
  {
    key: 'auth.maxLoginAttemptsPerWindow',
    value: '20',
    description: 'Maximum login attempts permitted per rate limit window (15 minutes)',
  },
  {
    key: 'auth.minPasswordLength',
    value: '10',
    description: 'Minimum characters required for new user passwords',
  },
  {
    key: 'session.inactivityTimeoutMinutes',
    value: '30',
    description: 'Session inactivity timeout in minutes before requiring re-authentication',
  },
  {
    key: 'worklog.requiresApproval',
    value: 'false',
    description: 'Whether submitted employee work logs require manager approval',
  },
  {
    key: 'worklog.mismatchHandling',
    value: 'warn',
    description: 'Handling mode for work log mismatch warnings (warn or block)',
  },
  {
    key: 'worklog.editWindowHours',
    value: '24',
    description: 'Time window in hours within which an employee may edit work logs',
  },
  {
    key: 'employee.defaultShiftHours',
    value: '8',
    description: 'Default shift duration in hours for employee profiles',
  },
  {
    key: 'employee.defaultWorkingDays',
    value: '5',
    description: 'Default working days per week for employee profiles',
  },
  {
    key: 'overtime.requiresApproval',
    value: 'true',
    description: 'Whether overtime hours logged require manager approval',
  },
  {
    key: 'leave.autoSetAvailability',
    value: 'true',
    description: 'Whether approved leave automatically updates employee availability',
  },
];

async function main() {
  console.log('--- Starting database seed ---');

  // 1. Validate required environment variables
  const admin1Username = requireEnv('ADMIN1_USERNAME');
  const admin1Password = requireEnv('ADMIN1_PASSWORD');
  const admin1DisplayName = requireEnv('ADMIN1_DISPLAY_NAME');

  const admin2Username = requireEnv('ADMIN2_USERNAME');
  const admin2Password = requireEnv('ADMIN2_PASSWORD');
  const admin2DisplayName = requireEnv('ADMIN2_DISPLAY_NAME');

  const requirePasswordChange = process.env['ADMIN_REQUIRE_PASSWORD_CHANGE'] === 'true';

  // 2. Upsert System Settings
  console.log('Seeding system settings...');
  for (const setting of DEFAULT_SETTINGS) {
    const existing = await prisma.systemSetting.findUnique({
      where: { key: setting.key },
    });

    if (existing) {
      console.log(`Setting [${setting.key}] already exists (value: "${existing.value}"). Preserved.`);
    } else {
      await prisma.systemSetting.create({
        data: {
          key: setting.key,
          value: setting.value,
          description: setting.description,
          updatedBy: 'system_seed',
        },
      });
      console.log(`Setting [${setting.key}] created with default value "${setting.value}".`);
    }
  }

  // 3. Upsert Admin Users
  const admins = [
    {
      username: admin1Username,
      displayName: admin1DisplayName,
      password: admin1Password,
    },
    {
      username: admin2Username,
      displayName: admin2DisplayName,
      password: admin2Password,
    },
  ];

  for (const admin of admins) {
    const existingUser = await prisma.user.findUnique({
      where: { username: admin.username },
    });

    if (existingUser) {
      console.log(`Admin user [${admin.username}] already exists. Preserved without overwriting password.`);
    } else {
      const passwordHash = await hashPassword(admin.password);
      const created = await prisma.user.create({
        data: {
          username: admin.username,
          displayName: admin.displayName,
          passwordHash,
          systemRole: SystemRole.system_admin,
          isActive: true,
          mustChangePassword: requirePasswordChange,
        },
      });
      console.log(`Admin user [${created.username}] created successfully (ID: ${created.id}).`);
    }
  }

  console.log('--- Database seed completed successfully ---');
}

main()
  .catch((err) => {
    console.error('Database seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
