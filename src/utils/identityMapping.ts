import { User, UserRole } from '../types';

/**
 * ==============================================================================
 * MORVELLO CARS — CANONICAL IDENTITY & LEGACY MAPPING ARCHITECTURE (PROBLEM #6)
 * ==============================================================================
 *
 * This module establishes a SINGLE, authoritative identity model:
 *
 * 1. Canonical User ID:
 *    - Supabase Auth UUID (auth.users.id) is the primary authoritative identity.
 *    - Persisted in public.profiles.id.
 *
 * 2. Legacy User ID (usr-1, usr-2, usr-3, usr-5, usr-6):
 *    - Historical identifiers used in legacy mock data, contracts, and agency assignments.
 *    - Explicitly mapped to canonical identities via public.profiles.legacy_id / local_id.
 *    - Legacy IDs cannot be forged or arbitrarily claimed by non-admin users.
 *
 * 3. Firebase UID:
 *    - Distinct, non-interchangeable identity used ONLY when authenticating with Firebase Auth
 *      (e.g., Google Sign-In) or when interacting with Firebase Admin / Cloud Firestore.
 *    - A Supabase Auth UUID is NEVER stored as a Firebase UID.
 *
 * 4. Authorization & Scope:
 *    - Roles and manager scopes are NEVER trusted from client payloads.
 *    - Supabase RLS and server-side verification independently resolve the caller's role.
 * ==============================================================================
 */

export interface LegacyUserMapping {
  legacyId: string;
  canonicalEmail: string;
  name: string;
  role: UserRole;
  agency: string;
}

export const CANONICAL_LEGACY_REGISTRY: Record<string, LegacyUserMapping> = {
  'usr-1': {
    legacyId: 'usr-1',
    canonicalEmail: 'anouar@morvellocars.com',
    name: 'Anouar',
    role: 'admin',
    agency: 'Siège & Direction Générale',
  },
  'usr-2': {
    legacyId: 'usr-2',
    canonicalEmail: 'said.khomri@morvellocars.com',
    name: 'Said Khomri',
    role: 'manager',
    agency: 'Agence Casablanca Centre',
  },
  'usr-3': {
    legacyId: 'usr-3',
    canonicalEmail: 'abdelkader.ouahib@morvellocars.com',
    name: 'Abdelkader Ouahib',
    role: 'manager',
    agency: 'Agence Aéroport Nouaceur',
  },
  'usr-5': {
    legacyId: 'usr-5',
    canonicalEmail: 'mohamed.ezzay@morvellocars.com',
    name: 'Mohamed Ezzay',
    role: 'manager',
    agency: 'Agence Marrakech & Région',
  },
  'usr-6': {
    legacyId: 'usr-6',
    canonicalEmail: 'larbi.khomri@morvellocars.com',
    name: 'Larbi Khomri',
    role: 'manager',
    agency: 'Agence Casablanca Littoral',
  },
};

/**
 * Checks whether an ID string is a legacy Morvello ID (e.g., 'usr-1', 'usr-5').
 */
export function isLegacyUserId(id: string | null | undefined): boolean {
  if (!id || typeof id !== 'string') return false;
  return /^usr-\d+$/i.test(id.trim());
}

/**
 * Checks whether an ID string is a standard RFC 4122 UUID (e.g. Supabase Auth UUID).
 */
export function isUuid(id: string | null | undefined): boolean {
  if (!id || typeof id !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id.trim());
}

/**
 * Resolves the canonical user ID (Supabase Auth UUID) from either a legacy ID or a UUID.
 * If a matching user in `users` has a non-legacy UUID, that UUID is returned.
 */
export function resolveCanonicalUserId(
  idOrLegacy: string | null | undefined,
  users: User[] = []
): string | undefined {
  if (!idOrLegacy || typeof idOrLegacy !== 'string') return undefined;
  const cleanId = idOrLegacy.trim();

  // If already a UUID, it is already canonical
  if (isUuid(cleanId)) return cleanId;

  // Search in provided users list
  const matched = users.find(
    (u) =>
      u.id === cleanId ||
      u.legacyId === cleanId ||
      u.supabaseUid === cleanId
  );

  if (matched) {
    if (matched.supabaseUid && isUuid(matched.supabaseUid)) {
      return matched.supabaseUid;
    }
    if (matched.id && isUuid(matched.id)) {
      return matched.id;
    }
  }

  // Fallback to the raw ID if not yet migrated to UUID
  return cleanId;
}

/**
 * Resolves the legacy ID ('usr-N') associated with a given user ID or UUID.
 */
export function resolveLegacyUserId(
  userIdOrUuid: string | null | undefined,
  users: User[] = []
): string | undefined {
  if (!userIdOrUuid || typeof userIdOrUuid !== 'string') return undefined;
  const cleanId = userIdOrUuid.trim();

  if (isLegacyUserId(cleanId)) return cleanId;

  const matched = users.find(
    (u) =>
      u.id === cleanId ||
      u.supabaseUid === cleanId ||
      u.legacyId === cleanId
  );

  if (matched?.legacyId) {
    return matched.legacyId;
  }

  // Check email matching against known registry
  if (matched?.email) {
    const emailLower = matched.email.toLowerCase();
    for (const [legacyId, reg] of Object.entries(CANONICAL_LEGACY_REGISTRY)) {
      if (reg.canonicalEmail.toLowerCase() === emailLower) {
        return legacyId;
      }
    }
  }

  return undefined;
}

/**
 * Checks if a resource's assignedManagerId or createdBy matches any identity
 * of the user (canonical ID, legacyId, supabaseUid, or email).
 */
export function matchUserIdentity(
  resourceManagerId: string | null | undefined,
  user: {
    id: string;
    legacyId?: string;
    supabaseUid?: string;
    firebaseUid?: string;
    email?: string;
  } | null | undefined
): boolean {
  if (!resourceManagerId || !user) return false;
  const cleanResId = resourceManagerId.trim();

  // 1. Direct match with canonical ID
  if (cleanResId === user.id) return true;

  // 2. Match with explicit Supabase Auth UUID
  if (user.supabaseUid && cleanResId === user.supabaseUid) return true;

  // 3. Match with legacy ID (e.g. 'usr-5')
  if (user.legacyId && cleanResId === user.legacyId) return true;

  // 4. Match with legacy ID if user.id is itself a legacy ID
  if (isLegacyUserId(user.id) && cleanResId === user.id) return true;

  // 5. Match with Firebase UID ONLY if resource has a real Firebase UID
  if (user.firebaseUid && cleanResId === user.firebaseUid) return true;

  // 6. Match with email if identifier is email format
  if (user.email && cleanResId.toLowerCase() === user.email.toLowerCase()) return true;

  return false;
}

/**
 * Security validation: A user cannot arbitrarily claim someone else's legacy ID.
 * - An administrator can assign any legacy ID.
 * - A non-admin user can ONLY claim a legacy ID that corresponds to their authenticated email/profile.
 */
export function validateLegacyIdClaim(
  claimedLegacyId: string,
  caller: {
    id: string;
    role?: UserRole;
    email?: string;
    legacyId?: string;
  }
): boolean {
  if (!claimedLegacyId) return false;
  if (caller.role === 'admin') return true;

  // If caller already has this legacy ID on their verified profile
  if (caller.legacyId && caller.legacyId === claimedLegacyId) return true;

  // Check against registry: caller email MUST match the registry email for that legacy ID
  const reg = CANONICAL_LEGACY_REGISTRY[claimedLegacyId];
  if (!reg) return false;

  if (caller.email && caller.email.toLowerCase() === reg.canonicalEmail.toLowerCase()) {
    return true;
  }

  return false;
}
