/**
 * Household events — thrall acquisition, social elevation, informal unions,
 * and wife-council tensions.
 *
 * These events presuppose the household data layer (Phase 3.5) and reference
 * consequence types: set_social_status, set_household_role, clear_household.
 */

import type { GameEvent } from '../engine';

export const HOUSEHOLD_EVENTS: GameEvent[] = [
  // ─── Thrall offer ─────────────────────────────────────────────────────────

  {
    id: 'hh_tribal_thrall_offer',
    title: 'A Captive Offered',
    category: 'domestic',
    prerequisites: [
      { type: 'has_building', params: { buildingId: 'trading_post' } },
      { type: 'min_year',     params: { value: 2 } },
    ],
    weight: 2,
    cooldown: 12,
    isUnique: false,
    description:
      'A trader from a neighbouring band arrives with a young woman in tow — ' +
      'not a slave in the lowland sense, but a captive without clan, kin, or ' +
      'language. He names a price in goods and waits, reading your face. She ' +
      'watches the ground and says nothing.',
    choices: [
      {
        id: 'purchase',
        label: 'Pay the price. She will have a place here.',
        description:
          'The goods change hands. She joins the settlement as a thrall — ' +
          'landless, without formal standing, but under your roof and protection.',
        consequences: [
          { type: 'modify_resource', target: 'goods', value: -5 },
          {
            type: 'add_person',
            target: 'thrall_woman',
            value: 1,
            params: {
              sex: 'female',
              ethnicGroup: 'kiswani_riverfolk',
              minAge: 17,
              maxAge: 30,
              socialStatus: 'thrall',
            },
          },
        ],
      },
      {
        id: 'refuse',
        label: 'Send him away. We have no use for captives.',
        description: 'The trader shrugs and leaves. The woman disappears with him into the reeds.',
        consequences: [],
      },
    ],
  },

  // ─── Thrall elevation ─────────────────────────────────────────────────────

  {
    id: 'hh_thrall_elevation',
    title: 'She Has Earned Her Place',
    category: 'domestic',
    prerequisites: [
      { type: 'has_person_matching', params: { socialStatus: 'thrall', sex: 'female' } },
      { type: 'min_year', params: { value: 3 } },
    ],
    actorRequirements: [
      {
        slot: 'thrall',
        criteria: { socialStatus: 'thrall', sex: 'female' },
        required: true,
      },
    ],
    weight: 2,
    cooldown: 16,
    isUnique: false,
    description:
      '{thrall} has lived among you now for two full seasons. She has learned ' +
      'your tongue, carried her share and more, and kept her own counsel. ' +
      'Some of your people call her by name without hesitation. Others still ' +
      'see only the brand of the captive. A decision about her standing cannot ' +
      'be deferred much longer without becoming a statement in itself.',
    choices: [
      {
        id: 'free_her',
        label: 'Grant {thrall.first} her freedom. Let her stand as a newcomer.',
        description:
          'You declare {thrall.she} free — no debt, no obligation. ' +
          'The older Sauromatian women witness it. {thrall.She} weeps, once, quietly.',
        consequences: [
          { type: 'set_social_status', target: '{thrall}', value: 'newcomer' },
        ],
      },
      {
        id: 'keep_status',
        label: 'Her standing remains what it is for now.',
        description:
          'Nothing changes on paper. But the settlement has heard the question asked, ' +
          'and everyone now knows you chose not to answer it.',
        consequences: [],
      },
    ],
  },
  // ─── Wife-council events ──────────────────────────────────────────────────

  {
    id: 'hh_wife_council_demands',
    title: 'The Women Have Spoken',
    category: 'domestic',
    prerequisites: [
      { type: 'has_multi_wife_household', params: {} },
      { type: 'min_year', params: { value: 2 } },
    ],
    actorRequirements: [
      {
        slot: 'spokeswoman',
        criteria: { sex: 'female', householdRole: 'senior_wife' },
        required: true,
      },
    ],
    weight: 3,
    cooldown: 10,
    isUnique: false,
    description:
      '{spokeswoman.first} comes to you on behalf of the wife-council — the women ' +
      'who share a hearth and have learned to govern it together. Their request ' +
      'is simple and not unreasonable: an extra allocation of goods for the ' +
      'winter celebrations, and the right to settle small disputes within ' +
      'the household without bringing every quarrel to you. {spokeswoman.She} ' +
      'meets your eyes and waits.',
    choices: [
      {
        id: 'concede',
        label: 'Grant the request. The household runs better when they trust you.',
        description:
          'The goods change hands. The women nod and say nothing more. ' +
          'You notice the household is quieter in the following weeks — in a good way.',
        consequences: [
          { type: 'modify_resource', target: 'goods', value: -4 },
          { type: 'modify_opinion', target: '{spokeswoman}', value: 8 },
        ],
      },
      {
        id: 'negotiate',
        label: 'Discuss it. Some asks are reasonable; others require limits.',
        description:
          'You sit with {spokeswoman.first} for an hour. She is shrewder than ' +
          'you gave her credit for. You reach a working arrangement.',
        consequences: [
          { type: 'modify_resource', target: 'goods', value: -2 },
          { type: 'modify_opinion', target: '{spokeswoman}', value: 4 },
        ],
        skillCheck: {
          skill: 'diplomacy',
          difficulty: 40,
          actorSelection: 'best_council',
          attemptLabel: 'Negotiate terms',
        },
        onSuccess: [
          { type: 'modify_opinion', target: '{spokeswoman}', value: 5 },
        ],
        onFailure: [
          { type: 'modify_opinion', target: '{spokeswoman}', value: -5 },
        ],
      },
      {
        id: 'refuse',
        label: 'The household structure is not for them to decide.',
        description:
          '{spokeswoman.first} nods once and leaves. ' +
          'You hear nothing more — for now.',
        consequences: [
          { type: 'modify_opinion', target: '{spokeswoman}', value: -10 },
        ],
      },
    ],
  },

  {
    id: 'hh_tradition_clash',
    title: 'Two Ways of Keeping a Home',
    category: 'cultural',
    prerequisites: [
      { type: 'has_multi_wife_household', params: {} },
      { type: 'min_year', params: { value: 3 } },
    ],
    actorRequirements: [
      {
        slot: 'senior',
        criteria: { sex: 'female', householdRole: 'senior_wife' },
        required: true,
      },
      {
        slot: 'newcomer',
        criteria: { sex: 'female', householdRole: 'wife' },
        required: true,
      },
    ],
    weight: 2,
    cooldown: 14,
    isUnique: false,
    description:
      'There is a rift in the household. {senior.first} and {newcomer.first} ' +
      'manage the space according to traditions that do not agree — different ' +
      'forms of prayer, different ways of cooking the morning meal, different ' +
      'opinions on which children sleep where. They are not enemies. ' +
      'But the friction is wearing, and others in the settlement have started ' +
      'to notice the chill between them.',
    choices: [
      {
        id: 'support_senior',
        label: "Back {senior.first}'s authority. Seniority must mean something.",
        description:
          'You make your position clear. {senior.first} manages the household. ' +
          '{newcomer.first} adapts or finds her own way. The tension does not ' +
          'disappear, but it finds a shape.',
        consequences: [
          { type: 'modify_opinion', target: '{senior}', value: 6 },
          { type: 'modify_opinion', target: '{newcomer}', value: -8 },
        ],
      },
      {
        id: 'find_common_ground',
        label: 'Help them find a shared practice that both can live with.',
        description:
          'You spend an evening with both women and a good fire. ' +
          'By the end of it, something small and workable has been agreed. ' +
          'The creole is richer for it.',
        consequences: [
          { type: 'modify_opinion', target: '{senior}', value: 3 },
          { type: 'modify_opinion', target: '{newcomer}', value: 3 },
        ],
        skillCheck: {
          skill: 'diplomacy',
          difficulty: 50,
          actorSelection: 'best_council',
          attemptLabel: 'Bridge the gap',
        },
        onSuccess: [
          { type: 'modify_opinion', target: '{senior}', value: 4 },
          { type: 'modify_opinion', target: '{newcomer}', value: 4 },
        ],
        onFailure: [],
      },
      {
        id: 'leave_it_alone',
        label: 'This is their household. Let them sort it out without you.',
        description:
          "Time passes. They find a working distance, if not warmth. " +
          "Households have survived worse.",
        consequences: [],
      },
    ],
  },

  {
    id: 'hh_ashka_melathi_deepens',
    title: 'A Bond the Settlement Notices',
    category: 'cultural',
    prerequisites: [
      { type: 'has_ashka_melathi_bond', params: {} },
      { type: 'min_year', params: { value: 3 } },
    ],
    actorRequirements: [
      {
        slot: 'bondedA',
        criteria: { sex: 'female', householdRole: 'senior_wife' },
        required: true,
      },
    ],
    weight: 2,
    cooldown: 16,
    isUnique: false,
    description:
      'The ashka-melathi bond between {bondedA.first} and her co-wife has become ' +
      'something the whole settlement takes note of. They finish each other\'s ' +
      'sentences. They divide the hard work without argument. When one is sick, ' +
      'the other becomes fierce. The older Sauromatian women watch this with ' +
      'something like approval. Some of the Imanian men look less certain.',
    choices: [
      {
        id: 'honour_bond',
        label: 'Acknowledge the ashka-melathi. It is part of what holds this household together.',
        description:
          'You speak of it at the evening fire without embarrassment. ' +
          'The Sauromatian women approve. The bond strengthens the household and, ' +
          'by extension, the settlement.',
        consequences: [
          { type: 'modify_opinion', target: '{bondedA}', value: 10 },
          { type: 'modify_resource', target: 'goods', value: 2 },
        ],
      },
      {
        id: 'say_nothing',
        label: 'Let the matter speak for itself. Silence is its own statement.',
        description:
          'Nothing is said. The bond continues. The settlement takes its cue from you.',
        consequences: [
          { type: 'modify_opinion', target: '{bondedA}', value: 3 },
        ],
      },
    ],
  },

  // ─── Keth-Thara service ends ──────────────────────────────────────────────

  {
    id: 'hh_keth_thara_service_ends',
    title: 'He Returns from Service',
    category: 'domestic',
    prerequisites: [],
    actorRequirements: [
      {
        slot: 'youth',
        criteria: { sex: 'male' },
        required: true,
      },
    ],
    weight: 1, // Deferred-only — only fires via scheduled queue, not random draw
    cooldown: 0,
    isUnique: false,
    description:
      '{youth.first} has completed his time of Keth-Thara service — the season ' +
      'of wandering and labour that tradition demands of young men before they ' +
      'may claim a hearth. He stands at the edge of camp, leaner than he left, ' +
      'with a quiet stillness that was not there before. The settlement watches ' +
      'to see what you will make of his return.',
    choices: [
      {
        id: 'welcome_back',
        label: 'Welcome him back. Assign him where he is needed.',
        description:
          '{youth.first} takes up his old duties without complaint. ' +
          'He has fulfilled what was asked of him.',
        consequences: [],
      },
      {
        id: 'honour_service',
        label: 'Mark his return publicly. He has earned his standing.',
        description:
          'You speak his name at the evening fire and acknowledge what he has done. ' +
          'The Sauromatian women nod. {youth.He} will be remembered for this.',
        consequences: [
          { type: 'modify_opinion', target: '{youth}', value: 10 },
        ],
      },
    ],
  },
];
