import { useState, useEffect, useCallback } from 'react';
import { supabase, isOfflineMode } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';
import { MijnFouten } from './MijnFouten';
import {
  BookOpen,
  LogIn,
  LogOut,
  UserPlus,
  Mail,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  User as UserIcon,
  Sparkles,
} from 'lucide-react';

export interface WordVaultProps {
  onSelectVerbForInspection?: (verb: string) => void;
  onOpenPaywall?: () => void;
  isDarkMode?: boolean;
}

type AuthMode = 'login' | 'register';

export function WordVault({
  onSelectVerbForInspection,
  onOpenPaywall,
  isDarkMode = true,
}: WordVaultProps) {
  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  // Theme helpers
  const headingText = isDarkMode ? 'text-[#E2E8F0]' : 'text-[#0F172A]';
  const bodyText = isDarkMode ? 'text-slate-400' : 'text-slate-600';
  const cardBg = isDarkMode
    ? 'bg-[#151D2A]/80 border-white/10'
    : 'bg-white border-slate-200 shadow-sm';
  const inputBg = isDarkMode
    ? 'bg-indigo-950/40 border-indigo-500/25 text-[#E2E8F0] placeholder:text-slate-500'
    : 'bg-white border-slate-300 text-[#0F172A] placeholder:text-slate-400';

  const loadUser = useCallback(async () => {
    setCheckingSession(true);
    try {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user ?? null);
    } catch {
      setUser(null);
    } finally {
      setCheckingSession(false);
    }
  }, []);

  useEffect(() => {
    loadUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [loadUser]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setAuthError(null);
    setAuthSuccess(null);

    try {
      if (authMode === 'register') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) {
          setAuthError(error.message);
        } else {
          setAuthSuccess(
            'Registratie geslaagd! Controleer je e-mail om je account te bevestigen, of log direct in als e-mailbevestiging is uitgeschakeld.'
          );
          setAuthMode('login');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          setAuthError(
            error.message === 'Invalid login credentials'
              ? 'Onjuist e-mailadres of wachtwoord. Probeer het opnieuw.'
              : error.message
          );
        }
        // on success: onAuthStateChange fires → setUser called automatically
      }
    } catch {
      setAuthError('Er is een onverwachte fout opgetreden. Probeer het later opnieuw.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    setIsLoading(true);
    await supabase.auth.signOut();
    setUser(null);
    setEmail('');
    setPassword('');
    setIsLoading(false);
  };

  if (checkingSession) {
    return (
      <div className={`w-full flex flex-col items-center justify-center py-16 gap-3 ${bodyText}`}>
        <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
        <p className="text-xs font-medium">Sessie controleren…</p>
      </div>
    );
  }

  // ── Authenticated View ──────────────────────────────────────────────────────
  if (user) {
    const displayEmail = user.email ?? '';
    const displayName = displayEmail.split('@')[0];

    return (
      <div className={`w-full space-y-4 ${headingText}`}>
        {/* Profile Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-2xl mb-1.5 shadow-sm ${
                isDarkMode
                  ? 'bg-indigo-950/40 text-indigo-300 border border-indigo-500/30'
                  : 'bg-indigo-50 text-indigo-600 border border-indigo-200'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              Mijn Woorden / Opgeslagen Woorden
            </span>
            <h1 className={`text-xl sm:text-2xl font-extrabold tracking-tight ${headingText}`}>
              Opgeslagen Woorden
            </h1>
            <p className={`text-xs mt-0.5 ${bodyText}`}>
              Opgeslagen werkwoorden met Leitner SRS-herhaling.
            </p>
          </div>

          {/* User chip + logout */}
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <div
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border ${
                isDarkMode
                  ? 'bg-emerald-950/30 border-emerald-500/25 text-emerald-300'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-700'
              }`}
            >
              <UserIcon className="w-3.5 h-3.5" />
              <span className="max-w-[100px] truncate">{displayName}</span>
            </div>
            <button
              onClick={handleLogout}
              disabled={isLoading}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all active:scale-95 ${
                isDarkMode
                  ? 'text-slate-400 border-white/10 hover:text-rose-300 hover:border-rose-500/30 hover:bg-rose-950/20'
                  : 'text-slate-500 border-slate-200 hover:text-rose-600 hover:border-rose-300 hover:bg-rose-50'
              }`}
            >
              <LogOut className="w-3 h-3" />
              Uitloggen
            </button>
          </div>
        </div>

        {/* Pro upsell banner */}
        {onOpenPaywall && (
          <button
            onClick={onOpenPaywall}
            className={`w-full flex items-center justify-between p-3.5 rounded-2xl border backdrop-blur-2xl text-xs transition-all group active:scale-[0.98] ${
              isDarkMode
                ? 'border-indigo-500/20 bg-indigo-950/20 hover:bg-indigo-950/30 shadow-2xl'
                : 'border-indigo-200 bg-indigo-50 hover:bg-indigo-100 shadow-sm'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
              <span className={`font-semibold ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>
                Pro: Onbeperkt Woorden Opslaan &amp; AI-Zinnengenerator
              </span>
            </div>
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-bold group-hover:text-indigo-200 ${
                isDarkMode ? 'text-indigo-300' : 'text-indigo-600'
              }`}
            >
              <span>Eenmalige Betaling · €14.99 Lifetime Pro</span>
              <Sparkles className="w-3 h-3 text-amber-300" />
            </span>
          </button>
        )}

        {/* Word List via MijnFouten (SRS) */}
        <MijnFouten
          onSelectVerbForInspection={onSelectVerbForInspection}
          onOpenPaywall={onOpenPaywall}
          isDarkMode={isDarkMode}
        />
      </div>
    );
  }

  // ── Unauthenticated / Auth Form View ───────────────────────────────────────
  const isOffline = isOfflineMode();

  return (
    <div className={`w-full space-y-4 ${headingText}`}>
      {/* Header */}
      <div>
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-2xl mb-1.5 shadow-sm ${
            isDarkMode
              ? 'bg-indigo-950/40 text-indigo-300 border border-indigo-500/30'
              : 'bg-indigo-50 text-indigo-600 border border-indigo-200'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          Mijn Woorden / Opgeslagen Woorden
        </span>
        <h1 className={`text-xl sm:text-2xl font-extrabold tracking-tight ${headingText}`}>
          Opgeslagen Woorden
        </h1>
        <p className={`text-xs mt-0.5 ${bodyText}`}>
          Inloggen / Registreren om je opgeslagen werkwoorden te synchroniseren via al je apparaten.
        </p>
      </div>

      {/* Offline notice */}
      {isOffline && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 ${
            isDarkMode
              ? 'bg-amber-950/30 border-amber-500/30 text-amber-200'
              : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}
        >
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
          <span>
            <strong>Demo-modus:</strong> Supabase is niet geconfigureerd. Woorden worden lokaal opgeslagen.
          </span>
        </div>
      )}

      {/* Auth Card */}
      <div
        className={`rounded-2xl border p-5 space-y-4 ${
          isDarkMode
            ? 'bg-white/5 border-white/10 backdrop-blur-xl'
            : 'bg-white border-slate-200 shadow-sm'
        }`}
      >
        {/* Tab switcher */}
        <div
          className={`flex rounded-xl p-1 gap-1 ${
            isDarkMode ? 'bg-indigo-950/40' : 'bg-slate-100'
          }`}
        >
          <button
            onClick={() => { setAuthMode('login'); setAuthError(null); setAuthSuccess(null); }}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
              authMode === 'login'
                ? 'bg-indigo-600 text-white shadow-md'
                : isDarkMode
                  ? 'text-slate-400 hover:text-slate-200'
                  : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <LogIn className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
            Inloggen
          </button>
          <button
            onClick={() => { setAuthMode('register'); setAuthError(null); setAuthSuccess(null); }}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
              authMode === 'register'
                ? 'bg-indigo-600 text-white shadow-md'
                : isDarkMode
                  ? 'text-slate-400 hover:text-slate-200'
                  : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
            Registreren
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleAuth} className="space-y-3">
          {/* Email */}
          <div className="space-y-1">
            <label className={`text-xs font-semibold ${bodyText}`}>E-mailadres</label>
            <div className="relative">
              <Mail
                className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${
                  isDarkMode ? 'text-indigo-400' : 'text-slate-400'
                }`}
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jouw@email.com"
                required
                autoComplete="email"
                className={`w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all ${inputBg}`}
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1">
            <label className={`text-xs font-semibold ${bodyText}`}>Wachtwoord</label>
            <div className="relative">
              <Lock
                className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${
                  isDarkMode ? 'text-indigo-400' : 'text-slate-400'
                }`}
              />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={authMode === 'register' ? 'Min. 8 tekens' : '••••••••'}
                required
                minLength={authMode === 'register' ? 8 : 1}
                autoComplete={authMode === 'register' ? 'new-password' : 'current-password'}
                className={`w-full pl-10 pr-10 py-2.5 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all ${inputBg}`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className={`absolute right-3 top-1/2 -translate-y-1/2 transition-colors ${
                  isDarkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'
                }`}
                aria-label={showPassword ? 'Verberg wachtwoord' : 'Toon wachtwoord'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Error */}
          {authError && (
            <div
              className={`flex items-center gap-2 p-3 rounded-xl border text-xs font-medium ${
                isDarkMode
                  ? 'bg-rose-950/40 border-rose-500/30 text-rose-300'
                  : 'bg-rose-50 border-rose-200 text-rose-700'
              }`}
            >
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{authError}</span>
            </div>
          )}

          {/* Success */}
          {authSuccess && (
            <div
              className={`flex items-start gap-2 p-3 rounded-xl border text-xs font-medium ${
                isDarkMode
                  ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-200'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-700'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
              <span>{authSuccess}</span>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-5 bg-gradient-to-r from-indigo-600 via-indigo-500 to-indigo-600 hover:from-indigo-500 hover:to-indigo-400 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-600/30 border border-indigo-400/30 transition-all active:scale-[0.98] inline-flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Even wachten…</span>
              </>
            ) : authMode === 'login' ? (
              <>
                <LogIn className="w-4 h-4" />
                <span>Inloggen</span>
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                <span>Gratis account aanmaken</span>
              </>
            )}
          </button>
        </form>

        {/* Footer note */}
        <p className={`text-center text-[11px] leading-relaxed ${bodyText}`}>
          {authMode === 'register'
            ? 'Door te registreren ga je akkoord met het opslaan van je leervoortgang in Supabase.'
            : 'Je werkwoorden worden gesynchroniseerd zodra je inlogt.'}
        </p>
      </div>

      {/* Guest mode: still show word list from localStorage */}
      <div className={`rounded-2xl border p-4 ${cardBg}`}>
        <p className={`text-xs font-semibold mb-1 ${headingText}`}>
          Gast-modus: lokale woordenlijst
        </p>
        <p className={`text-[11px] ${bodyText}`}>
          Je kunt zonder account werkwoorden opslaan. Log in om alles te synchroniseren.
        </p>
      </div>

      <MijnFouten
        onSelectVerbForInspection={onSelectVerbForInspection}
        onOpenPaywall={onOpenPaywall}
      />
    </div>
  );
}
