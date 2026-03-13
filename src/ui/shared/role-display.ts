import type { WorkRole } from '../../simulation/population/person';

export const ROLE_LABELS: Record<WorkRole, string> = {
  farmer:         'Farmer',
  trader:         'Trader',
  guard:          'Guard',
  craftsman:      'Craftsman',
  healer:         'Healer',
  builder:        'Builder',
  away:           'Away',
  gather_food:    'Forager',
  gather_stone:   'Quarrier',
  gather_lumber:  'Lumberjack',
  unassigned:     'Unassigned',
};

export const ROLE_COLORS: Record<WorkRole, string> = {
  farmer:         'bg-green-900 text-green-200',
  trader:         'bg-amber-900 text-amber-200',
  guard:          'bg-red-900 text-red-200',
  craftsman:      'bg-stone-700 text-stone-200',
  healer:         'bg-cyan-900 text-cyan-200',
  builder:        'bg-orange-900 text-orange-200',
  away:           'bg-stone-700 text-amber-500 italic',
  gather_food:    'bg-lime-900 text-lime-200',
  gather_stone:   'bg-slate-700 text-slate-200',
  gather_lumber:  'bg-yellow-900 text-yellow-200',
  unassigned:     'bg-stone-800 text-stone-400',
};
