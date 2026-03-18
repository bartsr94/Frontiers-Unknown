/**
 * Tests for the aptitude trait inheritance engine (inheritAptitudeTraits).
 *
 * Covers:
 *   1.  Traits with no inheritWeight are never passed on
 *   2.  Traits held by neither parent are never inherited
 *   3.  One-parent aptitude inheritance at base probability
 *   4.  Both-parents bonus (1.5× factor) for aptitude traits
 *   5.  Determinism — same RNG seed produces same results
 *   6.  Personality traits WITH inheritWeight can now be passed at birth
 *   7.  Personality traits WITHOUT inheritWeight are never passed
 *   8.  Conflicting personality traits (brave/cowardly) are never co-inherited
 *   9.  Aptitude conflict guard (robust/sickly) also applies to existing traits
 *   10. All major personality conflict pairs are mutually exclusive at birth
 *   11. Both-parents bonus applies to personality traits too
 *   12. Multiple non-conflicting traits can all appear on the same child
 *   13. Personality traits with low inheritWeight fire less often than high ones
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
    const mother = makeParent('fA', ['kind', 'honest', 'zealous'] as TraitId[]);
    const father = makeParent('mB', ['greedy', 'generous'] as TraitId[]);
    // kind, honest, zealous, greedy, generous have no inheritWeight
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

  it('personality traits with inheritWeight (brave) can be passed at birth', () => {
    // brave now has inheritWeight 0.15 — should be inherited at least once in 50 seeds
    const mother = makeParent('fA', ['brave'] as TraitId[]);
    const father = makeParent('mB', []);
    let inherited = false;
    for (let seed = 1; seed <= 50; seed++) {
      const result = inheritAptitudeTraits(mother, father, createRNG(seed));
      if (result.includes('brave' as TraitId)) { inherited = true; break; }
    }
    // P(never in 50 seeds) = (0.85)^50 ≈ 0.00027
    expect(inherited).toBe(true);
  });

  it('traits without inheritWeight (kind, generous) are never passed at birth', () => {
    // kind and generous are socially learned — no inheritWeight
    const mother = makeParent('fA', ['kind', 'generous'] as TraitId[]);
    const father = makeParent('mB', ['kind'] as TraitId[]);
    for (let seed = 1; seed <= 100; seed++) {
      const result = inheritAptitudeTraits(mother, father, createRNG(seed));
      expect(result).not.toContain('kind');
      expect(result).not.toContain('generous');
    }
  });

  it('conflicting personality traits (brave/cowardly) are never co-inherited', () => {
    const mother = makeParent('fA', ['brave'] as TraitId[]);
    const father = makeParent('mB', ['cowardly'] as TraitId[]);
    for (let seed = 1; seed <= 100; seed++) {
      const result = inheritAptitudeTraits(mother, father, createRNG(seed));
      const hasBrave = result.includes('brave' as TraitId);
      const hasCowardly = result.includes('cowardly' as TraitId);
      expect(hasBrave && hasCowardly).toBe(false);
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

  // ─── Personality trait inheritance ───────────────────────────────────────

  it('gregarious (personality, inheritWeight 0.20) can be inherited from one parent', () => {
    const mother = makeParent('fA', ['gregarious'] as TraitId[]);
    const father = makeParent('mB', []);
    let inherited = false;
    for (let seed = 1; seed <= 50; seed++) {
      const result = inheritAptitudeTraits(mother, father, createRNG(seed));
      if (result.includes('gregarious' as TraitId)) { inherited = true; break; }
    }
    // P(never in 50 seeds at 20%) = (0.80)^50 ≈ 0.000014
    expect(inherited).toBe(true);
  });

  it('melancholic (personality, inheritWeight 0.15) can be inherited from one parent', () => {
    const mother = makeParent('fA', ['melancholic'] as TraitId[]);
    const father = makeParent('mB', []);
    let inherited = false;
    for (let seed = 1; seed <= 60; seed++) {
      const result = inheritAptitudeTraits(mother, father, createRNG(seed));
      if (result.includes('melancholic' as TraitId)) { inherited = true; break; }
    }
    // P(never in 60 seeds at 15%) = (0.85)^60 ≈ 0.0000196
    expect(inherited).toBe(true);
  });

  it('sanguine inherits at higher rate when both parents have it vs one parent', () => {
    const bothMother = makeParent('fA', ['sanguine'] as TraitId[]);
    const bothFather = makeParent('mB', ['sanguine'] as TraitId[]);
    const oneMother  = makeParent('fC', ['sanguine'] as TraitId[]);
    const emptyFather = makeParent('mD', []);

    const TRIALS = 200;
    let bothCount = 0;
    let oneCount  = 0;

    for (let seed = 1; seed <= TRIALS; seed++) {
      if (inheritAptitudeTraits(bothMother, bothFather, createRNG(seed)).includes('sanguine' as TraitId)) bothCount++;
      if (inheritAptitudeTraits(oneMother,  emptyFather, createRNG(seed)).includes('sanguine' as TraitId)) oneCount++;
    }

    // Both parents: 15% × 1.5 = 22.5%; one parent: 15% → bothCount should exceed oneCount
    expect(bothCount).toBeGreaterThan(oneCount);
  });

  it('curious (0.15) fires less often than gregarious (0.20) over many trials', () => {
    const curiousMother   = makeParent('fA', ['curious'] as TraitId[]);
    const gregariousMother = makeParent('fB', ['gregarious'] as TraitId[]);
    const emptyFather = makeParent('mX', []);

    const TRIALS = 400;
    let curiousCount = 0;
    let gregCount    = 0;

    for (let seed = 1; seed <= TRIALS; seed++) {
      if (inheritAptitudeTraits(curiousMother,   emptyFather, createRNG(seed)).includes('curious'    as TraitId)) curiousCount++;
      if (inheritAptitudeTraits(gregariousMother, emptyFather, createRNG(seed)).includes('gregarious' as TraitId)) gregCount++;
    }

    // gregarious (20%) should clearly outpace curious (15%) over 400 trials
    expect(gregCount).toBeGreaterThan(curiousCount);
  });

  it('multiple non-conflicting personality traits can all appear on a single child', () => {
    // brave + sanguine + curious have no conflicts with each other
    const mother = makeParent('fA', ['brave', 'sanguine'] as TraitId[]);
    const father = makeParent('mB', ['curious'] as TraitId[]);
    let sawMultiple = false;

    for (let seed = 1; seed <= 200; seed++) {
      const result = inheritAptitudeTraits(mother, father, createRNG(seed));
      if (result.length >= 2) { sawMultiple = true; break; }
    }

    expect(sawMultiple).toBe(true);
  });

  // ─── Conflict resolution ─────────────────────────────────────────────────

  it('robust/sickly (aptitude) are never co-inherited even when each parent holds one', () => {
    // Previously no guard existed — adding robust+sickly to both parents tests new guard
    const mother = makeParent('fA', ['robust'] as TraitId[]);
    const father = makeParent('mB', ['sickly'] as TraitId[]);
    for (let seed = 1; seed <= 100; seed++) {
      const result = inheritAptitudeTraits(mother, father, createRNG(seed));
      const hasRobust = result.includes('robust'  as TraitId);
      const hasSickly = result.includes('sickly'  as TraitId);
      expect(hasRobust && hasSickly).toBe(false);
    }
  });

  it('sanguine/melancholic are never co-inherited', () => {
    const mother = makeParent('fA', ['sanguine']   as TraitId[]);
    const father = makeParent('mB', ['melancholic'] as TraitId[]);
    for (let seed = 1; seed <= 100; seed++) {
      const result = inheritAptitudeTraits(mother, father, createRNG(seed));
      expect(result.includes('sanguine' as TraitId) && result.includes('melancholic' as TraitId)).toBe(false);
    }
  });

  it('gregarious/shy are never co-inherited', () => {
    const mother = makeParent('fA', ['gregarious'] as TraitId[]);
    const father = makeParent('mB', ['shy']        as TraitId[]);
    for (let seed = 1; seed <= 100; seed++) {
      const result = inheritAptitudeTraits(mother, father, createRNG(seed));
      expect(result.includes('gregarious' as TraitId) && result.includes('shy' as TraitId)).toBe(false);
    }
  });

  it('curious/stubborn are never co-inherited', () => {
    const mother = makeParent('fA', ['curious']  as TraitId[]);
    const father = makeParent('mB', ['stubborn'] as TraitId[]);
    for (let seed = 1; seed <= 100; seed++) {
      const result = inheritAptitudeTraits(mother, father, createRNG(seed));
      expect(result.includes('curious' as TraitId) && result.includes('stubborn' as TraitId)).toBe(false);
    }
  });

  it('trusting/suspicious are never co-inherited', () => {
    const mother = makeParent('fA', ['trusting']   as TraitId[]);
    const father = makeParent('mB', ['suspicious'] as TraitId[]);
    for (let seed = 1; seed <= 100; seed++) {
      const result = inheritAptitudeTraits(mother, father, createRNG(seed));
      expect(result.includes('trusting' as TraitId) && result.includes('suspicious' as TraitId)).toBe(false);
    }
  });

  it('wrathful/patient are never co-inherited', () => {
    const mother = makeParent('fA', ['wrathful'] as TraitId[]);
    const father = makeParent('mB', ['patient']  as TraitId[]);
    for (let seed = 1; seed <= 100; seed++) {
      const result = inheritAptitudeTraits(mother, father, createRNG(seed));
      expect(result.includes('wrathful' as TraitId) && result.includes('patient' as TraitId)).toBe(false);
    }
  });

  it('gregarious/solitary are never co-inherited', () => {
    // solitary conflicts with gregarious
    const mother = makeParent('fA', ['gregarious'] as TraitId[]);
    const father = makeParent('mB', ['solitary']   as TraitId[]);
    for (let seed = 1; seed <= 100; seed++) {
      const result = inheritAptitudeTraits(mother, father, createRNG(seed));
      expect(result.includes('gregarious' as TraitId) && result.includes('solitary' as TraitId)).toBe(false);
    }
  });

  it('result never contains the same trait twice regardless of both parents having it', () => {
    // When both parents have the same trait the child may inherit it at most once
    const mother = makeParent('fA', ['brave', 'gregarious', 'robust'] as TraitId[]);
    const father = makeParent('mB', ['brave', 'gregarious', 'robust'] as TraitId[]);
    for (let seed = 1; seed <= 50; seed++) {
      const result = inheritAptitudeTraits(mother, father, createRNG(seed));
      const unique = new Set(result);
      expect(result.length).toBe(unique.size);
    }
  });
});
