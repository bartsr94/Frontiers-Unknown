/**
 * Event resolver — applies event choice consequences to GameState.
 *
 * All functions here are pure: they receive state and return new state
 * without mutating their inputs. The Zustand store owns all mutations.
 *
 * Phase 1 implemented consequence types:
 *   modify_resource  — adjusts a ResourceType in settlement.resources
 *   modify_standing  — adjusts company.standing (target: 'company')
 *
 * All other consequence types are stubs that return state unchanged.
 * They will be implemented progressively through Phase 2 and Phase 3.
 */

import type { GameEvent, EventConsequence } from './engine';
import type { GameState, ResourceType, EventRecord } from '../turn/game-state';
import { clamp } from '../../utils/math';

// ─── Single consequence application ──────────────────────────────────────────

function applyConsequence(consequence: EventConsequence, state: GameState): GameState {
  switch (consequence.type) {

    case 'modify_resource': {
      const key = consequence.target as ResourceType;
      const delta = consequence.value as number;
      const current = state.settlement.resources[key] ?? 0;
      const updated = Math.max(0, current + delta);
      return {
        ...state,
        settlement: {
          ...state.settlement,
          resources: { ...state.settlement.resources, [key]: updated },
        },
      };
    }

    case 'modify_standing': {
      if (consequence.target !== 'company') return state;
      const delta = consequence.value as number;
      return {
        ...state,
        company: {
          ...state.company,
          standing: clamp(state.company.standing + delta, 0, 100),
        },
      };
    }

    // ── Phase 2+ stubs ──────────────────────────────────────────────────────
    // These are defined in ConsequenceType but not yet mechanically active.
    // Returning state unchanged means the event fires with narrative effect
    // only until the system is built.
    default:
      return state;
  }
}

// ─── Full choice resolution ───────────────────────────────────────────────────

/**
 * Applies all consequences of the chosen option and records the event
 * in the game history and cooldown map.
 *
 * @param event    - The event being resolved.
 * @param choiceId - The ID of the choice the player selected.
 * @param state    - Current game state (not mutated).
 * @returns A new GameState with all consequences applied and the event recorded.
 */
export function applyEventChoice(
  event: GameEvent,
  choiceId: string,
  state: GameState,
): GameState {
  const choice = event.choices.find(c => c.id === choiceId);
  if (!choice) return state; // Defensive: unknown choice ID

  // Apply all consequences in order.
  let updatedState = state;
  for (const consequence of choice.consequences) {
    updatedState = applyConsequence(consequence, updatedState);
  }

  // Record the event in history (for unique-event checks and chronicles).
  const record: EventRecord = {
    eventId: event.id,
    turnNumber: state.turnNumber,
    choiceId,
    involvedPersonIds: [],
  };

  // Update the cooldown map: record the turn this event last fired.
  const updatedCooldowns = new Map(updatedState.eventCooldowns);
  updatedCooldowns.set(event.id, state.turnNumber);

  return {
    ...updatedState,
    eventHistory: [...updatedState.eventHistory, record],
    eventCooldowns: updatedCooldowns,
  };
}
