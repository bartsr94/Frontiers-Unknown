/**
 * Named Relationships engine — System A of Phase 4.0.
 *
 * Named relationships sit *above* the opinion score layer. They carry
 * emotional weight beyond a raw number and produce ongoing mechanical effects.
 *
 * Six types: friend · rival · mentor · student · confidant · nemesis
 *
 * Pure TypeScript — no React imports, no Math.random().
 * All randomness through the seeded RNG passed in by the caller.
 */

import type { Person } from './person';
import type { NamedRelationship, NamedRelationshipType } from './person';
import { getEffectiveOpinion } from './opinions';
import type { SeededRNG } from '../../utils/rng';
import { debugLog } from '../../utils/debug-logger';
import type { DebugSettings } from '../turn/game-state';
import { clamp } from '../../utils/math';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Depth grows this much per turn once a relationship is formed. */
const DEPTH_GROWTH_PER_TURN = 0.02;

/** Opinion threshold to form a 'friend' bond. */
const FRIEND_OPINION_THRESHOLD = 50;
/** Minimum turns opinion must exceed the threshold before 'friend' can form. */
const FRIEND_SUSTAIN_TURNS = 4;
/** 'friend' dissolves if effective opinion drops below this for FRIEND_DISSOLVE_TURNS turns. */
const FRIEND_DISSOLVE_THRESHOLD = 20;
const FRIEND_DISSOLVE_TURNS = 3;
void FRIEND_DISSOLVE_TURNS; // used as documentation; not yet consumed in dissolution logic

/** Opinion threshold to form a 'rival' bond. */
const RIVAL_OPINION_THRESHOLD = -25;
const RIVAL_SUSTAIN_TURNS = 4;
/** 'rival' dissolves when opinion rises above this. */
const RIVAL_DISSOLVE_THRESHOLD = 10;

/** Opinion threshold for 'nemesis' formation. */
const NEMESIS_OPINION_THRESHOLD = -55;
const NEMESIS_SUSTAIN_TURNS = 4;

/** Opinion required for 'confidant' formation. */
const CONFIDANT_OPINION_THRESHOLD = 45;
/** Co-event modifier count proxy: at least this many opinion modifier entries to count as co-actors. */
const CONFIDANT_CO_EVENT_COUNT = 3;
/** 'confidant' dissolves if opinion drops below this. */
const CONFIDANT_DISSOLVE_THRESHOLD = 0;

/** Minimum age difference for a mentor relationship. */
const MENTOR_AGE_DIFF = 15;
/** Skill threshold: mentor must have at least one base skill at or above this. */
const MENTOR_MIN_SKILL = 63;
/** Student must have the trained skill below this level. */
const MENTOR_STUDENT_SKILL_MAX = 45;
/** Student must be younger than this. */
const MENTOR_STUDENT_MAX_AGE = 35;
/** Minimum language fluency for mentor and student to communicate. */
const MENTOR_LANGUAGE_FLUENCY = 0.3;

/** Mentor relationship dissolves when student reaches this fraction of mentor's skill. */
const MENTOR_DISSOLVE_STUDENT_SKILL_FRACTION = 0.80;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns true if person A and person B share at least one language with fluency ≥ minFluency. */
function shareLanguage(a: Person, b: Person, minFluency: number): boolean {
  for (const la of a.languages) {
    if (la.fluency < minFluency) continue;
    if (b.languages.some(lb => lb.language === la.language && lb.fluency >= minFluency)) {
      return true;
    }
  }
  return false;
}

/** Returns true if person already has a named relationship of type T toward target. */
function hasRelationshipTo(person: Person, type: NamedRelationshipType, targetId: string): boolean {
  return person.namedRelationships.some(r => r.type === type && r.targetId === targetId);
}

/** Returns the highest value among the person's six base skills. */
function highestBaseSkill(person: Person): number {
  const s = person.skills;
  return Math.max(s.animals, s.bargaining, s.combat, s.custom, s.leadership, s.plants);
}
void highestBaseSkill; // available for future tiebreakers

/**
 * Returns the highest base skill value the person has in common with the mentor
 * (the skill the mentor could teach). We pick the skill where the mentor is
 * strongest and the student is below the threshold.
 *
 * Returns { mentorSkill, studentSkill } or null if no teachable skill exists.
 */
function getMentorableSkill(
  mentor: Person,
  student: Person,
): { mentorSkill: number; studentSkill: number } | null {
  const skillIds = ['animals', 'bargaining', 'combat', 'custom', 'leadership', 'plants'] as const;
  let best: { mentorSkill: number; studentSkill: number } | null = null;

  for (const id of skillIds) {
    const ms = mentor.skills[id];
    const ss = student.skills[id];
    if (ms >= MENTOR_MIN_SKILL && ss < MENTOR_STUDENT_SKILL_MAX) {
      if (!best || ms > best.mentorSkill) {
        best = { mentorSkill: ms, studentSkill: ss };
      }
    }
  }
  return best;
}

/**
 * Returns the number of shared opinion modifier entries between two persons.
 * Used as a proxy for "co-appeared in events together" — each `add_modifier`
 * consequence from a shared event creates an entry on both participants.
 */
function countCoEventModifiers(a: Person, b: Person): number {
  if (!a.opinionModifiers?.length || !b.opinionModifiers?.length) return 0;
  const bTargets = new Set(b.opinionModifiers.map(m => m.id));
  return a.opinionModifiers.filter(m => m.targetId === b.id && bTargets.has(m.id)).length;
}

// ─── Formation ────────────────────────────────────────────────────────────────

/**
 * Returns a new NamedRelationship if the conditions to form one between
 * `from` → `to` are currently satisfied, otherwise null.
 *
 * Only one relationship type is returned per call (caller iterates pairs).
 * Priority: nemesis > rival > friend > mentor/student > confidant.
 *
 * `opinionSustainedSince` is read from `from.opinionSustainedSince` by the caller.
 */
function tryFormRelationship(
  from: Person,
  to: Person,
  currentTurn: number,
): NamedRelationshipType | null {
  const opinion = getEffectiveOpinion(from, to.id);

  // ── Nemesis (highest priority negative) ─────────────────────────────────
  if (
    !hasRelationshipTo(from, 'nemesis', to.id) &&
    !hasRelationshipTo(from, 'rival', to.id) &&
    opinion <= NEMESIS_OPINION_THRESHOLD
  ) {
    const since = from.opinionSustainedSince?.[to.id];
    if (since !== undefined && currentTurn - since >= NEMESIS_SUSTAIN_TURNS) return 'nemesis';
  }

  // ── Rival ────────────────────────────────────────────────────────────────
  if (
    !hasRelationshipTo(from, 'rival', to.id) &&
    !hasRelationshipTo(from, 'nemesis', to.id) &&
    to.ambition &&
    from.ambition &&
    (from.ambition.type === 'seek_council' || from.ambition.type === 'seek_seniority') &&
    (to.ambition.type === 'seek_council' || to.ambition.type === 'seek_seniority')
  ) {
    // Ambition conflict: both competing for the same throne → instant rival (no sustain needed)
    return 'rival';
  }

  if (
    !hasRelationshipTo(from, 'rival', to.id) &&
    !hasRelationshipTo(from, 'nemesis', to.id) &&
    opinion <= RIVAL_OPINION_THRESHOLD
  ) {
    const since = from.opinionSustainedSince?.[to.id];
    if (since !== undefined && currentTurn - since >= RIVAL_SUSTAIN_TURNS) return 'rival';
  }

  // ── Friend ───────────────────────────────────────────────────────────────
  if (!hasRelationshipTo(from, 'friend', to.id) && opinion >= FRIEND_OPINION_THRESHOLD) {
    const since = from.opinionSustainedSince?.[to.id];
    if (since !== undefined && currentTurn - since >= FRIEND_SUSTAIN_TURNS) return 'friend';
  }

  // ── Mentor (only if `from` is the mentor candidate) ──────────────────────
  if (
    !hasRelationshipTo(from, 'mentor', to.id) &&
    !hasRelationshipTo(from, 'student', to.id) &&
    from.age - to.age >= MENTOR_AGE_DIFF &&
    to.age <= MENTOR_STUDENT_MAX_AGE &&
    (from.traits.includes('mentor_hearted') || from.traits.includes('clever')) &&
    shareLanguage(from, to, MENTOR_LANGUAGE_FLUENCY) &&
    getMentorableSkill(from, to) !== null
  ) {
    return 'mentor';
  }

  // ── Confidant ────────────────────────────────────────────────────────────
  if (
    !hasRelationshipTo(from, 'confidant', to.id) &&
    opinion >= CONFIDANT_OPINION_THRESHOLD &&
    (from.heritage.primaryCulture === to.heritage.primaryCulture ||
      from.religion === to.religion) &&
    countCoEventModifiers(from, to) >= CONFIDANT_CO_EVENT_COUNT
  ) {
    return 'confidant';
  }

  return null;
}

// ─── Main processing function ─────────────────────────────────────────────────

export interface NamedRelationshipResult {
  /** Delta map: only persons whose namedRelationships or opinionSustainedSince changed. */
  updatedPeople: Map<string, Person>;
  /** Activity log entries for relationship events this turn. */
  logEntries: Array<{
    type: 'relationship_formed' | 'relationship_dissolved';
    personId: string;
    targetId: string;
    relationshipType: NamedRelationshipType;
    description: string;
  }>;
}

/**
 * Main entry point — processes all named relationship formation, depth growth,
 * and dissolution for one dawn turn.
 *
 * Returns a delta map (only changed persons) and activity log entries.
 * Pure function: no side effects beyond what's in the return value.
 */
export function processNamedRelationships(
  people: Map<string, Person>,
  currentTurn: number,
  rng: SeededRNG,
  debugSettings?: DebugSettings,
): NamedRelationshipResult {
  const delta = new Map<string, Person>();
  const logEntries: NamedRelationshipResult['logEntries'] = [];

  // Working copy resolving a person from the delta map or the original.
  function resolve(id: string): Person {
    return delta.get(id) ?? people.get(id)!;
  }
  function put(person: Person): void {
    delta.set(person.id, person);
  }

  const livingIds = Array.from(people.keys()).filter(id => {
    const p = people.get(id);
    return p && p.age >= 14; // Only adults form named relationships
  });

  // ── Step 1: Update opinionSustainedSince tracking ─────────────────────────
  // For every living pair, track when their opinion crossed the key thresholds.
  for (const aId of livingIds) {
    const a = resolve(aId);
    const newSustained: Partial<Record<string, number>> = { ...(a.opinionSustainedSince ?? {}) };
    let changed = false;

    for (const bId of livingIds) {
      if (aId === bId) continue;
      const opinion = getEffectiveOpinion(a, bId);

      const TRACK_THRESHOLDS = [
        { test: opinion >= FRIEND_OPINION_THRESHOLD, key: bId },
        { test: opinion <= RIVAL_OPINION_THRESHOLD, key: bId },
        { test: opinion <= NEMESIS_OPINION_THRESHOLD, key: bId },
      ];

      // We use a single entry per pair since we test the combination at formation time.
      // Key: the targeted person's ID when opinion passes an extreme threshold.
      const extremePositive = opinion >= FRIEND_OPINION_THRESHOLD;
      const extremeNegative = opinion <= RIVAL_OPINION_THRESHOLD;

      if (extremePositive || extremeNegative) {
        if (newSustained[bId] === undefined) {
          newSustained[bId] = currentTurn;
          changed = true;
        }
      } else {
        // Opinion returned to neutral — reset the clock
        if (newSustained[bId] !== undefined) {
          delete newSustained[bId];
          changed = true;
        }
      }
      // Suppress unused variable warning
      void TRACK_THRESHOLDS;
    }

    if (changed) {
      put({ ...a, opinionSustainedSince: newSustained });
    }
  }

  // ── Step 2: Form new relationships ────────────────────────────────────────
  for (const aId of livingIds) {
    const a = resolve(aId);

    for (const bId of livingIds) {
      if (aId === bId) continue;
      const b = resolve(bId);

      const relType = tryFormRelationship(a, b, currentTurn);
      if (!relType) continue;

      // Don't form a duplicate
      if (hasRelationshipTo(a, relType, bId)) continue;

      const newRel: NamedRelationship = {
        type: relType,
        targetId: bId,
        formedTurn: currentTurn,
        depth: 0,
        revealedToPlayer: false,
      };

      // Apply to person A
      const updatedA: Person = {
        ...a,
        namedRelationships: [...a.namedRelationships, newRel],
      };
      put(updatedA);

      // Mirror: student is the inverse of mentor; other types are symmetric
      let mirrorType: NamedRelationshipType = relType;
      if (relType === 'mentor') mirrorType = 'student';
      if (relType === 'student') mirrorType = 'mentor';

      if (!hasRelationshipTo(b, mirrorType, aId)) {
        const mirrorRel: NamedRelationship = {
          type: mirrorType,
          targetId: aId,
          formedTurn: currentTurn,
          depth: 0,
          revealedToPlayer: false,
        };
        put({ ...b, namedRelationships: [...b.namedRelationships, mirrorRel] });
      }

      logEntries.push({
        type: 'relationship_formed',
        personId: aId,
        targetId: bId,
        relationshipType: relType,
        description: `${a.firstName} and ${b.firstName} became ${relType}s.`,
      });

      debugLog(debugSettings ?? { showAutonomyLog: false, logSchemes: false, logOpinionDeltas: false, logFactionStrength: false, logAmbitions: false, pauseOnSchemeEvent: false, skipEvents: false }, {
        turn: currentTurn,
        channel: 'autonomy',
        personId: aId,
        targetId: bId,
        message: `Named relationship formed: ${relType}`,
        data: { relType },
      });

      // Only form one new relationship per person per turn to avoid cascades.
      break;
    }
  }

  // ── Step 3: Depth growth ──────────────────────────────────────────────────
  for (const [id] of delta) {
    const person = delta.get(id)!;
    if (!person.namedRelationships.length) continue;
    const grown = person.namedRelationships.map(r => ({
      ...r,
      depth: Math.min(1, r.depth + DEPTH_GROWTH_PER_TURN),
    }));
    // Only update if any depth actually changed (avoids unnecessary writes)
    const anyGrew = grown.some((r, i) => r.depth !== person.namedRelationships[i]!.depth);
    if (anyGrew) put({ ...person, namedRelationships: grown });
  }
  // Also grow depth for people not in delta who have relationships
  for (const [id, person] of people) {
    if (delta.has(id)) continue;
    if (!person.namedRelationships.length) continue;
    const grown = person.namedRelationships.map(r => ({
      ...r,
      depth: Math.min(1, r.depth + DEPTH_GROWTH_PER_TURN),
    }));
    const anyGrew = grown.some((r, i) => r.depth !== person.namedRelationships[i]!.depth);
    if (anyGrew) put({ ...person, namedRelationships: grown });
  }

  // ── Step 4: Dissolution ───────────────────────────────────────────────────
  for (const aId of livingIds) {
    const a = resolve(aId);
    if (!a.namedRelationships.length) continue;

    const surviving: NamedRelationship[] = [];
    let anyDissolved = false;

    for (const rel of a.namedRelationships) {
      const targetExists = people.has(rel.targetId);
      if (!targetExists) {
        anyDissolved = true; // target left or died — silently dissolve
        continue;
      }

      const opinion = getEffectiveOpinion(a, rel.targetId);
      let dissolve = false;

      switch (rel.type) {
        case 'friend': {
          // Dissolves if opinion sustained below threshold for FRIEND_DISSOLVE_TURNS
          // Approximate: check current opinion only (sustained tracking is a separate mechanism)
          dissolve = opinion < FRIEND_DISSOLVE_THRESHOLD;
          break;
        }
        case 'rival': {
          dissolve = opinion > RIVAL_DISSOLVE_THRESHOLD;
          break;
        }
        case 'nemesis': {
          // Nemesis only dissolves through player choice events — never automatically
          dissolve = false;
          break;
        }
        case 'confidant': {
          dissolve = opinion < CONFIDANT_DISSOLVE_THRESHOLD;
          break;
        }
        case 'mentor': {
          const student = resolve(rel.targetId);
          const teachable = getMentorableSkill(a, student);
          if (!teachable) {
            // Student has reached 80% of mentor's skill in the relevant area
            dissolve = true;
          } else {
            dissolve = student.skills.plants >= a.skills.plants * MENTOR_DISSOLVE_STUDENT_SKILL_FRACTION &&
              student.skills.combat >= a.skills.combat * MENTOR_DISSOLVE_STUDENT_SKILL_FRACTION &&
              student.skills.bargaining >= a.skills.bargaining * MENTOR_DISSOLVE_STUDENT_SKILL_FRACTION &&
              student.skills.custom >= a.skills.custom * MENTOR_DISSOLVE_STUDENT_SKILL_FRACTION;
          }
          break;
        }
        case 'student': {
          // Student dissolves when its inverse mentor bond dissolves — checked when mentor dissolves.
          // Also dissolve if mentor no longer has mentor_hearted or wise (lost the trait).
          const mentor = resolve(rel.targetId);
          if (!mentor.traits.includes('mentor_hearted') && !mentor.traits.includes('clever')) {
            dissolve = true;
          }
          break;
        }
      }

      if (dissolve) {
        anyDissolved = true;
        const b = resolve(rel.targetId);

        // Also dissolve the mirror bond on the other person
        if (b.namedRelationships.some(r => r.targetId === aId)) {
          const mirrorType = rel.type === 'mentor' ? 'student' : rel.type === 'student' ? 'mentor' : rel.type;
          put({
            ...b,
            namedRelationships: b.namedRelationships.filter(
              r => !(r.targetId === aId && r.type === mirrorType),
            ),
          });
        }

        // Log dissolution for significant relationship types
        if (rel.type === 'friend' || rel.type === 'confidant' || rel.type === 'mentor') {
          logEntries.push({
            type: 'relationship_dissolved',
            personId: aId,
            targetId: rel.targetId,
            relationshipType: rel.type,
            description: `${a.firstName} and ${b.firstName} are no longer ${rel.type}s.`,
          });
        }
      } else {
        surviving.push(rel);
      }
    }

    if (anyDissolved) {
      put({ ...a, namedRelationships: surviving });
    }
  }

  // ── Step 5: Passive effects (depth > 0.5) ─────────────────────────────────
  // Apply passive effects from mature relationships:
  //   - mentor → student: +2/season skill transfer (applied here as a small per-turn delta)
  //   The rival ambition intensity boost is handled in ambitions.ts to keep systems decoupled.
  for (const aId of livingIds) {
    const a = resolve(aId);
    for (const rel of a.namedRelationships) {
      if (rel.type !== 'mentor' || rel.depth <= 0.5) continue;
      const student = resolve(rel.targetId);
      if (!student) continue;
      const teachable = getMentorableSkill(a, student);
      if (!teachable) continue;

      // Find which skill to boost (+2/season = +0.5/turn approx, but integer — we'll do +1 every 2 turns)
      // Simpler: grant +1 to the trainable skill every turn and let the natural cap handle it.
      const skillIds = ['animals', 'bargaining', 'combat', 'custom', 'leadership', 'plants'] as const;
      let boostedSkill: typeof skillIds[number] | null = null;
      for (const id of skillIds) {
        if (a.skills[id] >= MENTOR_MIN_SKILL && student.skills[id] < MENTOR_STUDENT_SKILL_MAX + 10) {
          boostedSkill = id;
          break;
        }
      }
      if (boostedSkill) {
        const updatedStudent: Person = {
          ...student,
          skills: {
            ...student.skills,
            [boostedSkill]: clamp(student.skills[boostedSkill] + 1, 1, 100),
          },
        };
        put(updatedStudent);
      }
    }
  }

  // Suppress unused import warnings — rng is available for future tiebreakers
  void rng;

  return { updatedPeople: delta, logEntries };
}

// ─── Passive effect helpers (used externally) ─────────────────────────────────

/**
 * Returns true if person A is in a 'nemesis' relationship with person B.
 * Used by the actor-resolver to exclude nemesis pairs from shared event slots.
 */
export function areNemeses(a: Person, b: Person): boolean {
  return a.namedRelationships.some(r => r.type === 'nemesis' && r.targetId === b.id);
}

/**
 * Returns true if person is in any relationship of the given type toward anyone.
 * Used by event prerequisites.
 */
export function hasAnyNamedRelationship(
  people: Map<string, Person>,
  type: NamedRelationshipType,
): boolean {
  for (const person of people.values()) {
    if (person.namedRelationships.some(r => r.type === type)) return true;
  }
  return false;
}

// ─── Founding relationship seeding ───────────────────────────────────────────

/**
 * Seeds pre-formed named relationships for the founding group at game start.
 *
 * Normal relationship formation requires opinions to be sustained above a threshold
 * for several turns. The founding colonists have already shared a long
 * Company-sponsored journey — they know each other. This function applies a
 * one-time, sustain-bypass pass to seed friendships, rivalries, confidants, and
 * mentor bonds that reflect that shared history.
 *
 * Rules:
 *  - At most 2 named relationships per person.
 *  - Candidates are ranked by significance; most impactful pairs are assigned first.
 *  - Confidant formation bypasses the co-event-count requirement (shared journey counts).
 *  - Each seeded relationship starts at depth ~0.30–0.45 (~15–22 turns of organic growth).
 *  - opinionSustainedSince is pre-populated for extreme-opinion pairs so the normal
 *    per-turn engine treats them as already past the sustain gate on turn 1.
 *
 * Pure function — returns a new Map with updated persons; no side effects.
 */
export function seedFoundingRelationships(
  people: Map<string, Person>,
  rng: SeededRNG,
): Map<string, Person> {
  const MAX_STARTING_RELS = 2;

  // Working copy so we can accumulate mutations across both steps.
  const delta = new Map<string, Person>(people);

  function resolve(id: string): Person {
    return delta.get(id)!;
  }
  function put(person: Person): void {
    delta.set(person.id, person);
  }

  const livingAdults = Array.from(people.values()).filter(p => p.age >= 14);

  // ── Step 1: Collect candidates ──────────────────────────────────────────────
  type Candidate = {
    /** Person who receives relType. */
    aId: string;
    /** Person who receives mirrorType. */
    bId: string;
    relType: NamedRelationshipType;
    mirrorType: NamedRelationshipType;
    /** Higher = forms first when greedy-assigning. */
    significance: number;
  };

  const candidates: Candidate[] = [];

  for (let i = 0; i < livingAdults.length; i++) {
    const a = livingAdults[i]!;
    for (let j = i + 1; j < livingAdults.length; j++) {
      const b = livingAdults[j]!;
      const opinionAB = getEffectiveOpinion(a, b.id);
      const opinionBA = getEffectiveOpinion(b, a.id);
      const avgOpinion = (opinionAB + opinionBA) / 2;

      // Nemesis — profound enmity (highest priority)
      if (avgOpinion <= NEMESIS_OPINION_THRESHOLD) {
        candidates.push({
          aId: a.id, bId: b.id,
          relType: 'nemesis', mirrorType: 'nemesis',
          significance: Math.abs(avgOpinion) + 100,
        });
        continue;
      }

      // Rival — competing power ambitions (no opinion threshold needed)
      if (
        a.ambition && b.ambition &&
        (a.ambition.type === 'seek_council' || a.ambition.type === 'seek_seniority') &&
        (b.ambition.type === 'seek_council' || b.ambition.type === 'seek_seniority')
      ) {
        candidates.push({
          aId: a.id, bId: b.id,
          relType: 'rival', mirrorType: 'rival',
          significance: 90 + Math.abs(avgOpinion),
        });
        continue;
      }

      // Rival — sustained low opinion
      if (avgOpinion <= RIVAL_OPINION_THRESHOLD) {
        candidates.push({
          aId: a.id, bId: b.id,
          relType: 'rival', mirrorType: 'rival',
          significance: Math.abs(avgOpinion) + 50,
        });
        continue;
      }

      // Friend — sustained warm regard
      if (avgOpinion >= FRIEND_OPINION_THRESHOLD) {
        candidates.push({
          aId: a.id, bId: b.id,
          relType: 'friend', mirrorType: 'friend',
          significance: avgOpinion + 30,
        });
        continue;
      }

      // Confidant — relaxed: no co-event count check at founding; shared journey counts
      if (
        avgOpinion >= CONFIDANT_OPINION_THRESHOLD &&
        (a.heritage.primaryCulture === b.heritage.primaryCulture || a.religion === b.religion)
      ) {
        candidates.push({
          aId: a.id, bId: b.id,
          relType: 'confidant', mirrorType: 'confidant',
          significance: avgOpinion + 20,
        });
        continue;
      }

      // Mentor/Student — A is the older, skilled mentor
      if (
        a.age - b.age >= MENTOR_AGE_DIFF &&
        b.age <= MENTOR_STUDENT_MAX_AGE &&
        (a.traits.includes('mentor_hearted') || a.traits.includes('clever')) &&
        shareLanguage(a, b, MENTOR_LANGUAGE_FLUENCY) &&
        getMentorableSkill(a, b) !== null
      ) {
        candidates.push({
          aId: a.id, bId: b.id,
          relType: 'mentor', mirrorType: 'student',
          significance: 40 + (a.age - b.age),
        });
        continue;
      }

      // Mentor/Student — B is the older, skilled mentor
      if (
        b.age - a.age >= MENTOR_AGE_DIFF &&
        a.age <= MENTOR_STUDENT_MAX_AGE &&
        (b.traits.includes('mentor_hearted') || b.traits.includes('clever')) &&
        shareLanguage(b, a, MENTOR_LANGUAGE_FLUENCY) &&
        getMentorableSkill(b, a) !== null
      ) {
        candidates.push({
          aId: b.id, bId: a.id,
          relType: 'mentor', mirrorType: 'student',
          significance: 40 + (b.age - a.age),
        });
      }
    }
  }

  // Sort candidates by significance descending — most impactful bonds form first.
  candidates.sort((x, y) => y.significance - x.significance);

  // ── Step 2: Greedy assignment ───────────────────────────────────────────────
  const relCount = new Map<string, number>();

  for (const { aId, bId, relType, mirrorType } of candidates) {
    const aCount = relCount.get(aId) ?? 0;
    const bCount = relCount.get(bId) ?? 0;
    if (aCount >= MAX_STARTING_RELS || bCount >= MAX_STARTING_RELS) continue;

    const a = resolve(aId);
    const b = resolve(bId);
    if (hasRelationshipTo(a, relType, bId)) continue;
    if (hasRelationshipTo(b, mirrorType, aId)) continue;

    // Starting depth reflects shared history (~15–22 turns of organic growth equivalent).
    const depth = clamp(rng.gaussian(0.35, 0.08), 0.10, 0.55);

    put({
      ...a,
      namedRelationships: [
        ...a.namedRelationships,
        { type: relType, targetId: bId, formedTurn: 0, depth, revealedToPlayer: false },
      ],
    });
    put({
      ...b,
      namedRelationships: [
        ...b.namedRelationships,
        { type: mirrorType, targetId: aId, formedTurn: 0, depth, revealedToPlayer: false },
      ],
    });

    relCount.set(aId, aCount + 1);
    relCount.set(bId, bCount + 1);
  }

  // ── Step 3: Pre-populate opinionSustainedSince ─────────────────────────────
  // Mark extreme-opinion pairs as "sustained since turn 0" so the regular per-turn
  // engine can form additional relationships on the very first dawn without waiting.
  for (const [id] of delta) {
    const person = resolve(id);
    const newSustained: Partial<Record<string, number>> = { ...(person.opinionSustainedSince ?? {}) };
    let changed = false;

    for (const [otherId] of delta) {
      if (id === otherId) continue;
      const opinion = getEffectiveOpinion(person, otherId);
      const isExtreme = opinion >= FRIEND_OPINION_THRESHOLD || opinion <= RIVAL_OPINION_THRESHOLD;
      if (isExtreme && newSustained[otherId] === undefined) {
        newSustained[otherId] = 0;
        changed = true;
      }
    }

    if (changed) {
      put({ ...resolve(id), opinionSustainedSince: newSustained });
    }
  }

  return delta;
}
