// Webb Protocol - Match Coordinator
// Integrates mesh networking with the game matchmaking flow

import {
    MeshManager,
    MeshRole,
    SyncMessage,
    WebbMatchConfig,
    DEFAULT_WEBB_CONFIG,
    MeshPeer,
} from './index';
import { createSignaling } from './signaling';
import { GameMode } from '../../core/types';

/**
 * Match coordinator state
 */
export type MatchState =
    | 'idle'
    | 'joining'
    | 'quality-test'
    | 'waiting-for-players'
    | 'electing-anchors'
    | 'connecting-mesh'
    | 'ready'
    | 'in-progress'
    | 'finished'
    | 'error';

/**
 * Match coordinator events
 */
export interface MatchCoordinatorEvents {
    onStateChange: (state: MatchState) => void;
    onPlayerCountChange: (count: number, max: number) => void;
    onRoleAssigned: (role: MeshRole, isPrimary: boolean) => void;
    onMatchStart: () => void;
    onGameState: (state: any) => void;
    onGameEvent: (event: any) => void;
    onError: (error: string) => void;
}

/**
 * Coordinates a match using Webb Protocol mesh networking
 */
export class MatchCoordinator {
    private playerId: string;
    private matchId: string;
    private gameMode: GameMode;
    private events: MatchCoordinatorEvents;

    private mesh: MeshManager | null = null;
    private state: MatchState = 'idle';
    private role: MeshRole = 'player';
    private isPrimary: boolean = false;
    private playerCount: number = 0;
    private maxPlayers: number = 30;

    // Game state
    private localGameState: any = null;
    private lastSyncTime: number = 0;
    private syncInterval: NodeJS.Timeout | null = null;

    constructor(
        playerId: string,
        matchId: string,
        gameMode: GameMode,
        events: MatchCoordinatorEvents
    ) {
        this.playerId = playerId;
        this.matchId = matchId;
        this.gameMode = gameMode;
        this.events = events;

        // Set max players based on mode
        this.maxPlayers = this.getMaxPlayersForMode(gameMode);
    }

    /**
     * Get max players for game mode
     */
    private getMaxPlayersForMode(mode: GameMode): number {
        switch (mode) {
            case GameMode.MAIN: return 30;
            case GameMode.ARENA_1V1: return 2;
            case GameMode.ARENA_1V1V1: return 3;
            case GameMode.ARENA_3V3: return 6;
            case GameMode.ARENA_3V3V3: return 9;
            default: return 30;
        }
    }

    /**
     * Join a match
     */
    async join(): Promise<void> {
        if (this.state !== 'idle') {
            console.warn('[MatchCoordinator] Already joined or joining');
            return;
        }

        this.setState('joining');
        console.log(`[MatchCoordinator] Joining match ${this.matchId} as ${this.playerId}`);

        try {
            // Create mesh manager
            const signaling = createSignaling();
            const config: Partial<WebbMatchConfig> = {
                maxPlayers: this.maxPlayers,
                numSquads: Math.ceil(this.maxPlayers / 3),
            };

            this.mesh = new MeshManager(
                this.playerId,
                this.matchId,
                signaling,
                {
                    onPeerJoined: (peer) => this.onPeerJoined(peer),
                    onPeerLeft: (peerId) => this.onPeerLeft(peerId),
                    onRoleAssigned: (role, isPrimary) => this.onRoleAssigned(role, isPrimary),
                    onMatchReady: (anchors, primary) => this.onMatchReady(anchors, primary),
                    onGameMessage: (from, msg) => this.onGameMessage(from, msg),
                    onConnectionFailed: (peerId, error) => this.onConnectionFailed(peerId, error),
                },
                config
            );

            // Join the mesh (runs quality test)
            this.setState('quality-test');
            await this.mesh.join();

            this.setState('waiting-for-players');
            this.playerCount = 1; // Us
            this.events.onPlayerCountChange(this.playerCount, this.maxPlayers);

        } catch (error) {
            console.error('[MatchCoordinator] Failed to join:', error);
            this.setState('error');
            this.events.onError(`Failed to join match: ${error}`);
        }
    }

    /**
     * Start the match (host only)
     */
    async startMatch(): Promise<void> {
        if (!this.mesh) {
            this.events.onError('Not connected to mesh');
            return;
        }

        if (this.state !== 'waiting-for-players') {
            console.warn('[MatchCoordinator] Cannot start match in state:', this.state);
            return;
        }

        console.log('[MatchCoordinator] Starting match...');
        this.setState('electing-anchors');

        try {
            // Start anchor election
            await this.mesh.startAnchorElection();

            // Mesh connections will be established after election
            this.setState('connecting-mesh');

        } catch (error) {
            console.error('[MatchCoordinator] Failed to start match:', error);
            this.setState('error');
            this.events.onError(`Failed to start match: ${error}`);
        }
    }

    /**
     * Leave the match
     */
    leave(): void {
        console.log('[MatchCoordinator] Leaving match');

        // Stop sync
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }

        // Leave mesh
        if (this.mesh) {
            this.mesh.leave();
            this.mesh = null;
        }

        this.setState('idle');
    }

    /**
     * Update local game state (called by game loop)
     */
    updateGameState(state: any): void {
        this.localGameState = state;
    }

    /**
     * Send a game event (reliable delivery)
     */
    sendGameEvent(event: any): void {
        if (!this.mesh) return;
        this.mesh.broadcastGameEvent(event);
    }

    /**
     * Get current match state
     */
    getState(): MatchState {
        return this.state;
    }

    /**
     * Get our role in the mesh
     */
    getRole(): MeshRole {
        return this.role;
    }

    /**
     * Check if we are the primary anchor
     */
    isPrimaryAnchor(): boolean {
        return this.isPrimary;
    }

    // ========================================================================
    // Private: Event Handlers
    // ========================================================================

    private setState(state: MatchState): void {
        if (this.state !== state) {
            console.log(`[MatchCoordinator] State: ${this.state} -> ${state}`);
            this.state = state;
            this.events.onStateChange(state);
        }
    }

    private onPeerJoined(peer: MeshPeer): void {
        this.playerCount++;
        console.log(`[MatchCoordinator] Player joined: ${peer.id} (${this.playerCount}/${this.maxPlayers})`);
        this.events.onPlayerCountChange(this.playerCount, this.maxPlayers);
    }

    private onPeerLeft(peerId: string): void {
        this.playerCount = Math.max(0, this.playerCount - 1);
        console.log(`[MatchCoordinator] Player left: ${peerId} (${this.playerCount}/${this.maxPlayers})`);
        this.events.onPlayerCountChange(this.playerCount, this.maxPlayers);
    }

    private onRoleAssigned(role: MeshRole, isPrimary: boolean): void {
        this.role = role;
        this.isPrimary = isPrimary;
        console.log(`[MatchCoordinator] Role assigned: ${role}, primary: ${isPrimary}`);
        this.events.onRoleAssigned(role, isPrimary);
    }

    private onMatchReady(anchors: string[], primaryId: string): void {
        console.log(`[MatchCoordinator] Match ready! Anchors: ${anchors.length}, Primary: ${primaryId}`);
        this.setState('ready');

        // Start game state sync
        this.startGameSync();

        // Notify game to start
        this.events.onMatchStart();
        this.setState('in-progress');
    }

    private onGameMessage(from: string, message: SyncMessage): void {
        switch (message.type) {
            case 'state':
                this.events.onGameState(message.payload);
                break;
            case 'event':
                this.events.onGameEvent(message.payload);
                break;
        }
    }

    private onConnectionFailed(peerId: string, error: Error): void {
        console.error(`[MatchCoordinator] Connection failed to ${peerId}:`, error);
        // Could implement reconnection logic here
    }

    // ========================================================================
    // Private: Game State Sync
    // ========================================================================

    private startGameSync(): void {
        // Sync at 30 Hz (every ~33ms)
        const syncRateMs = 33;

        this.syncInterval = setInterval(() => {
            if (this.localGameState && this.mesh) {
                this.mesh.broadcastGameState(this.localGameState);
                this.lastSyncTime = Date.now();
            }
        }, syncRateMs);

        console.log(`[MatchCoordinator] Started game sync at ${Math.round(1000 / syncRateMs)} Hz`);
    }
}

/**
 * Create a match coordinator for a game
 */
export function createMatchCoordinator(
    playerId: string,
    matchId: string,
    gameMode: GameMode,
    events: MatchCoordinatorEvents
): MatchCoordinator {
    return new MatchCoordinator(playerId, matchId, gameMode, events);
}
