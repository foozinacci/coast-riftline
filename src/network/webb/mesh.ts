// Webb Protocol - Mesh Network Manager
// Orchestrates the full mesh network: signaling, connections, anchor election

import {
    MeshPeer,
    MeshRole,
    PeerState,
    ConnectionQuality,
    SignalingMessage,
    SyncMessage,
    WebbMatchConfig,
    DEFAULT_WEBB_CONFIG,
    electAnchors,
} from './types';
import { PeerConnection, createPeerConnection, PeerCallbacks } from './peer';
import { QualityTester } from './quality';

/**
 * Mesh network events
 */
export interface MeshEvents {
    onPeerJoined: (peer: MeshPeer) => void;
    onPeerLeft: (peerId: string) => void;
    onRoleAssigned: (role: MeshRole, isPrimary: boolean) => void;
    onMatchReady: (anchors: string[], primaryId: string) => void;
    onGameMessage: (from: string, message: SyncMessage) => void;
    onConnectionFailed: (peerId: string, error: Error) => void;
}

/**
 * Signaling interface (implemented by Supabase adapter)
 */
export interface SignalingProvider {
    send: (message: SignalingMessage) => Promise<void>;
    subscribe: (matchId: string, callback: (message: SignalingMessage) => void) => () => void;
}

/**
 * Main mesh network manager
 */
export class MeshManager {
    private localId: string;
    private matchId: string;
    private config: WebbMatchConfig;
    private events: MeshEvents;
    private signaling: SignalingProvider;

    // State
    private peers: Map<string, MeshPeer> = new Map();
    private connections: Map<string, PeerConnection> = new Map();
    private role: MeshRole = 'player';
    private isPrimary: boolean = false;
    private squadId: number = -1;
    private anchorIds: string[] = [];
    private primaryId: string = '';
    private localQuality: ConnectionQuality | null = null;

    // Unsubscribe from signaling
    private unsubscribeSignaling: (() => void) | null = null;

    constructor(
        localId: string,
        matchId: string,
        signaling: SignalingProvider,
        events: MeshEvents,
        config: Partial<WebbMatchConfig> = {}
    ) {
        this.localId = localId;
        this.matchId = matchId;
        this.signaling = signaling;
        this.events = events;
        this.config = { ...DEFAULT_WEBB_CONFIG, ...config, matchId };
    }

    /**
     * Join the mesh network
     */
    async join(): Promise<void> {
        console.log(`[MeshManager] Joining match ${this.matchId} as ${this.localId}`);

        // Subscribe to signaling messages
        this.unsubscribeSignaling = this.signaling.subscribe(
            this.matchId,
            (msg) => this.handleSignalingMessage(msg)
        );

        // Run quality test
        const tester = new QualityTester(this.localId);
        this.localQuality = await tester.runTest(this.config.qualityTestDuration);

        // Broadcast quality report
        await this.signaling.send({
            type: 'quality-report',
            from: this.localId,
            to: '*',
            matchId: this.matchId,
            payload: this.localQuality,
            timestamp: Date.now(),
        });

        console.log(`[MeshManager] Quality reported, score: ${this.localQuality.score}`);
    }

    /**
     * Leave the mesh network
     */
    leave(): void {
        console.log(`[MeshManager] Leaving match ${this.matchId}`);

        // Close all connections
        for (const [, conn] of this.connections) {
            conn.close();
        }
        this.connections.clear();
        this.peers.clear();

        // Unsubscribe from signaling
        if (this.unsubscribeSignaling) {
            this.unsubscribeSignaling();
            this.unsubscribeSignaling = null;
        }
    }

    /**
     * Start anchor election (called by match host when ready)
     */
    async startAnchorElection(): Promise<void> {
        console.log('[MeshManager] Starting anchor election...');

        // Collect all quality reports
        const qualityReports: ConnectionQuality[] = [];

        for (const [, peer] of this.peers) {
            if (peer.quality) {
                qualityReports.push(peer.quality);
            }
        }

        // Add our own
        if (this.localQuality) {
            qualityReports.push(this.localQuality);
        }

        // Elect anchors (top 10 by score)
        this.anchorIds = electAnchors(qualityReports, this.config.numSquads);
        this.primaryId = this.anchorIds[0]; // Best connection is primary

        console.log(`[MeshManager] Elected anchors:`, this.anchorIds);
        console.log(`[MeshManager] Primary anchor: ${this.primaryId}`);

        // Broadcast election results
        await this.signaling.send({
            type: 'anchor-result',
            from: this.localId,
            to: '*',
            matchId: this.matchId,
            payload: {
                anchors: this.anchorIds,
                primary: this.primaryId,
            },
            timestamp: Date.now(),
        });

        // Assign our own role
        this.assignRole();
    }

    /**
     * Send game state to all connected peers
     */
    broadcastGameState(state: any): void {
        const message: SyncMessage = {
            type: 'state',
            source: this.localId,
            sequence: Date.now(),
            timestamp: Date.now(),
            payload: state,
        };

        for (const [, conn] of this.connections) {
            if (conn.getState() === 'connected') {
                conn.sendGameMessage(message);
            }
        }
    }

    /**
     * Send game event (reliable delivery)
     */
    broadcastGameEvent(event: any): void {
        const message: SyncMessage = {
            type: 'event',
            source: this.localId,
            sequence: Date.now(),
            timestamp: Date.now(),
            payload: event,
        };

        for (const [, conn] of this.connections) {
            conn.sendReliableMessage(message);
        }
    }

    /**
     * Send to specific peer
     */
    sendToPeer(peerId: string, message: SyncMessage): boolean {
        const conn = this.connections.get(peerId);
        if (!conn || conn.getState() !== 'connected') {
            return false;
        }
        return conn.sendReliableMessage(message);
    }

    /**
     * Get current role
     */
    getRole(): MeshRole {
        return this.role;
    }

    /**
     * Check if we are the primary anchor
     */
    getIsPrimary(): boolean {
        return this.isPrimary;
    }

    /**
     * Get list of connected peers
     */
    getConnectedPeers(): MeshPeer[] {
        return Array.from(this.peers.values()).filter(
            p => this.connections.get(p.id)?.getState() === 'connected'
        );
    }

    // ========================================================================
    // Private: Signaling Message Handlers
    // ========================================================================

    private handleSignalingMessage(msg: SignalingMessage): void {
        // Ignore our own messages
        if (msg.from === this.localId) return;

        // Check if message is for us
        if (msg.to !== '*' && msg.to !== this.localId) return;

        switch (msg.type) {
            case 'quality-report':
                this.handleQualityReport(msg.from, msg.payload);
                break;
            case 'anchor-result':
                this.handleAnchorResult(msg.payload);
                break;
            case 'offer':
                this.handleOffer(msg.from, msg.payload);
                break;
            case 'answer':
                this.handleAnswer(msg.from, msg.payload);
                break;
            case 'ice-candidate':
                this.handleIceCandidate(msg.from, msg.payload);
                break;
            case 'heartbeat':
                this.handleHeartbeat(msg.from);
                break;
        }
    }

    private handleQualityReport(from: string, quality: ConnectionQuality): void {
        // Create or update peer
        let peer = this.peers.get(from);
        if (!peer) {
            peer = {
                id: from,
                name: from, // Will be updated with real name
                squadId: -1,
                role: 'player',
                state: 'disconnected',
                quality: null,
                connection: null,
                dataChannel: null,
                lastHeartbeat: Date.now(),
            };
            this.peers.set(from, peer);
            this.events.onPeerJoined(peer);
        }

        peer.quality = quality;
        console.log(`[MeshManager] Peer ${from} quality: ${quality.score}`);
    }

    private handleAnchorResult(payload: { anchors: string[]; primary: string }): void {
        this.anchorIds = payload.anchors;
        this.primaryId = payload.primary;

        console.log(`[MeshManager] Received anchor election results`);

        // Assign our role
        this.assignRole();

        // Establish connections based on role
        this.establishMeshConnections();
    }

    private async handleOffer(from: string, offer: RTCSessionDescriptionInit): Promise<void> {
        console.log(`[MeshManager] Received offer from ${from}`);

        const conn = this.getOrCreateConnection(from);
        const answer = await conn.handleOffer(offer);

        await this.signaling.send({
            type: 'answer',
            from: this.localId,
            to: from,
            matchId: this.matchId,
            payload: answer,
            timestamp: Date.now(),
        });
    }

    private async handleAnswer(from: string, answer: RTCSessionDescriptionInit): Promise<void> {
        console.log(`[MeshManager] Received answer from ${from}`);

        const conn = this.connections.get(from);
        if (conn) {
            await conn.handleAnswer(answer);
        }
    }

    private async handleIceCandidate(from: string, candidate: RTCIceCandidateInit): Promise<void> {
        const conn = this.connections.get(from);
        if (conn) {
            await conn.addIceCandidate(candidate);
        }
    }

    private handleHeartbeat(from: string): void {
        const peer = this.peers.get(from);
        if (peer) {
            peer.lastHeartbeat = Date.now();
        }
    }

    // ========================================================================
    // Private: Connection Management
    // ========================================================================

    private assignRole(): void {
        if (this.anchorIds.includes(this.localId)) {
            this.role = 'anchor';
            this.isPrimary = this.primaryId === this.localId;

            // Find our squad (our position in anchor list)
            this.squadId = this.anchorIds.indexOf(this.localId);
        } else {
            this.role = 'player';
            this.isPrimary = false;

            // Assign to a squad (will be determined by matchmaking)
            // For now, distribute evenly
        }

        console.log(`[MeshManager] Assigned role: ${this.role}, isPrimary: ${this.isPrimary}, squad: ${this.squadId}`);
        this.events.onRoleAssigned(this.role, this.isPrimary);
    }

    private async establishMeshConnections(): Promise<void> {
        if (this.role === 'anchor') {
            // Anchors connect to each other (mesh backbone)
            for (const anchorId of this.anchorIds) {
                if (anchorId === this.localId) continue;
                if (anchorId > this.localId) {
                    // Only initiate if our ID is "smaller" (prevents duplicate connections)
                    await this.initiateConnection(anchorId);
                }
            }
        } else {
            // Regular players connect to their squad anchor
            // (Anchor assignment TBD by matchmaking)
        }

        // Notify that mesh is ready
        this.events.onMatchReady(this.anchorIds, this.primaryId);
    }

    private async initiateConnection(peerId: string): Promise<void> {
        console.log(`[MeshManager] Initiating connection to ${peerId}`);

        const conn = this.getOrCreateConnection(peerId);
        const offer = await conn.createOffer();

        await this.signaling.send({
            type: 'offer',
            from: this.localId,
            to: peerId,
            matchId: this.matchId,
            payload: offer,
            timestamp: Date.now(),
        });
    }

    private getOrCreateConnection(peerId: string): PeerConnection {
        let conn = this.connections.get(peerId);
        if (!conn) {
            const callbacks: PeerCallbacks = {
                onStateChange: (id, state) => this.onPeerStateChange(id, state),
                onMessage: (id, msg) => this.events.onGameMessage(id, msg),
                onIceCandidate: (id, candidate) => this.sendIceCandidate(id, candidate),
                onError: (id, error) => this.events.onConnectionFailed(id, error),
            };

            conn = createPeerConnection(this.localId, peerId, callbacks);
            this.connections.set(peerId, conn);
        }
        return conn;
    }

    private onPeerStateChange(peerId: string, state: PeerState): void {
        const peer = this.peers.get(peerId);
        if (peer) {
            peer.state = state;
        }

        if (state === 'disconnected' || state === 'failed') {
            this.events.onPeerLeft(peerId);
        }
    }

    private async sendIceCandidate(peerId: string, candidate: RTCIceCandidate): Promise<void> {
        await this.signaling.send({
            type: 'ice-candidate',
            from: this.localId,
            to: peerId,
            matchId: this.matchId,
            payload: candidate.toJSON(),
            timestamp: Date.now(),
        });
    }
}
