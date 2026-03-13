/**
 * Tests for getLanguageCompatibility() in marriage.ts.
 *
 * Covers:
 *   - 'shared'  — both speakers conversational (≥0.3) in the same language
 *   - 'partial' — one conversational, the other has any fluency > 0
 *   - 'none'    — no linguistic overlap at all
 *   - Tradetalk counts for 'shared' / 'partial' like any other language
 *   - Asymmetric partial (B conversational, A sub-threshold) is still 'partial'
 */

import { describe, it, expect } from 'vitest';
import { getLanguageCompatibility } from '../../src/simulation/population/marriage';
import type { Person } from '../../src/simulation/population/person';
import type { LanguageId } from '../../src/simulation/population/person';

// ─── Minimal person stub ──────────────────────────────────────────────────────

/** getLanguageCompatibility only reads the `languages` field. */
function withLanguages(fluencies: Array<[LanguageId, number]>): Person {
  return {
    languages: fluencies.map(([language, fluency]) => ({ language, fluency })),
  } as unknown as Person;
}

// ─── 'shared' ────────────────────────────────────────────────────────────────

describe("getLanguageCompatibility — 'shared'", () => {
  it("returns 'shared' when both speak Imanian above threshold", () => {
    const a = withLanguages([['imanian', 1.0]]);
    const b = withLanguages([['imanian', 0.8]]);
    expect(getLanguageCompatibility(a, b)).toBe('shared');
  });

  it("returns 'shared' when both are exactly at the 0.3 threshold", () => {
    const a = withLanguages([['kiswani', 0.3]]);
    const b = withLanguages([['kiswani', 0.3]]);
    expect(getLanguageCompatibility(a, b)).toBe('shared');
  });

  it("returns 'shared' when they share a second language (not the first listed)", () => {
    const a = withLanguages([['imanian', 1.0], ['kiswani', 0.6]]);
    const b = withLanguages([['hanjoda',  1.0], ['kiswani', 0.5]]);
    expect(getLanguageCompatibility(a, b)).toBe('shared');
  });

  it("returns 'shared' when Tradetalk is the shared bridge language", () => {
    // Tradetalk is capped at 0.5 but 0.5 >= 0.3 — counts as conversational
    const a = withLanguages([['tradetalk', 0.5]]);
    const b = withLanguages([['tradetalk', 0.4]]);
    expect(getLanguageCompatibility(a, b)).toBe('shared');
  });

  it("returns 'shared' for a creole both speak conversationally", () => {
    const a = withLanguages([['settlement_creole', 0.7]]);
    const b = withLanguages([['settlement_creole', 0.5]]);
    expect(getLanguageCompatibility(a, b)).toBe('shared');
  });
});

// ─── 'partial' ────────────────────────────────────────────────────────────────

describe("getLanguageCompatibility — 'partial'", () => {
  it("returns 'partial' when A is conversational but B has sub-threshold fluency", () => {
    const a = withLanguages([['kiswani', 0.8]]);
    const b = withLanguages([['kiswani', 0.1]]); // hears some but not conversational
    expect(getLanguageCompatibility(a, b)).toBe('partial');
  });

  it("returns 'partial' when B is conversational but A has sub-threshold fluency", () => {
    const a = withLanguages([['imanian', 0.05]]);
    const b = withLanguages([['imanian', 1.0]]);
    expect(getLanguageCompatibility(a, b)).toBe('partial');
  });

  it("returns 'partial' when the only overlap is via Tradetalk (one-sided)", () => {
    const a = withLanguages([['imanian', 1.0], ['tradetalk', 0.4]]);
    const b = withLanguages([['kiswani', 1.0], ['tradetalk', 0.1]]);
    // Neither fully shares a tongue — A has tradetalk conversational, B barely knows it
    expect(getLanguageCompatibility(a, b)).toBe('partial');
  });
});

// ─── 'none' ───────────────────────────────────────────────────────────────────

describe("getLanguageCompatibility — 'none'", () => {
  it("returns 'none' when the two people speak entirely different languages", () => {
    const a = withLanguages([['imanian', 1.0]]);
    const b = withLanguages([['kiswani', 1.0]]);
    expect(getLanguageCompatibility(a, b)).toBe('none');
  });

  it("returns 'none' when one person has no languages at all", () => {
    const a = withLanguages([['imanian', 1.0]]);
    const b = withLanguages([]);
    expect(getLanguageCompatibility(a, b)).toBe('none');
  });

  it("returns 'none' when both persons have no languages", () => {
    const a = withLanguages([]);
    const b = withLanguages([]);
    expect(getLanguageCompatibility(a, b)).toBe('none');
  });

  it("returns 'none' when overlap exists but both are sub-threshold", () => {
    // Neither reaches conversational — sub-threshold overlap is not enough for 'partial'
    // because 'partial' requires at least one side to be conversational
    const a = withLanguages([['imanian', 0.2]]);
    const b = withLanguages([['imanian', 0.1]]);
    expect(getLanguageCompatibility(a, b)).toBe('none');
  });
});

// ─── Household formation via performMarriage ──────────────────────────────────

import { canMarry, performMarriage, formConcubineRelationship } from '../../src/simulation/population/marriage';
import type { GameState } from '../../src/simulation/turn/game-state';

/** Builds a minimal person stub for marriage tests. */
function makePerson(
  id: string,
  sex: 'male' | 'female',
  culture: string = 'settlement_native',
  overrides: Partial<Person> = {},
): Person {
  return {
    id,
    firstName: 'T',
    familyName: 'Test',
    givenName: 'T',
    sex,
    age: 25,
    isAlive: true,
    role: 'unassigned',
    socialStatus: 'free',
    spouseIds: [],
    parentIds: [null, null],
    childrenIds: [],
    motherId: null,
    fatherId: null,
    householdId: null,
    householdRole: null,
    ashkaMelathiPartnerIds: [],
    languages: [],
    heritage: { bloodline: [], primaryCulture: culture, cultureWeights: {} },
    genetics: {
      visibleTraits: { skinTone: 0.4, hairColor: 'brown', hairTexture: 'straight', eyeColor: 'brown', build: 'medium', heightModifier: 0 },
      extendedFertility: false,
      genderRatioModifier: 0,
    },
    traits: [],
    skills: { animals: 25, bargaining: 25, combat: 25, custom: 25, leadership: 25, plants: 25 },
    relationships: new Map(),
    portraitVariant: 1,
    ...overrides,
  } as unknown as Person;
}

function makeState(people: Person[]): GameState {
  return {
    people: new Map(people.map(p => [p.id, p])),
    households: new Map(),
    turnNumber: 1,
  } as unknown as GameState;
}

describe('performMarriage — household creation', () => {
  it('creates a new household when the man has none', () => {
    const man   = makePerson('m1', 'male');
    const woman = makePerson('w1', 'female');
    const state = makeState([man, woman]);
    const result = performMarriage(man, woman, state);
    expect(result.householdCreated).toBe(true);
    expect(result.household.memberIds).toContain('m1');
    expect(result.household.memberIds).toContain('w1');
  });

  it('assigns head to man and senior_wife to woman on first marriage', () => {
    const man   = makePerson('m1', 'male');
    const woman = makePerson('w1', 'female');
    const state = makeState([man, woman]);
    const result = performMarriage(man, woman, state);
    expect(result.updatedPersonA.householdRole ?? result.updatedPersonB.householdRole).toBeTruthy();
    const updatedMan   = result.updatedPersonA.sex === 'male' ? result.updatedPersonA : result.updatedPersonB;
    const updatedWoman = result.updatedPersonA.sex === 'female' ? result.updatedPersonA : result.updatedPersonB;
    expect(updatedMan.householdRole).toBe('head');
    expect(updatedWoman.householdRole).toBe('senior_wife');
  });

  it('uses sauromatian tradition when bride is settlement_native culture', () => {
    const man   = makePerson('m1', 'male');
    const woman = makePerson('w1', 'female', 'settlement_native');
    const result = performMarriage(man, woman, makeState([man, woman]));
    expect(result.household.tradition).toBe('sauromatian');
  });

  it('uses imanian tradition when bride is imanian culture', () => {
    const man   = makePerson('m1', 'male');
    const woman = makePerson('w1', 'female', 'imanian');
    const result = performMarriage(man, woman, makeState([man, woman]));
    expect(result.household.tradition).toBe('imanian');
  });
});

describe('canMarry — household wife-capacity check', () => {
  it('blocks a second formal wife when Imanian household already has one', () => {
    // Imanian tradition: maxWives=1, maxConcubines=2 → manMaxSpouses=3
    // Man has 1 spouseId (below the 3-cap) but the household already has 1 wife by role
    const existingWife = makePerson('w1', 'female', 'imanian', {
      householdId: 'hh-1',
      householdRole: 'senior_wife',
      spouseIds: ['m1'],
    });
    const man = makePerson('m1', 'male', 'imanian', {
      householdId: 'hh-1',
      householdRole: 'head',
      spouseIds: ['w1'],
    });
    const newWoman = makePerson('w2', 'female', 'imanian');
    const state: GameState = {
      people: new Map([[man.id, man], [existingWife.id, existingWife], [newWoman.id, newWoman]]),
      households: new Map([['hh-1', {
        id: 'hh-1',
        name: 'House of Test',
        tradition: 'imanian' as const,
        headId: 'm1',
        seniorWifeId: 'w1',
        memberIds: ['m1', 'w1'],
        ashkaMelathiBonds: [],
        foundedTurn: 1,
      }]]),
      turnNumber: 1,
    } as unknown as GameState;
    const result = canMarry(man, newWoman, state);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('household_at_wife_capacity');
  });
});

describe('formConcubineRelationship', () => {
  it('creates a new household when man has none, sets concubine role on woman', () => {
    const man   = makePerson('m1', 'male');
    const woman = makePerson('w1', 'female');
    const state = makeState([man, woman]);
    const result = formConcubineRelationship(man, woman, 'concubine', state);
    expect(result.householdCreated).toBe(true);
    expect(result.updatedWoman.householdRole).toBe('concubine');
    expect(result.household.memberIds).toContain('m1');
    expect(result.household.memberIds).toContain('w1');
  });

  it('sets hearth_companion role when style is hearth_companion', () => {
    const man   = makePerson('m1', 'male');
    const woman = makePerson('w1', 'female');
    const state = makeState([man, woman]);
    const result = formConcubineRelationship(man, woman, 'hearth_companion', state);
    expect(result.updatedWoman.householdRole).toBe('hearth_companion');
  });

  it('joins an existing household when man already has one', () => {
    const existingHousehold = {
      id: 'hh-1',
      name: 'Existing Ashkaran',
      tradition: 'sauromatian' as const,
      headId: 'm1',
      seniorWifeId: null,
      memberIds: ['m1'],
      ashkaMelathiBonds: [],
      foundedTurn: 1,
    };
    const man   = makePerson('m1', 'male', 'settlement_native', { householdId: 'hh-1', householdRole: 'head' });
    const woman = makePerson('w1', 'female');
    const state: GameState = {
      people: new Map([[man.id, man], [woman.id, woman]]),
      households: new Map([['hh-1', existingHousehold]]),
      turnNumber: 1,
    } as unknown as GameState;
    const result = formConcubineRelationship(man, woman, 'concubine', state);
    expect(result.householdCreated).toBe(false);
    expect(result.household.id).toBe('hh-1');
    expect(result.household.memberIds).toContain('w1');
  });
});
