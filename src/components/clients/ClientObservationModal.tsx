import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useI18n } from '../../i18n/I18nContext';
import { newObservationId, summarizeObservations } from '../../lib/clientObservations';
import type { Client, ClientObservation, Contract } from '../../types';
import { ClientObservationForm, EMPTY_OBSERVATION, type ObservationDraft } from './ClientObservationForm';
import { StandingBadge } from './ClientObservationsPanel';

/** Observation sur le client d'une location précise (ouverte depuis la liste des contrats). */
export const ClientObservationModal: React.FC<{ contract: Contract; onClose: () => void }> = ({ contract, onClose }) => {
  const { t } = useI18n();
  const { clients, updateClient, currentUser } = useApp();
  const client = clients.find((c) => c.id === contract.clientId);
  const [draft, setDraft] = useState<ObservationDraft>(EMPTY_OBSERVATION);

  const name = `${contract.clientSnapshot.lastName} ${contract.clientSnapshot.firstName}`.trim();
  const summary = summarizeObservations(client?.behaviorLog);

  const save = () => {
    if (!client || draft.rating === null) return;
    const obs: ClientObservation = {
      id: newObservationId(),
      createdAt: new Date().toISOString(),
      authorName: currentUser?.name || 'Direction',
      authorId: currentUser?.id,
      contractId: contract.id,
      contractNumber: contract.contractNumber,
      rating: draft.rating as ClientObservation['rating'],
      tags: draft.tags,
      comment: draft.comment.trim(),
    };
    updateClient(client.id, { behaviorLog: [...(client.behaviorLog ?? []), obs] } as Partial<Client>);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-slate-950/80 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-slate-900 border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto pb-safe sm:pb-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-white">{t('Observation sur le client')}</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {name} • {t('Contrat')} {contract.contractNumber}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('Fermer')}
            className="w-11 h-11 -m-2 flex items-center justify-center rounded-xl text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!client ? (
          <p className="text-xs text-rose-300">{t('Fiche client introuvable : impossible d\'enregistrer.')}</p>
        ) : (
          <>
            {summary.count > 0 && (
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <StandingBadge standing={summary.standing} average={summary.average} />
                <span>{t('{n} observation(s) déjà enregistrée(s)', { n: summary.count })}</span>
              </div>
            )}
            <ClientObservationForm value={draft} onChange={setDraft} />
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={onClose} className="min-h-11 px-4 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold cursor-pointer">
                {t('Annuler')}
              </button>
              <button
                type="button"
                disabled={draft.rating === null}
                onClick={save}
                className="min-h-11 px-4 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold disabled:opacity-40 cursor-pointer"
              >
                {t("Enregistrer l'observation")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
