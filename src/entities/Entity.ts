// Base entity class

import { Vector2, EntityType } from '../core/types';
import { generateId, vec2 } from '../core/utils';

export abstract class Entity {
  id: string;
  type: EntityType;
  position: Vector2;
  velocity: Vector2;
  rotation: number;
  radius: number;
  isActive: boolean;

  constructor(type: EntityType, x: number = 0, y: number = 0) {
    this.id = generateId();
    this.type = type;
    this.position = { x, y };
    this.velocity = vec2();
    this.rotation = 0;
    this.radius = 20;
    this.isActive = true;
  }

  abstract update(dt: number): void;
  abstract render(renderer: unknown): void;

  setPosition(x: number, y: number): void {
    this.position.x = x;
    this.position.y = y;
  }

  destroy(): void {
    this.isActive = false;
  }
}
