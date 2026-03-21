/**
 * Tests for the wealthAccumulator carry-forward pattern.
 *
 * The turn processor applies this logic each dawn (step 9.6):
 *
 *   const newAcc    = (hh.wealthAccumulator ?? 0) + delta;
 *   const wholeUnits = Math.floor(newAcc);
 *   hh.householdWealth   += wholeUnits;
 *   hh.wealthAccumulator  = newAcc - wholeUnits;
 *
 * This design lets roles with fractional wealth yields (e.g. gather_food = 0.1
 * total → 0.07 personal) accumulate over many seasons before granting whole
 * units of householdWealth.
 *
 * These tests verify the pure accumulator arithmetic in isolation, plus
 * integration with calculateWealthGeneration to confirm the expected
 * per-role delta values flow correctly into the accumulator.
 */

import { describe, it, expect } from 'vitest';
import { calculateWealthGeneration } from '../../src/simulation/economy/resources';
import { createPerson } from '../../src/simulation/population/person';
import type { Person } from '../../src/simulation/population/person';

// ─── Pure accumulator logic (mirrors turn-processor step 9.6) ─────────────────

function applyAccumulator(
  state: { householdWealth: number; wealthAccumulator: number },
  delta: number,
): { householdWealth: number; wealthAccumulator: number } {
  const newAcc     = state.wealthAccumulator + delta;
  const wholeUnits = Math.floor(newAcc);
  return {
    householdWealth:  state.householdWealth + wholeUnits,
    wealthAccumulator: newAcc - wholeUnits,
  };
}

/** Apply N seasons of the same delta continuously. */
function applyAccumulatorN(
  state: { householdWealth: number; wealthAccumulator: number },
  delta: number,
  seasons: number,
): { householdWealth: number; wealthAccumulator: number } {
  let s = state;
  for (let i = 0; i < seasons; i++) s = applyAccumulator(s, delta);
  return s;
}

// ─── Small fractional delta (gather_food personal share ≈ 0.07) ─────────────

describe('wealthAccumulator — fractional delta 0.07 (gather_food personal share)', () => {
  const FORAGER_DELTA = 0.07; // 0.1 total × 0.70 personal share

  it('after 1 season: acc = 0.07, householdWealth still 0', () => {
    const result = applyAccumulator({ householdWealth: 0, wealthAccumulator: 0 }, FORAGER_DELTA);
    expect(result.householdWealth).toBe(0);
    expect(result.wealthAccumulator).toBeCloseTo(0.07);
  });

  it('after 14 seasons: acc < 1.0, householdWealth still 0', () => {
    const result = applyAccumulatorN({ householdWealth: 0, wealthAccumulator: 0 }, FORAGER_DELTA, 14);
    expect(result.householdWealth).toBe(0);
    expect(result.wealthAccumulator).toBeCloseTo(0.98);
  });

  it('after 15 seasons: acc crosses 1.0, householdWealth becomes 1', () => {
    // 15 × 0.07 = 1.05 → 1 whole unit, remaining acc ≈ 0.05
    const result = applyAccumulatorN({ householdWealth: 0, wealthAccumulator: 0 }, FORAGER_DELTA, 15);
    expect(result.householdWealth).toBe(1);
    expect(result.wealthAccumulator).toBeCloseTo(0.05);
  });

  it('after 30 seasons: householdWealth = 2 (two full units)', () => {
    const result = applyAccumulatorN({ householdWealth: 0, wealthAccumulator: 0 }, FORAGER_DELTA, 30);
    expect(result.householdWealth).toBe(2);
  });

  it('existing accumulator = 0.95 + delta 0.07 → grants 1 whole unit on this season', () => {
    const result = applyAccumulator({ householdWealth: 0, wealthAccumulator: 0.95 }, FORAGER_DELTA);
    expect(result.householdWealth).toBe(1);
    expect(result.wealthAccumulator).toBeCloseTo(0.02);
  });
});

// ─── Larger delta (trader personal ≈ 2.1) ───────────────────────────────────

describe('wealthAccumulator — delta 2.1 (trader personal share)', () => {
  const TRADER_DELTA = 2.1; // 3 total × 0.70 personal share

  it('after 1 season: grants 2 whole units immediately, acc = 0.1', () => {
    const result = applyAccumulator({ householdWealth: 0, wealthAccumulator: 0 }, TRADER_DELTA);
    expect(result.householdWealth).toBe(2);
    expect(result.wealthAccumulator).toBeCloseTo(0.1);
  });

  it('after 10 seasons: grants 21 whole units total, acc ≈ 0', () => {
    // 10 × 2.1 = 21.0 exactly (within floating point tolerance)
    const result = applyAccumulatorN({ householdWealth: 0, wealthAccumulator: 0 }, TRADER_DELTA, 10);
    expect(result.householdWealth).toBe(21);
    expect(result.wealthAccumulator).toBeCloseTo(0);
  });

  it('existing acc = 0.9 + delta 2.1 → grants floor(3.0) = 3 units, acc = 0', () => {
    const result = applyAccumulator({ householdWealth: 5, wealthAccumulator: 0.9 }, TRADER_DELTA);
    expect(result.householdWealth).toBe(8);        // 5 + 3
    expect(result.wealthAccumulator).toBeCloseTo(0);
  });
});

// ─── Whole-unit delta (farmer = 0.7 personal share) ─────────────────────────

describe('wealthAccumulator — delta 0.7 (farmer personal share)', () => {
  it('after 1 season: acc = 0.7, wealth still 0', () => {
    const result = applyAccumulator({ householdWealth: 0, wealthAccumulator: 0 }, 0.7);
    expect(result.householdWealth).toBe(0);
    expect(result.wealthAccumulator).toBeCloseTo(0.7);
  });

  it('after 2 seasons: acc crosses 1.0 → 1 whole unit, acc ≈ 0.4', () => {
    const result = applyAccumulatorN({ householdWealth: 0, wealthAccumulator: 0 }, 0.7, 2);
    expect(result.householdWealth).toBe(1);
    expect(result.wealthAccumulator).toBeCloseTo(0.4);
  });
});

// ─── Zero delta ───────────────────────────────────────────────────────────────

describe('wealthAccumulator — zero delta', () => {
  it('applying 0 delta is a no-op', () => {
    const result = applyAccumulator({ householdWealth: 3, wealthAccumulator: 0.5 }, 0);
    expect(result.householdWealth).toBe(3);
    expect(result.wealthAccumulator).toBeCloseTo(0.5);
  });
});

// ─── Integration with calculateWealthGeneration ──────────────────────────────

function makePerson(role: Person['role'], householdId: string): Person {
  const p = createPerson({
    sex: 'male',
    age: 25,
    heritage: {
      bloodline: [{ group: 'imanian', fraction: 1.0 }],
      primaryCulture: 'ansberite',
      culturalFluency: new Map([['ansberite', 1.0]]),
    },
  });
  return { ...p, role, householdId };
}

describe('wealthAccumulator — integration with calculateWealthGeneration', () => {
  it('gather_food personal delta fed through accumulator: 15 seasons → 1 wealth', () => {
    const hhId = 'hh_1';
    const person = makePerson('gather_food', hhId);
    const { householdDeltas } = calculateWealthGeneration(new Map([[person.id, person]]));
    const delta = householdDeltas.get(hhId) ?? 0;

    // Delta should be ~0.07 (0.1 × 0.70)
    expect(delta).toBeCloseTo(0.07, 2);

    // Feed 15 seasons through accumulator
    const result = applyAccumulatorN({ householdWealth: 0, wealthAccumulator: 0 }, delta, 15);
    expect(result.householdWealth).toBe(1);
  });

  it('trader personal delta fed through accumulator: 1 season → 2 wealth + 0.1 acc', () => {
    const hhId = 'hh_2';
    const person = makePerson('trader', hhId);
    const { householdDeltas } = calculateWealthGeneration(new Map([[person.id, person]]));
    const delta = householdDeltas.get(hhId) ?? 0;

    // Delta should be 2.1 (3 × 0.70)
    expect(delta).toBeCloseTo(2.1, 2);

    const result = applyAccumulator({ householdWealth: 0, wealthAccumulator: 0 }, delta);
    expect(result.householdWealth).toBe(2);
    expect(result.wealthAccumulator).toBeCloseTo(0.1);
  });

  it('two gather_food workers in same household: combined delta ~0.14, first whole unit at season 8', () => {
    const hhId = 'hh_3';
    const personA = makePerson('gather_food', hhId);
    const personB = makePerson('gather_food', hhId);
    const people = new Map([[personA.id, personA], [personB.id, personB]]);
    const { householdDeltas } = calculateWealthGeneration(people);
    const delta = householdDeltas.get(hhId) ?? 0;

    // Combined: 2 × 0.07 = 0.14
    expect(delta).toBeCloseTo(0.14, 2);

    // 7 seasons: 0.98 — still 0 wealth
    const after7 = applyAccumulatorN({ householdWealth: 0, wealthAccumulator: 0 }, delta, 7);
    expect(after7.householdWealth).toBe(0);

    // 8 seasons: 1.12 → 1 whole unit
    const after8 = applyAccumulatorN({ householdWealth: 0, wealthAccumulator: 0 }, delta, 8);
    expect(after8.householdWealth).toBe(1);
  });
});
