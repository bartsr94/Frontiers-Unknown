/**
 * Cultural events — the collision and eventual blending of Imanian expedition
 * culture with the Sauromatian women brought into the settlement.
 *
 * These events dramatise the day-to-day frictions, negotiations, and small
 * moments of understanding that constitute the game's central cultural arc.
 * All narrative is grounded in the "Children of Two Worlds" design brief:
 * the men are orthodox, hierarchical, mission-focused Imanians; the Sauromatian
 * women carry matrilineal customs, the Sacred Wheel faith, and a completely
 * different social grammar.
 *
 * Working consequences in this file: modify_resource, modify_standing.
 * Consequence types modify_disposition and modify_opinion are engine stubs —
 * they will have effect when Phase 3 plumbs the disposition / opinion systems.
 */

import type { GameEvent } from '../engine';

export const CULTURAL_EVENTS: GameEvent[] = [
  // ─── Sauromatian presence & introductions ─────────────────────────────────

  {
    id: 'cul_sauromatian_envoy',
    title: 'Riders on the Southern Shore',
    category: 'cultural',
    prerequisites: [{ type: 'min_year', params: { value: 1 } }],
    weight: 3,
    cooldown: 12,
    isUnique: false,
    description:
      'Three Sauromatian riders arrive at the edge of camp before dawn — two women ' +
      'in oiled leather, one elder with a Wheel pendant large enough to see from ' +
      'fifty paces. They carry smoked fish, bundled rope, and a painted clay jar ' +
      'of something that smells strongly of fermented grain. Their formal greeting, ' +
      'translated haltingly by one of your Kiswani-speaking settlers, establishes ' +
      'that they represent the Deep Canopy Sisters and wish to discuss terms.',
    choices: [
      {
        id: 'receive_gifts',
        label: 'Receive their gifts and invite them to eat with you.',
        description: 'Hospitality costs little and earns a great deal — if it is given well.',
        consequences: [
          { type: 'modify_resource', target: 'food',  value: 6 },
          { type: 'modify_resource', target: 'goods', value: 3 },
        ],
        skillCheck: {
          skill: 'diplomacy',
          difficulty: 38,
          actorSelection: 'best_council',
          attemptLabel: 'Host the envoy',
        },
        successText: 'Something reaches across the language gap. The elder pauses before leaving and speaks a phrase the interpreter renders as "not what we feared." The riders relax.',
        failureText: 'The hospitality is genuine but the conversation stumbles at every turn. They eat, they nod, they leave. A beginning, of a kind.',
        onSuccess: [{ type: 'modify_disposition', target: 'deep_canopy_sisters', value: 10 }],
        onFailure:  [{ type: 'modify_disposition', target: 'deep_canopy_sisters', value: 4  }],
      },
      {
        id: 'formal_meeting',
        label: 'Accept the gifts but keep it brief and formal.',
        description:
          'Professional. You are here to work, not to socialise. They seem ' +
          'neither offended nor particularly warmed.',
        consequences: [
          { type: 'modify_resource', target: 'food', value: 6 },
          { type: 'modify_resource', target: 'goods', value: 3 },
        ],
      },
      {
        id: 'send_away',
        label: 'Send them away. The settlement is not ready for visitors.',
        description:
          'Direct and defensible. The riders withdraw without incident, ' +
            'but the elder\'s expression does not forget.',
        consequences: [
          { type: 'modify_disposition', target: 'deep_canopy_sisters', value: -10 },
        ],
      },
    ],
  },

  {
    id: 'cul_wheel_ceremony_request',
    title: 'A Request at the River',
    category: 'cultural',
    prerequisites: [
      { type: 'min_year', params: { value: 1 } },
      { type: 'has_person_matching', params: { sex: 'female', religion: 'sacred_wheel' } },
    ],
    weight: 3,
    cooldown: 10,
    isUnique: false,
    actorRequirements: [
      { slot: 'speaker', criteria: { sex: 'female', religion: 'sacred_wheel', minAge: 35 } },
    ],
    description:
      'The Sauromatian women in the settlement approach you together — which is ' +
      'itself unusual; they rarely present requests as a group. {speaker} — the ' +
      'eldest among them — explains that the new moon is three nights away and ' +
      'they wish to observe the Wheel-Turning, a ceremony conducted at the river ' +
      'in the hours before dawn. They are not asking to leave. They are asking ' +
      'permission to step outside the stockade, unescorted, for four hours.',
    choices: [
      {
        id: 'grant_freely',
        label: 'Grant it without condition.',
        description:
          'The women are neither prisoners nor wards. Trust has to be extended ' +
          'before it can be returned.',
        consequences: [
          { type: 'modify_opinion', target: 'sauromatian_women', value: 10 },
          { type: 'modify_standing', target: 'company', value: -2 },
        ],
      },
      {
        id: 'grant_with_escort',
        label: 'Grant it, but assign two men to keep watch at a distance.',
        description:
          'Compromise. The women accept, though the speaker\'s eyes say she has ' +
          'noted the condition.',
        consequences: [
          { type: 'modify_opinion', target: 'sauromatian_women', value: 4 },
        ],
      },
      {
        id: 'deny',
        label: 'Deny it. Night excursions are too risky.',
        description:
          'The Speaker listens without expression, then inclines her head and ' +
          'returns to work. Nothing changes outwardly. Something does, inwardly.',
        consequences: [
          { type: 'modify_opinion', target: 'sauromatian_women', value: -8 },
        ],
      },
    ],
  },

  {
    id: 'cul_sacred_wheel_icon_found',
    title: 'The Cookhouse Finds',
    category: 'cultural',
    prerequisites: [
      { type: 'min_year', params: { value: 1 } },
      { type: 'has_person_matching', params: { sex: 'female', religion: 'sacred_wheel' } },
    ],
    weight: 2,
    cooldown: 0,
    isUnique: true,
    actorRequirements: [
      { slot: 'finder', criteria: { sex: 'male' } },
    ],
    description:
      'During a repair to the cookhouse wall, {finder} pulls out a small ' +
      'clay Wheel icon mortared into the foundation stones. {finder.He} brings it to you ' +
      'looking uncertain. You recognise it immediately: a Sauromatian votary ' +
      'token, meant to bless a dwelling. It seems one of the women placed it here ' +
      'when the cookhouse was first built. Ortho men have already started talking.',
    choices: [
      {
        id: 'leave_it',
        label: 'Leave it where it was found. It harms no one.',
        description:
          'The women are visibly relieved. The orthodox men grumble, but ' +
          'produce nothing beyond grumbling.',
        consequences: [
          { type: 'modify_opinion', target: 'sauromatian_women', value: 6 },
          { type: 'modify_opinion', target: 'traditional_imanians', value: -4 },
        ],
      },
      {
        id: 'public_meeting',
        label: 'Hold a short settlement meeting to address the discovery openly.',
        description:
          'Names the tension rather than letting it fester. Outcome is moderate ' +
          'on both sides — neither pleased, neither outraged.',
        consequences: [{ type: 'modify_standing', target: 'company', value: 1 }],
      },
      {
        id: 'remove_quietly',
        label: 'Remove it quietly and say nothing.',
        description:
          'The women will notice it is gone. You simply do not acknowledge it.',
        consequences: [
          { type: 'modify_opinion', target: 'sauromatian_women', value: -6 },
        ],
      },
    ],
  },

  // ─── Religious & ideological friction ────────────────────────────────────

  {
    id: 'cul_imanian_feast_tension',
    title: 'The Ortho Feast',
    category: 'cultural',
    prerequisites: [
      { type: 'min_population', params: { value: 8 } },
      { type: 'has_person_matching', params: { sex: 'female', religion: 'sacred_wheel' } },
    ],
    weight: 2,
    cooldown: 12,
    isUnique: false,
    actorRequirements: [
      { slot: 'objector', criteria: { sex: 'male', religion: 'imanian_orthodox' } },
    ],
    description:
      'The orthodox Imanian men observe a quarterly feast day — a ritual of ' +
      'communal prayer, shared bread, and consecrated salt from home stock. It ' +
      'is one of the few anchor points connecting them to the world they left. ' +
      'This season {objector} has pointedly noted that the Sauromatian women ' +
      'were not invited. Another settler argues they should be — it would be a ' +
      'gesture of inclusion. The women themselves have not commented, but they ' +
      'are watching.',
    choices: [
      {
        id: 'invite_women',
        label: 'Invite the women to observe, though not to participate in the rites.',
        description:
          'A quiet act of inclusion. The Sauromatian women attend in silence, ' +
          'which seems to move both sides more than words would have.',
        consequences: [
          { type: 'modify_opinion', target: 'sauromatian_women', value: 5 },
          { type: 'modify_opinion', target: 'traditional_imanians', value: -2 },
          { type: 'modify_resource', target: 'food', value: -2 },
        ],
      },
      {
        id: 'separate_feast',
        label: 'Hold separate celebrations on the same day — each group in their own space.',
        description:
          'Parallel lives, same sun. No fusion either way. Some find it comforting.',
        consequences: [
          { type: 'modify_resource', target: 'food', value: -2 },
        ],
      },
      {
        id: 'imanian_only',
        label: 'Keep the feast as it has always been — Imanian only.',
        description:
          'You will not alter a religious tradition to suit political pressure.',
        consequences: [
          { type: 'modify_opinion', target: 'sauromatian_women', value: -5 },
          { type: 'modify_opinion', target: 'traditional_imanians', value: 3 },
          { type: 'modify_resource', target: 'food', value: -2 },
        ],
      },
    ],
  },

  {
    id: 'cul_religious_tension_peaks',
    title: 'Words at the Fire',
    category: 'cultural',
    prerequisites: [
      { type: 'min_population', params: { value: 8 } },
      { type: 'min_year', params: { value: 2 } },
      { type: 'has_person_matching', params: { sex: 'female', religion: 'sacred_wheel' } },
    ],
    weight: 2,
    cooldown: 15,
    isUnique: false,
    actorRequirements: [
      { slot: 'woman', criteria: { sex: 'female', religion: 'sacred_wheel' } },
      { slot: 'objector', criteria: { sex: 'male', religion: 'imanian_orthodox' } },
    ],
    description:
      'You arrive at the central fire to find {objector} in heated argument ' +
      'with {woman}, {woman.her} arm extended, pointing up at the ' +
      'sky in what appears to be a theological challenge. {objector.He} tells {woman.her} ' +
      'the Wheel is a superstition for people who have never learned to reason. {woman.She} ' +
      'replies — in serviceable Imanian — that the Radiant One seems to have ' +
      'arranged things so that Imanian men come here to beg for Sauromatian ' +
      'daughters, which does not speak well for {objector.his} foresight.',
    choices: [
      {
        id: 'laugh_it_off',
        label: 'Laugh and tell everyone to get some sleep.',
        description:
          'Deflation through humour. Works tonight. Does not solve the ' +
          'underlying friction.',
        skipActorBond: true,
        consequences: [
          { type: 'modify_opinion_pair', target: '{objector}', value: -5, params: { slotB: '{woman}', label: 'Religious clash' } },
        ],
      },
      {
        id: 'side_with_woman',
        label: 'Tell the men quietly that faith is not a debate subject.',
        description:
          'She has earned a measure of respect. The men are not pleased, ' +
          'but they know you are right.',
        skipActorBond: true,
        consequences: [
          { type: 'modify_opinion', target: 'sauromatian_women', value: 4 },
          { type: 'modify_opinion', target: 'traditional_imanians', value: -3 },
          { type: 'modify_opinion_pair', target: '{objector}', value: -8, params: { slotB: '{woman}', label: 'Public rebuke' } },
        ],
      },
      {
        id: 'formal_rule',
        label: 'Establish a rule: no religious debate in common spaces.',
        description: 'The measure is neutral in principle. Whether both sides read it that way depends on how it is announced.',
        consequences: [
          { type: 'modify_standing', target: 'company', value: 1 },
        ],
        skillCheck: {
          skill: 'leadership',
          difficulty: 36,
          actorSelection: 'best_council',
          attemptLabel: 'Announce the rule',
        },
        successText: 'The rule is announced with exactly the right weight — firm enough to be respected, impartial enough to be fair. Both sides accept it. The fire is quieter for a week.',
        failureText: 'The rule is clear, but the delivery reads as a rebuke directed at one side. The peace holds. The perception does not.',
        onSuccess: [
          { type: 'modify_opinion', target: 'sauromatian_women',    value: 4 },
          { type: 'modify_opinion', target: 'traditional_imanians', value: 2 },
          { type: 'modify_opinion_pair', target: '{objector}', value: 3, params: { slotB: '{woman}', label: 'Mediated peace' } },
        ],
        onFailure: [
          { type: 'modify_opinion', target: 'sauromatian_women', value: -2 },
          { type: 'modify_opinion_pair', target: '{objector}', value: -6, params: { slotB: '{woman}', label: 'Unresolved tension' } },
        ],
      },
    ],
  },

  // ─── Cultural exchange & knowledge ────────────────────────────────────────

  {
    id: 'cul_craft_knowledge_shared',
    title: 'The Knot That Holds',
    category: 'cultural',
    prerequisites: [
      { type: 'min_year', params: { value: 1 } },
      { type: 'has_person_matching', params: { sex: 'female', religion: 'sacred_wheel' } },
    ],
    weight: 2,
    cooldown: 5,
    isUnique: false,
    actorRequirements: [
      { slot: 'craftswoman', criteria: { sex: 'female', religion: 'sacred_wheel', maxAge: 35 } },
    ],
    description:
      '{craftswoman} — one of the younger Sauromatian women — has been quietly ' +
      'watching the rope-work and cordage team for weeks. This morning {craftswoman.she} stepped ' +
      'in and demonstrated a binding technique that halved the time per joint ' +
      'and — your foreman estimates — would add years to any load-bearing line. ' +
      'The men look uncertain whether to be grateful or embarrassed.',
    choices: [
      {
        id: 'adopt_technique',
        label: 'Publicly acknowledge the technique and have her teach it to the team.',
        description: 'Practical and respectful. How well the integration lands depends on how it is handled.',
        consequences: [],
        skillCheck: {
          skill: 'custom',
          difficulty: 36,
          actorSelection: 'best_council',
          attemptLabel: 'Integrate the technique',
        },
        successText: 'The technique is absorbed with respect and reciprocity. The team is better for it, and she knows it was received properly.',
        failureText: 'The technique is adopted in pieces. Some men learn it well; others default to old habits. A partial improvement all the same.',
        onSuccess: [
          { type: 'modify_resource', target: 'goods', value: 4 },
          { type: 'modify_opinion',  target: 'sauromatian_women', value: 6 },
        ],
        onFailure: [
          { type: 'modify_resource', target: 'goods', value: 2 },
        ],
      },
      {
        id: 'adopt_quietly',
        label: 'Have the foreman learn it privately and integrate it without ceremony.',
        description:
          'The result is the same; the credit is diluted. She notices.',
        consequences: [
          { type: 'modify_resource', target: 'goods', value: 4 },
          { type: 'modify_opinion', target: 'sauromatian_women', value: -2 },
        ],
      },
      {
        id: 'decline',
        label: 'Thank her, but the team has their own methods.',
        description:
          'Your men appreciate the backing. The improvement goes unused.',
        consequences: [
          { type: 'modify_opinion', target: 'traditional_imanians', value: 2 },
        ],
      },
    ],
  },

  {
    id: 'cul_language_lesson',
    title: 'Borrowed Words',
    category: 'cultural',
    prerequisites: [
      { type: 'min_year', params: { value: 1 } },
      { type: 'has_person_matching', params: { sex: 'female', religion: 'sacred_wheel' } },
    ],
    weight: 2,
    cooldown: 6,
    isUnique: false,
    actorRequirements: [
      { slot: 'tutor', criteria: { sex: 'female', religion: 'sacred_wheel' } },
    ],
    description:
      '{tutor} has begun holding informal language ' +
      'sessions by the evening fire — Kiswani phrases for common tasks, in ' +
      'exchange for Imanian words for things {tutor.she} wants to be able to say. ' +
      'Several of your men have started joining {tutor.her}, more in curiosity than ' +
      'discipline. {tutor.She} has a gift for it: patient, precise, slightly wry ' +
      'about Imanian grammar. You could formalise the arrangement, leave it ' +
      'informal, or let it quietly disappear.',
    choices: [
      {
        id: 'formalise',
        label: 'Commission her as the settlement translator and language tutor.',
        description: 'Gives her a recognised role. Whether the Company finds the arrangement defensible depends on how it is framed.',
        consequences: [
          { type: 'modify_opinion', target: 'sauromatian_women', value: 8 },
        ],
        skillCheck: {
          skill: 'custom',
          difficulty: 35,
          actorSelection: 'best_council',
          attemptLabel: 'Establish the role',
        },
        successText: 'The arrangement finds a form the Company can live with. She gets a recognised role; the men get a teacher; the ledger shows a legitimate investment.',
        failureText: 'The formalisation looks too informal. A Company note arrives shortly after: the arrangement is flagged for review.',
        onSuccess: [],
        onFailure:  [{ type: 'modify_standing', target: 'company', value: -2 }],
      },
      {
        id: 'leave_informal',
        label: 'Leave it as it is — informal learning has its own virtue.',
        description: 'Things that grow naturally often hold better.',
        consequences: [
          { type: 'modify_opinion', target: 'sauromatian_women', value: 3 },
        ],
      },
      {
        id: 'let_lapse',
        label: 'Discourage it — divided attention is a productivity concern.',
        description:
          'The sessions stop. The brief warmth that surrounded them cools.',
        consequences: [
          { type: 'modify_opinion', target: 'sauromatian_women', value: -5 },
        ],
      },
    ],
  },

  {
    id: 'cul_joint_harvest',
    title: 'Side by Side at the Grain',
    category: 'cultural',
    prerequisites: [
      { type: 'min_population', params: { value: 10 } },
      { type: 'season_is', params: { season: 'autumn' } },
      { type: 'has_person_matching', params: { sex: 'female', religion: 'sacred_wheel' } },
    ],
    weight: 3,
    cooldown: 3,
    isUnique: false,
    description:
      'The autumn harvest push has everyone working past dark. For the first ' +
      'time since the Sauromatian women joined the settlement, there is simply ' +
      'no division of labour — every pair of hands is at the thresh floor, and ' +
      'they are working in teams mixed by proximity rather than origin. ' +
      'By the third day some of the teams have developed their own rhythms. ' +
      'You could mark the moment, reward it, or simply let it be.',
    choices: [
      {
        id: 'celebrate',
        label: 'Hold a small joint feast after the harvest is in.',
        description:
          'A shared table has its own kind of diplomacy. Costs food; ' +
          'returns more in morale.',
        consequences: [
          { type: 'modify_resource', target: 'food', value: -4 },
          { type: 'modify_opinion', target: 'sauromatian_women', value: 7 },
          { type: 'modify_opinion', target: 'traditional_imanians', value: 3 },
          { type: 'modify_standing', target: 'company', value: 1 },
        ],
      },
      {
        id: 'acknowledge',
        label: 'Note the good work formally and leave it at that.',
        description: 'Professional recognition suits the men better than celebration.',
        consequences: [
          { type: 'modify_opinion', target: 'sauromatian_women', value: 3 },
        ],
      },
      {
        id: 'nothing',
        label: 'No ceremony. The work speaks for itself.',
        description: 'The women return to their quarters. The moment passes.',
        consequences: [],
      },
    ],
  },

  // ─── Social tension & authority ────────────────────────────────────────────

  {
    id: 'cul_traditional_man_objects',
    title: 'A Man With Objections',
    category: 'cultural',
    prerequisites: [
      { type: 'min_year', params: { value: 1 } },
      { type: 'has_person_matching', params: { sex: 'female', religion: 'sacred_wheel' } },
    ],
    weight: 2,
    cooldown: 8,
    isUnique: false,
    actorRequirements: [
      { slot: 'objector', criteria: { sex: 'male', religion: 'imanian_orthodox' } },
    ],
    description:
      '{objector} requests a private word. {objector.He} is ' +
      'respectful, orderly, and clearly has been rehearsing this: he believes ' +
      'the arrangement with the Sauromatian women is undermining the moral ' +
      'framework the expedition was built on. He does not say they should leave, ' +
      'exactly. He says that the boundary between "practical arrangement" and ' +
      '"something permanent" was crossed some time ago without a formal decision, ' +
      'and that the men who feel as he does have a right to know where things stand.',
    choices: [
      {
        id: 'acknowledge_concern',
        label: 'Thank him and acknowledge the situation has evolved. Be direct about intent.',
        description: 'He appreciates honesty, even when he does not like the answer. The question is whether the answer is delivered well.',
        consequences: [
          { type: 'modify_standing', target: 'company', value: 1 },
        ],
        skillCheck: {
          skill: 'leadership',
          difficulty: 40,
          actorSelection: 'best_council',
          attemptLabel: 'Address the concern',
        },
        successText: 'You navigate the meeting with authority and honesty. He hears something that satisfies his need to be taken seriously. He nods and leaves — still watching, but quieter.',
        failureText: 'The acknowledgement reads as hedging. He leaves with his concerns received but not addressed. That is almost worse than being dismissed.',
        onSuccess: [
          { type: 'modify_opinion', target: 'traditional_imanians', value: 5 },
        ],
        onFailure: [
          { type: 'modify_opinion', target: 'traditional_imanians', value: -2 },
        ],
      },
      {
        id: 'reassure',
        label: 'Reassure him that the women\'s presence is temporary and practical.',
        description:
          'Reduces friction now. Stores it for later, when it is larger.',
        consequences: [
          { type: 'modify_opinion', target: 'traditional_imanians', value: 5 },
          { type: 'modify_opinion', target: 'sauromatian_women', value: -3 },
        ],
      },
      {
        id: 'rebuff',
        label: 'Tell him his objections are noted and that decisions are yours to make.',
        description:
          'Clear, but not gentle. He accepts the boundary. The conversation ' +
          'ends there, as do a few quieter ones you won\'t hear.',
        consequences: [
          { type: 'modify_opinion', target: 'traditional_imanians', value: -6 },
        ],
      },
    ],
  },

  {
    id: 'cul_women_organise',
    title: 'The Morning Count',
    category: 'cultural',
    prerequisites: [
      { type: 'min_population', params: { value: 9 } },
      { type: 'min_year', params: { value: 2 } },
      { type: 'has_person_matching', params: { sex: 'female', religion: 'sacred_wheel' } },
    ],
    weight: 2,
    cooldown: 15,
    isUnique: false,
    actorRequirements: [
      { slot: 'foreman', criteria: { sex: 'male' } },
      { slot: 'leader', criteria: { sex: 'female', religion: 'sacred_wheel' } },
    ],
    description:
      'You notice {leader} and the other Sauromatian women have begun taking a ' +
      'morning inventory — of food stores, tool wear, and medical supplies — ' +
      'before {foreman} does {foreman.his} rounds. The first time you thought it ' +
      'was coincidence. Now it is clearly routine, and their count is, frankly, ' +
      'more accurate than {foreman.his}. {foreman.He} has noticed too. {foreman.He} is not pleased.',
    choices: [
      {
        id: 'embrace',
        label: 'Formally assign the morning inventory to the women.',
        description:
          'Efficiency over tradition. Your foreman will need to find his ' +
          'contribution elsewhere.',
        consequences: [
          { type: 'modify_resource', target: 'food', value: 3 },
          { type: 'modify_resource', target: 'medicine', value: 1 },
          { type: 'modify_opinion', target: 'sauromatian_women', value: 8 },
          { type: 'modify_opinion', target: 'traditional_imanians', value: -5 },
        ],
      },
      {
        id: 'recognise_informally',
        label: 'Let things continue as they are — do not formalise, but do not stop them.',
        description: 'Things that work tend to persist without needing names.',
        consequences: [
          { type: 'modify_resource', target: 'food', value: 2 },
          { type: 'modify_opinion', target: 'sauromatian_women', value: 4 },
        ],
      },
      {
        id: 'defer_to_foreman',
        label: 'Back your foreman. One chain of command.',
        description:
          'Your foreman regains his dignity. The women return to other work ' +
          'without argument, which is somehow more unsettling than an argument.',
        consequences: [
          { type: 'modify_opinion', target: 'sauromatian_women', value: -6 },
          { type: 'modify_opinion', target: 'traditional_imanians', value: 4 },
        ],
      },
    ],
  },

  {
    id: 'cul_governance_debate',
    title: 'The Question of Council',
    category: 'cultural',
    prerequisites: [
      { type: 'min_population', params: { value: 12 } },
      { type: 'min_year', params: { value: 3 } },
      { type: 'has_person_matching', params: { sex: 'female', religion: 'sacred_wheel' } },
    ],
    weight: 2,
    cooldown: 20,
    isUnique: false,
    actorRequirements: [
      { slot: 'advocate', criteria: { sex: 'male', minAge: 30 } },
    ],
    description:
      '{advocate} raises a formal question that has been circulating ' +
      'informally for months: should the Sauromatian women be permitted to ' +
      'attend Council gatherings? Not to vote — {advocate.he} is careful to say this ' +
      'very precisely, twice — but to observe proceedings that affect the whole ' +
      'settlement. Two other men support the idea. One calls it dangerous. ' +
      'The Company charter is silent on the matter.',
    choices: [
      {
        id: 'admit_as_observers',
        label: 'Admit them as observers. They have a stake in what is decided.',
        description: 'Sets a precedent. How well the session is managed determines whether the precedent feels reasonable or reckless.',
        consequences: [
          { type: 'modify_opinion', target: 'traditional_imanians', value: -5 },
          { type: 'modify_standing', target: 'company', value: -2 },
        ],
        skillCheck: {
          skill: 'leadership',
          difficulty: 45,
          actorSelection: 'best_council',
          attemptLabel: 'Run the session',
        },
        successText: 'The session unfolds with more dignity than many expected. The women observe in silence. By the end the precedent feels like a reasonable step rather than a dangerous one.',
        failureText: 'The session lurches. Two men walk out. One woman is asked to leave after speaking without permission. The right idea, badly executed.',
        onSuccess: [{ type: 'modify_opinion', target: 'sauromatian_women', value: 12 }],
        onFailure:  [{ type: 'modify_opinion', target: 'sauromatian_women', value: 3  }],
      },
      {
        id: 'defer',
        label: 'Table the question until the Company weighs in.',
        description:
          'Safe. Conservative. Everyone is slightly unsatisfied, which may ' +
          'be the definition of a fair holding position.',
        consequences: [{ type: 'modify_standing', target: 'company', value: 1 }],
      },
      {
        id: 'refuse',
        label: 'Refuse. The Council is a company instrument.',
        description:
          'Clear authority. Clear cost.',
        consequences: [
          { type: 'modify_opinion', target: 'sauromatian_women', value: -8 },
          { type: 'modify_standing', target: 'company', value: 2 },
        ],
      },
    ],
  },

  // ─── Demographics & children ───────────────────────────────────────────────

  {
    id: 'cul_first_born_in_settlement',
    title: 'A Child at Dawn',
    category: 'cultural',
    prerequisites: [
      { type: 'min_population', params: { value: 11 } },
      { type: 'min_year', params: { value: 2 } },
      { type: 'has_person_matching', params: { sex: 'female', religion: 'sacred_wheel' } },
      // The child must exist before this birth announcement fires.
      { type: 'has_person_matching', params: { maxAge: 2 } },
    ],
    weight: 3,
    cooldown: 0,
    isUnique: true,
    actorRequirements: [
      { slot: 'newborn', criteria: { maxAge: 2 } },
      { slot: 'father', criteria: { sex: 'male' } },
    ],
    description:
      '{newborn.first} is born into the settlement before sunrise — ' +
      'already loud about it. {father} stands outside the birth ' +
      'room looking like a man who has just been informed of something vast. ' +
      'The Sauromatian midwife emerges, wipes her hands, and announces a ' +
      'successful birth in two languages at once. By breakfast the whole ' +
      'settlement knows. Everyone agrees {newborn.he} must be named. Agreement ends there.',
    choices: [
      {
        id: 'imanian_name',
        label: 'Give {newborn.him} an Imanian name — this is an expedition of the Imanian Compact.',
        description:
          'The father beams. The midwife inclines her head neutrally. The ' +
          'child does not yet have opinions.',
        consequences: [
          { type: 'modify_opinion', target: 'traditional_imanians', value: 5 },
          { type: 'modify_opinion', target: 'sauromatian_women', value: -3 },
        ],
      },
      {
        id: 'sauromatian_name',
        label: 'Give {newborn.him} a Sauromatian name — {newborn.his} mother\'s culture, {newborn.his} mother\'s line.',
        description:
          'The midwife smiles. It is the first time you have seen her smile. ' +
          'Several of the Sauromatian women come to see the child that afternoon.',
        consequences: [
          { type: 'modify_opinion', target: 'sauromatian_women', value: 8 },
          { type: 'modify_opinion', target: 'traditional_imanians', value: -4 },
        ],
      },
      {
        id: 'two_names',
        label: 'Give {newborn.him} two names — one from each tradition.',
        description:
          'She will carry both, and one day one will be the name she uses. ' +
          'That will be her decision.',
        consequences: [
          { type: 'modify_opinion', target: 'sauromatian_women', value: 6 },
          { type: 'modify_opinion', target: 'traditional_imanians', value: 3 },
          { type: 'modify_standing', target: 'company', value: 1 },
        ],
      },
    ],
  },

  {
    id: 'cul_daughters_majority',
    title: 'The Tally',
    category: 'cultural',
    prerequisites: [
      { type: 'min_population', params: { value: 12 } },
      { type: 'min_year', params: { value: 3 } },
      { type: 'cultural_blend_above', params: { value: 0.2 } },
      { type: 'has_person_matching', params: { sex: 'female', religion: 'sacred_wheel' } },
      // The demographic tally is meaningless without children to count.
      { type: 'has_person_matching', params: { maxAge: 16 } },
    ],
    weight: 2,
    cooldown: 20,
    isUnique: false,
    description:
      'At the quarterly population count you notice something for the first ' +
      'time: daughters outnumber sons among the settlement\'s children. Not by a ' +
      'little. The women call it Kethara\'s blessing, the old name for the Sacred ' +
      'Wheel\'s influence on birth. Some of the men find this amusing. Others do ' +
      'the arithmetic and go quiet for a while.',
    choices: [
      {
        id: 'embrace_wheel',
        label: 'Let the Sauromatian women explain Kethara\'s Bargain to those who will listen.',
        description: 'A delicate thing — opening a theological door in a settlement that has mostly kept them closed.',
        consequences: [
          { type: 'modify_opinion', target: 'traditional_imanians', value: -4 },
        ],
        skillCheck: {
          skill: 'custom',
          difficulty: 35,
          actorSelection: 'best_council',
          attemptLabel: 'Create the space',
        },
        successText: 'The conversation that follows is more thoughtful than expected. Some men listen with genuine curiosity. The arithmetic of daughters and sacred bargains becomes something shared rather than something foreign.',
        failureText: 'The discussion opens badly — too many objections, too little patience. The women explain as best they can. Some men remain closed to it.',
        onSuccess: [{ type: 'modify_opinion', target: 'sauromatian_women', value: 10 }],
        onFailure:  [{ type: 'modify_opinion', target: 'sauromatian_women', value: 4  }],
      },
      {
        id: 'record_only',
        label: 'Record the ratio in the ledger and say nothing about cause.',
        description: 'Data without interpretation. The men will interpret it anyway.',
        consequences: [{ type: 'modify_standing', target: 'company', value: 1 }],
      },
      {
        id: 'dismiss',
        label: 'Dismiss the count as statistical noise. One sample is meaningless.',
        description:
          'Technically defensible. The Sauromatian women exchange a look ' +
          'that you are not meant to understand, and apparently do.',
        consequences: [
          { type: 'modify_opinion', target: 'sauromatian_women', value: -4 },
        ],
      },
    ],
  },

  {
    id: 'cul_naming_dispute',
    title: 'The Naming Argument',
    category: 'cultural',
    prerequisites: [
      { type: 'min_population', params: { value: 11 } },
      { type: 'min_year', params: { value: 2 } },
      { type: 'has_person_matching', params: { sex: 'female', religion: 'sacred_wheel' } },
    ],
    weight: 2,
    cooldown: 10,
    isUnique: false,
    actorRequirements: [
      { slot: 'husband', criteria: { sex: 'male', maritalStatus: 'married', religion: 'imanian_orthodox' } },
      { slot: 'wife', criteria: { sex: 'female', maritalStatus: 'married', religion: 'sacred_wheel' } },
    ],
    description:
      '{husband} and {wife} argue — loudly enough that it reaches you — about the name ' +
      'of their expected child. {husband.He} wants a family name carried down the ' +
      'paternal line, as is Imanian custom. {wife.She} holds that the child\'s name ' +
      'comes through the mother\'s line and that this is not a custom but a fact. ' +
      'Both are convinced they are obviously right. Neither appears to be listening.',
    choices: [
      {
        id: 'mediate',
        label: 'Mediate: meet with both separately and find a name that carries both lines.',
        description:
          'Time-consuming and personal, but the couple will remember that you '  +
          'took it seriously.',
        consequences: [
          { type: 'modify_opinion', target: 'sauromatian_women', value: 4 },
          { type: 'modify_opinion', target: 'traditional_imanians', value: 3 },
        ],
      },
      {
        id: 'imanian_rule',
        label: 'Establish that formal records follow Imanian naming convention.',
        description:
          'The Company requires legible records. This is the practical answer. ' +
          'She writes the Sauromatian name alongside it in smaller letters, ' +
          'which you choose not to notice.',
        consequences: [
          { type: 'modify_opinion', target: 'traditional_imanians', value: 4 },
          { type: 'modify_opinion', target: 'sauromatian_women', value: -4 },
          { type: 'modify_standing', target: 'company', value: 1 },
        ],
      },
      {
        id: 'stay_out',
        label: 'Stay out of it entirely. This is not your matter.',
        description: 'They will figure it out. Or not. Either way: not your children.',
        consequences: [],
      },
    ],
  },

  // ─── Company & external optics ────────────────────────────────────────────

  {
    id: 'cul_company_informant_letter',
    title: 'Letter with Pointed Questions',
    category: 'cultural',
    prerequisites: [
      { type: 'min_year', params: { value: 2 } },
      { type: 'has_person_matching', params: { sex: 'female', religion: 'sacred_wheel' } },
    ],
    weight: 2,
    cooldown: 18,
    isUnique: false,
    description:
      'A company courier delivers the standard quarterly report request, but ' +
      'appended at the bottom in the Company Secretary\'s own hand are several ' +
      'additional questions: the number of "local women" currently residing in ' +
      'the settlement, their legal status under the expedition charter, and ' +
      'whether any "irregular arrangements" have affected the workforce. The ' +
      'phrasing is precise. The Company is asking without appearing to ask.',
    choices: [
      {
        id: 'full_honest_report',
        label: 'Report accurately and in full — including the marriages arranged.',
        description:
          'You can defend every decision. Having to defend them in writing ' +
          'may change the nature of some future decisions.',
        consequences: [
          { type: 'modify_standing', target: 'company', value: -3 },
          { type: 'modify_opinion', target: 'sauromatian_women', value: 3 },
        ],
      },
      {
        id: 'minimal_accurate',
        label: 'Answer only what was directly asked, accurately but briefly.',
        description:
          'The women are present, they contribute to the settlement, ' +
          'further detail is not requested. Technically complete.',
        consequences: [
          { type: 'modify_standing', target: 'company', value: 0 },
        ],
      },
      {
        id: 'omit',
        label: 'Report on workforce metrics only and omit the women from the count.',
        description: 'Simpler now. Whether the omission holds under scrutiny is another matter.',
        consequences: [],
        skillCheck: {
          skill: 'deception',
          difficulty: 42,
          actorSelection: 'best_council',
          attemptLabel: 'Craft the numbers',
        },
        successText: 'The metrics read clean, the women do not appear in the headcount, and the Secretary\'s questions receive brisk, technical answers. For now, it holds.',
        failureText: 'The numbers do not quite add up. The Secretary is a careful reader. A follow-up letter arrives three weeks later with more specific questions.',
        onSuccess: [{ type: 'modify_standing', target: 'company', value: 2  }],
        onFailure:  [{ type: 'modify_standing', target: 'company', value: -4 }],
      },
    ],
  },

  {
    id: 'cul_cosmopolitan_advocate',
    title: 'The Broker',
    category: 'cultural',
    prerequisites: [{ type: 'min_population', params: { value: 8 } }, { type: 'min_year', params: { value: 1 } }],
    weight: 2,
    cooldown: 14,
    isUnique: false,
    actorRequirements: [
      { slot: 'broker', criteria: { sex: 'male', minSkill: { skill: 'bargaining', value: 40 } } },
    ],
    description:
      '{broker} — a man who grew up near the Kiswani trading ports ' +
      'and speaks three languages with equal fluency — approaches you with a ' +
      'proposal. {broker.He} believes the settlement\'s greatest friction is a translation ' +
      'problem, not a cultural one: people are misreading intent because they ' +
      'are filling in what they do not understand. {broker.He} wants to start a regular ' +
      'mediation session — informal, optional, an hour a week. {broker.He} needs only ' +
      'your blessing and a fire to sit around.',
    choices: [
      {
        id: 'support',
        label: 'Give him your backing and attend the first session yourself.',
        description: 'Your presence makes it serious — or makes it a performance. The outcome depends on how you read the room.',
        consequences: [
          { type: 'modify_opinion', target: 'sauromatian_women',    value: 5 },
          { type: 'modify_opinion', target: 'traditional_imanians', value: 3 },
        ],
        skillCheck: {
          skill: 'diplomacy',
          difficulty: 35,
          actorSelection: 'best_council',
          attemptLabel: 'Facilitate the session',
        },
        successText: 'Your presence sets a tone of genuine inquiry. People say things they did not expect to, and hear things they did not expect to. The broker is quietly pleased.',
        failureText: 'Your presence turns the session into a performance. People say the right things toward you rather than to each other. The broker adjusts.',
        onSuccess: [
          { type: 'modify_opinion', target: 'sauromatian_women',    value: 3 },
          { type: 'modify_opinion', target: 'traditional_imanians', value: 2 },
        ],
        onFailure: [
          { type: 'modify_opinion', target: 'traditional_imanians', value: -2 },
        ],
      },
      {
        id: 'permit_only',
        label: 'Permit it, but stay away — an official presence may constrain people.',
        description: 'He runs it well. People say things they would not say near you.',
        consequences: [
          { type: 'modify_opinion', target: 'sauromatian_women', value: 5 },
          { type: 'modify_opinion', target: 'traditional_imanians', value: 3 },
        ],
      },
      {
        id: 'decline',
        label: 'Decline. Formal mediation suggests formal conflict — and that narrative is bad.',
        description:
          'He accepts this reasoning. The frictions continue without a ' +
          'designated space to air them.',
        consequences: [],
      },
    ],
  },

  {
    id: 'cul_elder_settles_dispute',
    title: 'The Elder Speaks',
    category: 'cultural',
    prerequisites: [
      { type: 'min_population', params: { value: 10 } },
      { type: 'min_year', params: { value: 2 } },
      { type: 'has_person_matching', params: { sex: 'female', religion: 'sacred_wheel' } },
    ],
    weight: 2,
    cooldown: 14,
    isUnique: false,
    actorRequirements: [
      { slot: 'elder', criteria: { sex: 'female', religion: 'sacred_wheel', minAge: 40 } },
    ],
    description:
      'A long-running dispute between two settlers over shared tool storage ' +
      'has escalated to the point where both men have come to you separately ' +
      'asking you to rule against the other. Before you can schedule the ' +
      'meeting, you discover it has already been resolved — by {elder}, ' +
      'one of the elder Sauromatian women in the settlement, who apparently heard both sides, ' +
      'proposed a physical partition, and had a handshake agreement in place ' +
      'before dinner. Both men seem slightly embarrassed by this.',
    choices: [
      {
        id: 'recognise_role',
        label: 'Acknowledge her mediation publicly and confirm the settlement.',
        description:
          'She has done your work. Better to name the contribution than ' +
          'pretend it did not happen.',
        consequences: [
          { type: 'modify_opinion', target: 'sauromatian_women', value: 8 },
          { type: 'modify_standing', target: 'company', value: 1 },
        ],
      },
      {
        id: 'accept_quietly',
        label: 'Accept the outcome and let the incident pass without comment.',
        description:
          'Practical. Does not establish her authority — but did not need to.',
        consequences: [
          { type: 'modify_opinion', target: 'sauromatian_women', value: 3 },
        ],
      },
      {
        id: 'override',
        label: 'Call your own meeting and issue a ruling regardless — you are the authority here.',
        description:
          'The men are confused. The elder watches you, says nothing, ' +
          'and returns to her work.',
        consequences: [
          { type: 'modify_opinion', target: 'sauromatian_women', value: -8 },
          { type: 'modify_opinion', target: 'traditional_imanians', value: 2 },
        ],
      },
    ],
  },

  {
    id: 'cul_cultural_festival',
    title: 'Common Ground',
    category: 'cultural',
    prerequisites: [
      { type: 'min_population', params: { value: 14 } },
      { type: 'min_year', params: { value: 3 } },
      { type: 'cultural_blend_above', params: { value: 0.2 } },
      { type: 'has_person_matching', params: { sex: 'female', religion: 'sacred_wheel' } },
    ],
    weight: 2,
    cooldown: 20,
    isUnique: false,
    description:
      'Someone — no one is quite sure who proposed it first — has organised a ' +
      'settlement-wide day of rest, with a shared meal and an open evening where ' +
      'the Sauromatian women have agreed to demonstrate the Wheel-Turning story ' +
      'as a kind of walking theatre, while the Imanian men have agreed to teach ' +
      'the Folding Song, an antiphon only they know all the words to. The idea ' +
      'is alarming and intriguing in equal measure. No one has done anything like ' +
      'this before.',
    choices: [
      {
        id: 'full_support',
        label: 'Commit settlement resources and attend all day.',
        description:
          'It is not unifying in any simple way. But something happens that ' +
          'evening that does not have a name yet.',
        consequences: [
          { type: 'modify_resource', target: 'food', value: -6 },
          { type: 'modify_opinion', target: 'sauromatian_women', value: 10 },
          { type: 'modify_opinion', target: 'traditional_imanians', value: 7 },
          { type: 'modify_standing', target: 'company', value: 2 },
        ],
      },
      {
        id: 'moderate_support',
        label: 'Permit it and provide food. Attend briefly.',
        description:
          'Visible endorsement without full commitment. People enjoy themselves.',
        consequences: [
          { type: 'modify_resource', target: 'food', value: -3 },
          { type: 'modify_opinion', target: 'sauromatian_women', value: 6 },
          { type: 'modify_opinion', target: 'traditional_imanians', value: 4 },
        ],
      },
      {
        id: 'permit_only',
        label: 'Permit it on people\'s own time. Settlement expenses are for essentials.',
        description:
          'The festival happens anyway. It is smaller. It is still something.',
        consequences: [
          { type: 'modify_opinion', target: 'sauromatian_women', value: 3 },
          { type: 'modify_opinion', target: 'traditional_imanians', value: 2 },
        ],
      },
    ],
  },

  // ─── Language tension ─────────────────────────────────────────────────────

  {
    id: 'cul_tongue_war',
    title: 'What He Said',
    category: 'cultural',
    prerequisites: [
      { type: 'min_population', params: { value: 8 } },
      { type: 'language_tension_above', params: { threshold: 0.4 } },
    ],
    weight: 3,
    cooldown: 10,
    isUnique: false,
    actorRequirements: [
      { slot: 'imanian', criteria: { sex: 'male', religion: 'imanian_orthodox' } },
      { slot: 'sauromatian', criteria: { sex: 'female', religion: 'sacred_wheel' } },
    ],
    description:
      'At the evening meal, a heated exchange between {imanian} and {sauromatian} ' +
      'spills into the open. Neither has more than a few words of the other\'s language. ' +
      'The rest of the settlement watches. What started as a dispute over a shared tool ' +
      'has become, in the absence of a shared tongue, something that sounds much worse ' +
      'than it probably is. Volume is filling the gap that vocabulary cannot.',
    choices: [
      {
        id: 'mediate_directly',
        label: 'Step in and mediate — use whoever can translate, even imperfectly.',
        description:
          'A halting three-way conversation. Most of what is said is approximate. ' +
          'But the temperature comes down and neither party walks away feeling dismissed.',
        consequences: [
          { type: 'modify_opinion', target: 'sauromatian_women',    value: 3 },
          { type: 'modify_opinion', target: 'traditional_imanians', value: 3 },
        ],
        skillCheck: {
          skill: 'diplomacy',
          difficulty: 42,
          actorSelection: 'best_council',
          attemptLabel: 'Bridge the gap',
        },
        successText: 'The translation is imperfect but the intent is clear. Both parties say something they did not know they needed to say. The issue that started it was, in the end, the tool.',
        failureText: 'The mediation becomes a second argument, this time about what was or wasn\'t said. You separate them before it escalates further, but nothing is resolved.',
        onSuccess: [
          { type: 'modify_standing', target: 'company', value: 1 },
        ],
        onFailure: [
          { type: 'modify_opinion', target: 'sauromatian_women',    value: -2 },
          { type: 'modify_opinion', target: 'traditional_imanians', value: -2 },
        ],
      },
      {
        id: 'enforce_silence',
        label: 'Order both parties to drop it until morning, then hear them separately.',
        description:
          'Authority over understanding. It works in the short term. ' +
          'The underlying tension finds another outlet soon enough.',
        consequences: [
          { type: 'modify_standing', target: 'company', value: 1 },
          { type: 'modify_opinion', target: 'sauromatian_women',    value: -4 },
          { type: 'modify_opinion', target: 'traditional_imanians', value: -2 },
        ],
      },
      {
        id: 'assign_language_lessons',
        label: 'Turn the incident into a policy: assign shared language lessons for all settlers.',
        description:
          'This will not fix the immediate argument. But it is the only response ' +
          'that addresses the cause rather than the symptom.',
        consequences: [
          { type: 'modify_opinion', target: 'sauromatian_women',    value: 5 },
          { type: 'modify_opinion', target: 'traditional_imanians', value: -1 },
          { type: 'modify_resource', target: 'goods', value: -2 },
        ],
      },
    ],
  },
];
