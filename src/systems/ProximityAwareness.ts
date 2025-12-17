// Proximity Awareness System - replaces minimap with directional awareness

import { Vector2, ProximitySignal } from '../core/types';
import { COLORS } from '../core/constants';
import {
  distanceVec2,
  subVec2,
  angleVec2,
  normalizeVec2,
  clamp,
  colorWithAlpha,
} from '../core/utils';
import { Player } from '../entities/Player';
import { Relic } from '../entities/Relic';
import { Renderer } from '../core/renderer';

interface AwarenessTarget {
  position: Vector2;
  type: 'enemy' | 'loot' | 'relic' | 'danger';
  strength: number;
  squadId?: string;
}

export class ProximityAwareness {
  private signals: ProximitySignal[] = [];
  private baseRange: number = 600;

  update(
    player: Player,
    enemies: Player[],
    relics: Relic[],
    riftlineCenter: Vector2,
    riftlineRadius: number
  ): void {
    this.signals = [];

    if (!player.state.isAlive) return;

    const playerPos = player.position;
    // Use base range - proximity bonus can be added later if needed
    const effectiveRange = this.baseRange;

    // Detect enemies
    for (const enemy of enemies) {
      if (!enemy.state.isAlive) continue;
      if (enemy.squadId === player.squadId) continue;

      const distance = distanceVec2(playerPos, enemy.position);
      if (distance > effectiveRange) continue;

      // Calculate signal strength based on distance and activity
      let strength = 1 - distance / effectiveRange;

      // Boost signal if enemy is firing or moving fast
      if (enemy.weapon.fireTimer > 0) {
        strength = Math.min(1, strength * 1.5);
      }

      // Reduce signal if enemy is stationary
      const enemySpeed = Math.sqrt(
        enemy.velocity.x * enemy.velocity.x + enemy.velocity.y * enemy.velocity.y
      );
      if (enemySpeed < 0.1) {
        strength *= 0.7;
      }

      const direction = subVec2(enemy.position, playerPos);
      const angle = angleVec2(direction);

      this.signals.push({
        direction: angle,
        strength: clamp(strength, 0, 1),
        type: 'enemy',
        distance,
      });
    }

    // Detect relics (if not carrying one)
    if (!player.hasRelic) {
      for (const relic of relics) {
        if (!relic.isActive) continue;

        const distance = distanceVec2(playerPos, relic.position);
        const relicRange = effectiveRange * 1.5; // Relics can be sensed from further

        if (distance > relicRange) continue;

        const strength = 1 - distance / relicRange;
        const direction = subVec2(relic.position, playerPos);
        const angle = angleVec2(direction);

        this.signals.push({
          direction: angle,
          strength: clamp(strength * 0.8, 0, 1),
          type: 'relic',
          distance,
        });
      }
    }

    // Detect riftline danger (if close to edge)
    const distToCenter = distanceVec2(playerPos, riftlineCenter);
    const distToEdge = riftlineRadius - distToCenter;

    if (distToEdge < 200 && distToEdge > 0) {
      // Player is near the edge
      const strength = 1 - distToEdge / 200;
      const direction = subVec2(riftlineCenter, playerPos);
      const angle = angleVec2(direction);

      // Signal points AWAY from safety (towards danger)
      this.signals.push({
        direction: angle + Math.PI,
        strength: clamp(strength, 0, 1),
        type: 'danger',
        distance: distToEdge,
      });
    } else if (distToCenter > riftlineRadius) {
      // Player is outside the zone
      const direction = subVec2(riftlineCenter, playerPos);
      const angle = angleVec2(direction);

      this.signals.push({
        direction: angle,
        strength: 1,
        type: 'danger',
        distance: distToCenter - riftlineRadius,
      });
    }
  }

  getSignals(): ProximitySignal[] {
    return [...this.signals];
  }

  render(renderer: Renderer, playerScreenPos: Vector2): void {
    const screen = renderer.getScreenSize();
    const indicatorDistance = Math.min(screen.x, screen.y) * 0.35;

    for (const signal of this.signals) {
      this.renderSignal(renderer, playerScreenPos, signal, indicatorDistance);
    }
  }

  private renderSignal(
    renderer: Renderer,
    center: Vector2,
    signal: ProximitySignal,
    distance: number
  ): void {
    // Calculate position on screen edge
    const x = center.x + Math.cos(signal.direction) * distance;
    const y = center.y + Math.sin(signal.direction) * distance;

    // Get color based on type
    let color: string;
    switch (signal.type) {
      case 'enemy':
        color = '#ff4444';
        break;
      case 'relic':
        color = COLORS.relic;
        break;
      case 'danger':
        color = COLORS.riftline;
        break;
      default:
        color = '#ffffff';
    }

    // Draw arc indicator
    const arcSize = 20 + signal.strength * 15;
    const arcWidth = 0.3 + signal.strength * 0.3;
    const alpha = 0.3 + signal.strength * 0.5;

    const ctx = renderer.getContext();
    ctx.save();

    // Outer glow
    ctx.beginPath();
    ctx.arc(
      x,
      y,
      arcSize,
      signal.direction - arcWidth,
      signal.direction + arcWidth
    );
    ctx.strokeStyle = colorWithAlpha(color, alpha * 0.5);
    ctx.lineWidth = 8;
    ctx.stroke();

    // Main arc
    ctx.beginPath();
    ctx.arc(
      x,
      y,
      arcSize,
      signal.direction - arcWidth,
      signal.direction + arcWidth
    );
    ctx.strokeStyle = colorWithAlpha(color, alpha);
    ctx.lineWidth = 4;
    ctx.stroke();

    // Intensity indicator (inner dot)
    if (signal.strength > 0.5) {
      ctx.beginPath();
      ctx.arc(x, y, 4 * signal.strength, 0, Math.PI * 2);
      ctx.fillStyle = colorWithAlpha(color, alpha);
      ctx.fill();
    }

    ctx.restore();

    // Draw chevron pointing inward for enemy signals
    if (signal.type === 'enemy' && signal.strength > 0.3) {
      this.renderChevron(renderer, x, y, signal.direction + Math.PI, color, alpha);
    }
  }

  private renderChevron(
    renderer: Renderer,
    x: number,
    y: number,
    angle: number,
    color: string,
    alpha: number
  ): void {
    const ctx = renderer.getContext();
    const size = 8;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    ctx.beginPath();
    ctx.moveTo(size, 0);
    ctx.lineTo(-size / 2, -size / 2);
    ctx.lineTo(-size / 2, size / 2);
    ctx.closePath();

    ctx.fillStyle = colorWithAlpha(color, alpha);
    ctx.fill();

    ctx.restore();
  }
}
