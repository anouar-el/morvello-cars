import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { User, UserRole } from '../types';
import { generateStrongPassword } from '../utils/cryptoAuth';
import {
  KeyRound,
  ShieldCheck,
  Crown,
  Building2,
  User as UserIcon,
  Eye,
  EyeOff,
  Copy,
  Check,
  Edit3,
  Trash2,
  Plus,
  Cloud,
  RefreshCw,
  Phone,
  Mail,
  Lock,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Server,
  Database,
  ExternalLink,
} from 'lucide-react';

export const CredentialsManager: React.FC = () => {
  const {
    users,
    currentUser,
    updateUser,
    updateUserRole,
    addUser,
    deleteUser,
    pushToCloud,
    cloudSyncStatus,
    lastCloudSync,
  } = useApp();

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});
  const [isSyncing, setIsSyncing] = useState(false);

  // Edit User Modal
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('agent');
  const [editFleet, setEditFleet] = useState('');

  // Add User Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('agent');
  const [newFleet, setNewFleet] = useState('');

  // Delete User Modal
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
    triggerToast(`Copié dans le presse-papier : ${text}`);
  };

  const togglePasswordVisibility = (userId: string) => {
    setRevealedPasswords((prev) => ({
      ...prev,
      [userId]: !prev[userId],
    }));
  };

  const handleOpenEdit = (user: User) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditPassword('');
    setEditPhone(user.phone || '');
    setEditRole(user.role);
    setEditFleet(user.assignedFleetName || '');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    if (!editEmail.trim() || !editName.trim()) {
      triggerToast("Le nom et l'email sont obligatoires.");
      return;
    }

    const payload: Partial<User> = {
      name: editName.trim(),
      email: editEmail.trim().toLowerCase(),
      phone: editPhone.trim() || undefined,
      role: editRole,
      assignedFleetName: editFleet.trim() || undefined,
    };

    if (editPassword.trim()) {
      payload.password = editPassword.trim();
    }

    await updateUser(editingUser.id, payload);

    if (editRole !== editingUser.role) {
      await updateUserRole(editingUser.id, editRole);
    }

    triggerToast(`Identifiants et rôle de ${editName} mis à jour avec succès.`);
    setEditingUser(null);

    // Sync to Cloud Firestore automatically
    try {
      await pushToCloud();
      triggerToast(`Identifiants synchronisés avec le Cloud Firestore !`);
    } catch {
      // ignore
    }
  };

  const handleSaveNewUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim()) {
      triggerToast("Veuillez renseigner au moins le nom et l'email.");
      return;
    }

    const pass = newPassword.trim() || generateStrongPassword();

    const created = await addUser({
      name: newName.trim(),
      email: newEmail.trim().toLowerCase(),
      password: pass,
      phone: newPhone.trim() || undefined,
      role: newRole,
      assignedFleetName: newFleet.trim() || undefined,
    });

    setIsAddModalOpen(false);
    setNewName('');
    setNewEmail('');
    setNewPassword('');
    setNewPhone('');
    setNewFleet('');

    triggerToast(`Nouveau collaborateur ${created.name} créé avec mot de passe chiffré !`);

    // Sync to cloud
    try {
      await pushToCloud();
    } catch {
      // ignore
    }
  };

  const confirmDeleteUser = () => {
    if (!userToDelete) return;
    deleteUser(userToDelete.id);
    triggerToast(`Compte ${userToDelete.name} supprimé.`);
    setUserToDelete(null);
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      const ok = await pushToCloud();
      if (ok) {
        triggerToast("Synchronisation Cloud Firestore réussie ! Tous les comptes sont répliqués.");
      } else {
        triggerToast("Sauvegarde locale validée (synchronisation Cloud en file d'attente).");
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const gerantUser = users.find((u) => u.role === 'admin') || users[0];

  return (
    <div className="space-y-6">
      {/* TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-500 text-slate-950 font-bold px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 border border-emerald-400 text-xs animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-slate-950 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* TOP SECURITY BANNER & SYNC STATUS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Type de connexion 1 */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4.5 shadow-lg relative overflow-hidden flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-400 font-mono uppercase tracking-wider">
              <KeyRound className="w-4 h-4" />
              <span>Authentification Flotte Morvello</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Comptes individuels avec identifiants personnels (Email & Mot de passe) et permissions RBAC pour chaque agence.
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
            <span>Comptes configurés :</span>
            <strong className="text-white font-mono">{users.length} collaborateurs</strong>
          </div>
        </div>

        {/* Type de connexion 2 : Cloud Supabase */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4.5 shadow-lg flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 font-mono uppercase tracking-wider">
                <Database className="w-4 h-4" />
                <span>Base Cloud Supabase (PostgreSQL)</span>
              </div>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                cloudSyncStatus === 'synced'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              }`}>
                {cloudSyncStatus === 'synced' ? 'Connecté' : 'Actif'}
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Synchronisation instantanée des mots de passe et droits dans la table PostgreSQL <code className="text-emerald-300">agency_data</code>.
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between">
            <span className="text-[10px] text-slate-500">
              {lastCloudSync ? `Sync: ${lastCloudSync}` : 'uxswtmfrrxagkmewpwyd'}
            </span>
            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              className="px-2.5 py-1 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Sync...' : 'Synchroniser'}</span>
            </button>
          </div>
        </div>


        {/* Action Rapide Nouveau Collaborateur */}
        <div className="bg-gradient-to-br from-amber-500/10 via-slate-900 to-slate-900 border border-amber-500/30 rounded-2xl p-4.5 shadow-lg flex flex-col justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase font-mono">
              <Sparkles className="w-4 h-4" />
              <span>Gestion des Accès Équipe</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Créez de nouveaux accès pour vos chauffeurs, agents de comptoir ou managers d'agence.
            </p>
          </div>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="mt-3 w-full px-3.5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Créer un Accès Collaborateur</span>
          </button>
        </div>
      </div>

      {/* CARTE SPÉCIALE : COMPTE DU GÉRANT (ANOUAR) */}
      {gerantUser && (
        <div className="bg-gradient-to-r from-purple-950/40 via-slate-900 to-slate-900 border border-purple-500/40 rounded-2xl p-5 shadow-xl relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300 shrink-0">
                <Crown className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/40 font-mono px-2 py-0.5 rounded-full font-bold">
                    COMPTE SUPER-ADMINISTRATEUR
                  </span>
                  <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Accès Total Maître
                  </span>
                </div>
                <h2 className="text-lg font-extrabold text-white mt-0.5">
                  {gerantUser.name} <span className="text-slate-400 text-sm font-normal">(Gérant Morvello Cars)</span>
                </h2>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-slate-300">
                  <span className="flex items-center gap-1.5 font-mono text-amber-400">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    Email d'agence : <strong>{gerantUser.email}</strong>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="bg-slate-950/80 border border-slate-800 px-3.5 py-2 rounded-xl flex items-center gap-3">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-mono block">Sécurité Compte Gérant</span>
                  <span className="text-xs font-mono font-bold text-emerald-400 tracking-wider flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Firebase Auth Natif
                  </span>
                </div>
              </div>

              <button
                onClick={() => handleOpenEdit(gerantUser)}
                className="px-4 py-2.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Edit3 className="w-4 h-4" />
                <span>Modifier le Mot de Passe</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TABLEAU COMPLET DES COMPTES & MOTS DE PASSE */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span>Répertoire des Logins & Mots de Passe Collaborateurs</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Gérez les identifiants de connexion, numéros GSM directs et mots de passe de chaque membre.
            </p>
          </div>

          <div className="text-xs font-mono text-slate-400 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
            Total : <strong className="text-white">{users.length}</strong> comptes actifs
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                <th className="py-3 px-4">Collaborateur</th>
                <th className="py-3 px-4">Rôle & Flotte</th>
                <th className="py-3 px-4">Login / Email de Connexion</th>
                <th className="py-3 px-4">Mot de Passe</th>
                <th className="py-3 px-4">GSM Direct (Contrats)</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850 text-xs">
              {users.map((u) => {
                const isCurrent = u.id === currentUser?.id;
                const isGerant = u.role === 'admin';

                return (
                  <tr key={u.id} className="hover:bg-slate-850/50 transition-colors group">
                    {/* Collaborateur */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                            isGerant
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                              : u.role === 'manager'
                              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {isGerant ? <Crown className="w-4 h-4" /> : u.name.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <strong className="text-white font-bold">{u.name}</strong>
                            {isCurrent && (
                              <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1 rounded font-mono font-bold">
                                VOUS
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono">ID: {u.id}</span>
                        </div>
                      </div>
                    </td>

                    {/* Rôle & Flotte */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-1">
                        <span
                          className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-lg font-mono border ${
                            isGerant
                              ? 'bg-purple-500/15 text-purple-400 border-purple-500/30'
                              : u.role === 'manager'
                              ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                              : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          }`}
                        >
                          {isGerant ? 'GÉRANT / SUPER ADMIN' : u.role === 'manager' ? 'RESPONSABLE FLOTTE' : 'AGENT DE COMPTOIR'}
                        </span>
                        {u.assignedFleetName && (
                          <div className="text-[10.5px] text-slate-400 flex items-center gap-1 font-mono">
                            <Building2 className="w-3 h-3 text-slate-500" />
                            <span>{u.assignedFleetName}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Login / Email */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-slate-200">{u.email}</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(u.email, `email-${u.id}`)}
                          className="text-slate-500 hover:text-amber-400 transition-colors cursor-pointer p-1"
                          title="Copier l'email de connexion"
                        >
                          {copiedId === `email-${u.id}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* Mot de Passe */}
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <div className="bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 font-mono text-[11px] text-emerald-400 flex items-center gap-1.5">
                            <Lock className="w-3 h-3 text-emerald-400" />
                            <span>Firebase Auth</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(u)}
                            className="text-slate-400 hover:text-amber-400 transition-colors cursor-pointer p-1"
                            title="Modifier le compte ou mot de passe"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {u.mustChangePassword && (
                          <span className="text-[10px] bg-amber-500/15 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded font-mono font-bold flex items-center gap-1 w-fit">
                            <AlertTriangle className="w-3 h-3 text-amber-400" />
                            Renouvellement requis
                          </span>
                        )}
                      </div>
                    </td>

                    {/* GSM Direct */}
                    <td className="py-3.5 px-4">
                      {u.phone ? (
                        <span className="font-mono text-amber-300/90 font-semibold flex items-center gap-1.5">
                          <Phone className="w-3 h-3 text-amber-400" />
                          <span>{u.phone}</span>
                        </span>
                      ) : (
                        <span className="text-slate-500 italic text-[11px]">Par défaut agence</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(u)}
                          className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                          title="Modifier l'email ou le mot de passe"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                          <span>Modifier</span>
                        </button>

                        {!isGerant && users.filter((x) => x.role === 'admin').length > 0 && (
                          <button
                            type="button"
                            onClick={() => setUserToDelete(u)}
                            className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg transition-colors cursor-pointer"
                            title="Supprimer le compte"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL : MODIFIER IDENTIFIANTS & MOT DE PASSE */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden p-6 space-y-5 animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Modifier les Identifiants d'Accès</h3>
                  <p className="text-xs text-slate-400">Collaborateur : {editingUser.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="text-slate-500 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nom Complet
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Email / Login de Connexion *
                  </label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                    required
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-300">
                      Nouveau Mot de Passe
                    </label>
                    <button
                      type="button"
                      onClick={() => setEditPassword(generateStrongPassword())}
                      className="text-[10px] text-amber-400 hover:text-amber-300 flex items-center gap-1 font-mono cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3" />
                      Générer sécurisé
                    </button>
                  </div>
                  <input
                    type="text"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-amber-400 font-mono font-bold focus:outline-none focus:border-amber-500"
                    placeholder="Laisser vide pour conserver le mot de passe actuel"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Téléphone direct (GSM)
                  </label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="+212 600-000000"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Rôle
                  </label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as UserRole)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-amber-400 font-bold focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="admin">SUPER ADMIN / GÉRANT</option>
                    <option value="manager">RESPONSABLE DE FLOTTE</option>
                    <option value="agent">AGENT DE COMPTOIR</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Affectation Flotte / Agence
                </label>
                <input
                  type="text"
                  value={editFleet}
                  onChange={(e) => setEditFleet(e.target.value)}
                  placeholder="Ex: Aéroport Nouaceur / Berlines Premium"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[11px] text-slate-400 flex items-center gap-2">
                <Cloud className="w-4 h-4 text-blue-400 shrink-0" />
                <span>Ce mot de passe sera immédiatement synchronisé avec le Cloud Firestore pour tous les appareils.</span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl shadow-lg shadow-amber-500/20 flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Enregistrer les Identifiants</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL : CRÉER UN COLLABORATEUR */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden p-6 space-y-5 animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <Plus className="w-4 h-4 stroke-[3]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Nouveau Collaborateur & Accès</h3>
                  <p className="text-xs text-slate-400">Configurez l'email et le mot de passe initial</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-500 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveNewUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nom Complet du Collaborateur *
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ex: Yassine Berrada"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Adresse Email (Login) *
                  </label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="yassine@morvellocars.com"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                    required
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-300">
                      Mot de passe initial *
                    </label>
                    <button
                      type="button"
                      onClick={() => setNewPassword(generateStrongPassword())}
                      className="text-[10px] text-amber-400 hover:text-amber-300 flex items-center gap-1 font-mono cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3" />
                      Générer sécurisé
                    </button>
                  </div>
                  <input
                    type="text"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Ex: morvello2026"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-amber-400 font-mono font-bold focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Rôle Hiérarchique
                  </label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as UserRole)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-amber-400 font-bold focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="agent">AGENT DE COMPTOIR</option>
                    <option value="manager">RESPONSABLE DE FLOTTE</option>
                    <option value="admin">SUPER ADMIN / GÉRANT</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Téléphone Direct (GSM)
                  </label>
                  <input
                    type="tel"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="+212 600-000000"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Affectation Flotte / Agence (Optionnel)
                </label>
                <input
                  type="text"
                  value={newFleet}
                  onChange={(e) => setNewFleet(e.target.value)}
                  placeholder="Ex: Agence Casablanca Maarif"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl shadow-lg shadow-amber-500/20 flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Créer le Collaborateur</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL : CONFIRMER SUPPRESSION */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-base font-bold text-white">Supprimer le Collaborateur</h3>
              <p className="text-xs text-slate-400">
                Supprimer définitivement l'accès de <strong className="text-white">{userToDelete.name}</strong> ({userToDelete.email}) ?
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
                <span>Confirmer</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
