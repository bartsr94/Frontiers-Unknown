/**
 * Economy — resource production and consumption.
 *
 * Pure calculation functions that return resource deltas each turn.
 * The Zustand store applies these deltas to the settlement's resource stock.
 *
 * Phase 1 rules (simplified):
 *   - Every person consumes 1 food per season.
 *   - Farmers produce 3 food per season.
 *   - Traders produce 1 good per season.
 *   - Every 2 cattle produce 1 food per season (dairy/butchery bonus).
 *   - All other roles produce nothing.
 *
 * Phase 3 will expand this to all resource types, seasonal modifiers,
 * building bonuses, Company quota contributions, and trade calculations.
 */

import type { Person } from '../population/person';
import type { Settlement, ResourceType, ResourceStock, Season } from '../turn/game-state';
import { SEASON_MODIFIERS } from '../turn/season';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Returns a ResourceStock with every resource type set to 0.
 * Useful as a starting point for accumulating deltas.
 */
export function emptyResourceStock(): ResourceStock {
  return {
    food: 0,
    cattle: 0,
    goods: 0,
    steel: 0,
    lumber: 0,
    stone: 0,
    medicine: 0,
    gold: 0,
    horses: 0,
  };
}

/**
 * Adds two ResourceStocks together component-wise.
 * Does not clamp — caller is responsible for negative stock handling.
 */
export function addResourceStocks(a: ResourceStock, b: ResourceStock): ResourceStock {
  const result = emptyResourceStock();
  for (const key of Object.keys(result) as ResourceType[]) {
    result[key] = a[key] + b[key];
  }
  return result;
}

/**
 * Clamps all values in a ResourceStock to be ≥ 0.
 * Applied after consumption to prevent negative stockpiles.
 */
export function clampResourceStock(stock: ResourceStock): ResourceStock {
  const result = emptyResourceStock();
  for (const key of Object.keys(result) as ResourceType[]) {
    result[key] = Math.max(0, stock[key]);
  }
  return result;
}

// ─── Production ───────────────────────────────────────────────────────────────

/**
 * Calculates the total resource production for this season based on
 * the current population's work roles, the settlement's cattle herd,
 * and the settlement's buildings.
 *
 * Phase 1 rules:
 *   - farmers → +3 food each, scaled by seasonal foodProduction modifier
 *   - traders → +1 goods each, scaled by seasonal goodsProduction modifier
 *   - cattle  → +1 food per 2 head, also scaled by foodProduction modifier
 *   - guard, craftsman, healer, unassigned → 0
 *
 * @param people - All living people in the settlement.
 * @param settlement - Current settlement state (used for cattle count).
 * @param season - Current season; modifiers are applied from SEASON_MODIFIERS.
 * @returns A ResourceStock containing positive deltas to apply to the stockpile.
 */
export function calculateProduction(
  people: Map<string, Person>,
  settlement: Settlement,
  season: Season,
): ResourceStock {
  const mods = SEASON_MODIFIERS[season];

  // Accumulate base worker production.
  let baseFood = 0;
  let baseGoods = 0;

  for (const person of people.values()) {
    switch (person.role) {
      case 'farmer':  baseFood  += 3; break;
      case 'trader':  baseGoods += 1; break;
      // guard, craftsman, healer, unassigned: no production in Phase 1
    }
  }

  // Cattle food bonus: every 2 cattle produce 1 food (dairy/butchery), also seasonal.
  const cattleBonus = Math.floor(settlement.resources.cattle / 2);

  const delta = emptyResourceStock();
  delta.food  = Math.floor((baseFood + cattleBonus) * mods.foodProduction);
  delta.goods = Math.floor(baseGoods * mods.goodsProduction);

  return delta;
}

// ─── Consumption ─────────────────────────────────────────────────────────────

/**
 * Calculates the total resource consumption for this season based on
 * the population size.
 *
 * Phase 1 rule: every person eats 1 food per season regardless of role.
 * Returns negative deltas ready to be added to the resource stock.
 *
 * @param people - All living people in the settlement.
 * @returns A ResourceStock containing negative deltas (food cost of the population).
 */
export function calculateConsumption(people: Map<string, Person>): ResourceStock {
  const delta = emptyResourceStock();
  delta.food = -people.size;
  return delta;
}
