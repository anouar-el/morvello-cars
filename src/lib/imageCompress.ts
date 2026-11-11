/*
 * Réduit une photo (appareil photo ou galerie) avant de l'envoyer à l'assistant : côté long limité,
 * JPEG recompressé. Une photo de CIN reste lisible à 1600 px et pèse alors environ 300 à 600 Ko.
 */

export interface CompressedImage {
  mimeType: 'image/jpeg';
  /** Base64 sans préfixe « data: ». */
  data: string;
  /** Aperçu affichable (URL de données), jamais envoyé au serveur. */
  preview: string;
}

const MAX_SIDE = 1600;
const QUALITY = 0.82;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image illisible'));
    };
    img.src = url;
  });
}

export async function compressImage(file: File): Promise<CompressedImage> {
  if (!file.type.startsWith('image/')) throw new Error('Le fichier doit être une image.');
  const img = await loadImage(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Image illisible');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const preview = canvas.toDataURL('image/jpeg', QUALITY);
  return { mimeType: 'image/jpeg', data: preview.slice(preview.indexOf(',') + 1), preview };
}
