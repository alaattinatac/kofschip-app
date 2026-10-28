import { describe, it, expect } from 'vitest';
import { VerbChecker } from './VerbChecker';
import { VerbScanner } from './VerbScanner';
import { MijnFouten } from './MijnFouten';
import { PaywallModal, BannerAdContainer } from './PaywallModal';
import { conjugate, checkConjugation, deriveStem } from '@execution/verb_engine';
import {
  analyzeDutchTextDeterministically,
  getNativeLanguageLabel,
  getLocalizedCoaching,
  explainGrammarInNativeLanguage,
} from '@execution/ai_coach';

describe('Component Module Exports', () => {
  it('exports VerbChecker component correctly', () => {
    expect(VerbChecker).toBeDefined();
    expect(typeof VerbChecker).toBe('function');
  });

  it('exports VerbScanner component correctly', () => {
    expect(VerbScanner).toBeDefined();
    expect(typeof VerbScanner).toBe('function');
  });

  it('exports MijnFouten component correctly', () => {
    expect(MijnFouten).toBeDefined();
    expect(typeof MijnFouten).toBe('function');
  });

  it('exports PaywallModal and BannerAdContainer correctly', () => {
    expect(PaywallModal).toBeDefined();
    expect(typeof PaywallModal).toBe('function');
    expect(BannerAdContainer).toBeDefined();
    expect(typeof BannerAdContainer).toBe('function');
  });
});

describe('AI Coach & Native Language Grammar Coach', () => {
  it('resolves native language labels correctly', () => {
    expect(getNativeLanguageLabel('tr')).toBe('Türkçe (Turkish)');
    expect(getNativeLanguageLabel('ar')).toBe('العربية (Arabic)');
    expect(getNativeLanguageLabel('en')).toBe('English');
    expect(getNativeLanguageLabel('uk')).toBe('Українська (Ukrainian)');
  });

  it('detects v -> f pitfall leefte and provides Turkish coaching', () => {
    const analysis = analyzeDutchTextDeterministically(
      'Gisteren leefte hij in Amsterdam en werkte ik thuis.',
      'tr'
    );

    expect(analysis.success).toBe(true);
    expect(analysis.detectedVerbs.length).toBeGreaterThanOrEqual(2);

    const leefteVerb = analysis.detectedVerbs.find((v) => v.verb === 'leefte');
    expect(leefteVerb).toBeDefined();
    expect(leefteVerb?.isCorrect).toBe(false);
    expect(leefteVerb?.correction).toBe('leefde');
    expect(leefteVerb?.ruleCategory).toBe('v_z_shift');
    expect(leefteVerb?.ruleExplanation).toContain('kofschip');
    expect(leefteVerb?.ruleExplanation).toContain('leefde');

    const werkteVerb = analysis.detectedVerbs.find((v) => v.verb === 'werkte');
    expect(werkteVerb).toBeDefined();
    expect(werkteVerb?.isCorrect).toBe(true);
  });

  it('provides Arabic coaching for z -> s pitfall reiste', () => {
    const coaching = getLocalizedCoaching('v_z_shift', 'reiste', 'reizen', 'reisde', 'ar');
    expect(coaching.title).toContain('فخ تحول');
    expect(coaching.advice).toContain('reisde');
    expect(coaching.advice).toContain('kofschip');
  });

  it('generates native language coaching explanation for student mistake', async () => {
    const coachResult = await explainGrammarInNativeLanguage({
      verb: 'leefte',
      infinitive: 'leven',
      userAnswer: 'leefte',
      expected: 'leefde',
      nativeLanguage: 'tr',
    });

    expect(coachResult.correctForm).toBe('leefde');
    expect(coachResult.ruleCategory).toBe('v_z_shift');
    expect(coachResult.explanation).toContain('leefde');
    expect(coachResult.tips.length).toBeGreaterThan(0);
  });
});

describe('VerbChecker engine integration', () => {
  it('correctly catches the v -> f kofschip pitfall for leven', () => {
    const stem = deriveStem('leven');
    expect(stem.cleanStem).toBe('leef');
    expect(stem.originalEndConsonant).toBe('v');
    expect(stem.voicedShift).toBe('v->f');

    const result = checkConjugation({
      infinitive: 'leven',
      tense: 'past',
      person: '1s',
      userAnswer: 'leefte',
    });

    expect(result.isCorrect).toBe(false);
    expect(result.ruleId).toBe('pitfall_v_to_f_kofschip');
    expect(result.expected).toContain('leefde');
  });

  it('correctly validates regular kofschip verb werken', () => {
    const conj = conjugate('werken');
    expect(conj.past.singular).toBe('werkte');
    expect(conj.pastParticiple).toBe('gewerkt');

    const result = checkConjugation({
      infinitive: 'werken',
      tense: 'past',
      person: '1s',
      userAnswer: 'werkte',
    });

    expect(result.isCorrect).toBe(true);
    expect(result.ruleId).toBe('correct');
  });
});
