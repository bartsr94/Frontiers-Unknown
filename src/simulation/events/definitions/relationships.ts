/**
 * Relationship events — inter-personal dynamics, feuds, and ambition-driven
 * autonomous actions.
 *
 * Three tension events fire when social friction reaches a threshold; five
 * autonomous events fire when a character's ambition intensity crosses 0.5.
 */

import type { GameEvent } from '../engine';

export const RELATIONSHIP_EVENTS: GameEvent[] = [

  // ── Tension events ──────────────────────────────────────────────────────────

  {
    id: 'rel_council_feud',
    title: 'Words with Teeth',
    category: 'personal',
    prerequisites: [
      { type: 'max_opinion_pair', params: { threshold: -25 } },
      { type: 'min_population', params: { value: 3 } },
    ],
    actorRequirements: [
      { slot: 'instigator', criteria: { minAge: 18 } },
      { slot: 'rival',      criteria: { minAge: 18 } },
    ],
    weight: 2,
    cooldown: 6,
    isUnique: false,
    description:
      '{instigator} and {rival} have had a falling-out — the camp heard every word of it. ' +
      'Whether over rations, a past slight, or something older and harder to name, the ill will ' +
      'between them is now public. Others are watching to see how you handle it.',
    choices: [
      {
        id: 'mediate',
        label: 'Sit them down and mediate the dispute.',
        description: 'Takes time — and neither may thank you for it — but it keeps the peace.',
        consequences: [],
        skillCheck: {
          skill: 'diplomacy',
          difficulty: 40,
          actorSelection: 'best_council',
          attemptLabel: 'Mediate the feud',
        },
        successText:
          'A morning of difficult conversation clears the air. Neither man will call the other a friend, but the open hostility is buried.',
        failureText:
          'The mediation goes nowhere. Both men leave angrier than when they came in.',
        onSuccess: [
          { type: 'modify_opinion', target: '{instigator}', value: 10 },
          { type: 'modify_opinion', target: '{rival}',      value: 10 },
        ],
        onFailure: [
          { type: 'modify_opinion', target: '{instigator}', value: -5 },
          { type: 'modify_opinion', target: '{rival}',      value: -5 },
        ],
      },
      {
        id: 'warn_instigator',
        label: 'Take the instigator aside and warn them.',
        description: 'Makes a decisive statement, but may breed resentment.',
        consequences: [
          { type: 'modify_opinion', target: '{instigator}', value: -10 },
          { type: 'modify_opinion', target: '{rival}',       value: 5  },
        ],
      },
      {
        id: 'let_it_settle',
        label: 'Leave it alone — men work out these things themselves.',
        description: 'No intervention. It may fester.',
        consequences: [
          { type: 'modify_opinion', target: '{instigator}', value: -5 },
          { type: 'modify_opinion', target: '{rival}',      value: -5 },
        ],
      },
    ],
  },

  {
    id: 'rel_marriage_strains',
    title: 'Under the Same Roof',
    category: 'personal',
    prerequisites: [
      { type: 'max_opinion_pair', params: { threshold: -20 } },
    ],
    actorRequirements: [
      { slot: 'husband', criteria: { sex: 'male',   maritalStatus: 'married', minAge: 18 } },
      { slot: 'wife',    criteria: { sex: 'female', maritalStatus: 'married', minAge: 16 } },
    ],
    weight: 2,
    cooldown: 8,
    isUnique: false,
    description:
      'The household of {husband} and {wife} is not a quiet one lately. You have heard raised ' +
      'voices at night, watched {wife.her} eat apart from {husband.him} at the fires. ' +
      'Whatever started it has deepened into something that poisons the mood of those nearby.',
    choices: [
      {
        id: 'counsel_patience',
        label: 'Speak to both separately — advise patience and duty.',
        description: 'The old Imanian way: private counsel, no public shame.',
        consequences: [],
        skillCheck: {
          skill: 'custom',
          difficulty: 35,
          actorSelection: 'best_council',
          attemptLabel: 'Counsel the couple',
        },
        successText:
          'Both listen. Neither is happy, but the household settles into a tense truce.',
        failureText:
          'Your counsel falls on closed ears. The tension remains.',
        onSuccess: [
          { type: 'modify_opinion', target: '{husband}', value: 12 },
          { type: 'modify_opinion', target: '{wife}',    value: 12 },
        ],
        onFailure: [],
      },
      {
        id: 'involve_wife_council',
        label: 'Involve the wife-council in the matter.',
        description: 'Gives {wife} a formal voice. Sauromatian households expect this.',
        consequences: [
          { type: 'modify_opinion', target: '{wife}',    value: 15 },
          { type: 'modify_opinion', target: '{husband}', value: -5 },
        ],
      },
      {
        id: 'no_interference',
        label: 'Stay out of it — a household is its own domain.',
        description: 'Let them find their own way.',
        consequences: [],
      },
    ],
  },

  {
    id: 'rel_settler_departure',
    title: 'Bound for Elsewhere',
    category: 'personal',
    prerequisites: [
      { type: 'max_opinion_pair', params: { threshold: -40 } },
      { type: 'min_population',   params: { value: 4 } },
    ],
    actorRequirements: [
      { slot: 'leaver', criteria: { minAge: 18 } },
    ],
    weight: 1,
    cooldown: 10,
    isUnique: false,
    description:
      '{leaver} comes to you at the edge of the evening fires, pack half-rolled behind {leaver.him}. ' +
      '{leaver.He} wants out. Not because {leaver.he} is a coward — {leaver.he} has done the work — ' +
      'but because {leaver.he} cannot stand another season surrounded by people {leaver.he} ' +
      'cannot get along with. {leaver.He} would rather take {leaver.his} chances on the road.',
    choices: [
      {
        id: 'convince_to_stay',
        label: 'Appeal to {leaver.his} sense of duty.',
        description: 'A good argument might keep them. Costs nothing to try.',
        consequences: [],
        skillCheck: {
          skill: 'leadership',
          difficulty: 45,
          actorSelection: 'best_council',
          attemptLabel: 'Convince them to stay',
        },
        successText:
          '{leaver} sets the pack down. Not cheerfully — but there is something in your words that holds {leaver.him} here.',
        failureText:
          'The argument falls short. {leaver} is gone before dawn.',
        onSuccess: [
          { type: 'modify_opinion', target: '{leaver}', value: 20 },
        ],
        onFailure: [
          { type: 'remove_person', target: '{leaver}', value: 0 },
        ],
      },
      {
        id: 'let_them_go',
        label: 'Wish {leaver.him} well and let {leaver.him} go.',
        description: 'Better a willing absence than a resentful presence.',
        consequences: [
          { type: 'remove_person', target: '{leaver}', value: 0 },
        ],
      },
      {
        id: 'sweeten_the_stay',
        label: 'Offer something real — better role, better rations.',
        description: 'Costs goods but keeps a hand.',
        consequences: [
          { type: 'modify_resource', target: 'goods', value: -2 },
          { type: 'modify_opinion', target: '{leaver}', value: 30 },
        ],
      },
    ],
  },

  // ── Autonomous events ───────────────────────────────────────────────────────

  {
    id: 'rel_mutual_attraction',
    title: 'An Understanding',
    category: 'personal',
    prerequisites: [
      { type: 'has_person_with_ambition', params: { ambitionId: 'seek_spouse' } },
    ],
    actorRequirements: [
      { slot: 'admirer', criteria: { minAge: 16 } },
      { slot: 'beloved', criteria: { minAge: 16 } },
    ],
    weight: 2,
    cooldown: 8,
    isUnique: false,
    description:
      '{admirer} asks to speak with you privately. With the directness of someone who ' +
      'has rehearsed this, {admirer.he} tells you that {admirer.he} holds {beloved} in ' +
      'high regard. More than high regard. {admirer.He} is not asking your permission ' +
      '— not exactly — but would not act without your knowledge.',
    choices: [
      {
        id: 'support_union',
        label: 'Encourage them — arrange proximity and opportunity.',
        description: 'Let nature take its course with your blessing.',
        consequences: [
          { type: 'modify_opinion', target: '{admirer}', value: 15 },
          { type: 'modify_opinion', target: '{beloved}', value: 10 },
        ],
      },
      {
        id: 'arrange_formally',
        label: 'Take this to the marriage council and arrange it properly.',
        description: 'A formal match if both are eligible. Slower but legitimate.',
        consequences: [
          { type: 'modify_opinion', target: '{admirer}', value: 20 },
        ],
      },
      {
        id: 'discourage',
        label: 'Discourage it — the settlement needs work partners, not complications.',
        description: 'Keeps discipline but bruises feelings.',
        consequences: [
          { type: 'modify_opinion', target: '{admirer}', value: -15 },
        ],
      },
    ],
  },

  {
    id: 'rel_council_petition',
    title: 'They Ask for a Voice',
    category: 'personal',
    prerequisites: [
      { type: 'has_person_with_ambition', params: { ambitionId: 'seek_council' } },
    ],
    actorRequirements: [
      { slot: 'petitioner', criteria: { minAge: 18 } },
    ],
    weight: 2,
    cooldown: 8,
    isUnique: false,
    description:
      '{petitioner} approaches when others have left. {petitioner.He} does not complain. ' +
      '{petitioner.He} simply says: \'I have been here long enough to have earned a seat. ' +
      'You know what I can do. My counsel is yours — if you want it.\'',
    choices: [
      {
        id: 'grant_seat',
        label: 'Grant them a council seat.',
        description: 'Requires an open seat. Earns lasting respect.',
        consequences: [
          { type: 'modify_opinion', target: '{petitioner}', value: 20 },
        ],
      },
      {
        id: 'offer_role',
        label: 'Acknowledge their service — offer a better work role instead.',
        description: 'A smaller gift, but real.',
        consequences: [
          { type: 'modify_opinion', target: '{petitioner}', value: 10 },
        ],
      },
      {
        id: 'decline',
        label: 'Decline respectfully for now.',
        description: 'Their patience will run out.',
        consequences: [
          { type: 'modify_opinion', target: '{petitioner}', value: -15 },
        ],
      },
    ],
  },

  {
    id: 'rel_seniority_bid',
    title: 'She Should Be First',
    category: 'personal',
    prerequisites: [
      { type: 'has_person_with_ambition', params: { ambitionId: 'seek_seniority' } },
    ],
    actorRequirements: [
      { slot: 'aspirant', criteria: { sex: 'female', maritalStatus: 'married', minAge: 16 } },
    ],
    weight: 2,
    cooldown: 10,
    isUnique: false,
    description:
      '{aspirant} comes to you not with complaint but with composure. {aspirant.She} has managed ' +
      'the household through enough seasons to know its rhythms better than anyone. ' +
      'What {aspirant.she} asks is only that you recognise what the household already knows: ' +
      'that {aspirant.she} is its centre.',
    choices: [
      {
        id: 'elevate_aspirant',
        label: 'Formally name {aspirant.her} as senior wife.',
        description: 'A significant act. Reshapes household authority.',
        consequences: [
          { type: 'modify_opinion',    target: '{aspirant}', value: 30 },
          { type: 'set_social_status', target: '{aspirant}', value: 'founding_member' },
        ],
      },
      {
        id: 'acknowledge_only',
        label: 'Acknowledge her standing without formal change.',
        description: 'A meaningful but partial answer.',
        consequences: [
          { type: 'modify_opinion', target: '{aspirant}', value: 12 },
        ],
      },
      {
        id: 'defer_decision',
        label: 'Tell her the matter is not yours to decide unilaterally.',
        description: 'Passes the question back.',
        consequences: [
          { type: 'modify_opinion', target: '{aspirant}', value: -5 },
        ],
      },
    ],
  },

  {
    id: 'rel_keth_thara_selfvow',
    title: 'He Comes in the Old Way',
    category: 'personal',
    prerequisites: [
      { type: 'has_person_with_ambition', params: { ambitionId: 'seek_cultural_duty' } },
    ],
    actorRequirements: [
      { slot: 'subject', criteria: { sex: 'male', minAge: 16, maxAge: 24 } },
    ],
    weight: 2,
    cooldown: 8,
    isUnique: false,
    description:
      '{subject} comes to you at dawn, dressed simply, carrying nothing {subject.he} was not born with. ' +
      '{subject.He} speaks the words your Sauromatian settlers have translated for you. ' +
      '{subject.He} is asking to go — not as punishment, not as exile, ' +
      'but as the thing {subject.his} culture asks of young men.',
    choices: [
      {
        id: 'send_on_keth_thara',
        label: 'Accept — send {subject.him} on keth-thara.',
        description: 'Fulfils the cultural obligation. Earns deep respect from Sauromatian settlers.',
        consequences: [
          { type: 'modify_opinion', target: '{subject}', value: 15 },
        ],
      },
      {
        id: 'ask_to_wait',
        label: 'Ask {subject.him} to wait one more season.',
        description: 'Available once. The obligation will not go away.',
        consequences: [
          { type: 'modify_opinion', target: '{subject}', value: -5 },
        ],
      },
      {
        id: 'forbid',
        label: 'Forbid it — you need {subject.him} here.',
        description: 'Efficient. Deeply offensive to Sauromatian culture.',
        consequences: [
          { type: 'modify_opinion', target: '{subject}', value: -25 },
        ],
      },
    ],
  },

  {
    id: 'rel_informal_union_proposed',
    title: 'A Private Request',
    category: 'personal',
    prerequisites: [
      { type: 'has_person_with_ambition', params: { ambitionId: 'seek_informal_union' } },
    ],
    actorRequirements: [
      { slot: 'petitioner', criteria: { sex: 'male',   minAge: 18 } },
      { slot: 'target',     criteria: { sex: 'female', maritalStatus: 'unmarried', minAge: 16 } },
    ],
    weight: 2,
    cooldown: 8,
    isUnique: false,
    description:
      '{petitioner} has come to you privately. {petitioner.He} speaks well of {target} ' +
      'and asks whether you would recognise {target.her} as {petitioner.his} companion ' +
      'under Imanian custom. The decision, {petitioner.he} says, is ultimately yours.',
    choices: [
      {
        id: 'approve',
        label: 'Allow it — recognise the bond under Imanian custom.',
        description: 'Straightforward approval.',
        consequences: [
          { type: 'modify_opinion', target: '{petitioner}', value: 20 },
          { type: 'modify_opinion', target: '{target}',     value: 5  },
        ],
      },
      {
        id: 'decline_now',
        label: 'Not now — the settlement has more pressing matters.',
        description: 'Neutral delay. The ambition will persist.',
        consequences: [
          { type: 'modify_opinion', target: '{petitioner}', value: -5 },
        ],
      },
      {
        id: 'refuse',
        label: 'Refuse. This is not the time or the place.',
        description: 'A hard refusal with lasting resentment.',
        consequences: [
          { type: 'modify_opinion', target: '{petitioner}', value: -15 },
          { type: 'modify_opinion', target: '{target}',     value: -5  },
        ],
      },
    ],
  },
];
