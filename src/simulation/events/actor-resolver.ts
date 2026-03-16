/**
 * Actor resolver — selects settlers to fill event actor slots and interpolates
 * {slot} template variables in event text.
 *
 * All functions here are pure: no React, no mutations, no Math.random().
 * Randomness flows exclusively through the SeededRNG passed to selectActor /
 * resolveActors.
 *
 * Template variable syntax:
 *   {slot}        → full name (firstName + familyName)
 *   {slot.first}  → given name only
 *   {slot.he}     → subject pronoun (he / she)  — alias: {slot.she}
 *   {slot.his}    → possessive pronoun (his / her) — alias: {slot.her}
 *   {slot.him}    → object pronoun (him / her)
 *   {slot.He}     → capitalised subject pronoun  — alias: {slot.She}
 *   {slot.His}    → capitalised possessive pronoun — alias: {slot.Her}
 *   {slot.Him}    → capitalised object pronoun
 *
 * Unknown tokens (no matching slot) are left as-is.
 */

import type { ActorCriteria, ActorRequirement } from './engine';
import type { GameState } from '../turn/game-state';
import type { Person, HouseholdRole } from '../population/person';
import { getPersonSkillScore } from '../population/person';
import { SAUROMATIAN_CULTURE_IDS } from '../population/culture';
import type { SeededRNG } from '../../utils/rng';

// ─── Criteria matching ────────────────────────────────────────────────────────

/**
 * Returns true if the person satisfies every populated field in `criteria`.
 * Use this for both eligibility gates (no RNG) and search loops.
 *
 * `boundActors` and `people` are optional — required only when criteria includes
 * `sameAmbitionTargetAs` or `resolveFromAmbitionTarget` (which depend on already-
 * resolved slots). When omitted those two checks are skipped (pre-flight mode).
 */
export function matchesCriteria(
  person: Person,
  criteria: ActorCriteria,
  boundActors?: Record<string, string>,
  people?: Map<string, Person>,
): boolean {
  // Away and keth_thara persons are off-site and cannot be selected for any event slot.
  if (person.role === 'away' || person.role === 'keth_thara') return false;
  if (criteria.sex !== undefined && person.sex !== criteria.sex) return false;
  if (criteria.religion !== undefined && person.religion !== criteria.religion) return false;
  if (criteria.culturalIdentity !== undefined && person.heritage.primaryCulture !== criteria.culturalIdentity) return false;
  if (criteria.minAge !== undefined && person.age < criteria.minAge) return false;
  if (criteria.maxAge !== undefined && person.age > criteria.maxAge) return false;
  if (criteria.maritalStatus !== undefined) {
    const isMarried = person.spouseIds.length > 0;
    if (criteria.maritalStatus === 'married'   && !isMarried) return false;
    if (criteria.maritalStatus === 'unmarried' && isMarried)  return false;
  }
  if (criteria.role !== undefined && person.role !== criteria.role) return false;
  if (criteria.socialStatus !== undefined && person.socialStatus !== criteria.socialStatus) return false;
  if (criteria.householdRole !== undefined && person.householdRole !== (criteria.householdRole as HouseholdRole)) return false;
  if (criteria.hasTrait !== undefined && !person.traits.includes(criteria.hasTrait)) return false;
  if (criteria.minSkill !== undefined) {
    const score = getPersonSkillScore(person, criteria.minSkill.skill);
    if (score < criteria.minSkill.value) return false;
  }
  if (criteria.sauromatianHeritage === true &&
      !SAUROMATIAN_CULTURE_IDS.has(person.heritage.primaryCulture)) return false;
  if (criteria.hasAmbitionType !== undefined &&
      person.ambition?.type !== criteria.hasAmbitionType) return false;

  // Ambition-target cross-slot criteria (require resolved context)
  if (criteria.sameAmbitionTargetAs !== undefined && boundActors && people) {
    const refId = boundActors[criteria.sameAmbitionTargetAs];
    const ref = refId ? people.get(refId) : undefined;
    if (!ref?.ambition?.targetPersonId) return false;
    if (person.ambition?.targetPersonId !== ref.ambition.targetPersonId) return false;
  }

  if (criteria.resolveFromAmbitionTarget !== undefined && boundActors && people) {
    const refId = boundActors[criteria.resolveFromAmbitionTarget];
    const ref = refId ? people.get(refId) : undefined;
    const expectedId = ref?.ambition?.targetPersonId;
    if (!expectedId || person.id !== expectedId) return false;
  }

  if (criteria.childOfSlot !== undefined && boundActors && people) {
    const parentId = boundActors[criteria.childOfSlot];
    const parent = parentId ? people.get(parentId) : undefined;
    if (!parent || !parent.childrenIds.includes(person.id)) return false;
  }

  return true;
}

// ─── Feasibility (no RNG) ─────────────────────────────────────────────────────

/**
 * Returns true if at least one person in the settlement satisfies `criteria`
 * and is not in the `excludeIds` set.
 */
export function canFillSlot(
  criteria: ActorCriteria,
  state: GameState,
  excludeIds: string[] = [],
): boolean {
  return Array.from(state.people.values()).some(
    p => !excludeIds.includes(p.id) && matchesCriteria(p, criteria),
  );
}

/**
 * Checks whether ALL required actor slots in `requirements` can be filled
 * simultaneously (respecting mutual exclusion — no person fills two slots).
 *
 * Runs without RNG, used as a fast pre-flight before drawing.
 */
export function canResolveActors(
  requirements: ActorRequirement[],
  state: GameState,
): boolean {
  const claimedIds: string[] = [];
  for (const req of requirements) {
    const required = req.required !== false; // default true
    if (!required) continue;
    if (!canFillSlot(req.criteria, state, claimedIds)) return false;
    // Reserve the best candidate (first match) to simulate greedy allocation.
    const candidate = Array.from(state.people.values()).find(
      p => !claimedIds.includes(p.id) && matchesCriteria(p, req.criteria),
    );
    if (candidate) claimedIds.push(candidate.id);
  }
  return true;
}

// ─── Actor selection (requires RNG) ──────────────────────────────────────────

/**
 * Picks a random person from the settlement who satisfies `criteria` and
 * is not in `excludeIds`. Returns null if the pool is empty.
 */
export function selectActor(
  criteria: ActorCriteria,
  state: GameState,
  rng: SeededRNG,
  excludeIds: string[] = [],
  boundActors?: Record<string, string>,
): Person | null {
  const pool = Array.from(state.people.values()).filter(
    p => !excludeIds.includes(p.id) && matchesCriteria(p, criteria, boundActors, state.people),
  );
  if (pool.length === 0) return null;
  const idx = rng.nextInt(0, pool.length - 1);
  return pool[idx] ?? null;
}

/**
 * Resolves all actor slots in `requirements` against the current population,
 * returning a mapping of slotName → person.id.
 *
 * Slots are resolved in declaration order; each claimed person is excluded from
 * subsequent slots so no two slots share the same person.
 *
 * Returns null if any *required* slot cannot be filled (the event should not fire).
 */
export function resolveActors(
  requirements: ActorRequirement[],
  state: GameState,
  rng: SeededRNG,
): Record<string, string> | null {
  const result: Record<string, string> = {};
  const claimedIds: string[] = [];

  for (const req of requirements) {
    const required = req.required !== false; // default true
    const person = selectActor(req.criteria, state, rng, claimedIds, result);
    if (person === null) {
      if (required) return null;
      // Optional slot — leave empty, continue
      continue;
    }
    result[req.slot] = person.id;
    claimedIds.push(person.id);
  }

  return result;
}

// ─── Text interpolation ───────────────────────────────────────────────────────

/**
 * Substitutes all {slot.*} template tokens in `text` using the provided
 * slot → Person map. Tokens whose slot name is not in the map are left intact.
 *
 * Supported tokens (replace "slot" with the actual slot name):
 *   {slot}        full name
 *   {slot.first}  given name
 *   {slot.he}     he / she
 *   {slot.his}    his / her
 *   {slot.him}    him / her
 *   {slot.He}     He / She
 *   {slot.His}    His / Her
 *   {slot.Him}    Him / Her
 */
export function interpolateText(
  text: string,
  slots: Record<string, Person>,
): string {
  // Match {identifier} or {identifier.suffix}
  return text.replace(/\{([a-zA-Z_][a-zA-Z0-9_]*)(?:\.([a-zA-Z]+))?\}/g, (token, slot: string, suffix: string | undefined) => {
    const person = slots[slot];
    if (!person) return token; // unknown slot — leave as-is

    const isMale = person.sex === 'male';

    if (suffix === undefined) {
      return `${person.firstName} ${person.familyName}`;
    }

    switch (suffix) {
      case 'first': return person.firstName;
      case 'he':
      case 'she':   return isMale ? 'he'  : 'she';
      case 'his':
      case 'her':   return isMale ? 'his' : 'her';
      case 'him':   return isMale ? 'him' : 'her';
      case 'He':
      case 'She':   return isMale ? 'He'  : 'She';
      case 'His':
      case 'Her':   return isMale ? 'His' : 'Her';
      case 'Him':   return isMale ? 'Him' : 'Her';
      default:      return token; // unknown suffix — leave as-is
    }
  });
}
