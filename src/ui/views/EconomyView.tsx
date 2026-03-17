/**
 * EconomyView — the Economy tab (replaces ProductionView).
 *
 * Three sections:
 *  1. Resource Reserves — player sets per-resource floor; surplus shown live.
 *  2. Company Export  — sell goods to Company at 4:1 for gold.
 *  3. Crafting         — existing craft recipes (unchanged from ProductionView).
 *
 * Payroll status banner shown when lastPayrollShortfall is true.
 */

import { useState } from 'react';
import { useGameStore } from '../../stores/game-store';
import { getSurplus } from '../../simulation/economy/private-economy';
import { getAvailableCrafts, CRAFT_RECIPES, validateCraft } from '../../simulation/economy/crafting';
import type { CraftRecipeId } from '../../simulation/economy/crafting';
import type { ResourceType } from '../../simulation/turn/game-state';
import { RESOURCE_EMOJI } from '../shared/resource-display';

const ALL_RESOURCES: ResourceType[] = [
  'food', 'lumber', 'stone', 'goods', 'gold', 'cattle', 'medicine', 'steel', 'horses',
];

export default function EconomyView() {
  const gameState            = useGameStore(s => s.gameState);
  const currentPhase         = useGameStore(s => s.currentPhase);
  const setEconomyReserves   = useGameStore(s => s.setEconomyReserves);
  const exportGoodsToCompany = useGameStore(s => s.exportGoodsToCompany);
  const performCraft         = useGameStore(s => s.performCraft);
  const lastPayrollShortfall = useGameStore(s => s.gameState?.lastPayrollShortfall ?? false);

  // Local draft for reserve floors (committed on blur / Enter)
  const [reserveDraft, setReserveDraft] = useState<Partial<Record<ResourceType, string>>>({});
  const [exportAmount, setExportAmount] = useState(4);
  const [craftFeedback, setCraftFeedback] = useState<string | null>(null);

  if (!gameState) {
    return (
      <div className="flex-1 flex items-center justify-center text-stone-500 text-sm italic">
        No game in progress.
      </div>
    );
  }

  const canManage       = currentPhase === 'management' || currentPhase === 'idle';
  const { settlement }  = gameState;
  const resources       = settlement.resources;
  const savedReserves   = settlement.economyReserves ?? {};

  // Merge saved reserves with draft for surplus calculation
  const effectiveReserves: Partial<Record<ResourceType, number>> = { ...savedReserves };
  for (const [k, v] of Object.entries(reserveDraft)) {
    const parsed = parseInt(v as string, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      effectiveReserves[k as ResourceType] = parsed;
    }
  }

  const surplus = getSurplus(resources, effectiveReserves);

  const goods        = resources.goods;
  const maxExport    = Math.floor(goods / 4) * 4;
  const safeExport   = Math.min(exportAmount, maxExport);
  const goldPreview  = Math.floor(safeExport / 4);
  const standingBonusPreview = Math.floor(
    (gameState.company.exportedGoodsThisYear + safeExport) / 10,
  ) - Math.floor(gameState.company.exportedGoodsThisYear / 10);

  function commitReserves() {
    const next: Partial<Record<ResourceType, number>> = { ...savedReserves };
    for (const [k, v] of Object.entries(reserveDraft)) {
      const parsed = parseInt(v as string, 10);
      if (!isNaN(parsed) && parsed >= 0) next[k as ResourceType] = parsed;
    }
    setEconomyReserves(next);
    setReserveDraft({});
  }

  function handleReserveBlur(resource: ResourceType) {
    const val = reserveDraft[resource];
    if (val === undefined) return;
    const parsed = parseInt(val, 10);
    const next: Partial<Record<ResourceType, number>> = { ...savedReserves };
    if (!isNaN(parsed) && parsed >= 0) {
      next[resource] = parsed;
    } else {
      delete next[resource];
    }
    setEconomyReserves(next);
    setReserveDraft(prev => {
      const copy = { ...prev };
      delete copy[resource];
      return copy;
    });
  }

  function handleExport() {
    if (!canManage || safeExport < 4) return;
    exportGoodsToCompany(safeExport);
    setExportAmount(4);
  }

  function handleCraft(id: CraftRecipeId) {
    const check = validateCraft(id, settlement.buildings, resources);
    if (!check.ok) { setCraftFeedback(`Cannot craft: ${check.reason}`); return; }
    performCraft(id);
    const recipe = Object.values(CRAFT_RECIPES).find(r => r.id === id);
    setCraftFeedback(`Crafted: ${recipe?.label ?? id}`);
  }

  function fmtResources(res: Partial<Record<ResourceType, number>>) {
    return Object.entries(res)
      .filter(([, v]) => (v as number) > 0)
      .map(([k, v]) => `${RESOURCE_EMOJI[k as ResourceType] ?? ''}${v} ${k}`)
      .join(', ');
  }

  const available    = getAvailableCrafts(settlement.buildings, resources);
  const availableIds = new Set(available.map(r => r.id));

  // Non-zero surplus resources for the summary line
  const surplusEntries = ALL_RESOURCES.filter(r => (surplus[r] ?? 0) > 0);

  return (
    <div className="flex-1 flex flex-col overflow-y-auto p-4 gap-4">
      <h2 className="text-base font-semibold text-slate-300">Economy</h2>

      {/* ── Payroll shortfall banner ─────────────────────────────────────── */}
      {lastPayrollShortfall && (
        <div className="px-3 py-2 bg-red-950 border border-red-700 rounded text-xs text-red-300 flex items-center gap-2">
          <span className="text-base">⚠</span>
          <span>
            <strong>Payroll shortfall!</strong> The settlement could not cover full wages this season.
            Employed settlers received reduced pay and are demoralised (−5 purpose happiness).
          </span>
        </div>
      )}

      {/* Year 10 transition note */}
      {gameState.currentYear >= 9 && gameState.currentYear <= 10 && (
        <div className="px-3 py-2 bg-amber-950 border border-amber-700 rounded text-xs text-amber-300">
          {gameState.currentYear === 10
            ? 'Company funding ends this year. Export goods now to build your gold reserves.'
            : 'Company funding ends next year. Export goods now to prepare.'}
        </div>
      )}

      {/* ── Row: Reserves + Export ─────────────────────────────────────────── */}
      <div className="flex gap-4 flex-wrap">

        {/* RESOURCE RESERVES */}
        <section className="flex-1 min-w-48 bg-stone-900 border border-stone-700 rounded-xl p-3">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
            Resource Reserves
          </h3>
          <p className="text-xs text-stone-500 mb-3">
            Settlers may build using anything above these floors.
          </p>
          <div className="space-y-1.5">
            {ALL_RESOURCES.map(r => {
              const savedFloor  = savedReserves[r] ?? 0;
              const draftVal    = reserveDraft[r];
              const displayVal  = draftVal !== undefined ? draftVal : String(savedFloor);
              const stock       = resources[r] ?? 0;
              const surplusQty  = surplus[r] ?? 0;

              return (
                <div key={r} className="flex items-center gap-2">
                  <span className="w-16 text-xs text-slate-400 capitalize flex items-center gap-1">
                    {RESOURCE_EMOJI[r]}{r}
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={stock}
                    value={displayVal}
                    onChange={e => setReserveDraft(prev => ({ ...prev, [r]: e.target.value }))}
                    onBlur={() => handleReserveBlur(r)}
                    onKeyDown={e => { if (e.key === 'Enter') handleReserveBlur(r); }}
                    className="w-16 text-xs bg-stone-800 border border-stone-600 rounded px-1.5 py-0.5 text-slate-200 text-right focus:outline-none focus:border-amber-500"
                  />
                  <span className="text-xs text-stone-500">/ {stock}</span>
                  {surplusQty > 0 && (
                    <span className="text-xs text-emerald-500 ml-auto">+{surplusQty} free</span>
                  )}
                </div>
              );
            })}
          </div>
          {/* Surplus summary */}
          {surplusEntries.length > 0 && (
            <p className="mt-3 text-xs text-slate-500">
              <span className="text-slate-400">Surplus available to settlers: </span>
              {surplusEntries.map(r => `${RESOURCE_EMOJI[r] ?? ''}${surplus[r]} ${r}`).join(' · ')}
            </p>
          )}
          {Object.keys(reserveDraft).length > 0 && (
            <button
              onClick={commitReserves}
              className="mt-2 text-xs px-2 py-1 rounded bg-amber-800 hover:bg-amber-700 text-amber-100"
            >
              Apply changes
            </button>
          )}
        </section>

        {/* COMPANY EXPORT */}
        <section className="w-52 bg-stone-900 border border-stone-700 rounded-xl p-3 self-start">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
            Company Export
          </h3>
          <p className="text-xs text-stone-500 mb-3">
            Sell surplus goods to the Company for gold.
          </p>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">{RESOURCE_EMOJI['goods']} Goods</span>
              <div className="flex items-center gap-1 ml-auto">
                <button
                  onClick={() => setExportAmount(a => Math.max(4, a - 4))}
                  className="w-5 h-5 rounded bg-stone-700 hover:bg-stone-600 text-slate-300 text-xs flex items-center justify-center"
                >−</button>
                <span className="w-8 text-center text-xs text-slate-200">{safeExport}</span>
                <button
                  onClick={() => setExportAmount(a => Math.min(maxExport, a + 4))}
                  disabled={maxExport === 0}
                  className="w-5 h-5 rounded bg-stone-700 hover:bg-stone-600 text-slate-300 text-xs flex items-center justify-center disabled:opacity-40"
                >+</button>
              </div>
            </div>

            <div className="text-xs text-slate-500 flex justify-between">
              <span>Rate</span>
              <span className="text-slate-400">4 goods → 1 gold</span>
            </div>
            <div className="text-xs text-slate-500 flex justify-between">
              <span>You receive</span>
              <span className="text-emerald-400 font-medium">{RESOURCE_EMOJI['gold']}{goldPreview} gold</span>
            </div>
            {standingBonusPreview > 0 && (
              <div className="text-xs text-slate-500 flex justify-between">
                <span>Standing bonus</span>
                <span className="text-sky-400">+{standingBonusPreview}</span>
              </div>
            )}
            <div className="text-xs text-slate-500 flex justify-between">
              <span>Exported this year</span>
              <span className="text-slate-400">{gameState.company.exportedGoodsThisYear} goods</span>
            </div>
          </div>

          <button
            onClick={handleExport}
            disabled={!canManage || safeExport < 4}
            className="mt-3 w-full px-2 py-1.5 text-xs rounded bg-amber-700 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-amber-100 font-medium"
          >
            Export
          </button>

          {!canManage && (
            <p className="mt-1.5 text-[10px] text-stone-600 italic text-center">Management phase only</p>
          )}
        </section>
      </div>

      {/* ── Crafting ─────────────────────────────────────────────────────────── */}
      <section className="bg-stone-900 border border-stone-700 rounded-xl p-3">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Crafting</h3>

        {!canManage && (
          <div className="mb-2 px-2 py-1.5 bg-stone-800 border border-stone-600 rounded text-xs text-slate-400">
            Crafting is only available during the Management phase.
          </div>
        )}

        {craftFeedback && (
          <p className="text-xs text-emerald-400 mb-2">{craftFeedback}</p>
        )}

        <div className="space-y-2">
          {Object.values(CRAFT_RECIPES).map(recipe => {
            const unlocked   = availableIds.has(recipe.id);
            const validation = !canManage
              ? { ok: false as const, reason: 'Management phase only' }
              : validateCraft(recipe.id, settlement.buildings, resources);
            const canCraft   = validation.ok;

            return (
              <div
                key={recipe.id}
                className={`rounded border p-2.5 ${unlocked ? 'border-stone-600 bg-stone-800' : 'border-stone-700 bg-stone-800/40 opacity-60'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-xs font-medium text-slate-200">{recipe.label}</span>
                    <p className="text-xs text-slate-500 mt-0.5">{recipe.description}</p>
                    <p className="text-xs text-stone-400 mt-1">
                      <span className="text-stone-500">Needs: </span>{fmtResources(recipe.requires.resources)}
                      {recipe.requires.buildings && recipe.requires.buildings.length > 0 && (
                        <span className="text-stone-500"> + {recipe.requires.buildings.join(', ')}</span>
                      )}
                    </p>
                    <p className="text-xs text-emerald-400 mt-0.5">
                      <span className="text-stone-500">Makes: </span>{fmtResources(recipe.produces)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleCraft(recipe.id)}
                    disabled={!canCraft}
                    className="shrink-0 px-2 py-1 text-xs rounded bg-amber-700 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-amber-100 font-medium"
                  >
                    Craft
                  </button>
                </div>
                {!canCraft && canManage && !validation.ok && (
                  <p className="text-xs text-red-400 mt-1">{validation.reason}</p>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
