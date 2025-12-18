// Webb Protocol - Supabase Signaling Adapter
// Uses Supabase Realtime for WebRTC signaling

import { SignalingMessage } from './types';
import { SignalingProvider } from './mesh';
import { supabase } from '../supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Supabase-based signaling provider for Webb Protocol
 * Uses Realtime Broadcast for WebRTC signaling
 */
export class SupabaseSignaling implements SignalingProvider {
    private channel: RealtimeChannel | null = null;
    private matchId: string = '';

    constructor() { }

    /**
     * Send a signaling message
     */
    async send(message: SignalingMessage): Promise<void> {
        if (!this.channel) {
            console.warn('[SupabaseSignaling] No channel to send on');
            return;
        }

        await this.channel.send({
            type: 'broadcast',
            event: 'signal',
            payload: message,
        });
    }

    /**
     * Subscribe to signaling messages for a match
     */
    subscribe(matchId: string, callback: (message: SignalingMessage) => void): () => void {
        this.matchId = matchId;

        if (!supabase) {
            console.warn('[SupabaseSignaling] Supabase not initialized');
            return () => { };
        }

        // Create realtime channel for this match
        this.channel = supabase.channel(`webb:${matchId}`, {
            config: {
                broadcast: {
                    self: false, // Don't receive our own messages
                },
            },
        });

        // Subscribe to signaling events
        this.channel.on(
            'broadcast',
            { event: 'signal' },
            (payload) => {
                const message = payload.payload as SignalingMessage;
                callback(message);
            }
        );

        // Subscribe to the channel
        this.channel.subscribe((status) => {
            console.log(`[SupabaseSignaling] Channel status: ${status}`);
        });

        console.log(`[SupabaseSignaling] Subscribed to match ${matchId}`);

        // Return unsubscribe function
        return () => {
            if (this.channel) {
                supabase.removeChannel(this.channel);
                this.channel = null;
            }
        };
    }
}

/**
 * Create a new signaling provider instance
 */
export function createSignaling(): SignalingProvider {
    return new SupabaseSignaling();
}
