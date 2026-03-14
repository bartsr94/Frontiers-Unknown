/**
 * Pure math utility functions used throughout the simulation.
 */

/**
 * Linearly interpolates between two values.
 *
 * @param a - Start value (returned when t = 0)
 * @param b - End value (returned when t = 1)
 * @param t - Interpolation factor, typically in [0, 1]
 * @returns The interpolated value: a + (b - a) * t
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Clamps a value to the given range.
 *
 * @param val - The value to clamp
 * @param min - Minimum bound (inclusive)
 * @param max - Maximum bound (inclusive)
 * @returns The clamped value
 */
export function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}

/**
 * Inverse linear interpolation — returns the t factor for a value within a range.
 *
 * @param a - Start of range
 * @param b - End of range
 * @param val - The value to find the interpolation factor for
 * @returns The t such that lerp(a, b, t) ≈ val. Returns 0 if a === b.
 */
export function inverseLerp(a: number, b: number, val: number): number {
  if (a === b) return 0;
  return (val - a) / (b - a);
}

/**
 * Converts a positive integer to a Roman numeral string.
 * Capped at 3999. Returns '?' for out-of-range values.
 */
export function toRoman(n: number): string {
  if (n < 1 || n > 3999) return '?';
  const vals = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
  const syms = ['M', 'CM', 'D', 'CD', 'C', 'XC', 'L', 'XL', 'X', 'IX', 'V', 'IV', 'I'];
  let result = '';
  for (let i = 0; i < vals.length; i++) {
    while (n >= vals[i]) { result += syms[i]; n -= vals[i]; }
  }
  return result;
}
