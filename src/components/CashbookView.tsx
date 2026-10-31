import React, { useMemo, useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, Download, Wallet, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useI18n } from '../i18n/I18nContext';
import { getScopedDataForUser } from '../utils/managerScopeUtils';
import { getTodayDateString } from '../utils/vehicleExpiryUtils';
import { buildCashbook, cashbookToCsv, periodRange, type CashKind, type PeriodPreset } from '../lib/cashbook';
import { PAYMENT_METHOD_LABELS } from '../lib/assistantActions';
import type { ExpenseCategory } from '../types';
import { PageHeader } from './PageHeader';

const PERIODS: PeriodPreset[] = ['today', 'week', 'month', 'lastMonth', 'year'];

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  oil_change: 'Vidange & Filtres',
  brakes: 'Freinage (Plaquettes/Disques)',
  tires: 'Pneumatiques & Géométrie',
  mechanical: 'Mécanique & Moteur',
  bodywork: 'Carrosserie & Peinture',
  inspection: 'Contrôle Technique / Visite',
  insurance: 'Prime Assurance',
  vignette: 'Vignette Fiscale',
  wash_cleaning: 'Lavage & Préparation',
  other: 'Autre Entretien',
};

const LEDGER_PAGE = 40;

const inputCls =
  'w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white placeholder:text-slate-500 focus:border-amber-500 focus:outline-none';

export const CashbookView: React.FC = () => {
  const { currentUser, vehicles, contracts, clients, deposits, users, addVehicleExpense } = useApp();
  const { t, lang } = useI18n();
  const today = getTodayDateString();
  const [preset, setPreset] = useState<PeriodPreset>('month');
  const [filter, setFilter] = useState<'all' | CashKind>('all');
  const [shown, setShown] = useState(LEDGER_PAGE);
  const [adding, setAdding] = useState(false);

  const scoped = useMemo(
    () => (currentUser ? getScopedDataForUser(currentUser, vehicles, contracts, deposits, clients, users) : null),
    [currentUser, vehicles, contracts, deposits, clients, users]
  );
  const range = useMemo(() => periodRange(preset, today), [preset, today]);
  const book = useMemo(() => (scoped ? buildCashbook(scoped.scopedContracts, scoped.scopedVehicles, range) : null), [scoped, range]);

  if (!currentUser || !scoped || !book) return null;

  if (currentUser.role === 'agent') {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 max-w-xl mx-auto text-center space-y-2 my-8">
        <h2 className="text-lg font-bold text-white">{t('Accès réservé au Gérant et aux Responsables')}</h2>
        <p className="text-xs text-slate-400">{t("La caisse regroupe les montants encaissés et les dépenses de l'agence.")}</p>
      </div>
    );
  }

  const num = (n: number) => n.toLocaleString(lang === 'ar' ? 'ar-MA' : 'fr-FR');
  const vehicleName = (id?: string) => {
    const v = scoped.scopedVehicles.find((x) => x.id === id);
    return v ? `${v.brand} ${v.model} · ${v.plate}` : '';
  };
  const entries = filter === 'all' ? book.entries : book.entries.filter((e) => e.kind === filter);
  const maxMethod = Math.max(1, ...book.byMethod.map((m) => m.amount));
  const maxCategory = Math.max(1, ...book.byCategory.map((c) => c.amount));

  const exportCsv = () => {
    const csv = cashbookToCsv(book.entries, {
      header: [t('Date'), t('Type'), t('Libellé'), t('Contrat'), t('Détail'), t('Montant (MAD)')],
      kind: { in: t('Encaissement'), out: t('Dépense') },
    });
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `caisse_${range.from}_${range.to}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const periodLabel: Record<PeriodPreset, string> = {
    today: t("Aujourd'hui"),
    week: t('7 derniers jours'),
    month: t('Ce mois'),
    lastMonth: t('Mois dernier'),
    year: t('Cette année'),
  };

  return (
    <div className="space-y-5">
      <PageHeader
        icon={<Wallet className="w-5 h-5" />}
        title={t('Caisse')}
        subtitle={t("Ce qui est entré (paiements des contrats) et sorti (dépenses des véhicules) sur la période.")}
        primary={{ label: t('+ Dépense'), icon: <ArrowUpCircle className="w-4 h-4" />, onClick: () => setAdding(true) }}
        actions={[{ label: t('Exporter en CSV'), icon: <Download className="w-4 h-4 text-slate-400" />, onClick: exportCsv, disabled: book.entries.length === 0 }]}
      />

      <div className="flex flex-wrap gap-2" role="group" aria-label={t('Période')}>
        {PERIODS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => {
              setPreset(p);
              setShown(LEDGER_PAGE);
            }}
            aria-pressed={preset === p}
            className={`px-3 min-h-9 rounded-full text-xs font-semibold border cursor-pointer ${
              preset === p ? 'bg-amber-500 text-slate-950 border-amber-400' : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
            }`}
          >
            {periodLabel[p]}
          </button>
        ))}
      </div>

      {/* TOTAUX */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="glass rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{t('Encaissé')}</p>
          <p className="text-2xl font-black font-mono text-emerald-400 mt-1">{num(book.totalIn)} <span className="text-xs font-sans text-slate-400">MAD</span></p>
        </div>
        <div className="glass rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{t('Dépenses')}</p>
          <p className="text-2xl font-black font-mono text-rose-400 mt-1">{num(book.totalOut)} <span className="text-xs font-sans text-slate-400">MAD</span></p>
        </div>
        <div className="glass rounded-2xl p-4">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{t('Solde')}</p>
          <p className={`text-2xl font-black font-mono mt-1 ${book.net >= 0 ? 'text-amber-400' : 'text-rose-400'}`}>
            {book.net > 0 ? '+' : ''}
            {num(book.net)} <span className="text-xs font-sans text-slate-400">MAD</span>
          </p>
        </div>
      </div>

      {book.entries.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-xs text-slate-400">{t('Aucun mouvement sur cette période.')}</div>
      ) : (
        <>
          {/* VENTILATION */}
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-3">
              <h2 className="text-sm font-bold text-white">{t('Encaissements par mode de paiement')}</h2>
              {book.byMethod.length === 0 ? (
                <p className="text-xs text-slate-500">{t('Aucun encaissement.')}</p>
              ) : (
                book.byMethod.map((m) => (
                  <div key={m.method} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300">{t(PAYMENT_METHOD_LABELS[m.method])}</span>
                      <span className="font-mono text-emerald-300">{num(m.amount)} MAD</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div className="h-full bg-emerald-500/70" style={{ width: `${(m.amount / maxMethod) * 100}%` }} />
                    </div>
                  </div>
                ))
              )}
            </section>

            <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-3">
              <h2 className="text-sm font-bold text-white">{t('Dépenses par catégorie')}</h2>
              {book.byCategory.length === 0 ? (
                <p className="text-xs text-slate-500">{t('Aucune dépense.')}</p>
              ) : (
                book.byCategory.map((c) => (
                  <div key={c.category} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300">{t(CATEGORY_LABELS[c.category] ?? CATEGORY_LABELS.other)}</span>
                      <span className="font-mono text-rose-300">{num(c.amount)} MAD</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                      <div className="h-full bg-rose-500/70" style={{ width: `${(c.amount / maxCategory) * 100}%` }} />
                    </div>
                  </div>
                ))
              )}
            </section>
          </div>

          {/* PAR VÉHICULE */}
          <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-3">
            <h2 className="text-sm font-bold text-white">{t('Résultat par véhicule')}</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[480px]">
                <thead>
                  <tr className="text-slate-500 text-[11px] uppercase tracking-wider">
                    <th className="text-start font-semibold pb-2">{t('Véhicule')}</th>
                    <th className="text-end font-semibold pb-2">{t('Encaissé')}</th>
                    <th className="text-end font-semibold pb-2">{t('Dépenses')}</th>
                    <th className="text-end font-semibold pb-2">{t('Solde')}</th>
                  </tr>
                </thead>
                <tbody>
                  {book.perVehicle.map((v) => (
                    <tr key={v.vehicleId} className="border-t border-slate-800/70">
                      <td className="py-2 pe-2">
                        <span className="font-semibold text-white">{v.label}</span> <span className="font-mono text-amber-400">{v.plate}</span>
                      </td>
                      <td className="py-2 text-end font-mono text-emerald-300">{num(v.revenue)}</td>
                      <td className="py-2 text-end font-mono text-rose-300">{num(v.expenses)}</td>
                      <td className={`py-2 text-end font-mono font-bold ${v.net >= 0 ? 'text-amber-400' : 'text-rose-400'}`}>{num(v.net)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* JOURNAL */}
          <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-white">{t('Journal de caisse')}</h2>
              <div className="flex rounded-lg overflow-hidden border border-slate-700" role="group" aria-label={t('Type de mouvement')}>
                {(['all', 'in', 'out'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => {
                      setFilter(f);
                      setShown(LEDGER_PAGE);
                    }}
                    aria-pressed={filter === f}
                    className={`px-3 h-8 text-xs font-semibold cursor-pointer ${filter === f ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                  >
                    {f === 'all' ? t('Tout') : f === 'in' ? t('Encaissements') : t('Dépenses')}
                  </button>
                ))}
              </div>
            </div>

            <ul className="divide-y divide-slate-800/70">
              {entries.slice(0, shown).map((e) => (
                <li key={e.key} className="py-2.5 flex items-center gap-3">
                  {e.kind === 'in' ? (
                    <ArrowDownCircle className="w-5 h-5 text-emerald-400 shrink-0" aria-label={t('Encaissement')} />
                  ) : (
                    <ArrowUpCircle className="w-5 h-5 text-rose-400 shrink-0" aria-label={t('Dépense')} />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-white truncate">{e.label}</div>
                    <div className="text-[11px] text-slate-400 truncate">
                      {e.date}
                      {e.contractNumber ? ` · ${e.contractNumber}` : ''}
                      {e.method ? ` · ${t(PAYMENT_METHOD_LABELS[e.method])}` : ''}
                      {e.undetailed ? ` · ${t('Paiement non détaillé')}` : ''}
                      {e.category ? ` · ${t(CATEGORY_LABELS[e.category] ?? CATEGORY_LABELS.other)}` : ''}
                      {e.vehicleId ? ` · ${vehicleName(e.vehicleId)}` : ''}
                    </div>
                  </div>
                  <div className={`font-mono text-sm font-bold shrink-0 ${e.kind === 'in' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {e.kind === 'in' ? '+' : '−'}
                    {num(e.amount)}
                  </div>
                </li>
              ))}
            </ul>
            {entries.length > shown && (
              <button
                type="button"
                onClick={() => setShown((n) => n + LEDGER_PAGE)}
                className="w-full min-h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
              >
                {t('Afficher plus ({n})', { n: entries.length - shown })}
              </button>
            )}
          </section>
        </>
      )}

      {adding && (
        <ExpenseModal
          vehicles={scoped.scopedVehicles.filter((v) => (v.approvalStatus ?? 'approved') === 'approved')}
          today={today}
          onClose={() => setAdding(false)}
          onSave={(vehicleId, data) => {
            addVehicleExpense(vehicleId, data);
            setAdding(false);
          }}
        />
      )}
    </div>
  );
};

interface ExpenseModalProps {
  vehicles: Array<{ id: string; brand: string; model: string; plate: string; currentKm: number }>;
  today: string;
  onClose: () => void;
  onSave: (
    vehicleId: string,
    data: { category: ExpenseCategory; title: string; costMAD: number; date: string; kmAtExpense: number; notes?: string; recordedBy: string }
  ) => void;
}

const ExpenseModal: React.FC<ExpenseModalProps> = ({ vehicles, today, onClose, onSave }) => {
  const { t } = useI18n();
  const { currentUser } = useApp();
  const [vehicleId, setVehicleId] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('other');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const save = () => {
    const vehicle = vehicles.find((v) => v.id === vehicleId);
    const cost = Number(amount);
    if (!vehicle) return setError(t('Choisissez un véhicule.'));
    if (!title.trim()) return setError(t('Indiquez un libellé.'));
    if (!(cost > 0)) return setError(t('Indiquez un montant supérieur à 0.'));
    if (!date) return setError(t('Indiquez la date.'));
    onSave(vehicle.id, {
      category,
      title: title.trim(),
      costMAD: cost,
      date,
      kmAtExpense: vehicle.currentKm,
      notes: notes.trim() || undefined,
      recordedBy: currentUser?.name || 'Agence',
    });
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-slate-950/80 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-slate-900 border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto pb-safe sm:pb-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-white">{t('Nouvelle dépense')}</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">{t('Elle est ajoutée au carnet du véhicule.')}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={t('Fermer')} className="w-11 h-11 -m-2 flex items-center justify-center rounded-xl text-slate-400 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-1.5">
          <label className="block text-[11px] font-semibold text-slate-300">{t('Véhicule')}</label>
          <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} className={inputCls}>
            <option value="">{t('Choisir…')}</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.brand} {v.model} — {v.plate}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold text-slate-300">{t('Catégorie')}</label>
            <select value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)} className={inputCls}>
              {(Object.keys(CATEGORY_LABELS) as ExpenseCategory[]).map((c) => (
                <option key={c} value={c}>
                  {t(CATEGORY_LABELS[c])}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold text-slate-300">{t('Date')}</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold text-slate-300">{t('Libellé')}</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('Ex. : lavage complet')} className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold text-slate-300">{t('Montant (MAD)')}</label>
            <input type="number" min={0} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className={inputCls} />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-[11px] font-semibold text-slate-300">{t('Note')}</label>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} />
        </div>

        {error && (
          <p className="text-[11px] text-rose-300" role="alert">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="min-h-11 px-4 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold cursor-pointer">
            {t('Annuler')}
          </button>
          <button type="button" onClick={save} className="min-h-11 px-5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 text-xs font-bold cursor-pointer">
            {t('Enregistrer')}
          </button>
        </div>
      </div>
    </div>
  );
};
