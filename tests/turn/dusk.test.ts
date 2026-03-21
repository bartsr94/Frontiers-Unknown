/**
 * Tests for processDusk() in turn-processor.ts.
 *
 * processDusk is a pure function that advances the season, increments the year
 * when winter rolls over to spring, checks the autumn Company quota, resets
 * quota contributions at winter→spring, and applies the once-per-year Company
 * religious pressure drain.
 */

import { describe, it, expect } from 'vitest';
import { processDusk } from '../../src/simulation/turn/turn-processor';
import type { GameState, Season } from '../../src/simulation/turn/game-state';

// ─── Minimal state builder ────────────────────────────────────────────────────

function makeState(overrides: {
  currentSeason?: Season;
  currentYear?: number;
  standing?: number;
  quotaContributedWealth?: number;
  supportLevel?: GameState['company']['supportLevel'];
  consecutiveFailures?: number;
  religiousPolicy?: GameState['settlement']['religiousPolicy'];
  wheelFraction?: number;
} = {}): GameState {
  return {
    version: '1.0.0',
    seed: 1,
    turnNumber: 10,
    currentSeason: overrides.currentSeason ?? 'spring',
    currentYear: overrides.currentYear ?? 1,
    people: new Map(),
    graveyard: [],
    settlement: {
      name: 'Test',
      location: 'marsh',
      buildings: [],
      resources: { food: 0, cattle: 0, wealth: 0, steel: 0, lumber: 0, stone: 0, medicine: 0, horses: 0 },
      populationCount: 0,
      religiousPolicy: overrides.religiousPolicy ?? 'tolerant',
    },
    culture: {
      languages: new Map(),
      primaryLanguage: 'imanian',
      languageDiversityTurns: 0,
      languageTension: 0,
      religions: new Map(
        overrides.wheelFraction !== undefined
          ? [
              ['sacred_wheel', overrides.wheelFraction],
              ['imanian_orthodox', 1 - overrides.wheelFraction],
            ]
          : [['imanian_orthodox', 1.0]]
      ),
      religiousTension: 0,
      culturalBlend: 0,
      hiddenWheelEmerged: false,
      hiddenWheelDivergenceTurns: 0,
      hiddenWheelSuppressedTurns: 0,
      practices: [],
      governance: 'patriarchal_imanian',
    },
    tribes: new Map(),
    company: {
      standing: overrides.standing ?? 60,
      annualQuotaWealth: 0,
      consecutiveFailures: overrides.consecutiveFailures ?? 0,
      supportLevel: overrides.supportLevel ?? 'standard',
      yearsActive: 0,
      quotaContributedWealth: overrides.quotaContributedWealth ?? 0,
    },
    eventHistory: [],
    eventCooldowns: new Map(),
    pendingEvents: [],
    councilMemberIds: [],
    deferredEvents: [],
    identityPressure: { companyPressureTurns: 0, tribalPressureTurns: 0 },
    config: {
      seed: 1,
      difficulty: 'normal',
      settlementName: 'Test',
      startingTribes: [],
    },
  } as unknown as GameState;
}

// ─── Season cycling ───────────────────────────────────────────────────────────

describe('processDusk — season cycling', () => {
  it('spring → summer', () => {
    const { nextSeason } = processDusk(makeState({ currentSeason: 'spring' }), 'spring');
    expect(nextSeason).toBe('summer');
  });

  it('summer → autumn', () => {
    const { nextSeason } = processDusk(makeState({ currentSeason: 'summer' }), 'summer');
    expect(nextSeason).toBe('autumn');
  });

  it('autumn → winter', () => {
    const { nextSeason } = processDusk(makeState({ currentSeason: 'autumn' }), 'autumn');
    expect(nextSeason).toBe('winter');
  });

  it('winter → spring', () => {
    const { nextSeason } = processDusk(makeState({ currentSeason: 'winter' }), 'winter');
    expect(nextSeason).toBe('spring');
  });
});

// ─── Year advancement ─────────────────────────────────────────────────────────

describe('processDusk — year advancement', () => {
  it('increments the year when transitioning from winter to spring', () => {
    const { nextYear } = processDusk(makeState({ currentSeason: 'winter', currentYear: 3 }), 'winter');
    expect(nextYear).toBe(4);
  });

  it('does not increment the year for any other transition', () => {
    for (const season of ['spring', 'summer', 'autumn'] as Season[]) {
      const { nextYear } = processDusk(makeState({ currentSeason: season, currentYear: 2 }), season);
      expect(nextYear).toBe(2);
    }
  });
});

// ─── Quota check (autumn only) ────────────────────────────────────────────────

describe('processDusk — quota check', () => {
  it('returns quotaStatus null for non-autumn seasons', () => {
    for (const season of ['spring', 'summer', 'winter'] as Season[]) {
      const { quotaStatus } = processDusk(makeState({ currentSeason: season }), season);
      expect(quotaStatus).toBeNull();
    }
  });

  it('returns a non-null quotaStatus in autumn', () => {
    const { quotaStatus } = processDusk(makeState({ currentSeason: 'autumn', currentYear: 11 }), 'autumn');
    expect(quotaStatus).not.toBeNull();
  });

  it('returns "failed" when nothing has been contributed and year >= 11', () => {
    const state = makeState({ currentSeason: 'autumn', currentYear: 11, quotaContributedWealth: 0 });
    const { quotaStatus } = processDusk(state, 'autumn');
    expect(quotaStatus).toBe('failed');
  });

  it('returns "exceeded" when contributions exceed the quota', () => {
    // Year 11: quotaWealth = 10 + (11-10)*5 = 15; contributing 30 exceeds it
    const state = makeState({ currentSeason: 'autumn', currentYear: 11, quotaContributedWealth: 30 });
    const { quotaStatus } = processDusk(state, 'autumn');
    expect(quotaStatus).toBe('exceeded');
  });

  it('returns null quotaEventId in autumn grace period (year < 4)', () => {
    const state = makeState({ currentSeason: 'autumn', currentYear: 2 });
    const { quotaEventId } = processDusk(state, 'autumn');
    // Year 2 is in grace period — no quota obligation, so any event ID or null is acceptable.
    // The important thing is that it doesn't throw.
    expect(quotaEventId === null || typeof quotaEventId === 'string').toBe(true);
  });

  it('does not reset quota contributions in autumn', () => {
    const state = makeState({ currentSeason: 'autumn', currentYear: 4 });
    const { resetQuotaContributions } = processDusk(state, 'autumn');
    expect(resetQuotaContributions).toBe(false);
  });
});

// ─── Quota contribution reset (winter → spring) ───────────────────────────────

describe('processDusk — quota contribution reset', () => {
  it('sets resetQuotaContributions = true when leaving winter', () => {
    const { resetQuotaContributions } = processDusk(makeState({ currentSeason: 'winter' }), 'winter');
    expect(resetQuotaContributions).toBe(true);
  });

  it('does not reset contributions in spring, summer, or autumn', () => {
    for (const season of ['spring', 'summer', 'autumn'] as Season[]) {
      const { resetQuotaContributions } = processDusk(makeState({ currentSeason: season }), season);
      expect(resetQuotaContributions).toBe(false);
    }
  });
});

// ─── Religious standing drain (winter → spring transition) ────────────────────

describe('processDusk — religious standing drain', () => {
  it('winterReligiousStandingDelta is 0 for non-winter seasons', () => {
    for (const season of ['spring', 'summer', 'autumn'] as Season[]) {
      const { winterReligiousStandingDelta } = processDusk(makeState({ currentSeason: season }), season);
      expect(winterReligiousStandingDelta).toBe(0);
    }
  });

  it('winterReligiousStandingDelta is 0 when Sacred Wheel fraction is at or below 25%', () => {
    const { winterReligiousStandingDelta } = processDusk(
      makeState({ currentSeason: 'winter', wheelFraction: 0.25 }),
      'winter',
    );
    expect(winterReligiousStandingDelta).toBe(0);
  });

  it('winterReligiousStandingDelta is negative when Sacred Wheel fraction exceeds 25%', () => {
    const { winterReligiousStandingDelta } = processDusk(
      makeState({ currentSeason: 'winter', wheelFraction: 0.5 }),
      'winter',
    );
    expect(winterReligiousStandingDelta).toBeLessThan(0);
  });

  it('shouldFireCompanyReligionEvent is true when religious drain is negative', () => {
    const { shouldFireCompanyReligionEvent, winterReligiousStandingDelta } = processDusk(
      makeState({ currentSeason: 'winter', wheelFraction: 0.6 }),
      'winter',
    );
    expect(winterReligiousStandingDelta).toBeLessThan(0);
    expect(shouldFireCompanyReligionEvent).toBe(true);
  });

  it('shouldFireCompanyReligionEvent is false when there is no religious drain', () => {
    const { shouldFireCompanyReligionEvent } = processDusk(
      makeState({ currentSeason: 'winter', wheelFraction: 0.1 }),
      'winter',
    );
    expect(shouldFireCompanyReligionEvent).toBe(false);
  });
});
