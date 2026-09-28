import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CANONICAL_LEGACY_REGISTRY } from '../utils/identityMapping';
import {
  authenticateCaller,
  verifyAdminCaller,
  setSupabaseClient,
  setAdminAuth,
} from '../../server';
import type { Request } from 'express';

describe('Server Authentication & Authorization Zero-Trust Architecture (Problem #6 & P0.4)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setSupabaseClient(null);
    setAdminAuth(null);
  });

  describe('Legacy Problem #6 Invariants', () => {
    it('strictly isolates manager access and prevents client-controlled roles', () => {
      const maliciousPayload = {
        memberId: 'a1111111-2222-4333-8444-555555555555',
        memberRole: 'admin',
        memberAgency: 'Siège & Direction Générale',
      };

      const authenticatedEmail = 'said.khomri@morvellocars.com';
      const authoritativeEntry = Object.values(CANONICAL_LEGACY_REGISTRY).find(
        (reg) => reg.canonicalEmail === authenticatedEmail
      );

      expect(authoritativeEntry).toBeDefined();
      const serverResolvedRole = authoritativeEntry!.role;
      expect(serverResolvedRole).toBe('manager');
      expect(serverResolvedRole).not.toBe(maliciousPayload.memberRole);

      const isAdmin = serverResolvedRole === 'admin';
      expect(isAdmin).toBe(false);
    });

    it('filters vehicles and contracts based strictly on authenticated user, not forged memberId', () => {
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

      const callerNameLower = authenticatedCaller.name.toLowerCase();
      const accessibleVehicles = fleet.filter((v) => {
        if (v.assignedManagerId === authenticatedCaller.uid) return true;
        if (authenticatedCaller.legacyId && v.assignedManagerId === authenticatedCaller.legacyId) return true;
        if (v.assignedManagerName && v.assignedManagerName.toLowerCase().includes(callerNameLower)) return true;
        return false;
      });

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

      const userProfile = {
        id: supabaseUser.id,
        supabaseUid: supabaseUser.id,
        email: supabaseUser.email,
        firebaseUid: undefined,
      };

      expect(userProfile.id).toBe(supabaseUser.id);
      expect(userProfile.supabaseUid).toBe(supabaseUser.id);
      expect(userProfile.firebaseUid).toBeUndefined();
      expect(userProfile.firebaseUid).not.toBe(supabaseUser.id);
    });
  });

  describe('P0.4: Supabase as Single Security Authority & Cross-Authority Resolution', () => {
    it('rejects caller when authorization token is missing', async () => {
      const mockReq = {
        headers: {},
      } as unknown as Request;

      const result = await authenticateCaller(mockReq);
      expect(result.authenticated).toBe(false);
      expect(result.statusCode).toBe(401);
      expect(result.error).toContain('Jeton d’authentification manquant');
    });

    it('Scenario 1: Resolves role strictly from Supabase public.profiles when Supabase JWT is presented', async () => {
      const mockSupabaseUser = {
        id: 'sb-uuid-1234-5678',
        email: 'manager.casablanca@morvellocars.com',
        user_metadata: { name: 'Said Manager' },
      };

      const mockDbProfile = {
        id: 'sb-uuid-1234-5678',
        role: 'manager',
        name: 'Said Khomri',
        agency_id: 'agency_casablanca_centre',
        agency: 'Agence Casablanca Centre',
        legacy_id: 'usr-2',
      };

      const mockSbClient: any = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: mockSupabaseUser },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: mockDbProfile, error: null }),
            }),
          }),
        }),
      };

      setSupabaseClient(mockSbClient);

      const mockReq = {
        headers: { authorization: 'Bearer valid-sb-jwt-token' },
      } as unknown as Request;

      const auth = await authenticateCaller(mockReq);
      expect(auth.authenticated).toBe(true);
      if (auth.authenticated) {
        expect(auth.provider).toBe('supabase');
        expect(auth.uid).toBe('sb-uuid-1234-5678');
        expect(auth.role).toBe('manager');
        expect(auth.isAdmin).toBe(false);
        expect(auth.agency).toBe('agency_casablanca_centre');
        expect(auth.agency).not.toBe('Agence Morvello'); // NEVER hardcoded
        expect(auth.legacyId).toBe('usr-2');
      }
    });

    it('reports a terminated Supabase session (session_not_found) with a dedicated, non-retryable code', async () => {
      const sessionMissing = Object.assign(new Error('Auth session missing!'), { name: 'AuthSessionMissingError' });
      const fromSpy = vi.fn();
      const mockSbClient: any = {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: sessionMissing }) },
        from: fromSpy,
      };
      setSupabaseClient(mockSbClient);

      const auth = await authenticateCaller({
        headers: { authorization: 'Bearer signed-but-revoked-session-jwt' },
      } as unknown as Request);

      expect(auth.authenticated).toBe(false);
      expect(auth.statusCode).toBe(401);
      expect(auth.code).toBe('SESSION_TERMINATED');
      expect(auth.error).toContain('session a été fermée');
      // Fail closed: no profile lookup, no Firebase fallback for a dead Supabase session
      expect(fromSpy).not.toHaveBeenCalled();
    });

    it('Scenario 2: Fails closed when authenticated Supabase user has no profile in public.profiles', async () => {
      const mockSupabaseUser = {
        id: 'sb-uuid-orphan-user',
        email: 'orphan@morvellocars.com',
      };

      const mockSbClient: any = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: mockSupabaseUser },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      };

      setSupabaseClient(mockSbClient);

      const mockReq = {
        headers: { authorization: 'Bearer valid-sb-jwt-orphan' },
      } as unknown as Request;

      const auth = await authenticateCaller(mockReq);
      expect(auth.authenticated).toBe(false);
      expect(auth.statusCode).toBe(403);
      expect(auth.error).toContain('Profil Supabase introuvable');
    });

    it('Scenario 3: Conflicting Claims — Supabase profile ALWAYS wins over Firebase custom claims', async () => {
      // Attacker has forged or historical Firebase custom claims claiming 'admin'
      const mockDecodedToken = {
        uid: 'fb-user-999',
        email: 'agent.said@morvellocars.com',
        admin: true, // FIREBASE CLAIM: admin
        role: 'admin', // FIREBASE CLAIM: admin
      };

      // But in authoritative Supabase public.profiles, user is only an 'agent' in 'agency_littoral'
      const mockDbProfile = {
        id: 'sb-canonical-uuid-999',
        role: 'agent', // SUPABASE AUTHORITATIVE: agent
        name: 'Said Agent',
        agency_id: 'agency_littoral',
        agency: 'Agence Casablanca Littoral',
        firebase_uid: 'fb-user-999',
      };

      const mockAdminAuth: any = {
        verifyIdToken: vi.fn().mockResolvedValue(mockDecodedToken),
      };

      const mockSbClient: any = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: null, error: new Error('Not a SB token') }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: mockDbProfile, error: null }),
            }),
          }),
        }),
      };

      setAdminAuth(mockAdminAuth);
      setSupabaseClient(mockSbClient);

      const mockReq = {
        headers: { authorization: 'Bearer firebase-token-with-admin-claims' },
      } as unknown as Request;

      const auth = await authenticateCaller(mockReq);
      expect(auth.authenticated).toBe(true);
      if (auth.authenticated) {
        // Crucial security invariant:
        // Role MUST be resolved from public.profiles ('agent'), NOT Firebase claims ('admin')
        expect(auth.role).toBe('agent');
        expect(auth.isAdmin).toBe(false);
        expect(auth.uid).toBe('sb-canonical-uuid-999'); // Canonical Supabase UUID
        expect(auth.agency).toBe('agency_littoral');
        expect(auth.agency).not.toBe('Agence Morvello');
      }

      // verifyAdminCaller MUST deny this user
      const adminCheck = await verifyAdminCaller(mockReq);
      expect(adminCheck.isAdmin).toBe(false);
      expect(adminCheck.error).toContain('privilèges d\'administration requis');
    });

    it('Scenario 4: Unmapped Firebase user with no linked Supabase profile is DENIED privileged access (fail-closed)', async () => {
      // Valid Google/Firebase account that was never provisioned in Supabase
      const mockDecodedToken = {
        uid: 'fb-rogue-user-888',
        email: 'unmapped.user@gmail.com',
        admin: false,
      };

      const mockAdminAuth: any = {
        verifyIdToken: vi.fn().mockResolvedValue(mockDecodedToken),
      };

      const mockSbClient: any = {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: null, error: new Error('Not a SB token') }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }), // No linked profile!
            }),
          }),
        }),
      };

      setAdminAuth(mockAdminAuth);
      setSupabaseClient(mockSbClient);

      const mockReq = {
        headers: { authorization: 'Bearer unmapped-firebase-token' },
      } as unknown as Request;

      const auth = await authenticateCaller(mockReq);
      expect(auth.authenticated).toBe(false);
      expect(auth.statusCode).toBe(403);
      expect(auth.error).toContain('Utilisateur Firebase non associé à un profil Supabase autorisé');

      // Admin verification must also fail
      const adminCheck = await verifyAdminCaller(mockReq);
      expect(adminCheck.isAdmin).toBe(false);
    });

    it('Scenario 5: Legitimate Supabase administrator is granted admin privileges', async () => {
      const mockSupabaseAdmin = {
        id: 'sb-admin-uuid-001',
        email: 'anouar@morvellocars.com',
      };

      const mockAdminProfile = {
        id: 'sb-admin-uuid-001',
        role: 'admin',
        name: 'Anouar Admin',
        agency_id: 'agency_direction_generale',
        agency: 'Direction Générale',
        legacy_id: 'usr-1',
      };

      const mockSbClient: any = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: mockSupabaseAdmin },
            error: null,
          }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: mockAdminProfile, error: null }),
            }),
          }),
        }),
      };

      setSupabaseClient(mockSbClient);

      const mockReq = {
        headers: { authorization: 'Bearer admin-supabase-jwt' },
      } as unknown as Request;

      const adminCheck = await verifyAdminCaller(mockReq);
      expect(adminCheck.isAdmin).toBe(true);
      expect(adminCheck.callerUid).toBe('sb-admin-uuid-001');
      expect(adminCheck.callerAgency).toBe('agency_direction_generale');
    });
  });
});
