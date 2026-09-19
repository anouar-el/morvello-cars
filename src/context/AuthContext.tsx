import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  User,
  UserRole,
  UserPermissions,
  DEFAULT_PERMISSIONS_BY_ROLE,
} from '../types';
import { initialUsers } from '../data/mockData';
import { saveUserProfileToSupabase } from '../lib/supabaseSync';
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
  return Promise.race([
    Promise.resolve(promise),
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
                name: initialMatch?.name || u.name,
                email: initialMatch?.email || u.email,
                phone: u.phone || initialMatch?.phone,
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

  // Listen to Supabase Auth state changes & sync profile
  useEffect(() => {
    if (!isSupabaseConfigured) {
      setAuthLoading(false);
      return;
    }

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
        mustChangePassword: false,
        firebaseUid: sbUser.id,
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
      })
      .finally(() => {
        setAuthLoading(false);
      });

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const userObj = await resolveSupabaseProfile(session.user);
        if (userObj) {
          setCurrentUser(userObj);
        }
      } else if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        localStorage.removeItem(STORAGE_KEYS.USER);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [users]);

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

    if (!isSupabaseConfigured) {
      return {
        success: false,
        error: 'Supabase n’est pas configuré. Veuillez vérifier les identifiants de connexion Supabase.',
      };
    }

    try {
      const { data: sbData, error: sbErr } = await withTimeout(
        supabase.auth.signInWithPassword({
          email: canonicalEmail,
          password: trimmedPass,
        }),
        10000,
        'Délai de connexion dépassé. Veuillez vérifier votre connexion réseau.'
      );

      if (sbErr) {
        let errorMsg = sbErr.message || 'Identifiants invalides.';
        const lower = errorMsg.toLowerCase();
        if (
          lower.includes('invalid login credentials') ||
          lower.includes('invalid_grant') ||
          lower.includes('invalid credentials')
        ) {
          errorMsg = 'Adresse email ou mot de passe incorrect.';
        } else if (lower.includes('email not confirmed')) {
          errorMsg = 'Votre adresse email n’a pas encore été confirmée dans Supabase.';
        }
        return { success: false, error: errorMsg };
      }

      if (!sbData?.user) {
        return { success: false, error: 'Identifiants invalides. Aucun utilisateur retourné.' };
      }

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
      };

      // Synchronize profile to Supabase profiles table
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
    } catch (err: any) {
      console.error('[Supabase Auth] Erreur de connexion:', err);
      return {
        success: false,
        error: err?.message || 'Erreur lors de la connexion à Supabase Auth.',
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

  const addUser = async (userData: Omit<User, 'id'> & { password?: string }): Promise<User> => {
    const newId = `usr-${Date.now().toString(36)}`;
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
      permissions: newUser.permissions,
    }).catch(() => {});

    setUsers((prev) => [...prev, newUser]);
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

    try {
      await saveUserProfileToSupabase(target?.firebaseUid || userId, {
        role,
        email: target?.email || '',
        name: target?.name,
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
