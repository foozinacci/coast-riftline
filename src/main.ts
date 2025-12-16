import { Game } from './core/Game';

// Initialize game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  init();
});

function init(): void {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  const loading = document.getElementById('loading') as HTMLElement;

  if (!canvas) {
    console.error('Canvas element not found');
    return;
  }

  // Create game instance
  const game = new Game(canvas, {
    mapWidth: 3000,
    mapHeight: 3000,
    teamsCount: 10,
    playersPerTeam: 3,
    relicCount: 5,
  });

  // Initialize test match for development
  game.initTestMatch();

  // Hide loading screen
  if (loading) {
    loading.style.display = 'none';
  }

  // Start game loop
  game.start();

  // Expose for debugging
  (window as any).game = game;

  console.log('RIFTLINE initialized');
}
