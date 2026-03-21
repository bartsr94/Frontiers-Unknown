/**
 * Tests for the tribes module — createTribe(), updateTribeDisposition(), TRIBE_PRESETS.
 *
 * These are pure-logic tests with no React or UI dependencies.
 */

import { describe, it, expect } from 'vitest';
import { createTribe, updateTribeDisposition, TRIBE_PRESETS } from '../../src/simulation/world/tribes';
import type { TribeConfig } from '../../src/simulation/world/tribes';
import type { EthnicGroup } from '../../src/simulation/population/person';
import { createRNG } from '../../src/utils/rng';

// ─── Color-family lookup (mirrors SAUROMATIAN_TRIBES.md §2) ──────────────────

const ETHNIC_COLOR_PREFIXES: Record<EthnicGroup, string[]> = {
  kiswani_riverfolk:   ['Black', 'Blue', 'Dark'],
  kiswani_bayuk:       ['Green', 'Jade', 'Moss'],
  kiswani_haisla:      ['Grey', 'Silver', 'Salt'],
  hanjoda_stormcaller: ['Ash', 'White', 'Pale'],
  hanjoda_bloodmoon:   ['Red', 'Ochre', 'Crimson'],
  hanjoda_talon:       ['Amber', 'Gold', 'Gilt'],
  hanjoda_emrasi:      ['Bronze', 'Brown', 'Copper'],
};

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
    expect(TRIBE_PRESETS).toHaveProperty('bluetide');
    expect(TRIBE_PRESETS).toHaveProperty('ashmantle');
    expect(TRIBE_PRESETS).toHaveProperty('redmoon');
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

// ─── Naming convention ────────────────────────────────────────────────────────

describe('TRIBE_PRESETS — naming convention', () => {
  it('every name is a single closed compound word (no spaces or hyphens)', () => {
    for (const config of Object.values(TRIBE_PRESETS)) {
      expect(config.name).not.toMatch(/[\s-]/);
    }
  });

  it('every name starts with an uppercase letter (PascalCase)', () => {
    for (const config of Object.values(TRIBE_PRESETS)) {
      expect(config.name[0]).toMatch(/[A-Z]/);
    }
  });

  it('every id is the lowercase form of the name', () => {
    for (const config of Object.values(TRIBE_PRESETS)) {
      expect(config.id).toBe(config.name.toLowerCase());
    }
  });

  it('no two presets share the same display name', () => {
    const names = Object.values(TRIBE_PRESETS).map(c => c.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });
});

// ─── Color-family enforcement ─────────────────────────────────────────────────

describe('TRIBE_PRESETS — ethnic color families', () => {
  it('every preset name begins with a color from its ethnic group palette', () => {
    for (const config of Object.values(TRIBE_PRESETS)) {
      const allowed = ETHNIC_COLOR_PREFIXES[config.ethnicGroup];
      const startsWithValidColor = allowed.some(color =>
        config.name.startsWith(color),
      );
      expect(
        startsWithValidColor,
        `"${config.name}" (${config.ethnicGroup}) must start with one of: ${allowed.join(', ')}`,
      ).toBe(true);
    }
  });

  it('kiswani_riverfolk tribes use Black / Blue / Dark prefix', () => {
    const tribes = Object.values(TRIBE_PRESETS).filter(c => c.ethnicGroup === 'kiswani_riverfolk');
    for (const t of tribes) {
      expect(['Black', 'Blue', 'Dark'].some(p => t.name.startsWith(p))).toBe(true);
    }
  });

  it('kiswani_bayuk tribes use Green / Jade / Moss prefix', () => {
    const tribes = Object.values(TRIBE_PRESETS).filter(c => c.ethnicGroup === 'kiswani_bayuk');
    for (const t of tribes) {
      expect(['Green', 'Jade', 'Moss'].some(p => t.name.startsWith(p))).toBe(true);
    }
  });

  it('kiswani_haisla tribes use Grey / Silver / Salt prefix', () => {
    const tribes = Object.values(TRIBE_PRESETS).filter(c => c.ethnicGroup === 'kiswani_haisla');
    for (const t of tribes) {
      expect(['Grey', 'Silver', 'Salt'].some(p => t.name.startsWith(p))).toBe(true);
    }
  });

  it('hanjoda_stormcaller tribes use Ash / White / Pale prefix', () => {
    const tribes = Object.values(TRIBE_PRESETS).filter(c => c.ethnicGroup === 'hanjoda_stormcaller');
    for (const t of tribes) {
      expect(['Ash', 'White', 'Pale'].some(p => t.name.startsWith(p))).toBe(true);
    }
  });

  it('hanjoda_bloodmoon tribes use Red / Ochre / Crimson prefix', () => {
    const tribes = Object.values(TRIBE_PRESETS).filter(c => c.ethnicGroup === 'hanjoda_bloodmoon');
    for (const t of tribes) {
      expect(['Red', 'Ochre', 'Crimson'].some(p => t.name.startsWith(p))).toBe(true);
    }
  });

  it('hanjoda_talon tribes use Amber / Gold / Gilt prefix', () => {
    const tribes = Object.values(TRIBE_PRESETS).filter(c => c.ethnicGroup === 'hanjoda_talon');
    for (const t of tribes) {
      expect(['Amber', 'Gold', 'Gilt'].some(p => t.name.startsWith(p))).toBe(true);
    }
  });

  it('hanjoda_emrasi tribes use Bronze / Brown / Copper prefix', () => {
    const tribes = Object.values(TRIBE_PRESETS).filter(c => c.ethnicGroup === 'hanjoda_emrasi');
    for (const t of tribes) {
      expect(['Bronze', 'Brown', 'Copper'].some(p => t.name.startsWith(p))).toBe(true);
    }
  });

  it('no tribe uses a color belonging to a different ethnic group', () => {
    // A Kiswani tribe should never get an Ash- or Red- prefix, etc.
    for (const config of Object.values(TRIBE_PRESETS)) {
      const ownColors = ETHNIC_COLOR_PREFIXES[config.ethnicGroup];
      const otherColors = Object.entries(ETHNIC_COLOR_PREFIXES)
        .filter(([group]) => group !== config.ethnicGroup)
        .flatMap(([, colors]) => colors);
      for (const foreign of otherColors) {
        if (config.name.startsWith(foreign)) {
          // Only flag if it doesn't also start with an own-group color
          // (e.g. "Bronze" starts with "Br" which won't match "Brown")
          const alsoOwn = ownColors.some(c => config.name.startsWith(c));
          expect(
            alsoOwn,
            `"${config.name}" starts with foreign color "${foreign}" and has no own-group color match`,
          ).toBe(true);
        }
      }
    }
  });
});

// ─── createTribe — runtime field initialisation ───────────────────────────────

describe('createTribe — runtime field initialisation', () => {
  it('initialises sighted to false', () => {
    expect(createTribe(makeConfig()).sighted).toBe(false);
  });

  it('initialises diplomacyOpened to false', () => {
    expect(createTribe(makeConfig()).diplomacyOpened).toBe(false);
  });

  it('initialises giftedTurns to null', () => {
    expect(createTribe(makeConfig()).giftedTurns).toBeNull();
  });

  it('initialises territoryQ to null', () => {
    expect(createTribe(makeConfig()).territoryQ).toBeNull();
  });

  it('initialises territoryR to null', () => {
    expect(createTribe(makeConfig()).territoryR).toBeNull();
  });
});

// ─── updateTribeDisposition — multi-step convergence ─────────────────────────

describe('updateTribeDisposition — convergence', () => {
  const rng = createRNG(42);

  it('converges a positive disposition to 0 over enough turns', () => {
    let tribe = createTribe(makeConfig({ startingDisposition: 5 }));
    for (let i = 0; i < 5; i++) {
      const next = updateTribeDisposition(tribe, null, rng);
      tribe = { ...tribe, disposition: next };
    }
    expect(tribe.disposition).toBe(0);
  });

  it('converges a negative disposition to 0 over enough turns', () => {
    let tribe = createTribe(makeConfig({ startingDisposition: -5 }));
    for (let i = 0; i < 5; i++) {
      const next = updateTribeDisposition(tribe, null, rng);
      tribe = { ...tribe, disposition: next };
    }
    expect(tribe.disposition).toBe(0);
  });

  it('never overshoots 0 from a positive value', () => {
    let tribe = createTribe(makeConfig({ startingDisposition: 3 }));
    for (let i = 0; i < 10; i++) {
      const next = updateTribeDisposition(tribe, null, rng);
      tribe = { ...tribe, disposition: next };
      expect(tribe.disposition).toBeGreaterThanOrEqual(0);
    }
  });

  it('never overshoots 0 from a negative value', () => {
    let tribe = createTribe(makeConfig({ startingDisposition: -3 }));
    for (let i = 0; i < 10; i++) {
      const next = updateTribeDisposition(tribe, null, rng);
      tribe = { ...tribe, disposition: next };
      expect(tribe.disposition).toBeLessThanOrEqual(0);
    }
  });
});
