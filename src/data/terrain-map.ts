import type { TerrainType } from '../simulation/turn/game-state';

/**
 * Static terrain map for the Ashmark region.
 *
 * Indexed as STATIC_TERRAIN_MAP[row][colIndex] where:
 *   row      = 0 (north) → 20 (south)
 *   colIndex = 0 (west)  → 20 (east)
 *   colIndex = offset_col − OFFSET_COL_START  (OFFSET_COL_START = 5)
 *
 * Named geographic regions visible on the world map:
 *
 *   The Stormwall Mountains — rows 0–5, full width.  An impassable northern wall.
 *   Forest Belt            — rows 6–11 centre.  Dense highland forest.
 *   River Corridor         — rows 9–14 centre, flowing roughly south-south-west.
 *   Wetland Delta          — rows 11–13 around ci 7–10.  River floodplain.
 *   The Bone Flats         — rows 12–20 west half (ci 0–9).  Open plains, desert fringe SW.
 *   The Bleak Hills        — rows 14–20 centre (ci 5–14).  Rolling southern hills.
 *   Eastern Coast          — cols 17–20.  Shore of the eastern sea.
 *
 * Settlement hex: row = 10, colIndex = 10  → always 'river'.
 * The six axial neighbours of the settlement are all safe terrain
 * (no mountains, jungle, or desert) so the engine's ring-1 enforcement
 * passes without any substitutions.
 */
export const STATIC_TERRAIN_MAP: readonly (readonly TerrainType[])[] = [
  // ── Row 0 – Deep Stormwall Mountains ──────────────────────────────────────
  // ci: 0           1           2           3           4           5           6           7           8           9           10          11          12          13          14          15          16          17          18          19          20
  ['mountains', 'mountains', 'mountains', 'mountains', 'mountains', 'mountains', 'mountains', 'mountains', 'mountains', 'mountains', 'mountains', 'mountains', 'mountains', 'mountains', 'mountains', 'mountains', 'mountains', 'mountains', 'mountains', 'mountains', 'mountains'],
  // ── Row 1 ─────────────────────────────────────────────────────────────────
  ['mountains', 'mountains', 'mountains', 'mountains', 'mountains', 'mountains', 'mountains', 'mountains', 'mountains', 'mountains', 'mountains', 'mountains', 'mountains', 'mountains', 'mountains', 'mountains', 'mountains', 'mountains', 'mountains', 'mountains', 'mountains'],
  // ── Row 2 ─────────────────────────────────────────────────────────────────
  ['mountains', 'mountains', 'mountains', 'mountains', 'mountains', 'mountains', 'mountains', 'mountains', 'mountains', 'mountains', 'mountains', 'mountains', 'mountains', 'mountains', 'mountains', 'mountains', 'mountains', 'mountains', 'mountains', 'mountains', 'mountains'],
  // ── Row 3 ─────────────────────────────────────────────────────────────────
  ['mountains', 'mountains', 'mountains', 'mountains', 'mountains', 'mountains', 'mountains', 'mountains', 'mountains', 'mountains', 'mountains', 'mountains', 'mountains', 'mountains', 'mountains', 'mountains', 'mountains', 'mountains', 'mountains', 'mountains', 'mountains'],
  // ── Row 4 – Stormwall southern edge; first foothills open in centre ───────
  ['mountains', 'mountains', 'mountains', 'mountains', 'mountains', 'mountains', 'mountains', 'mountains', 'hills',     'hills',     'hills',     'mountains', 'mountains', 'mountains', 'mountains', 'mountains', 'mountains', 'mountains', 'mountains', 'mountains', 'mountains'],
  // ── Row 5 – Foothills belt; mountains receding east and west ─────────────
  ['mountains', 'mountains', 'mountains', 'mountains', 'hills',     'hills',     'hills',     'hills',     'hills',     'hills',     'hills',     'hills',     'hills',     'hills',     'hills',     'mountains', 'mountains', 'mountains', 'mountains', 'mountains', 'mountains'],
  // ── Row 6 – Highland forest begins; foothills flanking ───────────────────
  ['mountains', 'mountains', 'hills',     'hills',     'hills',     'hills',     'forest',    'forest',    'forest',    'forest',    'forest',    'forest',    'hills',     'hills',     'hills',     'hills',     'hills',     'mountains', 'mountains', 'mountains', 'mountains'],
  // ── Row 7 – Dense forest belt; hills either side ─────────────────────────
  ['mountains', 'hills',     'hills',     'forest',    'forest',    'forest',    'forest',    'forest',    'forest',    'forest',    'forest',    'forest',    'forest',    'hills',     'hills',     'hills',     'hills',     'hills',     'hills',     'mountains', 'mountains'],
  // ── Row 8 – Forest reaches east; hills rising on flanks ──────────────────
  ['hills',     'hills',     'forest',    'forest',    'forest',    'forest',    'forest',    'forest',    'forest',    'forest',    'forest',    'forest',    'forest',    'forest',    'hills',     'hills',     'hills',     'hills',     'hills',     'hills',     'mountains'],
  // ── Row 9 – River emerges; flows south through the forest ────────────────
  ['hills',     'forest',    'forest',    'forest',    'forest',    'forest',    'forest',    'forest',    'forest',    'forest',    'river',     'river',     'forest',    'forest',    'forest',    'hills',     'hills',     'hills',     'hills',     'hills',     'plains'],
  // ── Row 10 – Settlement row; colIndex 10 = 'river' = settlement hex ──────
  ['hills',     'forest',    'forest',    'forest',    'forest',    'forest',    'forest',    'forest',    'forest',    'river',     'river',     'river',     'river',     'forest',    'forest',    'forest',    'hills',     'hills',     'hills',     'plains',    'plains'],
  // ── Row 11 – River widens; wetland delta forms south of settlement ────────
  ['hills',     'hills',     'forest',    'forest',    'forest',    'forest',    'forest',    'forest',    'river',     'wetlands',  'wetlands',  'river',     'forest',    'forest',    'forest',    'hills',     'hills',     'hills',     'plains',    'plains',    'plains'],
  // ── Row 12 – Wetland delta; plains open in the west ──────────────────────
  ['hills',     'plains',    'plains',    'forest',    'forest',    'forest',    'forest',    'wetlands',  'wetlands',  'river',     'plains',    'plains',    'forest',    'forest',    'hills',     'hills',     'hills',     'plains',    'plains',    'plains',    'plains'],
  // ── Row 13 – River meanders SW; Bone Flats broaden; forest thins ─────────
  ['plains',    'plains',    'plains',    'plains',    'forest',    'forest',    'wetlands',  'river',     'river',     'plains',    'plains',    'plains',    'forest',    'hills',     'hills',     'hills',     'plains',    'plains',    'plains',    'plains',    'coast'],
  // ── Row 14 – River delta; Bone Flats dominant west; Bleak Hills rising E ─
  ['plains',    'plains',    'plains',    'plains',    'plains',    'river',     'river',     'plains',    'plains',    'plains',    'plains',    'hills',     'hills',     'hills',     'hills',     'plains',    'plains',    'plains',    'plains',    'coast',     'coast'],
  // ── Row 15 – Bone Flats dominant; Bleak Hills centre; coast east ─────────
  ['plains',    'plains',    'plains',    'plains',    'plains',    'plains',    'plains',    'plains',    'plains',    'plains',    'hills',     'hills',     'hills',     'hills',     'plains',    'plains',    'plains',    'plains',    'coast',     'coast',     'coast'],
  // ── Row 16 – Bone Flats meets Bleak Hills; coast east ────────────────────
  ['plains',    'plains',    'plains',    'plains',    'plains',    'plains',    'plains',    'hills',     'hills',     'hills',     'hills',     'hills',     'hills',     'plains',    'plains',    'plains',    'plains',    'coast',     'coast',     'coast',     'coast'],
  // ── Row 17 – Desert fringe SW; Bleak Hills broad; coast east ─────────────
  ['desert',    'desert',    'plains',    'plains',    'plains',    'hills',     'hills',     'hills',     'hills',     'hills',     'hills',     'hills',     'plains',    'plains',    'plains',    'plains',    'coast',     'coast',     'coast',     'coast',     'coast'],
  // ── Row 18 – Desert deepens SW corner ────────────────────────────────────
  ['desert',    'desert',    'desert',    'plains',    'hills',     'hills',     'hills',     'hills',     'hills',     'hills',     'hills',     'plains',    'plains',    'plains',    'plains',    'coast',     'coast',     'coast',     'coast',     'coast',     'coast'],
  // ── Row 19 ────────────────────────────────────────────────────────────────
  ['desert',    'desert',    'desert',    'hills',     'hills',     'hills',     'hills',     'hills',     'hills',     'hills',     'plains',    'plains',    'plains',    'coast',     'coast',     'coast',     'coast',     'coast',     'coast',     'coast',     'coast'],
  // ── Row 20 – Southernmost row ─────────────────────────────────────────────
  ['desert',    'desert',    'hills',     'hills',     'hills',     'hills',     'hills',     'hills',     'hills',     'plains',    'plains',    'plains',    'coast',     'coast',     'coast',     'coast',     'coast',     'coast',     'coast',     'coast',     'coast'],
];
