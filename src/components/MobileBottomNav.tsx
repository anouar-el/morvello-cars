import React, { useState } from 'react';
import { ActiveTab, User } from '../types';
import {
  LayoutDashboard,
  FileText,
  Car,
  Banknote,
  Plus,
  MoreHorizontal,
  Users,
  Bot,
  Settings,
  Shield,
  FileCode,
  ScrollText,
  History,
  LogOut,
  Sun,
  Moon,
  Cloud,
  CloudCheck,
  RefreshCw,
  Bell,
  X,
  Sparkles,
} from 'lucide-react';

interface MobileBottomNavProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  currentUser: User;
  activeContractsCount?: number;
  heldDepositsCount?: number;
  availableVehiclesCount?: number;
  onOpenNotifications?: () => void;
  alertsCount?: number;
  criticalAlertsCount?: number;
  cloudSyncStatus: string;
  syncWithCloud: () => void;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  logout: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  setActiveTab,
  currentUser,
  activeContractsCount = 0,
  heldDepositsCount = 0,
  availableVehiclesCount = 0,
  onOpenNotifications,
  alertsCount = 0,
  criticalAlertsCount = 0,
  cloudSyncStatus,
  syncWithCloud,
  theme,
  toggleTheme,
  logout,
}) => {
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

  const handleSelectTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    setIsMoreMenuOpen(false);
  };

  const isMoreTabActive = [
    'deposits',
    'clients',
    'ai_assistant',
    'permissions',
    'contract_templates',
    'terms',
    'audit',
    'settings',
  ].includes(activeTab);

  return (
    <>
      {/* ========================================================================= */}
      {/* 1. BOTTOM SHEET DRAWER FOR "PLUS" / MORE MENU                             */}
      {/* ========================================================================= */}
      {isMoreMenuOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-xs md:hidden animate-fade-in no-print">
          {/* Backdrop click to dismiss */}
          <div
            className="fixed inset-0"
            onClick={() => setIsMoreMenuOpen(false)}
          />

          <div className="relative w-full max-h-[85vh] bg-slate-900 border-t border-slate-700/80 rounded-t-3xl shadow-2xl p-4 flex flex-col overflow-hidden animate-slide-up z-10 pb-safe">
            {/* Grab handle */}
            <div className="w-12 h-1.5 bg-slate-700 rounded-full mx-auto mb-3 shrink-0" />

            {/* Header info */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                    currentUser.role === 'admin'
                      ? 'bg-amber-500 text-slate-950'
                      : currentUser.role === 'manager'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 text-slate-200'
                  }`}
                >
                  {currentUser.role === 'admin' ? '👑' : currentUser.name.charAt(0)}
                </div>
                <div className="leading-tight">
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span>{currentUser.name}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-amber-400 border border-slate-700">
                      {currentUser.role === 'admin' ? 'Super Admin' : currentUser.role === 'manager' ? 'Manager' : 'Agent'}
                    </span>
                  </div>
                  <div className="text-[10.5px] text-slate-400 truncate max-w-[210px]">
                    {currentUser.assignedFleetName || currentUser.agency || currentUser.email}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsMoreMenuOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Actions Bar (Cloud, Theme, Alerts) */}
            <div className="grid grid-cols-3 gap-2 py-3 border-b border-slate-800 text-[11px]">
              {/* Cloud Sync */}
              <button
                type="button"
                onClick={() => syncWithCloud()}
                disabled={cloudSyncStatus === 'syncing'}
                className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-950/70 border border-slate-800 text-slate-300 hover:bg-slate-800 transition-colors"
              >
                {cloudSyncStatus === 'syncing' ? (
                  <RefreshCw className="w-4 h-4 text-amber-400 animate-spin mb-1" />
                ) : cloudSyncStatus === 'synced' ? (
                  <CloudCheck className="w-4 h-4 text-emerald-400 mb-1" />
                ) : (
                  <Cloud className="w-4 h-4 text-slate-400 mb-1" />
                )}
                <span className="text-[10px] font-medium text-center">
                  {cloudSyncStatus === 'syncing' ? 'Sync...' : 'Cloud Synced'}
                </span>
              </button>

              {/* Theme Toggle */}
              <button
                type="button"
                onClick={toggleTheme}
                className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-950/70 border border-slate-800 text-slate-300 hover:bg-slate-800 transition-colors"
              >
                {theme === 'dark' ? (
                  <Sun className="w-4 h-4 text-amber-400 mb-1" />
                ) : (
                  <Moon className="w-4 h-4 text-amber-600 mb-1" />
                )}
                <span className="text-[10px] font-medium">
                  {theme === 'dark' ? 'Mode Clair' : 'Mode Sombre'}
                </span>
              </button>

              {/* Notifications */}
              {onOpenNotifications ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsMoreMenuOpen(false);
                    onOpenNotifications();
                  }}
                  className="flex flex-col items-center justify-center p-2 rounded-xl bg-slate-950/70 border border-slate-800 text-slate-300 hover:bg-slate-800 transition-colors relative"
                >
                  <Bell className="w-4 h-4 text-amber-400 mb-1" />
                  {alertsCount > 0 && (
                    <span
                      className={`absolute top-1 right-2 text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center ${
                        criticalAlertsCount > 0
                          ? 'bg-rose-500 text-white animate-pulse'
                          : 'bg-amber-500 text-slate-950'
                      }`}
                    >
                      {alertsCount}
                    </span>
                  )}
                  <span className="text-[10px] font-medium">
                    {alertsCount > 0 ? `${alertsCount} Alertes` : 'Alertes (0)'}
                  </span>
                </button>
              ) : (
                <div />
              )}
            </div>

            {/* Additional Modules Grid */}
            <div className="overflow-y-auto py-3 space-y-1.5 flex-1 pr-1 text-xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-2 pt-1 pb-0.5">
                Modules Opérationnels
              </div>

              {/* Cautions & Dépôts de garantie */}
              <button
                type="button"
                onClick={() => handleSelectTab('deposits')}
                className={`w-full flex items-center justify-between p-3 rounded-xl transition-colors ${
                  activeTab === 'deposits'
                    ? 'bg-amber-500/15 text-amber-400 font-bold border border-amber-500/30'
                    : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 flex items-center justify-center">
                    <Banknote className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <div className="font-semibold text-white flex items-center gap-2">
                      <span>Cautions & Dépôts</span>
                      {heldDepositsCount > 0 && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold bg-amber-500 text-slate-950">
                          {heldDepositsCount} actives
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400">Empreintes CB, chèques &amp; restitutions</div>
                  </div>
                </div>
              </button>

              {/* Clients */}
              <button
                type="button"
                onClick={() => handleSelectTab('clients')}
                className={`w-full flex items-center justify-between p-3 rounded-xl transition-colors ${
                  activeTab === 'clients'
                    ? 'bg-amber-500/15 text-amber-400 font-bold border border-amber-500/30'
                    : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/25 text-blue-400 flex items-center justify-center">
                    <Users className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <div className="font-semibold text-white">Clients & Conducteurs</div>
                    <div className="text-[10px] text-slate-400">Répertoire, permis & CIN numérisés</div>
                  </div>
                </div>
              </button>

              {/* AI Assistant */}
              <button
                type="button"
                onClick={() => handleSelectTab('ai_assistant')}
                className={`w-full flex items-center justify-between p-3 rounded-xl transition-colors ${
                  activeTab === 'ai_assistant'
                    ? 'bg-amber-500/15 text-amber-400 font-bold border border-amber-500/30'
                    : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-500/20 to-amber-400/20 border border-amber-500/30 text-amber-400 flex items-center justify-center">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <div className="font-semibold text-white flex items-center gap-1.5">
                      <span>Assistant IA Morvello</span>
                      <Sparkles className="w-3 h-3 text-amber-400" />
                    </div>
                    <div className="text-[10px] text-slate-400">Analyses, dispatch & requêtes intelligentes</div>
                  </div>
                </div>
              </button>

              {/* Admin-only Modules */}
              {currentUser.role === 'admin' && (
                <>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-amber-500/80 px-2 pt-2 pb-0.5">
                    Administration & Supervision
                  </div>

                  {/* Contract Templates */}
                  <button
                    type="button"
                    onClick={() => handleSelectTab('contract_templates')}
                    className={`w-full flex items-center justify-between p-3 rounded-xl transition-colors ${
                      activeTab === 'contract_templates'
                        ? 'bg-amber-500/15 text-amber-400 font-bold border border-amber-500/30'
                        : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 flex items-center justify-center">
                        <FileCode className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <div className="font-semibold text-white">Modèles de Contrats A4</div>
                        <div className="text-[10px] text-slate-400">Standard, VIP Prestige, B2B Corporate</div>
                      </div>
                    </div>
                  </button>

                  {/* Team & Permissions */}
                  <button
                    type="button"
                    onClick={() => handleSelectTab('permissions')}
                    className={`w-full flex items-center justify-between p-3 rounded-xl transition-colors ${
                      activeTab === 'permissions'
                        ? 'bg-amber-500/15 text-amber-400 font-bold border border-amber-500/30'
                        : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-400 flex items-center justify-center">
                        <Shield className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <div className="font-semibold text-white">Équipe & Rôles</div>
                        <div className="text-[10px] text-slate-400">Managers, agents & permissions granulaires</div>
                      </div>
                    </div>
                  </button>

                  {/* Audit Logs */}
                  <button
                    type="button"
                    onClick={() => handleSelectTab('audit')}
                    className={`w-full flex items-center justify-between p-3 rounded-xl transition-colors ${
                      activeTab === 'audit'
                        ? 'bg-amber-500/15 text-amber-400 font-bold border border-amber-500/30'
                        : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/25 text-purple-400 flex items-center justify-center">
                        <History className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <div className="font-semibold text-white">Journal d'Audit</div>
                        <div className="text-[10px] text-slate-400">Traçabilité complète des opérations</div>
                      </div>
                    </div>
                  </button>
                </>
              )}

              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-2 pt-2 pb-0.5">
                Configuration
              </div>

              {/* Terms */}
              <button
                type="button"
                onClick={() => handleSelectTab('terms')}
                className={`w-full flex items-center justify-between p-3 rounded-xl transition-colors ${
                  activeTab === 'terms'
                    ? 'bg-amber-500/15 text-amber-400 font-bold border border-amber-500/30'
                    : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center">
                    <ScrollText className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <div className="font-semibold text-white">Conditions Générales (Verso A4)</div>
                    <div className="text-[10px] text-slate-400">Version légale et clauses contractuelles</div>
                  </div>
                </div>
              </button>

              {/* Agency Settings */}
              <button
                type="button"
                onClick={() => handleSelectTab('settings')}
                className={`w-full flex items-center justify-between p-3 rounded-xl transition-colors ${
                  activeTab === 'settings'
                    ? 'bg-amber-500/15 text-amber-400 font-bold border border-amber-500/30'
                    : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center">
                    <Settings className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <div className="font-semibold text-white">Paramètres de l'Agence</div>
                    <div className="text-[10px] text-slate-400">Coordonnées, cachet, logo & tarifs</div>
                  </div>
                </div>
              </button>
            </div>

            {/* Logout button at bottom of sheet */}
            <div className="pt-2 border-t border-slate-800 mt-auto">
              <button
                type="button"
                onClick={() => {
                  setIsMoreMenuOpen(false);
                  logout();
                }}
                className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 font-semibold text-xs transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Se déconnecter de la session</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. FIXED ERGONOMIC BOTTOM NAVIGATION BAR                                  */}
      {/* ========================================================================= */}
      <nav
        aria-label="Navigation mobile principale"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-md border-t border-slate-800 shadow-[0_-8px_24px_rgba(0,0,0,0.5)] px-2 pt-1 pb-safe no-print"
      >
        <div className="max-w-md mx-auto grid grid-cols-5 items-center justify-items-center relative">
          {/* TAB 1: DASHBOARD */}
          <button
            type="button"
            onClick={() => handleSelectTab('dashboard')}
            className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-xl transition-all cursor-pointer ${
              activeTab === 'dashboard'
                ? 'text-amber-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="relative">
              <LayoutDashboard className="w-5 h-5" />
            </div>
            <span className="text-[10px] mt-1 tracking-tight">Accueil</span>
          </button>

          {/* TAB 2: CONTRATS */}
          <button
            type="button"
            onClick={() => handleSelectTab('contracts')}
            className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-xl transition-all cursor-pointer relative ${
              activeTab === 'contracts'
                ? 'text-amber-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="relative">
              <FileText className="w-5 h-5" />
              {activeContractsCount > 0 && (
                <span className="absolute -top-1.5 -right-2 text-[9px] font-black min-w-[15px] h-[15px] px-0.5 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center font-mono shadow">
                  {activeContractsCount}
                </span>
              )}
            </div>
            <span className="text-[10px] mt-1 tracking-tight">Contrats</span>
          </button>

          {/* TAB 3: PROMINENT CENTRAL FAB (NOUVEAU CONTRAT) */}
          <div className="relative -mt-6 flex flex-col items-center">
            <button
              type="button"
              onClick={() => handleSelectTab('new_contract')}
              className={`w-13 h-13 rounded-full flex items-center justify-center shadow-xl shadow-amber-500/40 border-4 border-slate-950 transition-transform active:scale-90 cursor-pointer ${
                activeTab === 'new_contract'
                  ? 'bg-gradient-to-tr from-amber-400 via-amber-300 to-amber-500 text-slate-950 scale-105 ring-2 ring-amber-400/80'
                  : 'bg-gradient-to-tr from-amber-500 via-amber-400 to-amber-500 text-slate-950 hover:brightness-110'
              }`}
              title="Créer un nouveau contrat de location"
            >
              <Plus className="w-6 h-6 stroke-[3]" />
            </button>
            <span className="text-[9.5px] font-bold text-amber-400 mt-1 tracking-tight">
              + Contrat
            </span>
          </div>

          {/* TAB 4: FLOTTE / VÉHICULES */}
          <button
            type="button"
            onClick={() => handleSelectTab('vehicles')}
            className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-xl transition-all cursor-pointer relative ${
              activeTab === 'vehicles'
                ? 'text-amber-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="relative">
              <Car className="w-5 h-5" />
              {availableVehiclesCount > 0 && (
                <span className="absolute -top-1.5 -right-2 text-[9px] font-black min-w-[15px] h-[15px] px-0.5 rounded-full bg-emerald-500 text-white flex items-center justify-center font-mono shadow">
                  {availableVehiclesCount}
                </span>
              )}
            </div>
            <span className="text-[10px] mt-1 tracking-tight">Flotte</span>
          </button>

          {/* TAB 5: PLUS (DRAWER MENU) */}
          <button
            type="button"
            onClick={() => setIsMoreMenuOpen(true)}
            className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-xl transition-all cursor-pointer relative ${
              isMoreTabActive || isMoreMenuOpen
                ? 'text-amber-400 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <div className="relative">
              <MoreHorizontal className="w-5 h-5" />
              {heldDepositsCount > 0 && (
                <span className="absolute -top-1.5 -right-2 text-[8px] font-bold w-3.5 h-3.5 rounded-full bg-blue-500 text-white flex items-center justify-center">
                  •
                </span>
              )}
            </div>
            <span className="text-[10px] mt-1 tracking-tight">Plus...</span>
          </button>
        </div>
      </nav>
    </>
  );
};
