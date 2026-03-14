import { describe, it, expect } from 'vitest';
import type { Person, NamedRelationship, NamedRelationshipType } from '../../src/simulation/population/person';
import type { OpinionModifier } from '../../src/simulation/population/person';
import { processNamedRelationships } from '../../src/simulation/population/named-relationships';
import { createRNG } from '../../src/utils/rng';

// ─── Test helpers ─────────────────────────────────────────────────────────────

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
      ethnicGroup: 'imanian',
    },
    genetics: {
      skinTone: 0.3, hairColor: 'brown', hairTexture: 'straight', eyeColor: 'blue',
      heightModifier: 0, buildModifier: 0, genderRatioModifier: 0, extendedFertility: false,
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

function makeRel(type: NamedRelationshipType, targetId: string, depth = 0.1): NamedRelationship {
  return { type, targetId, formedTurn: 1, depth, revealedToPlayer: false };
}

const RNG = createRNG(42);

// ─── processNamedRelationships — depth growth ─────────────────────────────────

describe('processNamedRelationships — depth growth', () => {
  it('grows depth of an existing relationship by DEPTH_GROWTH_PER_TURN each turn', () => {
    // Opinion must be ≥ FRIEND_DISSOLVE_THRESHOLD (20) to prevent the dissolution step removing the bond
    const a = makePerson('a', {
      namedRelationships: [makeRel('friend', 'b', 0.2)],
      relationships: new Map([['b', 30]]),
    });
    const b = makePerson('b', {
      namedRelationships: [makeRel('friend', 'a', 0.2)],
      relationships: new Map([['a', 30]]),
    });
    const people = new Map([['a', a], ['b', b]]);
    const { updatedPeople } = processNamedRelationships(people, 10, RNG);
    const updA = updatedPeople.get('a') ?? a;
    const rel = updA.namedRelationships.find(r => r.type === 'friend' && r.targetId === 'b');
    expect(rel).toBeDefined();
    expect(rel!.depth).toBeCloseTo(0.22); // 0.2 + 0.02
  });

  it('depth is capped at 1.0', () => {
    const a = makePerson('a', {
      namedRelationships: [makeRel('friend', 'b', 0.99)],
      relationships: new Map([['b', 30]]),  // prevent dissolution
    });
    const b = makePerson('b', { namedRelationships: [] });
    const people = new Map([['a', a], ['b', b]]);
    const { updatedPeople } = processNamedRelationships(people, 10, RNG);
    const updA = updatedPeople.get('a') ?? a;
    const rel = updA.namedRelationships.find(r => r.type === 'friend' && r.targetId === 'b');
    expect(rel!.depth).toBe(1.0);
  });
});

// ─── processNamedRelationships — friend formation ────────────────────────────

describe('processNamedRelationships — friend formation', () => {
  it('forms a friend bond when opinion ≥ 60 sustained for ≥ 6 turns', () => {
    // opinion ≥ 60 and opinionSustainedSince was set 7 turns ago
    const a = makePerson('a', {
      relationships: new Map([['b', 65]]),
      opinionSustainedSince: { 'b': 2 },
    });
    const b = makePerson('b', {
      relationships: new Map([['a', 65]]),
      opinionSustainedSince: { 'a': 2 },
    });
    const people = new Map([['a', a], ['b', b]]);
    const { updatedPeople, logEntries } = processNamedRelationships(people, 10, RNG);
    const updA = updatedPeople.get('a') ?? a;
    const formed = updA.namedRelationships.some(r => r.type === 'friend' && r.targetId === 'b');
    expect(formed).toBe(true);
    expect(logEntries.some(e => e.type === 'relationship_formed' && e.relationshipType === 'friend')).toBe(true);
  });

  it('does not form a friend bond when opinion threshold not yet sustained long enough', () => {
    const a = makePerson('a', {
      relationships: new Map([['b', 65]]),
      opinionSustainedSince: { 'b': 9 }, // only 1 turn ago
    });
    const b = makePerson('b', {
      relationships: new Map([['a', 65]]),
      opinionSustainedSince: { 'a': 9 },
    });
    const people = new Map([['a', a], ['b', b]]);
    const { updatedPeople } = processNamedRelationships(people, 10, RNG);
    const updA = updatedPeople.get('a') ?? a;
    expect(updA.namedRelationships.some(r => r.type === 'friend')).toBe(false);
  });

  it('does not re-form a friend bond that already exists', () => {
    const a = makePerson('a', {
      relationships: new Map([['b', 70]]),
      opinionSustainedSince: { 'b': 1 },
      namedRelationships: [makeRel('friend', 'b')],
    });
    const b = makePerson('b', { relationships: new Map([['a', 70]]) });
    const people = new Map([['a', a], ['b', b]]);
    const { logEntries } = processNamedRelationships(people, 10, RNG);
    // Should not fire a second 'relationship_formed' for the same pair
    const friendFormEvents = logEntries.filter(
      e => e.type === 'relationship_formed' && e.personId === 'a' && e.targetId === 'b',
    );
    expect(friendFormEvents).toHaveLength(0);
  });
});

// ─── processNamedRelationships — rival formation ──────────────────────────────

describe('processNamedRelationships — rival formation', () => {
  it('forms a rival bond when opinion ≤ -25 sustained ≥ 4 turns', () => {
    const a = makePerson('a', {
      relationships: new Map([['b', -30]]),
      opinionSustainedSince: { 'b': 1 },
    });
    const b = makePerson('b', {
      relationships: new Map([['a', -30]]),
      opinionSustainedSince: { 'a': 1 },
    });
    const people = new Map([['a', a], ['b', b]]);
    const { updatedPeople } = processNamedRelationships(people, 10, RNG);
    const updA = updatedPeople.get('a') ?? a;
    expect(updA.namedRelationships.some(r => r.type === 'rival' && r.targetId === 'b')).toBe(true);
  });

  it('forms an instant rival when both persons have competing council/seniority ambitions', () => {
    const a = makePerson('a', {
      relationships: new Map([['b', 0]]),
      ambition: { type: 'seek_council', intensity: 0.8, targetPersonId: null, formedTurn: 1 },
    });
    const b = makePerson('b', {
      relationships: new Map([['a', 0]]),
      ambition: { type: 'seek_council', intensity: 0.8, targetPersonId: null, formedTurn: 1 },
    });
    const people = new Map([['a', a], ['b', b]]);
    const { updatedPeople } = processNamedRelationships(people, 10, RNG);
    const updA = updatedPeople.get('a') ?? a;
    expect(updA.namedRelationships.some(r => r.type === 'rival' && r.targetId === 'b')).toBe(true);
  });
});

// ─── processNamedRelationships — nemesis formation ───────────────────────────

describe('processNamedRelationships — nemesis formation', () => {
  it('upgrades rival to nemesis when opinion ≤ -55 sustained ≥ 4 turns', () => {
    const a = makePerson('a', {
      relationships: new Map([['b', -60]]),
      opinionSustainedSince: { 'b': 1 },
    });
    const b = makePerson('b', {
      relationships: new Map([['a', -60]]),
      opinionSustainedSince: { 'a': 1 },
    });
    const people = new Map([['a', a], ['b', b]]);
    const { updatedPeople } = processNamedRelationships(people, 10, RNG);
    const updA = updatedPeople.get('a') ?? a;
    expect(updA.namedRelationships.some(r => r.type === 'nemesis' && r.targetId === 'b')).toBe(true);
  });
});

// ─── processNamedRelationships — mentor formation ────────────────────────────

describe('processNamedRelationships — mentor formation', () => {
  it('forms mentor/student when age gap ≥ 15 and mentor has skill ≥ 63 and student < 45', () => {
    const mentor = makePerson('mentor', {
      age: 50,
      traits: ['mentor_hearted'],
      skills: { animals: 25, bargaining: 25, combat: 70, custom: 25, leadership: 25, plants: 25 },
      languages: [{ language: 'ansberite', fluency: 1.0 }],
    });
    const student = makePerson('student', {
      age: 22,
      skills: { animals: 25, bargaining: 25, combat: 30, custom: 25, leadership: 25, plants: 25 },
      languages: [{ language: 'ansberite', fluency: 1.0 }],
    });
    const people = new Map([['mentor', mentor], ['student', student]]);
    const { updatedPeople } = processNamedRelationships(people, 10, RNG);
    const updMentor = updatedPeople.get('mentor') ?? mentor;
    expect(updMentor.namedRelationships.some(r => r.type === 'mentor' && r.targetId === 'student')).toBe(true);
  });

  it('does not form mentor when no shared language', () => {
    const mentor = makePerson('mentor', {
      age: 50,
      traits: ['mentor_hearted'],
      skills: { animals: 25, bargaining: 25, combat: 70, custom: 25, leadership: 25, plants: 25 },
      languages: [{ language: 'ansberite', fluency: 1.0 }],
    });
    const student = makePerson('student', {
      age: 22,
      skills: { animals: 25, bargaining: 25, combat: 30, custom: 25, leadership: 25, plants: 25 },
      languages: [{ language: 'kiswani', fluency: 1.0 }],
    });
    const people = new Map([['mentor', mentor], ['student', student]]);
    const { updatedPeople } = processNamedRelationships(people, 10, RNG);
    const updMentor = updatedPeople.get('mentor') ?? mentor;
    expect(updMentor.namedRelationships.some(r => r.type === 'mentor')).toBe(false);
  });
});

// ─── processNamedRelationships — friend dissolution ──────────────────────────

describe('processNamedRelationships — friend dissolution', () => {
  it('dissolves a friend bond when opinion drops below threshold consistently', () => {
    // opinion is far below FRIEND_DISSOLVE_THRESHOLD (20), sustained should trigger dissolution
    const a = makePerson('a', {
      relationships: new Map([['b', -5]]),
      opinionSustainedSince: { 'b': 1 },
      namedRelationships: [makeRel('friend', 'b', 0.5)],
    });
    const b = makePerson('b', {
      relationships: new Map([['a', -5]]),
      opinionSustainedSince: { 'a': 1 },
      namedRelationships: [makeRel('friend', 'a', 0.5)],
    });
    const people = new Map([['a', a], ['b', b]]);
    // Run multiple turns to trigger dissolution
    let current = people;
    for (let t = 2; t <= 10; t++) {
      const res = processNamedRelationships(current, t, RNG);
      // Merge delta back
      const merged = new Map(current);
      for (const [id, p] of res.updatedPeople) merged.set(id, p);
      current = merged;
    }
    const finalA = current.get('a')!;
    expect(finalA.namedRelationships.some(r => r.type === 'friend' && r.targetId === 'b')).toBe(false);
  });
});

// ─── processNamedRelationships — log entries ─────────────────────────────────

describe('processNamedRelationships — log entries', () => {
  it('emits a relationship_formed log entry when a bond forms', () => {
    const a = makePerson('a', {
      relationships: new Map([['b', 65]]),
      opinionSustainedSince: { 'b': 1 },
    });
    const b = makePerson('b', {
      relationships: new Map([['a', 65]]),
      opinionSustainedSince: { 'a': 1 },
    });
    const people = new Map([['a', a], ['b', b]]);
    const { logEntries } = processNamedRelationships(people, 10, RNG);
    expect(logEntries.some(e => e.type === 'relationship_formed')).toBe(true);
  });

  it('returns empty log entries when nothing changes', () => {
    const a = makePerson('a');
    const b = makePerson('b');
    const people = new Map([['a', a], ['b', b]]);
    const { logEntries } = processNamedRelationships(people, 10, RNG);
    expect(logEntries).toHaveLength(0);
  });
});
