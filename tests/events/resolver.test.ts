/**
 * Tests for event resolver — applyEventChoice().
 *
 * Covers:
 *   - modify_resource: adds delta, floors resources at 0
 *   - modify_standing: adds delta, clamps standing to [0, 100]
 *   - Unknown choiceId: returns state unchanged
 *   - Cooldown map is updated after resolution
 *   - Event history is appended after resolution
 *   - Multiple consequences are applied in sequence
 */

import { describe, it, expect } from 'vitest';
import { applyEventChoice, resolveSkillCheck } from '../../src/simulation/events/resolver';
import type { GameEvent, BoundEvent, EventConsequence, SkillCheck } from '../../src/simulation/events/engine';
import type { Person } from '../../src/simulation/population/person';
import type { GameState } from '../../src/simulation/turn/game-state';
import { createRNG } from '../../src/utils/rng';

// ─── Minimal state builder ────────────────────────────────────────────────────

function makeState(overrides: {
  food?:       number;
  gold?:       number;
  standing?:   number;
  turnNumber?: number;
} = {}): GameState {
  return {
    version:       '1.0.0',
    seed:          1,
    turnNumber:    overrides.turnNumber ?? 5,
    currentSeason: 'spring',
    currentYear:   1,
    people:        new Map(),
    graveyard:     [],
    settlement: {
      name:            'Test',
      location:        'marsh',
      buildings:       [],
      resources: {
        food:     overrides.food     ?? 50,
        cattle:   0,
        goods:    0,
        steel:    0,
        lumber:   0,
        stone:    0,
        medicine: 0,
        gold:     overrides.gold ?? 20,
        horses:   0,
      },
      populationCount: 0,
    },
    culture: {
      languages:             new Map(),
      primaryLanguage:       'imanian',
      languageDiversityTurns: 0,
      languageTension:        0,
      religions:             new Map(),
      religiousTension:      0,
      culturalBlend:         0,
      practices:             [],
      governance:            'patriarchal_imanian',
    },
    tribes:  new Map(),
    company: {
      standing:               overrides.standing ?? 50,
      annualQuotaGold:        0,
      annualQuotaGoods:  0,
      consecutiveFailures:    0,
      supportLevel:           'standard',
      yearsActive:            0,
    },
    eventHistory:     [],
    eventCooldowns:   new Map(),
    pendingEvents:    [],
    councilMemberIds: [],
    deferredEvents:   [],
    config: {
      seed:            1,
      difficulty:      'normal',
      settlementName:  'Test',
      startingTribes:  [],
    },
  } as unknown as GameState;
}

// ─── Minimal event builder ────────────────────────────────────────────────────

function makeEvent(consequences: EventConsequence[] = []): GameEvent {
  return {
    id:            'test_event',
    title:         'Test Event',
    category:      'domestic',
    prerequisites: [],
    weight:        1,
    cooldown:      0,
    isUnique:      false,
    description:   'A test.',
    choices: [
      {
        id:           'choice_a',
        label:        'A',
        description:  'Do A.',
        consequences,
      },
    ],
  };
}

// ─── modify_resource ─────────────────────────────────────────────────────────

describe('applyEventChoice — modify_resource', () => {
  it('adds a positive delta to the target resource', () => {
    const state  = makeState({ food: 30 });
    const event  = makeEvent([{ type: 'modify_resource', target: 'food', value: 20 }]);
    const result = applyEventChoice(event, 'choice_a', state);
    expect(result.state.settlement.resources.food).toBe(50);
  });

  it('subtracts a negative delta from the target resource', () => {
    const state  = makeState({ food: 30 });
    const event  = makeEvent([{ type: 'modify_resource', target: 'food', value: -10 }]);
    const result = applyEventChoice(event, 'choice_a', state);
    expect(result.state.settlement.resources.food).toBe(20);
  });

  it('floors resources at 0 — never goes negative', () => {
    const state  = makeState({ food: 5 });
    const event  = makeEvent([{ type: 'modify_resource', target: 'food', value: -100 }]);
    const result = applyEventChoice(event, 'choice_a', state);
    expect(result.state.settlement.resources.food).toBe(0);
  });

  it('applies delta to the correct resource and leaves others untouched', () => {
    const state  = makeState({ gold: 10, food: 50 });
    const event  = makeEvent([{ type: 'modify_resource', target: 'gold', value: 5 }]);
    const result = applyEventChoice(event, 'choice_a', state);
    expect(result.state.settlement.resources.gold).toBe(15);
    expect(result.state.settlement.resources.food).toBe(50); // unchanged
  });
});

// ─── modify_standing ─────────────────────────────────────────────────────────

describe('applyEventChoice — modify_standing', () => {
  it('increases company standing by the given delta', () => {
    const state  = makeState({ standing: 40 });
    const event  = makeEvent([{ type: 'modify_standing', target: 'company', value: 15 }]);
    const result = applyEventChoice(event, 'choice_a', state);
    expect(result.state.company.standing).toBe(55);
  });

  it('decreases company standing by the given delta', () => {
    const state  = makeState({ standing: 40 });
    const event  = makeEvent([{ type: 'modify_standing', target: 'company', value: -20 }]);
    const result = applyEventChoice(event, 'choice_a', state);
    expect(result.state.company.standing).toBe(20);
  });

  it('clamps standing at a maximum of 100', () => {
    const state  = makeState({ standing: 95 });
    const event  = makeEvent([{ type: 'modify_standing', target: 'company', value: 20 }]);
    const result = applyEventChoice(event, 'choice_a', state);
    expect(result.state.company.standing).toBe(100);
  });

  it('clamps standing at a minimum of 0', () => {
    const state  = makeState({ standing: 5 });
    const event  = makeEvent([{ type: 'modify_standing', target: 'company', value: -50 }]);
    const result = applyEventChoice(event, 'choice_a', state);
    expect(result.state.company.standing).toBe(0);
  });

  it('ignores modify_standing when target is not "company"', () => {
    const state  = makeState({ standing: 50 });
    const event  = makeEvent([{ type: 'modify_standing', target: 'some_tribe', value: 30 }]);
    const result = applyEventChoice(event, 'choice_a', state);
    expect(result.state.company.standing).toBe(50); // unchanged
  });
});

// ─── Unknown choice ID ────────────────────────────────────────────────────────

describe('applyEventChoice — unknown choiceId', () => {
  it('returns state unchanged when choiceId is not found on the event', () => {
    const state  = makeState({ food: 50 });
    const event  = makeEvent([{ type: 'modify_resource', target: 'food', value: 99 }]);
    const result = applyEventChoice(event, 'nonexistent_choice', state);
    expect(result.state.settlement.resources.food).toBe(50);
    expect(result.state).toBe(state); // exact same reference — no copy
  });
});

// ─── Bookkeeping ──────────────────────────────────────────────────────────────

describe('applyEventChoice — bookkeeping', () => {
  it('records the event id in the cooldown map with the current turn number', () => {
    const state  = makeState({ turnNumber: 7 });
    const event  = makeEvent();
    const result = applyEventChoice(event, 'choice_a', state);
    expect(result.state.eventCooldowns.get('test_event')).toBe(7);
  });

  it('appends the event to eventHistory with the correct fields', () => {
    const state  = makeState({ turnNumber: 3 });
    const event  = makeEvent();
    const result = applyEventChoice(event, 'choice_a', state);
    expect(result.state.eventHistory).toHaveLength(1);
    expect(result.state.eventHistory[0]).toMatchObject({
      eventId:  'test_event',
      choiceId: 'choice_a',
      turnNumber: 3,
    });
  });

  it('does not mutate the original state', () => {
    const state  = makeState({ food: 50 });
    const event  = makeEvent([{ type: 'modify_resource', target: 'food', value: -10 }]);
    applyEventChoice(event, 'choice_a', state);
    expect(state.settlement.resources.food).toBe(50);
    expect(state.eventHistory).toHaveLength(0);
  });
});

// ─── Multiple consequences ────────────────────────────────────────────────────

describe('applyEventChoice — multiple consequences', () => {
  it('applies all consequences in order', () => {
    const state  = makeState({ food: 50, standing: 60 });
    const event  = makeEvent([
      { type: 'modify_resource', target: 'food',    value: -20 },
      { type: 'modify_standing', target: 'company', value:  10 },
    ]);
    const result = applyEventChoice(event, 'choice_a', state);
    expect(result.state.settlement.resources.food).toBe(30);
    expect(result.state.company.standing).toBe(70);
  });
});

// ─── Skill checks ─────────────────────────────────────────────────────────────

function makePerson(id: string, skills: Partial<Record<string, number>> = {}): Person {
  return {
    id,
    firstName: 'Test',
    familyName: 'Person',
    age: 30,
    sex: 'male',
    skills: {
      animals:    skills['animals']    ?? 25,
      bargaining: skills['bargaining'] ?? 25,
      combat:     skills['combat']     ?? 25,
      custom:     skills['custom']     ?? 25,
      leadership: skills['leadership'] ?? 25,
      plants:     skills['plants']     ?? 25,
    },
  } as unknown as Person;
}

describe('resolveSkillCheck', () => {
  it('picks the best council member for best_council', () => {
    const weak   = makePerson('p1', { leadership: 20 });
    const strong = makePerson('p2', { leadership: 60 });
    const state  = {
      ...makeState(),
      people: new Map([['p1', weak], ['p2', strong]]),
      councilMemberIds: ['p1', 'p2'],
    } as unknown as GameState;
    const check: SkillCheck = { skill: 'leadership', difficulty: 50, actorSelection: 'best_council' };
    const res = resolveSkillCheck(check, state);
    expect(res.actorId).toBe('p2');
    expect(res.actorScore).toBe(60);
    expect(res.passed).toBe(true);
  });

  it('auto-fails with score 0 when council is empty', () => {
    const state = makeState();
    const check: SkillCheck = { skill: 'combat', difficulty: 30, actorSelection: 'best_council' };
    const res = resolveSkillCheck(check, state);
    expect(res.passed).toBe(false);
    expect(res.actorScore).toBe(0);
    expect(res.actorName).toBe('No one');
  });

  it('fails when best actor score is below difficulty', () => {
    const p = makePerson('p1', { combat: 20 });
    const state = {
      ...makeState(),
      people: new Map([['p1', p]]),
      councilMemberIds: ['p1'],
    } as unknown as GameState;
    const check: SkillCheck = { skill: 'combat', difficulty: 30, actorSelection: 'best_council' };
    const res = resolveSkillCheck(check, state);
    expect(res.passed).toBe(false);
  });

  it('actor_slot — picks person by ID from boundActors', () => {
    const p1 = makePerson('p1', { bargaining: 55 });
    const p2 = makePerson('p2', { bargaining: 70 });
    const state = {
      ...makeState(),
      people: new Map([['p1', p1], ['p2', p2]]),
      councilMemberIds: [],
    } as unknown as GameState;
    const check: SkillCheck = {
      skill: 'bargaining',
      difficulty: 50,
      actorSelection: 'actor_slot',
      actorSlot: 'merchant',
    };
    // Explicitly bind p1 to the 'merchant' slot — even though p2 has a higher score
    const res = resolveSkillCheck(check, state, {}, { merchant: 'p1' });
    expect(res.actorId).toBe('p1');
    expect(res.actorScore).toBe(55);
    expect(res.passed).toBe(true);
  });

  it('best_settlement — picks highest scorer among all living settlers', () => {
    const low  = makePerson('p1', { plants: 20 });
    const high = makePerson('p2', { plants: 65 });
    const state = {
      ...makeState(),
      people: new Map([['p1', low], ['p2', high]]),
      councilMemberIds: [], // neither is on the council
    } as unknown as GameState;
    const check: SkillCheck = { skill: 'plants', difficulty: 50, actorSelection: 'best_settlement' };
    const res = resolveSkillCheck(check, state);
    expect(res.actorId).toBe('p2');
    expect(res.actorScore).toBe(65);
    expect(res.passed).toBe(true);
  });
});

describe('applyEventChoice — boundActors persisted to DeferredEventEntry', () => {
  it('carries boundActors into the scheduled DeferredEventEntry', () => {
    const state = makeState();
    const event = {
      id: 'deferred_bound',
      title: 'Bound Deferred',
      category: 'domestic' as const,
      prerequisites: [],
      weight: 1,
      cooldown: 0,
      isUnique: false,
      description: 'A bound deferred event.',
      boundActors: { scout: 'p99' },
      choices: [{
        id: 'go',
        label: 'Go',
        description: 'Head out.',
        consequences: [],
        deferredEventId: 'follow_up_event',
        deferredTurns: 3,
      }],
    };
    const result = applyEventChoice(event as unknown as GameEvent, 'go', state);
    expect(result.isDeferredOutcome).toBe(true);
    expect(result.state.deferredEvents[0]?.boundActors).toEqual({ scout: 'p99' });
  });
});

describe('applyEventChoice — skill checks', () => {
  function makeSkillCheckEvent(check: SkillCheck): GameEvent {
    return {
      id: 'skill_event',
      title: 'Skill Event',
      category: 'domestic',
      prerequisites: [],
      weight: 1,
      cooldown: 0,
      isUnique: false,
      description: 'An event with a skill check.',
      choices: [{
        id: 'attempt',
        label: 'Attempt',
        description: 'Try it.',
        consequences: [{ type: 'modify_resource', target: 'food', value: -2 }],
        skillCheck: check,
        onSuccess: [{ type: 'modify_resource', target: 'food', value: 20 }],
        onFailure: [{ type: 'modify_resource', target: 'food', value: -5 }],
      }],
    };
  }

  it('applies base consequences regardless of skill check outcome', () => {
    const p = makePerson('p1', { animals: 10 }); // will fail difficulty 50
    const state = {
      ...makeState({ food: 50 }),
      people: new Map([['p1', p]]),
      councilMemberIds: ['p1'],
    } as unknown as GameState;
    const check: SkillCheck = { skill: 'animals', difficulty: 50, actorSelection: 'best_council' };
    const result = applyEventChoice(makeSkillCheckEvent(check), 'attempt', state);
    // Base consequence -2 always fires; failure also applies -5 → 50 - 2 - 5 = 43
    expect(result.state.settlement.resources.food).toBe(43);
  });

  it('applies success consequences on pass', () => {
    const p = makePerson('p1', { animals: 80 }); // will pass difficulty 50
    const state = {
      ...makeState({ food: 50 }),
      people: new Map([['p1', p]]),
      councilMemberIds: ['p1'],
    } as unknown as GameState;
    const check: SkillCheck = { skill: 'animals', difficulty: 50, actorSelection: 'best_council' };
    const result = applyEventChoice(makeSkillCheckEvent(check), 'attempt', state);
    // Base -2, success +20 → 50 - 2 + 20 = 68
    expect(result.state.settlement.resources.food).toBe(68);
    expect(result.skillCheckResult?.passed).toBe(true);
  });

  it('returns isDeferredOutcome true when deferredEventId is set', () => {
    const state = makeState();
    const event: GameEvent = {
      id: 'deferred_src',
      title: 'Deferred',
      category: 'domestic',
      prerequisites: [],
      weight: 1,
      cooldown: 0,
      isUnique: false,
      description: 'Deferred event source.',
      choices: [{
        id: 'defer_choice',
        label: 'Wait',
        description: 'Something happens later.',
        consequences: [],
        deferredEventId: 'future_event',
        deferredTurns: 3,
      }],
    };
    const result = applyEventChoice(event, 'defer_choice', state);
    expect(result.isDeferredOutcome).toBe(true);
    expect(result.state.deferredEvents).toHaveLength(1);
    expect(result.state.deferredEvents[0]).toMatchObject({
      eventId: 'future_event',
      scheduledTurn: state.turnNumber + 3,
    });
  });
});

// ─── add_person ───────────────────────────────────────────────────────────────

describe('applyEventChoice — add_person', () => {
  const rng = createRNG(42);

  function makeAddPersonEvent(params: Record<string, unknown>, count = 1): GameEvent {
    return {
      id: 'add_person_event',
      title: 'Add Person Event',
      category: 'domestic',
      prerequisites: [],
      weight: 1,
      cooldown: 0,
      isUnique: false,
      description: 'Adds people to the settlement.',
      choices: [{
        id: 'accept',
        label: 'Accept',
        description: 'They join.',
        consequences: [{ type: 'add_person', target: 'newcomer', value: count, params }],
      }],
    };
  }

  it('adds a female Kiswani Riverfolk newcomer to the people map', () => {
    const state  = makeState();
    const event  = makeAddPersonEvent({ sex: 'female', ethnicGroup: 'kiswani_riverfolk', minAge: 28, maxAge: 42, religion: 'sacred_wheel' });
    const result = applyEventChoice(event, 'accept', state, createRNG(42));
    expect(result.state.people.size).toBe(1);
    const person = [...result.state.people.values()][0]!;
    expect(person.sex).toBe('female');
    expect(person.religion).toBe('sacred_wheel');
    expect(person.heritage.bloodline[0]!.group).toBe('kiswani_riverfolk');
    expect(person.age).toBeGreaterThanOrEqual(28);
    expect(person.age).toBeLessThan(42);
    expect(person.socialStatus).toBe('newcomer');
  });

  it('adds multiple people when value > 1', () => {
    const state  = makeState();
    const event  = makeAddPersonEvent({ sex: 'female', ethnicGroup: 'kiswani_riverfolk', minAge: 6, maxAge: 14 }, 2);
    const result = applyEventChoice(event, 'accept', state, createRNG(99));
    expect(result.state.people.size).toBe(2);
    [...result.state.people.values()].forEach(p => {
      expect(p.sex).toBe('female');
      expect(p.age).toBeGreaterThanOrEqual(6);
      expect(p.age).toBeLessThan(14);
    });
  });

  it('increments populationCount by the number of people added', () => {
    const state  = makeState();
    const event  = makeAddPersonEvent({ sex: 'female', ethnicGroup: 'imanian', minAge: 18, maxAge: 30 }, 3);
    const result = applyEventChoice(event, 'accept', state, createRNG(7));
    expect(result.state.settlement.populationCount).toBe(3);
  });

  it('generates an Imanian woman with correct religion and culture', () => {
    const state  = makeState();
    const event  = makeAddPersonEvent({ sex: 'female', ethnicGroup: 'imanian', minAge: 18, maxAge: 30, religion: 'imanian_orthodox' });
    const result = applyEventChoice(event, 'accept', state, createRNG(11));
    const person = [...result.state.people.values()][0]!;
    expect(person.religion).toBe('imanian_orthodox');
    expect(person.heritage.bloodline[0]!.group).toBe('imanian');
    expect(person.heritage.primaryCulture).toBe('ansberite');
  });

  it('generates a Hanjoda Stormcaller male with Hanjoda culture', () => {
    const state  = makeState();
    const event  = makeAddPersonEvent({ sex: 'male', ethnicGroup: 'hanjoda_stormcaller', minAge: 18, maxAge: 24, religion: 'sacred_wheel' });
    const result = applyEventChoice(event, 'accept', state, createRNG(13));
    const person = [...result.state.people.values()][0]!;
    expect(person.sex).toBe('male');
    expect(person.heritage.bloodline[0]!.group).toBe('hanjoda_stormcaller');
    expect(person.heritage.primaryCulture).toBe('hanjoda_stormcaller');
  });

  it('is a no-op when no rng is provided', () => {
    const state  = makeState();
    const event  = makeAddPersonEvent({ sex: 'female', ethnicGroup: 'imanian', minAge: 18, maxAge: 30 });
    // Call without rng — should silently skip add_person
    const result = applyEventChoice(event, 'accept', state);
    expect(result.state.people.size).toBe(0);
    expect(result.state.settlement.populationCount).toBe(0);
  });

  it('does not mutate the original people map', () => {
    const state  = makeState();
    const event  = makeAddPersonEvent({ sex: 'female', ethnicGroup: 'kiswani_riverfolk', minAge: 28, maxAge: 42 });
    applyEventChoice(event, 'accept', state, createRNG(55));
    expect(state.people.size).toBe(0);
  });

  it('dom_riverfolk_widow welcome_freely adds 3 people (widow + 2 daughters)', () => {
    const state  = makeState();
    const event: GameEvent = {
      id: 'dom_riverfolk_widow',
      title: 'The Riverfolk Widow',
      category: 'domestic',
      prerequisites: [],
      weight: 2,
      cooldown: 20,
      isUnique: false,
      description: 'A widow and her daughters.',
      choices: [{
        id: 'welcome_freely',
        label: 'Welcome them without condition.',
        description: 'They join.',
        consequences: [
          { type: 'modify_disposition', target: 'njaro_matu_riverfolk', value: 10 },
          { type: 'add_person', target: 'widow',    value: 1, params: { sex: 'female', ethnicGroup: 'kiswani_riverfolk', minAge: 28, maxAge: 42, religion: 'sacred_wheel', socialStatus: 'newcomer' } },
          { type: 'add_person', target: 'daughter', value: 2, params: { sex: 'female', ethnicGroup: 'kiswani_riverfolk', minAge: 6,  maxAge: 14, religion: 'sacred_wheel', socialStatus: 'newcomer' } },
        ],
      }],
    };
    const result = applyEventChoice(event, 'welcome_freely', state, createRNG(21));
    expect(result.state.people.size).toBe(3);
    expect(result.state.settlement.populationCount).toBe(3);
    const people = [...result.state.people.values()];
    // All should be Kiswani Riverfolk women
    expect(people.every(p => p.sex === 'female')).toBe(true);
    expect(people.every(p => p.heritage.bloodline[0]!.group === 'kiswani_riverfolk')).toBe(true);
    // One adult, two children (by age ranges)
    const adult    = people.filter(p => p.age >= 28);
    const children = people.filter(p => p.age < 28);
    expect(adult).toHaveLength(1);
    expect(children).toHaveLength(2);
  });
});

// ─── Result flags (EventView routing) ────────────────────────────────────────
//
// EventView reads isDeferredOutcome and skillCheckResult from the result to
// decide which screen to show and whether to call nextEvent() immediately.
// Incorrect flags here cause the "stuck button" regression.

describe('applyEventChoice — result flags (EventView routing)', () => {
  it('basic choice: isDeferredOutcome false, no skillCheckResult → nextEvent called immediately', () => {
    const state  = makeState();
    const event  = makeEvent([{ type: 'modify_resource', target: 'food', value: 5 }]);
    const result = applyEventChoice(event, 'choice_a', state);
    expect(result.isDeferredOutcome).toBe(false);
    expect(result.skillCheckResult).toBeUndefined();
    expect(result.followUpEventId).toBeUndefined();
  });

  it('skill-check choice: isDeferredOutcome false, skillCheckResult present → outcome screen shown', () => {
    const p = makePerson('p1', { combat: 70 });
    const state: GameState = {
      ...makeState(),
      people: new Map([['p1', p]]),
      councilMemberIds: ['p1'],
    } as unknown as GameState;
    const event: GameEvent = {
      id: 'sc_event',
      title: 'Skill Check Event',
      category: 'domestic',
      prerequisites: [],
      weight: 1,
      cooldown: 0,
      isUnique: false,
      description: 'A test.',
      choices: [{
        id: 'attempt',
        label: 'Attempt',
        consequences: [],
        skillCheck: { skill: 'combat', difficulty: 50, actorSelection: 'best_council' },
        onSuccess: [],
        onFailure: [],
      }],
    };
    const result = applyEventChoice(event, 'attempt', state);
    expect(result.isDeferredOutcome).toBe(false);
    expect(result.skillCheckResult).toBeDefined();
    expect(result.skillCheckResult?.passed).toBe(true);
  });

  it('deferred choice: isDeferredOutcome true, no skillCheckResult → pending screen shown', () => {
    const state = makeState();
    const event: GameEvent = {
      id: 'deferred_event',
      title: 'Deferred Event',
      category: 'domestic',
      prerequisites: [],
      weight: 1,
      cooldown: 0,
      isUnique: false,
      description: 'A test.',
      choices: [{
        id: 'wait',
        label: 'Wait',
        consequences: [],
        deferredEventId: 'some_future_event',
        deferredTurns:   3,
      }],
    };
    const result = applyEventChoice(event, 'wait', state);
    expect(result.isDeferredOutcome).toBe(true);
    expect(result.skillCheckResult).toBeUndefined();
  });

  it('follow-up choice: followUpEventId set, isDeferredOutcome false → nextEvent called immediately', () => {
    const state = makeState();
    const event: GameEvent = {
      id: 'followup_src',
      title: 'Follow-up Source',
      category: 'domestic',
      prerequisites: [],
      weight: 1,
      cooldown: 0,
      isUnique: false,
      description: 'A test.',
      choices: [{
        id: 'trigger',
        label: 'Trigger',
        consequences: [],
        followUpEventId: 'the_followup_event',
      }],
    };
    const result = applyEventChoice(event, 'trigger', state);
    expect(result.isDeferredOutcome).toBe(false);
    expect(result.followUpEventId).toBe('the_followup_event');
    expect(result.skillCheckResult).toBeUndefined();
  });

  it('resolver never modifies GameState.pendingEvents — queue management belongs to the store', () => {
    const initialPending: BoundEvent[] = [{
      id:          'existing_event',
      title:       'Existing',
      category:    'domestic',
      prerequisites: [],
      weight:      1,
      cooldown:    0,
      isUnique:    false,
      description: 'Existing queued event.',
      choices:     [{ id: 'ok', label: 'OK', consequences: [] }],
      boundActors: {},
    }];
    const state: GameState = { ...makeState(), pendingEvents: initialPending } as unknown as GameState;
    const event  = makeEvent();
    const result = applyEventChoice(event, 'choice_a', state);
    // pendingEvents must be unchanged — only nextEvent() may remove events
    expect(result.state.pendingEvents).toHaveLength(1);
    expect(result.state.pendingEvents[0]!.id).toBe('existing_event');
  });
});

// ─── Away-on-mission ──────────────────────────────────────────────────────────

describe('resolveSkillCheck — skips away persons', () => {
  it('best_council: ignores council member with role away, picks next best', () => {
    const strong = makePerson('p1', { leadership: 80 });
    const away   = { ...makePerson('p2', { leadership: 90 }), role: 'away' as const };
    const state: GameState = {
      ...makeState(),
      people:           new Map([['p1', strong], ['p2', away]]),
      councilMemberIds: ['p1', 'p2'],
    } as unknown as GameState;
    const check: SkillCheck = { skill: 'leadership', difficulty: 50, actorSelection: 'best_council' };
    const res = resolveSkillCheck(check, state);
    // p2 would normally win on score, but is away — should pick p1
    expect(res.actorId).toBe('p1');
    expect(res.actorScore).toBe(80);
  });

  it('best_council: auto-fails when all council members are away', () => {
    const away = { ...makePerson('p1', { leadership: 70 }), role: 'away' as const };
    const state: GameState = {
      ...makeState(),
      people:           new Map([['p1', away]]),
      councilMemberIds: ['p1'],
    } as unknown as GameState;
    const check: SkillCheck = { skill: 'leadership', difficulty: 30, actorSelection: 'best_council' };
    const res = resolveSkillCheck(check, state);
    expect(res.passed).toBe(false);
    expect(res.actorScore).toBe(0);
    expect(res.actorName).toBe('No one');
  });

  it('best_settlement: ignores away settler, picks next best', () => {
    const normal = makePerson('p1', { plants: 60 });
    const away   = { ...makePerson('p2', { plants: 90 }), role: 'away' as const };
    const state: GameState = {
      ...makeState(),
      people:           new Map([['p1', normal], ['p2', away]]),
      councilMemberIds: [],
    } as unknown as GameState;
    const check: SkillCheck = { skill: 'plants', difficulty: 50, actorSelection: 'best_settlement' };
    const res = resolveSkillCheck(check, state);
    expect(res.actorId).toBe('p1');
    expect(res.actorScore).toBe(60);
  });
});

describe('applyEventChoice — missionActorSlot', () => {
  it('marks the mission actor as away when a deferred choice is made', () => {
    const envoy = makePerson('envoy-1', { leadership: 50 });
    const state: GameState = {
      ...makeState(),
      people: new Map([['envoy-1', envoy]]),
    } as unknown as GameState;
    const event: GameEvent = {
      id: 'mission_event',
      title: 'Mission',
      category: 'diplomacy',
      prerequisites: [],
      weight: 1,
      cooldown: 0,
      isUnique: false,
      description: 'Send someone.',
      choices: [{
        id: 'send',
        label: 'Send them.',
        description: '',
        consequences: [],
        deferredEventId: 'mission_return',
        deferredTurns: 4,
        missionActorSlot: 'envoy',
      }],
    };
    const boundActors = { envoy: 'envoy-1' };
    const result = applyEventChoice(event, 'send', state, undefined, boundActors);
    const updatedPerson = result.state.people.get('envoy-1')!;
    expect(updatedPerson.role).toBe('away');
  });

  it('stores missionActorId and prevRole in DeferredEventEntry.context', () => {
    const envoy = { ...makePerson('envoy-2', {}), role: 'trader' as const };
    const state: GameState = {
      ...makeState(),
      people: new Map([['envoy-2', envoy]]),
    } as unknown as GameState;
    const event: GameEvent = {
      id: 'mission_event_2',
      title: 'Mission 2',
      category: 'diplomacy',
      prerequisites: [],
      weight: 1,
      cooldown: 0,
      isUnique: false,
      description: 'Send someone.',
      choices: [{
        id: 'send',
        label: 'Send them.',
        description: '',
        consequences: [],
        deferredEventId: 'mission_return_2',
        deferredTurns: 3,
        missionActorSlot: 'envoy',
      }],
    };
    const result = applyEventChoice(event, 'send', state, undefined, { envoy: 'envoy-2' });
    const entry = result.state.deferredEvents[0]!;
    expect(entry.context['missionActorId']).toBe('envoy-2');
    expect(entry.context['prevRole']).toBe('trader');
  });

  it('does not change role when missionActorSlot is not set on the choice', () => {
    const p = { ...makePerson('p-no-slot', {}), role: 'farmer' as const };
    const state: GameState = {
      ...makeState(),
      people: new Map([['p-no-slot', p]]),
    } as unknown as GameState;
    const event: GameEvent = {
      id: 'no_slot_event',
      title: 'No Slot',
      category: 'domestic',
      prerequisites: [],
      weight: 1,
      cooldown: 0,
      isUnique: false,
      description: 'No mission actor.',
      choices: [{
        id: 'go',
        label: 'Go',
        description: '',
        consequences: [],
        deferredEventId: 'no_slot_return',
        deferredTurns: 2,
        // no missionActorSlot
      }],
    };
    const result = applyEventChoice(event, 'go', state);
    const updatedPerson = result.state.people.get('p-no-slot')!;
    expect(updatedPerson.role).toBe('farmer');
    const entry = result.state.deferredEvents[0]!;
    expect(entry.context['missionActorId']).toBeUndefined();
  });
});

// ─── Household consequence types ──────────────────────────────────────────────

describe("applyEventChoice — 'set_social_status' consequence", () => {
  it('updates socialStatus on the targeted bound actor', () => {
    const thrall = {
      id: 'thrall-1',
      firstName: 'Asta',
      familyName: '',
      sex: 'female',
      age: 20,
      isAlive: true,
      socialStatus: 'thrall',
      role: 'unassigned',
      spouseIds: [],
      parentIds: [null, null],
      childrenIds: [],
      householdId: null,
      householdRole: null,
      ashkaMelathiPartnerIds: [],
      languages: [],
      heritage: { bloodline: [], primaryCulture: 'settlement_native', cultureWeights: {} },
      genetics: { visibleTraits: { skinTone: 0.5, hairColor: 'black', hairTexture: 'straight', eyeColor: 'brown', build: 'medium', heightModifier: 0 }, extendedFertility: false, genderRatioModifier: 0 },
      traits: [], skills: { animals: 25, bargaining: 25, combat: 25, custom: 25, leadership: 25, plants: 25 },
      relationships: new Map(), portraitVariant: 1,
    } as unknown as Person;

    const state: GameState = { ...makeState(), people: new Map([['thrall-1', thrall]]) } as unknown as GameState;
    const event = makeEvent([{ type: 'set_social_status', target: '{person}', value: 'newcomer' }]);
    const boundActors = { person: 'thrall-1' };
    const result = applyEventChoice(event, 'choice_a', state, undefined, boundActors);
    expect(result.state.people.get('thrall-1')?.socialStatus).toBe('newcomer');
  });
});

describe("applyEventChoice — 'set_household_role' consequence", () => {
  it('updates householdRole on the targeted bound actor', () => {
    const wife = {
      id: 'wife-1',
      firstName: 'Kira',
      familyName: 'Tal',
      sex: 'female',
      age: 28,
      isAlive: true,
      socialStatus: 'free',
      role: 'unassigned',
      spouseIds: [],
      parentIds: [null, null],
      childrenIds: [],
      householdId: 'hh-1',
      householdRole: 'wife',
      ashkaMelathiPartnerIds: [],
      languages: [],
      heritage: { bloodline: [], primaryCulture: 'settlement_native', cultureWeights: {} },
      genetics: { visibleTraits: { skinTone: 0.4, hairColor: 'brown', hairTexture: 'straight', eyeColor: 'grey', build: 'medium', heightModifier: 0 }, extendedFertility: false, genderRatioModifier: 0 },
      traits: [], skills: { animals: 25, bargaining: 25, combat: 25, custom: 25, leadership: 25, plants: 25 },
      relationships: new Map(), portraitVariant: 1,
    } as unknown as Person;

    const state: GameState = { ...makeState(), people: new Map([['wife-1', wife]]) } as unknown as GameState;
    const event = makeEvent([{ type: 'set_household_role', target: '{wife}', value: 'senior_wife' }]);
    const result = applyEventChoice(event, 'choice_a', state, undefined, { wife: 'wife-1' });
    expect(result.state.people.get('wife-1')?.householdRole).toBe('senior_wife');
  });
});

describe("applyEventChoice — 'clear_household' consequence", () => {
  it('clears householdId and householdRole on the targeted person', () => {
    const person = {
      id: 'p-1',
      firstName: 'Tal',
      familyName: 'Mor',
      sex: 'female',
      age: 22,
      isAlive: true,
      socialStatus: 'free',
      role: 'unassigned',
      spouseIds: [],
      parentIds: [null, null],
      childrenIds: [],
      householdId: 'hh-2',
      householdRole: 'concubine',
      ashkaMelathiPartnerIds: [],
      languages: [],
      heritage: { bloodline: [], primaryCulture: 'settlement_native', cultureWeights: {} },
      genetics: { visibleTraits: { skinTone: 0.6, hairColor: 'dark_brown', hairTexture: 'curly', eyeColor: 'brown', build: 'medium', heightModifier: 0 }, extendedFertility: false, genderRatioModifier: 0 },
      traits: [], skills: { animals: 25, bargaining: 25, combat: 25, custom: 25, leadership: 25, plants: 25 },
      relationships: new Map(), portraitVariant: 1,
    } as unknown as Person;

    const hhMap = new Map([['hh-2', { id: 'hh-2', name: 'T', tradition: 'sauromatian', headId: null, seniorWifeId: null, memberIds: ['p-1'], ashkaMelathiBonds: [], foundedTurn: 1 }]]);
    const state: GameState = { ...makeState(), people: new Map([['p-1', person]]), households: hhMap } as unknown as GameState;
    const event = makeEvent([{ type: 'clear_household', target: '{member}' }]);
    const result = applyEventChoice(event, 'choice_a', state, undefined, { member: 'p-1' });
    const updated = result.state.people.get('p-1')!;
    expect(updated.householdId).toBeNull();
    expect(updated.householdRole).toBeNull();
  });
});

describe("applyEventChoice — 'set_household_tradition' consequence", () => {
  it("updates the household's tradition field via the targeted person's householdId", () => {
    const head = {
      id: 'head-1',
      firstName: 'Arko',
      familyName: 'Bel',
      sex: 'male',
      age: 35,
      isAlive: true,
      socialStatus: 'free',
      role: 'unassigned',
      spouseIds: [],
      parentIds: [null, null],
      childrenIds: [],
      householdId: 'hh-3',
      householdRole: 'head',
      ashkaMelathiPartnerIds: [],
      languages: [],
      heritage: { bloodline: [], primaryCulture: 'settlement_native', cultureWeights: {} },
      genetics: { visibleTraits: { skinTone: 0.3, hairColor: 'blonde', hairTexture: 'straight', eyeColor: 'blue', build: 'medium', heightModifier: 0 }, extendedFertility: false, genderRatioModifier: 0 },
      traits: [], skills: { animals: 25, bargaining: 25, combat: 25, custom: 25, leadership: 25, plants: 25 },
      relationships: new Map(), portraitVariant: 1,
    } as unknown as Person;

    const hhMap = new Map([['hh-3', { id: 'hh-3', name: 'Bel Ashkaran', tradition: 'sauromatian', headId: 'head-1', seniorWifeId: null, memberIds: ['head-1'], ashkaMelathiBonds: [], foundedTurn: 1 }]]);
    const state: GameState = { ...makeState(), people: new Map([['head-1', head]]), households: hhMap } as unknown as GameState;
    const event = makeEvent([{ type: 'set_household_tradition', target: '{head}', value: 'ansberite' }]);
    const result = applyEventChoice(event, 'choice_a', state, undefined, { head: 'head-1' });
    expect(result.state.households?.get('hh-3')?.tradition).toBe('ansberite');
  });
});

// ─── modify_religion consequence ──────────────────────────────────────────────

describe("applyEventChoice — 'modify_religion' consequence", () => {
  function makePerson(id: string, religion: Person['religion']): Person {
    return {
      id, firstName: 'Test', familyName: 'Person', sex: 'male', age: 30,
      alive: true, role: 'unassigned', socialStatus: 'settler',
      traits: [], spouseIds: [], parentIds: [null, null], childrenIds: [],
      religion,
      languages: [], relationships: new Map(), opinionModifiers: [],
      heritage: { bloodline: [], primaryCulture: 'imanian_homeland', culturalFluency: new Map() },
      genetics: { visibleTraits: { skinTone: 0.2, skinUndertone: 'cool_pink', hairColor: 'light_brown', hairTexture: 'straight', eyeColor: 'blue', buildType: 'athletic', height: 'average', facialStructure: 'oval' }, genderRatioModifier: 0.5, extendedFertility: false },
      fertility: { isExtended: false, fertilityStart: 14, fertilityPeak: 25, fertilityDeclineStart: 35, fertilityEnd: 45 },
      health: { currentHealth: 100, conditions: [] },
      skills: { animals: 25, bargaining: 25, combat: 25, custom: 25, leadership: 25, plants: 25 },
      portraitVariant: 1,
    } as unknown as Person;
  }

  it('changes the targeted person religion to the given value', () => {
    const person = makePerson('p1', 'imanian_orthodox');
    const state = { ...makeState(), people: new Map([['p1', person]]) } as unknown as GameState;
    const event = makeEvent([{ type: 'modify_religion', target: '{convert}', value: 'sacred_wheel' }]);
    const result = applyEventChoice(event, 'choice_a', state, undefined, { convert: 'p1' });
    expect(result.state.people.get('p1')?.religion).toBe('sacred_wheel');
  });

  it('leaves other people unchanged', () => {
    const p1 = makePerson('p1', 'imanian_orthodox');
    const p2 = makePerson('p2', 'imanian_orthodox');
    const state = { ...makeState(), people: new Map([['p1', p1], ['p2', p2]]) } as unknown as GameState;
    const event = makeEvent([{ type: 'modify_religion', target: '{convert}', value: 'sacred_wheel' }]);
    const result = applyEventChoice(event, 'choice_a', state, undefined, { convert: 'p1' });
    expect(result.state.people.get('p2')?.religion).toBe('imanian_orthodox');
  });

  it('returns state with no people changes when target person does not exist', () => {
    const state = makeState();
    const event = makeEvent([{ type: 'modify_religion', target: 'nonexistent', value: 'sacred_wheel' }]);
    const result = applyEventChoice(event, 'choice_a', state);
    // applyEventChoice always adds bookkeeping (eventHistory/eventCooldowns),
    // but the people map itself should be empty/unchanged.
    expect(result.state.people.size).toBe(0);
  });
});

// ─── set_religious_policy consequence ────────────────────────────────────────

describe("applyEventChoice — 'set_religious_policy' consequence", () => {
  it('sets the religious policy on the settlement', () => {
    const state = makeState();
    const event = makeEvent([{ type: 'set_religious_policy', target: 'settlement', value: 'orthodox_enforced' }]);
    const result = applyEventChoice(event, 'choice_a', state);
    expect(result.state.settlement.religiousPolicy).toBe('orthodox_enforced');
  });

  it('implicitly sets hiddenWheelEmerged when policy is hidden_wheel_recognized', () => {
    const state = makeState();
    const event = makeEvent([{ type: 'set_religious_policy', target: 'settlement', value: 'hidden_wheel_recognized' }]);
    const result = applyEventChoice(event, 'choice_a', state);
    expect(result.state.settlement.religiousPolicy).toBe('hidden_wheel_recognized');
    expect(result.state.culture.hiddenWheelEmerged).toBe(true);
  });

  it('does not set hiddenWheelEmerged for other policy values', () => {
    const state = makeState();
    const event = makeEvent([{ type: 'set_religious_policy', target: 'settlement', value: 'wheel_permitted' }]);
    const result = applyEventChoice(event, 'choice_a', state);
    expect(result.state.culture.hiddenWheelEmerged).toBeFalsy();
  });
});

// ─── modify_cultural_blend consequence ───────────────────────────────────────

describe("applyEventChoice — 'modify_cultural_blend' consequence", () => {
  it('adds the delta to culturalBlend', () => {
    const base = makeState();
    const state = { ...base, culture: { ...base.culture, culturalBlend: 0.5 } } as unknown as GameState;
    const event = makeEvent([{ type: 'modify_cultural_blend', target: 'settlement', value: 0.1 }]);
    const result = applyEventChoice(event, 'choice_a', state);
    expect(result.state.culture.culturalBlend).toBeCloseTo(0.6);
  });

  it('clamps culturalBlend at 1.0', () => {
    const base = makeState();
    const state = { ...base, culture: { ...base.culture, culturalBlend: 0.95 } } as unknown as GameState;
    const event = makeEvent([{ type: 'modify_cultural_blend', target: 'settlement', value: 0.2 }]);
    const result = applyEventChoice(event, 'choice_a', state);
    expect(result.state.culture.culturalBlend).toBe(1.0);
  });

  it('clamps culturalBlend at 0.0', () => {
    const base = makeState();
    const state = { ...base, culture: { ...base.culture, culturalBlend: 0.05 } } as unknown as GameState;
    const event = makeEvent([{ type: 'modify_cultural_blend', target: 'settlement', value: -0.2 }]);
    const result = applyEventChoice(event, 'choice_a', state);
    expect(result.state.culture.culturalBlend).toBe(0.0);
  });
});

// ─── modify_all_tribe_dispositions consequence ────────────────────────────────

describe("applyEventChoice — 'modify_all_tribe_dispositions' consequence", () => {
  function stateWithTribes(tribes: Array<{ id: string; disposition: number }>): GameState {
    const tribeMap = new Map(tribes.map(t => [t.id, { id: t.id, name: t.id, disposition: t.disposition } as any]));
    return { ...makeState(), tribes: tribeMap } as unknown as GameState;
  }

  it('adds the delta to every tribe disposition', () => {
    const state = stateWithTribes([
      { id: 'tribe_a', disposition: 10 },
      { id: 'tribe_b', disposition: -5 },
    ]);
    const event = makeEvent([{ type: 'modify_all_tribe_dispositions', target: 'all', value: 15 }]);
    const result = applyEventChoice(event, 'choice_a', state);
    expect(result.state.tribes.get('tribe_a')?.disposition).toBe(25);
    expect(result.state.tribes.get('tribe_b')?.disposition).toBe(10);
  });

  it('clamps tribe disposition at 100', () => {
    const state = stateWithTribes([{ id: 'tribe_a', disposition: 95 }]);
    const event = makeEvent([{ type: 'modify_all_tribe_dispositions', target: 'all', value: 20 }]);
    const result = applyEventChoice(event, 'choice_a', state);
    expect(result.state.tribes.get('tribe_a')?.disposition).toBe(100);
  });

  it('clamps tribe disposition at -100', () => {
    const state = stateWithTribes([{ id: 'tribe_a', disposition: -90 }]);
    const event = makeEvent([{ type: 'modify_all_tribe_dispositions', target: 'all', value: -20 }]);
    const result = applyEventChoice(event, 'choice_a', state);
    expect(result.state.tribes.get('tribe_a')?.disposition).toBe(-100);
  });

  it('applies delta to all tribes independently', () => {
    const state = stateWithTribes([
      { id: 'tribe_a', disposition: 0 },
      { id: 'tribe_b', disposition: 50 },
      { id: 'tribe_c', disposition: -50 },
    ]);
    const event = makeEvent([{ type: 'modify_all_tribe_dispositions', target: 'all', value: -10 }]);
    const result = applyEventChoice(event, 'choice_a', state);
    expect(result.state.tribes.get('tribe_a')?.disposition).toBe(-10);
    expect(result.state.tribes.get('tribe_b')?.disposition).toBe(40);
    expect(result.state.tribes.get('tribe_c')?.disposition).toBe(-60);
  });

  it('returns state unchanged when there are no tribes', () => {
    const state = makeState();
    const event = makeEvent([{ type: 'modify_all_tribe_dispositions', target: 'all', value: 10 }]);
    const result = applyEventChoice(event, 'choice_a', state);
    expect(result.state.tribes.size).toBe(0);
  });
});

// ─── modify_opinion_pair consequence ─────────────────────────────────────────

describe("applyEventChoice — 'modify_opinion_pair' consequence", () => {
  function makePerson(id: string): Person {
    return {
      id, firstName: 'Test', familyName: id, sex: 'male', age: 30,
      alive: true, role: 'unassigned', socialStatus: 'settler',
      traits: [], spouseIds: [], parentIds: [null, null], childrenIds: [],
      religion: 'imanian_orthodox',
      languages: [], relationships: new Map(), opinionModifiers: [],
      heritage: { bloodline: [], primaryCulture: 'imanian_homeland', culturalFluency: new Map() },
      genetics: { visibleTraits: { skinTone: 0.2, skinUndertone: 'cool_pink', hairColor: 'light_brown', hairTexture: 'straight', eyeColor: 'blue', buildType: 'athletic', height: 'average', facialStructure: 'oval' }, genderRatioModifier: 0.5, extendedFertility: false },
      fertility: { isExtended: false, fertilityStart: 14, fertilityPeak: 25, fertilityDeclineStart: 35, fertilityEnd: 45 },
      health: { currentHealth: 100, conditions: [] },
      skills: { animals: 25, bargaining: 25, combat: 25, custom: 25, leadership: 25, plants: 25 },
      portraitVariant: 1,
    } as unknown as Person;
  }

  it('adds a timed modifier from A toward B and from B toward A', () => {
    const pA = makePerson('pA');
    const pB = makePerson('pB');
    const state = { ...makeState(), people: new Map([['pA', pA], ['pB', pB]]) } as unknown as GameState;
    const event = makeEvent([{
      type: 'modify_opinion_pair',
      target: '{actorA}',
      value: 8,
      params: { slotB: '{actorB}', label: 'Joint project' },
    }]);
    const result = applyEventChoice(event, 'choice_a', state, undefined, { actorA: 'pA', actorB: 'pB' });
    const modA = result.state.people.get('pA')?.opinionModifiers?.find(m => m.targetId === 'pB');
    const modB = result.state.people.get('pB')?.opinionModifiers?.find(m => m.targetId === 'pA');
    expect(modA?.value).toBe(8);
    expect(modA?.label).toBe('Joint project');
    expect(modB?.value).toBe(8);
  });

  it('supports asymmetric values via valueB param', () => {
    const pA = makePerson('pA');
    const pB = makePerson('pB');
    const state = { ...makeState(), people: new Map([['pA', pA], ['pB', pB]]) } as unknown as GameState;
    const event = makeEvent([{
      type: 'modify_opinion_pair',
      target: '{actorA}',
      value: 5,
      params: { slotB: '{actorB}', valueB: -3, label: 'Argument' },
    }]);
    const result = applyEventChoice(event, 'choice_a', state, undefined, { actorA: 'pA', actorB: 'pB' });
    const modA = result.state.people.get('pA')?.opinionModifiers?.find(m => m.targetId === 'pB');
    const modB = result.state.people.get('pB')?.opinionModifiers?.find(m => m.targetId === 'pA');
    expect(modA?.value).toBe(5);
    expect(modB?.value).toBe(-3);
  });
});

// ─── modify_opinion_labeled consequence ──────────────────────────────────────

describe("applyEventChoice — 'modify_opinion_labeled' consequence", () => {
  function makePerson(id: string): Person {
    return {
      id, firstName: 'Test', familyName: id, sex: 'male', age: 30,
      alive: true, role: 'unassigned', socialStatus: 'settler',
      traits: [], spouseIds: [], parentIds: [null, null], childrenIds: [],
      religion: 'imanian_orthodox',
      languages: [], relationships: new Map(), opinionModifiers: [],
      heritage: { bloodline: [], primaryCulture: 'imanian_homeland', culturalFluency: new Map() },
      genetics: { visibleTraits: { skinTone: 0.2, skinUndertone: 'cool_pink', hairColor: 'light_brown', hairTexture: 'straight', eyeColor: 'blue', buildType: 'athletic', height: 'average', facialStructure: 'oval' }, genderRatioModifier: 0.5, extendedFertility: false },
      fertility: { isExtended: false, fertilityStart: 14, fertilityPeak: 25, fertilityDeclineStart: 35, fertilityEnd: 45 },
      health: { currentHealth: 100, conditions: [] },
      skills: { animals: 25, bargaining: 25, combat: 25, custom: 25, leadership: 25, plants: 25 },
      portraitVariant: 1,
    } as unknown as Person;
  }

  it('broadcasts a timed modifier from every observer toward the target', () => {
    const target  = makePerson('target');
    const obs1    = makePerson('obs1');
    const obs2    = makePerson('obs2');
    const state   = { ...makeState(), people: new Map([['target', target], ['obs1', obs1], ['obs2', obs2]]) } as unknown as GameState;
    const event   = makeEvent([{
      type: 'modify_opinion_labeled',
      target: '{hero}',
      value: 12,
      params: { label: 'Heroic act' },
    }]);
    const result = applyEventChoice(event, 'choice_a', state, undefined, { hero: 'target' });
    const m1 = result.state.people.get('obs1')?.opinionModifiers?.find(m => m.targetId === 'target');
    const m2 = result.state.people.get('obs2')?.opinionModifiers?.find(m => m.targetId === 'target');
    expect(m1?.value).toBe(12);
    expect(m1?.label).toBe('Heroic act');
    expect(m2?.value).toBe(12);
  });

  it('does not add a self-modifier to the target', () => {
    const target = makePerson('target');
    const state  = { ...makeState(), people: new Map([['target', target]]) } as unknown as GameState;
    const event  = makeEvent([{
      type: 'modify_opinion_labeled',
      target: 'target',
      value: 5,
      params: { label: 'Act' },
    }]);
    const result = applyEventChoice(event, 'choice_a', state);
    const selfMod = result.state.people.get('target')?.opinionModifiers?.find(m => m.targetId === 'target');
    expect(selfMod).toBeUndefined();
  });
});

// ─── add_trait / remove_trait consequences ────────────────────────────────────

describe("applyEventChoice — 'add_trait' and 'remove_trait' consequences", () => {
  function makePerson(id: string, traits: string[] = []): Person {
    return {
      id, firstName: 'Test', familyName: id, sex: 'male', age: 30,
      alive: true, role: 'unassigned', socialStatus: 'settler',
      traits, spouseIds: [], parentIds: [null, null], childrenIds: [],
      religion: 'imanian_orthodox',
      languages: [], relationships: new Map(), opinionModifiers: [],
      heritage: { bloodline: [], primaryCulture: 'imanian_homeland', culturalFluency: new Map() },
      genetics: { visibleTraits: { skinTone: 0.2, skinUndertone: 'cool_pink', hairColor: 'light_brown', hairTexture: 'straight', eyeColor: 'blue', buildType: 'athletic', height: 'average', facialStructure: 'oval' }, genderRatioModifier: 0.5, extendedFertility: false },
      fertility: { isExtended: false, fertilityStart: 14, fertilityPeak: 25, fertilityDeclineStart: 35, fertilityEnd: 45 },
      health: { currentHealth: 100, conditions: [] },
      skills: { animals: 25, bargaining: 25, combat: 25, custom: 25, leadership: 25, plants: 25 },
      portraitVariant: 1,
    } as unknown as Person;
  }

  it('add_trait appends a new trait to the person', () => {
    const person = makePerson('p1', ['brave']);
    const state  = { ...makeState(), people: new Map([['p1', person]]) } as unknown as GameState;
    const event  = makeEvent([{ type: 'add_trait', target: '{target}', value: 'loyal' }]);
    const result = applyEventChoice(event, 'choice_a', state, undefined, { target: 'p1' });
    expect(result.state.people.get('p1')?.traits).toContain('loyal');
    expect(result.state.people.get('p1')?.traits).toContain('brave');
  });

  it('add_trait is idempotent — does not duplicate an already-present trait', () => {
    const person = makePerson('p1', ['brave']);
    const state  = { ...makeState(), people: new Map([['p1', person]]) } as unknown as GameState;
    const event  = makeEvent([{ type: 'add_trait', target: '{target}', value: 'brave' }]);
    const result = applyEventChoice(event, 'choice_a', state, undefined, { target: 'p1' });
    expect(result.state.people.get('p1')?.traits.filter(t => t === 'brave').length).toBe(1);
  });

  it('remove_trait removes an existing trait from the person', () => {
    const person = makePerson('p1', ['brave', 'reckless']);
    const state  = { ...makeState(), people: new Map([['p1', person]]) } as unknown as GameState;
    const event  = makeEvent([{ type: 'remove_trait', target: '{target}', value: 'reckless' }]);
    const result = applyEventChoice(event, 'choice_a', state, undefined, { target: 'p1' });
    expect(result.state.people.get('p1')?.traits).not.toContain('reckless');
    expect(result.state.people.get('p1')?.traits).toContain('brave');
  });

  it('remove_trait is a no-op when the trait is not present', () => {
    const person = makePerson('p1', ['brave']);
    const state  = { ...makeState(), people: new Map([['p1', person]]) } as unknown as GameState;
    const event  = makeEvent([{ type: 'remove_trait', target: '{target}', value: 'cowardly' }]);
    const result = applyEventChoice(event, 'choice_a', state, undefined, { target: 'p1' });
    expect(result.state.people.get('p1')?.traits).toEqual(['brave']);
  });
});

// ─── wound_person consequence ─────────────────────────────────────────────────

describe("applyEventChoice — 'wound_person' consequence", () => {
  function makePerson(id: string, health = 100): Person {
    return {
      id, firstName: 'Test', familyName: id, sex: 'male', age: 30,
      alive: true, role: 'unassigned', socialStatus: 'settler',
      traits: [], spouseIds: [], parentIds: [null, null], childrenIds: [],
      religion: 'imanian_orthodox',
      languages: [], relationships: new Map(), opinionModifiers: [],
      heritage: { bloodline: [], primaryCulture: 'imanian_homeland', culturalFluency: new Map() },
      genetics: { visibleTraits: { skinTone: 0.2, skinUndertone: 'cool_pink', hairColor: 'light_brown', hairTexture: 'straight', eyeColor: 'blue', buildType: 'athletic', height: 'average', facialStructure: 'oval' }, genderRatioModifier: 0.5, extendedFertility: false },
      fertility: { isExtended: false, fertilityStart: 14, fertilityPeak: 25, fertilityDeclineStart: 35, fertilityEnd: 45 },
      health: { currentHealth: health, conditions: [] },
      skills: { animals: 25, bargaining: 25, combat: 25, custom: 25, leadership: 25, plants: 25 },
      portraitVariant: 1,
    } as unknown as Person;
  }

  it('reduces health by the specified amount', () => {
    const person = makePerson('p1', 80);
    const state  = { ...makeState(), people: new Map([['p1', person]]) } as unknown as GameState;
    const event  = makeEvent([{ type: 'wound_person', target: '{victim}', value: 25 }]);
    const result = applyEventChoice(event, 'choice_a', state, undefined, { victim: 'p1' });
    expect(result.state.people.get('p1')?.health.currentHealth).toBe(55);
  });

  it('clamps health at 0', () => {
    const person = makePerson('p1', 15);
    const state  = { ...makeState(), people: new Map([['p1', person]]) } as unknown as GameState;
    const event  = makeEvent([{ type: 'wound_person', target: '{victim}', value: 50 }]);
    const result = applyEventChoice(event, 'choice_a', state, undefined, { victim: 'p1' });
    expect(result.state.people.get('p1')?.health.currentHealth).toBe(0);
  });

  it("adds the 'wounded' condition if not already present", () => {
    const person = makePerson('p1', 100);
    const state  = { ...makeState(), people: new Map([['p1', person]]) } as unknown as GameState;
    const event  = makeEvent([{ type: 'wound_person', target: '{victim}', value: 10 }]);
    const result = applyEventChoice(event, 'choice_a', state, undefined, { victim: 'p1' });
    expect(result.state.people.get('p1')?.health.conditions).toContain('wounded');
  });

  it("does not duplicate the 'wounded' condition", () => {
    const person = { ...makePerson('p1', 80), health: { currentHealth: 80, conditions: ['wounded' as const] } } as unknown as Person;
    const state  = { ...makeState(), people: new Map([['p1', person]]) } as unknown as GameState;
    const event  = makeEvent([{ type: 'wound_person', target: '{victim}', value: 10 }]);
    const result = applyEventChoice(event, 'choice_a', state, undefined, { victim: 'p1' });
    expect(result.state.people.get('p1')?.health.conditions.filter(c => c === 'wounded').length).toBe(1);
  });
});
