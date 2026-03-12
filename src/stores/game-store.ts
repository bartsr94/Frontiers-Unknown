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
import { processDawn, processDusk } from '../simulation/turn/turn-processor';
import { addResourceStocks, clampResourceStock, emptyResourceStock } from '../simulation/economy/resources';
import { filterEligibleEvents, drawEvents, ALL_EVENTS } from '../simulation/events/event-filter';
import { applyEventChoice } from '../simulation/events/resolver';
import { createRNG } from '../utils/rng';
import { createTribe, TRIBE_PRESETS } from '../simulation/world/tribes';
import { canMarry, performMarriage } from '../simulation/population/marriage';
import { createFertilityProfile } from '../simulation/genetics/fertility';
import { ETHNIC_DISTRIBUTIONS } from '../data/ethnic-distributions';
import type {
  GameState,
  TurnPhase,
  ResourceStock,
  Settlement,
  SettlementCulture,
  CompanyRelation,
  GameConfig,
} from '../simulation/turn/game-state';
import type { Person, WorkRole, CultureId } from '../simulation/population/person';
import { ETHNIC_GROUP_PRIMARY_LANGUAGE, ETHNIC_GROUP_CULTURE } from '../simulation/population/person';
import type { GameEvent } from '../simulation/events/engine';

// ─── Stub types (Phase 3) ────────────────────────────────────────────────────

/** Stub: trade offer interface. Fully implemented in Phase 3. */
export interface TradeOffer {}

/** Stub: diplomatic action interface. Fully implemented in Phase 3. */
export interface DiplomaticAction {}

// ─── Store interface ─────────────────────────────────────────────────────────

export interface GameStore {
  // ── State ────────────────────────────────────────────────────────────────
  gameState: GameState | null;
  currentPhase: TurnPhase;
  pendingEvents: GameEvent[];
  currentEventIndex: number;

  // ── Game lifecycle ────────────────────────────────────────────────────────
  newGame: (config: GameConfig, settlementName: string) => void;
  loadGame: (saveData: string) => void;
  saveGame: () => string;

  // ── Turn flow ─────────────────────────────────────────────────────────────
  startTurn: () => void;
  resolveEventChoice: (eventId: string, choiceId: string) => void;
  nextEvent: () => void;
  enterManagementPhase: () => void;
  endTurn: () => void;

  // ── Management phase ──────────────────────────────────────────────────────
  assignRole: (personId: string, role: WorkRole) => void;
  arrangeMarriage: (personAId: string, personBId: string) => void;
  executeTrade: (partnerId: string, offer: TradeOffer) => void;
  sendDiplomaticAction: (tribeId: string, action: DiplomaticAction) => void;
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
    'people' | 'tribes' | 'culture' | 'eventCooldowns'
  > {
  people: [string, SerialPerson][];
  tribes: [string, GameState['tribes'] extends Map<string, infer V> ? V : never][];
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
  };
}

function serializeGameState(state: GameState): string {
  const serial: SerialGameState = {
    ...state,
    people: Array.from(state.people.entries()).map(
      ([id, p]) => [id, serializePerson(p)] as [string, SerialPerson],
    ),
    tribes: Array.from(state.tribes.entries()) as SerialGameState['tribes'],
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
  return {
    ...s,
    people: new Map(s.people.map(([id, p]) => [id, deserializePerson(p)])),
    tribes: new Map(s.tribes),
    culture: {
      ...s.culture,
      languages: new Map(s.culture.languages as [import('../simulation/population/person').LanguageId, number][]),
      religions: new Map(s.culture.religions as [import('../simulation/population/person').ReligionId, number][]),
    },
    eventCooldowns: new Map(s.eventCooldowns),
  };
}

const SAVE_KEY = 'palusteria_save';

// ─── Founding settlers ───────────────────────────────────────────────────────

const FOUNDING_NAMES: Array<{ firstName: string; familyName: string }> = [
  { firstName: 'Edmund',   familyName: 'Farrow'   },
  { firstName: 'Aldric',   familyName: 'Vane'     },
  { firstName: 'Corvin',   familyName: 'Ashby'    },
  { firstName: 'Leofric',  familyName: 'Morrow'   },
  { firstName: 'Hawthorn', familyName: 'Crale'    },
  { firstName: 'Oswyn',    familyName: 'Dunmore'  },
  { firstName: 'Bastian',  familyName: 'Thorn'    },
  { firstName: 'Idris',    familyName: 'Halven'   },
  { firstName: 'Ren',      familyName: 'Coalwick' },
  { firstName: 'Callum',   familyName: 'Marsh'    },
];

/** Initial roles spread across the 10 founding men. */
const FOUNDING_ROLES: WorkRole[] = [
  'farmer', 'farmer', 'farmer', 'farmer', 'farmer',
  'farmer', 'farmer', 'trader', 'trader', 'guard',
];

/** Ages spread across 20–35 to give variety in the roster. */
const FOUNDING_AGES: number[] = [22, 28, 31, 25, 30, 27, 35, 24, 29, 33];

/**
 * Individual physical profiles for each founding settler.
 * All stay within the Imanian genetic range (fair skin, cool/neutral undertone,
 * blonde–dark-brown hair, straight–wavy, blue/grey/green eyes) while giving
 * each man a distinct appearance.
 */
const FOUNDING_GENETICS: Array<Person['genetics']> = [
  // 0 – Edmund Farrow, farmer 22 — pale, fresh-faced, slight build
  { visibleTraits: { skinTone: 0.14, skinUndertone: 'cool_pink', hairColor: 'blonde',      hairTexture: 'straight', eyeColor: 'blue',  buildType: 'lean',     height: 'average',       facialStructure: 'oval'    }, genderRatioModifier: 0.5, extendedFertility: false },
  // 1 – Aldric Vane, farmer 28 — weathered and broad-shouldered
  { visibleTraits: { skinTone: 0.22, skinUndertone: 'neutral',   hairColor: 'dark_brown',  hairTexture: 'wavy',     eyeColor: 'grey',  buildType: 'athletic', height: 'tall',          facialStructure: 'broad'   }, genderRatioModifier: 0.5, extendedFertility: false },
  // 2 – Corvin Ashby, farmer 31 — stocky, blunt-featured
  { visibleTraits: { skinTone: 0.19, skinUndertone: 'cool_pink', hairColor: 'dark_brown',  hairTexture: 'straight', eyeColor: 'blue',  buildType: 'stocky',   height: 'below_average', facialStructure: 'angular' }, genderRatioModifier: 0.5, extendedFertility: false },
  // 3 – Leofric Morrow, farmer 25 — lean, narrow-faced, green-eyed
  { visibleTraits: { skinTone: 0.16, skinUndertone: 'neutral',   hairColor: 'light_brown', hairTexture: 'wavy',     eyeColor: 'green', buildType: 'lean',     height: 'average',       facialStructure: 'narrow'  }, genderRatioModifier: 0.5, extendedFertility: false },
  // 4 – Hawthorn Crale, farmer 30 — tall, grey-eyed, round features
  { visibleTraits: { skinTone: 0.25, skinUndertone: 'neutral',   hairColor: 'dark_brown',  hairTexture: 'straight', eyeColor: 'grey',  buildType: 'athletic', height: 'tall',          facialStructure: 'round'   }, genderRatioModifier: 0.5, extendedFertility: false },
  // 5 – Oswyn Dunmore, farmer 27 — fair and blue-eyed, wavy blonde
  { visibleTraits: { skinTone: 0.13, skinUndertone: 'cool_pink', hairColor: 'blonde',      hairTexture: 'wavy',     eyeColor: 'blue',  buildType: 'lean',     height: 'tall',          facialStructure: 'oval'    }, genderRatioModifier: 0.5, extendedFertility: false },
  // 6 – Bastian Thorn, farmer 35 — the old hand, heavyset and weathered
  { visibleTraits: { skinTone: 0.26, skinUndertone: 'neutral',   hairColor: 'dark_brown',  hairTexture: 'straight', eyeColor: 'grey',  buildType: 'heavyset', height: 'average',       facialStructure: 'broad'   }, genderRatioModifier: 0.5, extendedFertility: false },
  // 7 – Idris Halven, trader 24 — presentable, sharp green eyes
  { visibleTraits: { skinTone: 0.17, skinUndertone: 'cool_pink', hairColor: 'light_brown', hairTexture: 'wavy',     eyeColor: 'green', buildType: 'lean',     height: 'tall',          facialStructure: 'narrow'  }, genderRatioModifier: 0.5, extendedFertility: false },
  // 8 – Ren Coalwick, trader 29 — unremarkable face, watchful grey eyes
  { visibleTraits: { skinTone: 0.21, skinUndertone: 'neutral',   hairColor: 'dark_brown',  hairTexture: 'straight', eyeColor: 'grey',  buildType: 'athletic', height: 'average',       facialStructure: 'angular' }, genderRatioModifier: 0.5, extendedFertility: false },
  // 9 – Callum Marsh, guard 33 — broad, blue-eyed, built to intimidate
  { visibleTraits: { skinTone: 0.23, skinUndertone: 'cool_pink', hairColor: 'dark_brown',  hairTexture: 'straight', eyeColor: 'blue',  buildType: 'stocky',   height: 'tall',          facialStructure: 'broad'   }, genderRatioModifier: 0.5, extendedFertility: false },
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

function createInitialState(config: GameConfig, settlementName: string): GameState {
  const people = new Map<string, Person>();

  FOUNDING_NAMES.forEach((name, i) => {
    const role = FOUNDING_ROLES[i];
    // Traders arrive with a working knowledge of Tradetalk — it would be
    // absurd to seek trade contacts without any common tongue.
    const languages: Person['languages'] = role === 'trader'
      ? [{ language: 'imanian', fluency: 1.0 }, { language: 'tradetalk', fluency: 0.4 }]
      : [{ language: 'imanian', fluency: 1.0 }];

    const person = createPerson({
      firstName: name.firstName,
      familyName: name.familyName,
      sex: 'male',
      age: FOUNDING_AGES[i],
      role,
      socialStatus: 'founding_member',
      languages,
      genetics: FOUNDING_GENETICS[i],
    });
    people.set(person.id, person);
  });

  // Optional founding Sauromatian women (enable via GameConfig.includeSauromatianWomen).
  if (config.includeSauromatianWomen) {
    // Determine ethnic group from the first selected tribe, or fall back.
    const firstPresetId = config.startingTribes[0];
    const firstPreset = firstPresetId ? TRIBE_PRESETS[firstPresetId] : undefined;
    const sauroGroup = firstPreset?.ethnicGroup ?? 'kiswani_riverfolk';
    const sauroTraitDist = ETHNIC_DISTRIBUTIONS[sauroGroup];

    const SAURO_FOUNDING_WOMEN: Array<{ firstName: string; familyName: string; age: number }> = [
      { firstName: 'Amara',  familyName: 'Mwamba', age: 18 },
      { firstName: 'Safiya', familyName: 'Nyota',  age: 22 },
      { firstName: 'Eshe',   familyName: 'Tembo',  age: 26 },
    ];

    for (const w of SAURO_FOUNDING_WOMEN) {
      const woman = createPerson({
        firstName: w.firstName,
        familyName: w.familyName,
        sex: 'female',
        age: w.age,
        role: 'unassigned',
        socialStatus: 'newcomer',
        genetics: {
          visibleTraits: {
            skinTone: sauroTraitDist.skinTone.mean,
            skinUndertone: (Object.entries(sauroTraitDist.skinUndertone.weights)
              .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0]?.[0] ?? 'warm') as Person['genetics']['visibleTraits']['skinUndertone'],
            hairColor: (Object.entries(sauroTraitDist.hairColor.weights)
              .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0]?.[0] ?? 'black') as Person['genetics']['visibleTraits']['hairColor'],
            hairTexture: (Object.entries(sauroTraitDist.hairTexture.weights)
              .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0]?.[0] ?? 'coily') as Person['genetics']['visibleTraits']['hairTexture'],
            eyeColor: (Object.entries(sauroTraitDist.eyeColor.weights)
              .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0]?.[0] ?? 'brown') as Person['genetics']['visibleTraits']['eyeColor'],
            buildType: (Object.entries(sauroTraitDist.buildType.weights)
              .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0]?.[0] ?? 'athletic') as Person['genetics']['visibleTraits']['buildType'],
            height: (Object.entries(sauroTraitDist.height.weights)
              .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0]?.[0] ?? 'average') as Person['genetics']['visibleTraits']['height'],
            facialStructure: (Object.entries(sauroTraitDist.facialStructure.weights)
              .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0]?.[0] ?? 'oval') as Person['genetics']['visibleTraits']['facialStructure'],
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
      });
      people.set(woman.id, woman);
    }
  }

  const initialResources: ResourceStock = {
    ...emptyResourceStock(),
    food: 20,
    gold: 50,
    goods: 5,
    cattle: 5,
  };

  const settlement: Settlement = {
    name: settlementName,
    location: config.startingLocation,
    buildings: [],
    resources: initialResources,
    populationCount: people.size,
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
  };

  const company: CompanyRelation = {
    standing: 60,
    annualQuotaGold: 20,
    annualQuotaTradeGoods: 5,
    consecutiveFailures: 0,
    supportLevel: 'standard',
    yearsActive: 0,
  };

  // Instantiate tribes from selected presets.
  const tribes = new Map<string, ReturnType<typeof createTribe>>();
  for (const presetId of config.startingTribes) {
    const preset = TRIBE_PRESETS[presetId];
    if (preset) {
      const tribe = createTribe(preset);
      tribes.set(tribe.id, tribe);
    }
  }

  return {
    version: '1.0.0',
    seed: Math.floor(Math.random() * 2 ** 31),
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
    config,
  };
}

// ─── Store implementation ────────────────────────────────────────────────────

export const useGameStore = create<GameStore>((set, get) => {
  // Attempt to restore an existing save on first load.
  let initialState: GameState | null = null;
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
        settlement: {
          ...gameState.settlement,
          populationCount: dawnResult.populationCount,
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
        },
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

      // Draw 1–3 events from the eligible pool.
      const eligible  = filterEligibleEvents(ALL_EVENTS, postDawnState);
      const drawCount = 1 + rng.nextInt(0, 2);
      const drawn     = drawEvents(eligible, drawCount, rng);

      set({
        gameState: postDawnState,
        currentPhase: drawn.length > 0 ? 'event' : 'management',
        pendingEvents: drawn,
        currentEventIndex: 0,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        _pendingProduction: dawnResult.production as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        _pendingConsumption: dawnResult.consumption as any,
      } as Partial<GameStore>);
    },

    resolveEventChoice(eventId, choiceId) {
      const { gameState, pendingEvents } = get();
      if (!gameState) return;

      const event = pendingEvents.find(e => e.id === eventId);
      if (!event) return;

      const updatedState = applyEventChoice(event, choiceId, gameState);
      set({ gameState: updatedState });
    },

    nextEvent() {
      const { currentEventIndex, pendingEvents } = get();
      if (currentEventIndex < pendingEvents.length - 1) {
        set({ currentEventIndex: currentEventIndex + 1 });
      } else {
        // All events resolved — clear queue and enter management phase.
        set({ currentPhase: 'management', pendingEvents: [], currentEventIndex: 0 });
      }
    },

    enterManagementPhase() {
      set({ currentPhase: 'management' });
    },

    endTurn() {
      const store = get() as GameStore & {
        _pendingProduction?: ResourceStock;
        _pendingConsumption?: ResourceStock;
      };
      const { gameState } = store;
      if (!gameState) return;

      const production = store._pendingProduction ?? emptyResourceStock();
      const consumption = store._pendingConsumption ?? emptyResourceStock();

      // Apply resource deltas: production + consumption (consumption is already negative).
      const rawResources = addResourceStocks(
        addResourceStocks(gameState.settlement.resources, production),
        consumption,
      );
      const updatedResources = clampResourceStock(rawResources);

      const duskResult = processDusk(gameState, gameState.currentSeason);

      const updatedState: GameState = {
        ...gameState,
        currentSeason: duskResult.nextSeason,
        currentYear: duskResult.nextYear,
        turnNumber: gameState.turnNumber + 1,
        settlement: {
          ...gameState.settlement,
          resources: updatedResources,
        },
      };

      const json = serializeGameState(updatedState);
      localStorage.setItem(SAVE_KEY, json);

      set({
        gameState: updatedState,
        currentPhase: 'idle',
        _pendingProduction: undefined,
        _pendingConsumption: undefined,
      } as Partial<GameStore>);
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

      const updatedState: GameState = {
        ...gameState,
        people: updatedPeople,
        eventHistory: [...gameState.eventHistory, result.eventRecord],
      };

      const json = serializeGameState(updatedState);
      localStorage.setItem(SAVE_KEY, json);
      set({ gameState: updatedState });
    },

    executeTrade(_partnerId, _offer) {
      // Phase 3: trade execution logic.
    },

    sendDiplomaticAction(_tribeId, _action) {
      // Phase 3: diplomacy logic.
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
