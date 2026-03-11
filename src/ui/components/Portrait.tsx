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

import type { Person, CultureId } from '../../simulation/population/person';
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
export function skinToneColor(tone: number): string {
  const h = 22;
  const s = Math.round(25 + tone * 30);
  const l = Math.round(88 - tone * 58);
  return `hsl(${h}, ${s}%, ${l}%)`;
}

/** Returns a short skin-tone adjective for compact badge descriptions. */
function skinToneAdj(tone: number): string {
  if (tone < 0.2)  return 'very fair';
  if (tone < 0.35) return 'fair';
  if (tone < 0.5)  return 'medium';
  if (tone < 0.65) return 'tanned';
  if (tone < 0.75) return 'dark';
  if (tone < 0.9)  return 'very dark';
  return 'deep';
}

/** Returns a prose-ready skin-tone descriptor per spec bands. */
function skinToneProse(tone: number): string {
  if (tone < 0.15) return 'pale';
  if (tone < 0.30) return 'fair';
  if (tone < 0.50) return 'olive';
  if (tone < 0.65) return 'copper';
  if (tone < 0.80) return 'dark copper';
  return 'dark';
}

/** Short group name labels used in prose heritage clauses. */
const GROUP_ABBR: Partial<Record<string, string>> = {
  imanian:             'Imanian',
  kiswani_riverfolk:   'Riverfolk',
  kiswani_bayuk:       'Bayuk Kiswani',
  kiswani_haisla:      'Haisla Kiswani',
  hanjoda_stormcaller: 'Stormcaller Hanjoda',
  hanjoda_bloodmoon:   'Bloodmoon Hanjoda',
  hanjoda_talon:       'Talon Hanjoda',
  hanjoda_emrasi:      'Emrasi Hanjoda',
};

/** Body paint/dye clause by culture — {sex} is replaced at call-site. */
const CULTURE_PAINT: Partial<Record<CultureId, string>> = {
  hanjoda_traditional: 'covered in blue body dye with intricate white patterns',
  sauro_wildborn:      'stained with red ochre across {sex} skin',
  sauro_borderfolk:    'marked with white body paint in geometric patterns',
  kiswani_traditional: 'decorated with plant-based body paints',
};

/**
 * Builds a natural-language prose paragraph describing a person's appearance.
 *
 * Example:
 *   "A tall, copper-skinned woman with beautiful amber eyes.
 *    Her features show both Imanian and Riverfolk heritage."
 */
export function buildProseDescription(person: Person): string {
  const v       = person.genetics.visibleTraits;
  const sexWord = person.sex === 'female' ? 'woman' : 'man';
  const herHis  = person.sex === 'female' ? 'Her'   : 'His';

  const heightAdj: Record<string, string> = {
    short:         'short',
    below_average: 'slight',
    average:       '',
    tall:          'tall',
    very_tall:     'very tall',
  };

  const undertoneClause: Record<string, string> = {
    cool_pink:  'with cool undertones',
    warm_olive: 'with a warm olive cast',
    copper:     'with a coppery warmth',
    bronze:     'with a bronzed richness',
    neutral:    '',
  };

  // Optional leading aptitude descriptors
  const aptitudes: string[] = [];
  if (person.traits.includes('beautiful')) aptitudes.push('strikingly beautiful');
  if (person.traits.includes('strong'))    aptitudes.push('powerfully built');

  const hi      = heightAdj[v.height] ?? '';
  const skin    = skinToneProse(v.skinTone);
  const utClause = undertoneClause[v.skinUndertone] ?? '';

  const heightPart = hi ? `${hi}, ` : '';
  const leadDesc   = aptitudes.length > 0
    ? `${aptitudes.join(', ')}, ${heightPart}${skin}-skinned ${sexWord}`
    : `A ${heightPart}${skin}-skinned ${sexWord}`;

  const undertoneStr = utClause ? ` ${utClause}` : '';
  const hairStr  = `${HAIR_COLOR_LABEL[v.hairColor]} ${HAIR_TEXTURE_LABEL[v.hairTexture]}`;
  const eyeStr   = EYE_COLOR_LABEL[v.eyeColor];
  const buildStr = BUILD_LABEL[v.buildType];

  let prose = `${leadDesc}${undertoneStr} with ${hairStr} hair, ${eyeStr} eyes, and a ${buildStr} build.`;

  // Heritage clause when genuinely mixed (two+ groups each > 20%)
  const mixedEntries = person.heritage.bloodline
    .filter(e => e.fraction > 0.20)
    .sort((a, b) => b.fraction - a.fraction);
  if (mixedEntries.length >= 2) {
    const labelA = GROUP_ABBR[mixedEntries[0]!.group] ?? mixedEntries[0]!.group;
    const labelB = GROUP_ABBR[mixedEntries[1]!.group] ?? mixedEntries[1]!.group;
    prose += ` ${herHis} features show both ${labelA} and ${labelB} heritage.`;
  }

  // Body paint/dye clause
  const paint = CULTURE_PAINT[person.culturalIdentity as CultureId];
  if (paint) {
    const paintStr = paint.replace('{sex}', person.sex === 'female' ? 'her' : 'his');
    prose += ` ${herHis} skin is ${paintStr}.`;
  }

  return prose;
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

  const prose = buildProseDescription(person);

  return (
    <div
      className="rounded-lg overflow-hidden border border-stone-600"
      style={{ background: `linear-gradient(135deg, ${bgColor}33 0%, #1c1208 100%)` }}
    >
      <div className="flex gap-3 items-start p-3">
        {/* Silhouette swatch */}
        <div
          className="relative flex-shrink-0 w-14 h-18 rounded border border-stone-600 overflow-hidden"
          style={{ backgroundColor: bgColor, width: '3.5rem', height: '4.5rem' }}
          aria-hidden="true"
        >
          <svg viewBox="0 0 56 72" className="absolute inset-0 w-full h-full" aria-hidden="true">
            <circle cx="28" cy="22" r="12" fill="rgba(0,0,0,0.20)" />
            <ellipse cx="28" cy="60" rx="19" ry="14" fill="rgba(0,0,0,0.20)" />
            <circle cx="28" cy="18" r="12.5" fill={hairColorSwatchHex(v.hairColor)} opacity="0.50" />
          </svg>
        </div>

        {/* Prose description */}
        <div className="flex flex-col gap-1.5 text-sm flex-1 min-w-0">
          <p className="text-stone-200 leading-relaxed italic">
            {prose}
          </p>
          {person.genetics.extendedFertility && person.sex === 'female' && (
            <span
              className="text-amber-500 text-xs font-medium"
              title="Kethara's Bargain — extended fertility through the maternal line"
            >
              ✦ Kethara's Bargain
            </span>
          )}
        </div>
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


