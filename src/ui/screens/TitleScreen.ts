// Title Screen - Entry point after splash
// Spec B.3: Press Start / Click → MAIN MENU, Settings shortcut → SETTINGS ROOT

import { BaseScreen, ScreenContext } from './BaseScreen';
import { AppState } from '../../core/types';
import { initAudio, playUI, playMusic } from '../../core/audio';

const LOGO_URL = 'https://i.ibb.co/VYbnBQjD/ei-1765901346915-removebg-preview.png';

export class TitleScreen extends BaseScreen {
    private animationTime: number = 0;
    private logoImage: HTMLImageElement | null = null;
    private logoLoaded: boolean = false;
    private logoLoadFailed: boolean = false;

    constructor() {
        super(AppState.TITLE);
        this.loadLogo();
    }

    private loadLogo(): void {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            this.logoImage = img;
            this.logoLoaded = true;
        };
        img.onerror = () => {
            console.warn('Failed to load logo image');
            this.logoLoadFailed = true;
        };
        img.src = LOGO_URL;
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
        const titleY = screenHeight * 0.30;
        const pulseScale = 1 + Math.sin(this.animationTime * 2) * 0.02;

        // Render logo image if loaded, otherwise text fallback (only if load failed)
        if (this.logoLoaded && this.logoImage) {
            const logoWidth = 200 * pulseScale;
            const logoHeight = 200 * pulseScale;
            const logoX = screenWidth / 2 - logoWidth / 2;
            const logoY = titleY - logoHeight / 2;

            // Draw logo using canvas context
            const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
            if (canvas) {
                const ctx2d = canvas.getContext('2d');
                if (ctx2d) {
                    ctx2d.drawImage(this.logoImage, logoX, logoY, logoWidth, logoHeight);
                }
            }
        } else if (this.logoLoadFailed) {
            // Only show text fallback if logo failed to load
            renderer.drawScreenText(
                'RIFTLINE',
                screenWidth / 2,
                titleY,
                'rgba(100, 200, 255, 1)',
                Math.floor(72 * pulseScale),
                'center',
                'middle'
            );
        }
        // If still loading, show nothing (prevents flash)

        // Tagline
        const taglineY = this.logoLoaded ? titleY + 120 : titleY + 60;
        renderer.drawScreenText(
            'An Arcade of Arenas',
            screenWidth / 2,
            taglineY,
            'rgba(150, 160, 180, 1)',
            20,
            'center',
            'middle'
        );

        // Press Start prompt (animated)
        const promptY = screenHeight * 0.65;
        const alpha = 0.5 + Math.sin(this.animationTime * 3) * 0.3;

        const promptText = ctx.isMobile ? 'TAP TO START' : 'CLICK TO START';
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
        // Initialize audio system on first user interaction (browser requirement)
        initAudio().then(() => {
            console.log('[TitleScreen] Audio initialized');
            playUI('confirm');
            // Start lobby music immediately after audio init
            playMusic('lobby');
        });

        // Navigate to main menu on any confirm action
        this.navigation.navigateTo(AppState.MAIN_MENU);
    }

    handleBack(): void {
        // Per spec B.3: BACK → Exit Confirm
        this.navigation.navigateTo(AppState.EXIT_CONFIRM);
    }
}
