/**
 * Event resolver — applies event choice consequences to GameState.
 *
 * All functions here are pure: they receive state and return new values
 * without mutating their inputs. The Zustand store owns all mutations.
 *
 * Supported consequence types (Phase 3):
 *   modify_resource  — adjusts a ResourceType in settlement.resources
 *   modify_standing  — adjusts company.standing (target: 'company')
 *   modify_disposition — adjusts a tribe's disposition
 *
 * Skill check routing:
 *   When a choice has a `skillCheck`, the resolver finds the best actor from
 *   the council (or settlement), compares their score to the difficulty, and
 *   applies either `onSuccess` or `onFailure` consequences in addition to the
 *   always-fire `consequences`.
 *
 * Deferred events:
 *   When a choice has `deferredEventId`, the resolver schedules a future event
 *   in `state.deferredEvents` and sets `isDeferredOutcome: true` on the result
 *   so the UI can show a pending screen rather than an outcome screen.
 */

import type {
  GameEvent,
  BoundEvent,
  EventConsequence,
  SkillCheck,
  SkillCheckResult,
  DeferredEventEntry,
} from './engine';
import type { GameState, ResourceType, EventRecord } from '../turn/game-state';
import type { Person, EthnicGroup, ReligionId, SocialStatus, CultureId } from '../population/person';
import {
  getDerivedSkill,
  createPerson,
  ETHNIC_GROUP_CULTURE,
  ETHNIC_GROUP_PRIMARY_LANGUAGE,
} from '../population/person';
import type { DerivedSkillId, SkillId } from '../population/person';
import { generateName } from '../population/naming';
import { createFertilityProfile } from '../genetics/fertility';
import { ETHNIC_DISTRIBUTIONS } from '../../data/ethnic-distributions';
import type { SeededRNG } from '../../utils/rng';
import { clamp } from '../../utils/math';

// ─── Result type ─────────────────────────────────────────────────────────────

/**
 * The structured result of resolving an event choice.
 *
 * The store uses this to:
 *  - update GameState
 *  - decide which screen to show (outcome vs pending)
 *  - store the skill check result for the outcome display
 */
export interface ApplyChoiceResult {
  state: GameState;
  /** Present when the choice included a skill check. Used to render the outcome screen. */
  skillCheckResult?: SkillCheckResult;
  /** True when the choice scheduled a deferred event; UI shows pending screen instead of outcome. */
  isDeferredOutcome: boolean;
  /** Present when choice.followUpEventId is set; store queues it at the front of pendingEvents. */
  followUpEventId?: string;
}

// ─── Skill check resolution ───────────────────────────────────────────────────

const DERIVED_SKILL_IDS: DerivedSkillId[] = [
  'deception', 'diplomacy', 'exploring', 'farming', 'hunting', 'poetry', 'strategy',
];

function getActorScore(person: Person, skill: SkillId | DerivedSkillId): number {
  if (DERIVED_SKILL_IDS.includes(skill as DerivedSkillId)) {
    return getDerivedSkill(person.skills, skill as DerivedSkillId);
  }
  return person.skills[skill as SkillId];
}

/**
 * Finds the best actor for a skill check and determines pass/fail.
 *
 * Actor selection:
 *  - 'best_council'    → highest scorer among current council members
 *  - 'best_settlement' → highest scorer among all living settlers
 *  - 'actor_slot'      → person ID from boundActors[check.actorSlot] (or legacy context)
 *
 * If no suitable actor is found, the check auto-fails with score 0.
 */
export function resolveSkillCheck(
  check: SkillCheck,
  state: GameState,
  context: Record<string, unknown> = {},
  boundActors?: Record<string, string>,
): SkillCheckResult {
  let actor: Person | undefined;

  if (check.actorSelection === 'best_council') {
    actor = state.councilMemberIds
      .map(id => state.people.get(id))
      .filter((p): p is Person => p !== undefined)
      .sort((a, b) => getActorScore(b, check.skill) - getActorScore(a, check.skill))[0];
  } else if (check.actorSelection === 'best_settlement') {
    actor = Array.from(state.people.values())
      .sort((a, b) => getActorScore(b, check.skill) - getActorScore(a, check.skill))[0];
  } else if (check.actorSelection === 'actor_slot' && check.actorSlot) {
    // bondActors takes precedence; fall back to legacy context map
    const actorId = boundActors?.[check.actorSlot] ?? (context[check.actorSlot] as string | undefined);
    actor = actorId ? state.people.get(actorId) : undefined;
  }

  if (!actor) {
    return {
      actorId: '',
      actorName: 'No one',
      skill: check.skill,
      actorScore: 0,
      difficulty: check.difficulty,
      passed: false,
    };
  }

  const score = getActorScore(actor, check.skill);
  return {
    actorId: actor.id,
    actorName: `${actor.firstName} ${actor.familyName}`,
    skill: check.skill,
    actorScore: score,
    difficulty: check.difficulty,
    passed: score >= check.difficulty,
  };
}

// ─── Slot resolution helper ─────────────────────────────────────────────────

/**
 * Resolves a consequence target that may be a slot reference ({slotName})
 * to an actual person ID. Non-slot strings are returned unchanged.
 */
function resolveConsequenceTarget(
  target: string,
  boundActors?: Record<string, string>,
): string {
  const match = target.match(/^\{([a-zA-Z_][a-zA-Z0-9_]*)\}$/);
  if (match) {
    const slotName = match[1]!;
    return boundActors?.[slotName] ?? target;
  }
  return target;
}

// ─── Single consequence application ──────────────────────────────────────────

function applyConsequence(
  consequence: EventConsequence,
  state: GameState,
  rng?: SeededRNG,
  boundActors?: Record<string, string>,
): GameState {
  switch (consequence.type) {

    // Resolve the target before branching (slot → ID if needed)
    case 'modify_resource': {
      const key = consequence.target as ResourceType;
      const delta = consequence.value as number;
      const current = state.settlement.resources[key] ?? 0;
      const updated = Math.max(0, current + delta);
      return {
        ...state,
        settlement: {
          ...state.settlement,
          resources: { ...state.settlement.resources, [key]: updated },
        },
      };
    }

    case 'modify_standing': {
      if (consequence.target !== 'company') return state;
      const delta = consequence.value as number;
      return {
        ...state,
        company: {
          ...state.company,
          standing: clamp(state.company.standing + delta, 0, 100),
        },
      };
    }

    case 'modify_disposition': {
      const tribeId = consequence.target;
      const tribe = state.tribes.get(tribeId);
      if (!tribe) return state;
      const delta = consequence.value as number;
      const updatedTribes = new Map(state.tribes);
      updatedTribes.set(tribeId, {
        ...tribe,
        disposition: clamp(tribe.disposition + delta, -100, 100),
      });
      return { ...state, tribes: updatedTribes };
    }

    // ── Slot-targeted person consequences ───────────────────────────────────
    // These resolve the target slot to a real person ID.
    // Full side-effect implementations will be added as events use these types.

    case 'wound_person':
    case 'kill_person':
    case 'start_pregnancy':
    case 'add_trait':
    case 'remove_trait':
    case 'remove_person':
    case 'modify_opinion': {
      const _resolvedTarget = resolveConsequenceTarget(consequence.target, boundActors);
      void _resolvedTarget;
      return state;
    }

    // ── Phase 3+ ─────────────────────────────────────────────────────────────

    case 'add_person': {
      // Guard: person generation requires a seeded RNG.
      if (!rng) return state;

      const count = typeof consequence.value === 'number' ? consequence.value : 1;
      const p = consequence.params ?? {};
      const sex           = (p.sex          as 'male' | 'female') ?? 'female';
      const ethnicGroup   = (p.ethnicGroup  as EthnicGroup)        ?? 'imanian';
      const minAge        = (p.minAge       as number)             ?? 18;
      const maxAge        = (p.maxAge       as number)             ?? 45;
      const socialStatus  = (p.socialStatus as SocialStatus)       ?? 'newcomer';

      const isSauromatian = ethnicGroup !== 'imanian';
      const religion      = (p.religion as ReligionId)
        ?? (isSauromatian ? 'sacred_wheel' : 'imanian_orthodox');

      const dist           = ETHNIC_DISTRIBUTIONS[ethnicGroup];
      const culture        = ETHNIC_GROUP_CULTURE[ethnicGroup];
      const language       = ETHNIC_GROUP_PRIMARY_LANGUAGE[ethnicGroup];
      const extendedFert   = sex === 'female' && isSauromatian;

      const updatedPeople = new Map(state.people);
      for (let i = 0; i < count; i++) {
        const age = minAge + rng.next() * (maxAge - minAge);
        const { firstName, familyName } = generateName(sex, culture, '', '', rng);

        const skinTone = clamp(
          rng.gaussian(dist.skinTone.mean, Math.sqrt(dist.skinTone.variance)),
          0,
          1,
        );

        const person = createPerson({
          firstName,
          familyName,
          sex,
          age,
          role: 'unassigned',
          socialStatus,
          genetics: {
            visibleTraits: {
              skinTone,
              skinUndertone:   rng.weightedPick(dist.skinUndertone.weights),
              hairColor:       rng.weightedPick(dist.hairColor.weights),
              hairTexture:     rng.weightedPick(dist.hairTexture.weights),
              eyeColor:        rng.weightedPick(dist.eyeColor.weights),
              buildType:       rng.weightedPick(dist.buildType.weights),
              height:          rng.weightedPick(dist.height.weights),
              facialStructure: rng.weightedPick(dist.facialStructure.weights),
            },
            genderRatioModifier: isSauromatian ? 0.14 : 0.5,
            extendedFertility: extendedFert,
          },
          fertility: createFertilityProfile(extendedFert),
          heritage: {
            bloodline: [{ group: ethnicGroup, fraction: 1.0 }],
            primaryCulture: culture,
            culturalFluency: new Map<CultureId, number>([[culture, 1.0]]),
          },
          languages: [
            { language, fluency: 1.0 },
            { language: 'tradetalk', fluency: 0.2 },
          ],
          religion,
        }, rng);

        updatedPeople.set(person.id, person);
      }

      return {
        ...state,
        people: updatedPeople,
        settlement: {
          ...state.settlement,
          populationCount: state.settlement.populationCount + count,
        },
      };
    }

    case 'queue_deferred_event': {
      const entry: DeferredEventEntry = {
        eventId: consequence.target,
        scheduledTurn: state.turnNumber + (consequence.value as number),
        context: {},
        boundActors: boundActors ?? {},
      };
      return { ...state, deferredEvents: [...state.deferredEvents, entry] };
    }

    default:
      return state;
  }
}

// ─── Full choice resolution ───────────────────────────────────────────────────

/**
 * Resolves an event choice and returns the full result for the store to apply.
 *
 * Resolution order:
 *  1. Apply `choice.consequences` (always fires).
 *  2. If `choice.skillCheck` is set (and no deferral), resolve it and apply
 *     `onSuccess` or `onFailure` consequences.
 *  3. If `choice.deferredEventId` is set, schedule the event and set isDeferredOutcome.
 *  4. Record in eventHistory and eventCooldowns.
 *
 * @param event    The event being resolved.
 * @param choiceId The ID of the choice the player selected.
 * @param state    Current game state (not mutated).
 * @param rng      Optional seeded RNG — required for consequences that generate people.
 */
export function applyEventChoice(
  event: GameEvent | BoundEvent,
  choiceId: string,
  state: GameState,
  rng?: SeededRNG,
  boundActors?: Record<string, string>,
): ApplyChoiceResult {
  // Prefer caller-supplied boundActors; fall back to any stored on the event.
  const resolvedBoundActors = boundActors ?? (event as BoundEvent).boundActors;
  const choice = event.choices.find(c => c.id === choiceId);
  if (!choice) return { state, isDeferredOutcome: false };

  // 1. Always-fire consequences.
  let updatedState = state;
  for (const consequence of choice.consequences) {
    updatedState = applyConsequence(consequence, updatedState, rng, resolvedBoundActors);
  }

  // 2. Skill check (only when there is no deferral — deferred outcomes resolve later).
  let skillCheckResult: SkillCheckResult | undefined;
  if (choice.skillCheck && !choice.deferredEventId) {
    skillCheckResult = resolveSkillCheck(choice.skillCheck, updatedState, {}, resolvedBoundActors);
    const outcomeConsequences = skillCheckResult.passed
      ? (choice.onSuccess ?? [])
      : (choice.onFailure ?? []);
    for (const consequence of outcomeConsequences) {
      updatedState = applyConsequence(consequence, updatedState, rng, resolvedBoundActors);
    }
  }

  // 3. Deferred event scheduling.
  let isDeferredOutcome = false;
  if (choice.deferredEventId) {
    const deferredTurns = choice.deferredTurns ?? 4;
    const entry: DeferredEventEntry = {
      eventId: choice.deferredEventId,
      scheduledTurn: state.turnNumber + deferredTurns,
      context: {
        originEventId: event.id,
        originChoiceId: choiceId,
      },
      ...(resolvedBoundActors ? { boundActors: resolvedBoundActors } : {}),
    };
    const existingDeferred = updatedState.deferredEvents ?? [];
    updatedState = { ...updatedState, deferredEvents: [...existingDeferred, entry] };
    isDeferredOutcome = true;
  }

  // 4. Record in history and cooldowns.
  // Collect involved persons: bound actors + skill-check actor (deduplicated).
  const involvedIds = new Set<string>(Object.values(resolvedBoundActors ?? {}));
  if (skillCheckResult?.actorId) involvedIds.add(skillCheckResult.actorId);

  const record: EventRecord = {
    eventId: event.id,
    turnNumber: state.turnNumber,
    choiceId,
    involvedPersonIds: [...involvedIds],
    skillCheckResult,
  };

  const updatedCooldowns = new Map(updatedState.eventCooldowns);
  updatedCooldowns.set(event.id, state.turnNumber);

  updatedState = {
    ...updatedState,
    eventHistory: [...updatedState.eventHistory, record],
    eventCooldowns: updatedCooldowns,
  };

  return {
    state: updatedState,
    skillCheckResult,
    isDeferredOutcome,
    followUpEventId: choice.followUpEventId,
  };
}

