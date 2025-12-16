// RIFTLINE - Main Entry Point
// Squad-based Battle Royale - Top-down, Mobile-first

import { Game } from './game/Game';

// Initialize the game when the DOM is ready
function init(): void {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;

  if (!canvas) {
    console.error('Could not find game canvas element');
    return;
  }

  // Create and start the game
  const game = new Game(canvas);
  game.start();

  // Log startup
  console.log('RIFTLINE initialized');
  console.log('Controls:');
  console.log('  WASD / Arrow Keys - Move');
  console.log('  Mouse - Aim');
  console.log('  Left Click / Hold - Fire');
  console.log('  R - Reload');
  console.log('  E/F - Interact (pickup relics/loot)');
  console.log('  Mouse Wheel - Zoom');
  console.log('');
  console.log('Mobile: Left side touch = move, Right side touch = aim/fire');
}

// Start when ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
