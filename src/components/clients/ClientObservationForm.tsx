import React from 'react';
import { Star } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';
import { OBSERVATION_TAGS, RATING_LABELS } from '../../lib/clientObservations';
import type { ObservationTag } from '../../types';

export interface ObservationDraft {
  rating: number | null;
  tags: ObservationTag[];
  comment: string;
}

export const EMPTY_OBSERVATION: ObservationDraft = { rating: null, tags: [], comment: '' };

export function isObservationFilled(draft: ObservationDraft): boolean {
  return draft.rating !== null || draft.tags.length > 0 || draft.comment.trim().length > 0;
}

interface Props {
  value: ObservationDraft;
  onChange: (next: ObservationDraft) => void;
}

/** Note, étiquettes et commentaire : le même formulaire sert à la restitution, à la fiche client et aux contrats. */
export const ClientObservationForm: React.FC<Props> = ({ value, onChange }) => {
  const { t } = useI18n();

  const toggleTag = (tag: ObservationTag) => {
    const tags = value.tags.includes(tag) ? value.tags.filter((x) => x !== tag) : [...value.tags, tag];
    onChange({ ...value, tags });
  };

  return (
    <div className="space-y-3">
      <div>
        <div className="text-[11px] font-semibold text-slate-300 mb-1.5">{t('Note globale du client')}</div>
        <div className="flex items-center gap-1" role="radiogroup" aria-label={t('Note globale du client')}>
          {[1, 2, 3, 4, 5].map((n) => {
            const on = value.rating !== null && n <= value.rating;
            return (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={value.rating === n}
                aria-label={`${n} / 5 — ${t(RATING_LABELS[n])}`}
                onClick={() => onChange({ ...value, rating: value.rating === n ? null : n })}
                className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-white/5 cursor-pointer"
              >
                <Star className={`w-6 h-6 ${on ? 'text-amber-400 fill-amber-400' : 'text-slate-600'}`} />
              </button>
            );
          })}
          {value.rating !== null && <span className="ms-2 text-xs text-amber-300 font-semibold">{t(RATING_LABELS[value.rating])}</span>}
        </div>
        {value.rating === null && (value.tags.length > 0 || value.comment.trim().length > 0) && (
          <p className="text-[11px] text-amber-300 mt-1" role="status">
            {t('Choisissez une note pour enregistrer cette observation.')}
          </p>
        )}
      </div>

      <div>
        <div className="text-[11px] font-semibold text-slate-300 mb-1.5">{t('Comportement constaté')}</div>
        <div className="flex flex-wrap gap-1.5">
          {OBSERVATION_TAGS.map((tag) => {
            const on = value.tags.includes(tag.id);
            const tone =
              tag.tone === 'positive'
                ? on
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                  : 'border-slate-700 text-slate-400 hover:border-emerald-500/40'
                : on
                ? 'bg-rose-500/20 border-rose-500/50 text-rose-300'
                : 'border-slate-700 text-slate-400 hover:border-rose-500/40';
            return (
              <button
                key={tag.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggleTag(tag.id)}
                className={`min-h-9 px-3 rounded-full border text-[11px] font-semibold transition-colors cursor-pointer ${tone}`}
              >
                {t(tag.label)}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-slate-300 mb-1.5">{t('Observation')}</label>
        <textarea
          rows={3}
          value={value.comment}
          onChange={(e) => onChange({ ...value, comment: e.target.value })}
          placeholder={t('Faits précis : dates, retards, dommages… (évitez les jugements personnels)')}
          className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder:text-slate-500 focus:border-amber-500 focus:outline-none"
        />
      </div>
    </div>
  );
};
