// Client-Side Interpolation for RIFTLINE Multiplayer
// Provides smooth entity movement between server updates

import { Vector2 } from '../core/types';
import { NetworkPlayerState, INTERPOLATION_DELAY_MS } from './protocol';

// ============================================================================
// TYPES
// ============================================================================

interface SnapshotState {
    timestamp: number;
    serverTick: number;
    players: Map<string, NetworkPlayerState>;
}

interface InterpolatedEntity {
    id: string;
    position: Vector2;
    velocity: Vector2;
    rotation: number;
    health: number;
    shield: number;
    isAlive: boolean;
}

// ============================================================================
// SNAPSHOT BUFFER
// ============================================================================

/**
 * Stores recent snapshots for interpolation
 */
export class SnapshotBuffer {
    private snapshots: SnapshotState[] = [];
    private maxSnapshots: number = 60; // 1 second at 60 tick
    private serverTimeOffset: number = 0;

    /**
     * Add a new snapshot from the server
     */
    addSnapshot(snapshot: SnapshotState): void {
        // Keep sorted by timestamp
        this.snapshots.push(snapshot);
        this.snapshots.sort((a, b) => a.timestamp - b.timestamp);

        // Trim old snapshots
        while (this.snapshots.length > this.maxSnapshots) {
            this.snapshots.shift();
        }
    }

    /**
     * Get interpolation render time (current time - delay)
     */
    getRenderTime(): number {
        return Date.now() - INTERPOLATION_DELAY_MS + this.serverTimeOffset;
    }

    /**
     * Set server time offset for synchronization
     */
    setServerTimeOffset(offset: number): void {
        this.serverTimeOffset = offset;
    }

    /**
     * Get two snapshots surrounding the render time
     */
    getInterpolationSnapshots(): { from: SnapshotState | null; to: SnapshotState | null; alpha: number } {
        const renderTime = this.getRenderTime();

        let from: SnapshotState | null = null;
        let to: SnapshotState | null = null;

        // Find the two snapshots that bracket our render time
        for (let i = 0; i < this.snapshots.length - 1; i++) {
            if (this.snapshots[i].timestamp <= renderTime &&
                this.snapshots[i + 1].timestamp >= renderTime) {
                from = this.snapshots[i];
                to = this.snapshots[i + 1];
                break;
            }
        }

        // If we're ahead of all snapshots, extrapolate from last
        if (!from && !to && this.snapshots.length > 0) {
            const last = this.snapshots[this.snapshots.length - 1];
            if (last.timestamp < renderTime) {
                return { from: last, to: null, alpha: 0 };
            }
        }

        // Calculate interpolation alpha
        if (from && to) {
            const range = to.timestamp - from.timestamp;
            const elapsed = renderTime - from.timestamp;
            const alpha = range > 0 ? Math.min(1, Math.max(0, elapsed / range)) : 0;
            return { from, to, alpha };
        }

        return { from, to, alpha: 0 };
    }

    /**
     * Get the latest snapshot
     */
    getLatestSnapshot(): SnapshotState | null {
        return this.snapshots.length > 0 ? this.snapshots[this.snapshots.length - 1] : null;
    }

    /**
     * Clear all snapshots
     */
    clear(): void {
        this.snapshots = [];
    }
}

// ============================================================================
// INTERPOLATION LOGIC
// ============================================================================

/**
 * Linear interpolation between two values
 */
function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

/**
 * Linear interpolation between two vectors
 */
function lerpVector2(a: Vector2, b: Vector2, t: number): Vector2 {
    return {
        x: lerp(a.x, b.x, t),
        y: lerp(a.y, b.y, t),
    };
}

/**
 * Interpolate angle (handles wrap-around)
 */
function lerpAngle(a: number, b: number, t: number): number {
    let diff = b - a;

    // Handle wrap-around
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;

    return a + diff * t;
}

/**
 * Interpolate a player state between two snapshots
 */
function interpolatePlayer(
    from: NetworkPlayerState,
    to: NetworkPlayerState,
    alpha: number
): InterpolatedEntity {
    return {
        id: to.id,
        position: lerpVector2(from.position, to.position, alpha),
        velocity: lerpVector2(from.velocity, to.velocity, alpha),
        rotation: lerpAngle(from.rotation, to.rotation, alpha),
        health: Math.round(lerp(from.health, to.health, alpha)),
        shield: Math.round(lerp(from.shield, to.shield, alpha)),
        isAlive: to.isAlive, // No interpolation for boolean
    };
}

/**
 * Extrapolate a player state forward in time
 */
function extrapolatePlayer(
    state: NetworkPlayerState,
    deltaMs: number
): InterpolatedEntity {
    const dt = deltaMs / 1000;

    return {
        id: state.id,
        position: {
            x: state.position.x + state.velocity.x * dt,
            y: state.position.y + state.velocity.y * dt,
        },
        velocity: state.velocity,
        rotation: state.rotation,
        health: state.health,
        shield: state.shield,
        isAlive: state.isAlive,
    };
}

// ============================================================================
// ENTITY INTERPOLATOR
// ============================================================================

/**
 * Manages interpolation for all networked entities
 */
export class EntityInterpolator {
    private snapshotBuffer: SnapshotBuffer;
    private localPlayerId: string | null = null;
    private interpolatedEntities: Map<string, InterpolatedEntity> = new Map();

    constructor() {
        this.snapshotBuffer = new SnapshotBuffer();
    }

    /**
     * Set the local player ID (won't be interpolated)
     */
    setLocalPlayerId(id: string): void {
        this.localPlayerId = id;
    }

    /**
     * Add a new game state snapshot
     */
    addGameState(
        serverTick: number,
        timestamp: number,
        players: NetworkPlayerState[]
    ): void {
        const playerMap = new Map<string, NetworkPlayerState>();
        for (const player of players) {
            playerMap.set(player.id, player);
        }

        this.snapshotBuffer.addSnapshot({
            timestamp,
            serverTick,
            players: playerMap,
        });
    }

    /**
     * Set server time offset for synchronization
     */
    setServerTimeOffset(offset: number): void {
        this.snapshotBuffer.setServerTimeOffset(offset);
    }

    /**
     * Update interpolation for all entities
     * Call this every frame
     */
    update(): Map<string, InterpolatedEntity> {
        const { from, to, alpha } = this.snapshotBuffer.getInterpolationSnapshots();

        if (!from) {
            return this.interpolatedEntities;
        }

        const result = new Map<string, InterpolatedEntity>();

        if (to) {
            // Normal interpolation between two snapshots
            for (const [id, toState] of to.players) {
                // Skip local player (use prediction instead)
                if (id === this.localPlayerId) continue;

                const fromState = from.players.get(id);
                if (fromState) {
                    result.set(id, interpolatePlayer(fromState, toState, alpha));
                } else {
                    // New entity, just use current state
                    result.set(id, {
                        id: toState.id,
                        position: toState.position,
                        velocity: toState.velocity,
                        rotation: toState.rotation,
                        health: toState.health,
                        shield: toState.shield,
                        isAlive: toState.isAlive,
                    });
                }
            }
        } else {
            // Extrapolation from last known state
            const renderTime = this.snapshotBuffer.getRenderTime();
            const deltaMs = renderTime - from.timestamp;

            // Limit extrapolation to 200ms
            const clampedDelta = Math.min(deltaMs, 200);

            for (const [id, state] of from.players) {
                if (id === this.localPlayerId) continue;
                result.set(id, extrapolatePlayer(state, clampedDelta));
            }
        }

        this.interpolatedEntities = result;
        return result;
    }

    /**
     * Get interpolated state for a specific entity
     */
    getEntityState(entityId: string): InterpolatedEntity | null {
        return this.interpolatedEntities.get(entityId) || null;
    }

    /**
     * Clear all interpolation data
     */
    clear(): void {
        this.snapshotBuffer.clear();
        this.interpolatedEntities.clear();
    }
}

// ============================================================================
// CLIENT PREDICTION
// ============================================================================

interface PredictedInput {
    tick: number;
    timestamp: number;
    input: {
        moveDirection: Vector2;
        aimDirection: Vector2;
        isFiring: boolean;
        isReloading: boolean;
        dashPressed: boolean;
        tacticalPressed: boolean;
        interactPressed: boolean;
    };
    predictedPosition: Vector2;
}

/**
 * Client-side prediction for local player
 * Stores input history for reconciliation with server
 */
export class ClientPrediction {
    private inputHistory: PredictedInput[] = [];
    private maxHistoryLength: number = 60; // 1 second at 60 tick
    private currentTick: number = 0;
    private lastServerTick: number = 0;

    /**
     * Get the current client tick
     */
    getCurrentTick(): number {
        return this.currentTick;
    }

    /**
     * Record a local input and prediction
     */
    recordInput(
        input: PredictedInput['input'],
        predictedPosition: Vector2
    ): number {
        const tick = this.currentTick++;

        this.inputHistory.push({
            tick,
            timestamp: Date.now(),
            input,
            predictedPosition,
        });

        // Trim old history
        while (this.inputHistory.length > this.maxHistoryLength) {
            this.inputHistory.shift();
        }

        return tick;
    }

    /**
     * Reconcile with server state
     * Returns inputs that need to be re-applied
     */
    reconcile(
        serverTick: number,
        serverPosition: Vector2,
        toleranceDistance: number = 5
    ): PredictedInput[] {
        this.lastServerTick = serverTick;

        // Find the input for the server's tick
        const serverInputIndex = this.inputHistory.findIndex(
            input => input.tick === serverTick
        );

        if (serverInputIndex === -1) {
            // Server tick not found in history
            return [];
        }

        const serverInput = this.inputHistory[serverInputIndex];

        // Check if our prediction was correct
        const dx = serverPosition.x - serverInput.predictedPosition.x;
        const dy = serverPosition.y - serverInput.predictedPosition.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance <= toleranceDistance) {
            // Prediction was correct, remove old history
            this.inputHistory = this.inputHistory.slice(serverInputIndex + 1);
            return [];
        }

        // Prediction was wrong, need to replay
        console.log(`[Prediction] Misprediction detected: ${distance.toFixed(2)} units`);

        // Return inputs that need to be re-applied
        const inputsToReplay = this.inputHistory.slice(serverInputIndex + 1);

        // Clear processed history
        this.inputHistory = inputsToReplay;

        return inputsToReplay;
    }

    /**
     * Clear all prediction history
     */
    clear(): void {
        this.inputHistory = [];
        this.currentTick = 0;
        this.lastServerTick = 0;
    }
}

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

/**
 * Create a complete interpolation system
 */
export function createInterpolationSystem(): {
    interpolator: EntityInterpolator;
    prediction: ClientPrediction;
} {
    return {
        interpolator: new EntityInterpolator(),
        prediction: new ClientPrediction(),
    };
}
