import React, { useState, useEffect } from 'react';
import { Contract, PaymentRecord, PaymentMethod } from '../types';
import {
  CreditCard,
  Banknote,
  DollarSign,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  X,
  Receipt,
  Calendar,
  User,
  FileText,
  Save,
  RotateCcw,
  Percent,
  Check,
  Shield,
} from 'lucide-react';

interface ContractPaymentsModalProps {
  contract: Contract;
  onClose: () => void;
  onAddPayment: (
    contractId: string,
    payment: Omit<PaymentRecord, 'id' | 'date'> & { date?: string; id?: string }
  ) => void;
  onUpdatePayment: (
    contractId: string,
    paymentId: string,
    paymentData: Partial<PaymentRecord>
  ) => void;
  onDeletePayment: (contractId: string, paymentId: string) => void;
  onUpdateFinancials: (
    contractId: string,
    financials: {
      pricePerDay?: number;
      totalAmount?: number;
      totalDays?: number;
      depositAmount?: number;
    }
  ) => void;
  currentUserName?: string;
}

export const ContractPaymentsModal: React.FC<ContractPaymentsModalProps> = ({
  contract,
  onClose,
  onAddPayment,
  onUpdatePayment,
  onDeletePayment,
  onUpdateFinancials,
  currentUserName = 'Direction',
}) => {
  // Financial edition state
  const initialPricePerDay = contract.pricePerDay !== undefined ? Number(contract.pricePerDay) : 0;
  const initialTotalDays = contract.totalDays || 1;
  const initialTotalAmount = contract.totalAmount !== undefined
    ? Number(contract.totalAmount)
    : (initialPricePerDay * initialTotalDays);

  const initialDepositAmount =
    contract.depositAmount !== undefined
      ? Number(contract.depositAmount)
      : contract.depositRecord?.amount !== undefined
      ? Number(contract.depositRecord.amount)
      : 5000;

  const [isEditingFinancials, setIsEditingFinancials] = useState<boolean>(false);
  const [editPricePerDay, setEditPricePerDay] = useState<number>(initialPricePerDay);
  const [editTotalAmount, setEditTotalAmount] = useState<number>(initialTotalAmount);
  const [editDepositAmount, setEditDepositAmount] = useState<number>(initialDepositAmount);
  const [editTotalDays, setEditTotalDays] = useState<number>(initialTotalDays);

  // Quick inline daily price editing directly in the card
  const [isEditingPricePerDayInline, setIsEditingPricePerDayInline] = useState<boolean>(false);
  const [inlineDailyPrice, setInlineDailyPrice] = useState<number>(initialPricePerDay);

  // Sync state if contract changes
  useEffect(() => {
    const p = contract.pricePerDay !== undefined ? Number(contract.pricePerDay) : 0;
    const d = contract.totalDays || 1;
    const t = contract.totalAmount !== undefined ? Number(contract.totalAmount) : (p * d);
    const dep =
      contract.depositAmount !== undefined
        ? Number(contract.depositAmount)
        : contract.depositRecord?.amount !== undefined
        ? Number(contract.depositRecord.amount)
        : 5000;
    setEditPricePerDay(p);
    setEditTotalDays(d);
    setEditTotalAmount(t);
    setEditDepositAmount(dep);
    setInlineDailyPrice(p);
  }, [contract]);

  // New payment form state
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [newAmount, setNewAmount] = useState<string>('');
  const [newMethod, setNewMethod] = useState<PaymentMethod>('cash');
  const [newDate, setNewDate] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });
  const [newNotes, setNewNotes] = useState<string>('');
  const [newReceiptNumber, setNewReceiptNumber] = useState<string>(
    `REC-${contract.contractNumber}-${(contract.payments?.length || 0) + 1}`
  );

  // Editing existing payment state
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [editPaymentAmount, setEditPaymentAmount] = useState<number>(0);
  const [editPaymentMethod, setEditPaymentMethod] = useState<PaymentMethod>('cash');
  const [editPaymentDate, setEditPaymentDate] = useState<string>('');
  const [editPaymentNotes, setEditPaymentNotes] = useState<string>('');
  const [editPaymentReceipt, setEditPaymentReceipt] = useState<string>('');

  // Confirmation for deleting
  const [confirmDeletePaymentId, setConfirmDeletePaymentId] = useState<string | null>(null);

  // Derived financial figures
  const pricePerDay = contract.pricePerDay !== undefined ? Number(contract.pricePerDay) : 0;
  const totalDays = contract.totalDays || 1;
  const totalAmount = contract.totalAmount !== undefined
    ? Number(contract.totalAmount)
    : (pricePerDay * totalDays);
  const paymentsList = contract.payments || [];
  const totalPaid = paymentsList.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
  const remaining = Math.max(0, totalAmount - totalPaid);
  const paymentPercentage = totalAmount > 0 ? Math.min(100, Math.round((totalPaid / totalAmount) * 100)) : 100;

  const handleSaveFinancials = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateFinancials(contract.id, {
      pricePerDay: Number(editPricePerDay),
      totalAmount: Number(editTotalAmount),
      totalDays: Number(editTotalDays),
      depositAmount: Number(editDepositAmount),
    });
    setIsEditingFinancials(false);
  };

  const handleSaveInlineDailyPrice = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const validRate = isNaN(inlineDailyPrice) ? 0 : Math.max(0, inlineDailyPrice);
    const newTotal = validRate * totalDays;
    onUpdateFinancials(contract.id, {
      pricePerDay: validRate,
      totalAmount: newTotal,
      totalDays: totalDays,
      depositAmount: editDepositAmount,
    });
    setIsEditingPricePerDayInline(false);
  };

  const handlePriceOrDaysChange = (pPerDay: number, days: number) => {
    const validRate = isNaN(pPerDay) ? 0 : Math.max(0, pPerDay);
    const validDays = isNaN(days) ? 1 : Math.max(1, days);
    setEditPricePerDay(validRate);
    setEditTotalDays(validDays);
    setEditTotalAmount(validRate * validDays);
  };

  const handleCreatePayment = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(newAmount);
    if (isNaN(val) || val <= 0) return;

    const formattedDate = newDate.replace('T', ' ');

    onAddPayment(contract.id, {
      amount: val,
      method: newMethod,
      date: formattedDate,
      notes: newNotes.trim() || undefined,
      receiptNumber: newReceiptNumber.trim() || undefined,
      recordedBy: currentUserName,
    });

    setNewAmount('');
    setNewNotes('');
    setShowAddForm(false);
  };

  const handleStartEditPayment = (p: PaymentRecord) => {
    setEditingPaymentId(p.id);
    setEditPaymentAmount(p.amount);
    setEditPaymentMethod(p.method);
    setEditPaymentDate(p.date.replace(' ', 'T'));
    setEditPaymentNotes(p.notes || '');
    setEditPaymentReceipt(p.receiptNumber || '');
  };

  const handleSaveEditPayment = (paymentId: string) => {
    if (editPaymentAmount <= 0) return;
    onUpdatePayment(contract.id, paymentId, {
      amount: Number(editPaymentAmount),
      method: editPaymentMethod,
      date: editPaymentDate.replace('T', ' '),
      notes: editPaymentNotes.trim(),
      receiptNumber: editPaymentReceipt.trim(),
    });
    setEditingPaymentId(null);
  };

  const methodBadge = (method: PaymentMethod) => {
    switch (method) {
      case 'cash':
        return (
          <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded text-[11px] font-semibold">
            <Banknote className="w-3 h-3" /> Espèces
          </span>
        );
      case 'tpe_card':
        return (
          <span className="inline-flex items-center gap-1 bg-blue-500/10 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded text-[11px] font-semibold">
            <CreditCard className="w-3 h-3" /> Carte TPE
          </span>
        );
      case 'virement':
        return (
          <span className="inline-flex items-center gap-1 bg-purple-500/10 text-purple-400 border border-purple-500/30 px-2 py-0.5 rounded text-[11px] font-semibold">
            <Receipt className="w-3 h-3" /> Virement
          </span>
        );
      case 'cheque':
        return (
          <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded text-[11px] font-semibold">
            <FileText className="w-3 h-3" /> Chèque
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded text-[11px] font-semibold">
            Autre
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* MODAL HEADER */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/15 border border-amber-500/30 text-amber-400 rounded-xl">
              <Banknote className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  Suivi des Règlements Clients
                </h2>
                <span className="font-mono text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded">
                  {contract.contractNumber}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Client : <strong className="text-slate-200">{contract.clientSnapshot.lastName} {contract.clientSnapshot.firstName}</strong> • {contract.vehicleSnapshot.brand} {contract.vehicleSnapshot.model} ({contract.vehicleSnapshot.plate})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* FINANCIAL SUMMARY CARDS */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-amber-400" />
              Récapitulatif &amp; Tarification du Contrat
            </span>
            <button
              onClick={() => {
                setIsEditingFinancials(!isEditingFinancials);
                setIsEditingPricePerDayInline(false);
              }}
              className="text-xs bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 hover:text-amber-200 border border-amber-500/40 px-2.5 py-1 rounded-lg flex items-center gap-1.5 font-bold transition-all shadow-xs cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5 text-amber-400" />
              {isEditingFinancials ? 'Fermer modification' : 'Modifier le tarif'}
            </button>
          </div>

          {/* EDIT FINANCIALS FORM */}
          {isEditingFinancials && (
            <form
              onSubmit={handleSaveFinancials}
              className="bg-slate-950 p-3.5 rounded-xl border border-amber-500/30 mb-3 space-y-3 animate-in fade-in"
            >
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Prix par jour (MAD)</label>
                  <input
                    type="number"
                    value={editPricePerDay}
                    onChange={(e) =>
                      handlePriceOrDaysChange(
                        e.target.value === '' ? 0 : Math.max(0, Number(e.target.value)),
                        editTotalDays
                      )
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono font-bold focus:border-amber-500 focus:outline-none"
                    placeholder="0"
                    min="0"
                  />
                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                    <span className="text-[9px] text-slate-500">Presets :</span>
                    {[0, 250, 300, 350, 400, 500].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => handlePriceOrDaysChange(preset, editTotalDays)}
                        className={`text-[9.5px] font-mono px-1 py-0.2 rounded border transition-colors cursor-pointer ${
                          editPricePerDay === preset
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold'
                            : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Nombre de jours</label>
                  <input
                    type="number"
                    value={editTotalDays}
                    onChange={(e) =>
                      handlePriceOrDaysChange(
                        editPricePerDay,
                        e.target.value === '' ? 1 : Math.max(1, Number(e.target.value))
                      )
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono font-bold focus:border-amber-500 focus:outline-none"
                    placeholder="1"
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Total Facturé (MAD)</label>
                  <input
                    type="number"
                    value={editTotalAmount}
                    onChange={(e) =>
                      setEditTotalAmount(
                        e.target.value === '' ? 0 : Math.max(0, Number(e.target.value))
                      )
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-amber-400 font-mono font-bold focus:border-amber-500 focus:outline-none"
                    placeholder="0"
                    min="0"
                  />
                  <span className="text-[9.5px] text-slate-500 font-mono block mt-1">
                    Calcul : {editPricePerDay} MAD × {editTotalDays}j = {editPricePerDay * editTotalDays} MAD
                  </span>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Caution / Dépôt (MAD)</label>
                  <input
                    type="number"
                    value={editDepositAmount}
                    onChange={(e) =>
                      setEditDepositAmount(
                        e.target.value === '' ? 0 : Math.max(0, Number(e.target.value))
                      )
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-purple-400 font-mono font-bold focus:border-amber-500 focus:outline-none"
                    placeholder="0"
                    min="0"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsEditingFinancials(false)}
                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1 cursor-pointer"
                >
                  <Save className="w-3 h-3" /> Enregistrer les montants
                </button>
              </div>
            </form>
          )}

          {/* 4 FINANCIAL METRICS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* TOTAL FACTURÉ */}
            {isEditingPricePerDayInline ? (
              <div className="bg-slate-950 p-3.5 rounded-xl border-2 border-amber-500/70 shadow-lg shadow-amber-500/10 flex flex-col justify-between animate-in fade-in">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                  <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Edit2 className="w-3 h-3" /> Modifier Prix / Jour
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsEditingPricePerDayInline(false)}
                    className="text-slate-400 hover:text-white p-0.5 rounded cursor-pointer"
                    title="Fermer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <form onSubmit={handleSaveInlineDailyPrice} className="space-y-2 mt-2">
                  <div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                      <span>Tarif journalier (MAD) :</span>
                      <span className="text-slate-400 font-mono font-semibold">{totalDays} jour(s)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="relative flex-1">
                        <input
                          type="number"
                          min="0"
                          value={inlineDailyPrice}
                          onChange={(e) => {
                            const val = e.target.value === '' ? 0 : Math.max(0, Number(e.target.value));
                            setInlineDailyPrice(val);
                          }}
                          className="w-full bg-slate-900 border border-amber-500/60 rounded-lg px-2.5 py-1.5 text-white font-mono font-black text-sm focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-500 pr-12"
                          placeholder="0"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') setIsEditingPricePerDayInline(false);
                          }}
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono text-amber-400 font-bold">
                          MAD/j
                        </span>
                      </div>
                      <button
                        type="submit"
                        className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-lg text-xs flex items-center gap-1 shadow cursor-pointer transition-colors"
                        title="Valider et recalculer"
                      >
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                        <span>Valider</span>
                      </button>
                    </div>
                  </div>

                  {/* Boutons rapides */}
                  <div className="flex items-center gap-1 flex-wrap pt-0.5">
                    <span className="text-[9px] text-slate-500">Rapide:</span>
                    {[0, 250, 300, 350, 400, 500].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setInlineDailyPrice(preset)}
                        className={`text-[9.5px] font-mono px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
                          inlineDailyPrice === preset
                            ? 'bg-amber-500/25 text-amber-300 border-amber-500/50 font-bold'
                            : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>

                  <div className="text-[10px] font-mono text-slate-400 pt-1 border-t border-slate-800 flex items-center justify-between">
                    <span>Nouveau Total :</span>
                    <strong className="text-amber-400 font-black text-xs">
                      {(inlineDailyPrice * totalDays).toLocaleString('fr-FR')} MAD
                    </strong>
                  </div>
                </form>
              </div>
            ) : (
              <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 flex flex-col justify-between hover:border-slate-700 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Total Facturé Location
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setInlineDailyPrice(pricePerDay);
                      setIsEditingPricePerDayInline(true);
                      setIsEditingFinancials(false);
                    }}
                    className="text-[10.5px] text-amber-300 hover:text-amber-200 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 px-2 py-0.5 rounded-md flex items-center gap-1 font-bold transition-all cursor-pointer shadow-2xs"
                    title="Modifier directement le tarif journalier"
                  >
                    <Edit2 className="w-2.5 h-2.5" /> Modifier tarif
                  </button>
                </div>
                <p className="font-mono text-xl font-black text-white mt-1">
                  {totalAmount.toLocaleString('fr-FR')} <span className="text-xs font-normal text-slate-400">MAD</span>
                </p>
                <div className="text-[10px] text-slate-500 mt-1 flex items-center justify-between flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setInlineDailyPrice(pricePerDay);
                      setIsEditingPricePerDayInline(true);
                      setIsEditingFinancials(false);
                    }}
                    className="inline-flex items-center gap-1 font-mono text-slate-300 hover:text-amber-300 bg-slate-900/90 hover:bg-amber-500/10 px-2 py-0.5 rounded border border-slate-700/80 hover:border-amber-500/40 transition-colors cursor-pointer group"
                    title="Cliquer pour modifier le prix par jour"
                  >
                    <span>{totalDays} jour(s) • <strong className="text-amber-400 font-bold">{pricePerDay} MAD/j</strong></span>
                    <Edit2 className="w-2.5 h-2.5 text-amber-400 group-hover:scale-110 transition-transform" />
                  </button>
                  <span>TVA 20% incluse</span>
                </div>
              </div>
            )}

            {/* DÉJÀ ENCAISSÉ */}
            <div className="bg-slate-950/80 p-3.5 rounded-xl border border-emerald-500/30 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                  Total Déjà Encaissé
                </span>
                <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/30">
                  {paymentPercentage}%
                </span>
              </div>
              <p className="font-mono text-xl font-black text-emerald-400 mt-1">
                {totalPaid.toLocaleString('fr-FR')} <span className="text-xs font-normal text-emerald-500">MAD</span>
              </p>
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-2">
                <div
                  className="bg-emerald-500 h-full transition-all duration-300"
                  style={{ width: `${paymentPercentage}%` }}
                />
              </div>
            </div>

            {/* RESTE À PAYER */}
            <div
              className={`p-3.5 rounded-xl border flex flex-col justify-between ${
                remaining > 0
                  ? 'bg-rose-950/20 border-rose-500/30'
                  : 'bg-emerald-950/20 border-emerald-500/30'
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-[11px] font-bold uppercase tracking-wider ${
                    remaining > 0 ? 'text-rose-400' : 'text-emerald-400'
                  }`}
                >
                  Reste à Encaisser
                </span>
                {remaining === 0 ? (
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 rounded flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> {totalAmount === 0 ? 'Soldé (0 MAD)' : 'Soldé'}
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/30 px-1.5 py-0.5 rounded flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> En attente
                  </span>
                )}
              </div>
              <p
                className={`font-mono text-xl font-black mt-1 ${
                  remaining > 0 ? 'text-rose-400' : 'text-emerald-400'
                }`}
              >
                {remaining.toLocaleString('fr-FR')} <span className="text-xs font-normal opacity-80">MAD</span>
              </p>
              <span className="text-[10px] text-slate-400 mt-1">
                {remaining > 0
                  ? 'Paiement à réclamer avant restitution'
                  : 'Totalité du montant réglée par le client'}
              </span>
            </div>

            {/* CAUTION DE GARANTIE */}
            <div className="bg-slate-950/80 p-3.5 rounded-xl border border-purple-500/30 flex flex-col justify-between hover:border-purple-500/50 transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1">
                  <Shield className="w-3 h-3 text-purple-400" /> Caution / Dépôt
                </span>
                <button
                  type="button"
                  onClick={() => setIsEditingFinancials(true)}
                  className="text-[10px] text-purple-300 hover:text-purple-200 bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 px-2 py-0.5 rounded-md flex items-center gap-1 font-bold transition-all cursor-pointer"
                  title="Modifier le montant de la caution"
                >
                  <Edit2 className="w-2.5 h-2.5" /> Modifier
                </button>
              </div>
              <p className="font-mono text-xl font-black text-purple-400 mt-1">
                {(contract.depositAmount !== undefined
                  ? contract.depositAmount
                  : (contract.depositRecord?.amount ?? 5000)
                ).toLocaleString('fr-FR')}{' '}
                <span className="text-xs font-normal text-purple-300">MAD</span>
              </p>
              <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
                <span className="truncate max-w-[125px]" title={contract.depositRecord?.methodDetails || 'Empreinte bancaire TPE'}>
                  {contract.depositRecord?.method === 'cheque'
                    ? 'Chèque de caution'
                    : contract.depositRecord?.method === 'cash'
                    ? 'Espèces consignées'
                    : contract.depositRecord?.method === 'virement'
                    ? 'Virement bancaire'
                    : 'Empreinte TPE'}
                </span>
                <span className="text-emerald-400 font-mono text-[9px] bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/30">
                  {contract.depositRecord?.status === 'released' ? 'Restituée' : 'Détenue'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* PAYMENTS HISTORY LIST & ACTIONS */}
        <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Historique des Encaissements ({paymentsList.length})
              </h3>
              <p className="text-[11px] text-slate-500">
                Tous les versements enregistrés pour ce contrat (Espèces, TPE, Virement, Chèque).
              </p>
            </div>
            {!showAddForm && (
              <button
                onClick={() => {
                  setShowAddForm(true);
                  if (remaining > 0) {
                    setNewAmount(String(remaining));
                  }
                }}
                className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs shadow-md transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                + Encaisser un Versement
              </button>
            )}
          </div>

          {/* ADD PAYMENT ACCORDION FORM */}
          {showAddForm && (
            <form
              onSubmit={handleCreatePayment}
              className="bg-slate-950 p-4 rounded-xl border border-amber-500/40 space-y-3 animate-in fade-in"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                  <Banknote className="w-4 h-4" />
                  Nouveau Versement Client
                </span>
                {remaining > 0 && (
                  <button
                    type="button"
                    onClick={() => setNewAmount(String(remaining))}
                    className="text-[11px] text-amber-400/90 hover:text-amber-300 underline font-medium cursor-pointer"
                  >
                    Remplir le reste ({remaining} MAD)
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Montant Versé (MAD) *</label>
                  <input
                    type="number"
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    placeholder={remaining > 0 ? String(remaining) : '1000'}
                    required
                    min="1"
                    step="any"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono font-bold text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Mode de Paiement *</label>
                  <select
                    value={newMethod}
                    onChange={(e) => setNewMethod(e.target.value as PaymentMethod)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-semibold focus:border-amber-500 focus:outline-none cursor-pointer"
                  >
                    <option value="cash">💵 Espèces (Cash)</option>
                    <option value="tpe_card">💳 Carte Bancaire (TPE)</option>
                    <option value="virement">🏦 Virement Bancaire</option>
                    <option value="cheque">📄 Chèque Bancaire</option>
                    <option value="autre">Autre moyen</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Date &amp; Heure du Paiement *</label>
                  <input
                    type="datetime-local"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    required
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">N° Reçu / Référence (Optionnel)</label>
                  <input
                    type="text"
                    value={newReceiptNumber}
                    onChange={(e) => setNewReceiptNumber(e.target.value)}
                    placeholder={`REC-${contract.contractNumber}-1`}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 font-mono text-xs focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Note / Commentaire (Optionnel)</label>
                  <input
                    type="text"
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    placeholder="Ex: Acompte initial versé à la signature"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-xs focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs cursor-pointer font-medium"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Valider l'Encaissement
                </button>
              </div>
            </form>
          )}

          {/* PAYMENTS TABLE OR EMPTY STATE */}
          {paymentsList.length === 0 ? (
            <div className="text-center py-10 bg-slate-950/40 rounded-xl border border-dashed border-slate-800 p-6">
              <Banknote className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-400">Aucun règlement enregistré</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Le montant total de {totalAmount.toLocaleString('fr-FR')} MAD reste à percevoir. Cliquez sur "Encaisser un Versement" pour consigner le premier acompte.
              </p>
              <button
                onClick={() => {
                  setShowAddForm(true);
                  if (remaining > 0) setNewAmount(String(remaining));
                }}
                className="mt-4 inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs cursor-pointer shadow-md"
              >
                <Plus className="w-3.5 h-3.5" /> Encaisser le premier acompte
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {paymentsList.map((payment, idx) => {
                const isEditing = editingPaymentId === payment.id;
                return (
                  <div
                    key={payment.id || idx}
                    className="bg-slate-950/60 border border-slate-800 hover:border-slate-700/80 rounded-xl p-3.5 transition-colors"
                  >
                    {isEditing ? (
                      /* INLINE EDIT FORM */
                      <div className="space-y-3 animate-in fade-in">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                          <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
                            <Edit2 className="w-3.5 h-3.5" /> Modification du versement #{idx + 1}
                          </span>
                          <span className="text-[10px] font-mono text-slate-500">ID: {payment.id}</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                          <div>
                            <label className="block text-slate-400 mb-1">Montant (MAD)</label>
                            <input
                              type="number"
                              value={editPaymentAmount}
                              onChange={(e) => setEditPaymentAmount(Number(e.target.value))}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono font-bold focus:border-amber-500 focus:outline-none"
                              min="0"
                            />
                          </div>
                          <div>
                            <label className="block text-slate-400 mb-1">Mode de règlement</label>
                            <select
                              value={editPaymentMethod}
                              onChange={(e) => setEditPaymentMethod(e.target.value as PaymentMethod)}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:border-amber-500 focus:outline-none cursor-pointer"
                            >
                              <option value="cash">Espèces</option>
                              <option value="tpe_card">Carte TPE</option>
                              <option value="virement">Virement</option>
                              <option value="cheque">Chèque</option>
                              <option value="autre">Autre</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-slate-400 mb-1">Date & Heure</label>
                            <input
                              type="datetime-local"
                              value={editPaymentDate}
                              onChange={(e) => setEditPaymentDate(e.target.value)}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono focus:border-amber-500 focus:outline-none"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          <div>
                            <label className="block text-slate-400 mb-1">N° Reçu</label>
                            <input
                              type="text"
                              value={editPaymentReceipt}
                              onChange={(e) => setEditPaymentReceipt(e.target.value)}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono focus:border-amber-500 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-slate-400 mb-1">Commentaire</label>
                            <input
                              type="text"
                              value={editPaymentNotes}
                              onChange={(e) => setEditPaymentNotes(e.target.value)}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:border-amber-500 focus:outline-none"
                            />
                          </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                          <button
                            type="button"
                            onClick={() => setEditingPaymentId(null)}
                            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs cursor-pointer"
                          >
                            Annuler
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEditPayment(payment.id)}
                            className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded text-xs flex items-center gap-1 cursor-pointer"
                          >
                            <Save className="w-3 h-3" /> Sauvegarder
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* PAYMENT ROW READOUT */
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start sm:items-center gap-3">
                          <div className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-amber-400 shrink-0 font-mono font-bold text-xs">
                            #{idx + 1}
                          </div>

                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-base font-black text-white">
                                {Number(payment.amount).toLocaleString('fr-FR')} MAD
                              </span>
                              {methodBadge(payment.method)}
                              {payment.receiptNumber && (
                                <span className="text-[10px] font-mono text-slate-400 bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded">
                                  {payment.receiptNumber}
                                </span>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400 mt-1">
                              <span className="flex items-center gap-1 font-mono">
                                <Calendar className="w-3 h-3 text-slate-500" />
                                {payment.date}
                              </span>
                              {payment.recordedBy && (
                                <span className="flex items-center gap-1 text-slate-400">
                                  <User className="w-3 h-3 text-slate-500" />
                                  Par {payment.recordedBy}
                                </span>
                              )}
                            </div>

                            {payment.notes && (
                              <p className="text-[11px] text-slate-400 italic mt-1 bg-slate-900/60 px-2 py-1 rounded border border-slate-850">
                                « {payment.notes} »
                              </p>
                            )}
                          </div>
                        </div>

                        {/* ROW ACTIONS */}
                        <div className="flex items-center justify-end gap-1.5 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800">
                          <button
                            onClick={() => handleStartEditPayment(payment)}
                            className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-amber-400 border border-slate-800 hover:border-slate-700 rounded-lg transition-colors cursor-pointer"
                            title="Modifier ce paiement"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {confirmDeletePaymentId === payment.id ? (
                            <div className="flex items-center gap-1 bg-rose-950/80 border border-rose-500/40 p-1 rounded-lg">
                              <span className="text-[10px] text-rose-300 font-semibold px-1">Supprimer ?</span>
                              <button
                                onClick={() => {
                                  onDeletePayment(contract.id, payment.id);
                                  setConfirmDeletePaymentId(null);
                                }}
                                className="px-2 py-0.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-[10px] font-bold cursor-pointer"
                              >
                                Oui
                              </button>
                              <button
                                onClick={() => setConfirmDeletePaymentId(null)}
                                className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded text-[10px] cursor-pointer"
                              >
                                Non
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDeletePaymentId(payment.id)}
                              className="p-1.5 bg-slate-900 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-500/30 rounded-lg transition-colors cursor-pointer"
                              title="Supprimer ce paiement"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs">
          <div className="text-slate-400 flex items-center gap-2">
            <span>Statut global :</span>
            {remaining <= 0 ? (
              <span className="font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded">
                ✓ Intégralement Payé
              </span>
            ) : totalPaid > 0 ? (
              <span className="font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded">
                ⚡ Versement Partiel ({remaining} MAD restant)
              </span>
            ) : (
              <span className="font-bold text-rose-400 bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 rounded">
                ✕ Non Payé ({totalAmount} MAD restant)
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
