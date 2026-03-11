/**
 * Language acquisition engine for the Palusteria simulation.
 *
 * Models realistic language learning through community immersion:
 *   - Children absorb both parents' languages from birth (starting at low fluency).
 *   - Adults slowly pick up community languages through daily exposure.
 *   - Tradetalk (a simplified pidgin) emerges when two groups share no common tongue.
 *   - Settlement creole becomes available to newborns after sustained bilingualism.
 *
 * All functions are **pure** — no mutations, no side effects.
 * No React / DOM / store imports — pure simulation logic.
 */

import type { Person, LanguageId, LanguageFluency } from '../population/person';
import { clamp } from '../../utils/math';

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Minimum fluency for a language to be considered conversational.
 * Used to count "speakers" when computing settlement language fractions,
 * and to determine whether a person qualifies as a language source for children.
 */
export const CONVERSATIONAL_THRESHOLD = 0.3;

/**
 * Hard ceiling on tradetalk fluency.
 * Tradetalk is a pidgin — functional but never native-level.
 */
const TRADETALK_MAX = 0.5;

// ─── Learning Rate ─────────────────────────────────────────────────────────────

/**
 * Returns the per-turn base language learning increment for a person of the given age.
 *
 * Language acquisition follows well-documented age-sensitive patterns:
 *   - Very young children are extremely receptive (critical period).
 *   - Teens are still good learners but slower than children.
 *   - Adults learn at a steady but slow pace.
 *   - Elders acquire language very slowly.
 *
 * These rates apply before the community-fraction multiplier and the
 * diminishing-returns (1 − currentFluency) factor.
 *
 * @param age - The person's age in fractional years.
 * @returns Per-turn base learning increment.
 */
export function getLanguageLearningRate(age: number): number {
  if (age < 5)  return 0.040;   // Babies / toddlers — critical period
  if (age < 12) return 0.025;   // Children
  if (age < 20) return 0.012;   // Teens
  if (age < 40) return 0.006;   // Working adults
  if (age < 60) return 0.003;   // Middle age
  return 0.001;                  // Elderly
}

// ─── Per-Person Drift ─────────────────────────────────────────────────────────

/**
 * Applies one turn of language drift to a person based on their settlement
 * community's current language distribution.
 *
 * For each language present in the settlement at detectable levels, the person
 * gains fluency according to:
 *
 *   delta = getLearningRate(age) × communityFraction × (1 − currentFluency)
 *
 * The (1 − currentFluency) term gives diminishing returns — near-native speakers
 * plateau without requiring explicit ceilings.
 *
 * **Tradetalk special rule:**
 * If the person cannot converse in *any* of the settlement's primary languages
 * (fluency < CONVERSATIONAL_THRESHOLD in every non-tradetalk, non-creole language),
 * they are linguistically isolated and grow tradetalk at 2× speed, but tradetalk
 * cannot exceed TRADETALK_MAX (0.50) — it is a functional pidgin, not a full language.
 *
 * @param person   - The person whose languages to update.
 * @param settlementLangFractions - Map of LanguageId → fraction of settlement
 *                                  population that speaks it (fluency ≥ threshold).
 * @returns New LanguageFluency[] array (does not mutate person).
 */
export function applyLanguageDrift(
  person: Person,
  settlementLangFractions: Map<LanguageId, number>,
): LanguageFluency[] {
  const rate = getLanguageLearningRate(person.age);

  // Build a working map of the person's current fluencies for quick lookup.
  const fluencyMap = new Map<LanguageId, number>(
    person.languages.map(l => [l.language, l.fluency]),
  );

  // Determine whether the person is linguistically isolated.
  const primaryLanguages: LanguageId[] = ['imanian', 'kiswani', 'hanjoda', 'settlement_creole'];
  const isIsolated = primaryLanguages.every(lang => (fluencyMap.get(lang) ?? 0) < CONVERSATIONAL_THRESHOLD);

  // Apply drift for every language present in the settlement.
  for (const [lang, communityFraction] of settlementLangFractions) {
    if (communityFraction <= 0) continue;

    const current = fluencyMap.get(lang) ?? 0;
    let delta = rate * communityFraction * (1 - current);

    if (lang === 'tradetalk') {
      if (isIsolated) {
        delta *= 2; // Isolated people absorb tradetalk faster
      }
      // Tradetalk is capped — never become native
      const newValue = clamp(current + delta, 0, TRADETALK_MAX);
      fluencyMap.set(lang, newValue);
    } else {
      fluencyMap.set(lang, clamp(current + delta, 0, 1));
    }
  }

  // Return as a LanguageFluency[] array, preserving any language the person
  // already had even if it's no longer in the community (no language loss).
  const result: LanguageFluency[] = [];
  for (const [language, fluency] of fluencyMap) {
    result.push({ language, fluency });
  }
  return result;
}

// ─── Child Language Resolution ────────────────────────────────────────────────

/**
 * Resolves the starting languages for a newborn child.
 *
 * A child born into a household hears both parents speaking from their first
 * breath — but they do not yet *speak* any language. All languages start at
 * a low fluency level (0.10) representing mere exposure and early intonation.
 *
 * Only languages where a parent has reached CONVERSATIONAL_THRESHOLD (0.3)
 * qualify as a "heard language" for the child — below that level, parental
 * speech is too fragmentary to constitute a meaningful language environment.
 *
 * If both parents share a language, it is included once (not doubled).
 *
 * @param mother - The child's mother.
 * @param father - The child's father (or mother as stand-in when father died).
 * @returns Initial LanguageFluency[] for the newborn. May be empty if neither
 *          parent speaks any language above threshold.
 */
export function resolveChildLanguages(mother: Person, father: Person): LanguageFluency[] {
  const CHILD_STARTING_FLUENCY = 0.10;

  const seenLanguages = new Set<LanguageId>();

  for (const { language, fluency } of mother.languages) {
    if (fluency >= CONVERSATIONAL_THRESHOLD) {
      seenLanguages.add(language);
    }
  }

  // Only add father's languages if father is a different person
  // (edge-case: father === mother stand-in when father died before birth).
  if (father.id !== mother.id) {
    for (const { language, fluency } of father.languages) {
      if (fluency >= CONVERSATIONAL_THRESHOLD) {
        seenLanguages.add(language);
      }
    }
  }

  return Array.from(seenLanguages).map(language => ({
    language,
    fluency: CHILD_STARTING_FLUENCY,
  }));
}

// ─── Settlement Language Distribution ────────────────────────────────────────

/**
 * Recalculates the settlement's current language distribution from the
 * living population.
 *
 * A person is counted as a "speaker" of a language if their fluency meets
 * or exceeds CONVERSATIONAL_THRESHOLD (0.3). Fractions are computed as
 * speaker_count / total_population.
 *
 * Languages spoken by nobody are omitted from the result map.
 *
 * @param people - All living people in the settlement.
 * @returns Map of LanguageId → fraction of population that speaks it (0.0–1.0).
 *          Returns an empty Map if `people` is empty.
 */
export function updateSettlementLanguages(
  people: Map<string, Person>,
): Map<LanguageId, number> {
  const total = people.size;
  if (total === 0) return new Map();

  const speakerCounts = new Map<LanguageId, number>();

  for (const person of people.values()) {
    for (const { language, fluency } of person.languages) {
      if (fluency >= CONVERSATIONAL_THRESHOLD) {
        speakerCounts.set(language, (speakerCounts.get(language) ?? 0) + 1);
      }
    }
  }

  const fractions = new Map<LanguageId, number>();
  for (const [lang, count] of speakerCounts) {
    fractions.set(lang, count / total);
  }
  return fractions;
}

// ─── Language Tension ─────────────────────────────────────────────────────────

/**
 * Calculates linguistic tension from the settlement's language distribution.
 *
 * Tension is highest when two languages split the population roughly equally
 * (50/50 parity creates maximum social friction). It falls off quickly when
 * one language becomes dominant (>75% → low tension).
 *
 * Only the top two languages by speaker fraction are considered — minority
 * languages with <5% share are unlikely to drive societal tension.
 *
 * Formula: tension = 1 − |dominantFraction − recessiveFraction|
 * Clamped to [0, 1].
 *
 * Examples:
 *   50% / 50%  → |0.50 − 0.50| = 0.0 → tension = 1.00 (maximum)
 *   75% / 25%  → |0.75 − 0.25| = 0.5 → tension = 0.50
 *   90% / 10%  → |0.90 − 0.10| = 0.8 → tension = 0.20
 *   100% / 0%  → no second language → tension = 0.00 (monolingual)
 *
 * @param langFractions - Map of LanguageId → fraction (from updateSettlementLanguages).
 * @returns Linguistic tension in [0, 1].
 */
export function updateLanguageTension(langFractions: Map<LanguageId, number>): number {
  // Extract the top two fractions (ignoring tradetalk and creole for tension purposes)
  const primaryLanguages: LanguageId[] = ['imanian', 'kiswani', 'hanjoda'];
  const fractions = primaryLanguages
    .map(lang => langFractions.get(lang) ?? 0)
    .filter(f => f >= 0.05)
    .sort((a, b) => b - a);

  if (fractions.length < 2) return 0; // Monolingual or only one meaningful language

  const dominant = fractions[0] ?? 0;
  const recessive = fractions[1] ?? 0;

  return clamp(1 - (dominant - recessive), 0, 1);
}

// ─── Diversity Turn Counter ────────────────────────────────────────────────────

/**
 * Updates the count of consecutive turns during which multiple languages are
 * actively spoken in the settlement. Used to gate creole emergence.
 *
 * Diversity is defined as: ≥ 2 primary languages each spoken by ≥ 10% of
 * the settlement's population.
 *
 * @param langFractions     - From updateSettlementLanguages().
 * @param currentDiversityTurns - The existing counter value from GameState.
 * @returns Updated diversity turn count.
 */
export function updateLanguageDiversityTurns(
  langFractions: Map<LanguageId, number>,
  currentDiversityTurns: number,
): number {
  const primaryLanguages: LanguageId[] = ['imanian', 'kiswani', 'hanjoda'];
  const languagesAboveThreshold = primaryLanguages.filter(
    lang => (langFractions.get(lang) ?? 0) >= 0.10,
  );

  return languagesAboveThreshold.length >= 2 ? currentDiversityTurns + 1 : currentDiversityTurns;
}
