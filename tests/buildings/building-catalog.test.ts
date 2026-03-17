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
