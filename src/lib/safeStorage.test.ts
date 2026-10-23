import { describe, expect, it, vi } from 'vitest';
import { isQuotaError, safeSetItem, safeSetJson, stripDataUrls } from './safeStorage';

/** Faux stockage plafonné en nombre de caractères, qui lève comme Safari quand c'est plein. */
function fakeStorage(limit: number, initial: Record<string, string> = {}) {
  const data = new Map<string, string>(Object.entries(initial));
  const used = () => [...data.entries()].reduce((sum, [k, v]) => sum + k.length + v.length, 0);
  return {
    data,
    get length() {
      return data.size;
    },
    key: (i: number) => [...data.keys()][i] ?? null,
    getItem: (k: string) => data.get(k) ?? null,
    removeItem: (k: string) => void data.delete(k),
    setItem: (k: string, v: string) => {
      const before = data.get(k);
      data.set(k, v);
      if (used() > limit) {
        if (before === undefined) data.delete(k);
        else data.set(k, before);
        throw Object.assign(new Error('The quota has been exceeded.'), { name: 'QuotaExceededError' });
      }
    },
  };
}

const bigImage = 'data:image/jpeg;base64,' + 'A'.repeat(5000);

describe('isQuotaError', () => {
  it('reconnaît les formes de dépassement de quota des navigateurs', () => {
    expect(isQuotaError(Object.assign(new Error('x'), { name: 'QuotaExceededError' }))).toBe(true);
    expect(isQuotaError({ name: 'NS_ERROR_DOM_QUOTA_REACHED' })).toBe(true);
    expect(isQuotaError({ code: 22 })).toBe(true);
    expect(isQuotaError(new Error('The quota has been exceeded.'))).toBe(true);
    expect(isQuotaError(new Error('autre chose'))).toBe(false);
    expect(isQuotaError(null)).toBe(false);
  });
});

describe('stripDataUrls', () => {
  it('retire les longues images intégrées sans toucher au reste', () => {
    const input = { name: 'Logan', photoUrl: bigImage, tiny: 'data:image/png;base64,AAA', url: 'https://x.ma/a.jpg', docs: [{ url: bigImage, n: 1 }] };
    expect(stripDataUrls(input)).toEqual({ name: 'Logan', photoUrl: '', tiny: 'data:image/png;base64,AAA', url: 'https://x.ma/a.jpg', docs: [{ url: '', n: 1 }] });
    // l'original n'est pas modifié
    expect(input.photoUrl).toBe(bigImage);
  });
});

describe('safeSetItem', () => {
  it("écrit normalement quand il y a de la place", () => {
    const s = fakeStorage(1000);
    expect(safeSetItem('k', 'valeur', { storage: s })).toBe(true);
    expect(s.getItem('k')).toBe('valeur');
  });

  it("ne lève jamais, même quand tout est plein", () => {
    const s = fakeStorage(10);
    expect(() => safeSetItem('cle', 'x'.repeat(500), { storage: s })).not.toThrow();
    expect(safeSetItem('cle', 'x'.repeat(500), { storage: s })).toBe(false);
  });

  it("sacrifie d'abord l'historique de l'assistant pour garder les données de travail", () => {
    const s = fakeStorage(300, { morvello_ai_chat_u1: 'c'.repeat(250) });
    expect(safeSetItem('morvello_vehicles_v1', 'v'.repeat(200), { storage: s })).toBe(true);
    expect(s.getItem('morvello_ai_chat_u1')).toBeNull();
    expect(s.getItem('morvello_vehicles_v1')).toHaveLength(200);
  });

  it("retombe sur la version allégée quand la version complète ne rentre pas", () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const s = fakeStorage(400);
    const data = [{ id: 'v1', photoUrl: bigImage }];
    expect(safeSetJson('morvello_vehicles_lite', data, { storage: s })).toBe(true);
    expect(JSON.parse(s.getItem('morvello_vehicles_lite')!)).toEqual([{ id: 'v1', photoUrl: '' }]);
    warn.mockRestore();
  });

  it("retire une ancienne copie périmée plutôt que de la laisser mentir", () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const s = fakeStorage(200, { morvello_clients_v1: 'ancien' });
    expect(safeSetItem('morvello_clients_v1', 'n'.repeat(1000), { storage: s })).toBe(false);
    expect(s.getItem('morvello_clients_v1')).toBeNull();
    warn.mockRestore();
  });

  it('prévient une seule fois par clé', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { onStorageFull } = await import('./safeStorage');
    const heard: string[] = [];
    const off = onStorageFull((k) => heard.push(k));
    const s = fakeStorage(10);
    safeSetItem('une_cle_unique', 'x'.repeat(100), { storage: s });
    safeSetItem('une_cle_unique', 'x'.repeat(100), { storage: s });
    off();
    expect(heard).toEqual(['une_cle_unique']);
    warn.mockRestore();
  });
});
