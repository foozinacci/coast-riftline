// Main Menu Screen
// Spec B.4: Options: Play, Training, Customize, Settings, Credits, Exit

import { BaseScreen, ScreenContext } from './BaseScreen';
import { AppState } from '../../core/types';

const LOGO_URL = 'https://i.ibb.co/VYbnBQjD/ei-1765901346915-removebg-preview.png';

export class MainMenu extends BaseScreen {
    private animationTime: number = 0;
    private logoImage: HTMLImageElement | null = null;
    private logoLoaded: boolean = false;
    private logoLoadFailed: boolean = false;
    private startTrainingCallback: (() => void) | null = null;

    constructor() {
        super(AppState.MAIN_MENU);
        this.loadLogo();
    }

    setStartTrainingCallback(callback: () => void): void {
        this.startTrainingCallback = callback;
    }

    private loadLogo(): void {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            this.logoImage = img;
            this.logoLoaded = true;
        };
        img.onerror = () => {
            console.warn('Failed to load logo image in MainMenu');
            this.logoLoadFailed = true;
        };
        img.src = LOGO_URL;
    }

    onEnter(): void {
        // Buttons will be laid out in first render call with screen context
        super.onEnter();
    }

    private setupButtons(ctx: ScreenContext): void {
        this.layoutButtonsVertical([
            {
                id: 'btn-play',
                label: 'PLAY',
                onSelect: () => this.navigation.navigateTo(AppState.PLAY_MENU),
            },
            {
                id: 'btn-training',
                label: 'TRAINING',
                onSelect: () => {
                    // Navigate to training setup (callback is wired in ScreenManager)
                    if (this.startTrainingCallback) {
                        this.startTrainingCallback();
                    }
                },
            },
            {
                id: 'btn-customize',
                label: 'CUSTOMIZE',
                onSelect: () => this.navigation.navigateTo(AppState.CUSTOMIZE_MENU),
            },
            {
                id: 'btn-settings',
                label: 'SETTINGS',
                onSelect: () => this.navigation.navigateTo(AppState.SETTINGS_ROOT),
            },
            {
                id: 'btn-credits',
                label: 'CREDITS',
                onSelect: () => {
                    // TODO: Credits screen
                    console.log('Credits');
                },
                disabled: true, // Not implemented yet
            },
            {
                id: 'btn-exit',
                label: 'EXIT',
                onSelect: () => this.navigation.navigateTo(AppState.EXIT_CONFIRM),
            },
        ], ctx, ctx.screenHeight * 0.3);
    }

    render(ctx: ScreenContext): void {
        const { renderer, screenWidth, screenHeight } = ctx;
        this.animationTime += 0.016;

        // Set up buttons on first render (need screen dimensions)
        if (this.focusableElements.length === 0) {
            this.setupButtons(ctx);
        }

        // Background
        renderer.drawScreenRect(0, 0, screenWidth, screenHeight, 'rgba(15, 18, 25, 1)');

        // Background grid effect
        this.renderBackgroundGrid(ctx);

        // Logo / Title
        const titleY = screenHeight * 0.15;
        if (this.logoLoaded && this.logoImage) {
            const logoSize = 100; // Slightly larger since it's the only branding
            const logoX = screenWidth / 2 - logoSize / 2;
            const logoY = titleY - logoSize / 2;

            const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
            if (canvas) {
                const ctx2d = canvas.getContext('2d');
                if (ctx2d) {
                    ctx2d.drawImage(this.logoImage, logoX, logoY, logoSize, logoSize);
                }
            }
            // Logo only - no text needed
        } else if (this.logoLoadFailed) {
            // Only show text fallback if logo actually failed to load (not during loading)
            renderer.drawScreenText(
                'RIFTLINE',
                screenWidth / 2,
                titleY,
                'rgba(100, 200, 255, 1)',
                48,
                'center',
                'middle'
            );
        }
        // If still loading, show nothing (prevents flash)

        // Render buttons
        this.renderButtons(ctx);

        // Footer hints
        const hintText = ctx.isMobile
            ? 'TAP to select'
            : 'ENTER to select • ESC to exit';

        renderer.drawScreenText(
            hintText,
            screenWidth / 2,
            screenHeight - 30,
            'rgba(100, 105, 115, 1)',
            14,
            'center',
            'middle'
        );
    }

    private renderBackgroundGrid(ctx: ScreenContext): void {
        const { renderer, screenWidth, screenHeight } = ctx;

        const gridSize = 60;
        const offset = (this.animationTime * 10) % gridSize;

        for (let x = -gridSize + offset; x < screenWidth + gridSize; x += gridSize) {
            this.drawScreenLine(renderer, x, 0, x, screenHeight, 'rgba(40, 50, 60, 0.3)', 1);
        }
        for (let y = -gridSize + offset; y < screenHeight + gridSize; y += gridSize) {
            this.drawScreenLine(renderer, 0, y, screenWidth, y, 'rgba(40, 50, 60, 0.3)', 1);
        }
    }

    handleBack(): void {
        // Per spec B.4: BACK → Exit Confirm
        this.navigation.navigateTo(AppState.EXIT_CONFIRM);
    }
}
