import { useState, useEffect, useRef } from 'react';
import { VerbChecker } from '../components/VerbChecker';
import { KofschipLogo } from '../components/KofschipLogo';
import { AdBannerComponent } from '../components/AdBannerComponent';
import { CookieConsentBanner } from '../components/CookieConsentBanner';
import { LegalModal, type LegalModalType } from '../components/LegalModal';
import { InterstitialAdModal } from '../components/InterstitialAdModal';
import { Search, Sun, Moon, Volume2, X, Sparkles } from 'lucide-react';
import { isLocalPremium } from '../lib/purchases';

/** Her kaç aramada bir interstitial reklam gösterilsin */
const INTERSTITIAL_EVERY_N_SEARCHES = 3;

// Stripe Payment Link — vervang door uw eigen Stripe Payment Link URL
const STRIPE_PAYMENT_LINK = 'https://buy.stripe.com/kofschip_lifetime_1499';

const COMMON_EXAMPLE_VERBS = [
  { verb: 'werken',     tag: "-te" },
  { verb: 'leven',      tag: 'v→f' },
  { verb: 'reizen',     tag: 'z→s' },
  { verb: 'opbellen',   tag: 'scheidbaar' },
  { verb: 'lopen',      tag: 'hebben/zijn' },
  { verb: 'nemen',      tag: 'onregelmatig' },
  { verb: 'zijn',       tag: 'onregelmatig' },
  { verb: 'antwoorden', tag: '-de' },
];

export function HomePage() {
  const [activeVerbForChecker, setActiveVerbForChecker] = useState<string>('leven');
  const [searchInputValue, setSearchInputValue] = useState<string>('leven');
  const [legalModal, setLegalModal] = useState<LegalModalType>(null);
  const [isPremium, setIsPremium] = useState<boolean>(false);

  // ── Interstitial reklam sayacı ──
  // useRef: sayacı her render'da sıfırlamadan korur
  const searchCountRef = useRef<number>(0);
  const [showInterstitial, setShowInterstitial] = useState<boolean>(false);

  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('kofschip_theme');
      if (saved) return saved === 'dark';
      return true;
    }
    return true;
  });

  // Premium status bijhouden
  useEffect(() => {
    setIsPremium(isLocalPremium());
    const handlePremiumChange = (e: Event) => {
      const custom = e as CustomEvent<{ isPremium: boolean }>;
      if (custom.detail?.isPremium) setIsPremium(true);
    };
    window.addEventListener('kofschip_premium_changed', handlePremiumChange);
    return () => window.removeEventListener('kofschip_premium_changed', handlePremiumChange);
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('kofschip_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('kofschip_theme', 'light');
    }
  }, [isDarkMode]);

  const handleSearch = (verbToSearch?: string) => {
    const target = (verbToSearch ?? searchInputValue).trim().toLowerCase();
    if (!target) return;
    setActiveVerbForChecker(target);
    setSearchInputValue(target);

    // ── Interstitial sayaç mantığı ──
    // adFree (isPremium) ise hiç sayma
    if (!isPremium) {
      searchCountRef.current += 1;
      if (searchCountRef.current % INTERSTITIAL_EVERY_N_SEARCHES === 0) {
        setShowInterstitial(true);
      }
    }
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

  const headerBg = isDarkMode
    ? 'bg-[#0B0F19]/80 border-white/10'
    : 'bg-white/90 border-slate-200 shadow-xs';

  const iconBtn = isDarkMode
    ? 'text-[#E2E8F0] hover:bg-white/10 border-white/10 bg-[#151D2A]/80'
    : 'text-[#0F172A] hover:bg-slate-100 border-slate-200 bg-white shadow-xs';

  return (
    <div
      className={`relative min-h-screen flex flex-col overflow-x-hidden selection:bg-blue-500/20 selection:text-blue-700 transition-colors duration-200 ${
        isDarkMode
          ? 'bg-[#0B0F19] text-[#E2E8F0]'
          : 'bg-[#F8FAFC] text-[#0F172A]'
      }`}
    >
      {/* ── Header ── */}
      <header
        className={`sticky top-0 z-40 backdrop-blur-2xl border-b safe-area-top transition-colors duration-200 ${headerBg}`}
      >
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between gap-2">
          {/* Logo */}
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
            {/* "Verwijder advertenties" knop — alleen zichtbaar als niet-premium */}
            {!isPremium && (
              <a
                href={STRIPE_PAYMENT_LINK}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Verwijder advertenties voor €14,99 eenmalig"
                className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all active:scale-95 ${
                  isDarkMode
                    ? 'bg-gradient-to-r from-indigo-950/60 to-blue-950/60 border-blue-500/25 text-blue-300 hover:border-blue-400/40'
                    : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 text-blue-700 hover:border-blue-400 shadow-xs'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Verwijder advertenties (€14,99 eenmalig)</span>
              </a>
            )}

            {/* Volume Toggle */}
            <button
              onClick={() => handlePronounce(activeVerbForChecker)}
              title={`Beluister '${activeVerbForChecker}'`}
              aria-label={`Beluister '${activeVerbForChecker}'`}
              className={`p-2 rounded-xl border transition-all active:scale-95 ${iconBtn}`}
            >
              <Volume2 className="w-4 h-4" />
            </button>

            {/* Theme Toggle */}
            <button
              onClick={() => setIsDarkMode((prev) => !prev)}
              title="Wissel thema"
              aria-label="Wissel thema"
              className={`p-2 rounded-xl border transition-all active:scale-95 ${iconBtn}`}
            >
              {isDarkMode ? (
                <Sun className="w-4 h-4 text-[#F59E0B]" />
              ) : (
                <Moon className="w-4 h-4 text-[#0F172A]" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
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
              placeholder="Typ een werkwoord, bijv. lopen, liep, nemen..."
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
        </section>

        {/* ── Section 2: Werkwoord Vervoegingen Kaart ── */}
        <section aria-label="Werkwoord Vervoegingen">
          <VerbChecker
            key={activeVerbForChecker}
            initialVerb={activeVerbForChecker}
            hideSearch={true}
            isDarkMode={isDarkMode}
          />
        </section>

        {/* ── Section 3: Reclame Banner (TEST: !isPremium kontrolü geçici devre dışı) ── */}
        <section aria-label="Pro upgrade aanbieding">
          <AdBannerComponent
            isDarkMode={isDarkMode}
            stripePaymentLink={STRIPE_PAYMENT_LINK}
          />
        </section>

        {/* ── Section 4: "Verwijder advertenties" knop (mobiel, onder kaart) ── */}
        {!isPremium && (
          <section className="sm:hidden" aria-label="Verwijder advertenties">
            <a
              href={STRIPE_PAYMENT_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className={`w-full flex items-center justify-center gap-2 py-3 px-5 rounded-2xl border font-bold text-sm transition-all active:scale-95 ${
                isDarkMode
                  ? 'bg-gradient-to-r from-indigo-950/60 to-blue-950/60 border-blue-500/25 text-blue-300 hover:border-blue-400/40'
                  : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 text-blue-700 shadow-xs'
              }`}
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              Verwijder advertenties (€14,99 eenmalig)
            </a>
          </section>
        )}
      </main>

      {/* ── Footer ── */}
      <footer
        className={`relative z-10 border-t py-6 safe-area-bottom transition-colors ${
          isDarkMode ? 'border-white/10' : 'border-slate-200'
        }`}
      >
        <div className="max-w-2xl mx-auto px-4 flex flex-col items-center gap-3">
          {/* Footer links */}
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            <button
              onClick={() => setLegalModal('privacy')}
              className={`text-xs font-medium underline-offset-2 hover:underline transition-colors ${
                isDarkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Privacybeleid
            </button>
            <span className={`text-xs ${isDarkMode ? 'text-slate-700' : 'text-slate-300'}`}>·</span>
            <button
              onClick={() => setLegalModal('voorwaarden')}
              className={`text-xs font-medium underline-offset-2 hover:underline transition-colors ${
                isDarkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Voorwaarden
            </button>
            <span className={`text-xs ${isDarkMode ? 'text-slate-700' : 'text-slate-300'}`}>·</span>
            <button
              onClick={() => setLegalModal('herstel')}
              className={`text-xs font-medium underline-offset-2 hover:underline transition-colors ${
                isDarkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Herstel Aankoop
            </button>
          </div>

          {/* Copyright */}
          <p className={`text-[11px] text-center ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}>
            &copy; {new Date().getFullYear()} Kofschip · Meester in Nederlandse Werkwoorden
          </p>
        </div>
      </footer>

      {/* ── Cookie Consent Banner (AB/GDPR) ── */}
      <CookieConsentBanner
        isDarkMode={isDarkMode}
        onOpenPrivacy={() => setLegalModal('privacy')}
      />

      {/* ── Legal Modal (Privacy / Voorwaarden / Herstel) ── */}
      <LegalModal
        type={legalModal}
        onClose={() => setLegalModal(null)}
        isDarkMode={isDarkMode}
      />

      {/* ── Interstitial Reklam Modalı (her 3 aramada bir, adFree değilse) ── */}
      <InterstitialAdModal
        isOpen={showInterstitial}
        onClose={() => setShowInterstitial(false)}
        isDarkMode={isDarkMode}
        stripePaymentLink={STRIPE_PAYMENT_LINK}
      />
    </div>
  );
}
