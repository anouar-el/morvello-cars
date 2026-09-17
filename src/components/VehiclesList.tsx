import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Vehicle, VehicleStatus } from '../types';
import {
  Car,
  Search,
  CheckCircle2,
  PlusCircle,
  Upload,
  Download,
  FileSpreadsheet,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { getVehicleHealthSummary } from '../utils/vehicleExpiryUtils';
import { VehicleCard } from './vehicles/VehicleCard';
import { VehicleAddModal } from './vehicles/VehicleAddModal';
import { VehicleEditModal } from './vehicles/VehicleEditModal';
import { VehicleDeleteModal } from './vehicles/VehicleDeleteModal';
import { VehicleImportModal } from './vehicles/VehicleImportModal';
import { PendingApprovalsBanner } from './vehicles/PendingApprovalsBanner';
import { VehicleMaintenanceModal } from './vehicles/VehicleMaintenanceModal';

export const VehiclesList: React.FC = () => {
  const {
    vehicles,
    addVehicle,
    updateVehicle,
    approveVehicle,
    rejectVehicle,
    deleteVehicle,
    addVehicleExpense,
    deleteVehicleExpense,
    contracts,
    openPdfModal,
    currentUser,
    users,
    hasPermission,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [managerFilter, setManagerFilter] = useState<string>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [vehicleForMaintenance, setVehicleForMaintenance] = useState<Vehicle | null>(null);
  const [vehicleToDelete, setVehicleToDelete] = useState<Vehicle | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);

  const gerantName = users.find((u) => u.role === 'admin')?.name || 'Anouar';
  const isManager = currentUser?.role === 'manager';
  const isAdmin = currentUser?.role === 'admin';
  const isAgent = currentUser?.role === 'agent';
  const managers = (users || []).filter((u) => u.role === 'manager');

  const triggerToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => {
      setSuccessToast(null);
    }, 3500);
  };

  const handleDeleteVehicleConfirm = () => {
    if (!vehicleToDelete) return;
    setDeleteError(null);

    const res = deleteVehicle(vehicleToDelete.id);
    if (!res.success) {
      setDeleteError(res.error || 'Impossible de supprimer ce véhicule.');
      return;
    }

    triggerToast(
      `Véhicule ${vehicleToDelete.brand} ${vehicleToDelete.model} (${vehicleToDelete.plate}) supprimé avec succès.`
    );
    setVehicleToDelete(null);
    setDeleteError(null);
    if (editingVehicle?.id === vehicleToDelete.id) {
      setEditingVehicle(null);
    }
  };

  const handleStatusToggle = (veh: Vehicle) => {
    const newStatus: VehicleStatus =
      veh.status === 'available'
        ? 'maintenance'
        : veh.status === 'maintenance'
        ? 'available'
        : veh.status;
    updateVehicle(veh.id, { status: newStatus });
    triggerToast(`Statut du véhicule ${veh.plate} mis à jour : ${newStatus}`);
  };

  const canUserDeleteVehicles = isAdmin || isManager || hasPermission('canDeleteVehicles');

  // SÉCURITÉ / VULNÉRABILITÉS XLSX (SheetJS) :
  // Référence CVE / Advisories : GHSA-4r6h-8v6p-xvw6 (Prototype Pollution) & GHSA-5pgg-2g8v-p4x9 (ReDoS).
  // La librairie xlsx ne disposant pas de correctif officiel pour ces failles de parsing de fichiers non fiables,
  // l'importation de fichiers Excel (.xlsx) est strictement restreinte aux administrateurs (rôle 'admin')
  // afin de limiter la surface d'exposition.
  const canImportVehicles = isAdmin || hasPermission('canImportVehiclesExcel');

  // Filter vehicles: managers strictly see their assigned or proposed vehicles, agents see fleet + their proposals
  const filteredVehicles = vehicles.filter((v) => {
    if (isManager) {
      const isMine = v.assignedManagerId === currentUser.id || v.proposedBy === currentUser.name;
      if (!isMine) return false;
    }

    if (isAgent) {
      const isApprovedOrProposedByMe =
        v.approvalStatus === 'approved' || v.proposedBy === currentUser.name;
      if (!isApprovedOrProposedByMe) return false;
    }

    if (isAdmin && managerFilter !== 'all') {
      if (managerFilter === 'unassigned' && v.assignedManagerId) return false;
      if (managerFilter !== 'unassigned' && v.assignedManagerId !== managerFilter) return false;
    }

    if (statusFilter === 'alerts') {
      const summary = getVehicleHealthSummary(v);
      if (!summary.hasAlert) return false;
    } else if (statusFilter !== 'all' && v.status !== statusFilter) {
      return false;
    }

    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      v.brand.toLowerCase().includes(q) ||
      v.model.toLowerCase().includes(q) ||
      v.plate.toLowerCase().includes(q) ||
      v.fuelType.toLowerCase().includes(q) ||
      (v.assignedManagerName && v.assignedManagerName.toLowerCase().includes(q))
    );
  });

  const pendingApprovalVehicles = vehicles.filter((v) => v.approvalStatus === 'pending_approval');
  const myPendingVehicles = vehicles.filter(
    (v) =>
      v.approvalStatus === 'pending_approval' &&
      (v.proposedBy === currentUser.name || v.assignedManagerId === currentUser.id)
  );

  const exportVehiclesToCSV = () => {
    const headers = [
      'Marque',
      'Modèle',
      'Immatriculation',
      'Carburant',
      'Statut',
      'Kilométrage',
      'Tarif_Journalier_MAD',
      'Année',
      'Couleur',
      'Responsable',
      'Compagnie_Assurance',
      'Expiration_Assurance',
      'Expiration_Controle_Tech',
      'Vignette_Payee_Annee',
      'Prochaine_Vidange_KM',
      'Total_Depenses_Entretien_MAD',
      'Nb_Interventions_Entretien',
      'Date_Achat',
      'Notes',
    ];

    const rows = vehicles.map((v) => {
      const exps = v.maintenanceExpenses || [];
      const totalExpCost = exps.reduce((s, e) => s + (e.costMAD || 0), 0);
      return [
        `"${v.brand}"`,
        `"${v.model}"`,
        `"${v.plate}"`,
        `"${v.fuelType}"`,
        `"${v.status}"`,
        v.currentKm || 0,
        v.dailyRate || 0,
        v.year || '',
        `"${v.color || ''}"`,
        `"${v.assignedManagerName || ''}"`,
        `"${v.insuranceCompany || ''}"`,
        `"${v.insuranceExpiryDate || ''}"`,
        `"${v.technicalInspectionExpiryDate || ''}"`,
        v.vignettePaidYear || '',
        v.nextOilChangeKm || '',
        totalExpCost,
        exps.length,
        `"${v.purchaseDate || ''}"`,
        `"${(v.notes || '').replace(/"/g, '""')}"`,
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((e) => e.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `parc_morvello_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    triggerToast('Exportation CSV (séparateur point-virgule) téléchargée.');
  };

  const exportVehiclesToExcel = () => {
    try {
      const headers = [
        'Marque',
        'Modèle',
        'Immatriculation',
        'Carburant',
        'Statut',
        'Kilométrage',
        'Tarif_Journalier_MAD',
        'Année',
        'Couleur',
        'Responsable',
        'Compagnie_Assurance',
        'Expiration_Assurance',
        'Expiration_Controle_Tech',
        'Vignette_Payee_Annee',
        'Prochaine_Vidange_KM',
        'Total_Depenses_Entretien_MAD',
        'Nb_Interventions_Entretien',
        'Date_Achat',
        'Notes',
      ];

      const rows = vehicles.map((v) => {
        const exps = v.maintenanceExpenses || [];
        const totalExpCost = exps.reduce((s, e) => s + (e.costMAD || 0), 0);
        return [
          v.brand,
          v.model,
          v.plate,
          v.fuelType,
          v.status,
          v.currentKm || 0,
          v.dailyRate || 0,
          v.year || '',
          v.color || '',
          v.assignedManagerName || '',
          v.insuranceCompany || '',
          v.insuranceExpiryDate || '',
          v.technicalInspectionExpiryDate || '',
          v.vignettePaidYear || '',
          v.nextOilChangeKm || '',
          totalExpCost,
          exps.length,
          v.purchaseDate || '',
          v.notes || '',
        ];
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      ws['!cols'] = [
        { wch: 16 },
        { wch: 28 },
        { wch: 18 },
        { wch: 14 },
        { wch: 14 },
        { wch: 14 },
        { wch: 22 },
        { wch: 10 },
        { wch: 18 },
        { wch: 20 },
        { wch: 22 },
        { wch: 20 },
        { wch: 22 },
        { wch: 16 },
        { wch: 22 },
        { wch: 24 },
        { wch: 22 },
        { wch: 14 },
        { wch: 40 },
      ];
      XLSX.utils.book_append_sheet(wb, ws, 'Parc_Morvello');
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `parc_morvello_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      triggerToast('Exportation Excel (.xlsx) téléchargée avec succès.');
    } catch {
      exportVehiclesToCSV();
    }
  };

  return (
    <div className="space-y-6">
      {/* TOAST SUCCESS */}
      {successToast && (
        <div className="fixed top-20 right-6 z-50 bg-emerald-950 border border-emerald-500/50 text-emerald-200 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-4 duration-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs font-semibold">{successToast}</span>
        </div>
      )}

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-widest font-mono">
            <Car className="w-4 h-4" />
            Module Flotte & Parc Automobile • Section 9
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight mt-1 flex items-center gap-2.5">
            <span>Parc Automobile & Flottes Assignées</span>
            {isManager && (
              <span className="text-xs font-medium bg-blue-500/20 text-blue-300 border border-blue-500/40 px-2.5 py-0.5 rounded-full font-mono">
                Vue Responsable : {currentUser.assignedFleetName || currentUser.name}
              </span>
            )}
            {isAgent && (
              <span className="text-xs font-medium bg-purple-500/20 text-purple-300 border border-purple-500/40 px-2.5 py-0.5 rounded-full font-mono">
                Vue Agent : {currentUser.name}
              </span>
            )}
            {isAdmin && (
              <span className="text-xs font-medium bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2.5 py-0.5 rounded-full font-mono">
                👑 Super Admin / Gérant
              </span>
            )}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {isAdmin
              ? `Gestion centrale Gérant : affectation des véhicules aux responsables, approbation obligatoire de tous les ajouts et supervision de la flotte.`
              : isManager
              ? `Accès Responsable : flotte assignée à votre agence. L'ajout de véhicules est ouvert mais soumis à l'approbation du Gérant.`
              : `Accès Collaborateur : consultation de la flotte. L'ajout de véhicules est ouvert à tous sous approbation du Gérant.`}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={exportVehiclesToExcel}
            className="flex items-center gap-1.5 bg-emerald-700/80 hover:bg-emerald-600 text-white px-3 py-2 rounded-xl text-xs font-semibold shadow-sm transition-colors cursor-pointer"
            title="Télécharger toute la flotte au format Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export Excel</span>
          </button>

          <button
            onClick={exportVehiclesToCSV}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 px-3 py-2 rounded-xl text-xs font-semibold shadow-sm transition-colors cursor-pointer"
            title="Télécharger la flotte au format CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          {/*
            SÉCURITÉ / VULNÉRABILITÉ XLSX :
            Bouton d'importation masqué pour les non-administrateurs afin d'éviter l'exposition
            aux vulnérabilités de parsing de la librairie xlsx (SheetJS).
          */}
          {canImportVehicles && (
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 px-3 py-2 rounded-xl text-xs font-semibold shadow-sm transition-colors cursor-pointer"
              title="Importer la flotte réelle depuis un fichier Excel (.xlsx) ou CSV (Réservé Administrateur)"
            >
              <Upload className="w-3.5 h-3.5 text-blue-400" />
              <span>Importer Parc Réel</span>
            </button>
          )}

          <button
            onClick={() => setIsAddModalOpen(true)}
            className={`flex items-center gap-2 font-bold px-4 py-2 rounded-xl text-xs sm:text-sm shadow-md transition-all cursor-pointer ${
              isAdmin
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-amber-500/20'
                : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-white shadow-blue-500/20'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            {isAdmin ? '+ Nouveau Véhicule (Gérant)' : '+ Proposer un Véhicule (Soumis au Gérant)'}
          </button>
        </div>
      </div>

      {/* PENDING APPROVALS SECTION */}
      <PendingApprovalsBanner
        isAdmin={isAdmin}
        pendingApprovalVehicles={pendingApprovalVehicles}
        myPendingVehicles={myPendingVehicles}
        managers={managers}
        gerantName={gerantName}
        onApprove={approveVehicle}
        onReject={rejectVehicle}
        onToast={triggerToast}
      />

      {/* SEARCH & FILTERS */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-md flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher par marque, modèle, immatriculation, responsable..."
            className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* ADMIN FILTER BY MANAGER */}
        {isAdmin && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400 whitespace-nowrap hidden lg:inline">
              Responsable :
            </span>
            <select
              value={managerFilter}
              onChange={(e) => setManagerFilter(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:border-amber-500 focus:outline-none cursor-pointer"
            >
              <option value="all">Tous les responsables</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.assignedFleetName || m.agency})
                </option>
              ))}
              <option value="unassigned">Non affectés</option>
            </select>
          </div>
        )}

        <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
          {[
            { id: 'all', label: 'Tous' },
            { id: 'available', label: 'Disponibles' },
            { id: 'rented', label: 'Loués' },
            { id: 'maintenance', label: 'Maintenance' },
            {
              id: 'alerts',
              label: `⚠️ Échéances & Alertes (${
                vehicles.filter((v) => getVehicleHealthSummary(v).hasAlert).length
              })`,
            },
            { id: 'inactive', label: 'Inactifs' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                  : tab.id === 'alerts' &&
                    vehicles.some((v) => getVehicleHealthSummary(v).criticalCount > 0)
                  ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-500/25'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* VEHICLES GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredVehicles.map((veh) => {
          const activeContract = contracts.find(
            (c) => c.vehicleId === veh.id && c.status === 'active'
          );

          return (
            <VehicleCard
              key={veh.id}
              vehicle={veh}
              activeContract={activeContract}
              canDelete={canUserDeleteVehicles}
              onEdit={(v) => setEditingVehicle(v)}
              onStatusToggle={handleStatusToggle}
              onDeleteRequest={(v) => {
                setDeleteError(null);
                setVehicleToDelete(v);
              }}
              onOpenPdfModal={openPdfModal}
              onOpenMaintenanceModal={(v) => setVehicleForMaintenance(v)}
            />
          );
        })}
      </div>

      {/* MODAL MODIFIER UN VÉHICULE */}
      <VehicleEditModal
        vehicle={editingVehicle}
        currentUser={currentUser}
        users={users}
        canDelete={canUserDeleteVehicles}
        onClose={() => setEditingVehicle(null)}
        onSave={(id, updatedData) => {
          updateVehicle(id, updatedData);
          triggerToast('Véhicule mis à jour avec succès !');
        }}
        onDeleteRequest={(v) => {
          setDeleteError(null);
          setVehicleToDelete(v);
        }}
        onOpenMaintenanceModal={(v) => setVehicleForMaintenance(v)}
      />

      {/* MODAL CARNET D'ENTRETIEN & VIDANGES */}
      <VehicleMaintenanceModal
        vehicle={
          vehicleForMaintenance
            ? vehicles.find((v) => v.id === vehicleForMaintenance.id) || vehicleForMaintenance
            : null
        }
        isOpen={!!vehicleForMaintenance}
        onClose={() => setVehicleForMaintenance(null)}
        onAddExpense={(vehicleId, expenseData) => {
          addVehicleExpense(vehicleId, expenseData);
          triggerToast(`Dépense d'entretien enregistrée (${expenseData.costMAD} MAD) !`);
        }}
        onDeleteExpense={(vehicleId, expenseId) => {
          deleteVehicleExpense(vehicleId, expenseId);
          triggerToast("Dépense d'entretien supprimée.");
        }}
        canManage={
          isAdmin ||
          isManager ||
          hasPermission('canManageMaintenanceExpenses') ||
          hasPermission('canEditVehicles')
        }
        currentUser={currentUser}
      />

      {/* MODAL AJOUTER UN VÉHICULE */}
      <VehicleAddModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddVehicle={addVehicle}
        currentUser={currentUser}
        users={users}
        onToast={triggerToast}
      />

      {/* MODAL SUPPRESSION VÉHICULE */}
      <VehicleDeleteModal
        vehicle={vehicleToDelete}
        deleteError={deleteError}
        onClose={() => {
          setVehicleToDelete(null);
          setDeleteError(null);
        }}
        onConfirm={handleDeleteVehicleConfirm}
      />

      {/* MODAL IMPORTATION DU PARC */}
      <VehicleImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onAddVehicle={addVehicle}
        users={users}
        currentUser={currentUser}
        onToast={triggerToast}
      />
    </div>
  );
};
