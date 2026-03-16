/**
 * Central game state interface and all supporting types.
 *
 * GameState is the single source of truth for everything that persists across
 * turns. It is serialised to localStorage on save and deserialised on load.
 *
 * Import order (acyclic):
 *   genetics/traits → personality/traits → events/engine
 *   genetics/traits → population/person → turn/game-state  ← you are here
 */

import type { Person, Heritage, EthnicGroup, ReligionId, LanguageId, HouseholdRole, HouseholdTradition } from '../population/person';
import type { GameEvent, SkillCheckResult, DeferredEventEntry, BoundEvent } from '../events/engine';

// Re-export shared identity types so consumers only need one import path.
export type { EthnicGroup, ReligionId, LanguageId, CultureId, HouseholdRole, HouseholdTradition } from '../population/person';
export type { SkillCheckResult, DeferredEventEntry, BoundEvent } from '../events/engine';

// ─── Economy ───────────────────────────────────────────────────────────────────

/**
 * The resource types tracked by the settlement economy.
 * Food, cattle, and goods are the primary early-game resources; the rest unlock
 * as the settlement grows and trade relationships develop.
 *
 * cattle  — herd animals; produce a food bonus each season (1 food per 2 cattle)
 * goods   — an abstraction of manufactured and acquired trade goods
 * horses  — mounts and draft animals; distinct from cattle (acquired, not farmed)
 */
export type ResourceType =
  | 'food'
  | 'cattle'
  | 'goods'
  | 'steel'
  | 'lumber'
  | 'stone'
  | 'medicine'
  | 'gold'
  | 'horses';

/** A complete snapshot of the settlement's current resource stockpile. */
export type ResourceStock = Record<ResourceType, number>;

// ─── Company Relation ────────────────────────────────────────────────────────

/** The Ansberry Company's current level of support for the settlement. */
export type CompanySupportLevel =
  | 'full_support'  // Consistent quota surplus — bonuses and priority supply
  | 'standard'      // Default operating relationship
  | 'reduced'       // One missed quota — reduced supply shipments
  | 'minimal'       // Repeated failures — almost no support
  | 'abandoned';    // Settlement written off — no further Company resources

/**
 * The result of the annual autumn quota check.
 * Drives the Company's support-level escalation mechanics.
 */
export type QuotaStatus = 'exceeded' | 'met' | 'partial' | 'failed';

/**
 * All state related to the settlement's relationship with the Ansberry Company.
 * The Company is the player's primary external patron and demand source.
 */
export interface CompanyRelation {
  /**
   * Overall standing score (0–100). Starts at 60.
   * Above 80: bonuses and preferred supply. Below 40: inspector dispatched.
   * At 0: Company formally abandons the settlement.
   */
  standing: number;
  /** Gold required to meet the current annual quota. Increases over time. */
  annualQuotaGold: number;
  /** Trade goods required to meet the current annual quota. Increases over time. */
  annualQuotaGoods: number;
  /**
   * Number of consecutive annual quotas missed. Resets to 0 on a successful year.
   * Drive the Company's escalating consequences.
   */
  consecutiveFailures: number;
  /** Current support tier, determined by standing and failure history. */
  supportLevel: CompanySupportLevel;
  /** How many in-game years the Company expedition has been active in the region. */
  yearsActive: number;
  /** Gold contributed toward the current year's quota so far. Resets each Winter-end. */
  quotaContributedGold: number;
  /** Trade goods contributed toward the current year's quota so far. Resets each Winter-end. */
  quotaContributedGoods: number;
}

// ─── External Tribes ──────────────────────────────────────────────────────────

/** Behavioural trait of a neighbouring tribe, influencing its AI decision-making. */
export type TribeTrait =
  | 'warlike'
  | 'peaceful'
  | 'isolationist'
  | 'trader'
  | 'expansionist'
  | 'desperate';

/** Resources or concessions a tribe wants from the player settlement. */
export type TribeDesire = 'steel' | 'medicine' | 'alliance' | 'men' | 'territory' | 'trade' | 'food' | 'gold' | 'lumber';

/** Resources or concessions a tribe can offer in trade or alliance. */
export type TribeOffering =
  | 'food'
  | 'horses'
  | 'furs'
  | 'herbs'
  | 'warriors'
  | 'wives'
  | 'knowledge'
  | 'pearls'
  | 'trade_goods'
  | 'stone'
  | 'steel';

/**
 * A neighbouring Sauromatian tribe that exists in the region.
 * Tribes act autonomously — they raid, trade, migrate, and respond to world events.
 */
export interface ExternalTribe {
  /** Unique identifier. */
  id: string;
  /** Display name. */
  name: string;
  /** The ethnic subgroup this tribe belongs to. */
  ethnicGroup: EthnicGroup;
  /** Approximate population size. */
  population: number;
  /**
   * Current disposition toward the player settlement: -100 (hostile) to +100 (allied).
   * Starts near 0 and shifts based on player actions and random world events.
   */
  disposition: number;
  /** Behavioural traits that influence the tribe's AI logic. */
  traits: TribeTrait[];
  /** What this tribe wants from the settlement (drives trade and diplomacy events). */
  desires: TribeDesire[];
  /** What this tribe can offer in exchange. */
  offerings: TribeOffering[];
  /**
   * Internal stability (0.0–1.0). Low stability makes the tribe more prone to
   * raiding, fragmentation, or accepting desperate bargains.
   */
  stability: number;
  /** Whether the player has made first contact with this tribe. Required for direct trade. */
  contactEstablished: boolean;
  /** Turn number of the most recent completed trade. null if no trades yet. */
  lastTradeTurn: number | null;
  /** Cumulative completed trade count. Used for disposition bonuses. */
  tradeHistoryCount: number;
  /** Resources this tribe actively wants to buy (drives premium pricing). */
  tradeDesires: ResourceType[];
  /** Resources this tribe has available to sell. */
  tradeOfferings: ResourceType[];
}

// ─── Households ─────────────────────────────────────────────────────────────

/**
 * A household (_ashkaran_) — the fundamental social and reproductive unit.
 * Households form automatically when marriages are arranged and persist until dissolved.
 * HouseholdRole and HouseholdTradition are defined in population/person.ts.
 */
export interface Household {
  id: string;
  /** Display name, e.g. "House Orsthal" — player-renameable. */
  name: string;
  tradition: HouseholdTradition;
  /** The husband / male head. Null for widow-led households. */
  headId: string | null;
  /** Explicitly designated senior wife. Null = derive from age in household utilities. */
  seniorWifeId: string | null;
  /** All members in declaration order (head first). */
  memberIds: string[];
  /** Pairs of person IDs who share an Ashka-Melathi intimate bond. */
  ashkaMelathiBonds: [string, string][];
  foundedTurn: number;
  /**
   * The BuiltBuilding instanceId of the household's private dwelling.
   * null = household lives in communal settlement housing.
   */
  dwellingBuildingId: string | null;
  /**
   * InstanceIds of production buildings claimed by this household.
   * Household members have designated access to these buildings; they still
   * count against each building's worker slot cap.
   */
  productionBuildingIds: string[];
  /**
   * When true the household name is derived automatically from head/seniorWife
   * and updated whenever leadership changes.  False = player has renamed it.
   */
  isAutoNamed: boolean;
}

// ─── Settlement Culture ────────────────────────────────────────────────────────

/** The governance style currently shaping the settlement's social structure. */
export type GovernanceStyle =
  | 'patriarchal_imanian'
  | 'council_hybrid'
  | 'matriarchal_sauromatian';

/**
 * Active cultural practices in the settlement.
 * Each practice has social and mechanical effects; some are mutually exclusive.
 */
export type CulturalPracticeId =
  | 'imanian_liturgy'
  | 'sauromatian_wheel'
  | 'syncretic_worship'
  | 'essence_sharing'
  | 'bathhouse_culture'
  | 'company_law'
  | 'tribal_justice'
  | 'warrior_training'
  | 'chivalric_code'
  | 'matriarchal_households'
  | 'patriarchal_households';

/**
 * The settlement's overall cultural character.
 * An emergent property recalculated each turn from population composition,
 * language use, religious practice, and governance style.
 */
export interface SettlementCulture {
  /**
   * Fraction of the population that speaks each language.
   * Values sum to approximately 1.0.
   */
  languages: Map<LanguageId, number>;
  /** The language spoken by the largest fraction of the population. */
  primaryLanguage: LanguageId;
  /**
   * Fraction of the population practising each religion.
   * Values sum to approximately 1.0.
   */
  religions: Map<ReligionId, number>;
  /**
   * Religious tension (0.0–1.0).
   * High tension generates conflict events and can trigger crises.
   */
  religiousTension: number;
  /**
   * Cultural blend: 0.0 = fully Imanian Ansberite, 1.0 = fully Sauromatian.
   * Shifts over time as the population's bloodline and practices change.
   */
  culturalBlend: number;
  /** Cultural practices currently active in the settlement. */
  // NOTE: Populated at game start but not yet mechanically consumed. Planned for Phase 4.
  practices: CulturalPracticeId[];
  /** The governance model currently in effect. */
  governance: GovernanceStyle;
  /**
   * Number of consecutive turns where ≥ 2 languages each exceed 10% of the
   * speaking population. Used to trigger creole emergence after ~5 years.
   */
  languageDiversityTurns: number;
  /**
   * Linguistic tension (0.0–1.0).
   * Peaks near 1.0 when two languages split the settlement ~50/50.
   * Contributes to cultural friction and gates language-conflict events.
   */
  languageTension: number;
  /**
   * Consecutive turns where both imanian_orthodox ≥ 15% AND sacred_wheel ≥ 15%.
   * Reaches 20 (5 in-game years) → fires the Hidden Wheel emergence event and resets.
   * Frozen while hiddenWheelSuppressedTurns > 0. Resets to 0 if either faith drops below threshold.
   */
  hiddenWheelDivergenceTurns: number;
  /**
   * Remaining cooldown turns after the player suppresses emergence.
   * While > 0, hiddenWheelDivergenceTurns does not advance.
   */
  hiddenWheelSuppressedTurns: number;
  /**
   * True once the player has acknowledged or recognised the Hidden Wheel.
   * Enables conversion events and (if policy = hidden_wheel_recognized) active spread.
   */
  hiddenWheelEmerged: boolean;
}

// ─── Settlement ───────────────────────────────────────────────────────────────

/**
 * A location identifier for the settlement on the regional map.
 * Will expand to a richer structured type when the map system is built in Phase 3.
 */
export type LocationId = string;

/**
 * All building types that can be constructed in the settlement.
 */
export type BuildingId =
  // ── Communal civic ────────────────────────────────────────────────────────
  | 'camp'
  | 'longhouse'
  | 'roundhouse'
  | 'great_hall'
  | 'clan_lodge'
  // ── Food & storage ────────────────────────────────────────────────────────
  | 'granary'
  | 'fields'
  | 'stable'
  | 'mill'
  // ── Industry ──────────────────────────────────────────────────────────────
  | 'workshop'
  | 'smithy'
  | 'tannery'
  | 'trading_post'
  // ── Social & health ───────────────────────────────────────────────────────
  | 'healers_hut'
  | 'gathering_hall'
  | 'brewery'
  // ── Defence ───────────────────────────────────────────────────────────────
  | 'palisade'
  // ── Private dwellings (allow multiples; claimed by households) ───────────
  | 'wattle_hut'
  | 'cottage'
  | 'homestead'
  | 'compound'
  // ── Social amenities ─────────────────────────────────────────────────────
  | 'bathhouse'
  | 'bathhouse_improved'
  | 'bathhouse_grand';

/** Cultural style applied to buildings that have style variants. */
export type BuildingStyle = 'imanian' | 'sauromatian';

/** A building that has been completed and stands in the settlement. */
export interface BuiltBuilding {
  /** Which building type this is. */
  defId: BuildingId;
  /**
   * Unique instance identifier (e.g. 'granary_0').
   * Multiple instances of the same building type are distinguished by this.
   */
  instanceId: string;
  /** Turn number on which construction completed. 0 for the starting Camp. */
  builtTurn: number;
  /** Cultural style chosen when construction started. null for style-neutral buildings. */
  style: BuildingStyle | null;
  /**
   * IDs of people who live in this building (dwelling buildings only).
   * Empty for production/civic/defence buildings.
   */
  claimedByPersonIds: string[];
  /**
   * The household that owns this building. null = communal.
   * Set automatically when a household-initiated construction project completes.
   * Can also be set by the player for production buildings.
   */
  ownerHouseholdId: string | null;
  /**
   * IDs of people currently assigned as production workers in this building.
   * Replaces the old role-based global lookup — each worker is tied to a
   * specific building instance.
   * Checked against BuildingDef.workerSlots before new assignments are accepted.
   */
  assignedWorkerIds: string[];
}

/** An in-progress construction project. */
export interface ConstructionProject {
  /** Unique project identifier. */
  id: string;
  /** Which building is being constructed. */
  defId: BuildingId;
  /** Cultural style chosen at construction start. */
  style: BuildingStyle | null;
  /**
   * Accumulated progress points. Advances each season by:
   *   assignedWorkers.length × (1 + avgCustomSkill / 100) × 100
   */
  progressPoints: number;
  /** Total points needed to complete. Equals buildSeasons × 100. */
  totalPoints: number;
  /** IDs of people currently assigned as builders on this project. */
  assignedWorkerIds: string[];
  /** Turn on which this project was started. */
  startedTurn: number;
  /** Resources already spent (for 50% refund on cancel). */
  resourcesSpent: Partial<ResourceStock>;
  /**
   * When set, the completed BuiltBuilding will be automatically claimed by
   * this household. Set by the scheme_build_dwelling consequence handler.
   * null for all communal / player-initiated construction.
   */
  ownerHouseholdId: string | null;
}

/**
 * The player's current religious mandate for the settlement.
 * Set through player choices in the Religion panel or specific event outcomes.
 */
export type ReligiousPolicy =
  | 'tolerant'               // Default. No enforcement. All faiths practise freely.
  | 'orthodox_enforced'      // Wheel ceremonies restricted. Company approves.
  | 'wheel_permitted'        // Wheel ceremonies officially recognised.
  | 'hidden_wheel_recognized'; // Syncretic faith given formal standing. Requires hiddenWheelEmerged.

/**
 * The settlement's courtship customs policy.
 * Controls whether Sauromatian women's seek_companion ambitions can form
 * and how aggressively the courtship opinion drifts apply.
 */
export type CourtshipNorms = 'traditional' | 'mixed' | 'open';

/** The physical settlement: its location, constructions, and resource stockpile. */
export interface Settlement {
  /** Player-chosen display name of the settlement. */
  name: string;
  /** Where the settlement is established on the regional map. */
  location: LocationId;
  /** All buildings that have been completed and are standing. */
  buildings: BuiltBuilding[];
  /**
   * In-progress construction projects.
   * Multiple projects can run simultaneously — the constraint is assigned workers,
   * not an arbitrary queue size. A project with zero workers makes no progress.
   */
  constructionQueue: ConstructionProject[];
  /** Current resource stockpile. Updated each turn by the economy system. */
  resources: ResourceStock;
  /**
   * Cached count of living people. Updated each Dawn Phase.
   * Use this for display performance rather than `state.people.size`.
   */
  populationCount: number;
  /** The player's current religious mandate for the settlement. Defaults to 'tolerant'. */
  religiousPolicy: ReligiousPolicy;
  /**
   * The settlement's courtship norms policy. Controls whether Sauromatian women's
   * seek_companion ambitions can form and affects courtship opinion drift rates.
   * Defaults to 'mixed' — the natural state of a blended settlement.
   */
  courtshipNorms: CourtshipNorms;
}

// ─── Turn & Season ────────────────────────────────────────────────────────────

/** The four seasons that make up one in-game year. */
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

/**
 * The current phase within a single turn.
 * Used by the Zustand store to gate which player actions are available.
 */
export type TurnPhase = 'dawn' | 'event' | 'management' | 'dusk' | 'idle';

// ─── Historical Records ────────────────────────────────────────────────────────

/**
 * A lightweight record of a deceased person kept for genealogy queries.
 * Omits runtime state (health, relationships, active pregnancy) but preserves
 * ancestry and family links.
 */
export interface GraveyardEntry {
  id: string;
  firstName: string;
  familyName: string;
  /** Biological sex — preserved for genealogy display. */
  sex: 'male' | 'female';
  birthYear: number;
  deathYear: number;
  /** Human-readable cause of death (e.g., 'old_age', 'raid', 'illness'). */
  deathCause: string;
  /** [motherId, fatherId] — null if unknown. */
  parentIds: [string | null, string | null];
  childrenIds: string[];
  /** Preserved heritage for bloodline and genealogy queries. */
  heritage: Heritage;
  /** Stable portrait index, copied from Person.portraitVariant at time of death. */
  portraitVariant: number;
  /** Age in whole years at time of death — used to resolve the correct portrait stage. */
  ageAtDeath: number;
}

/**
 * A record of an event that has fired, stored for history, analytics, and
 * event-chain logic (e.g., detecting if an event already fired this game).
 */
export interface EventRecord {
  /** The ID of the event that fired. */
  eventId: string;
  /** The turn number on which the event fired. */
  turnNumber: number;
  /** The ID of the choice the player selected. */
  choiceId: string;
  /** IDs of all people involved as actors or affected targets. */
  involvedPersonIds: string[];
  /** Populated when the choice included a skill check. Used by the outcome screen. */
  skillCheckResult?: SkillCheckResult;
}

// ─── Game Configuration ───────────────────────────────────────────────────────

/**
 * Immutable configuration set at game start.
 * Persisted in GameState so saves can be inspected without re-running setup.
 */
export interface GameConfig {
  /** Affects Company quota ramp-up speed and inspector aggressiveness. */
  difficulty: 'easy' | 'normal' | 'hard';
  /**
   * IDs of tribe definitions selected at game start.
   * These tribes are placed in the region and provided with starting state.
   */
  startingTribes: string[];
  /** Which location on the regional map the settlement is founded on. */
  startingLocation: LocationId;
  /**
   * When true, three founding Sauromatian women (ages 18, 22, 26) are added to
   * the initial settlers. This enables mixed-marriage and genetics testing from
   * turn one. The women's ethnic group is derived from the first selected tribe;
   * falls back to kiswani_riverfolk if no tribes are selected.
   */
  includeSauromatianWomen?: boolean;
  /**
   * When true, the scheme_build_dwelling consent event auto-accepts when
   * resources are above communalResourceMinimum. Default false (player is
   * always prompted).
   */
  allowAutonomousBuilding?: boolean;
}

// ─── Cultural Identity Pressure ───────────────────────────────────────────────

/**
 * Pressure counters tracking how many consecutive seasons the settlement has
 * spent outside the cultural identity safe zone (0.25–0.65 blend).
 *
 * companyPressureTurns — seasons in the Soft/Extreme Native zones (blend > 0.65).
 *   The Company grows concerned that the settlement is "going native".
 * tribalPressureTurns — seasons in the Soft/Extreme Imanian zones (blend < 0.25).
 *   Surrounding tribes grow quietly hostile to the foreign enclave.
 *
 * Both counters reset to 0 the moment the blend re-enters the safe zone.
 */
export interface IdentityPressure {
  companyPressureTurns: number;
  tribalPressureTurns: number;
}

// ─── Game Flags ───────────────────────────────────────────────────────────────

/**
 * One-time event flags that ensure certain notifications or transitions only
 * occur once per game, regardless of save/load cycles.
 */
export interface GameFlags {
  /**
   * Set to true the first time `creoleEmerged` fires in a DawnResult.
   * Prevents the creole emergence notification from repeating on subsequent turns.
   */
  creoleEmergedNotified: boolean;
}

// ─── Activity Log ────────────────────────────────────────────────────────────

/** All autonomous-activity categories that can be logged. */
export type ActivityLogType =
  | 'role_self_assigned'
  | 'relationship_formed'
  | 'relationship_dissolved'
  | 'scheme_started'
  | 'scheme_succeeded'
  | 'scheme_failed'
  | 'faction_formed'
  | 'faction_dissolved'
  | 'trait_acquired'
  | 'ambition_formed'
  | 'ambition_cleared'
  | 'dwelling_claimed'    // A household completed and claimed a private dwelling
  | 'household_formed'   // New household created (split-off, birth, or new arrival)
  | 'household_succession' // Household head changed after a death
  | 'household_dissolved' // Empty household removed
  | 'apprenticeship_started'    // A master took on an apprentice
  | 'apprenticeship_completed'  // An apprentice graduated with a trade bonus
  | 'apprenticeship_ended';     // Apprenticeship ended early (master left / role change)

/**
 * A single entry in the rolling Activity Log.
 * Trimmed to the last 30 entries (FIFO) by addActivityEntry().
 */
export interface ActivityLogEntry {
  turn: number;
  type: ActivityLogType;
  /** Primary person involved. */
  personId?: string;
  /** Secondary person involved (if applicable). */
  targetId?: string;
  /** Human-readable description using first names only. */
  description: string;
}

/** Appends an entry and trims the log to the last 30 entries. */
export function addActivityEntry(
  log: ActivityLogEntry[],
  entry: ActivityLogEntry,
): ActivityLogEntry[] {
  const updated = [...log, entry];
  return updated.length > 30 ? updated.slice(updated.length - 30) : updated;
}

// ─── Factions ────────────────────────────────────────────────────────────────

/** The six kinds of factions that can form in the settlement. */
export type FactionType =
  | 'cultural_preservationists' // Sauromatian heritage; resist company cultural drift
  | 'company_loyalists'         // Imanian heritage; defend the Company's authority
  | 'orthodox_faithful'         // Orthodox believers; oppose Wheel presence
  | 'wheel_devotees'            // Wheel/Hidden Wheel believers; seek tolerance
  | 'community_elders'          // Respected elders; collective moral authority
  | 'merchant_bloc';            // Traders and craftsmen; want economic freedom

/** The four kinds of demands a faction can make. */
export type FactionDemandType =
  | 'policy_change'
  | 'resource_grant'
  | 'building_request'
  | 'cultural_accommodation';

/** A demand made by a faction when its strength exceeds the threshold. */
export interface FactionDemand {
  type: FactionDemandType;
  /** Human-readable: e.g. "We demand the Wheel faith be recognised". */
  description: string;
  /** Machine-readable parameters e.g. { policy: 'wheel_permitted' }. */
  params: Record<string, unknown>;
}

/**
 * A political faction — a bloc of settlers acting collectively around a shared
 * cultural, religious, or economic interest.
 */
export interface Faction {
  /** e.g. 'faction_orthodox_1' */
  id: string;
  type: FactionType;
  /** Person IDs of all current members. */
  memberIds: string[];
  /**
   * Strength 0.0–1.0:
   *   clamp(memberCount / totalPop, 0, 1) × (0.5 + coherence × 0.5)
   * where coherence = avg(pairwise effectiveOpinion between members) / 100.
   */
  strength: number;
  formedTurn: number;
  /** Active demand, if any. */
  activeDemand?: FactionDemand;
  /** Turn on which the demand event was queued. Used for 20-turn cooldown. */
  demandFiredTurn?: number;
}

// ─── Debug & Settings ────────────────────────────────────────────────────────

/** Developer/debug toggles. Serialised with GameState. */
export interface DebugSettings {
  /** Master switch: emit autonomy events to browser console. Zero overhead when false. */
  showAutonomyLog: boolean;
  /** Sub-toggle: scheme progress milestones. */
  logSchemes: boolean;
  /** Sub-toggle: every opinion delta above ±5. */
  logOpinionDeltas: boolean;
  /** Sub-toggle: faction strength + demand status each turn. */
  logFactionStrength: boolean;
  /** Sub-toggle: ambition lifecycle events. */
  logAmbitions: boolean;
  /** When true, emits a console warning when a scheme is about to fire an event. */
  pauseOnSchemeEvent: boolean;
  /** When true, all pending events are discarded each turn — jump straight to management phase. */
  skipEvents: boolean;
}

/** Returns a fresh DebugSettings with all toggles off. */
export function defaultDebugSettings(): DebugSettings {
  return {
    showAutonomyLog:    false,
    logSchemes:         false,
    logOpinionDeltas:   false,
    logFactionStrength: false,
    logAmbitions:       false,
    pauseOnSchemeEvent: false,
    skipEvents:         false,
  };
}

// ─── Master Game State ────────────────────────────────────────────────────────

/**
 * The complete, serialisable state of a running game session.
 * Everything needed to reconstruct the game from a save file lives here.
 *
 * Map fields are serialised as `[key, value][]` arrays when saving to JSON
 * (localStorage), then reconstructed from those arrays on load.
 */
export interface GameState {
  /**
   * Schema version string (e.g., '1.0.0').
   * Compared on load to detect save files that need migration.
   */
  version: string;
  /** Master RNG seed. All seeded random decisions derive from this. */
  seed: number;
  /** Current turn number. Increments each time endTurn() completes. */
  turnNumber: number;
  /** The season for the current turn. */
  currentSeason: Season;
  /** The in-game year (starts at 1). */
  currentYear: number;

  /** All living people in the settlement, keyed by their ID. */
  people: Map<string, Person>;
  /** Deceased people, stored lightly for genealogy. */
  graveyard: GraveyardEntry[];

  /** The physical settlement state. */
  settlement: Settlement;
  /** Current cultural character of the settlement. */
  culture: SettlementCulture;

  /** All external tribes in the region, keyed by their ID. */
  tribes: Map<string, ExternalTribe>;
  /** Current Company relationship state. */
  company: CompanyRelation;

  /** Ordered history of all events that have fired. */
  eventHistory: EventRecord[];
  /**
   * Turn number of the last time each event fired, keyed by event ID.
   * Used to enforce event cooldown periods.
   */
  eventCooldowns: Map<string, number>;

  /**
   * Events queued for player resolution in the current Event Phase.
   * Populated by the turn processor; cleared when all choices are resolved.
   * Each entry is a BoundEvent — the static GameEvent plus resolved actor bindings.
   */
  pendingEvents: BoundEvent[];

  /**
   * IDs of people currently seated on the Expedition Council, in seat order.
   * Capped at 7. Players assign and remove members via the Settlers view.
   */
  councilMemberIds: string[];

  /**
   * Events scheduled to fire at a future turn as the resolution of an earlier
   * player choice. Checked every dawn and prepended to pendingEvents when due.
   * Plain array — JSON-safe, no Map serialisation needed.
   */
  deferredEvents: DeferredEventEntry[];

  /** All households in the settlement, keyed by their ID. */
  households: Map<string, Household>;

  /** Immutable configuration from game start. */
  config: GameConfig;

  /** One-time event flags — prevent duplicate notifications across turns. */
  flags: GameFlags;

  /**
   * Consecutive-season counters for cultural identity pressure.
   * Drive passive standing/disposition deltas and gate identity events.
   */
  identityPressure: IdentityPressure;

  /**
   * All active political factions in the settlement.
   * Plain array — no Map serialisation needed.
   */
  factions: Faction[];

  /**
   * Rolling log of autonomous character actions (last 30 entries).
   * Trimmed by addActivityEntry(). Plain array — JSON-safe.
   */
  activityLog: ActivityLogEntry[];

  /**
   * Developer/debug toggles.
   * Serialised with GameState so settings survive save/load cycles.
   */
  debugSettings: DebugSettings;

  // ─── Happiness & Morale (Phase 5) ─────────────────────────────────────────

  /**
   * Consecutive turns settlement morale has been below −20.
   * Resets to 0 when morale rises to −20 or above.
   * Gates the escalating crisis event chain.
   */
  lowMoraleTurns: number;

  /**
   * Prevents hap_desertion_imminent firing twice in the same crisis episode.
   * Reset to false when lowMoraleTurns resets.
   */
  massDesertionWarningFired: boolean;

  /**
   * Cached settlement morale from the last processed dawn.
   * Used by UI rendering between turns; recomputed in processDawn each season.
   * Defaults to 0 (neutral) for new games and old saves.
   */
  lastSettlementMorale: number;

  // ─── Housing & Specialisation (Phase 5.1) ─────────────────────────────────

  /**
   * Minimum resource stockpile the scheme system must see ABOVE the building
   * cost before allowing autonomous household construction to proceed.
   * Player-configurable in the Settlement panel. Defaults to modest floors.
   */
  communalResourceMinimum: Partial<ResourceStock>;

  /**
   * One-time migration flag. Set to true after the first load applies the
   * `buildingWorkersInitialized` migration (moves existing role assignments
   * into building.assignedWorkerIds).
   */
  buildingWorkersInitialized: boolean;
}
