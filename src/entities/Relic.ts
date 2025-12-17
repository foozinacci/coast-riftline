import { Entity } from './Entity';
import { EntityType, RelicState as CoreRelicState } from '../core/types';
import { RELIC_CONFIG, COLORS } from '../core/constants';
import { Renderer } from '../core/renderer';

export { CoreRelicState as RelicState };

export class Relic extends Entity {
  state: CoreRelicState;
  carrierId: string | null;
  spawnPosition: { x: number; y: number };
  plantSiteId: string;
  plantProgress: number;
  planterId: string | null;

  // Visuals
  revealTimer: number;
  isRevealed: boolean;
  dropDecayTimer: number;

  constructor(x: number, y: number) {
    super(EntityType.RELIC, x, y);

    this.state = CoreRelicState.AVAILABLE; // Using Core enum
    this.carrierId = null;
    this.spawnPosition = { x, y };
    this.plantSiteId = '';
    this.plantProgress = 0;
    this.planterId = null;

    this.radius = 20;
    this.revealTimer = RELIC_CONFIG.revealInterval;
    this.isRevealed = false;
    this.dropDecayTimer = 0;
  }

  update(dt: number): void {
    if (this.state === CoreRelicState.CARRIED) {
      // Handle periodic reveal
      this.revealTimer -= dt * 1000;
      if (this.revealTimer <= 0) {
        this.isRevealed = true;
        this.revealTimer = RELIC_CONFIG.revealInterval;

        // Reveal duration
        setTimeout(() => {
          this.isRevealed = false;
        }, RELIC_CONFIG.revealDuration);
      }
    }

    if (this.state === CoreRelicState.AVAILABLE && this.dropDecayTimer > 0) {
      this.dropDecayTimer -= dt * 1000;
      // Relic doesn't decay, just waits to be picked up
    }
  }

  pickup(playerId: string): void {
    this.state = CoreRelicState.CARRIED;
    this.carrierId = playerId;
    this.revealTimer = RELIC_CONFIG.revealInterval;
  }

  drop(x: number, y: number): void {
    this.state = CoreRelicState.AVAILABLE;
    this.carrierId = null;
    this.position = { x, y };
    this.dropDecayTimer = 30000; // 30 seconds before auto-respawn consideration
  }

  deliver(): void {
    this.state = CoreRelicState.PLANTED;
    this.carrierId = null;
    // this.isActive = false; // logic changed: planted relics might stay active for rings
  }

  render(renderer: Renderer): void {
    if (this.state === CoreRelicState.CARRIED || this.state === CoreRelicState.PLANTED) {
      return; // Don't render if carried or planted
    }

    const pos = this.position;

    // Glow effect
    renderer.drawGlow(pos, 40, COLORS.relic, 0.4);

    // Pulsing effect
    const pulse = 1 + Math.sin(Date.now() * 0.005) * 0.1;
    const size = this.radius * pulse;

    // Draw relic as diamond shape
    const points = [
      { x: pos.x, y: pos.y - size },
      { x: pos.x + size, y: pos.y },
      { x: pos.x, y: pos.y + size },
      { x: pos.x - size, y: pos.y },
    ];

    renderer.drawPolygon(points, COLORS.relic, '#ffffff', 2);

    // Inner glow
    const innerSize = size * 0.5;
    const innerPoints = [
      { x: pos.x, y: pos.y - innerSize },
      { x: pos.x + innerSize, y: pos.y },
      { x: pos.x, y: pos.y + innerSize },
      { x: pos.x - innerSize, y: pos.y },
    ];
    renderer.drawPolygon(innerPoints, '#ffffff');

    // Draw "RELIC" text
    renderer.drawText('RELIC', { x: pos.x, y: pos.y - size - 15 }, COLORS.relic, 10);
  }
}
