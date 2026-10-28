import { useState, useMemo } from 'react';
import {
  conjugate,
  KOFSCHIP_CONSONANTS,
  type FullConjugation,
} from '@execution/verb_engine';
import { Search, Bookmark, Volume2, Info, Check } from 'lucide-react';

export interface VerbCheckerProps {
  initialVerb?: string;
  onSaveToMijnFouten?: (infinitive: string) => Promise<boolean | void> | boolean | void;
  onOpenPaywall?: () => void;
  hideSearch?: boolean;
}

const COMMON_EXAMPLE_VERBS = [
  { verb: 'werken',    tag: "'t Kofschip (-te)" },
  { verb: 'leven',     tag: 'v → f trap (-de)' },
  { verb: 'verhuizen', tag: 'z → s trap (-de)' },
  { verb: 'opbellen',  tag: 'Scheidbaar' },
  { verb: 'lopen',     tag: 'Hebben / Zijn' },
  { verb: 'zijn',      tag: 'Onregelmatig' },
  { verb: 'antwoorden',tag: 'Stam op -d' },
];

export function VerbChecker({
  initialVerb = 'leven',
  onSaveToMijnFouten,
  hideSearch = false,
}: VerbCheckerProps) {
  const [searchTerm, setSearchTerm] = useState<string>(initialVerb);
  const [activeVerb, setActiveVerb] = useState<string>(initialVerb);
  const [savedNotification, setSavedNotification] = useState<string | null>(null);

  const conjugation: FullConjugation | null = useMemo(() => {
    const trimmed = activeVerb.trim().toLowerCase();
    if (!trimmed) return null;
    try {
      return conjugate(trimmed);
    } catch {
      return null;
    }
  }, [activeVerb]);

  const handleSearch = (verbToSearch?: string) => {
    const target = (verbToSearch ?? searchTerm).trim().toLowerCase();
    if (!target) return;
    setActiveVerb(target);
    setSearchTerm(target);
    setSavedNotification(null);
  };

  const handlePronounce = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'nl-NL';
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleSaveWord = async () => {
    if (!activeVerb) return;
    if (onSaveToMijnFouten) {
      await onSaveToMijnFouten(activeVerb);
      setSavedNotification(`'${activeVerb}' opgeslagen in Mijn Fouten!`);
    } else {
      setSavedNotification(`'${activeVerb}' gemarkeerd voor herhaling!`);
    }
    setTimeout(() => setSavedNotification(null), 3000);
  };

  const stem = conjugation?.stem;
  const isKofschipConsonant = stem
    ? KOFSCHIP_CONSONANTS.has(stem.originalEndConsonant)
    : false;

  return (
    <div className="w-full space-y-4 text-slate-100">
      {/* Search + chips */}
      {!hideSearch && (
        <>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-100">
                Werkwoord Checker
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Directe vervoegingen &amp; 't kofschip stamregels.
              </p>
            </div>
            <button
              onClick={handleSaveWord}
              aria-label="Opslaan in Mijn Fouten"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold border border-indigo-500/20 backdrop-blur-xl bg-indigo-950/30 hover:bg-indigo-900/40 text-slate-200 transition-all active:scale-95 shrink-0"
            >
              <Bookmark className="w-3.5 h-3.5 text-indigo-400" />
              Opslaan
            </button>
          </div>

          {/* Search bar */}
          <div className="relative group">
            <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-indigo-500/30 via-indigo-400/20 to-emerald-500/20 blur-sm opacity-50 group-focus-within:opacity-100 transition duration-300 pointer-events-none" />
            <form
              onSubmit={(e) => { e.preventDefault(); handleSearch(); }}
              className="relative flex items-center backdrop-blur-xl bg-indigo-950/20 border border-indigo-500/15 rounded-xl p-1 transition-all focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-500/20"
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
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-indigo-600 via-indigo-500 to-indigo-600 hover:from-indigo-500 hover:to-indigo-400 active:scale-95 text-white font-bold text-xs rounded-xl border border-indigo-400/30 transition-all shrink-0"
              >
                <Search className="w-3.5 h-3.5" />
                Zoek
              </button>
            </form>
          </div>

          {/* Verb chips */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {COMMON_EXAMPLE_VERBS.map((item) => {
              const isActive = activeVerb === item.verb;
              return (
                <button
                  key={item.verb}
                  onClick={() => handleSearch(item.verb)}
                  className={`whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-medium border transition-all active:scale-95 ${
                    isActive
                      ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white border-indigo-400/80 font-semibold'
                      : 'backdrop-blur-xl bg-indigo-950/20 text-slate-300 border-indigo-500/15 hover:bg-indigo-900/40 hover:text-slate-100'
                  }`}
                >
                  {item.verb}
                  <span className="ml-1 opacity-60 text-[10px]">({item.tag})</span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Saved toast */}
      {savedNotification && (
        <div className="p-3.5 bg-emerald-950/40 border border-emerald-500/30 text-emerald-200 text-xs rounded-2xl flex items-center gap-2 animate-fadeIn">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-semibold">{savedNotification}</span>
        </div>
      )}

      {/* Result card */}
      {conjugation ? (
        <div className="rounded-2xl bg-white/5 border border-white/10 border-l-4 border-l-indigo-500 p-5 space-y-5">

          {/* ── Section 1: Stem & 't Kofschip ── */}
          <div>
            <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 mb-2">
              Stam &amp; 't Kofschip
            </p>
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-3xl font-extrabold tracking-tight text-slate-100">
                {conjugation.infinitive}
              </h2>
              <button
                onClick={() => handlePronounce(conjugation.infinitive)}
                title="Beluister uitspraak"
                aria-label="Beluister uitspraak"
                className="p-1.5 rounded-lg text-indigo-400 hover:text-indigo-200 bg-indigo-950/40 hover:bg-indigo-900/40 border border-indigo-500/20 transition-all active:scale-95"
              >
                <Volume2 className="w-4 h-4" />
              </button>
              <button
                onClick={handleSaveWord}
                title="Opslaan in Mijn Fouten"
                aria-label="Opslaan in Mijn Fouten"
                className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-300 bg-indigo-950/40 hover:bg-emerald-950/40 border border-indigo-500/20 hover:border-emerald-500/30 transition-all active:scale-95"
              >
                <Bookmark className="w-4 h-4" />
              </button>
            </div>
            {stem && (
              <p className="text-sm text-slate-400">
                Kök:{' '}
                <span className="font-bold text-indigo-300">{stem.cleanStem}</span>
                {' · '}
                <span className={`font-semibold text-sm ${isKofschipConsonant ? 'text-emerald-300' : 'text-indigo-300'}`}>
                  {isKofschipConsonant ? "in 't kofschip (-te)" : 'niet in kofschip (-de)'}
                </span>
              </p>
            )}
            {stem?.voicedShift && (
              <p className="mt-1.5 text-xs text-amber-300/90">
                ⚠️ v→f / z→s valkuil: altijd -de
              </p>
            )}
          </div>

          {/* ── Section 2: Past Tense (OVT) ── */}
          <div>
            <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 mb-2">
              Verleden Tijd (OVT)
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-white/5 border border-white/10 p-3.5">
                <span className="text-[11px] text-slate-400 font-semibold block mb-1">
                  Enkelvoud
                </span>
                <span className="text-sm font-bold text-indigo-300">
                  {conjugation.past.singular}
                </span>
              </div>
              <div className="rounded-xl bg-white/5 border border-white/10 p-3.5">
                <span className="text-[11px] text-slate-400 font-semibold block mb-1">
                  Meervoud
                </span>
                <span className="text-sm font-bold text-indigo-300">
                  {conjugation.past.plural}
                </span>
              </div>
            </div>
          </div>

          {/* ── Section 3: Past Participle (Voltooid Deelwoord) ── */}
          <div>
            <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 mb-2">
              Voltooid Deelwoord
            </p>
            <div className="rounded-xl bg-white/5 border border-white/10 p-3.5 flex items-center justify-between">
              <span className="text-slate-400 text-sm">
                Deelwoord:{' '}
                <span className="font-bold text-indigo-300">
                  {conjugation.pastParticiple}
                </span>
              </span>
              <span className="text-slate-300 text-xs font-semibold">
                ik {conjugation.perfect['1s']}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-white/5 border border-white/10 p-8 text-center">
          <Info className="w-8 h-8 text-indigo-400 mx-auto mb-2" />
          <h3 className="font-semibold text-slate-100 text-sm">
            Geen werkwoord gevonden
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Controleer de spelling van &quot;{searchTerm}&quot; of kies een van de voorbeelden hierboven.
          </p>
        </div>
      )}
    </div>
  );
}
