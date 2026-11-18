import React from 'react';
import { useI18n } from '../../i18n/I18nContext';
import { INSURANCE_PACKS } from '../../data/insurancePacks';
import {
  DEFAULT_END_TIME,
  DEFAULT_START_TIME,
  type ContractDraft,
  type ContractEdits,
} from '../../lib/assistantActions';
import type { InsurancePackId } from '../../types';

interface ContractActionFieldsProps {
  /** Brouillon déjà recalculé avec les corrections de l'utilisateur. */
  draft: ContractDraft;
  /** Nom du client tel que retrouvé (fiche) ou tel que dit à l'assistant. */
  clientName: string;
  /** Raison pour laquelle la carte ne pourrait pas être confirmée telle quelle (client absent, véhicule pris…). */
  problem: string | null;
  /** Carte déjà traitée : on n'affiche plus que le récapitulatif. */
  locked: boolean;
  onEdit: (patch: ContractEdits) => void;
}

const inputClass =
  'w-full bg-slate-950 border border-slate-700 rounded-md px-1.5 py-1 text-[12px] text-white font-mono focus:border-amber-500 focus:outline-none';

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block">
    <span className="block text-[10.5px] text-slate-500 mb-0.5">{label}</span>
    {children}
  </label>
);

/** Détail d'un contrat proposé par l'assistant : corrigeable avant de confirmer, total recalculé à chaque changement. */
export const ContractActionFields: React.FC<ContractActionFieldsProps> = ({ draft, clientName, problem, locked, onEdit }) => {
  const { t } = useI18n();
  const release = draft.release;
  const pack = INSURANCE_PACKS.find((p) => p.id === (draft.packId || 'base'));
  const number = (value: string) => (value === '' ? 0 : Number(value));

  return (
    <div className="mt-2 space-y-1.5 text-slate-300">
      <div>
        {t('Client :')} <span dir="auto" className="text-white">{clientName}</span>
      </div>
      <div>{draft.vehicleLabel}</div>

      {locked ? (
        <>
          <div>
            {draft.startDate} {draft.startTime || DEFAULT_START_TIME} → {draft.endDate} {draft.endTime || DEFAULT_END_TIME} ·{' '}
            {t('{days} jours', { days: draft.totalDays })}
          </div>
          <div>
            {t('{price} MAD/jour', { price: draft.pricePerDay })} ·{' '}
            <span className="font-bold text-amber-300">{t('Total {amount} MAD', { amount: draft.totalAmount })}</span>
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-1.5">
            <Field label={t('Départ')}>
              <input type="date" className={inputClass} value={draft.startDate} onChange={(e) => onEdit({ startDate: e.target.value })} />
            </Field>
            <Field label={t('Retour')}>
              <input type="date" className={inputClass} value={draft.endDate} min={draft.startDate} onChange={(e) => onEdit({ endDate: e.target.value })} />
            </Field>
            <Field label={t('Heure de départ')}>
              <input type="time" className={inputClass} value={draft.startTime || DEFAULT_START_TIME} onChange={(e) => onEdit({ startTime: e.target.value })} />
            </Field>
            <Field label={t('Heure de retour')}>
              <input type="time" className={inputClass} value={draft.endTime || DEFAULT_END_TIME} onChange={(e) => onEdit({ endTime: e.target.value })} />
            </Field>
            <Field label={t('Tarif par jour (MAD)')}>
              <input type="number" min={0} className={inputClass} value={draft.pricePerDay} onChange={(e) => onEdit({ pricePerDay: number(e.target.value) })} />
            </Field>
            <Field label={t('Caution (MAD)')}>
              <input type="number" min={0} className={inputClass} value={draft.depositAmount} onChange={(e) => onEdit({ depositAmount: number(e.target.value) })} />
            </Field>
          </div>
          <Field label={t('Pack d’assurance')}>
            <select
              className={inputClass}
              value={draft.packId || 'base'}
              onChange={(e) => onEdit({ packId: e.target.value as InsurancePackId })}
            >
              {INSURANCE_PACKS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>
          <div>
            {t('{days} jours', { days: draft.totalDays })} ·{' '}
            <span className="font-bold text-amber-300">{t('Total {amount} MAD', { amount: draft.totalAmount })}</span>
          </div>
        </>
      )}

      {locked && pack && <div>{t('Pack d’assurance')} : {pack.label}</div>}
      {locked && draft.depositAmount > 0 && (
        <div>{t('Caution convenue : {amount} MAD (non encore prise)', { amount: draft.depositAmount })}</div>
      )}

      {release && (
        <div className="mt-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 text-amber-200 space-y-0.5">
          <div className="font-semibold">
            {t('Libère d’abord le véhicule : clôture du contrat {number} ({client})', {
              number: release.contractNumber,
              client: release.clientName,
            })}
          </div>
          <div>
            {release.overdue
              ? t('Retour prévu le {date}, dépassé : le véhicule est probablement rentré.', { date: release.plannedEnd })
              : t('Retour prévu le {date}, pas encore échu : vérifiez que le véhicule est bien rentré.', { date: release.plannedEnd })}
          </div>
          <div>{t('Retour enregistré aujourd’hui à {km} km.', { km: release.returnKm })}</div>
          {(release.unpaid > 0 || release.depositHeld > 0) && (
            <div>
              {t('Non traité par la clôture : reste à encaisser {unpaid} MAD, caution détenue {deposit} MAD.', {
                unpaid: release.unpaid,
                deposit: release.depositHeld,
              })}
            </div>
          )}
        </div>
      )}

      {!locked && problem && <div className="text-amber-400">{problem}</div>}
    </div>
  );
};
