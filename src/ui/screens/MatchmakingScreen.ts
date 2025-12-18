// Matchmaking Screen
// Shows queue status while searching for a match

import { BaseScreen, ScreenContext } from './BaseScreen';
import { AppState, GameMode } from '../../core/types';

export class MatchmakingScreen extends BaseScreen {
    private queueStartTime: number = 0;
    private searchingDots: string = '';
    private animationTime: number = 0;
    private selectedMode: GameMode = GameMode.MAIN;
    private isRanked: boolean = false;

    constructor() {
        super(AppState.MATCHMAKING);
    }

    onEnter(): void {
        super.onEnter();
        this.queueStartTime = Date.now();
        this.animationTime = 0;
    }

    setMode(mode: GameMode, ranked: boolean): void {
        this.selectedMode = mode;
        this.isRanked = ranked;
    }

    render(ctx: ScreenContext): void {
        const { renderer, screenWidth, screenHeight } = ctx;

        // Background
        renderer.drawScreenRect(0, 0, screenWidth, screenHeight, '#0a0d12');

        // Animated background pattern
        this.animationTime += 0.016;
        this.renderBackgroundPattern(ctx);

        // Queue time
        const elapsed = Math.floor((Date.now() - this.queueStartTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

        // Mode info
        const modeLabel = this.getModeLabel();
        renderer.drawScreenText(
            modeLabel,
            screenWidth / 2,
            screenHeight * 0.35,
            'rgba(100, 200, 255, 0.9)',
            28,
            'center',
            'middle'
        );

        // Searching text with animated dots
        const dotCount = Math.floor((this.animationTime * 2) % 4);
        this.searchingDots = '.'.repeat(dotCount);

        renderer.drawScreenText(
            `SEARCHING FOR MATCH${this.searchingDots}`,
            screenWidth / 2,
            screenHeight * 0.45,
            'rgba(255, 255, 255, 0.8)',
            22,
            'center',
            'middle'
        );

        // Time in queue
        renderer.drawScreenText(
            `Time in queue: ${timeStr}`,
            screenWidth / 2,
            screenHeight * 0.52,
            'rgba(120, 130, 150, 0.7)',
            16,
            'center',
            'middle'
        );

        // Estimated wait
        renderer.drawScreenText(
            'Estimated wait: < 1 min',
            screenWidth / 2,
            screenHeight * 0.58,
            'rgba(100, 120, 140, 0.5)',
            14,
            'center',
            'middle'
        );

        // Spinning loader
        this.renderSpinner(ctx, screenWidth / 2, screenHeight * 0.72, 40);

        // Cancel button
        const btnWidth = 160;
        const btnHeight = 45;
        const btnX = (screenWidth - btnWidth) / 2;
        const btnY = screenHeight * 0.82;

        renderer.drawScreenRoundRect(
            btnX, btnY, btnWidth, btnHeight, 6,
            'rgba(140, 60, 60, 0.3)',
            'rgba(180, 80, 80, 0.6)', 2
        );
        renderer.drawScreenText(
            'CANCEL',
            screenWidth / 2,
            btnY + btnHeight / 2,
            'rgba(255, 180, 180, 0.9)',
            16,
            'center',
            'middle'
        );

        if (!this.focusableElements.find(e => e.id === 'btn-cancel')) {
            this.addButton('btn-cancel', 'CANCEL', btnX, btnY, btnWidth, btnHeight,
                () => this.handleBack());
        }

        // ESC hint
        renderer.drawScreenText(
            'Press ESC to cancel',
            screenWidth / 2,
            screenHeight - 30,
            'rgba(80, 90, 110, 0.5)',
            12,
            'center',
            'middle'
        );
    }

    private getModeLabel(): string {
        const ranked = this.isRanked ? 'RANKED ' : '';
        switch (this.selectedMode) {
            case GameMode.MAIN: return `${ranked}RIFTLINE`;
            case GameMode.ARENA_1V1: return `${ranked}DUEL`;
            case GameMode.ARENA_1V1V1: return `${ranked}BRAWL`;
            case GameMode.ARENA_3V3: return `${ranked}SKIRMISH`;
            case GameMode.ARENA_3V3V3: return `${ranked}FRACAS`;
            default: return `${ranked}MATCH`;
        }
    }

    private renderBackgroundPattern(ctx: ScreenContext): void {
        const { renderer, screenWidth, screenHeight } = ctx;

        // Subtle hex grid pattern
        const cellSize = 60;
        const t = this.animationTime * 0.5;

        for (let y = 0; y < screenHeight + cellSize; y += cellSize * 0.866) {
            for (let x = 0; x < screenWidth + cellSize; x += cellSize * 1.5) {
                const offsetX = ((y / cellSize) % 2) * cellSize * 0.75;
                const px = x + offsetX;
                const py = y;

                const dist = Math.sqrt(
                    Math.pow(px - screenWidth / 2, 2) +
                    Math.pow(py - screenHeight * 0.5, 2)
                );
                const wave = Math.sin(dist * 0.01 - t) * 0.5 + 0.5;
                const alpha = 0.02 + wave * 0.03;

                renderer.drawScreenRoundRect(
                    px - 3, py - 3, 6, 6, 2,
                    `rgba(100, 180, 255, ${alpha})`
                );
            }
        }
    }

    private renderSpinner(ctx: ScreenContext, x: number, y: number, radius: number): void {
        const { renderer } = ctx;
        const segments = 12;
        const t = this.animationTime * 4;

        for (let i = 0; i < segments; i++) {
            const angle = (i / segments) * Math.PI * 2 - Math.PI / 2;
            const progress = (i / segments + t) % 1;
            const alpha = 0.1 + progress * 0.6;

            const segX = x + Math.cos(angle) * radius;
            const segY = y + Math.sin(angle) * radius;

            renderer.drawScreenRoundRect(
                segX - 4, segY - 4, 8, 8, 4,
                `rgba(100, 200, 255, ${alpha})`
            );
        }
    }

    handleBack(): void {
        // Cancel matchmaking, return to main menu
        console.log('[Matchmaking] Cancelled');
        this.navigation.navigateTo(AppState.MAIN_MENU);
    }
}
