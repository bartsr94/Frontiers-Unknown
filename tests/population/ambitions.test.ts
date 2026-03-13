import { describe, it, expect } from 'vitest';
import type { Person, PersonAmbition } from '../../src/simulation/population/person';
import type { GameState } from '../../src/simulation/turn/game-state';
import {
  AMBITION_FIRING_THRESHOLD,
  tickAmbitionIntensity,
  evaluateAmbition,
  generateAmbition,
  clearAmbition,
  getAmbitionLabel,
} from '../../src/simulation/population/ambitions';
import { createRNG } from '../../src/utils/rng';

// ─── Test helpers ──────────────────────────────────────────────────────────────

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
    religion: 'animist',
    heritage: {
      bloodline: { imanian: 1, kiswani_riverfolk: 0, kiswani_bayuk: 0, kiswani_haisla: 0, hanjoda_stormcaller: 0, hanjoda_bloodmoon: 0, hanjoda_talon: 0, hanjoda_emrasi: 0 },
      primaryCulture: 'imanian',
      culturalFluency: new Map(),
      ethnicGroup: 'imanian',
    },
    genetics: {
      skinTone: 0.3, hairColor: 'brown', hairTexture: 'straight', eyeColor: 'blue',
      heightModifier: 0, buildModifier: 0, genderRatioModifier: 0, extendedFertility: false,
    },
    languages: [],
    pregnancies: [],
    spouseIds: [],
    childIds: [],
    motherIds: [],
    fatherIds: [],
    relationships: new Map(),
    householdId: null,
    householdRole: null,
    ashkaMelathiPartnerIds: [],
    ambition: null,
    skills: { animals: 25, bargaining: 25, combat: 25, custom: 25, leadership: 25, plants: 25 },
    portraitVariant: 1,
    ...overrides,
  } as Person;
}

function makeAmbition(overrides: Partial<PersonAmbition> = {}): PersonAmbition {
  return {
    type: 'seek_spouse',
    intensity: 0.3,
    targetPersonId: null,
    formedTurn: 1,
    ...overrides,
  };
}

function makeState(overrides: Partial<GameState> = {}): GameState {
  return {
    turnNumber: 10,
    people: new Map(),
    councilMemberIds: [] as string[],
    households: new Map(),
    ...overrides,
  } as unknown as GameState;
}

// ─── tickAmbitionIntensity ────────────────────────────────────────────────────

describe('tickAmbitionIntensity', () => {
  it('increments intensity by 0.05 per turn', () => {
    const p = makePerson('a', { ambition: makeAmbition({ intensity: 0.3 }) });
    const result = tickAmbitionIntensity(p);
    expect(result.ambition!.intensity).toBeCloseTo(0.35);
  });

  it('caps intensity at 1.0', () => {
    const p = makePerson('a', { ambition: makeAmbition({ intensity: 0.98 }) });
    const result = tickAmbitionIntensity(p);
    expect(result.ambition!.intensity).toBe(1.0);
  });

  it('returns same reference when person has no ambition', () => {
    const p = makePerson('a');
    expect(tickAmbitionIntensity(p)).toBe(p);
  });

  it('does not tick for content trait', () => {
    const p = makePerson('a', {
      traits: ['content'],
      ambition: makeAmbition({ intensity: 0.3 }),
    });
    const result = tickAmbitionIntensity(p);
    expect(result.ambition!.intensity).toBe(0.3);
  });
});

// ─── evaluateAmbition ─────────────────────────────────────────────────────────

describe('evaluateAmbition', () => {
  it('returns ongoing when person has no ambition', () => {
    const p = makePerson('a');
    const state = makeState({ turnNumber: 10 });
    expect(evaluateAmbition(p, state)).toBe('ongoing');
  });

  it('returns failed when ambition is stale (>40 turns)', () => {
    const p = makePerson('a', { ambition: makeAmbition({ formedTurn: 1, type: 'seek_spouse' }) });
    const state = makeState({ turnNumber: 50 }); // 50 - 1 = 49 > 40
    expect(evaluateAmbition(p, state)).toBe('failed');
  });

  it('seek_spouse: fulfilled when target is now a spouse', () => {
    const p = makePerson('a', {
      spouseIds: ['b'],
      ambition: makeAmbition({ type: 'seek_spouse', targetPersonId: 'b', formedTurn: 1 }),
    });
    const target = makePerson('b');
    const state = makeState({ turnNumber: 5, people: new Map([['b', target]]) });
    expect(evaluateAmbition(p, state)).toBe('fulfilled');
  });

  it('seek_spouse: failed when target is dead/gone', () => {
    const p = makePerson('a', {
      ambition: makeAmbition({ type: 'seek_spouse', targetPersonId: 'b', formedTurn: 1 }),
    });
    const state = makeState({ turnNumber: 5, people: new Map() }); // 'b' not in map
    expect(evaluateAmbition(p, state)).toBe('failed');
  });

  it('seek_spouse: failed when target married someone else', () => {
    const p = makePerson('a', {
      ambition: makeAmbition({ type: 'seek_spouse', targetPersonId: 'b', formedTurn: 1 }),
    });
    const target = makePerson('b', { spouseIds: ['c'] });
    const state = makeState({ turnNumber: 5, people: new Map([['b', target]]) });
    expect(evaluateAmbition(p, state)).toBe('failed');
  });

  it('seek_council: fulfilled when person is on council', () => {
    const p = makePerson('a', {
      ambition: makeAmbition({ type: 'seek_council', formedTurn: 1 }),
    });
    const state = makeState({ turnNumber: 5, councilMemberIds: ['a'] });
    expect(evaluateAmbition(p, state)).toBe('fulfilled');
  });

  it('seek_council: ongoing when not on council yet', () => {
    const p = makePerson('a', {
      ambition: makeAmbition({ type: 'seek_council', formedTurn: 1 }),
    });
    const state = makeState({ turnNumber: 5, councilMemberIds: [] });
    expect(evaluateAmbition(p, state)).toBe('ongoing');
  });

  it('seek_seniority: fulfilled when householdRole is senior_wife', () => {
    const p = makePerson('a', {
      householdRole: 'senior_wife',
      householdId: 'hh1',
      ambition: makeAmbition({ type: 'seek_seniority', formedTurn: 1 }),
    });
    const state = makeState({ turnNumber: 5 });
    expect(evaluateAmbition(p, state)).toBe('fulfilled');
  });

  it('seek_seniority: failed when no longer in a household', () => {
    const p = makePerson('a', {
      householdRole: null,
      householdId: null,
      ambition: makeAmbition({ type: 'seek_seniority', formedTurn: 1 }),
    });
    const state = makeState({ turnNumber: 5 });
    expect(evaluateAmbition(p, state)).toBe('failed');
  });

  it('seek_cultural_duty: fulfilled when role is keth_thara', () => {
    const p = makePerson('a', {
      role: 'keth_thara',
      age: 20,
      ambition: makeAmbition({ type: 'seek_cultural_duty', formedTurn: 1 }),
    });
    const state = makeState({ turnNumber: 5 });
    expect(evaluateAmbition(p, state)).toBe('fulfilled');
  });

  it('seek_cultural_duty: failed when past eligible age', () => {
    const p = makePerson('a', {
      role: 'unassigned',
      age: 26,
      ambition: makeAmbition({ type: 'seek_cultural_duty', formedTurn: 1 }),
    });
    const state = makeState({ turnNumber: 5 });
    expect(evaluateAmbition(p, state)).toBe('failed');
  });

  it('seek_informal_union: fulfilled when target is in household as concubine', () => {
    const p = makePerson('a', {
      householdId: 'hh1',
      ambition: makeAmbition({ type: 'seek_informal_union', targetPersonId: 'b', formedTurn: 1 }),
    });
    const target = makePerson('b', { householdId: 'hh1', householdRole: 'concubine' });
    const state = makeState({ turnNumber: 5, people: new Map([['b', target]]) });
    expect(evaluateAmbition(p, state)).toBe('fulfilled');
  });

  it('seek_informal_union: failed when target married someone else', () => {
    const p = makePerson('a', {
      householdId: 'hh1',
      ambition: makeAmbition({ type: 'seek_informal_union', targetPersonId: 'b', formedTurn: 1 }),
    });
    const target = makePerson('b', { spouseIds: ['c'] });
    const state = makeState({ turnNumber: 5, people: new Map([['b', target]]) });
    expect(evaluateAmbition(p, state)).toBe('failed');
  });
});

// ─── generateAmbition ────────────────────────────────────────────────────────

describe('generateAmbition', () => {
  it('returns null if person already has an ambition', () => {
    const p = makePerson('a', { ambition: makeAmbition() });
    const state = makeState();
    const rng = createRNG(42);
    expect(generateAmbition(p, state, rng)).toBeNull();
  });

  it('returns seek_spouse for unmarried adult with strong opinion toward eligible partner', () => {
    const person = makePerson('a', {
      sex: 'male',
      age: 25,
      spouseIds: [],
      relationships: new Map([['b', 50]]),
    });
    const partner = makePerson('b', { sex: 'female', age: 22, spouseIds: [] });
    const state = makeState({ people: new Map([['a', person], ['b', partner]]) });
    const rng = createRNG(42);
    const result = generateAmbition(person, state, rng);
    expect(result?.type).toBe('seek_spouse');
    expect(result?.targetPersonId).toBe('b');
  });

  it('returns seek_council for skilled person not on council', () => {
    // No eligible spouse candidates (no one else in settlement), leadership >= 55
    const person = makePerson('a', {
      age: 30,
      spouseIds: [],
      skills: { animals: 25, bargaining: 25, combat: 25, custom: 25, leadership: 60, plants: 25 },
    });
    const state = makeState({ councilMemberIds: [] });
    const rng = createRNG(42);
    const result = generateAmbition(person, state, rng);
    expect(result?.type).toBe('seek_council');
  });

  it('returns seek_cultural_duty for young Sauromatian male', () => {
    const person = makePerson('a', {
      sex: 'male',
      age: 20,
      spouseIds: [],
      role: 'unassigned',
      heritage: {
        bloodline: [
          { group: 'kiswani_riverfolk' as const, fraction: 1.0 },
        ],
        primaryCulture: 'kiswani_riverfolk',
        culturalFluency: new Map(),
      },
      skills: { animals: 25, bargaining: 25, combat: 25, custom: 25, leadership: 25, plants: 25 },
    });
    // Leadership < 46 so seek_council is skipped; no eligible partners so seek_spouse skipped
    const state = makeState({ councilMemberIds: ['x'] });
    const rng = createRNG(42);
    const result = generateAmbition(person, state, rng);
    expect(result?.type).toBe('seek_cultural_duty');
  });

  it('assigns formedTurn from state.turnNumber', () => {
    const person = makePerson('a', {
      sex: 'male',
      age: 25,
      spouseIds: [],
      relationships: new Map([['b', 50]]),
    });
    const partner = makePerson('b', { sex: 'female', age: 22, spouseIds: [] });
    const state = makeState({ turnNumber: 15, people: new Map([['a', person], ['b', partner]]) });
    const rng = createRNG(42);
    const result = generateAmbition(person, state, rng);
    expect(result?.formedTurn).toBe(15);
  });
});

// ─── clearAmbition ───────────────────────────────────────────────────────────

describe('clearAmbition', () => {
  it('removes an active ambition', () => {
    const p = makePerson('a', { ambition: makeAmbition() });
    expect(clearAmbition(p).ambition).toBeNull();
  });

  it('is a no-op when person has no ambition', () => {
    const p = makePerson('a');
    expect(clearAmbition(p)).toBe(p);
  });
});

// ─── getAmbitionLabel ─────────────────────────────────────────────────────────

describe('getAmbitionLabel', () => {
  const cases: Array<[PersonAmbition['type'], string]> = [
    ['seek_spouse',          'Seeking a companion'],
    ['seek_council',         'Seeking a council seat'],
    ['seek_seniority',       'Seeking senior-wife standing'],
    ['seek_cultural_duty',   'Called to keth-thara'],
    ['seek_informal_union',  'Seeking an informal bond'],
  ];

  for (const [type, expected] of cases) {
    it(`returns "${expected}" for type "${type}"`, () => {
      const a = makeAmbition({ type });
      expect(getAmbitionLabel(a)).toBe(expected);
    });
  }
});

// ─── AMBITION_FIRING_THRESHOLD ────────────────────────────────────────────────

describe('AMBITION_FIRING_THRESHOLD', () => {
  it('is 0.7', () => {
    expect(AMBITION_FIRING_THRESHOLD).toBe(0.7);
  });
});
