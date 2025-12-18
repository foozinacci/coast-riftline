// Controls Menu Screen
// Spec B.20: MKB and Controller binding options

import { BaseScreen, ScreenContext } from './BaseScreen';
import { AppState } from '../../core/types';

export class ControlsMenu extends BaseScreen {
    constructor() {
        super(AppState.CONTROLS_MENU);
    }

    onEnter(): void {
        super.onEnter();
    }

    private setupButtons(ctx: ScreenContext): void {
        this.layoutButtonsVertical([
            {
                id: 'btn-mkb',
                label: 'KEYBOARD & MOUSE',
                onSelect: () => this.navigation.navigateTo(AppState.MKB_BINDINGS),
            },
            {
                id: 'btn-controller',
                label: 'CONTROLLER',
                onSelect: () => this.navigation.navigateTo(AppState.CONTROLLER_BINDINGS),
            },
            {
                id: 'btn-touch',
                label: 'TOUCH CONTROLS',
                onSelect: () => this.navigation.navigateTo(AppState.TOUCH_SETTINGS),
            },
            {
                id: 'btn-back',
                label: 'BACK',
                onSelect: () => this.navigation.goBack(),
            },
        ], ctx, ctx.screenHeight * 0.30);
    }

    render(ctx: ScreenContext): void {
        const { renderer, screenWidth, screenHeight } = ctx;

        if (this.focusableElements.length === 0) {
            this.setupButtons(ctx);
        }

        // Background
        renderer.drawScreenRect(0, 0, screenWidth, screenHeight, 'rgba(15, 18, 25, 1)');

        // Title
        this.renderTitle(ctx, 'CONTROLS');
        this.renderSubtitle(ctx, 'Configure input bindings');

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
