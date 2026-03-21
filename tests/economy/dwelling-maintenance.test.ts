/**
 * Unit tests for applyDwellingMaintenance().
 *
 * Covers:
 *   - Household with no dwelling slot → no-op
 *   - wattle_hut (cost 0) → skipped (free tier)
 *   - cottage, homestead, compound → correct wealth deduction
 *   - Cannot pay → wealthMaintenanceDebt increments
 *   - Debt reaches 2 → building appears in atRiskBuildingIds
 *   - Pays after a debt run → debt resets to 0
 *   - Multiple households processed independently
 *   - Dwelling instance not found in allBuildings → no-op for that household
 */

import { describe, it, expect } from 'vitest';
import { applyDwellingMaintenance } from '../../src/simulation/economy/private-economy';
import type { Household, BuiltBuilding } from '../../src/simulation/turn/game-state';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeHousehold(
  id: string,
  opts: {
    buildingSlots?: (string | null)[];
    householdWealth?: number;
    wealthMaintenanceDebt?: number;
  } = {},
): Household {
  return {
    id,
    name: `House ${id}`,
    tradition: 'imanian',
    headId: null,
    seniorWifeId: null,
    memberIds: [],
    ashkaMelathiBonds: [],
    foundedTurn: 0,
    dwellingBuildingId: null,
    productionBuildingIds: [],
    isAutoNamed: true,
    buildingSlots: opts.buildingSlots ?? (Array(9).fill(null) as (string | null)[]),
    householdWealth: opts.householdWealth ?? 0,
    wealthAccumulator: 0,
    wealthMaintenanceDebt: opts.wealthMaintenanceDebt ?? 0,
  } as Household;
}

function makeBuilding(defId: string, instanceId: string): BuiltBuilding {
  return { defId, instanceId, builtTurn: 0, style: null } as BuiltBuilding;
}

function slots(dwellingInstanceId: string | null): (string | null)[] {
  const arr: (string | null)[] = Array(9).fill(null);
  arr[0] = dwellingInstanceId;
  return arr;
}

// ─── No dwelling ─────────────────────────────────────────────────────────────

describe('applyDwellingMaintenance — no dwelling', () => {
  it('household with all-null building slots is not modified', () => {
    const hh = makeHousehold('h1', { householdWealth: 10 });
    const { updatedHouseholds, atRiskBuildingIds } = applyDwellingMaintenance(
      new Map([['h1', hh]]),
      [],
    );
    expect(updatedHouseholds.get('h1')).toEqual(hh);
    expect(atRiskBuildingIds).toHaveLength(0);
  });

  it('dwelling instanceId not found in allBuildings → no-op', () => {
    const hh = makeHousehold('h1', { buildingSlots: slots('unknown_inst'), householdWealth: 5 });
    const { updatedHouseholds, atRiskBuildingIds } = applyDwellingMaintenance(
      new Map([['h1', hh]]),
      [], // empty array — building doesn't exist
    );
    // No deduction because the building can't be found
    expect(updatedHouseholds.get('h1')!.householdWealth).toBe(5);
    expect(atRiskBuildingIds).toHaveLength(0);
  });
});

// ─── Free tier (wattle_hut) ───────────────────────────────────────────────────

describe('applyDwellingMaintenance — wattle_hut (free)', () => {
  it('wattle_hut costs 0: wealth unchanged, no debt', () => {
    const hh = makeHousehold('h1', {
      buildingSlots: slots('wattle_0'),
      householdWealth: 5,
    });
    const buildings = [makeBuilding('wattle_hut', 'wattle_0')];
    const { updatedHouseholds, atRiskBuildingIds } = applyDwellingMaintenance(
      new Map([['h1', hh]]),
      buildings,
    );
    // Cost is 0 → early exit, household unchanged
    expect(updatedHouseholds.get('h1')).toEqual(hh);
    expect(atRiskBuildingIds).toHaveLength(0);
  });
});

// ─── Cottage (cost 1) ────────────────────────────────────────────────────────

describe('applyDwellingMaintenance — cottage (cost 1)', () => {
  it('can pay: deducts 1 wealth and clears debt to 0', () => {
    const hh = makeHousehold('h1', {
      buildingSlots: slots('cot_0'),
      householdWealth: 5,
      wealthMaintenanceDebt: 2, // existing debt gets cleared when paid
    });
    const buildings = [makeBuilding('cottage', 'cot_0')];
    const { updatedHouseholds, atRiskBuildingIds } = applyDwellingMaintenance(
      new Map([['h1', hh]]),
      buildings,
    );
    expect(updatedHouseholds.get('h1')!.householdWealth).toBe(4);
    expect(updatedHouseholds.get('h1')!.wealthMaintenanceDebt).toBe(0);
    expect(atRiskBuildingIds).toHaveLength(0);
  });

  it('can pay exactly (wealth === cost): wealth drops to 0, debt cleared', () => {
    const hh = makeHousehold('h1', {
      buildingSlots: slots('cot_0'),
      householdWealth: 1,
    });
    const buildings = [makeBuilding('cottage', 'cot_0')];
    const { updatedHouseholds } = applyDwellingMaintenance(
      new Map([['h1', hh]]),
      buildings,
    );
    expect(updatedHouseholds.get('h1')!.householdWealth).toBe(0);
    expect(updatedHouseholds.get('h1')!.wealthMaintenanceDebt).toBe(0);
  });

  it('cannot pay (wealth = 0, debt = 0): debt becomes 1, not in atRisk', () => {
    const hh = makeHousehold('h1', {
      buildingSlots: slots('cot_0'),
      householdWealth: 0,
    });
    const buildings = [makeBuilding('cottage', 'cot_0')];
    const { updatedHouseholds, atRiskBuildingIds } = applyDwellingMaintenance(
      new Map([['h1', hh]]),
      buildings,
    );
    // Debt 0 → 1 (not yet at risk)
    expect(updatedHouseholds.get('h1')!.wealthMaintenanceDebt).toBe(1);
    expect(atRiskBuildingIds).toHaveLength(0);
  });

  it('cannot pay (wealth = 0, debt = 1): debt becomes 2, building IS at risk', () => {
    const hh = makeHousehold('h1', {
      buildingSlots: slots('cot_0'),
      householdWealth: 0,
      wealthMaintenanceDebt: 1,
    });
    const buildings = [makeBuilding('cottage', 'cot_0')];
    const { updatedHouseholds, atRiskBuildingIds } = applyDwellingMaintenance(
      new Map([['h1', hh]]),
      buildings,
    );
    expect(updatedHouseholds.get('h1')!.wealthMaintenanceDebt).toBe(2);
    expect(atRiskBuildingIds).toContain('cot_0');
  });

  it('pays after a debt run: debt resets to 0', () => {
    const hh = makeHousehold('h1', {
      buildingSlots: slots('cot_0'),
      householdWealth: 3,
      wealthMaintenanceDebt: 1,
    });
    const buildings = [makeBuilding('cottage', 'cot_0')];
    const { updatedHouseholds, atRiskBuildingIds } = applyDwellingMaintenance(
      new Map([['h1', hh]]),
      buildings,
    );
    expect(updatedHouseholds.get('h1')!.householdWealth).toBe(2);
    expect(updatedHouseholds.get('h1')!.wealthMaintenanceDebt).toBe(0);
    expect(atRiskBuildingIds).toHaveLength(0);
  });
});

// ─── Homestead (cost 2) ──────────────────────────────────────────────────────

describe('applyDwellingMaintenance — homestead (cost 2)', () => {
  it('homestead with wealth = 4 pays 2, leaves remainder', () => {
    const hh = makeHousehold('h1', {
      buildingSlots: slots('home_0'),
      householdWealth: 4,
    });
    const buildings = [makeBuilding('homestead', 'home_0')];
    const { updatedHouseholds } = applyDwellingMaintenance(
      new Map([['h1', hh]]),
      buildings,
    );
    expect(updatedHouseholds.get('h1')!.householdWealth).toBe(2);
    expect(updatedHouseholds.get('h1')!.wealthMaintenanceDebt).toBe(0);
  });

  it('homestead with wealth = 1 (< cost 2): cannot pay, debt increments', () => {
    const hh = makeHousehold('h1', {
      buildingSlots: slots('home_0'),
      householdWealth: 1,
    });
    const buildings = [makeBuilding('homestead', 'home_0')];
    const { updatedHouseholds, atRiskBuildingIds } = applyDwellingMaintenance(
      new Map([['h1', hh]]),
      buildings,
    );
    expect(updatedHouseholds.get('h1')!.householdWealth).toBe(1); // unchanged
    expect(updatedHouseholds.get('h1')!.wealthMaintenanceDebt).toBe(1);
    expect(atRiskBuildingIds).toHaveLength(0);
  });
});

// ─── Compound (cost 4) ───────────────────────────────────────────────────────

describe('applyDwellingMaintenance — compound (cost 4)', () => {
  it('compound with exact wealth = 4: pays fully, debt = 0', () => {
    const hh = makeHousehold('h1', {
      buildingSlots: slots('comp_0'),
      householdWealth: 4,
    });
    const buildings = [makeBuilding('compound', 'comp_0')];
    const { updatedHouseholds, atRiskBuildingIds } = applyDwellingMaintenance(
      new Map([['h1', hh]]),
      buildings,
    );
    expect(updatedHouseholds.get('h1')!.householdWealth).toBe(0);
    expect(updatedHouseholds.get('h1')!.wealthMaintenanceDebt).toBe(0);
    expect(atRiskBuildingIds).toHaveLength(0);
  });

  it('compound with debt = 1 and 0 wealth: debt becomes 2, at risk', () => {
    const hh = makeHousehold('h1', {
      buildingSlots: slots('comp_0'),
      householdWealth: 0,
      wealthMaintenanceDebt: 1,
    });
    const buildings = [makeBuilding('compound', 'comp_0')];
    const { updatedHouseholds, atRiskBuildingIds } = applyDwellingMaintenance(
      new Map([['h1', hh]]),
      buildings,
    );
    expect(updatedHouseholds.get('h1')!.wealthMaintenanceDebt).toBe(2);
    expect(atRiskBuildingIds).toContain('comp_0');
  });
});

// ─── Multiple households ──────────────────────────────────────────────────────

describe('applyDwellingMaintenance — multiple households', () => {
  it('each household is processed independently', () => {
    const hh1 = makeHousehold('h1', { buildingSlots: slots('cot_1'), householdWealth: 5 });
    const hh2 = makeHousehold('h2', { buildingSlots: slots('home_1'), householdWealth: 1, wealthMaintenanceDebt: 1 });
    const buildings = [
      makeBuilding('cottage', 'cot_1'),
      makeBuilding('homestead', 'home_1'),
    ];
    const { updatedHouseholds, atRiskBuildingIds } = applyDwellingMaintenance(
      new Map([['h1', hh1], ['h2', hh2]]),
      buildings,
    );

    // hh1 pays cottage cost (1): 5 → 4, debt = 0
    expect(updatedHouseholds.get('h1')!.householdWealth).toBe(4);
    expect(updatedHouseholds.get('h1')!.wealthMaintenanceDebt).toBe(0);

    // hh2 can't pay homestead cost (2) with wealth = 1: debt 1 → 2, at risk
    expect(updatedHouseholds.get('h2')!.householdWealth).toBe(1);
    expect(updatedHouseholds.get('h2')!.wealthMaintenanceDebt).toBe(2);
    expect(atRiskBuildingIds).toContain('home_1');
    expect(atRiskBuildingIds).not.toContain('cot_1');
  });

  it('only at-risk dwellings appear in atRiskBuildingIds', () => {
    // hh1: can pay (cottage, wealth = 2) — not at risk
    // hh2: debt = 1, can't pay (cottage, wealth = 0) → atRisk
    const hh1 = makeHousehold('h1', { buildingSlots: slots('cot_a'), householdWealth: 2 });
    const hh2 = makeHousehold('h2', { buildingSlots: slots('cot_b'), householdWealth: 0, wealthMaintenanceDebt: 1 });
    const buildings = [
      makeBuilding('cottage', 'cot_a'),
      makeBuilding('cottage', 'cot_b'),
    ];
    const { atRiskBuildingIds } = applyDwellingMaintenance(
      new Map([['h1', hh1], ['h2', hh2]]),
      buildings,
    );
    expect(atRiskBuildingIds).toEqual(['cot_b']);
  });
});
