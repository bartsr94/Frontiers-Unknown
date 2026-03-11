import { describe, it, expect } from 'vitest';
import { createRNG } from '../../src/utils/rng';

describe('SeededRNG', () => {
  describe('deterministic output', () => {
    it('same seed produces the same sequence', () => {
      const rng1 = createRNG(42);
      const rng2 = createRNG(42);

      for (let i = 0; i < 100; i++) {
        expect(rng1.next()).toBe(rng2.next());
      }
    });

    it('different seeds produce different sequences', () => {
      const rng1 = createRNG(42);
      const rng2 = createRNG(9999);

      let allSame = true;
      for (let i = 0; i < 20; i++) {
        if (rng1.next() !== rng2.next()) {
          allSame = false;
          break;
        }
      }
      expect(allSame).toBe(false);
    });
  });

  describe('next()', () => {
    it('returns values in [0, 1)', () => {
      const rng = createRNG(123);
      for (let i = 0; i < 10000; i++) {
        const val = rng.next();
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThan(1);
      }
    });
  });

  describe('nextInt()', () => {
    it('returns values within [min, max] inclusive', () => {
      const rng = createRNG(456);
      const min = 3;
      const max = 7;

      for (let i = 0; i < 1000; i++) {
        const val = rng.nextInt(min, max);
        expect(val).toBeGreaterThanOrEqual(min);
        expect(val).toBeLessThanOrEqual(max);
        expect(Number.isInteger(val)).toBe(true);
      }
    });

    it('covers the full range over many calls', () => {
      const rng = createRNG(789);
      const min = 0;
      const max = 4;
      const seen = new Set<number>();

      for (let i = 0; i < 1000; i++) {
        seen.add(rng.nextInt(min, max));
      }

      for (let v = min; v <= max; v++) {
        expect(seen.has(v)).toBe(true);
      }
    });
  });

  describe('pick()', () => {
    it('returns elements that exist in the array', () => {
      const rng = createRNG(101);
      const items = ['apple', 'banana', 'cherry', 'date'];

      for (let i = 0; i < 100; i++) {
        expect(items).toContain(rng.pick(items));
      }
    });

    it('throws on empty array', () => {
      const rng = createRNG(102);
      expect(() => rng.pick([])).toThrow();
    });
  });

  describe('weightedPick()', () => {
    it('respects weight distribution', () => {
      const rng = createRNG(200);
      const weights = { a: 0.9, b: 0.1 } as const;
      const counts: Record<string, number> = { a: 0, b: 0 };

      const iterations = 10000;
      for (let i = 0; i < iterations; i++) {
        const result = rng.weightedPick(weights);
        counts[result]++;
      }

      const aRatio = (counts['a'] ?? 0) / iterations;
      // 'a' should be ~90% — allow ±5%
      expect(aRatio).toBeGreaterThan(0.85);
      expect(aRatio).toBeLessThan(0.95);
    });

    it('throws when all weights are zero', () => {
      const rng = createRNG(201);
      expect(() => rng.weightedPick({ a: 0, b: 0 })).toThrow();
    });

    it('throws on empty weights', () => {
      const rng = createRNG(202);
      expect(() => rng.weightedPick({})).toThrow();
    });

    it('handles single option', () => {
      const rng = createRNG(203);
      for (let i = 0; i < 10; i++) {
        expect(rng.weightedPick({ only: 1.0 })).toBe('only');
      }
    });
  });

  describe('gaussian()', () => {
    it('produces values centered around the mean', () => {
      const rng = createRNG(300);
      const mean = 5;
      const stddev = 1;
      const samples = 10000;

      let sum = 0;
      for (let i = 0; i < samples; i++) {
        sum += rng.gaussian(mean, stddev);
      }

      const observedMean = sum / samples;
      // Mean should be within 0.1 of target over 10,000 samples
      expect(Math.abs(observedMean - mean)).toBeLessThan(0.1);
    });

    it('produces values with approximately correct standard deviation', () => {
      const rng = createRNG(301);
      const mean = 0;
      const stddev = 2;
      const samples = 10000;

      const values: number[] = [];
      for (let i = 0; i < samples; i++) {
        values.push(rng.gaussian(mean, stddev));
      }

      const observedMean = values.reduce((a, b) => a + b, 0) / samples;
      const variance =
        values.reduce((sum, v) => sum + (v - observedMean) ** 2, 0) / samples;
      const observedStddev = Math.sqrt(variance);

      // Stddev should be within 0.15 of target
      expect(Math.abs(observedStddev - stddev)).toBeLessThan(0.15);
    });
  });
});
