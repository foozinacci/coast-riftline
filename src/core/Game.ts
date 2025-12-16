import type {
  Vector2,
  Player,
  Team,
  Relic,
  DeliverySite,
  RiftlineRing,
  MatchState,
  MatchPhase,
  Role,
  Weapon,
  GameConfig,
  Structure,
  StructureType,
  GameScreen,
} from '../types';
import { DEFAULT_CONFIG, ROLE_STATS } from '../types';
import { Camera } from './Camera';
import { InputManager } from './InputManager';
import { Renderer } from './Renderer';
import { MenuRenderer, type MenuState } from '../ui/MenuRenderer';
import { Projectile, createProjectile, updateProjectile } from '../entities/Projectile';
import { Orb, createOrbsFromElimination, isOrbExpired, canCollectOrb } from '../entities/Orb';
import { lobbyManager, type Shard, type Party } from '../lib/lobby';
import { continueAsGuest } from '../lib/auth';
import {
  vec2,
  vec2Add,
  vec2Sub,
  vec2Scale,
  vec2Normalize,
  vec2Length,
  vec2Distance,
  vec2Angle,
  vec2FromAngle,
  randomRange,
  randomInt,
  pointInCircle,
  clamp,
  getCircleRectPushVector,
  pointInRotatedRect,
} from '../utils/math';

export class Game {
  private canvas: HTMLCanvasElement;
  private camera: Camera;
  private inputManager: InputManager;
  private renderer: Renderer;
  private menuRenderer: MenuRenderer;
  private config: GameConfig;

  // Game state
  private matchState: MatchState;
  private projectiles: Projectile[] = [];
  private orbs: Orb[] = [];
  private currentScreen: GameScreen = 'landing';

  // Menu state
  private menuState: MenuState = {
    screen: 'landing',
    selectedRole: 'skirmisher',
    selectedShard: 'na-east',
    partyCode: '',
    isLoading: false,
    error: null,
    party: null,
    queueTime: 0,
    isGuest: true,
    username: 'Player',
  };

  // Local player
  private localPlayerId: string | null = null;
  private selectedRole: Role = 'skirmisher';

  // Zoom control
  private lastTapTime: number = 0;
  private readonly DOUBLE_TAP_THRESHOLD = 300;

  // Timing
  private lastTime: number = 0;
  private running: boolean = false;

  // Combat
  private lastFireTime: Map<string, number> = new Map();

  // Default weapon for testing
  private defaultWeapon: Weapon = {
    id: 'default_rifle',
    name: 'Standard Rifle',
    type: 'automatic',
    rarity: 'common',
    stats: {
      damage: 15,
      fireRate: 8, // rounds per second
      magazineSize: 30,
      reloadTime: 2,
      range: 500,
      spread: 3,
      projectileSpeed: 1200,
    },
    gridSize: { width: 4, height: 1 },
  };

  constructor(canvas: HTMLCanvasElement, config: Partial<GameConfig> = {}) {
    this.canvas = canvas;
    this.config = { ...DEFAULT_CONFIG, ...config };

    this.camera = new Camera(canvas);
    this.camera.setBounds(0, 0, this.config.mapWidth, this.config.mapHeight);
    this.camera.setZoom(1.0);

    this.inputManager = new InputManager(canvas);
    this.inputManager.onZoom((delta) => this.camera.adjustZoom(delta));

    this.renderer = new Renderer(
      canvas,
      this.camera,
      this.inputManager,
      this.config.mapWidth,
      this.config.mapHeight
    );

    this.menuRenderer = new MenuRenderer(canvas);

    this.matchState = this.createEmptyMatchState();

    // Setup click/touch handlers
    this.canvas.addEventListener('click', this.handleCanvasClick.bind(this));
    this.canvas.addEventListener('touchend', this.handleCanvasTouch.bind(this));

    // Setup lobby callbacks
    this.setupLobbyCallbacks();
  }

  private setupLobbyCallbacks(): void {
    lobbyManager.setOnPartyUpdate((party) => {
      this.menuState.party = party;
    });

    lobbyManager.setOnLobbyUpdate((lobby) => {
      if (lobby?.status === 'starting') {
        // Match is starting!
        this.initTestMatch();
      }
    });

    lobbyManager.setOnMatchStart(() => {
      this.initTestMatch();
    });
  }

  private handleCanvasTouch(e: TouchEvent): void {
    // Prevent default to avoid double-firing with click
    e.preventDefault();

    // Use the first changed touch
    if (e.changedTouches.length === 0) return;
    const touch = e.changedTouches[0];

    const rect = this.canvas.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    this.handleInteraction(x, y, rect.width, rect.height);
  }

  private handleZoomButtonTap(x: number, y: number, width: number, height: number): boolean {
    const buttonSize = 44;
    const buttonMargin = 15;
    const buttonY = 60;

    // Zoom in button (+)
    const zoomInX = width - buttonMargin - buttonSize;
    if (x >= zoomInX && x <= zoomInX + buttonSize && y >= buttonY && y <= buttonY + buttonSize) {
      this.camera.adjustZoom(0.2);
      return true;
    }

    // Zoom out button (-)
    const zoomOutX = width - buttonMargin - buttonSize * 2 - 10;
    if (x >= zoomOutX && x <= zoomOutX + buttonSize && y >= buttonY && y <= buttonY + buttonSize) {
      this.camera.adjustZoom(-0.2);
      return true;
    }

    // Double tap to reset zoom
    const now = performance.now();
    if (now - this.lastTapTime < this.DOUBLE_TAP_THRESHOLD) {
      this.camera.setZoom(1.0);
      this.lastTapTime = 0;
      return true;
    }
    this.lastTapTime = now;

    return false;
  }

  private handleCanvasClick(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    this.handleInteraction(x, y, rect.width, rect.height);
  }

  private handleInteraction(x: number, y: number, width: number, height: number): void {
    // Handle zoom buttons in match screen
    if (this.currentScreen === 'match') {
      if (this.handleZoomButtonTap(x, y, width, height)) {
        return;
      }
      return; // Don't process menu clicks during match
    }

    // Check menu button clicks
    const buttonId = this.menuRenderer.hitTest(x, y);
    if (buttonId) {
      this.handleMenuAction(buttonId);
    }
  }

  private async handleMenuAction(action: string): Promise<void> {
    console.log('Menu action:', action);

    switch (action) {
      // Landing screen
      case 'guest':
        this.menuState.isLoading = true;
        try {
          await continueAsGuest();
          this.menuState.isGuest = true;
          this.menuState.username = 'Guest_' + Math.random().toString(36).substring(2, 6).toUpperCase();
          this.currentScreen = 'menu';
          this.menuState.screen = 'menu';
        } catch (err) {
          this.menuState.error = 'Failed to start. Please try again.';
          setTimeout(() => { this.menuState.error = null; }, 3000);
        }
        this.menuState.isLoading = false;
        break;

      case 'signin':
        // For now, just go to menu (would open auth modal)
        this.currentScreen = 'menu';
        this.menuState.screen = 'menu';
        break;

      // Main menu
      case 'play':
        this.currentScreen = 'shard-select';
        this.menuState.screen = 'shard-select';
        break;

      case 'join-party':
        // Would open party code input modal
        const code = prompt('Enter party code:');
        if (code) {
          this.menuState.isLoading = true;
          const party = await lobbyManager.joinPartyByCode(code);
          if (party) {
            this.menuState.party = party;
            this.currentScreen = 'lobby';
            this.menuState.screen = 'lobby';
          } else {
            this.menuState.error = 'Party not found';
            setTimeout(() => { this.menuState.error = null; }, 3000);
          }
          this.menuState.isLoading = false;
        }
        break;

      case 'practice':
        // Start practice match immediately
        this.initTestMatch();
        break;

      case 'settings':
        // Would open settings modal
        break;

      // Shard selection
      case 'back':
        if (this.currentScreen === 'shard-select') {
          this.currentScreen = 'menu';
          this.menuState.screen = 'menu';
        } else if (this.currentScreen === 'lobby') {
          lobbyManager.leaveParty();
          this.menuState.party = null;
          this.currentScreen = 'shard-select';
          this.menuState.screen = 'shard-select';
        }
        break;

      case 'continue-shard':
        // Create/join party and go to lobby
        this.menuState.isLoading = true;
        try {
          const party = await lobbyManager.createParty();
          this.menuState.party = party;
          this.currentScreen = 'lobby';
          this.menuState.screen = 'lobby';
        } catch (err) {
          console.error('Failed to create party:', err);
        }
        this.menuState.isLoading = false;
        break;

      // Lobby
      case 'find-match':
        // Check if all ready or set self ready
        const currentParty = this.menuState.party;
        if (currentParty?.members?.every(m => m.is_ready)) {
          // All ready, start queue
          this.menuState.isLoading = true;
          const lobby = await lobbyManager.joinQueue(this.menuState.selectedShard);
          if (lobby) {
            this.currentScreen = 'queue';
            this.menuState.screen = 'queue';
            this.menuState.queueTime = 0;
          }
          this.menuState.isLoading = false;
        } else {
          // Toggle ready
          await lobbyManager.setReady(true);
          // For single player, just start the match
          if (!currentParty || (currentParty.members?.length || 0) <= 1) {
            this.initTestMatch();
          }
        }
        break;

      case 'invite':
        // Copy party code to clipboard
        if (this.menuState.party?.code) {
          navigator.clipboard?.writeText(this.menuState.party.code);
          this.menuState.error = 'Party code copied!';
          setTimeout(() => { this.menuState.error = null; }, 2000);
        }
        break;

      // Queue
      case 'cancel-queue':
        await lobbyManager.leaveQueue();
        this.currentScreen = 'lobby';
        this.menuState.screen = 'lobby';
        break;

      default:
        // Handle shard selection
        if (action.startsWith('shard-')) {
          this.menuState.selectedShard = action.replace('shard-', '') as Shard;
        }
        // Handle role selection
        if (action.startsWith('role-')) {
          const role = action.replace('role-', '') as Role;
          this.menuState.selectedRole = role;
          this.selectedRole = role;
          await lobbyManager.setRole(role);
        }
        break;
    }
  }

  private createEmptyMatchState(): MatchState {
    return {
      id: `match_${Date.now()}`,
      phase: 'waiting',
      timeElapsed: 0,
      teams: new Map(),
      players: new Map(),
      relics: new Map(),
      deliverySites: new Map(),
      structures: new Map(),
      rings: [],
      vaultPosition: null,
      vaultRadius: 150,
    };
  }

  // Screen management
  getCurrentScreen(): GameScreen {
    return this.currentScreen;
  }

  setScreen(screen: GameScreen): void {
    this.currentScreen = screen;
  }

  setSelectedRole(role: Role): void {
    this.selectedRole = role;
  }

  getSelectedRole(): Role {
    return this.selectedRole;
  }

  // Initialize a test match for single-player development
  initTestMatch(): void {
    // Reset match state completely
    this.matchState = this.createEmptyMatchState();
    this.projectiles = [];
    this.orbs = [];
    this.lastFireTime.clear();

    const ms = this.matchState;
    ms.phase = 'open';
    this.currentScreen = 'match';

    // Create one team with one player (local)
    const teamId = 'team_local';
    const playerId = 'player_local';
    const role = this.selectedRole;

    // Get role stats with fallback
    const roleStats = ROLE_STATS[role] || ROLE_STATS.skirmisher;
    const spawnX = this.config.mapWidth / 2;
    const spawnY = this.config.mapHeight / 2;

    const team: Team = {
      id: teamId,
      name: 'Local Team',
      color: '#44ff44',
      playerIds: [playerId],
      orbs: 0,
      isEliminated: false,
      relicsDelivered: 0,
    };
    ms.teams.set(teamId, team);

    const player: Player = {
      id: playerId,
      name: 'Player',
      teamId,
      role,
      position: vec2(spawnX, spawnY),
      velocity: vec2(),
      rotation: -Math.PI / 2, // Face up initially
      health: roleStats.maxHealth,
      shield: roleStats.maxShield,
      isAlive: true,
      respawnTimer: 0,
      weapon: this.defaultWeapon,
      orbs: 0,
      carryingRelic: null,
    };
    ms.players.set(playerId, player);
    this.localPlayerId = playerId;

    // Create initial riftline ring FIRST (before enemies spawn)
    // Make ring very large initially to ensure all spawns are safe
    ms.rings.push({
      id: 'ring_main',
      center: vec2(spawnX, spawnY),
      currentRadius: Math.max(this.config.mapWidth, this.config.mapHeight), // Full map size
      targetRadius: 800,
      shrinkRate: 5, // Slower shrink rate
      damage: 5, // damage per second
    });

    // Add some enemy teams for testing
    this.spawnTestEnemies(3);

    // Create relics and delivery sites
    this.spawnRelicsAndSites();

    // Create structures for cover (avoid player spawn area)
    this.spawnStructures(spawnX, spawnY);

    // Make sure player isn't stuck inside a structure
    this.resolvePlayerStructureCollisions(player.position, roleStats.hitboxRadius);

    // Set camera to follow player immediately
    this.camera.follow(player.position);
    // Also force camera position to player position immediately
    this.camera.position = { x: spawnX, y: spawnY };
    this.camera.targetPosition = { x: spawnX, y: spawnY };

    console.log('Match initialized:', {
      playerHealth: player.health,
      playerShield: player.shield,
      playerPosition: player.position,
      ringRadius: ms.rings[0].currentRadius,
    });
  }

  private spawnTestEnemies(count: number): void {
    const roles: Role[] = ['vanguard', 'skirmisher', 'sentinel', 'catalyst'];

    for (let i = 0; i < count; i++) {
      const teamId = `team_enemy_${i}`;
      const team: Team = {
        id: teamId,
        name: `Enemy ${i + 1}`,
        color: '#ff4444',
        playerIds: [],
        orbs: 0,
        isEliminated: false,
        relicsDelivered: 0,
      };

      // Add 3 players per team
      for (let j = 0; j < 3; j++) {
        const playerId = `player_enemy_${i}_${j}`;
        const role = roles[randomInt(0, roles.length - 1)];

        const player: Player = {
          id: playerId,
          name: `Enemy ${i + 1}-${j + 1}`,
          teamId,
          role,
          position: vec2(
            randomRange(200, this.config.mapWidth - 200),
            randomRange(200, this.config.mapHeight - 200)
          ),
          velocity: vec2(),
          rotation: randomRange(0, Math.PI * 2),
          health: ROLE_STATS[role].maxHealth,
          shield: ROLE_STATS[role].maxShield,
          isAlive: true,
          respawnTimer: 0,
          weapon: this.defaultWeapon,
          orbs: 0,
          carryingRelic: null,
        };

        team.playerIds.push(playerId);
        this.matchState.players.set(playerId, player);
      }

      this.matchState.teams.set(teamId, team);
    }
  }

  private spawnRelicsAndSites(): void {
    const ms = this.matchState;

    for (let i = 0; i < this.config.relicCount; i++) {
      const relicId = `relic_${i}`;
      const siteId = `site_${i}`;

      // Relic position
      const relicPos = vec2(
        randomRange(300, this.config.mapWidth - 300),
        randomRange(300, this.config.mapHeight - 300)
      );

      // Site position (different from relic)
      const sitePos = vec2(
        randomRange(300, this.config.mapWidth - 300),
        randomRange(300, this.config.mapHeight - 300)
      );

      const relic: Relic = {
        id: relicId,
        position: relicPos,
        targetSiteId: siteId,
        carriedByPlayerId: null,
        isDelivered: false,
      };

      const site: DeliverySite = {
        id: siteId,
        position: sitePos,
        radius: 60,
        acceptsRelicId: relicId,
      };

      ms.relics.set(relicId, relic);
      ms.deliverySites.set(siteId, site);
    }
  }

  private spawnStructures(playerSpawnX: number, playerSpawnY: number): void {
    const ms = this.matchState;
    const spawnSafeRadius = 150; // Keep structures away from player spawn

    // Create a grid-based layout for cover throughout the map
    const gridSize = 400; // Distance between structure clusters
    const margin = 200; // Keep structures away from map edges

    let structureId = 0;

    // Spawn structure clusters in a grid pattern
    for (let x = margin; x < this.config.mapWidth - margin; x += gridSize) {
      for (let y = margin; y < this.config.mapHeight - margin; y += gridSize) {
        // Random offset within the grid cell
        const offsetX = randomRange(-100, 100);
        const offsetY = randomRange(-100, 100);
        const centerX = x + offsetX;
        const centerY = y + offsetY;

        // Skip if too close to player spawn
        const distToSpawn = Math.sqrt(
          Math.pow(centerX - playerSpawnX, 2) + Math.pow(centerY - playerSpawnY, 2)
        );
        if (distToSpawn < spawnSafeRadius) continue;

        // Randomly decide what type of structure cluster to place
        const clusterType = randomInt(0, 4);

        switch (clusterType) {
          case 0: // L-shaped wall cover
            this.createStructure(ms, structureId++, 'wall', centerX, centerY, 120, 20, 0);
            this.createStructure(ms, structureId++, 'wall', centerX + 50, centerY + 50, 80, 20, Math.PI / 2);
            break;
          case 1: // Crate cluster
            this.createStructure(ms, structureId++, 'crate', centerX, centerY, 40, 40, 0);
            this.createStructure(ms, structureId++, 'crate', centerX + 50, centerY, 40, 40, randomRange(0, Math.PI / 4));
            this.createStructure(ms, structureId++, 'crate', centerX + 25, centerY + 45, 40, 40, randomRange(0, Math.PI / 4));
            break;
          case 2: // Single pillar
            this.createStructure(ms, structureId++, 'pillar', centerX, centerY, 50, 50, 0);
            break;
          case 3: // Small building
            this.createStructure(ms, structureId++, 'building', centerX, centerY, 100, 80, randomRange(0, Math.PI / 2));
            break;
          case 4: // Barrier line
            this.createStructure(ms, structureId++, 'barrier', centerX, centerY, 150, 15, randomRange(0, Math.PI));
            break;
        }
      }
    }

    // Add some larger structures near the center for interesting combat
    const centerX = this.config.mapWidth / 2;
    const centerY = this.config.mapHeight / 2;

    // Central structure - keep some space around player spawn
    this.createStructure(ms, structureId++, 'building', centerX + 200, centerY - 200, 120, 100, 0);
    this.createStructure(ms, structureId++, 'building', centerX - 200, centerY + 200, 120, 100, 0);
    this.createStructure(ms, structureId++, 'pillar', centerX + 150, centerY + 150, 60, 60, 0);
    this.createStructure(ms, structureId++, 'pillar', centerX - 150, centerY - 150, 60, 60, 0);
  }

  private createStructure(
    ms: MatchState,
    id: number,
    type: StructureType,
    x: number,
    y: number,
    width: number,
    height: number,
    rotation: number
  ): void {
    const healthMap: Record<StructureType, number> = {
      wall: 200,
      crate: 100,
      pillar: 300,
      building: 500,
      barrier: 150,
    };

    const structure: Structure = {
      id: `structure_${id}`,
      type,
      position: vec2(x, y),
      width,
      height,
      rotation,
      health: healthMap[type],
      maxHealth: healthMap[type],
      isDestructible: type !== 'pillar', // Pillars are indestructible
    };

    ms.structures.set(structure.id, structure);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.gameLoop();
  }

  stop(): void {
    this.running = false;
  }

  private gameLoop(): void {
    if (!this.running) return;

    const currentTime = performance.now();
    const deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.1); // Cap at 100ms
    this.lastTime = currentTime;

    this.update(deltaTime);
    this.render();

    requestAnimationFrame(() => this.gameLoop());
  }

  private update(deltaTime: number): void {
    // Update queue timer when in queue
    if (this.currentScreen === 'queue') {
      this.menuState.queueTime += deltaTime;

      // Simulate finding a match after 3-8 seconds (for demo/testing)
      if (this.menuState.queueTime > 3 + Math.random() * 5) {
        this.initTestMatch();
      }
      return;
    }

    // Only run game logic during match
    if (this.currentScreen !== 'match') {
      return;
    }

    this.matchState.timeElapsed += deltaTime;

    this.updateLocalPlayer(deltaTime);
    this.updateAI(deltaTime);
    this.updateProjectiles(deltaTime);
    this.updateOrbs(deltaTime);
    this.updateRiftline(deltaTime);
    this.updateRespawns(deltaTime);
    this.checkRelicInteractions();
    this.checkVictoryCondition();

    // Update camera to follow local player
    const localPlayer = this.localPlayerId ? this.matchState.players.get(this.localPlayerId) : null;
    if (localPlayer && localPlayer.isAlive) {
      this.camera.follow(localPlayer.position);
    }
    this.camera.update(deltaTime);
  }

  private updateLocalPlayer(deltaTime: number): void {
    const player = this.localPlayerId ? this.matchState.players.get(this.localPlayerId) : null;
    if (!player || !player.isAlive) return;

    const input = this.inputManager.getInput();
    const stats = ROLE_STATS[player.role];

    // Movement
    let speed = stats.moveSpeed;
    if (player.carryingRelic) {
      speed *= stats.relicCarrySpeed;
    }

    if (vec2Length(input.moveDirection) > 0) {
      const moveDir = vec2Normalize(input.moveDirection);
      player.velocity = vec2Scale(moveDir, speed);
    } else {
      player.velocity = vec2Scale(player.velocity, 0.85); // Friction
    }

    // Calculate new position
    const newPos = vec2Add(player.position, vec2Scale(player.velocity, deltaTime));

    // Check structure collisions
    this.resolvePlayerStructureCollisions(newPos, stats.hitboxRadius);

    player.position = newPos;

    // Clamp to map bounds
    player.position.x = clamp(player.position.x, stats.hitboxRadius, this.config.mapWidth - stats.hitboxRadius);
    player.position.y = clamp(player.position.y, stats.hitboxRadius, this.config.mapHeight - stats.hitboxRadius);

    // Rotation (aim direction or mouse)
    if (vec2Length(input.aimDirection) > 0) {
      player.rotation = vec2Angle(input.aimDirection);
    } else {
      // Use mouse position for desktop
      const mouseWorld = this.camera.screenToWorld(this.inputManager.getMousePosition());
      const toMouse = vec2Sub(mouseWorld, player.position);
      if (vec2Length(toMouse) > 10) {
        player.rotation = vec2Angle(toMouse);
      }
    }

    // Firing
    if (input.firing && player.weapon) {
      this.tryFireWeapon(player);
    }
  }

  private resolvePlayerStructureCollisions(position: { x: number; y: number }, radius: number): void {
    for (const structure of this.matchState.structures.values()) {
      // Special handling for pillars (circular)
      if (structure.type === 'pillar') {
        const dist = vec2Distance(position, structure.position);
        const minDist = radius + structure.width / 2;
        if (dist < minDist) {
          const pushDir = vec2Normalize(vec2Sub(position, structure.position));
          const pushDist = minDist - dist;
          position.x += pushDir.x * pushDist;
          position.y += pushDir.y * pushDist;
        }
      } else {
        // Rectangular structures
        const push = getCircleRectPushVector(
          position,
          radius,
          structure.position,
          structure.width,
          structure.height,
          structure.rotation
        );
        if (push) {
          position.x += push.x;
          position.y += push.y;
        }
      }
    }
  }

  private tryFireWeapon(player: Player): void {
    if (!player.weapon) return;

    const lastFire = this.lastFireTime.get(player.id) || 0;
    const fireInterval = 1000 / player.weapon.stats.fireRate;

    if (performance.now() - lastFire >= fireInterval) {
      this.lastFireTime.set(player.id, performance.now());

      // Create projectile
      const spread = (player.weapon.stats.spread * Math.PI) / 180;
      const angle = player.rotation + randomRange(-spread / 2, spread / 2);
      const direction = vec2FromAngle(angle);

      const projectile = createProjectile(
        player.id,
        player.teamId,
        vec2Add(player.position, vec2Scale(direction, ROLE_STATS[player.role].hitboxRadius + 5)),
        direction,
        player.weapon
      );

      this.projectiles.push(projectile);
    }
  }

  private updateAI(deltaTime: number): void {
    // Simple AI for test enemies
    for (const player of this.matchState.players.values()) {
      if (player.id === this.localPlayerId || !player.isAlive) continue;

      // Random movement - change direction more often if stuck
      if (Math.random() < 0.02) {
        player.rotation = randomRange(0, Math.PI * 2);
      }

      const stats = ROLE_STATS[player.role];
      const speed = stats.moveSpeed * 0.5; // AI moves slower

      player.velocity = vec2FromAngle(player.rotation, speed);

      // Calculate new position
      const newPos = vec2Add(player.position, vec2Scale(player.velocity, deltaTime));

      // Check structure collisions
      this.resolvePlayerStructureCollisions(newPos, stats.hitboxRadius);

      player.position = newPos;

      // Clamp to map bounds
      player.position.x = clamp(player.position.x, stats.hitboxRadius, this.config.mapWidth - stats.hitboxRadius);
      player.position.y = clamp(player.position.y, stats.hitboxRadius, this.config.mapHeight - stats.hitboxRadius);

      // Look towards local player if in range
      const localPlayer = this.localPlayerId ? this.matchState.players.get(this.localPlayerId) : null;
      if (localPlayer && localPlayer.isAlive) {
        const toPlayer = vec2Sub(localPlayer.position, player.position);
        const dist = vec2Length(toPlayer);
        if (dist < 500) { // Detection range
          player.rotation = vec2Angle(toPlayer);

          // Fire at player if in range
          if (Math.random() < 0.03 && player.weapon) {
            const projectile = createProjectile(
              player.id,
              player.teamId,
              vec2Add(player.position, vec2FromAngle(player.rotation, stats.hitboxRadius + 5)),
              vec2FromAngle(player.rotation),
              player.weapon
            );
            this.projectiles.push(projectile);
          }
        }
      }
    }
  }

  private updateProjectiles(deltaTime: number): void {
    const toRemove: number[] = [];

    for (let i = 0; i < this.projectiles.length; i++) {
      const projectile = this.projectiles[i];

      if (!updateProjectile(projectile, deltaTime)) {
        toRemove.push(i);
        continue;
      }

      // Check collision with players
      let hitSomething = false;
      for (const player of this.matchState.players.values()) {
        if (!player.isAlive) continue;
        if (player.teamId === projectile.teamId) continue; // No friendly fire

        const stats = ROLE_STATS[player.role];
        if (vec2Distance(projectile.position, player.position) <= stats.hitboxRadius) {
          this.damagePlayer(player, projectile.damage, projectile.ownerId);
          toRemove.push(i);
          hitSomething = true;
          break;
        }
      }

      if (hitSomething) continue;

      // Check collision with structures
      for (const structure of this.matchState.structures.values()) {
        let hit = false;

        if (structure.type === 'pillar') {
          // Circular collision for pillars
          if (vec2Distance(projectile.position, structure.position) <= structure.width / 2 + 4) {
            hit = true;
          }
        } else {
          // Rectangle collision for other structures
          if (pointInRotatedRect(
            projectile.position,
            structure.position,
            structure.width + 8, // Add projectile radius
            structure.height + 8,
            structure.rotation
          )) {
            hit = true;
          }
        }

        if (hit) {
          // Damage destructible structures
          if (structure.isDestructible) {
            structure.health -= projectile.damage;
            if (structure.health <= 0) {
              this.matchState.structures.delete(structure.id);
            }
          }
          toRemove.push(i);
          hitSomething = true;
          break;
        }
      }

      if (hitSomething) continue;

      // Check map bounds
      if (
        projectile.position.x < 0 ||
        projectile.position.x > this.config.mapWidth ||
        projectile.position.y < 0 ||
        projectile.position.y > this.config.mapHeight
      ) {
        toRemove.push(i);
      }
    }

    // Remove projectiles (reverse order to maintain indices)
    for (let i = toRemove.length - 1; i >= 0; i--) {
      this.projectiles.splice(toRemove[i], 1);
    }
  }

  private damagePlayer(player: Player, damage: number, attackerId: string): void {
    // Shield absorbs damage first
    if (player.shield > 0) {
      const shieldDamage = Math.min(player.shield, damage);
      player.shield -= shieldDamage;
      damage -= shieldDamage;
    }

    player.health -= damage;

    if (player.health <= 0) {
      this.eliminatePlayer(player, attackerId);
    }
  }

  private eliminatePlayer(player: Player, killerId: string): void {
    player.isAlive = false;
    player.health = 0;
    player.respawnTimer = this.config.baseRespawnTime;

    // Drop orbs
    const orbs = createOrbsFromElimination(player.position, this.config.orbDropCount);
    this.orbs.push(...orbs);

    // Drop relic if carrying
    if (player.carryingRelic) {
      player.carryingRelic.carriedByPlayerId = null;
      player.carryingRelic.position = { ...player.position };
      player.carryingRelic = null;
    }

    // Check if team is eliminated
    const team = this.matchState.teams.get(player.teamId);
    if (team) {
      const anyAlive = team.playerIds.some(
        (pid) => this.matchState.players.get(pid)?.isAlive
      );
      if (!anyAlive) {
        // Team might still respawn - check after respawn timers
      }
    }
  }

  private updateOrbs(deltaTime: number): void {
    // Remove expired orbs
    this.orbs = this.orbs.filter((orb) => !isOrbExpired(orb));

    // Check collection by alive players
    const toRemove: string[] = [];

    for (const orb of this.orbs) {
      for (const player of this.matchState.players.values()) {
        if (!player.isAlive) continue;

        if (canCollectOrb(orb, player.position)) {
          player.orbs++;

          const team = this.matchState.teams.get(player.teamId);
          if (team) {
            team.orbs++;
          }

          toRemove.push(orb.id);
          break;
        }
      }
    }

    this.orbs = this.orbs.filter((orb) => !toRemove.includes(orb.id));
  }

  private updateRiftline(deltaTime: number): void {
    for (const ring of this.matchState.rings) {
      // Shrink ring
      if (ring.currentRadius > ring.targetRadius) {
        ring.currentRadius = Math.max(
          ring.targetRadius,
          ring.currentRadius - ring.shrinkRate * deltaTime
        );
      }

      // Damage players outside ring
      for (const player of this.matchState.players.values()) {
        if (!player.isAlive) continue;

        const insideAnyRing = this.matchState.rings.some((r) =>
          pointInCircle(player.position, r.center, r.currentRadius)
        );

        if (!insideAnyRing) {
          this.damagePlayer(player, ring.damage * deltaTime, 'riftline');
        }
      }
    }
  }

  private updateRespawns(deltaTime: number): void {
    for (const player of this.matchState.players.values()) {
      if (player.isAlive || player.respawnTimer <= 0) continue;

      const team = this.matchState.teams.get(player.teamId);
      if (!team) continue;

      // Apply orb reduction
      const reduction = team.orbs * this.config.orbRespawnReduction;
      const effectiveTimer = player.respawnTimer - reduction;

      player.respawnTimer -= deltaTime;

      // Check respawn
      if (player.respawnTimer <= 0 || effectiveTimer <= 0) {
        // Find a living teammate to spawn near
        const livingTeammate = team.playerIds
          .map((pid) => this.matchState.players.get(pid))
          .find((p) => p && p.isAlive && p.id !== player.id);

        if (livingTeammate) {
          // Respawn near teammate
          const spawnOffset = vec2FromAngle(randomRange(0, Math.PI * 2), 100);
          player.position = vec2Add(livingTeammate.position, spawnOffset);
          player.isAlive = true;
          player.health = ROLE_STATS[player.role].maxHealth;
          player.shield = ROLE_STATS[player.role].maxShield;
          player.respawnTimer = 0;
        } else {
          // No living teammates - team eliminated
          team.isEliminated = true;
        }
      }
    }
  }

  private checkRelicInteractions(): void {
    const localPlayer = this.localPlayerId ? this.matchState.players.get(this.localPlayerId) : null;
    if (!localPlayer || !localPlayer.isAlive) return;

    const input = this.inputManager.getInput();

    // Pickup relic
    if (!localPlayer.carryingRelic) {
      for (const relic of this.matchState.relics.values()) {
        if (relic.carriedByPlayerId || relic.isDelivered) continue;

        if (vec2Distance(localPlayer.position, relic.position) < 50) {
          relic.carriedByPlayerId = localPlayer.id;
          localPlayer.carryingRelic = relic;
          break;
        }
      }
    }

    // Deliver relic
    if (localPlayer.carryingRelic) {
      const relic = localPlayer.carryingRelic;
      const targetSite = this.matchState.deliverySites.get(relic.targetSiteId);

      if (targetSite && vec2Distance(localPlayer.position, targetSite.position) < targetSite.radius) {
        relic.isDelivered = true;
        relic.carriedByPlayerId = null;
        localPlayer.carryingRelic = null;

        const team = this.matchState.teams.get(localPlayer.teamId);
        if (team) {
          team.relicsDelivered++;
        }
      }
    }
  }

  private checkVictoryCondition(): void {
    const deliveredCount = Array.from(this.matchState.relics.values()).filter(
      (r) => r.isDelivered
    ).length;

    // All relics delivered -> convergence phase
    if (
      deliveredCount >= this.config.relicCount &&
      this.matchState.phase !== 'convergence' &&
      this.matchState.phase !== 'ended'
    ) {
      this.matchState.phase = 'convergence';
      this.matchState.vaultPosition = vec2(
        randomRange(500, this.config.mapWidth - 500),
        randomRange(500, this.config.mapHeight - 500)
      );

      // Update rings to converge on vault
      for (const ring of this.matchState.rings) {
        ring.center = this.matchState.vaultPosition;
        ring.targetRadius = this.matchState.vaultRadius;
        ring.shrinkRate = 30;
      }
    }

    // Check for last team standing
    const aliveTeams = Array.from(this.matchState.teams.values()).filter(
      (t) => !t.isEliminated
    );

    if (aliveTeams.length <= 1 && this.matchState.phase !== 'ended') {
      this.matchState.phase = 'ended';
      // Winner logic here
    }
  }

  private render(): void {
    // If on a menu screen, use MenuRenderer
    if (this.currentScreen !== 'match' && this.currentScreen !== 'results') {
      const deltaTime = 1 / 60; // Approximate
      this.menuRenderer.render(this.menuState, deltaTime);
      return;
    }

    this.renderer.render(
      this.matchState.players,
      this.matchState.teams,
      this.matchState.relics,
      this.matchState.deliverySites,
      this.matchState.structures,
      this.matchState.rings,
      this.matchState.vaultPosition,
      this.matchState.vaultRadius,
      this.localPlayerId,
      this.matchState.phase
    );

    // Render projectiles
    this.renderProjectiles();

    // Render orbs
    this.renderOrbs();
  }

  private renderLandingPage(): void {
    const ctx = this.canvas.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    const width = this.canvas.width / dpr;
    const height = this.canvas.height / dpr;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, width, height);

    // Draw grid lines in background
    ctx.strokeStyle = '#1a1a25';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 50) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Title
    ctx.fillStyle = '#00f7ff';
    ctx.font = 'bold 48px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('RIFTLINE', width / 2, height * 0.2);

    // Subtitle
    ctx.fillStyle = '#888899';
    ctx.font = '16px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('Squad Battle Royale', width / 2, height * 0.2 + 40);

    // Role selection
    const roles: Role[] = ['vanguard', 'skirmisher', 'sentinel', 'catalyst'];
    const roleDescriptions: Record<Role, string> = {
      vanguard: 'Tank - High HP, Slow, Large Hitbox',
      skirmisher: 'Balanced - Medium Stats All Around',
      sentinel: 'Scout - Low HP, Fast, Small Hitbox',
      catalyst: 'Support - Medium HP, Medium Speed',
    };

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('SELECT ROLE', width / 2, height * 0.4);

    const buttonWidth = 200;
    const buttonHeight = 60;
    const buttonSpacing = 20;
    const totalWidth = (buttonWidth + buttonSpacing) * roles.length - buttonSpacing;
    const startX = (width - totalWidth) / 2;

    roles.forEach((role, index) => {
      const x = startX + index * (buttonWidth + buttonSpacing);
      const y = height * 0.5;
      const isSelected = role === this.selectedRole;

      // Button background
      ctx.fillStyle = isSelected ? '#00f7ff' : '#1a1a25';
      ctx.fillRect(x, y, buttonWidth, buttonHeight);

      // Button border
      ctx.strokeStyle = isSelected ? '#00f7ff' : '#333344';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, buttonWidth, buttonHeight);

      // Role name
      ctx.fillStyle = isSelected ? '#0a0a0f' : '#ffffff';
      ctx.font = 'bold 14px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(role.toUpperCase(), x + buttonWidth / 2, y + 20);

      // Role stats
      const stats = ROLE_STATS[role];
      ctx.fillStyle = isSelected ? '#0a0a0f' : '#888899';
      ctx.font = '10px "Segoe UI", system-ui, sans-serif';
      ctx.fillText(`HP: ${stats.maxHealth} SPD: ${stats.moveSpeed}`, x + buttonWidth / 2, y + 40);
    });

    // Play button
    const playButtonWidth = 300;
    const playButtonHeight = 60;
    const playX = (width - playButtonWidth) / 2;
    const playY = height * 0.75;

    ctx.fillStyle = '#00ff88';
    ctx.fillRect(playX, playY, playButtonWidth, playButtonHeight);

    ctx.fillStyle = '#0a0a0f';
    ctx.font = 'bold 24px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('START MATCH', width / 2, playY + playButtonHeight / 2 + 8);

    // Instructions
    ctx.fillStyle = '#666677';
    ctx.font = '12px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('Click a role to select, then click START MATCH', width / 2, height * 0.9);
    ctx.fillText('Controls: WASD to move, Mouse to aim & click to shoot', width / 2, height * 0.9 + 20);
  }

  private renderProjectiles(): void {
    const ctx = this.canvas.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    this.camera.applyTransform(ctx);

    ctx.fillStyle = '#ffff00';
    for (const projectile of this.projectiles) {
      ctx.beginPath();
      ctx.arc(projectile.position.x, projectile.position.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  private renderOrbs(): void {
    const ctx = this.canvas.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    this.camera.applyTransform(ctx);

    for (const orb of this.orbs) {
      // Glow
      const gradient = ctx.createRadialGradient(
        orb.position.x,
        orb.position.y,
        0,
        orb.position.x,
        orb.position.y,
        20
      );
      gradient.addColorStop(0, 'rgba(0, 247, 255, 0.6)');
      gradient.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(orb.position.x, orb.position.y, 20, 0, Math.PI * 2);
      ctx.fill();

      // Core
      ctx.fillStyle = '#00f7ff';
      ctx.beginPath();
      ctx.arc(orb.position.x, orb.position.y, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  // Public API
  getMatchState(): MatchState {
    return this.matchState;
  }

  getLocalPlayer(): Player | null {
    return this.localPlayerId ? this.matchState.players.get(this.localPlayerId) || null : null;
  }
}
