// Map generation and management system

import { Vector2, RelicPlantSite } from '../core/types';
import { GAME_CONFIG, MAP_CONFIG, COLORS } from '../core/constants';
import { distanceVec2, randomRange } from '../core/utils';
import { SpawnSite } from '../entities/SpawnSite';
import { DeliverySite } from '../entities/DeliverySite';
import { Obstacle, createRandomObstacle } from '../entities/Obstacle';
import { Relic } from '../entities/Relic';
import { Loot, createRandomLoot } from '../entities/Loot';
import { Renderer } from '../core/renderer';

const SPAWN_SITE_NAMES = [
  'Alpha Base',
  'Bravo Point',
  'Charlie Zone',
  'Delta Camp',
  'Echo Station',
  'Foxtrot Outpost',
];

export class GameMap {
  width: number;
  height: number;
  spawnSites: SpawnSite[];
  deliverySite: DeliverySite;
  obstacles: Obstacle[];
  relics: Relic[];
  plantSites: RelicPlantSite[];
  loot: Loot[];

  constructor() {
    this.width = GAME_CONFIG.mapWidth;
    this.height = GAME_CONFIG.mapHeight;
    this.spawnSites = [];
    this.obstacles = [];
    this.spawnSites = [];
    this.obstacles = [];
    this.relics = [];
    this.plantSites = [];
    this.loot = [];

    // Generate map
    this.generateSpawnSites();
    this.deliverySite = this.generateDeliverySite();
    this.generateObstacles();
    this.generateLoot();
  }

  private generateSpawnSites(): void {
    const margin = 300;
    const minDistance = MAP_CONFIG.minSpawnDistance;

    for (let i = 0; i < MAP_CONFIG.spawnSiteCount; i++) {
      let attempts = 0;
      let position: Vector2 | null = null;

      while (attempts < 100) {
        const x = randomRange(margin, this.width - margin);
        const y = randomRange(margin, this.height - margin);

        // Check distance from other spawn sites
        let valid = true;
        for (const site of this.spawnSites) {
          if (distanceVec2({ x, y }, site.position) < minDistance) {
            valid = false;
            break;
          }
        }

        // Check distance from center (delivery site area)
        const centerDist = distanceVec2({ x, y }, { x: this.width / 2, y: this.height / 2 });
        if (centerDist < 400) {
          valid = false;
        }

        if (valid) {
          position = { x, y };
          break;
        }

        attempts++;
      }

      if (position) {
        const name = SPAWN_SITE_NAMES[i] || `Site ${i + 1}`;
        this.spawnSites.push(new SpawnSite(position.x, position.y, name));
      }
    }
  }

  private generateDeliverySite(): DeliverySite {
    // Delivery site (vault) at center of map
    return new DeliverySite(this.width / 2, this.height / 2);
  }

  private generateObstacles(): void {
    const margin = 100;
    const minDistance = 80;

    for (let i = 0; i < MAP_CONFIG.obstacleCount; i++) {
      let attempts = 0;

      while (attempts < 50) {
        const x = randomRange(margin, this.width - margin);
        const y = randomRange(margin, this.height - margin);

        // Check distance from spawn sites
        let valid = true;
        for (const site of this.spawnSites) {
          if (distanceVec2({ x, y }, site.position) < site.radius + 50) {
            valid = false;
            break;
          }
        }

        // Check distance from delivery site
        if (distanceVec2({ x, y }, this.deliverySite.position) < this.deliverySite.radius + 50) {
          valid = false;
        }

        // Check distance from other obstacles
        for (const obs of this.obstacles) {
          if (distanceVec2({ x, y }, obs.position) < minDistance) {
            valid = false;
            break;
          }
        }

        if (valid) {
          this.obstacles.push(createRandomObstacle(x, y));
          break;
        }

        attempts++;
      }
    }
  }

  generateRelicPositions(): void {
    this.relics = [];
    const margin = 400;
    const minDistance = 500;
    const positions: Vector2[] = [];

    for (let i = 0; i < GAME_CONFIG.totalRelics; i++) {
      let attempts = 0;
      let position: Vector2 | null = null;

      while (attempts < 100) {
        const x = randomRange(margin, this.width - margin);
        const y = randomRange(margin, this.height - margin);

        let valid = true;

        // Check distance from other relics
        for (const pos of positions) {
          if (distanceVec2({ x, y }, pos) < minDistance) {
            valid = false;
            break;
          }
        }

        // Check distance from delivery site (not too close)
        if (distanceVec2({ x, y }, this.deliverySite.position) < 300) {
          valid = false;
        }

        // Check distance from spawn sites (not too close)
        for (const site of this.spawnSites) {
          if (distanceVec2({ x, y }, site.position) < 200) {
            valid = false;
            break;
          }
        }

        if (valid) {
          position = { x, y };
          positions.push(position);
          break;
        }

        attempts++;
      }

      if (position) {
        this.relics.push(new Relic(position.x, position.y));
      }
    }
  }

  private generateLoot(): void {
    const margin = 150;

    for (let i = 0; i < MAP_CONFIG.lootSpawnCount; i++) {
      let attempts = 0;

      while (attempts < 30) {
        const x = randomRange(margin, this.width - margin);
        const y = randomRange(margin, this.height - margin);

        // Check not inside obstacles
        let valid = true;
        for (const obs of this.obstacles) {
          if (distanceVec2({ x, y }, obs.position) < obs.radius + 20) {
            valid = false;
            break;
          }
        }

        if (valid) {
          this.loot.push(createRandomLoot(x, y));
          break;
        }

        attempts++;
      }
    }
  }

  getSpawnSiteById(id: string): SpawnSite | undefined {
    return this.spawnSites.find(site => site.id === id);
  }

  update(dt: number): void {
    // Update relics
    for (const relic of this.relics) {
      if (relic.isActive) {
        relic.update(dt);
      }
    }

    // Update loot
    for (const item of this.loot) {
      if (item.isActive) {
        item.update(dt);
      }
    }

    // Clean up inactive entities
    this.relics = this.relics.filter(r => r.isActive);
    this.loot = this.loot.filter(l => l.isActive);
  }

  render(renderer: Renderer): void {
    // Draw ground/grid
    this.renderGround(renderer);

    // Render obstacles
    for (const obstacle of this.obstacles) {
      obstacle.render(renderer);
    }

    // Render spawn sites
    for (const site of this.spawnSites) {
      site.render(renderer);
    }

    // Render delivery site
    this.deliverySite.render(renderer);

    // Render loot
    for (const item of this.loot) {
      if (item.isActive) {
        item.render(renderer);
      }
    }

    // Render relics
    for (const relic of this.relics) {
      if (relic.isActive) {
        relic.render(renderer);
      }
    }

    // Render plant sites
    for (const site of this.plantSites) {
      // Draw site circle
      renderer.drawCircle(site.position, site.radius, '#112233', '#44ff44', 2);

      // Draw label
      if (site.hasPlantedRelic) {
        renderer.drawText('PLANTED', site.position, '#44ff44', 12);
      } else {
        renderer.drawText('PLANT HERE', site.position, '#aaaaaa', 10);
      }
    }
  }

  private renderGround(renderer: Renderer): void {
    // Draw map boundary
    renderer.drawRect(
      { x: this.width / 2, y: this.height / 2 },
      this.width,
      this.height,
      '#0d0d14',
      '#222233',
      4
    );

    // Draw grid
    const gridSize = 200;
    const gridColor = 'rgba(50, 50, 70, 0.3)';

    for (let x = 0; x <= this.width; x += gridSize) {
      renderer.drawLine(
        { x, y: 0 },
        { x, y: this.height },
        gridColor,
        1
      );
    }

    for (let y = 0; y <= this.height; y += gridSize) {
      renderer.drawLine(
        { x: 0, y },
        { x: this.width, y },
        gridColor,
        1
      );
    }
  }

  // Check collision with obstacles
  checkObstacleCollision(position: Vector2, radius: number): Obstacle | null {
    for (const obstacle of this.obstacles) {
      const dist = distanceVec2(position, obstacle.position);
      if (dist < radius + obstacle.radius) {
        return obstacle;
      }
    }
    return null;
  }

  // Get obstacle blocking line of sight
  getObstacleBlocking(from: Vector2, to: Vector2): Obstacle | null {
    for (const obstacle of this.obstacles) {
      if (this.lineCircleIntersection(from, to, obstacle.position, obstacle.radius)) {
        return obstacle;
      }
    }
    return null;
  }

  private lineCircleIntersection(
    lineStart: Vector2,
    lineEnd: Vector2,
    circleCenter: Vector2,
    circleRadius: number
  ): boolean {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    const fx = lineStart.x - circleCenter.x;
    const fy = lineStart.y - circleCenter.y;

    const a = dx * dx + dy * dy;
    const b = 2 * (fx * dx + fy * dy);
    const c = fx * fx + fy * fy - circleRadius * circleRadius;

    const discriminant = b * b - 4 * a * c;

    if (discriminant < 0) return false;

    const sqrtDisc = Math.sqrt(discriminant);
    const t1 = (-b - sqrtDisc) / (2 * a);
    const t2 = (-b + sqrtDisc) / (2 * a);

    return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1);
  }
}
