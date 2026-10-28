import { Contract } from '../types';
import { isIosDevice, pdfCaptureSettings } from '../lib/pdfShare';

export interface GeneratePdfProgressCallback {
  (step: string, percent?: number): void;
}

export interface GeneratePdfOptions {
  idPrefix?: string;
  onProgress?: GeneratePdfProgressCallback;
  quality?: number;
  scale?: number;
  filename?: string;
}

export interface GeneratedPdfResult {
  blob: Blob;
  blobUrl: string;
  filename: string;
  totalPages: number;
}

/** Le logo et le cachet pèsent près de 2 Mo : sur une connexion lente, 0,8 s ne suffisait pas et le contrat partait sans cachet. */
const IMAGE_WAIT_MS = 20000;
const FONT_WAIT_MS = 8000;

/** Polices du contrat ; l'échantillon contient de l'arabe pour déclencher aussi le sous-ensemble arabe de Cairo. */
const CONTRACT_FONTS = [
  '400 14px Cairo',
  '700 14px Cairo',
  '400 14px "Plus Jakarta Sans"',
  '700 14px "Plus Jakarta Sans"',
  '800 14px "Plus Jakarta Sans"',
  '600 14px "JetBrains Mono"',
  '700 14px "JetBrains Mono"',
  '700 14px Cinzel',
];
const FONT_SAMPLE = 'Aa أب 0123';

/** Images dont le chargement n'est pas terminé (ni réussi, ni définitivement en erreur). */
export function countPendingImages(images: Array<{ complete: boolean }>): number {
  return images.filter((img) => !img.complete).length;
}

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
// requestAnimationFrame est suspendu quand l'onglet passe en arrière-plan : on ne l'attend jamais plus de 150 ms
const nextFrame = () =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, 150);
    requestAnimationFrame(() => {
      clearTimeout(timer);
      resolve();
    });
  });

function waitForImage(img: HTMLImageElement): Promise<void> {
  const decoded = () => (img.complete && img.naturalWidth > 0 && typeof img.decode === 'function' ? img.decode().catch(() => {}) : Promise.resolve());
  if (img.complete) return decoded();
  return new Promise<void>((resolve) => {
    const done = () => resolve();
    img.addEventListener('load', done, { once: true });
    img.addEventListener('error', done, { once: true });
    setTimeout(done, IMAGE_WAIT_MS);
  }).then(decoded);
}

/**
 * Assure le chargement complet des polices et images contenues dans l'élément avant capture.
 * Si une image n'a toujours pas fini de charger, on refuse de produire un contrat sans logo ni cachet.
 */
async function waitForAssets(container: HTMLElement): Promise<void> {
  // Polices : `fonts.ready` ne suffit pas, il ne couvre que ce qui est déjà en cours de chargement
  if (typeof document !== 'undefined' && 'fonts' in document) {
    try {
      await Promise.race([
        Promise.allSettled(CONTRACT_FONTS.map((spec) => document.fonts.load(spec, FONT_SAMPLE))),
        delay(FONT_WAIT_MS),
      ]);
      await document.fonts.ready;
    } catch {
      // Ignorer si échec
    }
  }

  // Images (cachet, logo)
  const images = Array.from(container.querySelectorAll('img'));
  await Promise.all(images.map(waitForImage));
  // Une image en erreur est remplacée par une version vectorielle : on laisse React la poser avant de vérifier
  await nextFrame();
  const pending = countPendingImages(Array.from(container.querySelectorAll('img')));
  if (pending > 0) {
    throw new Error('Le logo ou le cachet du contrat n\'a pas fini de se charger.');
  }

  // Photos, scans et signatures rangés dans Storage : leur téléchargement peut encore être en cours
  const storageDeadline = Date.now() + IMAGE_WAIT_MS;
  while (container.querySelector('[data-storage-pending="true"]')) {
    if (Date.now() > storageDeadline) throw new Error('Le logo, le cachet ou une signature du contrat n\'a pas fini de se charger.');
    await delay(100);
  }
  // Un fichier introuvable (supprimé du stockage) ne doit pas disparaître en silence d'un contrat
  if (container.querySelector('[data-storage-missing="true"]')) {
    throw new Error('Un fichier du contrat (signature ou photo) est introuvable dans le stockage.');
  }
  await nextFrame();
  await nextFrame();
  await delay(120);
}

/**
 * Nom de fichier propre et professionnel
 */
export function getContractPdfFilename(contract: Contract): string {
  const safeNumber = contract.contractNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeClient = (contract.clientSnapshot?.lastName || 'Client').replace(/[^a-zA-Z0-9_-]/g, '_');
  return `Contrat_${safeNumber}_${safeClient}.pdf`;
}

/**
 * Convertit un élément DOM en image canvas haute résolution
 */
async function capturePageElement(element: HTMLElement, scale = 2.2, quality = 0.95): Promise<string> {
  await waitForAssets(element);

  // Tentative 1 : html2canvas (moteur le plus stable pour canvas CSS moderne et SVG)
  try {
    const { default: html2canvas } = await import('html2canvas');
    const canvas = await html2canvas(element, {
      scale,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      imageTimeout: 12000,
      removeContainer: true,
      onclone: (clonedDoc) => {
        // S'assurer que les styles A4 sont respectés sur le clone
        const clonedEl = clonedDoc.getElementById(element.id);
        if (clonedEl) {
          clonedEl.style.transform = 'none';
          clonedEl.style.margin = '0';
          clonedEl.style.boxShadow = 'none';
        }
      },
    });

    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    // Libère tout de suite la mémoire du canevas : Safari sur iPhone la rend mal et échoue à la deuxième page
    canvas.width = 0;
    canvas.height = 0;
    return dataUrl;
  } catch (canvasErr) {
    console.warn('html2canvas a échoué, repli sur html-to-image:', canvasErr);

    // Tentative 2 : html-to-image
    const { toJpeg } = await import('html-to-image');
    return await toJpeg(element, {
      quality,
      pixelRatio: scale,
      backgroundColor: '#ffffff',
      cacheBust: true,
    });
  }
}

/**
 * Génère le Blob PDF A4 (2 pages) haute fidélité
 */
export async function generateContractPdf(
  contract: Contract,
  options: GeneratePdfOptions = {}
): Promise<GeneratedPdfResult> {
  const defaults = pdfCaptureSettings(isIosDevice());
  const {
    idPrefix = 'print',
    onProgress,
    scale = defaults.scale,
    quality = defaults.quality,
    filename: customFilename,
  } = options;

  onProgress?.('Initialisation du générateur A4...', 10);

  // Récupération des éléments DOM des 2 pages
  // Recherche dans l'ordre : export -> print -> preview
  const prefixes = [idPrefix, 'export', 'print', 'preview'];
  let page1El: HTMLElement | null = null;
  let page2El: HTMLElement | null = null;

  for (const p of prefixes) {
    const p1 = document.getElementById(`${p}-contract-pdf-page-1`);
    const p2 = document.getElementById(`${p}-contract-pdf-page-2`);
    if (p1 && p2) {
      page1El = p1;
      page2El = p2;
      break;
    }
  }

  if (!page1El || !page2El) {
    throw new Error(
      'Impossible de localiser les pages A4 du contrat dans le document (page 1 ou page 2 manquante).'
    );
  }

  onProgress?.('Capture haute résolution Page 1 (Recto)...', 25);
  const imgData1 = await capturePageElement(page1El, scale, quality);

  onProgress?.('Capture haute résolution Page 2 (Verso)...', 60);
  const imgData2 = await capturePageElement(page2El, scale, quality);

  onProgress?.('Compilation du document PDF A4...', 85);
  const { default: jsPDF } = await import('jspdf');

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  // Métadonnées du document PDF
  const filename = customFilename || getContractPdfFilename(contract);
  pdf.setDocumentProperties({
    title: `Contrat de Location ${contract.contractNumber} - Morvello Cars`,
    subject: `Contrat officiel de location de véhicule n° ${contract.contractNumber}`,
    author: 'Morvello Cars SARL',
    keywords: 'contrat, location, morvello, voitures, casablanca',
    creator: 'Morvello Fleet Management System',
  });

  // Page 1 (Recto - 210mm x 297mm)
  pdf.addImage(imgData1, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');

  // Page 2 (Verso - 210mm x 297mm)
  pdf.addPage('a4', 'portrait');
  pdf.addImage(imgData2, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');

  onProgress?.('Finalisation du fichier...', 95);
  const blob = pdf.output('blob');
  const blobUrl = URL.createObjectURL(blob);

  onProgress?.('Terminé !', 100);

  return {
    blob,
    blobUrl,
    filename,
    totalPages: 2,
  };
}

/**
 * Déclenche le téléchargement direct du PDF dans le navigateur
 */
export async function downloadContractPdf(
  contract: Contract,
  options: GeneratePdfOptions = {}
): Promise<GeneratedPdfResult> {
  const result = await generateContractPdf(contract, options);

  const downloadLink = document.createElement('a');
  downloadLink.href = result.blobUrl;
  downloadLink.download = result.filename;
  downloadLink.style.display = 'none';
  document.body.appendChild(downloadLink);
  downloadLink.click();

  // Nettoyage après téléchargement
  setTimeout(() => {
    document.body.removeChild(downloadLink);
  }, 1000);

  return result;
}

/**
 * Ouvre le PDF généré directement dans un nouvel onglet
 */
export async function openContractPdfInNewTab(
  contract: Contract,
  options: GeneratePdfOptions = {}
): Promise<GeneratedPdfResult> {
  const result = await generateContractPdf(contract, options);
  let opened = false;

  try {
    const newTab = window.open(result.blobUrl, '_blank');
    if (newTab && !newTab.closed && typeof newTab.closed !== 'undefined') {
      opened = true;
    }
  } catch (err) {
    console.warn('window.open was blocked by the browser:', err);
  }

  // Fallback: If popup was blocked by iframe/sandbox, use simulated link or direct download
  if (!opened && typeof document !== 'undefined') {
    try {
      const link = document.createElement('a');
      link.href = result.blobUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        if (link.parentNode) {
          link.parentNode.removeChild(link);
        }
      }, 500);
      opened = true;
    } catch {
      // Direct download fallback
      downloadContractPdf(contract, options);
    }
  }

  return result;
}
