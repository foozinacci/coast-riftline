// Main Game Class - orchestrates all systems

import {
  GamePhase,
  PlayerClass,
  AppState,
  Vector2,
} from '../core/types';
import { GAME_CONFIG, ORB_CONFIG, COLORS, WEAPON_CONFIGS } from '../core/constants';
import { Loot, LootType } from '../entities/Loot';
import {
  distanceVec2,
  circleCircleCollision,
} from '../core/utils';
import { Renderer } from '../core/renderer';
import { InputManager } from '../core/input';
import { getNavigationManager } from '../core/navigation';
import { Player } from '../entities/Player';
import { Projectile } from '../entities/Projectile';
import { Relic } from '../entities/Relic'; // Entity Class
import { RelicState, RelicPlantSite } from '../core/types'; // Interfaces/Enums
import { RespawnOrb } from '../entities/RespawnOrb';
import { GameMap, Riftline, ProximityAwareness, SquadManager, SpawnVotingManager, generateSpawnLocations, PreGameAnimationManager, PreGameIntelManager, RelicManager, generateRelicSystem, VaultManager, ArenaRoundSystem, getArenaRoundSystem, resetArenaRoundSystem } from '../systems';
import { HUD, ArenaHUDState } from '../ui/HUD';
import { ScreenManager } from '../ui/screens';
import { AIController } from './AI';
import { TrainingDifficulty, GameMode, MatchStructure } from '../core/types';
import { getDebugOverlay, getObserverController, ObserverMode } from '../debug';
import { getModeConfig, ModeConfig, isArenaMode } from '../core/modeConfig';
import { preferences } from '../core/preferences';
import { getAudio, initAudio, playWeaponFire, playHit, playSfx } from '../core/audio';

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
  private spawnVotingManager: SpawnVotingManager | null;
  private preGameAnimManager: PreGameAnimationManager;
  private preGameIntelManager: PreGameIntelManager;
  private relicManager: RelicManager;
  private vaultManager: VaultManager | null = null;
  private arenaRoundSystem: ArenaRoundSystem | null = null;

  // Game state
  private phase: GamePhase;
  private mode: GameMode = GameMode.MAIN;
  private difficulty: TrainingDifficulty = TrainingDifficulty.MEDIUM;
  private localPlayer: Player | null;
  private projectiles: Projectile[];
  private respawnOrbs: RespawnOrb[];
  private bubbleZones: import('../entities/BubbleZone').BubbleZone[] = [];
  private aiControllers: Map<string, AIController>;

  // Timing
  private lastTime: number;
  private accumulator: number;
  private readonly fixedDt: number = 1 / 60;

  // Game over state
  private isGameOver: boolean;
  private winningSquadId: string | null;

  // Mode configuration (defines rules for current mode)
  private modeConfig: ModeConfig;
  private matchStructure: MatchStructure = MatchStructure.BEST_OF_3;

  // Menu mode flag (when true, show menus instead of game)
  private useMenuSystem: boolean = true;

  // Active match flag - prevents multiple simultaneous starts
  private isMatchActive: boolean = false;

  // Debug and observer systems
  private debugOverlay = getDebugOverlay();
  private observerController = getObserverController();

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new Renderer(canvas);
    this.input = new InputManager(canvas);
    this.map = new GameMap();
    this.riftline = new Riftline(GAME_CONFIG.mapWidth, GAME_CONFIG.mapHeight);
    this.squadManager = new SquadManager();
    this.proximityAwareness = new ProximityAwareness();
    this.hud = new HUD(this.input.isMobileDevice());
    this.screenManager = new ScreenManager(this.input.isMobileDevice());
    this.spawnVotingManager = null;
    this.preGameAnimManager = new PreGameAnimationManager();
    this.preGameIntelManager = new PreGameIntelManager();
    // Initialize empty relic manager, will be reset in startTestGame
    this.relicManager = new RelicManager([], []);

    // Set up game callbacks for the menu system
    this.screenManager.setGameCallbacks({
      startGame: (mode, difficulty) => this.startTestGame(mode, difficulty),
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
    this.modeConfig = getModeConfig(GameMode.MAIN);

    // Initialize debug keyboard listeners
    this.setupDebugKeyListener();
  }

  // Initialize a match with voting and animation sequence
  startTestGame(mode: GameMode = GameMode.MAIN, difficulty: TrainingDifficulty = TrainingDifficulty.MEDIUM): void {
    // Prevent multiple simultaneous starts (fixes mobile double-tap issue)
    if (this.isMatchActive) {
      console.log('[Game.startTestGame] Match already active, ignoring duplicate start');
      return;
    }
    this.isMatchActive = true;

    console.log('[Game.startTestGame] Starting game with mode:', mode, 'difficulty:', difficulty);
    this.useMenuSystem = true;
    this.mode = mode;
    this.difficulty = difficulty;
    this.phase = GamePhase.SPAWN_VOTE; // Start with voting
    this.isGameOver = false;
    this.winningSquadId = null;
    console.log('[Game.startTestGame] Set phase to SPAWN_VOTE, isMatchActive:', this.isMatchActive);

    // Generate relic system (relics + plant sites) - Only for Main/Training with Relics
    let relics: Relic[] = [];
    let plantSites: RelicPlantSite[] = [];

    // Training mode usually includes relics unless it's specific Arena training, 
    // but for now let's assume Training = Main Mode mechanics unless specified otherwise.
    // Spec says "Training Mode is available for every playable mode".
    // If Mode is TRAINING, we might want to default to Main mechanics or check sub-config.
    // For simplicity: If MAIN or TRAINING, gen relics. If ARENA, don't.
    // Actually, if we select "TRAINING" mode in UI, it currently acts as "Main".
    // If we want to train Arena 1v1, we would need to pass that.
    // The current UI toggles MODE: ARENA 1v1, TRAINING, etc.
    // So if MODE is TRAINING, it's Main Training.
    // If MODE is ARENA_..., it's no relics.

    if (this.mode === GameMode.MAIN || this.mode === GameMode.TRAINING) {
      const gen = generateRelicSystem(
        GAME_CONFIG.mapWidth,
        GAME_CONFIG.mapHeight,
        GAME_CONFIG.totalRelics,
        // Validator: Fail if collision with obstacle
        (pos, radius) => !this.map.checkObstacleCollision(pos, radius)
      );
      relics = gen.relics;
      plantSites = gen.plantSites;
    }

    this.relicManager = new RelicManager(relics, plantSites);

    // Sync map with relic system
    this.map.relics = relics;
    this.map.plantSites = plantSites;
    // Regenerate obstacles now that plant sites are known (prevents obstacle-in-plant-site bug)
    this.map.regenerateObstacles();

    // HUD setup
    this.hud = new HUD(this.input.isMobileDevice());

    // Initialize vault manager for Main mode
    if (this.modeConfig.hasVault) {
      this.vaultManager = new VaultManager(GAME_CONFIG.mapWidth, GAME_CONFIG.mapHeight);
      this.vaultManager.setOnVaultSpawn((position) => {
        this.hud.addNotification('VAULT REVEALED! GET TO THE ZONE!', '#ffd700');
        // Trigger riftline convergence on vault
        this.riftline.forceConvergence(position);
      });
    }

    // Relic Planted Callback
    this.relicManager.setOnRelicPlanted((relicId) => {
      const r = this.relicManager.getRelics().find(r => r.id === relicId);
      if (r && r.planterId) {
        const planter = this.squadManager.getPlayer(r.planterId);
        const name = planter ? planter.name : 'Unknown';
        this.hud.addNotification(`${name} planted a Relic!`, '#44ff44');
      }

      // Check if all relics are planted (vault trigger)
      if (this.modeConfig.hasVault && this.vaultManager) {
        const plantedCount = this.relicManager.getPlantedCount();
        const totalRelics = this.modeConfig.relicsToTriggerVault;

        if (plantedCount >= totalRelics && !this.vaultManager.isActive()) {
          // All relics planted - spawn vault!
          console.log(`All ${totalRelics} relics planted! Spawning vault...`);
          const vaultPos = this.vaultManager.spawnVault();
          this.vaultManager.revealVault();
        }
      }
    });

    this.relicManager.activateRelics();

    // Generate spawn locations for voting
    const spawnLocations = generateSpawnLocations(GAME_CONFIG.mapWidth, GAME_CONFIG.mapHeight);
    this.spawnVotingManager = new SpawnVotingManager(spawnLocations);

    // Load mode configuration for selected game mode
    this.modeConfig = getModeConfig(this.mode);

    // Generate Bubble Zones for Main mode
    if (this.modeConfig.hasBubbleZones && relics.length > 0) {
      const { generateBubbleZones } = require('../entities/BubbleZone');
      const squads = this.squadManager.getAllSquads();

      // Create team pairs (every 2 squads form a pair)
      const teamPairs: [string, string][] = [];
      for (let i = 0; i < squads.length - 1; i += 2) {
        teamPairs.push([squads[i].id, squads[i + 1].id]);
      }

      this.bubbleZones = generateBubbleZones(
        GAME_CONFIG.mapWidth,
        GAME_CONFIG.mapHeight,
        this.modeConfig.bubbleZoneCount,
        relics.map(r => r.id),
        plantSites.map(s => s.id),
        teamPairs
      );
      console.log(`[Game] Created ${this.bubbleZones.length} bubble zones`);
    } else {
      this.bubbleZones = [];
    }

    // Initialize Arena Round System for arena modes
    if (isArenaMode(this.mode)) {
      resetArenaRoundSystem(); // Clear any previous arena match
      this.arenaRoundSystem = getArenaRoundSystem();

      // Set up arena callbacks
      this.arenaRoundSystem.setOnRoundStart((round) => {
        this.hud.addNotification(`ROUND ${round} START`, '#00ffff');
        console.log(`[Game] Arena round ${round} started`);

        // Update HUD state
        this.hud.updateArenaState({
          currentRound: round,
          phase: 'combat',
        });
      });

      this.arenaRoundSystem.setOnRoundEnd((round, winnerId) => {
        const scores = this.arenaRoundSystem?.getScoreDisplay() || '';
        this.hud.addNotification(`ROUND ${round} COMPLETE - ${scores}`, '#ffff00');
        console.log(`[Game] Arena round ${round} ended, winner: ${winnerId}`);

        // Update HUD state with new scores
        if (this.arenaRoundSystem) {
          const teamScores = new Map<string, number>();
          for (const score of this.arenaRoundSystem.getAllScores()) {
            teamScores.set(score.teamId, score.roundWins);
          }
          this.hud.updateArenaState({
            phase: 'round_end',
            teamScores,
          });
        }
      });

      this.arenaRoundSystem.setOnMatchEnd((winnerId) => {
        console.log(`[Game] Arena match ended, winner: ${winnerId}`);
        this.winningSquadId = winnerId;
        this.isGameOver = true;
        this.phase = GamePhase.GAME_OVER;
        this.isMatchActive = false; // Allow rematch

        // Update HUD state
        this.hud.updateArenaState({
          phase: 'match_end',
        });

        if (this.useMenuSystem && this.localPlayer) {
          const isWinner = this.localPlayer.squadId === winnerId;
          this.screenManager.setMatchResult(isWinner, this.localPlayer.stats);
          this.screenManager.navigateTo(AppState.POST_MATCH);
        }
      });

      this.arenaRoundSystem.setOnTimeWarning((seconds) => {
        if (seconds <= 10) {
          this.hud.addNotification(`${seconds} SECONDS REMAINING`, '#ff4444');
        }

        // Update time in HUD state
        this.hud.updateArenaState({
          timeRemaining: seconds,
        });
      });

      // Round reset callback - reset players for next round
      this.arenaRoundSystem.setOnRoundReset(() => {
        this.resetPlayersForRound();
      });
    } else {
      this.arenaRoundSystem = null;
      this.hud.setArenaState(null); // Clear arena HUD for non-arena modes
    }

    // Use mode config for team setup
    const teamCount = this.modeConfig.teamCount;
    const playersPerTeam = this.modeConfig.playersPerTeam;

    console.log(`Starting ${this.modeConfig.name}: ${teamCount} teams, ${playersPerTeam} per team`);

    // Create squads
    const playerSquad = this.squadManager.createSquad();

    // Create enemy squads
    for (let i = 1; i < teamCount; i++) {
      this.squadManager.createSquad();
    }

    // For non-ranked matches (current default): Skip voting, use random spawns
    // Voting phase is reserved for future ranked/competitive mode
    const useSpawnVoting = this.modeConfig.spawnVotingEnabled;

    if (useSpawnVoting) {
      // Start voting phase (future ranked mode)
      const squadIds = this.squadManager.getAllSquads().map(s => s.id);
      this.spawnVotingManager.startVoting(squadIds);
      this.phase = GamePhase.SPAWN_VOTE;

      // Simulate bot votes immediately (randomly)
      for (const squad of this.squadManager.getAllSquads()) {
        if (squad.id === playerSquad.id) continue;
        const randomLoc = spawnLocations[Math.floor(Math.random() * spawnLocations.length)];
        this.spawnVotingManager.castVote(squad.id, 'bot_leader', randomLoc.id);
      }
    } else {
      // Non-ranked: Random spawn assignment, skip directly to pre-game
      const squadIds = this.squadManager.getAllSquads().map(s => s.id);
      this.spawnVotingManager.startVoting(squadIds);

      // Auto-vote randomly for all squads
      for (const squad of this.squadManager.getAllSquads()) {
        const randomLoc = spawnLocations[Math.floor(Math.random() * spawnLocations.length)];
        this.spawnVotingManager.castVote(squad.id, 'auto', randomLoc.id);
      }

      // Skip directly to pre-game sequence
      this.startPreGameSequence();
    }
  }

  // Called when voting is complete
  private startPreGameSequence(): void {
    if (!this.spawnVotingManager) return;

    const assignments = this.spawnVotingManager.finalizeVoting();

    // Spawn players at assigned locations
    const playerSquad = this.squadManager.getAllSquads()[0]; // Assuming first is player

    for (const [squadId, assignment] of assignments) {
      const { location, side } = assignment;
      const squad = this.squadManager.getSquad(squadId);
      if (!squad) continue;

      const spawnPos = this.spawnVotingManager.getSpawnPosition(location, side);

      // Determine team size based on mode
      let playersPerTeam = 3;
      if (this.mode === GameMode.ARENA_1V1 || this.mode === GameMode.ARENA_1V1V1 || this.mode === GameMode.TRAINING) {
        playersPerTeam = 1;
      }

      // We need multiple spawn points around this center
      // Simple offset pattern
      const spawnOffsets = [
        { x: 0, y: 0 },
        { x: 40, y: 40 },
        { x: -40, y: 40 }
      ];

      if (squadId === playerSquad.id) {
        // Create local player with saved class preference
        const selectedClass = preferences.getSelectedClass();
        this.localPlayer = new Player(
          spawnPos.x + spawnOffsets[0].x,
          spawnPos.y + spawnOffsets[0].y,
          playerSquad.id,
          selectedClass,
          playerSquad.color,
          true
        );
        this.squadManager.addPlayerToSquad(playerSquad.id, this.localPlayer);

        // Add AI teammates if needed
        for (let i = 1; i < playersPerTeam; i++) {
          const teammate = new Player(
            spawnPos.x + spawnOffsets[i].x,
            spawnPos.y + spawnOffsets[i].y,
            playerSquad.id,
            i === 1 ? PlayerClass.VANGUARD : PlayerClass.MEDIC,
            playerSquad.color,
            false
          );
          this.squadManager.addPlayerToSquad(playerSquad.id, teammate);
          this.aiControllers.set(teammate.id, new AIController(teammate, this.difficulty));
        }
      } else {
        // Create enemy bots
        const classes = [PlayerClass.VANGUARD, PlayerClass.SCOUT, PlayerClass.SCAVENGER];
        for (let i = 0; i < playersPerTeam; i++) {
          const enemy = new Player(
            spawnPos.x + spawnOffsets[i].x,
            spawnPos.y + spawnOffsets[i].y,
            squad.id,
            classes[i % classes.length],
            squad.color,
            false
          );
          this.squadManager.addPlayerToSquad(squad.id, enemy);
          this.aiControllers.set(enemy.id, new AIController(enemy, this.difficulty));
        }
      }
    }

    // Default spawn if no assignment (failsafe)
    if (!this.localPlayer) {
      console.warn("Local player not spawned from voting, using fallback");
      const fallbackSite = this.map.spawnSites[0];
      const p = fallbackSite.getSpawnPositions(1)[0];
      const selectedClass = preferences.getSelectedClass();
      this.localPlayer = new Player(p.x, p.y, playerSquad.id, selectedClass, playerSquad.color, true);
      this.squadManager.addPlayerToSquad(playerSquad.id, this.localPlayer);
    }

    this.riftline.setConvergencePoint(this.map.deliverySite.position);

    // Start Pre-Game Intel System
    if (this.localPlayer) {
      this.phase = GamePhase.COUNTDOWN; // Use COUNTDOWN phase for intel/animation

      // Start the new intel system
      const mapCenter = { x: GAME_CONFIG.mapWidth / 2, y: GAME_CONFIG.mapHeight / 2 };
      this.preGameIntelManager.start(
        this.mode,
        this.modeConfig,
        this.difficulty,
        mapCenter,
        this.modeConfig.spawnVotingEnabled ? this.spawnVotingManager! : undefined
      );

      this.preGameIntelManager.setOnComplete(() => {
        // For relic modes, show relic locations after intel
        if (this.modeConfig.showRelicLocations && this.map.relics.length > 0) {
          this.preGameAnimManager.start(this.localPlayer!.position, this.map.relics);
          this.preGameAnimManager.setOnComplete(() => {
            this.startGameplay();
          });
        } else {
          // Arena/simple modes go directly to gameplay
          this.startGameplay();
        }
      });
    } else {
      this.startGameplay();
    }
  }

  /**
   * Start actual gameplay after intel/animations complete
   */
  private startGameplay(): void {
    this.phase = GamePhase.PLAYING;

    // Start arena match if in arena mode
    if (this.arenaRoundSystem && isArenaMode(this.mode)) {
      const teamIds = this.squadManager.getAllSquads().map(s => s.id);
      this.arenaRoundSystem.startMatch(this.mode, this.matchStructure, teamIds);
      this.hud.addNotification('ARENA MATCH BEGIN', '#00ffff');

      // Initialize arena HUD state
      this.initializeArenaHUDState(teamIds);
    } else if (this.modeConfig.hasRelics) {
      this.hud.addNotification('SECURE THE RELICS', '#ffaa00');
    }
  }

  /**
   * Initialize arena HUD state with team information
   */
  private initializeArenaHUDState(teamIds: string[]): void {
    if (!this.arenaRoundSystem) return;

    const totalRounds = this.matchStructure === MatchStructure.BEST_OF_5 ? 5 : 3;

    // Create team score map
    const teamScores = new Map<string, number>();
    const teamNames = new Map<string, string>();
    const teamColors = new Map<string, string>();

    teamIds.forEach((teamId, index) => {
      teamScores.set(teamId, 0);

      // Get squad for color and name
      const squad = this.squadManager.getSquad(teamId);
      if (squad) {
        teamNames.set(teamId, `Team ${index + 1}`);
        teamColors.set(teamId, squad.color);
      } else {
        teamNames.set(teamId, `Team ${index + 1}`);
        teamColors.set(teamId, index === 0 ? '#4488ff' : '#ff4444');
      }
    });

    const arenaHUDState: ArenaHUDState = {
      mode: this.mode,
      currentRound: 1,
      maxRounds: totalRounds,
      teamScores,
      teamNames,
      teamColors,
      phase: 'round_start',
      timeRemaining: this.modeConfig?.roundTimeLimit || 180,
      isActive: true,
    };

    this.hud.setArenaState(arenaHUDState);
  }

  /**
   * Reset all players for the next arena round
   * Respawns players at spawn points with full health
   */
  private resetPlayersForRound(): void {
    if (!isArenaMode(this.mode)) return;

    console.log('[Game] Resetting players for next round');
    this.hud.addNotification('NEXT ROUND STARTING...', '#ffff00');

    // Get all players and group by squad
    const allPlayers = this.squadManager.getAllPlayers();
    const squads = this.squadManager.getAllSquads();
    const spawnSites = this.map.spawnSites;

    // Create a map of squadId -> Player[]
    const playersBySquad = new Map<string, typeof allPlayers>();
    for (const player of allPlayers) {
      if (!playersBySquad.has(player.squadId)) {
        playersBySquad.set(player.squadId, []);
      }
      playersBySquad.get(player.squadId)!.push(player);
    }

    // Reset and respawn each squad
    squads.forEach((squad, squadIndex) => {
      // CRITICAL: Reset squad elimination flag for BO3+ rounds
      squad.isEliminated = false;
      squad.wipeTimerRemainingMs = null;

      const squadPlayers = playersBySquad.get(squad.id) || [];

      // Get spawn site for this team (cycle through available sites)
      const spawnSite = spawnSites[squadIndex % spawnSites.length];
      const spawnPositions = spawnSite.getSpawnPositions(squadPlayers.length);

      squadPlayers.forEach((player, playerIndex) => {
        const spawnPos = spawnPositions[playerIndex % spawnPositions.length];

        // Reset player state
        player.state.isAlive = true;
        player.state.health = player.state.maxHealth;
        player.state.shield = 0; // Start fresh with no shield
        player.state.stamina = player.state.maxStamina; // Reset stamina
        player.state.invulnerabilityTimer = 1500; // Brief invulnerability on round start
        player.state.respawnTimer = 0; // Clear any respawn timer
        player.position.x = spawnPos.x;
        player.position.y = spawnPos.y;
        player.velocity.x = 0;
        player.velocity.y = 0;

        // Reset weapon ammo
        if (player.weapon) {
          player.weapon.currentAmmo = player.weapon.config.magazineSize;
          player.weapon.isReloading = false;
          player.weapon.reloadTimer = 0;
        }

        // Reset abilities
        player.isDashing = false;
        player.dashTimer = 0;
        player.tacticalActive = false;
        player.tacticalDuration = 0;

        console.log(`[Game] Reset player ${player.id} at (${spawnPos.x.toFixed(0)}, ${spawnPos.y.toFixed(0)})`);
      });
    });

    // Clear projectiles from previous round
    this.projectiles = [];

    // Clear any respawn orbs
    this.respawnOrbs = [];

    // Update HUD state
    this.hud.updateArenaState({
      phase: 'round_start',
    });
  }

  update(): void {
    const currentTime = performance.now();
    const frameTime = Math.min((currentTime - this.lastTime) / 1000, 0.25);
    this.lastTime = currentTime;

    this.accumulator += frameTime;

    // Debug: Begin frame tracking
    this.debugOverlay.beginFrame();

    // Handle debug keyboard shortcuts
    this.handleDebugInput();

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

    // Debug: Log state periodically (less frequently to reduce spam)
    if (Math.random() < 0.005) {
      console.log('[Game.fixedUpdate] AppState:', currentAppState, 'isMatchActive:', this.isMatchActive, 'phase:', this.phase);
    }

    // If in menu system and not in active match, let screen manager handle input
    // Also check isMatchActive to handle the transition properly
    const isMenuState = currentAppState !== AppState.IN_MATCH && currentAppState !== AppState.PAUSE_MENU;
    if (this.useMenuSystem && isMenuState) {
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

    if (this.phase === GamePhase.SPAWN_VOTE) {
      if (this.spawnVotingManager) {
        // Check if time is up
        if (!this.spawnVotingManager.isActive()) {
          this.startPreGameSequence();
        } else {
          // In a real game, we'd handle UI input for voting here
          // For now, we rely on the timer or manual skip
          if (this.input.consumeConfirm()) {
            // Force skip voting for testing
            this.startPreGameSequence();
          }
        }
      }
      return;
    }

    // Pre-game intel update (new system)
    if (this.preGameIntelManager.isActive()) {
      this.preGameIntelManager.update(dt * 1000); // Expects ms
      if (this.input.consumeConfirm()) {
        this.preGameIntelManager.skip();
      }
      return; // Don't update game world during intel
    }

    // Pre-game animation update (relic reveal for Main mode)
    if (this.preGameAnimManager.isActive()) {
      this.preGameAnimManager.update(dt * 1000); // Expects ms
      if (this.input.consumeConfirm()) {
        this.preGameAnimManager.skip();
      }
      return; // Don't update game world during animation
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

      // Handle dash ability (Shift key)
      if (this.input.consumeDash()) {
        this.localPlayer.dash();
      }

      // Handle tactical ability (Q key)
      if (this.input.consumeTactical()) {
        this.localPlayer.useTactical();
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
    // Update respawn orbs
    this.updateRespawnOrbs(dt);

    // Apply Riftline (Zone) damage
    this.updateEnvironmentDamage(dt);

    // Check relic pickups and deliveries
    this.checkRelicInteractions();

    // Update plant site distance for relic carriers (for HUD proximity indicator)
    for (const player of allPlayers) {
      if (player.hasRelic && player.state.isAlive) {
        let minDist = Infinity;
        for (const site of this.map.plantSites) {
          if (!site.hasPlantedRelic) {
            const dist = Math.sqrt(
              Math.pow(player.position.x - site.position.x, 2) +
              Math.pow(player.position.y - site.position.y, 2)
            );
            if (dist < minDist) {
              minDist = dist;
            }
          }
        }
        player.nearestPlantSiteDistance = minDist === Infinity ? -1 : minDist;
      } else {
        player.nearestPlantSiteDistance = -1;
      }
    }

    // Update squad statuses
    for (const squad of this.squadManager.getAllSquads()) {
      this.squadManager.updateSquadStatus(squad.id, dt);
    }

    // Check for respawns
    this.processRespawns();

    // Update arena round system (if active)
    if (this.arenaRoundSystem && this.arenaRoundSystem.isRoundActive()) {
      this.arenaRoundSystem.update(dt * 1000); // Convert to ms
    }

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
    // Observer mode camera control
    if (this.observerController.isActive()) {
      this.observerController.update(dt, this.input);
      const camPos = this.observerController.getCameraPosition();
      this.renderer.setCameraTarget(camPos.x, camPos.y);
      this.renderer.setCameraZoom(this.observerController.getCameraZoom());
    }
    // Override camera during animation
    else if (this.preGameAnimManager.isActive()) {
      const target = this.preGameAnimManager.getState().cameraTarget;
      this.renderer.setCameraTarget(target.x, target.y);
      this.renderer.setCameraZoom(0.8); // Wider shot during anim
    }
    // Update camera normally
    else if (this.localPlayer) {
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
      // Play weapon fire sound
      playWeaponFire(player.weapon.config.name, 0);
    } else {
      // Positional audio for other players
      const dx = player.position.x - (this.localPlayer?.position.x || 0);
      const pan = Math.max(-1, Math.min(1, dx / 500));
      playWeaponFire(player.weapon.config.name, pan);
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
          const wasAlive = player.state.isAlive;
          const damage = player.takeDamage(projectile.damage, projectile.ownerId);

          // Track damage for shooter
          const shooter = this.squadManager.getPlayer(projectile.ownerId);
          if (shooter) {
            shooter.stats.damageDealt += damage;

            // Add floating damage number at hit location
            if (this.hud && damage > 0) {
              this.hud.addScoreAnimation(
                `-${damage}`,
                player.position.x,
                player.position.y - 30,
                '#ff6666'
              );
            }

            // Check for kill
            if (wasAlive && !player.state.isAlive) {
              shooter.stats.kills++;

              // Register kill for streak tracking
              if (this.hud && shooter === this.localPlayer) {
                this.hud.registerKill();
              }

              // Kill Feed
              const shooterName = shooter.name || 'Unknown';
              const victimName = player.name || 'Unknown';
              if (this.hud) {
                this.hud.addNotification(`${shooterName} eliminated ${victimName}`, '#ff4444');
              }

              // Spawn respawn orb
              this.spawnRespawnOrb(player.position, player.id);
            }
          }

          // Screen shake and damage indicator for local player
          if (player === this.localPlayer) {
            this.renderer.addScreenShake(5);

            // Add damage direction indicator
            if (this.hud) {
              const dx = projectile.position.x - player.position.x;
              const dy = projectile.position.y - player.position.y;
              const angle = Math.atan2(dy, dx);
              this.hud.addDamageIndicator(angle, damage / 20);
            }

            // Hit sound for local player taking damage
            playHit(damage, 0);
          }

          // Play death sound if player died
          if (wasAlive && !player.state.isAlive) {
            const dx = player.position.x - (this.localPlayer?.position.x || 0);
            const pan = Math.max(-1, Math.min(1, dx / 500));
            playSfx('death', { pan });
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
    const isArena = this.mode !== GameMode.MAIN && this.mode !== GameMode.TRAINING;
    if (isArena) return;
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
    const relic = this.relicManager.tryPickup(player.id, player.position);
    if (relic) {
      player.hasRelic = true;
      this.hud.addNotification('RELIC ACQUIRED - GO TO PLANT SITE!', '#ffd700');
      return;
    }

    // Check for planting (if carrying)
    if (player.hasRelic) {
      // Try to start planting
      const result = this.relicManager.startPlanting(player.id, player.position);
      // Actual planting update happens in checkRelicInteractions or input handling
      // For now, we just start it. The loop below updates it if logic allows.
      return;
    }

    // Check for loot pickup
    for (const loot of this.map.loot) {
      if (!loot.isActive) continue;

      if (distanceVec2(player.position, loot.position) < 30) {
        // Apply loot effect based on type
        this.applyLootEffect(player, loot);
        loot.destroy();

        // Play pickup sound
        if (player === this.localPlayer) {
          playSfx('pickup');
        }
        return;
      }
    }
  }

  /**
   * Apply the effect of a picked up loot item to a player
   */
  private applyLootEffect(player: Player, loot: Loot): void {
    const { type, itemId, quantity } = loot.lootData;

    switch (type) {
      case LootType.HEALTH: {
        const healAmount = quantity || 25;
        const actualHeal = Math.min(healAmount, player.state.maxHealth - player.state.health);
        if (actualHeal > 0) {
          player.state.health += actualHeal;
          if (this.hud && player === this.localPlayer) {
            this.hud.addScoreAnimation(`+${actualHeal} HP`, player.position.x, player.position.y - 30, '#44ff44');
          }
        }
        break;
      }

      case LootType.SHIELD: {
        const shieldAmount = quantity || 25;
        const maxShield = player.state.maxShield || 100;
        const actualShield = Math.min(shieldAmount, maxShield - player.state.shield);
        if (actualShield > 0) {
          player.state.shield += actualShield;
          if (this.hud && player === this.localPlayer) {
            this.hud.addScoreAnimation(`+${actualShield} SHIELD`, player.position.x, player.position.y - 30, '#4488ff');
          }
        }
        break;
      }

      case LootType.AMMO: {
        const ammoAmount = quantity || 30;
        // Add ammo to current weapon's reserve (simplified: just refill current mag)
        const needed = player.weapon.config.magazineSize - player.weapon.currentAmmo;
        const added = Math.min(ammoAmount, needed + player.weapon.config.magazineSize);
        player.weapon.currentAmmo = Math.min(
          player.weapon.currentAmmo + added,
          player.weapon.config.magazineSize
        );
        if (this.hud && player === this.localPlayer) {
          this.hud.addScoreAnimation(`+AMMO`, player.position.x, player.position.y - 30, '#ffaa44');
        }
        break;
      }

      case LootType.WEAPON: {
        // Switch to new weapon
        const weaponConfig = WEAPON_CONFIGS[itemId];
        if (weaponConfig) {
          player.weapon = {
            config: weaponConfig,
            currentAmmo: weaponConfig.magazineSize,
            isReloading: false,
            reloadTimer: 0,
            fireTimer: 0,
            burstCounter: 0,
            chargeLevel: 0,
          };
          if (this.hud && player === this.localPlayer) {
            this.hud.addNotification(`Picked up ${weaponConfig.name}`, '#ffffff');
          }
        }
        break;
      }

      case LootType.BACKPACK: {
        // Backpack upgrade (currently cosmetic, could affect inventory in future)
        if (this.hud && player === this.localPlayer) {
          this.hud.addNotification(`Upgraded to ${itemId} Pack`, '#aa44ff');
        }
        break;
      }
    }
  }

  private checkRelicInteractions(): void {
    const allPlayers = this.squadManager.getAllPlayers();
    const dtMs = this.fixedDt * 1000;

    // Auto-pickup for AI
    for (const player of allPlayers) {
      if (!player.state.isAlive || player.isLocalPlayer || player.hasRelic) continue;

      const relic = this.relicManager.tryPickup(player.id, player.position);
      if (relic) {
        player.hasRelic = true;
      }
    }

    // Process Planting & Delivery
    for (const player of allPlayers) {
      if (!player.state.isAlive || !player.hasRelic) {
        // If player dead/not carrying but was planting, cancel
        this.relicManager.cancelPlanting(player.id);
        continue;
      }

      // Check if player is trying to plant (Auto-plant for everyone now per user request)
      let tryingToPlant = true;
      /*
      if (!player.isLocalPlayer) {
        // AI logic: is near site?
        tryingToPlant = true; 
      } else {
        // Local player: Auto-plant (don't require input)
        // If we wanted manual: tryingToPlant = this.input.getState().interact;
        tryingToPlant = true;
      }
      */

      if (tryingToPlant) {
        // Ensure planting is started
        this.relicManager.startPlanting(player.id, player.position);

        // Update planting
        const planted = this.relicManager.updatePlanting(player.id, player.position, dtMs);
        if (planted) {
          player.hasRelic = false;
          player.stats.relicsDelivered++;
          this.squadManager.deliverRelic(player.squadId);

          // Update DeliverySite (Vault)
          this.map.deliverySite.completeDelivery();

          // Check if all relics planted
          if (this.relicManager.getPlantedCount() >= GAME_CONFIG.totalRelics) {
            // Reveal Vault and Collapse Riftline
            // Reveal Vault and Collapse Riftline
            if (this.map.deliverySite) {
              const vaultPos = this.map.deliverySite.position;
              this.riftline.forceConvergence(vaultPos);
              this.hud.addNotification("VAULT REVEALED! GET TO THE ZONE!", COLORS.vault);
            }
          }
        }
      } else {
        this.relicManager.cancelPlanting(player.id);
      }
    }

    // Drop relic if carrier dies
    for (const relic of this.relicManager.getRelics()) {
      if (relic.state !== RelicState.CARRIED) continue;

      const carrier = allPlayers.find(p => p.id === relic.carrierId);
      if (!carrier || !carrier.state.isAlive) {
        if (carrier) {
          this.relicManager.dropRelic(carrier.id, carrier.position);
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
    // For arena modes, squad elimination ends the round, not the match
    if (this.arenaRoundSystem && isArenaMode(this.mode)) {
      // Check for team elimination
      const aliveSquads = this.squadManager.getAliveSquads();

      if (aliveSquads.length === 1 && this.arenaRoundSystem.isRoundActive()) {
        // One team left standing - they win this round
        const roundWinner = aliveSquads[0].id;
        this.arenaRoundSystem.endRound(roundWinner);

        // Reset players for next round (if match not over)
        if (!this.arenaRoundSystem.isMatchOver()) {
          // We'll handle respawning in the next round start callback
          // For now, just mark that the round ended
          console.log(`[Game] Round ended, preparing for next round...`);
        }
      } else if (aliveSquads.length === 0 && this.arenaRoundSystem.isRoundActive()) {
        // Mutual elimination - tie round (handled by time expiry logic in ArenaRoundSystem)
        console.log(`[Game] Mutual elimination detected`);
      }

      // Don't proceed with normal win check for arena modes
      return;
    }

    // Standard win condition for non-arena modes
    const winner = this.squadManager.checkForWinner();
    if (winner) {
      this.isGameOver = true;
      this.winningSquadId = winner.id;
      this.phase = GamePhase.GAME_OVER;
      this.isMatchActive = false; // Allow rematch

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

    if (shouldRenderGame && (this.phase === GamePhase.PLAYING || this.phase === GamePhase.SPAWN_VOTE || this.phase === GamePhase.COUNTDOWN)) {
      // Render game world
      this.map.render(this.renderer);
      this.riftline.render(this.renderer);

      // Render respawn orbs
      for (const orb of this.respawnOrbs) {
        if (orb.isActive) {
          orb.render(this.renderer);
        }
      }

      // Render Relic Rings (Safe Zones)
      for (const ring of this.relicManager.getRelicRings()) {
        // Draw safe zone
        this.renderer.drawCircle(ring.position, ring.currentRadius, 'rgba(100, 255, 100, 0.1)', '#44ff44', 2);
      }

      // Render Vault (if active)
      if (this.vaultManager && this.vaultManager.isActive()) {
        this.vaultManager.render(this.renderer);
      }

      // Render Bubble Zones (Main mode containment)
      for (const bubble of this.bubbleZones) {
        if (bubble.state.isActive) {
          bubble.render(this.renderer);
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
        if (this.phase === GamePhase.SPAWN_VOTE && this.spawnVotingManager) {
          // Render simple voting text
          const timeRem = Math.ceil(this.spawnVotingManager.getTimeRemaining());
          this.renderer.drawScreenText(`VOTING PHASE: ${timeRem}s`, screenSize.x / 2, 100, '#ffffff', 32, 'center');
          this.renderer.drawScreenText(`Press SPACE to Fast Forward`, screenSize.x / 2, 140, '#aaaaaa', 16, 'center');

          // Draw voting locations
          for (const loc of this.spawnVotingManager.getLocations()) {
            // Use DrawCircle (World Space)
            this.renderer.drawCircle(loc.position, 20, undefined, '#00ffff', 2);
            if (loc.assignedTeams.length > 0) {
              this.renderer.drawText(`${loc.assignedTeams.length}`, loc.position, '#fff', 12, 'center');
            }
          }

        } else if (this.preGameIntelManager.isActive()) {
          // Render new Pre-Game Intel overlay
          this.preGameIntelManager.render(this.renderer, screenSize.x, screenSize.y);
        } else if (this.preGameAnimManager.isActive()) {
          // Render relic reveal animation text
          this.renderer.drawScreenText(`RELIC LOCATIONS`, screenSize.x / 2, 100, '#ffaa00', 24, 'center');
          this.renderer.drawScreenText(`Press SPACE to skip`, screenSize.x / 2, screenSize.y - 50, '#666', 14, 'center');
        } else {
          // Normal HUD
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

    // Update and render observer mode overlay
    if (this.observerController.isActive()) {
      this.observerController.setPlayers(this.squadManager.getAllPlayers());
      this.observerController.renderOverlay(this.renderer);
    }

    // Update debug stats and render overlay
    this.debugOverlay.updateStats({
      entityCount: this.squadManager.getAllPlayers().length + this.projectiles.length + this.respawnOrbs.length,
      projectileCount: this.projectiles.length,
      playerCount: this.squadManager.getAllPlayers().length,
    });
    this.debugOverlay.render(this.renderer);

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
    console.log('[Game.resetToLobby] Resetting game state');
    this.phase = GamePhase.LOBBY;
    this.isGameOver = false;
    this.winningSquadId = null;
    this.useMenuSystem = true;
    this.isMatchActive = false; // Allow new matches

    this.localPlayer = null;
    this.projectiles = [];
    this.respawnOrbs = [];
    this.aiControllers.clear();

    this.squadManager.reset();
    this.map = new GameMap();
    this.riftline = new Riftline(GAME_CONFIG.mapWidth, GAME_CONFIG.mapHeight);
    this.proximityAwareness = new ProximityAwareness();
    this.preGameIntelManager.reset();

    // Return to main menu
    this.screenManager.navigateTo(AppState.MAIN_MENU);
  }

  getPhase(): GamePhase {
    return this.phase;
  }

  isOver(): boolean {
    return this.isGameOver;
  }

  private updateEnvironmentDamage(dt: number): void {
    const allPlayers = this.squadManager.getAllPlayers();

    for (const player of allPlayers) {
      if (!player.state.isAlive || player.state.invulnerabilityTimer > 0) continue;

      const damage = this.riftline.getDamageAtPosition(player.position, dt);
      if (damage > 0) {
        const wasAlive = player.state.isAlive;
        player.takeDamage(damage);

        if (wasAlive && !player.state.isAlive) {
          // Determine cause
          const cause = 'The Riftline';
          // Feed
          this.hud.addNotification(`${player.name} fell to ${cause}`, '#ffaa44');
          player.stats.deaths++;

          // Spawn orb?
          this.spawnRespawnOrb(player.position, player.id);
        }
      }
    }
  }

  /**
   * Handle debug keyboard shortcuts
   */
  private handleDebugInput(): void {
    // F3 = Toggle Debug Overlay
    // F4 = Toggle Observer Mode
    // These are checked via keydown event since InputManager doesn't track function keys
  }

  /**
   * Set up keyboard event listener for debug keys (called once at init)
   */
  setupDebugKeyListener(): void {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'F3') {
        e.preventDefault();
        this.debugOverlay.toggle();
      }
      if (e.key === 'F4') {
        e.preventDefault();
        const allPlayers = this.squadManager.getAllPlayers();
        const mapCenter = { x: GAME_CONFIG.mapWidth / 2, y: GAME_CONFIG.mapHeight / 2 };
        this.observerController.toggle(mapCenter, allPlayers);
      }
      // Q/E for prev/next player in observer mode
      if (this.observerController.isActive()) {
        if (e.key === 'q' || e.key === 'Q') {
          this.observerController.followPrevPlayer();
        }
        if (e.key === 'e' || e.key === 'E') {
          this.observerController.followNextPlayer();
        }
        if (e.key === 'Tab') {
          e.preventDefault();
          this.observerController.cycleMode();
        }
      }
    });
  }
}
