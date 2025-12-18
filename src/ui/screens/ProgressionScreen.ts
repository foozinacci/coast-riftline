// Progression Screen UI - Shows player XP, levels, and Rift Tier
// Displays class mastery, weapon mastery, and ranked status

import { BaseScreen, ScreenContext } from './BaseScreen';
import { AppState, PlayerClass } from '../../core/types';
import { getNavigationManager } from '../../core/navigation';
import {
    MAX_CLASS_LEVEL,
    MAX_WEAPON_LEVEL,
    getLevelFromXP,
    getLevelProgress,
    getRiftTierName,
    canAccessRanked,
    RIFT_TIER_NAMES,
    PlayerProgression,
    createNewProgression,
    getTotalXPForLevel,
} from '../../systems/progression';
import { supabaseService } from '../../network/supabase';

/**
 * Progression Screen - Shows player's progression info
 */
export class ProgressionScreen extends BaseScreen {
    private animationTime: number = 0;
    private progression: PlayerProgression | null = null;
    private isLoading: boolean = true;
    private error: string | null = null;

    // UI state
    private activeTab: 'overview' | 'classes' | 'weapons' = 'overview';
    private selectedClass: PlayerClass | null = null;
    private selectedWeapon: string | null = null;

    constructor() {
        super(AppState.PROFILE);
    }

    onEnter(): void {
        super.onEnter();
        this.loadProgression();
    }

    private async loadProgression(): Promise<void> {
        this.isLoading = true;
        this.error = null;

        try {
            const user = supabaseService.getCurrentUser();

            if (!user) {
                // Use demo progression for offline/unauthenticated users
                this.progression = this.createDemoProgression();
                this.isLoading = false;
                return;
            }

            // TODO: Load from Supabase when tables are set up
            // For now, use demo/mock data
            this.progression = this.createDemoProgression();
            this.isLoading = false;
        } catch (err) {
            console.error('[ProgressionScreen] Error loading progression:', err);
            this.error = 'Failed to load progression data';
            this.isLoading = false;
        }
    }

    private createDemoProgression(): PlayerProgression {
        // Create demo progression with some sample data
        const prog = createNewProgression('demo');

        // Add some demo XP
        prog.accountXP = 25000;
        prog.riftTier = 2;
        prog.totalGamesPlayed = 47;
        prog.totalWins = 18;
        prog.totalKills = 156;
        prog.totalDeaths = 89;

        // Add class XP
        prog.classXP.set(PlayerClass.SCOUT, 15000);
        prog.classXP.set(PlayerClass.VANGUARD, 8500);
        prog.classXP.set(PlayerClass.MEDIC, 12000);
        prog.classXP.set(PlayerClass.SCAVENGER, 3200);

        // Add weapon XP
        prog.weaponXP.set('auto_common', 5500);
        prog.weaponXP.set('semi_common', 8200);
        prog.weaponXP.set('burst_common', 3100);
        prog.weaponXP.set('charge_common', 1800);

        return prog;
    }

    render(ctx: ScreenContext): void {
        const { renderer, screenWidth, screenHeight } = ctx;
        this.animationTime += 0.016;

        // Animated background
        this.renderBackground(ctx);

        // Title
        renderer.drawScreenText(
            'PROGRESSION',
            screenWidth / 2,
            40,
            '#ffffff',
            28,
            'center',
            'middle'
        );

        // Back button
        this.renderBackButton(ctx);

        if (this.isLoading) {
            this.renderLoading(ctx);
            return;
        }

        if (this.error) {
            this.renderError(ctx);
            return;
        }

        if (!this.progression) return;

        // Tab navigation
        this.renderTabs(ctx);

        // Content based on active tab
        switch (this.activeTab) {
            case 'overview':
                this.renderOverview(ctx);
                break;
            case 'classes':
                this.renderClassMastery(ctx);
                break;
            case 'weapons':
                this.renderWeaponMastery(ctx);
                break;
        }

        // Render ranked status
        this.renderRankedStatus(ctx);
    }

    private renderBackground(ctx: ScreenContext): void {
        const { renderer, screenWidth, screenHeight } = ctx;

        // Dark gradient background
        renderer.drawScreenRect(0, 0, screenWidth, screenHeight, '#0a0a12', 'transparent', 0);

        // Animated grid pattern
        const gridSize = 40;
        for (let x = 0; x < screenWidth; x += gridSize) {
            for (let y = 0; y < screenHeight; y += gridSize) {
                const wave = Math.sin((x + y) * 0.01 + this.animationTime * 2) * 0.5 + 0.5;
                const alpha = 0.03 + wave * 0.02;
                renderer.drawScreenRect(x, y, 1, gridSize, `rgba(100, 200, 255, ${alpha})`, 'transparent', 0);
                renderer.drawScreenRect(x, y, gridSize, 1, `rgba(100, 200, 255, ${alpha})`, 'transparent', 0);
            }
        }
    }

    private renderBackButton(ctx: ScreenContext): void {
        const { renderer } = ctx;

        renderer.drawScreenRect(20, 20, 80, 35, 'rgba(60, 60, 80, 0.8)', 'rgba(100, 150, 255, 0.5)', 1);
        renderer.drawScreenText('← BACK', 60, 37, '#ffffff', 12, 'center', 'middle');
    }

    private renderLoading(ctx: ScreenContext): void {
        const { renderer, screenWidth, screenHeight } = ctx;
        const pulse = Math.sin(this.animationTime * 4) * 0.3 + 0.7;
        renderer.drawScreenText('Loading...', screenWidth / 2, screenHeight / 2, `rgba(255, 255, 255, ${pulse})`, 18, 'center', 'middle');
    }

    private renderError(ctx: ScreenContext): void {
        const { renderer, screenWidth, screenHeight } = ctx;
        renderer.drawScreenText(this.error || 'Error', screenWidth / 2, screenHeight / 2, '#ff4444', 16, 'center', 'middle');
    }

    private renderTabs(ctx: ScreenContext): void {
        const { renderer, screenWidth } = ctx;
        const tabs = ['overview', 'classes', 'weapons'] as const;
        const tabWidth = 120;
        const tabY = 80;
        const startX = screenWidth / 2 - (tabs.length * tabWidth) / 2;

        tabs.forEach((tab, index) => {
            const x = startX + index * tabWidth;
            const isActive = this.activeTab === tab;

            const bgColor = isActive ? 'rgba(100, 180, 255, 0.3)' : 'rgba(40, 40, 60, 0.5)';
            const borderColor = isActive ? 'rgba(100, 200, 255, 0.8)' : 'rgba(80, 80, 100, 0.5)';

            renderer.drawScreenRect(x, tabY, tabWidth - 4, 35, bgColor, borderColor, 1);
            renderer.drawScreenText(
                tab.toUpperCase(),
                x + (tabWidth - 4) / 2,
                tabY + 17,
                isActive ? '#ffffff' : '#888888',
                12,
                'center',
                'middle'
            );
        });
    }

    private renderOverview(ctx: ScreenContext): void {
        const { renderer, screenWidth, screenHeight } = ctx;
        const prog = this.progression!;

        const contentY = 140;
        const centerX = screenWidth / 2;

        // Rift Tier display (large, prominent)
        const tierName = getRiftTierName(prog.riftTier);
        const tierLevel = getLevelFromXP(prog.accountXP, 'account');
        const tierProgress = getLevelProgress(prog.accountXP, 'account');

        // Rift Tier badge
        const badgeY = contentY + 40;
        const pulse = Math.sin(this.animationTime * 2) * 0.1 + 0.9;

        renderer.drawScreenRect(
            centerX - 100, badgeY - 30,
            200, 80,
            'rgba(20, 30, 50, 0.9)',
            `rgba(100, 180, 255, ${pulse})`,
            2
        );

        renderer.drawScreenText('RIFT TIER', centerX, badgeY - 15, '#888888', 10, 'center', 'middle');
        renderer.drawScreenText(tierName.toUpperCase(), centerX, badgeY + 10, '#00ccff', 20, 'center', 'middle');
        renderer.drawScreenText(`Level ${tierLevel}`, centerX, badgeY + 35, '#ffffff', 14, 'center', 'middle');

        // XP Progress bar
        const barY = badgeY + 65;
        const barWidth = 180;
        const barHeight = 8;

        renderer.drawScreenRect(centerX - barWidth / 2, barY, barWidth, barHeight, 'rgba(40, 40, 60, 0.8)', 'transparent', 0);
        renderer.drawScreenRect(centerX - barWidth / 2, barY, barWidth * tierProgress, barHeight, 'rgba(100, 200, 255, 0.8)', 'transparent', 0);

        renderer.drawScreenText(
            `${prog.accountXP.toLocaleString()} XP`,
            centerX,
            barY + 20,
            '#aaaaaa',
            10,
            'center',
            'middle'
        );

        // Stats grid
        const statsY = barY + 50;
        const stats = [
            { label: 'Games Played', value: prog.totalGamesPlayed },
            { label: 'Wins', value: prog.totalWins },
            { label: 'K/D Ratio', value: prog.totalDeaths > 0 ? (prog.totalKills / prog.totalDeaths).toFixed(2) : prog.totalKills },
            { label: 'Win Rate', value: `${prog.totalGamesPlayed > 0 ? Math.round((prog.totalWins / prog.totalGamesPlayed) * 100) : 0}%` },
        ];

        const statWidth = 100;
        const statsStartX = centerX - (stats.length * statWidth) / 2;

        stats.forEach((stat, index) => {
            const x = statsStartX + index * statWidth + statWidth / 2;
            renderer.drawScreenText(stat.value.toString(), x, statsY, '#ffffff', 18, 'center', 'middle');
            renderer.drawScreenText(stat.label, x, statsY + 20, '#666666', 10, 'center', 'middle');
        });
    }

    private renderClassMastery(ctx: ScreenContext): void {
        const { renderer, screenWidth, screenHeight } = ctx;
        const prog = this.progression!;

        const contentY = 140;
        const classes = [PlayerClass.SCOUT, PlayerClass.VANGUARD, PlayerClass.MEDIC, PlayerClass.SCAVENGER];
        const classNames = {
            [PlayerClass.SCOUT]: 'Scout',
            [PlayerClass.VANGUARD]: 'Vanguard',
            [PlayerClass.MEDIC]: 'Medic',
            [PlayerClass.SCAVENGER]: 'Scavenger',
        };
        const classColors = {
            [PlayerClass.SCOUT]: '#44ff88',
            [PlayerClass.VANGUARD]: '#4488ff',
            [PlayerClass.MEDIC]: '#ff88ff',
            [PlayerClass.SCAVENGER]: '#ffaa44',
        };

        const cardWidth = 140;
        const cardHeight = 120;
        const gap = 20;
        const startX = screenWidth / 2 - (classes.length * (cardWidth + gap) - gap) / 2;
        const cardY = contentY + 20;

        classes.forEach((playerClass, index) => {
            const x = startX + index * (cardWidth + gap);
            const xp = prog.classXP.get(playerClass) || 0;
            const level = getLevelFromXP(xp, 'class');
            const progress = getLevelProgress(xp, 'class');
            const color = classColors[playerClass];

            // Card background
            renderer.drawScreenRect(
                x, cardY,
                cardWidth, cardHeight,
                'rgba(20, 25, 35, 0.9)',
                color,
                1
            );

            // Class name
            renderer.drawScreenText(
                classNames[playerClass],
                x + cardWidth / 2,
                cardY + 20,
                color,
                14,
                'center',
                'middle'
            );

            // Level
            renderer.drawScreenText(
                `Level ${level}`,
                x + cardWidth / 2,
                cardY + 45,
                '#ffffff',
                20,
                'center',
                'middle'
            );

            // Progress bar
            const barWidth = cardWidth - 20;
            const barX = x + 10;
            const barY = cardY + 70;

            renderer.drawScreenRect(barX, barY, barWidth, 6, 'rgba(40, 40, 60, 0.8)', 'transparent', 0);
            renderer.drawScreenRect(barX, barY, barWidth * progress, 6, color, 'transparent', 0);

            // XP text
            renderer.drawScreenText(
                `${xp.toLocaleString()} XP`,
                x + cardWidth / 2,
                cardY + 95,
                '#888888',
                10,
                'center',
                'middle'
            );
        });
    }

    private renderWeaponMastery(ctx: ScreenContext): void {
        const { renderer, screenWidth, screenHeight } = ctx;
        const prog = this.progression!;

        const contentY = 140;
        const weapons = ['auto_common', 'semi_common', 'burst_common', 'charge_common'];
        const weaponNames: Record<string, string> = {
            'auto_common': 'Auto Rifle',
            'semi_common': 'DMR',
            'burst_common': 'Burst Rifle',
            'charge_common': 'Railgun',
        };
        const weaponColors: Record<string, string> = {
            'auto_common': '#ff6644',
            'semi_common': '#44aaff',
            'burst_common': '#ffcc44',
            'charge_common': '#aa44ff',
        };

        const cardWidth = 140;
        const cardHeight = 100;
        const gap = 20;
        const startX = screenWidth / 2 - (weapons.length * (cardWidth + gap) - gap) / 2;
        const cardY = contentY + 20;

        weapons.forEach((weapon, index) => {
            const x = startX + index * (cardWidth + gap);
            const xp = prog.weaponXP.get(weapon) || 0;
            const level = getLevelFromXP(xp, 'weapon');
            const progress = getLevelProgress(xp, 'weapon');
            const color = weaponColors[weapon];

            // Card background
            renderer.drawScreenRect(
                x, cardY,
                cardWidth, cardHeight,
                'rgba(20, 25, 35, 0.9)',
                color,
                1
            );

            // Weapon name
            renderer.drawScreenText(
                weaponNames[weapon],
                x + cardWidth / 2,
                cardY + 18,
                color,
                12,
                'center',
                'middle'
            );

            // Level
            renderer.drawScreenText(
                `Lvl ${level}`,
                x + cardWidth / 2,
                cardY + 42,
                '#ffffff',
                18,
                'center',
                'middle'
            );

            // Progress bar
            const barWidth = cardWidth - 20;
            const barX = x + 10;
            const barY = cardY + 60;

            renderer.drawScreenRect(barX, barY, barWidth, 5, 'rgba(40, 40, 60, 0.8)', 'transparent', 0);
            renderer.drawScreenRect(barX, barY, barWidth * progress, 5, color, 'transparent', 0);

            // XP text
            renderer.drawScreenText(
                `${xp.toLocaleString()} XP`,
                x + cardWidth / 2,
                cardY + 82,
                '#888888',
                9,
                'center',
                'middle'
            );
        });
    }

    private renderRankedStatus(ctx: ScreenContext): void {
        const { renderer, screenWidth, screenHeight } = ctx;
        const prog = this.progression!;

        const statusY = screenHeight - 100;
        const centerX = screenWidth / 2;

        // Calculate ranked access
        const classLevels = new Map<PlayerClass, number>();
        prog.classXP.forEach((xp, pc) => classLevels.set(pc, getLevelFromXP(xp, 'class')));

        const weaponLevels = new Map<string, number>();
        prog.weaponXP.forEach((xp, w) => weaponLevels.set(w, getLevelFromXP(xp, 'weapon')));

        const rankedCheck = canAccessRanked({
            classLevels,
            weaponLevels,
            riftTier: prog.riftTier,
        });

        // Ranked status box
        const boxWidth = 300;
        const boxHeight = 60;

        const bgColor = rankedCheck.allowed ? 'rgba(50, 100, 50, 0.5)' : 'rgba(80, 40, 40, 0.5)';
        const borderColor = rankedCheck.allowed ? '#44ff88' : '#ff6644';

        renderer.drawScreenRect(
            centerX - boxWidth / 2,
            statusY,
            boxWidth,
            boxHeight,
            bgColor,
            borderColor,
            1
        );

        if (rankedCheck.allowed) {
            renderer.drawScreenText('✓ RANKED UNLOCKED', centerX, statusY + 20, '#44ff88', 14, 'center', 'middle');
            renderer.drawScreenText(`MMR: ${prog.rankedMMR}`, centerX, statusY + 42, '#888888', 11, 'center', 'middle');
        } else {
            renderer.drawScreenText('🔒 RANKED LOCKED', centerX, statusY + 18, '#ff6644', 13, 'center', 'middle');
            renderer.drawScreenText(rankedCheck.reason || '', centerX, statusY + 40, '#888888', 10, 'center', 'middle');
        }
    }

    /**
     * Handle click at screen position
     */
    handleClick(x: number, y: number, screenWidth: number, screenHeight: number): boolean {
        // Check back button
        if (x >= 20 && x <= 100 && y >= 20 && y <= 55) {
            this.navigation.goBack();
            return true;
        }

        // Check tab clicks
        const tabs = ['overview', 'classes', 'weapons'] as const;
        const tabWidth = 120;
        const tabY = 80;
        const startX = screenWidth / 2 - (tabs.length * tabWidth) / 2;

        for (let i = 0; i < tabs.length; i++) {
            const tabX = startX + i * tabWidth;
            if (x >= tabX && x <= tabX + tabWidth - 4 && y >= tabY && y <= tabY + 35) {
                this.activeTab = tabs[i];
                return true;
            }
        }

        return false;
    }

    /**
     * Handle back navigation
     */
    handleBack(): void {
        this.navigation.goBack();
    }
}
