// Core type definitions for RIFTLINE

export interface Vector2 {
  x: number;
  y: number;
}

export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Circle {
  x: number;
  y: number;
  radius: number;
}

// Game state phases
export enum GamePhase {
  LOBBY = 'lobby',
  CLASS_SELECT = 'class_select',
  SPAWN_VOTE = 'spawn_vote',
  COUNTDOWN = 'countdown',
  PLAYING = 'playing',
  VAULT_PHASE = 'vault_phase',
  GAME_OVER = 'game_over',
}

// Riftline (storm) phases
export enum RiftlinePhase {
  OPEN = 'open',
  COMPRESSION = 'compression',
  CONVERGENCE = 'convergence',
}

// Player classes
export enum PlayerClass {
  VANGUARD = 'vanguard',
  SKIRMISHER = 'skirmisher',
  SENTINEL = 'sentinel',
  CATALYST = 'catalyst',
}

// Weapon archetypes
export enum WeaponType {
  AUTOMATIC = 'automatic',
  BURST = 'burst',
  SEMI_AUTO = 'semi_auto',
  UTILITY = 'utility',
}

// Item rarity levels
export enum Rarity {
  COMMON = 'common',
  UNCOMMON = 'uncommon',
  RARE = 'rare',
  EPIC = 'epic',
  LEGENDARY = 'legendary',
}

// Backpack tiers
export enum BackpackTier {
  BASIC = 'basic',
  FIELD = 'field',
  ASSAULT = 'assault',
  RIFT = 'rift',
}

// Entity types for collision and rendering
export enum EntityType {
  PLAYER = 'player',
  PROJECTILE = 'projectile',
  LOOT = 'loot',
  RELIC = 'relic',
  SPAWN_SITE = 'spawn_site',
  DELIVERY_SITE = 'delivery_site',
  RESPAWN_ORB = 'respawn_orb',
  OBSTACLE = 'obstacle',
}

// Class configuration
export interface ClassConfig {
  name: string;
  class: PlayerClass;
  description: string;
  baseHealth: number;
  baseShield: number;
  moveSpeed: number;
  preferredRange: 'close' | 'mid' | 'long' | 'utility';
  weaponType: WeaponType;
  proximityBonus: number;
}

// Weapon configuration
export interface WeaponConfig {
  name: string;
  type: WeaponType;
  damage: number;
  fireRate: number; // shots per second
  magazineSize: number;
  reloadTime: number; // ms
  range: number;
  spread: number; // accuracy cone in degrees
  projectileSpeed: number;
  burstCount?: number; // for burst weapons
  inventorySize: { width: number; height: number };
}

// Backpack configuration
export interface BackpackConfig {
  tier: BackpackTier;
  gridWidth: number;
  gridHeight: number;
  moveSpeedPenalty: number; // percentage reduction
}

// Player loadout
export interface Loadout {
  class: PlayerClass;
  primaryWeapon: string;
  backpackTier: BackpackTier;
}

// Squad data
export interface Squad {
  id: string;
  players: string[]; // player IDs
  color: string;
  spawnSite: string | null;
  relicsDelivered: number;
  isEliminated: boolean;
  /** Remaining wipe window (ms). Null when not wiping. */
  wipeTimerRemainingMs: number | null;
}

// Input state
export interface InputState {
  moveDirection: Vector2;
  aimDirection: Vector2;
  isFiring: boolean;
  isReloading: boolean;
  interact: boolean;
  /** Generic "confirm" action (tap/click). Used for lobby/game-over flows. */
  confirm: boolean;
  zoom: number;
}

// Touch input tracking
export interface TouchState {
  moveTouchId: number | null;
  aimTouchId: number | null;
  moveStart: Vector2 | null;
  aimStart: Vector2 | null;
}

// Camera state
export interface CameraState {
  x: number;
  y: number;
  zoom: number;
  targetZoom: number;
  shakeIntensity: number;
  shakeDecay: number;
}

// Proximity signal for awareness system
export interface ProximitySignal {
  direction: number; // angle in radians
  strength: number; // 0-1
  type: 'enemy' | 'loot' | 'relic' | 'danger';
  distance: number;
}

// Match statistics
export interface MatchStats {
  kills: number;
  deaths: number;
  damageDealt: number;
  relicsDelivered: number;
  orbsCollected: number;
  respawnsUsed: number;
}

// Game configuration
export interface GameConfig {
  mapWidth: number;
  mapHeight: number;
  maxTeams: number;
  playersPerTeam: number;
  totalRelics: number;
  respawnBaseCooldown: number;
  wipeTimerDuration: number;
  riftlinePhases: RiftlinePhaseConfig[];
}

export interface RiftlinePhaseConfig {
  phase: RiftlinePhase;
  duration: number; // ms
  damagePerSecond: number;
  shrinkRate: number; // units per second
  respawnEfficiency: number; // multiplier
}
