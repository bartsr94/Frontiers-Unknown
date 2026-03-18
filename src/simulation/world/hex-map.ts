/**
 * Hex-map generation, coordinate helpers, and visibility utilities.
 *
 * Uses a pointed-top axial coordinate system (q = column, r = row) for
 * game logic.  Map generation and bounds-checking use **odd-r offset
 * coordinates** internally so that the game grid fills a pixel-space
 * rectangle with no parallelogram gaps in the corners.
 *
 * The settlement always occupies hex (SETTLEMENT_Q, SETTLEMENT_R) and
 * is centred within the rectangular offset grid.
 *
 * Pure logic — no React, no DOM, seeded RNG only (Hard Rule #1).
 */

import type { HexMap, HexCell, TerrainType, HexContent, HexContentType, GameConfig } from '../turn/game-state';
import type { SeededRNG } from '../../utils/rng';

// ─── Constants ────────────────────────────────────────────────────────────────

export const HEX_MAP_WIDTH = 21;
export const HEX_MAP_HEIGHT = 21;
/** Axial coordinates of the player settlement hex. */
export const SETTLEMENT_Q = 10;
export const SETTLEMENT_R = 10;

// ─── Offset ↔ Axial conversion (odd-r, pointed-top) ──────────────────────────
//
// Offset (col, row) naturally tiles into a pixel-space rectangle.
// Axial (q, r) is the canonical coordinate for game state.
//
// Reference: https://www.redblobgames.com/grids/hexagons/#conversions-offset

/** Convert odd-r offset → axial. */
export function offsetToAxial(col: number, row: number): { q: number; r: number } {
  const q = col - Math.floor((row - (row & 1)) / 2);
  return { q, r: row };
}

/** Convert axial → odd-r offset. */
export function axialToOffset(q: number, r: number): { col: number; row: number } {
  const col = q + Math.floor((r - (r & 1)) / 2);
  return { col, row: r };
}

/**
 * The starting offset column index that centres the settlement hex within
 * the rectangular grid.  Iteration runs col ∈ [OFFSET_COL_START, OFFSET_COL_START + WIDTH - 1].
 */
export const OFFSET_COL_START: number =
  axialToOffset(SETTLEMENT_Q, SETTLEMENT_R).col - Math.floor(HEX_MAP_WIDTH / 2);

/** Pixel centre of an odd-r offset hex (pointed-top). */
export function offsetToPixel(col: number, row: number, hexSize: number): { x: number; y: number } {
  const sqrt3 = Math.sqrt(3);
  return {
    x: hexSize * sqrt3 * (col + 0.5 * (row & 1)),
    y: hexSize * 1.5 * row,
  };
}

// ─── Bounds checking ─────────────────────────────────────────────────────────

/**
 * Returns true if the axial hex (q, r) lies within the rectangular game grid.
 * Converts to offset coordinates and checks against the offset bounding box.
 */
export function isInBounds(q: number, r: number): boolean {
  const { col } = axialToOffset(q, r);
  return (
    col >= OFFSET_COL_START &&
    col < OFFSET_COL_START + HEX_MAP_WIDTH &&
    r >= 0 &&
    r < HEX_MAP_HEIGHT
  );
}

// ─── Travel speed tables ─────────────────────────────────────────────────────

/**
 * Travel speed (hexes per season) on foot indexed by terrain type.
 * Mountains are fractional — 2 seasons to cross 1 hex.
 */
export const TERRAIN_TRAVEL_SPEED_FOOT: Record<TerrainType, number> = {
  plains:     4,
  forest:     2,
  jungle:     1,
  hills:      1,
  mountains:  0.5,
  river:      2,
  wetlands:   1,
  coast:      2,
  desert:     1,
};

/**
 * Travel speed when the expedition has a boat.
 * Only `river` and `coast` benefit; other terrain is unchanged from foot speed.
 */
export const TERRAIN_TRAVEL_SPEED_BOAT: Record<TerrainType, number> = {
  ...TERRAIN_TRAVEL_SPEED_FOOT,
  river: 6,
  coast: 4,
};

/** Food consumption per person per season (base). Desert terrains double this. */
export const BASE_FOOD_PER_PERSON_PER_SEASON = 0.25;

// ─── Coordinate helpers ───────────────────────────────────────────────────────

/** Returns the canonical Map key for an axial hex coordinate. */
export function hexKey(q: number, r: number): string {
  return `${q},${r}`;
}

/** Parses a hexKey string back into {q, r}. */
export function parseHexKey(key: string): { q: number; r: number } {
  const [qs, rs] = key.split(',');
  return { q: parseInt(qs!, 10), r: parseInt(rs!, 10) };
}

/** The six pointy-top axial neighbour direction vectors. */
const AXIAL_DIRECTIONS: ReadonlyArray<{ q: number; r: number }> = [
  { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
  { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 },
];

/** Returns all 6 axial neighbours (may be out of bounds — callers must filter). */
export function getNeighbours(q: number, r: number): Array<{ q: number; r: number }> {
  return AXIAL_DIRECTIONS.map(d => ({ q: q + d.q, r: r + d.r }));
}

/** Returns valid neighbours that lie within the rectangular game grid. */
export function getBoundedNeighbours(q: number, r: number): Array<{ q: number; r: number }> {
  return getNeighbours(q, r).filter(n => isInBounds(n.q, n.r));
}

/** Axial (cube-distance) distance between two hexes. */
export function axialDistance(aq: number, ar: number, bq: number, br: number): number {
  return (Math.abs(aq - bq) + Math.abs(aq + ar - bq - br) + Math.abs(ar - br)) / 2;
}

/**
 * Converts axial hex coordinates to pixel position (pointed-top orientation).
 * @param hexSize - The circumradius of the hexagon in pixels.
 */
export function hexToPixel(
  q: number,
  r: number,
  hexSize: number,
): { x: number; y: number } {
  const x = hexSize * (Math.sqrt(3) * q + (Math.sqrt(3) / 2) * r);
  const y = hexSize * ((3 / 2) * r);
  return { x, y };
}

/**
 * Converts pixel coordinates back to the nearest axial hex.
 * Uses cube-round to snap to the closest hex centre.
 */
export function pixelToHex(
  x: number,
  y: number,
  hexSize: number,
): { q: number; r: number } {
  const qf = ((Math.sqrt(3) / 3) * x - (1 / 3) * y) / hexSize;
  const rf = ((2 / 3) * y) / hexSize;
  // Cube coordinates: s = -q - r
  const sf = -qf - rf;

  let rq = Math.round(qf);
  let rr = Math.round(rf);
  const rs = Math.round(sf);

  const dq = Math.abs(rq - qf);
  const dr = Math.abs(rr - rf);
  const ds = Math.abs(rs - sf);

  if (dq > dr && dq > ds) {
    rq = -rr - rs;
  } else if (dr > ds) {
    rr = -rq - rs;
  }

  return { q: rq, r: rr };
}

// ─── Iteration helper ────────────────────────────────────────────────────────

/**
 * Calls `fn` for every (q, r) in the rectangular game grid.
 * Iterates in offset-row order (top to bottom, left to right).
 */
function forEachGameHex(fn: (q: number, r: number) => void): void {
  for (let row = 0; row < HEX_MAP_HEIGHT; row++) {
    for (let ci = 0; ci < HEX_MAP_WIDTH; ci++) {
      const col = OFFSET_COL_START + ci;
      const { q, r } = offsetToAxial(col, row);
      fn(q, r);
    }
  }
}

// ─── Map generation ───────────────────────────────────────────────────────────

/**
 * Terrain probabilities for "safe ring" hexes adjacent to the settlement.
 * Mountains, jungle, and desert are excluded from the starting area.
 */
const RING1_TERRAIN_WEIGHTS: Array<[TerrainType, number]> = [
  ['plains',   40],
  ['forest',   25],
  ['river',    15],
  ['hills',    10],
  ['wetlands',  5],
  ['coast',     5],
];

/** Default terrain weight table for the open map. */
const OPEN_TERRAIN_WEIGHTS: Array<[TerrainType, number]> = [
  ['plains',    30],
  ['forest',    22],
  ['hills',     15],
  ['jungle',    10],
  ['river',      8],
  ['wetlands',   6],
  ['coast',      4],
  ['mountains',  4],
  ['desert',     1],
];

/** Content seeding probability per terrain type. Entries not listed = 0 chance. */
const TERRAIN_CONTENT_CHANCES: Partial<Record<TerrainType, Array<[HexContentType, number]>>> = {
  plains:    [['ruins', 5], ['burial_ground', 5], ['old_road', 8], ['travellers', 6]],
  forest:    [['animal_den', 10], ['ruins', 4], ['hidden_shrine', 5], ['abandoned_camp', 6]],
  hills:     [['ruins', 8], ['burial_ground', 6], ['animal_den', 5]],
  jungle:    [['hidden_shrine', 8], ['ruins', 6], ['disease_vector', 5], ['fresh_water_spring', 4]],
  mountains: [['resource_cache', 10], ['ruins', 4], ['weather_hazard', 8]],
  river:     [['fresh_water_spring', 12], ['old_road', 6], ['travellers', 5]],
  wetlands:  [['disease_vector', 10], ['animal_den', 6], ['fresh_water_spring', 5]],
  coast:     [['travellers', 8], ['ruins', 4], ['fresh_water_spring', 3]],
  desert:    [['ruins', 12], ['resource_cache', 6], ['weather_hazard', 6], ['abandoned_camp', 4]],
};

/** How many initial 'scouted' hexes appear (from ring-1) at game start. */
const STARTING_SCOUTED_COUNT = 3;

/**
 * Fills a blob of terrain using a simple flood-fill with decay probability.
 * Each step has a `decayChance` of not propagating, creating organic blob shapes.
 */
function growTerrainBlob(
  cells: Map<string, TerrainType>,
  startQ: number,
  startR: number,
  terrain: TerrainType,
  radius: number,
  decayChance: number,
  rng: SeededRNG,
): void {
  const frontier: Array<{ q: number; r: number; dist: number }> = [{ q: startQ, r: startR, dist: 0 }];
  const visited = new Set<string>([hexKey(startQ, startR)]);

  while (frontier.length > 0) {
    const current = frontier.shift()!;
    cells.set(hexKey(current.q, current.r), terrain);

    if (current.dist >= radius) continue;

    for (const nb of getNeighbours(current.q, current.r)) {
      if (!isInBounds(nb.q, nb.r)) continue;
      const k = hexKey(nb.q, nb.r);
      if (visited.has(k)) continue;
      visited.add(k);
      // Probability of continuing the blob decreases with distance.
      const survivorChance = 1 - decayChance * (current.dist / radius);
      if (rng.next() <= survivorChance) {
        frontier.push({ q: nb.q, r: nb.r, dist: current.dist + 1 });
      }
    }
  }
}

/**
 * Picks a random hex on the given edge of the rectangular grid.
 * Returns axial (q, r) coordinates.
 */
function randomEdgeHex(
  edge: 0 | 1 | 2 | 3,
  rng: SeededRNG,
): { q: number; r: number } {
  const colEnd = OFFSET_COL_START + HEX_MAP_WIDTH - 1;
  if (edge === 0) {
    // Top edge: row = 0, random col
    const col = rng.nextInt(OFFSET_COL_START + 1, colEnd - 1);
    return offsetToAxial(col, 0);
  } else if (edge === 1) {
    // Right edge: col = max, random row
    const row = rng.nextInt(1, HEX_MAP_HEIGHT - 2);
    return offsetToAxial(colEnd, row);
  } else if (edge === 2) {
    // Bottom edge: row = max, random col
    const row = HEX_MAP_HEIGHT - 1;
    const col = rng.nextInt(OFFSET_COL_START + 1, colEnd - 1);
    return offsetToAxial(col, row);
  } else {
    // Left edge: col = min, random row
    const row = rng.nextInt(1, HEX_MAP_HEIGHT - 2);
    return offsetToAxial(OFFSET_COL_START, row);
  }
}

/**
 * Carves a river corridor across the map using a biased random walk.
 * The river avoids the settlement hex but may pass adjacent to it.
 */
function carveRiver(
  cells: Map<string, TerrainType>,
  rng: SeededRNG,
): void {
  // Rivers start from a random map edge.
  const edgeSide = rng.nextInt(0, 3) as 0 | 1 | 2 | 3;
  let { q, r } = randomEdgeHex(edgeSide, rng);

  // Walk toward the opposite edge, or meander off another edge.
  const oppositeSide = ((edgeSide + 2) % 4) as 0 | 1 | 2 | 3;
  const target = randomEdgeHex(oppositeSide, rng);
  const targetQ = target.q;
  const targetR = target.r;

  const visited = new Set<string>();
  let steps = 0;
  const maxSteps = HEX_MAP_WIDTH * HEX_MAP_HEIGHT;

  while (steps < maxSteps) {
    const k = hexKey(q, r);
    if (!visited.has(k)) {
      visited.add(k);
      // Never overwrite settlement hex with river during generation
      // (settlement is placed on river manually during initialisation).
      if (!(q === SETTLEMENT_Q && r === SETTLEMENT_R)) {
        cells.set(k, 'river');
      }
    }

    if (q === targetQ && r === targetR) break;

    // Pick neighbour that moves toward target, with 30% random drift.
    const nbs = getNeighbours(q, r).filter(n => isInBounds(n.q, n.r));
    if (nbs.length === 0) break;

    const unvisited = nbs.filter(n => !visited.has(hexKey(n.q, n.r)));
    const candidates = unvisited.length > 0 ? unvisited : nbs;

    if (rng.next() < 0.7) {
      // Bias toward target.
      candidates.sort((a, b) =>
        axialDistance(a.q, a.r, targetQ, targetR) - axialDistance(b.q, b.r, targetQ, targetR)
      );
      const best = candidates[0]!;
      q = best.q;
      r = best.r;
    } else {
      // Random drift.
      const picked = rng.pick(candidates);
      q = picked.q;
      r = picked.r;
    }
    steps++;
  }
}

/**
 * Decides whether to seed content in a hex based on terrain probabilities.
 * Returns the content object or null.
 */
function maybeSeedContent(
  terrain: TerrainType,
  rng: SeededRNG,
): HexContent | null {
  const chances = TERRAIN_CONTENT_CHANCES[terrain];
  if (!chances) return null;

  // Roll for each possible content type.
  for (const [type, pct] of chances) {
    if (rng.nextInt(1, 100) <= pct) {
      return {
        type,
        discovered: false,
      };
    }
  }
  return null;
}

/**
 * Generates the full HexMap for a new game.
 *
 * The game grid is a 21×21 rectangle in offset (pixel) space, centred on
 * the settlement hex.  All iteration uses `forEachGameHex` / offset loops
 * so the resulting map has no parallelogram gaps.
 *
 * Generation steps:
 * 1. Fill entire grid with plains as a base.
 * 2. Grow 6–10 terrain blobs (forest, hills, mountains, jungle, wetlands, desert).
 * 3. Carve 1–3 river corridors.
 * 4. Place settlement at (SETTLEMENT_Q, SETTLEMENT_R) on river terrain.
 * 5. Enforce safe ring-1 around settlement (no mountains, jungle, or desert).
 * 6. Seed content in eligible hexes.
 * 7. Place 2–5 tribe territories on appropriate terrain.
 * 8. Set starting visibility: settlement = 'visited'; 3 ring-1 hexes = 'scouted'; rest = 'fog'.
 */
export function generateHexMap(config: GameConfig, rng: SeededRNG): HexMap {
  const width = HEX_MAP_WIDTH;
  const height = HEX_MAP_HEIGHT;

  // Step 1 — Base terrain layer (offset-rectangular iteration).
  const terrainLayer = new Map<string, TerrainType>();
  forEachGameHex((q, r) => {
    terrainLayer.set(hexKey(q, r), 'plains');
  });

  // Step 2 — Terrain blobs.
  const blobCount = rng.nextInt(6, 10);
  const blobTerrains: TerrainType[] = ['forest', 'forest', 'hills', 'mountains', 'jungle', 'wetlands', 'desert'];
  for (let i = 0; i < blobCount; i++) {
    const terrain = rng.pick(blobTerrains);
    // Pick a random hex within the game grid for the blob origin.
    const row = rng.nextInt(0, height - 1);
    const col = rng.nextInt(OFFSET_COL_START, OFFSET_COL_START + width - 1);
    const { q: bq, r: br } = offsetToAxial(col, row);
    const radius = rng.nextInt(2, 4);
    growTerrainBlob(terrainLayer, bq, br, terrain, radius, 0.5, rng);
  }

  // Step 3 — River corridors.
  const riverCount = rng.nextInt(1, 3);
  for (let i = 0; i < riverCount; i++) {
    carveRiver(terrainLayer, rng);
  }

  // Step 4 — Settlement always on river.
  terrainLayer.set(hexKey(SETTLEMENT_Q, SETTLEMENT_R), 'river');

  // Step 5 — Safe ring-1 around settlement.
  const SAFE_RING_WEIGHTS = RING1_TERRAIN_WEIGHTS;
  for (const nb of getBoundedNeighbours(SETTLEMENT_Q, SETTLEMENT_R)) {
    const currentTerrain = terrainLayer.get(hexKey(nb.q, nb.r))!;
    const isUnsafe = currentTerrain === 'mountains' || currentTerrain === 'jungle' || currentTerrain === 'desert';
    if (isUnsafe) {
      // Replace with a safe terrain type.
      const safeType = rng.weightedPick(
        Object.fromEntries(SAFE_RING_WEIGHTS) as Partial<Record<TerrainType, number>>,
      );
      terrainLayer.set(hexKey(nb.q, nb.r), safeType);
    }
  }

  // Step 6 — Build HexCell objects with content seeding (offset-rectangular).
  const cells = new Map<string, HexCell>();
  forEachGameHex((q, r) => {
    const k = hexKey(q, r);
    const terrain = terrainLayer.get(k)!;
    // Don't seed content on settlement hex or adjacent hexes.
    const distFromSettlement = axialDistance(q, r, SETTLEMENT_Q, SETTLEMENT_R);
    const seededContent = distFromSettlement >= 2 ? maybeSeedContent(terrain, rng) : null;
    const contents: HexContent[] = seededContent ? [seededContent] : [];

    cells.set(k, {
      q,
      r,
      terrain,
      visibility: 'fog',
      contents,
      firstVisitedTurn: null,
    });
  });

  // Step 7 — Place tribe territories based on config startingTribes.
  // Each tribe gets a territory hex seeded towards the map edges.
  const usedTerritoryHexes = new Set<string>();
  for (const _tribeId of config.startingTribes) {
    let placed = false;
    for (let attempt = 0; attempt < 30 && !placed; attempt++) {
      // Bias toward edges (distance from centre ≥ 4).
      const row = rng.nextInt(0, height - 1);
      const col = rng.nextInt(OFFSET_COL_START, OFFSET_COL_START + width - 1);
      const { q, r } = offsetToAxial(col, row);
      const dist = axialDistance(q, r, SETTLEMENT_Q, SETTLEMENT_R);
      if (dist >= 4 && !usedTerritoryHexes.has(hexKey(q, r))) {
        usedTerritoryHexes.add(hexKey(q, r));
        const cell = cells.get(hexKey(q, r));
        if (cell) {
          cells.set(hexKey(q, r), {
            ...cell,
            contents: [{ type: 'tribe_territory', tribeId: _tribeId, discovered: false }],
          });
        }
        placed = true;
      }
    }
  }

  // Step 8 — Starting visibility.
  // Settlement = visited, 3 random ring-1 hexes = scouted, rest = fog.
  const settKey = hexKey(SETTLEMENT_Q, SETTLEMENT_R);
  const settCell = cells.get(settKey)!;
  cells.set(settKey, { ...settCell, visibility: 'visited' });

  const ring1 = getBoundedNeighbours(SETTLEMENT_Q, SETTLEMENT_R);
  const scoutedIndices = new Set<number>();
  while (scoutedIndices.size < STARTING_SCOUTED_COUNT && scoutedIndices.size < ring1.length) {
    scoutedIndices.add(rng.nextInt(0, ring1.length - 1));
  }
  for (const idx of scoutedIndices) {
    const nb = ring1[idx]!;
    const nbCell = cells.get(hexKey(nb.q, nb.r))!;
    cells.set(hexKey(nb.q, nb.r), { ...nbCell, visibility: 'scouted' });
  }

  return {
    width,
    height,
    cells,
    settlementQ: SETTLEMENT_Q,
    settlementR: SETTLEMENT_R,
  };
}

// ─── Visibility utilities ─────────────────────────────────────────────────────

/**
 * Marks a hex as `'visited'` and all of its in-bounds neighbours as at least
 * `'scouted'`. Returns a new HexMap (immutable update).
 */
export function markHexVisited(hexMap: HexMap, q: number, r: number, turn: number): HexMap {
  const newCells = new Map(hexMap.cells);

  // Mark the target hex visited.
  const targetKey = hexKey(q, r);
  const target = newCells.get(targetKey);
  if (target) {
    newCells.set(targetKey, { ...target, visibility: 'visited', firstVisitedTurn: turn });
  }

  // Mark neighbours as at least scouted.
  for (const nb of getBoundedNeighbours(q, r)) {
    const k = hexKey(nb.q, nb.r);
    const cell = newCells.get(k);
    if (cell && cell.visibility === 'fog') {
      newCells.set(k, { ...cell, visibility: 'scouted' });
    }
  }

  return { ...hexMap, cells: newCells };
}

/**
 * Returns all hexes within a given axial radius of (cq, cr).
 * Useful for wide-area scouts or search expeditions.
 */
export function hexesInRadius(
  hexMap: HexMap,
  cq: number,
  cr: number,
  radius: number,
): HexCell[] {
  const result: HexCell[] = [];
  for (const [, cell] of hexMap.cells) {
    if (axialDistance(cell.q, cell.r, cq, cr) <= radius) {
      result.push(cell);
    }
  }
  return result;
}

/**
 * Calculates the number of seasons required to travel between two hexes
 * on foot (or by boat if `hasBoat` is true). Returns null if the destination
 * is unreachable (e.g. an isolated mountain range with no path — not currently
 * modelled; reserved for future pathfinding).
 */
export function estimateTravelSeasons(
  fromQ: number,
  fromR: number,
  toQ: number,
  toR: number,
  hexMap: HexMap,
  hasBoat: boolean,
): number {
  // Simple straight-line estimate using the destination terrain.
  // A more accurate pathfinding pass can refine this later.
  const destKey = hexKey(toQ, toR);
  const destCell = hexMap.cells.get(destKey);
  if (!destCell) return Infinity;

  const speedTable = hasBoat ? TERRAIN_TRAVEL_SPEED_BOAT : TERRAIN_TRAVEL_SPEED_FOOT;
  const speed = speedTable[destCell.terrain];
  if (speed <= 0) return Infinity;

  const dist = axialDistance(fromQ, fromR, toQ, toR);
  return dist / speed;
}