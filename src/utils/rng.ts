/**
 * Seeded pseudo-random number generator using the mulberry32 algorithm.
 *
 * All game randomness flows through this module to ensure deterministic replay.
 * Never use Math.random() anywhere in the codebase — always use a SeededRNG instance.
 */

/** Interface for a seeded random number generator. */
export interface SeededRNG {
  /** Returns a float in [0, 1). Advances the internal state. */
  next(): number;

  /** Returns an integer in [min, max] (inclusive). */
  nextInt(min: number, max: number): number;

  /** Returns a random element from the given non-empty array. */
  pick<T>(array: readonly T[]): T;

  /**
   * Returns a key from the weights object, selected proportionally to its weight.
   * Weights do not need to sum to 1 — they are normalized internally.
   */
  weightedPick<T extends string>(weights: Partial<Record<T, number>>): T;

  /**
   * Returns a normally-distributed random value using the Box-Muller transform.
   * Consumes two calls to next() per invocation.
   */
  gaussian(mean: number, stddev: number): number;
}

/**
 * Creates a seeded PRNG using the mulberry32 algorithm.
 *
 * @param seed - An integer seed value. The same seed always produces the same sequence.
 * @returns A SeededRNG instance with deterministic output.
 *
 * @example
 * ```ts
 * const rng = createRNG(42);
 * rng.next();       // always the same float for seed 42
 * rng.nextInt(1, 6); // deterministic dice roll
 * ```
 */
export function createRNG(seed: number): SeededRNG {
  let state = seed | 0;

  /**
   * Core mulberry32 step. Advances state and returns a float in [0, 1).
   */
  function mulberry32(): number {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function next(): number {
    return mulberry32();
  }

  function nextInt(min: number, max: number): number {
    return Math.floor(next() * (max - min + 1)) + min;
  }

  function pick<T>(array: readonly T[]): T {
    if (array.length === 0) {
      throw new Error('Cannot pick from an empty array');
    }
    return array[nextInt(0, array.length - 1)] as T;
  }

  function weightedPick<T extends string>(weights: Partial<Record<T, number>>): T {
    const entries: [T, number][] = [];
    let total = 0;

    for (const [key, value] of Object.entries(weights) as [T, number | undefined][]) {
      const w = value ?? 0;
      if (w > 0) {
        entries.push([key, w]);
        total += w;
      }
    }

    if (entries.length === 0 || total <= 0) {
      throw new Error('weightedPick requires at least one entry with positive weight');
    }

    const roll = next() * total;
    let cumulative = 0;

    for (const [key, weight] of entries) {
      cumulative += weight;
      if (roll < cumulative) {
        return key;
      }
    }

    // Floating-point edge case: return the last entry
    return entries[entries.length - 1]![0];
  }

  function gaussian(mean: number, stddev: number): number {
    // Box-Muller transform — consumes two next() calls
    const u1 = next();
    const u2 = next();
    // Clamp u1 away from zero to avoid log(0)
    const safeU1 = Math.max(u1, 1e-10);
    const z0 = Math.sqrt(-2.0 * Math.log(safeU1)) * Math.cos(2.0 * Math.PI * u2);
    return z0 * stddev + mean;
  }

  return { next, nextInt, pick, weightedPick, gaussian };
}
