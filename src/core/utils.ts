// Utility functions

import { Vector2, Rectangle, Circle } from './types';

// Vector operations
export function vec2(x: number = 0, y: number = 0): Vector2 {
  return { x, y };
}

export function addVec2(a: Vector2, b: Vector2): Vector2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function subVec2(a: Vector2, b: Vector2): Vector2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function mulVec2(v: Vector2, scalar: number): Vector2 {
  return { x: v.x * scalar, y: v.y * scalar };
}

export function divVec2(v: Vector2, scalar: number): Vector2 {
  if (scalar === 0) return { x: 0, y: 0 };
  return { x: v.x / scalar, y: v.y / scalar };
}

export function lengthVec2(v: Vector2): number {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}

export function normalizeVec2(v: Vector2): Vector2 {
  const len = lengthVec2(v);
  if (len === 0) return { x: 0, y: 0 };
  return divVec2(v, len);
}

export function distanceVec2(a: Vector2, b: Vector2): number {
  return lengthVec2(subVec2(a, b));
}

export function dotVec2(a: Vector2, b: Vector2): number {
  return a.x * b.x + a.y * b.y;
}

export function angleVec2(v: Vector2): number {
  return Math.atan2(v.y, v.x);
}

export function rotateVec2(v: Vector2, angle: number): Vector2 {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: v.x * cos - v.y * sin,
    y: v.x * sin + v.y * cos,
  };
}

export function lerpVec2(a: Vector2, b: Vector2, t: number): Vector2 {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
}

export function fromAngle(angle: number, length: number = 1): Vector2 {
  return {
    x: Math.cos(angle) * length,
    y: Math.sin(angle) * length,
  };
}

// Collision detection
export function circleCircleCollision(a: Circle, b: Circle): boolean {
  const dist = distanceVec2({ x: a.x, y: a.y }, { x: b.x, y: b.y });
  return dist < a.radius + b.radius;
}

export function pointInCircle(point: Vector2, circle: Circle): boolean {
  return distanceVec2(point, { x: circle.x, y: circle.y }) < circle.radius;
}

export function pointInRect(point: Vector2, rect: Rectangle): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

export function rectRectCollision(a: Rectangle, b: Rectangle): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

export function circleRectCollision(circle: Circle, rect: Rectangle): boolean {
  const closestX = clamp(circle.x, rect.x, rect.x + rect.width);
  const closestY = clamp(circle.y, rect.y, rect.y + rect.height);
  const dist = distanceVec2({ x: circle.x, y: circle.y }, { x: closestX, y: closestY });
  return dist < circle.radius;
}

// Math utilities
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function inverseLerp(a: number, b: number, value: number): number {
  if (a === b) return 0;
  return (value - a) / (b - a);
}

export function remap(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number
): number {
  const t = inverseLerp(inMin, inMax, value);
  return lerp(outMin, outMax, t);
}

export function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function randomInt(min: number, max: number): number {
  return Math.floor(randomRange(min, max + 1));
}

export function randomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

export function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function degToRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

export function radToDeg(radians: number): number {
  return radians * (180 / Math.PI);
}

export function angleDifference(a: number, b: number): number {
  let diff = ((b - a + Math.PI) % (2 * Math.PI)) - Math.PI;
  if (diff < -Math.PI) diff += 2 * Math.PI;
  return diff;
}

// ID generation
let entityIdCounter = 0;
export function generateId(): string {
  return `entity_${++entityIdCounter}_${Date.now().toString(36)}`;
}

// Time utilities
export function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Color utilities
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return { r: 0, g: 0, b: 0 };
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

export function colorWithAlpha(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Easing functions
export const easing = {
  linear: (t: number) => t,
  easeInQuad: (t: number) => t * t,
  easeOutQuad: (t: number) => t * (2 - t),
  easeInOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  easeInCubic: (t: number) => t * t * t,
  easeOutCubic: (t: number) => --t * t * t + 1,
  easeInOutCubic: (t: number) =>
    t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
  easeOutElastic: (t: number) => {
    const p = 0.3;
    return Math.pow(2, -10 * t) * Math.sin(((t - p / 4) * (2 * Math.PI)) / p) + 1;
  },
};
