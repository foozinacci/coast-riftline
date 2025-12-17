// Healing Systems
// Campfires and passive healing per spec

import {
    Campfire,
    HealingState,
    Vector2,
    CAMPFIRE_HEAL_RATE,
    PASSIVE_HEAL_DELAY_MS,
    PASSIVE_HEAL_RATE,
} from '../core/types';
import { distanceVec2 } from '../core/utils';

/**
 * Generate campfire locations across the map
 */
export function generateCampfires(
    mapWidth: number,
    mapHeight: number,
    count: number = 8
): Campfire[] {
    const campfires: Campfire[] = [];
    const padding = 150;

    // Distribute campfires semi-randomly
    for (let i = 0; i < count; i++) {
        // Use golden ratio for better distribution
        const angle = i * 2.399963; // Golden angle
        const radius = Math.sqrt(i / count) * (Math.min(mapWidth, mapHeight) / 2 - padding);

        const x = mapWidth / 2 + Math.cos(angle) * radius;
        const y = mapHeight / 2 + Math.sin(angle) * radius;

        campfires.push({
            id: `campfire_${i}`,
            position: { x, y },
            radius: 40,
            healRate: CAMPFIRE_HEAL_RATE,
            isActive: true,
        });
    }

    return campfires;
}

/**
 * Create initial healing state for a player
 */
export function createHealingState(): HealingState {
    return {
        lastDamageTaken: 0,
        lastDamageDealt: 0,
        lastActionTime: 0,
        isPassiveHealingActive: false,
        healingPerSecond: 0,
    };
}

/**
 * Healing Manager - Handles campfires and passive healing
 */
export class HealingManager {
    private campfires: Campfire[];
    private playerHealingStates: Map<string, HealingState> = new Map();

    constructor(campfires: Campfire[]) {
        this.campfires = campfires;
    }

    /**
     * Register a player for healing tracking
     */
    registerPlayer(playerId: string): void {
        this.playerHealingStates.set(playerId, createHealingState());
    }

    /**
     * Unregister a player
     */
    unregisterPlayer(playerId: string): void {
        this.playerHealingStates.delete(playerId);
    }

    /**
     * Notify that player took damage
     */
    onPlayerDamaged(playerId: string): void {
        const state = this.playerHealingStates.get(playerId);
        if (state) {
            state.lastDamageTaken = Date.now();
            state.isPassiveHealingActive = false;
        }
    }

    /**
     * Notify that player dealt damage
     */
    onPlayerDealtDamage(playerId: string): void {
        const state = this.playerHealingStates.get(playerId);
        if (state) {
            state.lastDamageDealt = Date.now();
            state.isPassiveHealingActive = false;
        }
    }

    /**
     * Notify that player performed an action (firing, ability)
     */
    onPlayerAction(playerId: string): void {
        const state = this.playerHealingStates.get(playerId);
        if (state) {
            state.lastActionTime = Date.now();
            state.isPassiveHealingActive = false;
        }
    }

    /**
     * Check if player is at a campfire
     */
    isAtCampfire(position: Vector2): Campfire | null {
        for (const campfire of this.campfires) {
            if (!campfire.isActive) continue;

            const distance = distanceVec2(position, campfire.position);
            if (distance <= campfire.radius) {
                return campfire;
            }
        }
        return null;
    }

    /**
     * Update healing for a player
     * @returns amount healed this frame (shield, health)
     */
    updatePlayerHealing(
        playerId: string,
        position: Vector2,
        currentHealth: number,
        maxHealth: number,
        currentShield: number,
        maxShield: number,
        isMoving: boolean,
        deltaMs: number
    ): { shieldHeal: number; healthHeal: number } {
        const state = this.playerHealingStates.get(playerId);
        if (!state) return { shieldHeal: 0, healthHeal: 0 };

        const now = Date.now();
        let healRate = 0;

        // Check campfire first (higher priority, heals even when moving)
        const campfire = this.isAtCampfire(position);
        if (campfire && !isMoving) {
            // Must be stationary at campfire
            healRate = campfire.healRate;
            state.isPassiveHealingActive = false;
        } else {
            // Check passive healing conditions
            const timeSinceDamageTaken = now - state.lastDamageTaken;
            const timeSinceDamageDealt = now - state.lastDamageDealt;
            const timeSinceAction = now - state.lastActionTime;

            const canPassiveHeal =
                timeSinceDamageTaken > PASSIVE_HEAL_DELAY_MS &&
                timeSinceDamageDealt > PASSIVE_HEAL_DELAY_MS &&
                timeSinceAction > PASSIVE_HEAL_DELAY_MS &&
                !isMoving;

            if (canPassiveHeal) {
                state.isPassiveHealingActive = true;
                healRate = PASSIVE_HEAL_RATE;
            } else {
                state.isPassiveHealingActive = false;
            }
        }

        if (healRate <= 0) {
            state.healingPerSecond = 0;
            return { shieldHeal: 0, healthHeal: 0 };
        }

        state.healingPerSecond = healRate;
        const totalHeal = (healRate * deltaMs) / 1000;
        let shieldHeal = 0;
        let healthHeal = 0;

        // Heal shields first (campfire mechanic)
        if (campfire && currentShield < maxShield) {
            shieldHeal = Math.min(totalHeal, maxShield - currentShield);
        }

        // Then heal health
        const remainingHeal = totalHeal - shieldHeal;
        if (remainingHeal > 0 && currentHealth < maxHealth) {
            healthHeal = Math.min(remainingHeal, maxHealth - currentHealth);
        }

        return { shieldHeal, healthHeal };
    }

    /**
     * Get healing state for a player
     */
    getHealingState(playerId: string): HealingState | null {
        return this.playerHealingStates.get(playerId) || null;
    }

    /**
     * Get all campfires
     */
    getCampfires(): Campfire[] {
        return this.campfires;
    }

    /**
     * Disable a campfire (destroyed)
     */
    disableCampfire(campfireId: string): void {
        const campfire = this.campfires.find(c => c.id === campfireId);
        if (campfire) {
            campfire.isActive = false;
        }
    }
}
