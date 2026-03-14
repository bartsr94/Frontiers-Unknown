/**
 * Tests for the tribes module — createTribe(), updateTribeDisposition(), TRIBE_PRESETS.
 *
 * These are pure-logic tests with no React or UI dependencies.
 */

import { describe, it, expect } from 'vitest';
import { createTribe, updateTribeDisposition, TRIBE_PRESETS } from '../../src/simulation/world/tribes';
import type { TribeConfig } from '../../src/simulation/world/tribes';
import { createRNG } from '../../src/utils/rng';

// ─── Minimal TribeConfig ──────────────────────────────────────────────────────

function makeConfig(overrides: Partial<TribeConfig> = {}): TribeConfig {
  return {
    id: 'test_tribe',
    name: 'Test Tribe',
    ethnicGroup: 'kiswani_riverfolk',
    population: 400,
    startingDisposition: 20,
    traits: ['peaceful', 'trader'],
    desires: ['steel'],
    offerings: ['food'],
    stability: 0.8,
    tradeDesires: ['steel'],
    tradeOfferings: ['food'],
    ...overrides,
  };
}

// ─── createTribe ──────────────────────────────────────────────────────────────

describe('createTribe', () => {
  it('copies all scalar fields from config', () => {
    const config = makeConfig({ id: 'tribe_x', name: 'X Tribe', population: 300, stability: 0.6 });
    const tribe = createTribe(config);
    expect(tribe.id).toBe('tribe_x');
    expect(tribe.name).toBe('X Tribe');
    expect(tribe.population).toBe(300);
    expect(tribe.stability).toBe(0.6);
    expect(tribe.ethnicGroup).toBe('kiswani_riverfolk');
  });

  it('initialises disposition from startingDisposition', () => {
    const tribe = createTribe(makeConfig({ startingDisposition: 35 }));
    expect(tribe.disposition).toBe(35);
  });

  it('initialises contactEstablished to false', () => {
    expect(createTribe(makeConfig()).contactEstablished).toBe(false);
  });

  it('initialises lastTradeTurn to null', () => {
    expect(createTribe(makeConfig()).lastTradeTurn).toBeNull();
  });

  it('initialises tradeHistoryCount to 0', () => {
    expect(createTribe(makeConfig()).tradeHistoryCount).toBe(0);
  });

  it('copies arrays by value — mutations to tribe do not affect config', () => {
    const config = makeConfig({ traits: ['peaceful'] });
    const tribe  = createTribe(config);
    tribe.traits.push('warlike');
    expect(config.traits).toEqual(['peaceful']);
  });

  it('copies tradeDesires and tradeOfferings', () => {
    const config = makeConfig({ tradeDesires: ['steel', 'medicine'], tradeOfferings: ['food', 'gold'] });
    const tribe  = createTribe(config);
    expect(tribe.tradeDesires).toEqual(['steel', 'medicine']);
    expect(tribe.tradeOfferings).toEqual(['food', 'gold']);
  });
});

// ─── updateTribeDisposition ───────────────────────────────────────────────────

describe('updateTribeDisposition', () => {
  const rng = createRNG(1);

  it('decrements positive disposition by 1 per call', () => {
    const tribe = createTribe(makeConfig({ startingDisposition: 30 }));
    const next = updateTribeDisposition(tribe, null, rng);
    expect(next).toBe(29);
  });

  it('increments negative disposition by 1 per call (decay toward 0)', () => {
    const tribe = createTribe(makeConfig({ startingDisposition: -20 }));
    const next = updateTribeDisposition(tribe, null, rng);
    expect(next).toBe(-19);
  });

  it('holds at 0 when disposition is already 0', () => {
    const tribe = createTribe(makeConfig({ startingDisposition: 0 }));
    const next = updateTribeDisposition(tribe, null, rng);
    expect(next).toBe(0);
  });

  it('returns a number, not a modified tribe object', () => {
    const tribe = createTribe(makeConfig({ startingDisposition: 5 }));
    const result = updateTribeDisposition(tribe, null, rng);
    expect(typeof result).toBe('number');
  });

  it('does not mutate the original tribe', () => {
    const tribe = createTribe(makeConfig({ startingDisposition: 10 }));
    updateTribeDisposition(tribe, null, rng);
    expect(tribe.disposition).toBe(10);
  });
});

// ─── TRIBE_PRESETS ─────────────────────────────────────────────────────────────

describe('TRIBE_PRESETS', () => {
  it('contains at least 16 presets', () => {
    expect(Object.keys(TRIBE_PRESETS).length).toBeGreaterThanOrEqual(16);
  });

  it('every preset has a unique id matching its key', () => {
    for (const [key, config] of Object.entries(TRIBE_PRESETS)) {
      expect(config.id).toBe(key);
    }
  });

  it('every preset disposition is within [-100, 100]', () => {
    for (const config of Object.values(TRIBE_PRESETS)) {
      expect(config.startingDisposition).toBeGreaterThanOrEqual(-100);
      expect(config.startingDisposition).toBeLessThanOrEqual(100);
    }
  });

  it('every preset stability is within [0, 1]', () => {
    for (const config of Object.values(TRIBE_PRESETS)) {
      expect(config.stability).toBeGreaterThanOrEqual(0);
      expect(config.stability).toBeLessThanOrEqual(1);
    }
  });

  it('every preset can be instantiated via createTribe without errors', () => {
    for (const config of Object.values(TRIBE_PRESETS)) {
      expect(() => createTribe(config)).not.toThrow();
    }
  });

  it('includes expected named presets', () => {
    expect(TRIBE_PRESETS).toHaveProperty('njaro_matu_riverfolk');
    expect(TRIBE_PRESETS).toHaveProperty('candibula_host');
    expect(TRIBE_PRESETS).toHaveProperty('red_moon_raiders');
  });

  it('at least two presets per Sauromatian ethnic group', () => {
    const groups = ['kiswani_riverfolk', 'kiswani_bayuk', 'kiswani_haisla',
                    'hanjoda_stormcaller', 'hanjoda_bloodmoon', 'hanjoda_talon', 'hanjoda_emrasi'];
    for (const group of groups) {
      const count = Object.values(TRIBE_PRESETS).filter(c => c.ethnicGroup === group).length;
      expect(count).toBeGreaterThanOrEqual(2);
    }
  });
});
