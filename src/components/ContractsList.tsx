import React, { useState } from 'react';
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
  AlertTriangle,
  PenTool,
  ShieldCheck,
  Banknote,
  DollarSign,
  RefreshCw,
  ArrowUpDown,
} from 'lucide-react';
import { formatPlateFrench } from '../utils/plateUtils';
import { InspectionManagerModal } from './InspectionManagerModal';
import { DigitalSignatureModal } from './DigitalSignatureModal';
import { ContractPaymentsModal } from './ContractPaymentsModal';
import { isContractOwnedByManager } from '../utils/managerScopeUtils';

interface ContractsListProps {
  onOpenCheckInModal: (contract: Contract) => void;
}

export const ContractsList: React.FC<ContractsListProps> = ({ onOpenCheckInModal }) => {
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

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [managerFilter, setManagerFilter] = useState<string>('all');
  const [inspectionContract, setInspectionContract] = useState<Contract | null>(null);
  const [paymentsModalContract, setPaymentsModalContract] = useState<Contract | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Contract Deletion Modal (Gérant only)
  const [contractToDelete, setContractToDelete] = useState<Contract | null>(null);
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

    setFuelSuccessMsg(`Carburant & KM de départ du contrat ${fuelEditModalContract.contractNumber} modifiés avec succès !`);
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
  })
  .sort((a, b) => {
    const numA = (a.contractNumber || '').trim();
    const numB = (b.contractNumber || '').trim();
    const comp = numA.localeCompare(numB, 'fr', { numeric: true, sensitivity: 'base' });
    if (comp !== 0) {
      return sortOrder === 'desc' ? -comp : comp;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const getStatusBadge = (status: ContractStatus) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full text-xs font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            Actif
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 bg-blue-500/15 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full text-xs font-semibold">
            <CheckCircle2 className="w-3 h-3" />
            Terminé
          </span>
        );
      case 'draft':
        return (
          <span className="inline-flex items-center gap-1 bg-slate-500/15 text-slate-400 border border-slate-500/30 px-2 py-0.5 rounded-full text-xs font-semibold">
            Brouillon
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 bg-rose-500/15 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded-full text-xs font-semibold">
            Annulé
          </span>
        );
    }
  };

  const handleCancel = (contract: Contract) => {
    const reason = window.prompt(`Motif d'annulation pour le contrat ${contract.contractNumber} :`);
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
      setDeleteContractError(res.error || 'Erreur lors de la suppression du contrat.');
      return;
    }

    setSuccessToastMsg(`Contrat ${contractToDelete.contractNumber} supprimé définitivement avec succès.`);
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
            Fermer
          </button>
        </div>
      )}

      {/* HEADER ROW */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-400 uppercase tracking-widest font-mono">
            <Layers className="w-4 h-4" />
            Module Contrats • Morvello Cars
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight mt-1">
            Gestion & Archivage des Contrats
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Historique complet, recherche multicritère, réimpression A4 et restitution de véhicule.
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
                  'Contrats en cours actualisés avec succès : calculs financiers recalculés et données synchronisées.'
                );
              } catch (e) {
                setSuccessToastMsg('Contrats en cours actualisés localement avec succès.');
              } finally {
                setTimeout(() => setIsRefreshing(false), 500);
              }
            }}
            disabled={isRefreshing}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer disabled:opacity-50"
            title="Actualiser et recalculer l'ensemble des contrats en cours"
          >
            <RefreshCw className={`w-4 h-4 text-amber-400 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Actualiser les contrats</span>
          </button>

          <button
            onClick={() => setActiveTab('new_contract')}
            className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs sm:text-sm shadow-md shadow-amber-500/20 transition-all cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            + Nouveau Contrat
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
                  Numéros de contrats en doublon détectés ({duplicateContractReports.length})
                </span>
                <span className="text-[11px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-mono font-bold">
                  {duplicateContractReports.reduce((acc, r) => acc + r.contracts.length, 0)} contrats concernés
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Certains contrats partagent le même numéro ({duplicateContractReports.map((r) => r.contractNumber).slice(0, 3).join(', ')}{duplicateContractReports.length > 3 ? '...' : ''}).
                La résolution automatique réattribue des numéros uniques et consécutifs tout en mettant à jour les cautions liées.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              const res = repairDuplicateContracts();
              if (res.renumberedCount > 0) {
                setSuccessToastMsg(
                  `${res.renumberedCount} contrat(s) en doublon ont été renumérotés avec succès avec de nouveaux numéros uniques.`
                );
              }
            }}
            className="flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs shrink-0 shadow-md transition-all cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4" />
            Corriger automatiquement les numéros
          </button>
        </div>
      )}

      {/* FILTER & SEARCH BAR */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-md flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher par N° contrat, client, téléphone, CIN, immatriculation..."
            className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Super Admin Manager Filter */}
        {!isManager && (
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 font-mono flex items-center gap-1 shrink-0">
              <Filter className="w-3.5 h-3.5 text-amber-400" />
              Responsable :
            </label>
            <select
              value={managerFilter}
              onChange={(e) => setManagerFilter(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
            >
              <option value="all">Tous ({contracts.length})</option>
              {(users || [])
                .filter((u) => u.role === 'manager')
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.assignedFleetName || 'Agence'})
                  </option>
                ))}
              <option value="unassigned">Sans responsable</option>
            </select>
          </div>
        )}

        {/* Filter Pills (Section 32) */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 overflow-x-auto">
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
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-[11px]">
            <span className="text-slate-500 px-1.5 font-medium flex items-center gap-1">
              <Banknote className="w-3 h-3 text-amber-400" />
              Règlement :
            </span>
            <button
              onClick={() => setPaymentFilter('all')}
              className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                paymentFilter === 'all'
                  ? 'bg-slate-800 text-white font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Tous
            </button>
            <button
              onClick={() => setPaymentFilter('paid')}
              className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                paymentFilter === 'paid'
                  ? 'bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/40'
                  : 'text-slate-400 hover:text-emerald-400'
              }`}
            >
              Soldés
            </button>
            <button
              onClick={() => setPaymentFilter('partial')}
              className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                paymentFilter === 'partial'
                  ? 'bg-amber-500/20 text-amber-400 font-bold border border-amber-500/40'
                  : 'text-slate-400 hover:text-amber-400'
              }`}
            >
              Acomptes
            </button>
            <button
              onClick={() => setPaymentFilter('unpaid')}
              className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                paymentFilter === 'unpaid'
                  ? 'bg-rose-500/20 text-rose-400 font-bold border border-rose-500/40'
                  : 'text-slate-400 hover:text-rose-400'
              }`}
            >
              Non payés
            </button>
          </div>

          {/* Contract Number Order Selector */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-[11px]">
            <span className="text-slate-500 px-1.5 font-medium flex items-center gap-1">
              <ArrowUpDown className="w-3 h-3 text-amber-400" />
              Ordre N° :
            </span>
            <button
              type="button"
              onClick={() => setSortOrder('desc')}
              className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                sortOrder === 'desc'
                  ? 'bg-amber-500/20 text-amber-400 font-bold border border-amber-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Classer selon les numéros de contrat décroissants (plus récent en premier)"
            >
              Décroissant (50 → 1)
            </button>
            <button
              type="button"
              onClick={() => setSortOrder('asc')}
              className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                sortOrder === 'asc'
                  ? 'bg-amber-500/20 text-amber-400 font-bold border border-amber-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Classer selon les numéros de contrat croissants (plus ancien en premier)"
            >
              Croissant (1 → 50)
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
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/70 text-slate-400 uppercase text-[10px] font-semibold border-b border-slate-800">
              <tr>
                <th className="px-4 py-3.5">
                  <button
                    type="button"
                    onClick={() => setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
                    className="flex items-center gap-1.5 text-slate-300 hover:text-amber-400 uppercase text-[10px] font-bold tracking-wider transition-colors cursor-pointer group text-left"
                    title={`Cliquer pour modifier l'ordre : actuellement ${
                      sortOrder === 'desc' ? 'Décroissant (50 → 1)' : 'Croissant (1 → 50)'
                    }`}
                  >
                    <span>Numéro & Créateur</span>
                    <span className="flex items-center gap-0.5 p-0.5 rounded bg-slate-800 group-hover:bg-amber-500/20 text-amber-400 transition-colors">
                      <ArrowUpDown className="w-3 h-3" />
                      <span className="text-[9px] font-mono font-bold">
                        {sortOrder === 'desc' ? '50→1' : '1→50'}
                      </span>
                    </span>
                  </button>
                </th>
                <th className="px-4 py-3.5">Locataire Principal</th>
                <th className="px-4 py-3.5">Véhicule & Immat</th>
                <th className="px-4 py-3.5">Période Location</th>
                <th className="px-4 py-3.5">KM & Carburant</th>
                <th className="px-4 py-3.5">Règlement & Solde</th>
                <th className="px-4 py-3.5">Statut</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredContracts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-500 text-xs">
                    Aucun contrat ne correspond à vos critères de recherche.
                  </td>
                </tr>
              ) : (
                filteredContracts.map((cnt) => (
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
                            title="Numéro en doublon partagé par plusieurs contrats"
                          >
                            <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />
                            Doublon
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {new Date(cnt.createdAt).toLocaleDateString('fr-FR')} • {cnt.createdBy}
                      </div>
                      <div className="text-[9px] text-slate-600 font-mono">
                        Conditions V{cnt.termsVersion}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border font-mono ${
                          cnt.templateId === 'prestige'
                            ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                            : cnt.templateId === 'corporate'
                            ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                            : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                        }`}>
                          {cnt.templateId === 'prestige' ? '★ VIP Prestige' : cnt.templateId === 'corporate' ? '🏢 Corporate B2B' : '📄 Standard'}
                        </span>
                        {cnt.clientSignature ? (
                          <span
                            className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.2 rounded"
                            title={`Signé numériquement le ${new Date(cnt.clientSignedAt || '').toLocaleDateString('fr-FR')}`}
                          >
                            <ShieldCheck className="w-2.5 h-2.5 text-emerald-400" />
                            Signé e-Sign
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 text-[8.5px] font-medium text-slate-400 bg-slate-800/80 border border-slate-700/60 px-1.5 py-0.2 rounded"
                            title="Signature numérique en attente"
                          >
                            <PenTool className="w-2 h-2 text-slate-500" />
                            À signer
                          </span>
                        )}
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
                      <div className="text-[10px] text-amber-400/90 font-medium">
                        {cnt.clientSnapshot.phone ? `📞 ${cnt.clientSnapshot.phone}` : <span className="text-slate-500 italic">📞 Tél non renseigné</span>}
                      </div>
                      {(cnt.clientSnapshot.licenseDocUrl || cnt.clientSnapshot.cinDocUrl) && (
                        <div className="text-[9px] text-emerald-400 font-mono mt-0.5">
                          ✓ Documents archivés
                        </div>
                      )}
                      {cnt.hasSecondDriver && (
                        <div className="text-[9px] text-slate-400 italic">
                          + 2e Conducteur : {cnt.secondDriverSnapshot?.lastName} {cnt.secondDriverSnapshot?.firstName}
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
                        Carburant : {cnt.vehicleSnapshot.fuelType}
                      </div>
                      {(() => {
                        const v = vehicles.find((item) => item.id === cnt.vehicleId || item.plate === cnt.vehicleSnapshot.plate);
                        return v?.assignedManagerName ? (
                          <div className="text-[10px] text-blue-300 font-mono mt-0.5 flex items-center gap-1">
                            <UserCheck className="w-3 h-3 text-blue-400 shrink-0" />
                            {v.assignedManagerName}
                          </div>
                        ) : null;
                      })()}
                    </td>

                    {/* DATES & DURÉE */}
                    <td className="px-4 py-3.5">
                      <div className="text-slate-200">
                        Du <strong>{new Date(cnt.startDate).toLocaleDateString('fr-FR')}</strong> ({cnt.startTime})
                      </div>
                      <div className="text-slate-200">
                        Au <strong>{new Date(cnt.prolongation?.isActive ? cnt.prolongation.newEndDate : cnt.endDate).toLocaleDateString('fr-FR')}</strong> ({cnt.prolongation?.isActive ? cnt.prolongation.newEndTime : cnt.endTime})
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Total : <span className="text-amber-400 font-semibold">{cnt.totalDays} jour(s)</span>
                      </div>
                    </td>

                    {/* KM & CARBURANT */}
                    <td className="px-4 py-3.5 font-mono">
                      <div>
                        Départ : <span className="text-white font-bold">{cnt.departureKm.toLocaleString()} KM</span>
                      </div>
                      <div className="text-[10.5px] text-amber-400 flex items-center gap-1 font-semibold mt-0.5">
                        <Fuel className="w-3 h-3 shrink-0" />
                        <span>{cnt.departureFuel || cnt.inspection?.departureChecklist?.fuelLevel || '8/8 (Plein)'}</span>
                      </div>
                      {cnt.returnKm ? (
                        <div className="text-emerald-400 mt-0.5">
                          Retour : <span className="font-bold">{cnt.returnKm.toLocaleString()} KM</span>
                          <span className="block text-[9px] text-slate-500">
                            (+{(cnt.returnKm - cnt.departureKm).toLocaleString()} KM)
                          </span>
                        </div>
                      ) : (
                        <div className="text-slate-500 text-[10px] mt-0.5">Retour : En cours</div>
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
                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-1 text-[11px]">
                              <span className="font-mono text-slate-300 font-bold">
                                {total.toLocaleString('fr-FR')} MAD
                              </span>
                              {isZeroTotal ? (
                                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 rounded font-mono">
                                  ✓ Soldé (0 MAD)
                                </span>
                              ) : isFullyPaid ? (
                                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 rounded font-mono">
                                  ✓ Soldé
                                </span>
                              ) : isPartiallyPaid ? (
                                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-400 bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 rounded font-mono">
                                  ⚡ Acompte
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-rose-400 bg-rose-500/15 border border-rose-500/30 px-1.5 py-0.5 rounded font-mono">
                                  ✕ Non payé
                                </span>
                              )}
                            </div>

                            <div className="text-[10px] font-mono text-slate-400 flex items-center justify-between">
                              <span>Tarif : {pricePerDay} MAD/j × {totalDays}j</span>
                            </div>

                            <div className="text-[10px] font-mono flex items-center justify-between">
                              <span className={paid > 0 ? 'text-emerald-400 font-semibold' : 'text-slate-400'}>
                                Encaissé: {paid.toLocaleString('fr-FR')}
                              </span>
                              <span className={remaining > 0 ? 'text-rose-400 font-bold' : isZeroTotal ? 'text-slate-400' : 'text-emerald-400 font-semibold'}>
                                Reste: {remaining.toLocaleString('fr-FR')}
                              </span>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setPaymentsModalContract(cnt)}
                                className="flex-1 text-left flex items-center justify-between text-[9.5px] text-amber-400/90 hover:text-amber-300 hover:bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 transition-colors cursor-pointer"
                                title="Gérer les règlements, modifier le tarif journalier ou le total"
                              >
                                <span className="flex items-center gap-1 font-semibold">
                                  <Banknote className="w-2.5 h-2.5" />
                                  {cnt.payments?.length || 0} versement(s)
                                </span>
                                <span className="text-amber-400 font-bold">Gérer &gt;</span>
                              </button>

                              {remaining > 0 && hasPermission('canCreateContracts') && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    settleContractBalance(cnt.id);
                                    setSuccessToastMsg(
                                      `Contrat ${cnt.contractNumber} soldé avec succès (règlement du reliquat de ${remaining.toLocaleString('fr-FR')} MAD enregistré).`
                                    );
                                  }}
                                  className="text-[9px] font-bold bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 border border-emerald-500/40 px-1.5 py-0.5 rounded transition-all cursor-pointer whitespace-nowrap"
                                  title={`Solder immédiatement le reliquat de ${remaining.toLocaleString('fr-FR')} MAD`}
                                >
                                  Solder ({remaining.toLocaleString('fr-FR')})
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </td>

                    {/* STATUT */}
                    <td className="px-4 py-3.5">{getStatusBadge(cnt.status)}</td>

                    {/* ACTIONS */}
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* 1. Aperçu PDF A4 2 pages */}
                        <button
                          onClick={() => openPdfModal(cnt)}
                          className="p-1.5 bg-slate-800 hover:bg-amber-500/20 text-slate-300 hover:text-amber-400 border border-slate-700 hover:border-amber-500/40 rounded-lg transition-colors cursor-pointer"
                          title="Aperçu du contrat 2 pages A4"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {/* 1b. Signature Numérique Directe */}
                        <button
                          onClick={() => setSigningContract(cnt)}
                          className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                            cnt.clientSignature
                              ? 'bg-emerald-950/60 hover:bg-emerald-900 text-emerald-400 border-emerald-500/40'
                              : 'bg-slate-800 hover:bg-amber-500/20 text-slate-300 hover:text-amber-400 border-slate-700 hover:border-amber-500/40'
                          }`}
                          title={
                            cnt.clientSignature
                              ? 'Signature électronique certifiée présente (cliquer pour gérer)'
                              : 'Recueillir la signature numérique sur écran'
                          }
                        >
                          <PenTool className="w-4 h-4" />
                        </button>

                        {/* 1c. Règlements & Paiements Clients */}
                        <button
                          onClick={() => setPaymentsModalContract(cnt)}
                          className="p-1.5 bg-slate-800 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-400 border border-slate-700 hover:border-emerald-500/40 rounded-lg transition-colors cursor-pointer"
                          title="Gérer les règlements clients, acomptes et solde"
                        >
                          <Banknote className="w-4 h-4" />
                        </button>

                        {/* 2. Modifier le contrat (Actif ou Brouillon) */}
                        {(cnt.status === 'active' || cnt.status === 'draft') && hasPermission('canEditContracts') && (
                          <button
                            onClick={() => startEditingContract(cnt)}
                            className="p-1.5 bg-slate-800 hover:bg-blue-500/20 text-slate-300 hover:text-blue-400 border border-slate-700 hover:border-blue-500/40 rounded-lg transition-colors cursor-pointer"
                            title="Modifier ce contrat complet"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        )}

                        {/* 2b. Modifier Carburant & KM Départ rapide */}
                        {(cnt.status === 'active' || cnt.status === 'draft') && hasPermission('canEditContracts') && (
                          <button
                            onClick={() => openFuelEdit(cnt)}
                            className="p-1.5 bg-slate-800 hover:bg-amber-500/20 text-slate-300 hover:text-amber-400 border border-slate-700 hover:border-amber-500/40 rounded-lg transition-colors cursor-pointer"
                            title="Modifier le carburant & KM de départ"
                          >
                            <Fuel className="w-4 h-4" />
                          </button>
                        )}

                        {/* 3. Imprimer */}
                        <button
                          onClick={() => openPdfModal(cnt)}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 rounded-lg transition-colors cursor-pointer"
                          title="Imprimer le contrat A4"
                        >
                          <Printer className="w-4 h-4" />
                        </button>

                        {/* 3b. Photos & État des Lieux Carrosserie */}
                        <button
                          onClick={() => setInspectionContract(cnt)}
                          className="p-1.5 bg-slate-800 hover:bg-amber-500/20 text-slate-300 hover:text-amber-400 border border-slate-700 hover:border-amber-500/40 rounded-lg transition-colors cursor-pointer relative"
                          title="Photos et fiche d'état des lieux du véhicule"
                        >
                          <Camera className="w-4 h-4" />
                          {cnt.inspection?.photos?.length ? (
                            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-500 text-slate-950 font-bold text-[8px] rounded-full flex items-center justify-center">
                              {cnt.inspection.photos.length}
                            </span>
                          ) : null}
                        </button>

                        {/* 4. Restituer / Check-in */}
                        {cnt.status === 'active' && hasPermission('canValidateContracts') && (
                          <button
                            onClick={() => onOpenCheckInModal(cnt)}
                            className="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 border border-emerald-500/40 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                            title="Clôturer le contrat lors de la restitution du véhicule"
                          >
                            <CheckSquare className="w-3.5 h-3.5" />
                            <span>Restituer</span>
                          </button>
                        )}

                        {/* 5. Dupliquer (Section 23) */}
                        {hasPermission('canCreateContracts') && (
                          <button
                            onClick={() => duplicateContract(cnt)}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 rounded-lg transition-colors cursor-pointer"
                            title="Dupliquer ce contrat pour une nouvelle location"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        )}

                        {/* 6. Annuler (Permission canCancelContracts) */}
                        {cnt.status === 'active' && hasPermission('canCancelContracts') && (
                          <button
                            onClick={() => handleCancel(cnt)}
                            className="p-1.5 bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-700 rounded-lg transition-colors cursor-pointer"
                            title="Annuler le contrat"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}

                        {/* 7. Supprimer définitivement (Gérant seul) */}
                        {canUserDeleteContracts && (
                          <button
                            onClick={() => {
                              setDeleteContractError(null);
                              setContractToDelete(cnt);
                            }}
                            className="p-1.5 bg-slate-800 hover:bg-rose-600/30 text-slate-500 hover:text-rose-400 border border-slate-700 hover:border-rose-500/40 rounded-lg transition-colors cursor-pointer"
                            title="Supprimer définitivement ce contrat (Gérant)"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL ÉTAT DES LIEUX & PHOTOS */}
      <InspectionManagerModal
        contract={inspectionContract}
        isOpen={!!inspectionContract}
        onClose={() => setInspectionContract(null)}
      />

      {/* MODAL MODIFICATION CARBURANT & KM DE DÉPART */}
      {fuelEditModalContract && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-500/15 text-amber-400 rounded-xl border border-amber-500/30">
                  <Fuel className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Carburant &amp; KM au Départ</h2>
                  <p className="text-xs text-slate-400 font-mono">
                    Contrat N° {fuelEditModalContract.contractNumber}
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
                <span className="text-slate-400 block">Véhicule :</span>
                <span className="font-bold text-white">
                  {fuelEditModalContract.vehicleSnapshot.brand} {fuelEditModalContract.vehicleSnapshot.model}
                </span>
              </div>
              <div className="text-right">
                <span className="text-slate-400 block">Immatriculation :</span>
                <span className="font-bold font-mono text-amber-400">
                  {fuelEditModalContract.vehicleSnapshot.plate}
                </span>
              </div>
            </div>

            <form onSubmit={handleSaveFuelEdit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1.5 flex items-center gap-1.5">
                  <Fuel className="w-4 h-4 text-amber-400" />
                  Niveau de Carburant au Départ *
                </label>
                <select
                  value={fuelEditForm.departureFuel}
                  onChange={(e) => setFuelEditForm({ ...fuelEditForm, departureFuel: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-white font-mono font-semibold focus:border-amber-500 focus:outline-none cursor-pointer"
                >
                  <option value="8/8 (Plein)">8/8 (Plein complet)</option>
                  <option value="7/8">7/8</option>
                  <option value="6/8 (3/4)">6/8 (3/4)</option>
                  <option value="5/8">5/8</option>
                  <option value="4/8 (1/2)">4/8 (1/2)</option>
                  <option value="3/8">3/8</option>
                  <option value="2/8 (1/4)">2/8 (1/4)</option>
                  <option value="1/8 (Réserve)">1/8 (Réserve)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1.5 flex items-center gap-1.5">
                  <Gauge className="w-4 h-4 text-slate-400" />
                  Kilométrage au Départ (Compteur) *
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
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl shadow-md shadow-amber-500/20 transition-transform active:scale-95 flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Enregistrer</span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-rose-500/40 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Supprimer ce contrat ?</h3>
                <p className="text-xs text-slate-400">Action irréversible réservée au Gérant</p>
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">N° Contrat :</span>
                <span className="text-amber-400 font-mono font-bold">{contractToDelete.contractNumber}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Client :</span>
                <span className="text-white font-semibold">
                  {contractToDelete.clientSnapshot.lastName} {contractToDelete.clientSnapshot.firstName}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Véhicule :</span>
                <span className="text-slate-300">
                  {contractToDelete.vehicleSnapshot.brand} {contractToDelete.vehicleSnapshot.model} ({contractToDelete.vehicleSnapshot.plate})
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Période :</span>
                <span className="text-slate-300">
                  Du {contractToDelete.startDate} au {contractToDelete.endDate}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Statut :</span>
                <span className={`font-semibold capitalize ${
                  contractToDelete.status === 'active' ? 'text-emerald-400' :
                  contractToDelete.status === 'completed' ? 'text-blue-400' : 'text-slate-400'
                }`}>
                  {contractToDelete.status === 'active' ? 'Actif (En cours)' :
                   contractToDelete.status === 'completed' ? 'Clôturé / Restitué' :
                   contractToDelete.status === 'cancelled' ? 'Annulé' : 'Brouillon'}
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
                ? '⚠️ Ce contrat est actuellement actif. Sa suppression libérera automatiquement le véhicule associé dans le parc comme disponible.'
                : 'La suppression de ce contrat effacera définitivement ses données et ses fiches de caution associées.'}
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
                Annuler
              </button>
              <button
                type="button"
                onClick={handleDeleteContractConfirm}
                className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-600/30 transition-all cursor-pointer active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Confirmer la suppression
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
              `Signature numérique certifiée enregistrée avec succès pour le contrat ${updated.contractNumber}`
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
              setSuccessToastMsg(`Règlement de ${p.amount} MAD enregistré sur le contrat ${updated.contractNumber}`);
              setTimeout(() => setSuccessToastMsg(''), 4000);
            }
          }}
          onUpdatePayment={(cId, pId, pData) => {
            const updated = updateContractPayment(cId, pId, pData, currentUser?.name);
            if (updated) {
              setSuccessToastMsg(`Paiement mis à jour avec succès sur le contrat ${updated.contractNumber}`);
              setTimeout(() => setSuccessToastMsg(''), 4000);
            }
          }}
          onDeletePayment={(cId, pId) => {
            const updated = deleteContractPayment(cId, pId, currentUser?.name);
            if (updated) {
              setSuccessToastMsg(`Paiement supprimé du contrat ${updated.contractNumber}`);
              setTimeout(() => setSuccessToastMsg(''), 4000);
            }
          }}
          onUpdateFinancials={(cId, fin) => {
            const updated = updateContractFinancials(cId, fin, currentUser?.name);
            if (updated) {
              setSuccessToastMsg(`Tarification du contrat ${updated.contractNumber} mise à jour (${fin.totalAmount} MAD)`);
              setTimeout(() => setSuccessToastMsg(''), 4000);
            }
          }}
          currentUserName={currentUser?.name || 'Direction'}
        />
      )}
    </div>
  );
};
