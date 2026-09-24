// Global early error filter to prevent benign browser/network abort errors
// (e.g., iframe reloads, navigation cancellations, AbortController timeouts)
// from bubbling up to the top-level error handlers or console.

export const isAbortException = (err: any): boolean => {
  if (!err) return false;
  const msg =
    typeof err?.message === 'string'
      ? err.message.toLowerCase()
      : typeof err === 'string'
      ? err.toLowerCase()
      : typeof err?.reason?.message === 'string'
      ? err.reason.message.toLowerCase()
      : '';
  const name = typeof err?.name === 'string' ? err.name : typeof err?.reason?.name === 'string' ? err.reason.name : '';
  const code = typeof err?.code === 'string' ? err.code : '';

  return (
    name === 'AbortError' ||
    code === 'cancelled' ||
    code === 'auth/popup-closed-by-user' ||
    code === 'auth/cancelled-popup-request' ||
    msg.includes('aborted') ||
    msg.includes('abort') ||
    msg.includes('the user aborted a request') ||
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('load failed') ||
    (msg.includes('network request failed') && msg.includes('abort'))
  );
};

// Filter console.error and console.warn so benign abort errors don't trigger platform error capture
const originalConsoleError = console.error;
console.error = (...args: any[]) => {
  if (args.some((arg) => isAbortException(arg))) {
    return;
  }
  originalConsoleError.apply(console, args);
};

const originalConsoleWarn = console.warn;
console.warn = (...args: any[]) => {
  if (args.some((arg) => isAbortException(arg))) {
    return;
  }
  originalConsoleWarn.apply(console, args);
};

// Global capture-phase event listeners to suppress abort unhandled rejections
if (typeof window !== 'undefined') {
  window.addEventListener(
    'unhandledrejection',
    (event) => {
      if (isAbortException(event.reason)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true
  );

  window.addEventListener(
    'error',
    (event) => {
      if (isAbortException(event.error) || isAbortException(event.message)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true
  );

  // Auto-recover from stale dynamic chunks after a new deployment
  window.addEventListener('vite:preloadError', (event) => {
    console.warn('[Vite] Dynamic import chunk failed to load (new version deployed). Reloading page...', event);
    const reloadKey = 'morvello_preload_reload';
    const lastReload = sessionStorage.getItem(reloadKey);
    const now = Date.now();
    if (!lastReload || now - Number(lastReload) > 15000) {
      sessionStorage.setItem(reloadKey, String(now));
      window.location.reload();
    }
  });
}
