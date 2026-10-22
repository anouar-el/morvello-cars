import { describe, expect, it, vi } from 'vitest';
import { countPendingImages } from '../utils/contractPdfGenerator';
import { canShareFile, describePdfError, isIosDevice, pdfCaptureSettings, sharePdfFile } from './pdfShare';

const pdf = () => new Blob(['%PDF-1.4'], { type: 'application/pdf' });

describe('isIosDevice', () => {
  it('reconnaît iPhone et iPad, y compris un iPad qui se présente comme un Mac', () => {
    expect(isIosDevice({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' })).toBe(true);
    expect(isIosDevice({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)', platform: 'MacIntel', maxTouchPoints: 5 })).toBe(true);
  });
  it('écarte Android, Mac et Windows', () => {
    expect(isIosDevice({ userAgent: 'Mozilla/5.0 (Linux; Android 14)' })).toBe(false);
    expect(isIosDevice({ userAgent: 'Mozilla/5.0 (Macintosh)', platform: 'MacIntel', maxTouchPoints: 0 })).toBe(false);
    expect(isIosDevice(undefined)).toBe(false);
  });
});

describe('pdfCaptureSettings', () => {
  it("allège la capture sur iPhone pour économiser la mémoire", () => {
    expect(pdfCaptureSettings(true).scale).toBeLessThan(pdfCaptureSettings(false).scale);
    expect(pdfCaptureSettings(true).quality).toBeLessThan(pdfCaptureSettings(false).quality);
  });
});

describe('sharePdfFile', () => {
  it("renvoie « unsupported » quand le navigateur ne partage pas de fichiers", async () => {
    expect(await sharePdfFile(pdf(), 'c.pdf', 'Contrat', {})).toBe('unsupported');
    expect(await sharePdfFile(pdf(), 'c.pdf', 'Contrat', { share: vi.fn(), canShare: () => false })).toBe('unsupported');
  });

  it('partage le fichier PDF avec son nom', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const outcome = await sharePdfFile(pdf(), 'Contrat_12.pdf', 'Contrat 12', { share, canShare: () => true });
    expect(outcome).toBe('shared');
    const sent = share.mock.calls[0][0] as ShareData;
    expect(sent.files?.[0].name).toBe('Contrat_12.pdf');
    expect(sent.files?.[0].type).toBe('application/pdf');
  });

  it("ne traite pas la fermeture de la feuille de partage comme une erreur", async () => {
    const abort = Object.assign(new Error('x'), { name: 'AbortError' });
    expect(await sharePdfFile(pdf(), 'c.pdf', 't', { share: vi.fn().mockRejectedValue(abort), canShare: () => true })).toBe('cancelled');
    expect(await sharePdfFile(pdf(), 'c.pdf', 't', { share: vi.fn().mockRejectedValue(new Error('boom')), canShare: () => true })).toBe('failed');
  });

  it('canShareFile survit à un canShare qui lève une exception', () => {
    const file = new File(['x'], 'c.pdf', { type: 'application/pdf' });
    expect(canShareFile(file, { share: vi.fn(), canShare: () => { throw new Error('nope'); } })).toBe(false);
  });
});

describe('describePdfError', () => {
  it('explique un manque de mémoire, une page introuvable, ou une erreur générale', () => {
    expect(describePdfError(new Error('Canvas exceeds max size'))).toMatch(/mémoire/);
    expect(describePdfError(new Error('Impossible de localiser les pages A4 du contrat'))).toMatch(/fini de s'afficher/);
    expect(describePdfError(new Error("Le logo ou le cachet du contrat n'a pas fini de se charger."))).toMatch(/cachet/);
    expect(describePdfError(new Error('???'))).toMatch(/Réessayez/);
  });
});

describe('countPendingImages', () => {
  it("compte les images dont le chargement n'est pas terminé (logo, cachet)", () => {
    expect(countPendingImages([{ complete: true }, { complete: false }, { complete: false }])).toBe(2);
    expect(countPendingImages([])).toBe(0);
  });
});
