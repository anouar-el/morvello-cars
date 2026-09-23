import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  X,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  RefreshCw,
  Copy,
  Check,
  Database,
} from 'lucide-react';
import {
  subscribeToSyncErrors,
  clearSyncError,
  SupabaseSyncError,
} from '../lib/supabaseSync';

const FIX_SQL_SCRIPT = `-- MORVELLO CARS - Migration Colonnes & Cache Supabase
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS assigned_manager_id TEXT;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS assigned_manager_id TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE public.deposits ADD COLUMN IF NOT EXISTS assigned_manager_id TEXT;
ALTER TABLE public.deposits ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS assigned_manager_id TEXT;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS created_by TEXT;

CREATE INDEX IF NOT EXISTS idx_contracts_assigned_manager ON public.contracts(assigned_manager_id);
CREATE INDEX IF NOT EXISTS idx_clients_assigned_manager ON public.clients(assigned_manager_id);
CREATE INDEX IF NOT EXISTS idx_deposits_assigned_manager ON public.deposits(assigned_manager_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_assigned_manager ON public.vehicles(assigned_manager_id);

NOTIFY pgrst, 'reload schema';`;

const FIX_RLS_SQL_SCRIPT = `-- MORVELLO CARS - Déblocage RLS des Gestionnaires (Ouahib, Said, etc.)
CREATE OR REPLACE FUNCTION public.can_access_manager_row(row_assigned_manager_id text, row_created_by text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    public.is_admin()
    OR (
      auth.uid() IS NOT NULL AND (
        row_assigned_manager_id IS NULL
        OR trim(row_assigned_manager_id) = ''
        OR (row_assigned_manager_id = auth.uid()::text)
        OR (row_created_by IS NOT NULL AND row_created_by = auth.uid()::text)
        OR ((auth.jwt()->>'email' ILIKE '%said%' OR auth.jwt()->>'email' ILIKE '%khomri%') 
            AND ((row_assigned_manager_id ILIKE '%usr-2%' OR row_assigned_manager_id ILIKE '%said%') 
                 OR (row_created_by ILIKE '%usr-2%' OR row_created_by ILIKE '%said%')))
        OR (auth.jwt()->>'email' ILIKE '%ouahib%' 
            AND ((row_assigned_manager_id ILIKE '%usr-3%' OR row_assigned_manager_id ILIKE '%ouahib%')
                 OR (row_created_by ILIKE '%usr-3%' OR row_created_by ILIKE '%ouahib%')))
        OR (auth.jwt()->>'email' ILIKE '%benali%' 
            AND ((row_assigned_manager_id ILIKE '%usr-1%' OR row_assigned_manager_id ILIKE '%benali%')
                 OR (row_created_by ILIKE '%usr-1%' OR row_created_by ILIKE '%benali%')))
        OR (auth.jwt()->>'email' ILIKE '%ezzay%' 
            AND ((row_assigned_manager_id ILIKE '%usr-5%' OR row_assigned_manager_id ILIKE '%ezzay%')
                 OR (row_created_by ILIKE '%usr-5%' OR row_created_by ILIKE '%ezzay%')))
        OR (auth.jwt()->>'email' ILIKE '%larbi%' 
            AND ((row_assigned_manager_id ILIKE '%usr-6%' OR row_assigned_manager_id ILIKE '%larbi%')
                 OR (row_created_by ILIKE '%usr-6%' OR row_created_by ILIKE '%larbi%')))
        OR EXISTS (
          SELECT 1 FROM public.profiles p 
          WHERE p.id = auth.uid()::text 
          AND (
            (row_assigned_manager_id IS NOT NULL AND (
              p.id = row_assigned_manager_id 
              OR p.name = row_assigned_manager_id
              OR (p.local_id IS NOT NULL AND p.local_id = row_assigned_manager_id)
              OR (p.name ILIKE '%said%' AND (row_assigned_manager_id ILIKE '%usr-2%' OR row_assigned_manager_id ILIKE '%said%'))
              OR (p.name ILIKE '%ouahib%' AND (row_assigned_manager_id ILIKE '%usr-3%' OR row_assigned_manager_id ILIKE '%ouahib%'))
              OR (p.name ILIKE '%benali%' AND (row_assigned_manager_id ILIKE '%usr-1%' OR row_assigned_manager_id ILIKE '%benali%'))
            ))
            OR (row_created_by IS NOT NULL AND (
              p.id = row_created_by 
              OR p.name = row_created_by 
              OR (p.local_id IS NOT NULL AND p.local_id = row_created_by)
              OR (p.name ILIKE '%said%' AND (row_created_by ILIKE '%usr-2%' OR row_created_by ILIKE '%said%'))
              OR (p.name ILIKE '%ouahib%' AND (row_created_by ILIKE '%usr-3%' OR row_created_by ILIKE '%ouahib%'))
            ))
          )
        )
      )
    );
$$;

UPDATE public.contracts 
SET assigned_manager_id = 'usr-3' 
WHERE contract_number = 'MC-2026-0050' OR id = 'cnt-1789166132353';

NOTIFY pgrst, 'reload schema';`;

export const SyncErrorBanner: React.FC = () => {
  const [syncError, setSyncError] = useState<SupabaseSyncError | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

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

  const isSchemaCache =
    syncError.code === 'PGRST204' ||
    syncError.message?.toLowerCase().includes('schema cache') ||
    syncError.message?.toLowerCase().includes('could not find the');

  const tableLabels: Record<string, string> = {
    contracts: 'Contrats',
    deposits: 'Cautions',
    vehicles: 'Véhicules',
    clients: 'Clients',
    agency_data: 'Données Agence',
    profiles: 'Profils',
  };

  const tableLabel = tableLabels[syncError.table] || syncError.table;

  const activeSqlScript = isRls ? FIX_RLS_SQL_SCRIPT : FIX_SQL_SCRIPT;

  const handleCopySql = async () => {
    try {
      await navigator.clipboard.writeText(activeSqlScript);
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 3000);
    } catch {
      // Fallback
    }
  };

  return (
    <div
      role="alert"
      className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 pt-3 pb-1 no-print animate-fade-in"
    >
      <div
        className={`relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-xl border backdrop-blur-md shadow-xl text-slate-200 ${
          isSchemaCache
            ? 'border-amber-500/40 bg-gradient-to-r from-amber-950/80 via-slate-900/95 to-slate-900/90'
            : isRls
            ? 'border-rose-500/40 bg-gradient-to-r from-rose-950/90 via-slate-900/95 to-slate-900/90'
            : 'border-rose-500/40 bg-gradient-to-r from-rose-950/90 via-slate-900/95 to-slate-900/90'
        }`}
      >
        <div className="flex items-start sm:items-center gap-3">
          <div
            className={`p-2 rounded-lg shrink-0 mt-0.5 sm:mt-0 border ${
              isSchemaCache
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                : isRls
                ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
            }`}
          >
            {isSchemaCache ? (
              <Database className="w-5 h-5 text-amber-400" />
            ) : isRls ? (
              <ShieldAlert className="w-5 h-5 text-rose-400 animate-pulse" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            )}
          </div>

          <div className="space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`text-xs font-bold uppercase tracking-wider ${
                  isSchemaCache ? 'text-amber-300' : 'text-rose-300'
                }`}
              >
                {isSchemaCache
                  ? 'Mise à jour requise du schéma Supabase'
                  : isRls
                  ? 'Avertissement Sécurité RLS'
                  : 'Incident de Synchronisation'}
              </span>
              <span
                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono border ${
                  isSchemaCache
                    ? 'bg-amber-500/20 text-amber-200 border-amber-500/30'
                    : 'bg-rose-500/20 text-rose-200 border-rose-500/30'
                }`}
              >
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
              {isSchemaCache
                ? `La colonne 'assigned_manager_id' est absente ou non indexée dans le cache PostgREST. Le mode de repli sécurisé a sauvegardé les données dans 'data' (JSONB).`
                : isRls
                ? `La politique RLS Supabase interdit l'écriture sur cette fiche pour le compte actuel.`
                : syncError.message}
            </p>

            {(isSchemaCache || isRls) && (
              <div className="pt-1 flex items-center gap-2 flex-wrap text-xs">
                <button
                  type="button"
                  onClick={handleCopySql}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-colors text-xs ${
                    isRls
                      ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40'
                      : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40'
                  }`}
                >
                  {copiedSql ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-300 font-bold">SQL copié dans le presse-papiers !</span>
                    </>
                  ) : (
                    <>
                      <Copy className={`w-3.5 h-3.5 ${isRls ? 'text-rose-400' : 'text-amber-400'}`} />
                      <span>
                        {isRls
                          ? 'Copier le script SQL de déblocage RLS (fix_manager_rls_mapping.sql)'
                          : 'Copier le script SQL de réparation (Cache & Colonnes)'}
                      </span>
                    </>
                  )}
                </button>
                <span className="text-[11px] text-slate-400">
                  {isRls
                    ? 'À coller dans Supabase SQL Editor pour débloquer les droits et réassigner la fiche.'
                    : 'À exécuter dans Supabase SQL Editor pour recharger le cache.'}
                </span>
              </div>
            )}

            {showDetails && (
              <div className="mt-2 p-2.5 rounded-md bg-slate-950/80 border border-slate-800 text-[11px] font-mono text-slate-400 space-y-1">
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
                {(isSchemaCache || isRls) && (
                  <div className="mt-2 pt-2 border-t border-slate-800/80">
                    <p className={`font-semibold mb-1 ${isRls ? 'text-rose-300' : 'text-amber-300'}`}>
                      {isRls
                        ? 'Script SQL correctif RLS à exécuter dans Supabase (fix_manager_rls_mapping.sql) :'
                        : 'Script SQL à exécuter dans Supabase (fix_supabase_schema_cache.sql) :'}
                    </p>
                    <pre className="text-[10px] text-slate-300 bg-slate-900/90 p-2 rounded border border-slate-800 overflow-x-auto whitespace-pre max-h-48">
                      {activeSqlScript}
                    </pre>
                  </div>
                )}
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
