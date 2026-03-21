/**
 * Faction events — player-facing collective demands and political friction.
 *
 * Five events. All involve a `spokesperson` actor slot (the most vocal member).
 *
 * Event IDs:
 *   fac_faction_demands      — faction strength exceeds threshold; demand is made
 *   fac_faction_appeased     — demand was met; faction offers goodwill
 *   fac_faction_splits       — two strong factions collide; bloc fractures
 *   fac_newcomer_pressured   — faction members pressure a newcomer to conform
 *   fac_faction_standoff     — two opposing factions both strong; direct confrontation
 */

import type { GameEvent } from '../engine';

export const FACTION_EVENTS: GameEvent[] = [

  // ── Faction demand delivered ─────────────────────────────────────────────────

  {
    id: 'fac_faction_demands',
    title: 'A Faction Speaks',
    category: 'domestic',
    prerequisites: [{ type: 'has_active_faction' }],
    actorRequirements: [
      { slot: 'spokesperson', criteria: { minAge: 18, minSkill: { skill: 'leadership', value: 26 } } },
    ],
    weight: 5,
    cooldown: 0,
    isUnique: false,
    isDeferredOutcome: true,
    description:
      '{spokesperson} steps forward on behalf of a faction that has been growing in influence. ' +
      'Their voice carries the weight of shared conviction — and a collective request you cannot easily ignore. ' +
      'They lay their demand before you and wait.',
    choices: [
      {
        id: 'grant',
        label: 'Grant the demand.',
        description: 'You see the wisdom in keeping this group onside.',
        consequences: [
          { type: 'modify_opinion', target: '{spokesperson}', value: 15 },
          { type: 'modify_standing', target: 'company', value: -5 },
        ],
      },
      {
        id: 'negotiate',
        label: 'Negotiate a compromise.',
        description: 'You are willing to meet them partway — but not all the way.',
        consequences: [
          { type: 'modify_opinion', target: '{spokesperson}', value: 5 },
          { type: 'modify_opinion_labeled', target: '{spokesperson}', value: -3, params: { label: 'Compromise: half a loaf' } },
        ],
      },
      {
        id: 'refuse',
        label: 'Refuse outright.',
        description: 'The settlement cannot be ruled by faction pressure.',
        consequences: [
          { type: 'modify_opinion', target: '{spokesperson}', value: -15 },
          { type: 'modify_opinion_labeled', target: '{spokesperson}', value: -8, params: { label: 'Demand refused' } },
        ],
      },
    ],
  },

  // ── Faction appeased ─────────────────────────────────────────────────────────

  {
    id: 'fac_faction_appeased',
    title: 'Goodwill From the Bloc',
    category: 'domestic',
    prerequisites: [{ type: 'has_active_faction' }],
    actorRequirements: [
      { slot: 'spokesperson', criteria: { minAge: 18 } },
    ],
    weight: 3,
    cooldown: 8,
    isUnique: false,
    isDeferredOutcome: false,
    description:
      '{spokesperson} seeks you out privately to express something that does not come easily to {spokesperson.him}: gratitude. ' +
      'The faction{spokesperson.he} speaks for feels their concerns have been heard, and they are offering something in return.',
    choices: [
      {
        id: 'accept',
        label: 'Accept the gesture graciously.',
        description: 'Goodwill is hard-won; let it be acknowledged.',
        consequences: [
          { type: 'modify_opinion', target: '{spokesperson}', value: 10 },
          { type: 'modify_resource', target: 'wealth', value: 3 },
        ],
      },
      {
        id: 'acknowledge_only',
        label: 'Acknowledge the gesture, but ask for nothing.',
        description: 'A nod is enough. Let them keep what they have.',
        consequences: [
          { type: 'modify_opinion', target: '{spokesperson}', value: 8 },
        ],
      },
    ],
  },

  // ── Faction splits ────────────────────────────────────────────────────────────

  {
    id: 'fac_faction_splits',
    title: 'A Bloc Divides',
    category: 'personal',
    prerequisites: [{ type: 'has_active_faction' }],
    actorRequirements: [
      { slot: 'hardliner', criteria: { minAge: 18, hasTrait: 'stubborn' } },
      { slot: 'moderate', criteria: { minAge: 18 } },
    ],
    weight: 2,
    cooldown: 16,
    isUnique: false,
    isDeferredOutcome: false,
    description:
      'The faction has begun to fracture. {hardliner} insists the group should push harder and accept no compromise. ' +
      '{moderate.first} takes a different view — that half a victory is better than none. ' +
      'The two factions-within-a-faction are looking to you to settle the dispute.',
    choices: [
      {
        id: 'back_hardliner',
        label: 'Side with the hardliners.',
        description: 'Bold demands yield bolder results.',
        consequences: [
          { type: 'modify_opinion', target: '{hardliner}', value: 12 },
          { type: 'modify_opinion', target: '{moderate}', value: -8 },
          { type: 'modify_opinion_pair', target: '{hardliner}', value: -10, params: { slotB: '{moderate}', label: 'Political split' } },
        ],
      },
      {
        id: 'back_moderate',
        label: 'Back the moderates.',
        description: 'Steady progress over confrontation.',
        consequences: [
          { type: 'modify_opinion', target: '{moderate}', value: 12 },
          { type: 'modify_opinion', target: '{hardliner}', value: -8 },
          { type: 'modify_opinion_pair', target: '{moderate}', value: -10, params: { slotB: '{hardliner}', label: 'Political split' } },
        ],
      },
      {
        id: 'stay_neutral',
        label: 'Stay out of it.',
        description: 'Faction politics are their affair, not yours.',
        consequences: [
          { type: 'modify_opinion', target: '{hardliner}', value: -4 },
          { type: 'modify_opinion', target: '{moderate}', value: -4 },
        ],
      },
    ],
  },

  // ── Newcomer pressured ────────────────────────────────────────────────────────

  {
    id: 'fac_newcomer_pressured',
    title: 'Pressure to Conform',
    category: 'personal',
    prerequisites: [{ type: 'has_active_faction' }],
    actorRequirements: [
      { slot: 'elder_member', criteria: { minAge: 30, hasTrait: 'respected_elder' } },
      { slot: 'newcomer', criteria: { maxAge: 29 } },
    ],
    weight: 3,
    cooldown: 10,
    isUnique: false,
    isDeferredOutcome: false,
    description:
      '{elder_member} has taken it upon {elder_member.himself} to "guide" {newcomer.first}. ' +
      'The intention may be well-meaning, but the delivery has not been gentle — {newcomer.first} looks cornered. ' +
      'You can let it play out, redirect the elder, or use it to build bonds.',
    choices: [
      {
        id: 'intervene',
        label: 'Intervene on the newcomer\'s behalf.',
        description: 'Gentle pressure is one thing; this has gone too far.',
        consequences: [
          { type: 'modify_opinion', target: '{newcomer}', value: 12 },
          { type: 'modify_opinion', target: '{elder_member}', value: -8 },
          { type: 'modify_opinion_pair', target: '{newcomer}', value: -6, params: { slotB: '{elder_member}', label: 'Elder pressured me' } },
        ],
      },
      {
        id: 'encourage_mentorship',
        label: 'Frame it as mentorship.',
        description: `The elder's experience is an asset — channel it.`,
        consequences: [
          { type: 'modify_opinion', target: '{elder_member}', value: 8 },
          { type: 'modify_opinion_pair', target: '{elder_member}', value: 6, params: { slotB: '{newcomer}', label: 'Official mentor' } },
        ],
      },
      {
        id: 'stay_out',
        label: 'Let them work it out.',
        description: 'Every generation navigates these tensions.',
        consequences: [],
      },
    ],
  },

  // ── Faction standoff ──────────────────────────────────────────────────────────

  {
    id: 'fac_faction_standoff',
    title: 'A Settlement at Odds',
    category: 'domestic',
    prerequisites: [{ type: 'has_active_faction' }],
    actorRequirements: [
      { slot: 'voice_one', criteria: { minAge: 18, minSkill: { skill: 'leadership', value: 26 } } },
      { slot: 'voice_two', criteria: { minAge: 18, minSkill: { skill: 'leadership', value: 26 } } },
    ],
    weight: 2,
    cooldown: 20,
    isUnique: false,
    isDeferredOutcome: true,
    description:
      'Two factions have grown to equal strength and they are no longer content to simply coexist. ' +
      '{voice_one} faces {voice_two.first} across the council ground and neither will yield without your word. ' +
      `The entire settlement watches. The wrong choice will cost you someone's loyalty.`,
    choices: [
      {
        id: 'favour_voice_one',
        label: 'Rule in favour of {voice_one.first}\'s faction.',
        description: `Their position is more aligned with the settlement's current path.`,
        consequences: [
          { type: 'modify_opinion', target: '{voice_one}', value: 15 },
          { type: 'modify_opinion', target: '{voice_two}', value: -15 },
          { type: 'modify_opinion_pair', target: '{voice_one}', value: -12, params: { slotB: '{voice_two}', label: 'Standoff: defeated' } },
        ],
      },
      {
        id: 'favour_voice_two',
        label: 'Rule in favour of {voice_two.first}\'s faction.',
        description: `Their cause speaks to the settlement's deeper identity.`,
        consequences: [
          { type: 'modify_opinion', target: '{voice_two}', value: 15 },
          { type: 'modify_opinion', target: '{voice_one}', value: -15 },
          { type: 'modify_opinion_pair', target: '{voice_two}', value: -12, params: { slotB: '{voice_one}', label: 'Standoff: defeated' } },
        ],
      },
      {
        id: 'mediate',
        label: 'Mediate a compromise — take the hard middle road.',
        description: 'Neither faction gets everything. Both bear the cost of peace.',
        consequences: [
          { type: 'modify_opinion', target: '{voice_one}', value: -5 },
          { type: 'modify_opinion', target: '{voice_two}', value: -5 },
          { type: 'modify_opinion_pair', target: '{voice_one}', value: 3, params: { slotB: '{voice_two}', label: 'Shared compromise' } },
          { type: 'modify_cultural_blend', target: 'settlement', value: 0 },
        ],
      },
    ],
  },

];
