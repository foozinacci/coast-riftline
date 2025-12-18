// Webb Protocol - Game State Sync
// Efficient state serialization and reconciliation for multiplayer

import { Vector2 } from '../../core/types';

/**
 * Player state for network sync
 */
export interface PlayerNetState {
    id: string;
    squadId: number;
    pos: Vector2;
    vel: Vector2;
    rot: number;          // Aim direction
    health: number;
    maxHealth: number;
    isAlive: boolean;
    isDowned: boolean;
    isCarryingRelic: boolean;
    relicId?: string;
    weapon: string;
    lastFired: number;
    sequence: number;     // For ordering
}

/**
 * Projectile state for network sync
 */
export interface ProjectileNetState {
    id: string;
    ownerId: string;
    pos: Vector2;
    vel: Vector2;
    damage: number;
    type: string;
    createdAt: number;
}

/**
 * Relic state for network sync
 */
export interface RelicNetState {
    id: string;
    pos: Vector2;
    state: 'available' | 'carried' | 'planting' | 'planted';
    carrierId?: string;
    plantProgress: number;
    plantSiteId?: string;
}

/**
 * Global game state for network sync
 */
export interface GameNetState {
    tick: number;
    timestamp: number;
    phase: string;
    roundTime: number;
    riftlineRadius: number;
    riftlineCenter: Vector2;
    players: PlayerNetState[];
    projectiles: ProjectileNetState[];
    relics: RelicNetState[];
    eliminatedSquads: number[];
}

/**
 * Delta compression for efficient sync
 * Only sends changed fields
 */
export interface DeltaState {
    tick: number;
    baseTick: number;     // Reference tick
    changes: {
        players?: Partial<PlayerNetState>[];
        projectiles?: ProjectileNetState[];  // Just new ones
        removedProjectiles?: string[];
        relics?: Partial<RelicNetState>[];
        global?: Partial<Omit<GameNetState, 'players' | 'projectiles' | 'relics'>>;
    };
}

/**
 * Serialize game state for network transmission
 */
export function serializeGameState(state: GameNetState): Uint8Array {
    // For now, use JSON (can optimize with binary protocol later)
    const json = JSON.stringify(state);
    const encoder = new TextEncoder();
    return encoder.encode(json);
}

/**
 * Deserialize game state from network
 */
export function deserializeGameState(data: Uint8Array): GameNetState {
    const decoder = new TextDecoder();
    const json = decoder.decode(data);
    return JSON.parse(json);
}

/**
 * Calculate delta between two states
 */
export function calculateDelta(
    oldState: GameNetState,
    newState: GameNetState
): DeltaState {
    const delta: DeltaState = {
        tick: newState.tick,
        baseTick: oldState.tick,
        changes: {},
    };

    // Check player changes
    const playerChanges: Partial<PlayerNetState>[] = [];
    for (const newPlayer of newState.players) {
        const oldPlayer = oldState.players.find(p => p.id === newPlayer.id);
        if (!oldPlayer) {
            // New player
            playerChanges.push(newPlayer);
        } else {
            // Check for changes
            const changed: Partial<PlayerNetState> = { id: newPlayer.id };
            let hasChanges = false;

            if (Math.abs(newPlayer.pos.x - oldPlayer.pos.x) > 0.1 ||
                Math.abs(newPlayer.pos.y - oldPlayer.pos.y) > 0.1) {
                changed.pos = newPlayer.pos;
                hasChanges = true;
            }
            if (newPlayer.health !== oldPlayer.health) {
                changed.health = newPlayer.health;
                hasChanges = true;
            }
            if (newPlayer.isAlive !== oldPlayer.isAlive) {
                changed.isAlive = newPlayer.isAlive;
                hasChanges = true;
            }
            if (newPlayer.isCarryingRelic !== oldPlayer.isCarryingRelic) {
                changed.isCarryingRelic = newPlayer.isCarryingRelic;
                changed.relicId = newPlayer.relicId;
                hasChanges = true;
            }

            if (hasChanges) {
                playerChanges.push(changed);
            }
        }
    }
    if (playerChanges.length > 0) {
        delta.changes.players = playerChanges;
    }

    // Check for new projectiles
    const newProjectiles = newState.projectiles.filter(
        p => !oldState.projectiles.find(op => op.id === p.id)
    );
    if (newProjectiles.length > 0) {
        delta.changes.projectiles = newProjectiles;
    }

    // Check for removed projectiles
    const removedProjectiles = oldState.projectiles
        .filter(p => !newState.projectiles.find(np => np.id === p.id))
        .map(p => p.id);
    if (removedProjectiles.length > 0) {
        delta.changes.removedProjectiles = removedProjectiles;
    }

    // Check relic changes
    const relicChanges: Partial<RelicNetState>[] = [];
    for (const newRelic of newState.relics) {
        const oldRelic = oldState.relics.find(r => r.id === newRelic.id);
        if (!oldRelic ||
            oldRelic.state !== newRelic.state ||
            oldRelic.carrierId !== newRelic.carrierId ||
            oldRelic.plantProgress !== newRelic.plantProgress) {
            relicChanges.push(newRelic);
        }
    }
    if (relicChanges.length > 0) {
        delta.changes.relics = relicChanges;
    }

    // Check global changes
    if (oldState.phase !== newState.phase ||
        oldState.riftlineRadius !== newState.riftlineRadius ||
        oldState.eliminatedSquads.length !== newState.eliminatedSquads.length) {
        delta.changes.global = {
            tick: newState.tick,
            timestamp: newState.timestamp,
            phase: newState.phase,
            roundTime: newState.roundTime,
            riftlineRadius: newState.riftlineRadius,
            riftlineCenter: newState.riftlineCenter,
            eliminatedSquads: newState.eliminatedSquads,
        };
    }

    return delta;
}

/**
 * Apply delta to base state
 */
export function applyDelta(baseState: GameNetState, delta: DeltaState): GameNetState {
    const newState = { ...baseState, tick: delta.tick };

    // Apply player changes
    if (delta.changes.players) {
        newState.players = [...baseState.players];
        for (const change of delta.changes.players) {
            const idx = newState.players.findIndex(p => p.id === change.id);
            if (idx >= 0) {
                newState.players[idx] = { ...newState.players[idx], ...change };
            } else {
                // New player (need full state)
                newState.players.push(change as PlayerNetState);
            }
        }
    }

    // Apply projectile changes
    if (delta.changes.projectiles) {
        newState.projectiles = [...baseState.projectiles, ...delta.changes.projectiles];
    }
    if (delta.changes.removedProjectiles) {
        newState.projectiles = newState.projectiles.filter(
            p => !delta.changes.removedProjectiles!.includes(p.id)
        );
    }

    // Apply relic changes
    if (delta.changes.relics) {
        newState.relics = [...baseState.relics];
        for (const change of delta.changes.relics) {
            const idx = newState.relics.findIndex(r => r.id === change.id);
            if (idx >= 0) {
                newState.relics[idx] = { ...newState.relics[idx], ...change };
            }
        }
    }

    // Apply global changes
    if (delta.changes.global) {
        Object.assign(newState, delta.changes.global);
    }

    return newState;
}

/**
 * Interpolate between two states for smooth rendering
 */
export function interpolateStates(
    stateA: GameNetState,
    stateB: GameNetState,
    t: number // 0 = stateA, 1 = stateB
): GameNetState {
    const lerp = (a: number, b: number) => a + (b - a) * t;

    const interpolated = { ...stateB };

    // Interpolate player positions
    interpolated.players = stateB.players.map(playerB => {
        const playerA = stateA.players.find(p => p.id === playerB.id);
        if (!playerA) return playerB;

        return {
            ...playerB,
            pos: {
                x: lerp(playerA.pos.x, playerB.pos.x),
                y: lerp(playerA.pos.y, playerB.pos.y),
            },
            rot: lerp(playerA.rot, playerB.rot),
        };
    });

    // Interpolate riftline
    interpolated.riftlineRadius = lerp(stateA.riftlineRadius, stateB.riftlineRadius);
    interpolated.riftlineCenter = {
        x: lerp(stateA.riftlineCenter.x, stateB.riftlineCenter.x),
        y: lerp(stateA.riftlineCenter.y, stateB.riftlineCenter.y),
    };

    return interpolated;
}
