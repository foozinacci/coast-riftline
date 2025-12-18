// RIFTLINE - Main Entry Point
// Squad-based Battle Royale - Top-down, Mobile-first

import { Game } from './game/Game';
import { supabaseService } from './network/supabase';

// Initialize the game when the DOM is ready
async function init(): Promise<void> {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;

  if (!canvas) {
    console.error('Could not find game canvas element');
    return;
  }

  // Auto sign-in anonymously for multiplayer features
  if (supabaseService.isConfigured()) {
    console.log('[Auth] Signing in anonymously...');
    const profile = await supabaseService.signInAnonymously();
    if (profile) {
      console.log(`[Auth] Signed in as: ${profile.display_name} (${profile.username})`);
      console.log(`[Auth] Friend Code: ${profile.friend_code || 'NOT SET'}`);
    } else {
      console.log('[Auth] Anonymous sign-in failed, playing offline');
    }
  } else {
    console.log('[Auth] Supabase not configured, playing offline');
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
  console.log('  E/F - Interact (pickup relics/loot, plant relics)');
  console.log('  Shift - Dash');
  console.log('  Q - Tactical Ability');
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
