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
                id: 'btn-rifter-select',
                label: 'SELECT RIFTER',
                onSelect: () => this.navigation.navigateTo(AppState.CLASS_SELECT),
            },
            {
                id: 'btn-weapons',
                label: 'WEAPONS',
                onSelect: () => console.log('Weapons customization'),
                disabled: true, // TODO: Implement weapon selection
            },
            {
                id: 'btn-loadout-1',
                label: 'LOADOUT 1',
                onSelect: () => console.log('Loadout 1 selected'),
            },
            {
                id: 'btn-loadout-2',
                label: 'LOADOUT 2',
                onSelect: () => console.log('Loadout 2 selected'),
            },
            {
                id: 'btn-loadout-3',
                label: 'LOADOUT 3',
                onSelect: () => console.log('Loadout 3 selected'),
            },
            {
                id: 'btn-loadout-4',
                label: 'LOADOUT 4',
                onSelect: () => console.log('Loadout 4 selected'),
            },
            {
                id: 'btn-back',
                label: 'BACK',
                onSelect: () => this.navigation.goBack(),
            },
        ], ctx, ctx.screenHeight * 0.2);
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
