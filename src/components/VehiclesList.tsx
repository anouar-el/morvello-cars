import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Vehicle, VehicleStatus, FuelType } from '../types';
import { formatPlateFrench } from '../utils/plateUtils';
import {
  Car,
  Search,
  Plus,
  Gauge,
  Fuel,
  Wrench,
  CheckCircle2,
  X,
  PlusCircle,
  AlertTriangle,
  FileText,
  Pencil,
  Save,
  Calendar,
  DollarSign,
  UserCheck,
  Crown,
  ShieldCheck,
  Check,
  Layers,
  Lock,
  Shield,
  FileCheck,
  Award,
  AlertOctagon,
  Trash2,
  Upload,
  Download,
  FileSpreadsheet,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { VehicleCompliancePanel } from './vehicles/VehicleCompliancePanel';
import { getVehicleHealthSummary } from '../utils/vehicleExpiryUtils';

export const VehiclesList: React.FC = () => {
  const {
    vehicles,
    addVehicle,
    updateVehicle,
    approveVehicle,
    rejectVehicle,
    assignVehicleManager,
    deleteVehicle,
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
  const [vehicleToDelete, setVehicleToDelete] = useState<Vehicle | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [importText, setImportText] = useState<string>('');
  const [importError, setImportError] = useState<string | null>(null);
  const gerantName = users.find((u) => u.role === 'admin')?.name || 'Anouar';

  const isManager = currentUser?.role === 'manager';
  const isAdmin = currentUser?.role === 'admin';
  const isAgent = currentUser?.role === 'agent';
  const managers = (users || []).filter((u) => u.role === 'manager');
  const [approvalManagerSelections, setApprovalManagerSelections] = useState<Record<string, string>>({});

  const [newVehicleForm, setNewVehicleForm] = useState({
    brand: '',
    model: '',
    plate: '',
    fuelType: 'Diesel' as FuelType,
    status: 'available' as VehicleStatus,
    currentKm: 30000,
    dailyRate: 400,
    year: 2024,
    color: 'Blanc',
    notes: '',
    lastInspectionDate: '',
    insuranceExpiryDate: '',
    insuranceCompany: 'Wafa Assurance',
    technicalInspectionExpiryDate: '',
    vignettePaidYear: 2026,
    nextOilChangeKm: 40000,
    assignedManagerId: isManager ? currentUser.id : '',
  });

  const [editForm, setEditForm] = useState<{
    brand: string;
    model: string;
    plate: string;
    fuelType: FuelType;
    status: VehicleStatus;
    currentKm: number;
    dailyRate: number;
    year: number;
    color: string;
    notes: string;
    lastInspectionDate: string;
    insuranceExpiryDate: string;
    insuranceCompany: string;
    technicalInspectionExpiryDate: string;
    vignettePaidYear: number;
    nextOilChangeKm?: number;
    assignedManagerId: string;
  }>({
    brand: '',
    model: '',
    plate: '',
    fuelType: 'Diesel',
    status: 'available',
    currentKm: 0,
    dailyRate: 400,
    year: 2024,
    color: '',
    notes: '',
    lastInspectionDate: '',
    insuranceExpiryDate: '',
    insuranceCompany: '',
    technicalInspectionExpiryDate: '',
    vignettePaidYear: 2026,
    nextOilChangeKm: undefined,
    assignedManagerId: '',
  });

  const triggerToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => {
      setSuccessToast(null);
    }, 3500);
  };

  const handleOpenEdit = (veh: Vehicle) => {
    setEditingVehicle(veh);
    setEditForm({
      brand: veh.brand || '',
      model: veh.model || '',
      plate: veh.plate || '',
      fuelType: veh.fuelType || 'Diesel',
      status: veh.status || 'available',
      currentKm: veh.currentKm ?? 0,
      dailyRate: veh.dailyRate ?? 400,
      year: veh.year ?? 2024,
      color: veh.color || '',
      notes: veh.notes || '',
      lastInspectionDate: veh.lastInspectionDate || '',
      insuranceExpiryDate: veh.insuranceExpiryDate || '',
      insuranceCompany: veh.insuranceCompany || '',
      technicalInspectionExpiryDate: veh.technicalInspectionExpiryDate || '',
      vignettePaidYear: veh.vignettePaidYear ?? 2026,
      nextOilChangeKm: veh.nextOilChangeKm,
      assignedManagerId: veh.assignedManagerId || '',
    });
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVehicle) return;

    if (!editForm.brand.trim() || !editForm.model.trim() || !editForm.plate.trim()) {
      alert('Veuillez remplir les informations obligatoires (Marque, Modèle, Immatriculation).');
      return;
    }

    const assignedUser = users.find((u) => u.id === editForm.assignedManagerId);

    // Only admin can reassign manager; manager preserves existing assignment
    const finalAssignedManagerId = isAdmin
      ? editForm.assignedManagerId || undefined
      : editingVehicle.assignedManagerId;

    const finalAssignedManagerName = isAdmin
      ? assignedUser?.name || undefined
      : editingVehicle.assignedManagerName;

    updateVehicle(editingVehicle.id, {
      brand: editForm.brand.trim().toUpperCase(),
      model: editForm.model.trim(),
      plate: formatPlateFrench(editForm.plate.trim()),
      fuelType: editForm.fuelType,
      status: editForm.status,
      currentKm: Number(editForm.currentKm),
      dailyRate: Number(editForm.dailyRate),
      year: Number(editForm.year),
      color: editForm.color.trim(),
      notes: editForm.notes.trim(),
      lastInspectionDate: editForm.lastInspectionDate,
      insuranceExpiryDate: editForm.insuranceExpiryDate || undefined,
      insuranceCompany: editForm.insuranceCompany.trim() || undefined,
      technicalInspectionExpiryDate: editForm.technicalInspectionExpiryDate || undefined,
      vignettePaidYear: editForm.vignettePaidYear ? Number(editForm.vignettePaidYear) : undefined,
      nextOilChangeKm: editForm.nextOilChangeKm ? Number(editForm.nextOilChangeKm) : undefined,
      assignedManagerId: finalAssignedManagerId,
      assignedManagerName: finalAssignedManagerName,
    });

    triggerToast(`Véhicule ${editForm.brand} ${editForm.model} (${editForm.plate}) mis à jour avec succès !`);
    setEditingVehicle(null);
  };

  const handleDeleteVehicleConfirm = () => {
    if (!vehicleToDelete) return;
    setDeleteError(null);

    const res = deleteVehicle(vehicleToDelete.id);
    if (!res.success) {
      setDeleteError(res.error || 'Impossible de supprimer ce véhicule.');
      return;
    }

    triggerToast(`Véhicule ${vehicleToDelete.brand} ${vehicleToDelete.model} (${vehicleToDelete.plate}) supprimé avec succès.`);
    setVehicleToDelete(null);
    setDeleteError(null);
    if (editingVehicle?.id === vehicleToDelete.id) {
      setEditingVehicle(null);
    }
  };

  const canUserDeleteVehicles = isAdmin || isManager || hasPermission('canDeleteVehicles');

  // Filter vehicles: managers strictly see their assigned or proposed vehicles, agents see fleet + their proposals
  const filteredVehicles = vehicles.filter((v) => {
    // Role isolation: Manager only sees their own assigned or proposed vehicles
    if (isManager) {
      const isMine = v.assignedManagerId === currentUser.id || v.proposedBy === currentUser.name;
      if (!isMine) return false;
    }

    // Role isolation: Agent sees all approved fleet vehicles + any vehicle proposed by themselves
    if (isAgent) {
      const isApprovedOrProposedByMe = v.approvalStatus === 'approved' || v.proposedBy === currentUser.name;
      if (!isApprovedOrProposedByMe) return false;
    }

    // Admin filter by manager if selected
    if (isAdmin && managerFilter !== 'all') {
      if (managerFilter === 'unassigned' && v.assignedManagerId) return false;
      if (managerFilter !== 'unassigned' && v.assignedManagerId !== managerFilter) return false;
    }

    // Status filter
    if (statusFilter === 'alerts') {
      const summary = getVehicleHealthSummary(v);
      if (!summary.hasAlert) return false;
    } else if (statusFilter !== 'all' && v.status !== statusFilter) {
      return false;
    }

    // Search query
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

  // Pending vehicles needing Gérant approval (Admin view)
  const pendingApprovalVehicles = vehicles.filter((v) => v.approvalStatus === 'pending_approval');

  // Pending vehicles proposed by or assigned to the current user (Non-admin view)
  const myPendingVehicles = vehicles.filter(
    (v) => v.approvalStatus === 'pending_approval' && (v.proposedBy === currentUser.name || v.assignedManagerId === currentUser.id)
  );

  const handleAddVehicle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVehicleForm.brand || !newVehicleForm.model || !newVehicleForm.plate) {
      alert('Veuillez remplir les informations obligatoires');
      return;
    }

    const assignedUser = users.find((u) => u.id === newVehicleForm.assignedManagerId);

    if (!isAdmin) {
      // Règle métier : Tout le monde peut ajouter un véhicule, mais TOUJOURS sous approbation du Gérant
      addVehicle({
        ...newVehicleForm,
        brand: newVehicleForm.brand.toUpperCase(),
        plate: formatPlateFrench(newVehicleForm.plate.trim()),
        assignedManagerId: isManager ? currentUser.id : (newVehicleForm.assignedManagerId || undefined),
        assignedManagerName: isManager ? currentUser.name : (assignedUser?.name || undefined),
        approvalStatus: 'pending_approval',
        proposedBy: currentUser.name,
      });
      setIsAddModalOpen(false);
      triggerToast(`Proposition pour ${newVehicleForm.brand} soumise au Gérant pour approbation !`);
    } else {
      // Ajout direct par le Gérant / Super Admin : validé immédiatement
      addVehicle({
        ...newVehicleForm,
        brand: newVehicleForm.brand.toUpperCase(),
        plate: formatPlateFrench(newVehicleForm.plate.trim()),
        assignedManagerId: newVehicleForm.assignedManagerId || undefined,
        assignedManagerName: assignedUser?.name || undefined,
        approvalStatus: 'approved',
      });
      setIsAddModalOpen(false);
      triggerToast(`Véhicule ${newVehicleForm.brand} ajouté directement au parc avec succès.`);
    }

    setNewVehicleForm({
      brand: '',
      model: '',
      plate: '',
      fuelType: 'Diesel',
      status: 'available',
      currentKm: 30000,
      dailyRate: 400,
      year: 2024,
      color: 'Blanc',
      notes: '',
      lastInspectionDate: '',
      insuranceExpiryDate: '',
      insuranceCompany: 'Wafa Assurance',
      technicalInspectionExpiryDate: '',
      vignettePaidYear: 2026,
      nextOilChangeKm: 40000,
      assignedManagerId: isManager ? currentUser.id : '',
    });
  };

  const getStatusBadge = (status: VehicleStatus) => {
    switch (status) {
      case 'available':
        return (
          <span className="inline-flex items-center gap-1 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full text-xs font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            Disponible
          </span>
        );
      case 'rented':
        return (
          <span className="inline-flex items-center gap-1 bg-blue-500/15 text-blue-400 border border-blue-500/30 px-2.5 py-0.5 rounded-full text-xs font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
            Loué (En cours)
          </span>
        );
      case 'maintenance':
        return (
          <span className="inline-flex items-center gap-1 bg-amber-500/15 text-amber-400 border border-amber-500/30 px-2.5 py-0.5 rounded-full text-xs font-semibold">
            <Wrench className="w-3 h-3" />
            Maintenance
          </span>
        );
      case 'inactive':
        return (
          <span className="inline-flex items-center gap-1 bg-slate-500/15 text-slate-400 border border-slate-500/30 px-2.5 py-0.5 rounded-full text-xs font-semibold">
            Inactif
          </span>
        );
    }
  };

  const exportVehiclesToCSV = () => {
    const headers = [
      'Marque',
      'Modèle',
      'Immatriculation',
      'Carburant',
      'Statut',
      'Kilométrage',
      'Tarif_Journalier',
      'Année',
      'Couleur',
      'Responsable',
      'Compagnie_Assurance',
      'Expiration_Assurance',
      'Expiration_Controle_Tech',
      'Vignette_Payee_Annee',
      'Prochaine_Vidange_KM',
      'Date_Achat',
      'Notes',
    ];

    const rows = vehicles.map((v) => [
      `"${v.brand.replace(/"/g, '""')}"`,
      `"${v.model.replace(/"/g, '""')}"`,
      `"${v.plate.replace(/"/g, '""')}"`,
      `"${v.fuelType}"`,
      `"${v.status}"`,
      v.currentKm || 0,
      v.dailyRate || 0,
      v.year || '',
      `"${(v.color || '').replace(/"/g, '""')}"`,
      `"${(v.assignedManagerName || '').replace(/"/g, '""')}"`,
      `"${(v.insuranceCompany || '').replace(/"/g, '""')}"`,
      `"${v.insuranceExpiryDate || ''}"`,
      `"${v.technicalInspectionExpiryDate || ''}"`,
      v.vignettePaidYear || '',
      v.nextOilChangeKm || '',
      `"${v.purchaseDate || ''}"`,
      `"${(v.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `parc_morvello_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerToast('Export CSV du parc Morvello téléchargé avec succès.');
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
        'Date_Achat',
        'Notes',
      ];

      const rows = vehicles.map((v) => [
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
        v.purchaseDate || '',
        v.notes || '',
      ]);

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

  const downloadExcelTemplate = () => {
    try {
      const templateHeaders = [
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
        'Date_Achat',
        'Notes',
      ];

      const templateRows = [
        [
          'RENAULT',
          'Kardian 1.0 TCe EDC Techno',
          '54210 | A | 6',
          'Essence',
          'available',
          12500,
          450,
          2025,
          'Orange Énergie',
          'Anouar',
          'Wafa Assurance',
          '2027-06-30',
          '2028-05-15',
          2026,
          20000,
          '2025-01-15',
          'Véhicule neuf, boîte automatique EDC',
        ],
        [
          'RENAULT',
          'Clio 5 1.5 dCi',
          '84920 | A | 6',
          'Diesel',
          'available',
          42350,
          350,
          2024,
          'Gris Titanium',
          'Said Khomri',
          'Wafa Assurance',
          '2026-11-20',
          '2026-12-15',
          2026,
          50000,
          '2024-03-10',
          'Révision 40 000 km faite',
        ],
        [
          'HYUNDAI',
          'Tucson 1.6 CRDi DCT',
          '19384 | D | 6',
          'Diesel',
          'available',
          58400,
          650,
          2024,
          'Noir Fantôme',
          'Said Khomri',
          'Sanlam Maroc',
          '2026-09-18',
          '2026-11-30',
          2026,
          65000,
          '2024-01-15',
          'SUV familial tout confort',
        ],
      ];

      const wb = XLSX.utils.book_new();
      const wsVehicles = XLSX.utils.aoa_to_sheet([templateHeaders, ...templateRows]);
      wsVehicles['!cols'] = [
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
        { wch: 14 },
        { wch: 40 },
      ];
      XLSX.utils.book_append_sheet(wb, wsVehicles, 'Vehicules');

      const instructions = [
        ['GUIDE D UTILISATION DU MODELE D IMPORTATION MORVELLO'],
        [''],
        ['Colonne', 'Description', 'Exemples', 'Obligatoire'],
        ['Marque', 'Marque constructeur', 'RENAULT, DACIA, HYUNDAI...', 'OUI'],
        ['Modèle', 'Modèle et finition', 'Kardian 1.0 TCe, Clio 5...', 'OUI'],
        ['Immatriculation', 'Immatriculation marocaine', '54210 | A | 6', 'OUI'],
        ['Carburant', 'Type d énergie', 'Diesel, Essence, Hybride, Électrique', 'OUI'],
        ['Statut', 'État du véhicule', 'available, rented, maintenance', 'Optionnel'],
        ['Kilométrage', 'Kilométrage actuel', '12500', 'OUI'],
        ['Tarif_Journalier_MAD', 'Prix par jour en Dirhams', '450', 'OUI'],
        ['Année', 'Année de mise en circulation', '2025', 'Optionnel'],
        ['Couleur', 'Couleur extérieure', 'Orange Énergie, Gris...', 'Optionnel'],
        ['Responsable', 'Gestionnaire assigné', 'Anouar, Said Khomri...', 'Optionnel'],
        ['Compagnie_Assurance', 'Assureur marocain', 'Wafa Assurance, RMA...', 'Optionnel'],
        ['Expiration_Assurance', 'Date fin assurance (AAAA-MM-JJ)', '2027-06-30', 'Optionnel'],
        ['Expiration_Controle_Tech', 'Date fin contrôle technique', '2028-05-15', 'Optionnel'],
        ['Vignette_Payee_Annee', 'Année dernière vignette payée', '2026', 'Optionnel'],
        ['Prochaine_Vidange_KM', 'Kilométrage prochaine vidange', '20000', 'Optionnel'],
        ['Date_Achat', 'Date acquisition (AAAA-MM-JJ)', '2025-01-15', 'Optionnel'],
        ['Notes', 'Commentaires et options', 'Texte libre', 'Optionnel'],
      ];
      const wsInst = XLSX.utils.aoa_to_sheet(instructions);
      wsInst['!cols'] = [{ wch: 26 }, { wch: 36 }, { wch: 36 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, wsInst, 'Instructions');

      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'modele_import_vehicules_morvello.xlsx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      triggerToast('Modèle Excel (.xlsx) généré et téléchargé avec succès.');
    } catch {
      downloadCsvTemplate();
    }
  };

  const downloadCsvTemplate = () => {
    const csvContent =
      '\uFEFF' +
      [
        'Marque;Modèle;Immatriculation;Carburant;Statut;Kilométrage;Tarif_Journalier_MAD;Année;Couleur;Responsable;Compagnie_Assurance;Expiration_Assurance;Expiration_Controle_Tech;Vignette_Payee_Annee;Prochaine_Vidange_KM;Date_Achat;Notes',
        'RENAULT;Kardian 1.0 TCe EDC Techno;54210 | A | 6;Essence;available;12500;450;2025;Orange Énergie;Anouar;Wafa Assurance;2027-06-30;2028-05-15;2026;20000;2025-01-15;Nouveau Renault Kardian',
        'RENAULT;Clio 5 1.5 dCi;84920 | A | 6;Diesel;available;42350;350;2024;Gris Titanium;Said Khomri;Wafa Assurance;2026-11-20;2026-12-15;2026;50000;2024-03-10;Parc réel Morvello',
        'HYUNDAI;Tucson 1.6 CRDi DCT;19384 | D | 6;Diesel;available;58400;650;2024;Noir Fantôme;Said Khomri;Sanlam Maroc;2026-09-18;2026-11-30;2026;65000;2024-01-15;SUV premium',
      ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'modele_import_vehicules_morvello.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    triggerToast('Modèle CSV (compatible 100% Excel) téléchargé avec succès.');
  };

  const handleFileUpload = async (file: File) => {
    setImportError(null);
    const fileName = file.name.toLowerCase();

    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      try {
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array' });
        // Sheet name search: 'véhicule', 'vehicule', or first sheet
        const targetSheetName =
          wb.SheetNames.find(
            (name) =>
              name.toLowerCase().includes('vehicule') ||
              name.toLowerCase().includes('véhicule') ||
              name.toLowerCase().includes('flotte')
          ) || wb.SheetNames[0];

        const sheet = wb.Sheets[targetSheetName];
        if (!sheet) {
          setImportError('Aucune feuille exploitable trouvée dans le classeur Excel.');
          return;
        }

        const csvString = XLSX.utils.sheet_to_csv(sheet, { FS: ';' });
        setImportText(csvString);
        triggerToast(`Feuille Excel "${targetSheetName}" analysée avec succès.`);
      } catch (err) {
        setImportError(
          `Impossible de lire le fichier Excel : ${err instanceof Error ? err.message : 'Format corrompu'}`
        );
      }
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        if (content) {
          setImportText(content);
          triggerToast(`Fichier texte/CSV "${file.name}" chargé.`);
        }
      };
      reader.readAsText(file, 'UTF-8');
    }
  };

  const handleProcessImportCSV = () => {
    if (!importText.trim()) {
      setImportError('Veuillez sélectionner un fichier Excel / CSV ou coller des lignes de données.');
      return;
    }

    try {
      const lines = importText
        .trim()
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      if (lines.length === 0) {
        setImportError('Aucune ligne détectée dans le fichier.');
        return;
      }

      let startIndex = 0;
      const firstLineLower = lines[0].toLowerCase();
      if (
        firstLineLower.includes('marque') ||
        firstLineLower.includes('brand') ||
        firstLineLower.includes('immat') ||
        firstLineLower.includes('modele') ||
        firstLineLower.includes('model')
      ) {
        startIndex = 1;
      }

      let importedCount = 0;
      const separator = lines[0].includes(';') ? ';' : lines[0].includes('\t') ? '\t' : ',';

      for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;

        const cols = line
          .split(separator)
          .map((c) => c.replace(/^["']|["']$/g, '').trim());

        if (cols.length < 2) continue;

        const brand = cols[0] || 'Véhicule';
        const model = cols[1] || '';
        const plate = cols[2] ? formatPlateFrench(cols[2]) : `100${i} | A | 6`;
        const fuelTypeRaw = (cols[3] || 'Diesel').toLowerCase();
        const fuelType: FuelType = fuelTypeRaw.includes('ess') ? 'Essence' : fuelTypeRaw.includes('hyb') ? 'Hybride' : fuelTypeRaw.includes('elec') ? 'Électrique' : 'Diesel';
        const currentKm = parseInt(cols[5] || '0', 10) || 30000;
        const dailyRate = parseInt(cols[6] || '400', 10) || 400;
        const year = parseInt(cols[7] || '2024', 10) || 2024;
        const color = cols[8] || 'Blanc';
        const managerName = cols[9] || '';
        const matchedManager = users.find((u) => u.name.toLowerCase() === managerName.toLowerCase());

        addVehicle({
          brand,
          model,
          plate,
          fuelType,
          status: 'available',
          currentKm,
          dailyRate,
          year,
          color,
          assignedManagerId: matchedManager ? matchedManager.id : undefined,
          assignedManagerName: matchedManager ? matchedManager.name : managerName || undefined,
          insuranceCompany: cols[10] || 'Wafa Assurance',
          insuranceExpiryDate: cols[11] || '',
          technicalInspectionExpiryDate: cols[12] || '',
          vignettePaidYear: parseInt(cols[13] || '2026', 10) || 2026,
          nextOilChangeKm: parseInt(cols[14] || '0', 10) || currentKm + 10000,
          purchaseDate: cols[15] || '',
          notes: cols[16] || 'Importé dans le parc réel Morvello',
          approvalStatus: 'approved',
        });
        importedCount++;
      }

      if (importedCount === 0) {
        setImportError('Aucun véhicule valide n’a pu être extrait. Vérifiez le format des colonnes.');
        return;
      }

      triggerToast(`${importedCount} véhicule(s) importé(s) avec succès dans le parc Morvello !`);
      setIsImportModalOpen(false);
      setImportText('');
      setImportError(null);
    } catch (err) {
      setImportError(`Erreur d'analyse : ${err instanceof Error ? err.message : 'Format invalide'}`);
    }
  };

  const loadMorvelloTemplate = () => {
    const template = `Marque;Modèle;Immatriculation;Carburant;Statut;Kilométrage;Tarif_Journalier;Année;Couleur;Responsable;Compagnie_Assurance;Expiration_Assurance;Expiration_Controle_Tech;Vignette_Payee_Annee;Prochaine_Vidange_KM;Date_Achat;Notes
RENAULT;Kardian 1.0 TCe EDC Techno;54210 | A | 6;Essence;available;12500;450;2025;Orange Énergie;Anouar;Wafa Assurance;2027-06-30;2028-05-15;2026;20000;2025-01-15;Nouveau Renault Kardian
RENAULT;Clio 5 1.5 dCi;84920 | A | 6;Diesel;available;42350;350;2023;Gris Titanium;Said Khomri;Wafa Assurance;2026-11-20;2026-12-15;2026;50000;2023-05-10;Parc réel Morvello
HYUNDAI;Tucson 1.6 CRDi DCT;19384 | D | 6;Diesel;available;58400;650;2024;Noir Fantôme;Said Khomri;Sanlam Maroc;2026-09-18;2026-11-30;2026;65000;2024-01-15;SUV premium`;
    setImportText(template);
    setImportError(null);
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

        <div className="flex flex-wrap items-center gap-2">
          {/* Télécharger Modèle Excel Type */}
          <button
            onClick={downloadExcelTemplate}
            className="flex items-center gap-1.5 bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 hover:text-white border border-emerald-500/40 px-3 py-2 rounded-xl text-xs font-semibold shadow-sm transition-colors cursor-pointer"
            title="Télécharger le modèle Excel officiel pour préparer l'importation de véhicules"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>Modèle Excel Type</span>
          </button>

          {/* Export Excel Parc */}
          <button
            onClick={exportVehiclesToExcel}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 px-3 py-2 rounded-xl text-xs font-semibold shadow-sm transition-colors cursor-pointer"
            title="Exporter tout le parc actuel au format Excel (.xlsx)"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Export Excel</span>
          </button>

          {/* Import / Mise à jour Parc Réel */}
          <button
            onClick={() => {
              setIsImportModalOpen(true);
              setImportError(null);
            }}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 px-3 py-2 rounded-xl text-xs font-semibold shadow-sm transition-colors cursor-pointer"
            title="Importer la flotte réelle depuis un fichier Excel (.xlsx) ou CSV"
          >
            <Upload className="w-3.5 h-3.5 text-blue-400" />
            <span>Importer Parc Réel</span>
          </button>

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

      {/* ADMIN ONLY: PENDING APPROVALS SECTION */}
      {isAdmin && pendingApprovalVehicles.length > 0 && (
        <div className="bg-amber-950/40 border-2 border-amber-500/60 rounded-2xl p-5 shadow-xl space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-amber-200 flex items-center gap-2">
                  Demandes d'ajout de véhicules en attente d'approbation ({pendingApprovalVehicles.length})
                </h3>
                <p className="text-xs text-slate-400">
                  Véhicules proposés par vos équipes (Responsables d'agence, Agents). Votre approbation de Gérant est obligatoire avant intégration au parc officiel et mise en location.
                </p>
              </div>
            </div>
            <span className="text-[11px] bg-amber-500 text-slate-950 px-2.5 py-1 rounded-lg font-mono font-extrabold shadow-sm">
              Action Gérant Requise
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            {pendingApprovalVehicles.map((pv) => {
              const selectedManagerId = approvalManagerSelections[pv.id] ?? pv.assignedManagerId ?? '';
              return (
                <div
                  key={pv.id}
                  className="bg-slate-900 border border-amber-500/30 rounded-xl p-4 flex flex-col justify-between gap-3 shadow-md"
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-sm font-bold text-white uppercase">
                          {pv.brand} <span className="text-slate-300 font-normal">{pv.model}</span>
                        </span>
                        <div className="mt-1 inline-block bg-slate-950 border border-amber-500/40 px-2.5 py-0.5 rounded text-amber-400 font-mono font-bold text-xs tracking-wider">
                          {pv.plate}
                        </div>
                      </div>
                      <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-semibold">
                        ⏳ En attente
                      </span>
                    </div>

                    <div className="text-xs text-slate-400 mt-2.5 grid grid-cols-2 gap-2 bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                      <div>
                        <span className="text-[10px] text-slate-500 block">Proposé par :</span>
                        <strong className="text-slate-200">{pv.proposedBy || 'Collaborateur'}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">Date de soumission :</span>
                        <span className="font-mono text-slate-300">{pv.proposedAt || 'Récemment'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">Tarif journalier :</span>
                        <strong className="text-amber-400 font-mono">{pv.dailyRate} MAD/j</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">Compteur :</span>
                        <span className="font-mono text-slate-300">{pv.currentKm.toLocaleString()} KM</span>
                      </div>
                    </div>

                    {/* MANAGER ASSIGNMENT SELECTOR FOR GERANT UPON APPROVAL */}
                    <div className="mt-2.5 bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
                      <label className="text-[11px] text-slate-300 font-semibold mb-1 flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                        Affecter au Responsable attitré lors de la validation :
                      </label>
                      <select
                        value={selectedManagerId}
                        onChange={(e) =>
                          setApprovalManagerSelections({
                            ...approvalManagerSelections,
                            [pv.id]: e.target.value,
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-amber-400 focus:outline-none"
                      >
                        <option value="">-- Flotte centrale (Non affecté pour le moment) --</option>
                        {managers.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} — {m.assignedFleetName || m.agency}
                          </option>
                        ))}
                      </select>
                      <span className="text-[10px] text-slate-500 block mt-1">
                        Seul le Gérant peut décider de l'affectation finale à un Responsable.
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
                    <button
                      onClick={() => {
                        approveVehicle(pv.id, selectedManagerId || undefined);
                        triggerToast(`Véhicule ${pv.brand} ${pv.model} (${pv.plate}) approuvé et intégré au parc officiel !`);
                      }}
                      className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-1.5 px-3 rounded-lg text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-sm"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Approuver & Intégrer au parc
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(`Confirmez-vous le refus de ce véhicule (${pv.brand} ${pv.model}) ?`)) {
                          rejectVehicle(pv.id);
                          triggerToast(`Véhicule ${pv.brand} refusé.`);
                        }
                      }}
                      className="bg-slate-800 hover:bg-rose-950 hover:text-rose-300 hover:border-rose-700/60 text-slate-400 font-semibold py-1.5 px-3 rounded-lg text-xs flex items-center gap-1 cursor-pointer transition-colors border border-slate-700"
                    >
                      <X className="w-3.5 h-3.5" />
                      Refuser
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* NON-ADMIN: MY PENDING PROPOSALS BANNER */}
      {!isAdmin && myPendingVehicles.length > 0 && (
        <div className="bg-blue-950/40 border border-blue-500/40 rounded-2xl p-4 shadow-lg space-y-2 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              <h3 className="text-xs sm:text-sm font-bold text-blue-200">
                Vos propositions de véhicules en attente d'approbation du Gérant ({myPendingVehicles.length})
              </h3>
            </div>
            <span className="text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/40 px-2 py-0.5 rounded font-mono font-semibold">
              En attente du Gérant
            </span>
          </div>
          <p className="text-[11px] text-slate-300">
            Ces véhicules ont été transmis au Gérant ({gerantName}). Dès validation, ils apparaîtront dans la flotte active et pourront être loués via le module Contrats.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
            {myPendingVehicles.map((pv) => (
              <div key={pv.id} className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl text-xs flex items-center justify-between">
                <div>
                  <span className="font-bold text-white uppercase">{pv.brand} {pv.model}</span>
                  <div className="font-mono text-amber-400 font-bold text-[11px]">{pv.plate}</div>
                </div>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-semibold">
                  ⏳ En cours d'examen
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MANAGER SCOPE NOTIFICATION */}
      {isManager && (
        <div className="bg-blue-950/40 border border-blue-500/40 rounded-xl p-3.5 flex items-center justify-between text-xs text-blue-200 shadow-sm">
          <div className="flex items-center gap-2.5">
            <UserCheck className="w-4 h-4 text-blue-400 shrink-0" />
            <span>
              <strong>Flotte affectée à votre agence ({currentUser.name}) :</strong> Vous gérez {filteredVehicles.length} véhicule(s). Seuls ces véhicules sont utilisables pour l'établissement de vos contrats.
            </span>
          </div>
          <span className="text-[10px] bg-blue-500/20 border border-blue-500/30 px-2 py-0.5 rounded font-mono text-blue-300 shrink-0">
            Cloisonnement Actif
          </span>
        </div>
      )}

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
            <span className="text-xs text-slate-400 whitespace-nowrap hidden lg:inline">Responsable :</span>
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
              label: `⚠️ Échéances & Alertes (${vehicles.filter((v) => getVehicleHealthSummary(v).hasAlert).length})`,
            },
            { id: 'inactive', label: 'Inactifs' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer ${
                statusFilter === tab.id
                  ? tab.id === 'alerts'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                    : 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                  : tab.id === 'alerts' && vehicles.some((v) => getVehicleHealthSummary(v).criticalCount > 0)
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
            <div
              key={veh.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-md hover:border-slate-700 transition-all flex flex-col justify-between group"
            >
              <div>
                {/* TOP STATUS & EDIT BUTTON */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {getStatusBadge(veh.status)}
                    <span className="text-xs font-mono text-slate-400 font-semibold">
                      {veh.fuelType}
                    </span>
                  </div>

                  <button
                    onClick={() => handleOpenEdit(veh)}
                    className="flex items-center gap-1.5 bg-slate-800/80 hover:bg-amber-500 hover:text-slate-950 text-slate-300 text-xs px-2.5 py-1 rounded-lg border border-slate-700 hover:border-amber-400 transition-all cursor-pointer font-semibold shadow-xs"
                    title="Modifier ce véhicule"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Modifier
                  </button>
                </div>

                {/* BRAND & MODEL */}
                <h3 className="text-base font-bold text-white uppercase flex items-center justify-between">
                  <span>
                    {veh.brand} <span className="text-slate-300 font-normal">{veh.model}</span>
                  </span>
                  {veh.approvalStatus === 'pending_approval' && (
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-mono font-semibold">
                      ⏳ En validation
                    </span>
                  )}
                </h3>

                {/* PLATE BADGE (Moroccan plate design) */}
                <div className="my-2 inline-block bg-slate-950 border border-amber-500/40 px-3 py-1 rounded-lg text-amber-400 font-mono font-bold text-sm tracking-wider shadow-inner">
                  {veh.plate}
                </div>

                {/* RESPONSABLE ATTITRÉ ROW */}
                <div className="mb-2.5 flex items-center justify-between text-xs bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800">
                  <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                    <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                    <span>Responsable attitré :</span>
                  </div>
                  <span className="font-semibold text-slate-200 text-[11px] truncate max-w-[150px]">
                    {veh.assignedManagerName || (veh.assignedManagerId ? 'Responsable' : 'Flotte centrale (Non affecté)')}
                  </span>
                </div>

                {/* SPECS */}
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 mt-2 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Compteur actuel :</span>
                    <strong className="text-white font-mono">{veh.currentKm.toLocaleString()} KM</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Tarif journalier :</span>
                    <strong className="text-amber-400 font-mono">{veh.dailyRate || 400} MAD / j</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Année & Couleur :</span>
                    <span className="text-slate-300">{veh.year || 2024} • {veh.color || 'Gris'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Dernière Révision :</span>
                    <span className="text-slate-300 font-mono">{veh.lastInspectionDate || 'À jour'}</span>
                  </div>
                </div>

                {veh.notes && (
                  <div className="mt-2 text-[11px] text-slate-400 italic bg-slate-950/40 px-2.5 py-1.5 rounded-lg border border-slate-800/60">
                    « {veh.notes} »
                  </div>
                )}

                {/* SUIVI TECHNIQUE ET ADMINISTRATIF (Assurance, Visite technique, Vignette, Vidange) */}
                <VehicleCompliancePanel vehicle={veh} />

                {/* ACTIVE RENTAL NOTICE IF RENTED */}
                {activeContract && (
                  <div className="mt-3 bg-blue-500/10 border border-blue-500/30 p-2 rounded-lg text-xs text-blue-300">
                    <span className="font-semibold block">Loué à : {activeContract.clientSnapshot.lastName} {activeContract.clientSnapshot.firstName}</span>
                    <span className="text-[10px] text-blue-400">Contrat N° {activeContract.contractNumber} (Retour le {activeContract.endDate})</span>
                  </div>
                )}
              </div>

              {/* ACTIONS ROW */}
              <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      const newStatus: VehicleStatus =
                        veh.status === 'available'
                          ? 'maintenance'
                          : veh.status === 'maintenance'
                          ? 'available'
                          : veh.status;
                       updateVehicle(veh.id, { status: newStatus });
                      triggerToast(`Statut du véhicule ${veh.plate} mis à jour : ${newStatus}`);
                    }}
                    disabled={veh.status === 'rented'}
                    className={`text-[11px] px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                      veh.status === 'rented'
                        ? 'opacity-40 cursor-not-allowed text-slate-500 bg-slate-800'
                        : veh.status === 'maintenance'
                        ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500 hover:text-slate-950'
                        : 'bg-amber-500/20 text-amber-300 hover:bg-amber-500 hover:text-slate-950'
                    }`}
                  >
                    {veh.status === 'maintenance' ? 'Remettre en service' : 'Mettre en maintenance'}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {canUserDeleteVehicles && (
                    <button
                      onClick={() => {
                        setDeleteError(null);
                        setVehicleToDelete(veh);
                      }}
                      title="Supprimer ce véhicule du parc"
                      className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {activeContract ? (
                    <button
                      onClick={() => openPdfModal(activeContract)}
                      className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      Voir contrat <FileText className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      onClick={() => handleOpenEdit(veh)}
                      className="text-xs text-slate-400 hover:text-white font-medium flex items-center gap-1 cursor-pointer"
                    >
                      <Pencil className="w-3 h-3" /> Fiche détaillée
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* MODAL MODIFIER UN VÉHICULE                                                */}
      {/* ========================================================================= */}
      {editingVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">
                    Modifier le Véhicule <span className="text-amber-400">{editingVehicle.brand} {editingVehicle.model}</span>
                  </h2>
                  <p className="text-[11px] text-slate-400 font-mono">
                    ID : {editingVehicle.id} • Immatriculation : {editingVehicle.plate}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingVehicle(null)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5 text-xs">
              {/* RESPONSABLE ATTITRÉ FIELD */}
              <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl">
                <label className="flex items-center justify-between font-semibold text-slate-300 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                    Responsable attitré de la flotte
                  </span>
                  {isAdmin ? (
                    <span className="text-[10px] text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded font-mono">
                      Géré par Gérant
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5" /> Modifiable uniquement par Gérant
                    </span>
                  )}
                </label>

                {isAdmin ? (
                  <>
                    <select
                      value={editForm.assignedManagerId}
                      onChange={(e) => setEditForm({ ...editForm, assignedManagerId: e.target.value })}
                      className="w-full bg-slate-900 border border-amber-500/50 rounded-xl px-3 py-2 text-white font-medium focus:border-amber-400 focus:outline-none"
                    >
                      <option value="">-- Flotte centrale (Non affecté à un responsable particulier) --</option>
                      {managers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} — {m.assignedFleetName || m.agency}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-400 mt-1">
                      L'affectation détermine quel responsable visualise ce véhicule et peut établir des contrats avec lui.
                    </p>
                  </>
                ) : (
                  <div className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-200 font-semibold flex items-center justify-between">
                    <span>{editingVehicle.assignedManagerName || 'Non affecté (Flotte centrale)'}</span>
                    <span className="text-[10px] text-slate-400 font-normal">Contactez le Gérant pour réaffecter</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Marque *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: DACIA, MERCEDES, AUDI..."
                    value={editForm.brand}
                    onChange={(e) => setEditForm({ ...editForm, brand: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white uppercase font-bold focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Modèle & Version *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Logan 1.5 dCi Prestige"
                    value={editForm.model}
                    onChange={(e) => setEditForm({ ...editForm, model: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-semibold focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Immatriculation Marocaine (lettres françaises) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: 55264 | A | 73"
                  value={editForm.plate}
                  onChange={(e) => setEditForm({ ...editForm, plate: e.target.value })}
                  className="w-full bg-slate-950 border-2 border-amber-500/50 rounded-xl px-3 py-2 text-amber-400 font-mono font-bold text-sm focus:border-amber-400 focus:outline-none tracking-wider"
                />
                <p className="text-[11px] text-slate-400 mt-1">Format standard marocain : Chiffres | Lettre française | Région (ex: 55264 | A | 73)</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Carburant *</label>
                  <select
                    value={editForm.fuelType}
                    onChange={(e) => setEditForm({ ...editForm, fuelType: e.target.value as FuelType })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-amber-500 focus:outline-none font-medium"
                  >
                    <option value="Diesel">Diesel</option>
                    <option value="Essence">Essence</option>
                    <option value="Hybride">Hybride</option>
                    <option value="Électrique">Électrique</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Statut *</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value as VehicleStatus })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-amber-500 focus:outline-none font-medium"
                  >
                    <option value="available">Disponible</option>
                    <option value="rented">Loué (En cours)</option>
                    <option value="maintenance">En Maintenance</option>
                    <option value="inactive">Inactif</option>
                  </select>
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-slate-300 font-semibold mb-1">Kilométrage Actuel (KM) *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={editForm.currentKm}
                    onChange={(e) => setEditForm({ ...editForm, currentKm: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Tarif / Jour (MAD)</label>
                  <input
                    type="number"
                    min={0}
                    value={editForm.dailyRate}
                    onChange={(e) => setEditForm({ ...editForm, dailyRate: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-amber-400 font-mono font-bold focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Année Modèle</label>
                  <input
                    type="number"
                    min={2000}
                    max={2030}
                    value={editForm.year}
                    onChange={(e) => setEditForm({ ...editForm, year: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Couleur</label>
                  <input
                    type="text"
                    placeholder="Ex: Noir Métallisé"
                    value={editForm.color}
                    onChange={(e) => setEditForm({ ...editForm, color: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* BLOC SUIVI ADMINISTRATIF & TECHNIQUE */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider pb-1 border-b border-slate-800">
                  <Shield className="w-4 h-4 text-amber-400" />
                  <span>Suivi Administratif & Technique (Maroc)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Date d'échéance Assurance</label>
                    <input
                      type="date"
                      value={editForm.insuranceExpiryDate}
                      onChange={(e) => setEditForm({ ...editForm, insuranceExpiryDate: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-amber-500 focus:outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Compagnie d'Assurance</label>
                    <input
                      type="text"
                      list="insurance-companies-list"
                      placeholder="Ex: Wafa Assurance, Sanlam, RMA..."
                      value={editForm.insuranceCompany}
                      onChange={(e) => setEditForm({ ...editForm, insuranceCompany: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
                    />
                    <datalist id="insurance-companies-list">
                      <option value="Wafa Assurance" />
                      <option value="Sanlam Maroc" />
                      <option value="RMA Watanya" />
                      <option value="AXA Assurance Maroc" />
                      <option value="AtlantaSanad" />
                      <option value="MAMDA-MCMA" />
                    </datalist>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Échéance Visite Technique</label>
                    <input
                      type="date"
                      value={editForm.technicalInspectionExpiryDate}
                      onChange={(e) => setEditForm({ ...editForm, technicalInspectionExpiryDate: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-amber-500 focus:outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Année Vignette Payée</label>
                    <input
                      type="number"
                      min={2020}
                      max={2030}
                      value={editForm.vignettePaidYear}
                      onChange={(e) => setEditForm({ ...editForm, vignettePaidYear: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-amber-500 focus:outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Prochaine Vidange (KM)</label>
                    <input
                      type="number"
                      min={0}
                      placeholder="Ex: 50000"
                      value={editForm.nextOilChangeKm ?? ''}
                      onChange={(e) => setEditForm({ ...editForm, nextOilChangeKm: e.target.value ? Number(e.target.value) : undefined })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-amber-500 focus:outline-none font-mono"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Date dernière révision / Contrôle technique</label>
                <input
                  type="date"
                  value={editForm.lastInspectionDate}
                  onChange={(e) => setEditForm({ ...editForm, lastInspectionDate: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Notes internes / Équipements spécifiques</label>
                <textarea
                  rows={2}
                  placeholder="Ex: Pneus neufs, GPS installé, boîte automatique, double des clés disponible..."
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                {canUserDeleteVehicles ? (
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteError(null);
                      setVehicleToDelete(editingVehicle);
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl text-xs font-semibold transition-colors cursor-pointer border border-rose-500/20"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Supprimer ce véhicule
                  </button>
                ) : <div />}

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setEditingVehicle(null)}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-bold rounded-xl shadow-md shadow-amber-500/20 transition-all cursor-pointer active:scale-95"
                  >
                    <Save className="w-4 h-4" />
                    Enregistrer les modifications
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL AJOUT VÉHICULE                                                      */}
      {/* ========================================================================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Car className="w-5 h-5 text-amber-400" />
                <div>
                  <h2 className="text-base font-bold text-white">
                    {isAdmin ? 'Ajouter un Véhicule au Parc (Gérant)' : 'Proposer un Nouveau Véhicule'}
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    {isAdmin
                      ? 'Validation immédiate et intégration directe au parc officiel'
                      : 'Ajout ouvert à tous sous réserve d\'approbation obligatoire du Gérant'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* INFO BANNER FOR ALL NON-ADMIN USERS */}
            {!isAdmin && (
              <div className="bg-blue-950/40 border border-blue-500/30 p-3 rounded-xl text-xs text-blue-200 space-y-1">
                <div className="font-semibold flex items-center gap-1.5 text-blue-300">
                  <ShieldCheck className="w-4 h-4" />
                  Circuit d'approbation par le Gérant
                </div>
                <p className="text-[11px] text-slate-300">
                  L'ajout de véhicule est ouvert à tous mais requiert l'approbation du Gérant ({gerantName}). Votre proposition sera enregistrée avec le statut <span className="font-mono text-amber-400">"En attente d'approbation"</span> avant de pouvoir intégrer la flotte active et être louée.
                </p>
              </div>
            )}

            <form onSubmit={handleAddVehicle} className="space-y-3 text-xs">
              {/* ASSIGNMENT FIELD: ADMIN (DIRECT) VS MANAGER (AUTO) VS AGENT (SUGGESTION) */}
              {isAdmin ? (
                <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl">
                  <label className="block text-slate-300 font-semibold mb-1 flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                    Responsable attitré (Affectation immédiate par le Gérant)
                  </label>
                  <select
                    value={newVehicleForm.assignedManagerId}
                    onChange={(e) => setNewVehicleForm({ ...newVehicleForm, assignedManagerId: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
                  >
                    <option value="">-- Flotte centrale (Non affecté pour le moment) --</option>
                    {managers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} — {m.assignedFleetName || m.agency}
                      </option>
                    ))}
                  </select>
                </div>
              ) : isManager ? (
                <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-slate-400 block">Responsable soumettant la proposition :</span>
                    <span className="text-white font-semibold text-xs">{currentUser.name} ({currentUser.assignedFleetName || 'Votre agence'})</span>
                  </div>
                  <span className="text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded font-mono">
                    Soumis au Gérant
                  </span>
                </div>
              ) : (
                <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl">
                  <label className="block text-slate-300 font-semibold mb-1 flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-blue-400" />
                    Responsable suggéré pour ce véhicule (Optionnel)
                  </label>
                  <select
                    value={newVehicleForm.assignedManagerId}
                    onChange={(e) => setNewVehicleForm({ ...newVehicleForm, assignedManagerId: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">-- Flotte centrale (Le Gérant décidera de l'affectation) --</option>
                    {managers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} — {m.assignedFleetName || m.agency}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Marque *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: RENAULT, HYUNDAI..."
                    value={newVehicleForm.brand}
                    onChange={(e) => setNewVehicleForm({ ...newVehicleForm, brand: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white uppercase focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Modèle *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Clio 5 1.5 dCi"
                    value={newVehicleForm.model}
                    onChange={(e) => setNewVehicleForm({ ...newVehicleForm, model: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Immatriculation Marocaine (lettres françaises) *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: 55264 | A | 73"
                  value={newVehicleForm.plate}
                  onChange={(e) => setNewVehicleForm({ ...newVehicleForm, plate: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono font-bold focus:border-amber-500 focus:outline-none"
                />
                <p className="text-[11px] text-slate-400 mt-1">Exemple : 55264 | A | 73</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Carburant *</label>
                  <select
                    value={newVehicleForm.fuelType}
                    onChange={(e) => setNewVehicleForm({ ...newVehicleForm, fuelType: e.target.value as FuelType })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
                  >
                    <option value="Diesel">Diesel</option>
                    <option value="Essence">Essence</option>
                    <option value="Hybride">Hybride</option>
                    <option value="Électrique">Électrique</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Kilométrage Actuel *</label>
                  <input
                    type="number"
                    required
                    value={newVehicleForm.currentKm}
                    onChange={(e) => setNewVehicleForm({ ...newVehicleForm, currentKm: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Tarif Journalier (MAD)</label>
                  <input
                    type="number"
                    value={newVehicleForm.dailyRate}
                    onChange={(e) => setNewVehicleForm({ ...newVehicleForm, dailyRate: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Couleur</label>
                  <input
                    type="text"
                    value={newVehicleForm.color}
                    onChange={(e) => setNewVehicleForm({ ...newVehicleForm, color: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* BLOC SUIVI ADMINISTRATIF & TECHNIQUE (ADD MODAL) */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider pb-1 border-b border-slate-800">
                  <Shield className="w-4 h-4 text-amber-400" />
                  <span>Suivi Administratif & Technique (Maroc)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Date d'échéance Assurance</label>
                    <input
                      type="date"
                      value={newVehicleForm.insuranceExpiryDate}
                      onChange={(e) => setNewVehicleForm({ ...newVehicleForm, insuranceExpiryDate: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Compagnie d'Assurance</label>
                    <input
                      type="text"
                      list="insurance-companies-add"
                      placeholder="Ex: Wafa Assurance, Sanlam..."
                      value={newVehicleForm.insuranceCompany}
                      onChange={(e) => setNewVehicleForm({ ...newVehicleForm, insuranceCompany: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
                    />
                    <datalist id="insurance-companies-add">
                      <option value="Wafa Assurance" />
                      <option value="Sanlam Maroc" />
                      <option value="RMA Watanya" />
                      <option value="AXA Assurance Maroc" />
                      <option value="AtlantaSanad" />
                      <option value="MAMDA-MCMA" />
                    </datalist>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Échéance Visite Technique</label>
                    <input
                      type="date"
                      value={newVehicleForm.technicalInspectionExpiryDate}
                      onChange={(e) => setNewVehicleForm({ ...newVehicleForm, technicalInspectionExpiryDate: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Année Vignette Payée</label>
                    <input
                      type="number"
                      min={2020}
                      max={2030}
                      value={newVehicleForm.vignettePaidYear}
                      onChange={(e) => setNewVehicleForm({ ...newVehicleForm, vignettePaidYear: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Prochaine Vidange (KM)</label>
                    <input
                      type="number"
                      min={0}
                      placeholder="Ex: 50000"
                      value={newVehicleForm.nextOilChangeKm || ''}
                      onChange={(e) => setNewVehicleForm({ ...newVehicleForm, nextOilChangeKm: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2 font-bold rounded-xl shadow-md transition-transform active:scale-95 cursor-pointer text-xs ${
                    isAdmin
                      ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-amber-500/20'
                      : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 text-white shadow-blue-500/20'
                  }`}
                >
                  {isAdmin ? 'Valider et Intégrer au Parc (Gérant)' : 'Soumettre pour Approbation du Gérant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL CONFIRMATION SUPPRESSION VÉHICULE (GÉRANT & MANAGERS)               */}
      {/* ========================================================================= */}
      {vehicleToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-rose-500/40 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Supprimer ce véhicule ?</h3>
                <p className="text-xs text-slate-400">Action irréversible sur la flotte</p>
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Véhicule :</span>
                <span className="text-white font-bold uppercase">{vehicleToDelete.brand} {vehicleToDelete.model}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Immatriculation :</span>
                <span className="text-amber-400 font-mono font-bold">{vehicleToDelete.plate}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Responsable :</span>
                <span className="text-slate-300">{vehicleToDelete.assignedManagerName || 'Non assigné'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Statut actuel :</span>
                <span className={`font-semibold capitalize ${
                  vehicleToDelete.status === 'available' ? 'text-emerald-400' :
                  vehicleToDelete.status === 'rented' ? 'text-blue-400' : 'text-amber-400'
                }`}>
                  {vehicleToDelete.status === 'available' ? 'Disponible' :
                   vehicleToDelete.status === 'rented' ? 'En location' : 'En maintenance'}
                </span>
              </div>
            </div>

            {deleteError && (
              <div className="bg-rose-950/60 border border-rose-500/60 rounded-xl p-3 flex items-start gap-2.5 text-xs text-rose-200">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{deleteError}</span>
              </div>
            )}

            <p className="text-[11px] text-slate-400">
              Êtes-vous sûr de vouloir retirer ce véhicule de la flotte Morvello Cars ? Toutes les données associées de ce véhicule seront supprimées du parc.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setVehicleToDelete(null);
                  setDeleteError(null);
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleDeleteVehicleConfirm}
                className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-600/30 transition-all cursor-pointer active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Confirmer la suppression
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL IMPORTATION DU PARC RÉEL MORVELLO (CSV / TEXTE / EXCEL)             */}
      {/* ========================================================================= */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-150 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shrink-0">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Importation du Parc Automobile (Excel / CSV)</h3>
                  <p className="text-xs text-slate-400">Intégrez votre flotte en masse via le modèle Excel officiel ou fichier CSV</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsImportModalOpen(false);
                  setImportError(null);
                }}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5">
              {/* BANDEAU MODÈLES OFFICIELS TÉLÉCHARGEABLES */}
              <div className="bg-gradient-to-r from-emerald-950/70 via-slate-900 to-slate-900 border border-emerald-500/40 p-4 rounded-2xl shadow-lg space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shrink-0">
                      <FileSpreadsheet className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-emerald-300">Fichier Modèle Officiel Morvello</div>
                      <div className="text-[11px] text-slate-300">
                        Téléchargez le gabarit type pré-rempli pour préparer votre liste de véhicules
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30 shrink-0">
                    Format Garanti
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={downloadExcelTemplate}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-700/30 transition-all cursor-pointer active:scale-95"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Modèle Excel (.xlsx)</span>
                  </button>

                  <button
                    type="button"
                    onClick={downloadCsvTemplate}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-400" />
                    <span>Modèle CSV (.csv)</span>
                  </button>

                  <button
                    type="button"
                    onClick={loadMorvelloTemplate}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Exemple direct</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  1. Charger un fichier Excel (.xlsx, .xls) ou CSV (.csv, .txt) :
                </label>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv,.txt"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleFileUpload(file);
                    }
                  }}
                  className="w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer bg-slate-950 p-2 rounded-xl border border-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  2. Aperçu des données à importer (éditable ou coller directement) :
                </label>
                <textarea
                  rows={6}
                  value={importText}
                  onChange={(e) => {
                    setImportText(e.target.value);
                    setImportError(null);
                  }}
                  placeholder="Marque;Modèle;Immatriculation;Carburant;Statut;Kilométrage;Tarif_Journalier;Année;Couleur;Responsable;..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white font-mono text-xs focus:border-emerald-500 focus:outline-none placeholder-slate-600"
                />
              </div>

              {importError && (
                <div className="bg-rose-950/60 border border-rose-500/60 rounded-xl p-3 flex items-start gap-2.5 text-xs text-rose-200">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{importError}</span>
                </div>
              )}

              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-[11px] text-slate-400 space-y-1">
                <div className="font-semibold text-slate-300">Colonnes reconnues dans le fichier Excel :</div>
                <div>Marque • Modèle • Immatriculation • Carburant (Diesel/Essence/Hybride) • Statut • Kilométrage • Tarif Journalier (MAD) • Année • Couleur • Nom du Responsable • Compagnie Assurance • Expiration Assurance • Expiration Visite Technique • Vignette Fiscale</div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setIsImportModalOpen(false);
                  setImportError(null);
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleProcessImportCSV}
                className="flex items-center gap-1.5 px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-600/30 transition-all cursor-pointer active:scale-95"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Valider et importer dans le parc
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
