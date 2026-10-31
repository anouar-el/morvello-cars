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
  AlertTriangle,
  Banknote,
} from 'lucide-react';
import { formatPlateFrench } from '../utils/plateUtils';
import { getVehicleHealthSummary, getTodayDateString } from '../utils/vehicleExpiryUtils';
import { DashboardAlertsBanner } from './DashboardAlertsBanner';
import { InstallPrompt } from './InstallPrompt';
import { PushOptIn } from './PushOptIn';
import { ReservationsPanel } from './reservations/ReservationsPanel';
import { useI18n } from '../i18n/I18nContext';
import { getScopedDataForUser } from '../utils/managerScopeUtils';
import { effectiveEndDate, summarizeToday } from '../lib/dashboardTodo';

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
  const { t } = useI18n();

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
  const today = summarizeToday(scopedContracts, todayStr);
  const returnsToday = [...today.overdue, ...today.dueToday];
  const hasTodo = returnsToday.length > 0 || today.unpaid.count > 0;
  const activeSorted = [...activeContracts].sort((x, y) => effectiveEndDate(x).localeCompare(effectiveEndDate(y)));

  const agencyDisplayName =
    currentUser?.agency ||
    currentUser?.assignedFleetName ||
    (currentUser?.role === 'admin' ? t('Siège & Flotte Morvello') : t('Agence Morvello'));

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-8">
      <InstallPrompt />
      <PushOptIn />

      {/* 1. EN-TÊTE AVEC AGENCE DYNAMIQUE */}
      <div className="relative overflow-hidden glass rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -end-16 w-72 h-72 rounded-full bg-amber-500/15 blur-3xl"
        />
        <div className="relative">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            <span className="text-xs uppercase tracking-wider text-amber-400 font-bold">
              {t('Morvello Cars • {agencyDisplayName}', { agencyDisplayName })}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight gold-text">
            {t('Bonjour, {name}', { name: currentUser?.name ?? '' })}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {isManager
              ? t('Aperçu de votre agence ({n} véhicules attribués).', { n: scopedVehicles.length })
              : t("Aperçu global de l'activité du jour et supervision de l'ensemble du parc automobile.")}
          </p>
        </div>

        <button
          onClick={() => setActiveTab('new_contract')}
          className="relative hidden sm:flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-bold px-5 py-3 rounded-2xl shadow-lg shadow-amber-500/25 transition-all active:scale-95 text-sm cursor-pointer sm:w-auto lg:hidden"
        >
          <FilePlus className="w-4 h-4" />
          <span>+ {t('Nouveau Contrat')}</span>
        </button>
      </div>

      {/* ACCÈS RAPIDES (pouce) : mobile uniquement */}
      <div className="grid grid-cols-4 gap-2 sm:hidden">
        {[
          { tab: 'contracts' as const, label: t('Contrats'), icon: <Clock className="w-5 h-5" /> },
          { tab: 'vehicles' as const, label: t('Véhicules'), icon: <Car className="w-5 h-5" /> },
          { tab: 'clients' as const, label: t('Clients'), icon: <Users className="w-5 h-5" /> },
          { tab: 'deposits' as const, label: t('Cautions'), icon: <CheckCircle2 className="w-5 h-5" /> },
        ].map((item) => (
          <button
            key={item.tab}
            type="button"
            onClick={() => setActiveTab(item.tab)}
            className="glass rounded-2xl py-3 flex flex-col items-center gap-1.5 text-amber-300 active:scale-95 transition-transform cursor-pointer"
          >
            {item.icon}
            <span className="text-[11px] font-semibold text-slate-200">{item.label}</span>
          </button>
        ))}
      </div>

      {/* 1.5 À FAIRE AUJOURD'HUI */}
      <section className="glass rounded-2xl p-4 sm:p-5 space-y-3" aria-label={t("À faire aujourd'hui")}>
        <h2 className="text-sm font-bold text-white tracking-tight">{t("À faire aujourd'hui")}</h2>
        {!hasTodo ? (
          <p className="flex items-center gap-2 text-xs text-emerald-400 font-medium">
            <CheckCircle2 className="w-4 h-4" />
            {t("Rien d'urgent aujourd'hui.")}
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {today.overdue.length > 0 && (
              <button
                type="button"
                onClick={() => setActiveTab('contracts')}
                className="flex items-center gap-3 p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-start transition-colors cursor-pointer"
              >
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-white">{t('{n} retour(s) en retard', { n: today.overdue.length })}</span>
                  <span className="block text-[11px] text-rose-300 truncate">
                    {today.overdue
                      .slice(0, 2)
                      .map((c) => `${c.clientSnapshot.lastName} ${c.clientSnapshot.firstName}`)
                      .join(', ')}
                  </span>
                </span>
                <ArrowRight className="w-4 h-4 text-slate-400 rtl:rotate-180 shrink-0" />
              </button>
            )}
            {today.dueToday.length > 0 && (
              <button
                type="button"
                onClick={() => setActiveTab('contracts')}
                className="flex items-center gap-3 p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-start transition-colors cursor-pointer"
              >
                <Clock className="w-5 h-5 text-amber-400 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-white">{t("{n} retour(s) prévu(s) aujourd'hui", { n: today.dueToday.length })}</span>
                  <span className="block text-[11px] text-amber-300 truncate">
                    {today.dueToday
                      .slice(0, 2)
                      .map((c) => `${c.clientSnapshot.lastName} ${c.clientSnapshot.firstName}`)
                      .join(', ')}
                  </span>
                </span>
                <ArrowRight className="w-4 h-4 text-slate-400 rtl:rotate-180 shrink-0" />
              </button>
            )}
            {today.unpaid.count > 0 && (
              <button
                type="button"
                onClick={() => setActiveTab('contracts')}
                className="flex items-center gap-3 p-3 rounded-xl border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-start transition-colors cursor-pointer"
              >
                <Banknote className="w-5 h-5 text-blue-400 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-white">{t('{n} contrat(s) avec un solde à encaisser', { n: today.unpaid.count })}</span>
                  <span className="block text-[11px] text-blue-300 font-mono">{t('{total} MAD au total', { total: today.unpaid.total.toLocaleString() })}</span>
                </span>
                <ArrowRight className="w-4 h-4 text-slate-400 rtl:rotate-180 shrink-0" />
              </button>
            )}
          </div>
        )}
      </section>

      {/* 2. LES CHIFFRES CLÉS ESSENTIELS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Flotte */}
        <div className="glass rounded-2xl p-4 flex items-center justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              {isManager ? t('Ma Flotte en Location') : t('Véhicules en Location')}
            </p>
            <div className="text-2xl font-black text-white font-mono mt-1">
              {rentedVehiclesCount}{' '}
              <span className="text-sm font-normal text-slate-400 font-sans">
                / {scopedVehicles.length}
              </span>
            </div>
            <p className="text-[11px] text-emerald-400 font-medium mt-0.5">
              {availableVehiclesCount > 1
                ? t('{n} disponibles au parc', { n: availableVehiclesCount })
                : t('{n} disponible au parc', { n: availableVehiclesCount })}
            </p>
          </div>
          <div className="hidden min-[420px]:flex w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 items-center justify-center text-blue-400">
            <Car className="w-5 h-5" />
          </div>
        </div>

        {/* Contrats en cours */}
        <div className="glass rounded-2xl p-4 flex items-center justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              {isManager ? t('Mes Contrats Actifs') : t('Contrats Actifs')}
            </p>
            <div className="text-2xl font-black text-white font-mono mt-1">
              {activeContracts.length}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {scopedContracts.length > 1
                ? t('Sur {n} contrats au total', { n: scopedContracts.length })
                : t('Sur {n} contrat au total', { n: scopedContracts.length })}
            </p>
          </div>
          <div className="hidden min-[420px]:flex w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 items-center justify-center text-amber-400">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* Retours prévus */}
        <div className="glass rounded-2xl p-4 flex items-center justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              {t('Retours du Jour')}
            </p>
            <div className="text-2xl font-black text-white font-mono mt-1">
              {returnsToday.length}
            </div>
            <p className="text-[11px] mt-0.5 font-medium">
              {returnsToday.length > 0 ? (
                <span className="text-amber-400">{t("À réceptionner aujourd'hui")}</span>
              ) : (
                <span className="text-emerald-400">{t('À jour')}</span>
              )}
            </p>
          </div>
          <div className="hidden min-[420px]:flex w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 items-center justify-center text-purple-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* Répertoire Clients */}
        <button
          onClick={() => setActiveTab('clients')}
          className="glass hover:border-cyan-500/40 rounded-2xl p-4 flex items-center justify-between gap-2 text-start transition-all cursor-pointer group"
        >
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              {isManager ? t('Mes Clients') : t('Répertoire Clients')}
            </p>
            <div className="text-2xl font-black text-white font-mono mt-1">
              {scopedClients.length}
            </div>
            <p className="text-[11px] text-cyan-400 font-medium mt-0.5 group-hover:underline">
              {isManager ? t('Clients autorisés') : t('Clients enregistrés')} →
            </p>
          </div>
          <div className="hidden min-[420px]:flex w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 items-center justify-center text-cyan-400 group-hover:scale-105 transition-transform">
            <Users className="w-5 h-5" />
          </div>
        </button>
      </div>

      {/* 2.5 VIGILANCE OPÉRATIONNELLE & ALERTES PROACTIVES */}
      <DashboardAlertsBanner
        onOpenCheckInModal={onOpenCheckInModal}
        onOpenAllAlerts={onOpenAllAlerts}
      />

      {/* 2.55 RÉSERVATIONS SANS CONTRAT */}
      <ReservationsPanel />

      {/* 3. CONTRATS EN COURS & RESTITUTIONS PRIORITAIRES */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h2 className="text-sm font-bold text-white tracking-tight">
              {t('Locations en Cours ({n})', { n: activeContracts.length })}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {isManager
                ? t('Véhicules de votre agence actuellement loués par vos clients')
                : t('Véhicules actuellement chez les clients')}
            </p>
          </div>

          <button
            onClick={() => setActiveTab('contracts')}
            className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 cursor-pointer"
          >
            {t('Voir tous les contrats')} <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
          </button>
        </div>

        {activeContracts.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs space-y-2">
            <p className="font-medium text-slate-300">{t('Aucune location en cours pour le moment.')}</p>
            <p className="text-[11px] text-slate-500">
              {isManager
                ? t('Vos {n} véhicules sont actuellement disponibles au parc.', { n: scopedVehicles.length })
                : t('Tous les véhicules autorisés sont disponibles.')}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {activeSorted.slice(0, 5).map((cnt) => {
              const effectiveEndDate = cnt.prolongation?.isActive
                ? cnt.prolongation.newEndDate
                : cnt.endDate;

              const isOverdue = effectiveEndDate < todayStr;
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
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded font-semibold ${
                            isOverdue ? 'bg-rose-500/20 text-rose-300' : 'bg-amber-500/20 text-amber-300'
                          }`}
                        >
                          {isOverdue ? t('En retard') : t("Retour aujourd'hui")}
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
                        {t('Retour prévu le {date}', { date: new Date(effectiveEndDate).toLocaleDateString('fr-FR') })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                    <button
                      onClick={() => openPdfModal(cnt)}
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                      title={t('Consulter le contrat PDF')}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>{t('Contrat PDF')}</span>
                    </button>

                    {onOpenCheckInModal && (
                      <button
                        onClick={() => onOpenCheckInModal(cnt)}
                        className="px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs transition-colors flex items-center gap-1 cursor-pointer"
                        title={t('Restituer le véhicule')}
                      >
                        <CheckSquare className="w-3.5 h-3.5" />
                        <span>{t('Restituer')}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};
