import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getPremiumStatus, isLocalPremium, onPremiumStatusChange } from '../lib/purchases';
import { VerbChecker } from '../components/VerbChecker';
import { VerbScanner } from '../components/VerbScanner';
import { MijnFouten, type SavedWord } from '../components/MijnFouten';
import { PaywallModal, BannerAdContainer } from '../components/PaywallModal';
import { KofschipLogo } from '../components/KofschipLogo';
import {
  Search,
  BookOpen,
  CheckCircle2,
  Camera,
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
  { verb: 'zijn', tag: 'onreg.' },
  { verb: 'antwoorden', tag: '-d' },
];

export function HomePage() {
  const [activeTab, setActiveTab] = useState<'checker' | 'scanner' | 'fouten'>('checker');
  const [activeVerbForChecker, setActiveVerbForChecker] = useState<string>('leven');
  const [searchInputValue, setSearchInputValue] = useState<string>('leven');
  const [isPaywallOpen, setIsPaywallOpen] = useState<boolean>(false);
  const [isPremium, setIsPremium] = useState<boolean>(() => isLocalPremium());
  const [saveToast, setSaveToast] = useState<string | null>(null);

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

      setSaveToast(`'${targetVerb}' toegevoegd aan Mijn Fouten!`);
      setTimeout(() => setSaveToast(null), 3000);
    } catch {
      setSaveToast(`'${targetVerb}' lokaal opgeslagen!`);
      setTimeout(() => setSaveToast(null), 3000);
    }
  };

  const handleSearch = (verbToSearch?: string) => {
    const target = (verbToSearch ?? searchInputValue).trim().toLowerCase();
    if (!target) return;
    setActiveVerbForChecker(target);
    setSearchInputValue(target);
    setActiveTab('checker');
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
    setActiveTab('checker');
  };

  return (
    <div className="relative min-h-screen bg-[#0B0F19] text-slate-100 flex flex-col overflow-x-hidden selection:bg-indigo-500/30 selection:text-indigo-200">

      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-2xl bg-[#0B0F19]/80 border-b border-white/8 safe-area-top">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <button
            onClick={() => {
              setActiveTab('checker');
              setSearchInputValue('leven');
              setActiveVerbForChecker('leven');
            }}
            className="flex items-center text-left focus:outline-none"
            aria-label="Ga naar startpagina"
          >
            <KofschipLogo size="md" glow={false} showSubtitle={false} />
          </button>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handlePronounce(activeVerbForChecker)}
              title={`Beluister '${activeVerbForChecker}'`}
              aria-label={`Beluister '${activeVerbForChecker}'`}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-white/8 transition-colors"
            >
              <Volume2 className="w-4 h-4" />
            </button>

            <button
              onClick={() => setIsDarkMode((prev) => !prev)}
              title="Wissel thema"
              aria-label="Wissel thema"
              className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-white/8 transition-colors"
            >
              {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-300" />}
            </button>

            {isPremium ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-emerald-300 bg-emerald-950/40 border border-emerald-500/30">
                <CheckCircle2 className="w-3.5 h-3.5" />
                PRO
              </span>
            ) : (
              <button
                onClick={() => setIsPaywallOpen(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors"
              >
                <Sparkles className="w-3 h-3 text-amber-300" />
                Pro
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 flex-1 max-w-2xl mx-auto w-full px-4 pt-5 pb-28 space-y-4">

        {/* Search Bar — shown on checker tab */}
        {activeTab === 'checker' && (
          <section className="space-y-3">
            {/* Search input */}
            <form
              onSubmit={(e) => { e.preventDefault(); handleSearch(); }}
              className="flex items-center gap-2 bg-white/6 border border-white/10 rounded-2xl px-4 py-3 focus-within:border-indigo-500/50 focus-within:bg-white/8 transition-all"
            >
              <Search className="w-4 h-4 text-slate-500 shrink-0" />
              <input
                type="text"
                value={searchInputValue}
                onChange={(e) => setSearchInputValue(e.target.value)}
                placeholder="Zoek een infinitief… (bv. wonen, reizen)"
                className="flex-1 bg-transparent border-0 text-slate-100 placeholder:text-slate-500 text-sm font-medium focus:outline-none"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
              {searchInputValue && (
                <button
                  type="button"
                  onClick={() => setSearchInputValue('')}
                  aria-label="Wissen"
                  className="text-slate-500 hover:text-slate-300 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => handlePronounce(searchInputValue)}
                aria-label="Beluister"
                className="text-slate-500 hover:text-indigo-300 transition-colors hidden sm:block"
              >
                <Volume2 className="w-4 h-4" />
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-colors shrink-0"
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
                    className={`whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-medium border transition-all shrink-0 active:scale-95 ${
                      isActive
                        ? 'bg-indigo-600 text-white border-indigo-500'
                        : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10 hover:text-slate-200'
                    }`}
                  >
                    {item.verb}
                    <span className="ml-1 opacity-50 text-[10px]">({item.tag})</span>
                  </button>
                );
              })}
            </div>

            {/* Save toast */}
            {saveToast && (
              <div className="p-3 bg-emerald-950/40 border border-emerald-500/25 text-emerald-200 text-xs rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="font-medium">{saveToast}</span>
                </div>
                <button
                  onClick={() => setActiveTab('fouten')}
                  className="text-emerald-300 hover:text-emerald-100 text-[11px] font-semibold underline"
                >
                  Bekijk →
                </button>
              </div>
            )}
          </section>
        )}

        {/* Tab content */}
        {activeTab === 'checker' && (
          <VerbChecker
            key={activeVerbForChecker}
            initialVerb={activeVerbForChecker}
            onSaveToMijnFouten={handleSaveToMijnFouten}
            onOpenPaywall={() => setIsPaywallOpen(true)}
            hideSearch={true}
          />
        )}

        {activeTab === 'scanner' && (
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
        )}

        {activeTab === 'fouten' && (
          <MijnFouten
            onSelectVerbForInspection={handleSelectVerbFromFouten}
            onOpenPaywall={() => setIsPaywallOpen(true)}
          />
        )}

        <BannerAdContainer
          isPremium={isPremium}
          onOpenPaywall={() => setIsPaywallOpen(true)}
          className="mt-4"
        />
      </main>

      {/* Bottom Nav */}
      <nav
        aria-label="Hoofdnavigatie"
        className="fixed bottom-4 left-4 right-4 z-40 max-w-md mx-auto safe-area-bottom"
      >
        <div className="bg-[#13172A]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-1.5 flex items-center gap-1">
          <button
            onClick={() => setActiveTab('checker')}
            className={`flex items-center justify-center gap-1.5 flex-1 py-2.5 px-3 rounded-xl text-xs transition-all active:scale-95 ${
              activeTab === 'checker'
                ? 'bg-indigo-600 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200 font-medium'
            }`}
          >
            <Search className="w-4 h-4" />
            <span>Checker</span>
          </button>

          <button
            onClick={() => setActiveTab('scanner')}
            className={`flex items-center justify-center gap-1.5 flex-1 py-2.5 px-3 rounded-xl text-xs transition-all active:scale-95 ${
              activeTab === 'scanner'
                ? 'bg-indigo-600 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200 font-medium'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>Scanner</span>
          </button>

          <button
            onClick={() => setActiveTab('fouten')}
            className={`flex items-center justify-center gap-1.5 flex-1 py-2.5 px-3 rounded-xl text-xs transition-all active:scale-95 ${
              activeTab === 'fouten'
                ? 'bg-indigo-600 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200 font-medium'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Mijn Fouten</span>
          </button>
        </div>
      </nav>

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
