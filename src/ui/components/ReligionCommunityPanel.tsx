/**
 * ReligionCommunityPanel — extracted religion, identity, and courtship UI panels.
 *
 * Used in CommunityView (and previously in SettlementView).
 * Contains: IdentityScale, ReligionPanel, CourtshipPanel, CourtshipNudgeBanner.
 */

import { useGameStore } from '../../stores/game-store';
import { computeReligiousTension } from '../../simulation/population/culture';
import { IdentityScale } from './IdentityScale';
import type { ReligiousPolicy, CourtshipNorms } from '../../simulation/turn/game-state';

// ─── Constants ────────────────────────────────────────────────────────────────

const POLICY_LABELS: Record<ReligiousPolicy, string> = {
  tolerant:                'Tolerant',
  orthodox_enforced:       'Orthodox Enforced',
  wheel_permitted:         'Wheel Permitted',
  hidden_wheel_recognized: 'Hidden Wheel Recognized',
};

const COURTSHIP_LABELS: Record<CourtshipNorms, string> = {
  traditional: 'Traditional (Imanian)',
  mixed:       'Mixed (Settled)',
  open:        'Open (Sauromatian)',
};

const COURTSHIP_DESCRIPTIONS: Record<CourtshipNorms, string> = {
  traditional: 'Marriages arranged by family elders. Courtship by women is frowned upon.',
  mixed:       'Family approval expected, but individuals may show interest openly.',
  open:        'Women may pursue directly. Matches follow Sauromatian custom.',
};

const FAITH_LABELS: Record<string, string> = {
  imanian_orthodox:       'Solar Church',
  sacred_wheel:           'Sacred Wheel',
  syncretic_hidden_wheel: 'Hidden Wheel',
};

const FAITH_COLORS: Record<string, string> = {
  imanian_orthodox:       'bg-yellow-500',
  sacred_wheel:           'bg-teal-500',
  syncretic_hidden_wheel: 'bg-indigo-500',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

export function CourtshipPanel({ disabled }: { disabled: boolean }) {
  const gameState         = useGameStore(s => s.gameState);
  const setCourtshipNorms = useGameStore(s => s.setCourtshipNorms);

  if (!gameState) return null;

  const norms = gameState.settlement.courtshipNorms ?? 'mixed';

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Courtship Custom</p>
      <select
        disabled={disabled}
        value={norms}
        onChange={e => setCourtshipNorms(e.target.value as CourtshipNorms)}
        className="w-full text-xs bg-stone-800 border border-stone-600 text-slate-300 rounded px-2 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {(['traditional', 'mixed', 'open'] as CourtshipNorms[]).map(n => (
          <option key={n} value={n}>{COURTSHIP_LABELS[n]}</option>
        ))}
      </select>
      <p className="text-xs text-slate-500">{COURTSHIP_DESCRIPTIONS[norms]}</p>
    </div>
  );
}

export function CourtshipNudgeBanner() {
  const pending           = useGameStore(s => s.pendingCourtshipNudge);
  const setCourtshipNorms = useGameStore(s => s.setCourtshipNorms);
  const dismissNudge      = useGameStore(s => s.dismissCourtshipNudge);

  if (!pending) return null;

  return (
    <div className="mt-2 p-2 bg-indigo-950/70 border border-indigo-700 rounded text-xs text-indigo-200 space-y-2">
      <p>
        <span className="font-semibold">Sauromatian custom:</span> Recognising the Hidden Wheel
        sits uneasily with strict Imanian courtship norms. Consider shifting to Mixed custom.
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => { setCourtshipNorms('mixed'); dismissNudge(); }}
          className="flex-1 px-2 py-1 bg-indigo-700 hover:bg-indigo-600 rounded text-white"
        >
          Shift to Mixed
        </button>
        <button
          onClick={dismissNudge}
          className="flex-1 px-2 py-1 bg-stone-700 hover:bg-stone-600 rounded text-slate-300"
        >
          Keep Traditional
        </button>
      </div>
    </div>
  );
}

export function ReligionPanel({ disabled }: { disabled: boolean }) {
  const gameState          = useGameStore(s => s.gameState);
  const setReligiousPolicy = useGameStore(s => s.setReligiousPolicy);

  if (!gameState) return null;

  const { culture, settlement } = gameState;
  const tension    = computeReligiousTension(culture.religions);
  const tensionPct = Math.round(tension * 100);
  const tensionColor =
    tension >= 0.75 ? 'bg-red-500'
  : tension >= 0.50 ? 'bg-orange-500'
  : tension >= 0.25 ? 'bg-yellow-500'
  : 'bg-emerald-600';

  const policyOptions: ReligiousPolicy[] = [
    'tolerant',
    'orthodox_enforced',
    'wheel_permitted',
    ...(culture.hiddenWheelEmerged ? ['hidden_wheel_recognized' as ReligiousPolicy] : []),
  ];

  return (
    <div className="space-y-3">

      {/* Faith distribution */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Faiths</p>
        {Array.from(culture.religions.entries())
          .sort(([, a], [, b]) => b - a)
          .map(([id, fraction]) => {
            const pct = Math.round(fraction * 100);
            if (pct === 0) return null;
            return (
              <div key={id} className="mb-1.5">
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="text-slate-300">{FAITH_LABELS[id] ?? id}</span>
                  <span className="text-slate-500">{pct}%</span>
                </div>
                <div className="h-1.5 bg-stone-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${FAITH_COLORS[id] ?? 'bg-stone-500'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
      </div>

      {/* Tension */}
      <div>
        <div className="flex justify-between text-xs mb-0.5">
          <span className="text-slate-400">Religious Tension</span>
          <span className={tension >= 0.50 ? 'text-orange-400 font-semibold' : 'text-slate-500'}>
            {tensionPct}%
          </span>
        </div>
        <div className="h-1.5 bg-stone-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${tensionColor}`}
            style={{ width: `${tensionPct}%` }}
          />
        </div>
      </div>

      {/* Hidden Wheel divergence progress */}
      {!culture.hiddenWheelEmerged && culture.hiddenWheelDivergenceTurns > 0 && (
        <div>
          <div className="flex justify-between text-xs mb-0.5">
            <span className="text-indigo-400">Hidden Wheel stirring…</span>
            <span className="text-slate-500">{culture.hiddenWheelDivergenceTurns} / 20</span>
          </div>
          <div className="h-1 bg-stone-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-indigo-600"
              style={{ width: `${(culture.hiddenWheelDivergenceTurns / 20) * 100}%` }}
            />
          </div>
          {culture.hiddenWheelSuppressedTurns > 0 && (
            <p className="text-xs text-slate-500 mt-0.5">
              Suppressed ({culture.hiddenWheelSuppressedTurns} turns remaining)
            </p>
          )}
        </div>
      )}

      {/* Emerged badge */}
      {culture.hiddenWheelEmerged && (
        <div className="text-xs px-2 py-1 bg-indigo-950/60 border border-indigo-800 rounded text-indigo-300">
          ✦ The Hidden Wheel has emerged
        </div>
      )}

      {/* Policy selector */}
      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Policy</p>
        <select
          disabled={disabled}
          value={settlement.religiousPolicy}
          onChange={e => setReligiousPolicy(e.target.value as ReligiousPolicy)}
          className="w-full text-xs bg-stone-800 border border-stone-600 text-slate-300 rounded px-2 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {policyOptions.map(p => (
            <option key={p} value={p}>{POLICY_LABELS[p]}</option>
          ))}
        </select>
        {settlement.religiousPolicy === 'orthodox_enforced' && (
          <p className="text-xs text-slate-500 mt-1">Company drain: none. Wheel ceremonies blocked.</p>
        )}
        {settlement.religiousPolicy === 'hidden_wheel_recognized' && (
          <p className="text-xs text-indigo-400 mt-1">Company drain: doubled. Syncretic spread enabled.</p>
        )}
      </div>

    </div>
  );
}

// ─── Combined panel (IdentityScale + Religion + Courtship) ───────────────────

export default function ReligionCommunityPanel({ disabled }: { disabled: boolean }) {
  const gameState = useGameStore(s => s.gameState);
  if (!gameState) return null;

  return (
    <div className="space-y-4">
      <IdentityScale
        culturalBlend={gameState.culture.culturalBlend}
        identityPressure={gameState.identityPressure}
      />
      <div className="border-b border-stone-700" />
      <ReligionPanel disabled={disabled} />
      <div className="border-b border-stone-700" />
      <CourtshipPanel disabled={disabled} />
      <CourtshipNudgeBanner />
    </div>
  );
}
