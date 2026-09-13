/**
 * Utility functions for vehicle license plates in Morocco (French letters format).
 * Example requested by user: 55264 | A | 73
 */

const ARABIC_TO_FRENCH_LETTERS: Record<string, string> = {
  'أ': 'A',
  'ا': 'A',
  'ب': 'B',
  'د': 'D',
  'ج': 'J',
  'هـ': 'H',
  'ه': 'H',
  'و': 'W',
  'ط': 'T',
  'م': 'M',
  'س': 'S',
  'ر': 'R',
  'ك': 'K',
  'ف': 'F',
  'ق': 'Q',
  'ي': 'Y',
  'ع': 'E',
  'ح': 'H',
  'خ': 'KH',
  'ص': 'S',
  'ض': 'D',
  'ز': 'Z',
  'ت': 'T',
  'ث': 'TH',
  'ن': 'N',
  'ل': 'L',
};

/**
 * Normalizes a plate string to French letters format: e.g. "55264 | A | 73"
 */
export function formatPlateFrench(plate: string | undefined | null): string {
  if (!plate) return '';

  let cleaned = plate.trim();

  // Replace Arabic letter characters with French letters
  for (const [ar, fr] of Object.entries(ARABIC_TO_FRENCH_LETTERS)) {
    cleaned = cleaned.split(ar).join(fr);
  }

  // If already contains pipe separators, normalize spacing
  if (cleaned.includes('|')) {
    const parts = cleaned.split('|').map((p) => p.trim());
    if (parts.length === 3) {
      return `${parts[0]} | ${parts[1].toUpperCase()} | ${parts[2]}`;
    }
    return parts.join(' | ');
  }

  // If formatted like 55264-A-73 or 55264 A 73
  const dashMatch = cleaned.match(/^(\d+)[-\s]+([A-Za-z]+)[-\s]+(\d+)$/);
  if (dashMatch) {
    return `${dashMatch[1]} | ${dashMatch[2].toUpperCase()} | ${dashMatch[3]}`;
  }

  return cleaned;
}

/**
 * Quick validation for Moroccan plate in French letters format
 */
export function isValidMoroccanPlate(plate: string): boolean {
  if (!plate) return false;
  const normalized = formatPlateFrench(plate);
  return /^\d{1,6}\s*\|\s*[A-Za-z]{1,2}\s*\|\s*\d{1,2}$/.test(normalized);
}
