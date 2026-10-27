import { getSetting } from './settings.js';

export interface WorkLogPolicySettings {
  requiresApproval: boolean;
  mismatchHandling: 'block' | 'warn' | 'allow';
  editWindowHours: number;
}

/**
 * Reads the admin-configurable work log policies from SystemSetting.
 * Any missing or invalid values fall back safely to neutral defaults:
 * - worklog.requiresApproval -> false
 * - worklog.mismatchHandling -> 'warn'
 * - worklog.editWindowHours -> 24
 */
export async function getWorkLogPolicies(): Promise<WorkLogPolicySettings> {
  const rawApproval = await getSetting('worklog.requiresApproval', 'false');
  const requiresApproval = rawApproval === 'true';

  const rawMismatch = await getSetting('worklog.mismatchHandling', 'warn');
  let mismatchHandling: 'block' | 'warn' | 'allow' = 'warn';
  if (rawMismatch === 'block' || rawMismatch === 'warn' || rawMismatch === 'allow') {
    mismatchHandling = rawMismatch;
  }

  const rawWindow = await getSetting('worklog.editWindowHours', '24');
  const parsedWindow = parseInt(rawWindow, 10);
  const editWindowHours = !isNaN(parsedWindow) && parsedWindow > 0 ? parsedWindow : 24;

  return {
    requiresApproval,
    mismatchHandling,
    editWindowHours,
  };
}
