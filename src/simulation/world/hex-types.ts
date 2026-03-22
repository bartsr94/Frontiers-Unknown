/**
 * World domain: hex map types.
 *
 * game-state.ts re-exports everything for backward compatibility.
 */

import type { ResourceType } from '../economy/resource-types';

// ─── Location ─────────────────────────────────────────────────────────────────

/**
 * A location identifier for the settlement on the regional map.
 * Will expand to a richer structured type when the map system is built in Phase 3.
 */
export type LocationId = string;

// ─── Hex Map ──────────────────────────────────────────────────────────────────

/**
 * The terrain type of a hex cell. Determines travel speed and encounter risks.
 */
export type TerrainType =
  | 'plains'     // Open grassland. Fast: 4 hexes/season.
  | 'forest'     // Dense woodland. 2 hexes/season.
  | 'jungle'     // Thick growth. 1 hex/season.
  | 'hills'      // Rough terrain. 1 hex/season.
  | 'mountains'  // Near-impassable. 0.5 hexes/season (2 seasons/hex).
  | 'river'      // Waterway. 6 hexes/season with boat; 1 on foot.
  | 'wetlands'   // Marshes. 1 hex/season + disease risk.
  | 'coast'      // Shore. 2 hexes/season.
  | 'desert';    // Arid. 1 hex/season + 2× food cost.

/**
 * What a hex can contain. One-time discoveries fire a unique event the first
 * time the hex is entered; recurring types roll every visit.
 */
export type HexContentType =
  // ── One-time discoveries ─────────────────────────────────────────────────
  | 'ruins'              // Ancient structure — unique narrative event.
  | 'landmark'           // Named geographic feature.
  | 'resource_cache'     // One-time gather: food / stone / lumber / gold / medicine.
  | 'hidden_shrine'      // Religious lore discovery.
  | 'abandoned_camp'     // Previous settlers; possible supply cache.
  | 'burial_ground'      // Sauromatian sacred site; disposition effects.
  | 'fresh_water_spring' // Marks hex as reduced food-cost for future expeditions.
  | 'old_road'           // Increases travel speed through adjacent hexes.
  // ── Tribe territory ─────────────────────────────────────────────────────
  | 'tribe_territory'    // Hex patrolled by a named tribe.
  | 'tribe_outpost'      // Semi-permanent camp; higher encounter chance.
  | 'tribe_settlement'   // Major settlement; guaranteed contact on entry.
  // ── Recurring encounters ────────────────────────────────────────────────
  | 'travellers'         // Passing strangers. Rolls each visit.
  | 'animal_den'         // Wildlife. Rolls each visit.
  | 'bandit_camp'        // Hostile non-tribal presence. Can be cleared.
  | 'disease_vector'     // Wetland illness risk. Rolls each season spent here.
  | 'weather_hazard';    // Exposed terrain risk. Season-dependent.

/** A single point of interest within a hex cell. */
export interface HexContent {
  type: HexContentType;
  /** For tribe_territory / tribe_outpost / tribe_settlement. */
  tribeId?: string;
  /** For resource_cache. */
  resourceType?: ResourceType;
  resourceAmount?: number;
  /** True once the one-time discovery has been collected or the event has fired. */
  discovered: boolean;
  /** Custom label for landmarks, ruins, etc. */
  label?: string;
}

/**
 * A single cell on the hex map. Uses axial coordinates (q, r).
 */
export interface HexCell {
  /** Axial column co-ordinate. */
  q: number;
  /** Axial row co-ordinate. */
  r: number;
  terrain: TerrainType;
  /**
   * Visibility state:
   * 'fog'      — never visited; terrain unknown.
   * 'scouted'  — adjacent reveal; terrain known, contents not.
   * 'visited'  — expedition entered this hex.
   * 'cleared'  — all one-time content exhausted; only recurring encounters remain.
   */
  visibility: 'fog' | 'scouted' | 'visited' | 'cleared';
  contents: HexContent[];
  /** Turn on which this hex was first physically entered. null if never visited. */
  firstVisitedTurn: number | null;
  /** Optional display label (landmarks, tribe territory, etc.). */
  label?: string;
}

/**
 * The full hex map of the Ashmark. Cells are keyed by `"${q},${r}"` for O(1) lookup.
 * Serialised as `[string, HexCell][]` for JSON storage.
 */
export interface HexMap {
  width: number;
  height: number;
  cells: Map<string, HexCell>;
  /** Axial co-ordinates of the player's settlement hex (always the centre cell). */
  settlementQ: number;
  settlementR: number;
}
