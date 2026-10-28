import { useState, useEffect } from 'react';
import { APP_CONFIG } from '../lib/config';
import { supabase } from '../lib/supabase';
import { getPremiumStatus, isLocalPremium, onPremiumStatusChange } from '../lib/purchases';
import { VerbChecker } from '../components/VerbChecker';
import { VerbScanner } from '../components/VerbScanner';
import { MijnFouten, type SavedWord } from '../components/MijnFouten';
import { PaywallModal, BannerAdContainer } from '../components/PaywallModal';
import {
  Search,
  Brain,
  Crown,
  CheckCircle2,
  Camera,
  Sun,
  Moon,
  Volume2,
  Sparkles,
  ShieldCheck,
  Check,
  X,
} from 'lucide-react';

const COMMON_EXAMPLE_VERBS = [
  { verb: 'werken', tag: "'t Kofschip (-te)" },
  { verb: 'leven', tag: 'v → f trap (-de)' },
  { verb: 'verhuizen', tag: 'z → s trap (-de)' },
  { verb: 'opbellen', tag: 'Scheidbaar' },
  { verb: 'lopen', tag: 'Hebben / Zijn' },
  { verb: 'zijn', tag: 'Onregelmatig' },
  { verb: 'antwoorden', tag: 'Stam op -d' },
];

export function HomePage() {
  const [activeTab, setActiveTab] = useState<'checker' | 'scanner' | 'fouten'>('checker');
  const [activeVerbForChecker, setActiveVerbForChecker] = useState<string>('leven');
  const [searchInputValue, setSearchInputValue] = useState<string>('leven');
  const [isPaywallOpen, setIsPaywallOpen] = useState<boolean>(false);
  const [isPremium, setIsPremium] = useState<boolean>(() => isLocalPremium());
  const [saveToast, setSaveToast] = useState<string | null>(null);

  // Dark mode state: default to dark for the Neo-Glass & Deep Indigo Space experience
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('kofschip_theme');
      if (saved) return saved === 'dark';
      return true; // Concept 3 default dark
    }
    return true;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('kofschip_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('kofschip_theme', 'light');
    }
  }, [isDarkMode]);

  // Check user premium status across local cache and Supabase on load
  useEffect(() => {
    getPremiumStatus().then((premium) => {
      setIsPremium(premium);
    });

    const unsubscribe = onPremiumStatusChange((premium) => {
      setIsPremium(premium);
    });

    return () => unsubscribe();
  }, []);

  // Save to Mijn Fouten (Supabase + local storage cache)
  const handleSaveToMijnFouten = async (infinitive: string) => {
    const targetVerb = (infinitive || activeVerbForChecker).trim().toLowerCase();
    if (!targetVerb) return;

    try {
      const LOCAL_STORAGE_KEY = 'kofschip_saved_words_cache';
      const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
      const words: SavedWord[] = cached ? JSON.parse(cached) : [];

      if (!words.some((w) => w.infinitive.toLowerCase() === targetVerb)) {
        const newWord: SavedWord = {
          id: `word-${Date.now()}`,
          infinitive: targetVerb,
          times_practiced: 1,
          times_correct: 0,
          mastery_level: 0,
          next_review_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          notes: 'Opgeslagen vanuit Werkwoord Checker',
        };
        const nextWords = [newWord, ...words];
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(nextWords));

        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user) {
          await supabase.from('saved_words').insert({
            user_id: authData.user.id,
            infinitive: newWord.infinitive,
            mastery_level: 0,
            next_review_at: newWord.next_review_at,
            notes: newWord.notes,
          });
        }
      }

      setSaveToast(`'${targetVerb}' toegevoegd aan Mijn Fouten!`);
      setTimeout(() => setSaveToast(null), 3000);
    } catch {
      // offline handled
      setSaveToast(`'${targetVerb}' lokaal opgeslagen!`);
      setTimeout(() => setSaveToast(null), 3000);
    }
  };

  // Verb search handler
  const handleSearch = (verbToSearch?: string) => {
    const target = (verbToSearch ?? searchInputValue).trim().toLowerCase();
    if (!target) return;
    setActiveVerbForChecker(target);
    setSearchInputValue(target);
    setActiveTab('checker');
    setSaveToast(null);
  };

  // Speech synthesis pronunciation trigger
  const handlePronounce = (textToSpeak?: string) => {
    const word = (textToSpeak ?? activeVerbForChecker).trim();
    if (!word) return;

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = 'nl-NL';
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  };

  // Selection from Mijn Fouten back to checker
  const handleSelectVerbFromFouten = (verb: string) => {
    setActiveVerbForChecker(verb);
    setSearchInputValue(verb);
    setActiveTab('checker');
  };

  return (
    <div className="relative min-h-screen bg-[#0B0F19] text-slate-100 flex flex-col overflow-x-hidden selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* 1. Deep Space Radial Glows: #6366F1 & #10B981 at 5% opacity */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
        {/* Indigo radial glow #6366F1 top center */}
        <div
          className="absolute -top-[12%] left-1/2 -translate-x-1/2 w-[700px] sm:w-[1000px] h-[700px] sm:h-[1000px] rounded-full blur-[140px] pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(99, 102, 241, 0.05) 0%, rgba(99, 102, 241, 0) 70%)',
          }}
        />
        {/* Neon Emerald radial glow #10B981 middle-right */}
        <div
          className="absolute top-[28%] -right-[12%] w-[520px] sm:w-[780px] h-[520px] sm:h-[780px] rounded-full blur-[140px] pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(16, 185, 129, 0.05) 0%, rgba(16, 185, 129, 0) 70%)',
          }}
        />
        {/* Secondary Indigo radial glow #6366F1 bottom-left */}
        <div
          className="absolute -bottom-[8%] -left-[8%] w-[480px] sm:w-[680px] h-[480px] sm:h-[680px] rounded-full blur-[130px] pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(99, 102, 241, 0.05) 0%, rgba(99, 102, 241, 0) 70%)',
          }}
        />
      </div>

      {/* Top Navbar — Neo-Glass Header */}
      <header className="sticky top-0 z-40 backdrop-blur-2xl bg-[#0B0F19]/75 border-b border-indigo-500/15 safe-area-top shadow-xl shadow-black/25">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
          <button
            onClick={() => {
              setActiveTab('checker');
              setSearchInputValue('leven');
              setActiveVerbForChecker('leven');
            }}
            className="flex items-center gap-3 text-left focus:outline-none group"
            aria-label="Ga naar startpagina"
          >
            <div className="relative">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-indigo-400 text-white flex items-center justify-center font-extrabold text-xs shadow-lg shadow-indigo-600/30 border border-indigo-400/40 transition-transform group-hover:scale-105">
                NL
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-[#0B0F19]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-sm sm:text-base text-slate-100 tracking-tight leading-tight">
                  {APP_CONFIG.name}
                </span>
                <span className="px-1.5 py-0.5 rounded-md backdrop-blur-xl bg-indigo-950/40 text-indigo-300 text-[10px] font-bold uppercase tracking-wider border border-indigo-500/30">
                  NT2
                </span>
              </div>
              <span className="text-[11px] text-slate-400 block leading-none mt-0.5 font-medium">
                Dutch NT2 Verb Master
              </span>
            </div>
          </button>

          <div className="flex items-center gap-2">
            {/* Audio Pronunciation Quick Trigger */}
            <button
              onClick={() => handlePronounce(activeVerbForChecker)}
              title={`Beluister '${activeVerbForChecker}' uitspraak`}
              aria-label={`Beluister '${activeVerbForChecker}' uitspraak`}
              className="p-2 rounded-xl text-indigo-400 hover:text-indigo-200 backdrop-blur-xl bg-indigo-950/30 hover:bg-indigo-900/40 border border-indigo-500/15 transition-all active:scale-95"
            >
              <Volume2 className="w-4 h-4" />
            </button>

            {/* Theme Toggle Button */}
            <button
              onClick={() => setIsDarkMode((prev) => !prev)}
              title="Wissel donker/licht thema"
              aria-label="Wissel donker/licht thema"
              className="p-2 rounded-xl text-slate-400 hover:text-slate-100 backdrop-blur-xl bg-indigo-950/30 hover:bg-indigo-900/40 border border-indigo-500/15 transition-all active:scale-95"
            >
              {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-300" />}
            </button>

            {/* Pro Status / Upgrade Button */}
            {isPremium ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold backdrop-blur-xl bg-emerald-950/30 text-emerald-300 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>PRO</span>
              </span>
            ) : (
              <button
                onClick={() => setIsPaywallOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white shadow-lg shadow-indigo-600/30 border border-indigo-400/30 transition-all active:scale-95"
              >
                <Crown className="w-3.5 h-3.5" />
                <span>Upgrade €14.99</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 max-w-2xl mx-auto w-full px-4 pt-4 pb-28 space-y-6">
        {/* 3. Hero Search & Controls (Signature Neo-Glass Section) */}
        {activeTab === 'checker' && (
          <section className="space-y-4 pt-2">
            {/* 4. High-contrast typography hierarchy & asymmetric layout */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-2xl bg-indigo-950/40 text-indigo-300 border border-indigo-500/20 shadow-sm">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  <span>'t Kofschip Engine • NT2 Nederlands A1–B2</span>
                </span>

                <span className="text-[11px] font-medium text-slate-400 hidden sm:inline-flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>100% Deterministic Rule Engine</span>
                </span>
              </div>

              <h1 className="font-extrabold tracking-tight text-slate-100 text-3xl sm:text-4xl lg:text-5xl leading-[1.1]">
                Beheers Werkwoorden.
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-indigo-100 to-emerald-400 mt-0.5">
                  Foutloos & Vloeiend.
                </span>
              </h1>

              <p className="text-xs sm:text-sm text-slate-400 max-w-lg leading-relaxed">
                Directe 't kofschip stamcontrole, herkenning van de <span className="text-slate-300 font-semibold">v → f</span> &amp; <span className="text-slate-300 font-semibold">z → s</span> valstrikken en instant audio-uitspraak.
              </p>
            </div>

            {/* Glowing Hero Search Bar with subtle indigo ring highlights on focus */}
            <div className="relative group">
              <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-indigo-500/40 via-indigo-400/20 to-emerald-500/30 blur-sm opacity-50 group-focus-within:opacity-100 group-hover:opacity-75 transition duration-300 pointer-events-none" />
              
              <div className="relative backdrop-blur-2xl bg-indigo-950/20 border border-indigo-500/15 rounded-2xl p-1.5 sm:p-2 shadow-2xl transition-all group-focus-within:border-indigo-400 group-focus-within:ring-4 group-focus-within:ring-indigo-500/20 group-focus-within:shadow-[0_0_35px_rgba(99,102,241,0.25)]">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSearch();
                  }}
                  className="flex items-center gap-1.5 sm:gap-2"
                >
                  <div className="pl-2.5 sm:pl-3 text-indigo-400 flex items-center justify-center shrink-0">
                    <Search className="w-5 h-5 group-focus-within:text-indigo-300 transition-colors" />
                  </div>

                  <input
                    type="text"
                    value={searchInputValue}
                    onChange={(e) => setSearchInputValue(e.target.value)}
                    placeholder="Typ een infinitief (bv. wonen, reizen, opbellen)..."
                    className="flex-1 bg-transparent border-0 text-slate-100 placeholder:text-slate-500 font-medium text-sm sm:text-base focus:outline-none px-1 py-2"
                  />

                  {/* Micro-actions within search bar */}
                  {searchInputValue && (
                    <button
                      type="button"
                      onClick={() => setSearchInputValue('')}
                      aria-label="Wissen"
                      className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg transition-colors active:scale-95"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handlePronounce(searchInputValue)}
                    title="Beluister uitspraak"
                    aria-label="Beluister uitspraak"
                    className="p-2 text-indigo-400 hover:text-indigo-200 hover:bg-indigo-900/40 rounded-xl transition-colors hidden sm:flex items-center justify-center active:scale-95"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('scanner')}
                    title="Scan met Camera"
                    aria-label="Scan met Camera"
                    className="p-2 text-slate-400 hover:text-indigo-300 hover:bg-indigo-900/40 rounded-xl transition-colors hidden sm:flex items-center justify-center active:scale-95"
                  >
                    <Camera className="w-4 h-4" />
                  </button>

                  <button
                    type="submit"
                    className="px-4 sm:px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-indigo-600 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold text-xs sm:text-sm shadow-lg shadow-indigo-600/30 border border-indigo-400/30 active:scale-95 transition-all shrink-0"
                  >
                    Zoek
                  </button>
                </form>
              </div>
            </div>

            {/* Neon Emerald Badges for 't Kofschip Rules */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold backdrop-blur-2xl bg-emerald-950/30 border border-emerald-500/30 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.18)] transition-all">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                </span>
                <span>'t Kofschip:</span>
                <span className="font-mono tracking-wider font-extrabold text-emerald-200">
                  T · K · F · S · CH · P · X
                </span>
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-2xl bg-indigo-950/20 border border-indigo-500/15 text-indigo-300 shadow-sm">
                <span>In kofschip?</span>
                <span className="font-bold text-slate-100">→ -te / -ten</span>
                <span className="text-slate-500">•</span>
                <span>Anders:</span>
                <span className="font-bold text-slate-100">→ -de / -den</span>
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-2xl bg-rose-950/25 border border-rose-500/25 text-rose-300 shadow-sm">
                <span>⚠️ Valkuil: v→f (leven) &amp; z→s (reizen)</span>
                <span className="font-bold text-rose-200">= altijd -de</span>
              </div>
            </div>

            {/* Floating Micro-Action Chips */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-400 px-1">
                <span>Snelle voorbeelden &amp; acties:</span>
                <span className="text-indigo-400 font-mono text-[10px]">Klik om te testen</span>
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                {/* Camera shortcut chip */}
                <button
                  onClick={() => setActiveTab('scanner')}
                  className="whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-medium backdrop-blur-2xl bg-indigo-950/20 hover:bg-indigo-900/40 text-indigo-300 border border-indigo-500/15 shadow-sm transition-all flex items-center gap-1.5 shrink-0 active:scale-95"
                >
                  <Camera className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Camera Scanner</span>
                </button>

                {/* Mijn fouten shortcut chip */}
                <button
                  onClick={() => setActiveTab('fouten')}
                  className="whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-medium backdrop-blur-2xl bg-indigo-950/20 hover:bg-indigo-900/40 text-indigo-300 border border-indigo-500/15 shadow-sm transition-all flex items-center gap-1.5 shrink-0 active:scale-95"
                >
                  <Brain className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Mijn Fouten</span>
                </button>

                {/* Example verbs chips */}
                {COMMON_EXAMPLE_VERBS.map((item) => {
                  const isActive = activeVerbForChecker === item.verb;
                  return (
                    <button
                      key={item.verb}
                      onClick={() => handleSearch(item.verb)}
                      className={`whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-medium border transition-all shrink-0 active:scale-95 ${
                        isActive
                          ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white border-indigo-400/80 shadow-lg shadow-indigo-600/35 font-semibold'
                          : 'backdrop-blur-2xl bg-indigo-950/20 text-slate-300 border-indigo-500/15 hover:bg-indigo-900/40 hover:text-slate-100 shadow-sm'
                      }`}
                    >
                      <span>{item.verb}</span>
                      <span className="ml-1 opacity-60 text-[10px]">({item.tag})</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Save notification toast if triggered */}
            {saveToast && (
              <div className="p-3.5 backdrop-blur-2xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-200 text-xs rounded-2xl flex items-center justify-between shadow-xl animate-fadeIn">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="font-semibold">{saveToast}</span>
                </div>
                <button
                  onClick={() => setActiveTab('fouten')}
                  className="underline text-emerald-300 hover:text-emerald-100 text-[11px] font-semibold"
                >
                  Bekijk lijst →
                </button>
              </div>
            )}
          </section>
        )}

        {/* 2. Glassmorphism & Translucent Frosted Glass Tab Content */}
        {activeTab === 'checker' && (
          <div className="space-y-4">
            <VerbChecker
              key={activeVerbForChecker}
              initialVerb={activeVerbForChecker}
              onSaveToMijnFouten={handleSaveToMijnFouten}
              onOpenPaywall={() => setIsPaywallOpen(true)}
              hideSearch={true}
            />
          </div>
        )}

        {activeTab === 'scanner' && (
          <div className="space-y-4">
            <VerbScanner
              isPremium={isPremium}
              onOpenPaywall={() => setIsPaywallOpen(true)}
              onSaveToMijnFouten={handleSaveToMijnFouten}
              onInspectVerb={(verb) => {
                setActiveVerbForChecker(verb);
                setSearchInputValue(verb);
                setActiveTab('checker');
              }}
            />
          </div>
        )}

        {activeTab === 'fouten' && (
          <div className="space-y-4">
            <MijnFouten
              onSelectVerbForInspection={handleSelectVerbFromFouten}
              onOpenPaywall={() => setIsPaywallOpen(true)}
            />
          </div>
        )}

        {/* Free-tier Mobile Banner Ad Container in Neo-Glass Container */}
        <BannerAdContainer
          isPremium={isPremium}
          onOpenPaywall={() => setIsPaywallOpen(true)}
          className="mt-6"
        />
      </main>

      {/* 4. Floating Bottom Frosted Navigation Bar */}
      <nav
        aria-label="Hoofdnavigatie"
        className="fixed bottom-5 left-4 right-4 z-40 max-w-md mx-auto safe-area-bottom pointer-events-auto"
      >
        <div className="backdrop-blur-2xl bg-[#0B0F19]/85 border border-indigo-500/20 shadow-[0_20px_50px_rgba(0,0,0,0.7)] rounded-2xl p-1.5 flex items-center gap-1.5">
          <button
            onClick={() => setActiveTab('checker')}
            className={`flex items-center justify-center gap-2 flex-1 py-2.5 px-3 rounded-xl text-xs transition-all duration-200 active:scale-95 ${
              activeTab === 'checker'
                ? 'bg-gradient-to-r from-indigo-600 via-indigo-500 to-indigo-600 text-white font-bold shadow-lg shadow-indigo-500/30 border border-indigo-400/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-indigo-950/30 font-medium'
            }`}
          >
            <Search className="w-4 h-4" />
            <span className={activeTab === 'checker' ? 'inline' : 'hidden sm:inline text-xs'}>
              Checker
            </span>
          </button>

          <button
            onClick={() => setActiveTab('scanner')}
            className={`flex items-center justify-center gap-2 flex-1 py-2.5 px-3 rounded-xl text-xs transition-all duration-200 active:scale-95 ${
              activeTab === 'scanner'
                ? 'bg-gradient-to-r from-indigo-600 via-indigo-500 to-indigo-600 text-white font-bold shadow-lg shadow-indigo-500/30 border border-indigo-400/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-indigo-950/30 font-medium'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span className={activeTab === 'scanner' ? 'inline' : 'hidden sm:inline text-xs'}>
              Scanner
            </span>
          </button>

          <button
            onClick={() => setActiveTab('fouten')}
            className={`flex items-center justify-center gap-2 flex-1 py-2.5 px-3 rounded-xl text-xs transition-all duration-200 active:scale-95 ${
              activeTab === 'fouten'
                ? 'bg-gradient-to-r from-indigo-600 via-indigo-500 to-indigo-600 text-white font-bold shadow-lg shadow-indigo-500/30 border border-indigo-400/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-indigo-950/30 font-medium'
            }`}
          >
            <Brain className="w-4 h-4" />
            <span className={activeTab === 'fouten' ? 'inline' : 'hidden sm:inline text-xs'}>
              Mijn Fouten
            </span>
          </button>
        </div>
      </nav>

      {/* Lifetime Pro Upgrade Modal */}
      <PaywallModal
        isOpen={isPaywallOpen}
        onClose={() => setIsPaywallOpen(false)}
        onUpgradeSuccess={() => {
          setIsPremium(true);
          setIsPaywallOpen(false);
        }}
      />
    </div>
  );
}
