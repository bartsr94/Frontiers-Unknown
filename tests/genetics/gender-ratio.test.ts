/**
 * Unit tests for gender-ratio.ts and a sanity pass on ethnic-distributions.ts.
 *
 * Covers:
 *   - getSauromatianFraction / getImanianFraction arithmetic
 *   - resolveGenderRatio formula end-to-end
 *   - determineSex probability distribution
 *   - ETHNIC_DISTRIBUTIONS completeness and weight integrity
 */

import { describe, it, expect } from 'vitest';
import {
  getSauromatianFraction,
  getImanianFraction,
  resolveGenderRatio,
  determineSex,
} from '../../src/simulation/genetics/gender-ratio';
import { createPerson } from '../../src/simulation/population/person';
import type { BloodlineEntry, EthnicGroup } from '../../src/simulation/population/person';
import { ETHNIC_DISTRIBUTIONS } from '../../src/data/ethnic-distributions';
import { createRNG } from '../../src/utils/rng';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function personWithBloodline(sex: 'male' | 'female', bloodline: BloodlineEntry[]) {
  return createPerson({
    sex,
    heritage: {
      bloodline,
      primaryCulture: 'ansberite',
      culturalFluency: new Map([['ansberite', 1.0]]),
    },
  });
}

const pureImanian: BloodlineEntry[] = [{ group: 'imanian', fraction: 1.0 }];
const pureKiswaniRiverfolk: BloodlineEntry[] = [{ group: 'kiswani_riverfolk', fraction: 1.0 }];
const pureBayuk: BloodlineEntry[] = [{ group: 'kiswani_bayuk', fraction: 1.0 }];
const pureStormcaller: BloodlineEntry[] = [{ group: 'hanjoda_stormcaller', fraction: 1.0 }];

// ─── getSauromatianFraction ───────────────────────────────────────────────────

describe('getSauromatianFraction', () => {
  it('returns 0 for pure Imanian bloodline', () => {
    expect(getSauromatianFraction(pureImanian)).toBe(0);
  });

  it('returns 1.0 for pure Kiswani Riverfolk bloodline', () => {
    expect(getSauromatianFraction(pureKiswaniRiverfolk)).toBeCloseTo(1.0, 10);
  });

  it('returns 1.0 for pure Hanjoda bloodline', () => {
    expect(getSauromatianFraction(pureStormcaller)).toBeCloseTo(1.0, 10);
  });

  it('returns 0.5 for 50/50 Imanian/Kiswani bloodline', () => {
    const mixed: BloodlineEntry[] = [
      { group: 'imanian', fraction: 0.5 },
      { group: 'kiswani_riverfolk', fraction: 0.5 },
    ];
    expect(getSauromatianFraction(mixed)).toBeCloseTo(0.5, 10);
  });

  it('treats all non-Imanian groups as Sauromatian', () => {
    const multiGroup: BloodlineEntry[] = [
      { group: 'kiswani_bayuk', fraction: 0.25 },
      { group: 'hanjoda_talon', fraction: 0.25 },
      { group: 'imanian', fraction: 0.25 },
      { group: 'hanjoda_emrasi', fraction: 0.25 },
    ];
    expect(getSauromatianFraction(multiGroup)).toBeCloseTo(0.75, 10);
  });

  it('returns 0 for an empty bloodline', () => {
    expect(getSauromatianFraction([])).toBe(0);
  });
});

// ─── getImanianFraction ───────────────────────────────────────────────────────

describe('getImanianFraction', () => {
  it('returns 1.0 for pure Imanian bloodline', () => {
    expect(getImanianFraction(pureImanian)).toBeCloseTo(1.0, 10);
  });

  it('returns 0 for pure Sauromatian bloodline', () => {
    expect(getImanianFraction(pureKiswaniRiverfolk)).toBe(0);
    expect(getImanianFraction(pureBayuk)).toBe(0);
  });

  it('returns 0.5 for 50/50 bloodline', () => {
    const mixed: BloodlineEntry[] = [
      { group: 'imanian', fraction: 0.5 },
      { group: 'kiswani_haisla', fraction: 0.5 },
    ];
    expect(getImanianFraction(mixed)).toBeCloseTo(0.5, 10);
  });

  it('sauromatian + imanian fractions sum to 1.0 for a two-group bloodline', () => {
    const mixed: BloodlineEntry[] = [
      { group: 'imanian', fraction: 0.3 },
      { group: 'hanjoda_bloodmoon', fraction: 0.7 },
    ];
    const sauro = getSauromatianFraction(mixed);
    const iman = getImanianFraction(mixed);
    expect(sauro + iman).toBeCloseTo(1.0, 10);
  });
});

// ─── resolveGenderRatio ───────────────────────────────────────────────────────

describe('resolveGenderRatio', () => {
  it('pure Imanian couple → ~0.50 male probability', () => {
    const mother = personWithBloodline('female', pureImanian);
    const father = personWithBloodline('male', pureImanian);
    // maternalBase = lerp(0.50, 0.14, 0) = 0.50
    // paternalShift = 1.0 × 0.20 = 0.20  → clamped to 0.50
    expect(resolveGenderRatio(mother, father)).toBeCloseTo(0.50, 5);
  });

  it('pure Sauromatian couple → ~0.14 male probability', () => {
    const mother = personWithBloodline('female', pureKiswaniRiverfolk);
    const father = personWithBloodline('male', pureKiswaniRiverfolk);
    // maternalBase = lerp(0.50, 0.14, 1.0) = 0.14
    // paternalShift = 0 × 0.20 = 0  → 0.14
    expect(resolveGenderRatio(mother, father)).toBeCloseTo(0.14, 5);
  });

  it('pure Sauromatian mother × pure Imanian father → shifted above 0.14', () => {
    const mother = personWithBloodline('female', pureKiswaniRiverfolk);
    const father = personWithBloodline('male', pureImanian);
    // maternalBase = 0.14, paternalShift = 0.20 → 0.34
    const ratio = resolveGenderRatio(mother, father);
    expect(ratio).toBeCloseTo(0.34, 5);
    expect(ratio).toBeGreaterThan(0.14);
    expect(ratio).toBeLessThanOrEqual(0.50);
  });

  it('50/50 mother × Imanian father → intermediate ratio', () => {
    const mother = personWithBloodline('female', [
      { group: 'imanian', fraction: 0.5 },
      { group: 'kiswani_riverfolk', fraction: 0.5 },
    ]);
    const father = personWithBloodline('male', pureImanian);
    // maternalBase = lerp(0.50, 0.14, 0.5) = 0.32
    // paternalShift = 1.0 × 0.20 = 0.20 → total 0.52, clamped to 0.50
    const ratio = resolveGenderRatio(mother, father);
    expect(ratio).toBeGreaterThan(0.14);
    expect(ratio).toBeLessThanOrEqual(0.50);
  });

  it('result is always within [0.10, 0.50]', () => {
    const pairs: Array<[BloodlineEntry[], BloodlineEntry[]]> = [
      [pureImanian, pureImanian],
      [pureKiswaniRiverfolk, pureKiswaniRiverfolk],
      [pureKiswaniRiverfolk, pureImanian],
      [pureImanian, pureKiswaniRiverfolk],
      [pureStormcaller, pureBayuk],
    ];
    for (const [mb, fb] of pairs) {
      const mother = personWithBloodline('female', mb);
      const father = personWithBloodline('male', fb);
      const ratio = resolveGenderRatio(mother, father);
      expect(ratio).toBeGreaterThanOrEqual(0.10);
      expect(ratio).toBeLessThanOrEqual(0.50);
    }
  });
});

// ─── determineSex ─────────────────────────────────────────────────────────────

describe('determineSex', () => {
  it('returns only "male" or "female"', () => {
    const rng = createRNG(1);
    for (let i = 0; i < 100; i++) {
      const sex = determineSex(0.5, rng);
      expect(['male', 'female']).toContain(sex);
    }
  });

  it('modifier = 1.0 always produces male', () => {
    const rng = createRNG(42);
    for (let i = 0; i < 50; i++) {
      expect(determineSex(1.0, rng)).toBe('male');
    }
  });

  it('modifier = 0.0 always produces female', () => {
    const rng = createRNG(42);
    for (let i = 0; i < 50; i++) {
      expect(determineSex(0.0, rng)).toBe('female');
    }
  });

  it('modifier = 0.5 produces approximately equal split over 5000 samples', () => {
    const rng = createRNG(77);
    let males = 0;
    const n = 5000;
    for (let i = 0; i < n; i++) {
      if (determineSex(0.5, rng) === 'male') males++;
    }
    const maleFraction = males / n;
    expect(maleFraction).toBeGreaterThan(0.45);
    expect(maleFraction).toBeLessThan(0.55);
  });
});

// ─── ETHNIC_DISTRIBUTIONS sanity ─────────────────────────────────────────────

describe('ETHNIC_DISTRIBUTIONS sanity checks', () => {
  const allGroups: EthnicGroup[] = [
    'imanian',
    'kiswani_riverfolk',
    'kiswani_bayuk',
    'kiswani_haisla',
    'hanjoda_stormcaller',
    'hanjoda_bloodmoon',
    'hanjoda_talon',
    'hanjoda_emrasi',
  ];

  it('covers all eight ethnic groups', () => {
    for (const group of allGroups) {
      expect(ETHNIC_DISTRIBUTIONS[group]).toBeDefined();
    }
  });

  it('each group\'s discrete trait weights sum to approximately 1.0', () => {
    const discreteKeys = [
      'skinUndertone',
      'hairColor',
      'hairTexture',
      'eyeColor',
      'buildType',
      'height',
      'facialStructure',
    ] as const;

    for (const group of allGroups) {
      const dist = ETHNIC_DISTRIBUTIONS[group];
      for (const key of discreteKeys) {
        const weights = dist[key].weights;
        const total = Object.values(weights).reduce((sum, w) => sum + (w as number), 0);
        expect(total).toBeCloseTo(1.0, 9);
      }
    }
  });

  it('each group\'s skinTone mean is within [0, 1]', () => {
    for (const group of allGroups) {
      const { mean, variance } = ETHNIC_DISTRIBUTIONS[group].skinTone;
      expect(mean).toBeGreaterThanOrEqual(0);
      expect(mean).toBeLessThanOrEqual(1);
      expect(variance).toBeGreaterThan(0);
    }
  });

  it('Talon amber eye weight is the dominant weight (lore rule)', () => {
    const talonEyes = ETHNIC_DISTRIBUTIONS['hanjoda_talon'].eyeColor.weights;
    const amberWeight = talonEyes.amber ?? 0;
    for (const [color, weight] of Object.entries(talonEyes)) {
      if (color !== 'amber') {
        expect(amberWeight).toBeGreaterThan(weight as number);
      }
    }
  });

  it('Bayuk grey eye weight is the dominant weight (lore rule)', () => {
    const bayukEyes = ETHNIC_DISTRIBUTIONS['kiswani_bayuk'].eyeColor.weights;
    const greyWeight = bayukEyes.grey ?? 0;
    for (const [color, weight] of Object.entries(bayukEyes)) {
      if (color !== 'grey') {
        expect(greyWeight).toBeGreaterThan(weight as number);
      }
    }
  });

  it('Stormcaller blonde hair weight is the dominant weight (lore rule)', () => {
    const stormHair = ETHNIC_DISTRIBUTIONS['hanjoda_stormcaller'].hairColor.weights;
    const blondeWeight = stormHair.blonde ?? 0;
    for (const [color, weight] of Object.entries(stormHair)) {
      if (color !== 'blonde') {
        expect(blondeWeight).toBeGreaterThanOrEqual(weight as number);
      }
    }
  });

  it('Sauromatian groups have darker skin than Imanian (mean > 0.35)', () => {
    const saurGroups: EthnicGroup[] = [
      'kiswani_riverfolk',
      'kiswani_bayuk',
      'kiswani_haisla',
      'hanjoda_bloodmoon',
      'hanjoda_talon',
    ];
    for (const group of saurGroups) {
      const { mean } = ETHNIC_DISTRIBUTIONS[group].skinTone;
      expect(mean).toBeGreaterThan(0.35);
    }
  });
});
