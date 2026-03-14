/**
 * Event system type definitions for the Palusteria simulation.
 *
 * Events are the primary player interface — each turn draws 1–3 events from
 * the deck and presents them as narrative choices. This module defines only
 * the data shapes; actual event data lives in
 * `src/simulation/events/definitions/`.
 */

import type { SkillId, DerivedSkillId, TraitId, CultureId, ReligionId, SocialStatus, WorkRole, HouseholdRole } from '../population/person';

// ─── Consequence Types ───────────────────────────────────────────────────────

/** All possible state changes an event choice can produce. */
export type ConsequenceType =
  | 'add_person'
  | 'remove_person'
  | 'modify_resource'
  | 'modify_opinion'
  /** Changes a person's religion. `target` = personId or slot token; `value` = ReligionId string. */
  | 'modify_religion'
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
  | 'trigger_event'
  /** Schedules a deferred follow-up event to fire after N turns. `target` = eventId, `value` = turns to wait. */
  | 'queue_deferred_event'
  /** Changes a person's socialStatus. `target` = personId or slot token. `value` = new SocialStatus string. */
  | 'set_social_status'
  /** Changes a person's householdRole. `target` = personId or slot token. `value` = new HouseholdRole string. */
  | 'set_household_role'
  /** Removes a person from their household (clears householdId and householdRole). `target` = personId or slot token. */
  | 'clear_household'
  /** Changes a household's tradition. `target` = householdId or '{head}' slot. `value` = new HouseholdTradition string. */
  | 'set_household_tradition'
  /**
   * Timed broadcast: creates a decaying `OpinionModifier` on every observer toward the target.
   * `target` = slot token or person ID. `value` = signed magnitude (abs = turns remaining).
   * `params.label` = display label shown in opinion breakdown tooltip.
   */
  | 'modify_opinion_labeled'
  /**
   * Timed bidirectional modifier between two named actor slots.
   * `target` = slot token for person A (e.g. `'{lead}'`). `value` = signed magnitude for A→B.
   * `params.slotB` = slot token for person B. `params.label` = display label.
   * `params.valueB` (optional) = magnitude for B→A; defaults to `value` if omitted.
   */
  | 'modify_opinion_pair'
  /** Sets the settlement's religious policy. `value` = ReligiousPolicy string. */
  | 'set_religious_policy'
  /**
   * Marks the Hidden Wheel as having emerged (sets SettlementCulture.hiddenWheelEmerged = true).
   * No target or value needed.
   */
  | 'set_hidden_wheel_emerged'
  /**
   * Freezes the Hidden Wheel divergence clock for N turns.
   * `value` = number of turns to suppress (e.g. 30).
   */
  | 'set_hidden_wheel_suppressed'
  /**
   * Nudges the settlement's cultural blend by a signed delta.
   * `value` = delta (e.g. -0.03 toward Imanian, +0.02 toward native).
   * Result is clamped to [0.0, 1.0].
   */
  | 'modify_cultural_blend'
  /**
   * Applies a disposition delta to every external tribe in the region.
   * `value` = numeric delta. Result is clamped to [-100, 100] per tribe.
   */
  | 'modify_all_tribe_dispositions'
  /**
   * Clears the target person's active scheme immediately.
   * Used by event choices that forbid or interrupt a scheme in progress.
   * `target` = personId or slot token. No `value` needed.
   */
  | 'clear_scheme'
  /**
   * Clears the target person's active ambition immediately.
   * Used when an event choice fulfils or cancels the ambition.
   * `target` = personId or slot token. No `value` needed.
   */
  | 'clear_ambition';

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
  | 'language_tension_above'
  /** Checks whether a specific building is present in the settlement. */
  | 'has_building'
  /** Checks whether a specific building is absent from the settlement. */
  | 'lacks_building'
  /** True when at least one construction project is in the queue. */
  | 'construction_active'
  /** True when settlement population exceeds shelter capacity. */
  | 'overcrowded'
  /** True when at least one household has two or more wives. */
  | 'has_multi_wife_household'
  /** True when at least one Ashka-Melathi bond exists in any household. */
  | 'has_ashka_melathi_bond'
  /** True when at least one living person holds an opinion of another above the given threshold (params: { threshold: number }). */
  | 'min_opinion_pair'
  /** True when at least one living person holds an opinion of another below the given threshold (params: { threshold: number }). */
  | 'max_opinion_pair'
  /** True when at least one living person has an active ambition of the given type (params: { ambitionType: AmbitionId }). */
  | 'has_person_with_ambition'
  /** True when the named religion's population fraction is above the threshold (params: { religion: ReligionId; threshold: number }). */
  | 'religion_fraction_above'
  /** True when the named religion's population fraction is below the threshold (params: { religion: ReligionId; threshold: number }). */
  | 'religion_fraction_below'
  /** True when religiousTension is above the threshold (params: { threshold: number }). */
  | 'religious_tension_above'
  /** True when the settlement's religiousPolicy equals the given value (params: { policy: string }). */
  | 'religious_policy_is'
  /** True when the Hidden Wheel has emerged (SettlementCulture.hiddenWheelEmerged). */
  | 'hidden_wheel_emerged'
  /** True when companyPressureTurns (native-zone seasons) is >= the given value (params: { turns: number }). */
  | 'min_company_pressure_turns'
  /** True when tribalPressureTurns (Imanian-zone seasons) is >= the given value (params: { turns: number }). */
  | 'min_tribal_pressure_turns'
  /** True when at least one faction of the given type is active (params?: { type: FactionType }; omit to check any faction). */
  | 'has_active_faction';

// ─── Prerequisite & Requirement Interfaces ────────────────────────────────────

/**
 * A single condition that must be satisfied for an event to be eligible.
 * The `params` shape is specific to each `type` — callers must validate
 * the contents before use.
 */
export interface EventPrerequisite {
  /** The kind of check to perform. */
  type: PrerequisiteType;
  /** Type-specific parameters. Validated by the prerequisite checker. Optional for parameterless checks. */
  params?: Record<string, unknown>;
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
 * Typed matching criteria used to select a person for an actor slot.
 * All fields are optional — only populated fields are checked.
 */
export interface ActorCriteria {
  sex?: 'male' | 'female';
  religion?: ReligionId;
  /** Matches person.heritage.primaryCulture. */
  culturalIdentity?: CultureId;
  minAge?: number;
  maxAge?: number;
  maritalStatus?: 'married' | 'unmarried';
  role?: WorkRole;
  socialStatus?: SocialStatus;
  /** Person must be in this household role (e.g., 'senior_wife', 'wife', 'thrall'). */
  householdRole?: HouseholdRole;
  /** Person must have this trait in their traits array. */
  hasTrait?: TraitId;
  /** Person must have at least this score in the given skill. */
  minSkill?: { skill: SkillId | DerivedSkillId; value: number };
  /**
   * When true, person's primaryCulture must be in SAUROMATIAN_CULTURE_IDS.
   * Useful for selecting "native" settlers regardless of their specific sub-group.
   */
  sauromatianHeritage?: boolean;
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
  /** Typed criteria the selected person must satisfy. */
  criteria: ActorCriteria;
  /**
   * When true (default), the event is ineligible if this slot cannot be filled.
   * Set to false for optional actors (event still fires, slot interpolation is skipped).
   */
  required?: boolean;
}

// ─── Skill Check Interfaces ──────────────────────────────────────────────────

/**
 * Defines the skill-based resolution attached to an EventChoice.
 * The resolver finds the best actor, compares their score to the difficulty,
 * and routes to `onSuccess` or `onFailure` consequences accordingly.
 */
export interface SkillCheck {
  /** Which base or derived skill is tested. */
  skill: SkillId | DerivedSkillId;
  /**
   * Target difficulty (1–100). Actor's score is compared directly:
   *   score >= difficulty  → success
   *   score <  difficulty  → failure
   * Reference: Fair 15–25 · Good 26–40 · VG 41–55 · Ex 56–72 · Rn 73–85 · Hr 86+
   */
  difficulty: number;
  /**
   * How the actor is selected:
   * - `'best_council'`     — highest scorer among current council members (default)
   * - `'best_settlement'`  — highest scorer among all living settlers
   * - `'actor_slot'`       — uses the person bound to the named actorSlot
   */
  actorSelection: 'best_council' | 'best_settlement' | 'actor_slot';
  /** Required when actorSelection is 'actor_slot'. Names the ActorRequirement slot. */
  actorSlot?: string;
  /** Optional narrative intro shown on the skill-check result screen. */
  attemptLabel?: string;
}

/** The outcome of a resolved skill check. Stored in EventRecord for display. */
export interface SkillCheckResult {
  actorId: string;
  /** Cached full name — preserved even if actor later dies. */
  actorName: string;
  skill: SkillId | DerivedSkillId;
  actorScore: number;
  difficulty: number;
  passed: boolean;
}

/**
 * An event scheduled to fire at a future turn as the resolution of an
 * earlier player choice — the chain / deferred event mechanism.
 */
export interface DeferredEventEntry {
  /** The event ID to fire when scheduledTurn is reached. */
  eventId: string;
  /** The turn number on which this event enters the pending queue. */
  scheduledTurn: number;
  /**
   * Pass-through data from the original choice context.
   * Common keys: actorId, originEventId, originChoiceId.
   */
  context: Record<string, unknown>;
  /**
   * Actor bindings from the original event, persisted so deferred outcome text
   * can still reference the same named people.
   */
  boundActors?: Record<string, string>;
}

/**
 * The runtime form of a GameEvent.
 * Static event definitions are pure data; binding is added at draw time only.
 * All entries in pendingEvents are BoundEvents; the store never exposes plain GameEvents.
 */
export type BoundEvent = GameEvent & {
  /** Maps slot name → person.id for every actor resolved at draw time. */
  boundActors: Record<string, string>;
};

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
  /**
   * Consequences that always apply regardless of skill check outcome.
   * If a skillCheck is present, these fire first; then onSuccess or onFailure.
   */
  consequences: EventConsequence[];
  /**
   * If set, this event ID is queued immediately after consequences are applied.
   * Mutually exclusive with deferredEventId.
   */
  followUpEventId?: string;

  // ── Skill-Check Resolution ────────────────────────────────────────────────
  /** Optional skill check. When present, the resolver routes through onSuccess/onFailure. */
  skillCheck?: SkillCheck;
  /** Consequences applied when the skill check passes. */
  onSuccess?: EventConsequence[];
  /** Consequences applied when the skill check fails. */
  onFailure?: EventConsequence[];

  // ── Chain / Deferred Resolution ──────────────────────────────────────────
  /**
   * If set, schedules this event ID to fire after `deferredTurns` turns.
   * The outcome is not shown immediately — the player sees a pending notice
   * and the resolution event fires later in the event phase.
   * Mutually exclusive with followUpEventId.
   */
  deferredEventId?: string;
  /** Number of turns to wait before the deferred event fires. Default: 4. */
  deferredTurns?: number;
  /**
   * Names the actor slot (from actorRequirements) of the person dispatched on
   * this deferred mission. That person's WorkRole is set to 'away' immediately
   * when the choice is made, and restored to their prior role when the deferred
   * event resolves. Ignored when deferredEventId is not set.
   */
  missionActorSlot?: string;
  /**
   * When true, suppresses the automatic +2 "shared experience" `OpinionModifier`
   * that is applied between every pair of co-actors after choice resolution.
   * Use on choices where working together is incidental or actively hostile.
   */
  skipActorBond?: boolean;

  // ── Outcome Narrative Text ────────────────────────────────────────────────
  /** Narrative shown on the outcome screen after a successful skill check. */
  successText?: string;
  /** Narrative shown on the outcome screen after a failed skill check. */
  failureText?: string;
  /** Narrative shown on the pending screen when outcome is deferred. */
  pendingText?: string;
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
   * - add_person: a descriptive label (e.g. 'widow', 'imanian_woman') — for logging only
   */
  target: string;
  /**
   * The change value. Interpretation depends on `type`:
   * - modify_resource / modify_opinion / modify_disposition / modify_standing: numeric delta
   * - add_person: number of people to add
   * - add_trait / remove_trait: the TraitId string
   * - trigger_event: the follow-up event ID string
   * - kill_person / wound_person / start_pregnancy: ignored (use `target`)
   */
  value: number | string | boolean;
  /**
   * Optional extra parameters used by complex consequence types.
   * add_person keys: sex, ethnicGroup, minAge, maxAge, religion, socialStatus
   */
  params?: Record<string, unknown>;
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
  /**
   * If true, this event can only fire from the deferred queue — it is never
   * eligible for normal deck draws. Used for chain-event resolution events.
   */
  isDeferredOutcome?: boolean;
  /**
   * Optional filename for event artwork, relative to /events/.
   * e.g. "riders_on_the_shore.jpg" → served from /events/riders_on_the_shore.jpg
   * Fallback chain: per-event → /events/categories/{category}.jpg → /events/placeholder.jpg → CSS gradient
   */
  image?: string;
}
