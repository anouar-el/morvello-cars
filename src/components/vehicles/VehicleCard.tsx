import React from 'react';
import { Vehicle, VehicleStatus, Contract } from '../../types';
import { VehicleCompliancePanel } from './VehicleCompliancePanel';
import {
  Pencil,
  UserCheck,
  Trash2,
  FileText,
  Wrench,
} from 'lucide-react';

interface VehicleCardProps {
  vehicle: Vehicle;
  activeContract?: Contract;
  canDelete: boolean;
  onEdit: (vehicle: Vehicle) => void;
  onStatusToggle: (vehicle: Vehicle) => void;
  onDeleteRequest: (vehicle: Vehicle) => void;
  onOpenPdfModal: (contract: Contract) => void;
}

export const VehicleCard: React.FC<VehicleCardProps> = ({
  vehicle,
  activeContract,
  canDelete,
  onEdit,
  onStatusToggle,
  onDeleteRequest,
  onOpenPdfModal,
}) => {
  const getStatusBadge = (status: VehicleStatus) => {
    switch (status) {
      case 'available':
        return (
          <span className="inline-flex items-center gap-1 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full text-xs font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            Disponible
          </span>
        );
      case 'rented':
        return (
          <span className="inline-flex items-center gap-1 bg-blue-500/15 text-blue-400 border border-blue-500/30 px-2.5 py-0.5 rounded-full text-xs font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
            Loué (En cours)
          </span>
        );
      case 'maintenance':
        return (
          <span className="inline-flex items-center gap-1 bg-amber-500/15 text-amber-400 border border-amber-500/30 px-2.5 py-0.5 rounded-full text-xs font-semibold">
            <Wrench className="w-3 h-3" />
            Maintenance
          </span>
        );
      case 'inactive':
        return (
          <span className="inline-flex items-center gap-1 bg-slate-500/15 text-slate-400 border border-slate-500/30 px-2.5 py-0.5 rounded-full text-xs font-semibold">
            Inactif
          </span>
        );
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-md hover:border-slate-700 transition-all flex flex-col justify-between group">
      <div>
        {/* TOP STATUS & EDIT BUTTON */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {getStatusBadge(vehicle.status)}
            <span className="text-xs font-mono text-slate-400 font-semibold">
              {vehicle.fuelType}
            </span>
          </div>

          <button
            onClick={() => onEdit(vehicle)}
            className="flex items-center gap-1.5 bg-slate-800/80 hover:bg-amber-500 hover:text-slate-950 text-slate-300 text-xs px-2.5 py-1 rounded-lg border border-slate-700 hover:border-amber-400 transition-all cursor-pointer font-semibold shadow-xs"
            title="Modifier ce véhicule"
          >
            <Pencil className="w-3.5 h-3.5" />
            Modifier
          </button>
        </div>

        {/* BRAND & MODEL */}
        <h3 className="text-base font-bold text-white uppercase flex items-center justify-between">
          <span>
            {vehicle.brand} <span className="text-slate-300 font-normal">{vehicle.model}</span>
          </span>
          {vehicle.approvalStatus === 'pending_approval' && (
            <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-mono font-semibold">
              ⏳ En validation
            </span>
          )}
        </h3>

        {/* PLATE BADGE (Moroccan plate design) */}
        <div className="my-2 inline-block bg-slate-950 border border-amber-500/40 px-3 py-1 rounded-lg text-amber-400 font-mono font-bold text-sm tracking-wider shadow-inner">
          {vehicle.plate}
        </div>

        {/* RESPONSABLE ATTITRÉ ROW */}
        <div className="mb-2.5 flex items-center justify-between text-xs bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800">
          <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
            <UserCheck className="w-3.5 h-3.5 text-amber-400" />
            <span>Responsable attitré :</span>
          </div>
          <span className="font-semibold text-slate-200 text-[11px] truncate max-w-[150px]">
            {vehicle.assignedManagerName || (vehicle.assignedManagerId ? 'Responsable' : 'Flotte centrale (Non affecté)')}
          </span>
        </div>

        {/* SPECS */}
        <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 mt-2 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
          <div>
            <span className="text-[10px] text-slate-500 block">Compteur actuel :</span>
            <strong className="text-white font-mono">{vehicle.currentKm.toLocaleString()} KM</strong>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 block">Tarif journalier :</span>
            <strong className="text-amber-400 font-mono">{vehicle.dailyRate || 400} MAD / j</strong>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 block">Année & Couleur :</span>
            <span className="text-slate-300">{vehicle.year || 2024} • {vehicle.color || 'Gris'}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 block">Dernière Révision :</span>
            <span className="text-slate-300 font-mono">{vehicle.lastInspectionDate || 'À jour'}</span>
          </div>
        </div>

        {vehicle.notes && (
          <div className="mt-2 text-[11px] text-slate-400 italic bg-slate-950/40 px-2.5 py-1.5 rounded-lg border border-slate-800/60">
            « {vehicle.notes} »
          </div>
        )}

        {/* SUIVI TECHNIQUE ET ADMINISTRATIF */}
        <VehicleCompliancePanel vehicle={vehicle} />

        {/* ACTIVE RENTAL NOTICE IF RENTED */}
        {activeContract && (
          <div className="mt-3 bg-blue-500/10 border border-blue-500/30 p-2 rounded-lg text-xs text-blue-300">
            <span className="font-semibold block">
              Loué à : {activeContract.clientSnapshot.lastName} {activeContract.clientSnapshot.firstName}
            </span>
            <span className="text-[10px] text-blue-400">
              Contrat N° {activeContract.contractNumber} (Retour le {activeContract.endDate})
            </span>
          </div>
        )}
      </div>

      {/* ACTIONS ROW */}
      <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onStatusToggle(vehicle)}
            disabled={vehicle.status === 'rented'}
            className={`text-[11px] px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
              vehicle.status === 'rented'
                ? 'opacity-40 cursor-not-allowed text-slate-500 bg-slate-800'
                : vehicle.status === 'maintenance'
                ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500 hover:text-slate-950'
                : 'bg-amber-500/20 text-amber-300 hover:bg-amber-500 hover:text-slate-950'
            }`}
          >
            {vehicle.status === 'maintenance' ? 'Remettre en service' : 'Mettre en maintenance'}
          </button>
        </div>

        <div className="flex items-center gap-2">
          {canDelete && (
            <button
              onClick={() => onDeleteRequest(vehicle)}
              title="Supprimer ce véhicule du parc"
              className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          {activeContract ? (
            <button
              onClick={() => onOpenPdfModal(activeContract)}
              className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 cursor-pointer"
            >
              Voir contrat <FileText className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={() => onEdit(vehicle)}
              className="text-xs text-slate-400 hover:text-white font-medium flex items-center gap-1 cursor-pointer"
            >
              <Pencil className="w-3 h-3" /> Fiche détaillée
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
