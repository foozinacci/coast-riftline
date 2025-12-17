// Debug Overlay - Performance monitoring and debugging tools

import { Renderer } from '../core/renderer';
import { Vector2 } from '../core/types';

export interface DebugStats {
    fps: number;
    frameTime: number;
    entityCount: number;
    projectileCount: number;
    playerCount: number;
    memoryUsage: number; // MB (if available)
}

export class DebugOverlay {
    private enabled: boolean = false;
    private showFPS: boolean = true;
    private showEntityCounts: boolean = true;
    private showMemory: boolean = true;
    private showGrid: boolean = false;

    // FPS calculation
    private frameTimestamps: number[] = [];
    private lastFrameTime: number = 0;
    private currentFPS: number = 60;
    private avgFrameTime: number = 16.67;

    // Stats
    private stats: DebugStats = {
        fps: 60,
        frameTime: 16.67,
        entityCount: 0,
        projectileCount: 0,
        playerCount: 0,
        memoryUsage: 0,
    };

    // Warnings/Alerts
    private warnings: string[] = [];
    private warningTimeout: number = 3000;
    private warningTimestamps: number[] = [];

    constructor() {
        // Check if debug mode should be enabled via URL param or localStorage
        const urlParams = new URLSearchParams(window.location.search);
        this.enabled = urlParams.get('debug') === 'true' ||
            localStorage.getItem('riftline_debug') === 'true';
    }

    toggle(): void {
        this.enabled = !this.enabled;
        localStorage.setItem('riftline_debug', this.enabled.toString());
        console.log(`Debug overlay: ${this.enabled ? 'ENABLED' : 'DISABLED'}`);
    }

    isEnabled(): boolean {
        return this.enabled;
    }

    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
        localStorage.setItem('riftline_debug', enabled.toString());
    }

    /**
     * Call at the start of each frame to track timing
     */
    beginFrame(): void {
        const now = performance.now();
        if (this.lastFrameTime > 0) {
            const delta = now - this.lastFrameTime;
            this.frameTimestamps.push(now);

            // Keep only last 60 frames for averaging
            while (this.frameTimestamps.length > 60) {
                this.frameTimestamps.shift();
            }

            // Calculate FPS from timestamps
            if (this.frameTimestamps.length >= 2) {
                const oldestTime = this.frameTimestamps[0];
                const newestTime = this.frameTimestamps[this.frameTimestamps.length - 1];
                const elapsed = newestTime - oldestTime;
                if (elapsed > 0) {
                    this.currentFPS = ((this.frameTimestamps.length - 1) / elapsed) * 1000;
                    this.avgFrameTime = elapsed / (this.frameTimestamps.length - 1);
                }
            }

            // Check for frame time spikes
            if (delta > 50) {
                this.addWarning(`Frame spike: ${delta.toFixed(1)}ms`);
            }
        }
        this.lastFrameTime = now;
    }

    /**
     * Update stats from game state
     */
    updateStats(stats: Partial<DebugStats>): void {
        Object.assign(this.stats, stats);
        this.stats.fps = Math.round(this.currentFPS);
        this.stats.frameTime = this.avgFrameTime;

        // Try to get memory usage (Chrome only)
        if ((performance as any).memory) {
            this.stats.memoryUsage = (performance as any).memory.usedJSHeapSize / (1024 * 1024);
        }
    }

    addWarning(message: string): void {
        const now = Date.now();
        this.warnings.push(message);
        this.warningTimestamps.push(now);

        // Keep only recent warnings
        while (this.warningTimestamps.length > 0 &&
            now - this.warningTimestamps[0] > this.warningTimeout) {
            this.warnings.shift();
            this.warningTimestamps.shift();
        }

        console.warn(`[DEBUG] ${message}`);
    }

    /**
     * Render debug overlay on screen
     */
    render(renderer: Renderer): void {
        if (!this.enabled) return;

        const screen = renderer.getScreenSize();
        const x = 10;
        let y = 10;
        const lineHeight = 18;

        // Semi-transparent background
        renderer.drawScreenRect(5, 5, 200, 150, 'rgba(0, 0, 0, 0.7)');

        // Title
        renderer.drawScreenText('DEBUG', x, y, '#ffaa00', 14, 'left', 'top');
        y += lineHeight;

        // FPS
        if (this.showFPS) {
            const fpsColor = this.stats.fps >= 55 ? '#44ff44' :
                this.stats.fps >= 30 ? '#ffaa44' : '#ff4444';
            renderer.drawScreenText(
                `FPS: ${this.stats.fps} (${this.stats.frameTime.toFixed(1)}ms)`,
                x, y, fpsColor, 12, 'left', 'top'
            );
            y += lineHeight;
        }

        // Entity counts
        if (this.showEntityCounts) {
            renderer.drawScreenText(
                `Players: ${this.stats.playerCount}`,
                x, y, '#aaaaff', 12, 'left', 'top'
            );
            y += lineHeight;
            renderer.drawScreenText(
                `Projectiles: ${this.stats.projectileCount}`,
                x, y, '#aaaaff', 12, 'left', 'top'
            );
            y += lineHeight;
            renderer.drawScreenText(
                `Entities: ${this.stats.entityCount}`,
                x, y, '#aaaaff', 12, 'left', 'top'
            );
            y += lineHeight;
        }

        // Memory
        if (this.showMemory && this.stats.memoryUsage > 0) {
            const memColor = this.stats.memoryUsage < 100 ? '#44ff44' :
                this.stats.memoryUsage < 200 ? '#ffaa44' : '#ff4444';
            renderer.drawScreenText(
                `Memory: ${this.stats.memoryUsage.toFixed(1)} MB`,
                x, y, memColor, 12, 'left', 'top'
            );
            y += lineHeight;
        }

        // Warnings
        if (this.warnings.length > 0) {
            const now = Date.now();
            let warningY = screen.y - 30;

            for (let i = this.warnings.length - 1; i >= 0; i--) {
                const age = now - this.warningTimestamps[i];
                const alpha = Math.max(0, 1 - age / this.warningTimeout);

                renderer.drawScreenText(
                    `⚠ ${this.warnings[i]}`,
                    screen.x / 2,
                    warningY,
                    `rgba(255, 200, 50, ${alpha})`,
                    14,
                    'center',
                    'middle'
                );
                warningY -= 20;
            }
        }

        // Controls hint
        renderer.drawScreenText(
            'F3: Toggle Debug | F4: Observer',
            screen.x - 10,
            screen.y - 10,
            'rgba(100, 100, 100, 0.5)',
            10,
            'right',
            'bottom'
        );
    }
}

// Singleton instance
let debugOverlayInstance: DebugOverlay | null = null;

export function getDebugOverlay(): DebugOverlay {
    if (!debugOverlayInstance) {
        debugOverlayInstance = new DebugOverlay();
    }
    return debugOverlayInstance;
}
