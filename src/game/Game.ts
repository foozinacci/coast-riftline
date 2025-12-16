// Main Game Class - orchestrates all systems

import {
  GamePhase,
  PlayerClass,
  AppState,
  Vector2,
} from '../core/types';
import { GAME_CONFIG, ORB_CONFIG } from '../core/constants';
import {
  distanceVec2,
  circleCircleCollision,
} from '../core/utils';
import { Renderer } from '../core/renderer';
import { InputManager } from '../core/input';
import { getNavigationManager } from '../core/navigation';
import { Player } from '../entities/Player';
import { Projectile } from '../entities/Projectile';
import { Relic, RelicState } from '../entities/Relic';
import { RespawnOrb } from '../entities/RespawnOrb';
import { GameMap, Riftline, ProximityAwareness, SquadManager } from '../systems';
import { HUD } from '../ui/HUD';
import { ScreenManager } from '../ui/screens';
import { AIController } from './AI';

export class Game {
  // Core systems
  private renderer: Renderer;
  private input: InputManager;
  private map: GameMap;
  private riftline: Riftline;
  private squadManager: SquadManager;
  private proximityAwareness: ProximityAwareness;
  private hud: HUD;
  private screenManager: ScreenManager;

  // Game state
  private phase: GamePhase;
  private localPlayer: Player | null;
  private projectiles: Projectile[];
  private respawnOrbs: RespawnOrb[];
  private aiControllers: Map<string, AIController>;

  // Timing
  private lastTime: number;
  private accumulator: number;
  private readonly fixedDt: number = 1 / 60;

  // Game over state
  private isGameOver: boolean;
  private winningSquadId: string | null;

  // Menu mode flag (when true, show menus instead of game)
  private useMenuSystem: boolean = true;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new Renderer(canvas);
    this.input = new InputManager(canvas);
    this.map = new GameMap();
    this.riftline = new Riftline(GAME_CONFIG.mapWidth, GAME_CONFIG.mapHeight);
    this.squadManager = new SquadManager();
    this.proximityAwareness = new ProximityAwareness();
    this.hud = new HUD(this.input.isMobileDevice());
    this.screenManager = new ScreenManager(this.input.isMobileDevice());

    // Set up game callbacks for the menu system
    this.screenManager.setGameCallbacks({
      startGame: () => this.startTestGame(),
      resetGame: () => this.resetToLobby(),
    });

    this.phase = GamePhase.LOBBY;
    this.localPlayer = null;
    this.projectiles = [];
    this.respawnOrbs = [];
    this.aiControllers = new Map();

    this.lastTime = performance.now();
    this.accumulator = 0;

    this.isGameOver = false;
    this.winningSquadId = null;
  }

  // Initialize a test game with bots
  startTestGame(): void {
    this.useMenuSystem = false;
    this.phase = GamePhase.PLAYING;

    // Generate relic positions
    this.map.generateRelicPositions();

    // Create player squad
    const playerSquad = this.squadManager.createSquad();
    const spawnSite = this.map.spawnSites[0];
    const spawnPositions = spawnSite.getSpawnPositions(3);

    // Create local player
    this.localPlayer = new Player(
      spawnPositions[0].x,
      spawnPositions[0].y,
      playerSquad.id,
      PlayerClass.SKIRMISHER,
      playerSquad.color,
      true
    );
    this.squadManager.addPlayerToSquad(playerSquad.id, this.localPlayer);

    // Add AI teammates
    for (let i = 1; i < 3; i++) {
      const teammate = new Player(
        spawnPositions[i].x,
        spawnPositions[i].y,
        playerSquad.id,
        i === 1 ? PlayerClass.VANGUARD : PlayerClass.SENTINEL,
        playerSquad.color,
        false
      );
      this.squadManager.addPlayerToSquad(playerSquad.id, teammate);
      this.aiControllers.set(teammate.id, new AIController(teammate, 0.5));
    }

    // Create enemy squads with bots
    for (let squadIndex = 1; squadIndex < 4; squadIndex++) {
      const enemySquad = this.squadManager.createSquad();
      const enemySpawnSite = this.map.spawnSites[squadIndex % this.map.spawnSites.length];
      const enemySpawns = enemySpawnSite.getSpawnPositions(3);

      const classes = [PlayerClass.VANGUARD, PlayerClass.SKIRMISHER, PlayerClass.SENTINEL];

      for (let i = 0; i < 3; i++) {
        const enemy = new Player(
          enemySpawns[i].x,
          enemySpawns[i].y,
          enemySquad.id,
          classes[i],
          enemySquad.color,
          false
        );
        this.squadManager.addPlayerToSquad(enemySquad.id, enemy);
        this.aiControllers.set(enemy.id, new AIController(enemy, 0.4 + Math.random() * 0.3));
      }
    }

    // Set riftline convergence point to delivery site
    this.riftline.setConvergencePoint(this.map.deliverySite.position);
  }

  update(): void {
    const currentTime = performance.now();
    const frameTime = Math.min((currentTime - this.lastTime) / 1000, 0.25);
    this.lastTime = currentTime;

    this.accumulator += frameTime;

    // Fixed timestep updates
    while (this.accumulator >= this.fixedDt) {
      this.fixedUpdate(this.fixedDt);
      this.accumulator -= this.fixedDt;
    }

    // Variable timestep updates (rendering, camera)
    this.variableUpdate(frameTime);
  }

  private fixedUpdate(dt: number): void {
    const navManager = getNavigationManager();
    const currentAppState = navManager.getCurrentState();

    // If in menu system and not in active match, let screen manager handle input
    if (this.useMenuSystem && currentAppState !== AppState.IN_MATCH) {
      this.screenManager.handleInput(this.input);
      return;
    }

    // Handle in-match pause
    if (currentAppState === AppState.IN_MATCH || currentAppState === AppState.PAUSE_MENU) {
      // Check for pause input
      if (this.input.consumeBack()) {
        if (currentAppState === AppState.IN_MATCH) {
          navManager.navigateTo(AppState.PAUSE_MENU);
          return;
        } else if (currentAppState === AppState.PAUSE_MENU) {
          navManager.navigateTo(AppState.IN_MATCH);
          return;
        }
      }

      // If paused, handle pause menu input
      if (currentAppState === AppState.PAUSE_MENU) {
        this.screenManager.handleInput(this.input);
        return;
      }
    }

    // Legacy lobby/game-over handling (fallback if menu system disabled)
    if (!this.useMenuSystem) {
      if (this.phase === GamePhase.LOBBY) {
        if (this.input.consumeConfirm()) {
          this.startTestGame();
        }
        return;
      }

      if (this.phase === GamePhase.GAME_OVER) {
        if (this.input.consumeConfirm()) {
          this.resetToLobby();
        }
        return;
      }
    }

    if (this.phase !== GamePhase.PLAYING || this.isGameOver) return;

    // Update riftline
    this.riftline.update(dt);

    // Update map (relics, loot)
    this.map.update(dt);

    // Process local player input
    if (this.localPlayer && this.localPlayer.state.isAlive) {
      const playerScreenPos = this.renderer.worldToScreen(this.localPlayer.position);
      this.input.update(playerScreenPos);
      const inputState = this.input.getState();

      this.localPlayer.handleInput(inputState);

      // Handle firing
      if (inputState.isFiring) {
        this.tryFireWeapon(this.localPlayer);
      }

      // Handle reload - auto-reload on mobile when empty
      const shouldReload = this.input.consumeReload() ||
        (this.input.isMobileDevice() && this.localPlayer.weapon.currentAmmo === 0);
      if (shouldReload) {
        this.localPlayer.reload();
      }

      // Handle interact (pickup) - always auto-loot on mobile
      if (this.input.consumeInteract() || this.input.isMobileDevice()) {
        this.tryInteract(this.localPlayer);
      }
    }

    // Update AI controllers
    const allPlayers = this.squadManager.getAllPlayers();
    const riftlineState = this.riftline.getState();

    for (const [playerId, ai] of this.aiControllers) {
      const player = this.squadManager.getPlayer(playerId);
      if (!player || !player.state.isAlive) continue;

      const context = {
        enemies: allPlayers.filter(p => p.squadId !== player.squadId),
        teammates: allPlayers.filter(p => p.squadId === player.squadId && p.id !== player.id),
        relics: this.map.relics,
        orbs: this.respawnOrbs,
        loot: this.map.loot,
        deliverySite: this.map.deliverySite,
        riftlineCenter: riftlineState.currentCenter,
        riftlineRadius: riftlineState.currentRadius,
      };

      const aiResult = ai.update(dt, context);

      if (aiResult.fire) {
        this.tryFireWeapon(player);
      }
      if (aiResult.reload) {
        player.reload();
      }
    }

    // Update all players
    for (const player of allPlayers) {
      player.update(dt);

      // Apply riftline damage
      if (player.state.isAlive) {
        const damage = this.riftline.getDamageAtPosition(player.position, dt);
        if (damage > 0) {
          player.takeDamage(damage);
        }
      }

      // Clamp to map bounds
      player.position.x = Math.max(0, Math.min(GAME_CONFIG.mapWidth, player.position.x));
      player.position.y = Math.max(0, Math.min(GAME_CONFIG.mapHeight, player.position.y));

      // Check obstacle collisions
      const obstacle = this.map.checkObstacleCollision(player.position, player.radius);
      if (obstacle) {
        // Push player out of obstacle
        const dir = {
          x: player.position.x - obstacle.position.x,
          y: player.position.y - obstacle.position.y,
        };
        const dist = Math.sqrt(dir.x * dir.x + dir.y * dir.y);
        if (dist > 0) {
          const pushDist = player.radius + obstacle.radius - dist;
          player.position.x += (dir.x / dist) * pushDist;
          player.position.y += (dir.y / dist) * pushDist;
        }
      }
    }

    // Update projectiles
    this.updateProjectiles(dt);

    // Update respawn orbs
    this.updateRespawnOrbs(dt);

    // Check relic pickups and deliveries
    this.checkRelicInteractions();

    // Update squad statuses
    for (const squad of this.squadManager.getAllSquads()) {
      this.squadManager.updateSquadStatus(squad.id, dt);
    }

    // Check for respawns
    this.processRespawns();

    // Check win condition
    this.checkWinCondition();

    // Update proximity awareness for local player
    if (this.localPlayer) {
      this.proximityAwareness.update(
        this.localPlayer,
        allPlayers.filter(p => p.squadId !== this.localPlayer!.squadId),
        this.map.relics,
        riftlineState.currentCenter,
        riftlineState.currentRadius
      );
    }
  }

  private variableUpdate(dt: number): void {
    // Update camera
    if (this.localPlayer) {
      this.renderer.setCameraTarget(this.localPlayer.position.x, this.localPlayer.position.y);
      this.renderer.setCameraZoom(this.input.getState().zoom);
    }
    this.renderer.updateCamera(dt);
  }

  private tryFireWeapon(player: Player): void {
    const fireResult = player.fire();
    if (!fireResult) return;

    // Create projectile
    const projectile = new Projectile(
      player.position.x + fireResult.direction.x * 25,
      player.position.y + fireResult.direction.y * 25,
      fireResult.direction,
      player.id,
      player.squadId,
      player.weapon.config
    );

    this.projectiles.push(projectile);

    // Screen shake for local player
    if (player === this.localPlayer) {
      this.renderer.addScreenShake(2);
    }
  }

  private updateProjectiles(dt: number): void {
    const allPlayers = this.squadManager.getAllPlayers();

    for (const projectile of this.projectiles) {
      if (!projectile.isActive) continue;

      projectile.update(dt);

      // Check collision with players
      for (const player of allPlayers) {
        if (!player.state.isAlive) continue;
        if (player.squadId === projectile.squadId) continue; // No friendly fire

        if (circleCircleCollision(
          { x: projectile.position.x, y: projectile.position.y, radius: projectile.radius },
          { x: player.position.x, y: player.position.y, radius: player.radius }
        )) {
          // Hit!
          const damage = player.takeDamage(projectile.damage, projectile.ownerId);

          // Track damage for shooter
          const shooter = this.squadManager.getPlayer(projectile.ownerId);
          if (shooter) {
            shooter.stats.damageDealt += damage;

            // Check for kill
            if (!player.state.isAlive) {
              shooter.stats.kills++;

              // Spawn respawn orb
              this.spawnRespawnOrb(player.position, player.id);
            }
          }

          // Screen shake on hit
          if (player === this.localPlayer) {
            this.renderer.addScreenShake(5);
          }

          projectile.destroy();
          break;
        }
      }

      // Check collision with obstacles
      const obstacle = this.map.checkObstacleCollision(projectile.position, projectile.radius);
      if (obstacle) {
        obstacle.takeDamage(projectile.damage);
        projectile.destroy();
      }
    }

    // Remove inactive projectiles
    this.projectiles = this.projectiles.filter(p => p.isActive);
  }

  private spawnRespawnOrb(position: Vector2, sourcePlayerId: string): void {
    if (!ORB_CONFIG.dropOnKill) return;

    const orb = new RespawnOrb(position.x, position.y, sourcePlayerId);
    this.respawnOrbs.push(orb);
  }

  private updateRespawnOrbs(dt: number): void {
    const allPlayers = this.squadManager.getAllPlayers();

    for (const orb of this.respawnOrbs) {
      if (!orb.isActive) continue;

      orb.update(dt);

      // Check collection by players
      for (const player of allPlayers) {
        if (!player.state.isAlive) continue;

        if (distanceVec2(player.position, orb.position) < ORB_CONFIG.collectRadius) {
          player.collectOrb(orb.value);
          orb.destroy();
          break;
        }
      }
    }

    this.respawnOrbs = this.respawnOrbs.filter(o => o.isActive);
  }

  private tryInteract(player: Player): void {
    // Check for relic pickup
    for (const relic of this.map.relics) {
      if (!relic.isActive) continue;
      if (relic.state === RelicState.CARRIED || relic.state === RelicState.DELIVERED) continue;
      if (player.hasRelic) continue; // Can only carry one

      if (distanceVec2(player.position, relic.position) < 40) {
        relic.pickup(player.id);
        player.hasRelic = true;
        return;
      }
    }

    // Check for loot pickup
    for (const loot of this.map.loot) {
      if (!loot.isActive) continue;

      if (distanceVec2(player.position, loot.position) < 30) {
        // Apply loot effect (simplified for now)
        loot.destroy();
        return;
      }
    }
  }

  private checkRelicInteractions(): void {
    const allPlayers = this.squadManager.getAllPlayers();

    // Auto-pickup for AI (they don't press interact)
    for (const player of allPlayers) {
      if (!player.state.isAlive || player.isLocalPlayer || player.hasRelic) continue;

      for (const relic of this.map.relics) {
        if (!relic.isActive) continue;
        if (relic.state === RelicState.CARRIED || relic.state === RelicState.DELIVERED) continue;

        if (distanceVec2(player.position, relic.position) < 30) {
          relic.pickup(player.id);
          player.hasRelic = true;
          break;
        }
      }
    }

    // Check for relic delivery
    const deliverySite = this.map.deliverySite;

    for (const player of allPlayers) {
      if (!player.state.isAlive || !player.hasRelic) continue;

      if (distanceVec2(player.position, deliverySite.position) < deliverySite.radius) {
        // Start/update delivery (simplified - instant delivery for now)
        player.hasRelic = false;
        player.stats.relicsDelivered++;

        // Mark relic as delivered
        const carriedRelic = this.map.relics.find(r => r.carrierId === player.id);
        if (carriedRelic) {
          carriedRelic.deliver();
        }

        deliverySite.completeDelivery();
        this.squadManager.deliverRelic(player.squadId);

        // Check if all relics delivered
        if (deliverySite.relicsDelivered >= GAME_CONFIG.totalRelics) {
          this.riftline.forceConvergence(deliverySite.position);
        }
      }
    }

    // Drop relic if carrier dies
    for (const relic of this.map.relics) {
      if (relic.state !== RelicState.CARRIED) continue;

      const carrier = allPlayers.find(p => p.id === relic.carrierId);
      if (!carrier || !carrier.state.isAlive) {
        if (carrier) {
          relic.drop(carrier.position.x, carrier.position.y);
          carrier.hasRelic = false;
        }
      }
    }
  }

  private processRespawns(): void {
    const allPlayers = this.squadManager.getAllPlayers();

    for (const player of allPlayers) {
      if (player.state.isAlive) continue;
      if (player.state.respawnTimer > 0) continue;

      const squad = this.squadManager.getSquad(player.squadId);
      if (!squad || squad.isEliminated) continue;

      // Check if can respawn
      const respawnPos = this.squadManager.getSquadRespawnPosition(player.squadId);
      if (respawnPos) {
        const baseCooldown = GAME_CONFIG.respawnBaseCooldown;
        const efficiency = this.riftline.getRespawnEfficiency();
        const respawnTime = this.squadManager.calculateRespawnTime(
          player.squadId,
          baseCooldown / efficiency,
          player.orbCount
        );

        player.respawn(respawnPos.x, respawnPos.y, respawnTime);
      }
    }
  }

  private checkWinCondition(): void {
    const winner = this.squadManager.checkForWinner();
    if (winner) {
      this.isGameOver = true;
      this.winningSquadId = winner.id;
      this.phase = GamePhase.GAME_OVER;

      // If using menu system, transition to post-match screen
      if (this.useMenuSystem && this.localPlayer) {
        const isWinner = this.localPlayer.squadId === this.winningSquadId;
        this.screenManager.setMatchResult(isWinner, this.localPlayer.stats);
        this.screenManager.navigateTo(AppState.POST_MATCH);
      }
    }
  }

  render(): void {
    const navManager = getNavigationManager();
    const currentAppState = navManager.getCurrentState();
    const screenSize = this.renderer.getScreenSize();

    this.renderer.beginFrame();

    // Determine if we should render the game world or menu
    const shouldRenderGame = !this.useMenuSystem ||
      currentAppState === AppState.IN_MATCH ||
      currentAppState === AppState.PAUSE_MENU ||
      currentAppState === AppState.POST_MATCH;

    if (shouldRenderGame && this.phase === GamePhase.PLAYING) {
      // Render game world
      this.map.render(this.renderer);
      this.riftline.render(this.renderer);

      // Render respawn orbs
      for (const orb of this.respawnOrbs) {
        if (orb.isActive) {
          orb.render(this.renderer);
        }
      }

      // Render players
      const allPlayers = this.squadManager.getAllPlayers();
      for (const player of allPlayers) {
        if (player.isActive) {
          player.render(this.renderer);
        }
      }

      // Render projectiles
      for (const projectile of this.projectiles) {
        if (projectile.isActive) {
          projectile.render(this.renderer);
        }
      }

      // Render proximity awareness
      if (this.localPlayer && this.localPlayer.state.isAlive) {
        const playerScreenPos = this.renderer.worldToScreen(this.localPlayer.position);
        this.proximityAwareness.render(this.renderer, playerScreenPos);
      }

      // Render HUD (only in active match, not paused)
      if (currentAppState === AppState.IN_MATCH) {
        const riftlineState = this.riftline.getState();
        this.hud.render(
          this.renderer,
          this.localPlayer,
          this.phase,
          riftlineState,
          this.squadManager.getAliveSquads().length,
          this.map.deliverySite.relicsDelivered,
          GAME_CONFIG.totalRelics
        );
      }
    }

    // Render menu overlay if in menu state
    if (this.useMenuSystem && this.screenManager.handlesCurrentState()) {
      this.screenManager.render(this.renderer, screenSize.x, screenSize.y);
    }

    // Legacy game over screen (if menu system disabled)
    if (!this.useMenuSystem && this.isGameOver && this.localPlayer) {
      const isWinner = this.localPlayer.squadId === this.winningSquadId;
      this.hud.renderGameOver(this.renderer, isWinner, this.localPlayer.stats);
    }

    this.renderer.endFrame();
  }

  // Main game loop
  start(): void {
    const gameLoop = () => {
      this.update();
      this.render();
      requestAnimationFrame(gameLoop);
    };

    // Hide loading screen
    const loadingEl = document.getElementById('loading');
    if (loadingEl) {
      loadingEl.style.display = 'none';
    }

    // Start with the menu system
    if (this.useMenuSystem) {
      this.screenManager.start();
    }

    requestAnimationFrame(gameLoop);
  }

  private resetToLobby(): void {
    this.phase = GamePhase.LOBBY;
    this.isGameOver = false;
    this.winningSquadId = null;
    this.useMenuSystem = true;

    this.localPlayer = null;
    this.projectiles = [];
    this.respawnOrbs = [];
    this.aiControllers.clear();

    this.squadManager.reset();
    this.map = new GameMap();
    this.riftline = new Riftline(GAME_CONFIG.mapWidth, GAME_CONFIG.mapHeight);
    this.proximityAwareness = new ProximityAwareness();

    // Return to main menu
    this.screenManager.navigateTo(AppState.MAIN_MENU);
  }

  getPhase(): GamePhase {
    return this.phase;
  }

  isOver(): boolean {
    return this.isGameOver;
  }
}
