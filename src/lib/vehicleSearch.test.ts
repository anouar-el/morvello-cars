import { describe, it, expect } from 'vitest';
import { countByStatus, matchesVehicleQuery, searchVehicles } from './vehicleSearch';

const v = (over: Record<string, any>): any => ({
  id: 'v1',
  brand: 'RENAULT',
  model: 'KARDIAN',
  plate: '52596-A-73',
  status: 'available',
  fuelType: 'Essence',
  assignedManagerName: 'Abdelkader Ouahib',
  ...over,
});

describe('matchesVehicleQuery', () => {
  it('retrouve une plaque quel que soit le séparateur', () => {
    const veh = v({});
    for (const q of ['52596', '52596 A 73', '52596-A-73', '52596|A|73', 'a 73', '52596a73']) {
      expect(matchesVehicleQuery(veh, q)).toBe(true);
    }
    expect(matchesVehicleQuery(veh, '99999')).toBe(false);
  });

  it('ignore casse et accents, et exige tous les mots', () => {
    const veh = v({ brand: 'CITROËN', model: 'C4X' });
    expect(matchesVehicleQuery(veh, 'citroen')).toBe(true);
    expect(matchesVehicleQuery(veh, 'citroen c4x')).toBe(true);
    expect(matchesVehicleQuery(veh, 'citroen kardian')).toBe(false);
  });

  it('cherche aussi par responsable et carburant', () => {
    const veh = v({});
    expect(matchesVehicleQuery(veh, 'ouahib')).toBe(true);
    expect(matchesVehicleQuery(veh, 'essence')).toBe(true);
  });

  it('une recherche vide laisse tout passer', () => {
    expect(matchesVehicleQuery(v({}), '   ')).toBe(true);
  });
});

describe('searchVehicles', () => {
  const list = [
    v({ id: 'a', brand: 'PEUGEOT', model: '208', plate: '46306-A-73', status: 'rented' }),
    v({ id: 'b', brand: 'PEUGEOT', model: '208', plate: '46307-A-73', status: 'available' }),
    v({ id: 'c', brand: 'CITROEN', model: 'C4X', plate: '53976-A-73', status: 'available' }),
    v({ id: 'd', brand: 'KIA', model: 'PICANTO', plate: '11111-A-73', status: 'maintenance' }),
  ];

  it('filtre par texte et met les disponibles en premier', () => {
    const out = searchVehicles(list, { query: 'peugeot', status: 'all' });
    expect(out.map((x) => x.id)).toEqual(['b', 'a']);
  });

  it('filtre par statut', () => {
    expect(searchVehicles(list, { query: '', status: 'available' }).map((x) => x.id)).toEqual(['b', 'c']);
    expect(searchVehicles(list, { query: '', status: 'unavailable' }).map((x) => x.id)).toEqual(['a', 'd']);
  });

  it('considère le véhicule du contrat édité comme disponible', () => {
    const out = searchVehicles(list, { query: '', status: 'available', currentVehicleId: 'a' });
    expect(out.map((x) => x.id)).toContain('a');
    expect(countByStatus(list, 'a')).toEqual({ all: 4, available: 3, unavailable: 1 });
  });
});
