/**
 * Ambitions engine — personal goals that drive autonomous character behaviour.
 *
 * Each person may hold at most one active ambition at a time (PersonAmbition | null).
 * Ambitions grow in intensity (+0.05/turn) until fulfilled or abandoned, and
 * trigger events once intensity reaches the firing threshold (0.5).
 *
 * Integration points:
 *   - `processDawn()` calls `tickAmbitionIntensity()` once per living person
 *   - `processDawn()` calls `evaluateAmbition()` / `generateAmbition()` every
 *     8 turns to update and potentially assign ambitions
 *   - Event prereqs use `has_person_with_ambition` to gate relationship events
 */

import type { Person, PersonAmbition, AmbitionId } from '../population/person';
import type { GameState } from '../turn/game-state';
import type { SeededRNG } from '../../utils/rng';
import { getDerivedSkill } from '../population/person';
import { getEffectiveOpinion } from './opinions';
import { SAUROMATIAN_CULTURE_IDS } from '../population/culture';
import { ROLE_TO_BUILDING } from '../economy/private-economy';
import { BUILDING_CATALOG } from '../buildings/building-definitions';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Intensity grows this much per turn until it reaches 1.0. */
const INTENSITY_GROWTH = 0.05;

/** Ambition must reach this intensity before it can trigger autonomous events. */
export const AMBITION_FIRING_THRESHOLD = 0.7;

/**
 * Removes the AMBITION_GENERATION_CHANCE constant — generation is now based
 * on specific conditions per ambition type, not random rolls.
 */

// ─── Tick ─────────────────────────────────────────────────────────────────────

/**
 * Advances an active ambition's intensity by one turn.
 * No-ops if the person has no ambition or has the 'content' trait.
 *
 * @returns Updated person (or same reference if unchanged).
 */
export function tickAmbitionIntensity(person: Person): Person {
  if (!person.ambition) return person;
  // Content characters don't fixate
  if (person.traits.includes('content')) return person;

  const newIntensity = Math.min(1.0, person.ambition.intensity + INTENSITY_GROWTH);
  if (newIntensity === person.ambition.intensity) return person;

  return {
    ...person,
    ambition: { ...person.ambition, intensity: newIntensity },
  };
}

// ─── Evaluation ───────────────────────────────────────────────────────────────

/**
 * Evaluates whether an active ambition has been fulfilled or should be abandoned.
 *
 * - `'fulfilled'` — the goal has been achieved (e.g. relationship ambition target
 *   is now a spouse)
 * - `'failed'`    — impossible to fulfil (target is dead, ambition is stale > 40
 *   turns)
 * - `'ongoing'`   — still in progress
 */
export function evaluateAmbition(
  person: Person,
  state: GameState,
): 'fulfilled' | 'failed' | 'ongoing' {
  if (!person.ambition) return 'ongoing';

  const { type, targetPersonId, formedTurn } = person.ambition;

  // seek_companion stales after 30 turns; all others after 40
  const staleLimit = type === 'seek_companion' ? 30 : 40;
  if (state.turnNumber - formedTurn > staleLimit) return 'failed';

  switch (type) {
    case 'seek_companion': {
      if (!targetPersonId) return 'failed';
      const target = state.people.get(targetPersonId);
      if (!target) return 'failed';
      // Fulfilled if target became a spouse or concubine in her household
      if (person.spouseIds.includes(targetPersonId)) return 'fulfilled';
      if (
        target.householdId !== null &&
        target.householdId === person.householdId &&
        target.householdRole === 'concubine'
      ) return 'fulfilled';
      // Failed if target married someone else entirely
      if (target.spouseIds.length > 0 && !person.spouseIds.includes(target.spouseIds[0]!)) return 'failed';
      return 'ongoing';
    }

    case 'seek_spouse': {
      if (!targetPersonId) return 'failed';
      const target = state.people.get(targetPersonId);
      if (!target) return 'failed';
      if (person.spouseIds.includes(targetPersonId)) return 'fulfilled';
      // Failed if target married someone else
      if (target.spouseIds.length > 0) return 'failed';
      return 'ongoing';
    }

    case 'seek_council':
      return state.councilMemberIds.includes(person.id) ? 'fulfilled' : 'ongoing';

    case 'seek_seniority':
      if (person.householdRole === 'senior_wife') return 'fulfilled';
      if (!person.householdId) return 'failed';
      if (person.householdRole !== 'wife') return 'failed';
      return 'ongoing';

    case 'seek_cultural_duty':
      if (person.role === 'keth_thara') return 'fulfilled';
      if (person.age > 24) return 'failed';
      return 'ongoing';

    case 'seek_informal_union': {
      if (!targetPersonId) return 'failed';
      const target = state.people.get(targetPersonId);
      if (!target) return 'failed';
      // Fulfilled if target is now in person's household as concubine
      if (
        target.householdId !== null &&
        target.householdId === person.householdId &&
        target.householdRole === 'concubine'
      ) return 'fulfilled';
      // Failed if target married someone else
      if (target.spouseIds.length > 0) return 'failed';
      return 'ongoing';
    }

    case 'seek_prestige':
      // Fulfilled if they gained a glory trait or are currently on a mission
      if (person.traits.includes('veteran') || person.traits.includes('respected_elder')) return 'fulfilled';
      if (person.role === 'away') return 'fulfilled'; // on a mission — counts as progress
      return 'ongoing';

    case 'seek_faith_influence':
      if (person.role === 'priest_solar' || person.role === 'wheel_singer' || person.role === 'voice_of_wheel') return 'fulfilled';
      return 'ongoing';

    case 'seek_skill_mastery':
      // Fulfilled if any base skill has crossed into Excellent tier (63+)
      if (
        person.skills.animals    >= 63 ||
        person.skills.bargaining >= 63 ||
        person.skills.combat     >= 63 ||
        person.skills.custom     >= 63 ||
        person.skills.leadership >= 63 ||
        person.skills.plants     >= 63
      ) return 'fulfilled';
      return 'ongoing';

    case 'seek_legacy': {
      // Fulfilled if all adult children are married or in informal unions
      const childIds: string[] = [];
      for (const p of state.people.values()) {
        if (p.motherId === person.id || p.fatherId === person.id) {
          childIds.push(p.id);
        }
      }
      const adultChildren = childIds.map(id => state.people.get(id)).filter((c): c is import('../population/person').Person => !!c && c.age >= 14);
      if (adultChildren.length === 0) return 'fulfilled'; // All grown children left or died
      const allSettled = adultChildren.every(c => c.spouseIds.length > 0 || c.householdRole === 'concubine');
      return allSettled ? 'fulfilled' : 'ongoing';
    }

    case 'seek_autonomy':
      // Fulfilled if policy became permissive, standing dropped below threshold, or company loyalists appeared
      if (
        state.settlement.religiousPolicy === 'wheel_permitted' ||
        state.settlement.religiousPolicy === 'hidden_wheel_recognized' ||
        state.company.standing < 40
      ) return 'fulfilled';
      if (state.factions.some(f => f.type === 'company_loyalists')) return 'fulfilled';
      return 'ongoing';

    case 'seek_better_housing': {
      if (!person.householdId) return 'failed';
      // Use the household's authoritative dwelling record (not the person-level
      // claimedBuildingId, which may lag a turn behind after an upgrade).
      const household = state.households.get(person.householdId);
      if (!household) return 'failed';
      const dwellingId = household.dwellingBuildingId ?? null;
      const dwelling = dwellingId
        ? state.settlement.buildings.find(b => b.instanceId === dwellingId)
        : undefined;
      // Top tier — nothing more to build.
      if (dwelling?.defId === 'compound') return 'fulfilled';
      // Fulfilled when the household now has comfortable space (below 50% of dwelling capacity).
      // This covers the case where a completed upgrade has relieved overcrowding.
      if (dwelling) {
        const def = BUILDING_CATALOG[dwelling.defId];
        if (def?.shelterCapacity && household.memberIds.length < def.shelterCapacity * 0.5) {
          return 'fulfilled';
        }
      }
      return 'ongoing';
    }

    case 'seek_production_building': {
      if (!person.householdId) return 'failed';
      const desired = ROLE_TO_BUILDING[person.role];
      if (!desired) return 'failed'; // person changed to a non-specialist role
      const hasIt = state.settlement.buildings.some(
        b => b.defId === desired && b.ownerHouseholdId === person.householdId,
      );
      return hasIt ? 'fulfilled' : 'ongoing';
    }
  }
}

// ─── Generation ───────────────────────────────────────────────────────────────

/**
 * Determines what ambition type (if any) a person would naturally develop.
 * Checked in priority order — first match wins.
 *
 * 0. `seek_companion`      — Sauromatian woman, unmarried ≥ 16, pursues an available man (pre-marriage phase)
 * 1. `seek_spouse`         — unmarried adult ≥ 18, opinion threshold (5 for Sauro women, 25 otherwise)
 * 2. `seek_council`        — not on council, leadership OR diplomacy ≥ 46 (Very Good)
 * 3. `seek_seniority`      — wife in household with ≥ 3 wives, hostile opinion of senior wife
 * 4. `seek_cultural_duty`  — Sauromatian male age 16–24, not already on keth-thara
 * 5. `seek_informal_union` — non-Sauromatian male ≥ 18, opinion ≥ 25 of eligible woman
 */
export function determineAmbitionType(
  person: Person,
  state: GameState,
  rng: SeededRNG,
): { type: AmbitionId; targetPersonId: string | null } | null {
  // No ambitions for content, away, or thrall persons
  if (person.traits.includes('content')) return null;
  if (person.role === 'away') return null;
  if (person.socialStatus === 'thrall') return null;

  // 0. seek_companion — Sauromatian woman actively pursues an available man
  //    (the pre-marriage testing phase; checked first for eligible women)
  if (
    person.sex === 'female' &&
    SAUROMATIAN_CULTURE_IDS.has(person.heritage.primaryCulture) &&
    person.spouseIds.length === 0 &&
    person.age >= 16 &&
    person.socialStatus !== 'thrall'
  ) {
    // Only form if courtshipNorms allows it
    const norms = state.settlement.courtshipNorms ?? 'mixed';
    if (norms !== 'traditional') {
      const companionTargets = Array.from(state.people.values()).filter(
        other =>
          other.id !== person.id &&
          other.sex === 'male' &&
          other.spouseIds.length === 0 &&
          other.age >= 18 &&
          getEffectiveOpinion(person, other.id) >= 0,
      );
      if (companionTargets.length > 0) {
        const target = companionTargets[rng.nextInt(0, companionTargets.length - 1)]!;
        return { type: 'seek_companion', targetPersonId: target.id };
      }
    }
  }

  // 1. seek_spouse — unmarried adult with at least a neutral opinion of an eligible partner.
  // Threshold differentiated by culture:
  //   - Sauromatian women: 5 (she builds from near-neutral)
  //   - settlement_native / mixed-heritage: 10 (grew up in the settlement together;
  //     baseline ~18 for same-culture pairs, which never drifts past the old 25 threshold
  //     because same-culture +1 drift and −1 decay cancel out exactly)
  //   - All others: 10 (same reasoning — keep the bar low enough to be reachable
  //     from the natural baseline without requiring boosted founding opinions)
  if (person.spouseIds.length === 0 && person.age >= 18) {
    const isSauroFemale =
      person.sex === 'female' &&
      SAUROMATIAN_CULTURE_IDS.has(person.heritage.primaryCulture);
    const spouseOpinionThreshold = isSauroFemale ? 5 : 10;

    // Sauromatian women also require the target to have room for another wife
    const candidates = Array.from(state.people.values()).filter(
      other =>
        other.id !== person.id &&
        other.sex !== person.sex &&
        other.spouseIds.length === 0 &&
        other.age >= 16 &&
        getEffectiveOpinion(person, other.id) >= spouseOpinionThreshold,
    );
    if (candidates.length > 0) {
      const target = candidates[rng.nextInt(0, candidates.length - 1)]!;
      return { type: 'seek_spouse', targetPersonId: target.id };
    }
  }

  // 2. seek_council — skilled person not currently on council
  if (
    !state.councilMemberIds.includes(person.id) &&
    (person.skills.leadership >= 46 || getDerivedSkill(person.skills, 'diplomacy') >= 46)
  ) {
    return { type: 'seek_council', targetPersonId: null };
  }

  // 3. seek_seniority — wife in a household with ≥ 3 wives who envies the senior wife
  if (person.householdRole === 'wife' && person.householdId) {
    const household = state.households.get(person.householdId);
    if (household) {
      const wiveCount = Array.from(state.people.values()).filter(
        p =>
          p.householdId === person.householdId &&
          (p.householdRole === 'wife' || p.householdRole === 'senior_wife'),
      ).length;
      const seniorWifeId = household.seniorWifeId;
      const opinionOfSenior = seniorWifeId ? getEffectiveOpinion(person, seniorWifeId) : 0;
      if (wiveCount >= 3 && opinionOfSenior < 0) {
        return { type: 'seek_seniority', targetPersonId: seniorWifeId };
      }
    }
  }

  // 4. seek_cultural_duty — young Sauromatian male, age 16–24
  if (
    person.sex === 'male' &&
    person.age >= 16 &&
    person.age <= 24 &&
    SAUROMATIAN_CULTURE_IDS.has(person.heritage.primaryCulture) &&
    person.role !== 'keth_thara'
  ) {
    return { type: 'seek_cultural_duty', targetPersonId: null };
  }

  // 5. seek_informal_union — non-Sauromatian man with at least a mildly positive opinion
  // of an eligible woman. Threshold 10 matches seek_spouse so that second-generation
  // settlement_native men (baseline opinion ~18) can form this ambition.
  if (
    person.sex === 'male' &&
    !SAUROMATIAN_CULTURE_IDS.has(person.heritage.primaryCulture) &&
    person.age >= 18
  ) {
    const targets = Array.from(state.people.values()).filter(
      other =>
        other.id !== person.id &&
        other.sex === 'female' &&
        other.spouseIds.length === 0 &&
        other.age >= 16 &&
        getEffectiveOpinion(person, other.id) >= 10,
    );
    if (targets.length > 0) {
      const target = targets[rng.nextInt(0, targets.length - 1)]!;
      return { type: 'seek_informal_union', targetPersonId: target.id };
    }
  }

  // 6. seek_prestige — seasoned warrior/leader craving recognition
  if (
    person.age >= 25 &&
    person.role !== 'away' &&
    (person.skills.leadership >= 46 || person.skills.combat >= 46) &&
    !person.traits.includes('veteran') &&
    !person.traits.includes('respected_elder')
  ) {
    return { type: 'seek_prestige', targetPersonId: null };
  }

  // 7. seek_faith_influence — pious person called to spiritual leadership
  if (
    (person.traits.includes('zealous') || person.traits.includes('pious')) &&
    (person.skills.leadership >= 46 || person.skills.bargaining >= 46) &&
    person.role !== 'priest_solar' &&
    person.role !== 'wheel_singer' &&
    person.role !== 'voice_of_wheel'
  ) {
    return { type: 'seek_faith_influence', targetPersonId: null };
  }

  // 8. seek_skill_mastery — person has a skill in VG range (46–62) and trains it
  {
    const skillsInVG: { skillId: 'animals' | 'bargaining' | 'combat' | 'custom' | 'leadership' | 'plants'; value: number }[] = [
      { skillId: 'animals',    value: person.skills.animals },
      { skillId: 'bargaining', value: person.skills.bargaining },
      { skillId: 'combat',     value: person.skills.combat },
      { skillId: 'custom',     value: person.skills.custom },
      { skillId: 'leadership', value: person.skills.leadership },
      { skillId: 'plants',     value: person.skills.plants },
    ].filter(s => s.value >= 46 && s.value <= 62);

    if (skillsInVG.length > 0) {
      return { type: 'seek_skill_mastery', targetPersonId: null };
    }
  }

  // 9. seek_legacy — ageing parent with at least one unmarried adult child
  if (person.age >= 45) {
    const childIds: string[] = [];
    for (const p of state.people.values()) {
      if (p.motherId === person.id || p.fatherId === person.id) {
        childIds.push(p.id);
      }
    }
    const hasUnmarriedAdultChild = childIds.some(childId => {
      const child = state.people.get(childId);
      return child && child.age >= 14 && child.spouseIds.length === 0 && child.householdRole !== 'concubine';
    });
    if (hasUnmarriedAdultChild) {
      return { type: 'seek_legacy', targetPersonId: null };
    }
  }

  // 10. seek_autonomy — Sauromatian-heritage person under prolonged Company pressure
  if (
    SAUROMATIAN_CULTURE_IDS.has(person.heritage.primaryCulture) &&
    (state.identityPressure?.companyPressureTurns ?? 0) >= 4
  ) {
    return { type: 'seek_autonomy', targetPersonId: null };
  }

  // 11. seek_better_housing — household is at ≥50% of current dwelling capacity.
  // Path A in processPrivateBuilding handles the no-dwelling case automatically;
  // this ambition only fires once overcrowding pressure prompts an upgrade.
  if (person.householdId) {
    const hhForHousing = state.households.get(person.householdId);
    if (hhForHousing) {
      const dwellingIdForHousing = hhForHousing.dwellingBuildingId ?? null;
      const dwellingForHousing = dwellingIdForHousing
        ? state.settlement.buildings.find(b => b.instanceId === dwellingIdForHousing)
        : undefined;
      if (dwellingForHousing && dwellingForHousing.defId !== 'compound') {
        const defForHousing = BUILDING_CATALOG[dwellingForHousing.defId];
        if (
          defForHousing?.shelterCapacity &&
          hhForHousing.memberIds.length >= defForHousing.shelterCapacity * 0.5
        ) {
          return { type: 'seek_better_housing', targetPersonId: null };
        }
      }
    }
  }

  // 12. seek_production_building — specialist worker whose household is already sheltered
  // and lacks the matching production building. Shelter needs take priority.
  {
    const desiredBuilding = ROLE_TO_BUILDING[person.role];
    if (desiredBuilding && person.householdId) {
      const hhForProd = state.households.get(person.householdId);
      // Only seek production buildings once the household has its own dwelling.
      if (!hhForProd?.dwellingBuildingId) return null;
      const hasBuilding = state.settlement.buildings.some(
        b => b.defId === desiredBuilding && b.ownerHouseholdId === person.householdId,
      );
      if (!hasBuilding) {
        return { type: 'seek_production_building', targetPersonId: null };
      }
    }
  }

  return null;
}

/**
 * Generates a new PersonAmbition for the given person if conditions are met.
 * Returns null if no ambition should form (already has one, content, etc.).
 */
export function generateAmbition(
  person: Person,
  state: GameState,
  rng: SeededRNG,
): PersonAmbition | null {
  // Already has an active ambition
  if (person.ambition) return null;

  const result = determineAmbitionType(person, state, rng);
  if (!result) return null;

  return {
    type: result.type,
    intensity: 0.1,
    targetPersonId: result.targetPersonId,
    formedTurn: state.turnNumber,
  };
}

/**
 * Clears a fulfilled or failed ambition from the person.
 * No-op if the person has no ambition.
 */
export function clearAmbition(person: Person): Person {
  if (!person.ambition) return person;
  return { ...person, ambition: null };
}

// ─── Display helpers ──────────────────────────────────────────────────────────

/**
 * Returns a short human-readable label for an ambition.
 */
export function getAmbitionLabel(ambition: PersonAmbition): string {
  switch (ambition.type) {
    case 'seek_companion': {
      const targetName = ambition.targetPersonId
        ? (() => {
            // nameOf helper is not available here; return the ID as a fallback
            // (PersonDetail resolves the name when displaying)
            return ambition.targetPersonId;
          })()
        : null;
      return `Seeking a companion${targetName ? ` — ${targetName}` : ''}`;
    }
    case 'seek_spouse':          return 'Seeking a spouse';
    case 'seek_council':         return 'Seeking a council seat';
    case 'seek_seniority':       return 'Seeking senior-wife standing';
    case 'seek_cultural_duty':   return 'Called to keth-thara';
    case 'seek_informal_union':  return 'Seeking an informal bond';
    case 'seek_prestige':        return 'Craving recognition';
    case 'seek_faith_influence': return 'Called to spiritual service';
    case 'seek_skill_mastery':   return 'Striving for mastery';
    case 'seek_legacy':          return 'Worried about the next generation';
    case 'seek_autonomy':              return 'Chafing under authority';
    case 'seek_better_housing':        return 'Wants a proper home';
    case 'seek_production_building':   return 'Wants a workshop for the household';
  }
}

/**
 * Returns a CSS colour class for an ambition badge based on intensity.
 */
export function getAmbitionIntensityClass(intensity: number): string {
  if (intensity >= 0.8) return 'bg-rose-900 text-rose-200';
  if (intensity >= 0.5) return 'bg-amber-900 text-amber-200';
  return 'bg-stone-700 text-stone-400';
}
