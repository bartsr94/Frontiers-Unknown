/**
 * DiplomacyView — Known Clans list + Ashmark map.
 *
 * Layout:
 *   Left (w-48): Scrollable alphabetical list of contacted tribes.
 *   Right (flex-1): Ashmark map image; tribe info card overlays when a clan is selected.
 *
 * Phase 1: read-only. Action buttons (Emissary, Gift, Alliance) are rendered
 * disabled — their backends will be wired in Phase 2.
 */

import { useState, useRef, useEffect } from 'react';
import { useGameStore } from '../../stores/game-store';
import type { ExternalTribe, TribeTrait, TribeDesire, TribeOffering, Expedition } from '../../simulation/turn/game-state';
import type { Person } from '../../simulation/population/person';
import type {} from '../../simulation/population/person';
import DispositionBar from '../components/DispositionBar';
import HexGrid from '../components/HexGrid';
import ExpeditionDispatchOverlay from '../overlays/ExpeditionDispatchOverlay';
import EmissaryDispatchOverlay from '../overlays/EmissaryDispatchOverlay';
import EmissaryDiplomacyOverlay from '../overlays/EmissaryDiplomacyOverlay';

// ─── Display Metadata ─────────────────────────────────────────────────────────

const ETHNIC_META: Record<string, { badge: string; bg: string; label: string }> = {
  kiswani_riverfolk:   { badge: 'KIS-R', bg: 'bg-teal-600',   label: 'Kiswani Riverfolk'    },
  kiswani_bayuk:       { badge: 'KIS-B', bg: 'bg-teal-800',   label: 'Kiswani Bayuk'        },
  kiswani_haisla:      { badge: 'KIS-H', bg: 'bg-teal-700',   label: 'Kiswani Haisla'       },
  hanjoda_stormcaller: { badge: 'HAN-S', bg: 'bg-indigo-600', label: 'Hanjoda Stormcaller'  },
  hanjoda_bloodmoon:   { badge: 'HAN-B', bg: 'bg-rose-700',   label: 'Hanjoda Bloodmoon'    },
  hanjoda_talon:       { badge: 'HAN-T', bg: 'bg-amber-700',  label: 'Hanjoda Talon'        },
  hanjoda_emrasi:      { badge: 'HAN-E', bg: 'bg-purple-700', label: 'Hanjoda Emrasi'       },
  imanian:             { badge: 'IMA',   bg: 'bg-blue-700',   label: 'Imanian'              },
};

const FALLBACK_META = { badge: '???', bg: 'bg-stone-600', label: 'Unknown' };

const TRAIT_LABEL: Record<TribeTrait, string> = {
  warlike:      'Warlike',
  peaceful:     'Peaceful',
  isolationist: 'Isolationist',
  trader:       'Traders',
  expansionist: 'Expansionist',
  desperate:    'Desperate',
};

const TRAIT_COLOR: Record<TribeTrait, string> = {
  warlike:      'bg-rose-900 text-rose-300',
  peaceful:     'bg-emerald-900 text-emerald-300',
  isolationist: 'bg-stone-700 text-stone-300',
  trader:       'bg-emerald-900 text-emerald-300',
  expansionist: 'bg-rose-900 text-rose-300',
  desperate:    'bg-rose-900 text-rose-300',
};

const DESIRE_LABEL: Record<TribeDesire, string> = {
  steel:     'Steel',
  medicine:  'Medicine',
  alliance:  'Alliance',
  men:       'Fighters',
  territory: 'Territory',
  trade:     'Trade access',
  food:      'Food',
  wealth:    'Wealth',
  lumber:    'Lumber',
};

const OFFERING_LABEL: Record<TribeOffering, string> = {
  food:        'Food',
  horses:      'Horses',
  furs:        'Furs',
  herbs:       'Herbs',
  warriors:    'Warriors',
  wives:       'Wives',
  knowledge:   'Knowledge',
  pearls:      'Pearls',
  trade_goods: 'Trade goods',
  stone:       'Stone',
  steel:       'Steel',
};

// ─── Tribe List Row ───────────────────────────────────────────────────────────

interface RowProps {
  tribe: ExternalTribe;
  isSelected: boolean;
  onClick: () => void;
}

function TribeListRow({ tribe, isSelected, onClick }: RowProps) {
  const meta = ETHNIC_META[tribe.ethnicGroup] ?? FALLBACK_META;
  if (!tribe.contactEstablished && tribe.sighted) {
    return (
      <button
        onClick={onClick}
        className={`w-full text-left px-2 py-2 border-l-2 transition-colors opacity-60 ${
          isSelected
            ? 'bg-stone-700/80 border-stone-500'
            : 'border-transparent hover:bg-stone-800/60'
        }`}
      >
        <p className="text-stone-400 italic text-xs font-medium leading-tight">??? — Sighted</p>
        <div className="mt-1">
          <span className="text-[9px] px-1 py-0.5 rounded bg-stone-700 text-stone-400 font-semibold leading-none">
            SIGHTED
          </span>
        </div>
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-2 py-2 border-l-2 transition-colors ${
        isSelected
          ? 'bg-stone-700/80 border-amber-500'
          : 'border-transparent hover:bg-stone-800/60'
      }`}
    >
      <p className="text-stone-200 text-xs font-medium leading-tight truncate">{tribe.name}</p>
      <div className="mt-1 mb-1.5">
        <span className={`text-[9px] font-bold px-1 py-0.5 rounded text-white leading-none ${meta.bg}`}>
          {meta.badge}
        </span>
      </div>
      <DispositionBar value={tribe.disposition} />
    </button>
  );
}

// ─── Tribe Info Card ──────────────────────────────────────────────────────────

interface CardProps {
  tribe: ExternalTribe;
  onClose: () => void;
  canSendEmissary: boolean;
  canSendEmissaryTitle: string;
  currentPhase: string;
  onSendEmissary: (missionType?: 'gift_giving' | 'open_relations') => void;
}

function TribeInfoCard({ tribe, onClose, canSendEmissary, canSendEmissaryTitle, currentPhase, onSendEmissary }: CardProps) {
  const meta        = ETHNIC_META[tribe.ethnicGroup] ?? FALLBACK_META;
  const stabilityPct = Math.round(tribe.stability * 100);
  const stabLabel   = stabilityPct >= 80 ? 'Stable' : stabilityPct >= 50 ? 'Uncertain' : 'Fragile';
  const stabColor   = stabilityPct >= 80 ? 'bg-emerald-500' : stabilityPct >= 50 ? 'bg-amber-500' : 'bg-red-600';

  return (
    <div className="absolute top-3 left-3 w-56 bg-stone-900/95 border border-stone-600 rounded shadow-2xl overflow-hidden flex flex-col max-h-[calc(100%-24px)]">

      {/* Header */}
      <div className="flex items-start justify-between px-3 pt-3 pb-2 border-b border-stone-700 shrink-0">
        <div className="min-w-0 pr-2">
          <h3 className="text-amber-200 font-semibold text-sm leading-tight">{tribe.name}</h3>
          <p className="text-stone-400 text-[11px] mt-0.5">{meta.label} · Pop ~{tribe.population}</p>
        </div>
        <button
          onClick={onClose}
          className="shrink-0 text-stone-500 hover:text-stone-300 leading-none text-base mt-0.5"
          aria-label="Close"
        >✕</button>
      </div>

      {/* Scrollable body */}
      <div className="overflow-y-auto divide-y divide-stone-700/50">

        {/* Disposition */}
        <div className="px-3 py-2 space-y-1">
          <p className="text-stone-500 uppercase tracking-wide text-[10px]">Disposition</p>
          <DispositionBar value={tribe.disposition} />
        </div>

        {/* Stability */}
        <div className="px-3 py-2 space-y-1">
          <p className="text-stone-500 uppercase tracking-wide text-[10px]">Stability</p>
          <div className="space-y-0.5">
            <div className="flex justify-between text-xs text-stone-400">
              <span>{stabLabel}</span>
              <span>{stabilityPct}%</span>
            </div>
            <div className="w-full h-1.5 bg-stone-700 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${stabColor}`} style={{ width: `${stabilityPct}%` }} />
            </div>
          </div>
        </div>

        {/* Traits */}
        {tribe.traits.length > 0 && (
          <div className="px-3 py-2 space-y-1.5">
            <p className="text-stone-500 uppercase tracking-wide text-[10px]">Character</p>
            <div className="flex flex-wrap gap-1">
              {tribe.traits.map(t => (
                <span
                  key={t}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium leading-none ${TRAIT_COLOR[t]}`}
                >
                  {TRAIT_LABEL[t]}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Wants / Offers */}
        <div className="px-3 py-2">
          <div className="grid grid-cols-2 gap-x-3">
            <div>
              <p className="text-stone-500 uppercase tracking-wide text-[10px] mb-1">Wants</p>
              {tribe.desires.map(d => (
                <p key={d} className="text-stone-300 text-[11px] leading-snug">{DESIRE_LABEL[d]}</p>
              ))}
            </div>
            <div>
              <p className="text-stone-500 uppercase tracking-wide text-[10px] mb-1">Offers</p>
              {tribe.offerings.map(o => (
                <p key={o} className="text-stone-300 text-[11px] leading-snug">{OFFERING_LABEL[o]}</p>
              ))}
            </div>
          </div>
        </div>

        {/* Trade history */}
        <div className="px-3 py-2">
          <p className="text-stone-400 text-[11px]">
            Trades: {tribe.tradeHistoryCount > 0 ? tribe.tradeHistoryCount : 'None yet'}
          </p>
          {tribe.lastTradeTurn !== null && (
            <p className="text-stone-500 text-[11px]">Last exchange: turn {tribe.lastTradeTurn}</p>
          )}
        </div>

        {/* Sighted-only card: minimal info */}
        {!tribe.contactEstablished && tribe.sighted && (
          <div className="px-3 py-2">
            <p className="text-stone-400 text-xs italic leading-snug">
              Location noted. Send an emissary to make contact.
            </p>
          </div>
        )}

        {/* Actions */}
        {tribe.contactEstablished && (
          <div className="px-3 py-2 space-y-1.5">
            <button
              onClick={() => onSendEmissary()}
              disabled={!canSendEmissary}
              title={canSendEmissaryTitle}
              className={`w-full text-left px-2 py-1.5 rounded text-xs flex items-center justify-between transition-colors ${
                canSendEmissary
                  ? 'bg-amber-800 hover:bg-amber-700 text-amber-100'
                  : 'bg-stone-800 text-stone-600 cursor-not-allowed'
              }`}
            >
              <span>Send Emissary</span>
              <span className="text-[10px] opacity-70">▶</span>
            </button>
            <button
              onClick={() => onSendEmissary('gift_giving')}
              disabled={currentPhase !== 'management'}
              title={currentPhase !== 'management' ? 'Only during management phase' : 'Send gifts via emissary'}
              className={`w-full text-left px-2 py-1.5 rounded text-xs flex items-center justify-between transition-colors ${
                currentPhase === 'management'
                  ? 'bg-stone-700 hover:bg-stone-600 text-stone-200'
                  : 'bg-stone-800 text-stone-600 cursor-not-allowed'
              }`}
            >
              <span>Offer Gift</span>
              <span className="text-[10px] opacity-70">▶</span>
            </button>
            <button
              onClick={() => onSendEmissary('open_relations')}
              disabled={tribe.diplomacyOpened || tribe.disposition < 20 || currentPhase !== 'management'}
              title={
                tribe.diplomacyOpened ? 'Trade already open'
                : tribe.disposition < 20 ? 'Disposition too low (need ≥20)'
                : 'Propose a trade relationship'
              }
              className={`w-full text-left px-2 py-1.5 rounded text-xs flex items-center justify-between transition-colors ${
                !tribe.diplomacyOpened && tribe.disposition >= 20 && currentPhase === 'management'
                  ? 'bg-stone-700 hover:bg-stone-600 text-stone-200'
                  : 'bg-stone-800 text-stone-600 cursor-not-allowed'
              }`}
            >
              <span>{tribe.diplomacyOpened ? 'Trade Open ✓' : 'Seek Alliance'}</span>
              <span className="text-[10px] opacity-70">▶</span>
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

// ─── Expedition Status Panel ──────────────────────────────────────────────────

interface ExpeditionPanelProps {
  expedition: Expedition;
  people: Map<string, Person>;
  currentTurn: number;
  canRecall: boolean;
  onClose: () => void;
  onRecall: () => void;
}

function ExpeditionStatusPanel({ expedition, people, currentTurn, canRecall, onClose, onRecall }: ExpeditionPanelProps) {
  const leader  = people.get(expedition.leaderId);
  const members = expedition.memberIds
    .filter(id => id !== expedition.leaderId)
    .map(id => people.get(id))
    .filter((p): p is Person => p !== undefined);

  const statusLabel: Record<string, string> = {
    travelling: 'En Route',
    returning:  'Returning',
    completed:  'Completed',
    lost:       'Lost',
  };
  const statusColor: Record<string, string> = {
    travelling: 'text-amber-400',
    returning:  'text-sky-400',
    completed:  'text-emerald-400',
    lost:       'text-red-400',
  };

  const turnsOut     = currentTurn - expedition.dispatchedTurn;
  const hexesVisited = expedition.visitedHexes.length;
  const recentJournal = [...expedition.journal].reverse().slice(0, 5);
  const canIssueRecall = canRecall && expedition.status === 'travelling';

  function ResourceBar({ current, initial }: { current: number; initial: number }) {
    const pct   = initial > 0 ? Math.round((current / initial) * 100) : 0;
    const color = pct > 50 ? 'bg-emerald-500' : pct > 25 ? 'bg-amber-500' : 'bg-red-600';
    return (
      <div className="flex items-center gap-1.5">
        <div className="w-14 h-1.5 bg-stone-700 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
        </div>
        <span className="text-[11px] text-stone-300">{current} / {initial}</span>
      </div>
    );
  }

  return (
    <div className="absolute top-3 right-3 w-56 bg-stone-900/95 border border-stone-600 rounded shadow-2xl overflow-hidden flex flex-col max-h-[calc(100%-24px)]">

      {/* Header */}
      <div className="flex items-start justify-between px-3 pt-3 pb-2 border-b border-stone-700 shrink-0">
        <div className="min-w-0 pr-2">
          <h3 className="text-amber-200 font-semibold text-sm leading-tight truncate">{expedition.name}</h3>
          <p className={`text-[11px] mt-0.5 ${statusColor[expedition.status] ?? 'text-stone-400'}`}>
            {statusLabel[expedition.status]} · {turnsOut}t · {hexesVisited} hex{hexesVisited !== 1 ? 'es' : ''}
          </p>
        </div>
        <button
          onClick={onClose}
          className="shrink-0 text-stone-500 hover:text-stone-300 leading-none text-base mt-0.5"
          aria-label="Close"
        >✕</button>
      </div>

      {/* Scrollable body */}
      <div className="overflow-y-auto divide-y divide-stone-700/50">

        {/* Leader & Party */}
        <div className="px-3 py-2 space-y-1">
          <p className="text-stone-500 uppercase tracking-wide text-[10px]">Leader</p>
          <p className="text-stone-200 text-xs">{leader?.name ?? '—'}</p>
          {members.length > 0 && (
            <>
              <p className="text-stone-500 uppercase tracking-wide text-[10px] pt-1">Party</p>
              <p className="text-stone-300 text-[11px] leading-snug">
                {members.map(m => m.firstName || '?').join(', ')}
              </p>
            </>
          )}
          {expedition.hasBoat && (
            <p className="text-sky-400 text-[11px] pt-0.5">⚓ By Boat</p>
          )}
        </div>

        {/* Position */}
        <div className="px-3 py-2 space-y-1">
          <p className="text-stone-500 uppercase tracking-wide text-[10px]">Position</p>
          <p className="text-stone-300 text-[11px]">Q{expedition.currentQ}, R{expedition.currentR}</p>
          <p className="text-stone-500 text-[11px]">→ Dest Q{expedition.destinationQ}, R{expedition.destinationR}</p>
        </div>

        {/* Supplies */}
        <div className="px-3 py-2 space-y-1.5">
          <p className="text-stone-500 uppercase tracking-wide text-[10px]">Supplies</p>
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-stone-400 text-[11px] w-16">Food</span>
              <ResourceBar current={expedition.foodRemaining} initial={expedition.provisions.food} />
            </div>
            {expedition.provisions.medicine > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-stone-400 text-[11px] w-16">Medicine</span>
                <ResourceBar current={expedition.medicineRemaining} initial={expedition.provisions.medicine} />
              </div>
            )}
            {expedition.provisions.goods > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-stone-400 text-[11px] w-16">Goods</span>
                <ResourceBar current={expedition.goodsRemaining} initial={expedition.provisions.goods} />
              </div>
            )}
            {expedition.provisions.gold > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-stone-400 text-[11px] w-16">Gold</span>
                <ResourceBar current={expedition.goldRemaining} initial={expedition.provisions.gold} />
              </div>
            )}
          </div>
        </div>

        {/* Journal */}
        {recentJournal.length > 0 && (
          <div className="px-3 py-2 space-y-1">
            <p className="text-stone-500 uppercase tracking-wide text-[10px]">Journal</p>
            <div className="space-y-1.5">
              {recentJournal.map((entry, i) => (
                <div key={i}>
                  <span className="text-stone-600 text-[10px]">T{entry.turn} </span>
                  <span className="text-stone-300 text-[11px] leading-snug">{entry.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recall */}
        <div className="px-3 py-2">
          <button
            onClick={onRecall}
            disabled={!canIssueRecall}
            title={
              !canRecall ? 'Only available during management phase'
              : expedition.status !== 'travelling' ? 'Already returning or resolved'
              : 'Order the expedition to turn back'
            }
            className={`w-full px-2 py-1.5 rounded text-xs font-semibold transition-colors ${
              canIssueRecall
                ? 'bg-sky-800 hover:bg-sky-700 text-sky-100'
                : 'bg-stone-800 text-stone-600 cursor-not-allowed'
            }`}
          >
            ↩ Recall Expedition
          </button>
        </div>

      </div>
    </div>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

export default function DiplomacyView() {
  const gameState        = useGameStore(s => s.gameState);
  const currentPhase     = useGameStore(s => s.currentPhase);
  const recallExpedition = useGameStore(s => s.recallExpedition);
  const [selectedId, setSelectedId]                       = useState<string | null>(null);
  const [selectedExpeditionId, setSelectedExpeditionId]   = useState<string | null>(null);
  const [showDispatch, setShowDispatch]                   = useState(false);
  const [showEmissaryDispatch, setShowEmissaryDispatch]   = useState(false);
  const [emissaryDispatchTribeId, setEmissaryDispatchTribeId] = useState<string | undefined>(undefined);
  const [emissaryDispatchMission, setEmissaryDispatchMission] = useState<'gift_giving' | 'open_relations' | undefined>(undefined);
  const [showDiplomacySession, setShowDiplomacySession]   = useState(false);
  const [activeSessionEmissaryId, setActiveSessionEmissaryId] = useState<string | null>(null);
  const [dispatchTargetQ, setDispatchTargetQ] = useState<number | undefined>(undefined);
  const [dispatchTargetR, setDispatchTargetR] = useState<number | undefined>(undefined);
  const containerWidthRef  = useRef(0);
  const containerHeightRef = useRef(0);
  const [imgNaturalW, setImgNaturalW] = useState(0);
  const [imgNaturalH, setImgNaturalH] = useState(0);

  // ── Map viewport state ────────────────────────────────────────────────
  // Single transform: translate(tx, ty) scale(s), origin top-left of container.
  // At scale=1 the image fills the container (object-cover).
  // tx/ty are pixel offsets from that baseline position.
  const [tx, setTx]       = useState(0);
  const [ty, setTy]       = useState(0);
  const [scale, setScale] = useState(1);
  const [dragging, setDragging] = useState(false);

  // Mutable refs — always current, safe to read in the non-passive wheel handler
  const txRef    = useRef(0);
  const tyRef    = useRef(0);
  const scaleRef = useRef(1);
  txRef.current    = tx;
  tyRef.current    = ty;
  scaleRef.current = scale;

  // Drag tracking ref — never needs to trigger a re-render
  const drag = useRef({ startX: 0, startY: 0, startTx: 0, startTy: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  // minScaleRef is set dynamically on image load to the fit-to-contain scale.
  const minScaleRef = useRef(0.3);
  const MAX_SCALE = 8;

  // ── Drag handlers ─────────────────────────────────────────────────────
  function onMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    setDragging(true);
    drag.current = { startX: e.clientX, startY: e.clientY, startTx: tx, startTy: ty };
  }

  function onMouseMove(e: React.MouseEvent) {
    if (!dragging) return;
    setTx(drag.current.startTx + (e.clientX - drag.current.startX));
    setTy(drag.current.startTy + (e.clientY - drag.current.startY));
  }

  function onMouseUp()    { setDragging(false); }
  function onMouseLeave() { setDragging(false); }

  // ── Non-passive wheel handler (prevents browser page scroll) ──────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function onWheel(e: WheelEvent) {
      e.preventDefault();

      const rect     = el!.getBoundingClientRect();
      // Cursor position relative to container top-left — same origin as transform
      const mouseX   = e.clientX - rect.left;
      const mouseY   = e.clientY - rect.top;

      const prevScale = scaleRef.current;
      const factor    = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const newScale  = Math.min(MAX_SCALE, Math.max(minScaleRef.current, prevScale * factor));

      // Keep the pixel under the cursor fixed:
      // newTx = mouseX - (mouseX - prevTx) * (newScale / prevScale)
      const ratio  = newScale / prevScale;
      const newTx  = mouseX - (mouseX - txRef.current)  * ratio;
      const newTy  = mouseY - (mouseY - tyRef.current)  * ratio;

      setScale(newScale);
      setTx(newTx);
      setTy(newTy);
    }

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []); // refs keep the closure fresh — no deps needed

  // ── Fit-to-contain image load handler ────────────────────────────────
  // Called once when the background map image finishes loading. Computes
  // the largest scale at which the full image fits inside the container,
  // then centres it — no cropping, full image visible at initial view.
  function handleMapImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const img  = e.currentTarget;
    const imgW = img.naturalWidth;
    const imgH = img.naturalHeight;
    const cw   = containerWidthRef.current  || 800;
    const ch   = containerHeightRef.current || 600;
    if (imgW <= 0 || imgH <= 0) return;

    setImgNaturalW(imgW);
    setImgNaturalH(imgH);

    const fitScale = Math.min(cw / imgW, ch / imgH);
    minScaleRef.current = fitScale;

    const initTx = (cw - imgW * fitScale) / 2;
    const initTy = (ch - imgH * fitScale) / 2;

    setScale(fitScale);   scaleRef.current = fitScale;
    setTx(initTx);        txRef.current    = initTx;
    setTy(initTy);        tyRef.current    = initTy;
  }
  // ─────────────────────────────────────────────────────────────────────

  if (!gameState) return null;

  const contacts = [...gameState.tribes.values()]
    .filter(t => t.contactEstablished || t.sighted)
    .sort((a, b) => {
      if (a.contactEstablished !== b.contactEstablished) return a.contactEstablished ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  const expeditions = gameState.expeditions ?? [];
  const boatsInPort = gameState.boatsInPort ?? 1;
  const canDispatch = currentPhase === 'management';

  const pendingDiplomacySessions = gameState.pendingDiplomacySessions ?? [];
  const emissaries = gameState.emissaries ?? [];

  function openEmissaryDispatch(tribeId: string, mission?: 'gift_giving' | 'open_relations') {
    setEmissaryDispatchTribeId(tribeId);
    setEmissaryDispatchMission(mission);
    setShowEmissaryDispatch(true);
    setSelectedId(null);
  }

  function openFirstPendingSession() {
    if (pendingDiplomacySessions.length === 0) return;
    setActiveSessionEmissaryId(pendingDiplomacySessions[0]);
    setShowDiplomacySession(true);
  }

  function getCanSendEmissary(tribe: ExternalTribe): [boolean, string] {
    if (!tribe.contactEstablished) return [false, 'Must establish contact first'];
    if (currentPhase !== 'management') return [false, 'Only during management phase'];
    const active = emissaries.find(
      e => e.tribeId === tribe.id && (e.status === 'travelling' || e.status === 'at_tribe'),
    );
    if (active) return [false, 'An emissary is already with this clan'];
    return [true, 'Send a diplomat to this clan'];
  }

  function handleHexClick(q: number, r: number) {
    setSelectedExpeditionId(null);
    setDispatchTargetQ(q);
    setDispatchTargetR(r);
    setShowDispatch(true);
  }

  function handleExpeditionClick(expeditionId: string) {
    setSelectedExpeditionId(prev => prev === expeditionId ? null : expeditionId);
  }

  const selectedTribe      = contacts.find(t => t.id === selectedId) ?? null;
  const selectedExpedition = expeditions.find(e => e.id === selectedExpeditionId) ?? null;

  function handleRowClick(id: string) {
    setSelectedId(prev => (prev === id ? null : id));
  }

  return (
    <div className="flex h-full bg-stone-900">

      {/* ── Left: Known Clans list ───────────────────────────────────────── */}
      <div className="w-48 shrink-0 flex flex-col border-r border-stone-700 bg-stone-950/40">

        <div className="px-3 py-2 border-b border-stone-700 shrink-0">
          <h2 className="text-amber-300 text-xs font-semibold uppercase tracking-wide">Known Clans</h2>
          {contacts.length > 0 && (
            <p className="text-stone-500 text-[11px] mt-0.5">{contacts.filter(t => t.contactEstablished).length} known</p>
          )}
          {pendingDiplomacySessions.length > 0 && (
            <button
              onClick={openFirstPendingSession}
              className="text-amber-400 text-[11px] mt-0.5 font-semibold animate-pulse text-left w-full hover:text-amber-300 transition-colors"
            >
              {pendingDiplomacySessions.length} session{pendingDiplomacySessions.length > 1 ? 's' : ''} awaiting you
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {contacts.length === 0 ? (
            <p className="px-3 py-5 text-stone-500 text-xs italic leading-relaxed">
              No clans yet known to you. Send word into the Ashmark.
            </p>
          ) : (
            contacts.map(tribe => (
              <TribeListRow
                key={tribe.id}
                tribe={tribe}
                isSelected={selectedId === tribe.id}
                onClick={() => handleRowClick(tribe.id)}
              />
            ))
          )}
        </div>

        {/* Buttons */}
        <div className="px-3 py-2 border-t border-stone-700 shrink-0 space-y-1.5">
          <button
            onClick={() => { setEmissaryDispatchTribeId(undefined); setEmissaryDispatchMission(undefined); setShowEmissaryDispatch(true); }}
            disabled={!canDispatch || contacts.filter(t => t.contactEstablished).length === 0}
            className={`w-full px-2 py-1.5 rounded text-xs font-semibold transition-colors ${
              canDispatch && contacts.some(t => t.contactEstablished)
                ? 'bg-amber-800 hover:bg-amber-700 text-amber-100'
                : 'bg-stone-800 text-stone-600 cursor-not-allowed'
            }`}
            title={canDispatch ? 'Send a diplomat to a known clan' : 'Only available during management phase'}
          >
            ✦ Send Emissary
          </button>
          <button
            onClick={() => { setDispatchTargetQ(undefined); setDispatchTargetR(undefined); setShowDispatch(true); }}
            disabled={!canDispatch}
            className={`w-full px-2 py-1.5 rounded text-xs font-semibold transition-colors ${
              canDispatch
                ? 'bg-amber-700 hover:bg-amber-600 text-amber-100'
                : 'bg-stone-800 text-stone-600 cursor-not-allowed'
            }`}
            title={canDispatch ? 'Dispatch an expedition into the Ashmark' : 'Only available during management phase'}
          >
            ⚑ Send Expedition
          </button>
          {expeditions.length > 0 && (
            <p className="text-stone-500 text-[10px] text-center">
              {expeditions.filter(e => e.status === 'travelling' || e.status === 'returning').length} expedition{expeditions.length !== 1 ? 's' : ''} out
            </p>
          )}
          <p className="text-stone-600 text-[10px] text-center">Boats in port: {boatsInPort}</p>
        </div>

      </div>

      {/* ── Right: Ashmark map viewport ──────────────────────────────────── */}
      <div
        ref={el => {
          (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
          if (el) {
            containerWidthRef.current  = el.clientWidth;
            containerHeightRef.current = el.clientHeight;
          }
        }}
        className="flex-1 relative overflow-hidden bg-stone-950"
        style={{ cursor: dragging ? 'grabbing' : 'grab' }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
      >
        {/*
          The image renders at its natural pixel dimensions (no objectFit cropping).
          handleMapImageLoad computes a fit-to-contain scale and centres it so the
          full map is visible on first load. transform-origin is top-left (0 0).
        */}
        <img
          src="/ui/ashmark.jpg"
          alt="The Ashmark"
          onLoad={handleMapImageLoad}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 'auto',
            height: 'auto',
            maxWidth: 'none',
            transformOrigin: '0 0',
            transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
            userSelect: 'none',
          }}
          draggable={false}
        />

        {/* Hex-map overlay — sits above the background image, same transform */}
        {gameState.hexMap && (
          <HexGrid
            hexMap={gameState.hexMap}
            expeditions={expeditions}
            containerWidth={containerWidthRef.current || 800}
            containerHeight={containerHeightRef.current || 600}
            imageWidth={imgNaturalW || containerWidthRef.current || 800}
            imageHeight={imgNaturalH || containerHeightRef.current || 600}
            tx={tx}
            ty={ty}
            scale={scale}
            onHexClick={canDispatch ? handleHexClick : undefined}
            onExpeditionClick={handleExpeditionClick}
          />
        )}

        {/* Info card — pinned to container corner, above the map */}
        {selectedTribe && (() => {
          const [canSend, canSendTitle] = getCanSendEmissary(selectedTribe);
          return (
            <TribeInfoCard
              tribe={selectedTribe}
              onClose={() => setSelectedId(null)}
              canSendEmissary={canSend}
              canSendEmissaryTitle={canSendTitle}
              currentPhase={currentPhase}
              onSendEmissary={(mission) => openEmissaryDispatch(selectedTribe.id, mission)}
            />
          );
        })()}

        {/* Expedition status panel — pinned top-right */}
        {selectedExpedition && (
          <ExpeditionStatusPanel
            expedition={selectedExpedition}
            people={gameState.people}
            currentTurn={gameState.turnNumber}
            canRecall={canDispatch}
            onClose={() => setSelectedExpeditionId(null)}
            onRecall={() => {
              recallExpedition(selectedExpedition.id);
              setSelectedExpeditionId(null);
            }}
          />
        )}
      </div>

      {/* Expedition dispatch overlay */}
      {showDispatch && (
        <ExpeditionDispatchOverlay
          initialDestQ={dispatchTargetQ}
          initialDestR={dispatchTargetR}
          onClose={() => setShowDispatch(false)}
        />
      )}

      {/* Emissary dispatch overlay */}
      {showEmissaryDispatch && (
        <EmissaryDispatchOverlay
          initialTribeId={emissaryDispatchTribeId}
          initialMission={emissaryDispatchMission}
          onClose={() => setShowEmissaryDispatch(false)}
        />
      )}

      {/* Emissary diplomacy session overlay */}
      {showDiplomacySession && activeSessionEmissaryId && (
        <EmissaryDiplomacyOverlay
          emissaryId={activeSessionEmissaryId}
          onClose={() => {
            setShowDiplomacySession(false);
            setActiveSessionEmissaryId(null);
            // Auto-open the next pending session if any remain.
            const remaining = (gameState.pendingDiplomacySessions ?? []).filter(
              id => id !== activeSessionEmissaryId,
            );
            if (remaining.length > 0) {
              setActiveSessionEmissaryId(remaining[0]);
              setShowDiplomacySession(true);
            }
          }}
        />
      )}

    </div>
  );
}
