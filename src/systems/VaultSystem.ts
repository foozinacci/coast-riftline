// Vault System - Endgame for Main Mode
// After all relics are planted, vault spawns randomly, ring closes on it

import { Vector2 } from '../core/types';
import { Renderer } from '../core/renderer';
import { randomRange, distanceVec2 } from '../core/utils';

export interface VaultState {
    isActive: boolean;
    position: Vector2;
    radius: number;
    spawnTime: number; // When vault spawned
    isRevealed: boolean;
}

/**
 * VaultManager - Handles vault spawn and endgame
 */
export class VaultManager {
    private state: VaultState;
    private mapWidth: number;
    private mapHeight: number;
    private possiblePositions: Vector2[] = [];
    private onVaultSpawn: ((position: Vector2) => void) | null = null;

    constructor(mapWidth: number, mapHeight: number) {
        this.mapWidth = mapWidth;
        this.mapHeight = mapHeight;

        this.state = {
            isActive: false,
            position: { x: mapWidth / 2, y: mapHeight / 2 },
            radius: 200,
            spawnTime: 0,
            isRevealed: false,
        };

        // Pre-generate possible vault spawn positions
        this.generatePossiblePositions();
    }

    /**
     * Generate possible vault spawn locations
     * Spread across map quadrants for variety
     */
    private generatePossiblePositions(): void {
        const margin = 400;
        const centerX = this.mapWidth / 2;
        const centerY = this.mapHeight / 2;
        const spreadX = this.mapWidth * 0.25;
        const spreadY = this.mapHeight * 0.25;

        // Center region
        this.possiblePositions.push({
            x: centerX + randomRange(-spreadX * 0.5, spreadX * 0.5),
            y: centerY + randomRange(-spreadY * 0.5, spreadY * 0.5),
        });

        // Quadrant positions
        const quadrants = [
            { x: centerX - spreadX, y: centerY - spreadY }, // Top-left
            { x: centerX + spreadX, y: centerY - spreadY }, // Top-right
            { x: centerX - spreadX, y: centerY + spreadY }, // Bottom-left
            { x: centerX + spreadX, y: centerY + spreadY }, // Bottom-right
        ];

        for (const q of quadrants) {
            this.possiblePositions.push({
                x: Math.max(margin, Math.min(this.mapWidth - margin, q.x + randomRange(-200, 200))),
                y: Math.max(margin, Math.min(this.mapHeight - margin, q.y + randomRange(-200, 200))),
            });
        }

        // Add some extra random positions
        for (let i = 0; i < 3; i++) {
            this.possiblePositions.push({
                x: randomRange(margin, this.mapWidth - margin),
                y: randomRange(margin, this.mapHeight - margin),
            });
        }
    }

    /**
     * Set callback for when vault spawns
     */
    setOnVaultSpawn(callback: (position: Vector2) => void): void {
        this.onVaultSpawn = callback;
    }

    /**
     * Spawn the vault at a random location
     */
    spawnVault(): Vector2 {
        // Pick random position from possible locations
        const index = Math.floor(Math.random() * this.possiblePositions.length);
        const position = this.possiblePositions[index];

        this.state = {
            isActive: true,
            position: { ...position },
            radius: 200,
            spawnTime: performance.now(),
            isRevealed: false,
        };

        console.log(`Vault spawned at (${position.x.toFixed(0)}, ${position.y.toFixed(0)})`);

        if (this.onVaultSpawn) {
            this.onVaultSpawn(position);
        }

        return position;
    }

    /**
     * Reveal the vault location (after animation/delay)
     */
    revealVault(): void {
        this.state.isRevealed = true;
    }

    /**
     * Check if a player is inside the vault zone
     */
    isInVaultZone(position: Vector2): boolean {
        if (!this.state.isActive) return false;
        return distanceVec2(position, this.state.position) <= this.state.radius;
    }

    /**
     * Get vault state
     */
    getState(): VaultState {
        return { ...this.state };
    }

    /**
     * Check if vault is active
     */
    isActive(): boolean {
        return this.state.isActive;
    }

    /**
     * Get vault position
     */
    getPosition(): Vector2 {
        return { ...this.state.position };
    }

    /**
     * Render the vault zone
     */
    render(renderer: Renderer): void {
        if (!this.state.isActive || !this.state.isRevealed) return;

        const { position, radius } = this.state;

        // Vault glow effect
        renderer.drawGlow(position, radius + 30, 'rgba(255, 215, 0, 0.15)');
        renderer.drawGlow(position, radius + 15, 'rgba(255, 215, 0, 0.1)');

        // Vault zone circle
        renderer.drawCircle(position, radius, 'rgba(255, 215, 0, 0.1)', '#ffd700', 3);

        // Inner vault marker
        renderer.drawCircle(position, 30, 'rgba(255, 215, 0, 0.3)', '#ffd700', 2);

        // "VAULT" label
        renderer.drawText(
            'VAULT',
            { x: position.x, y: position.y - radius - 20 },
            '#ffd700',
            16,
            'center',
            'middle'
        );
    }
}

/**
 * Generate a random vault position for the endgame
 */
export function generateRandomVaultPosition(
    mapWidth: number,
    mapHeight: number,
    avoidPositions: Vector2[] = [],
    minDistance: number = 300
): Vector2 {
    const margin = 400;
    let attempts = 0;
    const maxAttempts = 50;

    while (attempts < maxAttempts) {
        const x = randomRange(margin, mapWidth - margin);
        const y = randomRange(margin, mapHeight - margin);
        const pos = { x, y };

        // Check distance from positions to avoid
        let valid = true;
        for (const avoid of avoidPositions) {
            if (distanceVec2(pos, avoid) < minDistance) {
                valid = false;
                break;
            }
        }

        if (valid) {
            return pos;
        }

        attempts++;
    }

    // Fallback to center with offset
    return {
        x: mapWidth / 2 + randomRange(-300, 300),
        y: mapHeight / 2 + randomRange(-300, 300),
    };
}
