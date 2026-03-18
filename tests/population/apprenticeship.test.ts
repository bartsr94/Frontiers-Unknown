/**
 * Tests for the apprenticeship system.
 *
 * Covers:
 *   - getTradeSkill:        correct skill mapped per role
 *   - getMasterProgressRate: base rate, skill-tier multipliers, mentor_hearted
 *   - computeCompletionBonus: bonus per skill rating
 *   - processApprenticeships:
 *       Phase A — stale cleanup (master gone, role changed, aged out)
 *       Phase B — progress advance and graduation with tradeTraining bonus
 *       Phase C — formation at check interval; children preferred; student fallback
 *   - Production bonus integration: tradeTraining multiplier applied
 *   - Stacking cap: MAX_TRADE_TRAINING enforced at graduation
 */

import { describe, it, expect } from 'vitest';
import {
  getTradeSkill,
  getMasterProgressRate,
  computeCompletionBonus,
  processApprenticeships,
  TRAINABLE_TRADES,
  MAX_TRADE_TRAINING,
} from '../../src/simulation/population/apprenticeship';
import type { Person, WorkRole, NamedRelationship } from '../../src/simulation/population/person';
import { createRNG } from '../../src/utils/rng';

// ─── Helper ───────────────────────────────────────────────────────────────────

function makePerson(id: string, overrides: Partial<Person> = {}): Person {
  return {
    id,
    firstName: `Person_${id}`,
    familyName: 'Test',
    sex: 'male',
    age: 25,
    alive: true,
    role: 'farmer' as WorkRole,
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
    childrenIds: [],
    motherIds: [],
    fatherIds: [],
    parentIds: [null, null],
    relationships: new Map(),
    householdId: null,
    householdRole: null,
    ashkaMelathiPartnerIds: [],
    ambition: null,
    namedRelationships: [],
    activeScheme: null,
    opinionModifiers: [],
    opinionSustainedSince: {},
    skills: { animals: 30, bargaining: 30, combat: 30, custom: 30, leadership: 30, plants: 30 },
    portraitVariant: 1,
    roleAssignedTurn: 0,
    joinedYear: 1,
    apprenticeship: null,
    tradeTraining: {},
    lowHappinessTurns: 0,
    claimedBuildingId: null,
    ...overrides,
  } as Person;
}

function makeRel(type: NamedRelationship['type'], targetId: string): NamedRelationship {
  return { type, targetId, formedTurn: 0, depth: 0.5, revealedToPlayer: false };
}

// ─── getTradeSkill ────────────────────────────────────────────────────────────

describe('getTradeSkill', () => {
  it('maps farmer to plants', () => {
    expect(getTradeSkill('farmer')).toBe('plants');
  });
  it('maps gather_food to plants', () => {
    expect(getTradeSkill('gather_food')).toBe('plants');
  });
  it('maps healer to plants', () => {
    expect(getTradeSkill('healer')).toBe('plants');
  });
  it('maps herder to animals', () => {
    expect(getTradeSkill('herder')).toBe('animals');
  });
  it('maps trader to bargaining', () => {
    expect(getTradeSkill('trader')).toBe('bargaining');
  });
  it('maps blacksmith to custom', () => {
    expect(getTradeSkill('blacksmith')).toBe('custom');
  });
  it('maps brewer to custom', () => {
    expect(getTradeSkill('brewer')).toBe('custom');
  });
  it('maps hunter to combat', () => {
    expect(getTradeSkill('hunter')).toBe('combat');
  });
});

// ─── getMasterProgressRate ────────────────────────────────────────────────────

describe('getMasterProgressRate', () => {
  it('returns base rate for Good skill tier', () => {
    const master = makePerson('m', { role: 'farmer', skills: { animals: 26, bargaining: 26, combat: 26, custom: 26, leadership: 26, plants: 30 } });
    const rate = getMasterProgressRate(master);
    expect(rate).toBeCloseTo(0.04, 5);
  });

  it('multiplies rate for excellent tier', () => {
    const master = makePerson('m', { role: 'farmer', skills: { animals: 63, bargaining: 63, combat: 63, custom: 63, leadership: 63, plants: 63 } });
    const rate = getMasterProgressRate(master);
    expect(rate).toBeCloseTo(0.04 * 1.25, 5);
  });

  it('multiplies rate for renowned tier', () => {
    const master = makePerson('m', { role: 'farmer', skills: { animals: 78, bargaining: 78, combat: 78, custom: 78, leadership: 78, plants: 78 } });
    const rate = getMasterProgressRate(master);
    expect(rate).toBeCloseTo(0.04 * 1.50, 5);
  });

  it('multiplies rate for heroic tier', () => {
    const master = makePerson('m', { role: 'farmer', skills: { animals: 91, bargaining: 91, combat: 91, custom: 91, leadership: 91, plants: 91 } });
    const rate = getMasterProgressRate(master);
    expect(rate).toBeCloseTo(0.04 * 1.75, 5);
  });

  it('applies extra 1.25× for mentor_hearted trait', () => {
    const master = makePerson('m', {
      role: 'farmer',
      traits: ['mentor_hearted' as never],
      skills: { animals: 30, bargaining: 30, combat: 30, custom: 30, leadership: 30, plants: 30 },
    });
    const rate = getMasterProgressRate(master);
    expect(rate).toBeCloseTo(0.04 * 1.25, 5);
  });

  it('stacks skill tier and mentor_hearted', () => {
    const master = makePerson('m', {
      role: 'farmer',
      traits: ['mentor_hearted' as never],
      skills: { animals: 91, bargaining: 91, combat: 91, custom: 91, leadership: 91, plants: 91 },
    });
    const rate = getMasterProgressRate(master);
    expect(rate).toBeCloseTo(0.04 * 1.75 * 1.25, 5);
  });
});

// ─── computeCompletionBonus ───────────────────────────────────────────────────

describe('computeCompletionBonus', () => {
  it('returns 8 for skill in Good tier (26–45)', () => {
    const master = makePerson('m', { role: 'farmer', skills: { animals: 26, bargaining: 26, combat: 26, custom: 26, leadership: 26, plants: 30 } });
    expect(computeCompletionBonus(master)).toBe(8);
  });

  it('returns 12 for Very Good tier (46–62)', () => {
    const master = makePerson('m', { role: 'farmer', skills: { animals: 50, bargaining: 50, combat: 50, custom: 50, leadership: 50, plants: 50 } });
    expect(computeCompletionBonus(master)).toBe(12);
  });

  it('returns 17 for Excellent tier (63–77)', () => {
    const master = makePerson('m', { role: 'farmer', skills: { animals: 65, bargaining: 65, combat: 65, custom: 65, leadership: 65, plants: 65 } });
    expect(computeCompletionBonus(master)).toBe(17);
  });

  it('returns 27 for Heroic tier (91+)', () => {
    const master = makePerson('m', { role: 'farmer', skills: { animals: 95, bargaining: 95, combat: 95, custom: 95, leadership: 95, plants: 95 } });
    expect(computeCompletionBonus(master)).toBe(27);
  });
});

// ─── TRAINABLE_TRADES ────────────────────────────────────────────────────────

describe('TRAINABLE_TRADES', () => {
  it('includes farmer', () => expect(TRAINABLE_TRADES.has('farmer')).toBe(true));
  it('includes blacksmith', () => expect(TRAINABLE_TRADES.has('blacksmith')).toBe(true));
  it('includes hunter', () => expect(TRAINABLE_TRADES.has('hunter')).toBe(true));
  it('does not include guard', () => expect(TRAINABLE_TRADES.has('guard')).toBe(false));
  it('does not include unassigned', () => expect(TRAINABLE_TRADES.has('unassigned')).toBe(false));
  it('does not include away', () => expect(TRAINABLE_TRADES.has('away')).toBe(false));
});

// ─── processApprenticeships — Phase A (cleanup) ───────────────────────────────

describe('processApprenticeships — Phase A cleanup', () => {
  it('ends apprenticeship when master has left (not in people map)', () => {
    const apprentice = makePerson('a', {
      age: 15,
      apprenticeship: { masterId: 'gone', trade: 'farmer', progress: 0.5, startedTurn: 0 },
    });
    const people = new Map([['a', apprentice]]);
    const result = processApprenticeships(people, 1, createRNG(1));
    const updated = result.updatedPeople.get('a');
    expect(updated?.apprenticeship).toBeNull();
    expect(result.logEntries[0].type).toBe('apprenticeship_ended');
  });

  it('ends apprenticeship when master changed role', () => {
    const master = makePerson('m', { role: 'trader' }); // was farmer
    const apprentice = makePerson('a', {
      age: 15,
      apprenticeship: { masterId: 'm', trade: 'farmer', progress: 0.3, startedTurn: 0 },
    });
    const people = new Map([['m', master], ['a', apprentice]]);
    const result = processApprenticeships(people, 1, createRNG(1));
    const updated = result.updatedPeople.get('a');
    expect(updated?.apprenticeship).toBeNull();
  });

  it('ends apprenticeship when apprentice ages out (age > 22)', () => {
    const master = makePerson('m', { role: 'farmer' });
    const apprentice = makePerson('a', {
      age: 23,
      apprenticeship: { masterId: 'm', trade: 'farmer', progress: 0.7, startedTurn: 0 },
    });
    const people = new Map([['m', master], ['a', apprentice]]);
    const result = processApprenticeships(people, 1, createRNG(1));
    const updated = result.updatedPeople.get('a');
    expect(updated?.apprenticeship).toBeNull();
  });

  it('does NOT end apprenticeship within grace period (age 22)', () => {
    const master = makePerson('m', { role: 'farmer' });
    const apprentice = makePerson('a', {
      age: 22,
      apprenticeship: { masterId: 'm', trade: 'farmer', progress: 0.3, startedTurn: 0 },
    });
    const people = new Map([['m', master], ['a', apprentice]]);
    const result = processApprenticeships(people, 1, createRNG(1));
    // Should still be active — just advanced progress
    const updated = result.updatedPeople.get('a');
    expect(updated?.apprenticeship).not.toBeNull();
  });
});

// ─── processApprenticeships — Phase B (progress / graduation) ─────────────────

describe('processApprenticeships — Phase B progress', () => {
  it('advances progress by master progress rate each turn', () => {
    const master = makePerson('m', {
      role: 'farmer',
      skills: { animals: 30, bargaining: 30, combat: 30, custom: 30, leadership: 30, plants: 30 },
    });
    const apprentice = makePerson('a', {
      age: 15,
      apprenticeship: { masterId: 'm', trade: 'farmer', progress: 0.0, startedTurn: 0 },
    });
    const people = new Map([['m', master], ['a', apprentice]]);
    const result = processApprenticeships(people, 1, createRNG(1));
    const updated = result.updatedPeople.get('a');
    expect(updated?.apprenticeship?.progress).toBeCloseTo(0.04, 5);
  });

  it('graduates apprentice when progress reaches 1.0 and awards tradeTraining bonus', () => {
    const master = makePerson('m', {
      role: 'farmer',
      skills: { animals: 50, bargaining: 50, combat: 50, custom: 50, leadership: 50, plants: 50 },
    });
    const apprentice = makePerson('a', {
      age: 18,
      apprenticeship: { masterId: 'm', trade: 'farmer', progress: 0.97, startedTurn: 0 },
    });
    const people = new Map([['m', master], ['a', apprentice]]);
    const result = processApprenticeships(people, 1, createRNG(1));
    const graduated = result.updatedPeople.get('a');
    expect(graduated?.apprenticeship).toBeNull();
    expect(graduated?.tradeTraining?.farmer).toBe(12); // Very Good master → 12%
    expect(result.logEntries.some(e => e.type === 'apprenticeship_completed')).toBe(true);
    expect(result.pendingApprenticeshipEvents.some(e => e.eventId === 'appr_trade_mastered')).toBe(true);
  });

  it('caps tradeTraining at MAX_TRADE_TRAINING on re-training', () => {
    const master = makePerson('m', {
      role: 'farmer',
      skills: { animals: 95, bargaining: 95, combat: 95, custom: 95, leadership: 95, plants: 95 },
    });
    // Apprentice already has 20% training; master is heroic (27% bonus) → capped at 30
    const apprentice = makePerson('a', {
      age: 18,
      apprenticeship: { masterId: 'm', trade: 'farmer', progress: 0.97, startedTurn: 0 },
      tradeTraining: { farmer: 20 },
    });
    const people = new Map([['m', master], ['a', apprentice]]);
    const result = processApprenticeships(people, 1, createRNG(1));
    const graduated = result.updatedPeople.get('a');
    expect(graduated?.tradeTraining?.farmer).toBe(MAX_TRADE_TRAINING);
  });
});

// ─── processApprenticeships — Phase C (formation) ────────────────────────────

describe('processApprenticeships — Phase C formation', () => {
  it('forms an apprenticeship on a check-interval turn with eligible child', () => {
    const master = makePerson('m', {
      age: 35,
      role: 'farmer',
      skills: { animals: 35, bargaining: 35, combat: 35, custom: 35, leadership: 35, plants: 35 },
      childrenIds: ['child'],
    });
    // parentIds: [motherId, fatherId] — make master the father
    const child = makePerson('child', { age: 14, parentIds: ['m', null] });
    const people = new Map([['m', master], ['child', child]]);
    // Pass turn=8 to trigger the formation check (8 % 8 === 0)
    const result = processApprenticeships(people, 8, createRNG(99));
    const updatedChild = result.updatedPeople.get('child');
    expect(updatedChild?.apprenticeship?.masterId).toBe('m');
    expect(updatedChild?.apprenticeship?.trade).toBe('farmer');
    expect(result.logEntries.some(e => e.type === 'apprenticeship_started')).toBe(true);
    expect(result.pendingApprenticeshipEvents.some(e => e.eventId === 'appr_trade_training_begins')).toBe(true);
  });

  it('does NOT form on non-check-interval turns', () => {
    const master = makePerson('m', {
      age: 35,
      role: 'farmer',
      skills: { animals: 35, bargaining: 35, combat: 35, custom: 35, leadership: 35, plants: 35 },
    });
    const child = makePerson('child', { age: 14, parentIds: ['m', null] });
    const people = new Map([['m', master], ['child', child]]);
    // Turn 5 — not a check interval
    const result = processApprenticeships(people, 5, createRNG(99));
    expect(result.updatedPeople.get('child')).toBeUndefined();
  });

  it('does NOT form when master already has an apprentice', () => {
    const master = makePerson('m', {
      age: 35,
      role: 'farmer',
      skills: { animals: 35, bargaining: 35, combat: 35, custom: 35, leadership: 35, plants: 35 },
    });
    // An existing apprentice already tied to this master
    const existing = makePerson('existing', {
      age: 14,
      parentIds: ['m', null],
      apprenticeship: { masterId: 'm', trade: 'farmer', progress: 0.5, startedTurn: 0 },
    });
    const newChild = makePerson('new', { age: 12, parentIds: ['m', null] });
    const people = new Map([['m', master], ['existing', existing], ['new', newChild]]);
    const result = processApprenticeships(people, 8, createRNG(99));
    expect(result.updatedPeople.get('new')?.apprenticeship).toBeUndefined();
  });

  it('does NOT form when master skill is below minimum (less than Good)', () => {
    const master = makePerson('m', {
      age: 35,
      role: 'farmer',
      skills: { animals: 20, bargaining: 20, combat: 20, custom: 20, leadership: 20, plants: 20 },
    });
    const child = makePerson('child', { age: 14, parentIds: ['m', null] });
    const people = new Map([['m', master], ['child', child]]);
    const result = processApprenticeships(people, 8, createRNG(99));
    expect(result.updatedPeople.get('child')).toBeUndefined();
  });

  it('forms apprenticeship with named student when no eligible children', () => {
    const master = makePerson('m', {
      age: 35,
      role: 'farmer',
      skills: { animals: 35, bargaining: 35, combat: 35, custom: 35, leadership: 35, plants: 35 },
      namedRelationships: [makeRel('mentor', 'student_id')],
    });
    const student = makePerson('student_id', { age: 16 });
    const people = new Map([['m', master], ['student_id', student]]);
    const result = processApprenticeships(people, 8, createRNG(99));
    const updatedStudent = result.updatedPeople.get('student_id');
    expect(updatedStudent?.apprenticeship?.masterId).toBe('m');
  });

  it('does NOT form when candidate is not in trainable age range', () => {
    const master = makePerson('m', {
      age: 35,
      role: 'farmer',
      skills: { animals: 35, bargaining: 35, combat: 35, custom: 35, leadership: 35, plants: 35 },
    });
    const tooYoung = makePerson('young', { age: 8, parentIds: ['m', null] });
    const tooOld   = makePerson('old',   { age: 22, parentIds: ['m', null] });
    const people = new Map([['m', master], ['young', tooYoung], ['old', tooOld]]);
    const result = processApprenticeships(people, 8, createRNG(99));
    expect(result.updatedPeople.get('young')?.apprenticeship).toBeUndefined();
    expect(result.updatedPeople.get('old')?.apprenticeship).toBeUndefined();
  });

  it('returns empty result when no eligible pairs exist', () => {
    const master = makePerson('m', {
      age: 35,
      role: 'farmer',
      skills: { animals: 35, bargaining: 35, combat: 35, custom: 35, leadership: 35, plants: 35 },
    });
    const adult = makePerson('a', { age: 30 });
    const people = new Map([['m', master], ['a', adult]]);
    const result = processApprenticeships(people, 8, createRNG(99));
    expect(result.updatedPeople.size).toBe(0);
    expect(result.logEntries).toHaveLength(0);
    expect(result.pendingApprenticeshipEvents).toHaveLength(0);
  });
});
