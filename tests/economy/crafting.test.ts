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
    goods: 0,
    steel: 0,
    lumber: 0,
    stone: 0,
    medicine: 0,
    gold: 0,
    horses: 0,
    ...overrides,
  };
}

function makeBuilding(defId: BuiltBuilding['defId']): BuiltBuilding {
  return { defId, instanceId: `${defId}_0`, builtTurn: 0, style: null };
}

const WORKSHOP = makeBuilding('workshop');
const STABLE = makeBuilding('stable');
const HEALERS_HUT = makeBuilding('healers_hut');

// ─── CRAFT_RECIPES ────────────────────────────────────────────────────────────

describe('CRAFT_RECIPES', () => {
  it('defines all 5 expected recipes', () => {
    const ids: CraftRecipeId[] = [
      'craft_lumber_to_goods',
      'craft_cattle_slaughter',
      'craft_horse_breeding',
      'craft_medicine_prep',
      'craft_goods_to_gold',
    ];
    for (const id of ids) {
      expect(CRAFT_RECIPES[id]).toBeDefined();
      expect(CRAFT_RECIPES[id].label.length).toBeGreaterThan(0);
    }
  });

  it('lumber_to_goods requires workshop building', () => {
    expect(CRAFT_RECIPES.craft_lumber_to_goods.requires.buildings).toContain('workshop');
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

  it('goods_to_gold requires no building', () => {
    expect(CRAFT_RECIPES.craft_goods_to_gold.requires.buildings).toHaveLength(0);
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

  it('returns goods_to_gold when goods ≥ 1 (no building required)', () => {
    const result = getAvailableCrafts([], makeResources({ goods: 1 }));
    const ids = result.map(r => r.id);
    expect(ids).toContain('craft_goods_to_gold');
  });

  it('excludes lumber_to_goods without workshop', () => {
    const result = getAvailableCrafts([], makeResources({ lumber: 10 }));
    expect(result.map(r => r.id)).not.toContain('craft_lumber_to_goods');
  });

  it('includes lumber_to_goods with workshop + lumber', () => {
    const result = getAvailableCrafts([WORKSHOP], makeResources({ lumber: 10 }));
    expect(result.map(r => r.id)).toContain('craft_lumber_to_goods');
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
  // craft_lumber_to_goods

  it('lumber_to_goods: ok with workshop + 3 lumber', () => {
    const result = validateCraft('craft_lumber_to_goods', [WORKSHOP], makeResources({ lumber: 5 }));
    expect(result.ok).toBe(true);
  });

  it('lumber_to_goods: fails without workshop', () => {
    const result = validateCraft('craft_lumber_to_goods', [], makeResources({ lumber: 5 }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('workshop');
  });

  it('lumber_to_goods: fails with insufficient lumber', () => {
    const result = validateCraft('craft_lumber_to_goods', [WORKSHOP], makeResources({ lumber: 2 }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('lumber');
  });

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

  it('medicine_prep: ok with healers_hut + 3 food + 2 goods', () => {
    const result = validateCraft('craft_medicine_prep', [HEALERS_HUT], makeResources({ food: 5, goods: 4 }));
    expect(result.ok).toBe(true);
  });

  it('medicine_prep: fails without healers_hut', () => {
    const result = validateCraft('craft_medicine_prep', [], makeResources({ food: 5, goods: 4 }));
    expect(result.ok).toBe(false);
  });

  // craft_goods_to_gold

  it('goods_to_gold: ok with 5 goods', () => {
    const result = validateCraft('craft_goods_to_gold', [], makeResources({ goods: 5 }));
    expect(result.ok).toBe(true);
  });

  it('goods_to_gold: fails with < 5 goods', () => {
    const result = validateCraft('craft_goods_to_gold', [], makeResources({ goods: 4 }));
    expect(result.ok).toBe(false);
  });
});

// ─── applyCraft ───────────────────────────────────────────────────────────────

describe('applyCraft', () => {
  it('lumber_to_goods: deducts 3 lumber, adds 4 goods', () => {
    const resources = makeResources({ lumber: 10, goods: 2 });
    const result = applyCraft('craft_lumber_to_goods', resources);
    expect(result.lumber).toBe(7);
    expect(result.goods).toBe(6);
  });

  it('cattle_slaughter: deducts 2 cattle, adds 3 food + 1 goods', () => {
    const resources = makeResources({ cattle: 5, food: 10, goods: 1 });
    const result = applyCraft('craft_cattle_slaughter', resources);
    expect(result.cattle).toBe(3);
    expect(result.food).toBe(13);
    expect(result.goods).toBe(2);
  });

  it('horse_breeding: deducts 2 horses + 4 food, adds 1 horse', () => {
    const resources = makeResources({ horses: 4, food: 10 });
    const result = applyCraft('craft_horse_breeding', resources);
    expect(result.horses).toBe(3); // 4 - 2 + 1
    expect(result.food).toBe(6);   // 10 - 4
  });

  it('medicine_prep: deducts 3 food + 2 goods, adds 4 medicine', () => {
    const resources = makeResources({ food: 8, goods: 5, medicine: 1 });
    const result = applyCraft('craft_medicine_prep', resources);
    expect(result.food).toBe(5);
    expect(result.goods).toBe(3);
    expect(result.medicine).toBe(5);
  });

  it('goods_to_gold: deducts 5 goods, adds 2 gold', () => {
    const resources = makeResources({ goods: 8, gold: 3 });
    const result = applyCraft('craft_goods_to_gold', resources);
    expect(result.goods).toBe(3);
    expect(result.gold).toBe(5);
  });

  it('does not mutate input resources', () => {
    const resources = makeResources({ goods: 8, gold: 3 });
    applyCraft('craft_goods_to_gold', resources);
    expect(resources.goods).toBe(8);
    expect(resources.gold).toBe(3);
  });

  it('floors at 0 — no negative resources', () => {
    // Edge case: exact amount available
    const resources = makeResources({ goods: 5, gold: 0 });
    const result = applyCraft('craft_goods_to_gold', resources);
    expect(result.goods).toBe(0);
    expect(result.gold).toBe(2);
  });
});
