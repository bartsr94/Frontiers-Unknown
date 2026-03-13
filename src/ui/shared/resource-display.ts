/**
 * Shared resource display data — emoji icons, display labels, and the canonical
 * ordered list of all nine ResourceTypes for use across UI components.
 *
 * Import from here rather than defining these locally in each component.
 * This is the single source of truth; adding a future resource type means
 * updating exactly this one file.
 */

import type { ResourceType } from '../../simulation/turn/game-state';

/** Emoji icon for each resource. Use for compact resource labels throughout the UI. */
export const RESOURCE_EMOJI: Partial<Record<ResourceType, string>> = {
  food:     '🌾',
  cattle:   '🐄',
  goods:    '📦',
  gold:     '💰',
  lumber:   '🪵',
  stone:    '🪨',
  medicine: '💊',
  steel:    '⚙️',
  horses:   '🐎',
};

/** Full display label for each resource. */
export const RESOURCE_LABEL: Record<ResourceType, string> = {
  food:     'Food',
  cattle:   'Cattle',
  goods:    'Goods',
  gold:     'Gold',
  lumber:   'Lumber',
  stone:    'Stone',
  medicine: 'Medicine',
  steel:    'Steel',
  horses:   'Horses',
};

/** All nine resources in canonical display order (emoji + label bundled for convenience). */
export const ALL_RESOURCES: ReadonlyArray<{ key: ResourceType; emoji: string; label: string }> = [
  { key: 'food',     emoji: '🌾', label: 'Food'     },
  { key: 'cattle',   emoji: '🐄', label: 'Cattle'   },
  { key: 'goods',    emoji: '📦', label: 'Goods'    },
  { key: 'gold',     emoji: '💰', label: 'Gold'     },
  { key: 'lumber',   emoji: '🪵', label: 'Lumber'   },
  { key: 'stone',    emoji: '🪨', label: 'Stone'    },
  { key: 'medicine', emoji: '💊', label: 'Medicine' },
  { key: 'steel',    emoji: '⚙️', label: 'Steel'    },
  { key: 'horses',   emoji: '🐎', label: 'Horses'   },
];
