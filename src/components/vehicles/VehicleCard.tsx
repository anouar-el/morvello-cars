import React from 'react';
import { StorageImg } from '../StorageImg';
import { Vehicle, VehicleStatus, Contract } from '../../types';
import { VehicleCompliancePanel } from './VehicleCompliancePanel';
import {
  Pencil,
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

  return (
    <div className="glass rounded-3xl p-5 hover:border-amber-500/30 transition-all flex flex-col justify-between group overflow-hidden">
      <div>
        {/* EN-TÊTE PREMIUM : monogramme, marque, statut, plaque */}
        <div className="relative -mx-5 -mt-5 mb-4 px-5 pt-5 pb-4 bg-gradient-to-br from-amber-500/15 via-slate-900/10 to-transparent border-b border-white/5 overflow-hidden">
          {vehicle.photoUrl && (
            <>
              <StorageImg src={vehicle.photoUrl} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
              <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/55 to-slate-950/20" />
            </>
          )}
          <div className={`relative flex items-start justify-between gap-3 ${vehicle.photoUrl ? 'pt-14' : ''}`}>
            <div className="flex items-center gap-3 min-w-0">
              <div
                aria-hidden="true"
                className="w-12 h-12 shrink-0 rounded-2xl glass glass-gold flex items-center justify-center gold-text font-black text-lg tracking-wider"
              >
                {(vehicle.brand || '?').slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-extrabold text-white uppercase leading-tight truncate">
                  {vehicle.brand} <span className="text-slate-300 font-medium">{vehicle.model}</span>
                </h3>
                <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                  {getStatusBadge(effectiveStatus)}
                  <span className="text-[11px] font-mono text-slate-400 font-semibold">{vehicle.fuelType}</span>
                  {vehicle.approvalStatus === 'pending_approval' && (
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-mono font-semibold">
                      {t('⏳ En validation')}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={() => onEdit(vehicle)}
              className="shrink-0 flex items-center gap-1.5 bg-white/5 hover:bg-amber-500 hover:text-slate-950 text-slate-200 text-xs px-3 py-2 rounded-xl border border-white/10 hover:border-amber-400 transition-all cursor-pointer font-semibold"
              title={t('Modifier ce véhicule')}
            >
              <Pencil className="w-3.5 h-3.5" />
              <span className="hidden min-[380px]:inline">{t('Modifier')}</span>
            </button>
          </div>

          <div className="relative mt-3 inline-block bg-slate-950/70 border border-amber-500/40 px-3 py-1 rounded-lg text-amber-400 font-mono font-bold text-sm tracking-wider shadow-inner">
            {vehicle.plate}
          </div>
        </div>

        {/* RESPONSABLE ATTITRÉ ROW */}
        <div className="mb-2.5 flex items-center justify-between text-xs bg-white/5 px-3 py-2 rounded-xl border border-white/10">
          <div className="flex items-center gap-1.5 text-slate-400 text-xs">
            <UserCheck className="w-3.5 h-3.5 text-amber-400" />
            <span>{t('Responsable attitré :')}</span>
          </div>
          <span className="font-semibold text-slate-200 text-xs truncate max-w-[150px]">
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
            <span className="text-[11px] text-slate-400 block">{t('Tarif journalier :')}</span>
            {vehicle.dailyRate ? (
              <strong className="text-amber-400 font-mono">{t('{dailyRate} MAD / j', { dailyRate: vehicle.dailyRate })}</strong>
            ) : (
              <strong className="text-rose-400 font-mono" title={t('Aucun tarif enregistré : à renseigner dans la fiche véhicule')}>
                {t('Non défini')}
              </strong>
            )}
          </div>
          <div>
            <span className="text-[11px] text-slate-400 block">{t('Année & Couleur :')}</span>
            <span className="text-slate-300">{vehicle.year || 2024} • {vehicle.color || t('Gris')}</span>
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
