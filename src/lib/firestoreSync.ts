import { doc, getDoc, setDoc, onSnapshot, runTransaction, Unsubscribe } from 'firebase/firestore';
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
  saveVehicleRecordToSupabase,
  deleteVehicleFromSupabase,
  saveContractRecordToSupabase,
  deleteContractFromSupabase,
  saveClientRecordToSupabase,
  deleteClientFromSupabase,
  saveDriverRecordToSupabase,
  deleteDriverFromSupabase,
  saveDepositRecordToSupabase,
  deleteDepositFromSupabase,
  savePaymentRecordToSupabase,
  deletePaymentFromSupabase,
  saveVehicleExpenseRecordToSupabase,
  deleteVehicleExpenseFromSupabase,
  saveCompanySettingsToSupabase,
} from './supabaseSync';
import {
  Client,
  Driver,
  Vehicle,
  VehicleExpense,
  Contract,
  CompanySettings,
  AuditLog,
  User,
  TermsVersion,
  DepositRecord,
  PaymentRecord,
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

// ==============================================================================
// RECORD-LEVEL SYNCHRONIZATION HELPERS (PROBLEM #7 RESOLUTION)
//
// These functions operate exclusively on individual records without rewriting
// entire global collections. They update the normalized PostgreSQL tables in Supabase
// and perform atomic transactional updates in Cloud Firestore.
// ==============================================================================

/**
 * Synchronizes a single vehicle record (insert, update, or delete)
 */
export async function syncVehicleRecord(
  vehicle: Vehicle,
  operation: 'save' | 'delete' = 'save',
  currentUser?: User | null,
  allUsers?: User[]
): Promise<{ success: boolean; error?: any }> {
  let supabaseResult: { success: boolean; error?: any; conflict?: boolean } = { success: false };
  let firestoreSuccess = false;

  // 1. Authoritative: Row-level PostgreSQL Supabase sync
  if (isSupabaseConfigured) {
    if (operation === 'delete') {
      supabaseResult = await deleteVehicleFromSupabase(vehicle.id);
    } else {
      supabaseResult = await saveVehicleRecordToSupabase(vehicle, { currentUser, allUsers });
    }
  }

  // 2. Firebase Cloud Firestore array transactional update
  if (auth.currentUser) {
    const mainDocRef = doc(db, APP_DOC_PATH.collection, APP_DOC_PATH.docId);
    try {
      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(mainDocRef);
        if (!snap.exists()) return;
        const currentData = snap.data() as MorvelloCloudData;
        const existingList = currentData.vehicles || [];
        let updatedList: Vehicle[];
        if (operation === 'delete') {
          updatedList = existingList.filter((v) => v.id !== vehicle.id);
        } else {
          const idx = existingList.findIndex((v) => v.id === vehicle.id);
          if (idx >= 0) {
            updatedList = [...existingList];
            updatedList[idx] = { ...updatedList[idx], ...vehicle };
          } else {
            updatedList = [vehicle, ...existingList];
          }
        }
        transaction.update(mainDocRef, {
          vehicles: sanitizeForFirestore(updatedList),
          updatedAt: new Date().toISOString(),
          updatedBy: auth.currentUser?.uid || 'morvello_user',
        });
      });
      firestoreSuccess = true;
    } catch (err: any) {
      if (!isAbortException(err)) {
        console.warn('[Firestore] Notice updating vehicle in agency doc:', err?.message || err);
      }
    }
  }

  return {
    success: (isSupabaseConfigured ? supabaseResult.success : true) && (auth.currentUser ? firestoreSuccess : true),
    error: supabaseResult.error,
  };
}

/**
 * Synchronizes a single contract record (insert, update, or delete)
 */
export async function syncContractRecord(
  contract: Contract,
  operation: 'save' | 'delete' = 'save',
  currentUser?: User | null,
  allUsers?: User[]
): Promise<{ success: boolean; error?: any }> {
  let supabaseResult: { success: boolean; error?: any; conflict?: boolean } = { success: false };
  let firestoreSuccess = false;

  // 1. Authoritative: Row-level PostgreSQL Supabase sync
  if (isSupabaseConfigured) {
    if (operation === 'delete') {
      supabaseResult = await deleteContractFromSupabase(contract.id);
    } else {
      supabaseResult = await saveContractRecordToSupabase(contract, { currentUser, allUsers });
    }
  }

  // 2. Firebase Cloud Firestore array transactional update
  if (auth.currentUser) {
    const mainDocRef = doc(db, APP_DOC_PATH.collection, APP_DOC_PATH.docId);
    try {
      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(mainDocRef);
        if (!snap.exists()) return;
        const currentData = snap.data() as MorvelloCloudData;
        const existingList = currentData.contracts || [];
        let updatedList: Contract[];
        if (operation === 'delete') {
          updatedList = existingList.filter((c) => c.id !== contract.id);
        } else {
          const idx = existingList.findIndex((c) => c.id === contract.id);
          if (idx >= 0) {
            updatedList = [...existingList];
            updatedList[idx] = { ...updatedList[idx], ...contract };
          } else {
            updatedList = [contract, ...existingList];
          }
        }
        transaction.update(mainDocRef, {
          contracts: sanitizeForFirestore(optimizeContractsForFirestore(updatedList)),
          updatedAt: new Date().toISOString(),
          updatedBy: auth.currentUser?.uid || 'morvello_user',
        });
      });
      firestoreSuccess = true;
    } catch (err: any) {
      if (!isAbortException(err)) {
        console.warn('[Firestore] Notice updating contract in agency doc:', err?.message || err);
      }
    }
  }

  return {
    success: (isSupabaseConfigured ? supabaseResult.success : true) && (auth.currentUser ? firestoreSuccess : true),
    error: supabaseResult.error,
  };
}

/**
 * Synchronizes a single client record (insert, update, or delete)
 */
export async function syncClientRecord(
  client: Client,
  operation: 'save' | 'delete' = 'save',
  currentUser?: User | null,
  allUsers?: User[]
): Promise<{ success: boolean; error?: any }> {
  let supabaseResult: { success: boolean; error?: any; conflict?: boolean } = { success: false };
  let firestoreSuccess = false;

  // 1. Authoritative: Row-level PostgreSQL Supabase sync
  if (isSupabaseConfigured) {
    if (operation === 'delete') {
      supabaseResult = await deleteClientFromSupabase(client.id);
    } else {
      supabaseResult = await saveClientRecordToSupabase(client, { currentUser, allUsers });
    }
  }

  // 2. Firebase Cloud Firestore update (both morvello_clients and morvello_main)
  if (auth.currentUser) {
    const clientsDocRef = doc(db, CLIENTS_DOC_PATH.collection, CLIENTS_DOC_PATH.docId);
    const mainDocRef = doc(db, APP_DOC_PATH.collection, APP_DOC_PATH.docId);
    try {
      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(clientsDocRef);
        const existingList: Client[] = snap.exists() ? (snap.data().clients || []) : [];
        let updatedList: Client[];
        if (operation === 'delete') {
          updatedList = existingList.filter((c) => c.id !== client.id);
        } else {
          const idx = existingList.findIndex((c) => c.id === client.id);
          if (idx >= 0) {
            updatedList = [...existingList];
            updatedList[idx] = { ...updatedList[idx], ...client };
          } else {
            updatedList = [client, ...existingList];
          }
        }
        transaction.set(
          clientsDocRef,
          {
            clients: sanitizeForFirestore(updatedList),
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      });

      // Also sync to main agency doc if present
      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(mainDocRef);
        if (!snap.exists()) return;
        const currentData = snap.data() as MorvelloCloudData;
        const existingList = currentData.clients || [];
        let updatedList: Client[];
        if (operation === 'delete') {
          updatedList = existingList.filter((c) => c.id !== client.id);
        } else {
          const idx = existingList.findIndex((c) => c.id === client.id);
          if (idx >= 0) {
            updatedList = [...existingList];
            updatedList[idx] = { ...updatedList[idx], ...client };
          } else {
            updatedList = [client, ...existingList];
          }
        }
        transaction.update(mainDocRef, {
          clients: sanitizeForFirestore(updatedList),
          updatedAt: new Date().toISOString(),
          updatedBy: auth.currentUser?.uid || 'morvello_user',
        });
      });
      firestoreSuccess = true;
    } catch (err: any) {
      if (!isAbortException(err)) {
        console.warn('[Firestore] Notice updating client:', err?.message || err);
      }
    }
  }

  return {
    success: (isSupabaseConfigured ? supabaseResult.success : true) && (auth.currentUser ? firestoreSuccess : true),
    error: supabaseResult.error,
  };
}

/**
 * Synchronizes a single driver record (insert, update, or delete)
 */
export async function syncDriverRecord(
  driver: Driver,
  operation: 'save' | 'delete' = 'save',
  currentUser?: User | null,
  allUsers?: User[]
): Promise<{ success: boolean; error?: any }> {
  let supabaseResult: { success: boolean; error?: any; conflict?: boolean } = { success: false };
  let firestoreSuccess = false;

  if (isSupabaseConfigured) {
    if (operation === 'delete') {
      supabaseResult = await deleteDriverFromSupabase(driver.id);
    } else {
      supabaseResult = await saveDriverRecordToSupabase(driver, { currentUser, allUsers });
    }
  }

  if (auth.currentUser) {
    const mainDocRef = doc(db, APP_DOC_PATH.collection, APP_DOC_PATH.docId);
    try {
      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(mainDocRef);
        if (!snap.exists()) return;
        const currentData = snap.data() as MorvelloCloudData;
        const existingList = currentData.drivers || [];
        let updatedList: Driver[];
        if (operation === 'delete') {
          updatedList = existingList.filter((d) => d.id !== driver.id);
        } else {
          const idx = existingList.findIndex((d) => d.id === driver.id);
          if (idx >= 0) {
            updatedList = [...existingList];
            updatedList[idx] = { ...updatedList[idx], ...driver };
          } else {
            updatedList = [driver, ...existingList];
          }
        }
        transaction.update(mainDocRef, {
          drivers: sanitizeForFirestore(updatedList),
          updatedAt: new Date().toISOString(),
          updatedBy: auth.currentUser?.uid || 'morvello_user',
        });
      });
      firestoreSuccess = true;
    } catch (err: any) {
      if (!isAbortException(err)) {
        console.warn('[Firestore] Notice updating driver:', err?.message || err);
      }
    }
  }

  return {
    success: (isSupabaseConfigured ? supabaseResult.success : true) && (auth.currentUser ? firestoreSuccess : true),
    error: supabaseResult.error,
  };
}

/**
 * Synchronizes a single deposit record (insert, update, or delete)
 */
export async function syncDepositRecord(
  deposit: DepositRecord,
  operation: 'save' | 'delete' = 'save',
  currentUser?: User | null,
  allUsers?: User[]
): Promise<{ success: boolean; error?: any }> {
  let supabaseResult: { success: boolean; error?: any; conflict?: boolean } = { success: false };
  let firestoreSuccess = false;

  if (isSupabaseConfigured) {
    if (operation === 'delete') {
      supabaseResult = await deleteDepositFromSupabase(deposit.id);
    } else {
      supabaseResult = await saveDepositRecordToSupabase(deposit, { currentUser, allUsers });
    }
  }

  if (auth.currentUser) {
    const mainDocRef = doc(db, APP_DOC_PATH.collection, APP_DOC_PATH.docId);
    try {
      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(mainDocRef);
        if (!snap.exists()) return;
        const currentData = snap.data() as MorvelloCloudData;
        const existingList = currentData.deposits || [];
        let updatedList: DepositRecord[];
        if (operation === 'delete') {
          updatedList = existingList.filter((d) => d.id !== deposit.id);
        } else {
          const idx = existingList.findIndex((d) => d.id === deposit.id);
          if (idx >= 0) {
            updatedList = [...existingList];
            updatedList[idx] = { ...updatedList[idx], ...deposit };
          } else {
            updatedList = [deposit, ...existingList];
          }
        }
        transaction.update(mainDocRef, {
          deposits: sanitizeForFirestore(updatedList),
          updatedAt: new Date().toISOString(),
          updatedBy: auth.currentUser?.uid || 'morvello_user',
        });
      });
      firestoreSuccess = true;
    } catch (err: any) {
      if (!isAbortException(err)) {
        console.warn('[Firestore] Notice updating deposit:', err?.message || err);
      }
    }
  }

  return {
    success: (isSupabaseConfigured ? supabaseResult.success : true) && (auth.currentUser ? firestoreSuccess : true),
    error: supabaseResult.error,
  };
}

/**
 * Synchronizes a single vehicle maintenance expense to PostgreSQL vehicle_expenses
 */
export async function syncVehicleExpenseRecord(
  expense: VehicleExpense,
  vehicleId: string,
  operation: 'save' | 'delete' = 'save',
  currentUser?: User | null
): Promise<{ success: boolean; error?: any }> {
  let supabaseResult: { success: boolean; error?: any; conflict?: boolean } = { success: false };

  if (isSupabaseConfigured) {
    if (operation === 'delete') {
      supabaseResult = await deleteVehicleExpenseFromSupabase(expense.id);
    } else {
      supabaseResult = await saveVehicleExpenseRecordToSupabase(expense, vehicleId, { currentUser });
    }
  }

  return {
    success: isSupabaseConfigured ? supabaseResult.success : true,
    error: supabaseResult.error,
  };
}

/**
 * Synchronizes a single contract payment record to PostgreSQL payments
 */
export async function syncContractPaymentRecord(
  payment: PaymentRecord,
  contractId: string,
  operation: 'save' | 'delete' = 'save',
  currentUser?: User | null
): Promise<{ success: boolean; error?: any }> {
  let supabaseResult: { success: boolean; error?: any; conflict?: boolean } = { success: false };

  if (isSupabaseConfigured) {
    if (operation === 'delete') {
      supabaseResult = await deletePaymentFromSupabase(payment.id);
    } else {
      supabaseResult = await savePaymentRecordToSupabase(payment, contractId, { currentUser });
    }
  }

  return {
    success: isSupabaseConfigured ? supabaseResult.success : true,
    error: supabaseResult.error,
  };
}

/**
 * Persists ONLY company settings to agency_data / Firestore without sending unrelated collections
 */
export async function syncCompanySettings(
  settings: CompanySettings,
  userId?: string
): Promise<{ success: boolean; error?: any }> {
  let supabaseResult: { success: boolean; error?: any; conflict?: boolean } = { success: false };
  let firestoreSuccess = false;

  if (isSupabaseConfigured) {
    supabaseResult = await saveCompanySettingsToSupabase(settings, userId);
  }

  if (auth.currentUser) {
    const mainDocRef = doc(db, APP_DOC_PATH.collection, APP_DOC_PATH.docId);
    try {
      await setDoc(
        mainDocRef,
        sanitizeForFirestore({
          companySettings: settings,
          updatedAt: new Date().toISOString(),
          updatedBy: userId || auth.currentUser?.uid || 'morvello_user',
        }),
        { merge: true }
      );
      firestoreSuccess = true;
    } catch (err: any) {
      if (!isAbortException(err)) {
        console.warn('[Firestore] Notice updating companySettings:', err?.message || err);
      }
    }
  }

  return {
    success: (isSupabaseConfigured ? supabaseResult.success : true) && (auth.currentUser ? firestoreSuccess : true),
    error: supabaseResult.error,
  };
}

/**
 * Persists a single user profile without sending all users
 */
export async function syncUserProfile(
  userId: string,
  profile: Partial<User>
): Promise<{ success: boolean; error?: any }> {
  const success = await saveUserProfile(userId, profile as any);
  return { success };
}

