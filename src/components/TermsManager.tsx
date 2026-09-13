import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { TermClause } from '../types';
import {
  ShieldCheck,
  FileText,
  AlertCircle,
  CheckCircle2,
  Lock,
  Plus,
  History,
  Edit3,
  Trash2,
  Sparkles,
  Search,
  X,
  Printer,
  FileCode,
  ArrowRight,
} from 'lucide-react';

interface ClausePreset {
  number?: string;
  title: string;
  content: string;
  category: string;
}

const CLAUSE_PRESETS: ClausePreset[] = [
  {
    title: 'ASSISTANCE 24H/24 ET REMORQUAGE',
    category: 'Assistance',
    content:
      "En cas d'accident ou de panne mécanique non imputable à une négligence caractérisée du Locataire, la Société MORVELLO CARS assure ou fait assurer par son partenaire agréé une assistance dépannage et remorquage disponible 24h/24 et 7j/7 sur l'ensemble du territoire marocain (Tél : 0522582962 / 0522589535). Tout remorquage engagé par le client sans l'accord préalable du Loueur ne fera l'objet d'aucun remboursement.",
  },
  {
    title: 'FRANCHISE BRIS DE GLACE & PNEUMATIQUES',
    category: 'Assurances',
    content:
      "Les dégâts causés aux optiques, rétroviseurs, pare-brise ainsi que les perforations ou détériorations anormales des pneumatiques demeurent sous la responsabilité financière exclusive du Locataire, sauf souscription expresse de l'option spécifique 'Pack Sérénité' lors de l'établissement du contrat initial.",
  },
  {
    title: 'GÉOLOCALISATION ET TRAÇABILITÉ FLOTTE',
    category: 'Sécurité & Télématique',
    content:
      "Le Locataire est expressément informé et accepte que le véhicule puisse être équipé d'un dispositif télématique de géolocalisation antivol et de sécurité conforme aux exigences de la CNDP, destiné à localiser le véhicule en cas de vol, détournement, incident grave ou non-restitution à l'échéance contractuelle.",
  },
  {
    title: "RESTITUTION EN DEHORS DES HEURES D'OUVERTURE",
    category: 'Restitution',
    content:
      "La restitution du véhicule en dehors des horaires officiels d'ouverture de l'agence ou le dépôt des clés dans une boîte aux lettres sécurisée s'effectue sous la garde juridique continue du Locataire jusqu'à l'ouverture effective des bureaux et le constat contradictoire réalisé par un agent habilité.",
  },
  {
    title: 'INTERDICTION DE FUMER & FRAIS DE DÉCONTAMINATION',
    category: 'Hygiène & Entretien',
    content:
      "Il est strictement interdit de fumer à bord des véhicules de la flotte MORVELLO CARS (tabac traditionnel ou cigarette électronique). En cas de constatation d'odeurs persistantes ou de brûlures de sellerie lors du retour, une indemnité forfaitaire de remise en état de 1 500 MAD sera automatiquement prélevée sur la caution.",
  },
];

export const TermsManager: React.FC = () => {
  const {
    termsVersion,
    currentUser,
    hasPermission,
    addTermsClause,
    updateTermsClause,
    deleteTermsClause,
    updateTermsVersion,
    setActiveTab,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingClause, setEditingClause] = useState<TermClause | null>(null);
  const [deletingClause, setDeletingClause] = useState<TermClause | null>(null);

  // Form inputs
  const [clauseNumber, setClauseNumber] = useState('');
  const [clauseTitle, setClauseTitle] = useState('');
  const [clauseContent, setClauseContent] = useState('');
  const [formError, setFormError] = useState('');

  const isGerant = currentUser.role === 'admin' || hasPermission('canManageTerms');

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Auto-calculate next clause number suggestion
  const getSuggestedNumber = (): string => {
    const numericClauses = termsVersion.clauses
      .map((c) => parseInt(c.number.replace(/\D/g, ''), 10))
      .filter((n) => !isNaN(n));
    if (numericClauses.length === 0) return '1';
    const max = Math.max(...numericClauses);
    return String(max + 1);
  };

  const openAddModal = () => {
    setClauseNumber(getSuggestedNumber());
    setClauseTitle('');
    setClauseContent('');
    setFormError('');
    setIsAddModalOpen(true);
  };

  const openEditModal = (clause: TermClause) => {
    setEditingClause(clause);
    setClauseNumber(clause.number);
    setClauseTitle(clause.title);
    setClauseContent(clause.content);
    setFormError('');
  };

  const handleApplyPreset = (preset: ClausePreset) => {
    setClauseTitle(preset.title);
    setClauseContent(preset.content);
  };

  const handleSaveAddClause = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clauseNumber.trim() || !clauseTitle.trim() || !clauseContent.trim()) {
      setFormError('Veuillez remplir le numéro, le titre et le contenu juridique de la clause.');
      return;
    }

    const trimmedNum = clauseNumber.trim();
    // Check if number already exists
    const exists = termsVersion.clauses.some(
      (c) => c.number.toLowerCase() === trimmedNum.toLowerCase()
    );
    if (exists) {
      setFormError(`Le numéro d'article "${trimmedNum}" existe déjà. Veuillez en choisir un autre (ex: ${trimmedNum} bis).`);
      return;
    }

    const newClause: TermClause = {
      number: trimmedNum,
      title: clauseTitle.trim().toUpperCase(),
      content: clauseContent.trim(),
    };

    addTermsClause(newClause);
    setIsAddModalOpen(false);
    triggerToast(`Clause Article ${newClause.number} ajoutée avec succès aux conditions générales !`);
  };

  const handleSaveEditClause = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClause) return;

    if (!clauseNumber.trim() || !clauseTitle.trim() || !clauseContent.trim()) {
      setFormError('Veuillez renseigner tous les champs obligatoires.');
      return;
    }

    const trimmedNum = clauseNumber.trim();
    // If number changed, check collision
    if (trimmedNum.toLowerCase() !== editingClause.number.toLowerCase()) {
      const exists = termsVersion.clauses.some(
        (c) => c.number.toLowerCase() === trimmedNum.toLowerCase()
      );
      if (exists) {
        setFormError(`Le numéro d'article "${trimmedNum}" est déjà utilisé par une autre clause.`);
        return;
      }
    }

    updateTermsClause(editingClause.number, {
      number: trimmedNum,
      title: clauseTitle.trim().toUpperCase(),
      content: clauseContent.trim(),
    });

    setEditingClause(null);
    triggerToast(`Clause Article ${trimmedNum} modifiée avec succès.`);
  };

  const handleConfirmDelete = () => {
    if (!deletingClause) return;
    deleteTermsClause(deletingClause.number);
    setDeletingClause(null);
    triggerToast(`Article ${deletingClause.number} supprimé des conditions générales.`);
  };

  const filteredClauses = termsVersion.clauses.filter((c) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      c.number.toLowerCase().includes(q) ||
      c.title.toLowerCase().includes(q) ||
      c.content.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-500 text-slate-950 font-bold px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 border border-emerald-400 text-xs animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-slate-950 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* HEADER PRINCIPAL */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-purple-400 uppercase tracking-widest font-mono">
            <ShieldCheck className="w-4 h-4 text-purple-400" />
            Module Conditions Générales • Section 25 & 28
          </div>
          <h1 className="text-xl font-extrabold text-white tracking-tight mt-1">
            Conditions Générales de Location — Morvello Cars
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Texte contractuel officiel reproduit au verso (Page 2) du contrat de location A4.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* BADGE RÔLE */}
          {isGerant ? (
            <span className="bg-amber-500/15 text-amber-400 border border-amber-500/30 text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 font-mono">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Gérant : Droit d'Édition Actif
            </span>
          ) : (
            <span className="bg-slate-800 text-slate-400 border border-slate-700 text-xs font-medium px-3 py-1.5 rounded-xl flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-slate-500" />
              Mode Consultation Seule
            </span>
          )}

          {/* BADGE VERSION */}
          <span className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Version {termsVersion.version} (Active)
          </span>

          {/* BOUTON AJOUT NOUVELLE CLAUSE (RÉSERVÉ GÉRANT) */}
          {isGerant && (
            <button
              onClick={openAddModal}
              className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 flex items-center gap-1.5 transition-all cursor-pointer hover:scale-102"
              title="Ajouter une nouvelle clause contractuelle aux conditions de location"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>+ Nouvelle Clause</span>
            </button>
          )}
        </div>
      </div>

      {/* COMPLIANCE & LEGAL NOTICE */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-xs text-amber-200 space-y-2">
        <div className="flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-amber-300">
              Règle stricte d'intégrité contractuelle & Intégration dynamique Page 2 A4 :
            </p>
            <p className="text-amber-200/90 leading-relaxed">
              Le moteur PDF reproduit fidèlement toutes les clauses actives en deux colonnes équilibrées au verso du contrat. 
              {isGerant
                ? ' En tant que Gérant, vous pouvez enrichir ou adapter les clauses ci-dessous : toute modification ou nouvel article sera immédiatement reflété dans les contrats imprimés et les aperçus PDF.'
                : ' Seul le Gérant est habilité à ajouter ou modifier les clauses contractuelles afin de garantir l’opposabilité juridique devant les tribunaux.'}
            </p>
          </div>
        </div>
      </div>

      {/* VERSION & SEARCH BAR */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-5 text-slate-300">
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-mono">Version active</span>
            <strong className="text-white font-mono text-sm">V{termsVersion.version}</strong>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-mono">Date d'effet</span>
            <strong className="text-white text-sm">{termsVersion.date}</strong>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase font-mono">Clauses en vigueur</span>
            <strong className="text-amber-400 font-mono text-sm">
              {termsVersion.clauses.length} articles
            </strong>
          </div>
          {filteredClauses.length !== termsVersion.clauses.length && (
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-mono">Filtrés</span>
              <strong className="text-emerald-400 font-mono text-sm">
                {filteredClauses.length} affichés
              </strong>
            </div>
          )}
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filtrer une clause (ex: GPS, Caution, Remorquage)..."
            className="bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 w-full"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* CLAUSES LIST (2-COLUMN GRID) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredClauses.length === 0 ? (
          <div className="col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center text-slate-400">
            <FileText className="w-10 h-10 mx-auto text-slate-600 mb-2" />
            <p className="font-semibold text-white">Aucune clause trouvée</p>
            <p className="text-xs text-slate-500 mt-1">
              Aucun article ne correspond à votre recherche "{searchQuery}".
            </p>
          </div>
        ) : (
          filteredClauses.map((clause) => (
            <div
              key={clause.number}
              className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-md hover:border-slate-700 transition-colors flex flex-col justify-between group"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 font-mono font-bold text-xs flex items-center justify-center shrink-0">
                      {clause.number}
                    </span>
                    <h3 className="text-xs font-bold text-white uppercase tracking-wide">
                      {clause.title}
                    </h3>
                  </div>

                  {/* BOUTONS ACTIONS POUR LE GÉRANT */}
                  {isGerant && (
                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEditModal(clause)}
                        className="p-1.5 hover:bg-blue-500/20 text-slate-400 hover:text-blue-400 rounded-lg transition-colors cursor-pointer"
                        title="Modifier cette clause"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeletingClause(clause)}
                        className="p-1.5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                        title="Supprimer cette clause"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                <p className="text-xs text-slate-300 leading-relaxed text-justify">
                  {clause.content}
                </p>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                <span>Article {clause.number} • Verso Page 2</span>
                <span className="text-slate-600">Morvello Legal</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL : AJOUT D'UNE NOUVELLE CLAUSE (GÉRANT)                              */}
      {/* ========================================================================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-8">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Plus className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">
                    Ajouter une nouvelle clause contractuelle
                  </h2>
                  <p className="text-xs text-slate-400">
                    Cette clause sera automatiquement ajoutée aux Conditions Générales (Verso A4).
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAddClause} className="p-6 space-y-5">
              {formError && (
                <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 text-xs text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* MODÈLES PRÉ-DÉFINIS RAPIDES */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    Modèles juridiques suggérés (Remplissage rapide) :
                  </span>
                  <span className="text-[10px] text-slate-500">Cliquez pour appliquer</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {CLAUSE_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleApplyPreset(preset)}
                      className="text-[10px] bg-slate-800 hover:bg-amber-500/20 text-slate-300 hover:text-amber-300 border border-slate-700 hover:border-amber-500/40 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                    >
                      + {preset.title}
                    </button>
                  ))}
                </div>
              </div>

              {/* CHAMPS FORMULAIRE */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="sm:col-span-1">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    N° Article *
                  </label>
                  <input
                    type="text"
                    value={clauseNumber}
                    onChange={(e) => setClauseNumber(e.target.value)}
                    placeholder="Ex: 21, 18 bis"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono font-bold focus:outline-none focus:border-amber-500"
                    required
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Ex: 21, 22 ou 18 bis</p>
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Titre de la clause *
                  </label>
                  <input
                    type="text"
                    value={clauseTitle}
                    onChange={(e) => setClauseTitle(e.target.value)}
                    placeholder="Ex: FRANCHISE ET ASSISTANCE ROUTIÈRE 24/7"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white uppercase font-bold focus:outline-none focus:border-amber-500"
                    required
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Intitulé affiché en majuscules</p>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-300">
                    Contenu juridique détaillé *
                  </label>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {clauseContent.length} caractères
                  </span>
                </div>
                <textarea
                  rows={6}
                  value={clauseContent}
                  onChange={(e) => setClauseContent(e.target.value)}
                  placeholder="Rédigez ici le texte contractuel officiel opposable au locataire..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-amber-500 leading-relaxed font-sans"
                  required
                />
              </div>

              {/* APERÇU EN DIRECT */}
              {clauseTitle && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-1.5">
                  <span className="text-[10px] uppercase font-mono text-slate-500 block">
                    Aperçu du rendu final :
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded bg-amber-500/20 text-amber-400 font-mono font-bold text-[11px] flex items-center justify-center">
                      {clauseNumber || '?'}
                    </span>
                    <strong className="text-xs text-white uppercase">{clauseTitle}</strong>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed text-justify">
                    {clauseContent || 'Contenu en cours de saisie...'}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Enregistrer et intégrer la clause</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL : ÉDITION D'UNE CLAUSE (GÉRANT)                                     */}
      {/* ========================================================================= */}
      {editingClause && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-8">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">
                    Modifier l'Article {editingClause.number}
                  </h2>
                  <p className="text-xs text-slate-400">
                    Mise à jour du texte contractuel officiel.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingClause(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditClause} className="p-6 space-y-5">
              {formError && (
                <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 text-xs text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="sm:col-span-1">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    N° Article *
                  </label>
                  <input
                    type="text"
                    value={clauseNumber}
                    onChange={(e) => setClauseNumber(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono font-bold focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Titre de la clause *
                  </label>
                  <input
                    type="text"
                    value={clauseTitle}
                    onChange={(e) => setClauseTitle(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white uppercase font-bold focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Contenu juridique détaillé *
                </label>
                <textarea
                  rows={7}
                  value={clauseContent}
                  onChange={(e) => setClauseContent(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-blue-500 leading-relaxed font-sans"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingClause(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-500/20 transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Valider les modifications</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL : CONFIRMATION SUPPRESSION D'UNE CLAUSE                             */}
      {/* ========================================================================= */}
      {deletingClause && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-500/30 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-white">
                Supprimer l'Article {deletingClause.number} ?
              </h3>
              <p className="text-xs text-slate-400">
                Êtes-vous sûr de vouloir retirer la clause <strong className="text-white">"{deletingClause.title}"</strong> des conditions générales ?
              </p>
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[11px] text-slate-400 max-h-24 overflow-y-auto">
              {deletingClause.content}
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingClause(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-600/30"
              >
                Supprimer définitivement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

