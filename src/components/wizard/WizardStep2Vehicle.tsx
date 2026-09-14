import React from 'react';
import { Vehicle } from '../../types';
import { formatPlateFrench } from '../../utils/plateUtils';
import { Car, UserCheck } from 'lucide-react';

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
  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      <div className="border-b border-slate-800 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Car className="w-5 h-5 text-amber-400" />
            Étape 2 : Attribution du Véhicule
          </h2>
          <p className="text-xs text-slate-400">
            Sélectionnez le véhicule à attribuer pour ce contrat. Le relevé kilométrique et tarif sont auto-synchronisés.
          </p>
        </div>

        {isManager ? (
          <span className="text-[11px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2.5 py-1 rounded-lg font-mono">
            Flotte Responsable : {currentUser?.assignedFleetName || currentUser?.name}
          </span>
        ) : (
          <span className="text-[11px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-1 rounded-lg font-mono">
            Vue Super Admin (Flotte globale)
          </span>
        )}
      </div>

      {/* MANAGER FLEET NOTICE */}
      {isManager && (
        <div className="bg-blue-950/30 border border-blue-500/30 rounded-xl p-3 text-xs text-blue-200 flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-blue-400 shrink-0" />
          <span>
            <strong>Véhicules assignés à votre gestion :</strong> Vous ne pouvez contracter que sur les véhicules rattachés à votre sous-flotte ({availableVehiclesForContract.length} véhicule(s) éligible(s)).
          </span>
        </div>
      )}

      {availableVehiclesForContract.length === 0 ? (
        <div className="text-center py-8 bg-slate-950/60 border border-slate-800 rounded-xl p-6">
          <Car className="w-10 h-10 text-slate-500 mx-auto mb-2 opacity-50" />
          <h3 className="text-sm font-bold text-slate-300">Aucun véhicule disponible dans votre flotte</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Aucun véhicule n'est actuellement affecté à votre profil ou disponible à la location. Contactez le Super Admin / Gérant pour vous affecter des véhicules.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
          {availableVehiclesForContract.map((veh) => {
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
                      Carburant : <span className="text-slate-200">{veh.fuelType}</span> • KM actuel :{' '}
                      <span className="font-mono text-slate-200">{veh.currentKm.toLocaleString()} KM</span>
                    </p>
                    {veh.assignedManagerName && (
                      <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1 font-mono">
                        <UserCheck className="w-3 h-3 text-amber-400" />
                        {veh.assignedManagerName}
                      </p>
                    )}
                  </div>

                  <div className="text-right">
                    {isCurrentContractVehicle && (
                      <span className="inline-block bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full mb-1">
                        Véhicule Actuel
                      </span>
                    )}
                    {!isCurrentContractVehicle && veh.status === 'available' && (
                      <span className="inline-block bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        Disponible
                      </span>
                    )}
                    {!isCurrentContractVehicle && veh.status === 'rented' && (
                      <span className="inline-block bg-blue-500/15 text-blue-400 border border-blue-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        Déjà Loué
                      </span>
                    )}
                    {!isCurrentContractVehicle && veh.status === 'maintenance' && (
                      <span className="inline-block bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        Maintenance
                      </span>
                    )}

                    {isSelected && (
                      <span className="block mt-2 text-emerald-400 text-xs font-bold">
                        ✓ Assigné
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
