import { describe, it, expect } from 'vitest';
import { toWhatsAppNumber, validateAction, type AssistantAction } from './assistantActions';
import { executeAssistantTool } from './assistantTools';

describe('toWhatsAppNumber', () => {
  it('normalise les formats marocains et internationaux', () => {
    expect(toWhatsAppNumber('0661234567')).toBe('212661234567');
    expect(toWhatsAppNumber('+212 6 61 23 45 67')).toBe('212661234567');
    expect(toWhatsAppNumber('00212661234567')).toBe('212661234567');
    expect(toWhatsAppNumber('661234567')).toBe('212661234567');
    expect(toWhatsAppNumber('+33 6 12 34 56 78')).toBe('33612345678');
  });

  it('refuse un numéro inexploitable', () => {
    expect(toWhatsAppNumber('')).toBeNull();
    expect(toWhatsAppNumber('N/C')).toBeNull();
    expect(toWhatsAppNumber('123')).toBeNull();
  });
});

const base = (over: Partial<AssistantAction>): AssistantAction => ({
  kind: 'action',
  id: 'a1',
  type: 'payment',
  contractId: 'c1',
  contractNumber: 'MC-2026-0001',
  title: 't',
  ...over,
});

describe('validateAction', () => {
  const contract: any = { id: 'c1', status: 'active', totalAmount: 3000, paidAmount: 1000, depositAmount: 4000, depositCollected: false };

  it('accepte un règlement dans la limite du reste à encaisser', () => {
    expect(validateAction(base({ amount: 2000, method: 'cash' }), contract).ok).toBe(true);
  });

  it('refuse un règlement supérieur au reste, nul ou sans mode', () => {
    expect(validateAction(base({ amount: 2001, method: 'cash' }), contract).ok).toBe(false);
    expect(validateAction(base({ amount: 0, method: 'cash' }), contract).ok).toBe(false);
    expect(validateAction(base({ amount: 100 }), contract).ok).toBe(false);
  });

  it('refuse sur un contrat annulé ou introuvable', () => {
    expect(validateAction(base({ amount: 10, method: 'cash' }), { ...contract, status: 'cancelled' }).ok).toBe(false);
    expect(validateAction(base({ amount: 10, method: 'cash' }), undefined).ok).toBe(false);
  });

  it('caution : seulement si elle n\'est pas déjà prise', () => {
    expect(validateAction(base({ type: 'deposit_collected' }), contract).ok).toBe(true);
    expect(validateAction(base({ type: 'deposit_collected' }), { ...contract, depositCollected: true }).ok).toBe(false);
  });
});

describe('proposer_action', () => {
  const data: any = {
    vehicles: [],
    contracts: [
      {
        id: 'c1',
        contractNumber: 'MC-2026-0001',
        status: 'active',
        clientSnapshot: { firstName: 'Youssef', lastName: 'El Amrani', phone: '0661234567' },
        totalAmount: 3000,
        paidAmount: 1000,
        depositAmount: 4000,
        depositCollected: false,
      },
      { id: 'c2', contractNumber: 'MC-2026-0002', status: 'active', clientSnapshot: { firstName: 'X', lastName: 'Y', phone: '' }, totalAmount: 100, paidAmount: 0 },
    ],
  };

  it('prépare un WhatsApp vers le bon numéro, sans rien exécuter', () => {
    const out = executeAssistantTool('proposer_action', { type: 'whatsapp', contrat: 'mc-2026-0001', message: 'Bonjour' }, data);
    const action = out.sources[0] as AssistantAction;
    expect(action.kind).toBe('action');
    expect(action.phone).toBe('212661234567');
    expect(action.message).toBe('Bonjour');
  });

  it('refuse un WhatsApp si le client n\'a pas de numéro', () => {
    const out = executeAssistantTool('proposer_action', { type: 'whatsapp', contrat: 'MC-2026-0002', message: 'Salut' }, data);
    expect(out.result.erreur).toBeTruthy();
    expect(out.sources).toHaveLength(0);
  });

  it('refuse un règlement supérieur au solde ou sans mode', () => {
    expect(executeAssistantTool('proposer_action', { type: 'payment', contrat: 'MC-2026-0001', montant: 5000, mode: 'cash' }, data).sources).toHaveLength(0);
    expect(executeAssistantTool('proposer_action', { type: 'payment', contrat: 'MC-2026-0001', montant: 500 }, data).sources).toHaveLength(0);
  });

  it('propose un règlement valide et la prise de caution', () => {
    const pay = executeAssistantTool('proposer_action', { type: 'payment', contrat: 'MC-2026-0001', montant: 500, mode: 'virement' }, data);
    expect((pay.sources[0] as AssistantAction).amount).toBe(500);
    const dep = executeAssistantTool('proposer_action', { type: 'deposit_collected', contrat: 'MC-2026-0001' }, data);
    expect((dep.sources[0] as AssistantAction).type).toBe('deposit_collected');
  });

  it('refuse un contrat inconnu ou un type inconnu', () => {
    expect(executeAssistantTool('proposer_action', { type: 'payment', contrat: 'MC-9', montant: 1, mode: 'cash' }, data).sources).toHaveLength(0);
    expect(executeAssistantTool('proposer_action', { type: 'delete_all', contrat: 'MC-2026-0001' }, data).sources).toHaveLength(0);
  });
});
