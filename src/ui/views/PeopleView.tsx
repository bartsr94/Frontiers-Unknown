/**
 * PeopleView — population roster.
 *
 * Shows all living settlers with skin-tone dot, heritage abbreviation,
 * age, sex icon, role badge, and marital status. Supports sort and filter.
 */

import React, { useState } from 'react';
import { useGameStore } from '../../stores/game-store';
import type { WorkRole } from '../../simulation/population/person';
import { getSkillRating } from '../../simulation/population/person';
import type { SkillId, SkillRating } from '../../simulation/population/person';
import { skinToneColor } from '../components/Portrait';
import { heritageAbbr } from '../components/heritage-helpers';
import PersonDetail from './PersonDetail';
import MarriageDialog from '../overlays/MarriageDialog';
import { ROLE_LABELS, ROLE_COLORS, MAX_COUNCIL_SEATS } from '../shared/role-display';

const MAX_COUNCIL = MAX_COUNCIL_SEATS;

type SortKey = 'name' | 'age' | 'heritage' | 'role' | SkillId;

const SKILL_SORT_LABELS: Array<{ id: SkillId; label: string }> = [
  { id: 'animals',    label: 'Animals' },
  { id: 'bargaining', label: 'Bargaining' },
  { id: 'combat',     label: 'Combat' },
  { id: 'custom',     label: 'Custom' },
  { id: 'leadership', label: 'Leadership' },
  { id: 'plants',     label: 'Plants' },
];

const RATING_SHORT: Record<SkillRating, string> = {
  fair:      'FR',
  good:      'GD',
  very_good: 'VG',
  excellent: 'EX',
  renowned:  'RN',
  heroic:    'HR',
};

const RATING_BADGE_CLASS: Record<SkillRating, string> = {
  fair:      'bg-stone-700 text-slate-400',
  good:      'bg-stone-700 text-green-400',
  very_good: 'bg-stone-700 text-teal-400',
  excellent: 'bg-stone-700 text-blue-400',
  renowned:  'bg-stone-700 text-purple-400',
  heroic:    'bg-stone-700 text-amber-400',
};

interface FilterState {
  sex:      'all' | 'male' | 'female';
  married:  'all' | 'married' | 'unmarried';
  heritage: 'all' | 'IMA' | 'KIS' | 'HAN' | 'MIX';
}

// ─── Component ────────────────────────────────────────────────────────────────

// Roles that can be assigned manually. 'builder' and 'away' are managed by
// their respective systems and are locked from direct assignment.
const ASSIGNABLE_ROLES: WorkRole[] = [
  'farmer',
  'gather_food',
  'gather_stone',
  'gather_lumber',
  'trader',
  'craftsman',
  'healer',
  'guard',
  'unassigned',
];

export default function PeopleView() {
  const [selectedId,        setSelectedId]        = useState<string | null>(null);
  const [sortKey,           setSortKey]            = useState<SortKey>('name');
  const [filter,            setFilter]             = useState<FilterState>({ sex: 'all', married: 'all', heritage: 'all' });
  const [showMarriageDialog, setShowMarriageDialog] = useState(false);
  const [rolePickerId,      setRolePickerId]       = useState<string | null>(null);
  const [pickerPos,         setPickerPos]          = useState<{ top: number; left: number; openUp: boolean } | null>(null);

  const peopleMap           = useGameStore(s => s.gameState?.people);
  const councilIds          = useGameStore(s => s.gameState?.councilMemberIds ?? []);
  const assignCouncilMember = useGameStore(s => s.assignCouncilMember);
  const removeCouncilMember = useGameStore(s => s.removeCouncilMember);
  const assignRole          = useGameStore(s => s.assignRole);
  const people = peopleMap ? Array.from(peopleMap.values()) : [];

  // ── Filter ────────────────────────────────────────────────────────────────
  const filtered = people.filter(p => {
    if (filter.sex !== 'all' && p.sex !== filter.sex) return false;
    if (filter.married === 'married'   && p.spouseIds.length === 0) return false;
    if (filter.married === 'unmarried' && p.spouseIds.length  >  0) return false;
    if (filter.heritage !== 'all') {
      const abbr = heritageAbbr(p.heritage.bloodline);
      const group = abbr === 'MIX' ? 'MIX' : abbr === 'IMA' ? 'IMA' : abbr.startsWith('KIS') ? 'KIS' : 'HAN';
      if (group !== filter.heritage) return false;
    }
    return true;
  });

  // ── Sort ──────────────────────────────────────────────────────────────────
  const sorted = [...filtered].sort((a, b) => {
    switch (sortKey) {
      case 'age':      return b.age - a.age;
      case 'role':     return a.role.localeCompare(b.role);
      case 'heritage': return heritageAbbr(a.heritage.bloodline).localeCompare(heritageAbbr(b.heritage.bloodline));
      case 'animals':
      case 'bargaining':
      case 'combat':
      case 'custom':
      case 'leadership':
      case 'plants':   return b.skills[sortKey] - a.skills[sortKey];
      default:         return `${a.firstName} ${a.familyName}`.localeCompare(`${b.firstName} ${b.familyName}`);
    }
  });

  const activeSkill: SkillId | null = (['animals', 'bargaining', 'combat', 'custom', 'leadership', 'plants'] as const).includes(sortKey as SkillId)
    ? (sortKey as SkillId)
    : null;

  // ── Helpers ───────────────────────────────────────────────────────────────
  const selectBtn = (active: boolean) =>
    `px-2 py-0.5 rounded text-xs border transition-colors ${active ? 'bg-amber-800 text-amber-100 border-amber-600' : 'bg-stone-800 text-stone-400 border-stone-600 hover:text-stone-200'}`;

  return (
    <div className="flex h-full overflow-hidden relative">

      {/* ── Marriage dialog overlay ── */}
      {showMarriageDialog && (
        <MarriageDialog onClose={() => setShowMarriageDialog(false)} />
      )}

      {/* ── Role picker backdrop — dismisses open dropdown on outside click ── */}
      {rolePickerId && (
        <div
          className="fixed inset-0 z-[49]"
          onClick={() => { setRolePickerId(null); setPickerPos(null); }}
        />
      )}

      {/* ── Left: roster table ── */}
      <div className="flex-1 min-w-0 overflow-y-auto p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-amber-200 font-bold text-lg">
            Settlers ({sorted.length}{filtered.length !== people.length ? `/${people.length}` : ''})
          </h2>
          <button
            onClick={() => setShowMarriageDialog(true)}
            className="px-3 py-1 rounded text-xs font-bold bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-stone-950 shadow transition-colors"
          >
            Arrange Marriage
          </button>
        </div>

        {/* Filter / Sort bar */}
        <div className="mb-3 rounded bg-stone-800 border border-stone-700 divide-y divide-stone-700">
          {/* Row 1 — Sort */}
          <div className="flex flex-wrap items-center gap-1.5 px-2 py-1.5">
            <span className="text-stone-500 text-xs font-medium w-7 shrink-0">Sort</span>
            <span className="w-px h-3 bg-stone-600 self-center mx-0.5" />
            {(['name', 'age', 'heritage', 'role'] as SortKey[]).map(k => (
              <button key={k} onClick={() => setSortKey(k)} className={selectBtn(sortKey === k)}>
                {k.charAt(0).toUpperCase() + k.slice(1)}
              </button>
            ))}
            <span className="w-px h-3 bg-stone-600 self-center mx-0.5" />
            <span className="text-stone-600 text-[10px] font-medium self-center">Skills</span>
            {SKILL_SORT_LABELS.map(({ id, label }) => (
              <button key={id} onClick={() => setSortKey(id)} className={selectBtn(sortKey === id)}>
                {label}
              </button>
            ))}
          </div>

          {/* Row 2 — Filters */}
          <div className="flex flex-wrap items-center gap-1.5 px-2 py-1.5">
            <span className="text-stone-500 text-xs font-medium w-7 shrink-0">Sex</span>
            <span className="w-px h-3 bg-stone-600 self-center mx-0.5" />
            {(['all', 'female', 'male'] as const).map(v => (
              <button key={v} onClick={() => setFilter(f => ({ ...f, sex: v }))} className={selectBtn(filter.sex === v)}>
                {v === 'female' ? '♀' : v === 'male' ? '♂' : 'All'}
              </button>
            ))}
            <span className="w-px h-3 bg-stone-600 self-center mx-1.5" />
            <span className="text-stone-500 text-xs font-medium">Status</span>
            <span className="w-px h-3 bg-stone-600 self-center mx-0.5" />
            {(['all', 'unmarried', 'married'] as const).map(v => (
              <button key={v} onClick={() => setFilter(f => ({ ...f, married: v }))} className={selectBtn(filter.married === v)}>
                {v === 'all' ? 'All' : v === 'married' ? '◎ Married' : '○ Single'}
              </button>
            ))}
            <span className="w-px h-3 bg-stone-600 self-center mx-1.5" />
            <span className="text-stone-500 text-xs font-medium">Heritage</span>
            <span className="w-px h-3 bg-stone-600 self-center mx-0.5" />
            {(['all', 'IMA', 'KIS', 'HAN', 'MIX'] as const).map(v => (
              <button key={v} onClick={() => setFilter(f => ({ ...f, heritage: v }))} className={selectBtn(filter.heritage === v)}>
                {v === 'all' ? 'All' : v}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-lg border border-stone-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-stone-800 text-amber-400 text-left">
                <th className="px-3 py-2 font-semibold">Name</th>
                <th className="px-2 py-2 font-semibold">Heritage</th>
                <th className="px-2 py-2 font-semibold">Age</th>
                <th className="px-2 py-2 font-semibold text-center">Sex</th>
                <th className="px-2 py-2 font-semibold">Role</th>
                <th className="px-2 py-2 font-semibold text-center w-10" title={activeSkill ? `Sort: ${activeSkill} — FR=Fair · GD=Good · VG=Very Good · EX=Excellent · RN=Renowned · HR=Heroic` : undefined}>
                  {activeSkill ? <span className="capitalize">{activeSkill}</span> : null}
                </th>
                <th className="px-2 py-2 font-semibold text-center" title="Marital status">Married</th>
                <th className="px-2 py-2 font-semibold text-center" title="Expedition Council (max 7)">Council</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((person, i) => {
                const onCouncil   = councilIds.includes(person.id);
                const councilFull = councilIds.length >= MAX_COUNCIL;
                const canAdd      = !onCouncil && !councilFull;
                const abbr        = heritageAbbr(person.heritage.bloodline);
                const dot         = skinToneColor(person.genetics.visibleTraits.skinTone);
                const isMarried   = person.spouseIds.length > 0;

                return (
                  <tr
                    key={person.id}
                    onClick={() => setSelectedId(id => id === person.id ? null : person.id)}
                    className={`border-t border-stone-700 transition-colors cursor-pointer
                                hover:bg-stone-700 active:bg-stone-600
                                ${onCouncil ? 'border-l-2 border-l-amber-500' : 'border-l-2 border-l-transparent'}
                                ${selectedId === person.id ? 'bg-stone-700 ring-1 ring-inset ring-amber-600' : i % 2 === 0 ? 'bg-stone-800' : 'bg-stone-850'}`}
                  >
                    {/* Name + skin dot */}
                    <td className="px-3 py-2 text-amber-100 font-medium">
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="inline-block w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: dot }}
                          aria-hidden="true"
                        />
                        {person.firstName} {person.familyName}
                      </span>
                    </td>

                    {/* Heritage abbreviation */}
                    <td className="px-2 py-2">
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-stone-700 text-stone-300">
                        {abbr}
                      </span>
                    </td>

                    {/* Age */}
                    <td className="px-2 py-2 text-stone-400 tabular-nums">
                      {person.age.toFixed(0)}
                    </td>

                    {/* Sex icon */}
                    <td className="px-2 py-2 text-center">
                      <span className={person.sex === 'female' ? 'text-rose-400' : 'text-sky-400'}>
                        {person.sex === 'female' ? '♀' : '♂'}
                      </span>
                    </td>

                    {/* Role — clickable dropdown for assignable roles */}
                    <td className="px-2 py-2">
                      {person.role === 'away' || person.role === 'builder' || person.role === 'keth_thara' ? (
                        // Locked roles: managed by mission/construction/keth-thara systems
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${ROLE_COLORS[person.role]}`}
                          title={
                            person.role === 'away'        ? 'Away on mission — cannot reassign' :
                            person.role === 'keth_thara'  ? 'On Keth-Thara service — returns automatically' :
                            'Assigned to construction — use Settlement to unassign'
                          }
                        >
                          {ROLE_LABELS[person.role]}
                        </span>
                      ) : (
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            if (rolePickerId === person.id) {
                              setRolePickerId(null);
                              setPickerPos(null);
                            } else {
                              const rect = e.currentTarget.getBoundingClientRect();
                              const openUp = rect.bottom + 240 > window.innerHeight;
                              setPickerPos(openUp
                                ? { top: rect.top, left: rect.left, openUp: true }
                                : { top: rect.bottom + 2, left: rect.left, openUp: false }
                              );
                              setRolePickerId(person.id);
                            }
                          }}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold
                                      ${ROLE_COLORS[person.role]}
                                      hover:ring-1 hover:ring-white/40 transition-all cursor-pointer`}
                          title="Click to change role"
                        >
                          {ROLE_LABELS[person.role]}
                          <span className="opacity-50 text-[9px] leading-none">▾</span>
                        </button>
                      )}

                    </td>

                    {/* Skill rating badge — always rendered to prevent layout shift */}
                    <td className="px-2 py-2 text-center w-10">
                      {activeSkill && (() => {
                        const val = person.skills[activeSkill];
                        const rating = getSkillRating(val);
                        return (
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${RATING_BADGE_CLASS[rating]}`}>
                            {RATING_SHORT[rating]}
                          </span>
                        );
                      })()}
                    </td>

                    {/* Married indicator */}
                    <td className="px-2 py-2 text-center" title={isMarried ? 'Married' : 'Single'}>
                      <span className={isMarried ? 'text-amber-400' : 'text-stone-600'}>
                        {isMarried ? '◎' : '○'}
                      </span>
                    </td>

                    {/* Council seat */}
                    <td className="px-2 py-2 text-center">
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          onCouncil ? removeCouncilMember(person.id) : assignCouncilMember(person.id);
                        }}
                        disabled={!onCouncil && councilFull}
                        title={onCouncil ? 'Remove from council' : councilFull ? 'Council is full (7 max)' : 'Add to council'}
                        className={`text-lg leading-none transition-opacity
                                    ${onCouncil ? 'opacity-100' : canAdd ? 'opacity-30 hover:opacity-70' : 'opacity-10 cursor-not-allowed'}`}
                      >
                        {onCouncil ? '⭐' : '☆'}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-stone-500 italic">
                    No settlers match the current filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Fixed role picker dropdown (escapes all overflow clipping ancestors) ── */}
      {rolePickerId && pickerPos && (() => {
        const person = sorted.find(p => p.id === rolePickerId);
        if (!person) return null;
        const style: React.CSSProperties = pickerPos.openUp
          ? { position: 'fixed', bottom: window.innerHeight - pickerPos.top, left: pickerPos.left }
          : { position: 'fixed', top: pickerPos.top, left: pickerPos.left };
        return (
          <div
            className="z-50 bg-stone-900 border border-stone-600 rounded shadow-xl py-0.5 min-w-[10rem]"
            style={style}
            onClick={e => e.stopPropagation()}
          >
            {/* Farming & Gathering group */}
            <div className="px-2 py-0.5 text-[9px] text-stone-500 uppercase tracking-wider font-semibold mt-0.5">Farming &amp; Gathering</div>
            {(['farmer', 'gather_food', 'gather_stone', 'gather_lumber'] satisfies WorkRole[]).map(r => (
              <button
                key={r}
                onClick={() => { assignRole(person.id, r); setRolePickerId(null); setPickerPos(null); }}
                className={`w-full text-left px-2.5 py-1 text-xs flex items-center gap-2 transition-colors
                            ${ person.role === r ? 'opacity-40 cursor-default' : 'hover:bg-stone-700'}`}
              >
                <span className={`inline-block px-1.5 py-0.5 rounded font-semibold ${ROLE_COLORS[r]}`}>
                  {ROLE_LABELS[r]}
                </span>
              </button>
            ))}
            {/* Specialist group */}
            <div className="px-2 py-0.5 text-[9px] text-stone-500 uppercase tracking-wider font-semibold mt-1 border-t border-stone-700 pt-1">Specialist</div>
            {(['trader', 'craftsman', 'healer', 'guard'] satisfies WorkRole[]).map(r => (
              <button
                key={r}
                onClick={() => { assignRole(person.id, r); setRolePickerId(null); setPickerPos(null); }}
                className={`w-full text-left px-2.5 py-1 text-xs flex items-center gap-2 transition-colors
                            ${ person.role === r ? 'opacity-40 cursor-default' : 'hover:bg-stone-700'}`}
              >
                <span className={`inline-block px-1.5 py-0.5 rounded font-semibold ${ROLE_COLORS[r]}`}>
                  {ROLE_LABELS[r]}
                </span>
              </button>
            ))}
            {/* Unassigned */}
            <div className="border-t border-stone-700 mx-1 mt-0.5" />
            <button
              onClick={() => { assignRole(person.id, 'unassigned'); setRolePickerId(null); setPickerPos(null); }}
              className={`w-full text-left px-2.5 py-1 text-xs flex items-center gap-2 transition-colors
                          ${ person.role === 'unassigned' ? 'opacity-40 cursor-default' : 'hover:bg-stone-700'}`}
            >
              <span className={`inline-block px-1.5 py-0.5 rounded font-semibold ${ROLE_COLORS.unassigned}`}>
                Unassigned
              </span>
            </button>
          </div>
        );
      })()}

      {/* ── Right: person detail panel ── */}
      {selectedId && (
        <>
          {/* Dim backdrop on narrow viewports */}
          <div
            className="xl:hidden absolute inset-0 bg-stone-950/60 z-10"
            onClick={() => setSelectedId(null)}
          />
          <div className="
            xl:relative xl:flex-none xl:w-80
            max-xl:absolute max-xl:inset-y-0 max-xl:right-0 max-xl:w-80 max-xl:z-20
            overflow-y-auto
          ">
            <PersonDetail
              personId={selectedId}
              onClose={() => setSelectedId(null)}
              onNavigate={id => setSelectedId(id)}
            />
          </div>
        </>
      )}
    </div>
  );
}
