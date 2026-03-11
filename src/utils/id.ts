/**
 * Unique ID generation for game entities.
 *
 * Uses an incrementing counter with a session-specific prefix.
 * This is the only place non-seeded randomness is used — IDs are structural
 * identifiers and do not affect gameplay determinism.
 */

const prefix = Date.now().toString(36);
let counter = 0;

/**
 * Generates a unique string ID.
 *
 * IDs are guaranteed unique within a single browser session.
 * Format: `{timestamp-base36}_{incrementing-counter}`
 *
 * @returns A unique string identifier
 */
export function generateId(): string {
  return `${prefix}_${counter++}`;
}
