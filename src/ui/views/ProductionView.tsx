/**
 * ProductionView — the Production tab.
 *
 * A standalone view for crafting recipes, lifted from SettlementView.
 * Future expansion: batch crafting, specialisation orders.
 */

import { useState } from 'react';
import { useGameStore } from '../../stores/game-store';
import { getAvailableCrafts, CRAFT_RECIPES, validateCraft } from '../../simulation/economy/crafting';
import type { CraftRecipeId } from '../../simulation/economy/crafting';
import type { ResourceType } from '../../simulation/turn/game-state';
import { RESOURCE_EMOJI } from '../shared/resource-display';

export default function ProductionView() {
  const gameState    = useGameStore(s => s.gameState);
  const currentPhase = useGameStore(s => s.currentPhase);
  const performCraft = useGameStore(s => s.performCraft);
  const [feedback, setFeedback] = useState<string | null>(null);

  if (!gameState) {
    return (
      <div className="flex-1 flex items-center justify-center text-stone-500 text-sm italic">
        No game in progress.
      </div>
    );
  }

  const canManage = currentPhase === 'management' || currentPhase === 'idle';
  const { settlement } = gameState;
  const resources    = settlement.resources;
  const available    = getAvailableCrafts(settlement.buildings, resources);
  const availableIds = new Set(available.map(r => r.id));

  function handleCraft(id: CraftRecipeId) {
    const check = validateCraft(id, settlement.buildings, resources);
    if (!check.ok) { setFeedback(`Cannot craft: ${check.reason}`); return; }
    performCraft(id);
    const recipe = Object.values(CRAFT_RECIPES).find(r => r.id === id);
    setFeedback(`Crafted: ${recipe?.label ?? id}`);
  }

  function fmtResources(res: Partial<Record<ResourceType, number>>) {
    return Object.entries(res)
      .filter(([, v]) => (v as number) > 0)
      .map(([k, v]) => `${RESOURCE_EMOJI[k as ResourceType] ?? ''}${v} ${k}`)
      .join(', ');
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden p-4">
      <h2 className="text-base font-semibold text-slate-300 mb-3">Production</h2>

      {!canManage && (
        <div className="mb-3 px-3 py-2 bg-stone-800 border border-stone-600 rounded text-xs text-slate-400">
          Crafting is only available during the Management phase.
        </div>
      )}

      {feedback && (
        <p className="text-xs text-emerald-400 mb-2 px-1">{feedback}</p>
      )}

      <div className="flex-1 overflow-y-auto space-y-2">
        {Object.values(CRAFT_RECIPES).length === 0 && (
          <p className="text-xs text-slate-600 italic">No recipes available.</p>
        )}
        {Object.values(CRAFT_RECIPES).map(recipe => {
          const unlocked   = availableIds.has(recipe.id);
          const validation = !canManage
            ? { ok: false as const, reason: 'Management phase only' }
            : validateCraft(recipe.id, settlement.buildings, resources);
          const canCraft = validation.ok;

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
              {!canCraft && !(!canManage) && !validation.ok && (
                <p className="text-xs text-red-400 mt-1">{validation.reason}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
