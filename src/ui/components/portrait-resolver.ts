/**
 * Portrait asset resolver — maps a Person to a portrait image path.
 *
 * Returns a URL relative to the Vite `public/` root when a matching
 * portrait asset exists, or `null` when only the text-swatch fallback
 * should be used.
 *
 * Folder layout (Option A — assets live in public/portraits/):
 *   public/portraits/male/imanian/Imanian_M_001.png
 *   public/portraits/female/Kiswani/Kiswani_F_001.png
 *
 * When more variants are added, a `variantSeed` parameter can be added
 * and the resolver will pick by `seed % variantCount`.
 */

import type { Person } from '../../simulation/population/person';
import type { EthnicGroup } from '../../simulation/population/person';

/** Candidate portrait entry: file path and matching criteria. */
interface PortraitEntry {
  path: string;
  group: EthnicGroup;
  sex: 'male' | 'female';
}

const PORTRAIT_REGISTRY: PortraitEntry[] = [
  { group: 'imanian',          sex: 'male',   path: '/portraits/male/imanian/Imanian_M_001.png' },
  { group: 'kiswani_riverfolk', sex: 'female', path: '/portraits/female/Kiswani/Kiswani_F_001.png' },
];

/**
 * Returns the dominant ethnic group from the person's bloodline
 * (the entry with the highest fraction). Returns 'imanian' as fallback.
 */
function dominantGroup(person: Person): EthnicGroup {
  const bloodline = person.heritage.bloodline;
  if (bloodline.length === 0) return 'imanian';
  return bloodline.reduce((best, entry) =>
    entry.fraction > best.fraction ? entry : best,
  ).group;
}

/**
 * Resolves a portrait image path for the given person.
 *
 * @returns A `/portraits/…` URL string for use in an `<img src>`, or `null`
 *          if no matching portrait asset exists (fall back to text swatch).
 */
export function resolvePortraitSrc(person: Person): string | null {
  const group = dominantGroup(person);
  const sex = person.sex;

  const entry = PORTRAIT_REGISTRY.find(
    e => e.group === group && e.sex === sex,
  );
  return entry?.path ?? null;
}
