import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  checkConjugation,
  type Person,
  type Tense,
  type CheckResult,
} from '@execution/verb_engine';
import {
  Brain,
  Play,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Sparkles,
  Search,
  ChevronRight,
  Crown,
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
}

// Default initial dataset for offline/unauthenticated mode
const INITIAL_DEMO_WORDS: SavedWord[] = [
  {
    id: 'demo-1',
    infinitive: 'leven',
    translation: 'to live',
    notes: 'NT2 valkuil: stem leef (v->f), verleden tijd leefde (v not in kofschip)',
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
    translation: 'to move house',
    notes: 'NT2 valkuil: z->s klankverschuiving, maar z niet in kofschip -> verhuisde',
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
    translation: 'to call (on phone)',
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
    translation: 'to answer',
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
    translation: 'to work',
    notes: "Regelmatig: 'k' zit in 't kofschip -> werkte, gewerkt",
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
}: MijnFoutenProps) {
  const [words, setWords] = useState<SavedWord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [filter, setFilter] = useState<'all' | 'due' | 'struggling' | 'mastered'>('due');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [newVerbInput, setNewVerbInput] = useState<string>('');
  const [isAddingVerb, setIsAddingVerb] = useState<boolean>(false);

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
    <div className="w-full space-y-4 text-left text-slate-100">
      {/* Header */}
      <header className="flex items-start justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-2xl bg-indigo-950/40 text-indigo-300 border border-indigo-500/30 mb-1.5 shadow-sm">
            <Brain className="w-3.5 h-3.5 text-indigo-400" />
            Spaced Repetition
          </span>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-100">
            Mijn Fouten
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Persoonlijke valkuilen en fouten herhalen met het Leitner-systeem.
          </p>
        </div>

        <button
          onClick={() => setIsAddingVerb(!isAddingVerb)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-600 via-indigo-500 to-indigo-600 hover:from-indigo-500 hover:to-indigo-400 text-white shadow-lg shadow-indigo-600/30 border border-indigo-400/30 transition-all active:scale-95 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Voeg Toe</span>
        </button>
      </header>

      {onOpenPaywall && (
        <button
          onClick={onOpenPaywall}
          className="w-full flex items-center justify-between p-3.5 rounded-2xl border border-indigo-500/20 backdrop-blur-2xl bg-indigo-950/20 hover:bg-indigo-950/30 shadow-2xl text-xs transition-all group active:scale-98"
        >
          <div className="flex items-center gap-2.5">
            <Crown className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="font-semibold text-slate-200">
              Pro: Onbeperkte herhaallijsten & AI Coach
            </span>
          </div>
          <span className="text-[11px] font-bold text-indigo-300 group-hover:text-indigo-200">
            €14.99 Lifetime →
          </span>
        </button>
      )}

      {/* Add Verb Inline Form */}
      {isAddingVerb && (
        <form
          onSubmit={handleAddNewWord}
          className="p-4 rounded-2xl border border-indigo-500/25 backdrop-blur-2xl bg-indigo-950/30 shadow-2xl space-y-2.5 animate-fadeIn"
        >
          <label className="block text-xs font-semibold text-slate-300">
            Nieuw werkwoord toevoegen aan je herhaallijst:
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={newVerbInput}
              onChange={(e) => setNewVerbInput(e.target.value)}
              placeholder="bv. verbazen, antwoorden, meenemen..."
              className="flex-1 px-3.5 py-2.5 text-xs backdrop-blur-xl bg-indigo-950/40 border border-indigo-500/25 text-slate-100 placeholder:text-slate-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 font-medium transition-all"
              autoFocus
            />
            <button
              type="submit"
              className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-600/30 border border-indigo-400/30 active:scale-95 transition-all shrink-0"
            >
              Opslaan
            </button>
          </div>
        </form>
      )}

      {/* Interactive Practice Mode Overlay / Card: Frosted Leitner SRS Review Card */}
      {isPracticing ? (
        <div className="rounded-2xl border border-indigo-500/25 backdrop-blur-2xl bg-indigo-950/20 shadow-2xl p-5 sm:p-6 space-y-5 transition-colors relative overflow-hidden">
          <div className="flex items-center justify-between pb-3 border-b border-indigo-500/15">
            <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>Kaart {practiceIndex + 1} van {practiceQueue.length}</span>
            </span>
            <button
              onClick={() => setIsPracticing(false)}
              className="text-xs text-slate-400 hover:text-slate-100 font-semibold px-2 py-1 rounded-lg hover:bg-indigo-900/40 transition-colors"
            >
              Sluiten ✕
            </button>
          </div>

          {/* Active Card Content */}
          {practiceQueue[practiceIndex] && (
            <div className="space-y-4">
              <div className="text-center py-7 px-4 backdrop-blur-xl bg-indigo-950/40 rounded-2xl border border-indigo-500/20 relative shadow-xl overflow-hidden">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                  Infinitief
                </span>
                <h3 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-100 mt-1 capitalize">
                  {practiceQueue[practiceIndex].infinitive}
                </h3>
                {practiceQueue[practiceIndex].translation && (
                  <p className="text-xs text-slate-400 mt-1 font-medium">
                    ({practiceQueue[practiceIndex].translation})
                  </p>
                )}
                <div className="mt-3.5 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full backdrop-blur-xl bg-indigo-950/60 border border-indigo-500/30 text-indigo-200 text-xs font-semibold shadow-sm">
                  <span>{practiceChallenge.prompt}</span>
                </div>
              </div>

              {/* Practice Input Form */}
              {!hasEvaluated ? (
                <form onSubmit={handleEvaluatePractice} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Typ jouw antwoord:
                    </label>
                    <input
                      type="text"
                      value={practiceAnswer}
                      onChange={(e) => setPracticeAnswer(e.target.value)}
                      placeholder="Typ hier de juiste vorm..."
                      autoFocus
                      className="w-full px-4 py-3 backdrop-blur-xl bg-indigo-950/40 border border-indigo-500/25 rounded-xl text-sm font-semibold text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 shadow-xl transition-all"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={!practiceAnswer.trim()}
                      className="flex-1 py-2.5 bg-gradient-to-r from-indigo-600 via-indigo-500 to-indigo-600 hover:from-indigo-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 border border-indigo-400/30 transition-all active:scale-95"
                    >
                      Controleer Vervoeging
                    </button>
                    <button
                      type="button"
                      onClick={() => setHasEvaluated(true)}
                      className="px-4 py-2.5 backdrop-blur-xl bg-indigo-950/40 hover:bg-indigo-900/40 text-slate-300 hover:text-slate-100 font-semibold text-xs rounded-xl border border-indigo-500/20 shadow-sm transition-all active:scale-95"
                    >
                      Toon Antwoord
                    </button>
                  </div>
                </form>
              ) : (
                /* Evaluated Card & Feedback */
                <div className="space-y-4">
                  {practiceDiagnostic ? (
                    <div
                      className={`p-4 rounded-xl backdrop-blur-xl border text-xs shadow-xl ${
                        practiceDiagnostic.isCorrect
                          ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-200 shadow-[0_0_20px_rgba(16,185,129,0.18)]'
                          : 'bg-rose-950/40 border-rose-500/30 text-rose-200 shadow-[0_0_20px_rgba(244,63,94,0.18)]'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        {practiceDiagnostic.isCorrect ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                        )}
                        <div className="space-y-1">
                          <p className="font-bold text-xs">
                            {practiceDiagnostic.isCorrect
                              ? 'Helemaal goed!'
                              : 'Helaas, foute vervoeging'}
                          </p>
                          <p className="leading-relaxed text-[11px] font-normal">{practiceDiagnostic.feedback}</p>
                          {!practiceDiagnostic.isCorrect && (
                            <p className="mt-1 font-bold text-slate-100 text-xs">
                              Juiste antwoord:{' '}
                              <span className="font-mono bg-indigo-950/80 px-2.5 py-0.5 rounded-lg border border-rose-500/40 text-xs font-bold text-slate-100">
                                {practiceDiagnostic.expected.join(' of ')}
                              </span>
                            </p>
                          )}
                          {practiceDiagnostic.correctionTip && (
                            <p className="mt-1 text-[11px] text-slate-300">
                              💡 Tip: {practiceDiagnostic.correctionTip}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3.5 backdrop-blur-xl bg-indigo-950/30 border border-indigo-500/20 rounded-xl text-xs text-slate-300 text-center font-medium">
                      Bekijk de regel en beoordeel je herinnering hieronder:
                    </div>
                  )}

                  {/* Leitner Spaced Repetition Rating Buttons */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-2 text-center uppercase tracking-wider">
                      Hoe ging dit woord? (Selecteer Leitner-interval):
                    </label>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <button
                        onClick={() => handleApplyRating('again')}
                        className="py-2.5 px-1 backdrop-blur-xl bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 border border-rose-500/30 rounded-xl font-bold text-xs flex flex-col items-center active:scale-95 transition-all shadow-sm"
                      >
                        <span>Opnieuw</span>
                        <span className="text-[10px] opacity-75 mt-0.5">Vandaag</span>
                      </button>
                      <button
                        onClick={() => handleApplyRating('hard')}
                        className="py-2.5 px-1 backdrop-blur-xl bg-amber-950/40 hover:bg-amber-900/50 text-amber-300 border border-amber-500/30 rounded-xl font-bold text-xs flex flex-col items-center active:scale-95 transition-all shadow-sm"
                      >
                        <span>Moeilijk</span>
                        <span className="text-[10px] opacity-75 mt-0.5">1-2 d</span>
                      </button>
                      <button
                        onClick={() => handleApplyRating('good')}
                        className="py-2.5 px-1 backdrop-blur-xl bg-indigo-950/40 hover:bg-indigo-900/50 text-indigo-300 border border-indigo-500/30 rounded-xl font-bold text-xs flex flex-col items-center active:scale-95 transition-all shadow-sm"
                      >
                        <span>Goed</span>
                        <span className="text-[10px] opacity-75 mt-0.5">4 d</span>
                      </button>
                      <button
                        onClick={() => handleApplyRating('easy')}
                        className="py-2.5 px-1 backdrop-blur-xl bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 border border-emerald-500/30 rounded-xl font-bold text-xs flex flex-col items-center active:scale-95 transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                      >
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
        <div className="rounded-2xl backdrop-blur-2xl bg-indigo-950/20 border border-indigo-500/15 shadow-2xl p-5 sm:p-6 transition-colors">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
                </span>
                <span className="text-slate-400 text-xs font-bold uppercase tracking-wider block">
                  Vandaag te herhalen
                </span>
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-extrabold tracking-tight text-slate-100">
                  {stats.dueCount}
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  woorden klaar voor drill
                </span>
              </div>
            </div>

            <button
              onClick={startPractice}
              disabled={practiceQueue.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 via-indigo-500 to-indigo-600 hover:from-indigo-500 hover:to-indigo-400 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 border border-indigo-400/30 transition-all active:scale-95"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Start Drill</span>
            </button>
          </div>

          {/* Quick Progress Bar with Neon Highlights */}
          <div className="mt-4 pt-3.5 border-t border-indigo-500/15 grid grid-cols-3 gap-2 text-xs">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                Totaal opgeslagen:
              </span>
              <span className="font-bold text-slate-100">
                {stats.totalCount} werkwoorden
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                Beheerst (Niv 4-5):
              </span>
              <span className="font-bold text-emerald-300">
                {stats.masteredCount}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                Nauwkeurigheid:
              </span>
              <span className="font-bold text-indigo-300">
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
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter opgeslagen woorden..."
            className="w-full pl-10 pr-4 py-2.5 backdrop-blur-2xl bg-indigo-950/20 border border-indigo-500/15 rounded-xl text-xs font-medium text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 shadow-xl transition-all"
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          <button
            onClick={() => setFilter('due')}
            className={`whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all active:scale-95 ${
              filter === 'due'
                ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white border-indigo-400/80 shadow-md shadow-indigo-600/30'
                : 'backdrop-blur-2xl bg-indigo-950/20 text-slate-300 border-indigo-500/15 hover:bg-indigo-900/40 hover:text-slate-100'
            }`}
          >
            Te Herhalen ({stats.dueCount})
          </button>
          <button
            onClick={() => setFilter('struggling')}
            className={`whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all active:scale-95 ${
              filter === 'struggling'
                ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white border-indigo-400/80 shadow-md shadow-indigo-600/30'
                : 'backdrop-blur-2xl bg-indigo-950/20 text-slate-300 border-indigo-500/15 hover:bg-indigo-900/40 hover:text-slate-100'
            }`}
          >
            Moeilijk
          </button>
          <button
            onClick={() => setFilter('mastered')}
            className={`whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all active:scale-95 ${
              filter === 'mastered'
                ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white border-indigo-400/80 shadow-md shadow-indigo-600/30'
                : 'backdrop-blur-2xl bg-indigo-950/20 text-slate-300 border-indigo-500/15 hover:bg-indigo-900/40 hover:text-slate-100'
            }`}
          >
            Beheerst
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all active:scale-95 ${
              filter === 'all'
                ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white border-indigo-400/80 shadow-md shadow-indigo-600/30'
                : 'backdrop-blur-2xl bg-indigo-950/20 text-slate-300 border-indigo-500/15 hover:bg-indigo-900/40 hover:text-slate-100'
            }`}
          >
            Alles ({words.length})
          </button>
        </div>
      </div>

      {/* Word Cards List with Frosted Leitner SRS review cards and neon due indicators */}
      {isLoading ? (
        <div className="p-8 text-center text-xs text-slate-400">
          Woorden laden uit Supabase...
        </div>
      ) : filteredWords.length === 0 ? (
        <div className="rounded-2xl backdrop-blur-2xl bg-indigo-950/20 border border-indigo-500/15 shadow-2xl p-8 text-center text-slate-400 text-xs">
          <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
          <p className="font-bold text-slate-100 text-sm">
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
                className="rounded-2xl backdrop-blur-2xl bg-indigo-950/20 border border-indigo-500/15 hover:border-indigo-500/30 hover:bg-indigo-950/30 shadow-2xl p-4 transition-all cursor-pointer group active:scale-98"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-slate-100 text-base capitalize group-hover:text-indigo-300 transition-colors">
                        {word.infinitive}
                      </h4>
                      {isDueNow && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold backdrop-blur-xl bg-emerald-950/40 text-emerald-300 border border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.2)]">
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400"></span>
                          </span>
                          <span>Vandaag!</span>
                        </span>
                      )}
                    </div>
                    {word.notes && (
                      <p className="text-xs text-slate-400 mt-0.5 line-clamp-1 font-normal">
                        {word.notes}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => handleDeleteWord(word.id, e)}
                      title="Verwijder uit Mijn Fouten"
                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition-colors rounded-lg"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-300 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </div>

                {/* Footer with Mastery & Stats */}
                <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-indigo-500/15 text-[10px] text-slate-400">
                  {/* Mastery 5-Dot Meter with Neon Highlights */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400 font-medium">Niveau:</span>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((lvl) => (
                        <span
                          key={lvl}
                          className={`w-2.5 h-2.5 rounded-full transition-all ${
                            lvl <= word.mastery_level
                              ? lvl >= 4
                                ? 'bg-emerald-400 shadow-[0_0_8px_#10B981]'
                                : 'bg-indigo-400 shadow-[0_0_8px_#6366F1]'
                              : 'bg-indigo-950/80 border border-indigo-500/25'
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
                    <span className="text-slate-500">•</span>
                    <span className={isDueNow ? 'text-emerald-300 font-semibold' : ''}>
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
