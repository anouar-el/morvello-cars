import React, { useState } from 'react';
import { Contract } from '../types';
import { DigitalSignaturePad } from './DigitalSignaturePad';
import {
  X,
  FileCheck,
  ShieldCheck,
  User,
  Car,
  Building2,
  Calendar,
  Clock,
  CheckCircle2,
  Lock,
} from 'lucide-react';

interface DigitalSignatureModalProps {
  contract: Contract;
  isOpen: boolean;
  onClose: () => void;
  onSignatureSaved: (updatedContract: Contract) => void;
  updateContract: (id: string, data: Partial<Contract>) => Contract | undefined;
  defaultRole?: 'client' | 'second_driver' | 'agency';
}

export const DigitalSignatureModal: React.FC<DigitalSignatureModalProps> = ({
  contract,
  isOpen,
  onClose,
  onSignatureSaved,
  updateContract,
  defaultRole = 'client',
}) => {
  const [activeSigner, setActiveSigner] = useState<'client' | 'second_driver' | 'agency'>(defaultRole);
  const [signerFullName, setSignerFullName] = useState<string>(
    `${contract.clientSnapshot.firstName} ${contract.clientSnapshot.lastName}`
  );
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSignerChange = (role: 'client' | 'second_driver' | 'agency') => {
    setActiveSigner(role);
    if (role === 'client') {
      setSignerFullName(`${contract.clientSnapshot.firstName} ${contract.clientSnapshot.lastName}`);
    } else if (role === 'second_driver' && contract.secondDriverSnapshot) {
      setSignerFullName(`${contract.secondDriverSnapshot.firstName} ${contract.secondDriverSnapshot.lastName}`);
    } else if (role === 'agency') {
      setSignerFullName(contract.assignedManagerName || contract.createdBy || 'Direction Morvello Cars');
    }
  };

  const handleSaveSignature = (dataUrl: string) => {
    const nowIso = new Date().toISOString();
    const certId = `MORV-SIG-${contract.contractNumber}-${Date.now().toString(36).toUpperCase()}`;

    let updateData: Partial<Contract> = {};

    if (activeSigner === 'client') {
      updateData = {
        clientSignature: dataUrl,
        clientSignedAt: nowIso,
        clientSignedName: signerFullName,
        signatureCertId: certId,
      };
    } else if (activeSigner === 'second_driver') {
      updateData = {
        secondDriverSignature: dataUrl,
        secondDriverSignedAt: nowIso,
      };
    } else if (activeSigner === 'agency') {
      updateData = {
        agencySignature: dataUrl,
        agencySignedAt: nowIso,
        agencySignedBy: signerFullName,
      };
    }

    const updated = updateContract(contract.id, updateData);
    if (updated) {
      setIsSuccess(true);
      onSignatureSaved(updated);
      setTimeout(() => {
        setIsSuccess(false);
        onClose();
      }, 1200);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <FileCheck className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-bold text-white tracking-wide">
                  Signature Électronique Certifiée
                </h3>
                <span className="text-[9px] sm:text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" />
                  Conforme A4
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate max-w-[240px] sm:max-w-none">
                Contrat N° <span className="font-mono text-amber-300 font-bold">{contract.contractNumber}</span> • {contract.vehicleSnapshot.brand} {contract.vehicleSnapshot.model}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto">
          {/* Signer Selector Tabs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 sm:gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => handleSignerChange('client')}
              className={`flex items-center justify-center gap-1.5 py-1.5 sm:py-2 px-2.5 sm:px-3 rounded-lg font-semibold transition-all cursor-pointer ${
                activeSigner === 'client'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Locataire Principal</span>
              {contract.clientSignature && <CheckCircle2 className="w-3 h-3 text-emerald-950" />}
            </button>

            {contract.hasSecondDriver && contract.secondDriverSnapshot ? (
              <button
                type="button"
                onClick={() => handleSignerChange('second_driver')}
                className={`flex items-center justify-center gap-1.5 py-1.5 sm:py-2 px-2.5 sm:px-3 rounded-lg font-semibold transition-all cursor-pointer ${
                  activeSigner === 'second_driver'
                    ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>2ème Conducteur</span>
                {contract.secondDriverSignature && <CheckCircle2 className="w-3 h-3 text-emerald-950" />}
              </button>
            ) : (
              <div className="hidden sm:flex items-center justify-center gap-1 py-2 px-3 text-slate-600 text-[11px] cursor-not-allowed">
                <span>Sans 2e conducteur</span>
              </div>
            )}

            <button
              type="button"
              onClick={() => handleSignerChange('agency')}
              className={`flex items-center justify-center gap-1.5 py-1.5 sm:py-2 px-2.5 sm:px-3 rounded-lg font-semibold transition-all cursor-pointer ${
                activeSigner === 'agency'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Agence Morvello</span>
              {contract.agencySignature && <CheckCircle2 className="w-3 h-3 text-emerald-950" />}
            </button>
          </div>

          {/* Quick Recap Pill */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 p-3 bg-slate-950/70 border border-slate-800 rounded-xl text-xs">
            <div>
              <span className="text-[10px] text-slate-500 block uppercase font-bold">Signataire Actif</span>
              <span className="font-semibold text-slate-200 truncate block mt-0.5">
                {signerFullName}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block uppercase font-bold">Véhicule & Immat</span>
              <span className="font-semibold text-amber-300 font-mono block mt-0.5 truncate">
                {contract.vehicleSnapshot.brand} • {contract.vehicleSnapshot.plate}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block uppercase font-bold">Période du Contrat</span>
              <span className="font-semibold text-slate-300 block mt-0.5">
                {contract.startDate} → {contract.endDate} ({contract.totalDays}j)
              </span>
            </div>
          </div>

          {/* Existing Signature notice if already signed */}
          {activeSigner === 'client' && contract.clientSignature && (
            <div className="flex items-center justify-between p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <span className="font-bold">Contrat déjà signé numériquement par le locataire</span>
                  <span className="text-[11px] text-emerald-400/80 block">
                    Le {new Date(contract.clientSignedAt || '').toLocaleDateString('fr-FR')} à{' '}
                    {new Date(contract.clientSignedAt || '').toLocaleTimeString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
              <span className="text-[10px] bg-emerald-500/20 px-2 py-1 rounded text-emerald-300 font-mono">
                Vous pouvez re-signer ci-dessous pour écraser
              </span>
            </div>
          )}

          {/* Interactive Pad */}
          <DigitalSignaturePad
            signerName={signerFullName}
            signerRole={
              activeSigner === 'client'
                ? 'Locataire Principal'
                : activeSigner === 'second_driver'
                ? 'Conducteur Agréé'
                : 'Agent / Gérant Morvello'
            }
            contractNumber={contract.contractNumber}
            onSave={handleSaveSignature}
          />

          {/* Success Overlay if saving */}
          {isSuccess && (
            <div className="p-3 bg-emerald-600 text-white rounded-xl text-center text-xs font-bold flex items-center justify-center gap-2 animate-in zoom-in-95">
              <CheckCircle2 className="w-4 h-4" />
              <span>Signature numérique certifiée et insérée dans le contrat A4 !</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
