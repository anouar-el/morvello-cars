import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { User, UserRole, UserPermissions, DEFAULT_PERMISSIONS_BY_ROLE } from '../types';
import { CredentialsManager } from './CredentialsManager';
import {
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserX,
  Users,
  KeyRound,
  Lock,
  Unlock,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  Plus,
  Trash2,
  Mail,
  Car,
  FileText,
  DollarSign,
  User as UserIcon,
  Search,
  Check,
  X,
  Eye,
  Settings,
  ArrowRight,
  Phone,
} from 'lucide-react';

interface PermissionMeta {
  key: keyof UserPermissions;
  label: string;
  description: string;
  category: 'contracts' | 'deposits' | 'fleet' | 'clients' | 'system';
}

const PERMISSION_DEFINITIONS: PermissionMeta[] = [
  // CONTRATS
  {
    key: 'canCreateContracts',
    label: 'Établir des contrats de location',
    description: 'Permet de créer un nouveau contrat de location standard ou sur-mesure.',
    category: 'contracts',
  },
  {
    key: 'canEditContracts',
    label: 'Modifier les contrats en cours',
    description: 'Autorise la modification des tarifs, dates, et options des contrats actifs.',
    category: 'contracts',
  },
  {
    key: 'canCancelContracts',
    label: 'Annuler des contrats',
    description: 'Droit critique d’annulation et de résiliation anticipée de contrat.',
    category: 'contracts',
  },
  {
    key: 'canDeleteContracts',
    label: 'Supprimer définitivement des contrats (Gérant seul)',
    description: 'Permet de supprimer un contrat et ses données associées. Réservé au Gérant de la société.',
    category: 'contracts',
  },
  {
    key: 'canValidateContracts',
    label: 'Clôturer et valider le retour véhicule',
    description: 'Permet de finaliser le contrat, saisir le km retour et consigner l’inspection.',
    category: 'contracts',
  },
  {
    key: 'canExportData',
    label: 'Exporter les contrats (PDF / Excel)',
    description: 'Autorise le téléchargement des fiches contrats et l’export de listes.',
    category: 'contracts',
  },

  // CAUTIONS
  {
    key: 'canCollectDeposit',
    label: 'Encaisser les cautions',
    description: 'Permet d’enregistrer le versement d’un dépôt de garantie (CB, empreinte, espèces).',
    category: 'deposits',
  },
  {
    key: 'canReleaseDeposit',
    label: 'Restituer les cautions',
    description: 'Droit de libérer la caution au client sans retenue.',
    category: 'deposits',
  },
  {
    key: 'canDeductDeposit',
    label: 'Appliquer des retenues sur caution',
    description: 'Droit financier de facturer des dégradations, franchise ou frais de carburant sur le dépôt.',
    category: 'deposits',
  },

  // PARC VÉHICULES
  {
    key: 'canAddVehicles',
    label: 'Proposer / Enregistrer un véhicule',
    description: 'Permet de saisir un nouveau véhicule (soumis à approbation par le Gérant).',
    category: 'fleet',
  },
  {
    key: 'canApproveVehicles',
    label: 'Approuver l’intégration de véhicules',
    description: 'Pouvoir exclusif du Gérant : valider et intégrer définitivement une voiture en flotte.',
    category: 'fleet',
  },
  {
    key: 'canAssignVehicleManager',
    label: 'Désigner le Responsable attitré',
    description: 'Affecter un responsable de suivi opérationnel à chaque véhicule de la flotte.',
    category: 'fleet',
  },
  {
    key: 'canEditVehicles',
    label: 'Modifier la fiche technique véhicule',
    description: 'Mettre à jour le kilométrage, l’état, les révisions et les tarifs journaliers.',
    category: 'fleet',
  },
  {
    key: 'canDeleteVehicles',
    label: 'Supprimer un véhicule du parc',
    description: 'Permet de retirer et supprimer définitivement un véhicule de la flotte.',
    category: 'fleet',
  },

  // CLIENTS
  {
    key: 'canCreateClients',
    label: 'Créer de nouvelles fiches clients',
    description: 'Enregistrer des clients particuliers ou entreprises et conducteurs associés.',
    category: 'clients',
  },
  {
    key: 'canEditClients',
    label: 'Modifier les dossiers clients',
    description: 'Modifier les coordonnées, justificatifs et statuts de solvabilité.',
    category: 'clients',
  },
  {
    key: 'canDeleteClients',
    label: 'Supprimer des fiches clients',
    description: 'Permet de supprimer définitivement un client et son historique de location.',
    category: 'clients',
  },

  // SYSTÈME
  {
    key: 'canManageTerms',
    label: 'Gérer les clauses contractuelles (Verso A4)',
    description: 'Ajouter, modifier ou supprimer des articles dans les conditions générales.',
    category: 'system',
  },
  {
    key: 'canManagePermissions',
    label: 'Gérer les habilitations d’équipe',
    description: 'Pouvoir souverain de distribution et restriction des permissions de l’agence.',
    category: 'system',
  },
  {
    key: 'canManageCompanySettings',
    label: 'Modifier les paramètres société & agence',
    description: 'Paramétrer le logo, en-tête Morvello, mentions légales et RIB bancaire.',
    category: 'system',
  },
  {
    key: 'canViewAuditLogs',
    label: 'Consulter le journal d’audit intégral',
    description: 'Accéder à la traçabilité complète des actions et signatures.',
    category: 'system',
  },
];

const CATEGORY_LABELS = {
  contracts: { title: 'Contrats & Locations', icon: FileText, color: 'text-blue-400' },
  deposits: { title: 'Cautions & Dépôts Financiers', icon: DollarSign, color: 'text-emerald-400' },
  fleet: { title: 'Flotte & Parc Automobile', icon: Car, color: 'text-amber-400' },
  clients: { title: 'Clients & Conducteurs', icon: UserIcon, color: 'text-indigo-400' },
  system: { title: 'Gérance, Clauses & Paramètres', icon: KeyRound, color: 'text-purple-400' },
};

export const PermissionsManager: React.FC = () => {
  const {
    users,
    currentUser,
    switchUser,
    updateUserPermissions,
    updateUserRole,
    resetUserPermissions,
    addUser,
    updateUser,
    deleteUser,
    hasPermission,
    setActiveTab,
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<'credentials' | 'permissions'>('credentials');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string>(
    users.find((u) => u.id !== currentUser.id)?.id || users[0]?.id || ''
  );
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // User phone customization state
  const [userPhoneInput, setUserPhoneInput] = useState('');

  // Add User Modal
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPhone, setNewUserPhone] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('agent');
  const [newUserFleet, setNewUserFleet] = useState('');
  const [addUserError, setAddUserError] = useState('');
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  // Check if current user is manager or admin
  const isGerant = currentUser.role === 'admin' || hasPermission('canManagePermissions');

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Selected user for detailed permissions inspection/editing
  const activeUser = users.find((u) => u.id === selectedUserId) || users[0];

  // Sync phone input when activeUser changes
  useEffect(() => {
    if (activeUser) {
      setUserPhoneInput(activeUser.phone || '');
    }
  }, [activeUser?.id, activeUser?.phone]);

  const handleSavePhone = () => {
    if (!activeUser) return;
    updateUser(activeUser.id, { phone: userPhoneInput.trim() });
    triggerToast(
      `Numéro de téléphone direct mis à jour pour ${activeUser.name} : ${userPhoneInput.trim() || 'Par défaut agence'}`
    );
  };

  const handleTogglePermission = (key: keyof UserPermissions) => {
    if (!activeUser) return;
    if (activeUser.role === 'admin') {
      triggerToast("Les Super Administrateurs possèdent toutes les habilitations par défaut.");
      return;
    }

    const currentPerms = activeUser.permissions || { ...DEFAULT_PERMISSIONS_BY_ROLE[activeUser.role] };
    const currentValue = currentPerms[key];
    const updated = !currentValue;

    updateUserPermissions(activeUser.id, {
      [key]: updated,
    });

    triggerToast(
      `${updated ? 'Permission accordée' : 'Restriction appliquée'} : "${
        PERMISSION_DEFINITIONS.find((p) => p.key === key)?.label
      }" pour ${activeUser.name}.`
    );
  };

  const handleRoleChange = (userId: string, newRole: UserRole) => {
    updateUserRole(userId, newRole);
    triggerToast(`Rôle de ${users.find((u) => u.id === userId)?.name} réassigné en : ${newRole.toUpperCase()}`);
  };

  const handleResetToDefault = (userId: string) => {
    resetUserPermissions(userId);
    triggerToast(`Permissions réinitialisées selon le profil type standard.`);
  };

  const handleGrantAll = (user: User) => {
    const allPerms: UserPermissions = {
      canCreateContracts: true,
      canEditContracts: true,
      canCancelContracts: true,
      canDeleteContracts: user.role === 'admin',
      canValidateContracts: true,
      canExportData: true,
      canManageDeposits: true,
      canCollectDeposit: true,
      canReleaseDeposit: true,
      canDeductDeposit: true,
      canAddVehicles: true,
      canProposeVehicles: true,
      canDirectAddVehicles: true,
      canApproveVehicles: true,
      canAssignFleet: true,
      canAssignVehicleManager: true,
      canEditVehicles: true,
      canDeleteVehicles: true,
      canManageClients: true,
      canCreateClients: true,
      canEditClients: true,
      canDeleteClients: true,
      canManageTerms: true,
      canManagePermissions: true,
      canManageCompanySettings: true,
      canViewAuditLogs: true,
    };
    updateUserPermissions(user.id, allPerms);
    triggerToast(`Toutes les permissions ont été accordées à ${user.name}.`);
  };

  const handleRestrictAll = (user: User) => {
    const restrictedPerms: UserPermissions = {
      canCreateContracts: false,
      canEditContracts: false,
      canCancelContracts: false,
      canDeleteContracts: false,
      canValidateContracts: false,
      canExportData: false,
      canManageDeposits: false,
      canCollectDeposit: false,
      canReleaseDeposit: false,
      canDeductDeposit: false,
      canAddVehicles: false,
      canProposeVehicles: false,
      canDirectAddVehicles: false,
      canApproveVehicles: false,
      canAssignFleet: false,
      canAssignVehicleManager: false,
      canEditVehicles: false,
      canDeleteVehicles: false,
      canManageClients: false,
      canCreateClients: false,
      canEditClients: false,
      canDeleteClients: false,
      canManageTerms: false,
      canManagePermissions: false,
      canManageCompanySettings: false,
      canViewAuditLogs: false,
    };
    updateUserPermissions(user.id, restrictedPerms);
    triggerToast(`Toutes les permissions ont été suspendues pour ${user.name}.`);
  };

  const handleSaveNewUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim()) {
      setAddUserError('Veuillez renseigner le nom et l’adresse email.');
      return;
    }

    const created = addUser({
      name: newUserName.trim(),
      email: newUserEmail.trim().toLowerCase(),
      phone: newUserPhone.trim() || undefined,
      password: newUserPassword.trim() || 'morvello123',
      role: newUserRole,
      assignedFleetName: newUserFleet.trim() || undefined,
      permissions: { ...DEFAULT_PERMISSIONS_BY_ROLE[newUserRole] },
    });

    setIsAddUserModalOpen(false);
    setSelectedUserId(created.id);
    setNewUserName('');
    setNewUserEmail('');
    setNewUserPhone('');
    setNewUserPassword('');
    setNewUserFleet('');
    setAddUserError('');
    triggerToast(`Nouveau collaborateur ${created.name} ajouté avec succès !`);
  };

  const handleDeleteUser = (user: User, e: React.MouseEvent) => {
    e.stopPropagation();
    if (user.id === currentUser.id) {
      triggerToast("Vous ne pouvez pas supprimer votre propre compte en session.");
      return;
    }
    const adminCount = users.filter((u) => u.role === 'admin').length;
    if (user.role === 'admin' && adminCount <= 1) {
      triggerToast("Impossible de supprimer le dernier Gérant/Administrateur.");
      return;
    }
    setUserToDelete(user);
  };

  const confirmDeleteUser = () => {
    if (!userToDelete) return;
    const targetName = userToDelete.name;
    const targetId = userToDelete.id;
    deleteUser(targetId);
    triggerToast(`Collaborateur ${targetName} supprimé avec succès.`);
    const remaining = users.filter((u) => u.id !== targetId);
    if (selectedUserId === targetId && remaining.length > 0) {
      setSelectedUserId(remaining[0].id);
    }
    setUserToDelete(null);
  };

  // If user is not authorized
  if (!isGerant) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-2xl mx-auto text-center space-y-5 my-12 shadow-2xl">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-white">Accès Réservé au Gérant & Administrateur</h2>
          <p className="text-xs text-slate-400 leading-relaxed max-w-md mx-auto">
            La rubrique de gestion des permissions et des habilitations d'équipe est strictement réservée au Gérant de l’agence Morvello Cars afin de préserver l'intégrité opérationnelle et financière.
          </p>
        </div>
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs text-slate-300 flex items-center justify-between">
          <span className="text-slate-400">Votre session actuelle :</span>
          <span className="font-bold text-amber-400">
            {currentUser.name} ({currentUser.role.toUpperCase()})
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            onClick={() => setActiveTab('dashboard')}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl"
          >
            Retour au Tableau de Bord
          </button>
          <button
            onClick={() => {
              const admin = users.find((u) => u.role === 'admin') || users[0];
              if (admin) switchUser(admin.id);
            }}
            className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl shadow-lg shadow-amber-500/20"
          >
            Basculer en profil Gérant ({users.find((u) => u.role === 'admin')?.name || 'Anouar'})
          </button>
        </div>
      </div>
    );
  }

  // Filter definitions by category
  const filteredDefinitions = PERMISSION_DEFINITIONS.filter((def) => {
    if (activeCategoryFilter !== 'all' && def.category !== activeCategoryFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return (
        def.label.toLowerCase().includes(q) ||
        def.description.toLowerCase().includes(q) ||
        def.key.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const getPermValue = (user: User, key: keyof UserPermissions): boolean => {
    if (user.role === 'admin') return true;
    if (user.permissions && typeof user.permissions[key] === 'boolean') {
      return user.permissions[key];
    }
    return DEFAULT_PERMISSIONS_BY_ROLE[user.role]?.[key] ?? false;
  };

  return (
    <div className="space-y-6">
      {/* TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-500 text-slate-950 font-bold px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 border border-emerald-400 text-xs animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-slate-950 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-400 uppercase tracking-widest font-mono">
            <KeyRound className="w-4 h-4 text-amber-400" />
            Rubrique Spéciale Gérant • Contrôle d'Accès Granulaire
          </div>
          <h1 className="text-xl font-extrabold text-white tracking-tight mt-1">
            Gestion des Habilitations & Permissions d'Équipe
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Octroyez ou restreignez les droits d'accès des collaborateurs (contrats, cautions, validation véhicules, clauses).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="bg-slate-950/80 border border-slate-800 px-3 py-1.5 rounded-xl text-xs flex items-center gap-2 font-mono">
            <span className="text-slate-500">Total Équipe :</span>
            <span className="text-white font-bold">{users.length} collaborateurs</span>
          </div>

          <button
            onClick={() => setIsAddUserModalOpen(true)}
            className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 flex items-center gap-1.5 transition-all cursor-pointer hover:scale-102"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Nouveau Collaborateur</span>
          </button>
        </div>
      </div>

      {/* SOUS-NAVIGATION ONGLETS : IDENTIFIANTS VS HABILITATIONS */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => setActiveSubTab('credentials')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'credentials'
              ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
              : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-850 border border-slate-800'
          }`}
        >
          <KeyRound className="w-4 h-4" />
          <span>Identifiants, Logins & Mots de Passe</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
            activeSubTab === 'credentials' ? 'bg-slate-950/30 text-slate-950 font-extrabold' : 'bg-slate-800 text-slate-400'
          }`}>
            {users.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('permissions')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'permissions'
              ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
              : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-850 border border-slate-800'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Matrice des Habilitations RBAC</span>
          <span className="text-[10px] opacity-75 font-mono">
            (Contrats, Flotte, Cautions)
          </span>
        </button>
      </div>

      {/* CONTENU SELON L'ONGLET SÉLECTIONNÉ */}
      {activeSubTab === 'credentials' ? (
        <CredentialsManager />
      ) : (
        <>
          {/* BANNIÈRE DE TEST RAPIDE DE RÔLES */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-amber-500/30 rounded-2xl p-4 shadow-lg flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              Sélecteur de Test en Direct (Impersonation Immédiate)
              <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-md font-mono">
                Test en 1 clic
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Basculez instantanément de profil pour vérifier en temps réel l'impact des restrictions sur l'interface :
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {users.map((u) => {
            const isCurrent = u.id === currentUser.id;
            return (
              <button
                key={u.id}
                onClick={() => switchUser(u.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium border flex items-center gap-2 transition-all cursor-pointer ${
                  isCurrent
                    ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold shadow-md shadow-amber-500/20 scale-103'
                    : 'bg-slate-950/80 text-slate-300 border-slate-700 hover:border-slate-500 hover:text-white'
                }`}
              >
                <div
                  className={`w-2 h-2 rounded-full ${
                    u.role === 'admin'
                      ? 'bg-purple-400'
                      : u.role === 'manager'
                      ? 'bg-blue-400'
                      : 'bg-emerald-400'
                  }`}
                />
                <span>{u.name}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                    isCurrent
                      ? 'bg-slate-950/30 text-slate-950'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {u.role.toUpperCase()}
                </span>
                {isCurrent && <Check className="w-3.5 h-3.5 ml-0.5 text-slate-950 stroke-[3]" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* CORPS PRINCIPAL : GAUCHE LISTE DES MEMBRES / DROITE MATRICE DES PERMISSIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* COLONNE GAUCHE : SÉLECTION DU MEMBRE À CONFIGURER (4 cols) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-400" />
                Membres de l'Agence
              </span>
              <span className="text-[10px] text-slate-500 font-mono">{users.length} comptes</span>
            </div>

            <div className="space-y-2">
              {users.map((user) => {
                const isSelected = user.id === activeUser?.id;
                const isSessionUser = user.id === currentUser.id;
                return (
                  <div
                    key={user.id}
                    onClick={() => setSelectedUserId(user.id)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer relative ${
                      isSelected
                        ? 'bg-slate-800/90 border-amber-500/60 shadow-lg shadow-amber-500/10'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                            user.role === 'admin'
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                              : user.role === 'manager'
                              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {user.name.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <strong className="text-xs text-white font-bold">{user.name}</strong>
                            {isSessionUser && (
                              <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1 rounded font-mono">
                                VOUS
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400 block truncate max-w-[170px]">
                            {user.email}
                          </span>
                          {user.phone && (
                            <span className="text-[10.5px] text-amber-400 font-mono flex items-center gap-1 mt-0.5 font-semibold">
                              <Phone className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                              <span>{user.phone}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-lg font-mono border ${
                          user.role === 'admin'
                            ? 'bg-purple-500/15 text-purple-400 border-purple-500/30'
                            : user.role === 'manager'
                            ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                            : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                        }`}
                      >
                        {user.role.toUpperCase()}
                      </span>
                    </div>

                    {user.assignedFleetName && (
                      <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center gap-1 text-[10px] text-slate-400 font-mono">
                        <Car className="w-3 h-3 text-amber-400" />
                        <span>Flotte : {user.assignedFleetName}</span>
                      </div>
                    )}

                    {isGerant && user.id !== currentUser.id && !(user.role === 'admin' && users.filter((u) => u.role === 'admin').length <= 1) && (
                      <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-end">
                        <button
                          type="button"
                          onClick={(e) => handleDeleteUser(user, e)}
                          className="px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg text-[10px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                          title="Supprimer ce collaborateur"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Supprimer</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* COLONNE DROITE : GESTION DES DROITS DU MEMBRE SÉLECTIONNÉ (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          {activeUser ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-5">
              {/* EN-TÊTE DU MEMBRE SÉLECTIONNÉ */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-base ${
                      activeUser.role === 'admin'
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                        : activeUser.role === 'manager'
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    }`}
                  >
                    {activeUser.name.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-extrabold text-white">{activeUser.name}</h2>
                      <span className="text-xs text-slate-400 font-mono">({activeUser.email})</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span className="text-xs text-slate-400">Rôle hiérarchique :</span>
                      <select
                        value={activeUser.role}
                        onChange={(e) => handleRoleChange(activeUser.id, e.target.value as UserRole)}
                        className="bg-slate-950 border border-slate-700 text-amber-400 text-xs font-bold rounded-lg px-2.5 py-1 focus:outline-none focus:border-amber-500 font-mono cursor-pointer"
                      >
                        <option value="admin">SUPER ADMIN / GÉRANT</option>
                        <option value="manager">RESPONSABLE DE FLOTTE</option>
                        <option value="agent">AGENT DE COMPTOIR</option>
                      </select>
                      {activeUser.assignedFleetName && (
                        <span className="text-[11px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-lg border border-slate-700">
                          Flotte : {activeUser.assignedFleetName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* BOUTONS ACTIONS GROUPÉES */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => handleResetToDefault(activeUser.id)}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium rounded-xl border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
                    title="Rétablir les permissions standard associées au rôle"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Profil type</span>
                  </button>

                  <button
                    onClick={() => handleGrantAll(activeUser)}
                    className="px-2.5 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 text-xs font-bold rounded-xl border border-emerald-500/30 transition-colors flex items-center gap-1.5 cursor-pointer"
                    title="Accorder toutes les autorisations"
                  >
                    <Unlock className="w-3.5 h-3.5" />
                    <span>Tout autoriser</span>
                  </button>

                  <button
                    onClick={() => handleRestrictAll(activeUser)}
                    className="px-2.5 py-1.5 bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 text-xs font-bold rounded-xl border border-rose-500/30 transition-colors flex items-center gap-1.5 cursor-pointer"
                    title="Restreindre tous les droits"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Tout restreindre</span>
                  </button>
                </div>
              </div>

              {/* TÉLÉPHONE DIRECT DU COLLABORATEUR / MANAGER (POUR EN-TÊTE PDF CONTRATS) */}
              <div className="bg-slate-950/90 border border-amber-500/30 rounded-xl p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-inner">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-white font-bold">Numéro de Téléphone Direct (GSM Manager / Contrats)</span>
                      <span className="text-[10px] bg-amber-500/20 text-amber-300 font-mono px-2 py-0.5 rounded-full border border-amber-500/40 font-bold">
                        En-tête 1ère Page PDF
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Ce numéro personnalisé apparaîtra automatiquement sur les contrats de location dont ce collaborateur a la charge (flotte attitrée ou création de contrat).
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 md:self-center">
                  <div className="relative">
                    <input
                      type="tel"
                      value={userPhoneInput}
                      onChange={(e) => setUserPhoneInput(e.target.value)}
                      placeholder="Ex: +212 661-458920"
                      className="bg-slate-900 border border-slate-700 text-amber-300 font-mono text-xs px-3 py-2 rounded-xl w-48 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                  <button
                    onClick={handleSavePhone}
                    className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                    title="Enregistrer ce numéro de téléphone"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Enregistrer</span>
                  </button>
                </div>
              </div>

              {/* FILTRES PAR CATÉGORIE & RECHERCHE */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    onClick={() => setActiveCategoryFilter('all')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      activeCategoryFilter === 'all'
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    Toutes ({PERMISSION_DEFINITIONS.length})
                  </button>
                  {Object.entries(CATEGORY_LABELS).map(([catKey, catMeta]) => {
                    const count = PERMISSION_DEFINITIONS.filter((p) => p.category === catKey).length;
                    return (
                      <button
                        key={catKey}
                        onClick={() => setActiveCategoryFilter(catKey)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                          activeCategoryFilter === catKey
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <span>{catMeta.title}</span>
                        <span className="text-[10px] opacity-75 font-mono">({count})</span>
                      </button>
                    );
                  })}
                </div>

                <div className="relative w-full sm:w-60">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filtrer permission..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* AVERTISSEMENT SI SUPER ADMIN */}
              {activeUser.role === 'admin' && (
                <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-3 text-xs text-purple-200 flex items-center gap-2.5">
                  <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
                  <span>
                    Ce compte dispose du statut <strong>SUPER ADMIN / GÉRANT</strong> : toutes les permissions ci-dessous sont actives de droit et irrévocables tant que le rôle demeure Admin.
                  </span>
                </div>
              )}

              {/* GRILLE DES PERMISSIONS INDIVIDUELLES */}
              <div className="space-y-2.5">
                {filteredDefinitions.map((perm) => {
                  const isEnabled = getPermValue(activeUser, perm.key);
                  const catMeta = CATEGORY_LABELS[perm.category];
                  const CatIcon = catMeta.icon;

                  return (
                    <div
                      key={perm.key}
                      onClick={() => handleTogglePermission(perm.key)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-4 group ${
                        isEnabled
                          ? 'bg-slate-950/80 border-slate-800 hover:border-amber-500/40'
                          : 'bg-slate-950/40 border-slate-800/60 opacity-65 hover:opacity-100 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                            isEnabled
                              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                              : 'bg-slate-800 text-slate-500 border border-slate-700'
                          }`}
                        >
                          <CatIcon className="w-4 h-4" />
                        </div>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white group-hover:text-amber-400 transition-colors">
                              {perm.label}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono bg-slate-900 px-1.5 py-0.2 rounded border border-slate-800">
                              {catMeta.title}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 leading-snug">
                            {perm.description}
                          </p>
                        </div>
                      </div>

                      {/* TOGGLE SWITCH */}
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`text-[10px] font-bold font-mono ${
                            isEnabled ? 'text-emerald-400' : 'text-slate-500'
                          }`}
                        >
                          {isEnabled ? 'AUTORISÉ' : 'RESTREINT'}
                        </span>
                        <div
                          className={`w-11 h-6 rounded-full p-1 transition-colors ${
                            isEnabled ? 'bg-emerald-500' : 'bg-slate-800'
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded-full bg-slate-950 transition-transform ${
                              isEnabled ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
              <Users className="w-10 h-10 mx-auto text-slate-600 mb-2" />
              <p className="font-bold text-white">Sélectionnez un membre</p>
              <p className="text-xs text-slate-500">
                Cliquez sur un collaborateur à gauche pour afficher et éditer ses droits d'accès.
              </p>
            </div>
          )}
        </div>
      </div>
        </>
      )}

      {/* MODAL : AJOUT D'UN NOUVEAU MEMBRE D'ÉQUIPE */}
      {isAddUserModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Plus className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Nouveau Collaborateur</h2>
                  <p className="text-xs text-slate-400">
                    Créer un compte d'accès pour un membre de l'agence.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAddUserModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNewUser} className="p-6 space-y-4">
              {addUserError && (
                <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 text-xs text-rose-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{addUserError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nom complet du collaborateur *
                </label>
                <input
                  type="text"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="Ex: Othman Belkadi"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Adresse Email professionnelle *
                </label>
                <input
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="Ex: o.belkadi@morvellocars.com"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Mot de passe de connexion *
                </label>
                <input
                  type="text"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  placeholder="Ex: pass1234 (défaut: morvello123)"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Téléphone Direct (GSM Manager / Contrats)
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    value={newUserPhone}
                    onChange={(e) => setNewUserPhone(e.target.value)}
                    placeholder="Ex: +212 661-458920"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-8 pr-3 py-2 text-xs text-amber-300 font-mono focus:outline-none focus:border-amber-500"
                  />
                  <Phone className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                </div>
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  Apparaîtra sur l'en-tête de la 1ère page des contrats gérés par ce collaborateur.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Rôle hiérarchique *
                  </label>
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-amber-400 font-bold focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="agent">AGENT DE COMPTOIR</option>
                    <option value="manager">RESPONSABLE DE FLOTTE</option>
                    <option value="admin">SUPER ADMIN / GÉRANT</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Affectation flotte (optionnel)
                  </label>
                  <input
                    type="text"
                    value={newUserFleet}
                    onChange={(e) => setNewUserFleet(e.target.value)}
                    placeholder="Ex: Flotte Éco / Berlines"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[11px] text-slate-400">
                Le collaborateur sera automatiquement initialisé avec les permissions standards correspondant à son rôle. Vous pourrez ensuite ajuster individuellement chaque droit.
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddUserModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl shadow-lg shadow-amber-500/20 flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Créer le collaborateur</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL : CONFIRMATION SUPPRESSION COLLABORATEUR */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden p-6 space-y-5">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-base font-bold text-white">Confirmer la suppression</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Êtes-vous sûr de vouloir supprimer définitivement le collaborateur <strong className="text-white">{userToDelete.name}</strong> ({userToDelete.email}) ? Cette action est irréversible.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmDeleteUser}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-600/20 flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Confirmer la suppression</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
