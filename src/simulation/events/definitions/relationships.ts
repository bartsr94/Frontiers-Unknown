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

  // ── Ambition expansion events (Phase 5) ─────────────────────────────────────

  {
    id: 'rel_prestige_opportunity',
    title: 'A Hunger for Renown',
    category: 'personal',
    prerequisites: [
      { type: 'has_person_with_ambition', params: { ambitionId: 'seek_prestige' } },
    ],
    actorRequirements: [
      { slot: 'petitioner', criteria: { minAge: 25, minSkill: { skill: 'leadership', value: 46 } } },
    ],
    weight: 2,
    cooldown: 10,
    isUnique: false,
    description:
      '{petitioner} has been restless. {petitioner.He} has the skill for something greater ' +
      'than daily routine — and the ambition to match it. {petitioner.He} asks to be given ' +
      'a task worthy of {petitioner.his} ability, something that will let {petitioner.him} ' +
      'prove {petitioner.his} worth to the settlement.',
    choices: [
      {
        id: 'send_mission',
        label: 'Dispatch them on a scouting mission.',
        description: 'Satisfy the hunger for adventure. They will be away for a time.',
        missionActorSlot: 'petitioner',
        deferredEventId: 'rel_prestige_mission_return',
        deferredTurns: 3,
        consequences: [
          { type: 'modify_opinion', target: '{petitioner}', value: 15 },
        ],
      },
      {
        id: 'offer_leadership',
        label: 'Offer them a leadership role in the settlement.',
        description: 'Recognition without absence. Costs nothing but reputation.',
        consequences: [
          { type: 'modify_opinion',  target: '{petitioner}', value: 20  },
          { type: 'clear_ambition', target: '{petitioner}', value: 0 },
        ],
      },
      {
        id: 'decline',
        label: 'Decline — they should be patient like everyone else.',
        description: 'A bruising refusal.',
        consequences: [
          { type: 'modify_opinion', target: '{petitioner}', value: -10 },
        ],
      },
    ],
  },

  {
    id: 'rel_prestige_mission_return',
    title: 'Return From the Wilds',
    category: 'personal',
    isDeferredOutcome: true,
    prerequisites: [],
    actorRequirements: [
      { slot: 'petitioner', criteria: { minAge: 18 } },
    ],
    weight: 1,
    cooldown: 0,
    isUnique: false,
    description:
      '{petitioner} has returned from their mission. {petitioner.He} bears the look of someone ' +
      'who has seen open country and handled it alone. Whatever hunger drove {petitioner.him} ' +
      'out there, it has changed shape — the achievement is now something {petitioner.he} carries.',
    choices: [
      {
        id: 'celebrate',
        label: 'Celebrate their return. They have earned it.',
        consequences: [
          { type: 'add_trait',      target: '{petitioner}', value: 'veteran'  },
          { type: 'modify_opinion', target: '{petitioner}', value: 20         },
          { type: 'clear_ambition', target: '{petitioner}', value: 0 },
        ],
      },
      {
        id: 'acknowledge',
        label: 'Acknowledge it and move on.',
        consequences: [
          { type: 'modify_opinion', target: '{petitioner}', value: 5  },
          { type: 'clear_ambition', target: '{petitioner}', value: 0 },
        ],
      },
    ],
  },

  {
    id: 'rel_faith_calling',
    title: 'The Spirit Calls',
    category: 'personal',
    prerequisites: [
      { type: 'has_person_with_ambition', params: { ambitionId: 'seek_faith_influence' } },
    ],
    actorRequirements: [
      { slot: 'devout', criteria: { minAge: 18, hasTrait: 'zealous' } },
    ],
    weight: 2,
    cooldown: 10,
    isUnique: false,
    description:
      '{devout} speaks of a calling — not ambition, {devout.he} insists, but duty. ' +
      'The faith lacks a voice in this settlement. {devout.He} has the conviction and ' +
      'the words; {devout.he} only needs your recognition.',
    choices: [
      {
        id: 'assign_priest',
        label: 'Recognise them as the settlement\'s spiritual voice.',
        description: 'Assigns a priestly role. Faith in the settlement rises.',
        consequences: [
          { type: 'modify_opinion', target: '{devout}', value: 25 },
          { type: 'clear_ambition', target: '{devout}', value: 0 },
        ],
      },
      {
        id: 'acknowledge',
        label: 'Acknowledge the calling without giving a formal role.',
        description: 'Kind but non-committal.',
        consequences: [
          { type: 'modify_opinion', target: '{devout}', value: 5 },
        ],
      },
      {
        id: 'dismiss',
        label: 'This is a settlement, not a temple. Redirect them.',
        description: 'Blunt refusal. The faithful will notice.',
        consequences: [
          { type: 'modify_opinion', target: '{devout}', value: -15 },
        ],
      },
    ],
  },

  {
    id: 'rel_mastery_dedication',
    title: 'A Craftsperson in Full Stride',
    category: 'personal',
    prerequisites: [
      { type: 'has_person_with_ambition', params: { ambitionId: 'seek_skill_mastery' } },
    ],
    actorRequirements: [
      { slot: 'artisan', criteria: { minAge: 18, minSkill: { skill: 'custom', value: 46 } } },
    ],
    weight: 2,
    cooldown: 8,
    isUnique: false,
    description:
      '{artisan} is in the middle of something. You have seen the look before — ' +
      'someone who has found the edge of their ability and is determined to push past it. ' +
      '{artisan.He} asks for a light season, time to focus on the work itself.',
    choices: [
      {
        id: 'endorse',
        label: 'Give them the time. The settlement can spare it.',
        description: 'Provides a temporary skill surge.',
        consequences: [
          { type: 'add_trait',      target: '{artisan}', value: 'inspired' },
          { type: 'modify_opinion', target: '{artisan}', value: 15         },
          { type: 'clear_ambition', target: '{artisan}', value: 0 },
        ],
      },
      {
        id: 'acknowledge',
        label: 'Acknowledge the work without lightening their duties.',
        consequences: [
          { type: 'modify_opinion', target: '{artisan}', value: 5 },
        ],
      },
      {
        id: 'redirect',
        label: 'The settlement needs their hands on practical tasks.',
        description: 'Frustrates the ambition.',
        consequences: [
          { type: 'modify_opinion', target: '{artisan}', value: -8 },
        ],
      },
    ],
  },

  {
    id: 'rel_legacy_concern',
    title: 'A Parent\'s Worry',
    category: 'personal',
    prerequisites: [
      { type: 'has_person_with_ambition', params: { ambitionId: 'seek_legacy' } },
    ],
    actorRequirements: [
      { slot: 'parent', criteria: { minAge: 45 } },
    ],
    weight: 2,
    cooldown: 10,
    isUnique: false,
    description:
      '{parent} is thinking about what they leave behind. {parent.He} does not say it plainly, ' +
      'but the concern is for {parent.his} children — whether they will find their place here, ' +
      'whether the settlement will hold a future for them.',
    choices: [
      {
        id: 'help_marriage',
        label: 'Offer to help arrange something for their child.',
        description: 'Practical commitment. A good-faith gesture.',
        consequences: [
          { type: 'modify_opinion', target: '{parent}', value: 20 },
          { type: 'clear_ambition', target: '{parent}', value: 0 },
        ],
      },
      {
        id: 'reassure',
        label: 'Reassure them — the settlement will look after its own.',
        description: 'Warm but non-committal. Eases the intensity.',
        consequences: [
          { type: 'modify_opinion', target: '{parent}', value: 10 },
        ],
      },
      {
        id: 'dismiss',
        label: 'Everyone has children. They will manage.',
        description: 'Cold. The parent will not forget it.',
        consequences: [
          { type: 'modify_opinion', target: '{parent}', value: -12 },
        ],
      },
    ],
  },

  {
    id: 'rel_independence_voice',
    title: 'Enough of Their Rules',
    category: 'domestic',
    prerequisites: [
      { type: 'has_person_with_ambition', params: { ambitionId: 'seek_autonomy' } },
    ],
    actorRequirements: [
      { slot: 'dissenter', criteria: { minAge: 18, sauromatianHeritage: true } },
    ],
    weight: 2,
    cooldown: 12,
    isUnique: false,
    description:
      '{dissenter} has had enough of bending to Company expectations. ' +
      '{dissenter.He} is not reckless — {dissenter.he} simply believes the settlement ' +
      'should answer to itself first. {dissenter.He} wants to know where you stand.',
    choices: [
      {
        id: 'acknowledge',
        label: 'Acknowledge the grievance — allow more local custom.',
        description: 'Shifts the cultural blend toward native tradition.',
        consequences: [
          { type: 'modify_cultural_blend', target: 'settlement', value: -0.05 },
          { type: 'modify_opinion',         target: '{dissenter}', value: 15  },
          { type: 'clear_ambition', target: '{dissenter}', value: 0 },
        ],
      },
      {
        id: 'defend_company',
        label: 'Defend the Company relationship. It protects this settlement.',
        description: 'A principled stand. Sauromatian members will notice.',
        consequences: [
          { type: 'modify_opinion',                  target: '{dissenter}', value: -15 },
          { type: 'modify_all_tribe_dispositions',   target: 'all',         value: -3  },
        ],
      },
      {
        id: 'convene_council',
        label: 'Bring it before the council. This deserves a proper hearing.',
        description: 'Defers judgment but earns some trust.',
        consequences: [
          { type: 'modify_opinion', target: '{dissenter}', value: 8 },
        ],
      },
    ],
  },
];

