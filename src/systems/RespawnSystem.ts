// Respawn System
// Orb economy, respawn beacons, and squad persistence per spec

import {
    RespawnOrb,
    RespawnBeacon,
    Vector2,
    ORB_LIFETIME_MS,
    ORB_BASE_VALUE,
} from '../core/types';
import { distanceVec2 } from '../core/utils';

/**
 * Player respawn state
 */
export interface PlayerRespawnState {
    playerId: string;
    squadId: string;
    isAlive: boolean;
    respawnCooldown: number; // Remaining seconds
    baseCooldown: number;
    orbBonusReduction: number; // Seconds reduced by orbs
}

/**
 * Squad respawn state
 */
export interface SquadRespawnState {
    squadId: string;
    isEliminated: boolean;
    livingPlayers: string[];
    orbsCollected: number;
    totalCooldownReduction: number;
}

/**
 * Respawn Manager - Handles orbs, beacons, and respawn logic
 */
export class RespawnManager {
    private orbs: RespawnOrb[] = [];
    private beacons: RespawnBeacon[] = [];
    private playerStates: Map<string, PlayerRespawnState> = new Map();
    private squadStates: Map<string, SquadRespawnState> = new Map();
    private baseRespawnCooldown: number = 10; // Base seconds
    private orbIdCounter: number = 0;

    /**
     * Register a squad
     */
    registerSquad(squadId: string, playerIds: string[]): void {
        this.squadStates.set(squadId, {
            squadId,
            isEliminated: false,
            livingPlayers: [...playerIds],
            orbsCollected: 0,
            totalCooldownReduction: 0,
        });

        for (const playerId of playerIds) {
            this.playerStates.set(playerId, {
                playerId,
                squadId,
                isAlive: true,
                respawnCooldown: 0,
                baseCooldown: this.baseRespawnCooldown,
                orbBonusReduction: 0,
            });
        }
    }

    /**
     * Set respawn cooldown multiplier (from escalation)
     */
    setRespawnCooldownMultiplier(multiplier: number): void {
        // Update base cooldown for all players
        for (const state of this.playerStates.values()) {
            state.baseCooldown = this.baseRespawnCooldown * multiplier;
        }
    }

    /**
     * Player dies - start respawn cooldown
     */
    onPlayerDeath(playerId: string, deathPosition: Vector2): void {
        const player = this.playerStates.get(playerId);
        if (!player) return;

        player.isAlive = false;

        // Calculate cooldown with orb bonus
        const squad = this.squadStates.get(player.squadId);
        const orbBonus = squad?.totalCooldownReduction || 0;
        player.respawnCooldown = Math.max(3, player.baseCooldown - orbBonus);

        // Update squad living players
        if (squad) {
            squad.livingPlayers = squad.livingPlayers.filter(id => id !== playerId);

            // Check for squad elimination
            if (squad.livingPlayers.length === 0) {
                squad.isEliminated = true;
            }
        }

        // Spawn orbs at death location
        this.spawnOrbsFromDeath(deathPosition, player.squadId);
    }

    /**
     * Spawn orbs when player dies
     */
    private spawnOrbsFromDeath(position: Vector2, sourceSquadId: string): void {
        const orbCount = 2 + Math.floor(Math.random() * 2); // 2-3 orbs
        const spreadRadius = 40;

        for (let i = 0; i < orbCount; i++) {
            const angle = (i / orbCount) * Math.PI * 2;
            const offsetX = Math.cos(angle) * spreadRadius;
            const offsetY = Math.sin(angle) * spreadRadius;

            this.orbs.push({
                id: `orb_${this.orbIdCounter++}`,
                position: {
                    x: position.x + offsetX,
                    y: position.y + offsetY,
                },
                value: ORB_BASE_VALUE,
                spawnTime: Date.now(),
                expiresAt: Date.now() + ORB_LIFETIME_MS,
                collectedBy: null,
            });
        }
    }

    /**
     * Collect orbs near a player
     */
    collectOrbs(playerId: string, position: Vector2, collectRadius: number = 40): number {
        const player = this.playerStates.get(playerId);
        if (!player || !player.isAlive) return 0;

        const squad = this.squadStates.get(player.squadId);
        if (!squad) return 0;

        let totalValue = 0;

        for (const orb of this.orbs) {
            if (orb.collectedBy) continue;

            const distance = distanceVec2(position, orb.position);
            if (distance <= collectRadius) {
                orb.collectedBy = playerId;
                totalValue += orb.value;
                squad.orbsCollected++;
                squad.totalCooldownReduction += orb.value;
            }
        }

        return totalValue;
    }

    /**
     * Update respawn timers
     */
    update(deltaMs: number): { respawnedPlayers: string[] } {
        const respawnedPlayers: string[] = [];
        const now = Date.now();

        // Remove expired orbs
        this.orbs = this.orbs.filter(orb => !orb.collectedBy && now < orb.expiresAt);

        // Update respawn cooldowns
        for (const player of this.playerStates.values()) {
            if (!player.isAlive && player.respawnCooldown > 0) {
                player.respawnCooldown -= deltaMs / 1000;

                if (player.respawnCooldown <= 0) {
                    player.respawnCooldown = 0;

                    // Check if squad is still alive (can respawn)
                    const squad = this.squadStates.get(player.squadId);
                    if (squad && !squad.isEliminated && squad.livingPlayers.length > 0) {
                        respawnedPlayers.push(player.playerId);
                    }
                }
            }
        }

        return { respawnedPlayers };
    }

    /**
     * Respawn player near teammate
     */
    respawnPlayer(playerId: string, spawnPosition: Vector2): void {
        const player = this.playerStates.get(playerId);
        if (!player) return;

        player.isAlive = true;
        player.respawnCooldown = 0;
        player.orbBonusReduction = 0;

        // Add back to squad living players
        const squad = this.squadStates.get(player.squadId);
        if (squad && !squad.livingPlayers.includes(playerId)) {
            squad.livingPlayers.push(playerId);
        }
    }

    /**
     * Place a respawn beacon
     */
    placeBeacon(squadId: string, position: Vector2): RespawnBeacon {
        const beacon: RespawnBeacon = {
            id: `beacon_${Date.now()}`,
            position: { ...position },
            squadId,
            isUsed: false,
            respawnDelay: 2, // 2 seconds instead of full cooldown
        };

        this.beacons.push(beacon);
        return beacon;
    }

    /**
     * Use a beacon to instantly respawn
     */
    useBeacon(beaconId: string, playerId: string): boolean {
        const beacon = this.beacons.find(b => b.id === beaconId && !b.isUsed);
        if (!beacon) return false;

        const player = this.playerStates.get(playerId);
        if (!player || player.isAlive) return false;

        if (player.squadId !== beacon.squadId) return false;

        beacon.isUsed = true;
        player.respawnCooldown = beacon.respawnDelay;

        return true;
    }

    /**
     * Get safest respawn position (near least-engaged teammate)
     */
    getSafestRespawnPosition(
        squadId: string,
        teammatePositions: Map<string, Vector2>,
        dangerZones: Vector2[]
    ): Vector2 | null {
        const squad = this.squadStates.get(squadId);
        if (!squad || squad.livingPlayers.length === 0) return null;

        let safestPosition: Vector2 | null = null;
        let safestScore = -Infinity;

        for (const playerId of squad.livingPlayers) {
            const pos = teammatePositions.get(playerId);
            if (!pos) continue;

            // Calculate safety score (distance from danger zones)
            let dangerScore = 0;
            for (const danger of dangerZones) {
                dangerScore += distanceVec2(pos, danger);
            }

            if (dangerScore > safestScore) {
                safestScore = dangerScore;
                safestPosition = {
                    x: pos.x + (Math.random() - 0.5) * 100,
                    y: pos.y + (Math.random() - 0.5) * 100,
                };
            }
        }

        return safestPosition;
    }

    /**
     * Check if squad is eliminated
     */
    isSquadEliminated(squadId: string): boolean {
        const squad = this.squadStates.get(squadId);
        return squad?.isEliminated || false;
    }

    /**
     * Get player respawn time remaining
     */
    getPlayerRespawnTime(playerId: string): number {
        const player = this.playerStates.get(playerId);
        return player?.respawnCooldown || 0;
    }

    // Getters
    getOrbs(): RespawnOrb[] { return this.orbs; }
    getBeacons(): RespawnBeacon[] { return this.beacons.filter(b => !b.isUsed); }
    getPlayerState(playerId: string): PlayerRespawnState | undefined { return this.playerStates.get(playerId); }
    getSquadState(squadId: string): SquadRespawnState | undefined { return this.squadStates.get(squadId); }
}
