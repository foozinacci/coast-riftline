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
  fireRate: number;
  magazineSize: number;
  reloadTime: number;
  range: number;
  spread: number;
  projectileSpeed: number;
  burstCount?: number;
  inventorySize: { width: number; height: number };
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
