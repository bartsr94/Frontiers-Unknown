/**
 * EmissaryDispatchOverlay — modal for selecting and dispatching an emissary.
 *
 * Player selects:
 *   - A known clan to visit (pre-selected when opened from TribeInfoCard)
 *   - The emissary (settler with best bargaining skill listed first)
 *   - Mission type (open_relations / gift_giving / request_food / request_goods)
 *   - Pack gifts: gold, goods, food sliders (0-based; pulled from settlement)
 *
 * Dispatch is gated on: management phase, contactEstablished tribe, emissary
 * available (role !== 'away'), and no existing emissary at that tribe.
 */

import { useState, useMemo } from 'react';
import { useGameStore } from '../../stores/game-store';
import type { EmissaryMissionType } from '../../simulation/turn/game-state';
import type { Person } from '../../simulation/population/person';
import { emissaryTravelTime } from '../../simulation/world/emissaries';
import { skinToneColor } from '../components/Portrait';
import { heritageAbbr } from '../components/heritage-helpers';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isEmissaryEligible(p: Person): boolean {
  return p.role !== 'away' && p.role !== 'builder' && p.age >= 16;
}

const MISSION_LABELS: Record<EmissaryMissionType, string> = {
  open_relations: 'Open Relations — propose trade and friendship',
  gift_giving:    'Bear Gifts — improve disposition with no strings',
  request_food:   'Request Food — ask for a food grant',
  request_goods:  'Request Goods — ask for goods from the clan',
};

// ─── Person chip ──────────────────────────────────────────────────────────────

function PersonChip({
  person,
  selected,
  toggle,
  disabled,
  bargainingLabel,
}: {
  person: Person;
  selected: boolean;
  toggle: () => void;
  disabled: boolean;
  bargainingLabel: string;
}) {
  const dot  = skinToneColor(person.genetics.visibleTraits.skinTone);
  const abbr = heritageAbbr(person.heritage.bloodline);
  return (
    <button
      onClick={toggle}
      disabled={disabled}
      className={`flex items-center gap-1.5 px-2 py-1.5 rounded border text-xs transition-colors ${
        selected
          ? 'bg-amber-700/40 border-amber-500 text-amber-200'
          : disabled
            ? 'bg-stone-900/40 border-stone-700 text-stone-600 cursor-not-allowed'
            : 'bg-stone-800/60 border-stone-700 text-stone-300 hover:border-stone-500'
      }`}
    >
      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: dot }} />
      <span className="font-medium truncate max-w-[80px]">{person.firstName}</span>
      <span className="text-[10px] text-stone-500 shrink-0">{abbr}</span>
      <span className="text-[10px] text-sky-400 shrink-0 ml-auto">{bargainingLabel}</span>
    </button>
  );
}

// ─── Slider ──────────────────────────────────────────────────────────────────

function ResourceSlider({
  label,
  value,
  max,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-[11px] text-stone-400">
        <span>{label}</span>
        <span className="text-stone-200">{value} / {max}</span>
      </div>
      <input
        type="range"
        min={0}
        max={max}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-amber-500"
      />
    </div>
  );
}

// ─── Main overlay ─────────────────────────────────────────────────────────────

interface Props {
  initialTribeId?: string;
  initialMission?: 'gift_giving' | 'open_relations';
  onClose: () => void;
}

export default function EmissaryDispatchOverlay({ initialTribeId, initialMission, onClose }: Props) {
  const gameState       = useGameStore(s => s.gameState);
  const dispatchAction  = useGameStore(s => s.dispatchEmissary);
  const currentPhase    = useGameStore(s => s.currentPhase);

  const [tribeId, setTribeId]     = useState<string>(initialTribeId ?? '');
  const [emissaryId, setEmissaryId] = useState<string>('');
  const [mission, setMission]     = useState<EmissaryMissionType>(initialMission ?? 'open_relations');
  const [giftGold, setGiftGold]   = useState(0);
  const [giftGoods, setGiftGoods] = useState(0);
  const [giftFood, setGiftFood]   = useState(0);

  if (!gameState) return null;

  const knownTribes = [...gameState.tribes.values()]
    .filter(t => t.contactEstablished)
    .sort((a, b) => a.name.localeCompare(b.name));

  const selectedTribe = gameState.tribes.get(tribeId) ?? null;

  const eligiblePeople = useMemo(() => {
    const result = [...gameState.people.values()]
      .filter(p => isEmissaryEligible(p))
      .sort((a, b) => (b.skills?.bargaining ?? 0) - (a.skills?.bargaining ?? 0));
    return result;
  }, [gameState.people]);

  // Auto-select the first eligible person if none selected.
  const resolvedEmissaryId = emissaryId || eligiblePeople[0]?.id || '';
  const resolvedEmissary   = gameState.people.get(resolvedEmissaryId) ?? null;

  const resources  = gameState.settlement.resources;
  const maxGold    = resources.gold  ?? 0;
  const maxGoods   = resources.goods ?? 0;
  const maxFood    = Math.min(resources.food ?? 0, 20); // cap at 20 to avoid starving settlement

  // Travel time preview.
  const bargaining = resolvedEmissary?.skills?.bargaining ?? 0;
  const travelTurns = selectedTribe
    ? emissaryTravelTime(selectedTribe, bargaining)
    : null;

  // Validation.
  const alreadyActive = selectedTribe
    ? (gameState.emissaries ?? []).some(
        e => e.tribeId === selectedTribe.id && (e.status === 'travelling' || e.status === 'at_tribe'),
      )
    : false;

  const canDispatch =
    currentPhase === 'management' &&
    tribeId !== '' &&
    resolvedEmissaryId !== '' &&
    !alreadyActive &&
    selectedTribe !== null;

  const dispatchTitle = !canDispatch
    ? alreadyActive
      ? 'An emissary is already at this clan'
      : tribeId === ''
        ? 'Select a destination clan'
        : resolvedEmissaryId === ''
          ? 'No eligible settlers available'
          : 'Only available during management phase'
    : `Dispatch ${resolvedEmissary?.firstName ?? 'emissary'} — arrives in ${travelTurns} turn${travelTurns !== 1 ? 's' : ''}`;

  function handleDispatch() {
    if (!canDispatch || !selectedTribe) return;
    dispatchAction({
      tribeId,
      emissaryId: resolvedEmissaryId,
      missionType: mission,
      packedGifts: { gold: giftGold, goods: giftGoods, food: giftFood },
      travelOneWay: travelTurns ?? 4,
      dispatchedTurn: gameState!.turnNumber,
    });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-stone-900 border border-stone-600 rounded-lg shadow-2xl w-[380px] max-h-[90vh] overflow-y-auto flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-700 shrink-0">
          <h2 className="text-amber-200 font-semibold text-sm">Send Emissary</h2>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-300 leading-none text-base">✕</button>
        </div>

        <div className="px-4 py-3 space-y-4">

          {/* Destination clan */}
          <div className="space-y-1.5">
            <label className="text-stone-400 uppercase text-[10px] tracking-wide block">Destination Clan</label>
            {knownTribes.length === 0 ? (
              <p className="text-stone-500 text-xs italic">No known clans yet — establish contact first.</p>
            ) : (
              <select
                value={tribeId}
                onChange={e => setTribeId(e.target.value)}
                className="w-full bg-stone-800 border border-stone-600 rounded px-2 py-1.5 text-stone-200 text-xs"
              >
                <option value="">— Select clan —</option>
                {knownTribes.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name} (disposition {t.disposition > 0 ? '+' : ''}{t.disposition})
                  </option>
                ))}
              </select>
            )}
            {alreadyActive && (
              <p className="text-rose-400 text-[11px]">An emissary is already with this clan.</p>
            )}
          </div>

          {/* Mission type */}
          <div className="space-y-1.5">
            <label className="text-stone-400 uppercase text-[10px] tracking-wide block">Mission</label>
            <div className="space-y-1">
              {(Object.keys(MISSION_LABELS) as EmissaryMissionType[]).map(m => (
                <label key={m} className="flex items-start gap-2 cursor-pointer group">
                  <input
                    type="radio"
                    name="mission"
                    value={m}
                    checked={mission === m}
                    onChange={() => setMission(m)}
                    className="mt-0.5 accent-amber-500 shrink-0"
                  />
                  <span className={`text-xs leading-snug ${mission === m ? 'text-amber-200' : 'text-stone-400 group-hover:text-stone-300'}`}>
                    {MISSION_LABELS[m]}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Emissary selection */}
          <div className="space-y-1.5">
            <label className="text-stone-400 uppercase text-[10px] tracking-wide block">
              Emissary {resolvedEmissary && (
                <span className="text-sky-400 normal-case">
                  — Bargaining {resolvedEmissary.skills?.bargaining ?? 0}
                  {travelTurns !== null && `, travel ${travelTurns}t`}
                </span>
              )}
            </label>
            {eligiblePeople.length === 0 ? (
              <p className="text-stone-500 text-xs italic">No available settlers.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                {eligiblePeople.map(p => (
                  <PersonChip
                    key={p.id}
                    person={p}
                    selected={resolvedEmissaryId === p.id}
                    toggle={() => setEmissaryId(p.id)}
                    disabled={false}
                    bargainingLabel={`Brg ${p.skills?.bargaining ?? 0}`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Packed gifts */}
          <div className="space-y-2">
            <label className="text-stone-400 uppercase text-[10px] tracking-wide block">
              Pack Gifts <span className="text-stone-600 normal-case text-[10px]">(optional)</span>
            </label>
            <ResourceSlider label="Gold"  value={giftGold}  max={maxGold}  onChange={setGiftGold} />
            <ResourceSlider label="Goods" value={giftGoods} max={maxGoods} onChange={setGiftGoods} />
            <ResourceSlider label="Food"  value={giftFood}  max={maxFood}  onChange={setGiftFood} />
            {(giftGold > 0 || giftGoods > 0 || giftFood > 0) && selectedTribe && (
              <p className="text-stone-500 text-[11px]">
                These gifts are reserved at dispatch; your emissary decides how much to offer during the session.
              </p>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-stone-700 shrink-0 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-3 py-1.5 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs"
          >
            Cancel
          </button>
          <button
            onClick={handleDispatch}
            disabled={!canDispatch}
            title={dispatchTitle}
            className={`flex-1 px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
              canDispatch
                ? 'bg-amber-700 hover:bg-amber-600 text-amber-100'
                : 'bg-stone-800 text-stone-600 cursor-not-allowed'
            }`}
          >
            Dispatch Emissary
          </button>
        </div>

      </div>
    </div>
  );
}
