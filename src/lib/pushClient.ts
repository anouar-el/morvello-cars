import { getActiveAuthToken } from './authToken';

/**
 * Notifications push côté navigateur : abonnement de l'appareil et échanges avec le serveur.
 */

export type PushState =
  | 'unsupported' // navigateur sans notifications push
  | 'needs-install' // iPhone : il faut d'abord installer l'app sur l'écran d'accueil
  | 'disabled-by-server' // clés VAPID absentes côté serveur
  | 'denied' // l'utilisateur a bloqué les notifications dans le navigateur
  | 'off'
  | 'on';

/** Clé publique VAPID (base64url) → octets attendus par `pushManager.subscribe`. */
export function urlBase64ToUint8Array(value: string): Uint8Array {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function isPushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

const isIos = () => typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches === true || (navigator as Navigator & { standalone?: boolean }).standalone === true;

async function authHeaders(): Promise<Record<string, string>> {
  const { token } = await getActiveAuthToken({ forceRefresh: false });
  return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  const existing = await navigator.serviceWorker.getRegistration();
  if (existing) return existing;
  // Le service worker n'est enregistré qu'en production, et seulement une fois la page chargée : on l'attend un instant
  if (!import.meta.env.PROD) return null;
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
  ]);
}

async function fetchConfig(): Promise<{ enabled: boolean; publicKey: string | null } | null> {
  try {
    const res = await fetch('/api/push/config', { headers: await authHeaders() });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.success) return null;
    return { enabled: Boolean(data.enabled), publicKey: data.publicKey ?? null };
  } catch {
    return null;
  }
}

/** État actuel de l'appareil ; null si l'utilisateur n'a pas droit aux notifications (agent) ou si le serveur est injoignable. */
export async function getPushState(): Promise<PushState | null> {
  if (!isPushSupported()) return isIos() && !isStandalone() ? 'needs-install' : 'unsupported';
  const config = await fetchConfig();
  if (!config) return null;
  if (!config.enabled) return 'disabled-by-server';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await registration();
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  if (sub && Notification.permission === 'granted') {
    // L'abonnement peut avoir changé côté navigateur : on le ré-enregistre, sans effet s'il est déjà connu
    void sendSubscription(sub);
    return 'on';
  }
  return 'off';
}

async function sendSubscription(sub: PushSubscription): Promise<boolean> {
  try {
    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ subscription: sub.toJSON() }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export type EnableResult = 'on' | 'denied' | 'failed';

export async function enablePush(): Promise<EnableResult> {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'failed';
    const reg = await registration();
    const config = await fetchConfig();
    if (!reg || !config?.enabled || !config.publicKey) return 'failed';
    const existing = await reg.pushManager.getSubscription();
    const sub =
      existing ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(config.publicKey) as BufferSource,
      }));
    return (await sendSubscription(sub)) ? 'on' : 'failed';
  } catch {
    return 'failed';
  }
}

export async function disablePush(): Promise<boolean> {
  try {
    const reg = await registration();
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    if (!sub) return true;
    const endpoint = sub.endpoint;
    await sub.unsubscribe();
    await fetch('/api/push/unsubscribe', { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ endpoint }) });
    return true;
  } catch {
    return false;
  }
}

/** Envoie une notification d'essai à tous les appareils de l'utilisateur ; renvoie le nombre d'appareils joints. */
export async function sendTestPush(): Promise<number> {
  try {
    const res = await fetch('/api/push/test', { method: 'POST', headers: await authHeaders(), body: '{}' });
    const data = await res.json().catch(() => null);
    return res.ok && data?.success ? Number(data.reached) || 0 : 0;
  } catch {
    return 0;
  }
}
