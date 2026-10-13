import React, { useMemo, useState } from 'react';
import { Vehicle } from '../../types';
import { formatPlateFrench } from '../../utils/plateUtils';
import { Car, Search, UserCheck, X } from 'lucide-react';
import { countByStatus, searchVehicles, type VehicleStatusFilter } from '../../lib/vehicleSearch';

import { useI18n } from '../../i18n/I18nContext';
interface WizardStep2VehicleProps {
  availableVehiclesForContract: Vehicle[];
  selectedVehicleId: string;
  setSelectedVehicleId: (id: string) => void;
  isManager: boolean;
  currentUser?: { name: string; assignedFleetName?: string };
  isEditMode: boolean;
  editingContractVehicleId?: string;
}

export const WizardStep2Vehicle: React.FC<WizardStep2VehicleProps> = ({
  availableVehiclesForContract,
  selectedVehicleId,
  setSelectedVehicleId,
  isManager,
  currentUser,
  isEditMode,
  editingContractVehicleId,
}) => {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<VehicleStatusFilter>('all');

  const counts = useMemo(
    () => countByStatus(availableVehiclesForContract, editingContractVehicleId),
    [availableVehiclesForContract, editingContractVehicleId]
  );
  const visibleVehicles = useMemo(
    () =>
      searchVehicles(availableVehiclesForContract, {
        query,
        status: statusFilter,
        currentVehicleId: isEditMode ? editingContractVehicleId : undefined,
      }),
    [availableVehiclesForContract, query, statusFilter, isEditMode, editingContractVehicleId]
  );
  const selectedVehicle = availableVehiclesForContract.find((v) => v.id === selectedVehicleId);
  const selectedHidden = Boolean(selectedVehicle) && !visibleVehicles.some((v) => v.id === selectedVehicleId);
  const isFiltering = query.trim() !== '' || statusFilter !== 'all';

  const FILTERS: { id: VehicleStatusFilter; label: string; count: number }[] = [
    { id: 'all', label: 'Tous', count: counts.all },
    { id: 'available', label: 'Disponibles', count: counts.available },
    { id: 'unavailable', label: 'Indisponibles', count: counts.unavailable },
  ];

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      <div className="border-b border-slate-800 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Car className="w-5 h-5 text-amber-400" />
            {t('Étape 2 : Attribution du Véhicule')}
          </h2>
          <p className="text-xs text-slate-400">
            {t('Sélectionnez le véhicule à attribuer pour ce contrat. Le relevé kilométrique et tarif sont auto-synchronisés.')}
          </p>
        </div>

        {isManager ? (
          <span className="text-[11px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2.5 py-1 rounded-lg font-mono">
            {t('Flotte Responsable :')} {currentUser?.assignedFleetName || currentUser?.name}
          </span>
        ) : (
          <span className="text-[11px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-1 rounded-lg font-mono">
            {t('Vue Super Admin (Flotte globale)')}
          </span>
        )}
      </div>

      {availableVehiclesForContract.length === 0 ? (
        <div className="text-center py-8 bg-slate-950/60 border border-slate-800 rounded-xl p-6">
          <Car className="w-10 h-10 text-slate-500 mx-auto mb-2 opacity-50" />
          <h3 className="text-sm font-bold text-slate-300">{t('Aucun véhicule disponible dans votre flotte')}</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            {t("Aucun véhicule n'est actuellement affecté à votre profil ou disponible à la location. Contactez le Super Admin / Gérant pour vous affecter des véhicules.")}
          </p>
        </div>
      ) : (
        <>
        {/* RECHERCHE RAPIDE */}
        <div className="space-y-2.5">
          <div className="relative group">
            <Search className="w-4 h-4 absolute start-3.5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-amber-400 transition-colors pointer-events-none" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setQuery('');
              }}
              placeholder={t('Rechercher : plaque, marque, modèle, responsable…')}
              aria-label={t('Rechercher un véhicule')}
              className="w-full bg-slate-950/70 border border-slate-800 hover:border-slate-700 focus:border-amber-500/60 focus:ring-4 focus:ring-amber-500/10 rounded-2xl ps-10 pe-10 py-3 text-sm text-white placeholder-slate-500 outline-none transition-all [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label={t('Effacer la recherche')}
                className="absolute end-2.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap" role="group" aria-label={t('Filtrer par disponibilité')}>
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setStatusFilter(f.id)}
                  aria-pressed={statusFilter === f.id}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all cursor-pointer ${
                    statusFilter === f.id
                      ? 'bg-amber-500/15 border-amber-500/50 text-amber-300'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                  }`}
                >
                  <span>{f.label}</span>
                  <span
                    className={`min-w-[18px] px-1 rounded-full text-[10px] text-center ${
                      statusFilter === f.id ? 'bg-amber-500/25 text-amber-200' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {f.count}
                  </span>
                </button>
              ))}
            </div>

            <span className="text-[11px] text-slate-500" aria-live="polite">
              {isFiltering
                ? visibleVehicles.length > 1
                  ? t('{count} résultats sur {total}', { count: visibleVehicles.length, total: counts.all })
                  : t('{count} résultat sur {total}', { count: visibleVehicles.length, total: counts.all })
                : counts.all > 1
                ? t('{count} véhicules', { count: counts.all })
                : t('{count} véhicule', { count: counts.all })}
            </span>
          </div>

          {selectedHidden && selectedVehicle && (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs">
              <span className="text-emerald-300 truncate">
                {t('✓ Sélectionné :')} <strong>{selectedVehicle.brand} {selectedVehicle.model}</strong>{' '}
                <span className="font-mono">{formatPlateFrench(selectedVehicle.plate)}</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setStatusFilter('all');
                }}
                className="shrink-0 text-slate-300 hover:text-white underline underline-offset-2 cursor-pointer"
              >
                {t('Afficher')}
              </button>
            </div>
          )}
        </div>

        {visibleVehicles.length === 0 ? (
          <div className="text-center py-8 bg-slate-950/60 border border-dashed border-slate-800 rounded-xl p-6">
            <Search className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-slate-300">{t('Aucun véhicule ne correspond')}</h3>
            <p className="text-xs text-slate-500 mt-1">{t('Essayez une partie de la plaque, la marque ou le nom du responsable.')}</p>
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setStatusFilter('all');
              }}
              className="mt-3 px-3 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-200 hover:bg-slate-800 cursor-pointer"
            >
              {t('Réinitialiser la recherche')}
            </button>
          </div>
        ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-72 overflow-y-auto pe-1">
          {visibleVehicles.map((veh) => {
            const isCurrentContractVehicle = isEditMode && veh.id === editingContractVehicleId;
            const isAvailable = veh.status === 'available' || isCurrentContractVehicle;
            const isSelected = selectedVehicleId === veh.id;

            return (
              <div
                key={veh.id}
                onClick={() => {
                  if (isAvailable) setSelectedVehicleId(veh.id);
                }}
                className={`p-3.5 rounded-xl border transition-all ${
                  isSelected
                    ? 'bg-amber-500/10 border-amber-500 shadow-md shadow-amber-500/10 cursor-pointer'
                    : isAvailable
                    ? 'bg-slate-950/60 border-slate-800 hover:border-slate-700 cursor-pointer'
                    : 'bg-slate-950/30 border-slate-900 opacity-60 cursor-not-allowed'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-bold text-white uppercase">{veh.brand}</h3>
                      <span className="text-[10px] text-slate-400">{veh.model}</span>
                    </div>
                    <p className="text-xs font-mono font-bold text-amber-400 mt-1 tracking-wider">
                      {formatPlateFrench(veh.plate)}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {t('Carburant :')} <span className="text-slate-200">{veh.fuelType}</span> {t('• KM actuel :')}{' '}
                      <span className="font-mono text-slate-200">{t('{currentKm} KM', { currentKm: veh.currentKm.toLocaleString() })}</span>
                    </p>
                    {veh.assignedManagerName && (
                      <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1 font-mono">
                        <UserCheck className="w-3 h-3 text-amber-400" />
                        {veh.assignedManagerName}
                      </p>
                    )}
                  </div>

                  <div className="text-end">
                    {isCurrentContractVehicle && (
                      <span className="inline-block bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full mb-1">
                        {t('Véhicule Actuel')}
                      </span>
                    )}
                    {!isCurrentContractVehicle && veh.status === 'available' && (
                      <span className="inline-block bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {t('Disponible')}
                      </span>
                    )}
                    {!isCurrentContractVehicle && veh.status === 'rented' && (
                      <span className="inline-block bg-blue-500/15 text-blue-400 border border-blue-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {t('Déjà Loué')}
                      </span>
                    )}
                    {!isCurrentContractVehicle && veh.status === 'maintenance' && (
                      <span className="inline-block bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {t('Maintenance')}
                      </span>
                    )}

                    {isSelected && (
                      <span className="block mt-2 text-emerald-400 text-xs font-bold">
                        {t('✓ Assigné')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        )}
        </>
      )}
    </div>
  );
};
