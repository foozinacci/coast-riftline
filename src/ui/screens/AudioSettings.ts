// Audio Settings Screen
// Volume controls for Music, SFX, and UI sounds

import { BaseScreen, ScreenContext } from './BaseScreen';
import { AppState } from '../../core/types';
import { getAudio } from '../../core/audio';

interface SliderConfig {
    id: string;
    label: string;
    value: number;
    onChange: (value: number) => void;
}

export class AudioSettings extends BaseScreen {
    private sliders: SliderConfig[] = [];
    private selectedSliderIndex: number = 0;
    private buttonsInitialized: boolean = false;

    constructor() {
        super(AppState.AUDIO_SETTINGS);
    }

    onEnter(): void {
        super.onEnter();
        this.buttonsInitialized = false;
        this.selectedSliderIndex = 0;

        // Initialize sliders with current audio values
        const audio = getAudio();
        this.sliders = [
            {
                id: 'master',
                label: 'MASTER VOLUME',
                value: audio.getVolume('master'),
                onChange: (v) => audio.setVolume('master', v),
            },
            {
                id: 'music',
                label: 'MUSIC',
                value: audio.getVolume('music'),
                onChange: (v) => audio.setVolume('music', v),
            },
            {
                id: 'sfx',
                label: 'SOUND EFFECTS',
                value: audio.getVolume('sfx'),
                onChange: (v) => audio.setVolume('sfx', v),
            },
            {
                id: 'ui',
                label: 'UI SOUNDS',
                value: audio.getVolume('ui'),
                onChange: (v) => audio.setVolume('ui', v),
            },
        ];
    }

    private setupButtons(ctx: ScreenContext): void {
        this.clearButtons();
        const { screenWidth, screenHeight } = ctx;
        const btnWidth = 200;
        const btnHeight = 40;

        // Back button at bottom
        this.addButton(
            'btn-back',
            '← BACK',
            (screenWidth - btnWidth) / 2,
            screenHeight - 100,
            btnWidth,
            btnHeight,
            () => this.navigation.goBack()
        );

        const elementIds = this.focusableElements.map(el => el.id);
        this.navigation.setFocusableElements(elementIds);
        this.buttonsInitialized = true;
    }

    render(ctx: ScreenContext): void {
        const { renderer, screenWidth, screenHeight } = ctx;

        if (!this.buttonsInitialized) {
            this.setupButtons(ctx);
        }

        // Background
        renderer.drawScreenRect(0, 0, screenWidth, screenHeight, '#0a0d12');

        // Title
        renderer.drawScreenText(
            'AUDIO SETTINGS',
            screenWidth / 2,
            60,
            'rgba(255, 255, 255, 0.95)',
            28,
            'center',
            'middle'
        );

        // Sliders
        const sliderWidth = Math.min(400, screenWidth * 0.6);
        const sliderHeight = 12;
        const sliderGap = 70;
        const startY = 140;

        this.sliders.forEach((slider, index) => {
            const y = startY + index * sliderGap;
            const x = (screenWidth - sliderWidth) / 2;
            const isSelected = index === this.selectedSliderIndex;

            // Label
            renderer.drawScreenText(
                slider.label,
                screenWidth / 2,
                y,
                isSelected ? 'rgba(80, 200, 255, 1)' : 'rgba(180, 190, 210, 0.9)',
                14,
                'center',
                'middle'
            );

            // Slider track
            const trackY = y + 25;
            renderer.drawScreenRoundRect(
                x, trackY,
                sliderWidth, sliderHeight,
                6,
                'rgba(40, 50, 65, 0.8)',
                isSelected ? 'rgba(80, 200, 255, 0.5)' : 'rgba(60, 70, 90, 0.3)',
                isSelected ? 2 : 1
            );

            // Slider fill
            const fillWidth = sliderWidth * slider.value;
            if (fillWidth > 0) {
                renderer.drawScreenRoundRect(
                    x, trackY,
                    fillWidth, sliderHeight,
                    6,
                    isSelected ? 'rgba(80, 200, 255, 0.6)' : 'rgba(100, 150, 200, 0.4)'
                );
            }

            // Value text
            const percent = Math.round(slider.value * 100);
            renderer.drawScreenText(
                `${percent}%`,
                screenWidth / 2,
                trackY + sliderHeight + 18,
                'rgba(120, 130, 150, 0.7)',
                12,
                'center',
                'middle'
            );
        });

        // Instructions
        renderer.drawScreenText(
            '↑↓ Select • ←→ Adjust • ESC Back',
            screenWidth / 2,
            screenHeight - 40,
            'rgba(100, 110, 130, 0.6)',
            12,
            'center',
            'middle'
        );

        // Render back button
        this.renderButtons(ctx);
    }

    handleInput(input: { direction?: string; confirm?: boolean; back?: boolean }): void {
        if (input.back) {
            this.navigation.goBack();
            return;
        }

        if (input.direction === 'up') {
            this.selectedSliderIndex = Math.max(0, this.selectedSliderIndex - 1);
        } else if (input.direction === 'down') {
            this.selectedSliderIndex = Math.min(this.sliders.length - 1, this.selectedSliderIndex + 1);
        } else if (input.direction === 'left') {
            this.adjustSlider(-0.1);
        } else if (input.direction === 'right') {
            this.adjustSlider(0.1);
        }
    }

    private adjustSlider(delta: number): void {
        const slider = this.sliders[this.selectedSliderIndex];
        if (!slider) return;

        const newValue = Math.max(0, Math.min(1, slider.value + delta));
        slider.value = newValue;
        slider.onChange(newValue);
    }

    handleBack(): void {
        this.navigation.goBack();
    }
}
