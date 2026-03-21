/**
 * Happiness & Morale crisis events — all four are injected programmatically by
 * the store (not drawn from the normal deck). They are included in ALL_EVENTS
 * so the resolver can look them up by ID.
 *
 * Injection triggers (handled in game-store.ts):
 *   hap_settler_considers_leaving  — per person whose lowHappinessTurns reaches 3
 *   hap_low_morale_warning         — when newLowMoraleTurns reaches 4
 *   hap_desertion_imminent         — when ≥ 3 persons have lowHappinessTurns ≥ 3
 *   hap_company_happiness_inquiry  — when newLowMoraleTurns reaches 8 (first time)
 */

import type { GameEvent } from '../engine';

export const HAPPINESS_EVENTS: GameEvent[] = [
  // ─────────────────────────────────────────────────────────────────────────────
  // Individual desertion — one specific unhappy settler
  // ─────────────────────────────────────────────────────────────────────────────

  {
    id: 'hap_settler_considers_leaving',
    title: 'Considering Their Options',
    category: 'domestic',
    isDeferredOutcome: true,   // never drawn; always injected by the store
    weight: 1,
    cooldown: 12,
    isUnique: false,
    actorRequirements: [
      { slot: 'settler', criteria: { minAge: 16 } },
    ],
    prerequisites: [],
    description:
      '{settler.He} has been quiet for days — the sort of quiet that means a ' +
      'decision has already been made. {settler.He} does not accuse or demand, ' +
      'only says, not unkindly, that {settler.he} has been thinking about leaving. ' +
      '{settler.His} reasons are {settler.his} own.',
    choices: [
      {
        id: 'address_concerns',
        label: 'Address the root of their unhappiness.',
        description:
          'Be generous with provisions and make {settler.his} life here materially ' +
          'better. It costs something, but losing a settler costs more.',
        consequences: [
          { type: 'modify_resource', target: 'food', value: -3 },
          { type: 'reset_low_happiness', target: '{settler}', value: 0 },
          { type: 'add_trait', target: '{settler}', value: 'inspired' },
        ],
      },
      {
        id: 'personal_appeal',
        label: 'Ask a respected councillor to speak with them privately.',
        description:
          'Sometimes what a person needs most is to feel heard. A good leader ' +
          'knows when to step aside and let someone else deliver the plea.',
        consequences: [],
        skillCheck: {
          skill: 'leadership',
          difficulty: 40,
          actorSelection: 'best_council',
          attemptLabel: 'Make a heartfelt appeal',
        },
        onSuccess: [
          { type: 'reset_low_happiness', target: '{settler}', value: 0 },
        ],
        onFailure: [
          { type: 'modify_resource', target: 'food', value: -1 },
        ],
      },
      {
        id: 'let_go_peacefully',
        label: 'Wish them well. Let them go in peace.',
        description:
          'The expedition is not a cage. {settler.He} leaves without rancour, ' +
          'with whatever possessions are {settler.his}. You will not see {settler.him} again.',
        consequences: [
          { type: 'remove_person', target: '{settler}', value: 0 },
          { type: 'modify_standing', target: 'company', value: -2 },
        ],
      },
      {
        id: 'dismiss_grievance',
        label: 'Their duty is here. They chose to come.',
        description:
          'You remind {settler.him} of the oath, the contract, the Company seal. ' +
          '{settler.He} looks at you a long moment — then turns and begins to pack anyway.',
        consequences: [
          { type: 'remove_person', target: '{settler}', value: 0 },
          { type: 'modify_standing', target: 'company', value: -5 },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // Settlement-level warning — elders voice collective discontent
  // ─────────────────────────────────────────────────────────────────────────────

  {
    id: 'hap_low_morale_warning',
    title: 'A Cloud Over the Settlement',
    category: 'domestic',
    isDeferredOutcome: true,
    weight: 1,
    cooldown: 0,
    isUnique: false,
    prerequisites: [],
    description:
      'The settlement has worn a grey face for too many seasons. Conversations ' +
      'trail off. Work gets done, but the heart has gone out of it. The older ' +
      'settlers — those who remember what it cost to get here — say nothing, which ' +
      'is the loudest kind of worry. Something needs to change.',
    choices: [
      {
        id: 'call_gathering',
        label: 'Call a community gathering. Speak plainly and feed them well.',
        description:
          'An evening of honest talk, shared food, and the reminder that you are ' +
          'all in this together. It costs resources, but it buys goodwill.',
        consequences: [
          { type: 'modify_resource', target: 'food', value: -4 },
          { type: 'modify_resource', target: 'wealth', value: -2 },
          { type: 'reset_low_morale', target: '', value: 0 },
        ],
      },
      {
        id: 'investigate_causes',
        label: 'Identify the core grievance and address it specifically.',
        description:
          'Throwing a feast masks the symptoms. Find out what is actually wrong ' +
          'and promise to fix it. The elders will watch to see if you follow through.',
        consequences: [
          { type: 'reset_low_morale', target: '', value: 0 },
        ],
      },
      {
        id: 'push_through',
        label: 'There is no time for sentiment. Keep working.',
        description:
          'The mission does not pause for morale. Every season of hardship is a ' +
          'season the settlement grows stronger — or so you have to believe.',
        consequences: [],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // Mass desertion warning — multiple settlers simultaneously unhappy
  // ─────────────────────────────────────────────────────────────────────────────

  {
    id: 'hap_desertion_imminent',
    title: 'A Collective Ultimatum',
    category: 'domestic',
    isDeferredOutcome: true,
    weight: 1,
    cooldown: 0,
    isUnique: true,
    actorRequirements: [
      { slot: 'spokesperson', criteria: { minAge: 16, minSkill: { skill: 'leadership', value: 1 } } },
    ],
    prerequisites: [],
    description:
      '{spokesperson.He} speaks for the others — there are enough of them now ' +
      'to fill the space behind {spokesperson.him} like a shadow. They are not ' +
      'issuing threats, {spokesperson.he} says carefully. They are telling you something ' +
      'true: if conditions do not improve, people will begin to leave. Several of ' +
      'them are already decided. The only question is how many follow.',
    choices: [
      {
        id: 'material_incentive',
        label: 'Compensate them materially — wealth, rations, a promise of better shelter.',
        description:
          'This buys time, not loyalty. But time is what you need to fix the ' +
          'underlying problems.',
        consequences: [
          { type: 'modify_resource', target: 'wealth', value: -5 },
          { type: 'modify_resource', target: 'food', value: -5 },
          { type: 'reset_low_morale', target: '', value: 0 },
        ],
      },
      {
        id: 'inspire_mission',
        label: 'Remind them why they came. Appeal to the mission itself.',
        description:
          'The expedition was never going to be comfortable. But what they are ' +
          'building here will matter — to their children, and their children\'s children.',
        consequences: [],
        skillCheck: {
          skill: 'leadership',
          difficulty: 55,
          actorSelection: 'best_council',
          attemptLabel: 'Rally the settlement',
        },
        onSuccess: [
          { type: 'reset_low_morale', target: '', value: 0 },
        ],
        onFailure: [
          { type: 'modify_standing', target: 'company', value: -3 },
        ],
      },
      {
        id: 'acknowledge_and_defer',
        label: 'Acknowledge the problem and pledge specific improvements.',
        description:
          'No resources spent now, but you are making a promise the settlement ' +
          'will remember. They will watch to see if you deliver.',
        consequences: [
          { type: 'reset_low_morale', target: '', value: 0 },
        ],
      },
      {
        id: 'do_nothing',
        label: 'Tell them the settlement comes first. Individual feelings must wait.',
        description:
          'You have heard what they said. You will not be moved by it. ' +
          'The reckoning, when it comes, will be sharper for this moment.',
        consequences: [
          { type: 'modify_standing', target: 'company', value: -3 },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // Company inquiry — the Company has heard about the poor conditions
  // ─────────────────────────────────────────────────────────────────────────────

  {
    id: 'hap_company_happiness_inquiry',
    title: 'A Letter from the Company',
    category: 'company',
    isDeferredOutcome: true,
    weight: 1,
    cooldown: 0,
    isUnique: false,
    prerequisites: [],
    description:
      'The Company letter is formal in tone, which is its own kind of message. ' +
      'Reports have reached the home office — from returning supply ships, from ' +
      'letters written by settlers themselves — suggesting that morale in the ' +
      'expedition has fallen to a level that concerns them. They wish to be ' +
      'reassured. The phrasing is polite. The subtext is not.',
    choices: [
      {
        id: 'honest_report',
        label: 'Send an honest account. Conditions have been difficult.',
        description:
          'Honesty costs standing — the Company does not like problems — but ' +
          'it is remembered. And they may help if you ask plainly enough.',
        consequences: [
          { type: 'modify_standing', target: 'company', value: -5 },
          { type: 'reset_low_morale', target: '', value: 0 },
        ],
      },
      {
        id: 'reassure_them',
        label: 'Reassure them that the reports are exaggerated.',
        description:
          'The Company hears what it wants to hear, most of the time. ' +
          'Most of the time.',
        consequences: [],
        skillCheck: {
          skill: 'bargaining',
          difficulty: 50,
          actorSelection: 'best_council',
          attemptLabel: 'Compose a convincing report',
        },
        onSuccess: [],
        onFailure: [
          { type: 'modify_standing', target: 'company', value: -10 },
        ],
      },
      {
        id: 'blame_conditions',
        label: 'Cite the harsh seasons and the difficulty of the region.',
        description:
          'External factors. Forces beyond your control. It is not entirely untrue, ' +
          'which makes it easier to write.',
        consequences: [
          { type: 'modify_standing', target: 'company', value: -2 },
        ],
      },
    ],
  },
];
