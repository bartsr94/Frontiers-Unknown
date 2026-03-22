/**
 * Private household economy.
 *
 * – distributeHouseholdWages: Spring payroll, company-funded (years 1–10) or
 *   self-funded (year 11+) with pro-rata shortfall handling.
 * – getSurplus: computes per-resource surplus above communal reserve floors.
 * – ROLE_TO_BUILDING: maps single-building specialist roles to their building.
 * – ROLE_TO_PRODUCTION_CHAINS: maps chain-climbing roles to their upgrade chains.
 * – getNextHouseholdProductionTarget: chain-aware desired building resolver.
 *
 * Pure logic — no React, no DOM, no store imports, no random state.
 */

import type { Person, WorkRole, PersonSkills } from '../population/person';
import type {
  ResourceStock,
  BuildingId,
  Household,
  BuiltBuilding,
  ConstructionProject,
  ActivityLogEntry,
  GameState,
  HouseholdSpecialty,
} from '../turn/game-state';
import { BUILDING_CATALOG } from '../buildings/building-definitions';

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Maps single-building specialist roles to their required household building.
 * These roles don't participate in upgrade chains — the target is always the
 * same building regardless of skill level.
 */
export const ROLE_TO_BUILDING: Partial<Record<WorkRole, BuildingId>> = {
  farmer:     'fields',
  blacksmith: 'smithy',
  brewer:     'brewery',
  miller:     'mill',
  // craftsman targets pottery (single-building, kiln chain T1).
  craftsman:  'pottery',
  // herder is also handled by ROLE_TO_PRODUCTION_CHAINS; stable is the single-building fallback.
  herder:     'stable',
  // hunter is also handled by ROLE_TO_PRODUCTION_CHAINS; smokehouse is the additive fallback
  // targeted whenever the hunting chain cannot provide the next upgrade step.
  hunter:     'smokehouse',
} as const;

/**
 * Minimum skill value required to aspire to each chain tier.
 *
 * T1 is always wanted (0 threshold). T2 requires Good skill (26+), T3 Very Good
 * (46+), T4 Excellent (63+). A household can never skip a tier.
 */
const CHAIN_TIER_SKILL_THRESHOLDS: Readonly<Record<number, number>> = {
  1: 0,
  2: 26,
  3: 46,
  4: 63,
};

/**
 * Maps roles that follow multi-tier household upgrade chains to the chains
 * (and the skill that gates higher tiers) they should aspire to climb.
 *
 * Each array entry is one chain: a household keeps building until they have
 * the highest tier their skill level qualifies them for.
 */
export const ROLE_TO_PRODUCTION_CHAINS: Partial<Record<WorkRole, ReadonlyArray<{ chainId: string; skill: keyof PersonSkills }>>> = {
  farmer: [
    { chainId: 'agriculture', skill: 'plants' },
    { chainId: 'orchard',     skill: 'plants' },
  ],
  herder: [
    { chainId: 'pastoralism', skill: 'animals' },
  ],
  healer: [
    { chainId: 'healing', skill: 'plants' },
  ],
  hunter: [
    { chainId: 'hunting', skill: 'combat' },
  ],
  trader: [
    { chainId: 'commerce', skill: 'bargaining' },
  ],
  tailor: [
    { chainId: 'leatherwork', skill: 'custom' },
  ],
  // Gathering roles: household-scale infra before communal camps are built.
  gather_lumber: [
    { chainId: 'logging_household', skill: 'custom' },
  ],
  gather_stone: [
    { chainId: 'quarrying_household', skill: 'custom' },
  ],
};

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

// ─── Chain-aware production target resolver ───────────────────────────────────

/**
 * Returns the next household production building this person should aspire to
 * build, taking into account upgrade chains and skill thresholds.
 *
 * For chain-based roles (farmer, herder):
 *   Walks each chain for the role in order; finds the highest tier the household
 *   already owns; returns the next tier IFF the person's relevant skill meets
 *   the threshold. Chains are tried in declaration order — whichever chain has
 *   an actionable next step first wins.
 *
 * For single-building roles (blacksmith, tailor, brewer, miller):
 *   Falls back to ROLE_TO_BUILDING. Returns null if already owned.
 *
 * For herder: also checks stable (ROLE_TO_BUILDING fallback) before the
 *   pastoralism chain — the stable is always slot 0 of herder household economy.
 *
 * Returns null when:
 *   – no building is desired (role has no mapping),
 *   – every chain tier is already owned,
 *   – skill too low for the next tier in every chain.
 */
export function getNextHouseholdProductionTarget(
  person: Person,
  household: Household,
  allBuildings: BuiltBuilding[],
): BuildingId | null {
  // Build a set of defIds this household already owns in its production slots.
  const ownedDefIds = new Set<BuildingId>(
    household.buildingSlots
      .slice(1)                                // skip slot 0 = dwelling
      .filter((s): s is string => s !== null)
      .flatMap(slotId => {
        const b = allBuildings.find(b => b.instanceId === slotId);
        return b ? [b.defId as BuildingId] : [];
      }),
  );

  // ── Chain-based roles ────────────────────────────────────────────────────
  const chains = ROLE_TO_PRODUCTION_CHAINS[person.role];
  if (chains) {
    for (const { chainId, skill } of chains) {
      // All household buildings in this chain, lowest tier first.
      const chainBuildings = Object.values(BUILDING_CATALOG)
        .filter(d => d.upgradeChainId === chainId && d.ownership === 'household')
        .sort((a, b) => (a.tierInChain ?? 0) - (b.tierInChain ?? 0));

      // Find the highest tier already owned.
      let highestOwnedTier = 0;
      for (const def of chainBuildings) {
        if (ownedDefIds.has(def.id as BuildingId) && def.tierInChain !== undefined) {
          highestOwnedTier = Math.max(highestOwnedTier, def.tierInChain);
        }
      }

      // Find the next unowned tier that person's skill unlocks.
      for (const def of chainBuildings) {
        const tier = def.tierInChain ?? 0;
        if (tier <= highestOwnedTier) continue;          // already have this or lower
        const threshold = CHAIN_TIER_SKILL_THRESHOLDS[tier] ?? 99;
        if (person.skills[skill] >= threshold) {
          return def.id as BuildingId;
        }
        break; // Can't skip tiers; stop scanning this chain.
      }
    }
    // All chains exhausted or skill-gated — nothing to build right now.
    // farmer, healer, trader, and tailor have no ROLE_TO_BUILDING fallback.
    // hunter falls through to check smokehouse; herder falls through to check stable.
    if (person.role === 'farmer' || person.role === 'healer' ||
        person.role === 'trader' || person.role === 'tailor') return null;
  }

  // ── Single-building fallback (blacksmith, tailor, brewer, miller, herder-stable) ──
  const singleTarget = ROLE_TO_BUILDING[person.role];
  if (!singleTarget) return null;
  return ownedDefIds.has(singleTarget) ? null : singleTarget;
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

/**
 * Maximum number of production building slots (slots 1–8) each dwelling tier
 * unlocks. A household cannot commission a new production building while all
 * permitted slots are filled — they must upgrade their dwelling first.
 */
const DWELLING_PRODUCTION_SLOTS: Partial<Record<BuildingId, number>> = {
  wattle_hut: 2,
  cottage:    3,
  homestead:  4,
  compound:   6,
};

/**
 * Food units per living settler below which food pressure is active.
 * When the settlement drops below this threshold, households without any
 * food production building will commission `fields` as a communal necessity
 * (Path D) — no role or ambition required.
 * At roughly 1 food consumed per person per season this is ~6 seasons of buffer.
 */
const FOOD_LOW_PER_PERSON = 6;

/**
 * Lumber units per living settler that triggers household lumber infrastructure.
 * Below this floor, households without a lumber-production building commission
 * a `woodcutter_hut` (Path D), and one member is auto-assigned to gather_lumber.
 * ~4 seasons of normal construction consumption per person.
 */
const LUMBER_LOW_PER_PERSON = 8;

/**
 * Stone units per living settler that triggers household stone infrastructure.
 * Below this floor, households without a stone-production building commission
 * a `stone_pit` (Path D), and one member is auto-assigned to gather_stone.
 */
const STONE_LOW_PER_PERSON = 5;

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
  /**
   * Permanent role assignments made alongside a resource-pressure build
   * (Path D lumber / stone: one suitable household member is auto-assigned to
   * the appropriate gathering role so work begins immediately, before the
   * building even completes).
   * The turn processor applies these role changes to `updatedPeople`.
   */
  autoRoleAssignments: Array<{ personId: string; newRole: WorkRole }>;
}

/**
 * Autonomous private build pass.
 *
 * Three paths, tried in order, each gated on wealth + material surplus:
 *
 *   Path A — No dwelling: always commissions a `wattle_hut` (necessity).
 *   Path B — Dwelling exists, ambition-driven:
 *     – `seek_better_housing` → next dwelling tier.
 *     – `seek_production_building` → next chain/building for best member.
 *     – Emergency overcrowding bypass (≥75% capacity) also fires without
 *       any ambition, just like Path A.
 *   Path C — Dwelling exists, role-driven (no ambition required):
 *     Scans every adult member; if any has a production role that maps to
 *     a building they don't yet own, commissions it. This ensures tradespeople
 *     build their workplaces as a necessity, not an aspiration.
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
  const autoRoleAssignments: Array<{ personId: string; newRole: WorkRole }> = [];
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
      // ── Path B: Household already has a dwelling ──────────────────────────

      // Emergency overcrowding bypass: if the household is at ≥75% of dwelling
      // capacity, commission the next dwelling tier without requiring an ambition.
      // This prevents wealthy households from stagnating in a Wattle Hut.
      const currentBuilding = allBuildings.find(b => b.instanceId === currentDwellingId) ?? null;
      if (currentBuilding && currentBuilding.defId !== 'compound') {
        const dwellDef = BUILDING_CATALOG[currentBuilding.defId as BuildingId];
        const overcrowdRatio = household.memberIds.length / (dwellDef.shelterCapacity || 1);
        if (overcrowdRatio >= 0.75) {
          const currentTier = DWELLING_TIER_ORDER.indexOf(currentBuilding.defId as BuildingId);
          const nextTierIndex = currentTier + 1;
          if (nextTierIndex < DWELLING_TIER_ORDER.length) {
            desiredBuildId = DWELLING_TIER_ORDER[nextTierIndex]!;
          }
        }
      }

      if (!desiredBuildId) {
        // ── Path B-ambition: ambition-driven building decisions ──────────────
        const ambition = leader.ambition;

        if (ambition?.type === 'seek_better_housing') {
          const tier = currentBuilding
            ? DWELLING_TIER_ORDER.indexOf(currentBuilding.defId as BuildingId)
            : -1;
          const nextTierIndex = tier + 1;
          if (nextTierIndex < DWELLING_TIER_ORDER.length) {
            desiredBuildId = DWELLING_TIER_ORDER[nextTierIndex]!;
          }
        } else if (ambition?.type === 'seek_production_building') {
          // Chain-aware: find the next production building any member needs.
          for (const memberId of household.memberIds) {
            const member = state.people.get(memberId);
            if (!member) continue;
            const wanted = getNextHouseholdProductionTarget(member, household, allBuildings);
            if (wanted) {
              desiredBuildId = wanted;
              break;
            }
          }
        }

        // ── Path C: Role-driven production building (no ambition required) ───
        // A worker who practices a trade needs a workplace — treating this as a
        // necessity like shelter, not an aspiration. Fires for any adult member
        // whose role maps to a production building the household doesn't yet own.
        if (!desiredBuildId) {
          for (const memberId of household.memberIds) {
            const member = state.people.get(memberId);
            if (!member || member.age < 16) continue;
            const wanted = getNextHouseholdProductionTarget(member, household, allBuildings);
            if (wanted) {
              desiredBuildId = wanted;
              break;
            }
          }
        }

        // ── Path D: Resource-pressure bypass ─────────────────────────────────
        // When settlement resource stocks are low, any household without the
        // appropriate production building commissions one as a necessity —
        // no role, no ambition required.
        //
        // D-food:   food < FOOD_LOW_PER_PERSON   → commission `fields`
        // D-lumber: lumber < LUMBER_LOW_PER_PERSON → commission `woodcutter_hut`
        //           + auto-assign an eligible member to gather_lumber
        // D-stone:  stone < STONE_LOW_PER_PERSON  → commission `stone_pit`
        //           + auto-assign an eligible member to gather_stone
        //
        // A household qualifies only if it has NO building in that resource's
        // category among its current production slots (slots 1–8).
        if (!desiredBuildId) {
          const ownedCategories = new Set<string>(
            household.buildingSlots
              .slice(1)
              .filter((s): s is string => s !== null)
              .map(slotId => {
                const b = allBuildings.find(b => b.instanceId === slotId);
                return b ? (BUILDING_CATALOG[b.defId as BuildingId]?.category ?? '') : '';
              }),
          );

          const livingCount = state.people.size;
          const foodPerPerson   = livingCount > 0 ? updatedResources.food   / livingCount : Infinity;
          const lumberPerPerson = livingCount > 0 ? updatedResources.lumber / livingCount : Infinity;
          const stonePerPerson  = livingCount > 0 ? updatedResources.stone  / livingCount : Infinity;

          // D-food
          if (!ownedCategories.has('food') && foodPerPerson < FOOD_LOW_PER_PERSON) {
            desiredBuildId = 'fields';
          }

          // D-lumber (checked independently; a single household can address multiple needs
          // over successive turns, one project at a time)
          if (!desiredBuildId && lumberPerPerson < LUMBER_LOW_PER_PERSON) {
            const hasLumberBuilding = household.buildingSlots
              .slice(1)
              .filter((s): s is string => s !== null)
              .some(slotId => {
                const b = allBuildings.find(b => b.instanceId === slotId);
                if (!b) return false;
                const def = BUILDING_CATALOG[b.defId as BuildingId];
                return def?.workerRole === 'gather_lumber';
              });
            if (!hasLumberBuilding) {
              desiredBuildId = 'woodcutter_hut';
            }
          }

          // D-stone
          if (!desiredBuildId && stonePerPerson < STONE_LOW_PER_PERSON) {
            const hasStoneBuilding = household.buildingSlots
              .slice(1)
              .filter((s): s is string => s !== null)
              .some(slotId => {
                const b = allBuildings.find(b => b.instanceId === slotId);
                if (!b) return false;
                const def = BUILDING_CATALOG[b.defId as BuildingId];
                return def?.workerRole === 'gather_stone';
              });
            if (!hasStoneBuilding) {
              desiredBuildId = 'stone_pit';
            }
          }
        }

        // Nothing to build this turn.
        if (!desiredBuildId) continue;
      }
    }

    // ── Affordability checks ─────────────────────────────────────────────────
    const def = BUILDING_CATALOG[desiredBuildId];
    const wealthCost = def.privateWealthCost;
    if (wealthCost === undefined) continue;

    // Out-of-specialty premium: building outside the household's established
    // trade costs 1.5× wealth. Basic resource-gathering structures are exempt.
    const ALWAYS_IN_SPECIALTY = new Set<BuildingId>(['fields', 'woodcutter_hut', 'stone_pit']);
    const isDwellingTarget = DWELLING_TIER_ORDER.includes(desiredBuildId);
    const buildingCategory = def.category as string;
    const SPECIALTY_CATEGORIES = new Set(['food', 'industry', 'social']);
    let effectiveWealthCost = wealthCost;
    if (
      !isDwellingTarget &&
      household.specialty !== null &&
      SPECIALTY_CATEGORIES.has(buildingCategory) &&
      buildingCategory !== household.specialty &&
      !ALWAYS_IN_SPECIALTY.has(desiredBuildId)
    ) {
      effectiveWealthCost = Math.ceil(wealthCost * 1.5);
    }
    if (household.householdWealth < effectiveWealthCost) continue;

    // ── Production-slot cap: dwelling tier limits how many production buildings ──
    // the household may own at once. Dwelling upgrades and Path-A shelters are
    // exempt (they occupy slot 0, not a production slot).
    const isDwelling = isDwellingTarget;
    if (!isDwelling) {
      const currentDwellingBuilding = currentDwellingId
        ? allBuildings.find(b => b.instanceId === currentDwellingId)
        : null;
      const maxProductionSlots = currentDwellingBuilding
        ? (DWELLING_PRODUCTION_SLOTS[currentDwellingBuilding.defId as BuildingId] ?? Infinity)
        : Infinity;
      // Count distinct production chains rather than total buildings — chain
      // tier upgrades (e.g. fields → barns_storehouses) extend an existing
      // interest and must not consume an additional slot.
      const usedChainIds = new Set<string>();
      let standaloneCount = 0;
      for (const slotId of household.buildingSlots.slice(1)) {
        if (slotId === null) continue;
        const slotBuilding = allBuildings.find(b => b.instanceId === slotId);
        if (!slotBuilding) continue;
        const slotDef = BUILDING_CATALOG[slotBuilding.defId as BuildingId];
        if (slotDef?.upgradeChainId) {
          usedChainIds.add(slotDef.upgradeChainId);
        } else {
          standaloneCount++;
        }
      }
      const usedProductionSlots = usedChainIds.size + standaloneCount;
      const isChainUpgrade = def.upgradeChainId != null && usedChainIds.has(def.upgradeChainId);
      if (!isChainUpgrade && usedProductionSlots >= maxProductionSlots) continue;
    }

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
    updatedHouseholds.set(hhId, { ...household, householdWealth: household.householdWealth - effectiveWealthCost });

    // Set household specialty on first commissioned production building.
    if (!isDwelling && household.specialty === null && SPECIALTY_CATEGORIES.has(buildingCategory)) {
      updatedHouseholds.set(hhId, {
        ...updatedHouseholds.get(hhId)!,
        specialty: buildingCategory as HouseholdSpecialty,
      });
    }

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

    // ── Path D auto-role assignment ──────────────────────────────────────────
    // When a woodcutter_hut or stone_pit is commissioned via resource pressure,
    // immediately assign one eligible household member to the gathering role so
    // production starts this same dawn rather than waiting for construction.
    // We skip any member who is already in the target role, who is the designated
    // builder for this project, or who holds a protected / specialist role.
    if (desiredBuildId === 'woodcutter_hut' || desiredBuildId === 'stone_pit') {
      const targetRole: WorkRole =
        desiredBuildId === 'woodcutter_hut' ? 'gather_lumber' : 'gather_stone';
      const builderId = builderPick?.personId ?? null;
      const alreadyAssigned = household.memberIds.some(id => {
        const m = state.people.get(id);
        return m?.role === targetRole;
      });
      if (!alreadyAssigned) {
        // Prefer an unassigned adult; fall back to gather_food; skip builder/away/keth_thara.
        const SKIP_ROLES = new Set<WorkRole>([
          'builder', 'away', 'keth_thara', 'guard',
          'farmer', 'blacksmith', 'tailor', 'brewer', 'miller', 'herder',
          'healer', 'trader', 'craftsman', 'hunter',
          'priest_solar', 'wheel_singer', 'voice_of_wheel',
        ]);
        let candidate: Person | null = null;
        for (const memberId of household.memberIds) {
          const m = state.people.get(memberId);
          if (!m || m.age < 16 || memberId === builderId || SKIP_ROLES.has(m.role)) continue;
          if (m.role === 'unassigned') { candidate = m; break; }
          if (m.role === 'gather_food' && !candidate) candidate = m;
        }
        if (candidate) {
          autoRoleAssignments.push({ personId: candidate.id, newRole: targetRole });
        }
      }
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

  return { updatedHouseholds, updatedResources, newProjects, logEntries, autoBuilderAssignments, autoRoleAssignments };
}

// ─── Dwelling Maintenance ─────────────────────────────────────────────────────

/** Seasonal wealth cost per dwelling tier (from household treasury). */
const DWELLING_MAINTENANCE: Partial<Record<BuildingId, number>> = {
  wattle_hut: 0,
  cottage:    1,
  homestead:  2,
  compound:   4,
};

/** Result returned by applyDwellingMaintenance. */
export interface DwellingMaintenanceResult {
  /** Updated households (wealth deducted / debt incremented where applicable). */
  updatedHouseholds: Map<string, Household>;
  /**
   * Instance IDs of dwellings whose household has been in debt for 2+ consecutive
   * seasons — these should trigger a downgrade event.
   */
  atRiskBuildingIds: string[];
}

/**
 * Deducts per-season dwelling maintenance costs from each household's wealth
 * treasury. If a household cannot pay:
 *   – `wealthMaintenanceDebt` increments by 1.
 *   – After 2 consecutive unpaid seasons, the dwelling instance ID is added to
 *     `atRiskBuildingIds` (caller queues the downgrade event).
 *
 * When a household can pay after a debt run, the debt counter resets to 0.
 */
export function applyDwellingMaintenance(
  households: Map<string, Household>,
  allBuildings: BuiltBuilding[],
): DwellingMaintenanceResult {
  const updatedHouseholds = new Map(households);
  const atRiskBuildingIds: string[] = [];

  for (const [hhId, household] of households) {
    const dwellingInstanceId = household.buildingSlots[0] ?? null;
    if (!dwellingInstanceId) continue;

    const dwelling = allBuildings.find(b => b.instanceId === dwellingInstanceId);
    if (!dwelling) continue;

    const cost = DWELLING_MAINTENANCE[dwelling.defId as BuildingId] ?? 0;
    if (cost === 0) continue; // wattle_hut and undefined tiers are free

    if (household.householdWealth >= cost) {
      updatedHouseholds.set(hhId, {
        ...household,
        householdWealth: household.householdWealth - cost,
        wealthMaintenanceDebt: 0,
      });
    } else {
      const newDebt = (household.wealthMaintenanceDebt ?? 0) + 1;
      updatedHouseholds.set(hhId, {
        ...household,
        wealthMaintenanceDebt: newDebt,
      });
      if (newDebt >= 2) {
        atRiskBuildingIds.push(dwellingInstanceId);
      }
    }
  }

  return { updatedHouseholds, atRiskBuildingIds };
}

/**
 * After processConstruction has stripped dead builders from household-owned projects,
 * check if any such project went from having builders to having none (all died).
 * For each orphaned project, auto-assign a replacement from the owning household.
 *
 * @param updatedQueue  The queue returned by processConstruction (dead IDs already stripped).
 * @param prevQueue     The queue as it stood before processConstruction ran (to detect losses).
 * @param people        The living people map (dead people already removed).
 * @param households    The current household map.
 * @param turnNumber    Current turn number (stamped on new role assignments).
 * @returns Updated queue with replacements applied, and a partial people map
 *          containing only people whose role changed to 'builder'.
 */
export function replaceDeadHouseholdBuilders(
  updatedQueue: ConstructionProject[],
  prevQueue: ConstructionProject[],
  people: Map<string, Person>,
  households: Map<string, Household>,
  turnNumber: number,
): { updatedQueue: ConstructionProject[]; updatedPeople: Map<string, Person> } {
  const prevQueueById = new Map(prevQueue.map(p => [p.id, p]));
  const updatedPeople = new Map<string, Person>();

  const resultQueue = updatedQueue.map(project => {
    if (!project.ownerHouseholdId) return project;
    if (project.assignedWorkerIds.length > 0) return project;
    const prev = prevQueueById.get(project.id);
    // Only auto-replace if there were builders before (they died) — don't
    // auto-assign on projects that were always worker-less.
    if (!prev || prev.assignedWorkerIds.length === 0) return project;

    const household = households.get(project.ownerHouseholdId);
    if (!household) return project;
    const leaderId = household.headId ?? household.seniorWifeId;
    if (!leaderId) return project;

    const replacement = pickHouseholdBuilder(household, people, leaderId);
    if (!replacement) return project;

    const replacePerson = people.get(replacement.personId);
    if (!replacePerson) return project;
    updatedPeople.set(replacement.personId, {
      ...replacePerson,
      role: 'builder',
      roleAssignedTurn: turnNumber,
    });

    return {
      ...project,
      assignedWorkerIds: [replacement.personId],
      autoBuilderPrevRoles: {
        ...(project.autoBuilderPrevRoles ?? {}),
        [replacement.personId]: replacement.prevRole,
      },
    };
  });

  return { updatedQueue: resultQueue, updatedPeople };
}
