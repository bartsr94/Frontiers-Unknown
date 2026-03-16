/**
 * Wedding & matchmaking events.
 *
 * These events let elders, household heads, and parents arrange marriages
 * autonomously — covering the common scenario where younger settlers cannot
 * initiate courtship themselves (no seek_spouse ambition, low opinion scores,
 * etc.).  The three events together ensure marriages happen reliably across all
 * stages of a settlement's life:
 *
 *   dom_elder_arranges_match      — early game; no family tree required
 *   dom_father_arranges_sons_match  — mid/late; household head + son
 *   dom_mother_arranges_daughters_match — mid/late; mother + daughter
 */

import type { GameEvent } from '../engine';

export const WEDDING_EVENTS: GameEvent[] = [

  // ── Elder-brokered match ─────────────────────────────────────────────────

  {
    id: 'dom_elder_arranges_match',
    title: 'The Elder Speaks',
    category: 'domestic',
    prerequisites: [],
    actorRequirements: [
      {
        slot: 'elder',
        criteria: { minAge: 35 },
      },
      {
        slot: 'groom',
        criteria: { sex: 'male', minAge: 18, maritalStatus: 'unmarried' },
      },
      {
        slot: 'bride',
        criteria: { sex: 'female', minAge: 16, maritalStatus: 'unmarried' },
      },
    ],
    weight: 3,
    cooldown: 8,
    isUnique: false,
    description:
      '{elder} has been watching. Watching who works beside whom without complaint, ' +
      'who lingers at the fire when the others have gone. {elder.He} takes you aside ' +
      'with the particular gravity of someone about to say something they will not ' +
      'unsay: {groom} and {bride} suit each other, and the settlement needs families. ' +
      'It is time.',
    choices: [
      {
        id: 'arrange_it',
        label: "Arrange the match \u2014 the elder's eye is rarely wrong.",
        description:
          'A marriage between {groom} and {bride}. {elder} officiates. ' +
          'The settlement gains a household.',
        consequences: [
          { type: 'perform_marriage', target: '{groom}', params: { partnerSlot: '{bride}' } },
          { type: 'modify_opinion', target: '{groom}', value: 10 },
          { type: 'modify_opinion', target: '{bride}', value: 10 },
          { type: 'modify_opinion', target: '{elder}', value: 5 },
        ],
      },
      {
        id: 'let_them_decide',
        label: 'A kind thought, but let them arrange their own affairs.',
        description:
          'You decline to intervene. {elder} nods, unconvinced, and says nothing more.',
        consequences: [
          { type: 'modify_opinion', target: '{elder}', value: -5 },
        ],
      },
      {
        id: 'refuse_outright',
        label: 'These two are more useful as free workers than as spouses.',
        description:
          '{elder} bows to your judgment, but the warmth between you cools a little.',
        consequences: [
          { type: 'modify_opinion', target: '{elder}', value: -15 },
        ],
      },
    ],
  },

  // ── Father arranges son's match ──────────────────────────────────────────

  {
    id: 'dom_father_arranges_sons_match',
    title: "A Father's Duty",
    category: 'domestic',
    prerequisites: [],
    actorRequirements: [
      {
        slot: 'father',
        criteria: { sex: 'male', minAge: 36, householdRole: 'head' },
      },
      {
        slot: 'son',
        criteria: { sex: 'male', minAge: 18, maritalStatus: 'unmarried', childOfSlot: 'father' },
      },
      {
        slot: 'bride',
        criteria: { sex: 'female', minAge: 16, maritalStatus: 'unmarried' },
      },
    ],
    weight: 3,
    cooldown: 10,
    isUnique: false,
    description:
      '{father} has come on behalf of {son}. The boy is old enough, he says, and ' +
      'the family has stood long enough without new blood. {father.He} has his eye ' +
      'on {bride.first} — skilled, steady, with no entanglements — and would have ' +
      'your blessing before either young person is spoken to.',
    choices: [
      {
        id: 'give_blessing',
        label: 'Give your blessing. A good match for both families.',
        description:
          '{father} bows and goes to make the arrangements. Within a season, ' +
          '{son} and {bride} stand before the settlement as husband and wife.',
        consequences: [
          { type: 'perform_marriage', target: '{son}', params: { partnerSlot: '{bride}' } },
          { type: 'modify_opinion', target: '{father}', value: 12 },
          { type: 'modify_opinion', target: '{son}', value: 8 },
          { type: 'modify_opinion', target: '{bride}', value: 6 },
        ],
      },
      {
        id: 'suggest_delay',
        label: 'Not yet — {son.first} should prove himself further first.',
        description:
          '{father} accepts the delay. {son.He} will wait, though perhaps not quietly.',
        consequences: [
          { type: 'modify_opinion', target: '{father}', value: -8 },
          { type: 'modify_opinion', target: '{son}', value: -5 },
        ],
      },
      {
        id: 'wrong_match',
        label: 'Perhaps — but not {bride.first}. The settlement has other needs from her.',
        description:
          '{father} withdraws the suggestion with tight courtesy. Weeks pass before ' +
          'he raises the matter again.',
        consequences: [
          { type: 'modify_opinion', target: '{father}', value: -10 },
        ],
      },
    ],
  },

  // ── Mother arranges daughter's match ─────────────────────────────────────

  {
    id: 'dom_mother_arranges_daughters_match',
    title: "A Mother's Arrangement",
    category: 'domestic',
    prerequisites: [],
    actorRequirements: [
      {
        slot: 'mother',
        criteria: { sex: 'female', minAge: 34 },
      },
      {
        slot: 'daughter',
        criteria: { sex: 'female', minAge: 16, maritalStatus: 'unmarried', childOfSlot: 'mother' },
      },
      {
        slot: 'suitor',
        criteria: { sex: 'male', minAge: 18, maritalStatus: 'unmarried' },
      },
    ],
    weight: 3,
    cooldown: 10,
    isUnique: false,
    description:
      '{mother} finds you between tasks and speaks quietly, the way people do when ' +
      'they know their request might be refused. {daughter} is of age, she says, and ' +
      '{suitor} has proven himself patient and capable. The seasons will not wait. ' +
      '{mother.She} is not asking for permission — she is asking you to see what she sees.',
    choices: [
      {
        id: 'approve_match',
        label: "Approve it. A mother's eye for such things is worth trusting.",
        description:
          '{mother} nods once, satisfied. The match is made with quiet ceremony, ' +
          'and {daughter} and {suitor} begin building a life beside each other.',
        consequences: [
          { type: 'perform_marriage', target: '{daughter}', params: { partnerSlot: '{suitor}' } },
          { type: 'modify_opinion', target: '{mother}', value: 12 },
          { type: 'modify_opinion', target: '{daughter}', value: 8 },
          { type: 'modify_opinion', target: '{suitor}', value: 6 },
        ],
      },
      {
        id: 'ask_daughters_wish',
        label: 'Let {daughter.first} speak for herself first.',
        description:
          '{mother} is quiet for a moment. Then: \'She will say yes. But very well — ' +
          'ask her.\' Nothing changes, but the asking takes time.',
        consequences: [
          { type: 'modify_opinion', target: '{mother}', value: -5 },
          { type: 'modify_opinion', target: '{daughter}', value: 5 },
        ],
      },
      {
        id: 'decline',
        label: '{daughter.first} is valuable where she is. Not yet.',
        description:
          '{mother} leaves without argument, which is its own kind of reproach.',
        consequences: [
          { type: 'modify_opinion', target: '{mother}', value: -12 },
          { type: 'modify_opinion', target: '{daughter}', value: -5 },
        ],
      },
    ],
  },
];
