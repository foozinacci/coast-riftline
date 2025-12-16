import type { Vector2 } from '../types';

export function vec2(x: number = 0, y: number = 0): Vector2 {
  return { x, y };
}

export function vec2Add(a: Vector2, b: Vector2): Vector2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function vec2Sub(a: Vector2, b: Vector2): Vector2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function vec2Scale(v: Vector2, s: number): Vector2 {
  return { x: v.x * s, y: v.y * s };
}

export function vec2Length(v: Vector2): number {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}

export function vec2Normalize(v: Vector2): Vector2 {
  const len = vec2Length(v);
  if (len === 0) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

export function vec2Distance(a: Vector2, b: Vector2): number {
  return vec2Length(vec2Sub(b, a));
}

export function vec2Dot(a: Vector2, b: Vector2): number {
  return a.x * b.x + a.y * b.y;
}

export function vec2Angle(v: Vector2): number {
  return Math.atan2(v.y, v.x);
}

export function vec2FromAngle(angle: number, length: number = 1): Vector2 {
  return { x: Math.cos(angle) * length, y: Math.sin(angle) * length };
}

export function vec2Lerp(a: Vector2, b: Vector2, t: number): Vector2 {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
}

export function vec2Rotate(v: Vector2, angle: number): Vector2 {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: v.x * cos - v.y * sin,
    y: v.x * sin + v.y * cos,
  };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function randomInt(min: number, max: number): number {
  return Math.floor(randomRange(min, max + 1));
}

export function pointInCircle(point: Vector2, center: Vector2, radius: number): boolean {
  return vec2Distance(point, center) <= radius;
}

export function circlesOverlap(
  c1: Vector2,
  r1: number,
  c2: Vector2,
  r2: number
): boolean {
  return vec2Distance(c1, c2) < r1 + r2;
}
