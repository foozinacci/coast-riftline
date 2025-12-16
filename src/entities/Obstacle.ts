// Obstacle entity - map obstacles for cover and collision

import { Entity } from './Entity';
import { EntityType, Rectangle } from '../core/types';
import { Renderer } from '../core/renderer';

export enum ObstacleType {
  ROCK = 'rock',
  WALL = 'wall',
  CRATE = 'crate',
  BUILDING = 'building',
}

export class Obstacle extends Entity {
  obstacleType: ObstacleType;
  width: number;
  height: number;
  isDestructible: boolean;
  health: number;
  maxHealth: number;

  constructor(
    x: number,
    y: number,
    width: number,
    height: number,
    obstacleType: ObstacleType = ObstacleType.ROCK
  ) {
    super(EntityType.OBSTACLE, x, y);

    this.obstacleType = obstacleType;
    this.width = width;
    this.height = height;
    this.radius = Math.max(width, height) / 2;

    this.isDestructible = obstacleType === ObstacleType.CRATE;
    this.maxHealth = this.isDestructible ? 100 : Infinity;
    this.health = this.maxHealth;
  }

  update(_dt: number): void {
    // Static obstacles don't update
  }

  getBounds(): Rectangle {
    return {
      x: this.position.x - this.width / 2,
      y: this.position.y - this.height / 2,
      width: this.width,
      height: this.height,
    };
  }

  takeDamage(amount: number): boolean {
    if (!this.isDestructible) return false;

    this.health -= amount;
    if (this.health <= 0) {
      this.destroy();
      return true;
    }
    return false;
  }

  render(renderer: Renderer): void {
    const pos = this.position;

    switch (this.obstacleType) {
      case ObstacleType.ROCK:
        this.renderRock(renderer, pos);
        break;
      case ObstacleType.WALL:
        this.renderWall(renderer, pos);
        break;
      case ObstacleType.CRATE:
        this.renderCrate(renderer, pos);
        break;
      case ObstacleType.BUILDING:
        this.renderBuilding(renderer, pos);
        break;
    }
  }

  private renderRock(renderer: Renderer, pos: { x: number; y: number }): void {
    // Irregular rock shape using circle
    renderer.drawCircle(
      { x: pos.x + 2, y: pos.y + 2 },
      this.radius,
      'rgba(0, 0, 0, 0.3)'
    );
    renderer.drawCircle(pos, this.radius, '#555566', '#333344', 2);
    renderer.drawCircle(
      { x: pos.x - this.radius * 0.3, y: pos.y - this.radius * 0.3 },
      this.radius * 0.2,
      '#666677'
    );
  }

  private renderWall(renderer: Renderer, pos: { x: number; y: number }): void {
    // Shadow
    renderer.drawRect(
      { x: pos.x + 3, y: pos.y + 3 },
      this.width,
      this.height,
      'rgba(0, 0, 0, 0.3)'
    );
    // Main wall
    renderer.drawRect(pos, this.width, this.height, '#444455', '#333344', 2);
    // Highlight
    renderer.drawRect(
      { x: pos.x, y: pos.y - this.height * 0.3 },
      this.width * 0.8,
      2,
      '#555566'
    );
  }

  private renderCrate(renderer: Renderer, pos: { x: number; y: number }): void {
    // Shadow
    renderer.drawRect(
      { x: pos.x + 2, y: pos.y + 2 },
      this.width,
      this.height,
      'rgba(0, 0, 0, 0.3)'
    );
    // Main crate
    renderer.drawRect(pos, this.width, this.height, '#775533', '#553322', 2);
    // Cross pattern
    renderer.drawLine(
      { x: pos.x - this.width / 2, y: pos.y - this.height / 2 },
      { x: pos.x + this.width / 2, y: pos.y + this.height / 2 },
      '#664422',
      2
    );
    renderer.drawLine(
      { x: pos.x + this.width / 2, y: pos.y - this.height / 2 },
      { x: pos.x - this.width / 2, y: pos.y + this.height / 2 },
      '#664422',
      2
    );

    // Health bar if damaged
    if (this.health < this.maxHealth) {
      renderer.drawBar(
        { x: pos.x, y: pos.y - this.height / 2 - 10 },
        this.width,
        4,
        this.health,
        this.maxHealth,
        '#ffaa44'
      );
    }
  }

  private renderBuilding(renderer: Renderer, pos: { x: number; y: number }): void {
    // Shadow
    renderer.drawRect(
      { x: pos.x + 4, y: pos.y + 4 },
      this.width,
      this.height,
      'rgba(0, 0, 0, 0.4)'
    );
    // Main building
    renderer.drawRect(pos, this.width, this.height, '#334455', '#223344', 3);
    // Windows
    const windowSize = Math.min(this.width, this.height) * 0.15;
    const windowGap = windowSize * 2;
    for (let wx = -this.width / 3; wx <= this.width / 3; wx += windowGap) {
      for (let wy = -this.height / 3; wy <= this.height / 3; wy += windowGap) {
        renderer.drawRect(
          { x: pos.x + wx, y: pos.y + wy },
          windowSize,
          windowSize,
          '#112233'
        );
      }
    }
  }
}

// Helper to create random obstacles
export function createRandomObstacle(x: number, y: number): Obstacle {
  const rand = Math.random();
  let type: ObstacleType;
  let width: number;
  let height: number;

  if (rand < 0.4) {
    type = ObstacleType.ROCK;
    const size = 30 + Math.random() * 40;
    width = height = size;
  } else if (rand < 0.6) {
    type = ObstacleType.WALL;
    width = 20 + Math.random() * 30;
    height = 60 + Math.random() * 100;
    if (Math.random() > 0.5) {
      [width, height] = [height, width]; // Horizontal walls
    }
  } else if (rand < 0.8) {
    type = ObstacleType.CRATE;
    const size = 25 + Math.random() * 20;
    width = height = size;
  } else {
    type = ObstacleType.BUILDING;
    width = 100 + Math.random() * 150;
    height = 100 + Math.random() * 150;
  }

  return new Obstacle(x, y, width, height, type);
}
