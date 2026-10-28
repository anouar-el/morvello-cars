import React from 'react';
import { useI18n } from '../i18n/I18nContext';
import { isDisplayableFile, isPdfValue } from '../lib/storageFiles';
import { FileText } from 'lucide-react';
import { StorageImg, useStorageUrl } from './StorageImg';

/** Vignette d'un document de fiche ; un document « archivé » sans fichier numérisé garde une icône au lieu d'une image cassée. */
export const DocThumb: React.FC<{ src?: string | null; alt: string; className?: string }> = ({ src, alt, className }) => {
  const { t } = useI18n();
  if (!isDisplayableFile(src)) {
    return (
      <div className={`${className ?? ''} flex flex-col items-center justify-center text-slate-500`} title={t('Document archivé : aucun fichier numérisé.')} aria-label={alt}>
        <FileText className="w-4 h-4" />
        <span className="text-[8px] leading-none mt-0.5">{t('Archivé')}</span>
      </div>
    );
  }
  return <StorageImg src={src} alt={alt} className={className} referrerPolicy="no-referrer" />;
};

/** Affichage agrandi d'un document de fiche (image ou PDF), qu'il soit intégré ou rangé dans Storage. */
export const StorageDocument: React.FC<{ src: string; title: string }> = ({ src, title }) => {
  const { t } = useI18n();
  const url = useStorageUrl(src);

  if (!isDisplayableFile(src)) {
    return <p className="text-xs text-slate-400 py-10">{t('Document archivé : aucun fichier numérisé.')}</p>;
  }

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
