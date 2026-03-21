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

  /**
   * Resource cost paid from settlement.resources each season to keep this
   * building operational. Unpaid maintenance causes the building to become
   * 'neglected'. Omitted = no maintenance cost.
   */
  maintenanceCost?: Partial<ResourceStock>;

  /**
   * Wealth a household pays to privately commission this building.
   * Materials (def.cost) are drawn from communal surplus above the reserve floors.
   * Undefined = not privately buildable (communal-only buildings).
   */
  privateWealthCost?: number;
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
    shelterCapacity: 20,
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
    maintenanceCost: { wealth: 1 },
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
    maintenanceCost: { wealth: 1 },
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
    maintenanceCost: { wealth: 2 },
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
    cost: { lumber: 30, wealth: 5 },
    buildSeasons: 3,
    replacesId: 'roundhouse',
    requires: 'roundhouse',
    shelterCapacity: 60,
    culturePull: { strength: 0.015, direction: 'sauromatian' },
    skillGrowth: [
      { role: 'council', skill: 'leadership', bonus: 1 },
    ],
    maintenanceCost: { wealth: 1 },
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
    maintenanceCost: { wealth: 1 },
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
    privateWealthCost: 2,
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
    roleProductionBonus: { role: 'craftsman', bonus: { wealth: 1 } },
    skillGrowth: [
      { role: 'craftsman', skill: 'custom', bonus: 1 },
    ],
    workerSlots: 2,
    workerRole: 'craftsman',
    maintenanceCost: { wealth: 1 },
    ownership: 'communal',
  },

  pottery: {
    id: 'pottery',
    name: 'Pottery Kiln',
    description: 'Fires clay into tiles, pipes, and vessels — enabling advanced plumbing and fine construction. Required before a compound or bathhouse can be built.',
    category: 'industry',
    hasStyleVariants: false,
    cost: { lumber: 3 },
    buildSeasons: 1,
    shelterCapacity: 0,
    workerSlots: 1,
    workerRole: 'craftsman',
    maintenanceCost: { wealth: 1 },
    ownership: 'communal',
  },

  trading_post: {
    id: 'trading_post',
    name: 'Trading Post',
    description: 'A dedicated market stall and counting house. Traders based here move more goods, and word spreads that your settlement is open for business.',
    category: 'industry',
    hasStyleVariants: false,
    cost: { lumber: 12, wealth: 5 },
    buildSeasons: 2,
    shelterCapacity: 0,
    roleProductionBonus: { role: 'trader', bonus: { wealth: 1 } },
    languageDriftMultiplier: 1.0, // Does not grant social drift; Gathering Hall does that
    skillGrowth: [
      { role: 'trader', skill: 'bargaining', bonus: 1 },
    ],
    workerSlots: 3,
    workerRole: 'trader',
    maintenanceCost: { wealth: 2 },
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
    maintenanceCost: { wealth: 1 },
    ownership: 'communal',
    upgradeChainId: 'hospice',
    tierInChain: 1,
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
    maintenanceCost: { wealth: 1 },
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
    maintenanceCost: { lumber: 1 },
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
    maintenanceCost: { lumber: 1 },
    ownership: 'household',
    upgradeChainId: 'livestock',
    tierInChain: 1,
    privateWealthCost: 4,
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
    maintenanceCost: { wealth: 1 },
    ownership: 'household',
    upgradeChainId: 'milling',
    tierInChain: 1,
    privateWealthCost: 5,
  },

  smithy: {
    id: 'smithy',
    name: 'Smithy',
    description: 'A dedicated forge with anvil and bellows. Blacksmiths here produce finished steel goods faster than any general workshop can manage.',
    category: 'industry',
    hasStyleVariants: false,
    cost: { lumber: 10, steel: 10 },
    buildSeasons: 2,
    requires: 'workshop',
    shelterCapacity: 0,
    roleProductionBonus: { role: 'blacksmith', bonus: { steel: 2, wealth: 1 } },
    skillGrowth: [{ role: 'blacksmith', skill: 'custom', bonus: 2 }],
    workerSlots: 2,
    workerRole: 'blacksmith',
    allowMultiple: true,
    maintenanceCost: { wealth: 1 },
    ownership: 'household',
    upgradeChainId: 'metalwork',
    tierInChain: 1,
    privateWealthCost: 5,
  },

  tannery: {
    id: 'tannery',
    name: 'Tannery',
    description: 'Hides cured, cloth cut and stitched — a skilled tailor outproduces any generalist craftsman in trade goods.',
    category: 'industry',
    hasStyleVariants: false,
    cost: { lumber: 10, wealth: 5 },
    buildSeasons: 2,
    requires: 'workshop',
    shelterCapacity: 0,
    roleProductionBonus: { role: 'tailor', bonus: { wealth: 3 } },
    skillGrowth: [{ role: 'tailor', skill: 'custom', bonus: 2 }],
    workerSlots: 2,
    workerRole: 'tailor',
    allowMultiple: true,
    maintenanceCost: { wealth: 1 },
    ownership: 'household',
    upgradeChainId: 'leatherwork',
    tierInChain: 1,
    privateWealthCost: 4,
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
    roleProductionBonus: { role: 'brewer', bonus: { wealth: 2 } },
    skillGrowth: [{ role: 'brewer', skill: 'bargaining', bonus: 1 }],
    workerSlots: 2,
    workerRole: 'brewer',
    allowMultiple: true,
    maintenanceCost: { wealth: 1 },
    ownership: 'household',
    upgradeChainId: 'brewing',
    tierInChain: 1,
    privateWealthCost: 4,
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
    privateWealthCost: 1,
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
    privateWealthCost: 3,
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
    privateWealthCost: 6,
  },

  compound: {
    id: 'compound',
    name: 'Compound',
    description: 'A walled private estate — house, stores, workshop, and garden. A compound signals that a household has truly put down roots.',
    category: 'dwelling',
    hasStyleVariants: false,
    cost: { lumber: 25, stone: 15, wealth: 5 },
    buildSeasons: 4,
    requires: 'pottery',
    shelterCapacity: 12,
    allowMultiple: true,
    ownership: 'household',
    upgradeChainId: 'dwelling',
    tierInChain: 4,
    privateWealthCost: 12,
  },

  // ── Social amenities ───────────────────────────────────────────────────────────────

  bathhouse: {
    id: 'bathhouse',
    name: 'Bathhouse',
    description: 'Heated pools and bathing chambers built on Imanian plumbing. Draws Sauromatian women from the surrounding territory — and keeps the ones you have.',
    category: 'social',
    hasStyleVariants: false,
    cost: { lumber: 15, wealth: 5 },
    buildSeasons: 2,
    requires: 'pottery',
    shelterCapacity: 0,
    workerSlots: 2,
    workerRole: 'bathhouse_attendant',
    fertilityBonus: 0.05,
    culturePull: { strength: 0.003, direction: 'sauromatian' },
    skillGrowth: [
      { role: 'bathhouse_attendant', skill: 'bargaining', bonus: 1 },
      { role: 'bathhouse_attendant', skill: 'leadership', bonus: 1 },
    ],
    maintenanceCost: { wealth: 2, stone: 1 },
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
    cost: { lumber: 20, stone: 10, wealth: 8 },
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

  dock: {
    id: 'dock',
    name: 'Riverside Dock',
    description: 'A sturdy timber jetty with boat-launching slipways and storage for expedition supplies. Required to build additional boats and to launch river expeditions without consuming a boat slot.',
    category: 'industry',
    hasStyleVariants: false,
    cost: { lumber: 20, stone: 10 },
    buildSeasons: 2,
    shelterCapacity: 0,
    workerSlots: 2,
    workerRole: 'boatbuilder',
    ownership: 'communal',
    upgradeChainId: null,
    tierInChain: null,
  },

  // ── Farms & Fields expansion (household, additive) ────────────────────────

  barns_storehouses: {
    id: 'barns_storehouses',
    name: 'Barns & Storehouses',
    description: 'Covered storage and drying racks extend the harvest season. More hands in better conditions means more food on the table.',
    category: 'food',
    hasStyleVariants: false,
    cost: { lumber: 8, stone: 4 },
    buildSeasons: 2,
    requires: 'fields',
    shelterCapacity: 0,
    roleProductionBonus: { role: 'farmer', bonus: { food: 1 } },
    flatProductionBonus: { food: 1 },
    skillGrowth: [{ role: 'farmer', skill: 'plants', bonus: 1 }],
    workerSlots: 2,
    workerRole: 'farmer',
    ownership: 'household',
    upgradeChainId: 'agriculture',
    tierInChain: 2,
    privateWealthCost: 4,
  },

  farmstead: {
    id: 'farmstead',
    name: 'Farmstead',
    description: 'A proper working farm — tool sheds, a root cellar, and permanent beds. Farming households anchored here can feed the entire settlement.',
    category: 'food',
    hasStyleVariants: false,
    cost: { lumber: 12, stone: 8 },
    buildSeasons: 3,
    requires: 'barns_storehouses',
    shelterCapacity: 0,
    roleProductionBonus: { role: 'farmer', bonus: { food: 1 } },
    flatProductionBonus: { food: 2 },
    skillGrowth: [{ role: 'farmer', skill: 'plants', bonus: 1 }],
    workerSlots: 2,
    workerRole: 'farmer',
    ownership: 'household',
    upgradeChainId: 'agriculture',
    tierInChain: 3,
    privateWealthCost: 6,
  },

  grain_silo: {
    id: 'grain_silo',
    name: 'Grain Silo',
    description: 'A sealed stone tower holds months of harvest without spoilage. With surplus guaranteed, families grow larger and the settlement faces winter without fear.',
    category: 'food',
    hasStyleVariants: false,
    cost: { lumber: 20, stone: 12 },
    buildSeasons: 4,
    requires: 'farmstead',
    shelterCapacity: 0,
    roleProductionBonus: { role: 'farmer', bonus: { food: 2 } },
    flatProductionBonus: { food: 3 },
    skillGrowth: [{ role: 'farmer', skill: 'plants', bonus: 2 }],
    workerSlots: 3,
    workerRole: 'farmer',
    fertilityBonus: 0.05,
    ownership: 'household',
    upgradeChainId: 'agriculture',
    tierInChain: 4,
    privateWealthCost: 10,
  },

  // ── Cattle Pastures chain (household, additive) ───────────────────────────

  cattle_pen: {
    id: 'cattle_pen',
    name: 'Cattle Pen',
    description: 'A fenced enclosure and feeding troughs keep the herd in good condition. Herders working here produce reliable meat and dairy throughout the year.',
    category: 'food',
    hasStyleVariants: false,
    cost: { lumber: 8, stone: 3 },
    buildSeasons: 1,
    shelterCapacity: 0,
    roleProductionBonus: { role: 'herder', bonus: { cattle: 1, food: 1 } },
    skillGrowth: [{ role: 'herder', skill: 'animals', bonus: 1 }],
    workerSlots: 2,
    workerRole: 'herder',
    ownership: 'household',
    upgradeChainId: 'pastoralism',
    tierInChain: 1,
    privateWealthCost: 3,
  },

  meadow: {
    id: 'meadow',
    name: 'Meadow',
    description: 'Cleared and seeded grazing land. The herd grows faster than a pen alone allows, and a surplus of cattle means the settlement is never truly hungry.',
    category: 'food',
    hasStyleVariants: false,
    cost: { lumber: 8 },
    buildSeasons: 2,
    requires: 'cattle_pen',
    shelterCapacity: 0,
    roleProductionBonus: { role: 'herder', bonus: { cattle: 1, food: 1 } },
    flatProductionBonus: { cattle: 1 },
    skillGrowth: [{ role: 'herder', skill: 'animals', bonus: 1 }],
    workerSlots: 3,
    workerRole: 'herder',
    ownership: 'household',
    upgradeChainId: 'pastoralism',
    tierInChain: 2,
    privateWealthCost: 4,
  },

  cattle_ranch: {
    id: 'cattle_ranch',
    name: 'Cattle Ranch',
    description: 'Broad pastures, a breeding barn, and a small slaughterhouse. This household has built its identity around the herd — and profits from it.',
    category: 'food',
    hasStyleVariants: false,
    cost: { lumber: 15, stone: 6, wealth: 3 },
    buildSeasons: 3,
    requires: 'meadow',
    shelterCapacity: 0,
    roleProductionBonus: { role: 'herder', bonus: { cattle: 2, food: 2 } },
    flatProductionBonus: { cattle: 2, food: 2 },
    skillGrowth: [{ role: 'herder', skill: 'animals', bonus: 2 }],
    workerSlots: 3,
    workerRole: 'herder',
    ownership: 'household',
    upgradeChainId: 'pastoralism',
    tierInChain: 3,
    privateWealthCost: 7,
  },

  stock_farm: {
    id: 'stock_farm',
    name: 'Stock Farm',
    description: 'A full agricultural estate devoted to livestock — breeding, tallow rendering, and leatherwork by-products. The family that runs this feeds half the settlement.',
    category: 'food',
    hasStyleVariants: false,
    cost: { lumber: 22, stone: 10, wealth: 8 },
    buildSeasons: 4,
    requires: 'cattle_ranch',
    shelterCapacity: 0,
    roleProductionBonus: { role: 'herder', bonus: { cattle: 2, food: 2 } },
    flatProductionBonus: { cattle: 3, food: 3 },
    skillGrowth: [{ role: 'herder', skill: 'animals', bonus: 2 }],
    workerSlots: 4,
    workerRole: 'herder',
    fertilityBonus: 0.03,
    ownership: 'household',
    upgradeChainId: 'pastoralism',
    tierInChain: 4,
    privateWealthCost: 12,
  },

  // ── Orchard chain (household, additive) ────────────────────────────────────

  orchard: {
    id: 'orchard',
    name: 'Orchard',
    description: 'A row of fruit trees planted and tended by skilled hands. The harvest comes once a year but lasts through winter, and dried fruit trades well at market.',
    category: 'food',
    hasStyleVariants: false,
    cost: { lumber: 8 },
    buildSeasons: 2,
    shelterCapacity: 0,
    roleProductionBonus: { role: 'farmer', bonus: { food: 1, wealth: 1 } },
    skillGrowth: [{ role: 'farmer', skill: 'plants', bonus: 1 }],
    workerSlots: 3,
    workerRole: 'farmer',
    ownership: 'household',
    upgradeChainId: 'orchard',
    tierInChain: 1,
    privateWealthCost: 3,
  },

  berry_grove: {
    id: 'berry_grove',
    name: 'Berry Grove',
    description: 'Low shrubs and brambles cultivated along the orchard edges. The yield is modest but relentless — berries through summer, dried stock through winter.',
    category: 'food',
    hasStyleVariants: false,
    cost: { lumber: 6 },
    buildSeasons: 2,
    requires: 'orchard',
    shelterCapacity: 0,
    roleProductionBonus: { role: 'farmer', bonus: { food: 1, wealth: 1 } },
    skillGrowth: [{ role: 'farmer', skill: 'plants', bonus: 1 }],
    workerSlots: 2,
    workerRole: 'farmer',
    ownership: 'household',
    upgradeChainId: 'orchard',
    tierInChain: 2,
    privateWealthCost: 2,
  },

  beekeeper: {
    id: 'beekeeper',
    name: 'Beekeeper',
    description: 'Woven hive boxes stacked beside the grove. Honey sweetens food stores, wax makes excellent trade goods, and the bees improve every fruit crop in the valley.',
    category: 'food',
    hasStyleVariants: false,
    cost: { lumber: 6, wealth: 4 },
    buildSeasons: 2,
    requires: 'berry_grove',
    shelterCapacity: 0,
    roleProductionBonus: { role: 'farmer', bonus: { wealth: 2 } },
    flatProductionBonus: { medicine: 1 },
    skillGrowth: [{ role: 'farmer', skill: 'plants', bonus: 1 }],
    workerSlots: 1,
    workerRole: 'farmer',
    ownership: 'household',
    upgradeChainId: 'orchard',
    tierInChain: 3,
    privateWealthCost: 3,
  },

  grand_orchard: {
    id: 'grand_orchard',
    name: 'Grand Orchard',
    description: 'The finest private holding in the settlement — a formal garden of mature trees, a pressing house, and a counting room. Its abundance feeds children and enriches the household.',
    category: 'food',
    hasStyleVariants: false,
    cost: { lumber: 15, stone: 8, wealth: 10 },
    buildSeasons: 3,
    requires: 'beekeeper',
    shelterCapacity: 0,
    roleProductionBonus: { role: 'farmer', bonus: { food: 2, wealth: 2 } },
    flatProductionBonus: { food: 2, wealth: 2 },
    skillGrowth: [{ role: 'farmer', skill: 'plants', bonus: 2 }],
    workerSlots: 2,
    workerRole: 'farmer',
    fertilityBonus: 0.03,
    ownership: 'household',
    upgradeChainId: 'orchard',
    tierInChain: 4,
    privateWealthCost: 14,
  },

  // ── Forestry chain (communal, upgrade) ────────────────────────────────────

  logging_camp: {
    id: 'logging_camp',
    name: 'Logging Camp',
    description: 'Felling zones marked, draft-routes cleared, and a tool shed stocked. Lumberjacks working from a proper camp bring in significantly more timber per day.',
    category: 'industry',
    hasStyleVariants: false,
    cost: { lumber: 10, stone: 2 },
    buildSeasons: 2,
    shelterCapacity: 0,
    roleProductionBonus: { role: 'gather_lumber', bonus: { lumber: 1 } },
    skillGrowth: [{ role: 'gather_lumber', skill: 'custom', bonus: 1 }],
    workerSlots: 3,
    workerRole: 'gather_lumber',
    ownership: 'communal',
    upgradeChainId: 'forestry',
    tierInChain: 1,
  },

  charcoal_burners: {
    id: 'charcoal_burners',
    name: 'Charcoal Burners',
    description: 'Covered kilns that slow-burn waste timber into charcoal — a dense fuel worth real money to smiths and traders.',
    category: 'industry',
    hasStyleVariants: false,
    cost: { lumber: 12, stone: 4 },
    buildSeasons: 2,
    requires: 'logging_camp',
    replacesId: 'logging_camp',
    shelterCapacity: 0,
    roleProductionBonus: { role: 'gather_lumber', bonus: { lumber: 1, wealth: 1 } },
    skillGrowth: [{ role: 'gather_lumber', skill: 'custom', bonus: 1 }],
    workerSlots: 4,
    workerRole: 'gather_lumber',
    ownership: 'communal',
    upgradeChainId: 'forestry',
    tierInChain: 2,
  },

  wood_pasture: {
    id: 'wood_pasture',
    name: 'Wood Pasture',
    description: 'Managed coppicing and selective replanting. The woodland is harvested sustainably in rotation, producing a steady surplus beyond what any camp can extract.',
    category: 'industry',
    hasStyleVariants: false,
    cost: { lumber: 15, stone: 6 },
    buildSeasons: 3,
    requires: 'charcoal_burners',
    replacesId: 'charcoal_burners',
    shelterCapacity: 0,
    roleProductionBonus: { role: 'gather_lumber', bonus: { lumber: 2, wealth: 1 } },
    flatProductionBonus: { lumber: 2 },
    skillGrowth: [{ role: 'gather_lumber', skill: 'custom', bonus: 2 }],
    workerSlots: 5,
    workerRole: 'gather_lumber',
    ownership: 'communal',
    upgradeChainId: 'forestry',
    tierInChain: 3,
  },

  sawmill: {
    id: 'sawmill',
    name: 'Sawmill',
    description: 'A waterwheel drives the great saw — planks cut true, beams milled to length. Every builder in the settlement benefits, and the surplus goes to market.',
    category: 'industry',
    hasStyleVariants: false,
    cost: { lumber: 20, stone: 15, wealth: 5 },
    buildSeasons: 4,
    requires: 'wood_pasture',
    replacesId: 'wood_pasture',
    shelterCapacity: 0,
    roleProductionBonus: { role: 'gather_lumber', bonus: { lumber: 3, wealth: 2 } },
    flatProductionBonus: { lumber: 3 },
    skillGrowth: [{ role: 'gather_lumber', skill: 'custom', bonus: 2 }],
    workerSlots: 6,
    workerRole: 'gather_lumber',
    ownership: 'communal',
    upgradeChainId: 'forestry',
    tierInChain: 4,
  },

  // ── Hunting Grounds chain (communal, upgrade) ─────────────────────────────

  hunters_lodge: {
    id: 'hunters_lodge',
    name: "Hunter's Lodge",
    description: 'A base camp with drying racks, skinning tables, and racks for bows and spears. Hunters operating from here bring back more game and arrive home before dark.',
    category: 'food',
    hasStyleVariants: false,
    cost: { lumber: 8 },
    buildSeasons: 2,
    shelterCapacity: 0,
    roleProductionBonus: { role: 'hunter', bonus: { food: 1 } },
    skillGrowth: [{ role: 'hunter', skill: 'combat', bonus: 1 }],
    workerSlots: 3,
    workerRole: 'hunter',
    defenseBonus: 0.05,
    ownership: 'communal',
    upgradeChainId: 'hunting',
    tierInChain: 1,
  },

  hound_pens: {
    id: 'hound_pens',
    name: 'Hound Pens',
    description: 'Well-trained hounds make every hunter twice as effective. Pelts and hides brought back add directly to the settlement\'s trade goods.',
    category: 'food',
    hasStyleVariants: false,
    cost: { lumber: 12, stone: 4 },
    buildSeasons: 2,
    requires: 'hunters_lodge',
    replacesId: 'hunters_lodge',
    shelterCapacity: 0,
    roleProductionBonus: { role: 'hunter', bonus: { food: 2, wealth: 1 } },
    skillGrowth: [
      { role: 'hunter', skill: 'combat', bonus: 1 },
      { role: 'hunter', skill: 'animals', bonus: 1 },
    ],
    workerSlots: 4,
    workerRole: 'hunter',
    defenseBonus: 0.05,
    ownership: 'communal',
    upgradeChainId: 'hunting',
    tierInChain: 2,
  },

  hunting_towers: {
    id: 'hunting_towers',
    name: 'Hunting Towers',
    description: 'Elevated platforms and blind-hides at the forest edge. Hunters pick targets from height, and the towers double as watchtowers against raiders.',
    category: 'food',
    hasStyleVariants: false,
    cost: { lumber: 15, stone: 8 },
    buildSeasons: 3,
    requires: 'hound_pens',
    replacesId: 'hound_pens',
    shelterCapacity: 0,
    roleProductionBonus: { role: 'hunter', bonus: { food: 2, wealth: 1 } },
    flatProductionBonus: { food: 1 },
    skillGrowth: [{ role: 'hunter', skill: 'combat', bonus: 2 }],
    workerSlots: 5,
    workerRole: 'hunter',
    defenseBonus: 0.10,
    ownership: 'communal',
    upgradeChainId: 'hunting',
    tierInChain: 3,
  },

  hunting_reserve: {
    id: 'hunting_reserve',
    name: 'Hunting Reserve',
    description: 'A managed wilderness preserve — game is bred, territories are patrolled, and only licensed hunters enter. The reserve feeds the settlement and intimidates its enemies.',
    category: 'food',
    hasStyleVariants: false,
    cost: { lumber: 20, stone: 12, wealth: 8 },
    buildSeasons: 4,
    requires: 'hunting_towers',
    replacesId: 'hunting_towers',
    shelterCapacity: 0,
    roleProductionBonus: { role: 'hunter', bonus: { food: 3, wealth: 2 } },
    flatProductionBonus: { food: 2 },
    skillGrowth: [
      { role: 'hunter', skill: 'combat', bonus: 2 },
      { role: 'hunter', skill: 'animals', bonus: 1 },
    ],
    workerSlots: 6,
    workerRole: 'hunter',
    defenseBonus: 0.15,
    ownership: 'communal',
    upgradeChainId: 'hunting',
    tierInChain: 4,
  },

  // ── Quarry chain (communal, upgrade) ──────────────────────────────────────

  stone_quarry: {
    id: 'stone_quarry',
    name: 'Stone Quarry',
    description: 'Marked faces, iron wedges, and proper scaffolding. Quarriers working from an organised site extract stone far faster than any rough-field crew.',
    category: 'industry',
    hasStyleVariants: false,
    cost: { lumber: 10, stone: 5 },
    buildSeasons: 2,
    shelterCapacity: 0,
    roleProductionBonus: { role: 'gather_stone', bonus: { stone: 1 } },
    skillGrowth: [{ role: 'gather_stone', skill: 'custom', bonus: 1 }],
    workerSlots: 3,
    workerRole: 'gather_stone',
    ownership: 'communal',
    upgradeChainId: 'quarry',
    tierInChain: 1,
  },

  ore_mine: {
    id: 'ore_mine',
    name: 'Ore Mine',
    description: 'Shafts driven into the hillside expose veins of iron ore alongside the limestone. Quarriers now bring home both stone and raw metal.',
    category: 'industry',
    hasStyleVariants: false,
    cost: { lumber: 15, stone: 8 },
    buildSeasons: 2,
    requires: 'stone_quarry',
    replacesId: 'stone_quarry',
    shelterCapacity: 0,
    roleProductionBonus: { role: 'gather_stone', bonus: { stone: 2, steel: 1 } },
    skillGrowth: [{ role: 'gather_stone', skill: 'custom', bonus: 1 }],
    workerSlots: 4,
    workerRole: 'gather_stone',
    ownership: 'communal',
    upgradeChainId: 'quarry',
    tierInChain: 2,
  },

  large_quarry: {
    id: 'large_quarry',
    name: 'Large Quarry',
    description: 'A stepped open quarry with cranes and winch-teams. The scale lets workers cover more faces per day; block production alone makes it the settlement\'s richest site.',
    category: 'industry',
    hasStyleVariants: false,
    cost: { lumber: 18, stone: 10 },
    buildSeasons: 3,
    requires: 'ore_mine',
    replacesId: 'ore_mine',
    shelterCapacity: 0,
    roleProductionBonus: { role: 'gather_stone', bonus: { stone: 3, steel: 1 } },
    flatProductionBonus: { stone: 2 },
    skillGrowth: [{ role: 'gather_stone', skill: 'custom', bonus: 2 }],
    workerSlots: 5,
    workerRole: 'gather_stone',
    ownership: 'communal',
    upgradeChainId: 'quarry',
    tierInChain: 3,
  },

  shaft_mine: {
    id: 'shaft_mine',
    name: 'Shaft Mine',
    description: 'A deep vertical shaft with galleries, pumps, and proper timber shoring. The deepest veins give pure iron — and a fortified entrance deters any raider who thinks to plunder it.',
    category: 'industry',
    hasStyleVariants: false,
    cost: { lumber: 25, stone: 15, wealth: 10 },
    buildSeasons: 4,
    requires: 'large_quarry',
    replacesId: 'large_quarry',
    shelterCapacity: 0,
    roleProductionBonus: { role: 'gather_stone', bonus: { stone: 4, steel: 2 } },
    flatProductionBonus: { stone: 3, steel: 1 },
    skillGrowth: [{ role: 'gather_stone', skill: 'custom', bonus: 2 }],
    workerSlots: 6,
    workerRole: 'gather_stone',
    defenseBonus: 0.05,
    ownership: 'communal',
    upgradeChainId: 'quarry',
    tierInChain: 4,
  },

  // ── Hospice chain (communal, upgrade — extends healers_hut) ───────────────

  infirmary: {
    id: 'infirmary',
    name: 'Infirmary',
    description: 'Real cots, clean dressings, and a stocked medicine room. More healers, better supplies — children born here have a fighting chance.',
    category: 'social',
    hasStyleVariants: false,
    cost: { lumber: 12, stone: 6, medicine: 4 },
    buildSeasons: 2,
    requires: 'healers_hut',
    replacesId: 'healers_hut',
    shelterCapacity: 0,
    childMortalityModifier: 0.35,
    fertilityBonus: 0.05,
    skillGrowth: [{ role: 'healer', skill: 'plants', bonus: 1 }],
    workerSlots: 3,
    workerRole: 'healer',
    ownership: 'communal',
    upgradeChainId: 'hospice',
    tierInChain: 2,
  },

  hospital: {
    id: 'hospital',
    name: 'Hospital',
    description: 'A proper medical institution with treatment wings, recovery wards, and a dispensary. The healers here produce their own medicines as well as saving lives.',
    category: 'social',
    hasStyleVariants: false,
    cost: { lumber: 18, stone: 12, medicine: 8 },
    buildSeasons: 3,
    requires: 'infirmary',
    replacesId: 'infirmary',
    shelterCapacity: 0,
    childMortalityModifier: 0.25,
    fertilityBonus: 0.08,
    flatProductionBonus: { medicine: 2 },
    skillGrowth: [{ role: 'healer', skill: 'plants', bonus: 2 }],
    workerSlots: 4,
    workerRole: 'healer',
    ownership: 'communal',
    upgradeChainId: 'hospice',
    tierInChain: 3,
  },

  grand_hospital: {
    id: 'grand_hospital',
    name: 'Grand Hospital',
    description: 'The finest medical complex in the Ashmark — an apothecary, a surgery, convalescent gardens, and a full staff of learned healers. The settlement that builds this does not fear plague.',
    category: 'social',
    hasStyleVariants: false,
    cost: { lumber: 25, stone: 20, medicine: 15, wealth: 5 },
    buildSeasons: 4,
    requires: 'hospital',
    replacesId: 'hospital',
    shelterCapacity: 0,
    childMortalityModifier: 0.15,
    fertilityBonus: 0.12,
    flatProductionBonus: { medicine: 4 },
    skillGrowth: [
      { role: 'healer', skill: 'plants', bonus: 2 },
      { role: 'healer', skill: 'leadership', bonus: 1 },
    ],
    workerSlots: 5,
    workerRole: 'healer',
    ownership: 'communal',
    upgradeChainId: 'hospice',
    tierInChain: 4,
  },

  bathhouse_grand: {
    id: 'bathhouse_grand',
    name: 'Grand Bathhouse',
    description: 'A civic institution — tiled floors, a heated great pool, private suites, and an apothecary alcove. The finest amenity in the Ashmark.',
    category: 'social',
    hasStyleVariants: false,
    cost: { lumber: 30, stone: 15, wealth: 15 },
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
