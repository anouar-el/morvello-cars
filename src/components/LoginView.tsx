import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Car,
  Mail,
  ShieldCheck,
  KeyRound,
  ArrowRight,
  AlertTriangle,
  Eye,
  EyeOff,
  CheckCircle2,
  Lock,
  HelpCircle,
} from 'lucide-react';

export const LoginView: React.FC = () => {
  const { login, sendResetEmail, companySettings } = useApp();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Forgot password modal
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetStatus, setResetStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [resetMessage, setResetMessage] = useState('');

  const formatAuthError = (msg: string) => {
    if (!msg) return 'Identifiants invalides.';
    if (msg.includes('operation-not-allowed') || msg.includes('auth/operation-not-allowed')) {
      return "Le mode Email/Mot de passe n'est pas activé dans la console. Veuillez vérifier vos identifiants d'agence.";
    }
    if (
      msg.includes('Invalid path') ||
      msg.includes('PGRST') ||
      msg.includes('invalid_grant') ||
      msg.includes('invalid login credentials') ||
      msg.includes('invalid_credentials')
    ) {
      return 'Adresse email ou mot de passe incorrect.';
    }
    return msg;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await login(email, password);
      if (!res.success) {
        setError(formatAuthError(res.error || 'Identifiants invalides.'));
      }
    } catch (err: any) {
      setError(formatAuthError(err?.message || 'Erreur lors de la connexion.'));
    } finally {
      setLoading(false);
    }
  };

  const handleSendResetEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) return;

    setResetStatus('loading');
    setResetMessage('');
    try {
      const res = await sendResetEmail(resetEmail.trim());
      if (res.success) {
        setResetStatus('success');
        setResetMessage('Un email avec un lien de réinitialisation sécurisé a été envoyé.');
      } else {
        setResetStatus('error');
        setResetMessage(res.error || 'Impossible d’envoyer le lien.');
      }
    } catch (err: any) {
      setResetStatus('error');
      setResetMessage(err?.message || 'Erreur lors de l’envoi.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 relative overflow-hidden selection:bg-amber-500 selection:text-slate-950">
      {/* Ambient luxury lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[650px] bg-amber-500/10 blur-[160px] rounded-full pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[450px] h-[450px] bg-blue-600/10 blur-[130px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto shadow-2xl shadow-amber-500/15">
            <Car className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white uppercase font-mono">
            {companySettings.name}
          </h1>
          <p className="text-xs text-slate-400">
            Portail de Gestion de Flotte & Conciergerie Automobile
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-slate-900/90 border border-slate-800/90 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-md space-y-5">
          <div className="space-y-1 border-b border-slate-800 pb-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Connexion d'Agence</span>
              </h2>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full font-semibold">
                Supabase & Cloud
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Identifiez-vous pour accéder au tableau de bord et à la flotte.
            </p>
          </div>

          {error && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 text-xs text-rose-300 flex items-center gap-2.5 animate-in fade-in duration-200">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">
                Adresse Email / Identifiant
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="anouar@morvellocars.com"
                  className="w-full bg-slate-950 border border-slate-750 focus:border-amber-500 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none transition-colors"
                  required
                  autoFocus
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-300">
                  Mot de passe
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setResetEmail(email);
                    setShowForgotModal(true);
                  }}
                  className="text-[11px] text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
                >
                  Mot de passe oublié ?
                </button>
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <KeyRound className="w-4 h-4" />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-750 focus:border-amber-500 rounded-xl pl-9 pr-10 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none transition-colors"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !email.trim() || !password.trim()}
              className="w-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-bold text-xs py-3 rounded-xl shadow-lg shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              <span>{loading ? 'Connexion en cours...' : 'Se connecter'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Notice */}
          <div className="pt-2 text-center text-[11px] text-slate-500 border-t border-slate-850">
            <span>Accès sécurisé réservé au personnel Morvello Cars</span>
          </div>
        </div>

        {/* Footer info */}
        <p className="text-center text-[10px] text-slate-400">
          Système certifié Morvello Cars • Chiffrement sécurisé & Cloud PostgreSQL (Supabase)
        </p>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Réinitialiser le Mot de Passe</h3>
                <p className="text-[11px] text-slate-400">Via le service sécurisé Supabase Auth</p>
              </div>
            </div>

            {resetStatus === 'success' ? (
              <div className="space-y-4">
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-xs text-emerald-300 flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{resetMessage}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotModal(false);
                    setResetStatus('idle');
                  }}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white rounded-xl transition-colors"
                >
                  Fermer
                </button>
              </div>
            ) : (
              <form onSubmit={handleSendResetEmail} className="space-y-3">
                <p className="text-xs text-slate-300 leading-relaxed">
                  Entrez votre adresse email de collaborateur. Nous vous enverrons un lien officiel pour définir un nouveau mot de passe.
                </p>

                {resetStatus === 'error' && (
                  <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-2.5 text-xs text-rose-300 flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span>{resetMessage}</span>
                  </div>
                )}

                <input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="votre-email@morvellocars.com"
                  className="w-full bg-slate-950 border border-slate-750 focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none"
                  required
                  autoFocus
                />

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotModal(false);
                      setResetStatus('idle');
                    }}
                    className="flex-1 py-2 bg-slate-800 hover:bg-slate-750 text-xs font-semibold text-slate-300 rounded-xl transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={resetStatus === 'loading' || !resetEmail.trim()}
                    className="flex-1 py-2 bg-amber-500 hover:bg-amber-400 text-xs font-bold text-slate-950 rounded-xl shadow-md transition-colors disabled:opacity-50"
                  >
                    {resetStatus === 'loading' ? 'Envoi...' : 'Envoyer le lien'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
