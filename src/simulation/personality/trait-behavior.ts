/**
 * Trait-driven autonomous behaviour engine.
 *
 * Three pure functions that processDawn() calls each season:
 *
 *   computeTraitCategoryBoosts   — returns per-EventCategory multipliers for the event deck
 *   applyTraitOpinionEffects     — applies per-turn opinion drift driven by social traits
 *   getTraitSkillGrowthBonuses   — per-turn skill growth additions from aptitude/earned traits
 *
 * All functions are pure (no RNG, no mutation) and return only changed data.
 *
 * Hard rules:
 *   - No React imports
 *   - No Math.random()
 *   - Zero DOM dependency
 */

import type { Person } from '../population/person';
import type { PersonSkills } from '../population/person';
import type { EventCategory } from '../events/engine';
import { TRAIT_DEFINITIONS } from '../../data/trait-definitions';
import { adjustOpinion } from '../population/opinions';

// ─── Event deck shaping ───────────────────────────────────────────────────────

/**
 * Maps TraitEffectTarget names that relate to event weight to their EventCategory.
 * Used to translate trait effects into deck shape changes.
 */
const EFFECT_TO_CATEGORY: Record<string, EventCategory> = {
  event_weight_domestic:     'domestic',
  event_weight_cultural:     'cultural',
  event_weight_religious:    'company',   // 'religious' maps to 'company' — closest bucket
  event_weight_economic:     'economic',
};

// Correction: 'religious' is not in EventCategory — map it nearest-fit.
// Until a 'religious' EventCategory is added, use 'cultural' as the home for religion events.
const EFFECT_TO_CATEGORY_FIXED: Record<string, EventCategory> = {
  event_weight_domestic:  'domestic',
  event_weight_cultural:  'cultural',
  event_weight_religious: 'cultural',
  event_weight_economic:  'economic',
};

/**
 * Scans the settlement's population for traits that modulate event category weights.
 *
 * Returns a partial record of EventCategory → final multiplier. Absent categories
 * retain their base weight of 1.0.
 *
 * The multiplier is the geometric mean of all contributing modifiers (i.e. a single
 * person owning `zealous` (2.0×) in a population of 10 contributes 1 + (2.0−1.0)/10 = 1.10).
 * This prevents a single extremist from drowning the rest of the deck.
 */
export function computeTraitCategoryBoosts(
  people: Map<string, Person>,
): Partial<Record<EventCategory, number>> {
  const pop = people.size;
  if (pop === 0) return {};

  const accumulators: Partial<Record<EventCategory, number>> = {};

  for (const person of people.values()) {
    for (const traitId of person.traits) {
      const def = TRAIT_DEFINITIONS[traitId];
      if (!def) continue;
      for (const effect of def.effects) {
        const category = EFFECT_TO_CATEGORY_FIXED[effect.target];
        if (!category) continue;
        const prior = accumulators[category] ?? 0;
        // Accumulate the delta (effect.modifier - 1) normalised per person.
        accumulators[category] = prior + (effect.modifier - 1) / pop;
      }
    }
  }

  // Convert accumulated deltas back to multipliers; enforce floor of 0.2.
  const result: Partial<Record<EventCategory, number>> = {};
  for (const [cat, delta] of Object.entries(accumulators) as [EventCategory, number][]) {
    const multiplier = Math.max(0.2, 1 + delta);
    if (Math.abs(multiplier - 1) > 0.01) {
      result[cat] = multiplier;
    }
  }
  return result;
}

// ─── Per-turn opinion effects ─────────────────────────────────────────────────

/**
 * Per-turn opinion adjustments driven by social/personality traits.
 *
 * Runs each dawn after the standard opinion drift and decay passes.
 * Only the changed Person entries are returned (delta map — same contract as decayOpinions).
 *
 * Rules:
 *   - `jealous`   : person is married → lower opinion of every opposite-sex adult they are NOT married to by 1
 *   - `envious`   : lower opinion of anyone with `hero`, `wealthy`, or `beautiful` by 1 per turn
 *   - `suspicious`: everyone gets −1 from this person each turn (trust erodes with the suspicious)
 *   - `trusting`  : everyone gets +1 from this person each turn
 *   - `charming`  : every other person's opinion of the charming one rises +1/season
 *                   (modelled as: charming person's opinion of others rises +1 — proxy for social pull)
 *
 * Changes are clamped to [−100, +100] by adjustOpinion().
 */
export function applyTraitOpinionEffects(
  people: Map<string, Person>,
): Map<string, Person> {
  const changed = new Map<string, Person>();

  /** Get latest version of a person, checking the changed map first. */
  const getLatest = (id: string): Person | undefined =>
    changed.get(id) ?? people.get(id);

  /** Apply a delta and record the updated person. */
  const apply = (personId: string, targetId: string, delta: number) => {
    const person = getLatest(personId);
    if (!person) return;
    const updated = adjustOpinion(person, targetId, delta);
    changed.set(personId, updated);
  };

  for (const [id, person] of people) {
    for (const traitId of person.traits) {
      switch (traitId) {
        case 'jealous': {
          if (!person.spouseIds || person.spouseIds.length === 0) break;
          const spouseSet = new Set(person.spouseIds);
          for (const [otherId, other] of people) {
            if (otherId === id) continue;
            if (spouseSet.has(otherId)) continue;
            // Jealous: lower opinion of non-spouses of the same household roughly —
            // specifically anyone the person has an existing opinion record for.
            const existingOpinion = person.relationships?.get(otherId);
            if (existingOpinion !== undefined && other.sex !== person.sex) {
              apply(id, otherId, -1);
            }
          }
          break;
        }

        case 'envious': {
          for (const [otherId, other] of people) {
            if (otherId === id) continue;
            if (
              other.traits.includes('hero') ||
              other.traits.includes('wealthy') ||
              other.traits.includes('beautiful')
            ) {
              apply(id, otherId, -1);
            }
          }
          break;
        }

        case 'suspicious': {
          for (const otherId of people.keys()) {
            if (otherId === id) continue;
            // Suspicious: they distrust everyone slightly each turn.
            apply(id, otherId, -1);
          }
          break;
        }

        case 'trusting': {
          for (const otherId of people.keys()) {
            if (otherId === id) continue;
            apply(id, otherId, 1);
          }
          break;
        }

        case 'charming': {
          // Others warm to the charming person — model from their side.
          for (const otherId of people.keys()) {
            if (otherId === id) continue;
            apply(otherId, id, 1);
          }
          break;
        }

        default:
          break;
      }
    }
  }

  return changed;
}

// ─── Trait-driven skill growth ────────────────────────────────────────────────

/**
 * Returns per-turn skill growth additions from aptitude and earned traits.
 *
 * These are added on TOP of the building-based skill growth in processDawn step 8.5.
 * Only non-zero entries are included in the result.
 *
 * Mapping:
 *   green_thumb      → +2 plants / season
 *   keen_hunter      → +1 combat / season
 *   gifted_speaker   → +1 bargaining + 1 leadership / season
 *   mentor_hearted   → +1 leadership / season
 *   inspired         → +1 to all skills (temporary trait)
 *   bereaved         → −1 to all skills (temporary trait, uses negative value)
 *   grieving         → −1 to all skills (temporary trait)
 */
export function getTraitSkillGrowthBonuses(person: Person): Partial<PersonSkills> {
  const bonuses: Partial<PersonSkills> = {};

  const add = (skill: keyof PersonSkills, delta: number) => {
    bonuses[skill] = (bonuses[skill] ?? 0) + delta;
  };

  for (const traitId of person.traits) {
    switch (traitId) {
      case 'green_thumb':     add('plants', 2); break;
      case 'keen_hunter':     add('combat', 1); break;
      case 'gifted_speaker':  add('bargaining', 1); add('leadership', 1); break;
      case 'mentor_hearted':  add('leadership', 1); break;
      case 'inspired':
        add('animals', 1); add('bargaining', 1); add('combat', 1);
        add('custom', 1);  add('leadership', 1); add('plants', 1);
        break;
      case 'bereaved':
      case 'grieving':
        add('animals', -1); add('bargaining', -1); add('combat', -1);
        add('custom', -1);  add('leadership', -1); add('plants', -1);
        break;
      default:
        break;
    }
  }

  // Remove zero entries for cleanliness.
  for (const key of Object.keys(bonuses) as (keyof PersonSkills)[]) {
    if (bonuses[key] === 0) delete bonuses[key];
  }

  return bonuses;
}
