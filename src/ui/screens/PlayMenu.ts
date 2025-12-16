// Play Menu Screen
// Spec B.5: Options: Quick Play, Custom Game, Private Match, Back

import { BaseScreen, ScreenContext } from './BaseScreen';
import { AppState } from '../../core/types';

export class PlayMenu extends BaseScreen {
    constructor() {
        super(AppState.PLAY_MENU);
    }

    onEnter(): void {
        super.onEnter();
    }

    private setupButtons(ctx: ScreenContext): void {
        this.layoutButtonsVertical([
            {
                id: 'btn-quick-play',
                label: 'QUICK PLAY',
                onSelect: () => this.navigation.navigateTo(AppState.QUICK_PLAY_SETUP),
            },
            {
                id: 'btn-custom-game',
                label: 'CUSTOM GAME',
                onSelect: () => this.navigation.navigateTo(AppState.CUSTOM_GAME_BROWSER),
            },
            {
                id: 'btn-private-match',
                label: 'PRIVATE MATCH',
                onSelect: () => this.navigation.navigateTo(AppState.PRIVATE_MATCH),
            },
            {
                id: 'btn-back',
                label: 'BACK',
                onSelect: () => this.navigation.navigateTo(AppState.MAIN_MENU),
            },
        ], ctx, ctx.screenHeight * 0.35);
    }

    render(ctx: ScreenContext): void {
        const { renderer, screenWidth, screenHeight } = ctx;

        // Set up buttons on first render
        if (this.focusableElements.length === 0) {
            this.setupButtons(ctx);
        }

        // Background
        renderer.drawScreenRect(0, 0, screenWidth, screenHeight, 'rgba(15, 18, 25, 1)');

        // Title
        this.renderTitle(ctx, 'PLAY');
        this.renderSubtitle(ctx, 'Choose your game mode');

        // Render buttons
        this.renderButtons(ctx);

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
        // Per spec B.5: BACK → MAIN MENU
        this.navigation.navigateTo(AppState.MAIN_MENU);
    }
}
