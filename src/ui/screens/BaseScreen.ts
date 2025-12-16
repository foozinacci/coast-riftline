// Base Screen class for all UI screens
// Provides common functionality for focus management, rendering, and navigation

import { Renderer } from '../../core/renderer';
import { getNavigationManager, NavigationManager } from '../../core/navigation';
import { AppState, FocusState } from '../../core/types';

/**
 * Focusable element definition for UI screens.
 */
export interface FocusableElement {
    id: string;
    label: string;
    x: number;
    y: number;
    width: number;
    height: number;
    onSelect: () => void;
    disabled?: boolean;
}

/**
 * Screen render context passed to render methods.
 */
export interface ScreenContext {
    renderer: Renderer;
    screenWidth: number;
    screenHeight: number;
    focusState: FocusState;
    isMobile: boolean;
}

/**
 * Base class for all UI screens.
 * Implements focus management and consistent rendering patterns.
 */
export abstract class BaseScreen {
    protected navigation: NavigationManager;
    protected focusableElements: FocusableElement[] = [];
    protected state: AppState;

    constructor(state: AppState) {
        this.state = state;
        this.navigation = getNavigationManager();
    }

    /**
     * Called when this screen becomes active.
     * Override to set up focusable elements and initial state.
     */
    onEnter(): void {
        // Register focusable elements with navigation manager
        const elementIds = this.focusableElements.map(el => el.id);
        this.navigation.setFocusableElements(elementIds);
    }

    /**
     * Called when leaving this screen.
     * Override to clean up resources.
     */
    onExit(): void {
        // Default: nothing to clean up
    }

    /**
     * Handle confirm action on currently focused element.
     */
    handleConfirm(): void {
        const focusState = this.navigation.getFocusState();
        if (!focusState.currentFocusId) return;

        const element = this.focusableElements.find(el => el.id === focusState.currentFocusId);
        if (element && !element.disabled) {
            element.onSelect();
        }
    }

    /**
     * Handle back/cancel action.
     */
    handleBack(): void {
        this.navigation.goBack();
    }

    /**
     * Navigate focus in a direction.
     */
    navigateFocus(direction: 'up' | 'down' | 'left' | 'right'): void {
        this.navigation.navigateFocus(direction);
    }

    /**
     * Abstract render method - must be implemented by subclasses.
     */
    abstract render(ctx: ScreenContext): void;

    /**
     * Render a button with focus highlight.
     * Uses screen-space drawing methods.
     */
    protected renderButton(
        ctx: ScreenContext,
        element: FocusableElement,
        isFocused: boolean
    ): void {
        const { renderer } = ctx;
        const { x, y, width, height, label, disabled } = element;

        // Button background
        const bgColor = disabled
            ? 'rgba(60, 60, 70, 0.6)'
            : isFocused
                ? 'rgba(100, 180, 255, 0.8)'
                : 'rgba(40, 45, 55, 0.8)';

        renderer.drawScreenRect(x, y, width, height, bgColor);

        // Focus border
        if (isFocused) {
            renderer.drawScreenRect(x, y, width, height, undefined, 'rgba(150, 220, 255, 1)', 3);
        } else {
            renderer.drawScreenRect(x, y, width, height, undefined, 'rgba(80, 85, 95, 0.8)', 1);
        }

        // Label (centered in button)
        const textColor = disabled ? 'rgba(100, 100, 110, 1)' : 'rgba(255, 255, 255, 1)';
        renderer.drawScreenText(
            label,
            x + width / 2,
            y + height / 2,
            textColor,
            18,
            'center',
            'middle'
        );
    }

    /**
     * Render all registered buttons.
     */
    protected renderButtons(ctx: ScreenContext): void {
        const focusState = ctx.focusState;

        for (const element of this.focusableElements) {
            const isFocused = focusState.currentFocusId === element.id;
            this.renderButton(ctx, element, isFocused);
        }
    }

    /**
     * Render a screen title.
     */
    protected renderTitle(ctx: ScreenContext, title: string): void {
        const { renderer, screenWidth } = ctx;

        renderer.drawScreenText(
            title,
            screenWidth / 2,
            80,
            'rgba(255, 255, 255, 1)',
            36,
            'center',
            'middle'
        );
    }

    /**
     * Render a subtitle or description.
     */
    protected renderSubtitle(ctx: ScreenContext, subtitle: string, yOffset: number = 120): void {
        const { renderer, screenWidth } = ctx;

        renderer.drawScreenText(
            subtitle,
            screenWidth / 2,
            yOffset,
            'rgba(180, 185, 195, 1)',
            18,
            'center',
            'middle'
        );
    }

    /**
     * Add a focusable button element.
     */
    protected addButton(
        id: string,
        label: string,
        x: number,
        y: number,
        width: number,
        height: number,
        onSelect: () => void,
        disabled: boolean = false
    ): void {
        this.focusableElements.push({
            id,
            label,
            x,
            y,
            width,
            height,
            onSelect,
            disabled,
        });
    }

    /**
     * Clear all focusable elements.
     */
    protected clearButtons(): void {
        this.focusableElements = [];
    }

    /**
     * Create a centered vertical button layout.
     */
    protected layoutButtonsVertical(
        buttons: Array<{ id: string; label: string; onSelect: () => void; disabled?: boolean }>,
        ctx: ScreenContext,
        startY: number = 200,
        buttonWidth: number = 240,
        buttonHeight: number = 50,
        gap: number = 15
    ): void {
        this.clearButtons();

        const x = (ctx.screenWidth - buttonWidth) / 2;

        buttons.forEach((button, index) => {
            const y = startY + index * (buttonHeight + gap);
            this.addButton(
                button.id,
                button.label,
                x,
                y,
                buttonWidth,
                buttonHeight,
                button.onSelect,
                button.disabled
            );
        });

        // Re-register with navigation
        const elementIds = this.focusableElements.map(el => el.id);
        this.navigation.setFocusableElements(elementIds);
    }

    /**
     * Helper to draw a screen-space line.
     */
    protected drawScreenLine(
        renderer: Renderer,
        x1: number,
        y1: number,
        x2: number,
        y2: number,
        color: string,
        width: number = 1
    ): void {
        const ctx = renderer.getContext();
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.stroke();
    }

    /**
     * Helper to draw a screen-space circle.
     */
    protected drawScreenCircle(
        renderer: Renderer,
        x: number,
        y: number,
        radius: number,
        fillColor?: string
    ): void {
        const ctx = renderer.getContext();
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        if (fillColor) {
            ctx.fillStyle = fillColor;
            ctx.fill();
        }
    }
}
