// RIFTLINE Game Server
// Authoritative server for multiplayer matches
// Run with: npx ts-node server/GameServer.ts

import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { randomUUID } from 'crypto';
import { AntiCheatManager } from './AntiCheat';

// ============================================================================
// TYPES (Shared with client, would normally be in shared package)
// ============================================================================

interface Vector2 {
    x: number;
    y: number;
}

enum MessageType {
    CONNECT = 'connect',
    DISCONNECT = 'disconnect',
    PING = 'ping',
    PONG = 'pong',
    JOIN_LOBBY = 'join_lobby',
    LEAVE_LOBBY = 'leave_lobby',
    LOBBY_STATE = 'lobby_state',
    PLAYER_READY = 'player_ready',
    MATCH_START = 'match_start',
    MATCH_END = 'match_end',
    ROUND_START = 'round_start',
    ROUND_END = 'round_end',
    PLAYER_INPUT = 'player_input',
    PLAYER_ACTION = 'player_action',
    GAME_STATE = 'game_state',
    PLAYER_STATE = 'player_state',
    ENTITY_SPAWN = 'entity_spawn',
    ENTITY_DESTROY = 'entity_destroy',
    PROJECTILE_SPAWN = 'projectile_spawn',
    DAMAGE_EVENT = 'damage_event',
    KILL_EVENT = 'kill_event',
    RESPAWN_EVENT = 'respawn_event',
    CHAT_MESSAGE = 'chat_message',
    ERROR = 'error',
}

interface NetworkMessage {
    type: MessageType;
    timestamp: number;
    sequence: number;
    senderId?: string;
}

interface PlayerInput {
    moveDirection: Vector2;
    aimDirection: Vector2;
    isFiring: boolean;
    isReloading: boolean;
    dashPressed: boolean;
    tacticalPressed: boolean;
    interactPressed: boolean;
}

// ============================================================================
// SERVER PLAYER STATE
// ============================================================================

interface ServerPlayer {
    id: string;
    ws: WebSocket;
    name: string;
    squadId: string;
    position: Vector2;
    velocity: Vector2;
    rotation: number;
    health: number;
    maxHealth: number;
    shield: number;
    isAlive: boolean;
    lastInput: PlayerInput | null;
    lastInputTime: number;
    lastPing: number;
    ping: number;
}

interface ServerProjectile {
    id: string;
    ownerId: string;
    squadId: string;
    position: Vector2;
    velocity: Vector2;
    damage: number;
    speed: number;
    range: number;
    distanceTraveled: number;
    isActive: boolean;
}

interface ServerMatch {
    id: string;
    mode: string;
    players: Map<string, ServerPlayer>;
    projectiles: Map<string, ServerProjectile>;
    startTime: number;
    tick: number;
    phase: 'waiting' | 'countdown' | 'playing' | 'ended';
    roundNumber: number;
    scores: Map<string, number>;
}

// ============================================================================
// GAME SERVER CLASS
// ============================================================================

class GameServer {
    private wss: WebSocketServer;
    private httpServer: ReturnType<typeof createServer>;
    private players: Map<string, ServerPlayer> = new Map();
    private matches: Map<string, ServerMatch> = new Map();
    private lobbies: Map<string, Set<string>> = new Map();

    private tickRate: number = 60;
    private tickInterval: ReturnType<typeof setInterval> | null = null;
    private lastTickTime: number = Date.now();

    // Anti-cheat system
    private antiCheat: AntiCheatManager = new AntiCheatManager();

    constructor(port: number = 8080) {
        // Create HTTP server
        this.httpServer = createServer((req, res) => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: 'ok',
                players: this.players.size,
                matches: this.matches.size,
            }));
        });

        // Create WebSocket server
        this.wss = new WebSocketServer({ server: this.httpServer });

        this.wss.on('connection', (ws, req) => {
            this.handleConnection(ws, req);
        });

        // Start server
        this.httpServer.listen(port, () => {
            console.log(`[GameServer] Listening on port ${port}`);
        });

        // Start game loop
        this.startGameLoop();
    }

    // ============================================================================
    // CONNECTION HANDLING
    // ============================================================================

    private handleConnection(ws: WebSocket, req: any): void {
        const url = new URL(req.url || '', `http://${req.headers.host}`);
        const playerId = url.searchParams.get('playerId') || randomUUID();
        const sessionId = url.searchParams.get('sessionId');

        console.log(`[GameServer] Player connected: ${playerId}`);

        // Create player
        const player: ServerPlayer = {
            id: playerId,
            ws,
            name: `Player-${playerId.substring(0, 6)}`,
            squadId: '',
            position: { x: 0, y: 0 },
            velocity: { x: 0, y: 0 },
            rotation: 0,
            health: 100,
            maxHealth: 100,
            shield: 0,
            isAlive: false,
            lastInput: null,
            lastInputTime: Date.now(),
            lastPing: Date.now(),
            ping: 0,
        };

        this.players.set(playerId, player);

        // Set up message handler
        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data.toString()) as NetworkMessage;
                this.handleMessage(playerId, message);
            } catch (error) {
                console.error(`[GameServer] Message parse error:`, error);
            }
        });

        ws.on('close', () => {
            this.handleDisconnect(playerId);
        });

        ws.on('error', (error) => {
            console.error(`[GameServer] WebSocket error for ${playerId}:`, error);
        });

        // Send welcome message
        this.send(playerId, {
            type: MessageType.CONNECT,
            timestamp: Date.now(),
            sequence: 0,
            senderId: 'server',
            playerId,
        });
    }

    private handleDisconnect(playerId: string): void {
        console.log(`[GameServer] Player disconnected: ${playerId}`);

        const player = this.players.get(playerId);
        if (!player) return;

        // Remove from any lobby
        for (const [lobbyId, members] of this.lobbies) {
            if (members.has(playerId)) {
                members.delete(playerId);
                this.broadcastLobbyState(lobbyId);
            }
        }

        // Remove from any match
        for (const [matchId, match] of this.matches) {
            if (match.players.has(playerId)) {
                match.players.delete(playerId);
                // TODO: Handle player leaving mid-match
            }
        }

        // Unregister from anti-cheat
        this.antiCheat.unregisterPlayer(playerId);

        this.players.delete(playerId);
    }

    // ============================================================================
    // MESSAGE HANDLING
    // ============================================================================

    private handleMessage(playerId: string, message: NetworkMessage): void {
        const player = this.players.get(playerId);
        if (!player) return;

        switch (message.type) {
            case MessageType.PING:
                this.handlePing(playerId, message);
                break;
            case MessageType.PLAYER_INPUT:
                this.handlePlayerInput(playerId, message as any);
                break;
            case MessageType.JOIN_LOBBY:
                this.handleJoinLobby(playerId, message as any);
                break;
            case MessageType.LEAVE_LOBBY:
                this.handleLeaveLobby(playerId, message as any);
                break;
            case MessageType.PLAYER_READY:
                this.handlePlayerReady(playerId, message as any);
                break;
            case MessageType.CHAT_MESSAGE:
                this.handleChatMessage(playerId, message as any);
                break;
            default:
                console.log(`[GameServer] Unhandled message type: ${message.type}`);
        }
    }

    private handlePing(playerId: string, message: any): void {
        const player = this.players.get(playerId);
        if (!player) return;

        const now = Date.now();
        player.ping = now - player.lastPing;
        player.lastPing = now;

        this.send(playerId, {
            type: MessageType.PONG,
            timestamp: now,
            sequence: message.sequence,
            clientTime: message.clientTime,
            serverTime: now,
        });
    }

    private handlePlayerInput(playerId: string, message: any): void {
        const player = this.players.get(playerId);
        if (!player) return;

        // Validate input with anti-cheat
        const validation = this.antiCheat.validateInput(playerId, message.input);
        if (validation.action === 'kick') {
            console.log(`[GameServer] Kicking player ${playerId}: ${validation.message}`);
            player.ws.close(1008, validation.message || 'Kicked for cheating');
            return;
        } else if (validation.action === 'ban') {
            console.log(`[GameServer] Banning player ${playerId}: ${validation.message}`);
            player.ws.close(1008, validation.message || 'Banned for cheating');
            return;
        }

        player.lastInput = message.input;
        player.lastInputTime = Date.now();
    }

    private handleJoinLobby(playerId: string, message: any): void {
        const lobbyId = message.lobbyId || randomUUID();

        if (!this.lobbies.has(lobbyId)) {
            this.lobbies.set(lobbyId, new Set());
        }

        this.lobbies.get(lobbyId)!.add(playerId);
        console.log(`[GameServer] Player ${playerId} joined lobby ${lobbyId}`);

        this.broadcastLobbyState(lobbyId);
    }

    private handleLeaveLobby(playerId: string, message: any): void {
        const lobbyId = message.lobbyId;
        if (!lobbyId) return;

        const lobby = this.lobbies.get(lobbyId);
        if (lobby) {
            lobby.delete(playerId);
            if (lobby.size === 0) {
                this.lobbies.delete(lobbyId);
            } else {
                this.broadcastLobbyState(lobbyId);
            }
        }
    }

    private handlePlayerReady(playerId: string, message: any): void {
        // TODO: Track ready state and start match when all ready
        console.log(`[GameServer] Player ${playerId} ready`);
    }

    private handleChatMessage(playerId: string, message: any): void {
        const player = this.players.get(playerId);
        if (!player) return;

        // Broadcast to all players in same lobby/match
        const chatMessage = {
            type: MessageType.CHAT_MESSAGE,
            timestamp: Date.now(),
            sequence: 0,
            channel: message.channel || 'all',
            senderName: player.name,
            senderId: playerId,
            content: message.content,
        };

        // For now, broadcast to all
        this.broadcast(chatMessage);
    }

    // ============================================================================
    // GAME LOOP
    // ============================================================================

    private startGameLoop(): void {
        const msPerTick = 1000 / this.tickRate;

        this.tickInterval = setInterval(() => {
            const now = Date.now();
            const dt = (now - this.lastTickTime) / 1000;
            this.lastTickTime = now;

            this.update(dt);
        }, msPerTick);

        console.log(`[GameServer] Game loop started at ${this.tickRate} ticks/sec`);
    }

    private update(dt: number): void {
        // Update all active matches
        for (const [matchId, match] of this.matches) {
            if (match.phase === 'playing') {
                this.updateMatch(match, dt);
            }
        }
    }

    private updateMatch(match: ServerMatch, dt: number): void {
        match.tick++;

        // Process player inputs
        for (const [playerId, player] of match.players) {
            if (!player.isAlive || !player.lastInput) continue;

            const input = player.lastInput;
            const speed = 300; // Base move speed

            // Update position based on input
            player.velocity = {
                x: input.moveDirection.x * speed,
                y: input.moveDirection.y * speed,
            };

            player.position = {
                x: player.position.x + player.velocity.x * dt,
                y: player.position.y + player.velocity.y * dt,
            };

            // Update rotation
            if (Math.abs(input.aimDirection.x) > 0.01 || Math.abs(input.aimDirection.y) > 0.01) {
                player.rotation = Math.atan2(input.aimDirection.y, input.aimDirection.x);
            }

            // Handle firing
            if (input.isFiring) {
                this.tryFire(match, player);
            }
        }

        // Update projectiles
        for (const [projId, projectile] of match.projectiles) {
            if (!projectile.isActive) continue;

            // Move projectile
            const distance = projectile.speed * dt;
            projectile.position.x += projectile.velocity.x * dt;
            projectile.position.y += projectile.velocity.y * dt;
            projectile.distanceTraveled += distance;

            // Check range
            if (projectile.distanceTraveled >= projectile.range) {
                projectile.isActive = false;
                continue;
            }

            // Check collision with players
            for (const [playerId, player] of match.players) {
                if (!player.isAlive) continue;
                if (player.squadId === projectile.squadId) continue; // No friendly fire

                const dx = player.position.x - projectile.position.x;
                const dy = player.position.y - projectile.position.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < 25) { // Player radius
                    // Hit!
                    this.processHit(match, projectile, player);
                    projectile.isActive = false;
                    break;
                }
            }
        }

        // Remove inactive projectiles
        for (const [projId, projectile] of match.projectiles) {
            if (!projectile.isActive) {
                match.projectiles.delete(projId);
            }
        }

        // Send state update (every 3 ticks = 20Hz)
        if (match.tick % 3 === 0) {
            this.broadcastGameState(match);
        }
    }

    private tryFire(match: ServerMatch, player: ServerPlayer): void {
        // Simplified firing - in real game would check cooldown, ammo, etc.
        const projectile: ServerProjectile = {
            id: randomUUID(),
            ownerId: player.id,
            squadId: player.squadId,
            position: {
                x: player.position.x + Math.cos(player.rotation) * 25,
                y: player.position.y + Math.sin(player.rotation) * 25,
            },
            velocity: {
                x: Math.cos(player.rotation) * 800,
                y: Math.sin(player.rotation) * 800,
            },
            damage: 10,
            speed: 800,
            range: 600,
            distanceTraveled: 0,
            isActive: true,
        };

        match.projectiles.set(projectile.id, projectile);

        // Broadcast projectile spawn
        this.broadcastToMatch(match, {
            type: MessageType.PROJECTILE_SPAWN,
            timestamp: Date.now(),
            sequence: 0,
            projectile: {
                id: projectile.id,
                ownerId: projectile.ownerId,
                position: projectile.position,
                velocity: projectile.velocity,
                damage: projectile.damage,
            },
        });
    }

    private processHit(match: ServerMatch, projectile: ServerProjectile, victim: ServerPlayer): void {
        const shooter = match.players.get(projectile.ownerId);

        // Apply damage
        let damage = projectile.damage;

        // Shield first
        if (victim.shield > 0) {
            const shieldDamage = Math.min(victim.shield, damage);
            victim.shield -= shieldDamage;
            damage -= shieldDamage;
        }

        // Then health
        if (damage > 0) {
            victim.health -= damage;
        }

        // Send damage event
        this.broadcastToMatch(match, {
            type: MessageType.DAMAGE_EVENT,
            timestamp: Date.now(),
            sequence: 0,
            attackerId: projectile.ownerId,
            victimId: victim.id,
            damage: projectile.damage,
            damageType: 'projectile',
            position: victim.position,
        });

        // Check for kill
        if (victim.health <= 0) {
            victim.isAlive = false;
            victim.health = 0;

            // Update scores
            if (shooter) {
                const currentScore = match.scores.get(shooter.squadId) || 0;
                match.scores.set(shooter.squadId, currentScore + 1);
            }

            // Send kill event
            this.broadcastToMatch(match, {
                type: MessageType.KILL_EVENT,
                timestamp: Date.now(),
                sequence: 0,
                killerId: projectile.ownerId,
                victimId: victim.id,
                weaponType: 'projectile',
                position: victim.position,
            });
        }
    }

    // ============================================================================
    // BROADCASTING
    // ============================================================================

    private send(playerId: string, message: any): void {
        const player = this.players.get(playerId);
        if (!player || player.ws.readyState !== WebSocket.OPEN) return;

        try {
            player.ws.send(JSON.stringify(message));
        } catch (error) {
            console.error(`[GameServer] Send error to ${playerId}:`, error);
        }
    }

    private broadcast(message: any): void {
        const data = JSON.stringify(message);
        for (const player of this.players.values()) {
            if (player.ws.readyState === WebSocket.OPEN) {
                try {
                    player.ws.send(data);
                } catch (error) {
                    // Ignore
                }
            }
        }
    }

    private broadcastToMatch(match: ServerMatch, message: any): void {
        const data = JSON.stringify(message);
        for (const player of match.players.values()) {
            if (player.ws.readyState === WebSocket.OPEN) {
                try {
                    player.ws.send(data);
                } catch (error) {
                    // Ignore
                }
            }
        }
    }

    private broadcastLobbyState(lobbyId: string): void {
        const lobby = this.lobbies.get(lobbyId);
        if (!lobby) return;

        const players = Array.from(lobby).map(playerId => {
            const player = this.players.get(playerId);
            return {
                id: playerId,
                name: player?.name || 'Unknown',
                isReady: false, // TODO: Track ready state
            };
        });

        const message = {
            type: MessageType.LOBBY_STATE,
            timestamp: Date.now(),
            sequence: 0,
            lobbyId,
            players,
        };

        for (const playerId of lobby) {
            this.send(playerId, message);
        }
    }

    private broadcastGameState(match: ServerMatch): void {
        const players = Array.from(match.players.values()).map(p => ({
            id: p.id,
            squadId: p.squadId,
            position: p.position,
            velocity: p.velocity,
            rotation: p.rotation,
            health: p.health,
            shield: p.shield,
            isAlive: p.isAlive,
        }));

        const projectiles = Array.from(match.projectiles.values())
            .filter(p => p.isActive)
            .map(p => ({
                id: p.id,
                ownerId: p.ownerId,
                position: p.position,
                velocity: p.velocity,
            }));

        const message = {
            type: MessageType.GAME_STATE,
            timestamp: Date.now(),
            sequence: 0,
            serverTick: match.tick,
            phase: match.phase,
            players,
            projectiles,
        };

        this.broadcastToMatch(match, message);
    }

    // ============================================================================
    // MATCH MANAGEMENT
    // ============================================================================

    createMatch(lobbyId: string): ServerMatch | null {
        const lobby = this.lobbies.get(lobbyId);
        if (!lobby || lobby.size < 2) {
            console.log(`[GameServer] Cannot create match: not enough players`);
            return null;
        }

        const matchId = randomUUID();
        const match: ServerMatch = {
            id: matchId,
            mode: 'arena_1v1',
            players: new Map(),
            projectiles: new Map(),
            startTime: Date.now(),
            tick: 0,
            phase: 'waiting',
            roundNumber: 1,
            scores: new Map(),
        };

        // Add players to match
        let squadIndex = 0;
        for (const playerId of lobby) {
            const player = this.players.get(playerId);
            if (player) {
                player.squadId = `squad_${squadIndex}`;
                player.isAlive = true;
                player.health = player.maxHealth;
                player.position = {
                    x: 400 + squadIndex * 400,
                    y: 400,
                };
                match.players.set(playerId, player);
                match.scores.set(player.squadId, 0);

                // Register player with anti-cheat
                this.antiCheat.registerPlayer(playerId, player.position);

                squadIndex++;
            }
        }

        this.matches.set(matchId, match);
        console.log(`[GameServer] Match created: ${matchId} with ${match.players.size} players`);

        // Start match
        match.phase = 'playing';

        this.broadcastToMatch(match, {
            type: MessageType.MATCH_START,
            timestamp: Date.now(),
            sequence: 0,
            matchId,
            mode: match.mode,
        });

        return match;
    }

    // ============================================================================
    // SHUTDOWN
    // ============================================================================

    shutdown(): void {
        console.log('[GameServer] Shutting down...');

        if (this.tickInterval) {
            clearInterval(this.tickInterval);
        }

        for (const player of this.players.values()) {
            player.ws.close(1001, 'Server shutting down');
        }

        this.wss.close();
        this.httpServer.close();
    }
}

// ============================================================================
// MAIN
// ============================================================================

// Only run if this file is executed directly
if (require.main === module) {
    const port = parseInt(process.env.PORT || '8080', 10);
    const server = new GameServer(port);

    process.on('SIGINT', () => {
        server.shutdown();
        process.exit(0);
    });

    process.on('SIGTERM', () => {
        server.shutdown();
        process.exit(0);
    });
}

export { GameServer };
