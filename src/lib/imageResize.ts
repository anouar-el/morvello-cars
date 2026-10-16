/** Redimensionnement/compression d'une photo côté navigateur (data URL JPEG légère). */

export const PHOTO_MAX_SIDE = 720;
export const PHOTO_QUALITY = 0.72;

/** Dimensions réduites pour tenir dans un carré `maxSide`, sans jamais agrandir. */
export function fitDimensions(width: number, height: number, maxSide = PHOTO_MAX_SIDE): { width: number; height: number } {
  if (!(width > 0) || !(height > 0)) return { width: 0, height: 0 };
  const longest = Math.max(width, height);
  if (longest <= maxSide) return { width: Math.round(width), height: Math.round(height) };
  const ratio = maxSide / longest;
  return { width: Math.max(1, Math.round(width * ratio)), height: Math.max(1, Math.round(height * ratio)) };
}

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
      reject(new Error('image-load-failed'));
    };
    img.src = url;
  });
}

/** Lit une image choisie par l'utilisateur et renvoie un data URL JPEG compressé. */
export async function fileToCompressedDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('not-an-image');
  const img = await loadImage(file);
  const { width, height } = fitDimensions(img.naturalWidth, img.naturalHeight);
  if (!width || !height) throw new Error('empty-image');
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no-canvas');
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', PHOTO_QUALITY);
}
