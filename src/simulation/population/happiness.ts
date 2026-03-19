/**
 * Happiness & Settlement Morale System
 *
 * Computes per-person happiness scores and the aggregate settlement morale
 * each dawn. Happiness is never stored on Person — only the streak counter
 * `person.lowHappinessTurns` persists between turns.
 *
 * All functions in this module are pure (no side effects, no RNG).
 */

import {
  type Person,
  type WorkRole,
  type SkillId,
  getSkillRating,
} from './person';
import type { GameState } from '../turn/game-state';
import { getEffectiveOpinion } from './opinions';
import { getOvercrowdingRatio } from '../buildings/building-effects';
import { SAUROMATIAN_CULTURE_IDS } from './culture';

// ─── Factor Types ─────────────────────────────────────────────────────────────

export type HappinessCategory = 'material' | 'social' | 'purpose' | 'trait';

export interface HappinessFactor {
  label: string;
  delta: number;
  category: HappinessCategory;
}

// ─── Score Labels & Colours ──────────────────────────────────────────────────

/** Returns a human-readable label for a happiness score. */
export function getHappinessLabel(score: number): string {
  if (score >= 60)  return 'Thriving';
  if (score >= 30)  return 'Content';
  if (score >= 5)   return 'Settled';
  if (score >= -15) return 'Restless';
  if (score >= -35) return 'Discontent';
  if (score >= -60) return 'Miserable';
  return 'Desperate';
}

/** Returns a Tailwind text-colour class for a happiness score. */
export function getHappinessColor(score: number): string {
  if (score >= 60)  return 'text-emerald-400';
  if (score >= 30)  return 'text-lime-400';
  if (score >= 5)   return 'text-yellow-300';
  if (score >= -15) return 'text-amber-400';
  if (score >= -35) return 'text-orange-400';
  if (score >= -60) return 'text-red-400';
  return 'text-red-600';
}

/** Returns a settlement-level label (same thresholds as individual). */
export function getSettlementMoraleLabel(score: number): string {
  if (score >= 60)  return 'Thriving Settlement';
  if (score >= 30)  return 'Content Community';
  if (score >= 5)   return 'Settled';
  if (score >= -15) return 'Restless Community';
  if (score >= -35) return 'Discontent';
  if (score >= -60) return 'In Crisis';
  return 'Collapsing';
}

// ─── Production Multiplier ───────────────────────────────────────────────────

/**
 * Returns the production efficiency multiplier for a given happiness score.
 * Applied per-person in calculateProduction().
 * Guards, away, and keth_thara roles apply ×1.0 regardless (caller responsibility).
 */
export function getHappinessProductionMultiplier(score: number): number {
  if (score >= 60)  return 1.15;
  if (score >= 30)  return 1.07;
  if (score >= 5)   return 1.00;
  if (score >= -15) return 0.95;
  if (score >= -35) return 0.88;
  if (score >= -60) return 0.78;
  return 0.65;
}

// ─── Role → Skill Mapping ────────────────────────────────────────────────────

const ROLE_SKILL_MAP: Partial<Record<WorkRole, SkillId>> = {
  farmer:        'plants',
  trader:        'bargaining',
  guard:         'combat',
  craftsman:     'custom',
  healer:        'plants',
  gather_food:   'plants',
  gather_stone:  'custom',
  gather_lumber: 'custom',
  priest_solar:  'leadership',
  wheel_singer:  'leadership',
  voice_of_wheel:'bargaining',
  builder:       'custom',
  blacksmith:    'custom',
  tailor:        'custom',
  brewer:        'bargaining',
  miller:        'plants',
  herder:        'animals',
};

// ─── Factor Computation ──────────────────────────────────────────────────────

/**
 * Computes the full list of happiness factors for a person in a given game state.
 * Factors with a zero delta are included when checking conditions for the UI but
 * callers may filter them out with `factor.delta !== 0`.
 */
export function computeHappinessFactors(
  person: Person,
  state: GameState,
): HappinessFactor[] {
  const factors: HappinessFactor[] = [];
  const { settlement, culture, people } = state;

  // ── Material: Food Adequacy ───────────────────────────────────────────────
  const food = settlement.resources.food;
  const pop  = Math.max(1, settlement.populationCount);

  if (food >= pop * 2) {
    factors.push({ label: 'Full bellies', delta: 10, category: 'material' });
  } else if (food >= pop) {
    factors.push({ label: 'Ample provisions', delta: 5, category: 'material' });
  } else if (food < pop * 0.5) {
    factors.push({ label: 'Provisions running low', delta: -10, category: 'material' });
  }

  if (person.health.conditions.includes('malnourished')) {
    factors.push({ label: 'Suffering from hunger', delta: -25, category: 'material' });
  }

  // ── Material: Overcrowding ────────────────────────────────────────────────
  const overcrowding = getOvercrowdingRatio(settlement.populationCount, settlement.buildings);
  if (overcrowding > 1.50) {
    factors.push({ label: 'Dangerously crowded', delta: -30, category: 'material' });
  } else if (overcrowding > 1.25) {
    factors.push({ label: 'Badly overcrowded', delta: -15, category: 'material' });
  } else if (overcrowding > 1.00) {
    factors.push({ label: 'A little cramped', delta: -5, category: 'material' });
  }

  // ── Material: Health Conditions ──────────────────────────────────────────
  const conditions = person.health.conditions;
  if (conditions.includes('ill'))             factors.push({ label: 'Struggling with illness',         delta: -15, category: 'material' });
  if (conditions.includes('wounded'))         factors.push({ label: 'Nursing an injury',               delta: -10, category: 'material' });
  if (conditions.includes('recovering'))      factors.push({ label: 'Still recovering',                delta:  -5, category: 'material' });
  if (conditions.includes('chronic_illness')) factors.push({ label: 'Living with a chronic condition', delta: -20, category: 'material' });
  if (conditions.includes('frail'))           factors.push({ label: 'Physical frailty weighs on them', delta: -10, category: 'material' });

  // ── Material: Private Dwelling ────────────────────────────────────────
  // Find the household this person belongs to and its claimed dwelling.
  let dwellingTierBonus = 0;
  const household = person.householdId
    ? (state.households?.get(person.householdId) ?? null)
    : null;
  const dwellingId = household?.dwellingBuildingId ?? null;
  if (dwellingId) {
    const dwelling = settlement.buildings.find(b => b.instanceId === dwellingId);
    if (dwelling) {
      if (dwelling.defId === 'wattle_hut')  dwellingTierBonus = 8;
      if (dwelling.defId === 'cottage')      dwellingTierBonus = 15;
      if (dwelling.defId === 'homestead')    dwellingTierBonus = 22;
      if (dwelling.defId === 'compound')     dwellingTierBonus = 30;
    }
  }
  if (dwellingTierBonus > 0) {
    factors.push({ label: 'Has a hearth to call home', delta: dwellingTierBonus, category: 'material' });
  }

  // Time-based expectation: year 5+ without a private home feels like deprivation.
  const currentYear = state.currentYear ?? 1;
  const joinedYear  = person.joinedYear ?? 1;
  const yearsPresent = currentYear - joinedYear;
  if (!dwellingId && yearsPresent >= 5) {
    const penalty = Math.min(3 + Math.floor((yearsPresent - 5) * 1.5), 20);
    factors.push({ label: 'No home after years of service', delta: -penalty, category: 'material' });
  }

  // Relative jealousy: if ANY dwelling exists but this person has none.
  if (!dwellingId) {
    const anyDwellingExists = settlement.buildings.some(
      b => ['wattle_hut','cottage','homestead','compound'].includes(b.defId),
    );
    if (anyDwellingExists) {
      factors.push({ label: 'Others have homes; I do not', delta: -8, category: 'material' });
    }
  }

  // ── Social: Brewery morale ─────────────────────────────────────────────
  const hasBrewery = settlement.buildings.some(b => b.defId === 'brewery');
  const hasBrewer  = Array.from(people.values()).some(p => p.role === 'brewer');
  if (hasBrewery && hasBrewer) {
    factors.push({ label: 'Quality ale and mead', delta: 5, category: 'social' });
  }
  // ── Social: Bathhouse access (Sauromatian women) ─────────────────────────
  const isSauromatianWoman = person.sex === 'female' && SAUROMATIAN_CULTURE_IDS.has(person.heritage.primaryCulture);
  if (isSauromatianWoman) {
    if (settlement.buildings.some(b => b.defId === 'bathhouse_grand')) {
      factors.push({ label: 'Grand Bathhouse', delta: 16, category: 'social' });
    } else if (settlement.buildings.some(b => b.defId === 'bathhouse_improved')) {
      factors.push({ label: 'Improved Bathhouse', delta: 12, category: 'social' });
    } else if (settlement.buildings.some(b => b.defId === 'bathhouse')) {
      factors.push({ label: 'Bathhouse comforts', delta: 8, category: 'social' });
    }
  } else if (settlement.buildings.some(b => b.defId === 'bathhouse_grand')) {
    // Grand Bathhouse is a civic amenity all women appreciate
    if (person.sex === 'female') {
      factors.push({ label: 'Grand civic bathhouse', delta: 5, category: 'social' });
    }
  }
  // ── Social: Spouse / Partner ─────────────────────────────────────────────
  const livingSpouseIds = person.spouseIds.filter(id => people.has(id));
  if (livingSpouseIds.length > 0) {
    factors.push({ label: 'Settled down with a partner', delta: 15, category: 'social' });
  } else if (person.age >= 20) {
    factors.push({ label: 'Has not found a partner', delta: -5, category: 'social' });
  }

  // ── Social: Children ─────────────────────────────────────────────────────
  const livingChildIds = person.childrenIds.filter(id => people.has(id));
  if (livingChildIds.length > 0) {
    factors.push({ label: 'The joy of family', delta: 8, category: 'social' });
  }

  // ── Social: Named Relationships ──────────────────────────────────────────
  const rels = person.namedRelationships ?? [];
  const hasFriendOrConfidant = rels.some(r => r.type === 'friend' || r.type === 'confidant');
  const hasMentorOrStudent   = rels.some(r => r.type === 'mentor' || r.type === 'student');
  const hasRival             = rels.some(r => r.type === 'rival');
  const hasNemesis           = rels.some(r => r.type === 'nemesis');

  if (hasFriendOrConfidant) factors.push({ label: 'Close friendships',              delta:  10, category: 'social' });
  if (hasMentorOrStudent)   factors.push({ label: 'A meaningful bond of guidance',  delta:   8, category: 'social' });
  if (hasRival)             factors.push({ label: 'An ongoing rivalry',             delta:  -5, category: 'social' });
  if (hasNemesis)           factors.push({ label: 'A bitter enmity',                delta: -15, category: 'social' });

  // Isolation: no named relationships AND no opinion score > 20 with anyone
  const hasNoNamedRels = rels.length === 0;
  const hasNoHighOpinion = !Array.from((person.relationships ?? new Map()).values()).some(v => v > 20);
  if (hasNoNamedRels && hasNoHighOpinion) {
    factors.push({ label: 'Lonely among strangers', delta: -10, category: 'social' });
  }

  // ── Social: Ashka-Melathi ─────────────────────────────────────────────────
  const livingAshkaIds = (person.ashkaMelathiPartnerIds ?? []).filter(id => people.has(id));
  if (livingAshkaIds.length > 0) {
    factors.push({ label: 'Bound in Ashka-Melathi fellowship', delta: 8, category: 'social' });
  }

  // ── Social: Religious Freedom ─────────────────────────────────────────────
  const policy    = settlement.religiousPolicy;
  const religion  = person.religion;
  let religionDelta = 0;

  if (policy === 'orthodox_enforced' && religion === 'sacred_wheel') {
    religionDelta = -15;
    factors.push({ label: 'Faith suppressed by authority',           delta: -15, category: 'social' });
  } else if (policy === 'orthodox_enforced' && religion === 'syncretic_hidden_wheel') {
    religionDelta = -20;
    factors.push({ label: 'Faith practised in secret and fear',      delta: -20, category: 'social' });
  }

  // Majority faith bonus
  let majorityReligion: string | null = null;
  let maxFrac = 0;
  culture.religions.forEach((frac, rid) => {
    if (frac > maxFrac) { maxFrac = frac; majorityReligion = rid; }
  });
  if (majorityReligion !== null && religion === majorityReligion) {
    factors.push({ label: 'Surrounded by like faith', delta: 5, category: 'social' });
  }

  // Spiritual leadership present
  const faithRoleMap: Record<string, WorkRole> = {
    imanian_orthodox:        'priest_solar',
    sacred_wheel:            'wheel_singer',
    syncretic_hidden_wheel:  'voice_of_wheel',
  };
  const faithRole = faithRoleMap[religion];
  if (faithRole !== undefined) {
    const hasLeader = Array.from(people.values()).some(p => p.role === faithRole);
    if (hasLeader) {
      factors.push({ label: 'Spiritual leadership present', delta: 5, category: 'social' });
    }
  }

  // ── Social: Cultural Identity Displacement ─────────────────────────────────
  // Persons whose cultural heritage sharply diverges from the settlement's blend
  // feel alienated — Sauromatian women under heavy Imanian pressure, or longtime
  // Imanian settlers watching the community become unrecognisable.
  const blend = state.culture?.culturalBlend ?? 0.5;
  const isNativeHeritage = SAUROMATIAN_CULTURE_IDS.has(person.heritage.primaryCulture);
  const isPredominantlyImanian = person.heritage.primaryCulture === 'imanian';
  if (isNativeHeritage) {
    if (blend < 0.10) {
      const amplifier = person.traits.includes('homesick') ? 1.5 : 1.0;
      factors.push({ label: 'A stranger in their own home', delta: Math.round(-10 * amplifier), category: 'social' });
    } else if (blend < 0.25) {
      const amplifier = person.traits.includes('homesick') ? 1.5 : 1.0;
      factors.push({ label: 'Cultural ways feel under pressure', delta: Math.round(-5 * amplifier), category: 'social' });
    }
  } else if (isPredominantlyImanian) {
    if (blend > 0.80) {
      factors.push({ label: 'Dissonant with local customs', delta: -8, category: 'social' });
    } else if (blend > 0.65) {
      factors.push({ label: 'Uncomfortable with cultural changes', delta: -4, category: 'social' });
    }
  }

  // ── Purpose: Work Role ────────────────────────────────────────────────────
  const role = person.role;
  const isProductive = role !== 'unassigned' && role !== 'away' && role !== 'keth_thara';

  if (isProductive) {
    factors.push({ label: 'Purposeful work', delta: 5, category: 'purpose' });

    // Skill fit bonus/penalty
    const mappedSkill = ROLE_SKILL_MAP[role];
    if (mappedSkill !== undefined) {
      const skillValue = person.skills[mappedSkill];
      const rating = getSkillRating(skillValue);
      if (rating === 'excellent' || rating === 'renowned' || rating === 'heroic') {
        factors.push({ label: 'Working in their element', delta: 5, category: 'purpose' });
      } else if (rating === 'fair') {
        factors.push({ label: 'Ill-suited to their role', delta: -5, category: 'purpose' });
      }
    }
  } else if (role === 'unassigned') {
    // Only penalise if they've been unassigned for ≥ 4 turns
    // We approximate this conservatively: if they're unassigned right now, apply the penalty.
    // The 4-turn tracking would require additional state; for now the penalty always applies.
    factors.push({ label: 'Without purpose or direction', delta: -10, category: 'purpose' });
  }

  // ── Trait Modifiers ───────────────────────────────────────────────────────
  const traits = new Set(person.traits);
  const hasSpouse  = livingSpouseIds.length > 0;
  const isolated   = hasNoNamedRels && hasNoHighOpinion;
  const hasAnyRel  = rels.length > 0;

  if (traits.has('content'))    factors.push({ label: 'Satisfied with their lot',                delta:  15, category: 'trait' });
  if (traits.has('optimistic')) factors.push({ label: 'Generally upbeat',                        delta:  10, category: 'trait' });
  if (traits.has('melancholic')) factors.push({ label: 'Prone to sadness',                       delta: -10, category: 'trait' });
  if (traits.has('sanguine'))   factors.push({ label: 'Naturally cheerful',                      delta:   8, category: 'trait' });
  if (traits.has('patient'))    factors.push({ label: 'More tolerant of hardship',               delta:   5, category: 'trait' });
  if (traits.has('hot_tempered')) factors.push({ label: 'Chafes at any frustration',             delta:  -5, category: 'trait' });
  if (traits.has('brave'))      factors.push({ label: 'Psychological resilience',                delta:   5, category: 'trait' });
  if (traits.has('cowardly'))   factors.push({ label: 'Anxiety weighs on them',                  delta:  -5, category: 'trait' });
  if (traits.has('cynical'))    factors.push({ label: 'Nothing is ever quite right',             delta: -10, category: 'trait' });

  // Conditional traits
  if (traits.has('romantic')) {
    if (hasSpouse) {
      factors.push({ label: 'Deeply in love', delta: 20, category: 'trait' });
    } else {
      factors.push({ label: 'Yearning for love', delta: -15, category: 'trait' });
    }
  }

  if (traits.has('lonely')) {
    if (hasFriendOrConfidant) {
      factors.push({ label: 'Finally found belonging', delta: 15, category: 'trait' });
    } else if (isolated) {
      factors.push({ label: 'Profoundly alone', delta: -20, category: 'trait' });
    }
  }

  if (traits.has('gregarious')) {
    if (hasAnyRel) {
      factors.push({ label: 'Thriving in company', delta: 10, category: 'trait' });
    } else if (isolated) {
      factors.push({ label: 'Craves more company', delta: -5, category: 'trait' });
    }
  }

  if (traits.has('solitary')) {
    if (overcrowding <= 1.0) {
      factors.push({ label: 'Has the space they need', delta: 10, category: 'trait' });
    } else if (overcrowding > 1.25) {
      factors.push({ label: 'Suffocated by the crowd', delta: -15, category: 'trait' });
    }
  }

  if (traits.has('proud')) {
    const status = person.socialStatus;
    if (status === 'founding_member' || status === 'elder') {
      factors.push({ label: 'Respected and proud', delta: 10, category: 'trait' });
    } else if (status === 'outcast' || status === 'thrall') {
      factors.push({ label: 'Dignity denied', delta: -15, category: 'trait' });
    }
  }

  if (traits.has('ambitious')) {
    const hasAmbition = person.ambition !== null;
    const lacksGoal   = !hasAmbition && person.age >= 22 &&
      Object.values(person.skills).some(v => v >= 46);
    if (hasAmbition) {
      factors.push({ label: 'Driven by a clear purpose', delta: 10, category: 'trait' });
    } else if (lacksGoal) {
      factors.push({ label: 'Ambition without outlet', delta: -10, category: 'trait' });
    }
  }

  // Devout — multiplies religion satisfaction factors
  if (traits.has('devout') && religionDelta !== 0) {
    const extra = Math.floor(religionDelta * 0.5); // effectively ×1.5 total; floor ensures penalty rounds toward more negative
    if (extra !== 0) {
      factors.push({ label: 'Faith runs deep', delta: extra, category: 'trait' });
    }
  }

  // Temporary mental-state traits
  if (traits.has('inspired'))    factors.push({ label: 'Inspired and energised',               delta:  25, category: 'trait' });
  if (traits.has('restless'))    factors.push({ label: 'Restless and unsettled',               delta: -15, category: 'trait' });
  if (traits.has('grieving'))    factors.push({ label: 'Weighed down by grief',                delta: -20, category: 'trait' });
  if (traits.has('traumatized')) factors.push({ label: 'Haunted by past events',               delta: -20, category: 'trait' });
  if (traits.has('homesick'))    factors.push({ label: 'Longing for home',                     delta: -20, category: 'trait' });

  // Earned traits
  if (traits.has('bereaved'))         factors.push({ label: 'Long-term grief',                delta: -20, category: 'trait' });
  if (traits.has('respected_elder'))  factors.push({ label: 'Social standing satisfaction',   delta:  10, category: 'trait' });
  if (traits.has('veteran'))          factors.push({ label: 'Hard-won resilience',            delta:   5, category: 'trait' });
  if (traits.has('healer'))           factors.push({ label: 'Fulfilment in their craft',       delta:   5, category: 'trait' });

  // ── Courtship / Companion factors ────────────────────────────────────────
  const isSauroFemale =
    person.sex === 'female' &&
    SAUROMATIAN_CULTURE_IDS.has(person.heritage.primaryCulture);
  const courtshipNorms = settlement.courtshipNorms ?? 'mixed';

  // Purpose: courtship suppressed under Traditional policy
  if (
    isSauroFemale &&
    person.spouseIds.length === 0 &&
    person.age >= 16 &&
    person.age <= 45 &&
    courtshipNorms === 'traditional'
  ) {
    factors.push({ label: 'Courtship suppressed', delta: -6, category: 'purpose' });
  }

  // Purpose: actively courting at meaningful intensity
  if (
    isSauroFemale &&
    person.ambition &&
    (person.ambition.type === 'seek_companion' || person.ambition.type === 'seek_spouse') &&
    person.ambition.intensity >= 0.5
  ) {
    factors.push({ label: 'Actively courting', delta: 4, category: 'purpose' });
  }

  // Social: Imanian discomfort — a Sauromatian woman is pursuing him and he hasn't warmed to her
  if (
    person.sex === 'male' &&
    !SAUROMATIAN_CULTURE_IDS.has(person.heritage.primaryCulture) &&
    person.religion === 'imanian_orthodox'
  ) {
    const beingPursued = Array.from(people.values()).some(
      p =>
        p.sex === 'female' &&
        SAUROMATIAN_CULTURE_IDS.has(p.heritage.primaryCulture) &&
        p.ambition?.type === 'seek_companion' &&
        p.ambition.targetPersonId === person.id &&
        getEffectiveOpinion(person, p.id) < 15,
    );
    if (beingPursued) {
      factors.push({ label: 'Unsettled by pursuit', delta: -5, category: 'social' });
    }
  }

  // Social: Sauromatian woman has a companion / partner
  if (isSauroFemale) {
    const hasCompanion =
      livingSpouseIds.length > 0 ||
      // Or a concubine in the same household who is male
      (person.householdId !== null &&
        Array.from(people.values()).some(
          p =>
            p.sex === 'male' &&
            p.householdId === person.householdId &&
            p.householdRole === 'concubine',
        ));
    if (hasCompanion) {
      factors.push({ label: 'Has found a companion', delta: 6, category: 'social' });
    }
  }

  return factors;
}

/**
 * Returns the clamped happiness score for a person in the given state.
 * Range: −100 to +100.
 */
export function computeHappiness(person: Person, state: GameState): number {
  const factors = computeHappinessFactors(person, state);
  const raw = factors.reduce((sum, f) => sum + f.delta, 0);
  return Math.max(-100, Math.min(100, raw));
}

// ─── Settlement Morale ────────────────────────────────────────────────────────

/**
 * Computes the arithmetic mean happiness of all living persons aged ≥ 14.
 * Returns 0 if there are no eligible people.
 */
export function computeSettlementMorale(
  people: Map<string, Person>,
  state: GameState,
): number {
  const scores: number[] = [];
  for (const person of people.values()) {
    if (person.age >= 14) {
      scores.push(computeHappiness(person, state));
    }
  }
  if (scores.length === 0) return 0;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

// ─── Desertion Gate ───────────────────────────────────────────────────────────

/** Returns true when the person is crisis-eligible for the leaving events. */
export function isDesertionEligible(person: Person): boolean {
  return person.lowHappinessTurns >= 3;
}

// ─── Tracking Pass ───────────────────────────────────────────────────────────

export interface HappinessTrackingResult {
  /** Delta map: only changed persons are included. */
  updatedPeople: Map<string, Person>;
  settlementMorale: number;
  /** IDs of people who just became desertion-eligible (lowHappinessTurns >= 3). */
  desertionCandidateIds: string[];
  /** Pre-computed multipliers for calculateProduction() — keyed by person ID. */
  happinessMultipliers: Map<string, number>;
  /** Updated value for GameState.lowMoraleTurns. */
  newLowMoraleTurns: number;
  /** Per-person happiness scores computed this pass — consumed by processCulturalDrift(). */
  happinessScores: Map<string, number>;
}

/** Production roles for which the happiness multiplier applies. */
const PRODUCTION_ROLES = new Set<WorkRole>([
  'farmer', 'trader', 'craftsman', 'healer',
  'gather_food', 'gather_stone', 'gather_lumber',
  'priest_solar', 'wheel_singer', 'voice_of_wheel',
  'builder',
]);

/**
 * Runs the full happiness tracking pass for all living people.
 *
 * 1. Computes happiness for every person.
 * 2. Increments/resets `lowHappinessTurns` streak counters.
 * 3. Builds the production multiplier map (production roles only).
 * 4. Computes settlement morale and derives the new `lowMoraleTurns` value.
 * 5. Returns a delta map of changed persons plus the derived signals for the
 *    turn-processor to apply to GameState.
 */
export function applyHappinessTracking(
  people: Map<string, Person>,
  state: GameState,
): HappinessTrackingResult {
  const updatedPeople    = new Map<string, Person>();
  const multipliers      = new Map<string, number>();
  const candidateIds: string[] = [];
  const happinessScores  = new Map<string, number>();

  let moraleTotalAge14 = 0;
  let moraleCount      = 0;

  for (const [id, person] of people) {
    const score  = computeHappiness(person, state);
    happinessScores.set(id, score);
    const isCrisis = score < -50;

    // Production multiplier (guards, away, keth_thara excluded)
    if (PRODUCTION_ROLES.has(person.role)) {
      const mult = getHappinessProductionMultiplier(score);
      if (mult !== 1.0) multipliers.set(id, mult);
    }

    // Settlement morale
    if (person.age >= 14) {
      moraleTotalAge14 += score;
      moraleCount++;
    }

    // Update streak counter
    const prevTurns = person.lowHappinessTurns;
    const newTurns  = isCrisis ? prevTurns + 1 : 0;
    if (newTurns !== prevTurns) {
      updatedPeople.set(id, { ...person, lowHappinessTurns: newTurns });
    }

    // Collect newly or persistently eligible candidates
    if (newTurns >= 3) {
      candidateIds.push(id);
    }
  }

  const settlementMorale = moraleCount > 0
    ? Math.round(moraleTotalAge14 / moraleCount)
    : 0;

  const newLowMoraleTurns = settlementMorale < -20
    ? (state.lowMoraleTurns ?? 0) + 1
    : 0;

  return {
    updatedPeople,
    settlementMorale,
    desertionCandidateIds: candidateIds,
    happinessMultipliers: multipliers,
    newLowMoraleTurns,
    happinessScores,
  };
}

// ─── Desertion Family Logic ───────────────────────────────────────────────────

/**
 * Returns the set of person IDs that would depart alongside a primary deserter.
 * Spouses depart if their own lowHappinessTurns >= 1 OR effective opinion of
 * the departee >= 25. Children under 16 always follow.
 */
export function getDepartingFamily(
  primaryId: string,
  people: Map<string, Person>,
): Set<string> {
  const primary = people.get(primaryId);
  if (!primary) return new Set();

  const departing = new Set<string>();

  // Spouses
  for (const spouseId of primary.spouseIds) {
    const spouse = people.get(spouseId);
    if (!spouse) continue;
    const opinionOfPrimary = getEffectiveOpinion(spouse, primaryId);
    if (spouse.lowHappinessTurns >= 1 || opinionOfPrimary >= 25) {
      departing.add(spouseId);
    }
  }

  // Children under 16 always follow — we assume they follow the primary departee.
  for (const childId of primary.childrenIds) {
    const child = people.get(childId);
    if (!child) continue;
    if (child.age < 16) {
      departing.add(childId);
    }
  }

  return departing;
}
