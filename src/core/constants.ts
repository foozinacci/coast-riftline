// Game constants and configuration

import {
  PlayerClass,
  WeaponType,
  BackpackTier,
  RiftlinePhase,
  ClassConfig,
  WeaponConfig,
  BackpackConfig,
  GameConfig,
} from './types';

// Core game configuration
export const GAME_CONFIG: GameConfig = {
  mapWidth: 4000,
  mapHeight: 4000,
  maxTeams: 10,
  playersPerTeam: 3,
  totalRelics: 5,
  respawnBaseCooldown: 8000, // 8 seconds base
  wipeTimerDuration: 15000, // 15 seconds to respawn before squad elimination
  riftlinePhases: [
    {
      phase: RiftlinePhase.OPEN,
      duration: 120000, // 2 minutes
      damagePerSecond: 5,
      shrinkRate: 0, // no shrink yet
      respawnEfficiency: 1.0,
    },
    {
      phase: RiftlinePhase.COMPRESSION,
      duration: 180000, // 3 minutes
      damagePerSecond: 15,
      shrinkRate: 50, // units per second
      respawnEfficiency: 0.7,
    },
    {
      phase: RiftlinePhase.CONVERGENCE,
      duration: 120000, // 2 minutes
      damagePerSecond: 40,
      shrinkRate: 100,
      respawnEfficiency: 0.4,
    },
  ],
};

// Class configurations
export const CLASS_CONFIGS: Record<PlayerClass, ClassConfig> = {
  [PlayerClass.VANGUARD]: {
    name: 'Vanguard',
    class: PlayerClass.VANGUARD,
    description: 'Close-range specialist with high survivability',
    baseHealth: 125,
    baseShield: 75,
    moveSpeed: 280,
    preferredRange: 'close',
    weaponType: WeaponType.AUTOMATIC,
    proximityBonus: 0.3, // better awareness at close range
  },
  [PlayerClass.SKIRMISHER]: {
    name: 'Skirmisher',
    class: PlayerClass.SKIRMISHER,
    description: 'Balanced fighter with burst damage',
    baseHealth: 100,
    baseShield: 50,
    moveSpeed: 300,
    preferredRange: 'mid',
    weaponType: WeaponType.BURST,
    proximityBonus: 0.2,
  },
  [PlayerClass.SENTINEL]: {
    name: 'Sentinel',
    class: PlayerClass.SENTINEL,
    description: 'Long-range specialist with early detection',
    baseHealth: 75,
    baseShield: 50,
    moveSpeed: 290,
    preferredRange: 'long',
    weaponType: WeaponType.SEMI_AUTO,
    proximityBonus: 0.5, // best detection range
  },
  [PlayerClass.CATALYST]: {
    name: 'Catalyst',
    class: PlayerClass.CATALYST,
    description: 'Economy-focused support with utility',
    baseHealth: 100,
    baseShield: 50,
    moveSpeed: 310,
    preferredRange: 'utility',
    weaponType: WeaponType.UTILITY,
    proximityBonus: 0.25,
  },
};

// Weapon configurations
export const WEAPON_CONFIGS: Record<string, WeaponConfig> = {
  // Automatic weapons (Vanguard)
  'smg-standard': {
    name: 'Vector SMG',
    type: WeaponType.AUTOMATIC,
    damage: 12,
    fireRate: 12,
    magazineSize: 30,
    reloadTime: 1800,
    range: 400,
    spread: 8,
    projectileSpeed: 1200,
    inventorySize: { width: 2, height: 1 },
  },
  'shotgun-spread': {
    name: 'Scattergun',
    type: WeaponType.AUTOMATIC,
    damage: 8,
    fireRate: 2,
    magazineSize: 6,
    reloadTime: 2200,
    range: 200,
    spread: 25,
    projectileSpeed: 900,
    inventorySize: { width: 2, height: 1 },
  },

  // Burst weapons (Skirmisher)
  'rifle-burst': {
    name: 'Pulse Rifle',
    type: WeaponType.BURST,
    damage: 18,
    fireRate: 5,
    magazineSize: 24,
    reloadTime: 2000,
    range: 600,
    spread: 4,
    projectileSpeed: 1400,
    burstCount: 3,
    inventorySize: { width: 3, height: 1 },
  },
  'pistol-burst': {
    name: 'Triad Pistol',
    type: WeaponType.BURST,
    damage: 14,
    fireRate: 6,
    magazineSize: 18,
    reloadTime: 1500,
    range: 450,
    spread: 5,
    projectileSpeed: 1300,
    burstCount: 3,
    inventorySize: { width: 1, height: 1 },
  },

  // Semi-auto weapons (Sentinel)
  'rifle-marksman': {
    name: 'Longshot',
    type: WeaponType.SEMI_AUTO,
    damage: 45,
    fireRate: 1.5,
    magazineSize: 8,
    reloadTime: 2500,
    range: 1000,
    spread: 1,
    projectileSpeed: 2000,
    inventorySize: { width: 4, height: 1 },
  },
  'rifle-scout': {
    name: 'Scout Rifle',
    type: WeaponType.SEMI_AUTO,
    damage: 28,
    fireRate: 3,
    magazineSize: 12,
    reloadTime: 2000,
    range: 700,
    spread: 2,
    projectileSpeed: 1600,
    inventorySize: { width: 3, height: 1 },
  },

  // Utility weapons (Catalyst)
  'launcher-support': {
    name: 'Flux Launcher',
    type: WeaponType.UTILITY,
    damage: 25,
    fireRate: 1,
    magazineSize: 4,
    reloadTime: 3000,
    range: 500,
    spread: 0,
    projectileSpeed: 600,
    inventorySize: { width: 3, height: 2 },
  },
  'pistol-drain': {
    name: 'Siphon',
    type: WeaponType.UTILITY,
    damage: 10,
    fireRate: 4,
    magazineSize: 20,
    reloadTime: 1600,
    range: 350,
    spread: 6,
    projectileSpeed: 1100,
    inventorySize: { width: 1, height: 1 },
  },
};

// Backpack configurations
export const BACKPACK_CONFIGS: Record<BackpackTier, BackpackConfig> = {
  [BackpackTier.BASIC]: {
    tier: BackpackTier.BASIC,
    gridWidth: 4,
    gridHeight: 3,
    moveSpeedPenalty: 0,
  },
  [BackpackTier.FIELD]: {
    tier: BackpackTier.FIELD,
    gridWidth: 5,
    gridHeight: 4,
    moveSpeedPenalty: 0.05,
  },
  [BackpackTier.ASSAULT]: {
    tier: BackpackTier.ASSAULT,
    gridWidth: 6,
    gridHeight: 5,
    moveSpeedPenalty: 0.1,
  },
  [BackpackTier.RIFT]: {
    tier: BackpackTier.RIFT,
    gridWidth: 7,
    gridHeight: 6,
    moveSpeedPenalty: 0.2,
  },
};

// Default loadouts per class
export const DEFAULT_LOADOUTS: Record<PlayerClass, { weapon: string }> = {
  [PlayerClass.VANGUARD]: { weapon: 'smg-standard' },
  [PlayerClass.SKIRMISHER]: { weapon: 'rifle-burst' },
  [PlayerClass.SENTINEL]: { weapon: 'rifle-scout' },
  [PlayerClass.CATALYST]: { weapon: 'pistol-drain' },
};

// Relic configuration
export const RELIC_CONFIG = {
  movementPenalty: 0.15, // 15% slower
  revealInterval: 5000, // revealed every 5 seconds
  revealDuration: 1500, // visible for 1.5 seconds
  deliveryTime: 3000, // 3 seconds to deliver
  deliveryInterruptRange: 150, // taking damage within this range interrupts
};

// Respawn orb configuration
export const ORB_CONFIG = {
  baseValue: 2000, // ms reduction
  collectRadius: 50,
  decayTime: 30000, // 30 seconds before decay
  dropOnKill: true,
};

// Colors for squads
export const SQUAD_COLORS = [
  '#ff4444', // Red
  '#44ff44', // Green
  '#4444ff', // Blue
  '#ffff44', // Yellow
  '#ff44ff', // Magenta
  '#44ffff', // Cyan
  '#ff8844', // Orange
  '#88ff44', // Lime
  '#4488ff', // Sky blue
  '#ff4488', // Pink
];

// Visual constants
export const COLORS = {
  background: '#0a0a0f',
  riftline: '#7722ff',
  riftlineGlow: '#aa44ff',
  safeZone: '#112211',
  vault: '#ffcc00',
  relic: '#ffaa00',
  respawnOrb: '#00ffcc',
  healthBar: '#44ff44',
  shieldBar: '#4488ff',
  dangerZone: '#ff2244',
};

// Timing constants
export const TIMING = {
  tickRate: 60, // game ticks per second
  networkTickRate: 20, // network updates per second
  interpolationDelay: 100, // ms
};

// Map generation
export const MAP_CONFIG = {
  spawnSiteCount: 6,
  minSpawnDistance: 800,
  obstacleCount: 150,
  lootSpawnCount: 100,
};
