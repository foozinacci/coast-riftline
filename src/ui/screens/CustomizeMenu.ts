// Customize Menu Screen
// Spec B.18: Class selection and customization options

import { BaseScreen, ScreenContext } from './BaseScreen';
import { AppState } from '../../core/types';

export class CustomizeMenu extends BaseScreen {
    constructor() {
        super(AppState.CUSTOMIZE_MENU);
    }

    onEnter(): void {
        super.onEnter();
    }

    private setupButtons(ctx: ScreenContext): void {
        this.layoutButtonsVertical([
            {
                id: 'btn-class-select',
                label: 'SELECT CLASS',
                onSelect: () => this.navigation.navigateTo(AppState.CLASS_SELECT),
            },
            {
                id: 'btn-team-colors',
                label: 'TEAM COLORS',
                onSelect: () => console.log('Team colors'),
                disabled: true,
            },
            {
                id: 'btn-loadouts',
                label: 'LOADOUTS',
                onSelect: () => console.log('Loadouts'),
                disabled: true,
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
        this.renderTitle(ctx, 'CUSTOMIZE');
        this.renderSubtitle(ctx, 'Personalize your loadout');

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
        this.navigation.goBack();
    }
}
