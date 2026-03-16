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
