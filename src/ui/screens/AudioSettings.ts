// Audio Settings Screen
// Volume controls for Music, SFX, and UI sounds

import { BaseScreen, ScreenContext, FocusableElement } from './BaseScreen';
import { AppState } from '../../core/types';
import { getAudio } from '../../core/audio';

interface SliderConfig {
    id: string;
    label: string;
    value: number;
    onChange: (value: number) => void;
    trackX?: number;
    trackY?: number;
    trackWidth?: number;
}

export class AudioSettings extends BaseScreen {
    private sliders: SliderConfig[] = [];
    private selectedSliderIndex: number = 0;
    private buttonsInitialized: boolean = false;
    private sliderWidth: number = 400;
    private sliderHeight: number = 12;
    private sliderGap: number = 70;
    private startY: number = 140;

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

        this.sliderWidth = Math.min(400, screenWidth * 0.6);

        // Add slider focusable areas (for click detection)
        this.sliders.forEach((slider, index) => {
            const y = this.startY + index * this.sliderGap;
            const x = (screenWidth - this.sliderWidth) / 2;
            const trackY = y + 25;

            // Store track position for click handling
            slider.trackX = x;
            slider.trackY = trackY;
            slider.trackWidth = this.sliderWidth;

            // Add as focusable element for click detection
            this.focusableElements.push({
                id: `slider-${slider.id}`,
                label: '',
                x: x,
                y: trackY - 10,
                width: this.sliderWidth,
                height: this.sliderHeight + 20,
                onSelect: () => {
                    this.selectedSliderIndex = index;
                },
            });
        });

        // Back button at bottom
        const btnWidth = 200;
        const btnHeight = 40;
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

        // CRITICAL: Set initial focus to the first slider, not the BACK button
        if (this.sliders.length > 0) {
            this.navigation.focusElement(`slider-${this.sliders[0].id}`);
        }

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
        this.sliders.forEach((slider, index) => {
            const y = this.startY + index * this.sliderGap;
            const x = (screenWidth - this.sliderWidth) / 2;
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
                this.sliderWidth, this.sliderHeight,
                6,
                'rgba(40, 50, 65, 0.8)',
                isSelected ? 'rgba(80, 200, 255, 0.5)' : 'rgba(60, 70, 90, 0.3)',
                isSelected ? 2 : 1
            );

            // Slider fill
            const fillWidth = this.sliderWidth * slider.value;
            if (fillWidth > 0) {
                renderer.drawScreenRoundRect(
                    x, trackY,
                    fillWidth, this.sliderHeight,
                    6,
                    isSelected ? 'rgba(80, 200, 255, 0.6)' : 'rgba(100, 150, 200, 0.4)'
                );
            }

            // Handle/knob
            const handleX = x + fillWidth;
            const handleY = trackY + this.sliderHeight / 2;
            renderer.drawScreenCircle(
                { x: handleX, y: handleY },
                isSelected ? 10 : 8,
                isSelected ? 'rgba(80, 200, 255, 1)' : 'rgba(150, 170, 200, 0.8)',
                isSelected ? 'rgba(255, 255, 255, 0.8)' : undefined,
                isSelected ? 2 : 0
            );

            // Value text
            const percent = Math.round(slider.value * 100);
            renderer.drawScreenText(
                `${percent}%`,
                screenWidth / 2,
                trackY + this.sliderHeight + 18,
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

        // Render back button only (sliders are rendered above)
        const focusState = ctx.focusState;
        const backBtn = this.focusableElements.find(el => el.id === 'btn-back');
        if (backBtn) {
            const isFocused = focusState.currentFocusId === backBtn.id;
            this.renderButton(ctx, backBtn, isFocused);
        }
    }

    // Override handleMouseMove to detect slider clicks
    handleMouseMove(x: number, y: number): void {
        // Check if mouse is over any slider
        for (let i = 0; i < this.sliders.length; i++) {
            const slider = this.sliders[i];
            if (slider.trackX !== undefined && slider.trackY !== undefined && slider.trackWidth !== undefined) {
                if (x >= slider.trackX && x <= slider.trackX + slider.trackWidth &&
                    y >= slider.trackY - 10 && y <= slider.trackY + this.sliderHeight + 10) {
                    this.selectedSliderIndex = i;
                    // Update navigation focus to this slider
                    this.navigation.focusElement(`slider-${slider.id}`);
                    return;
                }
            }
        }

        // Call parent for button handling
        super.handleMouseMove(x, y);
    }

    // Override handleConfirm to handle slider clicks differently
    handleConfirm(): void {
        const focusedId = this.navigation.getFocusState().currentFocusId;

        // If BACK button is focused, go back
        if (focusedId === 'btn-back') {
            this.navigation.goBack();
            return;
        }

        // If a slider is focused/clicked, adjust it based on mouse position
        // For now, clicking a slider just selects it (arrow keys adjust)
        // We could also implement click-to-set-value here
    }

    handleInput(input: { direction?: string; confirm?: boolean; back?: boolean }): void {
        if (input.back) {
            this.navigation.goBack();
            return;
        }

        if (input.direction === 'up') {
            this.selectedSliderIndex = Math.max(0, this.selectedSliderIndex - 1);
            const slider = this.sliders[this.selectedSliderIndex];
            if (slider) {
                this.navigation.focusElement(`slider-${slider.id}`);
            }
        } else if (input.direction === 'down') {
            // Allow moving to back button
            if (this.selectedSliderIndex < this.sliders.length - 1) {
                this.selectedSliderIndex++;
                const slider = this.sliders[this.selectedSliderIndex];
                if (slider) {
                    this.navigation.focusElement(`slider-${slider.id}`);
                }
            } else {
                // Move focus to back button
                this.navigation.focusElement('btn-back');
            }
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

        console.log(`[AudioSettings] Adjusted ${slider.id} to ${Math.round(newValue * 100)}%`);
    }

    handleBack(): void {
        this.navigation.goBack();
    }
}
