/**
 * Tests for economy/resources.ts.
 *
 * Covers:
 *   - emptyResourceStock(): returns all-zero stock
 *   - addResourceStocks(): component-wise addition
 *   - clampResourceStock(): negatives become 0, positives unchanged
 *   - calculateProduction(): farmers, traders, cattle, seasonal modifiers
 *   - calculateConsumption(): 1 food per person, regardless of role
 */

import { describe, it, expect } from 'vitest';
import {
  emptyResourceStock,
  addResourceStocks,
  clampResourceStock,
  calculateProduction,
  calculateConsumption,
} from '../../src/simulation/economy/resources';
import type { Person } from '../../src/simulation/population/person';
import type { Settlement } from '../../src/simulation/turn/game-state';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Minimal settlement stub — only the resources field is used by the functions. */
function makeSettlement(cattle = 0): Settlement {
  return {
    name:            'Test',
    location:        'marsh',
    buildings:       [],
    populationCount: 0,
    resources: {
      food: 0, cattle, goods: 0, steel: 0,
      lumber: 0, stone: 0, medicine: 0, gold: 0, horses: 0,
    },
  } as unknown as Settlement;
}

/** Minimal person stub — only the role field is read by calculateProduction. */
function makePerson(role: Person['role']): Person {
  return { role } as unknown as Person;
}

function makePopulation(roles: Person['role'][]): Map<string, Person> {
  const map = new Map<string, Person>();
  roles.forEach((role, i) => map.set(`p${i}`, makePerson(role)));
  return map;
}

// ─── emptyResourceStock ───────────────────────────────────────────────────────

describe('emptyResourceStock', () => {
  it('returns a stock with every resource set to 0', () => {
    const stock = emptyResourceStock();
    for (const value of Object.values(stock)) {
      expect(value).toBe(0);
    }
  });

  it('returns an object with all 9 resource keys', () => {
    const stock = emptyResourceStock();
    const keys = ['food', 'cattle', 'goods', 'steel', 'lumber', 'stone', 'medicine', 'gold', 'horses'];
    for (const key of keys) {
      expect(stock).toHaveProperty(key);
    }
  });
});

// ─── addResourceStocks ────────────────────────────────────────────────────────

describe('addResourceStocks', () => {
  it('sums matching fields from both stocks', () => {
    const a = { ...emptyResourceStock(), food: 30, gold: 10 };
    const b = { ...emptyResourceStock(), food: 20, goods: 5 };
    const result = addResourceStocks(a, b);
    expect(result.food).toBe(50);
    expect(result.gold).toBe(10);
    expect(result.goods).toBe(5);
  });

  it('does not mutate either input', () => {
    const a = { ...emptyResourceStock(), food: 10 };
    const b = { ...emptyResourceStock(), food: 10 };
    addResourceStocks(a, b);
    expect(a.food).toBe(10);
    expect(b.food).toBe(10);
  });

  it('handles all resources being zero', () => {
    const result = addResourceStocks(emptyResourceStock(), emptyResourceStock());
    for (const value of Object.values(result)) {
      expect(value).toBe(0);
    }
  });
});

// ─── clampResourceStock ───────────────────────────────────────────────────────

describe('clampResourceStock', () => {
  it('raises negative values to 0', () => {
    const stock = { ...emptyResourceStock(), food: -10, gold: -5 };
    const result = clampResourceStock(stock);
    expect(result.food).toBe(0);
    expect(result.gold).toBe(0);
  });

  it('leaves positive values unchanged', () => {
    const stock = { ...emptyResourceStock(), food: 100, lumber: 50 };
    const result = clampResourceStock(stock);
    expect(result.food).toBe(100);
    expect(result.lumber).toBe(50);
  });

  it('does not mutate the input', () => {
    const stock = { ...emptyResourceStock(), food: -10 };
    clampResourceStock(stock);
    expect(stock.food).toBe(-10);
  });
});

// ─── calculateProduction ─────────────────────────────────────────────────────

describe('calculateProduction — farmers', () => {
  it('produces 3 food per farmer in spring (×1.0)', () => {
    const people = makePopulation(['farmer']);
    const result = calculateProduction(people, makeSettlement(), 'spring');
    expect(result.food).toBe(3);
  });

  it('applies the summer food multiplier (×1.2), floors result', () => {
    const people = makePopulation(['farmer']);
    const result = calculateProduction(people, makeSettlement(), 'summer');
    // Math.floor(3 * 1.2) = Math.floor(3.6) = 3
    expect(result.food).toBe(3);
  });

  it('applies the autumn food multiplier (×1.6), floors result', () => {
    const people = makePopulation(['farmer']);
    const result = calculateProduction(people, makeSettlement(), 'autumn');
    // Math.floor(3 * 1.6) = Math.floor(4.8) = 4
    expect(result.food).toBe(4);
  });

  it('applies the winter food multiplier (×0.4), floors result', () => {
    const people = makePopulation(['farmer']);
    const result = calculateProduction(people, makeSettlement(), 'winter');
    // Math.floor(3 * 0.4) = Math.floor(1.2) = 1
    expect(result.food).toBe(1);
  });

  it('scales linearly with multiple farmers', () => {
    const people = makePopulation(['farmer', 'farmer', 'farmer']);
    const result = calculateProduction(people, makeSettlement(), 'spring');
    expect(result.food).toBe(9);
  });
});

describe('calculateProduction — traders', () => {
  it('produces 1 goods per trader in spring (×1.0)', () => {
    const people = makePopulation(['trader']);
    const result = calculateProduction(people, makeSettlement(), 'spring');
    expect(result.goods).toBe(1);
  });

  it('applies the summer goods multiplier (×1.3), floors result', () => {
    const people = makePopulation(['trader', 'trader', 'trader']);
    const result = calculateProduction(people, makeSettlement(), 'summer');
    // Math.floor(3 * 1.3) = Math.floor(3.9) = 3
    expect(result.goods).toBe(3);
  });

  it('applies the winter goods multiplier (×0.7), floors result', () => {
    const people = makePopulation(['trader', 'trader', 'trader']);
    const result = calculateProduction(people, makeSettlement(), 'winter');
    // Math.floor(3 * 0.7) = Math.floor(2.1) = 2
    expect(result.goods).toBe(2);
  });

  it('non-producing roles contribute 0', () => {
    const people = makePopulation(['guard', 'craftsman', 'healer', 'unassigned']);
    const result = calculateProduction(people, makeSettlement(), 'spring');
    expect(result.food).toBe(0);
    expect(result.goods).toBe(0);
  });
});

describe('calculateProduction — cattle bonus', () => {
  it('produces 1 food per 2 cattle (spring, ×1.0)', () => {
    const people = new Map<string, Person>();
    const result = calculateProduction(people, makeSettlement(4), 'spring');
    // Math.floor(4 / 2) = 2 cattle bonus
    expect(result.food).toBe(2);
  });

  it('floors the cattle bonus (3 cattle → 1 food, not 1.5)', () => {
    const people = new Map<string, Person>();
    const result = calculateProduction(people, makeSettlement(3), 'spring');
    expect(result.food).toBe(1);
  });

  it('applies seasonal modifier to cattle bonus', () => {
    const people = new Map<string, Person>();
    const result = calculateProduction(people, makeSettlement(4), 'autumn');
    // base cattle bonus = 2; Math.floor(2 * 1.6) = 3
    expect(result.food).toBe(3);
  });

  it('stacks cattle bonus with farmer production', () => {
    const people = makePopulation(['farmer']); // +3 food
    const result = calculateProduction(people, makeSettlement(4), 'spring'); // +2 cattle bonus
    expect(result.food).toBe(5);
  });
});

describe('calculateProduction — empty settlement', () => {
  it('returns zero production with no people and no cattle', () => {
    const people = new Map<string, Person>();
    const result = calculateProduction(people, makeSettlement(0), 'summer');
    expect(result.food).toBe(0);
    expect(result.goods).toBe(0);
  });
});

// ─── calculateConsumption ────────────────────────────────────────────────────

describe('calculateConsumption', () => {
  it('returns -1 food per person', () => {
    const people = makePopulation(['farmer', 'trader', 'guard', 'unassigned', 'healer']);
    const result = calculateConsumption(people);
    expect(result.food).toBe(-5);
  });

  it('returns 0 for all non-food resources', () => {
    const people = makePopulation(['farmer', 'trader']);
    const result = calculateConsumption(people);
    const nonFood = Object.entries(result)
      .filter(([key]) => key !== 'food')
      .map(([, v]) => v);
    for (const value of nonFood) {
      expect(value).toBe(0);
    }
  });
});
