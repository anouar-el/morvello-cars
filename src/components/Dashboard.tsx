import React from 'react';
import { useApp } from '../context/AppContext';
import { Contract, Vehicle } from '../types';
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
  Shield,
  Users,
} from 'lucide-react';
import { formatPlateFrench } from '../utils/plateUtils';
import { getVehicleHealthSummary, getTodayDateString } from '../utils/vehicleExpiryUtils';
import { DashboardAlertsBanner } from './DashboardAlertsBanner';
import { getScopedDataForUser } from '../utils/managerScopeUtils';

interface DashboardProps {
  onOpenCheckInModal?: (contract: Contract) => void;
  onOpenAllAlerts?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onOpenCheckInModal, onOpenAllAlerts }) => {
  const {
    contracts,
    vehicles,
    deposits,
    clients,
    users,
    currentUser,
    setActiveTab,
    openPdfModal,
  } = useApp();

  const isManager = currentUser?.role === 'manager';

  // Isolation stricte selon le rôle
  const { scopedVehicles, scopedContracts, scopedDeposits, scopedClients } = getScopedDataForUser(
    currentUser,
    vehicles,
    contracts,
    deposits,
    clients,
    users
  );

  const activeContracts = scopedContracts.filter((c) => c.status === 'active');
  const isVehicleRented = (v: Vehicle) =>
    v.status === 'rented' ||
    contracts.some(
      (c) =>
        c.status === 'active' &&
        (c.vehicleId === v.id ||
          (c.vehicleSnapshot?.plate &&
            v.plate &&
            c.vehicleSnapshot.plate.trim().toUpperCase() === v.plate.trim().toUpperCase()))
    );

  const rentedVehiclesCount = scopedVehicles.filter((v) => isVehicleRented(v)).length;
  const availableVehiclesCount = scopedVehicles.filter(
    (v) => !isVehicleRented(v) && v.status === 'available'
  ).length;

  // Vehicles compliance status (Assurance, Visite technique, Vignette, Vidange) pour la flotte concernée
  const vehiclesWithAlerts = scopedVehicles
    .map((v) => ({ vehicle: v, health: getVehicleHealthSummary(v) }))
    .filter((item) => item.health.hasAlert);

  const criticalVehicles = vehiclesWithAlerts.filter((i) => i.health.criticalCount > 0);
  const warningVehicles = vehiclesWithAlerts.filter((i) => i.health.criticalCount === 0);

  // Today reference
  const todayStr = getTodayDateString();
  const returnsToday = activeContracts.filter((c) => {
    const end = c.prolongation?.isActive ? c.prolongation.newEndDate : c.endDate;
    return end <= todayStr;
  });

  const agencyDisplayName =
    currentUser?.agency ||
    currentUser?.assignedFleetName ||
    (currentUser?.role === 'admin' ? 'Siège & Flotte Morvello' : 'Agence Morvello');

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-8">
      {/* 1. EN-TÊTE AVEC AGENCE DYNAMIQUE */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            <span className="text-xs uppercase tracking-wider text-amber-400 font-bold">
              Morvello Cars • {agencyDisplayName}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Bonjour, {currentUser?.name}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {isManager
              ? `Aperçu de votre agence (${scopedVehicles.length} véhicules attribués).`
              : "Aperçu global de l'activité du jour et supervision de l'ensemble du parc automobile."}
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

      {/* 2. LES CHIFFRES CLÉS ESSENTIELS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Flotte */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4.5 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              {isManager ? 'Ma Flotte en Location' : 'Véhicules en Location'}
            </p>
            <div className="text-2xl font-black text-white font-mono mt-1">
              {rentedVehiclesCount}{' '}
              <span className="text-sm font-normal text-slate-400 font-sans">
                / {scopedVehicles.length}
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
              {isManager ? 'Mes Contrats Actifs' : 'Contrats Actifs'}
            </p>
            <div className="text-2xl font-black text-white font-mono mt-1">
              {activeContracts.length}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Sur {scopedContracts.length} contrat{scopedContracts.length > 1 ? 's' : ''} au total
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

        {/* Répertoire Clients */}
        <button
          onClick={() => setActiveTab('clients')}
          className="bg-slate-900/80 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 rounded-2xl p-4.5 flex items-center justify-between text-left transition-all cursor-pointer group"
        >
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              {isManager ? 'Mes Clients' : 'Répertoire Clients'}
            </p>
            <div className="text-2xl font-black text-white font-mono mt-1">
              {scopedClients.length}
            </div>
            <p className="text-[11px] text-cyan-400 font-medium mt-0.5 group-hover:underline">
              {isManager ? 'Clients autorisés' : 'Clients enregistrés'} →
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 group-hover:scale-105 transition-transform">
            <Users className="w-5 h-5" />
          </div>
        </button>
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
              {isManager
                ? 'Véhicules de votre agence actuellement loués par vos clients'
                : 'Véhicules actuellement chez les clients'}
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
          <div className="py-8 text-center text-slate-400 text-xs space-y-2">
            <p className="font-medium text-slate-300">Aucune location en cours pour le moment.</p>
            <p className="text-[11px] text-slate-500">
              {isManager
                ? `Vos ${scopedVehicles.length} véhicules sont actuellement disponibles au parc.`
                : 'Tous les véhicules autorisés sont disponibles.'}
            </p>
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
        <button
          onClick={() => setActiveTab('vehicles')}
          className="p-4 bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl text-left transition-all flex items-center justify-between cursor-pointer group"
        >
          <div>
            <p className="font-bold text-white text-xs">
              {isManager ? `Ma Flotte Attribuée (${scopedVehicles.length})` : `Parc Automobile (${vehicles.length})`}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {isManager ? 'Consulter les disponibilités de mes véhicules' : 'Consulter les disponibilités et fiches véhicules'}
            </p>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 transition-colors" />
        </button>

        <button
          onClick={() => setActiveTab('clients')}
          className="p-4 bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl text-left transition-all flex items-center justify-between cursor-pointer group"
        >
          <div>
            <p className="font-bold text-white text-xs">
              {isManager ? `Mes Clients (${scopedClients.length})` : `Répertoire Clients (${clients.length})`}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Fiches d'identité, permis, coordonnées et historique
            </p>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 transition-colors" />
        </button>

        <button
          onClick={() => setActiveTab('deposits')}
          className="p-4 bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl text-left transition-all flex items-center justify-between cursor-pointer group"
        >
          <div>
            <p className="font-bold text-white text-xs">
              {isManager ? `Mes Cautions & Dépôts (${scopedDeposits.length})` : `Dépôts de Garantie & Cautions (${deposits.length})`}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Suivi des empreintes bancaires et chèques de garantie
            </p>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 transition-colors" />
        </button>
      </div>
    </div>
  );
};
