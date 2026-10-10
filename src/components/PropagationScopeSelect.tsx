import React, { useState } from 'react';
import { PropagationScope, DEFAULT_PROPAGATION_SCOPE } from '../utils/snapshotPropagation';

const STORAGE_KEY = 'morvello_propagation_scope_v1';

/** Mémorise le dernier choix de l'utilisateur (confort uniquement : défaut = contrats en cours). */
export function usePropagationScope(): [PropagationScope, (scope: PropagationScope) => void] {
  const [scope, setScopeState] = useState<PropagationScope>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'open' || saved === 'all' || saved === 'none') return saved;
    } catch {
      // stockage indisponible : valeur par défaut
    }
    return DEFAULT_PROPAGATION_SCOPE;
  });

  const setScope = (next: PropagationScope) => {
    setScopeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  };

  return [scope, setScope];
}

interface Props {
  value: PropagationScope;
  onChange: (scope: PropagationScope) => void;
  /** Texte décrivant ce qui est copié dans les contrats (client / véhicule). */
  subject: string;
}

export const PropagationScopeSelect: React.FC<Props> = ({ value, onChange, subject }) => (
  <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-3 space-y-1.5">
    <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-400">
      Répercussion sur les contrats
    </label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as PropagationScope)}
      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
    >
      <option value="open">Mettre à jour les contrats en cours (recommandé)</option>
      <option value="all">Mettre à jour tous les contrats, y compris clôturés</option>
      <option value="none">Ne pas répercuter — les contrats gardent leurs valeurs d&apos;origine</option>
    </select>
    <p className="text-[11px] text-slate-500">
      Les contrats et cautions conservent une copie {subject}. Ce choix détermine si cette copie suit la fiche.
    </p>
  </div>
);
