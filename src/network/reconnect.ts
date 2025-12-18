// Reconnect System - Handles player disconnection and reconnection during matches
// Integrates with Supabase for session tracking

import { supabase, supabaseService } from './supabase';
import { getNavigationManager } from '../core/navigation';
import { AppState } from '../core/types';

/**
 * Player session state
 */
export interface PlayerSession {
    sessionToken: string;
    lobbyId: string;
    playerId: string;
    disconnectedAt: Date | null;
    reconnectAllowed: boolean;
}

/**
 * Reconnect status
 */
export enum ReconnectStatus {
    NOT_DISCONNECTED = 'not_disconnected',
    CHECKING = 'checking',
    SESSION_FOUND = 'session_found',
    NO_SESSION = 'no_session',
    RECONNECTING = 'reconnecting',
    RECONNECTED = 'reconnected',
    FAILED = 'failed',
}

/**
 * Reconnect event types
 */
export type ReconnectEventType =
    | 'disconnected'
    | 'reconnect_available'
    | 'reconnecting'
    | 'reconnected'
    | 'reconnect_failed'
    | 'session_expired';

export interface ReconnectEvent {
    type: ReconnectEventType;
    data?: Record<string, unknown>;
}

/**
 * Reconnect Manager class
 */
export class ReconnectManager {
    private static instance: ReconnectManager;
    private currentSession: PlayerSession | null = null;
    private status: ReconnectStatus = ReconnectStatus.NOT_DISCONNECTED;
    private listeners: Set<(event: ReconnectEvent) => void> = new Set();
    private heartbeatInterval: number | null = null;
    private reconnectWindow: number = 120000; // 2 minutes to reconnect

    // Online status tracking
    private isOnline: boolean = navigator.onLine;

    private constructor() {
        // Listen for network status changes
        window.addEventListener('online', this.handleOnline.bind(this));
        window.addEventListener('offline', this.handleOffline.bind(this));
    }

    static getInstance(): ReconnectManager {
        if (!ReconnectManager.instance) {
            ReconnectManager.instance = new ReconnectManager();
        }
        return ReconnectManager.instance;
    }

    /**
     * Start tracking a session (call when joining a match)
     */
    async startSession(lobbyId: string): Promise<string | null> {
        const user = supabaseService.getCurrentUser();
        if (!user) return null;

        // Generate session token
        const sessionToken = this.generateSessionToken();

        try {
            // Store session in database
            const { error } = await supabase
                .from('lobby_players')
                .update({
                    session_token: sessionToken,
                    disconnected_at: null,
                    reconnect_allowed: true,
                })
                .eq('lobby_id', lobbyId)
                .eq('player_id', user.id);

            if (error) {
                console.error('[ReconnectManager] Failed to start session:', error);
                return null;
            }

            this.currentSession = {
                sessionToken,
                lobbyId,
                playerId: user.id,
                disconnectedAt: null,
                reconnectAllowed: true,
            };

            // Store locally for reconnect checks
            localStorage.setItem('riftline_session', JSON.stringify({
                sessionToken,
                lobbyId,
                playerId: user.id,
                startedAt: Date.now(),
            }));

            // Start heartbeat
            this.startHeartbeat(lobbyId);

            console.log('[ReconnectManager] Session started:', sessionToken);
            return sessionToken;
        } catch (err) {
            console.error('[ReconnectManager] Error starting session:', err);
            return null;
        }
    }

    /**
     * End the current session (call when match ends normally)
     */
    async endSession(): Promise<void> {
        if (!this.currentSession) return;

        this.stopHeartbeat();

        try {
            await supabase
                .from('lobby_players')
                .update({
                    session_token: null,
                    disconnected_at: null,
                    reconnect_allowed: false,
                })
                .eq('lobby_id', this.currentSession.lobbyId)
                .eq('player_id', this.currentSession.playerId);
        } catch (err) {
            console.error('[ReconnectManager] Error ending session:', err);
        }

        this.currentSession = null;
        localStorage.removeItem('riftline_session');
        this.status = ReconnectStatus.NOT_DISCONNECTED;
    }

    /**
     * Check if there's a session to reconnect to
     */
    async checkForReconnect(): Promise<boolean> {
        this.status = ReconnectStatus.CHECKING;

        // Check local storage for session info
        const storedSession = localStorage.getItem('riftline_session');
        if (!storedSession) {
            this.status = ReconnectStatus.NO_SESSION;
            return false;
        }

        const session = JSON.parse(storedSession);
        const user = supabaseService.getCurrentUser();

        if (!user || session.playerId !== user.id) {
            localStorage.removeItem('riftline_session');
            this.status = ReconnectStatus.NO_SESSION;
            return false;
        }

        try {
            // Check if session is still valid in database
            const { data, error } = await supabase
                .from('lobby_players')
                .select('session_token, disconnected_at, reconnect_allowed')
                .eq('lobby_id', session.lobbyId)
                .eq('player_id', user.id)
                .single();

            if (error || !data) {
                localStorage.removeItem('riftline_session');
                this.status = ReconnectStatus.NO_SESSION;
                return false;
            }

            if (!data.reconnect_allowed || data.session_token !== session.sessionToken) {
                localStorage.removeItem('riftline_session');
                this.status = ReconnectStatus.NO_SESSION;
                this.emitEvent({ type: 'session_expired' });
                return false;
            }

            // Check if disconnect was recent enough
            if (data.disconnected_at) {
                const disconnectTime = new Date(data.disconnected_at).getTime();
                const elapsed = Date.now() - disconnectTime;

                if (elapsed > this.reconnectWindow) {
                    localStorage.removeItem('riftline_session');
                    this.status = ReconnectStatus.NO_SESSION;
                    this.emitEvent({ type: 'session_expired' });
                    return false;
                }
            }

            this.currentSession = {
                sessionToken: session.sessionToken,
                lobbyId: session.lobbyId,
                playerId: user.id,
                disconnectedAt: data.disconnected_at ? new Date(data.disconnected_at) : null,
                reconnectAllowed: true,
            };

            this.status = ReconnectStatus.SESSION_FOUND;
            this.emitEvent({
                type: 'reconnect_available',
                data: { lobbyId: session.lobbyId }
            });

            return true;
        } catch (err) {
            console.error('[ReconnectManager] Error checking reconnect:', err);
            this.status = ReconnectStatus.NO_SESSION;
            return false;
        }
    }

    /**
     * Attempt to reconnect to an existing session
     */
    async reconnect(): Promise<boolean> {
        if (!this.currentSession || this.status !== ReconnectStatus.SESSION_FOUND) {
            return false;
        }

        this.status = ReconnectStatus.RECONNECTING;
        this.emitEvent({ type: 'reconnecting' });

        try {
            const { error } = await supabase
                .from('lobby_players')
                .update({
                    disconnected_at: null,
                })
                .eq('lobby_id', this.currentSession.lobbyId)
                .eq('player_id', this.currentSession.playerId)
                .eq('session_token', this.currentSession.sessionToken);

            if (error) {
                this.status = ReconnectStatus.FAILED;
                this.emitEvent({ type: 'reconnect_failed' });
                return false;
            }

            // Restart heartbeat
            this.startHeartbeat(this.currentSession.lobbyId);

            this.status = ReconnectStatus.RECONNECTED;
            this.emitEvent({
                type: 'reconnected',
                data: { lobbyId: this.currentSession.lobbyId }
            });

            // Navigate to match
            const navManager = getNavigationManager();
            navManager.forceNavigateTo(AppState.IN_MATCH);

            return true;
        } catch (err) {
            console.error('[ReconnectManager] Error reconnecting:', err);
            this.status = ReconnectStatus.FAILED;
            this.emitEvent({ type: 'reconnect_failed' });
            return false;
        }
    }

    /**
     * Mark player as disconnected (call when connection lost)
     */
    async markDisconnected(): Promise<void> {
        if (!this.currentSession) return;

        this.stopHeartbeat();

        try {
            await supabase
                .from('lobby_players')
                .update({
                    disconnected_at: new Date().toISOString(),
                })
                .eq('lobby_id', this.currentSession.lobbyId)
                .eq('player_id', this.currentSession.playerId);

            this.emitEvent({ type: 'disconnected' });
        } catch (err) {
            console.error('[ReconnectManager] Error marking disconnected:', err);
        }
    }

    /**
     * Handle going online
     */
    private handleOnline(): void {
        console.log('[ReconnectManager] Connection restored');
        this.isOnline = true;

        // Check if we have a session to reconnect
        if (this.currentSession) {
            this.checkForReconnect().then(canReconnect => {
                if (canReconnect) {
                    this.reconnect();
                }
            });
        }
    }

    /**
     * Handle going offline
     */
    private handleOffline(): void {
        console.log('[ReconnectManager] Connection lost');
        this.isOnline = false;
        this.markDisconnected();
    }

    /**
     * Start heartbeat to keep session alive
     */
    private startHeartbeat(lobbyId: string): void {
        this.stopHeartbeat();

        // Send heartbeat every 30 seconds
        this.heartbeatInterval = window.setInterval(async () => {
            if (!this.currentSession) return;

            try {
                await supabase
                    .from('lobby_players')
                    .update({ disconnected_at: null })
                    .eq('lobby_id', lobbyId)
                    .eq('player_id', this.currentSession.playerId);
            } catch (err) {
                console.warn('[ReconnectManager] Heartbeat failed:', err);
            }
        }, 30000);
    }

    /**
     * Stop heartbeat
     */
    private stopHeartbeat(): void {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    /**
     * Generate session token
     */
    private generateSessionToken(): string {
        const arr = new Uint8Array(16);
        crypto.getRandomValues(arr);
        return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Get current status
     */
    getStatus(): ReconnectStatus {
        return this.status;
    }

    /**
     * Get current session
     */
    getCurrentSession(): PlayerSession | null {
        return this.currentSession;
    }

    /**
     * Check if online
     */
    isConnected(): boolean {
        return this.isOnline;
    }

    /**
     * Add event listener
     */
    addListener(listener: (event: ReconnectEvent) => void): void {
        this.listeners.add(listener);
    }

    /**
     * Remove event listener
     */
    removeListener(listener: (event: ReconnectEvent) => void): void {
        this.listeners.delete(listener);
    }

    /**
     * Emit event to all listeners
     */
    private emitEvent(event: ReconnectEvent): void {
        for (const listener of this.listeners) {
            listener(event);
        }
    }

    /**
     * Cleanup
     */
    destroy(): void {
        window.removeEventListener('online', this.handleOnline.bind(this));
        window.removeEventListener('offline', this.handleOffline.bind(this));
        this.stopHeartbeat();
    }
}

// Singleton export
export const reconnectManager = ReconnectManager.getInstance();
