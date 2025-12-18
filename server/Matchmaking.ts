// Matchmaking Queue System for RIFTLINE
// Skill-based matchmaking with party support

import { randomUUID } from 'crypto';

// ============================================================================
// TYPES
// ============================================================================

interface QueuedPlayer {
    id: string;
    name: string;
    mmr: number;
    partyId: string | null;
    queuedAt: number;
    gameMode: string;
    isLeader: boolean;
}

interface QueuedParty {
    id: string;
    leaderId: string;
    members: string[];
    averageMMR: number;
    queuedAt: number;
    gameMode: string;
}

interface MatchCandidate {
    players: QueuedPlayer[];
    parties: QueuedParty[];
    averageMMR: number;
    mmrSpread: number;
    waitTime: number;
}

interface MatchResult {
    matchId: string;
    players: string[];
    teams: { players: string[]; averageMMR: number }[];
    mode: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const MMR_RANGE_INITIAL = 100; // Start searching within +/- 100 MMR
const MMR_RANGE_EXPANSION_RATE = 50; // Expand by 50 every 10 seconds
const MMR_RANGE_MAX = 500; // Maximum MMR difference
const MAX_WAIT_TIME_MS = 120000; // 2 minutes max wait

const TEAM_SIZES: Record<string, number> = {
    'arena_1v1': 1,
    'arena_2v2': 2,
    'arena_3v3': 3,
    'arena_1v1v1': 1,
    'main': 4, // 4 squads of 4
};

const TEAMS_PER_MATCH: Record<string, number> = {
    'arena_1v1': 2,
    'arena_2v2': 2,
    'arena_3v3': 2,
    'arena_1v1v1': 3,
    'main': 4,
};

// ============================================================================
// MATCHMAKING QUEUE
// ============================================================================

export class MatchmakingQueue {
    private soloPlayers: Map<string, QueuedPlayer> = new Map();
    private parties: Map<string, QueuedParty> = new Map();
    private playerToParty: Map<string, string> = new Map();

    private matchFoundCallback: ((match: MatchResult) => void) | null = null;
    private tickInterval: ReturnType<typeof setInterval> | null = null;

    constructor() {
        // Start matchmaking tick
        this.tickInterval = setInterval(() => this.tick(), 1000);
    }

    /**
     * Set callback for when a match is found
     */
    onMatchFound(callback: (match: MatchResult) => void): void {
        this.matchFoundCallback = callback;
    }

    /**
     * Add a solo player to the queue
     */
    queuePlayer(player: {
        id: string;
        name: string;
        mmr: number;
        gameMode: string;
    }): void {
        // Remove from any existing queue
        this.dequeuePlayer(player.id);

        const queuedPlayer: QueuedPlayer = {
            id: player.id,
            name: player.name,
            mmr: player.mmr,
            partyId: null,
            queuedAt: Date.now(),
            gameMode: player.gameMode,
            isLeader: true,
        };

        this.soloPlayers.set(player.id, queuedPlayer);
        console.log(`[Matchmaking] Player ${player.name} queued for ${player.gameMode} (MMR: ${player.mmr})`);
    }

    /**
     * Add a party to the queue
     */
    queueParty(party: {
        id: string;
        leaderId: string;
        members: { id: string; name: string; mmr: number }[];
        gameMode: string;
    }): void {
        // Remove all members from any existing queue
        for (const member of party.members) {
            this.dequeuePlayer(member.id);
        }

        // Calculate average MMR
        const totalMMR = party.members.reduce((sum, m) => sum + m.mmr, 0);
        const averageMMR = Math.round(totalMMR / party.members.length);

        const queuedParty: QueuedParty = {
            id: party.id,
            leaderId: party.leaderId,
            members: party.members.map(m => m.id),
            averageMMR,
            queuedAt: Date.now(),
            gameMode: party.gameMode,
        };

        this.parties.set(party.id, queuedParty);

        // Add party members as queued players
        for (const member of party.members) {
            const queuedPlayer: QueuedPlayer = {
                id: member.id,
                name: member.name,
                mmr: member.mmr,
                partyId: party.id,
                queuedAt: Date.now(),
                gameMode: party.gameMode,
                isLeader: member.id === party.leaderId,
            };
            this.soloPlayers.set(member.id, queuedPlayer);
            this.playerToParty.set(member.id, party.id);
        }

        console.log(`[Matchmaking] Party ${party.id} queued for ${party.gameMode} (Avg MMR: ${averageMMR})`);
    }

    /**
     * Remove a player from the queue
     */
    dequeuePlayer(playerId: string): void {
        const player = this.soloPlayers.get(playerId);
        if (!player) return;

        // If in party, remove entire party
        if (player.partyId) {
            const party = this.parties.get(player.partyId);
            if (party) {
                for (const memberId of party.members) {
                    this.soloPlayers.delete(memberId);
                    this.playerToParty.delete(memberId);
                }
                this.parties.delete(player.partyId);
                console.log(`[Matchmaking] Party ${player.partyId} dequeued`);
            }
        } else {
            this.soloPlayers.delete(playerId);
            console.log(`[Matchmaking] Player ${playerId} dequeued`);
        }
    }

    /**
     * Get queue status for a player
     */
    getQueueStatus(playerId: string): {
        inQueue: boolean;
        position: number;
        estimatedWait: number;
        mode: string | null;
    } {
        const player = this.soloPlayers.get(playerId);
        if (!player) {
            return { inQueue: false, position: 0, estimatedWait: 0, mode: null };
        }

        // Calculate position (simplified - just count how many queued before this player)
        let position = 0;
        for (const [, p] of this.soloPlayers) {
            if (p.gameMode === player.gameMode && p.queuedAt < player.queuedAt) {
                position++;
            }
        }

        // Estimate wait (very rough - based on historical average)
        const estimatedWait = Math.max(5, 30 - position * 2);

        return {
            inQueue: true,
            position: position + 1,
            estimatedWait,
            mode: player.gameMode,
        };
    }

    /**
     * Main matchmaking tick
     */
    private tick(): void {
        // Group players by game mode
        const byMode = new Map<string, QueuedPlayer[]>();

        for (const [, player] of this.soloPlayers) {
            if (!byMode.has(player.gameMode)) {
                byMode.set(player.gameMode, []);
            }
            byMode.get(player.gameMode)!.push(player);
        }

        // Try to form matches for each mode
        for (const [mode, players] of byMode) {
            this.tryFormMatch(mode, players);
        }
    }

    /**
     * Try to form a match for a specific mode
     */
    private tryFormMatch(mode: string, players: QueuedPlayer[]): void {
        const teamSize = TEAM_SIZES[mode] || 1;
        const teamsRequired = TEAMS_PER_MATCH[mode] || 2;
        const playersNeeded = teamSize * teamsRequired;

        if (players.length < playersNeeded) {
            return; // Not enough players
        }

        // Sort by wait time (oldest first)
        const sorted = [...players].sort((a, b) => a.queuedAt - b.queuedAt);

        // For each player, try to find suitable opponents
        for (const anchor of sorted) {
            const waitTime = Date.now() - anchor.queuedAt;
            const mmrRange = Math.min(
                MMR_RANGE_MAX,
                MMR_RANGE_INITIAL + Math.floor(waitTime / 10000) * MMR_RANGE_EXPANSION_RATE
            );

            // Find players within MMR range
            const candidates = sorted.filter(p =>
                p.id !== anchor.id &&
                Math.abs(p.mmr - anchor.mmr) <= mmrRange &&
                // If in party, don't match party members against each other on same team
                (p.partyId !== anchor.partyId || p.partyId === null)
            );

            // Check if we have enough for a match
            if (candidates.length + 1 >= playersNeeded) {
                // Form match based on mode
                const match = this.formMatch(mode, anchor, candidates, teamSize, teamsRequired);
                if (match) {
                    this.executeMatch(match);
                    return; // Only one match per tick per mode
                }
            }
        }
    }

    /**
     * Form balanced teams from candidates
     */
    private formMatch(
        mode: string,
        anchor: QueuedPlayer,
        candidates: QueuedPlayer[],
        teamSize: number,
        teamsRequired: number
    ): MatchResult | null {
        const matchId = randomUUID();
        const teams: { players: string[]; averageMMR: number }[] = [];
        const usedPlayers = new Set<string>();
        const allPlayers: string[] = [];

        // Handle parties - keep party members together
        const partyGroups = new Map<string, QueuedPlayer[]>();

        // Add anchor
        if (anchor.partyId) {
            const partyMembers = [anchor, ...candidates.filter(c => c.partyId === anchor.partyId)];
            partyGroups.set(anchor.partyId, partyMembers);
        } else {
            partyGroups.set(`solo_${anchor.id}`, [anchor]);
        }

        // Group candidates by party
        for (const candidate of candidates) {
            if (usedPlayers.has(candidate.id)) continue;

            if (candidate.partyId && !partyGroups.has(candidate.partyId)) {
                const partyMembers = candidates.filter(c => c.partyId === candidate.partyId);
                partyGroups.set(candidate.partyId, partyMembers);
                partyMembers.forEach(m => usedPlayers.add(m.id));
            } else if (!candidate.partyId) {
                partyGroups.set(`solo_${candidate.id}`, [candidate]);
                usedPlayers.add(candidate.id);
            }
        }

        // Sort groups by size (prefer to place parties on same team)
        const sortedGroups = Array.from(partyGroups.values())
            .sort((a, b) => b.length - a.length);

        // Assign groups to teams
        for (let i = 0; i < teamsRequired; i++) {
            teams.push({ players: [], averageMMR: 0 });
        }

        for (const group of sortedGroups) {
            // Find team with space and lowest average MMR (for balance)
            let bestTeam = -1;
            let bestScore = Infinity;

            for (let i = 0; i < teams.length; i++) {
                const team = teams[i];
                if (team.players.length + group.length <= teamSize) {
                    // Prefer team that would create better balance
                    const newAvg = (team.averageMMR * team.players.length +
                        group.reduce((s, p) => s + p.mmr, 0)) /
                        (team.players.length + group.length || 1);
                    if (newAvg < bestScore) {
                        bestScore = newAvg;
                        bestTeam = i;
                    }
                }
            }

            if (bestTeam >= 0) {
                for (const player of group) {
                    teams[bestTeam].players.push(player.id);
                    allPlayers.push(player.id);
                }
                // Recalculate team average
                const teamPlayers = teams[bestTeam].players.map(id =>
                    this.soloPlayers.get(id)!
                );
                teams[bestTeam].averageMMR = Math.round(
                    teamPlayers.reduce((s, p) => s + p.mmr, 0) / teamPlayers.length
                );
            }
        }

        // Check if all teams are full
        const allFull = teams.every(t => t.players.length === teamSize);
        if (!allFull) {
            return null;
        }

        // Calculate MMR spread for logging
        const mmrs = teams.map(t => t.averageMMR);
        const mmrSpread = Math.max(...mmrs) - Math.min(...mmrs);

        console.log(`[Matchmaking] Match formed: ${matchId}`);
        console.log(`  Teams: ${teams.map(t => `[${t.players.length}p, ${t.averageMMR}MMR]`).join(' vs ')}`);
        console.log(`  MMR Spread: ${mmrSpread}`);

        return {
            matchId,
            players: allPlayers,
            teams,
            mode,
        };
    }

    /**
     * Execute a formed match
     */
    private executeMatch(match: MatchResult): void {
        // Remove all matched players from queue
        for (const playerId of match.players) {
            this.dequeuePlayer(playerId);
        }

        // Notify callback
        if (this.matchFoundCallback) {
            this.matchFoundCallback(match);
        }
    }

    /**
     * Get queue statistics
     */
    getStats(): {
        totalPlayers: number;
        totalParties: number;
        byMode: Record<string, number>;
    } {
        const byMode: Record<string, number> = {};

        for (const [, player] of this.soloPlayers) {
            if (!player.partyId) { // Only count solo players once
                byMode[player.gameMode] = (byMode[player.gameMode] || 0) + 1;
            }
        }

        for (const [, party] of this.parties) {
            byMode[party.gameMode] = (byMode[party.gameMode] || 0) + party.members.length;
        }

        return {
            totalPlayers: this.soloPlayers.size,
            totalParties: this.parties.size,
            byMode,
        };
    }

    /**
     * Shutdown the matchmaking system
     */
    shutdown(): void {
        if (this.tickInterval) {
            clearInterval(this.tickInterval);
        }
        this.soloPlayers.clear();
        this.parties.clear();
        this.playerToParty.clear();
    }
}

// Export singleton
export const matchmaking = new MatchmakingQueue();
