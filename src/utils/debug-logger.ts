/**
 * Debug logger — zero-overhead autonomy trace utility.
 *
 * All simulation functions that perform autonomous actions call debugLog()
 * with a structured entry. When the master switch is off (the default), this
 * is a pure no-op and costs nothing. When enabled via DebugSettings in the
 * Settings overlay, it groups log output in the browser console by turn and
 * channel, making it easy to trace scheme progress, opinion deltas, faction
 * formation, and ambition lifecycle events.
 *
 * No React imports. No side effects beyond console output.
 */

import type { DebugSettings } from '../simulation/turn/game-state';

// ─── Types ─────────────────────────────────────────────────────────────────────

/**
 * The channel a debug entry belongs to.
 *
 * 'autonomy' is the catch-all channel — always shown when the master switch is
 * on. The remaining channels each have their own sub-toggle.
 */
export type DebugChannel =
  | 'autonomy'   // High-level autonomous actions (role assigns, relationship forms)
  | 'schemes'    // Scheme generation, progress milestones, completion
  | 'opinions'   // Opinion deltas above ±5
  | 'factions'   // Faction formation, dissolution, demand generation
  | 'ambitions'; // Ambition tick, generation, fulfillment, clearing

/** A structured debug log entry produced by simulation functions. */
export interface AutonomyLogEntry {
  turn: number;
  channel: DebugChannel;
  personId?: string;
  targetId?: string;
  message: string;
  /** Optional extra context for deeper inspection. */
  data?: Record<string, unknown>;
}

// ─── Logger ────────────────────────────────────────────────────────────────────

/**
 * Conditionally emits a structured console group entry.
 *
 * Called by simulation functions at significant autonomous decision points.
 * In production (all toggles false) the very first check short-circuits and
 * returns immediately — zero additional overhead.
 *
 * @param settings - The current DebugSettings from GameState.
 * @param entry    - The structured log entry to emit.
 */
export function debugLog(settings: DebugSettings, entry: AutonomyLogEntry): void {
  if (!settings.showAutonomyLog) return;

  const channelEnabled =
    entry.channel === 'autonomy' ||
    (entry.channel === 'schemes'    && settings.logSchemes) ||
    (entry.channel === 'opinions'   && settings.logOpinionDeltas) ||
    (entry.channel === 'factions'   && settings.logFactionStrength) ||
    (entry.channel === 'ambitions'  && settings.logAmbitions);

  if (!channelEnabled) return;

  const header = `[T${entry.turn}] ${entry.channel.toUpperCase()} — ${entry.message}`;
  console.groupCollapsed(`%c${header}`, 'color: #a78bfa; font-weight: normal;');
  if (entry.personId) console.log('Person:', entry.personId);
  if (entry.targetId) console.log('Target:', entry.targetId);
  if (entry.data)     console.log('Data:',   entry.data);
  console.groupEnd();
}
