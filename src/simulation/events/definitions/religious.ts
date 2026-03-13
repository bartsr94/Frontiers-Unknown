/**
 * Religious events — faith tensions, conversions, and the Hidden Wheel emergence.
 *
 * These events are driven by the settlement's religious composition, the
 * religious tension formula, and the Hidden Wheel divergence counter.
 *
 * Several events (rel_hidden_wheel_emerges, rel_company_concern_letter) are
 * flagged isDeferredOutcome:true and injected programmatically by the store;
 * they never appear in normal random draws.
 */

import type { GameEvent } from '../engine';

export const RELIGIOUS_EVENTS: GameEvent[] = [

  // ── Programmatic injections ────────────────────────────────────────────────

  {
    id: 'rel_hidden_wheel_emerges',
    title: 'A Third Way',
    category: 'cultural',
    prerequisites: [],
    weight: 1,
    cooldown: 0,
    isUnique: true,
    isDeferredOutcome: true,
    description:
      'People have lived side by side here long enough that something new has grown between ' +
      'the prayers. You hear it in the way Wheel-women speak of "the Sun-Wheel" and in the way ' +
      'Orthodox settlers invoke "Keth-Solim" without knowing what it means. Something is asking ' +
      'to exist.',
    choices: [
      {
        id: 'recognize',
        label: 'Let it grow — this is our own faith.',
        description:
          'Give the Hidden Wheel formal standing. It will spread freely and may draw Company scrutiny.',
        consequences: [
          { type: 'set_religious_policy', target: '', value: 'hidden_wheel_recognized' },
          // set_religious_policy with 'hidden_wheel_recognized' also sets hiddenWheelEmerged:true
        ],
      },
      {
        id: 'acknowledge',
        label: 'Acknowledge it, but do not formalise it.',
        description:
          'You will not suppress what is happening, but you will not name it either. It spreads slowly.',
        consequences: [
          { type: 'set_hidden_wheel_emerged', target: '', value: true },
        ],
      },
      {
        id: 'suppress',
        label: 'Suppress it — the Company would not approve.',
        description:
          'Freeze the clock for seven years. The Company appreciates the gesture.',
        consequences: [
          { type: 'set_hidden_wheel_suppressed', target: '', value: 30 },
          { type: 'modify_standing', target: 'company', value: 1 },
        ],
      },
    ],
  },

  {
    id: 'rel_company_concern_letter',
    title: 'The Company Notes Your Spiritual Condition',
    category: 'company',
    prerequisites: [],
    weight: 1,
    cooldown: 0,
    isUnique: false,
    isDeferredOutcome: true,
    description:
      'The annual dispatch includes a note from a Company secretary. Your expedition\'s spiritual ' +
      'condition has been noted among the directors. The letter is polite. The implication is not.',
    choices: [
      {
        id: 'census_report',
        label: 'Send back an Orthodox census report.',
        description:
          'A creative accounting of your faithful. Unlikely to bear close scrutiny — but it buys time.',
        consequences: [
          { type: 'modify_standing', target: 'company', value: 2 },
        ],
      },
      {
        id: 'acknowledge_normalise',
        label: 'Acknowledge the concern and promise gradual normalisation.',
        description:
          'The diplomatic answer. The Company notes it with satisfaction. What you actually do is your business.',
        consequences: [],
      },
      {
        id: 'defy',
        label: 'Respond defiantly — this is a frontier matter.',
        description:
          'This will be remembered. But the drain is paused for a time.',
        consequences: [
          { type: 'modify_standing', target: 'company', value: -2 },
        ],
      },
    ],
  },

  // ── Conversion events ──────────────────────────────────────────────────────

  {
    id: 'rel_wheel_conversion_moment',
    title: 'An Orthodox Settler Is Moved',
    category: 'cultural',
    prerequisites: [
      { type: 'has_person_matching', params: { religion: 'imanian_orthodox' } },
      { type: 'religion_fraction_above', params: { religion: 'sacred_wheel', threshold: 0.30 } },
    ],
    actorRequirements: [
      {
        slot: 'convert',
        criteria: { religion: 'imanian_orthodox', minAge: 18 },
      },
    ],
    weight: 2,
    cooldown: 10,
    isUnique: false,
    description:
      '{convert} has been watching the Wheel ceremonies at the river for two seasons. ' +
      'You have noticed {convert.him} bringing small offerings before dawn. ' +
      '{convert.He} comes to you, uncertain — not asking permission exactly, but looking for a sign ' +
      'of whether this place has room for what {convert.he} is becoming.',
    choices: [
      {
        id: 'encourage',
        label: 'Encourage the change.',
        description:
          'This settlement makes its own traditions. Let them find their own gods here.',
        consequences: [
          { type: 'modify_religion', target: '{convert}', value: 'sacred_wheel' },
        ],
      },
      {
        id: 'patience',
        label: 'Advise patience — you will not forbid it, but say nothing more.',
        description:
          'An open door, not a welcome. What happens next is between them and the river.',
        consequences: [],
      },
      {
        id: 'discourage',
        label: 'Discourage it — the Company expects Orthodoxy.',
        description:
          'They are disappointed, but they stay. The distance between you both grows a little.',
        consequences: [
          { type: 'modify_opinion', target: '{convert}', value: -5 },
        ],
      },
    ],
  },

  {
    id: 'rel_orthodoxy_crisis_of_faith',
    title: 'Doubt at the Edge of the World',
    category: 'cultural',
    prerequisites: [
      { type: 'has_person_matching', params: { religion: 'sacred_wheel', sex: 'female' } },
      { type: 'religion_fraction_above', params: { religion: 'imanian_orthodox', threshold: 0.40 } },
      { type: 'min_year', params: { value: 3 } },
    ],
    actorRequirements: [
      {
        slot: 'believer',
        criteria: { religion: 'sacred_wheel', sex: 'female', minAge: 16 },
      },
    ],
    weight: 2,
    cooldown: 10,
    isUnique: false,
    description:
      '{believer} was raised to the Wheel, but she has been living beside the Solar settlers for years. ' +
      'She tells you the Imanian prayers have begun to feel like hers too. The Sun\'s warmth is the ' +
      'same warmth Kethara promised. She is not asking to convert. She is asking what you think it means.',
    choices: [
      {
        id: 'let_her_choose',
        label: 'Let her find her own path.',
        description:
          'What a person believes is between them and the sky. You will not intercede.',
        consequences: [
          { type: 'modify_religion', target: '{believer}', value: 'imanian_orthodox' },
        ],
      },
      {
        id: 'introduce_formally',
        label: 'Introduce her to the Solar Church formally.',
        description:
          'Make the change deliberate. The Company approves of these quiet victories.',
        consequences: [
          { type: 'modify_religion', target: '{believer}', value: 'imanian_orthodox' },
          { type: 'modify_standing', target: 'company', value: 1 },
        ],
      },
      {
        id: 'remind_wheel',
        label: 'Remind her of what the Wheel means.',
        description:
          'The Sun has many faces. The Wheel already knows them.',
        consequences: [
          { type: 'modify_opinion', target: '{believer}', value: 5 },
        ],
      },
    ],
  },

  {
    id: 'rel_hidden_wheel_adoption',
    title: 'Walking Both Paths',
    category: 'cultural',
    prerequisites: [
      { type: 'hidden_wheel_emerged', params: {} },
      {
        type: 'has_person_matching',
        params: { minAge: 16 },
      },
    ],
    actorRequirements: [
      {
        slot: 'seeker',
        criteria: { minAge: 16 },
      },
    ],
    weight: 2,
    cooldown: 8,
    isUnique: false,
    description:
      '{seeker} has quietly stopped attending morning prayers — but hasn\'t gone to the river either. ' +
      '{seeker.He} is making something new. You have heard {seeker.him} borrowing words from both ' +
      'traditions, fitting them together in ways neither side would fully recognise.',
    choices: [
      {
        id: 'welcome',
        label: 'Welcome this — something true is being made here.',
        description:
          'The Hidden Wheel grows when people are not afraid to tend it.',
        consequences: [
          { type: 'modify_religion', target: '{seeker}', value: 'syncretic_hidden_wheel' },
          { type: 'modify_opinion', target: '{seeker}', value: 8 },
        ],
      },
      {
        id: 'no_interference',
        label: 'Do not interfere.',
        description:
          'Leave it alone. What grows in private is often stronger for it.',
        consequences: [
          { type: 'modify_religion', target: '{seeker}', value: 'syncretic_hidden_wheel' },
        ],
      },
      {
        id: 'pull_back',
        label: 'Pull them back to the tradition they were raised in.',
        description:
          'The devout in each tradition will be reassured. {seeker} will be deeply unhappy.',
        consequences: [
          { type: 'modify_opinion', target: '{seeker}', value: -10 },
        ],
      },
    ],
  },

  {
    id: 'rel_chaplain_arrives',
    title: 'A Chaplain on the Company Ship',
    category: 'company',
    prerequisites: [
      { type: 'season_is', params: { season: 'summer' } },
      { type: 'religion_fraction_below', params: { religion: 'imanian_orthodox', threshold: 0.50 } },
    ],
    actorRequirements: [
      {
        slot: 'wheel_follower',
        criteria: { religion: 'sacred_wheel', minAge: 18 },
      },
    ],
    weight: 2,
    cooldown: 16,
    isUnique: false,
    description:
      'The Company has sent a man of the cloth aboard this year\'s ship. Brother Aldren is here to ' +
      'minister to his straying flock — and he is examining your settlement\'s headcount with ' +
      'professional concern. He asks to speak with the people directly.',
    choices: [
      {
        id: 'welcome_work',
        label: 'Welcome him and let him work.',
        description:
          'The Company will be pleased. Some among the Wheel faithful may not.',
        consequences: [
          { type: 'modify_religion', target: '{wheel_follower}', value: 'imanian_orthodox' },
          { type: 'modify_standing', target: 'company', value: 3 },
        ],
      },
      {
        id: 'quarters_shield',
        label: 'Give him quarters but keep him away from the ceremonies.',
        description:
          'He will leave dissatisfied. The Company notes it, but only quietly.',
        consequences: [
          { type: 'modify_standing', target: 'company', value: 1 },
        ],
      },
      {
        id: 'send_back',
        label: 'Send him back on the ship.',
        description:
          'He will report what he saw. There will be a letter.',
        consequences: [
          { type: 'modify_standing', target: 'company', value: -3 },
        ],
      },
    ],
  },

  {
    id: 'rel_tension_eruption',
    title: 'It Comes to a Head',
    category: 'cultural',
    prerequisites: [
      { type: 'religious_tension_above', params: { threshold: 0.75 } },
    ],
    weight: 3,
    cooldown: 12,
    isUnique: false,
    description:
      'A Solar prayer service and a Wheel ceremony were scheduled for the same morning. No one ' +
      'intended it. The confrontation was physical. Two people were hurt. The settlement is waiting ' +
      'to see what you do.',
    choices: [
      {
        id: 'separate_days',
        label: 'Declare formal separation of worship days.',
        description:
          'A structural solution. Tension drops and both sides have space.',
        consequences: [],
        // Note: tension is recomputed from religion fractions; the event itself does not
        // reduce tension directly. The structural separation is flavour; consider adding
        // a settlement-level flag in a future pass to modify the tension formula.
      },
      {
        id: 'back_solar',
        label: 'Back the Solar Church publicly.',
        description:
          'Half the settlement is satisfied. The other half will remember.',
        consequences: [
          { type: 'modify_standing', target: 'company', value: 2 },
        ],
      },
      {
        id: 'back_wheel',
        label: 'Back the Wheel practitioners publicly.',
        description:
          'The Sauromatian women are reassured. The Company will hear of it.',
        consequences: [
          { type: 'modify_standing', target: 'company', value: -2 },
        ],
      },
      {
        id: 'do_nothing',
        label: 'Call it an accident and do nothing.',
        description:
          'No cost now. No resolution either.',
        consequences: [],
      },
    ],
  },

];
