/**
 * TopBar — persistent header showing current game stats.
 *
 * Displays: season, year, food stock, wealth stock, population.
 * Read-only: dispatches no actions. Re-renders whenever the store updates.
 */

import { useGameStore } from '../../stores/game-store';

const SEASON_LABELS: Record<string, string> = {
  spring: 'Spring',
  summer: 'Summer',
  autumn: 'Autumn',
  winter: 'Winter',
};

const SEASON_COLORS: Record<string, string> = {
  spring: 'text-green-300',
  summer: 'text-yellow-300',
  autumn: 'text-orange-300',
  winter: 'text-blue-300',
};

interface StatPillProps {
  label: string;
  value: number | string;
  accent?: string;
}

function StatPill({ label, value, accent = 'text-amber-100' }: StatPillProps) {
  return (
    <div className="flex items-center gap-1.5 bg-amber-950 rounded px-2.5 py-1">
      <span className="text-amber-500 text-xs uppercase tracking-wider font-semibold">
        {label}
      </span>
      <span className={`font-bold text-sm ${accent}`}>{value}</span>
    </div>
  );
}

export default function TopBar() {
  const gameState = useGameStore(s => s.gameState);

  if (!gameState) return null;

  const { currentSeason, currentYear, settlement } = gameState;
  const { resources, populationCount } = settlement;

  return (
    <header className="bg-amber-900 border-b border-amber-800 px-4 py-2 flex items-center gap-3 flex-wrap">
      {/* Settlement name */}
      <span className="text-amber-200 font-bold text-sm mr-1">
        {settlement.name}
      </span>

      <div className="h-4 w-px bg-amber-700" aria-hidden />

      {/* Season & year */}
      <div className="flex items-center gap-1.5">
        <span className={`font-semibold text-sm ${SEASON_COLORS[currentSeason] ?? 'text-amber-100'}`}>
          {SEASON_LABELS[currentSeason] ?? currentSeason}
        </span>
        <span className="text-amber-500 text-sm">·</span>
        <span className="text-amber-200 text-sm">Year {currentYear}</span>
      </div>

      <div className="h-4 w-px bg-amber-700" aria-hidden />

      {/* Resources */}
      <div className="flex items-center gap-2 flex-wrap">
        <StatPill label="Food"   value={resources.food}   accent="text-green-200" />
        <StatPill label="Wealth" value={resources.wealth} accent="text-amber-200" />
        <StatPill label="Cattle" value={resources.cattle} accent="text-orange-200" />
      </div>

      <div className="h-4 w-px bg-amber-700" aria-hidden />

      {/* Population */}
      <StatPill label="Pop" value={populationCount} accent="text-amber-100" />
    </header>
  );
}
