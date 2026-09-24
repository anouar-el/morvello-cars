/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/Navbar';
import { SyncErrorBanner } from './components/SyncErrorBanner';
import { Dashboard } from './components/Dashboard';
import { LoginView } from './components/LoginView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Contract } from './types';
import { Bot, Sparkles } from 'lucide-react';

// Core application view components (statically imported for instant, error-free tab navigation)
import { ContractWizard } from './components/ContractWizard';
import { ContractsList } from './components/ContractsList';
import { ClientsList } from './components/ClientsList';
import { VehiclesList } from './components/VehiclesList';
import { TermsManager } from './components/TermsManager';
import { SettingsView } from './components/SettingsView';
import { AuditView } from './components/AuditView';
import { DepositsManagement } from './components/DepositsManagement';
import { PermissionsManager } from './components/PermissionsManager';
import { PdfModal } from './components/PdfModal';
import { ReturnCheckInModal } from './components/ReturnCheckInModal';
import { InspectionManagerModal } from './components/InspectionManagerModal';
import { NotificationsCenterModal } from './components/NotificationsCenterModal';
import { MemberAiAssistant } from './components/MemberAiAssistant';
import { ContractTemplatesManager } from './components/ContractTemplatesManager';

function MainAppContent() {
  const { activeTab, setActiveTab, currentUser } = useApp();
  const [checkInContract, setCheckInContract] = useState<Contract | null>(null);
  const [inspectionContract, setInspectionContract] = useState<Contract | null>(null);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [isAssistantExpanded, setIsAssistantExpanded] = useState(false);

  if (!currentUser) {
    return <LoginView />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <Dashboard
            onOpenCheckInModal={(contract) => setCheckInContract(contract)}
            onOpenAllAlerts={() => setIsNotificationsOpen(true)}
          />
        );
      case 'new_contract':
        return <ContractWizard />;
      case 'contracts':
        return <ContractsList onOpenCheckInModal={(contract) => setCheckInContract(contract)} />;
      case 'deposits':
        return <DepositsManagement />;
      case 'clients':
        return <ClientsList />;
      case 'vehicles':
        return <VehiclesList />;
      case 'ai_assistant':
        return <MemberAiAssistant />;
      case 'terms':
        return <TermsManager />;
      case 'permissions':
        if (currentUser.role !== 'admin') {
          return (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-2xl mx-auto text-center space-y-5 my-12 shadow-2xl">
              <div className="w-16 h-16 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center mx-auto text-2xl">
                🛡️
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-white">Accès Réservé au Gérant & Administrateur</h2>
                <p className="text-xs text-slate-400 leading-relaxed max-w-md mx-auto">
                  La rubrique de gestion de l'équipe, des permissions et des identifiants est strictement réservée au Gérant de l’agence Morvello Cars.
                </p>
              </div>
              <div className="pt-2">
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl shadow-lg shadow-amber-500/20 cursor-pointer transition-colors"
                >
                  Retour au Tableau de Bord
                </button>
              </div>
            </div>
          );
        }
        return <PermissionsManager />;
      case 'contract_templates':
        if (currentUser.role !== 'admin') {
          return (
            <Dashboard
              onOpenCheckInModal={(contract) => setCheckInContract(contract)}
              onOpenAllAlerts={() => setIsNotificationsOpen(true)}
            />
          );
        }
        return <ContractTemplatesManager />;
      case 'settings':
        return <SettingsView />;
      case 'audit':
        return <AuditView />;
      default:
        return (
          <Dashboard
            onOpenCheckInModal={(contract) => setCheckInContract(contract)}
            onOpenAllAlerts={() => setIsNotificationsOpen(true)}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased selection:bg-amber-500 selection:text-slate-950 relative">
      {/* NAVBAR */}
      <Navbar onOpenNotifications={() => setIsNotificationsOpen(true)} />

      {/* CLOUD & SUPABASE SYNC ERROR BANNER */}
      <SyncErrorBanner />

      {/* MAIN CONTAINER */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        <ErrorBoundary key={activeTab} isolateView fallbackTitle="Erreur dans le module actif">
          {renderContent()}
        </ErrorBoundary>
      </main>

      {/* FLOATING AI ASSISTANT TRIGGER BUTTON (BOTTOM-RIGHT) */}
      {activeTab !== 'ai_assistant' && (
        <div className="fixed bottom-6 right-6 z-40 no-print">
          <button
            onClick={() => setIsAssistantOpen(!isAssistantOpen)}
            className="group relative flex items-center gap-3 px-4 py-3 rounded-full bg-gradient-to-r from-amber-500 via-amber-600 to-amber-500 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold shadow-xl shadow-amber-500/25 hover:shadow-amber-500/40 hover:scale-105 active:scale-95 transition-all duration-200 border border-amber-300/40"
            title={`Ouvrir l’assistant IA personnel de ${currentUser.name}`}
          >
            <div className="relative">
              <Bot className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 border-2 border-slate-950 rounded-full animate-ping" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 border-2 border-slate-950 rounded-full" />
            </div>
            <div className="text-left leading-tight hidden sm:block">
              <div className="text-xs font-black tracking-wide flex items-center gap-1">
                ASSISTANT IA
                <Sparkles className="w-3 h-3 text-slate-950 fill-slate-950" />
              </div>
              <div className="text-[10px] text-slate-900 font-semibold opacity-90 truncate max-w-[120px]">
                {currentUser.name}
              </div>
            </div>
          </button>
        </div>
      )}

      {/* SLIDE-OVER AI ASSISTANT DRAWER */}
      {isAssistantOpen && activeTab !== 'ai_assistant' && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-xs no-print animate-fade-in">
          {/* Click outside to close */}
          <div
            className="flex-1"
            onClick={() => setIsAssistantOpen(false)}
          />
          {/* Drawer container */}
          <div
            className={`w-full ${
              isAssistantExpanded ? 'sm:w-[780px] md:w-[880px]' : 'sm:w-[520px] md:w-[580px]'
            } h-full bg-slate-900 shadow-2xl border-l border-slate-800 flex flex-col transform transition-all duration-300 ease-in-out`}
          >
            <MemberAiAssistant
              isDrawer={true}
              onClose={() => setIsAssistantOpen(false)}
              isExpanded={isAssistantExpanded}
              onToggleExpand={() => setIsAssistantExpanded(!isAssistantExpanded)}
            />
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-4 px-6 text-center text-xs text-slate-500 font-mono">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            <strong className="text-slate-400">MORVELLO CARS</strong> • Système de Gestion & Édition de Contrats A4
          </div>
          <div className="text-[11px] text-slate-600">
            IF: 66223306 | RC: 664751 | ICE: 00366965500062 • Nouaceur Casablanca
          </div>
        </div>
      </footer>

      {/* GLOBAL MODALS */}
      <PdfModal />
      <ReturnCheckInModal
        contract={checkInContract}
        onClose={() => setCheckInContract(null)}
        onOpenDetailedInspection={(contract) => setInspectionContract(contract)}
      />
      <InspectionManagerModal
        contract={inspectionContract}
        isOpen={!!inspectionContract}
        onClose={() => setInspectionContract(null)}
      />
      <NotificationsCenterModal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        onOpenCheckInModal={(contract) => setCheckInContract(contract)}
      />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <MainAppContent />
    </AppProvider>
  );
}
