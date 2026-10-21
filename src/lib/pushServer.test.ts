import { describe, expect, it } from 'vitest';
import { mapProfileToUser, readPushConfig, validateSubscription } from './pushServer';

const goodSub = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
  keys: { p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM', auth: 'tBHItJI5svbpez7KI4CCXg' },
};

describe('readPushConfig', () => {
  const env = { VAPID_PUBLIC_KEY: 'pub', VAPID_PRIVATE_KEY: 'priv', VAPID_SUBJECT: 'mailto:contact@exemple.ma' };
  it('est active seulement avec les trois variables', () => {
    expect(readPushConfig(env)).toEqual({ publicKey: 'pub', privateKey: 'priv', subject: 'mailto:contact@exemple.ma' });
    expect(readPushConfig({ ...env, VAPID_PRIVATE_KEY: '' })).toBeNull();
    expect(readPushConfig({})).toBeNull();
  });
  it("refuse un sujet qui n'est ni mailto: ni https://", () => {
    expect(readPushConfig({ ...env, VAPID_SUBJECT: 'contact@exemple.ma' })).toBeNull();
    expect(readPushConfig({ ...env, VAPID_SUBJECT: 'https://morvello.ma' })).not.toBeNull();
  });
});

describe('validateSubscription', () => {
  it('accepte un abonnement bien formé', () => {
    expect(validateSubscription({ subscription: goodSub })).toEqual(goodSub);
  });
  it("refuse une adresse non https, absente ou démesurée (le serveur y enverra des requêtes)", () => {
    expect(validateSubscription({ subscription: { ...goodSub, endpoint: 'http://push.example/x' } })).toBeNull();
    expect(validateSubscription({ subscription: { ...goodSub, endpoint: 'pas une url' } })).toBeNull();
    expect(validateSubscription({ subscription: { ...goodSub, endpoint: `https://x.example/${'a'.repeat(1100)}` } })).toBeNull();
    expect(validateSubscription({})).toBeNull();
    expect(validateSubscription(null)).toBeNull();
  });
  it('refuse des clés mal formées', () => {
    expect(validateSubscription({ subscription: { ...goodSub, keys: { ...goodSub.keys, auth: 'x' } } })).toBeNull();
    expect(validateSubscription({ subscription: { ...goodSub, keys: { ...goodSub.keys, p256dh: '<script>'.repeat(5) } } })).toBeNull();
    expect(validateSubscription({ subscription: { endpoint: goodSub.endpoint } })).toBeNull();
  });
});

describe('mapProfileToUser', () => {
  it("garde l'identité utile au cloisonnement et ramène un rôle inconnu à « agent »", () => {
    expect(mapProfileToUser({ id: 'u1', name: 'Said', role: 'manager', legacy_id: 'usr-2', firebase_uid: 'fb1' })).toMatchObject({
      id: 'u1',
      role: 'manager',
      legacyId: 'usr-2',
      firebaseUid: 'fb1',
    });
    expect(mapProfileToUser({ id: 'u2', role: 'superuser' }).role).toBe('agent');
  });
});
