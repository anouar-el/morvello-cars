import { Vehicle } from '../types';

export type ExpiryAlertLevel = 'ok' | 'warning' | 'expired' | 'missing';

export interface ExpiryCheckResult {
  status: ExpiryAlertLevel;
  daysRemaining: number | null;
  text: string;
  badgeClass: string;
  badgeBg: string;
}

export interface OilChangeCheckResult {
  status: ExpiryAlertLevel;
  kmRemaining: number | null;
  text: string;
  badgeClass: string;
}

export interface VehicleHealthSummary {
  overallStatus: 'ok' | 'warning' | 'expired';
  hasAlert: boolean;
  criticalCount: number;
  warningCount: number;
  alerts: Array<{
    type: 'insurance' | 'inspection' | 'vignette' | 'oil';
    title: string;
    detail: string;
    level: 'warning' | 'expired';
  }>;
}

const DEFAULT_REF_DATE = '2026-09-01'; // Date de référence opérationnelle pour Morvello

/**
 * Calcule le nombre de jours restants avant une date d'échéance.
 */
export function getDaysDiff(targetDateStr?: string, refDateStr: string = DEFAULT_REF_DATE): number | null {
  if (!targetDateStr) return null;
  const target = new Date(targetDateStr);
  const ref = new Date(refDateStr);
  if (isNaN(target.getTime()) || isNaN(ref.getTime())) return null;

  const diffTime = target.getTime() - ref.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Suivi de l'assurance automobile
 * - Expire dans <= 0 j : Expiré (Rouge)
 * - Expire dans <= 30 j : À renouveler (Orange)
 * - > 30 j : Valide (Vert)
 */
export function checkInsuranceStatus(vehicle: Vehicle, refDate: string = DEFAULT_REF_DATE): ExpiryCheckResult {
  if (!vehicle.insuranceExpiryDate) {
    return {
      status: 'missing',
      daysRemaining: null,
      text: 'Non renseignée',
      badgeClass: 'text-slate-400 border-slate-700 bg-slate-800/40',
      badgeBg: 'bg-slate-500/20',
    };
  }

  const days = getDaysDiff(vehicle.insuranceExpiryDate, refDate);
  if (days === null) {
    return {
      status: 'missing',
      daysRemaining: null,
      text: 'Date invalide',
      badgeClass: 'text-slate-400 border-slate-700 bg-slate-800/40',
      badgeBg: 'bg-slate-500/20',
    };
  }

  if (days <= 0) {
    return {
      status: 'expired',
      daysRemaining: days,
      text: days === 0 ? "Expire aujourd'hui !" : `Expirée depuis ${Math.abs(days)} j`,
      badgeClass: 'text-rose-400 border-rose-500/40 bg-rose-500/10 font-bold',
      badgeBg: 'bg-rose-500',
    };
  }

  if (days <= 30) {
    return {
      status: 'warning',
      daysRemaining: days,
      text: `Expire dans ${days} jour${days > 1 ? 's' : ''}`,
      badgeClass: 'text-amber-400 border-amber-500/40 bg-amber-500/10 font-semibold',
      badgeBg: 'bg-amber-500',
    };
  }

  return {
    status: 'ok',
    daysRemaining: days,
    text: `Valide (${days} j restants)`,
    badgeClass: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
    badgeBg: 'bg-emerald-500',
  };
}

/**
 * Suivi du contrôle technique / Visite technique
 * - Expire dans <= 0 j : Expiré (Rouge)
 * - Expire dans <= 30 j : À programmer (Orange)
 * - > 30 j : En règle (Vert)
 */
export function checkTechnicalInspectionStatus(vehicle: Vehicle, refDate: string = DEFAULT_REF_DATE): ExpiryCheckResult {
  if (!vehicle.technicalInspectionExpiryDate) {
    return {
      status: 'missing',
      daysRemaining: null,
      text: 'Non renseignée',
      badgeClass: 'text-slate-400 border-slate-700 bg-slate-800/40',
      badgeBg: 'bg-slate-500/20',
    };
  }

  const days = getDaysDiff(vehicle.technicalInspectionExpiryDate, refDate);
  if (days === null) {
    return {
      status: 'missing',
      daysRemaining: null,
      text: 'Date invalide',
      badgeClass: 'text-slate-400 border-slate-700 bg-slate-800/40',
      badgeBg: 'bg-slate-500/20',
    };
  }

  if (days <= 0) {
    return {
      status: 'expired',
      daysRemaining: days,
      text: days === 0 ? "Expire aujourd'hui !" : `Expirée depuis ${Math.abs(days)} j`,
      badgeClass: 'text-rose-400 border-rose-500/40 bg-rose-500/10 font-bold',
      badgeBg: 'bg-rose-500',
    };
  }

  if (days <= 30) {
    return {
      status: 'warning',
      daysRemaining: days,
      text: `Expire dans ${days} jour${days > 1 ? 's' : ''}`,
      badgeClass: 'text-amber-400 border-amber-500/40 bg-amber-500/10 font-semibold',
      badgeBg: 'bg-amber-500',
    };
  }

  return {
    status: 'ok',
    daysRemaining: days,
    text: `En règle (${days} j restants)`,
    badgeClass: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
    badgeBg: 'bg-emerald-500',
  };
}

/**
 * Suivi de la taxe annuelle / Vignette fiscale
 * Au Maroc, la vignette est payée annuellement (généralement en janvier pour l'année courante).
 */
export function checkVignetteStatus(vehicle: Vehicle, currentYear: number = 2026): ExpiryCheckResult {
  if (!vehicle.vignettePaidYear) {
    return {
      status: 'warning',
      daysRemaining: null,
      text: `Vignette ${currentYear} à vérifier`,
      badgeClass: 'text-amber-400 border-amber-500/40 bg-amber-500/10',
      badgeBg: 'bg-amber-500',
    };
  }

  if (vehicle.vignettePaidYear < currentYear) {
    return {
      status: 'expired',
      daysRemaining: null,
      text: `Non payée pour ${currentYear} (payée ${vehicle.vignettePaidYear})`,
      badgeClass: 'text-rose-400 border-rose-500/40 bg-rose-500/10 font-bold',
      badgeBg: 'bg-rose-500',
    };
  }

  return {
    status: 'ok',
    daysRemaining: null,
    text: `Vignette ${vehicle.vignettePaidYear} payée`,
    badgeClass: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
    badgeBg: 'bg-emerald-500',
  };
}

/**
 * Suivi de la prochaine vidange moteur / révision kilométrique
 * - Si kilométrage actuel >= prochaine vidange : Dépassement (Rouge)
 * - Si moins de 1500 km restants : Proche (Orange)
 * - Sinon : OK (Vert)
 */
export function checkOilChangeStatus(vehicle: Vehicle): OilChangeCheckResult {
  if (!vehicle.nextOilChangeKm) {
    return {
      status: 'missing',
      kmRemaining: null,
      text: 'Non planifiée',
      badgeClass: 'text-slate-400 border-slate-700 bg-slate-800/40',
    };
  }

  const remainingKm = vehicle.nextOilChangeKm - vehicle.currentKm;

  if (remainingKm <= 0) {
    return {
      status: 'expired',
      kmRemaining: remainingKm,
      text: `Dépassée de ${Math.abs(remainingKm).toLocaleString('fr-FR')} KM`,
      badgeClass: 'text-rose-400 border-rose-500/40 bg-rose-500/10 font-bold',
    };
  }

  if (remainingKm <= 1500) {
    return {
      status: 'warning',
      kmRemaining: remainingKm,
      text: `À faire dans ${remainingKm.toLocaleString('fr-FR')} KM`,
      badgeClass: 'text-amber-400 border-amber-500/40 bg-amber-500/10 font-semibold',
    };
  }

  return {
    status: 'ok',
    kmRemaining: remainingKm,
    text: `${remainingKm.toLocaleString('fr-FR')} KM restants`,
    badgeClass: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
  };
}

/**
 * Synthèse globale de santé d'un véhicule
 */
export function getVehicleHealthSummary(vehicle: Vehicle, refDate: string = DEFAULT_REF_DATE): VehicleHealthSummary {
  const insurance = checkInsuranceStatus(vehicle, refDate);
  const inspection = checkTechnicalInspectionStatus(vehicle, refDate);
  const vignette = checkVignetteStatus(vehicle, 2026);
  const oil = checkOilChangeStatus(vehicle);

  const alerts: VehicleHealthSummary['alerts'] = [];

  if (insurance.status === 'expired' || insurance.status === 'warning') {
    alerts.push({
      type: 'insurance',
      title: 'Assurance',
      detail: insurance.text,
      level: insurance.status,
    });
  }

  if (inspection.status === 'expired' || inspection.status === 'warning') {
    alerts.push({
      type: 'inspection',
      title: 'Visite Technique',
      detail: inspection.text,
      level: inspection.status,
    });
  }

  if (vignette.status === 'expired' || vignette.status === 'warning') {
    alerts.push({
      type: 'vignette',
      title: 'Vignette',
      detail: vignette.text,
      level: vignette.status,
    });
  }

  if (oil.status === 'expired' || oil.status === 'warning') {
    alerts.push({
      type: 'oil',
      title: 'Vidange',
      detail: oil.text,
      level: oil.status,
    });
  }

  const criticalCount = alerts.filter((a) => a.level === 'expired').length;
  const warningCount = alerts.filter((a) => a.level === 'warning').length;

  let overallStatus: 'ok' | 'warning' | 'expired' = 'ok';
  if (criticalCount > 0) overallStatus = 'expired';
  else if (warningCount > 0) overallStatus = 'warning';

  return {
    overallStatus,
    hasAlert: alerts.length > 0,
    criticalCount,
    warningCount,
    alerts,
  };
}
