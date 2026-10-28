/**
 * Kofschip Verb Engine — Deterministic Dutch Verb Conjugation & Rule Checker
 *
 * Implements Dutch grammar rules from /directives/verb_rules_sop.md:
 * - Stem derivation with open syllable vowel doubling & consonant reduction
 * - 't Kofschip past tense (-te/-ten vs -de/-den) and past participle (-t vs -d)
 * - Strict v->f and z->s original consonant tracking (preventing the #1 NT2 trap)
 * - Inseparable (be-, ge-, ver-, etc.) vs separable (op-, aan-, etc.) verbs
 * - Hebben vs zijn auxiliary verb selection
 * - Irregular (sterke werkwoorden) database with compound separable handling
 * - Diagnostic feedback identifying exact rule violations
 */

// ============================================================================
// Types
// ============================================================================

export type Tense = 'present' | 'past' | 'perfect' | 'pastParticiple';

export type Person = '1s' | '2s' | '2s_formal' | '3s' | '1p' | '2p' | '3p';

export type AuxiliaryVerb = 'hebben' | 'zijn' | 'both';

export interface StemResult {
  infinitive: string;
  rawStem: string;
  cleanStem: string;
  originalEndConsonant: string;
  isKofschip: boolean;
  vowelDoubled: boolean;
  consonantReduced: boolean;
  voicedShift: 'v->f' | 'z->s' | null;
}

export interface SeparableInfo {
  isSeparable: boolean;
  prefix: string | null;
  baseVerb: string | null;
}

export interface IrregularVerbEntry {
  infinitive: string;
  present?: Partial<Record<Person, string | string[]>>;
  presentInverted?: Partial<Record<Person, string | string[]>>;
  pastSingular: string | string[];
  pastPlural: string | string[];
  pastParticiple: string | string[];
  auxiliary: AuxiliaryVerb;
}

export interface FullConjugation {
  infinitive: string;
  stem: StemResult;
  separable: SeparableInfo;
  isIrregular: boolean;
  auxiliary: AuxiliaryVerb;
  present: Record<Person, string>;
  presentInverted: Partial<Record<Person, string>>;
  past: {
    singular: string;
    plural: string;
  };
  pastParticiple: string;
  perfect: Record<Person, string>;
}

export interface CheckOptions {
  isInverted?: boolean; // e.g. "Werk jij?"
  isSubordinate?: boolean; // e.g. "...dat ik opbel"
  hasDestination?: boolean; // For 'both' verbs: true -> zijn, false -> hebben
}

export interface CheckResult {
  isCorrect: boolean;
  userAnswer: string;
  expected: string[];
  ruleId: string;
  feedback: string;
  correctionTip?: string;
}

// ============================================================================
// Constants & Dictionaries
// ============================================================================

/**
 * Consonants belonging to 't kofschip / 't ex-kofschip (voiceless consonants).
 */
export const KOFSCHIP_CONSONANTS = new Set(['t', 'k', 'f', 's', 'ch', 'p', 'x']);

/**
 * Inseparable prefixes that never separate and never receive the `ge-` prefix.
 */
export const INSEPARABLE_PREFIXES = ['be', 'er', 'ge', 'her', 'ont', 'ver'] as const;

/**
 * Common separable prefixes, sorted by length descending for greedy prefix matching.
 */
export const SEPARABLE_PREFIXES = [
  'achterna',
  'binnenin',
  'tegemoet',
  'tegenover',
  'voorbij',
  'voortaan',
  'vooruit',
  'bijeen',
  'dichtbij',
  'achter',
  'binnen',
  'buiten',
  'samen',
  'tegen',
  'terug',
  'voort',
  'langs',
  'onder',
  'dwars',
  'omhoog',
  'omlaag',
  'klaar',
  'kwijt',
  'open',
  'neer',
  'over',
  'door',
  'vast',
  'weer',
  'rond',
  'voor',
  'mee',
  'uit',
  'toe',
  'aan',
  'bij',
  'weg',
  'af',
  'in',
  'na',
  'om',
  'op',
] as const;

/**
 * Verbs that ALWAYS select 'zijn' in the perfect tense.
 */
export const AUXILIARY_ZIJN_VERBS = new Set([
  'zijn',
  'worden',
  'blijven',
  'gaan',
  'komen',
  'vertrekken',
  'beginnen',
  'stoppen',
  'vallen',
  'groeien',
  'sterven',
  'slagen',
  'zakken',
  'verschijnen',
  'verdwijnen',
  'opstaan',
  'gebeuren',
  'genezen',
  'stijgen',
  'dalen',
  'trouwen',
  'ontstaan',
  'overlijden',
  'blijken',
  'ontwaken',
  'passeren',
  'verouderen',
  'immigreren',
  'emigreren',
]);

/**
 * Verbs of movement or change that select 'zijn' with destination, 'hebben' for activity.
 */
export const AUXILIARY_BOTH_VERBS = new Set([
  'rijden',
  'fietsen',
  'lopen',
  'zwemmen',
  'vliegen',
  'wandelen',
  'rennen',
  'reizen',
  'klimmen',
  'smelten',
  'varen',
  'schaatsen',
  'verhuizen',
  'kruipen',
  'springen',
]);

/**
 * Comprehensive dictionary of irregular verbs (sterke werkwoorden).
 */
export const IRREGULAR_VERBS: Record<string, IrregularVerbEntry> = {
  zijn: {
    infinitive: 'zijn',
    present: {
      '1s': 'ben',
      '2s': 'bent',
      '2s_formal': ['bent', 'is'],
      '3s': 'is',
      '1p': 'zijn',
      '2p': 'zijn',
      '3p': 'zijn',
    },
    presentInverted: {
      '2s': 'ben',
      '2s_formal': ['bent', 'is'],
    },
    pastSingular: 'was',
    pastPlural: 'waren',
    pastParticiple: 'geweest',
    auxiliary: 'zijn',
  },
  hebben: {
    infinitive: 'hebben',
    present: {
      '1s': 'heb',
      '2s': 'hebt',
      '2s_formal': ['hebt', 'heeft'],
      '3s': 'heeft',
      '1p': 'hebben',
      '2p': 'hebben',
      '3p': 'hebben',
    },
    presentInverted: {
      '2s': 'heb',
      '2s_formal': ['hebt', 'heeft'],
    },
    pastSingular: 'had',
    pastPlural: 'hadden',
    pastParticiple: 'gehad',
    auxiliary: 'hebben',
  },
  worden: {
    infinitive: 'worden',
    present: {
      '1s': 'word',
      '2s': 'wordt',
      '2s_formal': 'wordt',
      '3s': 'wordt',
      '1p': 'worden',
      '2p': 'worden',
      '3p': 'worden',
    },
    presentInverted: {
      '2s': 'word',
    },
    pastSingular: 'werd',
    pastPlural: 'werden',
    pastParticiple: 'geworden',
    auxiliary: 'zijn',
  },
  kunnen: {
    infinitive: 'kunnen',
    present: {
      '1s': 'kan',
      '2s': ['kan', 'kunt'],
      '2s_formal': 'kunt',
      '3s': 'kan',
      '1p': 'kunnen',
      '2p': 'kunnen',
      '3p': 'kunnen',
    },
    presentInverted: {
      '2s': ['kan', 'kun'],
      '2s_formal': 'kunt',
    },
    pastSingular: 'kon',
    pastPlural: 'konden',
    pastParticiple: 'gekund',
    auxiliary: 'hebben',
  },
  zullen: {
    infinitive: 'zullen',
    present: {
      '1s': 'zal',
      '2s': ['zal', 'zult'],
      '2s_formal': 'zult',
      '3s': 'zal',
      '1p': 'zullen',
      '2p': 'zullen',
      '3p': 'zullen',
    },
    presentInverted: {
      '2s': ['zal', 'zul'],
      '2s_formal': 'zult',
    },
    pastSingular: 'zou',
    pastPlural: 'zouden',
    pastParticiple: '—',
    auxiliary: 'hebben',
  },
  moeten: {
    infinitive: 'moeten',
    present: {
      '1s': 'moet',
      '2s': 'moet',
      '2s_formal': 'moet',
      '3s': 'moet',
      '1p': 'moeten',
      '2p': 'moeten',
      '3p': 'moeten',
    },
    pastSingular: 'moest',
    pastPlural: 'moesten',
    pastParticiple: 'gemoeten',
    auxiliary: 'hebben',
  },
  mogen: {
    infinitive: 'mogen',
    present: {
      '1s': 'mag',
      '2s': 'mag',
      '2s_formal': ['mag', 'moogt'],
      '3s': 'mag',
      '1p': 'mogen',
      '2p': 'mogen',
      '3p': 'mogen',
    },
    pastSingular: 'mocht',
    pastPlural: 'mochten',
    pastParticiple: 'gemogen',
    auxiliary: 'hebben',
  },
  willen: {
    infinitive: 'willen',
    present: {
      '1s': 'wil',
      '2s': ['wil', 'wilt'],
      '2s_formal': 'wilt',
      '3s': ['wil', 'wilt'],
      '1p': 'willen',
      '2p': 'willen',
      '3p': 'willen',
    },
    presentInverted: {
      '2s': ['wil', 'wilt'],
    },
    pastSingular: ['wilde', 'wou'],
    pastPlural: ['wilden', 'wouden'],
    pastParticiple: 'gewild',
    auxiliary: 'hebben',
  },
  gaan: {
    infinitive: 'gaan',
    present: {
      '1s': 'ga',
      '2s': 'gaat',
      '2s_formal': 'gaat',
      '3s': 'gaat',
      '1p': 'gaan',
      '2p': 'gaan',
      '3p': 'gaan',
    },
    presentInverted: {
      '2s': 'ga',
    },
    pastSingular: 'ging',
    pastPlural: 'gingen',
    pastParticiple: 'gegaan',
    auxiliary: 'zijn',
  },
  komen: {
    infinitive: 'komen',
    pastSingular: 'kwam',
    pastPlural: 'kwamen',
    pastParticiple: 'gekomen',
    auxiliary: 'zijn',
  },
  staan: {
    infinitive: 'staan',
    present: {
      '1s': 'sta',
      '2s': 'staat',
      '2s_formal': 'staat',
      '3s': 'staat',
      '1p': 'staan',
      '2p': 'staan',
      '3p': 'staan',
    },
    presentInverted: {
      '2s': 'sta',
    },
    pastSingular: 'stond',
    pastPlural: 'stonden',
    pastParticiple: 'gestaan',
    auxiliary: 'hebben',
  },
  doen: {
    infinitive: 'doen',
    present: {
      '1s': 'doe',
      '2s': 'doet',
      '2s_formal': 'doet',
      '3s': 'doet',
      '1p': 'doen',
      '2p': 'doen',
      '3p': 'doen',
    },
    presentInverted: {
      '2s': 'doe',
    },
    pastSingular: 'deed',
    pastPlural: 'deden',
    pastParticiple: 'gedaan',
    auxiliary: 'hebben',
  },
  zien: {
    infinitive: 'zien',
    present: {
      '1s': 'zie',
      '2s': 'ziet',
      '2s_formal': 'ziet',
      '3s': 'ziet',
      '1p': 'zien',
      '2p': 'zien',
      '3p': 'zien',
    },
    presentInverted: {
      '2s': 'zie',
    },
    pastSingular: 'zag',
    pastPlural: 'zagen',
    pastParticiple: 'gezien',
    auxiliary: 'hebben',
  },
  slaan: {
    infinitive: 'slaan',
    present: {
      '1s': 'sla',
      '2s': 'slaat',
      '2s_formal': 'slaat',
      '3s': 'slaat',
      '1p': 'slaan',
      '2p': 'slaan',
      '3p': 'slaan',
    },
    presentInverted: {
      '2s': 'sla',
    },
    pastSingular: 'sloeg',
    pastPlural: 'sloegen',
    pastParticiple: 'geslagen',
    auxiliary: 'hebben',
  },
  zeggen: {
    infinitive: 'zeggen',
    pastSingular: 'zei',
    pastPlural: 'zeiden',
    pastParticiple: 'gezegd',
    auxiliary: 'hebben',
  },
  denken: {
    infinitive: 'denken',
    pastSingular: 'dacht',
    pastPlural: 'dachten',
    pastParticiple: 'gedacht',
    auxiliary: 'hebben',
  },
  geven: {
    infinitive: 'geven',
    pastSingular: 'gaf',
    pastPlural: 'gaven',
    pastParticiple: 'gegeven',
    auxiliary: 'hebben',
  },
  nemen: {
    infinitive: 'nemen',
    pastSingular: 'nam',
    pastPlural: 'namen',
    pastParticiple: 'genomen',
    auxiliary: 'hebben',
  },
  vinden: {
    infinitive: 'vinden',
    pastSingular: 'vond',
    pastPlural: 'vonden',
    pastParticiple: 'gevonden',
    auxiliary: 'hebben',
  },
  weten: {
    infinitive: 'weten',
    present: {
      '1s': 'weet',
      '2s': 'weet',
      '2s_formal': 'weet',
      '3s': 'weet',
      '1p': 'weten',
      '2p': 'weten',
      '3p': 'weten',
    },
    pastSingular: 'wist',
    pastPlural: 'wisten',
    pastParticiple: 'geweten',
    auxiliary: 'hebben',
  },
  krijgen: {
    infinitive: 'krijgen',
    pastSingular: 'kreeg',
    pastPlural: 'kregen',
    pastParticiple: 'gekregen',
    auxiliary: 'hebben',
  },
  brengen: {
    infinitive: 'brengen',
    pastSingular: 'bracht',
    pastPlural: 'brachten',
    pastParticiple: 'gebracht',
    auxiliary: 'hebben',
  },
  kopen: {
    infinitive: 'kopen',
    pastSingular: 'kocht',
    pastPlural: 'kochten',
    pastParticiple: 'gekocht',
    auxiliary: 'hebben',
  },
  zoeken: {
    infinitive: 'zoeken',
    pastSingular: 'zocht',
    pastPlural: 'zochten',
    pastParticiple: 'gezocht',
    auxiliary: 'hebben',
  },
  helpen: {
    infinitive: 'helpen',
    pastSingular: 'hielp',
    pastPlural: 'hielpen',
    pastParticiple: 'geholpen',
    auxiliary: 'hebben',
  },
  sterven: {
    infinitive: 'sterven',
    pastSingular: 'stierf',
    pastPlural: 'stierven',
    pastParticiple: 'gestorven',
    auxiliary: 'zijn',
  },
  trekken: {
    infinitive: 'trekken',
    pastSingular: 'trok',
    pastPlural: 'trokken',
    pastParticiple: 'getrokken',
    auxiliary: 'hebben',
  },
  zitten: {
    infinitive: 'zitten',
    pastSingular: 'zat',
    pastPlural: 'zaten',
    pastParticiple: 'gezeten',
    auxiliary: 'hebben',
  },
  liggen: {
    infinitive: 'liggen',
    pastSingular: 'lag',
    pastPlural: 'lagen',
    pastParticiple: 'gelegen',
    auxiliary: 'hebben',
  },
  hangen: {
    infinitive: 'hangen',
    pastSingular: 'hing',
    pastPlural: 'hingen',
    pastParticiple: 'gehangen',
    auxiliary: 'hebben',
  },
  vangen: {
    infinitive: 'vangen',
    pastSingular: 'ving',
    pastPlural: 'vingen',
    pastParticiple: 'gevangen',
    auxiliary: 'hebben',
  },
  zwemmen: {
    infinitive: 'zwemmen',
    pastSingular: 'zwom',
    pastPlural: 'zwommen',
    pastParticiple: 'gezwommen',
    auxiliary: 'both',
  },
  rijden: {
    infinitive: 'rijden',
    pastSingular: 'reed',
    pastPlural: 'reden',
    pastParticiple: 'gereden',
    auxiliary: 'both',
  },
  lopen: {
    infinitive: 'lopen',
    pastSingular: 'liep',
    pastPlural: 'liepen',
    pastParticiple: 'gelopen',
    auxiliary: 'both',
  },
  vliegen: {
    infinitive: 'vliegen',
    pastSingular: 'vloog',
    pastPlural: 'vlogen',
    pastParticiple: 'gevlogen',
    auxiliary: 'both',
  },
  klimmen: {
    infinitive: 'klimmen',
    pastSingular: 'klom',
    pastPlural: 'klommen',
    pastParticiple: 'geklommen',
    auxiliary: 'both',
  },
  smelten: {
    infinitive: 'smelten',
    pastSingular: 'smolt',
    pastPlural: 'smolten',
    pastParticiple: 'gesmolten',
    auxiliary: 'both',
  },
  blijven: {
    infinitive: 'blijven',
    pastSingular: 'bleef',
    pastPlural: 'bleven',
    pastParticiple: 'gebleven',
    auxiliary: 'zijn',
  },
  schrijven: {
    infinitive: 'schrijven',
    pastSingular: 'schreef',
    pastPlural: 'schreven',
    pastParticiple: 'geschreven',
    auxiliary: 'hebben',
  },
  kijken: {
    infinitive: 'kijken',
    pastSingular: 'keek',
    pastPlural: 'keken',
    pastParticiple: 'gekeken',
    auxiliary: 'hebben',
  },
  lijken: {
    infinitive: 'lijken',
    pastSingular: 'leek',
    pastPlural: 'leken',
    pastParticiple: 'geleken',
    auxiliary: 'hebben',
  },
  bieden: {
    infinitive: 'bieden',
    pastSingular: 'bood',
    pastPlural: 'boden',
    pastParticiple: 'geboden',
    auxiliary: 'hebben',
  },
  schieten: {
    infinitive: 'schieten',
    pastSingular: 'schoot',
    pastPlural: 'schoten',
    pastParticiple: 'geschoten',
    auxiliary: 'hebben',
  },
  sluiten: {
    infinitive: 'sluiten',
    pastSingular: 'sloot',
    pastPlural: 'sloten',
    pastParticiple: 'gesloten',
    auxiliary: 'hebben',
  },
  kiezen: {
    infinitive: 'kiezen',
    pastSingular: 'koos',
    pastPlural: 'kozen',
    pastParticiple: 'gekozen',
    auxiliary: 'hebben',
  },
  kruipen: {
    infinitive: 'kruipen',
    pastSingular: 'kroop',
    pastPlural: 'kropen',
    pastParticiple: 'gekropen',
    auxiliary: 'both',
  },
  schuiven: {
    infinitive: 'schuiven',
    pastSingular: 'schoof',
    pastPlural: 'schoven',
    pastParticiple: 'geschoven',
    auxiliary: 'hebben',
  },
  drinken: {
    infinitive: 'drinken',
    pastSingular: 'dronk',
    pastPlural: 'dronken',
    pastParticiple: 'gedronken',
    auxiliary: 'hebben',
  },
  zingen: {
    infinitive: 'zingen',
    pastSingular: 'zong',
    pastPlural: 'zongen',
    pastParticiple: 'gezongen',
    auxiliary: 'hebben',
  },
  winnen: {
    infinitive: 'winnen',
    pastSingular: 'won',
    pastPlural: 'wonnen',
    pastParticiple: 'gewonnen',
    auxiliary: 'hebben',
  },
  beginnen: {
    infinitive: 'beginnen',
    pastSingular: 'begon',
    pastPlural: 'begonnen',
    pastParticiple: 'begonnen',
    auxiliary: 'zijn',
  },
  spreken: {
    infinitive: 'spreken',
    pastSingular: 'sprak',
    pastPlural: 'spraken',
    pastParticiple: 'gesproken',
    auxiliary: 'hebben',
  },
  breken: {
    infinitive: 'breken',
    pastSingular: 'brak',
    pastPlural: 'braken',
    pastParticiple: 'gebroken',
    auxiliary: 'hebben',
  },
  stelen: {
    infinitive: 'stelen',
    pastSingular: 'stal',
    pastPlural: 'stalen',
    pastParticiple: 'gestolen',
    auxiliary: 'hebben',
  },
  eten: {
    infinitive: 'eten',
    pastSingular: 'at',
    pastPlural: 'aten',
    pastParticiple: 'gegeten',
    auxiliary: 'hebben',
  },
  lezen: {
    infinitive: 'lezen',
    pastSingular: 'las',
    pastPlural: 'lazen',
    pastParticiple: 'gelezen',
    auxiliary: 'hebben',
  },
  vergeten: {
    infinitive: 'vergeten',
    pastSingular: 'vergat',
    pastPlural: 'vergaten',
    pastParticiple: 'vergeten',
    auxiliary: 'both',
  },
  slapen: {
    infinitive: 'slapen',
    pastSingular: 'sliep',
    pastPlural: 'sliepen',
    pastParticiple: 'geslapen',
    auxiliary: 'hebben',
  },
  laten: {
    infinitive: 'laten',
    pastSingular: 'liet',
    pastPlural: 'lieten',
    pastParticiple: 'gelaten',
    auxiliary: 'hebben',
  },
  vallen: {
    infinitive: 'vallen',
    pastSingular: 'viel',
    pastPlural: 'vielen',
    pastParticiple: 'gevallen',
    auxiliary: 'zijn',
  },
  houden: {
    infinitive: 'houden',
    pastSingular: 'hield',
    pastPlural: 'hielden',
    pastParticiple: 'gehouden',
    auxiliary: 'hebben',
  },
  roepen: {
    infinitive: 'roepen',
    pastSingular: 'riep',
    pastPlural: 'riepen',
    pastParticiple: 'geroepen',
    auxiliary: 'hebben',
  },
  vertrekken: {
    infinitive: 'vertrekken',
    pastSingular: 'vertrok',
    pastPlural: 'vertrokken',
    pastParticiple: 'vertrokken',
    auxiliary: 'zijn',
  },
  begrijpen: {
    infinitive: 'begrijpen',
    pastSingular: 'begreep',
    pastPlural: 'begrepen',
    pastParticiple: 'begrepen',
    auxiliary: 'hebben',
  },
  besluiten: {
    infinitive: 'besluiten',
    pastSingular: 'besloot',
    pastPlural: 'besloten',
    pastParticiple: 'besloten',
    auxiliary: 'hebben',
  },
  verdwijnen: {
    infinitive: 'verdwijnen',
    pastSingular: 'verdween',
    pastPlural: 'verdwenen',
    pastParticiple: 'verdwenen',
    auxiliary: 'zijn',
  },
  verschijnen: {
    infinitive: 'verschijnen',
    pastSingular: 'verscheen',
    pastPlural: 'verschenen',
    pastParticiple: 'verschenen',
    auxiliary: 'zijn',
  },
  wassen: {
    infinitive: 'wassen',
    pastSingular: 'waste',
    pastPlural: 'wasten',
    pastParticiple: 'gewassen',
    auxiliary: 'hebben',
  },
  dragen: {
    infinitive: 'dragen',
    pastSingular: 'droeg',
    pastPlural: 'droegen',
    pastParticiple: 'gedragen',
    auxiliary: 'hebben',
  },
  bakken: {
    infinitive: 'bakken',
    pastSingular: 'bakte',
    pastPlural: 'bakten',
    pastParticiple: 'gebakken',
    auxiliary: 'hebben',
  },
  vechten: {
    infinitive: 'vechten',
    pastSingular: 'vocht',
    pastPlural: 'vochten',
    pastParticiple: 'gevochten',
    auxiliary: 'hebben',
  },
  snijden: {
    infinitive: 'snijden',
    pastSingular: 'sneed',
    pastPlural: 'sneden',
    pastParticiple: 'gesneden',
    auxiliary: 'hebben',
  },
  wijzen: {
    infinitive: 'wijzen',
    pastSingular: 'wees',
    pastPlural: 'wezen',
    pastParticiple: 'gewezen',
    auxiliary: 'hebben',
  },
  ontvangen: {
    infinitive: 'ontvangen',
    pastSingular: 'ontving',
    pastPlural: 'ontvingen',
    pastParticiple: 'ontvangen',
    auxiliary: 'hebben',
  },
  varen: {
    infinitive: 'varen',
    pastSingular: 'voer',
    pastPlural: 'voeren',
    pastParticiple: 'gevaren',
    auxiliary: 'both',
  },
  overlijden: {
    infinitive: 'overlijden',
    pastSingular: 'overleed',
    pastPlural: 'overleden',
    pastParticiple: 'overleden',
    auxiliary: 'zijn',
  },
};

// ============================================================================
// Core Grammar Functions
// ============================================================================

/**
 * Verbs that start with letters resembling prefixes but are primitive stems.
 * e.g. 'bellen' is not be- + llen, 'verven' is from verf (geverfd), 'geven' is irregular.
 */
const NON_INSEPARABLE_VERBS = new Set([
  'bellen',
  'bidden',
  'bijten',
  'binden',
  'blazen',
  'blijven',
  'blinken',
  'breken',
  'brengen',
  'buigen',
  'bukken',
  'erven',
  'ergeren',
  'geven',
  'gelden',
  'gieten',
  'gissen',
  'glanzen',
  'glimmen',
  'graven',
  'grijpen',
  'groeien',
  'verven',
]);

/**
 * Checks if a verb has an inseparable prefix (be-, er-, ge-, her-, ont-, ver-).
 */
export function getInseparablePrefix(verb: string): string | null {
  const normalized = verb.toLowerCase().trim();

  if (NON_INSEPARABLE_VERBS.has(normalized)) {
    return null;
  }

  // A prefix is never followed by an impossible word-initial double consonant (e.g. be-llen)
  if (/^(be|ge|ver)([bcdfghjklmnpqrstvwxz])\2/.test(normalized)) {
    return null;
  }

  for (const prefix of INSEPARABLE_PREFIXES) {
    if (normalized.startsWith(prefix) && normalized.length > prefix.length + 2) {
      return prefix;
    }
  }
  return null;
}

/**
 * Identifies if a verb is separable (scheidbaar) and extracts prefix and base.
 */
export function splitSeparableVerb(infinitive: string): SeparableInfo {
  const norm = infinitive.toLowerCase().trim();

  // If it starts with an inseparable prefix directly, it is NOT separable
  if (getInseparablePrefix(norm) && !norm.startsWith('voorbereid')) {
    return { isSeparable: false, prefix: null, baseVerb: null };
  }

  for (const prefix of SEPARABLE_PREFIXES) {
    if (norm.startsWith(prefix) && norm.length > prefix.length + 2) {
      const base = norm.slice(prefix.length);
      // Base must end with 'en' or 'n' (valid Dutch infinitive form)
      if (base.endsWith('en') || base === 'gaan' || base === 'staan' || base === 'doen' || base === 'zien' || base === 'slaan') {
        return {
          isSeparable: true,
          prefix,
          baseVerb: base,
        };
      }
    }
  }

  return { isSeparable: false, prefix: null, baseVerb: null };
}

/**
 * Derives the spelled stem and tracks the original end consonant (before v->f / z->s).
 */
export function deriveStem(verb: string): StemResult {
  const norm = verb.toLowerCase().trim();

  // Check if it's a separable verb: derive stem of the base verb
  const sep = splitSeparableVerb(norm);
  if (sep.isSeparable && sep.baseVerb) {
    return deriveStem(sep.baseVerb);
  }

  // Handle Dutch monosyllabic verbs ending in -n (gaan, staan, doen, zien, slaan)
  if (norm === 'gaan') return makeStemResult(norm, 'ga', 'ga', 'a', false, false, false, null);
  if (norm === 'staan') return makeStemResult(norm, 'sta', 'sta', 'a', false, false, false, null);
  if (norm === 'slaan') return makeStemResult(norm, 'sla', 'sla', 'a', false, false, false, null);
  if (norm === 'doen') return makeStemResult(norm, 'doe', 'doe', 'oe', false, false, false, null);
  if (norm === 'zien') return makeStemResult(norm, 'zie', 'zie', 'ie', false, false, false, null);
  if (norm === 'zijn') return makeStemResult(norm, 'ben', 'ben', 'n', false, false, false, null);

  // Step 1: Remove "-en"
  let rawStem = norm;
  if (norm.endsWith('en')) {
    rawStem = norm.slice(0, -2);
  } else if (norm.endsWith('n')) {
    rawStem = norm.slice(0, -1);
  }

  // Step 2: Determine original end consonant BEFORE spelling changes
  let originalEndConsonant = '';
  if (rawStem.endsWith('ch')) {
    originalEndConsonant = 'ch';
  } else {
    originalEndConsonant = rawStem.slice(-1);
  }

  let cleanStem = rawStem;
  let consonantReduced = false;
  let vowelDoubled = false;
  let voicedShift: 'v->f' | 'z->s' | null = null;

  // Rule A: Double Consonant Reduction (e.g. pakk -> pak, zett -> zet, renn -> ren)
  const doubleConsonantMatch = /(bb|dd|ff|gg|kk|ll|mm|nn|pp|rr|ss|tt)$/.exec(cleanStem);
  if (doubleConsonantMatch) {
    cleanStem = cleanStem.slice(0, -1);
    consonantReduced = true;
    originalEndConsonant = cleanStem.slice(-1);
  }

  // Rule B: Open Syllable Vowel Doubling
  // Pattern: ...[consonant][single vowel a/e/o/u][single consonant or v/z]
  // Note: Unstressed suffixes like -elen (wandelen), -enen (tekenen), -emen (ademen),
  // and Germanic -eren (luisteren, veranderen) have schwa and do NOT double.
  const isUnstressedSuffix =
    norm.endsWith('elen') ||
    norm.endsWith('enen') ||
    norm.endsWith('emen') ||
    norm.endsWith('eren') &&
      !/(e|i|u|o)reren$/.test(norm) && // loanwords like studeren, proberen end in stressed -eren
      !norm.endsWith('leren') &&
      !norm.endsWith('weren') &&
      !norm.endsWith('keren') &&
      norm.length > 6 &&
      /[bcdfghjklmnpqrstvwxz]{2}eren$/.test(norm); // e.g. luisteren, schilderen

  if (!consonantReduced && !isUnstressedSuffix) {
    // Check if the stem ends in a single consonant (or v/z) preceded by exactly one single vowel (a, e, o, u)
    // Note: 'x' is phonetically /ks/ (two consonants), so it is a closed syllable and never doubles
    const openSyllableRegex = /([^aeiouy])([aeou])([bcdfghjklmnpqrstvwz])$/i;
    const match = openSyllableRegex.exec(cleanStem);
    if (match) {
      const leadingConsonant = match[1];
      const vowel = match[2];
      const trailingConsonant = match[3];
      const prefixPart = cleanStem.slice(0, match.index);
      cleanStem = `${prefixPart}${leadingConsonant}${vowel}${vowel}${trailingConsonant}`;
      vowelDoubled = true;
    }
  }

  // Rules C & D: Voiced consonant shift at end of stem (v -> f, z -> s)
  if (cleanStem.endsWith('v')) {
    cleanStem = cleanStem.slice(0, -1) + 'f';
    voicedShift = 'v->f';
  } else if (cleanStem.endsWith('z')) {
    cleanStem = cleanStem.slice(0, -1) + 's';
    voicedShift = 'z->s';
  }

  // Kofschip check is evaluated strictly against the ORIGINAL end consonant
  const isKof = KOFSCHIP_CONSONANTS.has(originalEndConsonant);

  return {
    infinitive: norm,
    rawStem,
    cleanStem,
    originalEndConsonant,
    isKofschip: isKof,
    vowelDoubled,
    consonantReduced,
    voicedShift,
  };
}

function makeStemResult(
  infinitive: string,
  rawStem: string,
  cleanStem: string,
  originalEndConsonant: string,
  isKofschip: boolean,
  vowelDoubled: boolean,
  consonantReduced: boolean,
  voicedShift: 'v->f' | 'z->s' | null
): StemResult {
  return {
    infinitive,
    rawStem,
    cleanStem,
    originalEndConsonant,
    isKofschip,
    vowelDoubled,
    consonantReduced,
    voicedShift,
  };
}

/**
 * Checks if a verb follows 't kofschip rule based on its stem's original end consonant.
 */
export function isKofschip(verbOrStem: string | StemResult): boolean {
  if (typeof verbOrStem === 'object') {
    return verbOrStem.isKofschip;
  }
  return deriveStem(verbOrStem).isKofschip;
}

/**
 * Determines auxiliary verb selection (hebben, zijn, or both).
 */
export function selectAuxiliary(infinitive: string, hasDestination?: boolean): AuxiliaryVerb {
  const norm = infinitive.toLowerCase().trim();

  // 1. Direct irregular entry check
  if (IRREGULAR_VERBS[norm]) {
    const aux = IRREGULAR_VERBS[norm].auxiliary;
    if (aux === 'both' && hasDestination !== undefined) {
      return hasDestination ? 'zijn' : 'hebben';
    }
    return aux;
  }

  // 2. Direct zijn and both sets
  if (AUXILIARY_ZIJN_VERBS.has(norm)) return 'zijn';
  if (AUXILIARY_BOTH_VERBS.has(norm)) {
    if (hasDestination !== undefined) {
      return hasDestination ? 'zijn' : 'hebben';
    }
    return 'both';
  }

  // 3. Separable verb: inherit from base verb
  const sep = splitSeparableVerb(norm);
  if (sep.isSeparable && sep.baseVerb) {
    return selectAuxiliary(sep.baseVerb, hasDestination);
  }

  // Default: transitive and other Dutch verbs select 'hebben'
  return 'hebben';
}

/**
 * Deterministically constructs the past participle (voltooid deelwoord).
 */
export function getPastParticiple(infinitive: string): string {
  const norm = infinitive.toLowerCase().trim();

  // 1. Check irregular lookup
  if (IRREGULAR_VERBS[norm]) {
    const part = IRREGULAR_VERBS[norm].pastParticiple;
    return Array.isArray(part) ? part[0] : part;
  }

  // 2. Check separable verbs (e.g. opbellen -> opgebeld, aankomen -> aangekomen)
  const sep = splitSeparableVerb(norm);
  if (sep.isSeparable && sep.prefix && sep.baseVerb) {
    // If the base verb is irregular, use its irregular participle with prefix
    if (IRREGULAR_VERBS[sep.baseVerb]) {
      const basePart = IRREGULAR_VERBS[sep.baseVerb].pastParticiple;
      const basePartStr = Array.isArray(basePart) ? basePart[0] : basePart;
      return `${sep.prefix}${basePartStr}`;
    }

    // If base verb starts with an inseparable prefix (e.g. voorbereiden -> voorbereid)
    if (getInseparablePrefix(sep.baseVerb)) {
      return `${sep.prefix}${getPastParticiple(sep.baseVerb)}`;
    }

    // Regular separable: prefix + "ge" + base stem + t/d
    const baseStem = deriveStem(sep.baseVerb);
    let ending = '';
    if (!baseStem.cleanStem.endsWith('t') && !baseStem.cleanStem.endsWith('d')) {
      ending = baseStem.isKofschip ? 't' : 'd';
    }
    return `${sep.prefix}ge${baseStem.cleanStem}${ending}`;
  }

  // 3. Inseparable prefix verbs (be-, er-, ge-, her-, ont-, ver-): NO "ge-"
  const insepPrefix = getInseparablePrefix(norm);
  const stem = deriveStem(norm);
  let ending = '';
  if (!stem.cleanStem.endsWith('t') && !stem.cleanStem.endsWith('d')) {
    ending = stem.isKofschip ? 't' : 'd';
  }

  if (insepPrefix) {
    return `${stem.cleanStem}${ending}`;
  }

  // 4. Standard regular verb: ge- + stem + t/d
  return `ge${stem.cleanStem}${ending}`;
}

/**
 * Generates the full deterministic conjugation table for an infinitive.
 */
export function conjugate(
  infinitive: string,
  options: { isInverted?: boolean; isSubordinate?: boolean } = {}
): FullConjugation {
  const norm = infinitive.toLowerCase().trim();
  const sep = splitSeparableVerb(norm);
  const stem = deriveStem(norm);
  const irregular = IRREGULAR_VERBS[norm] || (sep.isSeparable && sep.baseVerb ? IRREGULAR_VERBS[sep.baseVerb] : null);
  const isIrreg = Boolean(irregular);
  const aux = selectAuxiliary(norm);
  const participle = getPastParticiple(norm);

  // Present tense generation
  const present: Record<Person, string> = {
    '1s': '',
    '2s': '',
    '2s_formal': '',
    '3s': '',
    '1p': norm,
    '2p': norm,
    '3p': norm,
  };
  const presentInverted: Partial<Record<Person, string>> = {};

  if (irregular && !sep.isSeparable && irregular.present) {
    // Highly irregular modal / auxiliary present (zijn, hebben, kunnen, etc.)
    for (const [p, form] of Object.entries(irregular.present)) {
      present[p as Person] = Array.isArray(form) ? form[0] : form;
    }
    if (irregular.presentInverted) {
      for (const [p, form] of Object.entries(irregular.presentInverted)) {
        presentInverted[p as Person] = Array.isArray(form) ? form[0] : form;
      }
    }
  } else if (sep.isSeparable && sep.prefix && sep.baseVerb) {
    // Separable verb present
    const baseStem = deriveStem(sep.baseVerb);
    const baseIrreg = IRREGULAR_VERBS[sep.baseVerb];

    const getBaseForm = (p: Person): string => {
      if (baseIrreg?.present && baseIrreg.present[p]) {
        const val = baseIrreg.present[p]!;
        return Array.isArray(val) ? val[0] : val;
      }
      if (p === '1s') return baseStem.cleanStem;
      if (p === '1p' || p === '2p' || p === '3p') return sep.baseVerb!;
      // 2s, 2s_formal, 3s
      return baseStem.cleanStem.endsWith('t') ? baseStem.cleanStem : `${baseStem.cleanStem}t`;
    };

    if (options.isSubordinate) {
      // In subordinate clauses: whole verb joined at end ("...dat ik opbel")
      present['1s'] = `${sep.prefix}${getBaseForm('1s')}`;
      present['2s'] = `${sep.prefix}${getBaseForm('2s')}`;
      present['2s_formal'] = `${sep.prefix}${getBaseForm('2s_formal')}`;
      present['3s'] = `${sep.prefix}${getBaseForm('3s')}`;
      present['1p'] = norm;
      present['2p'] = norm;
      present['3p'] = norm;
    } else {
      // Main clause: base verb in position 2, prefix at end ("Ik bel op")
      present['1s'] = `${getBaseForm('1s')} ${sep.prefix}`;
      present['2s'] = `${getBaseForm('2s')} ${sep.prefix}`;
      present['2s_formal'] = `${getBaseForm('2s_formal')} ${sep.prefix}`;
      present['3s'] = `${getBaseForm('3s')} ${sep.prefix}`;
      present['1p'] = `${getBaseForm('1p')} ${sep.prefix}`;
      present['2p'] = `${getBaseForm('2p')} ${sep.prefix}`;
      present['3p'] = `${getBaseForm('3p')} ${sep.prefix}`;

      // Inversion: drop -t for 2s ("Bel jij op?")
      presentInverted['2s'] = `${baseStem.cleanStem} ${sep.prefix}`;
    }
  } else {
    // Standard regular present
    const ikForm = stem.cleanStem;
    const tForm = stem.cleanStem.endsWith('t') ? stem.cleanStem : `${stem.cleanStem}t`;

    present['1s'] = ikForm;
    present['2s'] = tForm;
    present['2s_formal'] = tForm;
    present['3s'] = tForm;
    present['1p'] = norm;
    present['2p'] = norm;
    present['3p'] = norm;

    // Jij-inversie drops the -t: "Werk jij?"
    presentInverted['2s'] = ikForm;
  }

  // Past tense generation
  let pastSingular = '';
  let pastPlural = '';

  if (irregular && !sep.isSeparable) {
    pastSingular = Array.isArray(irregular.pastSingular) ? irregular.pastSingular[0] : irregular.pastSingular;
    pastPlural = Array.isArray(irregular.pastPlural) ? irregular.pastPlural[0] : irregular.pastPlural;
  } else if (sep.isSeparable && sep.prefix && sep.baseVerb) {
    const baseStem = deriveStem(sep.baseVerb);
    const baseIrreg = IRREGULAR_VERBS[sep.baseVerb];

    let basePastSing = '';
    let basePastPlur = '';

    if (baseIrreg) {
      basePastSing = Array.isArray(baseIrreg.pastSingular) ? baseIrreg.pastSingular[0] : baseIrreg.pastSingular;
      basePastPlur = Array.isArray(baseIrreg.pastPlural) ? baseIrreg.pastPlural[0] : baseIrreg.pastPlural;
    } else {
      const suffixSing = baseStem.isKofschip ? 'te' : 'de';
      const suffixPlur = baseStem.isKofschip ? 'ten' : 'den';
      basePastSing = `${baseStem.cleanStem}${suffixSing}`;
      basePastPlur = `${baseStem.cleanStem}${suffixPlur}`;
    }

    if (options.isSubordinate) {
      pastSingular = `${sep.prefix}${basePastSing}`;
      pastPlural = `${sep.prefix}${basePastPlur}`;
    } else {
      pastSingular = `${basePastSing} ${sep.prefix}`;
      pastPlural = `${basePastPlur} ${sep.prefix}`;
    }
  } else {
    // Standard regular past tense using 't kofschip
    const suffixSing = stem.isKofschip ? 'te' : 'de';
    const suffixPlur = stem.isKofschip ? 'ten' : 'den';
    pastSingular = `${stem.cleanStem}${suffixSing}`;
    pastPlural = `${stem.cleanStem}${suffixPlur}`;
  }

  // Perfect tense generation (Auxiliary present + past participle)
  const auxVerb = aux === 'zijn' ? 'zijn' : 'hebben';
  const auxPresent = IRREGULAR_VERBS[auxVerb].present!;
  const perfect: Record<Person, string> = {
    '1s': `${Array.isArray(auxPresent['1s']) ? auxPresent['1s'][0] : auxPresent['1s']} ${participle}`,
    '2s': `${Array.isArray(auxPresent['2s']) ? auxPresent['2s'][0] : auxPresent['2s']} ${participle}`,
    '2s_formal': `${Array.isArray(auxPresent['2s_formal']) ? auxPresent['2s_formal'][0] : auxPresent['2s_formal']} ${participle}`,
    '3s': `${Array.isArray(auxPresent['3s']) ? auxPresent['3s'][0] : auxPresent['3s']} ${participle}`,
    '1p': `${Array.isArray(auxPresent['1p']) ? auxPresent['1p'][0] : auxPresent['1p']} ${participle}`,
    '2p': `${Array.isArray(auxPresent['2p']) ? auxPresent['2p'][0] : auxPresent['2p']} ${participle}`,
    '3p': `${Array.isArray(auxPresent['3p']) ? auxPresent['3p'][0] : auxPresent['3p']} ${participle}`,
  };

  return {
    infinitive: norm,
    stem,
    separable: sep,
    isIrregular: isIrreg,
    auxiliary: aux,
    present,
    presentInverted,
    past: {
      singular: pastSingular,
      plural: pastPlural,
    },
    pastParticiple: participle,
    perfect,
  };
}

// ============================================================================
// Deterministic Answer Checking & Diagnostic Engine
// ============================================================================

/**
 * Normalizes user input for comparison.
 */
function normalizeAnswer(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[.?!,;:]+$/, '') // strip trailing punctuation
    .replace(/\s+/g, ' '); // collapse internal whitespace
}

/**
 * Gathers all accepted variations for a given tense and person.
 */
function getExpectedAnswers(
  infinitive: string,
  tense: Tense,
  person: Person,
  options: CheckOptions = {}
): string[] {
  const norm = infinitive.toLowerCase().trim();
  const sep = splitSeparableVerb(norm);
  const stem = deriveStem(norm);
  const irregular = IRREGULAR_VERBS[norm];

  if (tense === 'pastParticiple') {
    if (irregular) {
      const part = irregular.pastParticiple;
      return Array.isArray(part) ? part : [part];
    }
    return [getPastParticiple(norm)];
  }

  if (tense === 'past') {
    const isPlural = person === '1p' || person === '2p' || person === '3p';
    if (irregular && !sep.isSeparable) {
      const answers = isPlural ? irregular.pastPlural : irregular.pastSingular;
      return Array.isArray(answers) ? answers : [answers];
    }
    if (sep.isSeparable && sep.prefix && sep.baseVerb) {
      const baseIrreg = IRREGULAR_VERBS[sep.baseVerb];
      if (baseIrreg) {
        const raw = isPlural ? baseIrreg.pastPlural : baseIrreg.pastSingular;
        const list = Array.isArray(raw) ? raw : [raw];
        return list.map((form) =>
          options.isSubordinate ? `${sep.prefix}${form}` : `${form} ${sep.prefix}`
        );
      }
      const baseStem = deriveStem(sep.baseVerb);
      const suffix = isPlural ? (baseStem.isKofschip ? 'ten' : 'den') : (baseStem.isKofschip ? 'te' : 'de');
      const basePast = `${baseStem.cleanStem}${suffix}`;
      return [options.isSubordinate ? `${sep.prefix}${basePast}` : `${basePast} ${sep.prefix}`];
    }
    const suffix = isPlural ? (stem.isKofschip ? 'ten' : 'den') : (stem.isKofschip ? 'te' : 'de');
    return [`${stem.cleanStem}${suffix}`];
  }

  if (tense === 'present') {
    if (options.isInverted && person === '2s') {
      if (irregular && irregular.presentInverted?.['2s']) {
        const inv = irregular.presentInverted['2s']!;
        return Array.isArray(inv) ? inv : [inv];
      }
      if (sep.isSeparable && sep.prefix && sep.baseVerb) {
        const baseStem = deriveStem(sep.baseVerb);
        return [`${baseStem.cleanStem} ${sep.prefix}`];
      }
      return [stem.cleanStem];
    }

    if (irregular && !sep.isSeparable && irregular.present?.[person]) {
      const pres = irregular.present[person]!;
      return Array.isArray(pres) ? pres : [pres];
    }

    if (sep.isSeparable && sep.prefix && sep.baseVerb) {
      const baseStem = deriveStem(sep.baseVerb);
      const isPlural = person === '1p' || person === '2p' || person === '3p';
      let baseForm = '';
      if (isPlural) {
        baseForm = sep.baseVerb;
      } else if (person === '1s') {
        baseForm = baseStem.cleanStem;
      } else {
        baseForm = baseStem.cleanStem.endsWith('t') ? baseStem.cleanStem : `${baseStem.cleanStem}t`;
      }

      if (options.isSubordinate) {
        return [`${sep.prefix}${baseForm}`];
      }
      return [`${baseForm} ${sep.prefix}`];
    }

    // Standard regular present
    if (person === '1p' || person === '2p' || person === '3p') {
      return [norm];
    }
    if (person === '1s') {
      return [stem.cleanStem];
    }
    const tForm = stem.cleanStem.endsWith('t') ? stem.cleanStem : `${stem.cleanStem}t`;
    return [tForm];
  }

  if (tense === 'perfect') {
    const participle = getPastParticiple(norm);
    const auxType = selectAuxiliary(norm, options.hasDestination);
    const auxOptions: ('hebben' | 'zijn')[] = auxType === 'both' ? ['hebben', 'zijn'] : [auxType];

    const results: string[] = [];
    for (const a of auxOptions) {
      const forms = IRREGULAR_VERBS[a].present![person];
      const formList = Array.isArray(forms) ? forms : [forms];
      for (const f of formList) {
        results.push(`${f} ${participle}`);
      }
    }
    return results;
  }

  return [];
}

/**
 * Validates a user's conjugation attempt and generates diagnostic pedagogical feedback.
 */
export function checkConjugation(params: {
  infinitive: string;
  tense: Tense;
  person: Person;
  userAnswer: string;
  options?: CheckOptions;
}): CheckResult {
  const { infinitive, tense, person, userAnswer, options = {} } = params;
  const normUser = normalizeAnswer(userAnswer);
  const expectedAnswers = getExpectedAnswers(infinitive, tense, person, options);
  const isCorrect = expectedAnswers.some((ans) => normalizeAnswer(ans) === normUser);

  if (isCorrect) {
    return {
      isCorrect: true,
      userAnswer,
      expected: expectedAnswers,
      ruleId: 'correct',
      feedback: 'Correct! Uitstekend gedaan.',
    };
  }

  // Diagnostic error classification
  const stem = deriveStem(infinitive);
  const sep = splitSeparableVerb(infinitive);
  const isPlural = person === '1p' || person === '2p' || person === '3p';

  // 1. Pitfall: v->f or z->s kofschip trap in past tense
  if (tense === 'past' && stem.voicedShift) {
    const wrongSuffix = isPlural ? 'ten' : 'te';
    if (normUser.endsWith(wrongSuffix)) {
      const origChar = stem.originalEndConsonant;
      return {
        isCorrect: false,
        userAnswer,
        expected: expectedAnswers,
        ruleId: stem.voicedShift === 'v->f' ? 'pitfall_v_to_f_kofschip' : 'pitfall_z_to_s_kofschip',
        feedback: `Pitfall: Although '${stem.cleanStem}' ends in '${stem.cleanStem.slice(-1)}', the original stem ends in '${origChar}' ('${infinitive}'). '${origChar}' is NOT in 't kofschip, so you must use -${isPlural ? 'den' : 'de'}, never -${wrongSuffix}!`,
        correctionTip: `Always check the consonant BEFORE the ${stem.voicedShift} spelling change.`,
      };
    }
  }

  // 2. Pitfall: v->f or z->s kofschip trap in past participle
  if (tense === 'pastParticiple' && stem.voicedShift) {
    if (normUser.endsWith('t') && !expectedAnswers[0].endsWith('t')) {
      return {
        isCorrect: false,
        userAnswer,
        expected: expectedAnswers,
        ruleId: 'pitfall_vz_participle',
        feedback: `Pitfall: '${infinitive}' originally ends in '${stem.originalEndConsonant}', which is not in 't kofschip. The participle must end in -d ('${expectedAnswers[0]}'), not -t.`,
        correctionTip: `Consonants v and z are voiced and take -d.`,
      };
    }
  }

  // 3. Jij-inversie error (present tense 2s)
  if (tense === 'present' && person === '2s' && options.isInverted) {
    if (normUser.endsWith('t') && !expectedAnswers[0].endsWith('t')) {
      return {
        isCorrect: false,
        userAnswer,
        expected: expectedAnswers,
        ruleId: 'jij_inversion_error',
        feedback: `Jij-inversie rule: When 'jij' or 'je' follows the verb in questions or inversions, the '-t' suffix is dropped ('${expectedAnswers[0]} jij?').`,
        correctionTip: `Drop the -t when 'jij' is after the verb.`,
      };
    }
  }

  // 4. Redundant double -t when stem already ends in -t
  if (tense === 'present' && (person === '2s' || person === '3s' || person === '2s_formal')) {
    if (stem.cleanStem.endsWith('t') && normUser.endsWith('tt')) {
      return {
        isCorrect: false,
        userAnswer,
        expected: expectedAnswers,
        ruleId: 'stem_ends_in_t',
        feedback: `Stem ending in -t: The stem of '${infinitive}' is '${stem.cleanStem}', which already ends in 't'. Dutch never writes double 'tt' at the end of a verb form.`,
        correctionTip: `Stem already ends in 't' -> do not add another 't'.`,
      };
    }
  }

  // 5. Inseparable prefix participle with unnecessary 'ge-'
  const insep = getInseparablePrefix(infinitive);
  if (tense === 'pastParticiple' && insep && normUser.startsWith('ge')) {
    return {
      isCorrect: false,
      userAnswer,
      expected: expectedAnswers,
      ruleId: 'inseparable_prefix_no_ge',
      feedback: `Inseparable prefix: '${infinitive}' starts with '${insep}-'. Verbs with inseparable prefixes (be-, er-, ge-, her-, ont-, ver-) never take 'ge-' in the participle.`,
      correctionTip: `Use '${expectedAnswers[0]}' without 'ge-'.`,
    };
  }

  // 6. Separable verb participle prefix position (e.g. geopbeld vs opgebeld)
  if (tense === 'pastParticiple' && sep.isSeparable && sep.prefix) {
    if (normUser.startsWith(`ge${sep.prefix}`) || normUser.startsWith('ge')) {
      return {
        isCorrect: false,
        userAnswer,
        expected: expectedAnswers,
        ruleId: 'separable_participle_ge_placement',
        feedback: `Separable verb participle: For separable verbs, 'ge-' goes BETWEEN the prefix ('${sep.prefix}') and the stem ('${expectedAnswers[0]}'), not at the beginning!`,
        correctionTip: `Pattern: prefix + ge + stem (+ t/d) -> '${expectedAnswers[0]}'.`,
      };
    }
  }

  // 7. Separable verb in main clause not split (e.g. "ik opbel" instead of "ik bel op")
  if (tense === 'present' && sep.isSeparable && sep.prefix && !options.isSubordinate) {
    if (normUser.startsWith(sep.prefix)) {
      return {
        isCorrect: false,
        userAnswer,
        expected: expectedAnswers,
        ruleId: 'separable_split_main_clause',
        feedback: `Separable verb split: In main clauses, separable verbs must split. The conjugated verb stays in position 2, and the prefix ('${sep.prefix}') moves to the end ('${expectedAnswers[0]}').`,
        correctionTip: `Conjugate the base verb and put '${sep.prefix}' at the end of the clause.`,
      };
    }
  }

  // 8. Auxiliary verb error in perfect tense (hebben vs zijn)
  if (tense === 'perfect') {
    const aux = selectAuxiliary(infinitive, options.hasDestination);
    const usesHebben = normUser.startsWith('heb') || normUser.startsWith('heeft');
    const usesZijn = normUser.startsWith('ben') || normUser.startsWith('bent') || normUser.startsWith('is') || normUser.startsWith('zijn');

    if (aux === 'zijn' && usesHebben) {
      return {
        isCorrect: false,
        userAnswer,
        expected: expectedAnswers,
        ruleId: 'auxiliary_selection_zijn_required',
        feedback: `'${infinitive}' indicates a change of state, arrival, or departure, and ALWAYS selects 'zijn' as its auxiliary verb.`,
        correctionTip: `Use 'zijn' (ben/bent/is/zijn) instead of 'hebben'.`,
      };
    }

    if (aux === 'hebben' && usesZijn) {
      return {
        isCorrect: false,
        userAnswer,
        expected: expectedAnswers,
        ruleId: 'auxiliary_selection_hebben_required',
        feedback: `'${infinitive}' selects 'hebben' as its auxiliary verb in the perfect tense.`,
        correctionTip: `Use 'hebben' (heb/hebt/heeft/hebben) instead of 'zijn'.`,
      };
    }
  }

  // 9. Standard Kofschip mismatch in past tense (-te vs -de)
  if (tense === 'past') {
    const expectedSuffix = isPlural ? (stem.isKofschip ? 'ten' : 'den') : (stem.isKofschip ? 'te' : 'de');
    const wrongSuffix = isPlural ? (stem.isKofschip ? 'den' : 'ten') : (stem.isKofschip ? 'de' : 'te');
    if (normUser.endsWith(wrongSuffix)) {
      return {
        isCorrect: false,
        userAnswer,
        expected: expectedAnswers,
        ruleId: stem.isKofschip ? 'kofschip_expected_te' : 'kofschip_expected_de',
        feedback: `'t Kofschip rule: The original end consonant of '${infinitive}' is '${stem.originalEndConsonant}', which ${
          stem.isKofschip ? 'IS' : 'is NOT'
        } in 't kofschip (t, k, f, s, ch, p, x). Use -${expectedSuffix}, not -${wrongSuffix}.`,
        correctionTip: stem.isKofschip ? `Consonant '${stem.originalEndConsonant}' is voiceless -> -${expectedSuffix}` : `Consonant '${stem.originalEndConsonant}' is voiced -> -${expectedSuffix}`,
      };
    }
  }

  // Generic fallback explanation
  return {
    isCorrect: false,
    userAnswer,
    expected: expectedAnswers,
    ruleId: 'general_conjugation_error',
    feedback: `Incorrect. Expected: '${expectedAnswers.join("' or '")}'.`,
  };
}

// ============================================================================
// Utility / Exploration Exports
// ============================================================================

export function isIrregular(infinitive: string): boolean {
  const norm = infinitive.toLowerCase().trim();
  if (IRREGULAR_VERBS[norm]) return true;
  const sep = splitSeparableVerb(norm);
  return Boolean(sep.isSeparable && sep.baseVerb && IRREGULAR_VERBS[sep.baseVerb]);
}

export function getIrregularInfo(infinitive: string): IrregularVerbEntry | null {
  const norm = infinitive.toLowerCase().trim();
  return IRREGULAR_VERBS[norm] || null;
}

export function listIrregularVerbs(): string[] {
  return Object.keys(IRREGULAR_VERBS);
}
