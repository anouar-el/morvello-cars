import React, { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useI18n } from '../i18n/I18nContext';
import { getScopedDataForUser } from '../utils/managerScopeUtils';
import { getTodayDateString } from '../utils/vehicleExpiryUtils';
import { requestEntityFocus } from '../lib/entityFocus';
import { addDays, buildPlanning, isWeekend, PlanningBar, rangeDays } from '../lib/planning';
import { PageHeader } from './PageHeader';

const RANGES = [7, 14, 30] as const;
const COLUMN_MIN_PX = 44;
const LANE_PX = 30;

const barStyle = (bar: PlanningBar) =>
  bar.kind === 'reservation'
    ? 'bg-amber-500/15 text-amber-200 border border-dashed border-amber-400/70'
    : bar.overdue
    ? 'bg-rose-500/25 text-rose-100 border border-rose-400/60'
    : bar.done
    ? 'bg-slate-700/50 text-slate-300 border border-slate-600/60'
    : 'bg-blue-500/25 text-blue-100 border border-blue-400/50';

export const PlanningView: React.FC = () => {
  const { currentUser, vehicles, contracts, clients, deposits, users, setActiveTab } = useApp();
  const { t, lang } = useI18n();
  const today = getTodayDateString();
  const [startDate, setStartDate] = useState(() => addDays(today, -1));
  const [days, setDays] = useState<number>(() => (typeof window !== 'undefined' && window.innerWidth < 640 ? 7 : 14));

  const scoped = useMemo(
    () => (currentUser ? getScopedDataForUser(currentUser, vehicles, contracts, deposits, clients, users) : null),
    [currentUser, vehicles, contracts, deposits, clients, users]
  );

  const rows = useMemo(() => {
    if (!scoped) return [];
    const fleet = scoped.scopedVehicles
      .filter((v) => (v.approvalStatus ?? 'approved') === 'approved')
      .sort((a, b) => `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`));
    return buildPlanning({ vehicles: fleet, contracts: scoped.scopedContracts, clients: scoped.scopedClients, startDate, days, today });
  }, [scoped, startDate, days, today]);

  const dates = useMemo(() => rangeDays(startDate, days), [startDate, days]);
  const locale = lang === 'ar' ? 'ar-MA' : 'fr-FR';
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' });
  const monthLabel = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  const fmt = (d: string) => monthLabel.format(new Date(`${d}T00:00:00Z`));
  const freeToday = rows.filter((r) => r.freeToday).length;
  const step = Math.max(1, Math.floor(days / 2));

  const open = (bar: PlanningBar) => {
    if (bar.contract) {
      requestEntityFocus('contract', bar.contract.contractNumber);
      setActiveTab('contracts');
    } else if (bar.client) {
      requestEntityFocus('client', bar.client.lastName || bar.client.firstName);
      setActiveTab('clients');
    }
  };

  const gridCols = { gridTemplateColumns: `repeat(${days}, minmax(${COLUMN_MIN_PX}px, 1fr))` } as const;

  return (
    <div className="space-y-5">
      <PageHeader
        icon={<CalendarDays className="w-5 h-5" />}
        title={t('Planning des véhicules')}
        subtitle={t('Contrats et réservations jour par jour : repérez les véhicules libres avant de réserver.')}
      />

      {/* BARRE DE CONTRÔLE */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-3 rounded-xl">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setStartDate(addDays(startDate, -step))}
            aria-label={t('Période précédente')}
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
          </button>
          <button
            type="button"
            onClick={() => setStartDate(addDays(today, -1))}
            className="h-9 px-3 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-semibold cursor-pointer"
          >
            {t("Aujourd'hui")}
          </button>
          <button
            type="button"
            onClick={() => setStartDate(addDays(startDate, step))}
            aria-label={t('Période suivante')}
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 cursor-pointer"
          >
            <ChevronRight className="w-4 h-4 rtl:rotate-180" />
          </button>
          <span className="hidden sm:inline text-xs text-slate-400 ms-2">
            {fmt(dates[0])} → {fmt(dates[dates.length - 1])}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-emerald-400 font-semibold">{t("{n} libre(s) aujourd'hui", { n: freeToday })}</span>
          <div className="flex rounded-lg overflow-hidden border border-slate-700" role="group" aria-label={t('Durée affichée')}>
            {RANGES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setDays(r)}
                aria-pressed={days === r}
                className={`px-3 h-9 text-xs font-semibold cursor-pointer ${
                  days === r ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {t('{n} j', { n: r })}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* LÉGENDE */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-500/40 border border-blue-400/60" />{t('Location en cours')}</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-rose-500/40 border border-rose-400/60" />{t('Retour en retard')}</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border border-dashed border-amber-400" />{t('Réservation')}</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-slate-600/60 border border-slate-500/60" />{t('Terminée')}</span>
      </div>

      {rows.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-xs text-slate-400">
          {t('Aucun véhicule à afficher.')}
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-x-auto">
          <div style={{ minWidth: `${140 + days * COLUMN_MIN_PX}px` }}>
            {/* EN-TÊTE DES JOURS */}
            <div className="flex border-b border-slate-800 bg-slate-900/95">
              <div className="sticky start-0 z-20 w-[140px] shrink-0 bg-slate-900 border-e border-slate-800 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                {t('Véhicule')}
              </div>
              <div className="grid flex-1" style={gridCols}>
                {dates.map((d) => (
                  <div
                    key={d}
                    className={`text-center py-1.5 border-e border-slate-800/60 ${isWeekend(d) ? 'bg-slate-800/40' : ''} ${
                      d === today ? 'bg-amber-500/15' : ''
                    }`}
                  >
                    <div className="text-[10px] uppercase text-slate-500">{weekday.format(new Date(`${d}T00:00:00Z`))}</div>
                    <div className={`text-xs font-bold ${d === today ? 'text-amber-400' : 'text-slate-200'}`}>{Number(d.slice(8, 10))}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* LIGNES */}
            {rows.map((row) => (
              <div key={row.vehicle.id} className="flex border-b border-slate-800/70 last:border-b-0">
                <div className="sticky start-0 z-10 w-[140px] shrink-0 bg-slate-900 border-e border-slate-800 px-3 py-2 flex flex-col justify-center">
                  <span className="text-xs font-bold text-white leading-tight break-words">
                    {row.vehicle.brand} {row.vehicle.model}
                  </span>
                  <span className="text-[10px] font-mono text-amber-400">{row.vehicle.plate}</span>
                </div>

                <div className="relative flex-1">
                  {/* fond : week-ends et aujourd'hui */}
                  <div className="absolute inset-0 grid" style={gridCols} aria-hidden="true">
                    {dates.map((d) => (
                      <div
                        key={d}
                        className={`border-e border-slate-800/60 ${isWeekend(d) ? 'bg-slate-800/30' : ''} ${d === today ? 'bg-amber-500/10' : ''}`}
                      />
                    ))}
                  </div>

                  {/* barres */}
                  <div
                    className="relative grid items-center gap-y-0.5 p-0.5"
                    style={{ ...gridCols, gridAutoRows: `${LANE_PX}px`, minHeight: `${row.lanes * (LANE_PX + 2) + 4}px` }}
                  >
                    {row.bars.map((bar) => (
                      <button
                        key={bar.key}
                        type="button"
                        onClick={() => open(bar)}
                        title={
                          bar.contract
                            ? `${bar.contract.contractNumber} · ${bar.label} · ${bar.start} → ${bar.end}`
                            : `${t('Réservation')} · ${bar.label} · ${bar.start} → ${bar.end}`
                        }
                        style={{ gridColumn: `${bar.column + 1} / span ${bar.span}`, gridRow: bar.lane + 1 }}
                        className={`h-[28px] mx-px flex items-center px-2 text-[11px] font-semibold truncate cursor-pointer hover:brightness-125 transition-[filter] ${barStyle(bar)} ${
                          bar.clippedStart ? 'rounded-s-none' : 'rounded-s-lg'
                        } ${bar.clippedEnd ? 'rounded-e-none' : 'rounded-e-lg'}`}
                      >
                        <span className="truncate">{bar.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
