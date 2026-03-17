/**
 * Building definitions — the static data catalogue for all buildings that can
 * be constructed in the settlement.
 *
 * BuildingDef describes the cost, construction time, effects, and relationships
 * of each building type. Instances of constructed buildings are stored as
 * BuiltBuilding records in Settlement.buildings.
 */

import type { BuildingId, BuildingStyle, ResourceStock } from '../turn/game-state';

// ─── BuildingDef Interface ─────────────────────────────────────────────────────

/**
 * Static definition of a building type.
 * All values here are constants — per-instance state lives in BuiltBuilding.
 */
export interface BuildingDef {
  id: BuildingId;
  /** Display name shown in the UI. */
  name: string;
  /** One-sentence flavour description for the build menu. */
  description: string;
  /**
   * Category for grouping in the build menu.
   * 'civic'    = the communal shelter upgrade chain.
   * 'dwelling' = private household dwellings (multiple instances allowed).
   */
  category: 'civic' | 'food' | 'industry' | 'defence' | 'social' | 'dwelling';
  /** Whether this building has cultural style variants (Imanian / Sauromatian). */
  hasStyleVariants: boolean;
  /**
   * Style-specific display names.
   * Only present when hasStyleVariants is true.
   */
  styleNames?: Record<BuildingStyle, string>;
  /**
   * Style-specific one-line cultural effect notes shown in the build menu.
   */
  styleCultureNote?: Record<BuildingStyle, string>;
  /** Resource cost to start construction. Deducted immediately on queue. */
  cost: Partial<ResourceStock>;
  /** Construction time in seasons. Each season = 100 progress points. */
  buildSeasons: number;
  /**
   * If set, the building with this ID is removed from Settlement.buildings
   * when this building completes (upgrade chain mechanic).
   */
  replacesId?: BuildingId;
  /**
   * If set, this building cannot be started unless the named building is
   * already present in Settlement.buildings.
   */
  requires?: BuildingId;
  /**
   * Shelter capacity this building provides.
   * For civic buildings this replaces the prior building's capacity.
   * For specialists it adds 0 (they don't house people).
   */
  shelterCapacity: number;
  /**
   * Flat resource production bonus added every season this building is present.
   * Applied after role-based production; not affected by seasonal modifiers
   * (it represents stored reserves and steady output, not harvest).
   */
  flatProductionBonus?: Partial<ResourceStock>;
  /**
   * Per-worker role bonus: resource delta added per person in the given role
   * each season when this building is present.
   *
   * Example: Workshop gives every craftsman +1 goods/season.
   */
  roleProductionBonus?: {
    role: string;
    bonus: Partial<ResourceStock>;
  };
  /**
   * Multiplier applied to child mortality. Healer's Hut: 0.5 (halves risk).
   * Absent value is treated as 1.0 (no effect).
   */
  childMortalityModifier?: number;
  /**
   * Multiplier applied to the settlement-wide language drift rate.
   * Gathering Hall: 1.5 (50% faster language learning).
   * Absent value is treated as 1.0 (no effect).
   */
  languageDriftMultiplier?: number;
  /**
   * Culture pull applied to every living person per season.
   * Nudges culturalFluency toward the named direction.
   * For buildings with style variants, pull direction is inferred from style.
   */
  culturePull?: {
    /** Strength per person per season (e.g. 0.005). */
    strength: number;
    /**
     * If 'from_style', pull direction is inferred from the BuiltBuilding's style.
     * Otherwise explicitly named.
     */
    direction: 'from_style' | 'imanian' | 'sauromatian';
  };
  /**
   * Defense bonus (additive fraction). Palisade: 0.20 (+20% defense strength).
   * Absent value is treated as 0.
   */
  defenseBonus?: number;
  /**
   * Skill growth bonuses granted to people in matching roles.
   * Applied once per season per qualifying person.
   */
  skillGrowth?: Array<{
    /**
     * Which role(s) benefit. 'council' is a special pseudo-role meaning
     * the person must be in GameState.councilMemberIds.
     */
    role: string | 'council';
    skill: string;
    bonus: number;
  }>;
  /**
   * Whether the Granary's winter food protection is active when this building
   * is present. Halves food decay in winter.
   */
  winterFoodProtection?: boolean;
  /**
   * Maximum number of production workers that can be simultaneously assigned
   * to this building instance.
   *
   *   undefined  = no worker association (passive buildings: Granary, Palisade, etc.)
   *   0          = passive benefit only; no assigned workers
   *   N > 0      = hard cap; role assignment is blocked once this count is reached
   *
   * Civic / defence / social buildings that have no worker concept leave this
   * undefined.
   */
  workerSlots?: number;
  /**
   * When true, multiple built instances of this building type may coexist in
   * the settlement simultaneously. The "Already constructed" guard in canBuild()
   * is skipped for these buildings.
   * Defaults to false (undefined = false).
   */
  allowMultiple?: boolean;
  /**
   * The WorkRole that workers assigned to this building should have.
   * Used by the role-assignment system to find available slots.
   * Only meaningful when workerSlots > 0.
   */
  workerRole?: string;
  /**
   * Additive bonus to conception chance rolls, applied settlement-wide.
   * E.g. 0.05 = +5% on top of the base fertility rate.
   * Multiple buildings stack; total is capped at +0.25 in fertility.ts.
   */
  fertilityBonus?: number;
  /**
   * Whether this building is communal (settlement-owned) or can be placed
   * in a household's private building grid.
   * Defaults to 'communal' if omitted (safe fallback for future buildings).
   */
  ownership?: 'communal' | 'household';
  /**
   * Upgrade chain identifier. Groups buildings into a progression.
   * E.g. 'dwelling' groups wattle_hut → cottage → homestead → compound.
   */
  upgradeChainId?: string;
  /**
   * 1-indexed position within the upgrade chain.
   * 1 = base tier, 2 = first upgrade, etc.
   */
  tierInChain?: number;
}

// ─── Building Catalogue ────────────────────────────────────────────────────────

/**
 * Complete static catalogue of all building types.
 * Keyed by BuildingId for O(1) lookup.
 */
export const BUILDING_CATALOG: Record<BuildingId, BuildingDef> = {

  // ── Civic tier 1 (starting building) ───────────────────────────────────────

  camp: {
    id: 'camp',
    name: 'Camp',
    description: 'The initial shelters of the expedition — hide tents, fire pits, and a central storage cache.',
    category: 'civic',
    hasStyleVariants: false,
    cost: {},
    buildSeasons: 0,
    shelterCapacity: 15,
    ownership: 'communal',
    upgradeChainId: 'civic',
    tierInChain: 1,
  },

  // ── Civic tier 2 (replaces Camp) ───────────────────────────────────────────

  longhouse: {
    id: 'longhouse',
    name: 'Longhouse',
    description: 'A sturdy Imanian timber hall — permanent quarters for thirty settlers with space for communal meals.',
    category: 'civic',
    hasStyleVariants: false, // Longhouse IS the Imanian variant; Roundhouse is the Sauromatian one
    cost: { lumber: 15, stone: 5 },
    buildSeasons: 2,
    replacesId: 'camp',
    requires: 'camp',
    shelterCapacity: 30,
    culturePull: { strength: 0.005, direction: 'imanian' },
    skillGrowth: [
      { role: 'council', skill: 'leadership', bonus: 1 },
      { role: 'council', skill: 'custom', bonus: 1 },
    ],
    ownership: 'communal',
    upgradeChainId: 'civic',
    tierInChain: 2,
  },

  roundhouse: {
    id: 'roundhouse',
    name: 'Roundhouse',
    description: 'A circle of wattle-and-daub roundhouses in the Sauromatian tradition — warm, communal, and deeply familiar to local women.',
    category: 'civic',
    hasStyleVariants: false,
    cost: { lumber: 20 },
    buildSeasons: 2,
    replacesId: 'camp',
    requires: 'camp',
    shelterCapacity: 30,
    culturePull: { strength: 0.005, direction: 'sauromatian' },
    skillGrowth: [
      { role: 'council', skill: 'leadership', bonus: 1 },
    ],
    ownership: 'communal',
    upgradeChainId: 'civic',
    tierInChain: 2,
  },

  // ── Civic tier 3 (replaces tier 2) ─────────────────────────────────────────

  great_hall: {
    id: 'great_hall',
    name: 'Great Hall',
    description: 'A stone-and-timber hall fit for a lord\'s seat — sixty settlers under one roof, with a dais for council and a hearth that never goes cold.',
    category: 'civic',
    hasStyleVariants: false,
    cost: { lumber: 25, stone: 20 },
    buildSeasons: 3,
    replacesId: 'longhouse',
    requires: 'longhouse',
    shelterCapacity: 60,
    culturePull: { strength: 0.015, direction: 'imanian' },
    skillGrowth: [
      { role: 'council', skill: 'leadership', bonus: 1 },
      { role: 'council', skill: 'custom', bonus: 1 },
    ],
    ownership: 'communal',
    upgradeChainId: 'civic',
    tierInChain: 3,
  },

  clan_lodge: {
    id: 'clan_lodge',
    name: 'Clan Lodge',
    description: 'A great Sauromatian lodge — central fire, sleeping galleries, and the smell of cedar smoke. The heart of any true clan.',
    category: 'civic',
    hasStyleVariants: false,
    cost: { lumber: 30, gold: 5 },
    buildSeasons: 3,
    replacesId: 'roundhouse',
    requires: 'roundhouse',
    shelterCapacity: 60,
    culturePull: { strength: 0.015, direction: 'sauromatian' },
    skillGrowth: [
      { role: 'council', skill: 'leadership', bonus: 1 },
    ],
    ownership: 'communal',
    upgradeChainId: 'civic',
    tierInChain: 3,
  },

  // ── Food & Storage ──────────────────────────────────────────────────────────

  granary: {
    id: 'granary',
    name: 'Granary',
    description: 'An elevated grain store that keeps the harvest safe through winter. A settlement with a full granary does not fear the cold months.',
    category: 'food',
    hasStyleVariants: false,
    cost: { lumber: 10, stone: 5 },
    buildSeasons: 1,
    shelterCapacity: 0,
    flatProductionBonus: { food: 2 },
    winterFoodProtection: true,
    ownership: 'communal',
  },

  fields: {
    id: 'fields',
    name: 'Tilled Fields',
    description: 'Cleared ground, broken soil, and planted rows — the foundation of reliable food production. Farmers here yield far more than any forager scraping the wild.',
    category: 'food',
    hasStyleVariants: false,
    cost: { lumber: 5 },
    buildSeasons: 1,
    shelterCapacity: 0,
    // +2 food per farmer per season (seasonally scaled), making farming
    // clearly superior to foraging once land is prepared.
    roleProductionBonus: { role: 'farmer', bonus: { food: 2 } },
    skillGrowth: [
      { role: 'farmer', skill: 'plants', bonus: 1 },
    ],
    workerSlots: 4,
    workerRole: 'farmer',
    allowMultiple: true,
    ownership: 'household',
    upgradeChainId: 'agriculture',
    tierInChain: 1,
  },

  // ── Industry ────────────────────────────────────────────────────────────────

  workshop: {
    id: 'workshop',
    name: 'Workshop',
    description: 'A forge and carpentry shop — the foundation of the settlement\'s productive capacity. Craftsmen here produce twice the goods.',
    category: 'industry',
    hasStyleVariants: false,
    cost: { lumber: 10, steel: 8 },
    buildSeasons: 2,
    shelterCapacity: 0,
    roleProductionBonus: { role: 'craftsman', bonus: { goods: 1 } },
    skillGrowth: [
      { role: 'craftsman', skill: 'custom', bonus: 1 },
    ],
    workerSlots: 2,
    workerRole: 'craftsman',
    ownership: 'communal',
  },

  trading_post: {
    id: 'trading_post',
    name: 'Trading Post',
    description: 'A dedicated market stall and counting house. Traders based here move more goods, and word spreads that your settlement is open for business.',
    category: 'industry',
    hasStyleVariants: false,
    cost: { lumber: 12, gold: 5 },
    buildSeasons: 2,
    shelterCapacity: 0,
    roleProductionBonus: { role: 'trader', bonus: { goods: 1 } },
    languageDriftMultiplier: 1.0, // Does not grant social drift; Gathering Hall does that
    skillGrowth: [
      { role: 'trader', skill: 'bargaining', bonus: 1 },
    ],
    workerSlots: 3,
    workerRole: 'trader',
    ownership: 'communal',
  },

  // ── Health ──────────────────────────────────────────────────────────────────

  healers_hut: {
    id: 'healers_hut',
    name: "Healer's Hut",
    description: 'A clean, well-stocked treatment room. With proper facilities, healers save lives that would otherwise be lost to childhood illness.',
    category: 'social',
    hasStyleVariants: false,
    cost: { lumber: 8, medicine: 5 },
    buildSeasons: 1,
    shelterCapacity: 0,
    childMortalityModifier: 0.5,
    skillGrowth: [
      { role: 'healer', skill: 'plants', bonus: 1 },
    ],
    workerSlots: 2,
    workerRole: 'healer',
    ownership: 'communal',
  },

  // ── Social ──────────────────────────────────────────────────────────────────

  gathering_hall: {
    id: 'gathering_hall',
    name: 'Gathering Hall',
    description: 'A communal space for festivals, storytelling, and negotiation — wherever people meet and talk, languages spread and bonds form.',
    category: 'social',
    hasStyleVariants: true,
    styleNames: {
      imanian: 'Meeting House',
      sauromatian: 'Longfire',
    },
    styleCultureNote: {
      imanian: 'Imanian customs and speech take root as your people gather formally.',
      sauromatian: 'Sauromatian traditions and tongue are practiced openly among settlers.',
    },
    cost: { lumber: 10 },
    buildSeasons: 1,
    shelterCapacity: 0,
    languageDriftMultiplier: 1.5,
    culturePull: { strength: 0.003, direction: 'from_style' },
    ownership: 'communal',
  },

  // ── Defence ─────────────────────────────────────────────────────────────────

  palisade: {
    id: 'palisade',
    name: 'Palisade',
    description: 'A ring of sharpened stakes and a timber gate. Raiders will think twice before approaching, and guards can hold it against far superior numbers.',
    category: 'defence',
    hasStyleVariants: false,
    cost: { lumber: 20, stone: 5 },
    buildSeasons: 2,
    shelterCapacity: 0,
    defenseBonus: 0.2,
    skillGrowth: [
      { role: 'guard', skill: 'combat', bonus: 1 },
    ],
    ownership: 'communal',
  },

  // ── Livestock ───────────────────────────────────────────────────────────────

  stable: {
    id: 'stable',
    name: 'Stable',
    description: 'A proper stable breeds horses efficiently and keeps the herd healthy. The smell irritates some, but everyone agrees the horses are worth it.',
    category: 'food',
    hasStyleVariants: false,
    cost: { lumber: 10, horses: 3 },
    buildSeasons: 1,
    shelterCapacity: 0,
    flatProductionBonus: { horses: 1 },
    skillGrowth: [
      { role: 'herder', skill: 'animals', bonus: 1 },
    ],
    workerSlots: 2,
    workerRole: 'herder',
    allowMultiple: true,
    ownership: 'household',
    upgradeChainId: 'livestock',
    tierInChain: 1,
  },

  // ── Specialised industry (all require a Workshop) ──────────────────────────

  mill: {
    id: 'mill',
    name: 'Mill',
    description: 'Waterwheel and grinding stones — a miller turns raw grain into substantially more food than any farmer cooking in the field.',
    category: 'food',
    hasStyleVariants: false,
    cost: { lumber: 12, stone: 10 },
    buildSeasons: 2,
    requires: 'fields',
    shelterCapacity: 0,
    roleProductionBonus: { role: 'miller', bonus: { food: 3 } },
    skillGrowth: [{ role: 'miller', skill: 'plants', bonus: 1 }],
    workerSlots: 2,
    workerRole: 'miller',
    allowMultiple: true,
    ownership: 'household',
    upgradeChainId: 'agriculture',
    tierInChain: 2,
  },

  smithy: {
    id: 'smithy',
    name: 'Smithy',
    description: 'A dedicated forge with anvil and bellows. Blacksmiths here produce finished steel goods faster than any general workshop can manage.',
    category: 'industry',
    hasStyleVariants: false,
    cost: { lumber: 15, steel: 10 },
    buildSeasons: 2,
    requires: 'workshop',
    shelterCapacity: 0,
    roleProductionBonus: { role: 'blacksmith', bonus: { steel: 2, goods: 1 } },
    skillGrowth: [{ role: 'blacksmith', skill: 'custom', bonus: 2 }],
    workerSlots: 2,
    workerRole: 'blacksmith',
    allowMultiple: true,
    ownership: 'household',
    upgradeChainId: 'metalwork',
    tierInChain: 1,
  },

  tannery: {
    id: 'tannery',
    name: 'Tannery',
    description: 'Hides cured, cloth cut and stitched — a skilled tailor outproduces any generalist craftsman in trade goods.',
    category: 'industry',
    hasStyleVariants: false,
    cost: { lumber: 10, goods: 5 },
    buildSeasons: 2,
    requires: 'workshop',
    shelterCapacity: 0,
    roleProductionBonus: { role: 'tailor', bonus: { goods: 3 } },
    skillGrowth: [{ role: 'tailor', skill: 'custom', bonus: 2 }],
    workerSlots: 2,
    workerRole: 'tailor',
    allowMultiple: true,
    ownership: 'household',
    upgradeChainId: 'leatherwork',
    tierInChain: 1,
  },

  brewery: {
    id: 'brewery',
    name: 'Brewery',
    description: 'A vat-room and barley store. Good ale and mead boost morale across the whole settlement — and fetch a fine price at the Trading Post.',
    category: 'social',
    hasStyleVariants: false,
    cost: { lumber: 12, stone: 6 },
    buildSeasons: 2,
    requires: 'granary',
    shelterCapacity: 0,
    roleProductionBonus: { role: 'brewer', bonus: { goods: 2 } },
    skillGrowth: [{ role: 'brewer', skill: 'bargaining', bonus: 1 }],
    workerSlots: 2,
    workerRole: 'brewer',
    allowMultiple: true,
    ownership: 'household',
    upgradeChainId: 'brewing',
    tierInChain: 1,
  },

  // ── Private Dwellings (household-owned; multiple instances allowed) ─────────

  wattle_hut: {
    id: 'wattle_hut',
    name: 'Wattle Hut',
    description: 'A wattle-and-daub hut — humble, but it belongs to a household. A private hearthfire means something.',
    category: 'dwelling',
    hasStyleVariants: false,
    cost: { lumber: 3 },
    buildSeasons: 1,
    shelterCapacity: 4,
    allowMultiple: true,
    ownership: 'household',
    upgradeChainId: 'dwelling',
    tierInChain: 1,
  },

  cottage: {
    id: 'cottage',
    name: 'Cottage',
    description: 'A proper timber-framed cottage with a loft and a real door that closes. Room for a family.',
    category: 'dwelling',
    hasStyleVariants: false,
    cost: { lumber: 8, stone: 4 },
    buildSeasons: 2,
    shelterCapacity: 6,
    allowMultiple: true,
    ownership: 'household',
    upgradeChainId: 'dwelling',
    tierInChain: 2,
  },

  homestead: {
    id: 'homestead',
    name: 'Homestead',
    description: 'A sturdy dwelling with outbuildings and a yard. A homestead is built to last and to be passed down.',
    category: 'dwelling',
    hasStyleVariants: false,
    cost: { lumber: 15, stone: 8 },
    buildSeasons: 3,
    shelterCapacity: 8,
    allowMultiple: true,
    ownership: 'household',
    upgradeChainId: 'dwelling',
    tierInChain: 3,
  },

  compound: {
    id: 'compound',
    name: 'Compound',
    description: 'A walled private estate — house, stores, workshop, and garden. A compound signals that a household has truly put down roots.',
    category: 'dwelling',
    hasStyleVariants: false,
    cost: { lumber: 25, stone: 15, gold: 5 },
    buildSeasons: 4,
    shelterCapacity: 12,
    allowMultiple: true,
    ownership: 'household',
    upgradeChainId: 'dwelling',
    tierInChain: 4,
  },

  // ── Social amenities ───────────────────────────────────────────────────────────────

  bathhouse: {
    id: 'bathhouse',
    name: 'Bathhouse',
    description: 'Heated pools and bathing chambers built on Imanian plumbing. Draws Sauromatian women from the surrounding territory — and keeps the ones you have.',
    category: 'social',
    hasStyleVariants: false,
    cost: { lumber: 15, stone: 5, goods: 5 },
    buildSeasons: 2,
    requires: 'gathering_hall',
    shelterCapacity: 0,
    workerSlots: 2,
    workerRole: 'bathhouse_attendant',
    fertilityBonus: 0.05,
    culturePull: { strength: 0.003, direction: 'sauromatian' },
    skillGrowth: [
      { role: 'bathhouse_attendant', skill: 'bargaining', bonus: 1 },
      { role: 'bathhouse_attendant', skill: 'leadership', bonus: 1 },
    ],
    ownership: 'communal',
    upgradeChainId: 'bathhouse',
    tierInChain: 1,
  },

  bathhouse_improved: {
    id: 'bathhouse_improved',
    name: 'Improved Bathhouse',
    description: 'Expanded pools, private treatment rooms, and a small herbal garden. Word of its comforts travels far into tribal territory.',
    category: 'social',
    hasStyleVariants: false,
    cost: { lumber: 20, stone: 10, goods: 8 },
    buildSeasons: 2,
    requires: 'bathhouse',
    replacesId: 'bathhouse',
    shelterCapacity: 0,
    workerSlots: 3,
    workerRole: 'bathhouse_attendant',
    fertilityBonus: 0.10,
    culturePull: { strength: 0.005, direction: 'sauromatian' },
    skillGrowth: [
      { role: 'bathhouse_attendant', skill: 'bargaining', bonus: 1 },
      { role: 'bathhouse_attendant', skill: 'leadership', bonus: 1 },
    ],
    ownership: 'communal',
    upgradeChainId: 'bathhouse',
    tierInChain: 2,
  },

  bathhouse_grand: {
    id: 'bathhouse_grand',
    name: 'Grand Bathhouse',
    description: 'A civic institution — tiled floors, a heated great pool, private suites, and an apothecary alcove. The finest amenity in the Ashmark.',
    category: 'social',
    hasStyleVariants: false,
    cost: { lumber: 30, stone: 15, goods: 10, gold: 5 },
    buildSeasons: 3,
    requires: 'bathhouse_improved',
    replacesId: 'bathhouse_improved',
    shelterCapacity: 0,
    workerSlots: 4,
    workerRole: 'bathhouse_attendant',
    fertilityBonus: 0.15,
    culturePull: { strength: 0.008, direction: 'sauromatian' },
    skillGrowth: [
      { role: 'bathhouse_attendant', skill: 'bargaining', bonus: 1 },
      { role: 'bathhouse_attendant', skill: 'leadership', bonus: 1 },
    ],
    ownership: 'communal',
    upgradeChainId: 'bathhouse',
    tierInChain: 3,
  },
};

/**
 * Returns the display name for a built building, accounting for style variants.
 */
export function getBuildingDisplayName(
  defId: BuildingId,
  style: import('../turn/game-state').BuildingStyle | null,
): string {
  const def = BUILDING_CATALOG[defId];
  if (def.hasStyleVariants && style && def.styleNames) {
    return def.styleNames[style];
  }
  return def.name;
}
