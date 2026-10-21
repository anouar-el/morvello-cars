import React, { useState } from 'react';
import { Plus, Star, Trash2, ShieldAlert, ThumbsUp, Eye } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useI18n } from '../../i18n/I18nContext';
import {
  OBSERVATION_TAGS,
  RATING_LABELS,
  canAccessObservations,
  newObservationId,
  sortObservationsNewestFirst,
  summarizeObservations,
  tagTone,
  type ClientStanding,
} from '../../lib/clientObservations';
import type { Client, ClientObservation, ObservationTag } from '../../types';
import { ClientObservationForm, EMPTY_OBSERVATION, isObservationFilled, type ObservationDraft } from './ClientObservationForm';

const tagLabel = (tag: ObservationTag) => OBSERVATION_TAGS.find((x) => x.id === tag)?.label ?? tag;

export const StandingBadge: React.FC<{ standing: ClientStanding; average: number | null }> = ({ standing, average }) => {
  const { t } = useI18n();
  if (standing === 'none') return null;
  const cfg = {
    good: { cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40', icon: <ThumbsUp className="w-3.5 h-3.5" />, label: t('Bon client') },
    watch: { cls: 'bg-amber-500/15 text-amber-300 border-amber-500/40', icon: <Eye className="w-3.5 h-3.5" />, label: t('À surveiller') },
    avoid: { cls: 'bg-rose-500/15 text-rose-300 border-rose-500/40', icon: <ShieldAlert className="w-3.5 h-3.5" />, label: t('À éviter') },
  }[standing];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold ${cfg.cls}`}>
      {cfg.icon}
      {cfg.label}
      {average !== null && <span className="font-mono">{average.toFixed(1)}/5</span>}
    </span>
  );
};

export const Stars: React.FC<{ rating: number }> = ({ rating }) => (
  <span className="inline-flex" aria-label={`${rating}/5`}>
    {[1, 2, 3, 4, 5].map((n) => (
      <Star key={n} className={`w-3.5 h-3.5 ${n <= rating ? 'text-amber-400 fill-amber-400' : 'text-slate-700'}`} />
    ))}
  </span>
);

/** Fiche « comportement » d'un client : résumé, historique daté et ajout d'une observation. */
export const ClientObservationsPanel: React.FC<{ clientId: string }> = ({ clientId }) => {
  const { t } = useI18n();
  const { clients, updateClient, currentUser } = useApp();
  const client = clients.find((c) => c.id === clientId);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<ObservationDraft>(EMPTY_OBSERVATION);

  if (!client || !canAccessObservations(currentUser?.role)) return null;

  const log = sortObservationsNewestFirst(client.behaviorLog);
  const summary = summarizeObservations(client.behaviorLog);

  const save = () => {
    if (draft.rating === null) return;
    const obs: ClientObservation = {
      id: newObservationId(),
      createdAt: new Date().toISOString(),
      authorName: currentUser?.name || 'Direction',
      authorId: currentUser?.id,
      rating: draft.rating as ClientObservation['rating'],
      tags: draft.tags,
      comment: draft.comment.trim(),
    };
    updateClient(client.id, { behaviorLog: [...(client.behaviorLog ?? []), obs] } as Partial<Client>);
    setDraft(EMPTY_OBSERVATION);
    setAdding(false);
  };

  const remove = (id: string) => {
    if (!window.confirm(t('Supprimer cette observation ?'))) return;
    updateClient(client.id, { behaviorLog: (client.behaviorLog ?? []).filter((o) => o.id !== id) } as Partial<Client>);
  };

  return (
    <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xs font-bold text-white">{t('Comportement du client')}</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">{t('Réservé à la direction. Ne figure jamais sur le contrat.')}</p>
        </div>
        <StandingBadge standing={summary.standing} average={summary.average} />
      </div>

      {summary.count > 0 && summary.negativeTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {summary.negativeTags.map(({ tag, count }) => (
            <span key={tag} className="text-[11px] px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-300">
              {t(tagLabel(tag))} ×{count}
            </span>
          ))}
        </div>
      )}

      {adding ? (
        <div className="space-y-3 border border-slate-800 rounded-xl p-3">
          <ClientObservationForm value={draft} onChange={setDraft} />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setDraft(EMPTY_OBSERVATION);
              }}
              className="min-h-11 px-4 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold cursor-pointer"
            >
              {t('Annuler')}
            </button>
            <button
              type="button"
              disabled={draft.rating === null || !isObservationFilled(draft)}
              onClick={save}
              className="min-h-11 px-4 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold disabled:opacity-40 cursor-pointer"
            >
              {t("Enregistrer l'observation")}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1.5 min-h-11 px-3 rounded-xl border border-amber-500/40 text-amber-300 text-xs font-bold hover:bg-amber-500/10 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          {t('Ajouter une observation')}
        </button>
      )}

      {log.length === 0 ? (
        <p className="text-[11px] text-slate-500 italic">{t("Aucune observation pour l'instant.")}</p>
      ) : (
        <ol className="space-y-2">
          {log.map((o) => (
            <li key={o.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Stars rating={o.rating} />
                  <span className="text-[11px] text-amber-300 font-semibold">{t(RATING_LABELS[o.rating])}</span>
                </div>
                {currentUser?.role === 'admin' && (
                  <button
                    type="button"
                    onClick={() => remove(o.id)}
                    aria-label={t('Supprimer')}
                    className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-500 hover:text-rose-400 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              {o.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {o.tags.map((tag) => (
                    <span
                      key={tag}
                      className={`text-[11px] px-2 py-0.5 rounded-full border ${
                        tagTone(tag) === 'positive'
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                          : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                      }`}
                    >
                      {t(tagLabel(tag))}
                    </span>
                  ))}
                </div>
              )}
              {o.comment && <p className="text-xs text-slate-200 whitespace-pre-wrap">{o.comment}</p>}
              <div className="text-[11px] text-slate-400">
                {new Date(o.createdAt).toLocaleDateString('fr-FR')} • {o.authorName}
                {o.contractNumber ? ` • ${t('Contrat')} ${o.contractNumber}` : ''}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
};
