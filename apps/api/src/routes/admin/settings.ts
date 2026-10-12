import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db.js';
import { getAllSettings, updateSetting } from '../../services/settings.js';
import { createAuditEntry } from '../../services/auditLog.js';
import { requireAuth, requirePasswordChanged, requirePermission, type AuthRequest } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';

export const adminSettingsRouter = Router();

adminSettingsRouter.use(requireAuth);
adminSettingsRouter.use(requirePasswordChanged);

const updateSettingSchema = z.object({
  value: z.string(),
});

// GET / - List all settings
adminSettingsRouter.get('/', requirePermission('settings:read'), async (_req: AuthRequest, res) => {
  const settings = await getAllSettings();
  return res.status(200).json(settings);
});

// PATCH /:key - Update setting value
adminSettingsRouter.patch('/:key', requirePermission('settings:update'), validate(updateSettingSchema), async (req: AuthRequest, res) => {
  const { key } = req.params;
  const { value } = req.body;

  const currentSetting = await db.systemSetting.findUnique({
    where: { key },
  });

  const beforeValue = currentSetting?.value ?? null;

  await updateSetting(key, value, req.user?.username ?? 'admin');

  await createAuditEntry({
    actorUserId: req.user?.id,
    action: 'settings.updated',
    entityType: 'SystemSetting',
    entityId: key,
    ipAddress: req.ip,
    beforeSnapshot: { value: beforeValue },
    afterSnapshot: { value },
  });

  return res.status(200).json({ ok: true, key, value });
});
