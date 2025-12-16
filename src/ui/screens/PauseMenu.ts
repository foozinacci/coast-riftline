// Pause Menu Screen
// Spec B.14: Resume, Settings, Leave Match options

import { BaseScreen, ScreenContext } from './BaseScreen';
import { AppState, ModalType } from '../../core/types';

export class PauseMenu extends BaseScreen {
    constructor() {
        super(AppState.PAUSE_MENU);
    }

    onEnter(): void {
        super.onEnter();
    }

    private setupButtons(ctx: ScreenContext): void {
        this.layoutButtonsVertical([
            {
                id: 'btn-resume',
                label: 'RESUME',
                onSelect: () => this.navigation.navigateTo(AppState.IN_MATCH),
            },
            {
                id: 'btn-settings',
                label: 'SETTINGS',
                onSelect: () => this.navigation.navigateTo(AppState.SETTINGS_ROOT),
            },
            {
                id: 'btn-leave',
                label: 'LEAVE MATCH',
                onSelect: () => {
                    // Show exit match confirmation modal
                    this.navigation.showModal(ModalType.EXIT_MATCH_CONFIRM);
                },
            },
        ], ctx, ctx.screenHeight * 0.35);
    }

    render(ctx: ScreenContext): void {
        const { renderer, screenWidth, screenHeight } = ctx;

        // Set up buttons on first render
        if (this.focusableElements.length === 0) {
            this.setupButtons(ctx);
        }

        // Semi-transparent overlay
        renderer.drawScreenRect(0, 0, screenWidth, screenHeight, 'rgba(0, 0, 0, 0.7)');

        // Pause panel background
        const panelWidth = 300;
        const panelHeight = 350;
        const panelX = (screenWidth - panelWidth) / 2;
        const panelY = (screenHeight - panelHeight) / 2;

        renderer.drawScreenRect(panelX, panelY, panelWidth, panelHeight, 'rgba(25, 28, 35, 0.95)');
        renderer.drawScreenRect(panelX, panelY, panelWidth, panelHeight, undefined, 'rgba(80, 100, 120, 0.8)', 2);

        // Title
        renderer.drawScreenText(
            'PAUSED',
            screenWidth / 2,
            panelY + 40,
            'rgba(255, 255, 255, 1)',
            32,
            'center',
            'middle'
        );

        // Render buttons
        this.renderButtons(ctx);

        // Footer hint
        renderer.drawScreenText(
            ctx.isMobile ? 'TAP to select' : 'ESC to resume',
            screenWidth / 2,
            panelY + panelHeight - 30,
            'rgba(100, 105, 115, 1)',
            14,
            'center',
            'middle'
        );
    }

    handleBack(): void {
        // Per spec B.14: BACK → Resume (return to match)
        this.navigation.navigateTo(AppState.IN_MATCH);
    }
}
