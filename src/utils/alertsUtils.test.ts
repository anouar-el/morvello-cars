import { describe, it, expect } from 'vitest';
import { computeOperationalAlerts } from './alertsUtils';

describe('computeOperationalAlerts', () => {
  it('returns no alerts when the authenticated workspace has no records', () => {
    const { alerts } = computeOperationalAlerts([], [], [], '2026-09-22');
    expect(alerts).toEqual([]);
  });
});
