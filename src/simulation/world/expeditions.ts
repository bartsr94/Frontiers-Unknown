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
} from './hex-map';

// ─── Constants ─────────────────────────────────────────────────────────────────

/** Minimum food each party member consumes per season. */
export const EXPEDITION_FOOD_PER_PERSON = BASE_FOOD_PER_PERSON_PER_SEASON;

/** Extra food multiplier when travelling through desert terrain. */
export const DESERT_FOOD_MULTIPLIER = 2;

/** Fraction of progress gained per turn (one turn = one season = 1.0 progress unit). */
export const EXPEDITION_TRAVEL_UNIT = 1.0;

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
    currentQ: 7, // Settlement position
    currentR: 7,
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
    pendingExpeditionEvents: [],
    journal: [
      {
        turn: dispatchedTurn,
        text: `${name} departed the settlement.`,
      },
    ],
  };
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
): { expedition: Expedition; hexMap: HexMap } {
  if (expedition.status !== 'travelling' && expedition.status !== 'returning') {
    return { expedition, hexMap };
  }

  let updatedHexMap = hexMap;
  let updatedExp = { ...expedition, journal: [...expedition.journal] };

  // ── Determine target this turn ────────────────────────────────────────────
  const isReturning = expedition.status === 'returning';
  const targetQ = isReturning ? 7 : expedition.destinationQ; // settlement = (7,7)
  const targetR = isReturning ? 7 : expedition.destinationR;

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
    return { expedition: updatedExp, hexMap: updatedHexMap };
  }

  // ── Movement ──────────────────────────────────────────────────────────────
  const speedTable = expedition.hasBoat ? TERRAIN_TRAVEL_SPEED_BOAT : TERRAIN_TRAVEL_SPEED_FOOT;
  const speed = speedTable[terrain] ?? 1;

  let remainingMovement = speed;
  let q = updatedExp.currentQ;
  let r = updatedExp.currentR;

  while (remainingMovement > 0 && !(q === targetQ && r === targetR)) {
    // Pick the neighbour that minimises distance to target.
    const neighbours = getBoundedNeighbours(q, r, hexMap.width, hexMap.height);
    if (neighbours.length === 0) break;

    // Sort by distance to target.
    neighbours.sort((a, b) =>
      axialDistance(a.q, a.r, targetQ, targetR) -
      axialDistance(b.q, b.r, targetQ, targetR),
    );

    const next = neighbours[0]!;
    const nextCell = hexMap.cells.get(hexKey(next.q, next.r));
    const nextTerrain = nextCell?.terrain ?? 'plains';
    const stepCost = 1 / (speedTable[nextTerrain] ?? 1);

    if (remainingMovement < stepCost) break; // Can't afford the step this turn.

    remainingMovement -= stepCost;
    q = next.q;
    r = next.r;

    // Mark hex visited and scout neighbours.
    updatedHexMap = markHexVisited(updatedHexMap, q, r, currentTurn);
    if (!updatedExp.visitedHexes.some(v => v.q === q && v.r === r)) {
      updatedExp.visitedHexes = [...updatedExp.visitedHexes, { q, r, turn: currentTurn }];
      updatedExp.journal.push({
        turn: currentTurn,
        text: `Expedition reached (${q}, ${r}).`,
      });
    }
  }

  updatedExp.currentQ = q;
  updatedExp.currentR = r;

  // ── Arrival check ─────────────────────────────────────────────────────────
  if (q === targetQ && r === targetR) {
    if (isReturning) {
      // Arrived back at settlement.
      updatedExp.status = 'completed';
      updatedExp.resolvedTurn = currentTurn;
      updatedExp.journal.push({
        turn: currentTurn,
        text: `${expedition.name} returned to the settlement.`,
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

  return { expedition: updatedExp, hexMap: updatedHexMap };
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
}

/**
 * Processes all active expeditions for one dawn tick.
 * Returns updated expeditions + hexMap; never mutates input.
 */
export function processExpeditions(
  expeditions: Expedition[],
  hexMap: HexMap,
  currentTurn: number,
): ExpeditionProcessResult {
  let updatedHexMap = hexMap;
  const updatedExpeditions: Expedition[] = [];
  const completedIds: string[] = [];
  const lostIds: string[] = [];
  const returnedMemberIds: string[] = [];

  for (const exp of expeditions) {
    if (exp.status === 'completed' || exp.status === 'lost') {
      // Keep completed/lost expeditions in the list for journal history.
      updatedExpeditions.push(exp);
      continue;
    }

    const { expedition: processed, hexMap: newMap } =
      processExpeditionTurn(exp, updatedHexMap, currentTurn);
    updatedHexMap = newMap;

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
  const speedTable = hasBoat ? TERRAIN_TRAVEL_SPEED_BOAT : TERRAIN_TRAVEL_SPEED_FOOT;
  // Assume average plains/forest speed ~3 for estimate.
  const avgSpeed = (speedTable['plains'] + speedTable['forest']) / 2;
  const seasonsOneWay = Math.ceil(dist / avgSpeed);
  // Round trip × 1.5× safety buffer.
  return Math.ceil(partySize * EXPEDITION_FOOD_PER_PERSON * seasonsOneWay * 2 * 1.5);
}
