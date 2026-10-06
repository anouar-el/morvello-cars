import { lazy, type ComponentType } from 'react';
import { setBackgroundPreloading } from './initErrorHandling';

const RETRY_DELAY_MS = 1200;

/**
 * Named so ErrorBoundary shows its reload screen. The raw browser error reads
 * "Failed to fetch dynamically imported module", which isAbortException treats as a
 * benign network abort and swallows, leaving a blank view.
 */
class ChunkLoadError extends Error {
  constructor(public readonly cause: unknown) {
    super('Module applicatif indisponible (mise à jour ou réseau).');
    this.name = 'ChunkLoadError';
  }
}

export interface PreloadableView {
  preload: () => Promise<void>;
}

/** React.lazy with one retry, a failure the ErrorBoundary can display, and a preload hook. */
export function lazyView<T extends ComponentType<any>>(load: () => Promise<T>) {
  let pending: Promise<{ default: T }> | null = null;

  const loadOnce = () => {
    if (!pending) {
      pending = load()
        .catch(
          () =>
            new Promise<T>((resolve, reject) => {
              setTimeout(() => load().then(resolve, reject), RETRY_DELAY_MS);
            })
        )
        .then((component) => ({ default: component }))
        .catch((err) => {
          pending = null;
          throw new ChunkLoadError(err);
        });
    }
    return pending;
  };

  return Object.assign(lazy(loadOnce), {
    preload: () => loadOnce().then(
      () => undefined,
      () => undefined
    ),
  });
}

/**
 * Fetches the remaining views once the browser is idle, so tab navigation is instant and
 * never depends on the network later (a chunk requested long after page load can be gone
 * if a new version was deployed in between). Returns a cancel function.
 */
export function preloadViewsWhenIdle(views: PreloadableView[]): () => void {
  let cancelled = false;
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
  if (saveData) return () => {};

  const run = async () => {
    setBackgroundPreloading(true);
    try {
      for (const view of views) {
        if (cancelled || !navigator.onLine) break;
        await view.preload();
      }
    } finally {
      setBackgroundPreloading(false);
    }
  };

  const timer = window.setTimeout(run, 1500);
  return () => {
    cancelled = true;
    window.clearTimeout(timer);
  };
}
