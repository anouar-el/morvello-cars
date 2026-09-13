import React from 'react';
import {
  TrendingUp,
  Car,
  Clock,
  ShieldCheck,
  Calendar,
  AlertCircle,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react';

interface DashboardKpisProps {
  totalRevenue: number;
  averageDailyRate: number;
  activeContractsCount: number;
  totalContractsCount: number;
  occupancyRate: number;
  rentedVehiclesCount: number;
  totalVehiclesCount: number;
  availableVehiclesCount: number;
  maintenanceVehiclesCount: number;
  returnsTodayCount: number;
  departuresTodayCount: number;
  totalDepositsHeld: number;
  totalDepositsCount: number;
  periodLabel: string;
}

export const DashboardKpis: React.FC<DashboardKpisProps> = ({
  totalRevenue,
  averageDailyRate,
  activeContractsCount,
  totalContractsCount,
  occupancyRate,
  rentedVehiclesCount,
  totalVehiclesCount,
  availableVehiclesCount,
  maintenanceVehiclesCount,
  returnsTodayCount,
  departuresTodayCount,
  totalDepositsHeld,
  totalDepositsCount,
  periodLabel,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. CHIFFRE D'AFFAIRES */}
      <div className="bg-slate-900/90 border border-slate-800/90 hover:border-amber-500/40 rounded-2xl p-4.5 shadow-lg relative overflow-hidden transition-all group">
        <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-amber-500/10 transition-colors"></div>

        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Chiffre d'Affaires Contracté
          </span>
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <span className="font-mono text-xs font-black">MAD</span>
          </div>
        </div>

        <div className="mt-2.5">
          <div className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight flex items-baseline gap-1.5">
            <span>{totalRevenue.toLocaleString('fr-FR')}</span>
            <span className="text-xs font-bold text-amber-400 font-sans">DH</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
            <span className="inline-flex items-center text-emerald-400 font-semibold gap-0.5">
              <ArrowUpRight className="w-3 h-3" />
              +16.4%
            </span>
            <span>• Moy. {Math.round(averageDailyRate)} DH/jour</span>
          </p>
        </div>

        <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500 font-medium">
          <span>Période : {periodLabel}</span>
          <span className="text-slate-400 font-mono">{totalContractsCount} dossiers</span>
        </div>
      </div>

      {/* 2. TAUX D'OCCUPATION DU PARC */}
      <div className="bg-slate-900/90 border border-slate-800/90 hover:border-blue-500/40 rounded-2xl p-4.5 shadow-lg relative overflow-hidden transition-all group">
        <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-blue-500/10 transition-colors"></div>

        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Taux d'Occupation Flotte
          </span>
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Car className="w-4.5 h-4.5" />
          </div>
        </div>

        <div className="mt-2.5">
          <div className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight flex items-baseline gap-1.5">
            <span>{Math.round(occupancyRate)}%</span>
            <span className="text-xs font-semibold text-blue-400 font-sans">actif</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            <strong className="text-white font-semibold font-mono">{rentedVehiclesCount}</strong> sur{' '}
            <strong className="text-white font-semibold font-mono">{totalVehiclesCount}</strong> véhicules en circulation
          </p>
        </div>

        {/* Progress bar multi-statuts */}
        <div className="mt-3 pt-2.5 border-t border-slate-800/80">
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden flex">
            <div
              style={{ width: `${(rentedVehiclesCount / Math.max(1, totalVehiclesCount)) * 100}%` }}
              className="bg-blue-500 h-full"
              title={`${rentedVehiclesCount} Loués`}
            ></div>
            <div
              style={{ width: `${(availableVehiclesCount / Math.max(1, totalVehiclesCount)) * 100}%` }}
              className="bg-emerald-500 h-full"
              title={`${availableVehiclesCount} Disponibles`}
            ></div>
            <div
              style={{ width: `${(maintenanceVehiclesCount / Math.max(1, totalVehiclesCount)) * 100}%` }}
              className="bg-amber-500 h-full"
              title={`${maintenanceVehiclesCount} En maintenance`}
            ></div>
          </div>
          <div className="flex items-center justify-between text-[10px] mt-1 text-slate-500">
            <span className="text-emerald-400 font-semibold">{availableVehiclesCount} dispo</span>
            <span className="text-amber-400 font-semibold">{maintenanceVehiclesCount} révision</span>
          </div>
        </div>
      </div>

      {/* 3. FLUX OPÉRATIONNEL DU JOUR */}
      <div className="bg-slate-900/90 border border-slate-800/90 hover:border-emerald-500/40 rounded-2xl p-4.5 shadow-lg relative overflow-hidden transition-all group">
        <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-emerald-500/10 transition-colors"></div>

        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Flux Départs & Retours
          </span>
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Clock className="w-4.5 h-4.5" />
          </div>
        </div>

        <div className="mt-2.5">
          <div className="flex items-baseline gap-3">
            <div>
              <span className="text-2xl sm:text-3xl font-black text-white font-mono">
                {returnsTodayCount}
              </span>
              <span className="text-[10px] text-amber-400 uppercase font-bold ml-1">Retours</span>
            </div>
            <span className="text-slate-600 font-bold text-lg">•</span>
            <div>
              <span className="text-2xl sm:text-3xl font-black text-slate-300 font-mono">
                {departuresTodayCount}
              </span>
              <span className="text-[10px] text-emerald-400 uppercase font-bold ml-1">Départs</span>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
            {returnsTodayCount > 0 ? (
              <span className="text-amber-400 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
                {returnsTodayCount} check-in(s) à réaliser
              </span>
            ) : (
              <span className="text-emerald-400 font-medium">Aucune restitution en retard</span>
            )}
          </p>
        </div>

        <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500 font-medium">
          <span>Contrats en cours</span>
          <span className="text-emerald-400 font-mono font-bold">{activeContractsCount} actifs</span>
        </div>
      </div>

      {/* 4. VOLUME CAUTIONS SÉCURISÉES */}
      <div className="bg-slate-900/90 border border-slate-800/90 hover:border-purple-500/40 rounded-2xl p-4.5 shadow-lg relative overflow-hidden transition-all group">
        <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-purple-500/10 transition-colors"></div>

        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Cautions Sous Séquestre
          </span>
          <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <ShieldCheck className="w-4.5 h-4.5" />
          </div>
        </div>

        <div className="mt-2.5">
          <div className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight flex items-baseline gap-1.5">
            <span>{totalDepositsHeld.toLocaleString('fr-FR')}</span>
            <span className="text-xs font-bold text-purple-400 font-sans">DH</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
            <span className="text-emerald-400 font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              Garanties vérifiées
            </span>
            <span>• Empreinte CB & Chèques</span>
          </p>
        </div>

        <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500 font-medium">
          <span>Dossiers garantis</span>
          <span className="text-purple-300 font-mono font-bold">{totalDepositsCount} cautions actives</span>
        </div>
      </div>
    </div>
  );
};
