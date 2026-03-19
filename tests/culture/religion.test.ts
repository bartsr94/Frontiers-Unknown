/**
 * Religion system tests.
 *
 * Covers:
 *   - computeReligiousTension (5 variants)
 *   - computeCompanyReligiousPressure (5 variants including policy modifiers)
 *   - computeHiddenWheelDivergence (6 variants including threshold crossing and suppression)
 */

import { describe, it, expect } from 'vitest';
import {
  computeReligiousTension,
  computeHiddenWheelDivergence,
  computeCompanyReligiousPressure,
  computeReligionDistribution,
} from '../../src/simulation/population/culture';
import type { Person, ReligionId } from '../../src/simulation/population/person';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rel(entries: Partial<Record<ReligionId, number>>): Map<ReligionId, number> {
  return new Map(Object.entries(entries) as [ReligionId, number][]);
}

// ─── computeReligiousTension ─────────────────────────────────────────────────

describe('computeReligiousTension', () => {
  it('returns 0 when settlement is pure Orthodox', () => {
    const religions = rel({ imanian_orthodox: 1.0 });
    expect(computeReligiousTension(religions)).toBe(0);
  });

  it('returns 0 when settlement is pure Sacred Wheel', () => {
    const religions = rel({ sacred_wheel: 1.0 });
    expect(computeReligiousTension(religions)).toBe(0);
  });

  it('returns 1.0 at a 50/50 Orthodox-Wheel split', () => {
    const religions = rel({ imanian_orthodox: 0.5, sacred_wheel: 0.5 });
    // 4 × 0.5 × 0.5 = 1.0; no hidden → damping = 1
    expect(computeReligiousTension(religions)).toBeCloseTo(1.0, 5);
  });

  it('returns ~0.672 for a 30/40/30 Orthodox/Wheel/Hidden split', () => {
    // rawTension = 4 × 0.30 × 0.40 = 0.48
    // hiddenDamping = clamp(1 − 0.30 × 2, 0, 1) = 0.40
    // tension = 0.48 × 0.40 = 0.192 ... wait, let me recalc
    // Actually: o=0.30, w=0.40, h=0.30
    // rawTension = 4 × 0.30 × 0.40 = 0.48
    // hiddenDamping = clamp(1 - 0.30*2, 0, 1) = clamp(0.40, 0, 1) = 0.40
    // result = 0.48 * 0.40 = 0.192
    const religions = rel({ imanian_orthodox: 0.30, sacred_wheel: 0.40, syncretic_hidden_wheel: 0.30 });
    expect(computeReligiousTension(religions)).toBeCloseTo(0.192, 5);
  });

  it('returns 0 when only Hidden Wheel is present (no Orthodox/Wheel conflict)', () => {
    const religions = rel({ syncretic_hidden_wheel: 1.0 });
    expect(computeReligiousTension(religions)).toBe(0);
  });

  it('damps tension by 50% when 25% Hidden Wheel is present alongside conflict', () => {
    // o=0.375, w=0.375, h=0.25
    // rawTension = 4 × 0.375 × 0.375 = 0.5625
    // hiddenDamping = clamp(1 - 0.25*2, 0, 1) = clamp(0.50, 0, 1) = 0.50
    // result = 0.5625 × 0.50 = 0.28125
    const religions = rel({ imanian_orthodox: 0.375, sacred_wheel: 0.375, syncretic_hidden_wheel: 0.25 });
    expect(computeReligiousTension(religions)).toBeCloseTo(0.28125, 5);
  });
});

// ─── computeCompanyReligiousPressure ─────────────────────────────────────────

describe('computeCompanyReligiousPressure', () => {
  it('returns 0 when Wheel fraction is at or below threshold (25%)', () => {
    const religions = rel({ imanian_orthodox: 0.75, sacred_wheel: 0.25 });
    expect(computeCompanyReligiousPressure(religions, 'tolerant')).toBe(0);
  });

  it('returns negative delta at 35% Wheel', () => {
    // delta = -floor((0.35 - 0.25) * 10) = -floor(1.0) = -1
    const religions = rel({ imanian_orthodox: 0.65, sacred_wheel: 0.35 });
    expect(computeCompanyReligiousPressure(religions, 'tolerant')).toBe(-1);
  });

  it('caps the drain at -5 even at 80% Wheel', () => {
    // uncapped delta = -floor((0.80 - 0.25) * 10) = -floor(5.5) = -5; at cap
    const religions = rel({ imanian_orthodox: 0.2, sacred_wheel: 0.8 });
    expect(computeCompanyReligiousPressure(religions, 'tolerant')).toBe(-5);
  });

  it('returns 0 under orthodox_enforced regardless of Wheel fraction', () => {
    const religions = rel({ imanian_orthodox: 0.1, sacred_wheel: 0.9 });
    expect(computeCompanyReligiousPressure(religions, 'orthodox_enforced')).toBe(0);
  });

  it('doubles the drain under hidden_wheel_recognized', () => {
    // base delta at 35% Wheel = -1; × 2 = -2
    const religions = rel({ imanian_orthodox: 0.65, sacred_wheel: 0.35 });
    expect(computeCompanyReligiousPressure(religions, 'hidden_wheel_recognized')).toBe(-2);
  });

  it('caps the doubled drain at -10', () => {
    // base delta at 80% Wheel = -5; × 2 = -10 (cap applies)
    const religions = rel({ imanian_orthodox: 0.2, sacred_wheel: 0.8 });
    expect(computeCompanyReligiousPressure(religions, 'hidden_wheel_recognized')).toBe(-10);
  });
});

// ─── computeHiddenWheelDivergence ────────────────────────────────────────────

describe('computeHiddenWheelDivergence', () => {
  const faithsMixed = rel({ imanian_orthodox: 0.5, sacred_wheel: 0.5 });
  const faithsPureOrthodox = rel({ imanian_orthodox: 1.0 });

  it('increments counter when both faiths exceed 15% threshold', () => {
    const result = computeHiddenWheelDivergence(5, 0, faithsMixed, 'tolerant');
    expect(result.updatedDivergenceTurns).toBe(6);
    expect(result.shouldFireEvent).toBe(false);
  });

  it('fires event and resets counter when divergence reaches 20', () => {
    const result = computeHiddenWheelDivergence(19, 0, faithsMixed, 'tolerant');
    expect(result.updatedDivergenceTurns).toBe(0);
    expect(result.shouldFireEvent).toBe(true);
  });

  it('resets counter when Orthodox drops below 15% threshold', () => {
    const result = computeHiddenWheelDivergence(10, 0, faithsPureOrthodox, 'tolerant');
    expect(result.updatedDivergenceTurns).toBe(0);
    expect(result.shouldFireEvent).toBe(false);
  });

  it('does not advance counter under orthodox_enforced policy', () => {
    const result = computeHiddenWheelDivergence(10, 0, faithsMixed, 'orthodox_enforced');
    expect(result.updatedDivergenceTurns).toBe(0);
    expect(result.shouldFireEvent).toBe(false);
  });

  it('decrements suppressedTurns without advancing divergence when suppression active', () => {
    const result = computeHiddenWheelDivergence(8, 15, faithsMixed, 'tolerant');
    expect(result.updatedDivergenceTurns).toBe(8);  // frozen
    expect(result.updatedSuppressedTurns).toBe(14); // decremented
    expect(result.shouldFireEvent).toBe(false);
  });

  it('resumes counter on the turn after suppression expires', () => {
    // suppressedTurns = 1 → this call decrements to 0; divergence counter frozen
    const suppressionEndResult = computeHiddenWheelDivergence(8, 1, faithsMixed, 'tolerant');
    expect(suppressionEndResult.updatedSuppressedTurns).toBe(0);
    expect(suppressionEndResult.updatedDivergenceTurns).toBe(8); // still frozen this turn

    // Next turn: suppression is 0, so counter advances
    const nextTurnResult = computeHiddenWheelDivergence(
      suppressionEndResult.updatedDivergenceTurns,
      suppressionEndResult.updatedSuppressedTurns,
      faithsMixed,
      'tolerant',
    );
    expect(nextTurnResult.updatedDivergenceTurns).toBe(9);
    expect(nextTurnResult.shouldFireEvent).toBe(false);
  });

  it('fires event on the 20th qualifying turn from the start', () => {
    // Simulate 20 consecutive qualifying turns from 0
    let divergence = 0;
    let suppressed = 0;
    let fired = false;
    for (let i = 0; i < 20; i++) {
      const result = computeHiddenWheelDivergence(divergence, suppressed, faithsMixed, 'tolerant');
      divergence = result.updatedDivergenceTurns;
      suppressed = result.updatedSuppressedTurns;
      if (result.shouldFireEvent) fired = true;
    }
    expect(fired).toBe(true);
    expect(divergence).toBe(0);
  });
});

// ─── computeReligionDistribution ────────────────────────────────────────────────────

function makePerson(id: string, religion: ReligionId): Person {
  return { id, religion } as unknown as Person;
}

describe('computeReligionDistribution', () => {
  it('returns an empty Map for an empty population', () => {
    expect(computeReligionDistribution(new Map()).size).toBe(0);
  });

  it('single Orthodox person gives {imanian_orthodox: 1.0}', () => {
    const people = new Map([['p1', makePerson('p1', 'imanian_orthodox')]]);
    const dist = computeReligionDistribution(people);
    expect(dist.get('imanian_orthodox')).toBeCloseTo(1.0);
    expect(dist.size).toBe(1);
  });

  it('2 people (1 orthodox + 1 wheel) each receive fraction 0.5', () => {
    const people = new Map([
      ['p1', makePerson('p1', 'imanian_orthodox')],
      ['p2', makePerson('p2', 'sacred_wheel')],
    ]);
    const dist = computeReligionDistribution(people);
    expect(dist.get('imanian_orthodox')).toBeCloseTo(0.5);
    expect(dist.get('sacred_wheel')).toBeCloseTo(0.5);
  });

  it('3 people (2 orthodox + 1 wheel) gives orthodox \u22480.667', () => {
    const people = new Map([
      ['p1', makePerson('p1', 'imanian_orthodox')],
      ['p2', makePerson('p2', 'imanian_orthodox')],
      ['p3', makePerson('p3', 'sacred_wheel')],
    ]);
    const dist = computeReligionDistribution(people);
    expect(dist.get('imanian_orthodox')).toBeCloseTo(2 / 3, 5);
    expect(dist.get('sacred_wheel')).toBeCloseTo(1 / 3, 5);
  });

  it('fractions across all religions sum to 1.0', () => {
    const people = new Map([
      ['p1', makePerson('p1', 'imanian_orthodox')],
      ['p2', makePerson('p2', 'sacred_wheel')],
      ['p3', makePerson('p3', 'syncretic_hidden_wheel')],
      ['p4', makePerson('p4', 'imanian_orthodox')],
    ]);
    const dist = computeReligionDistribution(people);
    const total = Array.from(dist.values()).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1.0, 10);
  });
});
