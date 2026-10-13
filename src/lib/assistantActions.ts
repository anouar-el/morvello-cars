import type { Contract, PaymentMethod } from '../types';
import { getDepositCollectionStatus } from '../utils/depositUtils';

/*
 * Actions que l'assistant PROPOSE. Il n'exécute jamais rien lui-même : la proposition devient une carte
 * dans la conversation et rien n'est écrit tant que l'utilisateur n'a pas cliqué sur « Confirmer ».
 * Les mêmes règles de validation servent deux fois : à la proposition (serveur) et juste avant
 * l'exécution (navigateur, sur les données du moment).
 */

export type AssistantActionType = 'whatsapp' | 'deposit_collected' | 'payment';

export interface AssistantAction {
  kind: 'action';
  id: string;
  type: AssistantActionType;
  contractId: string;
  contractNumber: string;
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

/** Vérifie qu'une action est encore applicable au contrat tel qu'il est maintenant. */
export function validateAction(action: AssistantAction, contract: Partial<Contract> | undefined): Validation {
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
