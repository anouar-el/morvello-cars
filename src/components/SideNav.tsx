import React from 'react';
import { PlusCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useI18n } from '../i18n/I18nContext';
import { useNavModel } from './navModel';

/** Menu latéral groupé, visible à partir de 1024 px (PC). En dessous : onglets (tablette) ou barre du bas (mobile). */
export const SideNav: React.FC = () => {
  const { activeTab, setActiveTab } = useApp();
  const { t } = useI18n();
  const model = useNavModel();

  if (!model) return null;

  return (
    <aside
      aria-label={t('Navigation principale')}
      className="no-print hidden lg:flex flex-col w-60 shrink-0 sticky top-[6.5rem] self-start max-h-[calc(100vh-6.5rem)] overflow-y-auto border-e border-slate-800 bg-slate-950/60 px-3 py-4 gap-4 no-scrollbar"
    >
      <button
        type="button"
        onClick={() => setActiveTab('new_contract')}
        className={`flex items-center justify-center gap-2 font-bold text-sm px-3 py-2.5 rounded-xl shadow-lg shadow-amber-500/20 transition-all active:scale-95 cursor-pointer bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 ${
          activeTab === 'new_contract' ? 'ring-2 ring-amber-300/70' : ''
        }`}
      >
        <PlusCircle className="w-4 h-4 shrink-0" />
        <span>{t('Nouveau contrat')}</span>
      </button>

      <nav className="flex flex-col gap-4">
        {model.groups.map((group) => (
          <div key={group.id} className="flex flex-col gap-0.5">
            <div className="px-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">{group.label}</div>
            {group.items.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-start transition-colors cursor-pointer border-s-2 ${
                    isActive
                      ? 'bg-amber-500/15 text-amber-400 font-semibold border-amber-400'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 border-transparent'
                  }`}
                >
                  {item.icon}
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.count !== undefined && item.count > 0 && (
                    <span
                      className={`text-[10px] min-w-[20px] text-center px-1.5 py-0.5 rounded-full font-mono font-bold ${
                        isActive ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300 border border-slate-700'
                      }`}
                    >
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
};
