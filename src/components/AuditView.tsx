import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ShieldAlert, Search, Clock, User, FileText, CheckCircle2, History, Filter } from 'lucide-react';

export const AuditView: React.FC = () => {
  const { auditLogs } = useApp();
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [actionFilter, setActionFilter] = useState<string>('all');

  const filteredLogs = auditLogs.filter((log) => {
    if (actionFilter !== 'all' && log.action !== actionFilter) {
      return false;
    }
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      log.action.toLowerCase().includes(q) ||
      (log.userName && log.userName.toLowerCase().includes(q)) ||
      (log.userRole && log.userRole.toLowerCase().includes(q)) ||
      (log.targetId && log.targetId.toLowerCase().includes(q)) ||
      log.details.toLowerCase().includes(q)
    );
  });

  const getActionBadge = (action: string) => {
    const act = action.toLowerCase();
    if (act.includes('création') || act.includes('creation')) {
      return (
        <span className="inline-flex items-center gap-1 bg-amber-500/15 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded text-[10px] font-mono font-semibold">
          CRÉATION
        </span>
      );
    }
    if (act.includes('pdf') || act.includes('impression')) {
      return (
        <span className="inline-flex items-center gap-1 bg-blue-500/15 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded text-[10px] font-mono font-semibold">
          PDF / IMPRESSION
        </span>
      );
    }
    if (act.includes('clôture') || act.includes('cloture') || act.includes('restitution')) {
      return (
        <span className="inline-flex items-center gap-1 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded text-[10px] font-mono font-semibold">
          RESTITUTION & CLÔTURE
        </span>
      );
    }
    if (act.includes('duplication')) {
      return (
        <span className="inline-flex items-center gap-1 bg-purple-500/15 text-purple-400 border border-purple-500/30 px-2 py-0.5 rounded text-[10px] font-mono font-semibold">
          DUPLICATION
        </span>
      );
    }
    if (act.includes('annulation')) {
      return (
        <span className="inline-flex items-center gap-1 bg-rose-500/15 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded text-[10px] font-mono font-semibold">
          ANNULATION
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded text-[10px] font-mono font-semibold">
        {action}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-rose-400 uppercase tracking-widest font-mono">
            <ShieldAlert className="w-4 h-4" />
            Module Traçabilité & Journal d'Audit • Section 34
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight mt-1">
            Journal des Événements & Sécurité
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Historique inaltérable de toutes les opérations : créations, impressions A4, clôtures et modifications.
          </p>
        </div>

        <div className="bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs font-mono text-slate-300 flex items-center gap-2">
          <History className="w-4 h-4 text-amber-400" />
          <span>{auditLogs.length} événements tracés</span>
        </div>
      </div>

      {/* SEARCH & FILTERS */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-md flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher dans les logs (agent, cible, contrat, motif)..."
            className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
        >
          <option value="all">Toutes les actions</option>
          <option value="CREATION_CONTRAT">Création Contrat</option>
          <option value="IMPRESSION_PDF">Impression PDF A4</option>
          <option value="CLOTURE_CONTRAT">Restitution & Clôture</option>
          <option value="DUPLICATION_CONTRAT">Duplication</option>
          <option value="CREATION_CLIENT">Ajout Client</option>
          <option value="ANNULATION_CONTRAT">Annulation</option>
        </select>
      </div>

      {/* AUDIT LOG TABLE */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/70 text-slate-400 uppercase text-[10px] font-semibold border-b border-slate-800">
              <tr>
                <th className="px-4 py-3.5">Horodatage</th>
                <th className="px-4 py-3.5">Agent / Rôle</th>
                <th className="px-4 py-3.5">Type d'Action</th>
                <th className="px-4 py-3.5">Cible / Référence</th>
                <th className="px-4 py-3.5">Détails de l'Opération</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-mono text-[11px]">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-slate-500 text-xs">
                    Aucun événement d'audit ne correspond à vos filtres.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-850/60 transition-colors">
                    {/* TIMESTAMP */}
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                      {log.timestamp}
                    </td>

                    {/* USER & ROLE */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-bold text-white">{log.userName}</span>
                      <span className="text-[10px] text-slate-500 block uppercase">
                        [{log.userRole}]
                      </span>
                    </td>

                    {/* ACTION BADGE */}
                    <td className="px-4 py-3">{getActionBadge(log.action)}</td>

                    {/* TARGET */}
                    <td className="px-4 py-3">
                      <span className="text-amber-400 font-bold">{log.targetId}</span>
                    </td>

                    {/* DETAILS */}
                    <td className="px-4 py-3 font-sans text-xs text-slate-300">
                      {log.details}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
