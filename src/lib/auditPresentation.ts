import type { AuditLog } from '../types';

/*
 * Mise en forme du journal d'audit : catégories lisibles, dates relatives, filtres par agent et par
 * période, export CSV. Ne modifie jamais les entrées.
 */

export type AuditCategory = 'contrats' | 'clients' | 'vehicules' | 'cautions' | 'parametres' | 'acces' | 'autres';
export type AuditPeriod = 'all' | 'today' | '7d' | '30d';

export const CATEGORY_LABELS: Record<AuditCategory, string> = {
  contrats: 'Contrats',
  clients: 'Clients',
  vehicules: 'Véhicules',
  cautions: 'Cautions & paiements',
  parametres: 'Paramètres & conditions',
  acces: 'Accès & permissions',
  autres: 'Autres',
};

export const PERIOD_LABELS: Record<AuditPeriod, string> = {
  all: 'Toute la période',
  today: 'Aujourd’hui',
  '7d': '7 derniers jours',
  '30d': '30 derniers jours',
};

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

export function categorize(log: Pick<AuditLog, 'action' | 'targetType' | 'details'>): AuditCategory {
  const text = norm(`${log.action} ${log.details || ''}`);
  if (/caution|depot|paiement|reglement|encaiss|solde/.test(text)) return 'cautions';

  switch (log.targetType) {
    case 'contract':
    case 'contract_template':
      return log.targetType === 'contract_template' ? 'parametres' : 'contrats';
    case 'client':
    case 'driver':
      return 'clients';
    case 'vehicle':
    case 'maintenance_expense':
      return 'vehicules';
    case 'user_permission':
      return 'acces';
    case 'terms':
    case 'settings':
      return 'parametres';
    default:
      return 'autres';
  }
}

const pad = (n: number) => String(n).padStart(2, '0');

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Entrée dont l'horodatage est illisible : on la garde, sans date. */
export function parseTimestamp(value: string): Date | null {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** « Aujourd'hui 14:32 », « Hier 09:10 » ou « 12/10/2026 16:05 ». */
export function formatWhen(value: string, now: Date = new Date()): string {
  const d = parseTimestamp(value);
  if (!d) return value || 'Date inconnue';
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (dayKey(d) === dayKey(now)) return `Aujourd’hui ${time}`;
  if (dayKey(d) === dayKey(yesterday)) return `Hier ${time}`;
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${time}`;
}

/** Titre de groupe : « Aujourd'hui », « Hier » ou « mardi 13 octobre 2026 ». */
export function formatDayHeading(value: string, now: Date = new Date()): string {
  const d = parseTimestamp(value);
  if (!d) return 'Date inconnue';
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (dayKey(d) === dayKey(now)) return 'Aujourd’hui';
  if (dayKey(d) === dayKey(yesterday)) return 'Hier';
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export interface AuditFilters {
  query: string;
  category: AuditCategory | 'all';
  user: string; // nom exact, ou 'all'
  period: AuditPeriod;
}

export function filterAuditLogs(logs: AuditLog[], f: AuditFilters, now: Date = new Date()): AuditLog[] {
  const q = norm(f.query.trim());
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const since =
    f.period === 'today' ? startOfToday : f.period === '7d' ? startOfToday - 6 * 86_400_000 : f.period === '30d' ? startOfToday - 29 * 86_400_000 : null;

  return logs.filter((log) => {
    if (f.category !== 'all' && categorize(log) !== f.category) return false;
    if (f.user !== 'all' && log.userName !== f.user) return false;
    if (since !== null) {
      const d = parseTimestamp(log.timestamp);
      if (!d || d.getTime() < since) return false;
    }
    if (!q) return true;
    return norm(`${log.action} ${log.userName} ${log.userRole} ${log.targetId} ${log.details}`).includes(q);
  });
}

/** Regroupe par jour, dans l'ordre reçu (le journal est déjà du plus récent au plus ancien). */
export function groupByDay(logs: AuditLog[], now: Date = new Date()): { heading: string; logs: AuditLog[] }[] {
  const groups: { key: string; heading: string; logs: AuditLog[] }[] = [];
  for (const log of logs) {
    const d = parseTimestamp(log.timestamp);
    const key = d ? dayKey(d) : 'unknown';
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.logs.push(log);
    else groups.push({ key, heading: formatDayHeading(log.timestamp, now), logs: [log] });
  }
  return groups.map(({ heading, logs: l }) => ({ heading, logs: l }));
}

function csvCell(value: unknown): string {
  const s = String(value ?? '');
  // Neutralise l'injection de formules dans Excel / Sheets.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function auditLogsToCsv(logs: AuditLog[]): string {
  const header = ['Date', 'Agent', 'Rôle', 'Catégorie', 'Action', 'Cible', 'Détails'];
  const rows = logs.map((l) => [
    l.timestamp,
    l.userName,
    l.userRole,
    CATEGORY_LABELS[categorize(l)],
    l.action,
    l.targetId,
    l.details,
  ]);
  return [header, ...rows].map((r) => r.map(csvCell).join(';')).join('\r\n');
}
