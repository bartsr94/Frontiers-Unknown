import { describe, it, expect } from 'vitest';
import {
  CRAFT_RECIPES,
  getAvailableCrafts,
  validateCraft,
  applyCraft,
  type CraftRecipeId,
} from '../../src/simulation/economy/crafting';
import type { ResourceStock, BuiltBuilding } from '../../src/simulation/turn/game-state';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeResources(overrides: Partial<ResourceStock> = {}): ResourceStock {
  return {
    food: 0,
    cattle: 0,
    wealth: 0,
    steel: 0,
    lumber: 0,
    stone: 0,
    medicine: 0,
    horses: 0,
    ...overrides,
  };
}

function makeBuilding(defId: BuiltBuilding['defId']): BuiltBuilding {
  return { defId, instanceId: `${defId}_0`, builtTurn: 0, style: null, claimedByPersonIds: [], ownerHouseholdId: null, assignedWorkerIds: [] };
}

const STABLE = makeBuilding('stable');
const HEALERS_HUT = makeBuilding('healers_hut');

// ─── CRAFT_RECIPES ────────────────────────────────────────────────────────────

describe('CRAFT_RECIPES', () => {
  it('defines all 4 expected recipes', () => {
    const ids: CraftRecipeId[] = [
      'craft_cattle_slaughter',
      'craft_horse_breeding',
      'craft_medicine_prep',
      'craft_boat',
    ];
    for (const id of ids) {
      expect(CRAFT_RECIPES[id]).toBeDefined();
      expect(CRAFT_RECIPES[id].label.length).toBeGreaterThan(0);
    }
  });

  it('horse_breeding requires stable building', () => {
    expect(CRAFT_RECIPES.craft_horse_breeding.requires.buildings).toContain('stable');
  });

  it('medicine_prep requires healers_hut building', () => {
    expect(CRAFT_RECIPES.craft_medicine_prep.requires.buildings).toContain('healers_hut');
  });

  it('cattle_slaughter requires no building', () => {
    expect(CRAFT_RECIPES.craft_cattle_slaughter.requires.buildings).toHaveLength(0);
  });
});

// ─── getAvailableCrafts ───────────────────────────────────────────────────────

describe('getAvailableCrafts', () => {
  it('returns empty when no resources', () => {
    const result = getAvailableCrafts([], makeResources());
    expect(result).toHaveLength(0);
  });

  it('returns cattle_slaughter when cattle ≥ 1 (no building required)', () => {
    const result = getAvailableCrafts([], makeResources({ cattle: 2 }));
    const ids = result.map(r => r.id);
    expect(ids).toContain('craft_cattle_slaughter');
  });

  it('returns medicine_prep when healers_hut present + wealth + food', () => {
    const result = getAvailableCrafts([HEALERS_HUT], makeResources({ food: 3, wealth: 2 }));
    const ids = result.map(r => r.id);
    expect(ids).toContain('craft_medicine_prep');
  });

  it('excludes medicine_prep without healers_hut', () => {
    const result = getAvailableCrafts([], makeResources({ food: 10, wealth: 10 }));
    expect(result.map(r => r.id)).not.toContain('craft_medicine_prep');
  });

  it('excludes horse_breeding without stable', () => {
    const result = getAvailableCrafts([], makeResources({ horses: 2, food: 4 }));
    expect(result.map(r => r.id)).not.toContain('craft_horse_breeding');
  });

  it('includes horse_breeding with stable + sufficient resources', () => {
    const result = getAvailableCrafts([STABLE], makeResources({ horses: 2, food: 4 }));
    expect(result.map(r => r.id)).toContain('craft_horse_breeding');
  });
});

// ─── validateCraft ────────────────────────────────────────────────────────────

describe('validateCraft', () => {
  // craft_cattle_slaughter

  it('cattle_slaughter: ok with 2 cattle', () => {
    const result = validateCraft('craft_cattle_slaughter', [], makeResources({ cattle: 2 }));
    expect(result.ok).toBe(true);
  });

  it('cattle_slaughter: fails with < 2 cattle', () => {
    const result = validateCraft('craft_cattle_slaughter', [], makeResources({ cattle: 1 }));
    expect(result.ok).toBe(false);
  });

  // craft_horse_breeding

  it('horse_breeding: ok with stable + 2 horses + 4 food', () => {
    const result = validateCraft('craft_horse_breeding', [STABLE], makeResources({ horses: 3, food: 5 }));
    expect(result.ok).toBe(true);
  });

  it('horse_breeding: fails without stable', () => {
    const result = validateCraft('craft_horse_breeding', [], makeResources({ horses: 3, food: 5 }));
    expect(result.ok).toBe(false);
  });

  it('horse_breeding: fails with insufficient horses', () => {
    const result = validateCraft('craft_horse_breeding', [STABLE], makeResources({ horses: 1, food: 5 }));
    expect(result.ok).toBe(false);
  });

  // craft_medicine_prep

  it('medicine_prep: ok with healers_hut + 3 food + 2 wealth', () => {
    const result = validateCraft('craft_medicine_prep', [HEALERS_HUT], makeResources({ food: 5, wealth: 4 }));
    expect(result.ok).toBe(true);
  });

  it('medicine_prep: fails without healers_hut', () => {
    const result = validateCraft('craft_medicine_prep', [], makeResources({ food: 5, wealth: 4 }));
    expect(result.ok).toBe(false);
  });

  it('medicine_prep: fails with insufficient wealth', () => {
    const result = validateCraft('craft_medicine_prep', [HEALERS_HUT], makeResources({ food: 5, wealth: 1 }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBeTruthy();
  });
});

// ─── applyCraft ───────────────────────────────────────────────────────────────

describe('applyCraft', () => {
  it('cattle_slaughter: deducts 2 cattle, adds 3 food', () => {
    const resources = makeResources({ cattle: 5, food: 10 });
    const result = applyCraft('craft_cattle_slaughter', resources);
    expect(result.cattle).toBe(3);
    expect(result.food).toBe(13);
  });

  it('horse_breeding: deducts 2 horses + 4 food, adds 1 horse', () => {
    const resources = makeResources({ horses: 4, food: 10 });
    const result = applyCraft('craft_horse_breeding', resources);
    expect(result.horses).toBe(3); // 4 - 2 + 1
    expect(result.food).toBe(6);   // 10 - 4
  });

  it('medicine_prep: deducts 3 food + 2 wealth, adds 4 medicine', () => {
    const resources = makeResources({ food: 8, wealth: 5, medicine: 1 });
    const result = applyCraft('craft_medicine_prep', resources);
    expect(result.food).toBe(5);
    expect(result.wealth).toBe(3);
    expect(result.medicine).toBe(5);
  });

  it('does not mutate input resources', () => {
    const resources = makeResources({ cattle: 3, food: 5 });
    applyCraft('craft_cattle_slaughter', resources);
    expect(resources.cattle).toBe(3);
    expect(resources.food).toBe(5);
  });

  it('floors at 0 — no negative resources', () => {
    // Edge case: exact amount available
    const resources = makeResources({ cattle: 2, food: 0 });
    const result = applyCraft('craft_cattle_slaughter', resources);
    expect(result.cattle).toBe(0);
    expect(result.food).toBe(3);
  });
});
