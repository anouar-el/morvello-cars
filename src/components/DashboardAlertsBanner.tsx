import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { computeOperationalAlerts, OperationalAlert } from '../utils/alertsUtils';
import { getScopedDataForUser } from '../utils/managerScopeUtils';
import { Contract } from '../types';
import {
  Bell,
  AlertOctagon,
  AlertTriangle,
  Clock,
  Car,
  Banknote,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';

interface DashboardAlertsBannerProps {
  onOpenCheckInModal?: (contract: Contract) => void;
  onOpenAllAlerts?: () => void;
}

export const DashboardAlertsBanner: React.FC<DashboardAlertsBannerProps> = ({
  onOpenCheckInModal,
  onOpenAllAlerts,
}) => {
  const { vehicles, contracts, deposits, clients, users, currentUser, setActiveTab } = useApp();

  const { scopedVehicles, scopedContracts, scopedDeposits } = getScopedDataForUser(
    currentUser,
    vehicles,
    contracts,
    deposits,
    clients,
    users
  );

  const { alerts, criticalCount, warningCount } = computeOperationalAlerts(
    scopedVehicles,
    scopedContracts,
    scopedDeposits
  );

  if (alerts.length === 0) {
    return null;
  }

  const topCritical = alerts.filter((a) => a.severity === 'critical').slice(0, 2);
  const topWarnings = alerts.filter((a) => a.severity === 'warning').slice(0, 2);
  const previewAlerts = [...topCritical, ...topWarnings].slice(0, 3);

  const handleAction = (alert: OperationalAlert) => {
    if (alert.contract && onOpenCheckInModal && alert.category.startsWith('return_')) {
      onOpenCheckInModal(alert.contract);
      return;
    }
    setActiveTab(alert.targetTab);
  };

  const hasCritical = criticalCount > 0;

  return (
    <div
      className={`rounded-2xl border p-4 transition-all shadow-sm ${
        hasCritical
          ? 'bg-gradient-to-r from-rose-950/40 via-rose-950/20 to-slate-900/60 border-rose-500/40'
          : 'bg-gradient-to-r from-amber-950/30 via-amber-950/15 to-slate-900/60 border-amber-500/30'
      }`}
    >
      {/* HEADER BANNER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
              hasCritical
                ? 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                : 'bg-amber-500/20 border-amber-500/40 text-amber-400'
            }`}
          >
            {hasCritical ? <AlertOctagon className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-white">
                Vigilance Opérationnelle & Alertes
              </span>
              {criticalCount > 0 && (
                <span className="text-[10px] px-2 py-0.2 rounded-full font-mono font-bold bg-rose-500/30 text-rose-200 border border-rose-500/50">
                  {criticalCount} critique{criticalCount > 1 ? 's' : ''}
                </span>
              )}
              {warningCount > 0 && (
                <span className="text-[10px] px-2 py-0.2 rounded-full font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  {warningCount} à surveiller
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Suivi en direct des échéances flotte, retours attendus et cautions en attente.
            </p>
          </div>
        </div>

        {onOpenAllAlerts && (
          <button
            type="button"
            onClick={onOpenAllAlerts}
            className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer self-start sm:self-center"
          >
            <span>Voir toutes les alertes ({alerts.length})</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* LISTE CONDENSÉE DES ALERTES PRIORITAIRES */}
      <div className="mt-3 space-y-2">
        {previewAlerts.map((alert) => {
          const isCrit = alert.severity === 'critical';
          return (
            <div
              key={alert.id}
              className="bg-slate-950/60 border border-slate-800/80 hover:border-slate-700/80 rounded-xl p-2.5 flex items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-center gap-2.5 overflow-hidden">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    isCrit ? 'bg-rose-400 animate-pulse' : 'bg-amber-400'
                  }`}
                />
                <div className="truncate">
                  <span className="font-bold text-white mr-1.5">{alert.title}</span>
                  <span className="text-slate-400 text-[11px] hidden sm:inline">
                    — {alert.description}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold ${
                    isCrit
                      ? 'bg-rose-500/20 text-rose-300'
                      : 'bg-amber-500/20 text-amber-300'
                  }`}
                >
                  {alert.badgeText}
                </span>

                <button
                  type="button"
                  onClick={() => handleAction(alert)}
                  className={`text-[11px] px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-all active:scale-95 cursor-pointer ${
                    alert.category.startsWith('return_')
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                      : isCrit
                      ? 'bg-rose-500 hover:bg-rose-400 text-slate-950'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                  }`}
                >
                  <span>{alert.category.startsWith('return_') ? 'Restituer' : 'Gérer'}</span>
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
