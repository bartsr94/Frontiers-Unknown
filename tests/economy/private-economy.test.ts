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
  food: 100, cattle: 50, wealth: 80, steel: 10,
  lumber: 40, stone: 30, medicine: 5, horses: 3,
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
  it('tailor is not in ROLE_TO_BUILDING (uses chains instead)', () => {
    expect(ROLE_TO_BUILDING.tailor).toBeUndefined();
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
      food: 50, cattle: 20, wealth: 10, steel: 5,
      lumber: 30, stone: 15, medicine: 3, horses: 2,
    };
    const surplus = getSurplus(resources, {});
    expect(surplus.food).toBe(50);
    expect(surplus.wealth).toBe(10);
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
      householdWealth: number;
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
      householdWealth: opts.householdWealth ?? 0,
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
    food: 0, cattle: 0, wealth: 0, steel: 0,
    lumber: 0, stone: 0, medicine: 0, horses: 0,
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
    const hh = makeHousehold('h1', { householdWealth: 10 });
    const state = makeState(new Map([['h1', hh]]), new Map());
    const result = processPrivateBuilding(state);
    expect(result.newProjects).toHaveLength(0);
    expect(result.logEntries).toHaveLength(0);
  });

  it('skips household whose head has no ambition', () => {
    const person = makePerson('p1', 'h1');
    const hh = makeHousehold('h1', { headId: 'p1', memberIds: ['p1'], householdWealth: 10 });
    const state = makeState(new Map([['h1', hh]]), new Map([['p1', person]]));
    const result = processPrivateBuilding(state);
    expect(result.newProjects).toHaveLength(0);
  });

  it('commissions production building via Path C even when leader has an unrelated ambition', () => {
    // Path C fires unconditionally for production-role members once the household has a dwelling,
    // regardless of what ambition (if any) the leader holds.
    const existingWattle = {
      instanceId: 'wattle_hut_0', defId: 'wattle_hut', builtTurn: 1, style: null, ownerHouseholdId: 'h1',
    } as GameState['settlement']['buildings'][number];
    const person = { ...makePerson('p1', 'h1'), ambition: makeAmbition('seek_council') } as unknown as Person;
    const hh = makeHousehold('h1', {
      headId: 'p1', memberIds: ['p1'], householdWealth: 15,
      buildingSlots: ['wattle_hut_0', ...Array(8).fill(null)],
    });
    const state = makeState(
      new Map([['h1', hh]]), new Map([['p1', person]]),
      { lumber: 20 },
      {},
      [existingWattle],
    );
    const result = processPrivateBuilding(state);
    // Farmer with a wattle_hut now commissions fields via Path C
    expect(result.newProjects).toHaveLength(1);
    expect(result.newProjects[0]!.defId).toBe('fields');
  });

  // ── seek_better_housing ─────────────────────────────────────────────────────

  it('starts a wattle_hut project when household has no dwelling and enough wealth + lumber', () => {
    // wattle_hut: privateWealthCost=1, cost={lumber:5}
    const person = makePersonWithAmbition('p1', 'h1', makeAmbition('seek_better_housing'));
    const hh = makeHousehold('h1', { headId: 'p1', memberIds: ['p1'], householdWealth: 2 });
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

  it('deducts household wealth after purchase', () => {
    const person = makePersonWithAmbition('p1', 'h1', makeAmbition('seek_better_housing'));
    const hh = makeHousehold('h1', { headId: 'p1', memberIds: ['p1'], householdWealth: 5 });
    const state = makeState(
      new Map([['h1', hh]]), new Map([['p1', person]]),
      { lumber: 10 },
    );
    const result = processPrivateBuilding(state);
    // wattle_hut costs 1 wealth
    expect(result.updatedHouseholds.get('h1')!.householdWealth).toBe(4);
  });

  it('deducts materials from updatedResources after purchase', () => {
    // wattle_hut costs 3 lumber
    const person = makePersonWithAmbition('p1', 'h1', makeAmbition('seek_better_housing'));
    const hh = makeHousehold('h1', { headId: 'p1', memberIds: ['p1'], householdWealth: 3 });
    const state = makeState(
      new Map([['h1', hh]]), new Map([['p1', person]]),
      { lumber: 10 },
    );
    const result = processPrivateBuilding(state);
    expect(result.updatedResources.lumber).toBe(7); // 10 - 3
  });

  it('skips purchase when household wealth is insufficient', () => {
    // wattle_hut costs 1 wealth — insufficient if household has 0
    const person = makePersonWithAmbition('p1', 'h1', makeAmbition('seek_better_housing'));
    const hh = makeHousehold('h1', { headId: 'p1', memberIds: ['p1'], householdWealth: 0 });
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
    const hh = makeHousehold('h1', { headId: 'p1', memberIds: ['p1'], householdWealth: 5 });
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
      householdWealth: 5,
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

  it('does not start any project for a non-production role at compound tier when food is sufficient', () => {
    // guard has no ROLE_TO_BUILDING or chain mapping; compound is the top housing tier.
    // Path C has nothing to build. Food is plentiful so Path D (food-security bypass) also
    // does not fire → no project should start.
    const person = makePersonWithAmbition('p1', 'h1', makeAmbition('seek_better_housing'), 'guard');
    const compoundBuilding = {
      instanceId: 'compound_0', defId: 'compound', builtTurn: 1, style: null, ownerHouseholdId: 'h1',
    } as GameState['settlement']['buildings'][number];
    const hh = makeHousehold('h1', {
      headId: 'p1',
      memberIds: ['p1'],
      householdWealth: 20,
      buildingSlots: ['compound_0', ...Array(8).fill(null)],
    });
    const state = makeState(
      new Map([['h1', hh]]),
      new Map([['p1', person]]),
      { lumber: 50, wealth: 10, food: 100, stone: 30 }, // plenty of all resources — Path D stays silent
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
      headId: 'p1', memberIds: ['p1'], householdWealth: 5,
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
    const hh = makeHousehold('h1', { headId: 'p1', memberIds: ['p1'], householdWealth: 3 });
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
    const hh = makeHousehold('h1', { headId: 'p1', memberIds: ['p1', 'p2'], householdWealth: 20 });
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
    const hh1 = makeHousehold('h1', { headId: 'p1', memberIds: ['p1'], householdWealth: 5 });
    const hh2 = makeHousehold('h2', { headId: 'p2', memberIds: ['p2'], householdWealth: 5 });
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
    const hh1 = makeHousehold('h1', { headId: 'p1', memberIds: ['p1'], householdWealth: 5 });
    const hh2 = makeHousehold('h2', { headId: 'p2', memberIds: ['p2'], householdWealth: 5 });
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

  // ── Path D: food-security bypass ───────────────────────────────────────────

  it('Path D: forager household commissions fields when food is low', () => {
    // A gather_food (forager) household has no food production buildings.
    // With food=3 and 1 person, foodPerPerson=3 < 6 → Path D fires.
    const existingWattle = {
      instanceId: 'wattle_hut_0', defId: 'wattle_hut', builtTurn: 1, style: null, ownerHouseholdId: 'h1',
    } as GameState['settlement']['buildings'][number];
    const person = makePerson('p1', 'h1', { role: 'gather_food' });
    const hh = makeHousehold('h1', {
      headId: 'p1', memberIds: ['p1'], householdWealth: 5,
      buildingSlots: ['wattle_hut_0', ...Array(8).fill(null)],
    });
    const state = makeState(
      new Map([['h1', hh]]), new Map([['p1', person]]),
      { food: 3, lumber: 10 }, // food low (3/1=3 < 6)
      {},
      [existingWattle],
    );
    const result = processPrivateBuilding(state);
    expect(result.newProjects).toHaveLength(1);
    expect(result.newProjects[0]!.defId).toBe('fields');
  });

  it('Path D: guard household commissions fields when food is critically low', () => {
    // Guard role has no production mapping; but when food is scarce any household
    // without food infrastructure should build fields.
    const existingWattle = {
      instanceId: 'wattle_hut_0', defId: 'wattle_hut', builtTurn: 1, style: null, ownerHouseholdId: 'h1',
    } as GameState['settlement']['buildings'][number];
    const person = makePerson('p1', 'h1', { role: 'guard' });
    const hh = makeHousehold('h1', {
      headId: 'p1', memberIds: ['p1'], householdWealth: 10,
      buildingSlots: ['wattle_hut_0', ...Array(8).fill(null)],
    });
    const state = makeState(
      new Map([['h1', hh]]), new Map([['p1', person]]),
      { food: 2, lumber: 20 }, // food critically low
      {},
      [existingWattle],
    );
    const result = processPrivateBuilding(state);
    expect(result.newProjects).toHaveLength(1);
    expect(result.newProjects[0]!.defId).toBe('fields');
  });

  it('Path D: does not fire when food is sufficient', () => {
    // food=60, 1 person → 60 per person, well above threshold. No project.
    const existingWattle = {
      instanceId: 'wattle_hut_0', defId: 'wattle_hut', builtTurn: 1, style: null, ownerHouseholdId: 'h1',
    } as GameState['settlement']['buildings'][number];
    const person = makePerson('p1', 'h1', { role: 'gather_food' });
    const hh = makeHousehold('h1', {
      headId: 'p1', memberIds: ['p1'], householdWealth: 5,
      buildingSlots: ['wattle_hut_0', ...Array(8).fill(null)],
    });
    const state = makeState(
      new Map([['h1', hh]]), new Map([['p1', person]]),
      { food: 60, lumber: 50, stone: 30 }, // all resources plentiful — no pressure
      {},
      [existingWattle],
    );
    const result = processPrivateBuilding(state);
    expect(result.newProjects).toHaveLength(0);
  });

  it('Path D: does not fire when household already has a food production building', () => {
    // Household has wattle_hut + fields already; food is low but they're covered.
    const existingWattle = {
      instanceId: 'wattle_hut_0', defId: 'wattle_hut', builtTurn: 1, style: null, ownerHouseholdId: 'h1',
    } as GameState['settlement']['buildings'][number];
    const existingFields = {
      instanceId: 'fields_0', defId: 'fields', builtTurn: 2, style: null, ownerHouseholdId: 'h1',
    } as GameState['settlement']['buildings'][number];
    const person = makePerson('p1', 'h1', { role: 'gather_food' });
    const hh = makeHousehold('h1', {
      headId: 'p1', memberIds: ['p1'], householdWealth: 5,
      buildingSlots: ['wattle_hut_0', 'fields_0', ...Array(7).fill(null)],
    });
    const state = makeState(
      new Map([['h1', hh]]), new Map([['p1', person]]),
      { food: 2, lumber: 20, stone: 30 }, // food low but household is already equipped; stone/lumber fine
      {},
      [existingWattle, existingFields],
    );
    const result = processPrivateBuilding(state);
    expect(result.newProjects).toHaveLength(0);
  });

  // ── Path D: lumber-pressure bypass ─────────────────────────────────────────

  it('Path D lumber: commissions woodcutter_hut when lumber is low', () => {
    const existingWattle = {
      instanceId: 'wattle_hut_0', defId: 'wattle_hut', builtTurn: 1, style: null, ownerHouseholdId: 'h1',
    } as GameState['settlement']['buildings'][number];
    const person = makePerson('p1', 'h1', { role: 'gather_food' });
    const hh = makeHousehold('h1', {
      headId: 'p1', memberIds: ['p1'], householdWealth: 5,
      buildingSlots: ['wattle_hut_0', ...Array(8).fill(null)],
    });
    // lumber=5, 1 person → 5 < LUMBER_LOW_PER_PERSON(8) → fires
    const state = makeState(
      new Map([['h1', hh]]), new Map([['p1', person]]),
      { food: 30, lumber: 5, stone: 30 },
      {},
      [existingWattle],
    );
    const result = processPrivateBuilding(state);
    expect(result.newProjects).toHaveLength(1);
    expect(result.newProjects[0]!.defId).toBe('woodcutter_hut');
  });

  it('Path D lumber: auto-assigns an eligible member to gather_lumber when woodcutter_hut is commissioned', () => {
    const existingWattle = {
      instanceId: 'wattle_hut_0', defId: 'wattle_hut', builtTurn: 1, style: null, ownerHouseholdId: 'h1',
    } as GameState['settlement']['buildings'][number];
    // p1 is the head → picked as builder and excluded from auto-role
    // p2 (gather_food) is the candidate who gets reassigned to gather_lumber
    const p1 = makePerson('p1', 'h1', { role: 'gather_food' });
    const p2 = makePerson('p2', 'h1', { role: 'gather_food' });
    const hh = makeHousehold('h1', {
      headId: 'p1', memberIds: ['p1', 'p2'], householdWealth: 5,
      buildingSlots: ['wattle_hut_0', ...Array(8).fill(null)],
    });
    // lumber=5, 2 people → 2.5/person < LUMBER_LOW_PER_PERSON(8) → fires; cost=3, surplus=5 → affordable
    const state = makeState(
      new Map([['h1', hh]]), new Map([['p1', p1], ['p2', p2]]),
      { food: 30, lumber: 5, stone: 30 },
      {},
      [existingWattle],
    );
    const result = processPrivateBuilding(state);
    expect(result.autoRoleAssignments).toHaveLength(1);
    expect(result.autoRoleAssignments[0]!.personId).toBe('p1');
    expect(result.autoRoleAssignments[0]!.newRole).toBe('gather_lumber');
  });

  it('Path D lumber: does not fire when lumber is sufficient', () => {
    const existingWattle = {
      instanceId: 'wattle_hut_0', defId: 'wattle_hut', builtTurn: 1, style: null, ownerHouseholdId: 'h1',
    } as GameState['settlement']['buildings'][number];
    const person = makePerson('p1', 'h1', { role: 'gather_food' });
    const hh = makeHousehold('h1', {
      headId: 'p1', memberIds: ['p1'], householdWealth: 5,
      buildingSlots: ['wattle_hut_0', ...Array(8).fill(null)],
    });
    // lumber=20 per person → well above threshold
    const state = makeState(
      new Map([['h1', hh]]), new Map([['p1', person]]),
      { food: 30, lumber: 20, stone: 30 },
      {},
      [existingWattle],
    );
    const result = processPrivateBuilding(state);
    expect(result.newProjects).toHaveLength(0);
  });

  it('Path D lumber: does not fire when household already has a lumber-producing building', () => {
    const existingWattle = {
      instanceId: 'wattle_hut_0', defId: 'wattle_hut', builtTurn: 1, style: null, ownerHouseholdId: 'h1',
    } as GameState['settlement']['buildings'][number];
    const existingHut = {
      instanceId: 'woodcutter_hut_0', defId: 'woodcutter_hut', builtTurn: 2, style: null, ownerHouseholdId: 'h1',
    } as GameState['settlement']['buildings'][number];
    const person = makePerson('p1', 'h1', { role: 'gather_lumber' });
    const hh = makeHousehold('h1', {
      headId: 'p1', memberIds: ['p1'], householdWealth: 5,
      buildingSlots: ['wattle_hut_0', 'woodcutter_hut_0', ...Array(7).fill(null)],
    });
    const state = makeState(
      new Map([['h1', hh]]), new Map([['p1', person]]),
      { food: 30, lumber: 2, stone: 30 }, // low lumber but already equipped
      {},
      [existingWattle, existingHut],
    );
    const result = processPrivateBuilding(state);
    expect(result.newProjects).toHaveLength(0);
  });

  it('Path D lumber: does not assign role when member is already gather_lumber', () => {
    const existingWattle = {
      instanceId: 'wattle_hut_0', defId: 'wattle_hut', builtTurn: 1, style: null, ownerHouseholdId: 'h1',
    } as GameState['settlement']['buildings'][number];
    // Two members: p1 is gather_lumber already, p2 is gather_food
    const p1 = makePerson('p1', 'h1', { role: 'gather_lumber' });
    const p2 = makePerson('p2', 'h1', { role: 'gather_food' });
    const hh = makeHousehold('h1', {
      headId: 'p1', memberIds: ['p1', 'p2'], householdWealth: 5,
      buildingSlots: ['wattle_hut_0', ...Array(8).fill(null)],
    });
    // lumber=5, 2 people → 2.5/person < 8 → fires; cost=3, surplus=5 → affordable
    const state = makeState(
      new Map([['h1', hh]]), new Map([['p1', p1], ['p2', p2]]),
      { food: 30, lumber: 5, stone: 30 },
      {},
      [existingWattle],
    );
    const result = processPrivateBuilding(state);
    // Building should still be commissioned (no lumber building yet)
    expect(result.newProjects).toHaveLength(1);
    expect(result.newProjects[0]!.defId).toBe('woodcutter_hut');
    // But no autoRoleAssignment because someone is already gather_lumber
    expect(result.autoRoleAssignments).toHaveLength(0);
  });

  // ── Path D: stone-pressure bypass ──────────────────────────────────────────

  it('Path D stone: commissions stone_pit when stone is low', () => {
    const existingWattle = {
      instanceId: 'wattle_hut_0', defId: 'wattle_hut', builtTurn: 1, style: null, ownerHouseholdId: 'h1',
    } as GameState['settlement']['buildings'][number];
    const person = makePerson('p1', 'h1', { role: 'gather_food' });
    const hh = makeHousehold('h1', {
      headId: 'p1', memberIds: ['p1'], householdWealth: 5,
      buildingSlots: ['wattle_hut_0', ...Array(8).fill(null)],
    });
    // stone=2, 1 person → 2 < STONE_LOW_PER_PERSON(5) → fires
    const state = makeState(
      new Map([['h1', hh]]), new Map([['p1', person]]),
      { food: 30, lumber: 20, stone: 2 },
      {},
      [existingWattle],
    );
    const result = processPrivateBuilding(state);
    expect(result.newProjects).toHaveLength(1);
    expect(result.newProjects[0]!.defId).toBe('stone_pit');
  });

  it('Path D stone: auto-assigns an eligible member to gather_stone when stone_pit is commissioned', () => {
    const existingWattle = {
      instanceId: 'wattle_hut_0', defId: 'wattle_hut', builtTurn: 1, style: null, ownerHouseholdId: 'h1',
    } as GameState['settlement']['buildings'][number];
    // p1 is the head → picked as builder and excluded from auto-role
    // p2 (unassigned) is the candidate who gets reassigned to gather_stone
    const p1 = makePerson('p1', 'h1', { role: 'unassigned' });
    const p2 = makePerson('p2', 'h1', { role: 'unassigned' });
    const hh = makeHousehold('h1', {
      headId: 'p1', memberIds: ['p1', 'p2'], householdWealth: 5,
      buildingSlots: ['wattle_hut_0', ...Array(8).fill(null)],
    });
    // lumber=20 (10/person ≥ 8 → no D-lumber); stone=2 (1/person < 5 → D-stone fires)
    // stone_pit costs {lumber: 5}, surplus=20 → affordable
    const state = makeState(
      new Map([['h1', hh]]), new Map([['p1', p1], ['p2', p2]]),
      { food: 30, lumber: 20, stone: 2 },
      {},
      [existingWattle],
    );
    const result = processPrivateBuilding(state);
    expect(result.autoRoleAssignments).toHaveLength(1);
    expect(result.autoRoleAssignments[0]!.personId).toBe('p1');
    expect(result.autoRoleAssignments[0]!.newRole).toBe('gather_stone');
  });

  it('Path D stone: does not fire when stone is sufficient', () => {
    const existingWattle = {
      instanceId: 'wattle_hut_0', defId: 'wattle_hut', builtTurn: 1, style: null, ownerHouseholdId: 'h1',
    } as GameState['settlement']['buildings'][number];
    const person = makePerson('p1', 'h1', { role: 'gather_food' });
    const hh = makeHousehold('h1', {
      headId: 'p1', memberIds: ['p1'], householdWealth: 5,
      buildingSlots: ['wattle_hut_0', ...Array(8).fill(null)],
    });
    const state = makeState(
      new Map([['h1', hh]]), new Map([['p1', person]]),
      { food: 30, lumber: 20, stone: 20 }, // stone 20 per person >> threshold
      {},
      [existingWattle],
    );
    const result = processPrivateBuilding(state);
    expect(result.newProjects).toHaveLength(0);
  });

  it('Path D stone: does not fire when household already has a stone-producing building', () => {
    const existingWattle = {
      instanceId: 'wattle_hut_0', defId: 'wattle_hut', builtTurn: 1, style: null, ownerHouseholdId: 'h1',
    } as GameState['settlement']['buildings'][number];
    const existingPit = {
      instanceId: 'stone_pit_0', defId: 'stone_pit', builtTurn: 2, style: null, ownerHouseholdId: 'h1',
    } as GameState['settlement']['buildings'][number];
    const person = makePerson('p1', 'h1', { role: 'gather_stone' });
    const hh = makeHousehold('h1', {
      headId: 'p1', memberIds: ['p1'], householdWealth: 5,
      buildingSlots: ['wattle_hut_0', 'stone_pit_0', ...Array(7).fill(null)],
    });
    const state = makeState(
      new Map([['h1', hh]]), new Map([['p1', person]]),
      { food: 30, lumber: 20, stone: 1 }, // low stone but already equipped
      {},
      [existingWattle, existingPit],
    );
    const result = processPrivateBuilding(state);
    expect(result.newProjects).toHaveLength(0);
  });

  it('Path D: empty autoRoleAssignments when no resource pressure', () => {
    const existingWattle = {
      instanceId: 'wattle_hut_0', defId: 'wattle_hut', builtTurn: 1, style: null, ownerHouseholdId: 'h1',
    } as GameState['settlement']['buildings'][number];
    // Household has a dwelling (slot 0 non-null) so Path A doesn't fire.
    // Guard role has no production-chain mapping so Path C doesn't fire.
    // No ambition, all resources above thresholds → Path D doesn't fire.
    const person = makePerson('p1', 'h1', { role: 'guard' });
    const hh = makeHousehold('h1', {
      headId: 'p1', memberIds: ['p1'], householdWealth: 5,
      buildingSlots: ['wattle_hut_0', ...Array(8).fill(null)],
    });
    const state = makeState(
      new Map([['h1', hh]]), new Map([['p1', person]]),
      { food: 50, lumber: 50, stone: 30 },
      {},
      [existingWattle],
    );
    const result = processPrivateBuilding(state);
    expect(result.autoRoleAssignments).toHaveLength(0);
    expect(result.newProjects).toHaveLength(0);
  });

  // ── seniorWifeId fallback ───────────────────────────────────────────────────

  it('uses seniorWifeId ambition when headId is null', () => {
    const wife = makePersonWithAmbition('w1', 'h1', makeAmbition('seek_better_housing'));
    const hh = makeHousehold('h1', {
      headId: null,
      seniorWifeId: 'w1',
      memberIds: ['w1'],
      householdWealth: 3,
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

  it('skips when both headId and seniorWifeId are null', () => {
    const hh = makeHousehold('h1', { headId: null, seniorWifeId: null, householdWealth: 10 });
    const state = makeState(new Map([['h1', hh]]), new Map(), { lumber: 20 });
    expect(processPrivateBuilding(state).newProjects).toHaveLength(0);
  });

  it('skips when leaderId resolves to missing person', () => {
    // headId points to a person not in the people map
    const hh = makeHousehold('h1', { headId: 'ghost', memberIds: [], householdWealth: 10 });
    const state = makeState(new Map([['h1', hh]]), new Map(), { lumber: 20 });
    expect(processPrivateBuilding(state).newProjects).toHaveLength(0);
  });

  // ── seek_production_building — detailed checks ─────────────────────────────

  it('seek_production_building: deducts correct wealth from household', () => {
    // fields: privateWealthCost = 2. Household already has wattle_hut → Path B.
    const existingWattle = {
      instanceId: 'wattle_hut_0', defId: 'wattle_hut', builtTurn: 1, style: null, ownerHouseholdId: 'h1',
    } as GameState['settlement']['buildings'][number];
    const person = makePersonWithAmbition('p1', 'h1', makeAmbition('seek_production_building'), 'farmer');
    const hh = makeHousehold('h1', {
      headId: 'p1', memberIds: ['p1'], householdWealth: 7,
      buildingSlots: ['wattle_hut_0', ...Array(8).fill(null)],
    });
    const state = makeState(
      new Map([['h1', hh]]), new Map([['p1', person]]),
      { lumber: 10 },
      {},
      [existingWattle],
    );
    const result = processPrivateBuilding(state);
    expect(result.updatedHouseholds.get('h1')!.householdWealth).toBe(5); // 7 - 2
  });

  it('seek_production_building: deducts correct materials', () => {
    // fields: cost = { lumber: 5 }. Household already has wattle_hut → Path B.
    const existingWattle = {
      instanceId: 'wattle_hut_0', defId: 'wattle_hut', builtTurn: 1, style: null, ownerHouseholdId: 'h1',
    } as GameState['settlement']['buildings'][number];
    const person = makePersonWithAmbition('p1', 'h1', makeAmbition('seek_production_building'), 'farmer');
    const hh = makeHousehold('h1', {
      headId: 'p1', memberIds: ['p1'], householdWealth: 5,
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

  it('seek_production_building: blocked when wealth insufficient', () => {
    // fields: privateWealthCost = 2; household has only 1. Household has wattle_hut → Path B.
    const existingWattle = {
      instanceId: 'wattle_hut_0', defId: 'wattle_hut', builtTurn: 1, style: null, ownerHouseholdId: 'h1',
    } as GameState['settlement']['buildings'][number];
    const person = makePersonWithAmbition('p1', 'h1', makeAmbition('seek_production_building'), 'farmer');
    const hh = makeHousehold('h1', {
      headId: 'p1', memberIds: ['p1'], householdWealth: 1,
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
      headId: 'p1', memberIds: ['p1'], householdWealth: 5,
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
      householdWealth: 10,
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
      householdWealth: 10,
      buildingSlots: ['wattle_hut_0', 'fields_1', 'orchard_1', ...Array(6).fill(null)],
    });
    const state = makeState(
      new Map([['h1', hh]]),
      new Map([['p1', head]]),
      { lumber: 20, stone: 30 },
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
      headId: 'p1', memberIds: ['p1'], householdWealth: 10,
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
      householdWealth: 10,
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
    const hh = makeHousehold('h1', { headId: 'p1', memberIds: ['p1'], householdWealth: 3 });
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
    const hh = makeHousehold('h1', { headId: 'p1', memberIds: ['p1'], householdWealth: 3 });
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
    const hh = makeHousehold('h1', { headId: 'p1', memberIds: ['p1'], householdWealth: 3 });
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
    const hh = makeHousehold('h1', { headId: 'p1', memberIds: ['p1'], householdWealth: 3 });
    const state = makeState(
      new Map([['h1', hh]]), new Map([['p1', person]]),
      { lumber: 10 },
    );
    const result = processPrivateBuilding(state);
    expect(result.logEntries[0]!.description).toContain('Mira');
  });

  it('log entry turn matches state turnNumber', () => {
    const person = makePersonWithAmbition('p1', 'h1', makeAmbition('seek_better_housing'));
    const hh = makeHousehold('h1', { headId: 'p1', memberIds: ['p1'], householdWealth: 3 });
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
    const hh = makeHousehold('h1', { headId: 'p1', memberIds: ['p1'], householdWealth: 5 });
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
    const hh = makeHousehold('h1', { headId: 'p1', memberIds: ['p1'], householdWealth: 3 });
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
    const hh = makeHousehold('h1', { headId: 'p1', memberIds: ['p1'], householdWealth: 3 });
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
    const hh1 = makeHousehold('h1', { headId: 'p1', memberIds: ['p1'], householdWealth: 5 });
    const hh2 = makeHousehold('h2', { headId: 'p2', memberIds: ['p2'], householdWealth: 5 });
    const state = makeState(
      new Map([['h1', hh1], ['h2', hh2]]),
      new Map([['p1', p1], ['p2', p2]]),
      { lumber: 20 },
    );
    const result = processPrivateBuilding(state);
    expect(result.newProjects).toHaveLength(2);
    expect(result.updatedResources.lumber).toBe(14); // 20 - 6
  });

  it('wealth deduction from two households is independent', () => {
    const p1 = makePersonWithAmbition('p1', 'h1', makeAmbition('seek_better_housing'));
    const p2 = makePersonWithAmbition('p2', 'h2', makeAmbition('seek_better_housing'));
    const hh1 = makeHousehold('h1', { headId: 'p1', memberIds: ['p1'], householdWealth: 4 });
    const hh2 = makeHousehold('h2', { headId: 'p2', memberIds: ['p2'], householdWealth: 6 });
    const state = makeState(
      new Map([['h1', hh1], ['h2', hh2]]),
      new Map([['p1', p1], ['p2', p2]]),
      { lumber: 20 },
    );
    const result = processPrivateBuilding(state);
    // wattle_hut costs 1 wealth each
    expect(result.updatedHouseholds.get('h1')!.householdWealth).toBe(3);
    expect(result.updatedHouseholds.get('h2')!.householdWealth).toBe(5);
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
      householdWealth: 0,
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
      householdWealth: 0,
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

  // ── Agriculture chain: multi-tier skill-gated progression ─────────────────

  it('farmer: fields owned + plants=30 (Good) → targets barns_storehouses (agriculture T2)', () => {
    const farmer = {
      ...makePerson('p1', 'hh1', { role: 'farmer' }),
      skills: { animals: 25, bargaining: 25, combat: 25, custom: 25, leadership: 25, plants: 30 },
    } as unknown as Person;
    const hh = makeSlottedHH('hh1', [null, 'fi', null, null, null, null, null, null, null]);
    expect(getNextHouseholdProductionTarget(farmer, hh, [makeBuilding('fields', 'fi')])).toBe('barns_storehouses');
  });

  it('farmer: plants=26 exactly (Good threshold) + fields → barns_storehouses beats orchard T1', () => {
    // Agriculture T2 threshold=26 is now reached — the agriculture chain is tried
    // first in declaration order, so barns_storehouses wins before orchard T1 (threshold=0).
    const farmer = {
      ...makePerson('p1', 'hh1', { role: 'farmer' }),
      skills: { animals: 25, bargaining: 25, combat: 25, custom: 25, leadership: 25, plants: 26 },
    } as unknown as Person;
    const hh = makeSlottedHH('hh1', [null, 'fi', null, null, null, null, null, null, null]);
    expect(getNextHouseholdProductionTarget(farmer, hh, [makeBuilding('fields', 'fi')])).toBe('barns_storehouses');
  });

  it('farmer: fields + barns_storehouses owned, plants=50 (VG) → targets farmstead (agriculture T3)', () => {
    const farmer = {
      ...makePerson('p1', 'hh1', { role: 'farmer' }),
      skills: { animals: 25, bargaining: 25, combat: 25, custom: 25, leadership: 25, plants: 50 },
    } as unknown as Person;
    const hh = makeSlottedHH('hh1', [null, 'fi', 'bs', null, null, null, null, null, null]);
    const buildings = [makeBuilding('fields', 'fi'), makeBuilding('barns_storehouses', 'bs')];
    expect(getNextHouseholdProductionTarget(farmer, hh, buildings)).toBe('farmstead');
  });

  it('farmer: agriculture T1+T2+T3 owned, plants=65 (EX) → targets grain_silo (agriculture T4)', () => {
    const farmer = {
      ...makePerson('p1', 'hh1', { role: 'farmer' }),
      skills: { animals: 25, bargaining: 25, combat: 25, custom: 25, leadership: 25, plants: 65 },
    } as unknown as Person;
    const hh = makeSlottedHH('hh1', [null, 'fi', 'bs', 'fm', null, null, null, null, null]);
    const buildings = [
      makeBuilding('fields', 'fi'),
      makeBuilding('barns_storehouses', 'bs'),
      makeBuilding('farmstead', 'fm'),
    ];
    expect(getNextHouseholdProductionTarget(farmer, hh, buildings)).toBe('grain_silo');
  });

  it('farmer: full agriculture chain owned, plants=65 → targets orchard T1 (next chain)', () => {
    const farmer = {
      ...makePerson('p1', 'hh1', { role: 'farmer' }),
      skills: { animals: 25, bargaining: 25, combat: 25, custom: 25, leadership: 25, plants: 65 },
    } as unknown as Person;
    const hh = makeSlottedHH('hh1', [null, 'fi', 'bs', 'fm', 'gs', null, null, null, null]);
    const buildings = [
      makeBuilding('fields', 'fi'),
      makeBuilding('barns_storehouses', 'bs'),
      makeBuilding('farmstead', 'fm'),
      makeBuilding('grain_silo', 'gs'),
    ];
    expect(getNextHouseholdProductionTarget(farmer, hh, buildings)).toBe('orchard');
  });

  // ── Herder: pastoralism chain ──────────────────────────────────────────────

  it('herder: no buildings → targets cattle_pen (pastoralism T1)', () => {
    const herder = makePerson('p1', 'hh1', { role: 'herder' });
    expect(getNextHouseholdProductionTarget(herder, makeSlottedHH('hh1'), [])).toBe('cattle_pen');
  });

  it('herder: cattle_pen owned, animals=30 → targets meadow (pastoralism T2)', () => {
    const herder = {
      ...makePerson('p1', 'hh1', { role: 'herder' }),
      skills: { animals: 30, bargaining: 25, combat: 25, custom: 25, leadership: 25, plants: 25 },
    } as unknown as Person;
    const hh = makeSlottedHH('hh1', [null, 'cp', null, null, null, null, null, null, null]);
    expect(getNextHouseholdProductionTarget(herder, hh, [makeBuilding('cattle_pen', 'cp')])).toBe('meadow');
  });

  it('herder: cattle_pen + meadow owned, animals=50 → targets cattle_ranch (pastoralism T3)', () => {
    const herder = {
      ...makePerson('p1', 'hh1', { role: 'herder' }),
      skills: { animals: 50, bargaining: 25, combat: 25, custom: 25, leadership: 25, plants: 25 },
    } as unknown as Person;
    const hh = makeSlottedHH('hh1', [null, 'cp', 'md', null, null, null, null, null, null]);
    const buildings = [makeBuilding('cattle_pen', 'cp'), makeBuilding('meadow', 'md')];
    expect(getNextHouseholdProductionTarget(herder, hh, buildings)).toBe('cattle_ranch');
  });

  it('herder: full pastoralism chain owned (animals=65) → falls through to stable (ROLE_TO_BUILDING)', () => {
    // All 4 pastoralism tiers owned; chain exhausted → herder is not in the
    // no-fallback list, so ROLE_TO_BUILDING.herder = 'stable' is returned.
    const herder = {
      ...makePerson('p1', 'hh1', { role: 'herder' }),
      skills: { animals: 65, bargaining: 25, combat: 25, custom: 25, leadership: 25, plants: 25 },
    } as unknown as Person;
    const hh = makeSlottedHH('hh1', [null, 'cp', 'md', 'cr', 'sf', null, null, null, null]);
    const buildings = [
      makeBuilding('cattle_pen', 'cp'),
      makeBuilding('meadow', 'md'),
      makeBuilding('cattle_ranch', 'cr'),
      makeBuilding('stock_farm', 'sf'),
    ];
    expect(getNextHouseholdProductionTarget(herder, hh, buildings)).toBe('stable');
  });

  // ── Hunter: hunting chain + ROLE_TO_BUILDING fallback ─────────────────────

  it('hunter: no buildings → targets hunters_lodge (hunting T1)', () => {
    const hunter = makePerson('p1', 'hh1', { role: 'hunter' });
    expect(getNextHouseholdProductionTarget(hunter, makeSlottedHH('hh1'), [])).toBe('hunters_lodge');
  });

  it('hunter: hunters_lodge owned, combat=30 (Good) → targets hound_pens (hunting T2)', () => {
    const hunter = {
      ...makePerson('p1', 'hh1', { role: 'hunter' }),
      skills: { animals: 25, bargaining: 25, combat: 30, custom: 25, leadership: 25, plants: 25 },
    } as unknown as Person;
    const hh = makeSlottedHH('hh1', [null, 'hl', null, null, null, null, null, null, null]);
    expect(getNextHouseholdProductionTarget(hunter, hh, [makeBuilding('hunters_lodge', 'hl')])).toBe('hound_pens');
  });

  it('hunter: hunters_lodge owned, combat=25 (T2 gated) → falls through to smokehouse (ROLE_TO_BUILDING)', () => {
    // Hunting T2 requires combat≥26; hunter is not in the no-fallback list,
    // so ROLE_TO_BUILDING.hunter = 'smokehouse' is returned as the supplement target.
    const hunter = makePerson('p1', 'hh1', { role: 'hunter' });
    const hh = makeSlottedHH('hh1', [null, 'hl', null, null, null, null, null, null, null]);
    expect(getNextHouseholdProductionTarget(hunter, hh, [makeBuilding('hunters_lodge', 'hl')])).toBe('smokehouse');
  });

  // ── Healer: healing chain ─────────────────────────────────────────────────

  it('healer: no buildings → targets healers_hut (healing T1)', () => {
    const healer = makePerson('p1', 'hh1', { role: 'healer' });
    expect(getNextHouseholdProductionTarget(healer, makeSlottedHH('hh1'), [])).toBe('healers_hut');
  });

  it('healer: healers_hut owned, plants=30 → targets herb_garden (healing T2)', () => {
    const healer = {
      ...makePerson('p1', 'hh1', { role: 'healer' }),
      skills: { animals: 25, bargaining: 25, combat: 25, custom: 25, leadership: 25, plants: 30 },
    } as unknown as Person;
    const hh = makeSlottedHH('hh1', [null, 'hh', null, null, null, null, null, null, null]);
    expect(getNextHouseholdProductionTarget(healer, hh, [makeBuilding('healers_hut', 'hh')])).toBe('herb_garden');
  });
});

// ─── processPrivateBuilding: later-stage chain progression ───────────────────
//
// These tests simulate what the private-build engine sees at different points
// in the mid/late game, when a household already has some completed production
// buildings and the engine must detect the correct next tier to commission.
//
// Each test constructs a GameState snapshot representing a specific settlement
// age (post-T1, post-T2, etc.) and verifies that Path C fires correctly.

describe('processPrivateBuilding — chain progression simulations', () => {
  const EMPTY: ResourceStock = {
    food: 0, cattle: 0, wealth: 0, steel: 0,
    lumber: 0, stone: 0, medicine: 0, horses: 0,
  };

  /** Build a worker person with a specific role and optional skill overrides. */
  function makeWorker(
    id: string,
    hhId: string,
    role: Person['role'],
    skillOverrides: Partial<{ animals: number; bargaining: number; combat: number; custom: number; leadership: number; plants: number }> = {},
  ): Person {
    return {
      id,
      householdId: hhId,
      age: 28,
      role,
      socialStatus: 'settler',
      sex: 'male',
      traits: [],
      religion: 'imanian_orthodox',
      heritage: {
        bloodline: [{ group: 'imanian', fraction: 1.0 }],
        primaryCulture: 'imanian',
        culturalFluency: new Map(),
      },
      skills: { animals: 25, bargaining: 25, combat: 25, custom: 25, leadership: 25, plants: 25, ...skillOverrides },
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

  /** Build a household stub with the given building slots (index 0 = dwelling). */
  function makeHH(
    id: string,
    slots: (string | null)[],
    opts: { headId?: string; memberIds?: string[]; householdWealth?: number } = {},
  ): Household {
    return {
      id,
      name: `HH ${id}`,
      tradition: 'imanian',
      headId: opts.headId ?? null,
      seniorWifeId: null,
      memberIds: opts.memberIds ?? [],
      ashkaMelathiBonds: [],
      foundedTurn: 0,
      dwellingBuildingId: null,
      productionBuildingIds: [],
      specialty: null,
      isAutoNamed: true,
      buildingSlots: slots,
      householdWealth: opts.householdWealth ?? 20,
    };
  }

  /** Build a minimal GameState for the private-build engine. */
  function makeWorld(
    households: Map<string, Household>,
    people: Map<string, Person>,
    buildings: GameState['settlement']['buildings'],
    resources: Partial<ResourceStock> = {},
  ): GameState {
    return {
      households,
      people,
      settlement: {
        resources: { ...EMPTY, ...resources },
        buildings,
        constructionQueue: [],
        economyReserves: {},
      } as unknown as GameState['settlement'],
      turnNumber: 10,
    } as unknown as GameState;
  }

  /** Convenience: build a BuiltBuilding stub owned by a household. */
  function built(defId: string, instanceId: string, hhId: string): GameState['settlement']['buildings'][number] {
    return {
      instanceId,
      defId,
      builtTurn: 1,
      style: null,
      ownerHouseholdId: hhId,
      claimedByPersonIds: [],
      assignedWorkerIds: [],
    } as unknown as GameState['settlement']['buildings'][number];
  }

  // ── Path C fires for the correct T2 target when T1 is already in slot ──────

  it('Path C: farmer with fields in slot (plants=30) → commissions barns_storehouses (T2)', () => {
    // barns_storehouses: privateWealthCost=4, cost={lumber:8, stone:4}
    const person = makeWorker('p1', 'hh1', 'farmer', { plants: 30 });
    const hh = makeHH('hh1', ['wattle_0', 'fi_1', null, null, null, null, null, null, null], {
      headId: 'p1', memberIds: ['p1'], householdWealth: 10,
    });
    const state = makeWorld(
      new Map([['hh1', hh]]),
      new Map([['p1', person]]),
      [built('wattle_hut', 'wattle_0', 'hh1'), built('fields', 'fi_1', 'hh1')],
      { lumber: 30, stone: 20 },
    );
    const result = processPrivateBuilding(state);
    expect(result.newProjects).toHaveLength(1);
    expect(result.newProjects[0]!.defId).toBe('barns_storehouses');
  });

  it('Path C: herder with cattle_pen in slot (animals=30) → commissions meadow (pastoralism T2)', () => {
    // meadow: privateWealthCost=4, cost={lumber:8}
    const person = makeWorker('p1', 'hh1', 'herder', { animals: 30 });
    const hh = makeHH('hh1', ['wattle_0', 'cp_1', null, null, null, null, null, null, null], {
      headId: 'p1', memberIds: ['p1'], householdWealth: 10,
    });
    const state = makeWorld(
      new Map([['hh1', hh]]),
      new Map([['p1', person]]),
      [built('wattle_hut', 'wattle_0', 'hh1'), built('cattle_pen', 'cp_1', 'hh1')],
      { lumber: 20 },
    );
    const result = processPrivateBuilding(state);
    expect(result.newProjects).toHaveLength(1);
    expect(result.newProjects[0]!.defId).toBe('meadow');
  });

  it('Path C: hunter with hunters_lodge in slot (combat=25) → commissions smokehouse (T2 gated, fallback)', () => {
    // combat=25 < 26 → hound_pens (T2) is gated → falls through to smokehouse
    // smokehouse: privateWealthCost=3, cost={lumber:8, stone:4}
    const person = makeWorker('p1', 'hh1', 'hunter');  // combat=25 (default)
    const hh = makeHH('hh1', ['wattle_0', 'hl_1', null, null, null, null, null, null, null], {
      headId: 'p1', memberIds: ['p1'], householdWealth: 10,
    });
    const state = makeWorld(
      new Map([['hh1', hh]]),
      new Map([['p1', person]]),
      [built('wattle_hut', 'wattle_0', 'hh1'), built('hunters_lodge', 'hl_1', 'hh1')],
      { lumber: 20, stone: 10 },
    );
    const result = processPrivateBuilding(state);
    expect(result.newProjects).toHaveLength(1);
    expect(result.newProjects[0]!.defId).toBe('smokehouse');
  });

  // ── Multi-step progression: each completed tier unlocks the next ──────────
  //
  // Simulates a farming household being observed at three distinct moments in
  // the mid-game: before T1, between T1 and T2, and between T2 and T3.
  // The household leader has no ambition; only Path C is responsible.

  it('farming household progresses T1→T2→T3 as each tier completes (plants=50, VG)', () => {
    // plants=50 unlocks: T1(≥0) ✓, T2(≥26) ✓, T3(≥46) ✓, T4(≥63) ✗
    const farmer = makeWorker('p1', 'hh1', 'farmer', { plants: 50 });
    const RESOURCES = { lumber: 50, stone: 30 };

    /** Run one processPrivateBuilding pass for a given set of completed production buildings. */
    function runStage(productionBuildings: Array<{ defId: string; instanceId: string }>): string | null {
      const slots: (string | null)[] = [
        'wattle_0',
        ...productionBuildings.map(b => b.instanceId),
        ...Array(8 - productionBuildings.length).fill(null),
      ];
      const hh = makeHH('hh1', slots, { headId: 'p1', memberIds: ['p1'], householdWealth: 30 });
      const allBuildings: GameState['settlement']['buildings'] = [
        built('wattle_hut', 'wattle_0', 'hh1'),
        ...productionBuildings.map(b => built(b.defId, b.instanceId, 'hh1')),
      ];
      const state = makeWorld(
        new Map([['hh1', hh]]),
        new Map([['p1', farmer]]),
        allBuildings,
        RESOURCES,
      );
      return processPrivateBuilding(state).newProjects[0]?.defId ?? null;
    }

    // Stage 1 (early game, ~turn 5): only the dwelling exists
    expect(runStage([])).toBe('fields');

    // Stage 2 (mid game, ~turn 10): fields built; skill unlocks T2
    expect(runStage([{ defId: 'fields', instanceId: 'fi_1' }])).toBe('barns_storehouses');

    // Stage 3 (mid game, ~turn 15): fields + barns built; skill unlocks T3
    expect(runStage([
      { defId: 'fields', instanceId: 'fi_1' },
      { defId: 'barns_storehouses', instanceId: 'bs_2' },
    ])).toBe('farmstead');
  });

  it('herder household progresses pastoralism T1→T2→T3 (animals=50, VG)', () => {
    const herder = makeWorker('p1', 'hh1', 'herder', { animals: 50 });
    const RESOURCES = { lumber: 50, stone: 20, wealth: 20 };

    function runStage(productionBuildings: Array<{ defId: string; instanceId: string }>): string | null {
      const slots: (string | null)[] = [
        'wattle_0',
        ...productionBuildings.map(b => b.instanceId),
        ...Array(8 - productionBuildings.length).fill(null),
      ];
      const hh = makeHH('hh1', slots, { headId: 'p1', memberIds: ['p1'], householdWealth: 30 });
      const allBuildings: GameState['settlement']['buildings'] = [
        built('wattle_hut', 'wattle_0', 'hh1'),
        ...productionBuildings.map(b => built(b.defId, b.instanceId, 'hh1')),
      ];
      const state = makeWorld(
        new Map([['hh1', hh]]),
        new Map([['p1', herder]]),
        allBuildings,
        RESOURCES,
      );
      return processPrivateBuilding(state).newProjects[0]?.defId ?? null;
    }

    expect(runStage([])).toBe('cattle_pen');
    expect(runStage([{ defId: 'cattle_pen', instanceId: 'cp_1' }])).toBe('meadow');
    expect(runStage([
      { defId: 'cattle_pen', instanceId: 'cp_1' },
      { defId: 'meadow', instanceId: 'md_2' },
    ])).toBe('cattle_ranch');
  });

  // ── Multi-member household: non-head worker drives Path C ─────────────────

  it('Path C finds production target from member when household head is a guard', () => {
    // The head has role=guard (no production chain) but member p2 is a farmer.
    // Path C scans all adults — the farmer member drives the commission.
    const head = makeWorker('p1', 'hh1', 'guard');
    const farmer = makeWorker('p2', 'hh1', 'farmer', { plants: 30 });
    const hh = makeHH('hh1', ['wattle_0', 'fi_1', null, null, null, null, null, null, null], {
      headId: 'p1', memberIds: ['p1', 'p2'], householdWealth: 10,
    });
    const state = makeWorld(
      new Map([['hh1', hh]]),
      new Map([['p1', head], ['p2', farmer]]),
      [built('wattle_hut', 'wattle_0', 'hh1'), built('fields', 'fi_1', 'hh1')],
      { lumber: 30, stone: 20 },
    );
    const result = processPrivateBuilding(state);
    expect(result.newProjects).toHaveLength(1);
    expect(result.newProjects[0]!.defId).toBe('barns_storehouses');
  });

  it('blocks a new production chain when a wattle_hut household already uses both slots', () => {
    const farmer = makeWorker('p1', 'hh1', 'blacksmith', { custom: 40 });
    const hh = makeHH('hh1', ['wattle_0', 'fi_1', 'stable_1', null, null, null, null, null, null], {
      headId: 'p1', memberIds: ['p1'], householdWealth: 12,
    });
    const state = makeWorld(
      new Map([['hh1', hh]]),
      new Map([['p1', farmer]]),
      [
        built('wattle_hut', 'wattle_0', 'hh1'),
        built('fields', 'fi_1', 'hh1'),
        built('stable', 'stable_1', 'hh1'),
      ],
      { lumber: 30, stone: 20, steel: 20 },
    );

    const result = processPrivateBuilding(state);
    expect(result.newProjects).toHaveLength(0);
  });

  it('allows a chain upgrade even when all dwelling production slots are already occupied', () => {
    const farmer = makeWorker('p1', 'hh1', 'farmer', { plants: 30 });
    const hh = makeHH('hh1', ['wattle_0', 'fi_1', 'stable_1', null, null, null, null, null, null], {
      headId: 'p1', memberIds: ['p1'], householdWealth: 12,
    });
    const state = makeWorld(
      new Map([['hh1', hh]]),
      new Map([['p1', farmer]]),
      [
        built('wattle_hut', 'wattle_0', 'hh1'),
        built('fields', 'fi_1', 'hh1'),
        built('stable', 'stable_1', 'hh1'),
      ],
      { lumber: 30, stone: 20 },
    );

    const result = processPrivateBuilding(state);
    expect(result.newProjects).toHaveLength(1);
    expect(result.newProjects[0]!.defId).toBe('barns_storehouses');
  });

  it('sets household specialty when commissioning the first production building', () => {
    const farmer = makeWorker('p1', 'hh1', 'farmer', { plants: 25 });
    const hh = makeHH('hh1', ['wattle_0', null, null, null, null, null, null, null, null], {
      headId: 'p1', memberIds: ['p1'], householdWealth: 10,
    });
    const state = makeWorld(
      new Map([['hh1', hh]]),
      new Map([['p1', farmer]]),
      [built('wattle_hut', 'wattle_0', 'hh1')],
      { lumber: 20 },
    );

    const result = processPrivateBuilding(state);
    expect(result.newProjects).toHaveLength(1);
    expect(result.newProjects[0]!.defId).toBe('fields');
    expect(result.updatedHouseholds.get('hh1')!.specialty).toBe('food');
  });

  it('does not overwrite an existing household specialty when commissioning a later production building', () => {
    const blacksmith = makeWorker('p1', 'hh1', 'blacksmith', { custom: 40 });
    const hh = {
      ...makeHH('hh1', ['wattle_0', null, null, null, null, null, null, null, null], {
        headId: 'p1', memberIds: ['p1'], householdWealth: 10,
      }),
      specialty: 'food' as const,
    };
    const state = makeWorld(
      new Map([['hh1', hh]]),
      new Map([['p1', blacksmith]]),
      [built('wattle_hut', 'wattle_0', 'hh1')],
      { lumber: 20, steel: 20 },
    );

    const result = processPrivateBuilding(state);
    expect(result.newProjects).toHaveLength(1);
    expect(result.newProjects[0]!.defId).toBe('smithy');
    expect(result.updatedHouseholds.get('hh1')!.specialty).toBe('food');
  });

  it('applies the 1.5x out-of-specialty premium to wealth affordability', () => {
    const blacksmith = makeWorker('p1', 'hh1', 'blacksmith', { custom: 40 });
    const hh = {
      ...makeHH('hh1', ['wattle_0', null, null, null, null, null, null, null, null], {
        headId: 'p1', memberIds: ['p1'], householdWealth: 7,
      }),
      specialty: 'food' as const,
    };
    const state = makeWorld(
      new Map([['hh1', hh]]),
      new Map([['p1', blacksmith]]),
      [built('wattle_hut', 'wattle_0', 'hh1')],
      { lumber: 20, steel: 20 },
    );

    // smithy privateWealthCost = 5; out-of-specialty premium raises it to 8.
    const result = processPrivateBuilding(state);
    expect(result.newProjects).toHaveLength(0);
  });
});
