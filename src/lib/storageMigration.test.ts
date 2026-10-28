import { describe, expect, it, vi } from 'vitest';
import type { Client, Contract, Vehicle } from '../types';
import { changedTopLevelKeys, runStorageMigration, summarizeEmbedded, type MigrationDeps } from './storageMigration';
import { migrateEmbeddedFiles, type StorageApi } from './storageFiles';

const img = (fill: string) => 'data:image/jpeg;base64,' + btoa(fill.repeat(6000));

const okApi = (): StorageApi => ({
  baseUrl: 'https://p.supabase.co',
  upload: async () => ({ ok: true }),
  signedUrl: async () => null,
  download: async () => null,
});

const failingApi = (): StorageApi => ({ ...okApi(), upload: async () => ({ ok: false, error: 'espace introuvable' }) });

function harness(over: { clients?: any[]; vehicles?: any[]; contracts?: any[]; api?: StorageApi; patchOk?: boolean } = {}) {
  const patches: Array<{ kind: string; id: string; fields: string[] }> = [];
  const api = over.api ?? okApi();
  const patcher = (kind: string) => async (id: string, p: any) => {
    patches.push({ kind, id, fields: Object.keys(p) });
    return over.patchOk ?? true;
  };
  const deps: MigrationDeps = {
    clients: over.clients ?? [],
    vehicles: over.vehicles ?? [],
    contracts: over.contracts ?? [],
    migrate: (record) => migrateEmbeddedFiles(record, api),
    patchClient: patcher('client'),
    patchVehicle: patcher('vehicle'),
    patchContract: patcher('contract'),
  };
  return { deps, patches };
}

describe('changedTopLevelKeys', () => {
  it('ne liste que les champs modifiés', () => {
    expect(changedTopLevelKeys({ a: 1, b: { x: 1 }, c: 'k' }, { a: 1, b: { x: 2 }, c: 'k' })).toEqual(['b']);
  });
});

describe('runStorageMigration', () => {
  const client = (): Client => ({ id: 'cl1', firstName: 'A', lastName: 'B', cinDocUrl: img('c'), licenseDocUrl: img('l'), phone: '06' }) as Client;
  const vehicle = (): Vehicle => ({ id: 'v1', brand: 'DACIA', photoUrl: img('p') }) as Vehicle;
  const contract = (): Contract =>
    ({ id: 'k1', contractNumber: '1', clientSnapshot: { cinDocUrl: img('c'), documents: [{ dataUrl: img('l') }] }, clientSignature: img('s') }) as unknown as Contract;

  it('déplace les fichiers de chaque famille et n’écrit que les champs modifiés', async () => {
    const { deps, patches } = harness({ clients: [client()], vehicles: [vehicle()], contracts: [contract()] });
    const report = await runStorageMigration(deps);
    expect(report).toMatchObject({ candidates: 3, recordsUpdated: 3, failures: 0 });
    expect(report.filesMoved).toBe(2 + 1 + 3);
    expect(report.reclaimedChars).toBeGreaterThan(0);
    expect(patches.find((p) => p.kind === 'client')!.fields.sort()).toEqual(['cinDocUrl', 'licenseDocUrl']);
    expect(patches.find((p) => p.kind === 'vehicle')!.fields).toEqual(['photoUrl']);
    expect(patches.find((p) => p.kind === 'contract')!.fields.sort()).toEqual(['clientSignature', 'clientSnapshot']);
  });

  it("ignore les fiches qui n'ont rien à déplacer (migration relançable)", async () => {
    const { deps, patches } = harness({ clients: [{ id: 'x', firstName: 'a', cinDocUrl: 'sbs://morvello-files/ab/x.jpg' } as Client] });
    const report = await runStorageMigration(deps);
    expect(report.candidates).toBe(0);
    expect(patches).toEqual([]);
  });

  it("s'arrête quand Storage n'est pas prêt, sans rien écrire", async () => {
    const { deps, patches } = harness({ clients: [client(), client(), client(), client()], api: failingApi() });
    const report = await runStorageMigration(deps);
    expect(report.abortedReason).toBe('storage-unavailable');
    expect(report.recordsUpdated).toBe(0);
    expect(patches).toEqual([]);
  });

  it("compte une écriture refusée comme un échec et continue avec la fiche suivante", async () => {
    const { deps } = harness({ clients: [client()], vehicles: [vehicle()], patchOk: false });
    const report = await runStorageMigration(deps);
    expect(report.recordsUpdated).toBe(0);
    expect(report.failures).toBe(2);
    expect(report.abortedReason).toBeUndefined();
  });

  it('peut être annulée en cours de route', async () => {
    const { deps } = harness({ clients: [client(), client()] });
    let calls = 0;
    deps.isCancelled = () => ++calls > 1;
    const report = await runStorageMigration(deps);
    expect(report.abortedReason).toBe('cancelled');
    expect(report.recordsUpdated).toBe(1);
  });

  it('signale la progression', async () => {
    const { deps } = harness({ vehicles: [vehicle()] });
    const onProgress = vi.fn();
    deps.onProgress = onProgress;
    await runStorageMigration(deps);
    expect(onProgress).toHaveBeenCalledWith({ done: 1, total: 1, label: 'terminé' });
  });
});

describe('summarizeEmbedded', () => {
  it('additionne le poids par famille', () => {
    const s = summarizeEmbedded({
      clients: [{ id: 'c', cinDocUrl: img('a') } as Client],
      vehicles: [{ id: 'v', photoUrl: img('b') } as Vehicle, { id: 'v2' } as Vehicle],
      contracts: [],
    });
    expect(s.clients.count).toBe(1);
    expect(s.vehicles.count).toBe(1);
    expect(s.contracts.count).toBe(0);
    expect(s.total.count).toBe(2);
    expect(s.total.bytes).toBe(s.clients.bytes + s.vehicles.bytes);
  });
});
