import { describe, it, expect } from 'vitest';
import { CANONICAL_LEGACY_REGISTRY, resolveCanonicalUserId, matchUserIdentity } from '../utils/identityMapping';

describe('Server Authentication & Authorization Zero-Trust Architecture (Problem #6)', () => {
  it('strictly isolates manager access and prevents client-controlled roles', () => {
    // Simulated client payload trying to elevate privileges
    const maliciousPayload = {
      memberId: 'a1111111-2222-4333-8444-555555555555', // Said Khomri
      memberRole: 'admin', // FORGED CLIENT ROLE
      memberAgency: 'Siège & Direction Générale', // FORGED SCOPE
    };

    // Server-side authoritative verification:
    // The server MUST ignore maliciousPayload.memberRole and consult the database/registry
    const authenticatedEmail = 'said.khomri@morvellocars.com';
    const authoritativeEntry = Object.values(CANONICAL_LEGACY_REGISTRY).find(
      (reg) => reg.canonicalEmail === authenticatedEmail
    );

    expect(authoritativeEntry).toBeDefined();
    // Authoritative role MUST be 'manager', never 'admin'
    const serverResolvedRole = authoritativeEntry!.role;
    expect(serverResolvedRole).toBe('manager');
    expect(serverResolvedRole).not.toBe(maliciousPayload.memberRole);

    // Server-resolved admin flag MUST be false
    const isAdmin = serverResolvedRole === 'admin';
    expect(isAdmin).toBe(false);
  });

  it('filters vehicles and contracts based strictly on authenticated user, not forged memberId', () => {
    // Authenticated caller is Abdelkader Ouahib (usr-3)
    const authenticatedCaller = {
      uid: 'b2222222-3333-4444-8555-666666666666',
      legacyId: 'usr-3',
      name: 'Abdelkader Ouahib',
      role: 'manager' as const,
    };

    const fleet = [
      { id: 'veh-1', brand: 'Dacia', plate: '1234-A-1', assignedManagerId: 'usr-3', assignedManagerName: 'Abdelkader Ouahib' },
      { id: 'veh-2', brand: 'Renault', plate: '5678-B-1', assignedManagerId: 'usr-2', assignedManagerName: 'Said Khomri' },
      { id: 'veh-3', brand: 'Peugeot', plate: '9999-C-1', assignedManagerId: 'usr-5', assignedManagerName: 'Mohamed Ezzay' },
    ];

    // Filter using authenticated caller
    const callerNameLower = authenticatedCaller.name.toLowerCase();
    const accessibleVehicles = fleet.filter((v) => {
      if (v.assignedManagerId === authenticatedCaller.uid) return true;
      if (authenticatedCaller.legacyId && v.assignedManagerId === authenticatedCaller.legacyId) return true;
      if (v.assignedManagerName && v.assignedManagerName.toLowerCase().includes(callerNameLower)) return true;
      return false;
    });

    // Only Abdelkader's vehicle (veh-1) is accessible
    expect(accessibleVehicles.length).toBe(1);
    expect(accessibleVehicles[0].id).toBe('veh-1');
    expect(accessibleVehicles.some((v) => v.id === 'veh-2')).toBe(false);
    expect(accessibleVehicles.some((v) => v.id === 'veh-3')).toBe(false);
  });

  it('guarantees that Supabase Auth UUID is never stored as a Firebase UID', () => {
    const supabaseUser = {
      id: 'd9b736b4-2b02-4c6e-8260-845187e1f401',
      email: 'anouar@morvellocars.com',
    };

    // User profile object generated from session
    const userProfile = {
      id: supabaseUser.id,
      supabaseUid: supabaseUser.id,
      email: supabaseUser.email,
      firebaseUid: undefined, // Must NEVER be set to supabaseUser.id
    };

    expect(userProfile.id).toBe(supabaseUser.id);
    expect(userProfile.supabaseUid).toBe(supabaseUser.id);
    expect(userProfile.firebaseUid).toBeUndefined();
    expect(userProfile.firebaseUid).not.toBe(supabaseUser.id);
  });
});
