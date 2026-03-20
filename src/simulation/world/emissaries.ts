/**
 * Emissary system — pure logic, no React, no DOM, no Math.random().
 *
 * Covers:
 *  - Travel time calculation (abstracted; no hex-by-hex events for emissaries)
 *  - Gift disposition gain formula (tribe-trait- and desire-aware)
 *  - Resource request yield formula (ask_food / ask_goods)
 *  - EmissaryDispatch factory
 *  - Session resolution helper (produces the state mutations for the store)
 */

import type {
  ExternalTribe,
  EmissaryDispatch,
  EmissaryMissionType,
  EmissaryGiftBundle,
  ResourceStock,
} from '../turn/game-state';
import { generateId } from '../../utils/id';
import { axialDistance, SETTLEMENT_Q, SETTLEMENT_R } from './hex-map';
import { clamp } from '../../utils/math';

// ─── Travel time ──────────────────────────────────────────────────────────────

/**
 * Returns the one-way travel time (in turns) for an emissary to reach a tribe.
 *
 * Uses an abstracted speed of 2 hexes/season (light load, known route).
 * If the tribe's territory coordinates are unknown, falls back to 4 turns.
 * A bargaining skill ≥ 63 shaves one turn off (minimum 1).
 */
export function emissaryTravelTime(
  tribe: ExternalTribe,
  emissaryBargainingSkill: number,
): number {
  let travelTurns: number;
  if (tribe.territoryQ !== null && tribe.territoryR !== null) {
    const dist = axialDistance(tribe.territoryQ, tribe.territoryR, SETTLEMENT_Q, SETTLEMENT_R);
    travelTurns = Math.max(1, Math.ceil(dist / 2));
  } else {
    travelTurns = 4;
  }
  // Excellent bargaining: seasoned diplomats travel faster (skip one turn of prep).
  if (emissaryBargainingSkill >= 63) {
    travelTurns = Math.max(1, travelTurns - 1);
  }
  return travelTurns;
}

// ─── Emissary factory ─────────────────────────────────────────────────────────

export interface DispatchEmissaryParams {
  tribeId: string;
  emissaryId: string;
  missionType: EmissaryMissionType;
  packedGifts: EmissaryGiftBundle;
  /** Pre-computed one-way travel time (call emissaryTravelTime before dispatch). */
  travelOneWay: number;
  dispatchedTurn: number;
}

export function createEmissaryDispatch(params: DispatchEmissaryParams): EmissaryDispatch {
  return {
    id: generateId(),
    tribeId: params.tribeId,
    emissaryId: params.emissaryId,
    missionType: params.missionType,
    dispatchedTurn: params.dispatchedTurn,
    arrivalTurn: params.dispatchedTurn + params.travelOneWay,
    returnTurn: null,
    status: 'travelling',
    packedGifts: { ...params.packedGifts },
    giftsRemaining: { ...params.packedGifts },
    sessionActions: [],
  };
}

// ─── Gift disposition gain ────────────────────────────────────────────────────

/**
 * Computes how much disposition a gift bundle is worth to a specific tribe.
 *
 * Base rates: gold = 5/unit, goods = 3/unit, food = 1/unit.
 * Modified by:
 *  - Tribe tradeDesires: +50% for any desired resource type.
 *  - Tribe traits: warlike −30%, isolationist −40%, desperate +50%.
 *  - Diminishing returns if gifted within the last 4 turns (same "year"): ×0.5.
 *  - Single-session cap: +40 max.
 */
export function giftDispositionGain(
  gold: number,
  goods: number,
  food: number,
  tribe: ExternalTribe,
  currentTurn: number,
): number {
  if (gold <= 0 && goods <= 0 && food <= 0) return 0;

  let delta = gold * 5 + goods * 3 + food * 1;

  // Desire bonuses
  const desires = new Set(tribe.tradeDesires);
  if (desires.has('gold')  && gold  > 0) delta += Math.floor(gold  * 5 * 0.5);
  if (desires.has('goods') && goods > 0) delta += Math.floor(goods * 3 * 0.5);
  if (desires.has('food')  && food  > 0) delta += Math.floor(food  * 1 * 0.5);

  // Trait modifiers
  if (tribe.traits.includes('warlike'))      delta = Math.floor(delta * 0.7);
  if (tribe.traits.includes('isolationist')) delta = Math.floor(delta * 0.6);
  if (tribe.traits.includes('desperate'))    delta = Math.floor(delta * 1.5);

  // Diminishing returns: gifted within last 4 turns (one in-game year)
  const giftedThisYear = tribe.giftedTurns !== null && (currentTurn - tribe.giftedTurns) < 4;
  if (giftedThisYear) delta = Math.floor(delta * 0.5);

  return Math.min(delta, 40);
}

// ─── Resource request yield ───────────────────────────────────────────────────

/**
 * Computes how much food or goods a tribe will hand over when asked.
 *
 * Formula: floor(population / 40 × dispositionFactor)
 * dispositionFactor = clamp(disposition / 50, 0.2, 1.5)
 *
 * Returns 0 if:
 *  - disposition < 0 (tribe is unfriendly)
 *  - the tribe's tradeDesires include the requested resource (they won't give away what they need)
 */
export function computeResourceRequestYield(
  resource: 'food' | 'goods',
  tribe: ExternalTribe,
): number {
  if (tribe.disposition < 0) return 0;
  if (tribe.tradeDesires.includes(resource)) return 0;

  const dispositionFactor = clamp(tribe.disposition / 50, 0.2, 1.5);
  return Math.floor((tribe.population / 40) * dispositionFactor);
}

// ─── Session resolution ───────────────────────────────────────────────────────

export interface EmissarySessionResult {
  /** Updated tribe state (immutable — caller applies to tribes Map). */
  updatedTribe: ExternalTribe;
  /** Resources to add to settlement.resources immediately. */
  resourcesGained: Partial<ResourceStock>;
  /** Whether diplomacyOpened was set by this session. */
  diplomacyOpened: boolean;
  /** One-way return travel time (turns). */
  returnTravelTurns: number;
}

/**
 * Resolves all session actions and returns the state mutations the store should apply.
 * Pure — no mutations in place.
 */
export function resolveEmissarySession(
  emissary: EmissaryDispatch,
  tribe: ExternalTribe,
  currentTurn: number,
  emissaryBargainingSkill: number,
): EmissarySessionResult {
  let disposition = tribe.disposition;
  let diplomacyOpened = tribe.diplomacyOpened;
  let giftedTurns = tribe.giftedTurns;
  const resourcesGained: Partial<ResourceStock> = {};

  for (const action of emissary.sessionActions) {
    switch (action.type) {
      case 'offer_gifts': {
        // dispositionDelta was pre-computed in the overlay; just apply it.
        disposition = clamp(disposition + action.dispositionDelta, -100, 100);
        giftedTurns = currentTurn;
        break;
      }
      case 'ask_food': {
        const amount = action.resourcesReceived?.food ?? 0;
        if (amount > 0) resourcesGained.food = (resourcesGained.food ?? 0) + amount;
        break;
      }
      case 'ask_goods': {
        const amount = action.resourcesReceived?.goods ?? 0;
        if (amount > 0) resourcesGained.goods = (resourcesGained.goods ?? 0) + amount;
        break;
      }
      case 'propose_trade': {
        if (tribe.disposition >= 20 || tribe.traits.includes('trader')) {
          diplomacyOpened = true;
        }
        break;
      }
      case 'take_leave':
        break;
    }
    // Clamp after every action
    disposition = clamp(disposition, -100, 100);
  }

  const returnTravelTurns = emissaryTravelTime(tribe, emissaryBargainingSkill);

  const updatedTribe: ExternalTribe = {
    ...tribe,
    disposition,
    diplomacyOpened,
    giftedTurns,
  };

  return { updatedTribe, resourcesGained, diplomacyOpened, returnTravelTurns };
}
