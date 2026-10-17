/** Invitation à installer l'app (PWA) : état partagé, capturé dès le chargement de la page. */

const DISMISS_KEY = 'morvello_install_dismissed_at';
export const INSTALL_SNOOZE_DAYS = 7;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());

export function subscribeInstall(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** À appeler une fois au démarrage : le navigateur n'émet l'événement qu'une seule fois, très tôt. */
export function initPwaInstallCapture(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    deferred = null;
    notify();
  });
}

export function canPromptNatively(): boolean {
  return deferred !== null;
}

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferred) return 'unavailable';
  const evt = deferred;
  deferred = null;
  await evt.prompt();
  const { outcome } = await evt.userChoice;
  if (outcome === 'accepted') installed = true;
  notify();
  return outcome;
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia?.('(display-mode: standalone)').matches === true || nav.standalone === true;
}

export function isIosSafari(userAgent: string = typeof navigator === 'undefined' ? '' : navigator.userAgent): boolean {
  const ios = /iPad|iPhone|iPod/.test(userAgent);
  // Chrome/Firefox/Edge sur iOS n'offrent pas « Sur l'écran d'accueil » : seule la feuille de Safari le fait
  return ios && /Safari/.test(userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(userAgent);
}

export function isSnoozed(storedAt: string | null, now: number = Date.now(), days = INSTALL_SNOOZE_DAYS): boolean {
  if (!storedAt) return false;
  const at = Number(storedAt);
  if (!Number.isFinite(at)) return false;
  return now - at < days * 24 * 60 * 60 * 1000;
}

export function readSnoozed(): boolean {
  try {
    return isSnoozed(localStorage.getItem(DISMISS_KEY));
  } catch {
    return false;
  }
}

export function snoozeInstallPrompt(): void {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    /* stockage indisponible : l'invitation reviendra, sans conséquence */
  }
}

export function appWasInstalled(): boolean {
  return installed || isStandalone();
}
