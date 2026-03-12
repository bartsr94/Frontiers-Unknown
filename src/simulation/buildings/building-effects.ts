/**
 * Building effects — pure functions that derive mechanical modifiers from the
 * set of completed buildings currently standing in the settlement.
 *
 * All functions are side-effect-free and take only the BuiltBuilding array
 * (plus any auxiliary data they need) as inputs.
 */

import type { BuiltBuilding, BuildingId, ResourceStock } from '../turn/game-state';
import type { Person } from '../population/person';
import type { SkillId } from '../population/person';
import { BUILDING_CATALOG } from './building-definitions';

// ─── Shelter ──────────────────────────────────────────────────────────────────

/**
 * Returns the total shelter capacity of the settlement based on its buildings.
 * Only civic buildings (Camp, Longhouse, Roundhouse, Great Hall, Clan Lodge)
 * provide shelter — specialist buildings return 0.
 */
export function getShelterCapacity(buildings: BuiltBuilding[]): number {
  return buildings.reduce((sum, b) => sum + BUILDING_CATALOG[b.defId].shelterCapacity, 0);
}

// ─── Production ───────────────────────────────────────────────────────────────

/**
 * Returns the flat resource production bonus from all standing buildings
 * combined. Applied once per season on top of role-based production.
 *
 * Example: Granary adds +2 food per season regardless of workforce.
 */
export function getBuildingFlatProductionBonus(
  buildings: BuiltBuilding[],
): Partial<ResourceStock> {
  const result: Partial<ResourceStock> = {};
  for (const b of buildings) {
    const bonus = BUILDING_CATALOG[b.defId].flatProductionBonus;
    if (!bonus) continue;
    for (const [key, value] of Object.entries(bonus) as [keyof ResourceStock, number][]) {
      result[key] = (result[key] ?? 0) + value;
    }
  }
  return result;
}

/**
 * Returns the per-role production bonus granted to a person this season
 * by buildings in the settlement.
 *
 * Example: Workshop gives every craftsman +1 goods per season.
 */
export function getRoleProductionBonus(
  buildings: BuiltBuilding[],
  role: string,
): Partial<ResourceStock> {
  const result: Partial<ResourceStock> = {};
  for (const b of buildings) {
    const def = BUILDING_CATALOG[b.defId];
    if (def.roleProductionBonus && def.roleProductionBonus.role === role) {
      for (const [key, value] of Object.entries(def.roleProductionBonus.bonus) as [keyof ResourceStock, number][]) {
        result[key] = (result[key] ?? 0) + value;
      }
    }
  }
  return result;
}

// ─── Mortality ────────────────────────────────────────────────────────────────

/**
 * Returns the multiplier applied to child mortality chance.
 * Healer's Hut present: 0.5 (halved). Absent: 1.0 (no change).
 * Multiple modifiers multiply together.
 */
export function getChildMortalityModifier(buildings: BuiltBuilding[]): number {
  return buildings.reduce((m, b) => {
    const mod = BUILDING_CATALOG[b.defId].childMortalityModifier;
    return mod !== undefined ? m * mod : m;
  }, 1.0);
}

// ─── Language Drift ───────────────────────────────────────────────────────────

/**
 * Returns the multiplier applied to the settlement-wide language drift rate.
 * Gathering Hall present: 1.5. Absent: 1.0. Multiple halls multiply together.
 */
export function getLanguageDriftMultiplier(buildings: BuiltBuilding[]): number {
  return buildings.reduce((m, b) => {
    const mod = BUILDING_CATALOG[b.defId].languageDriftMultiplier;
    return mod !== undefined ? m * mod : m;
  }, 1.0);
}

// ─── Culture Pull ─────────────────────────────────────────────────────────────

export interface CulturePullModifier {
  direction: 'imanian' | 'sauromatian';
  strength: number;
}

/**
 * Returns all culture pull modifiers from standing buildings.
 * Each modifier is a (direction, strength) pair applied to every living person
 * in processCulturalDrift() each season.
 */
export function getBuildingCulturePull(buildings: BuiltBuilding[]): CulturePullModifier[] {
  const result: CulturePullModifier[] = [];
  for (const b of buildings) {
    const def = BUILDING_CATALOG[b.defId];
    if (!def.culturePull) continue;

    let direction: 'imanian' | 'sauromatian';
    if (def.culturePull.direction === 'from_style') {
      if (!b.style) continue; // no style set — skip
      direction = b.style;
    } else {
      direction = def.culturePull.direction;
    }

    result.push({ direction, strength: def.culturePull.strength });
  }
  return result;
}

// ─── Defence ─────────────────────────────────────────────────────────────────

/**
 * Returns the combined additive defense bonus from all standing buildings.
 * Palisade contributes +0.20. Absent: 0.
 */
export function getDefenseBonus(buildings: BuiltBuilding[]): number {
  return buildings.reduce((sum, b) => {
    const bonus = BUILDING_CATALOG[b.defId].defenseBonus;
    return sum + (bonus ?? 0);
  }, 0);
}

// ─── Skill Growth ─────────────────────────────────────────────────────────────

/**
 * Returns per-season skill growth bonuses for a specific person, based on
 * their role and the buildings standing in the settlement.
 *
 * Council membership is checked via councilMemberIds for the 'council' pseudo-role.
 */
export function getSkillGrowthBonuses(
  buildings: BuiltBuilding[],
  person: Person,
  councilMemberIds: string[],
): Partial<Record<SkillId, number>> {
  const result: Partial<Record<SkillId, number>> = {};
  const isCouncil = councilMemberIds.includes(person.id);

  for (const b of buildings) {
    const def = BUILDING_CATALOG[b.defId];
    if (!def.skillGrowth) continue;

    for (const entry of def.skillGrowth) {
      const roleMatches =
        entry.role === 'council' ? isCouncil : entry.role === person.role;
      if (!roleMatches) continue;

      const skillId = entry.skill as SkillId;
      result[skillId] = (result[skillId] ?? 0) + entry.bonus;
    }
  }
  return result;
}

// ─── Winter Food Protection ───────────────────────────────────────────────────

/**
 * Returns true if any standing building provides winter food protection.
 * When true, food decay/consumption in winter is halved.
 */
export function hasWinterFoodProtection(buildings: BuiltBuilding[]): boolean {
  return buildings.some(b => BUILDING_CATALOG[b.defId].winterFoodProtection === true);
}

// ─── Overcrowding ─────────────────────────────────────────────────────────────

/**
 * Returns the overcrowding ratio for the settlement.
 *   ratio ≤ 1.0  → not overcrowded
 *   ratio > 1.0  → overcrowded; penalties apply
 */
export function getOvercrowdingRatio(
  populationCount: number,
  buildings: BuiltBuilding[],
): number {
  const capacity = getShelterCapacity(buildings);
  if (capacity === 0) return 2.0; // Pathological state — treat as severely overcrowded
  return populationCount / capacity;
}

/**
 * Returns the mortality modifiers caused by overcrowding.
 * These stack on top of the standard child mortality and natural death chances.
 */
export function getOvercrowdingMortalityModifiers(overcrowdingRatio: number): {
  childMortalityMultiplier: number;
  elderlyDeathMultiplier: number;
} {
  if (overcrowdingRatio > 1.5) {
    return { childMortalityMultiplier: 1.5, elderlyDeathMultiplier: 1.2 };
  }
  if (overcrowdingRatio > 1.25) {
    return { childMortalityMultiplier: 1.5, elderlyDeathMultiplier: 1.0 };
  }
  if (overcrowdingRatio > 1.0) {
    return { childMortalityMultiplier: 1.25, elderlyDeathMultiplier: 1.0 };
  }
  return { childMortalityMultiplier: 1.0, elderlyDeathMultiplier: 1.0 };
}

/**
 * Returns the production efficiency multiplier caused by overcrowding.
 * Applied to all role-based production when ratio is high enough.
 *   ratio > 1.25 → 0.9 (−10% production from morale/fatigue)
 *   otherwise    → 1.0
 */
export function getOvercrowdingProductionMultiplier(overcrowdingRatio: number): number {
  return overcrowdingRatio > 1.25 ? 0.9 : 1.0;
}

// ─── Building Presence Helpers ────────────────────────────────────────────────

/** Returns true if the settlement has at least one instance of the given building. */
export function hasBuilding(buildings: BuiltBuilding[], defId: BuildingId): boolean {
  return buildings.some(b => b.defId === defId);
}

/** Returns true if the settlement has NO instance of the given building. */
export function lacksBuilding(buildings: BuiltBuilding[], defId: BuildingId): boolean {
  return !hasBuilding(buildings, defId);
}
