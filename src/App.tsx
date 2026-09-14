/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, lazy, Suspense } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/Navbar';
import { Dashboard } from './components/Dashboard';
import { LoginView } from './components/LoginView';
import { Contract } from './types';
import { Bot, Sparkles, Loader2 } from 'lucide-react';

// Code splitting / Lazy imports to minimize initial bundle size
const ContractWizard = lazy(() =>
  import('./components/ContractWizard').then((m) => ({ default: m.ContractWizard }))
);
const ContractsList = lazy(() =>
  import('./components/ContractsList').then((m) => ({ default: m.ContractsList }))
);
const ClientsList = lazy(() =>
  import('./components/ClientsList').then((m) => ({ default: m.ClientsList }))
);
const VehiclesList = lazy(() =>
  import('./components/VehiclesList').then((m) => ({ default: m.VehiclesList }))
);
const TermsManager = lazy(() =>
  import('./components/TermsManager').then((m) => ({ default: m.TermsManager }))
);
const SettingsView = lazy(() =>
  import('./components/SettingsView').then((m) => ({ default: m.SettingsView }))
);
const AuditView = lazy(() =>
  import('./components/AuditView').then((m) => ({ default: m.AuditView }))
);
const DepositsManagement = lazy(() =>
  import('./components/DepositsManagement').then((m) => ({ default: m.DepositsManagement }))
);
const PermissionsManager = lazy(() =>
  import('./components/PermissionsManager').then((m) => ({ default: m.PermissionsManager }))
);
const PdfModal = lazy(() =>
  import('./components/PdfModal').then((m) => ({ default: m.PdfModal }))
);
const ReturnCheckInModal = lazy(() =>
  import('./components/ReturnCheckInModal').then((m) => ({ default: m.ReturnCheckInModal }))
);
const MemberAiAssistant = lazy(() =>
  import('./components/MemberAiAssistant').then((m) => ({ default: m.MemberAiAssistant }))
);
const ContractTemplatesManager = lazy(() =>
  import('./components/ContractTemplatesManager').then((m) => ({
    default: m.ContractTemplatesManager,
  }))
);

const ViewLoadingFallback = () => (
  <div className="flex flex-col items-center justify-center min-h-[400px] w-full gap-3 text-slate-400">
    <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
    <span className="text-xs font-mono tracking-wider text-slate-400">Chargement du module...</span>
  </div>
);

function MainAppContent() {
  const { activeTab, currentUser } = useApp();
  const [checkInContract, setCheckInContract] = useState<Contract | null>(null);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [isAssistantExpanded, setIsAssistantExpanded] = useState(false);

  if (!currentUser) {
    return <LoginView />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard onOpenCheckInModal={(contract) => setCheckInContract(contract)} />;
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
        return <PermissionsManager />;
      case 'contract_templates':
        return <ContractTemplatesManager />;
      case 'settings':
        return <SettingsView />;
      case 'audit':
        return <AuditView />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased selection:bg-amber-500 selection:text-slate-950 relative">
      {/* NAVBAR */}
      <Navbar />

      {/* MAIN CONTAINER */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        <Suspense fallback={<ViewLoadingFallback />}>
          {renderContent()}
        </Suspense>
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
            <Suspense fallback={<ViewLoadingFallback />}>
              <MemberAiAssistant
                isDrawer={true}
                onClose={() => setIsAssistantOpen(false)}
                isExpanded={isAssistantExpanded}
                onToggleExpand={() => setIsAssistantExpanded(!isAssistantExpanded)}
              />
            </Suspense>
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
      <Suspense fallback={null}>
        <PdfModal />
        <ReturnCheckInModal
          contract={checkInContract}
          onClose={() => setCheckInContract(null)}
        />
      </Suspense>
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
