/**
 * Unit tests for actor-resolver.ts
 *
 * Covers: matchesCriteria, canFillSlot, canResolveActors, selectActor, resolveActors.
 * All randomness uses a seeded RNG so results are fully deterministic.
 */

import { describe, it, expect } from 'vitest';
import {
  matchesCriteria,
  canFillSlot,
  canResolveActors,
  selectActor,
  resolveActors,
} from '../../src/simulation/events/actor-resolver';
import { createPerson } from '../../src/simulation/population/person';
import { createRNG } from '../../src/utils/rng';
import type { GameState, Season } from '../../src/simulation/turn/game-state';
import type { Person } from '../../src/simulation/population/person';
import type { ActorRequirement } from '../../src/simulation/events/engine';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePerson(overrides: Partial<Parameters<typeof createPerson>[0]> = {}): Person {
  return createPerson({
    sex: 'male',
    age: 30,
    ...overrides,
  });
}

function makeState(people: Map<string, Person>): GameState {
  return {
    version: '1.0.0',
    seed: 42,
    turnNumber: 0,
    currentSeason: 'spring' as Season,
    currentYear: 1,
    people,
    graveyard: [],
    settlement: {
      name: 'Test',
      location: 'marsh',
      buildings: [],
      resources: {
        food: 100, cattle: 0, goods: 0, steel: 0,
        lumber: 0, stone: 0, medicine: 0, gold: 0, horses: 0,
      },
      populationCount: people.size,
    },
    culture: {
      languages:        new Map([['imanian', 1.0]]),
      primaryLanguage:  'imanian',
      religions:        new Map([['imanian_orthodox', 1.0]]),
      religiousTension: 0,
      culturalBlend:    0,
      practices:        [],
      governance:       'patriarchal_imanian',
    },
    tribes:          new Map(),
    company: {
      standing: 60,
      annualQuotaGold: 0,
      annualQuotaTradeGoods: 0,
      consecutiveFailures: 0,
      supportLevel: 'standard',
      yearsActive: 0,
    },
    eventHistory:     [],
    eventCooldowns:   new Map(),
    pendingEvents:    [],
    councilMemberIds: [],
    config: {
      difficulty: 'normal',
      startingLocation: 'marsh',
      includeSauromatianWomen: false,
      startingTribes: [],
    },
  } as unknown as GameState;
}

// ─── matchesCriteria ──────────────────────────────────────────────────────────

describe('matchesCriteria', () => {
  it('empty criteria matches any person', () => {
    const p = makePerson();
    expect(matchesCriteria(p, {})).toBe(true);
  });

  it('sex: male passes male filter', () => {
    const p = makePerson({ sex: 'male' });
    expect(matchesCriteria(p, { sex: 'male' })).toBe(true);
    expect(matchesCriteria(p, { sex: 'female' })).toBe(false);
  });

  it('sex: female passes female filter', () => {
    const p = makePerson({ sex: 'female' });
    expect(matchesCriteria(p, { sex: 'female' })).toBe(true);
    expect(matchesCriteria(p, { sex: 'male' })).toBe(false);
  });

  it('religion filter', () => {
    const p = makePerson({ religion: 'sacred_wheel' });
    expect(matchesCriteria(p, { religion: 'sacred_wheel' })).toBe(true);
    expect(matchesCriteria(p, { religion: 'imanian_orthodox' })).toBe(false);
  });

  it('minAge: boundary conditions', () => {
    const p = makePerson({ age: 25 });
    expect(matchesCriteria(p, { minAge: 24 })).toBe(true);
    expect(matchesCriteria(p, { minAge: 25 })).toBe(true);
    expect(matchesCriteria(p, { minAge: 26 })).toBe(false);
  });

  it('maxAge: boundary conditions', () => {
    const p = makePerson({ age: 25 });
    expect(matchesCriteria(p, { maxAge: 26 })).toBe(true);
    expect(matchesCriteria(p, { maxAge: 25 })).toBe(true);
    expect(matchesCriteria(p, { maxAge: 24 })).toBe(false);
  });

  it('maritalStatus: unmarried person', () => {
    const p = makePerson(); // spouseIds: [] by default
    expect(matchesCriteria(p, { maritalStatus: 'unmarried' })).toBe(true);
    expect(matchesCriteria(p, { maritalStatus: 'married' })).toBe(false);
  });

  it('maritalStatus: married person (spouseIds non-empty)', () => {
    const p = makePerson({ spouseIds: ['spouse-001'] });
    expect(matchesCriteria(p, { maritalStatus: 'married' })).toBe(true);
    expect(matchesCriteria(p, { maritalStatus: 'unmarried' })).toBe(false);
  });

  it('minSkill on base skill', () => {
    const p = makePerson({
      skills: { animals: 25, bargaining: 50, combat: 25, custom: 25, leadership: 25, plants: 25 },
    });
    expect(matchesCriteria(p, { minSkill: { skill: 'bargaining', value: 50 } })).toBe(true);
    expect(matchesCriteria(p, { minSkill: { skill: 'bargaining', value: 51 } })).toBe(false);
  });

  it('minSkill on derived skill (diplomacy = (leadership + bargaining + custom) / 3)', () => {
    // leadership=60, bargaining=60, custom=60 → diplomacy = 60
    const p = makePerson({
      skills: { animals: 25, bargaining: 60, combat: 25, custom: 60, leadership: 60, plants: 25 },
    });
    expect(matchesCriteria(p, { minSkill: { skill: 'diplomacy', value: 55 } })).toBe(true);
    expect(matchesCriteria(p, { minSkill: { skill: 'diplomacy', value: 65 } })).toBe(false);
  });

  it('all criteria must pass together', () => {
    const p = makePerson({ sex: 'female', age: 35, religion: 'sacred_wheel' });
    expect(matchesCriteria(p, { sex: 'female', minAge: 30, religion: 'sacred_wheel' })).toBe(true);
    // age fails
    expect(matchesCriteria(p, { sex: 'female', minAge: 40, religion: 'sacred_wheel' })).toBe(false);
    // sex fails
    expect(matchesCriteria(p, { sex: 'male',   minAge: 30, religion: 'sacred_wheel' })).toBe(false);
    // religion fails
    expect(matchesCriteria(p, { sex: 'female', minAge: 30, religion: 'imanian_orthodox' })).toBe(false);
  });
});

// ─── canFillSlot ──────────────────────────────────────────────────────────────

describe('canFillSlot', () => {
  it('returns true when a matching person exists', () => {
    const w = makePerson({ sex: 'female' });
    const state = makeState(new Map([[w.id, w]]));
    expect(canFillSlot({ sex: 'female' }, state)).toBe(true);
  });

  it('returns false when no matching person exists', () => {
    const m = makePerson({ sex: 'male' });
    const state = makeState(new Map([[m.id, m]]));
    expect(canFillSlot({ sex: 'female' }, state)).toBe(false);
  });

  it('respects excludeIds: excluded person does not count', () => {
    const w = makePerson({ sex: 'female' });
    const state = makeState(new Map([[w.id, w]]));
    expect(canFillSlot({ sex: 'female' }, state, [w.id])).toBe(false);
  });

  it('returns true when at least one non-excluded person matches', () => {
    const w1 = makePerson({ sex: 'female' });
    const w2 = makePerson({ sex: 'female' });
    const state = makeState(new Map([[w1.id, w1], [w2.id, w2]]));
    // Exclude first woman — second must still satisfy the slot
    expect(canFillSlot({ sex: 'female' }, state, [w1.id])).toBe(true);
  });
});

// ─── canResolveActors ─────────────────────────────────────────────────────────

describe('canResolveActors', () => {
  it('returns true when all required slots can be filled', () => {
    const m = makePerson({ sex: 'male' });
    const w = makePerson({ sex: 'female' });
    const state = makeState(new Map([[m.id, m], [w.id, w]]));
    const reqs: ActorRequirement[] = [
      { slot: 'groom', criteria: { sex: 'male' } },
      { slot: 'bride', criteria: { sex: 'female' } },
    ];
    expect(canResolveActors(reqs, state)).toBe(true);
  });

  it('returns false when a required slot cannot be filled', () => {
    const m = makePerson({ sex: 'male' });
    const state = makeState(new Map([[m.id, m]]));
    const reqs: ActorRequirement[] = [
      { slot: 'groom', criteria: { sex: 'male' } },
      { slot: 'bride', criteria: { sex: 'female' } },
    ];
    expect(canResolveActors(reqs, state)).toBe(false);
  });

  it('enforces mutual exclusion: one person cannot fill two slots', () => {
    // Only one male — cannot fill two male slots
    const m = makePerson({ sex: 'male' });
    const state = makeState(new Map([[m.id, m]]));
    const reqs: ActorRequirement[] = [
      { slot: 'scout',  criteria: { sex: 'male' } },
      { slot: 'guard',  criteria: { sex: 'male' } },
    ];
    expect(canResolveActors(reqs, state)).toBe(false);
  });

  it('mutual exclusion passes with two qualifying people', () => {
    const m1 = makePerson({ sex: 'male' });
    const m2 = makePerson({ sex: 'male' });
    const state = makeState(new Map([[m1.id, m1], [m2.id, m2]]));
    const reqs: ActorRequirement[] = [
      { slot: 'scout',  criteria: { sex: 'male' } },
      { slot: 'guard',  criteria: { sex: 'male' } },
    ];
    expect(canResolveActors(reqs, state)).toBe(true);
  });

  it('optional unfillable slot does not block resolution', () => {
    const m = makePerson({ sex: 'male' });
    const state = makeState(new Map([[m.id, m]]));
    const reqs: ActorRequirement[] = [
      { slot: 'lead',    criteria: { sex: 'male' } },
      { slot: 'witness', criteria: { sex: 'female' }, required: false },
    ];
    expect(canResolveActors(reqs, state)).toBe(true);
  });

  it('empty requirements always resolves', () => {
    const state = makeState(new Map());
    expect(canResolveActors([], state)).toBe(true);
  });
});

// ─── selectActor ──────────────────────────────────────────────────────────────

describe('selectActor', () => {
  it('returns a person matching the criteria', () => {
    const w = makePerson({ sex: 'female' });
    const state = makeState(new Map([[w.id, w]]));
    const result = selectActor({ sex: 'female' }, state, createRNG(1));
    expect(result).not.toBeNull();
    expect(result!.sex).toBe('female');
  });

  it('returns null when no person matches', () => {
    const m = makePerson({ sex: 'male' });
    const state = makeState(new Map([[m.id, m]]));
    expect(selectActor({ sex: 'female' }, state, createRNG(1))).toBeNull();
  });

  it('respects excludeIds', () => {
    const w = makePerson({ sex: 'female' });
    const state = makeState(new Map([[w.id, w]]));
    expect(selectActor({ sex: 'female' }, state, createRNG(1), [w.id])).toBeNull();
  });

  it('returns null for empty population', () => {
    const state = makeState(new Map());
    expect(selectActor({}, state, createRNG(1))).toBeNull();
  });

  it('is deterministic for a given seed', () => {
    const p1 = makePerson({ sex: 'male' });
    const p2 = makePerson({ sex: 'male' });
    const p3 = makePerson({ sex: 'male' });
    const state = makeState(new Map([[p1.id, p1], [p2.id, p2], [p3.id, p3]]));
    const a = selectActor({}, state, createRNG(42));
    const b = selectActor({}, state, createRNG(42));
    expect(a!.id).toBe(b!.id);
  });

  it('different seeds can produce different selections', () => {
    // Large enough pool that different seeds should pick different people
    const pool = Array.from({ length: 10 }, () => makePerson());
    const state = makeState(new Map(pool.map(p => [p.id, p])));
    const ids = new Set(
      Array.from({ length: 10 }, (_, i) => selectActor({}, state, createRNG(i))!.id),
    );
    // With 10 people and 10 different seeds, at least 2 distinct picks are expected
    expect(ids.size).toBeGreaterThan(1);
  });
});

// ─── resolveActors ────────────────────────────────────────────────────────────

describe('resolveActors', () => {
  it('returns a slot map for a single-slot requirement', () => {
    const w = makePerson({ sex: 'female' });
    const state = makeState(new Map([[w.id, w]]));
    const result = resolveActors([{ slot: 'bride', criteria: { sex: 'female' } }], state, createRNG(1));
    expect(result).not.toBeNull();
    expect(result!['bride']).toBe(w.id);
  });

  it('returns null when a required slot cannot be filled', () => {
    const m = makePerson({ sex: 'male' });
    const state = makeState(new Map([[m.id, m]]));
    const result = resolveActors([{ slot: 'bride', criteria: { sex: 'female' } }], state, createRNG(1));
    expect(result).toBeNull();
  });

  it('no two slots receive the same person', () => {
    const m1 = makePerson({ sex: 'male' });
    const m2 = makePerson({ sex: 'male' });
    const state = makeState(new Map([[m1.id, m1], [m2.id, m2]]));
    const result = resolveActors(
      [
        { slot: 'lead',   criteria: { sex: 'male' } },
        { slot: 'second', criteria: { sex: 'male' } },
      ],
      state,
      createRNG(1),
    );
    expect(result).not.toBeNull();
    expect(result!['lead']).not.toBe(result!['second']);
  });

  it('optional unfillable slot is omitted from result, not a null return', () => {
    const m = makePerson({ sex: 'male' });
    const state = makeState(new Map([[m.id, m]]));
    const result = resolveActors(
      [
        { slot: 'lead',    criteria: { sex: 'male' } },
        { slot: 'witness', criteria: { sex: 'female' }, required: false },
      ],
      state,
      createRNG(1),
    );
    expect(result).not.toBeNull();
    expect(result!['lead']).toBe(m.id);
    expect('witness' in result!).toBe(false);
  });

  it('empty requirements returns empty map', () => {
    const state = makeState(new Map());
    const result = resolveActors([], state, createRNG(1));
    expect(result).not.toBeNull();
    expect(Object.keys(result!)).toHaveLength(0);
  });

  it('is deterministic for the same seed', () => {
    const m1 = makePerson({ sex: 'male' });
    const m2 = makePerson({ sex: 'male' });
    const state = makeState(new Map([[m1.id, m1], [m2.id, m2]]));
    const reqs: ActorRequirement[] = [{ slot: 'scout', criteria: { sex: 'male' } }];
    const r1 = resolveActors(reqs, state, createRNG(99));
    const r2 = resolveActors(reqs, state, createRNG(99));
    expect(r1!['scout']).toBe(r2!['scout']);
  });
});

// ─── Away status ──────────────────────────────────────────────────────────────

describe('matchesCriteria — away role', () => {
  it('returns false for a person whose role is away, regardless of other criteria', () => {
    const p = makePerson({ role: 'away' });
    // Empty criteria should normally match anything — but 'away' is always excluded.
    expect(matchesCriteria(p, {})).toBe(false);
  });

  it('returns false for an away person even when explicit role matches', () => {
    // Requesting role: 'away' directly should still return false (they are off-site).
    const p = makePerson({ role: 'away' });
    expect(matchesCriteria(p, { role: 'away' })).toBe(false);
  });

  it('returns true for an unassigned person (role: unassigned)', () => {
    const p = makePerson({ role: 'unassigned' });
    expect(matchesCriteria(p, {})).toBe(true);
  });

  it('canFillSlot returns false when the only matching person is away', () => {
    const p = makePerson({ sex: 'male', role: 'away' });
    const state = makeState(new Map([[p.id, p]]));
    expect(canFillSlot({ sex: 'male' }, state)).toBe(false);
  });

  it('canResolveActors returns false when the only qualifying actor is away', () => {
    const p = makePerson({ sex: 'male', role: 'away' });
    const state = makeState(new Map([[p.id, p]]));
    const reqs: ActorRequirement[] = [{ slot: 'scout', criteria: { sex: 'male' } }];
    expect(canResolveActors(reqs, state)).toBe(false);
  });
});
