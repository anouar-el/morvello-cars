import type { Client, Contract, DocumentType, PaymentMethod, Vehicle } from '../types';
import { getDepositCollectionStatus } from '../utils/depositUtils';
import { isVehicleAvailableForPeriod } from '../utils/vehicleStatusUtils';

/*
 * Actions que l'assistant PROPOSE. Il n'exécute jamais rien lui-même : la proposition devient une carte
 * dans la conversation et rien n'est écrit tant que l'utilisateur n'a pas cliqué sur « Confirmer ».
 * Les mêmes règles de validation servent deux fois : à la proposition (serveur) et juste avant
 * l'exécution (navigateur, sur les données du moment).
 */

export type AssistantActionType = 'whatsapp' | 'deposit_collected' | 'payment' | 'create_client' | 'create_contract';

/** Emplacement d'une photo sur la fiche client : CIN ou permis, recto ou verso. */
export type ClientPhotoSlot = 'cin' | 'cinVerso' | 'license' | 'licenseVerso';

/** Photo jointe au message (0 = première) et ce qu'elle montre. */
export interface ClientPhotoRef {
  index: number;
  slot: ClientPhotoSlot;
}

/** Fiche client telle que l'assistant l'a comprise ; créée seulement après confirmation. */
export interface ClientDraft {
  firstName: string;
  lastName: string;
  docType: DocumentType;
  docNumber: string;
  /** Fin de validité de la CIN / du passeport (AAAA-MM-JJ), vide si non lue. */
  docExpiryDate: string;
  drivingLicense: string;
  /** Fin de validité du permis (AAAA-MM-JJ), vide si non lue. */
  licenseExpiryDate: string;
  birthDate: string;
  /** Photos du message à ranger sur la fiche. */
  photos: ClientPhotoRef[];
  phone: string;
  email: string;
  address: string;
  country: string;
}

/** Contrat proposé : toujours créé en brouillon, sans signature ni photos. */
export interface ContractDraft {
  /** Nom ou téléphone du client, résolu sur les fiches existantes au moment de confirmer. */
  clientRef: string;
  vehicleId: string;
  vehicleLabel: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  pricePerDay: number;
  totalAmount: number;
  depositAmount: number;
  notes: string;
}

export interface AssistantAction {
  kind: 'action';
  id: string;
  type: AssistantActionType;
  contractId: string;
  contractNumber: string;
  /** create_client */
  client?: ClientDraft;
  /** create_contract */
  contract?: ContractDraft;
  /** Texte court affiché sur la carte. */
  title: string;
  /** whatsapp : numéro international sans « + », message prérempli. */
  phone?: string;
  message?: string;
  /** payment : montant et mode. */
  amount?: number;
  method?: PaymentMethod;
}

export const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'tpe_card', 'virement', 'cheque', 'autre'];
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Espèces',
  tpe_card: 'Carte (TPE)',
  virement: 'Virement',
  cheque: 'Chèque',
  autre: 'Autre',
};
export const MAX_WHATSAPP_CHARS = 1500;

/** Numéro marocain ou international → chiffres au format wa.me (212…). Null si inexploitable. */
export function toWhatsAppNumber(raw: unknown): string | null {
  let d = String(raw ?? '').replace(/\D/g, '');
  if (!d) return null;
  if (d.startsWith('00')) d = d.slice(2);
  else if (d.startsWith('0')) d = `212${d.slice(1)}`;
  else if (d.length === 9 && /^[5-7]/.test(d)) d = `212${d}`;
  return d.length >= 9 && d.length <= 15 ? d : null;
}

export function remainingOf(c: Partial<Contract>): number {
  if (c.remainingAmount !== undefined) return Math.max(0, Number(c.remainingAmount) || 0);
  const paid = c.paidAmount ?? (c.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
  return Math.max(0, (Number(c.totalAmount) || 0) - paid);
}

export interface Validation {
  ok: boolean;
  error?: string;
}

/** Données du moment, nécessaires pour valider une création (clients existants, disponibilité du véhicule). */
export interface ActionContext {
  clients?: Partial<Client>[];
  vehicles?: Partial<Vehicle>[];
  contracts?: Partial<Contract>[];
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function plain(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

function digitsKey(value: unknown): string {
  let d = String(value ?? '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('212')) d = d.slice(3);
  return d.replace(/^0+/, '');
}

function isoDay(value: unknown): string {
  const s = String(value ?? '').trim();
  return ISO_DAY.test(s) ? s : '';
}

function parseDocType(value: unknown): DocumentType {
  const v = plain(value);
  if (v.startsWith('pass')) return 'Passeport';
  if (v.includes('sejour')) return 'Carte de Séjour';
  return 'CIN';
}

/** Nombre de jours facturés : écart entre départ et retour, au minimum 1 (même règle que l'assistant de contrat). */
export function billedDays(startDate: string, endDate: string): number {
  const diff = Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`);
  return Math.max(1, Math.ceil(diff / 86_400_000) || 1);
}

/** « photo 1 = CIN recto, photo 2 = permis… » : au plus un emplacement par photo et une photo par emplacement. */
function parsePhotoRefs(raw: unknown, photoCount: number): ClientPhotoRef[] {
  if (!Array.isArray(raw) || photoCount <= 0) return [];
  const refs: ClientPhotoRef[] = [];
  for (const item of raw.slice(0, 4)) {
    const it = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const index = Math.round(Number(it.numero)) - 1;
    if (!Number.isInteger(index) || index < 0 || index >= photoCount) continue;
    const license = plain(it.type).startsWith('perm');
    const verso = plain(it.cote).startsWith('verso');
    const slot: ClientPhotoSlot = license ? (verso ? 'licenseVerso' : 'license') : verso ? 'cinVerso' : 'cin';
    if (refs.some((r) => r.index === index || r.slot === slot)) continue;
    refs.push({ index, slot });
  }
  return refs;
}

/** Nettoie ce que le modèle a extrait d'un message ; renvoie une erreur lisible plutôt qu'une fiche douteuse. */
export function normalizeClientDraft(
  raw: Record<string, unknown>,
  /** Nombre de photos jointes au message : les références à une photo inexistante sont écartées. */
  photoCount = 0
): { draft?: ClientDraft; error?: string } {
  const text = (v: unknown, max = 120) => String(v ?? '').trim().slice(0, max);
  const firstName = text(raw.prenom);
  const lastName = text(raw.nom);
  if (!firstName || !lastName) return { error: 'Le nom et le prénom du client sont obligatoires.' };

  const docNumber = text(raw.numero_document, 40).toUpperCase();
  if (!docNumber) return { error: "Le numéro de CIN ou de passeport est obligatoire : demande-le à l'utilisateur." };

  const phone = text(raw.telephone, 30);
  if (phone && !toWhatsAppNumber(phone)) return { error: 'Le numéro de téléphone est invalide.' };

  const birthRaw = text(raw.date_naissance, 10);
  if (birthRaw && !isoDay(birthRaw)) return { error: 'La date de naissance doit être au format AAAA-MM-JJ.' };

  const email = text(raw.email, 120);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "L'adresse e-mail est invalide." };

  const docExpiryDate = text(raw.expiration_document, 10);
  const licenseExpiryDate = text(raw.expiration_permis, 10);
  if ((docExpiryDate && !isoDay(docExpiryDate)) || (licenseExpiryDate && !isoDay(licenseExpiryDate))) {
    return { error: "Les dates de fin de validité doivent être au format AAAA-MM-JJ." };
  }

  return {
    draft: {
      firstName,
      lastName,
      docType: parseDocType(raw.type_document),
      docNumber,
      docExpiryDate,
      drivingLicense: text(raw.permis, 40),
      licenseExpiryDate,
      photos: parsePhotoRefs(raw.photos, photoCount),
      birthDate: birthRaw,
      phone,
      email,
      address: text(raw.adresse, 200),
      country: text(raw.pays, 60),
    },
  };
}

/** Clients dont le nom (mots dans n'importe quel ordre) ou le téléphone correspond à la saisie. */
export function findClientMatches(clients: Partial<Client>[], query: string): Partial<Client>[] {
  const q = plain(query);
  if (!q) return [];
  const wanted = digitsKey(query);
  const words = q.split(/\s+/).filter(Boolean);
  return clients.filter((c) => {
    if (wanted.length >= 6 && digitsKey(c.phone).includes(wanted)) return true;
    const hay = `${plain(c.firstName)} ${plain(c.lastName)}`;
    return words.every((w) => hay.includes(w));
  });
}

/** Un client déjà enregistré avec le même document ou le même téléphone : on ne crée pas de doublon. */
export function findDuplicateClient(clients: Partial<Client>[], draft: ClientDraft): Partial<Client> | undefined {
  const doc = plain(draft.docNumber).replace(/\s+/g, '');
  const phone = digitsKey(draft.phone);
  return clients.find(
    (c) =>
      (doc && plain(c.docNumber).replace(/\s+/g, '') === doc) ||
      (phone.length >= 6 && digitsKey(c.phone) === phone)
  );
}

function clientName(c: Partial<Client>): string {
  return `${c.firstName || ''} ${c.lastName || ''}`.trim();
}

/** Résout le client d'un contrat : un seul candidat, sinon une erreur qui dit quoi faire. */
export function resolveContractClient(
  clients: Partial<Client>[],
  clientRef: string
): { client?: Partial<Client>; error?: string } {
  const matches = findClientMatches(clients, clientRef);
  if (matches.length === 1) return { client: matches[0] };
  if (matches.length === 0) {
    return { error: `Aucun client « ${clientRef} » : créez d’abord sa fiche (donnez-moi son nom, son CIN et son téléphone).` };
  }
  return {
    error: `Plusieurs clients correspondent à « ${clientRef} » (${matches.slice(0, 4).map(clientName).join(', ')}) : précisez le nom complet ou le téléphone.`,
  };
}

function validateCreation(action: AssistantAction, ctx: ActionContext | undefined): Validation {
  if (action.type === 'create_client') {
    const draft = action.client;
    if (!draft?.firstName || !draft.lastName || !draft.docNumber) return { ok: false, error: 'Fiche client incomplète.' };
    const duplicate = ctx?.clients ? findDuplicateClient(ctx.clients, draft) : undefined;
    return duplicate
      ? { ok: false, error: `Ce client existe déjà : ${clientName(duplicate)} (même CIN ou même téléphone).` }
      : { ok: true };
  }

  const draft = action.contract;
  if (!draft) return { ok: false, error: 'Contrat incomplet.' };
  if (!isoDay(draft.startDate) || !isoDay(draft.endDate)) return { ok: false, error: 'Dates invalides.' };
  if (draft.endDate < draft.startDate) return { ok: false, error: 'Le retour précède le départ.' };
  if (!(draft.pricePerDay > 0)) return { ok: false, error: 'Le tarif journalier est manquant.' };

  if (ctx?.clients) {
    const resolved = resolveContractClient(ctx.clients, draft.clientRef);
    if (resolved.error) return { ok: false, error: resolved.error };
  }
  if (ctx?.vehicles) {
    const vehicle = ctx.vehicles.find((v) => v.id === draft.vehicleId);
    if (!vehicle) return { ok: false, error: 'Véhicule introuvable.' };
    const availability = isVehicleAvailableForPeriod(
      draft.vehicleId,
      draft.startDate,
      draft.endDate,
      (ctx.contracts || []) as Contract[],
      vehicle as Vehicle
    );
    if (!availability.available) return { ok: false, error: availability.conflictReason || 'Véhicule indisponible.' };
  }
  return { ok: true };
}

/** Vérifie qu'une action est encore applicable aux données telles qu'elles sont maintenant. */
export function validateAction(
  action: AssistantAction,
  contract: Partial<Contract> | undefined,
  ctx?: ActionContext
): Validation {
  if (action.type === 'create_client' || action.type === 'create_contract') return validateCreation(action, ctx);
  if (!contract) return { ok: false, error: 'Contrat introuvable.' };
  if (contract.status === 'cancelled') return { ok: false, error: 'Ce contrat est annulé.' };

  switch (action.type) {
    case 'whatsapp':
      return action.phone && action.message?.trim()
        ? { ok: true }
        : { ok: false, error: 'Numéro ou message manquant.' };

    case 'deposit_collected':
      if (getDepositCollectionStatus(contract as Contract) !== 'not_collected') {
        return { ok: false, error: 'La caution est déjà prise ou aucune caution n’est prévue.' };
      }
      return { ok: true };

    case 'payment': {
      const amount = Number(action.amount);
      if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: 'Montant invalide.' };
      if (!action.method || !PAYMENT_METHODS.includes(action.method)) return { ok: false, error: 'Mode de paiement invalide.' };
      const remaining = remainingOf(contract);
      if (amount > remaining) {
        return { ok: false, error: `Le montant dépasse le reste à encaisser (${Math.round(remaining)} MAD).` };
      }
      return { ok: true };
    }

    default:
      return { ok: false, error: 'Action inconnue.' };
  }
}
