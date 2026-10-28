import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getPremiumStatus, isLocalPremium, onPremiumStatusChange } from '../lib/purchases';
import { VerbChecker } from '../components/VerbChecker';
import { MijnFouten, type SavedWord } from '../components/MijnFouten';
import { PaywallModal, BannerAdContainer } from '../components/PaywallModal';
import { KofschipLogo } from '../components/KofschipLogo';
import {
  Search,
  Sun,
  Moon,
  Volume2,
  Sparkles,
  Check,
  X,
} from 'lucide-react';

const COMMON_EXAMPLE_VERBS = [
  { verb: 'werken', tag: "-te" },
  { verb: 'leven', tag: 'v→f' },
  { verb: 'reizen', tag: 'z→s' },
  { verb: 'opbellen', tag: 'scheidbaar' },
  { verb: 'lopen', tag: 'zijn' },
  { verb: 'nemen', tag: 'onreg.' },
  { verb: 'zijn', tag: 'onreg.' },
  { verb: 'antwoorden', tag: '-d' },
];

export function HomePage() {
  const [activeVerbForChecker, setActiveVerbForChecker] = useState<string>('leven');
  const [searchInputValue, setSearchInputValue] = useState<string>('leven');
  const [isPaywallOpen, setIsPaywallOpen] = useState<boolean>(false);
  const [isPremium, setIsPremium] = useState<boolean>(() => isLocalPremium());
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [foutenVersion, setFoutenVersion] = useState<number>(0);

  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('kofschip_theme');
      if (saved) return saved === 'dark';
      return true;
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

  useEffect(() => {
    getPremiumStatus().then((premium) => {
      setIsPremium(premium);
    });

    const unsubscribe = onPremiumStatusChange((premium) => {
      setIsPremium(premium);
    });

    return () => unsubscribe();
  }, []);

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

      setFoutenVersion((v) => v + 1);
      setSaveToast(`'${targetVerb}' toegevoegd aan Mijn Fouten!`);
      setTimeout(() => setSaveToast(null), 3000);
    } catch {
      setFoutenVersion((v) => v + 1);
      setSaveToast(`'${targetVerb}' lokaal opgeslagen!`);
      setTimeout(() => setSaveToast(null), 3000);
    }
  };

  const handleSearch = (verbToSearch?: string) => {
    const target = (verbToSearch ?? searchInputValue).trim().toLowerCase();
    if (!target) return;
    setActiveVerbForChecker(target);
    setSearchInputValue(target);
    setSaveToast(null);
  };

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

  const handleSelectVerbFromFouten = (verb: string) => {
    setActiveVerbForChecker(verb);
    setSearchInputValue(verb);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className={`relative min-h-screen flex flex-col overflow-x-hidden selection:bg-blue-500/20 selection:text-blue-700 transition-colors duration-200 ${
      isDarkMode
        ? 'bg-[#0B0F19] text-[#E2E8F0]'
        : 'bg-[#F8FAFC] text-[#0F172A]'
    }`}>

      {/* Header: Logo, Volume Toggle, Theme Toggle, Prominent PRO button */}
      <header className={`sticky top-0 z-40 backdrop-blur-2xl border-b safe-area-top transition-colors duration-200 ${
        isDarkMode
          ? 'bg-[#0B0F19]/80 border-white/10'
          : 'bg-white/90 border-slate-200 shadow-xs'
      }`}>
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <button
            onClick={() => {
              setSearchInputValue('leven');
              setActiveVerbForChecker('leven');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="flex items-center text-left focus:outline-none"
            aria-label="Ga naar startpagina"
          >
            <KofschipLogo size="md" glow={false} showSubtitle={false} isDarkMode={isDarkMode} />
          </button>

          <div className="flex items-center gap-2">
            {/* Volume Toggle */}
            <button
              onClick={() => handlePronounce(activeVerbForChecker)}
              title={`Beluister '${activeVerbForChecker}'`}
              aria-label={`Beluister '${activeVerbForChecker}'`}
              className={`p-2 rounded-xl border transition-all active:scale-95 ${
                isDarkMode
                  ? 'text-[#E2E8F0] hover:bg-white/10 border-white/10 bg-[#151D2A]/80'
                  : 'text-[#0F172A] hover:bg-slate-100 border-slate-200 bg-white shadow-xs'
              }`}
            >
              <Volume2 className="w-4 h-4" />
            </button>

            {/* Theme Toggle */}
            <button
              onClick={() => setIsDarkMode((prev) => !prev)}
              title="Wissel thema"
              aria-label="Wissel thema"
              className={`p-2 rounded-xl border transition-all active:scale-95 ${
                isDarkMode
                  ? 'text-[#E2E8F0] hover:bg-white/10 border-white/10 bg-[#151D2A]/80'
                  : 'text-[#0F172A] hover:bg-slate-100 border-slate-200 bg-white shadow-xs'
              }`}
            >
              {isDarkMode ? (
                <Sun className="w-4 h-4 text-[#F59E0B]" />
              ) : (
                <Moon className="w-4 h-4 text-[#0F172A]" />
              )}
            </button>

            {/* Prominent PRO button (opens PaywallModal) */}
            <button
              onClick={() => setIsPaywallOpen(true)}
              aria-label="Open Pro upgrade modal"
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 ${
                isPremium
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-emerald-500/20'
                  : 'bg-gradient-to-r from-[#3B82F6] via-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-500/25 ring-1 ring-white/20'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
              <span>{isPremium ? 'PRO ✓' : 'PRO'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Single-Page Content: Hero Search + Live Verb Results + Saved Words / History */}
      <main className="relative z-10 flex-1 max-w-2xl mx-auto w-full px-4 pt-5 pb-12 space-y-6">

        {/* ── Section 1: Hero Search Bar ── */}
        <section className="space-y-3">
          <form
            onSubmit={(e) => { e.preventDefault(); handleSearch(); }}
            className={`flex items-center gap-2 border rounded-2xl px-4 py-3 transition-all ${
              isDarkMode
                ? 'bg-[#151D2A]/80 border-white/10 backdrop-blur-xl focus-within:border-[#3B82F6]/60 focus-within:ring-2 focus-within:ring-blue-500/20'
                : 'bg-white border-slate-200 focus-within:border-[#3B82F6] focus-within:ring-2 focus-within:ring-blue-500/20 shadow-xs'
            }`}
          >
            <Search className={`w-4 h-4 shrink-0 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} />
            <input
              type="text"
              value={searchInputValue}
              onChange={(e) => setSearchInputValue(e.target.value)}
              placeholder="Zoek een infinitief… (bv. wonen, reizen, nemen)"
              className={`flex-1 bg-transparent border-0 text-sm font-medium focus:outline-none ${
                isDarkMode
                  ? 'text-[#E2E8F0] placeholder:text-slate-500'
                  : 'text-[#0F172A] placeholder:text-slate-400'
              }`}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
            {searchInputValue && (
              <button
                type="button"
                onClick={() => setSearchInputValue('')}
                aria-label="Wissen"
                className={`transition-colors p-1 ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-800'}`}
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => handlePronounce(searchInputValue)}
              aria-label="Beluister"
              className={`transition-colors p-1 hidden sm:block ${isDarkMode ? 'text-slate-400 hover:text-[#3B82F6]' : 'text-slate-500 hover:text-[#3B82F6]'}`}
            >
              <Volume2 className="w-4 h-4" />
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-[#3B82F6] hover:bg-blue-600 text-white text-xs font-bold transition-all shrink-0 shadow-xs active:scale-95"
            >
              Zoek
            </button>
          </form>

          {/* Quick example verb chips */}
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
            {COMMON_EXAMPLE_VERBS.map((item) => {
              const isActive = activeVerbForChecker === item.verb;
              return (
                <button
                  key={item.verb}
                  onClick={() => handleSearch(item.verb)}
                  className={`whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all shrink-0 active:scale-95 ${
                    isActive
                      ? 'bg-[#3B82F6] text-white border-[#3B82F6] shadow-xs'
                      : isDarkMode
                        ? 'bg-[#151D2A]/80 text-[#E2E8F0] border-white/10 hover:bg-white/10'
                        : 'bg-white text-[#0F172A] border-slate-200 hover:bg-slate-50 shadow-xs'
                  }`}
                >
                  {item.verb}
                  <span className={`ml-1 text-[10px] ${isActive ? 'text-blue-100' : 'text-slate-400'}`}>
                    ({item.tag})
                  </span>
                </button>
              );
            })}
          </div>

          {/* Save notification toast */}
          {saveToast && (
            <div className={`p-3 border text-xs rounded-xl flex items-center justify-between ${
              isDarkMode
                ? 'bg-[#10B981]/15 border-[#10B981]/30 text-emerald-200'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}>
              <div className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-[#10B981] shrink-0" />
                <span className="font-semibold">{saveToast}</span>
              </div>
              <button
                onClick={() => {
                  const elem = document.getElementById('saved-words-section');
                  elem?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="text-[#10B981] hover:underline text-[11px] font-bold"
              >
                Bekijk ↓
              </button>
            </div>
          )}
        </section>

        {/* ── Section 2: Live Verb Results ── */}
        <section aria-label="Werkwoord Vervoegingen">
          <VerbChecker
            key={activeVerbForChecker}
            initialVerb={activeVerbForChecker}
            onSaveToMijnFouten={handleSaveToMijnFouten}
            onOpenPaywall={() => setIsPaywallOpen(true)}
            hideSearch={true}
            isDarkMode={isDarkMode}
          />
        </section>

        {/* ── Section 3: Saved Words / History section below ── */}
        <section id="saved-words-section" aria-label="Opgeslagen Woorden en Geschiedenis" className="pt-2">
          <MijnFouten
            key={foutenVersion}
            onSelectVerbForInspection={handleSelectVerbFromFouten}
            onOpenPaywall={() => setIsPaywallOpen(true)}
            isDarkMode={isDarkMode}
          />
        </section>

        {/* Banner Ad / Pro promotion */}
        <BannerAdContainer
          isPremium={isPremium}
          onOpenPaywall={() => setIsPaywallOpen(true)}
          isDarkMode={isDarkMode}
          className="mt-6"
        />
      </main>

      {/* Paywall Upgrade Modal */}
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
