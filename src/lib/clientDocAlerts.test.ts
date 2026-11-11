import { describe, expect, it } from 'vitest';
import type { Client, Contract } from '../types';
import { findClientDocIssues } from './clientDocAlerts';
import { computeOperationalAlerts } from '../utils/alertsUtils';

const TODAY = '2026-11-11';

const client = (over: Partial<Client> = {}): Client =>
  ({ id: 'cl1', firstName: 'Karim', lastName: 'Alaoui', ...over }) as Client;

const contract = (over: Partial<Contract> = {}): Contract =>
  ({
    id: 'c1',
    contractNumber: 'MC-2026-0001',
    status: 'active',
    clientId: 'cl1',
    startDate: '2026-11-10',
    endDate: '2026-11-20',
    prolongation: { isActive: false, newEndDate: '', newEndTime: '' },
    ...over,
  }) as Contract;

describe('findClientDocIssues', () => {
  it('flags a licence that is already expired', () => {
    const [issue] = findClientDocIssues([client({ licenseExpiryDate: '2026-10-01' })], [contract()], TODAY);
    expect(issue).toMatchObject({ kind: 'license', status: 'expired', daysRemaining: -41 });
  });

  it('flags a document that expires before the rental ends, even if still valid today', () => {
    const [issue] = findClientDocIssues([client({ docExpiryDate: '2026-11-15' })], [contract()], TODAY);
    expect(issue).toMatchObject({ kind: 'identity', status: 'expires_during_rental', daysRemaining: 4 });
  });

  it('uses the prolonged end date of the contract', () => {
    const prolonged = contract({ prolongation: { isActive: true, newEndDate: '2026-12-10', newEndTime: '10:00' } });
    const [issue] = findClientDocIssues([client({ licenseExpiryDate: '2026-12-01' })], [prolonged], TODAY);
    expect(issue.status).toBe('expires_during_rental');
  });

  it('warns 30 days ahead, and stays quiet beyond', () => {
    const soon = findClientDocIssues([client({ licenseExpiryDate: '2026-12-05' })], [contract()], TODAY);
    expect(soon[0]).toMatchObject({ status: 'expiring_soon', daysRemaining: 24 });
    expect(findClientDocIssues([client({ licenseExpiryDate: '2027-03-01' })], [contract()], TODAY)).toEqual([]);
  });

  it('ignores clients without an open contract, missing or malformed dates', () => {
    const old = client({ licenseExpiryDate: '2020-01-01' });
    expect(findClientDocIssues([old], [contract({ status: 'completed' })], TODAY)).toEqual([]);
    expect(findClientDocIssues([old], [contract({ clientId: 'other' })], TODAY)).toEqual([]);
    expect(findClientDocIssues([client({ licenseExpiryDate: 'bientôt' })], [contract()], TODAY)).toEqual([]);
    expect(findClientDocIssues([client()], [contract()], TODAY)).toEqual([]);
  });

  it('also covers draft contracts and orders the most urgent first', () => {
    const issues = findClientDocIssues(
      [client({ docExpiryDate: '2026-12-01', licenseExpiryDate: '2026-11-01' })],
      [contract({ status: 'draft' })],
      TODAY
    );
    expect(issues.map((i) => i.kind)).toEqual(['license', 'identity']);
  });
});

describe('operational alerts for client documents', () => {
  it('turns an expired licence into a critical alert that opens the client', () => {
    const { alerts, criticalCount } = computeOperationalAlerts(
      [],
      [contract()],
      [],
      TODAY,
      [client({ licenseExpiryDate: '2026-10-01' })]
    );
    const alert = alerts.find((a) => a.category === 'client_doc_expired');
    expect(alert).toMatchObject({ severity: 'critical', targetTab: 'clients', entityId: 'cl1' });
    expect(alert?.title).toContain('Permis');
    expect(criticalCount).toBeGreaterThanOrEqual(1);
  });

  it('turns an approaching expiry into a warning', () => {
    const { alerts } = computeOperationalAlerts([], [contract()], [], TODAY, [client({ docExpiryDate: '2026-12-05' })]);
    expect(alerts.find((a) => a.category === 'client_doc_warning')).toMatchObject({ severity: 'warning' });
  });
});
