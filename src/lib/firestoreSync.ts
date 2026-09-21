import { doc, getDoc, setDoc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from './firebase';
import { handleFirestoreError, OperationType } from './firestoreErrors';
import { isAbortException } from '../initErrorHandling';
import {
  isSupabaseConfigured,
  supabase,
} from './supabase';
import {
  fetchRemoteAgencyDataFromSupabase,
  saveRemoteAgencyDataToSupabase,
  subscribeToRemoteAgencyDataFromSupabase,
  saveUserProfileToSupabase,
} from './supabaseSync';
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

  // 1. Primary: Fetch from Firebase Cloud Firestore
  try {
    const docRef = doc(db, APP_DOC_PATH.collection, APP_DOC_PATH.docId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as MorvelloCloudData;
      // If Firestore contains agency data, return it directly
      if (data && (data.contracts?.length || data.clients?.length || data.vehicles?.length || data.companySettings)) {
        return data;
      }
    }
  } catch (error: any) {
    if (!isAbortException(error)) {
      console.warn('[Firestore] Fetch warning:', error?.message || error);
    }
  }

  // 2. Secondary / Backup: Attempt fetch from Supabase PostgreSQL if available
  if (isSupabaseConfigured) {
    try {
      const supabaseData = await fetchRemoteAgencyDataFromSupabase();
      if (supabaseData) {
        return supabaseData;
      }
    } catch (sbErr) {
      if (!isAbortException(sbErr)) {
        console.warn('[Data Sync] Supabase fetch error:', sbErr);
      }
    }
  }

  return null;
}

export async function saveRemoteAgencyData(data: Partial<MorvelloCloudData>): Promise<boolean> {
  let firestoreSuccess = false;
  let supabaseSuccess = false;
  const fullPath = `${APP_DOC_PATH.collection}/${APP_DOC_PATH.docId}`;

  // 1. Primary: Save to Firebase Cloud Firestore
  try {
    const docRef = doc(db, APP_DOC_PATH.collection, APP_DOC_PATH.docId);
    const rawPayload = {
      ...data,
      updatedAt: new Date().toISOString(),
    };
    const sanitizedPayload = sanitizeForFirestore(rawPayload);
    await setDoc(docRef, sanitizedPayload, { merge: true });
    firestoreSuccess = true;
  } catch (error: any) {
    if (!isAbortException(error)) {
      console.error('[Firestore] Save error:', error);
      if (error?.code === 'permission-denied' && auth.currentUser) {
        handleFirestoreError(error, OperationType.WRITE, fullPath);
      }
    }
  }

  // 2. Secondary / Mirror: Save to Supabase PostgreSQL if configured
  if (isSupabaseConfigured) {
    try {
      supabaseSuccess = await saveRemoteAgencyDataToSupabase(data, auth.currentUser?.uid);
    } catch (sbErr) {
      console.warn('[Data Sync] Supabase save error:', sbErr);
    }
  }

  return firestoreSuccess || supabaseSuccess;
}

/**
 * Real-time listener for multi-workstation agency data synchronization
 * Subscribes directly to Firestore onSnapshot and Supabase Realtime channel
 */
export function subscribeToRemoteAgencyData(
  onData: (data: MorvelloCloudData) => void,
  onError?: (err: any) => void
): Unsubscribe {
  let isDisposed = false;
  const fullPath = `${APP_DOC_PATH.collection}/${APP_DOC_PATH.docId}`;
  const docRef = doc(db, APP_DOC_PATH.collection, APP_DOC_PATH.docId);

  // 1. Direct Firestore Snapshot Subscription
  let snapshotUnsub: Unsubscribe | null = null;
  try {
    snapshotUnsub = onSnapshot(
      docRef,
      (snap) => {
        if (isDisposed) return;
        if (snap.exists()) {
          const cloudData = snap.data() as MorvelloCloudData;
          if (cloudData && (cloudData.contracts || cloudData.clients || cloudData.vehicles)) {
            onData(cloudData);
          }
        }
      },
      (error) => {
        if (isDisposed || isAbortException(error)) return;
        console.warn('[Firestore Realtime] notice:', error?.message || error);
        if (onError) onError(error);
      }
    );
  } catch (err: any) {
    if (!isDisposed && !isAbortException(err) && onError) onError(err);
  }

  // 2. Supabase Realtime Subscription (parallel sync)
  const unsubscribeSupabase = subscribeToRemoteAgencyDataFromSupabase(
    (data) => {
      if (!isDisposed) {
        onData(data);
      }
    },
    (err) => {
      if (!isDisposed && onError) onError(err);
    }
  );

  return () => {
    isDisposed = true;
    if (snapshotUnsub) {
      snapshotUnsub();
      snapshotUnsub = null;
    }
    unsubscribeSupabase();
  };
}

/**
 * Sync individual user profile and RBAC role in Supabase profiles & Firestore /users/{uid}
 */
export async function saveUserProfile(
  uid: string,
  profile: { role: string; email: string; name?: string; phone?: string; permissions?: any }
): Promise<boolean> {
  // 1. Supabase Profiles
  if (isSupabaseConfigured) {
    saveUserProfileToSupabase(uid, profile).catch((e) =>
      console.warn('[Supabase Profile] update notice:', e)
    );
  }

  // 2. Firestore Users
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

