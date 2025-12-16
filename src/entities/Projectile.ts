import type { Vector2, Weapon } from '../types';
import { vec2Add, vec2Scale, vec2Distance } from '../utils/math';

export interface Projectile {
  id: string;
  ownerId: string;
  teamId: string;
  position: Vector2;
  velocity: Vector2;
  damage: number;
  distanceTraveled: number;
  maxRange: number;
  speed: number;
}

let projectileIdCounter = 0;

export function createProjectile(
  ownerId: string,
  teamId: string,
  position: Vector2,
  direction: Vector2,
  weapon: Weapon
): Projectile {
  return {
    id: `proj_${projectileIdCounter++}`,
    ownerId,
    teamId,
    position: { ...position },
    velocity: vec2Scale(direction, weapon.stats.projectileSpeed),
    damage: weapon.stats.damage,
    distanceTraveled: 0,
    maxRange: weapon.stats.range,
    speed: weapon.stats.projectileSpeed,
  };
}

export function updateProjectile(projectile: Projectile, deltaTime: number): boolean {
  const movement = vec2Scale(projectile.velocity, deltaTime);
  const distance = vec2Distance(projectile.position, vec2Add(projectile.position, movement));

  projectile.position = vec2Add(projectile.position, movement);
  projectile.distanceTraveled += distance;

  // Return false if projectile should be removed
  return projectile.distanceTraveled < projectile.maxRange;
}
