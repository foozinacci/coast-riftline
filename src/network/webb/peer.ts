// Webb Protocol - WebRTC Peer Connection Manager
// Handles peer-to-peer connections for the mesh network

import { MeshPeer, PeerState, SignalingMessage, SyncMessage } from './types';

/**
 * STUN servers for NAT traversal (free)
 */
const ICE_SERVERS: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
];

/**
 * Configuration for RTCPeerConnection
 */
const RTC_CONFIG: RTCConfiguration = {
    iceServers: ICE_SERVERS,
    iceCandidatePoolSize: 10,
};

/**
 * Data channel configuration
 */
const DATA_CHANNEL_CONFIG: RTCDataChannelInit = {
    ordered: false,          // UDP-like for game data (faster)
    maxRetransmits: 0,       // Don't retry failed packets
};

/**
 * Reliable data channel for important messages
 */
const RELIABLE_CHANNEL_CONFIG: RTCDataChannelInit = {
    ordered: true,           // TCP-like for critical data
};

/**
 * Event callbacks for peer connection
 */
export interface PeerCallbacks {
    onStateChange: (peerId: string, state: PeerState) => void;
    onMessage: (peerId: string, message: SyncMessage) => void;
    onIceCandidate: (peerId: string, candidate: RTCIceCandidate) => void;
    onError: (peerId: string, error: Error) => void;
}

/**
 * Manages a single WebRTC peer connection
 */
export class PeerConnection {
    readonly peerId: string;
    readonly localId: string;

    private connection: RTCPeerConnection | null = null;
    private gameChannel: RTCDataChannel | null = null;
    private reliableChannel: RTCDataChannel | null = null;
    private callbacks: PeerCallbacks;
    private state: PeerState = 'disconnected';
    private messageQueue: SyncMessage[] = [];

    constructor(localId: string, peerId: string, callbacks: PeerCallbacks) {
        this.localId = localId;
        this.peerId = peerId;
        this.callbacks = callbacks;
    }

    /**
     * Get current connection state
     */
    getState(): PeerState {
        return this.state;
    }

    /**
     * Create offer (initiator side)
     */
    async createOffer(): Promise<RTCSessionDescriptionInit> {
        this.connection = new RTCPeerConnection(RTC_CONFIG);
        this.setupConnectionHandlers();

        // Create data channels (initiator creates them)
        this.gameChannel = this.connection.createDataChannel('game', DATA_CHANNEL_CONFIG);
        this.reliableChannel = this.connection.createDataChannel('reliable', RELIABLE_CHANNEL_CONFIG);
        this.setupChannelHandlers(this.gameChannel);
        this.setupChannelHandlers(this.reliableChannel);

        this.setState('connecting');

        const offer = await this.connection.createOffer();
        await this.connection.setLocalDescription(offer);

        return offer;
    }

    /**
     * Handle received offer (responder side)
     */
    async handleOffer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
        this.connection = new RTCPeerConnection(RTC_CONFIG);
        this.setupConnectionHandlers();

        // Set up handler for incoming data channels
        this.connection.ondatachannel = (event) => {
            const channel = event.channel;
            if (channel.label === 'game') {
                this.gameChannel = channel;
            } else if (channel.label === 'reliable') {
                this.reliableChannel = channel;
            }
            this.setupChannelHandlers(channel);
        };

        this.setState('connecting');

        await this.connection.setRemoteDescription(offer);
        const answer = await this.connection.createAnswer();
        await this.connection.setLocalDescription(answer);

        return answer;
    }

    /**
     * Handle received answer
     */
    async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
        if (!this.connection) {
            throw new Error('No connection to handle answer');
        }
        await this.connection.setRemoteDescription(answer);
    }

    /**
     * Add ICE candidate from remote peer
     */
    async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
        if (!this.connection) {
            throw new Error('No connection to add ICE candidate');
        }
        await this.connection.addIceCandidate(candidate);
    }

    /**
     * Send game state message (unreliable, fast)
     */
    sendGameMessage(message: SyncMessage): boolean {
        if (!this.gameChannel || this.gameChannel.readyState !== 'open') {
            return false;
        }

        try {
            this.gameChannel.send(JSON.stringify(message));
            return true;
        } catch (error) {
            console.warn(`[Peer:${this.peerId}] Failed to send game message:`, error);
            return false;
        }
    }

    /**
     * Send reliable message (for critical events)
     */
    sendReliableMessage(message: SyncMessage): boolean {
        if (!this.reliableChannel || this.reliableChannel.readyState !== 'open') {
            // Queue for later
            this.messageQueue.push(message);
            return false;
        }

        try {
            this.reliableChannel.send(JSON.stringify(message));
            return true;
        } catch (error) {
            console.warn(`[Peer:${this.peerId}] Failed to send reliable message:`, error);
            this.messageQueue.push(message);
            return false;
        }
    }

    /**
     * Close the connection
     */
    close(): void {
        if (this.gameChannel) {
            this.gameChannel.close();
            this.gameChannel = null;
        }
        if (this.reliableChannel) {
            this.reliableChannel.close();
            this.reliableChannel = null;
        }
        if (this.connection) {
            this.connection.close();
            this.connection = null;
        }
        this.setState('disconnected');
    }

    /**
     * Set up connection event handlers
     */
    private setupConnectionHandlers(): void {
        if (!this.connection) return;

        this.connection.onicecandidate = (event) => {
            if (event.candidate) {
                this.callbacks.onIceCandidate(this.peerId, event.candidate);
            }
        };

        this.connection.onconnectionstatechange = () => {
            const state = this.connection?.connectionState;
            console.log(`[Peer:${this.peerId}] Connection state: ${state}`);

            switch (state) {
                case 'connected':
                    this.setState('connected');
                    this.flushMessageQueue();
                    break;
                case 'disconnected':
                case 'closed':
                    this.setState('disconnected');
                    break;
                case 'failed':
                    this.setState('failed');
                    break;
            }
        };

        this.connection.onicecandidateerror = (event) => {
            console.warn(`[Peer:${this.peerId}] ICE error:`, event);
        };
    }

    /**
     * Set up data channel event handlers
     */
    private setupChannelHandlers(channel: RTCDataChannel): void {
        channel.onopen = () => {
            console.log(`[Peer:${this.peerId}] Channel ${channel.label} opened`);
            if (channel.label === 'reliable') {
                this.flushMessageQueue();
            }
        };

        channel.onclose = () => {
            console.log(`[Peer:${this.peerId}] Channel ${channel.label} closed`);
        };

        channel.onerror = (event) => {
            console.error(`[Peer:${this.peerId}] Channel ${channel.label} error:`, event);
        };

        channel.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data) as SyncMessage;
                this.callbacks.onMessage(this.peerId, message);
            } catch (error) {
                console.warn(`[Peer:${this.peerId}] Failed to parse message:`, error);
            }
        };
    }

    /**
     * Update and broadcast state
     */
    private setState(state: PeerState): void {
        if (this.state !== state) {
            this.state = state;
            this.callbacks.onStateChange(this.peerId, state);
        }
    }

    /**
     * Send queued messages when connection opens
     */
    private flushMessageQueue(): void {
        while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift()!;
            this.sendReliableMessage(message);
        }
    }
}

/**
 * Factory to create peer connections
 */
export function createPeerConnection(
    localId: string,
    peerId: string,
    callbacks: PeerCallbacks
): PeerConnection {
    return new PeerConnection(localId, peerId, callbacks);
}
