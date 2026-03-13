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

import { useState, useEffect } from 'react';
import { useGameStore } from '../../stores/game-store';
import type { WorkRole, Person } from '../../simulation/population/person';
import { generateAdvice, hashPersonEvent } from '../../simulation/events/council-advice';
import CouncilPortrait from '../components/CouncilPortrait';
import AdviceBubble from '../components/AdviceBubble';
import { ROLE_LABELS as BASE_ROLE_LABELS, ROLE_COLORS, MAX_COUNCIL_SEATS } from '../shared/role-display';

// CouncilFooter shows '—' for unassigned seats rather than the full word.
const ROLE_LABELS: Record<WorkRole, string> = { ...BASE_ROLE_LABELS, unassigned: '—' };

export default function CouncilFooter() {
  const gameState         = useGameStore(s => s.gameState);
  const currentPhase      = useGameStore(s => s.currentPhase);
  const pendingEvents     = useGameStore(s => s.pendingEvents);
  const currentEventIndex = useGameStore(s => s.currentEventIndex);

  const [selectedAdviserId, setSelectedAdviserId] = useState<string | null>(null);
  // Cache: key = `${personId}:${eventId}` → generated advice string
  const [adviceCache, setAdviceCache] = useState<Record<string, string>>({});
  // Collapsed by default outside event phase; auto-expands during events.
  const [collapsed, setCollapsed] = useState(true);

  const councilIds = gameState?.councilMemberIds ?? [];
  const people     = gameState?.people;

  // Current event is only meaningful during the event phase
  const currentEvent =
    currentPhase === 'event' ? (pendingEvents[currentEventIndex] ?? null) : null;

  // Build an array of MAX_COUNCIL_SEATS entries: Person | null
  const seats: Array<Person | null> = Array.from({ length: MAX_COUNCIL_SEATS }, (_, i) => {
    const id = councilIds[i];
    if (!id || !people) return null;
    return people.get(id) ?? null;
  });

  // Auto-expand during event phase; collapse when leaving it.
  useEffect(() => {
    if (currentPhase === 'event') {
      setCollapsed(false);
    } else {
      setCollapsed(true);
    }
  }, [currentPhase]);

  function handleCardClick(person: Person) {
    // Away persons are off-site; suppress advice generation for them.
    if (person.role === 'away') {
      setSelectedAdviserId(person.id);
      return;
    }

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

  const filledCount = seats.filter(Boolean).length;

  return (
    <div className="border-t-2 border-amber-700 bg-stone-950 px-4 py-3">

      {/* Header row — always visible, acts as collapse toggle */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between mb-1 group"
        aria-expanded={!collapsed}
      >
        <p className="text-amber-600 text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5">
          <span className="text-stone-500 text-[10px]">{collapsed ? '▶' : '▼'}</span>
          Expedition Council
        </p>
        <span className="text-stone-600 text-xs group-hover:text-stone-400 transition-colors">
          {filledCount}/{MAX_COUNCIL_SEATS} seats
        </span>
      </button>

      {!collapsed && (
        <>
          {/* Advice bubble — only shown in event phase when an adviser is selected */}
          {activeAdvice && selectedPerson && (
            <AdviceBubble
              text={activeAdvice}
              advisorName={`${selectedPerson.firstName} ${selectedPerson.familyName}`}
              advisorRole={selectedPerson.role}
            />
          )}

          <div className="flex gap-3">
            {seats.map((person, i) =>
              person ? (
                <button
                  key={person.id}
                  onClick={() => handleCardClick(person)}
                  className={`flex-1 min-w-0 bg-stone-800 border rounded px-3 py-2.5 text-left
                              transition-colors cursor-pointer
                              ${person.role === 'away' ? 'opacity-50' : ''}
                              ${selectedAdviserId === person.id
                                ? 'border-amber-400 ring-1 ring-amber-400'
                                : 'border-amber-800 hover:border-amber-600'}`}
                >
                  <div className="flex items-start gap-2.5">
                    <CouncilPortrait person={person} />
                    <div className="min-w-0">
                      <p className="text-amber-100 text-sm font-semibold truncate leading-tight">
                        {person.firstName} {person.familyName}
                      </p>
                      <span
                        className={`mt-1 inline-block px-2 py-1 rounded text-xs font-bold leading-none
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
                  className="flex-1 min-w-0 border border-dashed border-stone-700 rounded px-3 py-2.5 flex items-center justify-center"
                >
                  <span className="text-stone-600 text-sm">Empty</span>
                </div>
              ),
            )}
          </div>
        </>
      )}
    </div>
  );
}
