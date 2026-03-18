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
  determineAmbitionType,
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
    ['seek_spouse',          'Seeking a spouse'],
    ['seek_companion',       'Seeking a companion'],
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

// ─── determineAmbitionType — seek_companion ───────────────────────────────────

describe('determineAmbitionType — seek_companion (Sauromatian)', () => {
  function makeSauroWoman(id: string, overrides: Partial<Person> = {}): Person {
    return makePerson(id, {
      sex: 'female',
      age: 18,
      spouseIds: [],
      heritage: {
        bloodline: { imanian: 0, kiswani_riverfolk: 0, kiswani_bayuk: 0, kiswani_haisla: 1,
                     hanjoda_stormcaller: 0, hanjoda_bloodmoon: 0, hanjoda_talon: 0, hanjoda_emrasi: 0 },
        primaryCulture: 'kiswani_haisla',
        culturalFluency: new Map(),
        ethnicGroup: 'kiswani_haisla',
      },
      ...overrides,
    });
  }

  it('generates seek_companion for eligible Sauromatian woman under mixed norms', () => {
    const rng = createRNG(42);
    const woman = makeSauroWoman('w');
    const man = makePerson('m', { sex: 'male', age: 25, spouseIds: [] });
    const state = makeState({
      people: new Map([['w', woman], ['m', man]]),
      settlement: { courtshipNorms: 'mixed' },
    });
    const result = determineAmbitionType(woman, state, rng);
    expect(result?.type).toBe('seek_companion');
    expect(result?.targetPersonId).toBe('m');
  });

  it('generates seek_companion under open norms', () => {
    const rng = createRNG(42);
    const woman = makeSauroWoman('w');
    const man = makePerson('m', { sex: 'male', age: 25, spouseIds: [] });
    const state = makeState({
      people: new Map([['w', woman], ['m', man]]),
      settlement: { courtshipNorms: 'open' },
    });
    const result = determineAmbitionType(woman, state, rng);
    expect(result?.type).toBe('seek_companion');
  });

  it('does NOT generate seek_companion under traditional norms', () => {
    const rng = createRNG(42);
    const woman = makeSauroWoman('w');
    const man = makePerson('m', { sex: 'male', age: 25, spouseIds: [] });
    const state = makeState({
      people: new Map([['w', woman], ['m', man]]),
      settlement: { courtshipNorms: 'traditional' },
    });
    const result = determineAmbitionType(woman, state, rng);
    expect(result?.type).not.toBe('seek_companion');
  });

  it('does NOT generate seek_companion if woman is already married', () => {
    const rng = createRNG(42);
    const woman = makeSauroWoman('w', { spouseIds: ['husband'] });
    const man = makePerson('m', { sex: 'male', age: 25, spouseIds: [] });
    const state = makeState({
      people: new Map([['w', woman], ['m', man]]),
      settlement: { courtshipNorms: 'mixed' },
    });
    const result = determineAmbitionType(woman, state, rng);
    expect(result?.type).not.toBe('seek_companion');
  });

  it('does NOT generate seek_companion for a non-Sauromatian woman', () => {
    const rng = createRNG(42);
    const woman = makePerson('w', { sex: 'female', age: 18, spouseIds: [] });
    const man = makePerson('m', { sex: 'male', age: 25, spouseIds: [] });
    const state = makeState({
      people: new Map([['w', woman], ['m', man]]),
      settlement: { courtshipNorms: 'mixed' },
    });
    const result = determineAmbitionType(woman, state, rng);
    expect(result?.type).not.toBe('seek_companion');
  });
});

// ─── evaluateAmbition — seek_companion ───────────────────────────────────────

describe('evaluateAmbition — seek_companion', () => {
  it('returns "fulfilled" when target became a spouse', () => {
    const woman = makePerson('w', {
      spouseIds: ['m'],
      ambition: makeAmbition({ type: 'seek_companion', targetPersonId: 'm', formedTurn: 1 }),
    });
    const man = makePerson('m', { sex: 'male', spouseIds: ['w'] });
    const state = makeState({ turnNumber: 5, people: new Map([['w', woman], ['m', man]]) });
    expect(evaluateAmbition(woman, state)).toBe('fulfilled');
  });

  it('returns "fulfilled" when target is a concubine in the same household', () => {
    const woman = makePerson('w', {
      householdId: 'hh1',
      ambition: makeAmbition({ type: 'seek_companion', targetPersonId: 'm', formedTurn: 1 }),
    });
    const man = makePerson('m', { sex: 'male', householdId: 'hh1', householdRole: 'concubine' });
    const state = makeState({ turnNumber: 5, people: new Map([['w', woman], ['m', man]]) });
    expect(evaluateAmbition(woman, state)).toBe('fulfilled');
  });

  it('returns "failed" when target is gone (dead/left)', () => {
    const woman = makePerson('w', {
      ambition: makeAmbition({ type: 'seek_companion', targetPersonId: 'gone', formedTurn: 1 }),
    });
    const state = makeState({ turnNumber: 5, people: new Map([['w', woman]]) });
    expect(evaluateAmbition(woman, state)).toBe('failed');
  });

  it('returns "failed" when target married someone else', () => {
    const woman = makePerson('w', {
      ambition: makeAmbition({ type: 'seek_companion', targetPersonId: 'm', formedTurn: 1 }),
    });
    const man = makePerson('m', { sex: 'male', spouseIds: ['other'] });
    const state = makeState({ turnNumber: 5, people: new Map([['w', woman], ['m', man]]) });
    expect(evaluateAmbition(woman, state)).toBe('failed');
  });

  it('returns "ongoing" when target exists and is still unmarried', () => {
    const woman = makePerson('w', {
      ambition: makeAmbition({ type: 'seek_companion', targetPersonId: 'm', formedTurn: 1 }),
    });
    const man = makePerson('m', { sex: 'male', spouseIds: [] });
    const state = makeState({ turnNumber: 5, people: new Map([['w', woman], ['m', man]]) });
    expect(evaluateAmbition(woman, state)).toBe('ongoing');
  });

  it('returns "failed" after 30 turns (seek_companion stale limit)', () => {
    const woman = makePerson('w', {
      ambition: makeAmbition({ type: 'seek_companion', targetPersonId: 'm', formedTurn: 1 }),
    });
    const man = makePerson('m', { sex: 'male', spouseIds: [] });
    const state = makeState({ turnNumber: 32, people: new Map([['w', woman], ['m', man]]) });
    expect(evaluateAmbition(woman, state)).toBe('failed');
  });
});

// ─── seek_better_housing — evaluation & generation ───────────────────────────

describe('evaluateAmbition — seek_better_housing', () => {
  function makeHousingState(
    memberIds: string[],
    dwellingDefId: string,
    dwellingInstanceId = 'dw1',
  ) {
    return makeState({
      turnNumber: 5,
      households: new Map([
        ['hh1', {
          id: 'hh1',
          memberIds,
          dwellingBuildingId: dwellingInstanceId,
          buildingSlots: [dwellingInstanceId, null, null, null, null, null, null, null, null],
        } as import('../../src/simulation/turn/game-state').Household],
      ]),
      settlement: {
        buildings: [
          { defId: dwellingDefId, instanceId: dwellingInstanceId, builtTurn: 1, style: null },
        ],
      },
    });
  }

  it('is ongoing when household is at exactly 50% of wattle_hut capacity (2/4)', () => {
    const p = makePerson('a', {
      householdId: 'hh1',
      ambition: makeAmbition({ type: 'seek_better_housing', formedTurn: 1 }),
    });
    // memberIds = 2, shelterCapacity = 4 → 2 >= 2 → still overcrowded intent
    const state = makeHousingState(['a', 'b'], 'wattle_hut');
    expect(evaluateAmbition(p, state)).toBe('ongoing');
  });

  it('is fulfilled when household drops below 50% after an upgrade (1 member in cottage)', () => {
    const p = makePerson('a', {
      householdId: 'hh1',
      ambition: makeAmbition({ type: 'seek_better_housing', formedTurn: 1 }),
    });
    // cottage shelterCapacity = 6 → threshold = 3; 1 member < 3 → fulfilled
    const state = makeHousingState(['a'], 'cottage');
    expect(evaluateAmbition(p, state)).toBe('fulfilled');
  });

  it('is ongoing when household still at 50%+ of upgraded dwelling (3 in cottage)', () => {
    const p = makePerson('a', {
      householdId: 'hh1',
      ambition: makeAmbition({ type: 'seek_better_housing', formedTurn: 1 }),
    });
    // cottage cap 6 → threshold = 3; 3 >= 3 → still needs next tier
    const state = makeHousingState(['a', 'b', 'c'], 'cottage');
    expect(evaluateAmbition(p, state)).toBe('ongoing');
  });

  it('is fulfilled when household reaches compound regardless of occupancy', () => {
    const p = makePerson('a', {
      householdId: 'hh1',
      ambition: makeAmbition({ type: 'seek_better_housing', formedTurn: 1 }),
    });
    // compound = top tier, always fulfilled
    const state = makeHousingState(['a', 'b', 'c', 'd', 'e', 'f'], 'compound');
    expect(evaluateAmbition(p, state)).toBe('fulfilled');
  });

  it('is failed when person has no household', () => {
    const p = makePerson('a', {
      householdId: null,
      ambition: makeAmbition({ type: 'seek_better_housing', formedTurn: 1 }),
    });
    const state = makeState({ turnNumber: 5 });
    expect(evaluateAmbition(p, state)).toBe('failed');
  });
});

describe('determineAmbitionType — seek_better_housing (capacity-based)', () => {
  const rng = { nextInt: () => 0, nextFloat: () => 0, nextGaussian: () => 0 } as import('../../src/utils/rng').SeededRNG;

  function makeHousingPerson(memberIds: string[], dwellingDefId: string | null) {
    const p = makePerson('a', {
      householdId: 'hh1',
      spouseIds: [],
      age: 30,
      // high skills so council/prestige ambitions don't fire first
      skills: { animals: 25, bargaining: 25, combat: 25, custom: 25, leadership: 25, plants: 25 },
    });
    const household = {
      id: 'hh1',
      memberIds,
      dwellingBuildingId: dwellingDefId ? 'dw1' : null,
      buildingSlots: dwellingDefId ? ['dw1', null, null, null, null, null, null, null, null] : Array(9).fill(null),
    } as import('../../src/simulation/turn/game-state').Household;
    const buildings = dwellingDefId
      ? [{ defId: dwellingDefId, instanceId: 'dw1', builtTurn: 1, style: null }]
      : [];
    const state = makeState({
      turnNumber: 5,
      households: new Map([['hh1', household]]),
      settlement: {
        buildings,
        courtshipNorms: 'traditional', // prevents seek_companion/spouse from firing
      },
      councilMemberIds: ['a'], // prevents seek_council
      people: new Map(memberIds.map(id => [id, makePerson(id)])),
    });
    return { p, state };
  }

  it('fires when couple (2) is at 50% of wattle_hut capacity (4)', () => {
    const { p, state } = makeHousingPerson(['a', 'b'], 'wattle_hut');
    const result = determineAmbitionType(p, state, rng);
    expect(result?.type).toBe('seek_better_housing');
  });

  it('does not fire when single occupant (1) is below 50% of wattle_hut', () => {
    const { p, state } = makeHousingPerson(['a'], 'wattle_hut');
    const result = determineAmbitionType(p, state, rng);
    expect(result?.type).not.toBe('seek_better_housing');
  });

  it('fires when 3-member family is at 50% of cottage (6)', () => {
    const { p, state } = makeHousingPerson(['a', 'b', 'c'], 'cottage');
    const result = determineAmbitionType(p, state, rng);
    expect(result?.type).toBe('seek_better_housing');
  });

  it('does not fire when only 2 of 6 cottage slots used (below 50%)', () => {
    const { p, state } = makeHousingPerson(['a', 'b'], 'cottage');
    const result = determineAmbitionType(p, state, rng);
    expect(result?.type).not.toBe('seek_better_housing');
  });

  it('does not fire when household is in compound (top tier)', () => {
    const { p, state } = makeHousingPerson(['a', 'b', 'c', 'd', 'e', 'f'], 'compound');
    const result = determineAmbitionType(p, state, rng);
    expect(result?.type).not.toBe('seek_better_housing');
  });

  it('does not fire when household has no dwelling (Path A handles this)', () => {
    const { p, state } = makeHousingPerson(['a'], null);
    const result = determineAmbitionType(p, state, rng);
    expect(result?.type).not.toBe('seek_better_housing');
  });
});

describe('determineAmbitionType — seek_production_building requires dwelling', () => {
  const rng = { nextInt: () => 0, nextFloat: () => 0, nextGaussian: () => 0 } as import('../../src/utils/rng').SeededRNG;

  it('does not fire when household has no dwelling (shelter first)', () => {
    const p = makePerson('a', {
      role: 'blacksmith',
      householdId: 'hh1',
      age: 30,
    });
    const household = {
      id: 'hh1',
      memberIds: ['a'],
      dwellingBuildingId: null, // no dwelling
      buildingSlots: Array(9).fill(null),
    } as import('../../src/simulation/turn/game-state').Household;
    const state = makeState({
      turnNumber: 5,
      councilMemberIds: ['a'],
      households: new Map([['hh1', household]]),
      settlement: { buildings: [], courtshipNorms: 'traditional' },
      people: new Map([['a', p]]),
    });
    const result = determineAmbitionType(p, state, rng);
    expect(result?.type).not.toBe('seek_production_building');
  });

  it('fires when household has a dwelling and lacks the matching building', () => {
    const p = makePerson('a', {
      role: 'blacksmith',
      householdId: 'hh1',
      age: 30,
    });
    const household = {
      id: 'hh1',
      memberIds: ['a'],
      dwellingBuildingId: 'dw1',
      buildingSlots: ['dw1', null, null, null, null, null, null, null, null],
    } as import('../../src/simulation/turn/game-state').Household;
    const state = makeState({
      turnNumber: 5,
      councilMemberIds: ['a'],
      households: new Map([['hh1', household]]),
      settlement: {
        buildings: [{ defId: 'wattle_hut', instanceId: 'dw1', builtTurn: 1, style: null }],
        courtshipNorms: 'traditional',
      },
      people: new Map([['a', p]]),
    });
    const result = determineAmbitionType(p, state, rng);
    expect(result?.type).toBe('seek_production_building');
  });
});


// ─── getAmbitionLabel — seek_companion (with target) ─────────────────────────

describe('getAmbitionLabel — seek_companion with target', () => {
  it('includes the target ID in the label', () => {
    const a = makeAmbition({ type: 'seek_companion', targetPersonId: 'person_123' });
    expect(getAmbitionLabel(a)).toBe('Seeking a companion — person_123');
  });
});
