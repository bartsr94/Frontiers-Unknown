/**
 * Tests for event-filter.ts — isEventEligible, filterEligibleEvents, drawEvents.
 *
 * Tests are deliberately written against small inline event fixtures rather than
 * ALL_EVENTS so that changes to event definitions cannot accidentally break the
 * filter logic tests (and vice-versa).  A separate smoke-test section validates
 * that ALL_EVENTS itself is well-formed.
 */

import { describe, it, expect } from 'vitest';
import { createRNG } from '../../src/utils/rng';
import {
  isEventEligible,
  filterEligibleEvents,
  drawEvents,
  ALL_EVENTS,
} from '../../src/simulation/events/event-filter';
import type { GameEvent } from '../../src/simulation/events/engine';
import type { GameState, ResourceType } from '../../src/simulation/turn/game-state';
import type { Person } from '../../src/simulation/population/person';

// ─── Minimal state builder ─────────────────────────────────────────────────────

/**
 * Builds the smallest valid GameState needed by the filter.
 * Only the fields actually read by checkPrerequisite / isEventEligible are populated.
 */
function makeState(overrides: {
  turnNumber?: number;
  currentYear?: number;
  currentSeason?: GameState['currentSeason'];
  populationCount?: number;
  resources?: Partial<Record<ResourceType, number>>;
  people?: Map<string, Person>;
  eventHistory?: GameState['eventHistory'];
  eventCooldowns?: Map<string, number>;
} = {}): GameState {
  const DEFAULT_RESOURCES: Record<ResourceType, number> = {
    food: 0, cattle: 0, goods: 0, steel: 0, lumber: 0,
    stone: 0, medicine: 0, gold: 0, horses: 0,
  };

  return {
    version: '1.0.0',
    seed: 1,
    turnNumber:    overrides.turnNumber    ?? 1,
    currentSeason: overrides.currentSeason ?? 'spring',
    currentYear:   overrides.currentYear   ?? 1,
    people:        overrides.people        ?? new Map(),
    graveyard: [],
    settlement: {
      name: 'Test',
      location: 'loc_1',
      buildings: [],
      resources: { ...DEFAULT_RESOURCES, ...overrides.resources },
      populationCount: overrides.populationCount ?? 0,
    },
    culture: {
      languages: new Map(),
      primaryLanguage: 'imanian',
      religions: new Map(),
      religiousTension: 0,
      culturalBlend: 0,
      practices: [],
      governance: 'patriarchal_imanian',
    },
    tribes: new Map(),
    company: { standing: 0, lastContactTurn: 0, activeQuests: [] },
    eventHistory: overrides.eventHistory ?? [],
    eventCooldowns: overrides.eventCooldowns ?? new Map(),
    pendingEvents: [],
    councilMemberIds: [],
    config: {
      seed: 1,
      settlementName: 'Test',
      startingTribes: [],
      difficulty: 'normal',
    },
  } as unknown as GameState;
  // ↑ cast via `unknown` because CompanyRelation and other deep fields are not
  // all present — the filter only reads the fields explicitly set above.
}

// ─── Minimal event builder ─────────────────────────────────────────────────────

function makeEvent(overrides: Partial<GameEvent> = {}): GameEvent {
  return {
    id:           'test_event',
    title:        'Test Event',
    category:     'domestic',
    prerequisites: [],
    weight:       2,
    cooldown:     0,
    isUnique:     false,
    description:  'A test event.',
    choices: [
      {
        id: 'choice_a',
        label: 'Choice A',
        description: 'Do A.',
        consequences: [],
      },
    ],
    ...overrides,
  };
}

/** Creates a minimal living person for has_person_matching tests. */
function makePerson(overrides: Partial<Person> = {}): Person {
  return {
    id:         'p_test',
    firstName:  'Test',
    familyName: 'Person',
    sex:        'male',
    age:        25,
    religion:   'imanian_orthodox',

    role:  'unassigned',
    socialStatus: 'settler',
    traits: [],
    spouseIds: [],
    parentIds: [null, null],
    childrenIds: [],
    isPlayerControlled: false,
    genetics: {
      visibleTraits: {
        skinTone: 0.2, skinUndertone: 'cool_pink', hairColor: 'light_brown',
        hairTexture: 'straight', eyeColor: 'blue', buildType: 'athletic',
        height: 'average', facialStructure: 'oval',
      },
      genderRatioModifier: 0.5,
      extendedFertility: false,
    },
    fertility: {
      isExtended: false, fertilityStart: 14, fertilityPeak: 25,
      fertilityDeclineStart: 35, fertilityEnd: 45,
    },
    health: { currentHealth: 100, conditions: [] },
    heritage: {
      bloodline: [{ group: 'imanian', fraction: 1.0 }],
      primaryCulture: 'imanian_homeland',
      culturalFluency: new Map([['imanian_homeland', 1.0]]),
    },
    languages: [{ language: 'imanian', fluency: 1.0 }],
    relationships: new Map(),
    nickname: undefined,
    ...overrides,
  } as unknown as Person;
}

// ═══════════════════════════════════════════════════════════════════════════════
// isEventEligible
// ═══════════════════════════════════════════════════════════════════════════════

describe('isEventEligible', () => {

  // ── No prerequisites ──────────────────────────────────────────────────────

  it('returns true when prerequisites are empty', () => {
    const event = makeEvent({ prerequisites: [] });
    expect(isEventEligible(event, makeState())).toBe(true);
  });

  // ── isUnique ──────────────────────────────────────────────────────────────

  it('allows a unique event that has never fired', () => {
    const event = makeEvent({ isUnique: true });
    const state = makeState({ eventHistory: [] });
    expect(isEventEligible(event, state)).toBe(true);
  });

  it('blocks a unique event that has already fired', () => {
    const event = makeEvent({ id: 'uniq_1', isUnique: true });
    const state = makeState({
      eventHistory: [{ eventId: 'uniq_1', turnNumber: 3, choiceId: 'a', involvedPersonIds: [] }],
    });
    expect(isEventEligible(event, state)).toBe(false);
  });

  it('does not block a non-unique event that has already fired', () => {
    const event = makeEvent({ id: 'repeat_1', isUnique: false });
    const state = makeState({
      eventHistory: [{ eventId: 'repeat_1', turnNumber: 3, choiceId: 'a', involvedPersonIds: [] }],
    });
    expect(isEventEligible(event, state)).toBe(true);
  });

  // ── Cooldown ──────────────────────────────────────────────────────────────

  it('allows an event whose cooldown has fully elapsed', () => {
    const event = makeEvent({ id: 'cool_1', cooldown: 5 });
    const state = makeState({
      turnNumber: 10,
      eventCooldowns: new Map([['cool_1', 4]]), // fired turn 4, now turn 10 → 6 turns ago ≥ 5
    });
    expect(isEventEligible(event, state)).toBe(true);
  });

  it('blocks an event still within its cooldown window', () => {
    const event = makeEvent({ id: 'cool_2', cooldown: 5 });
    const state = makeState({
      turnNumber: 7,
      eventCooldowns: new Map([['cool_2', 4]]), // fired turn 4, now turn 7 → 3 turns ago < 5
    });
    expect(isEventEligible(event, state)).toBe(false);
  });

  it('allows an event with cooldown 0 regardless of last-fired turn', () => {
    const event = makeEvent({ id: 'cool_0', cooldown: 0 });
    const state = makeState({
      turnNumber: 2,
      eventCooldowns: new Map([['cool_0', 1]]),
    });
    expect(isEventEligible(event, state)).toBe(true);
  });

  it('allows an event that has no cooldown entry at all', () => {
    const event = makeEvent({ id: 'no_entry', cooldown: 10 });
    const state = makeState({ turnNumber: 1, eventCooldowns: new Map() });
    expect(isEventEligible(event, state)).toBe(true);
  });

  // ── min_population ────────────────────────────────────────────────────────

  it('passes min_population when population meets the threshold', () => {
    const event = makeEvent({
      prerequisites: [{ type: 'min_population', params: { value: 10 } }],
    });
    expect(isEventEligible(event, makeState({ populationCount: 10 }))).toBe(true);
    expect(isEventEligible(event, makeState({ populationCount: 15 }))).toBe(true);
  });

  it('fails min_population when population is below threshold', () => {
    const event = makeEvent({
      prerequisites: [{ type: 'min_population', params: { value: 10 } }],
    });
    expect(isEventEligible(event, makeState({ populationCount: 9 }))).toBe(false);
    expect(isEventEligible(event, makeState({ populationCount: 0 }))).toBe(false);
  });

  // ── max_population ────────────────────────────────────────────────────────

  it('passes max_population when population is at or below threshold', () => {
    const event = makeEvent({
      prerequisites: [{ type: 'max_population', params: { value: 20 } }],
    });
    expect(isEventEligible(event, makeState({ populationCount: 20 }))).toBe(true);
    expect(isEventEligible(event, makeState({ populationCount: 5 }))).toBe(true);
  });

  it('fails max_population when population exceeds threshold', () => {
    const event = makeEvent({
      prerequisites: [{ type: 'max_population', params: { value: 20 } }],
    });
    expect(isEventEligible(event, makeState({ populationCount: 21 }))).toBe(false);
  });

  // ── min_year ──────────────────────────────────────────────────────────────

  it('passes min_year when current year meets the threshold', () => {
    const event = makeEvent({
      prerequisites: [{ type: 'min_year', params: { value: 3 } }],
    });
    expect(isEventEligible(event, makeState({ currentYear: 3 }))).toBe(true);
    expect(isEventEligible(event, makeState({ currentYear: 5 }))).toBe(true);
  });

  it('fails min_year when current year is below threshold', () => {
    const event = makeEvent({
      prerequisites: [{ type: 'min_year', params: { value: 3 } }],
    });
    expect(isEventEligible(event, makeState({ currentYear: 2 }))).toBe(false);
  });

  // ── season_is ─────────────────────────────────────────────────────────────

  it('passes season_is when on the matching season', () => {
    const event = makeEvent({
      prerequisites: [{ type: 'season_is', params: { season: 'winter' } }],
    });
    expect(isEventEligible(event, makeState({ currentSeason: 'winter' }))).toBe(true);
  });

  it('fails season_is when on a different season', () => {
    const event = makeEvent({
      prerequisites: [{ type: 'season_is', params: { season: 'winter' } }],
    });
    expect(isEventEligible(event, makeState({ currentSeason: 'spring' }))).toBe(false);
    expect(isEventEligible(event, makeState({ currentSeason: 'summer' }))).toBe(false);
    expect(isEventEligible(event, makeState({ currentSeason: 'autumn' }))).toBe(false);
  });

  // ── has_resource ──────────────────────────────────────────────────────────

  it('passes has_resource when the stockpile meets the requirement', () => {
    const event = makeEvent({
      prerequisites: [{ type: 'has_resource', params: { resource: 'food', amount: 10 } }],
    });
    expect(isEventEligible(event, makeState({ resources: { food: 10 } }))).toBe(true);
    expect(isEventEligible(event, makeState({ resources: { food: 99 } }))).toBe(true);
  });

  it('fails has_resource when the stockpile is below the requirement', () => {
    const event = makeEvent({
      prerequisites: [{ type: 'has_resource', params: { resource: 'food', amount: 10 } }],
    });
    expect(isEventEligible(event, makeState({ resources: { food: 9 } }))).toBe(false);
    expect(isEventEligible(event, makeState({ resources: { food: 0 } }))).toBe(false);
  });

  // ── has_person_matching ───────────────────────────────────────────────────

  describe('has_person_matching', () => {
    const prereq = { type: 'has_person_matching' as const, params: { sex: 'female', religion: 'sacred_wheel' } };

    it('passes when a matching person is present', () => {
      const woman = makePerson({ id: 'w1', sex: 'female', religion: 'sacred_wheel' });
      const state = makeState({ people: new Map([['w1', woman]]) });
      expect(isEventEligible(makeEvent({ prerequisites: [prereq] }), state)).toBe(true);
    });

    it('fails when no person is present', () => {
      const state = makeState({ people: new Map() });
      expect(isEventEligible(makeEvent({ prerequisites: [prereq] }), state)).toBe(false);
    });

    it('fails when a person has the right sex but wrong religion', () => {
      const person = makePerson({ id: 'p1', sex: 'female', religion: 'imanian_orthodox' });
      const state = makeState({ people: new Map([['p1', person]]) });
      expect(isEventEligible(makeEvent({ prerequisites: [prereq] }), state)).toBe(false);
    });

    it('fails when a person has the right religion but wrong sex', () => {
      const person = makePerson({ id: 'p1', sex: 'male', religion: 'sacred_wheel' });
      const state = makeState({ people: new Map([['p1', person]]) });
      expect(isEventEligible(makeEvent({ prerequisites: [prereq] }), state)).toBe(false);
    });

    it('passes when multiple people are present and only one matches', () => {
      const man   = makePerson({ id: 'p1', sex: 'male',   religion: 'sacred_wheel' });
      const woman = makePerson({ id: 'p2', sex: 'female', religion: 'sacred_wheel' });
      const state = makeState({ people: new Map([['p1', man], ['p2', woman]]) });
      expect(isEventEligible(makeEvent({ prerequisites: [prereq] }), state)).toBe(true);
    });

    it('filters by culturalIdentity when specified', () => {
      const kiswani = makePerson({ id: 'p1', sex: 'female', heritage: { bloodline: [{ group: 'kiswani_riverfolk', fraction: 1.0 }], primaryCulture: 'kiswani_traditional', culturalFluency: new Map([['kiswani_traditional', 1.0]]) } });
      const imanian = makePerson({ id: 'p2', sex: 'female', heritage: { bloodline: [{ group: 'imanian', fraction: 1.0 }], primaryCulture: 'imanian_homeland', culturalFluency: new Map([['imanian_homeland', 1.0]]) } });
      const prereqCulture = {
        type: 'has_person_matching' as const,
        params: { sex: 'female', culturalIdentity: 'kiswani_traditional' },
      };

      const stateKiswani = makeState({ people: new Map([['p1', kiswani]]) });
      const stateImanian = makeState({ people: new Map([['p2', imanian]]) });

      expect(isEventEligible(makeEvent({ prerequisites: [prereqCulture] }), stateKiswani)).toBe(true);
      expect(isEventEligible(makeEvent({ prerequisites: [prereqCulture] }), stateImanian)).toBe(false);
    });

    it('filters by minAge', () => {
      const young = makePerson({ id: 'p1', age: 15 });
      const adult = makePerson({ id: 'p2', age: 20 });
      const prereqAge = { type: 'has_person_matching' as const, params: { minAge: 18 } };

      expect(isEventEligible(makeEvent({ prerequisites: [prereqAge] }), makeState({ people: new Map([['p1', young]]) }))).toBe(false);
      expect(isEventEligible(makeEvent({ prerequisites: [prereqAge] }), makeState({ people: new Map([['p2', adult]]) }))).toBe(true);
    });

    it('filters by maxAge', () => {
      const young  = makePerson({ id: 'p1', age: 15 });
      const senior = makePerson({ id: 'p2', age: 65 });
      const prereqAge = { type: 'has_person_matching' as const, params: { maxAge: 50 } };

      expect(isEventEligible(makeEvent({ prerequisites: [prereqAge] }), makeState({ people: new Map([['p1', young]])  }))).toBe(true);
      expect(isEventEligible(makeEvent({ prerequisites: [prereqAge] }), makeState({ people: new Map([['p2', senior]]) }))).toBe(false);
    });
  });

  // ── Unknown prerequisite type ─────────────────────────────────────────────

  it('treats unknown prerequisite types as satisfied (Phase 3+ stubs)', () => {
    const event = makeEvent({
      // Use a genuinely unimplemented type — cultural_blend_above is now real
      prerequisites: [{ type: 'tribe_disposition_above' as const, params: { tribeId: 'x', value: 50 } }],
    });
    expect(isEventEligible(event, makeState())).toBe(true);
  });

  // ── Multiple prerequisites (AND logic) ────────────────────────────────────

  it('passes only when all prerequisites are satisfied simultaneously', () => {
    const event = makeEvent({
      prerequisites: [
        { type: 'min_year',        params: { value: 2 } },
        { type: 'min_population',  params: { value: 10 } },
        { type: 'season_is',       params: { season: 'summer' } },
      ],
    });

    const goodState  = makeState({ currentYear: 3, populationCount: 12, currentSeason: 'summer' });
    const badYear    = makeState({ currentYear: 1, populationCount: 12, currentSeason: 'summer' });
    const badPop     = makeState({ currentYear: 3, populationCount: 5,  currentSeason: 'summer' });
    const badSeason  = makeState({ currentYear: 3, populationCount: 12, currentSeason: 'winter' });

    expect(isEventEligible(event, goodState)).toBe(true);
    expect(isEventEligible(event, badYear)).toBe(false);
    expect(isEventEligible(event, badPop)).toBe(false);
    expect(isEventEligible(event, badSeason)).toBe(false);
  });

  // ── Combined: unique + cooldown + prerequisites ───────────────────────────

  it('blocks an otherwise-eligible event when it is unique and has already fired', () => {
    const event = makeEvent({
      id: 'combo_1',
      isUnique: true,
      cooldown: 0,
      prerequisites: [{ type: 'min_year', params: { value: 1 } }],
    });
    const state = makeState({
      currentYear: 5,
      eventHistory: [{ eventId: 'combo_1', turnNumber: 1, choiceId: 'a', involvedPersonIds: [] }],
    });
    expect(isEventEligible(event, state)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// filterEligibleEvents
// ═══════════════════════════════════════════════════════════════════════════════

describe('filterEligibleEvents', () => {
  it('returns only events whose prerequisites are met', () => {
    const events: GameEvent[] = [
      makeEvent({ id: 'e_year5',     prerequisites: [{ type: 'min_year', params: { value: 5 } }] }),
      makeEvent({ id: 'e_year1',     prerequisites: [{ type: 'min_year', params: { value: 1 } }] }),
      makeEvent({ id: 'e_no_prereq', prerequisites: [] }),
    ];

    const state = makeState({ currentYear: 3 });
    const result = filterEligibleEvents(events, state);

    expect(result.map(e => e.id)).toEqual(expect.arrayContaining(['e_year1', 'e_no_prereq']));
    expect(result.map(e => e.id)).not.toContain('e_year5');
  });

  it('returns empty array when all events are blocked', () => {
    const events: GameEvent[] = [
      makeEvent({ id: 'e1', prerequisites: [{ type: 'min_year', params: { value: 99 } }] }),
      makeEvent({ id: 'e2', prerequisites: [{ type: 'min_year', params: { value: 99 } }] }),
    ];
    expect(filterEligibleEvents(events, makeState({ currentYear: 1 }))).toHaveLength(0);
  });

  it('returns all events when all satisfy prerequisites', () => {
    const events: GameEvent[] = [
      makeEvent({ id: 'e1', prerequisites: [] }),
      makeEvent({ id: 'e2', prerequisites: [] }),
      makeEvent({ id: 'e3', prerequisites: [] }),
    ];
    expect(filterEligibleEvents(events, makeState())).toHaveLength(3);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// drawEvents
// ═══════════════════════════════════════════════════════════════════════════════

describe('drawEvents', () => {
  const state = makeState();

  it('returns empty array from empty pool', () => {
    const rng = createRNG(1);
    expect(drawEvents([], 3, rng)).toHaveLength(0);
  });

  it('draws at most `count` events', () => {
    const events = [
      makeEvent({ id: 'e1', weight: 1 }),
      makeEvent({ id: 'e2', weight: 1 }),
      makeEvent({ id: 'e3', weight: 1 }),
      makeEvent({ id: 'e4', weight: 1 }),
    ];
    const rng = createRNG(42);
    const drawn = drawEvents(events, 2, rng);
    expect(drawn).toHaveLength(2);
  });

  it('draws at most pool.length events even if count is larger', () => {
    const events = [
      makeEvent({ id: 'e1', weight: 1 }),
      makeEvent({ id: 'e2', weight: 1 }),
    ];
    const rng = createRNG(42);
    expect(drawEvents(events, 10, rng)).toHaveLength(2);
  });

  it('never draws the same event twice in one call', () => {
    const events = Array.from({ length: 6 }, (_, i) =>
      makeEvent({ id: `e${i}`, weight: 2 }),
    );
    const rng = createRNG(7);
    const drawn = drawEvents(events, 6, rng);
    const ids = drawn.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('is deterministic with the same seed', () => {
    const events = Array.from({ length: 5 }, (_, i) =>
      makeEvent({ id: `e${i}`, weight: i + 1 }),
    );
    const drawn1 = drawEvents(events, 3, createRNG(999));
    const drawn2 = drawEvents(events, 3, createRNG(999));
    expect(drawn1.map(e => e.id)).toEqual(drawn2.map(e => e.id));
  });

  it('produces different sequences with different seeds', () => {
    const events = Array.from({ length: 10 }, (_, i) =>
      makeEvent({ id: `e${i}`, weight: 1 }),
    );
    const drawn1 = drawEvents(events, 5, createRNG(1));
    const drawn2 = drawEvents(events, 5, createRNG(2));
    // Extremely unlikely to be identical across 10 events / 5 draws
    expect(drawn1.map(e => e.id)).not.toEqual(drawn2.map(e => e.id));
  });

  it('respects weight — high-weight events are drawn more often in aggregate', () => {
    // One event has weight 100, the other has weight 1.
    // Run 200 single draws and expect the heavy event to dominate.
    const heavy = makeEvent({ id: 'heavy', weight: 100 });
    const light = makeEvent({ id: 'light', weight: 1 });

    let heavyCount = 0;
    for (let seed = 0; seed < 200; seed++) {
      const drawn = drawEvents([heavy, light], 1, createRNG(seed));
      if (drawn[0]?.id === 'heavy') heavyCount++;
    }
    // Expect heavy to win ≥ 180/200 times (theoretical: ~99%)
    expect(heavyCount).toBeGreaterThanOrEqual(180);
  });

  it('weightBoosts multiplies a specific event weight', () => {
    // 'target' starts at weight 1, 'other' at weight 1.
    // With a 100× boost on 'target' it should dominate just like weight 100.
    const target = makeEvent({ id: 'target', weight: 1 });
    const other  = makeEvent({ id: 'other',  weight: 1 });

    let targetCount = 0;
    for (let seed = 0; seed < 200; seed++) {
      const drawn = drawEvents([target, other], 1, createRNG(seed), { target: 100 });
      if (drawn[0]?.id === 'target') targetCount++;
    }
    expect(targetCount).toBeGreaterThanOrEqual(180);
  });

  it('weightBoosts defaults to no-op when omitted', () => {
    // Without boosts the two equal-weight events should split roughly 50/50.
    const a = makeEvent({ id: 'a', weight: 1 });
    const b = makeEvent({ id: 'b', weight: 1 });

    let aCount = 0;
    for (let seed = 0; seed < 200; seed++) {
      const drawn = drawEvents([a, b], 1, createRNG(seed));
      if (drawn[0]?.id === 'a') aCount++;
    }
    // Should be between 70 and 130 out of 200 for a fair split
    expect(aCount).toBeGreaterThanOrEqual(70);
    expect(aCount).toBeLessThanOrEqual(130);
  });

  it('weightBoosts for unknown event id has no effect', () => {
    // Boost for a non-existent id should not crash or alter draw
    const events = [makeEvent({ id: 'e1', weight: 1 }), makeEvent({ id: 'e2', weight: 1 })];
    const rng = createRNG(42);
    expect(() => drawEvents(events, 2, rng, { nonexistent: 50 })).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ALL_EVENTS smoke tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('ALL_EVENTS deck', () => {
  it('contains events', () => {
    expect(ALL_EVENTS.length).toBeGreaterThan(0);
  });

  it('has no duplicate event IDs', () => {
    const ids = ALL_EVENTS.map(e => e.id);
    const unique = new Set(ids);
    const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(duplicates).toEqual([]);
    expect(unique.size).toBe(ids.length);
  });

  it('every event has at least one choice', () => {
    const noChoices = ALL_EVENTS.filter(e => e.choices.length === 0);
    expect(noChoices.map(e => e.id)).toEqual([]);
  });

  it('every event has a valid weight (positive integer)', () => {
    const bad = ALL_EVENTS.filter(e => !Number.isInteger(e.weight) || e.weight <= 0);
    expect(bad.map(e => e.id)).toEqual([]);
  });

  it('every event has a non-negative cooldown', () => {
    const bad = ALL_EVENTS.filter(e => e.cooldown < 0);
    expect(bad.map(e => e.id)).toEqual([]);
  });

  it('every choice has a non-empty consequences array defined (can be empty list)', () => {
    const bad = ALL_EVENTS.flatMap(e =>
      e.choices.filter(c => !Array.isArray(c.consequences)).map(c => `${e.id}/${c.id}`),
    );
    expect(bad).toEqual([]);
  });

  it('cultural events requiring Sauromatian women all have has_person_matching prerequisite', () => {
    // These specific IDs should never fire without women present.
    const mustHaveCheck = [
      'cul_wheel_ceremony_request',
      'cul_sacred_wheel_icon_found',
      'cul_imanian_feast_tension',
      'cul_religious_tension_peaks',
      'cul_craft_knowledge_shared',
      'cul_language_lesson',
      'cul_joint_harvest',
      'cul_traditional_man_objects',
      'cul_women_organise',
      'cul_governance_debate',
      'cul_first_born_in_settlement',
      'cul_daughters_majority',
      'cul_naming_dispute',
      'cul_company_informant_letter',
      'cul_elder_settles_dispute',
    ];

    for (const id of mustHaveCheck) {
      const event = ALL_EVENTS.find(e => e.id === id);
      expect(event, `event ${id} missing from ALL_EVENTS`).toBeDefined();
      const hasCheck = event!.prerequisites.some(p => p.type === 'has_person_matching');
      expect(hasCheck, `${id} is missing has_person_matching prerequisite`).toBe(true);
    }
  });

  it('cul_sauromatian_envoy does NOT require women to be present (first-contact event)', () => {
    const event = ALL_EVENTS.find(e => e.id === 'cul_sauromatian_envoy');
    expect(event).toBeDefined();
    const hasCheck = event!.prerequisites.some(p => p.type === 'has_person_matching');
    expect(hasCheck).toBe(false);
  });

  it('cul_tongue_war uses language_tension_above prerequisite', () => {
    const event = ALL_EVENTS.find(e => e.id === 'cul_tongue_war');
    expect(event, 'cul_tongue_war missing from ALL_EVENTS').toBeDefined();
    const hasTensionPrereq = event!.prerequisites.some(
      p => p.type === 'language_tension_above',
    );
    expect(hasTensionPrereq).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// language_tension_above prerequisite
// ═══════════════════════════════════════════════════════════════════════════════

describe('language_tension_above prerequisite', () => {
  function makeStateWithTension(languageTension: number): GameState {
    const base = makeState();
    return {
      ...base,
      culture: { ...base.culture, languageTension },
    } as unknown as GameState;
  }

  it('allows the event when languageTension meets the threshold exactly', () => {
    const event = makeEvent({
      prerequisites: [{ type: 'language_tension_above', params: { threshold: 0.4 } }],
    });
    expect(isEventEligible(event, makeStateWithTension(0.4))).toBe(true);
  });

  it('allows the event when languageTension exceeds the threshold', () => {
    const event = makeEvent({
      prerequisites: [{ type: 'language_tension_above', params: { threshold: 0.4 } }],
    });
    expect(isEventEligible(event, makeStateWithTension(0.75))).toBe(true);
  });

  it('blocks the event when languageTension is below the threshold', () => {
    const event = makeEvent({
      prerequisites: [{ type: 'language_tension_above', params: { threshold: 0.4 } }],
    });
    expect(isEventEligible(event, makeStateWithTension(0.2))).toBe(false);
  });

  it('blocks the event when languageTension is zero', () => {
    const event = makeEvent({
      prerequisites: [{ type: 'language_tension_above', params: { threshold: 0.4 } }],
    });
    expect(isEventEligible(event, makeStateWithTension(0))).toBe(false);
  });

  it('cul_tongue_war is eligible only when tension is high enough', () => {
    const event = ALL_EVENTS.find(e => e.id === 'cul_tongue_war')!;
    // Event also requires actorRequirements: an imanian_orthodox male + sacred_wheel female
    const imanianMan  = makePerson({ id: 'p_ima',  sex: 'male',   religion: 'imanian_orthodox' });
    const saurWoman   = makePerson({ id: 'p_saur', sex: 'female', religion: 'sacred_wheel' });
    const people = new Map([['p_ima', imanianMan], ['p_saur', saurWoman]]);

    const highTension = makeStateWithTension(0.6);
    const lowTension  = makeStateWithTension(0.1);
    const withPop = (s: GameState) => ({
      ...s,
      people,
      settlement: { ...s.settlement, populationCount: 10 },
    } as unknown as GameState);

    expect(isEventEligible(event, withPop(highTension))).toBe(true);
    expect(isEventEligible(event, withPop(lowTension))).toBe(false);
  });
});
