import { describe, it, expect } from 'vitest';
import {
  planClientPropagation,
  planVehiclePropagation,
  isContractInScope,
  buildDepositClientPatch,
} from './snapshotPropagation';
import type { Contract, DepositRecord } from '../types';

const contract = (over: Partial<Contract>): Contract =>
  ({
    id: 'c1',
    contractNumber: 'N1',
    status: 'active',
    clientId: 'cli-1',
    vehicleId: 'veh-1',
    clientSnapshot: {
      id: 'cli-1',
      firstName: 'Karim',
      lastName: 'B',
      birthDate: '',
      drivingLicense: '',
      docType: 'CIN',
      docNumber: 'AB1',
      phone: '0600',
    },
    vehicleSnapshot: { id: 'veh-1', brand: 'Renault', model: 'Clio', plate: '1-A-1', fuelType: 'Diesel' },
    ...over,
  }) as Contract;

describe('portée de la répercussion', () => {
  it('open exclut les contrats clôturés, all les inclut, none n\'en touche aucun', () => {
    expect(isContractInScope(contract({ status: 'active' }), 'open')).toBe(true);
    expect(isContractInScope(contract({ status: 'completed' }), 'open')).toBe(false);
    expect(isContractInScope(contract({ status: 'completed' }), 'all')).toBe(true);
    expect(isContractInScope(contract({ status: 'active' }), 'none')).toBe(false);
  });
});

describe('planClientPropagation', () => {
  const contracts = [
    contract({ id: 'c1', status: 'active' }),
    contract({ id: 'c2', status: 'completed' }),
    contract({ id: 'c3', clientId: 'cli-2', clientSnapshot: { id: 'cli-2' } as any }),
  ];

  it('met à jour les contrats ouverts du client uniquement (scope open)', () => {
    const plan = planClientPropagation(contracts, 'cli-1', 'AB1', { phone: '0611' }, 'open');
    expect(plan.map((p) => p.contractId)).toEqual(['c1']);
    expect((plan[0].snapshot as any).phone).toBe('0611');
    expect((plan[0].snapshot as any).firstName).toBe('Karim');
  });

  it('inclut les contrats clôturés avec scope all', () => {
    const plan = planClientPropagation(contracts, 'cli-1', 'AB1', { phone: '0611' }, 'all');
    expect(plan.map((p) => p.contractId).sort()).toEqual(['c1', 'c2']);
  });

  it('ne fait rien avec scope none ou si rien n\'a changé', () => {
    expect(planClientPropagation(contracts, 'cli-1', 'AB1', { phone: '0611' }, 'none')).toEqual([]);
    expect(planClientPropagation(contracts, 'cli-1', 'AB1', { phone: '0600' }, 'all')).toEqual([]);
    expect(planClientPropagation(contracts, 'cli-1', 'AB1', { notes: 'x' }, 'all')).toEqual([]);
  });
});

describe('planVehiclePropagation', () => {
  it('répercute marque/modèle/plaque sur les contrats du véhicule', () => {
    const plan = planVehiclePropagation([contract({})], 'veh-1', { plate: '2-B-2' }, 'open');
    expect(plan).toHaveLength(1);
    expect((plan[0].snapshot as any).plate).toBe('2-B-2');
    expect((plan[0].snapshot as any).brand).toBe('Renault');
  });
});

describe('buildDepositClientPatch', () => {
  it('recompose le nom et le téléphone du client', () => {
    const dep = { clientName: 'Karim B' } as DepositRecord;
    expect(buildDepositClientPatch({ lastName: 'Benzema', phone: '0611' }, dep)).toEqual({
      clientName: 'Karim Benzema',
      clientPhone: '0611',
    });
  });
});
