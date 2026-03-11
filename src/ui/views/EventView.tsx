/**
 * EventView — KoDP-style event card with choice buttons.
 *
 * Phase 1: shows a "no events this season" placeholder when pendingEvents is empty.
 * When events exist (Phase 2+), renders the current event's title, description,
 * and choice buttons that call resolveEventChoice().
 */

import { useGameStore } from '../../stores/game-store';

export default function EventView() {
  const pendingEvents    = useGameStore(s => s.pendingEvents);
  const currentIndex     = useGameStore(s => s.currentEventIndex);
  const resolveChoice    = useGameStore(s => s.resolveEventChoice);
  const nextEvent        = useGameStore(s => s.nextEvent);

  // ── No events ─────────────────────────────────────────────────────────────
  if (pendingEvents.length === 0) {
    return (
      <div className="p-4 flex flex-col items-center justify-center min-h-64">
        <div className="max-w-md w-full bg-stone-800 border border-stone-700 rounded-lg p-6 text-center">
          <div className="text-4xl mb-3">📜</div>
          <h3 className="text-amber-200 font-bold text-lg mb-2">
            A Quiet Season
          </h3>
          <p className="text-stone-400 text-sm italic leading-relaxed">
            The settlement holds its breath. No messengers arrive, no crises
            demand attention. The men go about their work in silence.
            The wilderness watches and waits.
          </p>
        </div>
      </div>
    );
  }

  // ── Active event card ─────────────────────────────────────────────────────
  const event = pendingEvents[currentIndex];
  if (!event) return null;

  return (
    <div className="p-4 flex flex-col items-center">
      {/* Progress indicator */}
      {pendingEvents.length > 1 && (
        <p className="text-stone-500 text-xs mb-3">
          Event {currentIndex + 1} of {pendingEvents.length}
        </p>
      )}

      {/* Event card */}
      <div className="max-w-lg w-full bg-stone-800 border border-amber-800 rounded-lg overflow-hidden shadow-xl">
        {/* Card header */}
        <div className="bg-amber-900 px-5 py-3">
          <span className="text-amber-400 text-xs uppercase tracking-widest font-semibold">
            {event.category}
          </span>
          <h3 className="text-amber-100 font-bold text-xl mt-0.5">{event.title}</h3>
        </div>

        {/* Description */}
        <div className="px-5 py-4">
          <p className="text-stone-300 text-sm leading-relaxed">{event.description}</p>
        </div>

        {/* Choices */}
        <div className="px-5 pb-5 space-y-2">
          {event.choices.map(choice => (
            <button
              key={choice.id}
              onClick={() => {
                resolveChoice(event.id, choice.id);
                nextEvent(); // always advance — nextEvent handles end-of-list by entering management phase
              }}
              className="w-full text-left bg-stone-700 hover:bg-stone-600 active:bg-stone-800
                         border border-stone-600 hover:border-amber-700
                         rounded px-4 py-3 transition-colors"
            >
              <span className="text-amber-200 font-semibold text-sm block">
                {choice.label}
              </span>
              {choice.description && (
                <span className="text-stone-400 text-xs mt-0.5 block">
                  {choice.description}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
