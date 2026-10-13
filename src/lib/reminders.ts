import type { Contract } from '../types';
import { effectiveReturn, todayInMorocco } from './aiAssistantContext';
import { remainingOf, toWhatsAppNumber } from './assistantActions';

/*
 * Relances clients calculées automatiquement à partir des contrats : retours en retard, retours du
 * jour et du lendemain, soldes impayés après restitution. Chaque relance vient avec un message
 * WhatsApp prêt à envoyer et le numéro normalisé. Rien n'est envoyé sans clic de l'utilisateur.
 */

export type ReminderType = 'overdue' | 'balance_due' | 'return_today' | 'return_tomorrow';

export interface Reminder {
  /** Stable pour un jour donné : permet de mémoriser « déjà relancé » et de revoir la relance le lendemain. */
  id: string;
  type: ReminderType;
  contractId: string;
  contractNumber: string;
  clientName: string;
  vehicleLabel: string;
  /** Retard en jours (overdue) ou jours depuis la restitution (balance_due). */
  daysLate: number;
  amount: number;
  dueDate: string;
  phone: string | null;
  message: string;
}

export const REMINDER_LABELS: Record<ReminderType, string> = {
  overdue: 'Retour en retard',
  balance_due: 'Solde à régler',
  return_today: 'Retour aujourd’hui',
  return_tomorrow: 'Retour demain',
};

const ORDER: Record<ReminderType, number> = { overdue: 0, balance_due: 1, return_today: 2, return_tomorrow: 3 };

function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(`${fromIso.slice(0, 10)}T00:00:00Z`);
  const to = Date.parse(`${toIso.slice(0, 10)}T00:00:00Z`);
  return Math.round((to - from) / 86_400_000);
}

function frDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

function buildMessage(type: ReminderType, c: Partial<Contract>, vehicle: string, dueDate: string, amount: number, time: string): string {
  const first = (c.clientSnapshot?.firstName || '').trim();
  const hello = first ? `Bonjour ${first},` : 'Bonjour,';
  const ref = `contrat ${c.contractNumber}`;
  const sign = 'Cordialement,\nMorvello Cars';

  switch (type) {
    case 'overdue':
      return `${hello}\nSauf erreur de notre part, le véhicule ${vehicle} (${ref}) devait nous être restitué le ${frDate(dueDate)}. Pourriez-vous nous indiquer à quelle heure vous pouvez le ramener ? Merci de votre retour.\n${sign}`;
    case 'balance_due':
      return `${hello}\nNous vous remercions pour votre location (${ref}, ${vehicle}). Il reste un solde de ${Math.round(amount)} MAD à régler. Pourriez-vous nous confirmer la date de règlement ? Merci.\n${sign}`;
    case 'return_today':
      return `${hello}\nPetit rappel : la restitution du véhicule ${vehicle} (${ref}) est prévue aujourd’hui${time ? ` à ${time}` : ''}, avec le carburant à l’identique. Merci et bonne journée.\n${sign}`;
    default:
      return `${hello}\nPetit rappel : la restitution du véhicule ${vehicle} (${ref}) est prévue demain${time ? ` à ${time}` : ''}, avec le carburant à l’identique. Merci d’avance.\n${sign}`;
  }
}

/** Relances du jour, triées par urgence. */
export function buildReminders(now: Date, contracts: Partial<Contract>[]): Reminder[] {
  const today = todayInMorocco(now);
  const out: Reminder[] = [];

  for (const c of contracts) {
    if (!c.id || c.status === 'cancelled' || c.status === 'draft') continue;
    const v = c.vehicleSnapshot;
    const vehicle = v ? `${v.brand} ${v.model}`.trim() : 'véhicule';
    const clientName =
      `${(c.clientSnapshot?.lastName || '').toUpperCase()} ${c.clientSnapshot?.firstName || ''}`.trim() || 'Client';
    const phone = toWhatsAppNumber(c.clientSnapshot?.phone);
    const remaining = remainingOf(c);
    const ret = effectiveReturn(c);

    const push = (type: ReminderType, daysLate: number, amount: number, dueDate: string) => {
      out.push({
        id: `${type}:${c.id}:${today}`,
        type,
        contractId: c.id as string,
        contractNumber: String(c.contractNumber || ''),
        clientName,
        vehicleLabel: v ? `${vehicle} (${v.plate})` : vehicle,
        daysLate,
        amount,
        dueDate,
        phone,
        message: buildMessage(type, c, vehicle, dueDate, amount, ret.time),
      });
    };

    if (c.status === 'active' && ret.date) {
      const d = daysBetween(today, ret.date);
      if (d < 0) push('overdue', -d, remaining, ret.date);
      else if (d === 0) push('return_today', 0, remaining, ret.date);
      else if (d === 1) push('return_tomorrow', 0, remaining, ret.date);
    }

    if (c.status === 'completed' && remaining > 0) {
      const end = ret.date || c.returnDate || '';
      push('balance_due', end ? Math.max(0, daysBetween(end, today)) : 0, remaining, end);
    }
  }

  return out.sort(
    (a, b) =>
      ORDER[a.type] - ORDER[b.type] ||
      b.daysLate - a.daysLate ||
      b.amount - a.amount ||
      a.contractNumber.localeCompare(b.contractNumber)
  );
}

export function whatsAppLink(reminder: Reminder): string | null {
  return reminder.phone ? `https://wa.me/${reminder.phone}?text=${encodeURIComponent(reminder.message)}` : null;
}
