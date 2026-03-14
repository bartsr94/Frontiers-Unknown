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
import type { ExternalTribe, TribeTrait, TribeDesire, TribeOffering } from '../../simulation/turn/game-state';
import DispositionBar from '../components/DispositionBar';

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
  gold:      'Gold',
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
}

function TribeInfoCard({ tribe, onClose }: CardProps) {
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

        {/* Actions — disabled Phase 1 */}
        <div className="px-3 py-2 space-y-1.5">
          {(['Send Emissary', 'Offer Gift', 'Seek Alliance'] as const).map(label => (
            <button
              key={label}
              disabled
              title="Requires the Emissary system — coming soon"
              className="w-full text-left px-2 py-1.5 rounded bg-stone-800 text-stone-600 text-xs cursor-not-allowed flex items-center justify-between"
            >
              <span>{label}</span>
              <span className="text-[10px] text-stone-700">▶</span>
            </button>
          ))}
        </div>

      </div>
    </div>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

export default function DiplomacyView() {
  const gameState   = useGameStore(s => s.gameState);
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
  const MIN_SCALE = 0.8;
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
      const newScale  = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prevScale * factor));

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
  // ─────────────────────────────────────────────────────────────────────

  if (!gameState) return null;

  const contacts = [...gameState.tribes.values()]
    .filter(t => t.contactEstablished)
    .sort((a, b) => a.name.localeCompare(b.name));

  const selectedTribe = contacts.find(t => t.id === selectedId) ?? null;

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
            <p className="text-stone-500 text-[11px] mt-0.5">{contacts.length} known</p>
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

      </div>

      {/* ── Right: Ashmark map viewport ──────────────────────────────────── */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden bg-stone-950"
        style={{ cursor: dragging ? 'grabbing' : 'grab' }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
      >
        {/*
          The image sits at top:0 left:0, sized to cover the container at scale=1.
          transform-origin is top-left (0 0) so tx/ty are plain pixel offsets
          from the container corner — no centering math needed.
        */}
        <img
          src="/ui/ashmark.jpg"
          alt="The Ashmark"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transformOrigin: '0 0',
            transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
            userSelect: 'none',
          }}
          draggable={false}
        />

        {/* Info card — pinned to container corner, above the map */}
        {selectedTribe && (
          <TribeInfoCard
            tribe={selectedTribe}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>

    </div>
  );
}
