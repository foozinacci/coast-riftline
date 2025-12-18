// Webb Protocol - Matchmaking Integration
// Connects UI flow to mesh networking

import {
    MatchCoordinator,
    createMatchCoordinator,
    MatchState,
    MeshRole
} from './index';
import { GameMode } from '../../core/types';
import { supabase } from '../supabase';

/**
 * Matchmaking state
 */
export type MatchmakingState =
    | 'idle'
    | 'searching'
    | 'found'
    | 'joining'
    | 'in-lobby'
    | 'starting'
    | 'in-game'
    | 'error';

/**
 * Matchmaking events
 */
export interface MatchmakingEvents {
    onStateChange: (state: MatchmakingState) => void;
    onMatchFound: (matchId: string) => void;
    onPlayerCount: (count: number, max: number) => void;
    onAllPlayersReady: () => void;
    onMatchStart: (coordinator: MatchCoordinator) => void;
    onError: (error: string) => void;
}

/**
 * Matchmaking manager
 * Handles finding/creating matches and transitioning to Webb Protocol
 */
export class MatchmakingManager {
    private playerId: string;
    private gameMode: GameMode;
    private isRanked: boolean;
    private events: MatchmakingEvents;

    private state: MatchmakingState = 'idle';
    private matchId: string = '';
    private coordinator: MatchCoordinator | null = null;
    private searchInterval: NodeJS.Timeout | null = null;
    private isHost: boolean = false;

    constructor(
        playerId: string,
        gameMode: GameMode,
        isRanked: boolean,
        events: MatchmakingEvents
    ) {
        this.playerId = playerId;
        this.gameMode = gameMode;
        this.isRanked = isRanked;
        this.events = events;
    }

    /**
     * Start searching for a match
     */
    async startSearch(): Promise<void> {
        if (this.state !== 'idle') {
            console.warn('[Matchmaking] Already searching');
            return;
        }

        this.setState('searching');
        console.log(`[Matchmaking] Searching for ${this.gameMode} match (ranked: ${this.isRanked})`);

        try {
            // Look for existing lobby or create one
            const lobby = await this.findOrCreateLobby();

            if (lobby) {
                this.matchId = lobby.id;
                this.isHost = lobby.host_id === this.playerId;

                this.setState('found');
                this.events.onMatchFound(this.matchId);

                // Join the mesh
                await this.joinMesh();
            }
        } catch (error) {
            console.error('[Matchmaking] Search failed:', error);
            this.setState('error');
            this.events.onError(`Matchmaking failed: ${error}`);
        }
    }

    /**
     * Cancel matchmaking
     */
    cancelSearch(): void {
        console.log('[Matchmaking] Cancelling search');

        if (this.searchInterval) {
            clearInterval(this.searchInterval);
            this.searchInterval = null;
        }

        if (this.coordinator) {
            this.coordinator.leave();
            this.coordinator = null;
        }

        this.setState('idle');
    }

    /**
     * Ready up in lobby
     */
    async readyUp(): Promise<void> {
        if (this.state !== 'in-lobby') {
            console.warn('[Matchmaking] Not in lobby');
            return;
        }

        try {
            await supabase
                .from('lobby_players')
                .update({ is_ready: true })
                .eq('lobby_id', this.matchId)
                .eq('player_id', this.playerId);

            console.log('[Matchmaking] Marked ready');

            // Check if all players are ready
            if (this.isHost) {
                await this.checkAllReady();
            }
        } catch (error) {
            console.error('[Matchmaking] Ready up failed:', error);
        }
    }

    /**
     * Start the match (host only)
     */
    async startMatch(): Promise<void> {
        if (!this.isHost || !this.coordinator) {
            console.warn('[Matchmaking] Cannot start match (not host or no coordinator)');
            return;
        }

        this.setState('starting');

        try {
            await this.coordinator.startMatch();
        } catch (error) {
            console.error('[Matchmaking] Start match failed:', error);
            this.events.onError(`Failed to start: ${error}`);
        }
    }

    /**
     * Get current matchmaking state
     */
    getState(): MatchmakingState {
        return this.state;
    }

    /**
     * Get match coordinator (for game integration)
     */
    getCoordinator(): MatchCoordinator | null {
        return this.coordinator;
    }

    /**
     * Check if we are the host
     */
    getIsHost(): boolean {
        return this.isHost;
    }

    // ========================================================================
    // Private
    // ========================================================================

    private setState(state: MatchmakingState): void {
        if (this.state !== state) {
            console.log(`[Matchmaking] State: ${this.state} -> ${state}`);
            this.state = state;
            this.events.onStateChange(state);
        }
    }

    private async findOrCreateLobby(): Promise<{ id: string; host_id: string } | null> {
        const modeString = this.gameModeToString(this.gameMode);

        // First, look for an existing lobby
        const { data: existing } = await supabase
            .from('lobbies')
            .select('id, host_id, current_players, max_players')
            .eq('mode', modeString)
            .eq('is_ranked', this.isRanked)
            .eq('status', 'waiting')
            .lt('current_players', this.getMaxPlayers())
            .limit(1)
            .single();

        if (existing) {
            console.log(`[Matchmaking] Found existing lobby: ${existing.id}`);

            // Join it
            await supabase.from('lobby_players').insert({
                lobby_id: existing.id,
                player_id: this.playerId,
                is_ready: false,
                is_host: false,
            });

            // Increment player count
            await supabase
                .from('lobbies')
                .update({ current_players: existing.current_players + 1 })
                .eq('id', existing.id);

            return existing;
        }

        // Create new lobby
        console.log('[Matchmaking] Creating new lobby');

        const { data: newLobby, error } = await supabase
            .from('lobbies')
            .insert({
                host_id: this.playerId,
                mode: modeString,
                structure: 'solo', // or 'squad' based on party
                is_private: false,
                is_ranked: this.isRanked,
                max_players: this.getMaxPlayers(),
                current_players: 1,
                status: 'waiting',
            })
            .select('id, host_id')
            .single();

        if (error) {
            throw error;
        }

        // Add ourselves as host
        await supabase.from('lobby_players').insert({
            lobby_id: newLobby.id,
            player_id: this.playerId,
            is_ready: false,
            is_host: true,
        });

        return newLobby;
    }

    private async joinMesh(): Promise<void> {
        this.setState('joining');

        this.coordinator = createMatchCoordinator(
            this.playerId,
            this.matchId,
            this.gameMode,
            {
                onStateChange: (state) => this.onCoordinatorState(state),
                onPlayerCountChange: (count, max) => this.events.onPlayerCount(count, max),
                onRoleAssigned: (role, isPrimary) => {
                    console.log(`[Matchmaking] Role: ${role}, primary: ${isPrimary}`);
                },
                onMatchStart: () => {
                    this.setState('in-game');
                    this.events.onMatchStart(this.coordinator!);
                },
                onGameState: () => { },
                onGameEvent: () => { },
                onError: (error) => this.events.onError(error),
            }
        );

        await this.coordinator.join();
        this.setState('in-lobby');
    }

    private onCoordinatorState(state: MatchState): void {
        console.log(`[Matchmaking] Coordinator state: ${state}`);

        if (state === 'error') {
            this.setState('error');
        } else if (state === 'in-progress') {
            this.setState('in-game');
        }
    }

    private async checkAllReady(): Promise<void> {
        const { data: players } = await supabase
            .from('lobby_players')
            .select('is_ready')
            .eq('lobby_id', this.matchId);

        if (players && players.every(p => p.is_ready)) {
            console.log('[Matchmaking] All players ready!');
            this.events.onAllPlayersReady();
        }
    }

    private getMaxPlayers(): number {
        switch (this.gameMode) {
            case GameMode.MAIN: return 30;
            case GameMode.ARENA_1V1: return 2;
            case GameMode.ARENA_1V1V1: return 3;
            case GameMode.ARENA_3V3: return 6;
            case GameMode.ARENA_3V3V3: return 9;
            default: return 30;
        }
    }

    private gameModeToString(mode: GameMode): string {
        switch (mode) {
            case GameMode.MAIN: return 'main';
            case GameMode.ARENA_1V1: return 'arena_1v1';
            case GameMode.ARENA_1V1V1: return 'arena_1v1v1';
            case GameMode.ARENA_3V3: return 'arena_3v3';
            case GameMode.ARENA_3V3V3: return 'arena_3v3v3';
            default: return 'main';
        }
    }
}

/**
 * Create matchmaking manager
 */
export function createMatchmaking(
    playerId: string,
    gameMode: GameMode,
    isRanked: boolean,
    events: MatchmakingEvents
): MatchmakingManager {
    return new MatchmakingManager(playerId, gameMode, isRanked, events);
}
