/**
 * Domestic events — internal settlement life, settler behaviour, and morale.
 *
 * These events humanise the men under your command and force choices between
 * efficiency, fairness, and the emotional realities of frontier life.
 */

import type { GameEvent } from '../engine';

export const DOMESTIC_EVENTS: GameEvent[] = [
  {
    id: 'dom_hunting_party',
    title: 'Game Tracks Spotted',
    category: 'domestic',
    prerequisites: [],
    actorRequirements: [
      { slot: 'scout', criteria: { sex: 'male' } },
    ],
    weight: 3,
    cooldown: 5,
    isUnique: false,
    description:
      '{scout} returns to camp excited: he has found fresh game tracks nearby ' +
      '— deer, by the depth and pattern of them, and in good number. An organized ' +
      'hunt could put real meat in the stores and lift spirits among the men. The ' +
      'question is how much to commit.',
    choices: [
      {
        id: 'full_hunt',
        label: 'Organize a proper hunting party — four men, full kit.',
        description: 'Commit properly and the return will be worth it. Costs a little in supplies.',
        consequences: [
          { type: 'modify_resource', target: 'goods', value: -1 },
        ],
        skillCheck: {
          skill: 'hunting',
          difficulty: 35,
          actorSelection: 'best_council',
          attemptLabel: 'Lead the hunt',
        },
        successText: 'The hunting party returns laden with deer. The men are in good spirits and the stores are fuller for it.',
        failureText: 'Despite the promising tracks, the party returns nearly empty-handed. The forest gave nothing today.',
        onSuccess: [{ type: 'modify_resource', target: 'food', value: 15 }],
        onFailure:  [{ type: 'modify_resource', target: 'food', value: 3  }],
      },
      {
        id: 'light_foray',
        label: 'Send two men for a quick foray.',
        description: 'Minimal disruption to regular work. Modest return.',
        consequences: [{ type: 'modify_resource', target: 'food', value: 5 }],
      },
      {
        id: 'stay_the_course',
        label: 'Keep everyone at their assigned work.',
        description: 'Routine and discipline over windfalls.',
        consequences: [],
      },
    ],
  },

  {
    id: 'dom_homesick_man',
    title: 'The Weight of Distance',
    category: 'domestic',
    prerequisites: [],
    actorRequirements: [
      { slot: 'settler', criteria: { sex: 'male', religion: 'imanian_orthodox' } },
    ],
    weight: 2,
    cooldown: 0,
    isUnique: true,
    description:
      '{settler} comes to you after the evening meal. {settler.He} misses {settler.his} family. ' +
      '{settler.He} misses the city — the noise of it, the familiar smells. The wilderness is ' +
      'getting to {settler.him}, and you can see it in the way {settler.he} stares at the tree line at ' +
      'night, at the dark where the firelight ends. {settler.He} has not asked to leave. ' +
      'Not yet.',
    choices: [
      {
        id: 'speak_plainly',
        label: 'Speak plainly: this is the life we chose.',
        description: 'He signed his contract. Acknowledge his honesty without softening the truth.',
        consequences: [],
        skillCheck: {
          skill: 'leadership',
          difficulty: 40,
          actorSelection: 'best_council',
          attemptLabel: 'Address the man',
        },
        successText: 'He listens. When you are done he nods — the quiet nod of a man who needed to hear it said plainly. He is back at his post the next morning.',
        failureText: 'The words land wrong. He says nothing more, but the distance in his eyes does not go away. You will need to spend something to keep him here.',
        onSuccess: [],
        onFailure:  [{ type: 'modify_resource', target: 'gold', value: -3 }],
      },
      {
        id: 'give_bonus',
        label: 'Give him something extra from the reserves.',
        description:
          'A few coins — a gesture that his service is seen and valued. It costs you, but it costs less than losing him.',
        consequences: [{ type: 'modify_resource', target: 'gold', value: -5 }],
      },
      {
        id: 'invoke_contract',
        label: 'Remind him of his contract with the Ansberry Company.',
        description: 'He has an obligation and he knows it. The Company does not release men lightly.',
        consequences: [],
      },
    ],
  },

  {
    id: 'dom_settler_initiative',
    title: 'Men at Work',
    category: 'domestic',
    prerequisites: [],
    actorRequirements: [
      { slot: 'lead',    criteria: { sex: 'male' } },
      { slot: 'partner', criteria: { sex: 'male' } },
    ],
    weight: 2,
    cooldown: 0,
    isUnique: true,
    description:
      '{lead} and {partner} have been spending their evenings improving the settlement ' +
      'entirely on their own initiative — better drainage channels, a covered ' +
      'chimney on the cook-fire, the dry stores reorganized out of reach of ' +
      'the damp. They ask your permission to make it a formal project, and for ' +
      'some lumber to do it properly.',
    choices: [
      {
        id: 'back_the_project',
        label: 'Approve it. Give them the materials they need.',
        description: 'Investment in infrastructure pays off. Whether the project delivers its full potential depends on who leads it.',
        consequences: [
          { type: 'modify_resource', target: 'lumber', value: -3 },
        ],
        skillCheck: {
          skill: 'custom',
          difficulty: 30,
          actorSelection: 'best_council',
          attemptLabel: 'Oversee the project',
        },
        successText: 'The project exceeds expectations — better drainage, tighter storage, a chimney that actually draws. The men are genuinely proud of it.',
        failureText: 'The project is done, but the execution is rougher than hoped. The basics are addressed. The refinements will need another attempt.',
        onSuccess: [
          { type: 'modify_resource', target: 'food',  value: 7 },
          { type: 'modify_resource', target: 'goods', value: 2 },
        ],
        onFailure: [
          { type: 'modify_resource', target: 'food', value: 2 },
        ],
      },
      {
        id: 'encourage_informally',
        label: "Commend the initiative. Let them continue on their own terms.",
        description: 'They work with what they have. A modest improvement.',
        consequences: [{ type: 'modify_resource', target: 'food', value: 3 }],
      },
      {
        id: 'redirect_them',
        label: 'Redirect their energy toward assigned tasks.',
        description: 'Initiative is admirable, but routine keeps a settlement alive.',
        consequences: [],
      },
    ],
  },

  // ─── Cross-cultural events ────────────────────────────────────────────────

  {
    id: 'dom_riverfolk_widow',
    title: 'The Riverfolk Widow',
    category: 'domestic',
    prerequisites: [
      { type: 'tribe_exists',            params: { tribeId: 'njaro_matu_riverfolk' } },
      { type: 'tribe_disposition_above', params: { tribeId: 'njaro_matu_riverfolk', value: -20 } },
    ],
    weight: 2,
    cooldown: 20,
    isUnique: false,
    description:
      'A Kiswani Riverfolk woman arrives at the settlement boundary with two young daughters ' +
      'and a bundle of possessions. She speaks haltingly in trade-talk: her husband was killed ' +
      'in a raid three moons past. Her sisters took her land. She has nowhere to go. She asks ' +
      'for shelter. Her daughters are quiet and wide-eyed, watching you.',
    choices: [
      {
        id: 'welcome_freely',
        label: 'Welcome them without condition.',
        description: 'She and her daughters are given a place to sleep and a share of the work. Word like this travels.',
        consequences: [
          { type: 'modify_disposition', target: 'njaro_matu_riverfolk', value: 10 },
          { type: 'add_person', target: 'widow', value: 1, params: { sex: 'female', ethnicGroup: 'kiswani_riverfolk', minAge: 28, maxAge: 42, religion: 'sacred_wheel', socialStatus: 'newcomer' } },
          { type: 'add_person', target: 'daughter', value: 2, params: { sex: 'female', ethnicGroup: 'kiswani_riverfolk', minAge: 6, maxAge: 14, religion: 'sacred_wheel', socialStatus: 'newcomer' } },
        ],
      },
      {
        id: 'welcome_conditional',
        label: 'Welcome them — but make clear the eldest daughter will marry one of your men in time.',
        description: 'A pragmatic arrangement. How it is offered will determine how it is received.',
        consequences: [
          { type: 'add_person', target: 'widow', value: 1, params: { sex: 'female', ethnicGroup: 'kiswani_riverfolk', minAge: 28, maxAge: 42, religion: 'sacred_wheel', socialStatus: 'newcomer' } },
          { type: 'add_person', target: 'daughter', value: 2, params: { sex: 'female', ethnicGroup: 'kiswani_riverfolk', minAge: 6, maxAge: 14, religion: 'sacred_wheel', socialStatus: 'newcomer' } },
        ],
        skillCheck: {
          skill: 'diplomacy',
          difficulty: 40,
          actorSelection: 'best_council',
          attemptLabel: 'State the terms',
        },
        successText: 'The terms are stated plainly, without cruelty. She understands and agrees. When word reaches the tribe, the arrangement will read as an honest compact.',
        failureText: 'The condition is stated too quickly, too clinically. She agrees because she has no other choice. Word of how the offer was made will reach the tribe.',
        onSuccess: [
          { type: 'modify_disposition', target: 'njaro_matu_riverfolk', value: 8 },
        ],
        onFailure: [
          { type: 'modify_disposition', target: 'njaro_matu_riverfolk', value: -3 },
        ],
      },
      {
        id: 'shelter_temporary',
        label: 'Give them shelter through the season only. No promises.',
        description: 'A small act of charity with no commitment.',
        consequences: [],
      },
      {
        id: 'turn_away',
        label: 'Turn them away. This is a men\'s outpost, not a refuge.',
        description: 'She leaves without protest, but the daughters look back. Word will reach the tribe.',
        consequences: [
          { type: 'modify_disposition', target: 'njaro_matu_riverfolk', value: -12 },
        ],
      },
    ],
  },

  {
    id: 'dom_company_send_women',
    title: 'Company Directive: Send Women',
    category: 'domestic',
    prerequisites: [
      { type: 'min_year',               params: { value: 2 } },
      { type: 'company_standing_above', params: { value: 40 } },
    ],
    weight: 2,
    cooldown: 0,
    isUnique: true,
    description:
      'A Company courier arrives with a sealed letter. The Ansberry Company has noted your ' +
      'settlement\'s low female population — a liability for long-term productivity and morale, ' +
      'per their demographic assessments. They offer a solution: Imanian women of good standing ' +
      'have volunteered for frontier postings at the rate of fifty gold crowns per placement. ' +
      'The Company will facilitate transport and contracts. Your response will be noted.',
    choices: [
      {
        id: 'request_three',
        label: 'Request three women. (−150 gold)',
        description: 'A substantial investment in the settlement\'s future.',
        consequences: [
          { type: 'modify_resource', target: 'gold', value: -150 },
          { type: 'add_person', target: 'imanian_woman', value: 3, params: { sex: 'female', ethnicGroup: 'imanian', minAge: 18, maxAge: 30, religion: 'imanian_orthodox', socialStatus: 'newcomer' } },
        ],
      },
      {
        id: 'request_one',
        label: 'Request one woman. (−50 gold)',
        description: 'Modest but affordable. The Company will note your restraint.',
        consequences: [
          { type: 'modify_resource', target: 'gold', value: -50 },
          { type: 'add_person', target: 'imanian_woman', value: 1, params: { sex: 'female', ethnicGroup: 'imanian', minAge: 18, maxAge: 30, religion: 'imanian_orthodox', socialStatus: 'newcomer' } },
        ],
      },
      {
        id: 'decline',
        label: 'Decline for now. You will manage your own affairs.',
        description: 'The Company records your refusal without comment.',
        consequences: [],
      },
      {
        id: 'request_craftsmen',
        label: 'Decline — but request skilled craftsmen instead. (−80 gold)',
        description: 'A counter-proposal. Whether the Company sends its best depends on how the request is made.',
        consequences: [
          { type: 'modify_resource', target: 'gold', value: -80 },
        ],
        skillCheck: {
          skill: 'bargaining',
          difficulty: 38,
          actorSelection: 'best_council',
          attemptLabel: 'Make the case',
        },
        successText: 'The counter-proposal is well-argued. The Company notes the practical reasoning and sends good men.',
        failureText: 'The request is accepted but filed under "eccentric preference". The craftsmen who arrive are competent, but not their best.',
        onSuccess: [{ type: 'modify_resource', target: 'goods', value: 10 }],
        onFailure:  [{ type: 'modify_resource', target: 'goods', value: 5  }],
      },
    ],
  },

  {
    id: 'dom_sauromatian_proposal',
    title: 'A Sauromatian Proposal',
    category: 'domestic',
    prerequisites: [
      // The tribe is offering a husband to one of your Sauromatian women specifically.
      { type: 'has_person_matching', params: { sex: 'female', minAge: 16, religion: 'sacred_wheel' } },
      { type: 'tribe_exists',        params: { tribeId: 'thunder_veil_band' } },
    ],
    actorRequirements: [
      { slot: 'bride', criteria: { sex: 'female', religion: 'sacred_wheel', maritalStatus: 'unmarried', minAge: 16 } },
    ],
    weight: 2,
    cooldown: 15,
    isUnique: false,
    description:
      'A delegation from one of the Hanjoda tribes arrives — three women and an interpreter. ' +
      'They have a young man with them, perhaps twenty years old, lean and watchful. The ' +
      "interpreter explains: he is a good hunter, unmarried, healthy. The tribe is offering " +
      'him as a husband to {bride} in exchange for steel. An unusual ' +
      'arrangement, but not an unre asonable one.',
    choices: [
      {
        id: 'accept',
        label: 'Accept the arrangement. (−5 steel)',
        description: 'A husband gained, a relationship with the tribe cemented.',
        consequences: [
          { type: 'modify_resource',    target: 'steel',              value: -5 },
          { type: 'modify_disposition', target: 'thunder_veil_band',  value: 8  },
          { type: 'add_person', target: 'hanjoda_man', value: 1, params: { sex: 'male', ethnicGroup: 'hanjoda_stormcaller', minAge: 18, maxAge: 24, religion: 'sacred_wheel', socialStatus: 'newcomer' } },
        ],
      },
      {
        id: 'negotiate',
        label: 'Accept, but negotiate for more — he should bring cattle or trade goods.',
        description: 'You push harder. Whether they concede depends on how the demand is pressed.',
        consequences: [
          { type: 'modify_resource', target: 'steel', value: -5 },
          { type: 'add_person', target: 'hanjoda_man', value: 1, params: { sex: 'male', ethnicGroup: 'hanjoda_stormcaller', minAge: 18, maxAge: 24, religion: 'sacred_wheel', socialStatus: 'newcomer' } },
        ],
        skillCheck: {
          skill: 'bargaining',
          difficulty: 45,
          actorSelection: 'best_council',
          attemptLabel: 'Push for better terms',
        },
        successText: 'A hard negotiation, well conducted. They concede cattle and goods above the original offer. The tribe respects a man who knows when to push.',
        failureText: 'The counter-offer is accepted, but barely. They concede one animal and no more. The arrangement is made; the goodwill is not.',
        onSuccess: [
          { type: 'modify_resource',    target: 'cattle',            value: 4 },
          { type: 'modify_disposition', target: 'thunder_veil_band', value: 6 },
        ],
        onFailure: [
          { type: 'modify_resource',    target: 'cattle',            value: 1 },
          { type: 'modify_disposition', target: 'thunder_veil_band', value: 1 },
        ],
      },
      {
        id: 'decline_politely',
        label: 'Decline with respect.',
        description: 'You are not in the business of arranging marriages on behalf of others. The tribe understands.',
        consequences: [
          { type: 'modify_disposition', target: 'thunder_veil_band', value: -3 },
        ],
      },
    ],
  },

  {
    id: 'dom_lonely_settler',
    title: 'The Lonely Settler',
    category: 'domestic',
    prerequisites: [
      { type: 'has_person_matching', params: { sex: 'male', minAge: 25 } },
      // The narrative is specific: he has feelings for one of the Sauromatian women.
      // minAge: 16 ensures she is of marriageable age, not a child.
      { type: 'has_person_matching', params: { sex: 'female', minAge: 16, religion: 'sacred_wheel' } },
    ],
    actorRequirements: [
      { slot: 'suitor',  criteria: { sex: 'male',   minAge: 25 } },
      { slot: 'beloved', criteria: { sex: 'female', religion: 'sacred_wheel', maritalStatus: 'unmarried' } },
    ],
    weight: 2,
    cooldown: 12,
    isUnique: false,
    description:
      '{suitor} comes to you privately. {suitor.He} is awkward about it but direct: {suitor.he} ' +
      'has developed strong feelings for {beloved}. ' +
      '{suitor.He} has not spoken to {beloved.her} about it. {suitor.He} is asking your permission — or at least your ' +
      'blessing — before {suitor.he} makes {suitor.his} intentions known. {suitor.He} is a good man and has served ' +
      'faithfully. {beloved.She}, for {beloved.her} part, has shown no sign of objection.',
    choices: [
      {
        id: 'bless_union',
        label: 'Give them your blessing. Let them find their own way.',
        description: 'A small happiness in a hard place. Both will work better for it.',
        consequences: [],
      },
      {
        id: 'forbid',
        label: 'Forbid it. The settlement is not a matchmaking house.',
        description: 'He is chastened. She is confused. Neither is pleased with you.',
        consequences: [],
      },
      {
        id: 'arrange_formally',
        label: 'Arrange it formally, with gifts and acknowledgment. (−5 goods)',
        description: 'Doing it properly shows respect for her culture and his commitment. A better outcome for all.',
        consequences: [
          { type: 'modify_resource', target: 'goods', value: -5 },
        ],
      },
    ],
  },

  {
    id: 'dom_first_harvest',
    title: 'Festival of the First Harvest',
    category: 'domestic',
    prerequisites: [
      { type: 'season_is',  params: { season: 'autumn' } },
      { type: 'min_year',   params: { value: 1 } },
      // All three choices reference Sauromatian women's traditions — event needs them present.
      { type: 'has_person_matching', params: { sex: 'female', religion: 'sacred_wheel' } },
    ],
    actorRequirements: [
      { slot: 'ceremony_leader', criteria: { sex: 'female', religion: 'sacred_wheel' } },
    ],
    weight: 3,
    cooldown: 4,
    isUnique: false,
    description:
      'The harvest is in — not abundant, but real. Your men want to mark it. {ceremony_leader} ' +
      'and the other Sauromatian women in the settlement have their own traditions for this time of year: offerings at ' +
      "the water's edge, songs that go on past dark, a particular way of braiding grain that " +
      'carries meaning you have not yet learned. You must decide how to honour the season.',
    choices: [
      {
        id: 'imanian_ceremony',
        label: 'Hold an Imanian ceremony — prayer, a shared meal, familiar forms.',
        description: 'The men are comfortable. The Sauromatian women watch from the edge of the firelight.',
        consequences: [
          { type: 'modify_resource', target: 'food', value: -5 },
        ],
      },
      {
        id: 'sauromatian_ceremony',
        label: 'Let the Sauromatian women lead their own ceremony. Encourage the men to observe.',
        description: 'Strange and beautiful. Some men are unsettled. Others are quietly moved.',
        consequences: [
          { type: 'modify_resource',    target: 'food',              value: -5 },
          { type: 'modify_standing',    target: 'company',           value: -2 },
        ],
      },
      {
        id: 'joint_celebration',
        label: 'Blend both traditions — a joint celebration, Imanian and Sauromatian together.',
        description: 'Something new could begin here. How well it comes together depends on who shapes the evening.',
        consequences: [
          { type: 'modify_resource', target: 'food', value: -8 },
        ],
        skillCheck: {
          skill: 'custom',
          difficulty: 38,
          actorSelection: 'best_council',
          attemptLabel: 'Shape the evening',
        },
        successText: 'The celebration finds its footing. Both traditions have space. By late evening it is simply a good meal shared between people who might, slowly, become neighbours in more than geography.',
        failureText: 'The blend creates friction rather than synthesis. The food is good, the company awkward. The moment passes without becoming a memory.',
        onSuccess: [],
        onFailure:  [{ type: 'modify_standing', target: 'company', value: -2 }],
      },
    ],
  },

  {
    id: 'dom_mixed_child_born',
    title: 'A Child Between Worlds',
    category: 'domestic',
    prerequisites: [
      { type: 'cultural_blend_above', params: { value: 0.1 } },
      { type: 'min_year',             params: { value: 1   } },
      // Require at least one infant/toddler — the child must actually exist.
      { type: 'has_person_matching',  params: { maxAge: 2  } },
    ],
    weight: 3,
    cooldown: 0,
    isUnique: true,
    description:
      'The first child born of Imanian and Sauromatian blood has arrived. The birth was ' +
      'uncomplicated. The child is healthy. She has her mother\'s cheekbones and perhaps her ' +
      'father\'s eyes — it is too early to say. She is the first of something that has no name ' +
      'yet. Your settlers look to you for guidance on how to mark the moment.',
    choices: [
      {
        id: 'celebrate_publicly',
        label: 'Celebrate publicly. This child is a sign of what this settlement can become.',
        description: 'A small feast, a blessing spoken aloud. The more traditional men are quiet, but they raise their cups.',
        consequences: [
          { type: 'modify_resource', target: 'food', value: -6 },
        ],
      },
      {
        id: 'acknowledge_quietly',
        label: 'Acknowledge it quietly. Give the mother a gift. Keep the moment private.',
        description: 'Respectful and politically careful. Good for stability.',
        consequences: [
          { type: 'modify_resource', target: 'goods', value: -3 },
        ],
      },
      {
        id: 'name_imanian',
        label: 'Name the child in Imanian tradition, publicly.',
        description: 'The father\'s family name passes to this child. The Company will approve.',
        consequences: [
          { type: 'modify_standing', target: 'company', value: 3 },
        ],
      },
    ],
  },

  {
    id: 'dom_elder_complaint',
    title: 'The Elder\'s Complaint',
    category: 'domestic',
    prerequisites: [
      { type: 'cultural_blend_above', params: { value: 0.3 } },
    ],
    actorRequirements: [
      { slot: 'elder', criteria: { sex: 'male', minAge: 40 } },
    ],
    weight: 2,
    cooldown: 8,
    isUnique: false,
    description:
      '{elder} — a founding member, deeply Imanian in {elder.his} customs — ' +
      'has requested a private audience. {elder.He} is not angry, exactly. But {elder.he} is worried. {elder.He} ' +
      'remembers why the Company sent men here: to establish an Imanian presence, to trade ' +
      'on Imanian terms. {elder.He} has been watching the settlement drift. The language at the ' +
      "fire has been changing. The saints' days go unmarked. {elder.He} asks you: are we still " +
      'Imanian here?',
    choices: [
      {
        id: 'reassure',
        label: 'Reassure him. You remain Imanian at your core.',
        description: 'He is not entirely convinced, but he is mollified. For now.',
        consequences: [],
      },
      {
        id: 'ignore',
        label: 'Dismiss his concerns. Adaptation is survival.',
        description: 'He leaves unsatisfied. His opinions will harden.',
        consequences: [],
      },
      {
        id: 'enforce_traditions',
        label: 'Agree. Reinstate formal observance of Imanian customs.',
        description: 'He is gratified in principle. Whether the reinstatement is handled well is another matter.',
        consequences: [],
        skillCheck: {
          skill: 'leadership',
          difficulty: 35,
          actorSelection: 'best_council',
          attemptLabel: 'Reinstate the customs',
        },
        successText: 'The reinstatement is handled with measured authority. The elder is gratified. Even some of the younger men find comfort in familiar rhythms.',
        failureText: 'The enforcement carries more edge than it needed. The elder is satisfied, but the manner has left marks. The Sauromatian women have noticed every word.',
        onSuccess: [{ type: 'modify_standing', target: 'company', value: 6 }],
        onFailure:  [{ type: 'modify_standing', target: 'company', value: 2 }],
      },
    ],
  },

  {
    id: 'dom_essence_sharing',
    title: 'Essence Sharing',
    category: 'domestic',
    prerequisites: [
      // Sauromatian sacred summer fertility tradition — requires adult Sauromatian women.
      { type: 'has_person_matching', params: { sex: 'female', religion: 'sacred_wheel', minAge: 14 } },
      { type: 'season_is',           params: { season: 'summer' } },
    ],
    weight: 2,
    cooldown: 4,
    isUnique: false,
    description:
      'The Sauromatian women in your settlement approach you together — an unusual show of ' +
      'collective intention. Summer is the season of giving, they explain through an interpreter. ' +
      'It is traditional for women who are able to open themselves to new life during these ' +
      'weeks. The customs involved are private and sacred. They are not asking your ' +
      'permission, exactly. But they are telling you, which is its own kind of respect.',
    choices: [
      {
        id: 'allow_openly',
        label: 'Allow it openly and without comment.',
        description: 'You respect their right to their own traditions. Some of your men will draw their own conclusions.',
        consequences: [],
      },
      {
        id: 'forbid',
        label: 'Forbid it. This is an Imanian settlement.',
        description: 'They comply, silently. The warmth between the groups cools measurably.',
        consequences: [],
      },
      {
        id: 'allow_privately',
        label: 'Allow it, but ask them to keep their observances private.',
        description: 'A compromise. They accept it, though they do not seem pleased.',
        consequences: [],
      },
    ],
  },

  {
    id: 'dom_company_inspector',
    title: 'The Company Inspector',
    category: 'domestic',
    prerequisites: [
      { type: 'company_standing_below', params: { value: 50 } },
    ],
    weight: 2,
    cooldown: 10,
    isUnique: false,
    description:
      'A Company inspector has arrived on the supply boat — a careful, pale man with a ' +
      'leather ledger and the eyes of someone who has learned not to be surprised by ' +
      'anything. He has come to assess the outpost\'s productivity, cultural compliance, ' +
      'and overall viability. He will report back to the Ansberry Company\'s directorate. ' +
      'He is polite, but thorough.',
    choices: [
      {
        id: 'show_honestly',
        label: 'Show him the books honestly and explain your situation.',
        description: 'Whatever happens, it will be the truth. He notes your candour.',
        consequences: [
          { type: 'modify_standing', target: 'company', value: 3 },
        ],
      },
      {
        id: 'favorable_picture',
        label: 'Present a favourable picture. Emphasize progress, minimize setbacks.',
        description: 'It is not lying. It is framing. What he takes from it depends on the framer.',
        consequences: [],
        skillCheck: {
          skill: 'deception',
          difficulty: 42,
          actorSelection: 'best_council',
          attemptLabel: 'Frame the narrative',
        },
        successText: 'The presentation is polished, the emphasis well-chosen. He closes his ledger with the expression of a man who has received what he came for.',
        failureText: 'He listens attentively and writes something in the margin of his notes. His "very thorough" has the sound of an epitaph.',
        onSuccess: [{ type: 'modify_standing', target: 'company', value: 8 }],
        onFailure:  [{ type: 'modify_standing', target: 'company', value: 1 }],
      },
      {
        id: 'wine_and_dine',
        label: 'Wine and dine him generously before he opens the books. (−15 gold)',
        description: 'Good hospitality still requires a good host. A well-fed man is more forgiving — if the evening is well-spent.',
        consequences: [
          { type: 'modify_resource', target: 'gold', value: -15 },
        ],
        skillCheck: {
          skill: 'diplomacy',
          difficulty: 35,
          actorSelection: 'best_council',
          attemptLabel: 'Host the inspector',
        },
        successText: 'A fine evening. He is expansive by the second glass and by the third he is defending the settlement to an imaginary critic. His report will be generous.',
        failureText: 'He eats well and thanks you sincerely. He is a professional. The hospitality makes him friendly, not pliable.',
        onSuccess: [{ type: 'modify_standing', target: 'company', value: 12 }],
        onFailure:  [{ type: 'modify_standing', target: 'company', value: 5  }],
      },
    ],
  },

  {
    id: 'dom_stranger_at_gate',
    title: 'A Stranger at the Gate',
    category: 'domestic',
    prerequisites: [
      { type: 'min_year', params: { value: 3 } },
    ],
    weight: 1,
    cooldown: 20,
    isUnique: false,
    description:
      'Alone. That is the first thing you notice. A Sauromatian man, perhaps twenty-five, ' +
      'no tribal markings you recognize, no escort, no horse. He has been standing at the ' +
      'settlement boundary since dawn. He is not armed — or at least not visibly. He speaks ' +
      'no trade-talk, but he does not look afraid. Among the Sauromatians, men who travel ' +
      'alone are either very capable or very desperate. Possibly both.',
    choices: [
      {
        id: 'welcome_openly',
        label: 'Welcome him without conditions. He may choose his own path here.',
        description: 'Word of extraordinary hospitality will reach the tribes. Every unmarried woman in the settlement takes notice.',
        consequences: [],
      },
      {
        id: 'welcome_you_choose',
        label: 'Welcome him — but you will decide who he courts, if anyone.',
        description: 'An unusual exercise of authority, but not without precedent in a settlement this small.',
        consequences: [],
      },
      {
        id: 'be_suspicious',
        label: 'Detain him politely and ask questions through your interpreter.',
        description: 'A lone man in the wilderness is statistically suspicious. He answers calmly, which is either reassuring or well-rehearsed.',
        consequences: [],
      },
    ],
  },

  // ─── Five additional creative events ─────────────────────────────────────

  {
    id: 'dom_midwife_offer',
    title: 'The Midwife\'s Knowledge',
    category: 'domestic',
    prerequisites: [
      // An older Sauromatian woman with traditional midwifery knowledge.
      { type: 'has_person_matching', params: { sex: 'female', religion: 'sacred_wheel', minAge: 20 } },
      { type: 'min_year',            params: { value: 1      } },
    ],
    actorRequirements: [
      { slot: 'midwife', criteria: { sex: 'female', religion: 'sacred_wheel', minAge: 30 } },
    ],
    weight: 2,
    cooldown: 10,
    isUnique: false,
    description:
      '{midwife} approaches your settlement healer — or whoever ' +
      'serves that function — and through gestures and trade-talk, makes an offer. {midwife.She} has ' +
      'attended more births than {midwife.she} can count. {midwife.Her} knowledge of preparation, position, ' +
      'herbs, and timing has saved lives that Imanian medicine would have lost. {midwife.She} asks ' +
      'for nothing in return but to be allowed to practice {midwife.her} art.',
    choices: [
      {
        id: 'accept_fully',
        label: 'Accept her offer gratefully. Let her work alongside your healer.',
        description: 'Two traditions working together. Births in this settlement will be safer.',
        consequences: [
          { type: 'modify_resource', target: 'medicine', value: 5 },
        ],
      },
      {
        id: 'accept_supervised',
        label: 'Accept, but require your healer to oversee her methods.',
        description: 'A cautious compromise. How much benefit it yields depends on how lightly the oversight sits.',
        consequences: [],
        skillCheck: {
          skill: 'plants',
          difficulty: 35,
          actorSelection: 'best_council',
          attemptLabel: 'Oversee the arrangement',
        },
        successText: 'The oversight is handled with a light hand. Your healer steps back far enough to let her work, close enough to learn. Births in this settlement will be safer.',
        failureText: 'The supervision creates more barrier than bridge. Knowledge passes, but slowly, through the friction of mistrust.',
        onSuccess: [{ type: 'modify_resource', target: 'medicine', value: 5 }],
        onFailure:  [{ type: 'modify_resource', target: 'medicine', value: 1 }],
      },
      {
        id: 'decline',
        label: 'Decline. You will rely on Imanian medicine.',
        description: 'She withdraws without argument. She has seen the results of Imanian medicine.',
        consequences: [],
      },
    ],
  },

  {
    id: 'dom_sacred_wheel_witness',
    title: 'The Wheel Turning',
    category: 'domestic',
    prerequisites: [
      { type: 'min_year',            params: { value: 1 }               },
      { type: 'has_person_matching', params: { sex: 'male', minAge: 20 } },
      // The ceremony the settler witnesses is performed by Sauromatian women.
      { type: 'has_person_matching', params: { sex: 'female', religion: 'sacred_wheel' } },
    ],
    actorRequirements: [
      { slot: 'witness', criteria: { sex: 'male', religion: 'imanian_orthodox' } },
    ],
    weight: 2,
    cooldown: 12,
    isUnique: false,
    description:
      '{witness} — one of the more curious, younger ones — tells you what {witness.he} ' +
      'saw last night. The Sauromatian women were gathered at the water. There was a fire, ' +
      'low and ringed in stones, and they were speaking to it — or to something in it. ' +
      'Calling and answering in a language {witness.he} could not follow. {witness.He} does not think it was ' +
      'evil. {witness.He} found it, {witness.he} says carefully, moving. {witness.He} asks what you think {witness.he} should do.',
    choices: [
      {
        id: 'report_heresy',
        label: 'Tell him to report it formally. This cannot be permitted to go silently.',
        description: 'He does so. The Company inspector would approve. The atmosphere in the settlement chills overnight.',
        consequences: [
          { type: 'modify_standing', target: 'company', value: 3 },
        ],
      },
      {
        id: 'stay_silent',
        label: 'Tell him to say nothing. What happens at the water\'s edge is their own business.',
        description: 'Pragmatic discretion. He nods, relieved.',
        consequences: [],
      },
      {
        id: 'participate',
        label: 'Tell him to ask if he may join them next time.',
        description: 'Bold. The women consider for a day. Then one of them comes to find him. Yes.',
        consequences: [
          { type: 'modify_standing', target: 'company', value: -4 },
        ],
      },
    ],
  },

  {
    id: 'dom_fire_stories',
    title: 'Stories at the Fire',
    category: 'domestic',
    prerequisites: [
      { type: 'min_population', params: { value: 8 } },
      { type: 'min_year',       params: { value: 1 } },
      // The storyteller is one of the Sauromatian women.
      { type: 'has_person_matching', params: { sex: 'female', religion: 'sacred_wheel' } },
    ],
    actorRequirements: [
      { slot: 'storyteller', criteria: { sex: 'female', religion: 'sacred_wheel' } },
    ],
    weight: 2,
    cooldown: 8,
    isUnique: false,
    description:
      'The evenings are drawing in. {storyteller} — the most talkative, ' +
      'the one who has picked up the most trade-talk — has begun telling stories at the ' +
      'evening fire. Your men gather without being asked. The stories are long and involve ' +
      'rivers, women who become cranes, arguments settled at the edge of the world. Nobody ' +
      'fully understands. Everyone listens. You notice fewer men eating alone.',
    choices: [
      {
        id: 'encourage',
        label: 'Encourage her. This is good for morale.',
        description: 'She beams. The sessions become a nightly fixture.',
        consequences: [],
      },
      {
        id: 'allow_quietly',
        label: 'Say nothing. Let it continue on its own terms.',
        description: 'The evenings grow richer without your intervention.',
        consequences: [],
      },
      {
        id: 'request_reciprocal',
        label: 'Ask one of your men to share Imanian stories in return.',
        description: 'An exchange. Both traditions, one fire.',
        consequences: [],
      },
    ],
  },

  {
    id: 'dom_talon_eyes',
    title: 'Eyes Like Amber',
    category: 'domestic',
    prerequisites: [
      { type: 'cultural_blend_above', params: { value: 0.2 } },
      { type: 'min_year',             params: { value: 2   } },
      // Require a young child — the narrative describes a four-year-old.
      { type: 'has_person_matching',  params: { maxAge: 8  } },
    ],
    actorRequirements: [
      { slot: 'child', criteria: { maxAge: 8 } },
    ],
    weight: 1,
    cooldown: 0,
    isUnique: true,
    description:
      '{child.first} is perhaps four years old — old enough to run and to be stared at. {child.His} ' +
      'eyes are unmistakably amber. Not hazel, not brown: the deep warm gold that the ' +
      'Hanjoda Talon consider their most sacred marker. Your men have noticed. Some find ' +
      '{child.his} eyes beautiful. A few of the more superstitious have been making signs against ill ' +
      'luck. A delegation from the Talon tribe is expected next season, and they will ' +
      'certainly notice too.',
    choices: [
      {
        id: 'celebrate_heritage',
        label: 'Speak openly about her Talon heritage. This is a mark of honour.',
        description: 'You make it a point of pride. The delegation will arrive to find the child treated with respect.',
        consequences: [
          { type: 'modify_disposition', target: 'cairn_valley_smiths', value: 8 },
        ],
      },
      {
        id: 'spiritual_framing',
        label: 'Frame it through the Sacred Wheel. She is touched by something beyond bloodline.',
        description: 'A syncretic reading that satisfies neither tradition perfectly, but offends neither fatally.',
        consequences: [],
      },
      {
        id: 'say_nothing',
        label: 'Say nothing. She is a child. Her eyes are her own.',
        description: 'You refuse to make her a symbol. The delegation will form their own opinion.',
        consequences: [],
      },
    ],
  },

  {
    id: 'dom_language_lessons',
    title: 'Language Lessons',
    category: 'domestic',
    prerequisites: [
      // A Sauromatian woman teaching Kiswani and learning Imanian — needs a real adult.
      { type: 'has_person_matching', params: { sex: 'female', religion: 'sacred_wheel', minAge: 16 } },
      { type: 'min_year',            params: { value: 1      } },
    ],
    actorRequirements: [
      { slot: 'teacher', criteria: { sex: 'female', religion: 'sacred_wheel', minAge: 16 } },
    ],
    weight: 2,
    cooldown: 10,
    isUnique: false,
    description:
      '{teacher} — the most patient one — has begun holding informal ' +
      'language lessons for anyone willing to sit with {teacher.her} after the evening meal. {teacher.She} ' +
      'points. {teacher.She} names. {teacher.She} corrects gently. Three of your men have been attending ' +
      "consistently. Progress is slow but visible. {teacher.She} has not asked your permission. " +
      '{teacher.She} has simply started. Now {teacher.she} asks you what you think.',
    choices: [
      {
        id: 'formalize',
        label: 'Formalize the lessons. Give her time and a proper space for it.',
        description: 'Make it official. The three men bring their notes. Two more join.',
        consequences: [
          { type: 'modify_resource', target: 'goods', value: -2 },
        ],
      },
      {
        id: 'allow_quietly',
        label: 'Tell her you approve, but keep it informal.',
        description: 'She nods and continues exactly as before.',
        consequences: [],
      },
      {
        id: 'forbid',
        label: 'Forbid it. Language is identity, and this settlement\'s identity is Imanian.',
        description: 'The three men are disappointed. She says nothing and does not look at you.',
        consequences: [
          { type: 'modify_standing', target: 'company', value: 3 },
        ],
      },
    ],
  },
];
