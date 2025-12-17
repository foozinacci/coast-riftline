// Riftline Escalation System
// Progressive match escalation based on planted relics per spec

import {
    RiftlineEscalation,
    Vector2,
    Vault,
} from '../core/types';

/**
 * Escalation configuration for each relic threshold
 */
interface EscalationTier {
    relicsRequired: number;
    globalShrinkMultiplier: number;
    stormDamageMultiplier: number;
    respawnCooldownMultiplier: number;
    relicRingShrinkRate: number;
    relicRingsDecaying: boolean;
    message: string;
}

const ESCALATION_TIERS: EscalationTier[] = [
    {
        relicsRequired: 0,
        globalShrinkMultiplier: 1.0,
        stormDamageMultiplier: 1.0,
        respawnCooldownMultiplier: 1.0,
        relicRingShrinkRate: 0,
        relicRingsDecaying: false,
        message: '',
    },
    {
        relicsRequired: 1,
        globalShrinkMultiplier: 1.2,
        stormDamageMultiplier: 1.0,
        respawnCooldownMultiplier: 1.1,
        relicRingShrinkRate: 0,
        relicRingsDecaying: false,
        message: 'FIRST RELIC PLANTED - Riftline accelerating',
    },
    {
        relicsRequired: 2,
        globalShrinkMultiplier: 1.5,
        stormDamageMultiplier: 1.5,
        respawnCooldownMultiplier: 1.25,
        relicRingShrinkRate: 0,
        relicRingsDecaying: false,
        message: 'SECOND RELIC PLANTED - Storm intensifying',
    },
    {
        relicsRequired: 3,
        globalShrinkMultiplier: 2.0,
        stormDamageMultiplier: 2.0,
        respawnCooldownMultiplier: 1.5,
        relicRingShrinkRate: 5, // Rings start shrinking
        relicRingsDecaying: true,
        message: 'THIRD RELIC PLANTED - Relic zones destabilizing',
    },
    {
        relicsRequired: 4,
        globalShrinkMultiplier: 3.0,
        stormDamageMultiplier: 3.0,
        respawnCooldownMultiplier: 2.0,
        relicRingShrinkRate: 15,
        relicRingsDecaying: true,
        message: 'FOURTH RELIC PLANTED - Final phase approaching',
    },
    {
        relicsRequired: 5,
        globalShrinkMultiplier: 5.0,
        stormDamageMultiplier: 5.0,
        respawnCooldownMultiplier: 3.0,
        relicRingShrinkRate: 999, // Instant collapse
        relicRingsDecaying: true,
        message: 'ALL RELICS PLANTED - VAULT REVEALED',
    },
];

/**
 * Riftline Escalation Manager
 */
export class RiftlineEscalationManager {
    private state: RiftlineEscalation;
    private globalCenter: Vector2;
    private globalRadius: number;
    private baseRadius: number;
    private baseShrinkRate: number;
    private vault: Vault | null = null;
    private vaultPosition: Vector2;

    private onEscalation: ((tier: number, message: string) => void) | null = null;
    private onVaultRevealed: ((vault: Vault) => void) | null = null;

    constructor(mapWidth: number, mapHeight: number) {
        this.globalCenter = { x: mapWidth / 2, y: mapHeight / 2 };
        this.baseRadius = Math.max(mapWidth, mapHeight) * 0.8;
        this.globalRadius = this.baseRadius;
        this.baseShrinkRate = 5; // Base units per second

        // Vault spawns near center with some randomness
        this.vaultPosition = {
            x: mapWidth / 2 + (Math.random() - 0.5) * 200,
            y: mapHeight / 2 + (Math.random() - 0.5) * 200,
        };

        this.state = {
            relicsPlanted: 0,
            globalShrinkMultiplier: 1.0,
            stormDamageMultiplier: 1.0,
            respawnCooldownMultiplier: 1.0,
            relicRingsDecaying: false,
        };
    }

    /**
     * Set callbacks
     */
    setOnEscalation(callback: (tier: number, message: string) => void): void {
        this.onEscalation = callback;
    }

    setOnVaultRevealed(callback: (vault: Vault) => void): void {
        this.onVaultRevealed = callback;
    }

    /**
     * Notify that a relic was planted
     */
    onRelicPlanted(): void {
        this.state.relicsPlanted++;

        // Find matching tier
        let tier: EscalationTier | null = null;
        for (const t of ESCALATION_TIERS) {
            if (t.relicsRequired === this.state.relicsPlanted) {
                tier = t;
                break;
            }
        }

        if (tier) {
            this.state.globalShrinkMultiplier = tier.globalShrinkMultiplier;
            this.state.stormDamageMultiplier = tier.stormDamageMultiplier;
            this.state.respawnCooldownMultiplier = tier.respawnCooldownMultiplier;
            this.state.relicRingsDecaying = tier.relicRingsDecaying;

            if (this.onEscalation && tier.message) {
                this.onEscalation(this.state.relicsPlanted, tier.message);
            }

            // Reveal vault on 5th relic
            if (this.state.relicsPlanted >= 5) {
                this.revealVault();
            }
        }
    }

    /**
     * Reveal the vault
     */
    private revealVault(): void {
        this.vault = {
            id: 'vault_main',
            position: { ...this.vaultPosition },
            radius: 60,
            isRevealed: true,
            isOpen: false,
            safeZoneRadius: 150,
            winningSquadId: null,
        };

        // Start converging on vault
        this.globalCenter = { ...this.vaultPosition };

        if (this.onVaultRevealed) {
            this.onVaultRevealed(this.vault);
        }
    }

    /**
     * Update the global riftline (storm)
     */
    update(deltaMs: number): void {
        const shrinkAmount = (this.baseShrinkRate * this.state.globalShrinkMultiplier * deltaMs) / 1000;

        // Minimum radius is vault safe zone or small area
        const minRadius = this.vault ? this.vault.safeZoneRadius : 100;
        this.globalRadius = Math.max(minRadius, this.globalRadius - shrinkAmount);

        // Gradually move center toward vault if revealed
        if (this.vault) {
            const lerpSpeed = 0.001 * deltaMs;
            this.globalCenter.x += (this.vault.position.x - this.globalCenter.x) * lerpSpeed;
            this.globalCenter.y += (this.vault.position.y - this.globalCenter.y) * lerpSpeed;
        }
    }

    /**
     * Check if a position is inside the global riftline (safe zone)
     */
    isInSafeZone(position: Vector2): boolean {
        const dx = position.x - this.globalCenter.x;
        const dy = position.y - this.globalCenter.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance <= this.globalRadius;
    }

    /**
     * Get storm damage at position
     */
    getStormDamage(position: Vector2, baseDamage: number): number {
        if (this.isInSafeZone(position)) return 0;
        return baseDamage * this.state.stormDamageMultiplier;
    }

    /**
     * Get respawn cooldown multiplier
     */
    getRespawnCooldownMultiplier(): number {
        return this.state.respawnCooldownMultiplier;
    }

    /**
     * Check if vault phase is active
     */
    isVaultPhase(): boolean {
        return this.vault !== null && this.vault.isRevealed;
    }

    /**
     * Player enters vault to claim victory
     */
    claimVault(squadId: string): boolean {
        if (!this.vault || !this.vault.isRevealed) return false;
        if (this.vault.isOpen) return false;

        this.vault.isOpen = true;
        this.vault.winningSquadId = squadId;
        return true;
    }

    // Getters
    getState(): RiftlineEscalation { return this.state; }
    getGlobalCenter(): Vector2 { return this.globalCenter; }
    getGlobalRadius(): number { return this.globalRadius; }
    getVault(): Vault | null { return this.vault; }
    getRelicRingShrinkRate(): number {
        const tier = ESCALATION_TIERS.find(t => t.relicsRequired === this.state.relicsPlanted);
        return tier?.relicRingShrinkRate || 0;
    }
}
