/**
 * Event system type definitions for the Palusteria simulation.
 *
 * Events are the primary player interface — each turn draws 1–3 events from
 * the deck and presents them as narrative choices. This module defines only
 * the data shapes; actual event data lives in
 * `src/simulation/events/definitions/`.
 */

// ─── Consequence Types ───────────────────────────────────────────────────────

/** All possible state changes an event choice can produce. */
export type ConsequenceType =
  | 'add_person'
  | 'remove_person'
  | 'modify_resource'
  | 'modify_opinion'
  /** Changes a neighbouring tribe's disposition toward the player settlement. */
  | 'modify_disposition'
  /** Changes the Ansberry Company's standing score. */
  | 'modify_standing'
  | 'add_trait'
  | 'remove_trait'
  | 'wound_person'
  | 'kill_person'
  | 'start_pregnancy'
  /** Immediately queues another named event to fire next. */
  | 'trigger_event';

// ─── Event Category ──────────────────────────────────────────────────────────

/**
 * Broad category used to balance the event deck and filter relevant draws.
 * The deck ensures variety — multiple consecutive military events during
 * peacetime are suppressed.
 */
export type EventCategory =
  | 'diplomacy'
  | 'domestic'
  | 'economic'
  | 'military'
  | 'cultural'
  | 'personal'
  | 'environmental'
  | 'company';

// ─── Prerequisite Types ──────────────────────────────────────────────────────

/**
 * The condition type used to determine whether an event is eligible to fire.
 * Each prerequisite type has a corresponding handler in the event engine.
 */
export type PrerequisiteType =
  | 'min_population'
  | 'max_population'
  | 'min_year'
  | 'has_resource'
  | 'tribe_exists'
  | 'tribe_disposition_above'
  | 'tribe_disposition_below'
  | 'company_standing_above'
  | 'company_standing_below'
  /** Checks whether at least one person matching certain criteria is in the settlement. */
  | 'has_person_matching'
  | 'season_is'
  | 'cultural_blend_above'
  | 'cultural_blend_below'
  /** Triggers when linguistic tension between community languages exceeds a threshold. */
  | 'language_tension_above';

// ─── Prerequisite & Requirement Interfaces ────────────────────────────────────

/**
 * A single condition that must be satisfied for an event to be eligible.
 * The `params` shape is specific to each `type` — callers must validate
 * the contents before use.
 */
export interface EventPrerequisite {
  /** The kind of check to perform. */
  type: PrerequisiteType;
  /** Type-specific parameters. Validated by the prerequisite checker. */
  params: Record<string, unknown>;
}

/**
 * A condition that must be met for a specific choice to be available.
 * Unavailable choices may be shown greyed-out or hidden depending on UX settings.
 */
export interface ChoiceRequirement {
  /** An opaque string identifying the requirement type (e.g., 'has_resource', 'min_fighters'). */
  type: string;
  /** Type-specific parameters for the requirement check. */
  params: Record<string, unknown>;
}

/**
 * Specifies constraints on which person(s) can fill an actor slot in an event.
 * The engine selects a matching person and substitutes them into the event
 * description template before displaying it to the player.
 */
export interface ActorRequirement {
  /**
   * An opaque label for this actor slot (e.g., 'subject', 'rival', 'bride').
   * Matches template variables in the event description string, e.g., `{subject}`.
   */
  slot: string;
  /**
   * Criteria the selected person must match.
   * Key/value pairs interpreted by the person-matching prerequisite checker.
   * Example: `{ sex: 'female', unmarried: true, minAge: 14 }`
   */
  criteria: Record<string, unknown>;
}

// ─── Event Choice ─────────────────────────────────────────────────────────────

/** A single player choice presented on the event card. */
export interface EventChoice {
  /** Unique identifier for this choice within the event. */
  id: string;
  /** Short action label shown on the choice button (e.g., "Welcome her freely"). */
  label: string;
  /** Longer description of what this choice entails, shown below the label. */
  description: string;
  /**
   * Optional availability conditions. When present and unmet, the choice
   * is unavailable (greyed out or hidden).
   */
  requirements?: ChoiceRequirement[];
  /** All state mutations applied when the player selects this choice. */
  consequences: EventConsequence[];
  /**
   * If set, this event ID is queued immediately after this choice's consequences
   * are applied — creating an event chain.
   */
  followUpEventId?: string;
}

// ─── Event Consequence ────────────────────────────────────────────────────────

/** A single state mutation applied when an event choice is resolved. */
export interface EventConsequence {
  /** The type of change to apply. */
  type: ConsequenceType;
  /**
   * The entity to target. Interpretation depends on `type`:
   * - persons: a personId string
   * - tribes: a tribeId string
   * - settlement resources: a ResourceType string
   * - standing/disposition: 'settlement' or a tribeId
   */
  target: string;
  /**
   * The change value. Interpretation depends on `type`:
   * - modify_resource / modify_opinion / modify_disposition / modify_standing: numeric delta
   * - add_trait / remove_trait: the TraitId string
   * - trigger_event: the follow-up event ID string
   * - kill_person / wound_person / start_pregnancy: ignored (use `target`)
   */
  value: number | string | boolean;
}

// ─── Game Event ───────────────────────────────────────────────────────────────

/**
 * The full definition of an event in the event deck.
 * Event definition files (one per category) export `GameEvent[]` arrays.
 * The engine reads these at startup and filters them each turn.
 */
export interface GameEvent {
  /** Globally unique event identifier. Must be unique across all definition files. */
  id: string;
  /** Title displayed at the top of the event card. */
  title: string;
  /** Category used for deck balancing and event filtering. */
  category: EventCategory;
  /** All prerequisites that must be satisfied for this event to be drawn. */
  prerequisites: EventPrerequisite[];
  /**
   * Relative probability weight in the event deck.
   * Higher values increase draw frequency relative to other eligible events.
   */
  weight: number;
  /**
   * Minimum number of turns between firings of this event.
   * Set to 0 only for `isUnique: true` events.
   */
  cooldown: number;
  /** If true, this event fires at most once per game. */
  isUnique: boolean;
  /**
   * Narrative description shown to the player above the choices.
   * Supports template variables resolved by the engine: `{subject}`, `{tribe}`, etc.
   */
  description: string;
  /** The choices available to the player. Must contain at least one entry. */
  choices: EventChoice[];
  /**
   * Optional actor slot requirements. When present, the engine selects matching
   * people and binds them to template variables before displaying the event.
   */
  actorRequirements?: ActorRequirement[];
}
