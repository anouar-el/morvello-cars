import React, { useCallback, useEffect, useState } from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import { getActiveAuthToken } from '../lib/authToken';
import type { UsageSummary } from '../lib/assistantUsage';

import { useI18n } from '../i18n/I18nContext';
const fmt = (n: number) => Math.round(n).toLocaleString('fr-FR');

/**
 * Consommation du jour de l'assistant IA (gérant). Les chiffres viennent de la mémoire du serveur :
 * ils repartent de zéro à chaque redémarrage ou déploiement.
 */
export const AssistantUsagePanel: React.FC = () => {
  const { t } = useI18n();
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { token } = await getActiveAuthToken({ forceRefresh: false });
      const res = await fetch('/api/assistant-usage', { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Consommation indisponible.');
      if (!data.usage) throw new Error('Réservé au gérant.');
      setUsage(data.usage as UsageSummary);
    } catch (e: any) {
      setError(e?.message || t('Consommation indisponible.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totals = usage?.totals;

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400">
            <Activity className="w-4 h-4" />
          </span>
          <div>
            <div className="text-sm font-bold text-white">{t('Consommation de l’assistant aujourd’hui')}</div>
            <div className="text-xs text-slate-400">
              {usage
                ? `Quota : ${usage.dailyLimit > 0 ? `${usage.dailyLimit} demandes / personne / jour` : 'illimité'} (gérant exempté)`
                : t('Demandes et jetons par collaborateur')}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 text-xs cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">{t('Actualiser')}</span>
        </button>
      </div>

      {error && <p className="mt-3 text-xs text-slate-400">{error}</p>}

      {usage && totals && (
        <>
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              ['Demandes', fmt(totals.requests)],
              ['Jetons entrée', fmt(totals.inputTokens)],
              ['Jetons sortie', fmt(totals.outputTokens)],
              ['Outils appelés', fmt(totals.toolCalls)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2">
                <div className="text-[10.5px] uppercase tracking-wide text-slate-500">{label}</div>
                <div className="text-base font-bold text-white font-mono">{value}</div>
              </div>
            ))}
          </div>

          <p className="mt-2 text-[11px] text-slate-500">
            {totals.estimatedCost !== null
              ? t('Coût estimé : {estimatedCost} (selon les tarifs configurés sur le serveur).', { estimatedCost: totals.estimatedCost.toFixed(2) })
              : t('Coût non estimé : renseignez ASSISTANT_PRICE_IN_PER_MTOK et ASSISTANT_PRICE_OUT_PER_MTOK sur le serveur.')}{' '}
            {t('Compteurs en mémoire : remis à zéro à chaque redémarrage du serveur.')}
          </p>

          {usage.users.length > 0 && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-start text-xs text-slate-300">
                <thead className="text-[10.5px] uppercase text-slate-500">
                  <tr>
                    <th className="py-1.5 pe-3">{t('Collaborateur')}</th>
                    <th className="py-1.5 pe-3 text-end">{t('Demandes')}</th>
                    <th className="py-1.5 pe-3 text-end">{t('Jetons')}</th>
                    <th className="py-1.5 text-end">{t('Outils')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {usage.users.map((u) => (
                    <tr key={u.uid}>
                      <td className="py-1.5 pe-3 font-medium text-white">{u.name || u.uid.slice(0, 8)}</td>
                      <td className="py-1.5 pe-3 text-end font-mono">{fmt(u.requests)}</td>
                      <td className="py-1.5 pe-3 text-end font-mono">{fmt(u.inputTokens + u.outputTokens)}</td>
                      <td className="py-1.5 text-end font-mono">{fmt(u.toolCalls)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
};
