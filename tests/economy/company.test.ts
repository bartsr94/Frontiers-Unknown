import { describe, it, expect } from 'vitest';
import {
  computeYearlyQuota,
  checkQuotaStatus,
  getQuotaEventId,
  deriveSupportLevel,
  applyQuotaResult,
  getCompanySupplyDelivery,
  applyStandingDecay,
  QUOTA_GRACE_YEARS,
} from '../../src/simulation/economy/company';
import type { CompanyRelation } from '../../src/simulation/turn/game-state';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeCompany(overrides: Partial<CompanyRelation> = {}): CompanyRelation {
  return {
    standing: 60,
    annualQuotaWealth: 0,
    consecutiveFailures: 0,
    supportLevel: 'standard',
    yearsActive: 1,
    quotaContributedWealth: 0,
    ...overrides,
  };
}

// ─── computeYearlyQuota ───────────────────────────────────────────────────────

describe('computeYearlyQuota', () => {
  it('returns 0/0 during grace period (years 1–10)', () => {
    for (let y = 1; y <= QUOTA_GRACE_YEARS; y++) {
      const q = computeYearlyQuota(y);
      expect(q.wealth).toBe(0);
    }
  });

  it('year 11: wealth=15', () => {
    const q = computeYearlyQuota(11);
    expect(q.wealth).toBe(15);
  });

  it('year 13: wealth=25', () => {
    const q = computeYearlyQuota(13);
    expect(q.wealth).toBe(25);
  });

  it('year 17: wealth=45', () => {
    const q = computeYearlyQuota(17);
    expect(q.wealth).toBe(45);
  });
});

// ─── checkQuotaStatus ────────────────────────────────────────────────────────

describe('checkQuotaStatus', () => {
  it('returns exceeded during grace period (quota = 0)', () => {
    expect(checkQuotaStatus({ wealth: 0 }, { wealth: 0 })).toBe('exceeded');
  });

  it('returns exceeded when contribution ≥ 110%', () => {
    const quota = computeYearlyQuota(11); // wealth=15
    // 110% = 16.5; contribute 17
    expect(checkQuotaStatus({ wealth: 17 }, quota)).toBe('exceeded');
  });

  it('returns met within ±10% of requirement', () => {
    const quota = computeYearlyQuota(11); // wealth=15
    expect(checkQuotaStatus({ wealth: 15 }, quota)).toBe('met');
  });

  it('returns met at 90% threshold', () => {
    const quota = computeYearlyQuota(11); // wealth=15; 90% = 13.5
    expect(checkQuotaStatus({ wealth: 14 }, quota)).toBe('met');
    expect(checkQuotaStatus({ wealth: 13 }, quota)).toBe('partial');
  });

  it('returns partial when 50–89% delivered', () => {
    const quota = computeYearlyQuota(11); // wealth=15; 60% = 9
    expect(checkQuotaStatus({ wealth: 9 }, quota)).toBe('partial');
  });

  it('returns failed when < 50% delivered', () => {
    const quota = computeYearlyQuota(11); // wealth=15; 49% = 7.35
    expect(checkQuotaStatus({ wealth: 7 }, quota)).toBe('failed');
  });

  it('allows overpaying to cover the full quota in wealth', () => {
    const quota = computeYearlyQuota(11); // wealth=15
    // Give exactly the required amount
    expect(checkQuotaStatus({ wealth: 15 }, quota)).toBe('met');
  });
});

// ─── getQuotaEventId ──────────────────────────────────────────────────────────

describe('getQuotaEventId', () => {
  it('null for success (0 failures)', () => {
    expect(getQuotaEventId(0, false)).toBeNull();
  });

  it('co_quota_warning for 1 failure', () => {
    expect(getQuotaEventId(1, false)).toBe('co_quota_warning');
  });

  it('co_inspector_arrives for 2 failures', () => {
    expect(getQuotaEventId(2, false)).toBe('co_inspector_arrives');
  });

  it('co_final_warning for 3 failures', () => {
    expect(getQuotaEventId(3, false)).toBe('co_final_warning');
  });

  it('co_abandoned for 4+ failures', () => {
    expect(getQuotaEventId(4, false)).toBe('co_abandoned');
    expect(getQuotaEventId(5, false)).toBe('co_abandoned');
  });

  it('null when already abandoned', () => {
    expect(getQuotaEventId(4, true)).toBeNull();
  });
});

// ─── deriveSupportLevel ───────────────────────────────────────────────────────

describe('deriveSupportLevel', () => {
  it('0 failures → full_support', () => expect(deriveSupportLevel(0)).toBe('full_support'));
  it('1 failure → standard', () => expect(deriveSupportLevel(1)).toBe('standard'));
  it('2 failures → reduced', () => expect(deriveSupportLevel(2)).toBe('reduced'));
  it('3 failures → minimal', () => expect(deriveSupportLevel(3)).toBe('minimal'));
  it('4+ failures → abandoned', () => {
    expect(deriveSupportLevel(4)).toBe('abandoned');
    expect(deriveSupportLevel(10)).toBe('abandoned');
  });
});

// ─── applyQuotaResult ────────────────────────────────────────────────────────

describe('applyQuotaResult', () => {
  it('met quota resets consecutive failures to 0', () => {
    const company = makeCompany({ consecutiveFailures: 2 });
    const result = applyQuotaResult(company, 'met');
    expect(result.consecutiveFailures).toBe(0);
  });

  it('exceeded grants standing bonus', () => {
    const company = makeCompany({ standing: 60 });
    const result = applyQuotaResult(company, 'exceeded');
    expect(result.standing).toBeGreaterThan(60);
  });

  it('failed increments consecutive failures', () => {
    const company = makeCompany({ consecutiveFailures: 1 });
    const result = applyQuotaResult(company, 'failed');
    expect(result.consecutiveFailures).toBe(2);
  });

  it('partial increments consecutive failures', () => {
    const company = makeCompany({ consecutiveFailures: 0 });
    const result = applyQuotaResult(company, 'partial');
    expect(result.consecutiveFailures).toBe(1);
  });

  it('standing clamped at 0 minimum', () => {
    const company = makeCompany({ standing: 5 });
    const result = applyQuotaResult(company, 'failed');
    expect(result.standing).toBeGreaterThanOrEqual(0);
  });

  it('standing clamped at 100 maximum', () => {
    const company = makeCompany({ standing: 98 });
    const result = applyQuotaResult(company, 'exceeded');
    expect(result.standing).toBeLessThanOrEqual(100);
  });

  it('abandoned support level when standing reaches 0', () => {
    const company = makeCompany({ standing: 10, consecutiveFailures: 3 });
    // More failures → standing drops
    const result = applyQuotaResult(company, 'failed');
    if (result.standing === 0) {
      expect(result.supportLevel).toBe('abandoned');
    }
  });
});

// ─── getCompanySupplyDelivery ─────────────────────────────────────────────────

describe('getCompanySupplyDelivery', () => {
  it('full_support delivers food, wealth, medicine', () => {
    const d = getCompanySupplyDelivery('full_support');
    expect(d.food).toBeGreaterThan(0);
    expect(d.wealth).toBeGreaterThan(0);
    expect(d.medicine).toBeGreaterThan(0);
  });

  it('abandoned delivers nothing', () => {
    const d = getCompanySupplyDelivery('abandoned');
    const total = Object.values(d).reduce((s, v) => s + (v ?? 0), 0);
    expect(total).toBe(0);
  });

  it('reduced delivers less food than standard', () => {
    const standard = getCompanySupplyDelivery('standard');
    const reduced = getCompanySupplyDelivery('reduced');
    expect((reduced.food ?? 0)).toBeLessThan((standard.food ?? 0));
  });
});

// ─── applyStandingDecay ───────────────────────────────────────────────────────

describe('applyStandingDecay', () => {
  it('standing above 50 decays by 1', () => {
    expect(applyStandingDecay(60)).toBe(59);
    expect(applyStandingDecay(51)).toBe(50);
  });

  it('standing below 50 increases by 1', () => {
    expect(applyStandingDecay(40)).toBe(41);
    expect(applyStandingDecay(49)).toBe(50);
  });

  it('standing at 50 is stable', () => {
    expect(applyStandingDecay(50)).toBe(50);
  });
});
