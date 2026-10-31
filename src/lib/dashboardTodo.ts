import type { Contract } from '../types';
import { remainingOf } from './assistantActions';

/** Date de retour effective d'un contrat (prolongation comprise), au format AAAA-MM-JJ. */
export function effectiveEndDate(contract: Contract): string {
  return contract.prolongation?.isActive && contract.prolongation.newEndDate ? contract.prolongation.newEndDate : contract.endDate;
}

export interface TodaySummary {
  /** Locations dont le retour était prévu avant aujourd'hui. */
  overdue: Contract[];
  /** Locations dont le retour est prévu aujourd'hui. */
  dueToday: Contract[];
  /** Contrats (en cours ou terminés) avec un reste à payer. */
  unpaid: { count: number; total: number };
}

/** Ce qu'il y a à traiter aujourd'hui ; les retards sont triés du plus ancien au plus récent. */
export function summarizeToday(contracts: Contract[], todayStr: string): TodaySummary {
  const active = contracts.filter((c) => c.status === 'active');
  const byEnd = (a: Contract, b: Contract) => effectiveEndDate(a).localeCompare(effectiveEndDate(b));

  const overdue = active.filter((c) => effectiveEndDate(c) < todayStr).sort(byEnd);
  const dueToday = active.filter((c) => effectiveEndDate(c) === todayStr);

  let count = 0;
  let total = 0;
  for (const c of contracts) {
    if (c.status !== 'active' && c.status !== 'completed') continue;
    const rest = remainingOf(c);
    if (rest > 0) {
      count += 1;
      total += rest;
    }
  }

  return { overdue, dueToday, unpaid: { count, total } };
}
