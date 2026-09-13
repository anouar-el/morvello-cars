import React from 'react';
import {
  FilePlus,
  Users,
  Car,
  ShieldCheck,
  FileCheck,
  Sparkles,
  Shield,
  ArrowRight,
} from 'lucide-react';

interface DashboardQuickLaunchpadProps {
  clientsCount: number;
  vehiclesCount: number;
  contractsCount: number;
  depositsCount: number;
  onNavigate: (tab: any) => void;
}

export const DashboardQuickLaunchpad: React.FC<DashboardQuickLaunchpadProps> = ({
  clientsCount,
  vehiclesCount,
  contractsCount,
  depositsCount,
  onNavigate,
}) => {
  return (
    <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-5 shadow-lg space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-bold text-white tracking-tight">
            Navigation Rapide &amp; Modules Métier
          </h3>
        </div>
        <span className="text-[11px] text-slate-400 font-mono">Morvello Suite V1.0</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Nouveau contrat */}
        <button
          onClick={() => onNavigate('new_contract')}
          className="p-3.5 bg-gradient-to-b from-slate-950/80 to-slate-900 hover:from-amber-500/10 hover:to-amber-500/20 border border-slate-800 hover:border-amber-500/40 rounded-xl text-left transition-all group cursor-pointer"
        >
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-2 group-hover:scale-105 transition-transform">
            <FilePlus className="w-5 h-5" />
          </div>
          <p className="text-xs font-bold text-white">Nouveau Contrat</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Tunnel de saisie</p>
        </button>

        {/* Base clients */}
        <button
          onClick={() => onNavigate('clients')}
          className="p-3.5 bg-gradient-to-b from-slate-950/80 to-slate-900 hover:from-blue-500/10 hover:to-blue-500/20 border border-slate-800 hover:border-blue-500/40 rounded-xl text-left transition-all group cursor-pointer"
        >
          <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-2 group-hover:scale-105 transition-transform">
            <Users className="w-5 h-5" />
          </div>
          <p className="text-xs font-bold text-white">Fiches Clients</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{clientsCount} enregistrés</p>
        </button>

        {/* Parc Automobile */}
        <button
          onClick={() => onNavigate('vehicles')}
          className="p-3.5 bg-gradient-to-b from-slate-950/80 to-slate-900 hover:from-emerald-500/10 hover:to-emerald-500/20 border border-slate-800 hover:border-emerald-500/40 rounded-xl text-left transition-all group cursor-pointer"
        >
          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-2 group-hover:scale-105 transition-transform">
            <Car className="w-5 h-5" />
          </div>
          <p className="text-xs font-bold text-white">Parc Véhicules</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{vehiclesCount} unités</p>
        </button>

        {/* Gestion des Cautions */}
        <button
          onClick={() => onNavigate('deposits')}
          className="p-3.5 bg-gradient-to-b from-slate-950/80 to-slate-900 hover:from-purple-500/10 hover:to-purple-500/20 border border-slate-800 hover:border-purple-500/40 rounded-xl text-left transition-all group cursor-pointer"
        >
          <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-2 group-hover:scale-105 transition-transform">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <p className="text-xs font-bold text-white">Dépôts &amp; Cautions</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{depositsCount} suivis</p>
        </button>

        {/* Contrats archivés */}
        <button
          onClick={() => onNavigate('contracts')}
          className="p-3.5 bg-gradient-to-b from-slate-950/80 to-slate-900 hover:from-slate-800 hover:to-slate-750 border border-slate-800 hover:border-slate-700 rounded-xl text-left transition-all group cursor-pointer"
        >
          <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 mb-2 group-hover:scale-105 transition-transform">
            <FileCheck className="w-5 h-5" />
          </div>
          <p className="text-xs font-bold text-white">Tous les Contrats</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{contractsCount} archivés</p>
        </button>

        {/* Conditions Juridiques V1 */}
        <button
          onClick={() => onNavigate('terms')}
          className="p-3.5 bg-gradient-to-b from-slate-950/80 to-slate-900 hover:from-slate-800 hover:to-slate-750 border border-slate-800 hover:border-slate-700 rounded-xl text-left transition-all group cursor-pointer"
        >
          <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-400 mb-2 group-hover:scale-105 transition-transform">
            <Shield className="w-5 h-5" />
          </div>
          <p className="text-xs font-bold text-white">Conditions V1.0</p>
          <p className="text-[10px] text-slate-400 mt-0.5">20 clauses légitimes</p>
        </button>
      </div>

      {/* FOOTER NOTICE */}
      <div className="bg-slate-950/70 border border-slate-800/80 p-3 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>
            Moteur d'édition de contrat conforme : <strong>Impression stricte A4 Portrait 2 pages</strong> avec en-tête personnalisée selon le Manager référent.
          </span>
        </div>
        <span className="text-[11px] font-mono text-amber-400 font-semibold shrink-0">
          Nouaceur Casablanca
        </span>
      </div>
    </div>
  );
};
