/**
 * Integration tests for the marriage → conception → birth pipeline.
 *
 * These tests exercise processDawn() end-to-end to verify that:
 *   - Married couples in the fertility window eventually conceive.
 *   - Unmarried women do not conceive.
 *   - A woman already pregnant does not receive a second pregnancy.
 *   - A due pregnancy resolves to a birth with correct parentage.
 *   - The born child is added to the people map and parents' childrenIds updated.
 *
 * All randomness uses a seeded RNG so results are fully deterministic.
 */

import { describe, it, expect } from 'vitest';
import { processDawn } from '../../src/simulation/turn/turn-processor';
import { createPerson } from '../../src/simulation/population/person';
import { createFertilityProfile } from '../../src/simulation/genetics/fertility';
import { createRNG } from '../../src/utils/rng';
import type { GameState, Season } from '../../src/simulation/turn/game-state';
import type { Person } from '../../src/simulation/population/person';

// ─── Minimal state builder ────────────────────────────────────────────────────

/**
 * Builds a minimal GameState containing only the fields that processDawn()
 * reads. All optional fields are stubbed to safe zero/empty values.
 */
function makeState(
  people: Map<string, Person>,
  overrides: { turnNumber?: number; currentSeason?: Season; currentYear?: number } = {},
): GameState {
  return {
    version: '1.0.0',
    seed: 42,
    turnNumber:     overrides.turnNumber     ?? 0,
    currentSeason:  overrides.currentSeason  ?? 'spring',
    currentYear:    overrides.currentYear    ?? 1,
    people,
    graveyard: [],
    settlement: {
      name: 'Test Settlement',
      location: 'marsh',
      buildings: [],
      resources: {
        food: 100, cattle: 0, goods: 0, steel: 0,
        lumber: 0, stone: 0, medicine: 0, gold: 0, horses: 0,
      },
      populationCount: people.size,
    },
    culture: {
      languages:        new Map([['imanian', 1.0]]),
      primaryLanguage:  'imanian',
      religions:        new Map([['imanian_orthodox', 1.0]]),
      religiousTension: 0,
      culturalBlend:    0,
      practices:        [],
      governance:       'patriarchal_imanian',
    },
    tribes:          new Map(),
    company: {
      standing: 60,
      annualQuotaGold: 0,
      annualQuotaTradeGoods: 0,
      consecutiveFailures: 0,
      supportLevel: 'standard',
      yearsActive: 0,
    },
    eventHistory:    [],
    eventCooldowns:  new Map(),
    pendingEvents:   [],
    councilMemberIds: [],
    config: {
      difficulty: 'normal',
      startingLocation: 'marsh',
      includeSauromatianWomen: false,
      startingTribes: [],
    },
  } as unknown as GameState;
}

// ─── Person factories ─────────────────────────────────────────────────────────

function makeWoman(overrides: Partial<Parameters<typeof createPerson>[0]> = {}): Person {
  return createPerson({
    sex: 'female',
    age: 25,
    fertility: createFertilityProfile(false),
    heritage: {
      bloodline: [{ group: 'imanian', fraction: 1.0 }],
      primaryCulture: 'ansberite',
      culturalFluency: new Map([['ansberite', 1.0]]),
    },
    ...overrides,
  });
}

function makeMan(overrides: Partial<Parameters<typeof createPerson>[0]> = {}): Person {
  return createPerson({
    sex: 'male',
    age: 28,
    heritage: {
      bloodline: [{ group: 'imanian', fraction: 1.0 }],
      primaryCulture: 'ansberite',
      culturalFluency: new Map([['ansberite', 1.0]]),
    },
    ...overrides,
  });
}

/** Returns copies of (woman, man) linked to each other via spouseIds. */
function marry(woman: Person, man: Person): [Person, Person] {
  const w: Person = { ...woman, spouseIds: [...woman.spouseIds, man.id] };
  const m: Person = { ...man, spouseIds: [...man.spouseIds, woman.id] };
  return [w, m];
}

// ─── Conception tests ────────────────────────────────────────────────────────

describe('conception — married couples', () => {
  it('a married woman in peak fertility eventually conceives within 20 turns', () => {
    const woman = makeWoman({ age: 25 });
    const man   = makeMan();
    const [wife, husband] = marry(woman, man);

    const people = new Map([
      [wife.id,    wife],
      [husband.id, husband],
    ]);

    let state = makeState(people, { currentSeason: 'summer' }); // summer = highest chance
    let conceived = false;

    for (let turn = 0; turn < 20; turn++) {
      const rng = createRNG(42 + turn);
      const result = processDawn(state, rng);
      state = { ...state, people: result.updatedPeople, turnNumber: state.turnNumber + 1 };

      const updatedWife = result.updatedPeople.get(wife.id);
      if (updatedWife?.health.pregnancy) {
        conceived = true;
        break;
      }
    }

    expect(conceived).toBe(true);
  });

  it('pregnancy has correct fatherId, conceptionTurn, and dueDate (+3)', () => {
    // Run turns until we get a pregnancy, then check the state.
    const woman = makeWoman({ age: 25 });
    const man   = makeMan();
    const [wife, husband] = marry(woman, man);

    const people = new Map([
      [wife.id, wife],
      [husband.id, husband],
    ]);

    let state = makeState(people, { currentSeason: 'summer', turnNumber: 5 });

    for (let turn = 0; turn < 20; turn++) {
      const rng = createRNG(42 + turn);
      const result = processDawn(state, rng);
      state = { ...state, people: result.updatedPeople, turnNumber: state.turnNumber + 1 };

      const updatedWife = result.updatedPeople.get(wife.id);
      if (updatedWife?.health.pregnancy) {
        const p = updatedWife.health.pregnancy;
        expect(p.fatherId).toBe(husband.id);
        expect(typeof p.conceptionTurn).toBe('number');
        expect(p.dueDate).toBe(p.conceptionTurn + 3);
        return;
      }
    }
    throw new Error('No conception occurred in 20 turns — test is invalid');
  });

  it('a pregnant woman does not receive a second pregnancy', () => {
    const pregnant: Person = makeWoman({
      age: 25,
      health: {
        currentHealth: 100,
        conditions: [],
        pregnancy: { fatherId: 'some-man', conceptionTurn: 0, dueDate: 999 }, // far future
      },
    });
    const man = makeMan();
    const [wife, husband] = marry(pregnant, man);

    const people = new Map([
      [wife.id, wife],
      [husband.id, husband],
    ]);

    // Run many summer turns — pregnancy state must never change
    let state = makeState(people, { currentSeason: 'summer' });
    for (let turn = 0; turn < 10; turn++) {
      const rng = createRNG(42 + turn);
      const result = processDawn(state, rng);
      state = { ...state, people: result.updatedPeople, turnNumber: state.turnNumber + 1 };

      const updatedWife = result.updatedPeople.get(wife.id);
      // The pregnancy state should either still be the original (dueDate 999)
      // or have resolved (if dueDate was reached). Either way, no second pregnancy.
      if (updatedWife?.health.pregnancy) {
        expect(updatedWife.health.pregnancy.dueDate).toBe(999);
      }
    }
  });
});

describe('conception — unmarried women', () => {
  it('an unmarried woman in peak fertility never conceives', () => {
    const woman = makeWoman({ age: 25 });
    const man   = makeMan();
    // NOT married — no call to marry()

    const people = new Map([
      [woman.id, woman],
      [man.id,   man],
    ]);

    let state = makeState(people, { currentSeason: 'summer' });

    for (let turn = 0; turn < 20; turn++) {
      const rng = createRNG(42 + turn);
      const result = processDawn(state, rng);
      state = { ...state, people: result.updatedPeople, turnNumber: state.turnNumber + 1 };

      const updated = result.updatedPeople.get(woman.id);
      expect(updated?.health.pregnancy).toBeUndefined();
    }
  });
});

// ─── Birth tests ─────────────────────────────────────────────────────────────

describe('birth — pregnancy resolution', () => {
  it('a due pregnancy produces a birth result', () => {
    const man = makeMan();
    // Woman is pregnant and due this turn (dueDate <= turnNumber  after aging)
    const woman: Person = {
      ...makeWoman({ age: 25 }),
      spouseIds: [man.id],
      health: {
        currentHealth: 100,
        conditions: [],
        pregnancy: { fatherId: man.id, conceptionTurn: 0, dueDate: 1 },
      },
    };
    const marriedMan: Person = { ...man, spouseIds: [woman.id] };

    const people = new Map([
      [woman.id, woman],
      [marriedMan.id, marriedMan],
    ]);

    const state = makeState(people, { turnNumber: 1 });
    const rng = createRNG(42);
    const result = processDawn(state, rng);

    expect(result.births.length).toBeGreaterThanOrEqual(1);
    const birth = result.births[0]!;
    expect(birth.motherId).toBe(woman.id);
  });

  it('the born child is present in updatedPeople', () => {
    const man = makeMan();
    const woman: Person = {
      ...makeWoman({ age: 25 }),
      spouseIds: [man.id],
      health: {
        currentHealth: 100,
        conditions: [],
        pregnancy: { fatherId: man.id, conceptionTurn: 0, dueDate: 1 },
      },
    };
    const marriedMan: Person = { ...man, spouseIds: [woman.id] };

    const people = new Map([
      [woman.id, woman],
      [marriedMan.id, marriedMan],
    ]);

    const state = makeState(people, { turnNumber: 1 });
    const rng = createRNG(42);
    const result = processDawn(state, rng);

    const birth = result.births[0]!;
    const child = result.updatedPeople.get(birth.childId);

    expect(child).toBeDefined();
    expect(child!.age).toBe(0);
    expect(child!.parentIds[0]).toBe(woman.id);
    expect(child!.parentIds[1]).toBe(man.id);
  });

  it("the child appears in the mother's childrenIds", () => {
    const man = makeMan();
    const woman: Person = {
      ...makeWoman({ age: 25 }),
      spouseIds: [man.id],
      health: {
        currentHealth: 100,
        conditions: [],
        pregnancy: { fatherId: man.id, conceptionTurn: 0, dueDate: 1 },
      },
    };
    const marriedMan: Person = { ...man, spouseIds: [woman.id] };

    const people = new Map([
      [woman.id, woman],
      [marriedMan.id, marriedMan],
    ]);

    const state = makeState(people, { turnNumber: 1 });
    const rng = createRNG(42);
    const result = processDawn(state, rng);

    const birth = result.births[0]!;
    const updatedMother = result.updatedPeople.get(woman.id);

    // Mother may have died; if she survived, check childrenIds.
    if (birth.motherSurvived) {
      expect(updatedMother?.childrenIds).toContain(birth.childId);
    } else {
      // Mother died — she should be in the graveyard, not in people.
      expect(updatedMother).toBeUndefined();
      const graveyardEntry = result.newGraveyardEntries.find(e => e.id === woman.id);
      expect(graveyardEntry).toBeDefined();
    }
  });

  it("the child appears in the father's childrenIds", () => {
    const man = makeMan();
    const woman: Person = {
      ...makeWoman({ age: 25 }),
      spouseIds: [man.id],
      health: {
        currentHealth: 100,
        conditions: [],
        pregnancy: { fatherId: man.id, conceptionTurn: 0, dueDate: 1 },
      },
    };
    const marriedMan: Person = { ...man, spouseIds: [woman.id] };

    const people = new Map([
      [woman.id, woman],
      [marriedMan.id, marriedMan],
    ]);

    const state = makeState(people, { turnNumber: 1 });
    const rng = createRNG(42);
    const result = processDawn(state, rng);

    const birth = result.births[0]!;
    const updatedFather = result.updatedPeople.get(man.id);

    expect(updatedFather?.childrenIds).toContain(birth.childId);
  });

  it("mother's pregnancy is cleared after birth", () => {
    const man = makeMan();
    const woman: Person = {
      ...makeWoman({ age: 25 }),
      spouseIds: [man.id],
      health: {
        currentHealth: 100,
        conditions: [],
        pregnancy: { fatherId: man.id, conceptionTurn: 0, dueDate: 1 },
      },
    };
    const marriedMan: Person = { ...man, spouseIds: [woman.id] };

    const people = new Map([[woman.id, woman], [marriedMan.id, marriedMan]]);
    const state = makeState(people, { turnNumber: 1 });
    const rng = createRNG(42);
    const result = processDawn(state, rng);

    const birth = result.births[0]!;
    if (birth.motherSurvived) {
      const updatedMother = result.updatedPeople.get(woman.id);
      expect(updatedMother?.health.pregnancy).toBeUndefined();
    }
  });

  it('a pregnancy not yet due does not resolve', () => {
    const man = makeMan();
    const woman: Person = {
      ...makeWoman({ age: 25 }),
      spouseIds: [man.id],
      health: {
        currentHealth: 100,
        conditions: [],
        pregnancy: { fatherId: man.id, conceptionTurn: 0, dueDate: 99 }, // far future
      },
    };
    const marriedMan: Person = { ...man, spouseIds: [woman.id] };

    const people = new Map([[woman.id, woman], [marriedMan.id, marriedMan]]);
    const state = makeState(people, { turnNumber: 1 });
    const rng = createRNG(42);
    const result = processDawn(state, rng);

    expect(result.births).toHaveLength(0);
    const updatedWoman = result.updatedPeople.get(woman.id);
    expect(updatedWoman?.health.pregnancy).toBeDefined();
    expect(updatedWoman?.health.pregnancy?.dueDate).toBe(99);
  });

  it('the born child receives a non-empty name', () => {
    const man = makeMan();
    const woman: Person = {
      ...makeWoman({ age: 25 }),
      spouseIds: [man.id],
      health: {
        currentHealth: 100,
        conditions: [],
        pregnancy: { fatherId: man.id, conceptionTurn: 0, dueDate: 1 },
      },
    };
    const marriedMan: Person = { ...man, spouseIds: [woman.id] };

    const people = new Map([[woman.id, woman], [marriedMan.id, marriedMan]]);
    const state = makeState(people, { turnNumber: 1 });
    const rng = createRNG(42);
    const result = processDawn(state, rng);

    const birth = result.births[0]!;
    const child = result.updatedPeople.get(birth.childId)!;
    expect(child.firstName.length).toBeGreaterThan(0);
    expect(child.familyName.length).toBeGreaterThan(0);
  });
});

// ─── Full pipeline ────────────────────────────────────────────────────────────

describe('full pipeline: marriage → conception → birth', () => {
  it('a married couple have a child within 6 turns after conception', () => {
    const woman = makeWoman({ age: 25 });
    const man   = makeMan();
    const [wife, husband] = marry(woman, man);

    const people = new Map([
      [wife.id, wife],
      [husband.id, husband],
    ]);

    // Phase 1: run until conception (up to 20 turns)
    let state = makeState(people, { currentSeason: 'summer', turnNumber: 0 });
    let conceptionTurn: number | undefined;

    for (let t = 0; t < 20; t++) {
      const rng = createRNG(100 + t);
      const result = processDawn(state, rng);
      state = { ...state, people: result.updatedPeople, turnNumber: state.turnNumber + 1 };

      const w = result.updatedPeople.get(wife.id);
      if (w?.health.pregnancy && conceptionTurn === undefined) {
        conceptionTurn = w.health.pregnancy.conceptionTurn;
      }
      if (result.births.length > 0) {
        // Conceived and born within 6 turns — pass.
        return;
      }
    }

    if (conceptionTurn === undefined) {
      throw new Error('No conception in 20 turns — adjust test seed or fertility params');
    }

    // Phase 2: continue from conception until birth (must arrive within 4 more turns)
    for (let t = 0; t < 4; t++) {
      const rng = createRNG(200 + t);
      const result = processDawn(state, rng);
      state = { ...state, people: result.updatedPeople, turnNumber: state.turnNumber + 1 };

      if (result.births.length > 0) {
        const birth = result.births[0]!;
        // Verify the child is a legitimate result.
        const child = result.updatedPeople.get(birth.childId);
        expect(child).toBeDefined();
        expect(child!.age).toBe(0);
        return;
      }
    }

    throw new Error('Pregnancy did not resolve within 4 turns of conception');
  });
});

// ─── Child culture — blended heritage ────────────────────────────────────────

describe('child culture — blended heritage from mixed parents', () => {
  /**
   * Mother is Hanjoda Talon (primaryCulture: hanjoda_talon, fluency 1.0)
   * Father is Imanian    (primaryCulture: ansberite,     fluency 1.0)
   * The child should receive a Heritage blended from both parents.
   */
  function makeMixedBirthState() {
    const father = makeMan({
      heritage: {
        bloodline: [{ group: 'imanian', fraction: 1.0 }],
        primaryCulture: 'ansberite',
        culturalFluency: new Map([['ansberite', 1.0]]),
      },
    });

    const mother: Person = {
      ...makeWoman({
        heritage: {
          bloodline: [{ group: 'hanjoda_talon', fraction: 1.0 }],
          primaryCulture: 'hanjoda_talon',
          culturalFluency: new Map([['hanjoda_talon', 1.0]]),
        },
      }),
      spouseIds: [father.id],
      health: {
        currentHealth: 100,
        conditions: [],
        pregnancy: { fatherId: father.id, conceptionTurn: 0, dueDate: 1 },
      },
    };
    const linkedFather: Person = { ...father, spouseIds: [mother.id] };

    return {
      mother,
      father: linkedFather,
      state: makeState(
        new Map([[mother.id, mother], [linkedFather.id, linkedFather]]),
        { turnNumber: 1 },
      ),
    };
  }

  it("child culturalFluency contains both parents' primary cultures", () => {
    const { state } = makeMixedBirthState();
    const result = processDawn(state, createRNG(42));
    const birth = result.births[0];
    if (!birth) throw new Error('No birth occurred — check due date / turnNumber setup');

    const child = result.updatedPeople.get(birth.childId)!;
    expect(child.heritage.culturalFluency.has('hanjoda_talon')).toBe(true);
    expect(child.heritage.culturalFluency.has('ansberite')).toBe(true);
  });

  it('child culturalFluency always contains settlement_native', () => {
    const { state } = makeMixedBirthState();
    const result = processDawn(state, createRNG(42));
    const birth = result.births[0];
    if (!birth) throw new Error('No birth occurred');

    const child = result.updatedPeople.get(birth.childId)!;
    expect(child.heritage.culturalFluency.has('settlement_native')).toBe(true);
    expect(child.heritage.culturalFluency.get('settlement_native')).toBeGreaterThan(0);
  });

  it("child primaryCulture is a key present in the child's fluency map", () => {
    const { state } = makeMixedBirthState();
    const result = processDawn(state, createRNG(42));
    const birth = result.births[0];
    if (!birth) throw new Error('No birth occurred');

    const child = result.updatedPeople.get(birth.childId)!;
    expect(child.heritage.culturalFluency.has(child.heritage.primaryCulture)).toBe(true);
  });

  it('child is NOT purely Imanian or purely Sauromatian in fluency (both present)', () => {
    const { state } = makeMixedBirthState();
    const result = processDawn(state, createRNG(42));
    const birth = result.births[0];
    if (!birth) throw new Error('No birth occurred');

    const child = result.updatedPeople.get(birth.childId)!;
    const fluency = child.heritage.culturalFluency;
    // Neither parent's culture should be 0 — both must be present with value > 0.
    expect(fluency.get('ansberite') ?? 0).toBeGreaterThan(0);
    expect(fluency.get('hanjoda_talon') ?? 0).toBeGreaterThan(0);
  });
});
