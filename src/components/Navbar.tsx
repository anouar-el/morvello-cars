import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ActiveTab, UserRole } from '../types';
import { CompanyLogo } from './CompanyLogo';
import { MobileBottomNav } from './MobileBottomNav';
import {
  LayoutDashboard,
  FileText,
  Users,
  Car,
  ShieldCheck,
  Settings,
  History,
  PlusCircle,
  UserCheck,
  RefreshCw,
  Search,
  UserSquare2,
  Banknote,
  Crown,
  ChevronDown,
  KeyRound,
  LogOut,
  Cloud,
  CloudCheck,
  Sun,
  Moon,
  Bot,
  Sparkles,
  Layers,
  Bell,
} from 'lucide-react';
import { computeOperationalAlerts } from '../utils/alertsUtils';
import { getScopedDataForUser } from '../utils/managerScopeUtils';
import { useI18n } from '../i18n/I18nContext';
import { LanguageToggle } from './LanguageToggle';

interface NavbarProps {
  onOpenNotifications?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenNotifications }) => {
  const {
    activeTab,
    setActiveTab,
    currentUser,
    logout,
    contracts,
    vehicles,
    clients,
    deposits,
    users,
    getClientAssignedManager,
    cloudSyncStatus,
    lastCloudSync,
    syncWithCloud,
    theme,
    toggleTheme,
  } = useApp();

  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const { t } = useI18n();

  if (!currentUser) {
    return null;
  }

  // Données isolées selon le rôle
  const {
    scopedVehicles: managerScopedVehicles,
    scopedContracts: managerScopedContracts,
    scopedDeposits: managerScopedDeposits,
    scopedClients: managerScopedClients,
  } = getScopedDataForUser(currentUser, vehicles, contracts, deposits, clients, users);

  // Alertes opérationnelles sur le périmètre autorisé
  const { alerts, criticalCount } = computeOperationalAlerts(
    managerScopedVehicles,
    managerScopedContracts,
    managerScopedDeposits,
    undefined,
    managerScopedClients
  );

  const scopedVehicles = managerScopedVehicles.filter((v) => v.approvalStatus === 'approved');
  const activeContractsCount = managerScopedContracts.filter((c) => c.status === 'active').length;
  const availableVehiclesCount = scopedVehicles.filter((v) => v.status === 'available').length;
  const pendingApprovalsCount = vehicles.filter((v) => v.approvalStatus === 'pending_approval').length;
  const myPendingCount = vehicles.filter(
    (v) => v.approvalStatus === 'pending_approval' && (v.proposedBy === currentUser.name || v.assignedManagerId === currentUser.id)
  ).length;
  const heldDepositsCount = managerScopedDeposits.filter((d) => d.status === 'held').length;
  const scopedClientsCount = managerScopedClients.length;

  const navItems: { id: ActiveTab; label: string; icon: React.ReactNode; badge?: number | string }[] = [
    { id: 'dashboard', label: t('Dashboard'), icon: <LayoutDashboard className="w-4 h-4" /> },
    {
      id: 'contracts',
      label: t('Contrats'),
      icon: <FileText className="w-4 h-4" />,
      badge: activeContractsCount > 0 ? activeContractsCount : undefined,
    },
    {
      id: 'deposits',
      label: t('Cautions'),
      icon: <Banknote className="w-4 h-4" />,
      badge: heldDepositsCount > 0 ? t('{n} actives', { n: heldDepositsCount }) : undefined,
    },
    {
      id: 'clients',
      label: t('Clients'),
      icon: <Users className="w-4 h-4" />,
      badge: currentUser.role === 'manager' ? t('{n} miens', { n: scopedClientsCount }) : (clients.length > 0 ? `${clients.length}` : undefined),
    },
    {
      id: 'vehicles',
      label: t('Véhicules'),
      icon: <Car className="w-4 h-4" />,
      badge: currentUser.role === 'admin'
        ? (pendingApprovalsCount > 0
            ? t('{n} ({m} à valider)', { n: availableVehiclesCount, m: pendingApprovalsCount })
            : t('{n} dispo', { n: availableVehiclesCount }))
        : (myPendingCount > 0
            ? t('{n} ({m} en attente)', { n: availableVehiclesCount, m: myPendingCount })
            : t('{n} dispo', { n: availableVehiclesCount })),
    },
    {
      id: 'ai_assistant',
      label: t('Assistant IA'),
      icon: <Bot className="w-4 h-4 text-amber-400" />,
      badge: currentUser.role === 'admin' ? '360°' : t('Privé'),
    },
    { id: 'terms', label: t('Conditions V1.0'), icon: <ShieldCheck className="w-4 h-4" /> },
    ...(currentUser.role === 'admin'
      ? [
          {
            id: 'permissions' as ActiveTab,
            label: t('Équipe & Accès'),
            icon: <KeyRound className="w-4 h-4" />,
            badge: t('Sécurité'),
          },
          {
            id: 'contract_templates' as ActiveTab,
            label: t('Modèles de Contrat'),
            icon: <Layers className="w-4 h-4 text-amber-400" />,
            badge: t('3 Modèles'),
          },
        ]
      : []),
    { id: 'audit', label: t('Journal'), icon: <History className="w-4 h-4" /> },
    { id: 'settings', label: t('Paramètres'), icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <header className="no-print bg-slate-900 border-b border-slate-800 text-slate-100 sticky top-0 z-40 shadow-xl">
      {/* TOP ROW: BRAND, ROLE SWITCHER, CTA */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-2 h-16">
          {/* BRAND */}
          <div
            className="flex items-center gap-3 cursor-pointer group min-w-0"
            onClick={() => setActiveTab('dashboard')}
          >
            <div className="w-11 h-11 shrink-0 rounded-xl bg-slate-950 border border-amber-500/40 flex items-center justify-center p-1 shadow-md shadow-amber-500/10 group-hover:scale-105 transition-transform">
              <CompanyLogo size="sm" variant="icon-only" />
            </div>
            <div className="hidden sm:block min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base font-extrabold tracking-wider font-serif uppercase text-white truncate">
                  {t('Sté MORVELLO CARS')}
                </span>
                <span className="hidden lg:inline text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.2 rounded font-mono">
                  {t('PRESTIGE')}
                </span>
              </div>
              <p className="hidden xl:block text-[11px] text-slate-400 font-medium truncate">
                {t('Where luxury meets the road • Gestion des Contrats & PDF A4')}
              </p>
            </div>
          </div>

          {/* RIGHT TOOLS: PROFILE / ROLE TEST SWITCHER & ACTION CTA */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {/* ENHANCED PROFILE SWITCHER DROPDOWN */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer shadow-sm ${
                  currentUser.role === 'admin'
                    ? 'bg-amber-500/10 border-amber-500/40 text-amber-400 hover:bg-amber-500/20'
                    : currentUser.role === 'manager'
                    ? 'bg-blue-500/10 border-blue-500/40 text-blue-400 hover:bg-blue-500/20'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750'
                }`}
                title={t('Changer de profil de test (Super Admin ou Responsable spécifique)')}
              >
                {currentUser.role === 'admin' ? (
                  <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                ) : (
                  <UserCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                )}
                <div className="text-start leading-tight hidden lg:block">
                  <div className="text-white font-bold flex items-center gap-1.5">
                    {currentUser.name}
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-900 border border-slate-700 font-mono text-slate-300 uppercase">
                      {currentUser.role === 'admin' ? t('Super Admin') : currentUser.role === 'manager' ? t('Responsable') : t('Agent')}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 truncate max-w-[150px]">
                    {currentUser.assignedFleetName || currentUser.agency || t('Accès Global')}
                  </div>
                </div>
                <div className="hidden min-[400px]:block lg:hidden font-bold text-[11px] text-white">
                  {currentUser.role === 'admin' ? t('Gérant') : currentUser.name.split(' ')[0]}
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 ms-0.5" />
              </button>

              {/* POPUP MENU */}
              {isProfileMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsProfileMenuOpen(false)}
                  />
                  <div className="fixed top-16 start-3 end-3 sm:start-auto sm:end-6 sm:w-80 lg:absolute lg:top-auto lg:end-0 lg:mt-2 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="flex items-center gap-3 p-2.5 bg-slate-950/80 rounded-xl border border-slate-800 mb-2">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${
                          currentUser.role === 'admin'
                            ? 'bg-amber-500 text-slate-950'
                            : currentUser.role === 'manager'
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-700 text-slate-200'
                        }`}
                      >
                        {currentUser.role === 'admin' ? '👑' : currentUser.name.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-white text-xs truncate">{currentUser.name}</div>
                        <div className="text-[11px] text-slate-400 truncate">{currentUser.email}</div>
                        <div className="text-[10px] text-amber-400 font-medium mt-0.5">
                          {currentUser.role === 'admin'
                            ? t('Super Admin (Accès Global)')
                            : currentUser.role === 'manager'
                            ? `${t('Responsable')} • ${currentUser.assignedFleetName || currentUser.agency}`
                            : `${t('Agent')} • ${currentUser.assignedFleetName || currentUser.agency}`}
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => {
                          logout();
                          setIsProfileMenuOpen(false);
                        }}
                        className="w-full text-start p-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>{t('Se déconnecter de la session')}</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* PROACTIVE NOTIFICATIONS BELL BUTTON */}
            {onOpenNotifications && (
              <button
                type="button"
                onClick={onOpenNotifications}
                className={`relative flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer ${
                  criticalCount > 0
                    ? 'bg-rose-500/15 text-rose-300 border-rose-500/40 hover:bg-rose-500/25'
                    : alerts.length > 0
                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/40 hover:bg-amber-500/25'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                }`}
                title={t("Centre d'alertes : {n} alerte(s) opérationnelle(s)", { n: alerts.length })}
              >
                <Bell className="w-3.5 h-3.5" />
                {alerts.length > 0 && (
                  <span
                    className={`absolute -top-1 -end-1 text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center font-mono ${
                      criticalCount > 0
                        ? 'bg-rose-500 text-white animate-pulse'
                        : 'bg-amber-500 text-slate-950'
                    }`}
                  >
                    {alerts.length}
                  </span>
                )}
                <span className="hidden xl:inline font-medium">{t('Alertes')}</span>
              </button>
            )}

            {/* FIREBASE FIRESTORE SYNC STATUS */}
            <button
              onClick={() => syncWithCloud()}
              disabled={cloudSyncStatus === 'syncing'}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer ${
                cloudSyncStatus === 'syncing'
                  ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                  : cloudSyncStatus === 'synced'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
              title={t('Synchronisation en temps réel avec Firebase Cloud Firestore')}
            >
              {cloudSyncStatus === 'syncing' ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
              ) : cloudSyncStatus === 'synced' ? (
                <CloudCheck className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Cloud className="w-3.5 h-3.5 text-slate-400" />
              )}
              <span className="hidden xl:inline font-medium">
                {cloudSyncStatus === 'syncing'
                  ? t('Sync Cloud...')
                  : cloudSyncStatus === 'synced'
                  ? t('Cloud actif ({time})', { time: lastCloudSync || 'OK' })
                  : t('Cloud Firestore')}
              </span>
            </button>

            {/* THEME TOGGLE (DARK / LIGHT MODE) */}
            <button
              id="theme-toggle-navbar"
              type="button"
              onClick={toggleTheme}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer ${
                theme === 'dark'
                  ? 'bg-slate-800 hover:bg-slate-700 text-amber-400 border-slate-700 hover:border-amber-500/40'
                  : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30'
              }`}
              title={theme === 'dark' ? t('Passer en Mode Clair') : t('Passer en Mode Sombre')}
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden lg:inline font-medium">{t('Clair')}</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-amber-700" />
                  <span className="hidden lg:inline font-medium text-slate-800">{t('Sombre')}</span>
                </>
              )}
            </button>

            {/* LANGUE : FRANÇAIS / ARABE */}
            <LanguageToggle compact />

            {/* NEW CONTRACT PROMINENT BUTTON */}
            <button
              onClick={() => setActiveTab('new_contract')}
              className="hidden sm:flex items-center gap-2 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-bold text-xs lg:text-sm px-3.5 py-2 rounded-xl shadow-lg shadow-amber-500/25 transition-all active:scale-95 cursor-pointer whitespace-nowrap"
            >
              <PlusCircle className="w-4 h-4 shrink-0" />
              <span className="hidden lg:inline">+ {t('Nouveau contrat')}</span>
              <span className="lg:hidden">+ {t('Contrat')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* CLOISONNEMENT STATUS SUB-BAR */}
      <div className={`px-3 sm:px-6 lg:px-8 py-1 sm:py-1.5 text-xs border-t transition-colors ${
        currentUser.role === 'admin'
          ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
          : currentUser.role === 'manager'
          ? 'bg-blue-500/10 border-blue-500/30 text-blue-200'
          : 'bg-slate-950/80 border-slate-800 text-slate-300'
      }`}>
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 text-[10px] sm:text-[11px]">
          <div className="flex items-center gap-1.5 sm:gap-2 truncate">
            <span className={`w-2 h-2 rounded-full shrink-0 animate-pulse ${
              currentUser.role === 'admin' ? 'bg-amber-400' : currentUser.role === 'manager' ? 'bg-blue-400' : 'bg-slate-400'
            }`} />
            <span className="truncate">
              <strong>{currentUser.name}</strong> •{' '}
              {currentUser.role === 'admin' ? (
                <span className="font-semibold text-amber-300">👑 {t('Super Admin')}</span>
              ) : currentUser.role === 'manager' ? (
                <span>{t('Responsable')} ({currentUser.assignedFleetName || currentUser.agency})</span>
              ) : (
                <span>{t('Agent comptoir')}</span>
              )}
            </span>
            <span className="hidden sm:inline text-slate-400">•</span>
            <span className="hidden sm:inline text-slate-300">
              {currentUser.role === 'admin' ? (
                <span>{t('Supervision globale du parc entier')}</span>
              ) : currentUser.role === 'manager' ? (
                <span>{t('Flotte assignée : {n} véhicules', { n: scopedVehicles.length })}</span>
              ) : (
                <span>{t('Saisie des contrats')}</span>
              )}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {currentUser.role === 'admin' && pendingApprovalsCount > 0 && (
              <button
                onClick={() => setActiveTab('vehicles')}
                className="bg-amber-500 text-slate-950 font-bold px-1.5 sm:px-2 py-0.5 rounded text-[9.5px] sm:text-[10px] flex items-center gap-1 hover:bg-amber-400 cursor-pointer"
              >
                ⚠️ {pendingApprovalsCount} <span className="hidden sm:inline">{t('à valider')}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* DESKTOP NAVIGATION TABS (HIDDEN ON MOBILE, HANDLED BY MOBILE BOTTOM NAV) */}
      <nav className="hidden md:block bg-slate-950/70 border-t border-slate-800/80 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex items-center gap-1 overflow-x-auto py-1 text-sm no-scrollbar">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-md font-medium text-xs whitespace-nowrap transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-amber-500/15 text-amber-400 border-b-2 border-amber-400'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
                {item.badge !== undefined && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                      isActive
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'bg-slate-800 text-slate-300 border border-slate-700'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <MobileBottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUser={currentUser}
        activeContractsCount={activeContractsCount}
        heldDepositsCount={heldDepositsCount}
        availableVehiclesCount={availableVehiclesCount}
        onOpenNotifications={onOpenNotifications}
        alertsCount={alerts.length}
        criticalAlertsCount={criticalCount}
        cloudSyncStatus={cloudSyncStatus}
        syncWithCloud={syncWithCloud}
        theme={theme}
        toggleTheme={toggleTheme}
        logout={logout}
      />
    </header>
  );
};
