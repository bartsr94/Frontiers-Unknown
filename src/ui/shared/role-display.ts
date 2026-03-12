import type { WorkRole } from '../../simulation/population/person';

export const ROLE_LABELS: Record<WorkRole, string> = {
  farmer:     'Farmer',
  trader:     'Trader',
  guard:      'Guard',
  craftsman:  'Craftsman',
  healer:     'Healer',
  unassigned: 'Unassigned',
};

export const ROLE_COLORS: Record<WorkRole, string> = {
  farmer:     'bg-green-900 text-green-200',
  trader:     'bg-amber-900 text-amber-200',
  guard:      'bg-red-900 text-red-200',
  craftsman:  'bg-stone-700 text-stone-200',
  healer:     'bg-cyan-900 text-cyan-200',
  unassigned: 'bg-stone-800 text-stone-400',
};
