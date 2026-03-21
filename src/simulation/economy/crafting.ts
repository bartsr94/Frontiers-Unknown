/**
 * Crafting chain recipes and execution logic.
 *
 * Crafting lets the player convert surplus resources into more valuable ones
 * during the Management phase. All recipes are instant (resolved on Execute,
 * not at next dawn — the design doc notes "turnsToComplete: 1" but in
 * practice the store applies them immediately for responsiveness).
 *
 * Pure logic — no React, no DOM, no store imports.
 * Source: ECONOMY_SYSTEM.md §6.
 */

import type { ResourceType, ResourceStock, BuildingId } from '../turn/game-state';
import type { BuiltBuilding } from '../turn/game-state';
import { hasBuilding } from '../buildings/building-effects';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CraftRecipeId =
  | 'craft_cattle_slaughter'
  | 'craft_horse_breeding'
  | 'craft_medicine_prep'
  | 'craft_boat';

export interface CraftRecipe {
  id: CraftRecipeId;
  label: string;
  description: string;
  requires: {
    /** All listed buildings must be standing. */
    buildings: BuildingId[];
    /** All listed resources must be available in the quantities specified. */
    resources: Partial<Record<ResourceType, number>>;
  };
  produces: Partial<Record<ResourceType, number>>;
}

/** Result of validateCraft(). Discriminated by `ok`. */
export type CraftValidation =
  | { ok: true }
  | { ok: false; reason: string };

// ─── Recipe Definitions ───────────────────────────────────────────────────────

export const CRAFT_RECIPES: Record<CraftRecipeId, CraftRecipe> = {
  craft_cattle_slaughter: {
    id: 'craft_cattle_slaughter',
    label: 'Slaughter Cattle',
    description: 'Butcher excess cattle for preserved meat and hides.',
    requires: {
      buildings: [],
      resources: { cattle: 2 },
    },
    produces: { food: 3 },
  },

  craft_horse_breeding: {
    id: 'craft_horse_breeding',
    label: 'Horse Breeding Program',
    description: 'Maintain a breeding pair at the Stable to steadily grow your herd.',
    requires: {
      buildings: ['stable'],
      resources: { horses: 2, food: 4 },
    },
    produces: { horses: 1 },
  },

  craft_medicine_prep: {
    id: 'craft_medicine_prep',
    label: 'Prepare Medicines',
    description: "The healer converts food stores and trade credit into refined medicines.",
    requires: {
      buildings: ['healers_hut'],
      resources: { food: 3, wealth: 2 },
    },
    produces: { medicine: 4 },
  },

  craft_boat: {
    id: 'craft_boat',
    label: 'Build River Boat',
    description: 'Construct a shallow-draft river boat at the dock. Boats dramatically increase expedition speed along river hexes and allow safe coastal travel.',
    requires: {
      buildings: ['dock'] as BuildingId[],
      resources: { lumber: 15 },
    },
    produces: {},
  },
};

// ─── Availability ─────────────────────────────────────────────────────────────

/**
 * Returns all recipes that are available given current buildings and resources.
 *
 * A recipe is available if:
 * 1. All required buildings are in the settlement.
 * 2. At least 1 unit of every required resource is in stock
 *    (the exact deficit is caught at validation time).
 *
 * @param buildings - Current standing buildings.
 * @param resources - Current resource stockpile.
 */
export function getAvailableCrafts(
  buildings: BuiltBuilding[],
  resources: ResourceStock,
): CraftRecipe[] {
  return Object.values(CRAFT_RECIPES).filter(recipe => {
    // Check building requirements.
    for (const reqBld of recipe.requires.buildings) {
      if (!hasBuilding(buildings, reqBld)) return false;
    }
    // Check at least 1 of each required resource is present.
    for (const [res, qty] of Object.entries(recipe.requires.resources) as [ResourceType, number][]) {
      if (resources[res] < 1 || qty === undefined) {
        // If required qty is defined, check at least 1 is available.
        if ((qty ?? 0) > 0 && resources[res] < 1) return false;
      }
    }
    return true;
  });
}

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * Validates that a specific recipe can be executed with the current state.
 *
 * Checks:
 * 1. Recipe exists.
 * 2. All required buildings are present.
 * 3. All required resources meet the exact quantity.
 *
 * @param recipeId - The recipe to validate.
 * @param buildings - Current standing buildings.
 * @param resources - Current resource stockpile.
 */
export function validateCraft(
  recipeId: CraftRecipeId,
  buildings: BuiltBuilding[],
  resources: ResourceStock,
): CraftValidation {
  const recipe = CRAFT_RECIPES[recipeId];
  if (!recipe) return { ok: false, reason: 'Unknown recipe.' };

  for (const reqBld of recipe.requires.buildings) {
    if (!hasBuilding(buildings, reqBld)) {
      return { ok: false, reason: `Requires a ${reqBld} to craft.` };
    }
  }

  for (const [res, qty] of Object.entries(recipe.requires.resources) as [ResourceType, number][]) {
    if (resources[res] < qty) {
      return {
        ok: false,
        reason: `Insufficient ${res}: need ${qty}, have ${resources[res]}.`,
      };
    }
  }

  return { ok: true };
}

// ─── Application ─────────────────────────────────────────────────────────────

/**
 * Applies a crafting recipe to a resource stock.
 *
 * Prerequisites: validateCraft() must have returned `{ ok: true }` before calling this.
 * Does NOT mutate the input — returns a new ResourceStock.
 *
 * @param recipeId - The recipe to apply.
 * @param resources - Current resource stockpile.
 */
export function applyCraft(
  recipeId: CraftRecipeId,
  resources: ResourceStock,
): ResourceStock {
  const recipe = CRAFT_RECIPES[recipeId];
  const updated = { ...resources };

  // Deduct inputs.
  for (const [res, qty] of Object.entries(recipe.requires.resources) as [ResourceType, number][]) {
    updated[res] = Math.max(0, updated[res] - qty);
  }

  // Add outputs.
  for (const [res, qty] of Object.entries(recipe.produces) as [ResourceType, number][]) {
    updated[res] = updated[res] + qty;
  }

  return updated;
}
