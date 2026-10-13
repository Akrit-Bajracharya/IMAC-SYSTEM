import argon2 from 'argon2';
import { nanoid } from 'nanoid';

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

export function generateTempPassword(): string {
  return nanoid(20);
}

// SEC-05: Pre-compute a dummy Argon2id hash once at startup.
// Used by the login route to run a constant-time hash comparison even when the
// username is not found, preventing user enumeration via response-time differences.
// The plaintext is irrelevant; verifyPassword against this hash always returns false.
const _dummyHashPromise = hashPassword('__imac_sys_dummy_timing_placeholder__');

export async function getDummyHash(): Promise<string> {
  return _dummyHashPromise;
}
