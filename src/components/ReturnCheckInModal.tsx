import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Contract, InspectionPhoto } from '../types';
import {
  X,
  CheckCircle2,
  Gauge,
  Fuel,
  Calendar,
  Clock,
  AlertTriangle,
  UploadCloud,
  Camera,
  Trash2,
  ShieldCheck,
  FileCheck,
  Sparkles,
  ArrowRight,
  Info,
} from 'lucide-react';
import { formatPlateFrench } from '../utils/plateUtils';

interface ReturnCheckInModalProps {
  contract: Contract | null;
  onClose: () => void;
  onOpenDetailedInspection?: (contract: Contract) => void;
}

const VEHICLE_ZONES = [
  { id: 'front', label: 'Face Avant (Pare-choc / Calandre / Capot)' },
  { id: 'rear', label: 'Face Arrière (Coffre / Pare-choc)' },
  { id: 'left_side', label: 'Côté Gauche (Portières / Ailes)' },
  { id: 'right_side', label: 'Côté Droit (Portières / Ailes)' },
  { id: 'windshield', label: 'Pare-brise & Vitres' },
  { id: 'wheels', label: 'Jantes & Pneumatiques' },
  { id: 'roof', label: 'Pavillon / Toit ouvrant' },
  { id: 'interior', label: 'Habitacle / Sellerie & Tableau de bord' },
];

const DEFECT_TYPES = [
  { id: 'scratch', label: 'Rayure superficielle / Frottement' },
  { id: 'dent', label: 'Bosse / Enfoncement carrosserie' },
  { id: 'crack', label: 'Fissure / Éclat vitrage' },
  { id: 'stain', label: 'Tache / Salissure sellerie' },
  { id: 'other', label: 'Autre anomalie constatée' },
];

export const ReturnCheckInModal: React.FC<ReturnCheckInModalProps> = ({
  contract,
  onClose,
  onOpenDetailedInspection,
}) => {
  const { completeContract, updateContractInspection, deductDeposit, releaseDeposit, deposits, currentUser } = useApp();

  if (!contract) return null;

  const today = '2026-09-01';
  const nowTime = '18:30';

  // Étape 1 : Relevé compteur & Carburant
  const [returnKm, setReturnKm] = useState<number>(
    contract.returnKm || (contract.departureKm ? contract.departureKm + 350 : 15000)
  );
  const [returnDate, setReturnDate] = useState<string>(contract.returnDate || today);
  const [returnTime, setReturnTime] = useState<string>(contract.returnTime || nowTime);
  const [fuelLevel, setFuelLevel] = useState<string>(contract.returnFuel || '8/8 (Plein)');

  // Étape 2 : Checklist de restitution
  const [checklist, setChecklist] = useState({
    cleanInterior: true,
    cleanExterior: true,
    spareWheel: true,
    jack: true,
    triangle: true,
    vest: true,
    documentsPresent: true,
    bodyCondition: 'conforme' as 'conforme' | 'nouveaux_degats',
  });

  // Étape 3 : Dommages & Photos de retour
  const [returnPhotos, setReturnPhotos] = useState<InspectionPhoto[]>(
    contract.inspection?.photos?.filter((p) => p.stage === 'return' || p.phase === 'return') || []
  );
  const [isAddingDamage, setIsAddingDamage] = useState<boolean>(false);
  const [damageZone, setDamageZone] = useState<string>('front');
  const [damageType, setDamageType] = useState<string>('scratch');
  const [damageSeverity, setDamageSeverity] = useState<'minor' | 'medium' | 'major'>('minor');
  const [damageNotes, setDamageNotes] = useState<string>('');
  const [damagePhotoUrl, setDamagePhotoUrl] = useState<string>('');

  // Étape 4 : Caution & Déduction automatique
  const [cautionAction, setCautionAction] = useState<'release_full' | 'deduct_fuel' | 'deduct_damage' | 'keep_held'>('release_full');
  const [deductionAmount, setDeductionAmount] = useState<number>(0);
  const [deductionReason, setDeductionReason] = useState<string>('Carburant manquant ou remise en état');

  // Remarques globales
  const [returnNotes, setReturnNotes] = useState<string>(
    'Véhicule inspecté à la restitution. Kilométrage et équipements contrôlés.'
  );

  const kmDriven = returnKm - contract.departureKm;

  // Caution associée
  const associatedDeposit = deposits.find(
    (d) => d.contractId === contract.id || d.contractNumber === contract.contractNumber
  );

  // Gestion de photo dommage
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setDamagePhotoUrl(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleAddDamagePhoto = () => {
    if (!damagePhotoUrl) {
      alert('Veuillez sélectionner ou capturer une photo du dommage.');
      return;
    }

    const zoneObj = VEHICLE_ZONES.find((z) => z.id === damageZone);
    const typeObj = DEFECT_TYPES.find((d) => d.id === damageType);

    const newPhoto: InspectionPhoto = {
      id: `ret-dmg-${Date.now()}`,
      url: damagePhotoUrl,
      stage: 'return',
      phase: 'return',
      zone: damageZone,
      zoneLabel: zoneObj?.label || damageZone,
      type: typeObj?.label || damageType,
      description: damageNotes || `${typeObj?.label} sur ${zoneObj?.label}`,
      notes: damageNotes,
      severity: damageSeverity,
      timestamp: `${returnDate} ${returnTime}`,
      takenBy: currentUser?.name || 'Agent Morvello',
    };

    setReturnPhotos([newPhoto, ...returnPhotos]);
    setChecklist((prev) => ({ ...prev, bodyCondition: 'nouveaux_degats' }));
    setDamagePhotoUrl('');
    setDamageNotes('');
    setIsAddingDamage(false);
  };

  const handleDeletePhoto = (photoId: string) => {
    setReturnPhotos(returnPhotos.filter((p) => p.id !== photoId));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (returnKm < contract.departureKm) {
      alert('Le kilométrage de retour ne peut pas être inférieur au kilométrage de départ !');
      return;
    }

    // 1. Sauvegarder l'état des lieux complet dans le contrat
    const existingDeparturePhotos = contract.inspection?.photos?.filter(
      (p) => p.stage === 'departure' || p.phase === 'departure'
    ) || [];

    const updatedInspection = {
      ...contract.inspection,
      departureChecklist: contract.inspection?.departureChecklist || {},
      returnDate,
      returnKm,
      returnFuel: fuelLevel,
      returnInspector: currentUser?.name || 'Direction Morvello',
      returnNotes: `${returnNotes} [État carrosserie: ${checklist.bodyCondition === 'conforme' ? 'Conforme' : 'Dommages signalés'}]`,
      returnChecklist: {
        ...checklist,
        fuelLevel,
      },
      photos: [...returnPhotos, ...existingDeparturePhotos],
    };

    updateContractInspection(contract.id, updatedInspection);

    // 2. Traiter la caution si demandée
    if (associatedDeposit && associatedDeposit.status === 'held') {
      if (cautionAction === 'release_full') {
        releaseDeposit(associatedDeposit.id, associatedDeposit.amount, 'Caution libérée intégralement à la restitution');
      } else if (cautionAction === 'deduct_fuel' || cautionAction === 'deduct_damage') {
        const reasonType = cautionAction === 'deduct_fuel' ? 'fuel' : 'damage';
        deductDeposit(
          associatedDeposit.id,
          {
            reason: reasonType,
            label: deductionReason || (reasonType === 'fuel' ? 'Carburant manquant' : 'Dommages carrosserie'),
            amount: deductionAmount > 0 ? deductionAmount : 200,
            notes: `Retenue lors de la restitution le ${returnDate}`,
          },
          true // Rembourse le reliquat
        );
      }
    }

    // 3. Clôturer le contrat et libérer le véhicule
    const closingSummary = `${returnNotes} | KM Restitution: ${returnKm} (${kmDriven >= 0 ? `+${kmDriven} km` : ''}) | Carburant: ${fuelLevel}`;
    completeContract(contract.id, returnKm, returnDate, returnTime, closingSummary);

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-150 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl space-y-5 my-6 max-h-[92vh] overflow-y-auto">
        {/* HEADER */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 sticky top-0 bg-slate-900 z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Restitution & Check-in Véhicule
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-semibold uppercase">
                  Protocole Entrant
                </span>
              </h2>
              <p className="text-xs text-amber-400 font-mono font-semibold">
                Contrat N° {contract.contractNumber} • {contract.clientSnapshot.lastName} {contract.clientSnapshot.firstName}
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

        {/* INFO SUMMARY */}
        <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 text-xs grid grid-cols-2 sm:grid-cols-4 gap-3 text-slate-300">
          <div>
            <span className="text-slate-500 block">Véhicule :</span>
            <strong className="text-amber-400">
              {contract.vehicleSnapshot.brand} {contract.vehicleSnapshot.model}
            </strong>
          </div>
          <div>
            <span className="text-slate-500 block">Immatriculation :</span>
            <span className="font-mono text-white font-bold">{formatPlateFrench(contract.vehicleSnapshot.plate)}</span>
          </div>
          <div>
            <span className="text-slate-500 block">KM Départ :</span>
            <span className="font-mono text-white">{contract.departureKm.toLocaleString()} KM</span>
          </div>
          <div>
            <span className="text-slate-500 block">Carburant Départ :</span>
            <span className="font-mono text-emerald-400 font-bold">{contract.departureFuel || '8/8 (Plein)'}</span>
          </div>
        </div>

        {/* FORM */}
        <form onSubmit={handleSubmit} className="space-y-5 text-xs">
          {/* SECTION 1 : COMPTEUR KM & CARBURANT */}
          <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Gauge className="w-4 h-4 text-amber-400" />
              1. Relevé Compteur & Carburant
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Kilométrage au Retour (Compteur) *
                </label>
                <div className="relative">
                  <Gauge className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="number"
                    value={returnKm}
                    onChange={(e) => setReturnKm(Number(e.target.value))}
                    min={contract.departureKm}
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-white font-mono font-bold text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div className="flex justify-between items-center text-[11px] mt-1 text-slate-400">
                  <span>Distance parcourue :</span>
                  <span className="font-bold text-emerald-400 font-mono">
                    {kmDriven >= 0 ? `+${kmDriven.toLocaleString()} KM` : 'Invalide'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Niveau de Carburant au Retour *
                </label>
                <div className="relative">
                  <Fuel className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <select
                    value={fuelLevel}
                    onChange={(e) => setFuelLevel(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-white focus:border-amber-500 focus:outline-none cursor-pointer"
                  >
                    <option value="8/8 (Plein)">8/8 — Plein complet (Conforme départ)</option>
                    <option value="7/8">7/8 — Presque plein (-1/8)</option>
                    <option value="6/8 (3/4)">6/8 (3/4) — Manquant</option>
                    <option value="4/8 (1/2)">4/8 (1/2) — Moitié réservoir</option>
                    <option value="2/8 (1/4)">2/8 (1/4) — Quart de réservoir</option>
                    <option value="Réserve (Manquant)">Réserve — Carburant à facturer</option>
                  </select>
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Départ enregistré : <strong className="text-amber-400">{contract.departureFuel || '8/8 (Plein)'}</strong>
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Date réelle de retour</label>
                <input
                  type="date"
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:border-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-medium mb-1">Heure de retour</label>
                <input
                  type="time"
                  value={returnTime}
                  onChange={(e) => setReturnTime(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:border-amber-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* SECTION 2 : CHECKLIST D'ÉQUIPEMENTS & PROPRETÉ */}
          <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              2. Contrôle Équipements & État Général
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <label className="flex items-center gap-2 p-2 bg-slate-900/80 border border-slate-800 rounded-lg cursor-pointer hover:border-slate-700">
                <input
                  type="checkbox"
                  checked={checklist.spareWheel}
                  onChange={(e) => setChecklist({ ...checklist, spareWheel: e.target.checked })}
                  className="rounded text-amber-500 focus:ring-0 w-4 h-4"
                />
                <span className="text-[11px] text-slate-300">Roue de secours</span>
              </label>
              <label className="flex items-center gap-2 p-2 bg-slate-900/80 border border-slate-800 rounded-lg cursor-pointer hover:border-slate-700">
                <input
                  type="checkbox"
                  checked={checklist.jack}
                  onChange={(e) => setChecklist({ ...checklist, jack: e.target.checked })}
                  className="rounded text-amber-500 focus:ring-0 w-4 h-4"
                />
                <span className="text-[11px] text-slate-300">Cric & Manivelle</span>
              </label>
              <label className="flex items-center gap-2 p-2 bg-slate-900/80 border border-slate-800 rounded-lg cursor-pointer hover:border-slate-700">
                <input
                  type="checkbox"
                  checked={checklist.triangle}
                  onChange={(e) => setChecklist({ ...checklist, triangle: e.target.checked })}
                  className="rounded text-amber-500 focus:ring-0 w-4 h-4"
                />
                <span className="text-[11px] text-slate-300">Triangle & Gilet</span>
              </label>
              <label className="flex items-center gap-2 p-2 bg-slate-900/80 border border-slate-800 rounded-lg cursor-pointer hover:border-slate-700">
                <input
                  type="checkbox"
                  checked={checklist.documentsPresent}
                  onChange={(e) => setChecklist({ ...checklist, documentsPresent: e.target.checked })}
                  className="rounded text-amber-500 focus:ring-0 w-4 h-4"
                />
                <span className="text-[11px] text-slate-300">Papiers du véhicule</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <label className="flex items-center gap-2 p-2 bg-slate-900/80 border border-slate-800 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={checklist.cleanInterior}
                  onChange={(e) => setChecklist({ ...checklist, cleanInterior: e.target.checked })}
                  className="rounded text-amber-500 focus:ring-0 w-4 h-4"
                />
                <span className="text-[11px] text-slate-300">Propreté intérieure conforme (Pas de pressing requis)</span>
              </label>
              <label className="flex items-center gap-2 p-2 bg-slate-900/80 border border-slate-800 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={checklist.cleanExterior}
                  onChange={(e) => setChecklist({ ...checklist, cleanExterior: e.target.checked })}
                  className="rounded text-amber-500 focus:ring-0 w-4 h-4"
                />
                <span className="text-[11px] text-slate-300">Propreté extérieure acceptable</span>
              </label>
            </div>
          </div>

          {/* SECTION 3 : CONTRÔLE CARROSSERIE & SIGNALEMENT DE DOMMAGES */}
          <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-purple-400" />
                3. Constat Carrosserie & Signalement de Nouveaux Dommages
              </h3>
              {onOpenDetailedInspection && (
                <button
                  type="button"
                  onClick={() => onOpenDetailedInspection(contract)}
                  className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  Ouvrir Schéma Interactif 2D <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* État général carrosserie */}
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="bodyCondition"
                  value="conforme"
                  checked={checklist.bodyCondition === 'conforme'}
                  onChange={() => setChecklist({ ...checklist, bodyCondition: 'conforme' })}
                  className="text-emerald-500"
                />
                <span className="text-xs text-emerald-400 font-semibold">Aucun nouveau dommage (Conforme)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="bodyCondition"
                  value="nouveaux_degats"
                  checked={checklist.bodyCondition === 'nouveaux_degats'}
                  onChange={() => {
                    setChecklist({ ...checklist, bodyCondition: 'nouveaux_degats' });
                    setIsAddingDamage(true);
                  }}
                  className="text-rose-400"
                />
                <span className="text-xs text-rose-400 font-semibold">Nouveaux dommages constatés !</span>
              </label>
            </div>

            {/* Formulaire d'ajout de photo de dommage */}
            {isAddingDamage ? (
              <div className="bg-slate-900 border border-rose-500/40 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    Enregistrer un nouveau dommage au retour
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsAddingDamage(false)}
                    className="text-slate-400 hover:text-white text-xs"
                  >
                    Fermer
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] text-slate-300 mb-1">Zone touchée</label>
                    <select
                      value={damageZone}
                      onChange={(e) => setDamageZone(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-1.5 text-xs text-white"
                    >
                      {VEHICLE_ZONES.map((z) => (
                        <option key={z.id} value={z.id}>{z.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-300 mb-1">Nature du dommage</label>
                    <select
                      value={damageType}
                      onChange={(e) => setDamageType(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-1.5 text-xs text-white"
                    >
                      {DEFECT_TYPES.map((d) => (
                        <option key={d.id} value={d.id}>{d.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-300 mb-1">Gravité constatée</label>
                    <select
                      value={damageSeverity}
                      onChange={(e) => setDamageSeverity(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-1.5 text-xs text-white"
                    >
                      <option value="minor">Mineure (Rayure superficielle)</option>
                      <option value="medium">Moyenne (Frottement appuyé / Enfoncement)</option>
                      <option value="major">Majeure (Choc / Remplacement requis)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-300 mb-1">Détails précis / Localisation</label>
                  <input
                    type="text"
                    value={damageNotes}
                    onChange={(e) => setDamageNotes(e.target.value)}
                    placeholder="Ex: Éraflure 12 cm sur bas de portière arrière gauche..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                  />
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <label className="flex-1 w-full flex items-center justify-center gap-2 border-2 border-dashed border-slate-700 hover:border-amber-500 rounded-xl p-3 cursor-pointer bg-slate-950/60 transition-colors">
                    <UploadCloud className="w-4 h-4 text-amber-400" />
                    <span className="text-xs text-slate-300">
                      {damagePhotoUrl ? 'Changer la photo' : 'Importer la photo du dommage'}
                    </span>
                    <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                  </label>

                  {damagePhotoUrl && (
                    <div className="w-16 h-12 rounded-lg border border-slate-700 overflow-hidden shrink-0">
                      <img src={damagePhotoUrl} alt="Aperçu dommage" className="w-full h-full object-cover" />
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleAddDamagePhoto}
                    disabled={!damagePhotoUrl}
                    className="w-full sm:w-auto px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    Ajouter au constat
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsAddingDamage(true)}
                className="w-full py-2 px-3 border border-dashed border-slate-700 hover:border-slate-600 rounded-xl text-slate-400 hover:text-slate-200 text-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5 text-amber-400" />
                <span>+ Ajouter une photo de dommage de retour</span>
              </button>
            )}

            {/* Liste des photos de dommages ajoutées */}
            {returnPhotos.length > 0 && (
              <div className="space-y-2 pt-2">
                <span className="text-[11px] font-bold text-slate-300 block">
                  {returnPhotos.length} photo(s) de dommage rattachée(s) au retour :
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {returnPhotos.map((photo) => (
                    <div
                      key={photo.id}
                      className="bg-slate-950 border border-slate-800 rounded-xl p-2 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <img
                          src={photo.url}
                          alt="Dommage"
                          className="w-10 h-10 rounded-lg object-cover border border-slate-700 shrink-0"
                        />
                        <div className="overflow-hidden">
                          <p className="text-[11px] font-bold text-white truncate">{photo.zoneLabel || photo.zone}</p>
                          <p className="text-[10px] text-rose-400 truncate">{photo.description || photo.type}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeletePhoto(photo.id)}
                        className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                        title="Supprimer la photo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* SECTION 4 : GESTION DE LA CAUTION & RETENUES */}
          {associatedDeposit && (
            <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <FileCheck className="w-4 h-4 text-amber-400" />
                  4. Gestion de la Caution Associée
                </span>
                <span className="font-mono text-amber-400 font-bold">
                  {associatedDeposit.amount.toLocaleString()} MAD ({associatedDeposit.methodDetails || associatedDeposit.method})
                </span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <label className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                  cautionAction === 'release_full'
                    ? 'bg-emerald-500/10 border-emerald-500 text-emerald-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}>
                  <input
                    type="radio"
                    name="cautionAction"
                    value="release_full"
                    checked={cautionAction === 'release_full'}
                    onChange={() => setCautionAction('release_full')}
                    className="sr-only"
                  />
                  <div className="font-bold text-white">Libérer 100%</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Véhicule conforme, restitution complète</div>
                </label>

                <label className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                  cautionAction === 'deduct_fuel'
                    ? 'bg-amber-500/10 border-amber-500 text-amber-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}>
                  <input
                    type="radio"
                    name="cautionAction"
                    value="deduct_fuel"
                    checked={cautionAction === 'deduct_fuel'}
                    onChange={() => {
                      setCautionAction('deduct_fuel');
                      setDeductionAmount(150);
                      setDeductionReason('Carburant manquant à la restitution');
                    }}
                    className="sr-only"
                  />
                  <div className="font-bold text-white">Retenue Carburant</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Déduire frais carburant et rendre le solde</div>
                </label>

                <label className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                  cautionAction === 'deduct_damage'
                    ? 'bg-rose-500/10 border-rose-500 text-rose-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}>
                  <input
                    type="radio"
                    name="cautionAction"
                    value="deduct_damage"
                    checked={cautionAction === 'deduct_damage'}
                    onChange={() => {
                      setCautionAction('deduct_damage');
                      setDeductionAmount(500);
                      setDeductionReason('Frais réparation dommage constaté');
                    }}
                    className="sr-only"
                  />
                  <div className="font-bold text-white">Retenue Dommage</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Retenue pour dégradation constatée</div>
                </label>
              </div>

              {(cautionAction === 'deduct_fuel' || cautionAction === 'deduct_damage') && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-[11px] text-slate-300 mb-1">Montant à retenir (MAD) *</label>
                    <input
                      type="number"
                      value={deductionAmount}
                      onChange={(e) => setDeductionAmount(Number(e.target.value))}
                      max={associatedDeposit.amount}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-300 mb-1">Motif de la retenue</label>
                    <input
                      type="text"
                      value={deductionReason}
                      onChange={(e) => setDeductionReason(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* REMARQUES */}
          <div>
            <label className="block text-slate-300 font-medium mb-1">Remarques & Observations Finales</label>
            <textarea
              rows={2}
              value={returnNotes}
              onChange={(e) => setReturnNotes(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:border-amber-500 focus:outline-none"
            ></textarea>
          </div>

          {/* AUTOMATIC VEHICLE RELEASE NOTE */}
          <div className="bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-xl text-xs text-emerald-300 flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <span>
              La validation mettra immédiatement à jour le kilométrage du véhicule à <strong className="font-mono">{returnKm.toLocaleString()} KM</strong>, basculera son statut à <strong className="text-white">Disponible</strong> dans le parc Morvello et archivera le contrat en <strong className="text-white">Terminé</strong>.
            </span>
          </div>

          {/* ACTIONS */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 text-xs font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95 cursor-pointer flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Valider la Restitution & Clôturer</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
