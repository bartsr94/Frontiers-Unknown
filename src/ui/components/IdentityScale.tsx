/**
 * IdentityScale — Cultural Identity Pressure widget.
 *
 * Renders a five-zone horizontal bar showing the settlement's cultural blend
 * (0.0 = Ansberite, 1.0 = fully native) with a tick mark at the current value,
 * zone labels, and pressure counter badges when the blend is outside the safe zone.
 *
 * Designed to be mounted inside the Religion sidebar of SettlementView.
 */

import React from 'react';
import type { IdentityPressure } from '../../simulation/turn/game-state';
import { IDENTITY_THRESHOLDS } from '../../simulation/culture/identity-pressure';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  culturalBlend: number;
  identityPressure: IdentityPressure;
}

// ─── Zone helpers ─────────────────────────────────────────────────────────────

type Zone = 'extreme_imanian' | 'soft_imanian' | 'safe' | 'soft_native' | 'extreme_native';

function getZone(blend: number): Zone {
  const { EXTREME_IMANIAN, SOFT_IMANIAN, SAFE_ZONE_HIGH, EXTREME_NATIVE } = IDENTITY_THRESHOLDS;
  if (blend < EXTREME_IMANIAN) return 'extreme_imanian';
  if (blend < SOFT_IMANIAN)    return 'soft_imanian';
  if (blend <= SAFE_ZONE_HIGH) return 'safe';
  if (blend <= EXTREME_NATIVE) return 'soft_native';
  return 'extreme_native';
}

// Zone widths in percentage across the 0–1 scale.
// extreme_imanian: 0–10  (10%)
// soft_imanian:    10–25 (15%)
// safe:            25–65 (40%)
// soft_native:     65–80 (15%)
// extreme_native:  80–100 (20%)
const ZONE_SEGMENTS = [
  { key: 'extreme_imanian', width: 10,  color: 'bg-red-800' },
  { key: 'soft_imanian',    width: 15,  color: 'bg-orange-700' },
  { key: 'safe',            width: 40,  color: 'bg-emerald-800' },
  { key: 'soft_native',     width: 15,  color: 'bg-orange-700' },
  { key: 'extreme_native',  width: 20,  color: 'bg-red-800' },
] as const;

// ─── Component ────────────────────────────────────────────────────────────────

export function IdentityScale({ culturalBlend, identityPressure }: Props) {
  const blend   = Math.max(0, Math.min(1, culturalBlend));
  const tickPct = blend * 100;
  const zone    = getZone(blend);

  const inNativeZone   = zone === 'soft_native' || zone === 'extreme_native';
  const inImanianZone  = zone === 'soft_imanian' || zone === 'extreme_imanian';

  return (
    <div className="space-y-2">

      {/* Section header */}
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
        Cultural Identity
      </p>

      {/* Five-zone colour bar with tick */}
      <div>
        {/* End labels */}
        <div className="flex justify-between text-xs text-slate-500 mb-1">
          <span>Ansberite</span>
          <span>Native</span>
        </div>

        {/* Bar container */}
        <div className="relative h-3 flex rounded overflow-hidden">
          {ZONE_SEGMENTS.map(seg => (
            <div
              key={seg.key}
              className={`h-full ${seg.color}`}
              style={{ width: `${seg.width}%` }}
            />
          ))}

          {/* Tick mark — positioned at blend × 100% */}
          <div
            className="absolute top-0 h-full w-0.5 bg-white opacity-90 pointer-events-none"
            style={{ left: `${tickPct}%` }}
          />
        </div>

        {/* Blend percentage label */}
        <div className="flex justify-end mt-0.5">
          <span className="text-xs text-slate-500">{Math.round(blend * 100)}% native</span>
        </div>
      </div>

      {/* Company pressure badge — shown when in native zone */}
      {inNativeZone && identityPressure.companyPressureTurns > 0 && (
        <div className="flex items-center gap-1.5 text-xs px-2 py-1 bg-amber-950/60 border border-amber-800/60 rounded">
          <span className="text-amber-400">⚑</span>
          <span className="text-amber-300">
            Company concern
          </span>
          <span className="ml-auto text-amber-500 font-semibold tabular-nums">
            {identityPressure.companyPressureTurns}s
          </span>
        </div>
      )}

      {/* Tribal pressure badge — shown when in Imanian zone */}
      {inImanianZone && identityPressure.tribalPressureTurns > 0 && (
        <div className="flex items-center gap-1.5 text-xs px-2 py-1 bg-stone-800/80 border border-stone-600/60 rounded">
          <span className="text-stone-400">⚐</span>
          <span className="text-stone-300">
            Tribes restless
          </span>
          <span className="ml-auto text-stone-400 font-semibold tabular-nums">
            {identityPressure.tribalPressureTurns}s
          </span>
        </div>
      )}

      {/* Safe zone note when no pressure */}
      {!inNativeZone && !inImanianZone && (
        <p className="text-xs text-slate-600 italic">No cultural pressure</p>
      )}

    </div>
  );
}
