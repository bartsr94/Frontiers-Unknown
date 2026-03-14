/**
 * Scheme events — player-facing consequences of character private schemes.
 *
 * Six events. All bind at least a `schemer` actor slot.
 * Two are silent-progression notifications; four are climactic player decisions.
 *
 * Event IDs:
 *   sch_courtship_discovered   — scheme_court_person reaches 1.0
 *   sch_faith_advocacy_noticed — scheme_convert_faith reaches 0.45 (early warning)
 *   sch_conversion_complete    — scheme_convert_faith reaches 1.0
 *   sch_rumours_spreading      — scheme_undermine_person reaches 0.5 (mid-point)
 *   sch_undermining_climax     — scheme_undermine_person reaches 1.0
 *   sch_tutor_breakthrough     — scheme_tutor_person reaches 1.0 (notification)
 */

import type { GameEvent } from '../engine';

export const SCHEME_EVENTS: GameEvent[] = [

  // ── Courtship discovered ────────────────────────────────────────────────────

  {
    id: 'sch_courtship_discovered',
    title: 'A Heart Revealed',
    category: 'personal',
    prerequisites: [],
    actorRequirements: [
      { slot: 'schemer', criteria: { minAge: 16 } },
      { slot: 'beloved', criteria: { minAge: 16 } },
    ],
    weight: 3,
    cooldown: 0,
    isUnique: false,
    isDeferredOutcome: true,
    description:
      'Word has reached you that {schemer} has been quietly courting {beloved.first}. ' +
      'The attention has been noticed — {beloved.he} seems {beloved.he === "he" ? "flattered" : "flattered"}, though not yet sure what to make of it. ' +
      'How do you respond to this development?',
    choices: [
      {
        id: 'encourage',
        label: 'Encourage the courtship.',
        description: 'A match may well come of this. Give it your blessing.',
        consequences: [
          { type: 'modify_opinion', target: '{schemer}', value: 5 },
          { type: 'modify_opinion', target: '{beloved}', value: 5 },
          { type: 'modify_opinion_pair', target: '{schemer}', value: 8, params: { slotB: '{beloved}', label: 'Courtship blessed' } },
        ],
      },
      {
        id: 'arrange_formally',
        label: 'Formalise the arrangement.',
        description: 'Turn this courtship into a settlement matter — arrange a proper union.',
        consequences: [
          { type: 'modify_opinion', target: '{schemer}', value: 10 },
          { type: 'modify_opinion', target: '{beloved}', value: 10 },
        ],
      },
      {
        id: 'discourage',
        label: 'Discourage it — the timing is wrong.',
        description: 'The settlement has other priorities right now.',
        consequences: [
          { type: 'modify_opinion', target: '{schemer}', value: -10 },
        ],
      },
    ],
  },

  // ── Faith advocacy noticed ──────────────────────────────────────────────────

  {
    id: 'sch_faith_advocacy_noticed',
    title: 'Whispers of the Faith',
    category: 'cultural',
    prerequisites: [],
    actorRequirements: [
      { slot: 'advocate', criteria: { minAge: 16 } },
      { slot: 'listener', criteria: { minAge: 16 } },
    ],
    weight: 3,
    cooldown: 0,
    isUnique: false,
    isDeferredOutcome: true,
    description:
      '{advocate} has been speaking quietly with {listener.first} about matters of faith. ' +
      'Nothing public yet — but those who pay attention have noticed. ' +
      'The persuasion seems genuine rather than coercive. What is your stance?',
    choices: [
      {
        id: 'allow_openly',
        label: 'Allow it openly — faith is a private matter.',
        description: 'No interference. Let conscience lead.',
        consequences: [
          { type: 'modify_opinion', target: '{advocate}', value: 5 },
        ],
      },
      {
        id: 'warn_discreet',
        label: 'Warn them to be discreet.',
        description: 'Continue if they must, but quietly. The Company watches.',
        consequences: [
          { type: 'modify_opinion', target: '{advocate}', value: -3 },
        ],
      },
      {
        id: 'forbid',
        label: 'Forbid the advocacy entirely.',
        description: 'The settlement cannot afford religious friction right now.',
        consequences: [
          { type: 'modify_opinion', target: '{advocate}', value: -15 },
          { type: 'modify_opinion', target: '{listener}', value: -5 },
          { type: 'clear_scheme', target: '{advocate}', value: 0 },
        ],
      },
    ],
  },

  // ── Conversion complete ─────────────────────────────────────────────────────

  {
    id: 'sch_conversion_complete',
    title: 'Changed by Belief',
    category: 'cultural',
    prerequisites: [],
    actorRequirements: [
      { slot: 'advocate', criteria: { minAge: 16 } },
      { slot: 'convert',  criteria: { minAge: 16 } },
    ],
    weight: 4,
    cooldown: 0,
    isUnique: false,
    isDeferredOutcome: true,
    description:
      '{convert.first} has changed {convert.his} faith. For months {advocate} has spoken with {convert.him} ' +
      'about the nature of the divine, and something shifted. {convert.first} now speaks openly of ' +
      '{advocate.his} tradition as {convert.his} own. What do you make of this?',
    choices: [
      {
        id: 'accept',
        label: 'Accept the conversion — faith freely chosen is faith honestly held.',
        description: 'Offer no judgement. The community will adapt.',
        consequences: [
          { type: 'modify_opinion', target: '{advocate}', value: 5 },
          { type: 'modify_opinion', target: '{convert}',  value: 8 },
          { type: 'modify_religion', target: '{convert}', value: 'sacred_wheel' },
        ],
      },
      {
        id: 'express_concern',
        label: 'Note concern — religion affects the whole settlement.',
        description: 'Acknowledge it privately while watching the wider response.',
        consequences: [
          { type: 'modify_opinion', target: '{advocate}', value: -3 },
          { type: 'modify_opinion', target: '{convert}',  value: -3 },
          { type: 'modify_religion', target: '{convert}', value: 'sacred_wheel' },
        ],
      },
      {
        id: 'formally_oppose',
        label: 'Oppose it formally — under Company law, orthodoxy is expected.',
        description: 'A sharp reminder that the Company watches.',
        consequences: [
          { type: 'modify_opinion', target: '{advocate}', value: -20 },
          { type: 'modify_opinion', target: '{convert}',  value: -10 },
        ],
      },
    ],
  },

  // ── Rumours spreading ───────────────────────────────────────────────────────

  {
    id: 'sch_rumours_spreading',
    title: 'Rumours in the Camp',
    category: 'personal',
    prerequisites: [],
    actorRequirements: [
      { slot: 'schemer',  criteria: { minAge: 16 } },
      { slot: 'target',   criteria: { minAge: 16 } },
    ],
    weight: 3,
    cooldown: 0,
    isUnique: false,
    isDeferredOutcome: true,
    description:
      'Unkind stories are circulating about {target.first}. They concern {target.his} character, ' +
      '{target.his} judgement, and how {target.he} behaved during a recent matter. ' +
      'The trail of these whispers leads, if you follow it, back to {schemer}. ' +
      'Do you intervene?',
    choices: [
      {
        id: 'investigate',
        label: 'Investigate the source.',
        description: 'Find out exactly what is being said, and who started it.',
        consequences: [
          { type: 'modify_opinion', target: '{schemer}', value: -8 },
          { type: 'modify_opinion', target: '{target}',  value: 5  },
        ],
      },
      {
        id: 'contain',
        label: 'Contain the rumours before they spread further.',
        description: 'Issue a correction. Make clear that loose talk is unwelcome.',
        consequences: [
          { type: 'modify_opinion', target: '{schemer}', value: -5 },
          { type: 'clear_scheme',   target: '{schemer}', value: 0 },
        ],
      },
      {
        id: 'ignore',
        label: 'Leave it alone — rumours die on their own.',
        description: 'There are bigger matters to attend to.',
        consequences: [],
      },
    ],
  },

  // ── Undermining climax ──────────────────────────────────────────────────────

  {
    id: 'sch_undermining_climax',
    title: 'The Knife Revealed',
    category: 'personal',
    prerequisites: [],
    actorRequirements: [
      { slot: 'schemer', criteria: { minAge: 16 } },
      { slot: 'victim',  criteria: { minAge: 16 } },
    ],
    weight: 4,
    cooldown: 0,
    isUnique: false,
    isDeferredOutcome: true,
    description:
      "It has come to a head. {schemer}'s campaign against {victim.first} has been patient, " +
      'methodical, and — until now — invisible. But the evidence is clear: {schemer.he} has been ' +
      'working systematically to diminish {victim.his} standing in the settlement. ' +
      "What do you do?",
    choices: [
      {
        id: 'confront_schemer',
        label: 'Confront the schemer directly.',
        description: 'Make clear this kind of behaviour is not tolerated.',
        consequences: [
          { type: 'modify_opinion', target: '{schemer}', value: -20 },
          { type: 'modify_opinion', target: '{victim}',  value: 10  },
          { type: 'clear_scheme',   target: '{schemer}', value: 0 },
        ],
      },
      {
        id: 'mediate',
        label: 'Bring them both together and mediate.',
        description: 'Force the conflict into the open where it can be addressed.',
        consequences: [
          { type: 'modify_opinion', target: '{schemer}', value: -8 },
          { type: 'modify_opinion', target: '{victim}',  value: 5  },
        ],
        skillCheck: {
          skill: 'diplomacy',
          difficulty: 50,
          actorSelection: 'best_council',
          attemptLabel: 'Mediate the conflict',
        },
        successText: 'The confrontation is painful but honest. Both parties walk away with a grudging understanding.',
        failureText: 'The mediation collapses. The schemer denies everything; the victim feels abandoned.',
        onSuccess: [
          { type: 'modify_opinion', target: '{schemer}', value: -5 },
          { type: 'modify_opinion', target: '{victim}',  value: 5  },
        ],
        onFailure: [
          { type: 'modify_opinion', target: '{schemer}', value: 5  },
          { type: 'modify_opinion', target: '{victim}',  value: -5 },
        ],
      },
      {
        id: 'let_it_play',
        label: 'Let it play out — internal conflict is natural.',
        description: 'You are not a nursemaid. This is between them.',
        consequences: [],
      },
    ],
  },

  // ── Tutor breakthrough ──────────────────────────────────────────────────────

  {
    id: 'sch_tutor_breakthrough',
    title: 'A Lesson Worth Remembering',
    category: 'personal',
    prerequisites: [],
    actorRequirements: [
      { slot: 'mentor',  criteria: { minAge: 20 } },
      { slot: 'student', criteria: { minAge: 14 } },
    ],
    weight: 2,
    cooldown: 0,
    isUnique: false,
    isDeferredOutcome: true,
    description:
      "{mentor} has been quietly teaching {student.first} — patient, unhurried, asking little " +
      "in return. Something clicked this season. {student.first}'s skill has grown noticeably, " +
      "and {mentor} seems genuinely proud. What do you make of this pairing?",
    choices: [
      {
        id: 'acknowledge',
        label: 'Acknowledge both of them in front of the settlement.',
        description: 'Public recognition is a powerful thing.',
        consequences: [
          { type: 'modify_opinion', target: '{mentor}',  value: 10 },
          { type: 'modify_opinion', target: '{student}', value: 8  },
          { type: 'modify_opinion_pair', target: '{mentor}', value: 5, params: { slotB: '{student}', label: 'Public recognition' } },
        ],
      },
      {
        id: 'assign_responsibility',
        label: "Give the student a new responsibility.",
        description: 'Put that growth to work. Assign them to a role that uses the skill.',
        consequences: [
          { type: 'modify_opinion', target: '{mentor}',  value: 5  },
          { type: 'modify_opinion', target: '{student}', value: 12 },
        ],
      },
      {
        id: 'note_quietly',
        label: 'Note it quietly — good work speaks for itself.',
        description: 'No ceremony needed.',
        consequences: [
          { type: 'modify_opinion', target: '{mentor}',  value: 3 },
          { type: 'modify_opinion', target: '{student}', value: 3 },
        ],
      },
    ],
  },

];
