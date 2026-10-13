import { describe, it, expect } from 'vitest';
import { buildReminders, whatsAppLink } from './reminders';

// 13 octobre 2026, midi à Casablanca.
const NOW = new Date('2026-10-13T11:00:00Z');

const contract = (over: Record<string, any>): any => ({
  id: 'c1',
  contractNumber: 'MC-2026-0001',
  status: 'active',
  clientSnapshot: { firstName: 'Youssef', lastName: 'El Amrani', phone: '0661234567' },
  vehicleSnapshot: { brand: 'Dacia', model: 'Duster', plate: '12345-A-6' },
  startDate: '2026-10-08',
  endDate: '2026-10-15',
  endTime: '10:00',
  totalAmount: 3000,
  paidAmount: 3000,
  ...over,
});

describe('buildReminders', () => {
  it('détecte retard, retour du jour et retour du lendemain', () => {
    const list = buildReminders(NOW, [
      contract({ id: 'a', contractNumber: 'A', endDate: '2026-10-11' }),
      contract({ id: 'b', contractNumber: 'B', endDate: '2026-10-13' }),
      contract({ id: 'c', contractNumber: 'C', endDate: '2026-10-14' }),
      contract({ id: 'd', contractNumber: 'D', endDate: '2026-10-20' }),
    ]);
    expect(list.map((r) => [r.contractNumber, r.type])).toEqual([
      ['A', 'overdue'],
      ['B', 'return_today'],
      ['C', 'return_tomorrow'],
    ]);
    expect(list[0].daysLate).toBe(2);
  });

  it('tient compte de la prolongation accordée', () => {
    const list = buildReminders(NOW, [
      contract({ endDate: '2026-10-10', prolongation: { isActive: true, newEndDate: '2026-10-20' } }),
    ]);
    expect(list).toHaveLength(0);
  });

  it('relance le solde après restitution, pas pendant la location', () => {
    const list = buildReminders(NOW, [
      contract({ id: 'x', contractNumber: 'X', status: 'completed', endDate: '2026-10-05', paidAmount: 1000 }),
      contract({ id: 'y', contractNumber: 'Y', status: 'active', endDate: '2026-10-25', paidAmount: 1000 }),
    ]);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ type: 'balance_due', amount: 2000, daysLate: 8 });
    expect(list[0].message).toContain('2000 MAD');
  });

  it('ignore brouillons et contrats annulés', () => {
    const list = buildReminders(NOW, [
      contract({ status: 'draft', endDate: '2026-10-01' }),
      contract({ id: 'z', status: 'cancelled', endDate: '2026-10-01' }),
    ]);
    expect(list).toHaveLength(0);
  });

  it('prépare le message et le numéro, ou signale l\'absence de numéro', () => {
    const [r] = buildReminders(NOW, [contract({ endDate: '2026-10-11' })]);
    expect(r.phone).toBe('212661234567');
    expect(r.message).toContain('Bonjour Youssef');
    expect(r.message).toContain('MC-2026-0001');
    expect(whatsAppLink(r)).toMatch(/^https:\/\/wa\.me\/212661234567\?text=/);

    const [noPhone] = buildReminders(NOW, [
      contract({ endDate: '2026-10-11', clientSnapshot: { firstName: 'A', lastName: 'B', phone: '' } }),
    ]);
    expect(noPhone.phone).toBeNull();
    expect(whatsAppLink(noPhone)).toBeNull();
  });

  it('l\'identifiant change chaque jour (la relance réapparaît le lendemain)', () => {
    const c = contract({ endDate: '2026-10-11' });
    const d1 = buildReminders(NOW, [c])[0].id;
    const d2 = buildReminders(new Date('2026-10-14T11:00:00Z'), [c])[0].id;
    expect(d1).not.toBe(d2);
  });
});
