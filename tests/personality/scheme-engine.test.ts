/**
 * Tests for scheme-engine.ts
 *
 * Covers:
 *   - generateScheme: all 5 scheme type conditions
 *   - processSchemes: generation interval, progress advance, failure, silent completion,
 *     event firing, log entries
 */

import { describe, it, expect } from 'vitest';
import { generateScheme, processSchemes } from '../../src/simulation/personality/scheme-engine';
import type { Person, PersonScheme, NamedRelationship } from '../../src/simulation/population/person';
import { createRNG } from '../../src/utils/rng';
import { getEventById } from '../../src/simulation/events/event-filter';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePerson(id: string, overrides: Partial<Person> = {}): Person {
  return {
    id,
    firstName: `Person_${id}`,
    familyName: 'Test',
    sex: 'male',
    age: 25,
    alive: true,
    role: 'unassigned',
    socialStatus: 'settler',
    traits: [],
    religion: 'imanian_orthodox',
    heritage: {
      bloodline: [{ group: 'imanian', fraction: 1.0 }],
      primaryCulture: 'imanian',
      culturalFluency: new Map(),
    },
    genetics: {
      skinTone: 0.3,
      hairColor: 'brown',
      hairTexture: 'straight',
      eyeColor: 'blue',
      heightModifier: 0,
      buildModifier: 0,
      genderRatioModifier: 0,
      extendedFertility: false,
    },
    languages: [{ language: 'ansberite', fluency: 1.0 }],
    pregnancies: [],
    spouseIds: [],
    childIds: [],
    motherIds: [],
    fatherIds: [],
    relationships: new Map(),
    householdId: null,
    householdRole: null,
    ashkaMelathiPartnerIds: [],
    ambition: null,
    namedRelationships: [],
    activeScheme: null,
    opinionModifiers: [],
    opinionSustainedSince: {},
    skills: { animals: 25, bargaining: 25, combat: 25, custom: 25, leadership: 25, plants: 25 },
    portraitVariant: 1,
    ...overrides,
  } as Person;
}

/** Give person A an opinion of `value` toward person B via their relationships Map. */
function withOpinion(person: Person, targetId: string, value: number): Person {
  const rels = new Map(person.relationships);
  rels.set(targetId, value);
  return { ...person, relationships: rels };
}

function makeRel(type: NamedRelationship['type'], targetId: string): NamedRelationship {
  return { type, targetId, formedTurn: 0, depth: 0.5, revealedToPlayer: false };
}

// ─── generateScheme ───────────────────────────────────────────────────────────

describe('generateScheme — scheme_court_person', () => {
  it('generates courtship scheme for passionate + unmarried + opinion ≥ 50', () => {
    const rng = createRNG(42);
    let a = makePerson('a', { traits: ['passionate' as never], sex: 'male' });
    let b = makePerson('b', { sex: 'female' });
    a = withOpinion(a, 'b', 55);
    const people = new Map([['a', a], ['b', b]]);

    const scheme = generateScheme(a, people, 0, rng);
    expect(scheme).not.toBeNull();
    expect(scheme!.type).toBe('scheme_court_person');
    expect(scheme!.targetId).toBe('b');
    expect(scheme!.progress).toBe(0);
  });

  it('does not generate courtship when already married', () => {
    const rng = createRNG(42);
    let a = makePerson('a', { traits: ['passionate' as never], sex: 'male', spouseIds: ['x'] });
    const b = makePerson('b', { sex: 'female' });
    a = withOpinion(a, 'b', 60);
    const people = new Map([['a', a], ['b', b]]);

    const scheme = generateScheme(a, people, 0, rng);
    expect(scheme).toBeNull();
  });

  it('does not generate courtship when no target has opinion ≥ 50', () => {
    const rng = createRNG(42);
    let a = makePerson('a', { traits: ['passionate' as never], sex: 'male' });
    const b = makePerson('b', { sex: 'female' });
    a = withOpinion(a, 'b', 40);
    const people = new Map([['a', a], ['b', b]]);

    const scheme = generateScheme(a, people, 0, rng);
    expect(scheme).toBeNull();
  });
});

describe('generateScheme — scheme_convert_faith', () => {
  it('generates conversion scheme for zealous + different faith + opinion ≥ 30', () => {
    const rng = createRNG(42);
    let a = makePerson('a', { traits: ['zealous' as never], religion: 'imanian_orthodox' });
    const b = makePerson('b', { religion: 'sacred_wheel' });
    a = withOpinion(a, 'b', 35);
    const people = new Map([['a', a], ['b', b]]);

    const scheme = generateScheme(a, people, 0, rng);
    expect(scheme).not.toBeNull();
    expect(scheme!.type).toBe('scheme_convert_faith');
    expect(scheme!.targetId).toBe('b');
  });

  it('does not convert someone of the same faith', () => {
    const rng = createRNG(42);
    let a = makePerson('a', { traits: ['zealous' as never], religion: 'imanian_orthodox' });
    const b = makePerson('b', { religion: 'imanian_orthodox' });
    a = withOpinion(a, 'b', 40);
    const people = new Map([['a', a], ['b', b]]);

    const scheme = generateScheme(a, people, 0, rng);
    expect(scheme).toBeNull();
  });
});

describe('generateScheme — scheme_befriend_person', () => {
  it('generates befriend scheme for gregarious + no friend + opinion ≥ 40', () => {
    const rng = createRNG(42);
    let a = makePerson('a', { traits: ['gregarious' as never] });
    const b = makePerson('b');
    a = withOpinion(a, 'b', 45);
    const people = new Map([['a', a], ['b', b]]);

    const scheme = generateScheme(a, people, 0, rng);
    expect(scheme).not.toBeNull();
    expect(scheme!.type).toBe('scheme_befriend_person');
  });

  it('does not generate befriend if already has a friend', () => {
    const rng = createRNG(42);
    let a = makePerson('a', {
      traits: ['gregarious' as never],
      namedRelationships: [makeRel('friend', 'x')],
    });
    const b = makePerson('b');
    a = withOpinion(a, 'b', 50);
    const people = new Map([['a', a], ['b', b]]);

    const scheme = generateScheme(a, people, 0, rng);
    expect(scheme).toBeNull();
  });
});

describe('generateScheme — scheme_undermine_person', () => {
  it('generates undermine scheme for jealous person with a rival', () => {
    const rng = createRNG(42);
    const a = makePerson('a', {
      traits: ['jealous' as never],
      namedRelationships: [makeRel('rival', 'b')],
    });
    const b = makePerson('b');
    const people = new Map([['a', a], ['b', b]]);

    const scheme = generateScheme(a, people, 0, rng);
    expect(scheme).not.toBeNull();
    expect(scheme!.type).toBe('scheme_undermine_person');
    expect(scheme!.targetId).toBe('b');
  });

  it('generates undermine via competing ambition when no rival', () => {
    const rng = createRNG(42);
    const ambition = { type: 'seek_council' as const, intensity: 0.8, targetPersonId: null, formedTurn: 0 };
    const a = makePerson('a', { traits: ['ambitious' as never], ambition });
    const b = makePerson('b', { ambition });
    const people = new Map([['a', a], ['b', b]]);

    const scheme = generateScheme(a, people, 0, rng);
    expect(scheme).not.toBeNull();
    expect(scheme!.type).toBe('scheme_undermine_person');
    expect(scheme!.targetId).toBe('b');
  });
});

describe('generateScheme — scheme_undermine_person (nemesis path)', () => {
  it('generates undermine scheme for a nemesis even without jealous/ambitious trait', () => {
    const rng = createRNG(42);
    const a = makePerson('a', {
      traits: [], // no jealous or ambitious
      namedRelationships: [makeRel('nemesis', 'b')],
    });
    const b = makePerson('b');
    const people = new Map([['a', a], ['b', b]]);

    const scheme = generateScheme(a, people, 0, rng);
    expect(scheme).not.toBeNull();
    expect(scheme!.type).toBe('scheme_undermine_person');
    expect(scheme!.targetId).toBe('b');
  });

  it('confidant bond suppresses undermine toward that rival', () => {
    const rng = createRNG(42);
    // a is jealous with a rival, but that rival is also their confidant
    const a = makePerson('a', {
      traits: ['jealous' as never],
      namedRelationships: [makeRel('rival', 'b'), makeRel('confidant', 'b')],
    });
    const b = makePerson('b');
    const people = new Map([['a', a], ['b', b]]);

    const scheme = generateScheme(a, people, 0, rng);
    // Should not undermine b because of the confidant bond; falls through to null (no other triggers)
    expect(scheme).toBeNull();
  });
});

describe('generateScheme — scheme_tutor_person', () => {
  it('generates tutor scheme for mentor_hearted with an existing mentor relationship', () => {
    const rng = createRNG(42);
    const a = makePerson('a', {
      traits: ['mentor_hearted' as never],
      namedRelationships: [makeRel('mentor', 'b')],
    });
    const b = makePerson('b');
    const people = new Map([['a', a], ['b', b]]);

    const scheme = generateScheme(a, people, 0, rng);
    expect(scheme).not.toBeNull();
    expect(scheme!.type).toBe('scheme_tutor_person');
    expect(scheme!.targetId).toBe('b');
  });

  it('generates tutor scheme from mentor relationship alone, without mentor_hearted trait', () => {
    const rng = createRNG(42);
    const a = makePerson('a', {
      traits: [], // no mentor_hearted — mentor relationship is sufficient
      namedRelationships: [makeRel('mentor', 'b')],
    });
    const b = makePerson('b');
    const people = new Map([['a', a], ['b', b]]);

    const scheme = generateScheme(a, people, 0, rng);
    expect(scheme).not.toBeNull();
    expect(scheme!.type).toBe('scheme_tutor_person');
    expect(scheme!.targetId).toBe('b');
  });

  it('does not generate tutor when no mentor relationship exists', () => {
    const rng = createRNG(42);
    const a = makePerson('a', { traits: ['mentor_hearted' as never] });
    const b = makePerson('b');
    const people = new Map([['a', a], ['b', b]]);

    const scheme = generateScheme(a, people, 0, rng);
    expect(scheme).toBeNull();
  });
});

describe('generateScheme — no matching conditions', () => {
  it('returns null when person has no scheme-triggering traits', () => {
    const rng = createRNG(42);
    const a = makePerson('a'); // no traits
    const b = makePerson('b');
    const people = new Map([['a', a], ['b', b]]);

    const scheme = generateScheme(a, people, 0, rng);
    expect(scheme).toBeNull();
  });
});

// ─── processSchemes ───────────────────────────────────────────────────────────

describe('processSchemes — scheme generation interval', () => {
  it('generates a new scheme on turn divisible by 12', () => {
    const rng = createRNG(42);
    let a = makePerson('a', { traits: ['gregarious' as never] });
    const b = makePerson('b');
    a = withOpinion(a, 'b', 50);
    const people = new Map([['a', a], ['b', b]]);

    const result = processSchemes(people, 12, rng);
    expect(result.updatedPeople.has('a')).toBe(true);
    expect(result.updatedPeople.get('a')!.activeScheme).not.toBeNull();
  });

  it('does not generate a scheme on a non-interval turn', () => {
    const rng = createRNG(42);
    let a = makePerson('a', { traits: ['gregarious' as never] });
    const b = makePerson('b');
    a = withOpinion(a, 'b', 50);
    const people = new Map([['a', a], ['b', b]]);

    const result = processSchemes(people, 5, rng);
    // No generation — updatedPeople should be empty (or not contain 'a' with scheme)
    const updatedA = result.updatedPeople.get('a');
    expect(updatedA?.activeScheme ?? null).toBeNull();
  });

  it('does not generate a scheme when person already has activeScheme', () => {
    const rng = createRNG(42);
    const existingScheme: PersonScheme = {
      type: 'scheme_befriend_person',
      targetId: 'b',
      progress: 0.5,
      startedTurn: 0,
      revealedToPlayer: false,
    };
    let a = makePerson('a', { traits: ['gregarious' as never], activeScheme: existingScheme });
    const b = makePerson('b');
    a = withOpinion(a, 'b', 50);
    const people = new Map([['a', a], ['b', b]]);

    const result = processSchemes(people, 12, rng);
    // activeScheme should remain the befriend one, not get replaced
    const updatedA = result.updatedPeople.get('a') ?? a;
    // opinion 50 → factor = 1.0 + 50/200 = 1.25 → rate = 0.05 * 1.25 = 0.0625
    expect(updatedA.activeScheme?.type).toBe('scheme_befriend_person'); // not replaced
    expect(updatedA.activeScheme?.progress).toBeCloseTo(0.5 + 0.0625); // advanced, not replaced
  });
});

describe('processSchemes — progress advance', () => {
  it('advances progress of an active scheme each turn', () => {
    const rng = createRNG(42);
    const scheme: PersonScheme = {
      type: 'scheme_befriend_person',
      targetId: 'b',
      progress: 0.3,
      startedTurn: 0,
      revealedToPlayer: false,
    };
    let a = makePerson('a', { activeScheme: scheme });
    const b = makePerson('b');
    // opinion must stay ≥ 0 to avoid failure condition
    a = withOpinion(a, 'b', 10);
    const people = new Map([['a', a], ['b', b]]);

    const result = processSchemes(people, 1, rng);
    const updatedA = result.updatedPeople.get('a')!;
    expect(updatedA.activeScheme?.progress).toBeCloseTo(0.3 + 0.05);
  });

  it('does not exceed progress 1.0', () => {
    const rng = createRNG(42);
    const scheme: PersonScheme = {
      type: 'scheme_befriend_person',
      targetId: 'b',
      progress: 0.98,
      startedTurn: 0,
      revealedToPlayer: false,
    };
    let a = makePerson('a', { activeScheme: scheme });
    const b = makePerson('b');
    a = withOpinion(a, 'b', 10);
    const people = new Map([['a', a], ['b', b]]);

    const result = processSchemes(people, 1, rng);
    // At 0.98 + 0.05 = 1.03 → clamped to 1.0, then scheme completes (activeScheme cleared)
    const updatedA = result.updatedPeople.get('a')!;
    expect(updatedA.activeScheme).toBeNull(); // completed
  });
});

describe('processSchemes — opinion-scaled progress', () => {
  it('befriend scheme advances faster when schemer likes the target (high opinion)', () => {
    const rng = createRNG(1);
    const baseScheme: PersonScheme = {
      type: 'scheme_befriend_person',
      targetId: 'b',
      progress: 0.1,
      startedTurn: 0,
      revealedToPlayer: false,
    };

    // Run with high opinion (+100)
    let aHigh = makePerson('a', { activeScheme: { ...baseScheme } });
    aHigh = withOpinion(aHigh, 'b', 100);
    const bHigh = makePerson('b');
    const highResult = processSchemes(new Map([['a', aHigh], ['b', bHigh]]), 1, rng);
    const highProgress = highResult.updatedPeople.get('a')!.activeScheme!.progress;

    // Run with neutral opinion (0) — must reinit RNG to be fair
    const rng2 = createRNG(1);
    let aMid = makePerson('a', { activeScheme: { ...baseScheme } });
    aMid = withOpinion(aMid, 'b', 0);
    const bMid = makePerson('b');
    const midResult = processSchemes(new Map([['a', aMid], ['b', bMid]]), 1, rng2);
    const midProgress = midResult.updatedPeople.get('a')!.activeScheme!.progress;

    expect(highProgress).toBeGreaterThan(midProgress);
  });

  it('undermine scheme advances faster when schemer hates the target (negative opinion)', () => {
    const rng = createRNG(1);
    const baseScheme: PersonScheme = {
      type: 'scheme_undermine_person',
      targetId: 'b',
      progress: 0.1,
      startedTurn: 0,
      revealedToPlayer: false,
    };

    // Hatred: opinion -100 → 1.5× multiplier
    let aHate = makePerson('a', { activeScheme: { ...baseScheme }, traits: ['respected_elder' as never] });
    // Use a non-fail trait setup — override with bare person + low opinion
    aHate = makePerson('a', { activeScheme: { ...baseScheme } });
    aHate = withOpinion(aHate, 'b', -100);
    const bHate = makePerson('b');
    const hateResult = processSchemes(new Map([['a', aHate], ['b', bHate]]), 1, rng);
    const hateProgress = hateResult.updatedPeople.get('a')!.activeScheme?.progress;

    // Neutral: opinion 0 → 1.0× multiplier
    const rng2 = createRNG(1);
    let aNeutral = makePerson('a', { activeScheme: { ...baseScheme } });
    aNeutral = withOpinion(aNeutral, 'b', 0);
    const bNeutral = makePerson('b');
    const neutralResult = processSchemes(new Map([['a', aNeutral], ['b', bNeutral]]), 1, rng2);
    const neutralProgress = neutralResult.updatedPeople.get('a')!.activeScheme?.progress;

    expect(hateProgress).toBeDefined();
    expect(hateProgress!).toBeGreaterThan(neutralProgress!);
  });
});

describe('processSchemes — failure conditions', () => {
  it('fails scheme when target is removed from people', () => {
    const rng = createRNG(42);
    const scheme: PersonScheme = {
      type: 'scheme_befriend_person',
      targetId: 'b', // b not in the Map
      progress: 0.5,
      startedTurn: 0,
      revealedToPlayer: false,
    };
    const a = makePerson('a', { activeScheme: scheme });
    const people = new Map([['a', a]]); // no 'b'

    const result = processSchemes(people, 1, rng);
    const updatedA = result.updatedPeople.get('a')!;
    expect(updatedA.activeScheme).toBeNull();
    const failed = result.logEntries.find(e => e.type === 'scheme_failed');
    expect(failed).toBeDefined();
  });

  it('fails undermine scheme when schemer gains respected_elder trait', () => {
    const rng = createRNG(42);
    const scheme: PersonScheme = {
      type: 'scheme_undermine_person',
      targetId: 'b',
      progress: 0.3,
      startedTurn: 0,
      revealedToPlayer: false,
    };
    let a = makePerson('a', {
      traits: ['respected_elder' as never],  // failure condition
      activeScheme: scheme,
    });
    const b = makePerson('b');
    a = withOpinion(a, 'b', 5); // opinion > 20 would also fail; keep it low to isolate this test
    const people = new Map([['a', a], ['b', b]]);

    const result = processSchemes(people, 1, rng);
    const updatedA = result.updatedPeople.get('a')!;
    expect(updatedA.activeScheme).toBeNull();
  });
});

describe('processSchemes — silent completion (scheme_befriend_person)', () => {
  it('forms a friend relationship silently when befriend reaches 1.0', () => {
    const rng = createRNG(42);
    const scheme: PersonScheme = {
      type: 'scheme_befriend_person',
      targetId: 'b',
      progress: 0.96, // 0.96 + 0.05 = 1.01 → completes
      startedTurn: 0,
      revealedToPlayer: false,
    };
    let a = makePerson('a', { activeScheme: scheme });
    const b = makePerson('b');
    a = withOpinion(a, 'b', 10);
    const people = new Map([['a', a], ['b', b]]);

    const result = processSchemes(people, 1, rng);
    const updatedA = result.updatedPeople.get('a')!;
    expect(updatedA.activeScheme).toBeNull();
    expect(updatedA.namedRelationships.some(r => r.type === 'friend' && r.targetId === 'b')).toBe(true);
    // Silent: no pending scheme events for this type
    expect(result.pendingSchemeEvents.some(e => e.personId === 'a')).toBe(false);
  });
});

describe('processSchemes — non-silent completion fires events', () => {
  it('fires sch_courtship_discovered when court scheme reaches 1.0', () => {
    const rng = createRNG(42);
    const scheme: PersonScheme = {
      type: 'scheme_court_person',
      targetId: 'b',
      // rate = 0.04 × clamp(opinion/100, 0.5, 1.5); at opinion=100 rate=0.04; 0.97+0.04=1.01 ≥ 1.0
      progress: 0.97,
      startedTurn: 0,
      revealedToPlayer: false,
    };
    let a = makePerson('a', { activeScheme: scheme, sex: 'male' });
    let b = makePerson('b', { sex: 'female' });
    a = withOpinion(a, 'b', 100); // factor = 1.0 → rate = 0.04 → 0.97 + 0.04 = 1.01 ≥ 1.0
    const people = new Map([['a', a], ['b', b]]);

    const result = processSchemes(people, 1, rng);
    const evt = result.pendingSchemeEvents.find(e => e.eventId === 'sch_courtship_discovered');
    expect(evt).toBeDefined();
    expect(evt!.personId).toBe('a');
    expect(evt!.targetId).toBe('b');
  });

  it('fires sch_conversion_complete when convert scheme reaches 1.0', () => {
    const rng = createRNG(42);
    const scheme: PersonScheme = {
      type: 'scheme_convert_faith',
      targetId: 'b',
      progress: 0.98,
      startedTurn: 0,
      revealedToPlayer: false,
    };
    const a = makePerson('a', { activeScheme: scheme, religion: 'imanian_orthodox' });
    const b = makePerson('b', { religion: 'sacred_wheel' });
    const people = new Map([['a', a], ['b', b]]);

    const result = processSchemes(people, 1, rng);
    const evt = result.pendingSchemeEvents.find(e => e.eventId === 'sch_conversion_complete');
    expect(evt).toBeDefined();
  });
});

describe('processSchemes — log entries', () => {
  it('emits scheme_started log on new scheme generation (turn 12)', () => {
    const rng = createRNG(42);
    let a = makePerson('a', { traits: ['gregarious' as never] });
    const b = makePerson('b');
    a = withOpinion(a, 'b', 50);
    const people = new Map([['a', a], ['b', b]]);

    const result = processSchemes(people, 12, rng);
    expect(result.logEntries.some(e => e.type === 'scheme_started')).toBe(true);
  });

  it('emits scheme_succeeded log on silent befriend completion', () => {
    const rng = createRNG(42);
    const scheme: PersonScheme = {
      type: 'scheme_befriend_person',
      targetId: 'b',
      progress: 0.96,
      startedTurn: 0,
      revealedToPlayer: false,
    };
    let a = makePerson('a', { activeScheme: scheme });
    const b = makePerson('b');
    a = withOpinion(a, 'b', 10);
    const people = new Map([['a', a], ['b', b]]);

    const result = processSchemes(people, 1, rng);
    expect(result.logEntries.some(e => e.type === 'scheme_succeeded')).toBe(true);
  });

  it('emits scheme_failed log on failure', () => {
    const rng = createRNG(42);
    const scheme: PersonScheme = {
      type: 'scheme_befriend_person',
      targetId: 'b',
      progress: 0.5,
      startedTurn: 0,
      revealedToPlayer: false,
    };
    const a = makePerson('a', { activeScheme: scheme }); // no 'b' in people
    const people = new Map([['a', a]]);

    const result = processSchemes(people, 1, rng);
    expect(result.logEntries.some(e => e.type === 'scheme_failed')).toBe(true);
  });

  it('returns empty logEntries when no schemes exist', () => {
    const rng = createRNG(42);
    const a = makePerson('a'); // no traits, no scheme
    const people = new Map([['a', a]]);

    const result = processSchemes(people, 1, rng);
    expect(result.logEntries).toHaveLength(0);
  });
});

describe('processSchemes — intermediate events', () => {
  it('fires sch_faith_advocacy_noticed at progress ≥ 0.45', () => {
    const rng = createRNG(42);
    const scheme: PersonScheme = {
      type: 'scheme_convert_faith',
      targetId: 'b',
      progress: 0.43, // 0.43 + 0.025 = 0.455 → crosses 0.45
      startedTurn: 0,
      revealedToPlayer: false,
    };
    const a = makePerson('a', { activeScheme: scheme, religion: 'imanian_orthodox' });
    const b = makePerson('b', { religion: 'sacred_wheel' });
    const people = new Map([['a', a], ['b', b]]);

    const result = processSchemes(people, 1, rng);
    const evt = result.pendingSchemeEvents.find(e => e.eventId === 'sch_faith_advocacy_noticed');
    expect(evt).toBeDefined();
  });

  it('fires sch_rumours_spreading at progress ≥ 0.50 for undermine scheme', () => {
    const rng = createRNG(42);
    const scheme: PersonScheme = {
      type: 'scheme_undermine_person',
      targetId: 'b',
      progress: 0.47, // 0.47 + 0.04 = 0.51 → crosses 0.50
      startedTurn: 0,
      revealedToPlayer: false,
    };
    let a = makePerson('a', { activeScheme: scheme });
    const b = makePerson('b');
    // opinion must stay ≤ 20 to avoid failure
    a = withOpinion(a, 'b', 5);
    const people = new Map([['a', a], ['b', b]]);

    const result = processSchemes(people, 1, rng);
    const evt = result.pendingSchemeEvents.find(e => e.eventId === 'sch_rumours_spreading');
    expect(evt).toBeDefined();
  });
});

// ─── generateScheme — alternate trait triggers ────────────────────────────────
// Each scheme type has two qualifying traits; only one is tested above. These
// verify the second trait path so a trait-roster change doesn't silently break
// scheme generation.

describe('generateScheme — alternate trait triggers', () => {
  it('romantic trait also generates courtship scheme', () => {
    const rng = createRNG(1);
    let a = makePerson('a', { traits: ['romantic' as never], sex: 'male' });
    const b = makePerson('b', { sex: 'female' });
    a = withOpinion(a, 'b', 55);
    const people = new Map([['a', a], ['b', b]]);

    const scheme = generateScheme(a, people, 0, rng);
    expect(scheme?.type).toBe('scheme_court_person');
  });

  it('pious trait also generates conversion scheme', () => {
    const rng = createRNG(1);
    let a = makePerson('a', { traits: ['pious' as never], religion: 'imanian_orthodox' });
    const b = makePerson('b', { religion: 'sacred_wheel' });
    a = withOpinion(a, 'b', 35);
    const people = new Map([['a', a], ['b', b]]);

    const scheme = generateScheme(a, people, 0, rng);
    expect(scheme?.type).toBe('scheme_convert_faith');
  });

  it('lonely trait also generates befriend scheme', () => {
    const rng = createRNG(1);
    let a = makePerson('a', { traits: ['lonely' as never] });
    const b = makePerson('b');
    a = withOpinion(a, 'b', 45);
    const people = new Map([['a', a], ['b', b]]);

    const scheme = generateScheme(a, people, 0, rng);
    expect(scheme?.type).toBe('scheme_befriend_person');
  });

  it('ambitious trait generates undermine scheme via rival', () => {
    const rng = createRNG(1);
    const a = makePerson('a', {
      traits: ['ambitious' as never],
      namedRelationships: [makeRel('rival', 'b')],
    });
    const b = makePerson('b');
    const people = new Map([['a', a], ['b', b]]);

    const scheme = generateScheme(a, people, 0, rng);
    expect(scheme?.type).toBe('scheme_undermine_person');
    expect(scheme?.targetId).toBe('b');
  });
});

// ─── generateScheme — opinion boundary conditions ─────────────────────────────
// One point below each threshold must not generate the scheme; at the threshold
// it must. This directly tests the gate that prevents schemes from starting in
// low-opinion early-game settlements.

describe('generateScheme — opinion thresholds', () => {
  it('befriend requires opinion ≥ 40: does not generate at 39', () => {
    const rng = createRNG(1);
    let a = makePerson('a', { traits: ['gregarious' as never] });
    const b = makePerson('b');
    a = withOpinion(a, 'b', 39);
    const people = new Map([['a', a], ['b', b]]);

    expect(generateScheme(a, people, 0, rng)).toBeNull();
  });

  it('befriend generates at exactly opinion 40', () => {
    const rng = createRNG(1);
    let a = makePerson('a', { traits: ['gregarious' as never] });
    const b = makePerson('b');
    a = withOpinion(a, 'b', 40);
    const people = new Map([['a', a], ['b', b]]);

    expect(generateScheme(a, people, 0, rng)?.type).toBe('scheme_befriend_person');
  });

  it('court requires opinion ≥ 50: does not generate at 49', () => {
    const rng = createRNG(1);
    let a = makePerson('a', { traits: ['passionate' as never], sex: 'male' });
    const b = makePerson('b', { sex: 'female' });
    a = withOpinion(a, 'b', 49);
    const people = new Map([['a', a], ['b', b]]);

    expect(generateScheme(a, people, 0, rng)).toBeNull();
  });

  it('court generates at exactly opinion 50', () => {
    const rng = createRNG(1);
    let a = makePerson('a', { traits: ['passionate' as never], sex: 'male' });
    const b = makePerson('b', { sex: 'female' });
    a = withOpinion(a, 'b', 50);
    const people = new Map([['a', a], ['b', b]]);

    expect(generateScheme(a, people, 0, rng)?.type).toBe('scheme_court_person');
  });

  it('convert requires opinion ≥ 30: does not generate at 29', () => {
    const rng = createRNG(1);
    let a = makePerson('a', { traits: ['zealous' as never], religion: 'imanian_orthodox' });
    const b = makePerson('b', { religion: 'sacred_wheel' });
    a = withOpinion(a, 'b', 29);
    const people = new Map([['a', a], ['b', b]]);

    expect(generateScheme(a, people, 0, rng)).toBeNull();
  });

  it('convert generates at exactly opinion 30', () => {
    const rng = createRNG(1);
    let a = makePerson('a', { traits: ['zealous' as never], religion: 'imanian_orthodox' });
    const b = makePerson('b', { religion: 'sacred_wheel' });
    a = withOpinion(a, 'b', 30);
    const people = new Map([['a', a], ['b', b]]);

    expect(generateScheme(a, people, 0, rng)?.type).toBe('scheme_convert_faith');
  });
});

// ─── processSchemes — additional failure conditions ──────────────────────────
// Tests failure paths not covered above: marriage, opinion collapse, and
// crossing the opinion-too-high boundary for the undermine scheme.

describe('processSchemes — additional failure conditions', () => {
  it('fails court scheme when target gets married (spouseIds non-empty)', () => {
    const rng = createRNG(1);
    const scheme: PersonScheme = {
      type: 'scheme_court_person',
      targetId: 'b',
      progress: 0.5,
      startedTurn: 0,
      revealedToPlayer: false,
    };
    let a = makePerson('a', { activeScheme: scheme, sex: 'male' });
    // Target has acquired a spouse since the scheme started.
    const b = makePerson('b', { sex: 'female', spouseIds: ['c'] });
    a = withOpinion(a, 'b', 60);
    const c = makePerson('c', { sex: 'male' });
    const people = new Map([['a', a], ['b', b], ['c', c]]);

    const result = processSchemes(people, 1, rng);
    expect(result.updatedPeople.get('a')!.activeScheme).toBeNull();
    expect(result.logEntries.some(e => e.type === 'scheme_failed')).toBe(true);
  });

  it('fails court scheme when schemer opinion toward target drops below -10', () => {
    const rng = createRNG(1);
    const scheme: PersonScheme = {
      type: 'scheme_court_person',
      targetId: 'b',
      progress: 0.5,
      startedTurn: 0,
      revealedToPlayer: false,
    };
    let a = makePerson('a', { activeScheme: scheme, sex: 'male' });
    const b = makePerson('b', { sex: 'female' });
    // Opinion has fallen to -11 — below the court failure threshold of -10.
    a = withOpinion(a, 'b', -11);
    const people = new Map([['a', a], ['b', b]]);

    const result = processSchemes(people, 1, rng);
    expect(result.updatedPeople.get('a')!.activeScheme).toBeNull();
  });

  it('does NOT fail court scheme when opinion is exactly -10', () => {
    const rng = createRNG(1);
    const scheme: PersonScheme = {
      type: 'scheme_court_person',
      targetId: 'b',
      progress: 0.5,
      startedTurn: 0,
      revealedToPlayer: false,
    };
    let a = makePerson('a', { activeScheme: scheme, sex: 'male' });
    const b = makePerson('b', { sex: 'female' });
    a = withOpinion(a, 'b', -10);
    const people = new Map([['a', a], ['b', b]]);

    const result = processSchemes(people, 1, rng);
    // At exactly -10 the scheme should still be alive (failure is < -10).
    expect(result.updatedPeople.get('a')!.activeScheme).not.toBeNull();
  });

  it('fails undermine scheme when schemer opinion toward target rises above 20', () => {
    const rng = createRNG(1);
    const scheme: PersonScheme = {
      type: 'scheme_undermine_person',
      targetId: 'b',
      progress: 0.3,
      startedTurn: 0,
      revealedToPlayer: false,
    };
    let a = makePerson('a', { activeScheme: scheme });
    const b = makePerson('b');
    // A positive opinion event pushed schemer's view of target above the threshold.
    a = withOpinion(a, 'b', 21);
    const people = new Map([['a', a], ['b', b]]);

    const result = processSchemes(people, 1, rng);
    expect(result.updatedPeople.get('a')!.activeScheme).toBeNull();
  });

  it('does NOT fail undermine when opinion is exactly 20', () => {
    const rng = createRNG(1);
    const scheme: PersonScheme = {
      type: 'scheme_undermine_person',
      targetId: 'b',
      progress: 0.3,
      startedTurn: 0,
      revealedToPlayer: false,
    };
    let a = makePerson('a', { activeScheme: scheme });
    const b = makePerson('b');
    a = withOpinion(a, 'b', 20);
    const people = new Map([['a', a], ['b', b]]);

    const result = processSchemes(people, 1, rng);
    // opinion === 20 is not > 20, scheme should still be active (and advance).
    expect(result.updatedPeople.get('a')!.activeScheme).not.toBeNull();
  });
});

// ─── processSchemes — completion: tutor ──────────────────────────────────────

describe('processSchemes — tutor scheme completion', () => {
  it('fires sch_tutor_breakthrough when tutor reaches 1.0', () => {
    const rng = createRNG(1);
    // rate = 0.03; 0.98 + 0.03 = 1.01 ≥ 1.0
    const scheme: PersonScheme = {
      type: 'scheme_tutor_person',
      targetId: 'b',
      progress: 0.98,
      startedTurn: 0,
      revealedToPlayer: false,
    };
    const a = makePerson('a', {
      activeScheme: scheme,
      namedRelationships: [makeRel('mentor', 'b')],
    });
    const b = makePerson('b');
    const people = new Map([['a', a], ['b', b]]);

    const result = processSchemes(people, 1, rng);
    const evt = result.pendingSchemeEvents.find(e => e.eventId === 'sch_tutor_breakthrough');
    expect(evt).toBeDefined();
    expect(evt!.personId).toBe('a');
    expect(evt!.targetId).toBe('b');
  });

  it('applies +4 skill boost to the student in the shared people map', () => {
    const rng = createRNG(1);
    const scheme: PersonScheme = {
      type: 'scheme_tutor_person',
      targetId: 'b',
      progress: 0.98,
      startedTurn: 0,
      revealedToPlayer: false,
    };
    // Mentor is strongest in combat (60); student starts at combat 20.
    const a = makePerson('a', {
      activeScheme: scheme,
      namedRelationships: [makeRel('mentor', 'b')],
      skills: { animals: 25, bargaining: 25, combat: 60, custom: 25, leadership: 25, plants: 25 },
    });
    const b = makePerson('b', {
      skills: { animals: 25, bargaining: 25, combat: 20, custom: 25, leadership: 25, plants: 25 },
    });
    const people = new Map([['a', a], ['b', b]]);

    processSchemes(people, 1, rng);

    // The boost is applied directly to the `people` Map passed in (reference mutation).
    const updatedB = people.get('b')!;
    expect(updatedB.skills.combat).toBe(24); // 20 + 4
  });

  it('clears the tutor activeScheme after completion', () => {
    const rng = createRNG(1);
    const scheme: PersonScheme = {
      type: 'scheme_tutor_person',
      targetId: 'b',
      progress: 0.98,
      startedTurn: 0,
      revealedToPlayer: false,
    };
    const a = makePerson('a', {
      activeScheme: scheme,
      namedRelationships: [makeRel('mentor', 'b')],
    });
    const b = makePerson('b');
    const people = new Map([['a', a], ['b', b]]);

    const result = processSchemes(people, 1, rng);
    expect(result.updatedPeople.get('a')!.activeScheme).toBeNull();
  });
});

// ─── processSchemes — completion: undermine ──────────────────────────────────

describe('processSchemes — undermine scheme completion', () => {
  it('fires sch_undermining_climax when undermine reaches 1.0', () => {
    const rng = createRNG(1);
    // rate = 0.04; 0.97 + 0.04 = 1.01 ≥ 1.0; opinion must stay ≤ 20 to avoid failure
    const scheme: PersonScheme = {
      type: 'scheme_undermine_person',
      targetId: 'b',
      progress: 0.97,
      startedTurn: 0,
      revealedToPlayer: false,
    };
    let a = makePerson('a', { activeScheme: scheme });
    const b = makePerson('b');
    a = withOpinion(a, 'b', 5); // well below failure threshold
    const people = new Map([['a', a], ['b', b]]);

    const result = processSchemes(people, 1, rng);
    const evt = result.pendingSchemeEvents.find(e => e.eventId === 'sch_undermining_climax');
    expect(evt).toBeDefined();
    expect(evt!.personId).toBe('a');
    expect(evt!.targetId).toBe('b');
  });
});

// ─── processSchemes — court progress rate scaling ────────────────────────────
// The court scheme is the only one that scales its rate by opinion.
// High-opinion schemers should clearly advance faster than low-opinion ones.

describe('processSchemes — court scheme progress rate', () => {
  it('advances faster with high opinion (factor = 1.5×)', () => {
    const rng = createRNG(1);
    const scheme: PersonScheme = {
      type: 'scheme_court_person',
      targetId: 'b',
      progress: 0,
      startedTurn: 0,
      revealedToPlayer: false,
    };
    let a = makePerson('a', { activeScheme: scheme, sex: 'male' });
    const b = makePerson('b', { sex: 'female' });
    // opinion = 100 → factor = clamp(1.0 + 100/200, 0.5, 1.5) = 1.5 → rate = 0.04 * 1.5 = 0.06
    a = withOpinion(a, 'b', 100);
    const people = new Map([['a', a], ['b', b]]);

    const result = processSchemes(people, 1, rng);
    const progress = result.updatedPeople.get('a')!.activeScheme!.progress;
    // rate = 0.04 * 1.5 = 0.06
    expect(progress).toBeCloseTo(0.06);
  });

  it('advances at baseline with neutral opinion (factor = 1.0×)', () => {
    const rng = createRNG(1);
    const scheme: PersonScheme = {
      type: 'scheme_court_person',
      targetId: 'b',
      progress: 0,
      startedTurn: 0,
      revealedToPlayer: false,
    };
    let a = makePerson('a', { activeScheme: scheme, sex: 'male' });
    const b = makePerson('b', { sex: 'female' });
    // opinion = 0 → factor = clamp(1.0 + 0/200, 0.5, 1.5) = 1.0 → rate = 0.04
    a = withOpinion(a, 'b', 0);
    const people = new Map([['a', a], ['b', b]]);

    const result = processSchemes(people, 1, rng);
    const progress = result.updatedPeople.get('a')!.activeScheme!.progress;
    // rate = 0.04 * 1.0 = 0.04
    expect(progress).toBeCloseTo(0.04);
  });

  it('advances slower with very negative opinion — tutor scheme hits 0.5× floor', () => {
    // Use scheme_tutor_person: failure is relationship-based (not opinion-based), so
    // a mentor relationship keeps the scheme alive even at opinion = -100.
    // factor = clamp(1.0 + (-100)/200, 0.5, 1.5) = 0.5 → rate = 0.03 * 0.5 = 0.015
    const rng = createRNG(1);
    const scheme: PersonScheme = {
      type: 'scheme_tutor_person',
      targetId: 'b',
      progress: 0,
      startedTurn: 0,
      revealedToPlayer: false,
    };
    let a = makePerson('a', {
      activeScheme: scheme,
      namedRelationships: [makeRel('mentor', 'b')], // keeps tutor alive
    });
    const b = makePerson('b');
    // opinion = -100 → factor = clamp(1.0 + (-100)/200, 0.5, 1.5) = 0.5 → rate = 0.015
    a = withOpinion(a, 'b', -100);
    const people = new Map([['a', a], ['b', b]]);

    const result = processSchemes(people, 1, rng);
    const progress = result.updatedPeople.get('a')!.activeScheme!.progress;
    // rate = 0.03 * 0.5 = 0.015
    expect(progress).toBeCloseTo(0.015);
  });
});

// ─── generateScheme — turn 0 behaviour ───────────────────────────────────────
// Turn 0 is divisible by SCHEME_GENERATE_INTERVAL (12), so the engine should
// attempt generation. This matters because processDawn fires on turn 0.

describe('generateScheme — turn 0 behaviour', () => {
  it('processSchemes attempts generation on turn 0 (0 % 12 === 0)', () => {
    const rng = createRNG(1);
    let a = makePerson('a', { traits: ['gregarious' as never] });
    const b = makePerson('b');
    // Opinion at 40 — just at threshold
    a = withOpinion(a, 'b', 40);
    const people = new Map([['a', a], ['b', b]]);

    const result = processSchemes(people, 0, rng);
    expect(result.updatedPeople.get('a')?.activeScheme).not.toBeNull();
  });

  it('does not trigger befriend on turn 0 when opinion is below 40 (typical early-game)', () => {
    const rng = createRNG(1);
    let a = makePerson('a', { traits: ['gregarious' as never] });
    const b = makePerson('b');
    // Typical baseline opinion from initializeBaselineOpinions for same-culture pair is ~18.
    a = withOpinion(a, 'b', 18);
    const people = new Map([['a', a], ['b', b]]);

    const result = processSchemes(people, 0, rng);
    expect(result.updatedPeople.get('a')?.activeScheme ?? null).toBeNull();
  });

  it('convert scheme can trigger on turn 0 when opinion hits 30', () => {
    const rng = createRNG(1);
    let a = makePerson('a', { traits: ['zealous' as never], religion: 'imanian_orthodox' });
    const b = makePerson('b', { religion: 'sacred_wheel' });
    a = withOpinion(a, 'b', 30);
    const people = new Map([['a', a], ['b', b]]);

    const result = processSchemes(people, 0, rng);
    expect(result.updatedPeople.get('a')?.activeScheme?.type).toBe('scheme_convert_faith');
  });
});

// ─── Event registration ───────────────────────────────────────────────────────
// Scheme events must be in ALL_EVENTS so the store can look them up via
// getEventById when injecting them into the pending queue. A missing registration
// silently drops scheme events, making it look like schemes never fire.

describe('scheme event registration in ALL_EVENTS', () => {
  const SCHEME_EVENT_IDS = [
    'sch_courtship_discovered',
    'sch_sauro_courtship_open',
    'sch_faith_advocacy_noticed',
    'sch_conversion_complete',
    'sch_rumours_spreading',
    'sch_undermining_climax',
    'sch_tutor_breakthrough',
  ] as const;

  for (const id of SCHEME_EVENT_IDS) {
    it(`getEventById finds '${id}'`, () => {
      expect(getEventById(id)).toBeDefined();
    });
  }

  it('sch_courtship_discovered has schemer as slot[0] and beloved as slot[1]', () => {
    const ev = getEventById('sch_courtship_discovered')!;
    expect(ev.actorRequirements![0].slot).toBe('schemer');
    expect(ev.actorRequirements![1].slot).toBe('beloved');
  });

  it('sch_faith_advocacy_noticed has advocate as slot[0] and listener as slot[1]', () => {
    const ev = getEventById('sch_faith_advocacy_noticed')!;
    expect(ev.actorRequirements![0].slot).toBe('advocate');
    expect(ev.actorRequirements![1].slot).toBe('listener');
  });

  it('sch_undermining_climax has schemer as slot[0] and victim as slot[1]', () => {
    const ev = getEventById('sch_undermining_climax')!;
    expect(ev.actorRequirements![0].slot).toBe('schemer');
    expect(ev.actorRequirements![1].slot).toBe('victim');
  });

  it('sch_tutor_breakthrough has mentor as slot[0] and student as slot[1]', () => {
    const ev = getEventById('sch_tutor_breakthrough')!;
    expect(ev.actorRequirements![0].slot).toBe('mentor');
    expect(ev.actorRequirements![1].slot).toBe('student');
  });

  it('all 6 scheme events have isDeferredOutcome true (not drawn from normal deck)', () => {
    for (const id of SCHEME_EVENT_IDS) {
      expect(getEventById(id)!.isDeferredOutcome).toBe(true);
    }
  });
});

// ─── Sauromatian scheme generation ─────────────────────────────────────────────────────────────────

describe('generateScheme — Sauromatian seek_companion priority path', () => {
  it('Sauromatian woman with seek_companion ambition generates scheme at opinion ≥25', () => {
    const rng = createRNG(99);
    let a = makePerson('a', {
      sex: 'female',
      heritage: {
        bloodline: [{ group: 'kiswani_haisla', fraction: 1.0 }],
        primaryCulture: 'kiswani_haisla',
        culturalFluency: new Map(),
      },
      ambition: { type: 'seek_companion', intensity: 0.8, targetPersonId: null, formedTurn: 0 },
      spouseIds: [],
    });
    const b = makePerson('b', { sex: 'male', spouseIds: [] });
    a = { ...a, relationships: new Map([[b.id, 25]]) };
    const people = new Map([['a', a], ['b', b]]);

    const scheme = generateScheme(a, people, 0, rng);
    expect(scheme).not.toBeNull();
    expect(scheme!.type).toBe('scheme_court_person');
    expect(scheme!.targetId).toBe('b');
  });

  it('Sauromatian woman does NOT generate scheme when opinion is below 25 but Imanian woman needs 50', () => {
    // The Sauromatian path uses threshold 25; without the Sauro path a male with trait
    // passionate and opinion 30 would normally also pass. We just confirm the Sauromatian
    // path fires at 25 where it otherwise would not.
    const rng = createRNG(99);
    let a = makePerson('a', {
      sex: 'female',
      heritage: {
        bloodline: [{ group: 'kiswani_haisla', fraction: 1.0 }],
        primaryCulture: 'kiswani_haisla',
        culturalFluency: new Map(),
      },
      ambition: { type: 'seek_companion', intensity: 0.8, targetPersonId: null, formedTurn: 0 },
      spouseIds: [],
    });
    const b = makePerson('b', { sex: 'male', spouseIds: [] });
    // Opinion below even the Sauro threshold
    a = { ...a, relationships: new Map([[b.id, 10]]) };
    const people = new Map([['a', a], ['b', b]]);

    const scheme = generateScheme(a, people, 0, rng);
    // scheme_court_person requires opinion ≥25 for Sauro path; result may be null or a different type
    if (scheme !== null) {
      expect(scheme.type).not.toBe('scheme_court_person');
    }
  });
});

describe('processSchemes — Sauromatian climax event routing', () => {
  function makeState(people: Map<string, ReturnType<typeof makePerson>>) {
    return {
      turnNumber: 100,
      people,
      settlement: { name: 'Test', location: 'marsh', buildings: [], resources: {}, populationCount: people.size, courtshipNorms: 'mixed' },
      culture: { languages: new Map(), primaryLanguage: 'ansberite', religions: new Map(), religiousTension: 0, culturalBlend: 0, practices: [], governance: 'patriarchal_imanian' },
      eventHistory: [],
      eventCooldowns: new Map(),
      factions: [],
      activityLog: [],
      graveyard: [],
      config: { difficulty: 'normal', startingLocation: 'marsh', includeSauromatianWomen: false, startingTribes: [] },
      households: new Map(),
      deferred: [],
      flags: {},
      identityPressure: { companyPressureTurns: 0, tribalPressureTurns: 0 },
      company: { standing: 60, annualQuotaGold: 0, annualQuotaGoods: 0, consecutiveFailures: 0, supportLevel: 'standard', yearsActive: 0 },
    } as unknown as import('../../src/simulation/turn/game-state').GameState;
  }

  it('Sauromatian schemer fires sch_sauro_courtship_open on scheme completion', () => {
    const rng = createRNG(7);
    const target = makePerson('t', { sex: 'male', age: 25 });
    const schemer = makePerson('s', {
      sex: 'female',
      heritage: {
        bloodline: [{ group: 'kiswani_haisla', fraction: 1.0 }],
        primaryCulture: 'kiswani_haisla',
        culturalFluency: new Map(),
      },
      activeScheme: {
        type: 'scheme_court_person',
        targetId: target.id,
        progress: 100, // already complete
        startedTurn: 1,
        revealedToPlayer: false,
      },
    });
    const people = new Map([['s', schemer], ['t', target]]);
    const state = makeState(people);

    const result = processSchemes(people, state.turnNumber, rng);
    const firedEvent = result.pendingSchemeEvents.find(e => e.eventId === 'sch_sauro_courtship_open');
    expect(firedEvent).toBeDefined();
  });

  it('Imanian schemer fires sch_courtship_discovered on scheme completion', () => {
    const rng = createRNG(7);
    const target = makePerson('t', { sex: 'female', age: 22 });
    const schemer = makePerson('s', {
      sex: 'male',
      // default heritage is imanian (from makePerson)
      activeScheme: {
        type: 'scheme_court_person',
        targetId: target.id,
        progress: 100,
        startedTurn: 1,
        revealedToPlayer: false,
      },
    });
    const people = new Map([['s', schemer], ['t', target]]);
    const state = makeState(people);

    const result = processSchemes(people, state.turnNumber, rng);
    const firedEvent = result.pendingSchemeEvents.find(e => e.eventId === 'sch_courtship_discovered');
    expect(firedEvent).toBeDefined();
  });
});
