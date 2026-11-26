import { Prisma, type PrismaClient } from '@prisma/client';

/**
 * Strict allow-list for notification payloads (Amendment A & B).
 * Contains only IDs and short titles.
 * Actor identifiers use actorUserId only (actorDisplayName/actorUsername omitted to prevent stale names).
 * Body, descriptions, comments, messages, notes, passwords, and reasons are strictly prohibited.
 */
export const NOTIFICATION_PAYLOAD_ALLOW_LIST = new Set<string>([
  'taskId',
  'taskTitle',
  'projectId',
  'projectName',
  'milestoneId',
  'milestoneTitle',
  'commentId',
  'timeLogId',
  'actorUserId',
  'status',
  'fromStatus',
  'toStatus',
  'priority',
  'roleName',
  'date',
]);

/**
 * Sanitizes notification payload against the strict allow-list.
 * - Drops any key not in NOTIFICATION_PAYLOAD_ALLOW_LIST (no block-list).
 * - Allows only primitive values: string, number, boolean, null.
 * - Recursively or directly drops nested objects and arrays.
 * - Caps any string value at 200 characters.
 */
export function sanitizeNotificationPayload(
  payload: Record<string, unknown> | null | undefined
): Record<string, string | number | boolean | null> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {};
  }

  const result: Record<string, string | number | boolean | null> = {};

  for (const [key, val] of Object.entries(payload)) {
    // Strict allow-list only: drop any key not on the allow-list
    if (!NOTIFICATION_PAYLOAD_ALLOW_LIST.has(key)) {
      continue;
    }

    // Allowed value types: string, number, boolean, null
    if (typeof val === 'string') {
      result[key] = val.length > 200 ? val.slice(0, 200) : val;
    } else if (typeof val === 'number') {
      if (Number.isFinite(val)) {
        result[key] = val;
      }
    } else if (typeof val === 'boolean') {
      result[key] = val;
    } else if (val === null) {
      result[key] = null;
    }
    // Nested objects, arrays, undefined, functions, and symbols are intentionally dropped
  }

  return result;
}

export interface CreateNotificationInput {
  userId: string;
  type: string;
  actorUserId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  projectId?: string | null;
  payload?: Record<string, unknown> | null;
}

/**
 * Prisma transactional client type (Amendment G).
 * Strongly typed to accept PrismaClient, Prisma.TransactionClient, or any compliant mock/tx client.
 */
export type NotificationPrismaClient =
  | Prisma.TransactionClient
  | PrismaClient
  | {
      notification: {
        create: (args: Prisma.NotificationCreateArgs) => Promise<any>;
        createMany?: (args: Prisma.NotificationCreateManyArgs) => Promise<any>;
      };
      projectMember?: {
        findMany: (args: Prisma.ProjectMemberFindManyArgs) => Promise<Array<{ userId: string }>>;
      };
    };

/**
 * Filters candidate user IDs down to users who are both:
 * 1) active members of the specified project, and
 * 2) active users (user.isActive === true).
 * Does NOT swallow errors or undefined/malformed results; if findMany fails, the transaction rolls back.
 */
export async function filterActiveProjectRecipients(
  tx: Prisma.TransactionClient | PrismaClient,
  projectId: string,
  candidateUserIds: Array<string | null | undefined>
): Promise<string[]> {
  const uniqueIds = Array.from(
    new Set(
      candidateUserIds.filter(
        (id): id is string => typeof id === 'string' && id.trim().length > 0
      )
    )
  );

  if (uniqueIds.length === 0) {
    return [];
  }

  const members = await tx.projectMember.findMany({
    where: {
      projectId,
      userId: { in: uniqueIds },
      user: { isActive: true },
    },
    select: {
      userId: true,
    },
  });

  return members.map((m) => m.userId);
}

/**
 * Creates a single notification inside an existing transaction or db context.
 * - Skips notification if recipient is the actor (actorUserId === userId).
 * - Sanitizes payload using strict allow-list before writing.
 */
export async function createNotification(
  tx: NotificationPrismaClient,
  input: CreateNotificationInput
) {
  // Never notify the actor about their own action
  if (input.actorUserId && input.userId === input.actorUserId) {
    return null;
  }

  const sanitizedPayload = sanitizeNotificationPayload(input.payload);

  return tx.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      projectId: input.projectId ?? null,
      payload: sanitizedPayload as Prisma.InputJsonValue,
    },
  });
}

/**
 * Creates multiple notifications inside an existing transaction or db context.
 * - Skips any notification where recipient is the actor (actorUserId === userId).
 * - Deduplicates recipients so each user receives at most one notification per batch.
 * - Sanitizes all payloads.
 */
export async function createNotifications(
  tx: NotificationPrismaClient,
  inputs: CreateNotificationInput[]
) {
  if (!inputs || inputs.length === 0) {
    return [];
  }

  // Deduplicate recipients and filter out self-notifications
  const seenUserIds = new Set<string>();
  const dedupedInputs: CreateNotificationInput[] = [];

  for (const item of inputs) {
    if (item.actorUserId && item.userId === item.actorUserId) {
      continue;
    }

    if (!seenUserIds.has(item.userId)) {
      seenUserIds.add(item.userId);
      dedupedInputs.push(item);
    }
  }

  if (dedupedInputs.length === 0) {
    return [];
  }

  const createdResults: any[] = [];
  for (const item of dedupedInputs) {
    const res = await createNotification(tx, item);
    if (res) {
      createdResults.push(res);
    }
  }

  return createdResults;
}
