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

  // Terrain features
  terrainPatches: { x: number; y: number; radius: number; color: string }[] = [];
  waterBodies: { x: number; y: number; radiusX: number; radiusY: number; rotation: number }[] = [];
  decorations: { x: number; y: number; size: number; color: string; type: 'rock' | 'grass' }[] = [];

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

    // Generate map - order matters! Spawn sites and delivery site must exist before terrain
    this.generateSpawnSites();
    this.deliverySite = this.generateDeliverySite();
    this.generateTerrain();  // Terrain uses spawn/delivery positions for paths
    this.generateObstacles();
    this.generateLoot();
  }

  private generateTerrain(): void {
    // 1. Generate underlying texture patches (Dirt/Sand/Darker Grass)
    for (let i = 0; i < 40; i++) {
      const x = randomRange(0, this.width);
      const y = randomRange(0, this.height);
      const radius = randomRange(100, 300);
      // Mix of dirt and darker grass patches
      const color = Math.random() > 0.5 ? '#1a1f10' : '#282b1c';
      this.terrainPatches.push({ x, y, radius, color });
    }

    // 2. Generate Water Bodies (Ponds/Puddles)
    for (let i = 0; i < 8; i++) {
      const x = randomRange(200, this.width - 200);
      const y = randomRange(200, this.height - 200);
      const radiusX = randomRange(60, 150);
      const radiusY = radiusX * randomRange(0.6, 1.2);
      const rotation = randomRange(0, Math.PI);

      // Avoid center (Convergence Zone)
      if (distanceVec2({ x, y }, { x: this.width / 2, y: this.height / 2 }) > 600) {
        this.waterBodies.push({ x, y, radiusX, radiusY, rotation });
      }
    }

    // 3. Generate Small Decorations (Rocks & Grass Tufts)
    for (let i = 0; i < 300; i++) {
      const x = randomRange(0, this.width);
      const y = randomRange(0, this.height);
      const type = Math.random() > 0.3 ? 'grass' : 'rock';

      if (type === 'grass') {
        const size = randomRange(3, 6);
        const color = Math.random() > 0.5 ? '#3a4f2c' : '#2d3d22';
        this.decorations.push({ x, y, size, color, type });
      } else {
        const size = randomRange(4, 12);
        const color = randomRange(0, 1) > 0.5 ? '#555560' : '#444450';
        this.decorations.push({ x, y, size, color, type });
      }
    }

    // 4. Generate Connecting Paths (Sidewalks/Dirt Trails)
    const pointsOfInterest = [
      ...this.spawnSites.map(s => s.position),
      this.deliverySite.position
    ];

    // Create random paths between some points
    for (let i = 0; i < 5; i++) {
      // Pick random start/end points if available, else random map points
      const start = pointsOfInterest.length > 0
        ? pointsOfInterest[Math.floor(Math.random() * pointsOfInterest.length)]
        : { x: randomRange(0, this.width), y: randomRange(0, this.height) };

      let end = pointsOfInterest.length > 0
        ? pointsOfInterest[Math.floor(Math.random() * pointsOfInterest.length)]
        : { x: randomRange(0, this.width), y: randomRange(0, this.height) };

      let attempts = 0;
      while (distanceVec2(start, end) < 100 && attempts < 10) {
        end = pointsOfInterest.length > 0
          ? pointsOfInterest[Math.floor(Math.random() * pointsOfInterest.length)]
          : { x: randomRange(0, this.width), y: randomRange(0, this.height) };
        attempts++;
      }

      const func = (t: number) => {
        const p1 = start;
        const p2 = end;
        const mid = {
          x: (p1.x + p2.x) / 2 + randomRange(-200, 200),
          y: (p1.y + p2.y) / 2 + randomRange(-200, 200)
        };

        // Quadratic bezier
        const oneMinusT = 1 - t;
        return {
          x: oneMinusT * oneMinusT * p1.x + 2 * oneMinusT * t * mid.x + t * t * p2.x,
          y: oneMinusT * oneMinusT * p1.y + 2 * oneMinusT * t * mid.y + t * t * p2.y
        };
      };

      // Rasterize
      for (let t = 0; t <= 1; t += 0.05) {
        const pos = func(t);
        const color = Math.random() > 0.5 ? '#3a3a35' : '#42423e';
        this.terrainPatches.push({ x: pos.x, y: pos.y, radius: randomRange(25, 45), color });
      }
    }

    // 5. Generate Sand Patches near Water
    for (const pool of this.waterBodies) {
      const count = 8;
      for (let j = 0; j < count; j++) {
        const angle = (j / count) * Math.PI * 2;
        const dist = Math.max(pool.radiusX, pool.radiusY) + randomRange(10, 30);
        const x = pool.x + Math.cos(angle) * dist;
        const y = pool.y + Math.sin(angle) * dist;
        this.terrainPatches.push({ x, y, radius: randomRange(30, 60), color: '#5e5b45' });
      }
    }
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

        // Check distance from center
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

        // Check distance from plant sites (CRITICAL: prevents invisible obstacle bug)
        for (const plantSite of this.plantSites) {
          if (distanceVec2({ x, y }, plantSite.position) < plantSite.radius + 60) {
            valid = false;
            break;
          }
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

        // Check collision with obstacles (NEW!)
        for (const obstacle of this.obstacles) {
          // Keep relics away from obstacles with some padding
          if (distanceVec2({ x, y }, obstacle.position) < obstacle.radius + 60) {
            valid = false;
            break;
          }
        }

        // Check collision with water bodies (NEW!)
        for (const pool of this.waterBodies) {
          const maxRadius = Math.max(pool.radiusX, pool.radiusY);
          if (distanceVec2({ x, y }, { x: pool.x, y: pool.y }) < maxRadius + 40) {
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

  /**
   * Regenerate obstacles after plant sites are set
   * This ensures no obstacles spawn inside plant sites
   */
  regenerateObstacles(): void {
    this.obstacles = [];
    this.generateObstacles();
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
    const ctx = renderer.getContext();
    const camera = renderer.getCamera();

    // 1. Draw Map Base (Grass)
    renderer.drawRect(
      { x: this.width / 2, y: this.height / 2 },
      this.width,
      this.height,
      '#151a12', // Deep Organic Green
      '#000000',
      0
    );

    // 2. Draw Terrain Patches
    for (const patch of this.terrainPatches) {
      renderer.drawCircle({ x: patch.x, y: patch.y }, patch.radius, patch.color, undefined, 0);
    }

    // 3. Draw Water Bodies (using raw context for ellipse rotation)
    ctx.save();
    for (const pool of this.waterBodies) {
      const screenPos = renderer.worldToScreen({ x: pool.x, y: pool.y });
      // Scale dimensions
      const rX = pool.radiusX * camera.zoom;
      const rY = pool.radiusY * camera.zoom;

      // Culling
      if (screenPos.x < -rX || screenPos.x > renderer.getScreenSize().x + rX ||
        screenPos.y < -rY || screenPos.y > renderer.getScreenSize().y + rY) continue;

      ctx.beginPath();
      ctx.ellipse(screenPos.x, screenPos.y, rX, rY, pool.rotation, 0, Math.PI * 2);
      ctx.fillStyle = '#1e2b34'; // Dark water
      ctx.fill();
      ctx.strokeStyle = '#2a3c48'; // Coastline
      ctx.lineWidth = 2 * camera.zoom;
      ctx.stroke();
    }
    ctx.restore();

    // 4. Draw Subtle Tech Grid (Overlay)
    const gridSize = 100;
    const gridColor = 'rgba(100, 255, 200, 0.03)'; // Very subtle teal
    const majorGridColor = 'rgba(100, 255, 200, 0.06)';

    // Optimized grid drawing
    const bounds = renderer.getVisibleBounds();
    const startX = Math.floor(Math.max(0, bounds.x) / gridSize) * gridSize;
    const endX = Math.ceil(Math.min(this.width, bounds.x + bounds.width) / gridSize) * gridSize;
    const startY = Math.floor(Math.max(0, bounds.y) / gridSize) * gridSize;
    const endY = Math.ceil(Math.min(this.height, bounds.y + bounds.height) / gridSize) * gridSize;

    for (let x = startX; x <= endX; x += gridSize) {
      const isMajor = x % (gridSize * 5) === 0;
      renderer.drawLine(
        { x, y: Math.max(0, bounds.y) },
        { x, y: Math.min(this.height, bounds.y + bounds.height) },
        isMajor ? majorGridColor : gridColor,
        isMajor ? 2 : 1
      );
    }

    for (let y = startY; y <= endY; y += gridSize) {
      const isMajor = y % (gridSize * 5) === 0;
      renderer.drawLine(
        { x: Math.max(0, bounds.x), y },
        { x: Math.min(this.width, bounds.x + bounds.width), y },
        isMajor ? majorGridColor : gridColor,
        isMajor ? 2 : 1
      );
    }

    // 5. Draw Decorations (Rocks/Grass)
    for (const dec of this.decorations) {
      // Culling
      if (dec.x < bounds.x - 20 || dec.x > bounds.x + bounds.width + 20 ||
        dec.y < bounds.y - 20 || dec.y > bounds.y + bounds.height + 20) continue;

      if (dec.type === 'grass') {
        renderer.drawCircle({ x: dec.x, y: dec.y }, dec.size, dec.color);
      } else {
        renderer.drawCircle({ x: dec.x, y: dec.y }, dec.size, dec.color, '#2a2a30', 2);
      }
    }

    // Map Border
    renderer.drawRect(
      { x: this.width / 2, y: this.height / 2 },
      this.width,
      this.height,
      undefined,
      '#445566',
      8
    );
  }

  // Check collision with obstacles
  checkObstacleCollision(position: Vector2, radius: number): Obstacle | null {
    // 1. Check Standard Obstacles
    for (const obstacle of this.obstacles) {
      const dist = distanceVec2(position, obstacle.position);
      if (dist < radius + obstacle.radius) {
        return obstacle;
      }
    }

    // 2. Check Water Bodies (Simple Ellipse Collision)
    for (const pool of this.waterBodies) {
      // Transform point to local space of ellipse
      // Translate
      const dx = position.x - pool.x;
      const dy = position.y - pool.y;

      // Rotate (inverse rotation)
      const cos = Math.cos(-pool.rotation);
      const sin = Math.sin(-pool.rotation);
      const localX = dx * cos - dy * sin;
      const localY = dx * sin + dy * cos;

      // Ellipse check: (x/a)^2 + (y/b)^2 <= 1
      // Inflate radius slightly to account for player size approximation
      const a = pool.radiusX + radius * 0.5;
      const b = pool.radiusY + radius * 0.5;

      if ((localX * localX) / (a * a) + (localY * localY) / (b * b) <= 1) {
        // Return a mocked obstacle for water
        // We use the Obstacle interface but cast as any or construct minimal compatible object
        return {
          id: 'water',
          position: { x: pool.x, y: pool.y },
          radius: Math.max(pool.radiusX, pool.radiusY),
          type: 'obstacle',
          health: 100,
          maxHealth: 100,
          isDestroyed: false,
          render: () => { },
          takeDamage: () => 0
        } as unknown as Obstacle;
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
