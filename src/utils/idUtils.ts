/**
 * MORVELLO CARS - STABLE IDENTIFIER GENERATOR (STEP 13)
 * Replaces collision-prone Date.now() IDs with cryptographically secure UUID-based stable IDs.
 */

export type EntityPrefix = 'cnt' | 'dep' | 'cli' | 'drv' | 'veh' | 'pay' | 'exp' | 'aud';

export function generateStableId(prefix: EntityPrefix): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  // Safe fallback with high entropy if crypto.randomUUID is unavailable
  const randPart = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
  return `${prefix}-${Date.now()}-${randPart}`;
}
