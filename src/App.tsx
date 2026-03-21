import { useGameStore } from './stores/game-store';
import GameScreen from './ui/layout/GameScreen';
import IntroSequence from './ui/overlays/IntroSequence';

function App() {
  const gameState = useGameStore(s => s.gameState);
  return gameState ? <GameScreen /> : <IntroSequence />;
}

export default App;

