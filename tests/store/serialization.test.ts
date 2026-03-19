/**
 * Tests for the GameState serialisation/deserialisation helpers.
 *
 * Regression coverage for:
 *   - The "Unknown" opinion bug: old saves without a `graveyard` field caused
 *     `nameOf(id)` to return 'Unknown' for any stored opinion entry whose owner
 *     had died before the graveyard was introduced (Phase 3.6). The fix is the
 *     `graveyard: ... ?? []` fallback in deserializeGameState.
 */

import { describe, it, expect } from 'vitest';
import { deserializeGameState, serializeGameState, deserializePerson, serializePerson } from '../../src/stores/serialization';
import { createInitialState } from '../../src/simulation/turn/initial-state';
import type { GameState } from '../../src/simulation/turn/game-state';

// ─── Minimal save builder ─────────────────────────────────────────────────────

/**
 * Returns a JSON string representing a minimal valid GameState save.
 * The base object does NOT include a `graveyard` field, simulating a save
 * produced before the graveyard was introduced.
 */
function makeMinimalSaveJson(extras: Record<string, unknown> = {}): string {
  return JSON.stringify({
    version: '1.0.0',
    seed: 1,
    turnNumber: 1,
    currentSeason: 'spring',
    currentYear: 1,
    people: [],
    tribes: [],
    households: [],
    culture: {
      languages: [],
      religions: [],
      primaryLanguage: 'imanian',
      languageDiversityTurns: 0,
      languageTension: 0,
      religiousTension: 0,
      culturalBlend: 0.5,
      hiddenWheelEmerged: false,
      hiddenWheelDivergenceTurns: 0,
      hiddenWheelSuppressedTurns: 0,
    },
    settlement: {
      name: 'Test Settlement',
      location: 'marsh',
      buildings: [],
      resources: {
        food: 0, cattle: 0, goods: 0, steel: 0,
        lumber: 0, stone: 0, medicine: 0, gold: 0, horses: 0,
      },
      populationCount: 0,
    },
    company: {
      standing: 60,
      annualQuotaGold: 0,
      annualQuotaGoods: 0,
      consecutiveFailures: 0,
      supportLevel: 'standard',
      yearsActive: 0,
    },
    eventHistory: [],
    eventCooldowns: [],
    pendingEvents: [],
    councilMemberIds: [],
    ...extras,
  });
}

// ─── graveyard backward compatibility ────────────────────────────────────────

describe('deserializeGameState — graveyard backward compatibility', () => {
  it('defaults graveyard to [] when field is absent (pre-graveyard save)', () => {
    // Regression: saves from before the graveyard was introduced caused
    // nameOf(id) to return 'Unknown' for any stored opinion entry. The fix is
    // the `?? []` fallback in deserializeGameState. This test ensures it stays.
    const state = deserializeGameState(makeMinimalSaveJson());
    expect(state.graveyard).toEqual([]);
  });

  it('preserves graveyard entries when the field is present', () => {
    const state = deserializeGameState(makeMinimalSaveJson({
      graveyard: [
        {
          id: 'person_1',
          firstName: 'Theon',
          familyName: 'Marsh',
          sex: 'male',
          birthYear: 10,
          deathYear: 35,
          deathCause: 'old_age',
          parentIds: [null, null],
          childrenIds: [],
          heritage: { bloodline: [], primaryCulture: 'imanian', culturalFluency: {} },
          portraitVariant: 1,
          ageAtDeath: 25,
        },
      ],
    }));
    expect(state.graveyard).toHaveLength(1);
    expect(state.graveyard[0]!.id).toBe('person_1');
    expect(state.graveyard[0]!.firstName).toBe('Theon');
    expect(state.graveyard[0]!.deathCause).toBe('old_age');
  });

  it('preserves multiple graveyard entries', () => {
    const entries = ['p1', 'p2', 'p3'].map(id => ({
      id,
      firstName: `Name_${id}`,
      familyName: 'Test',
      sex: 'female',
      birthYear: 1,
      deathYear: 40,
      deathCause: 'old_age',
      parentIds: [null, null],
      childrenIds: [],
      heritage: { bloodline: [], primaryCulture: 'imanian', culturalFluency: {} },
      portraitVariant: 1,
      ageAtDeath: 39,
    }));
    const state = deserializeGameState(makeMinimalSaveJson({ graveyard: entries }));
    expect(state.graveyard).toHaveLength(3);
    expect(state.graveyard.map(e => e.id)).toEqual(['p1', 'p2', 'p3']);
  });
});

// ─── Other backward-compat fallbacks ─────────────────────────────────────────

describe('deserializeGameState — other fallbacks', () => {
  it('provides religious policy fallback when absent', () => {
    const state = deserializeGameState(makeMinimalSaveJson());
    expect(state.settlement.religiousPolicy).toBe('tolerant');
  });

  it('provides identityPressure fallback when absent', () => {
    const state = deserializeGameState(makeMinimalSaveJson());
    expect(state.identityPressure).toEqual({ companyPressureTurns: 0, tribalPressureTurns: 0 });
  });

  it('provides flags fallback when absent', () => {
    const state = deserializeGameState(makeMinimalSaveJson());
    expect(state.flags).toEqual({ creoleEmergedNotified: false });
  });

  it('provides quotaContributed fallbacks when company fields are absent', () => {
    const state = deserializeGameState(makeMinimalSaveJson());
    expect(state.company.quotaContributedGold).toBe(0);
    expect(state.company.quotaContributedGoods).toBe(0);
  });

  it('provides culture hiddenWheel fallbacks when absent', () => {
    const state = deserializeGameState(makeMinimalSaveJson());
    expect(state.culture.hiddenWheelDivergenceTurns).toBe(0);
    expect(state.culture.hiddenWheelSuppressedTurns).toBe(0);
    expect(state.culture.hiddenWheelEmerged).toBe(false);
  });
});

// ─── buildingSlots migration ────────────────────────────────────────────────────

describe('deserializeGameState — buildingSlots migration', () => {
  function makeHouseholdJson(overrides: Record<string, unknown>) {
    return [
      ['hh1', {
        id: 'hh1',
        name: 'Test Household',
        isAutoNamed: true,
        tradition: 'imanian',
        headId: null,
        seniorWifeId: null,
        memberIds: [],
        ashkaMelathiBonds: [],
        foundedTurn: 0,
        dwellingBuildingId: null,
        productionBuildingIds: [],
        ...overrides,
      }],
    ];
  }

  it('computes buildingSlots from dwellingBuildingId when field is absent (old save)', () => {
    const state = deserializeGameState(makeMinimalSaveJson({
      households: makeHouseholdJson({ dwellingBuildingId: 'wattle_hut_1' }),
    }));
    const hh = state.households.get('hh1')!;
    expect(hh.buildingSlots[0]).toBe('wattle_hut_1');
    expect(hh.buildingSlots.slice(1)).toEqual(Array(8).fill(null));
  });

  it('merges dwellingBuildingId + productionBuildingIds into slots (old save)', () => {
    const state = deserializeGameState(makeMinimalSaveJson({
      households: makeHouseholdJson({
        dwellingBuildingId: 'hut_1',
        productionBuildingIds: ['smithy_1', 'fields_1'],
      }),
    }));
    const hh = state.households.get('hh1')!;
    expect(hh.buildingSlots[0]).toBe('hut_1');
    expect(hh.buildingSlots[1]).toBe('smithy_1');
    expect(hh.buildingSlots[2]).toBe('fields_1');
    expect(hh.buildingSlots.slice(3)).toEqual(Array(6).fill(null));
  });

  it('preserves explicit buildingSlots when already present (new save)', () => {
    const slots: (string | null)[] = [
      'compound_1', 'smithy_1', 'fields_1', null, null, null, null, null, null,
    ];
    const state = deserializeGameState(makeMinimalSaveJson({
      households: makeHouseholdJson({
        dwellingBuildingId: 'compound_1',
        productionBuildingIds: ['smithy_1', 'fields_1'],
        buildingSlots: slots,
      }),
    }));
    expect(state.households.get('hh1')!.buildingSlots).toEqual(slots);
  });

  it('returns 9 all-null slots for a household with no dwelling or production', () => {
    const state = deserializeGameState(makeMinimalSaveJson({
      households: makeHouseholdJson({}),
    }));
    const hh = state.households.get('hh1')!;
    expect(hh.buildingSlots).toHaveLength(9);
    expect(hh.buildingSlots.every(s => s === null)).toBe(true);
  });

  it('handles more than 8 productionBuildingIds by truncating to 8 slots', () => {
    // Pathological case: more production IDs than available slots.
    const prodIds = Array.from({ length: 10 }, (_, i) => `prod_${i}`);
    const state = deserializeGameState(makeMinimalSaveJson({
      households: makeHouseholdJson({ productionBuildingIds: prodIds }),
    }));
    const hh = state.households.get('hh1')!;
    // Slot 0 = null (no dwelling), slots 1–8 = first 8 prod IDs
    expect(hh.buildingSlots).toHaveLength(9);
    expect(hh.buildingSlots[0]).toBeNull();
    expect(hh.buildingSlots[1]).toBe('prod_0');
    expect(hh.buildingSlots[8]).toBe('prod_7');
  });
});

// ─── Person round-trip ────────────────────────────────────────────────────────

describe('serializePerson / deserializePerson round-trip', () => {
  it('preserves culturalFluency Map through round-trip', () => {
    const relationships = new Map([['other_id', 35]]);
    const culturalFluency = new Map([['ansberite' as const, 0.9], ['townborn' as const, 0.4]]);

    // Build a minimal person (only the fields the serialization touches)
    const person = {
      id: 'p1',
      firstName: 'Aelia',
      familyName: 'Voss',
      sex: 'female' as const,
      age: 28,
      relationships,
      heritage: {
        bloodline: [],
        primaryCulture: 'ansberite' as const,
        culturalFluency,
      },
      opinionModifiers: [],
      portraitVariant: 1,
      householdId: null,
      householdRole: null,
      ashkaMelathiPartnerIds: [],
      ambition: null,
    } as unknown as Parameters<typeof serializePerson>[0];

    const serial = serializePerson(person);
    const restored = deserializePerson(serial);

    expect(restored.relationships).toBeInstanceOf(Map);
    expect(restored.relationships.get('other_id')).toBe(35);
    expect(restored.heritage.culturalFluency).toBeInstanceOf(Map);
    expect(restored.heritage.culturalFluency.get('ansberite')).toBeCloseTo(0.9);
    expect(restored.heritage.culturalFluency.get('townborn')).toBeCloseTo(0.4);
  });

  it('provides opinionModifiers fallback for old saves', () => {
    const person = {
      id: 'p1',
      heritage: { bloodline: [], primaryCulture: 'imanian', culturalFluency: [] },
      relationships: [],
      // NOTE: no opinionModifiers field — simulating a pre-Phase-3.6 saved person
    } as unknown as Parameters<typeof deserializePerson>[0];

    const restored = deserializePerson(person);
    expect(restored.opinionModifiers).toEqual([]);
  });
});

// ─── Full GameState round-trip ────────────────────────────────────────────────

describe('serializeGameState / deserializeGameState round-trip', () => {
  it('graveyard entries survive a full serialize/deserialize cycle', () => {
    const partial = deserializeGameState(makeMinimalSaveJson());
    const stateWithGraveyard: GameState = {
      ...partial,
      graveyard: [
        {
          id: 'dead_1',
          firstName: 'Caius',
          familyName: 'Veld',
          sex: 'male',
          birthYear: 5,
          deathYear: 62,
          deathCause: 'old_age',
          parentIds: [null, null],
          childrenIds: [],
          heritage: { bloodline: [], primaryCulture: 'ansberite' as const, culturalFluency: new Map() },
          portraitVariant: 1,
          ageAtDeath: 57,
        },
      ],
    };

    const json = serializeGameState(stateWithGraveyard);
    const restored = deserializeGameState(json);

    expect(restored.graveyard).toHaveLength(1);
    expect(restored.graveyard[0]!.id).toBe('dead_1');
    expect(restored.graveyard[0]!.firstName).toBe('Caius');
  });
});

// ─── Household.isAutoNamed backward compatibility ─────────────────────────────

describe('deserializeGameState — Household.isAutoNamed backward compatibility', () => {
  it('defaults isAutoNamed to false when the field is absent (pre-lifecycle save)', () => {
    const json = makeMinimalSaveJson({
      households: [
        ['hh-1', {
          id: 'hh-1',
          name: 'Iron Hearth',
          tradition: 'imanian',
          headId: 'p1',
          seniorWifeId: null,
          memberIds: ['p1'],
          ashkaMelathiBonds: [],
          foundedTurn: 1,
          productionBuildingIds: [],
          dwellingBuildingId: null,
          // isAutoNamed deliberately absent — simulates pre-lifecycle save
        }],
      ],
    });
    const state = deserializeGameState(json);
    expect(state.households.size).toBe(1);
    // Old saves without isAutoNamed default to true (auto-naming enabled),
    // because households that predate the lifecycle system were all auto-named.
    expect(state.households.get('hh-1')!.isAutoNamed).toBe(true);
  });

  it('preserves isAutoNamed: true when present', () => {
    const json = makeMinimalSaveJson({
      households: [
        ['hh-2', {
          id: 'hh-2',
          name: 'Kettara Ashkaran',
          tradition: 'sauromatian',
          headId: null,
          seniorWifeId: 'p2',
          memberIds: ['p2'],
          ashkaMelathiBonds: [],
          foundedTurn: 2,
          productionBuildingIds: [],
          dwellingBuildingId: null,
          isAutoNamed: true,
        }],
      ],
    });
    const state = deserializeGameState(json);
    expect(state.households.get('hh-2')!.isAutoNamed).toBe(true);
  });

  it('preserves isAutoNamed: false (player-renamed) when present', () => {
    const json = makeMinimalSaveJson({
      households: [
        ['hh-3', {
          id: 'hh-3',
          name: 'My Custom Name',
          tradition: 'ansberite',
          headId: 'p3',
          seniorWifeId: null,
          memberIds: ['p3'],
          ashkaMelathiBonds: [],
          foundedTurn: 3,
          productionBuildingIds: [],
          dwellingBuildingId: null,
          isAutoNamed: false,
        }],
      ],
    });
    const state = deserializeGameState(json);
    expect(state.households.get('hh-3')!.isAutoNamed).toBe(false);
  });
});

// ─── deserializePerson — Phase 4.0 autonomy fallbacks ────────────────────────

describe('deserializePerson — Phase 4.0 autonomy fallbacks', () => {
  /** Minimal person shape from before Phase-4.0 autonomy fields were added. */
  const oldPerson = () => ({
    id: 'p1',
    heritage: { bloodline: [], primaryCulture: 'imanian', culturalFluency: [] },
    relationships: [],
    portraitVariant: 1,
    opinionModifiers: [],
  } as unknown as Parameters<typeof deserializePerson>[0]);

  it('defaults namedRelationships to [] when absent (pre-Phase-4 save)', () => {
    expect(deserializePerson(oldPerson()).namedRelationships).toEqual([]);
  });

  it('defaults activeScheme to null when absent (pre-Phase-4 save)', () => {
    expect(deserializePerson(oldPerson()).activeScheme).toBeNull();
  });

  it('defaults opinionSustainedSince to {} when absent', () => {
    expect(deserializePerson(oldPerson()).opinionSustainedSince).toEqual({});
  });

  it('defaults roleAssignedTurn to 0 when absent', () => {
    expect(deserializePerson(oldPerson()).roleAssignedTurn).toBe(0);
  });
});

// ─── deserializePerson — happiness and housing fallbacks ─────────────────────

describe('deserializePerson — happiness and housing fallbacks', () => {
  const oldPerson = () => ({
    id: 'p1',
    heritage: { bloodline: [], primaryCulture: 'imanian', culturalFluency: [] },
    relationships: [],
  } as unknown as Parameters<typeof deserializePerson>[0]);

  it('defaults lowHappinessTurns to 0 when absent', () => {
    expect(deserializePerson(oldPerson()).lowHappinessTurns).toBe(0);
  });

  it('defaults claimedBuildingId to null when absent', () => {
    expect(deserializePerson(oldPerson()).claimedBuildingId).toBeNull();
  });

  it('defaults joinedYear to 1 when absent', () => {
    expect(deserializePerson(oldPerson()).joinedYear).toBe(1);
  });
});

// ─── deserializePerson — apprenticeship fallbacks and round-trip ──────────────

describe('deserializePerson — apprenticeship fallbacks', () => {
  const oldPerson = () => ({
    id: 'p1',
    heritage: { bloodline: [], primaryCulture: 'imanian', culturalFluency: [] },
    relationships: [],
  } as unknown as Parameters<typeof deserializePerson>[0]);

  it('defaults apprenticeship to null when absent (pre-apprenticeship save)', () => {
    expect(deserializePerson(oldPerson()).apprenticeship).toBeNull();
  });

  it('defaults tradeTraining to {} when absent (pre-apprenticeship save)', () => {
    expect(deserializePerson(oldPerson()).tradeTraining).toEqual({});
  });

  it('preserves an active apprenticeship state through round-trip', () => {
    const withAppr = {
      ...oldPerson(),
      apprenticeship: { masterId: 'master_1', trade: 'farmer', progress: 0.65, startedTurn: 5 },
    } as unknown as Parameters<typeof deserializePerson>[0];
    const restored = deserializePerson(withAppr);
    expect(restored.apprenticeship).not.toBeNull();
    expect(restored.apprenticeship!.masterId).toBe('master_1');
    expect(restored.apprenticeship!.progress).toBeCloseTo(0.65);
  });

  it('preserves tradeTraining bonuses through round-trip', () => {
    const withTraining = {
      ...oldPerson(),
      tradeTraining: { farmer: 15, trader: 10 },
    } as unknown as Parameters<typeof deserializePerson>[0];
    const restored = deserializePerson(withTraining);
    expect(restored.tradeTraining).toMatchObject({ farmer: 15, trader: 10 });
  });

  it('preserves null apprenticeship as null', () => {
    const withNull = {
      ...oldPerson(),
      apprenticeship: null,
    } as unknown as Parameters<typeof deserializePerson>[0];
    expect(deserializePerson(withNull).apprenticeship).toBeNull();
  });
});

// ─── deserializeGameState — Phase 4.0 activity fallbacks ─────────────────────

describe('deserializeGameState — Phase 4.0 activity fallbacks', () => {
  it('defaults factions to [] when absent', () => {
    expect(deserializeGameState(makeMinimalSaveJson()).factions).toEqual([]);
  });

  it('defaults activityLog to [] when absent', () => {
    expect(deserializeGameState(makeMinimalSaveJson()).activityLog).toEqual([]);
  });
});

// ─── deserializeGameState — Phase 4.1/4.2 happiness and housing fallbacks ─────

describe('deserializeGameState — happiness and housing fallbacks', () => {
  it('defaults lowMoraleTurns to 0 when absent', () => {
    expect(deserializeGameState(makeMinimalSaveJson()).lowMoraleTurns).toBe(0);
  });

  it('defaults massDesertionWarningFired to false when absent', () => {
    expect(deserializeGameState(makeMinimalSaveJson()).massDesertionWarningFired).toBe(false);
  });

  it('defaults lastSettlementMorale to 0 when absent', () => {
    expect(deserializeGameState(makeMinimalSaveJson()).lastSettlementMorale).toBe(0);
  });

  it('defaults communalResourceMinimum to { lumber: 15, stone: 5 } when absent', () => {
    const state = deserializeGameState(makeMinimalSaveJson());
    expect(state.communalResourceMinimum).toEqual({ lumber: 15, stone: 5 });
  });

  it('defaults buildingWorkersInitialized to false when absent', () => {
    expect(deserializeGameState(makeMinimalSaveJson()).buildingWorkersInitialized).toBe(false);
  });
});

// ─── deserializeGameState — BuiltBuilding field fallbacks ────────────────────

describe('deserializeGameState — BuiltBuilding field fallbacks', () => {
  /** Settlement with one bare building missing the ownership/worker fields. */
  function settlementWithOldBuilding() {
    return {
      name: 'Test Settlement',
      location: 'marsh',
      buildings: [{ defId: 'camp', instanceId: 'camp_0', builtTurn: 1, style: null }],
      constructionQueue: [],
      resources: { food: 0, cattle: 0, goods: 0, steel: 0, lumber: 0, stone: 0, medicine: 0, gold: 0, horses: 0 },
      populationCount: 0,
    };
  }

  it('defaults BuiltBuilding.ownerHouseholdId to null when absent (pre-ownership save)', () => {
    const state = deserializeGameState(makeMinimalSaveJson({ settlement: settlementWithOldBuilding() }));
    expect(state.settlement.buildings[0]!.ownerHouseholdId).toBeNull();
  });

  it('defaults BuiltBuilding.assignedWorkerIds to [] when absent', () => {
    const state = deserializeGameState(makeMinimalSaveJson({ settlement: settlementWithOldBuilding() }));
    expect(state.settlement.buildings[0]!.assignedWorkerIds).toEqual([]);
  });

  it('defaults ConstructionProject.ownerHouseholdId to null when absent', () => {
    const json = makeMinimalSaveJson({
      settlement: {
        name: 'Test Settlement',
        location: 'marsh',
        buildings: [],
        constructionQueue: [{
          id: 'proj_1', defId: 'longhouse', style: null,
          progressPoints: 0, totalPoints: 100,
          assignedWorkerIds: [], startedTurn: 1,
          resourcesSpent: { food: 0, cattle: 0, goods: 0, steel: 0, lumber: 0, stone: 0, medicine: 0, gold: 0, horses: 0 },
          // ownerHouseholdId deliberately absent
        }],
        resources: { food: 0, cattle: 0, goods: 0, steel: 0, lumber: 0, stone: 0, medicine: 0, gold: 0, horses: 0 },
        populationCount: 0,
      },
    });
    const state = deserializeGameState(json);
    expect(state.settlement.constructionQueue[0]!.ownerHouseholdId).toBeNull();
  });
});

// ─── deserializeGameState — tribe trade-system fallbacks ─────────────────────

describe('deserializeGameState — tribe trade-system fallbacks', () => {
  /** Minimal tribe object predating the trade-system additions. */
  const oldTribe = { id: 'tribe_1', name: 'Riverfang' };

  it('defaults contactEstablished to false when absent', () => {
    const state = deserializeGameState(makeMinimalSaveJson({ tribes: [['tribe_1', oldTribe]] }));
    expect(state.tribes.get('tribe_1')!.contactEstablished).toBe(false);
  });

  it('defaults lastTradeTurn to null when absent', () => {
    const state = deserializeGameState(makeMinimalSaveJson({ tribes: [['tribe_1', oldTribe]] }));
    expect(state.tribes.get('tribe_1')!.lastTradeTurn).toBeNull();
  });

  it('defaults tradeHistoryCount to 0 when absent', () => {
    const state = deserializeGameState(makeMinimalSaveJson({ tribes: [['tribe_1', oldTribe]] }));
    expect(state.tribes.get('tribe_1')!.tradeHistoryCount).toBe(0);
  });
});

// --- deserializeGameState --- private economy fallbacks ---------------------

describe('deserializeGameState -- private economy fallbacks', () => {
  it('defaults settlement.economyReserves to {} when absent (old save)', () => {
    const state = deserializeGameState(makeMinimalSaveJson());
    expect(state.settlement.economyReserves).toEqual({});
  });

  it('preserves settlement.economyReserves when present in save', () => {
    const state = deserializeGameState(makeMinimalSaveJson({
      settlement: {
        name: 'Test Settlement',
        location: 'marsh',
        buildings: [],
        constructionQueue: [],
        resources: { food: 0, cattle: 0, goods: 0, steel: 0, lumber: 0, stone: 0, medicine: 0, gold: 0, horses: 0 },
        populationCount: 0,
        economyReserves: { lumber: 10, stone: 5 },
      },
    }));
    expect(state.settlement.economyReserves).toEqual({ lumber: 10, stone: 5 });
  });

  it('defaults household.householdGold to 0 when absent (old save)', () => {
    const state = deserializeGameState(makeMinimalSaveJson({
      households: [['hh1', {
        id: 'hh1', name: 'Test HH', isAutoNamed: true, tradition: 'imanian',
        headId: null, seniorWifeId: null, memberIds: [], ashkaMelathiBonds: [],
        foundedTurn: 0, dwellingBuildingId: null, productionBuildingIds: [],
        // householdGold deliberately absent
      }]],
    }));
    expect(state.households.get('hh1')!.householdGold).toBe(0);
  });

  it('preserves household.householdGold when present in save', () => {
    const state = deserializeGameState(makeMinimalSaveJson({
      households: [['hh1', {
        id: 'hh1', name: 'Test HH', isAutoNamed: true, tradition: 'imanian',
        headId: null, seniorWifeId: null, memberIds: [], ashkaMelathiBonds: [],
        foundedTurn: 0, dwellingBuildingId: null, productionBuildingIds: [],
        householdGold: 42,
      }]],
    }));
    expect(state.households.get('hh1')!.householdGold).toBe(42);
  });
});

// ─── hexMap round-trip ───────────────────────────────────────────────────────────────────

describe('hexMap round-trip', () => {
  const config = { difficulty: 'normal' as const, startingTribes: [], startingLocation: 'default' };

  it('hexMap.cells survives a serialize/deserialize cycle as a Map', () => {
    const state = createInitialState(config, 'Test Settlement', 42);
    const json = serializeGameState(state);
    const restored = deserializeGameState(json);

    expect(restored.hexMap.cells).toBeInstanceOf(Map);
  });

  it('hexMap.cells has the expected cell count after round-trip (21×21 = 441)', () => {
    const state = createInitialState(config, 'Test Settlement', 42);
    const json = serializeGameState(state);
    const restored = deserializeGameState(json);

    expect(restored.hexMap.cells.size).toBe(state.hexMap.cells.size);
    expect(restored.hexMap.cells.size).toBeGreaterThanOrEqual(441);
  });

  it('settlement hex cell terrain is preserved exactly', () => {
    const state = createInitialState(config, 'Test Settlement', 42);
    const sQ = state.hexMap.settlementQ;
    const sR = state.hexMap.settlementR;
    const key = `${sQ},${sR}`;
    const originalCell = state.hexMap.cells.get(key);

    const json = serializeGameState(state);
    const restored = deserializeGameState(json);
    const restoredCell = restored.hexMap.cells.get(key);

    expect(restoredCell).toBeDefined();
    expect(restoredCell!.terrain).toBe(originalCell!.terrain);
    expect(restoredCell!.q).toBe(sQ);
    expect(restoredCell!.r).toBe(sR);
  });

  it('hexMap.settlementQ and settlementR survive round-trip', () => {
    const state = createInitialState(config, 'Test Settlement', 42);
    const json = serializeGameState(state);
    const restored = deserializeGameState(json);

    expect(restored.hexMap.settlementQ).toBe(state.hexMap.settlementQ);
    expect(restored.hexMap.settlementR).toBe(state.hexMap.settlementR);
  });

  it('fallback generates a hexMap when hexMap field is absent (pre-migration save)', () => {
    // makeMinimalSaveJson omits hexMap entirely; deserializer should regenerate one.
    const state = deserializeGameState(makeMinimalSaveJson());
    expect(state.hexMap.cells).toBeInstanceOf(Map);
    expect(state.hexMap.cells.size).toBeGreaterThan(0);
  });
});
