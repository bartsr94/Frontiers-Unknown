/**
 * PeopleView — population roster.
 *
 * Displays all living settlers with their name, age, and current work role.
 * Phase 2 will add trait badges, portrait thumbnails, and clickable detail panels.
 */

import { useState } from 'react';
import { useGameStore } from '../../stores/game-store';
import type { WorkRole } from '../../simulation/population/person';
import PersonDetail from './PersonDetail';

const MAX_COUNCIL = 7;

const ROLE_LABELS: Record<WorkRole, string> = {
  farmer:     'Farmer',
  trader:     'Trader',
  guard:      'Guard',
  craftsman:  'Craftsman',
  healer:     'Healer',
  unassigned: 'Unassigned',
};

const ROLE_COLORS: Record<WorkRole, string> = {
  farmer:     'bg-green-900 text-green-200',
  trader:     'bg-amber-900 text-amber-200',
  guard:      'bg-red-900 text-red-200',
  craftsman:  'bg-stone-700 text-stone-200',
  healer:     'bg-cyan-900 text-cyan-200',
  unassigned: 'bg-stone-800 text-stone-400',
};

export default function PeopleView() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Select the Map reference directly (stable between renders when people haven't changed).
  // Array.from is called in the component body, not inside the selector, to avoid
  // returning a new array reference on every selector invocation (which would cause
  // Zustand to detect a spurious change and re-render infinitely).
  const peopleMap              = useGameStore(s => s.gameState?.people);
  const councilIds             = useGameStore(s => s.gameState?.councilMemberIds ?? []);
  const assignCouncilMember    = useGameStore(s => s.assignCouncilMember);
  const removeCouncilMember    = useGameStore(s => s.removeCouncilMember);
  const people = peopleMap ? Array.from(peopleMap.values()) : [];

  const sorted = [...people].sort((a, b) =>
    `${a.firstName} ${a.familyName}`.localeCompare(`${b.firstName} ${b.familyName}`),
  );

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left: roster table ── */}
      <div className="flex-1 min-w-0 overflow-y-auto p-4">
      <h2 className="text-amber-200 font-bold text-lg mb-3">
        Settlers ({sorted.length})
      </h2>

      <div className="overflow-x-auto rounded-lg border border-stone-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-stone-800 text-amber-400 text-left">
              <th className="px-4 py-2 font-semibold">Name</th>
              <th className="px-4 py-2 font-semibold">Age</th>
              <th className="px-4 py-2 font-semibold">Role</th>
              <th className="px-4 py-2 font-semibold text-center" title="Expedition Council seat">
                Council
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((person, i) => (
              <tr
                key={person.id}
                onClick={() => setSelectedId(id => id === person.id ? null : person.id)}
                className={`border-t border-stone-700 transition-colors cursor-pointer
                            hover:bg-stone-700 active:bg-stone-600
                            ${selectedId === person.id ? 'bg-stone-700 ring-1 ring-inset ring-amber-600' : i % 2 === 0 ? 'bg-stone-800' : 'bg-stone-850'}`}
              >
                <td className="px-4 py-2 text-amber-100 font-medium">
                  {person.firstName} {person.familyName}
                </td>
                <td className="px-4 py-2 text-stone-400">
                  {person.age.toFixed(1)} yrs
                </td>
                <td className="px-4 py-2">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-xs font-semibold
                                ${ROLE_COLORS[person.role]}`}
                  >
                    {ROLE_LABELS[person.role]}
                  </span>
                </td>
                <td className="px-4 py-2 text-center">
                  {(() => {
                    const onCouncil  = councilIds.includes(person.id);
                    const councilFull = councilIds.length >= MAX_COUNCIL;
                    const canAdd     = !onCouncil && !councilFull;
                    return (
                      <button
                        onClick={() =>
                          onCouncil
                            ? removeCouncilMember(person.id)
                            : assignCouncilMember(person.id)
                        }
                        disabled={!onCouncil && councilFull}
                        title={onCouncil ? 'Remove from council' : councilFull ? 'Council is full (7 max)' : 'Add to council'}
                        className={`text-lg leading-none transition-opacity
                                    ${onCouncil ? 'opacity-100' : canAdd ? 'opacity-30 hover:opacity-70' : 'opacity-10 cursor-not-allowed'}`}
                      >
                        {onCouncil ? '⭐' : '☆'}
                      </button>
                    );
                  })()}
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-6 text-center text-stone-500 italic"
                >
                  No settlers recorded.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      </div> {/* end left column */}

      {/* ── Right: person detail panel ── */}
      {selectedId && (
        <PersonDetail
          personId={selectedId}
          onClose={() => setSelectedId(null)}
          onNavigate={id => setSelectedId(id)}
        />
      )}
    </div>
  );
}
