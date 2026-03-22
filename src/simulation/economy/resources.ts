/**
 * Economy — resource production and consumption.
 *
 * Pure calculation functions that return resource deltas each turn.
 * The Zustand store applies these deltas to the settlement's resource stock.
 *
 * Production rules:
 *   - Farmers produce 1 food per season (seasonal modifier applies) + 2 from Tilled Fields.
 *   - Every 2 cattle produce 1 food per season (dairy/butchery bonus, seasonal).
 *   - guard, craftsman, healer, unassigned → base 0 (buildings add role bonuses).
 *   - Buildings add flat and per-role bonuses on top of role-based production.
 *   - Overcrowding reduces all production by 10% when ratio > 1.25.
 * Wealth generation is a separate pass via calculateWealthGeneration().
 */

import { type Person, type WorkRole, getChildWorkModifier } from '../population/person';
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
    wealth: 0,
    steel: 0,
    lumber: 0,
    stone: 0,
    medicine: 0,
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
 *   - farmers → +1 food each, scaled by seasonal foodProduction modifier
 *              (Fields building adds +2 food/farmer via roleProductionBonus)
 *   - gather_food → 1–3 food scaled by plants skill, seasonal
 *   - hunter → 1–3 food scaled by combat skill, seasonal
 *   - cattle  → +1 food per 2 head, also scaled by foodProduction modifier
 *   - buildings add flat bonuses and per-role bonuses
 *   - overcrowding > 1.25 reduces all production by 10%
 * Wealth generation is handled separately by calculateWealthGeneration().
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

  // Pre-split buildings for scoped roleProductionBonus.
  // Communal buildings (ownerHouseholdId === null) benefit every worker.
  // Household-owned buildings only boost their own household's members.
  const communalBuildings = buildings.filter(b => b.ownerHouseholdId === null);
  const householdBuildingsMap = new Map<string, BuiltBuilding[]>();
  for (const b of buildings) {
    if (b.ownerHouseholdId !== null) {
      const existing = householdBuildingsMap.get(b.ownerHouseholdId) ?? [];
      existing.push(b);
      householdBuildingsMap.set(b.ownerHouseholdId, existing);
    }
  }

  // ── Base role production ──────────────────────────────────────────────────
  const delta = emptyResourceStock();

  for (const person of people.values()) {
    // Per-person happiness multiplier (1.0 when not in the map = neutral mood).
    const happMult = happinessMultipliers.get(person.id) ?? 1.0;
    // Children under 8 cannot work; ages 8–12 work at 50% capacity.
    const effectiveMult = happMult * getChildWorkModifier(person.age);
    if (effectiveMult === 0) continue;

    // Base production by role (seasonal modifiers applied below).
    let personFood = 0;
    let personWealth = 0;
    switch (person.role) {
      // Without Tilled Fields, farmers are only as productive as unskilled
      // foragers. Fields add +2 food/farmer via roleProductionBonus below.
      case 'farmer':        personFood    = 1; break;
      case 'trader':        personWealth  = 1; break;
      // gather_food is seasonally scaled like farming
      case 'gather_food':   personFood   = gatherYield(person.skills.plants); break;
      // hunter produces food via combat skill — seasonally scaled like gather_food; goods come from building bonuses
      case 'hunter':        personFood   = gatherYield(person.skills.combat); break;
      // gather_stone / gather_lumber are NOT seasonally scaled — accumulated directly
      case 'gather_stone':  delta.stone  += Math.floor(gatherYield(person.skills.custom) * effectiveMult); break;
      case 'gather_lumber': delta.lumber += Math.floor(gatherYield(person.skills.custom) * effectiveMult); break;
      case 'craftsman':
      case 'healer':
      case 'guard':
      case 'builder':
      case 'away':
      case 'keth_thara':
      case 'priest_solar':
      case 'wheel_singer':
      case 'voice_of_wheel':
      // Specialists \u2014 base contribution is 0; building roleProductionBonus adds all yield.
      case 'blacksmith':
      case 'tailor':
      case 'brewer':
      case 'miller':
      case 'herder':
      case 'bathhouse_attendant':
      case 'child':
      case 'unassigned': break;
    }

    // Per-role building bonuses — scoped to communal buildings plus this person's
    // own household buildings only (prevents private buildings from stacking
    // production benefit across all workers in the settlement).
    const ownHouseholdBuildings = person.householdId
      ? (householdBuildingsMap.get(person.householdId) ?? [])
      : [];
    const roleBonus = getRoleProductionBonus(
      [...communalBuildings, ...ownHouseholdBuildings],
      person.role,
    );
    personFood   += roleBonus.food   ?? 0;
    personWealth += roleBonus.wealth ?? 0;

    // Trade training bonus: completed apprenticeship grants a permanent % boost to production
    // in the trained role. Only applies when the person is actually working that role.
    const tradeBonus = person.tradeTraining?.[person.role] ?? 0;
    const tradeMult  = tradeBonus > 0 ? 1 + tradeBonus / 100 : 1.0;

    for (const [key, value] of Object.entries(roleBonus) as [keyof ResourceStock, number][]) {
      if (key !== 'food' && key !== 'wealth') {
        delta[key] += Math.floor(value * effectiveMult * tradeMult);
      }
    }

    // Apply happiness, child-age, and trade-training multipliers to food and wealth.
    delta.food   += personFood   * effectiveMult * tradeMult;
    delta.wealth += Math.floor(personWealth * effectiveMult * tradeMult);
  }

  // Apply seasonal modifier to accumulated food.
  delta.food  = Math.floor(delta.food  * mods.foodProduction);

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
  }

  return delta;
}

// ─── Wealth Generation ───────────────────────────────────────────────────────────────

/**
 * Base wealth generated per role per season.
 * Split 70/30 between household and settlement at generation time.
 */
export const WEALTH_YIELD: Partial<Record<WorkRole, number>> = {
  gather_food:          0.1,  // fractional — accumulates over ~10 seasons to 1 wealth
  farmer:               1,
  gather_stone:         1,
  gather_lumber:        1,
  guard:                1,
  healer:               2,
  craftsman:            2,
  herder:               2,
  miller:               2,
  hunter:               2,
  trader:               3,
  blacksmith:           3,
  tailor:               3,
  brewer:               2,
  priest_solar:         1,
  wheel_singer:         1,
  voice_of_wheel:       1,
  keth_thara:           1,
  builder:              1,
  bathhouse_attendant:  2,
  // away, unassigned, child → 0 (omitted from table = 0)
};

/** Fraction of each person's wealth yield that flows into settlement resources. */
export const SETTLEMENT_TAX_RATE = 0.30;

/** Result of the per-dawn wealth generation pass. */
export interface WealthGenerationResult {
  /** Per-household wealth deltas (key = household ID). */
  householdDeltas: Map<string, number>;
  /** Total wealth to add to settlement.resources.wealth. */
  settlementDelta: number;
}

/**
 * Computes how much wealth is generated by the living population this season.
 *
 * Each worker's yield is split at source:
 *   personalWealth = floor(yield × effectiveMult × tradeMult × (1 − TAX_RATE))
 *   taxWealth      = yield − personalWealth → settlement
 *
 * Persons with no householdId contribute their personal share to the
 * settlement instead (company-funded pioneers without a formed household).
 *
 * @param people            – All living persons.
 * @param happinessMultipliers – Per-person production multipliers from happiness tracking.
 */
export function calculateWealthGeneration(
  people: Map<string, Person>,
  happinessMultipliers: Map<string, number> = new Map(),
): WealthGenerationResult {
  const householdDeltas = new Map<string, number>();
  let settlementDelta = 0;

  for (const person of people.values()) {
    const yieldBase = WEALTH_YIELD[person.role] ?? 0;
    if (yieldBase === 0) continue;

    const happMult = happinessMultipliers.get(person.id) ?? 1.0;
    const effectiveMult = happMult * getChildWorkModifier(person.age);
    if (effectiveMult === 0) continue;

    const tradeBonus = person.tradeTraining?.[person.role] ?? 0;
    const tradeMult  = tradeBonus > 0 ? 1 + tradeBonus / 100 : 1.0;

    const totalYield    = yieldBase * effectiveMult * tradeMult;
    const taxWealth     = totalYield * SETTLEMENT_TAX_RATE;
    const personalWealth = totalYield - taxWealth;

    settlementDelta += taxWealth;

    const hhId = person.householdId;
    if (hhId) {
      householdDeltas.set(hhId, (householdDeltas.get(hhId) ?? 0) + personalWealth);
    } else {
      // No household yet — personal share flows to settlement.
      settlementDelta += personalWealth;
    }
  }

  return { householdDeltas, settlementDelta };
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
