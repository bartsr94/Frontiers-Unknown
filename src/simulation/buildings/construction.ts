/**
 * Construction system — logic for starting, advancing, and completing
 * building projects in the settlement.
 *
 * All functions are pure (no side effects) except that they return new
 * state objects for the caller (Zustand store or turn processor) to apply.
 */

import type {
  Settlement,
  BuiltBuilding,
  ConstructionProject,
  BuildingId,
  BuildingStyle,
  ResourceStock,
  Household,
} from '../turn/game-state';
import type { Person } from '../population/person';
import type { SeededRNG } from '../../utils/rng';
import { BUILDING_CATALOG } from './building-definitions';
import { hasBuilding } from './building-effects';

// ─── Validation ───────────────────────────────────────────────────────────────

export type CanBuildResult =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * Validates whether a given building can be started in the current settlement state.
 *
 * Checks:
 *   1. BuildingId is valid
 *   2. Prerequisite building is present (if any)
 *   3. The replacement source building is present (for upgrade chain)
 *   4. The building is not already constructed (for most buildings)
 *   5. Resources are sufficient
 */
export function canBuild(
  settlement: Settlement,
  defId: BuildingId,
  _style: BuildingStyle | null,
): CanBuildResult {
  const def = BUILDING_CATALOG[defId];

  // Prerequisite present?
  if (def.requires && !hasBuilding(settlement.buildings, def.requires)) {
    const prereqDef = BUILDING_CATALOG[def.requires];
    return { ok: false, reason: `Requires: ${prereqDef.name}` };
  }

  // For upgrade chain buildings, the source must be present.
  if (def.replacesId && !hasBuilding(settlement.buildings, def.replacesId)) {
    const sourceDef = BUILDING_CATALOG[def.replacesId];
    return { ok: false, reason: `Upgrade requires existing ${sourceDef.name}` };
  }

  // Already built? Skip the check for buildings that allow multiple instances.
  if (!def.allowMultiple && hasBuilding(settlement.buildings, defId)) {
    return { ok: false, reason: 'Already constructed' };
  }

  // Prevent starting a duplicate project in the queue (even for allowMultiple buildings,
  // only one construction project per type can be queued at a time).
  if (settlement.constructionQueue.some(p => p.defId === defId)) {
    return { ok: false, reason: 'Already under construction' };
  }

  // Resources sufficient?
  const shortfalls: string[] = [];
  for (const [resource, required] of Object.entries(def.cost) as [keyof ResourceStock, number][]) {
    const have = settlement.resources[resource] ?? 0;
    if (have < required) {
      shortfalls.push(`${required - have} more ${resource}`);
    }
  }
  if (shortfalls.length > 0) {
    return { ok: false, reason: `Need ${shortfalls.join(', ')}` };
  }

  return { ok: true };
}

// ─── Start Construction ───────────────────────────────────────────────────────

/** Counter for generating unique project IDs within a session. */
let _projectCounter = 0;

/**
 * Creates a new ConstructionProject and deducts the required resources from
 * the settlement's stock.
 *
 * The caller must validate using canBuild() before calling this function.
 * Returns the new project and the updated ResourceStock.
 */
export function startConstruction(
  settlement: Settlement,
  defId: BuildingId,
  style: BuildingStyle | null,
  turnNumber: number,
  ownerHouseholdId: string | null = null,
): { project: ConstructionProject; updatedResources: ResourceStock } {
  const def = BUILDING_CATALOG[defId];
  _projectCounter += 1;
  const projectId = `${defId}_proj_${turnNumber}_${_projectCounter}`;

  // Deduct resources.
  const updatedResources = { ...settlement.resources };
  const spent: Partial<ResourceStock> = {};
  for (const [resource, cost] of Object.entries(def.cost) as [keyof ResourceStock, number][]) {
    updatedResources[resource] = (updatedResources[resource] ?? 0) - cost;
    spent[resource] = cost;
  }

  const project: ConstructionProject = {
    id: projectId,
    defId,
    style,
    progressPoints: 0,
    totalPoints: def.buildSeasons * 100,
    assignedWorkerIds: [],
    startedTurn: turnNumber,
    resourcesSpent: spent,
    ownerHouseholdId,
  };

  return { project, updatedResources };
}

// ─── Worker Management ────────────────────────────────────────────────────────

/**
 * Returns the project with the person added as an assigned worker.
 * Does NOT set the person's role — the store handles that separately.
 */
export function assignBuilder(
  project: ConstructionProject,
  personId: string,
): ConstructionProject {
  if (project.assignedWorkerIds.includes(personId)) return project;
  return { ...project, assignedWorkerIds: [...project.assignedWorkerIds, personId] };
}

/**
 * Returns the project with the person removed from assigned workers.
 * Does NOT reset the person's role — the store handles that separately.
 */
export function removeBuilder(
  project: ConstructionProject,
  personId: string,
): ConstructionProject {
  return {
    ...project,
    assignedWorkerIds: project.assignedWorkerIds.filter(id => id !== personId),
  };
}

// ─── Process Construction ─────────────────────────────────────────────────────

export interface ProcessConstructionResult {
  /** All projects that completed this season (may be more than one). */
  completedBuildings: BuiltBuilding[];
  /** Projects that remain in the queue after this season. */
  updatedQueue: ConstructionProject[];
  /**
   * IDs of workers freed from completed projects.
   * The turn processor resets their role to 'unassigned'.
   */
  completedWorkerIds: string[];
  /**
   * Building IDs that were removed from Settlement.buildings as a result of
   * completed upgrade chain projects (e.g. Camp removed when Longhouse finishes).
   */
  removedBuildingIds: BuildingId[];
}

/**
 * Advances all queued construction projects by one season.
 *
 * For each project with assigned workers:
 *   - Compute average `custom` skill of assigned workers
 *   - progressPoints += workers × (1 + avgCustomSkill / 100) × 100
 *   - If progressPoints >= totalPoints → project complete
 *
 * Projects with zero workers make no progress and remain in the queue.
 *
 * @param queue    Current construction queue.
 * @param people   All living people (used to look up custom skill).
 * @param turnNumber Current turn number (stamped on completed BuiltBuilding).
 * @param _rng     RNG instance (reserved for future random events during construction).
 */
export function processConstruction(
  queue: ConstructionProject[],
  people: Map<string, Person>,
  turnNumber: number,
  _rng: SeededRNG,
): ProcessConstructionResult {
  const completedBuildings: BuiltBuilding[] = [];
  const completedWorkerIds: string[] = [];
  const removedBuildingIds: BuildingId[] = [];
  const updatedQueue: ConstructionProject[] = [];

  for (const project of queue) {
    if (project.assignedWorkerIds.length === 0) {
      // No workers — project frozen, stays in queue.
      updatedQueue.push(project);
      continue;
    }

    // Average custom skill of assigned workers.
    let totalCustom = 0;
    let workerCount = 0;
    for (const workerId of project.assignedWorkerIds) {
      const person = people.get(workerId);
      if (person) {
        totalCustom += person.skills.custom;
        workerCount++;
      }
    }
    const avgCustom = workerCount > 0 ? totalCustom / workerCount : 25;

    // Advance progress.
    const earnedPoints = Math.round(
      workerCount * (1 + avgCustom / 100) * 100,
    );
    const newProgress = project.progressPoints + earnedPoints;

    if (newProgress >= project.totalPoints) {
      // Project complete!
      const def = BUILDING_CATALOG[project.defId];

      completedBuildings.push({
        defId: project.defId,
        instanceId: `${project.defId}_${turnNumber}`,
        builtTurn: turnNumber,
        style: project.style,
        ownerHouseholdId: project.ownerHouseholdId,
        assignedWorkerIds: [],
      });

      // Record any building that this upgrade replaces.
      if (def.replacesId) {
        removedBuildingIds.push(def.replacesId);
      }

      // Free all workers.
      for (const workerId of project.assignedWorkerIds) {
        completedWorkerIds.push(workerId);
      }
      // Project does NOT go back to queue.
    } else {
      updatedQueue.push({ ...project, progressPoints: newProgress });
    }
  }

  return { completedBuildings, updatedQueue, completedWorkerIds, removedBuildingIds };
}

// ─── Cancel Construction ──────────────────────────────────────────────────────

export interface CancelConstructionResult {
  /** Resources to add back to the settlement stock (50% of what was spent). */
  refund: Partial<ResourceStock>;
  /** IDs of workers who were assigned to the project. */
  freedWorkerIds: string[];
}

/**
 * Cancels a construction project, returning a 50% resource refund.
 * The caller must remove the project from the queue and free the workers.
 */
export function cancelConstruction(project: ConstructionProject): CancelConstructionResult {
  const refund: Partial<ResourceStock> = {};
  for (const [resource, spent] of Object.entries(project.resourcesSpent) as [keyof ResourceStock, number][]) {
    refund[resource] = Math.floor(spent / 2);
  }
  return {
    refund,
    freedWorkerIds: [...project.assignedWorkerIds],
  };
}

// ─── Dwelling Claims ──────────────────────────────────────────────────────────

/** Building IDs that classify as private household dwellings. */
export const DWELLING_IDS: ReadonlySet<string> = new Set([
  'wattle_hut', 'cottage', 'homestead', 'compound',
]);

/**
 * Assigns unclaimed dwelling buildings to homeless households and propagates
 * `person.claimedBuildingId` for all household members.
 *
 * Three-pass algorithm:
 *   Pass 1 — newly-completed scheme-owned buildings: link to ownerHouseholdId
 *   Pass 2 — any remaining unowned standing dwellings: assign to the first
 *             homeless household; stamps ownerHouseholdId on the building
 *   Pass 3 — propagate dwellingBuildingId → person.claimedBuildingId;
 *             defensively clear both if the dwelling was demolished
 *
 * All inputs are treated as immutable; fresh data structures are returned.
 */
export function applyDwellingClaims(
  completedBuildings: BuiltBuilding[],
  allBuildings: BuiltBuilding[],
  households: Map<string, Household>,
  people: Map<string, Person>,
): {
  buildings: BuiltBuilding[];
  households: Map<string, Household>;
  people: Map<string, Person>;
} {
  const hh = new Map(households);
  let buildings = [...allBuildings];

  // Pass 1: newly-completed buildings that were scheme-built (ownerHouseholdId pre-set)
  for (const b of completedBuildings) {
    if (!b.ownerHouseholdId) continue;
    const existing = hh.get(b.ownerHouseholdId);
    if (!existing) continue;
    if (DWELLING_IDS.has(b.defId)) {
      // If this household already owned a different dwelling, free it so Pass 2
      // can redistribute it to a homeless household rather than leaving it orphaned.
      const oldDwellingId = existing.dwellingBuildingId;
      if (oldDwellingId && oldDwellingId !== b.instanceId) {
        const oldIdx = buildings.findIndex(x => x.instanceId === oldDwellingId);
        if (oldIdx >= 0) {
          buildings = buildings.map((x, i) =>
            i === oldIdx ? { ...x, ownerHouseholdId: null } : x,
          );
        }
      }
      hh.set(b.ownerHouseholdId, { ...existing, dwellingBuildingId: b.instanceId });
    } else {
      hh.set(b.ownerHouseholdId, {
        ...existing,
        productionBuildingIds: [...(existing.productionBuildingIds ?? []), b.instanceId],
      });
    }
  }

  // Pass 2: unowned standing dwellings → assign to the first homeless household
  const unowned = buildings.filter(b => DWELLING_IDS.has(b.defId) && !b.ownerHouseholdId);
  for (const b of unowned) {
    const homelessEntry = Array.from(hh.entries()).find(
      ([, h]) => !h.dwellingBuildingId && (h.memberIds ?? []).length > 0,
    );
    if (!homelessEntry) break;
    const [hhId, hhObj] = homelessEntry;
    hh.set(hhId, { ...hhObj, dwellingBuildingId: b.instanceId });
    // Stamp the building so it isn't re-assigned on subsequent dawns
    const idx = buildings.findIndex(x => x.instanceId === b.instanceId);
    if (idx >= 0) {
      buildings = buildings.map((x, i) => (i === idx ? { ...x, ownerHouseholdId: hhId } : x));
    }
  }

  // Pass 3: propagate household's dwellingBuildingId → person.claimedBuildingId;
  // clear both if the building was demolished.
  const ppl = new Map(people);
  for (const [hhId, hhObj] of hh) {
    if (!hhObj.dwellingBuildingId) continue;
    // Try to stamp unclaimed members
    for (const memberId of hhObj.memberIds ?? []) {
      const p = ppl.get(memberId);
      if (p && !p.claimedBuildingId) {
        ppl.set(memberId, { ...p, claimedBuildingId: hhObj.dwellingBuildingId });
      }
    }
    // Defensive: if the dwelling was demolished, clear both household and person refs
    const stillStanding = buildings.some(x => x.instanceId === hhObj.dwellingBuildingId);
    if (!stillStanding) {
      hh.set(hhId, { ...hhObj, dwellingBuildingId: null });
      for (const memberId of hhObj.memberIds ?? []) {
        const p = ppl.get(memberId);
        if (p?.claimedBuildingId === hhObj.dwellingBuildingId) {
          ppl.set(memberId, { ...p, claimedBuildingId: null });
        }
      }
    }
  }

  return { buildings, households: hh, people: ppl };
}

// ─── Worker Slot Lookup ───────────────────────────────────────────────────────

/**
 * Finds the index of the first building that:
 *   - has `workerRole === role`, AND
 *   - has `workerSlots` defined, AND
 *   - has fewer assigned workers than its `workerSlots` cap.
 *
 * Returns `-1` when no such building exists (all slots full, or no building
 * with that workerRole).
 */
export function findAvailableWorkerSlotIndex(buildings: BuiltBuilding[], role: string): number {
  return buildings.findIndex(b => {
    const def = BUILDING_CATALOG[b.defId];
    return (
      def?.workerRole === role &&
      def.workerSlots !== undefined &&
      (b.assignedWorkerIds ?? []).length < def.workerSlots
    );
  });
}
