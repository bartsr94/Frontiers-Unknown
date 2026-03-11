/**
 * BottomBar — full-width resource summary strip.
 *
 * Always visible at the very bottom of the screen. Displays the key
 * resource tallies and population count at a glance.
 */

import { useGameStore } from '../../stores/game-store';

interface ResourcePill {
  emoji: string;
  label: string;
  key: string;
}

const PILLS: ResourcePill[] = [
  { emoji: '🌾', label: 'Food',   key: 'food'   },
  { emoji: '🐄', label: 'Cattle', key: 'cattle' },
  { emoji: '📦', label: 'Goods',  key: 'goods'  },
  { emoji: '💰', label: 'Gold',   key: 'gold'   },
  { emoji: '🪵', label: 'Lumber', key: 'lumber' },
  { emoji: '🪨', label: 'Stone',  key: 'stone'  },
];

export default function BottomBar() {
  const gameState = useGameStore(s => s.gameState);
  const resources = gameState?.settlement.resources;
  const people    = gameState?.people;

  // All entries in the people Map are living — dead people move to the graveyard.
  const pop = people ? people.size : 0;

  return (
    <footer className="h-10 bg-stone-900 border-t border-stone-700 flex items-center px-4 gap-5 text-sm shrink-0">
      {PILLS.map(pill => (
        <span key={pill.key} className="flex items-center gap-1.5 text-stone-300">
          <span className="text-base leading-none">{pill.emoji}</span>
          <span className="font-semibold text-amber-200">
            {resources ? Math.floor((resources as Record<string, number>)[pill.key] ?? 0) : '—'}
          </span>
          <span className="text-stone-500 text-xs hidden sm:inline">{pill.label}</span>
        </span>
      ))}

      {/* Divider */}
      <span className="ml-auto text-stone-600">|</span>

      {/* Population */}
      <span className="flex items-center gap-1.5 text-stone-300 ml-1">
        <span className="text-base leading-none">👥</span>
        <span className="font-semibold text-amber-200">{pop}</span>
        <span className="text-stone-500 text-xs hidden sm:inline">Pop</span>
      </span>
    </footer>
  );
}
