import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AR } from './ar';
import { translatePattern } from './patterns';

/*
 * Traduction de l'interface. Le texte français sert de clé : `t('Nouveau contrat')` renvoie le français
 * tel quel, ou sa traduction arabe quand la langue est « ar ». Un texte absent du dictionnaire
 * s'affiche en français : l'application ne montre jamais de clé brute ni de texte vide.
 * Les paramètres s'écrivent {nom} dans la phrase : t("Sur {n} contrats au total", { n: 3 }).
 */

export type Lang = 'fr' | 'ar';
export type TParams = Record<string, string | number>;

const STORAGE_KEY = 'morvello_lang';

export function translate(lang: Lang, text: string, params?: TParams): string {
  let base = text;
  if (lang === 'ar') {
    base = AR[text] ?? translatePattern(text, (part) => AR[part] ?? part) ?? text;
  }
  if (!params) return base;
  return base.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
}

interface I18nValue {
  lang: Lang;
  isRtl: boolean;
  setLang: (lang: Lang) => void;
  toggleLang: () => void;
  t: (text: string, params?: TParams) => string;
}

const defaultValue: I18nValue = {
  lang: 'fr',
  isRtl: false,
  setLang: () => {},
  toggleLang: () => {},
  t: (text, params) => translate('fr', text, params),
};

const I18nContext = createContext<I18nValue>(defaultValue);

function readStoredLang(): Lang {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'ar' ? 'ar' : 'fr';
  } catch {
    return 'fr';
  }
}

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Lang>(readStoredLang);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // stockage indisponible : le choix vaut pour la session
    }
  }, []);

  // Langue et sens d'écriture de toute la page : les composants n'ont rien d'autre à faire.
  useEffect(() => {
    const root = document.documentElement;
    root.lang = lang;
    root.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

  const value = useMemo<I18nValue>(
    () => ({
      lang,
      isRtl: lang === 'ar',
      setLang,
      toggleLang: () => setLang(lang === 'ar' ? 'fr' : 'ar'),
      t: (text, params) => translate(lang, text, params),
    }),
    [lang, setLang]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = (): I18nValue => useContext(I18nContext);
