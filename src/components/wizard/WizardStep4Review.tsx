import React from 'react';
import {
  Client,
  Driver,
  Vehicle,
  User,
  CompanySettings,
  ContractTemplateId,
  TermsVersion,
} from '../../types';
import { CONTRACT_TEMPLATES } from '../../data/contractTemplates';
import { NewClientFormData, NewSecondDriverFormData } from './WizardStep1Client';
import {
  CheckCircle2,
  Phone,
  Layers,
  Shield,
  Crown,
  Briefcase,
  FileText,
} from 'lucide-react';

interface WizardStep4ReviewProps {
  termsVersion: TermsVersion;
  clientMode: 'existing' | 'new';
  currentClient?: Client;
  newClientForm: NewClientFormData;
  hasSecondDriver: boolean;
  secondDriverSource: 'driver' | 'client' | 'new';
  selectedSecondDriverId: string;
  drivers: Driver[];
  clients: Client[];
  newSecondDriverForm: NewSecondDriverFormData;
  currentVehicle?: Vehicle;
  departureKm: number;
  departureFuel: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  totalDays: number;
  totalAmount: number;
  depositAmount: number;
  assignedManagerId: string;
  managerPhone: string;
  users: User[];
  companySettings: CompanySettings;
  selectedTemplateId: ContractTemplateId;
  setSelectedTemplateId: (id: ContractTemplateId) => void;
  currentUser?: User;
}

export const WizardStep4Review: React.FC<WizardStep4ReviewProps> = ({
  termsVersion,
  clientMode,
  currentClient,
  newClientForm,
  hasSecondDriver,
  secondDriverSource,
  selectedSecondDriverId,
  drivers,
  clients,
  newSecondDriverForm,
  currentVehicle,
  departureKm,
  departureFuel,
  startDate,
  startTime,
  endDate,
  endTime,
  totalDays,
  totalAmount,
  depositAmount,
  assignedManagerId,
  managerPhone,
  users,
  companySettings,
  selectedTemplateId,
  setSelectedTemplateId,
  currentUser,
}) => {
  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            Étape 4 : Récapitulatif & Validation Avant Génération A4
          </h2>
          <p className="text-xs text-slate-400">
            Vérifiez attentivement les données du contrat avant de générer le document officiel 2 pages.
          </p>
        </div>
        <span className="text-xs font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40 px-2.5 py-1 rounded">
          Conditions V{termsVersion.version}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
        {/* LOCATAIRE & CONDUCTEURS SUMMARY */}
        <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2">
          <h3 className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">
            1. Locataire & Conducteurs
          </h3>
          <div className="space-y-1 text-slate-300">
            <p>
              Locataire Principal :{' '}
              <strong className="text-white uppercase">
                {clientMode === 'existing'
                  ? `${currentClient?.lastName} ${currentClient?.firstName}`
                  : `${newClientForm.lastName} ${newClientForm.firstName}`}
              </strong>
            </p>
            <p>
              Document :{' '}
              <span className="font-mono text-white">
                {clientMode === 'existing' ? currentClient?.docNumber : newClientForm.docNumber} (
                {clientMode === 'existing' ? currentClient?.docType : newClientForm.docType})
              </span>
            </p>
            <p>
              Permis :{' '}
              <span className="font-mono text-white">
                {clientMode === 'existing' ? currentClient?.drivingLicense : newClientForm.drivingLicense}
              </span>
            </p>
            <p>
              Téléphone :{' '}
              <span className="text-amber-400">
                {(clientMode === 'existing' ? currentClient?.phone : newClientForm.phone) || (
                  <span className="text-slate-500 italic">Non renseigné</span>
                )}
              </span>
            </p>

            <div className="pt-2 mt-2 border-t border-slate-800/80 flex flex-wrap gap-2 text-[11px]">
              <span className="text-slate-400">Documents :</span>
              {(clientMode === 'existing' ? currentClient?.licenseDocUrl : newClientForm.licenseDocUrl) ? (
                <span className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded text-[10px] font-mono">
                  ✓ Permis joint
                </span>
              ) : (
                <span className="bg-slate-800 text-slate-500 px-2 py-0.5 rounded text-[10px] font-mono">
                  Permis non joint
                </span>
              )}
              {(clientMode === 'existing' ? currentClient?.cinDocUrl : newClientForm.cinDocUrl) ? (
                <span className="bg-blue-500/15 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded text-[10px] font-mono">
                  ✓ CIN/Passeport joint
                </span>
              ) : (
                <span className="bg-slate-800 text-slate-500 px-2 py-0.5 rounded text-[10px] font-mono">
                  CIN non jointe
                </span>
              )}
            </div>

            {hasSecondDriver ? (
              <div className="pt-2 mt-2 border-t border-slate-800 text-[11px]">
                <span className="text-amber-400 font-bold block mb-0.5">
                  + 2ème Conducteur Agréé :
                </span>
                {secondDriverSource === 'driver' && (
                  <p className="text-slate-200">
                    {drivers.find((d) => d.id === selectedSecondDriverId)?.lastName}{' '}
                    {drivers.find((d) => d.id === selectedSecondDriverId)?.firstName} (
                    {drivers.find((d) => d.id === selectedSecondDriverId)?.docNumber} - Permis :{' '}
                    {drivers.find((d) => d.id === selectedSecondDriverId)?.drivingLicense})
                  </p>
                )}
                {secondDriverSource === 'client' && (
                  <p className="text-slate-200">
                    {clients.find((c) => c.id === selectedSecondDriverId)?.lastName}{' '}
                    {clients.find((c) => c.id === selectedSecondDriverId)?.firstName} (
                    {clients.find((c) => c.id === selectedSecondDriverId)?.docNumber})
                  </p>
                )}
                {secondDriverSource === 'new' && (
                  <p className="text-slate-200">
                    {newSecondDriverForm.lastName} {newSecondDriverForm.firstName} (
                    {newSecondDriverForm.docNumber} - Permis : {newSecondDriverForm.drivingLicense})
                  </p>
                )}
              </div>
            ) : (
              <p className="text-[10.5px] text-slate-500 italic pt-1">
                2ème Conducteur : Aucun (Conducteur unique)
              </p>
            )}
          </div>
        </div>

        {/* VÉHICULE SUMMARY */}
        <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2">
          <h3 className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">
            2. Véhicule Attribué
          </h3>
          <div className="space-y-1 text-slate-300">
            <p>
              Marque & Modèle :{' '}
              <strong className="text-white uppercase">
                {currentVehicle?.brand} {currentVehicle?.model}
              </strong>
            </p>
            <p>
              Immatriculation :{' '}
              <span className="font-mono font-bold text-amber-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700">
                {currentVehicle?.plate}
              </span>
            </p>
            <p>
              Motorisation : <span className="text-white">{currentVehicle?.fuelType}</span>
            </p>
            <p>
              KM Départ : <strong className="font-mono text-white">{departureKm.toLocaleString()} KM</strong>
            </p>
            <p>
              Carburant Départ : <strong className="font-mono text-amber-400">{departureFuel}</strong>
            </p>
          </div>
        </div>

        {/* LOCATION DURATION SUMMARY */}
        <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2">
          <h3 className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">
            3. Période & Tarification
          </h3>
          <div className="space-y-1 text-slate-300">
            <p>
              Départ :{' '}
              <strong className="text-white">
                {new Date(startDate).toLocaleDateString('fr-FR')} à {startTime}
              </strong>
            </p>
            <p>
              Retour :{' '}
              <strong className="text-white">
                {new Date(endDate).toLocaleDateString('fr-FR')} à {endTime}
              </strong>
            </p>
            <p>
              Durée : <strong className="text-amber-400 font-mono">{totalDays} jour(s)</strong>
            </p>
            <p>
              Total : <strong className="text-amber-400 font-mono">{totalAmount.toLocaleString()} MAD</strong> • Caution :{' '}
              <strong className="font-mono text-white">{depositAmount.toLocaleString()} MAD</strong>
            </p>
          </div>
        </div>

        {/* MANAGER & CONTACT SUMMARY */}
        <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-2">
          <h3 className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center justify-between">
            <span>4. Manager & Tél. PDF</span>
            <Phone className="w-3.5 h-3.5 text-amber-400" />
          </h3>
          <div className="space-y-1 text-slate-300">
            <p>
              Responsable :{' '}
              <strong className="text-white">
                {users.find((u) => u.id === assignedManagerId)?.name || 'Direction Agence'}
              </strong>
            </p>
            <div>
              <span className="text-slate-400 block text-[11px]">GSM Contrat Imprimé :</span>
              <span className="font-mono text-amber-400 font-bold block mt-0.5 text-xs bg-slate-900 px-2 py-1 rounded border border-slate-800">
                {managerPhone || users.find((u) => u.id === assignedManagerId)?.phone || companySettings.phone1}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 italic pt-1">
              Numéro direct d'assistance affiché sur l'en-tête de la page 1.
            </p>
          </div>
        </div>
      </div>

      {/* SÉLECTEUR DU MODÈLE DE CONTRAT POUR L'IMPRESSION A4 */}
      <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-400" />
            <span className="text-white font-bold text-xs uppercase tracking-wide">
              Modèle de Contrat Appliqué pour l'Impression A4
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">
            {currentUser?.assignedContractTemplate === selectedTemplateId
              ? 'Attribué à votre compte'
              : 'Sélection personnalisée'}
          </span>
        </div>

        <p className="text-xs text-slate-400">
          Sélectionnez la maquette contractuelle haute définition à utiliser pour la génération du document A4 (Recto / Verso) :
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          {CONTRACT_TEMPLATES.map((tmpl) => {
            const isSelected = selectedTemplateId === tmpl.id;
            return (
              <button
                key={tmpl.id}
                type="button"
                onClick={() => setSelectedTemplateId(tmpl.id)}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? tmpl.id === 'prestige'
                      ? 'bg-amber-500/15 border-amber-400 ring-1 ring-amber-400 text-white'
                      : tmpl.id === 'corporate'
                      ? 'bg-blue-500/15 border-blue-400 ring-1 ring-blue-400 text-white'
                      : 'bg-emerald-500/15 border-emerald-400 ring-1 ring-emerald-400 text-white'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-1.5">
                      {tmpl.id === 'prestige' ? (
                        <Crown className="w-4 h-4 text-amber-400" />
                      ) : tmpl.id === 'corporate' ? (
                        <Briefcase className="w-4 h-4 text-blue-400" />
                      ) : (
                        <FileText className="w-4 h-4 text-emerald-400" />
                      )}
                      <span className="font-bold text-xs text-white">
                        {tmpl.id === 'standard'
                          ? 'Standard Morvello'
                          : tmpl.id === 'prestige'
                          ? 'Prestige VIP'
                          : 'Corporate B2B'}
                      </span>
                    </div>
                    {isSelected && (
                      <CheckCircle2
                        className={`w-4 h-4 ${
                          tmpl.id === 'prestige'
                            ? 'text-amber-400'
                            : tmpl.id === 'corporate'
                            ? 'text-blue-400'
                            : 'text-emerald-400'
                        }`}
                      />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-300 line-clamp-2 leading-relaxed">
                    {tmpl.subtitle}
                  </p>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
                  <span className={`px-1.5 py-0.2 rounded border font-semibold ${tmpl.badgeColor}`}>
                    {tmpl.badge}
                  </span>
                  {tmpl.id === currentUser?.assignedContractTemplate && (
                    <span className="text-amber-400 font-mono text-[9px]">Votre modèle</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-xl text-xs text-amber-300 flex items-start gap-2">
        <Shield className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
        <p>
          En validant ce contrat, les données seront archivées, le numéro de contrat sera attribué et le document A4 officiel (2 pages Recto/Verso) sera prêt pour impression immédiate avec le cachet officiel Morvello Cars.
        </p>
      </div>
    </div>
  );
};
