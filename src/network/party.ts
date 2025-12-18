// Party System - Manages groups of players for matchmaking
// Allows friends to queue together without being split

import { supabase, supabaseService } from './supabase';
import { GameMode } from '../core/types';

/**
 * Party status enum
 */
export enum PartyStatus {
    IDLE = 'idle',
    QUEUED = 'queued',
    IN_LOBBY = 'in_lobby',
    IN_MATCH = 'in_match',
}

/**
 * Party member data
 */
export interface PartyMember {
    playerId: string;
    username: string;
    displayName: string;
    isLeader: boolean;
    isReady: boolean;
    joinedAt: string;
}

/**
 * Party data
 */
export interface Party {
    id: string;
    leaderId: string;
    mode: GameMode | null;
    maxSize: number;
    status: PartyStatus;
    members: PartyMember[];
    createdAt: string;
}

/**
 * Party event types
 */
export type PartyEventType =
    | 'member_joined'
    | 'member_left'
    | 'leader_changed'
    | 'status_changed'
    | 'mode_changed'
    | 'party_disbanded';

export interface PartyEvent {
    type: PartyEventType;
    partyId: string;
    data?: Record<string, unknown>;
}

/**
 * Party Manager class - handles party operations
 */
export class PartyManager {
    private static instance: PartyManager;
    private currentParty: Party | null = null;
    private listeners: Set<(event: PartyEvent) => void> = new Set();

    private constructor() { }

    static getInstance(): PartyManager {
        if (!PartyManager.instance) {
            PartyManager.instance = new PartyManager();
        }
        return PartyManager.instance;
    }

    /**
     * Get current party (if in one)
     */
    getCurrentParty(): Party | null {
        return this.currentParty;
    }

    /**
     * Check if currently in a party
     */
    isInParty(): boolean {
        return this.currentParty !== null;
    }

    /**
     * Check if current user is party leader
     */
    isLeader(): boolean {
        if (!this.currentParty) return false;
        const user = supabaseService.getCurrentUser();
        return user?.id === this.currentParty.leaderId;
    }

    /**
     * Create a new party
     */
    async createParty(maxSize: number = 3): Promise<Party | null> {
        const user = supabaseService.getCurrentUser();
        if (!user) {
            console.error('[PartyManager] No user logged in');
            return null;
        }

        if (this.currentParty) {
            console.warn('[PartyManager] Already in a party');
            return this.currentParty;
        }

        try {
            // Create party
            const { data: party, error: partyError } = await supabase
                .from('parties')
                .insert({
                    leader_id: user.id,
                    max_size: maxSize,
                    status: 'idle',
                })
                .select()
                .single();

            if (partyError || !party) {
                console.error('[PartyManager] Failed to create party:', partyError);
                return null;
            }

            // Add leader as member
            const { error: memberError } = await supabase
                .from('party_members')
                .insert({
                    party_id: party.id,
                    player_id: user.id,
                    is_leader: true,
                    is_ready: true,
                });

            if (memberError) {
                console.error('[PartyManager] Failed to add leader as member:', memberError);
                // Cleanup party
                await supabase.from('parties').delete().eq('id', party.id);
                return null;
            }

            this.currentParty = {
                id: party.id,
                leaderId: party.leader_id,
                mode: null,
                maxSize: party.max_size,
                status: PartyStatus.IDLE,
                members: [{
                    playerId: user.id,
                    username: user.username,
                    displayName: user.display_name,
                    isLeader: true,
                    isReady: true,
                    joinedAt: new Date().toISOString(),
                }],
                createdAt: party.created_at,
            };

            // Subscribe to party updates
            this.subscribeToParty(party.id);

            return this.currentParty;
        } catch (err) {
            console.error('[PartyManager] Error creating party:', err);
            return null;
        }
    }

    /**
     * Join an existing party by ID
     */
    async joinParty(partyId: string): Promise<boolean> {
        const user = supabaseService.getCurrentUser();
        if (!user) {
            console.error('[PartyManager] No user logged in');
            return false;
        }

        if (this.currentParty) {
            console.warn('[PartyManager] Already in a party');
            return false;
        }

        try {
            // Check party exists and has space
            const { data: party, error: partyError } = await supabase
                .from('parties')
                .select('*, party_members(*)')
                .eq('id', partyId)
                .single();

            if (partyError || !party) {
                console.error('[PartyManager] Party not found:', partyError);
                return false;
            }

            if (party.party_members.length >= party.max_size) {
                console.error('[PartyManager] Party is full');
                return false;
            }

            if (party.status !== 'idle') {
                console.error('[PartyManager] Party is not accepting new members');
                return false;
            }

            // Join party
            const { error: joinError } = await supabase
                .from('party_members')
                .insert({
                    party_id: partyId,
                    player_id: user.id,
                    is_leader: false,
                    is_ready: false,
                });

            if (joinError) {
                console.error('[PartyManager] Failed to join party:', joinError);
                return false;
            }

            // Fetch updated party data
            await this.refreshPartyData(partyId);
            this.subscribeToParty(partyId);

            return true;
        } catch (err) {
            console.error('[PartyManager] Error joining party:', err);
            return false;
        }
    }

    /**
     * Invite a friend to the current party
     */
    async inviteFriend(friendId: string): Promise<boolean> {
        if (!this.currentParty) {
            console.error('[PartyManager] Not in a party');
            return false;
        }

        if (!this.isLeader()) {
            console.error('[PartyManager] Only leader can invite');
            return false;
        }

        // For now, just return the party ID for the friend to join
        // In a full implementation, you'd create an invite record and notify the friend
        console.log(`[PartyManager] Invite friend ${friendId} to party ${this.currentParty.id}`);
        return true;
    }

    /**
     * Leave the current party
     */
    async leaveParty(): Promise<boolean> {
        if (!this.currentParty) {
            return true; // Already not in a party
        }

        const user = supabaseService.getCurrentUser();
        if (!user) return false;

        try {
            const partyId = this.currentParty.id;
            const wasLeader = this.isLeader();
            const memberCount = this.currentParty.members.length;

            // Remove from party_members
            const { error } = await supabase
                .from('party_members')
                .delete()
                .eq('party_id', partyId)
                .eq('player_id', user.id);

            if (error) {
                console.error('[PartyManager] Failed to leave party:', error);
                return false;
            }

            // If was leader and others remain, transfer leadership
            if (wasLeader && memberCount > 1) {
                const newLeader = this.currentParty.members.find(m => m.playerId !== user.id);
                if (newLeader) {
                    await supabase
                        .from('parties')
                        .update({ leader_id: newLeader.playerId })
                        .eq('id', partyId);

                    await supabase
                        .from('party_members')
                        .update({ is_leader: true })
                        .eq('party_id', partyId)
                        .eq('player_id', newLeader.playerId);
                }
            }

            // If last member, delete party
            if (memberCount <= 1) {
                await supabase
                    .from('parties')
                    .delete()
                    .eq('id', partyId);
            }

            this.unsubscribeFromParty();
            this.currentParty = null;

            return true;
        } catch (err) {
            console.error('[PartyManager] Error leaving party:', err);
            return false;
        }
    }

    /**
     * Disband the party (leader only)
     */
    async disbandParty(): Promise<boolean> {
        if (!this.currentParty || !this.isLeader()) {
            return false;
        }

        try {
            const partyId = this.currentParty.id;

            // Delete party (cascades to members)
            const { error } = await supabase
                .from('parties')
                .delete()
                .eq('id', partyId);

            if (error) {
                console.error('[PartyManager] Failed to disband party:', error);
                return false;
            }

            this.emitEvent({ type: 'party_disbanded', partyId });
            this.unsubscribeFromParty();
            this.currentParty = null;

            return true;
        } catch (err) {
            console.error('[PartyManager] Error disbanding party:', err);
            return false;
        }
    }

    /**
     * Set ready status
     */
    async setReady(ready: boolean): Promise<boolean> {
        if (!this.currentParty) return false;

        const user = supabaseService.getCurrentUser();
        if (!user) return false;

        try {
            const { error } = await supabase
                .from('party_members')
                .update({ is_ready: ready })
                .eq('party_id', this.currentParty.id)
                .eq('player_id', user.id);

            if (error) {
                console.error('[PartyManager] Failed to set ready:', error);
                return false;
            }

            // Update local state
            const member = this.currentParty.members.find(m => m.playerId === user.id);
            if (member) member.isReady = ready;

            return true;
        } catch (err) {
            console.error('[PartyManager] Error setting ready:', err);
            return false;
        }
    }

    /**
     * Set party mode for queueing (leader only)
     */
    async setMode(mode: GameMode): Promise<boolean> {
        if (!this.currentParty || !this.isLeader()) return false;

        try {
            const { error } = await supabase
                .from('parties')
                .update({ mode: mode })
                .eq('id', this.currentParty.id);

            if (error) {
                console.error('[PartyManager] Failed to set mode:', error);
                return false;
            }

            this.currentParty.mode = mode;
            this.emitEvent({ type: 'mode_changed', partyId: this.currentParty.id, data: { mode } });

            return true;
        } catch (err) {
            console.error('[PartyManager] Error setting mode:', err);
            return false;
        }
    }

    /**
     * Check if party is ready to queue
     */
    canQueue(): boolean {
        if (!this.currentParty) return false;
        if (!this.currentParty.mode) return false;
        return this.currentParty.members.every(m => m.isReady);
    }

    /**
     * Start queue with party (leader only)
     */
    async startQueue(): Promise<boolean> {
        if (!this.currentParty || !this.isLeader()) return false;
        if (!this.canQueue()) return false;

        try {
            // Update party status
            const { error } = await supabase
                .from('parties')
                .update({ status: 'queued' })
                .eq('id', this.currentParty.id);

            if (error) {
                console.error('[PartyManager] Failed to start queue:', error);
                return false;
            }

            this.currentParty.status = PartyStatus.QUEUED;
            this.emitEvent({ type: 'status_changed', partyId: this.currentParty.id, data: { status: 'queued' } });

            // Create matchmaking tickets for all party members
            for (const member of this.currentParty.members) {
                await supabase
                    .from('matchmaking_tickets')
                    .insert({
                        player_id: member.playerId,
                        mode: this.currentParty.mode,
                        party_id: this.currentParty.id,
                        status: 'searching',
                    });
            }

            return true;
        } catch (err) {
            console.error('[PartyManager] Error starting queue:', err);
            return false;
        }
    }

    /**
     * Cancel queue (leader only)
     */
    async cancelQueue(): Promise<boolean> {
        if (!this.currentParty || !this.isLeader()) return false;

        try {
            // Cancel all tickets for this party
            await supabase
                .from('matchmaking_tickets')
                .update({ status: 'cancelled' })
                .eq('party_id', this.currentParty.id);

            // Update party status
            const { error } = await supabase
                .from('parties')
                .update({ status: 'idle' })
                .eq('id', this.currentParty.id);

            if (error) {
                console.error('[PartyManager] Failed to cancel queue:', error);
                return false;
            }

            this.currentParty.status = PartyStatus.IDLE;
            this.emitEvent({ type: 'status_changed', partyId: this.currentParty.id, data: { status: 'idle' } });

            return true;
        } catch (err) {
            console.error('[PartyManager] Error cancelling queue:', err);
            return false;
        }
    }

    /**
     * Refresh party data from server
     */
    private async refreshPartyData(partyId: string): Promise<void> {
        try {
            const { data: party, error } = await supabase
                .from('parties')
                .select(`
          *,
          party_members (
            player_id,
            is_leader,
            is_ready,
            joined_at,
            profiles:player_id (
              username,
              display_name
            )
          )
        `)
                .eq('id', partyId)
                .single();

            if (error || !party) {
                console.error('[PartyManager] Failed to refresh party:', error);
                return;
            }

            this.currentParty = {
                id: party.id,
                leaderId: party.leader_id,
                mode: party.mode as GameMode | null,
                maxSize: party.max_size,
                status: party.status as PartyStatus,
                members: party.party_members.map((pm: any) => ({
                    playerId: pm.player_id,
                    username: pm.profiles?.username || 'Unknown',
                    displayName: pm.profiles?.display_name || 'Unknown',
                    isLeader: pm.is_leader,
                    isReady: pm.is_ready,
                    joinedAt: pm.joined_at,
                })),
                createdAt: party.created_at,
            };
        } catch (err) {
            console.error('[PartyManager] Error refreshing party:', err);
        }
    }

    /**
     * Subscribe to party updates via Supabase Realtime
     */
    private partyChannel: ReturnType<typeof supabase.channel> | null = null;

    private subscribeToParty(partyId: string): void {
        // Cleanup any existing subscription
        this.unsubscribeFromParty();

        // Create realtime channel for this party
        this.partyChannel = supabase
            .channel(`party:${partyId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'parties',
                    filter: `id=eq.${partyId}`,
                },
                (payload) => {
                    console.log('[PartyManager] Party change:', payload);
                    this.handlePartyChange(payload);
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'party_members',
                    filter: `party_id=eq.${partyId}`,
                },
                (payload) => {
                    console.log('[PartyManager] Member change:', payload);
                    this.handleMemberChange(payload);
                }
            )
            .subscribe((status) => {
                console.log('[PartyManager] Subscription status:', status);
            });

        console.log(`[PartyManager] Subscribed to party ${partyId} updates`);
    }

    /**
     * Handle party table changes
     */
    private handlePartyChange(payload: any): void {
        if (!this.currentParty) return;

        if (payload.eventType === 'DELETE') {
            // Party was deleted/disbanded
            this.emitEvent({ type: 'party_disbanded', partyId: this.currentParty.id });
            this.unsubscribeFromParty();
            this.currentParty = null;
            return;
        }

        if (payload.eventType === 'UPDATE') {
            const newData = payload.new;

            // Check for status change
            if (newData.status && newData.status !== this.currentParty.status) {
                const oldStatus = this.currentParty.status;
                this.currentParty.status = newData.status as PartyStatus;
                this.emitEvent({
                    type: 'status_changed',
                    partyId: this.currentParty.id,
                    data: { status: newData.status, oldStatus }
                });
            }

            // Check for leader change
            if (newData.leader_id && newData.leader_id !== this.currentParty.leaderId) {
                const oldLeader = this.currentParty.leaderId;
                this.currentParty.leaderId = newData.leader_id;

                // Update member leader flags
                for (const member of this.currentParty.members) {
                    member.isLeader = member.playerId === newData.leader_id;
                }

                this.emitEvent({
                    type: 'leader_changed',
                    partyId: this.currentParty.id,
                    data: { newLeader: newData.leader_id, oldLeader }
                });
            }

            // Check for mode change
            if (newData.mode !== undefined && newData.mode !== this.currentParty.mode) {
                this.currentParty.mode = newData.mode as GameMode | null;
                this.emitEvent({
                    type: 'mode_changed',
                    partyId: this.currentParty.id,
                    data: { mode: newData.mode }
                });
            }
        }
    }

    /**
     * Handle party_members table changes
     */
    private async handleMemberChange(payload: any): Promise<void> {
        if (!this.currentParty) return;

        const user = supabaseService.getCurrentUser();
        const isCurrentUser = payload.new?.player_id === user?.id || payload.old?.player_id === user?.id;

        if (payload.eventType === 'INSERT') {
            // New member joined - fetch their profile
            const newMemberId = payload.new.player_id;

            // Don't duplicate if we already have this member
            if (this.currentParty.members.find(m => m.playerId === newMemberId)) {
                return;
            }

            try {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('username, display_name')
                    .eq('id', newMemberId)
                    .single();

                const newMember: PartyMember = {
                    playerId: newMemberId,
                    username: profile?.username || 'Unknown',
                    displayName: profile?.display_name || 'Unknown',
                    isLeader: payload.new.is_leader || false,
                    isReady: payload.new.is_ready || false,
                    joinedAt: payload.new.joined_at || new Date().toISOString(),
                };

                this.currentParty.members.push(newMember);
                this.emitEvent({
                    type: 'member_joined',
                    partyId: this.currentParty.id,
                    data: { member: newMember }
                });
            } catch (err) {
                console.error('[PartyManager] Error fetching new member profile:', err);
            }
        }

        if (payload.eventType === 'DELETE') {
            const leftMemberId = payload.old.player_id;

            // If current user was removed, leave party
            if (isCurrentUser) {
                this.emitEvent({ type: 'party_disbanded', partyId: this.currentParty.id });
                this.unsubscribeFromParty();
                this.currentParty = null;
                return;
            }

            // Remove member from local state
            const memberIndex = this.currentParty.members.findIndex(m => m.playerId === leftMemberId);
            if (memberIndex !== -1) {
                const leftMember = this.currentParty.members[memberIndex];
                this.currentParty.members.splice(memberIndex, 1);
                this.emitEvent({
                    type: 'member_left',
                    partyId: this.currentParty.id,
                    data: { member: leftMember }
                });
            }
        }

        if (payload.eventType === 'UPDATE') {
            const updatedMemberId = payload.new.player_id;
            const member = this.currentParty.members.find(m => m.playerId === updatedMemberId);

            if (member) {
                // Update ready status
                if (payload.new.is_ready !== undefined) {
                    member.isReady = payload.new.is_ready;
                }
                // Update leader status
                if (payload.new.is_leader !== undefined) {
                    member.isLeader = payload.new.is_leader;
                }

                // Emit generic member update (ready state changed)
                this.emitEvent({
                    type: 'member_joined', // Reusing as "member_updated"
                    partyId: this.currentParty.id,
                    data: { member, updated: true }
                });
            }
        }
    }

    /**
     * Unsubscribe from party updates
     */
    private unsubscribeFromParty(): void {
        if (this.partyChannel) {
            supabase.removeChannel(this.partyChannel);
            this.partyChannel = null;
            console.log('[PartyManager] Unsubscribed from party updates');
        }
    }

    /**
     * Add event listener
     */
    addListener(listener: (event: PartyEvent) => void): void {
        this.listeners.add(listener);
    }

    /**
     * Remove event listener
     */
    removeListener(listener: (event: PartyEvent) => void): void {
        this.listeners.delete(listener);
    }

    /**
     * Emit event to all listeners
     */
    private emitEvent(event: PartyEvent): void {
        for (const listener of this.listeners) {
            listener(event);
        }
    }
}

// Singleton export
export const partyManager = PartyManager.getInstance();
