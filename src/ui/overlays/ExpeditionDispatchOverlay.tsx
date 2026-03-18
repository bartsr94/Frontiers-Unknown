/**
 * ExpeditionDispatchOverlay — modal for assembling and dispatching an expedition.
 *
 * Player selects:
 *   - A leader (required; must be a living settler not currently away/builder)
 *   - Up to 9 additional party members
 *   - Whether to bring a boat (toggle; only shown if boatsInPort > 0)
 *   - Destination hex (Q, R coordinates; pre-populated when dispatched via hex click)
 *   - Food provisions (slider; suggested minimum based on estimate)
 *
 * The overlay calls `dispatchExpedition` on confirm. Validation prevents dispatch
 * when the destination is the settlement hex, no leader is selected, or food is 0.
 */

import { useState, useMemo } from 'react';
import { useGameStore } from '../../stores/game-store';
import type { Person } from '../../simulation/population/person';
import { SETTLEMENT_Q, SETTLEMENT_R } from '../../simulation/world/hex-map';
import { estimateExpeditionFood } from '../../simulation/world/expeditions';
import { skinToneColor } from '../components/Portrait';
import { heritageAbbr } from '../components/heritage-helpers';
import { ROLE_LABELS } from '../shared/role-display';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isAvailable(p: Person): boolean {
  return p.role !== 'away' && p.role !== 'builder';
}

function PersonChip({
  person,
  selected,
  toggle,
  disabled = false,
  label,
}: {
  person: Person;
  selected: boolean;
  toggle: () => void;
  disabled?: boolean;
  label?: string;
}) {
  const dot = skinToneColor(person.genetics.visibleTraits.skinTone);
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
      {label && (
        <span className="ml-0.5 text-[10px] text-amber-400 shrink-0">{label}</span>
      )}
    </button>
  );
}

// ─── Main overlay ─────────────────────────────────────────────────────────────

interface Props {
  initialDestQ?: number;
  initialDestR?: number;
  onClose: () => void;
}

export default function ExpeditionDispatchOverlay({ initialDestQ, initialDestR, onClose }: Props) {
  const gameState          = useGameStore(s => s.gameState);
  const dispatchExpedition = useGameStore(s => s.dispatchExpedition);
  const currentPhase       = useGameStore(s => s.currentPhase);

  const [leaderId, setLeaderId]     = useState<string | null>(null);
  const [memberIds, setMemberIds]   = useState<string[]>([]);
  const [useBoat, setUseBoat]       = useState(false);
  const [destQ, setDestQ]           = useState<string>(initialDestQ !== undefined ? String(initialDestQ) : '');
  const [destR, setDestR]           = useState<string>(initialDestR !== undefined ? String(initialDestR) : '');
  const [food, setFood]             = useState(0);
  const [customName, setCustomName] = useState('');

  if (!gameState) return null;
  if (currentPhase !== 'management') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
        <div className="bg-stone-900 border border-stone-600 rounded p-6 text-stone-400 text-sm">
          Expeditions can only be dispatched during the Management phase.
          <button onClick={onClose} className="block mt-4 text-amber-400 hover:text-amber-300">Close</button>
        </div>
      </div>
    );
  }

  const allPeople: Person[] = [...gameState.people.values()];
  const available = allPeople.filter(isAvailable);
  const boatsInPort = gameState.boatsInPort ?? 1;

  // Food estimate
  const parsedQ = parseInt(destQ, 10);
  const parsedR = parseInt(destR, 10);
  const partySize = 1 + memberIds.length; // leader + members
  const destValid = !isNaN(parsedQ) && !isNaN(parsedR);
  const isSettlementDest = destValid && parsedQ === SETTLEMENT_Q && parsedR === SETTLEMENT_R;

  const suggestedFood = useMemo(() => {
    if (!destValid || partySize === 0) return 0;
    return estimateExpeditionFood(partySize, SETTLEMENT_Q, SETTLEMENT_R, parsedQ, parsedR, useBoat);
  }, [destValid, parsedQ, parsedR, partySize, useBoat]);

  // Sync slider range whenever suggested changes
  const maxFood = Math.max(suggestedFood * 3, 30);

  // Validation
  const canDispatch =
    leaderId !== null &&
    destValid &&
    !isSettlementDest &&
    food > 0 &&
    food <= gameState.settlement.resources.food;

  function toggleMember(id: string) {
    if (id === leaderId) return; // can't toggle the leader via member list
    setMemberIds(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : prev.length < 9 ? [...prev, id] : prev,
    );
  }

  function selectLeader(id: string) {
    setMemberIds(prev => prev.filter(m => m !== id)); // remove from members if present
    setLeaderId(id);
  }

  function handleDispatch() {
    if (!canDispatch || !leaderId) return;
    dispatchExpedition({
      leaderId,
      memberIds,
      destinationQ: parsedQ,
      destinationR: parsedR,
      customName: customName.trim() || undefined,
      hasBoat: useBoat,
      provisions: { food, goods: 0, gold: 0, medicine: 0 },
    });
    onClose();
  }

  const leader = leaderId ? gameState.people.get(leaderId) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-stone-900 border border-stone-600 rounded-lg shadow-2xl w-[560px] max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-stone-700 shrink-0">
          <h2 className="text-amber-300 font-semibold text-sm uppercase tracking-wide">Dispatch Expedition</h2>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-300 text-base leading-none">✕</button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-5">

          {/* ── Destination ─────────────────────────────────────────── */}
          <section>
            <p className="text-stone-500 uppercase tracking-wide text-[10px] mb-2">Destination (Hex Q, R)</p>
            <div className="flex gap-3 items-center">
              <div className="flex items-center gap-1.5">
                <label className="text-stone-400 text-xs w-4">Q</label>
                <input
                  type="number"
                  value={destQ}
                  onChange={e => setDestQ(e.target.value)}
                  min={0}
                  max={14}
                  className="w-16 bg-stone-800 border border-stone-600 rounded px-2 py-1 text-stone-200 text-xs focus:outline-none focus:border-amber-600"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <label className="text-stone-400 text-xs w-4">R</label>
                <input
                  type="number"
                  value={destR}
                  onChange={e => setDestR(e.target.value)}
                  min={0}
                  max={14}
                  className="w-16 bg-stone-800 border border-stone-600 rounded px-2 py-1 text-stone-200 text-xs focus:outline-none focus:border-amber-600"
                />
              </div>
              {isSettlementDest && (
                <span className="text-rose-400 text-xs">Cannot target settlement hex</span>
              )}
              {destValid && !isSettlementDest && (
                <span className="text-stone-500 text-xs">≈{suggestedFood} food suggested</span>
              )}
            </div>
          </section>

          {/* ── Leader ──────────────────────────────────────────────── */}
          <section>
            <p className="text-stone-500 uppercase tracking-wide text-[10px] mb-2">
              Leader <span className="text-rose-400">*</span>
            </p>
            {leader ? (
              <div className="flex items-center gap-2">
                <PersonChip person={leader} selected toggle={() => setLeaderId(null)} label="Leader" />
                <span className="text-stone-500 text-xs italic">click to deselect</span>
              </div>
            ) : (
              <p className="text-stone-500 text-xs italic mb-2">Select a leader from the roster below.</p>
            )}
          </section>

          {/* ── Party members ───────────────────────────────────────── */}
          <section>
            <p className="text-stone-500 uppercase tracking-wide text-[10px] mb-2">
              Party ({memberIds.length}/9 members)
            </p>
            <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
              {available.length === 0 && (
                <p className="text-stone-600 text-xs italic">No settlers available</p>
              )}
              {available.map(p => {
                const isLeader = p.id === leaderId;
                const isMember = memberIds.includes(p.id);
                const full = memberIds.length >= 9 && !isMember && !isLeader;
                return (
                  <PersonChip
                    key={p.id}
                    person={p}
                    selected={isLeader || isMember}
                    disabled={full}
                    label={isLeader ? 'Leader' : undefined}
                    toggle={() => {
                      if (isLeader) return;
                      if (!leaderId) {
                        selectLeader(p.id);
                      } else {
                        toggleMember(p.id);
                      }
                    }}
                  />
                );
              })}
            </div>
            <p className="text-stone-600 text-[10px] mt-1">
              First click assigns Leader. Subsequent clicks add/remove party members.&nbsp;
              Current roles: {available.map(p => ROLE_LABELS[p.role] ?? p.role).join(', ').slice(0, 80)}{available.length > 8 ? '…' : ''}
            </p>
          </section>

          {/* ── Boat ────────────────────────────────────────────────── */}
          {boatsInPort > 0 && (
            <section>
              <p className="text-stone-500 uppercase tracking-wide text-[10px] mb-2">
                Transport ({boatsInPort} boat{boatsInPort !== 1 ? 's' : ''} in port)
              </p>
              <button
                onClick={() => setUseBoat(b => !b)}
                className={`flex items-center gap-2 px-3 py-2 rounded border text-xs transition-colors ${
                  useBoat
                    ? 'bg-blue-800/40 border-blue-600 text-blue-200'
                    : 'bg-stone-800/60 border-stone-700 text-stone-400 hover:border-stone-500'
                }`}
              >
                <span>{useBoat ? '⛵' : '🚶'}</span>
                <span>{useBoat ? 'Taking boat — faster river/coast travel' : 'On foot — no boat'}</span>
              </button>
            </section>
          )}

          {/* ── Custom name ─────────────────────────────────────────── */}
          <section>
            <p className="text-stone-500 uppercase tracking-wide text-[10px] mb-2">
              Expedition Name <span className="text-stone-600">(optional)</span>
            </p>
            <input
              type="text"
              value={customName}
              onChange={e => setCustomName(e.target.value)}
              maxLength={48}
              placeholder="Auto-generated if blank"
              className="w-full bg-stone-800 border border-stone-600 rounded px-3 py-1.5 text-stone-200 text-xs placeholder-stone-600 focus:outline-none focus:border-amber-600"
            />
          </section>

          {/* ── Provisions ──────────────────────────────────────────── */}
          <section>
            <div className="flex items-baseline justify-between mb-2">
              <p className="text-stone-500 uppercase tracking-wide text-[10px]">Food Provisions</p>
              <p className="text-stone-400 text-xs">
                Available: <span className="text-amber-300">{Math.floor(gameState.settlement.resources.food)}</span>
              </p>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={Math.min(maxFood, Math.floor(gameState.settlement.resources.food))}
                value={food}
                onChange={e => setFood(Number(e.target.value))}
                className="flex-1 accent-amber-500"
              />
              <span className="text-amber-300 text-sm w-8 text-right">{food}</span>
            </div>
            {destValid && suggestedFood > 0 && (
              <div className="flex gap-2 mt-1.5">
                <button
                  onClick={() => setFood(Math.min(suggestedFood, Math.floor(gameState.settlement.resources.food)))}
                  className="text-[10px] text-amber-600 hover:text-amber-400"
                >
                  Use suggested ({suggestedFood})
                </button>
                {food < suggestedFood && (
                  <span className="text-[10px] text-rose-400">⚠ Below recommendation</span>
                )}
              </div>
            )}
          </section>

          {/* ── Summary ─────────────────────────────────────────────── */}
          {leaderId && destValid && !isSettlementDest && (
            <section className="bg-stone-800/50 border border-stone-700 rounded p-3 text-xs text-stone-300 space-y-1">
              <div className="flex justify-between">
                <span className="text-stone-500">Party size</span>
                <span>{partySize} person{partySize !== 1 ? 's' : ''}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Transport</span>
                <span>{useBoat ? 'Boat' : 'Foot'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Destination</span>
                <span>({parsedQ}, {parsedR})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Suggested food</span>
                <span className={food < suggestedFood ? 'text-rose-300' : 'text-emerald-300'}>
                  {suggestedFood} (packed: {food})
                </span>
              </div>
            </section>
          )}

        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-stone-700 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm text-stone-400 hover:text-stone-200"
          >
            Cancel
          </button>
          <button
            onClick={handleDispatch}
            disabled={!canDispatch}
            className={`px-5 py-1.5 rounded text-sm font-semibold transition-colors ${
              canDispatch
                ? 'bg-amber-700 hover:bg-amber-600 text-amber-100'
                : 'bg-stone-700 text-stone-500 cursor-not-allowed'
            }`}
          >
            Dispatch
          </button>
        </div>

      </div>
    </div>
  );
}
