import React, { useState } from 'react';
import { Vehicle, VehicleExpense, ExpenseCategory, User } from '../../types';
import {
  Wrench,
  Plus,
  Trash2,
  Receipt,
  Gauge,
  Calendar,
  Building,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  X,
  FileText,
  TrendingUp,
  Clock,
  Sparkles,
  Layers,
} from 'lucide-react';
import { checkOilChangeStatus } from '../../utils/vehicleExpiryUtils';

interface VehicleMaintenanceModalProps {
  vehicle: Vehicle | null;
  isOpen: boolean;
  onClose: () => void;
  onAddExpense: (
    vehicleId: string,
    expenseData: Omit<VehicleExpense, 'id' | 'createdAt' | 'vehicleId'>
  ) => void;
  onDeleteExpense: (vehicleId: string, expenseId: string) => void;
  canManage: boolean;
  currentUser: User;
}

const CATEGORY_MAP: Record<
  ExpenseCategory,
  { label: string; badgeClass: string; icon: string }
> = {
  oil_change: {
    label: 'Vidange & Filtres',
    badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    icon: '🛢️',
  },
  brakes: {
    label: 'Freinage (Plaquettes/Disques)',
    badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    icon: '🛑',
  },
  tires: {
    label: 'Pneumatiques & Géométrie',
    badgeClass: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    icon: '🛞',
  },
  mechanical: {
    label: 'Mécanique & Moteur',
    badgeClass: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    icon: '⚙️',
  },
  bodywork: {
    label: 'Carrosserie & Peinture',
    badgeClass: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
    icon: '🎨',
  },
  inspection: {
    label: 'Contrôle Technique / Visite',
    badgeClass: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
    icon: '📋',
  },
  insurance: {
    label: 'Prime Assurance',
    badgeClass: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
    icon: '🛡️',
  },
  vignette: {
    label: 'Vignette Fiscale',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    icon: '🏷️',
  },
  wash_cleaning: {
    label: 'Lavage & Préparation',
    badgeClass: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    icon: '✨',
  },
  other: {
    label: 'Autre Entretien',
    badgeClass: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
    icon: '🔧',
  },
};

export const VehicleMaintenanceModal: React.FC<VehicleMaintenanceModalProps> = ({
  vehicle,
  isOpen,
  onClose,
  onAddExpense,
  onDeleteExpense,
  canManage,
  currentUser,
}) => {
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [category, setCategory] = useState<ExpenseCategory>('oil_change');
  const [title, setTitle] = useState('');
  const [costMAD, setCostMAD] = useState<number | ''>('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [kmAtExpense, setKmAtExpense] = useState<number | ''>(vehicle?.currentKm || 0);
  const [provider, setProvider] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [notes, setNotes] = useState('');

  // Prochaine vidange target (par défaut +10,000 km si vidange)
  const [nextOilKmTarget, setNextOilKmTarget] = useState<number | ''>(
    (vehicle?.currentKm || 0) + 10000
  );
  const [autoUpdateOilKm, setAutoUpdateOilKm] = useState(true);

  if (!isOpen || !vehicle) return null;

  const expenses = vehicle.maintenanceExpenses || [];
  const totalExpensesCost = expenses.reduce((acc, curr) => acc + (curr.costMAD || 0), 0);

  const oilStatus = checkOilChangeStatus(vehicle);

  const handleCategoryChange = (cat: ExpenseCategory) => {
    setCategory(cat);
    if (cat === 'oil_change') {
      if (!title || title.startsWith('Vidange')) {
        setTitle('Vidange moteur + filtre à huile');
      }
      setAutoUpdateOilKm(true);
      const cur = typeof kmAtExpense === 'number' ? kmAtExpense : vehicle.currentKm;
      setNextOilKmTarget(cur + 10000);
    } else {
      setAutoUpdateOilKm(false);
      if (cat === 'brakes' && !title) setTitle('Remplacement plaquettes de frein avant');
      else if (cat === 'tires' && !title) setTitle('Remplacement 2 pneumatiques neufs');
      else if (cat === 'wash_cleaning' && !title) setTitle('Nettoyage intégral intérieur/extérieur');
    }
  };

  const handleKmChange = (val: number) => {
    setKmAtExpense(val);
    if (category === 'oil_change' && autoUpdateOilKm) {
      setNextOilKmTarget(val + 10000);
    }
  };

  const handleSubmitNewExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!costMAD || Number(costMAD) <= 0) return;

    const expenseKm = typeof kmAtExpense === 'number' ? kmAtExpense : vehicle.currentKm;
    const finalNextOilTarget =
      category === 'oil_change' && autoUpdateOilKm && typeof nextOilKmTarget === 'number'
        ? nextOilKmTarget
        : undefined;

    onAddExpense(vehicle.id, {
      category,
      title: title.trim() || CATEGORY_MAP[category].label,
      costMAD: Number(costMAD),
      date,
      kmAtExpense: expenseKm,
      provider: provider.trim() || undefined,
      invoiceNumber: invoiceNumber.trim() || undefined,
      notes: notes.trim() || undefined,
      recordedBy: currentUser.name,
      nextOilChangeTargetKm: finalNextOilTarget,
    });

    // Reset
    setTitle('');
    setCostMAD('');
    setProvider('');
    setInvoiceNumber('');
    setNotes('');
    setIsAddingNew(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
        {/* HEADER */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Carnet d'Entretien & Factures
                </h2>
                <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-lg bg-slate-950 border border-amber-500/40 text-amber-400">
                  {vehicle.plate}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {vehicle.brand} {vehicle.model} ({vehicle.year || 2025}) • Compteur :{' '}
                <strong className="text-slate-200 font-mono">
                  {vehicle.currentKm.toLocaleString('fr-FR')} KM
                </strong>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* STATS & OIL STATUS BAR */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Total Dépenses */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
              Total Dépenses Entretien
            </span>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-white font-mono">
                {totalExpensesCost.toLocaleString('fr-FR')}
              </span>
              <span className="text-xs text-amber-400 font-bold font-mono">MAD</span>
            </div>
            <span className="text-[10px] text-slate-500 mt-1">
              {expenses.length} intervention{expenses.length > 1 ? 's' : ''} enregistrée{expenses.length > 1 ? 's' : ''}
            </span>
          </div>

          {/* Statut Vidange */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5 text-amber-400" />
                Statut Vidange
              </span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${oilStatus.badgeClass}`}
              >
                {oilStatus.text}
              </span>
            </div>
            <div className="mt-2">
              <span className="text-[11px] text-slate-400 block">Prochaine échéance :</span>
              <span className="text-base font-bold text-white font-mono">
                {vehicle.nextOilChangeKm
                  ? `${vehicle.nextOilChangeKm.toLocaleString('fr-FR')} KM`
                  : 'Non programmée'}
              </span>
            </div>
            <span className="text-[10px] text-slate-400">
              {oilStatus.kmRemaining !== null ? (
                oilStatus.kmRemaining > 0 ? (
                  `Reste ${oilStatus.kmRemaining.toLocaleString('fr-FR')} KM avant vidange`
                ) : (
                  <strong className="text-rose-400">
                    Dépassée de {Math.abs(oilStatus.kmRemaining).toLocaleString('fr-FR')} KM
                  </strong>
                )
              ) : (
                'Définir le seuil lors de la vidange'
              )}
            </span>
          </div>

          {/* Dernière Révision */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-400" />
              Dernière Intervention
            </span>
            <div className="mt-2">
              <span className="text-base font-bold text-slate-200">
                {vehicle.lastInspectionDate
                  ? new Date(vehicle.lastInspectionDate).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })
                  : 'Aucune révision'}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 truncate">
              {expenses[0] ? `« ${expenses[0].title} »` : 'Parc à jour'}
            </span>
          </div>
        </div>

        {/* ACTION BUTTON TO EXPAND "ADD NEW EXPENSE" */}
        {canManage && !isAddingNew && (
          <div className="flex justify-end">
            <button
              onClick={() => {
                setIsAddingNew(true);
                handleCategoryChange('oil_change');
              }}
              className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Enregistrer une intervention / facture</span>
            </button>
          </div>
        )}

        {/* FORMULAIRE NOUVELLE DÉPENSE */}
        {isAddingNew && canManage && (
          <form
            onSubmit={handleSubmitNewExpense}
            className="bg-slate-950 border border-amber-500/40 rounded-xl p-4.5 space-y-4 animate-in slide-in-from-top-2 duration-150"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Nouvelle Dépense d'Entretien / Vidange
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddingNew(false)}
                className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                Annuler
              </button>
            </div>

            {/* CATEGORY SELECTOR */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Type d'intervention <span className="text-amber-400">*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-1.5">
                {(Object.keys(CATEGORY_MAP) as ExpenseCategory[]).map((catKey) => {
                  const isSelected = category === catKey;
                  const item = CATEGORY_MAP[catKey];
                  return (
                    <button
                      key={catKey}
                      type="button"
                      onClick={() => handleCategoryChange(catKey)}
                      className={`text-left px-2.5 py-2 rounded-lg border text-[11px] font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                        isSelected
                          ? 'bg-amber-500 text-slate-950 font-bold border-amber-400 shadow-sm'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <span>{item.icon}</span>
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* TITLE & COST */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Désignation / Intitulé <span className="text-amber-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Vidange 10 000 KM + remplacement filtre à huile et air"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Montant Facture (MAD TTC) <span className="text-amber-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    required
                    min={0}
                    step={10}
                    value={costMAD}
                    onChange={(e) =>
                      setCostMAD(e.target.value === '' ? '' : Number(e.target.value))
                    }
                    placeholder="Ex: 850"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-amber-400 font-mono font-bold focus:outline-none focus:border-amber-500 pr-12"
                  />
                  <span className="absolute right-3 top-2 text-xs font-mono font-bold text-slate-400">
                    MAD
                  </span>
                </div>
              </div>
            </div>

            {/* DATE & KILOMÉTRAGE */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Date de l'intervention
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Kilométrage au compteur (KM)
                </label>
                <input
                  type="number"
                  min={0}
                  value={kmAtExpense}
                  onChange={(e) =>
                    handleKmChange(e.target.value === '' ? 0 : Number(e.target.value))
                  }
                  placeholder={`Actuel : ${vehicle.currentKm}`}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* IF OIL CHANGE: REPORT TO NEXT OIL CHANGE TARGET */}
            {category === 'oil_change' && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>Calcul & recalibrage de la prochaine vidange</span>
                  </div>
                  <label className="flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoUpdateOilKm}
                      onChange={(e) => setAutoUpdateOilKm(e.target.checked)}
                      className="rounded accent-amber-500"
                    />
                    <span>Mettre à jour l'échéance du véhicule</span>
                  </label>
                </div>

                {autoUpdateOilKm && (
                  <div className="flex items-center gap-3 pt-1">
                    <div className="flex-1">
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Nouvelle cible de vidange (KM) :
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={nextOilKmTarget}
                        onChange={(e) =>
                          setNextOilKmTarget(
                            e.target.value === '' ? '' : Number(e.target.value)
                          )
                        }
                        className="w-full bg-slate-950 border border-amber-500/40 rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-amber-300 focus:outline-none focus:border-amber-400"
                      />
                    </div>
                    <div className="flex gap-1 self-end pb-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          const base =
                            typeof kmAtExpense === 'number' ? kmAtExpense : vehicle.currentKm;
                          setNextOilKmTarget(base + 10000);
                        }}
                        className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-[10px] px-2 py-1 rounded font-mono cursor-pointer"
                      >
                        +10 000 KM
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const base =
                            typeof kmAtExpense === 'number' ? kmAtExpense : vehicle.currentKm;
                          setNextOilKmTarget(base + 15000);
                        }}
                        className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-[10px] px-2 py-1 rounded font-mono cursor-pointer"
                      >
                        +15 000 KM
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* PRESTATAIRE & N° FACTURE */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Prestataire / Garage partenaire
                </label>
                <input
                  type="text"
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  placeholder="Ex: Garage Midas Nouaceur, Succursale Renault..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  N° Facture / Référence bon d'intervention
                </label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="Ex: FAC-2026-0883"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* NOTES */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Observations techniques / Références pièces
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Remplacement filtre à gazole Bosch, vidange huile 5W30 100% synthèse."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* SUBMIT BUTTONS */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddingNew(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 border border-slate-800 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs shadow-md transition-all active:scale-95 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Valider et enregistrer la dépense</span>
              </button>
            </div>
          </form>
        )}

        {/* LISTE HISTORIQUE DES INTERVENTIONS */}
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              <span>Historique chronologique des entretiens ({expenses.length})</span>
            </h3>
            {totalExpensesCost > 0 && (
              <span className="text-xs font-mono font-bold text-amber-400">
                Total : {totalExpensesCost.toLocaleString('fr-FR')} MAD
              </span>
            )}
          </div>

          {expenses.length === 0 ? (
            <div className="bg-slate-950/60 border border-dashed border-slate-800 rounded-xl py-10 text-center space-y-2">
              <Wrench className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-xs text-slate-400">
                Aucune dépense d'entretien enregistrée pour ce véhicule.
              </p>
              {canManage && (
                <button
                  onClick={() => {
                    setIsAddingNew(true);
                    handleCategoryChange('oil_change');
                  }}
                  className="text-xs text-amber-400 hover:text-amber-300 font-semibold underline cursor-pointer"
                >
                  Ajouter la première intervention
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2.5">
              {expenses.map((exp) => {
                const catInfo = CATEGORY_MAP[exp.category] || CATEGORY_MAP.other;
                return (
                  <div
                    key={exp.id}
                    className="bg-slate-950/80 border border-slate-800 hover:border-slate-700/80 rounded-xl p-3.5 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0 text-base">
                        {catInfo.icon}
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold text-white tracking-tight">
                            {exp.title}
                          </span>
                          <span
                            className={`text-[10px] px-2 py-0.2 rounded-md border font-medium ${catInfo.badgeClass}`}
                          >
                            {catInfo.label}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400 mt-1">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-500" />
                            {new Date(exp.date).toLocaleDateString('fr-FR')}
                          </span>

                          <span className="flex items-center gap-1 font-mono text-slate-300">
                            <Gauge className="w-3 h-3 text-slate-500" />
                            {exp.kmAtExpense.toLocaleString('fr-FR')} KM
                          </span>

                          {exp.provider && (
                            <span className="flex items-center gap-1 text-slate-400 truncate max-w-[180px]">
                              <Building className="w-3 h-3 text-slate-500" />
                              {exp.provider}
                            </span>
                          )}

                          {exp.invoiceNumber && (
                            <span className="flex items-center gap-1 font-mono text-slate-400">
                              <Receipt className="w-3 h-3 text-slate-500" />
                              {exp.invoiceNumber}
                            </span>
                          )}
                        </div>

                        {exp.notes && (
                          <p className="text-[11px] text-slate-400 italic mt-1 bg-slate-900/50 px-2 py-1 rounded border border-slate-800/60">
                            « {exp.notes} »
                          </p>
                        )}

                        <div className="text-[10px] text-slate-500 mt-1">
                          Enregistré par {exp.recordedBy || 'Collaborateur'}
                          {exp.nextOilChangeTargetKm && (
                            <span className="text-amber-400/90 font-mono ml-2">
                              • Échéance vidange fixée à {exp.nextOilChangeTargetKm.toLocaleString('fr-FR')} KM
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* COST & DELETE */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
                      <div className="text-right">
                        <span className="text-base font-black text-amber-400 font-mono">
                          {exp.costMAD.toLocaleString('fr-FR')}
                        </span>
                        <span className="text-[10px] text-amber-500 font-mono font-bold ml-1">
                          MAD
                        </span>
                      </div>

                      {canManage && (
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              window.confirm(
                                `Supprimer cette dépense "${exp.title}" (${exp.costMAD} MAD) ?`
                              )
                            ) {
                              onDeleteExpense(vehicle.id, exp.id);
                            }
                          }}
                          title="Supprimer cette dépense"
                          className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="border-t border-slate-800 pt-3 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Morvello Cars • Carnet technique conforme aux normes d'entretien constructeur
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white transition-colors cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
