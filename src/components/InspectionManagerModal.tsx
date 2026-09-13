import React, { useState } from 'react';
import { Contract, ContractInspection, InspectionPhoto } from '../types';
import { useApp } from '../context/AppContext';
import {
  Camera,
  Plus,
  Trash2,
  X,
  CheckCircle2,
  AlertTriangle,
  ZoomIn,
  Car,
  Fuel,
  Gauge,
  Calendar,
  Save,
  ShieldAlert,
  UploadCloud,
  Layers,
  Sparkles,
} from 'lucide-react';
import { formatPlateFrench } from '../utils/plateUtils';

interface InspectionManagerModalProps {
  contract: Contract | null;
  isOpen: boolean;
  onClose: () => void;
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
  { id: 'dent', label: 'Bosse / Enfoncement tôle' },
  { id: 'crack', label: 'Fissure / Impact vitrage' },
  { id: 'stain', label: 'Tache / Usure garniture' },
  { id: 'other', label: 'Autre anomalie' },
];

export const getZoneLabel = (zoneId: string): string => {
  return VEHICLE_ZONES.find((z) => z.id === zoneId)?.label || zoneId;
};

export const getTypeLabel = (typeId: string): string => {
  return DEFECT_TYPES.find((d) => d.id === typeId)?.label || typeId;
};

interface DiagramData {
  brand: string;
  model: string;
  plate: string;
  contractId: string;
  clientName: string;
  phase: 'departure' | 'return';
  zoneId: string;
  typeId: string;
  notes: string;
  inspectorName: string;
  dateStr: string;
}

export const generateInspectionDiagramSVG = (data: DiagramData): string => {
  const {
    brand,
    model,
    plate,
    contractId,
    clientName,
    phase,
    zoneId,
    typeId,
    notes,
    inspectorName,
    dateStr,
  } = data;

  const zoneLabel = getZoneLabel(zoneId);
  const typeLabel = getTypeLabel(typeId);

  // Target coordinates on car top silhouette (viewBox: 0 0 800 520)
  let tx = 205;
  let ty = 305;
  let zoneNameShort = 'Face Avant';

  switch (zoneId) {
    case 'front':
      tx = 205;
      ty = 305;
      zoneNameShort = 'Face Avant';
      break;
    case 'rear':
      tx = 595;
      ty = 305;
      zoneNameShort = 'Face Arrière';
      break;
    case 'left_side':
      tx = 400;
      ty = 235;
      zoneNameShort = 'Côté Gauche';
      break;
    case 'right_side':
      tx = 400;
      ty = 375;
      zoneNameShort = 'Côté Droit';
      break;
    case 'windshield':
      tx = 310;
      ty = 305;
      zoneNameShort = 'Pare-brise';
      break;
    case 'roof':
      tx = 410;
      ty = 305;
      zoneNameShort = 'Pavillon';
      break;
    case 'wheels':
      tx = 255;
      ty = 222;
      zoneNameShort = 'Jantes / Roues';
      break;
    case 'interior':
      tx = 410;
      ty = 305;
      zoneNameShort = 'Habitacle';
      break;
    default:
      tx = 205;
      ty = 305;
      zoneNameShort = 'Face Avant';
  }

  // Defect glyph SVG
  let defectGlyph = '';
  if (typeId === 'scratch') {
    defectGlyph = `
      <line x1="${tx - 15}" y1="${ty - 10}" x2="${tx + 15}" y2="${ty + 10}" stroke="#ef4444" stroke-width="4" stroke-linecap="round"/>
      <line x1="${tx - 10}" y1="${ty - 15}" x2="${tx + 15}" y2="${ty + 5}" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"/>
    `;
  } else if (typeId === 'dent') {
    defectGlyph = `
      <circle cx="${tx}" cy="${ty}" r="15" fill="none" stroke="#ef4444" stroke-width="3"/>
      <circle cx="${tx}" cy="${ty}" r="8" fill="none" stroke="#ffffff" stroke-width="2" stroke-dasharray="3,2"/>
    `;
  } else if (typeId === 'crack') {
    defectGlyph = `
      <path d="M ${tx} ${ty - 16} L ${tx} ${ty + 16} M ${tx - 16} ${ty} L ${tx + 16} ${ty} M ${tx - 11} ${ty - 11} L ${tx + 11} ${ty + 11}" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round"/>
    `;
  } else {
    defectGlyph = `
      <polygon points="${tx},${ty - 14} ${tx + 12},${ty + 10} ${tx - 12},${ty + 10}" fill="#ef4444" stroke="#ffffff" stroke-width="2"/>
      <text x="${tx}" y="${ty + 7}" font-family="sans-serif" font-size="12" font-weight="bold" fill="#ffffff" text-anchor="middle">!</text>
    `;
  }

  const calloutY = ty < 305 ? ty - 45 : ty + 45;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="520" viewBox="0 0 800 520">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#090d16"/>
        <stop offset="100%" stop-color="#0f172a"/>
      </linearGradient>
      <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
        <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1e293b" stroke-width="0.8"/>
      </pattern>
    </defs>

    <!-- Background -->
    <rect width="800" height="520" fill="url(#bgGrad)"/>
    <rect width="800" height="520" fill="url(#grid)" opacity="0.7"/>

    <!-- Outer Tech Frames -->
    <rect x="14" y="14" width="772" height="492" rx="14" fill="none" stroke="#334155" stroke-width="1.8"/>
    <rect x="18" y="18" width="764" height="484" rx="10" fill="none" stroke="#f59e0b" stroke-opacity="0.35" stroke-width="1"/>

    <!-- Top Header Bar -->
    <rect x="25" y="25" width="750" height="46" rx="8" fill="#0f172a" stroke="#1e293b" stroke-width="1.2"/>
    <circle cx="45" cy="48" r="7" fill="#f59e0b"/>
    <text x="62" y="52" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="800" fill="#f59e0b" letter-spacing="1">
      RAPPORT D'INSPECTION TECHNIQUE &amp; CONTRÔLE CARROSSERIE
    </text>

    <!-- Phase Badge -->
    <rect x="520" y="33" width="115" height="30" rx="6" fill="${phase === 'departure' ? '#064e3b' : '#0c4a6e'}" stroke="${phase === 'departure' ? '#10b981' : '#38bdf8'}" stroke-width="1.5"/>
    <text x="577" y="52" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="800" fill="#ffffff" text-anchor="middle">
      PHASE ${phase === 'departure' ? 'DÉPART' : 'RETOUR'}
    </text>

    <!-- Contract Badge -->
    <rect x="645" y="33" width="120" height="30" rx="6" fill="#1e293b" stroke="#475569" stroke-width="1"/>
    <text x="705" y="52" font-family="ui-monospace, monospace" font-size="11" font-weight="700" fill="#f8fafc" text-anchor="middle">
      ${contractId}
    </text>

    <!-- Box 1: Véhicule & Plaque -->
    <rect x="25" y="79" width="365" height="92" rx="10" fill="#0d1527" stroke="#1e293b" stroke-width="1.2"/>
    <text x="40" y="99" font-family="system-ui, -apple-system, sans-serif" font-size="10" font-weight="800" fill="#94a3b8" letter-spacing="1">
      VÉHICULE EN CONTRAT
    </text>
    <text x="40" y="123" font-family="system-ui, -apple-system, sans-serif" font-size="17" font-weight="800" fill="#ffffff">
      ${brand.toUpperCase()} ${model.toUpperCase()}
    </text>
    <!-- License Plate Cartouche -->
    <rect x="40" y="134" width="230" height="28" rx="6" fill="#020617" stroke="#f59e0b" stroke-width="1.8"/>
    <rect x="42" y="136" width="22" height="24" rx="4" fill="#1d4ed8"/>
    <text x="53" y="152" font-family="system-ui, sans-serif" font-size="11" font-weight="900" fill="#ffffff" text-anchor="middle">F</text>
    <text x="155" y="153" font-family="ui-monospace, monospace" font-size="14" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="2">
      ${plate}
    </text>

    <!-- Box 2: Constat & Anomalie -->
    <rect x="410" y="79" width="365" height="92" rx="10" fill="#0d1527" stroke="#1e293b" stroke-width="1.2"/>
    <text x="425" y="99" font-family="system-ui, -apple-system, sans-serif" font-size="10" font-weight="800" fill="#ef4444" letter-spacing="1">
      ANOMALIE CARROSSERIE DÉCLARÉE
    </text>
    <text x="425" y="122" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="800" fill="#f59e0b">
      ${typeLabel}
    </text>
    <text x="425" y="142" font-family="system-ui, -apple-system, sans-serif" font-size="12" fill="#cbd5e1">
      Zone : <tspan fill="#38bdf8" font-weight="700">${zoneLabel}</tspan>
    </text>
    <text x="425" y="158" font-family="system-ui, -apple-system, sans-serif" font-size="11" fill="#94a3b8" font-style="italic">
      ${notes ? notes.substring(0, 48) : 'Constat contradictoire certifié versé au dossier'}
    </text>

    <!-- Blueprint Canvas Box -->
    <rect x="25" y="179" width="750" height="254" rx="12" fill="#070c18" stroke="#1e293b" stroke-width="1.2"/>
    <ellipse cx="400" cy="305" rx="280" ry="85" fill="#0284c7" fill-opacity="0.04"/>

    <!-- Car Blueprint Top View -->
    <path d="M 180 305 C 180 255 215 235 280 235 L 520 235 C 585 235 620 255 620 305 C 620 355 585 375 520 375 L 280 375 C 215 375 180 355 180 305 Z" fill="#0f172a" stroke="#38bdf8" stroke-width="2.2"/>
    
    <!-- Bumpers & Hood -->
    <path d="M 225 248 C 205 270 205 340 225 362" fill="none" stroke="#38bdf8" stroke-width="1.5"/>
    <line x1="270" y1="236" x2="270" y2="374" stroke="#38bdf8" stroke-opacity="0.4" stroke-width="1.5" stroke-dasharray="4,4"/>
    
    <!-- Windshield -->
    <path d="M 310 242 C 345 252 345 358 310 368" fill="none" stroke="#38bdf8" stroke-width="2.5"/>
    
    <!-- Roof Area -->
    <rect x="330" y="248" width="160" height="114" rx="8" fill="#1e293b" fill-opacity="0.5" stroke="#38bdf8" stroke-width="1.5"/>
    
    <!-- Rear Glass -->
    <path d="M 500 242 C 470 252 470 358 500 368" fill="none" stroke="#38bdf8" stroke-width="2.5"/>
    
    <!-- Trunk -->
    <line x1="550" y1="236" x2="550" y2="374" stroke="#38bdf8" stroke-opacity="0.4" stroke-width="1.5" stroke-dasharray="4,4"/>
    <path d="M 585 250 C 600 270 600 340 585 360" fill="none" stroke="#38bdf8" stroke-width="1.5"/>

    <!-- Tires -->
    <rect x="235" y="216" width="54" height="16" rx="4" fill="#334155" stroke="#64748b" stroke-width="1.2"/>
    <rect x="510" y="216" width="54" height="16" rx="4" fill="#334155" stroke="#64748b" stroke-width="1.2"/>
    <rect x="235" y="378" width="54" height="16" rx="4" fill="#334155" stroke="#64748b" stroke-width="1.2"/>
    <rect x="510" y="378" width="54" height="16" rx="4" fill="#334155" stroke="#64748b" stroke-width="1.2"/>

    <!-- Mirrors -->
    <rect x="316" y="222" width="16" height="10" rx="3" fill="#38bdf8" fill-opacity="0.8"/>
    <rect x="316" y="378" width="16" height="10" rx="3" fill="#38bdf8" fill-opacity="0.8"/>

    <!-- Front & Rear Labels inside blueprint -->
    <text x="145" y="309" font-family="system-ui, sans-serif" font-size="11" font-weight="800" fill="#64748b" text-anchor="middle">AVANT</text>
    <text x="655" y="309" font-family="system-ui, sans-serif" font-size="11" font-weight="800" fill="#64748b" text-anchor="middle">ARRIÈRE</text>

    <!-- HIGHLIGHTED DEFECT TARGET -->
    <circle cx="${tx}" cy="${ty}" r="34" fill="#ef4444" fill-opacity="0.2" stroke="#ef4444" stroke-width="2.5"/>
    <circle cx="${tx}" cy="${ty}" r="18" fill="#ef4444" fill-opacity="0.4" stroke="#f59e0b" stroke-width="2"/>
    <circle cx="${tx}" cy="${ty}" r="6" fill="#ffffff"/>
    <line x1="${tx - 28}" y1="${ty}" x2="${tx + 28}" y2="${ty}" stroke="#ffffff" stroke-width="1.8"/>
    <line x1="${tx}" y1="${ty - 28}" x2="${tx}" y2="${ty + 28}" stroke="#ffffff" stroke-width="1.8"/>
    
    ${defectGlyph}

    <!-- Callout Tag -->
    <line x1="${tx}" y1="${ty}" x2="${tx}" y2="${calloutY}" stroke="#f59e0b" stroke-width="2" stroke-dasharray="3,2"/>
    <rect x="${Math.max(40, Math.min(610, tx - 90))}" y="${calloutY > ty ? calloutY : calloutY - 24}" width="180" height="24" rx="6" fill="#0f172a" stroke="#f59e0b" stroke-width="1.5"/>
    <text x="${Math.max(40, Math.min(610, tx - 90)) + 90}" y="${calloutY > ty ? calloutY + 16 : calloutY - 8}" font-family="system-ui, sans-serif" font-size="10.5" font-weight="800" fill="#f59e0b" text-anchor="middle">
      ⚠️ ${zoneNameShort.toUpperCase()} • ${typeLabel.split('/')[0].trim().toUpperCase()}
    </text>

    <!-- Footer Bar with Certified Timestamp -->
    <rect x="25" y="441" width="750" height="54" rx="10" fill="#0f172a" stroke="#1e293b" stroke-width="1.2"/>
    
    <!-- Horodatage -->
    <text x="42" y="462" font-family="system-ui, sans-serif" font-size="9.5" font-weight="800" fill="#94a3b8" letter-spacing="1">
      HORODATAGE OFFICIEL &amp; VÉRIFICATION :
    </text>
    <text x="42" y="482" font-family="ui-monospace, monospace" font-size="13" font-weight="800" fill="#38bdf8">
      ${dateStr}
    </text>

    <!-- Conducteur -->
    <text x="360" y="462" font-family="system-ui, sans-serif" font-size="9.5" font-weight="800" fill="#94a3b8" letter-spacing="1">
      CONDUCTEUR :
    </text>
    <text x="360" y="482" font-family="system-ui, sans-serif" font-size="12" font-weight="700" fill="#ffffff">
      ${clientName}
    </text>

    <!-- Agent -->
    <text x="560" y="462" font-family="system-ui, sans-serif" font-size="9.5" font-weight="800" fill="#94a3b8" letter-spacing="1">
      INSPECTEUR EN CHARGE :
    </text>
    <text x="560" y="482" font-family="system-ui, sans-serif" font-size="12" font-weight="700" fill="#f59e0b">
      ${inspectorName}
    </text>

    <!-- Official Stamp Seal -->
    <g transform="translate(735, 468)">
      <circle cx="0" cy="0" r="19" fill="#022c22" stroke="#10b981" stroke-width="1.5"/>
      <text x="0" y="-3" font-family="system-ui, sans-serif" font-size="7" font-weight="900" fill="#10b981" text-anchor="middle">CERTIFIÉ</text>
      <text x="0" y="7" font-family="system-ui, sans-serif" font-size="7" font-weight="900" fill="#10b981" text-anchor="middle">NUMÉRIQUE</text>
    </g>
  </svg>`;
};

export const InspectionManagerModal: React.FC<InspectionManagerModalProps> = ({
  contract,
  isOpen,
  onClose,
}) => {
  const { updateContractInspection, currentUser } = useApp();

  const [activePhase, setActivePhase] = useState<'departure' | 'return'>('departure');
  const [lightboxPhoto, setLightboxPhoto] = useState<InspectionPhoto | null>(null);

  // Inspection form state initialized from contract
  const initialInspection: ContractInspection = contract?.inspection || {
    departureDate: contract ? `${contract.startDate} ${contract.startTime}` : '',
    departureKm: contract?.departureKm || 0,
    departureFuel: '8/8',
    departureInspector: currentUser.name,
    departureNotes: 'Véhicule remis propre et conforme.',
    departureChecklist: {
      spareWheel: true,
      jack: true,
      triangle: true,
      vest: true,
      cleanInterior: true,
      cleanExterior: true,
      documentsPresent: true,
    },
    returnDate: contract?.returnDate ? `${contract.returnDate} ${contract.returnTime}` : '',
    returnKm: contract?.returnKm,
    returnFuel: '8/8',
    returnInspector: currentUser.name,
    returnNotes: '',
    returnChecklist: {
      spareWheel: true,
      jack: true,
      triangle: true,
      vest: true,
      cleanInterior: true,
      cleanExterior: true,
      documentsPresent: true,
    },
    photos: contract?.inspection?.photos || [],
  };

  const [inspectionState, setInspectionState] = useState<ContractInspection>(initialInspection);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // New photo form state
  const [isAddingPhoto, setIsAddingPhoto] = useState<boolean>(false);
  const [photoZone, setPhotoZone] = useState<string>('front');
  const [photoType, setPhotoType] = useState<string>('scratch');
  const [photoNotes, setPhotoNotes] = useState<string>('');
  const [photoDataUrl, setPhotoDataUrl] = useState<string>('');

  if (!isOpen || !contract) return null;

  const currentPhotos = inspectionState.photos.filter((p) => (p.stage || p.phase) === activePhase);
  const plate = formatPlateFrench(contract.vehicleSnapshot.plate);

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === 'string') {
        setPhotoDataUrl(event.target.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Add sample photo placeholder for testing
  const handleUseSamplePhoto = (targetType?: string, targetZone?: string, targetNotes?: string) => {
    const selectedType = targetType || photoType;
    const selectedZone = targetZone || photoZone;
    const selectedNotes = targetNotes !== undefined ? targetNotes : photoNotes;

    const now = new Date();
    const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} à ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    const svgString = generateInspectionDiagramSVG({
      brand: contract.vehicleSnapshot.brand,
      model: contract.vehicleSnapshot.model,
      plate,
      contractId: contract.id,
      clientName: contract.clientSnapshot.fullName,
      phase: activePhase,
      zoneId: selectedZone,
      typeId: selectedType,
      notes: selectedNotes,
      inspectorName: `${currentUser.name} (${currentUser.role === 'admin' ? 'Gérant' : currentUser.role === 'manager' ? 'Responsable' : 'Agent'})`,
      dateStr,
    });

    const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;
    setPhotoDataUrl(dataUrl);
  };

  const handleSavePhoto = () => {
    if (!photoDataUrl) {
      alert('Veuillez importer une photo du défaut.');
      return;
    }

    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const newPhoto: InspectionPhoto = {
      id: `photo-${Date.now()}`,
      stage: activePhase,
      phase: activePhase,
      zone: photoZone,
      type: photoType,
      url: photoDataUrl,
      notes: photoNotes.trim() || `Défaut ${getTypeLabel(photoType)} relevé sur ${getZoneLabel(photoZone)}`,
      description: photoNotes.trim() || `Défaut ${getTypeLabel(photoType)} relevé sur ${getZoneLabel(photoZone)}`,
      timestamp: dateStr,
      takenBy: currentUser.name,
    };

    setInspectionState((prev) => ({
      ...prev,
      photos: [newPhoto, ...prev.photos],
    }));

    setIsAddingPhoto(false);
    setPhotoDataUrl('');
    setPhotoNotes('');
  };

  const handleDeletePhoto = (photoId: string) => {
    if (!confirm('Supprimer cette photo d’état des lieux ?')) return;
    setInspectionState((prev) => ({
      ...prev,
      photos: prev.photos.filter((p) => p.id !== photoId),
    }));
  };

  const handleSaveAll = () => {
    updateContractInspection(contract.id, inspectionState);
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden flex flex-col max-h-[92vh]">
        {/* HEADER */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white tracking-wide flex items-center gap-2">
                État des Lieux avec Photos & Contrôle Carrosserie
                <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-mono">
                  {plate}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Contrat N° {contract.contractNumber} • {contract.clientSnapshot.lastName}{' '}
                {contract.clientSnapshot.firstName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* PHASE SELECTOR TABS */}
        <div className="bg-slate-950 px-6 py-2.5 border-b border-slate-800 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActivePhase('departure')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activePhase === 'departure'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-850 text-slate-400 hover:text-white border border-slate-700'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Inspection DÉPART</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-slate-950/40">
                {inspectionState.photos.filter((p) => p.phase === 'departure').length} photos
              </span>
            </button>

            <button
              onClick={() => setActivePhase('return')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activePhase === 'return'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'bg-slate-850 text-slate-400 hover:text-white border border-slate-700'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Inspection RETOUR</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-slate-950/40">
                {inspectionState.photos.filter((p) => p.phase === 'return').length} photos
              </span>
            </button>
          </div>

          <button
            onClick={() => setIsAddingPhoto(true)}
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs px-3.5 py-1.5 rounded-lg shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Attacher une Photo de Défaut</span>
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* SECTION: CHECKLIST & GAUGES FOR CURRENT PHASE */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            {/* FUEL & KM */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-amber-400 font-bold uppercase text-[11px]">
                <Fuel className="w-4 h-4" />
                <span>Carburant & Kilométrage ({activePhase === 'departure' ? 'Départ' : 'Retour'})</span>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Niveau de carburant :</label>
                <select
                  value={activePhase === 'departure' ? inspectionState.departureFuel : inspectionState.returnFuel}
                  onChange={(e) =>
                    setInspectionState((prev) => ({
                      ...prev,
                      [activePhase === 'departure' ? 'departureFuel' : 'returnFuel']: e.target.value,
                    }))
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
                >
                  <option value="8/8">8/8 (Plein Complet)</option>
                  <option value="7/8">7/8</option>
                  <option value="6/8">6/8 (3/4)</option>
                  <option value="5/8">5/8</option>
                  <option value="4/8">4/8 (1/2)</option>
                  <option value="3/8">3/8</option>
                  <option value="2/8">2/8 (1/4)</option>
                  <option value="1/8">1/8 (Réserve)</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Relevé Kilométrique :</label>
                <input
                  type="number"
                  value={activePhase === 'departure' ? inspectionState.departureKm : inspectionState.returnKm || ''}
                  onChange={(e) =>
                    setInspectionState((prev) => ({
                      ...prev,
                      [activePhase === 'departure' ? 'departureKm' : 'returnKm']: Number(e.target.value),
                    }))
                  }
                  placeholder="KM au compteur"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
                />
              </div>
            </div>

            {/* CHECKLIST */}
            <div className="space-y-2 md:col-span-2">
              <span className="text-amber-400 font-bold uppercase text-[11px] block">
                Contrôle des Équipements de bord ({activePhase === 'departure' ? 'Sortie' : 'Entrée'})
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { key: 'spareWheel', label: 'Roue de secours' },
                  { key: 'jack', label: 'Cric & Manivelle' },
                  { key: 'triangle', label: 'Triangle' },
                  { key: 'vest', label: 'Gilet fluorescent' },
                  { key: 'cleanInterior', label: 'Intérieur propre' },
                  { key: 'cleanExterior', label: 'Extérieur lavé' },
                  { key: 'documentsPresent', label: 'Documents / C.G' },
                ].map((item) => {
                  const checklist =
                    activePhase === 'departure'
                      ? inspectionState.departureChecklist
                      : inspectionState.returnChecklist;
                  const isChecked = Boolean(checklist?.[item.key as keyof typeof checklist] ?? true);

                  return (
                    <label
                      key={item.key}
                      className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer select-none transition-colors ${
                        isChecked
                          ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                          : 'bg-slate-900 border-slate-800 text-slate-400'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          const targetKey = activePhase === 'departure' ? 'departureChecklist' : 'returnChecklist';
                          setInspectionState((prev) => ({
                            ...prev,
                            [targetKey]: {
                              ...prev[targetKey],
                              [item.key]: e.target.checked,
                            },
                          }));
                        }}
                        className="rounded border-slate-700 text-amber-500 focus:ring-0"
                      />
                      <span className="text-[11px] font-medium">{item.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ADD PHOTO ACCORDION / FORM */}
          {isAddingPhoto && (
            <div className="bg-slate-950 border-2 border-amber-500/50 rounded-xl p-4 space-y-4 animate-in fade-in duration-150">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <h4 className="text-xs font-bold text-amber-400 uppercase flex items-center gap-2">
                  <Camera className="w-4 h-4" />
                  Nouvelle Photo de Carrosserie — {activePhase === 'departure' ? 'Départ' : 'Retour'}
                </h4>
                <button
                  onClick={() => setIsAddingPhoto(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Zone du véhicule *</label>
                  <select
                    value={photoZone}
                    onChange={(e) => setPhotoZone(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-white"
                  >
                    {VEHICLE_ZONES.map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Nature du défaut *</label>
                  <select
                    value={photoType}
                    onChange={(e) => setPhotoType(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-white"
                  >
                    {DEFECT_TYPES.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-slate-300 font-semibold mb-1">
                    Description détaillée du défaut (taille, localisation précise) :
                  </label>
                  <input
                    type="text"
                    value={photoNotes}
                    onChange={(e) => setPhotoNotes(e.target.value)}
                    placeholder="Ex: Rayure 8 cm au niveau de l'aile avant droite au-dessus du passage de roue"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
                  />
                </div>
              </div>

              {/* PHOTO UPLOAD & PREVIEW */}
              <div className="border-t border-slate-800 pt-3">
                <div className="w-full">
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-700 hover:border-amber-500/50 rounded-xl p-5 cursor-pointer bg-slate-900/50 hover:bg-slate-900/80 transition-colors">
                    <UploadCloud className="w-7 h-7 text-amber-400 mb-1.5" />
                    <span className="text-xs font-semibold text-slate-200">
                      Cliquez pour importer une photo du défaut
                    </span>
                    <span className="text-[11px] text-slate-500 mt-0.5">
                      PNG, JPG ou capture photo smartphone / tablette
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Preview */}
                {photoDataUrl && (
                  <div className="mt-4 bg-slate-950/90 rounded-2xl border-2 border-amber-500/40 p-3.5 shadow-xl space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-xs font-bold text-emerald-400 uppercase tracking-wide">
                          ✓ Photo sélectionnée prête à être rattachée
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setPhotoDataUrl(null)}
                          className="text-[11px] text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                          title="Supprimer cette photo et en sélectionner une autre"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Changer de photo</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setLightboxPhoto({
                              id: 'preview',
                              stage: activePhase,
                              phase: activePhase,
                              zone: photoZone,
                              type: photoType,
                              url: photoDataUrl,
                              notes: photoNotes || `Défaut ${getTypeLabel(photoType)} relevé sur ${getZoneLabel(photoZone)}`,
                              description: photoNotes || `Défaut ${getTypeLabel(photoType)} relevé sur ${getZoneLabel(photoZone)}`,
                              timestamp: new Date().toLocaleString('fr-FR'),
                              takenBy: currentUser.name,
                            })
                          }
                          className="text-[11px] text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <ZoomIn className="w-3 h-3 text-amber-400" />
                          <span>Agrandir</span>
                        </button>
                      </div>
                    </div>

                    {/* Grand schéma / Photo haute lisibilité */}
                    <div
                      className="relative bg-slate-900 rounded-xl overflow-hidden border border-slate-800 cursor-pointer group flex items-center justify-center p-1.5"
                      onClick={() =>
                        setLightboxPhoto({
                          id: 'preview',
                          stage: activePhase,
                          phase: activePhase,
                          zone: photoZone,
                          type: photoType,
                          url: photoDataUrl,
                          notes: photoNotes || `Défaut ${getTypeLabel(photoType)} relevé sur ${getZoneLabel(photoZone)}`,
                          description: photoNotes || `Défaut ${getTypeLabel(photoType)} relevé sur ${getZoneLabel(photoZone)}`,
                          timestamp: new Date().toLocaleString('fr-FR'),
                          takenBy: currentUser.name,
                        })
                      }
                    >
                      <img
                        src={photoDataUrl}
                        alt="Schéma technique ou photo"
                        className="w-full max-h-72 object-contain rounded-lg transition-transform group-hover:scale-[1.01]"
                      />
                      <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <span className="bg-slate-900/90 text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg border border-amber-500/40">
                          <ZoomIn className="w-3.5 h-3.5 text-amber-400" />
                          Cliquer pour voir en plein écran
                        </span>
                      </div>
                    </div>

                    {/* Données de contrôle vérifiées */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-xs bg-slate-900/70 p-2.5 rounded-xl border border-slate-800">
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase block font-semibold">Véhicule</span>
                        <span className="text-white font-bold">{contract.vehicleSnapshot.brand} {contract.vehicleSnapshot.model}</span>
                        <span className="block font-mono text-[11px] text-amber-400 font-bold">{plate}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase block font-semibold">Zone contrôlée</span>
                        <span className="text-sky-300 font-semibold">{getZoneLabel(photoZone)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase block font-semibold">Type d'anomalie</span>
                        <span className="text-amber-400 font-semibold">{getTypeLabel(photoType)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase block font-semibold">Horodatage certifié</span>
                        <span className="text-slate-300 font-mono text-[11px]">{new Date().toLocaleDateString('fr-FR')} à {new Date().toLocaleTimeString('fr-FR')}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* SAVE PHOTO BUTTON */}
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  onClick={() => setIsAddingPhoto(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSavePhoto}
                  disabled={!photoDataUrl}
                  className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs px-4 py-1.5 rounded-lg transition-all cursor-pointer shadow-sm"
                >
                  Enregistrer la photo
                </button>
              </div>
            </div>
          )}

          {/* GALLERY OF PHOTOS FOR CURRENT PHASE */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-slate-200 uppercase flex items-center gap-2">
                <span>Photos Relevées ({currentPhotos.length})</span>
                <span className="text-[11px] font-normal text-slate-400">
                  — Phase {activePhase === 'departure' ? 'DÉPART' : 'RETOUR'}
                </span>
              </h4>
            </div>

            {currentPhotos.length === 0 ? (
              <div className="text-center py-10 bg-slate-950/40 border border-slate-800/80 rounded-xl">
                <Car className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-400">
                  Aucune anomalie ni photo enregistrée pour la phase {activePhase === 'departure' ? 'départ' : 'retour'}.
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Le véhicule est considéré conforme et exempt de tout défaut majeur pour cette phase.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {currentPhotos.map((photo) => (
                  <div
                    key={photo.id}
                    className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden group hover:border-amber-500/50 transition-all flex flex-col"
                  >
                    {/* PHOTO THUMBNAIL */}
                    <div
                      className="relative h-48 bg-slate-950 cursor-pointer overflow-hidden flex items-center justify-center p-1 border-b border-slate-800"
                      onClick={() => setLightboxPhoto(photo)}
                    >
                      <img
                        src={photo.url}
                        alt={photo.notes}
                        className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <span className="bg-slate-900/90 text-white text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-md border border-amber-500/40">
                          <ZoomIn className="w-3 h-3 text-amber-400" />
                          Agrandir
                        </span>
                      </div>
                      <span className="absolute top-2 left-2 bg-slate-900/90 text-amber-400 border border-amber-500/40 text-[9.5px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                        {getTypeLabel(photo.type)}
                      </span>
                    </div>

                    {/* DETAILS */}
                    <div className="p-3 flex-1 flex flex-col justify-between space-y-2">
                      <div>
                        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-200">
                          <span className="text-sky-300 font-bold">{getZoneLabel(photo.zone)}</span>
                          <span className="text-slate-500 font-mono text-[10px]">
                            {photo.timestamp.split(' ')[0]}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 mt-1 leading-snug">
                          {photo.notes}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-850 text-[10px] text-slate-500">
                        <span>Par : {photo.takenBy || 'Agent'}</span>
                        <button
                          onClick={() => handleDeletePhoto(photo.id)}
                          className="text-red-400 hover:text-red-300 p-1 hover:bg-red-500/10 rounded transition-colors"
                          title="Supprimer la photo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* FOOTER ACTIONS */}
        <div className="bg-slate-950 px-6 py-3.5 border-t border-slate-800 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            Total photos enregistrées :{' '}
            <strong className="text-white font-mono">{inspectionState.photos.length}</strong>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
            >
              Fermer
            </button>
            <button
              onClick={handleSaveAll}
              className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs px-5 py-2 rounded-xl shadow-lg shadow-amber-500/20 transition-all cursor-pointer active:scale-95"
            >
              {saveSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-slate-950" />
                  <span>Enregistré avec succès !</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Valider &amp; Enregistrer l'État des Lieux</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* LIGHTBOX FOR FULL PHOTO VIEW */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-60 bg-black/90 flex flex-col items-center justify-center p-4"
          onClick={() => setLightboxPhoto(null)}
        >
          <div
            className="relative max-w-4xl w-full bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3.5 bg-slate-950 flex items-center justify-between border-b border-slate-800">
              <div className="text-xs text-white font-bold flex items-center gap-2">
                <span className="text-amber-400 font-extrabold">{getZoneLabel(lightboxPhoto.zone)}</span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-300">{getTypeLabel(lightboxPhoto.type)}</span>
              </div>
              <button
                onClick={() => setLightboxPhoto(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="max-h-[75vh] bg-slate-950 flex items-center justify-center p-2 overflow-hidden">
              <img
                src={lightboxPhoto.url}
                alt={lightboxPhoto.notes}
                className="max-h-[75vh] w-auto object-contain rounded-lg"
              />
            </div>
            <div className="p-3.5 bg-slate-950 border-t border-slate-800 text-xs text-slate-300 flex items-center justify-between">
              <span className="font-medium text-slate-200">{lightboxPhoto.notes}</span>
              <span className="text-slate-400 font-mono text-[11px]">
                {lightboxPhoto.timestamp} • {lightboxPhoto.takenBy || 'Agent'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
