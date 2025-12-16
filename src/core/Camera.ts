import type { Vector2 } from '../types';
import { vec2, vec2Lerp, clamp } from '../utils/math';

export class Camera {
  position: Vector2 = vec2();
  targetPosition: Vector2 = vec2();
  zoom: number = 1;
  targetZoom: number = 1;
  minZoom: number = 0.5;
  maxZoom: number = 2;
  smoothing: number = 0.1;
  bounds: { minX: number; minY: number; maxX: number; maxY: number } | null = null;

  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  setBounds(minX: number, minY: number, maxX: number, maxY: number): void {
    this.bounds = { minX, minY, maxX, maxY };
  }

  follow(target: Vector2): void {
    this.targetPosition = { ...target };
  }

  setZoom(zoom: number): void {
    this.targetZoom = clamp(zoom, this.minZoom, this.maxZoom);
  }

  adjustZoom(delta: number): void {
    this.setZoom(this.targetZoom + delta);
  }

  update(deltaTime: number): void {
    // Smooth camera movement
    const t = 1 - Math.pow(1 - this.smoothing, deltaTime * 60);
    this.position = vec2Lerp(this.position, this.targetPosition, t);
    this.zoom = this.zoom + (this.targetZoom - this.zoom) * t;

    // Apply bounds
    if (this.bounds) {
      const halfWidth = (this.canvas.width / this.zoom) / 2;
      const halfHeight = (this.canvas.height / this.zoom) / 2;

      this.position.x = clamp(
        this.position.x,
        this.bounds.minX + halfWidth,
        this.bounds.maxX - halfWidth
      );
      this.position.y = clamp(
        this.position.y,
        this.bounds.minY + halfHeight,
        this.bounds.maxY - halfHeight
      );
    }
  }

  worldToScreen(worldPos: Vector2): Vector2 {
    return {
      x: (worldPos.x - this.position.x) * this.zoom + this.canvas.width / 2,
      y: (worldPos.y - this.position.y) * this.zoom + this.canvas.height / 2,
    };
  }

  screenToWorld(screenPos: Vector2): Vector2 {
    return {
      x: (screenPos.x - this.canvas.width / 2) / this.zoom + this.position.x,
      y: (screenPos.y - this.canvas.height / 2) / this.zoom + this.position.y,
    };
  }

  applyTransform(ctx: CanvasRenderingContext2D): void {
    ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.position.x, -this.position.y);
  }

  getVisibleBounds(): { minX: number; minY: number; maxX: number; maxY: number } {
    const halfWidth = (this.canvas.width / this.zoom) / 2;
    const halfHeight = (this.canvas.height / this.zoom) / 2;
    return {
      minX: this.position.x - halfWidth,
      minY: this.position.y - halfHeight,
      maxX: this.position.x + halfWidth,
      maxY: this.position.y + halfHeight,
    };
  }
}
