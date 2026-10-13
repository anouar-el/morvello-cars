import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Contract, ContractStatus } from '../types';
import {
  FileText,
  Search,
  Filter,
  Eye,
  Printer,
  Copy,
  CheckSquare,
  XCircle,
  PlusCircle,
  Clock,
  Car,
  User,
  CheckCircle2,
  Calendar,
  Layers,
  Edit3,
  Camera,
  ShieldAlert,
  UserCheck,
  Fuel,
  Gauge,
  Trash2,
  MoreHorizontal,
  AlertTriangle,
  PenTool,
  ShieldCheck,
  Banknote,
  DollarSign,
  RefreshCw,
  ArrowUpDown,
  Sparkles,
} from 'lucide-react';
import { askAssistant } from '../lib/askAssistant';
import { takeEntityFocus } from '../lib/entityFocus';
import { formatPlateFrench } from '../utils/plateUtils';
import { sortContractsByNumber } from '../utils/contractNumberUtils';
import { InspectionManagerModal } from './InspectionManagerModal';
import { DigitalSignatureModal } from './DigitalSignatureModal';
import { ENABLE_DIGITAL_SIGNATURE } from '../config/features';
import { ContractPaymentsModal } from './ContractPaymentsModal';
import { isContractOwnedByManager } from '../utils/managerScopeUtils';

import { useI18n } from '../i18n/I18nContext';
interface ContractsListProps {
  onOpenCheckInModal: (contract: Contract) => void;
}

export const ContractsList: React.FC<ContractsListProps> = ({ onOpenCheckInModal }) => {
  const { t } = useI18n();
  const {
    contracts,
    vehicles,
    users,
    openPdfModal,
    duplicateContract,
    startEditingContract,
    updateContract,
    addPaymentToContract,
    updateContractPayment,
    deleteContractPayment,
    updateContractFinancials,
    settleContractBalance,
    refreshActiveContracts,
    syncWithCloud,
    cancelContract,
    deleteContract,
    setActiveTab,
    currentUser,
    hasPermission,
    duplicateContractReports,
    repairDuplicateContracts,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState<string>(() => takeEntityFocus('contract') ?? '');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [managerFilter, setManagerFilter] = useState<string>('all');
  const [inspectionContract, setInspectionContract] = useState<Contract | null>(null);
  const [paymentsModalContract, setPaymentsModalContract] = useState<Contract | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Contract Deletion Modal (Gérant only)
  const [contractToDelete, setContractToDelete] = useState<Contract | null>(null);
  // Menu « ⋯ » d'une ligne du tableau (positionné en `fixed` pour ne pas être coupé par le défilement du tableau)
  // `sheet` : sur mobile le menu s'ouvre en feuille depuis le bas de l'écran.
  const [rowMenu, setRowMenu] = useState<{ contractId: string; top: number; right: number; sheet?: boolean } | null>(
    null
  );
  const [deleteContractError, setDeleteContractError] = useState<string | null>(null);
  const [successToastMsg, setSuccessToastMsg] = useState<string>('');

  const duplicateNumberSet = React.useMemo(() => {
    return new Set(duplicateContractReports.map((r) => r.contractNumber));
  }, [duplicateContractReports]);

  // Quick departure fuel modal
  const [fuelEditModalContract, setFuelEditModalContract] = useState<Contract | null>(null);
  const [fuelEditForm, setFuelEditForm] = useState<{ departureFuel: string; departureKm: number }>({
    departureFuel: '8/8 (Plein)',
    departureKm: 0,
  });

  // Digital Signature Modal
  const [signingContract, setSigningContract] = useState<Contract | null>(null);
  const [fuelSuccessMsg, setFuelSuccessMsg] = useState<string>('');

  const openFuelEdit = (contract: Contract) => {
    setFuelEditModalContract(contract);
    setFuelEditForm({
      departureFuel: contract.departureFuel || contract.inspection?.departureChecklist?.fuelLevel || '8/8 (Plein)',
      departureKm: contract.departureKm,
    });
  };

  const handleSaveFuelEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fuelEditModalContract) return;

    updateContract(fuelEditModalContract.id, {
      departureFuel: fuelEditForm.departureFuel,
      departureKm: Number(fuelEditForm.departureKm),
    });

    setFuelSuccessMsg(t('Carburant & KM de départ du contrat {contractNumber} modifiés avec succès !', { contractNumber: fuelEditModalContract.contractNumber }));
    setFuelEditModalContract(null);
    setTimeout(() => setFuelSuccessMsg(''), 4000);
  };

  const isManager = currentUser.role === 'manager';

  // Role isolation & manager filtering
  const visibleContracts = contracts.filter((c) => {
    if (isManager) {
      return isContractOwnedByManager(c, currentUser.id, vehicles, currentUser.name);
    }

    if (managerFilter !== 'all') {
      const matchedVeh = vehicles.find((v) => v.id === c.vehicleId || v.plate === c.vehicleSnapshot.plate);
      if (managerFilter === 'unassigned') {
        return !matchedVeh?.assignedManagerId;
      }
      return matchedVeh?.assignedManagerId === managerFilter;
    }

    return true;
  });

  const filteredContracts = visibleContracts.filter((c) => {
    // Status filter
    if (statusFilter !== 'all' && c.status !== statusFilter) {
      return false;
    }

    // Payment status filter
    if (paymentFilter !== 'all') {
      const pricePerDay = c.pricePerDay !== undefined ? Number(c.pricePerDay) : 0;
      const cTotal = c.totalAmount !== undefined ? Number(c.totalAmount) : (pricePerDay * (c.totalDays || 1));
      const cPaid = c.payments && c.payments.length > 0
        ? c.payments.reduce((s, p) => s + (Number(p.amount) || 0), 0)
        : (c.paidAmount !== undefined ? Number(c.paidAmount) : 0);
      const cRemaining = Math.max(0, cTotal - cPaid);

      if (paymentFilter === 'paid') {
        if (cTotal > 0 && cRemaining > 0) return false;
      }
      if (paymentFilter === 'partial') {
        if (cTotal === 0 || cPaid === 0 || cRemaining === 0) return false;
      }
      if (paymentFilter === 'unpaid') {
        if (cTotal === 0 || cPaid > 0) return false;
      }
    }

    // Search query: contract number, client name, phone, CIN/Passport, plate
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;

    return (
      c.contractNumber.toLowerCase().includes(q) ||
      c.clientSnapshot.firstName.toLowerCase().includes(q) ||
      c.clientSnapshot.lastName.toLowerCase().includes(q) ||
      (c.clientSnapshot.phone || '').toLowerCase().includes(q) ||
      c.clientSnapshot.docNumber.toLowerCase().includes(q) ||
      c.clientSnapshot.drivingLicense.toLowerCase().includes(q) ||
      c.vehicleSnapshot.brand.toLowerCase().includes(q) ||
      c.vehicleSnapshot.model.toLowerCase().includes(q) ||
      c.vehicleSnapshot.plate.toLowerCase().includes(q)
    );
  });

  const sortedContracts = sortContractsByNumber(filteredContracts, sortOrder);

  // Le créateur n'est affiché dans chaque ligne que s'il varie : sinon c'est du bruit répété.
  const showCreator = new Set(sortedContracts.map((c) => c.createdBy)).size > 1;

  const openRowMenu = (e: React.MouseEvent<HTMLButtonElement>, cnt: Contract) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setRowMenu((current) =>
      current?.contractId === cnt.id
        ? null
        : { contractId: cnt.id, top: rect.bottom + 4, right: Math.max(8, window.innerWidth - rect.right) }
    );
  };

  const openMobileSheet = (cnt: Contract) => {
    setRowMenu({ contractId: cnt.id, top: 0, right: 0, sheet: true });
  };

  useEffect(() => {
    if (!rowMenu) return;
    const close = () => setRowMenu(null);
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [rowMenu]);

  const getStatusBadge = (status: ContractStatus) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full text-xs font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            {t('Actif')}
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 bg-blue-500/15 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full text-xs font-semibold">
            <CheckCircle2 className="w-3 h-3" />
            {t('Terminé')}
          </span>
        );
      case 'draft':
        return (
          <span className="inline-flex items-center gap-1 bg-slate-500/15 text-slate-400 border border-slate-500/30 px-2 py-0.5 rounded-full text-xs font-semibold">
            {t('Brouillon')}
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 bg-rose-500/15 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded-full text-xs font-semibold">
            {t('Annulé')}
          </span>
        );
    }
  };

  const getPaymentBadge = (cnt: Contract) => {
    const pricePerDay = cnt.pricePerDay !== undefined ? Number(cnt.pricePerDay) : 0;
    const totalDays = cnt.totalDays || 1;
    const total = cnt.totalAmount !== undefined ? Number(cnt.totalAmount) : pricePerDay * totalDays;
    const paymentsList = cnt.payments || [];
    const paid = paymentsList.length > 0
      ? paymentsList.reduce((s, p) => s + (Number(p.amount) || 0), 0)
      : (cnt.paidAmount !== undefined ? Number(cnt.paidAmount) : 0);
    const remaining = Math.max(0, total - paid);

    if (total === 0 || remaining <= 0) {
      return (
        <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 rounded font-mono">
          {t('✓ Soldé')}
        </span>
      );
    }
    if (paid > 0) {
      return (
        <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-400 bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 rounded font-mono">
          {t('⚡ Acompte')}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-rose-400 bg-rose-500/15 border border-rose-500/30 px-1.5 py-0.5 rounded font-mono">
        {t('✕ Non payé')}
      </span>
    );
  };

  const handleCancel = (contract: Contract) => {
    const reason = window.prompt(t("Motif d'annulation pour le contrat {contractNumber} :", { contractNumber: contract.contractNumber }));
    if (reason !== null) {
      cancelContract(contract.id, reason);
    }
  };

  const isGerant = currentUser.role === 'admin';
  const canUserDeleteContracts = isGerant || hasPermission('canDeleteContracts');

  const handleDeleteContractConfirm = () => {
    if (!contractToDelete) return;
    setDeleteContractError(null);

    const res = deleteContract(contractToDelete.id);
    if (!res.success) {
      setDeleteContractError(res.error || t('Erreur lors de la suppression du contrat.'));
      return;
    }

    setSuccessToastMsg(t('Contrat {contractNumber} supprimé définitivement avec succès.', { contractNumber: contractToDelete.contractNumber }));
    setContractToDelete(null);
    setTimeout(() => setSuccessToastMsg(''), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Toast feedback */}
      {successToastMsg && (
        <div className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 px-4 py-3 rounded-xl flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <span>{successToastMsg}</span>
          </div>
          <button
            onClick={() => setSuccessToastMsg('')}
            className="text-emerald-400 hover:text-white text-xs cursor-pointer"
          >
            {t('Fermer')}
          </button>
        </div>
      )}

      {/* HEADER ROW */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-400 uppercase tracking-widest font-mono">
            <Layers className="w-4 h-4" />
            {t('Module Contrats • Morvello Cars')}
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight mt-1">
            {t('Gestion & Archivage des Contrats')}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {t('Historique complet, recherche multicritère, réimpression A4 et restitution de véhicule.')}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={async () => {
              setIsRefreshing(true);
              try {
                refreshActiveContracts();
                await syncWithCloud();
                setSuccessToastMsg(
                  t('Contrats en cours actualisés avec succès : calculs financiers recalculés et données synchronisées.')
                );
              } catch (e) {
                setSuccessToastMsg(t('Contrats en cours actualisés localement avec succès.'));
              } finally {
                setTimeout(() => setIsRefreshing(false), 500);
              }
            }}
            disabled={isRefreshing}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer disabled:opacity-50"
            title={t("Actualiser et recalculer l'ensemble des contrats en cours")}
          >
            <RefreshCw className={`w-4 h-4 text-amber-400 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{t('Actualiser les contrats')}</span>
          </button>

          <button
            onClick={() => setActiveTab('new_contract')}
            className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs sm:text-sm shadow-md shadow-amber-500/20 transition-all cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            {t('+ Nouveau Contrat')}
          </button>
        </div>
      </div>

      {/* DUPLICATE CONTRACTS ALERT BANNER */}
      {duplicateContractReports.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg animate-in fade-in">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-amber-300">
                  {t('Numéros de contrats en doublon détectés ({duplicateContractReportsCount})', { duplicateContractReportsCount: duplicateContractReports.length })}
                </span>
                <span className="text-[11px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-mono font-bold">
                  {duplicateContractReports.reduce((acc, r) => acc + r.contracts.length, 0)} {t('contrats concernés')}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                {t('Certains contrats partagent le même numéro (')}{duplicateContractReports.map((r) => r.contractNumber).slice(0, 3).join(', ')}{duplicateContractReports.length > 3 ? '...' : ''}{t('). La résolution automatique réattribue des numéros uniques et consécutifs tout en mettant à jour les cautions liées.')}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              const res = repairDuplicateContracts();
              if (res.renumberedCount > 0) {
                setSuccessToastMsg(
                  t('{renumberedCount} contrat(s) en doublon ont été renumérotés avec succès avec de nouveaux numéros uniques.', { renumberedCount: res.renumberedCount })
                );
              }
            }}
            className="flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs shrink-0 shadow-md transition-all cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4" />
            {t('Corriger automatiquement les numéros')}
          </button>
        </div>
      )}

      {/* FILTER & SEARCH BAR */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-md flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 lg:min-w-[220px]">
          <Search className="w-4 h-4 absolute start-3 top-3 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('Rechercher par N° contrat, client, téléphone, CIN, immatriculation...')}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl ps-9 pe-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Super Admin Manager Filter */}
        {!isManager && (
          <div className="flex items-center gap-2 min-w-0 w-full lg:w-auto">
            <label className="text-xs text-slate-400 font-mono flex items-center gap-1 shrink-0">
              <Filter className="w-3.5 h-3.5 text-amber-400" />
              {t('Responsable :')}
            </label>
            <select
              value={managerFilter}
              onChange={(e) => setManagerFilter(e.target.value)}
              className="min-w-0 flex-1 lg:flex-none max-w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
            >
              <option value="all">{t('Tous ({contractsCount})', { contractsCount: contracts.length })}</option>
              {(users || [])
                .filter((u) => u.role === 'manager')
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.assignedFleetName || 'Agence'})
                  </option>
                ))}
              <option value="unassigned">{t('Sans responsable')}</option>
            </select>
          </div>
        )}

        {/* Filter Pills (Section 32) */}
        <div className="flex flex-wrap items-center gap-2 text-xs min-w-0">
          <div className="flex items-center gap-1.5 overflow-x-auto min-w-0 max-w-full">
            {[
              { id: 'all', label: 'Tous', count: visibleContracts.length },
              { id: 'active', label: 'Actifs', count: visibleContracts.filter((c) => c.status === 'active').length },
              { id: 'completed', label: 'Terminés', count: visibleContracts.filter((c) => c.status === 'completed').length },
              { id: 'draft', label: 'Brouillons', count: visibleContracts.filter((c) => c.status === 'draft').length },
              { id: 'cancelled', label: 'Annulés', count: visibleContracts.filter((c) => c.status === 'cancelled').length },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
                  statusFilter === tab.id
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    statusFilter === tab.id ? 'bg-slate-950 text-amber-400' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Payment Status Quick Filter */}
          <div className="flex flex-wrap items-center gap-1 max-w-full bg-slate-950 p-1 rounded-lg border border-slate-800 text-[11px]">
            <span className="text-slate-500 px-1.5 font-medium flex items-center gap-1">
              <Banknote className="w-3 h-3 text-amber-400" />
              {t('Règlement :')}
            </span>
            <button
              onClick={() => setPaymentFilter('all')}
              className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                paymentFilter === 'all'
                  ? 'bg-slate-800 text-white font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {t('Tous')}
            </button>
            <button
              onClick={() => setPaymentFilter('paid')}
              className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                paymentFilter === 'paid'
                  ? 'bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/40'
                  : 'text-slate-400 hover:text-emerald-400'
              }`}
            >
              {t('Soldés')}
            </button>
            <button
              onClick={() => setPaymentFilter('partial')}
              className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                paymentFilter === 'partial'
                  ? 'bg-amber-500/20 text-amber-400 font-bold border border-amber-500/40'
                  : 'text-slate-400 hover:text-amber-400'
              }`}
            >
              {t('Acomptes')}
            </button>
            <button
              onClick={() => setPaymentFilter('unpaid')}
              className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                paymentFilter === 'unpaid'
                  ? 'bg-rose-500/20 text-rose-400 font-bold border border-rose-500/40'
                  : 'text-slate-400 hover:text-rose-400'
              }`}
            >
              {t('Non payés')}
            </button>
          </div>

          {/* Contract Number Order Selector */}
          <div className="flex flex-wrap items-center gap-1 max-w-full bg-slate-950 p-1 rounded-lg border border-slate-800 text-[11px]">
            <span className="text-slate-500 px-1.5 font-medium flex items-center gap-1">
              <ArrowUpDown className="w-3 h-3 text-amber-400" />
              {t('Ordre N° :')}
            </span>
            <button
              type="button"
              onClick={() => setSortOrder('desc')}
              className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                sortOrder === 'desc'
                  ? 'bg-amber-500/20 text-amber-400 font-bold border border-amber-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
              title={t('Classer selon les numéros de contrat décroissants (plus récent en premier)')}
            >
              {t('Décroissant (50 → 1)')}
            </button>
            <button
              type="button"
              onClick={() => setSortOrder('asc')}
              className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                sortOrder === 'asc'
                  ? 'bg-amber-500/20 text-amber-400 font-bold border border-amber-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
              title={t('Classer selon les numéros de contrat croissants (plus ancien en premier)')}
            >
              {t('Croissant (1 → 50)')}
            </button>
          </div>
        </div>
      </div>

      {/* FUEL MODIFIED SUCCESS BANNER */}
      {fuelSuccessMsg && (
        <div className="bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-medium">{fuelSuccessMsg}</span>
        </div>
      )}

      {/* CONTRACTS TABLE */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-md overflow-hidden">
        {/* TABLE WRAPPER - DESKTOP ONLY */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-start text-xs text-slate-300">
            <thead className="bg-slate-950/70 text-slate-400 uppercase text-[10px] font-semibold border-b border-slate-800">
              <tr>
                <th className="px-4 py-3.5">
                  <button
                    type="button"
                    onClick={() => setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
                    className="flex items-center gap-1.5 text-slate-300 hover:text-amber-400 uppercase text-[10px] font-bold tracking-wider transition-colors cursor-pointer group text-start"
                    title={t("Cliquer pour modifier l'ordre : actuellement {order}", {
                      order: sortOrder === 'desc' ? t('Décroissant (50 → 1)') : t('Croissant (1 → 50)'),
                    })}
                  >
                    <span>{t('Numéro & Créateur')}</span>
                    <span className="flex items-center gap-0.5 p-0.5 rounded bg-slate-800 group-hover:bg-amber-500/20 text-amber-400 transition-colors">
                      <ArrowUpDown className="w-3 h-3" />
                      <span className="text-[9px] font-mono font-bold">
                        {sortOrder === 'desc' ? '50→1' : '1→50'}
                      </span>
                    </span>
                  </button>
                </th>
                <th className="px-4 py-3.5">{t('Locataire Principal')}</th>
                <th className="px-4 py-3.5">{t('Véhicule & Immat')}</th>
                <th className="px-4 py-3.5">{t('Période Location')}</th>
                <th className="px-4 py-3.5">{t('KM & Carburant')}</th>
                <th className="px-4 py-3.5">{t('Règlement & Solde')}</th>
                <th className="px-4 py-3.5">{t('Statut')}</th>
                <th className="px-4 py-3.5 text-end">{t('Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {sortedContracts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-500 text-xs">
                    {t('Aucun contrat ne correspond à vos critères de recherche.')}
                  </td>
                </tr>
              ) : (
                sortedContracts.map((cnt) => (
                  <tr key={cnt.id} className="hover:bg-slate-850/60 transition-colors">
                    {/* NUMÉRO & DATE */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-amber-400 text-sm">
                          {cnt.contractNumber}
                        </span>
                        {duplicateNumberSet.has(cnt.contractNumber) && (
                          <span
                            className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-300 bg-amber-500/20 border border-amber-500/40 px-1.5 py-0.5 rounded"
                            title={t('Numéro en doublon partagé par plusieurs contrats')}
                          >
                            <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />
                            {t('Doublon')}
                          </span>
                        )}
                      </div>
                      <div
                        className="text-[10px] text-slate-500 mt-0.5"
                        title={t('Conditions V{termsVersion} • créé par {createdBy}', { termsVersion: cnt.termsVersion, createdBy: cnt.createdBy })}
                      >
                        {new Date(cnt.createdAt).toLocaleDateString('fr-FR')}
                        {showCreator ? ` • ${cnt.createdBy}` : ''}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border font-mono ${
                          cnt.templateId === 'prestige'
                            ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                            : cnt.templateId === 'corporate'
                            ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                            : cnt.templateId === 'signature'
                            ? 'bg-violet-500/15 text-violet-300 border-violet-500/30'
                            : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                        }`}>
                          {cnt.templateId === 'prestige' ? t('★ VIP Prestige') : cnt.templateId === 'corporate' ? t('🏢 Corporate B2B') : cnt.templateId === 'signature' ? t('✒ Signature') : t('📄 Standard')}
                        </span>
                        {cnt.clientSignature ? (
                          <span
                            className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.2 rounded"
                            title={t('Signé numériquement le {date}', { date: new Date(cnt.clientSignedAt || '').toLocaleDateString('fr-FR') })}
                          >
                            <ShieldCheck className="w-2.5 h-2.5 text-emerald-400" />
                            {t('Signé e-Sign')}
                          </span>
                        ) : ENABLE_DIGITAL_SIGNATURE ? (
                          <span
                            className="inline-flex items-center gap-1 text-[8.5px] font-medium text-slate-400 bg-slate-800/80 border border-slate-700/60 px-1.5 py-0.2 rounded"
                            title={t('Signature numérique en attente')}
                          >
                            <PenTool className="w-2 h-2 text-slate-500" />
                            {t('À signer')}
                          </span>
                        ) : null}
                      </div>
                    </td>

                    {/* CLIENT */}
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-white uppercase">
                        {cnt.clientSnapshot.lastName} {cnt.clientSnapshot.firstName}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {cnt.clientSnapshot.docType} : <span className="font-mono text-slate-300">{cnt.clientSnapshot.docNumber}</span>
                      </div>
                      {cnt.clientSnapshot.phone ? (
                        <div className="text-[10px] text-amber-400/90 font-medium">📞 {cnt.clientSnapshot.phone}</div>
                      ) : null}
                      {(cnt.clientSnapshot.licenseDocUrl || cnt.clientSnapshot.cinDocUrl) && (
                        <div className="text-[9px] text-emerald-400 font-mono mt-0.5">
                          {t('✓ Documents archivés')}
                        </div>
                      )}
                      {cnt.hasSecondDriver && (
                        <div className="text-[9px] text-slate-400 italic">
                          {t('+ 2e Conducteur : {lastName} {firstName}', { lastName: cnt.secondDriverSnapshot?.lastName, firstName: cnt.secondDriverSnapshot?.firstName })}
                        </div>
                      )}
                    </td>

                    {/* VÉHICULE */}
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-white uppercase">
                        {cnt.vehicleSnapshot.brand} {cnt.vehicleSnapshot.model}
                      </div>
                      <div className="font-mono text-[11px] text-amber-400 font-bold">
                        {formatPlateFrench(cnt.vehicleSnapshot.plate)}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {t('Carburant : {fuelType}', { fuelType: cnt.vehicleSnapshot.fuelType })}
                      </div>
                      {(() => {
                        const v = vehicles.find((item) => item.id === cnt.vehicleId || item.plate === cnt.vehicleSnapshot.plate);
                        const managerName = cnt.managerDisplayName || cnt.assignedManagerName || v?.assignedManagerName;
                        if (!managerName) return null;
                        const officialName = cnt.assignedManagerName || v?.assignedManagerName;
                        const hasCustom = cnt.managerDisplayName && officialName && cnt.managerDisplayName !== officialName;
                        return (
                          <div className="text-[10px] text-blue-300 font-mono mt-0.5 flex items-center gap-1" title={hasCustom ? t('Nom officiel : {officialName}', { officialName }) : undefined}>
                            <UserCheck className="w-3 h-3 text-blue-400 shrink-0" />
                            <span>{managerName}</span>
                            {hasCustom && (
                              <span className="text-[9px] text-slate-400">({officialName})</span>
                            )}
                          </div>
                        );
                      })()}
                    </td>

                    {/* DATES & DURÉE */}
                    <td className="px-4 py-3.5">
                      {(() => {
                        const endDate = cnt.prolongation?.isActive ? cnt.prolongation.newEndDate : cnt.endDate;
                        const endTime = cnt.prolongation?.isActive ? cnt.prolongation.newEndTime : cnt.endTime;
                        const fmt = (d: string) =>
                          new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
                        return (
                          <div
                            className="text-slate-200 whitespace-nowrap"
                            title={`Du ${new Date(cnt.startDate).toLocaleDateString('fr-FR')} à ${cnt.startTime} au ${new Date(endDate).toLocaleDateString('fr-FR')} à ${endTime}`}
                          >
                            <strong>{fmt(cnt.startDate)}</strong> → <strong>{fmt(endDate)}</strong>
                            <span className="text-slate-500">/{new Date(endDate).getFullYear()}</span>
                            <div className="text-[10px] text-amber-400 font-semibold mt-0.5">{cnt.totalDays} j</div>
                          </div>
                        );
                      })()}
                    </td>

                    {/* KM & CARBURANT */}
                    <td className="px-4 py-3.5 font-mono">
                      <div>
                        {t('Départ :')} <span className="text-white font-bold">{t('{departureKm} KM', { departureKm: cnt.departureKm.toLocaleString() })}</span>
                      </div>
                      <div className="text-[10.5px] text-amber-400 flex items-center gap-1 font-semibold mt-0.5">
                        <Fuel className="w-3 h-3 shrink-0" />
                        <span>{cnt.departureFuel || cnt.inspection?.departureChecklist?.fuelLevel || '8/8 (Plein)'}</span>
                      </div>
                      {cnt.returnKm ? (
                        <div className="text-emerald-400 mt-0.5">
                          {t('Retour :')} <span className="font-bold">{t('{returnKm} KM', { returnKm: cnt.returnKm.toLocaleString() })}</span>
                          <span className="block text-[9px] text-slate-500">
                            {t('(+{returnKm} KM)', { returnKm: (cnt.returnKm - cnt.departureKm).toLocaleString() })}
                          </span>
                        </div>
                      ) : (
                        <div className="text-slate-500 text-[10px] mt-0.5">{t('Retour : En cours')}</div>
                      )}
                    </td>

                    {/* RÈGLEMENT & SOLDE */}
                    <td className="px-4 py-3.5">
                      {(() => {
                        const pricePerDay = cnt.pricePerDay !== undefined ? Number(cnt.pricePerDay) : 0;
                        const totalDays = cnt.totalDays || 1;
                        const total = cnt.totalAmount !== undefined ? Number(cnt.totalAmount) : (pricePerDay * totalDays);
                        const paymentsList = cnt.payments || [];
                        const paid = paymentsList.length > 0
                          ? paymentsList.reduce((s, p) => s + (Number(p.amount) || 0), 0)
                          : (cnt.paidAmount !== undefined ? Number(cnt.paidAmount) : 0);
                        const remaining = Math.max(0, total - paid);

                        const isZeroTotal = total === 0;
                        const isFullyPaid = isZeroTotal || remaining <= 0;
                        const isPartiallyPaid = !isZeroTotal && paid > 0 && remaining > 0;

                        return (
                          <div
                            className="space-y-1"
                            title={t('Tarif : {pricePerDay} MAD/j × {totalDays} j • Encaissé : {paid} MAD • Reste : {remaining} MAD • {count} versement(s)', {
                              pricePerDay,
                              totalDays,
                              paid: paid.toLocaleString('fr-FR'),
                              remaining: remaining.toLocaleString('fr-FR'),
                              count: cnt.payments?.length || 0,
                            })}
                          >
                            <div className="flex items-center justify-between gap-1 text-[11px]">
                              <span className="font-mono text-slate-300 font-bold">
                                {t('{total} MAD', { total: total.toLocaleString('fr-FR') })}
                              </span>
                              {isZeroTotal ? (
                                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 rounded font-mono">
                                  {t('✓ Soldé (0 MAD)')}
                                </span>
                              ) : isFullyPaid ? (
                                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 rounded font-mono">
                                  {t('✓ Soldé')}
                                </span>
                              ) : isPartiallyPaid ? (
                                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-400 bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 rounded font-mono">
                                  {t('⚡ Acompte')}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-rose-400 bg-rose-500/15 border border-rose-500/30 px-1.5 py-0.5 rounded font-mono">
                                  {t('✕ Non payé')}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5">
                              {remaining > 0 && (
                                <span className="text-[10px] font-mono text-rose-400 font-bold">
                                  {t('Reste {remaining}', { remaining: remaining.toLocaleString('fr-FR') })}
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => setPaymentsModalContract(cnt)}
                                className="p-1 text-amber-400/90 hover:text-amber-300 hover:bg-amber-500/10 rounded border border-amber-500/20 transition-colors cursor-pointer"
                                title={t('Gérer les règlements ({count} versement(s)), modifier le tarif ou le total', { count: cnt.payments?.length || 0 })}
                              >
                                <Banknote className="w-3 h-3" />
                              </button>

                              {remaining > 0 && hasPermission('canCreateContracts') && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    settleContractBalance(cnt.id);
                                    setSuccessToastMsg(
                                      t('Contrat {contractNumber} soldé avec succès (règlement du reliquat de {remaining} MAD enregistré).', { contractNumber: cnt.contractNumber, remaining: remaining.toLocaleString('fr-FR') })
                                    );
                                  }}
                                  className="text-[9px] font-bold bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 border border-emerald-500/40 px-1.5 py-0.5 rounded transition-all cursor-pointer whitespace-nowrap"
                                  title={t('Solder immédiatement le reliquat de {remaining} MAD', { remaining: remaining.toLocaleString('fr-FR') })}
                                >
                                  {t('Solder')}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </td>

                    {/* STATUT */}
                    <td className="px-4 py-3.5">{getStatusBadge(cnt.status)}</td>

                    {/* ACTIONS : 2 actions visibles (PDF, Restituer) + menu « ⋯ » pour le reste */}
                    <td className="px-4 py-3.5 text-end">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openPdfModal(cnt)}
                          className="p-1.5 bg-slate-800 hover:bg-amber-500/20 text-slate-300 hover:text-amber-400 border border-slate-700 hover:border-amber-500/40 rounded-lg transition-colors cursor-pointer"
                          title={t('Aperçu du contrat 2 pages A4')}
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {cnt.status === 'active' && hasPermission('canValidateContracts') && (
                          <button
                            onClick={() => onOpenCheckInModal(cnt)}
                            className="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 border border-emerald-500/40 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                            title={t('Clôturer le contrat lors de la restitution du véhicule')}
                          >
                            <CheckSquare className="w-3.5 h-3.5" />
                            <span>{t('Restituer')}</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={(e) => openRowMenu(e, cnt)}
                          aria-haspopup="menu"
                          aria-expanded={rowMenu?.contractId === cnt.id}
                          className={`p-1.5 border rounded-lg transition-colors cursor-pointer ${
                            rowMenu?.contractId === cnt.id
                              ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700'
                          }`}
                          title={t("Plus d'actions")}
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ========================================================================= */}
        {/* MOBILE CARD VIEW (< md screens)                                           */}
        {/* ========================================================================= */}
        <div className="md:hidden divide-y divide-slate-800">
          {sortedContracts.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              {t('Aucun contrat ne correspond à vos critères de recherche.')}
            </div>
          ) : (
            sortedContracts.map((cnt) => {
              const matchingVehicle = vehicles.find((item) => item.id === cnt.vehicleId || item.plate === cnt.vehicleSnapshot.plate);
              const managerName = cnt.managerDisplayName || cnt.assignedManagerName || matchingVehicle?.assignedManagerName;

              return (
                <div key={cnt.id} className="p-3.5 space-y-3 bg-slate-900/60 hover:bg-slate-900 transition-colors">
                  {/* CARD HEADER: N° CONTRAT + STATUS + TEMPLATE BADGE */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-bold text-amber-400 text-sm">
                          {cnt.contractNumber}
                        </span>
                        {duplicateNumberSet.has(cnt.contractNumber) && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-300 bg-amber-500/20 border border-amber-500/40 px-1 py-0.2 rounded">
                            <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />
                            {t('Doublon')}
                          </span>
                        )}
                        <span className={`text-[9px] px-1.5 py-0.2 rounded border font-semibold ${
                          cnt.templateId === 'prestige'
                            ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                            : cnt.templateId === 'corporate'
                            ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                            : cnt.templateId === 'signature'
                            ? 'bg-violet-500/15 text-violet-300 border-violet-500/30'
                            : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                        }`}>
                          {cnt.templateId === 'prestige' ? t('★ VIP') : cnt.templateId === 'corporate' ? '🏢 B2B' : cnt.templateId === 'signature' ? t('✒ Sign') : t('📄 Standard')}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {new Date(cnt.createdAt).toLocaleDateString('fr-FR')} • {cnt.createdBy}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      {getStatusBadge(cnt.status)}
                      {cnt.clientSignature ? (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.2 rounded">
                          <ShieldCheck className="w-2.5 h-2.5" />
                          {t('Signé')}
                        </span>
                      ) : ENABLE_DIGITAL_SIGNATURE ? (
                        <span className="inline-flex items-center gap-1 text-[8.5px] font-medium text-slate-400 bg-slate-800/80 border border-slate-700/60 px-1.5 py-0.2 rounded">
                          <PenTool className="w-2 h-2 text-slate-500" />
                          {t('À signer')}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* VÉHICULE & CLIENT ROW */}
                  <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800 grid grid-cols-2 gap-2 text-xs">
                    {/* VÉHICULE */}
                    <div>
                      <span className="text-[9.5px] text-slate-400 uppercase font-bold block">{t('Véhicule')}</span>
                      <div className="font-bold text-white uppercase text-xs truncate">
                        {cnt.vehicleSnapshot.brand} {cnt.vehicleSnapshot.model}
                      </div>
                      <div className="font-mono text-[10.5px] text-amber-400 font-bold mt-0.5">
                        {formatPlateFrench(cnt.vehicleSnapshot.plate)}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {t('{departureKm} KM • {departureFuel}', { departureKm: cnt.departureKm.toLocaleString('fr-FR'), departureFuel: cnt.departureFuel || '8/8' })}
                      </div>
                    </div>

                    {/* CLIENT */}
                    <div>
                      <span className="text-[9.5px] text-slate-400 uppercase font-bold block">{t('Locataire')}</span>
                      <div className="font-bold text-white uppercase text-xs truncate">
                        {cnt.clientSnapshot.lastName} {cnt.clientSnapshot.firstName}
                      </div>
                      {cnt.clientSnapshot.phone ? (
                        <a
                          href={`tel:${cnt.clientSnapshot.phone}`}
                          className="inline-flex items-center gap-1 text-[10.5px] text-amber-400 hover:underline font-mono font-medium mt-0.5"
                        >
                          📞 {cnt.clientSnapshot.phone}
                        </a>
                      ) : (
                        <span className="text-[10px] text-slate-500 italic block mt-0.5">{t('Tél non renseigné')}</span>
                      )}
                      {managerName && (
                        <div className="text-[9.5px] text-blue-300 font-mono mt-0.5 truncate">
                          {t('Resp: {managerName}', { managerName })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* PÉRIODE & TARIFS */}
                  <div className="flex items-center justify-between text-xs px-0.5">
                    <div className="text-slate-300 text-[11px] leading-tight">
                      <div>
                        {t('Du')} <strong className="text-white">{new Date(cnt.startDate).toLocaleDateString('fr-FR')}</strong> {t('au')} <strong className="text-white">{new Date(cnt.prolongation?.isActive ? cnt.prolongation.newEndDate : cnt.endDate).toLocaleDateString('fr-FR')}</strong>
                      </div>
                      <div className="text-[10px] text-amber-400/90 font-medium mt-0.5">
                        {t('{totalDays} jour(s) • {pricePerDay} MAD/j', { totalDays: cnt.totalDays, pricePerDay: cnt.pricePerDay })}
                      </div>
                    </div>

                    <div className="text-end">
                      <div className="font-mono font-bold text-white text-sm">
                        {t('{totalAmount} MAD', { totalAmount: cnt.totalAmount.toLocaleString('fr-FR') })}
                      </div>
                      <div className="mt-0.5">
                        {getPaymentBadge(cnt)}
                      </div>
                    </div>
                  </div>

                  {/* ACTIONS MOBILE : actions principales + « Plus » (feuille avec toutes les autres) */}
                  {(() => {
                    const mobileEditable =
                      (cnt.status === 'active' || cnt.status === 'draft') && hasPermission('canEditContracts');
                    const canCheckIn = cnt.status === 'active' && hasPermission('canValidateContracts');
                    const tile =
                      'flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 p-2 rounded-xl border text-[10px] font-semibold transition-colors cursor-pointer';
                    return (
                      <div className="flex gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => openPdfModal(cnt)}
                          className={`${tile} bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 border-blue-500/30`}
                        >
                          <Eye className="w-4 h-4" />
                          <span className="truncate">{t('PDF A4')}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setPaymentsModalContract(cnt)}
                          className={`${tile} bg-slate-800 hover:bg-slate-700 text-emerald-300 border-slate-700`}
                        >
                          <Banknote className="w-4 h-4" />
                          <span className="truncate">{t('Paiements')}</span>
                        </button>

                        {mobileEditable && (
                          <button
                            type="button"
                            onClick={() => startEditingContract(cnt)}
                            className={`${tile} bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700`}
                          >
                            <Edit3 className="w-4 h-4" />
                            <span className="truncate">{t('Modifier')}</span>
                          </button>
                        )}

                        {canCheckIn && (
                          <button
                            type="button"
                            onClick={() => onOpenCheckInModal(cnt)}
                            className={`${tile} bg-emerald-600/30 hover:bg-emerald-600/40 text-emerald-300 border-emerald-500/40 font-bold`}
                          >
                            <CheckSquare className="w-4 h-4" />
                            <span className="truncate">{t('Restituer')}</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => openMobileSheet(cnt)}
                          aria-haspopup="menu"
                          className={`${tile} bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700`}
                        >
                          <MoreHorizontal className="w-4 h-4" />
                          <span className="truncate">{t('Plus')}</span>
                        </button>
                      </div>
                    );
                  })()}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* MENU « ⋯ » D'UNE LIGNE (actions secondaires) */}
      {rowMenu &&
        (() => {
          const menuContract = sortedContracts.find((c) => c.id === rowMenu.contractId);
          if (!menuContract) return null;
          const editable =
            (menuContract.status === 'active' || menuContract.status === 'draft') && hasPermission('canEditContracts');
          const isSheet = Boolean(rowMenu.sheet);
          const itemClass = `w-full flex items-center gap-3 px-4 text-left text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer ${
            isSheet ? 'py-3.5 text-sm' : 'py-2 text-xs'
          }`;
          const run = (action: () => void) => () => {
            setRowMenu(null);
            action();
          };
          return (
            <>
              <div
                className={`fixed inset-0 ${isSheet ? 'z-[60] bg-slate-950/60' : 'z-40'}`}
                onClick={() => setRowMenu(null)}
                aria-hidden="true"
              />
              <div
                role="menu"
                style={isSheet ? undefined : { position: 'fixed', top: rowMenu.top, right: rowMenu.right }}
                className={
                  isSheet
                    ? 'fixed inset-x-0 bottom-0 z-[70] max-h-[80vh] overflow-y-auto bg-slate-900 border-t border-slate-700 rounded-t-2xl shadow-2xl pb-6 pt-2'
                    : 'z-50 w-60 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl py-1.5 overflow-hidden'
                }
              >
                {isSheet && <div className="w-12 h-1.5 bg-slate-700 rounded-full mx-auto mb-2" />}
                <div className="px-4 pb-2 text-[11px] font-mono font-bold text-amber-400 border-b border-slate-800">
                  {menuContract.contractNumber} • {menuContract.clientSnapshot.lastName} {menuContract.clientSnapshot.firstName}
                </div>

                <button role="menuitem" className={itemClass} onClick={run(() => setPaymentsModalContract(menuContract))}>
                  <Banknote className="w-4 h-4 text-emerald-400" />
                  <span>{t('Règlements & paiements')}</span>
                </button>

                {editable && (
                  <button role="menuitem" className={itemClass} onClick={run(() => startEditingContract(menuContract))}>
                    <Edit3 className="w-4 h-4 text-blue-400" />
                    <span>{t('Modifier le contrat')}</span>
                  </button>
                )}

                {editable && (
                  <button role="menuitem" className={itemClass} onClick={run(() => openFuelEdit(menuContract))}>
                    <Fuel className="w-4 h-4 text-amber-400" />
                    <span>{t('Carburant & km de départ')}</span>
                  </button>
                )}

                <button role="menuitem" className={itemClass} onClick={run(() => setInspectionContract(menuContract))}>
                  <Camera className="w-4 h-4 text-amber-400" />
                  <span>
                    {t('Photos & état des lieux')}
                    {menuContract.inspection?.photos?.length ? ` (${menuContract.inspection.photos.length})` : ''}
                  </span>
                </button>

                <button role="menuitem" className={itemClass} onClick={run(() => openPdfModal(menuContract))}>
                  <Printer className="w-4 h-4 text-slate-300" />
                  <span>{t('Imprimer le contrat')}</span>
                </button>

                <button
                  role="menuitem"
                  className={itemClass}
                  onClick={run(() =>
                    askAssistant(
                      `Fais le point sur le contrat ${menuContract.contractNumber} (${menuContract.clientSnapshot.firstName} ${menuContract.clientSnapshot.lastName}) : statut, dates, solde restant, caution et prochaine action à mener. Propose ensuite un message WhatsApp adapté au client.`
                    )
                  )}
                >
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>{t('Demander à l’assistant')}</span>
                </button>

                {ENABLE_DIGITAL_SIGNATURE && (
                  <button role="menuitem" className={itemClass} onClick={run(() => setSigningContract(menuContract))}>
                    <PenTool className="w-4 h-4 text-amber-400" />
                    <span>{menuContract.clientSignature ? t('Gérer la signature') : t('Signer')}</span>
                  </button>
                )}

                {hasPermission('canCreateContracts') && (
                  <button role="menuitem" className={itemClass} onClick={run(() => duplicateContract(menuContract))}>
                    <Copy className="w-4 h-4 text-slate-300" />
                    <span>{t('Dupliquer')}</span>
                  </button>
                )}

                {menuContract.status === 'active' && hasPermission('canCancelContracts') && (
                  <button role="menuitem" className={itemClass} onClick={run(() => handleCancel(menuContract))}>
                    <XCircle className="w-4 h-4 text-rose-400" />
                    <span>{t('Annuler le contrat')}</span>
                  </button>
                )}

                {canUserDeleteContracts && (
                  <>
                    <div className="my-1 border-t border-slate-800" />
                    <button
                      role="menuitem"
                      className={`${itemClass} text-rose-300 hover:bg-rose-500/10`}
                      onClick={run(() => {
                        setDeleteContractError(null);
                        setContractToDelete(menuContract);
                      })}
                    >
                      <Trash2 className="w-4 h-4 text-rose-400" />
                      <span>{t('Supprimer définitivement')}</span>
                    </button>
                  </>
                )}
              </div>
            </>
          );
        })()}

      {/* MODAL ÉTAT DES LIEUX & PHOTOS */}
      <InspectionManagerModal
        contract={inspectionContract}
        isOpen={!!inspectionContract}
        onClose={() => setInspectionContract(null)}
      />

      {/* MODAL MODIFICATION CARBURANT & KM DE DÉPART */}
      {fuelEditModalContract && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/80 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto pb-safe">
            <div className="w-12 h-1.5 bg-slate-700 rounded-full mx-auto -mt-2 mb-2 sm:hidden shrink-0" />
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-500/15 text-amber-400 rounded-xl border border-amber-500/30">
                  <Fuel className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">{t('Carburant & KM au Départ')}</h2>
                  <p className="text-xs text-slate-400 font-mono">
                    {t('Contrat N° {contractNumber}', { contractNumber: fuelEditModalContract.contractNumber })}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFuelEditModalContract(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Recap vehicle */}
            <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-400 block">{t('Véhicule :')}</span>
                <span className="font-bold text-white">
                  {fuelEditModalContract.vehicleSnapshot.brand} {fuelEditModalContract.vehicleSnapshot.model}
                </span>
              </div>
              <div className="text-end">
                <span className="text-slate-400 block">{t('Immatriculation :')}</span>
                <span className="font-bold font-mono text-amber-400">
                  {fuelEditModalContract.vehicleSnapshot.plate}
                </span>
              </div>
            </div>

            <form onSubmit={handleSaveFuelEdit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1.5 flex items-center gap-1.5">
                  <Fuel className="w-4 h-4 text-amber-400" />
                  {t('Niveau de Carburant au Départ *')}
                </label>
                <select
                  value={fuelEditForm.departureFuel}
                  onChange={(e) => setFuelEditForm({ ...fuelEditForm, departureFuel: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-white font-mono font-semibold focus:border-amber-500 focus:outline-none cursor-pointer"
                >
                  <option value="8/8 (Plein)">{t('8/8 (Plein complet)')}</option>
                  <option value="7/8">7/8</option>
                  <option value="6/8 (3/4)">6/8 (3/4)</option>
                  <option value="5/8">5/8</option>
                  <option value="4/8 (1/2)">4/8 (1/2)</option>
                  <option value="3/8">3/8</option>
                  <option value="2/8 (1/4)">2/8 (1/4)</option>
                  <option value="1/8 (Réserve)">{t('1/8 (Réserve)')}</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1.5 flex items-center gap-1.5">
                  <Gauge className="w-4 h-4 text-slate-400" />
                  {t('Kilométrage au Départ (Compteur) *')}
                </label>
                <input
                  type="number"
                  required
                  min={0}
                  value={fuelEditForm.departureKm}
                  onChange={(e) => setFuelEditForm({ ...fuelEditForm, departureKm: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-white font-mono font-bold text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setFuelEditModalContract(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  {t('Annuler')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl shadow-md shadow-amber-500/20 transition-transform active:scale-95 flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{t('Enregistrer')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL CONFIRMATION SUPPRESSION CONTRAT (GÉRANT SEUL)                      */}
      {/* ========================================================================= */}
      {contractToDelete && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/80 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-rose-500/40 rounded-t-3xl sm:rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto pb-safe">
            <div className="w-12 h-1.5 bg-slate-700 rounded-full mx-auto -mt-2 mb-2 sm:hidden shrink-0" />
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">{t('Supprimer ce contrat ?')}</h3>
                <p className="text-xs text-slate-400">{t('Action irréversible réservée au Gérant')}</p>
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">{t('N° Contrat :')}</span>
                <span className="text-amber-400 font-mono font-bold">{contractToDelete.contractNumber}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">{t('Client :')}</span>
                <span className="text-white font-semibold">
                  {contractToDelete.clientSnapshot.lastName} {contractToDelete.clientSnapshot.firstName}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">{t('Véhicule :')}</span>
                <span className="text-slate-300">
                  {contractToDelete.vehicleSnapshot.brand} {contractToDelete.vehicleSnapshot.model} ({contractToDelete.vehicleSnapshot.plate})
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">{t('Période :')}</span>
                <span className="text-slate-300">
                  {t('Du {startDate} au {endDate}', { startDate: contractToDelete.startDate, endDate: contractToDelete.endDate })}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">{t('Statut :')}</span>
                <span className={`font-semibold capitalize ${
                  contractToDelete.status === 'active' ? 'text-emerald-400' :
                  contractToDelete.status === 'completed' ? 'text-blue-400' : 'text-slate-400'
                }`}>
                  {contractToDelete.status === 'active' ? t('Actif (En cours)') :
                   contractToDelete.status === 'completed' ? t('Clôturé / Restitué') :
                   contractToDelete.status === 'cancelled' ? t('Annulé') : t('Brouillon')}
                </span>
              </div>
            </div>

            {deleteContractError && (
              <div className="bg-rose-950/60 border border-rose-500/60 rounded-xl p-3 flex items-start gap-2.5 text-xs text-rose-200">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{deleteContractError}</span>
              </div>
            )}

            <p className="text-[11px] text-slate-400">
              {contractToDelete.status === 'active'
                ? t('⚠️ Ce contrat est actuellement actif. Sa suppression libérera automatiquement le véhicule associé dans le parc comme disponible.')
                : t('La suppression de ce contrat effacera définitivement ses données et ses fiches de caution associées.')}
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setContractToDelete(null);
                  setDeleteContractError(null);
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                {t('Annuler')}
              </button>
              <button
                type="button"
                onClick={handleDeleteContractConfirm}
                className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-600/30 transition-all cursor-pointer active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {t('Confirmer la suppression')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE SIGNATURE NUMÉRIQUE INTERACTIVE DIRECTE */}
      {signingContract && (
        <DigitalSignatureModal
          contract={signingContract}
          isOpen={!!signingContract}
          onClose={() => setSigningContract(null)}
          onSignatureSaved={(updated) => {
            setSigningContract(null);
            setSuccessToastMsg(
              t('Signature numérique certifiée enregistrée avec succès pour le contrat {contractNumber}', { contractNumber: updated.contractNumber })
            );
            setTimeout(() => setSuccessToastMsg(''), 4000);
          }}
          updateContract={updateContract}
        />
      )}

      {/* MODAL DE SUIVI DES PAIEMENTS CLIENTS */}
      {paymentsModalContract && (
        <ContractPaymentsModal
          contract={
            contracts.find((c) => c.id === paymentsModalContract.id) || paymentsModalContract
          }
          onClose={() => setPaymentsModalContract(null)}
          onAddPayment={(cId, p) => {
            const updated = addPaymentToContract(cId, p, currentUser?.name);
            if (updated) {
              setSuccessToastMsg(t('Règlement de {amount} MAD enregistré sur le contrat {contractNumber}', { amount: p.amount, contractNumber: updated.contractNumber }));
              setTimeout(() => setSuccessToastMsg(''), 4000);
            }
          }}
          onUpdatePayment={(cId, pId, pData) => {
            const updated = updateContractPayment(cId, pId, pData, currentUser?.name);
            if (updated) {
              setSuccessToastMsg(t('Paiement mis à jour avec succès sur le contrat {contractNumber}', { contractNumber: updated.contractNumber }));
              setTimeout(() => setSuccessToastMsg(''), 4000);
            }
          }}
          onDeletePayment={(cId, pId) => {
            const updated = deleteContractPayment(cId, pId, currentUser?.name);
            if (updated) {
              setSuccessToastMsg(t('Paiement supprimé du contrat {contractNumber}', { contractNumber: updated.contractNumber }));
              setTimeout(() => setSuccessToastMsg(''), 4000);
            }
          }}
          onUpdateFinancials={(cId, fin) => {
            const updated = updateContractFinancials(cId, fin, currentUser?.name);
            if (updated) {
              setSuccessToastMsg(t('Tarification du contrat {contractNumber} mise à jour ({totalAmount} MAD)', { contractNumber: updated.contractNumber, totalAmount: fin.totalAmount }));
              setTimeout(() => setSuccessToastMsg(''), 4000);
            }
          }}
          currentUserName={currentUser?.name || 'Direction'}
        />
      )}
    </div>
  );
};
