/**
 * World domain: expedition and emissary / diplomacy types.
 *
 * game-state.ts re-exports everything for backward compatibility.
 */

import type { ResourceStock } from '../economy/resource-types';

// ─── Expedition ───────────────────────────────────────────────────────────────

export type ExpeditionStatus =
  | 'travelling'  // En route; processing each dawn.
  | 'returning'   // Heading back to settlement.
  | 'completed'   // Returned; outcome delivered.
  | 'lost';       // All members dead or party collapsed.

export interface ExpeditionWaypoint {
  q: number;
  r: number;
  /** Estimated turn of arrival (informational only). */
  estimatedArrivalTurn: number;
}

export interface ExpeditionDeferredEvent {
  firesOnTurn: number;
  eventId: string;
  expeditionId: string;
  boundActors: Record<string, string>;
  expeditionContext: { expeditionId: string; hex: { q: number; r: number } };
}

export interface ExpeditionJournalEntry {
  turn: number;
  text: string;
}

export interface Expedition {
  id: string;
  /**
   * Display name. Auto-generated as "{Leader}'s Expedition", "{Leader}'s Second
   * Expedition", etc. Player can rename before dispatch.
   */
  name: string;
  leaderId: string;
  memberIds: string[];
  /**
   * Whether the party took a boat from the settlement pool.
   * One boat is available from game start; more require a built dock.
   */
  hasBoat: boolean;
  provisions: {
    food: number;
    goods: number;
    gold: number;
    medicine: number;
  };
  currentQ: number;
  currentR: number;
  /** Primary destination hex coordinates. */
  destinationQ: number;
  destinationR: number;
  waypoints: ExpeditionWaypoint[];
  visitedHexes: Array<{ q: number; r: number; turn: number }>;
  status: ExpeditionStatus;
  dispatchedTurn: number;
  resolvedTurn: number | null;
  /**
   * Seasons of travel progress remaining before the party enters the next hex.
   * Decrements by 1 each dawn. Enters next hex when it reaches 0.
   */
  travelProgress: number;
  foodRemaining: number;
  goodsRemaining: number;
  goldRemaining: number;
  medicineRemaining: number;
  /** Set to `true` once the food-low warning event has been queued, so it fires only once. */
  firedFoodLowWarning: boolean;
  pendingExpeditionEvents: ExpeditionDeferredEvent[];
  journal: ExpeditionJournalEntry[];
}

// ─── Emissary / Diplomacy ─────────────────────────────────────────────────────

export type EmissaryMissionType =
  | 'open_relations'   // Primary: sets diplomacyOpened on success
  | 'gift_giving'      // Purely improve disposition; no strings attached
  | 'request_food'     // Ask for a food grant from the tribe
  | 'request_goods';   // Ask for a goods grant from the tribe

export interface EmissaryGiftBundle {
  wealth: number;
  food: number;
}

export interface EmissarySessionAction {
  type:
    | 'offer_gifts'     // Expends from giftsRemaining; +disposition
    | 'ask_food'        // Request food from tribe
    | 'ask_goods'       // Request goods from tribe
    | 'propose_trade'   // Sets diplomacyOpened; disposition-gated
    | 'take_leave';     // Concludes the session
  /** For offer_gifts: actual amounts the player chose to offer. */
  giftsOffered?: Partial<EmissaryGiftBundle>;
  /** For ask_food / ask_goods: how much was received. */
  resourcesReceived?: Partial<ResourceStock>;
  /** Net disposition change applied by this action. */
  dispositionDelta: number;
  /** Narrative line for the session log. */
  logEntry: string;
}

export interface EmissaryDispatch {
  id: string;
  tribeId: string;
  /** Person ID of the emissary. Their role is set to 'away' on dispatch. */
  emissaryId: string;
  missionType: EmissaryMissionType;
  dispatchedTurn: number;
  /** Turn on which the emissary arrives at the tribe. */
  arrivalTurn: number;
  /** Turn on which the emissary returns home. Set when the session ends. */
  returnTurn: number | null;
  status: 'travelling' | 'at_tribe' | 'returning' | 'completed';
  /** Resources packed at dispatch (never changes after dispatch). */
  packedGifts: EmissaryGiftBundle;
  /** Resources still available to spend during the session. */
  giftsRemaining: EmissaryGiftBundle;
  /** Ordered list of actions taken during the diplomacy session. */
  sessionActions: EmissarySessionAction[];
}
