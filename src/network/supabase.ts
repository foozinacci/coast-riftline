// Supabase Client Configuration
// Online multiplayer infrastructure for Riftline

import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';

// Environment configuration - these should be in .env in production
const SUPABASE_URL = 'https://apschbgavppsbjxieuql.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Create Supabase client
export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Types for matchmaking and lobbies
export interface PlayerProfile {
    id: string;
    username: string;
    display_name: string;
    avatar_url?: string;
    rank?: number;
    created_at: string;
}

export interface GameLobby {
    id: string;
    host_id: string;
    mode: string;
    structure: string;
    is_private: boolean;
    is_ranked: boolean;
    max_players: number;
    current_players: number;
    status: 'waiting' | 'starting' | 'in_progress' | 'finished';
    code?: string;
    created_at: string;
}

export interface LobbyPlayer {
    id: string;
    lobby_id: string;
    player_id: string;
    team_id?: string;
    is_ready: boolean;
    is_host: boolean;
    joined_at: string;
    player?: PlayerProfile;
}

export interface MatchmakingTicket {
    id: string;
    player_id: string;
    mode: string;
    rank?: number;
    region?: string;
    status: 'searching' | 'matched' | 'cancelled';
    created_at: string;
}

/**
 * Supabase Service - Handles all online multiplayer functionality
 */
export class SupabaseService {
    private static instance: SupabaseService;
    private currentUser: PlayerProfile | null = null;
    private lobbyChannel: RealtimeChannel | null = null;
    private matchmakingChannel: RealtimeChannel | null = null;

    private constructor() { }

    static getInstance(): SupabaseService {
        if (!SupabaseService.instance) {
            SupabaseService.instance = new SupabaseService();
        }
        return SupabaseService.instance;
    }

    // Check if Supabase is configured
    isConfigured(): boolean {
        return SUPABASE_ANON_KEY !== '';
    }

    // ==================== AUTHENTICATION ====================

    async signInAnonymously(): Promise<PlayerProfile | null> {
        try {
            const { data, error } = await supabase.auth.signInAnonymously();
            if (error) throw error;

            if (data.user) {
                // Create or get profile
                const profile = await this.getOrCreateProfile(data.user.id);
                this.currentUser = profile;
                return profile;
            }
            return null;
        } catch (error) {
            console.error('Anonymous sign-in failed:', error);
            return null;
        }
    }

    async signOut(): Promise<void> {
        await supabase.auth.signOut();
        this.currentUser = null;
    }

    getCurrentUser(): PlayerProfile | null {
        return this.currentUser;
    }

    private async getOrCreateProfile(userId: string): Promise<PlayerProfile | null> {
        try {
            // Try to get existing profile
            const { data: existing, error: fetchError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (existing) return existing as PlayerProfile;

            // Create new profile
            const newProfile = {
                id: userId,
                username: `Player_${userId.slice(0, 8)}`,
                display_name: `Recruit`,
                created_at: new Date().toISOString(),
            };

            const { data: created, error: createError } = await supabase
                .from('profiles')
                .insert(newProfile)
                .select()
                .single();

            if (createError) throw createError;
            return created as PlayerProfile;
        } catch (error) {
            console.error('Profile creation failed:', error);
            return null;
        }
    }

    // ==================== LOBBIES ====================

    async createLobby(options: {
        mode: string;
        structure: string;
        isPrivate: boolean;
        isRanked: boolean;
        maxPlayers: number;
    }): Promise<GameLobby | null> {
        if (!this.currentUser) return null;

        try {
            const lobbyCode = options.isPrivate ? this.generateLobbyCode() : null;

            const { data, error } = await supabase
                .from('lobbies')
                .insert({
                    host_id: this.currentUser.id,
                    mode: options.mode,
                    structure: options.structure,
                    is_private: options.isPrivate,
                    is_ranked: options.isRanked,
                    max_players: options.maxPlayers,
                    current_players: 1,
                    status: 'waiting',
                    code: lobbyCode,
                })
                .select()
                .single();

            if (error) throw error;

            // Add host as first player
            await supabase.from('lobby_players').insert({
                lobby_id: data.id,
                player_id: this.currentUser.id,
                is_ready: false,
                is_host: true,
            });

            // Subscribe to lobby updates
            await this.subscribeLobby(data.id);

            return data as GameLobby;
        } catch (error) {
            console.error('Lobby creation failed:', error);
            return null;
        }
    }

    async joinLobby(lobbyId: string): Promise<boolean> {
        if (!this.currentUser) return false;

        try {
            // Check if lobby exists and has space
            const { data: lobby, error: lobbyError } = await supabase
                .from('lobbies')
                .select('*')
                .eq('id', lobbyId)
                .single();

            if (lobbyError || !lobby) return false;
            if (lobby.current_players >= lobby.max_players) return false;
            if (lobby.status !== 'waiting') return false;

            // Join lobby
            await supabase.from('lobby_players').insert({
                lobby_id: lobbyId,
                player_id: this.currentUser.id,
                is_ready: false,
                is_host: false,
            });

            // Update player count
            await supabase
                .from('lobbies')
                .update({ current_players: lobby.current_players + 1 })
                .eq('id', lobbyId);

            await this.subscribeLobby(lobbyId);
            return true;
        } catch (error) {
            console.error('Join lobby failed:', error);
            return false;
        }
    }

    async joinByCode(code: string): Promise<GameLobby | null> {
        try {
            const { data, error } = await supabase
                .from('lobbies')
                .select('*')
                .eq('code', code.toUpperCase())
                .eq('status', 'waiting')
                .single();

            if (error || !data) return null;

            const joined = await this.joinLobby(data.id);
            return joined ? data as GameLobby : null;
        } catch (error) {
            console.error('Join by code failed:', error);
            return null;
        }
    }

    async leaveLobby(lobbyId: string): Promise<void> {
        if (!this.currentUser) return;

        try {
            // Remove player from lobby
            await supabase
                .from('lobby_players')
                .delete()
                .eq('lobby_id', lobbyId)
                .eq('player_id', this.currentUser.id);

            // Update player count
            const { data: lobby } = await supabase
                .from('lobbies')
                .select('current_players, host_id')
                .eq('id', lobbyId)
                .single();

            if (lobby) {
                if (lobby.host_id === this.currentUser.id) {
                    // Host leaves - close lobby
                    await supabase.from('lobbies').delete().eq('id', lobbyId);
                } else {
                    await supabase
                        .from('lobbies')
                        .update({ current_players: Math.max(0, lobby.current_players - 1) })
                        .eq('id', lobbyId);
                }
            }

            this.unsubscribeLobby();
        } catch (error) {
            console.error('Leave lobby failed:', error);
        }
    }

    async setReady(lobbyId: string, ready: boolean): Promise<void> {
        if (!this.currentUser) return;

        await supabase
            .from('lobby_players')
            .update({ is_ready: ready })
            .eq('lobby_id', lobbyId)
            .eq('player_id', this.currentUser.id);
    }

    async getPublicLobbies(mode?: string): Promise<GameLobby[]> {
        try {
            let query = supabase
                .from('lobbies')
                .select('*')
                .eq('is_private', false)
                .eq('status', 'waiting')
                .order('created_at', { ascending: false })
                .limit(20);

            if (mode) {
                query = query.eq('mode', mode);
            }

            const { data, error } = await query;
            if (error) throw error;
            return (data || []) as GameLobby[];
        } catch (error) {
            console.error('Get lobbies failed:', error);
            return [];
        }
    }

    async getLobbyPlayers(lobbyId: string): Promise<LobbyPlayer[]> {
        try {
            const { data, error } = await supabase
                .from('lobby_players')
                .select('*, player:profiles(*)')
                .eq('lobby_id', lobbyId);

            if (error) throw error;
            return (data || []) as LobbyPlayer[];
        } catch (error) {
            console.error('Get lobby players failed:', error);
            return [];
        }
    }

    // ==================== MATCHMAKING ====================

    async startMatchmaking(mode: string, onMatch: (lobbyId: string) => void): Promise<string | null> {
        if (!this.currentUser) return null;

        try {
            // Create matchmaking ticket
            const { data: ticket, error } = await supabase
                .from('matchmaking_tickets')
                .insert({
                    player_id: this.currentUser.id,
                    mode,
                    rank: this.currentUser.rank || 1000,
                    status: 'searching',
                })
                .select()
                .single();

            if (error) throw error;

            // Subscribe to matchmaking updates
            this.matchmakingChannel = supabase
                .channel(`matchmaking:${ticket.id}`)
                .on('postgres_changes', {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'matchmaking_tickets',
                    filter: `id=eq.${ticket.id}`,
                }, (payload) => {
                    if (payload.new.status === 'matched' && payload.new.lobby_id) {
                        onMatch(payload.new.lobby_id);
                        this.cancelMatchmaking(ticket.id);
                    }
                })
                .subscribe();

            return ticket.id;
        } catch (error) {
            console.error('Start matchmaking failed:', error);
            return null;
        }
    }

    async cancelMatchmaking(ticketId: string): Promise<void> {
        try {
            await supabase
                .from('matchmaking_tickets')
                .update({ status: 'cancelled' })
                .eq('id', ticketId);

            if (this.matchmakingChannel) {
                supabase.removeChannel(this.matchmakingChannel);
                this.matchmakingChannel = null;
            }
        } catch (error) {
            console.error('Cancel matchmaking failed:', error);
        }
    }

    // ==================== REALTIME ====================

    private async subscribeLobby(lobbyId: string): Promise<void> {
        this.unsubscribeLobby();

        this.lobbyChannel = supabase
            .channel(`lobby:${lobbyId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'lobby_players',
                filter: `lobby_id=eq.${lobbyId}`,
            }, (payload) => {
                // Emit lobby player update event
                window.dispatchEvent(new CustomEvent('lobby_player_update', { detail: payload }));
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'lobbies',
                filter: `id=eq.${lobbyId}`,
            }, (payload) => {
                // Emit lobby update event
                window.dispatchEvent(new CustomEvent('lobby_update', { detail: payload }));
            })
            .subscribe();
    }

    private unsubscribeLobby(): void {
        if (this.lobbyChannel) {
            supabase.removeChannel(this.lobbyChannel);
            this.lobbyChannel = null;
        }
    }

    private generateLobbyCode(): string {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }
}

// Singleton export
export const supabaseService = SupabaseService.getInstance();
