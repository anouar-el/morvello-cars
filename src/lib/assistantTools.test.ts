import { describe, it, expect } from 'vitest';
import { executeAssistantTool, type AssistantToolData } from './assistantTools';

const contract = (over: Record<string, any>) => ({
  id: 'c?',
  contractNumber: 'MC-2026-0001',
  status: 'active',
  vehicleId: 'v1',
  clientId: 'cli1',
  clientSnapshot: { firstName: 'Youssef', lastName: 'El Amrani', phone: '+212 6 61 23 45 67' },
  vehicleSnapshot: { brand: 'Dacia', model: 'Duster', plate: '12345-A-6' },
  startDate: '2026-10-10',
  endDate: '2026-10-15',
  totalAmount: 3000,
  paidAmount: 1000,
  ...over,
});

const data: AssistantToolData = {
  vehicles: [
    { id: 'v1', brand: 'Dacia', model: 'Duster', plate: '12345-A-6', status: 'rented', dailyRate: 500, fuelType: 'diesel' },
    { id: 'v2', brand: 'Renault', model: 'Clio', plate: '22222-B-1', status: 'available', dailyRate: 300, fuelType: 'essence' },
    { id: 'v3', brand: 'Kia', model: 'Picanto', plate: '33333-C-2', status: 'maintenance', dailyRate: 250, fuelType: 'essence' },
  ] as any,
  contracts: [
    contract({ id: 'c1' }),
    contract({
      id: 'c2',
      contractNumber: 'MC-2025-0900',
      status: 'completed',
      startDate: '2025-03-01',
      endDate: '2025-03-05',
      totalAmount: 2000,
      paidAmount: 2000,
    }),
    contract({
      id: 'c3',
      contractNumber: 'MC-2026-0044',
      clientSnapshot: { firstName: 'Sara', lastName: 'Bennani', phone: '0600000001' },
      vehicleId: 'v2',
      vehicleSnapshot: { brand: 'Renault', model: 'Clio', plate: '22222-B-1' },
      startDate: '2026-11-01',
      endDate: '2026-11-04',
      status: 'draft',
      totalAmount: 900,
      paidAmount: 0,
    }),
    contract({ id: 'c4', contractNumber: 'MC-2026-0050', status: 'cancelled', totalAmount: 5000, paidAmount: 0 }),
  ] as any,
};

describe('chercher_contrat', () => {
  it('retrouve un contrat ancien par numéro, sans tenir compte de la casse ni des espaces', () => {
    const out = executeAssistantTool('chercher_contrat', { requete: 'mc-2025-0900' }, data);
    expect((out.result.contrats as any[])[0].numero).toBe('MC-2025-0900');
    expect(out.sources[0]).toMatchObject({ kind: 'contract', search: 'MC-2025-0900' });
  });

  it('retrouve par nom (sans accent ni ordre) et par téléphone', () => {
    const byName = executeAssistantTool('chercher_contrat', { requete: 'youssef amrani' }, data);
    expect(byName.result.total_trouves).toBe(3);
    const byPhone = executeAssistantTool('chercher_contrat', { requete: '0661234567' }, data);
    expect(byPhone.result.total_trouves).toBe(3);
  });

  it('filtre par statut et par plaque', () => {
    const out = executeAssistantTool('chercher_contrat', { requete: '22222', statut: 'draft' }, data);
    expect(out.result.total_trouves).toBe(1);
  });

  it('renvoie une erreur lisible pour une requête vide', () => {
    expect(executeAssistantTool('chercher_contrat', {}, data).result.erreur).toBeTruthy();
  });
});

describe('vehicules_disponibles', () => {
  it('exclut les véhicules en conflit de dates et ceux en maintenance', () => {
    const out = executeAssistantTool('vehicules_disponibles', { date_debut: '2026-10-12', date_fin: '2026-10-13' }, data);
    const ids = (out.result.disponibles as any[]).map((v) => v.id);
    expect(ids).toEqual(['v2']);
    expect((out.result.occupes_sur_la_periode as any[])[0].contrat).toBe('MC-2026-0001');
    expect(out.result.hors_service).toBe(1);
  });

  it('un véhicule « loué » est libre après son retour', () => {
    const out = executeAssistantTool('vehicules_disponibles', { date_debut: '2026-10-16', date_fin: '2026-10-18' }, data);
    expect((out.result.disponibles as any[]).map((v) => v.id).sort()).toEqual(['v1', 'v2']);
  });

  it('tient compte des réservations futures (brouillons)', () => {
    const out = executeAssistantTool('vehicules_disponibles', { date_debut: '2026-11-02', date_fin: '2026-11-03' }, data);
    expect((out.result.disponibles as any[]).map((v) => v.id)).not.toContain('v2');
  });

  it('rejette des dates invalides ou inversées', () => {
    expect(executeAssistantTool('vehicules_disponibles', { date_debut: 'demain', date_fin: '2026-10-13' }, data).result.erreur).toBeTruthy();
    expect(executeAssistantTool('vehicules_disponibles', { date_debut: '2026-10-14', date_fin: '2026-10-13' }, data).result.erreur).toBeTruthy();
  });
});

describe('solde_client', () => {
  it('additionne les soldes hors contrats annulés', () => {
    const out = executeAssistantTool('solde_client', { requete: 'El Amrani' }, data);
    expect(out.result.total_reste_a_encaisser_mad).toBe(2000);
    expect(out.result.ambigu).toBe(false);
    expect(out.sources.some((s) => s.kind === 'client')).toBe(true);
  });

  it('signale une requête ambiguë', () => {
    const out = executeAssistantTool('solde_client', { requete: 'a' }, data);
    expect(out.result.ambigu).toBe(true);
  });
});

describe('executeAssistantTool', () => {
  it('ne lève jamais d\'exception pour un outil inconnu', () => {
    expect(executeAssistantTool('rm_rf', {}, data).result.erreur).toMatch(/inconnu/);
  });
});
