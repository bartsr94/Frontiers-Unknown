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
import { processDawn, processDusk, toGraveyardEntry } from '../simulation/turn/turn-processor';
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
import { clamp } from '../utils/math';
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
import { hasBuilding, computeStorageCaps } from '../simulation/buildings/building-effects';
import { BUILDING_CATALOG } from '../simulation/buildings/building-definitions';
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
  GraveyardEntry,
  EmissarySessionAction,
  EmissaryDispatch,
} from '../simulation/turn/game-state';
import type { Person, WorkRole } from '../simulation/population/person';
import { SAUROMATIAN_CULTURE_IDS } from '../simulation/population/culture';
import type { SkillCheckResult } from '../simulation/events/engine';
import type { BoundEvent } from '../simulation/events/engine';
import { resolveActors } from '../simulation/events/actor-resolver';
import type { DebugSettings } from '../simulation/turn/game-state';
import { createExpedition, processExpeditions, discoverTribesFromExpedition } from '../simulation/world/expeditions';
import type { DispatchExpeditionParams, ExpeditionProcessResult } from '../simulation/world/expeditions';
import {
  createEmissaryDispatch,
  emissaryTravelTime,
  resolveEmissarySession as resolveEmissarySessionLogic,
} from '../simulation/world/emissaries';
import type { DispatchEmissaryParams } from '../simulation/world/emissaries';
export type { DispatchEmissaryParams };

// Re-export economy types consumed by UI components.
export type { TradeOffer };

// ─── Event assembly helper ────────────────────────────────────────────────────

/**
 * Assembles all programmatically-injected BoundEvents for the current turn.
 *
 * Covers: deferred events (including Hidden Wheel emergence at the front),
 * scheme climaxes, faction demands, happiness crises, succession decisions,
 * unwed-birth events, apprenticeship lifecycle, and expedition events.
 *
 * The caller appends randomly-drawn events after the returned slice.
 */
function buildInjectedEvents(
  dawnResult: DawnResult,
  expeditionResult: ExpeditionProcessResult,
  state: GameState,
  rng: ReturnType<typeof createRNG>,
  deferredBoundEvents: BoundEvent[],
  shouldFireDesertion: boolean,
): BoundEvent[] {
  // Deferred events come first; Hidden Wheel emergence is prepended to this slice.
  const leading: BoundEvent[] = [...deferredBoundEvents];
  if (dawnResult.shouldFireHiddenWheelEvent) {
    const ev = getEventById('rel_hidden_wheel_emerges');
    if (ev) leading.unshift({ ...ev, boundActors: {} } as BoundEvent);
  }

  // Scheme climax / notification events.
  const schemeBoundEvents: BoundEvent[] = dawnResult.pendingSchemeEvents
    .map(({ eventId, personId, targetId }) => {
      const ev = getEventById(eventId);
      if (!ev) return null;
      const actorSlots = ev.actorRequirements ?? [];
      const boundActors: Record<string, string> = {};
      if (actorSlots[0]) boundActors[actorSlots[0].slot] = personId;
      if (actorSlots[1]) boundActors[actorSlots[1].slot] = targetId;
      return { ...ev, boundActors } as BoundEvent;
    })
    .filter((e): e is BoundEvent => e !== null);

  // Faction demand / standoff events.
  const factionBoundEvents: BoundEvent[] = dawnResult.pendingFactionEvents
    .map(({ eventId }) => {
      const ev = getEventById(eventId);
      if (!ev) return null;
      const actorSlots = ev.actorRequirements ?? [];
      if (actorSlots.length === 0) return { ...ev, boundActors: {} } as BoundEvent;
      const actors = resolveActors(actorSlots, state, rng);
      return { ...ev, boundActors: actors ?? {} } as BoundEvent;
    })
    .filter((e): e is BoundEvent => e !== null);

  // Happiness crisis events.
  const happinessBoundEvents: BoundEvent[] = [];
  for (const candidateId of dawnResult.desertionCandidateIds) {
    const candidate = state.people.get(candidateId);
    if (!candidate || candidate.lowHappinessTurns !== 3) continue;
    const ev = getEventById('hap_settler_considers_leaving');
    if (!ev) continue;
    happinessBoundEvents.push({ ...ev, boundActors: { settler: candidateId } } as BoundEvent);
  }
  if (dawnResult.newLowMoraleTurns === 4) {
    const ev = getEventById('hap_low_morale_warning');
    if (ev) happinessBoundEvents.push({ ...ev, boundActors: {} } as BoundEvent);
  }
  if (shouldFireDesertion) {
    const ev = getEventById('hap_desertion_imminent');
    if (ev) {
      const actorSlots = ev.actorRequirements ?? [];
      const actors = actorSlots.length > 0 ? resolveActors(actorSlots, state, rng) : {};
      happinessBoundEvents.push({ ...ev, boundActors: actors ?? {} } as BoundEvent);
    }
  }
  if (dawnResult.newLowMoraleTurns === 8) {
    const ev = getEventById('hap_company_happiness_inquiry');
    if (ev) happinessBoundEvents.push({ ...ev, boundActors: {} } as BoundEvent);
  }
  if (dawnResult.shouldFireFundingEndsEvent) {
    const ev = getEventById('eco_company_funding_ends');
    if (ev) happinessBoundEvents.push({ ...ev, boundActors: {} } as BoundEvent);
  }
  if (dawnResult.shouldFireAnnualExportEvent) {
    const ev = getEventById('co_annual_export');
    if (ev) happinessBoundEvents.push({ ...ev, boundActors: {} } as BoundEvent);
  }
  if (dawnResult.newFamineStreak === 1) {
    const ev = getEventById('fam_hunger_grips_settlement');
    if (ev) happinessBoundEvents.push({ ...ev, boundActors: {} } as BoundEvent);
  } else if (dawnResult.newFamineStreak === 2) {
    const ev = getEventById('fam_families_consider_leaving');
    if (ev) happinessBoundEvents.push({ ...ev, boundActors: {} } as BoundEvent);
  } else if (dawnResult.newFamineStreak >= 3) {
    const ev = getEventById('fam_famine_deepens');
    if (ev) happinessBoundEvents.push({ ...ev, boundActors: {} } as BoundEvent);
  }

  // Sauromatian succession council decisions.
  const successionBoundEvents: BoundEvent[] = dawnResult.pendingSauromatianCouncilEventHouseholdIds
    .map(() => {
      const ev = getEventById('hh_succession_council');
      return ev ? ({ ...ev, boundActors: {} } as BoundEvent) : null;
    })
    .filter((e): e is BoundEvent => e !== null);

  // Unwed-birth events for Sauromatian mothers.
  const childBirthBoundEvents: BoundEvent[] = (dawnResult.newBirths ?? [])
    .filter(birth => {
      const mother = state.people.get(birth.motherId);
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

  // Apprenticeship formation + graduation events.
  const apprenticeshipBoundEvents: BoundEvent[] = (dawnResult.pendingApprenticeshipEvents ?? [])
    .map(({ eventId, masterId, apprenticeId }) => {
      const ev = getEventById(eventId);
      if (!ev) return null;
      const actorSlots = ev.actorRequirements ?? [];
      const boundActors: Record<string, string> = {};
      if (actorSlots[0]) boundActors[actorSlots[0].slot] = masterId;
      if (actorSlots[1]) boundActors[actorSlots[1].slot] = apprenticeId;
      return { ...ev, boundActors } as BoundEvent;
    })
    .filter((e): e is BoundEvent => e !== null);

  // Expedition events (hex discoveries, encounters, return report).
  const expeditionBoundEvents: BoundEvent[] = (expeditionResult.pendingEventArgs ?? [])
    .map(({ eventId, boundActors }) => {
      const ev = getEventById(eventId);
      if (!ev) return null;
      return { ...ev, boundActors } as BoundEvent;
    })
    .filter((e): e is BoundEvent => e !== null);

  return [
    ...leading,
    ...schemeBoundEvents,
    ...factionBoundEvents,
    ...happinessBoundEvents,
    ...successionBoundEvents,
    ...childBirthBoundEvents,
    ...apprenticeshipBoundEvents,
    ...expeditionBoundEvents,
  ];
}

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
  /** Contribute wealth toward the Company's annual quota. */
  contributeToQuota: (wealth: number) => void;
  /** @deprecated The goods→gold export conversion has been replaced by the unified wealth system. Internal use only. */
  exportGoodsToCompany: (amount: number) => void;
  /** Update per-resource reserve floors. Surplus = stock − floor; household purchases blocked if any required material is below its floor. */
  setEconomyReserves: (reserves: Partial<ResourceStock>) => void;
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
  /**
   * Queue a construction project for a specific household.
   * For household buildings, `ownerHouseholdId` is pre-set so `applyDwellingClaims`
   * claims it immediately on completion without the Pass-2 lottery.
   * Pass `householdId: null` to build communally (same as `startConstruction`).
   */
  buildForHousehold: (householdId: string | null, defId: BuildingId, style: BuildingStyle | null) => void;
  /** Remove a standing household building; clears the slot and person claims. */
  demolishHouseholdBuilding: (householdId: string, slotIndex: number) => void;
  /** Start construction of the next tier in the building's upgrade chain. */
  upgradeHouseholdBuilding: (householdId: string, slotIndex: number) => void;
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
  // ── Expeditions ────────────────────────────────────────────────────────────
  /**
   * Dispatches a new expedition from the settlement.
   * Deducts provisions from settlement resources, sets all party members to
   * `role='away'`, and adds the expedition to `state.expeditions`.
   * If `params.hasBoat` is true, decrements `state.boatsInPort` by 1.
   */
  dispatchExpedition: (params: DispatchExpeditionParams) => void;
  /**
   * Orders a travelling expedition to begin returning immediately (status → 'returning').
   * No-op if the expedition is already completed/lost.
   */
  recallExpedition: (expeditionId: string) => void;
  // ── Emissaries ─────────────────────────────────────────────────────────
  /**
   * Dispatches an emissary to a known tribe.
   * Deducts packed gifts from settlement resources, sets emissary role to 'away'.
   */
  dispatchEmissary: (params: DispatchEmissaryParams) => void;
  /**
   * Resolves a completed diplomacy session:
   * applies disposition changes, grants resources, sets diplomacyOpened, sends emissary home.
   */
  resolveEmissarySession: (emissaryId: string, actions: EmissarySessionAction[]) => void;
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
/**
 * Stamps `turn` onto a batch of partial log entries produced by dawn helpers.
 * All dawn sub-systems return entries without a `turn` field; this helper adds it
 * in a single pass so callers avoid repeating the same `.map(e => ({ turn, ...e }))`.
 */
function stampEntries(
  turn: number,
  entries: Array<Omit<ActivityLogEntry, 'turn'>>,
): ActivityLogEntry[] {
  return entries.map(e => ({ turn, ...e }));
}

function buildActivityLog(
  existing: ActivityLogEntry[],
  turn: number,
  dawnResult: DawnResult,
): ActivityLogEntry[] {
  // roleEntries and traitEntries need name lookups, so they are built explicitly.
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

  return [
    ...existing,
    ...stampEntries(turn, dawnResult.newRelationshipEntries),
    ...stampEntries(turn, dawnResult.newSchemeEntries),
    ...stampEntries(turn, dawnResult.newFactionEntries),
    ...stampEntries(turn, dawnResult.newAmbitionEntries),
    ...stampEntries(turn, dawnResult.newAutonomousMarriageEntries ?? []),
    ...roleEntries,
    ...traitEntries,
    ...stampEntries(turn, dawnResult.successionLogEntries),
    ...stampEntries(turn, dawnResult.newApprenticeshipEntries ?? []),
    ...stampEntries(turn, dawnResult.privateBuildLogEntries ?? []),
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
  // Apply neglected flags from building maintenance pass.
  if (dawnResult.neglectedBuildingIds && dawnResult.neglectedBuildingIds.length > 0) {
    const neglectedSet = new Set(dawnResult.neglectedBuildingIds);
    allBuildings = allBuildings.map(b => {
      if (neglectedSet.has(b.instanceId)) return b.neglected ? b : { ...b, neglected: true };
      return b.neglected ? { ...b, neglected: false } : b;
    });
  }

  // Merge household updates (changes, new, dissolved).
  const households = new Map(state.households);
  for (const [id, h] of dawnResult.updatedHouseholds) households.set(id, h);
  for (const [id, h] of dawnResult.newHouseholds) households.set(id, h);
  for (const id of dawnResult.dissolvedHouseholdIds) households.delete(id);

  // Wealth generation is handled inside processDawn (household deltas applied in-line).

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
  const deadIds = new Set(dawnResult.newGraveyardEntries.map(e => e.id));

  return {
    ...state,
    people,
    graveyard: [...state.graveyard, ...dawnResult.newGraveyardEntries],
    councilMemberIds: [
      ...state.councilMemberIds.filter(id => !deadIds.has(id)),
      ...(dawnResult.autoJoinedCouncilIds ?? []),
    ],
    households: claimedHouseholds,
    settlement: {
      ...state.settlement,
      populationCount: dawnResult.populationCount,
      buildings: claimedBuildings,
      constructionQueue: [
        ...dawnResult.updatedConstructionQueue,
        ...(dawnResult.privateProjects ?? []),
      ],
      resources: (() => {
        // Start from the private-build-adjusted resources (material deductions already applied).
        const base = dawnResult.updatedResourcesAfterPrivateBuild ?? state.settlement.resources;
        return base;
      })(),
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
    famineStreak: dawnResult.newFamineStreak,
    famineRecoveryTurn: dawnResult.newFamineRecoveryTurn,
    lastPayrollShortfall: false,
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
  // Kept as a closure local rather than reactive Zustand state to avoid spurious re-renders.
  interface PendingTurnData {
    production: ResourceStock;
    consumption: ResourceStock;
    spoilage: Partial<ResourceStock>;
  }
  let _pendingTurnData: PendingTurnData | undefined;
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

      // ── Process expeditions this dawn ──────────────────────────────────────
      // Run before applyDawnResultToState so hexMap updates are captured.
      const expeditionResult = processExpeditions(
        gameState.expeditions ?? [],
        gameState.hexMap,
        gameState.turnNumber,
        rng,
      );

      // Restore roles for settlers who returned from completed expeditions.
      // (Pre-expedition roles are not yet persisted — default to 'gather_food'.)
      const expeditionReturnedRoles = new Map<string, WorkRole>();
      for (const memberId of expeditionResult.returnedMemberIds) {
        expeditionReturnedRoles.set(memberId, 'gather_food');
      }

      // Restore boat count for completed expeditions that used a boat.
      const boatsReturned = expeditionResult.completedExpeditionIds.reduce((count, id) => {
        const exp = expeditionResult.expeditions.find(e => e.id === id);
        return count + (exp?.hasBoat ? 1 : 0);
      }, 0);
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

      // Apply expedition member role restorations (returned from expeditions).
      for (const [id, role] of expeditionReturnedRoles) {
        const p = restoredPeople.get(id);
        if (p && p.role === 'away') restoredPeople.set(id, { ...p, role });
      }

      // Handle lost expedition members — kill them and move to graveyard.
      const lostMemberGraveyardEntries: GraveyardEntry[] = [];
      const lostMemberIds = new Set<string>();
      for (const lostId of expeditionResult.lostExpeditionIds) {
        const lostExp = expeditionResult.expeditions.find(e => e.id === lostId);
        if (!lostExp) continue;
        for (const memberId of [lostExp.leaderId, ...lostExp.memberIds]) {
          const p = restoredPeople.get(memberId);
          if (!p) continue;
          lostMemberGraveyardEntries.push(toGraveyardEntry(p, postDawnState.currentYear, 'expedition_lost'));
          lostMemberIds.add(memberId);
          restoredPeople.delete(memberId);
        }
      }

      const stateAfterDrain: GameState = {
        ...postDawnState,
        people: restoredPeople,
        graveyard: lostMemberGraveyardEntries.length > 0
          ? [...postDawnState.graveyard, ...lostMemberGraveyardEntries]
          : postDawnState.graveyard,
        councilMemberIds: lostMemberIds.size > 0
          ? postDawnState.councilMemberIds.filter(id => !lostMemberIds.has(id))
          : postDawnState.councilMemberIds,
        deferredEvents: remainingDeferred,
        hexMap: expeditionResult.hexMap,
        expeditions: expeditionResult.expeditions,
        boatsInPort: (gameState.boatsInPort ?? 1) + boatsReturned,
      };

      // ── Tribe sighting: mark tribes whose territory was entered this turn ─
      // discoverTribesFromExpedition returns new tribe IDs from this tick's
      // expedition movement; we set sighted=true immediately so the tribe
      // appears in Known Clans on this same turn.
      const newlySightedIds = new Set<string>();
      for (const exp of expeditionResult.expeditions) {
        const discovered = discoverTribesFromExpedition(exp, expeditionResult.hexMap);
        for (const id of discovered) newlySightedIds.add(id);
      }
      const tribesAfterSighting = new Map(stateAfterDrain.tribes);
      for (const tribeId of newlySightedIds) {
        const t = tribesAfterSighting.get(tribeId);
        if (t && !t.sighted) {
          tribesAfterSighting.set(tribeId, { ...t, sighted: true });
        }
      }

      // ── Emissary dawn processing ──────────────────────────────────────────
      // Advance travelling → at_tribe when arrivalTurn reached,
      // and returning → completed when returnTurn reached.
      const currentTurnNum = postDawnState.turnNumber;
      let updatedEmissaries = [...(stateAfterDrain.emissaries ?? [])];
      let updatedPendingSessions = [...(stateAfterDrain.pendingDiplomacySessions ?? [])];
      const restoredPeopleForEmissaries = new Map(stateAfterDrain.people);

      const returnedGiftsList: Array<{ wealth: number; food: number }> = [];
      updatedEmissaries = updatedEmissaries.map(em => {
        if (em.status === 'travelling' && em.arrivalTurn <= currentTurnNum) {
          // Emissary has arrived — queue a diplomacy session.
          if (!updatedPendingSessions.includes(em.id)) {
            updatedPendingSessions = [...updatedPendingSessions, em.id];
          }
          return { ...em, status: 'at_tribe' as const };
        }
        if (em.status === 'returning' && em.returnTurn !== null && em.returnTurn <= currentTurnNum) {
          // Emissary returned home — restore their role.
          const person = restoredPeopleForEmissaries.get(em.emissaryId);
          if (person && person.role === 'away') {
            restoredPeopleForEmissaries.set(em.emissaryId, { ...person, role: 'gather_food' });
          }
          // Capture gifts before zeroing; consolidation loop below will credit them.
          returnedGiftsList.push(em.giftsRemaining);
          return { ...em, status: 'completed' as const, giftsRemaining: { wealth: 0, food: 0 } };
        }
        return em;
      });

      // Consolidate returned gift resources into settlement.
      let settlementResourcesAfterReturns = { ...stateAfterDrain.settlement.resources };
      for (const rg of returnedGiftsList) {
        settlementResourcesAfterReturns = {
          ...settlementResourcesAfterReturns,
          wealth: (settlementResourcesAfterReturns.wealth ?? 0) + rg.wealth,
          food:   (settlementResourcesAfterReturns.food   ?? 0) + rg.food,
        };
      }

      // Prune completed emissaries older than 16 turns (4 in-game years).
      updatedEmissaries = updatedEmissaries.filter(
        em => em.status !== 'completed' || (currentTurnNum - em.dispatchedTurn) < 16,
      );

      const stateAfterDrainFinal: GameState = {
        ...stateAfterDrain,
        tribes: tribesAfterSighting,
        people: restoredPeopleForEmissaries,
        settlement: {
          ...stateAfterDrain.settlement,
          resources: settlementResourcesAfterReturns,
        },
        emissaries: updatedEmissaries,
        pendingDiplomacySessions: updatedPendingSessions,
      };
      const eligible  = filterEligibleEvents(ALL_EVENTS, stateAfterDrainFinal);
      const drawCount = 1 + rng.nextInt(0, 2);
      const hasTradingPost = hasBuilding(stateAfterDrainFinal.settlement.buildings, 'trading_post');
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
        const actors = resolveActors(event.actorRequirements, stateAfterDrainFinal, rng);
        return { ...event, boundActors: actors ?? {} } as BoundEvent;
      });

      // Assemble all programmatically-injected events, then append randomly drawn events.
      const allPending: BoundEvent[] = [
        ...buildInjectedEvents(dawnResult, expeditionResult, stateAfterDrainFinal, rng, deferredBoundEvents, shouldFireDesertion),
        ...boundDrawn,
      ];

      // One-time creole emergence notification.
      const showCreoleNotification =
        dawnResult.creoleEmerged && !gameState.flags.creoleEmergedNotified;
      const stateWithFlags: GameState = showCreoleNotification
        ? { ...stateAfterDrainFinal, flags: { ...stateAfterDrainFinal.flags, creoleEmergedNotified: true } }
        : stateAfterDrainFinal;

      _pendingTurnData = { production: dawnResult.production, consumption: dawnResult.consumption, spoilage: dawnResult.spoilageThisTurn };
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

      if (!_pendingTurnData) {
        console.error('[Palusteria] endTurn() called without a preceding startTurn() — production and consumption will be zero.');
      }
      const production = _pendingTurnData?.production ?? emptyResourceStock();
      const consumption = _pendingTurnData?.consumption ?? emptyResourceStock();

      // Apply resource deltas: production + consumption (consumption is already negative).
      let rawResources = addResourceStocks(
        addResourceStocks(gameState.settlement.resources, production),
        consumption,
      );

      // Apply spoilage losses.
      if (_pendingTurnData?.spoilage) {
        rawResources = applySpoilage(rawResources, _pendingTurnData.spoilage);
      }

      // Apply hard storage caps — excess beyond cap is discarded (overfull stores).
      const storageCaps = computeStorageCaps(
        gameState.people.size,
        gameState.settlement.buildings,
      );
      for (const key of Object.keys(storageCaps) as Array<keyof typeof storageCaps>) {
        if (rawResources[key] > storageCaps[key]) {
          rawResources = { ...rawResources, [key]: storageCaps[key] };
        }
      }

      const updatedResources = clampResourceStock(rawResources);

      const duskResult = processDusk(gameState, gameState.currentSeason);

      // Update company relation based on quota outcome (autumn only).
      let updatedCompany = gameState.company;
      if (duskResult.quotaStatus !== null) {
        updatedCompany = applyQuotaResult(gameState.company, duskResult.quotaStatus);
      }
      if (duskResult.resetQuotaContributions) {
        updatedCompany = {
          ...updatedCompany,
          quotaContributedWealth: 0,
        };
        // Increment yearsActive each Spring transition.
        updatedCompany = { ...updatedCompany, yearsActive: updatedCompany.yearsActive + 1 };
      }

      // Apply religious standing drain (winter only).
      if (duskResult.winterReligiousStandingDelta !== 0) {
        updatedCompany = {
          ...updatedCompany,
          standing: clamp(updatedCompany.standing + duskResult.winterReligiousStandingDelta, 0, 100),
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

      _pendingTurnData = undefined;
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

      // Children under 8 are too young to be assigned any work role.
      if (person.age < 8 || person.role === 'child') return;

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
      const traderBargaining = Array.from(gameState.people.values()).find(p => p.role === 'trader')?.skills.bargaining;
      const result = executeTribeTradeLogic(gameState.settlement.resources, offer, requested, tribe, gameState.turnNumber, traderBargaining);
      const updatedTribe = {
        ...tribe,
        disposition: clamp(tribe.disposition + result.dispositionDelta, 0, 100),
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

    contributeToQuota(wealth) {
      const { gameState, currentPhase } = get();
      if (!gameState || currentPhase !== 'management') return;
      const { company, settlement } = gameState;
      const actualWealth = Math.min(Math.max(0, wealth), settlement.resources.wealth);
      if (actualWealth === 0) return;
      const updatedResources: ResourceStock = {
        ...settlement.resources,
        wealth: settlement.resources.wealth - actualWealth,
      };
      const updatedCompany: CompanyRelation = {
        ...company,
        quotaContributedWealth: company.quotaContributedWealth + actualWealth,
      };
      set({
        gameState: {
          ...gameState,
          company: updatedCompany,
          settlement: { ...settlement, resources: updatedResources },
        },
      });
    },

    setEconomyReserves(reserves) {
      const { gameState } = get();
      if (!gameState) return;
      set({
        gameState: {
          ...gameState,
          settlement: {
            ...gameState.settlement,
            economyReserves: reserves,
          },
        },
      });
    },

    exportGoodsToCompany(_amount) {
      // No-op: goods→gold conversion removed in the wealth system.
      // Kept for interface compatibility; UI should not call this.
    },

    performCraft(recipeId) {
      const { gameState, currentPhase } = get();
      if (!gameState || currentPhase !== 'management') return;
      const validation = validateCraft(recipeId, gameState.settlement.buildings, gameState.settlement.resources);
      if (!validation.ok) return;
      const newResources = applyCraft(recipeId, gameState.settlement.resources);
      // craft_boat produces a boat (not a resource), so increment boatsInPort.
      const boatDelta = recipeId === 'craft_boat' ? 1 : 0;
      const updated: GameState = {
        ...gameState,
        settlement: { ...gameState.settlement, resources: newResources },
        boatsInPort: (gameState.boatsInPort ?? 1) + boatDelta,
      };
      set({ gameState: updated });
      localStorage.setItem(SAVE_KEY, serializeGameState(updated));
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

    buildForHousehold(householdId, defId, style) {
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
      const projectWithOwner = householdId ? { ...project, ownerHouseholdId: householdId } : project;
      set({
        gameState: {
          ...gameState,
          settlement: {
            ...gameState.settlement,
            resources: updatedResources,
            constructionQueue: [...gameState.settlement.constructionQueue, projectWithOwner],
          },
        },
      });
    },

    demolishHouseholdBuilding(householdId, slotIndex) {
      const { gameState } = get();
      if (!gameState) return;
      const hh = gameState.households.get(householdId);
      if (!hh) return;
      const instanceId = (hh.buildingSlots ?? [])[slotIndex];
      if (!instanceId) return;
      // Remove from settlement buildings.
      const updatedBuildings = gameState.settlement.buildings.filter(b => b.instanceId !== instanceId);
      // Clear workers who were assigned to the demolished building.
      const updatedPeople = new Map(gameState.people);
      for (const [, p] of updatedPeople) {
        if (p.claimedBuildingId === instanceId) {
          updatedPeople.set(p.id, { ...p, claimedBuildingId: null });
        }
      }
      // Update the household.
      const newSlots = [...(hh.buildingSlots ?? Array(9).fill(null))];
      newSlots[slotIndex] = null;
      const updatedHouseholds = new Map(gameState.households);
      const isDwelling = slotIndex === 0;
      updatedHouseholds.set(householdId, {
        ...hh,
        buildingSlots: newSlots,
        dwellingBuildingId: isDwelling ? null : hh.dwellingBuildingId,
        productionBuildingIds: isDwelling
          ? hh.productionBuildingIds
          : hh.productionBuildingIds.filter(id => id !== instanceId),
      });
      set({
        gameState: {
          ...gameState,
          people: updatedPeople,
          households: updatedHouseholds,
          settlement: { ...gameState.settlement, buildings: updatedBuildings },
        },
      });
    },

    upgradeHouseholdBuilding(householdId, slotIndex) {
      const { gameState } = get();
      if (!gameState) return;
      const hh = gameState.households.get(householdId);
      if (!hh) return;
      const instanceId = (hh.buildingSlots ?? [])[slotIndex];
      if (!instanceId) return;
      const building = gameState.settlement.buildings.find(b => b.instanceId === instanceId);
      if (!building) return;
      const currentDef = BUILDING_CATALOG[building.defId];
      if (!currentDef.upgradeChainId || currentDef.tierInChain === undefined) return;
      // Find next tier in same upgrade chain.
      const nextDef = Object.values(BUILDING_CATALOG).find(
        d =>
          d.upgradeChainId === currentDef.upgradeChainId &&
          d.tierInChain === currentDef.tierInChain! + 1,
      );
      if (!nextDef) return;
      get().buildForHousehold(householdId, nextDef.id, building.style);
    },

    cancelConstruction(projectId) {
      const { gameState } = get();
      if (!gameState) return;
      const project = gameState.settlement.constructionQueue.find(p => p.id === projectId);
      if (!project) return;
      const { refund, freedWorkerIds, freedWorkerPrevRoles } = cancelConstruction(project);
      // Free workers — restore their pre-builder role if they were auto-assigned.
      const updatedPeople = new Map(gameState.people);
      for (const wId of freedWorkerIds) {
        const w = updatedPeople.get(wId);
        if (w) {
          const restoredRole = (freedWorkerPrevRoles[wId] as WorkRole | undefined) ?? 'unassigned';
          updatedPeople.set(wId, { ...w, role: restoredRole });
        }
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

    dispatchExpedition(params) {
      const { gameState } = get();
      if (!gameState) return;
      const rng = createRNG(gameState.seed + gameState.turnNumber + Date.now());
      const expedition = createExpedition(
        params,
        gameState.people,
        gameState.expeditions,
        gameState.turnNumber,
        rng,
      );
      // Deduct provisions from settlement resources.
      const newResources = { ...gameState.settlement.resources };
      newResources.food = Math.max(0, newResources.food - params.provisions.food);
      newResources.wealth = Math.max(0, (newResources.wealth ?? 0) - ((params.provisions.goods ?? 0) + (params.provisions.gold ?? 0)));
      newResources.medicine = Math.max(0, (newResources.medicine ?? 0) - (params.provisions.medicine ?? 0));
      // Set all party members to 'away'.
      const newPeople = new Map(gameState.people);
      for (const id of [params.leaderId, ...params.memberIds]) {
        const p = newPeople.get(id);
        if (p) newPeople.set(id, { ...p, role: 'away' });
      }
      const updated: GameState = {
        ...gameState,
        people: newPeople,
        settlement: { ...gameState.settlement, resources: newResources },
        expeditions: [...(gameState.expeditions ?? []), expedition],
        boatsInPort: params.hasBoat
          ? Math.max(0, (gameState.boatsInPort ?? 1) - 1)
          : (gameState.boatsInPort ?? 1),
      };
      set({ gameState: updated });
      localStorage.setItem(SAVE_KEY, serializeGameState(updated));
    },

    recallExpedition(expeditionId) {
      const { gameState } = get();
      if (!gameState) return;
      const updated: GameState = {
        ...gameState,
        expeditions: (gameState.expeditions ?? []).map(e =>
          e.id === expeditionId && e.status === 'travelling'
            ? { ...e, status: 'returning' as const }
            : e
        ),
      };
      set({ gameState: updated });
      localStorage.setItem(SAVE_KEY, serializeGameState(updated));
    },

    dispatchEmissary(params) {
      const { gameState } = get();
      if (!gameState) return;
      const tribe = gameState.tribes.get(params.tribeId);
      if (!tribe) return;
      const emissaryPerson = gameState.people.get(params.emissaryId);
      const bargaining = emissaryPerson?.skills?.bargaining ?? 0;
      const dispatch = createEmissaryDispatch({
        ...params,
        travelOneWay: emissaryTravelTime(tribe, bargaining),
        dispatchedTurn: gameState.turnNumber,
      });
      const newResources = { ...gameState.settlement.resources };
      newResources.wealth = Math.max(0, (newResources.wealth ?? 0) - (params.packedGifts.wealth ?? 0));
      newResources.food   = Math.max(0, (newResources.food   ?? 0) - (params.packedGifts.food   ?? 0));
      const newPeople = new Map(gameState.people);
      const p = newPeople.get(params.emissaryId);
      if (p) newPeople.set(params.emissaryId, { ...p, role: 'away' });
      const updated: GameState = {
        ...gameState,
        settlement: { ...gameState.settlement, resources: newResources },
        people: newPeople,
        emissaries: [...(gameState.emissaries ?? []), dispatch],
      };
      set({ gameState: updated });
      localStorage.setItem(SAVE_KEY, serializeGameState(updated));
    },

    resolveEmissarySession(emissaryId, actions) {
      const { gameState } = get();
      if (!gameState) return;
      const emissary = (gameState.emissaries ?? []).find(e => e.id === emissaryId);
      if (!emissary || emissary.status !== 'at_tribe') return;
      const tribe = gameState.tribes.get(emissary.tribeId);
      if (!tribe) return;
      const emissaryPerson = gameState.people.get(emissary.emissaryId);
      const bargaining = emissaryPerson?.skills?.bargaining ?? 0;

      // Attach the player's chosen actions to the emissary, then resolve.
      const emissaryWithActions = { ...emissary, sessionActions: actions };
      const result = resolveEmissarySessionLogic(
        emissaryWithActions,
        tribe,
        gameState.turnNumber,
        bargaining,
      );

      // Compute gift consumption: tally offered_gifts actions.
      const giftsSpent = { wealth: 0, food: 0 };
      for (const action of actions) {
        if (action.type === 'offer_gifts') {
          giftsSpent.wealth += action.giftsOffered?.wealth ?? 0;
          giftsSpent.food   += action.giftsOffered?.food   ?? 0;
        }
      }
      const remaining = {
        wealth: Math.max(0, (emissary.giftsRemaining.wealth ?? 0) - giftsSpent.wealth),
        food:   Math.max(0, (emissary.giftsRemaining.food   ?? 0) - giftsSpent.food),
      };

      // Update emissary state: transition to returning.
      const updatedEmissary: EmissaryDispatch = {
        ...emissaryWithActions,
        status: 'returning',
        returnTurn: gameState.turnNumber + result.returnTravelTurns,
        giftsRemaining: remaining,
      };

      const newTribes = new Map(gameState.tribes);
      newTribes.set(tribe.id, result.updatedTribe);

      const newResources = { ...gameState.settlement.resources };
      if (result.resourcesGained.food)  newResources.food   = (newResources.food   ?? 0) + result.resourcesGained.food;
      if (result.resourcesGained.wealth) newResources.wealth = (newResources.wealth ?? 0) + result.resourcesGained.wealth;

      const updated: GameState = {
        ...gameState,
        tribes: newTribes,
        settlement: { ...gameState.settlement, resources: newResources },
        emissaries: (gameState.emissaries ?? []).map(e =>
          e.id === emissaryId ? updatedEmissary : e,
        ),
        pendingDiplomacySessions: (gameState.pendingDiplomacySessions ?? []).filter(
          id => id !== emissaryId,
        ),
      };
      set({ gameState: updated });
      localStorage.setItem(SAVE_KEY, serializeGameState(updated));
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
