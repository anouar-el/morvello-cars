import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';
import { classifyClientDoc, type ClientDocKind } from '../../lib/clientDocAlerts';
import { getTodayDateString } from '../../utils/vehicleExpiryUtils';

interface ClientDocWarningProps {
  docType?: string;
  docExpiryDate?: string;
  licenseExpiryDate?: string;
  /** Fin de la location, si elle est déjà connue (récapitulatif) : repère une pièce qui périme en cours de route. */
  rentalEnd?: string;
}

/** Avertit, sans bloquer, qu'une pièce du locataire est périmée ou bientôt périmée. N'affiche rien sinon. */
export const ClientDocWarning: React.FC<ClientDocWarningProps> = ({ docType, docExpiryDate, licenseExpiryDate, rentalEnd }) => {
  const { t } = useI18n();
  const today = getTodayDateString();

  const docs: Array<[ClientDocKind, string | undefined]> = [
    ['identity', docExpiryDate],
    ['license', licenseExpiryDate],
  ];
  const lines = docs.flatMap(([kind, raw]) => {
    const found = classifyClientDoc(raw, today, rentalEnd);
    if (!found) return [];
    const doc = kind === 'license' ? t('Permis') : docType === 'Passeport' ? t('Passeport') : t('CIN');
    const params = { doc, date: found.expiryDate, days: found.daysRemaining };
    const text =
      found.status === 'expired'
        ? t('{doc} périmé depuis le {date} : demandez une pièce valide avant de louer.', params)
        : found.status === 'expires_during_rental'
        ? t('{doc} valable jusqu’au {date}, soit avant la fin de la location.', params)
        : t('{doc} valable jusqu’au {date} (dans {days} j).', params);
    return [{ key: kind, critical: found.status !== 'expiring_soon', text }];
  });

  if (lines.length === 0) return null;
  const critical = lines.some((l) => l.critical);

  return (
    <div
      role="alert"
      className={`rounded-xl border p-3 text-xs flex items-start gap-2.5 ${
        critical ? 'bg-rose-500/10 border-rose-500/40 text-rose-200' : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
      }`}
    >
      <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${critical ? 'text-rose-400' : 'text-amber-400'}`} />
      <div className="space-y-0.5">
        {lines.map((line) => (
          <p key={line.key}>{line.text}</p>
        ))}
      </div>
    </div>
  );
};
