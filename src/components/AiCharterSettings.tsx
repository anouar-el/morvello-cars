import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { AssistantUsagePanel } from './AssistantUsagePanel';
import {
  AiAssistantSettings,
  AiToneOfVoice,
  AiLanguagePreference,
  AiSampleResponse,
} from '../types';
import {
  Bot,
  Sparkles,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  MessageSquare,
  ShieldCheck,
  Building,
  Quote,
  Layers,
  Crown,
  Briefcase,
  Smile,
  Zap,
  Eye,
} from 'lucide-react';

import { useI18n } from '../i18n/I18nContext';
export const AiCharterSettings: React.FC = () => {
  const { t } = useI18n();
  const { aiSettings, updateAiSettings, resetAiSettings, currentUser } = useApp();
  const [formData, setFormData] = useState<AiAssistantSettings>(aiSettings);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'vision' | 'tone' | 'rules' | 'samples' | 'preview'>('vision');

  // Input states for adding new items
  const [newKeyValue, setNewKeyValue] = useState('');
  const [newProhibited, setNewProhibited] = useState('');
  const [newSampleScenario, setNewSampleScenario] = useState('');
  const [newSampleReply, setNewSampleReply] = useState('');
  const [showAddSample, setShowAddSample] = useState(false);

  const isAgent = currentUser.role === 'agent';

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (isAgent) return;
    updateAiSettings(formData);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3500);
  };

  const handleReset = () => {
    if (
      window.confirm(
        t('Voulez-vous restaurer la charte éditoriale et le style par défaut de Morvello Cars ?')
      )
    ) {
      resetAiSettings();
      // Also refresh local formData
      setTimeout(() => {
        window.location.reload();
      }, 300);
    }
  };

  // Add Key Value
  const handleAddKeyValue = () => {
    if (!newKeyValue.trim()) return;
    setFormData((prev) => ({
      ...prev,
      keyValues: [...prev.keyValues, newKeyValue.trim()],
    }));
    setNewKeyValue('');
  };

  const handleRemoveKeyValue = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      keyValues: prev.keyValues.filter((_, i) => i !== index),
    }));
  };

  // Add Prohibited
  const handleAddProhibited = () => {
    if (!newProhibited.trim()) return;
    setFormData((prev) => ({
      ...prev,
      prohibitedBehaviors: [...prev.prohibitedBehaviors, newProhibited.trim()],
    }));
    setNewProhibited('');
  };

  const handleRemoveProhibited = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      prohibitedBehaviors: prev.prohibitedBehaviors.filter((_, i) => i !== index),
    }));
  };

  // Add Sample Response
  const handleAddSample = () => {
    if (!newSampleScenario.trim() || !newSampleReply.trim()) return;
    const newSample: AiSampleResponse = {
      id: `sample-${Date.now()}`,
      scenario: newSampleScenario.trim(),
      idealReply: newSampleReply.trim(),
    };
    setFormData((prev) => ({
      ...prev,
      sampleResponses: [...prev.sampleResponses, newSample],
    }));
    setNewSampleScenario('');
    setNewSampleReply('');
    setShowAddSample(false);
  };

  const handleRemoveSample = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      sampleResponses: prev.sampleResponses.filter((s) => s.id !== id),
    }));
  };

  const handleUpdateSample = (id: string, updatedReply: string) => {
    setFormData((prev) => ({
      ...prev,
      sampleResponses: prev.sampleResponses.map((s) =>
        s.id === id ? { ...s, idealReply: updatedReply } : s
      ),
    }));
  };

  const toneOptions: { id: AiToneOfVoice; label: string; desc: string; icon: any }[] = [
    {
      id: 'luxury_concierge',
      label: t('Luxe & Conciergerie'),
      desc: t('Poli, raffiné, digne des plus grands palaces, rassurant et valorisant le service haut de gamme Morvello.'),
      icon: Crown,
    },
    {
      id: 'business_formal',
      label: t('Formel d’Affaires'),
      desc: t('Corporate, concis, rigoureux, respectueux des termes contractuels et des procédures d’entreprise.'),
      icon: Briefcase,
    },
    {
      id: 'warm_commercial',
      label: t('Commercial Chaleureux'),
      desc: t('Enthousiaste, accueillant, empreint de l’hospitalité marocaine et orienté fidélisation client.'),
      icon: Smile,
    },
    {
      id: 'direct_operational',
      label: t('Opérationnel Direct'),
      desc: t('Ultra-synthétique, factuel, focalisé sur les chiffres, le kilométrage et l’action immédiate.'),
      icon: Zap,
    },
  ];

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <div className="bg-gradient-to-r from-slate-900 via-amber-950/20 to-slate-900 border border-amber-500/30 p-5 rounded-2xl shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-400 p-0.5 shadow-lg shadow-amber-500/20 shrink-0">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center text-amber-400">
              <Sparkles className="w-6 h-6" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-amber-400 uppercase tracking-widest font-mono">
                {t('Apprentissage & Intelligence Artificielle')}
              </span>
              <span className="bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                {t('Few-Shot Learning Actif')}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight mt-0.5">
              {t("Charte Éditoriale & Personnalité de l'Assistant")}
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              {t("Inculquez à l'assistant l'ADN de Morvello Cars : votre vision de marque, votre ton, vos valeurs clés et vos modèles de réponses idéales pour tous les gestionnaires.")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleReset}
            disabled={isAgent}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium border border-slate-700 transition-colors cursor-pointer disabled:opacity-50"
            title={t('Rétablir les réglages par défaut de la conciergerie')}
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span>{t('Réinitialiser')}</span>
          </button>
        </div>
      </div>

      {currentUser.role === 'admin' && <AssistantUsagePanel />}

      {savedSuccess && (
        <div className="bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 p-3.5 rounded-xl text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>
            {t('Charte éditoriale et vision de marque enregistrées ! L’assistant IA appliquera immédiatement ces consignes lors de ses prochains échanges.')}
          </span>
        </div>
      )}

      {/* SUB TABS */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto text-xs">
        <button
          type="button"
          onClick={() => setActiveTab('vision')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-semibold transition-colors shrink-0 cursor-pointer ${
            activeTab === 'vision'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>{t('1. Vision & Signature')}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('tone')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-semibold transition-colors shrink-0 cursor-pointer ${
            activeTab === 'tone'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Bot className="w-4 h-4" />
          <span>{t('2. Posture & Ton')}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('rules')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-semibold transition-colors shrink-0 cursor-pointer ${
            activeTab === 'rules'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>{t('3. Valeurs & Interdictions')}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('samples')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-semibold transition-colors shrink-0 cursor-pointer ${
            activeTab === 'samples'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>{t('4. Réponses Modèles ({sampleResponsesCount})', { sampleResponsesCount: formData.sampleResponses.length })}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('preview')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-semibold transition-colors shrink-0 cursor-pointer ${
            activeTab === 'preview'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Eye className="w-4 h-4" />
          <span>{t('5. Aperçu de la Personnalité')}</span>
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* TAB 1: VISION & IDENTITÉ */}
        {activeTab === 'vision' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wide mb-1.5">
                {t('Vision de Marque & Positionnement Morvello Cars')}
              </label>
              <p className="text-xs text-slate-400 mb-2">
                {t("Expliquez à l'IA ce qui rend Morvello unique, vos engagements de qualité et la façon dont vous souhaitez être perçu par les clients.")}
              </p>
              <textarea
                rows={4}
                value={formData.brandVision}
                disabled={isAgent}
                onChange={(e) => setFormData({ ...formData, brandVision: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white leading-relaxed focus:border-amber-500 focus:outline-none"
                placeholder={t('Ex: Morvello Cars incarne la conciergerie haut de gamme au Maroc...')}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wide mb-1.5">
                  {t('Signature & Slogan de l’Agence')}
                </label>
                <input
                  type="text"
                  value={formData.signatureGreeting}
                  disabled={isAgent}
                  onChange={(e) => setFormData({ ...formData, signatureGreeting: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                  placeholder={t('Ex: Sté MORVELLO CARS • Where luxury meets the road')}
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  {t('Apparaît en bas des messages formels ou devis rédigés.')}
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wide mb-1.5">
                  {t('Règle Tarifaire & Financière Standard')}
                </label>
                <input
                  type="text"
                  value={formData.standardPricingRule}
                  disabled={isAgent}
                  onChange={(e) => setFormData({ ...formData, standardPricingRule: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                  placeholder={t('Ex: Tarif de la fiche véhicule. Packs Base / Amélioré / Confort, franchise 5 % des dégâts (minimum par pack).')}
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  {t("Base sur laquelle l'IA s'appuie pour calculer les devis et prolongations.")}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wide mb-1.5">
                {t('Consignes Spécifiques & Instructions du Gérant')}
              </label>
              <textarea
                rows={3}
                value={formData.customInstructions}
                disabled={isAgent}
                onChange={(e) => setFormData({ ...formData, customInstructions: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white leading-relaxed focus:border-amber-500 focus:outline-none"
                placeholder={t('Ex: Prioriser toujours la sécurité juridique de l’agence, rappeler systématiquement la présentation du permis physique...')}
              />
            </div>
          </div>
        )}

        {/* TAB 2: POSTURE & TON */}
        {activeTab === 'tone' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-6">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wide mb-3">
                {t("Sélectionnez la Posture Principale de l'Assistant")}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {toneOptions.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = formData.toneOfVoice === opt.id;
                  return (
                    <div
                      key={opt.id}
                      onClick={() => !isAgent && setFormData({ ...formData, toneOfVoice: opt.id })}
                      className={`p-4 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-amber-500/15 border-amber-500 text-white shadow-lg shadow-amber-500/10'
                          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                      } ${isAgent ? 'cursor-not-allowed opacity-60' : ''}`}
                    >
                      <div className="flex items-center gap-2.5 mb-1.5">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            isSelected ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-amber-400'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="font-bold text-sm text-white">{opt.label}</span>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">{opt.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Language Strategy */}
            <div className="border-t border-slate-800 pt-5">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wide mb-2">
                {t('Stratégie Linguistique (Français & Langue Arabe)')}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                {[
                  {
                    id: 'french_darija' as AiLanguagePreference,
                    label: t('🇫🇷 Français & 🇲🇦 Arabe au choix'),
                    desc: t('Alternance naturelle selon le contexte ou la langue choisie par l’interlocuteur.'),
                  },
                  {
                    id: 'french_only' as AiLanguagePreference,
                    label: t('🇫🇷 Français exclusivement'),
                    desc: t('Tous les échanges et messages rédigés sont strictement formulés en français d’affaires.'),
                  },
                  {
                    id: 'darija_arabic_french' as AiLanguagePreference,
                    label: t('🇲🇦 Priorité Langue Arabe'),
                    desc: t('Favorise la langue arabe soignée pour les contacts WhatsApp et messages de bienvenue.'),
                  },
                ].map((item) => (
                  <label
                    key={item.id}
                    className={`flex flex-col p-3 rounded-xl border cursor-pointer select-none transition-colors ${
                      formData.languagePreference === item.id
                        ? 'bg-amber-500/10 border-amber-500/50 text-white'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-slate-200 mb-1">
                      <input
                        type="radio"
                        name="languagePreference"
                        checked={formData.languagePreference === item.id}
                        onChange={() => setFormData({ ...formData, languagePreference: item.id })}
                        className="accent-amber-500"
                        disabled={isAgent}
                      />
                      <span>{item.label}</span>
                    </div>
                    <span className="text-[11px] text-slate-400 leading-snug">{item.desc}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: VALEURS & INTERDICTIONS */}
        {activeTab === 'rules' && (
          <div className="space-y-6">
            {/* Key Values */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wide flex items-center gap-2">
                    <Crown className="w-4 h-4 text-amber-400" />
                    {t('Valeurs Fondamentales de Morvello Cars')}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {t("L'IA intégrera ces principes dans ses conseils opérationnels et ses interactions.")}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                {formData.keyValues.map((val, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-3 p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center text-[10px] font-bold">
                        {idx + 1}
                      </span>
                      <span>{val}</span>
                    </div>
                    {!isAgent && (
                      <button
                        type="button"
                        onClick={() => handleRemoveKeyValue(idx)}
                        className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {!isAgent && (
                <div className="flex gap-2 pt-2">
                  <input
                    type="text"
                    value={newKeyValue}
                    onChange={(e) => setNewKeyValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddKeyValue())}
                    placeholder={t('Ex: Véhicules impeccables, inspection photo systématique...')}
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddKeyValue}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t('Ajouter')}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Prohibited behaviors */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wide flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  {t('Lignes Rouges & Règles Strictement Interdites')}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {t("Ce que l'IA ne doit JAMAIS faire, dire ou concéder lors de ses échanges avec l'équipe ou les clients.")}
                </p>
              </div>

              <div className="space-y-2">
                {formData.prohibitedBehaviors.map((rule, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-3 p-2.5 bg-rose-950/20 border border-rose-900/40 rounded-xl text-xs text-rose-200"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-300 flex items-center justify-center text-[10px] font-bold">
                        ✕
                      </span>
                      <span>{rule}</span>
                    </div>
                    {!isAgent && (
                      <button
                        type="button"
                        onClick={() => handleRemoveProhibited(idx)}
                        className="p-1 text-rose-400/60 hover:text-rose-300 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {!isAgent && (
                <div className="flex gap-2 pt-2">
                  <input
                    type="text"
                    value={newProhibited}
                    onChange={(e) => setNewProhibited(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddProhibited())}
                    placeholder={t('Ex: Ne jamais promettre une remise sans validation écrite du gérant...')}
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-rose-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddProhibited}
                    className="px-3.5 py-2 bg-rose-950/40 hover:bg-rose-900/40 border border-rose-800/40 text-rose-300 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t('Ajouter')}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: FEW-SHOT RESPONSES (RÉPONSES TYPES) */}
        {activeTab === 'samples' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wide flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-amber-400" />
                  {t("Bibliothèque des Réponses Modèles (Apprentissage par l'exemple)")}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {t("L'IA apprend votre style en calquant ces formulations modèles. Modifiez les textes ou ajoutez vos propres cas types.")}
                </p>
              </div>

              {!isAgent && !showAddSample && (
                <button
                  type="button"
                  onClick={() => setShowAddSample(true)}
                  className="px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t('Nouveau Cas Type')}</span>
                </button>
              )}
            </div>

            {/* ADD NEW SAMPLE BOX */}
            {showAddSample && (
              <div className="p-4 bg-slate-950 border border-amber-500/40 rounded-xl space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-400">{t('Ajouter un exemple modèle')}</span>
                  <button
                    type="button"
                    onClick={() => setShowAddSample(false)}
                    className="text-slate-400 hover:text-white text-xs"
                  >
                    {t('Annuler')}
                  </button>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1 font-medium">{t('Scénario ou Situation')}</label>
                  <input
                    type="text"
                    value={newSampleScenario}
                    onChange={(e) => setNewSampleScenario(e.target.value)}
                    placeholder={t('Ex: Accueil Client aéroport Nouaceur (WhatsApp)')}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1 font-medium">{t('Votre Réponse Idéale (Le modèle)')}</label>
                  <textarea
                    rows={3}
                    value={newSampleReply}
                    onChange={(e) => setNewSampleReply(e.target.value)}
                    placeholder={t("Tapez le message parfait tel que vous aimeriez que l'IA le rédige...")}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs text-white leading-relaxed focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddSample(false)}
                    className="px-3 py-1.5 bg-slate-800 text-slate-300 text-xs rounded-lg"
                  >
                    {t('Annuler')}
                  </button>
                  <button
                    type="button"
                    onClick={handleAddSample}
                    className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg"
                  >
                    {t('Enregistrer l’exemple')}
                  </button>
                </div>
              </div>
            )}

            {/* SAMPLES LIST */}
            <div className="space-y-4">
              {formData.sampleResponses.map((sample, idx) => (
                <div
                  key={sample.id}
                  className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 font-mono text-[10px] font-bold">
                        {t('Modèle #{idx}', { idx: idx + 1 })}
                      </span>
                      <span className="text-xs font-bold text-white">{sample.scenario}</span>
                    </div>
                    {!isAgent && (
                      <button
                        type="button"
                        onClick={() => handleRemoveSample(sample.id)}
                        className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                        title={t('Supprimer cet exemple')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <textarea
                    rows={3}
                    value={sample.idealReply}
                    disabled={isAgent}
                    onChange={(e) => handleUpdateSample(sample.id, e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-3 text-xs text-slate-300 font-sans leading-relaxed focus:border-amber-500 focus:outline-none"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: APERÇU EN DIRECT */}
        {activeTab === 'preview' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wide flex items-center gap-2">
                  <Eye className="w-4 h-4 text-amber-400" />
                  {t('Simulateur de Personnalité en Direct')}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {t("Voici comment l'assistant Morvello Cars se présentera et s'exprimera selon vos réglages actuels.")}
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30 text-xs font-mono font-bold">
                {formData.toneOfVoice.toUpperCase()}
              </span>
            </div>

            {/* SIMULATED CHAT MESSAGE */}
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
              <div className="flex items-center gap-2.5 text-xs text-amber-400 font-bold">
                <Bot className="w-4 h-4" />
                <span>{t('Assistant Morvello Cars ({name})', { name: currentUser.name })}</span>
              </div>
              <div className="text-xs text-slate-300 space-y-2 leading-relaxed">
                <p>
                  {t('Bonjour')} <strong>{currentUser.name}</strong>{t(". À votre service pour orchestrer les opérations de l'agence.")}
                </p>
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-xs space-y-1">
                  <p className="font-semibold text-slate-200">
                    🏛️ <em>« {formData.signatureGreeting} »</em>
                  </p>
                  <p className="text-slate-400 text-[11px]">
                    <strong>{t('Posture active :')}</strong> {
                      formData.toneOfVoice === 'luxury_concierge'
                        ? t('Conciergerie de luxe & excellence')
                        : formData.toneOfVoice === 'business_formal'
                        ? t('Rigueur formelle d’affaires')
                        : formData.toneOfVoice === 'warm_commercial'
                        ? t('Chaleur commerciale & hospitalité')
                        : t('Opérationnel direct & précis')
                    }
                  </p>
                </div>
                <p className="text-slate-400 text-[11px]">
                  💡 <em>
                    {t('« Vos gestionnaires recevront des réponses calibrées sur ces valeurs : rigueur contractuelle, hospitalité marocaine, et respect strict du cloisonnement de leur propre parc. »')}
                  </em>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* SAVE BUTTON */}
        {!isAgent && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-slate-500">
              {t("Les modifications s'appliquent immédiatement à toutes les agences et tous les gestionnaires.")}
            </p>
            <button
              type="submit"
              className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold px-6 py-2.5 rounded-xl shadow-lg shadow-amber-500/25 transition-transform active:scale-95 text-xs sm:text-sm cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{t('Enregistrer la Charte IA')}</span>
            </button>
          </div>
        )}
      </form>
    </div>
  );
};
