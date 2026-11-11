import { describe, expect, it } from 'vitest';
import type { Client, Contract, Vehicle } from '../types';
import {
  billedDays,
  findClientMatches,
  findDuplicateClient,
  normalizeClientDraft,
  resolveContractClient,
  validateAction,
  type AssistantAction,
  type ClientDraft,
} from './assistantActions';
import { executeAssistantTool } from './assistantTools';

const karim: Partial<Client> = {
  id: 'cli-1',
  firstName: 'Karim',
  lastName: 'Alaoui',
  docNumber: 'AB 123456',
  phone: '0661234567',
};
const sara: Partial<Client> = { id: 'cli-2', firstName: 'Sara', lastName: 'Alaoui', docNumber: 'CD777', phone: '0670000000' };

const clio: Partial<Vehicle> = {
  id: 'veh-1',
  brand: 'Renault',
  model: 'Clio',
  plate: '12345-A-1',
  status: 'available',
  dailyRate: 300,
};

const busyContract = {
  id: 'cnt-1',
  contractNumber: 'MC-2026-0001',
  status: 'active',
  vehicleId: 'veh-1',
  startDate: '2026-11-18',
  endDate: '2026-11-22',
} as Partial<Contract>;

const draftArgs = {
  prenom: 'Karim',
  nom: 'Alaoui',
  numero_document: 'ab123456',
  telephone: '06 61 23 45 67',
};

describe('billedDays', () => {
  it('counts the gap between departure and return, at least one day', () => {
    expect(billedDays('2026-11-15', '2026-11-20')).toBe(5);
    expect(billedDays('2026-11-15', '2026-11-15')).toBe(1);
  });
});

describe('normalizeClientDraft', () => {
  it('builds a clean draft and upper-cases the document number', () => {
    const { draft, error } = normalizeClientDraft({ ...draftArgs, type_document: 'passeport' });
    expect(error).toBeUndefined();
    expect(draft).toMatchObject({ firstName: 'Karim', lastName: 'Alaoui', docNumber: 'AB123456', docType: 'Passeport' });
  });

  it('defaults to CIN when no document type is given', () => {
    expect(normalizeClientDraft(draftArgs).draft?.docType).toBe('CIN');
  });

  it.each([
    [{ ...draftArgs, nom: '' }, 'nom'],
    [{ ...draftArgs, numero_document: ' ' }, 'passeport'],
    [{ ...draftArgs, telephone: '12' }, 'téléphone'],
    [{ ...draftArgs, date_naissance: '12/03/1990' }, 'naissance'],
    [{ ...draftArgs, email: 'pas-un-email' }, 'mail'],
  ])('refuses incomplete or malformed input (%#)', (raw, word) => {
    const result = normalizeClientDraft(raw);
    expect(result.draft).toBeUndefined();
    expect(result.error?.toLowerCase()).toContain(word);
  });
});

describe('normalizeClientDraft: expiry dates and photos', () => {
  it('keeps the validity dates and refuses a malformed one', () => {
    const ok = normalizeClientDraft({ ...draftArgs, expiration_document: '2030-05-01', expiration_permis: '2028-01-31' });
    expect(ok.draft).toMatchObject({ docExpiryDate: '2030-05-01', licenseExpiryDate: '2028-01-31' });
    expect(normalizeClientDraft({ ...draftArgs, expiration_permis: '31/01/2028' }).error).toContain('AAAA-MM-JJ');
    expect(normalizeClientDraft(draftArgs).draft).toMatchObject({ docExpiryDate: '', licenseExpiryDate: '' });
  });

  it('maps each photo to its slot and drops unknown or duplicate ones', () => {
    const photos = [
      { numero: 1, type: 'cin', cote: 'recto' },
      { numero: 2, type: 'cin', cote: 'verso' },
      { numero: 3, type: 'permis', cote: 'recto' },
      { numero: 3, type: 'permis', cote: 'verso' }, // même photo : ignorée
      { numero: 9, type: 'cin', cote: 'recto' }, // n'existe pas
    ];
    expect(normalizeClientDraft({ ...draftArgs, photos }, 3).draft?.photos).toEqual([
      { index: 0, slot: 'cin' },
      { index: 1, slot: 'cinVerso' },
      { index: 2, slot: 'license' },
    ]);
  });

  it('ignores photo references when no photo was attached', () => {
    expect(normalizeClientDraft({ ...draftArgs, photos: [{ numero: 1, type: 'cin', cote: 'recto' }] }, 0).draft?.photos).toEqual([]);
  });

  it('the tool only keeps photo references that match the attached photos', () => {
    const photos = [{ numero: 1, type: 'permis', cote: 'recto' }];
    const withOne = executeAssistantTool('creer_client', { ...draftArgs, photos }, { vehicles: [], contracts: [], imageCount: 1 });
    expect((withOne.sources[0] as AssistantAction).client?.photos).toEqual([{ index: 0, slot: 'license' }]);
    const without = executeAssistantTool('creer_client', { ...draftArgs, photos }, { vehicles: [], contracts: [] });
    expect((without.sources[0] as AssistantAction).client?.photos).toEqual([]);
  });
});

describe('client lookup', () => {
  it('finds a client by name in any order or by phone in any format', () => {
    expect(findClientMatches([karim, sara], 'alaoui karim')).toEqual([karim]);
    expect(findClientMatches([karim, sara], '+212 661 234 567')).toEqual([karim]);
    expect(findClientMatches([karim, sara], 'Alaoui')).toHaveLength(2);
  });

  it('detects a duplicate on document or phone, ignoring spaces and case', () => {
    const base: ClientDraft = normalizeClientDraft({ ...draftArgs, telephone: '' }).draft!;
    expect(findDuplicateClient([karim], base)).toBe(karim);
    expect(findDuplicateClient([karim], { ...base, docNumber: 'ZZ1', phone: '+212661234567' })).toBe(karim);
    expect(findDuplicateClient([sara], base)).toBeUndefined();
  });

  it('asks to create the client when none matches, and to be precise when several do', () => {
    expect(resolveContractClient([karim, sara], 'Karim').client).toBe(karim);
    expect(resolveContractClient([karim, sara], 'Omar').error).toContain('créez d’abord');
    expect(resolveContractClient([karim, sara], 'Alaoui').error).toContain('Plusieurs clients');
  });
});

describe('validateAction for creations', () => {
  const clientAction = (draft: ClientDraft): AssistantAction => ({
    kind: 'action',
    id: 'a1',
    type: 'create_client',
    contractId: '',
    contractNumber: '',
    title: '',
    client: draft,
  });

  it('refuses to create a client that already exists', () => {
    const draft = normalizeClientDraft(draftArgs).draft!;
    expect(validateAction(clientAction(draft), undefined, { clients: [karim] }).ok).toBe(false);
    expect(validateAction(clientAction(draft), undefined, { clients: [sara] }).ok).toBe(true);
  });

  it('refuses a contract when the vehicle is busy on those dates', () => {
    const out = executeAssistantTool(
      'creer_contrat',
      { client: 'Karim', plaque: '12345-A-1', date_debut: '2026-11-20', date_fin: '2026-11-25' },
      { vehicles: [clio], contracts: [busyContract] }
    );
    expect(out.sources).toHaveLength(0);
    expect(String(out.result.erreur)).toContain('MC-2026-0001');
  });
});

describe('creer_contrat / creer_client tools', () => {
  const data = { vehicles: [clio], contracts: [busyContract] };

  it('prepares a draft contract with the vehicle rate and computed total', () => {
    const out = executeAssistantTool(
      'creer_contrat',
      { client: 'Karim Alaoui', plaque: '12345 a 1', date_debut: '2026-11-25', date_fin: '2026-11-30', caution: 3000 },
      data
    );
    const action = out.sources[0] as AssistantAction;
    expect(action.type).toBe('create_contract');
    expect(action.contract).toMatchObject({
      vehicleId: 'veh-1',
      totalDays: 5,
      pricePerDay: 300,
      totalAmount: 1500,
      depositAmount: 3000,
    });
  });

  it('refuses without a price, with bad dates or an unknown plate', () => {
    const noRate = { vehicles: [{ ...clio, dailyRate: 0 }], contracts: [] };
    const base = { client: 'Karim', plaque: '12345-A-1', date_debut: '2026-12-01', date_fin: '2026-12-03' };
    expect(executeAssistantTool('creer_contrat', base, noRate).result.erreur).toContain('tarif');
    expect(executeAssistantTool('creer_contrat', { ...base, date_debut: 'demain' }, data).result.erreur).toContain('Dates');
    expect(executeAssistantTool('creer_contrat', { ...base, plaque: '999' }, data).result.erreur).toContain('introuvable');
  });

  it('prepares a client card only when the required fields are present', () => {
    const ok = executeAssistantTool('creer_client', draftArgs, data);
    expect((ok.sources[0] as AssistantAction).type).toBe('create_client');
    const missing = executeAssistantTool('creer_client', { prenom: 'Karim', nom: 'Alaoui' }, data);
    expect(missing.sources).toHaveLength(0);
  });
});
