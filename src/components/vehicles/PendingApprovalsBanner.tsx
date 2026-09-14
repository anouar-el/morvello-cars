import React, { useState } from 'react';
import { Vehicle, User } from '../../types';
import {
  AlertTriangle,
  CheckCircle2,
  X,
  UserCheck,
  ShieldCheck,
} from 'lucide-react';

interface PendingApprovalsBannerProps {
  isAdmin: boolean;
  pendingApprovalVehicles: Vehicle[];
  myPendingVehicles: Vehicle[];
  managers: User[];
  gerantName: string;
  onApprove: (id: string, managerId?: string) => void;
  onReject: (id: string) => void;
  onToast: (msg: string) => void;
}

export const PendingApprovalsBanner: React.FC<PendingApprovalsBannerProps> = ({
  isAdmin,
  pendingApprovalVehicles,
  myPendingVehicles,
  managers,
  gerantName,
  onApprove,
  onReject,
  onToast,
}) => {
  const [approvalManagerSelections, setApprovalManagerSelections] = useState<Record<string, string>>({});

  return (
    <>
      {/* ADMIN ONLY: PENDING APPROVALS SECTION */}
      {isAdmin && pendingApprovalVehicles.length > 0 && (
        <div className="bg-amber-950/40 border-2 border-amber-500/60 rounded-2xl p-5 shadow-xl space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-amber-200 flex items-center gap-2">
                  Demandes d'ajout de véhicules en attente d'approbation ({pendingApprovalVehicles.length})
                </h3>
                <p className="text-xs text-slate-400">
                  Véhicules proposés par vos équipes (Responsables d'agence, Agents). Votre approbation de Gérant est obligatoire avant intégration au parc officiel et mise en location.
                </p>
              </div>
            </div>
            <span className="text-[11px] bg-amber-500 text-slate-950 px-2.5 py-1 rounded-lg font-mono font-extrabold shadow-sm">
              Action Gérant Requise
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            {pendingApprovalVehicles.map((pv) => {
              const selectedManagerId = approvalManagerSelections[pv.id] ?? pv.assignedManagerId ?? '';
              return (
                <div
                  key={pv.id}
                  className="bg-slate-900 border border-amber-500/30 rounded-xl p-4 flex flex-col justify-between gap-3 shadow-md"
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-sm font-bold text-white uppercase">
                          {pv.brand} <span className="text-slate-300 font-normal">{pv.model}</span>
                        </span>
                        <div className="mt-1 inline-block bg-slate-950 border border-amber-500/40 px-2.5 py-0.5 rounded text-amber-400 font-mono font-bold text-xs tracking-wider">
                          {pv.plate}
                        </div>
                      </div>
                      <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-semibold">
                        ⏳ En attente
                      </span>
                    </div>

                    <div className="text-xs text-slate-400 mt-2.5 grid grid-cols-2 gap-2 bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                      <div>
                        <span className="text-[10px] text-slate-500 block">Proposé par :</span>
                        <strong className="text-slate-200">{pv.proposedBy || 'Collaborateur'}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">Date de soumission :</span>
                        <span className="font-mono text-slate-300">{pv.proposedAt || 'Récemment'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">Tarif journalier :</span>
                        <strong className="text-amber-400 font-mono">{pv.dailyRate} MAD/j</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">Compteur :</span>
                        <span className="font-mono text-slate-300">{pv.currentKm.toLocaleString()} KM</span>
                      </div>
                    </div>

                    {/* MANAGER ASSIGNMENT SELECTOR FOR GERANT UPON APPROVAL */}
                    <div className="mt-2.5 bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
                      <label className="text-[11px] text-slate-300 font-semibold mb-1 flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                        Affecter au Responsable attitré lors de la validation :
                      </label>
                      <select
                        value={selectedManagerId}
                        onChange={(e) =>
                          setApprovalManagerSelections({
                            ...approvalManagerSelections,
                            [pv.id]: e.target.value,
                          })
                        }
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-amber-400 focus:outline-none"
                      >
                        <option value="">-- Flotte centrale (Non affecté pour le moment) --</option>
                        {managers.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} — {m.assignedFleetName || m.agency}
                          </option>
                        ))}
                      </select>
                      <span className="text-[10px] text-slate-500 block mt-1">
                        Seul le Gérant peut décider de l'affectation finale à un Responsable.
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
                    <button
                      onClick={() => {
                        onApprove(pv.id, selectedManagerId || undefined);
                        onToast(`Véhicule ${pv.brand} ${pv.model} (${pv.plate}) approuvé et intégré au parc officiel !`);
                      }}
                      className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-1.5 px-3 rounded-lg text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-sm"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Approuver & Intégrer au parc
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(`Confirmez-vous le refus de ce véhicule (${pv.brand} ${pv.model}) ?`)) {
                          onReject(pv.id);
                          onToast(`Véhicule ${pv.brand} refusé.`);
                        }
                      }}
                      className="bg-slate-800 hover:bg-rose-950 hover:text-rose-300 hover:border-rose-700/60 text-slate-400 font-semibold py-1.5 px-3 rounded-lg text-xs flex items-center gap-1 cursor-pointer transition-colors border border-slate-700"
                    >
                      <X className="w-3.5 h-3.5" />
                      Refuser
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* NON-ADMIN: MY PENDING PROPOSALS BANNER */}
      {!isAdmin && myPendingVehicles.length > 0 && (
        <div className="bg-blue-950/40 border border-blue-500/40 rounded-2xl p-4 shadow-lg space-y-2 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              <h3 className="text-xs sm:text-sm font-bold text-blue-200">
                Vos propositions de véhicules en attente d'approbation du Gérant ({myPendingVehicles.length})
              </h3>
            </div>
            <span className="text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/40 px-2 py-0.5 rounded font-mono font-semibold">
              En attente du Gérant
            </span>
          </div>
          <p className="text-[11px] text-slate-300">
            Ces véhicules ont été transmis au Gérant ({gerantName}). Dès validation, ils apparaîtront dans la flotte active et pourront être loués via le module Contrats.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
            {myPendingVehicles.map((pv) => (
              <div key={pv.id} className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl text-xs flex items-center justify-between">
                <div>
                  <span className="font-bold text-white uppercase">{pv.brand} {pv.model}</span>
                  <div className="font-mono text-amber-400 font-bold text-[11px]">{pv.plate}</div>
                </div>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-semibold">
                  ⏳ En cours d'examen
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
};
