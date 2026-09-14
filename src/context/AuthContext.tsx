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
  sendResetEmail: (email: string) => Promise<{ success: boolean; error?: string }>;
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

  // Listen to Firebase Authentication state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      setFirebaseUser(fbUser);
      setAuthLoading(false);

      if (fbUser && fbUser.email) {
        const emailLower = fbUser.email.toLowerCase();
        // Check if Google/Firebase user matches Gérant Anouar or a team member
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
              return {
                ...matched,
                firebaseUid: fbUser.uid,
                authProvider: fbUser.providerData?.[0]?.providerId === 'google.com' ? 'google' : 'password',
              };
            }
            return { ...prev, firebaseUid: fbUser.uid };
          });
        }
      } else if (!fbUser) {
        // Logged out
        setCurrentUser(null);
        localStorage.removeItem(STORAGE_KEYS.USER);
      }
    });

    return () => unsubscribe();
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
   * Native Firebase Auth Login:
   * Identity verification handled 100% on Google Firebase Auth servers.
   * No password hashes stored or checked client-side.
   * No client-side createUserWithEmailAndPassword from public login form.
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
      if (canonicalEmail === 'anouar') canonicalEmail = 'anouar@morvellocars.com';
      else canonicalEmail = `${canonicalEmail}@morvellocars.com`;
    }

    try {
      // 1. Native Firebase Auth sign-in
      const cred = await signInWithEmailAndPassword(auth, canonicalEmail, trimmedPass);
      const fbUser = cred.user;

      // 2. Identify application team user
      const matchedUser =
        users.find((u) => {
          const uEmail = u.email.toLowerCase();
          return (
            uEmail === canonicalEmail ||
            (u.role === 'admin' &&
              (canonicalEmail.startsWith('anouar') || canonicalEmail === 'anouar7fac@gmail.com'))
          );
        }) || {
          id: `usr-${Date.now()}`,
          name: canonicalEmail.split('@')[0],
          email: canonicalEmail,
          role: 'manager' as UserRole,
          agency: 'Agence Morvello',
          permissions: { ...DEFAULT_PERMISSIONS_BY_ROLE.manager },
        };

      const finalUser: User = {
        ...matchedUser,
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
      if (
        code === 'auth/invalid-credential' ||
        code === 'auth/wrong-password' ||
        code === 'auth/user-not-found' ||
        code === 'auth/invalid-email'
      ) {
        return {
          success: false,
          error: 'Identifiants invalides. Vérifiez votre email et mot de passe Firebase Auth.',
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

      return {
        success: false,
        error: fbErr?.message || 'Erreur lors de la connexion avec Firebase Auth.',
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

      // Link to Gérant or team account
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
    const newUser: User = {
      ...userData,
      id: `usr-${Date.now()}`,
      permissions: userData.permissions || { ...DEFAULT_PERMISSIONS_BY_ROLE[userData.role] },
      mustChangePassword: true,
    };
    delete (newUser as any).password;
    delete (newUser as any).passwordSalt;
    delete (newUser as any).passwordHash;

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
    if (!newPassword || newPassword.trim().length < 6) {
      return { success: false, error: 'Le mot de passe doit contenir au moins 6 caractères.' };
    }
    try {
      // If current Firebase Auth session matches, update native password directly
      if (auth.currentUser) {
        await updatePassword(auth.currentUser, newPassword.trim());
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
    } catch (e: any) {
      if (e?.code === 'auth/requires-recent-login') {
        return {
          success: false,
          error: 'Sécurité : Veuillez vous reconnecter avant de modifier votre mot de passe.',
        };
      }
      return { success: false, error: e?.message || 'Erreur lors de la mise à jour du mot de passe' };
    }
  };

  const sendResetEmail = async (email: string): Promise<{ success: boolean; error?: string }> => {
    try {
      await sendPasswordResetEmail(auth, email.trim().toLowerCase());
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
        sendResetEmail,
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

