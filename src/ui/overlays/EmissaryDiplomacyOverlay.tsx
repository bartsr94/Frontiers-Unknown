/**
 * EmissaryDiplomacyOverlay — the live diplomacy session UI.
 *
 * Opens during management phase when an emissary has arrived at a tribe
 * (status: 'at_tribe'). Player can:
 *   - Offer gifts (sub-panel with sliders)
 *   - Ask for food / wealth (one confirmation per type per session)
 *   - Propose a trade relationship (disposition-gated)
 *   - Take their leave (concludes the session)
 *
 * On "Take Your Leave" all accumulated actions are sent to
 * resolveEmissarySession in the store.
 */

import { useState } from 'react';
import { useGameStore } from '../../stores/game-store';
import type { EmissarySessionAction } from '../../simulation/turn/game-state';
import { giftDispositionGain, computeResourceRequestYield } from '../../simulation/world/emissaries';
import DispositionBar from '../components/DispositionBar';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function clampI(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

// ─── Sub-panel: Offer Gifts ───────────────────────────────────────────────────

interface GiftPanelProps {
  maxWealth: number;
  maxFood: number;
  tribe: { disposition: number; tradeDesires: string[]; traits: string[]; giftedTurns: number | null };
  currentTurn: number;
  onCancel: () => void;
  onConfirm: (wealth: number, food: number, delta: number) => void;
}

function GiftPanel({ maxWealth, maxFood, tribe, currentTurn, onCancel, onConfirm }: GiftPanelProps) {
  const [wealth, setWealth] = useState(0);
  const [food,   setFood]   = useState(0);

  const estimated = giftDispositionGain(wealth, food, tribe as any, currentTurn);
  const giftedThisYear = tribe.giftedTurns !== null && (currentTurn - tribe.giftedTurns) < 4;

  return (
    <div className="border border-stone-600 rounded p-3 bg-stone-800/50 space-y-3">
      <p className="text-amber-200 text-xs font-semibold">Offer Gifts</p>

      <div className="space-y-2">
        {maxWealth > 0 && (
          <div className="space-y-0.5">
            <div className="flex justify-between text-[11px] text-stone-400">
              <span>Wealth</span>
              <span className="text-stone-200">{wealth} / {maxWealth}</span>
            </div>
            <input type="range" min={0} max={maxWealth} value={wealth}
              onChange={e => setWealth(Number(e.target.value))}
              className="w-full accent-amber-500" />
          </div>
        )}
        {maxFood > 0 && (
          <div className="space-y-0.5">
            <div className="flex justify-between text-[11px] text-stone-400">
              <span>Food</span>
              <span className="text-stone-200">{food} / {maxFood}</span>
            </div>
            <input type="range" min={0} max={maxFood} value={food}
              onChange={e => setFood(Number(e.target.value))}
              className="w-full accent-amber-500" />
          </div>
        )}
      </div>

      {(wealth > 0 || food > 0) ? (
        <div className="space-y-0.5">
          <p className="text-stone-300 text-[11px]">
            Estimated effect: <span className="text-emerald-400 font-semibold">+{estimated} disposition</span>
          </p>
          {giftedThisYear && (
            <p className="text-amber-500 text-[10px]">Diminishing returns — gifted recently (×0.5)</p>
          )}
          {tribe.tradeDesires.some(d => (d === 'wealth' && wealth > 0) || (d === 'food' && food > 0)) && (
            <p className="text-sky-400 text-[10px]">Tribe desires this resource — bonus applied</p>
          )}
        </div>
      ) : (
        <p className="text-stone-600 text-[11px] italic">Adjust sliders to offer gifts.</p>
      )}

      <div className="flex gap-2 pt-1">
        <button onClick={onCancel}
          className="flex-1 px-2 py-1.5 rounded bg-stone-700 hover:bg-stone-600 text-stone-300 text-xs">
          Cancel
        </button>
        <button
          onClick={() => onConfirm(wealth, food, estimated)}
          disabled={wealth === 0 && food === 0}
          className={`flex-1 px-2 py-1.5 rounded text-xs font-semibold transition-colors ${
            (wealth > 0 || food > 0)
              ? 'bg-amber-700 hover:bg-amber-600 text-amber-100'
              : 'bg-stone-800 text-stone-600 cursor-not-allowed'
          }`}
        >
          Present Gifts
        </button>
      </div>
    </div>
  );
}

// ─── Main overlay ─────────────────────────────────────────────────────────────

interface Props {
  emissaryId: string;
  onClose: () => void;
}

type SubPanel = 'none' | 'offer_gifts' | 'confirm_food' | 'confirm_goods' | 'confirm_trade' | 'confirm_leave';

export default function EmissaryDiplomacyOverlay({ emissaryId, onClose }: Props) {
  const gameState             = useGameStore(s => s.gameState);
  const resolveAction         = useGameStore(s => s.resolveEmissarySession);

  const [sessionActions, setSessionActions] = useState<EmissarySessionAction[]>([]);
  const [sessionLog, setSessionLog]         = useState<string[]>([
    'Your emissary has arrived and been received by the clan elders.',
  ]);
  // Live disposition delta applied by actions taken so far this session.
  const [pendingDispositionDelta, setPendingDispositionDelta] = useState(0);
  // Track which one-use-per-session actions have been taken.
  const [askedFood, setAskedFood]   = useState(false);
  const [askedGoods, setAskedGoods] = useState(false);
  const [proposedTrade, setProposedTrade] = useState(false);

  const [subPanel, setSubPanel] = useState<SubPanel>('none');

  if (!gameState) return null;

  const emissary = (gameState.emissaries ?? []).find(e => e.id === emissaryId);
  if (!emissary) return null;

  const tribe       = gameState.tribes.get(emissary.tribeId);
  const emissaryPerson = gameState.people.get(emissary.emissaryId);
  if (!tribe) return null;

  const bargaining = emissaryPerson?.skills?.bargaining ?? 0;
  const liveDisposition = clampI(tribe.disposition + pendingDispositionDelta, -100, 100);

  const gifts = emissary.giftsRemaining;
  // Deduct already-offered gifts from the local session action list.
  const offeredSoFar = sessionActions
    .filter(a => a.type === 'offer_gifts')
    .reduce((acc, a) => ({
      wealth: acc.wealth + (a.giftsOffered?.wealth ?? 0),
      food:   acc.food   + (a.giftsOffered?.food   ?? 0),
    }), { wealth: 0, food: 0 });
  const remainingGifts = {
    wealth: Math.max(0, gifts.wealth - offeredSoFar.wealth),
    food:   Math.max(0, gifts.food   - offeredSoFar.food),
  };
  const hasGiftsLeft = remainingGifts.wealth > 0 || remainingGifts.food > 0;

  // Compute current turn-level giftedTurns (may have been updated by earlier actions this session).
  const sessionGiftedTurns = sessionActions.some(a => a.type === 'offer_gifts')
    ? gameState.turnNumber
    : tribe.giftedTurns;
  const tribeWithSessionUpdates = { ...tribe, giftedTurns: sessionGiftedTurns, disposition: liveDisposition };

  const foodYield    = computeResourceRequestYield('food',   tribeWithSessionUpdates);
  const wealthYield  = computeResourceRequestYield('wealth', tribeWithSessionUpdates);

  const canAskFood   = !askedFood   && liveDisposition >= 0 && !tribe.tradeDesires.includes('food');
  const canAskWealth = !askedGoods  && liveDisposition >= 0 && !tribe.tradeDesires.includes('wealth');
  const tradeThreshold = tribe.traits.includes('trader') ? 5 : 20;
  const canProposeTrade = !proposedTrade && !tribe.diplomacyOpened && liveDisposition >= tradeThreshold;

  function addAction(action: EmissarySessionAction, logLine: string) {
    setSessionActions(prev => [...prev, action]);
    setSessionLog(prev => [...prev, logLine]);
  }

  function handleGiftsConfirmed(wealth: number, food: number, delta: number) {
    const action: EmissarySessionAction = {
      type: 'offer_gifts',
      giftsOffered: { wealth, food },
      dispositionDelta: delta,
      logEntry: `Offered ${[wealth > 0 && `${wealth} wealth`, food > 0 && `${food} food`].filter(Boolean).join(', ')} — disposition +${delta}.`,
    };
    addAction(action, action.logEntry);
    setPendingDispositionDelta(d => clampI(d + delta, -100 - (tribe?.disposition ?? 0), 100 - (tribe?.disposition ?? 0)));
    setSubPanel('none');
  }

  function handleAskFood() {
    const amount = foodYield;
    const action: EmissarySessionAction = {
      type: 'ask_food',
      resourcesReceived: { food: amount },
      dispositionDelta: 0,
      logEntry: `Requested food — the clan provided ${amount} food.`,
    };
    addAction(action, action.logEntry);
    setAskedFood(true);
    setSubPanel('none');
  }

  function handleAskWealth() {
    const amount = wealthYield;
    const action: EmissarySessionAction = {
      type: 'ask_goods',
      resourcesReceived: { wealth: amount },
      dispositionDelta: 0,
      logEntry: `Requested wealth — the clan provided ${amount} wealth.`,
    };
    addAction(action, action.logEntry);
    setAskedGoods(true);
    setSubPanel('none');
  }

  function handleProposeTrade() {
    const action: EmissarySessionAction = {
      type: 'propose_trade',
      dispositionDelta: 0,
      logEntry: 'The elders agreed to formalise trade with your settlement. Goods may now pass.',
    };
    addAction(action, action.logEntry);
    setProposedTrade(true);
    setSubPanel('none');
  }

  function handleTakeLeave() {
    // Append take_leave action and resolve the session.
    const leaveAction: EmissarySessionAction = {
      type: 'take_leave',
      dispositionDelta: 0,
      logEntry: `${emissaryPerson?.firstName ?? 'Your emissary'} bid the elders farewell and departed for home.`,
    };
    const allActions = [...sessionActions, leaveAction];
    resolveAction(emissaryId, allActions);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
      onClick={e => { if (e.target === e.currentTarget) { /* block accidental close */ } }}
    >
      <div className="bg-stone-900 border border-stone-600 rounded-lg shadow-2xl w-[560px] max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-700 shrink-0">
          <h2 className="text-amber-200 font-semibold text-sm">
            Diplomatic Audience — {tribe.name}
          </h2>
          <button
            onClick={() => setSubPanel('confirm_leave')}
            className="text-stone-500 hover:text-stone-300 leading-none text-base"
            title="End session (take your leave)"
          >✕</button>
        </div>

        {/* Body: two-column layout */}
        <div className="flex flex-1 overflow-hidden min-h-0">

          {/* Left column: emissary info + session log */}
          <div className="flex flex-col w-56 shrink-0 border-r border-stone-700 overflow-y-auto">

            {/* Emissary info */}
            <div className="px-3 py-3 border-b border-stone-700 space-y-1">
              <p className="text-stone-400 uppercase text-[10px] tracking-wide">Emissary</p>
              <p className="text-stone-200 text-xs font-medium">
                {emissaryPerson?.firstName ?? '—'} {emissaryPerson?.familyName ?? ''}
              </p>
              <p className="text-sky-400 text-[11px]">Bargaining {bargaining}</p>
            </div>

            {/* Gifts on hand */}
            <div className="px-3 py-2 border-b border-stone-700 space-y-0.5">
              <p className="text-stone-400 uppercase text-[10px] tracking-wide">Gifts on hand</p>
              {remainingGifts.wealth > 0 && <p className="text-amber-300 text-[11px]">◈ {remainingGifts.wealth} wealth</p>}
              {remainingGifts.food   > 0 && <p className="text-emerald-400 text-[11px]">◈ {remainingGifts.food} food</p>}
              {!hasGiftsLeft && <p className="text-stone-600 text-[11px] italic">No gifts remaining</p>}
            </div>

            {/* Session log */}
            <div className="px-3 py-2 space-y-1 flex-1">
              <p className="text-stone-400 uppercase text-[10px] tracking-wide">Session Log</p>
              <div className="space-y-1.5">
                {sessionLog.map((line, i) => (
                  <p key={i} className="text-stone-300 text-[11px] leading-snug">
                    · {line}
                  </p>
                ))}
              </div>
            </div>

          </div>

          {/* Right column: tribe info + actions */}
          <div className="flex flex-col flex-1 overflow-y-auto">

            {/* Tribe overview */}
            <div className="px-3 py-3 border-b border-stone-700 space-y-1">
              <p className="text-amber-200 text-xs font-semibold">{tribe.name}</p>
              <p className="text-stone-400 text-[11px]">Pop ~{tribe.population}</p>
              {tribe.traits.length > 0 && (
                <p className="text-stone-400 text-[11px]">
                  {tribe.traits.map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(' · ')}
                </p>
              )}
              {tribe.desires.length > 0 && (
                <p className="text-stone-500 text-[11px]">Wants: {tribe.desires.join(', ')}</p>
              )}
            </div>

            {/* Live disposition */}
            <div className="px-3 py-2 border-b border-stone-700 space-y-1">
              <div className="flex justify-between items-center">
                <p className="text-stone-400 uppercase text-[10px] tracking-wide">Disposition</p>
                <span className="text-[11px] text-stone-300 font-semibold">
                  {tribe.disposition}
                  {pendingDispositionDelta !== 0 && (
                    <span className={`ml-1 ${pendingDispositionDelta > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      → {liveDisposition}
                    </span>
                  )}
                </span>
              </div>
              <DispositionBar value={liveDisposition} />
            </div>

            {/* Gift sub-panel or actions */}
            <div className="px-3 py-3 space-y-2 flex-1">

              {subPanel === 'offer_gifts' && (
                <GiftPanel
                  maxWealth={remainingGifts.wealth}
                  maxFood={remainingGifts.food}
                  tribe={tribeWithSessionUpdates}
                  currentTurn={gameState.turnNumber}
                  onCancel={() => setSubPanel('none')}
                  onConfirm={handleGiftsConfirmed}
                />
              )}

              {subPanel === 'confirm_food' && (
                <div className="border border-stone-600 rounded p-3 bg-stone-800/50 space-y-2">
                  <p className="text-stone-200 text-xs">Request a supply of food from the {tribe.name}?</p>
                  <p className="text-stone-400 text-[11px]">
                    Disposition {liveDisposition} · Expected yield: ~{foodYield} food
                  </p>
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => setSubPanel('none')}
                      className="flex-1 px-2 py-1.5 rounded bg-stone-700 hover:bg-stone-600 text-stone-300 text-xs">Cancel</button>
                    <button onClick={handleAskFood}
                      className="flex-1 px-2 py-1.5 rounded bg-emerald-800 hover:bg-emerald-700 text-emerald-100 text-xs font-semibold">
                      Ask politely ▶
                    </button>
                  </div>
                </div>
              )}

              {subPanel === 'confirm_goods' && (
                <div className="border border-stone-600 rounded p-3 bg-stone-800/50 space-y-2">
                  <p className="text-stone-200 text-xs">Request wealth from the {tribe.name}?</p>
                  <p className="text-stone-400 text-[11px]">
                    Disposition {liveDisposition} · Expected yield: ~{wealthYield} wealth
                  </p>
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => setSubPanel('none')}
                      className="flex-1 px-2 py-1.5 rounded bg-stone-700 hover:bg-stone-600 text-stone-300 text-xs">Cancel</button>
                    <button onClick={handleAskWealth}
                      className="flex-1 px-2 py-1.5 rounded bg-emerald-800 hover:bg-emerald-700 text-emerald-100 text-xs font-semibold">
                      Ask politely ▶
                    </button>
                  </div>
                </div>
              )}

              {subPanel === 'confirm_trade' && (
                <div className="border border-stone-600 rounded p-3 bg-stone-800/50 space-y-2">
                  <p className="text-stone-200 text-xs">Propose a formal trade relationship with the {tribe.name}?</p>
                  <p className="text-stone-400 text-[11px]">
                    Disposition {liveDisposition} — {tribe.traits.includes('trader') ? 'Traders welcome alliances' : 'Requires disposition ≥20'}
                  </p>
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => setSubPanel('none')}
                      className="flex-1 px-2 py-1.5 rounded bg-stone-700 hover:bg-stone-600 text-stone-300 text-xs">Cancel</button>
                    <button onClick={handleProposeTrade}
                      className="flex-1 px-2 py-1.5 rounded bg-sky-800 hover:bg-sky-700 text-sky-100 text-xs font-semibold">
                      Propose ▶
                    </button>
                  </div>
                </div>
              )}

              {subPanel === 'confirm_leave' && (
                <div className="border border-stone-600 rounded p-3 bg-stone-800/50 space-y-2">
                  <p className="text-stone-200 text-xs">Conclude the session and send your emissary home?</p>
                  <p className="text-stone-500 text-[11px]">
                    Any unused gifts will be returned to your stockpile when they arrive home.
                  </p>
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => setSubPanel('none')}
                      className="flex-1 px-2 py-1.5 rounded bg-stone-700 hover:bg-stone-600 text-stone-300 text-xs">Stay</button>
                    <button onClick={handleTakeLeave}
                      className="flex-1 px-2 py-1.5 rounded bg-amber-800 hover:bg-amber-700 text-amber-100 text-xs font-semibold">
                      Take Your Leave
                    </button>
                  </div>
                </div>
              )}

              {subPanel === 'none' && (
                <>
                  <p className="text-stone-400 uppercase text-[10px] tracking-wide pt-1">Actions</p>

                  <button
                    onClick={() => setSubPanel('offer_gifts')}
                    disabled={!hasGiftsLeft}
                    title={hasGiftsLeft ? 'Present gifts to improve relations' : 'No gifts remaining'}
                    className={`w-full text-left px-3 py-2 rounded border text-xs transition-colors ${
                      hasGiftsLeft
                        ? 'border-stone-600 hover:border-amber-500 bg-stone-800/40 hover:bg-stone-700/40 text-stone-200'
                        : 'border-stone-700 bg-stone-900/40 text-stone-600 cursor-not-allowed'
                    }`}
                  >
                    ◈ Offer Gifts
                  </button>

                  <button
                    onClick={() => setSubPanel('confirm_food')}
                    disabled={!canAskFood}
                    title={
                      askedFood ? 'Already requested this session'
                      : liveDisposition < 0 ? 'Disposition too low (hostile)'
                      : tribe.tradeDesires.includes('food') ? 'This clan needs food — they will not give it away'
                      : 'Ask the clan for a food grant'
                    }
                    className={`w-full text-left px-3 py-2 rounded border text-xs transition-colors ${
                      canAskFood
                        ? 'border-stone-600 hover:border-emerald-500 bg-stone-800/40 hover:bg-stone-700/40 text-stone-200'
                        : 'border-stone-700 bg-stone-900/40 text-stone-600 cursor-not-allowed'
                    }`}
                  >
                    ◈ Ask for Food
                    {foodYield > 0 && canAskFood && (
                      <span className="ml-1.5 text-emerald-400 text-[10px]">~{foodYield}</span>
                    )}
                  </button>

                  <button
                    onClick={() => setSubPanel('confirm_goods')}
                    disabled={!canAskWealth}
                    title={
                      askedGoods ? 'Already requested this session'
                      : liveDisposition < 0 ? 'Disposition too low (hostile)'
                      : tribe.tradeDesires.includes('wealth') ? 'This clan needs wealth — they will not give it away'
                      : 'Ask the clan for a wealth grant'
                    }
                    className={`w-full text-left px-3 py-2 rounded border text-xs transition-colors ${
                      canAskWealth
                        ? 'border-stone-600 hover:border-emerald-500 bg-stone-800/40 hover:bg-stone-700/40 text-stone-200'
                        : 'border-stone-700 bg-stone-900/40 text-stone-600 cursor-not-allowed'
                    }`}
                  >
                    ◈ Ask for Wealth
                    {wealthYield > 0 && canAskWealth && (
                      <span className="ml-1.5 text-emerald-400 text-[10px]">~{wealthYield}</span>
                    )}
                  </button>

                  <button
                    onClick={() => setSubPanel('confirm_trade')}
                    disabled={!canProposeTrade}
                    title={
                      tribe.diplomacyOpened || proposedTrade ? 'Trade already open'
                      : liveDisposition < tradeThreshold ? `Disposition too low (need ≥${tradeThreshold})`
                      : 'Propose a formal trade relationship'
                    }
                    className={`w-full text-left px-3 py-2 rounded border text-xs transition-colors ${
                      canProposeTrade
                        ? 'border-stone-600 hover:border-sky-500 bg-stone-800/40 hover:bg-stone-700/40 text-stone-200'
                        : 'border-stone-700 bg-stone-900/40 text-stone-600 cursor-not-allowed'
                    }`}
                  >
                    {tribe.diplomacyOpened || proposedTrade ? '✓ Trade Open' : '◈ Propose Trade'}
                  </button>

                  <div className="border-t border-stone-700 pt-2 mt-1">
                    <button
                      onClick={() => setSubPanel('confirm_leave')}
                      className="w-full text-left px-3 py-2 rounded border border-stone-600 hover:border-stone-500 bg-stone-800/40 hover:bg-stone-700/40 text-stone-300 text-xs transition-colors"
                    >
                      ↩ Take Your Leave
                    </button>
                  </div>
                </>
              )}

            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
