import { describe, it, expect } from 'vitest';
import {
  RESOURCE_BASE_VALUES,
  getTribeDispositionMultiplier,
  getTradeValue,
  calculateDispositionDelta,
  validateTrade,
  executeTribeTradeLogic,
  type TradeOffer,
} from '../../src/simulation/economy/trade';
import type { ExternalTribe, ResourceStock } from '../../src/simulation/turn/game-state';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTribe(overrides: Partial<ExternalTribe> = {}): ExternalTribe {
  return {
    id: 'tribe_test',
    name: 'Test Tribe',
    ethnicGroup: 'kiswani_riverfolk',
    population: 100,
    disposition: 60,
    stability: 3,
    contactEstablished: true,
    lastTradeTurn: null,
    tradeHistoryCount: 0,
    tradeDesires: ['steel', 'medicine'],
    tradeOfferings: ['food', 'horses'],
    desires: [],
    offerings: [],
    traits: [],
    ...overrides,
  };
}

function makeResources(overrides: Partial<ResourceStock> = {}): ResourceStock {
  return {
    food: 20,
    cattle: 10,
    goods: 15,
    steel: 8,
    lumber: 30,
    stone: 25,
    medicine: 5,
    gold: 10,
    horses: 4,
    ...overrides,
  };
}

// ─── RESOURCE_BASE_VALUES ─────────────────────────────────────────────────────

describe('RESOURCE_BASE_VALUES', () => {
  it('covers all 9 resource types', () => {
    const expected: Array<keyof ResourceStock> = [
      'food', 'cattle', 'goods', 'steel', 'lumber', 'stone', 'medicine', 'gold', 'horses',
    ];
    for (const key of expected) {
      expect(RESOURCE_BASE_VALUES[key]).toBeGreaterThan(0);
    }
  });

  it('gold is the most valuable single resource', () => {
    const maxNonGold = Math.max(
      ...(['food', 'cattle', 'goods', 'steel', 'lumber', 'stone', 'medicine', 'horses'] as const)
        .map(r => RESOURCE_BASE_VALUES[r])
    );
    expect(RESOURCE_BASE_VALUES.gold).toBeGreaterThanOrEqual(maxNonGold);
  });
});

// ─── getTribeDispositionMultiplier ────────────────────────────────────────────

describe('getTribeDispositionMultiplier', () => {
  it('≥ 70 → 1.2', () => {
    expect(getTribeDispositionMultiplier(70)).toBe(1.2);
    expect(getTribeDispositionMultiplier(100)).toBe(1.2);
  });

  it('40–69 → 1.0', () => {
    expect(getTribeDispositionMultiplier(40)).toBe(1.0);
    expect(getTribeDispositionMultiplier(60)).toBe(1.0);
  });

  it('< 40 → 0.8', () => {
    expect(getTribeDispositionMultiplier(39)).toBe(0.8);
    expect(getTribeDispositionMultiplier(0)).toBe(0.8);
  });
});

// ─── getTradeValue ────────────────────────────────────────────────────────────

describe('getTradeValue', () => {
  it('empty offer returns 0', () => {
    const tribe = makeTribe();
    expect(getTradeValue({}, tribe, 'player')).toBe(0);
    expect(getTradeValue({}, tribe, 'tribe')).toBe(0);
  });

  it('basic value: 4 food × 0.5 = 2.0 gold-equiv (player side)', () => {
    const tribe = makeTribe({ tradeDesires: [] });
    expect(getTradeValue({ food: 4 }, tribe, 'player')).toBeCloseTo(2.0);
  });

  it('tribe desires apply 10% bonus on player side', () => {
    const tribe = makeTribe({ tradeDesires: ['steel'] });
    // steel base = 1.0; with 10% desire bonus = 1.1; qty=2 → 2.2
    expect(getTradeValue({ steel: 2 }, tribe, 'player')).toBeCloseTo(2.2);
  });

  it('disposition multiplier applies on tribe side', () => {
    const tribe = makeTribe({ disposition: 80 }); // multiplier = 1.2
    // food base = 0.5; × 1.2 = 0.6; qty=4 → 2.4
    expect(getTradeValue({ food: 4 }, tribe, 'tribe')).toBeCloseTo(2.4);
  });

  it('zero quantity entries are ignored', () => {
    const tribe = makeTribe();
    expect(getTradeValue({ food: 0, gold: 0 }, tribe, 'player')).toBe(0);
  });
});

// ─── calculateDispositionDelta ────────────────────────────────────────────────

describe('calculateDispositionDelta', () => {
  it('fair trade (ratio ≈ 1.0) gives positive delta', () => {
    const delta = calculateDispositionDelta(10, 10, 0);
    expect(delta).toBeGreaterThan(0);
  });

  it('severely exploitative trade (ratio > 1.3) gives negative delta', () => {
    const delta = calculateDispositionDelta(20, 5, 0); // ratio = 4
    expect(delta).toBeLessThan(0);
  });

  it('generous trade (ratio < 0.7) gives higher positive delta', () => {
    const generous = calculateDispositionDelta(5, 20, 0); // ratio = 0.25
    const fair = calculateDispositionDelta(10, 10, 0);
    expect(generous).toBeGreaterThan(fair);
  });

  it('trade history bonus increases with history count', () => {
    const noHistory = calculateDispositionDelta(10, 10, 0);
    const withHistory = calculateDispositionDelta(10, 10, 10);
    expect(withHistory).toBeGreaterThan(noHistory);
  });

  it('trade history bonus capped at +5', () => {
    const bigHistory = calculateDispositionDelta(10, 10, 100);
    const maxExpected = 2 + 5; // fair trade delta + max bonus
    expect(bigHistory).toBeLessThanOrEqual(maxExpected);
  });

  it('tribeValue ≤ 0 returns penalty', () => {
    const delta = calculateDispositionDelta(10, 0, 0);
    expect(delta).toBeLessThan(0);
  });
});

// ─── validateTrade ────────────────────────────────────────────────────────────

describe('validateTrade', () => {
  it('returns ok:true for a valid trade', () => {
    const tribe = makeTribe({ tradeOfferings: ['food'] });
    const result = validateTrade(
      { goods: 3 },
      { food: 5 },
      makeResources({ goods: 10 }),
      tribe,
      5,
    );
    expect(result.ok).toBe(true);
  });

  it('fails when contact not established', () => {
    const tribe = makeTribe({ contactEstablished: false });
    const result = validateTrade({ goods: 2 }, { food: 3 }, makeResources(), tribe, 1);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBeTruthy();
  });

  it('fails when disposition < 20', () => {
    const tribe = makeTribe({ disposition: 15 });
    const result = validateTrade({ goods: 2 }, { food: 3 }, makeResources(), tribe, 1);
    expect(result.ok).toBe(false);
  });

  it('fails when already traded this turn', () => {
    const tribe = makeTribe({ lastTradeTurn: 3 });
    const result = validateTrade({ goods: 2 }, { food: 3 }, makeResources(), tribe, 3);
    expect(result.ok).toBe(false);
  });

  it('fails when both sides are empty', () => {
    const tribe = makeTribe();
    const result = validateTrade({}, {}, makeResources(), tribe, 1);
    expect(result.ok).toBe(false);
  });

  it('fails when player lacks resources', () => {
    const tribe = makeTribe({ tradeOfferings: ['food'] });
    const result = validateTrade(
      { gold: 100 },
      { food: 5 },
      makeResources({ gold: 2 }),
      tribe,
      1,
    );
    expect(result.ok).toBe(false);
  });

  it('fails when requesting resource tribe does not offer', () => {
    const tribe = makeTribe({ tradeOfferings: ['food'] }); // no horses
    const result = validateTrade(
      { goods: 3 },
      { horses: 2 },
      makeResources(),
      tribe,
      1,
    );
    expect(result.ok).toBe(false);
  });
});

// ─── executeTribeTradeLogic ───────────────────────────────────────────────────

describe('executeTribeTradeLogic', () => {
  it('deducts player offer and adds requested resources', () => {
    const tribe = makeTribe();
    const resources = makeResources({ goods: 10, food: 5 });
    const result = executeTribeTradeLogic(resources, { goods: 3 }, { food: 8 }, tribe, 7);
    expect(result.newResources.goods).toBe(7);
    expect(result.newResources.food).toBe(13);
  });

  it('records tradeTurn correctly', () => {
    const tribe = makeTribe();
    const result = executeTribeTradeLogic(makeResources(), { goods: 2 }, { food: 3 }, tribe, 12);
    expect(result.tradeTurn).toBe(12);
  });

  it('increments tradeHistoryCount', () => {
    const tribe = makeTribe({ tradeHistoryCount: 4 });
    const result = executeTribeTradeLogic(makeResources(), { goods: 2 }, { food: 3 }, tribe, 5);
    expect(result.newTradeHistoryCount).toBe(5);
  });

  it('fair trade produces positive dispositionDelta', () => {
    const tribe = makeTribe({ disposition: 60 });
    // goods: value=2, food: value=1.5 (no multiplier) — roughly fair
    const result = executeTribeTradeLogic(makeResources(), { goods: 2 }, { food: 4 }, tribe, 1);
    expect(result.dispositionDelta).toBeGreaterThan(0);
  });

  it('does not mutate input resources', () => {
    const tribe = makeTribe();
    const resources = makeResources({ goods: 10 });
    const originalGoods = resources.goods;
    executeTribeTradeLogic(resources, { goods: 5 }, { food: 8 }, tribe, 1);
    expect(resources.goods).toBe(originalGoods);
  });
});
