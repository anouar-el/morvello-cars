import React from 'react';
import { useApp } from '../context/AppContext';
import { Contract } from '../types';
import {
  FilePlus,
  Car,
  Clock,
  CheckCircle2,
  Eye,
  CheckSquare,
  ArrowRight,
  ShieldCheck,
  Calendar,
  Sparkles,
  ShieldAlert,
  AlertOctagon,
  Wrench,
} from 'lucide-react';
import { formatPlateFrench } from '../utils/plateUtils';
import { getVehicleHealthSummary } from '../utils/vehicleExpiryUtils';
import { DashboardAlertsBanner } from './DashboardAlertsBanner';

interface DashboardProps {
  onOpenCheckInModal?: (contract: Contract) => void;
  onOpenAllAlerts?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onOpenCheckInModal, onOpenAllAlerts }) => {
  const {
    contracts,
    vehicles,
    currentUser,
    setActiveTab,
    openPdfModal,
  } = useApp();

  const activeContracts = contracts.filter((c) => c.status === 'active');
  const rentedVehiclesCount = vehicles.filter((v) => v.status === 'rented').length;
  const availableVehiclesCount = vehicles.filter((v) => v.status === 'available').length;

  // Vehicles compliance status (Assurance, Visite technique, Vignette, Vidange)
  const vehiclesWithAlerts = vehicles
    .map((v) => ({ vehicle: v, health: getVehicleHealthSummary(v) }))
    .filter((item) => item.health.hasAlert);

  const criticalVehicles = vehiclesWithAlerts.filter((i) => i.health.criticalCount > 0);
  const warningVehicles = vehiclesWithAlerts.filter((i) => i.health.criticalCount === 0);

  // Today reference
  const todayStr = '2026-09-01';
  const returnsToday = activeContracts.filter((c) => {
    const end = c.prolongation?.isActive ? c.prolongation.newEndDate : c.endDate;
    return end <= todayStr;
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-8">
      {/* 1. EN-TÊTE ÉPURÉ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            <span className="text-xs uppercase tracking-wider text-amber-400 font-bold">
              Morvello Cars • Agence Nouaceur
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Bonjour, {currentUser?.name}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Aperçu essentiel de l'activité du jour et suivi des locations en cours.
          </p>
        </div>

        <button
          onClick={() => setActiveTab('new_contract')}
          className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-bold px-4 py-2.5 rounded-xl shadow-md transition-all active:scale-95 text-xs cursor-pointer self-start sm:self-center"
        >
          <FilePlus className="w-4 h-4" />
          <span>+ Nouveau Contrat</span>
        </button>
      </div>

      {/* 2. LES 3 CHIFFRES CLÉS ESSENTIELS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Flotte */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4.5 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Véhicules en Location
            </p>
            <div className="text-2xl font-black text-white font-mono mt-1">
              {rentedVehiclesCount}{' '}
              <span className="text-sm font-normal text-slate-400 font-sans">
                / {vehicles.length}
              </span>
            </div>
            <p className="text-[11px] text-emerald-400 font-medium mt-0.5">
              {availableVehiclesCount} disponible{availableVehiclesCount > 1 ? 's' : ''} au parc
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Car className="w-5 h-5" />
          </div>
        </div>

        {/* Contrats en cours */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4.5 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Contrats Actifs
            </p>
            <div className="text-2xl font-black text-white font-mono mt-1">
              {activeContracts.length}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Sur {contracts.length} contrats au total
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* Retours prévus */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4.5 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Retours du Jour
            </p>
            <div className="text-2xl font-black text-white font-mono mt-1">
              {returnsToday.length}
            </div>
            <p className="text-[11px] mt-0.5 font-medium">
              {returnsToday.length > 0 ? (
                <span className="text-amber-400">À réceptionner aujourd'hui</span>
              ) : (
                <span className="text-emerald-400">À jour</span>
              )}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 2.5 VIGILANCE OPÉRATIONNELLE & ALERTES PROACTIVES */}
      <DashboardAlertsBanner
        onOpenCheckInModal={onOpenCheckInModal}
        onOpenAllAlerts={onOpenAllAlerts}
      />

      {/* 3. CONTRATS EN COURS & RESTITUTIONS PRIORITAIRES */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h2 className="text-sm font-bold text-white tracking-tight">
              Locations en Cours ({activeContracts.length})
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Véhicules actuellement chez les clients
            </p>
          </div>

          <button
            onClick={() => setActiveTab('contracts')}
            className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 cursor-pointer"
          >
            Voir tous les contrats <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {activeContracts.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-xs">
            Aucun contrat actif pour le moment.
          </div>
        ) : (
          <div className="space-y-2.5">
            {activeContracts.slice(0, 5).map((cnt) => {
              const effectiveEndDate = cnt.prolongation?.isActive
                ? cnt.prolongation.newEndDate
                : cnt.endDate;

              const isDue = effectiveEndDate <= todayStr;

              return (
                <div
                  key={cnt.id}
                  className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-amber-400 text-xs">
                        {cnt.contractNumber}
                      </span>
                      <span className="text-white font-bold text-xs">
                        {cnt.clientSnapshot.lastName} {cnt.clientSnapshot.firstName}
                      </span>
                      {isDue && (
                        <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded font-semibold">
                          Retour aujourd'hui
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-2">
                      <span className="text-slate-300 font-medium">
                        {cnt.vehicleSnapshot.brand} {cnt.vehicleSnapshot.model}
                      </span>
                      <span>•</span>
                      <span className="font-mono text-amber-300">
                        {formatPlateFrench(cnt.vehicleSnapshot.plate)}
                      </span>
                      <span>•</span>
                      <span>
                        Retour prévu le {new Date(effectiveEndDate).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                    <button
                      onClick={() => openPdfModal(cnt)}
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                      title="Consulter le contrat PDF"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Contrat PDF</span>
                    </button>

                    {onOpenCheckInModal && (
                      <button
                        onClick={() => onOpenCheckInModal(cnt)}
                        className="px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs transition-colors flex items-center gap-1 cursor-pointer"
                        title="Restituer le véhicule"
                      >
                        <CheckSquare className="w-3.5 h-3.5" />
                        <span>Restituer</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. RACCOURCIS SIMPLES & PARC */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
        <button
          onClick={() => setActiveTab('vehicles')}
          className="p-4 bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl text-left transition-all flex items-center justify-between cursor-pointer group"
        >
          <div>
            <p className="font-bold text-white text-xs">Parc Automobile ({vehicles.length})</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Consulter les disponibilités et fiches véhicules
            </p>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 transition-colors" />
        </button>

        <button
          onClick={() => setActiveTab('deposits')}
          className="p-4 bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl text-left transition-all flex items-center justify-between cursor-pointer group"
        >
          <div>
            <p className="font-bold text-white text-xs">Dépôts de Garantie & Cautions</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Suivi des empreintes bancaires et chèques
            </p>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 transition-colors" />
        </button>
      </div>
    </div>
  );
};
