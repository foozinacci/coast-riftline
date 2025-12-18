// Game Synchronization - Bridges Supabase lobbies to actual game sessions
// Handles match starting, state sync, and coordination between players

import { supabase, supabaseService, GameLobby, LobbyPlayer } from './supabase';
import { reconnectManager } from './reconnect';
import { getNavigationManager } from '../core/navigation';
import { AppState, GameMode, MatchStructure } from '../core/types';

/**
 * Game session state
 */
export interface GameSession {
    sessionId: string;
    lobbyId: string;
    mode: GameMode;
    structure: MatchStructure;
    players: SessionPlayer[];
    hostId: string;
    status: 'initializing' | 'countdown' | 'playing' | 'finished';
    startedAt: number;
}

/**
 * Player in a game session
 */
export interface SessionPlayer {
    playerId: string;
    username: string;
    teamId: string;
    isConnected: boolean;
    loadProgress: number;
}

/**
 * Game sync event types
 */
export type GameSyncEventType =
    | 'session_created'
    | 'player_loaded'
    | 'all_loaded'
    | 'countdown_start'
    | 'game_start'
    | 'player_disconnected'
    | 'player_reconnected'
    | 'game_end';

export interface GameSyncEvent {
    type: GameSyncEventType;
    data?: Record<string, unknown>;
}

/**
 * Callback for when game should start
 */
export type GameStartCallback = (
    mode: GameMode,
    structure: MatchStructure,
    players: SessionPlayer[],
    isHost: boolean
) => void;

/**
 * Game Sync Manager - Coordinates multiplayer game sessions
 */
export class GameSyncManager {
    private static instance: GameSyncManager;
    private currentSession: GameSession | null = null;
    private listeners: Set<(event: GameSyncEvent) => void> = new Set();
    private gameStartCallback: GameStartCallback | null = null;
    private loadingTimeout: number | null = null;

    // Loading state
    private localLoadProgress: number = 0;
    private loadingComplete: boolean = false;

    private constructor() { }

    static getInstance(): GameSyncManager {
        if (!GameSyncManager.instance) {
            GameSyncManager.instance = new GameSyncManager();
        }
        return GameSyncManager.instance;
    }

    /**
     * Set the callback for starting the game
     */
    setGameStartCallback(callback: GameStartCallback): void {
        this.gameStartCallback = callback;
    }

    /**
     * Initialize a game session from a lobby (host only)
     */
    async initializeSession(lobby: GameLobby): Promise<boolean> {
        const user = supabaseService.getCurrentUser();
        if (!user) return false;

        const isHost = lobby.host_id === user.id;
        if (!isHost) {
            console.error('[GameSyncManager] Only host can initialize session');
            return false;
        }

        try {
            // Get all lobby players
            const players = await supabaseService.getLobbyPlayers(lobby.id);
            if (players.length === 0) return false;

            // Assign teams
            const teamAssignments = this.assignTeams(players, lobby.mode);

            // Create session
            this.currentSession = {
                sessionId: `session_${Date.now()}`,
                lobbyId: lobby.id,
                mode: lobby.mode as GameMode,
                structure: lobby.structure as MatchStructure,
                players: teamAssignments,
                hostId: lobby.host_id,
                status: 'initializing',
                startedAt: Date.now(),
            };

            // Update lobby status
            await supabase
                .from('lobbies')
                .update({ status: 'starting' })
                .eq('id', lobby.id);

            // Start reconnect tracking
            await reconnectManager.startSession(lobby.id);

            this.emitEvent({ type: 'session_created', data: { session: this.currentSession } });

            // Set loading timeout (30 seconds for all to load)
            this.loadingTimeout = window.setTimeout(() => {
                this.handleLoadingTimeout();
            }, 30000);

            // Mark self as loaded (host)
            this.setLoadProgress(100);

            return true;
        } catch (err) {
            console.error('[GameSyncManager] Error initializing session:', err);
            return false;
        }
    }

    /**
     * Join an existing game session (non-host)
     */
    async joinSession(lobbyId: string): Promise<boolean> {
        const user = supabaseService.getCurrentUser();
        if (!user) return false;

        try {
            // Get lobby info
            const { data: lobby, error } = await supabase
                .from('lobbies')
                .select('*')
                .eq('id', lobbyId)
                .single();

            if (error || !lobby) {
                console.error('[GameSyncManager] Lobby not found');
                return false;
            }

            // Get players
            const players = await supabaseService.getLobbyPlayers(lobbyId);
            const teamAssignments = this.assignTeams(players, lobby.mode);

            this.currentSession = {
                sessionId: `session_${Date.now()}`,
                lobbyId: lobbyId,
                mode: lobby.mode as GameMode,
                structure: lobby.structure as MatchStructure,
                players: teamAssignments,
                hostId: lobby.host_id,
                status: 'initializing',
                startedAt: Date.now(),
            };

            // Start reconnect tracking
            await reconnectManager.startSession(lobbyId);

            // Mark self as loaded
            this.setLoadProgress(100);

            return true;
        } catch (err) {
            console.error('[GameSyncManager] Error joining session:', err);
            return false;
        }
    }

    /**
     * Set local load progress and sync with others
     */
    async setLoadProgress(progress: number): Promise<void> {
        if (!this.currentSession) return;

        this.localLoadProgress = progress;

        const user = supabaseService.getCurrentUser();
        if (!user) return;

        // Update local player state
        const player = this.currentSession.players.find(p => p.playerId === user.id);
        if (player) {
            player.loadProgress = progress;
        }

        // Mark as loaded when complete
        if (progress >= 100 && !this.loadingComplete) {
            this.loadingComplete = true;
            this.emitEvent({ type: 'player_loaded', data: { playerId: user.id } });

            // Check if all loaded
            this.checkAllLoaded();
        }
    }

    /**
     * Check if all players are loaded
     */
    private checkAllLoaded(): void {
        if (!this.currentSession) return;

        const allLoaded = this.currentSession.players.every(p => p.loadProgress >= 100);

        if (allLoaded) {
            this.emitEvent({ type: 'all_loaded' });
            this.startCountdown();
        }
    }

    /**
     * Start countdown before match begins
     */
    private startCountdown(): void {
        if (!this.currentSession) return;

        this.currentSession.status = 'countdown';
        this.emitEvent({ type: 'countdown_start', data: { seconds: 3 } });

        // Clear loading timeout
        if (this.loadingTimeout) {
            clearTimeout(this.loadingTimeout);
            this.loadingTimeout = null;
        }

        // Start game after countdown
        setTimeout(() => {
            this.startGame();
        }, 3000);
    }

    /**
     * Start the actual game
     */
    private startGame(): void {
        if (!this.currentSession) return;

        this.currentSession.status = 'playing';
        this.emitEvent({ type: 'game_start' });

        const user = supabaseService.getCurrentUser();
        const isHost = user?.id === this.currentSession.hostId;

        // Call game start callback
        if (this.gameStartCallback) {
            this.gameStartCallback(
                this.currentSession.mode,
                this.currentSession.structure,
                this.currentSession.players,
                isHost
            );
        }

        // Navigate to in-match
        const navManager = getNavigationManager();
        navManager.forceNavigateTo(AppState.IN_MATCH);
    }

    /**
     * Handle timeout when not all players loaded
     */
    private async handleLoadingTimeout(): Promise<void> {
        if (!this.currentSession) return;

        console.warn('[GameSyncManager] Loading timeout - not all players loaded');

        // Find players who didn't load
        const notLoaded = this.currentSession.players.filter(p => p.loadProgress < 100);

        for (const player of notLoaded) {
            player.isConnected = false;
            this.emitEvent({ type: 'player_disconnected', data: { playerId: player.playerId } });
        }

        // If enough players, start anyway
        const loadedCount = this.currentSession.players.filter(p => p.loadProgress >= 100).length;
        const minPlayers = 2; // Minimum to start

        if (loadedCount >= minPlayers) {
            this.startGame();
        } else {
            // Not enough players - cancel
            this.cancelSession('Not enough players');
        }
    }

    /**
     * Cancel the current session
     */
    async cancelSession(reason: string): Promise<void> {
        if (!this.currentSession) return;

        console.log('[GameSyncManager] Cancelling session:', reason);

        // Update lobby status
        await supabase
            .from('lobbies')
            .update({ status: 'waiting' })
            .eq('id', this.currentSession.lobbyId);

        await reconnectManager.endSession();

        if (this.loadingTimeout) {
            clearTimeout(this.loadingTimeout);
            this.loadingTimeout = null;
        }

        this.currentSession = null;
        this.loadingComplete = false;
        this.localLoadProgress = 0;

        // Navigate back to lobby
        const navManager = getNavigationManager();
        navManager.forceNavigateTo(AppState.LOBBY);
    }

    /**
     * End the current game session
     */
    async endSession(): Promise<void> {
        if (!this.currentSession) return;

        this.currentSession.status = 'finished';
        this.emitEvent({ type: 'game_end' });

        // Update lobby status
        await supabase
            .from('lobbies')
            .update({ status: 'finished' })
            .eq('id', this.currentSession.lobbyId);

        await reconnectManager.endSession();

        this.currentSession = null;
        this.loadingComplete = false;
        this.localLoadProgress = 0;
    }

    /**
     * Assign players to teams based on game mode
     */
    private assignTeams(players: LobbyPlayer[], mode: string): SessionPlayer[] {
        const result: SessionPlayer[] = [];

        // Simple team assignment based on mode
        let teamCount = 2;
        let playersPerTeam = 1;

        switch (mode) {
            case 'main':
                teamCount = Math.min(players.length, 6);
                playersPerTeam = 1;
                break;
            case 'arena_1v1':
                teamCount = 2;
                playersPerTeam = 1;
                break;
            case 'arena_1v1v1':
                teamCount = 3;
                playersPerTeam = 1;
                break;
            case 'arena_3v3':
                teamCount = 2;
                playersPerTeam = 3;
                break;
            case 'arena_3v3v3':
                teamCount = 3;
                playersPerTeam = 3;
                break;
        }

        // Assign teams round-robin
        for (let i = 0; i < players.length; i++) {
            const player = players[i];
            const teamIndex = i % teamCount;
            const teamId = `team_${teamIndex}`;

            result.push({
                playerId: player.player_id,
                username: player.player?.username || 'Player',
                teamId,
                isConnected: true,
                loadProgress: 0,
            });
        }

        return result;
    }

    /**
     * Get current session
     */
    getCurrentSession(): GameSession | null {
        return this.currentSession;
    }

    /**
     * Check if in a session
     */
    isInSession(): boolean {
        return this.currentSession !== null;
    }

    /**
     * Add event listener
     */
    addListener(listener: (event: GameSyncEvent) => void): void {
        this.listeners.add(listener);
    }

    /**
     * Remove event listener
     */
    removeListener(listener: (event: GameSyncEvent) => void): void {
        this.listeners.delete(listener);
    }

    /**
     * Emit event to all listeners
     */
    private emitEvent(event: GameSyncEvent): void {
        for (const listener of this.listeners) {
            listener(event);
        }
    }
}

// Singleton export
export const gameSyncManager = GameSyncManager.getInstance();
