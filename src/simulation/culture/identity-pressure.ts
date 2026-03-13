/**
 * Cultural identity pressure system.
 *
 * The settlement's cultural blend (0.0 = fully Imanian, 1.0 = fully Sauromatian)
 * is divided into five zones. Drifting outside the safe zone (0.25–0.65) triggers
 * passive standing/disposition deltas and increments pressure counters that gate
 * identity-specific events.
 *
 * No React / DOM / store imports — pure simulation logic.
 * No Math.random() — all logic is deterministic.
 */

import type { IdentityPressure } from '../turn/game-state';
import type { ExternalTribe, TribeTrait } from '../turn/game-state';

// ─── Zone constants ───────────────────────────────────────────────────────────

export const IDENTITY_THRESHOLDS = {
  EXTREME_IMANIAN: 0.10,   // < this → extreme Imanian zone
  SOFT_IMANIAN:    0.25,   // < this → soft Imanian zone (or lower)
  SAFE_ZONE_HIGH:  0.65,   // ≤ this → safe zone
  EXTREME_NATIVE:  0.80,   // > this → extreme native zone
} as const;

// ─── Result type ──────────────────────────────────────────────────────────────

export interface IdentityPressureResult {
  updatedPressure: IdentityPressure;
  /** Delta applied to CompanyRelation.standing this season (positive = increase). */
  companyStandingDelta: number;
  /** Per-tribe disposition deltas. Applied by the store on startTurn. */
  tribeDispositionDeltas: Array<{ tribeId: string; delta: number }>;
}

// ─── Tribe trait multiplier tables ───────────────────────────────────────────

/**
 * Base disposition delta multipliers per TribeTrait.
 * "Imanian zone" = player blend < 0.25 (tribe sees a foreign enclave).
 * "Native zone"  = player blend > 0.65 (tribe sees a culturally aligned neighbour).
 */
const TRAIT_MULTIPLIERS_IMANIAN: Record<TribeTrait, number> = {
  warlike:      1.8,
  peaceful:     1.0,
  isolationist: 0.3,
  trader:       0.7,
  expansionist: 1.5,
  desperate:    1.2,
};

const TRAIT_MULTIPLIERS_NATIVE: Record<TribeTrait, number> = {
  warlike:      1.3,
  peaceful:     0.7,
  isolationist: 0.3,
  trader:       0.6,
  expansionist: 0.3,
  desperate:    1.2,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeTraitMultiplier(
  traits: TribeTrait[],
  table: Record<TribeTrait, number>,
): number {
  if (traits.length === 0) return 1.0;
  const sum = traits.reduce((acc, t) => acc + table[t], 0);
  return sum / traits.length;
}

// ─── Main function ────────────────────────────────────────────────────────────

/**
 * Processes one season of cultural identity pressure.
 *
 * @param blend           - Current cultural blend (0.0–1.0).
 * @param currentPressure - Counters from the previous turn.
 * @param tribes          - All external tribes in the region.
 * @returns Updated pressure counters, Company standing delta, and per-tribe
 *          disposition deltas. The caller (store) applies these to GameState.
 */
export function processIdentityPressure(
  blend: number,
  currentPressure: IdentityPressure,
  tribes: Map<string, ExternalTribe>,
): IdentityPressureResult {
  const { EXTREME_IMANIAN, SOFT_IMANIAN, SAFE_ZONE_HIGH, EXTREME_NATIVE } = IDENTITY_THRESHOLDS;

  // ── 1. Determine zone ───────────────────────────────────────────────────────
  const inNativeZone   = blend > SAFE_ZONE_HIGH;
  const inImanianZone  = blend < SOFT_IMANIAN;

  // ── 2. Update pressure counters ─────────────────────────────────────────────
  const companyPressureTurns = inNativeZone
    ? currentPressure.companyPressureTurns + 1
    : 0;
  const tribalPressureTurns = inImanianZone
    ? currentPressure.tribalPressureTurns + 1
    : 0;

  // ── 3. Company standing delta ───────────────────────────────────────────────
  let companyStandingDelta: number;
  if (blend < EXTREME_IMANIAN) {
    companyStandingDelta = 0.5;
  } else if (blend < SOFT_IMANIAN) {
    companyStandingDelta = 0.25;
  } else if (blend <= SAFE_ZONE_HIGH) {
    companyStandingDelta = 0;
  } else if (blend <= EXTREME_NATIVE) {
    companyStandingDelta = -0.5;
  } else {
    companyStandingDelta = -1.5;
  }

  // ── 4. Per-tribe disposition deltas ─────────────────────────────────────────
  const tribeDispositionDeltas: Array<{ tribeId: string; delta: number }> = [];

  for (const tribe of tribes.values()) {
    let baseDelta: number;
    let multiplierTable: Record<TribeTrait, number>;

    if (blend < EXTREME_IMANIAN) {
      baseDelta = -1.5;
      multiplierTable = TRAIT_MULTIPLIERS_IMANIAN;
    } else if (blend < SOFT_IMANIAN) {
      baseDelta = -0.5;
      multiplierTable = TRAIT_MULTIPLIERS_IMANIAN;
    } else if (blend <= SAFE_ZONE_HIGH) {
      // Safe zone — no passive pressure in either direction
      baseDelta = 0;
      multiplierTable = TRAIT_MULTIPLIERS_IMANIAN; // unused when baseDelta is 0
    } else if (blend <= EXTREME_NATIVE) {
      baseDelta = 0.5;
      multiplierTable = TRAIT_MULTIPLIERS_NATIVE;
    } else {
      baseDelta = 1.0;
      multiplierTable = TRAIT_MULTIPLIERS_NATIVE;
    }

    if (baseDelta === 0) continue;

    const multiplier = computeTraitMultiplier(tribe.traits, multiplierTable);
    const delta = baseDelta * multiplier;
    tribeDispositionDeltas.push({ tribeId: tribe.id, delta });
  }

  return {
    updatedPressure: { companyPressureTurns, tribalPressureTurns },
    companyStandingDelta,
    tribeDispositionDeltas,
  };
}
