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
import type { GameState, ResourceType, EventRecord, ReligiousPolicy } from '../turn/game-state';
import type { Person, EthnicGroup, ReligionId, SocialStatus, CultureId, WorkRole, HouseholdRole, TraitId } from '../population/person';
import type { HouseholdTradition } from '../turn/game-state';
import {
  getDerivedSkill,
  DERIVED_SKILL_IDS,
  getPersonSkillScore,
  createPerson,
  ETHNIC_GROUP_CULTURE,
  ETHNIC_GROUP_PRIMARY_LANGUAGE,
} from '../population/person';
import type { DerivedSkillId, SkillId, OpinionModifier } from '../population/person';
import { addOpinionModifier } from '../population/opinions';
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
      .filter((p): p is Person => p !== undefined && p.role !== 'away')
      .sort((a, b) => getPersonSkillScore(b, check.skill) - getPersonSkillScore(a, check.skill))[0];
  } else if (check.actorSelection === 'best_settlement') {
    actor = Array.from(state.people.values())
      .filter(p => p.role !== 'away')
      .sort((a, b) => getPersonSkillScore(b, check.skill) - getPersonSkillScore(a, check.skill))[0];
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

  const score = getPersonSkillScore(actor, check.skill);
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
  eventId?: string,
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

    // ── Slot-targeted person consequences ──────────────────────────────────

    case 'wound_person': {
      // Resolve target: slot token, literal person ID, or the 'random_adult' keyword.
      let woundTargetId: string | undefined;
      const rawTarget = resolveConsequenceTarget(consequence.target, boundActors);
      if (rawTarget === 'random_adult') {
        if (rng) {
          const adults = Array.from(state.people.values()).filter(p => p.age >= 16);
          woundTargetId = adults[rng.nextInt(0, adults.length - 1)]?.id;
        }
      } else {
        woundTargetId = rawTarget;
      }
      const woundTarget = woundTargetId ? state.people.get(woundTargetId) : undefined;
      if (!woundTarget) return state;
      const damage = typeof consequence.value === 'number' ? consequence.value : 10;
      const updatedPeople = new Map(state.people);
      updatedPeople.set(woundTarget.id, {
        ...woundTarget,
        health: {
          ...woundTarget.health,
          currentHealth: clamp(woundTarget.health.currentHealth - damage, 0, 100),
          conditions: woundTarget.health.conditions.includes('wounded')
            ? woundTarget.health.conditions
            : [...woundTarget.health.conditions, 'wounded'],
        },
      });
      return { ...state, people: updatedPeople };
    }

    case 'remove_person': {
      const removeId = resolveConsequenceTarget(consequence.target, boundActors);
      const removePerson = state.people.get(removeId);
      if (!removePerson) return state;
      const updatedPeople = new Map(state.people);
      updatedPeople.delete(removePerson.id);
      // Add to graveyard so opinion/family references can still resolve their name.
      const departureEntry = {
        id: removePerson.id,
        firstName: removePerson.firstName,
        familyName: removePerson.familyName,
        sex: removePerson.sex,
        birthYear: Math.floor(state.currentYear - removePerson.age),
        deathYear: state.currentYear,
        deathCause: 'departed',
        parentIds: removePerson.parentIds,
        childrenIds: removePerson.childrenIds,
        heritage: removePerson.heritage,
        portraitVariant: removePerson.portraitVariant ?? 1,
        ageAtDeath: Math.floor(removePerson.age),
      };
      // Clean up household membership.
      let updatedHouseholds = state.households;
      if (removePerson.householdId) {
        const household = state.households.get(removePerson.householdId);
        if (household) {
          updatedHouseholds = new Map(state.households);
          updatedHouseholds.set(household.id, {
            ...household,
            memberIds: household.memberIds.filter(id => id !== removePerson.id),
            ashkaMelathiBonds: household.ashkaMelathiBonds.filter(
              ([a, b]) => a !== removePerson.id && b !== removePerson.id,
            ),
            headId: household.headId === removePerson.id ? null : household.headId,
            seniorWifeId: household.seniorWifeId === removePerson.id ? null : household.seniorWifeId,
          });
        }
      }
      return {
        ...state,
        people: updatedPeople,
        households: updatedHouseholds,
        graveyard: [...state.graveyard, departureEntry],
        councilMemberIds: state.councilMemberIds.filter(id => id !== removePerson.id),
        settlement: {
          ...state.settlement,
          populationCount: Math.max(0, state.settlement.populationCount - 1),
        },
      };
    }

    case 'add_trait': {
      const addTraitId = resolveConsequenceTarget(consequence.target, boundActors);
      const addTraitPerson = state.people.get(addTraitId);
      if (!addTraitPerson) return state;
      const newTrait = consequence.value as TraitId;
      if (addTraitPerson.traits.includes(newTrait)) return state;
      const updatedPeople = new Map(state.people);
      updatedPeople.set(addTraitPerson.id, { ...addTraitPerson, traits: [...addTraitPerson.traits, newTrait] });
      return { ...state, people: updatedPeople };
    }

    case 'remove_trait': {
      const removeTraitId = resolveConsequenceTarget(consequence.target, boundActors);
      const removeTraitPerson = state.people.get(removeTraitId);
      if (!removeTraitPerson) return state;
      const removeTrait = consequence.value as TraitId;
      const updatedPeople = new Map(state.people);
      updatedPeople.set(removeTraitPerson.id, {
        ...removeTraitPerson,
        traits: removeTraitPerson.traits.filter(t => t !== removeTrait),
      });
      return { ...state, people: updatedPeople };
    }

    // ── Stubs — implemented when first used by a live event ─────────────────

    case 'kill_person':
      console.warn('applyConsequence: kill_person is not yet implemented — consequence ignored', consequence);
      return state; // TODO: move to graveyard, clean up relationships
    case 'start_pregnancy':
      console.warn('applyConsequence: start_pregnancy is not yet implemented — consequence ignored', consequence);
      return state; // TODO: set pregnancyState on target person
    case 'modify_opinion': {
      // Broadcast: shift every living person's opinion of the target by `value`.
      // target may be a slot reference or a literal person ID.
      const targetId = resolveConsequenceTarget(consequence.target, boundActors);
      const delta = consequence.value as number;
      if (!targetId || targetId === '' || !Number.isFinite(delta)) return state;

      const updatedPeople = new Map(state.people);
      for (const [id, person] of state.people) {
        if (id === targetId) continue;
        const current = person.relationships.get(targetId) ?? 0;
        const next = Math.max(-100, Math.min(100, current + delta));
        const updatedRelationships = new Map(person.relationships);
        if (next !== current) {
          if (next === 0) {
            updatedRelationships.delete(targetId);
          } else {
            updatedRelationships.set(targetId, next);
          }
          updatedPeople.set(id, { ...person, relationships: updatedRelationships });
        }
      }
      return { ...state, people: updatedPeople };
    }
    case 'trigger_event':
      console.warn('applyConsequence: trigger_event is not yet implemented — consequence ignored', consequence);
      return state; // TODO: push follow-up into pendingEvents via followUpEventId

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

    case 'set_social_status': {
      const resolvedId = resolveConsequenceTarget(consequence.target, boundActors);
      const person = resolvedId ? state.people.get(resolvedId) : undefined;
      if (!person) return state;
      const newStatus = consequence.value as SocialStatus;
      const updatedPeople = new Map(state.people);
      updatedPeople.set(person.id, { ...person, socialStatus: newStatus });
      return { ...state, people: updatedPeople };
    }

    case 'set_household_role': {
      const resolvedId = resolveConsequenceTarget(consequence.target, boundActors);
      const person = resolvedId ? state.people.get(resolvedId) : undefined;
      if (!person) return state;
      const newRole = consequence.value as HouseholdRole;
      const updatedPeople = new Map(state.people);
      updatedPeople.set(person.id, { ...person, householdRole: newRole });
      return { ...state, people: updatedPeople };
    }

    case 'clear_household': {
      const resolvedId = resolveConsequenceTarget(consequence.target, boundActors);
      const person = resolvedId ? state.people.get(resolvedId) : undefined;
      if (!person || !person.householdId) return state;
      const household = state.households.get(person.householdId);
      if (!household) return state;
      const updatedHousehold = {
        ...household,
        memberIds: household.memberIds.filter(id => id !== person.id),
        ashkaMelathiBonds: household.ashkaMelathiBonds.filter(
          ([a, b]) => a !== person.id && b !== person.id,
        ),
        headId: household.headId === person.id ? null : household.headId,
        seniorWifeId: household.seniorWifeId === person.id ? null : household.seniorWifeId,
      };
      const updatedPeople = new Map(state.people);
      updatedPeople.set(person.id, { ...person, householdId: null, householdRole: null });
      const updatedHouseholds = new Map(state.households);
      updatedHouseholds.set(household.id, updatedHousehold);
      return { ...state, people: updatedPeople, households: updatedHouseholds };
    }

    case 'set_household_tradition': {
      // target is a personId (the household head) or a slot token resolving to one.
      const resolvedId = resolveConsequenceTarget(consequence.target, boundActors);
      const person = resolvedId ? state.people.get(resolvedId) : undefined;
      const householdId = person?.householdId;
      if (!householdId) return state;
      const household = state.households.get(householdId);
      if (!household) return state;
      const newTradition = consequence.value as HouseholdTradition;
      const updatedHouseholds = new Map(state.households);
      updatedHouseholds.set(householdId, { ...household, tradition: newTradition });
      return { ...state, households: updatedHouseholds };
    }

    // ── Timed opinion modifiers ───────────────────────────────────────────

    case 'modify_opinion_labeled': {
      // Broadcast a decaying modifier to every observer's opinion of the target.
      const targetId = resolveConsequenceTarget(consequence.target, boundActors);
      const delta = consequence.value as number;
      const label = (consequence.params?.label as string | undefined) ?? 'Event';
      const srcId = eventId ?? 'unknown';
      if (!targetId || !state.people.has(targetId) || !Number.isFinite(delta)) return state;

      const modId = `${srcId}:labeled:${targetId}`;
      const updatedPeople = new Map(state.people);
      for (const [id, person] of state.people) {
        if (id === targetId) continue;
        const modifier: OpinionModifier = { id: modId, targetId, label, value: delta, eventId: srcId };
        updatedPeople.set(id, addOpinionModifier(person, modifier));
      }
      return { ...state, people: updatedPeople };
    }

    case 'modify_opinion_pair': {
      // Bidirectional timed modifier between two named actor slots.
      const personAId = resolveConsequenceTarget(consequence.target, boundActors);
      const slotBRaw = consequence.params?.slotB as string | undefined;
      if (!slotBRaw) return state;
      const personBId = resolveConsequenceTarget(slotBRaw, boundActors);
      const valueAB = consequence.value as number;
      const valueBA = typeof consequence.params?.valueB === 'number'
        ? consequence.params.valueB
        : valueAB;
      const label = (consequence.params?.label as string | undefined) ?? 'Shared experience';
      const srcId = eventId ?? 'unknown';

      const personA = state.people.get(personAId);
      const personB = state.people.get(personBId);
      if (!personA || !personB || personAId === personBId) return state;

      const modIdAB: OpinionModifier = { id: `${srcId}:pair:${personAId}:${personBId}`, targetId: personBId, label, value: valueAB, eventId: srcId };
      const modIdBA: OpinionModifier = { id: `${srcId}:pair:${personBId}:${personAId}`, targetId: personAId, label, value: valueBA, eventId: srcId };

      const updatedPeople = new Map(state.people);
      updatedPeople.set(personAId, addOpinionModifier(personA, modIdAB));
      updatedPeople.set(personBId, addOpinionModifier(personB, modIdBA));
      return { ...state, people: updatedPeople };
    }

    case 'modify_religion': {
      // Changes a person's religion. target = personId or slot token; value = ReligionId string.
      const resolvedId = resolveConsequenceTarget(consequence.target, boundActors);
      if (!resolvedId) return state;
      const religionTarget = state.people.get(resolvedId);
      if (!religionTarget) return state;
      const newReligion = consequence.value as ReligionId;
      const updatedPeople = new Map(state.people);
      updatedPeople.set(resolvedId, { ...religionTarget, religion: newReligion });
      return { ...state, people: updatedPeople };
    }

    case 'set_religious_policy': {
      const newPolicy = consequence.value as ReligiousPolicy;
      // 'hidden_wheel_recognized' implicitly marks the Hidden Wheel as emerged.
      const hiddenWheelEmerged =
        newPolicy === 'hidden_wheel_recognized'
          ? true
          : state.culture.hiddenWheelEmerged;
      return {
        ...state,
        settlement: { ...state.settlement, religiousPolicy: newPolicy },
        culture: { ...state.culture, hiddenWheelEmerged },
      };
    }

    case 'set_hidden_wheel_emerged':
      return { ...state, culture: { ...state.culture, hiddenWheelEmerged: true } };

    case 'set_hidden_wheel_suppressed': {
      const turns = typeof consequence.value === 'number' ? consequence.value : 30;
      return {
        ...state,
        culture: { ...state.culture, hiddenWheelSuppressedTurns: turns },
      };
    }

    case 'modify_cultural_blend': {
      const delta = consequence.value as number;
      const updated = clamp(state.culture.culturalBlend + delta, 0, 1);
      return {
        ...state,
        culture: { ...state.culture, culturalBlend: updated },
      };
    }

    case 'modify_all_tribe_dispositions': {
      const delta = consequence.value as number;
      const updatedTribes = new Map(state.tribes);
      for (const [id, tribe] of state.tribes) {
        updatedTribes.set(id, {
          ...tribe,
          disposition: clamp(tribe.disposition + delta, -100, 100),
        });
      }
      return { ...state, tribes: updatedTribes };
    }

    case 'clear_scheme': {
      // Clears the active scheme on the target person.
      const resolvedId = resolveConsequenceTarget(consequence.target, boundActors);
      if (!resolvedId) return state;
      const schemePerson = state.people.get(resolvedId);
      if (!schemePerson) return state;
      const updatedPeople = new Map(state.people);
      updatedPeople.set(resolvedId, { ...schemePerson, activeScheme: null });
      return { ...state, people: updatedPeople };
    }

    case 'clear_ambition': {
      // Clears the active ambition on the target person.
      const resolvedId = resolveConsequenceTarget(consequence.target, boundActors);
      if (!resolvedId) return state;
      const ambitionPerson = state.people.get(resolvedId);
      if (!ambitionPerson) return state;
      const updatedPeople = new Map(state.people);
      updatedPeople.set(resolvedId, { ...ambitionPerson, ambition: null });
      return { ...state, people: updatedPeople };
    }

    case 'reset_low_happiness': {
      // Resets the lowHappinessTurns streak counter to 0 for the target person.
      const resolvedId = resolveConsequenceTarget(consequence.target, boundActors);
      if (!resolvedId) return state;
      const happinessPerson = state.people.get(resolvedId);
      if (!happinessPerson) return state;
      const updatedPeople = new Map(state.people);
      updatedPeople.set(resolvedId, { ...happinessPerson, lowHappinessTurns: 0 });
      return { ...state, people: updatedPeople };
    }

    case 'reset_low_morale': {
      // Resets the settlement-level low-morale streak counter to 0.
      return { ...state, lowMoraleTurns: 0 };
    }

    // Exhaustiveness guard — compile error if a new ConsequenceType is added without a handler.
    default: {
      const _exhaustive: never = consequence;
      void _exhaustive;
      return state;
    }
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
    updatedState = applyConsequence(consequence, updatedState, rng, resolvedBoundActors, event.id);
  }

  // 2. Skill check (only when there is no deferral — deferred outcomes resolve later).
  let skillCheckResult: SkillCheckResult | undefined;
  if (choice.skillCheck && !choice.deferredEventId) {
    skillCheckResult = resolveSkillCheck(choice.skillCheck, updatedState, {}, resolvedBoundActors);
    const outcomeConsequences = skillCheckResult.passed
      ? (choice.onSuccess ?? [])
      : (choice.onFailure ?? []);
    for (const consequence of outcomeConsequences) {
      updatedState = applyConsequence(consequence, updatedState, rng, resolvedBoundActors, event.id);
    }
  }

  // 2b. Auto-apply: +2 "shared experience" modifier between every pair of bound actors.
  // Suppressed by choice.skipActorBond = true (hostile/quarrel outcomes).
  if (!choice.skipActorBond && resolvedBoundActors) {
    const actorIds = Object.values(resolvedBoundActors).filter(id => updatedState.people.has(id));
    if (actorIds.length >= 2) {
      const updatedPeople = new Map(updatedState.people);
      const bondLabel = `Shared: ${event.title}`;
      for (let i = 0; i < actorIds.length; i++) {
        for (let j = i + 1; j < actorIds.length; j++) {
          const idA = actorIds[i]!;
          const idB = actorIds[j]!;
          const modAB: OpinionModifier = { id: `${event.id}:auto:${idA}:${idB}`, targetId: idB, label: bondLabel, value: 5, eventId: event.id };
          const modBA: OpinionModifier = { id: `${event.id}:auto:${idB}:${idA}`, targetId: idA, label: bondLabel, value: 5, eventId: event.id };
          const pA = updatedPeople.get(idA);
          const pB = updatedPeople.get(idB);
          if (pA) updatedPeople.set(idA, addOpinionModifier(pA, modAB));
          if (pB) updatedPeople.set(idB, addOpinionModifier(pB, modBA));
        }
      }
      updatedState = { ...updatedState, people: updatedPeople };
    }
  }

  // 3. Deferred event scheduling.
  let isDeferredOutcome = false;
  if (choice.deferredEventId) {
    const deferredTurns = choice.deferredTurns ?? 4;

    // If a missionActorSlot is declared, mark that person as 'away' immediately
    // and record their original role so processDawn can restore it on return.
    let missionContext: Record<string, unknown> = {};
    if (choice.missionActorSlot && resolvedBoundActors) {
      const missionActorId = resolvedBoundActors[choice.missionActorSlot];
      if (missionActorId) {
        const missionActor = updatedState.people.get(missionActorId);
        if (missionActor && missionActor.role !== 'away') {
          missionContext = {
            missionActorId,
            prevRole: missionActor.role as WorkRole,
          };
          const updatedPeople = new Map(updatedState.people);
          updatedPeople.set(missionActorId, { ...missionActor, role: 'away' });
          updatedState = { ...updatedState, people: updatedPeople };
        }
      }
    }

    const entry: DeferredEventEntry = {
      eventId: choice.deferredEventId,
      scheduledTurn: state.turnNumber + deferredTurns,
      context: {
        originEventId: event.id,
        originChoiceId: choiceId,
        ...missionContext,
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

