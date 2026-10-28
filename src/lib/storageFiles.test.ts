import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  dataUrlToBytes,
  isDisplayableFile,
  isEmbeddedFile,
  isStorageRef,
  kindForKey,
  makeRef,
  measureEmbedded,
  migrateEmbeddedFiles,
  objectPath,
  parseRef,
  publicUrl,
  resetStorageAvailability,
  resolveRef,
  resolveSync,
  sha256Hex,
  storeEmbeddedFile,
  type StorageApi,
  type UploadResult,
} from './storageFiles';

const jpeg = (fill = 'A', size = 6000) => 'data:image/jpeg;base64,' + btoa(fill.repeat(size));
const BASE = 'https://proj.supabase.co';

function fakeApi(over: Partial<StorageApi> & { result?: UploadResult } = {}) {
  const uploads: Array<{ bucket: string; path: string; mime: string; size: number }> = [];
  const api: StorageApi = {
    baseUrl: BASE,
    upload: async (bucket, path, bytes, mime) => {
      uploads.push({ bucket, path, mime, size: bytes.length });
      return over.result ?? { ok: true };
    },
    signedUrl: over.signedUrl ?? (async (bucket, path) => `${BASE}/signed/${bucket}/${path}?token=t`),
    download: over.download ?? (async () => new Blob(['x'], { type: 'image/jpeg' })),
  };
  return { api, uploads };
}

beforeEach(() => resetStorageAvailability());

describe('références', () => {
  it('construit et relit une référence', () => {
    const ref = makeRef('morvello-files', 'ab/abcdef.jpg');
    expect(ref).toBe('sbs://morvello-files/ab/abcdef.jpg');
    expect(isStorageRef(ref)).toBe(true);
    expect(parseRef(ref)).toEqual({ bucket: 'morvello-files', path: 'ab/abcdef.jpg' });
  });
  it('refuse ce qui n’est pas une référence valide', () => {
    expect(isStorageRef('https://x.ma/a.jpg')).toBe(false);
    expect(parseRef('sbs://seul')).toBeNull();
    expect(parseRef('sbs:///chemin')).toBeNull();
    expect(parseRef('data:image/png;base64,AAA')).toBeNull();
  });
});

describe('isEmbeddedFile', () => {
  it('ne retient que les images et PDF intégrés assez gros', () => {
    expect(isEmbeddedFile(jpeg())).toBe(true);
    expect(isEmbeddedFile('data:image/png;base64,AAA')).toBe(false); // trop petit
    expect(isEmbeddedFile('data:image/svg+xml;charset=utf-8,' + 'x'.repeat(5000))).toBe(true); // schémas d'état des lieux
    expect(isEmbeddedFile('data:text/html;base64,' + 'x'.repeat(5000))).toBe(false);
    expect(isEmbeddedFile('https://x.ma/' + 'a'.repeat(5000))).toBe(false);
    expect(isEmbeddedFile(42)).toBe(false);
  });
});

describe('dataUrlToBytes / empreinte', () => {
  it('décode le base64 et reconnaît le type', () => {
    const decoded = dataUrlToBytes('data:image/png;base64,' + btoa('hello'));
    expect(decoded?.mime).toBe('image/png');
    expect(new TextDecoder().decode(decoded!.bytes)).toBe('hello');
    expect(dataUrlToBytes('pas une data url')).toBeNull();
  });
  it('donne la même empreinte pour le même contenu (dédoublonnage)', async () => {
    const a = await sha256Hex(new TextEncoder().encode('scan'));
    const b = await sha256Hex(new TextEncoder().encode('scan'));
    const c = await sha256Hex(new TextEncoder().encode('autre'));
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toHaveLength(64);
    expect(objectPath(a, 'jpg')).toBe(`${a.slice(0, 2)}/${a}.jpg`);
  });
  it("construit l'adresse publique", () => {
    expect(publicUrl('https://p.supabase.co/', 'vehicle-photos', 'ab/x.jpg')).toBe('https://p.supabase.co/storage/v1/object/public/vehicle-photos/ab/x.jpg');
  });
});

describe('storeEmbeddedFile', () => {
  it('envoie le fichier dans le bon espace et rend une référence', async () => {
    const { api, uploads } = fakeApi();
    const ref = await storeEmbeddedFile(jpeg(), 'client-doc', api);
    expect(isStorageRef(ref)).toBe(true);
    expect(uploads).toHaveLength(1);
    expect(uploads[0].bucket).toBe('morvello-files');
    expect(uploads[0].mime).toBe('image/jpeg');
    expect(parseRef(ref)!.path).toMatch(/^[0-9a-f]{2}\/[0-9a-f]{64}\.jpg$/);
  });

  it('range les photos de voitures dans l’espace public', async () => {
    const { api, uploads } = fakeApi();
    await storeEmbeddedFile(jpeg('B'), 'vehicle-photo', api);
    expect(uploads[0].bucket).toBe('vehicle-photos');
  });

  it('un fichier déjà présent compte comme un succès', async () => {
    const { api } = fakeApi({ result: { ok: false, duplicate: true, error: 'exists' } });
    expect(isStorageRef(await storeEmbeddedFile(jpeg(), 'client-doc', api))).toBe(true);
  });

  it("rend l'image d'origine, sans jamais lever, quand l'envoi échoue", async () => {
    const original = jpeg();
    expect(await storeEmbeddedFile(original, 'client-doc', fakeApi({ result: { ok: false, error: 'réseau' } }).api)).toBe(original);
    const throwing: StorageApi = { ...fakeApi().api, upload: async () => { throw new Error('boom'); } };
    expect(await storeEmbeddedFile(original, 'client-doc', throwing)).toBe(original);
    expect(await storeEmbeddedFile(original, 'client-doc', null)).toBe(original);
  });

  it("n'insiste pas pendant quelques minutes quand l'espace n'existe pas encore", async () => {
    const now = () => 1_000_000;
    const { api, uploads } = fakeApi({ result: { ok: false, missingBucket: true, error: 'Bucket not found' } });
    await storeEmbeddedFile(jpeg('C'), 'client-doc', api, { now });
    await storeEmbeddedFile(jpeg('D'), 'client-doc', api, { now });
    expect(uploads).toHaveLength(1);
    // plus tard, on réessaie
    await storeEmbeddedFile(jpeg('E'), 'client-doc', api, { now: () => 1_000_000 + 6 * 60 * 1000 });
    expect(uploads).toHaveLength(2);
  });

  it('laisse intacts une référence, un petit fichier et une adresse https', async () => {
    const { api, uploads } = fakeApi();
    const ref = makeRef('morvello-files', 'ab/x.jpg');
    expect(await storeEmbeddedFile(ref, 'client-doc', api)).toBe(ref);
    expect(await storeEmbeddedFile('data:image/png;base64,AAA', 'client-doc', api)).toBe('data:image/png;base64,AAA');
    expect(await storeEmbeddedFile('https://x.ma/a.jpg', 'client-doc', api)).toBe('https://x.ma/a.jpg');
    expect(uploads).toHaveLength(0);
  });
});

describe('kindForKey', () => {
  it('choisit l’espace selon la nature du champ', () => {
    expect(kindForKey('photoUrl')).toBe('vehicle-photo');
    expect(kindForKey('clientSignature')).toBe('signature');
    expect(kindForKey('agencySignature')).toBe('signature');
    expect(kindForKey('url', ['inspection', 'photos', '0'])).toBe('inspection');
    expect(kindForKey('cinDocUrl', ['clientSnapshot'])).toBe('client-doc');
    expect(kindForKey('dataUrl', ['documents', '0'])).toBe('client-doc');
  });
});

describe('measureEmbedded / migrateEmbeddedFiles', () => {
  const record = () => ({
    id: 'c1',
    clientSnapshot: { cinDocUrl: jpeg('S'), cinDocVersoUrl: jpeg('T'), documents: [{ dataUrl: jpeg('S'), name: 'cin' }], phone: '06' },
    clientSignature: jpeg('G'),
    inspection: { photos: [{ id: 'p1', url: jpeg('I') }] },
    note: 'texte',
  });

  it('compte les fichiers intégrés et leur poids', () => {
    const m = measureEmbedded(record());
    expect(m.count).toBe(5);
    expect(m.bytes).toBeGreaterThan(5 * 4000);
    expect(measureEmbedded({ a: 1, b: 'x' })).toEqual({ count: 0, bytes: 0 });
  });

  it('remplace chaque fichier par une référence, dédoublonne les copies, et laisse le reste', async () => {
    const { api, uploads } = fakeApi();
    const input = record();
    const out = await migrateEmbeddedFiles(input, api);
    expect(out.moved).toBe(5);
    expect(out.failed).toBe(0);
    const v = out.value as any;
    expect(isStorageRef(v.clientSnapshot.cinDocUrl)).toBe(true);
    // la même image copiée deux fois (scan + copie dans documents) pointe vers le même fichier
    expect(v.clientSnapshot.documents[0].dataUrl).toBe(v.clientSnapshot.cinDocUrl);
    expect(v.clientSnapshot.phone).toBe('06');
    expect(v.note).toBe('texte');
    expect(parseRef(v.clientSignature)!.bucket).toBe('morvello-files');
    expect(parseRef(v.inspection.photos[0].url)!.bucket).toBe('morvello-files');
    expect(uploads.map((u) => u.path)).toHaveLength(5); // 5 envois, 4 chemins distincts
    expect(new Set(uploads.map((u) => u.path)).size).toBe(4);
    // la fiche d'origine n'est pas modifiée
    expect(input.clientSnapshot.cinDocUrl.startsWith('data:')).toBe(true);
  });

  it("compte les envois ratés et garde l'image d'origine pour pouvoir relancer", async () => {
    const { api } = fakeApi({ result: { ok: false, error: 'hors ligne' } });
    const out = await migrateEmbeddedFiles(record(), api);
    expect(out.moved).toBe(0);
    expect(out.failed).toBe(5);
    expect((out.value as any).clientSignature.startsWith('data:')).toBe(true);
  });
});

describe('affichage', () => {
  it("un mot comme « archived » n'est pas une adresse : fichier absent, pas d'image cassée", () => {
    expect(isDisplayableFile('archived')).toBe(false);
    expect(resolveSync('archived', BASE)).toBe('');
    for (const ok of ['data:image/png;base64,AAA', 'https://x.ma/a.jpg', 'blob:abc', 'sbs://morvello-files/ab/x.jpg']) expect(isDisplayableFile(ok)).toBe(true);
  });

  it('laisse passer data:, https: et blob: tels quels', () => {
    expect(resolveSync('data:image/png;base64,AAA', BASE)).toBe('data:image/png;base64,AAA');
    expect(resolveSync('https://x.ma/a.jpg', BASE)).toBe('https://x.ma/a.jpg');
    expect(resolveSync('', BASE)).toBeUndefined();
    expect(resolveSync(undefined, BASE)).toBeUndefined();
  });

  it('donne tout de suite l’adresse d’une photo de voiture (espace public)', () => {
    expect(resolveSync(makeRef('vehicle-photos', 'ab/x.jpg'), BASE)).toBe(`${BASE}/storage/v1/object/public/vehicle-photos/ab/x.jpg`);
  });

  it('télécharge un fichier privé via un lien signé, puis le garde en mémoire', async () => {
    const createObjectURL = vi.fn(() => 'blob:abc');
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL: vi.fn() });
    const download = vi.fn(async () => new Blob(['x']));
    const signedUrl = vi.fn(async () => `${BASE}/signed?t=1`);
    const { api } = fakeApi({ download, signedUrl });
    const ref = makeRef('morvello-files', 'cd/prive.jpg');
    const [a, b] = await Promise.all([resolveRef(ref, api), resolveRef(ref, api)]); // deux demandes simultanées
    expect(a).toBe('blob:abc');
    expect(b).toBe('blob:abc');
    expect(signedUrl).toHaveBeenCalledTimes(1);
    expect(await resolveRef(ref, api)).toBe('blob:abc'); // depuis la mémoire
    expect(download).toHaveBeenCalledTimes(1);
    expect(resolveSync(ref, BASE)).toBe('blob:abc');
    vi.unstubAllGlobals();
  });

  it('renvoie null sans lever quand le lien signé est refusé', async () => {
    const { api } = fakeApi({ signedUrl: async () => null });
    expect(await resolveRef(makeRef('morvello-files', 'zz/absent.jpg'), api)).toBeNull();
  });
});
