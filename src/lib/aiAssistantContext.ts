import type { Contract, DepositRecord, Vehicle } from '../types';
import {
  FRANCHISE_DAMAGE_RATE_PERCENT,
  INSURANCE_PACKS,
  VEHICLE_CATEGORIES,
  formatFranchise,
  getPackTerms,
  getVehicleCategory,
  resolveContractInsurance,
} from '../data/insurancePacks';
import { getDepositCollectionStatus } from '../utils/depositUtils';

/*
 * Contexte métier transmis à l'assistant IA. Tout ce qui demande un calcul de dates ou de montants
 * est calculé ici, de façon déterministe : le modèle n'a plus qu'à le restituer, ce qui évite
 * les erreurs de calendrier et les montants inventés.
 */

const TIME_ZONE = 'Africa/Casablanca';
const RECENT_CLOSED_DAYS = 45;
const EXPIRY_WARNING_DAYS = 30;
const OIL_CHANGE_WARNING_KM = 1000;

/** Date du jour au Maroc, au format AAAA-MM-JJ. */
export function todayInMorocco(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(`${fromIso.slice(0, 10)}T00:00:00Z`);
  const to = Date.parse(`${toIso.slice(0, 10)}T00:00:00Z`);
  return Math.round((to - from) / 86_400_000);
}

function formatDateFr(iso?: string): string {
  if (!iso) return 'N/C';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

function mad(n: number | undefined): string {
  return `${Math.round(Number(n) || 0).toLocaleString('fr-FR')} MAD`;
}

/** Date de retour effective : la prolongation accordée remplace la date initiale. */
export function effectiveReturn(c: Partial<Contract>): { date: string; time: string } {
  if (c.prolongation?.isActive && c.prolongation.newEndDate) {
    return { date: c.prolongation.newEndDate, time: c.prolongation.newEndTime || c.endTime || '' };
  }
  return { date: c.endDate || '', time: c.endTime || '' };
}

function isOpen(c: Partial<Contract>): boolean {
  return c.status === 'active' || c.status === 'draft';
}

function remainingOf(c: Partial<Contract>): number {
  if (c.remainingAmount !== undefined) return Number(c.remainingAmount) || 0;
  const paid = c.paidAmount ?? (c.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
  return Math.max(0, (Number(c.totalAmount) || 0) - paid);
}

function clientName(c: Partial<Contract>): string {
  return `${(c.clientSnapshot?.lastName || '').toUpperCase()} ${c.clientSnapshot?.firstName || ''}`.trim() || 'Client';
}

function vehicleLabel(c: Partial<Contract>): string {
  const v = c.vehicleSnapshot;
  return v ? `${v.brand} ${v.model} (${v.plate})` : 'Véhicule N/C';
}

export interface AssistantDigest {
  today: string;
  departuresToday: string[];
  returnsToday: string[];
  returnsTomorrow: string[];
  overdue: string[];
  depositsNotCollected: string[];
  unpaidBalances: string[];
  vehicleAlerts: string[];
}

/** Alertes opérationnelles calculées à partir des données réelles. */
export function buildAssistantDigest(
  now: Date,
  vehicles: Partial<Vehicle>[],
  contracts: Partial<Contract>[]
): AssistantDigest {
  const today = todayInMorocco(now);
  const year = Number(today.slice(0, 4));
  const digest: AssistantDigest = {
    today,
    departuresToday: [],
    returnsToday: [],
    returnsTomorrow: [],
    overdue: [],
    depositsNotCollected: [],
    unpaidBalances: [],
    vehicleAlerts: [],
  };

  for (const c of contracts) {
    if (!isOpen(c)) continue;
    const ret = effectiveReturn(c);
    const who = `${c.contractNumber} · ${clientName(c)} · ${vehicleLabel(c)}`;
    if (c.startDate && daysBetween(today, c.startDate) === 0) digest.departuresToday.push(`${who} · départ ${c.startTime || ''}`.trim());
    if (ret.date) {
      const d = daysBetween(today, ret.date);
      if (d === 0) digest.returnsToday.push(`${who} · retour ${ret.time}`.trim());
      else if (d === 1) digest.returnsTomorrow.push(`${who} · retour ${ret.time}`.trim());
      else if (d < 0 && c.status === 'active') digest.overdue.push(`${who} · retour prévu le ${formatDateFr(ret.date)} (${-d} j de retard)`);
    }
    if (getDepositCollectionStatus(c) === 'not_collected') {
      digest.depositsNotCollected.push(`${who} · caution de ${mad(c.depositAmount)} non prise`);
    }
    const remaining = remainingOf(c);
    if (remaining > 0) digest.unpaidBalances.push(`${who} · reste à encaisser ${mad(remaining)}`);
  }

  for (const v of vehicles) {
    const label = `${v.brand} ${v.model} (${v.plate})`;
    const checks: [string | undefined, string][] = [
      [v.insuranceExpiryDate, `assurance ${v.insuranceCompany || ''}`.trim()],
      [v.technicalInspectionExpiryDate, 'visite technique'],
    ];
    for (const [date, what] of checks) {
      if (!date) continue;
      const d = daysBetween(today, date);
      if (d < 0) digest.vehicleAlerts.push(`${label} · ${what} EXPIRÉE depuis le ${formatDateFr(date)}`);
      else if (d <= EXPIRY_WARNING_DAYS) digest.vehicleAlerts.push(`${label} · ${what} expire le ${formatDateFr(date)} (dans ${d} j)`);
    }
    if (v.nextOilChangeKm && v.currentKm !== undefined) {
      const left = v.nextOilChangeKm - v.currentKm;
      if (left <= OIL_CHANGE_WARNING_KM) {
        digest.vehicleAlerts.push(
          left < 0
            ? `${label} · vidange dépassée de ${(-left).toLocaleString('fr-FR')} km`
            : `${label} · vidange dans ${left.toLocaleString('fr-FR')} km`
        );
      }
    }
    if (v.vignettePaidYear && v.vignettePaidYear < year) {
      digest.vehicleAlerts.push(`${label} · vignette ${year} non payée (dernière : ${v.vignettePaidYear})`);
    }
  }

  return digest;
}

function section(title: string, lines: string[], empty: string): string {
  return `${title} (${lines.length}) :\n${lines.length ? lines.map((l) => `• ${l}`).join('\n') : `• ${empty}`}`;
}

/** Grille des packs d'assurance, montants en MAD. */
export function describeInsuranceGrid(): string {
  const rows = VEHICLE_CATEGORIES.map((cat) => {
    const packs = INSURANCE_PACKS.map((p) => {
      const t = getPackTerms(cat.id, p.id);
      const suppl = t.dailySupplementMad === 0 ? 'inclus' : `+${t.dailySupplementMad} MAD/j`;
      return `${p.label} (${suppl}) : franchise min. ${mad(t.franchiseMad)}, caution ${t.depositMad === 0 ? 'aucune' : mad(t.depositMad)}`;
    }).join(' | ');
    return `• ${cat.label} (${cat.examples}) → ${packs}`;
  });
  return [
    `Franchise = ${FRANCHISE_DAMAGE_RATE_PERCENT} % du montant des dégâts, jamais inférieure au minimum du pack.`,
    ...INSURANCE_PACKS.map((p) => `• ${p.label} : ${p.coverage}`),
    ...rows,
  ].join('\n');
}

function describeVehicle(v: Partial<Vehicle>): string {
  const cat = getVehicleCategory(v as Vehicle);
  return [
    `[${v.id}] ${v.brand} ${v.model}`,
    `Immat: ${v.plate}`,
    `Statut: ${v.status}`,
    `Gamme: ${VEHICLE_CATEGORIES.find((c) => c.id === cat)?.label}`,
    `Carburant: ${v.fuelType}`,
    `Km: ${(v.currentKm ?? 0).toLocaleString('fr-FR')}`,
    `Tarif: ${v.dailyRate ? `${v.dailyRate} MAD/j` : 'N/C'}`,
    v.color ? `Couleur: ${v.color}` : '',
    v.year ? `Année: ${v.year}` : '',
    `Assurance: ${v.insuranceCompany || 'N/C'} (exp. ${formatDateFr(v.insuranceExpiryDate)})`,
    `Visite tech.: ${formatDateFr(v.technicalInspectionExpiryDate)}`,
    v.assignedManagerName ? `Responsable: ${v.assignedManagerName}` : '',
  ]
    .filter(Boolean)
    .join(' | ');
}

function describeContract(c: Partial<Contract>): string {
  const ret = effectiveReturn(c);
  const ins = c.vehicleSnapshot ? resolveContractInsurance(c as Contract) : undefined;
  const deposit = getDepositCollectionStatus(c);
  return [
    `Contrat ${c.contractNumber} (${c.status})`,
    `Client: ${clientName(c)} (Tél: ${c.clientSnapshot?.phone || 'N/C'})`,
    c.hasSecondDriver && c.secondDriverSnapshot ? `2e conducteur: ${c.secondDriverSnapshot.lastName} ${c.secondDriverSnapshot.firstName}` : '',
    `Véhicule: ${vehicleLabel(c)}`,
    `Départ: ${formatDateFr(c.startDate)} ${c.startTime || ''}`.trim(),
    `Retour: ${formatDateFr(ret.date)} ${ret.time}${c.prolongation?.isActive ? ' (prolongé)' : ''}`.trim(),
    `Durée: ${c.totalDays ?? 'N/C'} j`,
    c.pricePerDay ? `Tarif: ${c.pricePerDay} MAD/j` : '',
    `Total: ${mad(c.totalAmount)} · Reste à encaisser: ${mad(remainingOf(c))}`,
    ins ? `Assurance: ${ins.packLabel} (franchise ${formatFranchise(ins)})` : '',
    deposit === 'none' ? 'Caution: aucune' : `Caution: ${mad(c.depositAmount)} (${deposit === 'collected' ? 'prise' : 'NON prise'})`,
    c.managerPhone ? `Tél. responsable: ${c.managerPhone}` : '',
  ]
    .filter(Boolean)
    .join(' | ');
}

const DEPOSIT_STATUS_FR: Record<string, string> = {
  held: 'détenue',
  released: 'restituée',
  partially_deducted: 'partiellement retenue',
  fully_retained: 'totalement retenue',
};

/** Section « données » complète de l'invite système. */
export function buildAssistantDataSection(
  now: Date,
  data: {
    vehicles: Partial<Vehicle>[];
    contracts: Partial<Contract>[];
    deposits: Partial<DepositRecord>[];
  }
): string {
  const digest = buildAssistantDigest(now, data.vehicles, data.contracts);
  const today = digest.today;

  // Contrats en cours + contrats clôturés récemment ; les plus anciens sont seulement comptés.
  const relevant = data.contracts.filter((c) => {
    if (isOpen(c)) return true;
    const end = effectiveReturn(c).date || c.returnDate || '';
    return end ? daysBetween(end, today) <= RECENT_CLOSED_DAYS : false;
  });
  const omitted = data.contracts.length - relevant.length;

  const available = data.vehicles.filter((v) => v.status === 'available').length;
  const rented = data.vehicles.filter((v) => v.status === 'rented').length;

  return `DATE DU JOUR (Maroc) : ${formatDateFr(today)}

TABLEAU DE BORD CALCULÉ (fiable, à utiliser en priorité) :
Flotte : ${data.vehicles.length} véhicule(s) · ${available} disponible(s) · ${rented} loué(s)
${section('Départs aujourd’hui', digest.departuresToday, 'aucun')}
${section('Retours aujourd’hui', digest.returnsToday, 'aucun')}
${section('Retours demain', digest.returnsTomorrow, 'aucun')}
${section('Retours EN RETARD', digest.overdue, 'aucun')}
${section('Cautions NON prises', digest.depositsNotCollected, 'aucune')}
${section('Soldes restant à encaisser', digest.unpaidBalances, 'aucun')}
${section('Alertes véhicules (assurance, visite technique, vidange, vignette)', digest.vehicleAlerts, 'aucune')}

GRILLE DES PACKS D'ASSURANCE (montants en MAD) :
${describeInsuranceGrid()}

VÉHICULES (${data.vehicles.length}) :
${data.vehicles.length ? data.vehicles.map((v) => `• ${describeVehicle(v)}`).join('\n') : '• Aucun véhicule.'}

CONTRATS EN COURS ET RÉCENTS (${relevant.length}${omitted > 0 ? `, ${omitted} contrat(s) plus ancien(s) non détaillé(s)` : ''}) :
${relevant.length ? relevant.map((c) => `• ${describeContract(c)}`).join('\n') : '• Aucun contrat.'}

CAUTIONS ENREGISTRÉES (${data.deposits.length}) :
${
  data.deposits.length
    ? data.deposits
        .map(
          (d) =>
            `• Contrat ${d.contractNumber} · ${d.clientName || 'Client'} · ${mad(d.amount)} · ${d.methodDetails || d.method || 'N/C'} · ${
              DEPOSIT_STATUS_FR[d.status || ''] || d.status || 'N/C'
            }`
        )
        .join('\n')
    : '• Aucune.'
}`;
}
