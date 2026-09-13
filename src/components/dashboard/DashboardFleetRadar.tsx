import React, { useState } from 'react';
import {
  Car,
  CheckCircle2,
  Clock,
  Wrench,
  Fuel,
  Gauge,
  User,
  ArrowRight,
  Sparkles,
  FilePlus,
  Eye,
} from 'lucide-react';
import { Vehicle, Contract } from '../../types';
import { formatPlateFrench } from '../../utils/plateUtils';

interface DashboardFleetRadarProps {
  vehicles: Vehicle[];
  contracts: Contract[];
  onSelectVehicleForContract: (vehicleId: string) => void;
  onOpenPdf: (contract: Contract) => void;
  onViewVehiclesList: () => void;
}

export const DashboardFleetRadar: React.FC<DashboardFleetRadarProps> = ({
  vehicles,
  contracts,
  onSelectVehicleForContract,
  onOpenPdf,
  onViewVehiclesList,
}) => {
  const [filter, setFilter] = useState<'all' | 'available' | 'rented' | 'maintenance'>('all');

  const filteredVehicles = vehicles.filter((v) => {
    if (filter === 'all') return true;
    return v.status === filter;
  });

  const availableCount = vehicles.filter((v) => v.status === 'available').length;
  const rentedCount = vehicles.filter((v) => v.status === 'rented').length;
  const maintenanceCount = vehicles.filter((v) => v.status === 'maintenance').length;

  return (
    <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-5 shadow-lg space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Car className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white tracking-tight">
              Radar de la Flotte &amp; Disponibilité Immédiate
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            État opérationnel en direct du parc automobile Morvello Cars
          </p>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-950/70 border border-slate-800/80 rounded-xl text-xs">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
              filter === 'all'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Tous ({vehicles.length})
          </button>
          <button
            onClick={() => setFilter('available')}
            className={`px-2.5 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              filter === 'available'
                ? 'bg-emerald-500 text-slate-950 shadow-sm'
                : 'text-emerald-400 hover:text-emerald-300'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            Disponibles ({availableCount})
          </button>
          <button
            onClick={() => setFilter('rented')}
            className={`px-2.5 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              filter === 'rented'
                ? 'bg-blue-500 text-slate-950 shadow-sm'
                : 'text-blue-400 hover:text-blue-300'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
            En Location ({rentedCount})
          </button>
          <button
            onClick={() => setFilter('maintenance')}
            className={`px-2.5 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              filter === 'maintenance'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-amber-400 hover:text-amber-300'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            Maintenance ({maintenanceCount})
          </button>
        </div>
      </div>

      {/* Grid of Vehicles */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {filteredVehicles.map((veh) => {
          // Find current active contract if rented
          const currentContract =
            veh.status === 'rented'
              ? contracts.find((c) => c.vehicleId === veh.id && c.status === 'active')
              : undefined;

          return (
            <div
              key={veh.id}
              className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                veh.status === 'available'
                  ? 'bg-slate-950/70 border-emerald-500/20 hover:border-emerald-500/50'
                  : veh.status === 'rented'
                  ? 'bg-slate-950/70 border-blue-500/20 hover:border-blue-500/50'
                  : 'bg-slate-950/70 border-amber-500/20 hover:border-amber-500/50'
              }`}
            >
              <div>
                {/* Header with Status Pill */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[10.5px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-900 border border-slate-700 text-amber-300">
                    {formatPlateFrench(veh.plate)}
                  </span>

                  {veh.status === 'available' ? (
                    <span className="inline-flex items-center gap-1 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full text-[10px] font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      Disponible
                    </span>
                  ) : veh.status === 'rented' ? (
                    <span className="inline-flex items-center gap-1 bg-blue-500/15 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full text-[10px] font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                      En Location
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 bg-amber-500/15 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full text-[10px] font-bold">
                      <Wrench className="w-2.5 h-2.5" />
                      Maintenance
                    </span>
                  )}
                </div>

                {/* Car Title */}
                <h4 className="text-sm font-black text-white tracking-tight">
                  {veh.brand} <span className="font-normal text-slate-300">{veh.model}</span>
                </h4>

                {/* Specs */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400 mt-2">
                  <span className="flex items-center gap-1">
                    <Fuel className="w-3 h-3 text-slate-500" />
                    {veh.fuelType}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1 font-mono">
                    <Gauge className="w-3 h-3 text-slate-500" />
                    {veh.currentKm.toLocaleString('fr-FR')} KM
                  </span>
                  {veh.color && (
                    <>
                      <span>•</span>
                      <span>{veh.color}</span>
                    </>
                  )}
                </div>

                {/* Rented by or Manager */}
                {currentContract ? (
                  <div className="mt-2.5 p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-300">
                    <div className="font-semibold flex items-center justify-between">
                      <span>Client : {currentContract.clientSnapshot.lastName} {currentContract.clientSnapshot.firstName}</span>
                      <span className="font-mono text-[10px] text-blue-400">{currentContract.contractNumber}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Retour prévu : {new Date(currentContract.endDate).toLocaleDateString('fr-FR')}
                    </div>
                  </div>
                ) : (
                  veh.assignedManagerName && (
                    <div className="mt-2 text-[10px] text-slate-500 flex items-center gap-1 font-medium">
                      <User className="w-3 h-3 text-amber-400/80" />
                      <span>Manager : {veh.assignedManagerName}</span>
                    </div>
                  )
                )}
              </div>

              {/* Footer / Actions */}
              <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-amber-400 font-mono">
                    {veh.dailyRate || 450} DH
                  </span>
                  <span className="text-[10px] text-slate-500"> / jour</span>
                </div>

                {veh.status === 'available' ? (
                  <button
                    onClick={() => onSelectVehicleForContract(veh.id)}
                    className="px-2.5 py-1 bg-emerald-500/15 hover:bg-emerald-500 text-emerald-400 hover:text-slate-950 border border-emerald-500/30 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <FilePlus className="w-3 h-3" />
                    <span>Louer</span>
                  </button>
                ) : currentContract ? (
                  <button
                    onClick={() => onOpenPdf(currentContract)}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 rounded-lg text-xs font-medium transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <Eye className="w-3 h-3" />
                    <span>Contrat</span>
                  </button>
                ) : (
                  <span className="text-[10px] text-amber-400/80 italic">En révision</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="pt-2 flex items-center justify-between text-xs text-slate-400">
        <span className="text-[11px] text-slate-500">
          Sélectionnez un véhicule pour initialiser instantanément un nouveau contrat.
        </span>
        <button
          onClick={onViewVehiclesList}
          className="text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 cursor-pointer"
        >
          Voir l'intégralité du parc ({vehicles.length}) <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
