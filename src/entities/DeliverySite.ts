// Delivery Site (Vault) - where relics must be delivered

import { Entity } from './Entity';
import { EntityType } from '../core/types';
import { GAME_CONFIG, COLORS } from '../core/constants';
import { Renderer } from '../core/renderer';

export class DeliverySite extends Entity {
  relicsDelivered: number;
  totalRelics: number;
  isVaultOpen: boolean;
  deliveryProgress: Map<string, number>;

  constructor(x: number, y: number) {
    super(EntityType.DELIVERY_SITE, x, y);

    this.relicsDelivered = 0;
    this.totalRelics = GAME_CONFIG.totalRelics;
    this.radius = 80;
    this.isVaultOpen = false;
    this.deliveryProgress = new Map();
  }

  update(_dt: number): void {
    // Updates handled by game state
  }

  startDelivery(playerId: string): void {
    this.deliveryProgress.set(playerId, 0);
  }

  updateDelivery(playerId: string, progress: number): void {
    this.deliveryProgress.set(playerId, progress);
  }

  cancelDelivery(playerId: string): void {
    this.deliveryProgress.delete(playerId);
  }

  completeDelivery(): void {
    this.relicsDelivered++;
    if (this.relicsDelivered >= this.totalRelics) {
      this.isVaultOpen = true;
    }
  }

  render(renderer: Renderer): void {
    if (!this.isVaultOpen) return; // Hidden until all relics delivered

    const pos = this.position;

    // Vault glow
    const glowIntensity = 0.3 + Math.sin(Date.now() * 0.003) * 0.1;
    renderer.drawGlow(pos, this.radius * 1.5, COLORS.vault, glowIntensity);

    // Zone circle
    const zoneColor = this.isVaultOpen ? 'rgba(255, 204, 0, 0.3)' : 'rgba(255, 170, 0, 0.15)';
    renderer.drawCircle(pos, this.radius, zoneColor, COLORS.vault, 3);

    // Inner hexagon
    const innerRadius = 30;
    const points: { x: number; y: number }[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
      points.push({
        x: pos.x + Math.cos(angle) * innerRadius,
        y: pos.y + Math.sin(angle) * innerRadius,
      });
    }
    renderer.drawPolygon(
      points,
      this.isVaultOpen ? COLORS.vault : 'rgba(255, 170, 0, 0.5)',
      '#ffffff',
      2
    );

    // Labels
    renderer.drawText('VAULT', { x: pos.x, y: pos.y - this.radius - 20 }, COLORS.vault, 16);
    renderer.drawText(
      `${this.relicsDelivered}/${this.totalRelics} RELICS`,
      { x: pos.x, y: pos.y - this.radius },
      '#ffffff',
      12
    );

    // Delivery progress arcs
    this.deliveryProgress.forEach((progress) => {
      if (progress > 0) {
        const progressAngle = progress * Math.PI * 2;
        renderer.drawArc(
          pos,
          innerRadius + 5,
          innerRadius + 10,
          -Math.PI / 2,
          -Math.PI / 2 + progressAngle,
          '#00ff88'
        );
      }
    });

    if (this.isVaultOpen) {
      const pulse = Math.sin(Date.now() * 0.01) * 0.5 + 0.5;
      renderer.drawCircle(pos, innerRadius * 0.5, `rgba(255, 255, 255, ${pulse})`);
      renderer.drawText('OPEN', pos, '#000000', 10);
    }
  }
}
