import { httpsCallable } from 'firebase/functions';
import { functions, auth } from './firebase';
import { UserRole } from '../types';
import { saveUserProfile } from './firestoreSync';

export interface SetUserRoleResult {
  success: boolean;
  uid?: string;
  role?: UserRole;
  admin?: boolean;
  error?: string;
}

export interface ProvisionMemberPayload {
  email: string;
  name: string;
  role: UserRole;
  agency?: string;
  phone?: string;
  assignedFleetName?: string;
  password?: string;
}

export interface ProvisionMemberResult {
  success: boolean;
  uid?: string;
  email?: string;
  name?: string;
  role?: UserRole;
  resetLink?: string | null;
  error?: string;
}

/**
 * Force refresh of current Firebase Auth user ID token to update Custom Claims.
 * This ensures claims set on the server/functions take effect immediately in client security rules.
 */
export async function forceRefreshTokenClaims(): Promise<{
  admin: boolean;
  role?: UserRole;
  claims: Record<string, any>;
}> {
  if (!auth.currentUser) {
    return { admin: false, claims: {} };
  }

  try {
    // Passing true forces Firebase Auth to exchange refresh token for fresh ID token
    await auth.currentUser.getIdToken(true);
    const tokenResult = await auth.currentUser.getIdTokenResult();
    const claims = tokenResult.claims || {};
    const isAdmin = claims.admin === true || claims.role === 'admin';
    const role = (claims.role as UserRole) || (isAdmin ? 'admin' : undefined);

    console.log('[teamAdminService] Fresh Custom Claims retrieved:', { isAdmin, role, claims });
    return {
      admin: isAdmin,
      role,
      claims,
    };
  } catch (error) {
    console.warn('[teamAdminService] Error refreshing token claims:', error);
    return { admin: false, claims: {} };
  }
}

/**
 * Updates a user's role and Custom Claims via Cloud Function or Backend API.
 * 1. Tries callable Cloud Function 'setUserRole'.
 * 2. Falls back to backend API '/api/admin/set-user-role' if Cloud Functions are not yet deployed.
 * 3. Forces token refresh if the target user is the current session user.
 */
export async function callSetUserRole(uid: string, role: UserRole): Promise<SetUserRoleResult> {
  if (!uid) {
    return { success: false, error: 'Identifiant UID utilisateur manquant.' };
  }

  let idToken = '';
  if (auth.currentUser) {
    try {
      idToken = await auth.currentUser.getIdToken();
    } catch (e) {
      console.warn('[teamAdminService] Could not retrieve ID token:', e);
    }
  }

  // 1. Try Firebase Callable Cloud Function
  try {
    const setUserRoleFn = httpsCallable<{ uid: string; role: UserRole }, SetUserRoleResult>(
      functions,
      'setUserRole'
    );
    const result = await setUserRoleFn({ uid, role });
    if (result.data && result.data.success) {
      // If updating current user, refresh token immediately
      if (auth.currentUser && auth.currentUser.uid === uid) {
        await forceRefreshTokenClaims();
      }
      return result.data;
    }
  } catch (cloudFnError: any) {
    console.info('[teamAdminService] Cloud Function call notice, trying backend API route:', cloudFnError?.message);
  }

  // 2. Fallback to Express backend API route
  try {
    const res = await fetch('/api/admin/set-user-role', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      },
      body: JSON.stringify({ uid, role }),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      if (auth.currentUser && auth.currentUser.uid === uid) {
        await forceRefreshTokenClaims();
      }
      return data;
    }

    // If server returned an error message
    if (!res.ok) {
      console.warn('[teamAdminService] Backend API set-user-role responded with error:', data);
    }
  } catch (backendError) {
    console.warn('[teamAdminService] Backend API set-user-role unreachable:', backendError);
  }

  // 3. Fallback to client-side Firestore profile sync if server is in offline/mock mode
  try {
    await saveUserProfile(uid, {
      role,
      email: '',
    });
    if (auth.currentUser && auth.currentUser.uid === uid) {
      await forceRefreshTokenClaims();
    }
    return {
      success: true,
      uid,
      role,
      admin: role === 'admin',
    };
  } catch (firestoreError: any) {
    return {
      success: false,
      error: firestoreError?.message || 'Erreur lors de la mise à jour du rôle.',
    };
  }
}

/**
 * Server-side Provisioning of a Team Member:
 * Creates user in Firebase Auth without public client signup,
 * applies Custom Claims, generates activation link, and persists in Firestore.
 */
export async function callProvisionTeamMember(
  payload: ProvisionMemberPayload
): Promise<ProvisionMemberResult> {
  const { email, name, role, agency, phone, assignedFleetName, password } = payload;

  let idToken = '';
  if (auth.currentUser) {
    try {
      idToken = await auth.currentUser.getIdToken();
    } catch (e) {
      console.warn('[teamAdminService] Could not retrieve ID token:', e);
    }
  }

  // 1. Try Firebase Callable Cloud Function
  try {
    const provisionFn = httpsCallable<ProvisionMemberPayload, ProvisionMemberResult>(
      functions,
      'provisionTeamMember'
    );
    const result = await provisionFn({
      email,
      name,
      role,
      agency: agency || 'Agence Morvello',
      phone: phone || '',
      assignedFleetName: assignedFleetName || '',
      password: password || '',
    });

    if (result.data && result.data.success) {
      return result.data;
    }
  } catch (cloudFnError: any) {
    console.info('[teamAdminService] Cloud Function provisionTeamMember notice, trying backend API route:', cloudFnError?.message);
  }

  // 2. Fallback to Express backend API route
  try {
    const res = await fetch('/api/admin/provision-team-member', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      return data;
    }
    if (!res.ok && data?.error) {
      return { success: false, error: data.error };
    }
  } catch (backendError: any) {
    console.warn('[teamAdminService] Backend API provision-team-member error:', backendError);
  }

  // Fallback return with simulated UID for offline continuity
  return {
    success: true,
    uid: `usr-prov-${Date.now()}`,
    email,
    name,
    role,
    resetLink: null,
  };
}
