/**
 * Scheme Engine — System B of Phase 4.0.
 *
 * Every character with a strong enough personality trait quietly pursues a private project.
 * Some resolve without anyone noticing (silent outcomes). Others surface as player-facing
 * events when they reach their conclusion.
 *
 * Five scheme types:
 *   scheme_court_person     — romantic pursuit; fires courtship event at 1.0
 *   scheme_convert_faith    — religious advocacy; fires conversion event at 1.0
 *   scheme_befriend_person  — social bonding; SILENT friend bond forms at 1.0
 *   scheme_undermine_person — social sabotage; fires undermining event at 1.0
 *   scheme_tutor_person     — mentoring focus; SILENT skill boost + breakthrough notification
 *
 * Pure TypeScript — no React imports, no Math.random().
 * All randomness through the seeded RNG passed in by the caller.
 */

import type { Person, PersonScheme, SchemeType, SkillId } from '../population/person';
import type { NamedRelationshipType } from '../population/person';
import { getEffectiveOpinion } from '../population/opinions';
import { SAUROMATIAN_CULTURE_IDS } from '../population/culture';
import type { SeededRNG } from '../../utils/rng';
import { clamp } from '../../utils/math';
import { debugLog } from '../../utils/debug-logger';
import type { DebugSettings } from '../turn/game-state';

// ─── Constants ────────────────────────────────────────────────────────────────

const SCHEME_GENERATE_INTERVAL = 12; // turns; only generate if no active scheme

// Progress rates per turn
const PROGRESS_RATE: Record<SchemeType, number> = {
  scheme_befriend_person:  0.05,
  scheme_tutor_person:     0.03,
  scheme_court_person:     0.04, // multiplied by opinion_factor below
  scheme_convert_faith:    0.025,
  scheme_undermine_person: 0.04,
  scheme_build_dwelling:   0.01, // 100-turn long-range project
};

// Intermediate event progress thresholds
const FAITH_ADVOCACY_NOTICED_PROGRESS = 0.45;
const RUMOURS_SPREADING_PROGRESS = 0.50;

// Opinion thresholds for scheme generation
const COURT_OPINION_MIN   = 50;
const CONVERT_OPINION_MIN = 30;
const BEFRIEND_OPINION_MIN = 40;

// ─── Scheme Context (optional extra state for schemes that need world knowledge) ──────

export interface SchemeContext {
  /** Household map — used to check if person's household already has a dwelling. */
  households?: Map<string, { dwellingBuildingId: string | null; productionBuildingIds: string[] }>;
  /** Current in-game year — dwelling schemes only start after year 2. */
  currentYear?: number;
  /** Settlement resources — check lumber availability before dwelling scheme. */
  settlementLumber?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hasTrait(person: Person, ...traits: string[]): boolean {
  return traits.some(t => person.traits.includes(t as never));
}

function hasRelType(person: Person, type: NamedRelationshipType): boolean {
  return person.namedRelationships.some(r => r.type === type);
}

function hasRelTypeTo(person: Person, type: NamedRelationshipType, targetId: string): boolean {
  return person.namedRelationships.some(r => r.type === type && r.targetId === targetId);
}

/** Returns candidates from `people` whose effective opinion toward `schemer` meets the threshold. */
function candidatesWithOpinion(
  schemer: Person,
  people: Map<string, Person>,
  minOpinion: number,
): Person[] {
  const result: Person[] = [];
  for (const [id, other] of people) {
    if (id === schemer.id) continue;
    if (getEffectiveOpinion(schemer, id) >= minOpinion) {
      result.push(other);
    }
  }
  return result;
}

/** Pick target with highest effective opinion. Uses RNG only as tiebreaker. */
function pickBestTarget(
  schemer: Person,
  candidates: Person[],
  rng: SeededRNG,
): Person | null {
  if (candidates.length === 0) return null;
  let best = candidates[0]!;
  let bestOp = getEffectiveOpinion(schemer, best.id);
  for (let i = 1; i < candidates.length; i++) {
    const c = candidates[i]!;
    const op = getEffectiveOpinion(schemer, c.id);
    if (op > bestOp || (op === bestOp && rng.next() < 0.5)) {
      best = c;
      bestOp = op;
    }
  }
  return best;
}

/**
 * Returns a progress-rate multiplier based on the schemer's effective opinion
 * of their target.
 *
 * Social schemes (court / befriend / tutor): higher opinion → faster progress.
 * Undermine: lower opinion (more hatred) → faster progress (inverted).
 * Faith conversion and dwelling: opinion-independent (1.0×).
 *
 * Range: [0.5, 1.5] — never stalls a scheme completely, never doubles uncapped.
 */
function schemeOpinionFactor(
  type: SchemeType,
  person: Person,
  target: Person | undefined,
): number {
  if (!target) return 1.0;
  const opinion = getEffectiveOpinion(person, target.id);
  switch (type) {
    case 'scheme_court_person':
    case 'scheme_befriend_person':
    case 'scheme_tutor_person':
      // Positive opinion → faster progress (warmth, openness, rapport accelerate bonds)
      return clamp(1.0 + opinion / 200, 0.5, 1.5);
    case 'scheme_undermine_person':
      // Negative opinion → faster progress (hatred is its own motivation)
      return clamp(1.0 + (-opinion) / 200, 0.5, 1.5);
    case 'scheme_convert_faith':
    case 'scheme_build_dwelling':
      // Driven by conviction / practical need, not interpersonal feeling
      return 1.0;
  }
}

/** Pick target with lowest effective opinion. Uses RNG only as tiebreaker. */
function pickWorstTarget(
  schemer: Person,
  candidates: Person[],
  rng: SeededRNG,
): Person | null {
  if (candidates.length === 0) return null;
  let worst = candidates[0]!;
  let worstOp = getEffectiveOpinion(schemer, worst.id);
  for (let i = 1; i < candidates.length; i++) {
    const op = getEffectiveOpinion(schemer, candidates[i]!.id);
    if (op < worstOp || (op === worstOp && rng.next() < 0.5)) {
      worst = candidates[i]!;
      worstOp = op;
    }
  }
  return worst;
}

// ─── Scheme Generation ────────────────────────────────────────────────────────

/**
 * Attempts to generate a new scheme for `person`. Called every SCHEME_GENERATE_INTERVAL
 * turns per person when `activeScheme === null`.
 *
 * Returns a new `PersonScheme` or null if no scheme applies.
 */
export function generateScheme(
  person: Person,
  people: Map<string, Person>,
  currentTurn: number,
  rng: SeededRNG,
  context?: SchemeContext,
): PersonScheme | null {
  // 1a. scheme_court_person (Sauromatian women) — active seek_companion ambition unlocks
  //     courtship scheme at a lower opinion threshold (25 vs 50).
  if (
    person.sex === 'female' &&
    SAUROMATIAN_CULTURE_IDS.has(person.heritage.primaryCulture) &&
    person.spouseIds.length === 0 &&
    person.ambition?.type === 'seek_companion'
  ) {
    const candidates = candidatesWithOpinion(person, people, 25)
      .filter(c => c.sex === 'male' && c.spouseIds.length === 0);
    const target = pickBestTarget(person, candidates, rng);
    if (target) {
      return { type: 'scheme_court_person', targetId: target.id, progress: 0, startedTurn: currentTurn, revealedToPlayer: false };
    }
  }

  // 1. scheme_court_person — passionate or romantic; unmarried; opinion ≥ 50 for a target
  if (hasTrait(person, 'passionate', 'romantic') && person.spouseIds.length === 0) {
    const candidates = candidatesWithOpinion(person, people, COURT_OPINION_MIN)
      .filter(c => c.sex !== person.sex || true) // any eligible target
      .filter(c => c.sex !== person.sex);        // typical: opposite sex
    const target = pickBestTarget(person, candidates, rng);
    if (target) {
      return { type: 'scheme_court_person', targetId: target.id, progress: 0, startedTurn: currentTurn, revealedToPlayer: false };
    }
  }

  // 2. scheme_convert_faith — zealous or pious; target of different faith with opinion ≥ 30
  if (hasTrait(person, 'zealous', 'pious')) {
    const candidates = candidatesWithOpinion(person, people, CONVERT_OPINION_MIN)
      .filter(c => c.religion !== person.religion);
    const target = pickBestTarget(person, candidates, rng);
    if (target) {
      return { type: 'scheme_convert_faith', targetId: target.id, progress: 0, startedTurn: currentTurn, revealedToPlayer: false };
    }
  }

  // 3. scheme_befriend_person — gregarious or lonely; no existing friend; opinion ≥ 40
  if (hasTrait(person, 'gregarious', 'lonely') && !hasRelType(person, 'friend')) {
    const candidates = candidatesWithOpinion(person, people, BEFRIEND_OPINION_MIN)
      .filter(c => !hasRelTypeTo(person, 'friend', c.id));
    const target = pickBestTarget(person, candidates, rng);
    if (target) {
      return { type: 'scheme_befriend_person', targetId: target.id, progress: 0, startedTurn: currentTurn, revealedToPlayer: false };
    }
  }

  // 3.5. scheme_undermine_person (nemesis path) — a nemesis is sufficient motivation even without
  //      a jealous/ambitious trait.  Fires before the trait-gated check so the most hostile
  //      relationship always drives the most hostile scheme.
  {
    const nemesisEntry = person.namedRelationships.find(r => r.type === 'nemesis');
    if (nemesisEntry) {
      return { type: 'scheme_undermine_person', targetId: nemesisEntry.targetId, progress: 0, startedTurn: currentTurn, revealedToPlayer: false };
    }
  }

  // 4. scheme_undermine_person — jealous or ambitious; has a rival OR a competing ambition.
  //    Confidant loyalty suppresses schemes against the confidant — trust overrides rivalry.
  if (hasTrait(person, 'jealous', 'ambitious')) {
    const rivalEntry = person.namedRelationships.find(r => r.type === 'rival');
    if (rivalEntry && !hasRelTypeTo(person, 'confidant', rivalEntry.targetId)) {
      // Undermine the rival (skipped when the rival is also a confidant)
      return { type: 'scheme_undermine_person', targetId: rivalEntry.targetId, progress: 0, startedTurn: currentTurn, revealedToPlayer: false };
    }
    // Also check for competing ambition: someone else has the same ambition type
    if (person.ambition) {
      const competingAmb = person.ambition.type;
      const competitors = Array.from(people.values()).filter(
        c => c.id !== person.id && c.ambition?.type === competingAmb,
      );
      if (competitors.length > 0) {
        const target = pickWorstTarget(person, competitors, rng);
        if (target) {
          return { type: 'scheme_undermine_person', targetId: target.id, progress: 0, startedTurn: currentTurn, revealedToPlayer: false };
        }
      }
    }
  }

  // 5. scheme_tutor_person — a named mentor relationship is sufficient to generate this scheme;
  //    the mentor_hearted trait is no longer required (though it still boosts progress via the
  //    opinion factor).  Anyone who has formally become a mentor should invest in their student.
  {
    const mentorRel = person.namedRelationships.find(r => r.type === 'mentor');
    if (mentorRel) {
      return { type: 'scheme_tutor_person', targetId: mentorRel.targetId, progress: 0, startedTurn: currentTurn, revealedToPlayer: false };
    }
  }

  // 6. scheme_build_dwelling — proud or ambitious; adult; household has no home yet
  if (
    !hasTrait(person, 'content') &&
    hasTrait(person, 'proud', 'ambitious') &&
    person.age >= 18 &&
    person.householdId !== null &&
    (context?.currentYear ?? 0) >= 2 &&
    (context?.settlementLumber ?? 0) >= 10
  ) {
    const household = context?.households?.get(person.householdId);
    if (household && household.dwellingBuildingId === null) {
      // Use person.id as target (self-scheme — no external target)
      return { type: 'scheme_build_dwelling', targetId: person.id, progress: 0, startedTurn: currentTurn, revealedToPlayer: false };
    }
  }

  return null;
}

// ─── Scheme processing ────────────────────────────────────────────────────────

/** Events that should fire this turn as a result of scheme progress. */
export interface SchemePendingEvent {
  eventId: string;
  personId: string;  // schemer
  targetId: string;  // scheme target
}

export interface SchemeProcessResult {
  /** Delta map — only persons whose scheme changed. */
  updatedPeople: Map<string, Person>;
  /** Events that should be injected into the pending event queue. */
  pendingSchemeEvents: SchemePendingEvent[];
  /** Activity log entries from this pass. */
  logEntries: Array<{
    type: 'scheme_started' | 'scheme_succeeded' | 'scheme_failed';
    personId: string;
    targetId: string;
    description: string;
  }>;
}

/**
 * Advances all active schemes by one turn. Resolves or fails schemes that
 * reach 1.0 (or whose conditions are no longer met). Returns a delta map.
 *
 * Called each dawn at step 8.93.
 */
export function processSchemes(
  people: Map<string, Person>,
  currentTurn: number,
  rng: SeededRNG,
  debugSettings?: DebugSettings,
  context?: SchemeContext,
): SchemeProcessResult {
  const updatedPeople = new Map<string, Person>();
  const pendingSchemeEvents: SchemePendingEvent[] = [];
  const logEntries: SchemeProcessResult['logEntries'] = [];

  // Phase A: generate new schemes (every SCHEME_GENERATE_INTERVAL turns per person)
  if (currentTurn % SCHEME_GENERATE_INTERVAL === 0) {
    for (const [id, person] of people) {
      if (person.activeScheme !== null) continue;
      const newScheme = generateScheme(person, people, currentTurn, rng, context);
      if (newScheme) {
        const updated = updatedPeople.get(id) ?? person;
        updatedPeople.set(id, { ...updated, activeScheme: newScheme });
        debugLog(debugSettings ?? { showAutonomyLog: false, logSchemes: false, logOpinionDeltas: false, logFactionStrength: false, logAmbitions: false, pauseOnSchemeEvent: false, skipEvents: false }, {
          turn: currentTurn,
          channel: 'schemes',
          personId: id,
          message: `[Scheme] ${person.firstName} started ${newScheme.type} → ${newScheme.targetId}`,
        });
        logEntries.push({
          type: 'scheme_started',
          personId: id,
          targetId: newScheme.targetId,
          description: `${person.firstName} began quietly ${schemeLabel(newScheme.type)} ${nameOf(people, newScheme.targetId)}.`,
        });
      }
    }
  }

  // Phase B: advance progress and resolve
  for (const [id, basePerson] of people) {
    const person = updatedPeople.get(id) ?? basePerson;
    if (!person.activeScheme) continue;

    const scheme = person.activeScheme;
    const target = people.get(scheme.targetId);

    // --- Failure conditions ---
    const failed = resolveFailureCondition(person, scheme, target, people);
    if (failed) {
      const updated = { ...person, activeScheme: null };
      updatedPeople.set(id, updated);
      logEntries.push({
        type: 'scheme_failed',
        personId: id,
        targetId: scheme.targetId,
        description: `${person.firstName}'s ${schemeLabel(scheme.type)} scheme toward ${nameOf(people, scheme.targetId)} collapsed.`,
      });
      continue;
    }

    // --- Progress advance ---
    let progressRate = PROGRESS_RATE[scheme.type];
    // Opinion-scaled progress: positive opinion accelerates social schemes; hatred accelerates
    // undermining; religious conviction and construction are unaffected.
    progressRate *= schemeOpinionFactor(scheme.type, person, target);
    const prevProgress = scheme.progress;
    const newProgress = Math.min(1.0, prevProgress + progressRate);

    // --- Intermediate events ---
    if (scheme.type === 'scheme_convert_faith' &&
        prevProgress < FAITH_ADVOCACY_NOTICED_PROGRESS &&
        newProgress >= FAITH_ADVOCACY_NOTICED_PROGRESS) {
      pendingSchemeEvents.push({ eventId: 'sch_faith_advocacy_noticed', personId: id, targetId: scheme.targetId });
    }
    if (scheme.type === 'scheme_undermine_person' &&
        prevProgress < RUMOURS_SPREADING_PROGRESS &&
        newProgress >= RUMOURS_SPREADING_PROGRESS) {
      pendingSchemeEvents.push({ eventId: 'sch_rumours_spreading', personId: id, targetId: scheme.targetId });
    }

    // --- Completion at 1.0 ---
    if (newProgress >= 1.0) {
      const { updatedPerson, eventId, silent } = resolveSchemeCompletion(person, scheme, target, people, rng);
      updatedPeople.set(id, { ...updatedPerson, activeScheme: null });
      if (eventId) {
        pendingSchemeEvents.push({ eventId, personId: id, targetId: scheme.targetId });
      }
      if (silent) {
        logEntries.push({
          type: 'scheme_succeeded',
          personId: id,
          targetId: scheme.targetId,
          description: `${person.firstName}'s quiet ${schemeLabel(scheme.type)} scheme toward ${nameOf(people, scheme.targetId)} succeeded.`,
        });
      }
      continue;
    }

    // --- Mark intermediate scheme event fires as revealed ---
    let revealed = scheme.revealedToPlayer;
    if (pendingSchemeEvents.some(e => e.personId === id)) {
      revealed = true;
    }

    const updatedScheme: PersonScheme = { ...scheme, progress: newProgress, revealedToPlayer: revealed };
    updatedPeople.set(id, { ...person, activeScheme: updatedScheme });
  }

  return { updatedPeople, pendingSchemeEvents, logEntries };
}

// ─── Completion resolution ────────────────────────────────────────────────────

interface CompletionResult {
  updatedPerson: Person;
  eventId: string | null;
  silent: boolean;
}

function resolveSchemeCompletion(
  person: Person,
  scheme: PersonScheme,
  target: Person | undefined,
  _people: Map<string, Person>,
  _rng: SeededRNG,
): CompletionResult {
  switch (scheme.type) {
    case 'scheme_befriend_person': {
      // SILENT: immediately form a friend named relationship
      // (The named-relationships engine will pick it up as already existing next turn)
      const friendRel = {
        type: 'friend' as NamedRelationshipType,
        targetId: scheme.targetId,
        formedTurn: scheme.startedTurn,
        depth: 0.1,
        revealedToPlayer: false,
      };
      const existingRels = person.namedRelationships.filter(
        r => !(r.type === 'friend' && r.targetId === scheme.targetId),
      );
      return {
        updatedPerson: { ...person, namedRelationships: [...existingRels, friendRel] },
        eventId: null,
        silent: true,
      };
    }

    case 'scheme_tutor_person': {
      // SILENT: +4 one-time skill boost to the target's most-trained skill
      // then fire a notification event
      const boostedTarget = applyTutorBoost(person, target, _people);
      if (boostedTarget) {
        _people.set(boostedTarget.id, boostedTarget); // mutate local view for notification
      }
      return {
        updatedPerson: { ...person, activeScheme: { ...scheme, revealedToPlayer: true } },
        eventId: 'sch_tutor_breakthrough',
        silent: false,
      };
    }

    case 'scheme_court_person': {
      const isSauro = SAUROMATIAN_CULTURE_IDS.has(person.heritage.primaryCulture);
      return {
        updatedPerson: { ...person, activeScheme: { ...scheme, revealedToPlayer: true } },
        eventId: isSauro ? 'sch_sauro_courtship_open' : 'sch_courtship_discovered',
        silent: false,
      };
    }

    case 'scheme_convert_faith':
      return {
        updatedPerson: { ...person, activeScheme: { ...scheme, revealedToPlayer: true } },
        eventId: 'sch_conversion_complete',
        silent: false,
      };

    case 'scheme_undermine_person':
      return {
        updatedPerson: { ...person, activeScheme: { ...scheme, revealedToPlayer: true } },
        eventId: 'sch_undermining_climax',
        silent: false,
      };

    case 'scheme_build_dwelling':
      // SILENT: fires an activity log entry; the player is notified but no
      // event card is shown — a separate dwelling-request event can be wired later.
      return {
        updatedPerson: person,
        eventId: null,
        silent: true,
      };
  }
}

/** Applies a +4 boost to the student's relevant skill (the one the mentor is strongest in). */
function applyTutorBoost(mentor: Person, student: Person | undefined, _people: Map<string, Person>): Person | null {
  if (!student) return null;
  // Find the skill where mentor is strongest
  const skillIds: SkillId[] = ['animals', 'bargaining', 'combat', 'custom', 'leadership', 'plants'];
  let bestSkill: SkillId = 'custom';
  let bestVal = 0;
  for (const sk of skillIds) {
    if (mentor.skills[sk] > bestVal) { bestVal = mentor.skills[sk]; bestSkill = sk; }
  }
  const boosted = Math.min(100, student.skills[bestSkill] + 4);
  return { ...student, skills: { ...student.skills, [bestSkill]: boosted } };
}

// ─── Failure condition checks ─────────────────────────────────────────────────

function resolveFailureCondition(
  person: Person,
  scheme: PersonScheme,
  target: Person | undefined,
  _people: Map<string, Person>,
): boolean {
  // Self-schemes never fail due to missing target.
  if (scheme.type === 'scheme_build_dwelling') return false;
  if (!target) return true; // target left the settlement

  switch (scheme.type) {
    case 'scheme_befriend_person':
      return getEffectiveOpinion(person, target.id) < 0;

    case 'scheme_tutor_person': {
      // Fails if the student no longer has a student relationship with this schemer
      const stillMentor = person.namedRelationships.some(r => r.type === 'mentor' && r.targetId === target.id);
      return !stillMentor;
    }

    case 'scheme_court_person':
      // Fails if target opinion drops < -10 or target married someone else
      if (getEffectiveOpinion(person, target.id) < -10) return true;
      if (target.spouseIds.length > 0) return true;
      return false;

    case 'scheme_convert_faith': {
      // Fails if policy becomes orthodox_enforced (checked externally via state) —
      // we don't have access to settlement here, so we only check target gone
      // (policy check is handled at injection time in the store)
      return false;
    }

    case 'scheme_undermine_person': {
      // Fails if instigator gains respected_elder or target's opinion rises above +20
      if (person.traits.includes('respected_elder' as never)) return true;
      if (getEffectiveOpinion(person, target.id) > 20) return true;
      return false;
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nameOf(people: Map<string, Person>, id: string): string {
  return people.get(id)?.firstName ?? '(unknown)';
}

function schemeLabel(type: SchemeType): string {
  switch (type) {
    case 'scheme_court_person':     return 'courting';
    case 'scheme_convert_faith':    return 'faith-advocacy';
    case 'scheme_befriend_person':  return 'befriending';
    case 'scheme_undermine_person': return 'undermining';
    case 'scheme_tutor_person':     return 'tutoring';
    case 'scheme_build_dwelling':   return 'planning a homestead';
  }
}
