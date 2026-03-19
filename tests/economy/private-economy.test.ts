import { describe, it, expect } from 'vitest';
import {
  distributeHouseholdWages,
  getSurplus,
  ROLE_TO_BUILDING,
  ROLE_TO_PRODUCTION_CHAINS,
  processPrivateBuilding,
  getNextHouseholdProductionTarget,
} from '../../src/simulation/economy/private-economy';
import type { Person, AmbitionId } from '../../src/simulation/population/person';
import type {
  ResourceStock,
  Household,
  BuiltBuilding,
  GameState,
} from '../../src/simulation/turn/game-state';
import type { PersonAmbition } from '../../src/simulation/population/person';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makePerson(
  id: string,
  householdId: string | undefined,
  opts: Partial<Pick<Person, 'age' | 'role' | 'socialStatus'>> = {},
): Person {
  return {
    id,
    householdId: householdId ?? null,
    age: opts.age ?? 25,
    role: opts.role ?? 'farmer',
    socialStatus: opts.socialStatus ?? 'settler',
    sex: 'male',
    traits: [],
    religion: 'imanian_orthodox',
    heritage: {
      bloodline: [{ group: 'imanian', fraction: 1.0 }],
      primaryCulture: 'imanian',
      culturalFluency: new Map(),
    },
    skills: { animals: 25, bargaining: 25, combat: 25, custom: 25, leadership: 25, plants: 25 },
    tradeTraining: {},
    apprenticeship: null,
    portraitVariant: 1,
    opinionSustainedSince: {},
    activeScheme: null,
    ambition: null,
    lowHappinessTurns: 0,
    relationships: new Map(),
    opinionModifiers: [],
    traitExpiry: {},
  } as unknown as Person;
}

function makeMap(people: Person[]): Map<string, Person> {
  return new Map(people.map(p => [p.id, p]));
}

const FULL_RESOURCES: ResourceStock = {
  food: 100, cattle: 50, goods: 60, steel: 10,
  lumber: 40, stone: 30, medicine: 5, gold: 20, horses: 3,
};

// ─── ROLE_TO_BUILDING ─────────────────────────────────────────────────────────

describe('ROLE_TO_BUILDING', () => {
  it('maps farmer to fields', () => {
    expect(ROLE_TO_BUILDING.farmer).toBe('fields');
  });
  it('maps blacksmith to smithy', () => {
    expect(ROLE_TO_BUILDING.blacksmith).toBe('smithy');
  });
  it('maps brewer to brewery', () => {
    expect(ROLE_TO_BUILDING.brewer).toBe('brewery');
  });
  it('maps tailor to tannery', () => {
    expect(ROLE_TO_BUILDING.tailor).toBe('tannery');
  });
  it('maps miller to mill', () => {
    expect(ROLE_TO_BUILDING.miller).toBe('mill');
  });
  it('maps herder to stable', () => {
    expect(ROLE_TO_BUILDING.herder).toBe('stable');
  });
});

// ─── distributeHouseholdWages ─────────────────────────────────────────────────

describe('distributeHouseholdWages', () => {
  describe('empty population', () => {
    it('returns zero result when no people', () => {
      const result = distributeHouseholdWages(new Map(), 5, 100);
      expect(result.totalDisbursed).toBe(0);
      expect(result.settlementGoldSpent).toBe(0);
      expect(result.payrollShortfall).toBe(false);
      expect(result.householdDeltas.size).toBe(0);
    });
  });

  describe('company-funded years (year <= 10)', () => {
    it('year 1: full wages, zero settlement cost', () => {
      const people = makeMap([
        makePerson('p1', 'hh1'),
        makePerson('p2', 'hh1'),
        makePerson('p3', 'hh2'),
      ]);
      const result = distributeHouseholdWages(people, 1, 0);
      expect(result.totalDisbursed).toBe(3);
      expect(result.settlementGoldSpent).toBe(0);
      expect(result.payrollShortfall).toBe(false);
      expect(result.householdDeltas.get('hh1')).toBe(2);
      expect(result.householdDeltas.get('hh2')).toBe(1);
    });

    it('year 10: still company funded', () => {
      const people = makeMap([makePerson('p1', 'hh1')]);
      const result = distributeHouseholdWages(people, 10, 0);
      expect(result.settlementGoldSpent).toBe(0);
      expect(result.payrollShortfall).toBe(false);
      expect(result.totalDisbursed).toBe(1);
    });

    it('does not count children (age < 16)', () => {
      const people = makeMap([
        makePerson('adult', 'hh1', { age: 20 }),
        makePerson('child', 'hh1', { age: 14 }),
      ]);
      const result = distributeHouseholdWages(people, 5, 0);
      expect(result.totalDisbursed).toBe(1);
    });

    it('does not count thralls', () => {
      const people = makeMap([
        makePerson('free', 'hh1'),
        makePerson('thrall', 'hh1', { socialStatus: 'thrall' }),
      ]);
      const result = distributeHouseholdWages(people, 5, 0);
      expect(result.totalDisbursed).toBe(1);
    });

    it('does not count unassigned workers', () => {
      const people = makeMap([
        makePerson('worker', 'hh1'),
        makePerson('idle', 'hh1', { role: 'unassigned' }),
      ]);
      const result = distributeHouseholdWages(people, 5, 0);
      expect(result.totalDisbursed).toBe(1);
    });

    it('does not count away workers', () => {
      const people = makeMap([
        makePerson('worker', 'hh1'),
        makePerson('away', 'hh1', { role: 'away' }),
      ]);
      const result = distributeHouseholdWages(people, 5, 0);
      expect(result.totalDisbursed).toBe(1);
    });

    it('does not count keth_thara role', () => {
      const people = makeMap([
        makePerson('worker', 'hh1'),
        makePerson('kt', 'hh1', { role: 'keth_thara' }),
      ]);
      const result = distributeHouseholdWages(people, 5, 0);
      expect(result.totalDisbursed).toBe(1);
    });

    it('skips persons with no householdId', () => {
      const people = makeMap([
        makePerson('homed', 'hh1'),
        makePerson('homeless', undefined),
      ]);
      const result = distributeHouseholdWages(people, 5, 0);
      expect(result.totalDisbursed).toBe(1);
      expect(result.householdDeltas.has('hh1')).toBe(true);
    });
  });

  describe('self-funded years (year > 10)', () => {
    it('year 11 with sufficient gold: full wages, settlement pays', () => {
      const people = makeMap([
        makePerson('p1', 'hh1'),
        makePerson('p2', 'hh2'),
      ]);
      const result = distributeHouseholdWages(people, 11, 50);
      expect(result.totalDisbursed).toBe(2);
      expect(result.settlementGoldSpent).toBe(2);
      expect(result.payrollShortfall).toBe(false);
      expect(result.householdDeltas.get('hh1')).toBe(1);
      expect(result.householdDeltas.get('hh2')).toBe(1);
    });

    it('year 11 exact amount: no shortfall', () => {
      const people = makeMap([makePerson('p1', 'hh1'), makePerson('p2', 'hh1')]);
      const result = distributeHouseholdWages(people, 11, 2);
      expect(result.payrollShortfall).toBe(false);
      expect(result.settlementGoldSpent).toBe(2);
    });

    it('year 11 with zero gold: shortfall, zero disbursed', () => {
      const people = makeMap([
        makePerson('p1', 'hh1'),
        makePerson('p2', 'hh2'),
      ]);
      const result = distributeHouseholdWages(people, 11, 0);
      expect(result.payrollShortfall).toBe(true);
      expect(result.totalDisbursed).toBe(0);
      expect(result.settlementGoldSpent).toBe(0);
    });

    it('year 11 partial gold: pro-rata split, shortfall true', () => {
      const people = makeMap([
        makePerson('p1', 'hh1'),
        makePerson('p2', 'hh1'), // hh1 needs 2
        makePerson('p3', 'hh2'), // hh2 needs 1
      ]);
      // totalWage = 3, but only 1 gold available
      const result = distributeHouseholdWages(people, 15, 1);
      expect(result.payrollShortfall).toBe(true);
      // hh1 share: floor(2*1/3) = 0; hh2 share: floor(1*1/3) = 0
      // Both 0 → householdDeltas should be empty
      expect(result.totalDisbursed).toBe(0);
    });

    it('year 11 partial gold with enough for floor shares', () => {
      const people = makeMap([
        makePerson('p1', 'hh1'),
        makePerson('p2', 'hh2'),
      ]);
      // totalWage = 2, gold = 2 (just enough)
      const result = distributeHouseholdWages(people, 20, 2);
      expect(result.payrollShortfall).toBe(false);
      expect(result.settlementGoldSpent).toBe(2);
    });
  });
});

// ─── getSurplus ───────────────────────────────────────────────────────────────

describe('getSurplus', () => {
  it('returns full stock when no floors set', () => {
    const resources: ResourceStock = {
      food: 50, cattle: 20, goods: 10, steel: 5,
      lumber: 30, stone: 15, medicine: 3, gold: 8, horses: 2,
    };
    const surplus = getSurplus(resources, {});
    expect(surplus.food).toBe(50);
    expect(surplus.gold).toBe(8);
    expect(surplus.lumber).toBe(30);
  });

  it('subtracts floor from each resource', () => {
    const resources: ResourceStock = { ...FULL_RESOURCES, food: 30, lumber: 40 };
    const surplus = getSurplus(resources, { food: 20, lumber: 10 });
    expect(surplus.food).toBe(10);
    expect(surplus.lumber).toBe(30);
  });

  it('returns 0 (omits key) when stock equals floor', () => {
    const resources: ResourceStock = { ...FULL_RESOURCES, food: 20 };
    const surplus = getSurplus(resources, { food: 20 });
    expect(surplus.food).toBeUndefined();
  });

  it('returns 0 (omits key) when stock is below floor', () => {
    const resources: ResourceStock = { ...FULL_RESOURCES, food: 10 };
    const surplus = getSurplus(resources, { food: 20 });
    expect(surplus.food).toBeUndefined();
  });

  it('handles zero stock with zero floor', () => {
    const resources: ResourceStock = { ...FULL_RESOURCES, medicine: 0 };
    const surplus = getSurplus(resources, { medicine: 0 });
    // 0 - 0 = 0, so key should be omitted
    expect(surplus.medicine).toBeUndefined();
  });

  it('ignores floors for resources not in partial record', () => {
    const resources: ResourceStock = { ...FULL_RESOURCES, cattle: 5 };
    // No floor for cattle — full stock is surplus
    const surplus = getSurplus(resources, { food: 10 });
    expect(surplus.cattle).toBe(5);
  });

  it('works with all resources at floor', () => {
    const floor = { ...FULL_RESOURCES };
    const surplus = getSurplus(FULL_RESOURCES, floor);
    // Every resource is at its floor exactly → all omitted
    for (const key of Object.keys(FULL_RESOURCES) as Array<keyof ResourceStock>) {
      expect(surplus[key]).toBeUndefined();
    }
  });
});

// ─── processPrivateBuilding ───────────────────────────────────────────────────

describe('processPrivateBuilding', () => {
  // ── Minimal GameState stub ──────────────────────────────────────────────────

  function makeHousehold(
    id: string,
    opts: Partial<{
      headId: string | null;
      seniorWifeId: string | null;
      memberIds: string[];
      buildingSlots: (string | null)[];
      householdGold: number;
      productionBuildingIds: string[];
    }> = {},
  ): Household {
    return {
      id,
      name: `House ${id}`,
      tradition: 'imanian',
      headId: opts.headId ?? null,
      seniorWifeId: opts.seniorWifeId ?? null,
      memberIds: opts.memberIds ?? [],
      ashkaMelathiBonds: [],
      foundedTurn: 0,
      dwellingBuildingId: null,
      productionBuildingIds: opts.productionBuildingIds ?? [],
      isAutoNamed: true,
      buildingSlots: opts.buildingSlots ?? Array(9).fill(null) as (string | null)[],
      householdGold: opts.householdGold ?? 0,
    };
  }

  function makeAmbition(type: AmbitionId): PersonAmbition {
    return { type, intensity: 0.8, targetPersonId: null, formedTurn: 0 };
  }

  function makePersonWithAmbition(
    id: string,
    householdId: string,
    ambition: PersonAmbition,
    role: Person['role'] = 'farmer',
  ): Person {
    return {
      ...makePerson(id, householdId, { role }),
      ambition,
    } as unknown as Person;
  }

  const EMPTY_RESOURCES: ResourceStock = {
    food: 0, cattle: 0, goods: 0, steel: 0,
    lumber: 0, stone: 0, medicine: 0, gold: 0, horses: 0,
  };

  function makeState(
    households: Map<string, Household>,
    people: Map<string, Person>,
    resources: Partial<ResourceStock> = {},
    floors: Partial<ResourceStock> = {},
    buildings: GameState['settlement']['buildings'] = [],
  ): GameState {
    return {
      households,
      people,
      settlement: {
        resources: { ...EMPTY_RESOURCES, ...resources },
        buildings,
        constructionQueue: [],
        economyReserves: floors,
      } as unknown as GameState['settlement'],
      turnNumber: 5,
    } as unknown as GameState;
  }

  // ── No ambition ─────────────────────────────────────────────────────────────

  it('skips household with no head and no seniorWife', () => {
    const hh = makeHousehold('h1', { householdGold: 10 });
    const state = makeState(new Map([['h1', hh]]), new Map());
    const result = processPrivateBuilding(state);
    expect(result.newProjects).toHaveLength(0);
    expect(result.logEntries).toHaveLength(0);
  });

  it('skips household whose head has no ambition', () => {
    const person = makePerson('p1', 'h1');
    const hh = makeHousehold('h1', { headId: 'p1', memberIds: ['p1'], householdGold: 10 });
    const state = makeState(new Map([['h1', hh]]), new Map([['p1', person]]));
    const result = processPrivateBuilding(state);
    expect(result.newProjects).toHaveLength(0);
  });

  it('skips household whose head has an unrelated ambition type', () => {
    // Household already has a wattle_hut → falls into Path B, where seek_council produces no building.
    const existingWattle = {
      instanceId: 'wattle_hut_0', defId: 'wattle_hut', builtTurn: 1, style: null, ownerHouseholdId: 'h1',
    } as GameState['settlement']['buildings'][number];
    const person = { ...makePerson('p1', 'h1'), ambition: makeAmbition('seek_council') } as unknown as Person;
    const hh = makeHousehold('h1', {
      headId: 'p1', memberIds: ['p1'], householdGold: 15,
      buildingSlots: ['wattle_hut_0', ...Array(8).fill(null)],
    });
    const state = makeState(
      new Map([['h1', hh]]), new Map([['p1', person]]),
      { lumber: 20 },
      {},
      [existingWattle],
    );
    const result = processPrivateBuilding(state);
    expect(result.newProjects).toHaveLength(0);
  });

  // ── seek_better_housing ─────────────────────────────────────────────────────

  it('starts a wattle_hut project when household has no dwelling and enough gold + lumber', () => {
    // wattle_hut: privateGoldCost=1, cost={lumber:5}
    const person = makePersonWithAmbition('p1', 'h1', makeAmbition('seek_better_housing'));
    const hh = makeHousehold('h1', { headId: 'p1', memberIds: ['p1'], householdGold: 2 });
    const state = makeState(
      new Map([['h1', hh]]), new Map([['p1', person]]),
      { lumber: 10 },
    );
    const result = processPrivateBuilding(state);
    expect(result.newProjects).toHaveLength(1);
    expect(result.newProjects[0]!.defId).toBe('wattle_hut');
    expect(result.newProjects[0]!.ownerHouseholdId).toBe('h1');
    expect(result.newProjects[0]!.startedTurn).toBe(5);
  });

  it('deducts household gold after purchase', () => {
    const person = makePersonWithAmbition('p1', 'h1', makeAmbition('seek_better_housing'));
    const hh = makeHousehold('h1', { headId: 'p1', memberIds: ['p1'], householdGold: 5 });
    const state = makeState(
      new Map([['h1', hh]]), new Map([['p1', person]]),
      { lumber: 10 },
    );
    const result = processPrivateBuilding(state);
    // wattle_hut costs 1 gold
    expect(result.updatedHouseholds.get('h1')!.householdGold).toBe(4);
  });

  it('deducts materials from updatedResources after purchase', () => {
    // wattle_hut costs 3 lumber
    const person = makePersonWithAmbition('p1', 'h1', makeAmbition('seek_better_housing'));
    const hh = makeHousehold('h1', { headId: 'p1', memberIds: ['p1'], householdGold: 3 });
    const state = makeState(
      new Map([['h1', hh]]), new Map([['p1', person]]),
      { lumber: 10 },
    );
    const result = processPrivateBuilding(state);
    expect(result.updatedResources.lumber).toBe(7); // 10 - 3
  });

  it('skips purchase when household gold is insufficient', () => {
    // wattle_hut costs 1 gold — insufficient if household has 0
    const person = makePersonWithAmbition('p1', 'h1', makeAmbition('seek_better_housing'));
    const hh = makeHousehold('h1', { headId: 'p1', memberIds: ['p1'], householdGold: 0 });
    const state = makeState(
      new Map([['h1', hh]]), new Map([['p1', person]]),
      { lumber: 10 },
    );
    const result = processPrivateBuilding(state);
    expect(result.newProjects).toHaveLength(0);
  });

  it('skips purchase when material surplus is too low', () => {
    // wattle_hut needs 3 lumber surplus; floor=8 → surplus=2 with 10 stock
    const person = makePersonWithAmbition('p1', 'h1', makeAmbition('seek_better_housing'));
    const hh = makeHousehold('h1', { headId: 'p1', memberIds: ['p1'], householdGold: 5 });
    const state = makeState(
      new Map([['h1', hh]]), new Map([['p1', person]]),
      { lumber: 10 },
      { lumber: 8 }, // floor = 8 → surplus = 2, need 3
    );
    const result = processPrivateBuilding(state);
    expect(result.newProjects).toHaveLength(0);
  });

  it('targets cottage (tier 2) when household already has wattle_hut in slot 0', () => {
    // cottage: privateGoldCost=3, cost={lumber:8, stone:4}
    const person = makePersonWithAmbition('p1', 'h1', makeAmbition('seek_better_housing'));
    const existingBuilding = {
      instanceId: 'wattle_hut_0', defId: 'wattle_hut', builtTurn: 1, style: null, ownerHouseholdId: 'h1',
    } as GameState['settlement']['buildings'][number];
    const hh = makeHousehold('h1', {
      headId: 'p1',
      memberIds: ['p1'],
      householdGold: 5,
      buildingSlots: ['wattle_hut_0', ...Array(8).fill(null)],
    });
    const state = makeState(
      new Map([['h1', hh]]),
      new Map([['p1', person]]),
      { lumber: 15, stone: 10 },
      {},
      [existingBuilding],
    );
    const result = processPrivateBuilding(state);
    expect(result.newProjects).toHaveLength(1);
    expect(result.newProjects[0]!.defId).toBe('cottage');
  });

  it('does not start housing project if already at compound tier', () => {
    const person = makePersonWithAmbition('p1', 'h1', makeAmbition('seek_better_housing'));
    const compoundBuilding = {
      instanceId: 'compound_0', defId: 'compound', builtTurn: 1, style: null, ownerHouseholdId: 'h1',
    } as GameState['settlement']['buildings'][number];
    const hh = makeHousehold('h1', {
      headId: 'p1',
      memberIds: ['p1'],
      householdGold: 20,
      buildingSlots: ['compound_0', ...Array(8).fill(null)],
    });
    const state = makeState(
      new Map([['h1', hh]]),
      new Map([['p1', person]]),
      { lumber: 50, gold: 10 },
      {},
      [compoundBuilding],
    );
    const result = processPrivateBuilding(state);
    expect(result.newProjects).toHaveLength(0);
  });

  // ── seek_production_building ────────────────────────────────────────────────

  it('starts a fields project for a farmer household with enough gold + lumber', () => {
    // fields: privateGoldCost=2, cost={lumber:5}. Household already has wattle_hut → Path B.
    const existingWattle = {
      instanceId: 'wattle_hut_0', defId: 'wattle_hut', builtTurn: 1, style: null, ownerHouseholdId: 'h1',
    } as GameState['settlement']['buildings'][number];
    const person = makePersonWithAmbition('p1', 'h1', makeAmbition('seek_production_building'), 'farmer');
    const hh = makeHousehold('h1', {
      headId: 'p1', memberIds: ['p1'], householdGold: 5,
      buildingSlots: ['wattle_hut_0', ...Array(8).fill(null)],
    });
    const state = makeState(
      new Map([['h1', hh]]), new Map([['p1', person]]),
      { lumber: 10 },
      {},
      [existingWattle],
    );
    const result = processPrivateBuilding(state);
    expect(result.newProjects).toHaveLength(1);
    expect(result.newProjects[0]!.defId).toBe('fields');
    expect(result.newProjects[0]!.ownerHouseholdId).toBe('h1');
  });

  it('writes a log entry on successful purchase', () => {
    const person = makePersonWithAmbition('p1', 'h1', makeAmbition('seek_better_housing'));
    const hh = makeHousehold('h1', { headId: 'p1', memberIds: ['p1'], householdGold: 3 });
    const state = makeState(
      new Map([['h1', hh]]), new Map([['p1', person]]),
      { lumber: 10 },
    );
    const result = processPrivateBuilding(state);
    expect(result.logEntries).toHaveLength(1);
    expect(result.logEntries[0]!.type).toBe('private_build_started');
    expect(result.logEntries[0]!.personId).toBe('p1');
  });

  it('processes at most one project per household per dawn', () => {
    // Two members each with a different role, both wanting production buildings
    const head = makePersonWithAmbition('p1', 'h1', makeAmbition('seek_production_building'), 'farmer');
    const member = { ...makePerson('p2', 'h1', { role: 'blacksmith' }), ambition: null } as unknown as Person;
    const hh = makeHousehold('h1', { headId: 'p1', memberIds: ['p1', 'p2'], householdGold: 20 });
    const state = makeState(
      new Map([['h1', hh]]),
      new Map([['p1', head], ['p2', member]]),
      { lumber: 30, steel: 20 },
    );
    const result = processPrivateBuilding(state);
    // The household head drives the ambition; only one project per household
    expect(result.newProjects).toHaveLength(1);
  });

  it('processes independent projects for two different households in one pass', () => {
    const p1 = makePersonWithAmbition('p1', 'h1', makeAmbition('seek_better_housing'));
    const p2 = makePersonWithAmbition('p2', 'h2', makeAmbition('seek_better_housing'));
    const hh1 = makeHousehold('h1', { headId: 'p1', memberIds: ['p1'], householdGold: 5 });
    const hh2 = makeHousehold('h2', { headId: 'p2', memberIds: ['p2'], householdGold: 5 });
    const state = makeState(
      new Map([['h1', hh1], ['h2', hh2]]),
      new Map([['p1', p1], ['p2', p2]]),
      { lumber: 10 }, // enough for both (each wattle_hut costs 3 lumber)
    );
    const result = processPrivateBuilding(state);
    expect(result.newProjects).toHaveLength(2);
    expect(result.logEntries).toHaveLength(2);
  });

  it('second household is blocked if first depletes the lumber surplus', () => {
    const p1 = makePersonWithAmbition('p1', 'h1', makeAmbition('seek_better_housing'));
    const p2 = makePersonWithAmbition('p2', 'h2', makeAmbition('seek_better_housing'));
    const hh1 = makeHousehold('h1', { headId: 'p1', memberIds: ['p1'], householdGold: 5 });
    const hh2 = makeHousehold('h2', { headId: 'p2', memberIds: ['p2'], householdGold: 5 });
    const state = makeState(
      new Map([['h1', hh1], ['h2', hh2]]),
      new Map([['p1', p1], ['p2', p2]]),
      { lumber: 3 }, // exactly one wattle_hut worth (costs 3 lumber)
    );
    const result = processPrivateBuilding(state);
    // First household gets it; second is blocked
    expect(result.newProjects).toHaveLength(1);
  });

  it('returns unchanged resources when no purchases are made', () => {
    const person = makePerson('p1', 'h1'); // no ambition
    const hh = makeHousehold('h1', { headId: 'p1', memberIds: ['p1'] });
    const resources: ResourceStock = { ...EMPTY_RESOURCES, lumber: 15 };
    const state = makeState(
      new Map([['h1', hh]]), new Map([['p1', person]]),
      { lumber: 15 },
    );
    const result = processPrivateBuilding(state);
    expect(result.updatedResources.lumber).toBe(15);
    expect(result.newProjects).toHaveLength(0);
  });

  // ── seniorWifeId fallback ───────────────────────────────────────────────────

  it('uses seniorWifeId ambition when headId is null', () => {
    const wife = makePersonWithAmbition('w1', 'h1', makeAmbition('seek_better_housing'));
    const hh = makeHousehold('h1', {
      headId: null,
      seniorWifeId: 'w1',
      memberIds: ['w1'],
      householdGold: 3,
    });
    const state = makeState(
      new Map([['h1', hh]]), new Map([['w1', wife]]),
      { lumber: 10 },
    );
    const result = processPrivateBuilding(state);
    expect(result.newProjects).toHaveLength(1);
    expect(result.newProjects[0]!.defId).toBe('wattle_hut');
    expect(result.logEntries[0]!.personId).toBe('w1');
  });

  it('skips household when both headId and seniorWifeId are null', () => {
    const hh = makeHousehold('h1', { headId: null, seniorWifeId: null, householdGold: 10 });
    const state = makeState(new Map([['h1', hh]]), new Map(), { lumber: 20 });
    expect(processPrivateBuilding(state).newProjects).toHaveLength(0);
  });

  it('skips when leaderId resolves to missing person', () => {
    // headId points to a person not in the people map
    const hh = makeHousehold('h1', { headId: 'ghost', memberIds: [], householdGold: 10 });
    const state = makeState(new Map([['h1', hh]]), new Map(), { lumber: 20 });
    expect(processPrivateBuilding(state).newProjects).toHaveLength(0);
  });

  // ── seek_production_building — detailed checks ─────────────────────────────

  it('seek_production_building: deducts correct gold from household', () => {
    // fields: privateGoldCost = 2. Household already has wattle_hut → Path B.
    const existingWattle = {
      instanceId: 'wattle_hut_0', defId: 'wattle_hut', builtTurn: 1, style: null, ownerHouseholdId: 'h1',
    } as GameState['settlement']['buildings'][number];
    const person = makePersonWithAmbition('p1', 'h1', makeAmbition('seek_production_building'), 'farmer');
    const hh = makeHousehold('h1', {
      headId: 'p1', memberIds: ['p1'], householdGold: 7,
      buildingSlots: ['wattle_hut_0', ...Array(8).fill(null)],
    });
    const state = makeState(
      new Map([['h1', hh]]), new Map([['p1', person]]),
      { lumber: 10 },
      {},
      [existingWattle],
    );
    const result = processPrivateBuilding(state);
    expect(result.updatedHouseholds.get('h1')!.householdGold).toBe(5); // 7 - 2
  });

  it('seek_production_building: deducts correct materials', () => {
    // fields: cost = { lumber: 5 }. Household already has wattle_hut → Path B.
    const existingWattle = {
      instanceId: 'wattle_hut_0', defId: 'wattle_hut', builtTurn: 1, style: null, ownerHouseholdId: 'h1',
    } as GameState['settlement']['buildings'][number];
    const person = makePersonWithAmbition('p1', 'h1', makeAmbition('seek_production_building'), 'farmer');
    const hh = makeHousehold('h1', {
      headId: 'p1', memberIds: ['p1'], householdGold: 5,
      buildingSlots: ['wattle_hut_0', ...Array(8).fill(null)],
    });
    const state = makeState(
      new Map([['h1', hh]]), new Map([['p1', person]]),
      { lumber: 20 },
      {},
      [existingWattle],
    );
    const result = processPrivateBuilding(state);
    expect(result.updatedResources.lumber).toBe(15); // 20 - 5
  });

  it('seek_production_building: blocked when gold insufficient', () => {
    // fields: privateGoldCost = 2; household has only 1. Household has wattle_hut → Path B.
    const existingWattle = {
      instanceId: 'wattle_hut_0', defId: 'wattle_hut', builtTurn: 1, style: null, ownerHouseholdId: 'h1',
    } as GameState['settlement']['buildings'][number];
    const person = makePersonWithAmbition('p1', 'h1', makeAmbition('seek_production_building'), 'farmer');
    const hh = makeHousehold('h1', {
      headId: 'p1', memberIds: ['p1'], householdGold: 1,
      buildingSlots: ['wattle_hut_0', ...Array(8).fill(null)],
    });
    const state = makeState(
      new Map([['h1', hh]]), new Map([['p1', person]]),
      { lumber: 20 },
      {},
      [existingWattle],
    );
    expect(processPrivateBuilding(state).newProjects).toHaveLength(0);
  });

  it('seek_production_building: blocked when material floor leaves insufficient surplus', () => {
    // fields needs 5 lumber; stock=10, floor=6 → surplus=4, not enough. Household has wattle_hut → Path B.
    const existingWattle = {
      instanceId: 'wattle_hut_0', defId: 'wattle_hut', builtTurn: 1, style: null, ownerHouseholdId: 'h1',
    } as GameState['settlement']['buildings'][number];
    const person = makePersonWithAmbition('p1', 'h1', makeAmbition('seek_production_building'), 'farmer');
    const hh = makeHousehold('h1', {
      headId: 'p1', memberIds: ['p1'], householdGold: 5,
      buildingSlots: ['wattle_hut_0', ...Array(8).fill(null)],
    });
    const state = makeState(
      new Map([['h1', hh]]), new Map([['p1', person]]),
      { lumber: 10 },
      { lumber: 6 }, // surplus = 4 < 5 needed
      [existingWattle],
    );
    expect(processPrivateBuilding(state).newProjects).toHaveLength(0);
  });

  it('seek_production_building: skips already-owned building, picks next member', () => {
    // Head (p1) is a blacksmith but hh already has smithy in slot 1
    // Member (p2) is a brewer with no brewery — should pick brewery
    // Slot 0 has a wattle_hut so the household falls into Path B.
    const existingWattle = {
      instanceId: 'wattle_hut_0', defId: 'wattle_hut', builtTurn: 1, style: null, ownerHouseholdId: 'h1',
    } as GameState['settlement']['buildings'][number];
    const existingSmith = {
      instanceId: 'smithy_1', defId: 'smithy', builtTurn: 1, style: null, ownerHouseholdId: 'h1',
    } as GameState['settlement']['buildings'][number];
    const head = makePersonWithAmbition('p1', 'h1', makeAmbition('seek_production_building'), 'blacksmith');
    const member = { ...makePerson('p2', 'h1', { role: 'brewer' }) } as unknown as Person;
    const hh = makeHousehold('h1', {
      headId: 'p1',
      memberIds: ['p1', 'p2'],
      householdGold: 10,
      buildingSlots: ['wattle_hut_0', 'smithy_1', ...Array(7).fill(null)],
    });
    const state = makeState(
      new Map([['h1', hh]]),
      new Map([['p1', head], ['p2', member]]),
      { lumber: 15, stone: 10 },
      {},
      [existingWattle, existingSmith],
    );
    const result = processPrivateBuilding(state);
    expect(result.newProjects).toHaveLength(1);
    expect(result.newProjects[0]!.defId).toBe('brewery');
  });

  it('seek_production_building: no project when all specialist members already have their buildings', () => {
    // Farmer with plants=25 can reach: fields (agri T1, threshold 0) + orchard (orchard T1, threshold 0).
    // T2 of both chains requires plants≥26 — just out of reach. Owning T1 of both exhausts all chains.
    // Slot 0 = wattle_hut (dwelling), slot 1 = fields, slot 2 = orchard → chains return null → no project.
    const existingWattle = {
      instanceId: 'wattle_hut_0', defId: 'wattle_hut', builtTurn: 1, style: null, ownerHouseholdId: 'h1',
    } as GameState['settlement']['buildings'][number];
    const existingFields = {
      instanceId: 'fields_1', defId: 'fields', builtTurn: 1, style: null, ownerHouseholdId: 'h1',
    } as GameState['settlement']['buildings'][number];
    const existingOrchard = {
      instanceId: 'orchard_1', defId: 'orchard', builtTurn: 1, style: null, ownerHouseholdId: 'h1',
    } as GameState['settlement']['buildings'][number];
    const head = makePersonWithAmbition('p1', 'h1', makeAmbition('seek_production_building'), 'farmer');
    const hh = makeHousehold('h1', {
      headId: 'p1',
      memberIds: ['p1'],
      householdGold: 10,
      buildingSlots: ['wattle_hut_0', 'fields_1', 'orchard_1', ...Array(6).fill(null)],
    });
    const state = makeState(
      new Map([['h1', hh]]),
      new Map([['p1', head]]),
      { lumber: 20 },
      {},
      [existingWattle, existingFields, existingOrchard],
    );
    expect(processPrivateBuilding(state).newProjects).toHaveLength(0);
  });

  it('seek_production_building: skips member whose role has no ROLE_TO_BUILDING mapping', () => {
    // 'trader' is not in ROLE_TO_BUILDING → desiredBuildId stays null → loop continues.
    // Household has wattle_hut → Path B.
    const existingWattle = {
      instanceId: 'wattle_hut_0', defId: 'wattle_hut', builtTurn: 1, style: null, ownerHouseholdId: 'h1',
    } as GameState['settlement']['buildings'][number];
    const person = makePersonWithAmbition('p1', 'h1', makeAmbition('seek_production_building'), 'trader');
    const hh = makeHousehold('h1', {
      headId: 'p1', memberIds: ['p1'], householdGold: 10,
      buildingSlots: ['wattle_hut_0', ...Array(8).fill(null)],
    });
    const state = makeState(
      new Map([['h1', hh]]), new Map([['p1', person]]),
      { lumber: 20 },
      {},
      [existingWattle],
    );
    expect(processPrivateBuilding(state).newProjects).toHaveLength(0);
  });

  it('seek_production_building: gracefully skips member missing from people map', () => {
    // memberIds contains a stale ID not present in state.people.
    // Household has wattle_hut → Path B; p1 is farmer → should still find fields.
    const existingWattle = {
      instanceId: 'wattle_hut_0', defId: 'wattle_hut', builtTurn: 1, style: null, ownerHouseholdId: 'h1',
    } as GameState['settlement']['buildings'][number];
    const head = makePersonWithAmbition('p1', 'h1', makeAmbition('seek_production_building'), 'farmer');
    const hh = makeHousehold('h1', {
      headId: 'p1',
      memberIds: ['p1', 'ghost'],
      householdGold: 10,
      buildingSlots: ['wattle_hut_0', ...Array(8).fill(null)],
    });
    const state = makeState(
      new Map([['h1', hh]]),
      new Map([['p1', head]]), // 'ghost' not in the map
      { lumber: 20 },
      {},
      [existingWattle],
    );
    const result = processPrivateBuilding(state);
    expect(result.newProjects).toHaveLength(1);
    expect(result.newProjects[0]!.defId).toBe('fields');
  });

  // ── Project shape ───────────────────────────────────────────────────────────

  it('project totalPoints equals buildSeasons × 100', () => {
    // wattle_hut buildSeasons = 1 → totalPoints = 100
    const person = makePersonWithAmbition('p1', 'h1', makeAmbition('seek_better_housing'));
    const hh = makeHousehold('h1', { headId: 'p1', memberIds: ['p1'], householdGold: 3 });
    const state = makeState(
      new Map([['h1', hh]]), new Map([['p1', person]]),
      { lumber: 10 },
    );
    const result = processPrivateBuilding(state);
    expect(result.newProjects[0]!.totalPoints).toBe(100);
    expect(result.newProjects[0]!.progressPoints).toBe(0);
  });

  it('project id encodes building type and household id', () => {
    const person = makePersonWithAmbition('p1', 'h1', makeAmbition('seek_better_housing'));
    const hh = makeHousehold('h1', { headId: 'p1', memberIds: ['p1'], householdGold: 3 });
    const state = makeState(
      new Map([['h1', hh]]), new Map([['p1', person]]),
      { lumber: 10 },
    );
    const result = processPrivateBuilding(state);
    expect(result.newProjects[0]!.id).toContain('wattle_hut');
    expect(result.newProjects[0]!.id).toContain('h1');
  });

  it('project auto-assigns the head as builder, correct turn and owner', () => {
    const person = makePersonWithAmbition('p1', 'h1', makeAmbition('seek_better_housing'));
    const hh = makeHousehold('h1', { headId: 'p1', memberIds: ['p1'], householdGold: 3 });
    const state = makeState(
      new Map([['h1', hh]]), new Map([['p1', person]]),
      { lumber: 10 },
    );
    const result = processPrivateBuilding(state);
    // The head is the only eligible member, so they become the auto-builder.
    expect(result.newProjects[0]!.assignedWorkerIds).toEqual(['p1']);
    expect(result.newProjects[0]!.autoBuilderPrevRoles).toMatchObject({ p1: expect.any(String) });
    expect(result.newProjects[0]!.startedTurn).toBe(5);
    expect(result.newProjects[0]!.ownerHouseholdId).toBe('h1');
    // The autoBuilderAssignments array should list the assignment.
    expect(result.autoBuilderAssignments).toHaveLength(1);
    expect(result.autoBuilderAssignments[0]!.personId).toBe('p1');
  });

  // ── Log entry content ───────────────────────────────────────────────────────

  it('log description contains the person first name', () => {
    const base = makePerson('p1', 'h1');
    const person = {
      ...base,
      firstName: 'Mira',
      ambition: makeAmbition('seek_better_housing'),
    } as unknown as Person;
    const hh = makeHousehold('h1', { headId: 'p1', memberIds: ['p1'], householdGold: 3 });
    const state = makeState(
      new Map([['h1', hh]]), new Map([['p1', person]]),
      { lumber: 10 },
    );
    const result = processPrivateBuilding(state);
    expect(result.logEntries[0]!.description).toContain('Mira');
  });

  it('log entry turn matches state turnNumber', () => {
    const person = makePersonWithAmbition('p1', 'h1', makeAmbition('seek_better_housing'));
    const hh = makeHousehold('h1', { headId: 'p1', memberIds: ['p1'], householdGold: 3 });
    const state = makeState(
      new Map([['h1', hh]]), new Map([['p1', person]]),
      { lumber: 10 },
    );
    const result = processPrivateBuilding(state);
    expect(result.logEntries[0]!.turn).toBe(5);
  });

  // ── settlement.economyReserves used as floors ───────────────────────────────

  it('uses settlement.economyReserves (not communalResourceMinimum) as the reserve floor', () => {
    // floor in economyReserves blocks purchase; communalResourceMinimum is not set
    const person = makePersonWithAmbition('p1', 'h1', makeAmbition('seek_better_housing'));
    const hh = makeHousehold('h1', { headId: 'p1', memberIds: ['p1'], householdGold: 5 });
    // stock=10 lumber, floor=8 → surplus=2, need 3 → blocked
    const state = makeState(
      new Map([['h1', hh]]), new Map([['p1', person]]),
      { lumber: 10 },
      { lumber: 8 },
    );
    expect(processPrivateBuilding(state).newProjects).toHaveLength(0);
  });

  it('purchase succeeds when economyReserves floor leaves exactly enough surplus', () => {
    // wattle_hut needs 3 lumber; stock=10, floor=7 → surplus=3 exactly
    const person = makePersonWithAmbition('p1', 'h1', makeAmbition('seek_better_housing'));
    const hh = makeHousehold('h1', { headId: 'p1', memberIds: ['p1'], householdGold: 3 });
    const state = makeState(
      new Map([['h1', hh]]), new Map([['p1', person]]),
      { lumber: 10 },
      { lumber: 7 }, // surplus = 3 exactly
    );
    const result = processPrivateBuilding(state);
    expect(result.newProjects).toHaveLength(1);
    expect(result.updatedResources.lumber).toBe(7); // 10 - 3
  });

  it('missing economyReserves (old save) defaults to {} — all stock is surplus', () => {
    const person = makePersonWithAmbition('p1', 'h1', makeAmbition('seek_better_housing'));
    const hh = makeHousehold('h1', { headId: 'p1', memberIds: ['p1'], householdGold: 3 });
    // Build a state without economyReserves to simulate an old save
    const state = {
      households: new Map([['h1', hh]]),
      people: new Map([['p1', person]]),
      settlement: {
        resources: { ...EMPTY_RESOURCES, lumber: 5 },
        buildings: [],
        constructionQueue: [],
        // economyReserves intentionally omitted
      },
      turnNumber: 1,
    } as unknown as GameState;
    const result = processPrivateBuilding(state);
    expect(result.newProjects).toHaveLength(1); // should succeed with full lumber as surplus
  });

  // ── Cumulative resource deductions ─────────────────────────────────────────

  it('cumulative resource deductions are correct when two households buy in one pass', () => {
    // Each buys a wattle_hut (3 lumber). Total deduction: 6 lumber.
    const p1 = makePersonWithAmbition('p1', 'h1', makeAmbition('seek_better_housing'));
    const p2 = makePersonWithAmbition('p2', 'h2', makeAmbition('seek_better_housing'));
    const hh1 = makeHousehold('h1', { headId: 'p1', memberIds: ['p1'], householdGold: 5 });
    const hh2 = makeHousehold('h2', { headId: 'p2', memberIds: ['p2'], householdGold: 5 });
    const state = makeState(
      new Map([['h1', hh1], ['h2', hh2]]),
      new Map([['p1', p1], ['p2', p2]]),
      { lumber: 20 },
    );
    const result = processPrivateBuilding(state);
    expect(result.newProjects).toHaveLength(2);
    expect(result.updatedResources.lumber).toBe(14); // 20 - 6
  });

  it('gold deduction from two households is independent', () => {
    const p1 = makePersonWithAmbition('p1', 'h1', makeAmbition('seek_better_housing'));
    const p2 = makePersonWithAmbition('p2', 'h2', makeAmbition('seek_better_housing'));
    const hh1 = makeHousehold('h1', { headId: 'p1', memberIds: ['p1'], householdGold: 4 });
    const hh2 = makeHousehold('h2', { headId: 'p2', memberIds: ['p2'], householdGold: 6 });
    const state = makeState(
      new Map([['h1', hh1], ['h2', hh2]]),
      new Map([['p1', p1], ['p2', p2]]),
      { lumber: 20 },
    );
    const result = processPrivateBuilding(state);
    // wattle_hut costs 1 gold each
    expect(result.updatedHouseholds.get('h1')!.householdGold).toBe(3);
    expect(result.updatedHouseholds.get('h2')!.householdGold).toBe(5);
  });
});

// ─── replaceDeadHouseholdBuilders ─────────────────────────────────────────────

import { replaceDeadHouseholdBuilders } from '../../src/simulation/economy/private-economy';
import type { ConstructionProject } from '../../src/simulation/turn/game-state';

describe('replaceDeadHouseholdBuilders', () => {
  function makeProject(
    id: string,
    ownerHouseholdId: string | null,
    assignedWorkerIds: string[],
    autoBuilderPrevRoles?: Partial<Record<string, string>>,
  ): ConstructionProject {
    return {
      id,
      defId: 'wattle_hut',
      style: null,
      progressPoints: 50,
      totalPoints: 100,
      assignedWorkerIds,
      startedTurn: 1,
      resourcesSpent: {},
      ownerHouseholdId,
      ...(autoBuilderPrevRoles ? { autoBuilderPrevRoles } : {}),
    } as unknown as ConstructionProject;
  }

  function makeHH(
    id: string,
    memberIds: string[],
    headId: string | null = memberIds[0] ?? null,
  ): Household {
    return {
      id,
      name: `Household ${id}`,
      isAutoNamed: true,
      tradition: 'imanian',
      headId,
      seniorWifeId: null,
      memberIds,
      ashkaMelathiBonds: [],
      foundedTurn: 0,
      dwellingBuildingId: null,
      productionBuildingIds: [],
      buildingSlots: Array(9).fill(null),
      householdGold: 0,
    };
  }

  function makeAdult(id: string, role: Person['role'] = 'farmer'): Person {
    return {
      id,
      firstName: id,
      familyName: 'Test',
      age: 25,
      sex: 'male' as const,
      role,
      householdId: null,
      skills: { animals: 25, bargaining: 25, combat: 25, custom: 25, leadership: 25, plants: 25 },
    } as unknown as Person;
  }

  it('assigns a replacement builder from the owning household when the original died', () => {
    const replacement = makeAdult('r1', 'farmer');
    const hh = makeHH('hh1', ['r1']);

    // Before: project had 'dead_builder'; after processConstruction stripped them there are 0 workers
    const prev = makeProject('proj1', 'hh1', ['dead_builder']);
    const after = makeProject('proj1', 'hh1', []); // dead builder already stripped

    const { updatedQueue, updatedPeople } = replaceDeadHouseholdBuilders(
      [after],
      [prev],
      new Map([['r1', replacement]]),
      new Map([['hh1', hh]]),
      10,
    );

    expect(updatedQueue[0]!.assignedWorkerIds).toEqual(['r1']);
    expect(updatedQueue[0]!.autoBuilderPrevRoles).toMatchObject({ r1: 'farmer' });
    expect(updatedPeople.get('r1')!.role).toBe('builder');
    expect(updatedPeople.get('r1')!.roleAssignedTurn).toBe(10);
  });

  it('does NOT auto-replace a player-built project (no ownerHouseholdId)', () => {
    const replacement = makeAdult('r1');
    const hh = makeHH('hh1', ['r1']);

    const prev = makeProject('proj1', null, ['dead_builder']); // ownerHouseholdId = null
    const after = makeProject('proj1', null, []);

    const { updatedQueue, updatedPeople } = replaceDeadHouseholdBuilders(
      [after],
      [prev],
      new Map([['r1', replacement]]),
      new Map([['hh1', hh]]),
      10,
    );

    expect(updatedQueue[0]!.assignedWorkerIds).toHaveLength(0);
    expect(updatedPeople.size).toBe(0);
  });

  it('does NOT auto-replace a project that never had any builders', () => {
    const replacement = makeAdult('r1');
    const hh = makeHH('hh1', ['r1']);

    // Both prev and after have 0 workers — project was never staffed
    const prev = makeProject('proj1', 'hh1', []);
    const after = makeProject('proj1', 'hh1', []);

    const { updatedQueue, updatedPeople } = replaceDeadHouseholdBuilders(
      [after],
      [prev],
      new Map([['r1', replacement]]),
      new Map([['hh1', hh]]),
      10,
    );

    expect(updatedQueue[0]!.assignedWorkerIds).toHaveLength(0);
    expect(updatedPeople.size).toBe(0);
  });

  it('does not replace when the household has no eligible members (all under 16 or protected)', () => {
    const child = { ...makeAdult('c1'), age: 10 } as unknown as Person;
    const hh = makeHH('hh1', ['c1']);

    const prev = makeProject('proj1', 'hh1', ['dead_one']);
    const after = makeProject('proj1', 'hh1', []);

    const { updatedQueue, updatedPeople } = replaceDeadHouseholdBuilders(
      [after],
      [prev],
      new Map([['c1', child]]),
      new Map([['hh1', hh]]),
      10,
    );

    expect(updatedQueue[0]!.assignedWorkerIds).toHaveLength(0);
    expect(updatedPeople.size).toBe(0);
  });

  it('prefers an unassigned non-leader over the leader as replacement', () => {
    const leader = makeAdult('leader1', 'guard');
    const member = makeAdult('member1', 'unassigned');
    const hh = makeHH('hh1', ['leader1', 'member1'], 'leader1');

    const prev = makeProject('proj1', 'hh1', ['dead_one']);
    const after = makeProject('proj1', 'hh1', []);

    const { updatedQueue } = replaceDeadHouseholdBuilders(
      [after],
      [prev],
      new Map([['leader1', leader], ['member1', member]]),
      new Map([['hh1', hh]]),
      10,
    );

    expect(updatedQueue[0]!.assignedWorkerIds).toEqual(['member1']);
  });

  it('leaves a project with live workers untouched', () => {
    const worker = makeAdult('w1', 'farmer');
    const hh = makeHH('hh1', ['w1', 'spare1']);

    const prev = makeProject('proj1', 'hh1', ['w1']);
    const after = makeProject('proj1', 'hh1', ['w1']); // still has w1

    const { updatedQueue, updatedPeople } = replaceDeadHouseholdBuilders(
      [after],
      [prev],
      new Map([['w1', worker]]),
      new Map([['hh1', hh]]),
      10,
    );

    expect(updatedQueue[0]!.assignedWorkerIds).toEqual(['w1']);
    expect(updatedPeople.size).toBe(0);
  });
});

// ─── getNextHouseholdProductionTarget ──────────────────────────────────────────

describe('getNextHouseholdProductionTarget', () => {
  function makeSlottedHH(id: string, slots: (string | null)[] = Array(9).fill(null)): Household {
    return {
      id,
      name: `HH ${id}`,
      tradition: 'imanian',
      headId: null,
      seniorWifeId: null,
      memberIds: [],
      ashkaMelathiBonds: [],
      foundedTurn: 0,
      dwellingBuildingId: null,
      productionBuildingIds: [],
      isAutoNamed: true,
      buildingSlots: slots,
      householdGold: 0,
    };
  }

  function makeBuilding(defId: string, instanceId: string): BuiltBuilding {
    return {
      defId,
      instanceId,
      builtTurn: 0,
      style: null,
      claimedByPersonIds: [],
      ownerHouseholdId: null,
      assignedWorkerIds: [],
    } as unknown as BuiltBuilding;
  }

  it('farmer with no buildings targets agriculture tier 1 (fields)', () => {
    // plants=25 ≥ CHAIN_TIER_SKILL_THRESHOLDS[1]=0
    const farmer = makePerson('p1', 'hh1', { role: 'farmer' });
    expect(getNextHouseholdProductionTarget(farmer, makeSlottedHH('hh1'), [])).toBe('fields');
  });

  it('farmer with fields already owned (plants=25 < 26) targets orchard tier 1', () => {
    // Agriculture tier 2 threshold=26 blocked; orchard tier 1 threshold=0 → 'orchard'
    const farmer = makePerson('p1', 'hh1', { role: 'farmer' });
    const hh = makeSlottedHH('hh1', [null, 'fi', null, null, null, null, null, null, null]);
    expect(getNextHouseholdProductionTarget(farmer, hh, [makeBuilding('fields', 'fi')])).toBe('orchard');
  });

  it('farmer with fields and orchard but low skill returns null', () => {
    // Both accessible tiers (fields + orchard) already owned; tier 2 of each blocked by skill
    const farmer = makePerson('p1', 'hh1', { role: 'farmer' });
    const hh = makeSlottedHH('hh1', [null, 'fi', 'or', null, null, null, null, null, null]);
    const buildings = [makeBuilding('fields', 'fi'), makeBuilding('orchard', 'or')];
    expect(getNextHouseholdProductionTarget(farmer, hh, buildings)).toBeNull();
  });

  it('blacksmith with no smithy returns "smithy"', () => {
    const smith = makePerson('p1', 'hh1', { role: 'blacksmith' });
    expect(getNextHouseholdProductionTarget(smith, makeSlottedHH('hh1'), [])).toBe('smithy');
  });

  it('blacksmith with smithy already owned returns null', () => {
    const smith = makePerson('p1', 'hh1', { role: 'blacksmith' });
    const hh = makeSlottedHH('hh1', [null, 'sm', null, null, null, null, null, null, null]);
    expect(getNextHouseholdProductionTarget(smith, hh, [makeBuilding('smithy', 'sm')])).toBeNull();
  });

  it('guard returns null (no production chain defined)', () => {
    const guard = makePerson('p1', 'hh1', { role: 'guard' });
    expect(getNextHouseholdProductionTarget(guard, makeSlottedHH('hh1'), [])).toBeNull();
  });
});
