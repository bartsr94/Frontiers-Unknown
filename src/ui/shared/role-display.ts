import type { WorkRole } from '../../simulation/population/person';

/** Maximum number of seats on the Expedition Council. */
export const MAX_COUNCIL_SEATS = 7;

export const ROLE_LABELS: Record<WorkRole, string> = {
  farmer:         'Farmer',
  trader:         'Trader',
  guard:          'Guard',
  craftsman:      'Craftsman',
  healer:         'Healer',
  builder:        'Builder',
  away:           'Away',
  keth_thara:     'Keth-Thara',
  gather_food:    'Forager',
  gather_stone:   'Quarrier',
  gather_lumber:  'Lumberjack',
  priest_solar:   'Solar Priest',
  wheel_singer:   'Wheel Singer',
  voice_of_wheel: 'Voice of the Wheel',
  blacksmith:     'Blacksmith',
  tailor:         'Tailor',
  brewer:         'Brewer',
  miller:         'Miller',
  herder:              'Herder',
  bathhouse_attendant: 'Bath Attendant',
  child:               'Child',
  unassigned:          'Unassigned',
};

export const ROLE_COLORS: Record<WorkRole, string> = {
  farmer:         'bg-green-900 text-green-200',
  trader:         'bg-amber-900 text-amber-200',
  guard:          'bg-red-900 text-red-200',
  craftsman:      'bg-stone-700 text-stone-200',
  healer:         'bg-cyan-900 text-cyan-200',
  builder:        'bg-orange-900 text-orange-200',
  away:           'bg-stone-700 text-amber-500 italic',
  keth_thara:     'bg-violet-900 text-violet-200 italic',
  gather_food:    'bg-lime-900 text-lime-200',
  gather_stone:   'bg-slate-700 text-slate-200',
  gather_lumber:  'bg-yellow-900 text-yellow-200',
  priest_solar:   'bg-yellow-700 text-yellow-100',
  wheel_singer:   'bg-teal-900 text-teal-200',
  voice_of_wheel: 'bg-indigo-900 text-indigo-200',
  blacksmith:     'bg-stone-600 text-orange-300',
  tailor:         'bg-violet-800 text-violet-300',
  brewer:         'bg-amber-800 text-amber-200',
  miller:         'bg-yellow-800 text-yellow-200',
  herder:              'bg-green-800 text-green-300',
  bathhouse_attendant: 'bg-sky-800 text-sky-200',
  child:               'bg-stone-800 text-stone-500 italic',
  unassigned:          'bg-stone-800 text-stone-400',
};
