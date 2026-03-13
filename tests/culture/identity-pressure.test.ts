/**
 * Cultural identity pressure tests.
 *
 * Covers:
 *   - Pressure counter increment (native zone / Imanian zone)
 *   - Pressure counter reset when blend returns to safe zone
 *   - Company standing delta for all 5 zones
 *   - Boundary values at exact threshold
 *   - Empty tribes → empty tribeDispositionDeltas
 *   - Safe zone → no tribe deltas even when tribes present
 *   - Single-trait tribe deltas (warlike, isolationist, peaceful)
 *   - Multi-trait averaging (warlike + desperate, peaceful + isolationist)
 *   - Multiple tribes each receive independent deltas
 */

import { describe, it, expect } from 'vitest';
import {
  processIdentityPressure,
  IDENTITY_THRESHOLDS,
} from '../../src/simulation/culture/identity-pressure';
import type { IdentityPressure } from '../../src/simulation/turn/game-state';
import type { ExternalTribe } from '../../src/simulation/turn/game-state';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ZERO_PRESSURE: IdentityPressure = { companyPressureTurns: 0, tribalPressureTurns: 0 };

function makeTribe(id: string, traits: ExternalTribe['traits']): ExternalTribe {
  return {
    id,
    name: id,
    ethnicGroup: 'kiswani_riverfolk',
    population: 200,
    disposition: 10,
    stability: 0.7,
    contactEstablished: true,
    lastTradeTurn: null,
    tradeHistoryCount: 0,
    tradeDesires: [],
    tradeOfferings: [],
    desires: [],
    offerings: [],
    traits,
  };
}

function tribeMap(...tribes: ExternalTribe[]): Map<string, ExternalTribe> {
  return new Map(tribes.map(t => [t.id, t]));
}

// ─── Pressure counter: increment ─────────────────────────────────────────────

describe('processIdentityPressure — pressure counter increment', () => {
  it('increments companyPressureTurns when blend is in the soft native zone', () => {
    const result = processIdentityPressure(0.70, ZERO_PRESSURE, new Map());
    expect(result.updatedPressure.companyPressureTurns).toBe(1);
    expect(result.updatedPressure.tribalPressureTurns).toBe(0);
  });

  it('increments companyPressureTurns when blend is in the extreme native zone', () => {
    const result = processIdentityPressure(0.90, ZERO_PRESSURE, new Map());
    expect(result.updatedPressure.companyPressureTurns).toBe(1);
    expect(result.updatedPressure.tribalPressureTurns).toBe(0);
  });

  it('accumulates companyPressureTurns across multiple seasons in the native zone', () => {
    const prior: IdentityPressure = { companyPressureTurns: 5, tribalPressureTurns: 0 };
    const result = processIdentityPressure(0.70, prior, new Map());
    expect(result.updatedPressure.companyPressureTurns).toBe(6);
  });

  it('increments tribalPressureTurns when blend is in the soft Imanian zone', () => {
    const result = processIdentityPressure(0.15, ZERO_PRESSURE, new Map());
    expect(result.updatedPressure.tribalPressureTurns).toBe(1);
    expect(result.updatedPressure.companyPressureTurns).toBe(0);
  });

  it('increments tribalPressureTurns when blend is in the extreme Imanian zone', () => {
    const result = processIdentityPressure(0.05, ZERO_PRESSURE, new Map());
    expect(result.updatedPressure.tribalPressureTurns).toBe(1);
    expect(result.updatedPressure.companyPressureTurns).toBe(0);
  });

  it('accumulates tribalPressureTurns across multiple seasons in the Imanian zone', () => {
    const prior: IdentityPressure = { companyPressureTurns: 0, tribalPressureTurns: 3 };
    const result = processIdentityPressure(0.15, prior, new Map());
    expect(result.updatedPressure.tribalPressureTurns).toBe(4);
  });
});

// ─── Pressure counter: reset ──────────────────────────────────────────────────

describe('processIdentityPressure — pressure counter reset', () => {
  it('resets both counters to 0 when blend is in the safe zone', () => {
    const prior: IdentityPressure = { companyPressureTurns: 8, tribalPressureTurns: 5 };
    const result = processIdentityPressure(0.40, prior, new Map());
    expect(result.updatedPressure.companyPressureTurns).toBe(0);
    expect(result.updatedPressure.tribalPressureTurns).toBe(0);
  });

  it('resets companyPressureTurns when blend returns to safe zone from native', () => {
    const prior: IdentityPressure = { companyPressureTurns: 4, tribalPressureTurns: 0 };
    const result = processIdentityPressure(0.50, prior, new Map());
    expect(result.updatedPressure.companyPressureTurns).toBe(0);
  });

  it('resets tribalPressureTurns when blend returns to safe zone from Imanian', () => {
    const prior: IdentityPressure = { companyPressureTurns: 0, tribalPressureTurns: 6 };
    const result = processIdentityPressure(0.30, prior, new Map());
    expect(result.updatedPressure.tribalPressureTurns).toBe(0);
  });
});

// ─── Boundary values ──────────────────────────────────────────────────────────

describe('processIdentityPressure — boundary values', () => {
  const { EXTREME_IMANIAN, SOFT_IMANIAN, SAFE_ZONE_HIGH, EXTREME_NATIVE } = IDENTITY_THRESHOLDS;

  it('blend exactly at SOFT_IMANIAN (0.25) is in safe zone — no counters increment', () => {
    const result = processIdentityPressure(SOFT_IMANIAN, ZERO_PRESSURE, new Map());
    expect(result.updatedPressure.tribalPressureTurns).toBe(0);
    expect(result.updatedPressure.companyPressureTurns).toBe(0);
  });

  it('blend exactly at SAFE_ZONE_HIGH (0.65) is in safe zone — no counters increment', () => {
    const result = processIdentityPressure(SAFE_ZONE_HIGH, ZERO_PRESSURE, new Map());
    expect(result.updatedPressure.companyPressureTurns).toBe(0);
    expect(result.updatedPressure.tribalPressureTurns).toBe(0);
  });

  it('blend at EXTREME_IMANIAN (0.10) uses soft Imanian standing delta (+0.25)', () => {
    // 0.10 is NOT < 0.10, so soft Imanian branch (+0.25)
    const result = processIdentityPressure(EXTREME_IMANIAN, ZERO_PRESSURE, new Map());
    expect(result.companyStandingDelta).toBeCloseTo(0.25);
  });

  it('blend at EXTREME_NATIVE (0.80) uses soft native standing delta (-0.5)', () => {
    // 0.80 <= 0.80, so soft native branch (-0.5)
    const result = processIdentityPressure(EXTREME_NATIVE, ZERO_PRESSURE, new Map());
    expect(result.companyStandingDelta).toBeCloseTo(-0.5);
  });
});

// ─── Company standing delta ───────────────────────────────────────────────────

describe('processIdentityPressure — company standing delta', () => {
  it('returns +0.5 in extreme Imanian zone (blend < 0.10)', () => {
    const result = processIdentityPressure(0.05, ZERO_PRESSURE, new Map());
    expect(result.companyStandingDelta).toBeCloseTo(0.5);
  });

  it('returns +0.25 in soft Imanian zone (0.10 ≤ blend < 0.25)', () => {
    const result = processIdentityPressure(0.15, ZERO_PRESSURE, new Map());
    expect(result.companyStandingDelta).toBeCloseTo(0.25);
  });

  it('returns 0 in the safe zone (0.25 ≤ blend ≤ 0.65)', () => {
    expect(processIdentityPressure(0.25, ZERO_PRESSURE, new Map()).companyStandingDelta).toBe(0);
    expect(processIdentityPressure(0.40, ZERO_PRESSURE, new Map()).companyStandingDelta).toBe(0);
    expect(processIdentityPressure(0.65, ZERO_PRESSURE, new Map()).companyStandingDelta).toBe(0);
  });

  it('returns -0.5 in soft native zone (0.65 < blend ≤ 0.80)', () => {
    const result = processIdentityPressure(0.70, ZERO_PRESSURE, new Map());
    expect(result.companyStandingDelta).toBeCloseTo(-0.5);
  });

  it('returns -1.5 in extreme native zone (blend > 0.80)', () => {
    const result = processIdentityPressure(0.90, ZERO_PRESSURE, new Map());
    expect(result.companyStandingDelta).toBeCloseTo(-1.5);
  });
});

// ─── Tribe disposition deltas — safe zone (no deltas) ────────────────────────

describe('processIdentityPressure — safe zone produces no tribe deltas', () => {
  it('returns empty tribeDispositionDeltas when in safe zone with no tribes', () => {
    const result = processIdentityPressure(0.40, ZERO_PRESSURE, new Map());
    expect(result.tribeDispositionDeltas).toHaveLength(0);
  });

  it('returns empty tribeDispositionDeltas when in safe zone even with tribes present', () => {
    const tribes = tribeMap(makeTribe('t1', ['warlike']), makeTribe('t2', ['peaceful']));
    const result = processIdentityPressure(0.40, ZERO_PRESSURE, tribes);
    expect(result.tribeDispositionDeltas).toHaveLength(0);
  });

  it('returns empty tribeDispositionDeltas when blend is exactly at 0.25 (safe boundary)', () => {
    const tribes = tribeMap(makeTribe('t1', ['warlike']));
    const result = processIdentityPressure(0.25, ZERO_PRESSURE, tribes);
    expect(result.tribeDispositionDeltas).toHaveLength(0);
  });

  it('returns empty tribeDispositionDeltas when blend is exactly at 0.65 (safe boundary)', () => {
    const tribes = tribeMap(makeTribe('t1', ['warlike']));
    const result = processIdentityPressure(0.65, ZERO_PRESSURE, tribes);
    expect(result.tribeDispositionDeltas).toHaveLength(0);
  });
});

// ─── Tribe disposition deltas — Imanian zone ─────────────────────────────────

describe('processIdentityPressure — Imanian zone tribe deltas', () => {
  it('warlike tribe gets -2.7 delta in extreme Imanian zone', () => {
    // baseDelta=-1.5, multiplier=1.8 → -2.7
    const tribes = tribeMap(makeTribe('t1', ['warlike']));
    const result = processIdentityPressure(0.05, ZERO_PRESSURE, tribes);
    expect(result.tribeDispositionDeltas).toHaveLength(1);
    expect(result.tribeDispositionDeltas[0].delta).toBeCloseTo(-2.7);
  });

  it('warlike tribe gets -0.9 delta in soft Imanian zone', () => {
    // baseDelta=-0.5, multiplier=1.8 → -0.9
    const tribes = tribeMap(makeTribe('t1', ['warlike']));
    const result = processIdentityPressure(0.15, ZERO_PRESSURE, tribes);
    expect(result.tribeDispositionDeltas[0].delta).toBeCloseTo(-0.9);
  });

  it('isolationist tribe gets -0.15 delta in soft Imanian zone (dampened)', () => {
    // baseDelta=-0.5, multiplier=0.3 → -0.15
    const tribes = tribeMap(makeTribe('t1', ['isolationist']));
    const result = processIdentityPressure(0.15, ZERO_PRESSURE, tribes);
    expect(result.tribeDispositionDeltas[0].delta).toBeCloseTo(-0.15);
  });

  it('warlike + desperate tribe averages to -0.75 in soft Imanian zone', () => {
    // avg multiplier = (1.8 + 1.2) / 2 = 1.5; baseDelta=-0.5 → -0.75
    const tribes = tribeMap(makeTribe('t1', ['warlike', 'desperate']));
    const result = processIdentityPressure(0.15, ZERO_PRESSURE, tribes);
    expect(result.tribeDispositionDeltas[0].delta).toBeCloseTo(-0.75);
  });

  it('tribes with no traits default to multiplier 1.0', () => {
    // empty traits → computeTraitMultiplier returns 1.0; baseDelta=-0.5 → -0.5
    const tribes = tribeMap(makeTribe('t1', []));
    const result = processIdentityPressure(0.15, ZERO_PRESSURE, tribes);
    expect(result.tribeDispositionDeltas[0].delta).toBeCloseTo(-0.5);
  });

  it('tribeId is preserved in the delta entry', () => {
    const tribes = tribeMap(makeTribe('the_riverfolk', ['warlike']));
    const result = processIdentityPressure(0.15, ZERO_PRESSURE, tribes);
    expect(result.tribeDispositionDeltas[0].tribeId).toBe('the_riverfolk');
  });
});

// ─── Tribe disposition deltas — Native zone ───────────────────────────────────

describe('processIdentityPressure — native zone tribe deltas', () => {
  it('warlike tribe gets +0.65 delta in soft native zone', () => {
    // baseDelta=+0.5, multiplier=1.3 → +0.65
    const tribes = tribeMap(makeTribe('t1', ['warlike']));
    const result = processIdentityPressure(0.70, ZERO_PRESSURE, tribes);
    expect(result.tribeDispositionDeltas[0].delta).toBeCloseTo(0.65);
  });

  it('warlike tribe gets +1.3 delta in extreme native zone', () => {
    // baseDelta=+1.0, multiplier=1.3 → +1.3
    const tribes = tribeMap(makeTribe('t1', ['warlike']));
    const result = processIdentityPressure(0.90, ZERO_PRESSURE, tribes);
    expect(result.tribeDispositionDeltas[0].delta).toBeCloseTo(1.3);
  });

  it('isolationist tribe gets +0.15 delta in soft native zone (dampened)', () => {
    // baseDelta=+0.5, multiplier=0.3 → +0.15
    const tribes = tribeMap(makeTribe('t1', ['isolationist']));
    const result = processIdentityPressure(0.70, ZERO_PRESSURE, tribes);
    expect(result.tribeDispositionDeltas[0].delta).toBeCloseTo(0.15);
  });

  it('peaceful + isolationist tribe averages to +0.25 in soft native zone', () => {
    // avg multiplier = (0.7 + 0.3) / 2 = 0.5; baseDelta=+0.5 → +0.25
    const tribes = tribeMap(makeTribe('t1', ['peaceful', 'isolationist']));
    const result = processIdentityPressure(0.70, ZERO_PRESSURE, tribes);
    expect(result.tribeDispositionDeltas[0].delta).toBeCloseTo(0.25);
  });
});

// ─── Multiple tribes ──────────────────────────────────────────────────────────

describe('processIdentityPressure — multiple tribes', () => {
  it('returns one entry per tribe in the native zone', () => {
    const tribes = tribeMap(
      makeTribe('t1', ['warlike']),
      makeTribe('t2', ['peaceful']),
      makeTribe('t3', ['isolationist']),
    );
    const result = processIdentityPressure(0.70, ZERO_PRESSURE, tribes);
    expect(result.tribeDispositionDeltas).toHaveLength(3);
  });

  it('each tribe in the native zone gets the correct independent delta', () => {
    const tribes = tribeMap(
      makeTribe('warlike_tribe', ['warlike']),   // +0.5 × 1.3 = +0.65
      makeTribe('peaceful_tribe', ['peaceful']), // +0.5 × 0.7 = +0.35
    );
    const result = processIdentityPressure(0.70, ZERO_PRESSURE, tribes);

    const warlikeEntry  = result.tribeDispositionDeltas.find(d => d.tribeId === 'warlike_tribe');
    const peacefulEntry = result.tribeDispositionDeltas.find(d => d.tribeId === 'peaceful_tribe');

    expect(warlikeEntry?.delta).toBeCloseTo(0.65);
    expect(peacefulEntry?.delta).toBeCloseTo(0.35);
  });

  it('returns one entry per tribe in the Imanian zone', () => {
    const tribes = tribeMap(
      makeTribe('t1', ['expansionist']),
      makeTribe('t2', ['trader']),
    );
    const result = processIdentityPressure(0.05, ZERO_PRESSURE, tribes);
    expect(result.tribeDispositionDeltas).toHaveLength(2);
  });
});
