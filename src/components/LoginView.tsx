import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Car,
  Lock,
  Mail,
  ShieldCheck,
  KeyRound,
  ArrowRight,
  AlertTriangle,
  Eye,
  EyeOff,
  HelpCircle,
  CheckCircle2,
  Crown,
  Building2,
} from 'lucide-react';

export const LoginView: React.FC = () => {
  const { login, users, companySettings } = useApp();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showDemoAccounts, setShowDemoAccounts] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    setTimeout(() => {
      const res = login(email, password);
      if (!res.success) {
        setError(res.error || 'Identifiants invalides.');
      }
      setLoading(false);
    }, 200);
  };

  const fillCredentials = (userEmail: string, userPass: string) => {
    setEmail(userEmail);
    setPassword(userPass);
    setError('');
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
        <div className="bg-slate-900/90 border border-slate-800/90 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-md space-y-6">
          <div className="space-y-1 border-b border-slate-800 pb-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Connexion d'Agence</span>
              </h2>
              <span className="text-[10px] font-mono text-amber-400/90 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full font-semibold">
                Session Sécurisée
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Saisissez vos identifiants pour accéder à votre espace d'agence.
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
                  onClick={() => setShowDemoAccounts(!showDemoAccounts)}
                  className="text-[11px] text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <HelpCircle className="w-3 h-3" />
                  <span>Voir les comptes</span>
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

          {/* Collapsible Accounts Reference */}
          {showDemoAccounts && (
            <div className="border border-slate-800 bg-slate-950/90 rounded-2xl p-3.5 space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                  <span>Comptes pré-configurés</span>
                </span>
                <span className="text-[10px] text-slate-500">Cliquez pour pré-remplir</span>
              </div>

              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {users.map((u) => {
                  const pass = u.password || (u.role === 'admin' ? 'admin123' : 'manager123');
                  const isGerant = u.role === 'admin';
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => fillCredentials(u.email, pass)}
                      className="w-full text-left p-2 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-amber-500/50 transition-colors flex items-center justify-between cursor-pointer group"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-1.5">
                          {isGerant ? (
                            <Crown className="w-3 h-3 text-amber-400 shrink-0" />
                          ) : (
                            <Building2 className="w-3 h-3 text-blue-400 shrink-0" />
                          )}
                          <span className="text-xs font-semibold text-white group-hover:text-amber-400 truncate">
                            {u.name}
                          </span>
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 capitalize shrink-0">
                            {isGerant ? 'Gérant' : 'Resp.'}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono truncate">
                          {u.email}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                          {pass}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Notice */}
          <div className="pt-2 text-center text-[11px] text-slate-400 border-t border-slate-850">
            <span>Mot de passe modifiable à tout moment dans</span>{' '}
            <strong className="text-slate-300">Paramètres &gt; Équipe & Accès</strong>.
          </div>
        </div>

        {/* Footer info */}
        <p className="text-center text-[10px] text-slate-400">
          Système certifié Morvello Cars • Chiffrement sécurisé & Cloud Firestore
        </p>
      </div>
    </div>
  );
};
