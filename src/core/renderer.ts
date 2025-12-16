// Rendering system with camera management

import { Vector2, CameraState, Rectangle } from './types';
import { vec2, lerp, clamp, randomRange, colorWithAlpha } from './utils';
import { GAME_CONFIG, COLORS } from './constants';

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private camera: CameraState;
  private screenWidth: number;
  private screenHeight: number;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D context');
    this.ctx = ctx;

    this.camera = {
      x: GAME_CONFIG.mapWidth / 2,
      y: GAME_CONFIG.mapHeight / 2,
      zoom: 1,
      targetZoom: 1,
      shakeIntensity: 0,
      shakeDecay: 0.9,
    };

    this.screenWidth = window.innerWidth;
    this.screenHeight = window.innerHeight;

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  private resize(): void {
    const dpr = window.devicePixelRatio || 1;
    this.screenWidth = window.innerWidth;
    this.screenHeight = window.innerHeight;

    this.canvas.width = this.screenWidth * dpr;
    this.canvas.height = this.screenHeight * dpr;
    this.canvas.style.width = `${this.screenWidth}px`;
    this.canvas.style.height = `${this.screenHeight}px`;

    this.ctx.scale(dpr, dpr);
  }

  // Camera methods
  setCameraTarget(x: number, y: number): void {
    this.camera.x = x;
    this.camera.y = y;
  }

  setCameraZoom(zoom: number): void {
    this.camera.targetZoom = clamp(zoom, 0.5, 2);
  }

  updateCamera(dt: number): void {
    // Smooth zoom
    this.camera.zoom = lerp(this.camera.zoom, this.camera.targetZoom, dt * 5);

    // Apply and decay screen shake
    if (this.camera.shakeIntensity > 0.1) {
      this.camera.shakeIntensity *= this.camera.shakeDecay;
    } else {
      this.camera.shakeIntensity = 0;
    }
  }

  addScreenShake(intensity: number): void {
    this.camera.shakeIntensity = Math.max(this.camera.shakeIntensity, intensity);
  }

  // Convert world position to screen position
  worldToScreen(worldPos: Vector2): Vector2 {
    const shakeX = randomRange(-this.camera.shakeIntensity, this.camera.shakeIntensity);
    const shakeY = randomRange(-this.camera.shakeIntensity, this.camera.shakeIntensity);

    return {
      x: (worldPos.x - this.camera.x) * this.camera.zoom + this.screenWidth / 2 + shakeX,
      y: (worldPos.y - this.camera.y) * this.camera.zoom + this.screenHeight / 2 + shakeY,
    };
  }

  // Convert screen position to world position
  screenToWorld(screenPos: Vector2): Vector2 {
    return {
      x: (screenPos.x - this.screenWidth / 2) / this.camera.zoom + this.camera.x,
      y: (screenPos.y - this.screenHeight / 2) / this.camera.zoom + this.camera.y,
    };
  }

  // Get visible world bounds
  getVisibleBounds(): Rectangle {
    const halfWidth = (this.screenWidth / 2) / this.camera.zoom;
    const halfHeight = (this.screenHeight / 2) / this.camera.zoom;
    return {
      x: this.camera.x - halfWidth,
      y: this.camera.y - halfHeight,
      width: halfWidth * 2,
      height: halfHeight * 2,
    };
  }

  // Begin frame
  beginFrame(): void {
    this.ctx.save();
    this.ctx.fillStyle = COLORS.background;
    this.ctx.fillRect(0, 0, this.screenWidth, this.screenHeight);
  }

  // End frame
  endFrame(): void {
    this.ctx.restore();
  }

  // Drawing primitives
  drawCircle(
    worldPos: Vector2,
    radius: number,
    fillColor?: string,
    strokeColor?: string,
    strokeWidth: number = 2
  ): void {
    const screen = this.worldToScreen(worldPos);
    const scaledRadius = radius * this.camera.zoom;

    this.ctx.beginPath();
    this.ctx.arc(screen.x, screen.y, scaledRadius, 0, Math.PI * 2);

    if (fillColor) {
      this.ctx.fillStyle = fillColor;
      this.ctx.fill();
    }

    if (strokeColor) {
      this.ctx.strokeStyle = strokeColor;
      this.ctx.lineWidth = strokeWidth;
      this.ctx.stroke();
    }
  }

  drawRect(
    worldPos: Vector2,
    width: number,
    height: number,
    fillColor?: string,
    strokeColor?: string,
    strokeWidth: number = 2
  ): void {
    const screen = this.worldToScreen(worldPos);
    const scaledWidth = width * this.camera.zoom;
    const scaledHeight = height * this.camera.zoom;

    if (fillColor) {
      this.ctx.fillStyle = fillColor;
      this.ctx.fillRect(
        screen.x - scaledWidth / 2,
        screen.y - scaledHeight / 2,
        scaledWidth,
        scaledHeight
      );
    }

    if (strokeColor) {
      this.ctx.strokeStyle = strokeColor;
      this.ctx.lineWidth = strokeWidth;
      this.ctx.strokeRect(
        screen.x - scaledWidth / 2,
        screen.y - scaledHeight / 2,
        scaledWidth,
        scaledHeight
      );
    }
  }

  drawLine(
    worldStart: Vector2,
    worldEnd: Vector2,
    color: string,
    width: number = 2
  ): void {
    const start = this.worldToScreen(worldStart);
    const end = this.worldToScreen(worldEnd);

    this.ctx.beginPath();
    this.ctx.moveTo(start.x, start.y);
    this.ctx.lineTo(end.x, end.y);
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = width;
    this.ctx.stroke();
  }

  drawPolygon(
    worldPoints: Vector2[],
    fillColor?: string,
    strokeColor?: string,
    strokeWidth: number = 2
  ): void {
    if (worldPoints.length < 3) return;

    const screenPoints = worldPoints.map((p) => this.worldToScreen(p));

    this.ctx.beginPath();
    this.ctx.moveTo(screenPoints[0].x, screenPoints[0].y);
    for (let i = 1; i < screenPoints.length; i++) {
      this.ctx.lineTo(screenPoints[i].x, screenPoints[i].y);
    }
    this.ctx.closePath();

    if (fillColor) {
      this.ctx.fillStyle = fillColor;
      this.ctx.fill();
    }

    if (strokeColor) {
      this.ctx.strokeStyle = strokeColor;
      this.ctx.lineWidth = strokeWidth;
      this.ctx.stroke();
    }
  }

  drawText(
    text: string,
    worldPos: Vector2,
    color: string,
    fontSize: number = 14,
    align: CanvasTextAlign = 'center',
    baseline: CanvasTextBaseline = 'middle'
  ): void {
    const screen = this.worldToScreen(worldPos);
    this.ctx.font = `${fontSize}px 'Segoe UI', system-ui, sans-serif`;
    this.ctx.textAlign = align;
    this.ctx.textBaseline = baseline;
    this.ctx.fillStyle = color;
    this.ctx.fillText(text, screen.x, screen.y);
  }

  // Draw arc for proximity awareness
  drawArc(
    worldPos: Vector2,
    innerRadius: number,
    outerRadius: number,
    startAngle: number,
    endAngle: number,
    color: string
  ): void {
    const screen = this.worldToScreen(worldPos);
    const scaledInner = innerRadius * this.camera.zoom;
    const scaledOuter = outerRadius * this.camera.zoom;

    this.ctx.beginPath();
    this.ctx.arc(screen.x, screen.y, scaledOuter, startAngle, endAngle);
    this.ctx.arc(screen.x, screen.y, scaledInner, endAngle, startAngle, true);
    this.ctx.closePath();
    this.ctx.fillStyle = color;
    this.ctx.fill();
  }

  // Draw screen-space elements (HUD)
  drawScreenCircle(
    pos: Vector2,
    radius: number,
    fillColor?: string,
    strokeColor?: string,
    strokeWidth: number = 2
  ): void {
    this.ctx.beginPath();
    this.ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);

    if (fillColor) {
      this.ctx.fillStyle = fillColor;
      this.ctx.fill();
    }

    if (strokeColor) {
      this.ctx.strokeStyle = strokeColor;
      this.ctx.lineWidth = strokeWidth;
      this.ctx.stroke();
    }
  }

  drawScreenRect(
    x: number,
    y: number,
    width: number,
    height: number,
    fillColor?: string,
    strokeColor?: string,
    strokeWidth: number = 2
  ): void {
    if (fillColor) {
      this.ctx.fillStyle = fillColor;
      this.ctx.fillRect(x, y, width, height);
    }

    if (strokeColor) {
      this.ctx.strokeStyle = strokeColor;
      this.ctx.lineWidth = strokeWidth;
      this.ctx.strokeRect(x, y, width, height);
    }
  }

  drawScreenText(
    text: string,
    x: number,
    y: number,
    color: string,
    fontSize: number = 14,
    align: CanvasTextAlign = 'left',
    baseline: CanvasTextBaseline = 'top'
  ): void {
    this.ctx.font = `${fontSize}px 'Segoe UI', system-ui, sans-serif`;
    this.ctx.textAlign = align;
    this.ctx.textBaseline = baseline;
    this.ctx.fillStyle = color;
    this.ctx.fillText(text, x, y);
  }

  // Draw with glow effect
  drawGlow(
    worldPos: Vector2,
    radius: number,
    color: string,
    intensity: number = 0.5
  ): void {
    const screen = this.worldToScreen(worldPos);
    const scaledRadius = radius * this.camera.zoom;

    const gradient = this.ctx.createRadialGradient(
      screen.x,
      screen.y,
      0,
      screen.x,
      screen.y,
      scaledRadius
    );
    gradient.addColorStop(0, colorWithAlpha(color, intensity));
    gradient.addColorStop(1, colorWithAlpha(color, 0));

    this.ctx.beginPath();
    this.ctx.arc(screen.x, screen.y, scaledRadius, 0, Math.PI * 2);
    this.ctx.fillStyle = gradient;
    this.ctx.fill();
  }

  // Draw health/shield bar
  drawBar(
    worldPos: Vector2,
    width: number,
    height: number,
    value: number,
    maxValue: number,
    fillColor: string,
    bgColor: string = '#333333'
  ): void {
    const screen = this.worldToScreen(worldPos);
    const scaledWidth = width * this.camera.zoom;
    const scaledHeight = height * this.camera.zoom;
    const fillWidth = (value / maxValue) * scaledWidth;

    // Background
    this.ctx.fillStyle = bgColor;
    this.ctx.fillRect(
      screen.x - scaledWidth / 2,
      screen.y - scaledHeight / 2,
      scaledWidth,
      scaledHeight
    );

    // Fill
    this.ctx.fillStyle = fillColor;
    this.ctx.fillRect(
      screen.x - scaledWidth / 2,
      screen.y - scaledHeight / 2,
      fillWidth,
      scaledHeight
    );
  }

  getScreenSize(): Vector2 {
    return { x: this.screenWidth, y: this.screenHeight };
  }

  getCamera(): CameraState {
    return { ...this.camera };
  }

  getContext(): CanvasRenderingContext2D {
    return this.ctx;
  }
}
