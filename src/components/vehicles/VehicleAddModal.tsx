import React, { useState } from 'react';
import { User, Vehicle, FuelType, VehicleStatus } from '../../types';
import { formatPlateFrench } from '../../utils/plateUtils';
import {
  Car,
  X,
  UserCheck,
  ShieldCheck,
  Shield,
} from 'lucide-react';

interface VehicleAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddVehicle: (vehicle: Omit<Vehicle, 'id'>) => void;
  currentUser: User;
  users: User[];
  onToast: (msg: string) => void;
}

export const VehicleAddModal: React.FC<VehicleAddModalProps> = ({
  isOpen,
  onClose,
  onAddVehicle,
  currentUser,
  users,
  onToast,
}) => {
  const isAdmin = currentUser.role === 'admin';
  const isManager = currentUser.role === 'manager';
  const managers = users.filter((u) => u.role === 'manager');
  const gerantName = users.find((u) => u.role === 'admin')?.name || 'Anouar';

  const [form, setForm] = useState({
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

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.brand || !form.model || !form.plate) {
      alert('Veuillez remplir les informations obligatoires');
      return;
    }

    const assignedUser = users.find((u) => u.id === form.assignedManagerId);

    if (!isAdmin) {
      onAddVehicle({
        ...form,
        brand: form.brand.toUpperCase(),
        plate: formatPlateFrench(form.plate.trim()),
        assignedManagerId: isManager ? currentUser.id : (form.assignedManagerId || undefined),
        assignedManagerName: isManager ? currentUser.name : (assignedUser?.name || undefined),
        approvalStatus: 'pending_approval',
        proposedBy: currentUser.name,
      });
      onToast(`Proposition pour ${form.brand} soumise au Gérant pour approbation !`);
    } else {
      onAddVehicle({
        ...form,
        brand: form.brand.toUpperCase(),
        plate: formatPlateFrench(form.plate.trim()),
        assignedManagerId: form.assignedManagerId || undefined,
        assignedManagerName: assignedUser?.name || undefined,
        approvalStatus: 'approved',
      });
      onToast(`Véhicule ${form.brand} ajouté directement au parc avec succès.`);
    }

    onClose();
  };

  return (
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
                  : "Ajout ouvert à tous sous réserve d'approbation obligatoire du Gérant"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
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
              L'ajout de véhicule est ouvert à tous mais requiert l'approbation du Gérant ({gerantName}). Votre proposition sera enregistrée avec le statut{' '}
              <span className="font-mono text-amber-400">"En attente d'approbation"</span> avant de pouvoir intégrer la flotte active et être louée.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          {/* ASSIGNMENT FIELD */}
          {isAdmin ? (
            <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl">
              <label className="block text-slate-300 font-semibold mb-1 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                Responsable attitré (Affectation immédiate par le Gérant)
              </label>
              <select
                value={form.assignedManagerId}
                onChange={(e) => setForm({ ...form, assignedManagerId: e.target.value })}
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
                <span className="text-white font-semibold text-xs">
                  {currentUser.name} ({currentUser.assignedFleetName || 'Votre agence'})
                </span>
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
                value={form.assignedManagerId}
                onChange={(e) => setForm({ ...form, assignedManagerId: e.target.value })}
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
                value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white uppercase focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Modèle *</label>
              <input
                type="text"
                required
                placeholder="Ex: Clio 5 1.5 dCi"
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
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
              value={form.plate}
              onChange={(e) => setForm({ ...form, plate: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono font-bold focus:border-amber-500 focus:outline-none"
            />
            <p className="text-[11px] text-slate-400 mt-1">Exemple : 55264 | A | 73</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1">Carburant *</label>
              <select
                value={form.fuelType}
                onChange={(e) => setForm({ ...form, fuelType: e.target.value as FuelType })}
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
                value={form.currentKm}
                onChange={(e) => setForm({ ...form, currentKm: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1">Tarif Journalier (MAD)</label>
              <input
                type="number"
                value={form.dailyRate}
                onChange={(e) => setForm({ ...form, dailyRate: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Couleur</label>
              <input
                type="text"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          {/* SUIVI ADMINISTRATIF & TECHNIQUE */}
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
                  value={form.insuranceExpiryDate}
                  onChange={(e) => setForm({ ...form, insuranceExpiryDate: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Compagnie d'Assurance</label>
                <input
                  type="text"
                  list="insurance-companies-add"
                  placeholder="Ex: Wafa Assurance, Sanlam..."
                  value={form.insuranceCompany}
                  onChange={(e) => setForm({ ...form, insuranceCompany: e.target.value })}
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
                  value={form.technicalInspectionExpiryDate}
                  onChange={(e) => setForm({ ...form, technicalInspectionExpiryDate: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Année Vignette Payée</label>
                <input
                  type="number"
                  min={2020}
                  max={2030}
                  value={form.vignettePaidYear}
                  onChange={(e) => setForm({ ...form, vignettePaidYear: Number(e.target.value) })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Prochaine Vidange (KM)</label>
                <input
                  type="number"
                  min={0}
                  placeholder="Ex: 50000"
                  value={form.nextOilChangeKm || ''}
                  onChange={(e) => setForm({ ...form, nextOilChangeKm: Number(e.target.value) })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
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
  );
};
