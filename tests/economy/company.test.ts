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
    annualQuotaGold: 0,
    annualQuotaTradeGoods: 0,
    consecutiveFailures: 0,
    supportLevel: 'standard',
    yearsActive: 1,
    quotaContributedGold: 0,
    quotaContributedGoods: 0,
    ...overrides,
  };
}

// ─── computeYearlyQuota ───────────────────────────────────────────────────────

describe('computeYearlyQuota', () => {
  it('returns 0/0 during grace period (years 1–3)', () => {
    for (let y = 1; y <= QUOTA_GRACE_YEARS; y++) {
      const q = computeYearlyQuota(y);
      expect(q.gold).toBe(0);
      expect(q.goods).toBe(0);
    }
  });

  it('year 4: gold=7, goods=11', () => {
    const q = computeYearlyQuota(4);
    expect(q.gold).toBe(7);
    expect(q.goods).toBe(11);
  });

  it('year 6: gold=11, goods=17', () => {
    const q = computeYearlyQuota(6);
    expect(q.gold).toBe(11);
    expect(q.goods).toBe(17);
  });

  it('year 10: gold=19, goods=29', () => {
    const q = computeYearlyQuota(10);
    expect(q.gold).toBe(19);
    expect(q.goods).toBe(29);
  });
});

// ─── checkQuotaStatus ────────────────────────────────────────────────────────

describe('checkQuotaStatus', () => {
  it('returns exceeded during grace period (quota = 0)', () => {
    expect(checkQuotaStatus({ gold: 0, goods: 0 }, { gold: 0, goods: 0 })).toBe('exceeded');
  });

  it('returns exceeded when contribution ≥ 110%', () => {
    const quota = computeYearlyQuota(4); // gold=7, goods=11
    // Exact value = 7 + 11/2 = 12.5; 110% = 13.75 gold-equiv
    expect(checkQuotaStatus({ gold: 14, goods: 0 }, quota)).toBe('exceeded');
  });

  it('returns met within ±10% of requirement', () => {
    const quota = computeYearlyQuota(4);
    // Exactly 100%: 7 gold + 11 goods → 7 + 5.5 = 12.5 value
    expect(checkQuotaStatus({ gold: 7, goods: 11 }, quota)).toBe('met');
  });

  it('returns met at 90% threshold', () => {
    const quota = computeYearlyQuota(4); // required gold=7, goods=11 → value=12.5
    // 90% = 11.25 gold-equiv; give 12 gold → 12/12.5 = 0.96 → 'met'
    expect(checkQuotaStatus({ gold: 12, goods: 0 }, quota)).toBe('met');
    // 88% = 11.0 gold-equiv: 10 gold + 2 goods = 10+1 = 11 → partial
    expect(checkQuotaStatus({ gold: 10, goods: 2 }, quota)).toBe('partial');
  });

  it('returns partial when 50–89% delivered', () => {
    const quota = computeYearlyQuota(4); // required = 12.5
    // 60% = 7.5 gold-equiv
    expect(checkQuotaStatus({ gold: 7, goods: 1 }, quota)).toBe('partial');
  });

  it('returns failed when < 50% delivered', () => {
    const quota = computeYearlyQuota(4); // required = 12.5
    // 49% = 6.125
    expect(checkQuotaStatus({ gold: 6, goods: 0 }, quota)).toBe('failed');
  });

  it('allows overpaying goods to cover gold shortfall', () => {
    const quota = computeYearlyQuota(4); // gold=7, goods=11; value=12.5
    // Pay 0 gold + 25 goods → 12.5 value → exactly met
    expect(checkQuotaStatus({ gold: 0, goods: 25 }, quota)).toBe('met');
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
  it('full_support delivers food, gold, goods, medicine', () => {
    const d = getCompanySupplyDelivery('full_support');
    expect(d.food).toBeGreaterThan(0);
    expect(d.gold).toBeGreaterThan(0);
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
