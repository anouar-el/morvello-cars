import { afterEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({
  authCallback: null as any,
  unsubscribe: vi.fn(),
  from: vi.fn(),
  removeChannel: vi.fn(),
}));

vi.mock('./supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: { onAuthStateChange: (callback: any) => {
      mock.authCallback = callback;
      return { data: { subscription: { unsubscribe: mock.unsubscribe } } };
    } },
    from: mock.from,
    channel: () => {
      const channel = { on: () => channel, subscribe: () => channel };
      return channel;
    },
    removeChannel: mock.removeChannel,
  },
}));

import { subscribeToRemoteAgencyDataFromSupabase } from './supabaseSync';

afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

describe('Supabase authentication refresh', () => {
  function setup() {
    vi.useFakeTimers();
    mock.from.mockImplementation((table: string) => {
      const result = { data: table === 'profiles'
        ? [{ id: 'authenticated-user', name: 'QA', role: 'manager' }]
        : table === 'agency_data' ? null : [], error: null };
      const query: any = {
        select: () => query, eq: () => query, order: () => query,
        maybeSingle: () => Promise.resolve(result),
        limit: () => Promise.resolve(result),
        then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
      };
      return query;
    });
    const onData = vi.fn();
    const stop = subscribeToRemoteAgencyDataFromSupabase(onData);
    return { onData, stop };
  }

  it('loads existing rows after sign-in without requiring a database change', async () => {
    const { onData, stop } = setup();
    mock.authCallback('SIGNED_IN', { user: { id: 'authenticated-user' } });
    expect(mock.from).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(300);
    expect(onData).toHaveBeenCalledOnce();
    expect(onData.mock.calls[0][0].users[0].id).toBe('authenticated-user');
    stop();
  });

  it('cancels a pending read on sign-out', async () => {
    const { onData, stop } = setup();
    mock.authCallback('SIGNED_IN', { user: { id: 'authenticated-user' } });
    mock.authCallback('SIGNED_OUT', null);
    await vi.advanceTimersByTimeAsync(300);
    expect(onData).not.toHaveBeenCalled();
    expect(mock.from).not.toHaveBeenCalled();
    stop();
  });

  it('unsubscribes and cancels pending reads on disposal', async () => {
    const { onData, stop } = setup();
    mock.authCallback('INITIAL_SESSION', { user: { id: 'authenticated-user' } });
    stop();
    await vi.advanceTimersByTimeAsync(300);
    expect(onData).not.toHaveBeenCalled();
    expect(mock.unsubscribe).toHaveBeenCalledOnce();
    expect(mock.removeChannel).toHaveBeenCalledOnce();
  });
});
