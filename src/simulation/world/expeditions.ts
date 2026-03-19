/**
 * Expedition creation, dispatch, turn-processing, and recall logic.
 *
 * Pure logic — no React, no DOM, seeded RNG only (Hard Rule #1).
 * All functions return new state objects; nothing is mutated in place.
 */

import type {
  Expedition,
  ExpeditionStatus,
  HexCell,
  HexMap,
} from '../turn/game-state';
import type { Person } from '../population/person';
import type { SeededRNG } from '../../utils/rng';
import { generateId } from '../../utils/id';
import {
  hexKey,
  markHexVisited,
  TERRAIN_TRAVEL_SPEED_FOOT,
  TERRAIN_TRAVEL_SPEED_BOAT,
  BASE_FOOD_PER_PERSON_PER_SEASON,
  axialDistance,
  getBoundedNeighbours,
  SETTLEMENT_Q,
  SETTLEMENT_R,
} from './hex-map';

// ─── Constants ─────────────────────────────────────────────────────────────────

/** Minimum food each party member consumes per season. */
export const EXPEDITION_FOOD_PER_PERSON = BASE_FOOD_PER_PERSON_PER_SEASON;

/** Extra food multiplier when travelling through desert terrain. */
export const DESERT_FOOD_MULTIPLIER = 2;

/** Fraction of progress gained per turn (one turn = one season = 1.0 progress unit). */
export const EXPEDITION_TRAVEL_UNIT = 1.0;

/**
 * Fires `exp_food_running_low` on this turn when foodRemaining is at or below
 * this many seasons' worth for the party.  Fires at most once per expedition.
 */
export const FOOD_LOW_SEASONS_THRESHOLD = 1.5;

// ─── Naming ───────────────────────────────────────────────────────────────────

/**
 * Auto-generates an expedition name based on the leader's first name and how many
 * previous expeditions under that leader exist.
 */
export function generateExpeditionName(
  leaderFirstName: string,
  priorExpeditionsForLeader: number,
): string {
  const suffix =
    priorExpeditionsForLeader === 0 ? 'Expedition' :
    priorExpeditionsForLeader === 1 ? 'Second Expedition' :
    priorExpeditionsForLeader === 2 ? 'Third Expedition' :
    `${priorExpeditionsForLeader + 1}th Expedition`;
  return `${leaderFirstName}'s ${suffix}`;
}

// ─── Expedition factory ───────────────────────────────────────────────────────

export interface DispatchExpeditionParams {
  leaderId: string;
  memberIds: string[];
  destinationQ: number;
  destinationR: number;
  customName?: string;
  hasBoat: boolean;
  provisions: {
    food: number;
    goods: number;
    gold: number;
    medicine: number;
  };
}

/**
 * Creates a new Expedition object but does NOT modify GameState.
 * The caller is responsible for adding it to `state.expeditions` and
 * deducting provisions from `state.settlement.resources`.
 */
export function createExpedition(
  params: DispatchExpeditionParams,
  people: Map<string, Person>,
  existingExpeditions: Expedition[],
  dispatchedTurn: number,
  _rng: SeededRNG,
): Expedition {
  const leader = people.get(params.leaderId);
  const leaderFirstName = leader ? leader.firstName : 'Unknown';

  // Count prior expeditions for this leader to generate a unique name.
  const priorCount = existingExpeditions.filter(e => e.leaderId === params.leaderId).length;
  const name = params.customName ?? generateExpeditionName(leaderFirstName, priorCount);

  const id = generateId();

  return {
    id,
    name,
    leaderId: params.leaderId,
    memberIds: params.memberIds,
    hasBoat: params.hasBoat,
    provisions: { ...params.provisions },
    currentQ: SETTLEMENT_Q,
    currentR: SETTLEMENT_R,
    destinationQ: params.destinationQ,
    destinationR: params.destinationR,
    waypoints: [{ q: params.destinationQ, r: params.destinationR, estimatedArrivalTurn: 0 }],
    visitedHexes: [],
    status: 'travelling' as ExpeditionStatus,
    dispatchedTurn,
    resolvedTurn: null,
    travelProgress: 0,
    foodRemaining: params.provisions.food,
    goodsRemaining: params.provisions.goods,
    goldRemaining: params.provisions.gold,
    medicineRemaining: params.provisions.medicine,
    firedFoodLowWarning: false,
    pendingExpeditionEvents: [],
    journal: [
      {
        turn: dispatchedTurn,
        text: `${name} departed the settlement.`,
      },
    ],
  };
}

// ─── Hex content → event mapping ─────────────────────────────────────────────

/**
 * Maps a HexContentType to the expedition event ID that should fire when the
 * expedition enters a hex containing that content.
 * Returns `null` for content types that do not fire expedition events.
 */
function hexContentToEventId(
  contentType: string,
  isFirstVisit: boolean,
): string | null {
  switch (contentType) {
    case 'ruins':              return 'exp_ruins_discovered';
    case 'abandoned_camp':     return 'exp_abandoned_camp_found';
    case 'burial_ground':      return 'exp_burial_ground_entered';
    case 'hidden_shrine':      return 'exp_hidden_shrine_discovered';
    case 'fresh_water_spring': return 'exp_fresh_water_spring';
    case 'old_road':           return 'exp_old_road_found';
    case 'resource_cache':     return 'exp_resource_cache_found';
    case 'tribe_settlement':   return 'exp_tribe_settlement_approached';
    case 'tribe_territory':
      return isFirstVisit ? 'exp_tribe_territory_entered' : 'exp_tribe_patrol_encountered';
    case 'tribe_outpost':      return 'exp_tribe_patrol_encountered';
    case 'animal_den':         return 'exp_animal_attack';
    case 'travellers':         return 'exp_travellers_met';
    case 'disease_vector':     return 'exp_disease_outbreak';
    case 'bandit_camp':        return 'exp_bandit_ambush';
    case 'weather_hazard':     return 'exp_severe_weather';
    default:                   return null;
  }
}

/** Types that fire once and are then marked `discovered`. */
const ONE_TIME_CONTENT_TYPES = new Set([
  'ruins', 'abandoned_camp', 'burial_ground', 'hidden_shrine',
  'fresh_water_spring', 'old_road', 'resource_cache', 'landmark',
]);

/** Types that roll each visit (not just first visit). */
const RECURRING_CONTENT_TYPES = new Set([
  'animal_den', 'travellers', 'disease_vector', 'bandit_camp', 'weather_hazard',
]);

/**
 * Returns the list of expedition events to fire and the indices of one-time
 * content that should be marked `discovered` in the hex map.
 */
export function collectHexEntryEvents(
  expedition: Expedition,
  cell: HexCell,
  isFirstVisit: boolean,
  rng: SeededRNG,
): {
  events: Array<{ eventId: string; boundActors: Record<string, string> }>;
  discoveredContentIndices: number[];
} {
  const events: Array<{ eventId: string; boundActors: Record<string, string> }> = [];
  const discoveredContentIndices: number[] = [];

  for (let i = 0; i < cell.contents.length; i++) {
    const content = cell.contents[i]!;

    if (ONE_TIME_CONTENT_TYPES.has(content.type)) {
      if (content.discovered) continue;
    } else if (RECURRING_CONTENT_TYPES.has(content.type)) {
      // 60% chance per visit for recurring encounters.
      if (rng.next() > 0.60) continue;
    }

    const eventId = hexContentToEventId(content.type, isFirstVisit);
    if (!eventId) continue;

    const boundActors: Record<string, string> = {
      leader: expedition.leaderId,
      _expeditionId: expedition.id,
    };
    if (expedition.memberIds.length > 0) {
      boundActors['member'] = expedition.memberIds[0]!;
    }
    if (content.tribeId) {
      boundActors['_tribeId'] = content.tribeId;
    }

    events.push({ eventId, boundActors });

    if (ONE_TIME_CONTENT_TYPES.has(content.type)) {
      discoveredContentIndices.push(i);
    }
  }

  return { events, discoveredContentIndices };
}

// ─── Travel step ──────────────────────────────────────────────────────────────

/**
 * Advances an expedition by one season's worth of travel toward its destination.
 * Handles:
 * - Movement across hexes based on terrain speed.
 * - Food consumption.
 * - Starvation (expeditions that run out of food become 'lost').
 * - Automatic return once the destination is reached.
 * - Hex visibility updates.
 *
 * Returns the updated expedition + updated hexMap (immutable).
 */
export function processExpeditionTurn(
  expedition: Expedition,
  hexMap: HexMap,
  currentTurn: number,
  rng: SeededRNG,
): {
  expedition: Expedition;
  hexMap: HexMap;
  pendingEvents: Array<{ eventId: string; boundActors: Record<string, string> }>;
} {
  if (expedition.status !== 'travelling' && expedition.status !== 'returning') {
    return { expedition, hexMap, pendingEvents: [] };
  }

  let updatedHexMap = hexMap;
  let updatedExp = { ...expedition, journal: [...expedition.journal] };
  const pendingEvents: Array<{ eventId: string; boundActors: Record<string, string> }> = [];

  // ── Determine target this turn ────────────────────────────────────────────
  const isReturning = expedition.status === 'returning';
  const targetQ = isReturning ? SETTLEMENT_Q : expedition.destinationQ;
  const targetR = isReturning ? SETTLEMENT_R : expedition.destinationR;

  // ── Food consumption ──────────────────────────────────────────────────────
  const partySize = 1 + expedition.memberIds.length;
  const currentCell = hexMap.cells.get(hexKey(expedition.currentQ, expedition.currentR));
  const terrain = currentCell?.terrain ?? 'plains';
  const desertMult = terrain === 'desert' ? DESERT_FOOD_MULTIPLIER : 1;
  const foodConsumed = Math.ceil(partySize * EXPEDITION_FOOD_PER_PERSON * desertMult);
  updatedExp.foodRemaining = Math.max(0, updatedExp.foodRemaining - foodConsumed);

  if (updatedExp.foodRemaining === 0) {
    updatedExp.status = 'lost';
    updatedExp.resolvedTurn = currentTurn;
    updatedExp.journal.push({
      turn: currentTurn,
      text: `The ${expedition.name} ran out of food and was lost in the Ashmark.`,
    });
    return { expedition: updatedExp, hexMap: updatedHexMap, pendingEvents };
  }

  // ── Food-low warning (fires once per expedition) ──────────────────────────
  const foodPerSeason = Math.ceil(partySize * EXPEDITION_FOOD_PER_PERSON * desertMult);
  if (
    !updatedExp.firedFoodLowWarning &&
    updatedExp.foodRemaining <= foodPerSeason * FOOD_LOW_SEASONS_THRESHOLD
  ) {
    updatedExp.firedFoodLowWarning = true;
    pendingEvents.push({
      eventId: 'exp_food_running_low',
      boundActors: {
        leader: expedition.leaderId,
        _expeditionId: expedition.id,
      },
    });
  }

  // ── Movement ──────────────────────────────────────────────────────────────
  // Snapshot visited hexes before this turn's movement so we can detect newly
  // entered hexes for content events.
  const preVisitKeys = new Set(updatedExp.visitedHexes.map(v => hexKey(v.q, v.r)));
  // Each season (turn) provides 1.0 unit of travel budget.
  // travelProgress > 0 means the expedition is mid-traversal into a slow hex
  // and still owes that many seasons — mountains (0.5 hexes/season = 2 seasons/hex)
  // accumulate this debt across turns until it is paid off.
  const speedTable = expedition.hasBoat ? TERRAIN_TRAVEL_SPEED_BOAT : TERRAIN_TRAVEL_SPEED_FOOT;
  let q = updatedExp.currentQ;
  let r = updatedExp.currentR;
  let budget = EXPEDITION_TRAVEL_UNIT; // 1.0 per season

  // ── Drain any hex-entry debt carried over from a previous turn ────────────
  if (updatedExp.travelProgress > 0) {
    const drained = Math.min(updatedExp.travelProgress, budget);
    updatedExp.travelProgress -= drained;
    budget -= drained;

    if (updatedExp.travelProgress <= 0) {
      updatedExp.travelProgress = 0;
      // Debt cleared — step into the next-best hex now.
      if (!(q === targetQ && r === targetR)) {
        const neighbours = getBoundedNeighbours(q, r);
        neighbours.sort((a, b) =>
          axialDistance(a.q, a.r, targetQ, targetR) -
          axialDistance(b.q, b.r, targetQ, targetR),
        );
        if (neighbours.length > 0) {
          const next = neighbours[0]!;
          q = next.q;
          r = next.r;
          updatedHexMap = markHexVisited(updatedHexMap, q, r, currentTurn);
          if (!updatedExp.visitedHexes.some(v => v.q === q && v.r === r)) {
            updatedExp.visitedHexes = [...updatedExp.visitedHexes, { q, r, turn: currentTurn }];
            updatedExp.journal.push({
              turn: currentTurn,
              text: `Expedition reached (${q}, ${r}).`,
            });
          }
        }
      }
    }
  }

  // ── Spend remaining budget on additional hexes ────────────────────────────
  while (budget > 0 && !(q === targetQ && r === targetR)) {
    // Pick the neighbour that minimises distance to target.
    const neighbours = getBoundedNeighbours(q, r);
    if (neighbours.length === 0) break;

    neighbours.sort((a, b) =>
      axialDistance(a.q, a.r, targetQ, targetR) -
      axialDistance(b.q, b.r, targetQ, targetR),
    );

    const next = neighbours[0]!;
    const nextCell = hexMap.cells.get(hexKey(next.q, next.r));
    const nextTerrain = nextCell?.terrain ?? 'plains';
    const stepCost = 1 / (speedTable[nextTerrain] ?? 1);

    if (budget >= stepCost) {
      // Fully afford the entry cost — step in immediately.
      budget -= stepCost;
      q = next.q;
      r = next.r;
      updatedHexMap = markHexVisited(updatedHexMap, q, r, currentTurn);
      if (!updatedExp.visitedHexes.some(v => v.q === q && v.r === r)) {
        updatedExp.visitedHexes = [...updatedExp.visitedHexes, { q, r, turn: currentTurn }];
        updatedExp.journal.push({
          turn: currentTurn,
          text: `Expedition reached (${q}, ${r}).`,
        });
      }
    } else {
      // Can't finish this hex this turn — bank remaining cost as debt.
      updatedExp.travelProgress = stepCost - budget;
      budget = 0;
    }
  }

  updatedExp.currentQ = q;
  updatedExp.currentR = r;

  // ── Hex content events for newly entered hexes ────────────────────────────
  const newlyVisited = updatedExp.visitedHexes.filter(v => !preVisitKeys.has(hexKey(v.q, v.r)));
  for (const hex of newlyVisited) {
    const cell = updatedHexMap.cells.get(hexKey(hex.q, hex.r));
    if (!cell) continue;
    const { events: contentEvents, discoveredContentIndices } = collectHexEntryEvents(
      updatedExp, cell, true, rng,
    );
    pendingEvents.push(...contentEvents);
    if (discoveredContentIndices.length > 0) {
      const updatedContents = cell.contents.map((c, i) =>
        discoveredContentIndices.includes(i) ? { ...c, discovered: true } : c,
      );
      const newCells = new Map(updatedHexMap.cells);
      newCells.set(hexKey(hex.q, hex.r), { ...cell, contents: updatedContents });
      updatedHexMap = { ...updatedHexMap, cells: newCells };
    }
  }

  // ── Recurring encounter at current position (if not a new hex) ───────────
  if (newlyVisited.length === 0) {
    const currentCellNow = updatedHexMap.cells.get(hexKey(q, r));
    if (currentCellNow) {
      const { events: recEvents } = collectHexEntryEvents(
        updatedExp, currentCellNow, false, rng,
      );
      pendingEvents.push(...recEvents);
    }
  }

  // ── Morale check ──────────────────────────────────────────────────────────
  // Every 4 turns there is a chance a member wants to return early.
  const expeditionAge = currentTurn - updatedExp.dispatchedTurn;
  if (
    expeditionAge > 0 &&
    expeditionAge % 4 === 0 &&
    updatedExp.memberIds.length > 0 &&
    updatedExp.status === 'travelling'
  ) {
    pendingEvents.push({
      eventId: 'exp_member_wants_to_turn_back',
      boundActors: {
        leader: expedition.leaderId,
        member: updatedExp.memberIds[0]!,
        _expeditionId: expedition.id,
      },
    });
  }

  // ── Arrival check ─────────────────────────────────────────────────────────
  if (q === targetQ && r === targetR) {
    if (isReturning) {
      // Arrived back at settlement — queue the debrief event.
      updatedExp.status = 'completed';
      updatedExp.resolvedTurn = currentTurn;
      updatedExp.journal.push({
        turn: currentTurn,
        text: `${expedition.name} returned to the settlement.`,
      });
      pendingEvents.push({
        eventId: 'exp_return_report',
        boundActors: {
          leader: expedition.leaderId,
          _expeditionId: expedition.id,
        },
      });
    } else {
      // Reached destination — begin return journey.
      updatedExp.status = 'returning';
      updatedExp.journal.push({
        turn: currentTurn,
        text: `${expedition.name} reached its destination at (${targetQ}, ${targetR}) and turns for home.`,
      });
    }
  }

  return { expedition: updatedExp, hexMap: updatedHexMap, pendingEvents };
}

// ─── Batch processing ─────────────────────────────────────────────────────────

export interface ExpeditionProcessResult {
  expeditions: Expedition[];
  hexMap: HexMap;
  completedExpeditionIds: string[];
  lostExpeditionIds: string[];
  /**
   * IDs of settlers whose `role` should be restored to their pre-expedition role.
   * The caller (store/turn-processor) handles the actual role mutation.
   */
  returnedMemberIds: string[];
  /**
   * Expedition events ready to be injected into the pending-event queue.
   * Each entry carries the event ID and the bound-actor map.
   */
  pendingEventArgs: Array<{ eventId: string; boundActors: Record<string, string> }>;
}

/**
 * Processes all active expeditions for one dawn tick.
 * Returns updated expeditions + hexMap; never mutates input.
 */
export function processExpeditions(
  expeditions: Expedition[],
  hexMap: HexMap,
  currentTurn: number,
  rng: SeededRNG,
): ExpeditionProcessResult {
  let updatedHexMap = hexMap;
  const updatedExpeditions: Expedition[] = [];
  const completedIds: string[] = [];
  const lostIds: string[] = [];
  const returnedMemberIds: string[] = [];
  const allPendingEventArgs: Array<{ eventId: string; boundActors: Record<string, string> }> = [];

  for (const exp of expeditions) {
    if (exp.status === 'completed' || exp.status === 'lost') {
      // Keep completed/lost expeditions in the list for journal history.
      updatedExpeditions.push(exp);
      continue;
    }

    const { expedition: processed, hexMap: newMap, pendingEvents } =
      processExpeditionTurn(exp, updatedHexMap, currentTurn, rng);
    updatedHexMap = newMap;
    allPendingEventArgs.push(...pendingEvents);

    if (processed.status === 'completed') {
      completedIds.push(exp.id);
      returnedMemberIds.push(processed.leaderId, ...processed.memberIds);
    } else if (processed.status === 'lost') {
      lostIds.push(exp.id);
      // Lost members are removed from the population by the store — they count as dead.
    }

    updatedExpeditions.push(processed);
  }

  return {
    expeditions: updatedExpeditions,
    hexMap: updatedHexMap,
    completedExpeditionIds: completedIds,
    lostExpeditionIds: lostIds,
    returnedMemberIds,
    pendingEventArgs: allPendingEventArgs,
  };
}

// ─── Hex contact check ────────────────────────────────────────────────────────

/**
 * Returns the tribe ID if the given hex's contents include a `tribe_territory`
 * entry, or `null` if not.
 */
export function getTribeTerritoryAtHex(
  cell: HexCell,
): string | null {
  for (const content of cell.contents) {
    if (content.type === 'tribe_territory' && content.tribeId) {
      return content.tribeId;
    }
  }
  return null;
}

/**
 * Determines which tribes should have `contactEstablished` set to true
 * based on hexes the expedition has visited this turn.
 * Returns a set of tribe IDs.
 */
export function discoverTribesFromExpedition(
  expedition: Expedition,
  hexMap: HexMap,
): Set<string> {
  const discovered = new Set<string>();
  for (const k of expedition.visitedHexes) {
    const cell = hexMap.cells.get(hexKey(k.q, k.r));
    if (!cell) continue;
    const tribeId = getTribeTerritoryAtHex(cell);
    if (tribeId) discovered.add(tribeId);
  }
  return discovered;
}

// ─── Food consumption estimate ────────────────────────────────────────────────

/**
 * Estimates the total food required for a round-trip expedition to (destQ, destR).
 * Used by the dispatch overlay to set default provisions.
 *
 * Uses a conservative travel speed (hills/forest pace) so the suggestion
 * accounts for slow terrain and matches the actual per-turn ceiling consumption.
 */
export function estimateExpeditionFood(
  partySize: number,
  fromQ: number,
  fromR: number,
  destQ: number,
  destR: number,
  hasBoat: boolean,
): number {
  const dist = axialDistance(fromQ, fromR, destQ, destR);
  // Use conservative speeds — foot assumes mixed hills/forest (1 hex/season),
  // boat gets a moderate river benefit (2 hexes/season).
  const conservativeSpeed = hasBoat ? 2 : 1;
  const seasonsOneWay = Math.ceil(dist / conservativeSpeed);
  // Actual per-turn consumption uses Math.ceil, so the estimate must match.
  const foodPerTurn = Math.ceil(partySize * EXPEDITION_FOOD_PER_PERSON);
  // Round trip × 1.5× safety buffer.
  return Math.ceil(foodPerTurn * seasonsOneWay * 2 * 1.5);
}
