import { doc, getDoc, setDoc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from './firebase';
import { handleFirestoreError, OperationType } from './firestoreErrors';
import { isAbortException } from '../initErrorHandling';
import {
  Client,
  Driver,
  Vehicle,
  Contract,
  CompanySettings,
  AuditLog,
  User,
  TermsVersion,
  DepositRecord,
  AiAssistantSettings,
} from '../types';

export interface MorvelloCloudData {
  clients?: Client[];
  drivers?: Driver[];
  vehicles?: Vehicle[];
  contracts?: Contract[];
  deposits?: DepositRecord[];
  companySettings?: CompanySettings;
  aiSettings?: AiAssistantSettings;
  termsVersion?: TermsVersion;
  users?: User[];
  auditLogs?: AuditLog[];
  updatedAt?: string;
  updatedBy?: string;
}

// Single primary company document collection in Firestore
const APP_DOC_PATH = { collection: 'agencies', docId: 'morvello_main' };

/**
 * Recursively removes all `undefined` values from objects and arrays.
 * Firestore strictly rejects `undefined` with:
 * "Unsupported field value: undefined"
 */
export function sanitizeForFirestore<T>(val: T): T {
  if (val === undefined) {
    return null as unknown as T;
  }
  if (val === null || typeof val !== 'object') {
    return val;
  }
  if (Array.isArray(val)) {
    return val
      .filter((item) => item !== undefined)
      .map((item) => sanitizeForFirestore(item)) as unknown as T;
  }
  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(val as Record<string, any>)) {
    if (value !== undefined) {
      cleaned[key] = sanitizeForFirestore(value);
    }
  }
  return cleaned as T;
}

export async function fetchRemoteAgencyData(): Promise<MorvelloCloudData | null> {
  const fullPath = `${APP_DOC_PATH.collection}/${APP_DOC_PATH.docId}`;
  try {
    if (typeof auth.authStateReady === 'function') {
      await auth.authStateReady();
    }
    if (!auth.currentUser || auth.currentUser.isAnonymous) {
      return null;
    }
    const docRef = doc(db, APP_DOC_PATH.collection, APP_DOC_PATH.docId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as MorvelloCloudData;
    }
    return null;
  } catch (error: any) {
    if (isAbortException(error)) {
      return null;
    }
    if (error?.code === 'permission-denied' && auth.currentUser && !auth.currentUser.isAnonymous) {
      handleFirestoreError(error, OperationType.GET, fullPath);
    }
    return null;
  }
}

export async function saveRemoteAgencyData(data: Partial<MorvelloCloudData>): Promise<boolean> {
  const fullPath = `${APP_DOC_PATH.collection}/${APP_DOC_PATH.docId}`;
  try {
    if (typeof auth.authStateReady === 'function') {
      await auth.authStateReady();
    }
    if (!auth.currentUser || auth.currentUser.isAnonymous) {
      return false;
    }
    const docRef = doc(db, APP_DOC_PATH.collection, APP_DOC_PATH.docId);
    const rawPayload = {
      ...data,
      updatedAt: new Date().toISOString(),
    };
    const sanitizedPayload = sanitizeForFirestore(rawPayload);
    await setDoc(docRef, sanitizedPayload, { merge: true });
    return true;
  } catch (error: any) {
    if (isAbortException(error)) {
      return false;
    }
    if (error?.code === 'permission-denied' && auth.currentUser && !auth.currentUser.isAnonymous) {
      handleFirestoreError(error, OperationType.WRITE, fullPath);
    }
    return false;
  }
}

/**
 * Real-time listener for multi-workstation agency data synchronization
 */
export function subscribeToRemoteAgencyData(
  onData: (data: MorvelloCloudData) => void,
  onError?: (err: any) => void
): Unsubscribe {
  const fullPath = `${APP_DOC_PATH.collection}/${APP_DOC_PATH.docId}`;
  const docRef = doc(db, APP_DOC_PATH.collection, APP_DOC_PATH.docId);

  let snapshotUnsub: Unsubscribe | null = null;
  let isDisposed = false;

  const authUnsub = onAuthStateChanged(auth, (user) => {
    if (isDisposed) return;

    if (snapshotUnsub) {
      snapshotUnsub();
      snapshotUnsub = null;
    }

    if (!user || user.isAnonymous) {
      return;
    }

    try {
      snapshotUnsub = onSnapshot(
        docRef,
        (snap) => {
          if (isDisposed) return;
          if (snap.exists()) {
            onData(snap.data() as MorvelloCloudData);
          }
        },
        (error) => {
          if (isDisposed || isAbortException(error)) {
            return;
          }
          if (error?.code === 'permission-denied' && auth.currentUser && !auth.currentUser.isAnonymous) {
            handleFirestoreError(error, OperationType.GET, fullPath);
          }
          if (onError) {
            onError(error);
          }
        }
      );
    } catch (err: any) {
      if (!isDisposed && !isAbortException(err) && onError) {
        onError(err);
      }
    }
  });

  return () => {
    isDisposed = true;
    authUnsub();
    if (snapshotUnsub) {
      snapshotUnsub();
      snapshotUnsub = null;
    }
  };
}

/**
 * Sync individual user profile and RBAC role in Firestore /users/{uid}
 */
export async function saveUserProfile(
  uid: string,
  profile: { role: string; email: string; name?: string }
): Promise<boolean> {
  const fullPath = `users/${uid}`;
  try {
    const docRef = doc(db, 'users', uid);
    await setDoc(
      docRef,
      sanitizeForFirestore({
        uid,
        ...profile,
        updatedAt: new Date().toISOString(),
      }),
      { merge: true }
    );
    return true;
  } catch (err: any) {
    if (isAbortException(err)) {
      return false;
    }
    if (err?.code === 'permission-denied' && auth.currentUser) {
      handleFirestoreError(err, OperationType.WRITE, fullPath);
    }
    return false;
  }
}
