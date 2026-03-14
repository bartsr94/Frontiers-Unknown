/**
 * TradeView — Trade & Commerce tab.
 *
 * Two-column layout:
 *   Left  (25%): Ansberry Company quota panel + tribe list
 *   Right (75%): Active tribe barter interface (or locked/empty state)
 */

import { useState } from 'react';
import { useGameStore } from '../../stores/game-store';
import { computeYearlyQuota } from '../../simulation/economy/company';
import { getTradeValue, validateTrade } from '../../simulation/economy/trade';
import { hasBuilding } from '../../simulation/buildings/building-effects';
import type { ResourceType, ExternalTribe } from '../../simulation/turn/game-state';
import type { TradeOffer } from '../../simulation/economy/trade';
import { ALL_RESOURCES } from '../shared/resource-display';
import DispositionBar from '../components/DispositionBar';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function QuotaBar({ contributed, required }: { contributed: number; required: number }) {
  if (required === 0) return <span className="text-stone-400 text-xs italic">Grace period — no quota this year</span>;
  const pct   = Math.min(100, required > 0 ? Math.round((contributed / required) * 100) : 0);
  const color = pct >= 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-600';
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-xs text-stone-400">
        <span>{contributed} / {required}</span>
        <span>{pct}%</span>
      </div>
      <div className="w-full h-1.5 bg-stone-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─── Company Quota Panel ───────────────────────────────────────────────────────

interface QuotaPanelProps {
  disabled: boolean;
}

function QuotaPanel({ disabled }: QuotaPanelProps) {
  const gameState        = useGameStore(s => s.gameState);
  const contributeToQuota = useGameStore(s => s.contributeToQuota);

  const [goldInput,  setGoldInput]  = useState(0);
  const [goodsInput, setGoodsInput] = useState(0);
  const [feedback,   setFeedback]   = useState<string | null>(null);

  if (!gameState) return null;

  const { company, currentYear, settlement } = gameState;
  const quota     = computeYearlyQuota(currentYear);
  const resources = settlement.resources;

  function handleContribute() {
    if (goldInput <= 0 && goodsInput <= 0) return;
    if (goldInput  > (resources.gold  ?? 0)) { setFeedback('Not enough gold.');  return; }
    if (goodsInput > (resources.goods ?? 0)) { setFeedback('Not enough goods.'); return; }
    contributeToQuota(goldInput, goodsInput);
    setGoldInput(0);
    setGoodsInput(0);
    setFeedback(`Contributed ${goldInput > 0 ? `${goldInput} gold` : ''}${goldInput > 0 && goodsInput > 0 ? ' and ' : ''}${goodsInput > 0 ? `${goodsInput} goods` : ''}.`);
  }

  const maxGold  = Math.max(0, (quota.gold  - company.quotaContributedGold));
  const maxGoods = Math.max(0, (quota.goods - company.quotaContributedGoods));

  return (
    <div className="p-3 border border-stone-700 rounded bg-stone-900/50 space-y-3">
      <h3 className="text-amber-300 text-xs font-semibold uppercase tracking-wide">Ansberry Co. Quota</h3>

      {quota.gold === 0 ? (
        <p className="text-stone-400 text-xs italic">Grace period — no quota required yet.</p>
      ) : (
        <>
          <div className="space-y-1.5">
            <div>
              <span className="text-stone-300 text-xs">💰 Gold</span>
              <QuotaBar contributed={company.quotaContributedGold}  required={quota.gold}  />
            </div>
            <div>
              <span className="text-stone-300 text-xs">📦 Goods</span>
              <QuotaBar contributed={company.quotaContributedGoods} required={quota.goods} />
            </div>
          </div>

          {!disabled && (maxGold > 0 || maxGoods > 0) && (
            <div className="space-y-2 pt-1 border-t border-stone-700">
              <p className="text-stone-400 text-xs">Contribute toward quota:</p>
              <div className="flex gap-2 items-center">
                <span className="text-xs text-stone-400 w-8">Gold</span>
                <input
                  type="number" min={0} max={Math.min(Math.floor(resources.gold ?? 0), maxGold)}
                  value={goldInput}
                  onChange={e => setGoldInput(Math.max(0, Math.min(
                    Math.min(Math.floor(resources.gold ?? 0), maxGold),
                    Number(e.target.value),
                  )))}
                  className="w-16 bg-stone-800 border border-stone-600 text-stone-200 text-xs rounded px-1.5 py-0.5 text-right"
                />
                <span className="text-stone-500 text-xs">/ {Math.floor(resources.gold ?? 0)} avail.</span>
              </div>
              <div className="flex gap-2 items-center">
                <span className="text-xs text-stone-400 w-8">Goods</span>
                <input
                  type="number" min={0} max={Math.min(Math.floor(resources.goods ?? 0), maxGoods)}
                  value={goodsInput}
                  onChange={e => setGoodsInput(Math.max(0, Math.min(
                    Math.min(Math.floor(resources.goods ?? 0), maxGoods),
                    Number(e.target.value),
                  )))}
                  className="w-16 bg-stone-800 border border-stone-600 text-stone-200 text-xs rounded px-1.5 py-0.5 text-right"
                />
                <span className="text-stone-500 text-xs">/ {Math.floor(resources.goods ?? 0)} avail.</span>
              </div>
              <button
                onClick={handleContribute}
                disabled={goldInput <= 0 && goodsInput <= 0}
                className="w-full py-1 text-xs rounded bg-amber-700 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-amber-100 font-medium"
              >
                Contribute
              </button>
              {feedback && <p className="text-emerald-400 text-xs">{feedback}</p>}
            </div>
          )}

          {(maxGold <= 0 && maxGoods <= 0) && (
            <p className="text-emerald-400 text-xs">✓ Quota met for this year.</p>
          )}
        </>
      )}

      <div className="pt-1 border-t border-stone-700">
        <span className="text-stone-500 text-xs">Standing: </span>
        <span className="text-amber-300 text-xs font-semibold">{company.standing}</span>
        <span className="text-stone-500 text-xs"> · </span>
        <span className="text-stone-400 text-xs capitalize">{company.supportLevel.replace('_', ' ')}</span>
      </div>
    </div>
  );
}

// ─── Tribe List ────────────────────────────────────────────────────────────────

interface TribeListProps {
  tribes: Map<string, ExternalTribe>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  currentTurn: number;
}

function TribeList({ tribes, selectedId, onSelect, currentTurn }: TribeListProps) {
  const knownTribes = [...tribes.values()].filter(t => t.contactEstablished);

  if (knownTribes.length === 0) {
    return (
      <div className="p-3 text-stone-500 text-xs italic">
        No tribes contacted yet. Explore the region to make first contact.
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {knownTribes.map(tribe => {
        const isSelected  = tribe.id === selectedId;
        const isDistrust  = tribe.disposition < 20;
        const lastTrade   = tribe.lastTradeTurn !== null
          ? (currentTurn - tribe.lastTradeTurn === 0 ? 'this turn' : `${currentTurn - tribe.lastTradeTurn} turns ago`)
          : 'never';

        return (
          <button
            key={tribe.id}
            onClick={() => onSelect(tribe.id)}
            disabled={isDistrust}
            className={[
              'w-full text-left px-3 py-2 rounded border text-xs transition-colors',
              isSelected
                ? 'border-amber-600 bg-amber-900/40 text-amber-100'
                : isDistrust
                  ? 'border-stone-700 bg-stone-800/30 text-stone-500 cursor-not-allowed'
                  : 'border-stone-700 bg-stone-800/30 text-stone-300 hover:border-amber-700 hover:bg-amber-900/20',
            ].join(' ')}
          >
            <div className="font-semibold truncate">{tribe.name}</div>
            <DispositionBar value={tribe.disposition} />
            {isDistrust
              ? <div className="text-red-400 text-xs mt-0.5">Distrustful — trade refused</div>
              : <div className="text-stone-500 text-xs mt-0.5">Last trade: {lastTrade}</div>
            }
          </button>
        );
      })}
    </div>
  );
}

// ─── Resource Stepper ─────────────────────────────────────────────────────────

interface ResourceStepperProps {
  res: { key: ResourceType; emoji: string; label: string };
  value: number;
  maxValue: number;
  onChange: (val: number) => void;
}

function ResourceStepper({ res, value, maxValue, onChange }: ResourceStepperProps) {
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <span className="text-sm">{res.emoji}</span>
      <span className="text-xs text-stone-300 flex-1">{res.label}</span>
      <button
        onClick={() => onChange(Math.max(0, value - 1))}
        disabled={value <= 0}
        className="w-5 h-5 flex items-center justify-center rounded bg-stone-700 hover:bg-stone-600 disabled:opacity-30 text-stone-300 text-xs leading-none"
      >−</button>
      <span className="text-xs text-stone-200 w-6 text-center">{value}</span>
      <button
        onClick={() => onChange(Math.min(maxValue, value + 1))}
        disabled={value >= maxValue}
        className="w-5 h-5 flex items-center justify-center rounded bg-stone-700 hover:bg-stone-600 disabled:opacity-30 text-stone-300 text-xs leading-none"
      >+</button>
      <span className="text-stone-500 text-xs w-10 text-right">{maxValue} max</span>
    </div>
  );
}

// ─── Fairness Meter ────────────────────────────────────────────────────────────

interface FairnessMeterProps {
  playerValue: number;
  tribeValue: number;
}

function FairnessMeter({ playerValue, tribeValue }: FairnessMeterProps) {
  const total = playerValue + tribeValue;
  if (total === 0) return null;

  const playerPct = Math.round((playerValue / total) * 100);
  const diff      = playerValue - tribeValue;
  const diffPct   = total > 0 ? Math.round((diff / total) * 100) : 0;

  const fairLabel = diffPct > 20
    ? '▲ Strongly favors you — they will resent this'
    : diffPct > 5
      ? 'Slightly favors you'
      : diffPct < -20
        ? '▼ Strongly favors the tribe'
        : diffPct < -5
          ? 'Slightly favors the tribe'
          : '≈ Roughly fair';

  const meterColor = diffPct > 20  ? 'bg-red-500'
                   : diffPct > 5   ? 'bg-yellow-500'
                   : diffPct < -5  ? 'bg-emerald-500'
                   : 'bg-amber-400';

  return (
    <div className="space-y-1">
      <div className="relative w-full h-3 bg-stone-700 rounded-full overflow-hidden">
        <div
          className={`absolute left-0 top-0 h-full rounded-full ${meterColor} transition-all`}
          style={{ width: `${playerPct}%` }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-full w-px bg-stone-300/50" style={{ marginLeft: '50%' }} />
        </div>
      </div>
      <div className="flex justify-between text-xs text-stone-400">
        <span>You offer: {playerValue.toFixed(1)} gv</span>
        <span className={diffPct > 20 ? 'text-red-400' : diffPct < -20 ? 'text-emerald-400' : 'text-stone-300'}>
          {fairLabel}
        </span>
        <span>You receive: {tribeValue.toFixed(1)} gv</span>
      </div>
    </div>
  );
}

// ─── Trade Panel ──────────────────────────────────────────────────────────────

interface TradePanelProps {
  tribe: ExternalTribe;
  disabled: boolean;
  currentTurn: number;
  resources: Record<ResourceType, number>;
}

function TradePanel({ tribe, disabled, currentTurn, resources }: TradePanelProps) {
  const executeTrade = useGameStore(s => s.executeTrade);

  const [offer,    setOffer]    = useState<Partial<Record<ResourceType, number>>>({});
  const [request,  setRequest]  = useState<Partial<Record<ResourceType, number>>>({});
  const [feedback, setFeedback] = useState<string | null>(null);

  const alreadyTraded   = tribe.lastTradeTurn === currentTurn;
  const tribeRefuses    = tribe.disposition < 20;

  function setOfferVal(res: ResourceType, val: number) {
    setOffer(prev => ({ ...prev, [res]: val }));
    setFeedback(null);
  }
  function setRequestVal(res: ResourceType, val: number) {
    setRequest(prev => ({ ...prev, [res]: val }));
    setFeedback(null);
  }

  const offerAsTradeOffer: TradeOffer   = Object.fromEntries(
    Object.entries(offer).filter(([, v]) => (v as number) > 0)
  ) as TradeOffer;
  const requestAsTradeOffer: TradeOffer = Object.fromEntries(
    Object.entries(request).filter(([, v]) => (v as number) > 0)
  ) as TradeOffer;

  const playerValue = getTradeValue(offerAsTradeOffer,   tribe, 'player');
  const tribeValue  = getTradeValue(requestAsTradeOffer, tribe, 'tribe');

  const offerTotal   = Object.values(offerAsTradeOffer).reduce((s, v) => s + (v ?? 0), 0);
  const requestTotal = Object.values(requestAsTradeOffer).reduce((s, v) => s + (v ?? 0), 0);
  const canPropose   = !disabled && !alreadyTraded && !tribeRefuses && offerTotal > 0 && requestTotal > 0;

  function handlePropose() {
    const validation = validateTrade(offerAsTradeOffer, requestAsTradeOffer, resources, tribe, currentTurn);
    if (!validation.ok) {
      setFeedback(`Trade refused: ${validation.reason}`);
      return;
    }
    executeTrade(tribe.id, offerAsTradeOffer, requestAsTradeOffer);
    const delta = tribeValue - playerValue;
    const sign  = delta >= 0 ? '+' : '';
    setFeedback(`Trade complete. ${tribe.name}: ${sign}${Math.round(delta > 0 ? (delta / (playerValue + tribeValue)) * 5 : (delta / (playerValue + tribeValue)) * 5 * -1 + 1)} disposition.`);
    setOffer({});
    setRequest({});
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-amber-200 font-semibold">{tribe.name}</h2>
        <DispositionBar value={tribe.disposition} />
      </div>

      {/* Desires / Offerings chips */}
      <div className="flex gap-6 text-xs">
        <div>
          <span className="text-stone-400 uppercase tracking-wide text-xs">They want: </span>
          {tribe.tradeDesires.length > 0
            ? tribe.tradeDesires.map(d => (
                <span key={d} className="inline-block mr-1 px-1.5 py-0.5 rounded bg-amber-900/60 text-amber-300">{d}</span>
              ))
            : <span className="text-stone-500 italic">anything</span>
          }
        </div>
        <div>
          <span className="text-stone-400 uppercase tracking-wide text-xs">They offer: </span>
          {tribe.tradeOfferings.length > 0
            ? tribe.tradeOfferings.map(o => (
                <span key={o} className="inline-block mr-1 px-1.5 py-0.5 rounded bg-blue-900/60 text-blue-300">{o}</span>
              ))
            : <span className="text-stone-500 italic">varies</span>
          }
        </div>
      </div>

      {alreadyTraded && (
        <div className="px-3 py-2 rounded border border-amber-700/50 bg-amber-900/20 text-amber-300 text-xs">
          You have already traded with this tribe this turn.
        </div>
      )}

      {/* Offer / Request columns */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h4 className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">You Offer</h4>
          {ALL_RESOURCES.map(res => (
            <ResourceStepper
              key={res.key}
              res={res}
              value={offer[res.key] ?? 0}
              maxValue={Math.floor(resources[res.key] ?? 0)}
              onChange={val => setOfferVal(res.key, val)}
            />
          ))}
        </div>
        <div>
          <h4 className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">You Request</h4>
          {ALL_RESOURCES.map(res => (
            <ResourceStepper
              key={res.key}
              res={res}
              value={request[res.key] ?? 0}
              maxValue={999}
              onChange={val => setRequestVal(res.key, val)}
            />
          ))}
        </div>
      </div>

      {/* Fairness meter */}
      {(offerTotal > 0 || requestTotal > 0) && (
        <FairnessMeter playerValue={playerValue} tribeValue={tribeValue} />
      )}

      {/* Propose Deal button */}
      <button
        onClick={handlePropose}
        disabled={!canPropose}
        className="w-full py-2 rounded bg-amber-700 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-amber-100 font-semibold text-sm"
      >
        Propose Deal
      </button>

      {feedback && (
        <p className="text-center text-xs text-emerald-400">{feedback}</p>
      )}
    </div>
  );
}

// ─── Main View ─────────────────────────────────────────────────────────────────

export default function TradeView() {
  const gameState    = useGameStore(s => s.gameState);
  const currentPhase = useGameStore(s => s.currentPhase);

  const [selectedTribeId, setSelectedTribeId] = useState<string | null>(null);

  if (!gameState) return null;

  const { tribes, settlement, turnNumber: currentTurn } = gameState;
  const resources      = settlement.resources;
  const hasTradingPost = hasBuilding(settlement.buildings, 'trading_post');
  const isManagement   = currentPhase === 'management';

  const selectedTribe = selectedTribeId ? tribes.get(selectedTribeId) ?? null : null;

  return (
    <div className="h-full flex overflow-hidden text-stone-200">

      {/* Left column — Company + Tribe List */}
      <div className="w-64 shrink-0 border-r border-stone-700 flex flex-col overflow-hidden">
        <div className="p-3 border-b border-stone-700">
          <h2 className="text-amber-300 font-bold text-sm">Trade & Commerce</h2>
          {!isManagement && (
            <p className="text-stone-500 text-xs mt-0.5">Available during Management phase</p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          <QuotaPanel disabled={!isManagement} />

          <div>
            <h3 className="text-amber-300 text-xs font-semibold uppercase tracking-wide mb-2">Tribes</h3>
            <TribeList
              tribes={tribes}
              selectedId={selectedTribeId}
              onSelect={setSelectedTribeId}
              currentTurn={currentTurn}
            />
          </div>
        </div>
      </div>

      {/* Right column — Trade interface */}
      <div className="flex-1 overflow-y-auto p-5">
        {!hasTradingPost ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-3 max-w-sm mx-auto">
            <div className="text-4xl">🏪</div>
            <h3 className="text-amber-300 font-semibold">No Trading Post</h3>
            <p className="text-stone-400 text-sm">
              Build a Trading Post to establish direct trade relationships with the tribes of the Ashmark.
            </p>
            <p className="text-stone-500 text-xs">
              You can still trade via events — merchants and traders pass through regardless.
            </p>
          </div>
        ) : selectedTribe === null ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-2 max-w-sm mx-auto">
            <div className="text-4xl">👥</div>
            <h3 className="text-amber-300 font-semibold">Select a Tribe</h3>
            <p className="text-stone-400 text-sm">
              Choose a tribe from the list to begin negotiating a trade.
            </p>
          </div>
        ) : (
          <TradePanel
            tribe={selectedTribe}
            disabled={!isManagement}
            currentTurn={currentTurn}
            resources={resources as Record<ResourceType, number>}
          />
        )}
      </div>
    </div>
  );
}
