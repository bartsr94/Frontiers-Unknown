/**
 * CouncilPortrait — small portrait badge for a council seat card.
 *
 * Renders a 32×40 px portrait image when an asset exists for this person,
 * or a skin-tone colour swatch circle as fallback.
 */

import type { Person } from '../../simulation/population/person';
import { resolvePortraitSrc } from './portrait-resolver';
import { skinToneColor } from './Portrait';

interface CouncilPortraitProps {
  person: Person;
}

export default function CouncilPortrait({ person }: CouncilPortraitProps) {
  const src = resolvePortraitSrc(person);

  if (src) {
    return (
      <img
        src={src}
        alt={`${person.firstName} ${person.familyName}`}
        width={40}
        height={50}
        className="rounded object-cover flex-shrink-0"
        onError={(e) => {
          // Swap to swatch fallback if image fails to load
          const img = e.currentTarget;
          img.style.display = 'none';
          const swatch = img.nextElementSibling as HTMLElement | null;
          if (swatch) swatch.style.display = 'block';
        }}
      />
    );
  }

  const tone = person.genetics.visibleTraits.skinTone;
  return (
    <span
      className="inline-block rounded-sm flex-shrink-0"
      style={{
        width:           '40px',
        height:          '50px',
        backgroundColor: skinToneColor(tone),
      }}
      aria-hidden
    />
  );
}
