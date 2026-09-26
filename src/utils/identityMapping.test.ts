import { describe, it, expect } from 'vitest';
import {
  isLegacyUserId,
  isUuid,
  resolveCanonicalUserId,
  resolveLegacyUserId,
  matchUserIdentity,
  validateLegacyIdClaim,
  CANONICAL_LEGACY_REGISTRY,
} from './identityMapping';
import { User } from '../types';

describe('Canonical Identity and Legacy Mapping Architecture (Problem #6)', () => {
  const mockUsers: User[] = [
    {
      id: 'd9b736b4-2b02-4c6e-8260-845187e1f401',
      supabaseUid: 'd9b736b4-2b02-4c6e-8260-845187e1f401',
      legacyId: 'usr-1',
      name: 'Anouar',
      email: 'anouar@morvellocars.com',
      role: 'admin',
      agency: 'Siège & Direction Générale',
      permissions: {} as any,
    },
    {
      id: 'a1111111-2222-4333-8444-555555555555',
      supabaseUid: 'a1111111-2222-4333-8444-555555555555',
      legacyId: 'usr-2',
      name: 'Said Khomri',
      email: 'said.khomri@morvellocars.com',
      role: 'manager',
      agency: 'Agence Casablanca Centre',
      permissions: {} as any,
    },
    {
      id: 'b2222222-3333-4444-8555-666666666666',
      supabaseUid: 'b2222222-3333-4444-8555-666666666666',
      legacyId: 'usr-3',
      name: 'Abdelkader Ouahib',
      email: 'abdelkader.ouahib@morvellocars.com',
      role: 'manager',
      agency: 'Agence Aéroport Nouaceur',
      permissions: {} as any,
    },
    {
      id: 'c3333333-4444-4555-8666-777777777777',
      supabaseUid: 'c3333333-4444-4555-8666-777777777777',
      legacyId: 'usr-5',
      name: 'Mohamed Ezzay',
      email: 'mohamed.ezzay@morvellocars.com',
      role: 'manager',
      agency: 'Agence Marrakech & Région',
      permissions: {} as any,
    },
    {
      id: 'usr-6', // Unmigrated legacy format in memory
      legacyId: 'usr-6',
      name: 'Larbi Khomri',
      email: 'larbi.khomri@morvellocars.com',
      role: 'manager',
      agency: 'Agence Casablanca Littoral',
      permissions: {} as any,
    },
  ];

  describe('isLegacyUserId', () => {
    it('correctly detects usr-N formats', () => {
      expect(isLegacyUserId('usr-1')).toBe(true);
      expect(isLegacyUserId('usr-5')).toBe(true);
      expect(isLegacyUserId('USR-6')).toBe(true);
      expect(isLegacyUserId('usr-42')).toBe(true);
    });

    it('rejects UUIDs and non-legacy IDs', () => {
      expect(isLegacyUserId('d9b736b4-2b02-4c6e-8260-845187e1f401')).toBe(false);
      expect(isLegacyUserId('user-123')).toBe(false);
      expect(isLegacyUserId(null)).toBe(false);
      expect(isLegacyUserId(undefined)).toBe(false);
    });
  });

  describe('isUuid', () => {
    it('validates standard RFC 4122 UUID formats', () => {
      expect(isUuid('d9b736b4-2b02-4c6e-8260-845187e1f401')).toBe(true);
      expect(isUuid('a1111111-2222-4333-8444-555555555555')).toBe(true);
    });

    it('rejects non-UUID strings', () => {
      expect(isUuid('usr-1')).toBe(false);
      expect(isUuid('firebase-uid-sample-123')).toBe(false);
      expect(isUuid('')).toBe(false);
    });
  });

  describe('resolveCanonicalUserId', () => {
    it('returns UUID immediately if already a canonical UUID', () => {
      const uuid = 'a1111111-2222-4333-8444-555555555555';
      expect(resolveCanonicalUserId(uuid, mockUsers)).toBe(uuid);
    });

    it('translates legacy usr-2 to the Supabase Auth UUID', () => {
      const canonical = resolveCanonicalUserId('usr-2', mockUsers);
      expect(canonical).toBe('a1111111-2222-4333-8444-555555555555');
    });

    it('translates legacy usr-5 to Mohamed Ezzay UUID', () => {
      const canonical = resolveCanonicalUserId('usr-5', mockUsers);
      expect(canonical).toBe('c3333333-4444-4555-8666-777777777777');
    });

    it('handles undefined or null gracefully', () => {
      expect(resolveCanonicalUserId(undefined, mockUsers)).toBeUndefined();
      expect(resolveCanonicalUserId(null, mockUsers)).toBeUndefined();
    });
  });

  describe('resolveLegacyUserId', () => {
    it('returns the legacyId when given a canonical Supabase UUID', () => {
      const legacy = resolveLegacyUserId('a1111111-2222-4333-8444-555555555555', mockUsers);
      expect(legacy).toBe('usr-2');
    });

    it('returns the legacyId directly if input is already usr-N', () => {
      expect(resolveLegacyUserId('usr-3', mockUsers)).toBe('usr-3');
    });

    it('falls back to known registry by email', () => {
      const usersWithoutLegacyId: User[] = [
        {
          id: 'test-uuid-999',
          name: 'Said',
          email: 'said.khomri@morvellocars.com',
          role: 'manager',
          agency: 'Casablanca',
          permissions: {} as any,
        },
      ];
      expect(resolveLegacyUserId('test-uuid-999', usersWithoutLegacyId)).toBe('usr-2');
    });
  });

  describe('matchUserIdentity', () => {
    const saidUser = mockUsers[1]; // Said Khomri

    it('matches by direct canonical UUID', () => {
      expect(matchUserIdentity('a1111111-2222-4333-8444-555555555555', saidUser)).toBe(true);
    });

    it('matches by legacy ID usr-2', () => {
      expect(matchUserIdentity('usr-2', saidUser)).toBe(true);
    });

    it('matches by verified email', () => {
      expect(matchUserIdentity('said.khomri@morvellocars.com', saidUser)).toBe(true);
    });

    it('rejects different manager identity', () => {
      expect(matchUserIdentity('usr-3', saidUser)).toBe(false);
      expect(matchUserIdentity('usr-5', saidUser)).toBe(false);
      expect(matchUserIdentity('b2222222-3333-4444-8555-666666666666', saidUser)).toBe(false);
    });
  });

  describe('validateLegacyIdClaim', () => {
    it('allows administrators to claim or assign any legacy ID', () => {
      const adminCaller = {
        id: 'd9b736b4-2b02-4c6e-8260-845187e1f401',
        role: 'admin' as const,
        email: 'anouar@morvellocars.com',
      };
      expect(validateLegacyIdClaim('usr-2', adminCaller)).toBe(true);
      expect(validateLegacyIdClaim('usr-5', adminCaller)).toBe(true);
    });

    it('allows a manager to claim their own corresponding legacy ID', () => {
      const saidCaller = {
        id: 'a1111111-2222-4333-8444-555555555555',
        role: 'manager' as const,
        email: 'said.khomri@morvellocars.com',
      };
      expect(validateLegacyIdClaim('usr-2', saidCaller)).toBe(true);
    });

    it('strictly forbids a manager from claiming another manager’s legacy ID', () => {
      const saidCaller = {
        id: 'a1111111-2222-4333-8444-555555555555',
        role: 'manager' as const,
        email: 'said.khomri@morvellocars.com',
      };
      // Said tries to claim usr-3 (Abdelkader) or usr-5 (Mohamed)
      expect(validateLegacyIdClaim('usr-3', saidCaller)).toBe(false);
      expect(validateLegacyIdClaim('usr-5', saidCaller)).toBe(false);
    });
  });

  describe('CANONICAL_LEGACY_REGISTRY consistency', () => {
    it('contains all 5 canonical managers and admins with correct roles and agencies', () => {
      expect(CANONICAL_LEGACY_REGISTRY['usr-1'].role).toBe('admin');
      expect(CANONICAL_LEGACY_REGISTRY['usr-2'].role).toBe('manager');
      expect(CANONICAL_LEGACY_REGISTRY['usr-3'].role).toBe('manager');
      expect(CANONICAL_LEGACY_REGISTRY['usr-5'].role).toBe('manager');
      expect(CANONICAL_LEGACY_REGISTRY['usr-6'].role).toBe('manager');

      // Verify that no invalid legacy usr-4 exists in registry (Kenza Tazi removed)
      expect(CANONICAL_LEGACY_REGISTRY['usr-4']).toBeUndefined();
    });
  });
});
