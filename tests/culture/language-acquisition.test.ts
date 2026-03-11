/**
 * Tests for the language acquisition engine.
 *
 * src/simulation/culture/language-acquisition.ts
 */

import { describe, it, expect } from 'vitest';
import {
  CONVERSATIONAL_THRESHOLD,
  getLanguageLearningRate,
  applyLanguageDrift,
  resolveChildLanguages,
  updateSettlementLanguages,
  updateLanguageTension,
  updateLanguageDiversityTurns,
} from '../../src/simulation/culture/language-acquisition';
import { createPerson } from '../../src/simulation/population/person';
import type { Person, LanguageFluency } from '../../src/simulation/population/person';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makePerson(languages: LanguageFluency[], age = 25): Person {
  const p = createPerson({ sex: 'male', age });
  return { ...p, languages };
}

function fluencyOf(languages: LanguageFluency[], lang: string): number {
  return languages.find(l => l.language === lang)?.fluency ?? 0;
}

// ─── getLanguageLearningRate ──────────────────────────────────────────────────

describe('getLanguageLearningRate', () => {
  it('returns highest rate for ages under 5', () => {
    expect(getLanguageLearningRate(0)).toBe(0.040);
    expect(getLanguageLearningRate(3)).toBe(0.040);
    expect(getLanguageLearningRate(4.9)).toBe(0.040);
  });

  it('returns decreasing rates across age bands', () => {
    const baby    = getLanguageLearningRate(2);
    const child   = getLanguageLearningRate(8);
    const teen    = getLanguageLearningRate(16);
    const adult   = getLanguageLearningRate(30);
    const middle  = getLanguageLearningRate(50);
    const elder   = getLanguageLearningRate(70);
    expect(baby ).toBeGreaterThan(child);
    expect(child).toBeGreaterThan(teen);
    expect(teen ).toBeGreaterThan(adult);
    expect(adult).toBeGreaterThan(middle);
    expect(middle).toBeGreaterThan(elder);
  });

  it('returns 0.001 for ages 60+', () => {
    expect(getLanguageLearningRate(60)).toBe(0.001);
    expect(getLanguageLearningRate(80)).toBe(0.001);
  });

  it('boundary: exactly age 5 returns 0.025', () => {
    expect(getLanguageLearningRate(5)).toBe(0.025);
  });

  it('boundary: exactly age 12 returns 0.012', () => {
    expect(getLanguageLearningRate(12)).toBe(0.012);
  });

  it('boundary: exactly age 20 returns 0.006', () => {
    expect(getLanguageLearningRate(20)).toBe(0.006);
  });

  it('boundary: exactly age 40 returns 0.003', () => {
    expect(getLanguageLearningRate(40)).toBe(0.003);
  });
});

// ─── applyLanguageDrift ───────────────────────────────────────────────────────

describe('applyLanguageDrift', () => {
  it('increases fluency when community fraction is non-zero', () => {
    const person = makePerson([{ language: 'imanian', fluency: 0.0 }], 25);
    const community = new Map([['imanian', 1.0]] as [string, number][]) as Map<import('../../src/simulation/population/person').LanguageId, number>;
    const result = applyLanguageDrift(person, community);
    expect(fluencyOf(result, 'imanian')).toBeGreaterThan(0);
  });

  it('has diminishing returns — smaller delta when fluency is already high', () => {
    const community = new Map([['imanian', 1.0]] as [string, number][]) as Map<import('../../src/simulation/population/person').LanguageId, number>;

    const lowFluency  = makePerson([{ language: 'imanian', fluency: 0.1 }], 25);
    const highFluency = makePerson([{ language: 'imanian', fluency: 0.8 }], 25);

    const deltaLow  = fluencyOf(applyLanguageDrift(lowFluency,  community), 'imanian') - 0.1;
    const deltaHigh = fluencyOf(applyLanguageDrift(highFluency, community), 'imanian') - 0.8;
    expect(deltaLow).toBeGreaterThan(deltaHigh);
  });

  it('does not change fluency when community fraction is 0', () => {
    const person = makePerson([{ language: 'imanian', fluency: 0.5 }], 25);
    const community = new Map([['kiswani', 1.0]] as [string, number][]) as Map<import('../../src/simulation/population/person').LanguageId, number>;
    const result = applyLanguageDrift(person, community);
    // imanian should be unchanged (not in community)
    expect(fluencyOf(result, 'imanian')).toBeCloseTo(0.5);
  });

  it('never exceeds 1.0 for primary languages', () => {
    const person = makePerson([{ language: 'imanian', fluency: 0.999 }], 3); // baby — fast learner
    const community = new Map([['imanian', 1.0]] as [string, number][]) as Map<import('../../src/simulation/population/person').LanguageId, number>;
    const result = applyLanguageDrift(person, community);
    expect(fluencyOf(result, 'imanian')).toBeLessThanOrEqual(1.0);
  });

  it('applies tradetalk boost when person has no conversational language', () => {
    // Person speaks no language above CONVERSATIONAL_THRESHOLD
    const isolated = makePerson([{ language: 'imanian', fluency: 0.1 }], 25);
    const community = new Map([
      ['imanian', 0.5],
      ['tradetalk', 0.5],
    ] as [string, number][]) as Map<import('../../src/simulation/population/person').LanguageId, number>;

    const result = applyLanguageDrift(isolated, community);
    const tradeDelta = fluencyOf(result, 'tradetalk') - 0;

    // Now test without isolation (conversational in imanian)
    const fluent = makePerson([{ language: 'imanian', fluency: 0.8 }], 25);
    const resultFluent = applyLanguageDrift(fluent, community);
    const tradeDeltaFluent = fluencyOf(resultFluent, 'tradetalk') - 0;

    expect(tradeDelta).toBeGreaterThan(tradeDeltaFluent);
  });

  it('tradetalk is hard-capped at 0.50', () => {
    const person = makePerson([{ language: 'tradetalk', fluency: 0.48 }], 3); // baby
    const community = new Map([['tradetalk', 1.0]] as [string, number][]) as Map<import('../../src/simulation/population/person').LanguageId, number>;
    const result = applyLanguageDrift(person, community);
    expect(fluencyOf(result, 'tradetalk')).toBeLessThanOrEqual(0.5);
  });

  it('tradetalk already at 0.50 does not increase', () => {
    const person = makePerson([{ language: 'tradetalk', fluency: 0.50 }], 5);
    const community = new Map([['tradetalk', 1.0]] as [string, number][]) as Map<import('../../src/simulation/population/person').LanguageId, number>;
    const result = applyLanguageDrift(person, community);
    expect(fluencyOf(result, 'tradetalk')).toBeCloseTo(0.5);
  });

  it('preserves languages not in the community (no language loss)', () => {
    const person = makePerson([
      { language: 'imanian', fluency: 0.7 },
      { language: 'kiswani', fluency: 0.4 },
    ], 30);
    // Community only knows imanian
    const community = new Map([['imanian', 1.0]] as [string, number][]) as Map<import('../../src/simulation/population/person').LanguageId, number>;
    const result = applyLanguageDrift(person, community);
    // Kiswani should be preserved at its original value
    expect(fluencyOf(result, 'kiswani')).toBeCloseTo(0.4);
  });
});

// ─── resolveChildLanguages ────────────────────────────────────────────────────

describe('resolveChildLanguages', () => {
  it('child starts at 0.10 for each qualified parent language', () => {
    const mother = makePerson([{ language: 'imanian', fluency: 1.0 }]);
    const father = makePerson([{ language: 'kiswani', fluency: 1.0 }]);
    const result = resolveChildLanguages(mother, father);
    expect(fluencyOf(result, 'imanian')).toBeCloseTo(0.10);
    expect(fluencyOf(result, 'kiswani')).toBeCloseTo(0.10);
  });

  it('deduplicates shared languages — only one entry per language', () => {
    const mother = makePerson([{ language: 'imanian', fluency: 1.0 }]);
    const father = makePerson([{ language: 'imanian', fluency: 0.9 }]);
    const result = resolveChildLanguages(mother, father);
    const imanianEntries = result.filter(l => l.language === 'imanian');
    expect(imanianEntries.length).toBe(1);
    expect(fluencyOf(result, 'imanian')).toBeCloseTo(0.10);
  });

  it('parent language below CONVERSATIONAL_THRESHOLD does not qualify', () => {
    const mother = makePerson([{ language: 'imanian', fluency: 1.0 }]);
    // Father has kiswani but below threshold
    const father = makePerson([{ language: 'kiswani', fluency: CONVERSATIONAL_THRESHOLD - 0.01 }]);
    const result = resolveChildLanguages(mother, father);
    expect(result.some(l => l.language === 'kiswani')).toBe(false);
    expect(result.length).toBe(1); // Only imanian
  });

  it('single parent language when only one parent qualifies', () => {
    const mother = makePerson([{ language: 'imanian', fluency: 1.0 }]);
    // Father has no languages
    const father = makePerson([]);
    const result = resolveChildLanguages(mother, father);
    expect(result.length).toBe(1);
    expect(result[0]?.language).toBe('imanian');
  });

  it('returns empty array when neither parent speaks any language above threshold', () => {
    const mother = makePerson([{ language: 'imanian', fluency: 0.1 }]);
    const father = makePerson([{ language: 'kiswani', fluency: 0.05 }]);
    const result = resolveChildLanguages(mother, father);
    expect(result.length).toBe(0);
  });

  it('does not duplicate father languages when father === mother (stand-in)', () => {
    const mother = makePerson([{ language: 'imanian', fluency: 1.0 }]);
    // Pass mother as father (edge-case when real father died)
    const result = resolveChildLanguages(mother, mother);
    const imanianEntries = result.filter(l => l.language === 'imanian');
    expect(imanianEntries.length).toBe(1);
  });
});

// ─── updateSettlementLanguages ────────────────────────────────────────────────

describe('updateSettlementLanguages', () => {
  it('empty population returns empty map', () => {
    const result = updateSettlementLanguages(new Map());
    expect(result.size).toBe(0);
  });

  it('counts only speakers at or above CONVERSATIONAL_THRESHOLD', () => {
    const people = new Map([
      ['1', makePerson([{ language: 'imanian', fluency: 0.5 }])],   // counts
      ['2', makePerson([{ language: 'imanian', fluency: 0.3 }])],   // exactly threshold — counts
      ['3', makePerson([{ language: 'imanian', fluency: 0.29 }])],  // below threshold — does not count
    ]);
    const result = updateSettlementLanguages(people);
    // 2 out of 3 speak imanian at threshold
    expect(result.get('imanian')).toBeCloseTo(2 / 3);
  });

  it('multiple languages tracked independently', () => {
    const people = new Map([
      ['1', makePerson([{ language: 'imanian', fluency: 1.0 }])],
      ['2', makePerson([{ language: 'kiswani', fluency: 1.0 }])],
    ]);
    const result = updateSettlementLanguages(people);
    expect(result.get('imanian')).toBeCloseTo(0.5);
    expect(result.get('kiswani')).toBeCloseTo(0.5);
  });

  it('omits languages spoken by nobody', () => {
    const people = new Map([
      ['1', makePerson([{ language: 'imanian', fluency: 1.0 }])],
    ]);
    const result = updateSettlementLanguages(people);
    expect(result.has('kiswani')).toBe(false);
  });

  it('a bilingual person counts toward both languages', () => {
    const bilingualPerson = makePerson([
      { language: 'imanian', fluency: 0.9 },
      { language: 'kiswani', fluency: 0.7 },
    ]);
    const people = new Map([['1', bilingualPerson]]);
    const result = updateSettlementLanguages(people);
    expect(result.get('imanian')).toBeCloseTo(1.0);
    expect(result.get('kiswani')).toBeCloseTo(1.0);
  });
});

// ─── updateLanguageTension ────────────────────────────────────────────────────

describe('updateLanguageTension', () => {
  it('returns 0 when population is monolingual', () => {
    const fractions = new Map([['imanian', 1.0]] as [string, number][]) as Map<import('../../src/simulation/population/person').LanguageId, number>;
    expect(updateLanguageTension(fractions)).toBeCloseTo(0);
  });

  it('returns maximum tension near 1.0 at a 50/50 bilingual split', () => {
    const fractions = new Map([
      ['imanian', 0.5],
      ['kiswani', 0.5],
    ] as [string, number][]) as Map<import('../../src/simulation/population/person').LanguageId, number>;
    expect(updateLanguageTension(fractions)).toBeCloseTo(1.0);
  });

  it('returns less tension at 75/25 split than 50/50', () => {
    const equal = new Map([['imanian', 0.5], ['kiswani', 0.5]] as [string, number][]) as Map<import('../../src/simulation/population/person').LanguageId, number>;
    const skewed = new Map([['imanian', 0.75], ['kiswani', 0.25]] as [string, number][]) as Map<import('../../src/simulation/population/person').LanguageId, number>;
    expect(updateLanguageTension(equal)).toBeGreaterThan(updateLanguageTension(skewed));
  });

  it('ignores languages below 5% threshold', () => {
    // A minority third language should not cause tension
    const fractions = new Map([
      ['imanian', 0.94],
      ['kiswani', 0.02],  // below 5% — ignored
      ['hanjoda', 0.04],  // below 5% — ignored
    ] as [string, number][]) as Map<import('../../src/simulation/population/person').LanguageId, number>;
    expect(updateLanguageTension(fractions)).toBeCloseTo(0);
  });

  it('tension is clamped to [0, 1]', () => {
    const fractions = new Map([['imanian', 0.5], ['kiswani', 0.5]] as [string, number][]) as Map<import('../../src/simulation/population/person').LanguageId, number>;
    const tension = updateLanguageTension(fractions);
    expect(tension).toBeGreaterThanOrEqual(0);
    expect(tension).toBeLessThanOrEqual(1);
  });
});

// ─── updateLanguageDiversityTurns ─────────────────────────────────────────────

describe('updateLanguageDiversityTurns', () => {
  it('increments when two languages are each above 10%', () => {
    const fractions = new Map([
      ['imanian', 0.6],
      ['kiswani', 0.4],
    ] as [string, number][]) as Map<import('../../src/simulation/population/person').LanguageId, number>;
    expect(updateLanguageDiversityTurns(fractions, 5)).toBe(6);
  });

  it('does not increment when only one language is above 10%', () => {
    const fractions = new Map([
      ['imanian', 0.95],
      ['kiswani', 0.05],
    ] as [string, number][]) as Map<import('../../src/simulation/population/person').LanguageId, number>;
    expect(updateLanguageDiversityTurns(fractions, 5)).toBe(5);
  });

  it('does not decrement when bilingualism ends', () => {
    const monolingual = new Map([['imanian', 1.0]] as [string, number][]) as Map<import('../../src/simulation/population/person').LanguageId, number>;
    // Counter stays — it records a cumulative history, not a current streak
    expect(updateLanguageDiversityTurns(monolingual, 15)).toBe(15);
  });
});
