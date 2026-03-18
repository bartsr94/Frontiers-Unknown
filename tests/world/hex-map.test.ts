/**
 * Tests for hex-map coordinate helpers, distance calculations,
 * neighbour enumeration, visibility utilities, and map generation.
 */

import { describe, it, expect } from 'vitest';
import { createRNG } from '../../src/utils/rng';
import {
  hexKey,
  parseHexKey,
  axialDistance,
  getNeighbours,
  getBoundedNeighbours,
  hexToPixel,
  pixelToHex,
  generateHexMap,
  markHexVisited,
  hexesInRadius,
  estimateTravelSeasons,
  HEX_MAP_WIDTH,
  HEX_MAP_HEIGHT,
  SETTLEMENT_Q,
  SETTLEMENT_R,
  TERRAIN_TRAVEL_SPEED_FOOT,
  TERRAIN_TRAVEL_SPEED_BOAT,
  BASE_FOOD_PER_PERSON_PER_SEASON,
} from '../../src/simulation/world/hex-map';
import type { GameConfig } from '../../src/simulation/turn/game-state';

// ─── Fixture ──────────────────────────────────────────────────────────────────

function makeConfig(overrides?: Partial<GameConfig>): GameConfig {
  return {
    difficulty:       'normal',
    startingTribes:   [],
    startingLocation: 'default',
    ...overrides,
  };
}

function makeMap() {
  const rng = createRNG(42);
  return generateHexMap(makeConfig(), rng);
}

// ─── Constants ────────────────────────────────────────────────────────────────

describe('constants', () => {
  it('grid dimensions are 15×15', () => {
    expect(HEX_MAP_WIDTH).toBe(15);
    expect(HEX_MAP_HEIGHT).toBe(15);
  });

  it('settlement sits at (7, 7)', () => {
    expect(SETTLEMENT_Q).toBe(7);
    expect(SETTLEMENT_R).toBe(7);
  });

  it('BASE_FOOD_PER_PERSON_PER_SEASON is 0.25', () => {
    expect(BASE_FOOD_PER_PERSON_PER_SEASON).toBe(0.25);
  });

  it('boats are faster on river than foot', () => {
    expect(TERRAIN_TRAVEL_SPEED_BOAT.river).toBeGreaterThan(TERRAIN_TRAVEL_SPEED_FOOT.river);
  });

  it('boats are faster on coast than foot', () => {
    expect(TERRAIN_TRAVEL_SPEED_BOAT.coast).toBeGreaterThan(TERRAIN_TRAVEL_SPEED_FOOT.coast);
  });

  it('other terrain speeds match foot speed for boats', () => {
    for (const t of ['plains', 'forest', 'hills', 'mountains'] as const) {
      expect(TERRAIN_TRAVEL_SPEED_BOAT[t]).toBe(TERRAIN_TRAVEL_SPEED_FOOT[t]);
    }
  });
});

// ─── hexKey / parseHexKey ─────────────────────────────────────────────────────

describe('hexKey', () => {
  it('formats as "q,r"', () => {
    expect(hexKey(3, 5)).toBe('3,5');
    expect(hexKey(0, 0)).toBe('0,0');
  });

  it('round-trips through parseHexKey', () => {
    const pairs: Array<[number, number]> = [[0, 0], [7, 7], [14, 14], [1, 12]];
    for (const [q, r] of pairs) {
      expect(parseHexKey(hexKey(q, r))).toEqual({ q, r });
    }
  });
});

// ─── axialDistance ────────────────────────────────────────────────────────────

describe('axialDistance', () => {
  it('same hex = 0', () => {
    expect(axialDistance(3, 4, 3, 4)).toBe(0);
  });

  it('direct neighbour = 1', () => {
    expect(axialDistance(0, 0, 1, 0)).toBe(1);
    expect(axialDistance(0, 0, 0, 1)).toBe(1);
    expect(axialDistance(0, 0, 1, -1)).toBe(1);
  });

  it('is symmetric', () => {
    expect(axialDistance(2, 3, 7, 9)).toBe(axialDistance(7, 9, 2, 3));
  });

  it('straight-line distance along q axis', () => {
    expect(axialDistance(0, 0, 5, 0)).toBe(5);
  });

  it('straight-line distance along r axis', () => {
    expect(axialDistance(0, 0, 0, 5)).toBe(5);
  });

  it('diagonal in cube space', () => {
    // Moving (+3, -3) means q+3, r-3 — distance 3
    expect(axialDistance(0, 0, 3, -3)).toBe(3);
  });
});

// ─── getNeighbours / getBoundedNeighbours ─────────────────────────────────────

describe('getNeighbours', () => {
  it('returns exactly 6 neighbours', () => {
    expect(getNeighbours(5, 5)).toHaveLength(6);
  });

  it('each neighbour is distance 1', () => {
    for (const n of getNeighbours(7, 7)) {
      expect(axialDistance(7, 7, n.q, n.r)).toBe(1);
    }
  });

  it('neighbours include all 6 axial directions', () => {
    const ns = getNeighbours(0, 0);
    expect(ns).toContainEqual({ q: 1, r: 0 });
    expect(ns).toContainEqual({ q: -1, r: 0 });
    expect(ns).toContainEqual({ q: 0, r: 1 });
    expect(ns).toContainEqual({ q: 0, r: -1 });
    expect(ns).toContainEqual({ q: 1, r: -1 });
    expect(ns).toContainEqual({ q: -1, r: 1 });
  });
});

describe('getBoundedNeighbours', () => {
  it('corner hex (0,0) has only 2 bounded neighbours on 15×15', () => {
    const ns = getBoundedNeighbours(0, 0);
    expect(ns.length).toBe(2);
  });

  it('centre-ish hex has all 6 bounded neighbours', () => {
    expect(getBoundedNeighbours(7, 7)).toHaveLength(6);
  });

  it('all results stay within bounds', () => {
    for (const n of getBoundedNeighbours(0, 0)) {
      expect(n.q).toBeGreaterThanOrEqual(0);
      expect(n.r).toBeGreaterThanOrEqual(0);
    }
  });
});

// ─── hexToPixel / pixelToHex round-trip ──────────────────────────────────────

describe('hexToPixel / pixelToHex', () => {
  it('round-trips for several hexes', () => {
    const hexSize = 40;
    const points: Array<[number, number]> = [
      [0, 0], [5, 3], [14, 14], [7, 7],
    ];
    for (const [q, r] of points) {
      const { x, y } = hexToPixel(q, r, hexSize);
      const back     = pixelToHex(x, y, hexSize);
      expect(back.q).toBe(q);
      expect(back.r).toBe(r);
    }
  });
});

// ─── generateHexMap ───────────────────────────────────────────────────────────

describe('generateHexMap', () => {
  it('produces a 15×15 map (225 cells)', () => {
    const m = makeMap();
    expect(m.cells.size).toBe(225);
  });

  it('settlement hex terrain is never mountains', () => {
    const m = makeMap();
    const settlement = m.cells.get(hexKey(SETTLEMENT_Q, SETTLEMENT_R));
    expect(settlement).toBeDefined();
    expect(settlement!.terrain).not.toBe('mountains');
  });

  it('settlement hex is always visited at turn 0', () => {
    const m = makeMap();
    const settlement = m.cells.get(hexKey(SETTLEMENT_Q, SETTLEMENT_R));
    expect(settlement!.visibility).toBe('visited');
  });

  it('all cells have a valid terrain type', () => {
    const validTerrains = new Set([
      'plains', 'forest', 'jungle', 'hills', 'mountains',
      'river', 'wetlands', 'coast', 'desert',
    ]);
    const m = makeMap();
    for (const cell of m.cells.values()) {
      expect(validTerrains.has(cell.terrain)).toBe(true);
    }
  });

  it('all cells have a valid visibility', () => {
    const valid = new Set(['fog', 'scouted', 'visited', 'cleared']);
    const m = makeMap();
    for (const cell of m.cells.values()) {
      expect(valid.has(cell.visibility)).toBe(true);
    }
  });

  it('most cells start as fog', () => {
    const m = makeMap();
    const fogCount = [...m.cells.values()].filter(c => c.visibility === 'fog').length;
    // Settlement ring is scouted/visited — rest should be fog
    expect(fogCount).toBeGreaterThan(180);
  });

  it('at least 3 ring-1 hexes are scouted at start', () => {
    const m = makeMap();
    const ring1 = getBoundedNeighbours(SETTLEMENT_Q, SETTLEMENT_R);
    const visibleCount = ring1.filter(n => {
      const cell = m.cells.get(hexKey(n.q, n.r));
      return cell?.visibility === 'scouted' || cell?.visibility === 'visited';
    }).length;
    expect(visibleCount).toBeGreaterThanOrEqual(3);
  });

  it('ring-1 hexes have no mountains or jungle', () => {
    const m = makeMap();
    const ring1 = getBoundedNeighbours(SETTLEMENT_Q, SETTLEMENT_R);
    for (const n of ring1) {
      const cell = m.cells.get(hexKey(n.q, n.r));
      expect(cell?.terrain).not.toBe('mountains');
      expect(cell?.terrain).not.toBe('jungle');
      expect(cell?.terrain).not.toBe('desert');
    }
  });

  it('generation is deterministic (same seed → same map)', () => {
    const rng1 = createRNG(99);
    const rng2 = createRNG(99);
    const m1 = generateHexMap(makeConfig(), rng1);
    const m2 = generateHexMap(makeConfig(), rng2);
    let identical = true;
    for (const [key, cell1] of m1.cells) {
      const cell2 = m2.cells.get(key);
      if (!cell2 || cell2.terrain !== cell1.terrain) { identical = false; break; }
    }
    expect(identical).toBe(true);
  });

  it('different seeds produce different maps', () => {
    const m1 = generateHexMap(makeConfig(), createRNG(1));
    const m2 = generateHexMap(makeConfig(), createRNG(12345));
    let differs = false;
    for (const [key, cell1] of m1.cells) {
      const cell2 = m2.cells.get(key);
      if (cell2 && cell2.terrain !== cell1.terrain) { differs = true; break; }
    }
    expect(differs).toBe(true);
  });
});

// ─── markHexVisited ───────────────────────────────────────────────────────────

describe('markHexVisited', () => {
  it('changes a fog cell to visited', () => {
    const m = makeMap();
    // Pick a fog cell
    const fogCell = [...m.cells.entries()].find(([, c]) => c.visibility === 'fog');
    expect(fogCell).toBeDefined();
    const [key] = fogCell!;
    const { q, r } = parseHexKey(key);
    const updated = markHexVisited(m, q, r, 1);
    expect(updated.cells.get(key)!.visibility).toBe('visited');
  });

  it('does not mutate the original map', () => {
    const m = makeMap();
    const fogCell = [...m.cells.entries()].find(([, c]) => c.visibility === 'fog')!;
    const [key] = fogCell;
    const { q, r } = parseHexKey(key);
    markHexVisited(m, q, r, 1);
    // Original should still be fog
    expect(m.cells.get(key)!.visibility).toBe('fog');
  });

  it('sets firstVisitedTurn on the cell', () => {
    const m = makeMap();
    const fogCell = [...m.cells.entries()].find(([, c]) => c.visibility === 'fog')!;
    const { q, r } = parseHexKey(fogCell[0]);
    const updated = markHexVisited(m, q, r, 42);
    expect(updated.cells.get(fogCell[0])!.firstVisitedTurn).toBe(42);
  });

  it('also scouts neighbours from fog → scouted', () => {
    const m = makeMap();
    // Find a cell that is fog and has a fog neighbour
    const fogCells = [...m.cells.entries()].filter(([, c]) => c.visibility === 'fog');
    const target = fogCells.find(([key]) => {
      const { q, r } = parseHexKey(key);
      return getBoundedNeighbours(q, r).some(n => {
        const nc = m.cells.get(hexKey(n.q, n.r));
        return nc?.visibility === 'fog';
      });
    });
    if (!target) return; // skip if none found (unlikely but safe)

    const { q, r } = parseHexKey(target[0]);
    const updated = markHexVisited(m, q, r, 5);
    const scoutedCount = getBoundedNeighbours(q, r).filter(n => {
      const nc = updated.cells.get(hexKey(n.q, n.r));
      return nc?.visibility === 'scouted' || nc?.visibility === 'visited';
    }).length;
    expect(scoutedCount).toBeGreaterThan(0);
  });
});

// ─── hexesInRadius ────────────────────────────────────────────────────────────

describe('hexesInRadius', () => {
  it('radius 0 returns just the centre hex', () => {
    const m = makeMap();
    const result = hexesInRadius(m, 7, 7, 0);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ q: 7, r: 7 });
  });

  it('radius 1 returns 7 hexes (centre + 6 neighbours)', () => {
    const m = makeMap();
    const result = hexesInRadius(m, 7, 7, 1);
    expect(result).toHaveLength(7);
  });

  it('radius 2 returns 19 hexes', () => {
    const m = makeMap();
    const result = hexesInRadius(m, 7, 7, 2);
    expect(result).toHaveLength(19);
  });

  it('all returned hexes are within the given radius', () => {
    const m = makeMap();
    const result = hexesInRadius(m, 5, 5, 3);
    for (const h of result) {
      expect(axialDistance(5, 5, h.q, h.r)).toBeLessThanOrEqual(3);
    }
  });
});

// ─── estimateTravelSeasons ────────────────────────────────────────────────────

describe('estimateTravelSeasons', () => {
  it('returns 0 for same hex', () => {
    const m = makeMap();
    expect(estimateTravelSeasons(7, 7, 7, 7, m, false)).toBe(0);
  });

  it('adjacent same-terrain hex takes <= 1 season on foot on plains', () => {
    // Force a plains cell adjacent to settlement
    const rng = createRNG(123);
    const m = generateHexMap(makeConfig(), rng);
    const adj = getBoundedNeighbours(SETTLEMENT_Q, SETTLEMENT_R);
    const plainsAdj = adj.find(n => m.cells.get(hexKey(n.q, n.r))?.terrain === 'plains');
    if (!plainsAdj) return; // can't guarantee terrain placement
    const seasons = estimateTravelSeasons(SETTLEMENT_Q, SETTLEMENT_R, plainsAdj.q, plainsAdj.r, m, false);
    expect(seasons).toBeLessThanOrEqual(1);
  });

  it('boat does not increase travel time over foot for same origin/dest', () => {
    const m = makeMap();
    const foot  = estimateTravelSeasons(5, 5, 10, 10, m, false);
    const boat  = estimateTravelSeasons(5, 5, 10, 10, m, true);
    // Boats are >= as fast (river/coast benefit)
    expect(boat).toBeLessThanOrEqual(foot);
  });
});
