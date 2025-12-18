// Keyboard & Mouse Bindings Menu Screen
// Allows rebinding all keyboard and mouse inputs

import { BaseScreen, ScreenContext } from './BaseScreen';
import { AppState } from '../../core/types';
import {
    getKeyBindings,
    KeyBindingsManager,
    InputAction,
    KeyBinding,
    KEY_DISPLAY_NAMES,
} from '../../core/keybindings';

interface BindingRow {
    action: InputAction;
    binding: KeyBinding;
}

export class MKBBindingsScreen extends BaseScreen {
    private bindingsManager: KeyBindingsManager;
    private animationTime: number = 0;
    private scrollOffset: number = 0;
    private selectedIndex: number = 0;
    private isRebinding: boolean = false;
    private rebindingSecondary: boolean = false;
    private bindingRows: BindingRow[] = [];

    constructor() {
        super(AppState.MKB_BINDINGS);
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
        const bindings = this.bindingsManager.getAllBindings('keyboard');
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
            'KEYBOARD & MOUSE',
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
            ? 'Press any key to bind (ESC to cancel)'
            : ctx.isMobile ? 'TAP to rebind' : 'CLICK to rebind • RIGHT CLICK for secondary';
        renderer.drawScreenText(instructionText, screenWidth / 2, 60, '#888888', 11, 'center', 'middle');

        // Bindings table
        this.renderBindingsTable(ctx);

        // Handle input
        this.handleInput(ctx);
    }

    private renderBindingsTable(ctx: ScreenContext): void {
        const { renderer, screenWidth, screenHeight } = ctx;

        const tableY = 85;
        const rowHeight = 36;
        const maxVisible = Math.floor((screenHeight - 130) / rowHeight);
        const tableWidth = Math.min(600, screenWidth - 40);
        const tableX = (screenWidth - tableWidth) / 2;

        // Column widths
        const actionWidth = tableWidth * 0.4;
        const primaryWidth = tableWidth * 0.3;
        const secondaryWidth = tableWidth * 0.3;

        // Header
        renderer.drawScreenRect(tableX, tableY, tableWidth, 28, 'rgba(40, 50, 70, 0.9)', 'rgba(80, 100, 140, 0.5)', 1);
        renderer.drawScreenText('ACTION', tableX + 15, tableY + 14, '#aabbcc', 10, 'left', 'middle');
        renderer.drawScreenText('PRIMARY', tableX + actionWidth + primaryWidth / 2, tableY + 14, '#aabbcc', 10, 'center', 'middle');
        renderer.drawScreenText('SECONDARY', tableX + actionWidth + primaryWidth + secondaryWidth / 2, tableY + 14, '#aabbcc', 10, 'center', 'middle');

        // Rows
        const visible = this.bindingRows.slice(this.scrollOffset, this.scrollOffset + maxVisible);
        let currentCategory = '';

        visible.forEach((row, index) => {
            const rowIndex = this.scrollOffset + index;
            const rowY = tableY + 28 + index * rowHeight;
            const isSelected = rowIndex === this.selectedIndex;

            // Category separator
            if (row.binding.category !== currentCategory) {
                currentCategory = row.binding.category;
                const catY = rowY - 6;
                renderer.drawScreenText(
                    currentCategory.toUpperCase(),
                    tableX + 8,
                    catY,
                    '#666688',
                    8,
                    'left',
                    'middle'
                );
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

            // Primary binding button
            const primaryX = tableX + actionWidth;
            const primaryBgColor = this.isRebinding && isSelected && !this.rebindingSecondary
                ? 'rgba(255, 200, 100, 0.3)'
                : 'rgba(40, 45, 55, 0.8)';
            renderer.drawScreenRect(primaryX + 10, rowY + 4, primaryWidth - 20, rowHeight - 10, primaryBgColor, 'rgba(80, 90, 110, 0.6)', 1);

            const primaryText = this.isRebinding && isSelected && !this.rebindingSecondary
                ? '...'
                : this.getDisplayName(row.binding.primary);
            renderer.drawScreenText(
                primaryText,
                primaryX + primaryWidth / 2,
                rowY + rowHeight / 2 - 1,
                this.isRebinding && isSelected && !this.rebindingSecondary ? '#ffcc44' : '#aaaaaa',
                10,
                'center',
                'middle'
            );

            // Secondary binding button
            const secondaryX = tableX + actionWidth + primaryWidth;
            const secondaryBgColor = this.isRebinding && isSelected && this.rebindingSecondary
                ? 'rgba(255, 200, 100, 0.3)'
                : 'rgba(40, 45, 55, 0.8)';
            renderer.drawScreenRect(secondaryX + 10, rowY + 4, secondaryWidth - 20, rowHeight - 10, secondaryBgColor, 'rgba(80, 90, 110, 0.6)', 1);

            const secondaryText = this.isRebinding && isSelected && this.rebindingSecondary
                ? '...'
                : this.getDisplayName(row.binding.secondary || '');
            renderer.drawScreenText(
                secondaryText || '-',
                secondaryX + secondaryWidth / 2,
                rowY + rowHeight / 2 - 1,
                this.isRebinding && isSelected && this.rebindingSecondary ? '#ffcc44' : '#666666',
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

    private getDisplayName(keyCode: string): string {
        if (!keyCode) return '';
        return KEY_DISPLAY_NAMES[keyCode] || keyCode.replace('Key', '').replace('Digit', '');
    }

    private handleInput(ctx: ScreenContext): void {
        // If rebinding, the keybindings manager handles it
        if (this.isRebinding) return;
    }

    /**
     * Handle click at screen position
     */
    handleClick(x: number, y: number, screenWidth: number, screenHeight: number, isRightClick: boolean = false): boolean {
        // Back button
        if (x >= 15 && x <= 85 && y >= 12 && y <= 40) {
            this.navigation.goBack();
            return true;
        }

        // Reset button
        if (x >= screenWidth - 85 && x <= screenWidth - 15 && y >= 12 && y <= 40) {
            this.bindingsManager.resetBindings('keyboard');
            this.loadBindings();
            return true;
        }

        // Calculate table dimensions
        const tableY = 85;
        const rowHeight = 36;
        const tableWidth = Math.min(600, screenWidth - 40);
        const tableX = (screenWidth - tableWidth) / 2;
        const actionWidth = tableWidth * 0.4;
        const primaryWidth = tableWidth * 0.3;
        const secondaryWidth = tableWidth * 0.3;

        // Check row clicks
        const rowIndex = Math.floor((y - tableY - 28) / rowHeight) + this.scrollOffset;

        if (rowIndex >= 0 && rowIndex < this.bindingRows.length) {
            const row = this.bindingRows[rowIndex];
            const localX = x - tableX;

            // Check if clicking primary or secondary column
            if (localX >= actionWidth && localX < actionWidth + primaryWidth) {
                // Primary binding
                this.selectedIndex = rowIndex;
                this.rebindingSecondary = isRightClick;
                this.startRebinding(row.action, false);
                return true;
            } else if (localX >= actionWidth + primaryWidth) {
                // Secondary binding
                this.selectedIndex = rowIndex;
                this.rebindingSecondary = true;
                this.startRebinding(row.action, true);
                return true;
            }
        }

        return false;
    }

    private startRebinding(action: InputAction, secondary: boolean): void {
        this.isRebinding = true;
        this.rebindingSecondary = secondary;

        this.bindingsManager.startRebind(action, (key: string) => {
            this.isRebinding = false;
            this.loadBindings(); // Refresh
        });
    }

    handleBack(): void {
        if (this.isRebinding) {
            this.bindingsManager.cancelRebind();
            this.isRebinding = false;
        } else {
            this.navigation.goBack();
        }
    }

    /**
     * Handle scroll
     */
    scroll(direction: number): void {
        const maxVisible = 10;
        this.scrollOffset = Math.max(0, Math.min(
            this.bindingRows.length - maxVisible,
            this.scrollOffset + direction
        ));
    }
}
