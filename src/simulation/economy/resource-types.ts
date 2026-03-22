/**
 * Economy domain: resource type identifiers and the settlement's resource stock.
 *
 * These types are the foundation of the economy system. They are imported by
 * nearly every economy module and world module; living here (rather than
 * game-state.ts) keeps the import graph domain-aligned.
 *
 * game-state.ts re-exports everything for backward compatibility.
 */

// ─── Resource Types ───────────────────────────────────────────────────────────

/**
 * The resource types tracked by the settlement economy.
 * Food, cattle, and wealth are the primary early-game resources; the rest unlock
 * as the settlement grows and trade relationships develop.
 *
 * cattle  — herd animals; produce a food bonus each season (1 food per 2 cattle)
 * wealth  — accumulated material value: tools, cloth, pots, trade credit (replaces gold + goods)
 * horses  — mounts and draft animals; distinct from cattle (acquired, not farmed)
 */
export type ResourceType =
  | 'food'
  | 'cattle'
  | 'wealth'
  | 'steel'
  | 'lumber'
  | 'stone'
  | 'medicine'
  | 'horses';

/** A complete snapshot of the settlement's current resource stockpile. */
export type ResourceStock = Record<ResourceType, number>;

// ─── Company Relation ────────────────────────────────────────────────────────

/** The Ansberry Company's current level of support for the settlement. */
export type CompanySupportLevel =
  | 'full_support'  // Consistent quota surplus — bonuses and priority supply
  | 'standard'      // Default operating relationship
  | 'reduced'       // One missed quota — reduced supply shipments
  | 'minimal'       // Repeated failures — almost no support
  | 'abandoned';    // Settlement written off — no further Company resources

/**
 * The result of the annual autumn quota check.
 * Drives the Company's support-level escalation mechanics.
 */
export type QuotaStatus = 'exceeded' | 'met' | 'partial' | 'failed';

/**
 * All state related to the settlement's relationship with the Ansberry Company.
 * The Company is the player's primary external patron and demand source.
 */
export interface CompanyRelation {
  /**
   * Overall standing score (0–100). Starts at 60.
   * Above 80: bonuses and preferred supply. Below 40: inspector dispatched.
   * At 0: Company formally abandons the settlement.
   */
  standing: number;
  /** Wealth required to meet the current annual quota. Increases from year 11. */
  annualQuotaWealth: number;
  /**
   * Number of consecutive annual quotas missed. Resets to 0 on a successful year.
   * Drive the Company's escalating consequences.
   */
  consecutiveFailures: number;
  /** Current support tier, determined by standing and failure history. */
  supportLevel: CompanySupportLevel;
  /** How many in-game years the Company expedition has been active in the region. */
  yearsActive: number;
  /** Wealth contributed toward the current year's quota so far. Resets each Spring. */
  quotaContributedWealth: number;
  /**
   * Multiplier (0.0–1.0) applied to every annual supply delivery, set once at game
   * start from the settlement's founding location along the Kethani River.
   *
   * kethani_mouth = 1.0 (full delivery) → kethani_headwaters = 0.15 (barely any).
   * Existing saves default to 1.0 so they don't suddenly lose supply.
   */
  locationSupplyModifier: number;
}
