/**
 * Tests for the name generation module.
 *
 * Covers:
 *   - generateName: paternal family name used for Imanian/ansberite cultures
 *   - generateName: maternal family name used for Sauromatian cultures
 *   - generateName: fallback to pool when lineage name is empty
 *   - generateName: male vs. female first-name pools used correctly
 *   - generateName: deterministic for same seed
 *   - generateNickname: stub always returns undefined
 */

import { describe, it, expect } from 'vitest';
import { generateName, generateNickname } from '../../src/simulation/population/naming';
import { createRNG } from '../../src/utils/rng';

// ─── generateName ─────────────────────────────────────────────────────────────

describe('generateName — family-name lineage', () => {
  it('Imanian culture uses paternal family name', () => {
    const rng = createRNG(1);
    const result = generateName('male', 'imanian', 'MatFam', 'PatFam', rng);
    expect(result.familyName).toBe('PatFam');
  });

  it('ansberite culture uses paternal family name', () => {
    const rng = createRNG(1);
    const result = generateName('male', 'ansberite', 'MatFam', 'PatFam', rng);
    expect(result.familyName).toBe('PatFam');
  });

  it('kiswani_riverfolk (Sauromatian) culture uses maternal family name', () => {
    const rng = createRNG(1);
    const result = generateName('female', 'kiswani_riverfolk', 'MatFam', 'PatFam', rng);
    expect(result.familyName).toBe('MatFam');
  });

  it('kiswani_bayuk (Sauromatian) culture uses maternal family name', () => {
    const rng = createRNG(1);
    const result = generateName('female', 'kiswani_bayuk', 'MatFam', 'PatFam', rng);
    expect(result.familyName).toBe('MatFam');
  });

  it('hanjoda_talon (Sauromatian) culture uses maternal family name', () => {
    const rng = createRNG(1);
    const result = generateName('female', 'hanjoda_talon', 'MatFam', 'PatFam', rng);
    expect(result.familyName).toBe('MatFam');
  });
});

describe('generateName — empty lineage fallback', () => {
  it('falls back to pool when Imanian father name is empty', () => {
    const rng = createRNG(5);
    const result = generateName('male', 'ansberite', '', '', rng);
    expect(typeof result.familyName).toBe('string');
    expect(result.familyName.length).toBeGreaterThan(0);
  });

  it('falls back to pool when Sauromatian mother name is empty', () => {
    const rng = createRNG(5);
    const result = generateName('female', 'kiswani_riverfolk', '', '', rng);
    expect(typeof result.familyName).toBe('string');
    expect(result.familyName.length).toBeGreaterThan(0);
  });
});

describe('generateName — first name', () => {
  it('always returns a non-empty firstName', () => {
    const rng = createRNG(7);
    const maleResult = generateName('male', 'imanian', 'M', 'P', rng);
    const femaleResult = generateName('female', 'imanian', 'M', 'P', createRNG(7));
    expect(maleResult.firstName.length).toBeGreaterThan(0);
    expect(femaleResult.firstName.length).toBeGreaterThan(0);
  });
});

describe('generateName — determinism', () => {
  it('is deterministic for the same seed', () => {
    const r1 = generateName('male', 'ansberite', '', '', createRNG(99));
    const r2 = generateName('male', 'ansberite', '', '', createRNG(99));
    expect(r1).toEqual(r2);
  });

  it('differs across seeds', () => {
    const r1 = generateName('male', 'ansberite', '', '', createRNG(1));
    const r2 = generateName('male', 'ansberite', '', '', createRNG(1234567));
    // With different seeds, results should differ (extremely high probability)
    expect(`${r1.firstName}${r1.familyName}`).not.toBe(`${r2.firstName}${r2.familyName}`);
  });
});

// ─── generateNickname ─────────────────────────────────────────────────────────

describe('generateNickname', () => {
  it('stub always returns undefined', () => {
    expect(generateNickname({}, [])).toBeUndefined();
  });

  it('stub accepts any arguments without error', () => {
    expect(generateNickname(null, null)).toBeUndefined();
  });
});
