import React, { useState } from 'react';
import { Contract } from '../types';
import { useApp } from '../context/AppContext';
import { X, CheckCircle2, Gauge, Calendar, Clock, AlertCircle } from 'lucide-react';

interface ReturnCheckInModalProps {
  contract: Contract | null;
  onClose: () => void;
}

export const ReturnCheckInModal: React.FC<ReturnCheckInModalProps> = ({ contract, onClose }) => {
  const { completeContract } = useApp();

  if (!contract) return null;

  const today = '2026-09-01';
  const nowTime = '18:30';

  const [returnKm, setReturnKm] = useState<number>(contract.departureKm + 350);
  const [returnDate, setReturnDate] = useState<string>(today);
  const [returnTime, setReturnTime] = useState<string>(nowTime);
  const [returnNotes, setReturnNotes] = useState<string>('Véhicule inspecté. État de propreté et niveau de carburant conformes.');
  const [fuelLevel, setFuelLevel] = useState<string>('8/8 (Plein)');

  const kmDriven = returnKm - contract.departureKm;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (returnKm < contract.departureKm) {
      alert('Le kilométrage de retour ne peut pas être inférieur au kilométrage de départ !');
      return;
    }

    completeContract(contract.id, returnKm, returnDate, returnTime, `${returnNotes} [Carburant: ${fuelLevel}]`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
        {/* HEADER */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">
                Clôture de Contrat & Restitution Véhicule
              </h2>
              <p className="text-xs text-amber-400 font-mono font-semibold">
                Contrat N° {contract.contractNumber}
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

        {/* INFO SUMMARY */}
        <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 text-xs grid grid-cols-2 gap-2 text-slate-300">
          <div>
            <span className="text-slate-500 block">Client :</span>
            <strong className="text-white uppercase">
              {contract.clientSnapshot.lastName} {contract.clientSnapshot.firstName}
            </strong>
          </div>
          <div>
            <span className="text-slate-500 block">Véhicule :</span>
            <strong className="text-amber-400">
              {contract.vehicleSnapshot.brand} {contract.vehicleSnapshot.model}
            </strong>
          </div>
          <div>
            <span className="text-slate-500 block">Immatriculation :</span>
            <span className="font-mono text-white">{contract.vehicleSnapshot.plate}</span>
          </div>
          <div>
            <span className="text-slate-500 block">KM Départ :</span>
            <span className="font-mono text-white">{contract.departureKm.toLocaleString()} KM</span>
          </div>
        </div>

        {/* FORM */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* RETURN KM */}
          <div>
            <label className="block text-slate-300 font-medium mb-1">
              Kilométrage au Retour (Relevé Compteur) *
            </label>
            <div className="relative">
              <Gauge className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="number"
                value={returnKm}
                onChange={(e) => setReturnKm(Number(e.target.value))}
                min={contract.departureKm}
                required
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-white font-mono font-bold text-sm focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div className="flex justify-between items-center text-[11px] mt-1 text-slate-400">
              <span>Distance parcourue lors du contrat :</span>
              <span className="font-bold text-emerald-400 font-mono">
                {kmDriven >= 0 ? `+${kmDriven.toLocaleString()} KM` : 'Invalide'}
              </span>
            </div>
          </div>

          {/* DATE & TIME */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Date réelle de retour *</label>
              <input
                type="date"
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-medium mb-1">Heure de retour *</label>
              <input
                type="time"
                value={returnTime}
                onChange={(e) => setReturnTime(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          {/* FUEL LEVEL */}
          <div>
            <label className="block text-slate-300 font-medium mb-1">Niveau de Carburant</label>
            <select
              value={fuelLevel}
              onChange={(e) => setFuelLevel(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
            >
              <option value="8/8 (Plein)">8/8 — Plein complet (Conforme)</option>
              <option value="7/8">7/8 — Presque plein</option>
              <option value="6/8 (3/4)">6/8 — 3/4</option>
              <option value="4/8 (1/2)">4/8 — Moitié</option>
              <option value="2/8 (1/4)">2/8 — 1/4</option>
              <option value="Réserve (Manquant)">Réserve — Manquant (Facturation)</option>
            </select>
          </div>

          {/* INSPECTION NOTES */}
          <div>
            <label className="block text-slate-300 font-medium mb-1">Remarques & État de Restitution</label>
            <textarea
              rows={2}
              value={returnNotes}
              onChange={(e) => setReturnNotes(e.target.value)}
              placeholder="Ex: Véhicule propre, caution débloquée, aucun dommage à signaler."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:border-amber-500 focus:outline-none"
            ></textarea>
          </div>

          {/* AUTOMATIC VEHICLE RELEASE NOTE */}
          <div className="bg-emerald-500/10 border border-emerald-500/30 p-2.5 rounded-xl text-xs text-emerald-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <span>
              La validation de cette restitution passera le statut du contrat à <strong>Terminé</strong> et basculera automatiquement le véhicule à <strong>Disponible</strong> avec son nouveau kilométrage.
            </span>
          </div>

          {/* ACTIONS */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 text-xs font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-transform active:scale-95 cursor-pointer"
            >
              Confirmer la Clôture du Contrat
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
