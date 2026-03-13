/**
 * Opinions system — inter-person opinion scores.
 *
 * Opinions are stored in `Person.relationships: Map<string, number>` where:
 *   - key   = the other person's ID (the person being opined about)
 *   - value = score in [-100, +100]; positive = favourable, negative = hostile
 *
 * The Map is already part of the Person interface, so no schema changes are
 * needed. This module provides pure helper functions that read from and return
 * updated Person copies — no mutation, no side-effects.
 *
 * Integration points:
 *   - `processDawn()` calls `decayOpinions()` and `initializeBaselineOpinions()`
 *     once per turn
 *   - `resolver.ts` 'modify_opinion' consequence calls `adjustOpinion`
 *   - `canMarry()` calls `getOpinion()` to enforce the -30 hard block
 */

import type { Person, OpinionModifier } from '../population/person';
import type { TraitId } from '../personality/traits';
import { TRAIT_CONFLICTS, TRAIT_SHARED_BONUS } from '../../data/trait-affinities';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Maximum number of people whose opinions a person actively tracks.
 *  When the settlement population exceeds this, new entries are not created
 *  for strangers (existing entries continue to be maintained). */
export const OPINION_TRACK_CAP = 150;

/** Hard floor below which a character will refuse a player-arranged marriage. */
export const MARRIAGE_REFUSAL_THRESHOLD = -30;

/** Per-turn decay magnitude — opinions drift this many points toward neutral per turn. */
const DECAY_RATE = 1;

/** Baseline opinion score assigned to any two strangers at first meeting. */
const STRANGER_BASELINE = 0;

// ─── Core getters / setters ───────────────────────────────────────────────────

/**
 * Returns person A's opinion of person B (by ID).
 * Returns 0 if no entry exists (neutral stranger).
 */
export function getOpinion(person: Person, targetId: string): number {
  return person.relationships.get(targetId) ?? 0;
}

/**
 * Returns a new Person copy with the opinion of `targetId` set to `value`,
 * clamped to [-100, +100].  Removes the entry if the value is 0 (neutral).
 */
export function setOpinion(person: Person, targetId: string, value: number): Person {
  const clamped = Math.max(-100, Math.min(100, Math.round(value)));
  const updated = new Map(person.relationships);
  if (clamped === 0) {
    updated.delete(targetId);
  } else {
    updated.set(targetId, clamped);
  }
  return { ...person, relationships: updated };
}

/**
 * Returns a new Person copy with the opinion of `targetId` adjusted by `delta`.
 * The result is clamped to [-100, +100].
 */
export function adjustOpinion(person: Person, targetId: string, delta: number): Person {
  const current = getOpinion(person, targetId);
  return setOpinion(person, targetId, current + delta);
}

// ─── Timed modifier operations ────────────────────────────────────────────────

/**
 * Adds (or replaces) a timed opinion modifier on `person`.
 * Deduplication is by `modifier.id` — if a modifier with the same id already
 * exists, it is replaced (re-fires the full value, resetting its remaining life).
 *
 * @returns Updated Person (immutable).
 */
export function addOpinionModifier(person: Person, modifier: OpinionModifier): Person {
  const existing = (person.opinionModifiers ?? []).filter(m => m.id !== modifier.id);
  return { ...person, opinionModifiers: [...existing, modifier] };
}

/**
 * Returns the effective opinion A holds toward B, combining:
 *   - The stable base opinion from `person.relationships`
 *   - The sum of all active timed modifiers targeting `targetId`
 *
 * Use this everywhere a decision is made (marriage gates, event prereqs, ambitions).
 * Use `getOpinion()` only for drift/decay operations that act on the base layer.
 */
export function getEffectiveOpinion(person: Person, targetId: string): number {
  const base = getOpinion(person, targetId);
  const mods = person.opinionModifiers ?? [];
  const modSum = mods
    .filter(m => m.targetId === targetId)
    .reduce((acc, m) => acc + m.value, 0);
  return Math.max(-100, Math.min(100, base + modSum));
}

/**
 * Returns all active opinion modifiers that `person` holds toward `targetId`.
 * Used by the UI tooltip breakdown to show labeled, time-limited effects.
 */
export function getModifierSummary(person: Person, targetId: string): OpinionModifier[] {
  return (person.opinionModifiers ?? []).filter(m => m.targetId === targetId);
}

/**
 * Decays all opinion modifiers by 1 point toward 0 each turn.
 * Modifiers whose value reaches 0 after decrement are removed.
 *
 * @returns Updated people map (only modified persons are replaced).
 */
export function decayOpinionModifiers(
  people: Map<string, Person>,
): Map<string, Person> {
  const changed = new Map<string, Person>();

  for (const [id, person] of people) {
    const mods = person.opinionModifiers ?? [];
    if (mods.length === 0) continue;

    const decayed = mods
      .map(m => ({
        ...m,
        value: m.value > 0
          ? Math.max(0, m.value - 1)
          : Math.min(0, m.value + 1),
      }))
      .filter(m => m.value !== 0);

    if (
      decayed.length !== mods.length ||
      decayed.some((m, i) => m.value !== mods[i]!.value)
    ) {
      changed.set(id, { ...person, opinionModifiers: decayed });
    }
  }

  return changed;
}

// ─── Baseline calculation ─────────────────────────────────────────────────────

/**
 * Calculates the trait-driven opinion component between two people.
 * Checks both conflict pairs (penalty) and shared-trait bonuses.
 */
export function computeTraitOpinion(a: Person, b: Person): number {
  let score = 0;

  // Conflict penalties (symmetric — either direction triggers)
  for (const [trait1, trait2, penalty] of TRAIT_CONFLICTS) {
    const abConflict = a.traits.includes(trait1) && b.traits.includes(trait2);
    const baConflict = a.traits.includes(trait2) && b.traits.includes(trait1);
    if (abConflict || baConflict) {
      score += penalty;
    }
  }

  // Shared-trait bonuses (both must have the same trait)
  for (const [trait, bonus] of Object.entries(TRAIT_SHARED_BONUS) as Array<[TraitId, number]>) {
    if (a.traits.includes(trait) && b.traits.includes(trait)) {
      score += bonus;
    }
  }

  return score;
}

/**
 * Computes the full baseline opinion A holds toward B, accounting for:
 *   - Same primary culture: +10
 *   - Same religion: +8
 *   - No shared language: -15
 *   - Tradetalk only: -5
 *   - Trait conflicts / bonuses (via computeTraitOpinion)
 *
 * Result is clamped to [-80, +80] to leave room for event-driven shifts.
 */
export function computeBaselineOpinion(a: Person, b: Person): number {
  let score = STRANGER_BASELINE;

  // Culture affinity
  if (a.heritage.primaryCulture === b.heritage.primaryCulture) {
    score += 10;
  }

  // Religion affinity
  if (a.religion === b.religion) {
    score += 8;
  }

  // Language penalty
  const CONVERSATIONAL = 0.3;
  const aConversational = new Set(
    a.languages.filter(l => l.fluency >= CONVERSATIONAL).map(l => l.language),
  );
  const bConversational = new Set(
    b.languages.filter(l => l.fluency >= CONVERSATIONAL).map(l => l.language),
  );

  const sharedLanguages = [...aConversational].filter(l => bConversational.has(l));
  const nonTradeShared = sharedLanguages.filter(l => l !== 'tradetalk');

  if (sharedLanguages.length === 0) {
    score -= 15;
  } else if (nonTradeShared.length === 0) {
    // Only tradetalk
    score -= 5;
  }

  // Trait component
  score += computeTraitOpinion(a, b);

  return Math.max(-80, Math.min(80, score));
}

// ─── Family opinion seeds ─────────────────────────────────────────────────────

/** Represents a one-directional opinion delta to be applied by the caller. */
export interface OpinionDelta {
  observerId: string;
  targetId: string;
  delta: number;
}

/**
 * Returns the initial opinion seeds for a newborn toward their parents and siblings.
 * Children start with strongly positive opinions of their parents and mild
 * positive opinions of siblings.
 *
 * The caller should apply these using `adjustOpinion()` after the child is
 * added to the people map.
 */
export function initializeFamilyOpinions(
  child: Person,
  mother: Person,
  father: Person | null,
  siblings: Person[],
): OpinionDelta[] {
  const deltas: OpinionDelta[] = [];

  // Child → parents: strongly positive
  deltas.push({ observerId: child.id, targetId: mother.id, delta: 40 });
  if (father) {
    deltas.push({ observerId: child.id, targetId: father.id, delta: 35 });
  }

  // Child → siblings: mild positive
  for (const sib of siblings) {
    deltas.push({ observerId: child.id, targetId: sib.id, delta: 15 });
    // Siblings also gain opinion of child (new sibling arrival)
    deltas.push({ observerId: sib.id, targetId: child.id, delta: 10 });
  }

  // Parents → child: strongly positive
  deltas.push({ observerId: mother.id, targetId: child.id, delta: 45 });
  if (father) {
    deltas.push({ observerId: father.id, targetId: child.id, delta: 40 });
  }

  return deltas;
}

// ─── Settlement-wide operations ───────────────────────────────────────────────

/**
 * Initialises baseline opinions between all pairs of people who don't yet
 * have an established relationship.
 *
 * O(n²) — only called after new settlers arrive or periodically in small
 * settlements. Skips any pair that already has a non-zero opinion entry.
 * No-ops when `people.size > OPINION_TRACK_CAP`.
 *
 * @returns Updated people map with new opinion entries inserted.
 */
export function initializeBaselineOpinions(
  people: Map<string, Person>,
): Map<string, Person> {
  if (people.size > OPINION_TRACK_CAP) return people;

  const ids = Array.from(people.keys());
  let updated = new Map(people);

  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = updated.get(ids[i]!);
      const b = updated.get(ids[j]!);
      if (!a || !b) continue;

      // Only initialize pairs that don't know each other yet
      if (!a.relationships.has(b.id)) {
        const baseline = computeBaselineOpinion(a, b);
        if (baseline !== 0) {
          updated.set(a.id, setOpinion(a, b.id, baseline));
          // Re-fetch a in case we update b next
        }
      }
      if (!b.relationships.has(a.id)) {
        const bFresh = updated.get(b.id)!;
        const aFresh = updated.get(a.id)!;
        const baseline = computeBaselineOpinion(bFresh, aFresh);
        if (baseline !== 0) {
          updated.set(b.id, setOpinion(bFresh, a.id, baseline));
        }
      }
    }
  }

  return updated;
}

/**
 * Applies per-turn opinion pressure between all established pairs.
 *
 * Cultural cohesion (+1 if same primaryCulture) and language barriers
 * (−1 if no shared conversational language ≥ 0.30 fluency) act as ongoing
 * pressures. Same-culture pairs decay more slowly; linguistically isolated
 * pairs drift apart faster.
 *
 * Only acts on pairs that already have an opinion entry — does not create
 * new entries (that is `initializeBaselineOpinions`'s job).
 * O(n²), guarded by `OPINION_TRACK_CAP`.
 */
export function applyOpinionDrift(
  people: Map<string, Person>,
): Map<string, Person> {
  if (people.size > OPINION_TRACK_CAP) return people;

  const ids = Array.from(people.keys());
  const updated = new Map(people);

  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = updated.get(ids[i]!);
      const b = updated.get(ids[j]!);
      if (!a || !b) continue;
      // Only act on established relationships
      if (!a.relationships.has(b.id) && !b.relationships.has(a.id)) continue;

      let delta = 0;

      // Cultural cohesion: shared primary culture slows decay
      if (a.heritage.primaryCulture === b.heritage.primaryCulture) delta += 1;

      // Language barrier: no common tongue accelerates drift apart
      const CONVERSATIONAL = 0.3;
      const aLangs = new Set(
        a.languages.filter(l => l.fluency >= CONVERSATIONAL).map(l => l.language),
      );
      const bLangs = new Set(
        b.languages.filter(l => l.fluency >= CONVERSATIONAL).map(l => l.language),
      );
      if (![...aLangs].some(l => bLangs.has(l))) delta -= 1;

      if (delta === 0) continue;

      // Apply symmetrically
      const updA = adjustOpinion(updated.get(a.id)!, b.id, delta);
      const updB = adjustOpinion(updated.get(b.id)!, a.id, delta);
      updated.set(a.id, updA);
      updated.set(b.id, updB);
    }
  }

  return updated;
}

/**
 * Decays all non-zero opinions by `DECAY_RATE` points toward neutral (0)
 * each turn. Opinions that reach 0 are removed from the map.
 *
 * @returns Updated people map with decayed opinion entries.
 */
export function decayOpinions(
  people: Map<string, Person>,
): Map<string, Person> {
  const updated = new Map(people);

  for (const [id, person] of people) {
    if (person.relationships.size === 0) continue;

    const newRelationships = new Map(person.relationships);
    let changed = false;

    for (const [targetId, score] of person.relationships) {
      if (score === 0) {
        newRelationships.delete(targetId);
        changed = true;
        continue;
      }
      // Decay toward 0
      const decayed = score > 0
        ? Math.max(0, score - DECAY_RATE)
        : Math.min(0, score + DECAY_RATE);

      if (decayed !== score) {
        changed = true;
        if (decayed === 0) {
          newRelationships.delete(targetId);
        } else {
          newRelationships.set(targetId, decayed);
        }
      }
    }

    if (changed) {
      updated.set(id, { ...person, relationships: newRelationships });
    }
  }

  return updated;
}

/**
 * Returns a human-readable breakdown of why person A holds their current
 * opinion of person B. Each entry is a short label + signed delta.
 *
 * Entries include both static factors (culture, religion, language, traits) and
 * active timed modifiers from recent events. Modifier entries carry a
 * `turnsRemaining` field equal to `Math.abs(value)` for UI display.
 *
 * This is used purely for UI tooltip display — not wired into game logic.
 */
export function computeOpinionBreakdown(
  a: Person,
  b: Person,
): Array<{ label: string; delta: number; turnsRemaining?: number }> {
  const lines: Array<{ label: string; delta: number; turnsRemaining?: number }> = [];

  // Culture affinity
  if (a.heritage.primaryCulture === b.heritage.primaryCulture) {
    lines.push({ label: 'Same culture', delta: 10 });
  }

  // Religion affinity
  if (a.religion === b.religion) {
    lines.push({ label: 'Same religion', delta: 8 });
  }

  // Language
  const CONVERSATIONAL = 0.3;
  const aConv = new Set(a.languages.filter(l => l.fluency >= CONVERSATIONAL).map(l => l.language));
  const bConv = new Set(b.languages.filter(l => l.fluency >= CONVERSATIONAL).map(l => l.language));
  const shared = [...aConv].filter(l => bConv.has(l));
  const nonTrade = shared.filter(l => l !== 'tradetalk');
  if (shared.length === 0) {
    lines.push({ label: 'No shared language', delta: -15 });
  } else if (nonTrade.length === 0) {
    lines.push({ label: 'Tradetalk only', delta: -5 });
  }

  // Trait conflicts
  for (const [trait1, trait2, penalty] of TRAIT_CONFLICTS) {
    const abConflict = a.traits.includes(trait1) && b.traits.includes(trait2);
    const baConflict = a.traits.includes(trait2) && b.traits.includes(trait1);
    if (abConflict || baConflict) {
      const tA = abConflict ? trait1 : trait2;
      const tB = abConflict ? trait2 : trait1;
      lines.push({
        label: `Trait clash (${tA} / ${tB})`,
        delta: penalty,
      });
    }
  }

  // Shared-trait bonuses
  for (const [trait, bonus] of Object.entries(TRAIT_SHARED_BONUS) as Array<[TraitId, number]>) {
    if (a.traits.includes(trait) && b.traits.includes(trait)) {
      lines.push({ label: `Shared trait (${trait})`, delta: bonus });
    }
  }

  // Events / manual adjustments — the gap between baseline and stored score
  const baseline = computeBaselineOpinion(a, b);
  const stored   = getOpinion(a, b.id);
  const eventDelta = stored - baseline;
  if (Math.abs(eventDelta) >= 1) {
    lines.push({ label: 'Events & interactions', delta: Math.round(eventDelta) });
  }

  // Active timed modifiers from shared experiences
  for (const mod of getModifierSummary(a, b.id)) {
    lines.push({
      label: mod.label,
      delta: mod.value,
      turnsRemaining: Math.abs(mod.value),
    });
  }

  return lines;
}

/**
 * Checks whether either party in a potential marriage/union would refuse
 * based on their effective opinion (base + active modifiers) of the other.
 *
 * Returns `null` if both consent, or the ID of the refusing person.
 */
export function findMarriageRefuser(man: Person, woman: Person): string | null {
  if (getEffectiveOpinion(man, woman.id) < MARRIAGE_REFUSAL_THRESHOLD) return man.id;
  if (getEffectiveOpinion(woman, man.id) < MARRIAGE_REFUSAL_THRESHOLD) return woman.id;
  return null;
}

/**
 * Applies a marriage opinion floor: raises each spouse's opinion of the other
 * to at least +40 if it is currently below that value.
 *
 * Called by the game store after a successful marriage to reflect the social
 * bonding that comes from a formally recognised union.
 *
 * @returns Updated [manUpdated, womanUpdated] pair.
 */
export function applyMarriageOpinionFloor(
  man: Person,
  woman: Person,
  floor = 40,
): [Person, Person] {
  const manOpinionOfWoman = getOpinion(man, woman.id);
  const womanOpinionOfMan = getOpinion(woman, man.id);

  const updatedMan = manOpinionOfWoman < floor
    ? setOpinion(man, woman.id, floor)
    : man;
  const updatedWoman = womanOpinionOfMan < floor
    ? setOpinion(woman, man.id, floor)
    : woman;

  return [updatedMan, updatedWoman];
}

/**
 * Returns the top `n` opinions (positive or negative) that `person` holds,
 * sorted by absolute magnitude descending.
 *
 * Convenience helper for UI display and event condition checking.
 */
export function getStrongestOpinions(
  person: Person,
  n: number,
): Array<{ targetId: string; score: number }> {
  return Array.from(person.relationships.entries())
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, n)
    .map(([targetId, score]) => ({ targetId, score }));
}
