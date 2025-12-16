// Core game types for RIFTLINE

export type Role = 'vanguard' | 'skirmisher' | 'sentinel' | 'catalyst';

export type WeaponType = 'automatic' | 'semi-automatic' | 'burst';
export type WeaponRarity = 'common' | 'uncommon' | 'rare';

export type MatchPhase = 'waiting' | 'dropping' | 'open' | 'compression' | 'convergence' | 'ended';

export interface Vector2 {
  x: number;
  y: number;
}

export interface RoleStats {
  maxHealth: number;
  maxShield: number;
  moveSpeed: number;
  hitboxRadius: number;
  awarenessRange: number;
  relicCarrySpeed: number; // multiplier
}

export const ROLE_STATS: Record<Role, RoleStats> = {
  vanguard: {
    maxHealth: 150,
    maxShield: 100,
    moveSpeed: 180,
    hitboxRadius: 24,
    awarenessRange: 200,
    relicCarrySpeed: 1.0,
  },
  skirmisher: {
    maxHealth: 100,
    maxShield: 75,
    moveSpeed: 220,
    hitboxRadius: 18,
    awarenessRange: 250,
    relicCarrySpeed: 0.85,
  },
  sentinel: {
    maxHealth: 80,
    maxShield: 50,
    moveSpeed: 200,
    hitboxRadius: 14,
    awarenessRange: 350,
    relicCarrySpeed: 0.7,
  },
  catalyst: {
    maxHealth: 100,
    maxShield: 75,
    moveSpeed: 200,
    hitboxRadius: 18,
    awarenessRange: 280,
    relicCarrySpeed: 0.8,
  },
};

export interface WeaponStats {
  damage: number;
  fireRate: number; // rounds per second
  magazineSize: number;
  reloadTime: number; // seconds
  range: number;
  spread: number; // degrees
  projectileSpeed: number;
}

export interface Weapon {
  id: string;
  name: string;
  type: WeaponType;
  rarity: WeaponRarity;
  stats: WeaponStats;
  gridSize: { width: number; height: number };
}

export interface Player {
  id: string;
  name: string;
  teamId: string;
  role: Role;
  position: Vector2;
  velocity: Vector2;
  rotation: number; // radians, direction facing
  health: number;
  shield: number;
  isAlive: boolean;
  respawnTimer: number; // seconds remaining, 0 if alive
  weapon: Weapon | null;
  orbs: number;
  carryingRelic: Relic | null;
}

export interface Team {
  id: string;
  name: string;
  color: string;
  playerIds: string[];
  orbs: number;
  isEliminated: boolean;
  relicsDelivered: number;
}

export interface Relic {
  id: string;
  position: Vector2;
  targetSiteId: string;
  carriedByPlayerId: string | null;
  isDelivered: boolean;
}

export interface DeliverySite {
  id: string;
  position: Vector2;
  radius: number;
  acceptsRelicId: string;
}

export interface RiftlineRing {
  id: string;
  center: Vector2;
  currentRadius: number;
  targetRadius: number;
  shrinkRate: number; // units per second
  damage: number; // damage per second when outside
}

export interface MatchState {
  id: string;
  phase: MatchPhase;
  timeElapsed: number;
  teams: Map<string, Team>;
  players: Map<string, Player>;
  relics: Map<string, Relic>;
  deliverySites: Map<string, DeliverySite>;
  rings: RiftlineRing[];
  vaultPosition: Vector2 | null;
  vaultRadius: number;
}

export interface InputState {
  moveDirection: Vector2; // normalized or zero
  aimDirection: Vector2; // normalized or zero
  firing: boolean;
  interacting: boolean;
  healing: boolean;
  reloading: boolean;
}

export interface GameConfig {
  mapWidth: number;
  mapHeight: number;
  teamsCount: number;
  playersPerTeam: number;
  relicCount: number;
  baseRespawnTime: number; // seconds
  orbRespawnReduction: number; // seconds per orb
  orbDropCount: number; // orbs dropped on elimination
}

export const DEFAULT_CONFIG: GameConfig = {
  mapWidth: 3000,
  mapHeight: 3000,
  teamsCount: 10,
  playersPerTeam: 3,
  relicCount: 5,
  baseRespawnTime: 15,
  orbRespawnReduction: 1.5,
  orbDropCount: 3,
};
