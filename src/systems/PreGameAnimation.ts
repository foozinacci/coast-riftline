// Pre-Game Animation
// Camera pan to show relics before match starts per spec

import {
    PreGameAnimation,
    Vector2,
    Relic,
} from '../core/types';

/**
 * Create initial animation state
 */
export function createPreGameAnimation(): PreGameAnimation {
    return {
        phase: 'idle',
        currentRelicIndex: 0,
        animationProgress: 0,
        cameraTarget: { x: 0, y: 0 },
    };
}

/**
 * Pre-Game Animation Manager
 */
export class PreGameAnimationManager {
    private state: PreGameAnimation;
    private playerPosition: Vector2;
    private relicPositions: Vector2[] = [];
    private phaseDurations = {
        panning_to_relics: 1500,  // 1.5s to pan to first relic
        showing_relics: 800,      // 0.8s per relic
        returning: 1500,          // 1.5s to return to player
    };
    private phaseTimer: number = 0;

    private onAnimationComplete: (() => void) | null = null;
    private onShowMessage: ((message: string) => void) | null = null;

    constructor() {
        this.state = createPreGameAnimation();
        this.playerPosition = { x: 0, y: 0 };
    }

    /**
     * Set callbacks
     */
    setOnComplete(callback: () => void): void {
        this.onAnimationComplete = callback;
    }

    setOnShowMessage(callback: (message: string) => void): void {
        this.onShowMessage = callback;
    }

    /**
     * Start the animation
     */
    start(playerPosition: Vector2, relics: Relic[]): void {
        this.playerPosition = { ...playerPosition };
        this.relicPositions = relics.map(r => ({ ...r.spawnPosition }));

        this.state = {
            phase: 'panning_to_relics',
            currentRelicIndex: 0,
            animationProgress: 0,
            cameraTarget: { ...playerPosition },
        };
        this.phaseTimer = 0;

        if (this.onShowMessage) {
            this.onShowMessage('Relic signals detected...');
        }
    }

    /**
     * Skip animation (user input)
     */
    skip(): void {
        this.state.phase = 'complete';
        this.state.cameraTarget = { ...this.playerPosition };

        if (this.onAnimationComplete) {
            this.onAnimationComplete();
        }
    }

    /**
     * Update animation state
     */
    update(deltaMs: number): Vector2 {
        if (this.state.phase === 'idle' || this.state.phase === 'complete') {
            return this.state.cameraTarget;
        }

        this.phaseTimer += deltaMs;

        switch (this.state.phase) {
            case 'panning_to_relics':
                this.updatePanningToRelics();
                break;
            case 'showing_relics':
                this.updateShowingRelics();
                break;
            case 'returning':
                this.updateReturning();
                break;
        }

        return this.state.cameraTarget;
    }

    private updatePanningToRelics(): void {
        const duration = this.phaseDurations.panning_to_relics;
        const progress = Math.min(1, this.phaseTimer / duration);

        if (this.relicPositions.length > 0) {
            // Pan from player to first relic
            const target = this.relicPositions[0];
            this.state.cameraTarget = this.lerp(this.playerPosition, target, this.easeInOut(progress));
        }

        if (progress >= 1) {
            this.state.phase = 'showing_relics';
            this.state.currentRelicIndex = 0;
            this.phaseTimer = 0;

            if (this.onShowMessage) {
                this.onShowMessage('Relics have deployed.');
            }
        }
    }

    private updateShowingRelics(): void {
        const duration = this.phaseDurations.showing_relics;
        const progress = Math.min(1, this.phaseTimer / duration);

        const currentRelic = this.relicPositions[this.state.currentRelicIndex];
        const nextIndex = this.state.currentRelicIndex + 1;

        if (nextIndex < this.relicPositions.length) {
            // Pan to next relic
            const nextRelic = this.relicPositions[nextIndex];
            this.state.cameraTarget = this.lerp(currentRelic, nextRelic, this.easeInOut(progress));
        } else {
            // Stay on last relic
            this.state.cameraTarget = { ...currentRelic };
        }

        if (progress >= 1) {
            if (nextIndex < this.relicPositions.length) {
                this.state.currentRelicIndex = nextIndex;
                this.phaseTimer = 0;
            } else {
                // All relics shown, return to player
                this.state.phase = 'returning';
                this.phaseTimer = 0;
            }
        }
    }

    private updateReturning(): void {
        const duration = this.phaseDurations.returning;
        const progress = Math.min(1, this.phaseTimer / duration);

        const lastRelic = this.relicPositions[this.relicPositions.length - 1] || this.playerPosition;
        this.state.cameraTarget = this.lerp(lastRelic, this.playerPosition, this.easeInOut(progress));

        if (progress >= 1) {
            this.state.phase = 'complete';
            this.state.cameraTarget = { ...this.playerPosition };

            if (this.onAnimationComplete) {
                this.onAnimationComplete();
            }
        }
    }

    /**
     * Linear interpolation
     */
    private lerp(from: Vector2, to: Vector2, t: number): Vector2 {
        return {
            x: from.x + (to.x - from.x) * t,
            y: from.y + (to.y - from.y) * t,
        };
    }

    /**
     * Ease in-out function
     */
    private easeInOut(t: number): number {
        return t < 0.5
            ? 2 * t * t
            : 1 - Math.pow(-2 * t + 2, 2) / 2;
    }

    /**
     * Check if animation is active
     */
    isActive(): boolean {
        return this.state.phase !== 'idle' && this.state.phase !== 'complete';
    }

    /**
     * Check if animation is complete
     */
    isComplete(): boolean {
        return this.state.phase === 'complete';
    }

    /**
     * Get current state
     */
    getState(): PreGameAnimation {
        return this.state;
    }
}
