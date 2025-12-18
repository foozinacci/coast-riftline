// WebSocket Client for RIFTLINE Multiplayer
// Handles real-time communication with game server

import {
    NetworkMessage,
    MessageType,
    PlayerInputMessage,
    GameStateMessage,
    DamageEventMessage,
    KillEventMessage,
    PingMessage,
    PongMessage,
    serializeMessage,
    deserializeMessage,
    MAX_PING_SAMPLES,
} from './protocol';

// ============================================================================
// TYPES
// ============================================================================

export interface WebSocketClientConfig {
    url: string;
    reconnectAttempts?: number;
    reconnectDelay?: number;
    heartbeatInterval?: number;
}

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export interface NetworkStats {
    ping: number;
    packetLoss: number;
    bytesReceived: number;
    bytesSent: number;
    messagesPerSecond: number;
}

type MessageHandler = (message: NetworkMessage) => void;

// ============================================================================
// WEBSOCKET CLIENT CLASS
// ============================================================================

export class WebSocketClient {
    private static instance: WebSocketClient | null = null;

    private ws: WebSocket | null = null;
    private config: Required<WebSocketClientConfig>;
    private state: ConnectionState = 'disconnected';
    private reconnectCount: number = 0;
    private reconnectTimer: number | null = null;
    private heartbeatTimer: number | null = null;

    // Message handling
    private messageHandlers: Map<MessageType, Set<MessageHandler>> = new Map();
    private globalHandlers: Set<MessageHandler> = new Set();
    private pendingMessages: NetworkMessage[] = [];
    private sequenceNumber: number = 0;

    // Network stats
    private pingSamples: number[] = [];
    private lastPingTime: number = 0;
    private bytesReceived: number = 0;
    private bytesSent: number = 0;
    private messageCount: number = 0;
    private messageCountStart: number = Date.now();

    // Connection info
    private playerId: string | null = null;
    private sessionId: string | null = null;

    private constructor(config: WebSocketClientConfig) {
        this.config = {
            url: config.url,
            reconnectAttempts: config.reconnectAttempts ?? 5,
            reconnectDelay: config.reconnectDelay ?? 2000,
            heartbeatInterval: config.heartbeatInterval ?? 5000,
        };
    }

    /**
     * Get singleton instance
     */
    static getInstance(config?: WebSocketClientConfig): WebSocketClient {
        if (!WebSocketClient.instance) {
            if (!config) {
                throw new Error('WebSocketClient requires config on first initialization');
            }
            WebSocketClient.instance = new WebSocketClient(config);
        }
        return WebSocketClient.instance;
    }

    /**
     * Create a new instance (for testing/multiple connections)
     */
    static create(config: WebSocketClientConfig): WebSocketClient {
        return new WebSocketClient(config);
    }

    // ============================================================================
    // CONNECTION MANAGEMENT
    // ============================================================================

    /**
     * Connect to the server
     */
    async connect(playerId: string, sessionId?: string): Promise<boolean> {
        if (this.state === 'connected' || this.state === 'connecting') {
            console.warn('[WebSocket] Already connected or connecting');
            return this.state === 'connected';
        }

        this.playerId = playerId;
        this.sessionId = sessionId || null;
        this.state = 'connecting';
        this.reconnectCount = 0;

        return this.doConnect();
    }

    private doConnect(): Promise<boolean> {
        return new Promise((resolve) => {
            try {
                // Build URL with query params
                let url = this.config.url;
                const params = new URLSearchParams();
                if (this.playerId) params.set('playerId', this.playerId);
                if (this.sessionId) params.set('sessionId', this.sessionId);
                if (params.toString()) {
                    url += (url.includes('?') ? '&' : '?') + params.toString();
                }

                console.log(`[WebSocket] Connecting to ${url}`);
                this.ws = new WebSocket(url);

                this.ws.onopen = () => {
                    console.log('[WebSocket] Connected');
                    this.state = 'connected';
                    this.reconnectCount = 0;
                    this.startHeartbeat();
                    this.flushPendingMessages();
                    resolve(true);
                };

                this.ws.onclose = (event) => {
                    console.log(`[WebSocket] Closed: ${event.code} ${event.reason}`);
                    this.handleDisconnect();
                    if (this.state === 'connecting') {
                        resolve(false);
                    }
                };

                this.ws.onerror = (error) => {
                    console.error('[WebSocket] Error:', error);
                    if (this.state === 'connecting') {
                        resolve(false);
                    }
                };

                this.ws.onmessage = (event) => {
                    this.handleMessage(event.data);
                };

                // Timeout for connection
                setTimeout(() => {
                    if (this.state === 'connecting') {
                        console.warn('[WebSocket] Connection timeout');
                        this.ws?.close();
                        resolve(false);
                    }
                }, 10000);

            } catch (error) {
                console.error('[WebSocket] Connection error:', error);
                this.state = 'disconnected';
                resolve(false);
            }
        });
    }

    /**
     * Disconnect from the server
     */
    disconnect(): void {
        console.log('[WebSocket] Disconnecting');
        this.stopHeartbeat();
        this.stopReconnect();

        if (this.ws) {
            this.ws.close(1000, 'Client disconnect');
            this.ws = null;
        }

        this.state = 'disconnected';
        this.playerId = null;
        this.sessionId = null;
    }

    /**
     * Handle disconnection
     */
    private handleDisconnect(): void {
        this.stopHeartbeat();

        if (this.state === 'disconnected') return;

        if (this.reconnectCount < this.config.reconnectAttempts) {
            this.state = 'reconnecting';
            this.scheduleReconnect();
        } else {
            this.state = 'disconnected';
            console.log('[WebSocket] Max reconnect attempts reached');
        }
    }

    private scheduleReconnect(): void {
        if (this.reconnectTimer) return;

        const delay = this.config.reconnectDelay * Math.pow(1.5, this.reconnectCount);
        console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectCount + 1})`);

        this.reconnectTimer = window.setTimeout(async () => {
            this.reconnectTimer = null;
            this.reconnectCount++;

            const success = await this.doConnect();
            if (!success && this.reconnectCount < this.config.reconnectAttempts) {
                this.scheduleReconnect();
            }
        }, delay);
    }

    private stopReconnect(): void {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }

    // ============================================================================
    // MESSAGE HANDLING
    // ============================================================================

    /**
     * Send a message to the server
     */
    send(message: Omit<NetworkMessage, 'timestamp' | 'sequence'>): boolean {
        const fullMessage: NetworkMessage = {
            ...message,
            timestamp: Date.now(),
            sequence: this.sequenceNumber++,
            senderId: this.playerId || undefined,
        };

        if (this.state !== 'connected' || !this.ws) {
            // Queue for later
            this.pendingMessages.push(fullMessage);
            return false;
        }

        try {
            const data = serializeMessage(fullMessage);
            this.ws.send(data);
            this.bytesSent += data.length;
            return true;
        } catch (error) {
            console.error('[WebSocket] Send error:', error);
            return false;
        }
    }

    /**
     * Send player input
     */
    sendInput(input: PlayerInputMessage['input'], clientTick: number): void {
        this.send({
            type: MessageType.PLAYER_INPUT,
            input,
            clientTick,
        } as Omit<PlayerInputMessage, 'timestamp' | 'sequence'>);
    }

    private handleMessage(data: string): void {
        this.bytesReceived += data.length;
        this.messageCount++;

        const message = deserializeMessage(data);
        if (!message) {
            console.warn('[WebSocket] Failed to parse message');
            return;
        }

        // Handle ping/pong specially
        if (message.type === MessageType.PONG) {
            this.handlePong(message as PongMessage);
            return;
        }

        // Dispatch to type-specific handlers
        const handlers = this.messageHandlers.get(message.type);
        if (handlers) {
            for (const handler of handlers) {
                try {
                    handler(message);
                } catch (error) {
                    console.error(`[WebSocket] Handler error for ${message.type}:`, error);
                }
            }
        }

        // Dispatch to global handlers
        for (const handler of this.globalHandlers) {
            try {
                handler(message);
            } catch (error) {
                console.error('[WebSocket] Global handler error:', error);
            }
        }
    }

    private flushPendingMessages(): void {
        while (this.pendingMessages.length > 0) {
            const message = this.pendingMessages.shift()!;
            if (this.ws && this.state === 'connected') {
                const data = serializeMessage(message);
                this.ws.send(data);
                this.bytesSent += data.length;
            }
        }
    }

    // ============================================================================
    // HEARTBEAT / PING
    // ============================================================================

    private startHeartbeat(): void {
        this.stopHeartbeat();

        this.heartbeatTimer = window.setInterval(() => {
            this.sendPing();
        }, this.config.heartbeatInterval);

        // Send initial ping
        this.sendPing();
    }

    private stopHeartbeat(): void {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    private sendPing(): void {
        this.lastPingTime = Date.now();
        this.send({
            type: MessageType.PING,
            clientTime: this.lastPingTime,
        } as Omit<PingMessage, 'timestamp' | 'sequence'>);
    }

    private handlePong(message: PongMessage): void {
        const rtt = Date.now() - message.clientTime;

        this.pingSamples.push(rtt);
        if (this.pingSamples.length > MAX_PING_SAMPLES) {
            this.pingSamples.shift();
        }
    }

    // ============================================================================
    // EVENT HANDLERS
    // ============================================================================

    /**
     * Register a handler for a specific message type
     */
    on(type: MessageType, handler: MessageHandler): void {
        if (!this.messageHandlers.has(type)) {
            this.messageHandlers.set(type, new Set());
        }
        this.messageHandlers.get(type)!.add(handler);
    }

    /**
     * Remove a handler for a specific message type
     */
    off(type: MessageType, handler: MessageHandler): void {
        this.messageHandlers.get(type)?.delete(handler);
    }

    /**
     * Register a global handler for all messages
     */
    onAny(handler: MessageHandler): void {
        this.globalHandlers.add(handler);
    }

    /**
     * Remove a global handler
     */
    offAny(handler: MessageHandler): void {
        this.globalHandlers.delete(handler);
    }

    // ============================================================================
    // GETTERS
    // ============================================================================

    getState(): ConnectionState {
        return this.state;
    }

    isConnected(): boolean {
        return this.state === 'connected';
    }

    getPlayerId(): string | null {
        return this.playerId;
    }

    getSessionId(): string | null {
        return this.sessionId;
    }

    getStats(): NetworkStats {
        // Calculate average ping
        const ping = this.pingSamples.length > 0
            ? Math.round(this.pingSamples.reduce((a, b) => a + b, 0) / this.pingSamples.length)
            : 0;

        // Calculate messages per second
        const elapsed = (Date.now() - this.messageCountStart) / 1000;
        const messagesPerSecond = elapsed > 0 ? this.messageCount / elapsed : 0;

        // Estimate packet loss (simplified - based on missed pings)
        const expectedPings = elapsed / (this.config.heartbeatInterval / 1000);
        const packetLoss = expectedPings > 0
            ? Math.max(0, 1 - (this.pingSamples.length / expectedPings))
            : 0;

        return {
            ping,
            packetLoss,
            bytesReceived: this.bytesReceived,
            bytesSent: this.bytesSent,
            messagesPerSecond,
        };
    }

    getPing(): number {
        if (this.pingSamples.length === 0) return 0;
        return Math.round(
            this.pingSamples.reduce((a, b) => a + b, 0) / this.pingSamples.length
        );
    }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

let defaultClient: WebSocketClient | null = null;

/**
 * Initialize the default WebSocket client
 */
export function initWebSocket(config: WebSocketClientConfig): WebSocketClient {
    defaultClient = WebSocketClient.create(config);
    return defaultClient;
}

/**
 * Get the default WebSocket client
 */
export function getWebSocket(): WebSocketClient | null {
    return defaultClient;
}

/**
 * Connect to a game server
 */
export async function connectToGameServer(
    serverUrl: string,
    playerId: string,
    sessionId?: string
): Promise<boolean> {
    const client = initWebSocket({ url: serverUrl });
    return client.connect(playerId, sessionId);
}
