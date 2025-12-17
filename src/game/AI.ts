// AI Bot System - for testing and single player

import { Vector2, PlayerClass, TrainingDifficulty } from '../core/types';
import {
  distanceVec2,
  subVec2,
  normalizeVec2,
  addVec2,
  mulVec2,
  randomRange,
  angleVec2,
} from '../core/utils';
import { Player } from '../entities/Player';
import { Relic, RelicState } from '../entities/Relic';
import { RespawnOrb } from '../entities/RespawnOrb';
import { Loot } from '../entities/Loot';
import { DeliverySite } from '../entities/DeliverySite';

export enum AIState {
  IDLE = 'idle',
  ROAMING = 'roaming',
  ENGAGING = 'engaging',
  RETREATING = 'retreating',
  COLLECTING_RELIC = 'collecting_relic',
  DELIVERING_RELIC = 'delivering_relic',
  COLLECTING_ORB = 'collecting_orb',
  LOOTING = 'looting',
}

interface AIContext {
  enemies: Player[];
  teammates: Player[];
  relics: Relic[];
  orbs: RespawnOrb[];
  loot: Loot[];
  deliverySite: DeliverySite;
  riftlineCenter: Vector2;
  riftlineRadius: number;
}

export class AIController {
  private player: Player;
  private state: AIState;
  private targetPosition: Vector2 | null;
  private targetEnemy: Player | null;
  private stateTimer: number;
  private nextDecisionTime: number;
  private reactionTime: number;
  private accuracy: number;
  private aggressiveness: number;
  private coordination: number; // 0-1, likelihood of sticking to team/objectives

  constructor(player: Player, difficulty: TrainingDifficulty = TrainingDifficulty.MEDIUM) {
    this.player = player;
    this.state = AIState.IDLE;
    this.targetPosition = null;
    this.targetEnemy = null;
    this.targetEnemy = null;
    this.stateTimer = 0;
    this.nextDecisionTime = 0;

    // Tune AI based on difficulty spec
    switch (difficulty) {
      case TrainingDifficulty.EASY:
        this.reactionTime = 800; // Slow
        this.accuracy = 0.2; // Poor
        this.aggressiveness = 0.2; // Passive
        this.coordination = 0.1; // Minimal
        break;
      case TrainingDifficulty.MEDIUM:
        this.reactionTime = 400; // Normal
        this.accuracy = 0.5; // Decent
        this.aggressiveness = 0.5; // Balanced
        this.coordination = 0.5; // Loose
        break;
      case TrainingDifficulty.HARD:
        this.reactionTime = 150; // Fast
        this.accuracy = 0.85; // Strong
        this.aggressiveness = 0.9; // High pressure
        this.coordination = 0.9; // Focus fire/Flanking logic enabled
        break;
    }
  }

  update(dt: number, context: AIContext): { fire: boolean; reload: boolean } {
    const dtMs = dt * 1000;
    this.stateTimer -= dtMs;

    const result = { fire: false, reload: false };

    if (!this.player.state.isAlive) {
      return result;
    }

    // Check for state transitions (throttled by reaction time)
    this.nextDecisionTime -= dtMs;
    if (this.nextDecisionTime <= 0) {
      this.evaluateState(context);
      this.nextDecisionTime = this.reactionTime * (0.8 + Math.random() * 0.4); // Add variance
    }

    // Execute current state behavior
    switch (this.state) {
      case AIState.IDLE:
        this.executeIdle(dt);
        break;
      case AIState.ROAMING:
        this.executeRoaming(dt, context);
        break;
      case AIState.ENGAGING:
        result.fire = this.executeEngaging(dt, context);
        break;
      case AIState.RETREATING:
        this.executeRetreating(dt, context);
        break;
      case AIState.COLLECTING_RELIC:
        this.executeCollectingRelic(dt, context);
        break;
      case AIState.DELIVERING_RELIC:
        this.executeDeliveringRelic(dt, context);
        break;
      case AIState.COLLECTING_ORB:
        this.executeCollectingOrb(dt, context);
        break;
      case AIState.LOOTING:
        this.executeLooting(dt, context);
        break;
    }

    // Check for reload
    if (this.player.weapon.currentAmmo < this.player.weapon.config.magazineSize * 0.3) {
      if (this.state !== AIState.ENGAGING || !this.targetEnemy) {
        result.reload = true;
      }
    }

    return result;
  }

  private evaluateState(context: AIContext): void {
    const pos = this.player.position;

    // Priority 1: Stay in safe zone
    const distToCenter = distanceVec2(pos, context.riftlineCenter);
    if (distToCenter > context.riftlineRadius - 100) {
      if (this.state !== AIState.RETREATING) {
        this.state = AIState.RETREATING;
        this.targetPosition = context.riftlineCenter;
      }
      return;
    }

    // Priority 2: Deliver relic if carrying
    if (this.player.hasRelic) {
      this.state = AIState.DELIVERING_RELIC;
      return;
    }

    // Priority 3: Engage nearby enemies
    const nearestEnemy = this.findNearestEnemy(context.enemies);
    if (nearestEnemy && distanceVec2(pos, nearestEnemy.position) < 400) {
      // Health check - retreat if low
      const healthPercent =
        (this.player.state.health + this.player.state.shield) /
        (this.player.state.maxHealth + this.player.state.maxShield);

      if (healthPercent < 0.3) {
        this.state = AIState.RETREATING;
        this.targetEnemy = nearestEnemy;
        return;
      }

      if (Math.random() < this.aggressiveness || this.state === AIState.ENGAGING) {
        this.state = AIState.ENGAGING;
        this.targetEnemy = nearestEnemy;
        return;
      }
    }

    // Priority 4: Collect nearby orbs
    const nearestOrb = this.findNearest(context.orbs);
    if (nearestOrb && distanceVec2(pos, nearestOrb.position) < 200) {
      this.state = AIState.COLLECTING_ORB;
      this.targetPosition = nearestOrb.position;
      return;
    }

    // Priority 5: Collect relics
    const availableRelic = context.relics.find(
      r => r.state === RelicState.AVAILABLE
    );
    if (availableRelic && distanceVec2(pos, availableRelic.position) < 600) {
      this.state = AIState.COLLECTING_RELIC;
      this.targetPosition = availableRelic.position;
      return;
    }

    // Priority 6: Loot nearby items
    const nearestLoot = this.findNearest(context.loot);
    if (nearestLoot && distanceVec2(pos, nearestLoot.position) < 150) {
      this.state = AIState.LOOTING;
      this.targetPosition = nearestLoot.position;
      return;
    }

    // Default: Roam
    if (this.state !== AIState.ROAMING || this.stateTimer <= 0) {
      this.state = AIState.ROAMING;
      this.stateTimer = randomRange(3000, 8000);
      this.setRandomRoamTarget(context);
    }
  }

  private executeIdle(_dt: number): void {
    this.player.velocity = { x: 0, y: 0 };
  }

  private executeRoaming(dt: number, context: AIContext): void {
    if (!this.targetPosition) {
      this.setRandomRoamTarget(context);
      return;
    }

    this.moveTowards(this.targetPosition, 0.7);

    // Check if reached target
    if (distanceVec2(this.player.position, this.targetPosition) < 50) {
      this.targetPosition = null;
      this.stateTimer = randomRange(500, 2000);
      this.state = AIState.IDLE;
    }
  }

  private executeEngaging(_dt: number, context: AIContext): boolean {
    if (!this.targetEnemy || !this.targetEnemy.state.isAlive) {
      this.targetEnemy = this.findNearestEnemy(context.enemies);
      if (!this.targetEnemy) {
        this.state = AIState.ROAMING;
        return false;
      }
    }

    const distance = distanceVec2(this.player.position, this.targetEnemy.position);

    // Aim at enemy
    const direction = subVec2(this.targetEnemy.position, this.player.position);
    this.player.aimDirection = normalizeVec2(direction);

    // Movement based on class and range
    const optimalRange = this.getOptimalRange();

    if (distance > optimalRange + 50) {
      // Move closer
      this.moveTowards(this.targetEnemy.position, 0.8);
    } else if (distance < optimalRange - 50) {
      // Back up
      const away = mulVec2(normalizeVec2(direction), -1);
      this.player.velocity = away;
    } else {
      // Strafe
      const strafe = Math.sin(Date.now() * 0.003) > 0 ? 1 : -1;
      this.player.velocity = {
        x: -direction.y * strafe * 0.5,
        y: direction.x * strafe * 0.5,
      };
    }

    // Fire if in range and has ammo
    if (distance < this.player.weapon.config.range * 0.9) {
      if (this.player.weapon.currentAmmo > 0 && Math.random() < this.accuracy) {
        return true;
      }
    }

    return false;
  }

  private executeRetreating(dt: number, context: AIContext): void {
    // Run towards safe zone center or away from enemy
    let targetPos = context.riftlineCenter;

    if (this.targetEnemy) {
      const away = subVec2(this.player.position, this.targetEnemy.position);
      targetPos = addVec2(this.player.position, mulVec2(normalizeVec2(away), 200));
    }

    this.moveTowards(targetPos, 1.0);

    // Check if safe
    const distToCenter = distanceVec2(this.player.position, context.riftlineCenter);
    const healthPercent =
      (this.player.state.health + this.player.state.shield) /
      (this.player.state.maxHealth + this.player.state.maxShield);

    if (distToCenter < context.riftlineRadius - 200 && healthPercent > 0.5) {
      this.state = AIState.ROAMING;
    }
  }

  private executeCollectingRelic(dt: number, context: AIContext): void {
    if (!this.targetPosition) {
      this.state = AIState.ROAMING;
      return;
    }

    this.moveTowards(this.targetPosition, 0.9);

    if (distanceVec2(this.player.position, this.targetPosition) < 30) {
      // Will be picked up by game logic
      this.state = AIState.ROAMING;
    }
  }

  private executeDeliveringRelic(dt: number, context: AIContext): void {
    const deliveryPos = context.deliverySite.position;
    this.moveTowards(deliveryPos, 0.85); // Slightly slower when carrying

    // Look towards delivery
    const direction = subVec2(deliveryPos, this.player.position);
    this.player.aimDirection = normalizeVec2(direction);
  }

  private executeCollectingOrb(dt: number, context: AIContext): void {
    if (!this.targetPosition) {
      this.state = AIState.ROAMING;
      return;
    }

    this.moveTowards(this.targetPosition, 0.9);

    if (distanceVec2(this.player.position, this.targetPosition) < 30) {
      this.state = AIState.ROAMING;
    }
  }

  private executeLooting(dt: number, context: AIContext): void {
    if (!this.targetPosition) {
      this.state = AIState.ROAMING;
      return;
    }

    this.moveTowards(this.targetPosition, 0.8);

    if (distanceVec2(this.player.position, this.targetPosition) < 20) {
      // Loot pickup handled by game logic
      this.state = AIState.ROAMING;
    }
  }

  private moveTowards(target: Vector2, speedMultiplier: number): void {
    const direction = subVec2(target, this.player.position);
    const normalized = normalizeVec2(direction);
    this.player.velocity = mulVec2(normalized, speedMultiplier);
    this.player.aimDirection = normalized;
  }

  private findNearestEnemy(enemies: Player[]): Player | null {
    let nearest: Player | null = null;
    let nearestDist = Infinity;

    for (const enemy of enemies) {
      if (!enemy.state.isAlive) continue;
      if (enemy.squadId === this.player.squadId) continue;

      const dist = distanceVec2(this.player.position, enemy.position);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = enemy;
      }
    }

    return nearest;
  }

  private findNearest<T extends { position: Vector2; isActive: boolean }>(
    items: T[]
  ): T | null {
    let nearest: T | null = null;
    let nearestDist = Infinity;

    for (const item of items) {
      if (!item.isActive) continue;

      const dist = distanceVec2(this.player.position, item.position);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = item;
      }
    }

    return nearest;
  }

  private setRandomRoamTarget(context: AIContext): void {
    // Pick a random point within the safe zone
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * (context.riftlineRadius - 200);

    this.targetPosition = {
      x: context.riftlineCenter.x + Math.cos(angle) * distance,
      y: context.riftlineCenter.y + Math.sin(angle) * distance,
    };
  }

  private getOptimalRange(): number {
    switch (this.player.playerClass) {
      case PlayerClass.VANGUARD:
        return 150; // Use SMG range
      case PlayerClass.SCOUT:
        return 250; // Flanker
      case PlayerClass.MEDIC:
        return 400; // Mid range
      case PlayerClass.SCAVENGER:
        return 300; // Burst range
      default:
        return 300;
    }
  }

  getState(): AIState {
    return this.state;
  }
}
