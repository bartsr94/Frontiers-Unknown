/**
 * Tests for factions.ts
 *
 * Covers:
 *   - isEligibleMember: all 6 faction types
 *   - computeFactionStrength: formula, minimum-member guard
 *   - factionLabel: human-readable names for all 6 types
 *   - clearFactionDemand: removes activeDemand from correct faction
 *   - processFactions: formation, dissolution, demand generation
 */

import { describe, it, expect } from 'vitest';
import {
  isEligibleMember,
  computeFactionStrength,
  factionLabel,
  clearFactionDemand,
  processFactions,
} from '../../src/simulation/world/factions';
import type { Faction, FactionType, GameState } from '../../src/simulation/turn/game-state';
import type { Person } from '../../src/simulation/population/person';

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
      primaryCulture: 'ansberite',
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

function withOpinion(person: Person, targetId: string, value: number): Person {
  const rels = new Map(person.relationships);
  rels.set(targetId, value);
  return { ...person, relationships: rels };
}

/**
 * Minimal GameState stub — only the fields read by processFactions.
 * Cast via `as unknown as GameState` to avoid satisfying the full interface.
 */
function makeState(
  people: Map<string, Person>,
  overrides: {
    factions?: Faction[];
    culturalBlend?: number;
    companyStanding?: number;
    hiddenWheelEmerged?: boolean;
    religions?: Record<string, number>;
    buildings?: unknown[];
  } = {},
): GameState {
  return {
    people,
    factions: overrides.factions ?? [],
    culture: {
      culturalBlend: overrides.culturalBlend ?? 0.4,
      hiddenWheelEmerged: overrides.hiddenWheelEmerged ?? false,
      religions: overrides.religions ?? new Map([['imanian_orthodox', 1.0], ['sacred_wheel', 0], ['syncretic_hidden_wheel', 0]]),
    },
    company: {
      standing: overrides.companyStanding ?? 50,
    },
    settlement: {
      buildings: overrides.buildings ?? [],
    },
  } as unknown as GameState;
}

// ─── isEligibleMember ─────────────────────────────────────────────────────────

describe('isEligibleMember — cultural_preservationists', () => {
  it('qualifies a person with Sauromatian primary culture', () => {
    const person = makePerson('a', {
      heritage: {
        bloodline: [{ group: 'kiswani_bayuk', fraction: 1.0 }],
        primaryCulture: 'kiswani_traditional' as never, // Sauromatian id
        culturalFluency: new Map(),
      },
    });
    // kiswani_traditional is NOT in SAUROMATIAN_CULTURE_IDS; use a genuine one
    const sauroPerson = makePerson('b', {
      heritage: {
        bloodline: [{ group: 'kiswani_riverfolk', fraction: 1.0 }],
        primaryCulture: 'kiswani_riverfolk' as never,
        culturalFluency: new Map(),
      },
    });
    const state = makeState(new Map());
    // kiswani_riverfolk IS in SAUROMATIAN_CULTURE_IDS
    expect(isEligibleMember(sauroPerson, 'cultural_preservationists', state)).toBe(true);
    // imanian primary culture is NOT
    const imanianPerson = makePerson('c'); // default is 'imanian'
    expect(isEligibleMember(imanianPerson, 'cultural_preservationists', state)).toBe(false);
  });
});

describe('isEligibleMember — company_loyalists', () => {
  it('qualifies a person with Imanian bloodline ≥ 50%', () => {
    const person = makePerson('a', {
      heritage: {
        bloodline: [{ group: 'imanian', fraction: 0.75 }],
        primaryCulture: 'ansberite',
        culturalFluency: new Map(),
      },
    });
    const state = makeState(new Map());
    expect(isEligibleMember(person, 'company_loyalists', state)).toBe(true);
  });

  it('disqualifies person with Imanian bloodline < 50%', () => {
    const person = makePerson('a', {
      heritage: {
        bloodline: [{ group: 'imanian', fraction: 0.3 }, { group: 'kiswani_riverfolk', fraction: 0.7 }],
        primaryCulture: 'ansberite',
        culturalFluency: new Map(),
      },
    });
    const state = makeState(new Map());
    expect(isEligibleMember(person, 'company_loyalists', state)).toBe(false);
  });

  it('qualifies at exactly 50% Imanian bloodline', () => {
    const person = makePerson('a', {
      heritage: {
        bloodline: [{ group: 'imanian', fraction: 0.5 }, { group: 'kiswani_riverfolk', fraction: 0.5 }],
        primaryCulture: 'ansberite',
        culturalFluency: new Map(),
      },
    });
    const state = makeState(new Map());
    expect(isEligibleMember(person, 'company_loyalists', state)).toBe(true);
  });
});

describe('isEligibleMember — orthodox_faithful', () => {
  it('qualifies orthodox believers', () => {
    const person = makePerson('a', { religion: 'imanian_orthodox' });
    const state = makeState(new Map());
    expect(isEligibleMember(person, 'orthodox_faithful', state)).toBe(true);
  });

  it('disqualifies Wheel believers', () => {
    const person = makePerson('a', { religion: 'sacred_wheel' });
    const state = makeState(new Map());
    expect(isEligibleMember(person, 'orthodox_faithful', state)).toBe(false);
  });
});

describe('isEligibleMember — wheel_devotees', () => {
  it('qualifies sacred_wheel believers', () => {
    const person = makePerson('a', { religion: 'sacred_wheel' });
    const state = makeState(new Map());
    expect(isEligibleMember(person, 'wheel_devotees', state)).toBe(true);
  });

  it('qualifies syncretic_hidden_wheel believers', () => {
    const person = makePerson('a', { religion: 'syncretic_hidden_wheel' });
    const state = makeState(new Map());
    expect(isEligibleMember(person, 'wheel_devotees', state)).toBe(true);
  });

  it('disqualifies orthodox believers', () => {
    const person = makePerson('a', { religion: 'imanian_orthodox' });
    const state = makeState(new Map());
    expect(isEligibleMember(person, 'wheel_devotees', state)).toBe(false);
  });
});

describe('isEligibleMember — community_elders', () => {
  it('qualifies person with respected_elder trait', () => {
    const person = makePerson('a', { traits: ['respected_elder' as never] });
    const state = makeState(new Map());
    expect(isEligibleMember(person, 'community_elders', state)).toBe(true);
  });

  it('disqualifies person without respected_elder', () => {
    const person = makePerson('a', { traits: ['brave' as never] });
    const state = makeState(new Map());
    expect(isEligibleMember(person, 'community_elders', state)).toBe(false);
  });
});

describe('isEligibleMember — merchant_bloc', () => {
  it('qualifies trader role', () => {
    const person = makePerson('a', { role: 'trader' });
    const state = makeState(new Map());
    expect(isEligibleMember(person, 'merchant_bloc', state)).toBe(true);
  });

  it('qualifies craftsman role', () => {
    const person = makePerson('a', { role: 'craftsman' });
    const state = makeState(new Map());
    expect(isEligibleMember(person, 'merchant_bloc', state)).toBe(true);
  });

  it('disqualifies other roles', () => {
    const person = makePerson('a', { role: 'farmer' });
    const state = makeState(new Map());
    expect(isEligibleMember(person, 'merchant_bloc', state)).toBe(false);
  });
});

// ─── computeFactionStrength ───────────────────────────────────────────────────

describe('computeFactionStrength', () => {
  it('returns 0 for fewer than 2 members', () => {
    const faction: Faction = { id: 'f1', type: 'community_elders', memberIds: ['a'], strength: 0, formedTurn: 0 };
    const a = makePerson('a');
    const people = new Map([['a', a]]);
    expect(computeFactionStrength(faction, people, 10)).toBe(0);
  });

  it('returns 0 for empty member list', () => {
    const faction: Faction = { id: 'f1', type: 'community_elders', memberIds: [], strength: 0, formedTurn: 0 };
    const people = new Map<string, Person>();
    expect(computeFactionStrength(faction, people, 10)).toBe(0);
  });

  it('computes strength from size fraction and opinion coherence', () => {
    // 3 members, total pop = 6 (50% size fraction)
    // opinions between members: a→b 80, a→c 60, b→c 40 → avg = (80+60+40)/3 = 60/100 = 0.6 coherence
    // strength = 0.5 × (0.5 + 0.6 × 0.5) = 0.5 × 0.8 = 0.4
    let a = makePerson('a');
    let b = makePerson('b');
    let c = makePerson('c');
    a = withOpinion(a, 'b', 80);
    a = withOpinion(a, 'c', 60);
    b = withOpinion(b, 'c', 40);
    const faction: Faction = { id: 'f1', type: 'community_elders', memberIds: ['a', 'b', 'c'], strength: 0, formedTurn: 0 };
    const people = new Map([['a', a], ['b', b], ['c', c]]);
    const strength = computeFactionStrength(faction, people, 6);
    expect(strength).toBeCloseTo(0.4);
  });

  it('clamps strength when all opinions are 100', () => {
    let a = makePerson('a');
    let b = makePerson('b');
    let c = makePerson('c');
    a = withOpinion(a, 'b', 100);
    a = withOpinion(a, 'c', 100);
    b = withOpinion(b, 'c', 100);
    const faction: Faction = { id: 'f1', type: 'community_elders', memberIds: ['a', 'b', 'c'], strength: 0, formedTurn: 0 };
    const people = new Map([['a', a], ['b', b], ['c', c]]);
    const strength = computeFactionStrength(faction, people, 3); // 100% size fraction
    expect(strength).toBeCloseTo(1.0);
  });
});

// ─── factionLabel ─────────────────────────────────────────────────────────────

describe('factionLabel', () => {
  const types: FactionType[] = [
    'cultural_preservationists',
    'company_loyalists',
    'orthodox_faithful',
    'wheel_devotees',
    'community_elders',
    'merchant_bloc',
  ];

  it.each(types)('returns a non-empty string for %s', (type) => {
    expect(factionLabel(type)).toBeTruthy();
    expect(typeof factionLabel(type)).toBe('string');
  });

  it('returns distinct labels for all types', () => {
    const labels = types.map(t => factionLabel(t));
    const unique = new Set(labels);
    expect(unique.size).toBe(types.length);
  });
});

// ─── clearFactionDemand ───────────────────────────────────────────────────────

describe('clearFactionDemand', () => {
  it('removes activeDemand from the target faction', () => {
    const demand = { type: 'policy_change' as const, description: 'text', params: {} };
    const factions: Faction[] = [
      { id: 'f1', type: 'community_elders', memberIds: ['a'], strength: 0.5, formedTurn: 0, activeDemand: demand },
      { id: 'f2', type: 'merchant_bloc',    memberIds: ['b'], strength: 0.3, formedTurn: 0 },
    ];
    const result = clearFactionDemand(factions, 'f1');
    expect(result.find(f => f.id === 'f1')!.activeDemand).toBeUndefined();
    expect(result.find(f => f.id === 'f2')!.activeDemand).toBeUndefined();
  });

  it('does not modify other factions', () => {
    const demand = { type: 'resource_grant' as const, description: 'text', params: { amount: 5 } };
    const factions: Faction[] = [
      { id: 'f1', type: 'community_elders', memberIds: [], strength: 0.5, formedTurn: 0, activeDemand: demand },
      { id: 'f2', type: 'merchant_bloc',    memberIds: [], strength: 0.3, formedTurn: 0, activeDemand: demand },
    ];
    const result = clearFactionDemand(factions, 'f1');
    // f2's demand should be unchanged
    expect(result.find(f => f.id === 'f2')!.activeDemand).toBeDefined();
  });
});

// ─── processFactions ─────────────────────────────────────────────────────────

describe('processFactions — faction formation', () => {
  it('forms merchant_bloc when ≥3 traders/craftsmen with a trading_post', () => {
    const a = makePerson('a', { role: 'trader' });
    const b = makePerson('b', { role: 'craftsman' });
    const c = makePerson('c', { role: 'trader' });
    const people = new Map([['a', a], ['b', b], ['c', c]]);

    const state = makeState(people, {
      buildings: [{ defId: 'trading_post', instanceId: 'tp_0', builtTurn: 0, style: null }],
    });

    const result = processFactions(state, 1);
    const formed = result.updatedFactions.find(f => f.type === 'merchant_bloc');
    expect(formed).toBeDefined();
    expect(formed!.memberIds).toHaveLength(3);
    expect(result.logEntries.some(e => e.type === 'faction_formed')).toBe(true);
  });

  it('does not form merchant_bloc without a trading_post', () => {
    const a = makePerson('a', { role: 'trader' });
    const b = makePerson('b', { role: 'craftsman' });
    const c = makePerson('c', { role: 'trader' });
    const people = new Map([['a', a], ['b', b], ['c', c]]);

    const state = makeState(people); // no buildings
    const result = processFactions(state, 1);
    expect(result.updatedFactions.find(f => f.type === 'merchant_bloc')).toBeUndefined();
  });

  it('does not form faction when fewer than 3 eligible members', () => {
    const a = makePerson('a', { role: 'trader' });
    const b = makePerson('b', { role: 'trader' });
    const people = new Map([['a', a], ['b', b]]);

    const state = makeState(people, {
      buildings: [{ defId: 'trading_post', instanceId: 'tp_0', builtTurn: 0, style: null }],
    });

    const result = processFactions(state, 1);
    expect(result.updatedFactions.find(f => f.type === 'merchant_bloc')).toBeUndefined();
  });

  it('forms community_elders when ≥3 respected_elder people exist', () => {
    const a = makePerson('a', { traits: ['respected_elder' as never] });
    const b = makePerson('b', { traits: ['respected_elder' as never] });
    const c = makePerson('c', { traits: ['respected_elder' as never] });
    const people = new Map([['a', a], ['b', b], ['c', c]]);

    const state = makeState(people);
    const result = processFactions(state, 1);
    const formed = result.updatedFactions.find(f => f.type === 'community_elders');
    expect(formed).toBeDefined();
  });
});

describe('processFactions — faction dissolution', () => {
  it('dissolves an existing faction when active members drop below 2', () => {
    const existingFaction: Faction = {
      id: 'faction_merchant_bloc_1',
      type: 'merchant_bloc',
      memberIds: ['a', 'b', 'c'],
      strength: 0.5,
      formedTurn: 1,
    };
    // Only 1 trader still in the settlement
    const a = makePerson('a', { role: 'trader' });
    const people = new Map([['a', a]]); // b and c are gone

    const state = makeState(people, {
      factions: [existingFaction],
      buildings: [{ defId: 'trading_post', instanceId: 'tp_0', builtTurn: 0, style: null }],
    });

    const result = processFactions(state, 10);
    expect(result.updatedFactions.find(f => f.type === 'merchant_bloc')).toBeUndefined();
    expect(result.logEntries.some(e => e.type === 'faction_dissolved')).toBe(true);
  });
});

describe('processFactions — demand generation', () => {
  it('generates a demand when faction strength exceeds 0.45', () => {
    // 3 traders/craftsmen, total pop = 3 (100% fraction, high coherence = high strength)
    let a = makePerson('a', { role: 'trader' });
    let b = makePerson('b', { role: 'craftsman' });
    let c = makePerson('c', { role: 'trader' });
    // Mutual high opinions → coherence ≈ 1.0
    a = withOpinion(a, 'b', 90); a = withOpinion(a, 'c', 90);
    b = withOpinion(b, 'c', 90);
    const people = new Map([['a', a], ['b', b], ['c', c]]);

    const existingFaction: Faction = {
      id: 'faction_merchant_bloc_1',
      type: 'merchant_bloc',
      memberIds: ['a', 'b', 'c'],
      strength: 0.95, // already strong
      formedTurn: 1,
      // no activeDemand, no demandFiredTurn
    };

    const state = makeState(people, {
      factions: [existingFaction],
      buildings: [{ defId: 'trading_post', instanceId: 'tp_0', builtTurn: 0, style: null }],
    });

    const result = processFactions(state, 25);
    const updated = result.updatedFactions.find(f => f.type === 'merchant_bloc');
    expect(updated).toBeDefined();
    expect(updated!.activeDemand).toBeDefined();
    expect(result.pendingFactionEvents.some(e => e.eventId === 'fac_faction_demands')).toBe(true);
  });

  it('does not fire a second demand within the cooldown period', () => {
    let a = makePerson('a', { role: 'trader' });
    let b = makePerson('b', { role: 'craftsman' });
    let c = makePerson('c', { role: 'trader' });
    a = withOpinion(a, 'b', 90); a = withOpinion(a, 'c', 90);
    b = withOpinion(b, 'c', 90);
    const people = new Map([['a', a], ['b', b], ['c', c]]);

    const demand = { type: 'resource_grant' as const, description: 'We need gold.', params: { resource: 'gold', amount: 10 } };
    const existingFaction: Faction = {
      id: 'faction_merchant_bloc_1',
      type: 'merchant_bloc',
      memberIds: ['a', 'b', 'c'],
      strength: 0.95,
      formedTurn: 1,
      activeDemand: demand,  // already has a demand
      demandFiredTurn: 25,
    };

    const state = makeState(people, {
      factions: [existingFaction],
      buildings: [{ defId: 'trading_post', instanceId: 'tp_0', builtTurn: 0, style: null }],
    });

    const result = processFactions(state, 30); // only 5 turns since last demand (need 20)
    expect(result.pendingFactionEvents.some(e => e.eventId === 'fac_faction_demands')).toBe(false);
  });
});

describe('processFactions — returns empty result with no eligible people', () => {
  it('returns no factions when settlement has no eligible members', () => {
    const a = makePerson('a'); // imanian, unassigned, no traits — no faction qualifications, but company_loyalists could match
    const people = new Map([['a', a]]);
    const state = makeState(people);
    const result = processFactions(state, 1);
    // company_loyalists needs standing > 70 AND ≥3 members; neither condition met
    expect(result.updatedFactions).toHaveLength(0);
    expect(result.logEntries).toHaveLength(0);
    expect(result.pendingFactionEvents).toHaveLength(0);
  });
});
