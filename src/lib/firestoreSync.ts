import { doc, getDoc, setDoc } from 'firebase/firestore/lite';
import { db } from './firebase';
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

function isAbortError(error: any): boolean {
  if (!error) return false;
  const msg = typeof error.message === 'string' ? error.message.toLowerCase() : '';
  const name = typeof error.name === 'string' ? error.name : '';
  const code = typeof error.code === 'string' ? error.code : '';
  return (
    name === 'AbortError' ||
    code === 'cancelled' ||
    msg.includes('aborted') ||
    msg.includes('abort')
  );
}

export async function fetchRemoteAgencyData(): Promise<MorvelloCloudData | null> {
  try {
    const docRef = doc(db, APP_DOC_PATH.collection, APP_DOC_PATH.docId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as MorvelloCloudData;
    }
    return null;
  } catch (error: any) {
    if (isAbortError(error)) {
      // Benign abort during navigation / unmount
      return null;
    }
    console.error('Firebase Firestore fetch error:', error);
    return null;
  }
}

export async function saveRemoteAgencyData(data: Partial<MorvelloCloudData>): Promise<boolean> {
  try {
    const docRef = doc(db, APP_DOC_PATH.collection, APP_DOC_PATH.docId);
    const rawPayload = {
      ...data,
      updatedAt: new Date().toISOString(),
    };
    const sanitizedPayload = sanitizeForFirestore(rawPayload);
    await setDoc(docRef, sanitizedPayload, { merge: true });
    return true;
  } catch (error: any) {
    if (isAbortError(error)) {
      // Benign abort during navigation / unmount
      return false;
    }
    console.error('Firebase Firestore save error:', error);
    return false;
  }
}
