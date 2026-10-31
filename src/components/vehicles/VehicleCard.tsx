import React from 'react';
import { StorageImg } from '../StorageImg';
import { Vehicle, VehicleStatus, Contract } from '../../types';
import { VehicleCompliancePanel } from './VehicleCompliancePanel';
import {
  Pencil,
  Car,
  Camera,
  UserCheck,
  Trash2,
  FileText,
  Wrench,
} from 'lucide-react';

import { useI18n } from '../../i18n/I18nContext';
interface VehicleCardProps {
  vehicle: Vehicle;
  activeContract?: Contract;
  canDelete: boolean;
  onEdit: (vehicle: Vehicle) => void;
  onStatusToggle: (vehicle: Vehicle) => void;
  onDeleteRequest: (vehicle: Vehicle) => void;
  onOpenPdfModal: (contract: Contract) => void;
  onOpenMaintenanceModal?: (vehicle: Vehicle) => void;
}

export const VehicleCard: React.FC<VehicleCardProps> = ({
  vehicle,
  activeContract,
  canDelete,
  onEdit,
  onStatusToggle,
  onDeleteRequest,
  onOpenPdfModal,
  onOpenMaintenanceModal,
}) => {
  const { t } = useI18n();
  const effectiveStatus: VehicleStatus = activeContract ? 'rented' : vehicle.status;

  const getStatusBadge = (status: VehicleStatus) => {
    switch (status) {
      case 'available':
        return (
          <span className="inline-flex items-center gap-1 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full text-xs font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            {t('Disponible')}
          </span>
        );
      case 'rented':
        return (
          <span className="inline-flex items-center gap-1 bg-blue-500/15 text-blue-400 border border-blue-500/30 px-2.5 py-0.5 rounded-full text-xs font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
            {t('Loué (En cours)')}
          </span>
        );
      case 'maintenance':
        return (
          <span className="inline-flex items-center gap-1 bg-amber-500/15 text-amber-400 border border-amber-500/30 px-2.5 py-0.5 rounded-full text-xs font-semibold">
            <Wrench className="w-3 h-3" />
            {t('Maintenance')}
          </span>
        );
      case 'inactive':
        return (
          <span className="inline-flex items-center gap-1 bg-slate-500/15 text-slate-400 border border-slate-500/30 px-2.5 py-0.5 rounded-full text-xs font-semibold">
            {t('Inactif')}
          </span>
        );
    }
  };

  const subtitle = [vehicle.year, vehicle.color, vehicle.fuelType].filter(Boolean).join(' • ');

  return (
    <div className="glass rounded-3xl p-5 hover:border-amber-500/30 transition-all flex flex-col justify-between group overflow-hidden">
      <div>
        {/* PHOTO : statut, plaque et tarif en surimpression ; invitation à ajouter une photo si absente */}
        <div className={`relative -mx-5 -mt-5 mb-4 overflow-hidden border-b border-white/5 ${vehicle.photoUrl ? 'aspect-[16/10]' : 'h-44'}`}>
          {vehicle.photoUrl ? (
            <>
              <StorageImg src={vehicle.photoUrl} alt={`${vehicle.brand} ${vehicle.model}`} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
              <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-slate-950/40" />
            </>
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/15 via-slate-900/30 to-transparent flex flex-col items-center justify-center gap-2 pt-6 pb-10">
              <Car aria-hidden="true" className="w-10 h-10 text-amber-400/50" />
              <button
                type="button"
                onClick={() => onEdit(vehicle)}
                className="flex items-center gap-1.5 text-xs font-semibold text-amber-300 bg-slate-950/60 hover:bg-amber-500 hover:text-slate-950 border border-amber-500/30 px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
              >
                <Camera className="w-3.5 h-3.5" />
                {t('Ajouter une photo')}
              </button>
            </div>
          )}

          <div className="absolute top-3 inset-x-3 flex items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
              <span className="rounded-full bg-slate-950/80 backdrop-blur-sm">{getStatusBadge(effectiveStatus)}</span>
              {vehicle.approvalStatus === 'pending_approval' && (
                <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-mono font-semibold backdrop-blur-sm">
                  {t('⏳ En validation')}
                </span>
              )}
            </div>
            <button
              onClick={() => onEdit(vehicle)}
              className="shrink-0 flex items-center justify-center gap-1.5 bg-slate-950/60 hover:bg-amber-500 hover:text-slate-950 text-slate-100 text-xs w-9 h-9 min-[380px]:w-auto min-[380px]:px-3 rounded-xl border border-white/10 hover:border-amber-400 backdrop-blur-sm transition-all cursor-pointer font-semibold"
              title={t('Modifier ce véhicule')}
            >
              <Pencil className="w-3.5 h-3.5" />
              <span className="hidden min-[380px]:inline">{t('Modifier')}</span>
            </button>
          </div>

          <div className="absolute bottom-3 inset-x-3 flex items-end justify-between gap-2">
            <div className="bg-slate-950/75 border border-amber-500/40 px-3 py-1 rounded-lg text-amber-400 font-mono font-bold text-sm tracking-wider backdrop-blur-sm">
              {vehicle.plate}
            </div>
            {vehicle.dailyRate ? (
              <div className="bg-slate-950/75 border border-white/10 px-3 py-1 rounded-lg text-amber-400 font-mono font-bold text-sm backdrop-blur-sm">
                {t('{dailyRate} MAD / j', { dailyRate: vehicle.dailyRate })}
              </div>
            ) : (
              <div
                className="bg-slate-950/75 border border-rose-500/40 px-3 py-1 rounded-lg text-rose-400 font-mono font-bold text-xs backdrop-blur-sm"
                title={t('Aucun tarif enregistré : à renseigner dans la fiche véhicule')}
              >
                {t('Non défini')}
              </div>
            )}
          </div>
        </div>

        {/* NOM COMPLET : jamais tronqué */}
        <div className="mb-3">
          <h3 className="text-base font-extrabold text-white uppercase leading-tight break-words">
            {vehicle.brand} <span className="text-slate-300 font-medium">{vehicle.model}</span>
          </h3>
          {subtitle && <p className="mt-1 text-xs text-slate-400">{subtitle}</p>}
        </div>

        {/* RESPONSABLE ATTITRÉ ROW */}
        <div className="mb-2.5 flex items-center justify-between gap-2 text-xs bg-white/5 px-3 py-2 rounded-xl border border-white/10">
          <div className="flex items-center gap-1.5 text-slate-400 text-xs shrink-0">
            <UserCheck className="w-3.5 h-3.5 text-amber-400" />
            <span>{t('Responsable attitré :')}</span>
          </div>
          <span className="font-semibold text-slate-200 text-xs truncate">
            {vehicle.assignedManagerName || (vehicle.assignedManagerId ? t('Responsable') : t('Flotte centrale (Non affecté)'))}
          </span>
        </div>

        {/* SPECS */}
        <div className="grid grid-cols-2 gap-3 text-xs text-slate-400 mt-2 bg-white/5 p-3 rounded-2xl border border-white/10">
          <div>
            <span className="text-[11px] text-slate-400 block">{t('Compteur actuel :')}</span>
            <strong className="text-white font-mono">{t('{currentKm} KM', { currentKm: vehicle.currentKm.toLocaleString() })}</strong>
          </div>
          <div>
            <span className="text-[11px] text-slate-400 block">{t('Dernière Révision :')}</span>
            <span className="text-slate-300 font-mono">{vehicle.lastInspectionDate || t('À jour')}</span>
          </div>
        </div>
        {vehicle.notes && (
          <div className="mt-2 text-xs text-slate-400 italic bg-slate-950/40 px-2.5 py-1.5 rounded-lg border border-slate-800/60">
            « {vehicle.notes} »
          </div>
        )}

        {/* SUIVI TECHNIQUE ET ADMINISTRATIF */}
        <VehicleCompliancePanel
          vehicle={vehicle}
          onOpenMaintenanceModal={
            onOpenMaintenanceModal ? () => onOpenMaintenanceModal(vehicle) : undefined
          }
        />

        {/* ACTIVE RENTAL NOTICE IF RENTED */}
        {activeContract && (
          <div className="mt-3 bg-blue-500/10 border border-blue-500/30 p-2 rounded-lg text-xs text-blue-300">
            <span className="font-semibold block">
              {t('Loué à : {lastName} {firstName}', { lastName: activeContract.clientSnapshot.lastName, firstName: activeContract.clientSnapshot.firstName })}
            </span>
            <span className="text-[11px] text-blue-400">
              {t('Contrat N° {contractNumber} (Retour le {endDate})', { contractNumber: activeContract.contractNumber, endDate: activeContract.endDate })}
            </span>
          </div>
        )}
      </div>

      {/* ACTIONS ROW */}
      <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onStatusToggle(vehicle)}
            disabled={effectiveStatus === 'rented'}
            className={`text-xs px-3 min-h-11 rounded-lg font-semibold transition-colors cursor-pointer ${
              effectiveStatus === 'rented'
                ? 'opacity-40 cursor-not-allowed text-slate-500 bg-slate-800'
                : vehicle.status === 'maintenance'
                ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500 hover:text-slate-950'
                : 'bg-amber-500/20 text-amber-300 hover:bg-amber-500 hover:text-slate-950'
            }`}
          >
            {vehicle.status === 'maintenance' ? t('Remettre en service') : t('Mettre en maintenance')}
          </button>
        </div>

        <div className="flex items-center gap-2">
          {canDelete && (
            <button
              onClick={() => onDeleteRequest(vehicle)}
              title={t('Supprimer ce véhicule du parc')}
              className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          {activeContract ? (
            <button
              onClick={() => onOpenPdfModal(activeContract)}
              className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 cursor-pointer min-h-11 px-1"
            >
              {t('Voir contrat')} <FileText className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={() => onEdit(vehicle)}
              className="text-xs text-slate-400 hover:text-white font-medium flex items-center gap-1 cursor-pointer min-h-11 px-1"
            >
              <Pencil className="w-3 h-3" /> {t('Fiche détaillée')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
