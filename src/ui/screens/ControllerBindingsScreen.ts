// Controller Bindings Menu Screen
// Allows rebinding gamepad inputs with visual controller layout

import { BaseScreen, ScreenContext } from './BaseScreen';
import { AppState } from '../../core/types';
import {
    getKeyBindings,
    KeyBindingsManager,
    InputAction,
    KeyBinding,
    GAMEPAD_BUTTON_NAMES,
} from '../../core/keybindings';

interface BindingRow {
    action: InputAction;
    binding: KeyBinding;
}

export class ControllerBindingsScreen extends BaseScreen {
    private bindingsManager: KeyBindingsManager;
    private animationTime: number = 0;
    private selectedIndex: number = 0;
    private isRebinding: boolean = false;
    private bindingRows: BindingRow[] = [];
    private scrollOffset: number = 0;

    constructor() {
        super(AppState.CONTROLLER_BINDINGS);
        this.bindingsManager = getKeyBindings();
    }

    onEnter(): void {
        super.onEnter();
        this.loadBindings();
        this.selectedIndex = 0;
        this.scrollOffset = 0;
        this.isRebinding = false;
    }

    private loadBindings(): void {
        const bindings = this.bindingsManager.getAllBindings('gamepad');
        this.bindingRows = [];

        // Group by category
        const categories: Record<string, InputAction[]> = {
            movement: [],
            combat: [],
            abilities: [],
            ui: [],
        };

        for (const [action, binding] of Object.entries(bindings)) {
            categories[binding.category].push(action as InputAction);
        }

        // Build rows in order
        for (const [category, actions] of Object.entries(categories)) {
            for (const action of actions) {
                this.bindingRows.push({
                    action,
                    binding: bindings[action],
                });
            }
        }
    }

    render(ctx: ScreenContext): void {
        const { renderer, screenWidth, screenHeight } = ctx;
        this.animationTime += 0.016;

        // Background
        renderer.drawScreenRect(0, 0, screenWidth, screenHeight, '#0c0e14', 'transparent', 0);

        // Title
        renderer.drawScreenText(
            'CONTROLLER',
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

        // Instructions
        const instructionText = this.isRebinding
            ? 'Press any controller button to bind'
            : 'SELECT to rebind • Press button on controller';
        renderer.drawScreenText(instructionText, screenWidth / 2, 60, '#888888', 11, 'center', 'middle');

        // Controller visual
        this.renderControllerVisual(ctx);

        // Bindings table
        this.renderBindingsTable(ctx);

        // Poll gamepad for rebinding
        if (this.isRebinding) {
            this.pollGamepadForRebind();
        }
    }

    private renderControllerVisual(ctx: ScreenContext): void {
        const { renderer, screenWidth } = ctx;
        const centerX = screenWidth / 2;
        const y = 110;

        // Simple controller outline
        renderer.drawScreenRect(centerX - 100, y, 200, 60, 'rgba(40, 45, 55, 0.8)', 'rgba(80, 100, 130, 0.5)', 2);

        // Left stick area
        renderer.drawScreenRect(centerX - 80, y + 20, 30, 30, 'rgba(60, 70, 90, 0.8)', 'rgba(100, 120, 150, 0.6)', 1);
        renderer.drawScreenText('L', centerX - 65, y + 35, '#888888', 10, 'center', 'middle');

        // Right stick area
        renderer.drawScreenRect(centerX + 50, y + 20, 30, 30, 'rgba(60, 70, 90, 0.8)', 'rgba(100, 120, 150, 0.6)', 1);
        renderer.drawScreenText('R', centerX + 65, y + 35, '#888888', 10, 'center', 'middle');

        // Face buttons
        const buttonY = y + 15;
        const buttonColors = ['#44aa44', '#dd4444', '#4444dd', '#dddd44']; // A, B, X, Y
        const buttonLabels = ['A', 'B', 'X', 'Y'];

        for (let i = 0; i < 4; i++) {
            const bx = centerX + 10 + (i % 2) * 18 - 9;
            const by = buttonY + Math.floor(i / 2) * 18;
            renderer.drawScreenRect(bx, by, 14, 14, buttonColors[i], 'transparent', 0);
            renderer.drawScreenText(buttonLabels[i], bx + 7, by + 7, '#ffffff', 8, 'center', 'middle');
        }

        // Bumpers
        renderer.drawScreenRect(centerX - 90, y + 5, 30, 10, 'rgba(80, 90, 110, 0.8)', 'transparent', 0);
        renderer.drawScreenText('LB', centerX - 75, y + 10, '#888888', 8, 'center', 'middle');
        renderer.drawScreenRect(centerX + 60, y + 5, 30, 10, 'rgba(80, 90, 110, 0.8)', 'transparent', 0);
        renderer.drawScreenText('RB', centerX + 75, y + 10, '#888888', 8, 'center', 'middle');
    }

    private renderBindingsTable(ctx: ScreenContext): void {
        const { renderer, screenWidth, screenHeight } = ctx;

        const tableY = 185;
        const rowHeight = 34;
        const maxVisible = Math.floor((screenHeight - 220) / rowHeight);
        const tableWidth = Math.min(500, screenWidth - 40);
        const tableX = (screenWidth - tableWidth) / 2;

        // Column widths
        const actionWidth = tableWidth * 0.55;
        const bindingWidth = tableWidth * 0.45;

        // Header
        renderer.drawScreenRect(tableX, tableY, tableWidth, 26, 'rgba(40, 50, 70, 0.9)', 'rgba(80, 100, 140, 0.5)', 1);
        renderer.drawScreenText('ACTION', tableX + 15, tableY + 13, '#aabbcc', 10, 'left', 'middle');
        renderer.drawScreenText('BUTTON', tableX + actionWidth + bindingWidth / 2, tableY + 13, '#aabbcc', 10, 'center', 'middle');

        // Rows
        const visible = this.bindingRows.slice(this.scrollOffset, this.scrollOffset + maxVisible);
        let currentCategory = '';

        visible.forEach((row, index) => {
            const rowIndex = this.scrollOffset + index;
            const rowY = tableY + 26 + index * rowHeight;
            const isSelected = rowIndex === this.selectedIndex;

            // Category separator
            if (row.binding.category !== currentCategory) {
                currentCategory = row.binding.category;
            }

            // Row background
            const bgAlpha = isSelected ? 0.3 : index % 2 === 0 ? 0.1 : 0.05;
            const bgColor = isSelected ? `rgba(100, 150, 255, ${bgAlpha})` : `rgba(60, 70, 90, ${bgAlpha})`;
            renderer.drawScreenRect(tableX, rowY, tableWidth, rowHeight - 2, bgColor, 'transparent', 0);

            // Selection indicator
            if (isSelected) {
                renderer.drawScreenRect(tableX, rowY, 3, rowHeight - 2, '#4488ff', 'transparent', 0);
            }

            // Action name
            renderer.drawScreenText(
                row.binding.label,
                tableX + 15,
                rowY + rowHeight / 2 - 1,
                '#ffffff',
                11,
                'left',
                'middle'
            );

            // Binding button
            const bindingX = tableX + actionWidth;
            const bindingBgColor = this.isRebinding && isSelected
                ? 'rgba(255, 200, 100, 0.3)'
                : 'rgba(40, 45, 55, 0.8)';
            renderer.drawScreenRect(bindingX + 15, rowY + 5, bindingWidth - 30, rowHeight - 12, bindingBgColor, 'rgba(80, 90, 110, 0.6)', 1);

            const bindingText = this.isRebinding && isSelected
                ? '...'
                : this.getButtonName(row.binding.gamepad);
            renderer.drawScreenText(
                bindingText,
                bindingX + bindingWidth / 2,
                rowY + rowHeight / 2 - 1,
                this.isRebinding && isSelected ? '#ffcc44' : '#aaaaaa',
                10,
                'center',
                'middle'
            );
        });

        // Scroll indicators
        if (this.scrollOffset > 0) {
            renderer.drawScreenText('▲', screenWidth - 25, tableY + 40, '#ffffff', 14, 'center', 'middle');
        }
        if (this.scrollOffset + maxVisible < this.bindingRows.length) {
            renderer.drawScreenText('▼', screenWidth - 25, screenHeight - 50, '#ffffff', 14, 'center', 'middle');
        }
    }

    private getButtonName(gamepadBinding: number | string | undefined): string {
        if (gamepadBinding === undefined) return '-';
        if (typeof gamepadBinding === 'string') return gamepadBinding;
        return GAMEPAD_BUTTON_NAMES[gamepadBinding] || `Button ${gamepadBinding}`;
    }

    private pollGamepadForRebind(): void {
        const gamepads = navigator.getGamepads();
        const gp = gamepads[0];
        if (!gp) return;

        // Check for button press
        for (let i = 0; i < gp.buttons.length; i++) {
            if (gp.buttons[i].pressed) {
                // Found a pressed button - bind it
                const row = this.bindingRows[this.selectedIndex];
                if (row) {
                    this.bindingsManager.setGamepadBinding(row.action, i);
                    this.isRebinding = false;
                    this.loadBindings();
                }
                return;
            }
        }
    }

    /**
     * Handle click at screen position
     */
    handleClick(x: number, y: number, screenWidth: number, screenHeight: number): boolean {
        // Back button
        if (x >= 15 && x <= 85 && y >= 12 && y <= 40) {
            this.navigation.goBack();
            return true;
        }

        // Reset button
        if (x >= screenWidth - 85 && x <= screenWidth - 15 && y >= 12 && y <= 40) {
            this.bindingsManager.resetBindings('gamepad');
            this.loadBindings();
            return true;
        }

        // Calculate table dimensions
        const tableY = 185;
        const rowHeight = 34;
        const tableWidth = Math.min(500, screenWidth - 40);
        const tableX = (screenWidth - tableWidth) / 2;
        const actionWidth = tableWidth * 0.55;

        // Check row clicks
        const rowIndex = Math.floor((y - tableY - 26) / rowHeight) + this.scrollOffset;

        if (rowIndex >= 0 && rowIndex < this.bindingRows.length) {
            const localX = x - tableX;

            // Check if clicking binding column
            if (localX >= actionWidth) {
                this.selectedIndex = rowIndex;
                this.isRebinding = true;
                return true;
            }
        }

        return false;
    }

    handleBack(): void {
        if (this.isRebinding) {
            this.isRebinding = false;
        } else {
            this.navigation.goBack();
        }
    }

    /**
     * Handle scroll
     */
    scroll(direction: number): void {
        const maxVisible = 8;
        this.scrollOffset = Math.max(0, Math.min(
            this.bindingRows.length - maxVisible,
            this.scrollOffset + direction
        ));
    }
}
