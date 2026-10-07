import { describe, expect, it } from 'vitest';
import { ActiveTab } from '../types';
import { pathForTab, tabForPath } from './tabRoutes';

describe('tabRoutes', () => {
  it('gives every navigable section its own address and reads it back', () => {
    const tabs: ActiveTab[] = [
      'dashboard',
      'contracts',
      'new_contract',
      'deposits',
      'clients',
      'vehicles',
      'ai_assistant',
      'terms',
      'permissions',
      'contract_templates',
      'audit',
      'settings',
    ];

    const paths = tabs.map(pathForTab);

    expect(new Set(paths).size).toBe(tabs.length);
    expect(paths.map(tabForPath)).toEqual(tabs);
  });

  it('tolerates a trailing slash and upper case', () => {
    expect(tabForPath('/contrats/')).toBe('contracts');
    expect(tabForPath('/Contrats/Nouveau')).toBe('new_contract');
  });

  it('opens the dashboard for an unknown address', () => {
    expect(tabForPath('/inconnu')).toBe('dashboard');
    expect(tabForPath('/contrats/123')).toBe('dashboard');
    expect(tabForPath('')).toBe('dashboard');
  });

  it('keeps sections without a screen of their own on the dashboard address', () => {
    expect(pathForTab('contract_detail')).toBe('/');
  });
});
