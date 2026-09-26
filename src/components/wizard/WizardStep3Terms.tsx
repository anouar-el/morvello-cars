import React from 'react';
import { User, CompanySettings } from '../../types';
import { Calendar, Gauge, Fuel, Phone, AlertTriangle } from 'lucide-react';

interface WizardStep3TermsProps {
  startDate: string;
  setStartDate: (v: string) => void;
  startTime: string;
  setStartTime: (v: string) => void;
  departureKm: number;
  setDepartureKm: (v: number) => void;
  departureFuel: string;
  setDepartureFuel: (v: string) => void;
  endDate: string;
  setEndDate: (v: string) => void;
  endTime: string;
  setEndTime: (v: string) => void;
  pricePerDay: number;
  setPricePerDay: (v: number) => void;
  depositAmount: number;
  setDepositAmount: (v: number) => void;
  hasProlongation: boolean;
  setHasProlongation: (v: boolean) => void;
  prolongationDate: string;
  setProlongationDate: (v: string) => void;
  prolongationTime: string;
  setProlongationTime: (v: string) => void;
  assignedManagerId: string;
  setAssignedManagerId: (v: string) => void;
  managerPhone: string;
  setManagerPhone: (v: string) => void;
  users: User[];
  companySettings: CompanySettings;
  totalDays: number;
  totalAmount: number;
  vehicleAvailability?: { available: boolean; conflictReason?: string };
}

export const WizardStep3Terms: React.FC<WizardStep3TermsProps> = ({
  startDate,
  setStartDate,
  startTime,
  setStartTime,
  departureKm,
  setDepartureKm,
  departureFuel,
  setDepartureFuel,
  endDate,
  setEndDate,
  endTime,
  setEndTime,
  pricePerDay,
  setPricePerDay,
  depositAmount,
  setDepositAmount,
  hasProlongation,
  setHasProlongation,
  prolongationDate,
  setProlongationDate,
  prolongationTime,
  setProlongationTime,
  assignedManagerId,
  setAssignedManagerId,
  managerPhone,
  setManagerPhone,
  users,
  companySettings,
  totalDays,
  totalAmount,
  vehicleAvailability,
}) => {
  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      <div className="border-b border-slate-800 pb-3">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Calendar className="w-5 h-5 text-amber-400" />
          Étape 3 : Durée de la Location, Kilométrage Départ & Tarification
        </h2>
        <p className="text-xs text-slate-400">
          Définissez les dates et heures de sortie/retour, le relevé compteur et les montants financiers.
        </p>
      </div>

      {vehicleAvailability && !vehicleAvailability.available && (
        <div className="p-3.5 bg-rose-950/50 border border-rose-500/50 rounded-xl text-rose-200 text-xs flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-rose-300">Véhicule indisponible sur cette période :</p>
            <p>{vehicleAvailability.conflictReason}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
        {/* DÉPART */}
        <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between text-emerald-400 font-bold border-b border-slate-800 pb-1.5">
            <span className="uppercase text-[11px]">Date & Heure de Sortie (Départ)</span>
            <span className="text-[10px] font-arabic">تاريخ وساعة الخروج</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-slate-400 mb-1">Date départ *</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-amber-500 focus:outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Heure départ *</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-amber-500 focus:outline-none font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">KM Départ (Relevé compteur) *</label>
              <div className="relative">
                <Gauge className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="number"
                  value={departureKm === 0 ? '' : departureKm}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setDepartureKm(raw === '' ? 0 : Math.max(0, Number(raw)));
                  }}
                  placeholder="0"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-white font-mono font-bold focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">Carburant au Départ *</label>
              <div className="relative">
                <Fuel className="w-4 h-4 absolute left-3 top-2.5 text-amber-400" />
                <select
                  value={departureFuel}
                  onChange={(e) => setDepartureFuel(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-white font-mono font-semibold focus:border-amber-500 focus:outline-none cursor-pointer"
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
            </div>
          </div>
        </div>

        {/* RETOUR */}
        <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between text-amber-400 font-bold border-b border-slate-800 pb-1.5">
            <span className="uppercase text-[11px]">Date & Heure de Restitution (Retour)</span>
            <span className="text-[10px] font-arabic">تاريخ وساعة الدخول</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-slate-400 mb-1">Date retour *</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-amber-500 focus:outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Heure retour *</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-amber-500 focus:outline-none font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Prix par jour (MAD)</label>
              <input
                type="number"
                value={pricePerDay}
                onChange={(e) => {
                  const raw = e.target.value;
                  setPricePerDay(raw === '' ? 0 : Math.max(0, Number(raw)));
                }}
                placeholder="0"
                min="0"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono font-bold focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Caution (MAD)</label>
              <input
                type="number"
                value={depositAmount}
                onChange={(e) => {
                  const raw = e.target.value;
                  setDepositAmount(raw === '' ? 0 : Math.max(0, Number(raw)));
                }}
                placeholder="0"
                min="0"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* PROLONGATION TOGGLE */}
      <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 text-xs">
        <div className="flex items-center justify-between mb-2">
          <label className="flex items-center gap-2 text-white font-bold cursor-pointer">
            <input
              type="checkbox"
              checked={hasProlongation}
              onChange={(e) => setHasProlongation(e.target.checked)}
              className="rounded border-slate-700 text-amber-500 focus:ring-0 w-4 h-4 cursor-pointer"
            />
            <span>Activer une Prolongation de contrat (التمديد)</span>
          </label>
          <span className="text-[10px] text-slate-500">Ne modifie pas silencieusement la date initiale</span>
        </div>

        {hasProlongation && (
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800 animate-in fade-in duration-150">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Nouvelle date d'échéance</label>
              <input
                type="date"
                value={prolongationDate}
                onChange={(e) => setProlongationDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Nouvelle heure d'échéance</label>
              <input
                type="time"
                value={prolongationTime}
                onChange={(e) => setProlongationTime(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* MANAGER RÉFÉRENT & TÉLÉPHONE DIRECT (POUR L'EN-TÊTE DU CONTRAT PDF) */}
      <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-3">
        <div className="flex items-center justify-between text-amber-400 font-bold border-b border-slate-800 pb-1.5">
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-amber-400" />
            <span className="uppercase text-[11px]">Manager Référent &amp; Téléphone Direct (En-tête PDF)</span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">Personnalisation Contrat</span>
        </div>

        <p className="text-[11px] text-slate-400">
          Le numéro de téléphone ci-dessous s'imprimera directement sur l'en-tête et le pied de page de la 1ère page du contrat PDF pour que le client joigne immédiatement son responsable attitré.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          <div>
            <label className="block text-slate-400 mb-1 font-medium text-xs">
              Collaborateur / Manager en charge *
            </label>
            <select
              value={assignedManagerId}
              onChange={(e) => {
                const newId = e.target.value;
                setAssignedManagerId(newId);
                const mgr = users.find((u) => u.id === newId);
                if (mgr?.phone) {
                  setManagerPhone(mgr.phone);
                } else {
                  setManagerPhone(companySettings.phone1);
                }
              }}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs font-semibold focus:border-amber-500 focus:outline-none cursor-pointer"
            >
              <option value="">Sélectionner un responsable...</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role.toUpperCase()}) {u.phone ? `• ${u.phone}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-medium text-xs flex items-center justify-between">
              <span>Numéro de Téléphone Direct imprimé</span>
              <span className="text-[10px] text-amber-400 font-mono">Modifiable</span>
            </label>
            <div className="relative">
              <input
                type="tel"
                value={managerPhone}
                onChange={(e) => setManagerPhone(e.target.value)}
                placeholder="Ex: +212 661-458920"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-2 text-amber-300 font-mono text-xs font-bold focus:border-amber-500 focus:outline-none"
              />
              <Phone className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>
        </div>
      </div>

      {/* SUMMARY STATS ROW */}
      <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
        <div className="text-slate-400">
          Durée calculée : <strong className="text-white text-sm font-mono">{totalDays} jour(s)</strong>
        </div>
        <div className="text-slate-400">
          Montant total calculé :{' '}
          <strong className="text-amber-400 text-sm font-mono">{totalAmount.toLocaleString('fr-FR')} MAD</strong>
          <span className="text-[11px] text-slate-400 ml-1.5 font-mono">({pricePerDay} MAD/j × {totalDays}j)</span>
        </div>
      </div>
    </div>
  );
};
