import React from 'react';
import { Vehicle } from '../../types';
import { Trash2, AlertTriangle } from 'lucide-react';

interface VehicleDeleteModalProps {
  vehicle: Vehicle | null;
  deleteError: string | null;
  onClose: () => void;
  onConfirm: () => void;
}

export const VehicleDeleteModal: React.FC<VehicleDeleteModalProps> = ({
  vehicle,
  deleteError,
  onClose,
  onConfirm,
}) => {
  if (!vehicle) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-rose-500/40 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
        <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30 shrink-0">
            <Trash2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Supprimer ce véhicule ?</h3>
            <p className="text-xs text-slate-400">Action irréversible sur la flotte</p>
          </div>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Véhicule :</span>
            <span className="text-white font-bold uppercase">
              {vehicle.brand} {vehicle.model}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Immatriculation :</span>
            <span className="text-amber-400 font-mono font-bold">{vehicle.plate}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Responsable :</span>
            <span className="text-slate-300">{vehicle.assignedManagerName || 'Non assigné'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Statut actuel :</span>
            <span
              className={`font-semibold capitalize ${
                vehicle.status === 'available'
                  ? 'text-emerald-400'
                  : vehicle.status === 'rented'
                  ? 'text-blue-400'
                  : 'text-amber-400'
              }`}
            >
              {vehicle.status === 'available'
                ? 'Disponible'
                : vehicle.status === 'rented'
                ? 'En location'
                : 'En maintenance'}
            </span>
          </div>
        </div>

        {deleteError && (
          <div className="bg-rose-950/60 border border-rose-500/60 rounded-xl p-3 flex items-start gap-2.5 text-xs text-rose-200">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{deleteError}</span>
          </div>
        )}

        <p className="text-[11px] text-slate-400">
          Êtes-vous sûr de vouloir retirer ce véhicule de la flotte Morvello Cars ? Toutes les données associées de ce véhicule seront supprimées du parc.
        </p>

        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-600/30 transition-all cursor-pointer active:scale-95"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Confirmer la suppression
          </button>
        </div>
      </div>
    </div>
  );
};
