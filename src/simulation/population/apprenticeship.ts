/**
 * Apprenticeship system — trade training for young settlers.
 *
 * A skilled worker (master) can take on an apprentice from their children
 * or anyone who holds a 'student' named relationship with them. The apprentice
 * learns the master's trade over several years and gains a lasting production
 * bonus for that role upon graduation.
 *
 * Design:
 *   - Masters need at least "Good" skill in their trade (score ≥ 26).
 *   - Apprentices must be age 10–20; masters must be age 16+.
 *   - Progress rate: 0.04/turn (base) × skill/trait modifiers.
 *   - Completion bonus: 5–27% depending on master's skill tier.
 *   - Per-role cap: MAX_TRADE_TRAINING = 30%.
 *   - Each master may have at most ONE active apprentice at a time.
 *
 * Pure TypeScript — no React imports, no Math.random().
 * All randomness flows through the seeded RNG passed by the caller.
 */

import type { Person, WorkRole, SkillId } from './person';
import { getSkillRating } from './person';
import type { SeededRNG } from '../../utils/rng';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Roles for which trade apprenticeship is meaningful. */
export const TRAINABLE_TRADES = new Set<WorkRole>([
  'farmer',
  'gather_food',
  'gather_stone',
  'gather_lumber',
  'blacksmith',
  'tailor',
  'brewer',
  'miller',
  'herder',
  'healer',
  'hunter',
  'trader',
  'craftsman',
]);

/** Maximum production bonus a person can accumulate per role (%). */
export const MAX_TRADE_TRAINING = 30;

/** Base progress advance per turn. */
const BASE_PROGRESS_RATE = 0.04; // ~25 turns ≈ 6.25 in-game years

/** Turns between formation-check sweeps. */
const APPRENTICESHIP_CHECK_INTERVAL = 8;

/** Minimum master skill value to accept an apprentice (Good tier). */
const MIN_MASTER_SKILL = 26;

const MIN_MASTER_AGE    = 16;
const MIN_APPRENTICE_AGE = 10;
const MAX_APPRENTICE_AGE = 20;
/** Age grace period beyond MAX_APPRENTICE_AGE before the apprenticeship is forcibly ended. */
const APPRENTICE_AGE_GRACE = 2;

// ─── Skill mapping ────────────────────────────────────────────────────────────

/**
 * Returns the base SkillId that governs mastery of a trade role.
 * Used to gauge the master's competence and to apply skill-based progress bonuses.
 */
export function getTradeSkill(role: WorkRole): SkillId {
  switch (role) {
    case 'farmer':
    case 'gather_food':
    case 'healer':
      return 'plants';
    case 'herder':
      return 'animals';
    case 'hunter':
      return 'combat';
    case 'trader':
      return 'bargaining';
    case 'guard':
      return 'combat';
    default:
      // gather_stone, gather_lumber, blacksmith, tailor, brewer, miller, craftsman
      return 'custom';
  }
}

// ─── Progress rate ────────────────────────────────────────────────────────────

/**
 * Returns the per-turn progress advance for a given master.
 * Higher skill and the mentor_hearted trait accelerate the training.
 */
export function getMasterProgressRate(master: Person): number {
  const skill = master.skills[getTradeSkill(master.role)];
  const rating = getSkillRating(skill);

  let rate = BASE_PROGRESS_RATE;
  if (rating === 'excellent') rate *= 1.25;
  else if (rating === 'renowned') rate *= 1.50;
  else if (rating === 'heroic')   rate *= 1.75;

  if (master.traits.includes('mentor_hearted')) rate *= 1.25;

  return rate;
}

// ─── Completion bonus ─────────────────────────────────────────────────────────

/** Production bonus (%) awarded to the graduate based on the master's skill tier at completion. */
const COMPLETION_BONUS_BY_RATING: Record<ReturnType<typeof getSkillRating>, number> = {
  fair:       5,
  good:       8,
  very_good:  12,
  excellent:  17,
  renowned:   22,
  heroic:     27,
};

/** Compute the production bonus to award a graduate based on their master's trade skill. */
export function computeCompletionBonus(master: Person): number {
  const skill = master.skills[getTradeSkill(master.role)];
  return COMPLETION_BONUS_BY_RATING[getSkillRating(skill)];
}

// ─── Result types ─────────────────────────────────────────────────────────────

export interface ApprenticeshipPendingEvent {
  eventId: string;
  masterId: string;
  apprenticeId: string;
}

export interface ApprenticeshipLogEntry {
  type: 'apprenticeship_started' | 'apprenticeship_completed' | 'apprenticeship_ended';
  personId: string;
  targetId: string;
  description: string;
}

export interface ApprenticeshipProcessResult {
  /** Delta map — only persons whose apprenticeship state changed. */
  updatedPeople: Map<string, Person>;
  /** Events to inject into the pending event queue this dawn. */
  pendingApprenticeshipEvents: ApprenticeshipPendingEvent[];
  /** Activity log entries for this pass. */
  logEntries: ApprenticeshipLogEntry[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function nameOf(people: Map<string, Person>, id: string): string {
  return people.get(id)?.firstName ?? 'Unknown';
}

/**
 * Returns true if any person in the combined map (updates over base) is currently
 * apprenticed to `masterId`.
 */
function masterHasApprentice(
  masterId: string,
  people: Map<string, Person>,
  updatedPeople: Map<string, Person>,
): boolean {
  for (const [id, base] of people) {
    const current = updatedPeople.get(id) ?? base;
    if (current.apprenticeship?.masterId === masterId) return true;
  }
  return false;
}

// ─── Core processor ───────────────────────────────────────────────────────────

/**
 * Processes trade apprenticeships each dawn.
 *
 * Phase A — Cleanup: remove stale apprenticeships (master gone / changed roles /
 *   apprentice aged out).
 * Phase B — Progress: advance all valid apprenticeships; complete at 1.0 and award
 *   the tradeTraining bonus.
 * Phase C — Formation: every APPRENTICESHIP_CHECK_INTERVAL turns, scan for
 *   master-candidate pairs and create new apprenticeships.
 *
 * Returns a delta map (only changed persons), pending events, and log entries.
 * Called at step 8.94 of processDawn().
 */
export function processApprenticeships(
  people: Map<string, Person>,
  currentTurn: number,
  rng: SeededRNG,
): ApprenticeshipProcessResult {
  const updatedPeople  = new Map<string, Person>();
  const pendingApprenticeshipEvents: ApprenticeshipPendingEvent[] = [];
  const logEntries: ApprenticeshipLogEntry[] = [];

  // ─── Phase A: Clean up stale apprenticeships ───────────────────────────────
  for (const [id, person] of people) {
    if (!person.apprenticeship) continue;
    const { masterId, trade } = person.apprenticeship;
    const master = people.get(masterId);

    const masterGone         = !master;
    const masterChangedRole  = master ? master.role !== trade : false;
    const agedOut            = person.age > MAX_APPRENTICE_AGE + APPRENTICE_AGE_GRACE;

    if (masterGone || masterChangedRole || agedOut) {
      updatedPeople.set(id, { ...person, apprenticeship: null });
      logEntries.push({
        type: 'apprenticeship_ended',
        personId: id,
        targetId: masterId,
        description: `**${person.firstName}**'s apprenticeship under ${nameOf(people, masterId)} ended.`,
      });
    }
  }

  // ─── Phase B: Advance progress ─────────────────────────────────────────────
  for (const [id, basePerson] of people) {
    const person = updatedPeople.get(id) ?? basePerson;
    if (!person.apprenticeship) continue;

    const { masterId, trade, progress } = person.apprenticeship;
    const master = updatedPeople.get(masterId) ?? people.get(masterId);
    if (!master) continue; // already cleaned in Phase A

    const rate        = getMasterProgressRate(master);
    const newProgress = Math.min(1.0, progress + rate);

    if (newProgress >= 1.0) {
      // Graduation: award tradeTraining bonus
      const bonus    = computeCompletionBonus(master);
      const existing = person.tradeTraining?.[trade] ?? 0;
      const capped   = Math.min(MAX_TRADE_TRAINING, existing + bonus);

      const graduated: Person = {
        ...person,
        apprenticeship: null,
        tradeTraining: { ...person.tradeTraining, [trade]: capped },
      };
      updatedPeople.set(id, graduated);

      pendingApprenticeshipEvents.push({
        eventId: 'appr_trade_mastered',
        masterId,
        apprenticeId: id,
      });
      logEntries.push({
        type: 'apprenticeship_completed',
        personId: id,
        targetId: masterId,
        description: `**${person.firstName}** completed their ${trade.replace(/_/g, ' ')} training under ${nameOf(people, masterId)} (+${capped - existing}%).`,
      });
    } else {
      // Just advance the progress counter
      updatedPeople.set(id, {
        ...person,
        apprenticeship: { ...person.apprenticeship, progress: newProgress },
      });
    }
  }

  // ─── Phase C: Form new apprenticeships ─────────────────────────────────────
  if (currentTurn % APPRENTICESHIP_CHECK_INTERVAL === 0) {
    for (const [masterId, baseMaster] of people) {
      const master = updatedPeople.get(masterId) ?? baseMaster;

      // Master eligibility checks
      if (!TRAINABLE_TRADES.has(master.role))          continue;
      if (master.role === 'away' || master.role === 'builder') continue;
      if (master.age < MIN_MASTER_AGE)                 continue;
      const tradeSkill = getTradeSkill(master.role);
      if (master.skills[tradeSkill] < MIN_MASTER_SKILL) continue;

      // Each master can only have one apprentice at a time
      if (masterHasApprentice(masterId, people, updatedPeople)) continue;

      // Collect candidates: own children OR named students in the right age range
      const candidates: Person[] = [];
      for (const [cid, cBase] of people) {
        if (cid === masterId) continue;
        const candidate = updatedPeople.get(cid) ?? cBase;

        if (candidate.apprenticeship)                        continue; // already training
        if (candidate.age < MIN_APPRENTICE_AGE)              continue;
        if (candidate.age > MAX_APPRENTICE_AGE)              continue;

        const isChild   = candidate.parentIds.includes(masterId);
        const isStudent = master.namedRelationships.some(
          r => r.type === 'mentor' && r.targetId === cid,
        );

        if (isChild || isStudent) candidates.push(candidate);
      }

      if (candidates.length === 0) continue;

      // Prefer own children; fall back to students; break ties with RNG
      const children = candidates.filter(c => c.parentIds.includes(masterId));
      const pool     = children.length > 0 ? children : candidates;
      const chosen   = pool[Math.floor(rng.next() * pool.length)];
      if (!chosen) continue;

      const currentChosen = updatedPeople.get(chosen.id) ?? chosen;
      updatedPeople.set(chosen.id, {
        ...currentChosen,
        apprenticeship: {
          masterId,
          trade:       master.role,
          progress:    0,
          startedTurn: currentTurn,
        },
      });

      pendingApprenticeshipEvents.push({
        eventId:      'appr_trade_training_begins',
        masterId,
        apprenticeId: chosen.id,
      });
      logEntries.push({
        type:        'apprenticeship_started',
        personId:    chosen.id,
        targetId:    masterId,
        description: `**${chosen.firstName}** began apprenticing under ${nameOf(people, masterId)} in ${master.role.replace(/_/g, ' ')}.`,
      });
    }
  }

  return { updatedPeople, pendingApprenticeshipEvents, logEntries };
}
