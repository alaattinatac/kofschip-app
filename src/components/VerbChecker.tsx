import { useState, useMemo } from 'react';
import {
  conjugate,
  KOFSCHIP_CONSONANTS,
  type Person,
  type FullConjugation,
} from '@execution/verb_engine';
import {
  Search,
  AlertCircle,
  BookmarkPlus,
  Sparkles,
  Volume2,
  Info,
  Check,
} from 'lucide-react';

export interface VerbCheckerProps {
  initialVerb?: string;
  onSaveToMijnFouten?: (infinitive: string) => Promise<boolean | void> | boolean | void;
  onOpenPaywall?: () => void;
  hideSearch?: boolean;
}

const COMMON_EXAMPLE_VERBS = [
  { verb: 'werken', tag: "'t Kofschip (-te)" },
  { verb: 'leven', tag: 'v → f trap (-de)' },
  { verb: 'verhuizen', tag: 'z → s trap (-de)' },
  { verb: 'opbellen', tag: 'Scheidbaar' },
  { verb: 'lopen', tag: 'Hebben / Zijn' },
  { verb: 'zijn', tag: 'Onregelmatig' },
  { verb: 'antwoorden', tag: 'Stam op -d' },
];

const PERSON_LABELS: Record<Person, { label: string; pronoun: string }> = {
  '1s': { label: 'ik', pronoun: 'ik' },
  '2s': { label: 'jij / je', pronoun: 'jij' },
  '2s_formal': { label: 'u', pronoun: 'u' },
  '3s': { label: 'hij / zij / het', pronoun: 'hij' },
  '1p': { label: 'wij / we', pronoun: 'wij' },
  '2p': { label: 'jullie', pronoun: 'jullie' },
  '3p': { label: 'zij / ze', pronoun: 'zij' },
};

export function VerbChecker({
  initialVerb = 'leven',
  onSaveToMijnFouten,
  hideSearch = false,
}: VerbCheckerProps) {
  const [searchTerm, setSearchTerm] = useState<string>(initialVerb);
  const [activeVerb, setActiveVerb] = useState<string>(initialVerb);
  const [savedNotification, setSavedNotification] = useState<string | null>(null);

  // Active conjugation data
  const conjugation: FullConjugation | null = useMemo(() => {
    const trimmed = activeVerb.trim().toLowerCase();
    if (!trimmed) return null;
    try {
      return conjugate(trimmed);
    } catch {
      return null;
    }
  }, [activeVerb]);

  // Handle Search Submission
  const handleSearch = (verbToSearch?: string) => {
    const target = (verbToSearch ?? searchTerm).trim().toLowerCase();
    if (!target) return;
    setActiveVerb(target);
    setSearchTerm(target);
    setSavedNotification(null);
  };

  // Speak verb pronunciation using browser SpeechSynthesis
  const handlePronounce = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'nl-NL';
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  };

  // Save to Mijn Fouten
  const handleSaveWord = async () => {
    if (!activeVerb) return;
    if (onSaveToMijnFouten) {
      await onSaveToMijnFouten(activeVerb);
      setSavedNotification(`'${activeVerb}' opgeslagen in Mijn Fouten!`);
      setTimeout(() => setSavedNotification(null), 3000);
    } else {
      setSavedNotification(`'${activeVerb}' gemarkeerd voor herhaling!`);
      setTimeout(() => setSavedNotification(null), 3000);
    }
  };

  const stem = conjugation?.stem;
  const separable = conjugation?.separable;
  const isKofschipConsonant = stem ? KOFSCHIP_CONSONANTS.has(stem.originalEndConsonant) : false;

  return (
    <div className="w-full space-y-4 text-slate-100">
      {/* Header section (only shown if not hidden by parent) */}
      {!hideSearch && (
        <>
          <header className="flex items-start justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-2xl bg-indigo-950/40 text-indigo-300 border border-indigo-500/30 mb-1.5 shadow-sm">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                't Kofschip Engine
              </span>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-100">
                Werkwoord Checker
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                Directe vervoegingen & 't kofschip stamregels.
              </p>
            </div>

            <button
              onClick={handleSaveWord}
              aria-label="Opslaan in Mijn Fouten"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-indigo-500/20 backdrop-blur-xl bg-indigo-950/30 hover:bg-indigo-900/40 text-slate-200 shadow-sm transition-all active:scale-95 shrink-0"
            >
              <BookmarkPlus className="w-3.5 h-3.5 text-indigo-400" />
              <span>Opslaan</span>
            </button>
          </header>

          {/* Search Input Box */}
          <div className="relative group">
            <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-indigo-500/30 via-indigo-400/20 to-emerald-500/20 blur-sm opacity-50 group-focus-within:opacity-100 transition duration-300 pointer-events-none" />
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSearch();
              }}
              className="relative flex items-center backdrop-blur-2xl bg-indigo-950/20 border border-indigo-500/15 rounded-xl p-1 shadow-2xl transition-all focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-500/20"
            >
              <Search className="ml-3 w-4 h-4 text-indigo-400 shrink-0" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Typ een infinitief (bv. wonen, reizen, opbellen)..."
                className="w-full pl-3 pr-20 py-2 bg-transparent border-0 text-sm font-medium text-slate-100 placeholder:text-slate-500 focus:outline-none"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-gradient-to-r from-indigo-600 via-indigo-500 to-indigo-600 hover:from-indigo-500 hover:to-indigo-400 active:scale-95 text-white font-bold text-xs rounded-lg shadow-md shadow-indigo-600/30 border border-indigo-400/30 transition-all shrink-0"
              >
                Zoek
              </button>
            </form>
          </div>

          {/* Quick Select Verb Chips */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {COMMON_EXAMPLE_VERBS.map((item) => {
              const isActive = activeVerb === item.verb;
              return (
                <button
                  key={item.verb}
                  onClick={() => handleSearch(item.verb)}
                  className={`whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-medium border transition-all active:scale-95 ${
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
        </>
      )}

      {savedNotification && (
        <div className="p-3.5 backdrop-blur-2xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-200 text-xs rounded-2xl flex items-center justify-between shadow-xl animate-fadeIn">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-semibold">{savedNotification}</span>
          </div>
        </div>
      )}

      {/* Main Verb Overview Card */}
      {conjugation ? (
        <div className="space-y-4">
          {/* Card 1: Core Identity & Stem Diagnostics */}
          <div className="rounded-2xl backdrop-blur-2xl bg-indigo-950/20 border border-indigo-500/15 shadow-2xl p-5 sm:p-6 transition-all hover:border-indigo-500/25">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-100 capitalize">
                    {conjugation.infinitive}
                  </h2>
                  <button
                    onClick={() => handlePronounce(conjugation.infinitive)}
                    title="Beluister uitspraak"
                    aria-label="Beluister uitspraak"
                    className="p-1.5 rounded-xl text-indigo-400 hover:text-indigo-200 backdrop-blur-xl bg-indigo-950/40 hover:bg-indigo-900/40 border border-indigo-500/20 hover:border-indigo-400/40 transition-all active:scale-95"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleSaveWord}
                    title="Opslaan in Mijn Fouten"
                    aria-label="Opslaan in Mijn Fouten"
                    className="p-1.5 rounded-xl text-slate-400 hover:text-emerald-300 backdrop-blur-xl bg-indigo-950/40 hover:bg-emerald-950/40 border border-indigo-500/20 hover:border-emerald-500/30 transition-all active:scale-95"
                  >
                    <BookmarkPlus className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Hulpwerkwoord:{' '}
                  <span className="font-bold text-slate-200">
                    {conjugation.auxiliary === 'both'
                      ? 'hebben & zijn'
                      : conjugation.auxiliary}
                  </span>
                </p>
              </div>

              {/* Status Badges with glowing accents */}
              <div className="flex flex-col items-end gap-1.5">
                {conjugation.isIrregular ? (
                  <span className="px-3 py-1 rounded-full text-[11px] font-semibold backdrop-blur-xl bg-amber-950/40 text-amber-300 border border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.15)]">
                    Sterk / Onregelmatig
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full text-[11px] font-semibold backdrop-blur-xl bg-emerald-950/40 text-emerald-300 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.18)]">
                    Zwak / Regelmatig
                  </span>
                )}
                {separable?.isSeparable && (
                  <span className="px-3 py-1 rounded-full text-[11px] font-semibold backdrop-blur-xl bg-indigo-950/50 text-indigo-300 border border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.18)]">
                    Scheidbaar ({separable.prefix})
                  </span>
                )}
              </div>
            </div>

            {/* Section 1: Zwak / Regelmatig ('t kofschip & stem analysis) */}
            {stem && (
              <div className="rounded-xl backdrop-blur-xl bg-indigo-950/30 border border-indigo-500/15 p-4 space-y-3 text-xs">
                <div className="flex items-center justify-between pb-2.5 border-b border-indigo-500/15 font-semibold text-slate-300">
                  <span>Stam analyse (Stem derivation):</span>
                  <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-lg bg-indigo-900/50 border border-indigo-500/30 text-indigo-200 shadow-sm">
                    {stem.cleanStem}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-slate-300">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                      Ruwe stam (-en):
                    </span>
                    <span className="font-mono font-medium text-slate-100 text-sm">
                      {stem.rawStem}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                      Originele medeklinker:
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="font-mono font-bold text-slate-100 text-sm">
                        '{stem.originalEndConsonant}'
                      </span>
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          isKofschipConsonant
                            ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                            : 'bg-indigo-950/50 text-indigo-300 border border-indigo-500/30'
                        }`}
                      >
                        {isKofschipConsonant ? "in 't kofschip (-te)" : "niet in kofschip (-de)"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Specific Rule Indicators */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {stem.voicedShift && (
                    <span className="px-2.5 py-1 rounded-lg bg-rose-950/40 text-rose-300 border border-rose-500/30 text-[11px] font-semibold flex items-center gap-1.5 shadow-[0_0_12px_rgba(244,63,94,0.15)]">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                      NT2 Valstrik: {stem.voicedShift} (origineel '{stem.originalEndConsonant}') → altijd -de
                    </span>
                  )}
                  {stem.vowelDoubled && (
                    <span className="px-2.5 py-1 rounded-lg bg-indigo-950/50 text-indigo-300 border border-indigo-500/25 text-[11px] font-medium">
                      Klinkerverdubbeling (open lettergreep)
                    </span>
                  )}
                  {stem.consonantReduced && (
                    <span className="px-2.5 py-1 rounded-lg bg-slate-900/60 text-slate-300 border border-slate-700/60 text-[11px] font-medium">
                      Medeklinkerverenkeling
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Section 2: Voltooid Deelwoord & V.T.T. */}
            <div className="mt-5">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Voltooid Deelwoord & V.T.T.
              </h4>
              <div className="rounded-xl p-3.5 backdrop-blur-xl bg-indigo-950/30 border border-indigo-500/15 text-xs space-y-2">
                <div className="flex items-center justify-between pb-2 border-b border-indigo-500/15">
                  <span className="text-slate-400 font-medium">
                    Deelwoord (Participle):
                  </span>
                  <span className="font-mono font-extrabold text-sm text-indigo-300">
                    {conjugation.pastParticiple}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-medium">
                    Voorbeeld voltooid (ik):
                  </span>
                  <span className="font-semibold text-slate-100">
                    {conjugation.perfect['1s']}
                  </span>
                </div>
              </div>
            </div>

            {/* Section 3: O.V.T. — Verleden Tijd */}
            <div className="mt-5">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                O.V.T. — Verleden Tijd
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl p-3.5 backdrop-blur-xl bg-indigo-950/30 border border-indigo-500/15">
                  <span className="text-slate-400 block text-[11px] mb-1 font-medium">
                    Enkelvoud (ik/jij/hij):
                  </span>
                  <span className="font-bold text-sm text-indigo-300 font-mono">
                    {conjugation.past.singular}
                  </span>
                </div>
                <div className="rounded-xl p-3.5 backdrop-blur-xl bg-indigo-950/30 border border-indigo-500/15">
                  <span className="text-slate-400 block text-[11px] mb-1 font-medium">
                    Meervoud (wij/jullie/zij):
                  </span>
                  <span className="font-bold text-sm text-indigo-300 font-mono">
                    {conjugation.past.plural}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Volledig Vervoegingsoverzicht */}
          <div className="rounded-2xl backdrop-blur-2xl bg-indigo-950/20 border border-indigo-500/15 shadow-2xl p-5 sm:p-6 transition-all hover:border-indigo-500/25">
            <div className="flex items-center justify-between pb-3 border-b border-indigo-500/15 mb-4">
              <h3 className="font-bold text-slate-100 text-sm">
                Volledig Vervoegingsoverzicht
              </h3>
              <span className="text-xs text-indigo-300 font-mono font-semibold px-2 py-0.5 rounded-md bg-indigo-950/50 border border-indigo-500/25">
                {conjugation.infinitive}
              </span>
            </div>

            {/* Present Tense (O.T.T.) */}
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                O.T.T. — Tegenwoordige Tijd
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {(Object.keys(PERSON_LABELS) as Person[]).map((p) => {
                  const form = conjugation.present[p];
                  const inverted = conjugation.presentInverted[p];
                  return (
                    <div
                      key={p}
                      className="rounded-xl p-3 backdrop-blur-xl bg-indigo-950/30 border border-indigo-500/15 hover:border-indigo-500/30 flex items-center justify-between transition-all"
                    >
                      <span className="text-slate-400 font-medium">
                        {PERSON_LABELS[p].pronoun}
                      </span>
                      <div className="text-right">
                        <span className="font-semibold text-slate-100">
                          {form}
                        </span>
                        {inverted && (
                          <span className="block text-[10px] text-indigo-400/90 font-mono">
                            inv: {inverted}?
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl backdrop-blur-2xl bg-indigo-950/20 border border-indigo-500/15 shadow-2xl p-8 text-center">
          <Info className="w-8 h-8 text-indigo-400 mx-auto mb-2" />
          <h3 className="font-semibold text-slate-100 text-sm">
            Geen werkwoord gevonden
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Controleer de spelling van "{searchTerm}" of kies een van de voorbeelden hierboven.
          </p>
        </div>
      )}
    </div>
  );
}
