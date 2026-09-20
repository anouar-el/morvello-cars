import { Contract } from '../types';

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

/**
 * Assure le chargement complet des polices et images contenues dans l'élément avant capture
 */
async function waitForAssets(container: HTMLElement): Promise<void> {
  // Attente polices
  if (typeof document !== 'undefined' && 'fonts' in document) {
    try {
      await document.fonts.ready;
    } catch {
      // Ignorer si échec
    }
  }

  // Attente images
  const images = Array.from(container.querySelectorAll('img'));
  await Promise.all(
    images.map((img) => {
      if (img.complete) return Promise.resolve();
      return new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
        // Timeout de sécurité pour éviter de bloquer
        setTimeout(resolve, 800);
      });
    })
  );

  // Petit répit pour le rendu géométrique final du navigateur
  await new Promise((r) => setTimeout(r, 120));
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
async function capturePageElement(element: HTMLElement, scale = 2.2): Promise<string> {
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

    return canvas.toDataURL('image/jpeg', 0.95);
  } catch (canvasErr) {
    console.warn('html2canvas a échoué, repli sur html-to-image:', canvasErr);

    // Tentative 2 : html-to-image
    const { toJpeg } = await import('html-to-image');
    return await toJpeg(element, {
      quality: 0.95,
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
  const {
    idPrefix = 'print',
    onProgress,
    scale = 2.2,
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
  const imgData1 = await capturePageElement(page1El, scale);

  onProgress?.('Capture haute résolution Page 2 (Verso)...', 60);
  const imgData2 = await capturePageElement(page2El, scale);

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
  window.open(result.blobUrl, '_blank');
  return result;
}
