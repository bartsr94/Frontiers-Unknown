/**
 * Private household economy.
 *
 * – distributeHouseholdWages: Spring payroll, company-funded (years 1–10) or
 *   self-funded (year 11+) with pro-rata shortfall handling.
 * – getSurplus: computes per-resource surplus above communal reserve floors.
 * – ROLE_TO_BUILDING: maps specialist roles to their matching household building.
 *
 * Pure logic — no React, no DOM, no store imports, no random state.
 */

import type { Person, WorkRole } from '../population/person';
import type {
  ResourceStock,
  BuildingId,
  Household,
  ConstructionProject,
  ActivityLogEntry,
  GameState,
} from '../turn/game-state';
import { BUILDING_CATALOG } from '../buildings/building-definitions';

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Maps specialist WorkRoles to the household building that supports them.
 * Used to determine whether a `seek_production_building` ambition is fulfilled
 * and which building to target in the private build engine.
 */
export const ROLE_TO_BUILDING: Partial<Record<WorkRole, BuildingId>> = {
  farmer:     'fields',
  blacksmith: 'smithy',
  brewer:     'brewery',
  tailor:     'tannery',
  miller:     'mill',
  herder:     'stable',
} as const;

/** Work roles that are exempt from the payroll (not "employed adults"). */
const EXEMPT_PAYROLL_ROLES = new Set<WorkRole>([
  'unassigned',
  'child',
  'away',
  'keth_thara',
]);

// ─── Types ────────────────────────────────────────────────────────────────────

/** Result returned by distributeHouseholdWages. */
export interface WageResult {
  /** Per-household gold to add (key = household ID). */
  householdDeltas: Map<string, number>;
  /** Total gold disbursed across all households. */
  totalDisbursed: number;
  /**
   * Gold actually deducted from settlement resources.
   * Zero in years 1–10 (company funded); positive in year 11+ if gold was available.
   */
  settlementGoldSpent: number;
  /**
   * True if the settlement could not cover the full payroll (year 11+ only).
   * Written to GameState.lastPayrollShortfall by the store.
   */
  payrollShortfall: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Returns true if this person counts as an "employed adult" for payroll purposes:
 *   – age >= 16
 *   – role is not in EXEMPT_PAYROLL_ROLES
 *   – socialStatus is not 'thrall'
 */
function isPayrollEligible(person: Person): boolean {
  return (
    person.age >= 16 &&
    !EXEMPT_PAYROLL_ROLES.has(person.role) &&
    person.socialStatus !== 'thrall'
  );
}

// ─── Wage Distribution ────────────────────────────────────────────────────────

/**
 * Computes payroll gold for each household this Spring.
 *
 * Years 1–10 (company funded):
 *   Each employed adult earns 1 gold directly from the Company, distributed
 *   straight into their household treasury without touching settlement resources.
 *   `settlementGoldSpent` is always 0 in these years.
 *
 * Year 11+ (self funded):
 *   Gold is drawn from the settlement treasury. If the settlement has enough,
 *   every household gets full wages. If not, each household receives a pro-rata
 *   share of what is available and `payrollShortfall` is set to true.
 *
 * @param people          – Current living population (post-dawn demographic pass).
 * @param currentYear     – Current in-game year (1-indexed).
 * @param settlementGold  – Current settlement gold stock (used for year 11+ path).
 */
export function distributeHouseholdWages(
  people: Map<string, Person>,
  currentYear: number,
  settlementGold: number,
): WageResult {
  // Count employed adults per household.
  const workerCount = new Map<string, number>();
  for (const [, person] of people) {
    if (!isPayrollEligible(person)) continue;
    const hId = person.householdId;
    if (!hId) continue;
    workerCount.set(hId, (workerCount.get(hId) ?? 0) + 1);
  }

  if (workerCount.size === 0) {
    return {
      householdDeltas: new Map(),
      totalDisbursed: 0,
      settlementGoldSpent: 0,
      payrollShortfall: false,
    };
  }

  const totalWage = Array.from(workerCount.values()).reduce((a, b) => a + b, 0);

  // ── Years 1–10: Company-funded path ───────────────────────────────────────
  if (currentYear <= 10) {
    return {
      householdDeltas: new Map(workerCount),
      totalDisbursed: totalWage,
      settlementGoldSpent: 0,
      payrollShortfall: false,
    };
  }

  // ── Year 11+: Self-funded path ────────────────────────────────────────────
  if (settlementGold >= totalWage) {
    return {
      householdDeltas: new Map(workerCount),
      totalDisbursed: totalWage,
      settlementGoldSpent: totalWage,
      payrollShortfall: false,
    };
  }

  // Pro-rata shortfall: distribute what is available proportionally.
  const shortfallDeltas = new Map<string, number>();
  let actualSpent = 0;
  for (const [hhId, count] of workerCount) {
    const share = Math.floor((count * settlementGold) / totalWage);
    if (share > 0) {
      shortfallDeltas.set(hhId, share);
      actualSpent += share;
    }
  }
  return {
    householdDeltas: shortfallDeltas,
    totalDisbursed: actualSpent,
    settlementGoldSpent: actualSpent,
    payrollShortfall: true,
  };
}

// ─── Surplus Computation ──────────────────────────────────────────────────────

/**
 * Returns the surplus of each resource above the communal reserve floor.
 *
 * Example: food=30, reserves.food=20 → result.food=10.
 * A resource whose stock is at or below its floor contributes 0 (omitted from result).
 * Resources with no floor entry (reserves[r] === undefined) count their entire
 * stock as surplus.
 *
 * @param resources – Current settlement resource stocks.
 * @param reserves  – Per-resource minimum floors (Partial means any key may be absent).
 */
export function getSurplus(
  resources: ResourceStock,
  reserves: Partial<ResourceStock>,
): Partial<ResourceStock> {
  const result: Partial<ResourceStock> = {};
  for (const key of Object.keys(resources) as Array<keyof ResourceStock>) {
    const surplus = resources[key] - (reserves[key] ?? 0);
    if (surplus > 0) {
      result[key] = surplus;
    }
  }
  return result;
}

// ─── Private Build Engine ─────────────────────────────────────────────────────

/**
 * Ordered dwelling tiers, lowest to highest.
 * Used to resolve the "next tier" target for the seek_better_housing ambition.
 */
const DWELLING_TIER_ORDER: BuildingId[] = [
  'wattle_hut',
  'cottage',
  'homestead',
  'compound',
];

/** Roles that may never be auto-reassigned to 'builder'. */
const PROTECTED_FROM_BUILDER = new Set<WorkRole>(['away', 'builder', 'keth_thara']);

/**
 * Picks the best available member from a household to auto-assign as builder.
 *
 * Priority:
 *   1. An unassigned adult member who is not the lead decision-maker.
 *   2. Any non-protected adult member who is not the lead decision-maker.
 *   3. The lead decision-maker themselves (last resort for single-adult households).
 *
 * Returns null if no eligible member is found.
 */
function pickHouseholdBuilder(
  household: Household,
  people: Map<string, Person>,
  leaderId: string,
): { personId: string; prevRole: WorkRole } | null {
  const candidates = household.memberIds
    .map(id => people.get(id))
    .filter((p): p is Person =>
      p !== undefined &&
      p.age >= 16 &&
      !PROTECTED_FROM_BUILDER.has(p.role),
    );

  // Prefer unassigned non-leaders.
  const unassignedNonLeader = candidates.find(
    p => p.id !== leaderId && p.role === 'unassigned',
  );
  if (unassignedNonLeader) {
    return { personId: unassignedNonLeader.id, prevRole: unassignedNonLeader.role };
  }

  // Any non-protected non-leader.
  const anyNonLeader = candidates.find(p => p.id !== leaderId);
  if (anyNonLeader) {
    return { personId: anyNonLeader.id, prevRole: anyNonLeader.role };
  }

  // Fallback: the leader themselves.
  const leader = candidates.find(p => p.id === leaderId);
  if (leader) {
    return { personId: leader.id, prevRole: leader.role };
  }

  return null;
}

/** Result returned by processPrivateBuilding. */
export interface PrivateBuildResult {
  /** Updated households (gold deducted where a project was started). */
  updatedHouseholds: Map<string, Household>;
  /** Updated settlement resources (materials deducted). */
  updatedResources: ResourceStock;
  /** New construction projects to append to the queue. */
  newProjects: ConstructionProject[];
  /** Activity log entries generated this pass. */
  logEntries: ActivityLogEntry[];
  /**
   * For each new project that got an auto-assigned builder, the person ID and
   * the role they held before being set to 'builder'. The turn processor sets
   * the person's role to 'builder' and stores this info on the project so it
   * can be restored when construction completes or is cancelled.
   */
  autoBuilderAssignments: Array<{ personId: string; prevRole: WorkRole }>;
}

/**
 * Autonomous private build pass.
 *
 * For every household whose head (or senior wife as fallback) holds a
 * `seek_better_housing` or `seek_production_building` ambition, tries to
 * start a private construction project if:
 *   – the household has enough gold (`privateGoldCost`), and
 *   – every required material is available as surplus above the communal
 *     reserve floor.
 *
 * At most one project is started per household per dawn.
 * Purchases are processed in `state.households` iteration order; if two
 * households compete for the same scarce material, the first one wins.
 *
 * Pure logic — no React, no DOM.
 */
export function processPrivateBuilding(
  state: GameState,
): PrivateBuildResult {
  const updatedHouseholds = new Map(state.households);
  let updatedResources: ResourceStock = { ...state.settlement.resources };
  const newProjects: ConstructionProject[] = [];
  const logEntries: ActivityLogEntry[] = [];
  const autoBuilderAssignments: Array<{ personId: string; prevRole: WorkRole }> = [];
  const reserves: Partial<ResourceStock> = state.settlement.economyReserves ?? {};
  const allBuildings = state.settlement.buildings;

  for (const [hhId, household] of state.households) {
    // Skip households that already have an active private building project —
    // one project at a time per household.
    const hasActiveProject = (state.settlement.constructionQueue ?? []).some(
      p => p.ownerHouseholdId === hhId,
    );
    if (hasActiveProject) continue;

    // Find the household representative (head or senior wife).
    const leaderId = household.headId ?? household.seniorWifeId;
    if (!leaderId) continue;
    const leader = state.people.get(leaderId);
    if (!leader) continue;

    // ── Resolve desired building ─────────────────────────────────────────────
    let desiredBuildId: BuildingId | null = null;
    const currentDwellingId = household.buildingSlots[0] ?? null;

    if (!currentDwellingId) {
      // ── Path A: Household has NO dwelling at all ──────────────────────────
      // Basic shelter is treated as a necessity, not an aspiration — we build
      // regardless of whether the leader currently holds a housing ambition.
      desiredBuildId = 'wattle_hut';
    } else {
      // ── Path B: Household already has a dwelling — check ambition for upgrades ──
      const ambition = leader.ambition;
      if (!ambition) continue;

      if (ambition.type === 'seek_better_housing') {
        const currentBuilding = allBuildings.find(b => b.instanceId === currentDwellingId) ?? null;
        const currentTier = currentBuilding
          ? DWELLING_TIER_ORDER.indexOf(currentBuilding.defId as BuildingId)
          : -1;
        const nextTierIndex = currentTier + 1;
        if (nextTierIndex < DWELLING_TIER_ORDER.length) {
          desiredBuildId = DWELLING_TIER_ORDER[nextTierIndex]!;
        }
      } else if (ambition.type === 'seek_production_building') {
        // seek_production_building: first member with an unmet specialist role
        for (const memberId of household.memberIds) {
          const member = state.people.get(memberId);
          if (!member) continue;
          const wanted = ROLE_TO_BUILDING[member.role];
          if (!wanted) continue;
          const alreadyOwned = household.buildingSlots.some(slotId => {
            if (!slotId) return false;
            const b = allBuildings.find(bl => bl.instanceId === slotId);
            return b?.defId === wanted;
          });
          if (!alreadyOwned) {
            desiredBuildId = wanted;
            break;
          }
        }
      }
      // Any other ambition type → no building action this turn.
    }

    if (!desiredBuildId) continue;

    // ── Affordability checks ─────────────────────────────────────────────────
    const def = BUILDING_CATALOG[desiredBuildId];
    const goldCost = def.privateGoldCost;
    if (goldCost === undefined || household.householdGold < goldCost) continue;

    const surplus = getSurplus(updatedResources, reserves);
    let canAffordMaterials = true;
    for (const [resource, amount] of Object.entries(def.cost) as [keyof ResourceStock, number][]) {
      if ((surplus[resource] ?? 0) < amount) {
        canAffordMaterials = false;
        break;
      }
    }
    if (!canAffordMaterials) continue;

    // ── Purchase ─────────────────────────────────────────────────────────────
    updatedHouseholds.set(hhId, { ...household, householdGold: household.householdGold - goldCost });

    // Deduct materials from the running resource snapshot
    for (const [resource, amount] of Object.entries(def.cost) as [keyof ResourceStock, number][]) {
      updatedResources = {
        ...updatedResources,
        [resource]: updatedResources[resource] - amount,
      };
    }

    // Create the construction project
    const projectId = `${desiredBuildId}_priv_${state.turnNumber}_${hhId}`;

    // Auto-assign one household member as builder.
    const builderPick = pickHouseholdBuilder(household, state.people, leaderId);

    const project: ConstructionProject = {
      id: projectId,
      defId: desiredBuildId,
      style: null,
      progressPoints: 0,
      totalPoints: def.buildSeasons * 100,
      assignedWorkerIds: builderPick ? [builderPick.personId] : [],
      startedTurn: state.turnNumber,
      resourcesSpent: def.cost,
      ownerHouseholdId: hhId,
      ...(builderPick
        ? { autoBuilderPrevRoles: { [builderPick.personId]: builderPick.prevRole } }
        : {}),
    };
    newProjects.push(project);
    if (builderPick) {
      autoBuilderAssignments.push(builderPick);
    }

    // Log
    const firstName = leader.firstName;
    logEntries.push({
      turn: state.turnNumber,
      type: 'private_build_started',
      personId: leaderId,
      description: `${firstName} commissioned ${def.name} for the household.`,
    });
  }

  return { updatedHouseholds, updatedResources, newProjects, logEntries, autoBuilderAssignments };
}
