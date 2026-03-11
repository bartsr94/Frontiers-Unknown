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
  arrangeMarriage: (personIds: string[]) => void;
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
    const person = createPerson({
      firstName: name.firstName,
      familyName: name.familyName,
      sex: 'male',
      age: FOUNDING_AGES[i],
      role: FOUNDING_ROLES[i],
      socialStatus: 'founding_member',
    });
    people.set(person.id, person);
  });

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
  };

  const company: CompanyRelation = {
    standing: 60,
    annualQuotaGold: 20,
    annualQuotaTradeGoods: 5,
    consecutiveFailures: 0,
    supportLevel: 'standard',
    yearsActive: 0,
  };

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
    tribes: new Map(),
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
        settlement: {
          ...gameState.settlement,
          populationCount: dawnResult.populationCount,
        },
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

    arrangeMarriage(_personIds) {
      // Phase 2: marriage matching logic.
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
