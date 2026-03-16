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
import type { Settlement, BuiltBuilding } from '../../src/simulation/turn/game-state';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Minimal settlement stub — only the resources field is used by the functions. */
function makeSettlement(cattle = 0, buildings: BuiltBuilding[] = []): Settlement {
  return {
    name:            'Test',
    location:        'marsh',
    buildings,
    populationCount: 0,
    resources: {
      food: 0, cattle, goods: 0, steel: 0,
      lumber: 0, stone: 0, medicine: 0, gold: 0, horses: 0,
    },
  } as unknown as Settlement;
}

/** Minimal BuiltBuilding stub for use in tests. */
function makeBuilding(defId: BuiltBuilding['defId']): BuiltBuilding {
  return { defId, instanceId: `${defId}_0`, builtTurn: 1, style: null, claimedByPersonIds: [], ownerHouseholdId: null, assignedWorkerIds: [] };
}

/** Minimal person stub — only the role field is read by calculateProduction. */
function makePerson(role: Person['role']): Person {
  return { role } as unknown as Person;
}

/** Person stub with explicit base skills for gather-role tests. */
function makePersonWithSkill(role: Person['role'], plants: number, custom: number): Person {
  return {
    role,
    skills: {
      animals:    25,
      bargaining: 25,
      combat:     25,
      custom,
      leadership: 25,
      plants,
    },
  } as unknown as Person;
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

describe('calculateProduction — farmers (no Fields building)', () => {
  it('produces 1 food per farmer in spring without Fields (×1.0)', () => {
    const people = makePopulation(['farmer']);
    const result = calculateProduction(people, makeSettlement(), 'spring');
    expect(result.food).toBe(1);
  });

  it('applies the summer food multiplier (×1.2), floors result', () => {
    const people = makePopulation(['farmer']);
    const result = calculateProduction(people, makeSettlement(), 'summer');
    // Math.floor(1 * 1.2) = 1
    expect(result.food).toBe(1);
  });

  it('applies the autumn food multiplier (×1.6), floors result', () => {
    const people = makePopulation(['farmer']);
    const result = calculateProduction(people, makeSettlement(), 'autumn');
    // Math.floor(1 * 1.6) = 1
    expect(result.food).toBe(1);
  });

  it('produces 0 food per farmer in winter without Fields (×0.4)', () => {
    const people = makePopulation(['farmer']);
    const result = calculateProduction(people, makeSettlement(), 'winter');
    // Math.floor(1 * 0.4) = 0
    expect(result.food).toBe(0);
  });

  it('scales linearly with multiple farmers', () => {
    const people = makePopulation(['farmer', 'farmer', 'farmer']);
    const result = calculateProduction(people, makeSettlement(), 'spring');
    expect(result.food).toBe(3);
  });
});

describe('calculateProduction — farmers with Tilled Fields', () => {
  const withFields = () => makeSettlement(0, [makeBuilding('fields')]);

  it('produces 3 food per farmer in spring (base 1 + fields +2)', () => {
    const people = makePopulation(['farmer']);
    const result = calculateProduction(people, withFields(), 'spring');
    expect(result.food).toBe(3);
  });

  it('applies the autumn multiplier to full farm output (×1.6)', () => {
    const people = makePopulation(['farmer']);
    const result = calculateProduction(people, withFields(), 'autumn');
    // Math.floor(3 * 1.6) = Math.floor(4.8) = 4
    expect(result.food).toBe(4);
  });

  it('produces 1 food in winter with fields (×0.4)', () => {
    const people = makePopulation(['farmer']);
    const result = calculateProduction(people, withFields(), 'winter');
    // Math.floor(3 * 0.4) = Math.floor(1.2) = 1
    expect(result.food).toBe(1);
  });

  it('scales linearly with multiple farmers', () => {
    const people = makePopulation(['farmer', 'farmer', 'farmer']);
    const result = calculateProduction(people, withFields(), 'spring');
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
    const people = makePopulation(['farmer']); // +1 food (no fields)
    const result = calculateProduction(people, makeSettlement(4), 'spring'); // +2 cattle bonus
    expect(result.food).toBe(3);
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

// ─── gather_food ─────────────────────────────────────────────────────────────

describe('calculateProduction — gather_food', () => {
  it('produces 1 food with low plants skill (<26), spring ×1.0', () => {
    const map = new Map([['p0', makePersonWithSkill('gather_food', 10, 25)]]);
    const result = calculateProduction(map, makeSettlement(), 'spring');
    expect(result.food).toBe(1);
  });

  it('produces 2 food with Good plants skill (26+), spring ×1.0', () => {
    const map = new Map([['p0', makePersonWithSkill('gather_food', 26, 25)]]);
    const result = calculateProduction(map, makeSettlement(), 'spring');
    expect(result.food).toBe(2);
  });

  it('produces 3 food with Excellent plants skill (63+), spring ×1.0', () => {
    const map = new Map([['p0', makePersonWithSkill('gather_food', 63, 25)]]);
    const result = calculateProduction(map, makeSettlement(), 'spring');
    expect(result.food).toBe(3);
  });

  it('applies seasonal food multiplier (autumn ×1.6)', () => {
    // Excellent skill → 3 base; Math.floor(3 * 1.6) = 4
    const map = new Map([['p0', makePersonWithSkill('gather_food', 63, 25)]]);
    const result = calculateProduction(map, makeSettlement(), 'autumn');
    expect(result.food).toBe(4);
  });

  it('applies seasonal food multiplier (winter ×0.4)', () => {
    // Good skill → 2 base; Math.floor(2 * 0.4) = 0
    const map = new Map([['p0', makePersonWithSkill('gather_food', 26, 25)]]);
    const result = calculateProduction(map, makeSettlement(), 'winter');
    expect(result.food).toBe(0);
  });

  it('produces 0 stone and 0 lumber', () => {
    const map = new Map([['p0', makePersonWithSkill('gather_food', 63, 63)]]);
    const result = calculateProduction(map, makeSettlement(), 'spring');
    expect(result.stone).toBe(0);
    expect(result.lumber).toBe(0);
  });
});

// ─── gather_stone ─────────────────────────────────────────────────────────────

describe('calculateProduction — gather_stone', () => {
  it('produces 1 stone with low custom skill (<26)', () => {
    const map = new Map([['p0', makePersonWithSkill('gather_stone', 25, 10)]]);
    const result = calculateProduction(map, makeSettlement(), 'spring');
    expect(result.stone).toBe(1);
  });

  it('produces 2 stone with Good custom skill (26+)', () => {
    const map = new Map([['p0', makePersonWithSkill('gather_stone', 25, 26)]]);
    const result = calculateProduction(map, makeSettlement(), 'spring');
    expect(result.stone).toBe(2);
  });

  it('produces 3 stone with Excellent custom skill (63+)', () => {
    const map = new Map([['p0', makePersonWithSkill('gather_stone', 25, 63)]]);
    const result = calculateProduction(map, makeSettlement(), 'spring');
    expect(result.stone).toBe(3);
  });

  it('is NOT seasonally scaled — same yield in autumn and winter', () => {
    const map = new Map([['p0', makePersonWithSkill('gather_stone', 25, 26)]]);
    const autumn = calculateProduction(map, makeSettlement(), 'autumn');
    const winter = calculateProduction(map, makeSettlement(), 'winter');
    expect(autumn.stone).toBe(2);
    expect(winter.stone).toBe(2);
  });

  it('scales linearly with multiple quarriers', () => {
    const map = new Map<string, Person>([
      ['p0', makePersonWithSkill('gather_stone', 25, 63)],
      ['p1', makePersonWithSkill('gather_stone', 25, 26)],
      ['p2', makePersonWithSkill('gather_stone', 25, 10)],
    ]);
    const result = calculateProduction(map, makeSettlement(), 'spring');
    expect(result.stone).toBe(6); // 3 + 2 + 1
  });

  it('produces 0 food and 0 lumber', () => {
    const map = new Map([['p0', makePersonWithSkill('gather_stone', 63, 63)]]);
    const result = calculateProduction(map, makeSettlement(), 'spring');
    expect(result.food).toBe(0);
    expect(result.lumber).toBe(0);
  });
});

// ─── gather_lumber ────────────────────────────────────────────────────────────

describe('calculateProduction — gather_lumber', () => {
  it('produces 1 lumber with low custom skill (<26)', () => {
    const map = new Map([['p0', makePersonWithSkill('gather_lumber', 25, 10)]]);
    const result = calculateProduction(map, makeSettlement(), 'spring');
    expect(result.lumber).toBe(1);
  });

  it('produces 2 lumber with Good custom skill (26+)', () => {
    const map = new Map([['p0', makePersonWithSkill('gather_lumber', 25, 26)]]);
    const result = calculateProduction(map, makeSettlement(), 'spring');
    expect(result.lumber).toBe(2);
  });

  it('produces 3 lumber with Excellent custom skill (63+)', () => {
    const map = new Map([['p0', makePersonWithSkill('gather_lumber', 25, 63)]]);
    const result = calculateProduction(map, makeSettlement(), 'spring');
    expect(result.lumber).toBe(3);
  });

  it('is NOT seasonally scaled — same yield in autumn and winter', () => {
    const map = new Map([['p0', makePersonWithSkill('gather_lumber', 25, 26)]]);
    const autumn = calculateProduction(map, makeSettlement(), 'autumn');
    const winter = calculateProduction(map, makeSettlement(), 'winter');
    expect(autumn.lumber).toBe(2);
    expect(winter.lumber).toBe(2);
  });

  it('produces 0 food and 0 stone', () => {
    const map = new Map([['p0', makePersonWithSkill('gather_lumber', 63, 63)]]);
    const result = calculateProduction(map, makeSettlement(), 'spring');
    expect(result.food).toBe(0);
    expect(result.stone).toBe(0);
  });
});

// ─── guard (still 0 production) ───────────────────────────────────────────────

describe('calculateProduction — guard produces nothing', () => {
  it('guard with any skills produces 0 of all resources', () => {
    const map = new Map([['p0', makePersonWithSkill('guard', 99, 99)]]);
    const result = calculateProduction(map, makeSettlement(), 'spring');
    for (const value of Object.values(result)) {
      expect(value).toBe(0);
    }
  });
});
// ─── Specialisation roles ─────────────────────────────────────────────────────

describe('calculateProduction — blacksmith (smithy)', () => {
  it('with a smithy: produces 2 steel + 1 goods in spring', () => {
    const map = new Map([['p0', makePerson('blacksmith')]]);
    const result = calculateProduction(map, makeSettlement(0, [makeBuilding('smithy')]), 'spring');
    expect(result.steel).toBe(2);
    expect(result.goods).toBe(1);
  });

  it('without a smithy: produces 0 steel and 0 goods', () => {
    const map = new Map([['p0', makePerson('blacksmith')]]);
    const result = calculateProduction(map, makeSettlement(), 'spring');
    expect(result.steel).toBe(0);
    expect(result.goods).toBe(0);
  });

  it('steel is not seasonally scaled (autumn ×1.6 has no effect on steel)', () => {
    const map = new Map([['p0', makePerson('blacksmith')]]);
    const spring = calculateProduction(map, makeSettlement(0, [makeBuilding('smithy')]), 'spring');
    const autumn = calculateProduction(map, makeSettlement(0, [makeBuilding('smithy')]), 'autumn');
    expect(spring.steel).toBe(2);
    expect(autumn.steel).toBe(2);
  });

  it('goods ARE scaled by the goods seasonal multiplier (summer ×1.3)', () => {
    // 2 blacksmiths → personGoods = 2; Math.floor(2 * 1.3) = 2
    // Use 4 so the rounding is visible: Math.floor(4 * 1.3) = 5
    const map = new Map(
      Array.from({ length: 4 }, (_, i) => [`p${i}`, makePerson('blacksmith')])
    );
    const summer = calculateProduction(map, makeSettlement(0, [makeBuilding('smithy')]), 'summer');
    expect(summer.goods).toBe(5); // Math.floor(4 * 1.3)
  });
});

describe('calculateProduction — tailor (tannery)', () => {
  it('with a tannery: produces 3 goods in spring', () => {
    const map = new Map([['p0', makePerson('tailor')]]);
    const result = calculateProduction(map, makeSettlement(0, [makeBuilding('tannery')]), 'spring');
    expect(result.goods).toBe(3);
  });

  it('without a tannery: produces 0 goods', () => {
    const map = new Map([['p0', makePerson('tailor')]]);
    const result = calculateProduction(map, makeSettlement(), 'spring');
    expect(result.goods).toBe(0);
  });
});

describe('calculateProduction — brewer (brewery)', () => {
  it('with a brewery: produces 2 goods in spring', () => {
    const map = new Map([['p0', makePerson('brewer')]]);
    const result = calculateProduction(map, makeSettlement(0, [makeBuilding('brewery')]), 'spring');
    expect(result.goods).toBe(2);
  });

  it('without a brewery: produces 0 goods', () => {
    const map = new Map([['p0', makePerson('brewer')]]);
    const result = calculateProduction(map, makeSettlement(), 'spring');
    expect(result.goods).toBe(0);
  });
});

describe('calculateProduction — miller (mill)', () => {
  it('with a mill: produces 3 food in spring', () => {
    const map = new Map([['p0', makePerson('miller')]]);
    const result = calculateProduction(map, makeSettlement(0, [makeBuilding('mill')]), 'spring');
    expect(result.food).toBe(3);
  });

  it('miller food is seasonally scaled (autumn ×1.6 → Math.floor(3 × 1.6) = 4)', () => {
    const map = new Map([['p0', makePerson('miller')]]);
    const autumn = calculateProduction(map, makeSettlement(0, [makeBuilding('mill')]), 'autumn');
    expect(autumn.food).toBe(4);
  });

  it('without a mill: produces 0 food', () => {
    const map = new Map([['p0', makePerson('miller')]]);
    const result = calculateProduction(map, makeSettlement(), 'spring');
    expect(result.food).toBe(0);
  });
});

describe('calculateProduction — herder (stable)', () => {
  it('herder personally contributes 0 resources regardless of stable', () => {
    // The stable provides a flatProductionBonus of 1 horse, but that is
    // independent of the herder role.  A standalone herder without a stable
    // produces nothing.
    const map = new Map([['p0', makePerson('herder')]]);
    const result = calculateProduction(map, makeSettlement(), 'spring');
    for (const value of Object.values(result)) {
      expect(value).toBe(0);
    }
  });

  it('stable provides flatProductionBonus of 1 horse regardless of worker role', () => {
    // The horse bonus derives from the building's flatProductionBonus, not the
    // herder role — it fires even without a herder assigned.
    const map = new Map([['p0', makePerson('herder')]]);
    const result = calculateProduction(map, makeSettlement(0, [makeBuilding('stable')]), 'spring');
    expect(result.horses).toBe(1);
  });
});