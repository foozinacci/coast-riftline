// Title Screen - Entry point after splash
// Spec B.3: Press Start / Click → MAIN MENU, Settings shortcut → SETTINGS ROOT

import { BaseScreen, ScreenContext } from './BaseScreen';
import { AppState } from '../../core/types';

export class TitleScreen extends BaseScreen {
    private animationTime: number = 0;

    constructor() {
        super(AppState.TITLE);
    }

    onEnter(): void {
        this.layoutButtons();
        super.onEnter();
    }

    private layoutButtons(): void {
        // Title screen has no buttons - just press to start
    }

    render(ctx: ScreenContext): void {
        const { renderer, screenWidth, screenHeight } = ctx;
        this.animationTime += 0.016; // ~60fps

        // Background
        renderer.drawScreenRect(0, 0, screenWidth, screenHeight, 'rgba(15, 18, 25, 1)');

        // Animated background effects
        this.renderBackgroundEffects(ctx);

        // Logo / Title
        const titleY = screenHeight * 0.35;
        const pulseScale = 1 + Math.sin(this.animationTime * 2) * 0.02;

        renderer.drawScreenText(
            'RIFTLINE',
            screenWidth / 2,
            titleY,
            'rgba(100, 200, 255, 1)',
            Math.floor(72 * pulseScale),
            'center',
            'middle'
        );

        // Tagline
        renderer.drawScreenText(
            'Squad-Based Battle Royale',
            screenWidth / 2,
            titleY + 60,
            'rgba(150, 160, 180, 1)',
            20,
            'center',
            'middle'
        );

        // Press Start prompt (animated)
        const promptY = screenHeight * 0.65;
        const alpha = 0.5 + Math.sin(this.animationTime * 3) * 0.3;

        const promptText = ctx.isMobile ? 'TAP TO START' : 'PRESS ENTER OR CLICK TO START';
        renderer.drawScreenText(
            promptText,
            screenWidth / 2,
            promptY,
            `rgba(255, 255, 255, ${alpha})`,
            24,
            'center',
            'middle'
        );

        // Version info
        renderer.drawScreenText(
            'v0.1.0 ALPHA',
            screenWidth / 2,
            screenHeight - 40,
            'rgba(80, 85, 95, 1)',
            14,
            'center',
            'middle'
        );

        // Controls hint
        if (!ctx.isMobile) {
            const hintY = screenHeight - 80;
            renderer.drawScreenText(
                'ESC - Settings',
                screenWidth / 2,
                hintY,
                'rgba(100, 105, 115, 1)',
                14,
                'center',
                'middle'
            );
        }
    }

    private renderBackgroundEffects(ctx: ScreenContext): void {
        const { renderer, screenWidth, screenHeight } = ctx;

        // Subtle grid pattern
        const gridSize = 40;
        const gridAlpha = 0.03 + Math.sin(this.animationTime * 0.5) * 0.01;

        for (let x = 0; x < screenWidth; x += gridSize) {
            this.drawScreenLine(renderer, x, 0, x, screenHeight, `rgba(100, 150, 200, ${gridAlpha})`, 1);
        }
        for (let y = 0; y < screenHeight; y += gridSize) {
            this.drawScreenLine(renderer, 0, y, screenWidth, y, `rgba(100, 150, 200, ${gridAlpha})`, 1);
        }

        // Floating particles
        const particleCount = 15;
        for (let i = 0; i < particleCount; i++) {
            const px = (Math.sin(this.animationTime * 0.3 + i * 2) * 0.5 + 0.5) * screenWidth;
            const py = ((this.animationTime * 20 + i * 100) % (screenHeight + 50)) - 25;
            const size = 2 + Math.sin(i) * 1;
            const alpha = 0.1 + Math.sin(this.animationTime + i) * 0.05;

            this.drawScreenCircle(renderer, px, py, size, `rgba(100, 180, 255, ${alpha})`);
        }
    }

    handleConfirm(): void {
        // Navigate to main menu on any confirm action
        this.navigation.navigateTo(AppState.MAIN_MENU);
    }

    handleBack(): void {
        // Per spec B.3: BACK → Exit Confirm
        this.navigation.navigateTo(AppState.EXIT_CONFIRM);
    }
}
