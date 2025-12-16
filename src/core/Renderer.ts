import type { Vector2, Player, Team, Relic, DeliverySite, RiftlineRing, MatchPhase, Structure } from '../types';
import { ROLE_STATS } from '../types';
import { Camera } from './Camera';
import { InputManager } from './InputManager';
import { vec2, vec2Length, vec2Sub, vec2Angle, pointInCircle } from '../utils/math';

const COLORS = {
  background: '#0a0a0f',
  grid: '#1a1a25',
  gridMajor: '#252535',
  riftlineSafe: 'rgba(0, 247, 255, 0.1)',
  riftlineDanger: 'rgba(255, 50, 80, 0.3)',
  riftlineBorder: '#00f7ff',
  relic: '#ffd700',
  relicGlow: 'rgba(255, 215, 0, 0.3)',
  site: '#00ff88',
  siteGlow: 'rgba(0, 255, 136, 0.2)',
  vault: '#9d4edd',
  vaultGlow: 'rgba(157, 78, 221, 0.3)',
  healthBar: '#00ff88',
  shieldBar: '#00b4d8',
  healthBarBg: '#1a1a25',
  uiText: '#ffffff',
  uiTextDim: '#888899',
  // Structure colors
  structureWall: '#4a4a5a',
  structureCrate: '#8b6914',
  structurePillar: '#5a5a6a',
  structureBuilding: '#3a3a4a',
  structureBarrier: '#6a4a4a',
  structureBorder: '#666677',
};

const TEAM_COLORS = [
  '#ff4444', '#44ff44', '#4444ff', '#ffff44', '#ff44ff',
  '#44ffff', '#ff8844', '#44ff88', '#8844ff', '#ff4488',
];

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private camera: Camera;
  private inputManager: InputManager;

  // Map bounds
  private mapWidth: number;
  private mapHeight: number;

  constructor(
    canvas: HTMLCanvasElement,
    camera: Camera,
    inputManager: InputManager,
    mapWidth: number,
    mapHeight: number
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.camera = camera;
    this.inputManager = inputManager;
    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight;

    this.handleResize();
    window.addEventListener('resize', () => this.handleResize());
  }

  private handleResize(): void {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;
  }

  clear(): void {
    this.ctx.fillStyle = COLORS.background;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  render(
    players: Map<string, Player>,
    teams: Map<string, Team>,
    relics: Map<string, Relic>,
    sites: Map<string, DeliverySite>,
    structures: Map<string, Structure>,
    rings: RiftlineRing[],
    vaultPosition: Vector2 | null,
    vaultRadius: number,
    localPlayerId: string | null,
    phase: MatchPhase
  ): void {
    this.clear();

    this.ctx.save();

    // Apply camera transform
    const dpr = window.devicePixelRatio || 1;
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(dpr, dpr);
    this.camera.applyTransform(this.ctx);

    // Render layers in order
    this.renderGrid();
    this.renderRiftlineZones(rings);
    this.renderDeliverySites(sites);
    if (vaultPosition && phase === 'convergence') {
      this.renderVault(vaultPosition, vaultRadius);
    }
    this.renderStructures(structures);
    this.renderRelics(relics);
    this.renderPlayers(players, teams, localPlayerId);

    this.ctx.restore();

    // Render UI elements (not affected by camera)
    this.renderUI(players, teams, relics, localPlayerId, phase);
    this.renderTouchControls();
  }

  private renderGrid(): void {
    const bounds = this.camera.getVisibleBounds();
    const gridSize = 100;
    const majorGridSize = 500;

    this.ctx.strokeStyle = COLORS.grid;
    this.ctx.lineWidth = 1;

    // Minor grid
    const startX = Math.floor(bounds.minX / gridSize) * gridSize;
    const startY = Math.floor(bounds.minY / gridSize) * gridSize;

    this.ctx.beginPath();
    for (let x = startX; x <= bounds.maxX; x += gridSize) {
      if (x % majorGridSize !== 0) {
        this.ctx.moveTo(x, Math.max(0, bounds.minY));
        this.ctx.lineTo(x, Math.min(this.mapHeight, bounds.maxY));
      }
    }
    for (let y = startY; y <= bounds.maxY; y += gridSize) {
      if (y % majorGridSize !== 0) {
        this.ctx.moveTo(Math.max(0, bounds.minX), y);
        this.ctx.lineTo(Math.min(this.mapWidth, bounds.maxX), y);
      }
    }
    this.ctx.stroke();

    // Major grid
    this.ctx.strokeStyle = COLORS.gridMajor;
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    for (let x = startX; x <= bounds.maxX; x += majorGridSize) {
      this.ctx.moveTo(x, Math.max(0, bounds.minY));
      this.ctx.lineTo(x, Math.min(this.mapHeight, bounds.maxY));
    }
    for (let y = startY; y <= bounds.maxY; y += majorGridSize) {
      this.ctx.moveTo(Math.max(0, bounds.minX), y);
      this.ctx.lineTo(Math.min(this.mapWidth, bounds.maxX), y);
    }
    this.ctx.stroke();

    // Map border
    this.ctx.strokeStyle = COLORS.riftlineBorder;
    this.ctx.lineWidth = 4;
    this.ctx.strokeRect(0, 0, this.mapWidth, this.mapHeight);
  }

  private renderRiftlineZones(rings: RiftlineRing[]): void {
    if (rings.length === 0) return;

    // Draw danger zone (outside all rings)
    this.ctx.fillStyle = COLORS.riftlineDanger;
    this.ctx.fillRect(0, 0, this.mapWidth, this.mapHeight);

    // Cut out safe zones
    this.ctx.globalCompositeOperation = 'destination-out';
    for (const ring of rings) {
      this.ctx.beginPath();
      this.ctx.arc(ring.center.x, ring.center.y, ring.currentRadius, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.ctx.globalCompositeOperation = 'source-over';

    // Draw ring borders
    this.ctx.strokeStyle = COLORS.riftlineBorder;
    this.ctx.lineWidth = 3;
    this.ctx.setLineDash([10, 10]);
    for (const ring of rings) {
      this.ctx.beginPath();
      this.ctx.arc(ring.center.x, ring.center.y, ring.currentRadius, 0, Math.PI * 2);
      this.ctx.stroke();

      // Target radius indicator
      if (ring.targetRadius < ring.currentRadius) {
        this.ctx.strokeStyle = 'rgba(0, 247, 255, 0.3)';
        this.ctx.beginPath();
        this.ctx.arc(ring.center.x, ring.center.y, ring.targetRadius, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.strokeStyle = COLORS.riftlineBorder;
      }
    }
    this.ctx.setLineDash([]);
  }

  private renderDeliverySites(sites: Map<string, DeliverySite>): void {
    for (const site of sites.values()) {
      // Glow
      const gradient = this.ctx.createRadialGradient(
        site.position.x, site.position.y, 0,
        site.position.x, site.position.y, site.radius
      );
      gradient.addColorStop(0, COLORS.siteGlow);
      gradient.addColorStop(1, 'transparent');
      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.arc(site.position.x, site.position.y, site.radius, 0, Math.PI * 2);
      this.ctx.fill();

      // Border
      this.ctx.strokeStyle = COLORS.site;
      this.ctx.lineWidth = 2;
      this.ctx.setLineDash([5, 5]);
      this.ctx.stroke();
      this.ctx.setLineDash([]);

      // Icon
      this.ctx.fillStyle = COLORS.site;
      this.ctx.font = 'bold 16px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText('SITE', site.position.x, site.position.y);
    }
  }

  private renderVault(position: Vector2, radius: number): void {
    // Glow
    const gradient = this.ctx.createRadialGradient(
      position.x, position.y, 0,
      position.x, position.y, radius
    );
    gradient.addColorStop(0, COLORS.vaultGlow);
    gradient.addColorStop(1, 'transparent');
    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.arc(position.x, position.y, radius, 0, Math.PI * 2);
    this.ctx.fill();

    // Border
    this.ctx.strokeStyle = COLORS.vault;
    this.ctx.lineWidth = 4;
    this.ctx.beginPath();
    this.ctx.arc(position.x, position.y, radius, 0, Math.PI * 2);
    this.ctx.stroke();

    // Icon
    this.ctx.fillStyle = COLORS.vault;
    this.ctx.font = 'bold 24px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('VAULT', position.x, position.y);
  }

  private renderStructures(structures: Map<string, Structure>): void {
    for (const structure of structures.values()) {
      this.ctx.save();

      // Move to structure position and rotate
      this.ctx.translate(structure.position.x, structure.position.y);
      this.ctx.rotate(structure.rotation);

      // Get color based on type
      let fillColor: string;
      let strokeColor = COLORS.structureBorder;

      switch (structure.type) {
        case 'wall':
          fillColor = COLORS.structureWall;
          break;
        case 'crate':
          fillColor = COLORS.structureCrate;
          break;
        case 'pillar':
          fillColor = COLORS.structurePillar;
          break;
        case 'building':
          fillColor = COLORS.structureBuilding;
          break;
        case 'barrier':
          fillColor = COLORS.structureBarrier;
          break;
        default:
          fillColor = '#444455';
      }

      // Draw structure body
      this.ctx.fillStyle = fillColor;
      this.ctx.fillRect(-structure.width / 2, -structure.height / 2, structure.width, structure.height);

      // Draw border
      this.ctx.strokeStyle = strokeColor;
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(-structure.width / 2, -structure.height / 2, structure.width, structure.height);

      // Draw damage indicator if destructible and damaged
      if (structure.isDestructible && structure.health < structure.maxHealth) {
        const healthPercent = structure.health / structure.maxHealth;

        // Cracks/damage effect
        this.ctx.strokeStyle = `rgba(0, 0, 0, ${0.5 - healthPercent * 0.3})`;
        this.ctx.lineWidth = 1;

        // Draw some crack lines
        const cracks = Math.floor((1 - healthPercent) * 5);
        for (let i = 0; i < cracks; i++) {
          const startX = (Math.random() - 0.5) * structure.width * 0.8;
          const startY = (Math.random() - 0.5) * structure.height * 0.8;
          this.ctx.beginPath();
          this.ctx.moveTo(startX, startY);
          this.ctx.lineTo(startX + (Math.random() - 0.5) * 20, startY + (Math.random() - 0.5) * 20);
          this.ctx.stroke();
        }
      }

      // Special rendering for pillars (circular)
      if (structure.type === 'pillar') {
        this.ctx.beginPath();
        this.ctx.arc(0, 0, structure.width / 2, 0, Math.PI * 2);
        this.ctx.fillStyle = fillColor;
        this.ctx.fill();
        this.ctx.strokeStyle = strokeColor;
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
      }

      this.ctx.restore();
    }
  }

  private renderRelics(relics: Map<string, Relic>): void {
    for (const relic of relics.values()) {
      if (relic.carriedByPlayerId || relic.isDelivered) continue;

      // Glow
      const gradient = this.ctx.createRadialGradient(
        relic.position.x, relic.position.y, 0,
        relic.position.x, relic.position.y, 40
      );
      gradient.addColorStop(0, COLORS.relicGlow);
      gradient.addColorStop(1, 'transparent');
      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.arc(relic.position.x, relic.position.y, 40, 0, Math.PI * 2);
      this.ctx.fill();

      // Diamond shape
      this.ctx.fillStyle = COLORS.relic;
      this.ctx.beginPath();
      this.ctx.moveTo(relic.position.x, relic.position.y - 15);
      this.ctx.lineTo(relic.position.x + 10, relic.position.y);
      this.ctx.lineTo(relic.position.x, relic.position.y + 15);
      this.ctx.lineTo(relic.position.x - 10, relic.position.y);
      this.ctx.closePath();
      this.ctx.fill();
    }
  }

  private renderPlayers(
    players: Map<string, Player>,
    teams: Map<string, Team>,
    localPlayerId: string | null
  ): void {
    // Sort so local player renders on top
    const sortedPlayers = Array.from(players.values()).sort((a, b) => {
      if (a.id === localPlayerId) return 1;
      if (b.id === localPlayerId) return -1;
      return 0;
    });

    for (const player of sortedPlayers) {
      // Skip dead non-local players, but always render local player
      if (!player.isAlive && player.id !== localPlayerId) continue;

      const team = teams.get(player.teamId);
      const teamIndex = Array.from(teams.keys()).indexOf(player.teamId);
      const color = TEAM_COLORS[teamIndex % TEAM_COLORS.length];
      const stats = ROLE_STATS[player.role];
      const isLocal = player.id === localPlayerId;

      // Player body (circle)
      this.ctx.fillStyle = color;
      this.ctx.beginPath();
      this.ctx.arc(player.position.x, player.position.y, stats.hitboxRadius, 0, Math.PI * 2);
      this.ctx.fill();

      // Direction indicator
      this.ctx.strokeStyle = isLocal ? '#ffffff' : color;
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      this.ctx.moveTo(player.position.x, player.position.y);
      const dirX = player.position.x + Math.cos(player.rotation) * (stats.hitboxRadius + 10);
      const dirY = player.position.y + Math.sin(player.rotation) * (stats.hitboxRadius + 10);
      this.ctx.lineTo(dirX, dirY);
      this.ctx.stroke();

      // Local player highlight
      if (isLocal) {
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(player.position.x, player.position.y, stats.hitboxRadius + 4, 0, Math.PI * 2);
        this.ctx.stroke();
      }

      // Health bar
      const barWidth = 40;
      const barHeight = 4;
      const barY = player.position.y - stats.hitboxRadius - 15;

      // Background
      this.ctx.fillStyle = COLORS.healthBarBg;
      this.ctx.fillRect(player.position.x - barWidth / 2, barY, barWidth, barHeight);

      // Health
      const healthPercent = player.health / stats.maxHealth;
      this.ctx.fillStyle = COLORS.healthBar;
      this.ctx.fillRect(player.position.x - barWidth / 2, barY, barWidth * healthPercent, barHeight);

      // Shield (above health)
      if (player.shield > 0) {
        const shieldPercent = player.shield / stats.maxShield;
        this.ctx.fillStyle = COLORS.shieldBar;
        this.ctx.fillRect(player.position.x - barWidth / 2, barY - 5, barWidth * shieldPercent, 3);
      }

      // Relic indicator
      if (player.carryingRelic) {
        this.ctx.fillStyle = COLORS.relic;
        this.ctx.beginPath();
        this.ctx.arc(player.position.x, player.position.y - stats.hitboxRadius - 25, 6, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }
  }

  private renderUI(
    players: Map<string, Player>,
    teams: Map<string, Team>,
    relics: Map<string, Relic>,
    localPlayerId: string | null,
    phase: MatchPhase
  ): void {
    const dpr = window.devicePixelRatio || 1;
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(dpr, dpr);

    const width = this.canvas.width / dpr;
    const height = this.canvas.height / dpr;

    // Phase indicator (top center)
    this.ctx.fillStyle = COLORS.uiText;
    this.ctx.font = 'bold 14px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'top';
    this.ctx.fillText(phase.toUpperCase(), width / 2, 15);

    // Relic status (below phase)
    const deliveredCount = Array.from(relics.values()).filter(r => r.isDelivered).length;
    this.ctx.font = '12px sans-serif';
    this.ctx.fillStyle = COLORS.relic;
    this.ctx.fillText(`RELICS: ${deliveredCount}/${relics.size}`, width / 2, 35);

    // Local player info (bottom center)
    if (localPlayerId) {
      const player = players.get(localPlayerId);
      if (player) {
        const stats = ROLE_STATS[player.role];

        // Role
        this.ctx.fillStyle = COLORS.uiTextDim;
        this.ctx.font = '12px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'bottom';
        this.ctx.fillText(player.role.toUpperCase(), width / 2, height - 80);

        // Health/Shield numbers
        this.ctx.fillStyle = COLORS.uiText;
        this.ctx.font = 'bold 18px sans-serif';
        this.ctx.fillText(`${Math.ceil(player.health)} / ${Math.ceil(player.shield)}`, width / 2, height - 60);

        // Orbs
        this.ctx.fillStyle = '#00f7ff';
        this.ctx.font = '14px sans-serif';
        this.ctx.fillText(`ORBS: ${player.orbs}`, width / 2, height - 100);
      }
    }

    // Team list (top left)
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'top';
    let y = 15;
    const localTeamId = localPlayerId ? players.get(localPlayerId)?.teamId : null;

    for (const [teamId, team] of teams) {
      if (team.isEliminated) continue;

      const teamIndex = Array.from(teams.keys()).indexOf(teamId);
      const color = TEAM_COLORS[teamIndex % TEAM_COLORS.length];
      const isLocalTeam = teamId === localTeamId;

      const alivePlayers = team.playerIds.filter(pid => players.get(pid)?.isAlive).length;

      this.ctx.fillStyle = color;
      this.ctx.font = isLocalTeam ? 'bold 12px sans-serif' : '11px sans-serif';
      this.ctx.fillText(
        `${isLocalTeam ? '>' : ' '} ${alivePlayers}/3 ${team.relicsDelivered > 0 ? `[${team.relicsDelivered}]` : ''}`,
        15,
        y
      );
      y += 16;

      if (y > 200) break; // Limit display
    }

    // Render zoom controls (top right)
    this.renderZoomControls(width);
  }

  private renderZoomControls(width: number): void {
    const buttonSize = 44;
    const buttonMargin = 15;
    const buttonY = 60;

    // Zoom out button (-)
    const zoomOutX = width - buttonMargin - buttonSize * 2 - 10;
    this.ctx.fillStyle = 'rgba(26, 26, 37, 0.8)';
    this.ctx.fillRect(zoomOutX, buttonY, buttonSize, buttonSize);
    this.ctx.strokeStyle = '#333344';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(zoomOutX, buttonY, buttonSize, buttonSize);

    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = 'bold 24px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('-', zoomOutX + buttonSize / 2, buttonY + buttonSize / 2);

    // Zoom in button (+)
    const zoomInX = width - buttonMargin - buttonSize;
    this.ctx.fillStyle = 'rgba(26, 26, 37, 0.8)';
    this.ctx.fillRect(zoomInX, buttonY, buttonSize, buttonSize);
    this.ctx.strokeStyle = '#333344';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(zoomInX, buttonY, buttonSize, buttonSize);

    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillText('+', zoomInX + buttonSize / 2, buttonY + buttonSize / 2);

    // Zoom level indicator
    const zoomLevel = Math.round(this.camera.getZoom() * 100);
    this.ctx.fillStyle = COLORS.uiTextDim;
    this.ctx.font = '10px sans-serif';
    this.ctx.fillText(`${zoomLevel}%`, width - buttonMargin - buttonSize - 5, buttonY + buttonSize + 12);
  }

  private renderTouchControls(): void {
    const dpr = window.devicePixelRatio || 1;
    const width = this.canvas.width / dpr;
    const height = this.canvas.height / dpr;

    const moveCenter = this.inputManager.getMoveStickCenter();
    const aimCenter = this.inputManager.getAimStickCenter();
    const input = this.inputManager.getInput();
    const stickRadius = this.inputManager.getMoveStickRadius();

    // Move stick
    if (moveCenter) {
      // Outer ring
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(moveCenter.x, moveCenter.y, stickRadius, 0, Math.PI * 2);
      this.ctx.stroke();

      // Inner stick position
      const stickX = moveCenter.x + input.moveDirection.x * stickRadius * 0.8;
      const stickY = moveCenter.y + input.moveDirection.y * stickRadius * 0.8;

      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      this.ctx.beginPath();
      this.ctx.arc(stickX, stickY, 20, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // Aim stick
    if (aimCenter) {
      // Outer ring (red tint for firing)
      this.ctx.strokeStyle = input.firing ? 'rgba(255, 100, 100, 0.4)' : 'rgba(255, 255, 255, 0.3)';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(aimCenter.x, aimCenter.y, stickRadius, 0, Math.PI * 2);
      this.ctx.stroke();

      // Direction indicator
      const aimX = aimCenter.x + input.aimDirection.x * stickRadius * 0.8;
      const aimY = aimCenter.y + input.aimDirection.y * stickRadius * 0.8;

      this.ctx.fillStyle = input.firing ? 'rgba(255, 100, 100, 0.6)' : 'rgba(255, 255, 255, 0.5)';
      this.ctx.beginPath();
      this.ctx.arc(aimX, aimY, 20, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // Hint text when no touches
    if (!moveCenter && !aimCenter) {
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      this.ctx.font = '14px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText('Touch left to move, right to aim & fire', width / 2, height - 30);
    }
  }
}
