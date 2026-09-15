import React from 'react';
import { Vehicle } from '../../types';
import {
  checkInsuranceStatus,
  checkTechnicalInspectionStatus,
  checkVignetteStatus,
  checkOilChangeStatus,
  getVehicleHealthSummary,
} from '../../utils/vehicleExpiryUtils';
import { Shield, FileCheck, Award, Wrench, AlertTriangle, CheckCircle2, AlertOctagon, Receipt, ChevronRight } from 'lucide-react';

interface VehicleCompliancePanelProps {
  vehicle: Vehicle;
  compact?: boolean;
  onOpenMaintenanceModal?: () => void;
}

export const VehicleCompliancePanel: React.FC<VehicleCompliancePanelProps> = ({
  vehicle,
  compact = false,
  onOpenMaintenanceModal,
}) => {
  const insurance = checkInsuranceStatus(vehicle);
  const inspection = checkTechnicalInspectionStatus(vehicle);
  const vignette = checkVignetteStatus(vehicle);
  const oil = checkOilChangeStatus(vehicle);
  const summary = getVehicleHealthSummary(vehicle);

  const expenses = vehicle.maintenanceExpenses || [];
  const totalCost = expenses.reduce((sum, e) => sum + (e.costMAD || 0), 0);

  return (
    <div className="mt-3 bg-slate-950/90 border border-slate-800 rounded-xl p-3 space-y-2.5 text-xs">
      <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
        <div className="flex items-center gap-1.5 font-semibold text-slate-300 text-[11px] uppercase tracking-wider">
          <Shield className="w-3.5 h-3.5 text-amber-400" />
          <span>Suivi Échéances & Conformité</span>
        </div>

        {summary.overallStatus === 'expired' ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40">
            <AlertOctagon className="w-3 h-3 text-rose-400" />
            Échéance Dépassée
          </span>
        ) : summary.overallStatus === 'warning' ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            À renouveler sous peu
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            Conforme
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2">
        {/* ASSURANCE */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-slate-400 truncate min-w-0">
            <Shield className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <div className="truncate">
              <span className="text-slate-300 font-medium text-[11px] block">
                Assurance {vehicle.insuranceCompany ? `(${vehicle.insuranceCompany})` : ''}
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                {vehicle.insuranceExpiryDate
                  ? new Date(vehicle.insuranceExpiryDate).toLocaleDateString('fr-FR')
                  : 'Non spécifiée'}
              </span>
            </div>
          </div>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-md border whitespace-nowrap shrink-0 ${insurance.badgeClass}`}
          >
            {insurance.text}
          </span>
        </div>

        {/* VISITE TECHNIQUE */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-slate-400 truncate min-w-0">
            <FileCheck className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <div className="truncate">
              <span className="text-slate-300 font-medium text-[11px] block">Contrôle Technique</span>
              <span className="text-[10px] text-slate-500 font-mono">
                {vehicle.technicalInspectionExpiryDate
                  ? new Date(vehicle.technicalInspectionExpiryDate).toLocaleDateString('fr-FR')
                  : 'Non spécifié'}
              </span>
            </div>
          </div>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-md border whitespace-nowrap shrink-0 ${inspection.badgeClass}`}
          >
            {inspection.text}
          </span>
        </div>

        {/* VIGNETTE & PROCHAINE VIDANGE */}
        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-900">
          {/* Vignette */}
          <div className="flex flex-col">
            <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-0.5">
              <Award className="w-3 h-3 text-amber-400 shrink-0" />
              <span>Vignette 2026</span>
            </div>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded text-center border truncate ${vignette.badgeClass}`}
            >
              {vignette.text}
            </span>
          </div>

          {/* Prochaine Vidange */}
          <div className="flex flex-col">
            <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-0.5">
              <Wrench className="w-3 h-3 text-emerald-400 shrink-0" />
              <span>Prochaine Vidange</span>
            </div>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded text-center border truncate ${oil.badgeClass}`}
              title={vehicle.nextOilChangeKm ? `Prévue à ${vehicle.nextOilChangeKm.toLocaleString('fr-FR')} KM` : undefined}
            >
              {vehicle.nextOilChangeKm ? oil.text : 'Non définie'}
            </span>
          </div>
        </div>

        {/* CARNET D'ENTRETIEN & FACTURES ACTION */}
        {onOpenMaintenanceModal && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenMaintenanceModal();
            }}
            className="w-full mt-1 pt-2 border-t border-slate-900 flex items-center justify-between text-[11px] text-slate-300 hover:text-amber-300 transition-colors group/btn cursor-pointer py-0.5"
          >
            <span className="flex items-center gap-1.5">
              <Receipt className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-semibold">Carnet Dépenses & Vidanges</span>
              {expenses.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800 text-amber-400 font-mono font-bold">
                  {totalCost.toLocaleString('fr-FR')} MAD ({expenses.length})
                </span>
              )}
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover/btn:text-amber-400 group-hover/btn:translate-x-0.5 transition-all" />
          </button>
        )}
      </div>
    </div>
  );
};
