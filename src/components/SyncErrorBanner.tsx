import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  X,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import {
  subscribeToSyncErrors,
  clearSyncError,
  SupabaseSyncError,
} from '../lib/supabaseSync';

export const SyncErrorBanner: React.FC = () => {
  const [syncError, setSyncError] = useState<SupabaseSyncError | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToSyncErrors((err) => {
      setSyncError(err);
    });
    return unsubscribe;
  }, []);

  if (!syncError) return null;

  const isRls =
    syncError.code === '42501' ||
    syncError.message?.toLowerCase().includes('row-level security') ||
    syncError.message?.toLowerCase().includes('violates row-level');

  const tableLabels: Record<string, string> = {
    contracts: 'Contrats',
    deposits: 'Cautions',
    vehicles: 'Véhicules',
    clients: 'Clients',
    agency_data: 'Données Agence',
    profiles: 'Profils',
  };

  const tableLabel = tableLabels[syncError.table] || syncError.table;

  return (
    <div
      role="alert"
      className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 pt-3 pb-1 no-print animate-fade-in"
    >
      <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-xl border border-rose-500/40 bg-gradient-to-r from-rose-950/90 via-slate-900/95 to-slate-900/90 text-slate-200 shadow-xl backdrop-blur-md">
        <div className="flex items-start sm:items-center gap-3">
          <div className="p-2 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/30 shrink-0 mt-0.5 sm:mt-0">
            {isRls ? (
              <ShieldAlert className="w-5 h-5 text-rose-400 animate-pulse" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            )}
          </div>

          <div className="space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-300">
                {isRls ? 'Avertissement Sécurité RLS' : 'Incident de Synchronisation'}
              </span>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-rose-500/20 text-rose-200 border border-rose-500/30">
                {syncError.code || 'ERR'}
              </span>
              <span className="text-xs text-slate-400">
                sur <strong className="text-slate-200">{tableLabel}</strong>
                {syncError.entityId && (
                  <span className="font-mono text-slate-300"> ({syncError.entityId})</span>
                )}
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-snug">
              {isRls
                ? `La politique RLS Supabase interdit l'écriture sur cette fiche pour le compte actuel.`
                : syncError.message}
            </p>

            {showDetails && (
              <div className="mt-2 p-2 rounded-md bg-slate-950/80 border border-slate-800 text-[11px] font-mono text-slate-400 space-y-1">
                <div>
                  <strong>Erreur :</strong> {syncError.message}
                </div>
                {syncError.details && (
                  <div>
                    <strong>Détails :</strong> {syncError.details}
                  </div>
                )}
                <div>
                  <strong>Horodatage :</strong> {new Date(syncError.timestamp).toLocaleTimeString()}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 px-2 py-1 rounded bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 transition-colors"
          >
            {showDetails ? (
              <>
                Masquer <ChevronUp className="w-3 h-3" />
              </>
            ) : (
              <>
                Détails <ChevronDown className="w-3 h-3" />
              </>
            )}
          </button>

          <button
            type="button"
            onClick={clearSyncError}
            className="p-1 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800/80 transition-colors"
            title="Ignorer l'alerte"
            aria-label="Ignorer l'alerte"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
