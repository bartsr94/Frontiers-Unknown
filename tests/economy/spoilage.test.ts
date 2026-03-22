import { describe, it, expect } from 'vitest';
import {
  SPOILAGE_CONFIG,
  calculateSpoilage,
  applySpoilage,
} from '../../src/simulation/economy/spoilage';
import type { ResourceStock, BuiltBuilding, ResourceType } from '../../src/simulation/turn/game-state';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeResources(overrides: Partial<ResourceStock> = {}): ResourceStock {
  return {
    food: 0,
    cattle: 0,
    wealth: 0,
    steel: 0,
    lumber: 0,
    stone: 0,
    medicine: 0,
    horses: 0,
    ...overrides,
  };
}

function makeBuilding(defId: BuiltBuilding['defId']): BuiltBuilding {
  return { defId, instanceId: `${defId}_0`, builtTurn: 0, style: null };
}

// ─── SPOILAGE_CONFIG ──────────────────────────────────────────────────────────

describe('SPOILAGE_CONFIG', () => {
  it('steel, lumber, stone have no spoilage (null)', () => {
    expect(SPOILAGE_CONFIG.steel).toBeNull();
    expect(SPOILAGE_CONFIG.lumber).toBeNull();
    expect(SPOILAGE_CONFIG.stone).toBeNull();
  });

  it('food, cattle, horses, medicine, wealth all have a positive base rate', () => {
    for (const key of ['food', 'cattle', 'horses', 'medicine', 'wealth'] as const) {
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

  it('steel, lumber, stone, wealth never spoil (no configuration)', () => {
    const resources = makeResources({ steel: 1000, lumber: 1000, stone: 1000 });
    const losses = calculateSpoilage(resources, 'summer', []);
    expect(losses.steel).toBeUndefined();
    expect(losses.lumber).toBeUndefined();
    expect(losses.stone).toBeUndefined();
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
    const resources = makeResources({ food: 50, wealth: 100 });
    const updated = applySpoilage(resources, { food: 5 });
    expect(updated.wealth).toBe(100);
  });
});

// ─── calculateSpoilage — fill-ratio amplification ────────────────────────────

describe('calculateSpoilage — fill-ratio amplification', () => {
  it('no amplification below 70% fill (50% fill = base rate only)', () => {
    // food=100, cap=200 → fill=0.50 → no amplifier → same as uncapped
    const base = calculateSpoilage(makeResources({ food: 100 }), 'spring', []);
    const withCap = calculateSpoilage(makeResources({ food: 100 }), 'spring', [], { food: 200 });
    expect(withCap.food).toBe(base.food); // both = floor(100*0.05) = 5
  });

  it('×2 amplification at exactly 70% fill', () => {
    // food=140, cap=200 → fill=0.70 → rate=0.05×2=0.10 → actualLoss=14
    const base = calculateSpoilage(makeResources({ food: 140 }), 'spring', []);
    const withCap = calculateSpoilage(makeResources({ food: 140 }), 'spring', [], { food: 200 });
    expect(base.food).toBe(7);   // floor(140*0.05) = 7
    expect(withCap.food).toBe(14); // floor(140*0.10) = 14
  });

  it('×4 amplification at 85% fill', () => {
    // food=170, cap=200 → fill=0.85 → rate=0.05×4=0.20 → actualLoss=34
    const base = calculateSpoilage(makeResources({ food: 170 }), 'spring', []);
    const withCap = calculateSpoilage(makeResources({ food: 170 }), 'spring', [], { food: 200 });
    expect(base.food).toBe(8);   // floor(170*0.05) = 8
    expect(withCap.food).toBe(34); // floor(170*0.20) = 34
  });

  it('×8 amplification at 95% fill', () => {
    // food=190, cap=200 → fill=0.95 → rate=0.05×8=0.40 → actualLoss=76
    const base = calculateSpoilage(makeResources({ food: 190 }), 'spring', []);
    const withCap = calculateSpoilage(makeResources({ food: 190 }), 'spring', [], { food: 200 });
    expect(base.food).toBe(9);   // floor(190*0.05) = 9
    expect(withCap.food).toBe(76); // floor(190*0.40) = 76
  });

  it('resource without a matching cap entry is not amplified', () => {
    // cattle=100 with only a food cap — cattle should not be affected
    const base = calculateSpoilage(makeResources({ cattle: 100 }), 'spring', []);
    const withFoodCap = calculateSpoilage(makeResources({ cattle: 100 }), 'spring', [], { food: 100 });
    expect(withFoodCap.cattle).toBe(base.cattle);
  });

  it('fill ratio is applied independently per resource', () => {
    // food at 95% fill (×8), cattle at 50% fill (no amp)
    const caps: Partial<Record<ResourceType, number>> = { food: 200, cattle: 200 };
    const resources = makeResources({ food: 190, cattle: 100 });
    const result = calculateSpoilage(resources, 'spring', [], caps);
    expect(result.food).toBe(76);  // floor(190*0.40) = 76
    expect(result.cattle).toBe(3); // floor(100*0.03) = 3
  });
});
