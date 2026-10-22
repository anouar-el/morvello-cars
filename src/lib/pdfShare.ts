/**
 * Partage et enregistrement du contrat PDF sur téléphone.
 * Sur iPhone, un téléchargement lancé après une longue génération est souvent bloqué : on prépare le PDF,
 * puis un second appui (donc un vrai geste de l'utilisateur) ouvre la feuille de partage ou le lecteur PDF.
 */

interface NavigatorLike {
  userAgent?: string;
  platform?: string;
  maxTouchPoints?: number;
  share?: (data: ShareData) => Promise<void>;
  canShare?: (data: ShareData) => boolean;
}

/** iPhone, iPod et iPad (iPadOS se présente comme un Mac : on le reconnaît à son écran tactile). */
export function isIosDevice(nav: NavigatorLike | undefined = typeof navigator === 'undefined' ? undefined : navigator): boolean {
  if (!nav) return false;
  const ua = nav.userAgent ?? '';
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  return nav.platform === 'MacIntel' && (nav.maxTouchPoints ?? 0) > 1;
}

/** Les iPhone limitent la mémoire d'un canevas : on capture à une résolution plus modeste, toujours lisible à l'impression A4. */
export function pdfCaptureSettings(ios: boolean): { scale: number; quality: number } {
  return ios ? { scale: 1.6, quality: 0.85 } : { scale: 2.2, quality: 0.95 };
}

export function canShareFile(file: File, nav: NavigatorLike | undefined = typeof navigator === 'undefined' ? undefined : navigator): boolean {
  if (!nav || typeof nav.share !== 'function' || typeof nav.canShare !== 'function') return false;
  try {
    return nav.canShare({ files: [file] });
  } catch {
    return false;
  }
}

export type ShareOutcome = 'shared' | 'cancelled' | 'unsupported' | 'failed';

export async function sharePdfFile(
  blob: Blob,
  filename: string,
  title: string,
  nav: NavigatorLike | undefined = typeof navigator === 'undefined' ? undefined : navigator
): Promise<ShareOutcome> {
  const file = new File([blob], filename, { type: 'application/pdf' });
  if (!nav || !canShareFile(file, nav)) return 'unsupported';
  try {
    await nav.share!({ files: [file], title });
    return 'shared';
  } catch (err) {
    // Fermer la feuille de partage sans choisir n'est pas une erreur
    if ((err as { name?: string })?.name === 'AbortError') return 'cancelled';
    return 'failed';
  }
}

/** Message clair (en français) pour une erreur de génération du PDF. */
export function describePdfError(err: unknown): string {
  const message = String((err as { message?: string })?.message ?? err ?? '').toLowerCase();
  if (/memory|canvas|too large|size|quota|allocation/.test(message)) {
    return "La mémoire de l'appareil est insuffisante pour générer le PDF. Fermez les autres onglets et applications, puis réessayez.";
  }
  if (/pas fini de se charger/.test(message)) {
    return "Le logo et le cachet n'ont pas fini de se charger. Vérifiez votre connexion, patientez quelques secondes, puis réessayez.";
  }
  if (/localiser les pages|page 1|page 2/.test(message)) {
    return "Le contrat n'a pas fini de s'afficher. Patientez un instant, puis réessayez.";
  }
  return 'La génération du PDF a échoué. Réessayez, ou utilisez « Imprimer (A4) ».';
}
