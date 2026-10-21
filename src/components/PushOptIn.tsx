import React, { useEffect, useState } from 'react';
import { Bell, BellOff, Send } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useI18n } from '../i18n/I18nContext';
import { disablePush, enablePush, getPushState, sendTestPush, type PushState } from '../lib/pushClient';

/** Activation des notifications push sur cet appareil (gérant et managers). */
export const PushOptIn: React.FC = () => {
  const { t } = useI18n();
  const { currentUser } = useApp();
  const allowed = currentUser?.role === 'admin' || currentUser?.role === 'manager';
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    getPushState().then((s) => {
      if (!cancelled) setState(s);
    });
    return () => {
      cancelled = true;
    };
  }, [allowed]);

  if (!allowed || state === null || state === 'unsupported' || state === 'disabled-by-server') return null;

  const turnOn = async () => {
    setBusy(true);
    setMessage('');
    const result = await enablePush();
    if (result === 'on') setState('on');
    else if (result === 'denied') setState('denied');
    else setMessage(t("Impossible d'activer les notifications pour le moment. Réessayez."));
    setBusy(false);
  };

  const turnOff = async () => {
    setBusy(true);
    setMessage('');
    if (await disablePush()) setState('off');
    else setMessage(t('Impossible de désactiver les notifications pour le moment.'));
    setBusy(false);
  };

  const test = async () => {
    setBusy(true);
    const reached = await sendTestPush();
    setMessage(reached > 0 ? t('Notification envoyée : regardez votre téléphone.') : t("L'envoi d'essai a échoué."));
    setBusy(false);
  };

  if (state === 'needs-install') {
    return (
      <div className="glass rounded-3xl p-4 text-xs text-slate-300 flex items-start gap-3" role="note">
        <Bell className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <p>{t("Sur iPhone, installez d'abord l'app sur l'écran d'accueil (Partager → Sur l'écran d'accueil) pour activer les notifications.")}</p>
      </div>
    );
  }

  if (state === 'denied') {
    return (
      <div className="glass rounded-3xl p-4 text-xs text-slate-300 flex items-start gap-3" role="note">
        <BellOff className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
        <p>{t("Les notifications sont bloquées. Autorisez-les dans les réglages de votre navigateur pour cette application, puis revenez ici.")}</p>
      </div>
    );
  }

  if (state === 'on') {
    return (
      <div className="glass rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-emerald-300 font-semibold">
          <Bell className="w-4 h-4" />
          {t('Notifications activées sur cet appareil')}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" disabled={busy} onClick={test} className="inline-flex items-center gap-1.5 min-h-11 px-3 rounded-xl border border-white/10 text-xs text-slate-200 hover:text-white disabled:opacity-50 cursor-pointer">
            <Send className="w-3.5 h-3.5" />
            {t('Envoyer un essai')}
          </button>
          <button type="button" disabled={busy} onClick={turnOff} className="min-h-11 px-3 rounded-xl text-xs text-slate-400 hover:text-rose-300 disabled:opacity-50 cursor-pointer">
            {t('Désactiver')}
          </button>
        </div>
        {message && (
          <p className="basis-full text-[11px] text-slate-300" role="status">
            {message}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="glass glass-gold rounded-3xl p-4 flex items-start gap-3">
      <div className="w-11 h-11 shrink-0 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center">
        <Bell className="w-5 h-5" />
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-bold text-white">{t('Recevez le point du jour sur votre téléphone')}</h2>
        <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
          {t('Un résumé chaque matin (retards, retours, réservations) et une alerte immédiate en cas de retard.')}
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={turnOn}
          className="mt-2.5 inline-flex items-center gap-2 min-h-11 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 text-xs font-bold shadow-md shadow-amber-500/20 active:scale-95 transition-transform disabled:opacity-50 cursor-pointer"
        >
          <Bell className="w-4 h-4" />
          {t('Activer les notifications')}
        </button>
        {message && (
          <p className="mt-2 text-[11px] text-rose-300" role="alert">
            {message}
          </p>
        )}
      </div>
    </div>
  );
};
