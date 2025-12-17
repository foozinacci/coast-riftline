// Player entity

import { Entity } from './Entity';
import {
  Vector2,
  EntityType,
  PlayerClass,
  WeaponConfig,
  BackpackTier,
  InputState,
  MatchStats,
} from '../core/types';
import {
  vec2,
  addVec2,
  mulVec2,
  normalizeVec2,
  lengthVec2,
  angleVec2,
  fromAngle,
  clamp,
  degToRad,
  randomRange,
} from '../core/utils';
import { CLASS_CONFIGS, WEAPON_CONFIGS, BACKPACK_CONFIGS, COLORS, GAME_CONFIG } from '../core/constants';
import { Renderer } from '../core/renderer';

export interface PlayerState {
  health: number;
  maxHealth: number;
  shield: number;
  maxShield: number;
  isAlive: boolean;
  respawnTimer: number;
  invulnerabilityTimer: number;
}

export interface WeaponState {
  config: WeaponConfig;
  currentAmmo: number;
  isReloading: boolean;
  reloadTimer: number;
  fireTimer: number;
  burstCounter: number;
  chargeLevel: number; // 0-1 for charge weapons
}

export class Player extends Entity {
  // Identity
  squadId: string;
  name: string; // Display name
  playerClass: PlayerClass;
  color: string;
  isLocalPlayer: boolean;

  // State
  state: PlayerState;
  weapon: WeaponState;
  backpackTier: BackpackTier;

  // Movement
  moveSpeed: number;
  aimDirection: Vector2;

  // Relic carrying
  hasRelic: boolean;
  relicRevealTimer: number;

  // Respawn orbs
  orbCount: number;

  // Statistics
  stats: MatchStats;

  // Visual
  bodyRadius: number;
  lastDamageTime: number;

  // Dash ability
  maxDashes: number;
  dashCharges: number;
  dashCooldown: number;      // Time to regenerate one dash (ms)
  dashRegenTimer: number;    // Countdown to next dash recharge
  isDashing: boolean;
  dashTimer: number;         // Current dash duration timer
  dashDirection: Vector2;    // Direction of current dash
  dashSpeed: number;         // Speed multiplier during dash

  // Tactical ability
  tacticalCooldown: number;  // Total cooldown (ms)
  tacticalTimer: number;     // Current cooldown timer
  tacticalActive: boolean;   // Is ability currently active?
  tacticalDuration: number;  // How long ability lasts (if applicable)

  constructor(
    x: number,
    y: number,
    squadId: string,
    playerClass: PlayerClass,
    color: string,
    isLocalPlayer: boolean = false
  ) {
    super(EntityType.PLAYER, x, y);

    this.squadId = squadId;
    this.playerClass = playerClass;
    this.color = color;
    this.isLocalPlayer = isLocalPlayer;

    // Generate simple name
    if (isLocalPlayer) {
      this.name = 'YOU';
    } else {
      const idShort = Math.floor(Math.random() * 1000);
      this.name = `${playerClass.substring(0, 3).toUpperCase()}-${idShort}`;
    }

    const classConfig = CLASS_CONFIGS[playerClass];
    this.moveSpeed = classConfig.moveSpeed;
    this.aimDirection = vec2(1, 0);
    this.bodyRadius = 18;
    this.radius = this.bodyRadius;

    // Initialize state
    this.state = {
      health: classConfig.baseHealth,
      maxHealth: classConfig.baseHealth,
      shield: classConfig.baseShield,
      maxShield: classConfig.baseShield,
      isAlive: true,
      respawnTimer: 0,
      invulnerabilityTimer: 0,
    };

    // Initialize weapon
    const weaponKey = this.getDefaultWeaponForClass(playerClass);
    const weaponConfig = WEAPON_CONFIGS[weaponKey];
    this.weapon = {
      config: weaponConfig,
      currentAmmo: weaponConfig.magazineSize,
      isReloading: false,
      reloadTimer: 0,
      fireTimer: 0,
      burstCounter: 0,
      chargeLevel: 0,
    };

    this.backpackTier = BackpackTier.BASIC;
    this.hasRelic = false;
    this.relicRevealTimer = 0;
    this.orbCount = 0;
    this.lastDamageTime = 0;

    // Initialize dash ability from class config
    this.maxDashes = classConfig.dashes;
    this.dashCharges = classConfig.dashes;
    this.dashCooldown = 3000; // 3 seconds per dash recharge
    this.dashRegenTimer = 0;
    this.isDashing = false;
    this.dashTimer = 0;
    this.dashDirection = vec2(0, 0);
    this.dashSpeed = 3.0; // 3x speed during dash

    // Initialize tactical ability
    this.tacticalCooldown = this.getTacticalCooldown(playerClass);
    this.tacticalTimer = 0;
    this.tacticalActive = false;
    this.tacticalDuration = 0;

    this.stats = {
      kills: 0,
      deaths: 0,
      damageDealt: 0,
      relicsDelivered: 0,
      orbsCollected: 0,
      respawnsUsed: 0,
    };
  }

  private getTacticalCooldown(playerClass: PlayerClass): number {
    switch (playerClass) {
      case PlayerClass.SCOUT: return 15000;     // 15s - Momentum Trail
      case PlayerClass.VANGUARD: return 20000;  // 20s - Build Cover
      case PlayerClass.MEDIC: return 12000;     // 12s - Shared Heals
      case PlayerClass.SCAVENGER: return 25000; // 25s - Orb Team Buff
      default: return 15000;
    }
  }

  private getDefaultWeaponForClass(playerClass: PlayerClass): string {
    switch (playerClass) {
      case PlayerClass.SCOUT:
        return 'auto_common';
      case PlayerClass.VANGUARD:
        return 'auto_common'; // Vanguard uses SMG/Auto
      case PlayerClass.MEDIC:
        return 'semi_common';
      case PlayerClass.SCAVENGER:
        return 'burst_common';
      default:
        return 'auto_common';
    }
  }

  update(dt: number): void {
    if (!this.state.isAlive) {
      if (this.state.respawnTimer > 0) {
        this.state.respawnTimer -= dt * 1000;
      }
      return;
    }

    // Update invulnerability
    if (this.state.invulnerabilityTimer > 0) {
      this.state.invulnerabilityTimer -= dt * 1000;
    }

    // Update relic reveal timer
    if (this.hasRelic && this.relicRevealTimer > 0) {
      this.relicRevealTimer -= dt * 1000;
    }

    // Update dash ability
    this.updateDash(dt);

    // Update tactical ability cooldown
    this.updateTactical(dt);

    // Update weapon state
    this.updateWeapon(dt);

    // Apply movement (dash overrides normal movement)
    if (this.isDashing) {
      // During dash, move in dash direction at high speed
      const dashMoveSpeed = this.moveSpeed * this.dashSpeed;
      this.position = addVec2(this.position, mulVec2(this.dashDirection, dashMoveSpeed * dt));
    } else {
      const effectiveSpeed = this.getEffectiveSpeed();
      this.position = addVec2(this.position, mulVec2(this.velocity, effectiveSpeed * dt));
    }

    // Update rotation to match aim
    this.rotation = angleVec2(this.aimDirection);
  }

  private updateWeapon(dt: number): void {
    // Handle reload
    if (this.weapon.isReloading) {
      this.weapon.reloadTimer -= dt * 1000;
      if (this.weapon.reloadTimer <= 0) {
        this.weapon.currentAmmo = this.weapon.config.magazineSize;
        this.weapon.isReloading = false;
      }
    }

    // Handle fire cooldown
    if (this.weapon.fireTimer > 0) {
      this.weapon.fireTimer -= dt * 1000;
    }
  }

  private updateDash(dt: number): void {
    // Update active dash
    if (this.isDashing) {
      this.dashTimer -= dt * 1000;
      if (this.dashTimer <= 0) {
        this.isDashing = false;
        this.dashTimer = 0;
      }
    }

    // Regenerate dash charges
    if (this.dashCharges < this.maxDashes) {
      this.dashRegenTimer -= dt * 1000;
      if (this.dashRegenTimer <= 0) {
        this.dashCharges++;
        this.dashRegenTimer = this.dashCooldown;
      }
    }
  }

  private updateTactical(dt: number): void {
    // Cool down tactical
    if (this.tacticalTimer > 0) {
      this.tacticalTimer -= dt * 1000;
    }

    // Update active tactical effect
    if (this.tacticalActive && this.tacticalDuration > 0) {
      this.tacticalDuration -= dt * 1000;
      if (this.tacticalDuration <= 0) {
        this.tacticalActive = false;
      }
    }
  }

  /**
   * Attempt to dash in the current movement direction
   * @returns true if dash was successful
   */
  dash(): boolean {
    if (this.isDashing) return false;
    if (this.dashCharges <= 0) return false;
    if (!this.state.isAlive) return false;

    // Use a dash charge
    this.dashCharges--;

    // Start dash - use current velocity direction or aim direction if not moving
    const moveLength = lengthVec2(this.velocity);
    if (moveLength > 0.1) {
      this.dashDirection = normalizeVec2(this.velocity);
    } else {
      this.dashDirection = normalizeVec2(this.aimDirection);
    }

    this.isDashing = true;
    this.dashTimer = 150; // 150ms dash duration

    // Start regen timer if not already running
    if (this.dashRegenTimer <= 0) {
      this.dashRegenTimer = this.dashCooldown;
    }

    return true;
  }

  /**
   * Check if dash is available
   */
  canDash(): boolean {
    return this.dashCharges > 0 && !this.isDashing && this.state.isAlive;
  }

  /**
   * Attempt to use the tactical ability
   * @returns true if tactical was activated
   */
  useTactical(): boolean {
    if (this.tacticalTimer > 0) return false;
    if (!this.state.isAlive) return false;

    // Activate tactical
    this.tacticalTimer = this.tacticalCooldown;
    this.tacticalActive = true;

    // Set duration based on class
    switch (this.playerClass) {
      case PlayerClass.SCOUT:
        // Momentum Trail - leaves speed boost trail for 5s
        this.tacticalDuration = 5000;
        break;
      case PlayerClass.VANGUARD:
        // Build Cover - instant, no duration
        this.tacticalDuration = 0;
        this.tacticalActive = false;
        // TODO: Spawn cover at position
        break;
      case PlayerClass.MEDIC:
        // Shared Heals - heals nearby allies for 3s
        this.tacticalDuration = 3000;
        break;
      case PlayerClass.SCAVENGER:
        // Orb Team Buff - instant orb bonus
        this.tacticalDuration = 0;
        this.tacticalActive = false;
        break;
      default:
        this.tacticalDuration = 0;
    }

    console.log(`${this.name} used tactical ability!`);
    return true;
  }

  /**
   * Check if tactical ability is ready
   */
  isTacticalReady(): boolean {
    return this.tacticalTimer <= 0 && this.state.isAlive;
  }

  /**
   * Get tactical cooldown progress (0-1, 1 = ready)
   */
  getTacticalProgress(): number {
    if (this.tacticalTimer <= 0) return 1;
    return 1 - (this.tacticalTimer / this.tacticalCooldown);
  }

  getEffectiveSpeed(): number {
    let speed = this.moveSpeed;

    // Backpack penalty
    const backpackConfig = BACKPACK_CONFIGS[this.backpackTier];
    speed *= 1 - backpackConfig.moveSpeedPenalty;

    // Relic penalty
    if (this.hasRelic) {
      speed *= 0.85;
    }

    return speed;
  }

  handleInput(input: InputState): void {
    if (!this.state.isAlive) return;

    // Movement
    this.velocity = input.moveDirection;

    // Aim direction
    if (lengthVec2(input.aimDirection) > 0) {
      this.aimDirection = normalizeVec2(input.aimDirection);
    }
  }

  canFire(): boolean {
    return (
      this.state.isAlive &&
      !this.weapon.isReloading &&
      this.weapon.fireTimer <= 0 &&
      this.weapon.currentAmmo > 0
    );
  }

  fire(): { direction: Vector2; spread: number } | null {
    if (!this.canFire()) return null;

    // Calculate spread (Default 0 if not in config, or fixed value)
    const spread = 0; // Removed from config for now
    const spreadRad = degToRad(spread);
    const spreadAngle = randomRange(-spreadRad / 2, spreadRad / 2);
    const direction = fromAngle(angleVec2(this.aimDirection) + spreadAngle);

    // Consume ammo
    this.weapon.currentAmmo--;

    // Set fire cooldown
    const fireInterval = 1000 / this.weapon.config.fireRate;
    this.weapon.fireTimer = fireInterval;

    // Handle burst weapons
    if (this.weapon.config.burstCount && this.weapon.config.burstCount > 1) {
      this.weapon.burstCounter++;
      if (this.weapon.burstCounter >= this.weapon.config.burstCount) {
        this.weapon.burstCounter = 0;
        this.weapon.fireTimer = this.weapon.config.burstDelay || (fireInterval * 3);
      } else {
        this.weapon.fireTimer = fireInterval; // Standard fire rate is now the "fast" internal burst rate
        // Wait, fireRate in config usually means "cycle rate".
        // For burst, we traditionally have fireRate as the bust cycle, or the bullet cycle.
        // User spec: "Fire Rate 2 bursts/sec" vs "Fire Rate 6 bullets/sec".
        // Config: "Fire Rate 2", "Burst Count 3", "Burst Delay ?"
        // I will trust the config `burstDelay` I added.
      }
    }

    return {
      direction,
      spread,
    };
  }

  reload(): void {
    if (
      this.weapon.isReloading ||
      this.weapon.currentAmmo === this.weapon.config.magazineSize
    ) {
      return;
    }

    this.weapon.isReloading = true;
    this.weapon.reloadTimer = this.weapon.config.reloadTime;
  }

  takeDamage(amount: number, attackerId?: string): number {
    if (!this.state.isAlive || this.state.invulnerabilityTimer > 0) return 0;

    let remaining = amount;
    let actualDamage = 0;

    // Damage shield first
    if (this.state.shield > 0) {
      const shieldDamage = Math.min(this.state.shield, remaining);
      this.state.shield -= shieldDamage;
      remaining -= shieldDamage;
      actualDamage += shieldDamage;
    }

    // Then damage health
    if (remaining > 0) {
      const healthDamage = Math.min(this.state.health, remaining);
      this.state.health -= healthDamage;
      actualDamage += healthDamage;
    }

    this.lastDamageTime = Date.now();

    // Check for death
    if (this.state.health <= 0) {
      this.die();
    }

    return actualDamage;
  }

  die(): void {
    this.state.isAlive = false;
    this.state.health = 0;
    this.state.shield = 0;
    this.stats.deaths++;

    // Start respawn timer (prevents immediate squad elimination)
    this.state.respawnTimer = GAME_CONFIG.respawnBaseCooldown;

    // Drop relic if carrying
    if (this.hasRelic) {
      this.hasRelic = false;
      // Relic drop handled by game state
    }
  }

  respawn(x: number, y: number, respawnCooldown: number): void {
    this.position = { x, y };
    this.velocity = vec2();

    const classConfig = CLASS_CONFIGS[this.playerClass];

    this.state = {
      health: classConfig.baseHealth,
      maxHealth: classConfig.baseHealth,
      shield: classConfig.baseShield,
      maxShield: classConfig.baseShield,
      isAlive: true,
      respawnTimer: respawnCooldown,
      invulnerabilityTimer: 2000, // 2 seconds of invulnerability
    };

    // Reset to default weapon
    const weaponKey = this.getDefaultWeaponForClass(this.playerClass);
    const weaponConfig = WEAPON_CONFIGS[weaponKey];
    this.weapon = {
      config: weaponConfig,
      currentAmmo: weaponConfig.magazineSize,
      isReloading: false,
      reloadTimer: 0,
      fireTimer: 0,
      burstCounter: 0,
      chargeLevel: 0,
    };

    // Reset backpack to basic
    this.backpackTier = BackpackTier.BASIC;

    this.stats.respawnsUsed++;
  }

  collectOrb(value: number): void {
    this.orbCount++;
    this.stats.orbsCollected++;
    // Orb value used to reduce team respawn times
  }

  render(renderer: Renderer): void {
    if (!this.state.isAlive) return;

    const pos = this.position;

    // Draw body shadow
    renderer.drawCircle(
      { x: pos.x + 3, y: pos.y + 3 },
      this.bodyRadius,
      'rgba(0, 0, 0, 0.3)'
    );

    // Draw body
    const bodyColor = this.state.invulnerabilityTimer > 0
      ? this.blinkColor(this.color)
      : this.color;
    renderer.drawCircle(pos, this.bodyRadius, bodyColor, '#ffffff', 2);

    // Local player indicator (helps on mobile)
    if (this.isLocalPlayer) {
      renderer.drawCircle(pos, this.bodyRadius + 6, 'rgba(0, 0, 0, 0)', '#ffffff', 2);
    }

    // Draw aim direction indicator
    const aimLength = 30;
    const aimEnd = addVec2(pos, mulVec2(this.aimDirection, aimLength));
    renderer.drawLine(pos, aimEnd, '#ffffff', 3);

    // Draw class indicator
    const classSymbol = this.getClassSymbol();
    renderer.drawText(classSymbol, pos, '#ffffff', 14);

    // Draw health/shield bars above player
    const barY = pos.y - this.bodyRadius - 15;
    const barWidth = 40;
    const barHeight = 4;

    // Shield bar
    if (this.state.maxShield > 0) {
      renderer.drawBar(
        { x: pos.x, y: barY - 6 },
        barWidth,
        barHeight,
        this.state.shield,
        this.state.maxShield,
        COLORS.shieldBar
      );
    }

    // Health bar
    renderer.drawBar(
      { x: pos.x, y: barY },
      barWidth,
      barHeight,
      this.state.health,
      this.state.maxHealth,
      COLORS.healthBar
    );

    // Draw relic indicator
    if (this.hasRelic) {
      renderer.drawCircle(
        { x: pos.x, y: pos.y - this.bodyRadius - 25 },
        6,
        COLORS.relic,
        '#ffffff',
        1
      );
    }

    // Draw reload indicator
    if (this.weapon.isReloading) {
      const reloadProgress =
        1 - this.weapon.reloadTimer / this.weapon.config.reloadTime;
      renderer.drawBar(
        { x: pos.x, y: pos.y + this.bodyRadius + 10 },
        30,
        3,
        reloadProgress,
        1,
        '#ffaa00'
      );
    }
  }

  private blinkColor(color: string): string {
    const blink = Math.sin(Date.now() * 0.02) > 0;
    return blink ? color : '#ffffff';
  }

  private getClassSymbol(): string {
    switch (this.playerClass) {
      case PlayerClass.SCOUT:
        return 'S';
      case PlayerClass.VANGUARD:
        return 'V';
      case PlayerClass.MEDIC:
        return 'M';
      case PlayerClass.SCAVENGER:
        return '$';
      default:
        return '?';
    }
  }
}
