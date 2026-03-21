/**
 * Tests for the `contribute_quota_wealth` event consequence.
 *
 * Covers all four modes:
 *   - 'full'         → deducts exactly the annual quota amount
 *   - 'exceed'       → deducts floor(quota × 1.25) (overpayment)
 *   - 'all_available'→ deducts all remaining settlement wealth
 *   - 'none'         → no deduction (player withholds payment)
 *
 * Also covers:
 *   - Clamping: if wealth < quota, only available wealth is contributed
 *   - Grace period (year ≤ 10): quota is 0, so nothing is deducted in any mode
 *   - quotaContributedWealth accumulates correctly
 */

import { describe, it, expect } from 'vitest';
import { applyEventChoice } from '../../src/simulation/events/resolver';
import type { GameEvent, EventConsequence } from '../../src/simulation/events/engine';
import type { GameState } from '../../src/simulation/turn/game-state';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeState(opts: {
  wealth?: number;
  currentYear?: number;
  quotaContributedWealth?: number;
} = {}): GameState {
  return {
    version: '1.0.0',
    seed: 1,
    turnNumber: 5,
    currentSeason: 'autumn',
    currentYear: opts.currentYear ?? 15,
    people: new Map(),
    graveyard: [],
    households: new Map(),
    settlement: {
      name: 'Test',
      location: 'marsh',
      buildings: [],
      constructionQueue: [],
      economyReserves: {},
      resources: {
        food: 0, cattle: 0,
        wealth: opts.wealth ?? 50,
        steel: 0, lumber: 0, stone: 0, medicine: 0, horses: 0,
      },
      populationCount: 0,
    },
    culture: {
      languages: new Map(),
      primaryLanguage: 'imanian',
      languageDiversityTurns: 0,
      languageTension: 0,
      religions: new Map(),
      religiousTension: 0,
      hiddenWheelDivergenceTurns: 0,
      hiddenWheelSuppressedTurns: 0,
      hiddenWheelEmerged: false,
      culturalBlend: 0,
      practices: [],
      governance: 'patriarchal_imanian',
    },
    identityPressure: { companyPressureTurns: 0, tribalPressureTurns: 0 },
    tribes: new Map(),
    factions: [],
    activityLog: [],
    company: {
      standing: 60,
      annualQuotaWealth: 0,
      consecutiveFailures: 0,
      supportLevel: 'standard',
      yearsActive: 0,
      quotaContributedWealth: opts.quotaContributedWealth ?? 0,
      locationSupplyModifier: 1.0,
    },
    eventHistory: [],
    eventCooldowns: new Map(),
    pendingEvents: [],
    deferredEvents: [],
    councilMemberIds: [],
    config: {
      seed: 1,
      difficulty: 'normal',
      settlementName: 'Test',
      includeSauromatianWomen: false,
      startingTribes: [],
    },
  } as unknown as GameState;
}

function makeEvent(consequences: Omit<EventConsequence, 'target'>[]): GameEvent {
  const fullConsequences = consequences.map(c => ({ target: '', ...c })) as EventConsequence[];
  return {
    id: 'test_export',
    title: 'Annual Export',
    category: 'economic',
    prerequisites: [],
    weight: 1,
    cooldown: 0,
    isUnique: false,
    description: 'Submit goods to the Company.',
    choices: [{
      id: 'submit',
      label: 'Submit',
      description: 'Send the required wealth.',
      consequences: fullConsequences,
    }],
  };
}

// ─── quota formula verification ───────────────────────────────────────────────

// computeYearlyQuota(year):
//   year ≤ 10 → { wealth: 0 }
//   year 11   → { wealth: 10 + (11 - 10) * 5 } = 15
//   year 15   → { wealth: 10 + (15 - 10) * 5 } = 35
//   year 20   → { wealth: 10 + (20 - 10) * 5 } = 60

// ─── mode: 'full' ─────────────────────────────────────────────────────────────

describe("contribute_quota_wealth — mode 'full'", () => {
  it('year 15: deducts exact quota (35) from wealth and adds to quotaContributedWealth', () => {
    const state = makeState({ wealth: 50, currentYear: 15 });
    const event = makeEvent([{ type: 'contribute_quota_wealth', value: 'full' }]);
    const { state: result } = applyEventChoice(event, 'submit', state);
    expect(result.settlement.resources.wealth).toBe(15);          // 50 − 35
    expect(result.company.quotaContributedWealth).toBe(35);
  });

  it('year 11: deducts quota of 15', () => {
    const state = makeState({ wealth: 50, currentYear: 11 });
    const event = makeEvent([{ type: 'contribute_quota_wealth', value: 'full' }]);
    const { state: result } = applyEventChoice(event, 'submit', state);
    expect(result.settlement.resources.wealth).toBe(35);          // 50 − 15
    expect(result.company.quotaContributedWealth).toBe(15);
  });

  it('clamping: when wealth (10) < quota (35), only available wealth is deducted', () => {
    const state = makeState({ wealth: 10, currentYear: 15 });
    const event = makeEvent([{ type: 'contribute_quota_wealth', value: 'full' }]);
    const { state: result } = applyEventChoice(event, 'submit', state);
    expect(result.settlement.resources.wealth).toBe(0);
    expect(result.company.quotaContributedWealth).toBe(10);
  });

  it('accumulates on top of previously contributed wealth', () => {
    const state = makeState({ wealth: 50, currentYear: 15, quotaContributedWealth: 20 });
    const event = makeEvent([{ type: 'contribute_quota_wealth', value: 'full' }]);
    const { state: result } = applyEventChoice(event, 'submit', state);
    expect(result.company.quotaContributedWealth).toBe(55);       // 20 + 35
  });
});

// ─── mode: 'exceed' ──────────────────────────────────────────────────────────

describe("contribute_quota_wealth — mode 'exceed'", () => {
  it('year 15: deducts floor(35 × 1.25) = 43', () => {
    const state = makeState({ wealth: 50, currentYear: 15 });
    const event = makeEvent([{ type: 'contribute_quota_wealth', value: 'exceed' }]);
    const { state: result } = applyEventChoice(event, 'submit', state);
    expect(result.settlement.resources.wealth).toBe(7);           // 50 − 43
    expect(result.company.quotaContributedWealth).toBe(43);
  });

  it('year 11: deducts floor(15 × 1.25) = 18', () => {
    const state = makeState({ wealth: 50, currentYear: 11 });
    const event = makeEvent([{ type: 'contribute_quota_wealth', value: 'exceed' }]);
    const { state: result } = applyEventChoice(event, 'submit', state);
    expect(result.settlement.resources.wealth).toBe(32);          // 50 − 18
    expect(result.company.quotaContributedWealth).toBe(18);
  });

  it('clamping: wealth (5) < exceed amount (43) → only 5 deducted', () => {
    const state = makeState({ wealth: 5, currentYear: 15 });
    const event = makeEvent([{ type: 'contribute_quota_wealth', value: 'exceed' }]);
    const { state: result } = applyEventChoice(event, 'submit', state);
    expect(result.settlement.resources.wealth).toBe(0);
    expect(result.company.quotaContributedWealth).toBe(5);
  });
});

// ─── mode: 'all_available' ───────────────────────────────────────────────────

describe("contribute_quota_wealth — mode 'all_available'", () => {
  it('deducts ALL settlement wealth regardless of quota', () => {
    const state = makeState({ wealth: 50, currentYear: 15 });
    const event = makeEvent([{ type: 'contribute_quota_wealth', value: 'all_available' }]);
    const { state: result } = applyEventChoice(event, 'submit', state);
    expect(result.settlement.resources.wealth).toBe(0);
    expect(result.company.quotaContributedWealth).toBe(50);
  });

  it('deducts all wealth even below quota (year 15, only 10 wealth)', () => {
    const state = makeState({ wealth: 10, currentYear: 15 });
    const event = makeEvent([{ type: 'contribute_quota_wealth', value: 'all_available' }]);
    const { state: result } = applyEventChoice(event, 'submit', state);
    expect(result.settlement.resources.wealth).toBe(0);
    expect(result.company.quotaContributedWealth).toBe(10);
  });

  it('deducts 0 when wealth is already 0', () => {
    const state = makeState({ wealth: 0, currentYear: 15 });
    const event = makeEvent([{ type: 'contribute_quota_wealth', value: 'all_available' }]);
    const { state: result } = applyEventChoice(event, 'submit', state);
    expect(result.settlement.resources.wealth).toBe(0);
    expect(result.company.quotaContributedWealth).toBe(0);
  });
});

// ─── mode: 'none' ────────────────────────────────────────────────────────────

describe("contribute_quota_wealth — mode 'none'", () => {
  it('does not change wealth or quotaContributedWealth', () => {
    const state = makeState({ wealth: 50, currentYear: 15 });
    const event = makeEvent([{ type: 'contribute_quota_wealth', value: 'none' }]);
    const { state: result } = applyEventChoice(event, 'submit', state);
    expect(result.settlement.resources.wealth).toBe(50);
    expect(result.company.quotaContributedWealth).toBe(0);
  });

  it("'none' during grace period also changes nothing", () => {
    const state = makeState({ wealth: 30, currentYear: 5 });
    const event = makeEvent([{ type: 'contribute_quota_wealth', value: 'none' }]);
    const { state: result } = applyEventChoice(event, 'submit', state);
    expect(result.settlement.resources.wealth).toBe(30);
    expect(result.company.quotaContributedWealth).toBe(0);
  });
});

// ─── Grace period (year ≤ 10) ─────────────────────────────────────────────────

describe("contribute_quota_wealth — grace period (year ≤ 10)", () => {
  it('year 5, mode full: quota = 0, wealth unchanged', () => {
    const state = makeState({ wealth: 30, currentYear: 5 });
    const event = makeEvent([{ type: 'contribute_quota_wealth', value: 'full' }]);
    const { state: result } = applyEventChoice(event, 'submit', state);
    expect(result.settlement.resources.wealth).toBe(30);
    expect(result.company.quotaContributedWealth).toBe(0);
  });

  it('year 10, mode exceed: quota = 0, wealth unchanged', () => {
    const state = makeState({ wealth: 20, currentYear: 10 });
    const event = makeEvent([{ type: 'contribute_quota_wealth', value: 'exceed' }]);
    const { state: result } = applyEventChoice(event, 'submit', state);
    expect(result.settlement.resources.wealth).toBe(20);
    expect(result.company.quotaContributedWealth).toBe(0);
  });
});
