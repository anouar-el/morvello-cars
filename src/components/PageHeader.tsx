import React, { useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';

export interface PageHeaderAction {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  title?: string;
  disabled?: boolean;
}

interface PageHeaderProps {
  icon: React.ReactNode;
  title: string;
  /** Une ligne d'explication, masquée sur mobile pour laisser la place au contenu. */
  subtitle?: string;
  /** Pastille à côté du titre (vue du rôle, etc.). */
  badge?: React.ReactNode;
  /** Un seul bouton principal par page. */
  primary?: {
    label: string;
    shortLabel?: string;
    icon?: React.ReactNode;
    onClick: () => void;
    className?: string;
  };
  /** Actions secondaires (exports, imports, actualisation) rangées dans un menu « ⋯ ». */
  actions?: PageHeaderAction[];
}

const DEFAULT_PRIMARY_CLASS =
  'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-amber-500/20';

export const PageHeader: React.FC<PageHeaderProps> = ({ icon, title, subtitle, badge, primary, actions }) => {
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const visibleActions = (actions || []).filter(Boolean);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-2xl shadow-xl">
      <div className="min-w-0 flex-1">
        <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className="text-amber-400 shrink-0">{icon}</span>
          <span>{title}</span>
          {badge}
        </h1>
        {subtitle && <p className="hidden sm:block text-xs text-slate-400 mt-1">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-2 sm:shrink-0">
        {primary && (
          <button
            type="button"
            onClick={primary.onClick}
            className={`flex-1 sm:flex-none justify-center flex items-center gap-2 font-bold px-3.5 sm:px-4 py-2.5 sm:py-2 rounded-xl text-xs sm:text-sm shadow-md transition-all cursor-pointer whitespace-nowrap ${
              primary.className || DEFAULT_PRIMARY_CLASS
            }`}
          >
            {primary.icon}
            {primary.shortLabel ? (
              <>
                <span className="sm:hidden">{primary.shortLabel}</span>
                <span className="hidden sm:inline">{primary.label}</span>
              </>
            ) : (
              <span>{primary.label}</span>
            )}
          </button>
        )}

        {visibleActions.length > 0 && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label={t("Plus d'actions")}
              title={t("Plus d'actions")}
              className="flex items-center justify-center w-10 h-10 sm:w-9 sm:h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 cursor-pointer transition-colors"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div
                  role="menu"
                  className="absolute end-0 mt-2 w-64 max-w-[calc(100vw-2rem)] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-1.5 z-50"
                >
                  {visibleActions.map((action) => (
                    <button
                      key={action.label}
                      type="button"
                      role="menuitem"
                      disabled={action.disabled}
                      title={action.title}
                      onClick={() => {
                        setMenuOpen(false);
                        action.onClick();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs text-start text-slate-200 hover:bg-slate-800 hover:text-white cursor-pointer disabled:opacity-50"
                    >
                      {action.icon}
                      <span>{action.label}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
