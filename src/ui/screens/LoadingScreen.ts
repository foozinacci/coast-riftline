// RIFTLINE Loading Screen
// Branded loading screen with progress and tips

import { Renderer } from '../../core/renderer';

// ============================================================================
// LOADING TIPS
// ============================================================================

const LOADING_TIPS = [
    'Master the dash ability to dodge enemy fire and close gaps quickly.',
    'Collect Respawn Orbs to ensure your squad can revive fallen teammates.',
    'The Riftline expands as more relics are planted - control the zone!',
    'Medics can heal allies from a distance with their tactical ability.',
    'Scavengers move faster and can detect nearby loot through walls.',
    'Scouts deal extra damage from long range - find elevated positions.',
    'Vanguards have increased health and can absorb damage for their squad.',
    'Plant relics near squad beacons to create safe respawn zones.',
    'Watch the minimap for enemy positions when they fire weapons.',
    'Stick with your squad - lone wolves rarely survive.',
    'Reload behind cover - you\'re vulnerable while reloading.',
    'Use the environment to break line of sight during retreats.',
    'Higher Rift Tiers unlock exclusive cosmetics and ranked modes.',
    'Communication is key - use voice chat with your squad.',
    'The final Rift Core appears once all relics are planted.',
];

// ============================================================================
// LOADING SCREEN
// ============================================================================

export class LoadingScreen {
    private animationTime: number = 0;
    private progress: number = 0;
    private targetProgress: number = 0;
    private currentTip: string = '';
    private tipIndex: number = 0;
    private tipTimer: number = 0;
    private particles: { x: number; y: number; vx: number; vy: number; alpha: number; size: number }[] = [];

    // Branding colors
    private readonly PRIMARY_COLOR = '#00ccff';
    private readonly SECONDARY_COLOR = '#ff6644';
    private readonly ACCENT_COLOR = '#aa44ff';
    private readonly BG_COLOR = '#0a0c14';

    constructor() {
        this.selectRandomTip();
        this.initParticles();
    }

    private initParticles(): void {
        // Create floating rift particles
        for (let i = 0; i < 30; i++) {
            this.particles.push({
                x: Math.random(),
                y: Math.random(),
                vx: (Math.random() - 0.5) * 0.0005,
                vy: (Math.random() - 0.5) * 0.0005,
                alpha: Math.random() * 0.5 + 0.2,
                size: Math.random() * 3 + 1,
            });
        }
    }

    private selectRandomTip(): void {
        this.tipIndex = Math.floor(Math.random() * LOADING_TIPS.length);
        this.currentTip = LOADING_TIPS[this.tipIndex];
    }

    /**
     * Update loading progress (0-1)
     */
    setProgress(progress: number): void {
        this.targetProgress = Math.max(0, Math.min(1, progress));
    }

    /**
     * Update and render the loading screen
     */
    render(renderer: Renderer, screenWidth: number, screenHeight: number): void {
        this.animationTime += 0.016;

        // Smooth progress animation
        this.progress += (this.targetProgress - this.progress) * 0.1;

        // Rotate tips every 5 seconds
        this.tipTimer += 0.016;
        if (this.tipTimer > 5) {
            this.tipTimer = 0;
            this.selectRandomTip();
        }

        // Update particles
        this.updateParticles();

        // Background
        renderer.drawScreenRect(0, 0, screenWidth, screenHeight, this.BG_COLOR, 'transparent', 0);

        // Animated background grid
        this.renderGrid(renderer, screenWidth, screenHeight);

        // Rift particles
        this.renderParticles(renderer, screenWidth, screenHeight);

        // Logo and title
        this.renderLogo(renderer, screenWidth, screenHeight);

        // Progress bar
        this.renderProgressBar(renderer, screenWidth, screenHeight);

        // Loading tip
        this.renderTip(renderer, screenWidth, screenHeight);

        // Decorative elements
        this.renderDecorations(renderer, screenWidth, screenHeight);
    }

    private updateParticles(): void {
        for (const p of this.particles) {
            p.x += p.vx;
            p.y += p.vy;

            // Wrap around
            if (p.x < 0) p.x = 1;
            if (p.x > 1) p.x = 0;
            if (p.y < 0) p.y = 1;
            if (p.y > 1) p.y = 0;

            // Pulse alpha
            p.alpha = 0.3 + Math.sin(this.animationTime * 2 + p.x * 10) * 0.2;
        }
    }

    private renderGrid(renderer: Renderer, screenWidth: number, screenHeight: number): void {
        const gridSize = 40;
        const offset = (this.animationTime * 10) % gridSize;

        // Vertical lines
        for (let x = -offset; x < screenWidth; x += gridSize) {
            const alpha = 0.03 + Math.sin(x * 0.01 + this.animationTime) * 0.01;
            renderer.drawScreenRect(x, 0, 1, screenHeight, `rgba(0, 200, 255, ${alpha})`, 'transparent', 0);
        }

        // Horizontal lines
        for (let y = -offset; y < screenHeight; y += gridSize) {
            const alpha = 0.03 + Math.sin(y * 0.01 + this.animationTime) * 0.01;
            renderer.drawScreenRect(0, y, screenWidth, 1, `rgba(0, 200, 255, ${alpha})`, 'transparent', 0);
        }
    }

    private renderParticles(renderer: Renderer, screenWidth: number, screenHeight: number): void {
        for (const p of this.particles) {
            const x = p.x * screenWidth;
            const y = p.y * screenHeight;
            const size = p.size;

            // Glow effect
            renderer.drawScreenRect(
                x - size,
                y - size,
                size * 2,
                size * 2,
                `rgba(0, 200, 255, ${p.alpha * 0.3})`,
                'transparent',
                0
            );

            // Core
            renderer.drawScreenRect(
                x - size / 2,
                y - size / 2,
                size,
                size,
                `rgba(0, 255, 255, ${p.alpha})`,
                'transparent',
                0
            );
        }
    }

    private renderLogo(renderer: Renderer, screenWidth: number, screenHeight: number): void {
        const centerX = screenWidth / 2;
        const logoY = screenHeight * 0.35;

        // Rift portal effect behind logo
        const pulseScale = 1 + Math.sin(this.animationTime * 2) * 0.05;
        const portalSize = 100 * pulseScale;

        // Outer glow
        for (let i = 3; i > 0; i--) {
            const size = portalSize + i * 20;
            const alpha = 0.1 - i * 0.02;
            renderer.drawScreenRect(
                centerX - size / 2,
                logoY - size / 2,
                size,
                size,
                `rgba(0, 200, 255, ${alpha})`,
                `rgba(170, 68, 255, ${alpha})`,
                2
            );
        }

        // Inner portal
        renderer.drawScreenRect(
            centerX - portalSize / 2,
            logoY - portalSize / 2,
            portalSize,
            portalSize,
            'rgba(10, 20, 40, 0.8)',
            this.PRIMARY_COLOR,
            3
        );

        // Logo text - RIFT
        const glowAlpha = 0.3 + Math.sin(this.animationTime * 3) * 0.1;

        // Glow layer
        renderer.drawScreenText(
            'RIFT',
            centerX,
            logoY - 5,
            `rgba(0, 200, 255, ${glowAlpha})`,
            42,
            'center',
            'middle'
        );

        // Main text
        renderer.drawScreenText(
            'RIFT',
            centerX,
            logoY - 5,
            '#ffffff',
            40,
            'center',
            'middle'
        );

        // LINE text with accent
        renderer.drawScreenText(
            'LINE',
            centerX,
            logoY + 35,
            this.SECONDARY_COLOR,
            32,
            'center',
            'middle'
        );

        // Tagline
        const taglineAlpha = 0.6 + Math.sin(this.animationTime * 1.5) * 0.2;
        renderer.drawScreenText(
            'CONVERGE ON THE RIFT',
            centerX,
            logoY + 70,
            `rgba(150, 160, 180, ${taglineAlpha})`,
            12,
            'center',
            'middle'
        );
    }

    private renderProgressBar(renderer: Renderer, screenWidth: number, screenHeight: number): void {
        const barWidth = Math.min(400, screenWidth - 80);
        const barHeight = 8;
        const barX = (screenWidth - barWidth) / 2;
        const barY = screenHeight * 0.65;

        // Background
        renderer.drawScreenRect(
            barX,
            barY,
            barWidth,
            barHeight,
            'rgba(30, 35, 50, 0.8)',
            'rgba(60, 70, 100, 0.5)',
            1
        );

        // Progress fill
        const fillWidth = barWidth * this.progress;
        if (fillWidth > 0) {
            // Gradient effect via multiple rects
            const segments = 10;
            for (let i = 0; i < segments; i++) {
                const segX = barX + (fillWidth * i) / segments;
                const segWidth = fillWidth / segments;
                const hue = 180 + (i / segments) * 30; // Cyan to blue-ish
                renderer.drawScreenRect(
                    segX,
                    barY,
                    segWidth + 1,
                    barHeight,
                    `hsl(${hue}, 100%, 50%)`,
                    'transparent',
                    0
                );
            }

            // Glow at the end
            if (this.progress > 0.01) {
                renderer.drawScreenRect(
                    barX + fillWidth - 5,
                    barY - 3,
                    10,
                    barHeight + 6,
                    `rgba(0, 255, 255, ${0.5 + Math.sin(this.animationTime * 5) * 0.3})`,
                    'transparent',
                    0
                );
            }
        }

        // Percentage
        const percent = Math.round(this.progress * 100);
        renderer.drawScreenText(
            `${percent}%`,
            screenWidth / 2,
            barY + 25,
            '#ffffff',
            14,
            'center',
            'middle'
        );

        // Loading text with animated dots
        const dots = '.'.repeat(Math.floor(this.animationTime * 3) % 4);
        renderer.drawScreenText(
            `ENTERING THE RIFT${dots}`,
            screenWidth / 2,
            barY + 45,
            'rgba(150, 160, 180, 0.8)',
            11,
            'center',
            'middle'
        );
    }

    private renderTip(renderer: Renderer, screenWidth: number, screenHeight: number): void {
        const tipY = screenHeight * 0.82;
        const maxWidth = Math.min(500, screenWidth - 60);

        // Tip label
        renderer.drawScreenText(
            '💡 TIP',
            screenWidth / 2,
            tipY - 20,
            this.PRIMARY_COLOR,
            10,
            'center',
            'middle'
        );

        // Tip text (wrapped if needed)
        const tipLines = this.wrapText(this.currentTip, 50);
        tipLines.forEach((line, index) => {
            renderer.drawScreenText(
                line,
                screenWidth / 2,
                tipY + index * 18,
                'rgba(200, 210, 220, 0.9)',
                12,
                'center',
                'middle'
            );
        });
    }

    private wrapText(text: string, maxChars: number): string[] {
        const words = text.split(' ');
        const lines: string[] = [];
        let currentLine = '';

        for (const word of words) {
            if ((currentLine + ' ' + word).length > maxChars) {
                if (currentLine) lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = currentLine ? currentLine + ' ' + word : word;
            }
        }
        if (currentLine) lines.push(currentLine);
        return lines;
    }

    private renderDecorations(renderer: Renderer, screenWidth: number, screenHeight: number): void {
        // Corner brackets
        const bracketSize = 30;
        const bracketThickness = 2;
        const margin = 20;

        // Top-left
        renderer.drawScreenRect(margin, margin, bracketSize, bracketThickness, this.PRIMARY_COLOR, 'transparent', 0);
        renderer.drawScreenRect(margin, margin, bracketThickness, bracketSize, this.PRIMARY_COLOR, 'transparent', 0);

        // Top-right
        renderer.drawScreenRect(screenWidth - margin - bracketSize, margin, bracketSize, bracketThickness, this.PRIMARY_COLOR, 'transparent', 0);
        renderer.drawScreenRect(screenWidth - margin - bracketThickness, margin, bracketThickness, bracketSize, this.PRIMARY_COLOR, 'transparent', 0);

        // Bottom-left
        renderer.drawScreenRect(margin, screenHeight - margin - bracketThickness, bracketSize, bracketThickness, this.SECONDARY_COLOR, 'transparent', 0);
        renderer.drawScreenRect(margin, screenHeight - margin - bracketSize, bracketThickness, bracketSize, this.SECONDARY_COLOR, 'transparent', 0);

        // Bottom-right
        renderer.drawScreenRect(screenWidth - margin - bracketSize, screenHeight - margin - bracketThickness, bracketSize, bracketThickness, this.SECONDARY_COLOR, 'transparent', 0);
        renderer.drawScreenRect(screenWidth - margin - bracketThickness, screenHeight - margin - bracketSize, bracketThickness, bracketSize, this.SECONDARY_COLOR, 'transparent', 0);

        // Version info
        renderer.drawScreenText(
            'v0.1.0 ALPHA',
            screenWidth - 25,
            screenHeight - 15,
            'rgba(80, 90, 110, 0.6)',
            9,
            'right',
            'middle'
        );

        // Animated scan line
        const scanY = (this.animationTime * 100) % screenHeight;
        renderer.drawScreenRect(0, scanY, screenWidth, 2, `rgba(0, 200, 255, 0.1)`, 'transparent', 0);
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

let loadingScreen: LoadingScreen | null = null;

/**
 * Get loading screen instance
 */
export function getLoadingScreen(): LoadingScreen {
    if (!loadingScreen) {
        loadingScreen = new LoadingScreen();
    }
    return loadingScreen;
}

/**
 * Show loading screen
 */
export function showLoading(renderer: Renderer, screenWidth: number, screenHeight: number, progress: number = 0): void {
    const screen = getLoadingScreen();
    screen.setProgress(progress);
    screen.render(renderer, screenWidth, screenHeight);
}
