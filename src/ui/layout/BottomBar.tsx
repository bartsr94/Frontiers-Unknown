/**
 * BottomBar — full-width resource summary strip.
 *
 * Always visible at the very bottom of the screen. Displays the key
 * resource tallies and population count at a glance.
 * Net-per-turn deltas are shown in green/red alongside each resource value.
 */

import { useGameStore } from '../../stores/game-store';
import { calculateProduction, calculateConsumption, addResourceStocks } from '../../simulation/economy/resources';
import type { ResourceType } from '../../simulation/turn/game-state';
import { ALL_RESOURCES } from '../shared/resource-display';

// Display only the six resources shown in the bottom bar summary strip.
const BOTTOM_BAR_KEYS: ReadonlySet<ResourceType> = new Set(
  ['food', 'cattle', 'goods', 'gold', 'lumber', 'stone'] as const,
);
const PILLS = ALL_RESOURCES.filter(r => BOTTOM_BAR_KEYS.has(r.key));

export default function BottomBar() {
  const gameState = useGameStore(s => s.gameState);
  const resources = gameState?.settlement.resources;
  const people    = gameState?.people;
  const season    = gameState?.currentSeason ?? 'spring';
  const settlement = gameState?.settlement;

  // All entries in the people Map are living — dead people move to the graveyard.
  const pop = people ? people.size : 0;

  // Compute net-per-turn deltas for the current season.
  const netDelta = (people && settlement)
    ? addResourceStocks(
        calculateProduction(people, settlement, season),
        calculateConsumption(people),
      )
    : null;

  return (
    <footer className="h-10 bg-stone-900 border-t border-stone-700 flex items-center px-4 gap-5 text-sm shrink-0">
      {PILLS.map(pill => {
        const current = resources ? Math.floor(resources[pill.key] ?? 0) : null;
        const delta   = netDelta ? netDelta[pill.key] : 0;
        const deltaLabel = delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : null;
        const deltaClass = delta > 0 ? 'text-green-400' : 'text-red-400';
        const tooltipText = deltaLabel
          ? `Net this season: ${deltaLabel}/turn`
          : undefined;

        return (
          <span key={pill.key} className="flex items-center gap-1 text-stone-300" title={tooltipText}>
            <span className="text-base leading-none">{pill.emoji}</span>
            <span className="font-semibold text-amber-200">
              {current !== null ? current : '—'}
            </span>
            {deltaLabel && (
              <span className={`text-xs font-medium ${deltaClass}`}>{deltaLabel}</span>
            )}
            <span className="text-stone-500 text-xs hidden sm:inline ml-0.5">{pill.label}</span>
          </span>
        );
      })}

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
