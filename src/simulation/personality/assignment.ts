/**
 * Earned trait acquisition and temporary trait expiry.
 *
 * Two entry points consumed by processDawn():
 *
 *   checkEarnedTraitAcquisition   — checks one person/turn for new earned traits
 *   applyTemporaryTraitExpiry     — scans all people for traits that have just expired
 *
 * Both functions are pure (no mutation of the input maps) and return only
 * changed Person objects.
 *
 * Hard rules:
 *   - No React imports
 *   - No Math.random() — randomness flows through the provided SeededRNG
 *   - Zero DOM dependency
 */

import type { Person } from '../population/person';
import type { TraitId } from '../personality/traits';
import type { SeededRNG } from '../../utils/rng';
import { TEMPORARY_TRAITS } from '../../data/trait-definitions';

// ─── Temporary trait expiry ───────────────────────────────────────────────────

/**
 * Checks each person's `traitExpiry` map. Any trait whose expiry turn has arrived
 * (expiry <= currentTurn) is removed from their traits array.
 *
 * Returns a Map containing only persons who actually changed — same delta-map
 * contract as decayOpinions(). Immutable: does not mutate the input map.
 */
export function applyTemporaryTraitExpiry(
  people: Map<string, Person>,
  currentTurn: number,
): Map<string, Person> {
  const changed = new Map<string, Person>();

  for (const [id, person] of people) {
    if (!person.traitExpiry || Object.keys(person.traitExpiry).length === 0) continue;

    const expiringTraits: TraitId[] = [];
    for (const [trait, expiryTurn] of Object.entries(person.traitExpiry) as [TraitId, number][]) {
      if (expiryTurn <= currentTurn) {
        expiringTraits.push(trait);
      }
    }

    if (expiringTraits.length === 0) continue;

    const newTraits = person.traits.filter(t => !expiringTraits.includes(t));
    const newExpiry: Partial<Record<TraitId, number>> = { ...person.traitExpiry };
    for (const t of expiringTraits) {
      delete newExpiry[t];
    }

    changed.set(id, {
      ...person,
      traits: newTraits,
      traitExpiry: Object.keys(newExpiry).length > 0 ? newExpiry : undefined,
    });
  }

  return changed;
}

// ─── Earned trait acquisition ─────────────────────────────────────────────────

/**
 * Checks whether `person` qualifies to acquire a new earned trait this turn.
 *
 * Called once per living person per dawn. Returns:
 *   { traitId, expiryTurn? } when a trait should be added, or null.
 *
 * Acquisition rules (checked in priority order, first match wins):
 *
 *   respected_elder   — age ≥ 55 and no negative earned traits and not already held
 *   veteran           — combat skill ≥ 63 (Excellent) and person has `brave` or `strong` — not already held
 *   healer            — plants skill ≥ 46 (Very Good) and built healer's hut in settlement — not already held
 *   negotiator        — bargaining skill ≥ 63 (Excellent) — not already held
 *   storyteller       — custom skill ≥ 46 (Very Good) and `folklorist` or `sanguine` trait — not already held
 *   grief expiry       — bereaved trait is present but traitExpiry has it expiring — no new trait, just let expiry handle
 *   homesick          — culturalBlend target far from person's primary culture (handled by event, not here)
 *
 * Stochastic gate: uses `rng.nextFloat()` to avoid all players converging identically.
 * All probabilities are per-turn values (low, meant to accumulate over many seasons).
 */
export function checkEarnedTraitAcquisition(
  person: Person,
  settlementHasBuildingId: (id: string) => boolean,
  rng: SeededRNG,
): TraitAcquisitionResult {
  const has = (t: TraitId) => person.traits.includes(t);
  const hasAny = (...ts: TraitId[]) => ts.some(t => person.traits.includes(t));

  // respected_elder — age ≥ 55, probability 12% per turn once qualified
  if (
    person.age >= 55 &&
    !has('respected_elder') &&
    !has('outcast') && !has('kinslayer') && !has('oath_breaker') && !has('scandal') &&
    rng.next() < 0.12
  ) {
    return { traitId: 'respected_elder' };
  }

  // veteran — high combat + brave/strong — 8% per turn once qualified
  if (
    person.skills.combat >= 63 &&
    hasAny('brave', 'strong') &&
    !has('veteran') &&
    rng.next() < 0.08
  ) {
    return { traitId: 'veteran' };
  }

  // healer — high plants + healer's hut present — 10% per turn
  if (
    person.skills.plants >= 46 &&
    settlementHasBuildingId('healers_hut') &&
    !has('healer') &&
    rng.next() < 0.10
  ) {
    return { traitId: 'healer' };
  }

  // negotiator — excellent bargaining — 8% per turn
  if (
    person.skills.bargaining >= 63 &&
    !has('negotiator') &&
    rng.next() < 0.08
  ) {
    return { traitId: 'negotiator' };
  }

  // storyteller — high custom + relevant personality — 6% per turn
  if (
    person.skills.custom >= 46 &&
    hasAny('folklorist', 'sanguine', 'gregarious') &&
    !has('storyteller') &&
    rng.next() < 0.06
  ) {
    return { traitId: 'storyteller' };
  }

  return null;
}

export type TraitAcquisitionResult = { traitId: TraitId; expiryTurn?: number } | null;

// ─── Utility: add a trait with optional expiry ────────────────────────────────

/**
 * Returns an updated copy of `person` with `traitId` added and —
 * if `expiryTurn` is provided, or the trait is known to be temporary — an
 * expiry record registered.
 *
 * Does nothing if the person already has the trait.
 */
export function grantTrait(
  person: Person,
  traitId: TraitId,
  expiryTurn?: number,
  currentTurn?: number,
): Person {
  if (person.traits.includes(traitId)) return person;

  const isTemp = TEMPORARY_TRAITS.has(traitId);
  const effectiveExpiry = expiryTurn ?? (isTemp && currentTurn !== undefined
    ? currentTurn + (TEMPORARY_TRAIT_DURATIONS[traitId as string] ?? 8)
    : undefined);

  const newExpiry = effectiveExpiry !== undefined
    ? { ...person.traitExpiry, [traitId]: effectiveExpiry }
    : person.traitExpiry;

  return {
    ...person,
    traits: [...person.traits, traitId],
    traitExpiry: newExpiry,
  };
}

/** How many turns each temporary trait lasts by default. */
const TEMPORARY_TRAIT_DURATIONS: Partial<Record<string, number>> = {
  grieving:    8,
  inspired:    6,
  restless:   12,
  traumatized: 12,
  homesick:   16,
  bereaved:    8,
};
