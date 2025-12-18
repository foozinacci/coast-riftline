// WebRTC Voice Chat for RIFTLINE
// Enables voice communication between squad members

// ============================================================================
// TYPES
// ============================================================================

interface VoicePeer {
    playerId: string;
    connection: RTCPeerConnection | null;
    stream: MediaStream | null;
    audioElement: HTMLAudioElement | null;
    isMuted: boolean;
    isSpeaking: boolean;
    volume: number;
}

interface VoiceChannelState {
    channelId: string;
    connected: boolean;
    localMuted: boolean;
    deafened: boolean;
    peers: Map<string, VoicePeer>;
}

type VoiceEventType = 'join' | 'leave' | 'mute' | 'unmute' | 'speaking' | 'stopped_speaking';

interface VoiceEvent {
    type: VoiceEventType;
    playerId: string;
    playerName?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const ICE_SERVERS: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
];

const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    sampleRate: 48000,
};

// Voice activity detection threshold
const VAD_THRESHOLD = 0.01;
const VAD_SMOOTHING = 0.95;

// ============================================================================
// VOICE CHAT MANAGER
// ============================================================================

export class VoiceChatManager {
    private static instance: VoiceChatManager | null = null;

    private state: VoiceChannelState = {
        channelId: '',
        connected: false,
        localMuted: false,
        deafened: false,
        peers: new Map(),
    };

    private localStream: MediaStream | null = null;
    private localPlayerId: string = '';

    private audioContext: AudioContext | null = null;
    private analyser: AnalyserNode | null = null;
    private vadLevel: number = 0;
    private isSpeaking: boolean = false;

    private eventHandlers: ((event: VoiceEvent) => void)[] = [];
    private signalingCallback: ((type: string, targetId: string, data: unknown) => void) | null = null;

    private constructor() { }

    static getInstance(): VoiceChatManager {
        if (!VoiceChatManager.instance) {
            VoiceChatManager.instance = new VoiceChatManager();
        }
        return VoiceChatManager.instance;
    }

    // ============================================================================
    // INITIALIZATION
    // ============================================================================

    /**
     * Initialize voice chat with local player ID
     */
    async initialize(playerId: string): Promise<boolean> {
        this.localPlayerId = playerId;

        try {
            // Request microphone access
            this.localStream = await navigator.mediaDevices.getUserMedia({
                audio: AUDIO_CONSTRAINTS,
                video: false,
            });

            // Set up voice activity detection
            this.setupVAD();

            console.log('[Voice] Initialized successfully');
            return true;
        } catch (error) {
            console.error('[Voice] Failed to access microphone:', error);
            return false;
        }
    }

    /**
     * Set signaling callback for WebRTC negotiation
     */
    setSignalingCallback(callback: (type: string, targetId: string, data: unknown) => void): void {
        this.signalingCallback = callback;
    }

    /**
     * Set up voice activity detection
     */
    private setupVAD(): void {
        if (!this.localStream) return;

        this.audioContext = new AudioContext();
        const source = this.audioContext.createMediaStreamSource(this.localStream);
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 256;

        source.connect(this.analyser);

        // Start VAD loop
        this.updateVAD();
    }

    /**
     * Update voice activity detection
     */
    private updateVAD(): void {
        if (!this.analyser || !this.audioContext) return;

        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteFrequencyData(dataArray);

        // Calculate average volume
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length / 255;

        // Smooth the value
        this.vadLevel = this.vadLevel * VAD_SMOOTHING + average * (1 - VAD_SMOOTHING);

        // Check if speaking
        const wasSpeaking = this.isSpeaking;
        this.isSpeaking = this.vadLevel > VAD_THRESHOLD && !this.state.localMuted;

        if (this.isSpeaking !== wasSpeaking) {
            this.emitEvent({
                type: this.isSpeaking ? 'speaking' : 'stopped_speaking',
                playerId: this.localPlayerId,
            });
        }

        // Continue loop
        requestAnimationFrame(() => this.updateVAD());
    }

    // ============================================================================
    // CHANNEL MANAGEMENT
    // ============================================================================

    /**
     * Join a voice channel (e.g., squad channel)
     */
    async joinChannel(channelId: string): Promise<boolean> {
        if (this.state.connected) {
            await this.leaveChannel();
        }

        this.state.channelId = channelId;
        this.state.connected = true;

        console.log(`[Voice] Joined channel: ${channelId}`);
        return true;
    }

    /**
     * Leave the current voice channel
     */
    async leaveChannel(): Promise<void> {
        // Close all peer connections
        for (const [peerId, peer] of this.state.peers) {
            this.disconnectPeer(peerId);
        }

        this.state.channelId = '';
        this.state.connected = false;
        this.state.peers.clear();

        console.log('[Voice] Left channel');
    }

    /**
     * Add a peer to the channel
     */
    async addPeer(peerId: string, isInitiator: boolean = false): Promise<void> {
        if (this.state.peers.has(peerId)) {
            console.log(`[Voice] Peer ${peerId} already exists`);
            return;
        }

        const peer: VoicePeer = {
            playerId: peerId,
            connection: null,
            stream: null,
            audioElement: null,
            isMuted: false,
            isSpeaking: false,
            volume: 1.0,
        };

        this.state.peers.set(peerId, peer);

        // Create WebRTC connection
        const connection = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        peer.connection = connection;

        // Add local stream tracks
        if (this.localStream) {
            for (const track of this.localStream.getTracks()) {
                connection.addTrack(track, this.localStream);
            }
        }

        // Handle incoming audio
        connection.ontrack = (event) => {
            console.log(`[Voice] Received audio from ${peerId}`);
            peer.stream = event.streams[0];

            // Create audio element for playback
            const audio = new Audio();
            audio.srcObject = peer.stream;
            audio.autoplay = true;
            audio.volume = peer.volume;
            peer.audioElement = audio;
        };

        // Handle ICE candidates
        connection.onicecandidate = (event) => {
            if (event.candidate && this.signalingCallback) {
                this.signalingCallback('ice-candidate', peerId, event.candidate);
            }
        };

        // Handle connection state changes
        connection.onconnectionstatechange = () => {
            console.log(`[Voice] Connection to ${peerId}: ${connection.connectionState}`);

            if (connection.connectionState === 'disconnected' ||
                connection.connectionState === 'failed') {
                this.disconnectPeer(peerId);
            }
        };

        // If we're the initiator, create an offer
        if (isInitiator) {
            try {
                const offer = await connection.createOffer();
                await connection.setLocalDescription(offer);

                if (this.signalingCallback) {
                    this.signalingCallback('offer', peerId, offer);
                }
            } catch (error) {
                console.error(`[Voice] Failed to create offer for ${peerId}:`, error);
            }
        }

        this.emitEvent({ type: 'join', playerId: peerId });
        console.log(`[Voice] Added peer: ${peerId}`);
    }

    /**
     * Remove a peer from the channel
     */
    disconnectPeer(peerId: string): void {
        const peer = this.state.peers.get(peerId);
        if (!peer) return;

        // Clean up
        if (peer.connection) {
            peer.connection.close();
        }
        if (peer.audioElement) {
            peer.audioElement.srcObject = null;
        }

        this.state.peers.delete(peerId);
        this.emitEvent({ type: 'leave', playerId: peerId });
        console.log(`[Voice] Removed peer: ${peerId}`);
    }

    // ============================================================================
    // SIGNALING HANDLERS
    // ============================================================================

    /**
     * Handle an incoming offer
     */
    async handleOffer(fromId: string, offer: RTCSessionDescriptionInit): Promise<void> {
        // Ensure peer exists
        if (!this.state.peers.has(fromId)) {
            await this.addPeer(fromId, false);
        }

        const peer = this.state.peers.get(fromId);
        if (!peer?.connection) return;

        try {
            await peer.connection.setRemoteDescription(new RTCSessionDescription(offer));

            const answer = await peer.connection.createAnswer();
            await peer.connection.setLocalDescription(answer);

            if (this.signalingCallback) {
                this.signalingCallback('answer', fromId, answer);
            }
        } catch (error) {
            console.error(`[Voice] Failed to handle offer from ${fromId}:`, error);
        }
    }

    /**
     * Handle an incoming answer
     */
    async handleAnswer(fromId: string, answer: RTCSessionDescriptionInit): Promise<void> {
        const peer = this.state.peers.get(fromId);
        if (!peer?.connection) return;

        try {
            await peer.connection.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (error) {
            console.error(`[Voice] Failed to handle answer from ${fromId}:`, error);
        }
    }

    /**
     * Handle an incoming ICE candidate
     */
    async handleIceCandidate(fromId: string, candidate: RTCIceCandidateInit): Promise<void> {
        const peer = this.state.peers.get(fromId);
        if (!peer?.connection) return;

        try {
            await peer.connection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
            console.error(`[Voice] Failed to add ICE candidate from ${fromId}:`, error);
        }
    }

    // ============================================================================
    // AUDIO CONTROLS
    // ============================================================================

    /**
     * Mute local microphone
     */
    mute(): void {
        this.state.localMuted = true;
        if (this.localStream) {
            for (const track of this.localStream.getAudioTracks()) {
                track.enabled = false;
            }
        }
        this.emitEvent({ type: 'mute', playerId: this.localPlayerId });
    }

    /**
     * Unmute local microphone
     */
    unmute(): void {
        this.state.localMuted = false;
        if (this.localStream) {
            for (const track of this.localStream.getAudioTracks()) {
                track.enabled = true;
            }
        }
        this.emitEvent({ type: 'unmute', playerId: this.localPlayerId });
    }

    /**
     * Toggle mute state
     */
    toggleMute(): boolean {
        if (this.state.localMuted) {
            this.unmute();
        } else {
            this.mute();
        }
        return this.state.localMuted;
    }

    /**
     * Deafen (mute all incoming audio)
     */
    deafen(): void {
        this.state.deafened = true;
        for (const peer of this.state.peers.values()) {
            if (peer.audioElement) {
                peer.audioElement.muted = true;
            }
        }
    }

    /**
     * Undeafen
     */
    undeafen(): void {
        this.state.deafened = false;
        for (const peer of this.state.peers.values()) {
            if (peer.audioElement) {
                peer.audioElement.muted = false;
            }
        }
    }

    /**
     * Set volume for a specific peer
     */
    setPeerVolume(peerId: string, volume: number): void {
        const peer = this.state.peers.get(peerId);
        if (peer) {
            peer.volume = Math.max(0, Math.min(1, volume));
            if (peer.audioElement) {
                peer.audioElement.volume = peer.volume;
            }
        }
    }

    /**
     * Mute a specific peer
     */
    mutePeer(peerId: string): void {
        const peer = this.state.peers.get(peerId);
        if (peer) {
            peer.isMuted = true;
            if (peer.audioElement) {
                peer.audioElement.muted = true;
            }
        }
    }

    /**
     * Unmute a specific peer
     */
    unmutePeer(peerId: string): void {
        const peer = this.state.peers.get(peerId);
        if (peer) {
            peer.isMuted = false;
            if (peer.audioElement) {
                peer.audioElement.muted = false;
            }
        }
    }

    // ============================================================================
    // STATE GETTERS
    // ============================================================================

    isConnected(): boolean {
        return this.state.connected;
    }

    isMuted(): boolean {
        return this.state.localMuted;
    }

    isDeafened(): boolean {
        return this.state.deafened;
    }

    isSpeakingLocal(): boolean {
        return this.isSpeaking;
    }

    getChannelId(): string {
        return this.state.channelId;
    }

    getPeers(): VoicePeer[] {
        return Array.from(this.state.peers.values());
    }

    getVADLevel(): number {
        return this.vadLevel;
    }

    // ============================================================================
    // EVENTS
    // ============================================================================

    /**
     * Subscribe to voice events
     */
    onEvent(handler: (event: VoiceEvent) => void): void {
        this.eventHandlers.push(handler);
    }

    /**
     * Emit a voice event
     */
    private emitEvent(event: VoiceEvent): void {
        for (const handler of this.eventHandlers) {
            try {
                handler(event);
            } catch (error) {
                console.error('[Voice] Event handler error:', error);
            }
        }
    }

    // ============================================================================
    // CLEANUP
    // ============================================================================

    /**
     * Clean up and release resources
     */
    async destroy(): Promise<void> {
        await this.leaveChannel();

        if (this.localStream) {
            for (const track of this.localStream.getTracks()) {
                track.stop();
            }
            this.localStream = null;
        }

        if (this.audioContext) {
            await this.audioContext.close();
            this.audioContext = null;
        }

        this.analyser = null;
        this.eventHandlers = [];

        console.log('[Voice] Destroyed');
    }
}

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

/**
 * Get the voice chat manager instance
 */
export function getVoiceChat(): VoiceChatManager {
    return VoiceChatManager.getInstance();
}

/**
 * Initialize voice chat for a player
 */
export async function initVoiceChat(playerId: string): Promise<boolean> {
    return VoiceChatManager.getInstance().initialize(playerId);
}

/**
 * Join a squad voice channel
 */
export async function joinSquadVoice(squadId: string): Promise<boolean> {
    return VoiceChatManager.getInstance().joinChannel(`squad_${squadId}`);
}

/**
 * Leave voice chat
 */
export async function leaveVoice(): Promise<void> {
    return VoiceChatManager.getInstance().leaveChannel();
}
