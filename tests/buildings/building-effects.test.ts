/**
 * Tests for pure building effect getters.
 */

import { describe, it, expect } from 'vitest';
import {
  getShelterCapacity,
  getBuildingFlatProductionBonus,
  getChildMortalityModifier,
  getLanguageDriftMultiplier,
  getDefenseBonus,
  getOvercrowdingRatio,
  getOvercrowdingMortalityModifiers,
  getOvercrowdingProductionMultiplier,
  hasBuilding,
  lacksBuilding,
} from '../../src/simulation/buildings/building-effects';
import type { BuiltBuilding } from '../../src/simulation/turn/game-state';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const camp:       BuiltBuilding = { defId: 'camp',        instanceId: 'camp_0',        builtTurn: 0, style: null, claimedByPersonIds: [], ownerHouseholdId: null, assignedWorkerIds: [] };
const longhouse:  BuiltBuilding = { defId: 'longhouse',   instanceId: 'longhouse_0',   builtTurn: 1, style: null, claimedByPersonIds: [], ownerHouseholdId: null, assignedWorkerIds: [] };
const granary:    BuiltBuilding = { defId: 'granary',     instanceId: 'granary_0',     builtTurn: 2, style: null, claimedByPersonIds: [], ownerHouseholdId: null, assignedWorkerIds: [] };
const healersHut: BuiltBuilding = { defId: 'healers_hut', instanceId: 'healers_hut_0', builtTurn: 3, style: null, claimedByPersonIds: [], ownerHouseholdId: null, assignedWorkerIds: [] };
const gathering:  BuiltBuilding = { defId: 'gathering_hall', instanceId: 'gh_0',       builtTurn: 4, style: 'imanian', claimedByPersonIds: [], ownerHouseholdId: null, assignedWorkerIds: [] };
const palisade:   BuiltBuilding = { defId: 'palisade',    instanceId: 'palisade_0',    builtTurn: 5, style: null, claimedByPersonIds: [], ownerHouseholdId: null, assignedWorkerIds: [] };

// ─── getShelterCapacity ───────────────────────────────────────────────────────

describe('getShelterCapacity', () => {
  it('returns 0 for empty buildings list', () => {
    expect(getShelterCapacity([])).toBe(0);
  });

  it('returns camp capacity (20)', () => {
    expect(getShelterCapacity([camp])).toBe(20);
  });

  it('returns longhouse capacity (30) when longhouse replaces camp', () => {
    expect(getShelterCapacity([longhouse])).toBe(30);
  });

  it('sums capacities from all buildings', () => {
    // camp(20) + granary(0) + healers_hut(0) = 20
    expect(getShelterCapacity([camp, granary, healersHut])).toBe(20);
  });
});

// ─── getBuildingFlatProductionBonus ──────────────────────────────────────────

describe('getBuildingFlatProductionBonus', () => {
  it('returns all zeros when no buildings produce flat bonuses', () => {
    const bonus = getBuildingFlatProductionBonus([camp]);
    expect(Object.values(bonus).every(v => (v ?? 0) === 0)).toBe(true);
  });

  it('includes granary food bonus (+1 food/season)', () => {
    const bonus = getBuildingFlatProductionBonus([granary]);
    expect((bonus.food ?? 0)).toBeGreaterThan(0);
  });
});

// ─── getChildMortalityModifier ────────────────────────────────────────────────

describe('getChildMortalityModifier', () => {
  it('returns 1.0 without healer\'s hut', () => {
    expect(getChildMortalityModifier([camp])).toBe(1.0);
  });

  it('returns 0.5 with healer\'s hut', () => {
    expect(getChildMortalityModifier([camp, healersHut])).toBe(0.5);
  });
});

// ─── getLanguageDriftMultiplier ───────────────────────────────────────────────

describe('getLanguageDriftMultiplier', () => {
  it('returns 1.0 without gathering hall', () => {
    expect(getLanguageDriftMultiplier([camp])).toBe(1.0);
  });

  it('returns 1.5 with gathering hall', () => {
    expect(getLanguageDriftMultiplier([gathering])).toBe(1.5);
  });
});

// ─── getDefenseBonus ─────────────────────────────────────────────────────────

describe('getDefenseBonus', () => {
  it('returns 0 without palisade', () => {
    expect(getDefenseBonus([camp])).toBe(0);
  });

  it('returns 0.20 with palisade', () => {
    expect(getDefenseBonus([camp, palisade])).toBeCloseTo(0.20);
  });
});

// ─── getOvercrowdingRatio ─────────────────────────────────────────────────────

describe('getOvercrowdingRatio', () => {
  it('returns 2.0 when no buildings (pathological overcrowding state)', () => {
    expect(getOvercrowdingRatio(10, [])).toBe(2.0);
  });

  it('returns ratio of pop / capacity', () => {
    expect(getOvercrowdingRatio(10, [camp])).toBeCloseTo(10 / 20);
  });

  it('returns > 1.0 when overcrowded', () => {
    expect(getOvercrowdingRatio(25, [camp])).toBeGreaterThan(1.0);
  });
});

// ─── getOvercrowdingMortalityModifiers ───────────────────────────────────────

describe('getOvercrowdingMortalityModifiers', () => {
  it('returns 1.0/1.0 when ratio <= 1.0 (no penalty)', () => {
    const m = getOvercrowdingMortalityModifiers(0.9);
    expect(m.childMortalityMultiplier).toBe(1.0);
    expect(m.elderlyDeathMultiplier).toBe(1.0);
  });

  it('returns increased child mort modifier at ratio > 1.0, no elderly modifier', () => {
    const m = getOvercrowdingMortalityModifiers(1.1);
    expect(m.childMortalityMultiplier).toBeGreaterThan(1.0);
    expect(m.elderlyDeathMultiplier).toBe(1.0); // elderly only affected at > 1.5
  });

  it('returns highest modifiers at ratio > 1.5', () => {
    const m1 = getOvercrowdingMortalityModifiers(1.1);
    const m2 = getOvercrowdingMortalityModifiers(1.6);
    expect(m2.childMortalityMultiplier).toBeGreaterThanOrEqual(m1.childMortalityMultiplier);
    expect(m2.elderlyDeathMultiplier).toBeGreaterThanOrEqual(m1.elderlyDeathMultiplier);
  });
});

// ─── getOvercrowdingProductionMultiplier ─────────────────────────────────────

describe('getOvercrowdingProductionMultiplier', () => {
  it('returns 1.0 when not severely overcrowded', () => {
    expect(getOvercrowdingProductionMultiplier(1.0)).toBe(1.0);
    expect(getOvercrowdingProductionMultiplier(1.1)).toBe(1.0);
  });

  it('returns 0.9 when ratio > 1.25', () => {
    expect(getOvercrowdingProductionMultiplier(1.3)).toBe(0.9);
  });
});

// ─── hasBuilding / lacksBuilding ─────────────────────────────────────────────

describe('hasBuilding / lacksBuilding', () => {
  it('hasBuilding returns true when building is present', () => {
    expect(hasBuilding([camp, granary], 'granary')).toBe(true);
  });

  it('hasBuilding returns false when building is absent', () => {
    expect(hasBuilding([camp], 'granary')).toBe(false);
  });

  it('lacksBuilding is the inverse of hasBuilding', () => {
    expect(lacksBuilding([camp, granary], 'granary')).toBe(false);
    expect(lacksBuilding([camp], 'granary')).toBe(true);
  });
});
