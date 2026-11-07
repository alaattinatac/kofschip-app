/**
 * Comprehensive Test Suite for Verb Engine
 *
 * Verifies all deterministic rules from /directives/verb_rules_sop.md:
 * 1. Stem derivation & spelling rules
 * 2. 't Kofschip past tense & past participle
 * 3. v->f and z->s pitfall prevention
 * 4. Separable & inseparable verbs
 * 5. Hebben vs. zijn auxiliary selection
 * 6. Full conjugations & jij-inversion
 * 7. Diagnostic error feedback & rule detection
 */

import {
  deriveStem,
  isKofschip,
  splitSeparableVerb,
  selectAuxiliary,
  getPastParticiple,
  conjugate,
  checkConjugation,
  isIrregular,
  KOFSCHIP_CONSONANTS,
  resolveInfinitive,
  lookupVerb,
  IRREGULAR_LEMMA_MAP,
} from './verb_engine.ts';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, details?: unknown) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${testName}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${testName}`, details !== undefined ? details : '');
  }
}

function assertEquals<T>(actual: T, expected: T, testName: string) {
  const matches = JSON.stringify(actual) === JSON.stringify(expected);
  assert(matches, testName, { actual, expected });
}

console.log('\n--- 1. STEM DERIVATION & SPELLING RULES ---');

// Unchanged stem
const stemWerk = deriveStem('werken');
assertEquals(stemWerk.cleanStem, 'werk', 'werken -> stem werk');
assertEquals(stemWerk.originalEndConsonant, 'k', 'werken -> original consonant k');
assertEquals(stemWerk.isKofschip, true, 'werken -> is in kofschip');

// Open syllable vowel doubling
const stemMaak = deriveStem('maken');
assertEquals(stemMaak.cleanStem, 'maak', 'maken -> stem maak (vowel doubled)');
assertEquals(stemMaak.vowelDoubled, true, 'maken -> vowelDoubled is true');
assertEquals(stemMaak.originalEndConsonant, 'k', 'maken -> original consonant k');

const stemWoon = deriveStem('wonen');
assertEquals(stemWoon.cleanStem, 'woon', 'wonen -> stem woon');

const stemLeer = deriveStem('leren');
assertEquals(stemLeer.cleanStem, 'leer', 'leren -> stem leer');

// Double consonant reduction
const stemPak = deriveStem('pakken');
assertEquals(stemPak.cleanStem, 'pak', 'pakken -> stem pak (double consonant reduced)');
assertEquals(stemPak.consonantReduced, true, 'pakken -> consonantReduced is true');
assertEquals(stemPak.originalEndConsonant, 'k', 'pakken -> original consonant k');

const stemZet = deriveStem('zetten');
assertEquals(stemZet.cleanStem, 'zet', 'zetten -> stem zet');

const stemRen = deriveStem('rennen');
assertEquals(stemRen.cleanStem, 'ren', 'rennen -> stem ren');

// v -> f shift + original consonant tracking
const stemLeef = deriveStem('leven');
assertEquals(stemLeef.cleanStem, 'leef', 'leven -> stem leef');
assertEquals(stemLeef.originalEndConsonant, 'v', 'leven -> original consonant is v!');
assertEquals(stemLeef.isKofschip, false, 'leven -> v is NOT in kofschip!');
assertEquals(stemLeef.voicedShift, 'v->f', 'leven -> voicedShift is v->f');

// z -> s shift + original consonant tracking
const stemReis = deriveStem('reizen');
assertEquals(stemReis.cleanStem, 'reis', 'reizen -> stem reis');
assertEquals(stemReis.originalEndConsonant, 'z', 'reizen -> original consonant is z!');
assertEquals(stemReis.isKofschip, false, 'reizen -> z is NOT in kofschip!');
assertEquals(stemReis.voicedShift, 'z->s', 'reizen -> voicedShift is z->s');

// Loanwords with 'x' (extended 't ex-kofschip)
const stemFax = deriveStem('faxen');
assertEquals(stemFax.cleanStem, 'fax', 'faxen -> stem fax');
assertEquals(stemFax.originalEndConsonant, 'x', 'faxen -> original consonant x');
assertEquals(stemFax.isKofschip, true, 'faxen -> x is in kofschip');

console.log('\n--- 2. \'T KOFSCHIP PAST TENSE & PARTICIPLES ---');

// Regular kofschip verbs (-te / -ten, ge-...-t)
const cWerk = conjugate('werken');
assertEquals(cWerk.past.singular, 'werkte', 'werken past sing -> werkte');
assertEquals(cWerk.past.plural, 'werkten', 'werken past plur -> werkten');
assertEquals(cWerk.pastParticiple, 'gewerkt', 'werken participle -> gewerkt');

const cKook = conjugate('koken');
assertEquals(cKook.past.singular, 'kookte', 'koken past sing -> kookte');
assertEquals(cKook.pastParticiple, 'gekookt', 'koken participle -> gekookt');

const cLach = conjugate('lachen');
assertEquals(cLach.past.singular, 'lachte', 'lachen past sing -> lachte');
assertEquals(cLach.pastParticiple, 'gelacht', 'lachen participle -> gelacht');

// Non-kofschip regular verbs (-de / -den, ge-...-d)
const cWoon = conjugate('wonen');
assertEquals(cWoon.past.singular, 'woonde', 'wonen past sing -> woonde');
assertEquals(cWoon.past.plural, 'woonden', 'wonen past plur -> woonden');
assertEquals(cWoon.pastParticiple, 'gewoond', 'wonen participle -> gewoond');

const cBouw = conjugate('bouwen');
assertEquals(cBouw.past.singular, 'bouwde', 'bouwen past sing -> bouwde');
assertEquals(cBouw.pastParticiple, 'gebouwd', 'bouwen participle -> gebouwd');

// Stems ending in -t / -d (no double t/d in participle, double in past tense)
const cZet = conjugate('zetten');
assertEquals(cZet.past.singular, 'zette', 'zetten past sing -> zette');
assertEquals(cZet.pastParticiple, 'gezet', 'zetten participle -> gezet (not gezett)');

const cAntwoord = conjugate('antwoorden');
assertEquals(cAntwoord.past.singular, 'antwoordde', 'antwoorden past sing -> antwoordde');
assertEquals(cAntwoord.pastParticiple, 'geantwoord', 'antwoorden participle -> geantwoord (not geantwoordd)');

console.log('\n--- 3. CRITICAL V/Z PITFALL CHECKS ---');

const cLeven = conjugate('leven');
assertEquals(cLeven.past.singular, 'leefde', 'leven past sing -> leefde (NEVER leefte)');
assertEquals(cLeven.past.plural, 'leefden', 'leven past plur -> leefden');
assertEquals(cLeven.pastParticiple, 'geleefd', 'leven participle -> geleefd (NEVER geleeft)');

const cReizen = conjugate('reizen');
assertEquals(cReizen.past.singular, 'reisde', 'reizen past sing -> reisde (NEVER reiste)');
assertEquals(cReizen.past.plural, 'reisden', 'reizen past plur -> reisden');
assertEquals(cReizen.pastParticiple, 'gereisd', 'reizen participle -> gereisd (NEVER gereist)');

console.log('\n--- 4. SEPARABLE & INSEPARABLE VERBS ---');

// Inseparable prefix verbs (be-, ver-, ont- etc.) -> NO ge-
assertEquals(getPastParticiple('betalen'), 'betaald', 'betalen participle -> betaald (no ge-)');
assertEquals(getPastParticiple('vertellen'), 'verteld', 'vertellen participle -> verteld (no ge-)');
assertEquals(getPastParticiple('ontmoeten'), 'ontmoet', 'ontmoeten participle -> ontmoet (no ge-)');
assertEquals(getPastParticiple('gebruiken'), 'gebruikt', 'gebruiken participle -> gebruikt (no ge-)');

// Separable verbs -> split in main clause, ge- inside participle
const sepOpbel = splitSeparableVerb('opbellen');
assertEquals(sepOpbel.isSeparable, true, 'opbellen is separable');
assertEquals(sepOpbel.prefix, 'op', 'opbellen prefix is op');
assertEquals(sepOpbel.baseVerb, 'bellen', 'opbellen base is bellen');

const cOpbel = conjugate('opbellen');
assertEquals(cOpbel.present['1s'], 'bel op', 'opbellen 1s -> bel op');
assertEquals(cOpbel.present['2s'], 'belt op', 'opbellen 2s -> belt op');
assertEquals(cOpbel.presentInverted['2s'], 'bel op', 'opbellen inverted 2s -> bel op');
assertEquals(cOpbel.past.singular, 'belde op', 'opbellen past sing -> belde op');
assertEquals(cOpbel.pastParticiple, 'opgebeld', 'opbellen participle -> opgebeld (ge- inside)');

// Separable irregular verb (aankomen -> kwam aan, aangekomen)
const cAankom = conjugate('aankomen');
assertEquals(cAankom.past.singular, 'kwam aan', 'aankomen past sing -> kwam aan');
assertEquals(cAankom.past.plural, 'kwamen aan', 'aankomen past plur -> kwamen aan');
assertEquals(cAankom.pastParticiple, 'aangekomen', 'aankomen participle -> aangekomen');
assertEquals(cAankom.auxiliary, 'zijn', 'aankomen auxiliary -> zijn');

// Subordinate clause conjugation
const cOpbelSub = conjugate('opbellen', { isSubordinate: true });
assertEquals(cOpbelSub.present['1s'], 'opbel', 'opbellen subordinate 1s -> opbel');
assertEquals(cOpbelSub.past.singular, 'opbelde', 'opbellen subordinate past -> opbelde');

console.log('\n--- 5. HEBBEN VS. ZIJN AUXILIARY SELECTION ---');

assertEquals(selectAuxiliary('werken'), 'hebben', 'werken -> hebben');
assertEquals(selectAuxiliary('maken'), 'hebben', 'maken -> hebben');
assertEquals(selectAuxiliary('zijn'), 'zijn', 'zijn -> zijn');
assertEquals(selectAuxiliary('blijven'), 'zijn', 'blijven -> zijn');
assertEquals(selectAuxiliary('worden'), 'zijn', 'worden -> zijn');
assertEquals(selectAuxiliary('gaan'), 'zijn', 'gaan -> zijn');
assertEquals(selectAuxiliary('komen'), 'zijn', 'komen -> zijn');
assertEquals(selectAuxiliary('vertrekken'), 'zijn', 'vertrekken -> zijn');
assertEquals(selectAuxiliary('sterven'), 'zijn', 'sterven -> zijn');

// Both verbs (activity vs destination)
assertEquals(selectAuxiliary('fietsen'), 'both', 'fietsen -> both');
assertEquals(selectAuxiliary('fietsen', false), 'hebben', 'fietsen (activity) -> hebben');
assertEquals(selectAuxiliary('fietsen', true), 'zijn', 'fietsen (destination) -> zijn');

assertEquals(selectAuxiliary('lopen'), 'both', 'lopen -> both');
assertEquals(selectAuxiliary('lopen', false), 'hebben', 'lopen (activity) -> hebben');
assertEquals(selectAuxiliary('lopen', true), 'zijn', 'lopen (destination) -> zijn');

console.log('\n--- 6. JIJ-INVERSIE & PRESENT TENSE ---');

const cWerkPres = conjugate('werken');
assertEquals(cWerkPres.present['2s'], 'werkt', 'werken normal 2s -> werkt');
assertEquals(cWerkPres.presentInverted['2s'], 'werk', 'werken inverted 2s -> werk (dropped -t)');

const cZit = conjugate('zitten');
assertEquals(cZit.present['2s'], 'zit', 'zitten 2s -> zit (no double tt)');
assertEquals(cZit.present['3s'], 'zit', 'zitten 3s -> zit');

console.log('\n--- 7. DETERMINISTIC ANSWER CHECKER & ERROR DIAGNOSTICS ---');

// Correct answers
const r1 = checkConjugation({
  infinitive: 'werken',
  tense: 'past',
  person: '1s',
  userAnswer: 'werkte',
});
assertEquals(r1.isCorrect, true, 'Check: werkte is correct');
assertEquals(r1.ruleId, 'correct', 'Rule: correct');

// Error: v->f pitfall (student typed "leefte")
const r2 = checkConjugation({
  infinitive: 'leven',
  tense: 'past',
  person: '1s',
  userAnswer: 'leefte',
});
assertEquals(r2.isCorrect, false, 'Check: leefte is flagged incorrect');
assertEquals(r2.ruleId, 'pitfall_v_to_f_kofschip', 'Detected pitfall_v_to_f_kofschip');
assert(r2.feedback.includes("'v' is NOT in 't kofschip"), 'Feedback explains v is not in kofschip');

// Error: z->s pitfall (student typed "reiste")
const r3 = checkConjugation({
  infinitive: 'reizen',
  tense: 'past',
  person: '1s',
  userAnswer: 'reiste',
});
assertEquals(r3.isCorrect, false, 'Check: reiste is flagged incorrect');
assertEquals(r3.ruleId, 'pitfall_z_to_s_kofschip', 'Detected pitfall_z_to_s_kofschip');

// Error: Inseparable prefix with extra ge- (gebetaald)
const r4 = checkConjugation({
  infinitive: 'betalen',
  tense: 'pastParticiple',
  person: '1s',
  userAnswer: 'gebetaald',
});
assertEquals(r4.isCorrect, false, 'Check: gebetaald is flagged incorrect');
assertEquals(r4.ruleId, 'inseparable_prefix_no_ge', 'Detected inseparable_prefix_no_ge');

// Error: Separable prefix wrong ge- placement (geopbeld)
const r5 = checkConjugation({
  infinitive: 'opbellen',
  tense: 'pastParticiple',
  person: '1s',
  userAnswer: 'geopbeld',
});
assertEquals(r5.isCorrect, false, 'Check: geopbeld is flagged incorrect');
assertEquals(r5.ruleId, 'separable_participle_ge_placement', 'Detected separable_participle_ge_placement');

// Error: Jij-inversie forgotten (werkt jij)
const r6 = checkConjugation({
  infinitive: 'werken',
  tense: 'present',
  person: '2s',
  userAnswer: 'werkt',
  options: { isInverted: true },
});
assertEquals(r6.isCorrect, false, 'Check: inverted "werkt" flagged incorrect');
assertEquals(r6.ruleId, 'jij_inversion_error', 'Detected jij_inversion_error');

// Error: Auxiliary mismatch (ik heb gebleven)
const r7 = checkConjugation({
  infinitive: 'blijven',
  tense: 'perfect',
  person: '1s',
  userAnswer: 'heb gebleven',
});
assertEquals(r7.isCorrect, false, 'Check: heb gebleven flagged incorrect');
assertEquals(r7.ruleId, 'auxiliary_selection_zijn_required', 'Detected auxiliary_selection_zijn_required');

// Error: Stem ends in t redundant double tt (praatt)
const r8 = checkConjugation({
  infinitive: 'praten',
  tense: 'present',
  person: '2s',
  userAnswer: 'praatt',
});
assertEquals(r8.isCorrect, false, 'Check: praatt flagged incorrect');
assertEquals(r8.ruleId, 'stem_ends_in_t', 'Detected stem_ends_in_t');

// Error: Separable verb in main clause not split (ik opbel)
const r9 = checkConjugation({
  infinitive: 'opbellen',
  tense: 'present',
  person: '1s',
  userAnswer: 'opbel',
});
assertEquals(r9.isCorrect, false, 'Check: opbel in main clause flagged incorrect');
assertEquals(r9.ruleId, 'separable_split_main_clause', 'Detected separable_split_main_clause');

// Error: Regular kofschip mismatch (werkde instead of werkte)
const r10 = checkConjugation({
  infinitive: 'werken',
  tense: 'past',
  person: '1s',
  userAnswer: 'werkde',
});
assertEquals(r10.isCorrect, false, 'Check: werkde flagged incorrect');
assertEquals(r10.ruleId, 'kofschip_expected_te', 'Detected kofschip_expected_te');

console.log('\n--- 8. ADDITIONAL COMPLEX EDGE CASES ---');

// verhuizen: Inseparable ver- + z->s shift
const cVerhuis = conjugate('verhuizen');
assertEquals(cVerhuis.stem.cleanStem, 'verhuis', 'verhuizen stem -> verhuis');
assertEquals(cVerhuis.stem.originalEndConsonant, 'z', 'verhuizen original consonant -> z');
assertEquals(cVerhuis.stem.isKofschip, false, 'verhuizen is NOT kofschip');
assertEquals(cVerhuis.past.singular, 'verhuisde', 'verhuizen past sing -> verhuisde');
assertEquals(cVerhuis.pastParticiple, 'verhuisd', 'verhuizen participle -> verhuisd (no ge-, ends in d)');

// meemaken: Separable mee- + maken (kofschip: k)
const cMeemaak = conjugate('meemaken');
assertEquals(cMeemaak.past.singular, 'maakte mee', 'meemaken past sing -> maakte mee');
assertEquals(cMeemaak.pastParticiple, 'meegemaakt', 'meemaken participle -> meegemaakt');

// Modal verb alternatives (willen: wilde / wou)
const rWillen = checkConjugation({
  infinitive: 'willen',
  tense: 'past',
  person: '1s',
  userAnswer: 'wou',
});
assertEquals(rWillen.isCorrect, true, 'willen past sing accepts "wou"');

const rWillen2 = checkConjugation({
  infinitive: 'willen',
  tense: 'past',
  person: '1s',
  userAnswer: 'wilde',
});
assertEquals(rWillen2.isCorrect, true, 'willen past sing accepts "wilde"');

console.log('\n--- 9. IRREGULAR VERB KOFSCHIP EXCLUSION ---');
const cNemen = conjugate('nemen');
assertEquals(cNemen.isIrregular, true, 'nemen is irregular');
assertEquals(cNemen.past.singular, 'nam', 'nemen past sing -> nam');
assertEquals(cNemen.past.plural, 'namen', 'nemen past plur -> namen');
assertEquals(cNemen.pastParticiple, 'genomen', 'nemen participle -> genomen');

const rNemenWrongPast = checkConjugation({
  infinitive: 'nemen',
  tense: 'past',
  person: '1s',
  userAnswer: 'neemde',
});
assertEquals(rNemenWrongPast.isCorrect, false, 'nemen "neemde" is flagged incorrect');
assertEquals(rNemenWrongPast.ruleId, 'irregular_verb_past', 'nemen "neemde" gets irregular_verb_past ruleId');

const rNemenWrongPart = checkConjugation({
  infinitive: 'nemen',
  tense: 'pastParticiple',
  person: '1s',
  userAnswer: 'geneemd',
});
assertEquals(rNemenWrongPart.isCorrect, false, 'nemen "geneemd" is flagged incorrect');
assertEquals(rNemenWrongPart.ruleId, 'irregular_verb_participle', 'nemen "geneemd" gets irregular_verb_participle ruleId');

console.log('\n--- 10. IRREGULAR LEMMATIZATION LOOKUP MAP ---');
// zijn: ("ben", "bent", "is", "was", "waren", "geweest") -> "zijn"
assertEquals(IRREGULAR_LEMMA_MAP.get('ben'), 'zijn', 'IRREGULAR_LEMMA_MAP: ben -> zijn');
assertEquals(IRREGULAR_LEMMA_MAP.get('bent'), 'zijn', 'IRREGULAR_LEMMA_MAP: bent -> zijn');
assertEquals(IRREGULAR_LEMMA_MAP.get('is'), 'zijn', 'IRREGULAR_LEMMA_MAP: is -> zijn');
assertEquals(IRREGULAR_LEMMA_MAP.get('was'), 'zijn', 'IRREGULAR_LEMMA_MAP: was -> zijn');
assertEquals(IRREGULAR_LEMMA_MAP.get('waren'), 'zijn', 'IRREGULAR_LEMMA_MAP: waren -> zijn');
assertEquals(IRREGULAR_LEMMA_MAP.get('geweest'), 'zijn', 'IRREGULAR_LEMMA_MAP: geweest -> zijn');

// hebben: ("heeft", "had", "hadden", "gehad") -> "hebben"
assertEquals(IRREGULAR_LEMMA_MAP.get('heeft'), 'hebben', 'IRREGULAR_LEMMA_MAP: heeft -> hebben');
assertEquals(IRREGULAR_LEMMA_MAP.get('had'), 'hebben', 'IRREGULAR_LEMMA_MAP: had -> hebben');
assertEquals(IRREGULAR_LEMMA_MAP.get('hadden'), 'hebben', 'IRREGULAR_LEMMA_MAP: hadden -> hebben');
assertEquals(IRREGULAR_LEMMA_MAP.get('gehad'), 'hebben', 'IRREGULAR_LEMMA_MAP: gehad -> hebben');

// gaan: ("gaat", "ging", "gingen", "gegaan") -> "gaan"
assertEquals(IRREGULAR_LEMMA_MAP.get('gaat'), 'gaan', 'IRREGULAR_LEMMA_MAP: gaat -> gaan');
assertEquals(IRREGULAR_LEMMA_MAP.get('ging'), 'gaan', 'IRREGULAR_LEMMA_MAP: ging -> gaan');
assertEquals(IRREGULAR_LEMMA_MAP.get('gingen'), 'gaan', 'IRREGULAR_LEMMA_MAP: gingen -> gaan');
assertEquals(IRREGULAR_LEMMA_MAP.get('gegaan'), 'gaan', 'IRREGULAR_LEMMA_MAP: gegaan -> gaan');

// zien, doen, komen, kunnen
assertEquals(IRREGULAR_LEMMA_MAP.get('ziet'), 'zien', 'IRREGULAR_LEMMA_MAP: ziet -> zien');
assertEquals(IRREGULAR_LEMMA_MAP.get('zag'), 'zien', 'IRREGULAR_LEMMA_MAP: zag -> zien');
assertEquals(IRREGULAR_LEMMA_MAP.get('gezien'), 'zien', 'IRREGULAR_LEMMA_MAP: gezien -> zien');
assertEquals(IRREGULAR_LEMMA_MAP.get('deed'), 'doen', 'IRREGULAR_LEMMA_MAP: deed -> doen');
assertEquals(IRREGULAR_LEMMA_MAP.get('gedaan'), 'doen', 'IRREGULAR_LEMMA_MAP: gedaan -> doen');
assertEquals(IRREGULAR_LEMMA_MAP.get('kwam'), 'komen', 'IRREGULAR_LEMMA_MAP: kwam -> komen');
assertEquals(IRREGULAR_LEMMA_MAP.get('gekomen'), 'komen', 'IRREGULAR_LEMMA_MAP: gekomen -> komen');
assertEquals(IRREGULAR_LEMMA_MAP.get('kon'), 'kunnen', 'IRREGULAR_LEMMA_MAP: kon -> kunnen');
assertEquals(IRREGULAR_LEMMA_MAP.get('gekund'), 'kunnen', 'IRREGULAR_LEMMA_MAP: gekund -> kunnen');

console.log('\n--- 11. 3-TIER SEARCH ENGINE (LOOKUPVERB) ---');
// 1. Kademe: Girilen kelime çekimli bir form mu? -> Doğrudan bağlı olduğu mastarın (infinitief) kartını bas
const t1_ben = lookupVerb('ben');
assertEquals(t1_ben.tier, 1, 'lookupVerb("ben") -> Tier 1');
assertEquals(t1_ben.tierType, 'tier1_conjugated', 'lookupVerb("ben") -> tier1_conjugated');
assertEquals(t1_ben.infinitive, 'zijn', 'lookupVerb("ben") -> resolved infinitive zijn');
assertEquals(t1_ben.isConjugatedForm, true, 'lookupVerb("ben") -> isConjugatedForm true');
assertEquals(t1_ben.conjugation?.infinitive, 'zijn', 'lookupVerb("ben") -> conjugation card is for zijn');

const t1_werkte = lookupVerb('werkte');
assertEquals(t1_werkte.tier, 1, 'lookupVerb("werkte") -> Tier 1');
assertEquals(t1_werkte.infinitive, 'werken', 'lookupVerb("werkte") -> resolved infinitive werken');
assertEquals(t1_werkte.isConjugatedForm, true, 'lookupVerb("werkte") -> isConjugatedForm true');
assertEquals(t1_werkte.conjugation?.infinitive, 'werken', 'lookupVerb("werkte") -> conjugation card is for werken');

const t1_gehad = lookupVerb('gehad');
assertEquals(t1_gehad.tier, 1, 'lookupVerb("gehad") -> Tier 1');
assertEquals(t1_gehad.infinitive, 'hebben', 'lookupVerb("gehad") -> resolved infinitive hebben');

const t1_gingen = lookupVerb('gingen');
assertEquals(t1_gingen.tier, 1, 'lookupVerb("gingen") -> Tier 1');
assertEquals(t1_gingen.infinitive, 'gaan', 'lookupVerb("gingen") -> resolved infinitive gaan');

// 2. Kademe: Girilen kelime düzenli fiil mi? -> 't Kofschip kuralını uygula
const t2_werken = lookupVerb('werken');
assertEquals(t2_werken.tier, 2, 'lookupVerb("werken") -> Tier 2');
assertEquals(t2_werken.tierType, 'tier2_regular', 'lookupVerb("werken") -> tier2_regular');
assertEquals(t2_werken.kofschipApplies, true, 'lookupVerb("werken") -> kofschipApplies true');
assertEquals(t2_werken.conjugation?.stem.isKofschip, true, 'lookupVerb("werken") -> stem is kofschip');

const t2_leven = lookupVerb('leven');
assertEquals(t2_leven.tier, 2, 'lookupVerb("leven") -> Tier 2');
assertEquals(t2_leven.tierType, 'tier2_regular', 'lookupVerb("leven") -> tier2_regular');
assertEquals(t2_leven.kofschipApplies, true, 'lookupVerb("leven") -> kofschipApplies true');
assertEquals(t2_leven.conjugation?.stem.isKofschip, false, 'lookupVerb("leven") -> stem is NOT kofschip (v)');

// 3. Kademe: Geçersiz/Bilinmeyen kelime ise -> "Dit is geen geldig Nederlands werkwoord."
const t3_invalid1 = lookupVerb('hello');
assertEquals(t3_invalid1.tier, 3, 'lookupVerb("hello") -> Tier 3');
assertEquals(t3_invalid1.tierType, 'tier3_invalid', 'lookupVerb("hello") -> tier3_invalid');
assertEquals(t3_invalid1.isValid, false, 'lookupVerb("hello") -> isValid false');
assertEquals(t3_invalid1.feedback, 'Dit is geen geldig Nederlands werkwoord.', 'lookupVerb("hello") -> shows exact error message');

const t3_invalid2 = lookupVerb('araba');
assertEquals(t3_invalid2.tier, 3, 'lookupVerb("araba") -> Tier 3');
assertEquals(t3_invalid2.feedback, 'Dit is geen geldig Nederlands werkwoord.', 'lookupVerb("araba") -> shows exact error message');

const t3_invalid3 = lookupVerb('blurfen');
assertEquals(t3_invalid3.tier, 3, 'lookupVerb("blurfen") -> Tier 3');
assertEquals(t3_invalid3.feedback, 'Dit is geen geldig Nederlands werkwoord.', 'lookupVerb("blurfen") -> shows exact error message');

// Summary
console.log(`\n========================================`);
console.log(`TEST RESULTS: ${passed} passed, ${failed} failed`);
console.log(`========================================\n`);

if (failed > 0) {
  process.exit(1);
}
