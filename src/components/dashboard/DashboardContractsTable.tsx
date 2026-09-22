import React, { useState } from 'react';
import {
  FileText,
  Search,
  CheckCircle2,
  Clock,
  Eye,
  Printer,
  Copy,
  CheckSquare,
  ArrowRight,
  User,
  Phone,
  Calendar,
  Sparkles,
  ArrowUpDown,
} from 'lucide-react';
import { Contract } from '../../types';
import { formatPlateFrench } from '../../utils/plateUtils';
import { sortContractsByNumber } from '../../utils/contractNumberUtils';

interface DashboardContractsTableProps {
  contracts: Contract[];
  onOpenPdf: (contract: Contract) => void;
  onOpenCheckInModal: (contract: Contract) => void;
  onDuplicateContract: (contract: Contract) => void;
  onViewAllContracts: () => void;
}

export const DashboardContractsTable: React.FC<DashboardContractsTableProps> = ({
  contracts,
  onOpenPdf,
  onOpenCheckInModal,
  onDuplicateContract,
  onViewAllContracts,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'prolonged'>('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  const filteredContracts = contracts
    .filter((c) => {
      // Status filter
      if (statusFilter === 'active' && c.status !== 'active') return false;
      if (statusFilter === 'completed' && c.status !== 'completed') return false;
      if (statusFilter === 'prolonged' && !c.prolongation?.isActive) return false;

      // Search query
      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase();
      const contractNum = c.contractNumber.toLowerCase();
      const clientName = `${c.clientSnapshot.firstName} ${c.clientSnapshot.lastName}`.toLowerCase();
      const docNum = (c.clientSnapshot.docNumber || '').toLowerCase();
      const car = `${c.vehicleSnapshot.brand} ${c.vehicleSnapshot.model} ${c.vehicleSnapshot.plate}`.toLowerCase();
      const manager = (c.assignedManagerName || '').toLowerCase();

      return (
        contractNum.includes(q) ||
        clientName.includes(q) ||
        docNum.includes(q) ||
        car.includes(q) ||
        manager.includes(q)
      );
    });

  const sortedContracts = sortContractsByNumber(filteredContracts, sortOrder);

  const getStatusBadge = (cnt: Contract) => {
    if (cnt.prolongation?.isActive && cnt.status === 'active') {
      return (
        <span className="inline-flex items-center gap-1 bg-purple-500/15 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full text-xs font-semibold">
          <Clock className="w-3 h-3 text-purple-400" />
          Prolongé ({cnt.prolongation.newEndDate})
        </span>
      );
    }

    switch (cnt.status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full text-xs font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Actif / En cours
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 bg-blue-500/15 text-blue-400 border border-blue-500/30 px-2.5 py-0.5 rounded-full text-xs font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Restitué / Clôturé
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

  const activeCount = contracts.filter((c) => c.status === 'active').length;
  const completedCount = contracts.filter((c) => c.status === 'completed').length;
  const prolongedCount = contracts.filter((c) => c.prolongation?.isActive).length;

  return (
    <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl shadow-lg overflow-hidden space-y-0">
      {/* HEADER & CONTROLS */}
      <div className="p-5 border-b border-slate-800 space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-bold text-white tracking-tight">
                Registre Opérationnel des Contrats
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Suivi exhaustif des locations, états de caution, gestionnaire assigné et actions instantanées
            </p>
          </div>

          <button
            onClick={onViewAllContracts}
            className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 self-start sm:self-center cursor-pointer"
          >
            Tous les contrats archivés ({contracts.length}) <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* SEARCH & STATUS TABS */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
          {/* Search bar */}
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher par N° contrat, client, plaque, manager..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
            />
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          </div>

          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-950/80 border border-slate-800 rounded-xl text-xs overflow-x-auto">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === 'all'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Tous ({contracts.length})
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                statusFilter === 'active'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-emerald-400 hover:text-emerald-300'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              En cours ({activeCount})
            </button>
            <button
              onClick={() => setStatusFilter('completed')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === 'completed'
                  ? 'bg-blue-500 text-slate-950 shadow-sm'
                  : 'text-blue-400 hover:text-blue-300'
              }`}
            >
              Restitués ({completedCount})
            </button>
            <button
              onClick={() => setStatusFilter('prolonged')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === 'prolonged'
                  ? 'bg-purple-500 text-slate-950 shadow-sm'
                  : 'text-purple-400 hover:text-purple-300'
              }`}
            >
              Prolongés ({prolongedCount})
            </button>
          </div>
        </div>
      </div>

      {/* CONTRACTS TABLE */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] font-semibold border-b border-slate-800">
            <tr>
              <th className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
                  className="flex items-center gap-1.5 text-slate-300 hover:text-amber-400 uppercase text-[10px] font-bold tracking-wider transition-colors cursor-pointer group text-left"
                  title={`Cliquer pour inverser le tri : actuellement ${
                    sortOrder === 'desc' ? 'Décroissant (50 → 1)' : 'Croissant (1 → 50)'
                  }`}
                >
                  <span>N° Contrat &amp; Responsable</span>
                  <span className="flex items-center gap-0.5 p-0.5 rounded bg-slate-800 group-hover:bg-amber-500/20 text-amber-400 transition-colors">
                    <ArrowUpDown className="w-3 h-3" />
                    <span className="text-[9px] font-mono font-bold">
                      {sortOrder === 'desc' ? '50→1' : '1→50'}
                    </span>
                  </span>
                </button>
              </th>
              <th className="px-4 py-3">Locataire Principal</th>
              <th className="px-4 py-3">Véhicule Attribué</th>
              <th className="px-4 py-3">Période &amp; Montants</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3 text-right">Actions Rapides</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {filteredContracts.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  Aucun contrat ne correspond aux critères de recherche.
                </td>
              </tr>
            ) : (
              sortedContracts.slice(0, 8).map((cnt) => {
                const effectiveEndDate = cnt.prolongation?.isActive
                  ? cnt.prolongation.newEndDate
                  : cnt.endDate;

                return (
                  <tr key={cnt.id} className="hover:bg-slate-850/60 transition-colors">
                    {/* N° CONTRAT & MANAGER */}
                    <td className="px-4 py-3">
                      <div className="font-mono font-black text-amber-400 text-xs">
                        {cnt.contractNumber}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Créé le {new Date(cnt.createdAt).toLocaleDateString('fr-FR')}
                      </div>
                      {cnt.assignedManagerName && (
                        <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <User className="w-2.5 h-2.5 text-amber-400" />
                          <span>{cnt.assignedManagerName}</span>
                          {cnt.managerPhone && (
                            <span className="text-amber-400/90 font-mono font-bold">
                              • {cnt.managerPhone}
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* CLIENT */}
                    <td className="px-4 py-3">
                      <div className="font-bold text-white text-xs">
                        {cnt.clientSnapshot.lastName} {cnt.clientSnapshot.firstName}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {cnt.clientSnapshot.docType} :{' '}
                        <strong className="text-slate-300 font-mono">
                          {cnt.clientSnapshot.docNumber}
                        </strong>
                        {cnt.clientSnapshot.country && ` • ${cnt.clientSnapshot.country}`}
                      </div>
                      {cnt.clientSnapshot.phone && (
                        <div className="text-[10px] text-amber-400 font-mono flex items-center gap-1 mt-0.5">
                          <Phone className="w-2.5 h-2.5" />
                          <span>{cnt.clientSnapshot.phone}</span>
                        </div>
                      )}
                    </td>

                    {/* VÉHICULE */}
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-200">
                        {cnt.vehicleSnapshot.brand} {cnt.vehicleSnapshot.model}
                      </div>
                      <div className="text-[10.5px] font-mono text-amber-400 font-semibold mt-0.5">
                        {formatPlateFrench(cnt.vehicleSnapshot.plate)}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {cnt.vehicleSnapshot.fuelType} • Départ: {cnt.departureKm?.toLocaleString('fr-FR')} KM
                      </div>
                    </td>

                    {/* PÉRIODE & FINANCES */}
                    <td className="px-4 py-3">
                      <div className="text-slate-200 text-xs">
                        Du {new Date(cnt.startDate).toLocaleDateString('fr-FR')} au{' '}
                        {new Date(effectiveEndDate).toLocaleDateString('fr-FR')}
                      </div>
                      <div className="text-[11px] text-amber-400 font-mono font-bold mt-0.5">
                        Total : {cnt.totalAmount?.toLocaleString('fr-FR') || 0} DH{' '}
                        <span className="text-[10px] text-slate-400 font-normal">
                          ({cnt.totalDays} jours)
                        </span>
                      </div>
                      <div className="text-[10px] text-purple-300 font-mono">
                        Caution : {cnt.depositAmount?.toLocaleString('fr-FR') || 5000} DH
                      </div>
                    </td>

                    {/* STATUT */}
                    <td className="px-4 py-3">{getStatusBadge(cnt)}</td>

                    {/* ACTIONS */}
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Aperçu PDF */}
                        <button
                          onClick={() => onOpenPdf(cnt)}
                          className="p-1.5 bg-slate-800 hover:bg-amber-500/20 text-slate-300 hover:text-amber-400 border border-slate-700 hover:border-amber-500/40 rounded-lg transition-colors cursor-pointer"
                          title="Aperçu du contrat 2 pages A4"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {/* Imprimer direct */}
                        <button
                          onClick={() => onOpenPdf(cnt)}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 rounded-lg transition-colors cursor-pointer"
                          title="Imprimer le contrat"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>

                        {/* Clôturer / Check-in */}
                        {cnt.status === 'active' && (
                          <button
                            onClick={() => onOpenCheckInModal(cnt)}
                            className="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 border border-emerald-500/40 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                            title="Clôturer le contrat (Restitution du véhicule)"
                          >
                            <CheckSquare className="w-3 h-3" />
                            <span>Restituer</span>
                          </button>
                        )}

                        {/* Dupliquer */}
                        <button
                          onClick={() => onDuplicateContract(cnt)}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 rounded-lg transition-colors cursor-pointer"
                          title="Dupliquer pour une nouvelle location"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* FOOTER */}
      <div className="p-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-400 bg-slate-950/40">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>
            Affichage des {Math.min(8, filteredContracts.length)} plus récents sur un total de{' '}
            <strong className="text-white">{contracts.length}</strong> contrats archivés.
          </span>
        </div>
        <button
          onClick={onViewAllContracts}
          className="text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 self-start sm:self-center cursor-pointer"
        >
          Accéder à la gestion complète des contrats <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
