import type { Client, Contract, InsurancePackId, Vehicle } from '../types';
import { VEHICLE_CATEGORIES, getPackTerms, getVehicleCategory } from '../data/insurancePacks';
import { isVehicleAvailableForPeriod } from '../utils/vehicleStatusUtils';
import { addDays } from './planning';
import { getDepositCollectionStatus } from '../utils/depositUtils';
import { effectiveReturn, todayInMorocco } from './aiAssistantContext';
import {
  DEFAULT_END_TIME,
  DEFAULT_START_TIME,
  MAX_WHATSAPP_CHARS,
  PAYMENT_METHODS,
  normalizeClientDraft,
  parseClockTime,
  parseRelativeDay,
  recomputeContractDraft,
  remainingOf,
  resolveContractClient,
  toWhatsAppNumber,
  validateAction,
  type AssistantAction,
  type AssistantActionType,
} from './assistantActions';

/*
 * Outils que l'assistant peut appeler (function calling). Ils travaillent sur les données DÉJÀ
 * filtrées par la RLS / le cloisonnement du responsable : ils n'ouvrent donc aucun accès
 * supplémentaire, ils donnent seulement au modèle une recherche exacte (y compris dans l'historique
 * ancien, absent de l'invite) et des calculs déterministes. Chaque outil renvoie aussi des
 * « sources » (contrat, véhicule, client) que l'interface affiche comme liens.
 */

export type AssistantSourceKind = 'contract' | 'vehicle' | 'client';

export interface AssistantSource {
  kind: AssistantSourceKind;
  id: string;
  label: string;
  /** Texte à placer dans la recherche de la liste cible pour retrouver l'élément. */
  search: string;
}

export interface AssistantToolData {
  vehicles: Partial<Vehicle>[];
  contracts: Partial<Contract>[];
  /** Nombre de photos jointes au message en cours (pour rattacher les bonnes photos à la fiche client). */
  imageCount?: number;
  /** Fiches clients du périmètre de l'utilisateur, pour retrouver le client d'un contrat. Absent si illisibles. */
  clients?: Partial<Client>[];
}

export interface ToolOutcome {
  result: Record<string, unknown>;
  /** Éléments consultés (liens) et actions proposées (cartes à confirmer par l'utilisateur). */
  sources: (AssistantSource | AssistantAction)[];
}

/** Déclarations au format Gemini (functionDeclarations). */
export const ASSISTANT_TOOL_DECLARATIONS = [
  {
    name: 'chercher_contrat',
    description:
      "Recherche des contrats, y compris anciens ou clôturés, par numéro de contrat, nom ou téléphone du client, plaque ou modèle du véhicule. À utiliser dès qu'un contrat ou un client n'apparaît pas clairement dans les données fournies.",
    parameters: {
      type: 'OBJECT',
      properties: {
        requete: { type: 'STRING', description: 'Numéro de contrat, nom du client, téléphone ou plaque.' },
        statut: {
          type: 'STRING',
          description: "Filtre optionnel : 'active', 'draft', 'completed' ou 'cancelled'.",
        },
      },
      required: ['requete'],
    },
  },
  {
    name: 'vehicules_disponibles',
    description:
      'Liste les véhicules réellement libres sur une période (aucun contrat en cours ou réservé qui chevauche, hors maintenance), avec leur tarif. À utiliser pour toute question de disponibilité à des dates précises.',
    parameters: {
      type: 'OBJECT',
      properties: {
        date_debut: { type: 'STRING', description: 'Premier jour, format AAAA-MM-JJ.' },
        date_fin: { type: 'STRING', description: 'Dernier jour, format AAAA-MM-JJ (inclus).' },
        gamme: { type: 'STRING', description: 'Filtre optionnel sur la gamme (ex. économique, SUV, premium).' },
      },
      required: ['date_debut', 'date_fin'],
    },
  },
  {
    name: 'solde_client',
    description:
      "Calcule le total restant à encaisser pour un client, tous contrats confondus (hors annulés), avec le détail par contrat. Recherche par nom, prénom ou téléphone.",
    parameters: {
      type: 'OBJECT',
      properties: {
        requete: { type: 'STRING', description: 'Nom, prénom ou téléphone du client.' },
      },
      required: ['requete'],
    },
  },
  {
    name: 'proposer_action',
    description:
      "Propose une action à l'utilisateur, qui devra la confirmer lui-même : rien n'est exécuté par toi. Types : 'whatsapp' (message prêt à envoyer au client du contrat), 'deposit_collected' (marquer la caution comme prise), 'payment' (enregistrer un règlement reçu), 'activate_contract' (passer un contrat en brouillon à « actif »). N'appelle cet outil que si l'utilisateur le demande ou accepte ta proposition.",
    parameters: {
      type: 'OBJECT',
      properties: {
        type: { type: 'STRING', description: "'whatsapp', 'deposit_collected', 'payment' ou 'activate_contract'." },
        contrat: { type: 'STRING', description: 'Numéro du contrat concerné (ex. MC-2026-0044).' },
        message: { type: 'STRING', description: 'whatsapp : texte du message, prêt à envoyer.' },
        montant: { type: 'NUMBER', description: 'payment : montant en MAD.' },
        mode: { type: 'STRING', description: "payment : 'cash', 'tpe_card', 'virement', 'cheque' ou 'autre'." },
      },
      required: ['type', 'contrat'],
    },
  },
  {
    name: 'creer_client',
    description:
      "Prépare la création d'une fiche client à partir des informations données par l'utilisateur ; il la confirmera d'un clic, rien n'est créé par toi. À appeler quand l'utilisateur demande d'ajouter ou d'enregistrer un client. Le nom, le prénom et le numéro de CIN (ou passeport) sont obligatoires : s'ils manquent, demande-les au lieu d'inventer.",
    parameters: {
      type: 'OBJECT',
      properties: {
        prenom: { type: 'STRING', description: 'Prénom.' },
        nom: { type: 'STRING', description: 'Nom de famille.' },
        numero_document: { type: 'STRING', description: 'Numéro de CIN, de passeport ou de carte de séjour.' },
        type_document: { type: 'STRING', description: "'CIN' (par défaut), 'Passeport' ou 'Carte de Séjour'." },
        telephone: { type: 'STRING', description: 'Téléphone, tel que donné.' },
        permis: { type: 'STRING', description: 'Numéro de permis de conduire.' },
        date_naissance: { type: 'STRING', description: 'Format AAAA-MM-JJ.' },
        email: { type: 'STRING', description: 'Adresse e-mail.' },
        adresse: { type: 'STRING', description: 'Adresse.' },
        pays: { type: 'STRING', description: 'Pays ou nationalité.' },
        expiration_document: { type: 'STRING', description: "Fin de validité de la CIN ou du passeport (« valable jusqu'au »), format AAAA-MM-JJ." },
        expiration_permis: { type: 'STRING', description: 'Fin de validité du permis de conduire, format AAAA-MM-JJ.' },
        photos: {
          type: 'ARRAY',
          description:
            'Uniquement si des photos sont jointes : ce que montre chaque photo, pour la ranger sur la fiche. Une entrée par photo reconnue.',
          items: {
            type: 'OBJECT',
            properties: {
              numero: { type: 'INTEGER', description: 'Rang de la photo dans le message, en commençant à 1.' },
              type: { type: 'STRING', description: "'cin' (CIN ou passeport) ou 'permis'." },
              cote: { type: 'STRING', description: "'recto' ou 'verso'." },
            },
            required: ['numero', 'type', 'cote'],
          },
        },
      },
      required: ['prenom', 'nom', 'numero_document'],
    },
  },
  {
    name: 'creer_contrat',
    description:
      "Prépare un contrat de location, créé directement ACTIF, pour un client déjà enregistré, que l'utilisateur confirmera d'un clic ; rien n'est créé par toi. Vérifie la disponibilité du véhicule et calcule le total. Si le véhicule apparaît encore en location à cause d'un contrat dépassé ou qui chevauche, l'outil prépare lui-même la clôture de ce contrat (retour aujourd'hui) dans la même carte : ne demande rien de plus et n'appelle pas d'autre outil pour cela. Si le client n'existe pas encore, propose d'abord de le créer avec creer_client. Ne devine jamais le véhicule, les dates ou le tarif : demande-les s'ils manquent.",
    parameters: {
      type: 'OBJECT',
      properties: {
        client: { type: 'STRING', description: 'Nom complet ou téléphone du client, tel que dit par l\'utilisateur.' },
        vehicule: {
          type: 'STRING',
          description: "Plaque (même partielle) ou description libre : « clio blanche », « la Dacia ». Si plusieurs correspondent, l'outil choisit celui qui est libre ou liste les choix.",
        },
        date_debut: { type: 'STRING', description: "Départ : AAAA-MM-JJ, « aujourd'hui », « demain », « lundi »… Par défaut aujourd'hui." },
        date_fin: { type: 'STRING', description: 'Retour : AAAA-MM-JJ, « demain », « vendredi »… Inutile si duree_jours est donnée.' },
        duree_jours: { type: 'INTEGER', description: 'Nombre de jours de location (« pour 5 jours »), à la place de date_fin.' },
        heure_depart: { type: 'STRING', description: 'Ex. 09:00 ; par défaut 10:00.' },
        heure_retour: { type: 'STRING', description: 'Ex. 18:00 ; par défaut 18:00.' },
        tarif_journalier: { type: 'NUMBER', description: 'MAD par jour ; par défaut le tarif de la fiche véhicule.' },
        caution: { type: 'NUMBER', description: "Montant de la caution en MAD, 0 si aucune ; par défaut celle du pack d'assurance." },
        pack: { type: 'STRING', description: "Pack d'assurance : 'base' (défaut), 'ameliore' ou 'confort'." },
        notes: { type: 'STRING', description: 'Remarque libre à ajouter au contrat.' },
      },
      required: ['client', 'vehicule'],
    },
  },
] as const;

const MAX_RESULTS = 8;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function norm(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

function compact(value: unknown): string {
  return norm(value).replace(/[^a-z0-9]/g, '');
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}


function clientLabel(c: Partial<Contract>): string {
  return `${(c.clientSnapshot?.lastName || '').toUpperCase()} ${c.clientSnapshot?.firstName || ''}`.trim() || 'Client';
}

function vehicleText(c: Partial<Contract>): string {
  const v = c.vehicleSnapshot;
  return v ? `${v.brand} ${v.model}`.trim() : 'N/C';
}

function contractSource(c: Partial<Contract>): AssistantSource {
  return {
    kind: 'contract',
    id: String(c.id || c.contractNumber || ''),
    label: `${c.contractNumber} · ${clientLabel(c)}`,
    search: String(c.contractNumber || ''),
  };
}

function matchesClient(c: Partial<Contract>, query: string): boolean {
  const q = norm(query);
  const qc = compact(query);
  if (!q) return false;
  const s = c.clientSnapshot;
  const last = norm(s?.lastName);
  const first = norm(s?.firstName);
  const full1 = `${last} ${first}`.trim();
  const full2 = `${first} ${last}`.trim();
  if (full1.includes(q) || full2.includes(q)) return true;
  // Tous les mots de la requête doivent se retrouver dans le nom complet.
  const words = q.split(/\s+/).filter(Boolean);
  if (words.length > 1 && words.every((w) => full1.includes(w))) return true;
  const wanted = phoneKey(query);
  return wanted.length >= 6 && phoneKey(s?.phone).includes(wanted);
}

/** Chiffres seuls, sans indicatif : « +212 6 61… », « 00212661… » et « 0661… » donnent la même clé. */
function phoneKey(value: unknown): string {
  let d = String(value ?? '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('212')) d = d.slice(3);
  return d.replace(/^0+/, '');
}

function chercherContrat(args: Record<string, unknown>, data: AssistantToolData): ToolOutcome {
  const query = str(args.requete).trim();
  const status = str(args.statut).trim();
  if (!query) return { result: { erreur: 'Requête vide.' }, sources: [] };

  const q = norm(query);
  const qc = compact(query);
  const hits = data.contracts.filter((c) => {
    if (status && c.status !== status) return false;
    if (qc && compact(c.contractNumber).includes(qc)) return true;
    if (matchesClient(c, query)) return true;
    const plate = compact(c.vehicleSnapshot?.plate);
    if (qc.length >= 3 && plate && plate.includes(qc)) return true;
    return norm(vehicleText(c)).includes(q);
  });

  hits.sort((a, b) => str(b.startDate).localeCompare(str(a.startDate)));
  const shown = hits.slice(0, MAX_RESULTS);

  return {
    result: {
      total_trouves: hits.length,
      affiches: shown.length,
      contrats: shown.map((c) => {
        const ret = effectiveReturn(c);
        const deposit = getDepositCollectionStatus(c);
        return {
          numero: c.contractNumber,
          statut: c.status,
          client: clientLabel(c),
          telephone: c.clientSnapshot?.phone || 'N/C',
          vehicule: vehicleText(c),
          plaque: c.vehicleSnapshot?.plate || 'N/C',
          depart: c.startDate || 'N/C',
          retour: ret.date || 'N/C',
          prolonge: Boolean(c.prolongation?.isActive),
          total_mad: Math.round(Number(c.totalAmount) || 0),
          reste_a_encaisser_mad: Math.round(remainingOf(c)),
          caution: deposit === 'none' ? 'aucune' : `${Math.round(Number(c.depositAmount) || 0)} MAD (${deposit === 'collected' ? 'prise' : 'NON prise'})`,
        };
      }),
    },
    sources: shown.map(contractSource),
  };
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

function vehiculesDisponibles(args: Record<string, unknown>, data: AssistantToolData): ToolOutcome {
  const from = str(args.date_debut).trim();
  const to = str(args.date_fin).trim();
  if (!ISO_DATE.test(from) || !ISO_DATE.test(to)) {
    return { result: { erreur: 'Dates invalides : utiliser le format AAAA-MM-JJ.' }, sources: [] };
  }
  if (to < from) return { result: { erreur: 'La date de fin précède la date de début.' }, sources: [] };

  const gamme = norm(args.gamme);
  const open = data.contracts.filter((c) => c.status === 'active' || c.status === 'draft');

  const free: Partial<Vehicle>[] = [];
  const busy: { vehicule: string; libre_a_partir_du: string; contrat: string }[] = [];
  let unavailable = 0;

  for (const v of data.vehicles) {
    if (v.status === 'maintenance' || v.status === 'inactive') {
      unavailable += 1;
      continue;
    }
    if (gamme) {
      const cat = VEHICLE_CATEGORIES.find((c) => c.id === getVehicleCategory(v as Vehicle));
      const hay = norm(`${cat?.label || ''} ${cat?.id || ''}`);
      if (!hay.includes(gamme)) continue;
    }
    const plate = compact(v.plate);
    const conflicting = open.find((c) => {
      const same = (c.vehicleId && c.vehicleId === v.id) || (plate && compact(c.vehicleSnapshot?.plate) === plate);
      if (!same || !c.startDate) return false;
      const end = effectiveReturn(c).date || c.startDate;
      return overlaps(c.startDate.slice(0, 10), end.slice(0, 10), from, to);
    });
    if (conflicting) {
      busy.push({
        vehicule: `${v.brand} ${v.model} (${v.plate})`,
        libre_a_partir_du: effectiveReturn(conflicting).date || 'N/C',
        contrat: String(conflicting.contractNumber || ''),
      });
    } else {
      free.push(v);
    }
  }

  const shown = free.slice(0, 20);
  return {
    result: {
      periode: { du: from, au: to, aujourdhui: todayInMorocco() },
      disponibles_total: free.length,
      disponibles: shown.map((v) => ({
        id: v.id,
        vehicule: `${v.brand} ${v.model}`,
        plaque: v.plate,
        gamme: VEHICLE_CATEGORIES.find((c) => c.id === getVehicleCategory(v as Vehicle))?.label,
        carburant: v.fuelType,
        tarif_journalier_mad: v.dailyRate || null,
      })),
      occupes_sur_la_periode: busy.slice(0, 20),
      hors_service: unavailable,
    },
    sources: shown.map((v) => ({
      kind: 'vehicle' as const,
      id: String(v.id || v.plate || ''),
      label: `${v.brand} ${v.model} · ${v.plate}`,
      search: String(v.plate || ''),
    })),
  };
}

function soldeClient(args: Record<string, unknown>, data: AssistantToolData): ToolOutcome {
  const query = str(args.requete).trim();
  if (!query) return { result: { erreur: 'Requête vide.' }, sources: [] };

  const related = data.contracts.filter((c) => c.status !== 'cancelled' && matchesClient(c, query));
  const withBalance = related.filter((c) => remainingOf(c) > 0);
  const clients = new Set(related.map((c) => clientLabel(c)));
  const total = withBalance.reduce((s, c) => s + remainingOf(c), 0);

  const sources: AssistantSource[] = withBalance.slice(0, MAX_RESULTS).map(contractSource);
  const first = related[0];
  if (first && clients.size === 1) {
    sources.push({
      kind: 'client',
      id: String(first.clientId || clientLabel(first)),
      label: clientLabel(first),
      search: String(first.clientSnapshot?.lastName || ''),
    });
  }

  return {
    result: {
      clients_correspondants: Array.from(clients),
      ambigu: clients.size > 1,
      contrats_analyses: related.length,
      total_reste_a_encaisser_mad: Math.round(total),
      contrats_avec_solde: withBalance.slice(0, MAX_RESULTS).map((c) => ({
        numero: c.contractNumber,
        statut: c.status,
        client: clientLabel(c),
        reste_mad: Math.round(remainingOf(c)),
      })),
    },
    sources,
  };
}

function proposerAction(args: Record<string, unknown>, data: AssistantToolData): ToolOutcome {
  const type = str(args.type).trim() as AssistantActionType;
  const number = compact(args.contrat);
  const fail = (erreur: string): ToolOutcome => ({ result: { erreur }, sources: [] });

  if (!['whatsapp', 'deposit_collected', 'payment', 'activate_contract'].includes(type)) return fail("Type d'action inconnu.");
  const matches = data.contracts.filter((c) => compact(c.contractNumber) === number);
  if (matches.length !== 1) return fail(matches.length ? 'Plusieurs contrats portent ce numéro.' : 'Contrat introuvable.');
  const contract = matches[0];

  const action: AssistantAction = {
    kind: 'action',
    id: `act-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    contractId: String(contract.id || ''),
    contractNumber: String(contract.contractNumber || ''),
    title: '',
  };

  if (type === 'whatsapp') {
    const phone = toWhatsAppNumber(contract.clientSnapshot?.phone);
    const message = str(args.message).trim().slice(0, MAX_WHATSAPP_CHARS);
    if (!phone) return fail('Aucun numéro de téléphone exploitable pour ce client.');
    if (!message) return fail('Le message est vide.');
    action.phone = phone;
    action.message = message;
    action.title = `Envoyer un WhatsApp à ${clientLabel(contract)}`;
  } else if (type === 'activate_contract') {
    action.title = `Activer le contrat ${action.contractNumber} (${clientLabel(contract)}, ${vehicleText(contract)})`;
  } else if (type === 'deposit_collected') {
    action.title = `Marquer la caution prise (${Math.round(Number(contract.depositAmount) || 0)} MAD)`;
  } else {
    const amount = Math.round((Number(args.montant) || 0) * 100) / 100;
    const method = str(args.mode).trim() as AssistantAction['method'];
    if (!method || !PAYMENT_METHODS.includes(method)) return fail("Mode de paiement manquant ou invalide.");
    action.amount = amount;
    action.method = method;
    action.title = `Enregistrer un règlement de ${amount} MAD`;
  }

  const check = validateAction(action, contract, { vehicles: data.vehicles, contracts: data.contracts });
  if (!check.ok) return fail(check.error);

  return {
    result: {
      statut: 'proposition_affichee_a_utilisateur',
      note: "La carte est affichée ; l'utilisateur doit la confirmer. Ne dis jamais que l'action est faite.",
      action: action.title,
      contrat: action.contractNumber,
    },
    sources: [action],
  };
}

function newActionId(): string {
  return `act-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function proposition(action: AssistantAction, extra: Record<string, unknown> = {}): ToolOutcome {
  return {
    result: {
      ...extra,
      statut: 'proposition_affichee_a_utilisateur',
      note: "La carte est affichée ; l'utilisateur doit la confirmer. Ne dis jamais que c'est fait.",
      action: action.title,
      ...(action.contract?.release
        ? { cloture_prevue: `${action.contract.release.contractNumber} (${action.contract.release.clientName}), fin prévue ${action.contract.release.plannedEnd}` }
        : {}),
    },
    sources: [action],
  };
}

function creerClient(args: Record<string, unknown>, data: AssistantToolData): ToolOutcome {
  const { draft, error } = normalizeClientDraft(args, data.imageCount ?? 0);
  if (!draft) return { result: { erreur: error }, sources: [] };
  const action: AssistantAction = {
    kind: 'action',
    id: newActionId(),
    type: 'create_client',
    contractId: '',
    contractNumber: '',
    title: `Créer le client ${draft.firstName} ${draft.lastName.toUpperCase()}`,
    client: draft,
  };
  // Les doublons sont contrôlés par le navigateur au moment de confirmer, sur la liste complète des clients.
  return proposition(action);
}

const VEHICLE_QUERY_FILLER = new Set(['la', 'le', 'les', 'une', 'un', 'de', 'du', 'des', 'voiture', 'vehicule', 'auto', 'car', 'cette', 'ce']);

/** Véhicules désignés en langage courant : plaque exacte ou partielle, sinon mots du modèle, de la couleur, de l'année… */
function findVehicleCandidates(vehicles: Partial<Vehicle>[], query: string): Partial<Vehicle>[] {
  const q = compact(query);
  if (!q) return [];
  const exact = vehicles.filter((v) => compact(v.plate) === q);
  if (exact.length) return exact;
  const partial = q.length >= 3 ? vehicles.filter((v) => compact(v.plate).includes(q)) : [];
  if (partial.length) return partial;
  const words = norm(query)
    .split(/\s+/)
    .filter((w) => w.length > 1 && !VEHICLE_QUERY_FILLER.has(w));
  if (!words.length) return [];
  return vehicles.filter((v) => {
    const hay = norm(`${v.brand} ${v.model} ${v.color || ''} ${v.year || ''} ${v.fuelType || ''}`);
    return words.every((w) => hay.includes(w));
  });
}

function describeVehicle(v: Partial<Vehicle>): string {
  return `${v.brand} ${v.model}${v.color ? ` ${v.color}` : ''} (${v.plate})`;
}

function parsePack(value: unknown): InsurancePackId {
  const v = norm(value);
  if (v.startsWith('ame')) return 'ameliore';
  if (v.startsWith('conf')) return 'confort';
  return 'base';
}

function creerContrat(args: Record<string, unknown>, data: AssistantToolData): ToolOutcome {
  const fail = (erreur: string, extra: Record<string, unknown> = {}): ToolOutcome => ({ result: { erreur, ...extra }, sources: [] });
  const today = todayInMorocco();
  const clientRef = str(args.client).trim();
  const vehicleQuery = str(args.vehicule || args.plaque).trim();
  if (!clientRef) return fail('Client manquant.');
  if (!vehicleQuery) return fail('Véhicule manquant : demande lequel, ou propose ceux de vehicules_disponibles.');

  // Dates : départ = aujourd'hui par défaut ; retour = date donnée ou départ + durée.
  const startDate = args.date_debut ? parseRelativeDay(args.date_debut, today) : today;
  if (!startDate) return fail('Date de départ non comprise : la donner au format AAAA-MM-JJ.');
  const duration = Math.round(Number(args.duree_jours) || 0);
  const endDate = args.date_fin ? parseRelativeDay(args.date_fin, today) : duration > 0 ? addDays(startDate, duration) : null;
  if (!endDate) return fail('Retour manquant : demande la date de retour ou la durée de location.');
  if (endDate < startDate) return fail('Le retour précède le départ.');

  // Client : retrouvé dans la liste complète quand elle est disponible (un seul candidat, sinon l'erreur dit quoi faire).
  let client: Partial<Client> | undefined;
  if (data.clients) {
    const resolved = resolveContractClient(data.clients, clientRef);
    if (!resolved.client) return fail(resolved.error || 'Client introuvable.');
    client = resolved.client;
  }

  // Véhicule : plusieurs candidats → celui qui est libre sur la période s'il est seul, sinon on liste les choix.
  const candidates = findVehicleCandidates(data.vehicles, vehicleQuery);
  if (!candidates.length) {
    return fail(`Aucun véhicule ne correspond à « ${vehicleQuery} ».`, { piste: 'Appelle vehicules_disponibles pour proposer des choix.' });
  }
  let vehicle = candidates[0];
  let autoPicked = false;
  if (candidates.length > 1) {
    const free = candidates.filter(
      (v) => isVehicleAvailableForPeriod(String(v.id), startDate, endDate, data.contracts as Contract[], v as Vehicle).available
    );
    if (free.length !== 1) {
      return fail('Plusieurs véhicules correspondent : demande lequel.', {
        choix: (free.length ? free : candidates).slice(0, 6).map(describeVehicle),
        libres_sur_la_periode: free.length,
      });
    }
    vehicle = free[0];
    autoPicked = true;
  }
  const plate = compact(vehicle.plate);

  const pricePerDay = Math.round((Number(args.tarif_journalier) || Number(vehicle.dailyRate) || 0) * 100) / 100;
  if (!(pricePerDay > 0)) return fail("Aucun tarif journalier : demande-le à l'utilisateur.");

  // Mêmes valeurs par défaut que l'assistant de contrat : pack de base, caution du pack, 10 h → 18 h.
  const packId = parsePack(args.pack);
  const category = getVehicleCategory(vehicle as Vehicle);
  const cautionGiven = args.caution !== undefined && args.caution !== null && args.caution !== '';

  const action: AssistantAction = {
    kind: 'action',
    id: newActionId(),
    type: 'create_contract',
    contractId: '',
    contractNumber: '',
    title: `Créer le contrat (${vehicle.brand} ${vehicle.model}, ${startDate} → ${endDate})`,
    contract: recomputeContractDraft({
      clientRef,
      ...(client?.id ? { clientId: client.id, clientLabel: `${client.firstName || ''} ${client.lastName || ''}`.trim() } : {}),
      vehicleId: String(vehicle.id || ''),
      vehicleLabel: `${vehicle.brand} ${vehicle.model} · ${vehicle.plate}`,
      startDate,
      startTime: parseClockTime(args.heure_depart) ?? DEFAULT_START_TIME,
      endDate,
      endTime: parseClockTime(args.heure_retour) ?? DEFAULT_END_TIME,
      totalDays: 1,
      pricePerDay,
      totalAmount: 0,
      packId,
      category,
      depositAmount: cautionGiven ? Math.max(0, Math.round(Number(args.caution) || 0)) : getPackTerms(category, packId).depositMad,
      notes: str(args.notes).trim().slice(0, 300),
    }),
  };

  // Véhicule encore « en location » : si c'est un contrat dépassé (retour jamais saisi) ou qui chevauche la période,
  // on propose de le clôturer d'abord, ce qui libère le véhicule. Un brouillon, lui, n'est jamais clôturé à la place de l'utilisateur.
  const blocking = data.contracts.find(
    (c) =>
      c.status === 'active' &&
      ((c.vehicleId && c.vehicleId === vehicle.id) || (plate && compact(c.vehicleSnapshot?.plate) === plate))
  );
  if (blocking && action.contract) {
    const plannedEnd = (effectiveReturn(blocking).date || blocking.endDate || '').slice(0, 10);
    const overdue = Boolean(plannedEnd) && plannedEnd < todayInMorocco();
    const clashes = Boolean(plannedEnd) && overlaps(String(blocking.startDate || '').slice(0, 10), plannedEnd, startDate, endDate);
    if (overdue || clashes) {
      action.contract.release = {
        contractId: String(blocking.id || ''),
        contractNumber: String(blocking.contractNumber || ''),
        clientName: clientLabel(blocking),
        plannedEnd,
        overdue,
        returnKm: Math.max(Number(vehicle.currentKm) || 0, Number(blocking.departureKm) || 0),
        unpaid: Math.round(remainingOf(blocking)),
        depositHeld: getDepositCollectionStatus(blocking as Contract) === 'collected' ? Math.round(Number(blocking.depositAmount) || 0) : 0,
      };
      action.title = `Clôturer ${action.contract.release.contractNumber} puis créer le contrat (${vehicle.brand} ${vehicle.model}, ${startDate} → ${endDate})`;
    }
  }

  // Disponibilité du véhicule vérifiée ici (et revérifiée au clic) ; le client l'est aussi quand la liste est connue.
  const check = validateAction(action, undefined, { vehicles: data.vehicles, contracts: data.contracts, clients: data.clients });
  if (!check.ok) return fail(check.error || 'Contrat impossible.');
  return proposition(action, {
    ...(autoPicked ? { vehicule_choisi_automatiquement: `${describeVehicle(vehicle)}, seul libre sur la période` } : {}),
    total_mad: action.contract?.totalAmount,
    caution_mad: action.contract?.depositAmount,
  });
}

/** Exécute un outil demandé par le modèle. Un outil inconnu ou en échec renvoie une erreur lisible, jamais une exception. */
export function executeAssistantTool(name: string, args: unknown, data: AssistantToolData): ToolOutcome {
  const a = (args && typeof args === 'object' ? args : {}) as Record<string, unknown>;
  try {
    switch (name) {
      case 'chercher_contrat':
        return chercherContrat(a, data);
      case 'vehicules_disponibles':
        return vehiculesDisponibles(a, data);
      case 'solde_client':
        return soldeClient(a, data);
      case 'proposer_action':
        return proposerAction(a, data);
      case 'creer_client':
        return creerClient(a, data);
      case 'creer_contrat':
        return creerContrat(a, data);
      default:
        return { result: { erreur: `Outil inconnu : ${name}` }, sources: [] };
    }
  } catch {
    return { result: { erreur: "L'outil a échoué." }, sources: [] };
  }
}
