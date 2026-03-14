/**
 * Tests for the trait-driven behaviour engine.
 *
 * Covers:
 *   1. computeTraitCategoryBoosts — multiplier scaling from trait composition
 *   2. applyTraitOpinionEffects   — jealous / envious / suspicious / trusting / charming
 *   3. getTraitSkillGrowthBonuses — per-turn growth additions from aptitude traits
 */

import { describe, it, expect } from 'vitest';
import type { Person } from '../../src/simulation/population/person';
import {
  computeTraitCategoryBoosts,
  applyTraitOpinionEffects,
  getTraitSkillGrowthBonuses,
} from '../../src/simulation/personality/trait-behavior';

// ─── Test helper ──────────────────────────────────────────────────────────────

function makePerson(id: string, overrides: Partial<Person> = {}): Person {
  return {
    id,
    firstName: `Person_${id}`,
    familyName: 'Test',
    sex: 'male',
    age: 25,
    alive: true,
    role: 'unassigned',
    socialStatus: 'settler',
    traits: [],
    religion: 'imanian_orthodox',
    heritage: {
      bloodline: [{ group: 'imanian', fraction: 1.0 }],
      primaryCulture: 'ansberite',
      culturalFluency: new Map(),
    },
    genetics: {
      visibleTraits: {
        skinTone: 0.3,
        hairColor: 'brown',
        hairTexture: 'straight',
        eyeColor: 'blue',
        buildType: 'athletic',
        height: 'average',
        facialStructure: 'oval',
      },
      genderRatioModifier: 0,
      extendedFertility: false,
    },
    languages: [],
    spouseIds: [],
    childIds: [],
    motherIds: [],
    fatherIds: [],
    relationships: new Map(),
    householdId: null,
    householdRole: null,
    ashkaMelathiPartnerIds: [],
    ambition: null,
    opinionModifiers: [],
    skills: { animals: 25, bargaining: 25, combat: 25, custom: 25, leadership: 25, plants: 25 },
    portraitVariant: 1,
    ...overrides,
  } as unknown as Person;
}

// ─── computeTraitCategoryBoosts ───────────────────────────────────────────────

describe('computeTraitCategoryBoosts', () => {
  it('returns empty record when population is empty', () => {
    const result = computeTraitCategoryBoosts(new Map());
    expect(result).toEqual({});
  });

  it('returns empty record when nobody has event-weight traits', () => {
    const people = new Map([
      ['a', makePerson('a', { traits: ['brave', 'kind'] })],
      ['b', makePerson('b', { traits: ['greedy'] })],
    ]);
    const result = computeTraitCategoryBoosts(people);
    expect(Object.keys(result)).toHaveLength(0);
  });

  it('zealous person increases cultural/religious category boost', () => {
    const people = new Map([
      ['a', makePerson('a', { traits: ['zealous'] })],
      ['b', makePerson('b', { traits: [] })],
    ]);
    const result = computeTraitCategoryBoosts(people);
    // zealous has event_weight_religious: 2.0 → delta (2.0-1.0)/2=0.5 → multiplier 1.5
    expect(result['cultural']).toBeGreaterThan(1.0);
  });

  it('wrathful person increases domestic category boost', () => {
    const a = makePerson('a', { traits: ['wrathful'] });
    const people = new Map([['a', a]]);
    const result = computeTraitCategoryBoosts(people);
    // wrathful has event_weight_domestic: 1.5 → single person → 1+(1.5-1)/1=1.5
    expect(result['domestic']).toBeCloseTo(1.5, 1);
  });

  it('cynical person reduces cultural boost', () => {
    const people = new Map([
      ['a', makePerson('a', { traits: ['cynical'] })],
    ]);
    const result = computeTraitCategoryBoosts(people);
    // cynical event_weight_religious: -1.0 → delta (-1-1)/1 = -2 → 1+(-2)=-1 → clamped to 0.2
    expect(result['cultural']).toBeLessThan(1.0);
  });

  it('boost is normalised by population — larger settlement mutes individual influence', () => {
    const smallPop = new Map([
      ['a', makePerson('a', { traits: ['zealous'] })],
    ]);
    const largePop = new Map([
      ['a', makePerson('a', { traits: ['zealous'] })],
      ...Array.from({ length: 9 }, (_, i) => [`x${i}`, makePerson(`x${i}`)] as [string, Person]),
    ]);
    const small = computeTraitCategoryBoosts(smallPop);
    const large = computeTraitCategoryBoosts(largePop);
    expect(small['cultural'] ?? 1).toBeGreaterThan(large['cultural'] ?? 1);
  });

  it('applies 0.2 floor — result never drops below 0.2', () => {
    // Pack with cynical + skeptical → maximum negative pressure
    const people = new Map([
      ...Array.from({ length: 5 }, (_, i) => [
        `x${i}`,
        makePerson(`x${i}`, { traits: ['cynical', 'skeptical'] }),
      ] as [string, Person]),
    ]);
    const result = computeTraitCategoryBoosts(people);
    for (const v of Object.values(result)) {
      expect(v).toBeGreaterThanOrEqual(0.2);
    }
  });
});

// ─── applyTraitOpinionEffects ─────────────────────────────────────────────────

describe('applyTraitOpinionEffects', () => {
  it('returns empty map when no relevant traits are present', () => {
    const people = new Map([
      ['a', makePerson('a', { traits: ['brave'] })],
      ['b', makePerson('b', { traits: ['kind'] })],
    ]);
    const result = applyTraitOpinionEffects(people);
    expect(result.size).toBe(0);
  });

  it('suspicious person drifts opinion of all others downward by 1', () => {
    const a = makePerson('a', { traits: ['suspicious'] });
    const b = makePerson('b');
    const c = makePerson('c');
    const people = new Map([['a', a], ['b', b], ['c', c]]);

    const changed = applyTraitOpinionEffects(people);

    const updatedA = changed.get('a');
    expect(updatedA).toBeDefined();
    // relationships should have b and c both at -1
    expect(updatedA!.relationships.get('b')).toBe(-1);
    expect(updatedA!.relationships.get('c')).toBe(-1);
  });

  it('trusting person drifts opinion of others upward by 1', () => {
    const a = makePerson('a', { traits: ['trusting'] });
    const b = makePerson('b');
    const people = new Map([['a', a], ['b', b]]);

    const changed = applyTraitOpinionEffects(people);
    const updatedA = changed.get('a');
    expect(updatedA!.relationships.get('b')).toBe(1);
  });

  it('charming person causes others to improve opinion of them by 1', () => {
    const a = makePerson('a', { traits: ['charming'] });
    const b = makePerson('b');
    const c = makePerson('c');
    const people = new Map([['a', a], ['b', b], ['c', c]]);

    const changed = applyTraitOpinionEffects(people);
    // b and c's opinion of a should increase
    const updatedB = changed.get('b');
    const updatedC = changed.get('c');
    expect(updatedB!.relationships.get('a')).toBe(1);
    expect(updatedC!.relationships.get('a')).toBe(1);
  });

  it('envious person lowers opinion of hero/wealthy/beautiful by 1', () => {
    const a = makePerson('a', { traits: ['envious'] });
    const hero = makePerson('h', { traits: ['hero'] });
    const plain = makePerson('p');
    const people = new Map([['a', a], ['h', hero], ['p', plain]]);

    const changed = applyTraitOpinionEffects(people);
    const updatedA = changed.get('a');
    expect(updatedA!.relationships.get('h')).toBe(-1);
    // plain person unaffected
    expect(updatedA?.relationships.get('p') ?? 0).toBe(0);
  });

  it('jealous married person lowers opinion of non-spouse opposite sex with existing relationship', () => {
    const a = makePerson('a', {
      sex: 'male',
      traits: ['jealous'],
      spouseIds: ['spouse1'],
      relationships: new Map([['rival', 5]]),
    });
    const rival = makePerson('rival', { sex: 'female' });
    const spouse = makePerson('spouse1', { sex: 'female' });
    const people = new Map([['a', a], ['rival', rival], ['spouse1', spouse]]);

    const changed = applyTraitOpinionEffects(people);
    const updatedA = changed.get('a');
    // rival (non-spouse, opposite sex, has existing relation): opinion should decrease
    const rivalOpinion = updatedA?.relationships.get('rival');
    expect(rivalOpinion).toBe(4); // 5 - 1
  });

  it('jealous person does NOT alter opinion of their spouse', () => {
    const a = makePerson('a', {
      sex: 'male',
      traits: ['jealous'],
      spouseIds: ['s'],
      relationships: new Map([['s', 50]]),
    });
    const spouse = makePerson('s', { sex: 'female' });
    const people = new Map([['a', a], ['s', spouse]]);

    const changed = applyTraitOpinionEffects(people);
    // spouse opinion unchanged
    const updatedA = changed.get('a');
    expect(updatedA?.relationships.get('s') ?? 50).toBe(50);
  });
});

// ─── getTraitSkillGrowthBonuses ───────────────────────────────────────────────

describe('getTraitSkillGrowthBonuses', () => {
  it('returns empty object when person has no growth-affecting traits', () => {
    const p = makePerson('a', { traits: ['brave', 'proud'] });
    const bonuses = getTraitSkillGrowthBonuses(p);
    expect(Object.keys(bonuses)).toHaveLength(0);
  });

  it('green_thumb provides +2 plants per turn', () => {
    const p = makePerson('a', { traits: ['green_thumb'] });
    const bonuses = getTraitSkillGrowthBonuses(p);
    expect(bonuses.plants).toBe(2);
    expect(bonuses.combat).toBeUndefined();
  });

  it('keen_hunter provides +1 combat per turn', () => {
    const p = makePerson('a', { traits: ['keen_hunter'] });
    const bonuses = getTraitSkillGrowthBonuses(p);
    expect(bonuses.combat).toBe(1);
  });

  it('gifted_speaker provides +1 bargaining and +1 leadership', () => {
    const p = makePerson('a', { traits: ['gifted_speaker'] });
    const bonuses = getTraitSkillGrowthBonuses(p);
    expect(bonuses.bargaining).toBe(1);
    expect(bonuses.leadership).toBe(1);
  });

  it('mentor_hearted provides +1 leadership', () => {
    const p = makePerson('a', { traits: ['mentor_hearted'] });
    const bonuses = getTraitSkillGrowthBonuses(p);
    expect(bonuses.leadership).toBe(1);
  });

  it('inspired provides +1 to all six skills', () => {
    const p = makePerson('a', { traits: ['inspired'] });
    const bonuses = getTraitSkillGrowthBonuses(p);
    expect(bonuses.animals).toBe(1);
    expect(bonuses.bargaining).toBe(1);
    expect(bonuses.combat).toBe(1);
    expect(bonuses.custom).toBe(1);
    expect(bonuses.leadership).toBe(1);
    expect(bonuses.plants).toBe(1);
  });

  it('bereaved provides -1 to all six skills', () => {
    const p = makePerson('a', { traits: ['bereaved'] });
    const bonuses = getTraitSkillGrowthBonuses(p);
    expect(bonuses.plants).toBe(-1);
    expect(bonuses.leadership).toBe(-1);
  });

  it('stacks multiple trait bonuses correctly', () => {
    // green_thumb (+2 plants) + gifted_speaker (+1 bargaining, +1 leadership)
    const p = makePerson('a', { traits: ['green_thumb', 'gifted_speaker'] });
    const bonuses = getTraitSkillGrowthBonuses(p);
    expect(bonuses.plants).toBe(2);
    expect(bonuses.bargaining).toBe(1);
    expect(bonuses.leadership).toBe(1);
    expect(bonuses.combat).toBeUndefined();
  });
});
