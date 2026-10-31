import React, { useMemo, useState } from 'react';
import { BarChart3, Download } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useI18n } from '../i18n/I18nContext';
import { getScopedDataForUser } from '../utils/managerScopeUtils';
import { getTodayDateString } from '../utils/vehicleExpiryUtils';
import { periodRange, type PeriodPreset } from '../lib/cashbook';
import { buildReport, monthlySeries, reportToCsv } from '../lib/reports';
import { PageHeader } from './PageHeader';

const PERIODS: PeriodPreset[] = ['week', 'month', 'lastMonth', 'year'];

export const ReportsView: React.FC = () => {
  const { currentUser, vehicles, contracts, clients, deposits, users } = useApp();
  const { t, lang } = useI18n();
  const today = getTodayDateString();
  const [preset, setPreset] = useState<PeriodPreset>('month');

  const scoped = useMemo(
    () => (currentUser ? getScopedDataForUser(currentUser, vehicles, contracts, deposits, clients, users) : null),
    [currentUser, vehicles, contracts, deposits, clients, users]
  );
  const fleet = useMemo(() => (scoped ? scoped.scopedVehicles.filter((v) => (v.approvalStatus ?? 'approved') === 'approved') : []), [scoped]);
  const range = useMemo(() => periodRange(preset, today), [preset, today]);
  const report = useMemo(() => (scoped ? buildReport(scoped.scopedContracts, fleet, range) : null), [scoped, fleet, range]);
  const series = useMemo(() => (scoped ? monthlySeries(scoped.scopedContracts, fleet, today, 6) : []), [scoped, fleet, today]);

  if (!currentUser || !scoped || !report) return null;

  if (currentUser.role === 'agent') {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-xl mx-auto text-center space-y-2 my-8">
        <h2 className="text-lg font-bold text-white">{t('Accès réservé au Gérant et aux Responsables')}</h2>
        <p className="text-xs text-slate-400">{t("Les rapports regroupent le chiffre d'affaires et les résultats de l'agence.")}</p>
      </div>
    );
  }

  const locale = lang === 'ar' ? 'ar-MA' : 'fr-FR';
  const num = (n: number) => Math.round(n).toLocaleString(locale);
  const pct = (n: number) => `${Math.round(n * 100)} %`;
  const monthName = new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' });
  const maxSeries = Math.max(1, ...series.flatMap((p) => [p.collected, p.expenses]));
  const hasActivity = report.contractsCount > 0 || report.collected > 0 || report.expenses > 0 || report.vehicles.some((v) => v.rentalDays > 0);

  const periodLabel: Record<PeriodPreset, string> = {
    today: t("Aujourd'hui"),
    week: t('7 derniers jours'),
    month: t('Ce mois'),
    lastMonth: t('Mois dernier'),
    year: t('Cette année'),
  };

  const exportCsv = () => {
    const csv = reportToCsv(report.vehicles, [
      t('Véhicule'),
      t('Plaque'),
      t('Jours loués'),
      t('Occupation (%)'),
      t('Contrats'),
      t('Facturé'),
      t('Encaissé'),
      t('Dépenses'),
      t('Résultat'),
    ]);
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `rapport_${range.from}_${range.to}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const kpis: Array<{ label: string; value: string; unit?: string; tone: string }> = [
    { label: t("Taux d'occupation"), value: pct(report.occupancy), tone: 'text-blue-300' },
    { label: t("Chiffre d'affaires"), value: num(report.billed), unit: 'MAD', tone: 'text-white' },
    { label: t('Encaissé'), value: num(report.collected), unit: 'MAD', tone: 'text-emerald-400' },
    { label: t('Dépenses'), value: num(report.expenses), unit: 'MAD', tone: 'text-rose-400' },
    { label: t('Résultat'), value: `${report.net > 0 ? '+' : ''}${num(report.net)}`, unit: 'MAD', tone: report.net >= 0 ? 'text-amber-400' : 'text-rose-400' },
    { label: t('Reste à encaisser'), value: num(report.outstanding), unit: 'MAD', tone: report.outstanding > 0 ? 'text-amber-300' : 'text-slate-300' },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        icon={<BarChart3 className="w-5 h-5" />}
        title={t('Rapports')}
        subtitle={t("Occupation de la flotte, chiffre d'affaires et rentabilité sur la période.")}
        actions={[{ label: t('Exporter en CSV'), icon: <Download className="w-4 h-4 text-slate-400" />, onClick: exportCsv, disabled: !hasActivity }]}
      />

      <div className="flex flex-wrap gap-2" role="group" aria-label={t('Période')}>
        {PERIODS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPreset(p)}
            aria-pressed={preset === p}
            className={`px-3 min-h-9 rounded-full text-xs font-semibold border cursor-pointer ${
              preset === p ? 'bg-amber-500 text-slate-950 border-amber-400' : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
            }`}
          >
            {periodLabel[p]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="glass rounded-2xl p-4">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{k.label}</p>
            <p className={`text-xl sm:text-2xl font-black font-mono mt-1 ${k.tone}`}>
              {k.value} {k.unit && <span className="text-xs font-sans text-slate-400">{k.unit}</span>}
            </p>
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-400">
        {t('{n} contrat(s) commencé(s) · durée moyenne {d} j · {m} MAD par contrat', {
          n: report.contractsCount,
          d: (Math.round(report.avgDays * 10) / 10).toLocaleString(locale),
          m: num(report.avgBilled),
        })}
      </p>

      {/* ÉVOLUTION */}
      <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-white">{t('Évolution sur 6 mois')}</h2>
          <div className="flex items-center gap-3 text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/80" />{t('Encaissé')}</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-rose-500/80" />{t('Dépenses')}</span>
          </div>
        </div>
        <div className="grid grid-cols-6 gap-2 items-end h-40">
          {series.map((p) => (
            <div key={p.month} className="flex flex-col items-center justify-end h-full gap-1" title={`${p.month} — ${num(p.collected)} / ${num(p.expenses)} MAD`}>
              <div className="flex items-end gap-1 w-full justify-center flex-1">
                <div className="w-1/3 max-w-5 rounded-t bg-emerald-500/80" style={{ height: `${(p.collected / maxSeries) * 100}%`, minHeight: p.collected > 0 ? 2 : 0 }} />
                <div className="w-1/3 max-w-5 rounded-t bg-rose-500/80" style={{ height: `${(p.expenses / maxSeries) * 100}%`, minHeight: p.expenses > 0 ? 2 : 0 }} />
              </div>
              <span className="text-[10px] text-slate-400 uppercase">{monthName.format(new Date(`${p.month}-01T00:00:00Z`))}</span>
            </div>
          ))}
        </div>
      </section>

      {!hasActivity ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-xs text-slate-400">{t('Aucune activité sur cette période.')}</div>
      ) : (
        <>
          {/* PAR VÉHICULE */}
          <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-3">
            <h2 className="text-sm font-bold text-white">{t('Rentabilité par véhicule')}</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[640px]">
                <thead>
                  <tr className="text-slate-500 text-[11px] uppercase tracking-wider">
                    <th className="text-start font-semibold pb-2">{t('Véhicule')}</th>
                    <th className="text-start font-semibold pb-2 w-40">{t('Occupation')}</th>
                    <th className="text-end font-semibold pb-2">{t('Contrats')}</th>
                    <th className="text-end font-semibold pb-2">{t('Facturé')}</th>
                    <th className="text-end font-semibold pb-2">{t('Encaissé')}</th>
                    <th className="text-end font-semibold pb-2">{t('Dépenses')}</th>
                    <th className="text-end font-semibold pb-2">{t('Résultat')}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.vehicles.map((v) => (
                    <tr key={v.vehicleId} className="border-t border-slate-800/70">
                      <td className="py-2 pe-2">
                        <span className="font-semibold text-white">{v.label}</span> <span className="font-mono text-amber-400">{v.plate}</span>
                      </td>
                      <td className="py-2 pe-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 rounded-full bg-slate-800 overflow-hidden">
                            <div className="h-full bg-blue-500/80" style={{ width: pct(v.occupancy) }} />
                          </div>
                          <span className="font-mono text-slate-300 w-10 text-end">{pct(v.occupancy)}</span>
                        </div>
                      </td>
                      <td className="py-2 text-end font-mono text-slate-300">{v.contracts}</td>
                      <td className="py-2 text-end font-mono text-slate-200">{num(v.billed)}</td>
                      <td className="py-2 text-end font-mono text-emerald-300">{num(v.collected)}</td>
                      <td className="py-2 text-end font-mono text-rose-300">{num(v.expenses)}</td>
                      <td className={`py-2 text-end font-mono font-bold ${v.net >= 0 ? 'text-amber-400' : 'text-rose-400'}`}>{num(v.net)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* MEILLEURS CLIENTS */}
          {report.topClients.length > 0 && (
            <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-3">
              <h2 className="text-sm font-bold text-white">{t('Meilleurs clients')}</h2>
              <ul className="divide-y divide-slate-800/70">
                {report.topClients.map((c, i) => (
                  <li key={c.key} className="py-2.5 flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                    <span className="min-w-0 flex-1 text-xs font-semibold text-white truncate">{c.name}</span>
                    <span className="text-[11px] text-slate-400 shrink-0">{t('{n} contrat(s)', { n: c.contracts })}</span>
                    <span className="font-mono text-sm font-bold text-amber-400 shrink-0">{num(c.billed)} MAD</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
};
