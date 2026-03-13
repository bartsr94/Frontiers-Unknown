/**
 * Zustand game store — the bridge between simulation logic and UI.
 *
 * All UI components read from this store and dispatch actions through it.
 * No UI component calls simulation functions directly.
 *
 * Architecture rule: [UI] → dispatch action → [Store] → call simulation fn → [simulation/]
 *
 * Save format: GameState with Maps serialised as [key, value][] arrays (JSON-safe).
 * localStorage key: 'palusteria_save'.
 */

import { create } from 'zustand';
import { createPerson } from '../simulation/population/person';
import { generateName } from '../simulation/population/naming';
import { processDawn, processDusk } from '../simulation/turn/turn-processor';
import { addResourceStocks, clampResourceStock, emptyResourceStock } from '../simulation/economy/resources';
import { validateTrade, executeTribeTradeLogic } from '../simulation/economy/trade';
import type { TradeOffer } from '../simulation/economy/trade';
import { validateCraft, applyCraft } from '../simulation/economy/crafting';
import type { CraftRecipeId } from '../simulation/economy/crafting';
import { applyQuotaResult } from '../simulation/economy/company';
import { applySpoilage } from '../simulation/economy/spoilage';
import { filterEligibleEvents, drawEvents, ALL_EVENTS, drainDeferredEvents, getEventById } from '../simulation/events/event-filter';
import { applyEventChoice } from '../simulation/events/resolver';
import type { ApplyChoiceResult } from '../simulation/events/resolver';
import { createRNG } from '../utils/rng';
import { createTribe, TRIBE_PRESETS } from '../simulation/world/tribes';
import { canMarry, performMarriage, formConcubineRelationship } from '../simulation/population/marriage';
import type { InformalUnionStyle } from '../simulation/population/marriage';
import { applyMarriageOpinionFloor, initializeBaselineOpinions } from '../simulation/population/opinions';
import { generateAmbition } from '../simulation/population/ambitions';
import { createFertilityProfile } from '../simulation/genetics/fertility';
import { ETHNIC_DISTRIBUTIONS } from '../data/ethnic-distributions';
import {
  canBuild,
  startConstruction as buildingStartConstruction,
  assignBuilder as buildingAssignBuilder,
  removeBuilder as buildingRemoveBuilder,
  cancelConstruction,
} from '../simulation/buildings/construction';
import { hasBuilding } from '../simulation/buildings/building-effects';
import type {
  GameState,
  TurnPhase,
  ResourceStock,
  Settlement,
  SettlementCulture,
  CompanyRelation,
  GameConfig,
  GameFlags,
  BuildingId,
  BuildingStyle,
  ReligiousPolicy,
} from '../simulation/turn/game-state';
import type { Person, WorkRole, CultureId } from '../simulation/population/person';
import { ETHNIC_GROUP_PRIMARY_LANGUAGE, ETHNIC_GROUP_CULTURE } from '../simulation/population/person';
import type { GameEvent, SkillCheckResult } from '../simulation/events/engine';
import type { BoundEvent } from '../simulation/events/engine';
import { resolveActors } from '../simulation/events/actor-resolver';
import { generateId } from '../utils/id';

// Re-export economy types consumed by UI components.
export type { TradeOffer };

// ─── Store interface ─────────────────────────────────────────────────────────

export interface GameStore {
  // ── State ────────────────────────────────────────────────────────────────
  gameState: GameState | null;
  currentPhase: TurnPhase;
  pendingEvents: BoundEvent[];
  currentEventIndex: number;
  /** The skill check result from the last resolved event choice. Cleared on next choice. */
  lastSkillCheckResult: SkillCheckResult | null;
  /** The full result object from the last resolved event choice. */
  lastChoiceResult: ApplyChoiceResult | null;
  /**
   * The spoilage from the current turn's dawn, if significant (> 3 units total).
   * Shown as a notification to the player during the management phase.
   * null if spoilage was below the display threshold.
   */
  lastSpoilage: Partial<ResourceStock> | null;
  /**
   * A one-time notification message to display to the player (e.g. creole emergence).
   * UI components should show this and then call `dismissNotification()`.
   * Null when no notification is pending.
   */
  pendingNotification: string | null;
  // ── Game lifecycle ────────────────────────────────────────────────────────
  newGame: (config: GameConfig, settlementName: string) => void;
  loadGame: (saveData: string) => void;
  saveGame: () => string;
  /** Clear the current pending notification. */
  dismissNotification: () => void;
  /** Dismiss the spoilage notification for this turn. */
  dismissSpoilage: () => void;

  // ── Turn flow ─────────────────────────────────────────────────────────────
  startTurn: () => void;
  resolveEventChoice: (eventId: string, choiceId: string) => void;
  nextEvent: () => void;
  enterManagementPhase: () => void;
  endTurn: () => void;

  // ── Management phase ──────────────────────────────────────────────────────
  assignRole: (personId: string, role: WorkRole) => void;
  arrangeMarriage: (personAId: string, personBId: string) => void;
  arrangeInformalUnion: (manId: string, womanId: string, style: InformalUnionStyle) => void;
  /**
   * Sends an unmarried young man (age 16–24) on Keth-Thara service for 4 turns.
   * Sets role to 'keth_thara'; queues hh_keth_thara_service_ends deferred event.
   * No-op if the person is ineligible.
   */
  assignKethThara: (personId: string) => void;
  /** Execute a barter trade with an external tribe (management phase only). */
  executeTrade: (tribeId: string, offer: TradeOffer, requested: TradeOffer) => void;
  /** Contribute gold and/or goods toward the Company's annual quota. */
  contributeToQuota: (gold: number, goods: number) => void;
  /** Execute a crafting recipe (management phase only). */
  performCraft: (recipeId: CraftRecipeId) => void;
  // ── Buildings ─────────────────────────────────────────────────────────────
  /** Queue a new construction project. Deducts resources immediately. No-op if canBuild fails. */
  startConstruction: (defId: BuildingId, style: BuildingStyle | null) => void;
  /** Assign a person as a builder on the given project. Person's role is set to 'builder'. */
  assignBuilder: (projectId: string, personId: string) => void;
  /** Remove a person from the given project. Person's role reverts to 'unassigned'. */
  removeBuilder: (projectId: string, personId: string) => void;
  /** Cancel a project in the construction queue; refunds 50% of resource cost. */
  cancelConstruction: (projectId: string) => void;
  // ── Religion ───────────────────────────────────────────────────────────────
  /** Update the settlement's religious policy. */
  setReligiousPolicy: (policy: ReligiousPolicy) => void;
  // ── Expedition Council ─────────────────────────────────────────
  /** Add a person to the Expedition Council (max 7 seats). No-op if already a member. */
  assignCouncilMember: (personId: string) => void;
  /** Remove a person from the Expedition Council. No-op if not a member. */
  removeCouncilMember: (personId: string) => void;
  // ── Derived / computed ────────────────────────────────────────────────────
  getPersonById: (id: string) => Person | undefined;
  getLivingPeople: () => Person[];
  getSettlementCulture: () => SettlementCulture | undefined;
  getFamilyOf: (personId: string) => Person[];
}

// ─── Serialisation helpers ───────────────────────────────────────────────────
// GameState contains several nested Maps which are not JSON-serialisable.
// We convert each Map to a [key, value][] array on save and reconstruct on load.

/** A Person with Maps replaced by serialisable arrays for JSON storage. */
interface SerialPerson extends Omit<Person, 'heritage' | 'relationships'> {
  heritage: {
    bloodline: Person['heritage']['bloodline'];
    primaryCulture: Person['heritage']['primaryCulture'];
    culturalFluency: [CultureId, number][];
  };
  relationships: [string, number][];
}

/** GameState with all Maps replaced by [key, value][] arrays. */
interface SerialGameState
  extends Omit<
    GameState,
    'people' | 'tribes' | 'culture' | 'eventCooldowns' | 'households'
  > {
  people: [string, SerialPerson][];
  tribes: [string, GameState['tribes'] extends Map<string, infer V> ? V : never][];
  households: [string, import('../simulation/turn/game-state').Household][];
  culture: Omit<SettlementCulture, 'languages' | 'religions'> & {
    languages: [string, number][];
    religions: [string, number][];
  };
  eventCooldowns: [string, number][];
}

function serializePerson(p: Person): SerialPerson {
  return {
    ...p,
    heritage: {
      ...p.heritage,
      culturalFluency: Array.from(p.heritage.culturalFluency.entries()),
    },
    relationships: Array.from(p.relationships.entries()),
  };
}

function deserializePerson(s: SerialPerson): Person {
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
  };
}

function serializeGameState(state: GameState): string {
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

function deserializeGameState(json: string): GameState {
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
      languages: new Map(s.culture.languages as [import('../simulation/population/person').LanguageId, number][]),
      religions: new Map(s.culture.religions as [import('../simulation/population/person').ReligionId, number][]),
      // Fallbacks for saves created before the religion system was added.
      hiddenWheelDivergenceTurns: (s.culture as Partial<typeof s.culture>).hiddenWheelDivergenceTurns ?? 0,
      hiddenWheelSuppressedTurns: (s.culture as Partial<typeof s.culture>).hiddenWheelSuppressedTurns ?? 0,
      hiddenWheelEmerged:         (s.culture as Partial<typeof s.culture>).hiddenWheelEmerged         ?? false,
    },
    eventCooldowns: new Map(s.eventCooldowns),
    households: new Map(s.households ?? []),
    deferredEvents: s.deferredEvents ?? [],
    flags: (s as GameState).flags ?? { creoleEmergedNotified: false },
    identityPressure: (s as Partial<GameState>).identityPressure ?? { companyPressureTurns: 0, tribalPressureTurns: 0 },
    settlement: {
      ...(s.settlement as typeof s.settlement),
      religiousPolicy: ((s.settlement as Partial<typeof s.settlement>).religiousPolicy) ?? 'tolerant',
    },
  };
}

const SAVE_KEY = 'palusteria_save';

// ─── Founding settlers ───────────────────────────────────────────────────────

/** All properties for each founding male settler, colocated for easy editing. */
const FOUNDING_SETTLERS: Array<{
  firstName:  string;
  familyName: string;
  role:       WorkRole;
  age:        number;
  traits:     Person['traits'];
  genetics:   Person['genetics'];
}> = [
  // 0 – Edmund Farrow, farmer 17 — young, earnest, careful
  {
    firstName: 'Edmund', familyName: 'Farrow', role: 'farmer', age: 17,
    traits: ['patient', 'humble'],
    genetics: { visibleTraits: { skinTone: 0.14, skinUndertone: 'cool_pink', hairColor: 'blonde',      hairTexture: 'straight', eyeColor: 'blue',  buildType: 'lean',     height: 'average',       facialStructure: 'oval'    }, genderRatioModifier: 0.5, extendedFertility: false },
  },
  // 1 – Aldric Vane, farmer 28 — weathered and broad-shouldered
  {
    firstName: 'Aldric', familyName: 'Vane', role: 'farmer', age: 28,
    traits: ['strong', 'patient'],
    genetics: { visibleTraits: { skinTone: 0.22, skinUndertone: 'neutral',   hairColor: 'dark_brown',  hairTexture: 'wavy',     eyeColor: 'grey',  buildType: 'athletic', height: 'tall',          facialStructure: 'broad'   }, genderRatioModifier: 0.5, extendedFertility: false },
  },
  // 2 – Corvin Ashby, farmer 31 — stocky, blunt-featured
  {
    firstName: 'Corvin', familyName: 'Ashby', role: 'farmer', age: 31,
    traits: ['strong', 'proud'],
    genetics: { visibleTraits: { skinTone: 0.19, skinUndertone: 'cool_pink', hairColor: 'dark_brown',  hairTexture: 'straight', eyeColor: 'blue',  buildType: 'stocky',   height: 'below_average', facialStructure: 'angular' }, genderRatioModifier: 0.5, extendedFertility: false },
  },
  // 3 – Leofric Morrow, farmer 25 — lean, narrow-faced, green-eyed
  {
    firstName: 'Leofric', familyName: 'Morrow', role: 'farmer', age: 25,
    traits: ['clever', 'content'],
    genetics: { visibleTraits: { skinTone: 0.16, skinUndertone: 'neutral',   hairColor: 'light_brown', hairTexture: 'wavy',     eyeColor: 'green', buildType: 'lean',     height: 'average',       facialStructure: 'narrow'  }, genderRatioModifier: 0.5, extendedFertility: false },
  },
  // 4 – Hawthorn Crale, farmer 30 — tall, grey-eyed, round features
  {
    firstName: 'Hawthorn', familyName: 'Crale', role: 'farmer', age: 30,
    traits: ['robust', 'brave'],
    genetics: { visibleTraits: { skinTone: 0.25, skinUndertone: 'neutral',   hairColor: 'dark_brown',  hairTexture: 'straight', eyeColor: 'grey',  buildType: 'athletic', height: 'tall',          facialStructure: 'round'   }, genderRatioModifier: 0.5, extendedFertility: false },
  },
  // 5 – Oswyn Dunmore, farmer 27 — fair and blue-eyed, wavy blonde
  {
    firstName: 'Oswyn', familyName: 'Dunmore', role: 'farmer', age: 27,
    traits: ['gregarious', 'honest'],
    genetics: { visibleTraits: { skinTone: 0.13, skinUndertone: 'cool_pink', hairColor: 'blonde',      hairTexture: 'wavy',     eyeColor: 'blue',  buildType: 'lean',     height: 'tall',          facialStructure: 'oval'    }, genderRatioModifier: 0.5, extendedFertility: false },
  },
  // 6 – Bastian Thorn, farmer 60 — the old hand, heavyset and weathered
  {
    firstName: 'Bastian', familyName: 'Thorn', role: 'farmer', age: 60,
    traits: ['traditional', 'veteran'],
    genetics: { visibleTraits: { skinTone: 0.26, skinUndertone: 'neutral',   hairColor: 'dark_brown',  hairTexture: 'straight', eyeColor: 'grey',  buildType: 'heavyset', height: 'average',       facialStructure: 'broad'   }, genderRatioModifier: 0.5, extendedFertility: false },
  },
  // 7 – Idris Halven, trader 24 — presentable, sharp green eyes
  {
    firstName: 'Idris', familyName: 'Halven', role: 'trader', age: 24,
    traits: ['gregarious', 'deceitful'],
    genetics: { visibleTraits: { skinTone: 0.17, skinUndertone: 'cool_pink', hairColor: 'light_brown', hairTexture: 'wavy',     eyeColor: 'green', buildType: 'lean',     height: 'tall',          facialStructure: 'narrow'  }, genderRatioModifier: 0.5, extendedFertility: false },
  },
  // 8 – Ren Coalwick, trader 29 — unremarkable face, watchful grey eyes
  {
    firstName: 'Ren', familyName: 'Coalwick', role: 'trader', age: 29,
    traits: ['clever', 'greedy'],
    genetics: { visibleTraits: { skinTone: 0.21, skinUndertone: 'neutral',   hairColor: 'dark_brown',  hairTexture: 'straight', eyeColor: 'grey',  buildType: 'athletic', height: 'average',       facialStructure: 'angular' }, genderRatioModifier: 0.5, extendedFertility: false },
  },
  // 9 – Callum Marsh, guard 33 — broad, blue-eyed, built to intimidate
  {
    firstName: 'Callum', familyName: 'Marsh', role: 'guard', age: 33,
    traits: ['brave', 'strong'],
    genetics: { visibleTraits: { skinTone: 0.23, skinUndertone: 'cool_pink', hairColor: 'dark_brown',  hairTexture: 'straight', eyeColor: 'blue',  buildType: 'stocky',   height: 'tall',          facialStructure: 'broad'   }, genderRatioModifier: 0.5, extendedFertility: false },
  },
];

// ─── Council seeding ─────────────────────────────────────────────────────────

/**
 * Auto-selects 5 founding council members: the guard, both traders,
 * and the 2 oldest farmers.
 */
function seedCouncil(people: Map<string, Person>): string[] {
  const all = Array.from(people.values());
  const guard   = all.filter(p => p.role === 'guard');
  const traders = all.filter(p => p.role === 'trader');
  const farmers = all
    .filter(p => p.role === 'farmer')
    .sort((a, b) => b.age - a.age)
    .slice(0, 2);
  return [...guard, ...traders, ...farmers].map(p => p.id);
}

// ─── Initial game state factory ───────────────────────────────────────────────

/**
 * Returns the key with the highest weight from a partial weight map.
 * Used to pick the most typical visible trait for a given ethnic distribution.
 */
function dominantTrait<T extends string>(
  weights: Partial<Record<T, number>>,
  fallback: T,
): T {
  const top = (Object.entries(weights) as [T, number][]).sort((a, b) => b[1] - a[1])[0];
  return top?.[0] ?? fallback;
}

function createInitialState(config: GameConfig, settlementName: string, seed?: number): GameState {
  // Generate a high-quality seed via the Web Crypto API when none is provided.
  // This avoids Math.random() (forbidden by Hard Rule #1) while still allowing
  // a deterministic seed to be passed in for replays and testing.
  const resolvedSeed = seed ?? (crypto.getRandomValues(new Uint32Array(1))[0]! >>> 0);
  const rng = createRNG(resolvedSeed);
  const people = new Map<string, Person>();

  FOUNDING_SETTLERS.forEach(settler => {
    const { firstName, familyName, role, age, traits, genetics } = settler;
    // Traders arrive with a working knowledge of Tradetalk — it would be
    // absurd to seek trade contacts without any common tongue.
    const languages: Person['languages'] = role === 'trader'
      ? [{ language: 'imanian', fluency: 1.0 }, { language: 'tradetalk', fluency: 0.4 }]
      : [{ language: 'imanian', fluency: 1.0 }];

    const person = createPerson({
      firstName,
      familyName,
      sex: 'male',
      age,
      role,
      socialStatus: 'founding_member',
      languages,
      genetics,
      traits,
    }, rng);
    people.set(person.id, person);
  });

  // Optional founding Sauromatian women (enable via GameConfig.includeSauromatianWomen).
  if (config.includeSauromatianWomen) {
    // Determine ethnic group from the first selected tribe, or fall back.
    const firstPresetId = config.startingTribes[0];
    const firstPreset = firstPresetId ? TRIBE_PRESETS[firstPresetId] : undefined;
    const sauroGroup = firstPreset?.ethnicGroup ?? 'kiswani_riverfolk';
    const sauroTraitDist = ETHNIC_DISTRIBUTIONS[sauroGroup];

    // Ages spread across 18–26 to give variety; names generated from the correct
    // ethnic naming pool so they match the tribe the player selected.
    const SAURO_FOUNDING_AGES: number[] = [18, 22, 26];
    // Each woman has a distinctive personality to make them memorable from the start.
    const SAURO_FOUNDING_TRAITS: Person['traits'][] = [
      ['brave', 'traditional'],
      ['clever', 'welcoming'],
      ['robust', 'proud'],
    ];

    for (const [womanIndex, womanAge] of SAURO_FOUNDING_AGES.entries()) {
      const { firstName, familyName } = generateName(
        'female',
        ETHNIC_GROUP_CULTURE[sauroGroup],
        '',
        '',
        rng,
      );
      const woman = createPerson({
        firstName,
        familyName,
        sex: 'female',
        age: womanAge,
        role: 'unassigned',
        socialStatus: 'newcomer',
        genetics: {
          visibleTraits: {
            skinTone: sauroTraitDist.skinTone.mean,
            skinUndertone: dominantTrait(sauroTraitDist.skinUndertone.weights, 'warm'  as Person['genetics']['visibleTraits']['skinUndertone']),
            hairColor:     dominantTrait(sauroTraitDist.hairColor.weights,     'black' as Person['genetics']['visibleTraits']['hairColor']),
            hairTexture:   dominantTrait(sauroTraitDist.hairTexture.weights,   'coily' as Person['genetics']['visibleTraits']['hairTexture']),
            eyeColor:      dominantTrait(sauroTraitDist.eyeColor.weights,      'brown' as Person['genetics']['visibleTraits']['eyeColor']),
            buildType:     dominantTrait(sauroTraitDist.buildType.weights,     'athletic' as Person['genetics']['visibleTraits']['buildType']),
            height:        dominantTrait(sauroTraitDist.height.weights,        'average' as Person['genetics']['visibleTraits']['height']),
            facialStructure: dominantTrait(sauroTraitDist.facialStructure.weights, 'oval' as Person['genetics']['visibleTraits']['facialStructure']),
          },
          genderRatioModifier: 0.14, // Pure Sauromatian
          extendedFertility: true,
        },
        fertility: createFertilityProfile(true),
        heritage: {
          bloodline: [{ group: sauroGroup, fraction: 1.0 }],
          primaryCulture: ETHNIC_GROUP_CULTURE[sauroGroup],
          culturalFluency: new Map<CultureId, number>([[ETHNIC_GROUP_CULTURE[sauroGroup], 1.0]]),
        },
        // Sauromatian women joining a trading company will have picked up some
        // Tradetalk — it's the lingua franca of cross-tribal commerce.
        languages: [
          { language: ETHNIC_GROUP_PRIMARY_LANGUAGE[sauroGroup], fluency: 1.0 },
          { language: 'tradetalk', fluency: 0.3 },
        ],
        religion: 'sacred_wheel',
        traits: SAURO_FOUNDING_TRAITS[womanIndex] ?? [],
      }, rng);
      people.set(woman.id, woman);
    }
  }

  const initialResources: ResourceStock = {
    ...emptyResourceStock(),
    food: 20,
    gold: 50,
    goods: 5,
    cattle: 5,
    lumber: 20,
    stone: 10,
  };

  const settlement: Settlement = {
    name: settlementName,
    location: config.startingLocation,
    buildings: [{ defId: 'camp', instanceId: 'camp_0', builtTurn: 0, style: null }],
    constructionQueue: [],
    resources: initialResources,
    populationCount: people.size,
    religiousPolicy: 'tolerant',
  };

  const culture: SettlementCulture = {
    languages: new Map([['imanian', 1.0]]),
    primaryLanguage: 'imanian',
    religions: new Map([['imanian_orthodox', 1.0]]),
    religiousTension: 0,
    culturalBlend: 0,
    practices: ['imanian_liturgy', 'company_law'],
    governance: 'patriarchal_imanian',
    languageDiversityTurns: 0,
    languageTension: 0,
    hiddenWheelDivergenceTurns: 0,
    hiddenWheelSuppressedTurns: 0,
    hiddenWheelEmerged: false,
  };

  const company: CompanyRelation = {
    standing: 60,
    annualQuotaGold: 20,
    annualQuotaTradeGoods: 5,
    consecutiveFailures: 0,
    supportLevel: 'standard',
    yearsActive: 0,
    quotaContributedGold: 0,
    quotaContributedGoods: 0,
  };

  // Instantiate tribes from selected presets.
  const tribes = new Map<string, ReturnType<typeof createTribe>>();
  for (const presetId of config.startingTribes) {
    const preset = TRIBE_PRESETS[presetId];
    if (preset) {
      const tribe = createTribe(preset);
      // Starting tribes are known contacts — trade is available immediately.
      tribe.contactEstablished = true;
      tribes.set(tribe.id, tribe);
    }
  }

  const initialGameState: GameState = {
    version: '1.0.0',
    seed: resolvedSeed,
    turnNumber: 0,
    currentSeason: 'spring',
    currentYear: 1,
    people,
    graveyard: [],
    settlement,
    culture,
    tribes,
    company,
    eventHistory: [],
    eventCooldowns: new Map(),
    pendingEvents: [],
    councilMemberIds: seedCouncil(people),
    deferredEvents: [],
    households: new Map(),
    config,
    flags: { creoleEmergedNotified: false },
    identityPressure: { companyPressureTurns: 0, tribalPressureTurns: 0 },
  };

  // ── Seed opinions and ambitions at game start ──────────────────────────────
  // Both systems normally run inside processDawn, but we initialize them
  // here so that Key Opinions and ambition badges are visible immediately
  // before the player takes their first turn.
  const opinionsSeeded = initializeBaselineOpinions(initialGameState.people);
  const seededPeople = new Map(opinionsSeeded);
  for (const [id, person] of seededPeople) {
    const ambition = generateAmbition(person, { ...initialGameState, people: seededPeople }, rng);
    if (ambition) {
      seededPeople.set(id, { ...person, ambition });
    }
  }

  return { ...initialGameState, people: seededPeople };
}

// ─── Store implementation ────────────────────────────────────────────────────

export const useGameStore = create<GameStore>((set, get) => {
  // Attempt to restore an existing save on first load.
  let initialState: GameState | null = null;

  // Cross-phase temporaries: set during startTurn (dawn), consumed by endTurn (dusk).
  // Kept as closure locals rather than reactive Zustand state to avoid spurious re-renders.
  let _pendingProduction: ResourceStock | undefined;
  let _pendingConsumption: ResourceStock | undefined;
  let _pendingSpoilage: Partial<ResourceStock> | undefined;
  try {
    const saved = localStorage.getItem(SAVE_KEY);
    if (saved) {
      initialState = deserializeGameState(saved);
    }
  } catch {
    // Corrupt save — start fresh.
    localStorage.removeItem(SAVE_KEY);
  }

  return {
    // ── Initial store state ───────────────────────────────────────────────
    gameState: initialState,
    currentPhase: 'idle',
    pendingEvents: [],
    currentEventIndex: 0,
    lastSkillCheckResult: null,
    lastChoiceResult: null,
    lastSpoilage: null,
    pendingNotification: null,

    // ── Game lifecycle ────────────────────────────────────────────────────
    newGame(config, settlementName) {
      const gameState = createInitialState(config, settlementName);
      set({ gameState, currentPhase: 'idle', pendingEvents: [], currentEventIndex: 0 });
      // Persist immediately so a reload after setup restores to the new game.
      localStorage.setItem(SAVE_KEY, serializeGameState(gameState));
    },

    loadGame(saveData) {
      try {
        const gameState = deserializeGameState(saveData);
        set({ gameState, currentPhase: 'idle', pendingEvents: [], currentEventIndex: 0 });
      } catch {
        console.error('[Palusteria] Failed to load save data.');
      }
    },

    saveGame() {
      const { gameState } = get();
      if (!gameState) return '';
      const json = serializeGameState(gameState);
      localStorage.setItem(SAVE_KEY, json);
      return json;
    },

    dismissNotification() {
      set({ pendingNotification: null });
    },

    dismissSpoilage() {
      set({ lastSpoilage: null });
    },

    // ── Turn flow ─────────────────────────────────────────────────────────

    startTurn() {
      const { gameState } = get();
      if (!gameState) return;

      const rng = createRNG(gameState.seed + gameState.turnNumber);
      const dawnResult = processDawn(gameState, rng);

      const postDawnState: GameState = {
        ...gameState,
        people: dawnResult.updatedPeople,
        graveyard: [...gameState.graveyard, ...dawnResult.newGraveyardEntries],
        households: (() => {
          if (dawnResult.updatedHouseholds.size === 0) return gameState.households;
          const merged = new Map(gameState.households);
          for (const [id, h] of dawnResult.updatedHouseholds) {
            merged.set(id, h);
          }
          return merged;
        })(),
        settlement: {
          ...gameState.settlement,
          populationCount: dawnResult.populationCount,
          buildings: (() => {
            let blds = [...gameState.settlement.buildings];
            // Remove replaced buildings first.
            for (const removedId of dawnResult.removedBuildingIds) {
              blds = blds.filter(b => b.defId !== removedId);
            }
            return [...blds, ...dawnResult.completedBuildings];
          })(),
          constructionQueue: dawnResult.updatedConstructionQueue,
        },
        culture: {
          ...gameState.culture,
          languages: dawnResult.updatedLanguageFractions,
          primaryLanguage:
            Array.from(dawnResult.updatedLanguageFractions.entries()).sort(
              (a, b) => b[1] - a[1],
            )[0]?.[0] ?? gameState.culture.primaryLanguage,
          languageTension: dawnResult.newLanguageTension,
          languageDiversityTurns: dawnResult.newLanguageDiversityTurns,
          culturalBlend: dawnResult.updatedCultureBlend,
          religions: dawnResult.updatedReligions,
          religiousTension: dawnResult.updatedReligiousTension,
          hiddenWheelDivergenceTurns: dawnResult.updatedHiddenWheelDivergenceTurns,
          hiddenWheelSuppressedTurns: dawnResult.updatedHiddenWheelSuppressedTurns,
          hiddenWheelEmerged:
            dawnResult.shouldFireHiddenWheelEvent
              ? gameState.culture.hiddenWheelEmerged  // stays as-is until player resolves the event
              : gameState.culture.hiddenWheelEmerged,
        },
        // Apply identity pressure: update counters and passive standing/disposition deltas.
        identityPressure: dawnResult.identityPressureResult.updatedPressure,
        company: {
          ...gameState.company,
          standing: Math.max(
            0,
            Math.min(
              100,
              gameState.company.standing + dawnResult.identityPressureResult.companyStandingDelta,
            ),
          ),
        },
        tribes: (() => {
          const deltas = dawnResult.identityPressureResult.tribeDispositionDeltas;
          if (deltas.length === 0) return gameState.tribes;
          const updatedTribes = new Map(gameState.tribes);
          for (const { tribeId, delta } of deltas) {
            const tribe = updatedTribes.get(tribeId);
            if (tribe) {
              updatedTribes.set(tribeId, {
                ...tribe,
                disposition: Math.max(-100, Math.min(100, tribe.disposition + delta)),
              });
            }
          }
          return updatedTribes;
        })(),
        // Append birth records to event history for genealogy / event-chain queries.
        eventHistory: [
          ...gameState.eventHistory,
          ...dawnResult.births.map(b => ({
            eventId: 'birth',
            turnNumber: gameState.turnNumber,
            choiceId: 'born',
            involvedPersonIds: [b.childId, b.motherId],
          })),
        ],
      };

      // Drain any deferred events whose turn has arrived, and prepend them
      // to the normal draw so they are resolved first.
      const { due: dueDeferred, remaining: remainingDeferred } = drainDeferredEvents(postDawnState);
      // Reconstruct deferred events as BoundEvents using stored actor bindings.
      const deferredBoundEvents: BoundEvent[] = dueDeferred
        .map(entry => {
          const ev = getEventById(entry.eventId);
          if (!ev) return null;
          return { ...ev, boundActors: entry.boundActors ?? {} } as BoundEvent;
        })
        .filter((e): e is BoundEvent => e !== null);

      // Restore 'away' roles for mission actors whose deferred events are now due.
      const restoredPeople = new Map(postDawnState.people);
      for (const entry of dueDeferred) {
        const missionActorId = entry.context['missionActorId'] as string | undefined;
        const prevRole = entry.context['prevRole'] as WorkRole | undefined;
        if (missionActorId && prevRole) {
          const p = restoredPeople.get(missionActorId);
          if (p && (p.role === 'away' || p.role === 'keth_thara')) {
            restoredPeople.set(missionActorId, { ...p, role: prevRole });
          }
        }
      }

      const stateAfterDrain: GameState = {
        ...postDawnState,
        people: restoredPeople,
        deferredEvents: remainingDeferred,
      };

      // Draw 1–3 events from the eligible pool.
      const eligible  = filterEligibleEvents(ALL_EVENTS, stateAfterDrain);
      const drawCount = 1 + rng.nextInt(0, 2);
      const hasTradingPost = hasBuilding(stateAfterDrain.settlement.buildings, 'trading_post');
      const weightBoosts: Record<string, number> = hasTradingPost ? { 'eco_passing_merchant': 2 } : {};
      const drawn     = drawEvents(eligible, drawCount, rng, weightBoosts);

      // Bind actors to each drawn event using the seeded RNG.
      const boundDrawn: BoundEvent[] = drawn.map(event => {
        if (!event.actorRequirements || event.actorRequirements.length === 0) {
          return { ...event, boundActors: {} } as BoundEvent;
        }
        const actors = resolveActors(event.actorRequirements, stateAfterDrain, rng);
        return { ...event, boundActors: actors ?? {} } as BoundEvent;
      });

      // If the Hidden Wheel divergence counter just crossed its threshold this dawn,
      // inject the emergence event as the first thing the player sees this turn.
      if (dawnResult.shouldFireHiddenWheelEvent) {
        const hiddenWheelEv = getEventById('rel_hidden_wheel_emerges');
        if (hiddenWheelEv) {
          deferredBoundEvents.unshift({ ...hiddenWheelEv, boundActors: {} } as BoundEvent);
        }
      }

      // Deferred events are prepended so they resolve before new draws.
      const allPending: BoundEvent[] = [...deferredBoundEvents, ...boundDrawn];

      // One-time creole emergence notification.
      const showCreoleNotification =
        dawnResult.creoleEmerged && !gameState.flags.creoleEmergedNotified;
      const stateWithFlags: GameState = showCreoleNotification
        ? { ...stateAfterDrain, flags: { ...stateAfterDrain.flags, creoleEmergedNotified: true } }
        : stateAfterDrain;

      _pendingProduction = dawnResult.production;
      _pendingConsumption = dawnResult.consumption;
      _pendingSpoilage = dawnResult.spoilageThisTurn;
      set({
        gameState: stateWithFlags,
        currentPhase: allPending.length > 0 ? 'event' : 'management',
        pendingEvents: allPending,
        currentEventIndex: 0,
        lastSpoilage: (() => {
          const s = dawnResult.spoilageThisTurn;
          const total = Object.values(s).reduce((acc, v) => acc + (v ?? 0), 0);
          return total >= 1 ? s : null;
        })(),
        ...(showCreoleNotification && {
          pendingNotification:
            'A new tongue is being born. Children raised in this settlement blend ' +
            'Imanian and Sauromatian speech into something neither — a settlement creole, ' +
            'native to this place and no other.',
        }),
      });
    },

    resolveEventChoice(eventId, choiceId) {
      const { gameState, pendingEvents } = get();
      if (!gameState) return;

      const event = pendingEvents.find(e => e.id === eventId);
      if (!event) return;

      // Derive a deterministic RNG for event resolution from the game seed.
      // Uses a different offset from processDawn (seed + turnNumber) to avoid
      // consuming the same sequence as the dawn phase.
      const rng = createRNG(gameState.seed ^ (gameState.turnNumber * 2654435761));
      const result = applyEventChoice(event, choiceId, gameState, rng, event.boundActors);

      // Do NOT remove the event from pendingEvents here. The event must remain
      // visible so the outcome/pending screen can reference it. nextEvent() is
      // responsible for removing it once the player has acknowledged the result.
      set({
        gameState: result.state,
        lastSkillCheckResult: result.skillCheckResult ?? null,
        lastChoiceResult: result,
      });
    },

    nextEvent() {
      const { currentEventIndex, pendingEvents, lastChoiceResult } = get();

      // Remove the just-resolved event from the front of the queue.
      const remaining = pendingEvents.filter((_, i) => i !== currentEventIndex);

      // If the resolved choice spawns a follow-up event, insert it next.
      const withFollowUp: BoundEvent[] = lastChoiceResult?.followUpEventId
        ? (() => {
            const followUp = getEventById(lastChoiceResult.followUpEventId);
            return followUp
              ? [{ ...followUp, boundActors: {} } as BoundEvent, ...remaining]
              : remaining;
          })()
        : remaining;

      if (withFollowUp.length > 0) {
        set({ pendingEvents: withFollowUp, currentEventIndex: 0 });
      } else {
        // All events resolved — clear queue and enter management phase.
        set({ currentPhase: 'management', pendingEvents: [], currentEventIndex: 0 });
      }
    },

    enterManagementPhase() {
      set({ currentPhase: 'management' });
    },

    endTurn() {
      const { gameState } = get();
      if (!gameState) return;

      const production = _pendingProduction ?? emptyResourceStock();
      const consumption = _pendingConsumption ?? emptyResourceStock();

      // Apply resource deltas: production + consumption (consumption is already negative).
      let rawResources = addResourceStocks(
        addResourceStocks(gameState.settlement.resources, production),
        consumption,
      );

      // Apply spoilage losses.
      if (_pendingSpoilage) {
        rawResources = applySpoilage(rawResources, _pendingSpoilage);
      }

      const updatedResources = clampResourceStock(rawResources);

      const duskResult = processDusk(gameState, gameState.currentSeason);

      // Update company relation based on quota outcome (autumn only).
      let updatedCompany = gameState.company;
      if (duskResult.quotaStatus !== null) {
        updatedCompany = applyQuotaResult(gameState.company, duskResult.quotaStatus);
      }
      if (duskResult.resetQuotaContributions) {
        updatedCompany = { ...updatedCompany, quotaContributedGold: 0, quotaContributedGoods: 0 };
      }

      // Apply religious standing drain (winter only).
      if (duskResult.winterReligiousStandingDelta !== 0) {
        updatedCompany = {
          ...updatedCompany,
          standing: Math.max(0, Math.min(100, updatedCompany.standing + duskResult.winterReligiousStandingDelta)),
        };
      }

      // Queue triggered Company event for next turn's event phase.
      let updatedDeferredEvents = gameState.deferredEvents;
      if (duskResult.quotaEventId) {
        updatedDeferredEvents = [
          ...updatedDeferredEvents,
          {
            eventId: duskResult.quotaEventId,
            scheduledTurn: gameState.turnNumber + 1,
            context: {},
            boundActors: {},
          },
        ];
      }
      if (duskResult.shouldFireCompanyReligionEvent) {
        updatedDeferredEvents = [
          ...updatedDeferredEvents,
          {
            eventId: 'rel_company_concern_letter',
            scheduledTurn: gameState.turnNumber + 1,
            context: {},
            boundActors: {},
          },
        ];
      }

      const updatedState: GameState = {
        ...gameState,
        currentSeason: duskResult.nextSeason,
        currentYear: duskResult.nextYear,
        turnNumber: gameState.turnNumber + 1,
        company: updatedCompany,
        deferredEvents: updatedDeferredEvents,
        settlement: {
          ...gameState.settlement,
          resources: updatedResources,
        },
      };

      const json = serializeGameState(updatedState);
      localStorage.setItem(SAVE_KEY, json);

      _pendingProduction = undefined;
      _pendingConsumption = undefined;
      _pendingSpoilage = undefined;
      set({
        gameState: updatedState,
        currentPhase: 'idle',
        lastSpoilage: null,
      });
    },

    // ── Management phase — stubs (Phase 2+) ───────────────────────────────

    assignRole(personId, role) {
      const { gameState } = get();
      if (!gameState) return;
      const person = gameState.people.get(personId);
      if (!person) return;
      const updatedPeople = new Map(gameState.people);
      updatedPeople.set(personId, { ...person, role });
      set({ gameState: { ...gameState, people: updatedPeople } });
    },

    arrangeInformalUnion(manId, womanId, style) {
      const { gameState } = get();
      if (!gameState) return;
      const man   = gameState.people.get(manId);
      const woman = gameState.people.get(womanId);
      if (!man || !woman) return;
      const result = formConcubineRelationship(man, woman, style, gameState);
      const updatedPeople = new Map(gameState.people);
      updatedPeople.set(result.updatedMan.id,   result.updatedMan);
      updatedPeople.set(result.updatedWoman.id, result.updatedWoman);
      const updatedHouseholds = new Map(gameState.households);
      updatedHouseholds.set(result.household.id, result.household);
      const updatedState: GameState = { ...gameState, people: updatedPeople, households: updatedHouseholds };
      const json = serializeGameState(updatedState);
      localStorage.setItem(SAVE_KEY, json);
      set({ gameState: updatedState });
    },

    arrangeMarriage(personAId, personBId) {
      const { gameState } = get();
      if (!gameState) return;

      const personA = gameState.people.get(personAId);
      const personB = gameState.people.get(personBId);
      if (!personA || !personB) return;

      const check = canMarry(personA, personB, gameState);
      if (!check.allowed) {
        console.warn(`[Palusteria] canMarry blocked: ${check.reason ?? 'unknown'}`);
        return;
      }

      const result = performMarriage(personA, personB, gameState);

      // Apply updated persons.
      const updatedPeople = new Map(gameState.people);
      updatedPeople.set(result.updatedPersonA.id, result.updatedPersonA);
      updatedPeople.set(result.updatedPersonB.id, result.updatedPersonB);

      // Apply opinion changes to bystander relationship maps.
      for (const change of result.opinionChanges) {
        const observer = updatedPeople.get(change.observerId);
        if (!observer) continue;
        const currentOpinion = observer.relationships.get(change.targetId) ?? 0;
        const updatedRelationships = new Map(observer.relationships);
        updatedRelationships.set(change.targetId, Math.max(-100, Math.min(100, currentOpinion + change.delta)));
        updatedPeople.set(observer.id, { ...observer, relationships: updatedRelationships });
      }

      // Apply marriage opinion floor (+40 minimum between spouses).
      {
        const updatedA = updatedPeople.get(result.updatedPersonA.id)!;
        const updatedB = updatedPeople.get(result.updatedPersonB.id)!;
        const [flooredA, flooredB] = applyMarriageOpinionFloor(updatedA, updatedB);
        updatedPeople.set(flooredA.id, flooredA);
        updatedPeople.set(flooredB.id, flooredB);
      }

      // Apply household changes.
      const updatedHouseholds = new Map(gameState.households);
      updatedHouseholds.set(result.household.id, result.household);

      const updatedState: GameState = {
        ...gameState,
        people: updatedPeople,
        households: updatedHouseholds,
        eventHistory: [...gameState.eventHistory, result.eventRecord],
      };

      const json = serializeGameState(updatedState);
      localStorage.setItem(SAVE_KEY, json);
      set({ gameState: updatedState });
    },

    assignKethThara(personId) {
      const { gameState } = get();
      if (!gameState) return;
      const person = gameState.people.get(personId);
      if (!person) return;
      // Eligibility: unmarried male, age 16–24, not already away or keth_thara
      if (person.sex !== 'male') return;
      if (person.age < 16 || person.age > 24) return;
      if (person.spouseIds.length > 0) return;
      if (person.role === 'away' || person.role === 'keth_thara') return;

      const prevRole = person.role;
      const updatedPeople = new Map(gameState.people);
      updatedPeople.set(personId, { ...person, role: 'keth_thara' });

      const deferredEntry = {
        eventId: 'hh_keth_thara_service_ends',
        scheduledTurn: gameState.turnNumber + 4,
        context: { missionActorId: personId, prevRole },
        boundActors: { youth: personId },
      };

      const updatedState: GameState = {
        ...gameState,
        people: updatedPeople,
        deferredEvents: [...gameState.deferredEvents, deferredEntry],
      };
      const json = serializeGameState(updatedState);
      localStorage.setItem(SAVE_KEY, json);
      set({ gameState: updatedState });
    },

    setReligiousPolicy(policy) {
      const { gameState } = get();
      if (!gameState) return;
      const updatedState: GameState = {
        ...gameState,
        settlement: { ...gameState.settlement, religiousPolicy: policy },
        // Recognising the Hidden Wheel automatically marks it as emerged.
        culture: policy === 'hidden_wheel_recognized'
          ? { ...gameState.culture, hiddenWheelEmerged: true }
          : gameState.culture,
      };
      const json = serializeGameState(updatedState);
      localStorage.setItem(SAVE_KEY, json);
      set({ gameState: updatedState });
    },

    executeTrade(tribeId, offer, requested) {
      const { gameState, currentPhase } = get();
      if (!gameState || currentPhase !== 'management') return;
      const tribe = gameState.tribes.get(tribeId);
      if (!tribe) return;
      const validation = validateTrade(offer, requested, gameState.settlement.resources, tribe, gameState.turnNumber);
      if (!validation.ok) return;
      const result = executeTribeTradeLogic(gameState.settlement.resources, offer, requested, tribe, gameState.turnNumber);
      const updatedTribe = {
        ...tribe,
        disposition: Math.max(0, Math.min(100, tribe.disposition + result.dispositionDelta)),
        tradeHistoryCount: result.newTradeHistoryCount,
        lastTradeTurn: result.tradeTurn,
      };
      const updatedTribes = new Map(gameState.tribes);
      updatedTribes.set(tribeId, updatedTribe);
      set({
        gameState: {
          ...gameState,
          tribes: updatedTribes,
          settlement: { ...gameState.settlement, resources: result.newResources },
        },
      });
    },

    contributeToQuota(gold, goods) {
      const { gameState, currentPhase } = get();
      if (!gameState || currentPhase !== 'management') return;
      const { company, settlement } = gameState;
      const actualGold  = Math.min(Math.max(0, gold),  settlement.resources.gold);
      const actualGoods = Math.min(Math.max(0, goods), settlement.resources.goods);
      if (actualGold === 0 && actualGoods === 0) return;
      const updatedResources: ResourceStock = {
        ...settlement.resources,
        gold:  settlement.resources.gold  - actualGold,
        goods: settlement.resources.goods - actualGoods,
      };
      const updatedCompany: CompanyRelation = {
        ...company,
        quotaContributedGold:  company.quotaContributedGold  + actualGold,
        quotaContributedGoods: company.quotaContributedGoods + actualGoods,
      };
      set({
        gameState: {
          ...gameState,
          company: updatedCompany,
          settlement: { ...settlement, resources: updatedResources },
        },
      });
    },

    performCraft(recipeId) {
      const { gameState, currentPhase } = get();
      if (!gameState || currentPhase !== 'management') return;
      const validation = validateCraft(recipeId, gameState.settlement.buildings, gameState.settlement.resources);
      if (!validation.ok) return;
      const newResources = applyCraft(recipeId, gameState.settlement.resources);
      set({
        gameState: {
          ...gameState,
          settlement: { ...gameState.settlement, resources: newResources },
        },
      });
    },

    // ── Buildings ────────────────────────────────────────────────────────────

    startConstruction(defId, style) {
      const { gameState } = get();
      if (!gameState) return;
      const check = canBuild(gameState.settlement, defId, style);
      if (!check.ok) return;
      const { project, updatedResources } = buildingStartConstruction(
        gameState.settlement,
        defId,
        style,
        gameState.turnNumber,
      );
      set({
        gameState: {
          ...gameState,
          settlement: {
            ...gameState.settlement,
            resources: updatedResources,
            constructionQueue: [...gameState.settlement.constructionQueue, project],
          },
        },
      });
    },

    assignBuilder(projectId, personId) {
      const { gameState } = get();
      if (!gameState) return;
      const project = gameState.settlement.constructionQueue.find(p => p.id === projectId);
      const person = gameState.people.get(personId);
      if (!project || !person) return;
      if (person.role === 'away') return; // Cannot assign a person who is away on a mission
      const updatedProject = buildingAssignBuilder(project, personId);
      const updatedPeople = new Map(gameState.people);
      updatedPeople.set(personId, { ...person, role: 'builder' });
      set({
        gameState: {
          ...gameState,
          people: updatedPeople,
          settlement: {
            ...gameState.settlement,
            constructionQueue: gameState.settlement.constructionQueue.map(p =>
              p.id === projectId ? updatedProject : p,
            ),
          },
        },
      });
    },

    removeBuilder(projectId, personId) {
      const { gameState } = get();
      if (!gameState) return;
      const project = gameState.settlement.constructionQueue.find(p => p.id === projectId);
      const person = gameState.people.get(personId);
      if (!project || !person) return;
      const updatedProject = buildingRemoveBuilder(project, personId);
      const updatedPeople = new Map(gameState.people);
      updatedPeople.set(personId, { ...person, role: 'unassigned' });
      set({
        gameState: {
          ...gameState,
          people: updatedPeople,
          settlement: {
            ...gameState.settlement,
            constructionQueue: gameState.settlement.constructionQueue.map(p =>
              p.id === projectId ? updatedProject : p,
            ),
          },
        },
      });
    },

    cancelConstruction(projectId) {
      const { gameState } = get();
      if (!gameState) return;
      const project = gameState.settlement.constructionQueue.find(p => p.id === projectId);
      if (!project) return;
      const { refund, freedWorkerIds } = cancelConstruction(project);
      // Free workers.
      const updatedPeople = new Map(gameState.people);
      for (const wId of freedWorkerIds) {
        const w = updatedPeople.get(wId);
        if (w) updatedPeople.set(wId, { ...w, role: 'unassigned' });
      }
      // Refund resources.
      const updatedResources = addResourceStocks(gameState.settlement.resources, refund);
      set({
        gameState: {
          ...gameState,
          people: updatedPeople,
          settlement: {
            ...gameState.settlement,
            resources: clampResourceStock(updatedResources),
            constructionQueue: gameState.settlement.constructionQueue.filter(p => p.id !== projectId),
          },
        },
      });
    },

    // ── Expedition Council ────────────────────────────────────────

    assignCouncilMember(personId) {
      const { gameState } = get();
      if (!gameState) return;
      const { councilMemberIds } = gameState;
      if (councilMemberIds.includes(personId)) return;  // already on council
      if (councilMemberIds.length >= 7) return;          // council full
      set({ gameState: { ...gameState, councilMemberIds: [...councilMemberIds, personId] } });
    },

    removeCouncilMember(personId) {
      const { gameState } = get();
      if (!gameState) return;
      set({
        gameState: {
          ...gameState,
          councilMemberIds: gameState.councilMemberIds.filter(id => id !== personId),
        },
      });
    },

    // ── Derived state (computed, not stored) ──────────────────────────────

    getPersonById(id) {
      return get().gameState?.people.get(id);
    },

    getLivingPeople() {
      const { gameState } = get();
      if (!gameState) return [];
      return Array.from(gameState.people.values());
    },

    getSettlementCulture() {
      return get().gameState?.culture;
    },

    getFamilyOf(personId) {
      const { gameState } = get();
      if (!gameState) return [];
      const person = gameState.people.get(personId);
      if (!person) return [];
      const familyIds = new Set<string>([
        ...person.spouseIds,
        ...person.childrenIds,
        ...(person.parentIds.filter(Boolean) as string[]),
      ]);
      return Array.from(familyIds)
        .map(id => gameState.people.get(id))
        .filter((p): p is Person => p !== undefined);
    },
  };
});
