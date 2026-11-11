import type { Client, Contract } from '../types';
import { getDaysDiff } from '../utils/vehicleExpiryUtils';

/*
 * Pièces des clients à surveiller : CIN / passeport et permis de conduire. On ne regarde que les clients
 * qui ont un contrat ouvert (en cours ou brouillon) : un permis périmé chez un ancien client sans location
 * à venir n'appelle aucune action et noierait les vraies alertes.
 */

export type ClientDocKind = 'identity' | 'license';

export type ClientDocStatus =
  /** Déjà périmée aujourd'hui. */
  | 'expired'
  /** Valable aujourd'hui, mais périme avant la fin de la location : le client roulerait sans pièce valide. */
  | 'expires_during_rental'
  /** Périme dans moins de 30 jours : à faire renouveler. */
  | 'expiring_soon';

export interface ClientDocIssue {
  client: Client;
  kind: ClientDocKind;
  status: ClientDocStatus;
  /** Fin de validité (AAAA-MM-JJ). */
  expiryDate: string;
  /** Jours avant l'échéance, négatif si dépassée. */
  daysRemaining: number;
  /** Contrat ouvert du client qui justifie l'alerte (celui qui se termine le plus tard). */
  contract: Contract;
}

export const CLIENT_DOC_WARNING_DAYS = 30;

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function effectiveEnd(contract: Contract): string {
  const end = contract.prolongation?.isActive && contract.prolongation.newEndDate ? contract.prolongation.newEndDate : contract.endDate;
  return String(end || '').slice(0, 10);
}

/** État d'une pièce à une date donnée ; `rentalEnd` (fin de la location) permet de repérer une pièce qui périme en cours de route. */
export function classifyClientDoc(
  rawExpiry: string | undefined,
  today: string,
  rentalEnd?: string
): { status: ClientDocStatus; expiryDate: string; daysRemaining: number } | null {
  const expiryDate = String(rawExpiry || '').trim();
  if (!ISO_DAY.test(expiryDate)) return null;
  const daysRemaining = getDaysDiff(expiryDate, today);
  if (daysRemaining === null) return null;

  if (daysRemaining < 0) return { status: 'expired', expiryDate, daysRemaining };
  if (rentalEnd && ISO_DAY.test(rentalEnd) && expiryDate < rentalEnd) return { status: 'expires_during_rental', expiryDate, daysRemaining };
  if (daysRemaining <= CLIENT_DOC_WARNING_DAYS) return { status: 'expiring_soon', expiryDate, daysRemaining };
  return null;
}

/** Pièces périmées, qui périment pendant la location ou dans les 30 jours, les plus urgentes d'abord. */
export function findClientDocIssues(clients: Client[], contracts: Contract[], today: string): ClientDocIssue[] {
  const openByClient = new Map<string, Contract>();
  for (const contract of contracts) {
    if (contract.status !== 'active' && contract.status !== 'draft') continue;
    const current = openByClient.get(contract.clientId);
    if (!current || effectiveEnd(contract) > effectiveEnd(current)) openByClient.set(contract.clientId, contract);
  }

  const issues: ClientDocIssue[] = [];
  for (const client of clients) {
    const contract = openByClient.get(client.id);
    if (!contract) continue;
    const rentalEnd = effectiveEnd(contract);

    const docs: Array<[ClientDocKind, string | undefined]> = [
      ['identity', client.docExpiryDate],
      ['license', client.licenseExpiryDate],
    ];
    for (const [kind, raw] of docs) {
      const found = classifyClientDoc(raw, today, rentalEnd);
      if (found) issues.push({ client, kind, contract, ...found });
    }
  }

  return issues.sort((a, b) => a.daysRemaining - b.daysRemaining);
}
