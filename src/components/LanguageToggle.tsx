import React from 'react';
import { Languages } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';

/** Bascule FR / العربية. Le bouton affiche la langue vers laquelle on bascule. */
export const LanguageToggle: React.FC<{ compact?: boolean; className?: string }> = ({ compact = false, className = '' }) => {
  const { lang, toggleLang } = useI18n();
  const target = lang === 'ar' ? 'Français' : 'العربية';

  return (
    <button
      type="button"
      onClick={toggleLang}
      title={lang === 'ar' ? 'Passer en français' : 'التبديل إلى العربية'}
      aria-label={lang === 'ar' ? 'Passer en français' : 'التبديل إلى العربية'}
      className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-xl border bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 hover:border-amber-500/40 transition-all cursor-pointer ${className}`}
    >
      <Languages className="w-3.5 h-3.5 text-amber-400" />
      {!compact && <span className="font-semibold">{target}</span>}
    </button>
  );
};
