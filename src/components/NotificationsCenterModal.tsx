import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { computeOperationalAlerts, OperationalAlert } from '../utils/alertsUtils';
import { Contract } from '../types';
import {
  Bell,
  AlertOctagon,
  AlertTriangle,
  Info,
  Clock,
  Car,
  FileText,
  Banknote,
  ArrowRight,
  CheckCircle2,
  Filter,
  X,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';

interface NotificationsCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCheckInModal?: (contract: Contract) => void;
}

export const NotificationsCenterModal: React.FC<NotificationsCenterModalProps> = ({
  isOpen,
  onClose,
  onOpenCheckInModal,
}) => {
  const { vehicles, contracts, deposits, setActiveTab } = useApp();
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'critical' | 'warning' | 'info'>('all');
  const [filterCategory, setFilterCategory] = useState<'all' | 'returns' | 'compliance' | 'deposits'>('all');

  if (!isOpen) return null;

  const { alerts, criticalCount, warningCount, infoCount, returnsCount, complianceCount } =
    computeOperationalAlerts(vehicles, contracts, deposits);

  const filteredAlerts = alerts.filter((alert) => {
    if (filterSeverity !== 'all' && alert.severity !== filterSeverity) return false;
    if (filterCategory === 'returns' && !alert.category.startsWith('return_')) return false;
    if (filterCategory === 'compliance' && alert.targetTab !== 'vehicles') return false;
    if (filterCategory === 'deposits' && alert.targetTab !== 'deposits') return false;
    return true;
  });

  const handleAlertAction = (alert: OperationalAlert) => {
    if (alert.contract && onOpenCheckInModal && alert.category.startsWith('return_')) {
      onOpenCheckInModal(alert.contract);
      onClose();
      return;
    }
    setActiveTab(alert.targetTab);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl flex flex-col max-h-[85vh] space-y-4">
        {/* HEADER */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Centre d'Alertes & Notifications Proactives
                {criticalCount > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 font-bold uppercase">
                    {criticalCount} Urgent{criticalCount > 1 ? 's' : ''}
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">
                Surveillance continue : retours imminents, entretiens, contrôles techniques et cautions.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* STATS RAPIDES */}
        <div className="grid grid-cols-3 gap-2.5 text-xs">
          <button
            type="button"
            onClick={() => setFilterSeverity('critical')}
            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
              filterSeverity === 'critical'
                ? 'bg-rose-500/20 border-rose-500/60 text-white'
                : 'bg-slate-950/60 border-slate-800 text-rose-300 hover:border-rose-500/40'
            }`}
          >
            <span className="text-[10px] uppercase font-bold text-rose-400 block">Critiques</span>
            <span className="text-xl font-black font-mono">{criticalCount}</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterSeverity('warning')}
            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
              filterSeverity === 'warning'
                ? 'bg-amber-500/20 border-amber-500/60 text-white'
                : 'bg-slate-950/60 border-slate-800 text-amber-300 hover:border-amber-500/40'
            }`}
          >
            <span className="text-[10px] uppercase font-bold text-amber-400 block">À surveiller</span>
            <span className="text-xl font-black font-mono">{warningCount}</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterSeverity('all')}
            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
              filterSeverity === 'all'
                ? 'bg-slate-800 border-slate-600 text-white'
                : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Alertes</span>
            <span className="text-xl font-black font-mono">{alerts.length}</span>
          </button>
        </div>

        {/* FILTRES PAR CATÉGORIE */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
          <span className="text-slate-500 text-[11px] mr-1">Filtrer par :</span>
          <button
            onClick={() => setFilterCategory('all')}
            className={`px-2.5 py-1 rounded-lg border text-xs font-semibold cursor-pointer ${
              filterCategory === 'all'
                ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            Toutes ({alerts.length})
          </button>
          <button
            onClick={() => setFilterCategory('returns')}
            className={`px-2.5 py-1 rounded-lg border text-xs font-semibold cursor-pointer flex items-center gap-1 ${
              filterCategory === 'returns'
                ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Clock className="w-3 h-3" />
            <span>Retours ({returnsCount})</span>
          </button>
          <button
            onClick={() => setFilterCategory('compliance')}
            className={`px-2.5 py-1 rounded-lg border text-xs font-semibold cursor-pointer flex items-center gap-1 ${
              filterCategory === 'compliance'
                ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Car className="w-3 h-3" />
            <span>Flotte & Entretien ({complianceCount})</span>
          </button>
          <button
            onClick={() => setFilterCategory('deposits')}
            className={`px-2.5 py-1 rounded-lg border text-xs font-semibold cursor-pointer flex items-center gap-1 ${
              filterCategory === 'deposits'
                ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Banknote className="w-3 h-3" />
            <span>Cautions</span>
          </button>
        </div>

        {/* LISTE DÉROULANTE D'ALERTES */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
          {filteredAlerts.length === 0 ? (
            <div className="p-8 text-center bg-slate-950/40 border border-slate-800/80 rounded-2xl">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2 opacity-80" />
              <p className="text-sm font-bold text-white">Tout est en ordre !</p>
              <p className="text-xs text-slate-400 mt-1">
                Aucune alerte opérationnelle dans cette catégorie pour le moment.
              </p>
            </div>
          ) : (
            filteredAlerts.map((alert) => {
              const isCrit = alert.severity === 'critical';
              const isWarn = alert.severity === 'warning';

              return (
                <div
                  key={alert.id}
                  className={`p-3.5 rounded-xl border transition-all flex items-start justify-between gap-3 ${
                    isCrit
                      ? 'bg-rose-950/30 border-rose-500/40 hover:border-rose-500/70'
                      : isWarn
                      ? 'bg-amber-950/20 border-amber-500/30 hover:border-amber-500/60'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                        isCrit
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                          : isWarn
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                          : 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                      }`}
                    >
                      {isCrit ? (
                        <AlertOctagon className="w-4 h-4" />
                      ) : isWarn ? (
                        <AlertTriangle className="w-4 h-4" />
                      ) : (
                        <Info className="w-4 h-4" />
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">{alert.title}</span>
                        <span
                          className={`text-[10px] px-2 py-0.2 rounded-full font-mono font-bold ${
                            isCrit
                              ? 'bg-rose-500/30 text-rose-200 border border-rose-500/50'
                              : isWarn
                              ? 'bg-amber-500/30 text-amber-200 border border-amber-500/50'
                              : 'bg-blue-500/30 text-blue-200 border border-blue-500/50'
                          }`}
                        >
                          {alert.badgeText}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-0.5">{alert.description}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAlertAction(alert)}
                    className={`text-xs px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 shrink-0 transition-transform active:scale-95 cursor-pointer ${
                      alert.category.startsWith('return_')
                        ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-sm'
                        : isCrit
                        ? 'bg-rose-500 hover:bg-rose-400 text-slate-950 font-bold'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                    }`}
                  >
                    <span>
                      {alert.category.startsWith('return_') ? 'Restituer' : 'Gérer'}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* FOOTER */}
        <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
          <span>Date de référence agence : 01/09/2026</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
