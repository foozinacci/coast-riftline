// Settings Root Screen
// Spec B.19: Controls, Gameplay, Audio, Video, Accessibility tabs

import { BaseScreen, ScreenContext } from './BaseScreen';
import { AppState } from '../../core/types';

export class SettingsRoot extends BaseScreen {
    constructor() {
        super(AppState.SETTINGS_ROOT);
    }

    onEnter(): void {
        super.onEnter();
    }

    private setupButtons(ctx: ScreenContext): void {
        this.layoutButtonsVertical([
            {
                id: 'btn-controls',
                label: 'CONTROLS',
                onSelect: () => this.navigation.navigateTo(AppState.CONTROLS_MENU),
            },
            {
                id: 'btn-gameplay',
                label: 'GAMEPLAY',
                onSelect: () => console.log('Gameplay settings - coming soon'),
            },
            {
                id: 'btn-audio',
                label: 'AUDIO',
                onSelect: () => this.navigation.navigateTo(AppState.AUDIO_SETTINGS),
            },
            {
                id: 'btn-video',
                label: 'VIDEO',
                onSelect: () => console.log('Video settings - coming soon'),
            },
            {
                id: 'btn-accessibility',
                label: 'ACCESSIBILITY',
                onSelect: () => console.log('Accessibility settings - coming soon'),
            },
            {
                id: 'btn-back',
                label: 'BACK',
                onSelect: () => this.navigation.goBack(),
            },
        ], ctx, ctx.screenHeight * 0.25);
    }

    render(ctx: ScreenContext): void {
        const { renderer, screenWidth, screenHeight } = ctx;

        if (this.focusableElements.length === 0) {
            this.setupButtons(ctx);
        }

        // Background
        renderer.drawScreenRect(0, 0, screenWidth, screenHeight, 'rgba(15, 18, 25, 1)');

        // Title
        this.renderTitle(ctx, 'SETTINGS');

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
