/**
 * Economy — resource production and consumption.
 *
 * Pure calculation functions that return resource deltas each turn.
 * The Zustand store applies these deltas to the settlement's resource stock.
 *
 * Production rules:
 *   - Farmers produce 3 food per season (seasonal modifier applies).
 *   - Traders produce 1 good per season (seasonal modifier applies).
 *   - Every 2 cattle produce 1 food per season (dairy/butchery bonus, seasonal).
 *   - guard, craftsman, healer, unassigned → base 0 (buildings add role bonuses).
 *   - Buildings add flat and per-role bonuses on top of role-based production.
 *   - Overcrowding reduces all production by 10% when ratio > 1.25.
 */

import type { Person } from '../population/person';
import type { Settlement, ResourceType, ResourceStock, Season, BuiltBuilding } from '../turn/game-state';
import { SEASON_MODIFIERS } from '../turn/season';
import {
  getBuildingFlatProductionBonus,
  getRoleProductionBonus,
  getOvercrowdingProductionMultiplier,
} from '../buildings/building-effects';

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
 * seasonal modifiers, and active buildings.
 *
 * Production rules:
 *   - farmers → +3 food each, scaled by seasonal foodProduction modifier
 *   - traders → +1 goods each, scaled by seasonal goodsProduction modifier
 *   - cattle  → +1 food per 2 head, also scaled by foodProduction modifier
 *   - buildings add flat bonuses (e.g. Granary +2 food) and per-role bonuses
 *     (e.g. Workshop +1 goods per craftsman)
 *   - overcrowding > 1.25 reduces all production by 10%
 *
 * @param people - All living people in the settlement.
 * @param settlement - Current settlement state (cattle + buildings).
 * @param season - Current season; modifiers are applied from SEASON_MODIFIERS.
 * @param overcrowdingRatio - Current population/shelter ratio for penalty calc.
 * @returns A ResourceStock containing positive deltas to apply to the stockpile.
 */
/**
 * Maps a raw skill value (1–100) to a gather yield of 1–3 units per season.
 * Base yield is 1; +1 at Good (26+); +1 more at Excellent (63+).
 */
function gatherYield(skill: number): number {
  if (skill >= 63) return 3;
  if (skill >= 26) return 2;
  return 1;
}

export function calculateProduction(
  people: Map<string, Person>,
  settlement: Settlement,
  season: Season,
  overcrowdingRatio: number = 1.0,
  happinessMultipliers: Map<string, number> = new Map(),
): ResourceStock {
  const mods = SEASON_MODIFIERS[season];
  const buildings: BuiltBuilding[] = settlement.buildings;

  // ── Base role production ──────────────────────────────────────────────────
  const delta = emptyResourceStock();

  for (const person of people.values()) {
    // Per-person happiness multiplier (1.0 when not in the map = neutral mood).
    const happMult = happinessMultipliers.get(person.id) ?? 1.0;

    // Base production by role (seasonal modifiers applied below).
    let personFood = 0;
    let personGoods = 0;
    switch (person.role) {
      // Without Tilled Fields, farmers are only as productive as unskilled
      // foragers. Fields add +2 food/farmer via roleProductionBonus below.
      case 'farmer':        personFood   = 1; break;
      case 'trader':        personGoods  = 1; break;
      // gather_food is seasonally scaled like farming
      case 'gather_food':   personFood   = gatherYield(person.skills.plants); break;
      // gather_stone / gather_lumber are NOT seasonally scaled — accumulated directly
      case 'gather_stone':  delta.stone  += Math.floor(gatherYield(person.skills.custom) * happMult); break;
      case 'gather_lumber': delta.lumber += Math.floor(gatherYield(person.skills.custom) * happMult); break;
      case 'craftsman':
      case 'healer':
      case 'guard':
      case 'builder':
      case 'away':
      case 'unassigned': break;
    }

    // Per-role building bonuses (not seasonally scaled — steady workshop output).
    const roleBonus = getRoleProductionBonus(buildings, person.role);
    personGoods += roleBonus.goods ?? 0;
    personFood  += roleBonus.food  ?? 0;

    // Apply happiness multiplier to this person's food and goods contribution.
    delta.food  += personFood  * happMult;
    delta.goods += personGoods * happMult;
  }

  // Apply seasonal modifiers to accumulated food and goods.
  delta.food  = Math.floor(delta.food  * mods.foodProduction);
  delta.goods = Math.floor(delta.goods * mods.goodsProduction);

  // Cattle food bonus: every 2 cattle produce 1 food (dairy/butchery), seasonal.
  const cattleBonus = Math.floor(settlement.resources.cattle / 2);
  delta.food += Math.floor(cattleBonus * mods.foodProduction);

  // ── Flat building bonuses ────────────────────────────────────────────────
  const flatBonus = getBuildingFlatProductionBonus(buildings);
  for (const [key, value] of Object.entries(flatBonus) as [keyof ResourceStock, number][]) {
    delta[key] += value;
  }

  // ── Horse breeding from Stable ───────────────────────────────────────────
  // flatProductionBonus: { horses: 1 } on Stable is already included above.

  // ── Overcrowding production penalty ─────────────────────────────────────
  const productionMult = getOvercrowdingProductionMultiplier(overcrowdingRatio);
  if (productionMult < 1.0) {
    delta.food  = Math.floor(delta.food  * productionMult);
    delta.goods = Math.floor(delta.goods * productionMult);
  }

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
