import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  User,
  UserRole,
  UserPermissions,
  DEFAULT_PERMISSIONS_BY_ROLE,
} from '../types';
import { initialUsers } from '../data/mockData';
import { auth, googleProvider } from '../lib/firebase';
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  updatePassword,
  sendPasswordResetEmail,
  User as FirebaseUser,
} from 'firebase/auth';
import { isAbortException } from '../initErrorHandling';
import { saveUserProfile } from '../lib/firestoreSync';
import { saveUserProfileToSupabase } from '../lib/supabaseSync';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  callSetUserRole,
  callProvisionTeamMember,
  forceRefreshTokenClaims,
} from '../lib/teamAdminService';

export interface AuthContextType {
  currentUser: User | null;
  users: User[];
  availableUsers: User[];
  firebaseUser: FirebaseUser | null;
  authLoading: boolean;
  login: (email: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  switchUser: (userId: string) => void;
  setCurrentUserRole: (role: UserRole) => void;
  addUser: (userData: Omit<User, 'id'> & { password?: string }) => Promise<User>;
  updateUser: (userId: string, data: Partial<User>) => Promise<void>;
  deleteUser: (userId: string) => void;
  updateUserPermissions: (userId: string, permissions: Partial<UserPermissions>) => void;
  updateUserRole: (userId: string, role: UserRole) => Promise<void> | void;
  resetUserPermissions: (userId: string) => void;
  hasPermission: (perm: keyof UserPermissions) => boolean;
  changeUserPassword: (userId: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  setAgencyFallbackPassword: (userId: string, password: string) => { success: boolean; error?: string };
  sendResetEmail: (email: string) => Promise<{ success: boolean; error?: string }>;
  setUsersList: (users: User[]) => void;
  refreshClaims: () => Promise<{ admin: boolean; role?: UserRole; claims: Record<string, any> }>;
}

const STORAGE_KEYS = {
  USER: 'morvello_current_user_v1',
  USERS: 'morvello_users_v1',
  PASSWORDS: 'morvello_user_passwords_v1',
};

const getStoredPasswords = (): Record<string, string> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PASSWORDS);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

/**
 * Generic timeout wrapper to prevent hanging promises (e.g. Supabase web-locks / fetch locks)
 */
function withTimeout<T>(promise: Promise<T> | PromiseLike<T>, timeoutMs: number, timeoutError: string): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(timeoutError)), timeoutMs)
    ),
  ]);
}

const setStoredPassword = (userIdentifier: string, pass: string) => {
  if (!userIdentifier || !pass) return;
  try {
    const map = getStoredPasswords();
    map[userIdentifier.toLowerCase()] = pass;
    localStorage.setItem(STORAGE_KEYS.PASSWORDS, JSON.stringify(map));
  } catch (e) {
    console.warn('Failed to store password', e);
  }
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{
  children: React.ReactNode;
  onAuditLog?: (action: string, targetType: any, targetId: string, details: string) => void;
}> = ({ children, onAuditLog }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.USERS);
    if (saved) {
      try {
        const parsed: User[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const mapped: User[] = parsed
            .filter((u) => u.id !== 'usr-4' && u.name !== 'Kenza Tazi')
            .map((u) => {
              const initialMatch = initialUsers.find((iu) => iu.id === u.id);
              return {
                ...u,
                name: initialMatch?.name || u.name,
                email: initialMatch?.email || u.email,
                phone: u.phone || initialMatch?.phone,
                permissions: u.permissions || { ...DEFAULT_PERMISSIONS_BY_ROLE[u.role] },
                mustChangePassword: u.mustChangePassword ?? initialMatch?.mustChangePassword ?? false,
              };
            });

          for (const iu of initialUsers) {
            if (!mapped.some((u) => u.id === iu.id)) {
              mapped.push(iu);
            }
          }
          return mapped;
        }
      } catch (e) {
        console.error('Failed to parse saved users', e);
      }
    }
    return initialUsers;
  });

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.USER);
    if (saved) {
      try {
        const parsed: User = JSON.parse(saved);
        const match = users.find((u) => u.id === parsed.id);
        return match || null;
      } catch (e) {
        console.error('Failed to parse current user', e);
      }
    }
    return null;
  });

  // Listen to Firebase Authentication state changes & resolve Custom Claims
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      setAuthLoading(false);

      if (fbUser && fbUser.email) {
        const emailLower = fbUser.email.toLowerCase();

        // 1. Read cryptographically verified Custom Claims from Firebase Auth token
        let claimRole: UserRole | undefined;
        let isClaimAdmin = false;
        try {
          const tokenResult = await fbUser.getIdTokenResult();
          const claims = tokenResult.claims || {};
          isClaimAdmin = claims.admin === true || claims.role === 'admin';
          claimRole = (claims.role as UserRole) || (isClaimAdmin ? 'admin' : undefined);
          console.log('[AuthContext] Session active with claims:', { isClaimAdmin, claimRole });
        } catch (claimsErr) {
          console.warn('[AuthContext] Claims read notice:', claimsErr);
        }

        // Check if Google/Firebase user matches an existing team member (strict exact match)
        const matched = users.find(
          (u) => (u.email || '').toLowerCase() === emailLower
        );

        if (matched) {
          const effectiveRole = claimRole || matched.role;
          setCurrentUser((prev) => {
            if (!prev || prev.id !== matched.id || prev.role !== effectiveRole) {
              return {
                ...matched,
                role: effectiveRole,
                permissions: { ...DEFAULT_PERMISSIONS_BY_ROLE[effectiveRole] },
                firebaseUid: fbUser.uid,
                authProvider: fbUser.providerData?.[0]?.providerId === 'google.com' ? 'google' : 'password',
              };
            }
            return { ...prev, firebaseUid: fbUser.uid };
          });
        } else if (claimRole || isClaimAdmin) {
          const resolvedRole: UserRole = claimRole || 'admin';
          const newUser: User = {
            id: `usr-${fbUser.uid.slice(0, 8)}`,
            name: fbUser.displayName || emailLower.split('@')[0],
            email: emailLower,
            role: resolvedRole,
            firebaseUid: fbUser.uid,
            authProvider: fbUser.providerData?.[0]?.providerId === 'google.com' ? 'google' : 'password',
            permissions: { ...DEFAULT_PERMISSIONS_BY_ROLE[resolvedRole] },
          };
          setCurrentUser(newUser);
        }
      } else if (!fbUser) {
        // Sign-out event from Firebase Auth: only clear if current user was authenticated via Firebase
        setCurrentUser((prev) => {
          if (prev && (prev.authProvider === 'google' || prev.authProvider === 'password')) {
            localStorage.removeItem(STORAGE_KEYS.USER);
            return null;
          }
          return prev;
        });
      }
    });

    return () => unsubscribe();
  }, [users]);

  // Listen to Supabase Auth state changes
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const resolveSupabaseProfile = async (sbUser: any): Promise<User | null> => {
      if (!sbUser?.email) return null;
      const emailLower = sbUser.email.toLowerCase();

      let fetchedRole: UserRole | undefined;
      let fetchedName: string | undefined;
      try {
        const { data: profileData } = await withTimeout(
          supabase
            .from('profiles')
            .select('role, name')
            .eq('id', sbUser.id)
            .maybeSingle(),
          8000,
          'Délai de récupération du profil Supabase dépassé'
        );

        if (profileData?.role) {
          fetchedRole = profileData.role as UserRole;
        }
        if (profileData?.name) {
          fetchedName = profileData.name;
        }
      } catch (e) {
        console.warn('[Supabase Auth] Session profile fetch notice:', e);
      }

      const matched = users.find((u) => (u.email || '').toLowerCase() === emailLower);
      const role: UserRole = fetchedRole || (matched ? matched.role : 'agent');

      return {
        id: matched?.id || `usr-${sbUser.id.slice(0, 8)}`,
        name: fetchedName || matched?.name || sbUser.user_metadata?.name || emailLower.split('@')[0],
        email: emailLower,
        role,
        agency: matched?.agency || 'Agence Morvello',
        permissions: { ...DEFAULT_PERMISSIONS_BY_ROLE[role] },
        firebaseUid: sbUser.id,
        authProvider: 'password',
      };
    };

    withTimeout(supabase.auth.getSession(), 8000, 'Délai getSession Supabase dépassé')
      .then(async ({ data: { session } }: any) => {
        if (session?.user) {
          const userObj = await resolveSupabaseProfile(session.user);
          if (userObj) {
            setCurrentUser((prev) => {
              if (!prev || prev.id !== userObj.id || prev.role !== userObj.role) {
                return userObj;
              }
              return prev;
            });
          }
        }
      })
      .catch((err) => {
        console.warn('[Supabase Auth] getSession notice/timeout:', err);
      });

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const userObj = await resolveSupabaseProfile(session.user);
        if (userObj) {
          setCurrentUser(userObj);
        }
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [users]);

  // Persist users and currentUser (without sensitive credentials)
  useEffect(() => {
    try {
      const sanitized = users.map((u) => {
        const { password: _p, passwordHash: _ph, passwordSalt: _ps, ...rest } = u as any;
        return rest;
      });
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(sanitized));
    } catch (e) {
      console.error('Failed to save users', e);
    }
  }, [users]);

  useEffect(() => {
    if (currentUser) {
      const { password: _p, passwordHash: _ph, passwordSalt: _ps, ...safe } = currentUser as any;
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(safe));
    } else {
      localStorage.removeItem(STORAGE_KEYS.USER);
    }
  }, [currentUser]);

  // Available operational users (managers & admin)
  const availableUsers = users.filter((u) => u.role === 'admin' || u.role === 'manager');

  const logAction = (action: string, targetType: any, targetId: string, details: string) => {
    if (onAuditLog) {
      onAuditLog(action, targetType, targetId, details);
    }
  };

  /**
   * Agency fallback authentication:
   * Used when Firebase email/password provider is disabled in Firebase Console (auth/operation-not-allowed)
   * or when validating team agency credentials.
   */
  const performAgencyLoginFallback = (
    canonicalEmail: string,
    trimmedPass: string
  ): { success: boolean; error?: string } => {
    // Check if canonicalEmail matches any known user (strict exact match)
    const matchedUser = users.find(
      (u) => (u.email || '').toLowerCase() === canonicalEmail
    );

    if (!matchedUser) {
      return {
        success: false,
        error: 'Aucun compte collaborateur trouvé avec cet e-mail.',
      };
    }

    const passwords = getStoredPasswords();
    const storedPass =
      passwords[matchedUser.id.toLowerCase()] ||
      passwords[matchedUser.email.toLowerCase()] ||
      (matchedUser as any).password;

    if (!storedPass) {
      return {
        success: false,
        error: 'Aucun mot de passe local configuré pour ce compte. Contactez un administrateur ou utilisez la connexion Firebase.',
      };
    }

    if (storedPass !== trimmedPass) {
      return {
        success: false,
        error: 'Mot de passe incorrect pour ce compte.',
      };
    }

    const finalRole = matchedUser.role;
    const finalUser: User = {
      ...matchedUser,
      role: finalRole,
      permissions: matchedUser.permissions || { ...DEFAULT_PERMISSIONS_BY_ROLE[finalRole] },
      authProvider: 'agency',
    };

    setCurrentUser(finalUser);
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(finalUser));

    logAction(
      'Connexion Agence',
      'user_permission',
      finalUser.id,
      `Connexion réussie de ${finalUser.name} (${finalRole.toUpperCase()}) en mode agence sécurisé`
    );

    return { success: true };
  };

  /**
   * Primary Login handler:
   * 1. Attempts Native Firebase Auth sign-in.
   * 2. If Firebase Email/Password provider is disabled in Firebase Console (auth/operation-not-allowed),
   *    seamlessly falls back to Agency Team Authentication with full RBAC permissions.
   */
  const login = async (
    email: string,
    pass: string
  ): Promise<{ success: boolean; error?: string }> => {
    const trimmedInput = email.trim().toLowerCase();
    const trimmedPass = pass.trim();

    if (!trimmedInput || !trimmedPass) {
      return { success: false, error: 'Veuillez saisir votre adresse email et votre mot de passe.' };
    }

    // Normalize canonical email
    let canonicalEmail = trimmedInput;
    if (!canonicalEmail.includes('@')) {
      canonicalEmail = `${canonicalEmail}@morvellocars.com`;
    }

    // 0. Primary: Check Supabase Auth if configured
    if (isSupabaseConfigured) {
      try {
        const { data: sbData, error: sbErr } = await withTimeout(
          supabase.auth.signInWithPassword({
            email: canonicalEmail,
            password: trimmedPass,
          }),
          8000,
          'Délai de connexion Supabase dépassé'
        );

        if (!sbErr && sbData?.user) {
          const sbUser = sbData.user;
          
          // Query user profile from Supabase profiles table (secured by RLS)
          let fetchedRole: UserRole | undefined;
          let fetchedName: string | undefined;
          try {
            const { data: profileData } = await withTimeout(
              supabase
                .from('profiles')
                .select('role, name')
                .eq('id', sbUser.id)
                .maybeSingle(),
              8000,
              'Délai de récupération du profil Supabase dépassé'
            );

            if (profileData?.role) {
              fetchedRole = profileData.role as UserRole;
            }
            if (profileData?.name) {
              fetchedName = profileData.name;
            }
          } catch (profileErr) {
            console.warn('[Supabase Auth] Profile fetch notice:', profileErr);
          }

          const matchedUser = users.find((u) => (u.email || '').toLowerCase() === canonicalEmail);
          const finalRole: UserRole = fetchedRole || (matchedUser ? matchedUser.role : 'agent');
          
          const finalUser: User = {
            id: matchedUser?.id || `usr-${sbUser.id.slice(0, 8)}`,
            name: fetchedName || matchedUser?.name || sbUser.user_metadata?.name || canonicalEmail.split('@')[0],
            email: canonicalEmail,
            role: finalRole,
            agency: matchedUser?.agency || 'Agence Morvello',
            permissions: { ...DEFAULT_PERMISSIONS_BY_ROLE[finalRole] },
            firebaseUid: sbUser.id,
            authProvider: 'password',
          };

          // Sync profile to both Firestore and Supabase profiles table
          saveUserProfile(sbUser.id, {
            role: finalUser.role,
            email: finalUser.email,
            name: finalUser.name,
          }).catch(() => {});

          saveUserProfileToSupabase(sbUser.id, {
            role: finalUser.role,
            email: finalUser.email,
            name: finalUser.name,
            permissions: finalUser.permissions,
          }).catch(() => {});

          setCurrentUser(finalUser);
          logAction(
            'Connexion Supabase Auth',
            'user_permission',
            finalUser.id,
            `Connexion réussie de ${finalUser.name} (${finalUser.role.toUpperCase()}) avec Supabase Auth`
          );
          return { success: true };
        }
      } catch (sbEx) {
        console.warn('[Supabase Auth] Login attempt notice:', sbEx);
      }
    }

    try {
      // 1. Native Firebase Auth sign-in
      const cred = await signInWithEmailAndPassword(auth, canonicalEmail, trimmedPass);
      const fbUser = cred.user;

      // Read Custom Claims from token
      let claimRole: UserRole | undefined;
      let isClaimAdmin = false;
      try {
        const tokenResult = await fbUser.getIdTokenResult();
        const claims = tokenResult.claims || {};
        isClaimAdmin = claims.admin === true || claims.role === 'admin';
        claimRole = (claims.role as UserRole) || (isClaimAdmin ? 'admin' : undefined);
      } catch (e) {
        console.warn('Claims read error:', e);
      }

      // 2. Identify application team user (strict exact match)
      const matchedUser =
        users.find((u) => (u.email || '').toLowerCase() === canonicalEmail) || {
          id: `usr-${Date.now()}`,
          name: canonicalEmail.split('@')[0],
          email: canonicalEmail,
          role: (claimRole || 'agent') as UserRole,
          agency: 'Agence Morvello',
          permissions: { ...DEFAULT_PERMISSIONS_BY_ROLE[claimRole || 'agent'] },
        };

      const finalRole = claimRole || matchedUser.role;
      const finalUser: User = {
        ...matchedUser,
        role: finalRole,
        permissions: { ...DEFAULT_PERMISSIONS_BY_ROLE[finalRole] },
        firebaseUid: fbUser.uid,
        authProvider: 'password',
      };

      // 3. Persist User Profile & RBAC role to Firestore /users/{uid}
      try {
        await saveUserProfile(fbUser.uid, {
          role: finalUser.role,
          email: finalUser.email,
          name: finalUser.name,
        });
      } catch (profileErr) {
        console.warn('Profile sync warning:', profileErr);
      }

      setCurrentUser(finalUser);
      logAction(
        'Connexion Firebase Auth',
        'user_permission',
        finalUser.id,
        `Connexion réussie de ${finalUser.name} (${finalUser.role.toUpperCase()}) avec Firebase Auth natif`
      );

      return { success: true };
    } catch (fbErr: any) {
      if (isAbortException(fbErr)) {
        return { success: false, error: 'Connexion annulée.' };
      }

      const code = fbErr?.code;

      // Case (a): When Firebase Email/Password provider is disabled in Firebase Console
      // (auth/operation-not-allowed) or blocked, authenticate with Agency fallback system:
      const isProviderDisabled =
        code === 'auth/operation-not-allowed' ||
        code === 'auth/configuration-not-found' ||
        code === 'auth/project-not-found' ||
        code === 'auth/internal-error';

      if (isProviderDisabled) {
        console.info(
          `[AuthContext] Firebase provider inactive (${code}). Activating agency login fallback.`
        );
        return performAgencyLoginFallback(canonicalEmail, trimmedPass);
      }

      // Case (b): Standard Firebase Auth credential errors - return clear error directly without fallback
      if (
        code === 'auth/invalid-credential' ||
        code === 'auth/wrong-password' ||
        code === 'auth/user-not-found' ||
        code === 'auth/invalid-email'
      ) {
        return {
          success: false,
          error: 'Identifiants invalides. Vérifiez votre email et mot de passe.',
        };
      }
      if (code === 'auth/user-disabled') {
        return { success: false, error: 'Ce compte utilisateur a été désactivé par un administrateur.' };
      }
      if (code === 'auth/too-many-requests') {
        return {
          success: false,
          error: 'Trop de tentatives échouées. Veuillez patienter ou réinitialiser votre mot de passe.',
        };
      }

      // Case (c): Return any other unhandled error as-is without fallback
      return {
        success: false,
        error: fbErr?.message || 'Erreur lors de la connexion.',
      };
    }
  };

  /**
   * Google Sign-In with Firebase Auth & RBAC Firestore Profile Sync
   */
  const loginWithGoogle = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const fbUser = result.user;
      const userEmail = fbUser.email?.toLowerCase() || '';

      // Read Custom Claims from Google user token
      let claimRole: UserRole | undefined;
      let isClaimAdmin = false;
      try {
        const tokenResult = await fbUser.getIdTokenResult();
        const claims = tokenResult.claims || {};
        isClaimAdmin = claims.admin === true || claims.role === 'admin';
        claimRole = (claims.role as UserRole) || (isClaimAdmin ? 'admin' : undefined);
      } catch (e) {
        console.warn('Claims read error on Google login:', e);
      }

      // Link to team account (strict exact match)
      const matched = users.find(
        (u) => (u.email || '').toLowerCase() === userEmail
      );

      const targetRole: UserRole = claimRole || (matched ? matched.role : 'agent');
      const targetUser =
        matched || {
          id: `usr-google-${Date.now()}`,
          name: fbUser.displayName || userEmail.split('@')[0],
          email: userEmail,
          role: targetRole,
          agency: 'Agence Morvello',
          permissions: { ...DEFAULT_PERMISSIONS_BY_ROLE[targetRole] },
        };

      const finalUser: User = {
        ...targetUser,
        role: targetRole,
        permissions: { ...DEFAULT_PERMISSIONS_BY_ROLE[targetRole] },
        firebaseUid: fbUser.uid,
        authProvider: 'google',
      };

      // Synchronize role and profile in Firestore RBAC
      try {
        await saveUserProfile(fbUser.uid, {
          role: finalUser.role,
          email: finalUser.email,
          name: finalUser.name,
        });
      } catch (err) {
        console.warn('Profile sync notice:', err);
      }

      setCurrentUser(finalUser);
      logAction(
        'Connexion Google Firebase',
        'user_permission',
        finalUser.id,
        `Connexion Google réussie : ${fbUser.displayName || finalUser.name} (${userEmail})`
      );

      return { success: true };
    } catch (error: any) {
      if (isAbortException(error)) {
        return {
          success: false,
          error: 'Connexion Google annulée.',
        };
      }
      console.error('Google Sign-In error:', error);
      return {
        success: false,
        error: error.message || 'Échec de la connexion avec Google.',
      };
    }
  };

  const logout = async () => {
    if (currentUser) {
      logAction('Déconnexion', 'user_permission', currentUser.id, `Déconnexion de ${currentUser.name}`);
    }
    if (isSupabaseConfigured) {
      try {
        await supabase.auth.signOut();
      } catch (sbSignOutErr) {
        console.warn('Supabase sign-out notice:', sbSignOutErr);
      }
    }
    try {
      await signOut(auth);
    } catch (e) {
      console.warn('Sign out warning:', e);
    }
    setCurrentUser(null);
    localStorage.removeItem(STORAGE_KEYS.USER);
  };

  const switchUser = (userId: string) => {
    // Only allow switchUser if current user is an admin or in initial state
    if (currentUser && currentUser.role !== 'admin') {
      console.warn('[Security] Unauthorized switchUser attempt blocked.');
      return;
    }
    const target = users.find((u) => u.id === userId);
    if (target) {
      setCurrentUser(target);
      logAction(
        'Changement d’utilisateur',
        'user_permission',
        target.id,
        `Basculement de session vers ${target.name} (${target.role.toUpperCase()})`
      );
    }
  };

  const setCurrentUserRole = async (role: UserRole) => {
    if (!currentUser) return;
    const targetUid = currentUser.firebaseUid || auth.currentUser?.uid;
    if (targetUid) {
      try {
        await callSetUserRole(targetUid, role);
        await forceRefreshTokenClaims();
      } catch (e) {
        console.warn('Set user role claim note:', e);
      }
    }

    const updated = {
      ...currentUser,
      role,
      permissions: { ...DEFAULT_PERMISSIONS_BY_ROLE[role] },
    };
    setCurrentUser(updated);
    setUsers((prev) => prev.map((u) => (u.id === currentUser.id ? updated : u)));
    logAction(
      'Modification rôle actif',
      'user_permission',
      currentUser.id,
      `Rôle de ${currentUser.name} modifié en ${role.toUpperCase()}`
    );
  };

  const addUser = async (userData: Omit<User, 'id'> & { password?: string }): Promise<User> => {
    // 1. Server-side provisioning (creates Auth account, Custom Claims, Firestore profile & reset link)
    let provisionedUid: string | undefined;
    let resetLink: string | null = null;

    try {
      const provResult = await callProvisionTeamMember({
        email: userData.email,
        name: userData.name,
        role: userData.role,
        agency: userData.agency,
        phone: userData.phone,
        assignedFleetName: userData.assignedFleetName,
        password: userData.password,
      });

      if (provResult.uid) {
        provisionedUid = provResult.uid;
      }
      if (provResult.resetLink) {
        resetLink = provResult.resetLink;
      }
    } catch (provErr) {
      console.warn('Team member server provisioning notice:', provErr);
    }

    const newUser: User = {
      ...userData,
      id: provisionedUid ? `usr-${provisionedUid.slice(0, 8)}` : `usr-${Date.now()}`,
      firebaseUid: provisionedUid,
      passwordResetLink: resetLink || undefined,
      permissions: userData.permissions || { ...DEFAULT_PERMISSIONS_BY_ROLE[userData.role] },
      mustChangePassword: true,
    };
    if (userData.password) {
      setStoredPassword(newUser.id, userData.password);
      setStoredPassword(newUser.email, userData.password);
    }
    delete (newUser as any).password;
    delete (newUser as any).passwordSalt;
    delete (newUser as any).passwordHash;

    // 2. Persist in Firestore /users/{uid}
    if (provisionedUid) {
      try {
        await saveUserProfile(provisionedUid, {
          role: newUser.role,
          email: newUser.email,
          name: newUser.name,
        });
      } catch (fsErr) {
        console.warn('Profile sync warning on addUser:', fsErr);
      }
    }

    setUsers((prev) => [...prev, newUser]);
    logAction(
      'Ajout membre d’équipe (Provisioning & Custom Claims)',
      'user_permission',
      newUser.id,
      `Nouveau collaborateur créé : ${newUser.name} (${newUser.role.toUpperCase()}) avec Custom Claims appliqués`
    );
    return newUser;
  };

  const updateUser = async (userId: string, data: Partial<User>) => {
    if (data.password) {
      setStoredPassword(userId, data.password);
      if (data.email) {
        setStoredPassword(data.email, data.password);
      }
      const existing = users.find((u) => u.id === userId);
      if (existing?.email) {
        setStoredPassword(existing.email, data.password);
      }
    }

    const updatePayload = { ...data };
    delete (updatePayload as any).password;
    delete (updatePayload as any).passwordSalt;
    delete (updatePayload as any).passwordHash;

    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          const updated = { ...u, ...updatePayload };
          if (currentUser?.id === userId) {
            setCurrentUser(updated);
          }
          return updated;
        }
        return u;
      })
    );

    const target = users.find((u) => u.id === userId);
    logAction(
      'Mise à jour collaborateur',
      'user_permission',
      userId,
      `Profil et permissions mis à jour pour ${target?.name || userId}`
    );
  };

  const changeUserPassword = async (
    userId: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> => {
    const trimmed = (newPassword || '').trim();
    if (!trimmed || trimmed.length < 6) {
      return { success: false, error: 'Le mot de passe doit contenir au moins 6 caractères.' };
    }

    setStoredPassword(userId, trimmed);
    const targetUser = users.find((u) => u.id === userId);
    if (targetUser?.email) {
      setStoredPassword(targetUser.email, trimmed);
    }

    // 1. Supabase Auth update if user has active session
    if (isSupabaseConfigured) {
      try {
        await supabase.auth.updateUser({ password: trimmed });
      } catch (sbPassErr) {
        console.warn('Supabase password update note:', sbPassErr);
      }
    }

    try {
      // 2. If current Firebase Auth session matches, update native password directly
      if (auth.currentUser) {
        await updatePassword(auth.currentUser, trimmed);
      }
    } catch (e: any) {
      console.warn('Firebase native password update notice:', e?.message || e);
    }

    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId ? { ...u, mustChangePassword: false } : u
      )
    );
    if (currentUser?.id === userId) {
      setCurrentUser((prev) => (prev ? { ...prev, mustChangePassword: false } : null));
    }
    logAction(
      'Modification mot de passe',
      'user_permission',
      userId,
      `Mot de passe renouvelé avec succès pour l’utilisateur #${userId}`
    );
    return { success: true };
  };

  const sendResetEmail = async (email: string): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = email.trim().toLowerCase();

    // 1. Try Supabase Auth password reset
    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail);
        if (!error) {
          return { success: true };
        }
      } catch (sbResetErr) {
        console.warn('Supabase reset notice:', sbResetErr);
      }
    }

    // 2. Try Firebase Auth password reset
    try {
      await sendPasswordResetEmail(auth, cleanEmail);
      return { success: true };
    } catch (e: any) {
      return {
        success: false,
        error: e?.message || 'Impossible d’envoyer l’email de réinitialisation.',
      };
    }
  };

  const deleteUser = (userId: string) => {
    const targetUser = users.find((u) => u.id === userId);
    if (!targetUser) return;
    setUsers((prev) => prev.filter((u) => u.id !== userId));
    logAction(
      'Suppression collaborateur',
      'user_permission',
      userId,
      `Compte collaborateur supprimé : ${targetUser.name}`
    );
  };

  const updateUserPermissions = (userId: string, permissions: Partial<UserPermissions>) => {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId
          ? { ...u, permissions: { ...(u.permissions || DEFAULT_PERMISSIONS_BY_ROLE[u.role]), ...permissions } }
          : u
      )
    );
    const target = users.find((u) => u.id === userId);
    logAction(
      'Modification permissions',
      'user_permission',
      userId,
      `Permissions personnalisées enregistrées pour ${target?.name || userId}`
    );
  };

  const updateUserRole = async (userId: string, role: UserRole): Promise<void> => {
    const target = users.find((u) => u.id === userId);
    const targetUid = target?.firebaseUid || (userId === currentUser?.id ? auth.currentUser?.uid : undefined);

    // 1. Invoke server-side / Cloud Function to set Custom Claims via Admin SDK
    if (targetUid) {
      try {
        await callSetUserRole(targetUid, role);
      } catch (roleClaimErr) {
        console.warn('[AuthContext] Update user role claim note:', roleClaimErr);
      }
    }

    // 2. If changing the active user's own role, force token refresh so request.auth.token updates
    if (auth.currentUser && (auth.currentUser.uid === targetUid || userId === currentUser?.id)) {
      await forceRefreshTokenClaims();
    }

    // 3. Update local state
    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId
          ? { ...u, role, permissions: { ...DEFAULT_PERMISSIONS_BY_ROLE[role] } }
          : u
      )
    );

    if (currentUser?.id === userId) {
      setCurrentUser((prev) =>
        prev
          ? { ...prev, role, permissions: { ...DEFAULT_PERMISSIONS_BY_ROLE[role] } }
          : null
      );
    }

    // 4. Update Firestore user profile & Supabase profiles table
    if (targetUid) {
      try {
        await saveUserProfile(targetUid, {
          role,
          email: target?.email || '',
          name: target?.name,
        });
      } catch (fsErr) {
        console.warn('[AuthContext] Firestore profile sync warning:', fsErr);
      }

      try {
        await saveUserProfileToSupabase(targetUid, {
          role,
          email: target?.email || '',
          name: target?.name,
          permissions: { ...DEFAULT_PERMISSIONS_BY_ROLE[role] },
        });
      } catch (sbErr) {
        console.warn('[AuthContext] Supabase profile sync warning:', sbErr);
      }
    }

    logAction(
      'Changement de rôle (Custom Claims)',
      'user_permission',
      userId,
      `Rôle mis à jour en ${role.toUpperCase()} pour ${target?.name || userId} (Custom Claims synchronisés)`
    );
  };

  const resetUserPermissions = (userId: string) => {
    const targetUser = users.find((u) => u.id === userId);
    if (!targetUser) return;
    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId
          ? { ...u, permissions: { ...DEFAULT_PERMISSIONS_BY_ROLE[u.role] } }
          : u
      )
    );
    logAction(
      'Réinitialisation permissions',
      'user_permission',
      userId,
      `Rétablissement du profil par défaut pour ${targetUser.name}`
    );
  };

  const hasPermission = (perm: keyof UserPermissions): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;
    if (currentUser.permissions && typeof currentUser.permissions[perm] === 'boolean') {
      return currentUser.permissions[perm];
    }
    const defaultPerms = DEFAULT_PERMISSIONS_BY_ROLE[currentUser.role];
    return defaultPerms ? defaultPerms[perm] : false;
  };

  const setUsersList = (newUsers: User[]) => {
    setUsers(newUsers);
  };

  /**
   * Admin-only function to explicitly preconfigure a user's agency fallback password.
   * Requires the caller to be an active admin authenticated with native Firebase.
   */
  const setAgencyFallbackPassword = (
    userId: string,
    password: string
  ): { success: boolean; error?: string } => {
    if (!currentUser || currentUser.role !== 'admin') {
      return {
        success: false,
        error: 'Action réservée aux administrateurs.',
      };
    }
    if (currentUser.authProvider === 'agency') {
      return {
        success: false,
        error: 'Cette action requiert une session administrateur authentifiée via Firebase natif.',
      };
    }

    const trimmed = (password || '').trim();
    if (!trimmed || trimmed.length < 6) {
      return {
        success: false,
        error: 'Le mot de passe de secours doit contenir au moins 6 caractères.',
      };
    }

    const targetUser = users.find(
      (u) => u.id === userId || (u.email || '').toLowerCase() === userId.toLowerCase()
    );
    if (!targetUser) {
      return {
        success: false,
        error: 'Collaborateur introuvable.',
      };
    }

    setStoredPassword(targetUser.id, trimmed);
    if (targetUser.email) {
      setStoredPassword(targetUser.email, trimmed);
    }

    logAction(
      'Configuration Mot de Passe Agence',
      'user_permission',
      targetUser.id,
      `Mot de passe de secours agence configuré pour ${targetUser.name} par l'administrateur ${currentUser.name}`
    );

    return { success: true };
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        users,
        availableUsers,
        firebaseUser,
        authLoading,
        login,
        loginWithGoogle,
        logout,
        switchUser,
        setCurrentUserRole,
        addUser,
        updateUser,
        deleteUser,
        updateUserPermissions,
        updateUserRole,
        resetUserPermissions,
        hasPermission,
        changeUserPassword,
        setAgencyFallbackPassword,
        sendResetEmail,
        setUsersList,
        refreshClaims: forceRefreshTokenClaims,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

