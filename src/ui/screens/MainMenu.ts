// Main Menu Screen
// Spec B.4: Options: Play, Training, Customize, Settings, Credits, Exit

import { BaseScreen, ScreenContext } from './BaseScreen';
import { AppState } from '../../core/types';

export class MainMenu extends BaseScreen {
    private animationTime: number = 0;

    constructor() {
        super(AppState.MAIN_MENU);
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
                    // TODO: Training mode - for now, start test game directly
                    console.log('Training mode - starting test game');
                },
                disabled: true, // Not implemented yet
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

        // Title
        renderer.drawScreenText(
            'RIFTLINE',
            screenWidth / 2,
            screenHeight * 0.15,
            'rgba(100, 200, 255, 1)',
            48,
            'center',
            'middle'
        );

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
