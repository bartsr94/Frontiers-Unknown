/**
 * Tests for the BUILDING_CATALOG metadata added in the Settlement UI Overhaul:
 *   - `ownership`: 'communal' | 'household'
 *   - `upgradeChainId`: string label for the chain
 *   - `tierInChain`: 1-based position within its chain
 *
 * These are pure data-correctness tests — no simulation logic, no store, no DOM.
 */

import { describe, it, expect } from 'vitest';
import { BUILDING_CATALOG } from '../../src/simulation/buildings/building-definitions';
import type { BuildingId } from '../../src/simulation/turn/game-state';

// ─── Ownership metadata ────────────────────────────────────────────────────────

describe('BuildingCatalog — ownership: household', () => {
  const HOUSEHOLD_IDS: BuildingId[] = [
    'wattle_hut', 'cottage', 'homestead', 'compound',  // dwellings
    'fields', 'mill',                                   // agriculture
    'stable',                                           // livestock
    'smithy', 'tannery', 'brewery',                     // production
  ];

  it.each(HOUSEHOLD_IDS)('%s has ownership: household', id => {
    expect(BUILDING_CATALOG[id].ownership).toBe('household');
  });
});

describe('BuildingCatalog — ownership: communal', () => {
  const COMMUNAL_IDS: BuildingId[] = [
    'camp', 'longhouse', 'roundhouse', 'great_hall', 'clan_lodge',
    'granary', 'gathering_hall', 'palisade', 'trading_post',
    'healers_hut', 'workshop',
    'bathhouse', 'bathhouse_improved', 'bathhouse_grand',
  ];

  it.each(COMMUNAL_IDS)('%s has ownership: communal', id => {
    expect(BUILDING_CATALOG[id].ownership).toBe('communal');
  });
});

// ─── Upgrade chain — dwelling tier (1 → 2 → 3 → 4) ───────────────────────────

describe('BuildingCatalog — dwelling upgrade chain', () => {
  it('wattle_hut is dwelling chain tier 1', () => {
    expect(BUILDING_CATALOG['wattle_hut'].upgradeChainId).toBe('dwelling');
    expect(BUILDING_CATALOG['wattle_hut'].tierInChain).toBe(1);
  });

  it('cottage is dwelling chain tier 2', () => {
    expect(BUILDING_CATALOG['cottage'].upgradeChainId).toBe('dwelling');
    expect(BUILDING_CATALOG['cottage'].tierInChain).toBe(2);
  });

  it('homestead is dwelling chain tier 3', () => {
    expect(BUILDING_CATALOG['homestead'].upgradeChainId).toBe('dwelling');
    expect(BUILDING_CATALOG['homestead'].tierInChain).toBe(3);
  });

  it('compound is dwelling chain tier 4', () => {
    expect(BUILDING_CATALOG['compound'].upgradeChainId).toBe('dwelling');
    expect(BUILDING_CATALOG['compound'].tierInChain).toBe(4);
  });

  it('dwelling tiers are unique (no two buildings share the same tier)', () => {
    const dwellingEntries = Object.values(BUILDING_CATALOG).filter(
      d => d.upgradeChainId === 'dwelling',
    );
    const tiers = dwellingEntries.map(d => d.tierInChain);
    expect(new Set(tiers).size).toBe(tiers.length);
  });
});

// ─── Upgrade chain — civic tier (1 → 2 variants → 3 variants) ────────────────

describe('BuildingCatalog — civic upgrade chain', () => {
  it('camp is civic chain tier 1', () => {
    expect(BUILDING_CATALOG['camp'].upgradeChainId).toBe('civic');
    expect(BUILDING_CATALOG['camp'].tierInChain).toBe(1);
  });

  it('longhouse is civic chain tier 2', () => {
    expect(BUILDING_CATALOG['longhouse'].upgradeChainId).toBe('civic');
    expect(BUILDING_CATALOG['longhouse'].tierInChain).toBe(2);
  });

  it('roundhouse is also civic chain tier 2 (Sauromatian variant)', () => {
    expect(BUILDING_CATALOG['roundhouse'].upgradeChainId).toBe('civic');
    expect(BUILDING_CATALOG['roundhouse'].tierInChain).toBe(2);
  });

  it('great_hall is civic chain tier 3', () => {
    expect(BUILDING_CATALOG['great_hall'].upgradeChainId).toBe('civic');
    expect(BUILDING_CATALOG['great_hall'].tierInChain).toBe(3);
  });

  it('clan_lodge is also civic chain tier 3 (Sauromatian variant)', () => {
    expect(BUILDING_CATALOG['clan_lodge'].upgradeChainId).toBe('civic');
    expect(BUILDING_CATALOG['clan_lodge'].tierInChain).toBe(3);
  });
});

// ─── Upgrade chain — bathhouse tier (1 → 2 → 3) ─────────────────────────────

describe('BuildingCatalog — bathhouse upgrade chain', () => {
  it('bathhouse is bathhouse chain tier 1', () => {
    expect(BUILDING_CATALOG['bathhouse'].upgradeChainId).toBe('bathhouse');
    expect(BUILDING_CATALOG['bathhouse'].tierInChain).toBe(1);
  });

  it('bathhouse_improved is bathhouse chain tier 2', () => {
    expect(BUILDING_CATALOG['bathhouse_improved'].upgradeChainId).toBe('bathhouse');
    expect(BUILDING_CATALOG['bathhouse_improved'].tierInChain).toBe(2);
  });

  it('bathhouse_grand is bathhouse chain tier 3', () => {
    expect(BUILDING_CATALOG['bathhouse_grand'].upgradeChainId).toBe('bathhouse');
    expect(BUILDING_CATALOG['bathhouse_grand'].tierInChain).toBe(3);
  });
});

// ─── Next-tier resolution (mirrors upgradeHouseholdBuilding store logic) ─────

function findNextTier(defId: BuildingId) {
  const current = BUILDING_CATALOG[defId];
  if (!current.upgradeChainId || current.tierInChain === undefined) return undefined;
  return Object.values(BUILDING_CATALOG).find(
    d =>
      d.upgradeChainId === current.upgradeChainId &&
      d.tierInChain === current.tierInChain! + 1,
  );
}

describe('BuildingCatalog — next-tier lookup (upgradeHouseholdBuilding logic)', () => {
  it('wattle_hut → cottage', () => {
    expect(findNextTier('wattle_hut')?.id).toBe('cottage');
  });

  it('cottage → homestead', () => {
    expect(findNextTier('cottage')?.id).toBe('homestead');
  });

  it('homestead → compound', () => {
    expect(findNextTier('homestead')?.id).toBe('compound');
  });

  it('compound (tier 4) has no next tier', () => {
    expect(findNextTier('compound')).toBeUndefined();
  });

  it('bathhouse → bathhouse_improved', () => {
    expect(findNextTier('bathhouse')?.id).toBe('bathhouse_improved');
  });

  it('bathhouse_improved → bathhouse_grand', () => {
    expect(findNextTier('bathhouse_improved')?.id).toBe('bathhouse_grand');
  });

  it('bathhouse_grand (tier 3) has no next tier', () => {
    expect(findNextTier('bathhouse_grand')).toBeUndefined();
  });

  it('building without an upgradeChainId returns undefined', () => {
    // granary has no upgrade chain
    expect(findNextTier('granary')).toBeUndefined();
  });
});

// ─── Structural invariants ────────────────────────────────────────────────────

describe('BuildingCatalog — upgrade chain structural invariants', () => {
  it('every building has an ownership value', () => {
    for (const [id, def] of Object.entries(BUILDING_CATALOG)) {
      expect(def.ownership, `${id} is missing 'ownership'`).toBeDefined();
    }
  });

  it('every building with upgradeChainId also has tierInChain', () => {
    for (const [id, def] of Object.entries(BUILDING_CATALOG)) {
      if (def.upgradeChainId !== undefined) {
        expect(def.tierInChain, `${id}: has upgradeChainId but missing tierInChain`).toBeDefined();
      }
    }
  });

  it('every building with tierInChain also has upgradeChainId', () => {
    for (const [id, def] of Object.entries(BUILDING_CATALOG)) {
      if (def.tierInChain !== undefined) {
        expect(def.upgradeChainId, `${id}: has tierInChain but missing upgradeChainId`).toBeDefined();
      }
    }
  });

  it('all tier values within each chain form a contiguous set starting at 1', () => {
    const chains = new Map<string, number[]>();
    for (const def of Object.values(BUILDING_CATALOG)) {
      if (def.upgradeChainId && def.tierInChain !== undefined) {
        const arr = chains.get(def.upgradeChainId) ?? [];
        arr.push(def.tierInChain);
        chains.set(def.upgradeChainId, arr);
      }
    }
    for (const [chainId, tiers] of chains) {
      const sorted = [...new Set(tiers)].sort((a, b) => a - b);
      const min = sorted[0]!;
      expect(min, `Chain '${chainId}' does not start at tier 1`).toBe(1);
      // Each tier in the sorted unique set increments by 1
      for (let i = 1; i < sorted.length; i++) {
        expect(
          sorted[i]! - sorted[i - 1]!,
          `Chain '${chainId}' has a gap between tiers ${sorted[i - 1]} and ${sorted[i]}`,
        ).toBe(1);
      }
    }
  });
});

// ─── Ownership — new household buildings (building expansion) ─────────────────

describe('BuildingCatalog — ownership: household (new expansion buildings)', () => {
  const NEW_HOUSEHOLD_IDS: BuildingId[] = [
    // Agriculture chain (T2–T4 — T1 is 'fields', already tested above)
    'barns_storehouses', 'farmstead', 'grain_silo',
    // Pastoralism chain (T1–T4)
    'cattle_pen', 'meadow', 'cattle_ranch', 'stock_farm',
    // Orchard chain (T1–T4)
    'orchard', 'berry_grove', 'beekeeper', 'grand_orchard',
  ];

  it.each(NEW_HOUSEHOLD_IDS)('%s has ownership: household', id => {
    expect(BUILDING_CATALOG[id].ownership).toBe('household');
  });
});

// ─── Ownership — new communal buildings (building expansion) ─────────────────

describe('BuildingCatalog — ownership: communal (new expansion buildings)', () => {
  const NEW_COMMUNAL_IDS: BuildingId[] = [
    // Forestry chain (T1–T4)
    'logging_camp', 'charcoal_burners', 'wood_pasture', 'sawmill',
    // Hunting chain (T1–T4)
    'hunters_lodge', 'hound_pens', 'hunting_towers', 'hunting_reserve',
    // Quarry chain (T1–T4)
    'stone_quarry', 'ore_mine', 'large_quarry', 'shaft_mine',
    // Hospice chain (T2–T4 — T1 is 'healers_hut', already tested above)
    'infirmary', 'hospital', 'grand_hospital',
  ];

  it.each(NEW_COMMUNAL_IDS)('%s has ownership: communal', id => {
    expect(BUILDING_CATALOG[id].ownership).toBe('communal');
  });
});

// ─── Upgrade chain — agriculture (fields T1 → grain_silo T4) ─────────────────

describe('BuildingCatalog — agriculture upgrade chain', () => {
  it('fields is agriculture chain tier 1', () => {
    expect(BUILDING_CATALOG['fields'].upgradeChainId).toBe('agriculture');
    expect(BUILDING_CATALOG['fields'].tierInChain).toBe(1);
  });

  it('barns_storehouses is agriculture chain tier 2', () => {
    expect(BUILDING_CATALOG['barns_storehouses'].upgradeChainId).toBe('agriculture');
    expect(BUILDING_CATALOG['barns_storehouses'].tierInChain).toBe(2);
  });

  it('farmstead is agriculture chain tier 3', () => {
    expect(BUILDING_CATALOG['farmstead'].upgradeChainId).toBe('agriculture');
    expect(BUILDING_CATALOG['farmstead'].tierInChain).toBe(3);
  });

  it('grain_silo is agriculture chain tier 4', () => {
    expect(BUILDING_CATALOG['grain_silo'].upgradeChainId).toBe('agriculture');
    expect(BUILDING_CATALOG['grain_silo'].tierInChain).toBe(4);
  });

  it('fields → barns_storehouses (next-tier lookup)', () => {
    expect(findNextTier('fields')?.id).toBe('barns_storehouses');
  });

  it('barns_storehouses → farmstead', () => {
    expect(findNextTier('barns_storehouses')?.id).toBe('farmstead');
  });

  it('farmstead → grain_silo', () => {
    expect(findNextTier('farmstead')?.id).toBe('grain_silo');
  });

  it('grain_silo (tier 4) has no next tier', () => {
    expect(findNextTier('grain_silo')).toBeUndefined();
  });
});

// ─── Upgrade chain — milling (mill T1) / mill rename regression ───────────────

describe('BuildingCatalog — milling chain and mill rename', () => {
  it('mill is milling chain tier 1', () => {
    expect(BUILDING_CATALOG['mill'].upgradeChainId).toBe('milling');
    expect(BUILDING_CATALOG['mill'].tierInChain).toBe(1);
  });

  it('mill is NOT in the agriculture chain (regression — was agriculture T2)', () => {
    expect(BUILDING_CATALOG['mill'].upgradeChainId).not.toBe('agriculture');
  });

  it('mill (tier 1 in a single-entry chain) has no next tier', () => {
    expect(findNextTier('mill')).toBeUndefined();
  });
});

// ─── Upgrade chain — pastoralism (cattle_pen T1 → stock_farm T4) ─────────────

describe('BuildingCatalog — pastoralism upgrade chain', () => {
  it('cattle_pen is pastoralism chain tier 1', () => {
    expect(BUILDING_CATALOG['cattle_pen'].upgradeChainId).toBe('pastoralism');
    expect(BUILDING_CATALOG['cattle_pen'].tierInChain).toBe(1);
  });

  it('meadow is pastoralism chain tier 2', () => {
    expect(BUILDING_CATALOG['meadow'].upgradeChainId).toBe('pastoralism');
    expect(BUILDING_CATALOG['meadow'].tierInChain).toBe(2);
  });

  it('cattle_ranch is pastoralism chain tier 3', () => {
    expect(BUILDING_CATALOG['cattle_ranch'].upgradeChainId).toBe('pastoralism');
    expect(BUILDING_CATALOG['cattle_ranch'].tierInChain).toBe(3);
  });

  it('stock_farm is pastoralism chain tier 4', () => {
    expect(BUILDING_CATALOG['stock_farm'].upgradeChainId).toBe('pastoralism');
    expect(BUILDING_CATALOG['stock_farm'].tierInChain).toBe(4);
  });

  it('cattle_pen → meadow (next-tier lookup)', () => {
    expect(findNextTier('cattle_pen')?.id).toBe('meadow');
  });

  it('stock_farm (tier 4) has no next tier', () => {
    expect(findNextTier('stock_farm')).toBeUndefined();
  });
});

// ─── Upgrade chain — orchard (orchard T1 → grand_orchard T4) ─────────────────

describe('BuildingCatalog — orchard upgrade chain', () => {
  it('orchard is orchard chain tier 1', () => {
    expect(BUILDING_CATALOG['orchard'].upgradeChainId).toBe('orchard');
    expect(BUILDING_CATALOG['orchard'].tierInChain).toBe(1);
  });

  it('berry_grove is orchard chain tier 2', () => {
    expect(BUILDING_CATALOG['berry_grove'].upgradeChainId).toBe('orchard');
    expect(BUILDING_CATALOG['berry_grove'].tierInChain).toBe(2);
  });

  it('beekeeper is orchard chain tier 3', () => {
    expect(BUILDING_CATALOG['beekeeper'].upgradeChainId).toBe('orchard');
    expect(BUILDING_CATALOG['beekeeper'].tierInChain).toBe(3);
  });

  it('grand_orchard is orchard chain tier 4', () => {
    expect(BUILDING_CATALOG['grand_orchard'].upgradeChainId).toBe('orchard');
    expect(BUILDING_CATALOG['grand_orchard'].tierInChain).toBe(4);
  });

  it('orchard → berry_grove (next-tier lookup)', () => {
    expect(findNextTier('orchard')?.id).toBe('berry_grove');
  });

  it('grand_orchard (tier 4) has no next tier', () => {
    expect(findNextTier('grand_orchard')).toBeUndefined();
  });
});

// ─── Upgrade chain — forestry (logging_camp T1 → sawmill T4) ─────────────────

describe('BuildingCatalog — forestry upgrade chain', () => {
  it('logging_camp is forestry chain tier 1', () => {
    expect(BUILDING_CATALOG['logging_camp'].upgradeChainId).toBe('forestry');
    expect(BUILDING_CATALOG['logging_camp'].tierInChain).toBe(1);
  });

  it('charcoal_burners is forestry chain tier 2', () => {
    expect(BUILDING_CATALOG['charcoal_burners'].upgradeChainId).toBe('forestry');
    expect(BUILDING_CATALOG['charcoal_burners'].tierInChain).toBe(2);
  });

  it('wood_pasture is forestry chain tier 3', () => {
    expect(BUILDING_CATALOG['wood_pasture'].upgradeChainId).toBe('forestry');
    expect(BUILDING_CATALOG['wood_pasture'].tierInChain).toBe(3);
  });

  it('sawmill is forestry chain tier 4', () => {
    expect(BUILDING_CATALOG['sawmill'].upgradeChainId).toBe('forestry');
    expect(BUILDING_CATALOG['sawmill'].tierInChain).toBe(4);
  });

  it('logging_camp → charcoal_burners (next-tier lookup)', () => {
    expect(findNextTier('logging_camp')?.id).toBe('charcoal_burners');
  });

  it('sawmill (tier 4) has no next tier', () => {
    expect(findNextTier('sawmill')).toBeUndefined();
  });
});

// ─── Upgrade chain — hunting (hunters_lodge T1 → hunting_reserve T4) ─────────

describe('BuildingCatalog — hunting upgrade chain', () => {
  it('hunters_lodge is hunting chain tier 1', () => {
    expect(BUILDING_CATALOG['hunters_lodge'].upgradeChainId).toBe('hunting');
    expect(BUILDING_CATALOG['hunters_lodge'].tierInChain).toBe(1);
  });

  it('hound_pens is hunting chain tier 2', () => {
    expect(BUILDING_CATALOG['hound_pens'].upgradeChainId).toBe('hunting');
    expect(BUILDING_CATALOG['hound_pens'].tierInChain).toBe(2);
  });

  it('hunting_towers is hunting chain tier 3', () => {
    expect(BUILDING_CATALOG['hunting_towers'].upgradeChainId).toBe('hunting');
    expect(BUILDING_CATALOG['hunting_towers'].tierInChain).toBe(3);
  });

  it('hunting_reserve is hunting chain tier 4', () => {
    expect(BUILDING_CATALOG['hunting_reserve'].upgradeChainId).toBe('hunting');
    expect(BUILDING_CATALOG['hunting_reserve'].tierInChain).toBe(4);
  });

  it('hunters_lodge → hound_pens (next-tier lookup)', () => {
    expect(findNextTier('hunters_lodge')?.id).toBe('hound_pens');
  });

  it('hunting_reserve (tier 4) has no next tier', () => {
    expect(findNextTier('hunting_reserve')).toBeUndefined();
  });
});

// ─── Upgrade chain — quarry (stone_quarry T1 → shaft_mine T4) ────────────────

describe('BuildingCatalog — quarry upgrade chain', () => {
  it('stone_quarry is quarry chain tier 1', () => {
    expect(BUILDING_CATALOG['stone_quarry'].upgradeChainId).toBe('quarry');
    expect(BUILDING_CATALOG['stone_quarry'].tierInChain).toBe(1);
  });

  it('ore_mine is quarry chain tier 2', () => {
    expect(BUILDING_CATALOG['ore_mine'].upgradeChainId).toBe('quarry');
    expect(BUILDING_CATALOG['ore_mine'].tierInChain).toBe(2);
  });

  it('large_quarry is quarry chain tier 3', () => {
    expect(BUILDING_CATALOG['large_quarry'].upgradeChainId).toBe('quarry');
    expect(BUILDING_CATALOG['large_quarry'].tierInChain).toBe(3);
  });

  it('shaft_mine is quarry chain tier 4', () => {
    expect(BUILDING_CATALOG['shaft_mine'].upgradeChainId).toBe('quarry');
    expect(BUILDING_CATALOG['shaft_mine'].tierInChain).toBe(4);
  });

  it('stone_quarry → ore_mine (next-tier lookup)', () => {
    expect(findNextTier('stone_quarry')?.id).toBe('ore_mine');
  });

  it('shaft_mine (tier 4) has no next tier', () => {
    expect(findNextTier('shaft_mine')).toBeUndefined();
  });
});

// ─── Upgrade chain — hospice (healers_hut T1 → grand_hospital T4) ────────────

describe('BuildingCatalog — hospice upgrade chain', () => {
  it('healers_hut is hospice chain tier 1', () => {
    expect(BUILDING_CATALOG['healers_hut'].upgradeChainId).toBe('hospice');
    expect(BUILDING_CATALOG['healers_hut'].tierInChain).toBe(1);
  });

  it('infirmary is hospice chain tier 2', () => {
    expect(BUILDING_CATALOG['infirmary'].upgradeChainId).toBe('hospice');
    expect(BUILDING_CATALOG['infirmary'].tierInChain).toBe(2);
  });

  it('hospital is hospice chain tier 3', () => {
    expect(BUILDING_CATALOG['hospital'].upgradeChainId).toBe('hospice');
    expect(BUILDING_CATALOG['hospital'].tierInChain).toBe(3);
  });

  it('grand_hospital is hospice chain tier 4', () => {
    expect(BUILDING_CATALOG['grand_hospital'].upgradeChainId).toBe('hospice');
    expect(BUILDING_CATALOG['grand_hospital'].tierInChain).toBe(4);
  });

  it('healers_hut → infirmary (next-tier lookup)', () => {
    expect(findNextTier('healers_hut')?.id).toBe('infirmary');
  });

  it('infirmary → hospital', () => {
    expect(findNextTier('infirmary')?.id).toBe('hospital');
  });

  it('hospital → grand_hospital', () => {
    expect(findNextTier('hospital')?.id).toBe('grand_hospital');
  });

  it('grand_hospital (tier 4) has no next tier', () => {
    expect(findNextTier('grand_hospital')).toBeUndefined();
  });
});

