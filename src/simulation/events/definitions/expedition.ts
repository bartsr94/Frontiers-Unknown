/**
 * Expedition events — all injected programmatically (never drawn from the normal deck).
 *
 * Injection triggers (handled in expeditions.ts + game-store.ts):
 *
 *   Hex-content (one-time, fires when a discovery hex is entered for the first time):
 *     exp_ruins_discovered            — 'ruins' content
 *     exp_abandoned_camp_found        — 'abandoned_camp' content
 *     exp_burial_ground_entered       — 'burial_ground' content
 *     exp_hidden_shrine_discovered    — 'hidden_shrine' content
 *     exp_fresh_water_spring          — 'fresh_water_spring' content
 *     exp_old_road_found              — 'old_road' content
 *     exp_resource_cache_found        — 'resource_cache' content
 *
 *   Tribe contact (fires when a tribe-occupied hex is entered; may repeat on recurring types):
 *     exp_tribe_territory_entered     — 'tribe_territory' content (first contact)
 *     exp_tribe_settlement_approached — 'tribe_settlement' content
 *     exp_tribe_patrol_encountered    — 'tribe_outpost' content or recurring patrol
 *
 *   Recurring encounter events (roll each visit to eligible hex):
 *     exp_animal_attack               — 'animal_den' content
 *     exp_travellers_met              — 'travellers' content
 *     exp_disease_outbreak            — 'disease_vector' content (wetlands)
 *     exp_bandit_ambush               — 'bandit_camp' content
 *     exp_severe_weather              — 'weather_hazard' content
 *
 *   Supply (injected when foodRemaining < threshold):
 *     exp_food_running_low            — food < 1 season's worth remaining
 *
 *   Morale (injected periodically if the expedition has multiple members):
 *     exp_member_wants_to_turn_back
 *
 *   Return (injected when expedition first reaches 'completed' status):
 *     exp_return_report
 *
 * The special `boundActors` keys used by expedition events:
 *   leader         — PersonId of the expedition leader
 *   member         — PersonId of the first other party member (when relevant)
 *   _expeditionId  — Expedition.id (not a person; used by expedition consequences)
 *   _tribeId       — Tribe.id being encountered (used by tribe-contact consequences)
 */

import type { GameEvent } from '../engine';

export const EXPEDITION_EVENTS: GameEvent[] = [

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP A — ONE-TIME HEX DISCOVERIES
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: 'exp_ruins_discovered',
    title: 'Ruins in the Undergrowth',
    category: 'expedition',
    isDeferredOutcome: true,
    weight: 1,
    cooldown: 0,
    isUnique: false,
    actorRequirements: [
      { slot: 'leader', criteria: {} },
    ],
    prerequisites: [],
    description:
      'Pushing through a dense thicket, {leader} breaks into a clearing and stops. ' +
      'The undergrowth has been slowly reclaiming cut stone — walls, an arch, ' +
      'something that might once have been a tower. Whatever people built this, ' +
      'they have been gone for generations. The silence is complete.',
    choices: [
      {
        id: 'explore_carefully',
        label: 'Explore methodically. Document what you find.',
        description:
          '{leader} moves carefully through the structure, cataloguing stonework ' +
          'and carvings. There may be useful materials here, or simply knowledge ' +
          'worth recording.',
        consequences: [],
        skillCheck: {
          skill: 'custom',
          difficulty: 35,
          actorSelection: 'actor_slot',
          actorSlot: 'leader',
          attemptLabel: 'Search the ruins systematically',
        },
        onSuccess: [
          { type: 'modify_resource', target: 'goods', value: 2 },
          { type: 'modify_standing', target: 'company', value: 1 },
        ],
        onFailure: [
          { type: 'modify_resource', target: 'goods', value: 1 },
        ],
      },
      {
        id: 'loot_quickly',
        label: 'Strip anything portable and move on.',
        description:
          'No time for scholarship. The expedition takes what can be carried — ' +
          'carved blocks, metal fittings — and leaves before the site draws anything ' +
          'else to it.',
        consequences: [
          { type: 'modify_resource', target: 'goods', value: 3 },
          { type: 'modify_expedition_resource', target: 'food', value: -1 },
        ],
      },
      {
        id: 'leave_undisturbed',
        label: 'Mark it on the map and leave it as you found it.',
        description:
          'A place like this deserves more than a raid. {leader} records the ' +
          'location carefully. Perhaps another expedition, better equipped, ' +
          'will come one day.',
        consequences: [
          { type: 'modify_standing', target: 'company', value: 1 },
        ],
      },
    ],
  },

  {
    id: 'exp_abandoned_camp_found',
    title: 'Someone Was Here',
    category: 'expedition',
    isDeferredOutcome: true,
    weight: 1,
    cooldown: 0,
    isUnique: false,
    actorRequirements: [
      { slot: 'leader', criteria: {} },
    ],
    prerequisites: [],
    description:
      'An old camp — fire ash cold for at least two seasons, canvas rotted, ' +
      'poles collapsed. Someone made this place their base for a time and then ' +
      'either moved on or did not. Personal items remain: a cup, a boot, ' +
      'a book swollen with damp. The expedition watches the treeline.',
    choices: [
      {
        id: 'search_supplies',
        label: 'Search the camp for anything salvageable.',
        description:
          '{leader} and the party pick through the debris. Whatever drove these ' +
          'people away, they left in a hurry and left things behind.',
        consequences: [
          { type: 'modify_expedition_resource', target: 'food', value: 4 },
          { type: 'modify_expedition_resource', target: 'goods', value: 1 },
        ],
      },
      {
        id: 'follow_the_trail',
        label: 'Look for signs of what happened to them.',
        description:
          'The trail from the camp leads east. It is three days old, perhaps ' +
          'four. Whoever left moved quickly and did not look back. ' +
          'You follow as far as seems prudent.',
        consequences: [
          { type: 'modify_standing', target: 'company', value: 1 },
        ],
      },
      {
        id: 'read_the_journal',
        label: 'Recover and read the journal.',
        description:
          'The waterlogged book yields hard-won route notes and terrain ' +
          'observations. Whoever wrote it knew this country well.',
        consequences: [
          { type: 'modify_standing', target: 'company', value: 2 },
        ],
      },
    ],
  },

  {
    id: 'exp_burial_ground_entered',
    title: 'A Place of the Dead',
    category: 'expedition',
    isDeferredOutcome: true,
    weight: 1,
    cooldown: 0,
    isUnique: false,
    actorRequirements: [
      { slot: 'leader', criteria: {} },
    ],
    prerequisites: [],
    description:
      'The stone markers are old, but the offerings laid before some of them ' +
      'are not — flowers, beaded cord, a carved wooden horse. Someone still ' +
      'tends this place. {leader} moves quietly, aware that they are guests ' +
      'here whether they intended to be or not.',
    choices: [
      {
        id: 'pay_respects',
        label: 'Observe the proper forms. Lay an offering of your own.',
        description:
          'The expedition removes headgear, walks with care, and leaves ' +
          'a small gift from the provisions. Word of this travels in ways ' +
          'the expedition cannot see.',
        consequences: [
          { type: 'modify_disposition', target: '{_tribeId}', value: 10 },
          { type: 'modify_expedition_resource', target: 'food', value: -1 },
        ],
      },
      {
        id: 'take_artefacts',
        label: 'Take the carved pieces as evidence for the Company.',
        description:
          'The carved grave goods are fine work — {leader} judges the Company ' +
          'scholars will want to see them. This ground will not miss a few pieces.',
        consequences: [
          { type: 'modify_standing', target: 'company', value: 2 },
          { type: 'modify_disposition', target: '{_tribeId}', value: -20 },
          { type: 'modify_resource', target: 'goods', value: 2 },
        ],
      },
      {
        id: 'map_and_withdraw',
        label: 'Record the location and withdraw without touching anything.',
        description:
          '{leader} marks the site on the map and leads the expedition out ' +
          'quietly. Some discoveries are better left alone.',
        consequences: [],
      },
    ],
  },

  {
    id: 'exp_hidden_shrine_discovered',
    title: 'A Hidden Shrine',
    category: 'expedition',
    isDeferredOutcome: true,
    weight: 1,
    cooldown: 0,
    isUnique: false,
    actorRequirements: [
      { slot: 'leader', criteria: {} },
    ],
    prerequisites: [],
    description:
      'Tucked into a natural alcove where three boulders meet, someone has ' +
      'maintained a small shrine for a very long time. The iconography is ' +
      'not Imanian — a wheel motif, a burning eye, a serpent braided with grain. ' +
      '{leader} feels {leader.his} assumption about this land shift slightly.',
    choices: [
      {
        id: 'claim_for_orthodoxy',
        label: 'Cleanse and bless the site in the Imanian Orthodox tradition.',
        description:
          'The Company will want to know the Ashmark is being brought into ' +
          'the fold. {leader} performs a simple consecration and marks the ' +
          'location for a future chaplain. The old iconography is covered.',
        consequences: [
          { type: 'modify_standing', target: 'company', value: 2 },
          { type: 'modify_cultural_blend', target: 'blend', value: -0.02 },
        ],
      },
      {
        id: 'leave_for_the_wheel',
        label: 'Leave it as it is. This is part of the land you came to know.',
        description:
          '{leader} looks at the braided serpent for a long time, then ' +
          'turns and walks away. Some of the Sauromatian women at the ' +
          'settlement may already know this place exists.',
        consequences: [
          { type: 'modify_disposition', target: '{_tribeId}', value: 6 },
          { type: 'modify_cultural_blend', target: 'blend', value: 0.01 },
        ],
      },
      {
        id: 'bring_home_knowledge',
        label: 'Sketch the symbols and bring the record home.',
        description:
          'Neither claiming nor abandoning — just witnessing. The documents ' +
          '{leader} carries back will add something to the settlement\'s ' +
          'understanding of where they have landed.',
        consequences: [
          { type: 'modify_standing', target: 'company', value: 1 },
          { type: 'add_trait', target: '{leader}', value: 'folklorist' },
        ],
      },
    ],
  },

  {
    id: 'exp_fresh_water_spring',
    title: 'A Spring',
    category: 'expedition',
    isDeferredOutcome: true,
    weight: 1,
    cooldown: 0,
    isUnique: false,
    actorRequirements: [
      { slot: 'leader', criteria: {} },
    ],
    prerequisites: [],
    description:
      'A small spring pushes out from between two rocks, cold and clear. ' +
      '{leader} kneels and drinks. The water tastes like none you have found ' +
      'near the settlement — clean, mineral, cold in the back of the throat. ' +
      'The party refills every vessel they carry.',
    choices: [
      {
        id: 'acknowledge',
        label: 'We drink our fill and refill every vessel.',
        description:
          'The sweet cold water is the best thing the expedition has tasted ' +
          'in weeks. Provisions are topped up and spirits lift.',
        consequences: [
          { type: 'modify_expedition_resource', target: 'food', value: 4 },
        ],
      },
    ],
  },

  {
    id: 'exp_old_road_found',
    title: 'An Old Road',
    category: 'expedition',
    isDeferredOutcome: true,
    weight: 1,
    cooldown: 0,
    isUnique: false,
    actorRequirements: [
      { slot: 'leader', criteria: {} },
    ],
    prerequisites: [],
    description:
      '{leader} steps onto flat stone where there was none before — large slabs, ' +
      'dressed and laid with intent, now heaved and fissured by roots. ' +
      'This road was engineered to last. It runs north and south as far as ' +
      'the jungle allows the eye to follow.',
    choices: [
      {
        id: 'follow_the_road',
        label: 'Follow it for a day and see where it leads.',
        description:
          'The road leads to a collapsed bridge over a shallow river — ' +
          'still crossable on foot — and then curves east toward higher ground. ' +
          'The route itself is worth knowing.',
        consequences: [
          { type: 'modify_standing', target: 'company', value: 1 },
          { type: 'modify_expedition_resource', target: 'food', value: -1 },
        ],
      },
      {
        id: 'map_and_report',
        label: 'Map the road carefully for the Company surveyors.',
        description:
          'A surveyed road changes what\'s possible. {leader} takes careful ' +
          'compass bearings and records the stonework quality. ' +
          'The Company will be very interested.',
        consequences: [
          { type: 'modify_standing', target: 'company', value: 3 },
        ],
      },
      {
        id: 'note_and_continue',
        label: 'Note its bearing and keep moving.',
        description:
          'It is a useful waypoint for the map, nothing more. The expedition ' +
          'notes the location and presses on toward its objective.',
        consequences: [],
      },
    ],
  },

  {
    id: 'exp_resource_cache_found',
    title: 'A Hidden Cache',
    category: 'expedition',
    isDeferredOutcome: true,
    weight: 1,
    cooldown: 0,
    isUnique: false,
    actorRequirements: [
      { slot: 'leader', criteria: {} },
    ],
    prerequisites: [],
    description:
      '{leader} spots a pattern in the underbrush — too deliberate to be natural. ' +
      'Beneath a cairn of well-arranged stones, wrapped in oiled cloth: ' +
      'cached supplies left by someone who either did not return for them ' +
      'or intended them to be found.',
    choices: [
      {
        id: 'take_everything',
        label: 'Take it all. Finders, keepers.',
        description:
          'The cache is loaded onto the party\'s gear. Whatever the story behind ' +
          'it, the expedition has more resources now than it did a moment ago.',
        consequences: [
          { type: 'modify_expedition_resource', target: 'food', value: 5 },
          { type: 'modify_expedition_resource', target: 'goods', value: 2 },
        ],
      },
      {
        id: 'take_some_leave_rest',
        label: 'Take only what you need. Leave the rest undisturbed.',
        description:
          '{leader} assesses the provisions and takes only what the expedition ' +
          'requires. Another party — whoever left this — may one day return.',
        consequences: [
          { type: 'modify_expedition_resource', target: 'food', value: 3 },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP B — TRIBE CONTACT EVENTS
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: 'exp_tribe_territory_entered',
    title: 'Unfamiliar Ground',
    category: 'expedition',
    isDeferredOutcome: true,
    weight: 1,
    cooldown: 0,
    isUnique: false,
    actorRequirements: [
      { slot: 'leader', criteria: {} },
    ],
    prerequisites: [],
    description:
      'The character of the land has changed. The trails here are deliberately ' +
      'maintained. Carvings mark the trees at intervals — boundary signs, ' +
      '{leader} judges, or warnings. The expedition is in someone\'s territory now. ' +
      'They may already have been seen.',
    choices: [
      {
        id: 'approach_openly',
        label: 'Announce yourselves openly and make peaceful intent clear.',
        description:
          '{leader} calls out, shows open hands, and moves into a clearing ' +
          'where the expedition can be seen from all approaches. ' +
          'This is someone\'s home. You are guests.',
        consequences: [
          { type: 'establish_tribe_relations', target: '{_tribeId}', params: { level: 'contact' } },
          { type: 'modify_disposition', target: '{_tribeId}', value: 8 },
        ],
      },
      {
        id: 'make_an_offering',
        label: 'Leave an offering at the boundary markers and wait.',
        description:
          '{leader} places a small gift — cloth, a cup of salt — at the ' +
          'nearest carved marker and the expedition withdraws a short distance. ' +
          'If these people watch, they will have seen what you intended.',
        consequences: [
          { type: 'establish_tribe_relations', target: '{_tribeId}', params: { level: 'contact' } },
          { type: 'modify_disposition', target: '{_tribeId}', value: 12 },
          { type: 'modify_expedition_resource', target: 'goods', value: -1 },
        ],
      },
      {
        id: 'pass_carefully',
        label: 'Move through quickly and quietly. Do not force contact.',
        description:
          'The expedition is here to observe and return, not to negotiate. ' +
          '{leader} takes the party through as quietly as possible, ' +
          'respecting the boundary markers.',
        consequences: [
          { type: 'establish_tribe_relations', target: '{_tribeId}', params: { level: 'contact' } },
        ],
      },
    ],
  },

  {
    id: 'exp_tribe_settlement_approached',
    title: 'The Settlement',
    category: 'expedition',
    isDeferredOutcome: true,
    weight: 1,
    cooldown: 0,
    isUnique: false,
    actorRequirements: [
      { slot: 'leader', criteria: {} },
    ],
    prerequisites: [],
    description:
      'Through the trees: smoke, the smell of cooking, the sound of children. ' +
      'A settlement of some size — more permanent than a camp, with granaries ' +
      'and pens for livestock. Sentinels have already spotted the expedition. ' +
      '{leader} has moments to decide how this encounter begins.',
    choices: [
      {
        id: 'formal_approach',
        label: 'Walk in slowly with your hands visible and speak first.',
        description:
          '{leader} calls the greeting phrase {leader.he} has learned, ' +
          'states the settlement\'s name, and asks for nothing. ' +
          'The response depends entirely on how this community feels about strangers.',
        consequences: [],
        skillCheck: {
          skill: 'bargaining',
          difficulty: 45,
          actorSelection: 'actor_slot',
          actorSlot: 'leader',
          attemptLabel: 'Negotiate an audience with the leadership',
        },
        onSuccess: [
          { type: 'establish_tribe_relations', target: '{_tribeId}', params: { level: 'diplomacy' } },
          { type: 'modify_disposition', target: '{_tribeId}', value: 10 },
        ],
        onFailure: [
          { type: 'establish_tribe_relations', target: '{_tribeId}', params: { level: 'contact' } },
          { type: 'modify_disposition', target: '{_tribeId}', value: -5 },
        ],
      },
      {
        id: 'offer_gifts',
        label: 'Present gifts before speaking any formal business.',
        description:
          '{leader} draws out trade goods and presents them without preamble. ' +
          'In many cultures, the gift speaks louder than any introduction. ' +
          'The people of this settlement watch carefully.',
        consequences: [
          { type: 'establish_tribe_relations', target: '{_tribeId}', params: { level: 'diplomacy' } },
          { type: 'modify_disposition', target: '{_tribeId}', value: 15 },
          { type: 'modify_expedition_resource', target: 'goods', value: -3 },
        ],
      },
      {
        id: 'withdraw_respectfully',
        label: 'Back away slowly. This was not in your mandate.',
        description:
          '{leader} signals the expedition to stop, then personally walks ' +
          'backward until the settlement is out of sight. You were not invited. ' +
          'Making first contact with a major settlement requires preparation.',
        consequences: [
          { type: 'establish_tribe_relations', target: '{_tribeId}', params: { level: 'contact' } },
        ],
      },
    ],
  },

  {
    id: 'exp_tribe_patrol_encountered',
    title: 'A Patrol',
    category: 'expedition',
    isDeferredOutcome: true,
    weight: 1,
    cooldown: 0,
    isUnique: false,
    actorRequirements: [
      { slot: 'leader', criteria: {} },
    ],
    prerequisites: [],
    description:
      'Four figures step out of the brush with weapons visible but not raised. ' +
      'They are neither surprised nor particularly alarmed — this is their ' +
      'route and they work it regularly. {leader} has their full attention. ' +
      'One of them says something. The tone is not hostile, but it is firm.',
    choices: [
      {
        id: 'parley',
        label: 'Hold your ground and attempt to speak with them.',
        description:
          '{leader} steps forward alone, weapons sheathed, and begins the ' +
          'halting process of finding a common language. This may go ' +
          'anywhere.',
        consequences: [],
        skillCheck: {
          skill: 'bargaining',
          difficulty: 40,
          actorSelection: 'actor_slot',
          actorSlot: 'leader',
          attemptLabel: 'Parley with the patrol',
        },
        onSuccess: [
          { type: 'establish_tribe_relations', target: '{_tribeId}', params: { level: 'contact' } },
          { type: 'modify_disposition', target: '{_tribeId}', value: 8 },
        ],
        onFailure: [
          { type: 'establish_tribe_relations', target: '{_tribeId}', params: { level: 'contact' } },
          { type: 'modify_disposition', target: '{_tribeId}', value: -5 },
        ],
      },
      {
        id: 'show_of_strength',
        label: 'Project confidence. Let them see you are not afraid.',
        description:
          '{leader} keeps the expedition in clear formation, makes no sudden ' +
          'moves, and meets the patrol\'s eyes levelly. ' +
          'Strength is its own form of communication.',
        consequences: [],
        skillCheck: {
          skill: 'combat',
          difficulty: 35,
          actorSelection: 'actor_slot',
          actorSlot: 'leader',
          attemptLabel: 'Demonstrate composure under pressure',
        },
        onSuccess: [
          { type: 'establish_tribe_relations', target: '{_tribeId}', params: { level: 'contact' } },
          { type: 'modify_disposition', target: '{_tribeId}', value: 5 },
        ],
        onFailure: [
          { type: 'modify_disposition', target: '{_tribeId}', value: -8 },
        ],
      },
      {
        id: 'give_gifts',
        label: 'Offer gifts immediately. Let goods do the talking.',
        description:
          '{leader} produces trade goods and extends them toward the patrol ' +
          'with both hands. This is a known universal — you come in peace ' +
          'and wish to trade.',
        consequences: [
          { type: 'establish_tribe_relations', target: '{_tribeId}', params: { level: 'contact' } },
          { type: 'modify_disposition', target: '{_tribeId}', value: 12 },
          { type: 'modify_expedition_resource', target: 'goods', value: -2 },
        ],
      },
      {
        id: 'withdraw_quietly',
        label: 'Back off. You are not equipped for this encounter.',
        description:
          '{leader} signals the expedition to step back, slowly, then turns ' +
          'and leads them away at a measured pace. The patrol watches but ' +
          'does not follow.',
        consequences: [],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP C — RECURRING ENCOUNTER EVENTS
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: 'exp_animal_attack',
    title: 'The Jungle Reminds You It Is Alive',
    category: 'expedition',
    isDeferredOutcome: true,
    weight: 1,
    cooldown: 0,
    isUnique: false,
    actorRequirements: [
      { slot: 'leader', criteria: {} },
    ],
    prerequisites: [],
    description:
      'An animal — something large, territorial, and moving fast — charges ' +
      'the camp from the undergrowth. {leader} has about two seconds to react ' +
      'before things become very bad.',
    choices: [
      {
        id: 'stand_and_fight',
        label: 'Drive it off. Meet force with force.',
        description:
          '{leader} positions the party and holds the line. It costs nerves ' +
          'and energy, but a fight won is also a meal.',
        consequences: [],
        skillCheck: {
          skill: 'combat',
          difficulty: 40,
          actorSelection: 'actor_slot',
          actorSlot: 'leader',
          attemptLabel: 'Drive off the animal',
        },
        onSuccess: [
          { type: 'modify_expedition_resource', target: 'food', value: 5 },
        ],
        onFailure: [
          { type: 'wound_person', target: '{leader}', value: 20 },
        ],
      },
      {
        id: 'retreat_and_scatter',
        label: 'Break formation and scatter. Regroup fifty metres back.',
        description:
          'The scattered movement confuses the animal long enough for the ' +
          'expedition to escape. Nobody eats well tonight, but everyone walks.',
        consequences: [
          { type: 'modify_expedition_resource', target: 'food', value: -1 },
        ],
      },
    ],
  },

  {
    id: 'exp_travellers_met',
    title: 'Strangers on the Trail',
    category: 'expedition',
    isDeferredOutcome: true,
    weight: 1,
    cooldown: 0,
    isUnique: false,
    actorRequirements: [
      { slot: 'leader', criteria: {} },
    ],
    prerequisites: [],
    description:
      'A small group — three, perhaps four — moving in the opposite direction. ' +
      'They carry more than a family\'s worth of trade goods and look wary in ' +
      'the way of experienced travellers who have learned to be wary first ' +
      'and sorry never. {leader} raises a hand. They slow.',
    choices: [
      {
        id: 'trade_with_them',
        label: 'Propose an exchange. Goods for information.',
        description:
          '{leader} opens the trading folio and begins the patient process of ' +
          'establishing a common value. Whatever they carry may be worth ' +
          'something back at the settlement.',
        consequences: [
          { type: 'modify_expedition_resource', target: 'goods', value: -2 },
          { type: 'modify_resource', target: 'goods', value: 3 },
          { type: 'modify_standing', target: 'company', value: 1 },
        ],
      },
      {
        id: 'speak_and_learn',
        label: 'Ask them about the country ahead.',
        description:
          '{leader} steers the conversation to terrain, water sources, and ' +
          'what lies toward the expedition\'s destination. Travellers know ' +
          'things no map records.',
        skillCheck: {
          skill: 'bargaining',
          difficulty: 30,
          actorSelection: 'actor_slot',
          actorSlot: 'leader',
          attemptLabel: 'Draw out their knowledge',
        },
        consequences: [],
        onSuccess: [
          { type: 'modify_expedition_resource', target: 'food', value: 2 },
          { type: 'modify_standing', target: 'company', value: 1 },
        ],
        onFailure: [],
      },
      {
        id: 'pass_in_silence',
        label: 'Exchange nods and pass. You are not here to socialise.',
        description:
          '{leader} tips a courteous nod, holds the expedition\'s formation, ' +
          'and moves on. Some encounters are best left brief.',
        consequences: [],
      },
    ],
  },

  {
    id: 'exp_disease_outbreak',
    title: 'The Marsh Sickness',
    category: 'expedition',
    isDeferredOutcome: true,
    weight: 1,
    cooldown: 0,
    isUnique: false,
    actorRequirements: [
      { slot: 'leader', criteria: {} },
    ],
    prerequisites: [],
    description:
      'Someone woke feverish. By midday two more showing symptoms — the particular ' +
      'bone-deep chill that comes with standing water and biting insects. ' +
      '{leader} knows the marsh fever is survivable, but it can hollow a person ' +
      'out if left untreated. The expedition is in the middle of nowhere.',
    choices: [
      {
        id: 'treat_with_medicine',
        label: 'Apply the expedition\'s medicine now.',
        description:
          '{leader} administers the medicine carefully. It is the right call. ' +
          'The fever breaks in two days and no one else falls ill.',
        consequences: [
          { type: 'modify_expedition_resource', target: 'medicine', value: -2 },
        ],
      },
      {
        id: 'manage_and_press_on',
        label: 'Manage symptoms and keep moving.',
        description:
          '{leader} makes the hard call to keep the pace. Rations of clean ' +
          'water, reduced load for the sick, rest when possible. ' +
          'The risk is real but so is the cost of stopping.',
        consequences: [],
        skillCheck: {
          skill: 'plants',
          difficulty: 40,
          actorSelection: 'actor_slot',
          actorSlot: 'leader',
          attemptLabel: 'Keep the sick members functional',
        },
        onSuccess: [
          { type: 'modify_expedition_resource', target: 'food', value: -2 },
        ],
        onFailure: [
          { type: 'wound_person', target: '{leader}', value: 15 },
          { type: 'modify_expedition_resource', target: 'medicine', value: -1 },
        ],
      },
      {
        id: 'make_camp_and_wait',
        label: 'Make camp. Give the sick time to recover.',
        description:
          'Nothing will improve while the expedition is moving. {leader} ' +
          'calls a halt for two days, positions watches, and lets the sick ' +
          'rest properly.',
        consequences: [
          { type: 'modify_expedition_resource', target: 'food', value: -3 },
        ],
      },
    ],
  },

  {
    id: 'exp_bandit_ambush',
    title: 'An Ambush',
    category: 'expedition',
    isDeferredOutcome: true,
    weight: 1,
    cooldown: 0,
    isUnique: false,
    actorRequirements: [
      { slot: 'leader', criteria: {} },
    ],
    prerequisites: [],
    description:
      'The road narrows between two banks of scrub and figures appear from ' +
      'both sides — armed, masked, practiced at this. ' +
      'They are not shouting, which means they know how to do this without ' +
      'noise. {leader} has to choose: fight, pay, or run.',
    choices: [
      {
        id: 'fight',
        label: 'Fight your way through.',
        description:
          '{leader} calls the formation and meets the ambush head-on. ' +
          'Ambushers expect compliance, not resistance — surprise can cut ' +
          'the other way.',
        consequences: [],
        skillCheck: {
          skill: 'combat',
          difficulty: 50,
          actorSelection: 'actor_slot',
          actorSlot: 'leader',
          attemptLabel: 'Break the ambush by force',
        },
        onSuccess: [
          { type: 'modify_resource', target: 'goods', value: 1 },
        ],
        onFailure: [
          { type: 'wound_person', target: '{leader}', value: 25 },
          { type: 'modify_expedition_resource', target: 'goods', value: -2 },
        ],
      },
      {
        id: 'bribe',
        label: 'Pay them off. It is not worth dying for goods.',
        description:
          '{leader} calls out that the expedition will give what it can. ' +
          'The figures confer. Bandits want goods more than they want ' +
          'corpses — this is almost certainly the rational choice.',
        consequences: [
          { type: 'modify_expedition_resource', target: 'gold', value: -1 },
          { type: 'modify_expedition_resource', target: 'goods', value: -2 },
        ],
      },
      {
        id: 'slip_away',
        label: 'Find a gap and get everyone out quietly.',
        description:
          '{leader} signals the party to back toward the scrub line on the ' +
          'left flank. The ambushers are watching the road. ' +
          'If there are any gaps at all, this is how you find them.',
        consequences: [],
        skillCheck: {
          skill: 'custom',
          difficulty: 40,
          actorSelection: 'actor_slot',
          actorSlot: 'leader',
          attemptLabel: 'Slip out through the undergrowth',
        },
        onSuccess: [],
        onFailure: [
          { type: 'modify_expedition_resource', target: 'goods', value: -3 },
          { type: 'wound_person', target: '{leader}', value: 10 },
        ],
      },
    ],
  },

  {
    id: 'exp_severe_weather',
    title: 'The Storm',
    category: 'expedition',
    isDeferredOutcome: true,
    weight: 1,
    cooldown: 0,
    isUnique: false,
    actorRequirements: [
      { slot: 'leader', criteria: {} },
    ],
    prerequisites: [],
    description:
      'The sky had been building since before dawn. By midday it breaks — ' +
      'a real storm, the kind that takes trees down and turns paths into ' +
      'rivers. {leader} has to decide quickly: shelter, push, or find locals.',
    choices: [
      {
        id: 'make_camp_and_shelter',
        label: 'Make camp immediately and wait it out.',
        description:
          '{leader} selects the most defensible position available and ' +
          'the expedition hunkers down. They lose a day and eat a day\'s ' +
          'supplies sitting still, but no one gets hurt.',
        consequences: [
          { type: 'modify_expedition_resource', target: 'food', value: -2 },
        ],
      },
      {
        id: 'press_on',
        label: 'Keep moving. A moving target hits nothing.',
        description:
          '{leader} makes the call to push through. The party lowers their ' +
          'heads and moves. It is miserable and there is some risk, but ' +
          'they may stay ahead of the worst of it.',
        consequences: [],
        skillCheck: {
          skill: 'combat',
          difficulty: 35,
          actorSelection: 'actor_slot',
          actorSlot: 'leader',
          attemptLabel: 'Lead the party through without casualties',
        },
        onSuccess: [],
        onFailure: [
          { type: 'wound_person', target: '{leader}', value: 15 },
          { type: 'modify_expedition_resource', target: 'food', value: -2 },
        ],
      },
      {
        id: 'find_locals',
        label: 'Find the nearest inhabited shelter and ask for hospitality.',
        description:
          '{leader} leads the expedition toward the smoke that can be seen ' +
          'between squalls. In this country, shelter from a storm is worth ' +
          'whatever it costs.',
        consequences: [],
        skillCheck: {
          skill: 'bargaining',
          difficulty: 35,
          actorSelection: 'actor_slot',
          actorSlot: 'leader',
          attemptLabel: 'Negotiate storm shelter with locals',
        },
        onSuccess: [
          { type: 'modify_disposition', target: '{_tribeId}', value: 6 },
        ],
        onFailure: [
          { type: 'modify_expedition_resource', target: 'food', value: -3 },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP D — SUPPLY CRISIS
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: 'exp_food_running_low',
    title: 'The Provisions Are Running Low',
    category: 'expedition',
    isDeferredOutcome: true,
    weight: 1,
    cooldown: 0,
    isUnique: false,
    actorRequirements: [
      { slot: 'leader', criteria: {} },
    ],
    prerequisites: [],
    description:
      '{leader} takes stock of the remaining provisions and does the arithmetic ' +
      'twice, because the answer the first time seems wrong. It is not wrong. ' +
      'There is perhaps one season\'s worth of food remaining for the full party. ' +
      'This needs to be addressed now, before it cannot be addressed at all.',
    choices: [
      {
        id: 'hunt_for_food',
        label: 'Break for a day and hunt.',
        description:
          '{leader} sets the party to hunting and foraging while {leader.he} ' +
          'scouts the terrain. This country is not empty of food; ' +
          'the question is whether the party can find enough of it.',
        consequences: [],
        skillCheck: {
          skill: 'plants',
          difficulty: 35,
          actorSelection: 'actor_slot',
          actorSlot: 'leader',
          attemptLabel: 'Hunt and forage for a day',
        },
        onSuccess: [
          { type: 'modify_expedition_resource', target: 'food', value: 5 },
        ],
        onFailure: [
          { type: 'modify_expedition_resource', target: 'food', value: 1 },
        ],
      },
      {
        id: 'turn_back',
        label: 'The objective is not worth this. Turn back now.',
        description:
          '{leader} calls the expedition together and gives it to them plainly: ' +
          'the food situation means the objective must wait. ' +
          'A failed expedition is not a lost expedition if everyone walks home.',
        consequences: [],
      },
      {
        id: 'reduce_rations',
        label: 'Reduce rations and press on to the objective.',
        description:
          '{leader} cuts rations and tells the party what that means for the ' +
          'next few days. They understand. The objective is within reach. ' +
          'Half-rations are a condition, not a sentence.',
        consequences: [
          { type: 'modify_expedition_resource', target: 'food', value: -1 },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP E — MORALE
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: 'exp_member_wants_to_turn_back',
    title: 'Second Thoughts',
    category: 'expedition',
    isDeferredOutcome: true,
    weight: 1,
    cooldown: 0,
    isUnique: false,
    actorRequirements: [
      { slot: 'leader', criteria: {} },
      { slot: 'member', criteria: { minAge: 14 } },
    ],
    prerequisites: [],
    description:
      '{member} finds {member.him} alone with {leader} that evening and says ' +
      'what {member.he} has been keeping to himself for three days: {member.he} ' +
      'wants to go back. Not angry, not demanding — just honest. ' +
      '{member.He} has thought about it carefully and this is where {member.he} ' +
      'has landed. {leader} listens.',
    choices: [
      {
        id: 'persuade',
        label: 'Make the case for staying. Appeal to {member.his} loyalty.',
        description:
          '{leader} says the things that need to be said — about the ' +
          'objective, about what it means to finish what you started, ' +
          'about the others who are still here. It may be enough.',
        consequences: [],
        skillCheck: {
          skill: 'leadership',
          difficulty: 45,
          actorSelection: 'actor_slot',
          actorSlot: 'leader',
          attemptLabel: 'Convince {member.him} to see it through',
        },
        onSuccess: [
          { type: 'modify_opinion', target: '{member}', value: 10 },
        ],
        onFailure: [
          { type: 'expedition_member_returns_early', target: '{member}', value: 0 },
        ],
      },
      {
        id: 'let_them_go',
        label: 'Release {member.him} from the obligation. Let {member.him} go.',
        description:
          '{leader} thanks {member.him} for what {member.he} has contributed ' +
          'and sends {member.him} back with enough provisions for the journey. ' +
          'The expedition continues, one person lighter.',
        consequences: [
          { type: 'expedition_member_returns_early', target: '{member}', value: 0 },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUP F — RETURN REPORT
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: 'exp_return_report',
    title: 'They Are Back',
    category: 'expedition',
    isDeferredOutcome: true,
    weight: 1,
    cooldown: 0,
    isUnique: false,
    actorRequirements: [
      { slot: 'leader', criteria: {} },
    ],
    prerequisites: [],
    description:
      '{leader} walks into the settlement looking worn and lighter than when ' +
      '{leader.he} left — the particular leanness of someone who has lived ' +
      'at pace for weeks. The party is behind {leader.him}. Everyone is alive. ' +
      '{leader.He} sets down {leader.his} pack, accepts a cup of water, ' +
      'and begins to talk.',
    choices: [
      {
        id: 'acknowledge',
        label: 'Welcome them back and hear the full report.',
        description:
          'The expedition\'s knowledge is now the settlement\'s knowledge. ' +
          'Whatever {leader} found out there — ruins, roads, people, danger — ' +
          'it all lives now in the maps and the journals and the memory of those ' +
          'who went and came back.',
        consequences: [
          { type: 'modify_standing', target: 'company', value: 1 },
        ],
      },
    ],
  },
];
