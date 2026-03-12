/**
 * Unit tests for the skills system in src/simulation/population/person.ts
 *
 * Covers:
 *   - getSkillRating: correct rating for boundary and mid-range values
 *   - getDerivedSkill: correct formula for each of the 7 derived skills
 *   - generatePersonSkills: output bounds, determinism, trait bonuses
 *   - createPerson: skills field present; default without RNG; generated with RNG
 */

import { describe, it, expect } from 'vitest';
import {
  getSkillRating,
  getDerivedSkill,
  generatePersonSkills,
  createPerson,
} from '../../src/simulation/population/person';
import type { PersonSkills, SkillRating } from '../../src/simulation/population/person';
import { createRNG } from '../../src/utils/rng';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns a PersonSkills object with all skills set to the given value. */
function allSkills(value: number): PersonSkills {
  return { animals: value, bargaining: value, combat: value, custom: value, leadership: value, plants: value };
}

/** Returns a PersonSkills object with individual overrides. */
function skills(overrides: Partial<PersonSkills>): PersonSkills {
  return { ...allSkills(10), ...overrides };
}

// ─── getSkillRating ───────────────────────────────────────────────────────────

describe('getSkillRating', () => {
  const cases: Array<[number, SkillRating]> = [
    [1,   'fair'],
    [25,  'fair'],
    [26,  'good'],
    [45,  'good'],
    [46,  'very_good'],
    [62,  'very_good'],
    [63,  'excellent'],
    [77,  'excellent'],
    [78,  'renowned'],
    [90,  'renowned'],
    [91,  'heroic'],
    [100, 'heroic'],
  ];

  it.each(cases)('value %i → %s', (value, expected) => {
    expect(getSkillRating(value)).toBe(expected);
  });

  it('treats zero as fair (clamp safety)', () => {
    // Zero is out-of-range but should not throw
    expect(getSkillRating(0)).toBe('fair');
  });
});

// ─── getDerivedSkill ──────────────────────────────────────────────────────────

describe('getDerivedSkill', () => {
  it('deception = avg(bargaining, leadership)', () => {
    expect(getDerivedSkill(skills({ bargaining: 60, leadership: 40 }), 'deception')).toBe(50);
  });

  it('diplomacy = avg(bargaining, custom)', () => {
    expect(getDerivedSkill(skills({ bargaining: 70, custom: 30 }), 'diplomacy')).toBe(50);
  });

  it('exploring = avg(bargaining, combat)', () => {
    expect(getDerivedSkill(skills({ bargaining: 80, combat: 20 }), 'exploring')).toBe(50);
  });

  it('farming = avg(animals, plants)', () => {
    expect(getDerivedSkill(skills({ animals: 60, plants: 40 }), 'farming')).toBe(50);
  });

  it('hunting = avg(animals, combat, plants)', () => {
    expect(getDerivedSkill(skills({ animals: 90, combat: 30, plants: 60 }), 'hunting')).toBe(60);
  });

  it('poetry = avg(custom, leadership)', () => {
    expect(getDerivedSkill(skills({ custom: 50, leadership: 50 }), 'poetry')).toBe(50);
  });

  it('strategy = avg(combat, leadership)', () => {
    expect(getDerivedSkill(skills({ combat: 100, leadership: 80 }), 'strategy')).toBe(90);
  });

  it('rounds fractional averages to the nearest integer', () => {
    // avg(60, 61) = 60.5 → rounds to 61
    expect(getDerivedSkill(skills({ bargaining: 60, leadership: 61 }), 'deception')).toBe(61);
  });

  it('hunting with non-divisible values rounds correctly', () => {
    // avg(10, 10, 11) = 10.333… → rounds to 10
    expect(getDerivedSkill(skills({ animals: 10, combat: 10, plants: 11 }), 'hunting')).toBe(10);
  });
});

// ─── generatePersonSkills ─────────────────────────────────────────────────────

describe('generatePersonSkills', () => {
  it('returns all six skill keys', () => {
    const rng = createRNG(1);
    const result = generatePersonSkills([], rng);
    expect(Object.keys(result).sort()).toEqual(
      ['animals', 'bargaining', 'combat', 'custom', 'leadership', 'plants'].sort(),
    );
  });

  it('all values are integers in [1, 100]', () => {
    const rng = createRNG(2);
    // Generate 50 skill sets to probe the clamp range
    for (let i = 0; i < 50; i++) {
      const result = generatePersonSkills([], rng);
      for (const value of Object.values(result)) {
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(100);
        expect(Number.isInteger(value)).toBe(true);
      }
    }
  });

  it('is deterministic for the same seed', () => {
    const rng1 = createRNG(42);
    const rng2 = createRNG(42);
    expect(generatePersonSkills([], rng1)).toEqual(generatePersonSkills([], rng2));
  });

  it('differs for different seeds', () => {
    const a = generatePersonSkills([], createRNG(1));
    const b = generatePersonSkills([], createRNG(99999));
    // At least one skill should differ
    const anyDiffer = (['animals', 'bargaining', 'combat', 'custom', 'leadership', 'plants'] as const)
      .some(k => a[k] !== b[k]);
    expect(anyDiffer).toBe(true);
  });

  it('applies veteran trait bonus to combat (+20)', () => {
    // Run many seeds and confirm that the veteran bonus shifts combat upward on average
    let baseSum = 0;
    let veteranSum = 0;
    const N = 200;
    for (let i = 0; i < N; i++) {
      const rng1 = createRNG(i);
      const rng2 = createRNG(i);
      baseSum    += generatePersonSkills([], rng1).combat;
      veteranSum += generatePersonSkills(['veteran'], rng2).combat;
    }
    // The veteran mean should be higher (bonus is +20)
    expect(veteranSum / N).toBeGreaterThan(baseSum / N + 10);
  });

  it('applies brave trait bonus to combat (+15) and leadership (+5)', () => {
    let baseCombat = 0, braveCombat = 0;
    let baseLeader = 0, braveLeader = 0;
    const N = 200;
    for (let i = 0; i < N; i++) {
      const rng1 = createRNG(i);
      const rng2 = createRNG(i);
      const base  = generatePersonSkills([], rng1);
      const brave = generatePersonSkills(['brave'], rng2);
      baseCombat  += base.combat;    braveCombat  += brave.combat;
      baseLeader  += base.leadership; braveLeader += brave.leadership;
    }
    expect(braveCombat / N).toBeGreaterThan(baseCombat / N + 8);
    expect(braveLeader / N).toBeGreaterThan(baseLeader / N + 2);
  });

  it('clamps boosted values to 100 — does not exceed cap', () => {
    // Use an extremely high seed batch to trigger high base rolls + multiple bonuses
    const powerTraits = ['brave', 'strong', 'veteran'] as const;
    for (let i = 0; i < 500; i++) {
      const result = generatePersonSkills([...powerTraits], createRNG(i));
      expect(result.combat).toBeLessThanOrEqual(100);
    }
  });

  it('clamps values to minimum 1 — does not go below floor', () => {
    for (let i = 0; i < 500; i++) {
      const result = generatePersonSkills([], createRNG(i));
      for (const value of Object.values(result)) {
        expect(value).toBeGreaterThanOrEqual(1);
      }
    }
  });
});

// ─── createPerson skills integration ─────────────────────────────────────────

describe('createPerson skills field', () => {
  it('defaults all skills to 25 when no rng is provided', () => {
    const person = createPerson({});
    expect(person.skills).toEqual({
      animals: 25, bargaining: 25, combat: 25,
      custom: 25, leadership: 25, plants: 25,
    });
  });

  it('uses provided skills object directly (no rng needed)', () => {
    const provided: PersonSkills = { animals: 10, bargaining: 20, combat: 30, custom: 40, leadership: 50, plants: 60 };
    const person = createPerson({ skills: provided });
    expect(person.skills).toEqual(provided);
  });

  it('generates skills from rng when rng is provided and no skills override', () => {
    const rng = createRNG(7);
    const person = createPerson({}, rng);
    // Generated skills will NOT all equal 25
    const allDefault = Object.values(person.skills).every(v => v === 25);
    expect(allDefault).toBe(false);
  });

  it('honours provided skills override even when rng is supplied', () => {
    const rng = createRNG(7);
    const provided: PersonSkills = { animals: 99, bargaining: 99, combat: 99, custom: 99, leadership: 99, plants: 99 };
    const person = createPerson({ skills: provided }, rng);
    expect(person.skills).toEqual(provided);
  });

  it('generated skills are in [1, 100]', () => {
    for (let seed = 0; seed < 50; seed++) {
      const person = createPerson({}, createRNG(seed));
      for (const value of Object.values(person.skills)) {
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(100);
      }
    }
  });

  it('generated skills are influenced by traits on the person', () => {
    // A veteran person should have higher combat on average than a no-trait person
    let veteranCombat = 0;
    let baseCombat = 0;
    const N = 100;
    for (let i = 0; i < N; i++) {
      const rng1 = createRNG(i);
      const rng2 = createRNG(i);
      veteranCombat += createPerson({ traits: ['veteran'] }, rng1).skills.combat;
      baseCombat    += createPerson({ traits: [] },          rng2).skills.combat;
    }
    expect(veteranCombat / N).toBeGreaterThan(baseCombat / N + 10);
  });
});
