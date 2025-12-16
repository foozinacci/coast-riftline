// Class Select Screen
// Spec B.18 subsection: Choose your class before matching

import { BaseScreen, ScreenContext } from './BaseScreen';
import { AppState, PlayerClass } from '../../core/types';

interface ClassInfo {
    class: PlayerClass;
    name: string;
    description: string;
    stats: {
        health: number;
        speed: number;
        damage: number;
    };
    color: string;
}

const CLASS_INFO: ClassInfo[] = [
    {
        class: PlayerClass.VANGUARD,
        name: 'VANGUARD',
        description: 'Front-line tank with high survivability',
        stats: { health: 5, speed: 2, damage: 3 },
        color: 'rgba(100, 180, 255, 1)',
    },
    {
        class: PlayerClass.SKIRMISHER,
        name: 'SKIRMISHER',
        description: 'Agile fighter with burst damage',
        stats: { health: 3, speed: 5, damage: 4 },
        color: 'rgba(255, 180, 100, 1)',
    },
    {
        class: PlayerClass.SENTINEL,
        name: 'SENTINEL',
        description: 'Support class with protective abilities',
        stats: { health: 4, speed: 3, damage: 2 },
        color: 'rgba(100, 255, 180, 1)',
    },
    {
        class: PlayerClass.CATALYST,
        name: 'CATALYST',
        description: 'Utility specialist with area control',
        stats: { health: 2, speed: 4, damage: 5 },
        color: 'rgba(255, 100, 180, 1)',
    },
];

export class ClassSelectScreen extends BaseScreen {
    private selectedIndex: number = 0;
    private animationTime: number = 0;

    constructor() {
        super(AppState.CLASS_SELECT);
    }

    onEnter(): void {
        this.selectedIndex = 0;
        this.animationTime = 0;
        super.onEnter();
    }

    private setupButtons(ctx: ScreenContext): void {
        const buttons = CLASS_INFO.map((info, index) => ({
            id: `btn-class-${index}`,
            label: info.name,
            onSelect: () => this.selectClass(index),
        }));

        buttons.push({
            id: 'btn-back',
            label: 'BACK',
            onSelect: () => this.navigation.goBack(),
        });

        this.layoutButtonsVertical(buttons, ctx, ctx.screenHeight * 0.25, 180, 45, 10);
    }

    private selectClass(index: number): void {
        this.selectedIndex = index;
        // TODO: Save selected class to player preferences
        console.log(`Selected class: ${CLASS_INFO[index].name}`);
    }

    render(ctx: ScreenContext): void {
        const { renderer, screenWidth, screenHeight } = ctx;
        this.animationTime += 0.016;

        if (this.focusableElements.length === 0) {
            this.setupButtons(ctx);
        }

        // Background
        renderer.drawScreenRect(0, 0, screenWidth, screenHeight, 'rgba(15, 18, 25, 1)');

        // Title
        this.renderTitle(ctx, 'SELECT CLASS');

        // Render buttons on left side
        this.renderButtons(ctx);

        // Render class preview on right side
        this.renderClassPreview(ctx);

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

    private renderClassPreview(ctx: ScreenContext): void {
        const { renderer, screenWidth, screenHeight, focusState } = ctx;

        // Find which class is highlighted (based on focus)
        let previewIndex = this.selectedIndex;
        if (focusState.currentFocusId) {
            const focusedIndex = CLASS_INFO.findIndex(
                (_, i) => focusState.currentFocusId === `btn-class-${i}`
            );
            if (focusedIndex >= 0) {
                previewIndex = focusedIndex;
            }
        }

        const classInfo = CLASS_INFO[previewIndex];
        if (!classInfo) return;

        // Preview panel
        const panelX = screenWidth / 2 + 40;
        const panelY = screenHeight * 0.25;
        const panelWidth = screenWidth / 2 - 80;
        const panelHeight = screenHeight * 0.5;

        renderer.drawScreenRect(panelX, panelY, panelWidth, panelHeight, 'rgba(25, 30, 40, 0.8)');
        renderer.drawScreenRect(panelX, panelY, panelWidth, panelHeight, undefined, classInfo.color, 2);

        // Class icon (simple shape for now)
        const iconX = panelX + panelWidth / 2;
        const iconY = panelY + 60;
        const iconSize = 40 + Math.sin(this.animationTime * 2) * 3;

        this.drawScreenCircle(renderer, iconX, iconY, iconSize, classInfo.color);
        renderer.drawScreenText(
            classInfo.name[0],
            iconX,
            iconY,
            'rgba(0, 0, 0, 1)',
            32,
            'center',
            'middle'
        );

        // Class name
        renderer.drawScreenText(
            classInfo.name,
            iconX,
            iconY + 70,
            classInfo.color,
            24,
            'center',
            'middle'
        );

        // Description
        renderer.drawScreenText(
            classInfo.description,
            iconX,
            iconY + 100,
            'rgba(180, 185, 195, 1)',
            14,
            'center',
            'middle'
        );

        // Stats bars
        const statsY = panelY + 180;
        const barWidth = 100;
        const barHeight = 10;
        const statLabels = ['HEALTH', 'SPEED', 'DAMAGE'];
        const statValues = [classInfo.stats.health, classInfo.stats.speed, classInfo.stats.damage];

        statLabels.forEach((label, i) => {
            const y = statsY + i * 35;

            // Label
            renderer.drawScreenText(
                label,
                panelX + 30,
                y,
                'rgba(150, 155, 165, 1)',
                12,
                'left',
                'middle'
            );

            // Bar background
            renderer.drawScreenRect(panelX + 100, y - barHeight / 2, barWidth, barHeight, 'rgba(40, 45, 55, 1)');

            // Bar fill
            const fillWidth = (statValues[i] / 5) * barWidth;
            renderer.drawScreenRect(panelX + 100, y - barHeight / 2, fillWidth, barHeight, classInfo.color);
        });

        // Selected indicator
        if (previewIndex === this.selectedIndex) {
            renderer.drawScreenText(
                '★ SELECTED ★',
                iconX,
                panelY + panelHeight - 40,
                'rgba(255, 220, 100, 1)',
                14,
                'center',
                'middle'
            );
        }
    }

    handleBack(): void {
        this.navigation.goBack();
    }
}
