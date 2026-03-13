/**
 * Trait affinity constants used by the opinions system.
 *
 * TRAIT_CONFLICTS — pairs of opposing traits; when person A has the first and
 *   person B has the second (or vice versa) this penalty is applied to the
 *   initial baseline opinion between them.
 *
 * TRAIT_SHARED_BONUS — traits where mutual possession yields an opinion boost;
 *   both A and B must have the same trait to gain the bonus.
 */

import type { TraitId } from '../simulation/personality/traits';

/**
 * Each entry is [traitOnA, traitOnB, penalty].
 * The check is symmetric: [a has traitOnA and b has traitOnB] OR vice versa.
 */
export const TRAIT_CONFLICTS: Array<[TraitId, TraitId, number]> = [
  ['cruel',        'kind',          -20],
  ['honest',       'deceitful',     -20],
  ['xenophobic',   'welcoming',     -20],
  ['brave',        'craven',        -15],
  ['greedy',       'generous',      -15],
  ['traditional',  'cosmopolitan',  -15],
  ['proud',        'humble',        -10],
  ['wrathful',     'patient',       -10],
];

/**
 * Opinion bonus when both persons share the same trait.
 * Only the trait owner listed here gains the bonus toward all others
 * who also carry that trait.
 */
export const TRAIT_SHARED_BONUS: Partial<Record<TraitId, number>> = {
  gregarious:  12,
  devout:      10,
  honest:      10,
  kind:         8,
  generous:     8,
  brave:        8,
  traditional:  8,
};
