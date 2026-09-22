import React from 'react';
import {
  Clock,
  CheckSquare,
  AlertTriangle,
  Eye,
  Car,
  Phone,
  ArrowRight,
  ShieldCheck,
  Calendar,
  CheckCircle2,
} from 'lucide-react';
import { Contract, Vehicle } from '../../types';

interface DashboardFlightDeckProps {
  urgentContracts: Contract[];
  maintenanceVehicles: Vehicle[];
  onOpenCheckInModal: (contract: Contract) => void;
  onOpenPdf: (contract: Contract) => void;
  onViewVehicles: () => void;
}

export const DashboardFlightDeck: React.FC<DashboardFlightDeckProps> = ({
  urgentContracts,
  maintenanceVehicles,
  onOpenCheckInModal,
  onOpenPdf,
  onViewVehicles,
}) => {
  return (
    <div id="flight-deck-section" className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* 1. RESTITUTIONS DU JOUR & VÉRIFICATIONS IMMÉDIATES */}
      <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                  Restitutions & Check-in Comptoir
                  {urgentContracts.length > 0 && (
                    <span className="bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold">
                      {urgentContracts.length} en attente
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-400">
                  Véhicules attendus en agence pour contrôle KM, carburant et restitution caution
                </p>
              </div>
            </div>
          </div>

          <div className="mt-3.5 space-y-3">
            {urgentContracts.length === 0 ? (
              <div className="py-8 px-4 text-center rounded-xl bg-slate-950/50 border border-slate-800/60 flex flex-col items-center justify-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-slate-200">
                  Toutes les restitutions du jour sont à jour
                </p>
                <p className="text-[11px] text-slate-500 max-w-xs">
                  Aucun contrat actif n'est en dépassement de date ou en attente immédiate de check-in.
                </p>
              </div>
            ) : (
              urgentContracts.map((cnt) => {
                const effectiveEndDate = cnt.prolongation?.isActive
                  ? cnt.prolongation.newEndDate
                  : cnt.endDate;
                const effectiveEndTime = cnt.prolongation?.isActive
                  ? cnt.prolongation.newEndTime
                  : cnt.endTime;

                return (
                  <div
                    key={cnt.id}
                    className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-amber-500/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-amber-400 text-xs">
                          {cnt.contractNumber}
                        </span>
                        <span className="text-white font-semibold text-xs">
                          {cnt.clientSnapshot.lastName} {cnt.clientSnapshot.firstName}
                        </span>
                        {cnt.prolongation?.isActive && (
                          <span className="text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded border border-purple-500/30 font-semibold">
                            Prolongé
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-2">
                        <span className="text-slate-300 font-medium">
                          {cnt.vehicleSnapshot.brand} {cnt.vehicleSnapshot.model}
                        </span>
                        <span>•</span>
                        <span className="font-mono text-amber-300">
                          {cnt.vehicleSnapshot.plate}
                        </span>
                        <span>•</span>
                        <span className="text-slate-400 flex items-center gap-1 font-mono">
                          <Calendar className="w-3 h-3 text-slate-500" />
                          Retour : {new Date(effectiveEndDate).toLocaleDateString('fr-FR')} à {effectiveEndTime}
                        </span>
                      </div>

                      <div className="text-[10px] text-slate-500 flex items-center gap-3 pt-0.5">
                        <span className="flex items-center gap-1 text-slate-400">
                          <ShieldCheck className="w-3 h-3 text-purple-400" />
                          Caution :{' '}
                          <strong className="text-slate-200 font-mono">
                            {cnt.depositAmount !== undefined ? cnt.depositAmount.toLocaleString('fr-FR') : (cnt.depositRecord?.amount !== undefined ? cnt.depositRecord.amount.toLocaleString('fr-FR') : 5000)} DH
                          </strong>
                        </span>
                        {cnt.clientSnapshot.phone && (
                          <a
                            href={`tel:${cnt.clientSnapshot.phone}`}
                            className="text-amber-400 hover:underline flex items-center gap-1 font-mono"
                          >
                            <Phone className="w-2.5 h-2.5" />
                            {cnt.clientSnapshot.phone}
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                      <button
                        onClick={() => onOpenPdf(cnt)}
                        className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 rounded-lg text-xs transition-colors"
                        title="Aperçu du contrat PDF"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => onOpenCheckInModal(cnt)}
                        className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                        title="Réceptionner le véhicule et vérifier l'état"
                      >
                        <CheckSquare className="w-3.5 h-3.5" />
                        <span>Restituer &amp; Clôturer</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
          <span>Génération automatique de la fiche de retour &amp; déblocage caution</span>
          <span className="text-amber-400 font-mono font-medium">Contrôle 20 points</span>
        </div>
      </div>

      {/* 2. ALERTES FLOTTE & MAINTENANCE DU PARC */}
      <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <Car className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                  Vigilance Parc &amp; Entretien Technique
                  {maintenanceVehicles.length > 0 && (
                    <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold">
                      {maintenanceVehicles.length} au garage
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-400">
                  Suivi des révisions, vidanges périodiques et conformité mécanique
                </p>
              </div>
            </div>
          </div>

          <div className="mt-3.5 space-y-3">
            {maintenanceVehicles.length === 0 ? (
              <div className="py-8 px-4 text-center rounded-xl bg-slate-950/50 border border-slate-800/60 flex flex-col items-center justify-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-blue-500/15 text-blue-400 flex items-center justify-center">
                  <Car className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-slate-200">
                  100% du parc opérationnel
                </p>
                <p className="text-[11px] text-slate-500 max-w-xs">
                  Aucun véhicule n'est actuellement immobilisé pour réparation ou panne.
                </p>
              </div>
            ) : (
              maintenanceVehicles.map((veh) => (
                <div
                  key={veh.id}
                  className="p-3.5 rounded-xl bg-slate-950/70 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-bold text-xs">
                        {veh.brand} {veh.model}
                      </span>
                      <span className="font-mono text-amber-400 text-xs px-1.5 py-0.5 bg-slate-900 rounded border border-slate-800 font-semibold">
                        {veh.plate}
                      </span>
                      <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/40 font-semibold">
                        Maintenance
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-400">
                      {veh.notes || 'Révision périodique et contrôle freinage / pneumatiques'}
                    </p>

                    <div className="text-[10px] text-slate-500 flex items-center gap-3">
                      <span>Kilométrage actuel : <strong className="text-slate-300 font-mono">{veh.currentKm.toLocaleString('fr-FR')} KM</strong></span>
                      {veh.assignedManagerName && (
                        <span>• Manager : <strong className="text-slate-300">{veh.assignedManagerName}</strong></span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={onViewVehicles}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 shrink-0 self-start sm:self-center"
                  >
                    <span>Gérer le véhicule</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
          <span className="text-slate-400 text-[11px]">Normes de sécurité Morvello Prestige V1.0</span>
          <button
            onClick={onViewVehicles}
            className="text-amber-400 hover:text-amber-300 text-[11px] font-semibold flex items-center gap-1"
          >
            Voir tous les véhicules <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
