import { useState, useMemo } from 'react';
import {
  conjugate,
  isValidDutchVerb,
  KOFSCHIP_CONSONANTS,
  type FullConjugation,
} from '@execution/verb_engine';
import { Search, Volume2 } from 'lucide-react';

export interface VerbCheckerProps {
  initialVerb?: string;
  hideSearch?: boolean;
  isDarkMode?: boolean;
}

const COMMON_EXAMPLE_VERBS = [
  { verb: 'werken',     tag: "Regelmatig (-te)" },
  { verb: 'leven',      tag: 'v → f trap (-de)' },
  { verb: 'verhuizen',  tag: 'z → s trap (-de)' },
  { verb: 'opbellen',   tag: 'Scheidbaar' },
  { verb: 'lopen',      tag: 'Hebben / Zijn' },
  { verb: 'nemen',      tag: 'Onregelmatig' },
  { verb: 'zijn',       tag: 'Onregelmatig' },
  { verb: 'antwoorden', tag: 'Stam op -d' },
];

export function VerbChecker({
  initialVerb = 'leven',
  hideSearch = false,
  isDarkMode = true,
}: VerbCheckerProps) {
  const [searchTerm, setSearchTerm] = useState<string>(initialVerb);
  const [activeVerb, setActiveVerb] = useState<string>(initialVerb);

  const normalizedVerb = activeVerb.trim().toLowerCase();
  const isValid = useMemo(() => {
    if (!normalizedVerb) return false;
    return isValidDutchVerb(normalizedVerb);
  }, [normalizedVerb]);

  // Strict check: never run conjugation or 't kofschip algorithm on invalid words
  const conjugation: FullConjugation | null = useMemo(() => {
    if (!isValid || !normalizedVerb) return null;
    try {
      return conjugate(normalizedVerb);
    } catch {
      return null;
    }
  }, [isValid, normalizedVerb]);

  const handleSearch = (verbToSearch?: string) => {
    const target = (verbToSearch ?? searchTerm).trim().toLowerCase();
    if (!target) return;
    setSearchTerm(target);
    setActiveVerb(target);
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

  const stem = conjugation?.stem;
  const isKofschipConsonant = stem
    ? KOFSCHIP_CONSONANTS.has(stem.originalEndConsonant)
    : false;

  // Theme-aware style helpers aligned with CLAUDE.md Color System
  const labelText = isDarkMode ? 'text-slate-400' : 'text-slate-600 font-semibold';
  const bodyText = isDarkMode ? 'text-slate-400' : 'text-slate-600';
  const headingText = isDarkMode ? 'text-[#E2E8F0]' : 'text-[#0F172A]';
  const cardBg = isDarkMode
    ? 'bg-[#151D2A]/80 border-white/10 backdrop-blur-xl'
    : 'bg-white border-slate-200 shadow-sm';
  const rowHover = isDarkMode ? 'border-white/5 hover:bg-white/5' : 'border-slate-100 hover:bg-slate-50/80';
  const dividerColor = isDarkMode ? 'border-white/10' : 'border-slate-200';

  return (
    <div className={`w-full space-y-4 ${headingText}`}>
      {/* Search + chips (alleen zichtbaar als hideSearch=false) */}
      {!hideSearch && (
        <>
          <div>
            <h1 className={`text-xl sm:text-2xl font-extrabold tracking-tight ${headingText}`}>
              Werkwoord Checker
            </h1>
            <p className={`text-xs mt-0.5 ${bodyText}`}>
              Directe vervoegingen &amp; 't kofschip stamregels.
            </p>
          </div>

          {/* Search bar */}
          <form
            onSubmit={(e) => { e.preventDefault(); handleSearch(); }}
            className={`flex items-center border rounded-xl p-1 transition-all focus-within:border-[#3B82F6] focus-within:ring-2 focus-within:ring-blue-500/20 ${
              isDarkMode
                ? 'bg-[#151D2A]/80 border-white/10'
                : 'bg-white border-slate-300 shadow-sm'
            }`}
          >
            <Search className="ml-3 w-4 h-4 text-[#3B82F6] shrink-0" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Typ een werkwoord, bijv. lopen, nemen..."
              className={`w-full pl-3 pr-4 py-2 bg-transparent border-0 text-sm font-medium focus:outline-none ${
                isDarkMode ? 'text-slate-100 placeholder:text-slate-500' : 'text-slate-900 placeholder:text-slate-400'
              }`}
            />
            <button
              type="submit"
              className="px-4 py-2 bg-[#3B82F6] hover:bg-blue-600 active:scale-95 text-white font-bold text-xs rounded-xl transition-all shrink-0"
            >
              Zoeken
            </button>
          </form>

          {/* Verb chips */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {COMMON_EXAMPLE_VERBS.map((item) => {
              const isActive = activeVerb === item.verb;
              return (
                <button
                  key={item.verb}
                  onClick={() => handleSearch(item.verb)}
                  className={`whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all active:scale-95 ${
                    isActive
                      ? 'bg-[#3B82F6] text-white border-[#3B82F6] shadow-xs'
                      : isDarkMode
                        ? 'bg-[#151D2A]/80 text-slate-300 border-white/10 hover:bg-white/10'
                        : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-100 shadow-sm'
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

      {/* Result card */}
      {!isValid ? (
        /* ── Geçersiz fiil uyarısı ── */
        <div className={`rounded-2xl border p-8 text-center ${cardBg}`}>
          <div className="w-10 h-10 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center mx-auto mb-3">
            <span className="text-red-500 text-lg font-black">✕</span>
          </div>
          <h3 className={`font-extrabold text-sm ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>
            Dit is geen geldig Nederlands werkwoord.
          </h3>
        </div>
      ) : conjugation ? (
        <div className={`rounded-2xl border-l-4 p-5 space-y-5 transition-all ${
          conjugation.isIrregular
            ? 'border-l-[#F59E0B]'    // Amber — Onregelmatig Werkwoord
            : isKofschipConsonant
              ? 'border-l-[#10B981]'  // Green — Regelmatig (Zwak), kofschip -te
              : 'border-l-[#3B82F6]'  // Blue  — Regelmatig (Zwak), geen kofschip -de
        } ${cardBg}`}>

          {/* ── Sectie 1: Stam & 't Kofschip ── */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <p className={`text-[11px] uppercase tracking-wider font-semibold ${labelText}`}>
                {conjugation.isIrregular ? 'Werkwoord Status & Stam' : "Stam & 't Kofschip"}
              </p>
              {conjugation.isIrregular ? (
                // Amber badge — Onregelmatig Werkwoord (CLAUDE.md §4)
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30 shadow-xs">
                  <span className="w-2 h-2 rounded-full bg-[#F59E0B] animate-pulse" />
                  Onregelmatig Werkwoord
                </span>
              ) : (
                // Green badge — Regelmatig (Zwak) Werkwoord (CLAUDE.md §4)
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 shadow-xs">
                  <span className="w-2 h-2 rounded-full bg-[#10B981]" />
                  Regelmatig (Zwak) Werkwoord
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 mb-2">
              <h2 className={`text-3xl font-extrabold tracking-tight ${headingText}`}>
                {conjugation.infinitive}
              </h2>
              <button
                onClick={() => handlePronounce(conjugation.infinitive)}
                title="Beluister uitspraak"
                aria-label="Beluister uitspraak"
                className={`p-1.5 rounded-lg border transition-all active:scale-95 ${
                  isDarkMode
                    ? 'text-[#3B82F6] border-white/10 hover:text-blue-300 bg-white/5'
                    : 'text-[#3B82F6] border-slate-200 hover:text-blue-700 bg-slate-50'
                }`}
              >
                <Volume2 className="w-4 h-4" />
              </button>
            </div>

            {conjugation.isIrregular ? (
              // Onregelmatig: toon stam + amber waarschuwing (CLAUDE.md §2)
              <div className="space-y-1.5">
                {stem && (
                  <p className={`text-sm ${bodyText}`}>
                    Stam: <span className="font-bold text-[#3B82F6]">{stem.cleanStem}</span>
                  </p>
                )}
                <div className={`p-2.5 rounded-xl border text-xs font-medium ${
                  isDarkMode ? 'bg-[#F59E0B]/10 border-[#F59E0B]/25 text-[#F59E0B]' : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}>
                  📌 <strong>Let op:</strong> 't Kofschip (-te / -de) geldt <em>alleen</em> voor regelmatige werkwoorden. Voor dit onregelmatige werkwoord gelden vaste onregelmatige vormen.
                </div>
              </div>
            ) : (
              // Regelmatig: toon stam + kofschip-status (CLAUDE.md §2 & §4)
              <>
                {stem && (
                  <p className={`text-sm ${bodyText}`}>
                    Stam:{' '}
                    <span className="font-bold text-[#3B82F6]">{stem.cleanStem}</span>
                    {' · '}
                    <span className={`font-semibold text-sm ${isKofschipConsonant ? 'text-[#10B981]' : 'text-[#3B82F6]'}`}>
                      {isKofschipConsonant ? "in 't kofschip (-te)" : 'niet in kofschip (-de)'}
                    </span>
                  </p>
                )}
                {stem?.voicedShift && (
                  <p className="mt-1.5 text-xs text-[#F59E0B] font-semibold">
                    ⚠️ v→f / z→s valkuil: altijd -de
                  </p>
                )}
              </>
            )}
          </div>

          {/* ── Sectie 2: Voltooid Deelwoord (V.T.T.) ── (CLAUDE.md §3) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className={`text-[11px] uppercase tracking-wider font-semibold ${labelText}`}>
                Voltooid Deelwoord (V.T.T.)
              </p>
              {conjugation.isIrregular && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/25">
                  Exacte onregelmatige vorm
                </span>
              )}
            </div>
            <div className={`rounded-xl border p-3.5 flex items-center justify-between ${cardBg}`}>
              <span className={`text-sm ${bodyText}`}>
                Deelwoord:{' '}
                <span className="font-bold text-[#3B82F6] text-base">
                  {conjugation.pastParticiple}
                </span>
              </span>
              <span className={`text-xs font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                ik {conjugation.perfect['1s']}
              </span>
            </div>
          </div>

          {/* ── Sectie 3: Verleden Tijd (O.V.T.) ── (CLAUDE.md §3) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className={`text-[11px] uppercase tracking-wider font-semibold ${labelText}`}>
                Verleden Tijd (O.V.T.)
              </p>
              {conjugation.isIrregular && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/25">
                  Onregelmatig (Klankverandering)
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className={`rounded-xl border p-3.5 ${cardBg}`}>
                <span className={`text-[11px] font-semibold block mb-1 ${bodyText}`}>
                  Enkelvoud
                </span>
                <span className="text-sm sm:text-base font-bold text-[#3B82F6]">
                  {conjugation.past.singular}
                </span>
              </div>
              <div className={`rounded-xl border p-3.5 ${cardBg}`}>
                <span className={`text-[11px] font-semibold block mb-1 ${bodyText}`}>
                  Meervoud
                </span>
                <span className="text-sm sm:text-base font-bold text-[#3B82F6]">
                  {conjugation.past.plural}
                </span>
              </div>
            </div>
          </div>

          {/* ── Sectie 4: Onvoltooid Tegenwoordige Tijd (O.T.T.) ── (CLAUDE.md §3) */}
          <div>
            <p className={`text-[11px] uppercase tracking-wider font-semibold mb-2 ${labelText}`}>
              Onvoltooid Tegenwoordige Tijd (O.T.T.)
            </p>
            <div className={`rounded-xl overflow-hidden border ${cardBg}`}>
              {/* Column headers */}
              <div className={`grid grid-cols-2 border-b px-3.5 py-2 ${dividerColor}`}>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${labelText}`}>Persoon</span>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${labelText}`}>Vervoeging</span>
              </div>
              {/* ik */}
              <div className={`grid grid-cols-2 items-center px-3.5 py-2.5 border-b transition-colors ${rowHover}`}>
                <span className={`text-xs font-medium ${bodyText}`}>ik</span>
                <span className="text-sm font-bold text-[#3B82F6]">{conjugation.present['1s']}</span>
              </div>
              {/* jij/u */}
              <div className={`grid grid-cols-2 items-start px-3.5 py-2.5 border-b transition-colors ${rowHover}`}>
                <span className={`text-xs font-medium ${bodyText}`}>jij / u</span>
                <div>
                  <span className="text-sm font-bold text-[#3B82F6] block">{conjugation.present['2s']}</span>
                  {conjugation.presentInverted['2s'] && conjugation.presentInverted['2s'] !== conjugation.present['2s'] && (
                    <span className="text-[11px] text-[#F59E0B] font-medium mt-0.5 block">
                      ↩ inversie: {conjugation.presentInverted['2s']}?
                    </span>
                  )}
                </div>
              </div>
              {/* hij/zij/het */}
              <div className={`grid grid-cols-2 items-center px-3.5 py-2.5 border-b transition-colors ${rowHover}`}>
                <span className={`text-xs font-medium ${bodyText}`}>hij / zij / het</span>
                <span className="text-sm font-bold text-[#3B82F6]">{conjugation.present['3s']}</span>
              </div>
              {/* wij */}
              <div className={`grid grid-cols-2 items-center px-3.5 py-2.5 border-b transition-colors ${rowHover}`}>
                <span className={`text-xs font-medium ${bodyText}`}>wij</span>
                <span className="text-sm font-bold text-[#3B82F6]">{conjugation.present['1p']}</span>
              </div>
              {/* jullie */}
              <div className={`grid grid-cols-2 items-center px-3.5 py-2.5 border-b transition-colors ${rowHover}`}>
                <span className={`text-xs font-medium ${bodyText}`}>jullie</span>
                <span className="text-sm font-bold text-[#3B82F6]">{conjugation.present['2p']}</span>
              </div>
              {/* zij (meervoud) */}
              <div className={`grid grid-cols-2 items-center px-3.5 py-2.5 transition-colors ${isDarkMode ? 'hover:bg-white/5' : 'hover:bg-slate-50'}`}>
                <span className={`text-xs font-medium ${bodyText}`}>zij</span>
                <span className="text-sm font-bold text-[#3B82F6]">{conjugation.present['3p']}</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className={`rounded-2xl border p-8 text-center ${cardBg}`}>
          <div className="w-10 h-10 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center mx-auto mb-3">
            <span className="text-red-500 text-lg font-black">✕</span>
          </div>
          <h3 className={`font-extrabold text-sm ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>
            Dit is geen geldig Nederlands werkwoord.
          </h3>
        </div>
      )}
    </div>
  );
}
