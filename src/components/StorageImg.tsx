import React, { useEffect, useState } from 'react';
import { isStorageRef, resolveRef, resolveSync } from '../lib/storageFiles';
import { browserStorageApi } from '../lib/storageClient';
import { SUPABASE_URL } from '../lib/supabase';

/** Image transparente de 1 pixel : l'élément <img> existe dès le départ, ce qui permet d'attendre son chargement. */
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

/**
 * Adresse affichable d'une valeur de fiche (data:, https:, ou référence Storage).
 * `undefined` tant qu'un fichier privé est en cours de téléchargement ; chaîne vide s'il est introuvable.
 */
export function useStorageUrl(src: string | null | undefined): string | undefined {
  const [resolved, setResolved] = useState<string | undefined>(() => resolveSync(src, SUPABASE_URL));

  useEffect(() => {
    if (!src) {
      setResolved(undefined);
      return;
    }
    const immediate = resolveSync(src, SUPABASE_URL);
    if (immediate !== undefined) {
      setResolved(immediate);
      return;
    }
    if (!isStorageRef(src) || !browserStorageApi) {
      setResolved('');
      return;
    }
    let cancelled = false;
    setResolved(undefined);
    resolveRef(src, browserStorageApi).then((url) => {
      if (!cancelled) setResolved(url ?? '');
    });
    return () => {
      cancelled = true;
    };
  }, [src]);

  return resolved;
}

type ImgProps = Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> & { src?: string | null };

/**
 * Remplace <img> pour les photos, scans et signatures de fiche.
 * Tant que le fichier n'est pas prêt, `data-storage-pending` signale l'attente (la génération du PDF s'y fie).
 */
export const StorageImg: React.FC<ImgProps> = ({ src, alt = '', ...rest }) => {
  const url = useStorageUrl(src);
  const pending = Boolean(src) && url === undefined;
  return <img {...rest} alt={alt} src={url || BLANK} data-storage-pending={pending ? 'true' : undefined} data-storage-missing={url === '' ? 'true' : undefined} />;
};
