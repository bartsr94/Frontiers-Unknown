/**
 * Immigration events — settlers and visitors who are drawn to the settlement
 * by its growing prosperity and specific amenities.
 *
 * Each event represents a lore-grounded attraction mechanism: the Trading Post
 * signals contract safety for Kiswani merchants; the Bathhouse offers essence
 * access that tribal life cannot match; the Palisade promises survival; the
 * Smithy advertises personal access to steel; the Healer's Hut draws those who
 * want to learn and share medical knowledge.
 *
 * All events require a minimum prosperity score plus a specific building lure.
 * All have a "decline" choice with no consequences — the player is never forced
 * to accept new settlers.
 */

import type { GameEvent } from '../engine';

export const IMMIGRATION_EVENTS: GameEvent[] = [

  // ─── 1. River Traders Ask to Put Down Roots ─────────────────────────────────

  {
    id: 'imm_kiswani_traders_settle',
    title: 'River Traders Ask to Put Down Roots',
    category: 'immigration',
    weight: 2,
    cooldown: 12,
    isUnique: false,
    prerequisites: [
      { type: 'has_building',   params: { buildingId: 'trading_post' } },
      { type: 'min_prosperity', params: { value: 15 } },
      { type: 'season_is',      params: { season: 'summer' } },
    ],
    actorRequirements: [
      { slot: 'negotiator', criteria: { sex: 'male' } },
    ],
    description:
      'A Kiswani couple have been trading at the post for two seasons now — always ' +
      'prompt, always fair, always watching the settlement grow. Today they have ' +
      'brought their market table inside and asked {negotiator} a direct question: ' +
      'could they stay? They want a permanent stall. They want to pay settlement ' +
      'taxes. They want a place they can call theirs, not just a river stop.',
    choices: [
      {
        id: 'offer_residency',
        label: 'Welcome them. Offer permanent residency and a stall in the trading post.',
        description:
          'Give them status, give them space. What they bring in goodwill and trade connections is worth more than a stall.',
        consequences: [
          { type: 'add_person', target: 'settlement', value: 1, params: {
            sex: 'male', ethnicGroup: 'kiswani_riverfolk',
            minAge: 22, maxAge: 38, socialStatus: 'newcomer',
            religion: 'sacred_wheel',
            initialSkillBoosts: { bargaining: 15, plants: 5 },
          }},
          { type: 'add_person', target: 'settlement', value: 1, params: {
            sex: 'female', ethnicGroup: 'kiswani_riverfolk',
            minAge: 20, maxAge: 35, socialStatus: 'newcomer',
            religion: 'sacred_wheel',
            initialSkillBoosts: { bargaining: 12, custom: 8 },
          }},
          { type: 'modify_resource', target: 'wealth', value: 6 },
          { type: 'modify_disposition', target: 'any_kiswani_tribe', value: 5 },
        ],
      },
      {
        id: 'company_register',
        label: 'Accept them, but require they register with the Company as free settlers.',
        description:
          'They become taxable, traceable, and legitimate. The Company will appreciate the paperwork.',
        consequences: [
          { type: 'add_person', target: 'settlement', value: 1, params: {
            sex: 'male', ethnicGroup: 'kiswani_riverfolk',
            minAge: 22, maxAge: 38, socialStatus: 'newcomer',
            religion: 'sacred_wheel',
            initialSkillBoosts: { bargaining: 15, plants: 5 },
          }},
          { type: 'add_person', target: 'settlement', value: 1, params: {
            sex: 'female', ethnicGroup: 'kiswani_riverfolk',
            minAge: 20, maxAge: 35, socialStatus: 'newcomer',
            religion: 'sacred_wheel',
            initialSkillBoosts: { bargaining: 12, custom: 8 },
          }},
          { type: 'modify_standing', target: 'company', value: 3 },
        ],
      },
      {
        id: 'decline',
        label: 'Thank them for their visits. The settlement is not ready for more mouths.',
        description: 'A polite refusal. The river will carry them to the next opportunity.',
        consequences: [],
      },
    ],
  },

  // ─── 2. A Wildborn Woman Asks to Stay ────────────────────────────────────────

  {
    id: 'imm_wildborn_bathhouse_woman',
    title: 'A Wildborn Woman Asks to Stay',
    category: 'immigration',
    weight: 3,
    cooldown: 8,
    isUnique: false,
    prerequisites: [
      { type: 'has_building',   params: { buildingId: 'bathhouse' } },
      { type: 'min_prosperity', params: { value: 10 } },
      { type: 'has_tribe_contact' },
    ],
    actorRequirements: [
      { slot: 'speaker', criteria: { sex: 'female' } },
    ],
    description:
      'She came with a trade party three market days ago and has not left. She camps ' +
      'near the bathhouse, trades a little, talks cautiously. Today she approached ' +
      '{speaker} — one woman to another — and asked plainly whether there was a place ' +
      'for her here. Her tribe is three days upriver and largely indifferent to her ' +
      'absence. She carries herbalist knowledge and a guarded expression, and she has ' +
      'decided that what this settlement offers is worth the cost of never going back.',
    choices: [
      {
        id: 'welcome_her',
        label: 'Invite her to stay permanently. She is under the settlement\'s protection.',
        description:
          'A straightforward welcome. Word will spread to her tribe that the door was open.',
        consequences: [
          { type: 'add_person', target: 'settlement', value: 1, params: {
            sex: 'female',
            minAge: 18, maxAge: 32, socialStatus: 'newcomer',
            religion: 'sacred_wheel',
            initialSkillBoosts: { plants: 10 },
          }},
          { type: 'modify_all_tribe_dispositions', target: 'all', value: 3 },
        ],
      },
      {
        id: 'offer_bathhouse_role',
        label: 'Welcome her — specifically as a bathhouse attendant.',
        description:
          'Give her a role, not just a bed. Other Sauromatian women in the settlement will notice.',
        consequences: [
          { type: 'add_person', target: 'settlement', value: 1, params: {
            sex: 'female',
            minAge: 18, maxAge: 32, socialStatus: 'newcomer',
            religion: 'sacred_wheel',
            role: 'bathhouse_attendant',
            initialSkillBoosts: { plants: 10, bargaining: 5 },
          }},
          { type: 'modify_all_tribe_dispositions', target: 'all', value: 3 },
        ],
      },
      {
        id: 'decline_gently',
        label: 'Wish her well. She is welcome to keep visiting, but not to stay.',
        description:
          'A gentle refusal. She does not argue. She picks up her pack and walks back toward the gate.',
        consequences: [
          { type: 'modify_all_tribe_dispositions', target: 'all', value: -2 },
        ],
      },
    ],
  },

  // ─── 3. A Family Seeks Shelter Within Your Walls ────────────────────────────

  {
    id: 'imm_tribal_family_refuge',
    title: 'A Family Seeks Shelter Within Your Walls',
    category: 'immigration',
    weight: 2,
    cooldown: 10,
    isUnique: false,
    prerequisites: [
      { type: 'has_building',   params: { buildingId: 'palisade' } },
      { type: 'min_prosperity', params: { value: 12 } },
    ],
    actorRequirements: [
      { slot: 'captain', criteria: { sex: 'male', minSkill: { skill: 'combat', value: 1 } } },
    ],
    description:
      'A Hanjoda man and woman arrived at the gate at nightfall — no trade goods, no ' +
      'introduction party, just two exhausted people and a bedroll between them. ' +
      '{captain} spoke to the man at the gate. Something went wrong upriver: a raid, ' +
      'a flood, a plague — they would not say which. They have heard that this ' +
      'settlement has walls that hold. They are asking for nothing except the inside ' +
      'of those walls.',
    choices: [
      {
        id: 'grant_refuge',
        label: 'Take them in. They are under the settlement\'s protection.',
        description:
          'Full welcome, no conditions. Generosity in the dark is remembered.',
        consequences: [
          { type: 'add_person', target: 'settlement', value: 1, params: {
            sex: 'male', ethnicGroup: 'hanjoda_emrasi',
            minAge: 25, maxAge: 40, socialStatus: 'newcomer',
            religion: 'sacred_wheel',
            initialSkillBoosts: { combat: 8, custom: 5 },
          }},
          { type: 'add_person', target: 'settlement', value: 1, params: {
            sex: 'female', ethnicGroup: 'hanjoda_emrasi',
            minAge: 20, maxAge: 35, socialStatus: 'newcomer',
            religion: 'sacred_wheel',
            initialSkillBoosts: { plants: 8, custom: 5 },
          }},
          { type: 'modify_opinion_labeled', target: '{captain}', value: 6,
            params: { label: 'Opened the gate at night' } },
        ],
      },
      {
        id: 'grant_refuge_probation',
        label: 'Accept them on a season\'s probation. They earn full standing by demonstrating loyalty.',
        description:
          'A fair offer. Survival first, trust later.',
        consequences: [
          { type: 'add_person', target: 'settlement', value: 1, params: {
            sex: 'male', ethnicGroup: 'hanjoda_emrasi',
            minAge: 25, maxAge: 40, socialStatus: 'newcomer',
            religion: 'sacred_wheel',
            initialSkillBoosts: { combat: 8, custom: 5 },
          }},
          { type: 'add_person', target: 'settlement', value: 1, params: {
            sex: 'female', ethnicGroup: 'hanjoda_emrasi',
            minAge: 20, maxAge: 35, socialStatus: 'newcomer',
            religion: 'sacred_wheel',
            initialSkillBoosts: { plants: 8, custom: 5 },
          }},
        ],
      },
      {
        id: 'turn_them_away',
        label: 'The settlement cannot take every desperate family. Turn them away.',
        description:
          'A hard decision. Word travels fast in the Ashmark.',
        consequences: [
          { type: 'modify_all_tribe_dispositions', target: 'all', value: -3 },
        ],
      },
    ],
  },

  // ─── 4. A Warrior Comes for the Steel ──────────────────────────────────────

  {
    id: 'imm_steel_seeking_warrior',
    title: 'A Warrior Comes for the Steel',
    category: 'immigration',
    weight: 2,
    cooldown: 16,
    isUnique: false,
    prerequisites: [
      { type: 'has_building',   params: { buildingId: 'smithy' } },
      { type: 'min_prosperity', params: { value: 20 } },
    ],
    actorRequirements: [
      { slot: 'negotiator', criteria: { sex: 'male', minSkill: { skill: 'bargaining', value: 26 } } },
    ],
    description:
      'She arrived carrying a bronze-hilted blade and a deliberate posture. Hanjoda ' +
      'Bloodmoon — a warrior woman, travelling alone, which means either she was ' +
      'sent or she left. {negotiator} found her watching the smithy forge through the ' +
      'open door for the better part of an afternoon. She is not here to trade. She ' +
      'wants to know what it would cost to have a blade made — a proper one, Imanian ' +
      'steel — and what it would cost to stay.',
    choices: [
      {
        id: 'offer_steel_for_service',
        label: 'Accept her. She earns steel through service — not as a gift.',
        description:
          'Steel as wages, not charity. She will respect the terms. Her tribe will ' +
          'see the gift-gift chain broken, but she will fight for these walls.',
        consequences: [
          { type: 'add_person', target: 'settlement', value: 1, params: {
            sex: 'female', ethnicGroup: 'hanjoda_bloodmoon',
            minAge: 22, maxAge: 38, socialStatus: 'newcomer',
            religion: 'sacred_wheel',
            initialSkillBoosts: { combat: 20 },
            initialTraits: ['brave'],
          }},
          { type: 'modify_all_tribe_dispositions', target: 'all', value: -5 },
        ],
      },
      {
        id: 'offer_membership',
        label: 'Welcome her as a full settler with equal standing. She may use the smithy.',
        description:
          'Full membership, no strings. A demonstration gift of steel seals the offer.',
        consequences: [
          { type: 'add_person', target: 'settlement', value: 1, params: {
            sex: 'female', ethnicGroup: 'hanjoda_bloodmoon',
            minAge: 22, maxAge: 38, socialStatus: 'newcomer',
            religion: 'sacred_wheel',
            initialSkillBoosts: { combat: 20 },
            initialTraits: ['brave'],
          }},
          { type: 'modify_resource', target: 'steel', value: -2 },
          { type: 'modify_all_tribe_dispositions', target: 'all', value: -3 },
        ],
      },
      {
        id: 'decline',
        label: 'The settlement\'s steel is not for individual bargaining. Send her elsewhere.',
        description: 'She nods once, sheathes her blade, and leaves without argument.',
        consequences: [],
      },
    ],
  },

  // ─── 5. A Healer Comes to See Your Medicine ─────────────────────────────────

  {
    id: 'imm_sauromatian_midwife',
    title: 'A Healer Comes to See Your Medicine',
    category: 'immigration',
    weight: 2,
    cooldown: 16,
    isUnique: false,
    prerequisites: [
      { type: 'has_building', params: { buildingId: 'healers_hut' } },
      { type: 'has_resource', params: { resource: 'medicine', amount: 5 } },
      { type: 'min_prosperity', params: { value: 15 } },
    ],
    actorRequirements: [
      { slot: 'herbalist', criteria: { minSkill: { skill: 'plants', value: 26 } } },
    ],
    description:
      'She introduced herself to {herbalist} without preamble: she is a midwife, a ' +
      'healer, a woman of sixty-something years, and she has been watching the ' +
      'settlement from a respectful distance for one full season. She wants to look ' +
      'at the medicine. She has heard something about forceps — a word she knows only ' +
      'as a rumour — and she wants to understand it. She has knowledge of her own: ' +
      'bark tinctures, wound poultices, a broth that reduces fever in seven days. ' +
      'She asks for nothing except the right to look, and possibly to stay.',
    choices: [
      {
        id: 'welcome_and_share',
        label: 'Invite her to stay. Share your medical knowledge freely; she will share hers.',
        description:
          'A genuine exchange. Two traditions, one healers\' hut. Children will live ' +
          'who would otherwise not.',
        consequences: [
          { type: 'add_person', target: 'settlement', value: 1, params: {
            sex: 'female', ethnicGroup: 'kiswani_haisla',
            minAge: 35, maxAge: 52, socialStatus: 'newcomer',
            religion: 'sacred_wheel',
            initialSkillBoosts: { plants: 25, custom: 10 },
            initialTraits: ['healer'],
          }},
          { type: 'modify_resource', target: 'medicine', value: 4 },
        ],
      },
      {
        id: 'welcome_observe_only',
        label: 'She may stay, but the settlement\'s medical methods are Company proprietary.',
        description:
          'A cautious welcome. She accepts, but the exchange is one-way. Her knowledge stays hers.',
        consequences: [
          { type: 'add_person', target: 'settlement', value: 1, params: {
            sex: 'female', ethnicGroup: 'kiswani_haisla',
            minAge: 35, maxAge: 52, socialStatus: 'newcomer',
            religion: 'sacred_wheel',
            initialSkillBoosts: { plants: 25, custom: 10 },
            initialTraits: ['healer'],
          }},
        ],
      },
      {
        id: 'decline_respectfully',
        label: 'The settlement is not ready to integrate a new practitioner right now.',
        description: 'A respectful refusal. She thanks you for the honest answer and turns back up the path.',
        consequences: [],
      },
    ],
  },

];
