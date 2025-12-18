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
        const radius = 8;

        // Button aesthetics
        let bgColor = 'rgba(30, 35, 45, 0.9)'; // Deep sleek dark
        let borderColor = 'rgba(70, 80, 100, 0.4)';
        let borderWidth = 1;
        let textColor = 'rgba(240, 240, 240, 0.9)';

        if (disabled) {
            bgColor = 'rgba(25, 25, 30, 0.5)';
            borderColor = 'rgba(50, 50, 60, 0.2)';
            textColor = 'rgba(100, 100, 110, 0.5)';
        } else if (isFocused) {
            // Vibrant interaction state
            bgColor = 'rgba(60, 140, 255, 0.15)'; // Glassy blue tint
            borderColor = 'rgba(80, 200, 255, 0.9)'; // Neon blue border
            borderWidth = 2;
            textColor = '#ffffff';
        }

        // Draw button body
        renderer.drawScreenRoundRect(
            x,
            y,
            width,
            height,
            radius,
            bgColor,
            borderColor,
            borderWidth
        );

        // Highlight/Reflection effect (top half) for "premium" feel
        if (!disabled && isFocused) {
            renderer.drawScreenRoundRect(
                x + 2,
                y + 2,
                width - 4,
                height / 2 - 2,
                radius - 2,
                'rgba(255, 255, 255, 0.05)'
            );
        }

        // Label
        renderer.drawScreenText(
            label,
            x + width / 2,
            y + height / 2,
            textColor,
            16, // Slightly smaller, more refined font size
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
     * Responsive: sizes scale with screen dimensions.
     */
    protected layoutButtonsVertical(
        buttons: Array<{ id: string; label: string; onSelect: () => void; disabled?: boolean }>,
        ctx: ScreenContext,
        startY?: number,
        buttonWidth?: number,
        buttonHeight?: number,
        gap?: number
    ): void {
        this.clearButtons();

        const { screenWidth, screenHeight } = ctx;

        // Responsive sizing based on screen dimensions
        const scale = Math.min(screenWidth / 1920, screenHeight / 1080, 1);
        const minScale = 0.5;
        const effectiveScale = Math.max(scale, minScale);

        // Calculate responsive dimensions
        const responsiveWidth = buttonWidth ?? Math.min(300 * effectiveScale, screenWidth * 0.8, 300);
        const responsiveHeight = buttonHeight ?? Math.min(50 * effectiveScale, 50);
        const responsiveGap = gap ?? Math.min(15 * effectiveScale, 15);

        // Calculate total height of all buttons
        const totalButtonsHeight = buttons.length * responsiveHeight + (buttons.length - 1) * responsiveGap;

        // Start position - center vertically if not specified, with room for logo
        const logoSpace = screenHeight * 0.25; // Reserve top 25% for logo
        const availableHeight = screenHeight - logoSpace - 60; // 60px bottom margin
        const calculatedStartY = startY ?? logoSpace + (availableHeight - totalButtonsHeight) / 2;

        const x = (screenWidth - responsiveWidth) / 2;

        buttons.forEach((button, index) => {
            const y = calculatedStartY + index * (responsiveHeight + responsiveGap);
            this.addButton(
                button.id,
                button.label,
                x,
                y,
                responsiveWidth,
                responsiveHeight,
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
    /**
     * Update focus based on mouse position.
     */
    handleMouseMove(x: number, y: number): void {
        for (const element of this.focusableElements) {
            if (
                x >= element.x &&
                x <= element.x + element.width &&
                y >= element.y &&
                y <= element.y + element.height
            ) {
                if (!element.disabled) {
                    this.navigation.focusElement(element.id);
                }
                return;
            }
        }
    }
}
