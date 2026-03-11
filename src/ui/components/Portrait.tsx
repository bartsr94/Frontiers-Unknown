/**
 * Portrait component — renders a visual + text description of a person's
 * physical appearance from their GeneticProfile.
 *
 * Phase 2 approach: a skin-tone tinted silhouette + a structured prose
 * description generated from VisibleTraits. The component is architected
 * for Phase 3 sprite-layer upgrade — the trait-to-text mapping functions
 * will feed the sprite selection logic when art assets are available.
 *
 * Two size variants:
 *   'sm'  — compact badge for roster rows (16 px swatch + short inline text)
 *   'lg'  — full portrait card for detail views
 */

import type { Person } from '../../simulation/population/person';
import type {
  Undertone,
  HairColor,
  HairTexture,
  EyeColor,
  BuildType,
  HeightClass,
} from '../../simulation/genetics/traits';

// ─── Trait label maps ─────────────────────────────────────────────────────────

const UNDERTONE_ADJ: Record<Undertone, string> = {
  cool_pink:  'cool-toned',
  warm_olive: 'warm-toned',
  copper:     'copper-toned',
  bronze:     'bronze-toned',
  neutral:    'neutral-toned',
};

const HAIR_COLOR_LABEL: Record<HairColor, string> = {
  blonde:      'blonde',
  light_brown: 'light brown',
  dark_brown:  'dark brown',
  black:       'black',
  red:         'red',
  auburn:      'auburn',
  grey:        'grey',
};

const HAIR_TEXTURE_LABEL: Record<HairTexture, string> = {
  straight: 'straight',
  wavy:     'wavy',
  curly:    'curly',
  coily:    'coily',
};

const EYE_COLOR_LABEL: Record<EyeColor, string> = {
  brown:  'brown',
  grey:   'grey',
  blue:   'blue',
  amber:  'amber',
  green:  'green',
  hazel:  'hazel',
};

const BUILD_LABEL: Record<BuildType, string> = {
  lean:     'lean',
  athletic: 'athletic',
  stocky:   'stocky',
  wiry:     'wiry-gaunt',
  heavyset: 'heavyset',
};

const HEIGHT_LABEL: Record<HeightClass, string> = {
  short:         'short',
  below_average: 'below-average height',
  average:       'average height',
  tall:          'tall',
  very_tall:     'very tall',
};

// ─── Skin tone colour ─────────────────────────────────────────────────────────

/**
 * Converts a 0–1 skin tone value to a CSS hsl() colour string.
 *
 * Calibrated so:
 *   0.0 → very pale peachy white (hsl 22, 25%, 88%)
 *   0.2 → fair Imanian (hsl 22, 31%, 76%)
 *   0.5 → medium tan (hsl 22, 40%, 58%)
 *   0.75 → deep brown (hsl 22, 48%, 43%)
 *   1.0 → very dark (hsl 22, 55%, 30%)
 */
function skinToneColor(tone: number): string {
  const h = 22;
  const s = Math.round(25 + tone * 30);
  const l = Math.round(88 - tone * 58);
  return `hsl(${h}, ${s}%, ${l}%)`;
}

/** Returns a short skin-tone adjective for prose descriptions. */
function skinToneAdj(tone: number): string {
  if (tone < 0.2)  return 'very fair';
  if (tone < 0.35) return 'fair';
  if (tone < 0.5)  return 'medium';
  if (tone < 0.65) return 'tanned';
  if (tone < 0.75) return 'dark';
  if (tone < 0.9)  return 'very dark';
  return 'deep';
}

// ─── Description builder ──────────────────────────────────────────────────────

/**
 * Builds the full text description line for a person's visible traits.
 *
 * Example output:
 *   "Fair cool-toned skin · blonde wavy hair · blue eyes · athletic, tall"
 */
export function buildAppearanceDescription(person: Person): string {
  const v = person.genetics.visibleTraits;
  const skin = `${skinToneAdj(v.skinTone)} ${UNDERTONE_ADJ[v.skinUndertone]} skin`;
  const hair = `${HAIR_COLOR_LABEL[v.hairColor]} ${HAIR_TEXTURE_LABEL[v.hairTexture]} hair`;
  const eyes = `${EYE_COLOR_LABEL[v.eyeColor]} eyes`;
  const build = `${BUILD_LABEL[v.buildType]}, ${HEIGHT_LABEL[v.height]}`;
  return `${skin} · ${hair} · ${eyes} · ${build}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface PortraitProps {
  person: Person;
  /** Display variant. 'sm' = compact roster badge; 'lg' = full detail card. */
  variant?: 'sm' | 'lg';
}

/**
 * Renders a portrait swatch + appearance description for a person.
 *
 * - `sm` variant: a small coloured circle + a single italic description tag line
 * - `lg` variant: a larger silhouette swatch, the full description, and ethnic origin
 */
export default function Portrait({ person, variant = 'sm' }: PortraitProps) {
  const v = person.genetics.visibleTraits;
  const bgColor = skinToneColor(v.skinTone);

  // ── Compact variant ────────────────────────────────────────────────────────
  if (variant === 'sm') {
    return (
      <span className="inline-flex items-center gap-1.5" title={buildAppearanceDescription(person)}>
        {/* Skin-tone swatch */}
        <span
          className="inline-block w-3 h-3 rounded-full border border-stone-600 flex-shrink-0"
          style={{ backgroundColor: bgColor }}
          aria-hidden="true"
        />
        {/* Eye colour dot */}
        <span className="text-xs text-stone-400 italic truncate">
          {EYE_COLOR_LABEL[v.eyeColor]} eyes
        </span>
      </span>
    );
  }

  // ── Full variant ───────────────────────────────────────────────────────────

  // Derive the dominant ethnic group for the "origin" line.
  const dominantEntry = [...person.heritage.bloodline].sort((a, b) => b.fraction - a.fraction)[0];
  const dominantGroup = dominantEntry?.group ?? 'imanian';
  const groupLabel = dominantGroup
    .replace('_', ' ')
    .replace(/\b\w/g, c => c.toUpperCase());

  const hairLabel = `${HAIR_COLOR_LABEL[v.hairColor]} ${HAIR_TEXTURE_LABEL[v.hairTexture]}`;

  return (
    <div className="flex gap-4 items-start">
      {/* Silhouette swatch */}
      <div
        className="relative flex-shrink-0 w-16 h-20 rounded-lg border border-stone-600 overflow-hidden"
        style={{ backgroundColor: bgColor }}
        aria-hidden="true"
      >
        {/* Simple SVG head + shoulders silhouette */}
        <svg
          viewBox="0 0 64 80"
          className="absolute inset-0 w-full h-full"
          aria-hidden="true"
        >
          {/* Head */}
          <circle cx="32" cy="26" r="14" fill="rgba(0,0,0,0.18)" />
          {/* Shoulders */}
          <ellipse cx="32" cy="68" rx="22" ry="16" fill="rgba(0,0,0,0.18)" />
          {/* Hair overlay — tinted by hair colour */}
          <circle cx="32" cy="22" r="14.5" fill={hairColorSwatchHex(v.hairColor)} opacity="0.55" />
        </svg>
      </div>

      {/* Trait text block */}
      <div className="flex flex-col gap-1 text-sm min-w-0">
        <p className="text-stone-300 leading-snug">
          <span className="capitalize">{skinToneAdj(v.skinTone)}</span>{' '}
          <span className="text-stone-400">{UNDERTONE_ADJ[v.skinUndertone]}</span> skin
        </p>
        <p className="text-stone-300">
          {hairLabel} hair ·{' '}
          <span style={{ color: eyeColorHex(v.eyeColor) }} className="font-medium">
            {EYE_COLOR_LABEL[v.eyeColor]} eyes
          </span>
        </p>
        <p className="text-stone-400">
          {BUILD_LABEL[v.buildType]} · {HEIGHT_LABEL[v.height]}
        </p>
        <p className="text-stone-500 text-xs italic mt-0.5">
          {groupLabel} heritage
          {person.genetics.extendedFertility && person.sex === 'female' && (
            <span className="ml-1 text-amber-600" title="Kethara's Bargain — extended fertility">✦</span>
          )}
        </p>
      </div>
    </div>
  );
}

// ─── Colour helpers ───────────────────────────────────────────────────────────

/** Returns an approximate CSS hex colour for each hair colour, used as a SVG tint. */
function hairColorSwatchHex(color: HairColor): string {
  switch (color) {
    case 'blonde':      return '#e8cc80';
    case 'light_brown': return '#c89060';
    case 'dark_brown':  return '#6b3d20';
    case 'black':       return '#1c1008';
    case 'red':         return '#b84420';
    case 'auburn':      return '#8b3a18';
    case 'grey':        return '#a0a0a0';
  }
}

/** Returns an approximate CSS hex for eye-colour labels used in text. */
function eyeColorHex(color: EyeColor): string {
  switch (color) {
    case 'brown':  return '#c8905a';
    case 'grey':   return '#9eaab8';
    case 'blue':   return '#7ab0d4';
    case 'amber':  return '#e8c050';
    case 'green':  return '#78b878';
    case 'hazel':  return '#b0906a';
  }
}
