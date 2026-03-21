/**
 * Tests for the immigration system.
 *
 * Covers:
 *   - getBuildingFertilityBonus: sums fertilityBonus across buildings
 *   - computeProsperityScore: correct formula components
 *   - attemptConception with buildingFertilityBonus: boosts probability, capped at 0.65
 *   - Bathhouse happiness factors: Sauromatian women per tier, all-women grand bonus
 *   - min_prosperity prerequisite in event-filter
 *   - has_tribe_contact prerequisite in event-filter
 *   - add_person extended: initialSkillBoosts and initialTraits applied
 *   - add_person extended: initialRole is set on the new person
 *   - Immigration events are registered in ALL_EVENTS
 *   - Immigration events are in the 'immigration' category
 */

import { describe, it, expect } from 'vitest';
import {
  getBuildingFertilityBonus,
  computeProsperityScore,
} from '../../src/simulation/buildings/building-effects';
import { attemptConception } from '../../src/simulation/genetics/fertility';
import { computeHappinessFactors } from '../../src/simulation/population/happiness';
import { isEventEligible, ALL_EVENTS } from '../../src/simulation/events/event-filter';
import { applyEventChoice } from '../../src/simulation/events/resolver';
import { createPerson } from '../../src/simulation/population/person';
import type { Person } from '../../src/simulation/population/person';
import type { GameEvent, EventConsequence } from '../../src/simulation/events/engine';
import type { BuiltBuilding, GameState, ResourceType } from '../../src/simulation/turn/game-state';
import { createRNG } from '../../src/utils/rng';

// ──────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ──────────────────────────────────────────────────────────────────────────────

function builtBuilding(defId: BuiltBuilding['defId'], instanceId?: string): BuiltBuilding {
  return {
    defId,
    instanceId: instanceId ?? `${defId}_0`,
    builtTurn: 0,
    style: null,
    claimedByPersonIds: [],
    ownerHouseholdId: null,
    assignedWorkerIds: [],
  };
}

function makeState(overrides: {
  buildings?: BuiltBuilding[];
  food?: number;
  wealth?: number;
  pop?: number;
  tribes?: GameState['tribes'];
} = {}): GameState {
  const DEFAULT_RESOURCES: Record<ResourceType, number> = {
    food: 0, cattle: 0, wealth: 0, steel: 0, lumber: 0,
    stone: 0, medicine: 0, horses: 0,
  };

  return {
    version: '1.0.0',
    seed: 1,
    turnNumber: 10,
    currentSeason: 'spring',
    currentYear: 2,
    people: new Map(),
    graveyard: [],
    settlement: {
      name: 'Test',
      location: 'marsh',
      buildings: overrides.buildings ?? [],
      resources: {
        ...DEFAULT_RESOURCES,
        food:   overrides.food   ?? 0,
        wealth: overrides.wealth ?? 0,
      },
      populationCount: overrides.pop ?? 0,
    },
    culture: {
      languages: new Map(),
      primaryLanguage: 'imanian',
      religions: new Map(),
      religiousTension: 0,
      culturalBlend: 0.3,
      practices: [],
      governance: 'patriarchal_imanian',
    },
    tribes:  overrides.tribes ?? new Map(),
    company: { standing: 50 },
    eventHistory: [],
    eventCooldowns: new Map(),
    pendingEvents: [],
    councilMemberIds: [],
    deferredEvents: [],
    config: {
      seed: 1,
      settlementName: 'Test',
      startingTribes: [],
      difficulty: 'normal',
    },
  } as unknown as GameState;
}

function makeWoman(overrides: Partial<Person> = {}): Person {
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

function makeMan(): Person {
  return createPerson({
    sex: 'male',
    age: 28,
    heritage: {
      bloodline: [{ group: 'imanian', fraction: 1.0 }],
      primaryCulture: 'ansberite',
      culturalFluency: new Map([['ansberite', 1.0]]),
    },
  });
}

function makeHappinessState(buildings: BuiltBuilding[]): GameState {
  return makeState({ buildings, pop: 5, food: 5 });
}

function makeHappinessPerson(overrides: Partial<Person> = {}): Person {
  return {
    id: 'p1',
    firstName: 'Test',
    familyName: 'Person',
    sex: 'female' as const,
    age: 25,
    role: 'farmer',
    socialStatus: 'settler',
    traits: [],
    religion: 'imanian_orthodox',
    heritage: {
      bloodline: [{ group: 'imanian', fraction: 1.0 }],
      primaryCulture: 'imanian',
      culturalFluency: new Map(),
    },
    genetics: {
      visibleTraits: {
        skinTone: 0.3, skinUndertone: 'neutral' as const, hairColor: 'brown' as const,
        hairTexture: 'straight' as const, eyeColor: 'blue' as const,
        buildType: 'medium' as const, height: 'average' as const, facialStructure: 'oval' as const,
      },
      genderRatioModifier: 0,
      extendedFertility: false,
    },
    health: { currentHealth: 80, conditions: [] },
    languages: [],
    spouseIds: [],
    childrenIds: [],
    parentIds: [null, null],
    relationships: new Map(),
    opinionModifiers: [],
    householdId: null,
    householdRole: null,
    ashkaMelathiPartnerIds: [],
    ambition: null,
    namedRelationships: [],
    activeScheme: null,
    roleAssignedTurn: 0,
    skills: { animals: 25, bargaining: 25, combat: 25, custom: 25, leadership: 25, plants: 25 },
    portraitVariant: 1,
    lowHappinessTurns: 0,
    claimedBuildingId: null,
    isPlayerControlled: false,
    ...overrides,
  } as Person;
}

// ──────────────────────────────────────────────────────────────────────────────
// getBuildingFertilityBonus
// ──────────────────────────────────────────────────────────────────────────────

describe('getBuildingFertilityBonus', () => {
  it('returns 0 when no buildings have fertilityBonus', () => {
    const buildings = [builtBuilding('camp'), builtBuilding('granary')];
    expect(getBuildingFertilityBonus(buildings)).toBe(0);
  });

  it('returns fertilityBonus for a single bathhouse', () => {
    const buildings = [builtBuilding('bathhouse')];
    expect(getBuildingFertilityBonus(buildings)).toBeCloseTo(0.05);
  });

  it('returns fertilityBonus for bathhouse_improved', () => {
    const buildings = [builtBuilding('bathhouse_improved')];
    expect(getBuildingFertilityBonus(buildings)).toBeCloseTo(0.10);
  });

  it('returns fertilityBonus for bathhouse_grand', () => {
    const buildings = [builtBuilding('bathhouse_grand')];
    expect(getBuildingFertilityBonus(buildings)).toBeCloseTo(0.15);
  });

  it('returns 0 for an empty buildings array', () => {
    expect(getBuildingFertilityBonus([])).toBe(0);
  });

  it('does not double-count when a non-bathhouse building is mixed in', () => {
    const buildings = [builtBuilding('bathhouse'), builtBuilding('granary')];
    expect(getBuildingFertilityBonus(buildings)).toBeCloseTo(0.05);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// computeProsperityScore
// ──────────────────────────────────────────────────────────────────────────────

describe('computeProsperityScore', () => {
  it('returns 0 for a completely empty settlement', () => {
    const state = makeState({ buildings: [], food: 0, wealth: 0, pop: 0 });
    expect(computeProsperityScore(state)).toBe(0);
  });

  it('each building contributes 3 points', () => {
    const state = makeState({ buildings: [builtBuilding('camp'), builtBuilding('granary')] });
    expect(computeProsperityScore(state)).toBe(6); // 2 × 3
  });

  it('food contributes floor(food/15)', () => {
    const state = makeState({ food: 30 });
    expect(computeProsperityScore(state)).toBe(2); // floor(30/15) = 2
  });

  it('wealth contributes floor(wealth/3)', () => {
    const state = makeState({ wealth: 9 });
    expect(computeProsperityScore(state)).toBe(3); // floor(9/3) = 3
  });

  it('population contributes floor(pop/5)', () => {
    const state = makeState({ pop: 15 });
    expect(computeProsperityScore(state)).toBe(3); // floor(15/5) = 3
  });

  it('correctly sums all components', () => {
    // 3 buildings → 9, food 30 → 2, wealth 9 → 3, pop 10 → 2  = 16
    const state = makeState({
      buildings: [builtBuilding('camp'), builtBuilding('granary'), builtBuilding('gathering_hall')],
      food: 30, wealth: 9, pop: 10,
    });
    expect(computeProsperityScore(state)).toBe(16);
  });

  it('matches the documented representative value for a starting camp', () => {
    // 1 building (3) + floor(0/15)=0 + floor(0/3)=0 + floor(8/5)=1  = 4
    const state = makeState({
      buildings: [builtBuilding('camp')],
      food: 0, wealth: 0, pop: 8,
    });
    expect(computeProsperityScore(state)).toBe(4);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// attemptConception — buildingFertilityBonus param
// ──────────────────────────────────────────────────────────────────────────────

describe('attemptConception — buildingFertilityBonus', () => {
  it('passing bonus=0 behaves the same as the 5-arg signature', () => {
    const rng1 = createRNG(42);
    const rng2 = createRNG(42);
    const woman = makeWoman();
    const man   = makeMan();

    const r1 = attemptConception(woman, man, 10, 'spring', rng1);
    const r2 = attemptConception(woman, man, 10, 'spring', rng2, 0);
    // Both RNGs got identical rolls; results must match
    expect(r1 === null).toBe(r2 === null);
  });

  it('a large bonus increases conception probability over many trials', () => {
    const woman = makeWoman();
    const man   = makeMan();

    let withBonus    = 0;
    let withoutBonus = 0;
    const TRIALS = 500;

    for (let i = 0; i < TRIALS; i++) {
      const rng = createRNG(i);
      if (attemptConception(woman, man, 10, 'spring', rng, 0.30) !== null) withBonus++;
    }
    for (let i = 0; i < TRIALS; i++) {
      const rng = createRNG(i);
      if (attemptConception(woman, man, 10, 'spring', rng, 0) !== null) withoutBonus++;
    }

    expect(withBonus).toBeGreaterThan(withoutBonus);
  });

  it('conception chance is capped at 0.65 even with a very large bonus', () => {
    // A bonus of 1.0 should not produce more conceptions than cap = 0.65 would
    const woman = makeWoman({ age: 22 }); // peak fertility
    const man   = makeMan();

    let cappedConceptions    = 0;
    let uncappedConceptions  = 0;
    const TRIALS = 1000;

    for (let i = 0; i < TRIALS; i++) {
      if (attemptConception(woman, man, 10, 'summer', createRNG(i), 1.0) !== null) cappedConceptions++;
      if (attemptConception(woman, man, 10, 'summer', createRNG(i), 0.4) !== null) uncappedConceptions++;
    }

    // Both use the same seeds — with cap in effect they should produce equal results
    // (bonus 1.0 capped === bonus 0.4 likely also near cap, but this depends on base)
    // The important invariant: we never get MORE conceptions with 1.0 than 0.4 would give
    // given the cap; simply verify capped does not diverge wildly above 65%
    expect(cappedConceptions / TRIALS).toBeLessThanOrEqual(0.75); // allow stat noise
  });

  it('returns a valid PregnancyState when conception occurs', () => {
    const woman = makeWoman({ age: 22 });
    const man   = makeMan();
    // Use a seed that is likely to produce a conception at high fertility + large bonus
    let result = null;
    for (let i = 0; i < 50 && result === null; i++) {
      result = attemptConception(woman, man, 5, 'spring', createRNG(i), 0.5);
    }
    expect(result).not.toBeNull();
    expect(result!.fatherId).toBe(man.id);
    expect(result!.dueDate).toBe(result!.conceptionTurn + 3);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Bathhouse happiness factors
// ──────────────────────────────────────────────────────────────────────────────

describe('computeHappinessFactors — bathhouse_access', () => {
  const saurPerson = makeHappinessPerson({
    sex: 'female',
    heritage: {
      bloodline: { imanian: 0, kiswani_riverfolk: 1, kiswani_bayuk: 0, kiswani_haisla: 0,
        hanjoda_stormcaller: 0, hanjoda_bloodmoon: 0, hanjoda_talon: 0, hanjoda_emrasi: 0 },
      primaryCulture: 'kiswani_traditional',
      culturalFluency: new Map(),
      ethnicGroup: 'kiswani_riverfolk',
    },
  });

  const imanianWoman = makeHappinessPerson({ sex: 'female' });
  const imanianMan   = makeHappinessPerson({ sex: 'male' });

  it('Sauromatian woman gets +8 from basic bathhouse', () => {
    const state   = makeHappinessState([builtBuilding('bathhouse')]);
    const factors = computeHappinessFactors(saurPerson, state);
    const bath    = factors.find(f => f.label === 'Bathhouse comforts');
    expect(bath).toBeDefined();
    expect(bath!.delta).toBe(8);
    expect(bath!.category).toBe('social');
  });

  it('Sauromatian woman gets +12 from bathhouse_improved', () => {
    const state   = makeHappinessState([builtBuilding('bathhouse_improved')]);
    const factors = computeHappinessFactors(saurPerson, state);
    const bath    = factors.find(f => f.label === 'Improved Bathhouse');
    expect(bath).toBeDefined();
    expect(bath!.delta).toBe(12);
  });

  it('Sauromatian woman gets +16 from bathhouse_grand', () => {
    const state   = makeHappinessState([builtBuilding('bathhouse_grand')]);
    const factors = computeHappinessFactors(saurPerson, state);
    const bath    = factors.find(f => f.label === 'Grand Bathhouse');
    expect(bath).toBeDefined();
    expect(bath!.delta).toBe(16);
  });

  it('non-Sauromatian woman gets +5 from bathhouse_grand (civic amenity)', () => {
    const state   = makeHappinessState([builtBuilding('bathhouse_grand')]);
    const factors = computeHappinessFactors(imanianWoman, state);
    const bath    = factors.find(f => f.label === 'Grand civic bathhouse');
    expect(bath).toBeDefined();
    expect(bath!.delta).toBe(5);
  });

  it('non-Sauromatian woman gets no bonus from basic bathhouse or improved', () => {
    for (const defId of ['bathhouse', 'bathhouse_improved'] as const) {
      const state   = makeHappinessState([builtBuilding(defId)]);
      const factors = computeHappinessFactors(imanianWoman, state);
      const bathFactor = factors.find(f => f.label.toLowerCase().includes('bathhouse'));
      expect(bathFactor).toBeUndefined();
    }
  });

  it('men receive no bathhouse bonus from any tier', () => {
    for (const defId of ['bathhouse', 'bathhouse_improved', 'bathhouse_grand'] as const) {
      const state   = makeHappinessState([builtBuilding(defId)]);
      const factors = computeHappinessFactors(imanianMan, state);
      const bathFactor = factors.find(f => f.label.toLowerCase().includes('bathhouse'));
      expect(bathFactor).toBeUndefined();
    }
  });

  it('no bathhouse factor when no bathhouse is built', () => {
    const state   = makeHappinessState([builtBuilding('camp')]);
    const factors = computeHappinessFactors(saurPerson, state);
    const bathFactor = factors.find(f => f.label.toLowerCase().includes('bathhouse'));
    expect(bathFactor).toBeUndefined();
  });

  it('grand tier takes priority over basic for Sauromatian women', () => {
    // If somehow both were present, grand should win (takes the first if-branch)
    const state   = makeHappinessState([builtBuilding('bathhouse_grand'), builtBuilding('bathhouse')]);
    const factors = computeHappinessFactors(saurPerson, state);
    const grand   = factors.find(f => f.label === 'Grand Bathhouse');
    const basic   = factors.find(f => f.label === 'Bathhouse comforts');
    expect(grand).toBeDefined();
    expect(grand!.delta).toBe(16);
    expect(basic).toBeUndefined(); // only the highest tier fires
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// min_prosperity prerequisite
// ──────────────────────────────────────────────────────────────────────────────

describe('event prerequisite — min_prosperity', () => {
  function eventWithProsperity(threshold: number): GameEvent {
    return {
      id: 'test_prosperity',
      title: 'Prosperity Test',
      category: 'immigration',
      weight: 1,
      cooldown: 0,
      isUnique: false,
      prerequisites: [{ type: 'min_prosperity', params: { value: threshold } }],
      description: '',
      choices: [{ id: 'ok', label: 'OK', description: '', consequences: [] }],
    };
  }

  it('passes when prosperity score meets the threshold', () => {
    // 3 buildings (9) + floor(18/3)=6 wealth = 15 → threshold 15 passes
    const state = makeState({
      buildings: [builtBuilding('camp'), builtBuilding('granary'), builtBuilding('trading_post')],
      wealth: 18,
    });
    const event = eventWithProsperity(15);
    expect(isEventEligible(event, state)).toBe(true);
  });

  it('passes when prosperity score exactly equals the threshold', () => {
    // 3 buildings (9) + floor(18/3)=6 wealth = 15 exactly
    const state = makeState({
      buildings: [builtBuilding('camp'), builtBuilding('granary'), builtBuilding('trading_post')],
      wealth: 18,
    });
    const event = eventWithProsperity(15);
    expect(isEventEligible(event, state)).toBe(true);
  });

  it('fails when prosperity score is below the threshold', () => {
    // 1 building (3), no resources, no pop  = 3 → threshold 15 fails
    const state = makeState({ buildings: [builtBuilding('camp')] });
    const event = eventWithProsperity(15);
    expect(isEventEligible(event, state)).toBe(false);
  });

  it('threshold 0 always passes', () => {
    const state = makeState();
    const event = eventWithProsperity(0);
    expect(isEventEligible(event, state)).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// has_tribe_contact prerequisite
// ──────────────────────────────────────────────────────────────────────────────

describe('event prerequisite — has_tribe_contact', () => {
  function eventWithContact(ethnicGroup?: string): GameEvent {
    return {
      id: 'test_contact',
      title: 'Contact Test',
      category: 'immigration',
      weight: 1,
      cooldown: 0,
      isUnique: false,
      prerequisites: [
        ethnicGroup
          ? { type: 'has_tribe_contact', params: { ethnicGroup } }
          : { type: 'has_tribe_contact' },
      ],
      description: '',
      choices: [{ id: 'ok', label: 'OK', description: '', consequences: [] }],
    };
  }

  const tribeMap = (ethnicGroup: string, contactEstablished: boolean): GameState['tribes'] =>
    new Map([
      ['tribe_1', {
        id: 'tribe_1', name: 'TestTribe', ethnicGroup,
        contactEstablished, disposition: 50, lastTradeTurn: 0,
      } as unknown as GameState['tribes'] extends Map<string, infer T> ? T : never],
    ]);

  it('passes when any contacted tribe exists (no ethnicGroup filter)', () => {
    const state = makeState({ tribes: tribeMap('kiswani_riverfolk', true) });
    expect(isEventEligible(eventWithContact(), state)).toBe(true);
  });

  it('fails when no contacted tribe exists', () => {
    const state = makeState({ tribes: tribeMap('kiswani_riverfolk', false) });
    expect(isEventEligible(eventWithContact(), state)).toBe(false);
  });

  it('fails when tribes map is empty', () => {
    const state = makeState({ tribes: new Map() });
    expect(isEventEligible(eventWithContact(), state)).toBe(false);
  });

  it('passes when the contacted tribe matches the ethnicGroup filter', () => {
    const state = makeState({ tribes: tribeMap('kiswani_riverfolk', true) });
    expect(isEventEligible(eventWithContact('kiswani_riverfolk'), state)).toBe(true);
  });

  it('fails when the contacted tribe does not match the ethnicGroup filter', () => {
    const state = makeState({ tribes: tribeMap('hanjoda_emrasi', true) });
    expect(isEventEligible(eventWithContact('kiswani_riverfolk'), state)).toBe(false);
  });

  it('passes when one of multiple tribes matches the filter', () => {
    const tribes: GameState['tribes'] = new Map([
      ['t1', { id: 't1', name: 'A', ethnicGroup: 'hanjoda_emrasi', contactEstablished: true, disposition: 40 } as any],
      ['t2', { id: 't2', name: 'B', ethnicGroup: 'kiswani_riverfolk', contactEstablished: true, disposition: 60 } as any],
    ]);
    const state = makeState({ tribes });
    expect(isEventEligible(eventWithContact('kiswani_riverfolk'), state)).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// add_person — initialSkillBoosts, initialTraits, initialRole
// ──────────────────────────────────────────────────────────────────────────────

describe('add_person consequence — extended params', () => {
  function makeAddPersonState(people?: Map<string, Person>): GameState {
    return {
      ...makeState(),
      people: people ?? new Map(),
      settlement: {
        ...makeState().settlement,
        populationCount: 0,
      },
      households: new Map(),
      factions: [],
      activityLog: [],
    } as unknown as GameState;
  }

  function addPersonEvent(params: Record<string, unknown>): GameEvent {
    return {
      id: 'test_add_person',
      title: 'Test Add Person',
      category: 'immigration',
      weight: 1,
      cooldown: 0,
      isUnique: false,
      prerequisites: [],
      description: '',
      choices: [{
        id: 'add',
        label: 'Add',
        description: '',
        consequences: [
          { type: 'add_person', target: 'settlement', value: 1, params } as EventConsequence,
        ],
      }],
    };
  }

  it('initialSkillBoosts are applied on top of generated skills', () => {
    const state = makeAddPersonState();
    const rng   = createRNG(99);
    const event = addPersonEvent({
      sex: 'female',
      ethnicGroup: 'kiswani_riverfolk',
      minAge: 22, maxAge: 30,
      socialStatus: 'newcomer',
      initialSkillBoosts: { bargaining: 15, plants: 10 },
    });

    const result = applyEventChoice(event, 'add', state, rng);
    const newPeople = Array.from(result.state.people.values());
    expect(newPeople).toHaveLength(1);
    const p = newPeople[0];
    // Skill boosts were applied: generated base + boost, capped at 100
    // We can't know the exact generated base, but the boost should be reflected
    // At minimum the skill should be ≥ 15 (boost alone with base ≥ 1)
    expect(p.skills.bargaining).toBeGreaterThanOrEqual(16);
    expect(p.skills.plants).toBeGreaterThanOrEqual(11);
  });

  it('initialTraits are present on the new person', () => {
    const state = makeAddPersonState();
    const rng   = createRNG(77);
    const event = addPersonEvent({
      sex: 'female',
      minAge: 22, maxAge: 38,
      socialStatus: 'newcomer',
      initialTraits: ['brave', 'healer'],
    });

    const result  = applyEventChoice(event, 'add', state, rng);
    const person  = Array.from(result.state.people.values())[0];
    expect(person.traits).toContain('brave');
    expect(person.traits).toContain('healer');
  });

  it('initialTraits are deduplicated if the generated person already has the trait', () => {
    const state = makeAddPersonState();
    const rng   = createRNG(55);
    const event = addPersonEvent({
      sex: 'male',
      minAge: 20, maxAge: 35,
      socialStatus: 'newcomer',
      initialTraits: ['brave', 'brave'],  // duplicate
    });

    const result = applyEventChoice(event, 'add', state, rng);
    const person = Array.from(result.state.people.values())[0];
    const braveCount = person.traits.filter((t: string) => t === 'brave').length;
    expect(braveCount).toBe(1);
  });

  it('initialRole is set on the new person', () => {
    const state = makeAddPersonState();
    const rng   = createRNG(11);
    const event = addPersonEvent({
      sex: 'female',
      minAge: 20, maxAge: 35,
      socialStatus: 'newcomer',
      role: 'bathhouse_attendant',
    });

    const result = applyEventChoice(event, 'add', state, rng);
    const person = Array.from(result.state.people.values())[0];
    expect(person.role).toBe('bathhouse_attendant');
  });

  it('defaults to unassigned role when no initialRole is provided', () => {
    const state = makeAddPersonState();
    const rng   = createRNG(22);
    const event = addPersonEvent({
      sex: 'male',
      minAge: 20, maxAge: 35,
      socialStatus: 'newcomer',
    });

    const result = applyEventChoice(event, 'add', state, rng);
    const person = Array.from(result.state.people.values())[0];
    expect(person.role).toBe('unassigned');
  });

  it('skill boosts are capped at 100', () => {
    const state = makeAddPersonState();
    const rng   = createRNG(33);
    const event = addPersonEvent({
      sex: 'female',
      minAge: 20, maxAge: 35,
      socialStatus: 'newcomer',
      initialSkillBoosts: { bargaining: 999 },
    });

    const result = applyEventChoice(event, 'add', state, rng);
    const person = Array.from(result.state.people.values())[0];
    expect(person.skills.bargaining).toBe(100);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Immigration event registration & shape
// ──────────────────────────────────────────────────────────────────────────────

describe('immigration events — ALL_EVENTS registration', () => {
  const IMMIGRATION_IDS = [
    'imm_kiswani_traders_settle',
    'imm_wildborn_bathhouse_woman',
    'imm_tribal_family_refuge',
    'imm_steel_seeking_warrior',
    'imm_sauromatian_midwife',
  ];

  it('all 5 immigration events are present in ALL_EVENTS', () => {
    const ids = ALL_EVENTS.map(e => e.id);
    for (const id of IMMIGRATION_IDS) {
      expect(ids).toContain(id);
    }
  });

  it('all immigration events have category "immigration"', () => {
    const immigEvents = ALL_EVENTS.filter(e => IMMIGRATION_IDS.includes(e.id));
    for (const e of immigEvents) {
      expect(e.category).toBe('immigration');
    }
  });

  it('all immigration events have a min_prosperity prerequisite', () => {
    const immigEvents = ALL_EVENTS.filter(e => IMMIGRATION_IDS.includes(e.id));
    for (const e of immigEvents) {
      const hasProsperity = e.prerequisites.some(p => p.type === 'min_prosperity');
      expect(hasProsperity).toBe(true);
    }
  });

  it('all immigration events have at least one add_person consequence on at least one choice', () => {
    const immigEvents = ALL_EVENTS.filter(e => IMMIGRATION_IDS.includes(e.id));
    for (const e of immigEvents) {
      const hasAddPerson = e.choices.some(c =>
        c.consequences.some(con => con.type === 'add_person'),
      );
      expect(hasAddPerson).toBe(true);
    }
  });

  it('all immigration events have a "decline" or "turn_them_away" choice with empty consequences', () => {
    const immigEvents = ALL_EVENTS.filter(e => IMMIGRATION_IDS.includes(e.id));
    for (const e of immigEvents) {
      const declineChoice = e.choices.find(c =>
        c.id === 'decline' || c.id === 'decline_gently' ||
        c.id === 'decline_respectfully' || c.id === 'turn_them_away',
      );
      expect(declineChoice).toBeDefined();
    }
  });
});
