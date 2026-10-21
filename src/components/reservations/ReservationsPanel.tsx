import React, { useState } from 'react';
import { CalendarClock, FilePlus, Pencil, Plus, XCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useI18n } from '../../i18n/I18nContext';
import { getScopedDataForUser } from '../../utils/managerScopeUtils';
import { getTodayDateString } from '../../utils/vehicleExpiryUtils';
import {
  activeReservations,
  patchReservation,
  reservationTiming,
  toContractDraft,
  type ReservationEntry,
  type ReservationTiming,
} from '../../lib/reservations';
import { setReservationDraft } from '../../lib/reservationHandoff';
import { canAccessObservations, needsAttention, summarizeObservations } from '../../lib/clientObservations';
import type { Client } from '../../types';
import { ReservationModal } from './ReservationModal';

const TIMING_STYLE: Record<ReservationTiming, string> = {
  overdue: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
  today: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  soon: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  upcoming: 'bg-slate-800 text-slate-300 border-slate-700',
};

/** Réservations sans contrat : à venir, du jour et oubliées. Entrée principale pour en créer une. */
export const ReservationsPanel: React.FC = () => {
  const { t } = useI18n();
  const { clients, vehicles, contracts, deposits, users, currentUser, updateClient, setActiveTab } = useApp();
  const [modal, setModal] = useState<{ editing?: ReservationEntry } | null>(null);

  const { scopedClients } = getScopedDataForUser(currentUser, vehicles, contracts, deposits, clients, users);
  const today = getTodayDateString();
  const entries = activeReservations(scopedClients, contracts);
  const showStanding = canAccessObservations(currentUser?.role);

  const convert = (entry: ReservationEntry) => {
    setReservationDraft(toContractDraft(entry));
    setActiveTab('new_contract');
  };

  const cancel = (entry: ReservationEntry) => {
    if (!window.confirm(t('Annuler cette réservation ?'))) return;
    updateClient(entry.client.id, {
      reservations: patchReservation(entry.client.reservations, entry.reservation.id, { status: 'cancelled' }),
    } as Partial<Client>);
  };

  const timingText = (entry: ReservationEntry): string => {
    const { timing, daysUntil } = reservationTiming(entry.reservation, today);
    if (timing === 'overdue') return t('En retard de {n} j', { n: Math.abs(daysUntil) });
    if (timing === 'today') return t("Aujourd'hui à {time}", { time: entry.reservation.startTime });
    if (timing === 'soon') return t('Dans {n} j', { n: daysUntil });
    return new Date(entry.reservation.startDate).toLocaleDateString('fr-FR');
  };

  return (
    <section className="glass rounded-3xl p-4 sm:p-5 space-y-3" aria-label={t('Réservations à venir')}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 shrink-0 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center">
            <CalendarClock className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-white">{t('Réservations à venir')}</h2>
            <p className="text-[11px] text-slate-400">{t('Prises sans contrat : à transformer le jour du départ.')}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setModal({})}
          className="shrink-0 inline-flex items-center gap-1.5 min-h-11 px-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 text-xs font-bold active:scale-95 transition-transform cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          {t('Réservation')}
        </button>
      </div>

      {entries.length === 0 ? (
        <p className="text-xs text-slate-400 py-2">{t("Aucune réservation en attente. Notez ici les clients qui réservent sans contrat pour ne plus les oublier.")}</p>
      ) : (
        <ul className="space-y-2">
          {entries.map((entry) => {
            const { timing } = reservationTiming(entry.reservation, today);
            const r = entry.reservation;
            const flagged = showStanding && needsAttention(summarizeObservations(entry.client.behaviorLog));
            return (
              <li key={r.id} className="rounded-2xl border border-white/10 bg-white/5 p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white truncate">
                      {entry.client.lastName} {entry.client.firstName}
                      {flagged && <span className="ms-2 text-[11px] text-amber-300 font-semibold">⚠ {t('À surveiller')}</span>}
                    </div>
                    <div className="text-[11px] text-slate-300 mt-0.5">
                      {r.vehicleLabel || t('Véhicule à définir')}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {new Date(r.startDate).toLocaleDateString('fr-FR')} {r.startTime} → {new Date(r.endDate).toLocaleDateString('fr-FR')} {r.endTime}
                      {r.deposit ? ` • ${t('Acompte {amount} MAD', { amount: r.deposit.toLocaleString('fr-FR') })}` : ''}
                    </div>
                    {r.note && <div className="text-[11px] text-slate-400 italic mt-0.5">{r.note}</div>}
                  </div>
                  <span className={`shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full border ${TIMING_STYLE[timing]}`}>{timingText(entry)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => convert(entry)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 min-h-11 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold hover:bg-emerald-500/30 cursor-pointer"
                  >
                    <FilePlus className="w-4 h-4" />
                    {t('Créer le contrat')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setModal({ editing: entry })}
                    aria-label={t('Modifier')}
                    className="w-11 h-11 flex items-center justify-center rounded-xl border border-white/10 text-slate-300 hover:text-white cursor-pointer"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => cancel(entry)}
                    aria-label={t('Annuler la réservation')}
                    className="w-11 h-11 flex items-center justify-center rounded-xl border border-white/10 text-slate-400 hover:text-rose-400 cursor-pointer"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {modal && <ReservationModal editing={modal.editing} onClose={() => setModal(null)} />}
    </section>
  );
};
