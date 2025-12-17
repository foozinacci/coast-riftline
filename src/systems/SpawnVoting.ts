// Spawn Voting System
// Handles pre-match team spawn selection per spec

import {
    SpawnLocation,
    SpawnVote,
    Vector2,
    SPAWN_VOTE_DURATION_MS,
} from '../core/types';

/**
 * Generate 5 spawn locations distributed across the map
 */
export function generateSpawnLocations(
    mapWidth: number,
    mapHeight: number,
    count: number = 5
): SpawnLocation[] {
    const locations: SpawnLocation[] = [];
    const padding = 200;
    const subSpawnOffset = 80; // Distance between A-side and B-side

    // Distribute spawns in a rough pentagon/circle around the map
    for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
        const radiusX = (mapWidth / 2 - padding) * 0.7;
        const radiusY = (mapHeight / 2 - padding) * 0.7;

        const centerX = mapWidth / 2 + Math.cos(angle) * radiusX;
        const centerY = mapHeight / 2 + Math.sin(angle) * radiusY;

        // Calculate perpendicular offsets for A-side and B-side
        const perpAngle = angle + Math.PI / 2;

        locations.push({
            id: `spawn_${i}`,
            position: { x: centerX, y: centerY },
            aSideOffset: {
                x: Math.cos(perpAngle) * subSpawnOffset,
                y: Math.sin(perpAngle) * subSpawnOffset,
            },
            bSideOffset: {
                x: -Math.cos(perpAngle) * subSpawnOffset,
                y: -Math.sin(perpAngle) * subSpawnOffset,
            },
            assignedTeams: [],
            maxTeams: 2,
        });
    }

    return locations;
}

/**
 * Spawn Voting Manager
 */
export class SpawnVotingManager {
    private locations: SpawnLocation[];
    private votes: Map<string, SpawnVote> = new Map();
    private votingDeadline: number = 0;
    private isVotingActive: boolean = false;

    constructor(locations: SpawnLocation[]) {
        this.locations = locations;
    }

    /**
     * Start the voting phase
     */
    startVoting(squadIds: string[]): void {
        this.votingDeadline = Date.now() + SPAWN_VOTE_DURATION_MS;
        this.isVotingActive = true;

        // Initialize vote tracking for each squad
        for (const squadId of squadIds) {
            this.votes.set(squadId, {
                squadId,
                locationId: '',
                votes: new Map(),
                finalChoice: null,
                deadline: this.votingDeadline,
            });
        }
    }

    /**
     * Record a player's vote
     */
    castVote(squadId: string, playerId: string, locationId: string): boolean {
        if (!this.isVotingActive) return false;

        const vote = this.votes.get(squadId);
        if (!vote) return false;

        // Validate location exists
        const location = this.locations.find(l => l.id === locationId);
        if (!location) return false;

        vote.votes.set(playerId, locationId);
        return true;
    }

    /**
     * Get current vote tally for a squad
     */
    getVoteTally(squadId: string): Map<string, number> {
        const vote = this.votes.get(squadId);
        const tally = new Map<string, number>();

        if (!vote) return tally;

        for (const locationId of vote.votes.values()) {
            tally.set(locationId, (tally.get(locationId) || 0) + 1);
        }

        return tally;
    }

    /**
     * Finalize voting - assign teams to spawns
     */
    finalizeVoting(): Map<string, { location: SpawnLocation; side: 'A' | 'B' }> {
        this.isVotingActive = false;
        const assignments = new Map<string, { location: SpawnLocation; side: 'A' | 'B' }>();

        // Process each squad's vote
        for (const [squadId, vote] of this.votes) {
            // Get majority vote
            const tally = this.getVoteTally(squadId);
            let bestLocation: string | null = null;
            let bestCount = 0;

            for (const [locId, count] of tally) {
                if (count > bestCount) {
                    bestCount = count;
                    bestLocation = locId;
                }
            }

            // If no votes, pick first available
            if (!bestLocation) {
                for (const loc of this.locations) {
                    if (loc.assignedTeams.length < loc.maxTeams) {
                        bestLocation = loc.id;
                        break;
                    }
                }
            }

            // Try to assign to chosen location
            let assigned = false;
            if (bestLocation) {
                const location = this.locations.find(l => l.id === bestLocation);
                if (location && location.assignedTeams.length < location.maxTeams) {
                    const side = location.assignedTeams.length === 0 ? 'A' : 'B';
                    location.assignedTeams.push(squadId);
                    assignments.set(squadId, { location, side });
                    assigned = true;
                }
            }

            // Fallback: find nearest available spawn
            if (!assigned) {
                for (const location of this.locations) {
                    if (location.assignedTeams.length < location.maxTeams) {
                        const side = location.assignedTeams.length === 0 ? 'A' : 'B';
                        location.assignedTeams.push(squadId);
                        assignments.set(squadId, { location, side });
                        break;
                    }
                }
            }
        }

        return assignments;
    }

    /**
     * Get spawn position for a team
     */
    getSpawnPosition(location: SpawnLocation, side: 'A' | 'B'): Vector2 {
        const offset = side === 'A' ? location.aSideOffset : location.bSideOffset;
        return {
            x: location.position.x + offset.x,
            y: location.position.y + offset.y,
        };
    }

    /**
     * Check if voting is still active
     */
    isActive(): boolean {
        return this.isVotingActive && Date.now() < this.votingDeadline;
    }

    /**
     * Get time remaining in seconds
     */
    getTimeRemaining(): number {
        if (!this.isVotingActive) return 0;
        return Math.max(0, (this.votingDeadline - Date.now()) / 1000);
    }

    /**
     * Get all spawn locations
     */
    getLocations(): SpawnLocation[] {
        return this.locations;
    }
}
