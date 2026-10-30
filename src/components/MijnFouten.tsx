import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  checkConjugation,
  type Person,
  type Tense,
  type CheckResult,
} from '@execution/verb_engine';
import {
  BookOpen,
  Play,
  CheckCircle,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Plus,
  Trash2,
  Sparkles,
  Search,
  ChevronRight,
  X,
} from 'lucide-react';

export interface SavedWord {
  id: string;
  user_id?: string;
  infinitive: string;
  translation?: string | null;
  notes?: string | null;
  difficulty_rating?: number;
  times_practiced: number;
  times_correct: number;
  last_practiced_at?: string | null;
  next_review_at: string;
  mastery_level: number; // 0 to 5
  is_favorite?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface MijnFoutenProps {
  onSelectVerbForInspection?: (verb: string) => void;
  onOpenPaywall?: () => void;
  isDarkMode?: boolean;
}

// Default initial dataset for offline/unauthenticated mode
const INITIAL_DEMO_WORDS: SavedWord[] = [
  {
    id: 'demo-1',
    infinitive: 'leven',
    translation: 'leven / wonen',
    notes: 'NT2 valkuil: stam leef (v→f), verleden tijd leefde (v zit niet in kofschip)',
    difficulty_rating: 4,
    times_practiced: 5,
    times_correct: 3,
    last_practiced_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    next_review_at: new Date(Date.now() - 3600000).toISOString(), // due now
    mastery_level: 2,
  },
  {
    id: 'demo-2',
    infinitive: 'verhuizen',
    translation: 'van woning veranderen',
    notes: 'NT2 valkuil: z→s klankverschuiving, maar z niet in kofschip → verhuisde',
    difficulty_rating: 4,
    times_practiced: 6,
    times_correct: 4,
    last_practiced_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    next_review_at: new Date(Date.now() - 7200000).toISOString(), // due now
    mastery_level: 2,
  },
  {
    id: 'demo-3',
    infinitive: 'opbellen',
    translation: 'telefoneren',
    notes: 'Scheidbaar werkwoord: bel op, opgebeld',
    difficulty_rating: 3,
    times_practiced: 4,
    times_correct: 3,
    last_practiced_at: new Date(Date.now() - 86400000 * 4).toISOString(),
    next_review_at: new Date(Date.now() + 86400000).toISOString(),
    mastery_level: 3,
  },
  {
    id: 'demo-4',
    infinitive: 'antwoorden',
    translation: 'antwoord geven',
    notes: 'Stam eindigt op d: antwoordde (dubbel d in verleden tijd)',
    difficulty_rating: 3,
    times_practiced: 8,
    times_correct: 7,
    last_practiced_at: new Date(Date.now() - 86400000 * 6).toISOString(),
    next_review_at: new Date(Date.now() + 86400000 * 5).toISOString(),
    mastery_level: 4,
  },
  {
    id: 'demo-5',
    infinitive: 'werken',
    translation: 'arbeid verrichten',
    notes: "Regelmatig: 'k' zit in 't kofschip → werkte, gewerkt",
    difficulty_rating: 1,
    times_practiced: 12,
    times_correct: 12,
    last_practiced_at: new Date(Date.now() - 86400000 * 10).toISOString(),
    next_review_at: new Date(Date.now() + 86400000 * 14).toISOString(),
    mastery_level: 5,
  },
];

const LOCAL_STORAGE_KEY = 'kofschip_saved_words_cache';

// Spaced repetition intervals in days for levels 0 to 5
const SRS_INTERVALS_DAYS = [0, 1, 3, 7, 14, 30];

interface PracticeChallenge {
  tense: Tense;
  person: Person;
  prompt: string;
}

const PRACTICE_PROMPTS: PracticeChallenge[] = [
  { tense: 'past', person: '1s', prompt: 'Verleden tijd enkelvoud (ik ...)' },
  { tense: 'past', person: '1p', prompt: 'Verleden tijd meervoud (wij ...)' },
  { tense: 'pastParticiple', person: '1s', prompt: 'Voltooid deelwoord (ge-...)' },
  { tense: 'present', person: '2s', prompt: 'Tegenwoordige tijd (jij ...)' },
];

export function MijnFouten({
  onSelectVerbForInspection,
  onOpenPaywall,
  isDarkMode = true,
}: MijnFoutenProps) {
  const [words, setWords] = useState<SavedWord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [filter, setFilter] = useState<'all' | 'due' | 'struggling' | 'mastered'>('due');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [newVerbInput, setNewVerbInput] = useState<string>('');
  const [isAddingVerb, setIsAddingVerb] = useState<boolean>(false);

  // Theme-aware styles aligned with Pedagogical Color Palette
  const headingText = isDarkMode ? 'text-[#E2E8F0]' : 'text-[#0F172A]';
  const bodyText = isDarkMode ? 'text-slate-400' : 'text-slate-600';
  const cardBg = isDarkMode
    ? 'bg-[#151D2A]/80 border-white/10 backdrop-blur-xl'
    : 'bg-white border-slate-200 shadow-sm';
  const cardBgSubtle = isDarkMode
    ? 'bg-white/5 border-white/10'
    : 'bg-slate-50 border-slate-200';
  const inputBg = isDarkMode
    ? 'bg-[#151D2A]/80 border-white/10 text-[#E2E8F0] placeholder:text-slate-500'
    : 'bg-white border-slate-200 text-[#0F172A] placeholder:text-slate-400';

  // Practice Mode State
  const [isPracticing, setIsPracticing] = useState<boolean>(false);
  const [practiceIndex, setPracticeIndex] = useState<number>(0);
  const [practiceAnswer, setPracticeAnswer] = useState<string>('');
  const [practiceDiagnostic, setPracticeDiagnostic] = useState<CheckResult | null>(null);
  const [hasEvaluated, setHasEvaluated] = useState<boolean>(false);
  const [practiceChallenge, setPracticeChallenge] = useState<PracticeChallenge>(PRACTICE_PROMPTS[0]);

  // Load words from Supabase or localStorage
  const loadWords = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;

      if (user) {
        const { data, error } = await supabase
          .from('saved_words')
          .select('*')
          .eq('user_id', user.id)
          .order('next_review_at', { ascending: true });

        if (!error && data && data.length > 0) {
          setWords(data as SavedWord[]);
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
          setIsLoading(false);
          return;
        }
      }

      // Fallback to localStorage cache or default demo items
      const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (cached) {
        setWords(JSON.parse(cached));
      } else {
        setWords(INITIAL_DEMO_WORDS);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(INITIAL_DEMO_WORDS));
      }
    } catch {
      // Offline fallback
      const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
      setWords(cached ? JSON.parse(cached) : INITIAL_DEMO_WORDS);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWords();
  }, [loadWords]);

  // Filtered list
  const filteredWords = useMemo(() => {
    const now = new Date().toISOString();
    return words.filter((item) => {
      // Search matching
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesInfinitive = item.infinitive.toLowerCase().includes(q);
        const matchesTranslation = item.translation?.toLowerCase().includes(q);
        const matchesNotes = item.notes?.toLowerCase().includes(q);
        if (!matchesInfinitive && !matchesTranslation && !matchesNotes) return false;
      }

      // Tab filter
      if (filter === 'due') {
        return item.next_review_at <= now;
      }
      if (filter === 'struggling') {
        return item.mastery_level <= 2;
      }
      if (filter === 'mastered') {
        return item.mastery_level >= 4;
      }
      return true;
    });
  }, [words, filter, searchQuery]);

  // Practice Queue (words that are due or struggling)
  const practiceQueue = useMemo(() => {
    const now = new Date().toISOString();
    const due = words.filter((w) => w.next_review_at <= now);
    return due.length > 0 ? due : words.slice(0, 5);
  }, [words]);

  // Statistics
  const stats = useMemo(() => {
    const now = new Date().toISOString();
    const dueCount = words.filter((w) => w.next_review_at <= now).length;
    const masteredCount = words.filter((w) => w.mastery_level >= 4).length;
    const totalPracticed = words.reduce((acc, curr) => acc + curr.times_practiced, 0);
    const totalCorrect = words.reduce((acc, curr) => acc + curr.times_correct, 0);
    const accuracy = totalPracticed > 0 ? Math.round((totalCorrect / totalPracticed) * 100) : 0;

    return {
      dueCount,
      masteredCount,
      totalCount: words.length,
      accuracy,
    };
  }, [words]);

  // Save word to database and local state
  const saveWordUpdate = async (updatedWord: SavedWord) => {
    const nextWords = words.map((w) => (w.id === updatedWord.id ? updatedWord : w));
    setWords(nextWords);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(nextWords));

    try {
      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user) {
        await supabase
          .from('saved_words')
          .upsert({
            id: updatedWord.id,
            user_id: authData.user.id,
            infinitive: updatedWord.infinitive,
            mastery_level: updatedWord.mastery_level,
            times_practiced: updatedWord.times_practiced,
            times_correct: updatedWord.times_correct,
            last_practiced_at: updatedWord.last_practiced_at,
            next_review_at: updatedWord.next_review_at,
            notes: updatedWord.notes,
            translation: updatedWord.translation,
            difficulty_rating: updatedWord.difficulty_rating,
          });
      }
    } catch {
      // Offline fallback: already written to localStorage
    }
  };

  // Add new word
  const handleAddNewWord = async (e: React.FormEvent) => {
    e.preventDefault();
    const inf = newVerbInput.trim().toLowerCase();
    if (!inf) return;

    if (words.some((w) => w.infinitive.toLowerCase() === inf)) {
      alert(`'${inf}' staat al in je lijst!`);
      return;
    }

    const newWord: SavedWord = {
      id: `word-${Date.now()}`,
      infinitive: inf,
      times_practiced: 0,
      times_correct: 0,
      mastery_level: 0,
      next_review_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    } as SavedWord;

    const nextList = [newWord, ...words];
    setWords(nextList);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(nextList));
    setNewVerbInput('');
    setIsAddingVerb(false);

    try {
      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user) {
        await supabase.from('saved_words').insert({
          user_id: authData.user.id,
          infinitive: inf,
          mastery_level: 0,
          next_review_at: new Date().toISOString(),
        });
      }
    } catch {
      // Offline fallback handled
    }
  };

  // Remove word
  const handleDeleteWord = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Weet je zeker dat je dit woord wilt verwijderen?')) return;

    const nextList = words.filter((w) => w.id !== id);
    setWords(nextList);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(nextList));

    try {
      await supabase.from('saved_words').delete().eq('id', id);
    } catch {
      // Offline
    }
  };

  // Start Practice Session
  const startPractice = () => {
    if (practiceQueue.length === 0) return;
    setPracticeIndex(0);
    setPracticeAnswer('');
    setPracticeDiagnostic(null);
    setHasEvaluated(false);
    // pick a random challenge prompt
    const randomPrompt = PRACTICE_PROMPTS[Math.floor(Math.random() * PRACTICE_PROMPTS.length)];
    setPracticeChallenge(randomPrompt);
    setIsPracticing(true);
  };

  // Evaluate Practice Answer
  const handleEvaluatePractice = (e: React.FormEvent) => {
    e.preventDefault();
    const currentWord = practiceQueue[practiceIndex];
    if (!currentWord || !practiceAnswer.trim()) return;

    const result = checkConjugation({
      infinitive: currentWord.infinitive,
      tense: practiceChallenge.tense,
      person: practiceChallenge.person,
      userAnswer: practiceAnswer.trim(),
    });

    setPracticeDiagnostic(result);
    setHasEvaluated(true);
  };

  // Apply Spaced Repetition Rating & Advance Card
  const handleApplyRating = async (grade: 'again' | 'hard' | 'good' | 'easy') => {
    const currentWord = practiceQueue[practiceIndex];
    if (!currentWord) return;

    let newLevel = currentWord.mastery_level;
    let daysToAdd = 1;

    switch (grade) {
      case 'again':
        newLevel = Math.max(0, newLevel - 1);
        daysToAdd = SRS_INTERVALS_DAYS[0] || 0.5;
        break;
      case 'hard':
        daysToAdd = Math.max(1, SRS_INTERVALS_DAYS[newLevel]);
        break;
      case 'good':
        newLevel = Math.min(5, newLevel + 1);
        daysToAdd = SRS_INTERVALS_DAYS[newLevel];
        break;
      case 'easy':
        newLevel = Math.min(5, newLevel + 2);
        daysToAdd = SRS_INTERVALS_DAYS[newLevel] * 1.5;
        break;
    }

    const nextDate = new Date(Date.now() + daysToAdd * 86400000).toISOString();
    const isCorrect = grade !== 'again';

    const updated: SavedWord = {
      ...currentWord,
      mastery_level: newLevel,
      times_practiced: currentWord.times_practiced + 1,
      times_correct: currentWord.times_correct + (isCorrect ? 1 : 0),
      last_practiced_at: new Date().toISOString(),
      next_review_at: nextDate,
    };

    await saveWordUpdate(updated);

    // Advance to next card or finish
    if (practiceIndex + 1 < practiceQueue.length) {
      setPracticeIndex((prev) => prev + 1);
      setPracticeAnswer('');
      setPracticeDiagnostic(null);
      setHasEvaluated(false);
      setPracticeChallenge(PRACTICE_PROMPTS[Math.floor(Math.random() * PRACTICE_PROMPTS.length)]);
    } else {
      setIsPracticing(false);
      alert('Gefeliciteerd! Oefensessie voltooid.');
    }
  };

  return (
    <div className={`w-full space-y-4 text-left ${headingText}`}>
      {/* Header */}
      <header className="flex items-start justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#3B82F6]/10 text-[#3B82F6] border border-[#3B82F6]/20 mb-1.5 shadow-xs">
            <BookOpen className="w-3.5 h-3.5 text-[#3B82F6]" />
            Leitner Herhaling
          </span>
          <h2 className={`text-xl sm:text-2xl font-extrabold tracking-tight ${headingText}`}>
            Mijn Woorden
          </h2>
          <p className={`text-xs mt-1 ${bodyText}`}>
            Opgeslagen werkwoorden en valkuilen oefenen met het Leitner-systeem.
          </p>
        </div>

        <button
          onClick={() => setIsAddingVerb(!isAddingVerb)}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#3B82F6] hover:bg-blue-600 text-white shadow-xs transition-all active:scale-95 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Toevoegen</span>
        </button>
      </header>

      {onOpenPaywall && (
        <button
          onClick={onOpenPaywall}
          className={`w-full flex items-center justify-between p-3.5 rounded-2xl border text-xs transition-all group active:scale-98 ${cardBg}`}
        >
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-[#F59E0B] shrink-0" />
            <span className={`font-semibold ${headingText}`}>
              Pro: Onbeperkte lijsten &amp; AI NT2 Inversie Zinsbouwer
            </span>
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#3B82F6]">
            <span>Eenmalige Betaling · €14.99 Lifetime Pro</span>
            <Sparkles className="w-3 h-3 text-[#F59E0B]" />
          </span>
        </button>
      )}

      {/* Add Verb Inline Form */}
      {isAddingVerb && (
        <form
          onSubmit={handleAddNewWord}
          className={`p-4 rounded-2xl border space-y-2.5 animate-fadeIn ${cardBg}`}
        >
          <label className={`block text-xs font-semibold ${headingText}`}>
            Nieuw werkwoord toevoegen aan je herhaallijst:
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={newVerbInput}
              onChange={(e) => setNewVerbInput(e.target.value)}
              placeholder="bv. verbazen, antwoorden, meenemen..."
              className={`flex-1 px-3.5 py-2.5 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#3B82F6] font-medium transition-all ${inputBg}`}
              autoFocus
            />
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#3B82F6] hover:bg-blue-600 text-white text-xs font-bold rounded-xl shadow-xs active:scale-95 transition-all shrink-0"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Opslaan</span>
            </button>
          </div>
        </form>
      )}

      {/* Interactive Practice Mode Overlay / Card: Frosted Leitner SRS Review Card */}
      {isPracticing ? (
        <div className={`rounded-2xl border p-5 sm:p-6 space-y-5 transition-colors relative overflow-hidden ${cardBg}`}>
          <div className="flex items-center justify-between pb-3 border-b border-inherit">
            <span className="text-xs font-bold text-[#3B82F6] uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#3B82F6]" />
              <span>Kaart {practiceIndex + 1} van {practiceQueue.length}</span>
            </span>
            <button
              onClick={() => setIsPracticing(false)}
              className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-xl transition-colors active:scale-95 ${bodyText} hover:${headingText}`}
            >
              <X className="w-3.5 h-3.5" />
              <span>Sluiten</span>
            </button>
          </div>

          {/* Active Card Content */}
          {practiceQueue[practiceIndex] && (
            <div className="space-y-4">
              <div className={`text-center py-7 px-4 rounded-2xl border relative overflow-hidden ${cardBgSubtle}`}>
                <span className={`text-[10px] font-bold uppercase tracking-wider block ${bodyText}`}>
                  Infinitief
                </span>
                <h3 className={`text-3xl sm:text-4xl font-extrabold tracking-tight mt-1 capitalize ${headingText}`}>
                  {practiceQueue[practiceIndex].infinitive}
                </h3>
                {practiceQueue[practiceIndex].translation && (
                  <p className={`text-xs mt-1 font-medium ${bodyText}`}>
                    ({practiceQueue[practiceIndex].translation})
                  </p>
                )}
                <div className={`mt-3.5 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full border text-xs font-semibold shadow-xs ${
                  isDarkMode
                    ? 'bg-white/5 border-white/10 text-[#3B82F6]'
                    : 'bg-blue-50 border-blue-200 text-[#3B82F6]'
                }`}>
                  <span>{practiceChallenge.prompt}</span>
                </div>
              </div>

              {/* Practice Input Form */}
              {!hasEvaluated ? (
                <form onSubmit={handleEvaluatePractice} className="space-y-3">
                  <div>
                    <label className={`block text-xs font-semibold mb-1.5 ${headingText}`}>
                      Typ jouw antwoord:
                    </label>
                    <input
                      type="text"
                      value={practiceAnswer}
                      onChange={(e) => setPracticeAnswer(e.target.value)}
                      placeholder="Typ hier de juiste vorm..."
                      autoFocus
                      className={`w-full px-4 py-3 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#3B82F6] transition-all ${inputBg}`}
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={!practiceAnswer.trim()}
                      className="inline-flex items-center justify-center gap-2 flex-1 py-2.5 px-4 bg-[#3B82F6] hover:bg-blue-600 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-all active:scale-95"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>Controleer Vervoeging</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setHasEvaluated(true)}
                      className={`inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl font-semibold text-xs border shadow-xs transition-all active:scale-95 ${
                        isDarkMode
                          ? 'bg-white/5 border-white/10 text-slate-300 hover:text-white'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <BookOpen className="w-3.5 h-3.5 text-[#3B82F6]" />
                      <span>Toon Antwoord</span>
                    </button>
                  </div>
                </form>
              ) : (
                /* Evaluated Card & Feedback */
                <div className="space-y-4">
                  {practiceDiagnostic ? (
                    <div
                      className={`p-4 rounded-xl border text-xs shadow-xs ${
                        practiceDiagnostic.isCorrect
                          ? isDarkMode
                            ? 'bg-[#10B981]/15 border-[#10B981]/30 text-emerald-200'
                            : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                          : isDarkMode
                            ? 'bg-rose-950/40 border-rose-500/30 text-rose-200'
                            : 'bg-rose-50 border-rose-200 text-rose-900'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        {practiceDiagnostic.isCorrect ? (
                          <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                        )}
                        <div className="space-y-1">
                          <p className="font-bold text-xs">
                            {practiceDiagnostic.isCorrect
                              ? 'Helemaal goed!'
                              : 'Helaas, foute vervoeging'}
                          </p>
                          <p className="leading-relaxed text-[11px] font-normal">{practiceDiagnostic.feedback}</p>
                          {!practiceDiagnostic.isCorrect && (
                            <p className="mt-1 font-bold text-xs">
                              Juiste antwoord:{' '}
                              <span className={`font-mono px-2.5 py-0.5 rounded-lg border text-xs font-bold ${
                                isDarkMode ? 'bg-[#0B0F19] border-rose-500/40 text-rose-200' : 'bg-white border-rose-300 text-rose-800'
                              }`}>
                                {practiceDiagnostic.expected.join(' of ')}
                              </span>
                            </p>
                          )}
                          {practiceDiagnostic.correctionTip && (
                            <p className={`mt-1 text-[11px] ${bodyText}`}>
                              💡 Tip: {practiceDiagnostic.correctionTip}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className={`p-3.5 border rounded-xl text-xs text-center font-medium ${cardBgSubtle} ${bodyText}`}>
                      Bekijk de regel en beoordeel je herinnering hieronder:
                    </div>
                  )}

                  {/* Leitner Spaced Repetition Rating Buttons */}
                  <div>
                    <label className={`block text-[11px] font-bold mb-2 text-center uppercase tracking-wider ${bodyText}`}>
                      Hoe ging dit woord? (Selecteer Leitner-interval):
                    </label>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <button
                        onClick={() => handleApplyRating('again')}
                        className={`py-2.5 px-1.5 border rounded-xl font-bold text-xs flex flex-col items-center justify-center active:scale-95 transition-all shadow-xs ${
                          isDarkMode
                            ? 'bg-rose-950/30 text-rose-300 border-rose-500/30 hover:bg-rose-900/40'
                            : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                        }`}
                      >
                        <RotateCcw className="w-3.5 h-3.5 mb-1" />
                        <span>Opnieuw</span>
                        <span className="text-[10px] opacity-75 mt-0.5">Vandaag</span>
                      </button>
                      <button
                        onClick={() => handleApplyRating('hard')}
                        className={`py-2.5 px-1.5 border rounded-xl font-bold text-xs flex flex-col items-center justify-center active:scale-95 transition-all shadow-xs ${
                          isDarkMode
                            ? 'bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/30 hover:bg-[#F59E0B]/25'
                            : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                        }`}
                      >
                        <RotateCcw className="w-3.5 h-3.5 mb-1 opacity-80" />
                        <span>Moeilijk</span>
                        <span className="text-[10px] opacity-75 mt-0.5">1-2 d</span>
                      </button>
                      <button
                        onClick={() => handleApplyRating('good')}
                        className={`py-2.5 px-1.5 border rounded-xl font-bold text-xs flex flex-col items-center justify-center active:scale-95 transition-all shadow-xs ${
                          isDarkMode
                            ? 'bg-[#3B82F6]/15 text-[#3B82F6] border-[#3B82F6]/30 hover:bg-[#3B82F6]/25'
                            : 'bg-blue-50 text-[#3B82F6] border-blue-200 hover:bg-blue-100'
                        }`}
                      >
                        <CheckCircle className="w-3.5 h-3.5 mb-1" />
                        <span>Goed</span>
                        <span className="text-[10px] opacity-75 mt-0.5">4 d</span>
                      </button>
                      <button
                        onClick={() => handleApplyRating('easy')}
                        className={`py-2.5 px-1.5 border rounded-xl font-bold text-xs flex flex-col items-center justify-center active:scale-95 transition-all shadow-xs ${
                          isDarkMode
                            ? 'bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30 hover:bg-[#10B981]/25'
                            : 'bg-emerald-50 text-[#10B981] border-emerald-200 hover:bg-emerald-100'
                        }`}
                      >
                        <CheckCircle className="w-3.5 h-3.5 mb-1" />
                        <span>Makkelijk</span>
                        <span className="text-[10px] opacity-75 mt-0.5">7+ d</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Summary Card & CTA */
        <div className={`rounded-2xl border p-5 sm:p-6 transition-colors ${cardBg}`}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#10B981]"></span>
                </span>
                <span className={`text-xs font-bold uppercase tracking-wider block ${bodyText}`}>
                  Vandaag te herhalen
                </span>
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className={`text-3xl font-extrabold tracking-tight ${headingText}`}>
                  {stats.dueCount}
                </span>
                <span className={`text-xs font-medium ${bodyText}`}>
                  woorden klaar voor drill
                </span>
              </div>
            </div>

            <button
              onClick={startPractice}
              disabled={practiceQueue.length === 0}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#3B82F6] hover:bg-blue-600 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-all active:scale-95"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Start Drill</span>
            </button>
          </div>

          {/* Quick Progress Bar */}
          <div className={`mt-4 pt-3.5 border-t grid grid-cols-3 gap-2 text-xs ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
            <div>
              <span className={`block text-[10px] uppercase font-bold tracking-wider ${bodyText}`}>
                Totaal opgeslagen:
              </span>
              <span className={`font-bold ${headingText}`}>
                {stats.totalCount} werkwoorden
              </span>
            </div>
            <div>
              <span className={`block text-[10px] uppercase font-bold tracking-wider ${bodyText}`}>
                Beheerst (Niv 4-5):
              </span>
              <span className="font-bold text-[#10B981]">
                {stats.masteredCount}
              </span>
            </div>
            <div>
              <span className={`block text-[10px] uppercase font-bold tracking-wider ${bodyText}`}>
                Nauwkeurigheid:
              </span>
              <span className="font-bold text-[#3B82F6]">
                {stats.accuracy}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs and Search Bar */}
      <div className="space-y-2">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#3B82F6]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter opgeslagen woorden..."
            className={`w-full pl-10 pr-9 py-2.5 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#3B82F6] shadow-xs transition-all ${inputBg}`}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Wissen"
              className={`absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg active:scale-95 transition-all ${bodyText} hover:${headingText}`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          <button
            onClick={() => setFilter('due')}
            className={`whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all active:scale-95 ${
              filter === 'due'
                ? 'bg-[#3B82F6] text-white border-[#3B82F6] shadow-xs'
                : isDarkMode
                  ? 'bg-[#151D2A]/80 text-slate-300 border-white/10 hover:bg-white/10'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            Te Herhalen ({stats.dueCount})
          </button>
          <button
            onClick={() => setFilter('struggling')}
            className={`whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all active:scale-95 ${
              filter === 'struggling'
                ? 'bg-[#3B82F6] text-white border-[#3B82F6] shadow-xs'
                : isDarkMode
                  ? 'bg-[#151D2A]/80 text-slate-300 border-white/10 hover:bg-white/10'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            Moeilijk
          </button>
          <button
            onClick={() => setFilter('mastered')}
            className={`whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all active:scale-95 ${
              filter === 'mastered'
                ? 'bg-[#3B82F6] text-white border-[#3B82F6] shadow-xs'
                : isDarkMode
                  ? 'bg-[#151D2A]/80 text-slate-300 border-white/10 hover:bg-white/10'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            Beheerst
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all active:scale-95 ${
              filter === 'all'
                ? 'bg-[#3B82F6] text-white border-[#3B82F6] shadow-xs'
                : isDarkMode
                  ? 'bg-[#151D2A]/80 text-slate-300 border-white/10 hover:bg-white/10'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            Alles ({words.length})
          </button>
        </div>
      </div>

      {/* Word Cards List */}
      {isLoading ? (
        <div className={`p-8 text-center text-xs ${bodyText}`}>
          Woorden laden...
        </div>
      ) : filteredWords.length === 0 ? (
        <div className={`rounded-2xl border p-8 text-center text-xs ${cardBg} ${bodyText}`}>
          <CheckCircle2 className="w-8 h-8 text-[#10B981] mx-auto mb-2" />
          <p className={`font-bold text-sm ${headingText}`}>
            Geen woorden in deze categorie
          </p>
          <p className="mt-1 leading-relaxed">
            {filter === 'due'
              ? 'Geweldig! Je hebt alle herhalingen voor vandaag afgerond.'
              : 'Voeg nieuwe woorden toe om je herhaallijst op te bouwen.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredWords.map((word) => {
            const isDueNow = new Date(word.next_review_at) <= new Date();
            return (
              <div
                key={word.id}
                onClick={() => onSelectVerbForInspection && onSelectVerbForInspection(word.infinitive)}
                className={`rounded-2xl border p-4 transition-all cursor-pointer group active:scale-98 hover:border-[#3B82F6]/50 ${cardBg}`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className={`font-bold text-base capitalize group-hover:text-[#3B82F6] transition-colors ${headingText}`}>
                        {word.infinitive}
                      </h4>
                      {isDueNow && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30">
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#10B981]"></span>
                          </span>
                          <span>Vandaag!</span>
                        </span>
                      )}
                    </div>
                    {word.notes && (
                      <p className={`text-xs mt-0.5 line-clamp-1 font-normal ${bodyText}`}>
                        {word.notes}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => handleDeleteWord(word.id, e)}
                      title="Verwijder uit Mijn Fouten"
                      className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors rounded-lg"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#3B82F6] transition-transform group-hover:translate-x-0.5" />
                  </div>
                </div>

                {/* Footer with Mastery & Stats */}
                <div className={`flex items-center justify-between mt-3 pt-2.5 border-t text-[10px] ${isDarkMode ? 'border-white/10' : 'border-slate-100'} ${bodyText}`}>
                  {/* Mastery 5-Dot Meter */}
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium">Niveau:</span>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((lvl) => (
                        <span
                          key={lvl}
                          className={`w-2.5 h-2.5 rounded-full transition-all ${
                            lvl <= word.mastery_level
                              ? lvl >= 4
                                ? 'bg-[#10B981]'
                                : 'bg-[#3B82F6]'
                              : isDarkMode
                                ? 'bg-white/10'
                                : 'bg-slate-200'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Practice Stats */}
                  <div className="flex items-center gap-2 font-medium">
                    <span>
                      {word.times_correct} / {word.times_practiced} correct
                    </span>
                    <span>•</span>
                    <span className={isDueNow ? 'text-[#10B981] font-semibold' : ''}>
                      {isDueNow ? 'Nu herhalen' : `Volgende: ${new Date(word.next_review_at).toLocaleDateString()}`}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
