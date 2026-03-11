import { useGameStore } from './stores/game-store';
import GameScreen from './ui/layout/GameScreen';
import GameSetup from './ui/overlays/GameSetup';

function App() {
  const gameState = useGameStore(s => s.gameState);
  return gameState ? <GameScreen /> : <GameSetup />;
}

export default App;

