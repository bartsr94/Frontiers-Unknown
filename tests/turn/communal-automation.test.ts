import { describe, it, expect } from 'vitest';
import { processDawn } from '../../src/simulation/turn/turn-processor';
import { createPerson } from '../../src/simulation/population/person';
import { createRNG } from '../../src/utils/rng';
import type { GameState, BuiltBuilding, Season } from '../../src/simulation/turn/game-state';
import type { Person, WorkRole } from '../../src/simulation/population/person';

function makeWorker(id: string, role: WorkRole, custom = 25): Person {
  return createPerson({
    id,
    firstName: id,
    familyName: 'Ashmark',
    sex: 'male',
    age: 28,
    role,
    socialStatus: 'settler',
    skills: {
      animals: 25,
      bargaining: 25,
      combat: 25,
      custom,
      leadership: 25,
      plants: 25,
    },
    heritage: {
      bloodline: [{ group: 'imanian', fraction: 1.0 }],
      primaryCulture: 'ansberite',
      culturalFluency: new Map([['ansberite', 1.0]]),
    },
  });
}

function makeBuilding(defId: BuiltBuilding['defId'], instanceId: string): BuiltBuilding {
  return {
    defId,
    instanceId,
    builtTurn: 0,
    style: null,
    claimedByPersonIds: [],
    ownerHouseholdId: null,
    assignedWorkerIds: [],
  };
}

function makeState(
  people: Map<string, Person>,
  buildings: BuiltBuilding[] = [makeBuilding('camp', 'camp_0')],
  overrides: { currentSeason?: Season; resources?: Partial<GameState['settlement']['resources']> } = {},
): GameState {
  return {
    version: '1.0.0',
    seed: 1,
    turnNumber: 10,
    currentSeason: overrides.currentSeason ?? 'summer',
    currentYear: 1,
    people,
    graveyard: [],
    settlement: {
      name: 'Test',
      location: 'marsh',
      buildings,
      constructionQueue: [],
      economyReserves: {},
      culturalBlend: 0.2,
      resources: {
        food: 100,
        cattle: 0,
        wealth: 0,
        steel: 0,
        lumber: 40,
        stone: 20,
        medicine: 10,
        horses: 0,
        ...overrides.resources,
      },
      populationCount: people.size,
      religiousPolicy: 'tolerant',
    } as unknown as GameState['settlement'],
    culture: {
      languages: new Map([['imanian', 1.0]]),
      primaryLanguage: 'imanian',
      languageDiversityTurns: 0,
      languageTension: 0,
      religions: new Map([['imanian_orthodox', 1.0]]),
      religiousTension: 0,
      culturalBlend: 0.2,
      hiddenWheelEmerged: false,
      hiddenWheelDivergenceTurns: 0,
      hiddenWheelSuppressedTurns: 0,
      practices: [],
      governance: 'patriarchal_imanian',
    },
    tribes: new Map(),
    company: {
      standing: 60,
      annualQuotaGold: 0,
      annualQuotaGoods: 0,
      quotaContributedGold: 0,
      quotaContributedGoods: 0,
      consecutiveFailures: 0,
      supportLevel: 'standard',
      yearsActive: 0,
      locationSupplyModifier: 1,
    } as unknown as GameState['company'],
    eventHistory: [],
    eventCooldowns: new Map(),
    pendingEvents: [],
    councilMemberIds: [],
    deferredEvents: [],
    households: new Map(),
    config: {
      seed: 1,
      difficulty: 'normal',
      settlementName: 'Test',
      startingTribes: [],
    } as unknown as GameState['config'],
    flags: { creoleEmergedNotified: false },
    identityPressure: { companyPressureTurns: 0, tribalPressureTurns: 0 },
    factions: [],
    activityLog: [],
    debugSettings: {
      showAutonomyLog: false,
      logSchemes: false,
      logOpinionDeltas: false,
      logFactionStrength: false,
      logAmbitions: false,
      pauseOnSchemeEvent: false,
      skipEvents: false,
    },
    famineStreak: 0,
    famineRecoveryTurn: 0,
    lowMoraleTurns: 0,
    massDesertionWarningFired: false,
    lastSettlementMorale: 0,
    communalResourceMinimum: { lumber: 15, stone: 5 },
    buildingWorkersInitialized: true,
  } as unknown as GameState;
}

describe('processDawn — autonomous communal construction', () => {
  it('commissions a logging_camp when the settlement has a real lumber workforce', () => {
    const people = new Map<string, Person>([
      ['l1', makeWorker('l1', 'gather_lumber', 45)],
      ['l2', makeWorker('l2', 'gather_lumber', 30)],
    ]);

    const result = processDawn(makeState(people), createRNG(1));
    expect(result.privateProjects.map(project => project.defId)).toContain('logging_camp');
    expect(result.privateProjects.find(project => project.defId === 'logging_camp')!.assignedWorkerIds).toEqual(['l1']);
    expect(result.updatedPeople.get('l1')!.role).toBe('builder');
  });

  it('does not upgrade logging_camp before the current communal site is fully staffed', () => {
    const people = new Map<string, Person>([
      ['l1', makeWorker('l1', 'gather_lumber', 45)],
      ['l2', makeWorker('l2', 'gather_lumber', 30)],
    ]);
    const buildings = [makeBuilding('camp', 'camp_0'), makeBuilding('logging_camp', 'log_0')];

    const result = processDawn(makeState(people, buildings), createRNG(1));
    expect(result.privateProjects.map(project => project.defId)).not.toContain('charcoal_burners');
  });

  it('upgrades logging_camp to charcoal_burners once enough lumberjacks exist', () => {
    const people = new Map<string, Person>([
      ['l1', makeWorker('l1', 'gather_lumber', 45)],
      ['l2', makeWorker('l2', 'gather_lumber', 30)],
      ['l3', makeWorker('l3', 'gather_lumber', 25)],
    ]);
    const buildings = [makeBuilding('camp', 'camp_0'), makeBuilding('logging_camp', 'log_0')];

    const result = processDawn(makeState(people, buildings), createRNG(1));
    expect(result.privateProjects.map(project => project.defId)).toContain('charcoal_burners');
  });

  it('commissions a stone_quarry when the settlement has a stone workforce', () => {
    const people = new Map<string, Person>([
      ['q1', makeWorker('q1', 'gather_stone', 42)],
      ['q2', makeWorker('q2', 'gather_stone', 31)],
    ]);

    const result = processDawn(makeState(people), createRNG(2));
    expect(result.privateProjects.map(project => project.defId)).toContain('stone_quarry');
  });

  it('commissions an infirmary when a max-intensity hospice patron acts on their own', () => {
    const patron: Person = {
      ...makeWorker('patron', 'unassigned', 25),
      householdId: 'hh1',
      ambition: {
        type: 'seek_hospice_investment',
        intensity: 1,
        targetPersonId: null,
        formedTurn: 1,
      },
    };
    const people = new Map<string, Person>([
      ['patron', patron],
    ]);
    const state = makeState(people);
    state.households = new Map([[
      'hh1',
      {
        id: 'hh1',
        memberIds: ['patron'],
        householdWealth: 10,
        dwellingBuildingId: null,
        buildingSlots: Array(9).fill(null),
      },
    ]]) as GameState['households'];

    const result = processDawn(state, createRNG(3));
    expect(result.privateProjects.map(project => project.defId)).toContain('infirmary');
    expect(result.updatedPeople.get('patron')!.ambition).toBeNull();
    expect(result.updatedPeople.get('patron')!.role).toBe('builder');
  });

  it('commissions a bathhouse when a max-intensity bathhouse patron acts on their own', () => {
    const patron: Person = {
      ...makeWorker('patron', 'bathhouse_attendant', 25),
      householdId: 'hh1',
      ambition: {
        type: 'seek_bathhouse_investment',
        intensity: 1,
        targetPersonId: null,
        formedTurn: 1,
      },
    };
    const people = new Map<string, Person>([
      ['patron', patron],
    ]);
    const buildings = [makeBuilding('camp', 'camp_0'), makeBuilding('pottery', 'pottery_0')];
    const state = makeState(people, buildings);
    state.households = new Map([[
      'hh1',
      {
        id: 'hh1',
        memberIds: ['patron'],
        householdWealth: 10,
        dwellingBuildingId: null,
        buildingSlots: Array(9).fill(null),
      },
    ]]) as GameState['households'];

    const result = processDawn(state, createRNG(4));
    expect(result.privateProjects.map(project => project.defId)).toContain('bathhouse');
    expect(result.updatedPeople.get('patron')!.ambition).toBeNull();
    expect(result.updatedPeople.get('patron')!.role).toBe('builder');
  });
});