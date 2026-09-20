import { describe, it, expect } from 'vitest';
import {
  parseContractNumber,
  getNextAvailableContractNumber,
  reconcileCompanySettingsWithContracts,
  findDuplicateContractNumbers,
  repairAndDeduplicateContracts,
} from './contractNumberUtils';
import { Contract, CompanySettings, DepositRecord } from '../types';

describe('contractNumberUtils', () => {
  const baseSettings: CompanySettings = {
    name: 'Morvello Cars',
    taxId: '123',
    rc: '456',
    ice: '789',
    address: 'Casablanca',
    phone1: '0600000000',
    phone2: '',
    website: '',
    email: '',
    contractPrefix: 'MC',
    contractYear: 2026,
    nextContractNumber: 50,
    defaultContractTemplate: 'standard',
  };

  it('parses contract numbers correctly', () => {
    const parsed = parseContractNumber('MC-2026-0050');
    expect(parsed).toEqual({
      raw: 'MC-2026-0050',
      prefix: 'MC',
      year: 2026,
      sequence: 50,
    });

    const parsedSingleDigit = parseContractNumber('MC-2026-1');
    expect(parsedSingleDigit?.sequence).toBe(1);

    expect(parseContractNumber('')).toBeNull();
    expect(parseContractNumber(undefined)).toBeNull();
  });

  it('generates next unique contract number even if settings point to an already existing number', () => {
    const existingContracts: Partial<Contract>[] = [
      { id: 'cnt-1', contractNumber: 'MC-2026-0050' },
      { id: 'cnt-2', contractNumber: 'MC-2026-0051' },
    ];

    // Settings says 50, but 50 and 51 already exist!
    const result = getNextAvailableContractNumber(
      existingContracts as Contract[],
      baseSettings // has nextContractNumber: 50
    );

    expect(result.nextSequence).toBe(52);
    expect(result.formattedContractNumber).toBe('MC-2026-0052');
  });

  it('generates the configured number if it is higher than any existing contract', () => {
    const existingContracts: Partial<Contract>[] = [
      { id: 'cnt-1', contractNumber: 'MC-2026-0010' },
    ];

    const result = getNextAvailableContractNumber(
      existingContracts as Contract[],
      { ...baseSettings, nextContractNumber: 60 }
    );

    expect(result.nextSequence).toBe(60);
    expect(result.formattedContractNumber).toBe('MC-2026-0060');
  });

  it('detects duplicate contract numbers', () => {
    const contracts: Partial<Contract>[] = [
      { id: 'cnt-1', contractNumber: 'MC-2026-0050', createdAt: '2026-09-01T10:00:00Z' },
      { id: 'cnt-2', contractNumber: 'MC-2026-0050', createdAt: '2026-09-02T10:00:00Z' },
      { id: 'cnt-3', contractNumber: 'MC-2026-0051', createdAt: '2026-09-03T10:00:00Z' },
    ];

    const duplicates = findDuplicateContractNumbers(contracts as Contract[]);
    expect(duplicates.length).toBe(1);
    expect(duplicates[0].contractNumber).toBe('MC-2026-0050');
    expect(duplicates[0].contracts.length).toBe(2);
  });

  it('repairs duplicates and updates linked deposits and settings', () => {
    const contracts: Partial<Contract>[] = [
      { id: 'cnt-1', contractNumber: 'MC-2026-0050', createdAt: '2026-09-01T10:00:00Z' },
      { id: 'cnt-2', contractNumber: 'MC-2026-0050', createdAt: '2026-09-02T10:00:00Z' },
    ];

    const deposits: Partial<DepositRecord>[] = [
      { id: 'dep-1', contractId: 'cnt-1', contractNumber: 'MC-2026-0050' },
      { id: 'dep-2', contractId: 'cnt-2', contractNumber: 'MC-2026-0050', notes: 'Caution MC-2026-0050' },
    ];

    const repaired = repairAndDeduplicateContracts(
      contracts as Contract[],
      deposits as DepositRecord[],
      baseSettings
    );

    expect(repaired.renumberedCount).toBe(1);
    // Earliest contract keeps 0050
    expect(repaired.repairedContracts.find((c) => c.id === 'cnt-1')?.contractNumber).toBe('MC-2026-0050');
    // Later duplicate gets 0051
    expect(repaired.repairedContracts.find((c) => c.id === 'cnt-2')?.contractNumber).toBe('MC-2026-0051');
    // Linked deposit for cnt-2 gets updated to 0051
    expect(repaired.repairedDeposits.find((d) => d.contractId === 'cnt-2')?.contractNumber).toBe('MC-2026-0051');
    // Updated settings should be at least 52
    expect(repaired.updatedCompanySettings.nextContractNumber).toBe(52);
  });
});
