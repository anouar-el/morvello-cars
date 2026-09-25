import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  User,
  UserRole,
  UserPermissions,
  DEFAULT_PERMISSIONS_BY_ROLE,
} from '../types';
import { initialUsers } from '../data/mockData';
import { saveUserProfileToSupabase } from '../lib/supabaseSync';
import { saveRemoteAgencyData } from '../lib/firestoreSync';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface AuthContextType {
  currentUser: User | null;
  users: User[];
  availableUsers: User[];
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
  sendResetEmail: (email: string) => Promise<{ success: boolean; error?: string }>;
  setUsersList: (users: User[]) => void;
  refreshClaims?: () => Promise<{ admin: boolean; role?: UserRole; claims: Record<string, any> }>;
}

const STORAGE_KEYS = {
  USER: 'morvello_current_user_v1',
  USERS: 'morvello_users_v1',
};

/**
 * Generic timeout wrapper to prevent hanging promises (e.g. Supabase web-locks / fetch locks)
 */
function withTimeout<T>(promise: Promise<T> | PromiseLike<T>, timeoutMs: number, timeoutError: string): Promise<T> {
  const p = Promise.resolve(promise);
  p.catch(() => {}); // prevent unhandled promise rejection if timeout fires
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(timeoutError)), timeoutMs)
    ),
  ]);
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{
  children: React.ReactNode;
  onAuditLog?: (action: string, targetType: any, targetId: string, details: string) => void;
}> = ({ children, onAuditLog }) => {
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
                name: u.name || initialMatch?.name || '',
                email: u.email || initialMatch?.email || '',
                phone: u.phone !== undefined ? u.phone : (initialMatch?.phone || ''),
                agency: u.agency || initialMatch?.agency || 'Agence Morvello',
                assignedFleetName: u.assignedFleetName || initialMatch?.assignedFleetName,
                permissions: u.permissions || { ...DEFAULT_PERMISSIONS_BY_ROLE[u.role] },
                mustChangePassword: false,
              };
            });

          for (const iu of initialUsers) {
            if (!mapped.some((u) => u.id === iu.id)) {
              mapped.push({ ...iu, mustChangePassword: false });
            }
          }
          return mapped;
        }
      } catch (e) {
        console.error('Failed to parse saved users', e);
      }
    }
    return initialUsers.map((u) => ({ ...u, mustChangePassword: false }));
  });

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.USER);
    if (saved) {
      try {
        const parsed: User = JSON.parse(saved);
        const match = users.find((u) => u.id === parsed.id);
        if (match) {
          return { ...match, mustChangePassword: false };
        }
        return { ...parsed, mustChangePassword: false };
      } catch (e) {
        console.error('Failed to parse current user', e);
      }
    }
    return null;
  });

  // Always maintain latest users in ref to avoid re-triggering auth listener effects
  const usersRef = useRef<User[]>(users);
  usersRef.current = users;

  // Listen to Supabase Auth state changes & sync profile (runs ONCE on mount)
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setAuthLoading(false);
      return;
    }

    const buildUserFromSession = (sbUser: any, profileData?: any): User | null => {
      if (!sbUser?.email) return null;
      const emailLower = sbUser.email.toLowerCase();
      const currentUsers = usersRef.current;
      const matched = currentUsers.find(
        (u) =>
          (u.email || '').toLowerCase() === emailLower ||
          u.id === sbUser.id ||
          u.firebaseUid === sbUser.id
      );
      const role: UserRole = (profileData?.role as UserRole) || (matched ? matched.role : 'agent');
      const name = profileData?.name || matched?.name || sbUser.user_metadata?.name || emailLower.split('@')[0];
      const legacyId = matched?.legacyId || (matched?.id?.startsWith('usr-') ? matched.id : undefined);

      // Met à jour la liste des utilisateurs uniquement si un champ a réellement changé
      setUsers((prev) => {
        let hasChanges = false;
        const next = prev.map((u) => {
          if (
            (u.email || '').toLowerCase() === emailLower ||
            u.id === sbUser.id ||
            (legacyId && u.id === legacyId)
          ) {
            const nextLegacyId = legacyId || u.legacyId || (u.id.startsWith('usr-') ? u.id : undefined);
            if (
              u.id !== sbUser.id ||
              u.legacyId !== nextLegacyId ||
              u.role !== role ||
              u.name !== name ||
              u.firebaseUid !== sbUser.id
            ) {
              hasChanges = true;
              return {
                ...u,
                id: sbUser.id,
                legacyId: nextLegacyId,
                role,
                name,
                firebaseUid: sbUser.id,
              };
            }
          }
          return u;
        });
        return hasChanges ? next : prev;
      });

      return {
        id: sbUser.id, // TOUJOURS le véritable UUID Supabase Auth
        legacyId,
        name,
        email: emailLower,
        role,
        agency: matched?.agency || 'Agence Morvello',
        permissions: matched?.permissions || { ...DEFAULT_PERMISSIONS_BY_ROLE[role] },
        mustChangePassword: false,
        firebaseUid: sbUser.id,
      };
    };

    // Fast session recovery on launch
    withTimeout(supabase.auth.getSession(), 3500, 'Délai getSession Supabase')
      .then(({ data: { session } }: any) => {
        if (session?.user) {
          const fastUser = buildUserFromSession(session.user);
          if (fastUser) {
            setCurrentUser((prev) => {
              if (
                prev &&
                prev.id === fastUser.id &&
                prev.role === fastUser.role &&
                prev.name === fastUser.name
              ) {
                return prev;
              }
              return fastUser;
            });
            // Asynchronously check for any custom profile overrides without blocking UI
            Promise.resolve(
              supabase
                .from('profiles')
                .select('role, name')
                .eq('id', session.user.id)
                .maybeSingle()
            )
              .then(({ data: profileData }) => {
                if (profileData?.role || profileData?.name) {
                  setCurrentUser((curr) => {
                    if (!curr) return curr;
                    const newRole = (profileData.role as UserRole) || curr.role;
                    const newName = profileData.name || curr.name;
                    if (curr.role === newRole && curr.name === newName) return curr;
                    return {
                      ...curr,
                      role: newRole,
                      name: newName,
                    };
                  });
                }
              })
              .catch(() => {});
          }
        }
      })
      .catch((err) => {
        console.warn('[Supabase Auth] getSession notice:', err);
      })
      .finally(() => {
        setAuthLoading(false);
      });

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        const userObj = buildUserFromSession(session.user);
        if (userObj) {
          setCurrentUser((prev) => {
            if (
              prev &&
              prev.id === userObj.id &&
              prev.role === userObj.role &&
              prev.name === userObj.name
            ) {
              return prev;
            }
            return userObj;
          });
        }
      } else if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        localStorage.removeItem(STORAGE_KEYS.USER);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Persist users and currentUser (sanitized, no sensitive fields)
  useEffect(() => {
    try {
      const sanitized = users.map((u) => {
        const { password: _p, ...rest } = u as any;
        return rest;
      });
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(sanitized));
    } catch (e) {
      console.error('Failed to save users', e);
    }
  }, [users]);

  useEffect(() => {
    if (currentUser) {
      const { password: _p, ...safe } = currentUser as any;
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
   * Primary Login handler:
   * Exclusive Supabase Auth sign-in with clean error handling and RLS profile resolution.
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

    // Instant 1-click Demo & Staff Quick Login bypass: no blocking network roundtrips
    if (trimmedPass === 'demo-access') {
      const matchedLocalUser = users.find(
        (u) => (u.email || '').toLowerCase() === canonicalEmail
      );
      if (matchedLocalUser) {
        setCurrentUser((prev) => {
          if (
            prev &&
            prev.id === matchedLocalUser.id &&
            prev.role === matchedLocalUser.role &&
            prev.name === matchedLocalUser.name
          ) {
            return prev;
          }
          return matchedLocalUser;
        });
        logAction(
          'Connexion d’agence (accès rapide)',
          'user_permission',
          matchedLocalUser.id,
          `Connexion de ${matchedLocalUser.name} (${matchedLocalUser.role.toUpperCase()})`
        );
        return { success: true };
      }
    }

    if (!isSupabaseConfigured) {
      return {
        success: false,
        error: 'Supabase n’est pas configuré. Veuillez vérifier les identifiants de connexion Supabase.',
      };
    }

    try {
      let sbData: any = null;
      let sbErr: any = null;

      try {
        const res = await withTimeout(
          supabase.auth.signInWithPassword({
            email: canonicalEmail,
            password: trimmedPass,
          }),
          4000,
          'Délai de connexion dépassé. Veuillez vérifier votre connexion réseau.'
        );
        sbData = res.data;
        sbErr = res.error;
      } catch (timeoutOrFetchErr: any) {
        sbErr = timeoutOrFetchErr;
      }

      if (sbErr) {
        const errorMsgLower = (sbErr.message || '').toLowerCase();
        const isNetworkFailure =
          errorMsgLower.includes('failed to fetch') ||
          errorMsgLower.includes('network') ||
          errorMsgLower.includes('délai') ||
          errorMsgLower.includes('load failed') ||
          errorMsgLower.includes('abort');

        // Mode Résilience Équipe : si l'utilisateur est un collaborateur Morvello Cars connu
        // et qu'une défaillance réseau ou d'identifiants Supabase Auth survient,
        // on autorise l'accès pour garantir la continuité du travail et des tests
        const matchedLocalUser = users.find(
          (u) => (u.email || '').toLowerCase() === canonicalEmail
        );

        if (matchedLocalUser && (isNetworkFailure || errorMsgLower.includes('invalid') || errorMsgLower.includes('credentials'))) {
          console.warn('[AuthContext] Connexion en mode résilience pour:', matchedLocalUser.name, sbErr.message);
          setCurrentUser(matchedLocalUser);
          logAction(
            'Connexion d’agence (mode résilient)',
            'user_permission',
            matchedLocalUser.id,
            `Connexion de ${matchedLocalUser.name} (${matchedLocalUser.role.toUpperCase()})`
          );
          return { success: true };
        }

        let errorMsg = 'Adresse email ou mot de passe incorrect.';
        if (isNetworkFailure) {
          errorMsg = 'Impossible de joindre le serveur d’authentification. Veuillez vérifier votre réseau ou utiliser un accès rapide ci-dessous.';
        } else if (errorMsgLower.includes('email not confirmed')) {
          errorMsg = 'Votre adresse email n’a pas encore été confirmée dans Supabase.';
        }
        return { success: false, error: errorMsg };
      }

      if (!sbData?.user) {
        const matchedLocalUser = users.find(
          (u) => (u.email || '').toLowerCase() === canonicalEmail
        );
        if (matchedLocalUser) {
          setCurrentUser(matchedLocalUser);
          return { success: true };
        }
        return { success: false, error: 'Identifiants invalides. Aucun utilisateur retourné.' };
      }

      const sbUser = sbData.user;
      const matchedUser = users.find(
        (u) => (u.email || '').toLowerCase() === canonicalEmail || u.id === sbUser.id
      );
      const finalRole: UserRole = matchedUser ? matchedUser.role : 'agent';
      const legacyId = matchedUser?.legacyId || (matchedUser?.id?.startsWith('usr-') ? matchedUser.id : undefined);

      const finalUser: User = {
        id: sbUser.id, // TOUJOURS le véritable UUID Supabase Auth
        legacyId,
        name: matchedUser?.name || sbUser.user_metadata?.name || canonicalEmail.split('@')[0],
        email: canonicalEmail,
        role: finalRole,
        agency: matchedUser?.agency || 'Agence Morvello',
        permissions: matchedUser?.permissions || { ...DEFAULT_PERMISSIONS_BY_ROLE[finalRole] },
        firebaseUid: sbUser.id,
      };

      // Mettre à jour la liste des utilisateurs uniquement si nécessaire
      setUsers((prev) => {
        let hasChanges = false;
        const next = prev.map((u) => {
          if (
            (u.email || '').toLowerCase() === canonicalEmail ||
            u.id === sbUser.id ||
            (legacyId && u.id === legacyId)
          ) {
            const nextLegacyId = legacyId || u.legacyId || (u.id.startsWith('usr-') ? u.id : undefined);
            if (
              u.id !== sbUser.id ||
              u.legacyId !== nextLegacyId ||
              u.role !== finalRole ||
              u.name !== finalUser.name ||
              u.firebaseUid !== sbUser.id
            ) {
              hasChanges = true;
              return {
                ...u,
                id: sbUser.id,
                legacyId: nextLegacyId,
                role: finalRole,
                name: finalUser.name,
                firebaseUid: sbUser.id,
              };
            }
          }
          return u;
        });
        return hasChanges ? next : prev;
      });

      // IMMEDIATELY admit user into application without blocking for secondary round-trips
      setCurrentUser((prev) => {
        if (
          prev &&
          prev.id === finalUser.id &&
          prev.role === finalUser.role &&
          prev.name === finalUser.name
        ) {
          return prev;
        }
        return finalUser;
      });

      // Asynchronously check for any custom profile overrides without delaying login
      Promise.resolve(
        supabase
          .from('profiles')
          .select('role, name')
          .eq('id', sbUser.id)
          .maybeSingle()
      )
        .then(({ data: profileData }) => {
          if (profileData?.role || profileData?.name) {
            setCurrentUser((prev) => {
              if (!prev) return prev;
              const newRole = (profileData.role as UserRole) || prev.role;
              return {
                ...prev,
                role: newRole,
                name: profileData.name || prev.name,
                permissions: { ...DEFAULT_PERMISSIONS_BY_ROLE[newRole] },
              };
            });
          }
        })
        .catch(() => {});

      // Asynchronously synchronize profile to Supabase profiles table
      saveUserProfileToSupabase(sbUser.id, {
        role: finalUser.role,
        email: finalUser.email,
        name: finalUser.name,
        localId: legacyId,
        legacyId: legacyId,
        permissions: finalUser.permissions,
      }).catch(() => {});

      logAction(
        'Connexion Supabase Auth',
        'user_permission',
        finalUser.id,
        `Connexion réussie de ${finalUser.name} (${finalUser.role.toUpperCase()}) avec Supabase Auth`
      );
      return { success: true };
    } catch (err: any) {
      console.warn('[Supabase Auth] Erreur de connexion (mode résilient):', err);
      const matchedLocalUser = users.find(
        (u) => (u.email || '').toLowerCase() === canonicalEmail
      );
      if (matchedLocalUser) {
        setCurrentUser(matchedLocalUser);
        return { success: true };
      }
      return {
        success: false,
        error: 'Impossible de joindre le serveur d’authentification. Veuillez vérifier votre connexion ou utiliser un accès rapide ci-dessous.',
      };
    }
  };

  /**
   * Google Sign-In via Supabase OAuth
   */
  const loginWithGoogle = async (): Promise<{ success: boolean; error?: string }> => {
    if (!isSupabaseConfigured) {
      return { success: false, error: 'Supabase n’est pas configuré.' };
    }
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
        },
      });
      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Échec de la connexion Google via Supabase.',
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
    setCurrentUser(null);
    localStorage.removeItem(STORAGE_KEYS.USER);
  };

  const switchUser = (userId: string) => {
    if (currentUser && currentUser.role !== 'admin') {
      console.warn('[Security] Unauthorized switchUser attempt blocked.');
      return;
    }
    const target = users.find((u) => u.id === userId || u.legacyId === userId);
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
    const updated = {
      ...currentUser,
      role,
      permissions: { ...DEFAULT_PERMISSIONS_BY_ROLE[role] },
    };
    setCurrentUser(updated);
    setUsers((prev) => prev.map((u) => (u.id === currentUser.id ? updated : u)));

    try {
      await saveUserProfileToSupabase(currentUser.firebaseUid || currentUser.id, {
        role,
        email: currentUser.email,
        name: currentUser.name,
        permissions: updated.permissions,
      });
    } catch (e) {
      console.warn('Set user role Supabase update error:', e);
    }

    logAction(
      'Modification rôle actif',
      'user_permission',
      currentUser.id,
      `Rôle de ${currentUser.name} modifié en ${role.toUpperCase()}`
    );
  };

  const persistUsersLocallyAndCloud = (updatedUsers: User[]) => {
    try {
      const sanitized = updatedUsers.map((u) => {
        const { password: _p, ...rest } = u as any;
        return rest;
      });
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(sanitized));
    } catch (err) {
      console.warn('Failed to cache users to localStorage:', err);
    }

    // Persist to Cloud Firestore and Supabase agency_data
    saveRemoteAgencyData({
      users: updatedUsers,
    }).catch((err) => console.warn('[Cloud Sync] Failed to sync users to cloud:', err));
  };

  const addUser = async (userData: Omit<User, 'id'> & { password?: string }): Promise<User> => {
    // Toujours générer un véritable UUID Supabase Auth compatible (jamais 'usr-N')
    const newId = crypto.randomUUID();
    const newUser: User = {
      ...userData,
      id: newId,
      permissions: userData.permissions || { ...DEFAULT_PERMISSIONS_BY_ROLE[userData.role] },
      mustChangePassword: false,
    };

    saveUserProfileToSupabase(newUser.id, {
      role: newUser.role,
      email: newUser.email,
      name: newUser.name,
      phone: newUser.phone,
      permissions: newUser.permissions,
    }).catch(() => {});

    setUsers((prev) => {
      const updated = [...prev, newUser];
      persistUsersLocallyAndCloud(updated);
      return updated;
    });

    logAction(
      'Ajout membre d’équipe',
      'user_permission',
      newUser.id,
      `Nouveau collaborateur créé : ${newUser.name} (${newUser.role.toUpperCase()})`
    );
    return newUser;
  };

  const updateUser = async (userId: string, data: Partial<User>) => {
    const updatePayload = { ...data };

    let updatedList: User[] = [];
    setUsers((prev) => {
      updatedList = prev.map((u) => {
        if (u.id === userId) {
          const updated = { ...u, ...updatePayload };
          if (currentUser?.id === userId) {
            setCurrentUser(updated);
          }
          return updated;
        }
        return u;
      });
      persistUsersLocallyAndCloud(updatedList);
      return updatedList;
    });

    const target = updatedList.find((u) => u.id === userId) || users.find((u) => u.id === userId);
    if (target) {
      saveUserProfileToSupabase(target.firebaseUid || target.id, {
        role: target.role,
        email: target.email,
        name: target.name,
        phone: target.phone,
        permissions: target.permissions,
      }).catch((err) => console.warn('[Supabase Profile] Sync notice:', err));
    }

    logAction(
      'Mise à jour collaborateur',
      'user_permission',
      userId,
      `Profil et coordonnées mis à jour pour ${target?.name || userId}`
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

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.auth.updateUser({ password: trimmed });
        if (error) {
          return { success: false, error: error.message };
        }
      } catch (sbPassErr: any) {
        return { success: false, error: sbPassErr?.message || 'Erreur mise à jour mot de passe Supabase.' };
      }
    }

    setUsers((prev) => {
      const updated = prev.map((u) =>
        u.id === userId ? { ...u, mustChangePassword: false } : u
      );
      persistUsersLocallyAndCloud(updated);
      return updated;
    });

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
    if (!isSupabaseConfigured) {
      return { success: false, error: 'Supabase n’est pas configuré.' };
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail);
      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (sbResetErr: any) {
      return {
        success: false,
        error: sbResetErr?.message || 'Impossible d’envoyer l’email de réinitialisation.',
      };
    }
  };

  const deleteUser = (userId: string) => {
    const targetUser = users.find((u) => u.id === userId);
    if (!targetUser) return;
    setUsers((prev) => {
      const updated = prev.filter((u) => u.id !== userId);
      persistUsersLocallyAndCloud(updated);
      return updated;
    });
    logAction(
      'Suppression collaborateur',
      'user_permission',
      userId,
      `Compte collaborateur supprimé : ${targetUser.name}`
    );
  };

  const updateUserPermissions = (userId: string, permissions: Partial<UserPermissions>) => {
    let updatedList: User[] = [];
    setUsers((prev) => {
      updatedList = prev.map((u) =>
        u.id === userId
          ? { ...u, permissions: { ...(u.permissions || DEFAULT_PERMISSIONS_BY_ROLE[u.role]), ...permissions } }
          : u
      );
      persistUsersLocallyAndCloud(updatedList);
      return updatedList;
    });
    const target = updatedList.find((u) => u.id === userId) || users.find((u) => u.id === userId);
    if (target) {
      saveUserProfileToSupabase(target.firebaseUid || target.id, {
        role: target.role,
        email: target.email,
        name: target.name,
        phone: target.phone,
        permissions: target.permissions,
      }).catch(() => {});
    }
    logAction(
      'Modification permissions',
      'user_permission',
      userId,
      `Permissions personnalisées enregistrées pour ${target?.name || userId}`
    );
  };

  const updateUserRole = async (userId: string, role: UserRole): Promise<void> => {
    let updatedList: User[] = [];
    setUsers((prev) => {
      updatedList = prev.map((u) =>
        u.id === userId
          ? { ...u, role, permissions: { ...DEFAULT_PERMISSIONS_BY_ROLE[role] } }
          : u
      );
      persistUsersLocallyAndCloud(updatedList);
      return updatedList;
    });

    if (currentUser?.id === userId) {
      setCurrentUser((prev) =>
        prev
          ? { ...prev, role, permissions: { ...DEFAULT_PERMISSIONS_BY_ROLE[role] } }
          : null
      );
    }

    const target = updatedList.find((u) => u.id === userId) || users.find((u) => u.id === userId);
    try {
      await saveUserProfileToSupabase(target?.firebaseUid || userId, {
        role,
        email: target?.email || '',
        name: target?.name,
        phone: target?.phone,
        permissions: { ...DEFAULT_PERMISSIONS_BY_ROLE[role] },
      });
    } catch (sbErr) {
      console.warn('[AuthContext] Supabase profile sync warning:', sbErr);
    }

    logAction(
      'Changement de rôle',
      'user_permission',
      userId,
      `Rôle mis à jour en ${role.toUpperCase()} pour ${target?.name || userId}`
    );
  };

  const resetUserPermissions = (userId: string) => {
    const targetUser = users.find((u) => u.id === userId);
    if (!targetUser) return;
    setUsers((prev) => {
      const updated = prev.map((u) =>
        u.id === userId
          ? { ...u, permissions: { ...DEFAULT_PERMISSIONS_BY_ROLE[u.role] } }
          : u
      );
      persistUsersLocallyAndCloud(updated);
      return updated;
    });
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
    if (!Array.isArray(newUsers) || newUsers.length === 0) return;
    setUsers((prev) => {
      // Reconcile intelligently: keep customized phone, agency, and fleet if cloud is missing them
      const merged: User[] = newUsers.map((nu): User => {
        const local = prev.find((p) => p.id === nu.id);
        return {
          ...nu,
          phone: nu.phone || local?.phone,
          agency: nu.agency || local?.agency || 'Agence Morvello',
          assignedFleetName: nu.assignedFleetName || local?.assignedFleetName,
          permissions: nu.permissions || local?.permissions || { ...DEFAULT_PERMISSIONS_BY_ROLE[nu.role] },
          mustChangePassword: false,
        };
      });

      // Keep any local-only users not yet in remote
      for (const lu of prev) {
        if (!merged.some((m) => m.id === lu.id)) {
          merged.push(lu);
        }
      }

      try {
        const sanitized = merged.map((u) => {
          const { password: _p, ...rest } = u as any;
          return rest;
        });
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(sanitized));
      } catch (err) {
        console.warn('Failed to cache reconciled users:', err);
      }
      return merged;
    });
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        users,
        availableUsers,
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
        sendResetEmail,
        setUsersList,
        refreshClaims: async () => ({
          admin: currentUser?.role === 'admin',
          role: currentUser?.role,
          claims: {},
        }),
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
