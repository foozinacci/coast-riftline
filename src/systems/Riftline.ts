// Riftline (Storm) System - the ring that forces engagement

import { Vector2, RiftlinePhase, Circle } from '../core/types';
import { GAME_CONFIG, COLORS } from '../core/constants';
import { vec2, distanceVec2, lerp, colorWithAlpha } from '../core/utils';
import { Renderer } from '../core/renderer';

export interface RiftlineState {
  phase: RiftlinePhase;
  phaseIndex: number;
  phaseTimer: number;
  currentCenter: Vector2;
  targetCenter: Vector2;
  currentRadius: number;
  targetRadius: number;
  damagePerSecond: number;
  respawnEfficiency: number;
}

export class Riftline {
  private state: RiftlineState;
  private mapWidth: number;
  private mapHeight: number;

  constructor(mapWidth: number, mapHeight: number) {
    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight;

    const center = { x: mapWidth / 2, y: mapHeight / 2 };
    const initialRadius = Math.max(mapWidth, mapHeight) * 0.6;

    this.state = {
      phase: RiftlinePhase.OPEN,
      phaseIndex: 0,
      phaseTimer: GAME_CONFIG.riftlinePhases[0].duration,
      currentCenter: { ...center },
      targetCenter: { ...center },
      currentRadius: initialRadius,
      targetRadius: initialRadius,
      damagePerSecond: GAME_CONFIG.riftlinePhases[0].damagePerSecond,
      respawnEfficiency: GAME_CONFIG.riftlinePhases[0].respawnEfficiency,
    };
  }

  update(dt: number): void {
    const dtMs = dt * 1000;
    this.state.phaseTimer -= dtMs;

    // Check for phase transition
    if (this.state.phaseTimer <= 0 && this.state.phaseIndex < GAME_CONFIG.riftlinePhases.length - 1) {
      this.advancePhase();
    }

    // Shrink the ring
    const phaseConfig = GAME_CONFIG.riftlinePhases[this.state.phaseIndex];
    if (phaseConfig.shrinkRate > 0) {
      const shrinkAmount = phaseConfig.shrinkRate * dt;
      this.state.currentRadius = Math.max(100, this.state.currentRadius - shrinkAmount);

      // Move center towards target
      this.state.currentCenter = {
        x: lerp(this.state.currentCenter.x, this.state.targetCenter.x, dt * 0.5),
        y: lerp(this.state.currentCenter.y, this.state.targetCenter.y, dt * 0.5),
      };
    }
  }

  private advancePhase(): void {
    this.state.phaseIndex++;
    const newPhase = GAME_CONFIG.riftlinePhases[this.state.phaseIndex];

    this.state.phase = newPhase.phase;
    this.state.phaseTimer = newPhase.duration;
    this.state.damagePerSecond = newPhase.damagePerSecond;
    this.state.respawnEfficiency = newPhase.respawnEfficiency;

    // Calculate new target for convergence
    if (newPhase.phase === RiftlinePhase.CONVERGENCE) {
      // Target converges to a random point near center
      this.state.targetCenter = {
        x: this.mapWidth / 2 + (Math.random() - 0.5) * 400,
        y: this.mapHeight / 2 + (Math.random() - 0.5) * 400,
      };
      this.state.targetRadius = 200;
    } else if (newPhase.phase === RiftlinePhase.COMPRESSION) {
      // Compression moves towards center
      this.state.targetCenter = {
        x: this.mapWidth / 2 + (Math.random() - 0.5) * 600,
        y: this.mapHeight / 2 + (Math.random() - 0.5) * 600,
      };
      this.state.targetRadius = this.state.currentRadius * 0.5;
    }
  }

  // Set convergence point (for vault location)
  setConvergencePoint(point: Vector2): void {
    this.state.targetCenter = { ...point };
  }

  // Force convergence phase (when all relics delivered)
  forceConvergence(vaultPosition: Vector2): void {
    this.state.phaseIndex = GAME_CONFIG.riftlinePhases.length - 1;
    const finalPhase = GAME_CONFIG.riftlinePhases[this.state.phaseIndex];

    this.state.phase = RiftlinePhase.CONVERGENCE;
    this.state.phaseTimer = finalPhase.duration;
    this.state.damagePerSecond = finalPhase.damagePerSecond;
    this.state.respawnEfficiency = finalPhase.respawnEfficiency;
    this.state.targetCenter = { ...vaultPosition };
    this.state.targetRadius = 150;
  }

  // Check if a position is inside the safe zone
  isInSafeZone(position: Vector2): boolean {
    const distance = distanceVec2(position, this.state.currentCenter);
    return distance <= this.state.currentRadius;
  }

  // Get damage for a position outside the zone
  getDamageAtPosition(position: Vector2, dt: number): number {
    if (this.isInSafeZone(position)) return 0;

    const distance = distanceVec2(position, this.state.currentCenter);
    const outsideDistance = distance - this.state.currentRadius;

    // Damage increases the further outside you are
    const damageMultiplier = 1 + (outsideDistance / 200) * 0.5;
    return this.state.damagePerSecond * dt * damageMultiplier;
  }

  getState(): RiftlineState {
    return { ...this.state };
  }

  getCircle(): Circle {
    return {
      x: this.state.currentCenter.x,
      y: this.state.currentCenter.y,
      radius: this.state.currentRadius,
    };
  }

  getRespawnEfficiency(): number {
    return this.state.respawnEfficiency;
  }

  render(renderer: Renderer): void {
    const center = this.state.currentCenter;
    const radius = this.state.currentRadius;

    // Draw the danger zone (outside the ring) - render as overlay on edges
    this.renderDangerZone(renderer);

    // Draw the ring edge
    renderer.drawCircle(center, radius, undefined, COLORS.riftline, 4);

    // Draw inner glow
    renderer.drawCircle(
      center,
      radius - 10,
      undefined,
      colorWithAlpha(COLORS.riftlineGlow, 0.5),
      8
    );

    // Draw target ring (where it's shrinking to)
    if (this.state.targetRadius < this.state.currentRadius) {
      renderer.drawCircle(
        this.state.targetCenter,
        this.state.targetRadius,
        undefined,
        colorWithAlpha(COLORS.riftline, 0.3),
        2
      );
    }

    // NOTE: Phase indicator is rendered by HUD.renderRiftlineInfo() to avoid duplicates
  }

  private renderDangerZone(renderer: Renderer): void {
    const ctx = renderer.getContext();
    const screen = renderer.getScreenSize();
    const bounds = renderer.getVisibleBounds();

    // Create a path that covers everything outside the safe zone
    ctx.save();

    // Draw semi-transparent overlay on the danger zone
    const center = renderer.worldToScreen(this.state.currentCenter);
    const scaledRadius = this.state.currentRadius * renderer.getCamera().zoom;

    // Create clipping path for outside the circle
    ctx.beginPath();
    ctx.rect(0, 0, screen.x, screen.y);
    ctx.arc(center.x, center.y, scaledRadius, 0, Math.PI * 2, true);
    ctx.closePath();

    // Fill with danger color
    ctx.fillStyle = colorWithAlpha(COLORS.riftline, 0.15);
    ctx.fill();

    // Add animated edge effect
    const pulseIntensity = 0.1 + Math.sin(Date.now() * 0.003) * 0.05;
    ctx.fillStyle = colorWithAlpha(COLORS.dangerZone, pulseIntensity);
    ctx.fill();

    ctx.restore();
  }
}
