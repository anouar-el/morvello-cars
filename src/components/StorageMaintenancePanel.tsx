import React, { useMemo, useRef, useState } from 'react';
import { HardDrive, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useI18n } from '../i18n/I18nContext';
import { browserStorageApi, migrateRecordFiles } from '../lib/storageClient';
import { measureLocalStorage } from '../lib/safeStorage';
import { runStorageMigration, summarizeEmbedded, type MigrationReport } from '../lib/storageMigration';
import { syncUpdateClient, syncUpdateContract, syncUpdateVehicle } from '../lib/recordSync';

/** Limite prudente d'un site sur iPhone : ~5 Mo, soit environ 2,5 millions de caractères. */
const LOCAL_LIMIT_CHARS = 2_500_000;

const KEY_LABELS: Record<string, string> = {
  morvello_vehicles_v1: 'Véhicules',
  morvello_clients_v1: 'Clients',
  morvello_contracts_v1: 'Contrats',
  morvello_deposits_v1: 'Cautions',
};

const formatMo = (chars: number) => `${(chars / 1_000_000).toFixed(1)} Mo`;

/** Gérant : diagnostic du stockage de l'appareil et déplacement des fichiers existants vers Supabase Storage. */
export const StorageMaintenancePanel: React.FC = () => {
  const { t } = useI18n();
  const { clients, vehicles, contracts, currentUser, syncWithCloud } = useApp();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [report, setReport] = useState<MigrationReport | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const cancelRef = useRef(false);

  const embedded = useMemo(() => summarizeEmbedded({ clients, vehicles, contracts }), [clients, vehicles, contracts]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const local = useMemo(() => measureLocalStorage(), [clients, vehicles, contracts, refreshKey]);

  if (currentUser?.role !== 'admin') return null;

  const percent = Math.min(100, Math.round((local.total / LOCAL_LIMIT_CHARS) * 100));
  const barColor = percent >= 80 ? 'bg-rose-500' : percent >= 50 ? 'bg-amber-500' : 'bg-emerald-500';

  const start = async () => {
    if (running || !browserStorageApi) return;
    setRunning(true);
    setReport(null);
    cancelRef.current = false;
    try {
      const result = await runStorageMigration({
        clients,
        vehicles,
        contracts,
        migrate: (record) => migrateRecordFiles(record),
        patchClient: async (id, patch) => (await syncUpdateClient(id, patch)).success,
        patchVehicle: async (id, patch) => (await syncUpdateVehicle(id, patch)).success,
        patchContract: async (id, patch) => (await syncUpdateContract(id, patch)).success,
        onProgress: ({ done, total }) => setProgress({ done, total }),
        isCancelled: () => cancelRef.current,
      });
      setReport(result);
      // La base fait foi : on recharge les fiches allégées
      await syncWithCloud();
      setRefreshKey((k) => k + 1);
    } finally {
      setRunning(false);
      setProgress(null);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-md space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
          <HardDrive className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-white">{t('Stockage des photos et scans')}</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {t("Les photos, scans d'identité et signatures sont rangés dans un espace sécurisé, hors des fiches, pour que l'application reste légère.")}
          </p>
        </div>
      </div>

      {/* STOCKAGE DE CET APPAREIL */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-300">{t('Mémoire locale de cet appareil')}</span>
          <span className={percent >= 80 ? 'text-rose-300 font-bold' : 'text-slate-400'}>
            {formatMo(local.total)} / {formatMo(LOCAL_LIMIT_CHARS)} ({percent} %)
          </span>
        </div>
        <div className="h-2 rounded-full bg-slate-800 overflow-hidden" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
          <div className={`h-full ${barColor}`} style={{ width: `${percent}%` }} />
        </div>
        {percent >= 80 && (
          <p className="text-[11px] text-rose-300 flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            {t('Mémoire presque pleine : déplacez les photos et scans ci-dessous.')}
          </p>
        )}
        <ul className="text-[11px] text-slate-400 grid grid-cols-2 gap-x-4 gap-y-0.5">
          {local.keys.slice(0, 4).map((k) => (
            <li key={k.key} className="flex justify-between gap-2">
              <span className="truncate">{KEY_LABELS[k.key] ? t(KEY_LABELS[k.key]) : k.key}</span>
              <span className="font-mono text-slate-300">{formatMo(k.chars)}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* FICHIERS ENCORE INTÉGRÉS */}
      <div className="border-t border-slate-800 pt-4 space-y-3">
        {embedded.total.count === 0 ? (
          <p className="text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            {t('Aucune photo ni aucun scan intégré dans les fiches : tout est déjà dans le stockage sécurisé.')}
          </p>
        ) : (
          <>
            <p className="text-xs text-slate-300">
              {t('{count} fichier(s) encore intégré(s) dans les fiches ({size}) : clients {clients}, véhicules {vehicles}, contrats {contracts}.', {
                count: embedded.total.count,
                size: formatMo(embedded.total.bytes),
                clients: embedded.clients.count,
                vehicles: embedded.vehicles.count,
                contracts: embedded.contracts.count,
              })}
            </p>
            {!browserStorageApi ? (
              <p className="text-[11px] text-amber-300">{t("Supabase n'est pas configuré sur cette version : déplacement indisponible.")}</p>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={start}
                  disabled={running}
                  className="min-h-11 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 text-xs font-bold disabled:opacity-60 cursor-pointer inline-flex items-center gap-2"
                >
                  {running && <Loader2 className="w-4 h-4 animate-spin" />}
                  {running && progress ? t('Déplacement… {done}/{total}', progress) : t('Déplacer vers le stockage sécurisé')}
                </button>
                {running && (
                  <button
                    type="button"
                    onClick={() => {
                      cancelRef.current = true;
                    }}
                    className="min-h-11 px-3 rounded-xl text-xs text-slate-300 hover:text-white cursor-pointer"
                  >
                    {t('Arrêter')}
                  </button>
                )}
              </div>
            )}
            <p className="text-[11px] text-slate-500">
              {t("Opération sans risque et relançable : un fichier n'est retiré d'une fiche qu'une fois bien enregistré dans le stockage.")}
            </p>
          </>
        )}

        {report && (
          <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-3 text-xs space-y-1" role="status">
            {report.abortedReason === 'storage-unavailable' ? (
              <p className="text-amber-300">
                {t("Le stockage n'est pas prêt. Exécutez d'abord le script supabase_migration_storage_buckets.sql dans Supabase (SQL Editor), puis relancez.")}
              </p>
            ) : (
              <p className="text-emerald-300">
                {t('{moved} fichier(s) déplacé(s) dans {records} fiche(s), {size} libérés.', {
                  moved: report.filesMoved,
                  records: report.recordsUpdated,
                  size: formatMo(report.reclaimedChars),
                })}
              </p>
            )}
            {report.abortedReason === 'cancelled' && <p className="text-slate-300">{t('Arrêté avant la fin : relancez pour continuer.')}</p>}
            {report.failures > 0 && report.abortedReason !== 'storage-unavailable' && (
              <p className="text-amber-300">{t('{n} élément(s) non déplacé(s) : relancez pour réessayer.', { n: report.failures })}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
