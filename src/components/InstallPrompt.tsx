import React, { useEffect, useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';
import {
  appWasInstalled,
  canPromptNatively,
  isIosSafari,
  promptInstall,
  readSnoozed,
  snoozeInstallPrompt,
  subscribeInstall,
} from '../lib/pwaInstall';

/** Invite chaque utilisateur qui n'a pas encore installé l'app à le faire (bannière de l'accueil). */
export const InstallPrompt: React.FC = () => {
  const { t } = useI18n();
  const [, force] = useState(0);
  const [hidden, setHidden] = useState(() => readSnoozed());

  useEffect(() => subscribeInstall(() => force((n) => n + 1)), []);

  if (hidden || appWasInstalled()) return null;
  const native = canPromptNatively();
  const ios = isIosSafari();
  if (!native && !ios) return null;

  const dismiss = () => {
    snoozeInstallPrompt();
    setHidden(true);
  };

  const install = async () => {
    const outcome = await promptInstall();
    if (outcome === 'dismissed') dismiss();
  };

  return (
    <div role="region" aria-label={t("Installer l'application")} className="glass glass-gold rounded-3xl p-4 flex items-start gap-3">
      <div className="w-11 h-11 shrink-0 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center">
        {native ? <Download className="w-5 h-5" /> : <Share className="w-5 h-5" />}
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-bold text-white">{t("Installez Morvello Cars sur votre téléphone")}</h2>
        <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
          {native
            ? t("Accès direct depuis l'écran d'accueil, en plein écran, comme une application.")
            : t("Dans Safari, touchez Partager puis « Sur l'écran d'accueil » pour l'installer comme une application.")}
        </p>
        {native && (
          <button
            type="button"
            onClick={install}
            className="mt-2.5 inline-flex items-center gap-2 min-h-11 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 text-xs font-bold shadow-md shadow-amber-500/20 active:scale-95 transition-transform cursor-pointer"
          >
            <Download className="w-4 h-4" />
            {t("Installer l'application")}
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t('Plus tard')}
        className="shrink-0 w-11 h-11 -m-2 flex items-center justify-center rounded-xl text-slate-400 hover:text-white cursor-pointer"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
