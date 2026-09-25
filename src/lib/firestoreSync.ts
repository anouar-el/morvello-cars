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

// Primary company document collections in Firestore
const APP_DOC_PATH = { collection: 'agencies', docId: 'morvello_main' };
const CLIENTS_DOC_PATH = { collection: 'agencies', docId: 'morvello_clients' };

/**
 * Optimise les snapshots de contrat pour Firestore en évitant la duplication
 * redondante d'images base64 de plusieurs centaines de kilo-octets déjà stockées sur la fiche client.
 */
function optimizeContractsForFirestore(contracts?: Contract[]): Contract[] | undefined {
  if (!contracts) return undefined;
  return contracts.map((c) => {
    if (c.clientSnapshot && (
      (c.clientSnapshot.cinDocUrl && c.clientSnapshot.cinDocUrl.length > 1000) ||
      (c.clientSnapshot.licenseDocUrl && c.clientSnapshot.licenseDocUrl.length > 1000)
    )) {
      return {
        ...c,
        clientSnapshot: {
          ...c.clientSnapshot,
          cinDocUrl: c.clientSnapshot.cinDocUrl ? 'archived' : '',
          cinDocVersoUrl: c.clientSnapshot.cinDocVersoUrl ? 'archived' : '',
          licenseDocUrl: c.clientSnapshot.licenseDocUrl ? 'archived' : '',
          licenseDocVersoUrl: c.clientSnapshot.licenseDocVersoUrl ? 'archived' : '',
        },
      };
    }
    return c;
  });
}

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
  // 1. Primary: Fetch from Firebase Cloud Firestore (morvello_main + morvello_clients)
  // Only execute when user is authenticated in Firebase Auth
  if (auth.currentUser) {
    try {
      const mainDocRef = doc(db, APP_DOC_PATH.collection, APP_DOC_PATH.docId);
      const clientsDocRef = doc(db, CLIENTS_DOC_PATH.collection, CLIENTS_DOC_PATH.docId);

      const [mainSnapResult, clientsSnapResult] = await Promise.allSettled([
        getDoc(mainDocRef),
        getDoc(clientsDocRef),
      ]);

      let data: MorvelloCloudData | null = null;

      if (mainSnapResult.status === 'fulfilled' && mainSnapResult.value.exists()) {
        data = mainSnapResult.value.data() as MorvelloCloudData;
      }

      if (clientsSnapResult.status === 'fulfilled' && clientsSnapResult.value.exists()) {
        const clientsData = clientsSnapResult.value.data() as { clients?: Client[] };
        if (clientsData?.clients && clientsData.clients.length > 0) {
          if (!data) {
            data = { clients: clientsData.clients };
          } else {
            // Merge clients seamlessly
            const merged = [...(data.clients || [])];
            for (const cli of clientsData.clients) {
              const exists = merged.some(
                (m) =>
                  m.id === cli.id ||
                  (m.docNumber && cli.docNumber && m.docNumber.trim().toUpperCase() === cli.docNumber.trim().toUpperCase())
              );
              if (!exists) {
                merged.push(cli);
              }
            }
            data.clients = merged;
          }
        }
      }

      if (data && (data.contracts?.length || data.clients?.length || data.vehicles?.length || data.companySettings)) {
        return data;
      }
    } catch (error: any) {
      if (!isAbortException(error)) {
        if (error?.code === 'permission-denied') {
          handleFirestoreError(error, OperationType.GET, `${APP_DOC_PATH.collection}/${APP_DOC_PATH.docId}`);
        } else {
          console.warn('[Firestore] Fetch warning:', error?.message || error);
        }
      }
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
  // Only attempt when authenticated in Firebase Auth to prevent unauthorized permission-denied errors
  if (auth.currentUser) {
    try {
      const mainDocRef = doc(db, APP_DOC_PATH.collection, APP_DOC_PATH.docId);

      // 1a. If clients are provided, also persist them to dedicated morvello_clients document
      // to safeguard against Firestore's 1MB single-document limit
      if (data.clients && data.clients.length > 0) {
        try {
          const clientsDocRef = doc(db, CLIENTS_DOC_PATH.collection, CLIENTS_DOC_PATH.docId);
          await setDoc(
            clientsDocRef,
            sanitizeForFirestore({
              clients: data.clients,
              updatedAt: new Date().toISOString(),
            }),
            { merge: true }
          );
        } catch (cliErr: any) {
          console.warn('[Firestore] Notice saving morvello_clients:', cliErr?.message || cliErr);
        }
      }

      // 1b. Prepare payload for morvello_main with optimized contract snapshots
      const optimizedPayload = {
        ...data,
        contracts: optimizeContractsForFirestore(data.contracts),
        updatedAt: new Date().toISOString(),
      };

      const sanitizedPayload = sanitizeForFirestore(optimizedPayload);
      await setDoc(mainDocRef, sanitizedPayload, { merge: true });
      firestoreSuccess = true;
    } catch (error: any) {
      if (!isAbortException(error)) {
        if (error?.code === 'permission-denied') {
          handleFirestoreError(error, OperationType.WRITE, fullPath);
        } else {
          console.warn('[Firestore] Save notice:', error?.message || error);
        }
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
  let mainUnsub: Unsubscribe | null = null;
  let clientsUnsub: Unsubscribe | null = null;

  const startFirestoreListeners = () => {
    if (isDisposed || !auth.currentUser) return;
    const mainDocRef = doc(db, APP_DOC_PATH.collection, APP_DOC_PATH.docId);
    const clientsDocRef = doc(db, CLIENTS_DOC_PATH.collection, CLIENTS_DOC_PATH.docId);

    try {
      mainUnsub = onSnapshot(
        mainDocRef,
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
          if (error?.code === 'permission-denied' && auth.currentUser) {
            handleFirestoreError(error, OperationType.GET, `${APP_DOC_PATH.collection}/${APP_DOC_PATH.docId}`);
          } else {
            console.warn('[Firestore Realtime] notice:', error?.message || error);
          }
          if (onError) onError(error);
        }
      );
    } catch (err: any) {
      if (!isDisposed && !isAbortException(err) && onError) onError(err);
    }

    try {
      clientsUnsub = onSnapshot(
        clientsDocRef,
        (snap) => {
          if (isDisposed) return;
          if (snap.exists()) {
            const cData = snap.data() as { clients?: Client[] };
            if (cData && cData.clients && cData.clients.length > 0) {
              onData({ clients: cData.clients });
            }
          }
        },
        (error) => {
          if (isDisposed || isAbortException(error)) return;
          if (error?.code === 'permission-denied' && auth.currentUser) {
            handleFirestoreError(error, OperationType.GET, `${CLIENTS_DOC_PATH.collection}/${CLIENTS_DOC_PATH.docId}`);
          }
        }
      );
    } catch (err: any) {
      // Non-blocking
    }
  };

  if (auth.currentUser) {
    startFirestoreListeners();
  }

  // Dynamic attachment on auth change
  const authUnsub = onAuthStateChanged(auth, (user) => {
    if (isDisposed) return;
    if (user) {
      if (!mainUnsub) {
        startFirestoreListeners();
      }
    } else {
      if (mainUnsub) {
        mainUnsub();
        mainUnsub = null;
      }
      if (clientsUnsub) {
        clientsUnsub();
        clientsUnsub = null;
      }
    }
  });

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
    authUnsub();
    if (mainUnsub) {
      mainUnsub();
      mainUnsub = null;
    }
    if (clientsUnsub) {
      clientsUnsub();
      clientsUnsub = null;
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
  if (auth.currentUser) {
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
      if (err?.code === 'permission-denied') {
        handleFirestoreError(err, OperationType.WRITE, fullPath);
      }
      return false;
    }
  }
  return true;
}

