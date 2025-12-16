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
  InputState,
} from '../types';
import { DEFAULT_CONFIG, ROLE_STATS } from '../types';
import { Camera } from './Camera';
import { InputManager } from './InputManager';
import { Renderer } from './Renderer';
import { Projectile, createProjectile, updateProjectile } from '../entities/Projectile';
import { Orb, createOrbsFromElimination, isOrbExpired, canCollectOrb } from '../entities/Orb';
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
  circlesOverlap,
  clamp,
} from '../utils/math';

export class Game {
  private canvas: HTMLCanvasElement;
  private camera: Camera;
  private inputManager: InputManager;
  private renderer: Renderer;
  private config: GameConfig;

  // Game state
  private matchState: MatchState;
  private projectiles: Projectile[] = [];
  private orbs: Orb[] = [];

  // Local player
  private localPlayerId: string | null = null;

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

    this.matchState = this.createEmptyMatchState();
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
      rings: [],
      vaultPosition: null,
      vaultRadius: 150,
    };
  }

  // Initialize a test match for single-player development
  initTestMatch(): void {
    const ms = this.matchState;
    ms.phase = 'open';

    // Create one team with one player (local)
    const teamId = 'team_local';
    const playerId = 'player_local';

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
      role: 'skirmisher',
      position: vec2(this.config.mapWidth / 2, this.config.mapHeight / 2),
      velocity: vec2(),
      rotation: 0,
      health: ROLE_STATS.skirmisher.maxHealth,
      shield: ROLE_STATS.skirmisher.maxShield,
      isAlive: true,
      respawnTimer: 0,
      weapon: this.defaultWeapon,
      orbs: 0,
      carryingRelic: null,
    };
    ms.players.set(playerId, player);
    this.localPlayerId = playerId;

    // Add some enemy teams for testing
    this.spawnTestEnemies(3);

    // Create relics and delivery sites
    this.spawnRelicsAndSites();

    // Create initial riftline ring
    ms.rings.push({
      id: 'ring_main',
      center: vec2(this.config.mapWidth / 2, this.config.mapHeight / 2),
      currentRadius: Math.max(this.config.mapWidth, this.config.mapHeight) * 0.6,
      targetRadius: 800,
      shrinkRate: 10, // units per second
      damage: 5, // damage per second
    });

    this.camera.follow(player.position);
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

    player.position = vec2Add(player.position, vec2Scale(player.velocity, deltaTime));

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

      // Random movement
      if (Math.random() < 0.02) {
        player.rotation = randomRange(0, Math.PI * 2);
      }

      const stats = ROLE_STATS[player.role];
      const speed = stats.moveSpeed * 0.5; // AI moves slower

      player.velocity = vec2FromAngle(player.rotation, speed);
      player.position = vec2Add(player.position, vec2Scale(player.velocity, deltaTime));

      // Clamp to map bounds
      player.position.x = clamp(player.position.x, stats.hitboxRadius, this.config.mapWidth - stats.hitboxRadius);
      player.position.y = clamp(player.position.y, stats.hitboxRadius, this.config.mapHeight - stats.hitboxRadius);

      // Randomly fire
      if (Math.random() < 0.01 && player.weapon) {
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

  private updateProjectiles(deltaTime: number): void {
    const toRemove: number[] = [];

    for (let i = 0; i < this.projectiles.length; i++) {
      const projectile = this.projectiles[i];

      if (!updateProjectile(projectile, deltaTime)) {
        toRemove.push(i);
        continue;
      }

      // Check collision with players
      for (const player of this.matchState.players.values()) {
        if (!player.isAlive) continue;
        if (player.teamId === projectile.teamId) continue; // No friendly fire

        const stats = ROLE_STATS[player.role];
        if (vec2Distance(projectile.position, player.position) <= stats.hitboxRadius) {
          this.damagePlayer(player, projectile.damage, projectile.ownerId);
          toRemove.push(i);
          break;
        }
      }

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
    this.renderer.render(
      this.matchState.players,
      this.matchState.teams,
      this.matchState.relics,
      this.matchState.deliverySites,
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
