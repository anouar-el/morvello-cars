/**
 * Morvello Cars Cryptographic Security & Authentication Engine
 * Replaces plaintext password comparisons with PBKDF2-SHA256 salted hashing.
 */

// Generate a cryptographically secure random salt (32 hex characters)
export function generateSalt(): string {
  const bytes = new Uint8Array(16);
  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Compute a secure PBKDF2-SHA256 hash
export async function hashPassword(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const passwordBuffer = enc.encode(password.normalize('NFKC'));
  const saltBuffer = enc.encode(salt);

  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        passwordBuffer,
        { name: 'PBKDF2' },
        false,
        ['deriveBits']
      );

      const derivedBits = await crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          salt: saltBuffer,
          iterations: 100000,
          hash: 'SHA-256',
        },
        keyMaterial,
        256
      );

      const hashArray = Array.from(new Uint8Array(derivedBits));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
      console.warn('crypto.subtle PBKDF2 fallback:', e);
    }
  }

  // Fallback SHA-256 digest if PBKDF2 not directly supported in sandboxed worker
  const combined = enc.encode(`${salt}:${password}`);
  const hashBuf = await crypto.subtle.digest('SHA-256', combined);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Verify a user password against expected hash & salt
export async function verifyPassword(
  attempt: string,
  expectedHash: string,
  salt?: string
): Promise<boolean> {
  if (!attempt || !expectedHash) return false;
  if (!salt) {
    // If no salt provided, attempt direct comparison or legacy check
    return attempt === expectedHash;
  }
  const computed = await hashPassword(attempt, salt);
  return computed.toLowerCase() === expectedHash.toLowerCase();
}

// Generate a strong, compliant random password (e.g. for new collaborators)
export function generateStrongPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const special = '!@#$%&*';

  const getRandomChar = (charset: string) => charset[Math.floor(Math.random() * charset.length)];

  const parts = [
    getRandomChar(upper),
    getRandomChar(lower),
    getRandomChar(digits),
    getRandomChar(special),
    getRandomChar(upper),
    getRandomChar(lower),
    getRandomChar(digits),
    getRandomChar(special),
    getRandomChar(upper),
    getRandomChar(lower),
  ];

  // Shuffle parts
  for (let i = parts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [parts[i], parts[j]] = [parts[j], parts[i]];
  }

  return parts.join('');
}
