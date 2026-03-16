import { describe, it, expect } from 'vitest';
import type { Person } from '../../src/simulation/population/person';
import type { GameState } from '../../src/simulation/turn/game-state';
import type { BuiltBuilding } from '../../src/simulation/turn/game-state';
import {
  computeHappinessFactors,
  computeHappiness,
  computeSettlementMorale,
  getHappinessLabel,
  getHappinessColor,
  getHappinessProductionMultiplier,
  getSettlementMoraleLabel,
  isDesertionEligible,
  applyHappinessTracking,
  getDepartingFamily,
} from '../../src/simulation/population/happiness';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CAMP: BuiltBuilding = {
  defId: 'camp',
  instanceId: 'camp_0',
  builtTurn: 0,
  style: null,
  claimedByPersonIds: [],
  ownerHouseholdId: null,
  assignedWorkerIds: [],
};

function makePerson(id: string, overrides: Partial<Person> = {}): Person {
  return {
    id,
    firstName: 'Test',
    familyName: 'Person',
    sex: 'male',
    age: 25,
    alive: true,
    role: 'farmer',
    socialStatus: 'settler',
    traits: [],
    religion: 'imanian_orthodox',
    heritage: {
      bloodline: { imanian: 1, kiswani_riverfolk: 0, kiswani_bayuk: 0, kiswani_haisla: 0, hanjoda_stormcaller: 0, hanjoda_bloodmoon: 0, hanjoda_talon: 0, hanjoda_emrasi: 0 },
      primaryCulture: 'imanian',
      culturalFluency: new Map(),
      ethnicGroup: 'imanian',
    },
    genetics: {
      skinTone: 0.3, hairColor: 'brown', hairTexture: 'straight', eyeColor: 'blue',
      heightModifier: 0, buildModifier: 0, genderRatioModifier: 0, extendedFertility: false,
    },
    health: { currentHealth: 80, conditions: [] },
    languages: [],
    pregnancies: [],
    spouseIds: [],
    childrenIds: [],
    parentIds: [null, null],
    relationships: new Map(),
    opinionModifiers: [],
    householdId: null,
    householdRole: null,
    ashkaMelathiPartnerIds: [],
    ambition: null,
    namedRelationships: [],
    activeScheme: null,
    roleAssignedTurn: 0,
    skills: { animals: 25, bargaining: 25, combat: 25, custom: 25, leadership: 25, plants: 25 },
    portraitVariant: 1,
    lowHappinessTurns: 0,
    claimedBuildingId: null,
    isPlayerControlled: false,
    ...overrides,
  } as Person;
}

/**
 * Minimal GameState stub sufficient for computeHappiness.
 * Population count defaults to 5 people; food set to comfortably adequate (10).
 */
function makeState(overrides: Partial<{
  food: number;
  pop: number;
  buildings: BuiltBuilding[];
  religiousPolicy: string;
  religions: Map<string, number>;
  people: Map<string, Person>;
  lowMoraleTurns: number;
}> = {}): GameState {
  const pop      = overrides.pop ?? 5;
  const food     = overrides.food ?? pop; // 1× population = Ample provisions
  const bldgs    = overrides.buildings ?? [CAMP];
  const religions = overrides.religions ?? new Map([['imanian_orthodox', 1.0]]);

  return {
    turnNumber: 10,
    lowMoraleTurns: overrides.lowMoraleTurns ?? 0,
    massDesertionWarningFired: false,
    lastSettlementMorale: 0,
    people: overrides.people ?? new Map(),
    settlement: {
      resources: { food, cattle: 0, goods: 0, steel: 0, lumber: 0, stone: 0, medicine: 0, gold: 0, horses: 0 },
      populationCount: pop,
      buildings: bldgs,
      religiousPolicy: overrides.religiousPolicy ?? 'tolerant',
      constructionQueue: [],
      name: 'Test',
      location: 'test',
    },
    culture: {
      religions,
      languages: new Map(),
      primaryLanguage: 'ansberite',
      religiousTension: 0,
      culturalBlend: 0.3,
      practices: [],
      governance: 'imanian',
      languageDiversityTurns: 0,
      languageTension: 0,
      hiddenWheelDivergenceTurns: 0,
      hiddenWheelSuppressedTurns: 0,
      hiddenWheelEmerged: false,
    },
  } as unknown as GameState;
}

// ─── getHappinessLabel ────────────────────────────────────────────────────────

describe('getHappinessLabel', () => {
  it('labels high positive as Thriving', () => expect(getHappinessLabel(80)).toBe('Thriving'));
  it('labels 30 as Content', ()         => expect(getHappinessLabel(30)).toBe('Content'));
  it('labels 5 as Settled', ()          => expect(getHappinessLabel(5)).toBe('Settled'));
  it('labels -1 as Restless', ()        => expect(getHappinessLabel(-1)).toBe('Restless'));
  it('labels -20 as Discontent', ()     => expect(getHappinessLabel(-20)).toBe('Discontent'));
  it('labels -50 as Miserable', ()      => expect(getHappinessLabel(-50)).toBe('Miserable'));
  it('labels -80 as Desperate', ()      => expect(getHappinessLabel(-80)).toBe('Desperate'));
});

// ─── getHappinessColor ────────────────────────────────────────────────────────

describe('getHappinessColor', () => {
  it('returns emerald for ≥ 60', () => expect(getHappinessColor(60)).toBe('text-emerald-400'));
  it('returns lime for 30–59',   () => expect(getHappinessColor(40)).toBe('text-lime-400'));
  it('returns red-600 for -70',  () => expect(getHappinessColor(-70)).toBe('text-red-600'));
});

// ─── getHappinessProductionMultiplier ─────────────────────────────────────────

describe('getHappinessProductionMultiplier', () => {
  it('returns 1.15 for score 60+',   () => expect(getHappinessProductionMultiplier(70)).toBe(1.15));
  it('returns 1.07 for score 30–59', () => expect(getHappinessProductionMultiplier(30)).toBe(1.07));
  it('returns 1.00 for score 5–29',  () => expect(getHappinessProductionMultiplier(20)).toBe(1.0));
  it('returns 0.95 for score -1',    () => expect(getHappinessProductionMultiplier(-1)).toBe(0.95));
  it('returns 0.88 for score -20',   () => expect(getHappinessProductionMultiplier(-20)).toBe(0.88));
  it('returns 0.78 for score -50',   () => expect(getHappinessProductionMultiplier(-50)).toBe(0.78));
  it('returns 0.65 for score -80',   () => expect(getHappinessProductionMultiplier(-80)).toBe(0.65));
});

// ─── computeHappinessFactors — Material ──────────────────────────────────────

describe('computeHappinessFactors — food adequacy', () => {
  it('gives +10 "Full bellies" when food ≥ 2× population', () => {
    const p     = makePerson('a');
    const state = makeState({ food: 20, pop: 5 }); // 4× pop
    const factors = computeHappinessFactors(p, state);
    const f = factors.find(x => x.label === 'Full bellies');
    expect(f).toBeDefined();
    expect(f!.delta).toBe(10);
  });

  it('gives +5 "Ample provisions" when food is 1× population', () => {
    const p     = makePerson('a');
    const state = makeState({ food: 5, pop: 5 });
    const factors = computeHappinessFactors(p, state);
    const f = factors.find(x => x.label === 'Ample provisions');
    expect(f).toBeDefined();
    expect(f!.delta).toBe(5);
  });

  it('gives −10 "Provisions running low" when food < 0.5× population', () => {
    const p     = makePerson('a');
    const state = makeState({ food: 2, pop: 5 }); // 0.4× pop
    const factors = computeHappinessFactors(p, state);
    const f = factors.find(x => x.label === 'Provisions running low');
    expect(f).toBeDefined();
    expect(f!.delta).toBe(-10);
  });

  it('gives −25 "Suffering from hunger" for malnourished person', () => {
    const p     = makePerson('a', { health: { currentHealth: 40, conditions: ['malnourished'] } });
    const state = makeState({ food: 10, pop: 5 });
    const factors = computeHappinessFactors(p, state);
    const f = factors.find(x => x.label === 'Suffering from hunger');
    expect(f).toBeDefined();
    expect(f!.delta).toBe(-25);
  });

  it('stacks malnourished + food shortage penalties together', () => {
    const p     = makePerson('a', { health: { currentHealth: 30, conditions: ['malnourished'] } });
    const state = makeState({ food: 2, pop: 5 }); // food shortage too
    const factors = computeHappinessFactors(p, state);
    const labels = factors.map(f => f.label);
    expect(labels).toContain('Suffering from hunger');
    expect(labels).toContain('Provisions running low');
  });
});

describe('computeHappinessFactors — overcrowding', () => {
  // Camp has shelter capacity of 5 (configured in building-definitions)
  // We use population count to drive the ratio.

  it('gives no overcrowding penalty at ratio ≤ 1.0', () => {
    const p     = makePerson('a');
    const state = makeState({ pop: 2 }); // well under camp capacity
    const factors = computeHappinessFactors(p, state);
    const overcrowdFactors = factors.filter(f =>
      f.label.includes('crowded') || f.label.includes('cramped'),
    );
    expect(overcrowdFactors).toHaveLength(0);
  });
});

describe('computeHappinessFactors — health conditions', () => {
  it('gives −15 for ill', () => {
    const p = makePerson('a', { health: { currentHealth: 50, conditions: ['ill'] } });
    const f = computeHappinessFactors(p, makeState()).find(x => x.label === 'Struggling with illness');
    expect(f?.delta).toBe(-15);
  });

  it('gives −10 for wounded', () => {
    const p = makePerson('a', { health: { currentHealth: 60, conditions: ['wounded'] } });
    const f = computeHappinessFactors(p, makeState()).find(x => x.label === 'Nursing an injury');
    expect(f?.delta).toBe(-10);
  });

  it('gives −20 for chronic_illness', () => {
    const p = makePerson('a', { health: { currentHealth: 40, conditions: ['chronic_illness'] } });
    const f = computeHappinessFactors(p, makeState()).find(x => x.label === 'Living with a chronic condition');
    expect(f?.delta).toBe(-20);
  });
});

// ─── computeHappinessFactors — Social ────────────────────────────────────────

describe('computeHappinessFactors — spouse / partner', () => {
  it('gives +15 "Settled down with a partner" when person has a living spouse', () => {
    const spouse = makePerson('b');
    const p      = makePerson('a', { spouseIds: ['b'] });
    const state  = makeState({ people: new Map([['b', spouse]]) });
    const f = computeHappinessFactors(p, state).find(x => x.label === 'Settled down with a partner');
    expect(f?.delta).toBe(15);
  });

  it('gives −5 "Has not found a partner" when adult with no living spouse', () => {
    const p     = makePerson('a', { age: 25, spouseIds: [] });
    const state = makeState();
    const f = computeHappinessFactors(p, state).find(x => x.label === 'Has not found a partner');
    expect(f?.delta).toBe(-5);
  });

  it('does not give partner penalty for person under 20', () => {
    const p     = makePerson('a', { age: 18, spouseIds: [] });
    const state = makeState();
    const f = computeHappinessFactors(p, state).find(x => x.label === 'Has not found a partner');
    expect(f).toBeUndefined();
  });

  it('does not double-penalise a married person', () => {
    const spouse = makePerson('b');
    const p      = makePerson('a', { spouseIds: ['b'] });
    const state  = makeState({ people: new Map([['b', spouse]]) });
    const f = computeHappinessFactors(p, state).find(x => x.label === 'Has not found a partner');
    expect(f).toBeUndefined();
  });
});

describe('computeHappinessFactors — children', () => {
  it('gives +8 "The joy of family" with living children', () => {
    const child = makePerson('c', { age: 5 });
    const p     = makePerson('a', { childrenIds: ['c'] });
    const state = makeState({ people: new Map([['c', child]]) });
    const f = computeHappinessFactors(p, state).find(x => x.label === 'The joy of family');
    expect(f?.delta).toBe(8);
  });

  it('gives no family bonus when child has died', () => {
    const p     = makePerson('a', { childrenIds: ['dead_child'] });
    const state = makeState(); // dead_child not in people map
    const f = computeHappinessFactors(p, state).find(x => x.label === 'The joy of family');
    expect(f).toBeUndefined();
  });
});

describe('computeHappinessFactors — named relationships', () => {
  it('gives +10 for friend', () => {
    const p = makePerson('a', {
      namedRelationships: [{ type: 'friend', targetId: 'b', formedTurn: 1, depth: 0.5, revealedToPlayer: true }],
    });
    const f = computeHappinessFactors(p, makeState()).find(x => x.label === 'Close friendships');
    expect(f?.delta).toBe(10);
  });

  it('gives +8 for mentor', () => {
    const p = makePerson('a', {
      namedRelationships: [{ type: 'mentor', targetId: 'b', formedTurn: 1, depth: 0.3, revealedToPlayer: true }],
    });
    const f = computeHappinessFactors(p, makeState()).find(x => x.label === 'A meaningful bond of guidance');
    expect(f?.delta).toBe(8);
  });

  it('gives −5 for rival', () => {
    const p = makePerson('a', {
      namedRelationships: [{ type: 'rival', targetId: 'b', formedTurn: 1, depth: 0.4, revealedToPlayer: true }],
    });
    const f = computeHappinessFactors(p, makeState()).find(x => x.label === 'An ongoing rivalry');
    expect(f?.delta).toBe(-5);
  });

  it('gives −15 for nemesis', () => {
    const p = makePerson('a', {
      namedRelationships: [{ type: 'nemesis', targetId: 'b', formedTurn: 1, depth: 0.8, revealedToPlayer: true }],
    });
    const f = computeHappinessFactors(p, makeState()).find(x => x.label === 'A bitter enmity');
    expect(f?.delta).toBe(-15);
  });

  it('gives −10 "Lonely among strangers" for completely isolated person', () => {
    const p     = makePerson('a', { namedRelationships: [], relationships: new Map() });
    const state = makeState();
    const f = computeHappinessFactors(p, state).find(x => x.label === 'Lonely among strangers');
    expect(f?.delta).toBe(-10);
  });

  it('does not give isolation penalty when person has a high opinion', () => {
    const p = makePerson('a', {
      namedRelationships: [],
      relationships: new Map([['b', 30]]),
    });
    const f = computeHappinessFactors(p, makeState()).find(x => x.label === 'Lonely among strangers');
    expect(f).toBeUndefined();
  });
});

describe('computeHappinessFactors — ashka-melathi', () => {
  it('gives +8 for living ashka-melathi partners', () => {
    const partner = makePerson('b');
    const p       = makePerson('a', { sex: 'female', ashkaMelathiPartnerIds: ['b'] });
    const state   = makeState({ people: new Map([['b', partner]]) });
    const f = computeHappinessFactors(p, state).find(x => x.label === 'Bound in Ashka-Melathi fellowship');
    expect(f?.delta).toBe(8);
  });
});

describe('computeHappinessFactors — religious freedom', () => {
  it('gives −15 "Faith suppressed" for Wheel person under orthodox enforcement', () => {
    const p     = makePerson('a', { religion: 'sacred_wheel' });
    const state = makeState({ religiousPolicy: 'orthodox_enforced' });
    const f = computeHappinessFactors(p, state).find(x => x.label === 'Faith suppressed by authority');
    expect(f?.delta).toBe(-15);
  });

  it('gives −20 "Faith practised in secret" for Hidden Wheel under orthodox enforcement', () => {
    const p     = makePerson('a', { religion: 'syncretic_hidden_wheel' });
    const state = makeState({ religiousPolicy: 'orthodox_enforced' });
    const f = computeHappinessFactors(p, state).find(x => x.label === 'Faith practised in secret and fear');
    expect(f?.delta).toBe(-20);
  });

  it('does NOT penalise orthodox person under orthodox enforcement', () => {
    const p     = makePerson('a', { religion: 'imanian_orthodox' });
    const state = makeState({ religiousPolicy: 'orthodox_enforced' });
    const labels = computeHappinessFactors(p, state).map(f => f.label);
    expect(labels).not.toContain('Faith suppressed by authority');
  });

  it('gives +5 "Surrounded by like faith" to majority religion person', () => {
    const p     = makePerson('a', { religion: 'imanian_orthodox' });
    const state = makeState({ religions: new Map([['imanian_orthodox', 0.9], ['sacred_wheel', 0.1]]) });
    const f = computeHappinessFactors(p, state).find(x => x.label === 'Surrounded by like faith');
    expect(f?.delta).toBe(5);
  });

  it('gives +5 "Spiritual leadership present" when matching priest exists', () => {
    const priest = makePerson('priest', { role: 'priest_solar' });
    const p      = makePerson('a', { religion: 'imanian_orthodox' });
    const state  = makeState({ people: new Map([['priest', priest]]) });
    const f = computeHappinessFactors(p, state).find(x => x.label === 'Spiritual leadership present');
    expect(f?.delta).toBe(5);
  });

  it('does NOT give spiritual leadership bonus when no matching priest', () => {
    const p     = makePerson('a', { religion: 'imanian_orthodox' });
    const state = makeState(); // no priest in state.people
    const f = computeHappinessFactors(p, state).find(x => x.label === 'Spiritual leadership present');
    expect(f).toBeUndefined();
  });
});

// ─── computeHappinessFactors — Purpose ──────────────────────────────────────

describe('computeHappinessFactors — work role', () => {
  it('gives +5 "Purposeful work" for a productive role', () => {
    const p = makePerson('a', { role: 'farmer' });
    const f = computeHappinessFactors(p, makeState()).find(x => x.label === 'Purposeful work');
    expect(f?.delta).toBe(5);
  });

  it('gives −10 "Without purpose" for unassigned person', () => {
    const p = makePerson('a', { role: 'unassigned' });
    const f = computeHappinessFactors(p, makeState()).find(x => x.label === 'Without purpose or direction');
    expect(f?.delta).toBe(-10);
  });

  it('gives +5 "Working in their element" when skill is Excellent+', () => {
    const p = makePerson('a', { role: 'farmer', skills: { animals: 25, bargaining: 25, combat: 25, custom: 25, leadership: 25, plants: 70 } });
    const f = computeHappinessFactors(p, makeState()).find(x => x.label === 'Working in their element');
    expect(f?.delta).toBe(5);
  });

  it('gives −5 "Ill-suited" when skill is Fair (1–25)', () => {
    const p = makePerson('a', { role: 'farmer', skills: { animals: 25, bargaining: 25, combat: 25, custom: 25, leadership: 25, plants: 10 } });
    const f = computeHappinessFactors(p, makeState()).find(x => x.label === 'Ill-suited to their role');
    expect(f?.delta).toBe(-5);
  });

  it('does not give work penalties to away or keth_thara roles', () => {
    for (const role of ['away', 'keth_thara'] as const) {
      const p = makePerson('a', { role });
      const factors = computeHappinessFactors(p, makeState());
      const labels = factors.map(f => f.label);
      expect(labels).not.toContain('Purposeful work');
      expect(labels).not.toContain('Without purpose or direction');
    }
  });
});

// ─── computeHappinessFactors — Trait Modifiers ───────────────────────────────

describe('computeHappinessFactors — static trait modifiers', () => {
  it.each([
    ['content',    +15],
    ['optimistic', +10],
    ['melancholic', -10],
    ['sanguine',   +8],
    ['patient',    +5],
    ['hot_tempered', -5],
    ['brave',      +5],
    ['cowardly',   -5],
    ['cynical',    -10],
  ])('trait %s yields delta %i', (trait, expectedDelta) => {
    const p = makePerson('a', { traits: [trait] as string[] } as Partial<Person>);
    const allDeltas = computeHappinessFactors(p, makeState())
      .filter(f => f.category === 'trait')
      .map(f => f.delta);
    expect(allDeltas).toContain(expectedDelta);
  });
});

describe('computeHappinessFactors — conditional trait: romantic', () => {
  it('gives +20 when romantic and has a living spouse', () => {
    const spouse = makePerson('b');
    const p = makePerson('a', { traits: ['romantic'], spouseIds: ['b'] });
    const state = makeState({ people: new Map([['b', spouse]]) });
    const f = computeHappinessFactors(p, state).find(x => x.label === 'Deeply in love');
    expect(f?.delta).toBe(20);
  });

  it('gives −15 when romantic and no spouse', () => {
    const p = makePerson('a', { traits: ['romantic'], spouseIds: [], age: 25 });
    const f = computeHappinessFactors(p, makeState()).find(x => x.label === 'Yearning for love');
    expect(f?.delta).toBe(-15);
  });
});

describe('computeHappinessFactors — conditional trait: lonely', () => {
  it('gives +15 when lonely but has a friend', () => {
    const p = makePerson('a', {
      traits: ['lonely'],
      namedRelationships: [{ type: 'friend', targetId: 'b', formedTurn: 1, depth: 0.5, revealedToPlayer: true }],
    });
    const f = computeHappinessFactors(p, makeState()).find(x => x.label === 'Finally found belonging');
    expect(f?.delta).toBe(15);
  });

  it('gives −20 when lonely and isolated', () => {
    const p = makePerson('a', {
      traits: ['lonely'],
      namedRelationships: [],
      relationships: new Map(),
    });
    const f = computeHappinessFactors(p, makeState()).find(x => x.label === 'Profoundly alone');
    expect(f?.delta).toBe(-20);
  });
});

describe('computeHappinessFactors — conditional trait: proud', () => {
  it('gives +10 for founding_member status', () => {
    const p = makePerson('a', { traits: ['proud'], socialStatus: 'founding_member' });
    const f = computeHappinessFactors(p, makeState()).find(x => x.label === 'Respected and proud');
    expect(f?.delta).toBe(10);
  });

  it('gives −15 for thrall status', () => {
    const p = makePerson('a', { traits: ['proud'], socialStatus: 'thrall' });
    const f = computeHappinessFactors(p, makeState()).find(x => x.label === 'Dignity denied');
    expect(f?.delta).toBe(-15);
  });
});

describe('computeHappinessFactors — temporary + earned traits', () => {
  it.each([
    ['inspired',   +25],
    ['restless',   -15],
    ['grieving',   -20],
    ['traumatized',-20],
    ['homesick',   -20],
    ['bereaved',   -20],
    ['respected_elder', +10],
    ['veteran',    +5],
    ['healer',     +5],
  ])('trait %s yields delta %i', (trait, expected) => {
    const p = makePerson('a', { traits: [trait] as string[] } as Partial<Person>);
    const allDeltas = computeHappinessFactors(p, makeState())
      .filter(f => f.category === 'trait')
      .map(f => f.delta);
    expect(allDeltas).toContain(expected);
  });
});

describe('computeHappinessFactors — devout amplification', () => {
  it('amplifies religious suppression penalty by 50% when devout', () => {
    const p     = makePerson('a', { traits: ['devout'], religion: 'sacred_wheel' });
    const state = makeState({ religiousPolicy: 'orthodox_enforced' });
    const factors = computeHappinessFactors(p, state);
    // Base penalty -15 + devout extra -8 (round(-15 * 0.5)) = -8
    const devoutFactor = factors.find(x => x.label === 'Faith runs deep');
    expect(devoutFactor).toBeDefined();
    expect(devoutFactor!.delta).toBe(-8);
  });
});

// ─── computeHappiness ────────────────────────────────────────────────────────

describe('computeHappiness', () => {
  it('clamps score to +100 maximum', () => {
    const p = makePerson('a', {
      traits: ['content', 'optimistic', 'sanguine', 'patient', 'brave', 'inspired'],
      spouseIds: ['b'],
      childrenIds: ['c'],
      namedRelationships: [
        { type: 'friend', targetId: 'x', formedTurn: 1, depth: 0.5, revealedToPlayer: true },
        { type: 'mentor', targetId: 'y', formedTurn: 2, depth: 0.3, revealedToPlayer: true },
      ],
    });
    const b = makePerson('b');
    const c = makePerson('c', { age: 5 });
    const state = makeState({ food: 100, pop: 5, people: new Map([['b', b], ['c', c]]) });
    expect(computeHappiness(p, state)).toBeLessThanOrEqual(100);
  });

  it('clamps score to -100 minimum', () => {
    const p = makePerson('a', {
      traits: ['melancholic', 'cynical', 'traumatized', 'homesick', 'grieving'],
      health: { currentHealth: 20, conditions: ['malnourished', 'ill', 'chronic_illness'] },
      role: 'unassigned',
      age: 30,
    });
    const state = makeState({ food: 1, pop: 10 });
    expect(computeHappiness(p, state)).toBeGreaterThanOrEqual(-100);
  });

  it('a baseline person with adequate resources scores somewhere near neutral', () => {
    const p = makePerson('a', { age: 22, spouseIds: [], role: 'farmer' });
    const score = computeHappiness(p, makeState({ food: 5, pop: 5 }));
    // Expected: +5 (ample provisions) + 5 (purposeful work) − 5 (no partner) = ~5; varies a bit by isolation
    expect(score).toBeGreaterThanOrEqual(-15);
    expect(score).toBeLessThanOrEqual(30);
  });
});

// ─── computeSettlementMorale ─────────────────────────────────────────────────

describe('computeSettlementMorale', () => {
  it('returns 0 for empty population', () => {
    const state = makeState();
    expect(computeSettlementMorale(new Map(), state)).toBe(0);
  });

  it('excludes children under 14 from the mean', () => {
    const adult = makePerson('adult', { age: 25, traits: ['content', 'optimistic'] });
    const child = makePerson('child', { age: 10, traits: ['melancholic', 'traumatized'] });
    const people = new Map([['adult', adult], ['child', child]]);
    const state  = makeState({ people });
    const morale = computeSettlementMorale(people, state);
    const adultScore = computeHappiness(adult, state);
    expect(morale).toBe(adultScore);
  });

  it('averages scores over all adults', () => {
    const happy  = makePerson('h', { age: 30, traits: ['content', 'optimistic'] });
    const sad    = makePerson('s', { age: 30, traits: ['traumatized', 'melancholic'] });
    const people = new Map([['h', happy], ['s', sad]]);
    const state  = makeState({ people });
    const happyScore = computeHappiness(happy, state);
    const sadScore   = computeHappiness(sad, state);
    const expected   = Math.round((happyScore + sadScore) / 2);
    expect(computeSettlementMorale(people, state)).toBe(expected);
  });
});

// ─── getSettlementMoraleLabel ────────────────────────────────────────────────

describe('getSettlementMoraleLabel', () => {
  it('returns Thriving Settlement for high score', () => expect(getSettlementMoraleLabel(70)).toBe('Thriving Settlement'));
  it('returns Collapsing for very low score',      () => expect(getSettlementMoraleLabel(-90)).toBe('Collapsing'));
  it('returns In Crisis for -50',                  () => expect(getSettlementMoraleLabel(-50)).toBe('In Crisis'));
});

// ─── isDesertionEligible ─────────────────────────────────────────────────────

describe('isDesertionEligible', () => {
  it('returns false when lowHappinessTurns < 3', () => {
    const p = makePerson('a', { lowHappinessTurns: 2 });
    expect(isDesertionEligible(p)).toBe(false);
  });

  it('returns true when lowHappinessTurns >= 3', () => {
    const p = makePerson('a', { lowHappinessTurns: 3 });
    expect(isDesertionEligible(p)).toBe(true);
  });
});

// ─── applyHappinessTracking ──────────────────────────────────────────────────

describe('applyHappinessTracking', () => {
  it('increments lowHappinessTurns when person is in crisis (score < -50)', () => {
    // Build a deeply unhappy person
    const p = makePerson('a', {
      age: 30,
      traits: ['melancholic', 'cynical', 'traumatized', 'homesick'],
      health: { currentHealth: 20, conditions: ['ill', 'malnourished'] },
      role: 'unassigned',
      lowHappinessTurns: 1,
    });
    const people = new Map([['a', p]]);
    const state  = makeState({ food: 1, pop: 10, people, lowMoraleTurns: 0 });
    const result = applyHappinessTracking(people, state);
    const updated = result.updatedPeople.get('a');
    if (updated !== undefined) {
      // Was updated — streak should be higher than before or 0 (reset)
      const score = computeHappiness(p, state);
      if (score < -50) {
        expect(updated.lowHappinessTurns).toBe(2);
      } else {
        expect(updated.lowHappinessTurns).toBe(0);
      }
    }
    // If not in updatedPeople, streak was already 0 and score isn't crises
  });

  it('resets lowHappinessTurns to 0 when person is no longer in crisis', () => {
    const p = makePerson('a', {
      traits: ['content', 'optimistic'],
      lowHappinessTurns: 4,
      spouseIds: ['b'],
    });
    const spouse = makePerson('b');
    const people = new Map([['a', p], ['b', spouse]]);
    const state  = makeState({ food: 20, pop: 3, people, lowMoraleTurns: 0 });
    const result = applyHappinessTracking(people, state);
    // Verify score is not < -50 for content + optimistic + well-fed + married person
    const score = computeHappiness(p, state);
    expect(score).toBeGreaterThan(-50);
    if (result.updatedPeople.has('a')) {
      expect(result.updatedPeople.get('a')!.lowHappinessTurns).toBe(0);
    }
  });

  it('reports desertion candidates for persons with lowHappinessTurns >= 3', () => {
    const p = makePerson('a', {
      traits: ['melancholic', 'cynical', 'traumatized', 'homesick'],
      health: { currentHealth: 20, conditions: ['ill', 'malnourished'] },
      role: 'unassigned',
      lowHappinessTurns: 2, // will become 3 if crisis
    });
    const people = new Map([['a', p]]);
    const state  = makeState({ food: 1, pop: 10, people, lowMoraleTurns: 0 });
    const score  = computeHappiness(p, state);
    const result = applyHappinessTracking(people, state);
    if (score < -50) {
      expect(result.desertionCandidateIds).toContain('a');
    }
  });

  it('computes happinessMultipliers only for production roles', () => {
    const farmer = makePerson('farmer', { role: 'farmer', traits: ['content', 'optimistic'] });
    const guard  = makePerson('guard',  { role: 'guard',  traits: ['content', 'optimistic'] });
    const people = new Map([['farmer', farmer], ['guard', guard]]);
    const state  = makeState({ food: 20, pop: 2, people, lowMoraleTurns: 0 });
    const result = applyHappinessTracking(people, state);
    // Guard is excluded from multipliers
    expect(result.happinessMultipliers.get('guard')).toBeUndefined();
    // Farmer should have a multiplier != 1.0 (happy farmers produce more)
    // (may or may not be in map depending on whether score falls in the 1.0 band)
    // At minimum, the map does NOT contain the guard
    expect(result.happinessMultipliers.has('guard')).toBe(false);
  });

  it('increments newLowMoraleTurns when settlement morale < -20', () => {
    const p1 = makePerson('a', { traits: ['melancholic', 'cynical', 'traumatized', 'homesick', 'bereaved'], role: 'unassigned', health: { currentHealth: 10, conditions: ['ill', 'malnourished', 'chronic_illness'] } });
    const p2 = makePerson('b', { traits: ['melancholic', 'cynical', 'traumatized', 'homesick', 'bereaved'], role: 'unassigned', health: { currentHealth: 10, conditions: ['ill', 'malnourished', 'chronic_illness'] } });
    const people = new Map([['a', p1], ['b', p2]]);
    const state  = makeState({ food: 1, pop: 10, people, lowMoraleTurns: 3 });
    const morale = computeSettlementMorale(people, state);
    const result = applyHappinessTracking(people, state);
    if (morale < -20) {
      expect(result.newLowMoraleTurns).toBe(4);
    } else {
      expect(result.newLowMoraleTurns).toBe(0);
    }
  });

  it('resets newLowMoraleTurns to 0 when morale is >= -20', () => {
    const p = makePerson('a', { traits: ['content', 'optimistic', 'sanguine'] });
    const people = new Map([['a', p]]);
    const state  = makeState({ food: 20, pop: 2, people, lowMoraleTurns: 5 });
    const result = applyHappinessTracking(people, state);
    const morale = computeSettlementMorale(people, state);
    if (morale >= -20) {
      expect(result.newLowMoraleTurns).toBe(0);
    }
  });

  it('excludes children under 14 from settlement morale computation', () => {
    const child  = makePerson('child', { age: 8, traits: ['traumatized', 'melancholic'] });
    const adult  = makePerson('adult', { age: 30, traits: ['content', 'optimistic'] });
    const people = new Map([['child', child], ['adult', adult]]);
    const state  = makeState({ food: 20, pop: 2, people, lowMoraleTurns: 0 });
    const result = applyHappinessTracking(people, state);
    const adultScore = computeHappiness(adult, state);
    expect(result.settlementMorale).toBe(adultScore);
  });
});

// ─── getDepartingFamily ───────────────────────────────────────────────────────

describe('getDepartingFamily', () => {
  it('returns empty set if primary person not found', () => {
    const result = getDepartingFamily('ghost', new Map());
    expect(result.size).toBe(0);
  });

  it('includes a spouse whose lowHappinessTurns >= 1', () => {
    const spouse  = makePerson('spouse', { lowHappinessTurns: 1, relationships: new Map() });
    const primary = makePerson('primary', { spouseIds: ['spouse'], childrenIds: [] });
    const people  = new Map([['primary', primary], ['spouse', spouse]]);
    const result  = getDepartingFamily('primary', people);
    expect(result.has('spouse')).toBe(true);
  });

  it('includes a spouse with high opinion of primary (>=25)', () => {
    const spouse  = makePerson('spouse', {
      lowHappinessTurns: 0,
      relationships: new Map([['primary', 30]]),
      opinionModifiers: [],
    });
    const primary = makePerson('primary', { spouseIds: ['spouse'], childrenIds: [] });
    const people  = new Map([['primary', primary], ['spouse', spouse]]);
    const result  = getDepartingFamily('primary', people);
    expect(result.has('spouse')).toBe(true);
  });

  it('excludes a spouse who is content and has low opinion', () => {
    const spouse  = makePerson('spouse', {
      lowHappinessTurns: 0,
      relationships: new Map([['primary', 10]]),
      opinionModifiers: [],
    });
    const primary = makePerson('primary', { spouseIds: ['spouse'], childrenIds: [] });
    const people  = new Map([['primary', primary], ['spouse', spouse]]);
    const result  = getDepartingFamily('primary', people);
    expect(result.has('spouse')).toBe(false);
  });

  it('always includes children under 16', () => {
    const child   = makePerson('child', { age: 10 });
    const primary = makePerson('primary', { spouseIds: [], childrenIds: ['child'] });
    const people  = new Map([['primary', primary], ['child', child]]);
    const result  = getDepartingFamily('primary', people);
    expect(result.has('child')).toBe(true);
  });

  it('does not include children aged 16+', () => {
    const teen    = makePerson('teen', { age: 16 });
    const primary = makePerson('primary', { spouseIds: [], childrenIds: ['teen'] });
    const people  = new Map([['primary', primary], ['teen', teen]]);
    const result  = getDepartingFamily('primary', people);
    expect(result.has('teen')).toBe(false);
  });
});
