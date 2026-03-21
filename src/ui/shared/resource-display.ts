/**
 * Shared resource display data — emoji icons, display labels, and the canonical
 * ordered list of all nine ResourceTypes for use across UI components.
 *
 * Import from here rather than defining these locally in each component.
 * This is the single source of truth; adding a future resource type means
 * updating exactly this one file.
 */

import type { ResourceType } from '../../simulation/turn/game-state';

/**
 * Period-style Unicode glyphs for each resource.
 * Prefer these over emoji — they render consistently as plain text across OSes
 * and read as typeset/carved rather than digitally modern.
 */
export const RESOURCE_EMOJI: Partial<Record<ResourceType, string>> = {
  food:     '✦',
  cattle:   '⁂',
  wealth:   '◆',
  lumber:   '⌘',
  stone:    '◼',
  medicine: '✚',
  steel:    '⚔',
  horses:   '⋈',
};

/** Full display label for each resource. */
export const RESOURCE_LABEL: Record<ResourceType, string> = {
  food:     'Food',
  cattle:   'Cattle',
  wealth:   'Wealth',
  lumber:   'Lumber',
  stone:    'Stone',
  medicine: 'Medicine',
  steel:    'Steel',
  horses:   'Horses',
};

/** All eight resources in canonical display order (glyph + label bundled for convenience). */
export const ALL_RESOURCES: ReadonlyArray<{ key: ResourceType; emoji: string; label: string }> = [
  { key: 'food',     emoji: '✦',  label: 'Food'     },
  { key: 'cattle',   emoji: '⁂',  label: 'Cattle'   },
  { key: 'wealth',   emoji: '◆',  label: 'Wealth'   },
  { key: 'lumber',   emoji: '⌘',  label: 'Lumber'   },
  { key: 'stone',    emoji: '◼',  label: 'Stone'    },
  { key: 'medicine', emoji: '✚',  label: 'Medicine' },
  { key: 'steel',    emoji: '⚔',  label: 'Steel'    },
  { key: 'horses',   emoji: '⋈',  label: 'Horses'   },
];
