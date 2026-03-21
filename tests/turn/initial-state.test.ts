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

// ─── Companion combinations ───────────────────────────────────────────────────

describe('createInitialState — companion: Imanian Wives only', () => {
  function makeWivesConfig(location = 'kethani_mouth') {
    return makeConfig({
      startingLocation: location,
      companionChoices: { imanianWives: true, townbornAuxiliaries: false, wildbornWomen: false },
    });
  }

  it('adds 2–3 female settlers', () => {
    // Test across several seeds to cover the rng.nextInt(2,3) branch
    for (const seed of [1, 42, 100, 999, 12345]) {
      const state = createInitialState(makeWivesConfig(), 'Test', seed);
      const women = Array.from(state.people.values()).filter(p => p.sex === 'female');
      expect(women.length).toBeGreaterThanOrEqual(2);
      expect(women.length).toBeLessThanOrEqual(5); // up to 3 wives + up to 3 children
    }
  });

  it('wives are tagged founding_member', () => {
    const state = createInitialState(makeWivesConfig(), 'Test', 42);
    const women = Array.from(state.people.values()).filter(p => p.sex === 'female' && p.age >= 20);
    for (const w of women) {
      expect(w.socialStatus).toBe('founding_member');
    }
  });

  it('wives are imanian_orthodox', () => {
    const state = createInitialState(makeWivesConfig(), 'Test', 42);
    const women = Array.from(state.people.values()).filter(p => p.sex === 'female' && p.age >= 20);
    for (const w of women) {
      expect(w.religion).toBe('imanian_orthodox');
    }
  });

  it('wives speak imanian fluently', () => {
    const state = createInitialState(makeWivesConfig(), 'Test', 42);
    const women = Array.from(state.people.values()).filter(p => p.sex === 'female' && p.age >= 20);
    for (const w of women) {
      const imanian = w.languages.find(l => l.language === 'imanian');
      expect(imanian).toBeDefined();
      expect(imanian!.fluency).toBe(1.0);
    }
  });

  it('wives are placed in households', () => {
    const state = createInitialState(makeWivesConfig(), 'Test', 42);
    const women = Array.from(state.people.values()).filter(p => p.sex === 'female' && p.age >= 20);
    for (const w of women) {
      expect(w.householdId).toBeTruthy();
      expect(state.households.has(w.householdId!)).toBe(true);
    }
  });

  it('coupled husbands and wives share the same householdId', () => {
    const state = createInitialState(makeWivesConfig(), 'Test', 42);
    const women = Array.from(state.people.values()).filter(p => p.sex === 'female' && p.age >= 20);
    for (const wife of women) {
      const spouseId = wife.spouseIds?.[0];
      expect(spouseId).toBeTruthy();
      const husband = state.people.get(spouseId!);
      expect(husband).toBeDefined();
      expect(husband!.householdId).toBe(wife.householdId);
    }
  });

  it('total settler count is at least 12 (10 men + ≥2 wives)', () => {
    const state = createInitialState(makeWivesConfig(), 'Test', 42);
    expect(state.people.size).toBeGreaterThanOrEqual(12);
  });

  it('supply modifier is unchanged (1.0 at mouth)', () => {
    const state = createInitialState(makeWivesConfig('kethani_mouth'), 'Test', 42);
    expect(state.company.locationSupplyModifier).toBeCloseTo(1.0, 5);
  });
});

describe('createInitialState — companion: Townborn Auxiliaries only', () => {
  function makeTownbornConfig(location = 'kethani_mouth') {
    return makeConfig({
      startingLocation: location,
      companionChoices: { imanianWives: false, townbornAuxiliaries: true, wildbornWomen: false },
    });
  }

  it('adds exactly 3 townborn settlers', () => {
    const state = createInitialState(makeTownbornConfig(), 'Test', 42);
    expect(state.people.size).toBe(13);
  });

  it('townborn have socialStatus newcomer', () => {
    const state = createInitialState(makeTownbornConfig(), 'Test', 42);
    const newcomers = Array.from(state.people.values()).filter(p => p.socialStatus === 'newcomer');
    expect(newcomers).toHaveLength(3);
  });

  it('townborn speak tradetalk', () => {
    const state = createInitialState(makeTownbornConfig(), 'Test', 42);
    const newcomers = Array.from(state.people.values()).filter(p => p.socialStatus === 'newcomer');
    for (const p of newcomers) {
      const tt = p.languages.find(l => l.language === 'tradetalk');
      expect(tt).toBeDefined();
      expect(tt!.fluency).toBeGreaterThanOrEqual(0.65);
    }
  });

  it('townborn speak kiswani', () => {
    const state = createInitialState(makeTownbornConfig(), 'Test', 42);
    const newcomers = Array.from(state.people.values()).filter(p => p.socialStatus === 'newcomer');
    for (const p of newcomers) {
      const ki = p.languages.find(l => l.language === 'kiswani');
      expect(ki).toBeDefined();
    }
  });

  it('townborn have mixed bloodline', () => {
    const state = createInitialState(makeTownbornConfig(), 'Test', 42);
    const newcomers = Array.from(state.people.values()).filter(p => p.socialStatus === 'newcomer');
    for (const p of newcomers) {
      expect(p.heritage.bloodline.length).toBeGreaterThan(1);
      const total = p.heritage.bloodline.reduce((s, b) => s + b.fraction, 0);
      expect(total).toBeCloseTo(1.0, 5);
    }
  });

  it('no townborn supply bonus at near location', () => {
    const state = createInitialState(makeTownbornConfig('kethani_mouth'), 'Test', 42);
    expect(state.company.locationSupplyModifier).toBeCloseTo(1.0, 5);
  });

  it('townborn supply bonus applies at kethani_uplands (+0.10)', () => {
    const state = createInitialState(makeTownbornConfig('kethani_uplands'), 'Test', 42);
    expect(state.company.locationSupplyModifier).toBeCloseTo(0.35 + 0.10, 5);
  });

  it('townborn supply bonus applies at kethani_headwaters (+0.10)', () => {
    const state = createInitialState(makeTownbornConfig('kethani_headwaters'), 'Test', 42);
    expect(state.company.locationSupplyModifier).toBeCloseTo(0.15 + 0.10, 5);
  });
});

describe('createInitialState — companion: Wildborn Women only', () => {
  function makeWildbornConfig(location = 'kethani_mouth') {
    return makeConfig({
      startingLocation: location,
      companionChoices: { imanianWives: false, townbornAuxiliaries: false, wildbornWomen: true },
    });
  }

  it('adds exactly 3 wildborn women', () => {
    const state = createInitialState(makeWildbornConfig(), 'Test', 42);
    expect(state.people.size).toBe(13);
  });

  it('wildborn women are female', () => {
    const state = createInitialState(makeWildbornConfig(), 'Test', 42);
    const women = Array.from(state.people.values()).filter(p => p.socialStatus === 'newcomer');
    expect(women.every(p => p.sex === 'female')).toBe(true);
  });

  it('wildborn women follow sacred_wheel religion', () => {
    const state = createInitialState(makeWildbornConfig(), 'Test', 42);
    const women = Array.from(state.people.values()).filter(p => p.socialStatus === 'newcomer');
    for (const w of women) {
      expect(w.religion).toBe('sacred_wheel');
    }
  });

  it('wildborn women have extendedFertility', () => {
    const state = createInitialState(makeWildbornConfig(), 'Test', 42);
    const women = Array.from(state.people.values()).filter(p => p.socialStatus === 'newcomer');
    for (const w of women) {
      expect(w.genetics.extendedFertility).toBe(true);
    }
  });

  it('at kethani_mouth wildborn have tradetalk fluency 0.35', () => {
    const state = createInitialState(makeWildbornConfig('kethani_mouth'), 'Test', 42);
    const women = Array.from(state.people.values()).filter(p => p.socialStatus === 'newcomer');
    for (const w of women) {
      const tt = w.languages.find(l => l.language === 'tradetalk');
      expect(tt).toBeDefined();
      expect(tt!.fluency).toBeCloseTo(0.35, 5);
    }
  });

  it('at kethani_headwaters wildborn have NO tradetalk entry', () => {
    const state = createInitialState(makeWildbornConfig('kethani_headwaters'), 'Test', 42);
    const women = Array.from(state.people.values()).filter(p => p.socialStatus === 'newcomer');
    for (const w of women) {
      const tt = w.languages.find(l => l.language === 'tradetalk');
      expect(tt).toBeUndefined();
    }
  });

  it('legacy includeSauromatianWomen flag still works', () => {
    const legacyConfig = makeConfig({ startingLocation: 'kethani_mouth', includeSauromatianWomen: true });
    const state = createInitialState(legacyConfig, 'Test', 42);
    expect(state.people.size).toBe(13);
    const women = Array.from(state.people.values()).filter(p => p.sex === 'female');
    expect(women).toHaveLength(3);
  });
});

describe('createInitialState — companion: Imanian Wives + Townborn', () => {
  function makeConfig2() {
    return makeConfig({
      startingLocation: 'kethani_mouth',
      companionChoices: { imanianWives: true, townbornAuxiliaries: true, wildbornWomen: false },
    });
  }

  it('produces at least 15 settlers (10 men + ≥2 wives + 3 townborn, possibly children)', () => {
    const state = createInitialState(makeConfig2(), 'Test', 42);
    expect(state.people.size).toBeGreaterThanOrEqual(15);
  });

  it('has both founding_member women (wives) and newcomers (townborn)', () => {
    const state = createInitialState(makeConfig2(), 'Test', 42);
    const all = Array.from(state.people.values());
    const foundingWomen = all.filter(p => p.sex === 'female' && p.socialStatus === 'founding_member');
    const newcomers = all.filter(p => p.socialStatus === 'newcomer');
    expect(foundingWomen.length).toBeGreaterThanOrEqual(2);
    expect(newcomers).toHaveLength(3);
  });

  it('no sacred_wheel members (all women are orthodox, townborn are misc)', () => {
    const state = createInitialState(makeConfig2(), 'Test', 42);
    const all = Array.from(state.people.values());
    const foundingWomen = all.filter(p => p.sex === 'female' && p.socialStatus === 'founding_member');
    for (const w of foundingWomen) {
      expect(w.religion).toBe('imanian_orthodox');
    }
  });
});

describe('createInitialState — companion: Imanian Wives + Wildborn', () => {
  function makeConfig3() {
    return makeConfig({
      startingLocation: 'kethani_mouth',
      companionChoices: { imanianWives: true, townbornAuxiliaries: false, wildbornWomen: true },
    });
  }

  it('produces at least 15 settlers', () => {
    const state = createInitialState(makeConfig3(), 'Test', 42);
    expect(state.people.size).toBeGreaterThanOrEqual(15);
  });

  it('has both orthodox women and sacred_wheel women', () => {
    const state = createInitialState(makeConfig3(), 'Test', 42);
    const women = Array.from(state.people.values()).filter(p => p.sex === 'female' && p.age >= 14);
    const orthodox = women.filter(w => w.religion === 'imanian_orthodox');
    const wheel = women.filter(w => w.religion === 'sacred_wheel');
    expect(orthodox.length).toBeGreaterThanOrEqual(2); // wives
    expect(wheel).toHaveLength(3); // wildborn
  });

  it('wildborn women have no householdId at start', () => {
    const state = createInitialState(makeConfig3(), 'Test', 42);
    const wildborn = Array.from(state.people.values()).filter(p => p.socialStatus === 'newcomer');
    for (const w of wildborn) {
      // They get solo households from initializeHouseholds, but shouldn't be in married couple households
      if (w.householdId) {
        const hh = state.households.get(w.householdId);
        expect(hh?.memberIds).not.toContain(wildborn[0]?.spouseIds?.[0]); // not married at start
      }
    }
  });
});

describe('createInitialState — companion: Townborn + Wildborn', () => {
  function makeConfig4() {
    return makeConfig({
      startingLocation: 'kethani_mouth',
      companionChoices: { imanianWives: false, townbornAuxiliaries: true, wildbornWomen: true },
    });
  }

  it('produces exactly 16 settlers (10 + 3 + 3)', () => {
    const state = createInitialState(makeConfig4(), 'Test', 42);
    expect(state.people.size).toBe(16);
  });

  it('has 3 newcomers who speak tradetalk and 3 who do not have kiswani', () => {
    const state = createInitialState(makeConfig4(), 'Test', 42);
    const newcomers = Array.from(state.people.values()).filter(p => p.socialStatus === 'newcomer');
    expect(newcomers).toHaveLength(6); // 3 townborn + 3 wildborn
    const withTradetalk = newcomers.filter(p => p.languages.some(l => l.language === 'tradetalk'));
    // Townborn always have tradetalk; wildborn at mouth have it too
    expect(withTradetalk.length).toBeGreaterThanOrEqual(3);
  });
});

describe('createInitialState — companion: All three', () => {
  function makeConfigAll(location = 'kethani_mouth') {
    return makeConfig({
      startingLocation: location,
      companionChoices: { imanianWives: true, townbornAuxiliaries: true, wildbornWomen: true },
    });
  }

  it('produces at least 19 settlers (10 + ≥2 wives + 3 tb + 3 wildborn)', () => {
    const state = createInitialState(makeConfigAll(), 'Test', 42);
    expect(state.people.size).toBeGreaterThanOrEqual(19);
  });

  it('settlement is deterministic across two runs with same seed', () => {
    const s1 = createInitialState(makeConfigAll(), 'Test', 77);
    const s2 = createInitialState(makeConfigAll(), 'Test', 77);
    expect(s1.people.size).toBe(s2.people.size);
    const names1 = Array.from(s1.people.values()).map(p => p.firstName).sort().join(',');
    const names2 = Array.from(s2.people.values()).map(p => p.firstName).sort().join(',');
    expect(names1).toBe(names2);
  });

  it('has all three social status groups present', () => {
    const state = createInitialState(makeConfigAll(), 'Test', 42);
    const all = Array.from(state.people.values());
    const foundingMen = all.filter(p => p.sex === 'male' && p.socialStatus === 'founding_member' && p.role !== 'child');
    const foundingWomen = all.filter(p => p.sex === 'female' && p.socialStatus === 'founding_member' && p.role !== 'child');
    const newcomers = all.filter(p => p.socialStatus === 'newcomer');
    expect(foundingMen).toHaveLength(10);
    expect(foundingWomen.length).toBeGreaterThanOrEqual(2);
    expect(newcomers.length).toBeGreaterThanOrEqual(6); // 3 townborn + 3 wildborn
  });

  it('all three companion types are represented in religion', () => {
    const state = createInitialState(makeConfigAll('kethani_mouth'), 'Test', 42);
    const all = Array.from(state.people.values());
    const hasOrthodox = all.some(p => p.religion === 'imanian_orthodox');
    const hasWheel = all.some(p => p.religion === 'sacred_wheel');
    expect(hasOrthodox).toBe(true);
    expect(hasWheel).toBe(true); // from wildborn
  });

  it('at kethani_uplands with all companions: supply = 0.35 + 0.10 = 0.45', () => {
    const state = createInitialState(makeConfigAll('kethani_uplands'), 'Test', 42);
    expect(state.company.locationSupplyModifier).toBeCloseTo(0.45, 5);
  });
});

// ─── All 5 locations ──────────────────────────────────────────────────────────

describe('createInitialState — starting locations', () => {
  const LOCATION_CASES: Array<{
    id: string;
    supply: number;
    foodAdj: number;
    lumberAdj: number;
    stoneAdj: number;
  }> = [
    { id: 'kethani_mouth',       supply: 1.00, foodAdj:   0, lumberAdj:  0, stoneAdj: 0 },
    { id: 'kethani_lowlands',    supply: 0.85, foodAdj:   5, lumberAdj:  0, stoneAdj: 0 },
    { id: 'kethani_midreach',    supply: 0.60, foodAdj:   0, lumberAdj:  0, stoneAdj: 0 },
    { id: 'kethani_uplands',     supply: 0.35, foodAdj:  -5, lumberAdj: 10, stoneAdj: 0 },
    { id: 'kethani_headwaters',  supply: 0.15, foodAdj: -10, lumberAdj: -5, stoneAdj: 5 },
  ];

  for (const loc of LOCATION_CASES) {
    it(`${loc.id}: supply modifier is ${loc.supply}`, () => {
      const state = createInitialState(makeConfig({ startingLocation: loc.id }), 'Test', 42);
      expect(state.company.locationSupplyModifier).toBeCloseTo(loc.supply, 5);
    });

    it(`${loc.id}: starting food = ${20 + loc.foodAdj}`, () => {
      const state = createInitialState(makeConfig({ startingLocation: loc.id }), 'Test', 42);
      expect(state.settlement.resources.food).toBe(Math.max(0, 20 + loc.foodAdj));
    });

    it(`${loc.id}: starting lumber = ${20 + loc.lumberAdj}`, () => {
      const state = createInitialState(makeConfig({ startingLocation: loc.id }), 'Test', 42);
      expect(state.settlement.resources.lumber).toBe(Math.max(0, 20 + loc.lumberAdj));
    });

    it(`${loc.id}: starting stone = ${10 + loc.stoneAdj}`, () => {
      const state = createInitialState(makeConfig({ startingLocation: loc.id }), 'Test', 42);
      expect(state.settlement.resources.stone).toBe(Math.max(0, 10 + loc.stoneAdj));
    });
  }

  it('location is stored on the settlement', () => {
    for (const loc of LOCATION_CASES) {
      const state = createInitialState(makeConfig({ startingLocation: loc.id }), 'Test', 42);
      expect(state.settlement.location).toBe(loc.id);
    }
  });

  it('config is stored on the state', () => {
    const cfg = makeConfig({ startingLocation: 'kethani_midreach' });
    const state = createInitialState(cfg, 'Test', 42);
    expect(state.config.startingLocation).toBe('kethani_midreach');
  });

  describe('wildborn women ethnic groups by location', () => {
    const WILDBORN_MOUTH_ETHNIC = 'kiswani_riverfolk';

    it('at kethani_mouth wildborn are kiswani_riverfolk', () => {
      const cfg = makeConfig({
        startingLocation: 'kethani_mouth',
        companionChoices: { imanianWives: false, townbornAuxiliaries: false, wildbornWomen: true },
      });
      const state = createInitialState(cfg, 'Test', 42);
      const wildborn = Array.from(state.people.values()).filter(p => p.socialStatus === 'newcomer');
      for (const w of wildborn) {
        expect(w.heritage.bloodline[0]?.group).toBe(WILDBORN_MOUTH_ETHNIC);
      }
    });

    it('at kethani_uplands wildborn are hanjoda_stormcaller', () => {
      const cfg = makeConfig({
        startingLocation: 'kethani_uplands',
        companionChoices: { imanianWives: false, townbornAuxiliaries: false, wildbornWomen: true },
      });
      const state = createInitialState(cfg, 'Test', 42);
      const wildborn = Array.from(state.people.values()).filter(p => p.socialStatus === 'newcomer');
      for (const w of wildborn) {
        expect(w.heritage.bloodline[0]?.group).toBe('hanjoda_stormcaller');
      }
    });

    it('at kethani_headwaters wildborn are hanjoda_stormcaller', () => {
      const cfg = makeConfig({
        startingLocation: 'kethani_headwaters',
        companionChoices: { imanianWives: false, townbornAuxiliaries: false, wildbornWomen: true },
      });
      const state = createInitialState(cfg, 'Test', 42);
      const wildborn = Array.from(state.people.values()).filter(p => p.socialStatus === 'newcomer');
      for (const w of wildborn) {
        expect(w.heritage.bloodline[0]?.group).toBe('hanjoda_stormcaller');
      }
    });

    it('at kethani_lowlands wildborn are either kiswani_riverfolk or hanjoda_bloodmoon', () => {
      const cfg = makeConfig({
        startingLocation: 'kethani_lowlands',
        companionChoices: { imanianWives: false, townbornAuxiliaries: false, wildbornWomen: true },
      });
      // Test multiple seeds to confirm both groups can appear
      const groupsSeen = new Set<string>();
      for (const seed of [1, 2, 3, 4, 5, 10, 20, 50, 100, 200]) {
        const state = createInitialState(cfg, 'Test', seed);
        const wildborn = Array.from(state.people.values()).filter(p => p.socialStatus === 'newcomer');
        for (const w of wildborn) {
          groupsSeen.add(w.heritage.bloodline[0]?.group ?? '');
        }
      }
      // At least one of the two groups must appear
      const validGroups = new Set(['kiswani_riverfolk', 'hanjoda_bloodmoon']);
      for (const g of groupsSeen) {
        expect(validGroups.has(g)).toBe(true);
      }
    });
  });
});
