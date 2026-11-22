import { describe, expect, it } from 'vitest';
import { agencyFromRow, agencyToRow, type PartnerAgencyRecord } from './partnerAgencies';

const blank: PartnerAgencyRecord = {
  id: '', name: '', logo: '', city: '', legalLine: '', address: '', phone1: '', phone2: '',
  assistancePhone: '', email: '', website: '', taxId: '', rc: '', ice: '', patente: '',
};

describe('partnerAgencies', () => {
  it("range l'identité dans `data` et garde l'id à part", () => {
    const row = agencyToRow({ ...blank, id: 'alaylichi', name: 'Alaylichi Car', ice: '003271854000073' });
    expect(row.id).toBe('alaylichi');
    expect(row.data).toMatchObject({ name: 'Alaylichi Car', ice: '003271854000073' });
    expect(row.data).not.toHaveProperty('id');
  });

  it('relit une ligne en complétant les champs absents', () => {
    const agency = agencyFromRow({ id: 'x', data: { name: 'Agence X' } }, blank);
    expect(agency).toMatchObject({ id: 'x', name: 'Agence X', city: '', logo: '' });
  });

  it('tolère une ligne sans données', () => {
    expect(agencyFromRow({ id: 'y', data: null }, blank).id).toBe('y');
  });
});
