/**
 * Ansberry Company quota and support mechanics.
 *
 * Handles yearly quota computation, quota-check resolution, failure escalation,
 * support-level transitions, and supply delivery tables.
 *
 * Pure logic — no React, no DOM, no store imports.
 * Source: ECONOMY_SYSTEM.md §3.
 */

import type {
  CompanyRelation,
  CompanySupportLevel,
  QuotaStatus,
  ResourceType,
} from '../turn/game-state';
import { clamp } from '../../utils/math';

// ─── Types ────────────────────────────────────────────────────────────────────

/** The amounts contributed by the player toward the current year's quota. */
export interface QuotaContribution {
  wealth: number;
}

/** The yearly quota requirements for a given year. */
export interface YearlyQuota {
  wealth: number;
}

/** Delivery contents of the annual resupply ship. */
export type SupplyDelivery = Partial<Record<ResourceType, number>>;

// ─── Constants ────────────────────────────────────────────────────────────────

/** Years 1–10 are an investment phase: no quota required by the Company. */
export const QUOTA_GRACE_YEARS = 10;

/**
 * Base supply deliveries per support level.
 * The annual ship delivers these amounts each spring.
 * During years 1–10 (investment phase) the Company funds the settlement directly.
 */
export const SUPPLY_DELIVERIES: Record<CompanySupportLevel, SupplyDelivery> = {
  full_support: { food: 15, wealth: 12, medicine: 5 },
  standard:     { food: 10, wealth: 7  },
  reduced:      { food: 5,  wealth: 3  },
  minimal:      { food: 2               },
  abandoned:    {},
};

// ─── Quota Computation ────────────────────────────────────────────────────────

/**
 * Computes the annual quota required for a given in-game year.
 *
 * Investment phase: years 1–10 return zero wealth (no quota expected).
 * From year 11: quota scales linearly, giving the player time to grow
 * their economy before the Company starts demanding returns.
 *
 * @param year - The current in-game year (1-indexed).
 */
export function computeYearlyQuota(year: number): YearlyQuota {
  if (year <= QUOTA_GRACE_YEARS) {
    return { wealth: 0 };
  }
  const delta = year - QUOTA_GRACE_YEARS;
  return { wealth: 10 + delta * 5 };
}

// ─── Quota Status Check ───────────────────────────────────────────────────────

/**
 * Checks whether the player's contributions satisfy the annual quota.
 *
 * Status thresholds (measured as fraction of total quota wealth delivered):
 *   exceeded  ≥ 110%
 *   met        90–109%  (±10% tolerance)
 *   partial    50– 89%
 *   failed      < 50%
 *
 * During the investment phase (quota = 0) the status is always 'exceeded'.
 *
 * @param contribution - How much wealth the player has contributed this year.
 * @param quota - The required wealth for this year.
 */
export function checkQuotaStatus(
  contribution: QuotaContribution,
  quota: YearlyQuota,
): QuotaStatus {
  // Investment phase: no requirements — automatically exceeded.
  if (quota.wealth === 0) return 'exceeded';

  const fraction = contribution.wealth / quota.wealth;

  if (fraction >= 1.1)  return 'exceeded';
  if (fraction >= 0.9)  return 'met';
  if (fraction >= 0.5)  return 'partial';
  return 'failed';
}

// ─── Failure Escalation ───────────────────────────────────────────────────────

/**
 * Returns the event ID that should fire as a consequence of a quota result,
 * or null if no event should fire.
 *
 * Event mapping per ECONOMY_SYSTEM.md §3.2:
 *   consecutiveFailures 1 → co_quota_warning
 *   consecutiveFailures 2 → co_inspector_arrives
 *   consecutiveFailures 3 → co_final_warning
 *   consecutiveFailures 4+ → co_abandoned (one-time only, checked via flag)
 */
export function getQuotaEventId(
  newConsecutiveFailures: number,
  currentlyAbandoned: boolean,
): string | null {
  if (currentlyAbandoned) return null;
  switch (newConsecutiveFailures) {
    case 1: return 'co_quota_warning';
    case 2: return 'co_inspector_arrives';
    case 3: return 'co_final_warning';
    default:
      if (newConsecutiveFailures >= 4) return 'co_abandoned';
      return null;
  }
}

/**
 * Returns the `CompanySupportLevel` derived from the current `consecutiveFailures` count.
 *
 * Level mapping:
 *   0         → full_support (or standard, based on standing context — caller decides)
 *   1         → standard → reduced
 *   2         → reduced
 *   3         → minimal
 *   4+        → abandoned
 */
export function deriveSupportLevel(consecutiveFailures: number): CompanySupportLevel {
  if (consecutiveFailures >= 4)  return 'abandoned';
  if (consecutiveFailures === 3) return 'minimal';
  if (consecutiveFailures === 2) return 'reduced';
  if (consecutiveFailures === 1) return 'standard';
  return 'full_support';
}

/**
 * Standing changes applied at the quota check, by status.
 * Positive = gain standing, negative = lose standing.
 */
export const QUOTA_STANDING_DELTAS: Record<QuotaStatus, number> = {
  exceeded: +8,
  met:       +3,
  partial:  -10,
  failed:   -15,
};

/**
 * Applies the quota result to the company relation state.
 *
 * Mutates nothing — returns a new CompanyRelation object.
 *
 * @param company - Current company relation.
 * @param status - Result of checkQuotaStatus().
 */
export function applyQuotaResult(
  company: CompanyRelation,
  status: QuotaStatus,
): CompanyRelation {
  const isMissed = status === 'partial' || status === 'failed';
  const isSuccess = status === 'met' || status === 'exceeded';

  const newConsecutiveFailures = isSuccess
    ? 0
    : company.consecutiveFailures + 1;

  const newSupportLevel = isSuccess
    ? (company.consecutiveFailures === 0 ? 'full_support' : 'standard')
    : deriveSupportLevel(newConsecutiveFailures);

  const standingDelta = QUOTA_STANDING_DELTAS[status];
  const newStanding = clamp(company.standing + standingDelta, 0, 100);

  return {
    ...company,
    standing: newStanding,
    consecutiveFailures: newConsecutiveFailures,
    supportLevel: newStanding === 0 ? 'abandoned' : newSupportLevel,
  };
}

// ─── Supply Delivery ─────────────────────────────────────────────────────────

/**
 * Returns the base supply delivery contents for a given support level.
 * The delivery is delivered by the annual resupply ship in spring (year 2+).
 *
 * @param supportLevel - Current Company support tier.
 */
export function getCompanySupplyDelivery(supportLevel: CompanySupportLevel): SupplyDelivery {
  return { ...SUPPLY_DELIVERIES[supportLevel] };
}

/**
 * Returns the supply delivery for a given year.
 * During years 1–10 (investment phase) the full wealth component is included.
 * From year 11 onward only non-monetary aid continues.
 *
 * @param supportLevel - Current Company support tier.
 * @param currentYear  - Current in-game year (1-indexed).
 */
export function computeAnnualDelivery(
  supportLevel: CompanySupportLevel,
  currentYear: number,
): SupplyDelivery {
  const base = getCompanySupplyDelivery(supportLevel);
  if (currentYear > QUOTA_GRACE_YEARS) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { wealth: _wealth, ...rest } = base;
    return rest;
  }
  return base;
}

// ─── Standing Decay ───────────────────────────────────────────────────────────

/**
 * Applies the yearly standing decay of 1 point toward the neutral value (50).
 * Called once per year at Winter-end (or during Spring transition in processDusk).
 *
 * @param standing - Current standing score.
 */
export function applyStandingDecay(standing: number): number {
  if (standing > 50) return standing - 1;
  if (standing < 50) return standing + 1;
  return 50;
}
