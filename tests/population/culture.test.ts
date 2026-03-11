/**
 * Unit tests for src/simulation/population/culture.ts
 *
 * Covers:
 *   - deriveCulture: child heritage blending from both parents
 *   - processCulturalDrift: community pull, exposure seeding, spouse bonus
 *   - buildSettlementCultureDistribution: fraction computation
 *   - computeCulturalBlend: Sauromatian fraction
 */

import { describe, it, expect } from 'vitest';
import {
  deriveCulture,
  processCulturalDrift,
  buildSettlementCultureDistribution,
  computeCulturalBlend,
} from '../../src/simulation/population/culture';
import { createPerson } from '../../src/simulation/population/person';
import { createFertilityProfile } from '../../src/simulation/genetics/fertility';
import { createRNG } from '../../src/utils/rng';
import type { Person, BloodlineEntry } from '../../src/simulation/population/person';

// ─── Test helpers ─────────────────────────────────────────────────────────────

const IMANIAN_BLOODLINE: BloodlineEntry[] = [{ group: 'imanian', fraction: 1.0 }];
const TALON_BLOODLINE:   BloodlineEntry[] = [{ group: 'hanjoda_talon', fraction: 1.0 }];
const MIXED_BLOODLINE:   BloodlineEntry[] = [
  { group: 'imanian', fraction: 0.5 },
  { group: 'hanjoda_talon', fraction: 0.5 },
];

function makeImanian(sex: 'male' | 'female' = 'female'): Person {
  return createPerson({
    sex,
    age: 25,
    fertility: createFertilityProfile(false),
    heritage: {
      bloodline: IMANIAN_BLOODLINE,
      primaryCulture: 'ansberite',
      culturalFluency: new Map([['ansberite', 1.0]]),
    },
  });
}

function makeTalon(sex: 'male' | 'female' = 'female'): Person {
  return createPerson({
    sex,
    age: 25,
    heritage: {
      bloodline: TALON_BLOODLINE,
      primaryCulture: 'hanjoda_talon',
      culturalFluency: new Map([['hanjoda_talon', 1.0]]),
    },
  });
}

// ─── deriveCulture ────────────────────────────────────────────────────────────

describe('deriveCulture — pure Imanian × pure Imanian', () => {
  it('child inherits ansberite as primaryCulture', () => {
    const mother = makeImanian('female');
    const father = makeImanian('male');
    const result = deriveCulture(mother, father, IMANIAN_BLOODLINE);
    expect(result.primaryCulture).toBe('ansberite');
  });

  it('child fluency map contains ansberite at 1.0 (both parents contribute equally)', () => {
    const mother = makeImanian('female');
    const father = makeImanian('male');
    const result = deriveCulture(mother, father, IMANIAN_BLOODLINE);
    expect(result.culturalFluency.get('ansberite')).toBeCloseTo(1.0, 5);
  });

  it('child fluency map contains settlement_native seeded at 0.05', () => {
    const mother = makeImanian('female');
    const father = makeImanian('male');
    const result = deriveCulture(mother, father, IMANIAN_BLOODLINE);
    expect(result.culturalFluency.get('settlement_native')).toBeCloseTo(0.05, 5);
  });
});

describe('deriveCulture — Imanian mother × Hanjoda Talon father', () => {
  it('child fluency contains both ansberite and hanjoda_talon at 0.5', () => {
    const mother = makeImanian('female');
    const father = makeTalon('male');
    const result = deriveCulture(mother, father, MIXED_BLOODLINE);

    expect(result.culturalFluency.get('ansberite')).toBeCloseTo(0.5, 5);
    expect(result.culturalFluency.get('hanjoda_talon')).toBeCloseTo(0.5, 5);
  });

  it('child fluency always contains settlement_native', () => {
    const mother = makeImanian('female');
    const father = makeTalon('male');
    const result = deriveCulture(mother, father, MIXED_BLOODLINE);
    expect(result.culturalFluency.has('settlement_native')).toBe(true);
    expect(result.culturalFluency.get('settlement_native')).toBeGreaterThan(0);
  });

  it('child primaryCulture is a valid CultureId present in the fluency map', () => {
    const mother = makeImanian('female');
    const father = makeTalon('male');
    const result = deriveCulture(mother, father, MIXED_BLOODLINE);
    expect(result.culturalFluency.has(result.primaryCulture)).toBe(true);
  });

  it('bloodline on child is the supplied bloodline', () => {
    const mother = makeImanian('female');
    const father = makeTalon('male');
    const result = deriveCulture(mother, father, MIXED_BLOODLINE);
    expect(result.bloodline).toStrictEqual(MIXED_BLOODLINE);
  });
});

describe('deriveCulture — no dominant culture → settlement_native fallback', () => {
  it('primaryCulture is settlement_native when no culture scores ≥ 0.5', () => {
    // Mother has weak multi-culture fluency; father has a different mix.
    // None of the blended values will reach 0.5.
    const mother = createPerson({
      sex: 'female', age: 25,
      heritage: {
        bloodline: IMANIAN_BLOODLINE,
        primaryCulture: 'ansberite',
        culturalFluency: new Map([
          ['ansberite',           0.35],
          ['kiswani_traditional', 0.30],
          ['settlement_native',   0.35],
        ]),
      },
    });
    const father = createPerson({
      sex: 'male', age: 28,
      heritage: {
        bloodline: TALON_BLOODLINE,
        primaryCulture: 'hanjoda_talon',
        culturalFluency: new Map([
          ['hanjoda_talon',       0.35],
          ['hanjoda_traditional', 0.30],
          ['settlement_native',   0.35],
        ]),
      },
    });
    const result = deriveCulture(mother, father, MIXED_BLOODLINE);
    // Blended values: ansberite≈0.175, kiswani_traditional≈0.15,
    // settlement_native≈0.35+0.05=0.40, hanjoda_talon≈0.175, hanjoda_traditional≈0.15
    // No value ≥ 0.5 → primaryCulture defaults to settlement_native.
    expect(result.primaryCulture).toBe('settlement_native');
  });
});

// ─── processCulturalDrift ─────────────────────────────────────────────────────

describe('processCulturalDrift — community pull', () => {
  it('a Sauromatian in an all-Imanian community gains ansberite fluency', () => {
    const talon     = makeTalon('female');
    const imanian1  = makeImanian('male');
    const imanian2  = makeImanian('male');

    const people = new Map([
      [talon.id,    talon],
      [imanian1.id, imanian1],
      [imanian2.id, imanian2],
    ]);

    const rng = createRNG(1);
    const after = processCulturalDrift(people, rng);

    const updatedTalon = after.get(talon.id)!;
    // Community is ~2/3 ansberite. Drift rate is 0.025 per turn.
    // Exposure seed: fraction > 0.05 → FLUENCY_FLOOR added to map.
    // ansberite was not in talon's fluency map → exposure seed of 0.01 applied.
    expect(updatedTalon.heritage.culturalFluency.has('ansberite')).toBe(true);
    expect(updatedTalon.heritage.culturalFluency.get('ansberite')).toBeGreaterThan(0);
  });

  it('Imanian fluency in a mixed community declines toward community fraction', () => {
    // Imanian person in 50/50 community. ansberite fraction = 0.5.
    // Person's current ansberite fluency = 1.0 → should drift down toward 0.5.
    const imanianPerson = makeImanian('female');
    const talonPerson   = makeTalon('male');

    const people = new Map([
      [imanianPerson.id, imanianPerson],
      [talonPerson.id,   talonPerson],
    ]);

    const rng = createRNG(1);
    const after = processCulturalDrift(people, rng);

    const updatedImanian = after.get(imanianPerson.id)!;
    // Before: ansberite = 1.0. Community fraction = 0.5. Drift: 1.0 + 0.025*(0.5-1.0) = 0.9875
    expect(updatedImanian.heritage.culturalFluency.get('ansberite')).toBeLessThan(1.0);
    expect(updatedImanian.heritage.culturalFluency.get('ansberite')).toBeCloseTo(0.9875, 4);
  });

  it('primaryCulture is recomputed after drift', () => {
    // After drift the highest-scoring culture should be the new primaryCulture.
    const talon     = makeTalon('female');
    const imanian1  = makeImanian('male');

    const people = new Map([[talon.id, talon], [imanian1.id, imanian1]]);
    const rng = createRNG(1);
    const after = processCulturalDrift(people, rng);

    const updated = after.get(talon.id)!;
    // primaryCulture should be the key with the highest fluency value.
    let bestFluency = -1;
    let bestCulture = updated.heritage.primaryCulture;
    for (const [cid, val] of updated.heritage.culturalFluency) {
      if (val > bestFluency) { bestFluency = val; bestCulture = cid; }
    }
    expect(updated.heritage.primaryCulture).toBe(bestCulture);
  });
});

describe('processCulturalDrift — spouse bonus', () => {
  it("a person gains fluency in their spouse's primary culture", () => {
    const wife: Person = {
      ...makeImanian('female'),
    };
    const husband: Person = {
      ...makeTalon('male'),
    };
    // Link them as spouses.
    const linkedWife:    Person = { ...wife,    spouseIds: [husband.id] };
    const linkedHusband: Person = { ...husband, spouseIds: [wife.id]   };

    const people = new Map([
      [linkedWife.id,    linkedWife],
      [linkedHusband.id, linkedHusband],
    ]);

    const rng = createRNG(1);
    const after = processCulturalDrift(people, rng);

    // Wife gains hanjoda_talon fluency from spouse.
    const updatedWife = after.get(linkedWife.id)!;
    expect(updatedWife.heritage.culturalFluency.has('hanjoda_talon')).toBe(true);
    expect(updatedWife.heritage.culturalFluency.get('hanjoda_talon'))
      .toBeGreaterThanOrEqual(0.01); // at least FLUENCY_FLOOR

    // Husband gains ansberite fluency from spouse.
    const updatedHusband = after.get(linkedHusband.id)!;
    expect(updatedHusband.heritage.culturalFluency.has('ansberite')).toBe(true);
    expect(updatedHusband.heritage.culturalFluency.get('ansberite'))
      .toBeGreaterThanOrEqual(0.01);
  });
});

describe('processCulturalDrift — floor preservation', () => {
  it('existing fluency entries never drop below FLUENCY_FLOOR (0.01)', () => {
    // Person with a very weak secondary culture in a community where that
    // culture is absent → should clamp to floor, not zero.
    const person = createPerson({
      sex: 'male', age: 30,
      heritage: {
        bloodline: IMANIAN_BLOODLINE,
        primaryCulture: 'ansberite',
        culturalFluency: new Map([
          ['ansberite',     1.0],
          ['hanjoda_talon', 0.011], // tiny trace — community has none of this
        ]),
      },
    });
    const people = new Map([[person.id, person]]);
    const rng = createRNG(1);
    const after = processCulturalDrift(people, rng);

    const updated = after.get(person.id)!;
    const talonFluency = updated.heritage.culturalFluency.get('hanjoda_talon') ?? 0;
    expect(talonFluency).toBeGreaterThanOrEqual(0.01);
  });
});

// ─── buildSettlementCultureDistribution ──────────────────────────────────────

describe('buildSettlementCultureDistribution', () => {
  it('returns empty map for empty population', () => {
    const result = buildSettlementCultureDistribution(new Map());
    expect(result.size).toBe(0);
  });

  it('single-culture population returns fraction 1.0', () => {
    const p1 = makeImanian('female');
    const p2 = makeImanian('male');
    const people = new Map([[p1.id, p1], [p2.id, p2]]);
    const dist = buildSettlementCultureDistribution(people);
    expect(dist.get('ansberite')).toBeCloseTo(1.0, 5);
  });

  it('two-culture 50-50 population returns 0.5 each', () => {
    const imanian = makeImanian('female');
    const talon   = makeTalon('male');
    const people = new Map([[imanian.id, imanian], [talon.id, talon]]);
    const dist = buildSettlementCultureDistribution(people);
    expect(dist.get('ansberite')).toBeCloseTo(0.5, 5);
    expect(dist.get('hanjoda_talon')).toBeCloseTo(0.5, 5);
  });

  it('fractions sum to 1.0', () => {
    const p1 = makeImanian('female');
    const p2 = makeTalon('male');
    const p3 = makeImanian('male');
    const people = new Map([[p1.id, p1], [p2.id, p2], [p3.id, p3]]);
    const dist = buildSettlementCultureDistribution(people);
    const total = [...dist.values()].reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1.0, 5);
  });
});

// ─── computeCulturalBlend ─────────────────────────────────────────────────────

describe('computeCulturalBlend', () => {
  it('returns 0 for empty population', () => {
    expect(computeCulturalBlend(new Map())).toBe(0);
  });

  it('returns 0.0 for all-Imanian population (ansberite is not Sauromatian)', () => {
    const p1 = makeImanian('female');
    const p2 = makeImanian('male');
    const people = new Map([[p1.id, p1], [p2.id, p2]]);
    expect(computeCulturalBlend(people)).toBeCloseTo(0.0, 5);
  });

  it('returns 1.0 for all-Sauromatian population', () => {
    const t1 = makeTalon('female');
    const t2 = makeTalon('male');
    const people = new Map([[t1.id, t1], [t2.id, t2]]);
    expect(computeCulturalBlend(people)).toBeCloseTo(1.0, 5);
  });

  it('returns 0.5 for 50/50 Imanian-Sauromatian population', () => {
    const imanian = makeImanian('female');
    const talon   = makeTalon('male');
    const people = new Map([[imanian.id, imanian], [talon.id, talon]]);
    expect(computeCulturalBlend(people)).toBeCloseTo(0.5, 5);
  });
});
