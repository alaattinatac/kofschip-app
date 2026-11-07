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
  barsten: {
    infinitive: 'barsten',
    pastSingular: 'barstte',
    pastPlural: 'barstten',
    pastParticiple: 'gebarsten',
    auxiliary: 'zijn',
  },
  bederven: {
    infinitive: 'bederven',
    pastSingular: 'bedierf',
    pastPlural: 'bedierven',
    pastParticiple: 'bedorven',
    auxiliary: 'both',
  },
  bedriegen: {
    infinitive: 'bedriegen',
    pastSingular: 'bedroog',
    pastPlural: 'bedrogen',
    pastParticiple: 'bedrogen',
    auxiliary: 'hebben',
  },
  behangen: {
    infinitive: 'behangen',
    pastSingular: 'behing',
    pastPlural: 'behingen',
    pastParticiple: 'behangen',
    auxiliary: 'hebben',
  },
  bergen: {
    infinitive: 'bergen',
    pastSingular: 'borg',
    pastPlural: 'borgen',
    pastParticiple: 'geborgen',
    auxiliary: 'hebben',
  },
  bevelen: {
    infinitive: 'bevelen',
    pastSingular: 'beval',
    pastPlural: 'bevalen',
    pastParticiple: 'bevolen',
    auxiliary: 'hebben',
  },
  bewegen: {
    infinitive: 'bewegen',
    pastSingular: 'bewoog',
    pastPlural: 'bewogen',
    pastParticiple: 'bewogen',
    auxiliary: 'hebben',
  },
  bewijzen: {
    infinitive: 'bewijzen',
    pastSingular: 'bewees',
    pastPlural: 'bewezen',
    pastParticiple: 'bewezen',
    auxiliary: 'hebben',
  },
  bidden: {
    infinitive: 'bidden',
    pastSingular: 'bad',
    pastPlural: 'baden',
    pastParticiple: 'gebeden',
    auxiliary: 'hebben',
  },
  bijten: {
    infinitive: 'bijten',
    pastSingular: 'beet',
    pastPlural: 'beten',
    pastParticiple: 'gebeten',
    auxiliary: 'hebben',
  },
  binden: {
    infinitive: 'binden',
    pastSingular: 'bond',
    pastPlural: 'bonden',
    pastParticiple: 'gebonden',
    auxiliary: 'hebben',
  },
  blazen: {
    infinitive: 'blazen',
    pastSingular: 'blies',
    pastPlural: 'bliezen',
    pastParticiple: 'geblazen',
    auxiliary: 'hebben',
  },
  blijken: {
    infinitive: 'blijken',
    pastSingular: 'bleek',
    pastPlural: 'bleken',
    pastParticiple: 'gebleken',
    auxiliary: 'zijn',
  },
  blinken: {
    infinitive: 'blinken',
    pastSingular: 'blonk',
    pastPlural: 'blonken',
    pastParticiple: 'geblonken',
    auxiliary: 'hebben',
  },
  braden: {
    infinitive: 'braden',
    pastSingular: 'braadde',
    pastPlural: 'braadden',
    pastParticiple: 'gebraden',
    auxiliary: 'hebben',
  },
  buigen: {
    infinitive: 'buigen',
    pastSingular: 'boog',
    pastPlural: 'bogen',
    pastParticiple: 'gebogen',
    auxiliary: 'hebben',
  },
  drijven: {
    infinitive: 'drijven',
    pastSingular: 'dreef',
    pastPlural: 'dreven',
    pastParticiple: 'gedreven',
    auxiliary: 'both',
  },
  dringen: {
    infinitive: 'dringen',
    pastSingular: 'drong',
    pastPlural: 'drongen',
    pastParticiple: 'gedrongen',
    auxiliary: 'both',
  },
  druipen: {
    infinitive: 'druipen',
    pastSingular: 'droop',
    pastPlural: 'dropen',
    pastParticiple: 'gedropen',
    auxiliary: 'both',
  },
  duiken: {
    infinitive: 'duiken',
    pastSingular: 'dook',
    pastPlural: 'doken',
    pastParticiple: 'gedoken',
    auxiliary: 'both',
  },
  dwingen: {
    infinitive: 'dwingen',
    pastSingular: 'dwong',
    pastPlural: 'dwongen',
    pastParticiple: 'gedwongen',
    auxiliary: 'hebben',
  },
  fluiten: {
    infinitive: 'fluiten',
    pastSingular: 'floot',
    pastPlural: 'floten',
    pastParticiple: 'gefloten',
    auxiliary: 'hebben',
  },
  gelden: {
    infinitive: 'gelden',
    pastSingular: 'gold',
    pastPlural: 'golden',
    pastParticiple: 'gegolden',
    auxiliary: 'hebben',
  },
  genezen: {
    infinitive: 'genezen',
    pastSingular: 'genas',
    pastPlural: 'genazen',
    pastParticiple: 'genezen',
    auxiliary: 'both',
  },
  genieten: {
    infinitive: 'genieten',
    pastSingular: 'genoot',
    pastPlural: 'genoten',
    pastParticiple: 'genoten',
    auxiliary: 'hebben',
  },
  gieten: {
    infinitive: 'gieten',
    pastSingular: 'goot',
    pastPlural: 'goten',
    pastParticiple: 'gegoten',
    auxiliary: 'hebben',
  },
  glijden: {
    infinitive: 'glijden',
    pastSingular: 'gleed',
    pastPlural: 'gleden',
    pastParticiple: 'gegleden',
    auxiliary: 'both',
  },
  glimmen: {
    infinitive: 'glimmen',
    pastSingular: 'glom',
    pastPlural: 'glommen',
    pastParticiple: 'geglommen',
    auxiliary: 'hebben',
  },
  graven: {
    infinitive: 'graven',
    pastSingular: 'groef',
    pastPlural: 'groeven',
    pastParticiple: 'gegraven',
    auxiliary: 'hebben',
  },
  grijpen: {
    infinitive: 'grijpen',
    pastSingular: 'greep',
    pastPlural: 'grepen',
    pastParticiple: 'gegrepen',
    auxiliary: 'hebben',
  },
  heffen: {
    infinitive: 'heffen',
    pastSingular: 'hief',
    pastPlural: 'hieven',
    pastParticiple: 'geheven',
    auxiliary: 'hebben',
  },
  heten: {
    infinitive: 'heten',
    pastSingular: 'heette',
    pastPlural: 'heetten',
    pastParticiple: 'geheten',
    auxiliary: 'hebben',
  },
  hijsen: {
    infinitive: 'hijsen',
    pastSingular: 'hees',
    pastPlural: 'hesen',
    pastParticiple: 'gehesen',
    auxiliary: 'hebben',
  },
  hoeven: {
    infinitive: 'hoeven',
    pastSingular: 'hoefde',
    pastPlural: 'hoefden',
    pastParticiple: 'gehoefd',
    auxiliary: 'hebben',
  },
  houwen: {
    infinitive: 'houwen',
    pastSingular: 'houwde',
    pastPlural: 'houwden',
    pastParticiple: 'gehouwen',
    auxiliary: 'hebben',
  },
  jagen: {
    infinitive: 'jagen',
    pastSingular: ['joeg', 'jaagde'],
    pastPlural: ['joegen', 'jaagden'],
    pastParticiple: 'gejaagd',
    auxiliary: 'hebben',
  },
  klinken: {
    infinitive: 'klinken',
    pastSingular: 'klonk',
    pastPlural: 'klonken',
    pastParticiple: 'geklonken',
    auxiliary: 'hebben',
  },
  kluiven: {
    infinitive: 'kluiven',
    pastSingular: 'kloof',
    pastPlural: 'kloven',
    pastParticiple: 'gekloven',
    auxiliary: 'hebben',
  },
  knijpen: {
    infinitive: 'knijpen',
    pastSingular: 'kneep',
    pastPlural: 'knepen',
    pastParticiple: 'geknepen',
    auxiliary: 'hebben',
  },
  krimpen: {
    infinitive: 'krimpen',
    pastSingular: 'kromp',
    pastPlural: 'krompen',
    pastParticiple: 'gekrompen',
    auxiliary: 'zijn',
  },
  kwijten: {
    infinitive: 'kwijten',
    pastSingular: 'kweet',
    pastPlural: 'kweten',
    pastParticiple: 'gekweten',
    auxiliary: 'hebben',
  },
  laden: {
    infinitive: 'laden',
    pastSingular: 'laadde',
    pastPlural: 'laadden',
    pastParticiple: 'geladen',
    auxiliary: 'hebben',
  },
  liegen: {
    infinitive: 'liegen',
    pastSingular: 'loog',
    pastPlural: 'logen',
    pastParticiple: 'gelogen',
    auxiliary: 'hebben',
  },
  lijden: {
    infinitive: 'lijden',
    pastSingular: 'leed',
    pastPlural: 'leden',
    pastParticiple: 'geleden',
    auxiliary: 'hebben',
  },
  melken: {
    infinitive: 'melken',
    pastSingular: 'molk',
    pastPlural: 'molken',
    pastParticiple: 'gemolken',
    auxiliary: 'hebben',
  },
  meten: {
    infinitive: 'meten',
    pastSingular: 'mat',
    pastPlural: 'maten',
    pastParticiple: 'gemeten',
    auxiliary: 'hebben',
  },
  mijden: {
    infinitive: 'mijden',
    pastSingular: 'meed',
    pastPlural: 'meden',
    pastParticiple: 'gemeden',
    auxiliary: 'hebben',
  },
  ontginnen: {
    infinitive: 'ontginnen',
    pastSingular: 'ontgon',
    pastPlural: 'ontgonnen',
    pastParticiple: 'ontgonnen',
    auxiliary: 'hebben',
  },
  ontluiken: {
    infinitive: 'ontluiken',
    pastSingular: 'ontlook',
    pastPlural: 'ontloken',
    pastParticiple: 'ontloken',
    auxiliary: 'zijn',
  },
  plegen: {
    infinitive: 'plegen',
    pastSingular: 'placht',
    pastPlural: 'plachten',
    pastParticiple: 'gepleegd',
    auxiliary: 'hebben',
  },
  prijzen: {
    infinitive: 'prijzen',
    pastSingular: 'prees',
    pastPlural: 'prezen',
    pastParticiple: 'geprezen',
    auxiliary: 'hebben',
  },
  raden: {
    infinitive: 'raden',
    pastSingular: ['raadde', 'ried'],
    pastPlural: ['raadden', 'rieden'],
    pastParticiple: 'geraden',
    auxiliary: 'hebben',
  },
  rijgen: {
    infinitive: 'rijgen',
    pastSingular: 'reeg',
    pastPlural: 'regen',
    pastParticiple: 'geregen',
    auxiliary: 'hebben',
  },
  rijzen: {
    infinitive: 'rijzen',
    pastSingular: 'rees',
    pastPlural: 'rezen',
    pastParticiple: 'gerezen',
    auxiliary: 'zijn',
  },
  ruiken: {
    infinitive: 'ruiken',
    pastSingular: 'rook',
    pastPlural: 'roken',
    pastParticiple: 'geroken',
    auxiliary: 'hebben',
  },
  scheiden: {
    infinitive: 'scheiden',
    pastSingular: 'scheidde',
    pastPlural: 'scheidden',
    pastParticiple: 'gescheiden',
    auxiliary: 'both',
  },
  schelden: {
    infinitive: 'schelden',
    pastSingular: 'schold',
    pastPlural: 'scholden',
    pastParticiple: 'gescholden',
    auxiliary: 'hebben',
  },
  schenden: {
    infinitive: 'schenden',
    pastSingular: 'schond',
    pastPlural: 'schonden',
    pastParticiple: 'geschonden',
    auxiliary: 'hebben',
  },
  schenken: {
    infinitive: 'schenken',
    pastSingular: 'schonk',
    pastPlural: 'schonken',
    pastParticiple: 'geschonken',
    auxiliary: 'hebben',
  },
  scheppen: {
    infinitive: 'scheppen',
    pastSingular: 'schiep',
    pastPlural: 'schiepen',
    pastParticiple: 'geschapen',
    auxiliary: 'hebben',
  },
  scheren: {
    infinitive: 'scheren',
    pastSingular: 'schoor',
    pastPlural: 'schoren',
    pastParticiple: 'geschoren',
    auxiliary: 'hebben',
  },
  schijnen: {
    infinitive: 'schijnen',
    pastSingular: 'scheen',
    pastPlural: 'schenen',
    pastParticiple: 'geschenen',
    auxiliary: 'hebben',
  },
  schrikken: {
    infinitive: 'schrikken',
    pastSingular: 'schrok',
    pastPlural: 'schrokken',
    pastParticiple: 'geschrokken',
    auxiliary: 'zijn',
  },
  schuilen: {
    infinitive: 'schuilen',
    pastSingular: ['school', 'schuilde'],
    pastPlural: ['scholen', 'schuilden'],
    pastParticiple: 'geschuild',
    auxiliary: 'hebben',
  },
  slijpen: {
    infinitive: 'slijpen',
    pastSingular: 'sleep',
    pastPlural: 'slepen',
    pastParticiple: 'geslepen',
    auxiliary: 'hebben',
  },
  slijten: {
    infinitive: 'slijten',
    pastSingular: 'sleet',
    pastPlural: 'sleten',
    pastParticiple: 'gesleten',
    auxiliary: 'both',
  },
  sluipen: {
    infinitive: 'sluipen',
    pastSingular: 'sloop',
    pastPlural: 'slopen',
    pastParticiple: 'geslopen',
    auxiliary: 'both',
  },
  smijten: {
    infinitive: 'smijten',
    pastSingular: 'smeet',
    pastPlural: 'smeten',
    pastParticiple: 'gesmeten',
    auxiliary: 'hebben',
  },
  snuiten: {
    infinitive: 'snuiten',
    pastSingular: 'snoot',
    pastPlural: 'snoten',
    pastParticiple: 'gesnoten',
    auxiliary: 'hebben',
  },
  spannen: {
    infinitive: 'spannen',
    pastSingular: 'spande',
    pastPlural: 'spanden',
    pastParticiple: 'gespannen',
    auxiliary: 'hebben',
  },
  spijten: {
    infinitive: 'spijten',
    pastSingular: 'speet',
    pastPlural: 'speten',
    pastParticiple: 'gespeten',
    auxiliary: 'hebben',
  },
  spinnen: {
    infinitive: 'spinnen',
    pastSingular: 'spon',
    pastPlural: 'sponnen',
    pastParticiple: 'gesponnen',
    auxiliary: 'hebben',
  },
  splijten: {
    infinitive: 'splijten',
    pastSingular: 'spleet',
    pastPlural: 'spleten',
    pastParticiple: 'gespleten',
    auxiliary: 'hebben',
  },
  springen: {
    infinitive: 'springen',
    pastSingular: 'sprong',
    pastPlural: 'sprongen',
    pastParticiple: 'gesprongen',
    auxiliary: 'both',
  },
  spruiten: {
    infinitive: 'spruiten',
    pastSingular: 'sproot',
    pastPlural: 'sproten',
    pastParticiple: 'gesproten',
    auxiliary: 'zijn',
  },
  spugen: {
    infinitive: 'spugen',
    pastSingular: ['spoog', 'spuugde'],
    pastPlural: ['spogen', 'spuugden'],
    pastParticiple: ['gespogen', 'gespuugd'],
    auxiliary: 'hebben',
  },
  steken: {
    infinitive: 'steken',
    pastSingular: 'stak',
    pastPlural: 'staken',
    pastParticiple: 'gestoken',
    auxiliary: 'hebben',
  },
  stijgen: {
    infinitive: 'stijgen',
    pastSingular: 'steeg',
    pastPlural: 'stegen',
    pastParticiple: 'gestegen',
    auxiliary: 'zijn',
  },
  stinken: {
    infinitive: 'stinken',
    pastSingular: 'stonk',
    pastPlural: 'stonken',
    pastParticiple: 'gestunken',
    auxiliary: 'hebben',
  },
  stoten: {
    infinitive: 'stoten',
    pastSingular: ['stootte', 'stiet'],
    pastPlural: ['stootten', 'stieten'],
    pastParticiple: 'gestoten',
    auxiliary: 'hebben',
  },
  strijden: {
    infinitive: 'strijden',
    pastSingular: 'streed',
    pastPlural: 'streden',
    pastParticiple: 'gestreden',
    auxiliary: 'hebben',
  },
  strijken: {
    infinitive: 'strijken',
    pastSingular: 'streek',
    pastPlural: 'streken',
    pastParticiple: 'gestreken',
    auxiliary: 'hebben',
  },
  stuiven: {
    infinitive: 'stuiven',
    pastSingular: 'stoof',
    pastPlural: 'stoven',
    pastParticiple: 'gestoven',
    auxiliary: 'both',
  },
  treden: {
    infinitive: 'treden',
    pastSingular: 'trad',
    pastPlural: 'traden',
    pastParticiple: 'getreden',
    auxiliary: 'both',
  },
  treffen: {
    infinitive: 'treffen',
    pastSingular: 'trof',
    pastPlural: 'troffen',
    pastParticiple: 'getroffen',
    auxiliary: 'hebben',
  },
  verbieden: {
    infinitive: 'verbieden',
    pastSingular: 'verbood',
    pastPlural: 'verboden',
    pastParticiple: 'verboden',
    auxiliary: 'hebben',
  },
  verliezen: {
    infinitive: 'verliezen',
    pastSingular: 'verloor',
    pastPlural: 'verloren',
    pastParticiple: 'verloren',
    auxiliary: 'both',
  },
  verraden: {
    infinitive: 'verraden',
    pastSingular: 'verraadde',
    pastPlural: 'verraadden',
    pastParticiple: 'verraden',
    auxiliary: 'hebben',
  },
  verwijten: {
    infinitive: 'verwijten',
    pastSingular: 'verweet',
    pastPlural: 'verweten',
    pastParticiple: 'verweten',
    auxiliary: 'hebben',
  },
  verzinnen: {
    infinitive: 'verzinnen',
    pastSingular: 'verzon',
    pastPlural: 'verzonnen',
    pastParticiple: 'verzonnen',
    auxiliary: 'hebben',
  },
  vlechten: {
    infinitive: 'vlechten',
    pastSingular: 'vlocht',
    pastPlural: 'vlochten',
    pastParticiple: 'gevlochten',
    auxiliary: 'hebben',
  },
  vouwen: {
    infinitive: 'vouwen',
    pastSingular: 'vouwde',
    pastPlural: 'vouwden',
    pastParticiple: 'gevouwen',
    auxiliary: 'hebben',
  },
  vriezen: {
    infinitive: 'vriezen',
    pastSingular: 'vroor',
    pastPlural: 'vroren',
    pastParticiple: 'gevroren',
    auxiliary: 'both',
  },
  waaien: {
    infinitive: 'waaien',
    pastSingular: ['waaide', 'woei'],
    pastPlural: ['waaiden', 'woeien'],
    pastParticiple: 'gewaaid',
    auxiliary: 'both',
  },
  wegen: {
    infinitive: 'wegen',
    pastSingular: 'woog',
    pastPlural: 'wogen',
    pastParticiple: 'gewogen',
    auxiliary: 'hebben',
  },
  werpen: {
    infinitive: 'werpen',
    pastSingular: 'wierp',
    pastPlural: 'wierpen',
    pastParticiple: 'geworpen',
    auxiliary: 'hebben',
  },
  werven: {
    infinitive: 'werven',
    pastSingular: 'wierf',
    pastPlural: 'wierven',
    pastParticiple: 'geworven',
    auxiliary: 'hebben',
  },
  weven: {
    infinitive: 'weven',
    pastSingular: 'weefde',
    pastPlural: 'weefden',
    pastParticiple: 'geweven',
    auxiliary: 'hebben',
  },
  wijken: {
    infinitive: 'wijken',
    pastSingular: 'week',
    pastPlural: 'weken',
    pastParticiple: 'geweken',
    auxiliary: 'zijn',
  },
  winden: {
    infinitive: 'winden',
    pastSingular: 'wond',
    pastPlural: 'wonden',
    pastParticiple: 'gewonden',
    auxiliary: 'hebben',
  },
  wrijven: {
    infinitive: 'wrijven',
    pastSingular: 'wreef',
    pastPlural: 'wreven',
    pastParticiple: 'gewreven',
    auxiliary: 'hebben',
  },
  wringen: {
    infinitive: 'wringen',
    pastSingular: 'wrong',
    pastPlural: 'wrongen',
    pastParticiple: 'gewrongen',
    auxiliary: 'hebben',
  },
  zenden: {
    infinitive: 'zenden',
    pastSingular: 'zond',
    pastPlural: 'zonden',
    pastParticiple: 'gezonden',
    auxiliary: 'hebben',
  },
  zinken: {
    infinitive: 'zinken',
    pastSingular: 'zonk',
    pastPlural: 'zonken',
    pastParticiple: 'gezonken',
    auxiliary: 'zijn',
  },
  zinnen: {
    infinitive: 'zinnen',
    pastSingular: 'zon',
    pastPlural: 'zonnen',
    pastParticiple: 'gezonnen',
    auxiliary: 'hebben',
  },
  zuigen: {
    infinitive: 'zuigen',
    pastSingular: 'zoog',
    pastPlural: 'zogen',
    pastParticiple: 'gezogen',
    auxiliary: 'hebben',
  },
  zuipen: {
    infinitive: 'zuipen',
    pastSingular: 'zoop',
    pastPlural: 'zopen',
    pastParticiple: 'gezopen',
    auxiliary: 'hebben',
  },
  zwellen: {
    infinitive: 'zwellen',
    pastSingular: 'zwol',
    pastPlural: 'zwollen',
    pastParticiple: 'gezwollen',
    auxiliary: 'zijn',
  },
  zweren: {
    infinitive: 'zweren',
    pastSingular: 'zwoer',
    pastPlural: 'zwoeren',
    pastParticiple: 'gezworen',
    auxiliary: 'hebben',
  },
  zwerven: {
    infinitive: 'zwerven',
    pastSingular: 'zwierf',
    pastPlural: 'zwierven',
    pastParticiple: 'gezworven',
    auxiliary: 'both',
  },
  zwijgen: {
    infinitive: 'zwijgen',
    pastSingular: 'zweeg',
    pastPlural: 'zwegen',
    pastParticiple: 'gezwegen',
    auxiliary: 'hebben',
  },
};

// ============================================================================
// Dutch Verb Validation — Strict Whitelist
// ============================================================================

/**
 * Comprehensive whitelist of known regular Dutch verbs (regelmatige werkwoorden).
 * Only verbs in this set OR in IRREGULAR_VERBS will be accepted for conjugation.
 * Separable compounds (prefix + known base) are also accepted.
 *
 * This list covers common regular verbs used in NT2 education and daily Dutch.
 */
/**
 * Comprehensive whitelist of known regular Dutch verbs (regelmatige werkwoorden).
 * Only verbs in this set OR in IRREGULAR_VERBS will be accepted for conjugation.
 * Separable compounds (prefix + known base) are also accepted.
 *
 * This list covers common regular verbs used in NT2 education and daily Dutch.
 */
export const REGULAR_VERBS = new Set<string>([
  // ── A ──
  'aanbieden', 'aanhoren', 'aankleden', 'aanleggen', 'aanmaken', 'aanmelden',
  'aannemen', 'aanpassen', 'aanraden', 'aanraken', 'aansluiten', 'aantasten',
  'aantonen', 'aantrekken', 'aanvallen', 'aanvragen', 'aanvullen', 'aanwaaien',
  'aanwijzen', 'aanzetten', 'aarzelen', 'abonneren', 'absorberen', 'accepteren',
  'acclimatiseren', 'accommoderen', 'achten', 'acteren', 'activeren', 'actualiseren',
  'ademen', 'adopteren', 'adviseren', 'afbakenen', 'afbedelen', 'afbellen',
  'afbetalen', 'afbreken', 'afdalen', 'afdanken', 'afdelen', 'afdrogen',
  'afgaan', 'afgeven', 'afhalen', 'afhandelen', 'afhangen', 'afhuren',
  'afkeuren', 'afkijken', 'afkoelen', 'afkomen', 'afleggen', 'afleiden',
  'aflopen', 'afmaken', 'afnemen', 'afpakken', 'afrekenen', 'afremmen',
  'afscheiden', 'afschrijven', 'afsluiten', 'afsmeren', 'afsnijden', 'afspreken',
  'afstappen', 'afstemmen', 'afstuderen', 'aftellen', 'aftreden', 'aftrekken',
  'afvallen', 'afvoeren', 'afvragen', 'afwachten', 'afwassen', 'afwijzen',
  'afwisselen', 'afzeggen', 'afzetten', 'afzien', 'ageren', 'alarmeren',
  'amuseren', 'analyseren', 'anticiperen', 'antwoorden', 'apostroferen', 'applaudisseren',
  'arriveren', 'articuleren', 'asfalteren', 'assimileren', 'associëren', 'attenderen',
  // ── B ──
  'baden', 'bakkeleien', 'bakken', 'balanceren', 'balen', 'bankieren',
  'barricaderen', 'baseren', 'beantwoorden', 'becommentariëren', 'bedanken', 'bedekken',
  'bedillen', 'bedoelen', 'bedreigen', 'bedriegen', 'bedrukken', 'bedwingen',
  'beëindigen', 'befaamd', 'begaan', 'begeleiden', 'begraven', 'begroeten',
  'behandelen', 'beheersen', 'beheren', 'behoren', 'behouden', 'bekampen',
  'bekennen', 'bekijken', 'bekladden', 'beklagen', 'bekleden', 'beklemmen',
  'beklemtonen', 'beklimmen', 'bekomen', 'bekommeren', 'bekonen', 'bekopen',
  'bekorten', 'bekritiseren', 'belanden', 'belasten', 'beledigen', 'beleggen',
  'beleven', 'bellen', 'belonen', 'beloven', 'beluisteren', 'bemannen',
  'bemerken', 'bemiddelen', 'benaderen', 'benijden', 'benoemen', 'benutten',
  'beoefenen', 'beogen', 'beoordelen', 'bepalen', 'beplanten', 'bepreken',
  'beproeven', 'beramen', 'bereiden', 'bereiken', 'berekenen', 'bergen',
  'berichten', 'berispen', 'berusten', 'beschadigen', 'beschermen', 'beschikken',
  'beschilderen', 'beschouwen', 'beschrijven', 'beschuldigen', 'beseffen', 'beslissen',
  'besmeren', 'besmetten', 'besnoeien', 'besparen', 'bespioneren', 'bespotten',
  'bespreken', 'besproeien', 'bestaan', 'besteden', 'bestellen', 'bestemmen',
  'bestoken', 'bestralen', 'bestrijden', 'bestuderen', 'besturen', 'betalen',
  'betekenen', 'betichten', 'betitelen', 'betogen', 'betoveren', 'betrachten',
  'betreffen', 'betrekken', 'betreuren', 'betuigen', 'betwijfelen', 'bevatten',
  'beveiligen', 'bevelen', 'bevestigen', 'bevinden', 'bevlekken', 'bevloeien',
  'bevolken', 'bevorderen', 'bevriezen', 'bevrijden', 'bewaken', 'bewandelen',
  'bewaren', 'bewegen', 'beweren', 'bewerken', 'bewerkstelligen', 'bewijzen',
  'bewolken', 'bewonderen', 'bewonen', 'bezetten', 'bezichtigen', 'bezinken',
  'bezinnen', 'bezitten', 'bezoeken', 'bezorgen', 'bezuinigen', 'bezwaren',
  'bezwijken', 'bidden', 'biechten', 'bijdragen', 'bijeenkomen', 'bijhouden',
  'bijknippen', 'bijkomen', 'bijleggen', 'bijpraten', 'bijschaven', 'bijsluiten',
  'bijstaan', 'bijsturen', 'bijtanken', 'bijten', 'bijvullen', 'bijwerken',
  'bijwonen', 'bijzetten', 'binden', 'bivakkeren', 'bladeren', 'blankvoorn',
  'blazen', 'bleek', 'bleken', 'blij', 'bliksemen', 'blinken',
  'bloeden', 'bloeien', 'blokkeren', 'blozen', 'boeken', 'boeten',
  'boetseren', 'bombarderen', 'bonzen', 'boren', 'borstelen', 'botsen',
  'bouwen', 'boycotten', 'braden', 'braken', 'branden', 'brandmerken',
  'breiden', 'breien', 'brullen', 'buigen', 'bukken', 'bundelen',
  // ── C ──
  'calibreren', 'camoufleren', 'camperen', 'cancellen', 'canoniseren', 'capaciteren',
  'casten', 'catapulteren', 'categoriseren', 'cederen', 'censureren', 'centreren',
  'certificeren', 'charteren', 'chatten', 'chaufferen', 'checken', 'chicaneren',
  'chocqueren', 'circuleren', 'citeren', 'claimen', 'classificeren', 'claxonneren',
  'coachen', 'coderen', 'collaboreren', 'combineren', 'commanderen', 'communiceren',
  'compareren', 'compenseren', 'compileren', 'completeren', 'complimenteren', 'componeren',
  'composteren', 'compromitteren', 'concentreren', 'concluderen', 'concurreren', 'condoleren',
  'confereren', 'configureren', 'confirmeren', 'confronteren', 'connecten', 'consolideren',
  'constateren', 'construeren', 'consulteren', 'consumeren', 'contacteren', 'contamineren',
  'continueren', 'contracteren', 'contrasteren', 'controleren', 'converseren', 'converteren',
  'coördineren', 'corrigeren', 'corrumperen', 'creëren', 'cultiveren',
  // ── D ──
  'dalen', 'dampen', 'dansen', 'daperen', 'darmelen', 'dateren',
  'debatteren', 'debuteren', 'declareren', 'decolleteren', 'decoreren', 'deduceren',
  'definiëren', 'degraderen', 'dekken', 'delegeren', 'delen', 'demaskeren',
  'demonstreren', 'deponeren', 'deporten', 'deporteren', 'deprimeren', 'derven',
  'desinfecteren', 'destabiliseren', 'destilleren', 'detecteren', 'determineren', 'devalueren',
  'dialogeren', 'dicteren', 'dienen', 'differentiëren', 'diffunderen', 'dijken',
  'dimmen', 'diplomeren', 'dirigeren', 'disconteren', 'discrimineren', 'discussiëren',
  'diskwalificeren', 'dispenseren', 'distantiëren', 'distribueren', 'divergeren', 'diversifiëren',
  'documenteren', 'dolen', 'domineren', 'dompelen', 'donderen', 'doneren',
  'dopen', 'doseren', 'douchen', 'downloaden', 'draaien', 'draineren',
  'dramatiseren', 'dreigen', 'drempelen', 'drentelen', 'dreunen', 'dribbelen',
  'drogen', 'dromen', 'druisen', 'drukken', 'druppelen', 'duelleren',
  'duiden', 'duiken', 'dulden', 'dumpen', 'dunken', 'duren',
  'durven', 'duwen', 'dwalen', 'dwarsbomen', 'dwingen',
  // ── E ──
  'ebben', 'echobereken', 'echoen', 'echoën', 'editen', 'educeren',
  'eenmaken', 'eerbiedigen', 'egaliseren', 'eigenen', 'eindigen', 'eisen',
  'elimineren', 'emanciperen', 'emigreren', 'emitteren', 'emuleren', 'encrypteren',
  'engageren', 'enquêteren', 'enteren', 'enthousiasmeren', 'equipen', 'ergeren',
  'erkennen', 'ervaren', 'erven', 'escaleren', 'escorteren', 'etableren',
  'etaleren', 'etiketteren', 'evalueren', 'evangeliseren', 'evenaren', 'evolueren',
  'examineren', 'excelleren', 'excluderen', 'executeren', 'exemplifiëren', 'experimenteren',
  'expliceren', 'exploderen', 'exploiteren', 'exporteren', 'exposeren', 'extrapoleren',
  // ── F ──
  'fabriceren', 'faciliteren', 'factureren', 'falen', 'falsifiëren', 'fascineren',
  'fatsoeneren', 'favoriseren', 'faxen', 'federeren', 'feesten', 'feliciteren',
  'fêteren', 'fietsen', 'figureren', 'fileren', 'filmen', 'filosoferen',
  'filteren', 'filtreren', 'financieren', 'fingeren', 'finishen', 'fixeren',
  'flaneren', 'flapperen', 'flirten', 'flitsen', 'fluctueren', 'fluisteren',
  'focussen', 'foetelen', 'folteren', 'forceren', 'forenzen', 'formateren',
  'formeren', 'formuleren', 'fotograferen', 'fragmenteren', 'frankeren', 'frequenteren',
  'frituren', 'fronzen', 'frustreren', 'functioneren', 'funderen', 'fusioneren',
  // ── G ──
  'galmen', 'galopperen', 'gapen', 'garanderen', 'gebaren', 'gebruiken',
  'geeuwen', 'gehoorzamen', 'geldeisen', 'gelijken', 'geloven', 'genereren',
  'genieten', 'geraken', 'geschieden', 'getuigen', 'geuren', 'gidsen',
  'gillen', 'gissen', 'glanzen', 'glijden', 'glimlachen', 'glimmen',
  'glinsteren', 'glooien', 'gluren', 'goedkeuren', 'golven', 'goochelen',
  'googelen', 'gooien', 'gourmetten', 'grabbelen', 'grappen', 'graven',
  'grenzen', 'grijnzen', 'grijpen', 'grissen', 'groeien', 'groeten',
  'grommen', 'gronden', 'gruwen', 'gummen', 'gunnen',
  // ── H ──
  'haasten', 'haken', 'hakkelen', 'hakken', 'halen', 'halveren',
  'hameren', 'handelen', 'handhaven', 'handtekenen', 'hanteren', 'haperen',
  'harden', 'harken', 'harmonieren', 'harmoniseren', 'harsen', 'haten',
  'havenen', 'hechten', 'heersen', 'helen', 'helmteken', 'heractiveren',
  'herademen', 'herberekenen', 'herbergen', 'herbouwen', 'herdefiniëren', 'herdenken',
  'herformuleren', 'herhaaldelijk', 'herhalen', 'herinneren', 'herkennen', 'herlezen',
  'hernieuwen', 'hernoemen', 'heropenen', 'heroverwegen', 'herplaatsen', 'herpositioneren',
  'herprogrammeren', 'herroepen', 'herstellen', 'hervatten', 'herwaarderen', 'herzien',
  'heten', 'hijgen', 'hikken', 'hinderen', 'hinkelen', 'hoesten',
  'homogeniseren', 'hopen', 'hoppen', 'horen', 'hosten', 'huichelen',
  'huilen', 'huisvesten', 'huiveren', 'huldigen', 'huren', 'huwen',
  // ── I ──
  'idealiseren', 'identificeren', 'ijveren', 'illustreren', 'imiteren', 'immigreren',
  'immuniseren', 'impacten', 'implementeren', 'impliceren', 'imponeren', 'importeren',
  'improviseren', 'inademen', 'inburgeren', 'incasseren', 'includeren', 'indelen',
  'indiceren', 'indoctrineren', 'indrukken', 'infecteren', 'informeren', 'ingrijpen',
  'inhalen', 'inhouden', 'inleveren', 'inlijsten', 'inloggen', 'inmaken',
  'innemen', 'innoveren', 'inpakken', 'inrichten', 'inschatten', 'inschrijven',
  'insinueren', 'insmeren', 'inspannen', 'inspecteren', 'inspireren', 'installeren',
  'instappen', 'instellen', 'instemmen', 'instrueren', 'integreren', 'intensiveren',
  'interacteren', 'interesseren', 'interfereren', 'internaliseren', 'interpreteren', 'interrumperen',
  'interviewen', 'intimideren', 'introduceren', 'investeren', 'inviteren', 'invullen',
  'inzamelen', 'inzetten', 'inzien', 'inzoomen', 'irriteren', 'isoleren',
  // ── J ──
  'jagen', 'jammen', 'jammeren', 'janken', 'jatten', 'joggen',
  'jongleren', 'jubelen', 'juichen', 'justeren', 'jutten',
  // ── K ──
  'kaartspelen', 'kaatsen', 'kabbelen', 'kajakken', 'kalmeren', 'kammen',
  'kampen', 'kamperen', 'kankeren', 'kantelen', 'kappen', 'karakteriseren',
  'kassieren', 'katapulteren', 'keilen', 'kelderen', 'kenmerken', 'kennen',
  'kenteren', 'keren', 'kermen', 'kerven', 'ketenen', 'ketsen',
  'kibbelen', 'kiemen', 'kietelen', 'kijven', 'klagen', 'klappen',
  'kleden', 'kleppen', 'kletsen', 'kleuren', 'klikken', 'klimatiseren',
  'klinken', 'kloppen', 'kluisteren', 'knabbelen', 'knagen', 'knakken',
  'knallen', 'knappen', 'knarsen', 'kneden', 'knielen', 'kniezen',
  'knikken', 'knippen', 'knipperen', 'knoeien', 'knopen', 'knorren',
  'knotten', 'knuffelen', 'knuppelen', 'knutselen', 'koersen', 'koesteren',
  'koffiezetten', 'koken', 'kolken', 'kopiëren', 'koppelen', 'kortsluiten',
  'kosten', 'kotsen', 'krabben', 'kraken', 'krassen', 'kriebelen',
  'krijsen', 'krijten', 'kritiseren', 'kronkelen', 'kruiden', 'kruien',
  'kruisen', 'kuchen', 'kussen', 'kwaken', 'kwakkelen', 'kwalificeren',
  'kweken', 'kwelen', 'kwellen', 'kwetsen', 'kwispelen',
  // ── L ──
  'lachen', 'laden', 'laken', 'lakken', 'lamleggen', 'landen',
  'lappen', 'laseren', 'lassen', 'lasteren', 'lauweren', 'laveren',
  'leasen', 'lebberen', 'ledigen', 'leeglopen', 'leegmaken', 'leegruimen',
  'leggen', 'leiden', 'lekken', 'lenen', 'leren', 'lesgeven',
  'lessen', 'letten', 'leunen', 'leuteren', 'leven', 'leveren',
  'liberaliseren', 'lichten', 'liefhebben', 'lijden', 'lijmen', 'lijnen',
  'lijsten', 'likken', 'limiteren', 'linken', 'logeren', 'loggen',
  'lokken', 'lonken', 'loochenen', 'loodsen', 'lossen', 'loven',
  'lozen', 'luchten', 'luiden', 'luieren', 'luiken', 'luisteren',
  'lukken', 'lunchen', 'lurken', 'lusten',
  // ── M ──
  'maaien', 'machtigen', 'mailen', 'maken', 'malen', 'manen',
  'mankeren', 'manoeuvreren', 'markeren', 'martelen', 'maskeren', 'masseren',
  'matchen', 'matigen', 'maximaliseren', 'mechaniseren', 'mededelen', 'mediëren',
  'mediteren', 'meedelen', 'meedingen', 'meedoen', 'meegaan', 'meegeven',
  'meehelpen', 'meekomen', 'meeleven', 'meemaken', 'meenemen', 'meerijden',
  'meespelen', 'meewerken', 'meezingen', 'melden', 'mengen', 'merken',
  'mesten', 'meten', 'metselen', 'meubileren', 'middelen', 'mijmeren',
  'mijnen', 'mikken', 'minderen', 'minimaliseren', 'mislukken', 'mismaken',
  'misnoegen', 'misrekenen', 'missen', 'mistasten', 'misten', 'misvatten',
  'modelleren', 'modereren', 'moderniseren', 'modificeren', 'moederen', 'moedigen',
  'monteren', 'mopperen', 'morren', 'morsen', 'motiveren', 'motoriseren',
  'muilkorven', 'murmureren', 'muteren',
  // ── N ──
  'naaien', 'nabootsen', 'nabrengen', 'nademen', 'nadenken', 'naderen',
  'nadoen', 'nagelen', 'nagloeien', 'najagen', 'nakijken', 'nakomen',
  'nalaten', 'naleven', 'namaken', 'narekenen', 'naspelen', 'naspeuren',
  'nastreven', 'natellen', 'natrekken', 'navigeren', 'nazoeken', 'neerbuigen',
  'neerhalen', 'neerklappen', 'neerleggen', 'neerploffen', 'neerschieten', 'neerstorten',
  'neerzetten', 'negeren', 'neigen', 'nemen', 'nestelen', 'netwerken',
  'neutraliseren', 'nevelen', 'niezen', 'nihileren', 'niksen', 'noemen',
  'noodzaken', 'nopen', 'normaliseren', 'noteren', 'notificeren', 'nuanceren',
  'nummeren', 'nuttigen',
  // ── O ──
  'oefenen', 'oeuvreren', 'offeren', 'omarmen', 'ombouwen', 'omcirkelen',
  'omdraaien', 'omheinen', 'omhelzen', 'omkaderen', 'omkeren', 'omkijken',
  'omkomen', 'omkopen', 'omleiden', 'omrekenen', 'omschrijven', 'omspelen',
  'omstoten', 'omvatten', 'omverblazen', 'omwaaien', 'omwandelen', 'omwisselen',
  'omzeilen', 'omzetten', 'omzwaaien', 'onderbouwen', 'onderbreken', 'onderbrengen',
  'ondergaan', 'onderhandelen', 'onderhouden', 'onderkennen', 'onderkoelen', 'ondernemen',
  'onderschatten', 'onderscheiden', 'ondersteunen', 'onderstrepen', 'ondertekenen', 'onderwijzen',
  'onderzoeken', 'ontbijten', 'ontbranden', 'ontdekken', 'ontdoen', 'onteren',
  'ontfermen', 'ontfutselen', 'ontgassen', 'ontgroenen', 'ontharen', 'onthouden',
  'onthullen', 'ontkennen', 'ontkiemen', 'ontkleuren', 'ontkoppelen', 'ontladen',
  'ontlasten', 'ontleden', 'ontlenen', 'ontlopen', 'ontmantelen', 'ontmaskeren',
  'ontmoeten', 'ontnemen', 'ontnuchteren', 'ontploffen', 'ontplooien', 'ontraden',
  'ontrafelen', 'ontremmen', 'ontroeren', 'ontrollen', 'ontronen', 'ontroven',
  'ontruimen', 'ontslaan', 'ontsnappen', 'ontspannen', 'ontsporen', 'ontspringen',
  'ontstaan', 'ontsteken', 'ontstemmen', 'ontvangen', 'ontvlammen', 'ontvluchten',
  'ontvolken', 'ontvouwen', 'ontvreemden', 'ontwaken', 'ontwapenen', 'ontwerpen',
  'ontwijken', 'ontwikkelen', 'ontwortelen', 'ontzeggen', 'ontzetten', 'oordelen',
  'opbellen', 'opbergen', 'opbeuren', 'opbieden', 'opbinden', 'opblazen',
  'opbouwen', 'opbrengen', 'opdagen', 'opdelven', 'opdienen', 'opdoen',
  'opdragen', 'opdraven', 'opdrinken', 'opdrogen', 'opduiken', 'opeisen',
  'openbaren', 'openbreken', 'opendoen', 'openen', 'opengaan', 'openmaken',
  'openstaan', 'opereren', 'opeten', 'opfrissen', 'opgaan', 'opgeven',
  'opgroeien', 'ophalen', 'ophangen', 'opheffen', 'ophelderen', 'ophitsen',
  'ophopen', 'ophouden', 'opjagen', 'opkammen', 'opkijken', 'opklaren',
  'opklimmen', 'opknappen', 'opkomen', 'opkopen', 'opladen', 'oplaten',
  'opleggen', 'opleiden', 'oplepelen', 'opleven', 'opleveren', 'oplichten',
  'oplopen', 'oplossen', 'opmaken', 'opmerken', 'opnemen', 'opofferen',
  'oppakken', 'oppassen', 'opperen', 'oppoetsen', 'oppompen', 'oprakelen',
  'opredderen', 'opregelen', 'oprichten', 'oprijden', 'oprispen', 'oproepen',
  'oprollen', 'opruimen', 'oprukken', 'opschalen', 'opschieten', 'opschonen',
  'opschorten', 'opschrijven', 'opslaan', 'opslokken', 'opsluiten', 'opsmukken',
  'opsnuiven', 'opsporen', 'opstaan', 'opstapelen', 'opstappen', 'opstarten',
  'opsteken', 'opstellen', 'opstoken', 'opsturen', 'optafelen', 'optellen',
  'optillen', 'optimaliseren', 'optreden', 'optrekken', 'opvallen', 'opvangen',
  'opvatten', 'opvoeden', 'opvoeren', 'opvolgen', 'opvouwen', 'opvullen',
  'opwarmen', 'opwekken', 'opwerpen', 'opzetten', 'opzoeken', 'opzouten',
  'opzwellen', 'ordenen', 'organiseren', 'oriënteren', 'overblijven', 'overbrengen',
  'overbruggen', 'overdenken', 'overdragen', 'overdrijven', 'overeenkomen', 'overgaan',
  'overgieten', 'overgroeien', 'overhalen', 'overhandigen', 'overheersen', 'overhellen',
  'overkappen', 'overkoken', 'overkomen', 'overkruisen', 'overladen', 'overlappen',
  'overlaten', 'overleggen', 'overleven', 'overlijden', 'overmaken', 'overmeesteren',
  'overnachten', 'overnemen', 'overpeinzen', 'overplaatsen', 'overrompelen', 'overschakelen',
  'overschatten', 'overschrijden', 'overschrijven', 'overspoelen', 'overstappen', 'oversteken',
  'overstromen', 'overtellen', 'overtuigen', 'overuren', 'overvallen', 'overvaren',
  'overvechten', 'overvliegen', 'overvloeien', 'overwegen', 'overweldigen', 'overwinnen',
  'overwinteren', 'overzenden', 'overzetten', 'overzien',
  // ── P ──
  'paaien', 'paardrij', 'paarrij', 'paden', 'pakken', 'paniekeren',
  'panikeren', 'paraderen', 'parkeren', 'participeren', 'passen', 'passeren',
  'patrouilleren', 'pauzeren', 'peddelen', 'peilen', 'peinzen', 'pellen',
  'pendelen', 'penetreren', 'pennen', 'peperen', 'perfectioneren', 'perforeren',
  'persen', 'persisteren', 'personaliseren', 'pesten', 'peuteren', 'piekeren',
  'piepen', 'pijlen', 'pijnigen', 'pikken', 'pinnen', 'pionieren',
  'pissen', 'pitchen', 'plaatsen', 'plakken', 'plannen', 'planten',
  'plassen', 'plaveien', 'plegen', 'pleisteren', 'pleiten', 'plempen',
  'plengen', 'pleuren', 'plezieren', 'ploeteren', 'ploffen', 'plooien',
  'pluizen', 'plukken', 'plunderen', 'pochen', 'poederen', 'poetsen',
  'pogen', 'polariseren', 'polijsten', 'polsen', 'pompen', 'poneren',
  'populariseren', 'porteren', 'positioneren', 'posten', 'poten', 'prakken',
  'praktiseren', 'praten', 'preken', 'prepareren', 'presenteren', 'pressen',
  'presteren', 'pretenderen', 'prevaleren', 'prikkelen', 'prikken', 'prioriteren',
  'privatiseren', 'proberen', 'procederen', 'produceren', 'proeven', 'profileren',
  'profiteren', 'programmeren', 'projecteren', 'promoten', 'promoveren', 'pronken',
  'propageren', 'proppen', 'prospereren', 'prostitueren', 'protesteren', 'pruttelen',
  'publiceren', 'pulsen', 'pulseren', 'pushen', 'puzzelen',
  // ── Q ──
  'quilten', 'quizzen', 'quoten',
  // ── R ──
  'racen', 'raden', 'radicaliseren', 'raffelen', 'raken', 'rammen',
  'rangschikken', 'rapporteren', 'raspen', 'ratelen', 'rationaliseren', 'ravotten',
  'reageren', 'realiseren', 'rebooten', 'recapituleren', 'recyclen', 'redden',
  'redderen', 'redeneren', 'redistribueren', 'reduceren', 'refereren', 'reflecteren',
  'reformeren', 'regelen', 'regeren', 'registreren', 'reiken', 'reilen',
  'reinigen', 'reizen', 'rekenen', 'rekken', 'rekruteren', 'relativeren',
  'relaxen', 'releveren', 'remmen', 'renderen', 'rennen', 'renoveren',
  'rentenieren', 'reorganiseren', 'repareren', 'repatriëren', 'repeteren', 'repliceren',
  'representeren', 'reproduceren', 'reserveren', 'resetten', 'resideren', 'resigneren',
  'resisteren', 'respecteren', 'responderen', 'restaureren', 'resten', 'resteren',
  'restitueren', 'resulteren', 'resumeren', 'retailen', 'retarderen', 'retireren',
  'retoucheren', 'retourneren', 'revideren', 'revitaliseren', 'richten', 'rijden',
  'rijmen', 'rijpen', 'rimpelen', 'rinkelen', 'riskeren', 'ritselen',
  'rivaliseren', 'roeien', 'roeren', 'roesten', 'roken', 'rollen',
  'romantiseren', 'rommelen', 'rondbrengen', 'ronddelen', 'ronddraaien', 'rondgaan',
  'rondkijken', 'rondleiden', 'rondlopen', 'rondreizen', 'rondsturen', 'roosteren',
  'roteren', 'rotsen', 'rotzooien', 'rouleren', 'rouwen', 'roven',
  'ruiken', 'ruilen', 'ruimen', 'ruisen', 'rukken', 'rusten',
  'ruziën',
  // ── S ──
  'saboteren', 'salderen', 'samenstellen', 'samenvatten', 'samenwerken', 'saneren',
  'sauzen', 'scannen', 'schaatsen', 'schaden', 'schaduwen', 'schaffen',
  'schakelen', 'schamen', 'schatten', 'schaven', 'scheiden', 'schelen',
  'schenken', 'scheppen', 'scheren', 'schetsen', 'schiften', 'schikken',
  'schilderen', 'schillen', 'schimmelen', 'schitteren', 'schoffelen', 'schofferen',
  'schokken', 'schommelen', 'schonen', 'schoolen', 'schoonmaken', 'schoppen',
  'schorsen', 'schotelen', 'schrapen', 'schrappen', 'schreeuwen', 'schrikken',
  'schrobben', 'schromen', 'schudden', 'schuieren', 'schuifelen', 'schuilen',
  'schuimen', 'schutteren', 'sealen', 'segmenteren', 'seinen', 'selecteren',
  'separeren', 'seponeren', 'serveren', 'settelen', 'shoppen', 'shorten',
  'showen', 'signaleren', 'signeren', 'simuleren', 'sjouwen', 'skeeleren',
  'slachten', 'slagen', 'slenteren', 'slepen', 'sleutelen', 'slijpen',
  'slijten', 'slikken', 'slingeren', 'sloffen', 'slopen', 'sluieren',
  'slurpen', 'smachten', 'smaken', 'smakken', 'smeden', 'smeken',
  'smeren', 'smijten', 'smokkelen', 'smokken', 'smoren', 'smullen',
  'snakken', 'snappen', 'snauwen', 'sneeuwen', 'snerpen', 'snijden',
  'snoepen', 'snorkelen', 'snotteren', 'snuffelen', 'snuiten', 'solliciteren',
  'sommeren', 'sorteren', 'souperen', 'spalken', 'spannen', 'sparen',
  'sparren', 'specialiseren', 'specifiëren', 'speculeren', 'spelen', 'spenderen',
  'spieden', 'spiegelen', 'spijkeren', 'spitten', 'splitsen', 'spoeden',
  'spoelen', 'sponsoren', 'sporten', 'spotten', 'spreiden', 'springen',
  'sproeien', 'spugen', 'spuiten', 'staken', 'stamelen', 'stampen',
  'stappen', 'starten', 'stationeren', 'staven', 'stechelen', 'stelen',
  'stellen', 'stemmen', 'stempelen', 'steunen', 'stichten', 'stijgen',
  'stikken', 'stillen', 'stilstaan', 'stimuleren', 'stinken', 'stipuleren',
  'stoeien', 'stoffen', 'stofferen', 'stomen', 'stooien', 'stoppen',
  'storen', 'stormen', 'storten', 'stoten', 'straffen', 'stralen',
  'stranden', 'strekken', 'strelen', 'stremmen', 'strepen', 'streven',
  'strijden', 'strijken', 'strikken', 'stromen', 'strooien', 'struikelen',
  'struinen', 'studeren', 'stuiteren', 'sturen', 'stylen', 'subsidiëren',
  'substitueren', 'subsumeren', 'succederen', 'suggereren', 'suizen', 'supporteren',
  'surfen', 'surveilleren', 'symboliseren', 'sympathiseren', 'synchroniseren', 'synthetiseren',
  'systematiseren',
  // ── T ──
  'tackelen', 'takelen', 'tanken', 'tapdansen', 'tappen', 'tasten',
  'tatoeëren', 'taxeren', 'teisteren', 'tekenen', 'telefoneren', 'tellen',
  'temmen', 'temperen', 'tentoonstellen', 'terugbellen', 'terugbrengen', 'terugdenken',
  'terugdoen', 'teruggeven', 'terughalen', 'terugkeren', 'terugkijken', 'terugkomen',
  'terugkrijgen', 'terugleggen', 'terugleiden', 'terugnemen', 'terugreizen', 'terugrijden',
  'terugroepen', 'terugschakelen', 'terugschrikken', 'terugsturen', 'terugtrekken', 'terugvallen',
  'terugvinden', 'terugvragen', 'terugzetten', 'terugzien', 'testen', 'tillen',
  'timmeren', 'tintelen', 'tippelen', 'tippen', 'titelen', 'toedienen',
  'toegeven', 'toejuichen', 'toekennen', 'toekijken', 'toekomen', 'toelaten',
  'toelichten', 'toemaken', 'toenemen', 'toepassen', 'toerekenen', 'toerusten',
  'toeschouwen', 'toeslaan', 'toespreken', 'toestaan', 'toestemmen', 'toesturen',
  'toetreden', 'toetsen', 'toevoegen', 'toewijzen', 'toezeggen', 'toezien',
  'tolereren', 'tolken', 'tonen', 'toppen', 'torsen', 'toucheren',
  'toveren', 'trainen', 'transformeren', 'transpireren', 'transplanteren', 'transporteren',
  'trappelen', 'trappen', 'treden', 'treffen', 'treiteren', 'treuren',
  'triggeren', 'triomferen', 'trippelen', 'troepen', 'trommelen', 'troosten',
  'trouwen', 'tuimelen', 'tuinieren', 'turen', 'twijfelen', 'typen',
  'typeren',
  // ── U ──
  'uitademen', 'uitbarsten', 'uitbeelden', 'uitbellen', 'uitblijven', 'uitbreiden',
  'uitbrengen', 'uitdagen', 'uitdelen', 'uitdoen', 'uitdragen', 'uitdrogen',
  'uitdrukken', 'uitdunnen', 'uiteten', 'uitfluiten', 'uitgaan', 'uitgeven',
  'uitgieten', 'uitglijden', 'uitgooien', 'uitgraven', 'uitgroeien', 'uithalen',
  'uithangen', 'uitharden', 'uithollen', 'uithouden', 'uitjouwen', 'uitkeren',
  'uitkiezen', 'uitkijken', 'uitklappen', 'uitkleden', 'uitkomen', 'uitkopen',
  'uitkrijgen', 'uitlachen', 'uitladen', 'uitlaten', 'uitleggen', 'uitleiden',
  'uitlezen', 'uitlichten', 'uitloggen', 'uitlokken', 'uitlopen', 'uitmaken',
  'uitmeten', 'uitmonden', 'uitnodigen', 'uitoefenen', 'uitpakken', 'uitpeinzen',
  'uitpersen', 'uitpeuteren', 'uitpikken', 'uitpluizen', 'uitpraten', 'uitproberen',
  'uitputten', 'uitrazen', 'uitreiken', 'uitrekenen', 'uitrijden', 'uitroepen',
  'uitrukken', 'uitrusten', 'uitschakelen', 'uitscheiden', 'uitschelden', 'uitschieten',
  'uitschotelen', 'uitschrapen', 'uitschrijven', 'uitslapen', 'uitsluiten', 'uitsmeren',
  'uitsnijden', 'uitspannen', 'uitspelen', 'uitspitten', 'uitspreken', 'uitspringen',
  'uitstaan', 'uitstappen', 'uitsteken', 'uitstellen', 'uitsterven', 'uitstijgen',
  'uitstoten', 'uitstralen', 'uitstrekken', 'uitstrooien', 'uitsturen', 'uittellen',
  'uittesten', 'uittrekken', 'uitvallen', 'uitvangen', 'uitvaren', 'uitvechten',
  'uitvinden', 'uitvissen', 'uitvlakken', 'uitvliegen', 'uitvloeien', 'uitvoeren',
  'uitvouwen', 'uitvragen', 'uitwassen', 'uitwerken', 'uitwijken', 'uitwijzen',
  'uitwisselen', 'uitwissen', 'uitwonen', 'uitzenden', 'uitzetten', 'uitzien',
  'uitzingen', 'uitzitten', 'uitzoeken', 'uitzwaaien', 'updaten', 'upgraden',
  'uploaden', 'usurperen', 'utiliseren',
  // ── V ──
  'vacumeren', 'valideren', 'vallen', 'valoriseren', 'valsspelen', 'vangen',
  'variëren', 'vastbinden', 'vasthangen', 'vasthouden', 'vastklemmen', 'vastklikken',
  'vastknopen', 'vastleggen', 'vastmaken', 'vastnagelen', 'vastpakken', 'vastpinnen',
  'vastroesten', 'vaststellen', 'vastzitten', 'vegeteren', 'veinzen', 'ventileren',
  'verachten', 'verademen', 'veranderen', 'verankeren', 'verarmen', 'verbannen',
  'verbazen', 'verbeelden', 'verbergen', 'verbeteren', 'verbeuren', 'verbieden',
  'verbijsteren', 'verbinden', 'verbitteren', 'verbleken', 'verblinden', 'verbloemen',
  'verbouwen', 'verbranden', 'verbreden', 'verbreiden', 'verbreken', 'verbrokkelen',
  'verdampen', 'verdedigen', 'verdelen', 'verdenken', 'verdichten', 'verdienen',
  'verdiepen', 'verdikken', 'verdoezelen', 'verdoven', 'verdragen', 'verdrijven',
  'verdrukken', 'verdubbelen', 'verduidelijken', 'verduisteren', 'verdunnen', 'verduurzamen',
  'verdwalen', 'vereenvoudigen', 'vereenzelvigen', 'vereisen', 'verenigen', 'vereren',
  'verergeren', 'verfraaien', 'verfrissen', 'vergaderen', 'vergelden', 'vergelijken',
  'vergemakkelijken', 'vergen', 'vergiftigen', 'vergissen', 'verglazen', 'vergoeden',
  'vergroten', 'vergunnen', 'verhalen', 'verhandelen', 'verharden', 'verhaspelen',
  'verheffen', 'verhelderen', 'verheugen', 'verhinderen', 'verhogen', 'verhoren',
  'verhuizen', 'verhullen', 'verhuren', 'verijdelen', 'verinnerlijken', 'verjagen',
  'verjaren', 'verjongen', 'verkassen', 'verkavelen', 'verkeren', 'verkiezen',
  'verklaren', 'verkleden', 'verkleinen', 'verklemmen', 'verklikken', 'verknallen',
  'verknopen', 'verkoelen', 'verkoken', 'verkopen', 'verkorten', 'verkrampen',
  'verkrijgen', 'verkwanselen', 'verkwikken', 'verkwisten', 'verlagen', 'verlammen',
  'verlanden', 'verlangen', 'verlaten', 'verleggen', 'verleiden', 'verlekkeren',
  'verlenen', 'verlengen', 'verlichten', 'verliezen', 'verlinken', 'verlokken',
  'verloochenen', 'verlopen', 'verlossen', 'verloten', 'verloven', 'verluchten',
  'verlustigen', 'vermageren', 'vermaken', 'vermannen', 'vermeerderen', 'vermeesteren',
  'vermelden', 'vermengen', 'vermeubelen', 'vermijden', 'verminderen', 'vermoeden',
  'vermoeien', 'vermoorden', 'vermorzelen', 'vernaaien', 'vernederen', 'vernevelen',
  'vernietigen', 'vernieuwen', 'vernoemen', 'vernuchteren', 'verongelukken', 'verontreinigen',
  'verontrusten', 'verontschuldigen', 'verontwaardiging', 'veroordelen', 'veroorloven', 'veroorzaken',
  'verorberen', 'verouderen', 'veroveren', 'verpachten', 'verpakken', 'verpesten',
  'verplaatsen', 'verplanten', 'verplegen', 'verplichten', 'verplichting', 'verprutsen',
  'verraden', 'verrassen', 'verrekenen', 'verrijken', 'verroeren', 'verrotten',
  'verruimen', 'verruwen', 'verschaffen', 'verschansen', 'verschijnen', 'verschillen',
  'verschonen', 'verschrompelen', 'verschuiven', 'versieren', 'versimpelen', 'verslaan',
  'verslapen', 'verslappen', 'verslechteren', 'verslepen', 'verslikken', 'versluieren',
  'versmallen', 'versnellen', 'versnipperen', 'versoberen', 'versoepelen', 'versperren',
  'verspieden', 'verspillen', 'verspreiden', 'verstaan', 'verstalen', 'verstappen',
  'verstarren', 'verstellen', 'versterken', 'verstikken', 'verstommen', 'verstoppen',
  'verstoren', 'verstoten', 'verstrakken', 'verstrikken', 'verstrooien', 'verstruikelen',
  'versturen', 'vertakken', 'vertalen', 'vertegenwoordigen', 'vertellen', 'verteren',
  'vertimmeren', 'vertoeven', 'vertolken', 'vertonen', 'vertragen', 'vertrappen',
  'vertroebelen', 'vertroetelen', 'vertroosten', 'vertrouwen', 'vertwijfelen', 'vervaardigen',
  'vervalsen', 'vervangen', 'vervelen', 'verven', 'verversen', 'vervliegen',
  'vervloeien', 'vervluchtigen', 'vervoeren', 'vervolgen', 'vervolledigen', 'vervolmaken',
  'vervormen', 'vervreemden', 'vervuilen', 'vervullen', 'verwaarlozen', 'verwachten',
  'verwanten', 'verwarmen', 'verwarren', 'verwateren', 'verweken', 'verwelken',
  'verwelkomen', 'verwerken', 'verwerpen', 'verwerven', 'verwijden', 'verwijderen',
  'verwijten', 'verwijzen', 'verwisselen', 'verwoesten', 'verwonden', 'verwonderen',
  'verzachten', 'verzadigen', 'verzakken', 'verzamelen', 'verzegelen', 'verzekeren',
  'verzenden', 'verzetten', 'verzilveren', 'verzoeken', 'verzoenen', 'verzoeten',
  'verzorgen', 'verzuimen', 'verzuiveren', 'verzwakken', 'verzwaren', 'vestigen',
  'vieren', 'viesmaken', 'vijlen', 'vinden', 'vissen', 'vlammen',
  'vleien', 'vloeien', 'vlotten', 'vluchten', 'voeden', 'voegen',
  'voelen', 'voeren', 'volbrengen', 'voldoen', 'volgen', 'volharden',
  'volhouden', 'volmaken', 'volstaan', 'voltooien', 'vonken', 'voorbereiden',
  'voorbijgaan', 'voorbijkomen', 'voorbijlopen', 'voorbijrijden', 'voordoen', 'voorgeven',
  'voorhangen', 'voorhebben', 'voorhouden', 'voorkomen', 'voorlezen', 'voorlichten',
  'voorliggen', 'voornemen', 'voorschotelen', 'voorschrijven', 'voorsorteren', 'voorspellen',
  'voorstaan', 'voorstellen', 'vooruitgaan', 'vooruitkijken', 'vooruitlopen', 'vooruitzien',
  'voorzien', 'vorderen', 'vormen', 'vragen', 'vrezen', 'vrijen',
  'vrijlaten', 'vrijmaken', 'vrijspreken', 'vrijstellen', 'vullen',
  // ── W ──
  'waarborgen', 'waardelen', 'waarden', 'waarderen', 'waarnemen', 'waarschuwen',
  'wachten', 'wagen', 'waggelen', 'wallen', 'walsen', 'wandelen',
  'wankelen', 'warmen', 'wassen', 'wateren', 'wauwelen', 'wecken',
  'wedden', 'wederkeren', 'wederopbouwen', 'weergalmen', 'weerhouden', 'weerkaatsen',
  'weerklinken', 'weerleggen', 'weerstaan', 'weerzien', 'wegblijven', 'wegbrengen',
  'wegdoen', 'wegdragen', 'wegduwen', 'wegen', 'wegflitsen', 'weggaan',
  'weggeven', 'weggooien', 'weghalen', 'wegjagen', 'wegkappen', 'wegkijken',
  'wegkomen', 'wegkruipen', 'weglaten', 'wegleggen', 'weglopen', 'wegmaken',
  'wegnemen', 'wegpakken', 'wegrennen', 'wegrijden', 'wegroepen', 'wegrukken',
  'wegschieten', 'wegschoffelen', 'wegschrapen', 'wegschuiven', 'wegslaan', 'wegslikken',
  'wegsluipen', 'wegsmelten', 'wegsmijten', 'wegspoelen', 'wegsteken', 'wegstoppen',
  'wegsturen', 'wegtrekken', 'wegvallen', 'wegvangen', 'wegvaren', 'wegvegen',
  'wegvliegen', 'wegvloeien', 'wegvoeren', 'wegwaaien', 'wegwerpen', 'wegwezen',
  'wegwijzen', 'wegwissen', 'wegzakken', 'wegzenden', 'wegzetten', 'wegzinken',
  'weiden', 'weigeren', 'wekken', 'welken', 'welkomen', 'wellen',
  'wenden', 'wenken', 'wennen', 'wensen', 'wentelen', 'weren',
  'werken', 'werpen', 'weven', 'wieden', 'wiegelen', 'wiegen',
  'wijden', 'wijken', 'wijten', 'wijzigen', 'wikkelen', 'wikken',
  'willigen', 'wimmelen', 'windsurfen', 'winkelen', 'wippen', 'wisselen',
  'wissen', 'woeden', 'woekeren', 'woelen', 'wonen', 'worstelen',
  'wreken', 'wrijven', 'wroeten', 'wurgen',
  // ── Z ──
  'zakken', 'zanden', 'zegevieren', 'zeggen', 'zeiken', 'zeilen',
  'zenden', 'zepen', 'zetten', 'zeuren', 'zieden', 'ziften',
  'zigzaggen', 'zoeken', 'zoemen', 'zoenen', 'zomeren', 'zondigen',
  'zonnebaden', 'zorgen', 'zouten', 'zuchten', 'zuigen', 'zuinigen',
  'zuiveren', 'zullen', 'zussen', 'zwaaien', 'zwakken', 'zwalken',
  'zwammen', 'zwartmaken', 'zwelgen', 'zwemmen', 'zweren', 'zweten',
  'zweven', 'zwiepen', 'zwijgen', 'zwijmelen', 'zwoegen',
]);

/**
 * Checks whether an infinitive is a recognised Dutch verb infinitive (regular, irregular, or separable).
 */
export function isValidInfinitive(word: string): boolean {
  if (!word) return false;
  const norm = word.toLowerCase().trim();
  if (norm.length < 2) return false;
  if (!/^[a-züïëéèêöä\s-]+$/i.test(norm)) return false;

  if (IRREGULAR_VERBS[norm]) return true;
  if (REGULAR_VERBS.has(norm)) return true;
  if (AUXILIARY_ZIJN_VERBS.has(norm)) return true;
  if (AUXILIARY_BOTH_VERBS.has(norm)) return true;

  const sep = splitSeparableVerb(norm);
  if (sep.isSeparable && sep.baseVerb) {
    if (IRREGULAR_VERBS[sep.baseVerb]) return true;
    if (REGULAR_VERBS.has(sep.baseVerb)) return true;
    if (AUXILIARY_ZIJN_VERBS.has(sep.baseVerb)) return true;
    if (AUXILIARY_BOTH_VERBS.has(sep.baseVerb)) return true;
  }

  return false;
}

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
    (norm.endsWith('emen') && !norm.endsWith('nemen')) ||
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
 *
 * @throws {Error} If the input is not a valid Dutch verb infinitive.
 */
// ============================================================================
// Comprehensive Dutch Verb Lemmatization & Conjugation Matching Map
// ============================================================================

/**
 * Global map of every recognized Dutch conjugated verb form (and infinitive)
 * to its canonical infinitive lemma.
 *
 * e.g.
 * 'liep' -> 'lopen'
 * 'gelopen' -> 'lopen'
 * 'loopt' -> 'lopen'
 * 'loop' -> 'lopen'
 * 'lopen' -> 'lopen'
 * 'nam' -> 'nemen'
 * 'werkte' -> 'werken'
 * 'opgebeld' -> 'opbellen'
 * 'belde op' -> 'opbellen'
 */
export const VERB_LEMMATIZATION_MAP = new Map<string, string>();

let isLemmatizationInitialized = false;

function registerLemmaForm(form: string | undefined | null, infinitive: string): void {
  if (!form) return;
  const clean = form.toLowerCase().trim();
  if (clean.length < 2) return;
  // If an exact infinitive is already in the map mapping to itself, do not overwrite
  if (VERB_LEMMATIZATION_MAP.has(clean) && VERB_LEMMATIZATION_MAP.get(clean) === clean) {
    return;
  }
  // Prefer shorter/simpler infinitives over separable compounds:
  // e.g. "loopt" should map to "lopen" not "weglopen"
  const existing = VERB_LEMMATIZATION_MAP.get(clean);
  if (existing && existing !== clean && existing.length <= infinitive.length) {
    return; // Keep the existing shorter/simpler mapping
  }
  VERB_LEMMATIZATION_MAP.set(clean, infinitive);
}

function registerLemmaForms(
  forms: (string | undefined | null)[] | string | undefined | null,
  infinitive: string
): void {
  if (!forms) return;
  if (Array.isArray(forms)) {
    for (const f of forms) registerLemmaForm(f, infinitive);
  } else {
    registerLemmaForm(forms, infinitive);
  }
}

/**
 * Initializes the comprehensive reverse-lookup conjugation map.
 * Precomputes forms for all irregular and regular verbs in the database.
 */
export function initLemmatizationMap(): void {
  if (isLemmatizationInitialized) return;
  isLemmatizationInitialized = true;

  // 1. Register all infinitives directly to themselves (highest priority)
  for (const inf of Object.keys(IRREGULAR_VERBS)) {
    VERB_LEMMATIZATION_MAP.set(inf, inf);
  }
  for (const inf of REGULAR_VERBS) {
    VERB_LEMMATIZATION_MAP.set(inf, inf);
  }
  for (const inf of AUXILIARY_ZIJN_VERBS) {
    VERB_LEMMATIZATION_MAP.set(inf, inf);
  }
  for (const inf of AUXILIARY_BOTH_VERBS) {
    VERB_LEMMATIZATION_MAP.set(inf, inf);
  }

  // 2. Index irregular verbs with their specialized conjugations
  for (const [inf, entry] of Object.entries(IRREGULAR_VERBS)) {
    registerLemmaForms(entry.pastSingular, inf);
    registerLemmaForms(entry.pastPlural, inf);
    registerLemmaForms(entry.pastParticiple, inf);

    if (entry.present) {
      for (const forms of Object.values(entry.present)) {
        registerLemmaForms(forms, inf);
      }
    }
    if (entry.presentInverted) {
      for (const forms of Object.values(entry.presentInverted)) {
        registerLemmaForms(forms, inf);
      }
    }

    // Default regular present for irregular verbs without explicit present overrides
    try {
      const stem = deriveStem(inf);
      registerLemmaForm(stem.cleanStem, inf);
      if (!stem.cleanStem.endsWith('t')) {
        registerLemmaForm(`${stem.cleanStem}t`, inf);
      }
    } catch {
      // ignore
    }
  }

  // 3. Index regular verbs
  for (const inf of REGULAR_VERBS) {
    try {
      const stem = deriveStem(inf);
      const clean = stem.cleanStem;
      registerLemmaForm(clean, inf);
      const tForm = clean.endsWith('t') ? clean : `${clean}t`;
      registerLemmaForm(tForm, inf);

      const suffixSing = stem.isKofschip ? 'te' : 'de';
      const suffixPlur = stem.isKofschip ? 'ten' : 'den';
      registerLemmaForm(`${clean}${suffixSing}`, inf);
      registerLemmaForm(`${clean}${suffixPlur}`, inf);

      const participle = getPastParticiple(inf);
      registerLemmaForm(participle, inf);
    } catch {
      // ignore
    }
  }

  // 4. Index common separable verbs and their split/joined forms
  const allKnownInfinitives = new Set([
    ...Object.keys(IRREGULAR_VERBS),
    ...REGULAR_VERBS,
    ...AUXILIARY_ZIJN_VERBS,
    ...AUXILIARY_BOTH_VERBS,
  ]);

  for (const inf of allKnownInfinitives) {
    const sep = splitSeparableVerb(inf);
    if (sep.isSeparable && sep.prefix && sep.baseVerb) {
      const prefix = sep.prefix;
      const base = sep.baseVerb;
      const baseIrreg = IRREGULAR_VERBS[base];
      const baseStem = deriveStem(base);

      // Participle (e.g. "opgebeld", "aangekomen")
      try {
        const part = getPastParticiple(inf);
        registerLemmaForm(part, inf);
      } catch {
        // ignore
      }

      // Past forms
      let pastSingList: string[] = [];
      let pastPlurList: string[] = [];
      if (baseIrreg) {
        pastSingList = Array.isArray(baseIrreg.pastSingular) ? baseIrreg.pastSingular : [baseIrreg.pastSingular];
        pastPlurList = Array.isArray(baseIrreg.pastPlural) ? baseIrreg.pastPlural : [baseIrreg.pastPlural];
      } else {
        const suffixSing = baseStem.isKofschip ? 'te' : 'de';
        const suffixPlur = baseStem.isKofschip ? 'ten' : 'den';
        pastSingList = [`${baseStem.cleanStem}${suffixSing}`];
        pastPlurList = [`${baseStem.cleanStem}${suffixPlur}`];
      }

      for (const ps of pastSingList) {
        registerLemmaForm(`${ps} ${prefix}`, inf); // e.g. "belde op", "kwam aan"
        registerLemmaForm(`${prefix}${ps}`, inf);   // subordinate: "opbelde", "aankwam"
      }
      for (const pp of pastPlurList) {
        registerLemmaForm(`${pp} ${prefix}`, inf); // e.g. "belden op", "kwamen aan"
        registerLemmaForm(`${prefix}${pp}`, inf);   // subordinate: "opbelden", "aankwamen"
      }

      // Present forms
      const ikBase = baseStem.cleanStem;
      const tBase = ikBase.endsWith('t') ? ikBase : `${ikBase}t`;
      registerLemmaForm(`${ikBase} ${prefix}`, inf); // "bel op"
      registerLemmaForm(`${tBase} ${prefix}`, inf);  // "belt op"
      registerLemmaForm(`${prefix}${ikBase}`, inf);  // "opbel"
      registerLemmaForm(`${prefix}${tBase}`, inf);   // "opbelt"
    }
  }
}

// Ensure map is initialized on module load
initLemmatizationMap();

/**
 * Resolves any valid Dutch verb form (infinitive, conjugated present/past,
 * participle, or separable form) to its canonical infinitive (lemma).
 *
 * Returns `null` if the input is not a recognized Dutch verb.
 *
 * @example
 * resolveInfinitive("liep")      // "lopen"
 * resolveInfinitive("gelopen")   // "lopen"
 * resolveInfinitive("loopt")     // "lopen"
 * resolveInfinitive("lopen")     // "lopen"
 * resolveInfinitive("werkte")    // "werken"
 * resolveInfinitive("opgebeld")  // "opbellen"
 * resolveInfinitive("belde op")  // "opbellen"
 * resolveInfinitive("hello")     // null
 */
export function resolveInfinitive(input: string): string | null {
  if (!input) return null;
  const norm = input
    .toLowerCase()
    .trim()
    .replace(/[?!.,;:]+$/, '')
    .trim()
    .replace(/\s+/g, ' ');

  if (norm.length < 2) return null;

  initLemmatizationMap();

  // 1. Direct O(1) match in precomputed lemmatization map
  const exact = VERB_LEMMATIZATION_MAP.get(norm);
  if (exact) return exact;

  // 2. Direct infinitive check
  if (isValidInfinitive(norm)) return norm;

  // 3. Multi-word checks:
  const words = norm.split(' ');
  if (words.length === 2) {
    const [w1, w2] = words;

    // Auxiliary + past participle: e.g. "heeft gewerkt", "ben gegaan", "is geweest"
    const auxForms = new Set([
      'heb', 'hebt', 'heeft', 'hebben', 'had', 'hadden',
      'ben', 'bent', 'is', 'zijn', 'was', 'waren',
      'word', 'wordt', 'werd', 'werden', 'geworden'
    ]);
    if (auxForms.has(w1)) {
      const matchParticiple = VERB_LEMMATIZATION_MAP.get(w2);
      if (matchParticiple) return matchParticiple;
    }

    // Separable verb position: e.g. "loopt mee", "kwam aan", "belde op"
    for (const prefix of SEPARABLE_PREFIXES) {
      if (w2 === prefix) {
        const baseLemma = VERB_LEMMATIZATION_MAP.get(w1);
        if (baseLemma) {
          const candidateCompound = `${prefix}${baseLemma}`;
          if (isValidInfinitive(candidateCompound)) {
            return candidateCompound;
          }
        }
      }
    }
  }

  // 4. Separable past participle pattern: prefix + 'ge' + participle rest (e.g. "opgebeld", "aangekomen")
  for (const prefix of SEPARABLE_PREFIXES) {
    if (norm.startsWith(prefix + 'ge') && norm.length > prefix.length + 4) {
      const baseParticiple = norm.slice(prefix.length); // "gebeld", "gekomen"
      const baseLemma = VERB_LEMMATIZATION_MAP.get(baseParticiple);
      if (baseLemma) {
        const candidateCompound = `${prefix}${baseLemma}`;
        if (isValidInfinitive(candidateCompound)) {
          return candidateCompound;
        }
      }
    }
  }

  // 5. Separable compound prefix + base verb / base form
  for (const prefix of SEPARABLE_PREFIXES) {
    if (norm.startsWith(prefix) && norm.length > prefix.length + 2) {
      const rest = norm.slice(prefix.length);
      const baseLemma = VERB_LEMMATIZATION_MAP.get(rest);
      if (baseLemma) {
        const candidateCompound = `${prefix}${baseLemma}`;
        if (isValidInfinitive(candidateCompound)) {
          return candidateCompound;
        }
      }
    }
  }

  return null;
}

/** Alias for resolveInfinitive */
export const lemmatizeVerb = resolveInfinitive;

/**
 * Checks whether the input is a valid Dutch verb (infinitive or conjugated form).
 */
export function isValidDutchVerb(input: string): boolean {
  if (!input) return false;
  const norm = input.toLowerCase().trim();
  if (norm.length < 2) return false;
  if (!/^[a-züïëéèêöä\s-]+$/i.test(norm)) return false;

  return resolveInfinitive(norm) !== null;
}

/**
 * Checks whether the input is strictly an infinitive of a recognized Dutch verb.
 */
export function isDutchVerbInfinitive(input: string): boolean {
  if (!input) return false;
  const norm = input.toLowerCase().trim();
  const resolved = resolveInfinitive(norm);
  return resolved !== null && resolved === norm;
}

export function conjugate(
  verbOrForm: string,
  options: { isInverted?: boolean; isSubordinate?: boolean } = {}
): FullConjugation {
  const norm = verbOrForm.toLowerCase().trim();

  // Guard: lemmatize and reject non-Dutch / non-verb inputs before running any algorithm
  const infinitive = resolveInfinitive(norm);
  if (!infinitive) {
    throw new Error(`INVALID_DUTCH_VERB: Dit is geen geldig Nederlands werkwoord. ("${norm}")`);
  }
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
    '1p': infinitive,
    '2p': infinitive,
    '3p': infinitive,
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
      present['1p'] = infinitive;
      present['2p'] = infinitive;
      present['3p'] = infinitive;
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
    present['1p'] = infinitive;
    present['2p'] = infinitive;
    present['3p'] = infinitive;

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
    infinitive: infinitive,
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
 *
 * @throws {Error} If the infinitive is not a valid Dutch verb.
 */
export function checkConjugation(params: {
  infinitive: string;
  tense: Tense;
  person: Person;
  userAnswer: string;
  options?: CheckOptions;
}): CheckResult {
  const { infinitive, tense, person, userAnswer, options = {} } = params;

  // Guard: only process known/valid Dutch verbs (resolving conjugated forms if provided)
  const normInf = infinitive.toLowerCase().trim();
  const resolved = resolveInfinitive(normInf);
  if (!resolved) {
    throw new Error(`INVALID_DUTCH_VERB: Dit is geen geldig Nederlands werkwoord. ("${infinitive}")`);
  }
  const cleanInfinitive = resolved;
  const normUser = normalizeAnswer(userAnswer);
  const expectedAnswers = getExpectedAnswers(cleanInfinitive, tense, person, options);
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
  const isIrreg = isIrregular(infinitive);

  // Irregular verbs: 't kofschip rule (-te / -de) MUST ONLY apply to regular (zwak) verbs.
  // For irregular verbs, directly explain the irregular forms without 't kofschip calculations.
  if (isIrreg) {
    if (tense === 'past') {
      return {
        isCorrect: false,
        userAnswer,
        expected: expectedAnswers,
        ruleId: 'irregular_verb_past',
        feedback: `'${infinitive}' is een onregelmatig werkwoord (sterk werkwoord). De 't kofschip-regel (-te / -de) geldt NIET voor onregelmatige werkwoorden! De juiste verleden tijd (O.V.T.) is: '${expectedAnswers.join("' of '")}'.`,
        correctionTip: `'${infinitive}' is onregelmatig: ${expectedAnswers.join(', ')}.`,
      };
    }

    if (tense === 'pastParticiple') {
      return {
        isCorrect: false,
        userAnswer,
        expected: expectedAnswers,
        ruleId: 'irregular_verb_participle',
        feedback: `'${infinitive}' is een onregelmatig werkwoord. Het voltooid deelwoord (V.T.T.) volgt niet de regel van 't kofschip (-t/-d). De juiste vorm is: '${expectedAnswers.join("' of '")}'.`,
        correctionTip: `'${infinitive}' is onregelmatig: ${expectedAnswers.join(', ')}.`,
      };
    }
  }

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
