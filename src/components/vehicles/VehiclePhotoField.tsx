import React, { useRef, useState } from 'react';
import { Camera, Trash2 } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';
import { fileToCompressedDataUrl } from '../../lib/imageResize';
import { storeFile } from '../../lib/storageClient';
import { StorageImg } from '../StorageImg';

interface Props {
  value?: string | null;
  onChange: (photo: string | null) => void;
}

/** Choix / remplacement / suppression de la photo d'un véhicule (compressée côté navigateur). */
export const VehiclePhotoField: React.FC<Props> = ({ value, onChange }) => {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      // La photo part dans Supabase Storage ; la fiche ne garde qu'une référence (ou la photo elle-même si l'envoi est impossible)
      onChange(await storeFile(await fileToCompressedDataUrl(file), 'vehicle-photo'));
    } catch {
      setError(t("Image illisible. Choisissez une photo JPG ou PNG."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-slate-300">{t('Photo du véhicule')}</label>
      <div className="flex items-center gap-3">
        <div className="w-28 h-20 shrink-0 rounded-xl overflow-hidden border border-slate-700 bg-slate-950 flex items-center justify-center">
          {value ? (
            <StorageImg src={value} alt="" className="w-full h-full object-cover" />
          ) : (
            <Camera className="w-6 h-6 text-slate-600" />
          )}
        </div>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-200 text-xs px-3 py-2 rounded-xl border border-slate-700 transition-all font-semibold cursor-pointer disabled:opacity-50"
          >
            <Camera className="w-3.5 h-3.5" />
            {busy ? t('Traitement…') : value ? t('Changer la photo') : t('Ajouter une photo')}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="flex items-center gap-1.5 text-xs text-red-300 hover:text-red-200 font-semibold cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {t('Retirer')}
            </button>
          )}
        </div>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </div>
      {error && <p className="text-[11px] text-red-300">{error}</p>}
    </div>
  );
};
