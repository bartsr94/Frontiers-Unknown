/**
 * Pure serialisation/deserialisation helpers for GameState ↔ JSON (localStorage).
 *
 * Extracted from game-store.ts so they can be unit-tested in isolation without
 * loading the Zustand store (which requires a browser DOM via the persist
 * middleware in the test environment).
 *
 * GameState contains several nested Maps that are not JSON-serialisable.
 * We convert each Map to a [key, value][] array on save and reconstruct on load.
 */

import type { Person, CultureId, LanguageId, ReligionId } from '../simulation/population/person';
import type { GameState, SettlementCulture, CompanyRelation, Household } from '../simulation/turn/game-state';
import { defaultDebugSettings } from '../simulation/turn/game-state';
import { createTribe } from '../simulation/world/tribes';

// ─── Serial types ─────────────────────────────────────────────────────────────

/** A Person with Maps replaced by serialisable arrays for JSON storage. */
export interface SerialPerson extends Omit<Person, 'heritage' | 'relationships'> {
  heritage: {
    bloodline: Person['heritage']['bloodline'];
    primaryCulture: Person['heritage']['primaryCulture'];
    culturalFluency: [CultureId, number][];
  };
  relationships: [string, number][];
}

/** GameState with all Maps replaced by [key, value][] arrays. */
export interface SerialGameState
  extends Omit<
    GameState,
    'people' | 'tribes' | 'culture' | 'eventCooldowns' | 'households'
  > {
  people: [string, SerialPerson][];
  tribes: [string, GameState['tribes'] extends Map<string, infer V> ? V : never][];
  households: [string, Household][];
  culture: Omit<SettlementCulture, 'languages' | 'religions'> & {
    languages: [string, number][];
    religions: [string, number][];
  };
  eventCooldowns: [string, number][];
}

// ─── Person helpers ───────────────────────────────────────────────────────────

export function serializePerson(p: Person): SerialPerson {
  return {
    ...p,
    heritage: {
      ...p.heritage,
      culturalFluency: Array.from(p.heritage.culturalFluency.entries()),
    },
    relationships: Array.from(p.relationships.entries()),
  };
}

export function deserializePerson(s: SerialPerson): Person {
  return {
    ...s,
    heritage: {
      ...s.heritage,
      culturalFluency: new Map(s.heritage.culturalFluency),
    },
    relationships: new Map(s.relationships),
    // Old saves pre-dating the portrait system won't have this field; default to 1.
    portraitVariant: s.portraitVariant ?? 1,
    // Old saves pre-dating the household system default to unattached.
    householdId: s.householdId ?? null,
    householdRole: s.householdRole ?? null,
    ashkaMelathiPartnerIds: s.ashkaMelathiPartnerIds ?? [],
    // Old saves pre-dating the ambitions system default to null.
    ambition: s.ambition ?? null,
    // Old saves pre-dating the timed opinion modifier system default to empty.
    opinionModifiers: s.opinionModifiers ?? [],
    // Phase 4.0 autonomy fields — not present in pre-Phase-4 saves.
    namedRelationships: s.namedRelationships ?? [],
    activeScheme: s.activeScheme ?? null,
    roleAssignedTurn: s.roleAssignedTurn ?? 0,
    opinionSustainedSince: s.opinionSustainedSince ?? {},
    // Phase 5 happiness fields — not present in pre-Phase-5 saves.
    lowHappinessTurns: (s as Partial<typeof s>).lowHappinessTurns ?? 0,
    claimedBuildingId: (s as Partial<typeof s>).claimedBuildingId ?? null,
    // Housing & specialisation fields.
    joinedYear: (s as Partial<typeof s>).joinedYear ?? 1,
    // Apprenticeship fields — not present in pre-apprenticeship saves.
    apprenticeship: (s as Partial<typeof s>).apprenticeship ?? null,
    tradeTraining: (s as Partial<typeof s>).tradeTraining ?? {},
  };
}

// ─── GameState helpers ────────────────────────────────────────────────────────

export function serializeGameState(state: GameState): string {
  const serial: SerialGameState = {
    ...state,
    people: Array.from(state.people.entries()).map(
      ([id, p]) => [id, serializePerson(p)] as [string, SerialPerson],
    ),
    tribes: Array.from(state.tribes.entries()) as SerialGameState['tribes'],
    households: Array.from(state.households.entries()),
    culture: {
      ...state.culture,
      languages: Array.from(state.culture.languages.entries()),
      religions: Array.from(state.culture.religions.entries()),
    },
    eventCooldowns: Array.from(state.eventCooldowns.entries()),
  };
  return JSON.stringify(serial);
}

export function deserializeGameState(json: string): GameState {
  const s: SerialGameState = JSON.parse(json) as SerialGameState;
  const rawCompany = s.company as Partial<CompanyRelation> & typeof s.company;
  const restoredCompany: CompanyRelation = {
    ...s.company,
    quotaContributedGold:  rawCompany.quotaContributedGold  ?? 0,
    quotaContributedGoods: rawCompany.quotaContributedGoods ?? 0,
  };
  // Restore ExternalTribe fields added for the trade system.
  const restoredTribes = new Map(
    (s.tribes as Array<[string, ReturnType<typeof createTribe>]>).map(([id, t]) => {
      const tribeWithFallbacks = {
        ...t,
        contactEstablished: t.contactEstablished ?? false,
        lastTradeTurn:      t.lastTradeTurn      ?? null,
        tradeHistoryCount:  t.tradeHistoryCount  ?? 0,
        tradeDesires:       t.tradeDesires       ?? [],
        tradeOfferings:     t.tradeOfferings     ?? [],
      };
      return [id, tribeWithFallbacks] as [string, typeof tribeWithFallbacks];
    }),
  );
  return {
    ...s,
    company: restoredCompany,
    people: new Map(s.people.map(([id, p]) => [id, deserializePerson(p)])),
    tribes: restoredTribes,
    culture: {
      ...s.culture,
      languages: new Map(s.culture.languages as [LanguageId, number][]),
      religions: new Map(s.culture.religions as [ReligionId, number][]),
      // Fallbacks for saves created before the religion system was added.
      hiddenWheelDivergenceTurns: (s.culture as Partial<typeof s.culture>).hiddenWheelDivergenceTurns ?? 0,
      hiddenWheelSuppressedTurns: (s.culture as Partial<typeof s.culture>).hiddenWheelSuppressedTurns ?? 0,
      hiddenWheelEmerged:         (s.culture as Partial<typeof s.culture>).hiddenWheelEmerged         ?? false,
    },
    eventCooldowns: new Map(s.eventCooldowns),
    households: new Map(
      (s.households ?? []).map(([id, h]) => [
        id,
        {
          ...h,
          dwellingBuildingId:  (h as Partial<typeof h>).dwellingBuildingId  ?? null,
          productionBuildingIds: (h as Partial<typeof h>).productionBuildingIds ?? [],
          isAutoNamed: (h as Partial<typeof h>).isAutoNamed ?? true,
        },
      ]),
    ),
    // Backward compat: saves from before the graveyard was introduced won't have
    // this field. Default to empty array so opinion/family lookups never surface
    // "Unknown" names from pre-graveyard deaths.
    graveyard: ((s as unknown as Partial<GameState>).graveyard ?? []).map((g: any) => ({
      ...g,
      // Backward compat: pre-Family-Tree-Overlay saves won't have portrait fields.
      portraitVariant: g.portraitVariant ?? 1,
      ageAtDeath:      g.ageAtDeath      ?? 0,
    })),
    deferredEvents: s.deferredEvents ?? [],
    flags: (s as unknown as GameState).flags ?? { creoleEmergedNotified: false },
    identityPressure: (s as unknown as Partial<GameState>).identityPressure ?? { companyPressureTurns: 0, tribalPressureTurns: 0 },
    settlement: {
      ...(s.settlement as typeof s.settlement),
      religiousPolicy: ((s.settlement as Partial<typeof s.settlement>).religiousPolicy) ?? 'tolerant',
      courtshipNorms:  ((s.settlement as Partial<typeof s.settlement>).courtshipNorms)  ?? 'mixed',
      buildings: (s.settlement as typeof s.settlement).buildings.map(b => ({
        ...b,
        ownerHouseholdId:  (b as Partial<typeof b>).ownerHouseholdId  ?? null,
        assignedWorkerIds: (b as Partial<typeof b>).assignedWorkerIds ?? [],
      })),
      constructionQueue: ((s.settlement as typeof s.settlement).constructionQueue ?? []).map(p => ({
        ...p,
        ownerHouseholdId: (p as Partial<typeof p>).ownerHouseholdId ?? null,
      })),
    },
    // Phase 4.0 autonomy fields.
    factions:       (s as unknown as Partial<GameState>).factions       ?? [],
    activityLog:    (s as unknown as Partial<GameState>).activityLog    ?? [],
    debugSettings:  (s as unknown as Partial<GameState>).debugSettings  ?? defaultDebugSettings(),
    // Phase 5 happiness fields.
    lowMoraleTurns:            (s as unknown as Partial<GameState>).lowMoraleTurns            ?? 0,
    massDesertionWarningFired: (s as unknown as Partial<GameState>).massDesertionWarningFired ?? false,
    lastSettlementMorale:      (s as unknown as Partial<GameState>).lastSettlementMorale      ?? 0,
    // Housing & specialisation fields.
    communalResourceMinimum:   (s as unknown as Partial<GameState>).communalResourceMinimum   ?? { lumber: 15, stone: 5 },
    buildingWorkersInitialized:(s as unknown as Partial<GameState>).buildingWorkersInitialized ?? false,
  };
}
