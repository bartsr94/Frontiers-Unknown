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
import { applyEventChoice } from '../../src/simulation/events/resolver';
import type { GameEvent, EventConsequence } from '../../src/simulation/events/engine';
import type { GameState } from '../../src/simulation/turn/game-state';

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
      annualQuotaTradeGoods:  0,
      consecutiveFailures:    0,
      supportLevel:           'standard',
      yearsActive:            0,
    },
    eventHistory:     [],
    eventCooldowns:   new Map(),
    pendingEvents:    [],
    councilMemberIds: [],
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
    expect(result.settlement.resources.food).toBe(50);
  });

  it('subtracts a negative delta from the target resource', () => {
    const state  = makeState({ food: 30 });
    const event  = makeEvent([{ type: 'modify_resource', target: 'food', value: -10 }]);
    const result = applyEventChoice(event, 'choice_a', state);
    expect(result.settlement.resources.food).toBe(20);
  });

  it('floors resources at 0 — never goes negative', () => {
    const state  = makeState({ food: 5 });
    const event  = makeEvent([{ type: 'modify_resource', target: 'food', value: -100 }]);
    const result = applyEventChoice(event, 'choice_a', state);
    expect(result.settlement.resources.food).toBe(0);
  });

  it('applies delta to the correct resource and leaves others untouched', () => {
    const state  = makeState({ gold: 10, food: 50 });
    const event  = makeEvent([{ type: 'modify_resource', target: 'gold', value: 5 }]);
    const result = applyEventChoice(event, 'choice_a', state);
    expect(result.settlement.resources.gold).toBe(15);
    expect(result.settlement.resources.food).toBe(50); // unchanged
  });
});

// ─── modify_standing ─────────────────────────────────────────────────────────

describe('applyEventChoice — modify_standing', () => {
  it('increases company standing by the given delta', () => {
    const state  = makeState({ standing: 40 });
    const event  = makeEvent([{ type: 'modify_standing', target: 'company', value: 15 }]);
    const result = applyEventChoice(event, 'choice_a', state);
    expect(result.company.standing).toBe(55);
  });

  it('decreases company standing by the given delta', () => {
    const state  = makeState({ standing: 40 });
    const event  = makeEvent([{ type: 'modify_standing', target: 'company', value: -20 }]);
    const result = applyEventChoice(event, 'choice_a', state);
    expect(result.company.standing).toBe(20);
  });

  it('clamps standing at a maximum of 100', () => {
    const state  = makeState({ standing: 95 });
    const event  = makeEvent([{ type: 'modify_standing', target: 'company', value: 20 }]);
    const result = applyEventChoice(event, 'choice_a', state);
    expect(result.company.standing).toBe(100);
  });

  it('clamps standing at a minimum of 0', () => {
    const state  = makeState({ standing: 5 });
    const event  = makeEvent([{ type: 'modify_standing', target: 'company', value: -50 }]);
    const result = applyEventChoice(event, 'choice_a', state);
    expect(result.company.standing).toBe(0);
  });

  it('ignores modify_standing when target is not "company"', () => {
    const state  = makeState({ standing: 50 });
    const event  = makeEvent([{ type: 'modify_standing', target: 'some_tribe', value: 30 }]);
    const result = applyEventChoice(event, 'choice_a', state);
    expect(result.company.standing).toBe(50); // unchanged
  });
});

// ─── Unknown choice ID ────────────────────────────────────────────────────────

describe('applyEventChoice — unknown choiceId', () => {
  it('returns state unchanged when choiceId is not found on the event', () => {
    const state  = makeState({ food: 50 });
    const event  = makeEvent([{ type: 'modify_resource', target: 'food', value: 99 }]);
    const result = applyEventChoice(event, 'nonexistent_choice', state);
    expect(result.settlement.resources.food).toBe(50);
    expect(result).toBe(state); // exact same reference — no copy
  });
});

// ─── Bookkeeping ──────────────────────────────────────────────────────────────

describe('applyEventChoice — bookkeeping', () => {
  it('records the event id in the cooldown map with the current turn number', () => {
    const state  = makeState({ turnNumber: 7 });
    const event  = makeEvent();
    const result = applyEventChoice(event, 'choice_a', state);
    expect(result.eventCooldowns.get('test_event')).toBe(7);
  });

  it('appends the event to eventHistory with the correct fields', () => {
    const state  = makeState({ turnNumber: 3 });
    const event  = makeEvent();
    const result = applyEventChoice(event, 'choice_a', state);
    expect(result.eventHistory).toHaveLength(1);
    expect(result.eventHistory[0]).toMatchObject({
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
    expect(result.settlement.resources.food).toBe(30);
    expect(result.company.standing).toBe(70);
  });
});
