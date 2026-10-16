import { describe, expect, it } from 'vitest';
import { fitDimensions } from './imageResize';

describe('fitDimensions', () => {
  it('réduit en gardant les proportions', () => {
    expect(fitDimensions(4000, 3000, 720)).toEqual({ width: 720, height: 540 });
    expect(fitDimensions(3000, 4000, 720)).toEqual({ width: 540, height: 720 });
  });
  it("n'agrandit jamais une petite image", () => {
    expect(fitDimensions(300, 200, 720)).toEqual({ width: 300, height: 200 });
  });
  it('gère les dimensions invalides', () => {
    expect(fitDimensions(0, 100)).toEqual({ width: 0, height: 0 });
  });
});
