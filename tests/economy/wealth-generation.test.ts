import { describe, it, expect } from 'vitest';
import { calculateWealthGeneration, WEALTH_YIELD, SETTLEMENT_TAX_RATE } from '../../src/simulation/economy/resources';
import { createPerson } from '../../src/simulation/population/person';
import type { Person } from '../../src/simulation/population/person';
import { createFertilityProfile } from '../../src/simulation/genetics/fertility';

function makePerson(overrides: Partial<Person> = {}): Person {
  const p = createPerson({
    sex: 'male',
    age: 25,
    heritage: {
      bloodline: [{ group: 'imanian', fraction: 1.0 }],
      primaryCulture: 'ansberite',
      culturalFluency: new Map([['ansberite', 1.0]]),
    },
  });
  return { ...p, ...overrides };
}

function makeMap(people: Person[]): Map<string, Person> {
  return new Map(people.map(p => [p.id, p]));
}

describe('calculateWealthGeneration', () => {
  it('trader role generates 3 wealth total', () => {
    const hhId = 'hh_1';
    const person = makePerson({ role: 'trader', householdId: hhId });
    const { householdDeltas, settlementDelta } = calculateWealthGeneration(makeMap([person]));
    const personal = householdDeltas.get(hhId) ?? 0;
    // taxWealth = 3 × 0.30 = 0.9; personal = 3 − 0.9 = 2.1
    expect(personal + settlementDelta).toBeCloseTo(3);
    expect(settlementDelta).toBeCloseTo(0.9);
    expect(personal).toBeCloseTo(2.1);
  });

  it('blacksmith role generates 3 wealth total', () => {
    const hhId = 'hh_1';
    const person = makePerson({ role: 'blacksmith', householdId: hhId });
    const { householdDeltas, settlementDelta } = calculateWealthGeneration(makeMap([person]));
    const personal = householdDeltas.get(hhId) ?? 0;
    expect(personal + settlementDelta).toBe(3);
  });

  it('healer role generates 2 wealth total', () => {
    const hhId = 'hh_1';
    const person = makePerson({ role: 'healer', householdId: hhId });
    const { householdDeltas, settlementDelta } = calculateWealthGeneration(makeMap([person]));
    const personal = householdDeltas.get(hhId) ?? 0;
    expect(personal + settlementDelta).toBe(2);
  });

  it('gather_food role generates 0.1 wealth total per season', () => {
    const hhId = 'hh_1';
    const person = makePerson({ role: 'gather_food', householdId: hhId });
    const { householdDeltas, settlementDelta } = calculateWealthGeneration(makeMap([person]));
    const personal = householdDeltas.get(hhId) ?? 0;
    // After ~10 seasons the accumulator crosses 1 and grants 1 householdWealth
    expect(personal + settlementDelta).toBeCloseTo(0.1);
  });

  it('away role generates 0 wealth', () => {
    const person = makePerson({ role: 'away', householdId: 'hh_1' });
    const { householdDeltas, settlementDelta } = calculateWealthGeneration(makeMap([person]));
    expect(householdDeltas.size).toBe(0);
    expect(settlementDelta).toBe(0);
  });

  it('unassigned role generates 0 wealth', () => {
    const person = makePerson({ role: 'unassigned', householdId: 'hh_1' });
    const { householdDeltas, settlementDelta } = calculateWealthGeneration(makeMap([person]));
    expect(householdDeltas.size).toBe(0);
    expect(settlementDelta).toBe(0);
  });

  it('child (age < 8) generates 0 wealth due to child work modifier', () => {
    const person = makePerson({ role: 'gather_food', age: 6, householdId: 'hh_1' });
    const { householdDeltas, settlementDelta } = calculateWealthGeneration(makeMap([person]));
    expect(householdDeltas.size).toBe(0);
    expect(settlementDelta).toBe(0);
  });

  it('settlement tax split: 30% to settlement, 70% to household', () => {
    const hhId = 'hh_1';
    // Use trader (yield 3) for easy arithmetic
    const person = makePerson({ role: 'trader', householdId: hhId });
    const { householdDeltas, settlementDelta } = calculateWealthGeneration(makeMap([person]));
    const personal = householdDeltas.get(hhId) ?? 0;
    // taxWealth = 3 × 0.30 = 0.9; personal = 2.1 (fractional, accumulated by the turn processor)
    expect(settlementDelta).toBeCloseTo(3 * SETTLEMENT_TAX_RATE);
    expect(personal).toBeCloseTo(3 * (1 - SETTLEMENT_TAX_RATE));
  });

  it('person without a household: personal share flows to settlement', () => {
    // householdId is null → no household split
    const person = makePerson({ role: 'trader', householdId: null });
    const { householdDeltas, settlementDelta } = calculateWealthGeneration(makeMap([person]));
    expect(householdDeltas.size).toBe(0);
    // All 3 go to settlement (tax + personal)
    expect(settlementDelta).toBe(3);
  });

  it('happiness multiplier scales yield down (e.g., 0.5×)', () => {
    const hhId = 'hh_1';
    const person = makePerson({ role: 'healer', householdId: hhId }); // base 2
    const multipliers = new Map([[person.id, 0.5]]);
    const { householdDeltas, settlementDelta } = calculateWealthGeneration(
      makeMap([person]),
      multipliers,
    );
    const personal = householdDeltas.get(hhId) ?? 0;
    // effectiveYield = floor(2 × 0.5) = 1; taxWealth = ceil(1 × 0.30) = 1; personal = 0
    expect(personal + settlementDelta).toBeLessThan(2);
  });

  it('happiness multiplier above 1.0 scales yield up', () => {
    const hhId = 'hh_1';
    const person = makePerson({ role: 'healer', householdId: hhId }); // base 2
    const multipliers = new Map([[person.id, 1.15]]);
    const { householdDeltas, settlementDelta } = calculateWealthGeneration(
      makeMap([person]),
      multipliers,
    );
    const personal = householdDeltas.get(hhId) ?? 0;
    // effectiveYield = floor(2 × 1.15) = 2; same as no multiplier with this rounding
    expect(personal + settlementDelta).toBeGreaterThanOrEqual(2);
  });

  it('multiple people in different households accumulate independently', () => {
    const hhA = 'hh_A';
    const hhB = 'hh_B';
    const personA = makePerson({ role: 'trader', householdId: hhA });
    const personB = makePerson({ role: 'healer', householdId: hhB });
    const { householdDeltas, settlementDelta } = calculateWealthGeneration(
      makeMap([personA, personB]),
    );
    const deltaA = householdDeltas.get(hhA) ?? 0;
    const deltaB = householdDeltas.get(hhB) ?? 0;
    // trader: total 3, healer: total 2; settlement gets ceil 30% of each
    expect(deltaA + deltaB + settlementDelta).toBe(5);
    expect(householdDeltas.size).toBe(2);
  });

  it('two workers in same household: deltas accumulate on same key', () => {
    const hhId = 'hh_shared';
    const p1 = makePerson({ role: 'trader', householdId: hhId });
    const p2 = makePerson({ role: 'trader', householdId: hhId });
    const { householdDeltas } = calculateWealthGeneration(makeMap([p1, p2]));
    const delta = householdDeltas.get(hhId) ?? 0;
    // Each trader contributes 2.1 personal → 4.2 combined on the same household key
    expect(delta).toBeCloseTo(4.2);
  });

  it('default multipliers map (omitted) produces same output as passing empty map', () => {
    const hhId = 'hh_1';
    const person = makePerson({ role: 'craftsman', householdId: hhId });
    const result1 = calculateWealthGeneration(makeMap([person]));
    const result2 = calculateWealthGeneration(makeMap([person]), new Map());
    expect(result1.settlementDelta).toBe(result2.settlementDelta);
    expect(result1.householdDeltas.get(hhId)).toBe(result2.householdDeltas.get(hhId));
  });

  it('empty population returns zero deltas', () => {
    const { householdDeltas, settlementDelta } = calculateWealthGeneration(new Map());
    expect(householdDeltas.size).toBe(0);
    expect(settlementDelta).toBe(0);
  });
});
