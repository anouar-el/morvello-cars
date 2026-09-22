import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  DepositRecord,
  DepositStatus,
  DepositMethod,
  DepositDeduction,
  Contract,
} from '../types';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  CreditCard,
  Banknote,
  FileCheck2,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  MinusCircle,
  Plus,
  Eye,
  Printer,
  Calendar,
  DollarSign,
  User,
  Car,
  FileText,
  X,
  Sparkles,
  Edit2,
  Save,
} from 'lucide-react';
import { formatPlateFrench } from '../utils/plateUtils';
import { isDepositOwnedByManager } from '../utils/managerScopeUtils';

export const DepositsManagement: React.FC = () => {
  const {
    deposits,
    releaseDeposit,
    deductDeposit,
    updateDeposit,
    contracts,
    vehicles,
    openPdfModal,
    addAuditLog,
    currentUser,
  } = useApp();

  const isManager = currentUser?.role === 'manager';

  // Cloisonnement strict des cautions selon le rôle & le responsable
  const visibleDeposits = deposits.filter((d) => {
    if (isManager && currentUser) {
      return isDepositOwnedByManager(d, currentUser.id, contracts, vehicles, currentUser.name);
    }
    return true;
  });

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [methodFilter, setMethodFilter] = useState<string>('all');

  // Modals state
  const [selectedDepositForRelease, setSelectedDepositForRelease] = useState<DepositRecord | null>(null);
  const [releaseAmount, setReleaseAmount] = useState<number>(0);
  const [releaseNotes, setReleaseNotes] = useState<string>('');

  const [selectedDepositForDeduct, setSelectedDepositForDeduct] = useState<DepositRecord | null>(null);
  const [deductionAmount, setDeductionAmount] = useState<number>(300);
  const [deductionCategory, setDeductionCategory] = useState<string>('carburant');
  const [deductionLabel, setDeductionLabel] = useState<string>('Carburant manquant (restitution réservoir)');
  const [refundRemainingImmediately, setRefundRemainingImmediately] = useState<boolean>(true);

  // Edit deposit modal state
  const [selectedDepositForEdit, setSelectedDepositForEdit] = useState<DepositRecord | null>(null);
  const [editAmount, setEditAmount] = useState<number>(5000);
  const [editMethod, setEditMethod] = useState<DepositMethod>('preauth_card');
  const [editMethodDetails, setEditMethodDetails] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');

  // Receipt modal
  const [receiptDeposit, setReceiptDeposit] = useState<DepositRecord | null>(null);

  // Stats calculation
  const totalHeldAmount = visibleDeposits
    .filter((d) => d.status === 'held')
    .reduce((sum, d) => sum + d.amount, 0);

  const totalDeductionsAmount = visibleDeposits.reduce((sum, d) => {
    return sum + d.deductions.reduce((dSum, item) => dSum + item.amount, 0);
  }, 0);

  const totalReleasedAmount = visibleDeposits
    .filter((d) => d.status === 'released')
    .reduce((sum, d) => sum + (d.refundedAmount || d.amount), 0);

  const cardPreauthCount = visibleDeposits.filter((d) => d.method === 'preauth_card' && d.status === 'held').length;
  const chequeCount = visibleDeposits.filter((d) => d.method === 'cheque' && d.status === 'held').length;
  const cashCount = visibleDeposits.filter((d) => d.method === 'cash' && d.status === 'held').length;

  // Filtered deposits
  const filteredDeposits = visibleDeposits.filter((d) => {
    if (statusFilter !== 'all' && d.status !== statusFilter) return false;
    if (methodFilter !== 'all' && d.method !== methodFilter) return false;

    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;

    return (
      d.contractNumber.toLowerCase().includes(q) ||
      d.clientName.toLowerCase().includes(q) ||
      d.clientPhone.toLowerCase().includes(q) ||
      d.vehicleName.toLowerCase().includes(q) ||
      d.vehiclePlate.toLowerCase().includes(q) ||
      (d.methodDetails && d.methodDetails.toLowerCase().includes(q))
    );
  });

  const getMethodBadge = (method: DepositMethod, details?: string) => {
    switch (method) {
      case 'preauth_card':
        return (
          <span className="inline-flex items-center gap-1.5 bg-blue-500/10 text-blue-400 border border-blue-500/30 px-2.5 py-1 rounded-full text-xs font-semibold">
            <CreditCard className="w-3.5 h-3.5" />
            Empreinte TPE (CB)
          </span>
        );
      case 'cheque':
        return (
          <span className="inline-flex items-center gap-1.5 bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2.5 py-1 rounded-full text-xs font-semibold">
            <FileCheck2 className="w-3.5 h-3.5" />
            Chèque de Garantie
          </span>
        );
      case 'cash':
        return (
          <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-full text-xs font-semibold">
            <Banknote className="w-3.5 h-3.5" />
            Espèces (Séquestre)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 bg-slate-800 text-slate-300 border border-slate-700 px-2.5 py-1 rounded-full text-xs font-semibold">
            Virement / Autre
          </span>
        );
    }
  };

  const getStatusBadge = (status: DepositStatus) => {
    switch (status) {
      case 'held':
        return (
          <span className="inline-flex items-center gap-1.5 bg-amber-500/15 text-amber-400 border border-amber-500/30 px-2.5 py-1 rounded-full text-xs font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
            En cours (Détenue)
          </span>
        );
      case 'released':
        return (
          <span className="inline-flex items-center gap-1.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-full text-xs font-bold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Restituée Intégralement
          </span>
        );
      case 'partially_deducted':
        return (
          <span className="inline-flex items-center gap-1.5 bg-orange-500/15 text-orange-400 border border-orange-500/30 px-2.5 py-1 rounded-full text-xs font-bold">
            <MinusCircle className="w-3.5 h-3.5" />
            Déduction Partielle
          </span>
        );
      case 'fully_retained':
        return (
          <span className="inline-flex items-center gap-1.5 bg-red-500/15 text-red-400 border border-red-500/30 px-2.5 py-1 rounded-full text-xs font-bold">
            <AlertTriangle className="w-3.5 h-3.5" />
            Retenue Totale (Sinistre)
          </span>
        );
      default:
        return null;
    }
  };

  // Open release modal
  const handleOpenReleaseModal = (dep: DepositRecord) => {
    const totalDeducted = dep.deductions.reduce((s, i) => s + i.amount, 0);
    const remainder = Math.max(0, dep.amount - totalDeducted);
    setSelectedDepositForRelease(dep);
    setReleaseAmount(remainder);
    setReleaseNotes('Restitution de la caution après vérification du véhicule conforme.');
  };

  const handleConfirmRelease = () => {
    if (!selectedDepositForRelease) return;
    releaseDeposit(selectedDepositForRelease.id, releaseAmount, releaseNotes);
    setSelectedDepositForRelease(null);
  };

  // Open deduct modal
  const handleOpenDeductModal = (dep: DepositRecord) => {
    setSelectedDepositForDeduct(dep);
    setDeductionAmount(300);
    setDeductionCategory('carburant');
    setDeductionLabel('Carburant manquant (restitution réservoir)');
    setRefundRemainingImmediately(true);
  };

  const handleConfirmDeduct = () => {
    if (!selectedDepositForDeduct) return;
    deductDeposit(
      selectedDepositForDeduct.id,
      {
        amount: deductionAmount,
        reason: deductionCategory as any,
        label: deductionLabel,
      },
      refundRemainingImmediately
    );
    setSelectedDepositForDeduct(null);
  };

  // Open edit modal
  const handleOpenEditModal = (dep: DepositRecord) => {
    setSelectedDepositForEdit(dep);
    setEditAmount(dep.amount);
    setEditMethod(dep.method);
    setEditMethodDetails(dep.methodDetails || '');
    setEditNotes(dep.notes || '');
  };

  const handleConfirmEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDepositForEdit) return;
    updateDeposit(selectedDepositForEdit.id, {
      amount: Math.max(0, Number(editAmount) || 0),
      method: editMethod,
      methodDetails: editMethodDetails,
      notes: editNotes,
    });
    setSelectedDepositForEdit(null);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-wide">
                Gestion & Suivi des Cautions
              </h1>
              <p className="text-xs text-slate-400">
                Dépôts de garantie, empreintes TPE, chèques, restitutions & retenues contractuelles
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI METRICS OVERVIEW */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* EN COURS */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Cautions Détenues (En cours)</span>
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
          </div>
          <p className="font-mono text-xl sm:text-2xl font-bold text-amber-400 mt-2">
            {totalHeldAmount.toLocaleString('fr-FR')}{' '}
            <span className="text-xs font-normal text-slate-400">MAD</span>
          </p>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2">
            <span>{cardPreauthCount} CB</span> • <span>{chequeCount} Chèques</span> •{' '}
            <span>{cashCount} Espèces</span>
          </div>
        </div>

        {/* DÉDUCTIONS RETENUES */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Total Déductions & Pénalités</span>
            <MinusCircle className="w-4 h-4 text-orange-400" />
          </div>
          <p className="font-mono text-xl sm:text-2xl font-bold text-orange-400 mt-2">
            {totalDeductionsAmount.toLocaleString('fr-FR')}{' '}
            <span className="text-xs font-normal text-slate-400">MAD</span>
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Carburant, franchise dégâts, retards</p>
        </div>

        {/* RESTITUÉES */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Cautions Restituées</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="font-mono text-xl sm:text-2xl font-bold text-emerald-400 mt-2">
            {totalReleasedAmount.toLocaleString('fr-FR')}{' '}
            <span className="text-xs font-normal text-slate-400">MAD</span>
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Restituées aux clients après inspection</p>
        </div>

        {/* TOTAL DOSSIERS */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{isManager ? 'Mes Dossiers Cautions' : 'Dossiers de Cautions'}</span>
            <FileText className="w-4 h-4 text-blue-400" />
          </div>
          <p className="font-mono text-xl sm:text-2xl font-bold text-white mt-2">
            {visibleDeposits.length}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            {visibleDeposits.filter((d) => d.status === 'held').length} actives sous contrat
          </p>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher par client, N° contrat, immatriculation, véhicule..."
            className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* STATUS PILLS */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
          {[
            { id: 'all', label: 'Tous' },
            { id: 'held', label: 'En cours' },
            { id: 'released', label: 'Restituées' },
            { id: 'partially_deducted', label: 'Déduites' },
            { id: 'fully_retained', label: 'Retenues' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* METHOD FILTER */}
        <select
          value={methodFilter}
          onChange={(e) => setMethodFilter(e.target.value)}
          className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
        >
          <option value="all">Toutes méthodes</option>
          <option value="preauth_card">Empreinte CB (TPE)</option>
          <option value="check">Chèque</option>
          <option value="cash">Espèces</option>
        </select>
      </div>

      {/* DEPOSITS TABLE */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/70 text-slate-400 uppercase text-[10px] font-semibold border-b border-slate-800">
              <tr>
                <th className="px-4 py-3.5">Contrat & Date</th>
                <th className="px-4 py-3.5">Client & Contact</th>
                <th className="px-4 py-3.5">Véhicule & Immat</th>
                <th className="px-4 py-3.5">Mode de Garantie</th>
                <th className="px-4 py-3.5">Montant Caution</th>
                <th className="px-4 py-3.5">Statut & Déductions</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredDeposits.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500 text-xs">
                    Aucune caution ne correspond aux critères de recherche.
                  </td>
                </tr>
              ) : (
                filteredDeposits.map((dep) => {
                  const matchingContract = contracts.find((c) => c.id === dep.contractId || c.contractNumber === dep.contractNumber);
                  const totalDeducted = dep.deductions.reduce((sum, item) => sum + item.amount, 0);

                  return (
                    <tr key={dep.id} className="hover:bg-slate-850/60 transition-colors">
                      {/* CONTRAT & DATE */}
                      <td className="px-4 py-3.5">
                        <div className="font-mono font-bold text-amber-400 text-sm">
                          {dep.contractNumber}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          Enregistré le : {dep.receivedAt}
                        </div>
                        <div className="text-[9px] text-slate-500">
                          Agent : {dep.receivedBy}
                        </div>
                      </td>

                      {/* CLIENT */}
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-white uppercase">{dep.clientName}</div>
                        <div className="text-[10px] text-amber-400/90 font-medium mt-0.5">
                          📞 {dep.clientPhone}
                        </div>
                      </td>

                      {/* VÉHICULE */}
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-white uppercase">{dep.vehicleName}</div>
                        <div className="font-mono text-[11px] text-amber-400 font-bold mt-0.5">
                          {formatPlateFrench(dep.vehiclePlate)}
                        </div>
                      </td>

                      {/* MODE DE GARANTIE */}
                      <td className="px-4 py-3.5">
                        {getMethodBadge(dep.method, dep.methodDetails)}
                        {dep.methodDetails && (
                          <div className="text-[10px] text-slate-400 mt-1 truncate max-w-[150px]">
                            {dep.methodDetails}
                          </div>
                        )}
                      </td>

                      {/* MONTANT */}
                      <td className="px-4 py-3.5">
                        <div className="font-mono font-bold text-white text-sm">
                          {dep.amount.toLocaleString('fr-FR')} MAD
                        </div>
                        {dep.refundedAmount !== undefined && dep.status !== 'held' && (
                          <div className="text-[10px] text-emerald-400 font-mono">
                            Remboursé : {dep.refundedAmount.toLocaleString('fr-FR')} MAD
                          </div>
                        )}
                      </td>

                      {/* STATUT & DÉDUCTIONS */}
                      <td className="px-4 py-3.5">
                        {getStatusBadge(dep.status)}
                        {dep.deductions.length > 0 && (
                          <div className="mt-1 space-y-0.5">
                            {dep.deductions.map((ded) => (
                              <div
                                key={ded.id}
                                className="text-[10px] text-orange-300 font-mono flex items-center gap-1"
                              >
                                <span>- {ded.amount} MAD</span>
                                <span className="text-slate-400 font-sans">({ded.label})</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {dep.releasedAt && (
                          <div className="text-[9.5px] text-slate-500 mt-1">
                            Restitué le {dep.releasedAt} par {dep.releasedBy}
                          </div>
                        )}
                      </td>

                      {/* ACTIONS */}
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* 1. RESTITUER LA CAUTION (If held or partially deducted) */}
                          {dep.status === 'held' && (
                            <button
                              onClick={() => handleOpenReleaseModal(dep)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                              title="Restituer la caution au client"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Restituer</span>
                            </button>
                          )}

                          {/* 2. APPLIQUER UNE DÉDUCTION */}
                          {(dep.status === 'held' || dep.status === 'partially_deducted') && (
                            <button
                              onClick={() => handleOpenDeductModal(dep)}
                              className="px-2.5 py-1 rounded-lg bg-orange-600/20 hover:bg-orange-600/30 text-orange-300 border border-orange-500/40 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                              title="Déduire un montant pour carburant manquant ou franchise"
                            >
                              <MinusCircle className="w-3.5 h-3.5" />
                              <span>Déduire</span>
                            </button>
                          )}

                          {/* MODIFIER LA CAUTION */}
                          <button
                            onClick={() => handleOpenEditModal(dep)}
                            className="p-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 hover:text-purple-200 border border-purple-500/30 text-xs transition-colors cursor-pointer"
                            title="Modifier le montant ou le mode de garantie de la caution"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* 3. REÇU / DÉCHARGE */}
                          <button
                            onClick={() => setReceiptDeposit(dep)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs transition-colors cursor-pointer"
                            title="Voir la décharge / reçu de caution"
                          >
                            <Printer className="w-3.5 h-3.5 text-amber-400" />
                          </button>

                          {/* 4. VOIR LE CONTRAT */}
                          {matchingContract && (
                            <button
                              onClick={() => openPdfModal(matchingContract)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs transition-colors cursor-pointer"
                              title="Voir le contrat A4 complet"
                            >
                              <Eye className="w-3.5 h-3.5 text-blue-400" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: RESTITUER LA CAUTION */}
      {selectedDepositForRelease && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-slate-950 px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Restitution de la Caution</h3>
              </div>
              <button
                onClick={() => setSelectedDepositForRelease(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Contrat :</span>
                  <span className="font-mono font-bold text-amber-400">
                    {selectedDepositForRelease.contractNumber}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Client :</span>
                  <span className="font-semibold text-white">
                    {selectedDepositForRelease.clientName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Montant initial bloqué :</span>
                  <span className="font-mono font-bold text-white">
                    {selectedDepositForRelease.amount.toLocaleString('fr-FR')} MAD
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Montant à restituer au client (MAD) * :
                </label>
                <input
                  type="number"
                  value={releaseAmount}
                  onChange={(e) => setReleaseAmount(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold text-sm focus:border-amber-500 focus:outline-none"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  En cas d'empreinte bancaire, cette action correspond à l'annulation de la pré-autorisation TPE.
                </p>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Observation / Motif de restitution :
                </label>
                <textarea
                  value={releaseNotes}
                  onChange={(e) => setReleaseNotes(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  onClick={() => setSelectedDepositForRelease(null)}
                  className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white"
                >
                  Annuler
                </button>
                <button
                  onClick={handleConfirmRelease}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirmer la Restitution</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: APPLIQUER UNE DÉDUCTION */}
      {selectedDepositForDeduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-slate-950 px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MinusCircle className="w-5 h-5 text-orange-400" />
                <h3 className="text-sm font-bold text-white">Appliquer une Déduction sur Caution</h3>
              </div>
              <button
                onClick={() => setSelectedDepositForDeduct(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Contrat :</span>
                  <span className="font-mono font-bold text-amber-400">
                    {selectedDepositForDeduct.contractNumber}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Solde caution disponible :</span>
                  <span className="font-mono font-bold text-white">
                    {selectedDepositForDeduct.amount.toLocaleString('fr-FR')} MAD
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Motif de la déduction :</label>
                <select
                  value={deductionCategory}
                  onChange={(e) => {
                    setDeductionCategory(e.target.value);
                    if (e.target.value === 'carburant') {
                      setDeductionLabel('Carburant manquant (restitution réservoir)');
                      setDeductionAmount(350);
                    } else if (e.target.value === 'penalite_retard') {
                      setDeductionLabel('Pénalité de retard de restitution (+2 heures)');
                      setDeductionAmount(400);
                    } else if (e.target.value === 'degats_carrosserie') {
                      setDeductionLabel('Franchise / Réparation rayure aile');
                      setDeductionAmount(1200);
                    } else if (e.target.value === 'nettoyage') {
                      setDeductionLabel('Nettoyage pressing intérieur intensif');
                      setDeductionAmount(250);
                    } else if (e.target.value === 'amende_pv') {
                      setDeductionLabel('Règlement PV / Excès de vitesse radar');
                      setDeductionAmount(300);
                    }
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                >
                  <option value="carburant">Carburant manquant</option>
                  <option value="degats_carrosserie">Dégâts carrosserie / Franchise</option>
                  <option value="penalite_retard">Pénalité de retard de restitution</option>
                  <option value="nettoyage">Frais de lavage / Pressing habitacle</option>
                  <option value="amende_pv">Amende / Contravention</option>
                  <option value="autre">Autre motif</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Libellé précis :</label>
                <input
                  type="text"
                  value={deductionLabel}
                  onChange={(e) => setDeductionLabel(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Montant de la retenue (MAD) * :
                </label>
                <input
                  type="number"
                  value={deductionAmount}
                  onChange={(e) => setDeductionAmount(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-orange-400 font-mono font-bold text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>

              <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-800 bg-slate-950 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={refundRemainingImmediately}
                  onChange={(e) => setRefundRemainingImmediately(e.target.checked)}
                  className="rounded border-slate-700 text-amber-500 focus:ring-0"
                />
                <span className="text-slate-300">
                  Restituer immédiatement le solde restant ({Math.max(0, selectedDepositForDeduct.amount - deductionAmount)} MAD) au client
                </span>
              </label>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  onClick={() => setSelectedDepositForDeduct(null)}
                  className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white"
                >
                  Annuler
                </button>
                <button
                  onClick={handleConfirmDeduct}
                  className="bg-orange-600 hover:bg-orange-500 text-white font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-md shadow-orange-600/20 cursor-pointer"
                >
                  <MinusCircle className="w-4 h-4" />
                  <span>Confirmer la Retenue</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: MODIFIER LE MONTANT / MODE DE LA CAUTION */}
      {selectedDepositForEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-slate-950 px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-purple-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">Modifier la Caution</h3>
                  <p className="text-[10px] text-slate-400 font-mono">
                    Contrat : {selectedDepositForEdit.contractNumber}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDepositForEdit(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmEdit} className="p-5 space-y-4 text-xs">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                <div className="flex justify-between text-slate-400">
                  <span>Client :</span>
                  <span className="font-bold text-white uppercase">{selectedDepositForEdit.clientName}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Véhicule :</span>
                  <span className="text-white font-mono">{selectedDepositForEdit.vehicleName} ({formatPlateFrench(selectedDepositForEdit.vehiclePlate)})</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Montant actuel :</span>
                  <span className="font-bold text-purple-400 font-mono">{selectedDepositForEdit.amount.toLocaleString('fr-FR')} MAD</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Nouveau Montant de la Caution (MAD) * :
                </label>
                <input
                  type="number"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value === '' ? 0 : Math.max(0, Number(e.target.value)))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-purple-400 font-mono font-bold text-base focus:border-purple-500 focus:outline-none"
                  min="0"
                  required
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Indiquez 0 MAD si dispense de caution ou garantie par convention.
                </span>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Mode de Garantie / Règlement :
                </label>
                <select
                  value={editMethod}
                  onChange={(e) => setEditMethod(e.target.value as DepositMethod)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-purple-500 focus:outline-none"
                >
                  <option value="preauth_card">Empreinte Bancaire TPE (CB)</option>
                  <option value="cheque">Chèque de Garantie</option>
                  <option value="cash">Espèces (Séquestre)</option>
                  <option value="virement">Virement Bancaire</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Référence / Détails (N° Autorisation TPE, Banque, N° Chèque) :
                </label>
                <input
                  type="text"
                  value={editMethodDetails}
                  onChange={(e) => setEditMethodDetails(e.target.value)}
                  placeholder="Ex: Empreinte TPE CB N° 849204, ou Chèque N° 004928"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Notes / Motif de modification :
                </label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={2}
                  placeholder="Justification de la modification de caution..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedDepositForEdit(null)}
                  className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-md shadow-purple-600/20 cursor-pointer transition-colors"
                >
                  <Save className="w-4 h-4" />
                  <span>Enregistrer la Caution</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REÇU / DÉCHARGE DE CAUTION */}
      {receiptDeposit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden flex flex-col">
            <div className="bg-slate-950 px-5 py-4 border-b border-slate-800 flex items-center justify-between no-print">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-white">Quittance & Reçu Officiel de Caution</h3>
              </div>
              <button onClick={() => setReceiptDeposit(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* PRINTABLE RECEIPT */}
            <div className="p-6 bg-white text-slate-950 space-y-4 font-sans text-xs" id="caution-receipt-print">
              <div className="border-b-2 border-amber-600 pb-3 flex items-start justify-between">
                <div>
                  <h2 className="text-base font-black tracking-wider uppercase font-serif">
                    Sté MORVELLO CARS
                  </h2>
                  <p className="text-[10px] text-slate-600">Location de Véhicules de Prestige & Tourisme</p>
                  <p className="text-[9px] text-slate-500">ICE: 00366965500062 • RC: 664751 • Casablanca</p>
                </div>
                <div className="text-right">
                  <span className="inline-block bg-slate-100 border border-slate-300 font-mono text-[10px] font-bold px-2 py-1 rounded">
                    RÉCÉPISSÉ DE CAUTION
                  </span>
                  <p className="font-mono text-xs font-bold mt-1">{receiptDeposit.contractNumber}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold">Locataire :</span>
                  <p className="font-bold text-sm uppercase">{receiptDeposit.clientName}</p>
                  <p className="text-xs text-slate-600 font-mono">Tél : {receiptDeposit.clientPhone}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold">Véhicule loué :</span>
                  <p className="font-bold text-sm uppercase">{receiptDeposit.vehicleName}</p>
                  <p className="font-mono font-bold text-amber-800 text-xs">
                    Immatriculation : {formatPlateFrench(receiptDeposit.vehiclePlate)}
                  </p>
                </div>
              </div>

              <div className="border border-slate-300 rounded overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 border-b border-slate-300 text-[10px] uppercase font-bold text-slate-700">
                    <tr>
                      <th className="p-2">Désignation</th>
                      <th className="p-2 text-right">Montant</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs">
                    <tr>
                      <td className="p-2">
                        <strong>Dépôt de garantie initial ({receiptDeposit.method})</strong>
                        <div className="text-[10px] text-slate-500">{receiptDeposit.methodDetails}</div>
                      </td>
                      <td className="p-2 text-right font-mono font-bold">{receiptDeposit.amount} MAD</td>
                    </tr>
                    {receiptDeposit.deductions.map((d) => (
                      <tr key={d.id} className="text-red-700 bg-red-50/50">
                        <td className="p-2">
                          Retenue contractuelle : {d.label}
                        </td>
                        <td className="p-2 text-right font-mono font-bold">- {d.amount} MAD</td>
                      </tr>
                    ))}
                    <tr className="bg-amber-50 font-bold">
                      <td className="p-2 text-amber-950">Solde Restitué au Client :</td>
                      <td className="p-2 text-right font-mono text-emerald-800 text-sm">
                        {receiptDeposit.refundedAmount ?? receiptDeposit.amount} MAD
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-2 gap-6 pt-4 border-t border-slate-200 text-[11px]">
                <div className="border border-slate-300 p-2.5 rounded h-24 flex flex-col justify-between">
                  <span className="font-bold text-slate-700 uppercase text-[9px]">Signature du Client (Pour décharge) :</span>
                  <span className="text-[9px] text-slate-400">Lu et approuvé, caution récupérée</span>
                </div>
                <div className="border border-slate-300 p-2.5 rounded h-24 flex flex-col justify-between text-right">
                  <span className="font-bold text-slate-700 uppercase text-[9px]">Pour Sté MORVELLO CARS :</span>
                  <span className="text-[9px] text-slate-500 font-mono">Date : {new Date().toLocaleDateString('fr-FR')}</span>
                </div>
              </div>
            </div>

            {/* MODAL FOOTER */}
            <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-between no-print">
              <button
                onClick={() => setReceiptDeposit(null)}
                className="px-4 py-2 text-xs text-slate-400 hover:text-white"
              >
                Fermer
              </button>
              <button
                onClick={() => window.print()}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimer le Reçu</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
