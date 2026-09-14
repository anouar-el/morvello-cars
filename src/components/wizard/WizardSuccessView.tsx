import React from 'react';
import { Contract } from '../../types';
import { getContractTemplate } from '../../data/contractTemplates';
import { CheckCircle2, Printer, FileCheck } from 'lucide-react';

interface WizardSuccessViewProps {
  contract: Contract;
  isEditMode: boolean;
  onOpenPdf: (contract: Contract) => void;
  onDone: () => void;
}

export const WizardSuccessView: React.FC<WizardSuccessViewProps> = ({
  contract,
  isEditMode,
  onOpenPdf,
  onDone,
}) => {
  return (
    <div className="max-w-3xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl text-center animate-in zoom-in-95 duration-200">
      <div className="w-16 h-16 bg-emerald-500/15 border-2 border-emerald-500/40 rounded-full flex items-center justify-center text-emerald-400 mx-auto mb-4">
        <CheckCircle2 className="w-10 h-10" />
      </div>

      <span className="text-xs font-bold uppercase tracking-widest text-emerald-400 font-mono">
        {isEditMode ? '✓ Contrat Modifié & Enregistré avec Succès' : '✓ Contrat Créé & Archivé avec Succès'}
      </span>

      <h2 className="text-3xl font-extrabold text-white mt-1 font-mono tracking-wider">
        {contract.contractNumber}
      </h2>

      <p className="text-sm text-slate-300 mt-2 max-w-md mx-auto">
        {isEditMode
          ? `Les modifications du contrat ${contract.contractNumber} ont été enregistrées avec succès dans l'historique et la maquette A4.`
          : `Le contrat a été généré sur 2 pages A4 exactes avec les conditions générales V${contract.termsVersion} et le véhicule a été assigné au statut Loué.`}
      </p>

      {/* Snapshot Summary Box */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 my-6 text-left text-xs grid grid-cols-2 sm:grid-cols-6 gap-3">
        <div>
          <span className="text-slate-400 block">Locataire :</span>
          <span className="font-bold text-white uppercase">
            {contract.clientSnapshot.lastName} {contract.clientSnapshot.firstName}
          </span>
        </div>
        <div>
          <span className="text-slate-400 block">Véhicule :</span>
          <span className="font-bold text-amber-400">
            {contract.vehicleSnapshot.brand} {contract.vehicleSnapshot.model}
          </span>
        </div>
        <div>
          <span className="text-slate-400 block">Immatriculation :</span>
          <span className="font-bold font-mono text-white">
            {contract.vehicleSnapshot.plate}
          </span>
        </div>
        <div>
          <span className="text-slate-400 block">KM Départ :</span>
          <span className="font-bold font-mono text-white">
            {contract.departureKm.toLocaleString()} KM
          </span>
        </div>
        <div>
          <span className="text-slate-400 block">Carburant :</span>
          <span className="font-bold font-mono text-amber-400">
            {contract.departureFuel || '8/8 (Plein)'}
          </span>
        </div>
        <div>
          <span className="text-slate-400 block">Modèle Contrat :</span>
          <span className="font-bold text-emerald-400">
            {getContractTemplate(contract.templateId).name.split(' ')[1] || 'Standard'}
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={() => onOpenPdf(contract)}
          className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-amber-500/25 transition-transform active:scale-95 text-sm cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          Imprimer pour Signature
        </button>

        <button
          onClick={onDone}
          className="flex items-center gap-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white font-medium px-4 py-2.5 rounded-xl border border-slate-700/80 transition-colors text-sm cursor-pointer"
        >
          <FileCheck className="w-4 h-4" />
          Retour à la liste des contrats
        </button>
      </div>
    </div>
  );
};
