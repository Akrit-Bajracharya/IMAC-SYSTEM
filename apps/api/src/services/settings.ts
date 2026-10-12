import { db } from '../db.js';

export async function getSetting(key: string, defaultValue: string): Promise<string> {
  const setting = await db.systemSetting.findUnique({ where: { key } });
  return setting?.value ?? defaultValue;
}

export async function getSettingNumber(key: string, defaultValue: number): Promise<number> {
  const val = await getSetting(key, String(defaultValue));
  const num = parseInt(val, 10);
  return isNaN(num) ? defaultValue : num;
}

export async function getSettingBool(key: string, defaultValue: boolean): Promise<boolean> {
  const val = await getSetting(key, defaultValue ? 'true' : 'false');
  return val === 'true';
}

export async function updateSetting(key: string, value: string, updatedBy: string): Promise<void> {
  await db.systemSetting.upsert({
    where: { key },
    update: { value, updatedBy },
    create: { key, value, updatedBy },
  });
}

export async function getAllSettings() {
  return db.systemSetting.findMany({ orderBy: { key: 'asc' } });
}
