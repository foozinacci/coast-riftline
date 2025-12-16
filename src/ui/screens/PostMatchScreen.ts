// Post-Match Screen
// Spec B.17: Shows stats, Play Again, and Back to Menu options

import { BaseScreen, ScreenContext } from './BaseScreen';
import { AppState, MatchStats } from '../../core/types';

// Callback type for replaying
type ReplayCallback = () => void;

export class PostMatchScreen extends BaseScreen {
    private isWinner: boolean = false;
    private stats: MatchStats = {
        kills: 0,
        deaths: 0,
        damageDealt: 0,
        relicsDelivered: 0,
        orbsCollected: 0,
        respawnsUsed: 0,
    };
    private replayCallback: ReplayCallback | null = null;
    private animationTime: number = 0;

    constructor() {
        super(AppState.POST_MATCH);
    }

    setMatchResult(isWinner: boolean, stats: MatchStats): void {
        this.isWinner = isWinner;
        this.stats = { ...stats };
        // Clear buttons so they get rebuilt with new data
        this.clearButtons();
    }

    setReplayCallback(callback: ReplayCallback): void {
        this.replayCallback = callback;
    }

    onEnter(): void {
        this.animationTime = 0;
        super.onEnter();
    }

    private setupButtons(ctx: ScreenContext): void {
        this.layoutButtonsVertical([
            {
                id: 'btn-play-again',
                label: 'PLAY AGAIN',
                onSelect: () => {
                    if (this.replayCallback) {
                        this.replayCallback();
                        this.navigation.forceNavigateTo(AppState.IN_MATCH);
                    }
                },
            },
            {
                id: 'btn-main-menu',
                label: 'MAIN MENU',
                onSelect: () => this.navigation.forceNavigateTo(AppState.MAIN_MENU),
            },
        ], ctx, ctx.screenHeight * 0.65, 200, 50);
    }

    render(ctx: ScreenContext): void {
        const { renderer, screenWidth, screenHeight } = ctx;
        this.animationTime += 0.016;

        if (this.focusableElements.length === 0) {
            this.setupButtons(ctx);
        }

        // Background with overlay effect
        renderer.drawScreenRect(0, 0, screenWidth, screenHeight, 'rgba(10, 12, 18, 0.95)');

        // Victory/Defeat banner
        const bannerY = screenHeight * 0.15;
        const bannerText = this.isWinner ? 'VICTORY' : 'DEFEATED';
        const bannerColor = this.isWinner ? 'rgba(100, 220, 150, 1)' : 'rgba(220, 100, 100, 1)';
        const pulseScale = 1 + Math.sin(this.animationTime * 3) * 0.02;

        renderer.drawScreenText(
            bannerText,
            screenWidth / 2,
            bannerY,
            bannerColor,
            Math.floor(56 * pulseScale),
            'center',
            'middle'
        );

        // Subtitle
        const subtitleText = this.isWinner
            ? 'Your squad was the last standing!'
            : 'Your squad was eliminated.';
        renderer.drawScreenText(
            subtitleText,
            screenWidth / 2,
            bannerY + 50,
            'rgba(180, 185, 195, 1)',
            18,
            'center',
            'middle'
        );

        // Stats panel
        const statsY = screenHeight * 0.35;
        const statsSpacing = 35;
        const statLabels = [
            { label: 'KILLS', value: this.stats.kills.toString() },
            { label: 'DEATHS', value: this.stats.deaths.toString() },
            { label: 'DAMAGE', value: Math.floor(this.stats.damageDealt).toString() },
            { label: 'RELICS DELIVERED', value: this.stats.relicsDelivered.toString() },
        ];

        renderer.drawScreenText(
            '— MATCH STATS —',
            screenWidth / 2,
            statsY - 30,
            'rgba(120, 140, 160, 1)',
            14,
            'center',
            'middle'
        );

        statLabels.forEach((stat, index) => {
            const y = statsY + index * statsSpacing;

            // Label (left side)
            renderer.drawScreenText(
                stat.label,
                screenWidth / 2 - 80,
                y,
                'rgba(150, 155, 165, 1)',
                16,
                'right',
                'middle'
            );

            // Value (right side)
            renderer.drawScreenText(
                stat.value,
                screenWidth / 2 + 80,
                y,
                'rgba(255, 255, 255, 1)',
                20,
                'left',
                'middle'
            );
        });

        // Render buttons
        this.renderButtons(ctx);

        // Footer hint
        renderer.drawScreenText(
            ctx.isMobile ? 'TAP to select' : 'ENTER to select',
            screenWidth / 2,
            screenHeight - 30,
            'rgba(100, 105, 115, 1)',
            14,
            'center',
            'middle'
        );
    }

    handleBack(): void {
        // Per spec B.17: BACK → MAIN MENU
        this.navigation.forceNavigateTo(AppState.MAIN_MENU);
    }
}
