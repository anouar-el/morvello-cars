import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ActiveTab, UserRole } from '../types';
import { CompanyLogo } from './CompanyLogo';
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
    managerScopedDeposits
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
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    {
      id: 'contracts',
      label: 'Contrats',
      icon: <FileText className="w-4 h-4" />,
      badge: activeContractsCount > 0 ? activeContractsCount : undefined,
    },
    {
      id: 'deposits',
      label: 'Cautions',
      icon: <Banknote className="w-4 h-4" />,
      badge: heldDepositsCount > 0 ? `${heldDepositsCount} actives` : undefined,
    },
    {
      id: 'clients',
      label: 'Clients',
      icon: <Users className="w-4 h-4" />,
      badge: currentUser.role === 'manager' ? `${scopedClientsCount} miens` : (clients.length > 0 ? `${clients.length}` : undefined),
    },
    {
      id: 'vehicles',
      label: 'Véhicules',
      icon: <Car className="w-4 h-4" />,
      badge: currentUser.role === 'admin'
        ? (pendingApprovalsCount > 0 ? `${availableVehiclesCount} (${pendingApprovalsCount} à valider)` : `${availableVehiclesCount} dispo`)
        : (myPendingCount > 0 ? `${availableVehiclesCount} (${myPendingCount} en attente)` : `${availableVehiclesCount} dispo`),
    },
    {
      id: 'ai_assistant',
      label: 'Assistant IA',
      icon: <Bot className="w-4 h-4 text-amber-400" />,
      badge: currentUser.role === 'admin' ? '360°' : 'Privé',
    },
    { id: 'terms', label: 'Conditions V1.0', icon: <ShieldCheck className="w-4 h-4" /> },
    ...(currentUser.role === 'admin'
      ? [
          {
            id: 'permissions' as ActiveTab,
            label: 'Équipe & Accès',
            icon: <KeyRound className="w-4 h-4" />,
            badge: 'Sécurité',
          },
          {
            id: 'contract_templates' as ActiveTab,
            label: 'Modèles de Contrat',
            icon: <Layers className="w-4 h-4 text-amber-400" />,
            badge: '3 Modèles',
          },
        ]
      : []),
    { id: 'audit', label: 'Journal', icon: <History className="w-4 h-4" /> },
    { id: 'settings', label: 'Paramètres', icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <header className="no-print bg-slate-900 border-b border-slate-800 text-slate-100 sticky top-0 z-40 shadow-xl">
      {/* TOP ROW: BRAND, ROLE SWITCHER, CTA */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* BRAND */}
          <div
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => setActiveTab('dashboard')}
          >
            <div className="w-11 h-11 rounded-xl bg-slate-950 border border-amber-500/40 flex items-center justify-center p-1 shadow-md shadow-amber-500/10 group-hover:scale-105 transition-transform">
              <CompanyLogo size="sm" variant="icon-only" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-extrabold tracking-wider font-serif uppercase text-white">
                  Sté MORVELLO CARS
                </span>
                <span className="text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.2 rounded font-mono">
                  PRESTIGE
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                Where luxury meets the road • Gestion des Contrats & PDF A4
              </p>
            </div>
          </div>

          {/* RIGHT TOOLS: PROFILE / ROLE TEST SWITCHER & ACTION CTA */}
          <div className="flex items-center gap-2 sm:gap-3">
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
                title="Changer de profil de test (Super Admin ou Responsable spécifique)"
              >
                {currentUser.role === 'admin' ? (
                  <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                ) : (
                  <UserCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                )}
                <div className="text-left leading-tight hidden sm:block">
                  <div className="text-white font-bold flex items-center gap-1.5">
                    {currentUser.name}
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-900 border border-slate-700 font-mono text-slate-300 uppercase">
                      {currentUser.role === 'admin' ? 'Super Admin' : currentUser.role === 'manager' ? 'Responsable' : 'Agent'}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 truncate max-w-[150px]">
                    {currentUser.assignedFleetName || currentUser.agency || 'Accès Global'}
                  </div>
                </div>
                <div className="sm:hidden font-bold text-[11px] text-white">
                  {currentUser.role === 'admin' ? 'Gérant' : currentUser.name.split(' ')[0]}
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-0.5" />
              </button>

              {/* POPUP MENU */}
              {isProfileMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsProfileMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95 duration-150">
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
                            ? 'Super Admin (Accès Global)'
                            : currentUser.role === 'manager'
                            ? `Responsable • ${currentUser.assignedFleetName || currentUser.agency}`
                            : `Agent • ${currentUser.assignedFleetName || currentUser.agency}`}
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
                        className="w-full text-left p-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Se déconnecter de la session</span>
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
                title={`Centre d'alertes : ${alerts.length} alerte(s) opérationnelle(s)`}
              >
                <Bell className="w-3.5 h-3.5" />
                {alerts.length > 0 && (
                  <span
                    className={`absolute -top-1 -right-1 text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center font-mono ${
                      criticalCount > 0
                        ? 'bg-rose-500 text-white animate-pulse'
                        : 'bg-amber-500 text-slate-950'
                    }`}
                  >
                    {alerts.length}
                  </span>
                )}
                <span className="hidden xl:inline font-medium">Alertes</span>
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
              title="Synchronisation en temps réel avec Firebase Cloud Firestore"
            >
              {cloudSyncStatus === 'syncing' ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
              ) : cloudSyncStatus === 'synced' ? (
                <CloudCheck className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Cloud className="w-3.5 h-3.5 text-slate-400" />
              )}
              <span className="hidden md:inline font-medium">
                {cloudSyncStatus === 'syncing'
                  ? 'Sync Cloud...'
                  : cloudSyncStatus === 'synced'
                  ? `Cloud actif (${lastCloudSync || 'OK'})`
                  : 'Cloud Firestore'}
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
              title={theme === 'dark' ? 'Passer en Mode Clair' : 'Passer en Mode Sombre'}
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline font-medium">Clair</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-amber-700" />
                  <span className="hidden sm:inline font-medium text-slate-800">Sombre</span>
                </>
              )}
            </button>

            {/* NEW CONTRACT PROMINENT BUTTON */}
            <button
              onClick={() => setActiveTab('new_contract')}
              className="flex items-center gap-2 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-bold text-xs sm:text-sm px-3.5 py-2 rounded-xl shadow-lg shadow-amber-500/25 transition-all active:scale-95 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span className="hidden sm:inline">+ Nouveau contrat</span>
              <span className="sm:hidden">+ Contrat</span>
            </button>
          </div>
        </div>
      </div>

      {/* CLOISONNEMENT STATUS SUB-BAR */}
      <div className={`px-4 sm:px-6 lg:px-8 py-1.5 text-xs border-t transition-colors ${
        currentUser.role === 'admin'
          ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
          : currentUser.role === 'manager'
          ? 'bg-blue-500/10 border-blue-500/30 text-blue-200'
          : 'bg-slate-950/80 border-slate-800 text-slate-300'
      }`}>
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full animate-pulse ${
              currentUser.role === 'admin' ? 'bg-amber-400' : currentUser.role === 'manager' ? 'bg-blue-400' : 'bg-slate-400'
            }`} />
            <span>
              <strong>Session active :</strong> {currentUser.name} ({currentUser.role === 'admin' ? 'Super Admin / Gérant' : `Responsable d'agence`})
            </span>
            <span className="text-slate-400">•</span>
            <span>
              {currentUser.role === 'admin' ? (
                <span>Supervision globale du parc entier • Droit exclusif d'affectation des véhicules & validation des ajouts</span>
              ) : currentUser.role === 'manager' ? (
                <span>
                  <strong>Flotte assignée :</strong> {currentUser.assignedFleetName} ({scopedVehicles.length} véhicules)
                </span>
              ) : (
                <span>Agent comptoir</span>
              )}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {currentUser.role === 'admin' && pendingApprovalsCount > 0 && (
              <button
                onClick={() => setActiveTab('vehicles')}
                className="bg-amber-500 text-slate-950 font-bold px-2 py-0.5 rounded text-[10px] flex items-center gap-1 hover:bg-amber-400 cursor-pointer"
              >
                ⚠️ {pendingApprovalsCount} à valider
              </button>
            )}
          </div>
        </div>
      </div>

      {/* BOTTOM NAVIGATION TABS */}
      <nav className="bg-slate-950/70 border-t border-slate-800/80 px-4 sm:px-6 lg:px-8">
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
    </header>
  );
};
