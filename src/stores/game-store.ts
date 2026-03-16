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
import { processDawn, processDusk } from '../simulation/turn/turn-processor';
import type { DawnResult } from '../simulation/turn/turn-processor';
import { createInitialState } from '../simulation/turn/initial-state';
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
import { canMarry, performMarriage, formConcubineRelationship } from '../simulation/population/marriage';
import type { InformalUnionStyle } from '../simulation/population/marriage';
import { applyMarriageOpinionFloor } from '../simulation/population/opinions';
import {
  canBuild,
  startConstruction as buildingStartConstruction,
  assignBuilder as buildingAssignBuilder,
  removeBuilder as buildingRemoveBuilder,
  cancelConstruction,
  applyDwellingClaims,
  findAvailableWorkerSlotIndex,
} from '../simulation/buildings/construction';
import { hasBuilding } from '../simulation/buildings/building-effects';
import type {
  GameState,
  TurnPhase,
  ResourceStock,
  SettlementCulture,
  CompanyRelation,
  GameConfig,
  BuildingId,
  BuildingStyle,
  ReligiousPolicy,
  ActivityLogEntry,
} from '../simulation/turn/game-state';
import type { Person, WorkRole } from '../simulation/population/person';
import { SAUROMATIAN_CULTURE_IDS } from '../simulation/population/culture';
import type { SkillCheckResult } from '../simulation/events/engine';
import type { BoundEvent } from '../simulation/events/engine';
import { resolveActors } from '../simulation/events/actor-resolver';
import type { DebugSettings } from '../simulation/turn/game-state';

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
  /**
   * Set when the player activates 'hidden_wheel_recognized' policy while
   * courtshipNorms is 'traditional' — surfaces a UI nudge in SettlementView.
   */
  pendingCourtshipNudge: boolean;
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
  /** Update the settlement's courtship norms. */
  setCourtshipNorms: (norms: 'traditional' | 'mixed' | 'open') => void;
  /** Dismiss the courtship-norms nudge banner. */
  dismissCourtshipNudge: () => void;
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
  /** Update one or more debug settings fields. Persists to localStorage. */
  updateDebugSettings: (partial: Partial<DebugSettings>) => void;
}

// ─── Serialisation helpers ───────────────────────────────────────────────────
// Imported from ./serialization so they can be tested without loading this store
// (which touches localStorage via the persist middleware).
import { serializeGameState, deserializeGameState } from './serialization';

const SAVE_KEY = 'palusteria_save';

// ─── Pre-store helpers ────────────────────────────────────────────────────────

/**
 * Collects all activity log entries produced this dawn into a new log array,
 * applying the rolling 30-entry FIFO cap.
 */
function buildActivityLog(
  existing: ActivityLogEntry[],
  turn: number,
  dawnResult: DawnResult,
): ActivityLogEntry[] {
  const relEntries = dawnResult.newRelationshipEntries.map(e => ({
    turn, type: e.type, personId: e.personId, targetId: e.targetId, description: e.description,
  }));
  const schemeEntries = dawnResult.newSchemeEntries.map(e => ({
    turn, type: e.type, personId: e.personId, targetId: e.targetId, description: e.description,
  }));
  const factionEntries = dawnResult.newFactionEntries.map(e => ({
    turn, type: e.type, description: e.description,
  }));
  const ambitionEntries = dawnResult.newAmbitionEntries.map(e => ({
    turn, type: e.type, personId: e.personId, description: e.description,
  }));
  const roleEntries = dawnResult.idleRoleAssignments.map(({ personId, role }) => {
    const p = dawnResult.updatedPeople.get(personId);
    const name = p ? p.firstName : '(unknown)';
    return {
      turn,
      type: 'role_self_assigned' as const,
      personId,
      description: `**${name}** took on the role of ${role.replace(/_/g, ' ')}.`,
    };
  });
  const traitEntries = dawnResult.traitChanges
    .filter(tc => tc.gained)
    .map(tc => {
      const p = dawnResult.updatedPeople.get(tc.personId);
      const name = p ? p.firstName : '(unknown)';
      return {
        turn,
        type: 'trait_acquired' as const,
        personId: tc.personId,
        description: `**${name}** gained the trait: ${tc.gained!.replace(/_/g, ' ')}.`,
      };
    });
  const successionEntries = dawnResult.successionLogEntries.map(e => ({
    turn, type: e.type, personId: e.personId, targetId: e.targetId, description: e.description,
  }));
  return [
    ...existing,
    ...relEntries, ...schemeEntries, ...factionEntries, ...ambitionEntries,
    ...roleEntries, ...traitEntries, ...successionEntries,
  ].slice(-30);
}

/**
 * Merges a `DawnResult` into the previous `GameState`, returning the updated
 * post-dawn state. Pure: does not mutate either argument.
 */
function applyDawnResultToState(state: GameState, dawnResult: DawnResult): GameState {
  const shouldFireDesertion =
    dawnResult.desertionCandidateIds.length >= 3 &&
    !(state.massDesertionWarningFired ?? false);

  // Pre-compute the full building list (additions and removals from this dawn).
  let allBuildings = [...state.settlement.buildings];
  for (const removedId of dawnResult.removedBuildingIds) {
    allBuildings = allBuildings.filter(b => b.defId !== removedId);
  }
  allBuildings = [...allBuildings, ...dawnResult.completedBuildings];

  // Merge household updates (changes, new, dissolved).
  const households = new Map(state.households);
  for (const [id, h] of dawnResult.updatedHouseholds) households.set(id, h);
  for (const [id, h] of dawnResult.newHouseholds) households.set(id, h);
  for (const id of dawnResult.dissolvedHouseholdIds) households.delete(id);

  // Assign completed dwellings to households that don't have one.
  const {
    buildings: claimedBuildings,
    households: claimedHouseholds,
    people,
  } = applyDwellingClaims(
    dawnResult.completedBuildings,
    allBuildings,
    households,
    dawnResult.updatedPeople,
  );

  const turn = state.turnNumber;

  return {
    ...state,
    people,
    graveyard: [...state.graveyard, ...dawnResult.newGraveyardEntries],
    households: claimedHouseholds,
    settlement: {
      ...state.settlement,
      populationCount: dawnResult.populationCount,
      buildings: claimedBuildings,
      constructionQueue: dawnResult.updatedConstructionQueue,
    },
    culture: {
      ...state.culture,
      languages: dawnResult.updatedLanguageFractions,
      primaryLanguage:
        Array.from(dawnResult.updatedLanguageFractions.entries()).sort(
          (a, b) => b[1] - a[1],
        )[0]?.[0] ?? state.culture.primaryLanguage,
      languageTension: dawnResult.newLanguageTension,
      languageDiversityTurns: dawnResult.newLanguageDiversityTurns,
      culturalBlend: dawnResult.updatedCultureBlend,
      religions: dawnResult.updatedReligions,
      religiousTension: dawnResult.updatedReligiousTension,
      hiddenWheelDivergenceTurns: dawnResult.updatedHiddenWheelDivergenceTurns,
      hiddenWheelSuppressedTurns: dawnResult.updatedHiddenWheelSuppressedTurns,
      // hiddenWheelEmerged is managed by event resolution, not by dawn processing.
      hiddenWheelEmerged: state.culture.hiddenWheelEmerged,
    },
    identityPressure: dawnResult.identityPressureResult.updatedPressure,
    company: {
      ...state.company,
      standing: Math.max(
        0,
        Math.min(
          100,
          state.company.standing + dawnResult.identityPressureResult.companyStandingDelta,
        ),
      ),
    },
    tribes: (() => {
      const deltas = dawnResult.identityPressureResult.tribeDispositionDeltas;
      if (deltas.length === 0) return state.tribes;
      const updatedTribes = new Map(state.tribes);
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
    eventHistory: [
      ...state.eventHistory,
      ...dawnResult.births.map(b => ({
        eventId: 'birth',
        turnNumber: turn,
        choiceId: 'born',
        involvedPersonIds: [b.childId, b.motherId],
      })),
    ],
    activityLog: buildActivityLog(state.activityLog, turn, dawnResult),
    factions: dawnResult.updatedFactions,
    lastSettlementMorale: dawnResult.settlementMorale,
    lowMoraleTurns: dawnResult.newLowMoraleTurns,
    massDesertionWarningFired: shouldFireDesertion
      ? true
      : dawnResult.newLowMoraleTurns === 0
        ? false
        : (state.massDesertionWarningFired ?? false),
  };
}

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
    pendingCourtshipNudge: false,

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
      // Compute whether the mass-desertion warning should fire this turn before building postDawnState.
      const shouldFireDesertion =
        dawnResult.desertionCandidateIds.length >= 3 &&
        !(gameState.massDesertionWarningFired ?? false);

      const postDawnState: GameState = applyDawnResultToState(gameState, dawnResult);

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
      // Apply per-category boosts derived from the settlement's trait composition
      if (dawnResult.traitCategoryBoosts) {
        for (const event of eligible) {
          const boost = dawnResult.traitCategoryBoosts[event.category as keyof typeof dawnResult.traitCategoryBoosts];
          if (boost !== undefined) {
            weightBoosts[event.id] = (weightBoosts[event.id] ?? 1) * boost;
          }
        }
      }
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

      // Inject scheme events generated this dawn (climaxes + intermediate notifications).
      const schemeBoundEvents: BoundEvent[] = dawnResult.pendingSchemeEvents
        .map(({ eventId, personId, targetId }) => {
          const ev = getEventById(eventId);
          if (!ev) return null;
          // Pre-bind the first two actor slots to schemer/target using the event's slot names.
          const actorSlots = ev.actorRequirements ?? [];
          const boundActors: Record<string, string> = {};
          if (actorSlots[0]) boundActors[actorSlots[0].slot] = personId;
          if (actorSlots[1]) boundActors[actorSlots[1].slot] = targetId;
          return { ...ev, boundActors } as BoundEvent;
        })
        .filter((e): e is BoundEvent => e !== null);

      // Inject faction demand/standoff events generated this dawn.
      const factionBoundEvents: BoundEvent[] = dawnResult.pendingFactionEvents
        .map(({ eventId }) => {
          const ev = getEventById(eventId);
          if (!ev) return null;
          // Bind the spokesperson slot to the highest-leadership faction member.
          const actorSlots = ev.actorRequirements ?? [];
          if (actorSlots.length === 0) return { ...ev, boundActors: {} } as BoundEvent;
          const actors = resolveActors(actorSlots, stateAfterDrain, rng);
          return { ...ev, boundActors: actors ?? {} } as BoundEvent;
        })
        .filter((e): e is BoundEvent => e !== null);

      // Inject happiness crisis events.
      const happinessBoundEvents: BoundEvent[] = [];

      // Individual desertion — fire once when lowHappinessTurns first hits 3.
      for (const candidateId of dawnResult.desertionCandidateIds) {
        const candidate = stateAfterDrain.people.get(candidateId);
        if (!candidate) continue;
        if (candidate.lowHappinessTurns !== 3) continue; // only on the turn they cross the threshold
        const ev = getEventById('hap_settler_considers_leaving');
        if (!ev) continue;
        happinessBoundEvents.push({ ...ev, boundActors: { settler: candidateId } } as BoundEvent);
      }

      // Settlement morale warning — fires when lowMoraleTurns first reaches 4.
      if (dawnResult.newLowMoraleTurns === 4) {
        const ev = getEventById('hap_low_morale_warning');
        if (ev) happinessBoundEvents.push({ ...ev, boundActors: {} } as BoundEvent);
      }

      // Mass desertion warning — fires once per crisis episode (gated by massDesertionWarningFired).
      if (shouldFireDesertion) {
        const ev = getEventById('hap_desertion_imminent');
        if (ev) {
          const actorSlots = ev.actorRequirements ?? [];
          const actors = actorSlots.length > 0 ? resolveActors(actorSlots, stateAfterDrain, rng) : {};
          happinessBoundEvents.push({ ...ev, boundActors: actors ?? {} } as BoundEvent);
        }
      }

      // Company happiness inquiry — fires when lowMoraleTurns first reaches 8.
      if (dawnResult.newLowMoraleTurns === 8) {
        const ev = getEventById('hap_company_happiness_inquiry');
        if (ev) happinessBoundEvents.push({ ...ev, boundActors: {} } as BoundEvent);
      }

      // Inject Sauromatian succession council events (one per household needing a player decision).
      const successionBoundEvents: BoundEvent[] = dawnResult.pendingSauromatianCouncilEventHouseholdIds
        .map(() => {
          const ev = getEventById('hh_succession_council');
          return ev ? ({ ...ev, boundActors: {} } as BoundEvent) : null;
        })
        .filter((e): e is BoundEvent => e !== null);

      // Inject rel_child_outside_marriage for unwed Sauromatian mothers who just gave birth.
      const childBirthBoundEvents: BoundEvent[] = (dawnResult.newBirths ?? [])
        .filter(birth => {
          const mother = stateAfterDrain.people.get(birth.motherId);
          return (
            mother !== undefined &&
            mother.spouseIds.length === 0 &&
            SAUROMATIAN_CULTURE_IDS.has(mother.heritage.primaryCulture)
          );
        })
        .map(birth => {
          const ev = getEventById('rel_child_outside_marriage');
          if (!ev) return null;
          const boundActors: Record<string, string> = { mother: birth.motherId };
          if (birth.fatherId) boundActors['father'] = birth.fatherId;
          return { ...ev, boundActors } as BoundEvent;
        })
        .filter((e): e is BoundEvent => e !== null);

      // Deferred events are prepended so they resolve before new draws.
      const allPending: BoundEvent[] = [...deferredBoundEvents, ...schemeBoundEvents, ...factionBoundEvents, ...happinessBoundEvents, ...successionBoundEvents, ...childBirthBoundEvents, ...boundDrawn];

      // One-time creole emergence notification.
      const showCreoleNotification =
        dawnResult.creoleEmerged && !gameState.flags.creoleEmergedNotified;
      const stateWithFlags: GameState = showCreoleNotification
        ? { ...stateAfterDrain, flags: { ...stateAfterDrain.flags, creoleEmergedNotified: true } }
        : stateAfterDrain;

      _pendingProduction = dawnResult.production;
      _pendingConsumption = dawnResult.consumption;
      _pendingSpoilage = dawnResult.spoilageThisTurn;
      const skipEvents = stateWithFlags.debugSettings?.skipEvents ?? false;
      const effectivePending = skipEvents ? [] : allPending;
      set({
        gameState: stateWithFlags,
        currentPhase: effectivePending.length > 0 ? 'event' : 'management',
        pendingEvents: effectivePending,
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

      if (!_pendingProduction || !_pendingConsumption) {
        console.error('[Palusteria] endTurn() called without a preceding startTurn() — production and consumption will be zero.');
      }
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

      // Remove person from any building slot they currently occupy
      let updatedBuildings = gameState.settlement.buildings.map(b => {
        const workers = b.assignedWorkerIds ?? [];
        return workers.includes(personId)
          ? { ...b, assignedWorkerIds: workers.filter(id => id !== personId) }
          : b.assignedWorkerIds === workers ? b : { ...b, assignedWorkerIds: workers };
      });

      // If the new role maps to a building workerRole, slot them into an available building
      const matchIdx = findAvailableWorkerSlotIndex(updatedBuildings, role);
      if (matchIdx >= 0) {
        updatedBuildings = updatedBuildings.map((bld, i) =>
          i === matchIdx
            ? { ...bld, assignedWorkerIds: [...(bld.assignedWorkerIds ?? []), personId] }
            : bld
        );
      }

      updatedPeople.set(personId, { ...person, role, roleAssignedTurn: gameState.turnNumber });
      set({
        gameState: {
          ...gameState,
          people: updatedPeople,
          settlement: { ...gameState.settlement, buildings: updatedBuildings },
        },
      });
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

      // Apply household changes (merge + optional dissolution).
      const updatedHouseholds = new Map(gameState.households);
      updatedHouseholds.set(result.household.id, result.household);
      if (result.dissolvedHouseholdId) {
        updatedHouseholds.delete(result.dissolvedHouseholdId);
      }

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
      updatedPeople.set(personId, { ...person, role: 'keth_thara', roleAssignedTurn: gameState.turnNumber });

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
      const shouldNudge =
        policy === 'hidden_wheel_recognized' &&
        (gameState.settlement.courtshipNorms ?? 'mixed') === 'traditional';
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
      set({ gameState: updatedState, ...(shouldNudge && { pendingCourtshipNudge: true }) });
    },

    setCourtshipNorms(norms) {
      const { gameState } = get();
      if (!gameState) return;
      const updatedState: GameState = {
        ...gameState,
        settlement: { ...gameState.settlement, courtshipNorms: norms },
      };
      const json = serializeGameState(updatedState);
      localStorage.setItem(SAVE_KEY, json);
      set({ gameState: updatedState });
    },

    dismissCourtshipNudge() {
      set({ pendingCourtshipNudge: false });
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
      updatedPeople.set(personId, { ...person, role: 'builder', roleAssignedTurn: gameState.turnNumber });
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
      updatedPeople.set(personId, { ...person, role: 'unassigned', roleAssignedTurn: gameState.turnNumber });
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
      const updatedResources = addResourceStocks(gameState.settlement.resources, { ...emptyResourceStock(), ...refund });
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

    updateDebugSettings(partial) {
      const { gameState } = get();
      if (!gameState) return;
      const updated: GameState = {
        ...gameState,
        debugSettings: { ...gameState.debugSettings, ...partial },
      };
      set({ gameState: updated });
      localStorage.setItem(SAVE_KEY, serializeGameState(updated));
    },
  };
});
