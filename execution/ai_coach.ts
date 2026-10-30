/**
 * Kofschip AI Coach & Camera OCR Scan Integration
 *
 * File: /execution/ai_coach.ts
 *
 * Integration with Google Gemini Vision API & Flash to:
 * 1. Perform camera photo OCR scan analysis on Dutch text
 * 2. Extract verbs, identify conjugations and errors
 * 3. Cross-validate with deterministic rule engine (/execution/verb_engine.ts)
 * 4. Generate native-language grammar coaching explanations (Turkish, English, Arabic, etc.)
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  deriveStem,
  checkConjugation,
  isIrregular,
  getIrregularInfo,
  KOFSCHIP_CONSONANTS,
} from './verb_engine';

// ============================================================================
// Types
// ============================================================================

export type RuleCategory =
  | 'kofschip'
  | 'v_z_shift'
  | 'separable'
  | 'auxiliary'
  | 'irregular'
  | 'spelling'
  | 'correct';

export interface DetectedVerb {
  verb: string;
  infinitive: string;
  tense?: string;
  person?: string;
  isCorrect: boolean;
  correction?: string;
  ruleExplanation: string;
  ruleCategory: RuleCategory;
}

export interface ScanAnalysisResult {
  success: boolean;
  rawText: string;
  sentences: string[];
  detectedVerbs: DetectedVerb[];
  overallCoaching: string;
  nativeLanguage: string;
  isMock?: boolean;
  error?: string;
}

export interface ScanPhotoParams {
  /** Base64 image data (with or without 'data:image/...;base64,' prefix) */
  imageBase64: string;
  /** Image MIME type, default 'image/jpeg' */
  mimeType?: string;
  /** Preferred native language code or name (e.g. 'tr', 'en', 'ar', 'uk', 'Turkish') */
  nativeLanguage?: string;
  /** Optional Gemini API key override */
  apiKey?: string;
  /** Optional Gemini model name */
  modelName?: string;
}

export interface GrammarCoachParams {
  verb: string;
  infinitive?: string;
  userAnswer?: string;
  expected?: string;
  sentence?: string;
  nativeLanguage?: string;
  apiKey?: string;
}

export interface CoachExplanationResult {
  explanation: string;
  ruleCategory: RuleCategory;
  tips: string[];
  correctForm: string;
  exampleSentence: string;
}

// ============================================================================
// Language Helpers
// ============================================================================

export const NATIVE_LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  ar: 'العربية (Arabic)',
  tr: 'Türkçe (Turkish)',
  uk: 'Українська (Ukrainian)',
  fa: 'فارسی (Persian)',
  ti: 'ትግርኛ (Tigrinya)',
  pl: 'Polski (Polish)',
  es: 'Español (Spanish)',
  pt: 'Português (Portuguese)',
  zh: '中文 (Chinese)',
  ru: 'Русский (Russian)',
  de: 'Deutsch (German)',
  fr: 'Français (French)',
  id: 'Bahasa Indonesia (Indonesian)',
  nl: 'Nederlands (Dutch)',
};

export function getNativeLanguageLabel(codeOrName: string = 'en'): string {
  const normalized = codeOrName.trim().toLowerCase();
  if (NATIVE_LANGUAGE_NAMES[normalized]) {
    return NATIVE_LANGUAGE_NAMES[normalized];
  }
  for (const [code, label] of Object.entries(NATIVE_LANGUAGE_NAMES)) {
    if (label.toLowerCase().includes(normalized)) return label;
    if (code === normalized) return label;
  }
  return codeOrName;
}

/**
 * Resolves Gemini API Key from Vite env or process.env or argument.
 */
export function getGeminiApiKey(explicitKey?: string): string {
  if (explicitKey && explicitKey.trim()) return explicitKey.trim();

  // Vite environment
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY) {
    const key = import.meta.env.VITE_GEMINI_API_KEY;
    if (key && key !== 'your-gemini-api-key-here') return key;
  }

  // Node / Process environment fallback
  const globalProc = (globalThis as unknown as { process?: { env?: Record<string, string> } }).process;
  if (globalProc?.env) {
    const key = globalProc.env.VITE_GEMINI_API_KEY || globalProc.env.GEMINI_API_KEY;
    if (key && key !== 'your-gemini-api-key-here') return key;
  }

  return '';
}

// ============================================================================
// Multi-language Coaching Templates for Instant/Fallback Explanations
// ============================================================================

const LOCALIZED_COACHING: Record<
  string,
  Record<
    RuleCategory,
    {
      title: string;
      advice: (verb: string, inf: string, correct: string) => string;
      tip: string;
    }
  >
> = {
  nl: {
    v_z_shift: {
      title: "v → f / z → s Klankverschuiving Valkuil",
      advice: (v, inf, c) =>
        `Let op: Bij '${inf}' ondergaat de stam een klankverschuiving (v→f of z→s). De 't kofschip-regel wordt echter beoordeeld op de ORIGINELE medeklinker van het hele werkwoord (v of z). Omdat 'v' en 'z' NIET in 't kofschip zitten, krijgt de verleden tijd '-de', nooit '-te': '${c}' (niet '${v}')!`,
      tip: "Kijk altijd naar de medeklinker van het infinitief: 'v' en 'z' zijn stemhebbend en krijgen altijd -de / -den.",
    },
    kofschip: {
      title: "'t Kofschip Regel",
      advice: (_v, inf, c) =>
        `De ruwe stam van '${inf}' eindigt op een van de medeklinkers van 't kofschip (t, k, f, s, ch, p). Daarom krijgt de verleden tijd '-te / -ten' en eindigt het voltooid deelwoord op '-t': '${c}'.`,
      tip: "Medeklinker in 't kofschip betekent: -te en -t.",
    },
    separable: {
      title: "Scheidbaar Werkwoord",
      advice: (_v, inf, c) =>
        `'${inf}' is een scheidbaar werkwoord. In het voltooid deelwoord komt 'ge-' tussen het voorvoegsel en de stam te staan: '${c}'.`,
      tip: "'ge-' staat altijd tussen het voorvoegsel en de stam (bijv. opgebeld, niet geopbeld).",
    },
    auxiliary: {
      title: "Hulpwerkwoord: Hebben vs. Zijn",
      advice: (_v, inf, c) =>
        `'${inf}' geeft een beweging met richting of een verandering van toestand aan en gebruikt daarom het hulpwerkwoord 'zijn': '${c}'.`,
      tip: "Verandering van toestand of gerichte beweging gebruikt 'zijn'.",
    },
    irregular: {
      title: "Onregelmatig Werkwoord",
      advice: (_v, inf, c) =>
        `'${inf}' is een onregelmatig (sterk) werkwoord met een klinkerverandering. De juiste vorm is: '${c}'.`,
      tip: "Onregelmatige werkwoorden veranderen van klank en moeten uit het hoofd geleerd worden.",
    },
    spelling: {
      title: "Spelling- en Stamregels",
      advice: (_v, inf, c) =>
        `Bij het vormen van de stam van '${inf}' moet een open lettergreep verdubbeld worden om de lange klinker te behouden: '${c}'.`,
      tip: "Behoud de lange klinker door deze te verdubbelen in gesloten lettergrepen (bijv. maken -> maak).",
    },
    correct: {
      title: "Uitstekend! Juiste Vervoeging",
      advice: (v, inf) =>
        `De vorm '${v}' voor het werkwoord '${inf}' is helemaal correct volgens de Nederlandse grammaticaregels.`,
      tip: "Goed gedaan! Blijf zo doorgaan.",
    },
  },
  tr: {
    v_z_shift: {
      title: "v → f / z → s Klankverschuiving Valkuil",
      advice: (v, inf, c) =>
        `Dikkat: '${inf}' fiilinde v/z sessiz harf dönüşümü vardır. Ancak 't kofschip kuralı daima kökün orijinal harfine (v veya z) göre uygulanır. 'v' ve 'z' harfleri 't kofschip kuralında YER ALMAZ. Bu yüzden geçmiş zaman eki '-te' değil '-de' olmalıdır: '${c}' (asla '${v}' değil!).`,
      tip: "Kökün sonundaki f veya s harfi orijinalde v veya z ise, kofschip kuralına girmez, daima -de / -den alır.",
    },
    kofschip: {
      title: "'t Kofschip Kuralı",
      advice: (_v, inf, c) =>
        `'${inf}' fiilinin kökünün son harfi 't kofschip (t, k, f, s, ch, p) harflerinden biridir. Bu nedenle geçmiş zamanda '-te / -ten', bitmiş zamanda '-t' alır: '${c}'.`,
      tip: "Sessiz harf kofschip'te varsa: -te / -ten ve -t.",
    },
    separable: {
      title: "Ayrılabilir Fiil (Scheidbaar Werkwoord)",
      advice: (_v, inf, c) =>
        `'${inf}' ayrılabilir bir fiildir. Ana cümlede ön ek cümlenin en sonuna gider; ortaçta ise 'ge-' ön ek ile kök arasına girer: '${c}'.`,
      tip: "'ge-' her zaman ayrılabilir ön ek ile fiil kökünün arasına girer (örnek: opgebeld).",
    },
    auxiliary: {
      title: "Hebben vs. Zijn Yardımcı Fiil Seçimi",
      advice: (_v, inf, c) =>
        `'${inf}' fiili durum veya yön değişikliği bildirdiği için (ya da zijn/blijven/worden olduğu için) 'zijn' yardımcı fiili ile kullanılır: '${c}'.`,
      tip: "Bir hedefe doğru hareket veya durum değişimi varsa daima 'zijn' seçilir.",
    },
    irregular: {
      title: "Düzensiz Fiil (Sterk Werkwoord)",
      advice: (_v, inf, c) =>
        `'${inf}' düzensiz (güçlü) bir fiildir. 't Kofschip kurallarına uymaz, sesli harf değişir. Doğru şekli: '${c}'.`,
      tip: "Düzensiz fiillerin geçmiş zaman ve ortaç halleri ezberlenmelidir.",
    },
    spelling: {
      title: "Hece ve Yazım Kuralı (Spelling)",
      advice: (_v, inf, c) =>
        `'${inf}' kökü türetilirken açık hecede ünlü harf çiftlenir veya çift ünsüz teke indirilir. Doğru şekli: '${c}'.`,
      tip: "Uzun ünlü sesini korumak için tek heceli kökte ünlü çift yazılır (ör. maken -> maak).",
    },
    correct: {
      title: "Harika! Doğru Vervoeging",
      advice: (v, inf) =>
        `'${inf}' fiilinin '${v}' çekimi tamamen doğrudur. Kurallara uygun bir şekilde kullanılmış.`,
      tip: "Tebrikler! Doğru kullanımı pekiştirdiniz.",
    },
  },
  ar: {
    v_z_shift: {
      title: "فخ تحول الحروف v → f / z → s",
      advice: (v, inf, c) =>
        `انتبه: الفعل '${inf}' يشهد تحولاً في الحرف (v إلى f أو z إلى s). لكن قاعدة 't kofschip تعتمد على الحرف الأصلي قبل التحول (v أو z). بما أن الحرفين v و z ليسا من حروف 't kofschip، تأخذ صيغة الماضي اللاحقة '-de' وليس '-te': '${c}' (وليس '${v}')!`,
      tip: "إذا كان أصل الحرف v أو z، فاللاحقة دائماً هي -de أو -den.",
    },
    kofschip: {
      title: "قاعدة 't Kofschip",
      advice: (_v, inf, c) =>
        `ينتهي جذر الفعل '${inf}' بأحد حروف 't kofschip (t, k, f, s, ch, p). لذلك تأخذ صيغة الماضي '-te / -ten' واسم المفعول '-t': '${c}'.`,
      tip: "إذا كان الحرف في kofschip: استخدم -te و -t.",
    },
    separable: {
      title: "الأفعال القابلة للانفصال (Scheidbare Werkwoorden)",
      advice: (_v, inf, c) =>
        `الفعل '${inf}' فعل قابل للانفصال. في اسم المفعول تأتي 'ge-' بين البادئة والجذر: '${c}'.`,
      tip: "تدخل 'ge-' بين البادئة وجذر الفعل دائماً (مثل opgebeld).",
    },
    auxiliary: {
      title: "اختيار الفعل المساعد (Hebben أو Zijn)",
      advice: (_v, inf, c) =>
        `الفعل '${inf}' يعبر عن تغير في المكان نحو وجهة محددة أو تغير في الحالة، لذا يتطلب الفعل المساعد 'zijn': '${c}'.`,
      tip: "الحركة نحو وجهة محددة تأخذ zijn دائماً.",
    },
    irregular: {
      title: "الأفعال الشاذة (Sterke Werkwoorden)",
      advice: (_v, inf, c) =>
        `الفعل '${inf}' فعل شاذ لا يخضع لقاعدة kofschip، بل يتغير حرف العلة. الصيغة الصحيحة هي: '${c}'.`,
      tip: "الأفعال الشاذة تحفظ تصاريفها غيباً.",
    },
    spelling: {
      title: "قواعد الإملاء ومضاعفة الحروف",
      advice: (_v, inf, c) =>
        `عند اشتقاق جذر '${inf}'، تتضاعف حركة العلة في المقطع المفتوح. الصيغة الصحيحة: '${c}'.`,
      tip: "حافظ على نطق الصوت الطويل بمضاعفة حرف العلة (مثل maken -> maak).",
    },
    correct: {
      title: "ممتاز! تصريف صحيح",
      advice: (v, inf) =>
        `تصريف الفعل '${inf}' بالصيغة '${v}' صحيح تماماً ومطابق للقواعد.`,
      tip: "أحسنت! استمر على هذا النحو.",
    },
  },
  en: {
    v_z_shift: {
      title: "v → f / z → s Voiced Shift Trap",
      advice: (v, inf, c) =>
        `Watch out: In '${inf}', the stem undergoes a voiced consonant shift (v->f or z->s). However, the 't kofschip rule is evaluated on the ORIGINAL consonant before the shift. Because 'v' and 'z' are NOT in 't kofschip, past tense takes '-de', never '-te': '${c}' (not '${v}')!`,
      tip: "Always check the infinitive consonant: 'v' and 'z' are voiced, taking -de / -den.",
    },
    kofschip: {
      title: "'t Kofschip Rule",
      advice: (_v, inf, c) =>
        `The raw stem of '${inf}' ends in one of the voiceless consonants of 't kofschip (t, k, f, s, ch, p). Thus past tense takes '-te / -ten' and participle ends in '-t': '${c}'.`,
      tip: "Voiceless kofschip consonants trigger -te and -t.",
    },
    separable: {
      title: "Separable Verb (Scheidbaar Werkwoord)",
      advice: (_v, inf, c) =>
        `'${inf}' is a separable verb. In past participles, 'ge-' is placed between the separable prefix and the base stem: '${c}'.`,
      tip: "'ge-' sits between the prefix and the stem (e.g. opgebeld, not geopbeld).",
    },
    auxiliary: {
      title: "Hebben vs. Zijn Auxiliary Selection",
      advice: (_v, inf, c) =>
        `'${inf}' indicates movement towards a destination or a change of state, requiring the auxiliary 'zijn': '${c}'.`,
      tip: "Change of state or directed movement uses 'zijn'.",
    },
    irregular: {
      title: "Irregular Strong Verb",
      advice: (_v, inf, c) =>
        `'${inf}' is an irregular strong verb with a vowel shift. Correct form: '${c}'.`,
      tip: "Strong verbs change vowel sounds and must be memorized.",
    },
    spelling: {
      title: "Dutch Spelling & Stem Rules",
      advice: (_v, inf, c) =>
        `In deriving the stem for '${inf}', open syllable vowels must be doubled to preserve the long vowel sound: '${c}'.`,
      tip: "Keep the long vowel open by doubling it in closed syllables (e.g. maken -> maak).",
    },
    correct: {
      title: "Well Done! Correct Conjugation",
      advice: (v, inf) =>
        `The form '${v}' for verb '${inf}' is completely correct and follows all Dutch grammar rules.`,
      tip: "Great work! Keep practicing.",
    },
  },
};

/**
 * Returns localized rule explanation for a given rule category.
 */
export function getLocalizedCoaching(
  category: RuleCategory,
  verb: string,
  infinitive: string,
  correctForm: string,
  langCode: string = 'nl'
): { title: string; advice: string; tip: string } {
  const norm = langCode.toLowerCase().slice(0, 2);
  const langDict = LOCALIZED_COACHING[norm] || LOCALIZED_COACHING.nl || LOCALIZED_COACHING.en;
  const rule = langDict[category] || langDict.kofschip;
  return {
    title: rule.title,
    advice: rule.advice(verb, infinitive, correctForm),
    tip: rule.tip,
  };
}

// ============================================================================
// Deterministic Text Analysis & Fallback Engine
// ============================================================================

/**
 * Deterministically analyzes Dutch text (for preset/sample text scenarios only).
 * Used for the quick-test preset buttons, NOT for real camera scans.
 * Real camera scans always go through the Gemini Vision API (scanPhotoAndCoach).
 */
export function analyzeDutchTextDeterministically(
  text: string,
  nativeLanguage: string = 'en'
): ScanAnalysisResult {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const detectedVerbs: DetectedVerb[] = [];

  // Match common high-frequency NT2 verbs & pitfall patterns
  const tokens = text.split(/[\s,.;:!?()"]+/).filter((t) => t.length > 2);

  for (const token of tokens) {
    const lower = token.toLowerCase();

    // ── Hardcoded NT2 pitfall patterns ──────────────────────────────────────

    // v→f pitfall: leefte / leeffte (incorrect past of leven)
    if (lower === 'leefte' || lower === 'leeffte') {
      const coach = getLocalizedCoaching('v_z_shift', lower, 'leven', 'leefde', nativeLanguage);
      detectedVerbs.push({
        verb: token,
        infinitive: 'leven',
        tense: 'past',
        isCorrect: false,
        correction: 'leefde',
        ruleExplanation: coach.advice,
        ruleCategory: 'v_z_shift',
      });
      continue;
    }

    // z→s pitfall: reiste / reisste (incorrect past of reizen)
    if (lower === 'reiste' || lower === 'reisste') {
      const coach = getLocalizedCoaching('v_z_shift', lower, 'reizen', 'reisde', nativeLanguage);
      detectedVerbs.push({
        verb: token,
        infinitive: 'reizen',
        tense: 'past',
        isCorrect: false,
        correction: 'reisde',
        ruleExplanation: coach.advice,
        ruleCategory: 'v_z_shift',
      });
      continue;
    }

    // Separable participle mistake: geopbeld (should be opgebeld)
    if (lower === 'geopbeld') {
      const coach = getLocalizedCoaching('separable', lower, 'opbellen', 'opgebeld', nativeLanguage);
      detectedVerbs.push({
        verb: token,
        infinitive: 'opbellen',
        tense: 'pastParticiple',
        isCorrect: false,
        correction: 'opgebeld',
        ruleExplanation: coach.advice,
        ruleCategory: 'separable',
      });
      continue;
    }

    // Wrong kofschip past tense: werkde, kookde
    if (lower === 'werkde' || lower === 'kookde') {
      const inf = lower.startsWith('werk') ? 'werken' : 'koken';
      const corr = lower.startsWith('werk') ? 'werkte' : 'kookte';
      const coach = getLocalizedCoaching('kofschip', lower, inf, corr, nativeLanguage);
      detectedVerbs.push({
        verb: token,
        infinitive: inf,
        tense: 'past',
        isCorrect: false,
        correction: corr,
        ruleExplanation: coach.advice,
        ruleCategory: 'kofschip',
      });
      continue;
    }

    // ── Correct known verb forms ─────────────────────────────────────────────
    if (lower === 'werkte' || lower === 'gewerkt') {
      const coach = getLocalizedCoaching('correct', lower, 'werken', lower, nativeLanguage);
      detectedVerbs.push({
        verb: token,
        infinitive: 'werken',
        tense: lower === 'werkte' ? 'past' : 'pastParticiple',
        isCorrect: true,
        correction: lower,
        ruleExplanation: coach.advice,
        ruleCategory: 'correct',
      });
      continue;
    }

    if (lower === 'leefde' || lower === 'geleefd') {
      const coach = getLocalizedCoaching('correct', lower, 'leven', lower, nativeLanguage);
      detectedVerbs.push({
        verb: token,
        infinitive: 'leven',
        tense: lower === 'leefde' ? 'past' : 'pastParticiple',
        isCorrect: true,
        correction: lower,
        ruleExplanation: coach.advice,
        ruleCategory: 'correct',
      });
      continue;
    }

    if (lower === 'reisde' || lower === 'gereisd') {
      const coach = getLocalizedCoaching('correct', lower, 'reizen', lower, nativeLanguage);
      detectedVerbs.push({
        verb: token,
        infinitive: 'reizen',
        tense: lower === 'reisde' ? 'past' : 'pastParticiple',
        isCorrect: true,
        correction: lower,
        ruleExplanation: coach.advice,
        ruleCategory: 'correct',
      });
      continue;
    }

    if (lower === 'opgebeld') {
      const coach = getLocalizedCoaching('correct', lower, 'opbellen', lower, nativeLanguage);
      detectedVerbs.push({
        verb: token,
        infinitive: 'opbellen',
        tense: 'pastParticiple',
        isCorrect: true,
        correction: lower,
        ruleExplanation: coach.advice,
        ruleCategory: 'correct',
      });
      continue;
    }

    if (lower === 'verhuisde' || lower === 'verhuisd') {
      const coach = getLocalizedCoaching('correct', lower, 'verhuizen', lower, nativeLanguage);
      detectedVerbs.push({
        verb: token,
        infinitive: 'verhuizen',
        tense: lower === 'verhuisde' ? 'past' : 'pastParticiple',
        isCorrect: true,
        correction: lower,
        ruleExplanation: coach.advice,
        ruleCategory: 'correct',
      });
      continue;
    }

    if (lower === 'gebleven') {
      const coach = getLocalizedCoaching('irregular', lower, 'blijven', lower, nativeLanguage);
      detectedVerbs.push({
        verb: token,
        infinitive: 'blijven',
        tense: 'pastParticiple',
        isCorrect: true,
        correction: lower,
        ruleExplanation: coach.advice,
        ruleCategory: 'irregular',
      });
      continue;
    }

    // ── Irregular verb detection ─────────────────────────────────────────────
    // Check irregular verbs
    if (isIrregular(lower)) {
      const info = getIrregularInfo(lower);
      const coach = getLocalizedCoaching('irregular', lower, lower, lower, nativeLanguage);
      detectedVerbs.push({
        verb: token,
        infinitive: lower,
        tense: 'infinitive',
        isCorrect: true,
        correction: lower,
        ruleExplanation: `${coach.advice} (Hulpww.: ${info?.auxiliary})`,
        ruleCategory: 'irregular',
      });
    }
  }

  // Deduplicate by verb word
  const seen = new Set<string>();
  const uniqueVerbs = detectedVerbs.filter((v) => {
    const key = v.verb.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const langLabel = getNativeLanguageLabel(nativeLanguage);
  const incorrectCount = uniqueVerbs.filter((v) => !v.isCorrect).length;
  const overallCoaching =
    incorrectCount > 0
      ? `AI Coach (${langLabel}): ${incorrectCount} valkuil(en) gedetecteerd. Let op 't kofschip en de v→f / z→s klankverschuiving!`
      : `AI Coach (${langLabel}): Uitstekend! De gedetecteerde werkwoorden volgen de Nederlandse grammaticaregels correct.`;

  return {
    success: true,
    rawText: text,
    sentences: sentences.length > 0 ? sentences : [text],
    detectedVerbs: uniqueVerbs,
    overallCoaching,
    nativeLanguage,
    isMock: true,
  };
}

// ============================================================================
// Core Gemini OCR & Coaching Implementation
// ============================================================================

/**
 * Strips markdown code block formatting (e.g. ```json ... ```) from Gemini responses.
 */
function cleanJsonOutput(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  return cleaned.trim();
}

/**
 * Performs AI Camera Photo OCR Scan and Native Language Coaching using Gemini API.
 */
export async function scanPhotoAndCoach(
  params: ScanPhotoParams
): Promise<ScanAnalysisResult> {
  const {
    imageBase64,
    mimeType = 'image/jpeg',
    nativeLanguage = 'en',
    apiKey: explicitKey,
    modelName = 'gemini-1.5-flash',
  } = params;

  const apiKey = getGeminiApiKey(explicitKey);
  const langLabel = getNativeLanguageLabel(nativeLanguage);

  // If no Gemini API key is configured, return an empty result with an error message
  if (!apiKey) {
    console.warn('[ai_coach] No Gemini API key provided. Cannot perform real OCR scan.');
    return {
      success: false,
      rawText: '',
      sentences: [],
      detectedVerbs: [],
      overallCoaching: '',
      nativeLanguage,
      isMock: false,
      error:
        'Geen Gemini API-sleutel geconfigureerd. Voeg VITE_GEMINI_API_KEY toe aan je .env bestand om echte camera-scans te activeren.',
    };
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    });

    // Strip data URI scheme if present
    const cleanBase64 = imageBase64.replace(/^data:[a-zA-Z0-9/+-]+;base64,/, '');

    const prompt = `You are Kofschip AI Coach, an expert Dutch NT2 language tutor.
Your task is to analyze Dutch text in this photo for an NT2 language student (A1–B2 level).

INSTRUCTIONS:
1. Extract all Dutch text visible in the image verbatim ("rawText").
2. Break the text into individual sentences ("sentences").
3. Detect every conjugated verb, past participle, or verbal construct.
4. For each verb:
   - Identify the infinitive form.
   - Determine the tense (e.g. "present", "past", "perfect", "pastParticiple").
   - Check if the conjugation is grammatically correct (isCorrect: true/false).
   - If incorrect, provide the exact correct spelling ("correction").
   - Provide a clear, pedagogical grammar coaching explanation strictly in ${langLabel} ("ruleExplanation").
   - Categorize the grammar rule ("ruleCategory"): one of "kofschip", "v_z_shift", "separable", "auxiliary", "irregular", "spelling", or "correct".
   Pay special attention to the #1 NT2 pitfall:
   - The stem of "leven" is "leef" (v->f), but "v" is NOT in 't kofschip! The past tense is "leefde", NEVER "leefte".
   - The stem of "reizen" is "reis" (z->s), but "z" is NOT in 't kofschip! The past tense is "reisde", NEVER "reiste".
5. Provide a friendly, encouraging overall coaching summary in ${langLabel} ("overallCoaching").

OUTPUT FORMAT: Return pure JSON conforming exactly to this structure:
{
  "rawText": "full text extracted from image",
  "sentences": ["sentence 1", "sentence 2"],
  "detectedVerbs": [
    {
      "verb": "verb form in text",
      "infinitive": "infinitive",
      "tense": "past",
      "isCorrect": false,
      "correction": "leefde",
      "ruleExplanation": "Explanation in ${langLabel}...",
      "ruleCategory": "v_z_shift"
    }
  ],
  "overallCoaching": "Overall feedback paragraph in ${langLabel}..."
}`;

    const imagePart = {
      inlineData: {
        data: cleanBase64,
        mimeType: mimeType || 'image/jpeg',
      },
    };

    const response = await model.generateContent([prompt, imagePart]);
    const responseText = response.response.text();
    const cleanedJson = cleanJsonOutput(responseText);
    const parsed = JSON.parse(cleanedJson);

    // Cross-validate detected verbs against deterministic verb engine
    const validatedVerbs: DetectedVerb[] = (parsed.detectedVerbs || []).map(
      (v: DetectedVerb) => {
        try {
          const stem = deriveStem(v.infinitive || v.verb);
          // If student wrote leefte/reiste and AI didn't catch it, enforce engine check
          if (
            (stem.voicedShift === 'v->f' || stem.originalEndConsonant === 'v') &&
            v.verb.toLowerCase().endsWith('te')
          ) {
            const engineCheck = checkConjugation({
              infinitive: v.infinitive,
              tense: 'past',
              person: '1s',
              userAnswer: v.verb,
            });
            if (!engineCheck.isCorrect) {
              const coach = getLocalizedCoaching(
                'v_z_shift',
                v.verb,
                v.infinitive,
                engineCheck.expected[0] || 'leefde',
                nativeLanguage
              );
              return {
                ...v,
                isCorrect: false,
                correction: engineCheck.expected[0],
                ruleCategory: 'v_z_shift' as RuleCategory,
                ruleExplanation: coach.advice,
              };
            }
          }
        } catch {
          // ignore derivation errors on non-Dutch words
        }
        return v;
      }
    );

    return {
      success: true,
      rawText: parsed.rawText || '',
      sentences: parsed.sentences || [],
      detectedVerbs: validatedVerbs,
      overallCoaching: parsed.overallCoaching || '',
      nativeLanguage,
      isMock: false,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[ai_coach] Gemini OCR Scan failed:', errorMsg);

    // Return a clean error result — do NOT substitute hardcoded mock data for a real photo
    return {
      success: false,
      rawText: '',
      sentences: [],
      detectedVerbs: [],
      overallCoaching: '',
      nativeLanguage,
      isMock: false,
      error: `Scan mislukt: ${errorMsg}. Controleer je API-sleutel en internetverbinding.`,
    };
  }
}

/**
 * Generates an in-depth native language coaching explanation for a single verb or mistake.
 */
export async function explainGrammarInNativeLanguage(
  params: GrammarCoachParams
): Promise<CoachExplanationResult> {
  const {
    verb,
    infinitive = verb,
    userAnswer,
    expected,
    sentence,
    nativeLanguage = 'en',
    apiKey: explicitKey,
  } = params;

  const apiKey = getGeminiApiKey(explicitKey);
  const langLabel = getNativeLanguageLabel(nativeLanguage);

  // Deterministic rule categorization
  let ruleCategory: RuleCategory = 'kofschip';
  let cleanExpected = expected || verb;

  try {
    const stem = deriveStem(infinitive);
    if (stem.voicedShift === 'v->f' || stem.originalEndConsonant === 'v') {
      ruleCategory = 'v_z_shift';
      cleanExpected = expected || (userAnswer?.endsWith('te') ? 'leefde' : expected || verb);
    } else if (stem.voicedShift === 'z->s' || stem.originalEndConsonant === 'z') {
      ruleCategory = 'v_z_shift';
      cleanExpected = expected || (userAnswer?.endsWith('te') ? 'reisde' : expected || verb);
    } else if (isIrregular(infinitive)) {
      ruleCategory = 'irregular';
    } else if (stem.isKofschip) {
      ruleCategory = 'kofschip';
    }
  } catch {
    // fallback
  }

  // If no Gemini API key is configured or offline, return instant localized coaching
  if (!apiKey) {
    const localized = getLocalizedCoaching(
      ruleCategory,
      userAnswer || verb,
      infinitive,
      cleanExpected,
      nativeLanguage
    );
    return {
      explanation: localized.advice,
      ruleCategory,
      tips: [localized.tip, `'t Kofschip letters: ${Array.from(KOFSCHIP_CONSONANTS).join(', ')}`],
      correctForm: cleanExpected,
      exampleSentence: sentence || `Ik ${cleanExpected} gisteren in Nederland.`,
    };
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    });

    const prompt = `You are Kofschip AI Coach, an expert Dutch NT2 language tutor.
A student practiced the Dutch verb "${infinitive}".
- User answer: "${userAnswer || verb}"
- Expected correct form: "${cleanExpected}"
- Context sentence: "${sentence || ''}"

Please explain the grammar rule and why the answer is correct or incorrect.
Write the explanation strictly in ${langLabel}.
Tone: Pedagogical, encouraging, clear for NT2 learners.

Respond ONLY in valid JSON matching this schema:
{
  "explanation": "Detailed pedagogical explanation in ${langLabel}",
  "ruleCategory": "${ruleCategory}",
  "tips": ["Tip 1 in ${langLabel}", "Tip 2 in ${langLabel}"],
  "correctForm": "${cleanExpected}",
  "exampleSentence": "A simple Dutch example sentence"
}`;

    const result = await model.generateContent(prompt);
    const cleaned = cleanJsonOutput(result.response.text());
    const parsed = JSON.parse(cleaned);

    return {
      explanation: parsed.explanation || '',
      ruleCategory: (parsed.ruleCategory as RuleCategory) || ruleCategory,
      tips: parsed.tips || [],
      correctForm: parsed.correctForm || cleanExpected,
      exampleSentence: parsed.exampleSentence || '',
    };
  } catch (err) {
    console.warn('[ai_coach] Gemini explanation failed, using fallback:', err);
    const localized = getLocalizedCoaching(
      ruleCategory,
      userAnswer || verb,
      infinitive,
      cleanExpected,
      nativeLanguage
    );
    return {
      explanation: localized.advice,
      ruleCategory,
      tips: [localized.tip],
      correctForm: cleanExpected,
      exampleSentence: sentence || `Ik ${cleanExpected} gisteren.`,
    };
  }
}
