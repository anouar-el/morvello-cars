import { describe, expect, it } from 'vitest';
import { ASSISTANT_IMAGE_LIMITS, sanitizeImages } from './assistantServer';

const ok = { mimeType: 'image/jpeg', data: 'QUJDREVGRw==' };

describe('sanitizeImages', () => {
  it('keeps valid photos and drops the rest', () => {
    expect(sanitizeImages([ok, { mimeType: 'image/png', data: 'QUJD' }])).toHaveLength(2);
    expect(sanitizeImages('nope')).toEqual([]);
    expect(sanitizeImages([{ mimeType: 'application/pdf', data: 'QUJD' }])).toEqual([]);
    expect(sanitizeImages([{ mimeType: 'image/jpeg', data: 'data:image/jpeg;base64,QUJD' }])).toEqual([]);
    expect(sanitizeImages([{ mimeType: 'image/jpeg', data: '' }, null, 42])).toEqual([]);
  });

  it('caps the number and the size of photos', () => {
    expect(sanitizeImages([ok, ok, ok, ok, ok])).toHaveLength(ASSISTANT_IMAGE_LIMITS.count);
    const huge = { mimeType: 'image/jpeg', data: 'A'.repeat(ASSISTANT_IMAGE_LIMITS.charsEach + 1) };
    expect(sanitizeImages([huge])).toEqual([]);
    const big = { mimeType: 'image/jpeg', data: 'A'.repeat(ASSISTANT_IMAGE_LIMITS.charsEach) };
    expect(sanitizeImages([big, big, big])).toHaveLength(2);
  });
});