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
  signInAnonymously,
  User as FirebaseUser,
} from 'firebase/auth';
import { hashPassword, generateSalt, verifyPassword } from '../utils/cryptoAuth';

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
  updateUserRole: (userId: string, role: UserRole) => void;
  resetUserPermissions: (userId: string) => void;
  hasPermission: (perm: keyof UserPermissions) => boolean;
  changeUserPassword: (userId: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  setUsersList: (users: User[]) => void;
}

const STORAGE_KEYS = {
  USER: 'morvello_current_user_v1',
  USERS: 'morvello_users_v1',
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
                passwordSalt: u.passwordSalt || initialMatch?.passwordSalt,
                passwordHash: u.passwordHash || initialMatch?.passwordHash,
                permissions: u.permissions || { ...DEFAULT_PERMISSIONS_BY_ROLE[u.role] },
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
        return match || users.find((u) => u.role === 'admin') || users[0] || null;
      } catch (e) {
        console.error('Failed to parse current user', e);
      }
    }
    // Default to Gérant if local storage empty
    return users.find((u) => u.role === 'admin') || users[0] || null;
  });

  // Listen to Firebase Authentication state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      setFirebaseUser(fbUser);
      setAuthLoading(false);

      if (fbUser && fbUser.email) {
        const emailLower = fbUser.email.toLowerCase();
        // Check if Google user matches Gérant Anouar or a team member
        const matched = users.find(
          (u) =>
            u.email.toLowerCase() === emailLower ||
            (u.role === 'admin' &&
              (emailLower === 'anouar7fac@gmail.com' ||
                emailLower === 'anouar@morvellocars.com' ||
                emailLower.startsWith('anouar')))
        );

        if (matched) {
          setCurrentUser((prev) => {
            if (!prev || prev.id !== matched.id) {
              return { ...matched, firebaseUid: fbUser.uid, authProvider: 'google' };
            }
            return { ...prev, firebaseUid: fbUser.uid };
          });
        }
      }
    });

    return () => unsubscribe();
  }, [users]);

  // Persist users and currentUser
  useEffect(() => {
    try {
      // Strip plaintext passwords if any before writing to localStorage
      const sanitized = users.map((u) => {
        const { password: _p, ...rest } = u;
        return rest;
      });
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(sanitized));
    } catch (e) {
      console.error('Failed to save users', e);
    }
  }, [users]);

  useEffect(() => {
    if (currentUser) {
      const { password: _p, ...safe } = currentUser;
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
   * Secure Login: calls backend endpoint to verify credentials with server-side PBKDF2,
   * then establishes an authenticated session in Firebase Auth to unlock Firestore rules.
   */
  const login = async (
    email: string,
    pass: string
  ): Promise<{ success: boolean; error?: string }> => {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPass = pass.trim();

    try {
      // 1. Try server backend authentication endpoint
      let backendSuccess = false;
      let authenticatedUser: User | null = null;

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: trimmedEmail, password: trimmedPass, users }),
        });
        const data = await res.json();
        if (data.success && data.user) {
          backendSuccess = true;
          authenticatedUser = data.user;
        } else if (res.status === 401) {
          return { success: false, error: data.error || 'Identifiants invalides.' };
        }
      } catch (networkErr) {
        console.warn('Backend auth endpoint unreachable, falling back to local cryptographic verification:', networkErr);
      }

      // 2. Fallback to client-side PBKDF2 hash verification if backend offline
      if (!backendSuccess) {
        const targetUser = users.find((u) => {
          const uEmail = u.email.toLowerCase();
          if (uEmail === trimmedEmail) return true;
          if (u.id === 'usr-1' || u.role === 'admin') {
            if (
              trimmedEmail === 'anouar7fac@gmail.com' ||
              trimmedEmail === 'anouar@morvellocars.com' ||
              trimmedEmail === 'anouar'
            ) {
              return true;
            }
          }
          return false;
        });

        if (!targetUser) {
          return { success: false, error: 'Aucun compte collaborateur trouvé avec cet e-mail.' };
        }

        const isMatch = await verifyPassword(
          trimmedPass,
          targetUser.passwordHash || '',
          targetUser.passwordSalt
        );

        if (!isMatch) {
          return { success: false, error: 'Mot de passe incorrect pour ce compte.' };
        }

        authenticatedUser = targetUser;
      }

      if (!authenticatedUser) {
        return { success: false, error: 'Impossible de valider la session.' };
      }

      // 3. Ensure Firebase Auth session is active so Firestore rules (request.auth != null) allow access
      if (!auth.currentUser) {
        try {
          await signInAnonymously(auth);
        } catch (fbAuthErr) {
          console.warn('Firebase Auth anonymous bridge note:', fbAuthErr);
        }
      }

      setCurrentUser(authenticatedUser);
      logAction(
        'Connexion',
        'user_permission',
        authenticatedUser.id,
        `Connexion réussie de ${authenticatedUser.name} (${authenticatedUser.role.toUpperCase()})`
      );

      return { success: true };
    } catch (err: any) {
      console.error('Login process error:', err);
      return { success: false, error: err.message || 'Erreur inattendue lors de la connexion' };
    }
  };

  /**
   * Google Sign-In with Firebase Auth
   */
  const loginWithGoogle = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const fbUser = result.user;
      const userEmail = fbUser.email?.toLowerCase() || '';

      // Link to Gérant or member account
      const matched = users.find(
        (u) =>
          u.email.toLowerCase() === userEmail ||
          (u.role === 'admin' &&
            (userEmail === 'anouar7fac@gmail.com' ||
              userEmail === 'anouar@morvellocars.com' ||
              userEmail.startsWith('anouar')))
      );

      const targetUser =
        matched ||
        users.find((u) => u.role === 'admin') || {
          id: `usr-google-${Date.now()}`,
          name: fbUser.displayName || 'Gérant Morvello',
          email: userEmail,
          role: 'admin' as UserRole,
          agency: 'Siège & Direction Générale',
          permissions: { ...DEFAULT_PERMISSIONS_BY_ROLE.admin },
        };

      const finalUser: User = {
        ...targetUser,
        firebaseUid: fbUser.uid,
        authProvider: 'google',
      };

      setCurrentUser(finalUser);
      logAction(
        'Connexion Google Firebase',
        'user_permission',
        finalUser.id,
        `Connexion Google réussie : ${fbUser.displayName || finalUser.name} (${userEmail})`
      );

      return { success: true };
    } catch (error: any) {
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
    try {
      await signOut(auth);
    } catch (e) {
      console.warn('Sign out warning:', e);
    }
    setCurrentUser(null);
    localStorage.removeItem(STORAGE_KEYS.USER);
  };

  const switchUser = (userId: string) => {
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

  const setCurrentUserRole = (role: UserRole) => {
    if (!currentUser) return;
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
    const salt = generateSalt();
    const plainPwd = userData.password || 'Morvello#2026';
    const hash = await hashPassword(plainPwd, salt);

    const newUser: User = {
      ...userData,
      passwordSalt: salt,
      passwordHash: hash,
      id: `usr-${Date.now()}`,
      permissions: userData.permissions || { ...DEFAULT_PERMISSIONS_BY_ROLE[userData.role] },
    };

    setUsers((prev) => [...prev, newUser]);
    logAction(
      'Ajout membre d’équipe',
      'user_permission',
      newUser.id,
      `Nouveau collaborateur créé : ${newUser.name} (${newUser.role.toUpperCase()}) avec identifiants sécurisés`
    );
    return newUser;
  };

  const updateUser = async (userId: string, data: Partial<User>) => {
    let updatePayload = { ...data };
    // If password was updated, securely compute new salt & hash
    if (data.password) {
      const salt = generateSalt();
      const hash = await hashPassword(data.password, salt);
      updatePayload.passwordSalt = salt;
      updatePayload.passwordHash = hash;
      delete updatePayload.password;
    }

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
    if (!newPassword || newPassword.trim().length < 6) {
      return { success: false, error: 'Le mot de passe doit contenir au moins 6 caractères.' };
    }
    try {
      const salt = generateSalt();
      const hash = await hashPassword(newPassword.trim(), salt);
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, passwordSalt: salt, passwordHash: hash } : u
        )
      );
      logAction(
        'Modification mot de passe',
        'user_permission',
        userId,
        `Mot de passe mis à jour et chiffré pour l’utilisateur #${userId}`
      );
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message || 'Erreur lors du hachage du mot de passe' };
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

  const updateUserRole = (userId: string, role: UserRole) => {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId
          ? { ...u, role, permissions: { ...DEFAULT_PERMISSIONS_BY_ROLE[role] } }
          : u
      )
    );
    const target = users.find((u) => u.id === userId);
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
        setUsersList,
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
