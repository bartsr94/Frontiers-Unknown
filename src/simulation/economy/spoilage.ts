/**
 * Resource spoilage mechanics.
 *
 * Spoilage fires during processDawn() so the player sees losses at the start
 * of their turn. Rates are gentle enough to ignore at small stocks but
 * significant enough to reward active management of large surpluses.
 *
 * Pure logic — no React, no DOM, no store imports.
 * Source: ECONOMY_SYSTEM.md §5.
 */

import type { ResourceType, ResourceStock, Season } from '../turn/game-state';
import type { BuiltBuilding } from '../turn/game-state';
import { hasBuilding } from '../buildings/building-effects';

// ─── Spoilage Rate Config ─────────────────────────────────────────────────────

/** Per-resource spoilage configuration. */
interface SpoilageConfig {
  /** Base fractional loss per season (e.g., 0.05 = 5%). */
  baseRate: number;
  /** Multiplier applied in a given season (1.0 = no change). */
  seasonModifiers: Partial<Record<Season, number>>;
  /** Building ID that halves the spoilage rate when present. null = no mitigation. */
  mitigatedBy: 'granary' | 'stable' | null;
}

export const SPOILAGE_CONFIG: Record<ResourceType, SpoilageConfig | null> = {
  food:     { baseRate: 0.05, seasonModifiers: { summer: 1.5 },            mitigatedBy: 'granary' },
  cattle:   { baseRate: 0.03, seasonModifiers: { winter: 2.0 },            mitigatedBy: 'stable'  },
  horses:   { baseRate: 0.02, seasonModifiers: { winter: 2.0 },            mitigatedBy: 'stable'  },
  medicine: { baseRate: 0.02, seasonModifiers: {},                          mitigatedBy: null      },
  wealth:   { baseRate: 0.01, seasonModifiers: {},                          mitigatedBy: null      },
  // Non-perishable — no spoilage.
  steel:    null,
  lumber:   null,
  stone:    null,
};

// ─── Calculation ──────────────────────────────────────────────────────────────

/**
 * Calculates the spoilage losses for the current season.
 *
 * Rules per ECONOMY_SYSTEM.md §5.2:
 * - Loss is ignored if it would remove < 1 unit (no fractional deductions).
 * - Loss is capped so the stock never goes below 0.
 * - Granary halves food spoilage; Stable halves cattle & horse spoilage.
 *
 * @param resources - Current resource stockpile.
 * @param season - Current season.
 * @param buildings - Current standing buildings (checked for Granary / Stable).
 * @returns A partial record of losses (positive amounts to subtract from stock).
 *          Resources with zero or no spoilage are omitted from the result.
 */
export function calculateSpoilage(
  resources: ResourceStock,
  season: Season,
  buildings: BuiltBuilding[],
): Partial<ResourceStock> {
  const losses: Partial<ResourceStock> = {};

  for (const [res, config] of Object.entries(SPOILAGE_CONFIG) as [ResourceType, SpoilageConfig | null][]) {
    if (!config) continue;

    const stock = resources[res];
    if (stock <= 0) continue;

    let rate = config.baseRate;

    // Apply seasonal modifier.
    const seasonMod = config.seasonModifiers[season] ?? 1.0;
    rate *= seasonMod;

    // Apply building mitigation (halves the rate).
    if (config.mitigatedBy && hasBuilding(buildings, config.mitigatedBy)) {
      rate *= 0.5;
    }

    const rawLoss = stock * rate;

    // Ignore if loss < 1 unit (minimum loss rule).
    if (rawLoss < 1) continue;

    // Cap at available stock.
    const actualLoss = Math.min(Math.floor(rawLoss), stock);
    if (actualLoss > 0) {
      losses[res] = actualLoss;
    }
  }

  return losses;
}

/**
 * Applies spoilage losses to a resource stock.
 * Returns a new stock with the losses subtracted (floored at 0).
 *
 * @param resources - Current stockpile.
 * @param spoilage - Losses from calculateSpoilage().
 */
export function applySpoilage(
  resources: ResourceStock,
  spoilage: Partial<ResourceStock>,
): ResourceStock {
  const updated = { ...resources };
  for (const [res, loss] of Object.entries(spoilage) as [ResourceType, number][]) {
    updated[res] = Math.max(0, updated[res] - loss);
  }
  return updated;
}
