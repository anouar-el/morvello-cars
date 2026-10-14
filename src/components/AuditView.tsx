import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { ShieldAlert, Search, History, Download, ExternalLink } from 'lucide-react';
import type { AuditLog } from '../types';
import {
  CATEGORY_LABELS,
  PERIOD_LABELS,
  auditLogsToCsv,
  categorize,
  filterAuditLogs,
  formatWhen,
  groupByDay,
  type AuditCategory,
  type AuditPeriod,
} from '../lib/auditPresentation';
import { requestEntityFocus } from '../lib/entityFocus';

import { useI18n } from '../i18n/I18nContext';
const PAGE_SIZE = 50;

const CATEGORY_STYLE: Record<AuditCategory, string> = {
  contrats: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  clients: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  vehicules: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  cautions: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  parametres: 'bg-slate-700/40 text-slate-300 border-slate-600/50',
  acces: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  autres: 'bg-slate-800 text-slate-300 border-slate-700',
};

export const AuditView: React.FC = () => {
  const { t } = useI18n();
  const { auditLogs, setActiveTab } = useApp();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<AuditCategory | 'all'>('all');
  const [user, setUser] = useState('all');
  const [period, setPeriod] = useState<AuditPeriod>('all');
  const [visible, setVisible] = useState(PAGE_SIZE);

  const agents = useMemo(
    () => Array.from(new Set(auditLogs.map((l) => l.userName).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [auditLogs]
  );

  const filtered = useMemo(
    () => filterAuditLogs(auditLogs, { query, category, user, period }),
    [auditLogs, query, category, user, period]
  );
  const shown = filtered.slice(0, visible);
  const groups = useMemo(() => groupByDay(shown), [shown]);

  const resetPaging = () => setVisible(PAGE_SIZE);

  const exportCsv = () => {
    const blob = new Blob(['﻿', auditLogsToCsv(filtered)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `journal-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openTarget = (log: AuditLog) => {
    const map: Partial<Record<AuditLog['targetType'], { kind: 'contract' | 'vehicle' | 'client'; tab: 'contracts' | 'vehicles' | 'clients' }>> = {
      contract: { kind: 'contract', tab: 'contracts' },
      vehicle: { kind: 'vehicle', tab: 'vehicles' },
      client: { kind: 'client', tab: 'clients' },
    };
    const target = map[log.targetType];
    if (!target || !log.targetId) return;
    requestEntityFocus(target.kind, log.targetId);
    setActiveTab(target.tab);
  };

  const isLinkable = (log: AuditLog) => ['contract', 'vehicle', 'client'].includes(log.targetType) && Boolean(log.targetId);

  const Badge = ({ log }: { log: AuditLog }) => {
    const cat = categorize(log);
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-semibold ${CATEGORY_STYLE[cat]}`}>
        {CATEGORY_LABELS[cat]}
      </span>
    );
  };

  const selectClass =
    'bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500';

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-rose-400 uppercase tracking-widest font-mono">
            <ShieldAlert className="w-4 h-4" />
            {t('Traçabilité')}
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight mt-1">{t('Journal des événements')}</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {t('Qui a fait quoi et quand : contrats, clients, véhicules, cautions et paramètres.')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs font-mono text-slate-300 flex items-center gap-2">
            <History className="w-4 h-4 text-amber-400" />
            <span>
              {filtered.length === auditLogs.length
                ? t('{auditLogsCount} événements', { auditLogsCount: auditLogs.length })
                : t('{filteredCount} sur {auditLogsCount}', { filteredCount: filtered.length, auditLogsCount: auditLogs.length })}
            </span>
          </div>
          <button
            type="button"
            onClick={exportCsv}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-700 text-slate-200 hover:bg-slate-800 text-xs font-medium cursor-pointer disabled:opacity-40"
            title={t('Exporter la sélection en CSV')}
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t('Exporter')}</span>
          </button>
        </div>
      </div>

      {/* RECHERCHE & FILTRES */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-md space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute start-3 top-3 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              resetPaging();
            }}
            placeholder={t('Rechercher (agent, contrat, client, motif)…')}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl ps-9 pe-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value as AuditCategory | 'all');
              resetPaging();
            }}
            className={selectClass}
            aria-label={t('Catégorie')}
          >
            <option value="all">{t('Toutes les catégories')}</option>
            {(Object.keys(CATEGORY_LABELS) as AuditCategory[]).map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>

          <select
            value={user}
            onChange={(e) => {
              setUser(e.target.value);
              resetPaging();
            }}
            className={selectClass}
            aria-label={t('Agent')}
          >
            <option value="all">{t('Tous les agents')}</option>
            {agents.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>

          <select
            value={period}
            onChange={(e) => {
              setPeriod(e.target.value as AuditPeriod);
              resetPaging();
            }}
            className={selectClass}
            aria-label={t('Période')}
          >
            {(Object.keys(PERIOD_LABELS) as AuditPeriod[]).map((p) => (
              <option key={p} value={p}>
                {PERIOD_LABELS[p]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* JOURNAL, GROUPÉ PAR JOUR */}
      <div className="space-y-5">
        {filtered.length === 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl text-center py-10 text-slate-500 text-xs">
            {t('Aucun événement ne correspond à ces filtres.')}
          </div>
        )}

        {groups.map((group, gi) => (
          <section key={`${group.heading}-${gi}`}>
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-2 px-1 capitalize">
              {group.heading}
            </h2>
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800">
              {group.logs.map((log) => (
                <div key={log.id} className="p-3.5 flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
                  <div className="sm:w-36 shrink-0 text-[11px] text-slate-400 font-mono">{formatWhen(log.timestamp)}</div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-white">{log.userName || t('Inconnu')}</span>
                      <span className="text-[10px] px-1.5 rounded bg-slate-800 text-slate-400 uppercase font-mono">
                        {log.userRole}
                      </span>
                      <Badge log={log} />
                      <span className="text-xs text-slate-200">{log.action}</span>
                    </div>
                    {log.details && <p className="mt-1 text-xs text-slate-400">{log.details}</p>}
                  </div>

                  <div className="shrink-0">
                    {isLinkable(log) ? (
                      <button
                        type="button"
                        onClick={() => openTarget(log)}
                        className="inline-flex items-center gap-1 text-xs font-mono font-bold text-amber-400 hover:text-amber-300 cursor-pointer"
                        title={t('Ouvrir dans l’application')}
                      >
                        <span className="truncate max-w-[180px]">{log.targetId}</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    ) : (
                      <span className="text-xs font-mono text-slate-500">{log.targetId}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}

        {filtered.length > shown.length && (
          <div className="text-center">
            <button
              type="button"
              onClick={() => setVisible((v) => v + PAGE_SIZE)}
              className="px-4 py-2 rounded-xl border border-slate-700 text-slate-200 hover:bg-slate-800 text-xs font-medium cursor-pointer"
            >
              {t('Voir plus ({filteredCount} restants)', { filteredCount: filtered.length - shown.length })}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
