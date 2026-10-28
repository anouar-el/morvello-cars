import React from 'react';
import { useI18n } from '../i18n/I18nContext';
import { isPdfValue } from '../lib/storageFiles';
import { StorageImg, useStorageUrl } from './StorageImg';

/** Affichage agrandi d'un document de fiche (image ou PDF), qu'il soit intégré ou rangé dans Storage. */
export const StorageDocument: React.FC<{ src: string; title: string }> = ({ src, title }) => {
  const { t } = useI18n();
  const url = useStorageUrl(src);

  if (url === undefined) return <p className="text-xs text-slate-400 py-10">{t('Chargement du document…')}</p>;
  if (url === '') return <p className="text-xs text-rose-300 py-10">{t('Document introuvable.')}</p>;

  return isPdfValue(src) ? (
    <iframe src={url} title={t('PDF Preview')} className="w-full h-[500px] rounded" />
  ) : (
    <StorageImg src={src} alt={title} className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-lg" referrerPolicy="no-referrer" />
  );
};

/** Lien de téléchargement : l'adresse d'un fichier privé n'est connue qu'une fois le lien signé obtenu. */
export const StorageDownloadLink: React.FC<{ src: string; filename: string; className?: string; children: React.ReactNode }> = ({
  src,
  filename,
  className,
  children,
}) => {
  const url = useStorageUrl(src);
  const ready = Boolean(url);
  return (
    <a
      href={ready ? url : undefined}
      download={filename}
      aria-disabled={!ready}
      className={`${className ?? ''} ${ready ? '' : 'opacity-50 pointer-events-none'}`}
    >
      {children}
    </a>
  );
};
