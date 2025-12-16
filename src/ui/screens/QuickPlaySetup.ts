// Quick Play Setup Screen
// Spec B.6: Find Match options before matchmaking

import { BaseScreen, ScreenContext } from './BaseScreen';
import { AppState } from '../../core/types';

// Callback type for starting the game
type StartGameCallback = () => void;

export class QuickPlaySetup extends BaseScreen {
    private startGameCallback: StartGameCallback | null = null;

    constructor() {
        super(AppState.QUICK_PLAY_SETUP);
    }

    /**
     * Set the callback to start the actual game.
     */
    setStartGameCallback(callback: StartGameCallback): void {
        this.startGameCallback = callback;
    }

    onEnter(): void {
        super.onEnter();
    }

    private setupButtons(ctx: ScreenContext): void {
        this.layoutButtonsVertical([
            {
                id: 'btn-find-match',
                label: 'FIND MATCH',
                onSelect: () => {
                    // For now, start the test game directly
                    // TODO: Implement actual matchmaking
                    if (this.startGameCallback) {
                        this.startGameCallback();
                        this.navigation.forceNavigateTo(AppState.IN_MATCH);
                    }
                },
            },
            {
                id: 'btn-solo-bots',
                label: 'SOLO VS BOTS',
                onSelect: () => {
                    if (this.startGameCallback) {
                        this.startGameCallback();
                        this.navigation.forceNavigateTo(AppState.IN_MATCH);
                    }
                },
            },
            {
                id: 'btn-back',
                label: 'BACK',
                onSelect: () => this.navigation.goBack(),
            },
        ], ctx, ctx.screenHeight * 0.35);
    }

    render(ctx: ScreenContext): void {
        const { renderer, screenWidth, screenHeight } = ctx;

        if (this.focusableElements.length === 0) {
            this.setupButtons(ctx);
        }

        // Background
        renderer.drawScreenRect(0, 0, screenWidth, screenHeight, 'rgba(15, 18, 25, 1)');

        // Title
        this.renderTitle(ctx, 'QUICK PLAY');
        this.renderSubtitle(ctx, 'Jump into a match');

        // Render buttons
        this.renderButtons(ctx);

        // Match info
        renderer.drawScreenText(
            '10 Teams • 3 Players Each • Last Squad Standing',
            screenWidth / 2,
            screenHeight - 80,
            'rgba(120, 140, 160, 1)',
            14,
            'center',
            'middle'
        );

        // Footer hint
        renderer.drawScreenText(
            ctx.isMobile ? 'TAP to select' : 'ENTER to select • ESC to go back',
            screenWidth / 2,
            screenHeight - 30,
            'rgba(100, 105, 115, 1)',
            14,
            'center',
            'middle'
        );
    }

    handleBack(): void {
        this.navigation.goBack();
    }
}
