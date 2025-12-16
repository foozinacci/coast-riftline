import type { Vector2 } from '../types';
import { vec2Distance, randomRange } from '../utils/math';

export interface Orb {
  id: string;
  position: Vector2;
  value: number; // respawn time reduction value
  createdAt: number;
  lifetime: number; // seconds before despawn
}

let orbIdCounter = 0;

export function createOrb(position: Vector2, value: number = 1.5): Orb {
  return {
    id: `orb_${orbIdCounter++}`,
    position: {
      x: position.x + randomRange(-30, 30),
      y: position.y + randomRange(-30, 30),
    },
    value,
    createdAt: performance.now(),
    lifetime: 60, // 60 seconds
  };
}

export function createOrbsFromElimination(position: Vector2, count: number): Orb[] {
  const orbs: Orb[] = [];
  for (let i = 0; i < count; i++) {
    orbs.push(createOrb(position, 1.5));
  }
  return orbs;
}

export function isOrbExpired(orb: Orb): boolean {
  const elapsed = (performance.now() - orb.createdAt) / 1000;
  return elapsed >= orb.lifetime;
}

export function canCollectOrb(orb: Orb, playerPosition: Vector2, collectRadius: number = 30): boolean {
  return vec2Distance(orb.position, playerPosition) <= collectRadius;
}
