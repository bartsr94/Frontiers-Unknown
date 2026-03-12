/**
 * CouncilFooter — Expedition Council seat strip.
 *
 * Shows up to 7 council seat cards. Occupied seats display a portrait badge,
 * the member's name, and a role badge.
 *
 * During the event phase:
 *  - Clicking a card selects that adviser.
 *  - An AdviceBubble appears above the seat strip with in-character advice.
 *  - Advice is cached locally per (personId × eventId) pair and is fully
 *    deterministic — no RNG consumed.
 *
 * Outside the event phase seats are still clickable (selection state persists)
 * but no bubble is shown (future: navigate to PersonDetail).
 *
 * Sits anchored to the bottom of the main content column, above the BottomBar.
 */

import { useState } from 'react';
import { useGameStore } from '../../stores/game-store';
import type { WorkRole, Person } from '../../simulation/population/person';
import { generateAdvice, hashPersonEvent } from '../../simulation/events/council-advice';
import CouncilPortrait from '../components/CouncilPortrait';
import AdviceBubble from '../components/AdviceBubble';

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
  const gameState         = useGameStore(s => s.gameState);
  const currentPhase      = useGameStore(s => s.currentPhase);
  const pendingEvents     = useGameStore(s => s.pendingEvents);
  const currentEventIndex = useGameStore(s => s.currentEventIndex);

  const [selectedAdviserId, setSelectedAdviserId] = useState<string | null>(null);
  // Cache: key = `${personId}:${eventId}` → generated advice string
  const [adviceCache, setAdviceCache] = useState<Record<string, string>>({});

  const councilIds = gameState?.councilMemberIds ?? [];
  const people     = gameState?.people;

  // Current event is only meaningful during the event phase
  const currentEvent =
    currentPhase === 'event' ? (pendingEvents[currentEventIndex] ?? null) : null;

  // Build an array of MAX_SEATS entries: Person | null
  const seats: Array<Person | null> = Array.from({ length: MAX_SEATS }, (_, i) => {
    const id = councilIds[i];
    if (!id || !people) return null;
    return people.get(id) ?? null;
  });

  function handleCardClick(person: Person) {
    setSelectedAdviserId(person.id);

    if (!currentEvent) return;

    const cacheKey = `${person.id}:${currentEvent.id}`;
    if (!adviceCache[cacheKey]) {
      const seed   = hashPersonEvent(person.id, currentEvent.id);
      const advice = generateAdvice(person, currentEvent, seed);
      setAdviceCache(prev => ({ ...prev, [cacheKey]: advice }));
    }
  }

  const selectedPerson = selectedAdviserId
    ? (people?.get(selectedAdviserId) ?? null)
    : null;

  const activeAdvice =
    selectedPerson && currentEvent
      ? (adviceCache[`${selectedPerson.id}:${currentEvent.id}`] ?? null)
      : null;

  return (
    <div className="border-t border-amber-900 bg-amber-950 px-3 py-2">
      <p className="text-amber-500 text-xs font-semibold uppercase tracking-wide mb-1.5">
        Expedition Council
      </p>

      {/* Advice bubble — only shown in event phase when an adviser is selected */}
      {activeAdvice && selectedPerson && (
        <AdviceBubble
          text={activeAdvice}
          advisorName={`${selectedPerson.firstName} ${selectedPerson.familyName}`}
          advisorRole={selectedPerson.role}
        />
      )}

      <div className="flex gap-2">
        {seats.map((person, i) =>
          person ? (
            <button
              key={person.id}
              onClick={() => handleCardClick(person)}
              className={`flex-1 min-w-0 bg-stone-800 border rounded px-2 py-1.5 text-left
                          transition-colors cursor-pointer
                          ${selectedAdviserId === person.id
                            ? 'border-amber-400 ring-1 ring-amber-400'
                            : 'border-amber-800 hover:border-amber-600'}`}
            >
              <div className="flex items-start gap-1.5">
                <CouncilPortrait person={person} />
                <div className="min-w-0">
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
              </div>
            </button>
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
