/**
 * Tests for getLanguageCompatibility() in marriage.ts.
 *
 * Covers:
 *   - 'shared'  — both speakers conversational (≥0.3) in the same language
 *   - 'partial' — one conversational, the other has any fluency > 0
 *   - 'none'    — no linguistic overlap at all
 *   - Tradetalk counts for 'shared' / 'partial' like any other language
 *   - Asymmetric partial (B conversational, A sub-threshold) is still 'partial'
 */

import { describe, it, expect } from 'vitest';
import { getLanguageCompatibility } from '../../src/simulation/population/marriage';
import type { Person } from '../../src/simulation/population/person';
import type { LanguageId } from '../../src/simulation/population/person';

// ─── Minimal person stub ──────────────────────────────────────────────────────

/** getLanguageCompatibility only reads the `languages` field. */
function withLanguages(fluencies: Array<[LanguageId, number]>): Person {
  return {
    languages: fluencies.map(([language, fluency]) => ({ language, fluency })),
  } as unknown as Person;
}

// ─── 'shared' ────────────────────────────────────────────────────────────────

describe("getLanguageCompatibility — 'shared'", () => {
  it("returns 'shared' when both speak Imanian above threshold", () => {
    const a = withLanguages([['imanian', 1.0]]);
    const b = withLanguages([['imanian', 0.8]]);
    expect(getLanguageCompatibility(a, b)).toBe('shared');
  });

  it("returns 'shared' when both are exactly at the 0.3 threshold", () => {
    const a = withLanguages([['kiswani', 0.3]]);
    const b = withLanguages([['kiswani', 0.3]]);
    expect(getLanguageCompatibility(a, b)).toBe('shared');
  });

  it("returns 'shared' when they share a second language (not the first listed)", () => {
    const a = withLanguages([['imanian', 1.0], ['kiswani', 0.6]]);
    const b = withLanguages([['hanjoda',  1.0], ['kiswani', 0.5]]);
    expect(getLanguageCompatibility(a, b)).toBe('shared');
  });

  it("returns 'shared' when Tradetalk is the shared bridge language", () => {
    // Tradetalk is capped at 0.5 but 0.5 >= 0.3 — counts as conversational
    const a = withLanguages([['tradetalk', 0.5]]);
    const b = withLanguages([['tradetalk', 0.4]]);
    expect(getLanguageCompatibility(a, b)).toBe('shared');
  });

  it("returns 'shared' for a creole both speak conversationally", () => {
    const a = withLanguages([['settlement_creole', 0.7]]);
    const b = withLanguages([['settlement_creole', 0.5]]);
    expect(getLanguageCompatibility(a, b)).toBe('shared');
  });
});

// ─── 'partial' ────────────────────────────────────────────────────────────────

describe("getLanguageCompatibility — 'partial'", () => {
  it("returns 'partial' when A is conversational but B has sub-threshold fluency", () => {
    const a = withLanguages([['kiswani', 0.8]]);
    const b = withLanguages([['kiswani', 0.1]]); // hears some but not conversational
    expect(getLanguageCompatibility(a, b)).toBe('partial');
  });

  it("returns 'partial' when B is conversational but A has sub-threshold fluency", () => {
    const a = withLanguages([['imanian', 0.05]]);
    const b = withLanguages([['imanian', 1.0]]);
    expect(getLanguageCompatibility(a, b)).toBe('partial');
  });

  it("returns 'partial' when the only overlap is via Tradetalk (one-sided)", () => {
    const a = withLanguages([['imanian', 1.0], ['tradetalk', 0.4]]);
    const b = withLanguages([['kiswani', 1.0], ['tradetalk', 0.1]]);
    // Neither fully shares a tongue — A has tradetalk conversational, B barely knows it
    expect(getLanguageCompatibility(a, b)).toBe('partial');
  });
});

// ─── 'none' ───────────────────────────────────────────────────────────────────

describe("getLanguageCompatibility — 'none'", () => {
  it("returns 'none' when the two people speak entirely different languages", () => {
    const a = withLanguages([['imanian', 1.0]]);
    const b = withLanguages([['kiswani', 1.0]]);
    expect(getLanguageCompatibility(a, b)).toBe('none');
  });

  it("returns 'none' when one person has no languages at all", () => {
    const a = withLanguages([['imanian', 1.0]]);
    const b = withLanguages([]);
    expect(getLanguageCompatibility(a, b)).toBe('none');
  });

  it("returns 'none' when both persons have no languages", () => {
    const a = withLanguages([]);
    const b = withLanguages([]);
    expect(getLanguageCompatibility(a, b)).toBe('none');
  });

  it("returns 'none' when overlap exists but both are sub-threshold", () => {
    // Neither reaches conversational — sub-threshold overlap is not enough for 'partial'
    // because 'partial' requires at least one side to be conversational
    const a = withLanguages([['imanian', 0.2]]);
    const b = withLanguages([['imanian', 0.1]]);
    expect(getLanguageCompatibility(a, b)).toBe('none');
  });
});
