import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { CONTRACT_TEMPLATES, getContractTemplate } from '../data/contractTemplates';
import { ContractTemplateId, User } from '../types';
import { ContractPdfDocument } from './ContractPdfDocument';
import {
  FileText,
  Crown,
  Briefcase,
  CheckCircle2,
  Eye,
  Star,
  Users,
  Building2,
  Sparkles,
  Shield,
  Layers,
  ArrowRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Printer,
  SlidersHorizontal,
  Check,
  AlertCircle,
  FileCheck,
} from 'lucide-react';

export const ContractTemplatesManager: React.FC = () => {
  const {
    currentUser,
    users,
    updateUser,
    companySettings,
    updateCompanySettings,
    contracts,
    termsVersion,
    addAuditLog,
    openPdfModal,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'templates' | 'assignments' | 'live_preview'>('templates');
  const [selectedPreviewTemplate, setSelectedPreviewTemplate] = useState<ContractTemplateId>('standard');
  const [previewContractId, setPreviewContractId] = useState<string>(
    contracts.length > 0 ? contracts[0].id : ''
  );
  const [previewZoom, setPreviewZoom] = useState<number>(75);
  const [previewSide, setPreviewSide] = useState<'page1' | 'page2' | 'both'>('page1');
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Selected contract for previewing, or fallback to first contract
  const activePreviewContract =
    contracts.find((c) => c.id === previewContractId) || contracts[0] || null;

  const defaultTemplateId = companySettings.defaultContractTemplate || 'standard';

  const showNotification = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => {
      setSuccessToast(null);
    }, 4000);
  };

  // Handler for assigning template to a user
  const handleAssignTemplateToUser = async (userId: string, templateId: ContractTemplateId) => {
    const targetUser = users.find((u) => u.id === userId);
    if (!targetUser) return;

    await updateUser(userId, { assignedContractTemplate: templateId });
    const tInfo = getContractTemplate(templateId);

    addAuditLog(
      'Affectation modèle de contrat',
      'contract_template',
      userId,
      `Attribution du ${tInfo.name} au collaborateur ${targetUser.name}`
    );

    showNotification(`Modèle « ${tInfo.name} » attribué à ${targetUser.name}`);
  };

  // Handler for setting global default template
  const handleSetGlobalDefault = (templateId: ContractTemplateId) => {
    updateCompanySettings({ defaultContractTemplate: templateId });
    const tInfo = getContractTemplate(templateId);

    addAuditLog(
      'Modification modèle par défaut',
      'settings',
      'global',
      `Le modèle « ${tInfo.name} » a été défini comme modèle global par défaut de l'agence`
    );

    showNotification(`Le modèle « ${tInfo.name} » est désormais le modèle par défaut de l'entreprise`);
  };

  // Count users per template
  const getAssignedUsersCount = (templateId: ContractTemplateId) => {
    return users.filter((u) => (u.assignedContractTemplate || defaultTemplateId) === templateId).length;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* SUCCESS TOAST */}
      {successToast && (
        <div className="fixed top-20 right-6 z-50 flex items-center gap-3 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-2xl border border-emerald-400/50 animate-in slide-in-from-top-4 duration-200 font-medium text-sm">
          <CheckCircle2 className="w-5 h-5 text-white shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {/* HEADER EXÉCUTIF */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/30 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-amber-500/20">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white uppercase font-serif">
                    Gestion des Modèles de Contrat
                  </h1>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    SUPER ADMIN
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-400">
                  Gérez vos 3 maquettes contractuelles A4 et affectez le modèle approprié à chaque collaborateur
                </p>
              </div>
            </div>
          </div>

          {/* QUICK STATS PILLS */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-2 text-center">
              <div className="text-[10px] uppercase font-mono text-slate-400">Modèles Actifs</div>
              <div className="text-lg font-black text-amber-400">3 Maquettes</div>
            </div>
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-2 text-center">
              <div className="text-[10px] uppercase font-mono text-slate-400">Par Défaut Global</div>
              <div className="text-sm font-bold text-emerald-400 flex items-center gap-1 justify-center">
                <Star className="w-3.5 h-3.5 fill-emerald-400" />
                {getContractTemplate(defaultTemplateId).name.split(' ')[1] || 'Standard'}
              </div>
            </div>
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl px-4 py-2 text-center">
              <div className="text-[10px] uppercase font-mono text-slate-400">Membres Équipe</div>
              <div className="text-lg font-black text-white">{users.length} collaborateurs</div>
            </div>
          </div>
        </div>

        {/* SUB-NAVIGATION TABS */}
        <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center gap-2">
          <button
            onClick={() => setActiveTab('templates')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              activeTab === 'templates'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-bold'
                : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Les 3 Modèles de Contrat</span>
          </button>
          <button
            onClick={() => setActiveTab('assignments')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              activeTab === 'assignments'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-bold'
                : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Affectation aux Membres ({users.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('live_preview')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
              activeTab === 'live_preview'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-bold'
                : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Eye className="w-4 h-4" />
            <span>Studio de Prévisualisation A4</span>
          </button>
        </div>
      </div>

      {/* VIEW 1: LES 3 MODÈLES */}
      {activeTab === 'templates' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {CONTRACT_TEMPLATES.map((tmpl, idx) => {
              const isGlobalDefault = defaultTemplateId === tmpl.id;
              const assignedCount = getAssignedUsersCount(tmpl.id);

              return (
                <div
                  key={tmpl.id}
                  className={`bg-slate-900 rounded-2xl border transition-all duration-200 flex flex-col justify-between overflow-hidden shadow-xl hover:shadow-2xl relative ${
                    isGlobalDefault
                      ? 'border-amber-500/60 ring-1 ring-amber-500/40 bg-gradient-to-b from-slate-900 via-slate-900 to-amber-950/20'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* TOP BANNER */}
                  <div className="p-6 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-slate-400">
                            MODÈLE #{idx + 1}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${tmpl.badgeColor}`}>
                            {tmpl.badge}
                          </span>
                        </div>
                        <h2 className="text-lg font-bold text-white mt-1">
                          {tmpl.name}
                        </h2>
                        <p className="text-xs text-slate-400 font-medium">
                          {tmpl.subtitle}
                        </p>
                      </div>

                      {/* Icon */}
                      <div
                        className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${
                          tmpl.id === 'prestige'
                            ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                            : tmpl.id === 'corporate'
                            ? 'bg-blue-500/15 border-blue-500/40 text-blue-400'
                            : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                        }`}
                      >
                        {tmpl.id === 'prestige' ? (
                          <Crown className="w-5 h-5" />
                        ) : tmpl.id === 'corporate' ? (
                          <Briefcase className="w-5 h-5" />
                        ) : (
                          <FileText className="w-5 h-5" />
                        )}
                      </div>
                    </div>

                    {/* DESCRIPTION */}
                    <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                      {tmpl.description}
                    </p>

                    {/* HIGHLIGHTS */}
                    <div className="space-y-2">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Points Clés de la Maquette :
                      </div>
                      <ul className="space-y-1.5 text-xs text-slate-300">
                        {tmpl.features.map((feat, fIdx) => (
                          <li key={fIdx} className="flex items-start gap-2">
                            <CheckCircle2
                              className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
                                tmpl.id === 'prestige'
                                  ? 'text-amber-400'
                                  : tmpl.id === 'corporate'
                                  ? 'text-blue-400'
                                  : 'text-emerald-400'
                              }`}
                            />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* RECOMMENDED FOR */}
                    <div className="pt-2 border-t border-slate-800">
                      <div className="text-[10px] uppercase font-mono text-slate-400 mb-1">
                        Cible d’Usage :
                      </div>
                      <p className="text-[11px] text-slate-300 italic">
                        {tmpl.recommendedFor}
                      </p>
                    </div>
                  </div>

                  {/* BOTTOM ACTION BAR */}
                  <div className="p-4 bg-slate-950/80 border-t border-slate-800 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Collaborateurs assignés :</span>
                      <span className="font-bold text-white bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                        {assignedCount} membre{assignedCount > 1 ? 's' : ''}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPreviewTemplate(tmpl.id);
                          setActiveTab('live_preview');
                        }}
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-white font-semibold text-xs border border-slate-700 transition-all cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-amber-400" />
                        <span>Aperçu A4</span>
                      </button>

                      {isGlobalDefault ? (
                        <div className="w-full flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold">
                          <Star className="w-3.5 h-3.5 fill-amber-400" />
                          <span>Par Défaut</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSetGlobalDefault(tmpl.id)}
                          className="w-full flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-300 font-semibold text-xs border border-slate-700 transition-all cursor-pointer"
                          title="Définir comme modèle par défaut de l'agence"
                        >
                          <Star className="w-3.5 h-3.5" />
                          <span>Mettre par défaut</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 2: AFFECTATION AUX MEMBRES */}
      {activeTab === 'assignments' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="p-6 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-400" />
                <span>Affectation Individuelle des Modèles de Contrat</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Choisissez précisément le modèle contractuel que chaque membre utilisera lors de la création et de l'impression de ses contrats.
              </p>
            </div>

            {/* QUICK ACTIONS */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 hidden sm:inline">Actions rapides :</span>
              <button
                type="button"
                onClick={() => {
                  users.forEach((u) => updateUser(u.id, { assignedContractTemplate: 'standard' }));
                  showNotification('Modèle Standard attribué à l’ensemble des collaborateurs');
                }}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition-colors cursor-pointer"
              >
                Tous en Standard
              </button>
              <button
                type="button"
                onClick={() => {
                  users.forEach((u) => {
                    if (u.role === 'admin') updateUser(u.id, { assignedContractTemplate: 'prestige' });
                    else if (u.assignedFleetName?.includes('Flotte B') || u.assignedFleetName?.includes('Prestige')) {
                      updateUser(u.id, { assignedContractTemplate: 'prestige' });
                    } else if (u.assignedFleetName?.includes('Flotte D') || u.assignedFleetName?.includes('Littoral')) {
                      updateUser(u.id, { assignedContractTemplate: 'corporate' });
                    } else {
                      updateUser(u.id, { assignedContractTemplate: 'standard' });
                    }
                  });
                  showNotification('Modèles affectés intelligemment selon la spécialité des flottes');
                }}
                className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold transition-colors cursor-pointer"
              >
                Distribution par Flotte
              </button>
            </div>
          </div>

          {/* TABLE OF USERS */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/70 text-slate-400 uppercase font-mono text-[11px]">
                  <th className="py-3 px-4">Collaborateur</th>
                  <th className="py-3 px-4">Rôle &amp; Accès</th>
                  <th className="py-3 px-4">Agence / Flotte Assignée</th>
                  <th className="py-3 px-4">Modèle Actuellement Attribué</th>
                  <th className="py-3 px-4 text-center">Sélectionner le Modèle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {users.map((user) => {
                  const assignedTmplId = user.assignedContractTemplate || defaultTemplateId;
                  const currentTmpl = getContractTemplate(assignedTmplId);

                  return (
                    <tr
                      key={user.id}
                      className="hover:bg-slate-800/40 transition-colors"
                    >
                      {/* USER IDENTITY */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${
                              user.role === 'admin'
                                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                                : user.role === 'manager'
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-700 text-slate-200'
                            }`}
                          >
                            {user.role === 'admin' ? '👑' : user.name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-bold text-white text-sm flex items-center gap-1.5">
                              {user.name}
                              {user.id === currentUser.id && (
                                <span className="text-[10px] bg-slate-800 text-amber-400 px-1.5 py-0.2 rounded border border-slate-700 font-mono">
                                  Vous
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              {user.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* ROLE */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                            user.role === 'admin'
                              ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                              : user.role === 'manager'
                              ? 'bg-blue-500/15 text-blue-300 border-blue-500/40'
                              : 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}
                        >
                          {user.role === 'admin' ? '👑 Super Admin' : user.role === 'manager' ? '🏢 Responsable' : 'Agent'}
                        </span>
                      </td>

                      {/* AGENCY & FLEET */}
                      <td className="py-3.5 px-4">
                        <div className="text-white font-medium">
                          {user.agency || 'Siège Casablanca'}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {user.assignedFleetName || 'Accès Flotte Globale'}
                        </div>
                      </td>

                      {/* CURRENT ASSIGNED TEMPLATE */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${
                              assignedTmplId === 'prestige'
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                : assignedTmplId === 'corporate'
                                ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            }`}
                          >
                            {assignedTmplId === 'prestige' ? (
                              <Crown className="w-3.5 h-3.5" />
                            ) : assignedTmplId === 'corporate' ? (
                              <Briefcase className="w-3.5 h-3.5" />
                            ) : (
                              <FileText className="w-3.5 h-3.5" />
                            )}
                            <span>{currentTmpl.name}</span>
                          </span>
                        </div>
                      </td>

                      {/* TEMPLATE PICKER BUTTONS */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-center gap-1.5">
                          {CONTRACT_TEMPLATES.map((tmpl) => {
                            const isSelected = assignedTmplId === tmpl.id;
                            return (
                              <button
                                key={tmpl.id}
                                type="button"
                                onClick={() => handleAssignTemplateToUser(user.id, tmpl.id)}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer border ${
                                  isSelected
                                    ? tmpl.id === 'prestige'
                                      ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold shadow-sm'
                                      : tmpl.id === 'corporate'
                                      ? 'bg-blue-600 text-white border-blue-400 font-bold shadow-sm'
                                      : 'bg-emerald-600 text-white border-emerald-400 font-bold shadow-sm'
                                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-white'
                                }`}
                                title={`Affecter ${tmpl.name} à ${user.name}`}
                              >
                                {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                                <span>{tmpl.id === 'standard' ? 'Standard' : tmpl.id === 'prestige' ? 'Prestige VIP' : 'Corporate'}</span>
                              </button>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 3: LIVE A4 PREVIEW STUDIO */}
      {activeTab === 'live_preview' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden space-y-4 p-6">
          {/* TOOLBAR FOR PREVIEW */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Eye className="w-5 h-5 text-amber-400" />
                <span>Studio de Visualisation Haute Définition A4</span>
              </h2>
              <p className="text-xs text-slate-400">
                Prévisualisez le rendu exact d'impression et testez les 3 modèles avec un contrat échantillon.
              </p>
            </div>

            {/* CONTROLS */}
            <div className="flex flex-wrap items-center gap-3">
              {/* SELECT TEMPLATE */}
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                {CONTRACT_TEMPLATES.map((tmpl) => {
                  const isActive = selectedPreviewTemplate === tmpl.id;
                  return (
                    <button
                      key={tmpl.id}
                      onClick={() => setSelectedPreviewTemplate(tmpl.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        isActive
                          ? tmpl.id === 'prestige'
                            ? 'bg-amber-500 text-slate-950 shadow-md'
                            : tmpl.id === 'corporate'
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'bg-emerald-600 text-white shadow-md'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      {tmpl.id === 'prestige' ? (
                        <Crown className="w-3.5 h-3.5" />
                      ) : tmpl.id === 'corporate' ? (
                        <Briefcase className="w-3.5 h-3.5" />
                      ) : (
                        <FileText className="w-3.5 h-3.5" />
                      )}
                      <span>{tmpl.id === 'standard' ? 'Standard Morvello' : tmpl.id === 'prestige' ? 'Prestige VIP' : 'Corporate B2B'}</span>
                    </button>
                  );
                })}
              </div>

              {/* SELECT CONTRACT */}
              {contracts.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Contrat :</span>
                  <select
                    value={previewContractId}
                    onChange={(e) => setPreviewContractId(e.target.value)}
                    className="bg-slate-950 border border-slate-800 text-xs text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-500 font-mono"
                  >
                    {contracts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.contractNumber} ({c.clientSnapshot.lastName})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* ZOOM CONTROLS */}
              <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-1 text-slate-300 text-xs">
                <button
                  onClick={() => setPreviewZoom((prev) => Math.max(45, prev - 10))}
                  className="p-1 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                  title="Dézoomer"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="px-2 font-mono text-slate-200 font-semibold">{previewZoom}%</span>
                <button
                  onClick={() => setPreviewZoom((prev) => Math.min(120, prev + 10))}
                  className="p-1 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                  title="Zoomer"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPreviewZoom(75)}
                  className="p-1 hover:bg-slate-800 rounded transition-colors ml-1 border-l border-slate-800 cursor-pointer"
                  title="Réinitialiser"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* FULLSCREEN PREVIEW IN MODAL */}
              {activePreviewContract && (
                <button
                  type="button"
                  onClick={() => {
                    openPdfModal({
                      ...activePreviewContract,
                      templateId: selectedPreviewTemplate,
                    });
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-colors cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimer / Exporter</span>
                </button>
              )}
            </div>
          </div>

          {/* ACTIVE MODEL SUMMARY CHIP */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Modèle visualisé :</span>
              <strong className="text-white text-sm">
                {getContractTemplate(selectedPreviewTemplate).name}
              </strong>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getContractTemplate(selectedPreviewTemplate).badgeColor}`}>
                {getContractTemplate(selectedPreviewTemplate).badge}
              </span>
            </div>
            <div className="text-slate-400 flex items-center gap-4">
              <span>Format : <strong>210 × 297 mm (A4 Recto / Verso)</strong></span>
              <span>•</span>
              <span>Conditions : <strong>v{termsVersion.version}</strong></span>
            </div>
          </div>

          {/* A4 PREVIEW CANVAS */}
          <div className="overflow-auto bg-slate-950 p-6 rounded-xl border border-slate-800/80 flex justify-center items-start min-h-[600px]">
            {activePreviewContract ? (
              <div
                style={{
                  transform: `scale(${previewZoom / 100})`,
                  transformOrigin: 'top center',
                  transition: 'transform 0.15s ease-out',
                }}
              >
                <ContractPdfDocument
                  contract={{
                    ...activePreviewContract,
                    templateId: selectedPreviewTemplate,
                  }}
                  companySettings={companySettings}
                  termsVersion={termsVersion}
                  templateId={selectedPreviewTemplate}
                  layout="stacked"
                  idPrefix="template-studio"
                />
              </div>
            ) : (
              <div className="text-center py-20 text-slate-500">
                <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-40 text-amber-400" />
                <p>Aucun contrat disponible pour la prévisualisation.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
