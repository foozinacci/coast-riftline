// Projectile entity

import { Entity } from './Entity';
import { Vector2, EntityType, WeaponConfig } from '../core/types';
import { addVec2, mulVec2, lengthVec2 } from '../core/utils';
import { Renderer } from '../core/renderer';

export class Projectile extends Entity {
  ownerId: string;
  squadId: string;
  damage: number;
  speed: number;
  range: number;
  distanceTraveled: number;
  direction: Vector2;

  constructor(
    x: number,
    y: number,
    direction: Vector2,
    ownerId: string,
    squadId: string,
    weaponConfig: WeaponConfig
  ) {
    super(EntityType.PROJECTILE, x, y);

    this.ownerId = ownerId;
    this.squadId = squadId;
    this.direction = direction;
    this.damage = weaponConfig.damage;
    this.speed = weaponConfig.projectileSpeed;
    this.range = weaponConfig.range;
    this.distanceTraveled = 0;
    this.radius = 4;

    // Set velocity
    this.velocity = mulVec2(direction, this.speed);
  }

  update(dt: number): void {
    const movement = mulVec2(this.velocity, dt);
    this.position = addVec2(this.position, movement);
    this.distanceTraveled += lengthVec2(movement);

    // Destroy if exceeded range
    if (this.distanceTraveled >= this.range) {
      this.destroy();
    }
  }

  render(renderer: Renderer): void {
    // Draw projectile glow (larger, semi-transparent)
    renderer.drawCircle(this.position, 12, 'rgba(255, 255, 100, 0.3)');

    // Draw projectile trail (thick yellow line)
    const trailLength = 40;
    const trailStart = addVec2(
      this.position,
      mulVec2(this.direction, -trailLength)
    );

    renderer.drawLine(trailStart, this.position, '#ffff00', 4);

    // Draw projectile core (bright white)
    renderer.drawCircle(this.position, 6, '#ffffff');
  }
}
