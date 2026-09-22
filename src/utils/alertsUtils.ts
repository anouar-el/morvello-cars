import { Vehicle, Contract, DepositRecord } from '../types';
import { getVehicleHealthSummary, getTodayDateString } from './vehicleExpiryUtils';

export type AlertSeverity = 'critical' | 'warning' | 'info';

export type AlertCategory = 
  | 'return_overdue' 
  | 'return_today' 
  | 'return_upcoming' 
  | 'insurance_expired' 
  | 'insurance_warning' 
  | 'inspection_expired' 
  | 'inspection_warning' 
  | 'vignette_warning' 
  | 'oil_change_warning'
  | 'deposit_held';

export interface OperationalAlert {
  id: string;
  category: AlertCategory;
  severity: AlertSeverity;
  title: string;
  description: string;
  targetTab: 'contracts' | 'vehicles' | 'deposits';
  entityId: string;
  dateStr?: string;
  badgeText: string;
  contract?: Contract;
  vehicle?: Vehicle;
  deposit?: DepositRecord;
}

export const DEFAULT_REF_DATE = getTodayDateString();

/**
 * Analyse proactive de l'ensemble de la flotte et des contrats pour générer
 * les alertes opérationnelles prioritaires.
 */
export function computeOperationalAlerts(
  vehicles: Vehicle[],
  contracts: Contract[],
  deposits: DepositRecord[],
  refDate: string = DEFAULT_REF_DATE
): {
  alerts: OperationalAlert[];
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  returnsCount: number;
  complianceCount: number;
} {
  const alerts: OperationalAlert[] = [];

  // 1. Alertes sur les contrats et retours
  const activeContracts = contracts.filter((c) => c.status === 'active');

  activeContracts.forEach((contract) => {
    const effectiveEnd = contract.prolongation?.isActive
      ? contract.prolongation.newEndDate
      : contract.endDate;

    const targetDate = new Date(effectiveEnd);
    const ref = new Date(refDate);
    const diffDays = Math.ceil((targetDate.getTime() - ref.getTime()) / (1000 * 60 * 60 * 24));

    const vehicleTitle = `${contract.vehicleSnapshot.brand} ${contract.vehicleSnapshot.model} (${contract.vehicleSnapshot.plate})`;
    const clientTitle = `${contract.clientSnapshot.lastName} ${contract.clientSnapshot.firstName}`;

    if (diffDays < 0) {
      // Retard de restitution (critique)
      alerts.push({
        id: `return-overdue-${contract.id}`,
        category: 'return_overdue',
        severity: 'critical',
        title: `Retard de restitution : ${vehicleTitle}`,
        description: `Contrat #${contract.contractNumber} (${clientTitle}) devait être restitué le ${effectiveEnd} (en retard de ${Math.abs(diffDays)} j).`,
        targetTab: 'contracts',
        entityId: contract.id,
        dateStr: effectiveEnd,
        badgeText: `Retard ${Math.abs(diffDays)}j`,
        contract,
      });
    } else if (diffDays === 0) {
      // Restitution prévue aujourd'hui
      alerts.push({
        id: `return-today-${contract.id}`,
        category: 'return_today',
        severity: 'warning',
        title: `Restitution attendue aujourd'hui : ${vehicleTitle}`,
        description: `Contrat #${contract.contractNumber} (${clientTitle}) à réceptionner avant ${contract.endTime || '18:00'}.`,
        targetTab: 'contracts',
        entityId: contract.id,
        dateStr: effectiveEnd,
        badgeText: "Aujourd'hui",
        contract,
      });
    } else if (diffDays <= 2) {
      // Restitution imminente sous 48h
      alerts.push({
        id: `return-upcoming-${contract.id}`,
        category: 'return_upcoming',
        severity: 'info',
        title: `Restitution sous ${diffDays}j : ${vehicleTitle}`,
        description: `Contrat #${contract.contractNumber} (${clientTitle}) - Fin prévue le ${effectiveEnd}.`,
        targetTab: 'contracts',
        entityId: contract.id,
        dateStr: effectiveEnd,
        badgeText: `Dans ${diffDays}j`,
        contract,
      });
    }
  });

  // 2. Alertes sur la conformité des véhicules (Assurances, Visite technique, Vidange)
  vehicles.forEach((vehicle) => {
    const health = getVehicleHealthSummary(vehicle, refDate);
    if (health.hasAlert) {
      health.alerts.forEach((alertItem, idx) => {
        const isCritical = alertItem.level === 'expired';
        const sev: AlertSeverity = isCritical ? 'critical' : 'warning';
        let category: AlertCategory = 'insurance_warning';

        if (alertItem.type === 'insurance') {
          category = isCritical ? 'insurance_expired' : 'insurance_warning';
        } else if (alertItem.type === 'inspection') {
          category = isCritical ? 'inspection_expired' : 'inspection_warning';
        } else if (alertItem.type === 'oil') {
          category = 'oil_change_warning';
        } else if (alertItem.type === 'vignette') {
          category = 'vignette_warning';
        }

        alerts.push({
          id: `veh-${vehicle.id}-${alertItem.type}-${idx}`,
          category,
          severity: sev,
          title: `${vehicle.brand} ${vehicle.model} (${vehicle.plate}) : ${alertItem.title}`,
          description: alertItem.detail,
          targetTab: 'vehicles',
          entityId: vehicle.id,
          badgeText: isCritical ? 'Expiré' : 'À planifier',
          vehicle,
        });
      });
    }
  });

  // 3. Alertes sur les cautions conservées (sur contrat clôturé non libéré OU contrat arrivant à échéance)
  deposits.forEach((dep) => {
    if (dep.status === 'held') {
      const parentContract = contracts.find((c) => c.id === dep.contractId || c.contractNumber === dep.contractNumber);
      if (parentContract) {
        const effectiveEnd = parentContract.prolongation?.isActive
          ? parentContract.prolongation.newEndDate
          : parentContract.endDate;
        const targetDate = new Date(effectiveEnd);
        const ref = new Date(refDate);
        const diffDays = Math.ceil((targetDate.getTime() - ref.getTime()) / (1000 * 60 * 60 * 24));

        if (parentContract.status === 'completed') {
          alerts.push({
            id: `dep-held-${dep.id}`,
            category: 'deposit_held',
            severity: 'warning',
            title: `Caution non libérée sur contrat clôturé : ${dep.clientName}`,
            description: `Caution de ${dep.amount.toLocaleString('fr-FR')} MAD (#${dep.contractNumber}) non libérée alors que le contrat est terminé.`,
            targetTab: 'deposits',
            entityId: dep.id,
            badgeText: 'À libérer',
            deposit: dep,
          });
        } else if (parentContract.status === 'active' && diffDays <= 0) {
          alerts.push({
            id: `dep-due-${dep.id}`,
            category: 'deposit_held',
            severity: 'warning',
            title: `Caution à traiter lors de la restitution : ${dep.clientName}`,
            description: `Caution de ${dep.amount.toLocaleString('fr-FR')} MAD (#${dep.contractNumber}) à restituer ou déduire lors du retour prévu aujourd'hui.`,
            targetTab: 'deposits',
            entityId: dep.id,
            badgeText: 'Caution à traiter',
            deposit: dep,
          });
        }
      }
    }
  });

  // Tri : Critical d'abord, puis Warning, puis Info
  const severityOrder: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  const criticalCount = alerts.filter((a) => a.severity === 'critical').length;
  const warningCount = alerts.filter((a) => a.severity === 'warning').length;
  const infoCount = alerts.filter((a) => a.severity === 'info').length;
  const returnsCount = alerts.filter((a) => a.category.startsWith('return_')).length;
  const complianceCount = alerts.filter((a) => !a.category.startsWith('return_') && a.targetTab === 'vehicles').length;

  return {
    alerts,
    criticalCount,
    warningCount,
    infoCount,
    returnsCount,
    complianceCount,
  };
}
