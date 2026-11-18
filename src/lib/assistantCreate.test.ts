import { describe, expect, it } from 'vitest';
import type { Client, Contract, Vehicle } from '../types';
import {
  billedDays,
  findClientMatches,
  findDuplicateClient,
  normalizeClientDraft,
  parseClockTime,
  parseRelativeDay,
  recomputeContractDraft,
  resolveContractClient,
  validateAction,
  type AssistantAction,
  type ClientDraft,
} from './assistantActions';
import { executeAssistantTool } from './assistantTools';
import { todayInMorocco } from './aiAssistantContext';
import { addDays } from './planning';
import { getPackTerms } from '../data/insurancePacks';

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

/** Jour relatif à aujourd'hui (heure du Maroc), pour que les tests ne vieillissent pas. */
const day = (offset: number) => addDays(todayInMorocco(), offset);

const busyContract = {
  id: 'cnt-1',
  contractNumber: 'MC-2026-0001',
  status: 'active',
  vehicleId: 'veh-1',
  startDate: day(3),
  endDate: day(7),
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

  it('refuses a contract when a draft or another booking blocks the vehicle', () => {
    const draftBooking = { ...busyContract, status: 'draft' } as Partial<Contract>;
    const out = executeAssistantTool(
      'creer_contrat',
      { client: 'Karim', plaque: '12345-A-1', date_debut: day(5), date_fin: day(9) },
      { vehicles: [clio], contracts: [draftBooking] }
    );
    expect(out.sources).toHaveLength(0);
    expect(String(out.result.erreur)).toContain('MC-2026-0001');
  });
});

describe('creer_contrat: understanding what the user said', () => {
  const dacia: Partial<Vehicle> = { id: 'veh-2', brand: 'Dacia', model: 'Logan', plate: '67890-B-6', color: 'blanche', status: 'available', dailyRate: 250 };
  const clioWhite: Partial<Vehicle> = { ...clio, color: 'blanche' };
  const clioBlack: Partial<Vehicle> = { ...clio, id: 'veh-3', plate: '11111-C-1', color: 'noire' };
  const fleet = [clioWhite, clioBlack, dacia];
  const contractOf = (out: ReturnType<typeof executeAssistantTool>) => (out.sources[0] as AssistantAction | undefined)?.contract;

  it('finds the vehicle from a plain description and the client from the list', () => {
    const out = executeAssistantTool(
      'creer_contrat',
      { client: 'karim alaoui', vehicule: 'la logan blanche', date_debut: 'demain', duree_jours: 3 },
      { vehicles: fleet, contracts: [], clients: [karim, sara] }
    );
    const draft = contractOf(out);
    expect(out.result.erreur).toBeUndefined();
    expect(draft).toMatchObject({ vehicleId: 'veh-2', clientId: 'cli-1', startDate: day(1), endDate: day(4), totalDays: 3 });
  });

  it('applies the contract wizard defaults: 10h to 18h, base pack, pack deposit and supplement in the total', () => {
    const draft = contractOf(
      executeAssistantTool('creer_contrat', { client: 'Karim', vehicule: '12345-A-1', date_debut: day(5), duree_jours: 2 }, { vehicles: [clioWhite], contracts: [], clients: [karim] })
    );
    const terms = getPackTerms('citadine', 'base');
    expect(draft).toMatchObject({ startTime: '10:00', endTime: '18:00', packId: 'base', depositAmount: terms.depositMad });
    expect(draft?.totalAmount).toBe(2 * (300 + terms.dailySupplementMad));
  });

  it('honours an explicit pack, deposit of zero and hours', () => {
    const draft = contractOf(
      executeAssistantTool(
        'creer_contrat',
        { client: 'Karim', vehicule: 'clio', date_debut: day(5), duree_jours: 1, pack: 'amélioré', caution: 0, heure_depart: '9h30' },
        { vehicles: [clioWhite], contracts: [], clients: [karim] }
      )
    );
    expect(draft).toMatchObject({ packId: 'ameliore', depositAmount: 0, startTime: '09:30' });
  });

  it('tells the model to create the client first, or to be precise when several match', () => {
    const base = { vehicule: 'clio', date_debut: day(5), duree_jours: 1 };
    const data = { vehicles: [clioWhite], contracts: [], clients: [karim, sara] };
    expect(String(executeAssistantTool('creer_contrat', { ...base, client: 'Omar' }, data).result.erreur)).toContain('créez d’abord');
    expect(String(executeAssistantTool('creer_contrat', { ...base, client: 'Alaoui' }, data).result.erreur)).toContain('Plusieurs clients');
  });

  it('picks the only free vehicle among several matches, otherwise lists the choices', () => {
    const busy = { ...busyContract, vehicleId: 'veh-1', startDate: day(4), endDate: day(8), status: 'draft' } as Partial<Contract>;
    const args = { client: 'Karim', vehicule: 'clio', date_debut: day(5), duree_jours: 2 };
    const picked = executeAssistantTool('creer_contrat', args, { vehicles: [clioWhite, clioBlack], contracts: [busy], clients: [karim] });
    expect(contractOf(picked)?.vehicleId).toBe('veh-3');
    expect(picked.result.vehicule_choisi_automatiquement).toBeDefined();

    const ambiguous = executeAssistantTool('creer_contrat', args, { vehicles: [clioWhite, clioBlack], contracts: [], clients: [karim] });
    expect(ambiguous.sources).toHaveLength(0);
    expect(ambiguous.result.choix).toHaveLength(2);
  });
});

describe('parseRelativeDay / parseClockTime', () => {
  const today = '2026-11-18'; // mercredi

  it('understands everyday wording', () => {
    expect(parseRelativeDay('2026-12-01', today)).toBe('2026-12-01');
    expect(parseRelativeDay("aujourd'hui", today)).toBe('2026-11-18');
    expect(parseRelativeDay('Demain', today)).toBe('2026-11-19');
    expect(parseRelativeDay('après-demain', today)).toBe('2026-11-20');
    expect(parseRelativeDay('dans 5 jours', today)).toBe('2026-11-23');
    expect(parseRelativeDay('vendredi', today)).toBe('2026-11-20');
    expect(parseRelativeDay('lundi prochain', today)).toBe('2026-11-23');
    expect(parseRelativeDay('mercredi', today)).toBe('2026-11-25'); // jamais aujourd'hui
    expect(parseRelativeDay('bientôt', today)).toBeNull();
    expect(parseRelativeDay('', today)).toBeNull();
  });

  it('reads clock times', () => {
    expect(parseClockTime('9h')).toBe('09:00');
    expect(parseClockTime('14h30')).toBe('14:30');
    expect(parseClockTime('08:15')).toBe('08:15');
    expect(parseClockTime('25h')).toBeNull();
    expect(parseClockTime('midi')).toBeNull();
  });
});

describe('recomputeContractDraft', () => {
  const draft = {
    clientRef: 'Karim', vehicleId: 'veh-1', vehicleLabel: 'Clio', startDate: '2026-12-01', endDate: '2026-12-04', totalDays: 3,
    pricePerDay: 300, totalAmount: 900, depositAmount: 1000, packId: 'base' as const, category: 'citadine' as const, notes: '',
  };

  it('recalculates days and total from the edited dates and price', () => {
    const out = recomputeContractDraft(draft, { endDate: '2026-12-06', pricePerDay: 350 });
    const supplement = getPackTerms('citadine', 'base').dailySupplementMad;
    expect(out).toMatchObject({ totalDays: 5, totalAmount: 5 * (350 + supplement) });
  });

  it('switching pack resets the deposit to the pack default unless it was edited too', () => {
    const terms = getPackTerms('citadine', 'confort');
    expect(recomputeContractDraft(draft, { packId: 'confort' }).depositAmount).toBe(terms.depositMad);
    expect(recomputeContractDraft(draft, { packId: 'confort', depositAmount: 777 }).depositAmount).toBe(777);
    expect(recomputeContractDraft(draft, { startTime: '08:00' }).depositAmount).toBe(1000);
  });

  it('keeps the previous day count when the edited dates are invalid', () => {
    expect(recomputeContractDraft(draft, { endDate: '2026-11-01' }).totalDays).toBe(3);
  });
});

describe('creer_contrat on a vehicle still shown as rented', () => {
  const ask = (contracts: Partial<Contract>[], from: number, to: number) =>
    executeAssistantTool(
      'creer_contrat',
      { client: 'Karim', plaque: '12345-A-1', date_debut: day(from), date_fin: day(to) },
      { vehicles: [{ ...clio, currentKm: 41_000 }], contracts }
    );
  const release = (out: ReturnType<typeof ask>) => (out.sources[0] as AssistantAction | undefined)?.contract?.release;

  it('offers to close an overdue contract whose return was never recorded', () => {
    const overdue = {
      ...busyContract,
      startDate: day(-10),
      endDate: day(-2),
      departureKm: 40_000,
      totalAmount: 2000,
      paidAmount: 1500,
      clientSnapshot: { firstName: 'Omar', lastName: 'Idrissi' },
    } as unknown as Partial<Contract>;
    const out = ask([overdue], 0, 3);
    expect(out.result.erreur).toBeUndefined();
    expect(release(out)).toMatchObject({
      contractId: 'cnt-1',
      overdue: true,
      returnKm: 41_000,
      unpaid: 500,
      clientName: 'IDRISSI Omar',
    });
  });

  it('offers it too when the running contract overlaps, flagging that the return is not due yet', () => {
    const running = { ...busyContract, startDate: day(-3), endDate: day(4) } as Partial<Contract>;
    expect(release(ask([running], 1, 5))).toMatchObject({ contractNumber: 'MC-2026-0001', overdue: false });
  });

  it('does not touch a contract that ends before the new one starts', () => {
    const later = { ...busyContract, startDate: day(-1), endDate: day(3) } as Partial<Contract>;
    const out = ask([later], 6, 9);
    expect(out.result.erreur).toBeUndefined();
    expect(release(out)).toBeUndefined();
  });

  it('validation ignores the contract being closed, and still refuses a second blocker', () => {
    const running = { ...busyContract, startDate: day(-3), endDate: day(4) } as Partial<Contract>;
    const action = ask([running], 1, 5).sources[0] as AssistantAction;
    const ctx = { vehicles: [clio], contracts: [running] };
    expect(validateAction(action, undefined, ctx).ok).toBe(true);
    const other = { ...busyContract, id: 'cnt-2', contractNumber: 'MC-2026-0002', status: 'draft', startDate: day(2), endDate: day(3) } as Partial<Contract>;
    expect(validateAction(action, undefined, { ...ctx, contracts: [running, other] }).ok).toBe(false);
  });
});

describe('creer_contrat / creer_client tools', () => {
  const data = { vehicles: [clio], contracts: [busyContract] };

  it('prepares a draft contract with the vehicle rate and computed total', () => {
    const out = executeAssistantTool(
      'creer_contrat',
      { client: 'Karim Alaoui', plaque: '12345 a 1', date_debut: day(20), date_fin: day(25), caution: 3000 },
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

  it('refuses without a price, with unreadable dates or an unknown vehicle', () => {
    const noRate = { vehicles: [{ ...clio, dailyRate: 0 }], contracts: [] };
    const base = { client: 'Karim', plaque: '12345-A-1', date_debut: '2026-12-01', date_fin: '2026-12-03' };
    expect(executeAssistantTool('creer_contrat', base, noRate).result.erreur).toContain('tarif');
    expect(executeAssistantTool('creer_contrat', { ...base, date_debut: 'bientôt' }, data).result.erreur).toContain('non comprise');
    expect(executeAssistantTool('creer_contrat', { ...base, plaque: '999' }, data).result.erreur).toContain('Aucun véhicule');
    expect(executeAssistantTool('creer_contrat', { ...base, date_fin: undefined }, data).result.erreur).toContain('Retour manquant');
  });

  it('prepares a client card only when the required fields are present', () => {
    const ok = executeAssistantTool('creer_client', draftArgs, data);
    expect((ok.sources[0] as AssistantAction).type).toBe('create_client');
    const missing = executeAssistantTool('creer_client', { prenom: 'Karim', nom: 'Alaoui' }, data);
    expect(missing.sources).toHaveLength(0);
  });
});
