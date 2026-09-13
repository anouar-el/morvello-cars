import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Client, DocumentType } from '../types';
import { ClientDocumentUpload } from './ClientDocumentUpload';
import {
  Users,
  Search,
  UserPlus,
  Phone,
  FileText,
  Calendar,
  X,
  History,
  CheckCircle2,
  Car,
  ChevronRight,
  Eye,
  CreditCard,
  FileBadge,
  FileCheck,
  Upload,
  Edit3,
  Trash2,
  AlertTriangle,
  Shield,
  Filter,
  UserCheck,
} from 'lucide-react';

export const ClientsList: React.FC = () => {
  const {
    clients,
    contracts,
    vehicles,
    users,
    getClientAssignedManager,
    addClient,
    updateClient,
    deleteClient,
    openPdfModal,
    duplicateContract,
    setActiveTab,
    currentUser,
    hasPermission,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [managerFilter, setManagerFilter] = useState<string>(currentUser.role === 'manager' ? 'mine' : 'all');
  const [selectedClientDetail, setSelectedClientDetail] = useState<Client | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [previewDocModal, setPreviewDocModal] = useState<{ title: string; url: string } | null>(null);
  const [isEditingDocsInDetail, setIsEditingDocsInDetail] = useState<boolean>(false);

  // Delete client modal state
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [deleteError, setDeleteError] = useState<string>('');

  const canDeleteClient =
    currentUser.role === 'admin' ||
    currentUser.role === 'manager' ||
    hasPermission('canDeleteClients');

  const handleConfirmDelete = () => {
    if (!clientToDelete) return;
    setDeleteError('');
    const res = deleteClient(clientToDelete.id);
    if (!res.success) {
      setDeleteError(res.error || 'Erreur lors de la suppression.');
      return;
    }
    if (selectedClientDetail && selectedClientDetail.id === clientToDelete.id) {
      setSelectedClientDetail(null);
    }
    const deletedName = `${clientToDelete.firstName} ${clientToDelete.lastName}`;
    setClientToDelete(null);
    setEditSuccessMsg(`Fiche client de ${deletedName} supprimée avec succès.`);
    setTimeout(() => {
      setEditSuccessMsg('');
    }, 4000);
  };

  // Edit client modal state
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [editSuccessMsg, setEditSuccessMsg] = useState<string>('');
  const [editClientForm, setEditClientForm] = useState<{
    firstName: string;
    lastName: string;
    birthDate: string;
    drivingLicense: string;
    docType: DocumentType;
    docNumber: string;
    phone: string;
    email: string;
    country: string;
    address: string;
    notes: string;
  }>({
    firstName: '',
    lastName: '',
    birthDate: '',
    drivingLicense: '',
    docType: 'CIN',
    docNumber: '',
    phone: '',
    email: '',
    country: 'Maroc',
    address: '',
    notes: '',
  });

  const handleOpenEdit = (client: Client) => {
    setEditingClient(client);
    setEditClientForm({
      firstName: client.firstName || '',
      lastName: client.lastName || '',
      birthDate: client.birthDate || '1990-01-01',
      drivingLicense: client.drivingLicense || '',
      docType: client.docType || 'CIN',
      docNumber: client.docNumber || '',
      phone: client.phone || '',
      email: client.email || '',
      country: client.country || 'Maroc',
      address: client.address || '',
      notes: client.notes || '',
    });
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;

    if (!editClientForm.firstName || !editClientForm.lastName || !editClientForm.docNumber || !editClientForm.drivingLicense) {
      alert('Veuillez renseigner les champs obligatoires (Nom, Prénom, Pièce d\'identité, Permis de conduire)');
      return;
    }

    const updatedData: Partial<Client> = {
      firstName: editClientForm.firstName.trim(),
      lastName: editClientForm.lastName.trim(),
      birthDate: editClientForm.birthDate,
      drivingLicense: editClientForm.drivingLicense.trim(),
      docType: editClientForm.docType,
      docNumber: editClientForm.docNumber.trim(),
      phone: editClientForm.phone.trim(),
      email: editClientForm.email.trim(),
      country: editClientForm.country.trim(),
      address: editClientForm.address.trim(),
      notes: editClientForm.notes.trim(),
    };

    updateClient(editingClient.id, updatedData);

    if (selectedClientDetail && selectedClientDetail.id === editingClient.id) {
      setSelectedClientDetail({
        ...selectedClientDetail,
        ...updatedData,
      });
    }

    setEditingClient(null);
    setEditSuccessMsg(`Fiche de ${updatedData.firstName} ${updatedData.lastName} mise à jour avec succès !`);
    setTimeout(() => {
      setEditSuccessMsg('');
    }, 4000);
  };

  // New client form state
  const [newClientForm, setNewClientForm] = useState({
    firstName: '',
    lastName: '',
    birthDate: '1990-05-15',
    drivingLicense: '',
    docType: 'CIN' as DocumentType,
    docNumber: '',
    phone: '',
    email: '',
    country: 'Maroc',
    address: '',
    notes: '',
    cinDocUrl: '',
    cinDocName: '',
    cinDocVersoUrl: '',
    cinDocVersoName: '',
    licenseDocUrl: '',
    licenseDocName: '',
    licenseDocVersoUrl: '',
    licenseDocVersoName: '',
  });

  const filteredClients = clients.filter((c) => {
    const mgrInfo = getClientAssignedManager(c);

    // Règle d'isolation stricte des données :
    // Si l'utilisateur connecté est un responsable, les clients affectés à un autre responsable
    // (ex: RENAULT KARDIAN affecté à Abdelkader => ce client appartient à Abdelkader et ne doit pas apparaître aux autres responsables)
    if (currentUser.role === 'manager') {
      if (mgrInfo.managerId && mgrInfo.managerId !== currentUser.id) {
        return false;
      }
    }

    // Filter by manager assignment (derived from rented vehicle)
    if (managerFilter === 'mine') {
      if (mgrInfo.managerId !== currentUser.id) return false;
    } else if (managerFilter === 'unassigned') {
      if (mgrInfo.managerId) return false;
    } else if (managerFilter !== 'all') {
      if (mgrInfo.managerId !== managerFilter) return false;
    }

    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      c.firstName.toLowerCase().includes(q) ||
      c.lastName.toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q) ||
      c.docNumber.toLowerCase().includes(q) ||
      c.drivingLicense.toLowerCase().includes(q) ||
      (c.email && c.email.toLowerCase().includes(q)) ||
      (mgrInfo.managerName && mgrInfo.managerName.toLowerCase().includes(q)) ||
      (mgrInfo.vehicleName && mgrInfo.vehicleName.toLowerCase().includes(q)) ||
      (mgrInfo.vehiclePlate && mgrInfo.vehiclePlate.toLowerCase().includes(q))
    );
  });

  const handleCreateClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientForm.firstName || !newClientForm.lastName || !newClientForm.docNumber || !newClientForm.drivingLicense) {
      alert('Veuillez remplir tous les champs obligatoires (Nom, Prénom, Pièce d\'identité, Permis)');
      return;
    }

    addClient(newClientForm);
    setIsAddModalOpen(false);
    setNewClientForm({
      firstName: '',
      lastName: '',
      birthDate: '1990-05-15',
      drivingLicense: '',
      docType: 'CIN',
      docNumber: '',
      phone: '',
      email: '',
      country: 'Maroc',
      address: '',
      notes: '',
      cinDocUrl: '',
      cinDocName: '',
      cinDocVersoUrl: '',
      cinDocVersoName: '',
      licenseDocUrl: '',
      licenseDocName: '',
      licenseDocVersoUrl: '',
      licenseDocVersoName: '',
    });
  };

  // Contracts associated with selected client
  const clientContracts = selectedClientDetail
    ? contracts.filter((c) => c.clientId === selectedClientDetail.id)
    : [];

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-400 uppercase tracking-widest font-mono">
            <Users className="w-4 h-4" />
            Module Clients • Répertoire & Fiches
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight mt-1">
            Fichier Clients & Historique des Locations
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Répertoire centralisé des locataires, pièces d’identité, permis et suivi des contrats.
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs sm:text-sm shadow-md shadow-amber-500/20 transition-all cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          + Nouveau Client
        </button>
      </div>

      {/* SUCCESS NOTIFICATION */}
      {editSuccessMsg && (
        <div className="bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-medium">{editSuccessMsg}</span>
        </div>
      )}

      {/* SEARCH AND MANAGER FILTER BAR */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-md space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par nom, prénom, téléphone, C.I.N, responsable, véhicule, matricule..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* MANAGER SELECTOR */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-300">
              <Filter className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="text-[11px] text-slate-400 hidden sm:inline">Filtrer par :</span>
              {currentUser.role === 'admin' ? (
                <select
                  value={managerFilter}
                  onChange={(e) => setManagerFilter(e.target.value)}
                  aria-label="Filtrer par responsable"
                  className="bg-transparent border-none text-white text-xs focus:outline-none cursor-pointer pr-2"
                >
                  <option value="all" className="bg-slate-900 text-white">Tous les responsables</option>
                  <option value="unassigned" className="bg-slate-900 text-slate-400">Non affectés (Aucune location)</option>
                  {users
                    .filter((u) => u.role === 'manager' || u.role === 'admin')
                    .map((u) => (
                      <option key={u.id} value={u.id} className="bg-slate-900 text-white">
                        {u.name} {u.agency ? `(${u.agency})` : ''}
                      </option>
                    ))}
                </select>
              ) : (
                <select
                  value={managerFilter}
                  onChange={(e) => setManagerFilter(e.target.value)}
                  aria-label="Filtrer par responsable"
                  className="bg-transparent border-none text-white text-xs focus:outline-none cursor-pointer pr-2"
                >
                  <option value="mine" className="bg-slate-900 text-amber-400 font-semibold">
                    ★ Mes clients affectés ({currentUser.name})
                  </option>
                  <option value="all" className="bg-slate-900 text-white">
                    Tous mes clients autorisés
                  </option>
                  <option value="unassigned" className="bg-slate-900 text-slate-400">
                    Non affectés (prospects)
                  </option>
                </select>
              )}
            </div>

            <span className="text-xs font-mono text-slate-400 bg-slate-950 px-3 py-2 rounded-xl border border-slate-800 shrink-0">
              {filteredClients.length} client(s)
            </span>
          </div>
        </div>

        {/* QUICK SHORTCUTS & ISOLATION NOTICE FOR MANAGERS */}
        {currentUser.role === 'manager' && (
          <div className="pt-2 border-t border-slate-800/60 space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-[11px] text-slate-400">Vue rapide :</span>
              <button
                onClick={() => setManagerFilter('mine')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                  managerFilter === 'mine'
                    ? 'bg-blue-600 text-white font-bold shadow-sm shadow-blue-500/30'
                    : 'bg-slate-950 text-blue-300 hover:text-white border border-blue-900/50'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5 text-blue-400" />
                <span>Mes clients ({clients.filter((c) => getClientAssignedManager(c).managerId === currentUser.id).length})</span>
              </button>
              <button
                onClick={() => setManagerFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                  managerFilter === 'all'
                    ? 'bg-slate-700 text-white font-bold'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                Tous mes autorisés ({clients.filter((c) => {
                  const m = getClientAssignedManager(c);
                  return !m.managerId || m.managerId === currentUser.id;
                }).length})
              </button>
              <button
                onClick={() => setManagerFilter('unassigned')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                  managerFilter === 'unassigned'
                    ? 'bg-amber-600 text-white font-bold'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                Sans location / Prospects ({clients.filter((c) => !getClientAssignedManager(c).managerId).length})
              </button>
            </div>

            <div className="bg-blue-950/40 border border-blue-800/50 rounded-lg px-3 py-1.5 text-[11px] text-blue-300 flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span>
                <strong>Cloisonnement actif :</strong> Les clients affectés aux véhicules d'autres responsables (ex: Renault Kardian affecté à Abdelkader Ouahib) vous sont strictement invisibles.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* CLIENTS TABLE */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/70 text-slate-400 uppercase text-[10px] font-semibold border-b border-slate-800">
              <tr>
                <th className="px-4 py-3.5">Nom Complet & Pays</th>
                <th className="px-4 py-3.5">Contact (Téléphone & Email)</th>
                <th className="px-4 py-3.5">Pièce d'Identité</th>
                <th className="px-4 py-3.5">Permis de Conduire</th>
                <th className="px-4 py-3.5">Responsable & Véhicule Loué</th>
                <th className="px-4 py-3.5">Contrats</th>
                <th className="px-4 py-3.5">Dernier Contrat</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-500 text-xs">
                    Aucun client trouvé.
                  </td>
                </tr>
              ) : (
                filteredClients.map((cli) => {
                  const mgrInfo = getClientAssignedManager(cli);
                  return (
                  <tr key={cli.id} className="hover:bg-slate-850/60 transition-colors">
                    {/* NOM */}
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-white uppercase">
                        {cli.lastName} {cli.firstName}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Né(e) le {cli.birthDate} • {cli.country || 'Maroc'}
                      </div>
                    </td>

                    {/* CONTACT */}
                    <td className="px-4 py-3.5">
                      <div className="text-amber-400 font-medium font-mono">
                        {cli.phone || <span className="text-slate-500 italic text-xs">Non renseigné</span>}
                      </div>
                      <div className="text-[10px] text-slate-400">{cli.email || '—'}</div>
                      {(cli.licenseDocUrl || cli.cinDocUrl) && (
                        <div className="text-[9px] text-emerald-400 font-mono flex items-center gap-1 mt-0.5">
                          <FileCheck className="w-3 h-3 text-emerald-400" />
                          <span>Docs numérisés</span>
                        </div>
                      )}
                    </td>

                    {/* DOCUMENT */}
                    <td className="px-4 py-3.5">
                      <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-mono mr-1.5">
                        {cli.docType}
                      </span>
                      <span className="font-bold font-mono text-white">{cli.docNumber}</span>
                    </td>

                    {/* PERMIS */}
                    <td className="px-4 py-3.5">
                      <span className="font-mono text-slate-200 font-semibold">{cli.drivingLicense}</span>
                    </td>

                    {/* RESPONSABLE & VÉHICULE LOUÉ */}
                    <td className="px-4 py-3.5">
                      <div className="space-y-1">
                        {mgrInfo.managerName ? (
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                                mgrInfo.managerId === currentUser.id
                                  ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                                  : 'bg-slate-800 text-slate-200 border-slate-700'
                              }`}
                            >
                              <UserCheck className="w-3 h-3 text-blue-400 shrink-0" />
                              <span>{mgrInfo.managerName}</span>
                              {mgrInfo.managerId === currentUser.id && (
                                <span className="text-[9px] bg-blue-400/20 text-blue-300 px-1 rounded ml-0.5 font-bold">
                                  Moi
                                </span>
                              )}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-500 text-[11px] italic">Non affecté</span>
                        )}

                        {mgrInfo.vehicleName && (
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-300">
                            <Car className="w-3 h-3 text-amber-400 shrink-0" />
                            <span className="font-medium truncate max-w-[150px]" title={mgrInfo.vehicleName}>
                              {mgrInfo.vehicleName}
                            </span>
                            {mgrInfo.vehiclePlate && (
                              <span className="font-mono text-[9px] text-amber-300 bg-slate-950 px-1 rounded border border-slate-800 shrink-0">
                                {mgrInfo.vehiclePlate}
                              </span>
                            )}
                          </div>
                        )}

                        {mgrInfo.isActiveRental && (
                          <span className="inline-block text-[9px] font-semibold text-emerald-400 bg-emerald-950/50 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                            ● Location en cours
                          </span>
                        )}
                      </div>
                    </td>

                    {/* CONTRATS */}
                    <td className="px-4 py-3.5">
                      <span className="inline-block bg-slate-800 border border-slate-700 text-slate-200 font-mono px-2 py-0.5 rounded-full text-xs font-bold">
                        {cli.contractCount} location(s)
                      </span>
                    </td>

                    {/* DERNIER CONTRAT */}
                    <td className="px-4 py-3.5 font-mono text-xs">
                      {cli.lastContractNumber ? (
                        <div>
                          <span className="text-amber-400 font-bold">{cli.lastContractNumber}</span>
                          <span className="block text-[10px] text-slate-500">{cli.lastContractDate}</span>
                        </div>
                      ) : (
                        <span className="text-slate-500">Aucun</span>
                      )}
                    </td>

                    {/* ACTIONS */}
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(cli)}
                          className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 hover:text-amber-200 border border-amber-500/30 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                          title="Modifier la fiche client"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Modifier</span>
                        </button>
                        <button
                          onClick={() => setSelectedClientDetail(cli)}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                        >
                          Fiche Client
                        </button>
                        {canDeleteClient && (
                          <button
                            onClick={() => {
                              setDeleteError('');
                              setClientToDelete(cli);
                            }}
                            className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/30 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                            title="Supprimer la fiche client"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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

      {/* MODAL FICHE CLIENT & HISTORIQUE */}
      {selectedClientDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] text-blue-400 font-bold uppercase tracking-widest font-mono">
                  Fiche Client Réf. {selectedClientDetail.id}
                </span>
                <h2 className="text-lg font-bold text-white uppercase mt-0.5">
                  {selectedClientDetail.lastName} {selectedClientDetail.firstName}
                </h2>
                <p className="text-xs text-slate-400">
                  Client enregistré le {new Date(selectedClientDetail.createdAt).toLocaleDateString('fr-FR')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenEdit(selectedClientDetail)}
                  className="px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 hover:text-white border border-amber-500/40 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Modifier les coordonnées de cette fiche"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Modifier la fiche</span>
                </button>
                <button
                  onClick={() => setSelectedClientDetail(null)}
                  className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* AFFECTATION DU CLIENT AU RESPONSABLE VIA LE VÉHICULE LOUÉ */}
            {(() => {
              const mgrInfo = getClientAssignedManager(selectedClientDetail);
              return (
                <div className="bg-gradient-to-r from-blue-950/40 via-slate-900 to-slate-900 border border-blue-500/30 rounded-xl p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                      <UserCheck className="w-4 h-4 text-blue-400" />
                      Affectation Responsable (Par Véhicule Loué)
                    </span>
                    {mgrInfo.isActiveRental ? (
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-semibold px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Location active en cours
                      </span>
                    ) : mgrInfo.vehicleName ? (
                      <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700">
                        Véhicule historique / Contrat clôturé
                      </span>
                    ) : (
                      <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full border border-slate-700">
                        Aucune location enregistrée
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {/* MANAGER */}
                    <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                      <span className="text-slate-400 text-[11px] block font-medium">Manager Responsable du Dossier :</span>
                      {mgrInfo.managerName ? (
                        <div className="mt-1.5 flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold text-xs shrink-0">
                            {mgrInfo.managerName.charAt(0)}
                          </div>
                          <div>
                            <strong className="text-white text-xs block">{mgrInfo.managerName}</strong>
                            <div className="flex items-center gap-2 text-[10px] text-slate-400">
                              {mgrInfo.managerAgency && <span>{mgrInfo.managerAgency}</span>}
                              {mgrInfo.managerId === currentUser.id && (
                                <span className="bg-blue-500/20 text-blue-300 px-1.5 py-0.2 rounded font-semibold border border-blue-500/30">
                                  Votre agence / Vous
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-slate-500 italic text-[11px] mt-1">
                          Non affecté (Ce client n'a pas encore de location ou de véhicule associé)
                        </p>
                      )}
                    </div>

                    {/* VÉHICULE LOUÉ */}
                    <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                      <span className="text-slate-400 text-[11px] block font-medium">Véhicule Loué par le Client :</span>
                      {mgrInfo.vehicleName ? (
                        <div className="mt-1.5 flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
                            <Car className="w-4 h-4" />
                          </div>
                          <div>
                            <strong className="text-white text-xs block">{mgrInfo.vehicleName}</strong>
                            <div className="flex items-center gap-2 mt-0.5">
                              {mgrInfo.vehiclePlate && (
                                <span className="font-mono text-[10px] font-bold text-amber-300 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                                  {mgrInfo.vehiclePlate}
                                </span>
                              )}
                              {mgrInfo.contractNumber && (
                                <span className="text-[10px] text-slate-400">
                                  N° {mgrInfo.contractNumber}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-slate-500 italic text-[11px] mt-1">
                          Aucun véhicule loué pour le moment
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-400 bg-slate-950/40 px-3 py-1.5 rounded-lg border border-slate-800/80 flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span>
                      Règle d'affectation automatique : Le client est automatiquement rattaché au manager responsable du véhicule loué.
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* DETAILS GRID */}
            <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block">Date de Naissance :</span>
                <strong className="text-white">{selectedClientDetail.birthDate}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">Document ({selectedClientDetail.docType}) :</span>
                <strong className="text-white font-mono">{selectedClientDetail.docNumber}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">Permis de Conduire :</span>
                <strong className="text-white font-mono">{selectedClientDetail.drivingLicense}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">Téléphone / GSM :</span>
                <strong className="text-amber-400 font-mono">
                  {selectedClientDetail.phone || <span className="text-slate-500 italic font-normal">Non renseigné</span>}
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block">Email :</span>
                <span className="text-slate-300">{selectedClientDetail.email || 'Non renseigné'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Pays :</span>
                <span className="text-slate-300">{selectedClientDetail.country || 'Maroc'}</span>
              </div>
              <div className="col-span-2 sm:col-span-3">
                <span className="text-slate-500 block">Adresse :</span>
                <span className="text-slate-300">{selectedClientDetail.address || 'Non renseignée'}</span>
              </div>
              {selectedClientDetail.notes && (
                <div className="col-span-2 sm:col-span-3 bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block font-semibold text-[11px]">Notes internes :</span>
                  <p className="text-slate-300 italic text-[11px] mt-0.5">{selectedClientDetail.notes}</p>
                </div>
              )}
            </div>

            {/* DOCUMENTS NUMÉRISÉS DU CLIENT (PERMIS & CIN/PASSEPORT) */}
            <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-blue-400" />
                  Documents Numérisés (Permis & Pièce d'Identité)
                </h3>
                <button
                  type="button"
                  onClick={() => setIsEditingDocsInDetail(!isEditingDocsInDetail)}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                  {isEditingDocsInDetail ? 'Fermer l\'éditeur' : 'Téléverser / Modifier'}
                </button>
              </div>

              {/* VIEW MODE */}
              {!isEditingDocsInDetail && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* PERMIS */}
                  <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <FileBadge className="w-3.5 h-3.5 text-amber-400" />
                        Permis de Conduire
                      </span>
                      {selectedClientDetail.licenseDocUrl ? (
                        <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-950/40 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                          ✓ Archivé
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500">Non attaché</span>
                      )}
                    </div>

                    {selectedClientDetail.licenseDocUrl ? (
                      <div className="space-y-1.5">
                        <div
                          onClick={() =>
                            setPreviewDocModal({
                              title: `Permis (Recto) - ${selectedClientDetail.lastName} ${selectedClientDetail.firstName}`,
                              url: selectedClientDetail.licenseDocUrl!,
                            })
                          }
                          className="flex items-center gap-2.5 p-2 bg-slate-950 rounded-lg border border-slate-800 hover:border-amber-500/40 cursor-pointer transition-colors"
                        >
                          <img
                            src={selectedClientDetail.licenseDocUrl}
                            alt="Permis Recto"
                            className="w-10 h-10 object-cover rounded bg-slate-900 border border-slate-700 shrink-0"
                            referrerPolicy="no-referrer"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-mono text-slate-200 truncate">
                              {selectedClientDetail.licenseDocName || 'Permis_Recto'}
                            </p>
                            <p className="text-[10px] text-amber-400">Cliquer pour agrandir</p>
                          </div>
                        </div>

                        {selectedClientDetail.licenseDocVersoUrl && (
                          <div
                            onClick={() =>
                              setPreviewDocModal({
                                title: `Permis (Verso) - ${selectedClientDetail.lastName} ${selectedClientDetail.firstName}`,
                                url: selectedClientDetail.licenseDocVersoUrl!,
                              })
                            }
                            className="flex items-center gap-2.5 p-2 bg-slate-950 rounded-lg border border-slate-800 hover:border-amber-500/40 cursor-pointer transition-colors"
                          >
                            <img
                              src={selectedClientDetail.licenseDocVersoUrl}
                              alt="Permis Verso"
                              className="w-10 h-10 object-cover rounded bg-slate-900 border border-slate-700 shrink-0"
                              referrerPolicy="no-referrer"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-mono text-slate-200 truncate">
                                {selectedClientDetail.licenseDocVersoName || 'Permis_Verso'}
                              </p>
                              <p className="text-[10px] text-amber-400">Verso • Cliquer pour agrandir</p>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 italic py-2">
                        Aucun document de permis téléversé.
                      </p>
                    )}
                  </div>

                  {/* CIN / PASSEPORT */}
                  <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <CreditCard className="w-3.5 h-3.5 text-blue-400" />
                        {selectedClientDetail.docType} / Passeport
                      </span>
                      {selectedClientDetail.cinDocUrl ? (
                        <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-950/40 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                          ✓ Archivé
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500">Non attaché</span>
                      )}
                    </div>

                    {selectedClientDetail.cinDocUrl ? (
                      <div className="space-y-1.5">
                        <div
                          onClick={() =>
                            setPreviewDocModal({
                              title: `${selectedClientDetail.docType} (Recto) - ${selectedClientDetail.lastName} ${selectedClientDetail.firstName}`,
                              url: selectedClientDetail.cinDocUrl!,
                            })
                          }
                          className="flex items-center gap-2.5 p-2 bg-slate-950 rounded-lg border border-slate-800 hover:border-blue-500/40 cursor-pointer transition-colors"
                        >
                          <img
                            src={selectedClientDetail.cinDocUrl}
                            alt="Pièce Recto"
                            className="w-10 h-10 object-cover rounded bg-slate-900 border border-slate-700 shrink-0"
                            referrerPolicy="no-referrer"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-mono text-slate-200 truncate">
                              {selectedClientDetail.cinDocName || `${selectedClientDetail.docType}_Recto`}
                            </p>
                            <p className="text-[10px] text-blue-400">Cliquer pour agrandir</p>
                          </div>
                        </div>

                        {selectedClientDetail.cinDocVersoUrl && (
                          <div
                            onClick={() =>
                              setPreviewDocModal({
                                title: `${selectedClientDetail.docType} (Verso) - ${selectedClientDetail.lastName} ${selectedClientDetail.firstName}`,
                                url: selectedClientDetail.cinDocVersoUrl!,
                              })
                            }
                            className="flex items-center gap-2.5 p-2 bg-slate-950 rounded-lg border border-slate-800 hover:border-blue-500/40 cursor-pointer transition-colors"
                          >
                            <img
                              src={selectedClientDetail.cinDocVersoUrl}
                              alt="Pièce Verso"
                              className="w-10 h-10 object-cover rounded bg-slate-900 border border-slate-700 shrink-0"
                              referrerPolicy="no-referrer"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-mono text-slate-200 truncate">
                                {selectedClientDetail.cinDocVersoName || `${selectedClientDetail.docType}_Verso`}
                              </p>
                              <p className="text-[10px] text-blue-400">Verso • Cliquer pour agrandir</p>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 italic py-2">
                        Aucune pièce d'identité téléversée.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* EDIT / UPLOAD INLINE */}
              {isEditingDocsInDetail && (
                <div className="pt-2">
                  <ClientDocumentUpload
                    cinRecto={
                      selectedClientDetail.cinDocUrl
                        ? { dataUrl: selectedClientDetail.cinDocUrl, name: selectedClientDetail.cinDocName }
                        : undefined
                    }
                    cinVerso={
                      selectedClientDetail.cinDocVersoUrl
                        ? { dataUrl: selectedClientDetail.cinDocVersoUrl, name: selectedClientDetail.cinDocVersoName }
                        : undefined
                    }
                    licenseRecto={
                      selectedClientDetail.licenseDocUrl
                        ? { dataUrl: selectedClientDetail.licenseDocUrl, name: selectedClientDetail.licenseDocName }
                        : undefined
                    }
                    licenseVerso={
                      selectedClientDetail.licenseDocVersoUrl
                        ? { dataUrl: selectedClientDetail.licenseDocVersoUrl, name: selectedClientDetail.licenseDocVersoName }
                        : undefined
                    }
                    onChange={(docs) => {
                      updateClient(selectedClientDetail.id, docs);
                      setSelectedClientDetail({
                        ...selectedClientDetail,
                        ...docs,
                      });
                    }}
                    compact
                  />
                </div>
              )}
            </div>

            {/* HISTORIQUE DES CONTRATS */}
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <History className="w-4 h-4 text-amber-400" />
                Historique des Contrats de ce Client ({clientContracts.length})
              </h3>

              {clientContracts.length === 0 ? (
                <div className="bg-slate-950/40 p-4 rounded-xl text-center text-slate-500 text-xs">
                  Aucun contrat historique trouvé pour ce client.
                </div>
              ) : (
                <div className="space-y-2">
                  {clientContracts.map((cnt) => (
                    <div
                      key={cnt.id}
                      className="bg-slate-950/60 border border-slate-800 p-3 rounded-xl flex items-center justify-between text-xs hover:border-slate-700 transition-colors"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-amber-400">{cnt.contractNumber}</span>
                          <span className="text-slate-300 font-semibold">
                            {cnt.vehicleSnapshot.brand} {cnt.vehicleSnapshot.model} ({cnt.vehicleSnapshot.plate})
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Du {new Date(cnt.startDate).toLocaleDateString('fr-FR')} au{' '}
                          {new Date(cnt.endDate).toLocaleDateString('fr-FR')} • {cnt.totalDays} jours
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openPdfModal(cnt)}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded transition-colors"
                          title="Voir le PDF A4"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedClientDetail(null);
                            duplicateContract(cnt);
                          }}
                          className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 border border-amber-500/30 rounded font-semibold text-[11px] transition-colors"
                        >
                          Relouer
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* MODAL FOOTER */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedClientDetail(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  Fermer
                </button>
                {canDeleteClient && (
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteError('');
                      setClientToDelete(selectedClientDetail);
                    }}
                    className="px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/30 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                    title="Supprimer ce client"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Supprimer</span>
                  </button>
                )}
              </div>
              <button
                onClick={() => {
                  setSelectedClientDetail(null);
                  setActiveTab('new_contract');
                }}
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-bold rounded-xl shadow-md shadow-amber-500/20 transition-transform active:scale-95 cursor-pointer"
              >
                + Créer un nouveau contrat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NOUVEAU CLIENT */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-amber-400" />
                <h2 className="text-base font-bold text-white">Nouveau Client Locataire</h2>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateClient} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Prénom *</label>
                  <input
                    type="text"
                    required
                    value={newClientForm.firstName}
                    onChange={(e) => setNewClientForm({ ...newClientForm, firstName: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Nom *</label>
                  <input
                    type="text"
                    required
                    value={newClientForm.lastName}
                    onChange={(e) => setNewClientForm({ ...newClientForm, lastName: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Date de naissance *</label>
                  <input
                    type="date"
                    required
                    value={newClientForm.birthDate}
                    onChange={(e) => setNewClientForm({ ...newClientForm, birthDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Type de Document *</label>
                  <select
                    value={newClientForm.docType}
                    onChange={(e) => setNewClientForm({ ...newClientForm, docType: e.target.value as DocumentType })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
                  >
                    <option value="CIN">C.I.N</option>
                    <option value="Passeport">Passeport</option>
                    <option value="Carte de Séjour">Carte de Séjour</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">N° Document *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: BH458921"
                    value={newClientForm.docNumber}
                    onChange={(e) => setNewClientForm({ ...newClientForm, docNumber: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white uppercase font-mono focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">N° Permis de Conduire *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: B-198425/08"
                    value={newClientForm.drivingLicense}
                    onChange={(e) => setNewClientForm({ ...newClientForm, drivingLicense: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">
                    Téléphone / GSM <span className="text-slate-500 font-normal">(Facultatif)</span>
                  </label>
                  <input
                    type="tel"
                    placeholder="+212 6... (Optionnel)"
                    value={newClientForm.phone}
                    onChange={(e) => setNewClientForm({ ...newClientForm, phone: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="client@gmail.com"
                    value={newClientForm.email}
                    onChange={(e) => setNewClientForm({ ...newClientForm, email: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Adresse</label>
                <input
                  type="text"
                  placeholder="Casablanca, Maroc"
                  value={newClientForm.address}
                  onChange={(e) => setNewClientForm({ ...newClientForm, address: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              {/* TÉLÉVERSEMENT DES DOCUMENTS CLIENT (FACULTATIF) */}
              <div className="pt-2">
                <ClientDocumentUpload
                  cinRecto={newClientForm.cinDocUrl ? { dataUrl: newClientForm.cinDocUrl, name: newClientForm.cinDocName } : undefined}
                  cinVerso={newClientForm.cinDocVersoUrl ? { dataUrl: newClientForm.cinDocVersoUrl, name: newClientForm.cinDocVersoName } : undefined}
                  licenseRecto={newClientForm.licenseDocUrl ? { dataUrl: newClientForm.licenseDocUrl, name: newClientForm.licenseDocName } : undefined}
                  licenseVerso={newClientForm.licenseDocVersoUrl ? { dataUrl: newClientForm.licenseDocVersoUrl, name: newClientForm.licenseDocVersoName } : undefined}
                  onChange={(docs) => setNewClientForm((prev) => ({ ...prev, ...docs }))}
                  compact
                />
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
                  className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-bold rounded-xl shadow-md shadow-amber-500/20 transition-transform active:scale-95"
                >
                  Enregistrer la Fiche Client
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DOCUMENT PREVIEW LIGHTBOX MODAL */}
      {previewDocModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">{previewDocModal.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewDocModal(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-auto flex items-center justify-center bg-slate-950 rounded-xl p-2 border border-slate-800">
              {previewDocModal.url.startsWith('data:application/pdf') ? (
                <iframe
                  src={previewDocModal.url}
                  title="PDF Preview"
                  className="w-full h-[500px] rounded"
                />
              ) : (
                <img
                  src={previewDocModal.url}
                  alt={previewDocModal.title}
                  className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-lg"
                  referrerPolicy="no-referrer"
                />
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <a
                href={previewDocModal.url}
                download="document_client"
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-colors"
              >
                Télécharger le document
              </a>
              <button
                type="button"
                onClick={() => setPreviewDocModal(null)}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL MODIFICATION FICHE CLIENT */}
      {editingClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-500/15 text-amber-400 rounded-xl border border-amber-500/30">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Modifier la Fiche Client</h2>
                  <p className="text-xs text-slate-400 font-mono">
                    Réf : {editingClient.id} • {editingClient.firstName} {editingClient.lastName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingClient(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5 text-xs">
              {/* Identité */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Prénom *</label>
                  <input
                    type="text"
                    required
                    value={editClientForm.firstName}
                    onChange={(e) => setEditClientForm({ ...editClientForm, firstName: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Nom de famille *</label>
                  <input
                    type="text"
                    required
                    value={editClientForm.lastName}
                    onChange={(e) => setEditClientForm({ ...editClientForm, lastName: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-amber-500 focus:outline-none uppercase"
                  />
                </div>
              </div>

              {/* Naissance & Type doc */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Date de Naissance *</label>
                  <input
                    type="date"
                    required
                    value={editClientForm.birthDate}
                    onChange={(e) => setEditClientForm({ ...editClientForm, birthDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Type de Document</label>
                  <select
                    value={editClientForm.docType}
                    onChange={(e) => setEditClientForm({ ...editClientForm, docType: e.target.value as DocumentType })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
                  >
                    <option value="CIN">CIN (Carte Nationale)</option>
                    <option value="Passeport">Passeport</option>
                    <option value="Carte de Séjour">Carte de Séjour</option>
                  </select>
                </div>
              </div>

              {/* Numéro doc & Permis */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">
                    N° de Document ({editClientForm.docType}) *
                  </label>
                  <input
                    type="text"
                    required
                    value={editClientForm.docNumber}
                    onChange={(e) => setEditClientForm({ ...editClientForm, docNumber: e.target.value.toUpperCase() })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono uppercase font-bold focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">N° Permis de Conduire *</label>
                  <input
                    type="text"
                    required
                    value={editClientForm.drivingLicense}
                    onChange={(e) => setEditClientForm({ ...editClientForm, drivingLicense: e.target.value.toUpperCase() })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono uppercase font-bold focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Coordonnées */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Téléphone / GSM</label>
                  <input
                    type="tel"
                    value={editClientForm.phone}
                    onChange={(e) => setEditClientForm({ ...editClientForm, phone: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:border-amber-500 focus:outline-none"
                    placeholder="06 12 34 56 78"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Email</label>
                  <input
                    type="email"
                    value={editClientForm.email}
                    onChange={(e) => setEditClientForm({ ...editClientForm, email: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
                    placeholder="client@domaine.com"
                  />
                </div>
              </div>

              {/* Nationalité & Adresse */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Pays / Nationalité</label>
                  <input
                    type="text"
                    value={editClientForm.country}
                    onChange={(e) => setEditClientForm({ ...editClientForm, country: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-medium">Adresse</label>
                  <input
                    type="text"
                    value={editClientForm.address}
                    onChange={(e) => setEditClientForm({ ...editClientForm, address: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
                    placeholder="Ville, Rue, N°"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Notes & Commentaires Internes</label>
                <textarea
                  rows={2}
                  value={editClientForm.notes}
                  onChange={(e) => setEditClientForm({ ...editClientForm, notes: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-amber-500 focus:outline-none resize-none"
                  placeholder="Informations particulières, habitudes de location..."
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingClient(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold rounded-xl shadow-md shadow-amber-500/20 transition-transform active:scale-95 flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Enregistrer les modifications</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMATION SUPPRESSION CLIENT */}
      {clientToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl text-rose-400 shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-white">
                  Supprimer ce client ?
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Êtes-vous certain de vouloir supprimer la fiche de{' '}
                  <strong className="text-white uppercase">{clientToDelete.lastName} {clientToDelete.firstName}</strong> ?
                </p>
              </div>
            </div>

            {/* INFO RECAP */}
            <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Réf. Client :</span>
                <span className="text-white font-mono">{clientToDelete.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Pièce d'identité :</span>
                <span className="text-white font-mono">{clientToDelete.docType} {clientToDelete.docNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Permis de conduire :</span>
                <span className="text-white font-mono">{clientToDelete.drivingLicense}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Téléphone :</span>
                <span className="text-amber-400 font-mono">{clientToDelete.phone || 'Non renseigné'}</span>
              </div>
            </div>

            {/* SAFETY CONTRACT CHECKS */}
            {(() => {
              const activeContract = contracts.find(
                (c) =>
                  (c.clientId === clientToDelete.id ||
                    (c.clientSnapshot?.docNumber &&
                      c.clientSnapshot.docNumber.trim().toUpperCase() ===
                        clientToDelete.docNumber.trim().toUpperCase())) &&
                  c.status === 'active'
              );
              const pastContracts = contracts.filter(
                (c) =>
                  (c.clientId === clientToDelete.id ||
                    (c.clientSnapshot?.docNumber &&
                      c.clientSnapshot.docNumber.trim().toUpperCase() ===
                        clientToDelete.docNumber.trim().toUpperCase())) &&
                  c.status !== 'active'
              );

              if (activeContract) {
                return (
                  <div className="p-3 bg-rose-500/15 border border-rose-500/40 rounded-xl text-xs text-rose-300 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-rose-200">
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>Suppression impossible (Contrat actif en cours)</span>
                    </div>
                    <p className="text-[11px] text-rose-300 leading-relaxed">
                      Ce client a un contrat en cours : <strong className="font-mono text-white">N° {activeContract.contractNumber}</strong> ({activeContract.vehicleSnapshot?.brand} {activeContract.vehicleSnapshot?.model}). Vous devez d'abord clôturer ou annuler ce contrat pour pouvoir supprimer la fiche client.
                    </p>
                  </div>
                );
              }

              if (pastContracts.length > 0) {
                return (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 space-y-1">
                    <div className="flex items-center gap-1.5 font-semibold text-amber-200">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>Historique associé ({pastContracts.length} contrat{pastContracts.length > 1 ? 's' : ''})</span>
                    </div>
                    <p className="text-[11px] text-amber-300/90 leading-relaxed">
                      Ce client possède {pastContracts.length} contrat(s) passé(s) dans l'historique. La suppression retirera la fiche du répertoire des clients.
                    </p>
                  </div>
                );
              }

              return null;
            })()}

            {deleteError && (
              <div className="p-3 bg-rose-500/15 border border-rose-500/40 text-rose-300 rounded-xl text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setClientToDelete(null);
                  setDeleteError('');
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Annuler
              </button>
              {(() => {
                const hasActiveContract = contracts.some(
                  (c) =>
                    (c.clientId === clientToDelete.id ||
                      (c.clientSnapshot?.docNumber &&
                        c.clientSnapshot.docNumber.trim().toUpperCase() ===
                          clientToDelete.docNumber.trim().toUpperCase())) &&
                    c.status === 'active'
                );
                return (
                  <button
                    type="button"
                    disabled={hasActiveContract}
                    onClick={handleConfirmDelete}
                    className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      hasActiveContract
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                        : 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20 active:scale-95'
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirmer la suppression</span>
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
