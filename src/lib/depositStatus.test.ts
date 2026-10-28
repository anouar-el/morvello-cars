import { describe, expect, it } from 'vitest';
import { mapDepositRow } from './rowMappers';
import { DB_DEPOSIT_STATUSES, APP_DEPOSIT_STATUSES, resolveAppDepositStatus, toDbDepositStatus, toRpcDeposit } from './depositStatus';

describe('toDbDepositStatus', () => {
  it("n'écrit jamais un mot que la contrainte de la base refuse", () => {
    for (const s of APP_DEPOSIT_STATUSES) expect(DB_DEPOSIT_STATUSES).toContain(toDbDepositStatus(s));
    for (const s of DB_DEPOSIT_STATUSES) expect(toDbDepositStatus(s)).toBe(s);
    expect(toDbDepositStatus('n importe quoi')).toBe('pending');
    expect(toDbDepositStatus(undefined)).toBe('pending');
  });

  it('traduit chaque statut de l’application', () => {
    expect(toDbDepositStatus('held')).toBe('collected');
    expect(toDbDepositStatus('released')).toBe('returned');
    expect(toDbDepositStatus('partially_deducted')).toBe('partially_returned');
    expect(toDbDepositStatus('fully_retained')).toBe('deducted');
  });
});

describe('resolveAppDepositStatus', () => {
  it('relit le statut de l’application, même quand la colonne porte le mot de la base', () => {
    expect(resolveAppDepositStatus('collected', { status: 'held' })).toBe('held');
    expect(resolveAppDepositStatus('pending', { status: 'held' })).toBe('held'); // anciennes lignes de la synchro globale
    expect(resolveAppDepositStatus('returned', { status: 'released' })).toBe('released');
  });

  it('lit appStatus des lignes créées par la fonction transactionnelle', () => {
    expect(resolveAppDepositStatus('collected', { status: 'collected', appStatus: 'held' })).toBe('held');
  });

  it("retombe sur la colonne quand le JSON ne dit rien d'utilisable", () => {
    expect(resolveAppDepositStatus('returned', {})).toBe('released');
    expect(resolveAppDepositStatus('deducted', null)).toBe('fully_retained');
    expect(resolveAppDepositStatus(null, undefined)).toBe('held');
  });
});

describe('toRpcDeposit', () => {
  it("met un mot accepté par la base dans status et garde l'original dans appStatus", () => {
    const out = toRpcDeposit({ id: 'dep-1', amount: 8000, status: 'held' });
    expect(out).toMatchObject({ id: 'dep-1', amount: 8000, status: 'collected', appStatus: 'held' });
  });
  it('laisse passer l’absence de caution', () => {
    expect(toRpcDeposit(null)).toBeNull();
  });
});

describe('mapDepositRow', () => {
  it('rend le statut de l’application pour une ligne lue en base', () => {
    const row = { id: 'dep-1', contract_id: 'c1', client_name: 'Carlo', amount: 8000, status: 'collected', data: { id: 'dep-1', status: 'held', method: 'preauth_card' } };
    expect(mapDepositRow(row).status).toBe('held');
    expect(mapDepositRow({ ...row, status: 'returned', data: { status: 'released' } }).status).toBe('released');
  });
});