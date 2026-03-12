/**
 * EventView — KoDP-style event card with three-phase UI.
 *
 * Phase flow:
 *   'choosing'  → event description + choices
 *   'outcome'   → skill check result panel + consequence text + Continue
 *   'pending'   → deferred event acknowledgement + "outcome expected in ~N turns"
 *
 * Local state drives which panel is shown. The store's lastChoiceResult is
 * read synchronously (via getState) immediately after resolveEventChoice
 * returns to determine the next phase.
 */

import { useState, useEffect } from 'react';
import { useGameStore } from '../../stores/game-store';
import type { SkillCheckResult } from '../../simulation/events/engine';
import type { Person } from '../../simulation/population/person';
import { interpolateText } from '../../simulation/events/actor-resolver';
import { skinToneColor } from '../components/Portrait';

// ─── Actor badge ──────────────────────────────────────────────────────────────

function ActorBadge({ person }: { person: Person }) {
  const bgColor = skinToneColor(person.genetics.visibleTraits.skinTone);
  return (
    <span className="inline-flex items-center gap-1.5 bg-stone-700/80 border border-stone-600 rounded px-2 py-1">
      <span
        className="w-3 h-3 rounded-full border border-stone-500 flex-shrink-0"
        style={{ backgroundColor: bgColor }}
        aria-hidden="true"
      />
      <span className="text-xs text-stone-200 font-medium">
        {person.firstName} {person.familyName}
      </span>
    </span>
  );
}

// ─── Skill check result panel ─────────────────────────────────────────────────

function SkillCheckPanel({ result }: { result: SkillCheckResult }) {
  const pct = Math.round((result.actorScore / 100) * 100);
  const diffPct = Math.round((result.difficulty / 100) * 100);

  return (
    <div className={`rounded p-3 border text-sm ${
      result.passed
        ? 'bg-green-900/40 border-green-700'
        : 'bg-red-900/40 border-red-700'
    }`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-stone-300 font-semibold capitalize">
          {result.actorName}
        </span>
        <span className={`font-bold text-xs uppercase tracking-wider ${
          result.passed ? 'text-green-400' : 'text-red-400'
        }`}>
          {result.passed ? 'Success' : 'Failure'}
        </span>
      </div>

      {/* Skill bar */}
      <div className="relative h-3 bg-stone-700 rounded overflow-hidden mb-1">
        {/* Actor score bar */}
        <div
          className={`absolute h-full rounded transition-all ${
            result.passed ? 'bg-green-500' : 'bg-amber-600'
          }`}
          style={{ width: `${pct}%` }}
        />
        {/* Difficulty marker */}
        <div
          className="absolute top-0 h-full w-0.5 bg-white/70"
          style={{ left: `${diffPct}%` }}
        />
      </div>

      <div className="flex justify-between text-xs text-stone-400 mt-0.5">
        <span className="capitalize">{result.skill} score: <strong className="text-stone-200">{result.actorScore}</strong></span>
        <span>Difficulty: <strong className="text-stone-200">{result.difficulty}</strong></span>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type ViewPhase = 'choosing' | 'outcome' | 'pending';

export default function EventView() {
  const pendingEvents    = useGameStore(s => s.pendingEvents);
  const currentIndex     = useGameStore(s => s.currentEventIndex);
  const resolveChoice    = useGameStore(s => s.resolveEventChoice);
  const nextEvent        = useGameStore(s => s.nextEvent);
  const gameState        = useGameStore(s => s.gameState);

  const [viewPhase, setViewPhase]           = useState<ViewPhase>('choosing');
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);

  // Reset to 'choosing' when the event changes.
  const event = pendingEvents[currentIndex];
  useEffect(() => {
    setViewPhase('choosing');
    setSelectedChoiceId(null);
  }, [event?.id]);

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

  if (!event) return null;

  // ── Build slot → Person map and interpolation helper ─────────────────────
  const resolvedSlots: Record<string, Person> = {};
  if (gameState) {
    for (const [slot, id] of Object.entries(event.boundActors ?? {})) {
      const person = gameState.people.get(id);
      if (person) resolvedSlots[slot] = person;
    }
  }
  const interp = (text: string) => interpolateText(text, resolvedSlots);

  // ── Actor strip (shown when at least one slot is bound) ───────────────────
  const actorStrip = Object.keys(resolvedSlots).length > 0 && (
    <div className="px-5 pt-3 pb-1 flex flex-wrap gap-2 border-b border-stone-700">
      {Object.entries(resolvedSlots).map(([slot, person]) => (
        <ActorBadge key={slot} person={person} />
      ))}
    </div>
  );

  const choice = selectedChoiceId
    ? event.choices.find(c => c.id === selectedChoiceId) ?? null
    : null;

  // ── Handle choice click ───────────────────────────────────────────────────
  function handleChoiceClick(choiceId: string) {
    resolveChoice(event!.id, choiceId);
    setSelectedChoiceId(choiceId);

    // Read the result synchronously from the store immediately after dispatch.
    const result = useGameStore.getState().lastChoiceResult;
    if (result?.isDeferredOutcome) {
      setViewPhase('pending');
    } else if (result?.skillCheckResult) {
      setViewPhase('outcome');
    } else {
      // No skill check, no deferral — advance immediately.
      nextEvent();
      setViewPhase('choosing');
      setSelectedChoiceId(null);
    }
  }

  // ── Handle Continue / Understood ─────────────────────────────────────────
  function handleContinue() {
    nextEvent();
    setViewPhase('choosing');
    setSelectedChoiceId(null);
  }

  // ── Shared card shell ─────────────────────────────────────────────────────
  const progressBar = pendingEvents.length > 1 && (
    <p className="text-stone-500 text-xs mb-3">
      Event {currentIndex + 1} of {pendingEvents.length}
    </p>
  );

  const cardHeader = (
    <div className="bg-amber-900 px-5 py-3">
      <span className="text-amber-400 text-xs uppercase tracking-widest font-semibold">
        {event.category}
      </span>
      <h3 className="text-amber-100 font-bold text-xl mt-0.5">{interp(event.title)}</h3>
    </div>
  );

  // ── Outcome phase ─────────────────────────────────────────────────────────
  if (viewPhase === 'outcome') {
    const lastResult = useGameStore.getState().lastChoiceResult;
    const skillResult = lastResult?.skillCheckResult;
    const outcomeText = skillResult?.passed
      ? interp(choice?.successText ?? 'The attempt succeeds.')
      : interp(choice?.failureText ?? 'The attempt falls short.');

    return (
      <div className="p-4 flex flex-col items-center">
        {progressBar}
        <div className="max-w-lg w-full bg-stone-800 border border-amber-800 rounded-lg overflow-hidden shadow-xl">
          {cardHeader}
          <div className="px-5 py-4 space-y-4">
            {skillResult && <SkillCheckPanel result={skillResult} />}
            <p className="text-stone-300 text-sm leading-relaxed">{outcomeText}</p>
          </div>
          <div className="px-5 pb-5">
            <button
              onClick={handleContinue}
              className="w-full bg-amber-700 hover:bg-amber-600 text-amber-100 font-semibold
                         text-sm rounded px-4 py-2 transition-colors"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Pending phase ─────────────────────────────────────────────────────────
  if (viewPhase === 'pending') {
    const pendingText = interp(
      choice?.pendingText ?? 'Your decision has been made. The outcome will reveal itself in time.'
    );
    const turns = choice?.deferredTurns ?? 4;

    return (
      <div className="p-4 flex flex-col items-center">
        {progressBar}
        <div className="max-w-lg w-full bg-stone-800 border border-amber-800 rounded-lg overflow-hidden shadow-xl">
          {cardHeader}
          <div className="px-5 py-4 space-y-4">
            <div className="bg-stone-700/50 border border-stone-600 rounded p-3 text-sm text-stone-400 italic">
              ⏳ Outcome expected in approximately {turns} turns.
            </div>
            <p className="text-stone-300 text-sm leading-relaxed">{pendingText}</p>
          </div>
          <div className="px-5 pb-5">
            <button
              onClick={handleContinue}
              className="w-full bg-stone-600 hover:bg-stone-500 text-stone-200 font-semibold
                         text-sm rounded px-4 py-2 transition-colors"
            >
              Understood
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Choosing phase (default) ───────────────────────────────────────────────
  return (
    <div className="p-4 flex flex-col items-center">
      {progressBar}
      <div className="max-w-lg w-full bg-stone-800 border border-amber-800 rounded-lg overflow-hidden shadow-xl">
        {cardHeader}
        {actorStrip}

        {/* Description */}
        <div className="px-5 py-4">
          <p className="text-stone-300 text-sm leading-relaxed">{interp(event.description)}</p>
        </div>

        {/* Choices */}
        <div className="px-5 pb-5 space-y-2">
          {event.choices.map(c => (
            <button
              key={c.id}
              onClick={() => handleChoiceClick(c.id)}
              title={c.description ? interp(c.description) : undefined}
              className="w-full text-left bg-stone-700 hover:bg-stone-600 active:bg-stone-800
                         border border-stone-600 hover:border-amber-700
                         rounded px-4 py-3 transition-colors"
            >
              <span className="text-amber-200 font-semibold text-sm block">
                {interp(c.label)}
              </span>
              {c.skillCheck && (
                <span className="text-stone-500 text-xs mt-1 block italic">
                  Skill check: {c.skillCheck.attemptLabel ?? c.skillCheck.skill} (difficulty {c.skillCheck.difficulty})
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

