// Webb Protocol - Mesh P2P Networking for RIFTLINE
// Core types and interfaces for the peer-to-peer mesh network

/**
 * Connection quality metrics for anchor election
 */
export interface ConnectionQuality {
    playerId: string;
    latency: number;        // ms - lower is better
    uploadSpeed: number;    // Mbps - higher is better
    downloadSpeed: number;  // Mbps - higher is better
    jitter: number;         // ms variance - lower is better
    packetLoss: number;     // percentage - lower is better
    score: number;          // Calculated overall score (0-1000)
    timestamp: number;
}

/**
 * Peer connection state
 */
export type PeerState =
    | 'disconnected'
    | 'connecting'
    | 'connected'
    | 'failed';

/**
 * Role in the mesh network
 */
export type MeshRole =
    | 'player'              // Regular player, connects to squad anchor
    | 'anchor'              // Squad anchor, manages squad state
    | 'primary';            // Primary anchor, handles global events

/**
 * Peer info in the mesh
 */
export interface MeshPeer {
    id: string;
    name: string;
    squadId: number;
    role: MeshRole;
    state: PeerState;
    quality: ConnectionQuality | null;
    connection: RTCPeerConnection | null;
    dataChannel: RTCDataChannel | null;
    lastHeartbeat: number;
}

/**
 * Signaling message types
 */
export type SignalingType =
    | 'offer'
    | 'answer'
    | 'ice-candidate'
    | 'quality-report'
    | 'anchor-election'
    | 'anchor-result'
    | 'heartbeat';

/**
 * Signaling message for WebRTC connection setup
 */
export interface SignalingMessage {
    type: SignalingType;
    from: string;
    to: string;           // '*' for broadcast
    matchId: string;
    payload: any;
    timestamp: number;
}

/**
 * Game state sync message
 */
export interface SyncMessage {
    type: 'state' | 'event' | 'rpc';
    source: string;       // Who sent it
    sequence: number;     // For ordering
    timestamp: number;
    payload: any;
}

/**
 * Squad state managed by anchor
 */
export interface SquadState {
    squadId: number;
    anchorId: string;
    members: string[];
    playerPositions: Map<string, { x: number; y: number }>;
    playerHealth: Map<string, number>;
    localEvents: SyncMessage[];
}

/**
 * Global state managed by primary anchor
 */
export interface GlobalState {
    relicPositions: { id: string; x: number; y: number; state: string }[];
    plantSites: { id: string; x: number; y: number; planted: boolean }[];
    riftlineRadius: number;
    riftlineCenter: { x: number; y: number };
    gamePhase: string;
    roundTime: number;
    eliminatedSquads: number[];
}

/**
 * Match configuration for Webb Protocol
 */
export interface WebbMatchConfig {
    matchId: string;
    maxPlayers: number;
    squadSize: number;
    numSquads: number;
    tickRate: number;       // Target updates per second
    syncInterval: number;   // ms between full state syncs
    heartbeatInterval: number;
    qualityTestDuration: number;
}

/**
 * Default match configuration
 */
export const DEFAULT_WEBB_CONFIG: WebbMatchConfig = {
    matchId: '',
    maxPlayers: 30,
    squadSize: 3,
    numSquads: 10,
    tickRate: 30,           // 30 ticks/second
    syncInterval: 100,      // Full sync every 100ms
    heartbeatInterval: 1000,// Heartbeat every second
    qualityTestDuration: 3000, // 3 second quality test
};

/**
 * Calculate connection quality score (0-1000)
 * Higher is better
 */
export function calculateQualityScore(
    latency: number,
    uploadSpeed: number,
    jitter: number,
    packetLoss: number
): number {
    // Weights for each factor
    const latencyWeight = 0.35;    // Low latency most important
    const uploadWeight = 0.30;     // Upload speed for hosting
    const jitterWeight = 0.20;     // Consistency matters
    const packetLossWeight = 0.15; // Packet loss is bad

    // Normalize each factor to 0-1 range
    const latencyScore = Math.max(0, 1 - (latency / 200));      // 0ms = 1.0, 200ms = 0
    const uploadScore = Math.min(1, uploadSpeed / 50);           // 50Mbps = 1.0
    const jitterScore = Math.max(0, 1 - (jitter / 50));         // 0ms = 1.0, 50ms = 0
    const packetLossScore = Math.max(0, 1 - (packetLoss / 5));  // 0% = 1.0, 5% = 0

    // Calculate weighted score
    const score = (
        latencyScore * latencyWeight +
        uploadScore * uploadWeight +
        jitterScore * jitterWeight +
        packetLossScore * packetLossWeight
    ) * 1000;

    return Math.round(score);
}

/**
 * Elect anchors from quality reports
 * Returns array of player IDs sorted by score (best first)
 */
export function electAnchors(
    qualityReports: ConnectionQuality[],
    numAnchors: number = 10
): string[] {
    // Sort by score descending
    const sorted = [...qualityReports].sort((a, b) => b.score - a.score);

    // Return top N player IDs
    return sorted.slice(0, numAnchors).map(q => q.playerId);
}

/**
 * Assign players to squads based on party groupings and fill
 */
export function assignSquads(
    players: string[],
    parties: Map<string, string[]>, // partyId -> playerIds
    numSquads: number,
    squadSize: number
): Map<string, number> { // playerId -> squadId
    const assignments = new Map<string, number>();
    let currentSquad = 0;
    let currentSquadSize = 0;

    // First, assign party members together
    for (const [, partyMembers] of parties) {
        if (currentSquadSize + partyMembers.length > squadSize) {
            currentSquad++;
            currentSquadSize = 0;
        }
        for (const member of partyMembers) {
            assignments.set(member, currentSquad);
            currentSquadSize++;
            if (currentSquadSize >= squadSize) {
                currentSquad++;
                currentSquadSize = 0;
            }
        }
    }

    // Then fill remaining spots with solo players
    for (const player of players) {
        if (assignments.has(player)) continue;
        if (currentSquadSize >= squadSize) {
            currentSquad++;
            currentSquadSize = 0;
        }
        if (currentSquad >= numSquads) break;
        assignments.set(player, currentSquad);
        currentSquadSize++;
    }

    return assignments;
}
