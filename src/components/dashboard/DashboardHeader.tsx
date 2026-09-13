import React, { useState, useEffect } from 'react';
import {
  FilePlus,
  Sparkles,
  Clock,
  Car,
  Filter,
  Users,
  Calendar,
  ChevronDown,
  Activity,
  CheckCircle2,
} from 'lucide-react';
import { User } from '../../types';

export type DashboardPeriod = 'today' | 'week' | 'month' | 'all';

interface DashboardHeaderProps {
  currentUser: User;
  users: User[];
  period: DashboardPeriod;
  onPeriodChange: (p: DashboardPeriod) => void;
  selectedManagerId: string;
  onManagerChange: (id: string) => void;
  onNewContract: () => void;
  onViewVehicles: () => void;
  urgentReturnsCount: number;
  onScrollToFlightDeck: () => void;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  currentUser,
  users,
  period,
  onPeriodChange,
  selectedManagerId,
  onManagerChange,
  onNewContract,
  onViewVehicles,
  urgentReturnsCount,
  onScrollToFlightDeck,
}) => {
  const [timeStr, setTimeStr] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const managers = users.filter((u) => u.role === 'manager' || u.role === 'admin');

  return (
    <div className="bg-gradient-to-r from-slate-900 via-slate-900/95 to-slate-950 border border-slate-800/90 rounded-2xl p-5 sm:p-6 shadow-2xl relative overflow-hidden">
      {/* Subtle luxury ambient glows */}
      <div className="absolute -right-20 -top-20 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute left-1/3 -bottom-20 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>

      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        {/* LEFT: Branding & Greeting */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 uppercase tracking-wider text-[11px] font-bold">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Morvello Cars • Executive Cockpit
            </span>

            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/80 text-slate-300 text-[11px] font-mono">
              <Clock className="w-3 h-3 text-emerald-400" />
              Casablanca {timeStr || '13:17'} (GMT+1)
            </span>

            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[11px] font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Comptoir Nouaceur Ouvert
            </span>
          </div>

          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Tableau de Bord, <span className="text-amber-400">{currentUser.name}</span>
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono border border-slate-700">
              {currentUser.role === 'admin'
                ? 'Directeur Général'
                : currentUser.role === 'manager'
                ? 'Manager d’Agence'
                : 'Agent Comptoir'}
            </span>
          </div>

          <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
            Supervision en temps réel du parc de prestige, suivi des restitutions, encaissement des loyers et sécurisation des dépôts de garantie.
          </p>
        </div>

        {/* RIGHT: Quick CTAs */}
        <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-center shrink-0">
          {urgentReturnsCount > 0 && (
            <button
              onClick={onScrollToFlightDeck}
              className="flex items-center gap-2 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/40 font-bold px-3.5 py-2.5 rounded-xl transition-all cursor-pointer text-xs group"
              title="Voir les restitutions prévues"
            >
              <Activity className="w-4 h-4 text-rose-400 group-hover:scale-110 transition-transform" />
              <span>{urgentReturnsCount} Restitution{urgentReturnsCount > 1 ? 's' : ''} à traiter</span>
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
            </button>
          )}

          <button
            onClick={onViewVehicles}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700/90 font-semibold px-3.5 py-2.5 rounded-xl transition-all cursor-pointer text-xs"
          >
            <Car className="w-4 h-4 text-amber-400" />
            <span>Parc Automobile</span>
          </button>

          <button
            onClick={onNewContract}
            className="flex items-center gap-2 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-extrabold px-4.5 py-2.5 rounded-xl shadow-lg shadow-amber-500/20 transition-all active:scale-95 text-xs cursor-pointer"
          >
            <FilePlus className="w-4 h-4 text-slate-950" />
            <span>+ Nouveau Contrat</span>
          </button>
        </div>
      </div>

      {/* FILTER BAR: Period & Manager Filter */}
      <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        {/* Period Selector Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-950/70 border border-slate-800/80 rounded-xl">
          <button
            onClick={() => onPeriodChange('today')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
              period === 'today'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Aujourd’hui
          </button>
          <button
            onClick={() => onPeriodChange('week')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
              period === 'week'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            7 Derniers Jours
          </button>
          <button
            onClick={() => onPeriodChange('month')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
              period === 'month'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Ce Mois
          </button>
          <button
            onClick={() => onPeriodChange('all')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
              period === 'all'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Global (Tous)
          </button>
        </div>

        {/* Manager Filter */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <span className="text-slate-500 flex items-center gap-1 text-[11px] font-medium">
            <Filter className="w-3 h-3 text-amber-400" />
            Responsable :
          </span>
          <div className="relative">
            <select
              value={selectedManagerId}
              onChange={(e) => onManagerChange(e.target.value)}
              aria-label="Filtrer par manager responsable"
              className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg pl-2.5 pr-8 py-1.5 font-medium focus:outline-none focus:border-amber-500 cursor-pointer appearance-none"
            >
              <option value="all">Tous les Responsables ({managers.length})</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.role.toUpperCase()})
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>
    </div>
  );
};
