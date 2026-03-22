/**
 * Unit tests for fertility.ts.
 *
 * Covers:
 *   - createFertilityProfile: correct age windows for standard vs Kethara's Bargain
 *   - getFertilityChance: fertility window bounds, seasonal bonus, trait/condition modifiers
 *   - attemptConception: conception roll probability and PregnancyState shape
 *   - processPregnancies: pure-function contract, birth resolution, child creation
 */

import { describe, it, expect } from 'vitest';
import {
  createFertilityProfile,
  getFertilityChance,
  attemptConception,
  processPregnancies,
} from '../../src/simulation/genetics/fertility';
import { createPerson } from '../../src/simulation/population/person';
import type { Person } from '../../src/simulation/population/person';
import type { TraitId } from '../../src/simulation/personality/traits';
import { createRNG } from '../../src/utils/rng';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function baseWoman(overrides: Partial<Person> = {}): Person {
  return createPerson({
    sex: 'female',
    age: 25,
    heritage: {
      bloodline: [{ group: 'imanian', fraction: 1.0 }],
      primaryCulture: 'ansberite',
      culturalFluency: new Map([['ansberite', 1.0]]),
    },
    ...overrides,
  });
}

function baseMale(overrides: Partial<Person> = {}): Person {
  return createPerson({
    sex: 'male',
    age: 28,
    heritage: {
      bloodline: [{ group: 'imanian', fraction: 1.0 }],
      primaryCulture: 'ansberite',
      culturalFluency: new Map([['ansberite', 1.0]]),
    },
    ...overrides,
  });
}

// ─── createFertilityProfile ───────────────────────────────────────────────────

describe('createFertilityProfile', () => {
  it('standard profile has the correct age shape', () => {
    const profile = createFertilityProfile(false);
    expect(profile.isExtended).toBe(false);
    expect(profile.fertilityStart).toBe(15);
    expect(profile.fertilityPeak).toBe(22);
    expect(profile.fertilityDeclineStart).toBe(35);
    expect(profile.fertilityEnd).toBe(44);
  });

  it('extended profile (Kethara\'s Bargain) has the correct age shape', () => {
    const profile = createFertilityProfile(true);
    expect(profile.isExtended).toBe(true);
    expect(profile.fertilityStart).toBe(15);
    expect(profile.fertilityPeak).toBe(22);
    expect(profile.fertilityDeclineStart).toBe(45);
    expect(profile.fertilityEnd).toBe(54);
  });

  it('extended decline starts 10 years later than standard', () => {
    const std = createFertilityProfile(false);
    const ext = createFertilityProfile(true);
    expect(ext.fertilityDeclineStart - std.fertilityDeclineStart).toBe(10);
    expect(ext.fertilityEnd - std.fertilityEnd).toBe(10);
  });
});

// ─── getFertilityChance ───────────────────────────────────────────────────────

describe('getFertilityChance', () => {
  it('returns 0 for a male', () => {
    const man = baseMale({ age: 25 });
    expect(getFertilityChance(man, 'spring')).toBe(0);
  });

  it('returns 0 if the woman is already pregnant', () => {
    const woman = baseWoman({
      age: 25,
      health: {
        currentHealth: 100,
        conditions: [],
        pregnancy: { fatherId: 'father-1', conceptionTurn: 1, dueDate: 4 },
      },
    });
    expect(getFertilityChance(woman, 'spring')).toBe(0);
  });

  it('returns 0 before fertilityStart (age 13)', () => {
    const woman = baseWoman({ age: 13 });
    expect(getFertilityChance(woman, 'summer')).toBe(0);
  });

  it('returns 0 at or after fertilityEnd (age 44 standard)', () => {
    const woman = baseWoman({ age: 44 });
    expect(getFertilityChance(woman, 'summer')).toBe(0);
  });

  it('returns 0 well past fertilityEnd (age 60)', () => {
    const woman = baseWoman({ age: 60 });
    expect(getFertilityChance(woman, 'summer')).toBe(0);
  });

  it('returns approximately 0.25 during peak years (age 22–35)', () => {
    const woman = baseWoman({ age: 28 });
    const chance = getFertilityChance(woman, 'spring');
    expect(chance).toBeCloseTo(0.25, 5);
  });

  it('part-way through ramp-up returns less than peak', () => {
    // age 15 = fertilityStart → ramping up from 0
    // age 22 = fertilityPeak → 0.25
    const woman = baseWoman({ age: 18 }); // midway
    const chance = getFertilityChance(woman, 'spring');
    expect(chance).toBeGreaterThan(0);
    expect(chance).toBeLessThan(0.25);
  });

  it('part-way through decline returns less than peak', () => {
    // age 35 = declineStart, age 44 = end → ramping down from 0.25 to 0
    const woman = baseWoman({ age: 39 });
    const chance = getFertilityChance(woman, 'spring');
    expect(chance).toBeGreaterThan(0);
    expect(chance).toBeLessThan(0.25);
  });

  it('summer adds +0.05 to the base chance', () => {
    const woman = baseWoman({ age: 28 });
    const spring = getFertilityChance(woman, 'spring');
    const summer = getFertilityChance(woman, 'summer');
    expect(summer - spring).toBeCloseTo(0.05, 5);
  });

  it('other seasons do not add a bonus', () => {
    const woman = baseWoman({ age: 28 });
    const base = getFertilityChance(woman, 'spring');
    expect(getFertilityChance(woman, 'autumn')).toBeCloseTo(base, 5);
    expect(getFertilityChance(woman, 'winter')).toBeCloseTo(base, 5);
  });

  it('"ill" condition halves the chance', () => {
    const healthy = baseWoman({ age: 28 });
    const ill = baseWoman({
      age: 28,
      health: { currentHealth: 60, conditions: ['ill'] },
    });
    expect(getFertilityChance(ill, 'spring')).toBeCloseTo(
      getFertilityChance(healthy, 'spring') * 0.5,
      5,
    );
  });

  it('"malnourished" and "ill" stack multiplicatively', () => {
    const healthy = baseWoman({ age: 28 });
    const sick = baseWoman({
      age: 28,
      health: { currentHealth: 40, conditions: ['ill', 'malnourished'] },
    });
    expect(getFertilityChance(sick, 'spring')).toBeCloseTo(
      getFertilityChance(healthy, 'spring') * 0.25,
      5,
    );
  });

  it('"fertile" trait multiplies chance by 1.3', () => {
    const base = baseWoman({ age: 28 });
    const fertile = baseWoman({ age: 28, traits: ['fertile'] as TraitId[] });
    expect(getFertilityChance(fertile, 'spring')).toBeCloseTo(
      getFertilityChance(base, 'spring') * 1.3,
      5,
    );
  });

  it('"barren" trait returns 0 regardless of age and season', () => {
    const barren = baseWoman({ age: 28, traits: ['barren'] as TraitId[] });
    expect(getFertilityChance(barren, 'summer')).toBe(0);
    expect(getFertilityChance(barren, 'spring')).toBe(0);
  });

  it('"barren" overrides "fertile"', () => {
    const both = baseWoman({ age: 28, traits: ['fertile', 'barren'] as TraitId[] });
    expect(getFertilityChance(both, 'summer')).toBe(0);
  });

  it('extended fertility (Kethara\'s Bargain) keeps chance non-zero at age 50', () => {
    const extendedWoman = baseWoman({
      age: 50,
      fertility: createFertilityProfile(true),
    });
    const chance = getFertilityChance(extendedWoman, 'spring');
    expect(chance).toBeGreaterThan(0);
  });

  it('standard fertility returns 0 at age 50', () => {
    const stdWoman = baseWoman({
      age: 50,
      fertility: createFertilityProfile(false),
    });
    expect(getFertilityChance(stdWoman, 'spring')).toBe(0);
  });
});

// ─── attemptConception ────────────────────────────────────────────────────────

describe('attemptConception', () => {
  it('returns null for a barren woman (chance = 0)', () => {
    const rng = createRNG(1);
    const woman = baseWoman({ age: 28, traits: ['barren'] as TraitId[] });
    const man = baseMale();
    const result = attemptConception(woman, man, 10, 'spring', rng);
    expect(result).toBeNull();
  });

  it('returns null for a woman outside fertility window', () => {
    const rng = createRNG(1);
    const woman = baseWoman({ age: 60 });
    const man = baseMale();
    const result = attemptConception(woman, man, 10, 'spring', rng);
    expect(result).toBeNull();
  });

  it('when conception occurs, PregnancyState has correct shape', () => {
    // Use a large number of attempts to guarantee at least one success
    const rng = createRNG(42);
    const woman = baseWoman({ age: 25 });
    const man = baseMale({ id: 'father-test-1' });
    let result = null;
    for (let i = 0; i < 200; i++) {
      result = attemptConception(woman, man, 5, 'summer', rng);
      if (result !== null) break;
    }
    expect(result).not.toBeNull();
    expect(result!.fatherId).toBe('father-test-1');
    expect(result!.dueDate).toBe(result!.conceptionTurn + 3);
  });

  it('dueDate is always exactly currentTurn + 3', () => {
    const rng = createRNG(99);
    const woman = baseWoman({ age: 25 });
    const man = baseMale();
    // Run enough times to get a successful conception
    for (let i = 0; i < 500; i++) {
      const result = attemptConception(woman, man, 20, 'summer', rng);
      if (result !== null) {
        expect(result.dueDate).toBe(20 + 3);
        return;
      }
    }
    // If we never conceived in 500 attempts (extremely unlikely), fail the test
    throw new Error('No conception occurred in 500 attempts — check getFertilityChance logic');
  });
});

// ─── processPregnancies ───────────────────────────────────────────────────────

describe('processPregnancies', () => {
  it('returns empty array when no one is pregnant', () => {
    const rng = createRNG(1);
    const people = new Map<string, Person>();
    people.set('man-1', baseMale({ id: 'man-1' }));
    people.set('woman-1', baseWoman({ id: 'woman-1', age: 25 }));
    expect(processPregnancies(people, 10, rng)).toHaveLength(0);
  });

  it('returns empty array when pregnancy is not yet due', () => {
    const rng = createRNG(1);
    const woman = baseWoman({
      id: 'mother-1',
      age: 25,
      health: {
        currentHealth: 100,
        conditions: [],
        pregnancy: { fatherId: 'father-1', conceptionTurn: 8, dueDate: 11 },
      },
    });
    const father = baseMale({ id: 'father-1' });
    const people = new Map<string, Person>([
      ['mother-1', woman],
      ['father-1', father],
    ]);
    // currentTurn = 10 < dueDate = 11
    const results = processPregnancies(people, 10, rng);
    expect(results).toHaveLength(0);
  });

  it('resolves a due pregnancy and returns one BirthResult', () => {
    const rng = createRNG(42);
    const woman = baseWoman({
      id: 'mother-1',
      age: 25,
      health: {
        currentHealth: 100,
        conditions: [],
        pregnancy: { fatherId: 'father-1', conceptionTurn: 7, dueDate: 10 },
      },
    });
    const father = baseMale({
      id: 'father-1',
      heritage: {
        bloodline: [{ group: 'imanian', fraction: 1.0 }],
        primaryCulture: 'ansberite',
        culturalFluency: new Map([['ansberite', 1.0]]),
      },
    });
    const people = new Map<string, Person>([
      ['mother-1', woman],
      ['father-1', father],
    ]);

    const results = processPregnancies(people, 10, rng);
    expect(results).toHaveLength(1);

    const { motherId, child } = results[0]!;
    expect(motherId).toBe('mother-1');
    expect(child.parentIds[0]).toBe('mother-1');
    expect(child.parentIds[1]).toBe('father-1');
    expect(child.age).toBe(0);
    expect(['male', 'female']).toContain(child.sex);
  });

  it('child has valid visible traits (no undefined, skinTone in [0,1])', () => {
    const rng = createRNG(77);
    const woman = baseWoman({
      id: 'mom-2',
      age: 25,
      health: {
        currentHealth: 100,
        conditions: [],
        pregnancy: { fatherId: 'dad-2', conceptionTurn: 1, dueDate: 4 },
      },
    });
    const father = baseMale({
      id: 'dad-2',
      heritage: {
        bloodline: [{ group: 'imanian', fraction: 1.0 }],
        primaryCulture: 'ansberite',
        culturalFluency: new Map([['ansberite', 1.0]]),
      },
    });
    const people = new Map<string, Person>([
      ['mom-2', woman],
      ['dad-2', father],
    ]);

    const results = processPregnancies(people, 4, rng);
    const { child } = results[0]!;

    expect(child.genetics.visibleTraits.skinTone).toBeGreaterThanOrEqual(0);
    expect(child.genetics.visibleTraits.skinTone).toBeLessThanOrEqual(1);
    expect(child.genetics.visibleTraits.hairColor).toBeDefined();
    expect(child.genetics.visibleTraits.eyeColor).toBeDefined();
    expect(child.genetics.visibleTraits.buildType).toBeDefined();
    expect(child.genetics.visibleTraits.height).toBeDefined();
  });

  it('does NOT mutate the pregnancy state on the mother (pure function contract)', () => {
    const rng = createRNG(1);
    const pregnancy = { fatherId: 'dad-3', conceptionTurn: 1, dueDate: 4 };
    const woman = baseWoman({
      id: 'mom-3',
      age: 25,
      health: { currentHealth: 100, conditions: [], pregnancy },
    });
    const father = baseMale({
      id: 'dad-3',
      heritage: {
        bloodline: [{ group: 'imanian', fraction: 1.0 }],
        primaryCulture: 'ansberite',
        culturalFluency: new Map([['ansberite', 1.0]]),
      },
    });
    const people = new Map<string, Person>([
      ['mom-3', woman],
      ['dad-3', father],
    ]);

    processPregnancies(people, 4, rng);

    // Pregnancy should still be present — caller must clear it
    expect(people.get('mom-3')!.health.pregnancy).toBeDefined();
    expect(people.get('mom-3')!.health.pregnancy!.fatherId).toBe('dad-3');
  });

  it('handles missing father gracefully (father died before birth)', () => {
    const rng = createRNG(5);
    const woman = baseWoman({
      id: 'widow-1',
      age: 25,
      health: {
        currentHealth: 100,
        conditions: [],
        pregnancy: { fatherId: 'dead-father', conceptionTurn: 1, dueDate: 4 },
      },
    });
    // Father NOT in the people map
    const people = new Map<string, Person>([['widow-1', woman]]);

    // Should not throw — falls back gracefully
    expect(() => processPregnancies(people, 4, rng)).not.toThrow();
    const results = processPregnancies(people, 4, rng);
    expect(results).toHaveLength(1);
    expect(results[0]!.child).toBeDefined();
  });

  it('BirthResult motherHealthDelta is always negative', () => {
    const rng = createRNG(13);
    const woman = baseWoman({
      id: 'mom-4',
      age: 25,
      health: {
        currentHealth: 100,
        conditions: [],
        pregnancy: { fatherId: 'dad-4', conceptionTurn: 1, dueDate: 4 },
      },
    });
    const father = baseMale({
      id: 'dad-4',
      heritage: {
        bloodline: [{ group: 'imanian', fraction: 1.0 }],
        primaryCulture: 'ansberite',
        culturalFluency: new Map([['ansberite', 1.0]]),
      },
    });
    const people = new Map<string, Person>([
      ['mom-4', woman],
      ['dad-4', father],
    ]);

    const results = processPregnancies(people, 4, rng);
    expect(results[0]!.motherHealthDelta).toBeLessThan(0);
  });
});

describe('getFertilityChance — household crowding penalty', () => {
  it('does not apply a crowding penalty below 6 household members', () => {
    const woman = baseWoman({ age: 22 });
    const baseChance = getFertilityChance(woman, 'spring');
    expect(getFertilityChance(woman, 'spring', 5)).toBeCloseTo(baseChance, 5);
  });

  it('applies a 0.80 multiplier at 6 household members', () => {
    const woman = baseWoman({ age: 22 });
    const baseChance = getFertilityChance(woman, 'spring');
    expect(getFertilityChance(woman, 'spring', 6)).toBeCloseTo(baseChance * 0.8, 5);
  });

  it('applies a 0.65 multiplier at 11 household members', () => {
    const woman = baseWoman({ age: 22 });
    const baseChance = getFertilityChance(woman, 'spring');
    expect(getFertilityChance(woman, 'spring', 11)).toBeCloseTo(baseChance * 0.65, 5);
  });

  it('applies a 0.50 multiplier at 17 household members', () => {
    const woman = baseWoman({ age: 22 });
    const baseChance = getFertilityChance(woman, 'spring');
    expect(getFertilityChance(woman, 'spring', 17)).toBeCloseTo(baseChance * 0.5, 5);
  });

  it('applies a 0.35 multiplier at 25 household members', () => {
    const woman = baseWoman({ age: 22 });
    const baseChance = getFertilityChance(woman, 'spring');
    expect(getFertilityChance(woman, 'spring', 25)).toBeCloseTo(baseChance * 0.35, 5);
  });

  it('still returns 0 for males even when a household size is supplied', () => {
    const man = baseMale({ age: 25 });
    expect(getFertilityChance(man, 'spring', 25)).toBe(0);
  });

  it('layers the crowding penalty on top of the summer seasonal bonus', () => {
    const woman = baseWoman({ age: 22 });
    const summerChance = getFertilityChance(woman, 'summer');
    expect(getFertilityChance(woman, 'summer', 11)).toBeCloseTo(summerChance * 0.65, 5);
  });
});
