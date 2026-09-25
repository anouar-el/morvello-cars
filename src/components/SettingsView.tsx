import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Settings,
  Building,
  FileSpreadsheet,
  Lock,
  CheckCircle2,
  Save,
  Printer,
  Shield,
  Stamp,
  Sparkles,
  Cloud,
  CloudCheck,
  RefreshCw,
  Database,
  Sun,
  Moon,
  Bot,
  Users,
  Copy,
  Check,
  AlertTriangle,
  FileCode,
  ExternalLink,
} from 'lucide-react';
import { CompanyStamp } from './CompanyStamp';
import { CompanyLogo } from './CompanyLogo';
import { AiCharterSettings } from './AiCharterSettings';
import { getNextAvailableContractNumber } from '../utils/contractNumberUtils';
import { syncAllClientsToSupabase } from '../lib/supabaseSync';

export const SettingsView: React.FC = () => {
  const {
    companySettings,
    updateCompanySettings,
    contracts,
    clients,
    currentUser,
    cloudSyncStatus,
    lastCloudSync,
    syncWithCloud,
    pushToCloud,
    theme,
    setTheme,
  } = useApp();
  const [formData, setFormData] = useState(companySettings);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<'company' | 'ai' | 'cloud_theme'>('company');

  // Supabase Clients Sync & Diagnostics
  const [isSyncingClients, setIsSyncingClients] = useState(false);
  const [clientSyncFeedback, setClientSyncFeedback] = useState<{
    type: 'success' | 'warning' | 'error';
    text: string;
    hasRlsError?: boolean;
  } | null>(null);
  const [showRlsHelper, setShowRlsHelper] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  const SQL_FIX_SCRIPT = `-- ==============================================================================
-- RESTAURATION STRICTE ROW LEVEL SECURITY (RLS) - MORVELLO CARS
-- Idempotent : supprime les RPC bypass et rétablit les policies isolées par manager
-- ==============================================================================
DROP FUNCTION IF EXISTS public.sync_agency_state(jsonb, text);
DROP FUNCTION IF EXISTS public.sync_agency_state(jsonb);
DROP FUNCTION IF EXISTS public.sync_agency_state();
DROP FUNCTION IF EXISTS public.sync_client_record(jsonb);
DROP FUNCTION IF EXISTS public.sync_client_record();

ALTER TABLE public.agency_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Nettoyage des anciennes policies ouvertes
DROP POLICY IF EXISTS "clients_select" ON public.clients;
DROP POLICY IF EXISTS "clients_insert" ON public.clients;
DROP POLICY IF EXISTS "clients_update" ON public.clients;
DROP POLICY IF EXISTS "clients_delete" ON public.clients;

-- Policies strictes pour clients (réservé aux utilisateurs authentifiés & isolées par manager et agence)
CREATE POLICY "clients_select" ON public.clients FOR SELECT TO authenticated USING (public.can_access_record(assigned_manager_id, created_by, agency_id));
CREATE POLICY "clients_insert" ON public.clients FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL AND public.is_same_agency(agency_id) AND public.can_assign_manager(assigned_manager_id, created_by));
CREATE POLICY "clients_update" ON public.clients FOR UPDATE TO authenticated USING (public.can_access_record(assigned_manager_id, created_by, agency_id)) WITH CHECK (auth.uid() IS NOT NULL AND public.is_same_agency(agency_id) AND public.can_assign_manager(assigned_manager_id, created_by));
CREATE POLICY "clients_delete" ON public.clients FOR DELETE TO authenticated USING (public.can_access_record(assigned_manager_id, created_by, agency_id) AND (public.is_admin() OR public.is_current_manager(assigned_manager_id) OR public.is_current_manager(created_by)));`;

  const handleCopySql = () => {
    navigator.clipboard.writeText(SQL_FIX_SCRIPT);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
  };

  const handleSyncClientsOnly = async () => {
    setIsSyncingClients(true);
    setClientSyncFeedback(null);
    try {
      const res = await syncAllClientsToSupabase(clients);
      if (res.success) {
        setClientSyncFeedback({
          type: 'success',
          text: `Succès : Les ${res.syncedCount} clients ont été synchronisés avec succès vers Supabase PostgreSQL !`,
        });
      } else if (res.hasRlsError) {
        setShowRlsHelper(true);
        setClientSyncFeedback({
          type: 'warning',
          text: `Origine du problème : La politique RLS de Supabase (code 42501) bloque l'écriture de ${res.totalCount - res.syncedCount} client(s). Exécutez le script SQL ci-dessous dans Supabase SQL Editor pour débloquer immédiatement.`,
          hasRlsError: true,
        });
      } else {
        setClientSyncFeedback({
          type: 'error',
          text: res.error || 'Erreur lors de la synchronisation des clients.',
        });
      }
    } catch (err: any) {
      setClientSyncFeedback({
        type: 'error',
        text: err?.message || 'Erreur imprévue lors de la synchronisation.',
      });
    } finally {
      setIsSyncingClients(false);
    }
  };

  const effectiveNextContract = React.useMemo(() => {
    return getNextAvailableContractNumber(contracts, formData);
  }, [contracts, formData]);

  const isAgent = currentUser.role === 'agent';

  const handleManualSync = async () => {
    setSyncFeedback('Synchronisation en cours avec Firebase...');
    const ok = await syncWithCloud();
    if (ok) {
      setSyncFeedback('Base de données Firebase Cloud Firestore synchronisée avec succès !');
    } else {
      setSyncFeedback('Erreur lors de la synchronisation Firebase. Vérifiez la connexion.');
    }
    setTimeout(() => setSyncFeedback(null), 4000);
  };

  const handleManualPush = async () => {
    setSyncFeedback('Sauvegarde complète vers Firebase en cours...');
    const ok = await pushToCloud();
    if (ok) {
      setSyncFeedback('Toutes les données locales ont été enregistrées dans Firebase Firestore !');
    } else {
      setSyncFeedback('Erreur lors de l’enregistrement vers Firebase.');
    }
    setTimeout(() => setSyncFeedback(null), 4000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isAgent) return;

    updateCompanySettings(formData);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-400 uppercase tracking-widest font-mono">
            <Settings className="w-4 h-4" />
            Module Paramètres • Section 41
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight mt-1">
            Paramètres Société & Numérotation des Contrats
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Mentions légales obligatoires figurant sur le document imprimé et format des contrats.
          </p>
        </div>

        {isAgent && (
          <span className="bg-amber-500/15 text-amber-400 border border-amber-500/30 text-xs font-semibold px-3 py-1.5 rounded-xl flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" />
            Lecture seule (Rôle Agent)
          </span>
        )}
      </div>

      {savedSuccess && (
        <div className="bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 p-3.5 rounded-xl text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>Paramètres de la société et configuration des contrats mis à jour avec succès !</span>
        </div>
      )}

      {syncFeedback && (
        <div className="bg-blue-500/15 border border-blue-500/40 text-blue-300 p-3.5 rounded-xl text-xs flex items-center gap-2 animate-in fade-in">
          <CloudCheck className="w-4 h-4 flex-shrink-0 text-blue-400" />
          <span>{syncFeedback}</span>
        </div>
      )}

      {/* SECTIONS NAVIGATION */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-900 border border-slate-800 rounded-2xl overflow-x-auto text-xs">
        <button
          type="button"
          onClick={() => setActiveSection('company')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all cursor-pointer shrink-0 ${
            activeSection === 'company'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>1. Société & Contrats</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('ai')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all cursor-pointer shrink-0 relative ${
            activeSection === 'ai'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Bot className="w-4 h-4" />
          <span>2. Assistant IA • Style & Vision</span>
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
              activeSection === 'ai' ? 'bg-slate-950 text-amber-400' : 'bg-amber-500/20 text-amber-300'
            }`}
          >
            ADN Marque
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('cloud_theme')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all cursor-pointer shrink-0 ${
            activeSection === 'cloud_theme'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Cloud className="w-4 h-4" />
          <span>3. Cloud & Affichage</span>
        </button>
      </div>

      {/* SECTION 2: AI CHARTER & VISION EDITOR */}
      {activeSection === 'ai' && <AiCharterSettings />}

      {/* SECTION 3: CLOUD & THEME */}
      {activeSection === 'cloud_theme' && (
        <div className="space-y-6">
          {/* BASE DE DONNÉES CLOUD SUPABASE */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm font-bold text-white">Base de données Cloud Supabase (PostgreSQL)</h2>
                  <span className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-semibold">
                    Projet : uxswtmfrrxagkmewpwyd
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Synchronisation PostgreSQL en temps réel des véhicules, contrats, cautions, clients et collaborateurs.
                </p>
                <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2">
                  <span>
                    Statut :{' '}
                    <strong className={cloudSyncStatus === 'synced' ? 'text-emerald-400' : 'text-amber-400'}>
                      {cloudSyncStatus === 'synced' ? 'Connecté & Synchronisé' : cloudSyncStatus === 'syncing' ? 'Synchronisation...' : 'En attente'}
                    </strong>
                  </span>
                  {lastCloudSync && (
                    <span className="text-slate-500">• Dernière synchro : {lastCloudSync}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleManualSync}
                disabled={cloudSyncStatus === 'syncing'}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 text-xs px-3.5 py-2 rounded-xl transition-all cursor-pointer font-medium disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${cloudSyncStatus === 'syncing' ? 'animate-spin' : ''}`} />
                Actualiser
              </button>
              <button
                type="button"
                onClick={handleManualPush}
                disabled={cloudSyncStatus === 'syncing'}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs px-3.5 py-2 rounded-xl transition-all cursor-pointer font-medium disabled:opacity-50"
              >
                <CloudCheck className="w-3.5 h-3.5" />
                Sauvegarder Supabase
              </button>
            </div>
          </div>

          {/* DIAGNOSTIC & SYNCHRONISATION DES CLIENTS VERS SUPABASE */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-md space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    Synchronisation des Clients Supabase
                    <span className="text-[10px] bg-blue-500/15 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full font-semibold">
                      {clients.length} client{clients.length > 1 ? 's' : ''} en local
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Assure la présence intégrale de vos {clients.length} fiches clients dans la table PostgreSQL Supabase.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setShowRlsHelper(!showRlsHelper)}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-750 text-xs px-3 py-2 rounded-xl transition-all cursor-pointer font-medium"
                >
                  <FileCode className="w-3.5 h-3.5 text-amber-400" />
                  Script SQL RLS
                </button>
                <button
                  type="button"
                  onClick={handleSyncClientsOnly}
                  disabled={isSyncingClients}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs px-3.5 py-2 rounded-xl transition-all cursor-pointer font-medium disabled:opacity-50 shadow-sm"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingClients ? 'animate-spin' : ''}`} />
                  {isSyncingClients ? 'Synchronisation...' : `Synchroniser les ${clients.length} clients`}
                </button>
              </div>
            </div>

            {/* FEEDBACK BANNER */}
            {clientSyncFeedback && (
              <div
                className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                  clientSyncFeedback.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : clientSyncFeedback.type === 'warning'
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                }`}
              >
                {clientSyncFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className="font-medium">{clientSyncFeedback.text}</p>
                </div>
              </div>
            )}

            {/* RLS HELPER & SQL SCRIPT COPIER */}
            {showRlsHelper && (
              <div className="bg-slate-950/80 border border-amber-500/40 rounded-xl p-5 space-y-4 shadow-lg">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                    <h4 className="text-sm font-bold text-amber-300">
                      Pourquoi seulement 1 client sur Supabase alors que vous en avez 3 ?
                    </h4>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    <strong>Rassurez-vous :</strong> Vos 3 clients ne sont <strong>pas perdus</strong>. Ils sont bien sauvegardés dans votre application Morvello Cars et dans Firebase.
                  </p>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Supabase possède un verrou de sécurité automatique (appelé <em>Row-Level Security</em>). Ce verrou empêche l'application d'écrire de nouveaux clients sans mot de passe administrateur Supabase. Pour lever ce verrou une bonne fois pour toutes, il suffit d'exécuter une autorisation en 3 étapes simples :
                  </p>
                </div>

                {/* ÉTAPES 1 - 2 - 3 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                      <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center text-[11px]">1</span>
                      Copier le code
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Copiez le script d'autorisation prêt à l'emploi dans votre presse-papier.
                    </p>
                    <button
                      type="button"
                      onClick={handleCopySql}
                      className="w-full flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs py-2 px-3 rounded-lg transition-all cursor-pointer shadow-sm mt-1"
                    >
                      {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedSql ? 'Copié dans le presse-papier !' : 'Copier le script SQL'}
                    </button>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-blue-400">
                      <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center text-[11px]">2</span>
                      Ouvrir Supabase
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Cliquez pour ouvrir directement la page de commande SQL de votre projet Supabase.
                    </p>
                    <a
                      href="https://supabase.com/dashboard/project/uxswtmfrrxagkmewpwyd/sql/new"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs py-2 px-3 rounded-lg transition-all cursor-pointer shadow-sm mt-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Ouvrir Supabase SQL Editor
                    </a>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                      <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center text-[11px]">3</span>
                      Coller & Cliquer sur Run
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Dans la page Supabase, faites un clic droit &gt; <strong>Coller</strong> (Ctrl+V), puis cliquez sur le bouton vert <strong>Run</strong> en bas à droite.
                    </p>
                    <div className="text-[10px] text-emerald-400/90 font-medium bg-emerald-500/10 border border-emerald-500/20 p-1.5 rounded-md text-center mt-1">
                      Dès que c'est fait, cliquez sur "Synchroniser les {clients.length} clients" ci-dessus !
                    </div>
                  </div>
                </div>

                <div className="relative pt-2">
                  <div className="text-[11px] text-slate-400 font-semibold mb-1 flex items-center justify-between">
                    <span>Aperçu du script de sécurité stricte (restore_strict_supabase_rls.sql) :</span>
                    <span className="text-[10px] text-amber-500 font-mono">RLS strict • Isolation Manager</span>
                  </div>
                  <pre className="text-[10px] text-slate-300 bg-slate-900 border border-slate-800 rounded-lg p-3 overflow-x-auto max-h-36 font-mono leading-relaxed select-all">
                    {SQL_FIX_SCRIPT}
                  </pre>
                </div>
              </div>
            )}
          </div>

          {/* APPARENCE & THÈME (DARK MODE / LIGHT MODE) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-md space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  {theme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white uppercase tracking-wide">
                    Thème de l'interface & Mode d'affichage
                  </h2>
                  <p className="text-xs text-slate-400">
                    Basculez entre l'élégant mode sombre prestige et le mode clair haute lisibilité.
                  </p>
                </div>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full font-semibold border bg-slate-800 border-slate-700 text-slate-300">
                Actif : {theme === 'dark' ? '🌙 Mode Sombre' : '☀️ Mode Clair'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* OPTION DARK MODE */}
              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3.5 ${
                  theme === 'dark'
                    ? 'bg-slate-950 border-amber-500 shadow-md ring-2 ring-amber-500/20'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 opacity-75 hover:opacity-100'
                }`}
              >
                <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-amber-400 shrink-0">
                  <Moon className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">Mode Sombre (Prestige)</span>
                    {theme === 'dark' && (
                      <span className="text-[10px] bg-amber-500 text-slate-950 px-1.5 py-0.5 rounded font-bold">
                        Sélectionné
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">
                    Design sombre luxueux aux accents dorés, réduit la fatigue visuelle lors d'utilisations prolongées.
                  </p>
                </div>
              </button>

              {/* OPTION LIGHT MODE */}
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3.5 ${
                  theme === 'light'
                    ? 'bg-amber-500/10 border-amber-500 shadow-md ring-2 ring-amber-500/20'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 opacity-75 hover:opacity-100'
                }`}
              >
                <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-600 shrink-0">
                  <Sun className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">Mode Clair (Corporate)</span>
                    {theme === 'light' && (
                      <span className="text-[10px] bg-amber-500 text-slate-950 px-1.5 py-0.5 rounded font-bold">
                        Sélectionné
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">
                    Fond blanc épuré et contrasté, clarté optimale pour le comptoir et la saisie en pleine lumière du jour.
                  </p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 1: SOCIÉTÉ & CONTRATS */}
      {activeSection === 'company' && (

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* IDENTIFIANTS FISCAUX & COORDONNÉES */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <Building className="w-5 h-5 text-amber-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wide">
              Informations Légales de MORVELLO CARS
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Raison Sociale *</label>
              <input
                type="text"
                disabled={isAgent}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white disabled:opacity-60 focus:border-amber-500 focus:outline-none font-semibold"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">Identifiant Commun de l'Entreprise (ICE) *</label>
              <input
                type="text"
                disabled={isAgent}
                value={formData.ice}
                onChange={(e) => setFormData({ ...formData, ice: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono font-bold disabled:opacity-60 focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">Identifiant Fiscal (IF) *</label>
              <input
                type="text"
                disabled={isAgent}
                value={formData.taxId}
                onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono font-bold disabled:opacity-60 focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">Registre du Commerce (RC) *</label>
              <input
                type="text"
                disabled={isAgent}
                value={formData.rc}
                onChange={(e) => setFormData({ ...formData, rc: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono font-bold disabled:opacity-60 focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-slate-400 mb-1 font-medium">Adresse du Siège Social & Agence *</label>
              <input
                type="text"
                disabled={isAgent}
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white disabled:opacity-60 focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">Téléphone 1 (GSM Principal) *</label>
              <input
                type="text"
                disabled={isAgent}
                value={formData.phone1}
                onChange={(e) => setFormData({ ...formData, phone1: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono disabled:opacity-60 focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">Téléphone 2 (GSM Secondaire)</label>
              <input
                type="text"
                disabled={isAgent}
                value={formData.phone2}
                onChange={(e) => setFormData({ ...formData, phone2: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono disabled:opacity-60 focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">Assistance &amp; Dépannage 24/7 (Tél) *</label>
              <input
                type="text"
                disabled={isAgent}
                value={formData.assistancePhone || ''}
                onChange={(e) => setFormData({ ...formData, assistancePhone: e.target.value })}
                placeholder="0522582962 / 0522589535"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono disabled:opacity-60 focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">Site Web Officiel</label>
              <input
                type="text"
                disabled={isAgent}
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white disabled:opacity-60 focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">Email de Contact</label>
              <input
                type="email"
                disabled={isAgent}
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white disabled:opacity-60 focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* IDENTITÉ VISUELLE & CACHET OFFICIEL */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 1. NOUVEAU LOGO OFFICIEL DE PRESTIGE */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <div>
                  <h2 className="text-sm font-bold text-white uppercase tracking-wide">
                    Nouveau Logo Officiel de Prestige
                  </h2>
                  <p className="text-[11px] text-amber-400/80">
                    Blason Or & Noir • Sté MORVELLO CARS
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full font-semibold">
                ✓ Entête Contrat & PDF
              </span>
            </div>

            <div className="flex flex-col items-center justify-center p-4 bg-slate-950 rounded-xl border border-amber-500/20 shadow-inner space-y-4">
              {/* Partie Logo seule (Écusson / Blason) avec fond transparent */}
              <div className="w-full flex flex-col items-center">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 font-bold">
                    Partie Logo (Écusson / Blason) — Fond Transparent :
                  </span>
                  <span className="text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-1.5 py-0.2 rounded font-mono">
                    100% Transparent
                  </span>
                </div>
                <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800 flex items-center justify-center">
                  <CompanyLogo size="lg" variant="emblem" />
                </div>
              </div>

              {/* Format Entête Rectangulaire Contractuelle Transparent */}
              <div className="w-full flex flex-col items-center border-t border-slate-800 pt-3">
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-300 mb-1.5 font-bold">
                  Format Rectangulaire Officiel (Contrats & A4) — Typographie 100% Lisible :
                </span>
                <div className="p-2.5 bg-white rounded-md flex items-center justify-center shadow-xs">
                  <CompanyLogo size="md" variant="rectangular" transparent theme="light" />
                </div>
              </div>

              {/* Logo Complet */}
              <div className="w-full flex flex-col items-center border-t border-slate-800 pt-3">
                <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 mb-1.5 font-bold">
                  Logo Complet Transparent — Haute Définition :
                </span>
                <div className="p-3 bg-white/95 rounded-lg border border-amber-500/30 flex items-center justify-center shadow-xs">
                  <CompanyLogo size="lg" variant="full" />
                </div>
              </div>
            </div>

            <div className="text-center font-mono text-[11px] text-amber-300/90 bg-amber-950/30 border border-amber-800/40 p-2.5 rounded-lg space-y-0.5">
              <div className="font-bold text-amber-300 text-xs tracking-wider uppercase font-serif">
                Sté MORVELLO CARS
              </div>
              <div className="text-[10px] text-slate-300 tracking-widest uppercase">
                Where luxury meets the road
              </div>
              <div className="text-[10px] text-amber-500/80">
                Écusson vintage de collection • Calandre or chromée
              </div>
            </div>
          </div>

          {/* 2. NOUVEAU CACHET OFFICIEL */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Stamp className="w-5 h-5 text-blue-400" />
                <div>
                  <h2 className="text-sm font-bold text-white uppercase tracking-wide">
                    Nouveau Cachet Officiel de l'Agence
                  </h2>
                  <p className="text-[11px] text-blue-400/80">
                    Modèle Rectangulaire Agréé Sté MORVELLO CARS
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full font-semibold">
                ✓ Cadre Signature (Contrat PDF)
              </span>
            </div>

            <div className="flex flex-col items-center justify-center p-4 bg-white rounded-xl border border-slate-200 shadow-inner min-h-[160px] overflow-hidden">
              <CompanyStamp size="md" rotation={-1.5} format="rectangular" />
            </div>

            <div className="text-center font-mono text-[11px] text-blue-300 bg-blue-950/40 border border-blue-800/50 p-2.5 rounded-lg space-y-0.5">
              <div className="font-bold text-white text-xs tracking-wide">Sté MORVELLO CARS</div>
              <div className="text-slate-300">IF : 66223306 • RC : 664751</div>
              <div className="text-amber-400 font-semibold">ICE : 00366965500062</div>
            </div>
          </div>
        </div>

        {/* PARAMÈTRES DE NUMÉROTATION DES CONTRATS */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-md space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <FileSpreadsheet className="w-5 h-5 text-amber-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wide">
              Numérotation Automatique des Contrats
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Préfixe de Contrat</label>
              <input
                type="text"
                disabled={isAgent}
                value={formData.contractPrefix}
                onChange={(e) => setFormData({ ...formData, contractPrefix: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono font-bold uppercase disabled:opacity-60 focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">Année de référence</label>
              <input
                type="number"
                disabled={isAgent}
                value={formData.contractYear}
                onChange={(e) => setFormData({ ...formData, contractYear: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono disabled:opacity-60 focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">Compteur Prochain Numéro</label>
              <input
                type="number"
                disabled={isAgent}
                value={formData.nextContractNumber}
                onChange={(e) => setFormData({ ...formData, nextContractNumber: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono font-bold disabled:opacity-60 focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-slate-300 font-medium block">Prochain numéro garanti unique :</span>
              <span className="text-[11px] text-slate-500">
                L'algorithme vérifie tous les contrats existants pour interdire les doublons en cas de conflit.
              </span>
            </div>
            <span className="font-mono font-bold text-amber-400 text-sm bg-slate-900 px-3 py-1 rounded border border-slate-700 shrink-0">
              {effectiveNextContract.formattedContractNumber}
            </span>
          </div>
        </div>

        {!isAgent && (
          <div className="flex justify-end">
            <button
              type="submit"
              className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold px-6 py-2.5 rounded-xl shadow-lg shadow-amber-500/25 transition-transform active:scale-95 text-xs sm:text-sm cursor-pointer"
            >
              <Save className="w-4 h-4" />
              Enregistrer les Paramètres
            </button>
          </div>
        )}
      </form>
      )}
    </div>
  );
};
