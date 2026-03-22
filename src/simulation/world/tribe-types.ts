/**
 * World domain: external tribe types.
 *
 * game-state.ts re-exports everything for backward compatibility.
 */

import type { EthnicGroup } from '../culture/culture-ids';
import type { ResourceType } from '../economy/resource-types';

// ─── Tribes ───────────────────────────────────────────────────────────────────

/** Behavioural trait of a neighbouring tribe, influencing its AI decision-making. */
export type TribeTrait =
  | 'warlike'
  | 'peaceful'
  | 'isolationist'
  | 'trader'
  | 'expansionist'
  | 'desperate';

/** Resources or concessions a tribe wants from the player settlement. */
export type TribeDesire = 'steel' | 'medicine' | 'alliance' | 'men' | 'territory' | 'trade' | 'food' | 'wealth' | 'lumber';

/** Resources or concessions a tribe can offer in trade or alliance. */
export type TribeOffering =
  | 'food'
  | 'horses'
  | 'furs'
  | 'herbs'
  | 'warriors'
  | 'wives'
  | 'knowledge'
  | 'pearls'
  | 'trade_goods'
  | 'stone'
  | 'steel';

/**
 * A neighbouring Sauromatian tribe that exists in the region.
 * Tribes act autonomously — they raid, trade, migrate, and respond to world events.
 */
export interface ExternalTribe {
  /** Unique identifier. */
  id: string;
  /** Display name. */
  name: string;
  /** The ethnic subgroup this tribe belongs to. */
  ethnicGroup: EthnicGroup;
  /** Approximate population size. */
  population: number;
  /**
   * Current disposition toward the player settlement: -100 (hostile) to +100 (allied).
   * Starts near 0 and shifts based on player actions and random world events.
   */
  disposition: number;
  /** Behavioural traits that influence the tribe's AI logic. */
  traits: TribeTrait[];
  /** What this tribe wants from the settlement (drives trade and diplomacy events). */
  desires: TribeDesire[];
  /** What this tribe can offer in exchange. */
  offerings: TribeOffering[];
  /**
   * Internal stability (0.0–1.0). Low stability makes the tribe more prone to
   * raiding, fragmentation, or accepting desperate bargains.
   */
  stability: number;
  /** Whether the player has made first contact with this tribe. Required for direct trade. */
  contactEstablished: boolean;
  /** Turn number of the most recent completed trade. null if no trades yet. */
  lastTradeTurn: number | null;
  /** Cumulative completed trade count. Used for disposition bonuses. */
  tradeHistoryCount: number;
  /** Resources this tribe actively wants to buy (drives premium pricing). */
  tradeDesires: ResourceType[];
  /** Resources this tribe has available to sell. */
  tradeOfferings: ResourceType[];
  /**
   * Whether an expedition has entered this tribe's territory hex. The tribe
   * becomes visible in the Known Clans list as "Sighted" (with ??? name)
   * but full details are hidden until contactEstablished is set.
   */
  sighted: boolean;
  /**
   * Whether formal diplomatic channels have been opened with this tribe (beyond
   * mere first contact). Set by expedition events or the emissary system.
   */
  diplomacyOpened: boolean;
  /**
   * Turn on which the player last offered gifts to this tribe via the emissary
   * system. Used for the diminishing-returns calculation (same year = ×0.5).
   * null if no gifts have ever been given.
   */
  giftedTurns: number | null;
  /**
   * Axial q-coordinate of the hex this tribe's territory is centred on.
   * null until the tribe appears on the hex map during world gen.
   */
  territoryQ: number | null;
  /**
   * Axial r-coordinate of the hex this tribe's territory is centred on.
   * null until the tribe appears on the hex map during world gen.
   */
  territoryR: number | null;
}
