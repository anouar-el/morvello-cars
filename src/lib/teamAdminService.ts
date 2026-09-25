import { httpsCallable } from 'firebase/functions';
import { functions, auth } from './firebase';
import { UserRole } from '../types';
import { saveUserProfile } from './firestoreSync';
import { getActiveAuthToken } from './authToken';

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
 * 1. Retrieves active authorization token (Supabase JWT or Firebase ID Token).
 * 2. Tries callable Cloud Function 'setUserRole' if Firebase auth is active.
 * 3. Falls back to backend API '/api/admin/set-user-role'.
 * 4. Never reports false success.
 */
export async function callSetUserRole(uid: string, role: UserRole): Promise<SetUserRoleResult> {
  if (!uid) {
    return { success: false, error: 'Identifiant UID utilisateur manquant.' };
  }

  const { token: authToken } = await getActiveAuthToken();

  // 1. Try Firebase Callable Cloud Function if Firebase Auth is active
  if (auth.currentUser) {
    try {
      const setUserRoleFn = httpsCallable<{ uid: string; role: UserRole }, SetUserRoleResult>(
        functions,
        'setUserRole'
      );
      const result = await setUserRoleFn({ uid, role });
      if (result.data && result.data.success) {
        if (auth.currentUser.uid === uid) {
          await forceRefreshTokenClaims();
        }
        return result.data;
      }
    } catch (cloudFnError: any) {
      console.info('[teamAdminService] Cloud Function call notice, trying backend API route:', cloudFnError?.message);
    }
  }

  // 2. Call Express backend API route with active auth bearer token
  try {
    const res = await fetch('/api/admin/set-user-role', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
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

    if (!res.ok) {
      return {
        success: false,
        error: data.error || `Erreur serveur HTTP ${res.status} lors de la modification du rôle.`,
      };
    }
  } catch (backendError: any) {
    console.warn('[teamAdminService] Backend API set-user-role unreachable:', backendError);
    return {
      success: false,
      error: backendError?.message || 'Serveur d’administration inaccessible.',
    };
  }

  return {
    success: false,
    error: 'Impossible d’appliquer le rôle utilisateur : échec des services d’administration.',
  };
}

/**
 * Server-side Provisioning of a Team Member:
 * Authoritatively provisions the user in the authentication system without public client signup.
 * CRITICAL: Never reports false success if backend provisioning failed or is unreachable.
 */
export async function callProvisionTeamMember(
  payload: ProvisionMemberPayload
): Promise<ProvisionMemberResult> {
  const { email, name, role, agency, phone, assignedFleetName, password } = payload;

  const { token: authToken } = await getActiveAuthToken();

  // 1. Try Firebase Callable Cloud Function if Firebase Auth is active
  if (auth.currentUser) {
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
      if (result.data && !result.data.success) {
        return result.data;
      }
    } catch (cloudFnError: any) {
      console.info('[teamAdminService] Cloud Function provisionTeamMember notice, trying backend API route:', cloudFnError?.message);
    }
  }

  // 2. Call Express backend API route with active auth bearer token
  try {
    const res = await fetch('/api/admin/provision-team-member', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      return data;
    }
    if (data?.error) {
      return { success: false, error: data.error };
    }
    if (!res.ok) {
      return {
        success: false,
        error: `Erreur serveur HTTP ${res.status} lors du provisionnement.`,
      };
    }
  } catch (backendError: any) {
    console.warn('[teamAdminService] Backend API provision-team-member error:', backendError);
    return {
      success: false,
      error: backendError?.message || 'Erreur réseau : le serveur de provisionnement est indisponible.',
    };
  }

  // Never return false success with a fake UUID!
  return {
    success: false,
    error: 'Échec du provisionnement du compte collaborateur. Aucun service d’administration n’a pu valider la création.',
  };
}
