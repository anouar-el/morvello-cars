import { describe, expect, it } from 'vitest';
import { INSTALL_SNOOZE_DAYS, isIosSafari, isSnoozed } from './pwaInstall';

const DAY = 24 * 60 * 60 * 1000;

describe('isSnoozed', () => {
  const now = 1_700_000_000_000;
  it('ne masque rien sans refus enregistré', () => {
    expect(isSnoozed(null, now)).toBe(false);
    expect(isSnoozed('abc', now)).toBe(false);
  });
  it("masque l'invitation pendant le délai, puis la ré-affiche", () => {
    expect(isSnoozed(String(now - 2 * DAY), now)).toBe(true);
    expect(isSnoozed(String(now - (INSTALL_SNOOZE_DAYS + 1) * DAY), now)).toBe(false);
  });
});

describe('isIosSafari', () => {
  it('reconnaît Safari sur iPhone', () => {
    expect(
      isIosSafari('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1')
    ).toBe(true);
  });
  it('écarte Chrome iOS et Android', () => {
    expect(
      isIosSafari('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0 Mobile/15E148 Safari/604.1')
    ).toBe(false);
    expect(isIosSafari('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36')).toBe(false);
  });
});
