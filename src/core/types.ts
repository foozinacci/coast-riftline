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

// ============================================================================
// APP STATE MACHINE (Top-Level FSM per Specification)
// ============================================================================

/**
 * High-level application states following the navigation specification.
 * Each state has explicit IN, OUT, and BACK behavior.
 */
export enum AppState {
  // Core boot/loading states
  BOOT = 'boot',
  SPLASH = 'splash',
  TITLE = 'title',

  // Main menu and navigation
  MAIN_MENU = 'main_menu',
  PLAY_MENU = 'play_menu',
  TRAINING_SETUP = 'training_setup',
  QUICK_PLAY_SETUP = 'quick_play_setup',
  CUSTOM_GAME_BROWSER = 'custom_game_browser',
  CREATE_CUSTOM_GAME = 'create_custom_game',
  PRIVATE_MATCH = 'private_match',

  // Customization & Settings
  CUSTOMIZE_MENU = 'customize_menu',
  CLASS_SELECT = 'class_select',
  SETTINGS_ROOT = 'settings_root',
  CONTROLS_MENU = 'controls_menu',
  CONTROLLER_BINDINGS = 'controller_bindings',
  MKB_BINDINGS = 'mkb_bindings',

  // Lobby & Matchmaking
  LOBBY = 'lobby',
  MATCHMAKING = 'matchmaking',
  CONNECTING = 'connecting',

  // In-Match states
  MATCH_LOADING = 'match_loading',
  IN_MATCH = 'in_match',
  PAUSE_MENU = 'pause_menu',
  DEATH_OVERLAY = 'death_overlay',

  // Post-Match
  POST_MATCH = 'post_match',

  // Connection states
  DISCONNECT_RECONNECT = 'disconnect_reconnect',

  // Exit states
  EXIT_CONFIRM = 'exit_confirm',
}

/**
 * Modal types that can overlay any screen.
 * Modals trap focus and must have explicit Confirm/Cancel actions.
 */
export enum ModalType {
  NONE = 'none',
  ERROR = 'error',
  EXIT_MATCH_CONFIRM = 'exit_match_confirm',
  LEAVE_LOBBY = 'leave_lobby',
  DISBAND_LOBBY = 'disband_lobby',
  DISCARD_CHANGES = 'discard_changes',
  FORFEIT_MATCH = 'forfeit_match',
}

// Game state phases (in-match only)
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

// Game Modes (Finalized)
export enum GameMode {
  MAIN = 'main',
  ARENA_1V1 = 'arena_1v1',
  ARENA_1V1V1 = 'arena_1v1v1',
  ARENA_3V3 = 'arena_3v3',
  ARENA_3V3V3 = 'arena_3v3v3',
  TRAINING = 'training',
}

// Training Difficulty
export enum TrainingDifficulty {
  EASY = 'easy',
  MEDIUM = 'medium',
  HARD = 'hard',
}

// Match Structure
export enum MatchStructure {
  SINGLE_MATCH = 'single_match',
  BEST_OF_3 = 'best_of_3',
  BEST_OF_5 = 'best_of_5',
}

// Player classes
// Player classes (Refactored)
export enum PlayerClass {
  SCOUT = 'scout',
  VANGUARD = 'vanguard',
  MEDIC = 'medic',
  SCAVENGER = 'scavenger',
}

// Weapon archetypes
// Weapon archetypes (Refactored)
export enum WeaponType {
  AUTOMATIC = 'automatic',
  SEMI_AUTO = 'semi_auto',
  CHARGE = 'charge',
  BURST = 'burst',
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
  COVER = 'cover', // Vanguard cover
}

// Class configuration
export interface ClassConfig {
  name: string;
  class: PlayerClass;
  description: string;
  baseHealth: number;
  baseShield: number;
  moveSpeed: number; // Raw pixels per second
  dashes: number;
  passiveDescription: string;
  tacticalDescription: string;
  tacticalParameter: string;
}

// Weapon configuration
export interface WeaponConfig {
  id: string; // e.g., 'auto_common'
  name: string;
  type: WeaponType;
  rarity: Rarity;
  damage: number; // Fixed across rarities
  magazineSize: number;
  fireRate: number; // Bullets per second
  reloadTime: number; // ms
  range: number;
  projectileSpeed: number;
  chargeTime?: number; // ms, for Charge weapons
  burstCount?: number;
  burstDelay?: number; // ms
}

// Backpack configuration
export interface BackpackConfig {
  tier: BackpackTier;
  gridWidth: number;
  gridHeight: number;
  moveSpeedPenalty: number;
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
  players: string[];
  color: string;
  spawnSite: string | null;
  relicsDelivered: number;
  isEliminated: boolean;
  wipeTimerRemainingMs: number | null;
}

// Input state
export interface InputState {
  moveDirection: Vector2;
  aimDirection: Vector2;
  isFiring: boolean;
  isReloading: boolean;
  interact: boolean;
  confirm: boolean;
  back: boolean;
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
  direction: number;
  strength: number;
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
  // Mode specific overrides
  mode: GameMode;
  difficulty?: TrainingDifficulty; // For training
  structure: MatchStructure;
  roundsToWin: number;
}

export interface RiftlinePhaseConfig {
  phase: RiftlinePhase;
  duration: number;
  damagePerSecond: number;
  shrinkRate: number;
  respawnEfficiency: number;
}

// ============================================================================
// NAVIGATION SYSTEM (Per Specification K & L)
// ============================================================================

/**
 * Navigation stack entry - every screen push records its caller.
 */
export interface NavigationEntry {
  state: AppState;
  caller: AppState | null;
  data?: Record<string, unknown>;
}

/**
 * Error state for error handling (per spec A5).
 */
export interface ErrorState {
  message: string;
  code?: string;
  actions: {
    tryAgain?: () => void;
    back?: () => void;
    copyError?: () => void;
    reportError?: () => void;
  };
}

/**
 * Focus state for controller navigation (per spec A2).
 */
export interface FocusState {
  currentFocusId: string | null;
  focusableElements: string[];
  focusHistory: Map<AppState, string>;
}

// ============================================================================
// CORE GAME SYSTEMS (Per Game Systems Spec)
// ============================================================================

/**
 * World Node - A location on the map that can be a spawn or relic site
 */
export interface WorldNode {
  id: string;
  position: Vector2;
  type: 'spawn' | 'relic' | 'vault' | 'campfire';
  isActive: boolean;
}

/**
 * Spawn Location - A team spawn with two sub-positions
 */
export interface SpawnLocation {
  id: string;
  position: Vector2;
  aSideOffset: Vector2;
  bSideOffset: Vector2;
  assignedTeams: string[]; // Max 2
  maxTeams: 2;
}

/**
 * Spawn Vote - Team's vote for a spawn location
 */
export interface SpawnVote {
  squadId: string;
  locationId: string;
  votes: Map<string, string>; // playerId -> locationId
  finalChoice: string | null;
  deadline: number; // timestamp
}

/**
 * Relic - Core objective item
 */
export interface Relic {
  id: string;
  position: Vector2;
  spawnPosition: Vector2;
  plantSiteId: string; // Valid plant location
  state: RelicState;
  carrierId: string | null;
  plantProgress: number; // 0-1 (1 = planted)
  planterId: string | null;
}

export enum RelicState {
  SPAWNING = 'spawning',
  AVAILABLE = 'available',
  CARRIED = 'carried',
  PLANTING = 'planting',
  PLANTED = 'planted',
}

/**
 * Relic Plant Site - Where relics can be planted
 */
export interface RelicPlantSite {
  id: string;
  position: Vector2;
  radius: number;
  linkedRelicId: string | null;
  hasPlantedRelic: boolean;
  safeZoneRadius: number; // Creates a ring when relic planted
  safeZoneActive: boolean;
}

/**
 * Vault - Final objective
 */
export interface Vault {
  id: string;
  position: Vector2;
  radius: number;
  isRevealed: boolean;
  isOpen: boolean;
  safeZoneRadius: number;
  winningSquadId: string | null;
}

/**
 * Campfire - Healing station
 */
export interface Campfire {
  id: string;
  position: Vector2;
  radius: number;
  healRate: number; // HP per second (shields first, then health)
  isActive: boolean;
}

/**
 * Respawn Beacon - Emergency instant respawn item
 */
export interface RespawnBeacon {
  id: string;
  position: Vector2;
  squadId: string;
  isUsed: boolean;
  respawnDelay: number; // Faster than normal cooldown
}

/**
 * Respawn Orb - Reduces respawn cooldown
 */
export interface RespawnOrb {
  id: string;
  position: Vector2;
  value: number; // Cooldown reduction in seconds
  spawnTime: number;
  expiresAt: number;
  collectedBy: string | null;
}

/**
 * Player Healing State - For passive healing tracking
 */
export interface HealingState {
  lastDamageTaken: number; // timestamp
  lastDamageDealt: number;
  lastActionTime: number; // firing, abilities
  isPassiveHealingActive: boolean;
  healingPerSecond: number;
}

/**
 * Relic Ring - Safe zone created by planted relic
 */
export interface RelicRing {
  id: string;
  plantSiteId: string;
  position: Vector2;
  currentRadius: number;
  maxRadius: number;
  shrinkRate: number;
  decayStartTime: number | null;
  isDecaying: boolean;
}

/**
 * Progressive Riftline State - Escalation based on planted relics
 */
export interface RiftlineEscalation {
  relicsPlanted: number;
  globalShrinkMultiplier: number;
  stormDamageMultiplier: number;
  respawnCooldownMultiplier: number;
  relicRingsDecaying: boolean;
}

/**
 * Pre-game Animation State
 */
export interface PreGameAnimation {
  phase: 'idle' | 'panning_to_relics' | 'showing_relics' | 'returning' | 'complete';
  currentRelicIndex: number;
  animationProgress: number; // 0-1
  cameraTarget: Vector2;
}

/**
 * Match State - Complete game state
 */
export interface MatchState {
  phase: GamePhase;
  timeRemaining: number;

  // Spawns
  spawnLocations: SpawnLocation[];
  spawnVotes: Map<string, SpawnVote>;

  // Relics & Objectives
  relics: Relic[];
  plantSites: RelicPlantSite[];
  relicRings: RelicRing[];
  vault: Vault | null;

  // Support Objects
  campfires: Campfire[];
  respawnBeacons: RespawnBeacon[];
  respawnOrbs: RespawnOrb[];

  // Riftline (Storm)
  riftlineEscalation: RiftlineEscalation;
  globalRiftlineRadius: number;
  globalRiftlineCenter: Vector2;

  // Animation
  preGameAnimation: PreGameAnimation;
}

/**
 * Plant interaction state for a player
 */
export interface PlantInteraction {
  isPlanting: boolean;
  plantStartTime: number;
  targetSiteId: string | null;
  progress: number; // 0-1
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const PLANT_DURATION_MS = 5000; // 5 seconds to plant
export const PASSIVE_HEAL_DELAY_MS = 2500; // 2.5 seconds before healing starts
export const PASSIVE_HEAL_RATE = 5; // HP per second
export const CAMPFIRE_HEAL_RATE = 15; // HP per second (shields first)
export const ORB_LIFETIME_MS = 30000; // Orbs expire after 30 seconds
export const ORB_BASE_VALUE = 3; // Seconds reduced from respawn cooldown
export const SPAWN_VOTE_DURATION_MS = 15000; // 15 seconds to vote
export const RELIC_CARRIER_SPEED_PENALTY = 0.3; // 30% speed reduction

