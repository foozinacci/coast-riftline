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
  GameMode,
  MatchStructure,
  Rarity, // Added Rarity
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
  // Default game mode settings
  mode: GameMode.MAIN,
  structure: MatchStructure.SINGLE_MATCH,
  roundsToWin: 1,
};

// Class configurations
// Class configurations
export const CLASS_CONFIGS: Record<PlayerClass, ClassConfig> = {
  [PlayerClass.SCOUT]: {
    name: 'Scout',
    class: PlayerClass.SCOUT,
    description: 'High mobility flanker who leads the team',
    baseHealth: 75,
    baseShield: 50,
    moveSpeed: 350, // Fast
    dashes: 3,
    passiveDescription: 'Momentum Trail (Speed Boost)',
    tacticalDescription: 'Momentum Trail',
    tacticalParameter: 'Trail Length/Width',
  },
  [PlayerClass.VANGUARD]: {
    name: 'Vanguard',
    class: PlayerClass.VANGUARD,
    description: 'Tanky defender who builds cover',
    baseHealth: 100,
    baseShield: 125,
    moveSpeed: 250, // Slow
    dashes: 2,
    passiveDescription: '5% Damage Reduction',
    tacticalDescription: 'Build/Repair Cover (35 HP)',
    tacticalParameter: 'Build Range',
  },
  [PlayerClass.MEDIC]: {
    name: 'Medic',
    class: PlayerClass.MEDIC,
    description: 'Support healer who shares sustainability',
    baseHealth: 100,
    baseShield: 75,
    moveSpeed: 300, // Medium
    dashes: 2,
    passiveDescription: '50% Faster Consumables',
    tacticalDescription: 'Shared Heals',
    tacticalParameter: 'Heal Radius',
  },
  [PlayerClass.SCAVENGER]: {
    name: 'Scavenger',
    class: PlayerClass.SCAVENGER,
    description: 'Resource specialist with team buffs',
    baseHealth: 75,
    baseShield: 75,
    moveSpeed: 300, // Medium
    dashes: 2,
    passiveDescription: 'Static Respawn & Orb Buffs',
    tacticalDescription: 'Orb Team Buff',
    tacticalParameter: 'Effect Radius',
  },
};

// Weapon configurations
// Weapon configurations
export const WEAPON_CONFIGS: Record<string, WeaponConfig> = {
  // --- AUTOMATIC (Light) ---
  'auto_common': {
    id: 'auto_common',
    name: 'Auto Rifle (Common)',
    type: WeaponType.AUTOMATIC,
    rarity: Rarity.COMMON,
    damage: 5,
    magazineSize: 30,
    fireRate: 8, // "Slow"
    reloadTime: 2500,
    range: 400, // Short
    projectileSpeed: 800,
  },
  'auto_uncommon': {
    id: 'auto_uncommon',
    name: 'Auto Rifle (Uncommon)',
    type: WeaponType.AUTOMATIC,
    rarity: Rarity.UNCOMMON,
    damage: 5,
    magazineSize: 30,
    fireRate: 10, // "Medium"
    reloadTime: 2000,
    range: 600, // Medium
    projectileSpeed: 900,
  },
  'auto_rare': {
    id: 'auto_rare',
    name: 'Auto Rifle (Rare)',
    type: WeaponType.AUTOMATIC,
    rarity: Rarity.RARE,
    damage: 5,
    magazineSize: 30,
    fireRate: 12, // "Fast"
    reloadTime: 1500,
    range: 600, // Medium
    projectileSpeed: 1000,
  },

  // --- SEMI (Medium) ---
  'semi_common': {
    id: 'semi_common',
    name: 'DMR (Common)',
    type: WeaponType.SEMI_AUTO,
    rarity: Rarity.COMMON,
    damage: 12,
    magazineSize: 12,
    fireRate: 3, // "Slow"
    reloadTime: 2200,
    range: 600, // Medium
    projectileSpeed: 1200,
  },
  'semi_uncommon': {
    id: 'semi_uncommon',
    name: 'DMR (Uncommon)',
    type: WeaponType.SEMI_AUTO,
    rarity: Rarity.UNCOMMON,
    damage: 12,
    magazineSize: 12,
    fireRate: 4, // "Medium"
    reloadTime: 1800,
    range: 800, // Long
    projectileSpeed: 1400,
  },
  'semi_rare': {
    id: 'semi_rare',
    name: 'DMR (Rare)',
    type: WeaponType.SEMI_AUTO,
    rarity: Rarity.RARE,
    damage: 12,
    magazineSize: 12,
    fireRate: 5, // "Fast"
    reloadTime: 1400,
    range: 800, // Long
    projectileSpeed: 1600,
  },

  // --- CHARGE (Heavy) ---
  'charge_common': {
    id: 'charge_common',
    name: 'Railgun (Common)',
    type: WeaponType.CHARGE,
    rarity: Rarity.COMMON,
    damage: 50,
    magazineSize: 3,
    fireRate: 0.5, // N/A due to charge, but effectively slow
    reloadTime: 3500,
    range: 600, // Medium
    projectileSpeed: 2000,
    chargeTime: 2000,
  },
  'charge_uncommon': {
    id: 'charge_uncommon',
    name: 'Railgun (Uncommon)',
    type: WeaponType.CHARGE,
    rarity: Rarity.UNCOMMON,
    damage: 50,
    magazineSize: 3,
    fireRate: 0.6,
    reloadTime: 2800,
    range: 800, // Long
    projectileSpeed: 2500,
    chargeTime: 1500,
  },
  'charge_rare': {
    id: 'charge_rare',
    name: 'Railgun (Rare)',
    type: WeaponType.CHARGE,
    rarity: Rarity.RARE,
    damage: 50,
    magazineSize: 3,
    fireRate: 1.0,
    reloadTime: 2000,
    range: 1200, // Very Long
    projectileSpeed: 3000,
    chargeTime: 1000,
  },

  // --- BURST (Medium) ---
  'burst_common': {
    id: 'burst_common',
    name: 'Burst Rifle (Common)',
    type: WeaponType.BURST,
    rarity: Rarity.COMMON,
    damage: 10,
    magazineSize: 15, // 5 bursts * 3
    fireRate: 2, // bursts per second roughly (delay driven)
    reloadTime: 2400,
    range: 400, // Short
    projectileSpeed: 900,
    burstCount: 3,
    burstDelay: 300, // Slow delay
  },
  'burst_uncommon': {
    id: 'burst_uncommon',
    name: 'Burst Rifle (Uncommon)',
    type: WeaponType.BURST,
    rarity: Rarity.UNCOMMON,
    damage: 10,
    magazineSize: 15,
    fireRate: 3,
    reloadTime: 1900,
    range: 600, // Medium
    projectileSpeed: 1000,
    burstCount: 3,
    burstDelay: 200, // Medium delay
  },
  'burst_rare': {
    id: 'burst_rare',
    name: 'Burst Rifle (Rare)',
    type: WeaponType.BURST,
    rarity: Rarity.RARE,
    damage: 10,
    magazineSize: 15,
    fireRate: 4,
    reloadTime: 1400,
    range: 800, // Long
    projectileSpeed: 1100,
    burstCount: 3,
    burstDelay: 100, // Fast delay
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
// Default loadouts per class (Starting with Common)
export const DEFAULT_LOADOUTS: Record<PlayerClass, { weapon: string }> = {
  [PlayerClass.SCOUT]: { weapon: 'auto_common' },
  [PlayerClass.VANGUARD]: { weapon: 'auto_common' },
  [PlayerClass.MEDIC]: { weapon: 'semi_common' },
  [PlayerClass.SCAVENGER]: { weapon: 'burst_common' },
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
