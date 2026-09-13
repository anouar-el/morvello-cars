import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Car, Lock, Mail, ShieldCheck, KeyRound, ArrowRight, AlertTriangle } from 'lucide-react';

export const LoginView: React.FC = () => {
  const { login, users, companySettings } = useApp();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const res = login(email, password);
    if (!res.success) {
      setError(res.error || 'Identifiants invalides.');
    }
  };

  const handleQuickLogin = (quickEmail: string, quickPass: string) => {
    setEmail(quickEmail);
    setPassword(quickPass);
    const res = login(quickEmail, quickPass);
    if (!res.success) {
      setError(res.error || 'Identifiants invalides.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-amber-500/10 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[400px] h-[400px] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center mx-auto shadow-2xl shadow-amber-500/20">
            <Car className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white uppercase font-mono">
            {companySettings.name}
          </h1>
          <p className="text-xs text-slate-400">
            Portail de Gestion de Flotte & Contrats de Location
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-slate-900/90 border border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-md space-y-6">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Connexion Collaborateur</span>
            </h2>
            <p className="text-xs text-slate-400">
              Veuillez saisir votre email personnel et votre mot de passe.
            </p>
          </div>

          {error && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 text-xs text-rose-300 flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300">
                Adresse Email
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nom@morvellocars.com"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500 transition-colors"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-300">
                  Mot de passe
                </label>
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <KeyRound className="w-4 h-4" />
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500 transition-colors"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs py-3 rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              <span>Se connecter</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Demo Logins for convenience */}
          <div className="border-t border-slate-800 pt-4 space-y-2">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block text-center">
              Accès rapide (Comptes de test)
            </span>
            <div className="grid grid-cols-3 gap-2">
              {users.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => handleQuickLogin(u.email, u.password || 'admin123')}
                  className="bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 p-2 rounded-xl text-left transition-colors cursor-pointer group"
                >
                  <div className="text-[11px] font-bold text-white truncate group-hover:text-amber-400">
                    {u.name.split(' ')[0]}
                  </div>
                  <div className="text-[9px] text-slate-400 capitalize">
                    {u.role === 'admin' ? 'Gérant' : u.role === 'manager' ? 'Resp.' : 'Agent'}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer info */}
        <p className="text-center text-[10px] text-slate-500">
          Système sécurisé Morvello Cars • Tous droits réservés
        </p>
      </div>
    </div>
  );
};
