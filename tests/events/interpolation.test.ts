/**
 * Unit tests for interpolateText() in actor-resolver.ts
 *
 * Covers all token types: {slot}, {slot.first}, {slot.he/his/him},
 * {slot.He/His/Him}, unknown slot passthrough, unknown suffix passthrough,
 * multiple slots in one string, and mixed known/unknown tokens.
 */

import { describe, it, expect } from 'vitest';
import { interpolateText } from '../../src/simulation/events/actor-resolver';
import { createPerson } from '../../src/simulation/population/person';
import type { Person } from '../../src/simulation/population/person';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeMale(firstName = 'Edmund', familyName = 'Farrow'): Person {
  return createPerson({ sex: 'male', firstName, familyName, age: 30 });
}

function makeFemale(firstName = 'Mira', familyName = 'Ashton'): Person {
  return createPerson({ sex: 'female', firstName, familyName, age: 30 });
}

// ─── Full name token {slot} ───────────────────────────────────────────────────

describe('{slot} — full name', () => {
  it('substitutes first + family name for a male', () => {
    const man = makeMale('Edmund', 'Farrow');
    expect(interpolateText('{scout} found the tracks', { scout: man }))
      .toBe('Edmund Farrow found the tracks');
  });

  it('substitutes first + family name for a female', () => {
    const woman = makeFemale('Mira', 'Ashton');
    expect(interpolateText('{speaker} addresses the council', { speaker: woman }))
      .toBe('Mira Ashton addresses the council');
  });
});

// ─── {slot.first} ─────────────────────────────────────────────────────────────

describe('{slot.first} — given name only', () => {
  it('returns only the first name', () => {
    const man = makeMale('Edmund', 'Farrow');
    expect(interpolateText('{subject.first} runs ahead', { subject: man }))
      .toBe('Edmund runs ahead');
  });

  it('works for female', () => {
    const woman = makeFemale('Mira', 'Ashton');
    expect(interpolateText('{subject.first} is four years old', { subject: woman }))
      .toBe('Mira is four years old');
  });
});

// ─── Pronoun tokens — male ────────────────────────────────────────────────────

describe('pronoun tokens: male subject', () => {
  it('{slot.he} → "he"',   () => {
    const m = makeMale();
    expect(interpolateText('{scout.he} returns', { scout: m })).toBe('he returns');
  });
  it('{slot.his} → "his"', () => {
    const m = makeMale();
    expect(interpolateText('{scout.his} tent', { scout: m })).toBe('his tent');
  });
  it('{slot.him} → "him"', () => {
    const m = makeMale();
    expect(interpolateText('send {scout.him} away', { scout: m })).toBe('send him away');
  });
  it('{slot.He} → "He"',   () => {
    const m = makeMale();
    expect(interpolateText('{scout.He} stands', { scout: m })).toBe('He stands');
  });
  it('{slot.His} → "His"', () => {
    const m = makeMale();
    expect(interpolateText('{scout.His} pack', { scout: m })).toBe('His pack');
  });
  it('{slot.Him} → "Him"', () => {
    const m = makeMale();
    expect(interpolateText('you trust {scout.Him}', { scout: m })).toBe('you trust Him');
  });
});

// ─── Pronoun tokens — female ──────────────────────────────────────────────────

describe('pronoun tokens: female subject', () => {
  it('{slot.he} → "she"',   () => {
    const w = makeFemale();
    expect(interpolateText('{tutor.he} teaches', { tutor: w })).toBe('she teaches');
  });
  it('{slot.his} → "her"',  () => {
    const w = makeFemale();
    expect(interpolateText('{tutor.his} cloak', { tutor: w })).toBe('her cloak');
  });
  it('{slot.him} → "her"',  () => {
    const w = makeFemale();
    expect(interpolateText('find {tutor.him}', { tutor: w })).toBe('find her');
  });
  it('{slot.He} → "She"',   () => {
    const w = makeFemale();
    expect(interpolateText('{tutor.He} speaks', { tutor: w })).toBe('She speaks');
  });
  it('{slot.His} → "Her"',  () => {
    const w = makeFemale();
    expect(interpolateText('{tutor.His} words', { tutor: w })).toBe('Her words');
  });
  it('{slot.Him} → "Her"',  () => {
    const w = makeFemale();
    expect(interpolateText('greet {tutor.Him}', { tutor: w })).toBe('greet Her');
  });
});

// ─── Unknown slot passthrough ─────────────────────────────────────────────────

describe('unknown slot passthrough', () => {
  it('token with no matching slot key is left as-is', () => {
    const w = makeFemale();
    // "scout" is not in slots — should stay verbatim
    expect(interpolateText('{scout} found signs', { tutor: w }))
      .toBe('{scout} found signs');
  });

  it('unknown slot with modifier is left as-is', () => {
    const m = makeMale();
    expect(interpolateText('{missing.he} said', { scout: m }))
      .toBe('{missing.he} said');
  });
});

// ─── Unknown suffix passthrough ───────────────────────────────────────────────

describe('unknown suffix passthrough', () => {
  it('unsupported modifier is left as the original token', () => {
    const m = makeMale();
    expect(interpolateText('{scout.plural} gathered', { scout: m }))
      .toBe('{scout.plural} gathered');
  });
});

// ─── Multiple slots in one string ─────────────────────────────────────────────

describe('multiple slots', () => {
  it('replaces two distinct slots in one pass', () => {
    const man   = makeMale('Edmund', 'Farrow');
    const woman = makeFemale('Mira', 'Ashton');
    const text  = '{objector} argues with {woman} across the fire.';
    expect(interpolateText(text, { objector: man, woman }))
      .toBe('Edmund Farrow argues with Mira Ashton across the fire.');
  });

  it('processes three tokens for the same slot correctly', () => {
    const m = makeMale('Cass', 'Grey');
    const text = '{scout} packs {scout.his} bag. {scout.He} leaves at dawn.';
    expect(interpolateText(text, { scout: m }))
      .toBe('Cass Grey packs his bag. He leaves at dawn.');
  });

  it('handles mixed known and unknown slots', () => {
    const w = makeFemale('Sura', 'Blackwell');
    const text = '{elder} speaks. {stranger} watches. {elder.He} is not afraid.';
    expect(interpolateText(text, { elder: w }))
      .toBe('Sura Blackwell speaks. {stranger} watches. She is not afraid.');
  });
});

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe('edge cases', () => {
  it('empty string returns empty string', () => {
    expect(interpolateText('', {})).toBe('');
  });

  it('text with no tokens is passed through unchanged', () => {
    const plain = 'The settlement stands at dawn.';
    expect(interpolateText(plain, {})).toBe(plain);
  });

  it('empty slots map leaves all tokens intact', () => {
    const text = '{scout} and {elder} are missing.';
    expect(interpolateText(text, {})).toBe('{scout} and {elder} are missing.');
  });
});
