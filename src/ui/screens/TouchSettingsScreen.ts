// Touch Controls Settings Screen
// Configure touch layout and sensitivity for mobile/iOS

import { BaseScreen, ScreenContext } from './BaseScreen';
import { AppState } from '../../core/types';
import {
    getKeyBindings,
    KeyBindingsManager,
    TouchLayout,
    InputSettings,
} from '../../core/keybindings';

type TouchSetting = 'opacity' | 'scale' | 'sensitivity' | 'layout';

export class TouchSettingsScreen extends BaseScreen {
    private bindingsManager: KeyBindingsManager;
    private animationTime: number = 0;
    private settings: InputSettings;
    private layout: TouchLayout;
    private selectedSetting: TouchSetting = 'opacity';
    private isEditingLayout: boolean = false;
    private draggingElement: keyof TouchLayout | null = null;

    constructor() {
        super(AppState.SETTINGS_ROOT); // Will use proper state
        this.bindingsManager = getKeyBindings();
        this.settings = this.bindingsManager.getSettings();
        this.layout = this.bindingsManager.getTouchLayout();
    }

    onEnter(): void {
        super.onEnter();
        this.settings = this.bindingsManager.getSettings();
        this.layout = this.bindingsManager.getTouchLayout();
        this.isEditingLayout = false;
        this.draggingElement = null;
    }

    render(ctx: ScreenContext): void {
        const { renderer, screenWidth, screenHeight } = ctx;
        this.animationTime += 0.016;

        // Background
        renderer.drawScreenRect(0, 0, screenWidth, screenHeight, '#0c0e14', 'transparent', 0);

        if (this.isEditingLayout) {
            this.renderLayoutEditor(ctx);
        } else {
            this.renderSettingsMenu(ctx);
        }
    }

    private renderSettingsMenu(ctx: ScreenContext): void {
        const { renderer, screenWidth, screenHeight } = ctx;

        // Title
        renderer.drawScreenText(
            'TOUCH CONTROLS',
            screenWidth / 2,
            35,
            '#ffffff',
            24,
            'center',
            'middle'
        );

        // Back button
        renderer.drawScreenRect(15, 12, 70, 28, 'rgba(50, 50, 70, 0.8)', 'rgba(100, 150, 255, 0.4)', 1);
        renderer.drawScreenText('← BACK', 50, 26, '#ffffff', 10, 'center', 'middle');

        // Reset button
        renderer.drawScreenRect(screenWidth - 85, 12, 70, 28, 'rgba(100, 50, 50, 0.8)', 'rgba(255, 100, 100, 0.4)', 1);
        renderer.drawScreenText('RESET', screenWidth - 50, 26, '#ffaaaa', 10, 'center', 'middle');

        // Settings
        const settingsY = 80;
        const settingHeight = 60;
        const panelWidth = Math.min(400, screenWidth - 40);
        const panelX = (screenWidth - panelWidth) / 2;

        // 1. Touch Opacity
        this.renderSliderSetting(ctx, panelX, settingsY, panelWidth, {
            label: 'Button Opacity',
            value: this.settings.touchOpacity,
            min: 0.3,
            max: 1.0,
            step: 0.1,
            displayValue: `${Math.round(this.settings.touchOpacity * 100)}%`,
            isSelected: this.selectedSetting === 'opacity',
        });

        // 2. Touch Scale
        this.renderSliderSetting(ctx, panelX, settingsY + settingHeight, panelWidth, {
            label: 'Button Size',
            value: this.settings.touchScale,
            min: 0.8,
            max: 1.5,
            step: 0.1,
            displayValue: `${Math.round(this.settings.touchScale * 100)}%`,
            isSelected: this.selectedSetting === 'scale',
        });

        // 3. Look Sensitivity
        this.renderSliderSetting(ctx, panelX, settingsY + settingHeight * 2, panelWidth, {
            label: 'Look Sensitivity',
            value: this.settings.sensitivity,
            min: 0.5,
            max: 2.0,
            step: 0.1,
            displayValue: `${this.settings.sensitivity.toFixed(1)}x`,
            isSelected: this.selectedSetting === 'sensitivity',
        });

        // 4. Edit Layout button
        const layoutY = settingsY + settingHeight * 3;
        const layoutBgColor = this.selectedSetting === 'layout' ? 'rgba(80, 150, 255, 0.3)' : 'rgba(40, 50, 60, 0.8)';
        renderer.drawScreenRect(panelX, layoutY, panelWidth, 45, layoutBgColor, 'rgba(80, 100, 140, 0.5)', 1);
        renderer.drawScreenText('EDIT BUTTON LAYOUT', screenWidth / 2, layoutY + 22, '#ffffff', 12, 'center', 'middle');
        renderer.drawScreenText('Drag to reposition touch controls', screenWidth / 2, layoutY + 38, '#666666', 9, 'center', 'middle');

        // Preview
        this.renderTouchPreview(ctx, settingsY + settingHeight * 4 + 20);

        // Instructions
        renderer.drawScreenText(
            'TAP sliders to adjust • TAP EDIT LAYOUT to move buttons',
            screenWidth / 2,
            screenHeight - 25,
            '#666666',
            10,
            'center',
            'middle'
        );
    }

    private renderSliderSetting(ctx: ScreenContext, x: number, y: number, width: number, options: {
        label: string;
        value: number;
        min: number;
        max: number;
        step: number;
        displayValue: string;
        isSelected: boolean;
    }): void {
        const { renderer } = ctx;
        const { label, value, min, max, displayValue, isSelected } = options;

        // Background
        const bgColor = isSelected ? 'rgba(60, 80, 120, 0.5)' : 'rgba(40, 50, 60, 0.5)';
        renderer.drawScreenRect(x, y, width, 50, bgColor, 'transparent', 0);

        // Label
        renderer.drawScreenText(label, x + 15, y + 15, '#ffffff', 11, 'left', 'middle');

        // Value
        renderer.drawScreenText(displayValue, x + width - 15, y + 15, '#88aaff', 11, 'right', 'middle');

        // Slider track
        const trackX = x + 15;
        const trackY = y + 32;
        const trackWidth = width - 30;
        const trackHeight = 8;

        renderer.drawScreenRect(trackX, trackY, trackWidth, trackHeight, 'rgba(30, 35, 45, 0.8)', 'rgba(60, 70, 90, 0.6)', 1);

        // Slider fill
        const progress = (value - min) / (max - min);
        const fillWidth = trackWidth * progress;
        renderer.drawScreenRect(trackX, trackY, fillWidth, trackHeight, 'rgba(80, 150, 255, 0.8)', 'transparent', 0);

        // Slider thumb
        const thumbX = trackX + fillWidth - 6;
        renderer.drawScreenRect(thumbX, trackY - 2, 12, trackHeight + 4, '#ffffff', 'rgba(80, 150, 255, 0.8)', 1);

        // Minus button
        renderer.drawScreenRect(x + 5, trackY - 2, 18, 12, 'rgba(80, 80, 100, 0.8)', 'rgba(100, 100, 130, 0.6)', 1);
        renderer.drawScreenText('-', x + 14, trackY + 4, '#ffffff', 12, 'center', 'middle');

        // Plus button
        renderer.drawScreenRect(x + width - 23, trackY - 2, 18, 12, 'rgba(80, 80, 100, 0.8)', 'rgba(100, 100, 130, 0.6)', 1);
        renderer.drawScreenText('+', x + width - 14, trackY + 4, '#ffffff', 12, 'center', 'middle');
    }

    private renderTouchPreview(ctx: ScreenContext, y: number): void {
        const { renderer, screenWidth, screenHeight } = ctx;

        // Preview title
        renderer.drawScreenText('PREVIEW', screenWidth / 2, y, '#888888', 10, 'center', 'middle');

        // Preview area (scaled down)
        const previewScale = 0.3;
        const previewWidth = screenWidth * previewScale;
        const previewHeight = screenHeight * previewScale;
        const previewX = (screenWidth - previewWidth) / 2;
        const previewY = y + 15;

        // Preview background
        renderer.drawScreenRect(previewX, previewY, previewWidth, previewHeight, 'rgba(20, 25, 35, 0.9)', 'rgba(60, 70, 90, 0.5)', 1);

        // Draw touch elements at scaled positions
        const opacity = this.settings.touchOpacity;
        const scale = this.settings.touchScale;

        // Move joystick
        const moveX = previewX + this.layout.moveJoystick.x * previewWidth;
        const moveY = previewY + this.layout.moveJoystick.y * previewHeight;
        const moveRadius = this.layout.moveJoystick.radius * previewScale * scale;
        renderer.drawScreenRect(moveX - moveRadius / 2, moveY - moveRadius / 2, moveRadius, moveRadius, `rgba(80, 100, 200, ${opacity * 0.5})`, `rgba(100, 150, 255, ${opacity})`, 1);

        // Aim joystick
        const aimX = previewX + this.layout.aimJoystick.x * previewWidth;
        const aimY = previewY + this.layout.aimJoystick.y * previewHeight;
        const aimRadius = this.layout.aimJoystick.radius * previewScale * scale;
        renderer.drawScreenRect(aimX - aimRadius / 2, aimY - aimRadius / 2, aimRadius, aimRadius, `rgba(200, 80, 80, ${opacity * 0.5})`, `rgba(255, 100, 100, ${opacity})`, 1);

        // Fire button
        const fireX = previewX + this.layout.fireButton.x * previewWidth;
        const fireY = previewY + this.layout.fireButton.y * previewHeight;
        const fireRadius = this.layout.fireButton.radius * previewScale * scale;
        renderer.drawScreenRect(fireX - fireRadius / 2, fireY - fireRadius / 2, fireRadius, fireRadius, `rgba(255, 80, 80, ${opacity})`, 'transparent', 0);
    }

    private renderLayoutEditor(ctx: ScreenContext): void {
        const { renderer, screenWidth, screenHeight } = ctx;

        // Title
        renderer.drawScreenText(
            'DRAG TO REPOSITION',
            screenWidth / 2,
            30,
            '#ffffff',
            18,
            'center',
            'middle'
        );

        // Done button
        renderer.drawScreenRect(screenWidth / 2 - 50, screenHeight - 50, 100, 35, 'rgba(80, 150, 255, 0.8)', 'rgba(100, 180, 255, 0.6)', 1);
        renderer.drawScreenText('DONE', screenWidth / 2, screenHeight - 32, '#ffffff', 12, 'center', 'middle');

        // Reset button
        renderer.drawScreenRect(screenWidth / 2 - 50, screenHeight - 90, 100, 30, 'rgba(100, 50, 50, 0.8)', 'rgba(255, 100, 100, 0.4)', 1);
        renderer.drawScreenText('RESET LAYOUT', screenWidth / 2, screenHeight - 75, '#ffaaaa', 10, 'center', 'middle');

        // Draw all touch elements at full size, draggable
        this.renderDraggableElement(ctx, 'moveJoystick', 'MOVE', '#4488ff');
        this.renderDraggableElement(ctx, 'aimJoystick', 'AIM', '#ff4444');
        this.renderDraggableElement(ctx, 'fireButton', 'FIRE', '#ff6644');
        this.renderDraggableElement(ctx, 'reloadButton', 'RELOAD', '#88aa44');
        this.renderDraggableElement(ctx, 'dashButton', 'DASH', '#44aaff');
        this.renderDraggableElement(ctx, 'tacticalButton', 'ABILITY', '#aa44ff');
        this.renderDraggableElement(ctx, 'interactButton', 'INTERACT', '#ffaa44');
        this.renderDraggableElement(ctx, 'pauseButton', 'PAUSE', '#888888');
    }

    private renderDraggableElement(ctx: ScreenContext, key: keyof TouchLayout, label: string, color: string): void {
        const { renderer, screenWidth, screenHeight } = ctx;
        const element = this.layout[key];
        const scale = this.settings.touchScale;
        const opacity = this.draggingElement === key ? 1.0 : this.settings.touchOpacity;

        const x = element.x * screenWidth;
        const y = element.y * screenHeight;
        const radius = element.radius * scale;

        // Outer ring
        renderer.drawScreenRect(
            x - radius,
            y - radius,
            radius * 2,
            radius * 2,
            `rgba(40, 50, 70, ${opacity * 0.6})`,
            this.draggingElement === key ? '#ffffff' : color,
            2
        );

        // Label
        renderer.drawScreenText(label, x, y, '#ffffff', 10, 'center', 'middle');
    }

    /**
     * Handle click/tap at screen position
     */
    handleClick(x: number, y: number, screenWidth: number, screenHeight: number): boolean {
        if (this.isEditingLayout) {
            return this.handleLayoutClick(x, y, screenWidth, screenHeight);
        }

        // Back button
        if (x >= 15 && x <= 85 && y >= 12 && y <= 40) {
            this.navigation.goBack();
            return true;
        }

        // Reset button
        if (x >= screenWidth - 85 && x <= screenWidth - 15 && y >= 12 && y <= 40) {
            this.bindingsManager.resetSettings();
            this.settings = this.bindingsManager.getSettings();
            return true;
        }

        // Calculate panel dimensions
        const panelWidth = Math.min(400, screenWidth - 40);
        const panelX = (screenWidth - panelWidth) / 2;
        const settingsY = 80;
        const settingHeight = 60;

        // Check sliders
        const sliderSettings: { y: number; setting: TouchSetting; key: keyof InputSettings; min: number; max: number }[] = [
            { y: settingsY, setting: 'opacity', key: 'touchOpacity', min: 0.3, max: 1.0 },
            { y: settingsY + settingHeight, setting: 'scale', key: 'touchScale', min: 0.8, max: 1.5 },
            { y: settingsY + settingHeight * 2, setting: 'sensitivity', key: 'sensitivity', min: 0.5, max: 2.0 },
        ];

        for (const slider of sliderSettings) {
            if (y >= slider.y && y <= slider.y + 50 && x >= panelX && x <= panelX + panelWidth) {
                const trackX = panelX + 15;
                const trackWidth = panelWidth - 30;

                // Check minus button
                if (x >= panelX + 5 && x <= panelX + 23) {
                    const current = this.settings[slider.key] as number;
                    const newVal = Math.max(slider.min, current - 0.1);
                    this.bindingsManager.updateSettings({ [slider.key]: newVal });
                    this.settings = this.bindingsManager.getSettings();
                    return true;
                }

                // Check plus button
                if (x >= panelX + panelWidth - 23 && x <= panelX + panelWidth - 5) {
                    const current = this.settings[slider.key] as number;
                    const newVal = Math.min(slider.max, current + 0.1);
                    this.bindingsManager.updateSettings({ [slider.key]: newVal });
                    this.settings = this.bindingsManager.getSettings();
                    return true;
                }

                // Slider drag
                if (x >= trackX && x <= trackX + trackWidth) {
                    const progress = (x - trackX) / trackWidth;
                    const newVal = slider.min + progress * (slider.max - slider.min);
                    this.bindingsManager.updateSettings({ [slider.key]: Math.round(newVal * 10) / 10 });
                    this.settings = this.bindingsManager.getSettings();
                    return true;
                }
            }
        }

        // Edit layout button
        const layoutY = settingsY + settingHeight * 3;
        if (y >= layoutY && y <= layoutY + 45 && x >= panelX && x <= panelX + panelWidth) {
            this.isEditingLayout = true;
            return true;
        }

        return false;
    }

    private handleLayoutClick(x: number, y: number, screenWidth: number, screenHeight: number): boolean {
        // Done button
        if (y >= screenHeight - 50 && y <= screenHeight - 15 && x >= screenWidth / 2 - 50 && x <= screenWidth / 2 + 50) {
            this.isEditingLayout = false;
            return true;
        }

        // Reset layout button
        if (y >= screenHeight - 90 && y <= screenHeight - 60 && x >= screenWidth / 2 - 50 && x <= screenWidth / 2 + 50) {
            this.bindingsManager.resetTouchLayout();
            this.layout = this.bindingsManager.getTouchLayout();
            return true;
        }

        return false;
    }

    /**
     * Handle drag for layout editing
     */
    handleDrag(x: number, y: number, screenWidth: number, screenHeight: number): void {
        if (!this.isEditingLayout) return;

        // Check if dragging any element
        for (const key of Object.keys(this.layout) as (keyof TouchLayout)[]) {
            const element = this.layout[key];
            const elemX = element.x * screenWidth;
            const elemY = element.y * screenHeight;
            const radius = element.radius * this.settings.touchScale;

            const dist = Math.sqrt((x - elemX) ** 2 + (y - elemY) ** 2);
            if (dist < radius) {
                // Update position
                this.layout[key] = {
                    ...element,
                    x: Math.max(0.1, Math.min(0.9, x / screenWidth)),
                    y: Math.max(0.1, Math.min(0.9, y / screenHeight)),
                };
                this.draggingElement = key;
                this.bindingsManager.updateTouchLayout(this.layout);
                return;
            }
        }
    }

    /**
     * Handle drag end
     */
    handleDragEnd(): void {
        this.draggingElement = null;
    }

    handleBack(): void {
        if (this.isEditingLayout) {
            this.isEditingLayout = false;
        } else {
            this.navigation.goBack();
        }
    }
}
