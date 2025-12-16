// Respawn Orb entity - dropped on kills, reduces respawn time

import { Entity } from './Entity';
import { EntityType } from '../core/types';
import { ORB_CONFIG, COLORS } from '../core/constants';
import { Renderer } from '../core/renderer';

export class RespawnOrb extends Entity {
  value: number;
  decayTimer: number;
  sourcePlayerId: string;

  constructor(x: number, y: number, sourcePlayerId: string) {
    super(EntityType.RESPAWN_ORB, x, y);

    this.sourcePlayerId = sourcePlayerId;
    this.value = ORB_CONFIG.baseValue;
    this.decayTimer = ORB_CONFIG.decayTime;
    this.radius = ORB_CONFIG.collectRadius;
  }

  update(dt: number): void {
    this.decayTimer -= dt * 1000;

    if (this.decayTimer <= 0) {
      this.destroy();
    }
  }

  render(renderer: Renderer): void {
    const pos = this.position;

    // Pulsing glow
    const pulse = 0.5 + Math.sin(Date.now() * 0.008) * 0.3;

    // Outer glow
    renderer.drawGlow(pos, 30, COLORS.respawnOrb, pulse * 0.4);

    // Core
    const coreSize = 8 + Math.sin(Date.now() * 0.01) * 2;
    renderer.drawCircle(pos, coreSize, COLORS.respawnOrb, '#ffffff', 1);

    // Inner highlight
    renderer.drawCircle(
      { x: pos.x, y: pos.y - 2 },
      coreSize * 0.4,
      '#ffffff'
    );
  }
}
