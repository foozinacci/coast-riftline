// Relic System
// Handles relic spawning, carrying, planting, and progression per spec

import {
    RelicState,
    RelicPlantSite,
    RelicRing,
    Vector2,
    PLANT_DURATION_MS,
    RELIC_CARRIER_SPEED_PENALTY,
} from '../core/types';
import { Relic } from '../entities/Relic';
import { distanceVec2, randomRange } from '../core/utils';

/**
 * Generate relic spawn positions and plant sites
 */
export function generateRelicSystem(
    mapWidth: number,
    mapHeight: number,
    count: number = 5,
    isValidPos?: (pos: Vector2, radius: number) => boolean
): { relics: Relic[]; plantSites: RelicPlantSite[] } {
    const relics: Relic[] = [];
    const plantSites: RelicPlantSite[] = [];
    const centerX = mapWidth / 2;
    const centerY = mapHeight / 2;
    const spawnRadius = Math.min(mapWidth, mapHeight) * 0.35;
    const plantRadius = Math.min(mapWidth, mapHeight) * 0.25;

    for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;

        // Relic spawn position (outer ring) with validation
        let spawnX = centerX + Math.cos(angle) * spawnRadius;
        let spawnY = centerY + Math.sin(angle) * spawnRadius;

        // Try to find valid spawn if obstructed
        if (isValidPos) {
            let offset = 0;
            // Scan around the point
            while (!isValidPos({ x: spawnX, y: spawnY }, 30) && offset < 50) {
                offset += 10;
                spawnX += randomRange(-offset, offset);
                spawnY += randomRange(-offset, offset);
            }
        }

        // Plant site position (inner ring, offset from spawn)
        const plantAngle = angle + Math.PI / count; // Offset so sites aren't at spawns
        let plantX = centerX + Math.cos(plantAngle) * plantRadius;
        let plantY = centerY + Math.sin(plantAngle) * plantRadius;

        if (isValidPos) {
            let offset = 0;
            while (!isValidPos({ x: plantX, y: plantY }, 60) && offset < 50) { // Larger radius for plant site
                offset += 10;
                plantX += randomRange(-offset, offset);
                plantY += randomRange(-offset, offset);
            }
        }

        const relicId = `relic_${i}`;
        const siteId = `plant_site_${i}`;

        // Create Relic Entity
        const relic = new Relic(spawnX, spawnY);
        relic.id = relicId;
        relic.spawnPosition = { x: spawnX, y: spawnY };
        relic.plantSiteId = siteId;
        relic.state = RelicState.AVAILABLE;
        relic.carrierId = null;
        relic.plantProgress = 0;
        relic.planterId = null;

        relics.push(relic);

        plantSites.push({
            id: siteId,
            position: { x: plantX, y: plantY },
            radius: 80, // Increased for easier planting
            linkedRelicId: relicId,
            hasPlantedRelic: false,
            safeZoneRadius: 200, // Relic ring radius when planted
            safeZoneActive: false,
        });
    }

    return { relics, plantSites };
}

/**
 * Relic Manager - Handles all relic-related logic
 */
export class RelicManager {
    private relics: Relic[];
    private plantSites: RelicPlantSite[];
    private relicRings: RelicRing[] = [];
    private onRelicPlanted: ((relicId: string) => void) | null = null;

    constructor(relics: Relic[], plantSites: RelicPlantSite[]) {
        this.relics = relics;
        this.plantSites = plantSites;
    }

    /**
     * Set callback for when a relic is planted
     */
    setOnRelicPlanted(callback: (relicId: string) => void): void {
        this.onRelicPlanted = callback;
    }

    /**
     * Activate all relics (after spawn animation)
     */
    activateRelics(): void {
        for (const relic of this.relics) {
            relic.state = RelicState.AVAILABLE;
        }
    }

    /**
     * Try to pick up a relic
     */
    tryPickup(playerId: string, playerPos: Vector2, pickupRadius: number = 30): Relic | null {
        for (const relic of this.relics) {
            if (relic.state !== RelicState.AVAILABLE) continue;

            const distance = distanceVec2(playerPos, relic.position);
            if (distance <= pickupRadius) {
                relic.state = RelicState.CARRIED;
                relic.carrierId = playerId;
                return relic;
            }
        }
        return null;
    }

    /**
     * Drop a relic at position (when carrier dies)
     */
    dropRelic(playerId: string, dropPosition: Vector2): Relic | null {
        const relic = this.relics.find(r => r.carrierId === playerId);
        if (!relic) return null;

        relic.state = RelicState.AVAILABLE;
        relic.carrierId = null;
        relic.position = { ...dropPosition };
        relic.plantProgress = 0;
        relic.planterId = null;

        return relic;
    }

    /**
     * Start planting a relic
     */
    startPlanting(playerId: string, playerPos: Vector2): { success: boolean; siteId: string | null } {
        const carriedRelic = this.relics.find(r => r.carrierId === playerId);
        if (!carriedRelic) return { success: false, siteId: null };

        // Find ANY available plant site within range (not just the matching one)
        const site = this.plantSites.find(s => {
            if (s.hasPlantedRelic) return false; // Already has a relic
            const distance = distanceVec2(playerPos, s.position);
            return distance <= s.radius;
        });

        if (!site) return { success: false, siteId: null };

        // Update the relic to link to this site
        carriedRelic.plantSiteId = site.id;
        carriedRelic.state = RelicState.PLANTING;
        carriedRelic.planterId = playerId;
        carriedRelic.plantProgress = 0;

        return { success: true, siteId: site.id };
    }

    /**
     * Update planting progress
     * @returns true if planting completed
     */
    updatePlanting(playerId: string, playerPos: Vector2, deltaMs: number): boolean {
        const relic = this.relics.find(r => r.planterId === playerId && r.state === RelicState.PLANTING);
        if (!relic) return false;

        const site = this.plantSites.find(s => s.id === relic.plantSiteId);
        if (!site) {
            this.cancelPlanting(playerId);
            return false;
        }

        // Check player still in range
        const distance = distanceVec2(playerPos, site.position);
        if (distance > site.radius) {
            this.cancelPlanting(playerId);
            return false;
        }

        // Update progress
        relic.plantProgress += deltaMs / PLANT_DURATION_MS;

        if (relic.plantProgress >= 1) {
            // Planting complete!
            relic.state = RelicState.PLANTED;
            relic.carrierId = null;
            relic.position = { ...site.position };
            site.hasPlantedRelic = true;
            site.safeZoneActive = true;

            // Create relic ring
            this.relicRings.push({
                id: `ring_${relic.id}`,
                plantSiteId: site.id,
                position: { ...site.position },
                currentRadius: site.safeZoneRadius,
                maxRadius: site.safeZoneRadius,
                shrinkRate: 0, // Set by escalation system
                decayStartTime: null,
                isDecaying: false,
            });

            if (this.onRelicPlanted) {
                this.onRelicPlanted(relic.id);
            }

            return true;
        }

        return false;
    }

    /**
     * Cancel planting (player moved, took damage, etc)
     */
    cancelPlanting(playerId: string): void {
        const relic = this.relics.find(r => r.planterId === playerId && r.state === RelicState.PLANTING);
        if (!relic) return;

        relic.state = RelicState.CARRIED;
        relic.plantProgress = 0;
        relic.planterId = null;
    }

    /**
     * Get the relic a player is carrying
     */
    getCarriedRelic(playerId: string): Relic | null {
        return this.relics.find(r => r.carrierId === playerId) || null;
    }

    /**
     * Get speed penalty for carrying relic
     */
    getCarrierSpeedMultiplier(playerId: string): number {
        const relic = this.getCarriedRelic(playerId);
        return relic ? 1 - RELIC_CARRIER_SPEED_PENALTY : 1;
    }

    /**
     * Count planted relics
     */
    getPlantedCount(): number {
        return this.relics.filter(r => r.state === RelicState.PLANTED).length;
    }

    /**
     * Update relic rings (shrink/decay)
     */
    updateRelicRings(deltaMs: number, isDecaying: boolean): void {
        for (const ring of this.relicRings) {
            ring.isDecaying = isDecaying;

            if (isDecaying && ring.shrinkRate > 0) {
                ring.currentRadius -= (ring.shrinkRate * deltaMs) / 1000;
                ring.currentRadius = Math.max(0, ring.currentRadius);
            }
        }
    }

    /**
     * Set shrink rate for all rings (based on escalation)
     */
    setRingShrinkRate(rate: number): void {
        for (const ring of this.relicRings) {
            ring.shrinkRate = rate;
        }
    }

    /**
     * Check if a position is inside any relic ring
     */
    isInRelicRing(position: Vector2): boolean {
        for (const ring of this.relicRings) {
            if (ring.currentRadius > 0) {
                const distance = distanceVec2(position, ring.position);
                if (distance <= ring.currentRadius) {
                    return true;
                }
            }
        }
        return false;
    }

    // Getters
    getRelics(): Relic[] { return this.relics; }
    getPlantSites(): RelicPlantSite[] { return this.plantSites; }
    getRelicRings(): RelicRing[] { return this.relicRings; }
}
