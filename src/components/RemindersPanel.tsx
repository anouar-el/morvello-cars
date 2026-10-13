import React, { useMemo, useState } from 'react';
import { BellRing, Check, ChevronDown, ChevronUp, MessageCircle } from 'lucide-react';
import type { Contract } from '../types';
import { REMINDER_LABELS, buildReminders, whatsAppLink, type Reminder, type ReminderType } from '../lib/reminders';
import { useI18n } from '../i18n/I18nContext';

interface RemindersPanelProps {
  contracts: Contract[];
  userId: string;
}

const BADGE: Record<ReminderType, string> = {
  overdue: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  balance_due: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  return_today: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  return_tomorrow: 'bg-slate-700/40 text-slate-300 border-slate-600/50',
};

const storageKey = (userId: string) => `morvello_reminders_done_${userId}`;

/** Relances déjà faites, par identifiant (qui contient le jour) ; les entrées de plus de 7 jours sont purgées. */
function loadDone(userId: string): Record<string, string> {
  try {
    const raw = JSON.parse(localStorage.getItem(storageKey(userId)) || '{}') as Record<string, string>;
    const limit = Date.now() - 7 * 86_400_000;
    return Object.fromEntries(Object.entries(raw).filter(([, at]) => Date.parse(at) > limit));
  } catch {
    return {};
  }
}

export const RemindersPanel: React.FC<RemindersPanelProps> = ({ contracts, userId }) => {
  const [done, setDone] = useState<Record<string, string>>(() => loadDone(userId));
  const [expanded, setExpanded] = useState(true);
  const { t } = useI18n();

  const reminders = useMemo(() => buildReminders(new Date(), contracts), [contracts]);
  const pending = reminders.filter((r) => !done[r.id]);

  const markDone = (id: string) => {
    const next = { ...done, [id]: new Date().toISOString() };
    setDone(next);
    try {
      localStorage.setItem(storageKey(userId), JSON.stringify(next));
    } catch {
      // stockage indisponible : la relance reste simplement affichée au prochain chargement
    }
  };

  const send = (r: Reminder) => {
    const link = whatsAppLink(r);
    if (!link) return;
    window.open(link, '_blank', 'noopener');
    markDone(r.id);
  };

  if (reminders.length === 0) return null;

  const detail = (r: Reminder) => {
    if (r.type === 'overdue') {
      const late = t('{n} j de retard', { n: r.daysLate });
      return r.amount > 0 ? `${late} · ${t('reste {n} MAD', { n: Math.round(r.amount) })}` : late;
    }
    if (r.type === 'balance_due') {
      const due = t('{n} MAD à régler', { n: Math.round(r.amount) });
      return r.daysLate ? `${due} · ${t('depuis {n} j', { n: r.daysLate })}` : due;
    }
    return r.vehicleLabel;
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-3 text-start cursor-pointer"
        aria-expanded={expanded}
      >
        <span className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400">
            <BellRing className="w-4 h-4" />
          </span>
          <span>
            <span className="block text-sm font-bold text-white">
              {pending.length !== reminders.length
                ? t('Relances clients ({n} sur {total})', { n: pending.length, total: reminders.length })
                : t('Relances clients ({n})', { n: pending.length })}
            </span>
            <span className="block text-xs text-slate-400">{t('Messages WhatsApp prêts à envoyer, calculés sur vos contrats')}</span>
          </span>
        </span>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {expanded && (
        <div className="mt-4 space-y-2">
          {pending.length === 0 && (
            <p className="text-xs text-emerald-400 py-2">{t('Toutes les relances du jour ont été traitées.')}</p>
          )}
          {pending.map((r) => (
            <div
              key={r.id}
              className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-md border text-[10.5px] font-semibold ${BADGE[r.type]}`}>
                    {t(REMINDER_LABELS[r.type])}
                  </span>
                  <span className="text-xs font-semibold text-white truncate">{r.clientName}</span>
                  <span className="text-[11px] font-mono text-amber-400">{r.contractNumber}</span>
                </div>
                <div className="mt-1 text-xs text-slate-400 truncate">{detail(r)}</div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={!r.phone}
                  onClick={() => send(r)}
                  title={r.phone ? t('Ouvrir WhatsApp avec le message prérempli') : t('Aucun numéro de téléphone pour ce client')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/90 hover:bg-emerald-400 text-slate-950 font-bold text-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>{r.phone ? 'WhatsApp' : t('Pas de numéro')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => markDone(r.id)}
                  title={t('Marquer comme déjà relancé')}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 text-xs cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t('Fait')}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
