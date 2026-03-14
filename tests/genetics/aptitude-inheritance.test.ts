/**
 * Tests for the aptitude trait inheritance engine (inheritAptitudeTraits).
 *
 * Covers:
 *   1. Traits with no inheritWeight are never passed on
 *   2. Traits held by neither parent are never inherited
 *   3. One-parent inheritance at base probability
 *   4. Both-parents bonus (1.5× factor)
 *   5. determinism — same RNG seed produces same results
 *   6. Non-aptitude traits (e.g. personality 'brave') not in inherit path
 */

import { describe, it, expect } from 'vitest';
import { createRNG } from '../../src/utils/rng';
import type { Person } from '../../src/simulation/population/person';
import type { TraitId } from '../../src/simulation/personality/traits';
import { inheritAptitudeTraits } from '../../src/simulation/genetics/inheritance';

// ─── Test helper ──────────────────────────────────────────────────────────────

function makeParent(id: string, traits: TraitId[] = []): Person {
  return {
    id,
    firstName: `${id}`,
    familyName: 'Test',
    sex: id.startsWith('m') ? 'male' : 'female',
    age: 30,
    alive: true,
    role: 'unassigned',
    socialStatus: 'settler',
    traits,
    religion: 'imanian_orthodox',
    heritage: {
      bloodline: [{ group: 'imanian', fraction: 1.0 }],
      primaryCulture: 'ansberite',
      culturalFluency: new Map(),
    },
    genetics: {
      visibleTraits: {
        skinTone: 0.3,
        hairColor: 'brown',
        hairTexture: 'straight',
        eyeColor: 'blue',
        buildType: 'athletic',
        height: 'average',
        facialStructure: 'oval',
      },
      genderRatioModifier: 0,
      extendedFertility: false,
    },
    languages: [],
    spouseIds: [],
    childIds: [],
    motherIds: [],
    fatherIds: [],
    relationships: new Map(),
    householdId: null,
    householdRole: null,
    ashkaMelathiPartnerIds: [],
    ambition: null,
    opinionModifiers: [],
    skills: { animals: 25, bargaining: 25, combat: 25, custom: 25, leadership: 25, plants: 25 },
    portraitVariant: 1,
  } as unknown as Person;
}

// ─── Inheritance tests ────────────────────────────────────────────────────────

describe('inheritAptitudeTraits', () => {
  it('returns empty array when neither parent has any inheritable traits', () => {
    const mother = makeParent('fA', ['brave', 'kind', 'zealous'] as TraitId[]);
    const father = makeParent('mB', ['greedy', 'humble'] as TraitId[]);
    // brave, kind, zealous, greedy, humble have no inheritWeight
    const rng = createRNG(1);
    const result = inheritAptitudeTraits(mother, father, rng);
    expect(result).toHaveLength(0);
  });

  it('robust (inheritWeight 0.35) can be inherited when one parent has it', () => {
    const mother = makeParent('fA', ['robust'] as TraitId[]);
    const father = makeParent('mB', []);
    let inherited = false;
    for (let seed = 1; seed <= 50; seed++) {
      const result = inheritAptitudeTraits(mother, father, createRNG(seed));
      if (result.includes('robust' as TraitId)) { inherited = true; break; }
    }
    // 35% chance each seed — over 50 seeds, P(never) = (0.65)^50 ≈ 0.000012
    expect(inherited).toBe(true);
  });

  it('sickly (inheritWeight 0.30) is never inherited when neither parent has it', () => {
    const mother = makeParent('fA', ['brave'] as TraitId[]);
    const father = makeParent('mB', ['kind'] as TraitId[]);
    for (let seed = 1; seed <= 100; seed++) {
      const result = inheritAptitudeTraits(mother, father, createRNG(seed));
      expect(result).not.toContain('sickly');
    }
  });

  it('green_thumb inherits at higher rate when both parents have it', () => {
    const mother = makeParent('fA', ['green_thumb'] as TraitId[]);
    const father = makeParent('mB', ['green_thumb'] as TraitId[]);
    const singleMother = makeParent('fC', ['green_thumb'] as TraitId[]);
    const emptyFather = makeParent('mD', []);

    const TRIALS = 200;
    let bothCount = 0;
    let oneCount = 0;

    for (let seed = 1; seed <= TRIALS; seed++) {
      const bothResult = inheritAptitudeTraits(mother, father, createRNG(seed));
      if (bothResult.includes('green_thumb' as TraitId)) bothCount++;

      const oneResult = inheritAptitudeTraits(singleMother, emptyFather, createRNG(seed));
      if (oneResult.includes('green_thumb' as TraitId)) oneCount++;
    }

    // Both parents: ~30% × 1.5 = ~45%; one parent: ~20% → both should be higher
    expect(bothCount).toBeGreaterThan(oneCount);
  });

  it('determinism — same seed produces identical result', () => {
    const mother = makeParent('fA', ['robust', 'sickly', 'iron_constitution'] as TraitId[]);
    const father = makeParent('mB', ['robust', 'keen_hunter'] as TraitId[]);

    const r1 = inheritAptitudeTraits(mother, father, createRNG(999));
    const r2 = inheritAptitudeTraits(mother, father, createRNG(999));
    expect(r1).toEqual(r2);
  });

  it('personality traits like brave are not passed through inheritAptitudeTraits', () => {
    // brave has no inheritWeight, so should never appear
    const mother = makeParent('fA', ['brave', 'craven'] as TraitId[]);
    const father = makeParent('mB', ['brave'] as TraitId[]);
    for (let seed = 1; seed <= 100; seed++) {
      const result = inheritAptitudeTraits(mother, father, createRNG(seed));
      expect(result).not.toContain('brave');
      expect(result).not.toContain('craven');
    }
  });

  it('fleet_footed (inheritWeight 0.15) is inherited at a lower rate than robust (0.35)', () => {
    const mother = makeParent('fA', ['fleet_footed', 'robust'] as TraitId[]);
    const father = makeParent('mB', []);

    const TRIALS = 200;
    let fleetCount = 0;
    let robustCount = 0;

    for (let seed = 1; seed <= TRIALS; seed++) {
      const result = inheritAptitudeTraits(mother, father, createRNG(seed));
      if (result.includes('fleet_footed' as TraitId)) fleetCount++;
      if (result.includes('robust' as TraitId)) robustCount++;
    }

    // robust (35%) should fire more than fleet_footed (15%)
    expect(robustCount).toBeGreaterThan(fleetCount);
  });
});
