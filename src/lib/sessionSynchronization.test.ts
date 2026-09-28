import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getActiveAuthToken,
  setActiveAuthProvider,
  getActiveAuthProvider,
  clearStaleSupabaseSession,
} from './authToken';
import { supabase } from './supabase';
import { auth as firebaseAuth } from './firebase';
import {
  authenticateCaller,
  verifyAdminCaller,
  setSupabaseClient,
  setAdminAuth,
} from '../../server.ts';
import type { Request } from 'express';

const mockSupabaseState = vi.hoisted(() => ({
  currentSession: null as any,
}));

vi.mock('./supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getSession: vi.fn().mockImplementation(() =>
        Promise.resolve({ data: { session: mockSupabaseState.currentSession }, error: null })
      ),
      refreshSession: vi.fn(),
      signOut: vi.fn().mockImplementation(() => {
        mockSupabaseState.currentSession = null;
        return Promise.resolve({ error: null });
      }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
    from: vi.fn(),
  },
}));

vi.mock('./firebase', () => ({
  auth: {
    currentUser: null,
    authStateReady: vi.fn().mockResolvedValue(undefined),
  },
}));

function createMockStorage() {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (i: number) => Object.keys(store)[i] ?? null,
  };
}

const mockSessionStorage = createMockStorage();
const mockLocalStorage = createMockStorage();

Object.defineProperty(globalThis, 'sessionStorage', {
  value: mockSessionStorage,
  writable: true,
});
Object.defineProperty(globalThis, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});
Object.defineProperty(globalThis, 'window', {
  value: globalThis,
  writable: true,
});

describe('P0.4 Authentication Regression & Session Synchronization Fix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseState.currentSession = null;
    vi.mocked(supabase.auth.getSession).mockReset();
    vi.mocked(supabase.auth.getSession).mockImplementation(() =>
      Promise.resolve({ data: { session: mockSupabaseState.currentSession }, error: null })
    );
    sessionStorage.clear();
    localStorage.clear();
    setActiveAuthProvider(null);
    setSupabaseClient(null);
    setAdminAuth(null);
    (firebaseAuth as any).currentUser = null;
  });

  // Scenario A: Supabase login + valid Supabase token
  it('Scenario A: Supabase login + valid Supabase token', async () => {
    const validSbToken = 'sb.valid.jwt.token';
    const mockSbUser = {
      id: 'sb-uuid-1111-2222',
      email: 'anouar@morvellocars.com',
    };

    // 1. Supabase client session in browser
    mockSupabaseState.currentSession = {
      access_token: validSbToken,
      user: mockSbUser as any,
      refresh_token: 'valid-refresh-token',
      expires_in: 3600,
      token_type: 'bearer',
    };

    // 2. Client logs in with Supabase
    setActiveAuthProvider('supabase');
    expect(getActiveAuthProvider()).toBe('supabase');

    const clientToken = await getActiveAuthToken();
    expect(clientToken.provider).toBe('supabase');
    expect(clientToken.token).toBe(validSbToken);

    // 3. Server-side verification
    const mockDbProfile = {
      id: 'sb-uuid-1111-2222',
      role: 'admin',
      name: 'Anouar Admin',
      agency: 'Siège & Direction Générale',
      agency_id: 'agency_siege',
    };

    const mockSbServer: any = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: mockSbUser },
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
    setSupabaseClient(mockSbServer);

    const req = {
      headers: { authorization: `Bearer ${clientToken.token}` },
    } as unknown as Request;

    const authResult = await authenticateCaller(req);
    expect(authResult.authenticated).toBe(true);
    expect(authResult.provider).toBe('supabase');
    expect(authResult.uid).toBe('sb-uuid-1111-2222');
    expect(authResult.role).toBe('admin');
    expect(authResult.agency).toBe('agency_siege');

    const adminCheck = await verifyAdminCaller(req);
    expect(adminCheck.isAdmin).toBe(true);
  });

  // Scenario B: Firebase login + valid Firebase token
  it('Scenario B: Firebase login + valid Firebase token', async () => {
    const validFbToken = 'https://securetoken.google.com/valid-firebase-token';
    const mockFbUser = {
      uid: 'fb-user-12345',
      email: 'collaborator@morvellocars.com',
      displayName: 'Collaborateur Google',
      getIdToken: vi.fn().mockResolvedValue(validFbToken),
    };
    (firebaseAuth as any).currentUser = mockFbUser;

    // Client logs in with Firebase
    setActiveAuthProvider('firebase');
    expect(getActiveAuthProvider()).toBe('firebase');

    const clientToken = await getActiveAuthToken();
    expect(clientToken.provider).toBe('firebase');
    expect(clientToken.token).toBe(validFbToken);

    // Server-side verification
    const mockDecodedToken = {
      uid: 'fb-user-12345',
      email: 'collaborator@morvellocars.com',
      name: 'Collaborateur Google',
    };
    const mockAdminAuth: any = {
      verifyIdToken: vi.fn().mockResolvedValue(mockDecodedToken),
    };
    setAdminAuth(mockAdminAuth);

    const mockDbProfile = {
      id: 'sb-canonical-uuid-mapped-999',
      role: 'manager',
      name: 'Collaborateur Mappé',
      agency: 'Aéroport Mohammed V Casablanca',
      agency_id: 'agency_aeroport_cmv',
      firebase_uid: 'fb-user-12345',
    };
    const mockSbServer: any = {
      auth: { getUser: vi.fn() },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: mockDbProfile, error: null }),
          }),
        }),
      }),
    };
    setSupabaseClient(mockSbServer);

    const req = {
      headers: { authorization: `Bearer ${clientToken.token}` },
    } as unknown as Request;

    const authResult = await authenticateCaller(req);
    expect(authResult.authenticated).toBe(true);
    expect(authResult.provider).toBe('firebase');
    expect(authResult.uid).toBe('sb-canonical-uuid-mapped-999'); // Canonical Supabase UUID
    expect(authResult.role).toBe('manager');
    expect(authResult.agency).toBe('agency_aeroport_cmv');
  });

  // Scenario C: Firebase login + stale Supabase session
  it('Scenario C: Firebase login + stale Supabase session (stale Supabase token is ignored & purged)', async () => {
    // A stale/revoked Supabase session remains in Supabase client/storage
    const staleSbToken = 'stale.revoked.supabase.token';
    mockSupabaseState.currentSession = {
      access_token: staleSbToken,
      user: { id: 'old-revoked-user-id' } as any,
      refresh_token: 'old-refresh',
      expires_in: 0,
      token_type: 'bearer',
    };

    // But the user is logged into Firebase
    const freshFbToken = 'https://securetoken.google.com/fresh-firebase-id-token';
    const mockFbUser = {
      uid: 'fb-active-user-777',
      email: 'active.firebase@morvellocars.com',
      getIdToken: vi.fn().mockResolvedValue(freshFbToken),
    };
    (firebaseAuth as any).currentUser = mockFbUser;
    setActiveAuthProvider('firebase');

    // Token getter MUST select Firebase token and never return the stale Supabase token
    const clientToken = await getActiveAuthToken();
    expect(clientToken.provider).toBe('firebase');
    expect(clientToken.token).toBe(freshFbToken);
    expect(clientToken.token).not.toBe(staleSbToken);

    // clearStaleSupabaseSession must have been called
    expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });

    // Server-side verification confirms Firebase ID token is received
    const mockAdminAuth: any = {
      verifyIdToken: vi.fn().mockResolvedValue({
        uid: 'fb-active-user-777',
        email: 'active.firebase@morvellocars.com',
      }),
    };
    setAdminAuth(mockAdminAuth);

    const mockDbProfile = {
      id: 'sb-uuid-mapped-777',
      role: 'agent',
      name: 'Agent Actif',
      agency: 'Gare Casa-Port',
      agency_id: 'agency_gare_casa_port',
      firebase_uid: 'fb-active-user-777',
    };
    const mockSbServer: any = {
      auth: {
        // If the server were called with the stale token, it would fail:
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: Object.assign(new Error('Auth session missing!'), { name: 'AuthSessionMissingError' }),
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
    setSupabaseClient(mockSbServer);

    const req = {
      headers: { authorization: `Bearer ${clientToken.token}` },
    } as unknown as Request;

    const authResult = await authenticateCaller(req);
    expect(authResult.authenticated).toBe(true);
    expect(authResult.provider).toBe('firebase');
    expect(authResult.uid).toBe('sb-uuid-mapped-777');
    // Supabase getUser was NOT called because the token was inspected as Firebase
    expect(mockSbServer.auth.getUser).not.toHaveBeenCalled();
  });

  // Scenario D: Page reload after Firebase login
  it('Scenario D: Page reload after Firebase login', async () => {
    // Simulate page reload: in-memory state is empty, but sessionStorage has provider = 'firebase'
    // or Firebase SDK initializes asynchronously via authStateReady
    sessionStorage.setItem('morvello_active_auth_provider', 'firebase');

    const reloadedFbToken = 'https://securetoken.google.com/reloaded-firebase-token';
    const mockFbUser = {
      uid: 'fb-reloaded-user',
      email: 'reloaded@morvellocars.com',
      getIdToken: vi.fn().mockResolvedValue(reloadedFbToken),
    };

    // Initially currentUser is null while authStateReady is pending
    (firebaseAuth as any).currentUser = null;
    (firebaseAuth.authStateReady as any).mockImplementationOnce(async () => {
      (firebaseAuth as any).currentUser = mockFbUser;
    });

    // Even if Supabase getSession still had a lingering session in localStorage
    mockSupabaseState.currentSession = {
      access_token: 'lingering.supabase.token',
      user: { id: 'lingering-user' } as any,
      refresh_token: 'lingering-refresh',
      expires_in: 3600,
      token_type: 'bearer',
    };

    const tokenResult = await getActiveAuthToken();
    expect(firebaseAuth.authStateReady).toHaveBeenCalled();
    expect(tokenResult.provider).toBe('firebase');
    expect(tokenResult.token).toBe(reloadedFbToken);
    expect(tokenResult.token).not.toBe('lingering.supabase.token');
  });

  // Scenario E: Logout/re-login switching providers
  it('Scenario E: Logout/re-login switching providers', async () => {
    // 1. Initial State: Logged in via Firebase
    const fbToken1 = 'https://securetoken.google.com/fb-token-1';
    (firebaseAuth as any).currentUser = {
      uid: 'fb-user-1',
      getIdToken: vi.fn().mockResolvedValue(fbToken1),
    };
    setActiveAuthProvider('firebase');

    let token = await getActiveAuthToken();
    expect(token.provider).toBe('firebase');
    expect(token.token).toBe(fbToken1);

    // 2. User logs out
    setActiveAuthProvider(null);
    await clearStaleSupabaseSession();
    (firebaseAuth as any).currentUser = null;
    expect(getActiveAuthProvider()).toBeNull();

    token = await getActiveAuthToken();
    expect(token.provider).toBeNull();
    expect(token.token).toBeNull();

    // 3. User logs in via Supabase (Email/Password)
    const sbToken = 'sb.jwt.second.login';
    mockSupabaseState.currentSession = {
      access_token: sbToken,
      user: { id: 'sb-user-second' } as any,
      refresh_token: 'sb-refresh-second',
      expires_in: 3600,
      token_type: 'bearer',
    };
    setActiveAuthProvider('supabase');

    token = await getActiveAuthToken();
    expect(token.provider).toBe('supabase');
    expect(token.token).toBe(sbToken);

    // 4. User logs out again and switches back to Firebase/Google
    setActiveAuthProvider(null);
    await clearStaleSupabaseSession();
    expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });

    const fbToken2 = 'https://securetoken.google.com/fb-token-2';
    (firebaseAuth as any).currentUser = {
      uid: 'fb-user-2',
      getIdToken: vi.fn().mockResolvedValue(fbToken2),
    };
    setActiveAuthProvider('firebase');

    token = await getActiveAuthToken();
    expect(token.provider).toBe('firebase');
    expect(token.token).toBe(fbToken2);
    expect(token.token).not.toBe(sbToken);
  });

  // Scenario F: Unmapped Firebase user
  it('Scenario F: Unmapped Firebase user fails closed with HTTP 403', async () => {
    const unmappedFbToken = 'fb-unmapped-user-token';
    const mockDecodedToken = {
      uid: 'fb-unmapped-rogue-uid-888',
      email: 'unmapped.user@external.com',
      admin: false,
    };
    const mockAdminAuth: any = {
      verifyIdToken: vi.fn().mockResolvedValue(mockDecodedToken),
    };
    setAdminAuth(mockAdminAuth);

    // Supabase has NO profile for this firebase_uid
    const mockSbServer: any = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: new Error('Not a SB token'),
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
    setSupabaseClient(mockSbServer);

    const req = {
      headers: { authorization: `Bearer ${unmappedFbToken}` },
    } as unknown as Request;

    const authResult = await authenticateCaller(req);
    expect(authResult.authenticated).toBe(false);
    expect(authResult.statusCode).toBe(403);
    expect(authResult.error).toContain('Utilisateur Firebase non associé à un profil Supabase autorisé');

    const adminCheck = await verifyAdminCaller(req);
    expect(adminCheck.isAdmin).toBe(false);
  });
});
