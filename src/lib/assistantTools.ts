import type { Contract, Vehicle } from '../types';
import { VEHICLE_CATEGORIES, getVehicleCategory } from '../data/insurancePacks';
import { getDepositCollectionStatus } from '../utils/depositUtils';
import { effectiveReturn, todayInMorocco } from './aiAssistantContext';

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
}

export interface ToolOutcome {
  result: Record<string, unknown>;
  sources: AssistantSource[];
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

function remainingOf(c: Partial<Contract>): number {
  if (c.remainingAmount !== undefined) return Math.max(0, Number(c.remainingAmount) || 0);
  const paid = c.paidAmount ?? (c.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
  return Math.max(0, (Number(c.totalAmount) || 0) - paid);
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
      default:
        return { result: { erreur: `Outil inconnu : ${name}` }, sources: [] };
    }
  } catch {
    return { result: { erreur: "L'outil a échoué." }, sources: [] };
  }
}
