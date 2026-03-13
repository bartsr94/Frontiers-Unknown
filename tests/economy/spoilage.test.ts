import { describe, it, expect } from 'vitest';
import {
  SPOILAGE_CONFIG,
  calculateSpoilage,
  applySpoilage,
} from '../../src/simulation/economy/spoilage';
import type { ResourceStock, BuiltBuilding } from '../../src/simulation/turn/game-state';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeResources(overrides: Partial<ResourceStock> = {}): ResourceStock {
  return {
    food: 0,
    cattle: 0,
    goods: 0,
    steel: 0,
    lumber: 0,
    stone: 0,
    medicine: 0,
    gold: 0,
    horses: 0,
    ...overrides,
  };
}

function makeBuilding(defId: BuiltBuilding['defId']): BuiltBuilding {
  return { defId, instanceId: `${defId}_0`, builtTurn: 0, style: null };
}

// ─── SPOILAGE_CONFIG ──────────────────────────────────────────────────────────

describe('SPOILAGE_CONFIG', () => {
  it('steel, lumber, stone, gold have no spoilage (null)', () => {
    expect(SPOILAGE_CONFIG.steel).toBeNull();
    expect(SPOILAGE_CONFIG.lumber).toBeNull();
    expect(SPOILAGE_CONFIG.stone).toBeNull();
    expect(SPOILAGE_CONFIG.gold).toBeNull();
  });

  it('food, cattle, horses, medicine, goods all have a positive base rate', () => {
    for (const key of ['food', 'cattle', 'horses', 'medicine', 'goods'] as const) {
      const cfg = SPOILAGE_CONFIG[key];
      expect(cfg).not.toBeNull();
      expect(cfg!.baseRate).toBeGreaterThan(0);
    }
  });
});

// ─── calculateSpoilage ────────────────────────────────────────────────────────

describe('calculateSpoilage', () => {
  it('returns empty object for zero stock', () => {
    const losses = calculateSpoilage(makeResources(), 'summer', []);
    expect(Object.keys(losses).length).toBe(0);
  });

  it('ignores losses < 1 unit (minimum threshold)', () => {
    // food base rate 5%; 10 food × 5% = 0.5 (< 1). Should be ignored in spring.
    const resources = makeResources({ food: 10 });
    const losses = calculateSpoilage(resources, 'spring', []);
    expect(losses.food).toBeUndefined();
  });

  it('applies food spoilage for a large stock', () => {
    // 100 food × 5% = 5 → loss of 5
    const resources = makeResources({ food: 100 });
    const losses = calculateSpoilage(resources, 'spring', []);
    expect(losses.food).toBe(5);
  });

  it('food has higher spoilage in summer (1.5×)', () => {
    const resources = makeResources({ food: 100 });
    const summerLoss = calculateSpoilage(resources, 'summer', []);
    const springLoss = calculateSpoilage(resources, 'spring', []);
    expect((summerLoss.food ?? 0)).toBeGreaterThan((springLoss.food ?? 0));
  });

  it('cattle has higher spoilage in winter (2.0×)', () => {
    const resources = makeResources({ cattle: 100 });
    const winterLoss = calculateSpoilage(resources, 'winter', []);
    const springLoss = calculateSpoilage(resources, 'spring', []);
    expect((winterLoss.cattle ?? 0)).toBeGreaterThan((springLoss.cattle ?? 0));
  });

  it('horses have higher spoilage in winter (2.0×)', () => {
    const resources = makeResources({ horses: 100 });
    const winterLoss = calculateSpoilage(resources, 'winter', []);
    const springLoss = calculateSpoilage(resources, 'spring', []);
    expect((winterLoss.horses ?? 0)).toBeGreaterThan((springLoss.horses ?? 0));
  });

  it('granary halves food spoilage', () => {
    const resources = makeResources({ food: 200 });
    const withGranary = calculateSpoilage(resources, 'spring', [makeBuilding('granary')]);
    const withoutGranary = calculateSpoilage(resources, 'spring', []);
    expect((withGranary.food ?? 0)).toBeLessThan((withoutGranary.food ?? 0));
  });

  it('stable halves cattle spoilage', () => {
    const resources = makeResources({ cattle: 200 });
    const withStable = calculateSpoilage(resources, 'winter', [makeBuilding('stable')]);
    const withoutStable = calculateSpoilage(resources, 'winter', []);
    expect((withStable.cattle ?? 0)).toBeLessThan((withoutStable.cattle ?? 0));
  });

  it('stable halves horse spoilage', () => {
    const resources = makeResources({ horses: 200 });
    const withStable = calculateSpoilage(resources, 'winter', [makeBuilding('stable')]);
    const withoutStable = calculateSpoilage(resources, 'winter', []);
    expect((withStable.horses ?? 0)).toBeLessThan((withoutStable.horses ?? 0));
  });

  it('steel, lumber, stone, gold never spoil', () => {
    const resources = makeResources({ steel: 1000, lumber: 1000, stone: 1000, gold: 1000 });
    const losses = calculateSpoilage(resources, 'summer', []);
    expect(losses.steel).toBeUndefined();
    expect(losses.lumber).toBeUndefined();
    expect(losses.stone).toBeUndefined();
    expect(losses.gold).toBeUndefined();
  });

  it('loss does not exceed available stock', () => {
    // With 1 unit: 5% of 1 = 0.05 < 1. Should not lose 1 unit (minimum threshold).
    const resources = makeResources({ food: 1 });
    const losses = calculateSpoilage(resources, 'summer', []);
    // Even with summer modifier (7.5% of 1 = 0.075), still < 1
    expect(losses.food).toBeUndefined();
  });

  it('does not return negative losses', () => {
    const resources = makeResources({ medicine: 100 });
    const losses = calculateSpoilage(resources, 'spring', []);
    for (const val of Object.values(losses)) {
      expect(val).toBeGreaterThan(0);
    }
  });
});

// ─── applySpoilage ────────────────────────────────────────────────────────────

describe('applySpoilage', () => {
  it('subtracts spoilage losses from stock', () => {
    const resources = makeResources({ food: 50, cattle: 20 });
    const losses = { food: 3, cattle: 1 };
    const updated = applySpoilage(resources, losses);
    expect(updated.food).toBe(47);
    expect(updated.cattle).toBe(19);
  });

  it('floors at 0 — never goes negative', () => {
    const resources = makeResources({ food: 2 });
    const updated = applySpoilage(resources, { food: 10 });
    expect(updated.food).toBe(0);
  });

  it('does not mutate input', () => {
    const resources = makeResources({ food: 50 });
    applySpoilage(resources, { food: 5 });
    expect(resources.food).toBe(50);
  });

  it('leaves untouched resources unchanged', () => {
    const resources = makeResources({ food: 50, gold: 100 });
    const updated = applySpoilage(resources, { food: 5 });
    expect(updated.gold).toBe(100);
  });
});
