import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, FileText, Users, Car, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useI18n } from '../i18n/I18nContext';
import { getScopedDataForUser } from '../utils/managerScopeUtils';
import { requestEntityFocus, FocusKind } from '../lib/entityFocus';
import { ActiveTab } from '../types';

interface Hit {
  key: string;
  kind: FocusKind;
  title: string;
  detail: string;
  search: string;
  haystack: string;
}

const KIND_TAB: Record<FocusKind, ActiveTab> = { contract: 'contracts', client: 'clients', vehicle: 'vehicles' };
const MAX_PER_KIND = 5;

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

interface GlobalSearchProps {
  /** Icône seule (mobile) ou champ complet (PC). */
  compact?: boolean;
}

/** Recherche globale (Ctrl+K) : contrats, clients et véhicules du périmètre de l'utilisateur ; ouvre la liste déjà filtrée. */
export const GlobalSearch: React.FC<GlobalSearchProps> = ({ compact }) => {
  const { currentUser, contracts, vehicles, clients, deposits, users, setActiveTab } = useApp();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
    else setQuery('');
  }, [open]);

  const index = useMemo<Hit[]>(() => {
    if (!open || !currentUser) return [];
    const scoped = getScopedDataForUser(currentUser, vehicles, contracts, deposits, clients, users);
    const hits: Hit[] = [];
    for (const c of scoped.scopedContracts) {
      const name = `${c.clientSnapshot?.firstName ?? ''} ${c.clientSnapshot?.lastName ?? ''}`.trim();
      const plate = c.vehicleSnapshot?.plate ?? '';
      hits.push({
        key: `contract-${c.id}`,
        kind: 'contract',
        title: c.contractNumber,
        detail: [name, plate].filter(Boolean).join(' · '),
        search: c.contractNumber,
        haystack: normalize(`${c.contractNumber} ${name} ${plate}`),
      });
    }
    for (const c of scoped.scopedClients) {
      const name = `${c.firstName} ${c.lastName}`.trim();
      hits.push({
        key: `client-${c.id}`,
        kind: 'client',
        title: name,
        detail: [c.phone, c.docNumber].filter(Boolean).join(' · '),
        search: name,
        haystack: normalize(`${name} ${c.phone ?? ''} ${c.docNumber ?? ''} ${c.drivingLicense ?? ''}`),
      });
    }
    for (const v of scoped.scopedVehicles) {
      hits.push({
        key: `vehicle-${v.id}`,
        kind: 'vehicle',
        title: `${v.brand} ${v.model}`.trim(),
        detail: v.plate,
        search: v.plate,
        haystack: normalize(`${v.brand} ${v.model} ${v.plate}`),
      });
    }
    return hits;
  }, [open, currentUser, vehicles, contracts, deposits, clients, users]);

  const results = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return [];
    const terms = q.split(/\s+/);
    const byKind: Record<FocusKind, Hit[]> = { contract: [], client: [], vehicle: [] };
    for (const hit of index) {
      if (byKind[hit.kind].length < MAX_PER_KIND && terms.every((term) => hit.haystack.includes(term))) {
        byKind[hit.kind].push(hit);
      }
    }
    return [...byKind.contract, ...byKind.client, ...byKind.vehicle];
  }, [index, query]);

  if (!currentUser) return null;

  const go = (hit: Hit) => {
    requestEntityFocus(hit.kind, hit.search);
    setActiveTab(KIND_TAB[hit.kind]);
    setOpen(false);
  };

  const icon = (kind: FocusKind) =>
    kind === 'contract' ? (
      <FileText className="w-4 h-4 text-amber-400" />
    ) : kind === 'client' ? (
      <Users className="w-4 h-4 text-blue-400" />
    ) : (
      <Car className="w-4 h-4 text-emerald-400" />
    );

  return (
    <>
      {compact ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t('Rechercher')}
          title={t('Rechercher')}
          className="flex items-center justify-center w-9 h-9 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer"
        >
          <Search className="w-4 h-4" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="hidden md:flex items-center gap-2 w-full max-w-sm px-3 py-2 rounded-xl border border-slate-700 bg-slate-950/60 text-slate-400 hover:border-amber-500/40 hover:text-slate-200 text-xs cursor-pointer transition-colors"
        >
          <Search className="w-4 h-4 shrink-0" />
          <span className="flex-1 text-start truncate">{t('Rechercher un contrat, un client, un véhicule…')}</span>
          <kbd className="hidden lg:inline text-[10px] font-mono px-1.5 py-0.5 rounded border border-slate-700 bg-slate-900">Ctrl K</kbd>
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/70 p-3 pt-[10vh] no-print" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-label={t('Recherche globale')}
            className="w-full max-w-xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 px-4 border-b border-slate-800">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && results[0]) go(results[0]);
                }}
                placeholder={t('N° contrat, nom, téléphone, CIN, immatriculation…')}
                className="flex-1 bg-transparent py-3.5 text-sm text-white placeholder-slate-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t('Fermer')}
                className="p-1.5 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-[55vh] overflow-y-auto p-1.5">
              {!query.trim() ? (
                <p className="px-3 py-6 text-center text-xs text-slate-500">{t('Tapez pour chercher dans vos contrats, clients et véhicules.')}</p>
              ) : results.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-slate-500">{t('Aucun résultat.')}</p>
              ) : (
                results.map((hit) => (
                  <button
                    key={hit.key}
                    type="button"
                    onClick={() => go(hit)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-start hover:bg-slate-800 cursor-pointer"
                  >
                    <span className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                      {icon(hit.kind)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-white truncate">{hit.title}</span>
                      {hit.detail && <span className="block text-[11px] text-slate-400 truncate">{hit.detail}</span>}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider text-slate-500 shrink-0">
                      {hit.kind === 'contract' ? t('Contrat') : hit.kind === 'client' ? t('Client') : t('Véhicule')}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
