import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  Building2,
  Cloud,
  CloudOff,
  Save,
  CheckCircle,
  Download,
  ExternalLink,
  FileText,
  Handshake,
  ImagePlus,
  Loader2,
  RotateCcw,
  Share2,
  Trash2,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ContractPdfDocument } from './ContractPdfDocument';
import { PartnerAgencyProvider, brandTermsForPartner, type PartnerAgency } from '../context/PartnerAgencyContext';
import { CONTRACT_TEMPLATES } from '../data/contractTemplates';
import { VEHICLE_CATEGORIES, buildContractInsurance } from '../data/insurancePacks';
import { downloadContractPdf, generateContractPdf, type GeneratedPdfResult } from '../utils/contractPdfGenerator';
import { describePdfError, isIosDevice, sharePdfFile } from '../lib/pdfShare';
import { deletePartnerAgency, fetchPartnerAgencies, savePartnerAgency } from '../lib/partnerAgencies';
import { deletePartnerContract, fetchPartnerContracts, savePartnerContract, type PartnerContractRecord } from '../lib/partnerContracts';
import type { CompanySettings, Contract, ContractTemplateId, DocumentType, FuelType, VehicleCategory } from '../types';

/**
 * Contrats pour d'AUTRES agences : on garde nos modèles, on change l'identité de l'agence et on laisse le cachet vide.
 * Rien n'est enregistré dans l'application (ni contrat, ni client, ni véhicule) : on télécharge le PDF.
 * Seules les identités des agences (Alaylichi Car, etc.) sont enregistrées, sur le serveur avec une copie locale de secours.
 */

const AGENCY_STORAGE_KEY = 'morvello_partner_agencies_v2';
const EXPORT_PREFIX = 'partner';
const A4_WIDTH_PX = 794; // 210 mm à 96 dpi

interface AgencyForm {
  name: string;
  logo: string;
  city: string;
  legalLine: string;
  address: string;
  phone1: string;
  phone2: string;
  assistancePhone: string;
  email: string;
  website: string;
  taxId: string;
  rc: string;
  ice: string;
  patente: string;
}

interface PersonForm {
  lastName: string;
  firstName: string;
  birthDate: string;
  docType: DocumentType;
  docNumber: string;
  drivingLicense: string;
  phone: string;
}

interface ContractForm {
  templateId: ContractTemplateId;
  contractNumber: string;
  client: PersonForm & { nationality: string; email: string; address: string };
  hasSecondDriver: boolean;
  second: PersonForm;
  vehicle: { brand: string; model: string; plate: string; fuelType: FuelType };
  category: VehicleCategory;
  departureKm: string;
  departureFuel: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  depositAmount: string;
  depositCollected: boolean;
  packLabel: string;
  coverage: string;
  franchiseMad: string;
  franchisePercent: string;
  managerName: string;
}

const EMPTY_AGENCY: AgencyForm = {
  name: '',
  logo: '',
  city: '',
  legalLine: '',
  address: '',
  phone1: '',
  phone2: '',
  assistancePhone: '',
  email: '',
  website: '',
  taxId: '',
  rc: '',
  ice: '',
  patente: '',
};

const EMPTY_PERSON: PersonForm = {
  lastName: '',
  firstName: '',
  birthDate: '',
  docType: 'Passeport',
  docNumber: '',
  drivingLicense: '',
  phone: '',
};

function toDateInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Numéro de contrat aléatoire, ex. « 2026-482917 » (année + 6 chiffres). */
function randomContractNumber(): string {
  const digits = String(Math.floor(Math.random() * 900000) + 100000);
  return `${new Date().getFullYear()}-${digits}`;
}

function newContractId(): string {
  try {
    return `ct_${crypto.randomUUID()}`;
  } catch {
    return `ct_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  }
}

/** Un contrat n'est enregistré automatiquement que s'il contient autre chose que les valeurs par défaut. */
function hasContractContent(f: ContractForm): boolean {
  return Boolean(
    f.client.lastName.trim() || f.client.firstName.trim() || f.vehicle.plate.trim() || f.vehicle.brand.trim() || f.vehicle.model.trim()
  );
}

function freshContract(templateId: ContractTemplateId = 'standard'): ContractForm {
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 24 * 3600 * 1000);
  return {
    templateId,
    contractNumber: randomContractNumber(),
    client: { ...EMPTY_PERSON, nationality: '', email: '', address: '' },
    hasSecondDriver: false,
    second: { ...EMPTY_PERSON },
    vehicle: { brand: '', model: '', plate: '', fuelType: 'Diesel' },
    category: 'citadine',
    departureKm: '',
    departureFuel: '8/8 (Plein)',
    startDate: toDateInput(today),
    startTime: '10:00',
    endDate: toDateInput(tomorrow),
    endTime: '10:00',
    depositAmount: '',
    depositCollected: true,
    packLabel: 'Assurance de base',
    coverage: 'Responsabilité civile, protection juridique, assurance conducteur & passagers, assistance',
    franchiseMad: '',
    franchisePercent: '5',
    managerName: '',
  };
}

/** Première agence enregistrée : Alaylichi Car (IF, ICE et forme juridique tirés de son formulaire Infraction-Pro). RC, patente et logo restent à compléter. */
const DEFAULT_AGENCY: AgencyForm = {
  ...EMPTY_AGENCY,
  name: 'Alaylichi Car',
  city: 'Casablanca',
  legalLine: 'Société à Responsabilité Limitée',
  address: 'Hay Annakhil 76, Magasin N° 92, Immeuble 2 FB 2, Nouaceur, Casablanca 20000',
  phone1: '06 45 12 44 65',
  phone2: '06 49 51 66 97',
  email: 'Alaylichicar@gmail.com',
  taxId: '53723240',
  ice: '003271854000073',
};

type SavedAgency = AgencyForm & { id: string };

interface AgencyStore {
  list: SavedAgency[];
  activeId: string;
}

const newAgencyId = () => `ag-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function loadAgencies(): AgencyStore {
  const seed: AgencyStore = { list: [{ ...DEFAULT_AGENCY, id: 'alaylichi' }], activeId: 'alaylichi' };
  try {
    const raw = localStorage.getItem(AGENCY_STORAGE_KEY);
    if (!raw) return seed;
    const parsed = JSON.parse(raw) as Partial<AgencyStore>;
    const list = (parsed.list || []).map((a) => {
      const merged = { ...EMPTY_AGENCY, ...a } as SavedAgency;
      if (merged.id !== 'alaylichi') return merged;
      // Alaylichi déjà gardée avant l'ajout de ses infos légales : on complète seulement les champs restés vides
      const filled = { ...merged };
      (Object.keys(DEFAULT_AGENCY) as (keyof AgencyForm)[]).forEach((key) => {
        if (!filled[key]) filled[key] = DEFAULT_AGENCY[key];
      });
      return filled;
    }) as SavedAgency[];
    if (list.length === 0) return seed;
    return { list, activeId: list.some((a) => a.id === parsed.activeId) ? (parsed.activeId as string) : list[0].id };
  } catch {
    return seed;
  }
}

function saveAgencies(store: AgencyStore) {
  try {
    localStorage.setItem(AGENCY_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Stockage plein ou bloqué : les agences restent en mémoire pour cette session
  }
}

/** Logo choisi : réduit à 500 px, transparence conservée (le contrat est sur fond blanc). */
function logoFileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error('not-an-image'));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const ratio = Math.min(1, 500 / Math.max(img.naturalWidth, img.naturalHeight));
      const width = Math.max(1, Math.round(img.naturalWidth * ratio));
      const height = Math.max(1, Math.round(img.naturalHeight * ratio));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('no-canvas'));
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('image-load-failed'));
    };
    img.src = url;
  });
}

const dash = (value: string) => value.trim() || '—';

function computeTotalDays(f: ContractForm): number {
  const start = new Date(`${f.startDate}T${f.startTime || '00:00'}`).getTime();
  const end = new Date(`${f.endDate}T${f.endTime || '00:00'}`).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 1;
  return Math.max(1, Math.ceil((end - start) / (24 * 3600 * 1000)));
}

function buildCompanySettings(a: AgencyForm, templateId: ContractTemplateId): CompanySettings {
  const phone1 = a.phone1.trim();
  return {
    name: a.name.trim() || 'NOM DE L’AGENCE',
    taxId: a.taxId.trim(),
    rc: a.rc.trim(),
    ice: a.ice.trim(),
    // Le modèle retombe sur le numéro de Morvello quand ces champs sont vides : on ne le laisse jamais faire
    patente: a.patente.trim() || '—',
    address: a.address.trim(),
    phone1,
    phone2: a.phone2.trim(),
    assistancePhone: a.assistancePhone.trim() || phone1 || '—',
    website: a.website.trim(),
    email: a.email.trim(),
    contractPrefix: '',
    contractYear: new Date().getFullYear(),
    nextContractNumber: 0,
    defaultContractTemplate: templateId,
  };
}

function buildContract(f: ContractForm, a: AgencyForm, termsVersionLabel: string): Contract {
  const personAddress = dash(f.client.address);
  const insurance = buildContractInsurance(f.category, 'base');
  const franchiseMad = Number(f.franchiseMad.replace(',', '.')) || 0;
  const deposit = Number(f.depositAmount.replace(',', '.')) || 0;
  const totalDays = computeTotalDays(f);

  return {
    id: 'partner-contract',
    contractNumber: dash(f.contractNumber),
    status: 'active',
    clientId: '',
    clientSnapshot: {
      id: '',
      firstName: f.client.firstName.trim(),
      lastName: f.client.lastName.trim(),
      birthDate: f.client.birthDate,
      drivingLicense: f.client.drivingLicense.trim(),
      docType: f.client.docType,
      docNumber: f.client.docNumber.trim(),
      phone: f.client.phone.trim(),
      email: f.client.email.trim(),
      address: personAddress,
      country: dash(f.client.nationality),
    },
    hasSecondDriver: f.hasSecondDriver,
    secondDriverSnapshot: f.hasSecondDriver
      ? {
          firstName: f.second.firstName.trim(),
          lastName: f.second.lastName.trim(),
          birthDate: f.second.birthDate,
          drivingLicense: f.second.drivingLicense.trim(),
          docType: f.second.docType,
          docNumber: f.second.docNumber.trim(),
          phone: f.second.phone.trim(),
        }
      : undefined,
    vehicleId: '',
    vehicleSnapshot: {
      id: '',
      brand: f.vehicle.brand.trim(),
      model: f.vehicle.model.trim(),
      plate: f.vehicle.plate.trim(),
      fuelType: f.vehicle.fuelType,
    },
    startDate: f.startDate || toDateInput(new Date()),
    startTime: f.startTime || '10:00',
    endDate: f.endDate || f.startDate || toDateInput(new Date()),
    endTime: f.endTime || '10:00',
    departureKm: Number(f.departureKm.replace(/\s/g, '')) || 0,
    departureFuel: f.departureFuel,
    prolongation: { isActive: false, newEndDate: '', newEndTime: '' },
    termsVersion: termsVersionLabel,
    totalDays,
    depositAmount: deposit,
    depositCollected: f.depositCollected,
    insurance: {
      ...insurance,
      packLabel: f.packLabel.trim() || 'Assurance',
      coverage: f.coverage.trim(),
      franchiseMad,
      franchiseRatePercent: Number(f.franchisePercent.replace(',', '.')) || 0,
      depositMad: deposit,
      dailySupplementMad: 0,
    },
    createdAt: new Date().toISOString(),
    createdBy: '',
    managerDisplayName: f.managerName.trim(),
    managerPhone: a.phone1.trim() || undefined,
    templateId: f.templateId,
  } as Contract;
}

function safeFilePart(value: string, fallback: string): string {
  const cleaned = value.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
  return cleaned || fallback;
}

// ---------------------------------------------------------------------------------------------------------------------
// Petits composants de saisie
// ---------------------------------------------------------------------------------------------------------------------

const inputClass =
  'w-full min-h-10 bg-slate-950 border border-slate-700 focus:border-amber-500 focus:outline-none rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600';

const Field: React.FC<{ label: string; hint?: string; className?: string; children: React.ReactNode }> = ({
  label,
  hint,
  className = '',
  children,
}) => (
  <label className={`block ${className}`}>
    <span className="block text-[11px] font-semibold text-slate-400 mb-1">{label}</span>
    {children}
    {hint && <span className="block text-[10px] text-slate-500 mt-1">{hint}</span>}
  </label>
);

const Card: React.FC<{ title: string; icon?: React.ReactNode; children: React.ReactNode; aside?: React.ReactNode }> = ({
  title,
  icon,
  children,
  aside,
}) => (
  <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
    <div className="flex items-center justify-between gap-3">
      <h3 className="flex items-center gap-2 text-sm font-bold text-white">
        {icon}
        {title}
      </h3>
      {aside}
    </div>
    {children}
  </section>
);

const TextInput: React.FC<
  { value: string; onChange: (v: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>
> = ({ value, onChange, ...rest }) => (
  <input {...rest} value={value} onChange={(e) => onChange(e.target.value)} className={inputClass} />
);

const PersonFields: React.FC<{
  value: PersonForm;
  onChange: (next: PersonForm) => void;
}> = ({ value, onChange }) => {
  const set = (patch: Partial<PersonForm>) => onChange({ ...value, ...patch });
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <Field label="Nom">
        <TextInput value={value.lastName} onChange={(v) => set({ lastName: v })} autoComplete="off" />
      </Field>
      <Field label="Prénom">
        <TextInput value={value.firstName} onChange={(v) => set({ firstName: v })} autoComplete="off" />
      </Field>
      <Field label="Pièce d’identité">
        <select
          value={value.docType}
          onChange={(e) => set({ docType: e.target.value as DocumentType })}
          className={inputClass}
        >
          <option value="Passeport">Passeport</option>
          <option value="CIN">CIN</option>
          <option value="Carte de Séjour">Carte de séjour</option>
        </select>
      </Field>
      <Field label="N° de la pièce">
        <TextInput value={value.docNumber} onChange={(v) => set({ docNumber: v })} autoComplete="off" />
      </Field>
      <Field label="N° du permis de conduire">
        <TextInput value={value.drivingLicense} onChange={(v) => set({ drivingLicense: v })} autoComplete="off" />
      </Field>
      <Field label="Date de naissance">
        <TextInput value={value.birthDate} onChange={(v) => set({ birthDate: v })} placeholder="JJ/MM/AAAA" autoComplete="off" />
      </Field>
      <Field label="Téléphone">
        <TextInput value={value.phone} onChange={(v) => set({ phone: v })} inputMode="tel" autoComplete="off" />
      </Field>
    </div>
  );
};

// ---------------------------------------------------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------------------------------------------------

export const PartnerContractsView: React.FC = () => {
  const { termsVersion } = useApp();
  const [store, setStore] = useState<AgencyStore>(loadAgencies);
  const agency = store.list.find((a) => a.id === store.activeId) ?? store.list[0];
  const [form, setForm] = useState<ContractForm>(() => freshContract());
  const [logoError, setLogoError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState<{ step: string; percent: number } | null>(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [readyPdf, setReadyPdf] = useState<GeneratedPdfResult | null>(null);
  const [shareNote, setShareNote] = useState('');
  const isIos = useMemo(() => isIosDevice(), []);

  // --- Enregistrement des agences : base de données (réservée à l'admin) + copie locale de secours -------------------
  type SyncState = 'loading' | 'saved' | 'pending' | 'saving' | 'error';
  const [sync, setSync] = useState<{ state: SyncState; message?: string }>({ state: 'loading' });
  const storeRef = useRef(store);
  const dirtyRef = useRef<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  storeRef.current = store;

  useEffect(() => {
    saveAgencies(store);
  }, [store]);

  const flushSave = async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    const ids = [...dirtyRef.current];
    if (ids.length === 0) return;
    setSync({ state: 'saving' });
    for (const id of ids) {
      const agency = storeRef.current.list.find((a) => a.id === id);
      if (!agency) {
        dirtyRef.current.delete(id);
        continue;
      }
      const result = await savePartnerAgency(agency);
      if (!result.ok) {
        setSync({ state: 'error', message: result.error });
        return;
      }
      // Modifiée pendant l'envoi : elle reste en attente pour un nouvel envoi
      if (storeRef.current.list.find((a) => a.id === id) === agency) dirtyRef.current.delete(id);
    }
    setSync(dirtyRef.current.size === 0 ? { state: 'saved' } : { state: 'pending' });
    if (dirtyRef.current.size > 0) timerRef.current = setTimeout(() => void flushSave(), 800);
  };

  const markDirty = (id: string) => {
    dirtyRef.current.add(id);
    setSync({ state: 'pending' });
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void flushSave(), 1000);
  };

  // Au chargement : on reprend les agences du serveur ; s'il n'y en a pas encore, on y envoie celles de cet appareil
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await fetchPartnerAgencies({ ...EMPTY_AGENCY, id: '' });
      if (cancelled) return;
      if (!result.ok) {
        setSync({ state: 'error', message: result.error });
        return;
      }
      const remote = result.value || [];
      if (remote.length === 0) {
        storeRef.current.list.forEach((a) => dirtyRef.current.add(a.id));
        await flushSave();
        return;
      }
      setStore((prev) => ({
        list: remote as SavedAgency[],
        activeId: remote.some((a) => a.id === prev.activeId) ? prev.activeId : remote[0].id,
      }));
      setSync({ state: 'saved' });
    })();
    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setAgencyField = (patch: Partial<AgencyForm>) => {
    setStore((prev) => ({ ...prev, list: prev.list.map((a) => (a.id === prev.activeId ? { ...a, ...patch } : a)) }));
    markDirty(store.activeId);
  };
  const selectAgency = (id: string) => {
    setStore((prev) => ({ ...prev, activeId: id }));
    setLogoError('');
    const next = storeRef.current.list.find((a) => a.id === id);
    if (next) {
      agencyRef.current = next;
      scheduleContractSave();
    }
  };
  const addAgency = () => {
    const created: SavedAgency = { ...EMPTY_AGENCY, id: newAgencyId() };
    setStore((prev) => ({ list: [...prev.list, created], activeId: created.id }));
    setLogoError('');
  };
  // --- Contrats enregistrés (base de données) : enregistrement automatique, ouverture et modification -----------------
  const [contractId, setContractId] = useState<string>(newContractId);
  const [contracts, setContracts] = useState<PartnerContractRecord<ContractForm>[]>([]);
  const [cSync, setCSync] = useState<{ state: 'idle' | 'pending' | 'saving' | 'saved' | 'error'; message?: string }>({ state: 'idle' });
  const formRef = useRef(form);
  const contractIdRef = useRef(contractId);
  const agencyRef = useRef(agency);
  const cTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  formRef.current = form;
  contractIdRef.current = contractId;
  agencyRef.current = agency;

  const saveContract = async () => {
    if (cTimerRef.current) clearTimeout(cTimerRef.current);
    cTimerRef.current = null;
    const record: PartnerContractRecord<ContractForm> = {
      id: contractIdRef.current,
      partnerAgencyId: agencyRef.current.id,
      partnerAgencyName: agencyRef.current.name.trim(),
      form: formRef.current,
    };
    setCSync({ state: 'saving' });
    const result = await savePartnerContract(record);
    if (!result.ok) {
      setCSync({ state: 'error', message: result.error });
      return;
    }
    const stamped = { ...record, updatedAt: new Date().toISOString() };
    setContracts((prev) => [stamped, ...prev.filter((c) => c.id !== record.id)]);
    // Modifié pendant l'envoi : un nouvel envoi est déjà programmé
    setCSync((prev) => (prev.state === 'pending' ? prev : { state: 'saved' }));
  };

  const scheduleContractSave = () => {
    if (!hasContractContent(formRef.current)) return;
    setCSync({ state: 'pending' });
    if (cTimerRef.current) clearTimeout(cTimerRef.current);
    cTimerRef.current = setTimeout(() => void saveContract(), 1500);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await fetchPartnerContracts<ContractForm>();
      if (cancelled) return;
      if (!result.ok) {
        setCSync({ state: 'error', message: result.error });
        return;
      }
      setContracts(result.value || []);
    })();
    return () => {
      cancelled = true;
      if (cTimerRef.current) clearTimeout(cTimerRef.current);
    };
  }, []);

  const setFormField = (patch: Partial<ContractForm>) => {
    formRef.current = { ...formRef.current, ...patch };
    setForm(formRef.current);
    scheduleContractSave();
  };

  // L'aperçu suit la frappe sans la ralentir
  const deferredAgency = useDeferredValue(agency);
  const deferredForm = useDeferredValue(form);

  const buildAll = (a: AgencyForm, f: ContractForm) => {
    const partner: PartnerAgency = { name: a.name, logo: a.logo || undefined, city: a.city, legalLine: a.legalLine };
    return {
      partner,
      settings: buildCompanySettings(a, f.templateId),
      contract: buildContract(f, a, termsVersion.version),
      terms: brandTermsForPartner(termsVersion, partner),
    };
  };

  const preview = useMemo(() => buildAll(deferredAgency, deferredForm), [deferredAgency, deferredForm, termsVersion]);

  // Aperçu A4 mis à l'échelle de la colonne
  const previewBoxRef = useRef<HTMLDivElement>(null);
  const previewInnerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.6);
  const [innerHeight, setInnerHeight] = useState(0);
  useEffect(() => {
    const box = previewBoxRef.current;
    const inner = previewInnerRef.current;
    if (!box || !inner || typeof ResizeObserver === 'undefined') return;
    const update = () => {
      setScale(Math.min(1, Math.max(0.3, box.clientWidth / A4_WIDTH_PX)));
      setInnerHeight(inner.scrollHeight);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(box);
    observer.observe(inner);
    return () => observer.disconnect();
  }, []);

  const onLogoPicked = async (file: File | undefined) => {
    if (!file) return;
    setLogoError('');
    try {
      setAgencyField({ logo: await logoFileToDataUrl(file) });
    } catch {
      setLogoError('Image illisible : choisissez un fichier PNG, JPG ou WebP.');
    }
  };

  const canExport = agency.name.trim().length > 0 && !exporting;

  const exportPdf = async () => {
    if (!canExport) return;
    setError('');
    setDone(false);
    setShareNote('');
    if (readyPdf) URL.revokeObjectURL(readyPdf.blobUrl);
    setReadyPdf(null);

    if (hasContractContent(form)) void saveContract();
    const { contract } = buildAll(agency, form);
    const filename = `Contrat_${safeFilePart(agency.name, 'agence')}_${safeFilePart(
      `${form.client.lastName}_${form.client.firstName}`,
      'client'
    )}_${form.startDate || toDateInput(new Date())}.pdf`;
    const options = {
      idPrefix: EXPORT_PREFIX,
      filename,
      documentProperties: {
        title: `Contrat de location ${contract.contractNumber} - ${agency.name.trim()}`,
        subject: `Contrat de location de véhicule n° ${contract.contractNumber}`,
        author: agency.name.trim(),
        creator: agency.name.trim(),
      },
      onProgress: (step: string, percent?: number) => setProgress({ step, percent: percent ?? 0 }),
    };

    try {
      // Les pages A4 à capturer ne sont montées que le temps de l'export
      flushSync(() => setExporting(true));
      setProgress({ step: 'Préparation du contrat…', percent: 5 });
      if (isIos) {
        setReadyPdf(await generateContractPdf(contract, options));
      } else {
        await downloadContractPdf(contract, options);
        setDone(true);
        setTimeout(() => setDone(false), 6000);
      }
    } catch (err) {
      console.error('Erreur de génération du PDF (contrat autre agence):', err);
      setError(describePdfError(err));
    } finally {
      setExporting(false);
      setProgress(null);
    }
  };

  const sharePdf = async () => {
    if (!readyPdf) return;
    const outcome = await sharePdfFile(readyPdf.blob, readyPdf.filename, 'Contrat de location');
    if (outcome === 'unsupported') setShareNote('Le partage n’est pas disponible ici : utilisez « Ouvrir le PDF ».');
    else if (outcome === 'failed') setShareNote('Le partage a échoué : utilisez « Ouvrir le PDF ».');
    else setShareNote('');
  };

  const openContract = (record: PartnerContractRecord<ContractForm>) => {
    if (cTimerRef.current) void saveContract();
    const base = freshContract(record.form?.templateId || 'standard');
    const loaded: ContractForm = {
      ...base,
      ...record.form,
      client: { ...base.client, ...(record.form?.client || {}) },
      second: { ...base.second, ...(record.form?.second || {}) },
      vehicle: { ...base.vehicle, ...(record.form?.vehicle || {}) },
    };
    formRef.current = loaded;
    setForm(loaded);
    setContractId(record.id);
    contractIdRef.current = record.id;
    const owner = storeRef.current.list.find((a) => a.id === record.partnerAgencyId);
    if (owner) setStore((prev) => ({ ...prev, activeId: owner.id }));
    setCSync({ state: 'saved' });
    setDone(false);
    setError('');
    if (readyPdf) URL.revokeObjectURL(readyPdf.blobUrl);
    setReadyPdf(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const removeContract = async (id: string) => {
    if (id === contractIdRef.current) {
      if (cTimerRef.current) clearTimeout(cTimerRef.current);
      cTimerRef.current = null;
      newContract(false);
    }
    setContracts((prev) => prev.filter((c) => c.id !== id));
    const result = await deletePartnerContract(id);
    if (!result.ok) setCSync({ state: 'error', message: result.error });
  };

  const newContract = (flush = true) => {
    if (flush && cTimerRef.current) void saveContract();
    const fresh = freshContract(form.templateId);
    formRef.current = fresh;
    const id = newContractId();
    contractIdRef.current = id;
    setContractId(id);
    setCSync({ state: 'idle' });
    setForm(fresh);
    setDone(false);
    setError('');
    if (readyPdf) URL.revokeObjectURL(readyPdf.blobUrl);
    setReadyPdf(null);
  };

  const deleteAgency = async () => {
    const removedId = store.activeId;
    dirtyRef.current.delete(removedId);
    const rest = store.list.filter((a) => a.id !== removedId);
    const blank: SavedAgency = { ...EMPTY_AGENCY, id: newAgencyId() };
    setStore(rest.length === 0 ? { list: [blank], activeId: blank.id } : { list: rest, activeId: rest[0].id });
    setLogoError('');
    const result = await deletePartnerAgency(removedId);
    if (!result.ok) setSync({ state: 'error', message: result.error });
  };

  const exportData = exporting ? buildAll(agency, form) : null;
  const totalDays = computeTotalDays(form);

  return (
    <div className="space-y-5">
      {/* EN-TÊTE */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400 flex items-center justify-center shrink-0">
            <Handshake className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-white">Contrats pour d’autres agences</h1>
            <p className="text-xs text-slate-400">
              Nos modèles aux couleurs d’une autre agence, cachet laissé vide. Chaque contrat est enregistré automatiquement et reste modifiable.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => newContract()}
            className="min-h-10 inline-flex items-center gap-2 px-3 rounded-xl border border-slate-700 text-slate-200 hover:bg-slate-800 text-xs font-semibold cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            Nouveau contrat
          </button>
          <button
            type="button"
            onClick={exportPdf}
            disabled={!canExport}
            className="min-h-10 inline-flex items-center gap-2 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-bold shadow-lg shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {exporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {progress ? `${progress.percent}%` : '…'}
              </>
            ) : done ? (
              <>
                <CheckCircle className="w-4 h-4" />
                Téléchargé
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Télécharger le PDF
              </>
            )}
          </button>
        </div>
      </div>

      {!agency.name.trim() && (
        <div className="flex items-start gap-2 text-xs text-sky-200 bg-sky-500/10 border border-sky-500/30 rounded-xl px-3 py-2">
          <Info className="w-4 h-4 mt-0.5 shrink-0" />
          Commencez par le nom de l’agence : c’est le seul champ obligatoire. Les autres champs laissés vides restent vides sur le contrat.
        </div>
      )}

      {error && (
        <div role="alert" className="flex items-start gap-2 text-xs text-rose-200 bg-rose-500/10 border border-rose-500/40 rounded-xl px-3 py-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-rose-400" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={exportPdf} className="font-bold underline cursor-pointer">
            Réessayer
          </button>
        </div>
      )}

      {isIos && readyPdf && (
        <div className="rounded-2xl border border-emerald-500/40 bg-slate-900 p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            PDF prêt : {readyPdf.filename}
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={sharePdf}
              className="min-h-11 inline-flex items-center justify-center gap-2 px-4 rounded-xl bg-amber-500 text-slate-950 text-sm font-bold cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
              Partager / Enregistrer
            </button>
            <a
              href={readyPdf.blobUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-11 inline-flex items-center justify-center gap-2 px-4 rounded-xl border border-slate-600 text-slate-100 text-sm font-semibold"
            >
              <ExternalLink className="w-4 h-4 text-sky-400" />
              Ouvrir le PDF
            </a>
          </div>
          {shareNote && <p className="text-[11px] text-amber-300">{shareNote}</p>}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-5 items-start">
        {/* ------------------------------------------------------------------ FORMULAIRE */}
        <div className="space-y-4 min-w-0">
          <Card
            title={`Contrats enregistrés (${contracts.length})`}
            icon={<FileText className="w-4 h-4 text-amber-400" />}
            aside={
              <div className="flex items-center gap-2">
                <span
                  role="status"
                  className={`inline-flex items-center gap-1 text-[11px] ${
                    cSync.state === 'error' ? 'text-amber-300' : cSync.state === 'saved' ? 'text-emerald-400' : 'text-slate-400'
                  }`}
                >
                  {cSync.state === 'error' ? <CloudOff className="w-3.5 h-3.5" /> : <Cloud className="w-3.5 h-3.5" />}
                  {cSync.state === 'idle' && 'Contrat non enregistré'}
                  {cSync.state === 'pending' && 'Modifications en attente…'}
                  {cSync.state === 'saving' && 'Enregistrement…'}
                  {cSync.state === 'saved' && 'Contrat enregistré ✓'}
                  {cSync.state === 'error' && 'Non enregistré'}
                </span>
                <button
                  type="button"
                  onClick={() => void saveContract()}
                  disabled={cSync.state === 'saving'}
                  className="inline-flex items-center gap-1 min-h-8 px-2.5 rounded-lg border border-sky-500/50 text-sky-200 hover:bg-sky-500/10 text-[11px] font-semibold disabled:opacity-50 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  Enregistrer
                </button>
              </div>
            }
          >
            {cSync.state === 'error' && <p className="text-[11px] text-amber-300">{cSync.message}</p>}
            {contracts.length === 0 ? (
              <p className="text-[11px] text-slate-500">
                Aucun contrat enregistré. Le contrat en cours s’enregistre dès que vous saisissez le client ou le véhicule.
              </p>
            ) : (
              <ul className="space-y-1.5 max-h-64 overflow-y-auto">
                {contracts.map((c) => {
                  const f = c.form;
                  const client = [f?.client?.firstName, f?.client?.lastName].filter(Boolean).join(' ') || 'Client non renseigné';
                  const car = [f?.vehicle?.brand, f?.vehicle?.model, f?.vehicle?.plate].filter(Boolean).join(' ');
                  const current = c.id === contractId;
                  return (
                    <li
                      key={c.id}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${
                        current ? 'border-amber-500/60 bg-amber-500/5' : 'border-slate-800 bg-slate-950/40'
                      }`}
                    >
                      <button type="button" onClick={() => openContract(c)} className="flex-1 min-w-0 text-left cursor-pointer">
                        <span className="block text-xs font-semibold text-slate-100 truncate">
                          {f?.contractNumber || '—'} · {client}
                        </span>
                        <span className="block text-[10px] text-slate-500 truncate">
                          {c.partnerAgencyName || 'Agence'}
                          {car ? ` · ${car}` : ''}
                          {f?.startDate ? ` · ${f.startDate}` : ''}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => openContract(c)}
                        className="text-[11px] font-semibold text-sky-300 hover:text-sky-200 cursor-pointer"
                      >
                        {current ? 'En cours' : 'Modifier'}
                      </button>
                      <button
                        type="button"
                        aria-label="Supprimer ce contrat"
                        onClick={() => {
                          if (window.confirm(`Supprimer le contrat ${f?.contractNumber || ''} ?`)) void removeContract(c.id);
                        }}
                        className="text-slate-500 hover:text-rose-300 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card
            title="L’agence"
            icon={<Building2 className="w-4 h-4 text-sky-400" />}
            aside={
              <div className="flex items-center gap-3">
                <span
                  role="status"
                  className={`inline-flex items-center gap-1 text-[11px] ${
                    sync.state === 'error' ? 'text-amber-300' : sync.state === 'saved' ? 'text-emerald-400' : 'text-slate-400'
                  }`}
                >
                  {sync.state === 'error' ? <CloudOff className="w-3.5 h-3.5" /> : <Cloud className="w-3.5 h-3.5" />}
                  {sync.state === 'loading' && 'Chargement…'}
                  {sync.state === 'pending' && 'Modifications en attente…'}
                  {sync.state === 'saving' && 'Enregistrement…'}
                  {sync.state === 'saved' && 'Enregistré ✓'}
                  {sync.state === 'error' && 'Non enregistré sur le serveur'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    dirtyRef.current.add(store.activeId);
                    void flushSave();
                  }}
                  disabled={sync.state === 'saving' || sync.state === 'loading'}
                  className="inline-flex items-center gap-1 min-h-8 px-2.5 rounded-lg border border-sky-500/50 text-sky-200 hover:bg-sky-500/10 text-[11px] font-semibold disabled:opacity-50 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  Enregistrer
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Supprimer l’agence « ${agency.name.trim() || 'sans nom'} » ?`)) void deleteAgency();
                  }}
                  className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-rose-300 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Supprimer
                </button>
              </div>
            }
          >
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Agences enregistrées">
              {store.list.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  role="tab"
                  aria-selected={a.id === agency.id}
                  onClick={() => selectAgency(a.id)}
                  className={`min-h-9 px-3 rounded-full border text-xs font-semibold cursor-pointer ${
                    a.id === agency.id
                      ? 'bg-sky-500/20 border-sky-400/60 text-sky-200'
                      : 'border-slate-700 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {a.name.trim() || 'Nouvelle agence'}
                </button>
              ))}
              <button
                type="button"
                onClick={addAgency}
                className="min-h-9 px-3 rounded-full border border-dashed border-slate-600 text-xs font-semibold text-slate-300 hover:bg-slate-800 cursor-pointer"
              >
                + Nouvelle agence
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Nom de l’agence *" className="sm:col-span-2">
                <TextInput
                  value={agency.name}
                  onChange={(v) => setAgencyField({ name: v })}
                  placeholder="Ex. Alaylichi Car"
                  autoComplete="off"
                />
              </Field>

              <div className="sm:col-span-2">
                <span className="block text-[11px] font-semibold text-slate-400 mb-1">Logo (facultatif)</span>
                <div className="flex items-center gap-3">
                  <div className="w-24 h-14 rounded-lg border border-dashed border-slate-700 bg-white flex items-center justify-center overflow-hidden">
                    {agency.logo ? (
                      <img src={agency.logo} alt="Logo de l’agence" className="max-w-full max-h-full object-contain" />
                    ) : (
                      <ImagePlus className="w-5 h-5 text-slate-400" />
                    )}
                  </div>
                  <label className="min-h-10 inline-flex items-center px-3 rounded-lg border border-slate-700 text-xs font-semibold text-slate-200 hover:bg-slate-800 cursor-pointer">
                    {agency.logo ? 'Changer le logo' : 'Choisir un logo'}
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(e) => {
                        void onLogoPicked(e.target.files?.[0]);
                        e.target.value = '';
                      }}
                    />
                  </label>
                  {agency.logo && (
                    <button
                      type="button"
                      onClick={() => setAgencyField({ logo: '' })}
                      className="text-[11px] text-slate-400 hover:text-rose-300 cursor-pointer"
                    >
                      Retirer
                    </button>
                  )}
                </div>
                <span className="block text-[10px] text-slate-500 mt-1">Sans logo, le nom de l’agence est imprimé à la place.</span>
                {logoError && <span className="block text-[11px] text-rose-300 mt-1">{logoError}</span>}
              </div>

              <Field label="Ville">
                <TextInput value={agency.city} onChange={(v) => setAgencyField({ city: v })} placeholder="Casablanca" autoComplete="off" />
              </Field>
              <Field label="Mention légale (facultatif)" hint="Ex. SARL au capital de 100 000 MAD">
                <TextInput value={agency.legalLine} onChange={(v) => setAgencyField({ legalLine: v })} autoComplete="off" />
              </Field>
              <Field label="Adresse du siège" className="sm:col-span-2">
                <TextInput value={agency.address} onChange={(v) => setAgencyField({ address: v })} autoComplete="off" />
              </Field>
              <Field label="Téléphone">
                <TextInput value={agency.phone1} onChange={(v) => setAgencyField({ phone1: v })} inputMode="tel" autoComplete="off" />
              </Field>
              <Field label="2ᵉ téléphone">
                <TextInput value={agency.phone2} onChange={(v) => setAgencyField({ phone2: v })} inputMode="tel" autoComplete="off" />
              </Field>
              <Field label="Assistance 24/7" hint="Par défaut : le téléphone de l’agence">
                <TextInput
                  value={agency.assistancePhone}
                  onChange={(v) => setAgencyField({ assistancePhone: v })}
                  inputMode="tel"
                  autoComplete="off"
                />
              </Field>
              <Field label="E-mail">
                <TextInput value={agency.email} onChange={(v) => setAgencyField({ email: v })} type="email" autoComplete="off" />
              </Field>
              <Field label="Site web">
                <TextInput value={agency.website} onChange={(v) => setAgencyField({ website: v })} autoComplete="off" />
              </Field>
              <Field label="IF">
                <TextInput value={agency.taxId} onChange={(v) => setAgencyField({ taxId: v })} autoComplete="off" />
              </Field>
              <Field label="RC">
                <TextInput value={agency.rc} onChange={(v) => setAgencyField({ rc: v })} autoComplete="off" />
              </Field>
              <Field label="ICE">
                <TextInput value={agency.ice} onChange={(v) => setAgencyField({ ice: v })} autoComplete="off" />
              </Field>
              <Field label="Patente">
                <TextInput value={agency.patente} onChange={(v) => setAgencyField({ patente: v })} autoComplete="off" />
              </Field>
            </div>
            {sync.state === 'error' && (
              <p className="text-[11px] text-amber-300">
                {sync.message} Vos modifications sont gardées sur cet appareil ; cliquez sur « Enregistrer » pour réessayer.
              </p>
            )}
            <p className="text-[10px] text-slate-500">
              Les agences sont enregistrées automatiquement (identité de l’agence). L’emplacement du cachet reste vide.
            </p>
          </Card>

          <Card title="Modèle de contrat" icon={<FileText className="w-4 h-4 text-amber-400" />}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Modèle">
                <select
                  value={form.templateId}
                  onChange={(e) => setFormField({ templateId: e.target.value as ContractTemplateId })}
                  className={inputClass}
                >
                  {CONTRACT_TEMPLATES.map((tmpl) => (
                    <option key={tmpl.id} value={tmpl.id}>
                      {tmpl.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="N° du contrat" hint="Généré automatiquement ; modifiable, ou vide pour un « — » à compléter à la main">
                <div className="flex gap-2">
                  <div className="flex-1 min-w-0">
                    <TextInput value={form.contractNumber} onChange={(v) => setFormField({ contractNumber: v })} autoComplete="off" />
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormField({ contractNumber: randomContractNumber() })}
                    className="shrink-0 min-h-10 px-3 rounded-lg border border-sky-500/50 text-sky-200 hover:bg-sky-500/10 text-xs font-semibold cursor-pointer"
                  >
                    Nouveau
                  </button>
                </div>
              </Field>
            </div>
          </Card>

          <Card title="Locataire">
            <PersonFields
              value={form.client}
              onChange={(next) => setFormField({ client: { ...form.client, ...next } })}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Nationalité">
                <TextInput
                  value={form.client.nationality}
                  onChange={(v) => setFormField({ client: { ...form.client, nationality: v } })}
                  autoComplete="off"
                />
              </Field>
              <Field label="E-mail">
                <TextInput
                  value={form.client.email}
                  onChange={(v) => setFormField({ client: { ...form.client, email: v } })}
                  type="email"
                  autoComplete="off"
                />
              </Field>
              <Field label="Adresse personnelle" className="sm:col-span-2">
                <TextInput
                  value={form.client.address}
                  onChange={(v) => setFormField({ client: { ...form.client, address: v } })}
                  autoComplete="off"
                />
              </Field>
            </div>

            <label className="flex items-center gap-2 text-xs font-semibold text-slate-200 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={form.hasSecondDriver}
                onChange={(e) => setFormField({ hasSecondDriver: e.target.checked })}
                className="w-4 h-4 accent-amber-500"
              />
              Ajouter un 2ᵉ conducteur
            </label>
            {form.hasSecondDriver && (
              <PersonFields value={form.second} onChange={(next) => setFormField({ second: next })} />
            )}
          </Card>

          <Card title="Véhicule">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Marque">
                <TextInput
                  value={form.vehicle.brand}
                  onChange={(v) => setFormField({ vehicle: { ...form.vehicle, brand: v } })}
                  placeholder="Hyundai"
                  autoComplete="off"
                />
              </Field>
              <Field label="Modèle">
                <TextInput
                  value={form.vehicle.model}
                  onChange={(v) => setFormField({ vehicle: { ...form.vehicle, model: v } })}
                  placeholder="Tucson"
                  autoComplete="off"
                />
              </Field>
              <Field label="Immatriculation">
                <TextInput
                  value={form.vehicle.plate}
                  onChange={(v) => setFormField({ vehicle: { ...form.vehicle, plate: v } })}
                  placeholder="52776 | A | 7"
                  autoComplete="off"
                />
              </Field>
              <Field label="Carburant">
                <select
                  value={form.vehicle.fuelType}
                  onChange={(e) => setFormField({ vehicle: { ...form.vehicle, fuelType: e.target.value as FuelType } })}
                  className={inputClass}
                >
                  {(['Diesel', 'Essence', 'Hybride', 'Électrique'] as FuelType[]).map((fuel) => (
                    <option key={fuel} value={fuel}>
                      {fuel}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Catégorie">
                <select
                  value={form.category}
                  onChange={(e) => setFormField({ category: e.target.value as VehicleCategory })}
                  className={inputClass}
                >
                  {VEHICLE_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Kilométrage au départ">
                <TextInput
                  value={form.departureKm}
                  onChange={(v) => setFormField({ departureKm: v })}
                  inputMode="numeric"
                  autoComplete="off"
                />
              </Field>
              <Field label="Niveau de carburant au départ">
                <select
                  value={form.departureFuel}
                  onChange={(e) => setFormField({ departureFuel: e.target.value })}
                  className={inputClass}
                >
                  {['8/8 (Plein)', '6/8', '4/8', '2/8', '1/8'].map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </Card>

          <Card title="Durée, caution & assurance">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Départ : date">
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setFormField({ startDate: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="Départ : heure">
                <input
                  type="time"
                  value={form.startTime}
                  onChange={(e) => setFormField({ startTime: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="Retour prévu : date">
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setFormField({ endDate: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="Retour prévu : heure">
                <input
                  type="time"
                  value={form.endTime}
                  onChange={(e) => setFormField({ endTime: e.target.value })}
                  className={inputClass}
                />
              </Field>
            </div>
            <p className="text-[11px] text-slate-400">
              Durée imprimée : <strong className="text-slate-200">{totalDays} jour(s)</strong>
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Caution (MAD)" hint="0 ou vide : « Aucun dépôt »">
                <TextInput
                  value={form.depositAmount}
                  onChange={(v) => setFormField({ depositAmount: v })}
                  inputMode="decimal"
                  autoComplete="off"
                />
              </Field>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-200 cursor-pointer sm:pt-6">
                <input
                  type="checkbox"
                  checked={form.depositCollected}
                  onChange={(e) => setFormField({ depositCollected: e.target.checked })}
                  className="w-4 h-4 accent-amber-500"
                />
                Caution déjà prise
              </label>
              <Field label="Formule d’assurance">
                <TextInput value={form.packLabel} onChange={(v) => setFormField({ packLabel: v })} autoComplete="off" />
              </Field>
              <Field label="Franchise : minimum (MAD)" hint="Vide : seul le pourcentage est imprimé">
                <TextInput
                  value={form.franchiseMad}
                  onChange={(v) => setFormField({ franchiseMad: v })}
                  inputMode="decimal"
                  autoComplete="off"
                />
              </Field>
              <Field label="Franchise : % des dégâts">
                <TextInput
                  value={form.franchisePercent}
                  onChange={(v) => setFormField({ franchisePercent: v })}
                  inputMode="decimal"
                  autoComplete="off"
                />
              </Field>
              <Field label="Responsable de l’agence (facultatif)">
                <TextInput value={form.managerName} onChange={(v) => setFormField({ managerName: v })} autoComplete="off" />
              </Field>
              <Field label="Couverture imprimée" className="sm:col-span-2">
                <TextInput value={form.coverage} onChange={(v) => setFormField({ coverage: v })} autoComplete="off" />
              </Field>
            </div>
          </Card>
        </div>

        {/* ------------------------------------------------------------------ APERÇU */}
        <div className="min-w-0 xl:sticky xl:top-20">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 sm:p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white">Aperçu du contrat (2 pages A4)</h3>
              <span className="text-[10px] text-slate-500">Cachet : emplacement vide</span>
            </div>
            <div ref={previewBoxRef} className="w-full overflow-hidden rounded-lg bg-slate-950">
              <div style={{ height: innerHeight ? innerHeight * scale : undefined }}>
                <div
                  ref={previewInnerRef}
                  style={{ width: A4_WIDTH_PX, transform: `scale(${scale})`, transformOrigin: 'top left' }}
                >
                  <PartnerAgencyProvider agency={preview.partner}>
                    <ContractPdfDocument
                      contract={preview.contract}
                      companySettings={preview.settings}
                      termsVersion={preview.terms}
                      templateId={deferredForm.templateId}
                      idPrefix="partner-preview"
                      layout="stacked"
                      showPageIndicator
                    />
                  </PartnerAgencyProvider>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PAGES A4 MASQUÉES : montées seulement pendant la génération du PDF */}
      {exportData && (
        <div
          id="partner-export-source"
          className="fixed top-0 start-0 pointer-events-none opacity-0 z-[-50]"
          style={{ width: '210mm' }}
          aria-hidden="true"
        >
          <PartnerAgencyProvider agency={exportData.partner}>
            <ContractPdfDocument
              contract={exportData.contract}
              companySettings={exportData.settings}
              termsVersion={exportData.terms}
              templateId={form.templateId}
              idPrefix={EXPORT_PREFIX}
              layout="stacked"
              showPageIndicator
            />
          </PartnerAgencyProvider>
        </div>
      )}
    </div>
  );
};
