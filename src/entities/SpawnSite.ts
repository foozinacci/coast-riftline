// Spawn Site entity - where teams can choose to spawn

import { Entity } from './Entity';
import { EntityType } from '../core/types';
import { Renderer } from '../core/renderer';

export class SpawnSite extends Entity {
  name: string;
  claimedBySquads: string[];
  maxSquads: number;

  constructor(x: number, y: number, name: string) {
    super(EntityType.SPAWN_SITE, x, y);

    this.name = name;
    this.claimedBySquads = [];
    this.maxSquads = 2;
    this.radius = 100;
  }

  update(_dt: number): void {
    // Spawn sites are static
  }

  canClaim(): boolean {
    return this.claimedBySquads.length < this.maxSquads;
  }

  claim(squadId: string): boolean {
    if (!this.canClaim()) return false;
    if (this.claimedBySquads.includes(squadId)) return false;
    this.claimedBySquads.push(squadId);
    return true;
  }

  unclaim(squadId: string): void {
    const index = this.claimedBySquads.indexOf(squadId);
    if (index !== -1) {
      this.claimedBySquads.splice(index, 1);
    }
  }

  getSpawnPositions(count: number): { x: number; y: number }[] {
    const positions: { x: number; y: number }[] = [];
    const angleStep = (Math.PI * 2) / count;

    for (let i = 0; i < count; i++) {
      const angle = angleStep * i;
      const distance = this.radius * 0.6;
      positions.push({
        x: this.position.x + Math.cos(angle) * distance,
        y: this.position.y + Math.sin(angle) * distance,
      });
    }

    return positions;
  }

  render(renderer: Renderer): void {
    const pos = this.position;
    const isFull = !this.canClaim();

    const zoneColor = isFull ? 'rgba(255, 68, 68, 0.2)' : 'rgba(68, 255, 136, 0.2)';
    const borderColor = isFull ? '#ff4444' : '#44ff88';

    renderer.drawCircle(pos, this.radius, zoneColor, borderColor, 2);
    renderer.drawCircle(pos, 20, borderColor);

    renderer.drawText(this.name, { x: pos.x, y: pos.y - this.radius - 15 }, '#ffffff', 14);
    renderer.drawText(
      `${this.claimedBySquads.length}/${this.maxSquads}`,
      { x: pos.x, y: pos.y + 30 },
      '#aaaaaa',
      12
    );
  }
}
