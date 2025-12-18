// Network Protocol for RIFTLINE
// Defines message types and serialization for multiplayer game state sync

import { Vector2, GameMode, GamePhase, PlayerClass } from '../core/types';

// ============================================================================
// MESSAGE TYPES
// ============================================================================

/**
 * All network message types
 */
export enum MessageType {
    // Connection
    CONNECT = 'connect',
    DISCONNECT = 'disconnect',
    PING = 'ping',
    PONG = 'pong',

    // Lobby
    JOIN_LOBBY = 'join_lobby',
    LEAVE_LOBBY = 'leave_lobby',
    LOBBY_STATE = 'lobby_state',
    PLAYER_READY = 'player_ready',

    // Match Flow
    MATCH_START = 'match_start',
    MATCH_END = 'match_end',
    ROUND_START = 'round_start',
    ROUND_END = 'round_end',

    // Player Input (Client -> Server)
    PLAYER_INPUT = 'player_input',
    PLAYER_ACTION = 'player_action',

    // Game State (Server -> Client)
    GAME_STATE = 'game_state',
    PLAYER_STATE = 'player_state',
    ENTITY_SPAWN = 'entity_spawn',
    ENTITY_DESTROY = 'entity_destroy',

    // Combat Events
    PROJECTILE_SPAWN = 'projectile_spawn',
    DAMAGE_EVENT = 'damage_event',
    KILL_EVENT = 'kill_event',
    RESPAWN_EVENT = 'respawn_event',

    // World Events
    RELIC_PICKUP = 'relic_pickup',
    RELIC_DROP = 'relic_drop',
    RELIC_PLANT = 'relic_plant',
    ORB_COLLECT = 'orb_collect',

    // Chat
    CHAT_MESSAGE = 'chat_message',

    // Error
    ERROR = 'error',
}

// ============================================================================
// BASE MESSAGE STRUCTURE
// ============================================================================

export interface NetworkMessage {
    type: MessageType;
    timestamp: number;
    sequence: number;
    senderId?: string;
}

// ============================================================================
// INPUT MESSAGES (Client -> Server)
// ============================================================================

/**
 * Player input state sent every tick
 */
export interface PlayerInputMessage extends NetworkMessage {
    type: MessageType.PLAYER_INPUT;
    input: {
        moveDirection: Vector2;
        aimDirection: Vector2;
        isFiring: boolean;
        isReloading: boolean;
        dashPressed: boolean;
        tacticalPressed: boolean;
        interactPressed: boolean;
    };
    clientTick: number;
}

/**
 * Discrete player actions
 */
export interface PlayerActionMessage extends NetworkMessage {
    type: MessageType.PLAYER_ACTION;
    action: 'fire' | 'reload' | 'dash' | 'tactical' | 'interact' | 'drop_relic';
    data?: Record<string, unknown>;
}

// ============================================================================
// STATE MESSAGES (Server -> Client)
// ============================================================================

/**
 * Compressed player state for network sync
 */
export interface NetworkPlayerState {
    id: string;
    squadId: string;
    position: Vector2;
    velocity: Vector2;
    rotation: number;
    health: number;
    shield: number;
    isAlive: boolean;
    isDashing: boolean;
    hasRelic: boolean;
    weaponAmmo: number;
    isReloading: boolean;
}

/**
 * Full game state snapshot (sent periodically)
 */
export interface GameStateMessage extends NetworkMessage {
    type: MessageType.GAME_STATE;
    serverTick: number;
    phase: GamePhase;
    timeRemaining: number;
    players: NetworkPlayerState[];
    projectiles: NetworkProjectileState[];
    relics: NetworkRelicState[];
    orbs: NetworkOrbState[];
    riftlineRadius: number;
    riftlineCenter: Vector2;
}

/**
 * Delta update for single player (sent frequently)
 */
export interface PlayerStateMessage extends NetworkMessage {
    type: MessageType.PLAYER_STATE;
    serverTick: number;
    state: NetworkPlayerState;
}

// ============================================================================
// ENTITY STATES
// ============================================================================

export interface NetworkProjectileState {
    id: string;
    ownerId: string;
    position: Vector2;
    velocity: Vector2;
    damage: number;
    lifetime: number;
}

export interface NetworkRelicState {
    id: string;
    position: Vector2;
    state: 'available' | 'carried' | 'planting' | 'planted';
    carrierId: string | null;
    plantProgress: number;
}

export interface NetworkOrbState {
    id: string;
    position: Vector2;
    value: number;
}

// ============================================================================
// COMBAT EVENT MESSAGES
// ============================================================================

export interface DamageEventMessage extends NetworkMessage {
    type: MessageType.DAMAGE_EVENT;
    attackerId: string;
    victimId: string;
    damage: number;
    damageType: 'projectile' | 'riftline' | 'environment';
    position: Vector2;
}

export interface KillEventMessage extends NetworkMessage {
    type: MessageType.KILL_EVENT;
    killerId: string;
    victimId: string;
    weaponType: string;
    position: Vector2;
}

export interface RespawnEventMessage extends NetworkMessage {
    type: MessageType.RESPAWN_EVENT;
    playerId: string;
    position: Vector2;
}

// ============================================================================
// LOBBY MESSAGES
// ============================================================================

export interface JoinLobbyMessage extends NetworkMessage {
    type: MessageType.JOIN_LOBBY;
    lobbyId: string;
    playerName: string;
    playerClass: PlayerClass;
}

export interface LobbyStateMessage extends NetworkMessage {
    type: MessageType.LOBBY_STATE;
    lobbyId: string;
    mode: GameMode;
    players: {
        id: string;
        name: string;
        squadId: string;
        playerClass: PlayerClass;
        isReady: boolean;
        isHost: boolean;
    }[];
    countdown: number | null;
}

// ============================================================================
// MATCH FLOW MESSAGES
// ============================================================================

export interface MatchStartMessage extends NetworkMessage {
    type: MessageType.MATCH_START;
    matchId: string;
    mode: GameMode;
    teams: {
        squadId: string;
        color: string;
        spawnPosition: Vector2;
        players: string[];
    }[];
}

export interface RoundStartMessage extends NetworkMessage {
    type: MessageType.ROUND_START;
    roundNumber: number;
    totalRounds: number;
}

export interface RoundEndMessage extends NetworkMessage {
    type: MessageType.ROUND_END;
    roundNumber: number;
    winnerSquadId: string;
    scores: Map<string, number>;
}

export interface MatchEndMessage extends NetworkMessage {
    type: MessageType.MATCH_END;
    winnerSquadId: string;
    finalScores: Map<string, { roundWins: number; kills: number; deaths: number }>;
    xpGained: number;
    progressionUpdates: {
        classXP?: { class: PlayerClass; xpGained: number; newLevel: number };
        weaponXP?: { weapon: string; xpGained: number; newLevel: number };
    };
}

// ============================================================================
// UTILITY MESSAGES
// ============================================================================

export interface PingMessage extends NetworkMessage {
    type: MessageType.PING;
    clientTime: number;
}

export interface PongMessage extends NetworkMessage {
    type: MessageType.PONG;
    clientTime: number;
    serverTime: number;
}

export interface ErrorMessage extends NetworkMessage {
    type: MessageType.ERROR;
    code: string;
    message: string;
}

export interface ChatMessage extends NetworkMessage {
    type: MessageType.CHAT_MESSAGE;
    channel: 'all' | 'team' | 'system';
    senderName: string;
    content: string;
}

// ============================================================================
// SERIALIZATION HELPERS
// ============================================================================

/**
 * Compress a Vector2 for network transmission
 * Uses fixed-point encoding for smaller payloads
 */
export function compressVector2(v: Vector2): [number, number] {
    // Round to 2 decimal places and pack
    return [Math.round(v.x * 100) / 100, Math.round(v.y * 100) / 100];
}

/**
 * Decompress a Vector2 from network data
 */
export function decompressVector2(data: [number, number]): Vector2 {
    return { x: data[0], y: data[1] };
}

/**
 * Serialize a message to JSON string
 */
export function serializeMessage(message: NetworkMessage): string {
    return JSON.stringify(message);
}

/**
 * Deserialize a message from JSON string
 */
export function deserializeMessage(data: string): NetworkMessage | null {
    try {
        return JSON.parse(data) as NetworkMessage;
    } catch {
        return null;
    }
}

/**
 * Calculate message priority for bandwidth management
 */
export function getMessagePriority(type: MessageType): number {
    switch (type) {
        case MessageType.PLAYER_INPUT:
        case MessageType.DAMAGE_EVENT:
        case MessageType.KILL_EVENT:
            return 1; // Critical - must send immediately
        case MessageType.GAME_STATE:
        case MessageType.PLAYER_STATE:
        case MessageType.PROJECTILE_SPAWN:
            return 2; // High - send ASAP
        case MessageType.ROUND_START:
        case MessageType.ROUND_END:
        case MessageType.RESPAWN_EVENT:
            return 3; // Normal
        case MessageType.CHAT_MESSAGE:
        case MessageType.LOBBY_STATE:
            return 4; // Low - can be delayed
        default:
            return 3;
    }
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const NETWORK_TICK_RATE = 60; // Server sends state 60 times/second
export const CLIENT_INPUT_RATE = 60; // Client sends input 60 times/second
export const SNAPSHOT_RATE = 20; // Full snapshots 20 times/second
export const MAX_PING_SAMPLES = 10;
export const INTERPOLATION_DELAY_MS = 100; // Client renders 100ms behind server
