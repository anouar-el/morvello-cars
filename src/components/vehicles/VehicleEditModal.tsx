import React, { useState, useEffect } from 'react';
import { User, Vehicle, FuelType, VehicleStatus } from '../../types';
import {
  Pencil,
  X,
  UserCheck,
  Lock,
  Shield,
  Trash2,
  Save,
} from 'lucide-react';

interface VehicleEditModalProps {
  vehicle: Vehicle | null;
  currentUser: User;
  users: User[];
  canDelete: boolean;
  onClose: () => void;
  onSave: (id: string, updatedData: Partial<Vehicle>) => void;
  onDeleteRequest: (vehicle: Vehicle) => void;
}

export const VehicleEditModal: React.FC<VehicleEditModalProps> = ({
  vehicle,
  currentUser,
  users,
  canDelete,
  onClose,
  onSave,
  onDeleteRequest,
}) => {
  const isAdmin = currentUser.role === 'admin';
  const managers = users.filter((u) => u.role === 'manager');

  const [form, setForm] = useState<{
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

  useEffect(() => {
    if (vehicle) {
      setForm({
        brand: vehicle.brand || '',
        model: vehicle.model || '',
        plate: vehicle.plate || '',
        fuelType: vehicle.fuelType || 'Diesel',
        status: vehicle.status || 'available',
        currentKm: vehicle.currentKm ?? 0,
        dailyRate: vehicle.dailyRate ?? 400,
        year: vehicle.year ?? 2024,
        color: vehicle.color || '',
        notes: vehicle.notes || '',
        lastInspectionDate: vehicle.lastInspectionDate || '',
        insuranceExpiryDate: vehicle.insuranceExpiryDate || '',
        insuranceCompany: vehicle.insuranceCompany || '',
        technicalInspectionExpiryDate: vehicle.technicalInspectionExpiryDate || '',
        vignettePaidYear: vehicle.vignettePaidYear ?? 2026,
        nextOilChangeKm: vehicle.nextOilChangeKm,
        assignedManagerId: vehicle.assignedManagerId || '',
      });
    }
  }, [vehicle]);

  if (!vehicle) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const assignedUser = users.find((u) => u.id === form.assignedManagerId);

    onSave(vehicle.id, {
      brand: form.brand.toUpperCase(),
      model: form.model,
      plate: form.plate.trim(),
      fuelType: form.fuelType,
      status: form.status,
      currentKm: form.currentKm,
      dailyRate: form.dailyRate,
      year: form.year,
      color: form.color,
      notes: form.notes,
      lastInspectionDate: form.lastInspectionDate,
      insuranceExpiryDate: form.insuranceExpiryDate,
      insuranceCompany: form.insuranceCompany,
      technicalInspectionExpiryDate: form.technicalInspectionExpiryDate,
      vignettePaidYear: form.vignettePaidYear,
      nextOilChangeKm: form.nextOilChangeKm,
      assignedManagerId: form.assignedManagerId || undefined,
      assignedManagerName: assignedUser ? assignedUser.name : form.assignedManagerId ? undefined : undefined,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Pencil className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                Modifier le Véhicule{' '}
                <span className="text-amber-400">
                  {vehicle.brand} {vehicle.model}
                </span>
              </h2>
              <p className="text-[11px] text-slate-400 font-mono">
                ID : {vehicle.id} • Immatriculation : {vehicle.plate}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
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
                  value={form.assignedManagerId}
                  onChange={(e) => setForm({ ...form, assignedManagerId: e.target.value })}
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
                <span>{vehicle.assignedManagerName || 'Non affecté (Flotte centrale)'}</span>
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
                value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white uppercase font-bold focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Modèle & Version *</label>
              <input
                type="text"
                required
                placeholder="Ex: Logan 1.5 dCi Prestige"
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
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
              value={form.plate}
              onChange={(e) => setForm({ ...form, plate: e.target.value })}
              className="w-full bg-slate-950 border-2 border-amber-500/50 rounded-xl px-3 py-2 text-amber-400 font-mono font-bold text-sm focus:border-amber-400 focus:outline-none tracking-wider"
            />
            <p className="text-[11px] text-slate-400 mt-1">Format standard marocain : Chiffres | Lettre française | Région (ex: 55264 | A | 73)</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Carburant *</label>
              <select
                value={form.fuelType}
                onChange={(e) => setForm({ ...form, fuelType: e.target.value as FuelType })}
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
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as VehicleStatus })}
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
                value={form.currentKm}
                onChange={(e) => setForm({ ...form, currentKm: Number(e.target.value) })}
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
                value={form.dailyRate}
                onChange={(e) => setForm({ ...form, dailyRate: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-amber-400 font-mono font-bold focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Année Modèle</label>
              <input
                type="number"
                min={2000}
                max={2030}
                value={form.year}
                onChange={(e) => setForm({ ...form, year: Number(e.target.value) })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Couleur</label>
              <input
                type="text"
                placeholder="Ex: Noir Métallisé"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          {/* SUIVI ADMINISTRATIF & TECHNIQUE */}
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
                  value={form.insuranceExpiryDate}
                  onChange={(e) => setForm({ ...form, insuranceExpiryDate: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-amber-500 focus:outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Compagnie d'Assurance</label>
                <input
                  type="text"
                  list="insurance-companies-list"
                  placeholder="Ex: Wafa Assurance, Sanlam, RMA..."
                  value={form.insuranceCompany}
                  onChange={(e) => setForm({ ...form, insuranceCompany: e.target.value })}
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
                  value={form.technicalInspectionExpiryDate}
                  onChange={(e) => setForm({ ...form, technicalInspectionExpiryDate: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-amber-500 focus:outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Année Vignette Payée</label>
                <input
                  type="number"
                  min={2020}
                  max={2030}
                  value={form.vignettePaidYear}
                  onChange={(e) => setForm({ ...form, vignettePaidYear: Number(e.target.value) })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-amber-500 focus:outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Prochaine Vidange (KM)</label>
                <input
                  type="number"
                  min={0}
                  placeholder="Ex: 50000"
                  value={form.nextOilChangeKm ?? ''}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      nextOilChangeKm: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-amber-500 focus:outline-none font-mono"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Date dernière révision / Contrôle technique
            </label>
            <input
              type="date"
              value={form.lastInspectionDate}
              onChange={(e) => setForm({ ...form, lastInspectionDate: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Notes internes / Équipements spécifiques</label>
            <textarea
              rows={2}
              placeholder="Ex: Pneus neufs, GPS installé, boîte automatique, double des clés disponible..."
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            {canDelete ? (
              <button
                type="button"
                onClick={() => onDeleteRequest(vehicle)}
                className="flex items-center gap-1.5 px-3 py-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl text-xs font-semibold transition-colors cursor-pointer border border-rose-500/20"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Supprimer ce véhicule
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
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
  );
};
