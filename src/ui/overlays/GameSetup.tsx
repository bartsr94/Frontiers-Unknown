/**
 * GameSetup overlay — new game configuration screen.
 *
 * Shown when no GameState exists (fresh start or cleared save).
 * Collects settlement name and difficulty, then calls newGame().
 */

import { useState } from 'react';
import { useGameStore } from '../../stores/game-store';
import type { GameConfig } from '../../simulation/turn/game-state';

export default function GameSetup() {
  const newGame = useGameStore(s => s.newGame);

  const [settlementName, setSettlementName] = useState('');
  const [difficulty, setDifficulty] = useState<GameConfig['difficulty']>('normal');
  const [includeSauromatianWomen, setIncludeSauromatianWomen] = useState(true);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = settlementName.trim() || 'Ashmark Settlement';
    const config: GameConfig = {
      difficulty,
      startingTribes: [],
      startingLocation: 'ashmark_estuary',
      includeSauromatianWomen,
    };
    newGame(config, name);
  }

  return (
    <div className="min-h-screen bg-stone-900 flex items-center justify-center p-6">
      {/* Parchment card */}
      <div className="w-full max-w-md bg-amber-950 border border-amber-800 rounded-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-b from-amber-900 to-amber-950 px-8 py-6 text-center">
          <h1 className="font-display text-3xl font-bold text-amber-100 tracking-wide">
            Palusteria
          </h1>
          <p className="text-amber-300 text-sm mt-1 italic tracking-[0.15em]">
            Children of the Ashmark
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-8 py-6 space-y-5">
          {/* Settlement name */}
          <div>
            <label
              htmlFor="settlementName"
              className="block text-amber-200 text-sm font-semibold mb-1"
            >
              Settlement Name
            </label>
            <input
              id="settlementName"
              type="text"
              value={settlementName}
              onChange={e => setSettlementName(e.target.value)}
              placeholder="Ashmark Settlement"
              maxLength={40}
              className="w-full bg-stone-800 border border-amber-700 rounded px-3 py-2
                         text-amber-100 placeholder-stone-500 focus:outline-none
                         focus:ring-2 focus:ring-amber-600 focus:border-transparent"
            />
          </div>

          {/* Difficulty */}
          <div>
            <label
              htmlFor="difficulty"
              className="block text-amber-200 text-sm font-semibold mb-1"
            >
              Difficulty
            </label>
            <select
              id="difficulty"
              value={difficulty}
              onChange={e => setDifficulty(e.target.value as GameConfig['difficulty'])}
              className="w-full bg-stone-800 border border-amber-700 rounded px-3 py-2
                         text-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-600
                         focus:border-transparent"
            >
              <option value="easy">Easy — The Company is patient</option>
              <option value="normal">Normal — By the Book</option>
              <option value="hard">Hard — The Inspector Watches</option>
            </select>
          </div>

          {/* Founding Sauromatian women */}
          <div className="flex items-start gap-3">
            <input
              id="includeSauromatianWomen"
              type="checkbox"
              checked={includeSauromatianWomen}
              onChange={e => setIncludeSauromatianWomen(e.target.checked)}
              className="mt-0.5 accent-amber-600 h-4 w-4 flex-shrink-0 cursor-pointer"
            />
            <label
              htmlFor="includeSauromatianWomen"
              className="text-amber-200 text-sm leading-snug cursor-pointer"
            >
              Include Sauromatian women in founding settlers
              <span className="block text-stone-400 text-xs mt-0.5 italic">
                Adds three Kiswani women (ages 18, 22, 26) for immediate cross-cultural
                marriage and genetics testing.
              </span>
            </label>
          </div>

          {/* Flavour text */}
          <p className="text-stone-400 text-xs italic leading-relaxed">
            Ten men. One charter. A wilderness that does not care.
            The Ansberry Company expects returns. Build wisely.
          </p>

          {/* Submit */}
          <button
            type="submit"
            className="w-full bg-amber-700 hover:bg-amber-600 active:bg-amber-800
                       text-amber-100 font-bold py-3 rounded transition-colors
                       shadow-lg"
          >
            Begin the Expedition
          </button>
        </form>
      </div>
    </div>
  );
}
