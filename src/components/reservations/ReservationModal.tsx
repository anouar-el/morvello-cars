import React, { useMemo, useState } from 'react';
import { AlertTriangle, Search, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useI18n } from '../../i18n/I18nContext';
import { getScopedDataForUser } from '../../utils/managerScopeUtils';
import { getTodayDateString } from '../../utils/vehicleExpiryUtils';
import { formatPlateFrench } from '../../utils/plateUtils';
import { canAccessObservations, needsAttention, summarizeObservations } from '../../lib/clientObservations';
import {
  findVehicleConflicts,
  newReservationId,
  patchReservation,
  validateReservationDates,
  type ReservationEntry,
} from '../../lib/reservations';
import type { Client, Reservation } from '../../types';
import { StandingBadge } from '../clients/ClientObservationsPanel';

interface Props {
  /** Client déjà choisi (depuis sa fiche). */
  clientId?: string;
  /** Réservation à modifier. */
  editing?: ReservationEntry;
  onClose: () => void;
}

const addDays = (isoDate: string, days: number): string => {
  const d = new Date(`${isoDate}T12:00:00`);
  d.setDate(d.getDate() + days);
  return getTodayDateString(d);
};

const inputCls =
  'w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white placeholder:text-slate-500 focus:border-amber-500 focus:outline-none';

export const ReservationModal: React.FC<Props> = ({ clientId, editing, onClose }) => {
  const { t } = useI18n();
  const { clients, vehicles, contracts, deposits, users, currentUser, updateClient } = useApp();

  const { scopedClients, scopedVehicles } = getScopedDataForUser(currentUser, vehicles, contracts, deposits, clients, users);
  const bookable = scopedVehicles.filter((v) => v.approvalStatus !== 'pending_approval' && v.approvalStatus !== 'rejected');

  const today = getTodayDateString();
  const existing = editing?.reservation;
  const [pickedId, setPickedId] = useState<string>(editing?.client.id ?? clientId ?? '');
  const [query, setQuery] = useState('');
  const [vehicleId, setVehicleId] = useState(existing?.vehicleId ?? '');
  const [startDate, setStartDate] = useState(existing?.startDate ?? today);
  const [startTime, setStartTime] = useState(existing?.startTime ?? '10:00');
  const [endDate, setEndDate] = useState(existing?.endDate ?? addDays(today, 1));
  const [endTime, setEndTime] = useState(existing?.endTime ?? '18:00');
  const [deposit, setDeposit] = useState<string>(existing?.deposit ? String(existing.deposit) : '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [error, setError] = useState('');

  const picked: Client | undefined = clients.find((c) => c.id === pickedId);
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return scopedClients
      .filter((c) => `${c.lastName} ${c.firstName} ${c.phone ?? ''} ${c.docNumber}`.toLowerCase().includes(q))
      .slice(0, 6);
  }, [query, scopedClients]);

  const summary = summarizeObservations(picked?.behaviorLog);
  const showStanding = canAccessObservations(currentUser?.role) && needsAttention(summary);

  const conflicts = findVehicleConflicts({
    clients,
    contracts,
    vehicleId,
    startDate,
    endDate,
    ignoreReservationId: existing?.id,
  });
  const hasConflict = conflicts.reservations.length + conflicts.contracts.length > 0;

  const save = () => {
    if (!picked) {
      setError(t('Choisissez un client.'));
      return;
    }
    const dateError = validateReservationDates({ startDate, endDate });
    if (dateError) {
      setError(t(dateError));
      return;
    }
    const vehicle = bookable.find((v) => v.id === vehicleId);
    const fields: Partial<Reservation> = {
      startDate,
      startTime,
      endDate,
      endTime,
      vehicleId: vehicle?.id,
      vehicleLabel: vehicle ? `${vehicle.brand} ${vehicle.model} ${formatPlateFrench(vehicle.plate)}` : undefined,
      deposit: Number(deposit) > 0 ? Number(deposit) : undefined,
      note: note.trim() || undefined,
    };
    if (existing) {
      updateClient(picked.id, { reservations: patchReservation(picked.reservations, existing.id, fields) } as Partial<Client>);
    } else {
      const created: Reservation = {
        id: newReservationId(),
        createdAt: new Date().toISOString(),
        createdBy: currentUser?.name || 'Agence',
        status: 'active',
        startDate,
        startTime,
        endDate,
        endTime,
        ...fields,
      };
      updateClient(picked.id, { reservations: [...(picked.reservations ?? []), created] } as Partial<Client>);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-slate-950/80 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-slate-900 border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto pb-safe sm:pb-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-white">{existing ? t('Modifier la réservation') : t('Nouvelle réservation')}</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">{t('Sans contrat : à transformer en contrat le jour du départ.')}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={t('Fermer')} className="w-11 h-11 -m-2 flex items-center justify-center rounded-xl text-slate-400 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* CLIENT */}
        <div className="space-y-1.5">
          <label className="block text-[11px] font-semibold text-slate-300">{t('Client')}</label>
          {picked ? (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5">
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate">
                  {picked.lastName} {picked.firstName}
                </div>
                <div className="text-[11px] text-slate-400 font-mono">{picked.phone || picked.docNumber}</div>
              </div>
              {!existing && !clientId && (
                <button type="button" onClick={() => setPickedId('')} className="text-[11px] text-amber-300 font-semibold min-h-11 px-2 cursor-pointer">
                  {t('Changer')}
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('Nom, téléphone ou CIN…')}
                  className={`${inputCls} ps-9`}
                  autoFocus
                />
              </div>
              {query.trim() && matches.length === 0 && (
                <p className="text-[11px] text-slate-400">{t("Aucun client trouvé. Créez d'abord sa fiche dans « Clients ».")}</p>
              )}
              {matches.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setPickedId(c.id)}
                  className="w-full text-start rounded-xl border border-slate-800 hover:border-amber-500/50 bg-slate-950/60 px-3 py-2.5 min-h-11 cursor-pointer"
                >
                  <div className="text-xs font-bold text-white">
                    {c.lastName} {c.firstName}
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">{c.phone || c.docNumber}</div>
                </button>
              ))}
            </>
          )}
          {picked && showStanding && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
              <StandingBadge standing={summary.standing} average={summary.average} />
              <span>{t('Consultez son historique avant de confirmer.')}</span>
            </div>
          )}
        </div>

        {/* VÉHICULE */}
        <div className="space-y-1.5">
          <label className="block text-[11px] font-semibold text-slate-300">{t('Véhicule (facultatif)')}</label>
          <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} className={inputCls}>
            <option value="">{t('À définir plus tard')}</option>
            {bookable.map((v) => (
              <option key={v.id} value={v.id}>
                {v.brand} {v.model} — {formatPlateFrench(v.plate)}
              </option>
            ))}
          </select>
        </div>

        {/* DATES */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold text-slate-300">{t('Départ')}</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold text-slate-300">{t('Retour')}</label>
            <input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} />
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputCls} />
          </div>
        </div>

        {hasConflict && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-[11px] text-amber-200 space-y-1" role="alert">
            <div className="flex items-center gap-1.5 font-bold">
              <AlertTriangle className="w-4 h-4" />
              {t('Ce véhicule est déjà pris sur ces dates')}
            </div>
            {conflicts.contracts.map((c) => (
              <div key={c.id}>
                {t('Contrat')} {c.contractNumber} — {c.startDate} → {c.prolongation?.isActive && c.prolongation.newEndDate ? c.prolongation.newEndDate : c.endDate}
              </div>
            ))}
            {conflicts.reservations.map((e) => (
              <div key={e.reservation.id}>
                {t('Réservation')} {e.client.lastName} — {e.reservation.startDate} → {e.reservation.endDate}
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold text-slate-300">{t('Acompte reçu (MAD)')}</label>
            <input type="number" min={0} inputMode="numeric" value={deposit} onChange={(e) => setDeposit(e.target.value)} placeholder="0" className={inputCls} />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-[11px] font-semibold text-slate-300">{t('Note')}</label>
          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('Demande particulière, lieu de remise…')} className={inputCls} />
        </div>

        {error && (
          <p className="text-[11px] text-rose-300" role="alert">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="min-h-11 px-4 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold cursor-pointer">
            {t('Annuler')}
          </button>
          <button type="button" onClick={save} className="min-h-11 px-5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 text-xs font-bold cursor-pointer">
            {existing ? t('Enregistrer') : t('Réserver')}
          </button>
        </div>
      </div>
    </div>
  );
};
