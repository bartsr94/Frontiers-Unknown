/**
 * Tests for createInitialState — the game-start factory.
 *
 * Covers:
 *   - 10 founding male settlers are created
 *   - All founders have socialStatus 'founding_member'
 *   - hex map is present with the correct number of cells
 *   - expeditions array starts empty
 *   - Deterministic output with same seed
 *   - Optional Sauromatian women add 3 female settlers
 */

import { describe, it, expect } from 'vitest';
import { createInitialState } from '../../src/simulation/turn/initial-state';
import type { GameConfig } from '../../src/simulation/turn/game-state';
import { HEX_MAP_WIDTH, HEX_MAP_HEIGHT } from '../../src/simulation/world/hex-map';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeConfig(overrides?: Partial<GameConfig>): GameConfig {
  return {
    difficulty: 'normal',
    startingTribes: [],
    startingLocation: 'default',
    ...overrides,
  };
}

// ─── createInitialState ───────────────────────────────────────────────────────

describe('createInitialState — founding settlers', () => {
  it('creates exactly 10 founding male settlers without Sauromatian women', () => {
    const state = createInitialState(makeConfig(), 'Test Settlement', 42);
    expect(state.people.size).toBe(10);
  });

  it('all founders are male', () => {
    const state = createInitialState(makeConfig(), 'Test Settlement', 42);
    for (const person of state.people.values()) {
      expect(person.sex).toBe('male');
    }
  });

  it('all founders have socialStatus founding_member', () => {
    const state = createInitialState(makeConfig(), 'Test Settlement', 42);
    for (const person of state.people.values()) {
      expect(person.socialStatus).toBe('founding_member');
    }
  });

  it('all founders have at least one trait', () => {
    const state = createInitialState(makeConfig(), 'Test Settlement', 42);
    for (const person of state.people.values()) {
      expect(person.traits.length).toBeGreaterThan(0);
    }
  });

  it('creates 13 settlers when Sauromatian women are included', () => {
    const state = createInitialState(
      makeConfig({ includeSauromatianWomen: true, startingTribes: ['kiswani_delta_confederation'] }),
      'Test Settlement',
      42,
    );
    expect(state.people.size).toBe(13);
  });

  it('Sauromatian women have sex female', () => {
    const state = createInitialState(
      makeConfig({ includeSauromatianWomen: true, startingTribes: ['kiswani_delta_confederation'] }),
      'Test Settlement',
      42,
    );
    const women = Array.from(state.people.values()).filter(p => p.sex === 'female');
    expect(women).toHaveLength(3);
  });

  it('Sauromatian women have socialStatus newcomer', () => {
    const state = createInitialState(
      makeConfig({ includeSauromatianWomen: true, startingTribes: ['kiswani_delta_confederation'] }),
      'Test Settlement',
      42,
    );
    const women = Array.from(state.people.values()).filter(p => p.sex === 'female');
    for (const w of women) {
      expect(w.socialStatus).toBe('newcomer');
    }
  });
});

describe('createInitialState — hex map', () => {
  it('generates a hex map with correct cell count', () => {
    const state = createInitialState(makeConfig(), 'Test Settlement', 42);
    expect(state.hexMap).toBeDefined();
    expect(state.hexMap!.cells.size).toBe(HEX_MAP_WIDTH * HEX_MAP_HEIGHT);
  });

  it('hex map cells is a Map', () => {
    const state = createInitialState(makeConfig(), 'Test Settlement', 42);
    expect(state.hexMap!.cells).toBeInstanceOf(Map);
  });
});

describe('createInitialState — expeditions', () => {
  it('starts with an empty expeditions array', () => {
    const state = createInitialState(makeConfig(), 'Test Settlement', 42);
    expect(state.expeditions).toEqual([]);
  });
});

describe('createInitialState — council', () => {
  it('seeds the council with 5 members', () => {
    const state = createInitialState(makeConfig(), 'Test Settlement', 42);
    expect(state.councilMemberIds).toHaveLength(5);
  });

  it('all council members exist in state.people', () => {
    const state = createInitialState(makeConfig(), 'Test Settlement', 42);
    for (const id of state.councilMemberIds) {
      expect(state.people.has(id)).toBe(true);
    }
  });
});

describe('createInitialState — determinism', () => {
  it('produces identical output for the same seed', () => {
    const s1 = createInitialState(makeConfig(), 'Settlement A', 99);
    const s2 = createInitialState(makeConfig(), 'Settlement A', 99);
    const names1 = Array.from(s1.people.values()).map(p => p.firstName).sort();
    const names2 = Array.from(s2.people.values()).map(p => p.firstName).sort();
    expect(names1).toEqual(names2);
  });

  it('produces different output for different seeds', () => {
    const s1 = createInitialState(makeConfig(), 'Settlement', 1);
    const s2 = createInitialState(makeConfig(), 'Settlement', 9999);
    const names1 = Array.from(s1.people.values()).map(p => p.firstName).sort().join(',');
    const names2 = Array.from(s2.people.values()).map(p => p.firstName).sort().join(',');
    // Different seeds should (with overwhelming probability) produce different names
    expect(names1).not.toBe(names2);
  });
});
