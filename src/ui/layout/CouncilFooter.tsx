/**
 * CouncilFooter — Expedition Council seat strip.
 *
 * Shows up to 7 council seat cards. Occupied seats display the member's
 * name and role badge. Empty seats render as dashed placeholders.
 *
 * Sits anchored to the bottom of the main content column, above the BottomBar.
 */

import { useGameStore } from '../../stores/game-store';
import type { WorkRole } from '../../simulation/population/person';

const ROLE_LABELS: Record<WorkRole, string> = {
  farmer:     'Farmer',
  trader:     'Trader',
  guard:      'Guard',
  craftsman:  'Craftsman',
  healer:     'Healer',
  unassigned: '—',
};

const ROLE_COLORS: Record<WorkRole, string> = {
  farmer:     'bg-green-900 text-green-300',
  trader:     'bg-amber-900 text-amber-300',
  guard:      'bg-red-900 text-red-300',
  craftsman:  'bg-stone-700 text-stone-300',
  healer:     'bg-cyan-900 text-cyan-300',
  unassigned: 'bg-stone-800 text-stone-500',
};

const MAX_SEATS = 7;

export default function CouncilFooter() {
  const gameState = useGameStore(s => s.gameState);

  const councilIds = gameState?.councilMemberIds ?? [];
  const people     = gameState?.people;

  // Build an array of MAX_SEATS entries: Person | null
  const seats = Array.from({ length: MAX_SEATS }, (_, i) => {
    const id = councilIds[i];
    if (!id || !people) return null;
    return people.get(id) ?? null;
  });

  return (
    <div className="border-t border-amber-900 bg-amber-950 px-3 py-2">
      <p className="text-amber-500 text-xs font-semibold uppercase tracking-wide mb-1.5">
        Expedition Council
      </p>

      <div className="flex gap-2">
        {seats.map((person, i) =>
          person ? (
            <div
              key={person.id}
              className="flex-1 min-w-0 bg-stone-800 border border-amber-800 rounded px-2 py-1.5"
            >
              <p className="text-amber-100 text-xs font-semibold truncate leading-tight">
                {person.firstName} {person.familyName}
              </p>
              <span
                className={`mt-0.5 inline-block px-1.5 py-0.5 rounded text-[10px] font-bold leading-none
                            ${ROLE_COLORS[person.role]}`}
              >
                {ROLE_LABELS[person.role]}
              </span>
            </div>
          ) : (
            <div
              key={`empty-${i}`}
              className="flex-1 min-w-0 border border-dashed border-stone-700 rounded px-2 py-1.5 flex items-center justify-center"
            >
              <span className="text-stone-600 text-xs">Empty</span>
            </div>
          ),
        )}
      </div>
    </div>
  );
}
