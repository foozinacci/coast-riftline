// Leaderboard Screen UI - Shows top players by Rift Tier and ranked MMR

import { BaseScreen, ScreenContext } from './BaseScreen';
import { AppState } from '../../core/types';
import { supabaseService } from '../../network/supabase';
import { getRiftTierName } from '../../systems/progression';

// ============================================================================
// TYPES
// ============================================================================

interface LeaderboardEntry {
    rank: number;
    playerId: string;
    playerName: string;
    riftTier: number;
    riftTierName: string;
    accountLevel: number;
    accountXP: number;
    rankedMMR: number;
    rankedTier: string;
    totalWins: number;
    totalKills: number;
    kdr: number;
}

type LeaderboardType = 'rift_tier' | 'ranked' | 'kills' | 'wins';

// ============================================================================
// DEMO DATA
// ============================================================================

function generateDemoLeaderboard(): LeaderboardEntry[] {
    const names = [
        'RiftMaster99', 'VoidWalker', 'ShadowStrike', 'NeonHunter', 'CyberNinja',
        'QuantumPhase', 'StellarDrift', 'NovaBurst', 'EchoSpectre', 'ChromeViper',
        'ZenithPulse', 'AbyssRunner', 'PrismBlade', 'NullVector', 'FluxRider',
        'OmegaCore', 'DarkMatter', 'PhotonEdge', 'WarpDriven', 'AtomicFury',
    ];

    return names.map((name, index) => {
        const tier = Math.max(0, 10 - Math.floor(index / 2));
        const mmr = Math.floor(2500 - index * 75 + Math.random() * 50);
        const wins = Math.floor(200 - index * 8 + Math.random() * 20);
        const kills = Math.floor(2000 - index * 80 + Math.random() * 100);
        const deaths = Math.floor(kills * (0.3 + Math.random() * 0.4));

        return {
            rank: index + 1,
            playerId: `demo_${index}`,
            playerName: name,
            riftTier: tier,
            riftTierName: getRiftTierName(tier),
            accountLevel: Math.floor(tier * 10 + 5 + Math.random() * 5),
            accountXP: Math.floor(50000 - index * 2000 + Math.random() * 1000),
            rankedMMR: mmr,
            rankedTier: mmr > 2200 ? 'Diamond' : mmr > 1800 ? 'Platinum' : mmr > 1400 ? 'Gold' : 'Silver',
            totalWins: wins,
            totalKills: kills,
            kdr: deaths > 0 ? +(kills / deaths).toFixed(2) : kills,
        };
    });
}

// ============================================================================
// LEADERBOARD SCREEN
// ============================================================================

export class LeaderboardScreen extends BaseScreen {
    private animationTime: number = 0;
    private entries: LeaderboardEntry[] = [];
    private isLoading: boolean = true;
    private error: string | null = null;

    private activeTab: LeaderboardType = 'rift_tier';
    private scrollOffset: number = 0;
    private maxVisible: number = 10;

    constructor() {
        super(AppState.LEADERBOARD);
    }

    onEnter(): void {
        super.onEnter();
        this.loadLeaderboard();
    }

    private async loadLeaderboard(): Promise<void> {
        this.isLoading = true;
        this.error = null;

        try {
            // Try to load from Supabase
            if (supabaseService.isConfigured()) {
                const response = await supabaseService.getLeaderboard(this.activeTab, 50);
                if (response && response.length > 0) {
                    this.entries = response;
                    this.isLoading = false;
                    return;
                }
            }

            // Fall back to demo data
            this.entries = generateDemoLeaderboard();
            this.sortLeaderboard();
            this.isLoading = false;
        } catch (err) {
            console.error('[Leaderboard] Error loading:', err);
            this.entries = generateDemoLeaderboard();
            this.sortLeaderboard();
            this.isLoading = false;
        }
    }

    private sortLeaderboard(): void {
        switch (this.activeTab) {
            case 'rift_tier':
                this.entries.sort((a, b) => b.riftTier - a.riftTier || b.accountXP - a.accountXP);
                break;
            case 'ranked':
                this.entries.sort((a, b) => b.rankedMMR - a.rankedMMR);
                break;
            case 'kills':
                this.entries.sort((a, b) => b.totalKills - a.totalKills);
                break;
            case 'wins':
                this.entries.sort((a, b) => b.totalWins - a.totalWins);
                break;
        }
        // Reassign ranks
        this.entries.forEach((entry, index) => {
            entry.rank = index + 1;
        });
    }

    render(ctx: ScreenContext): void {
        const { renderer, screenWidth, screenHeight } = ctx;
        this.animationTime += 0.016;

        // Background
        this.renderBackground(ctx);

        // Title
        renderer.drawScreenText(
            'LEADERBOARDS',
            screenWidth / 2,
            35,
            '#ffffff',
            26,
            'center',
            'middle'
        );

        // Back button
        this.renderBackButton(ctx);

        // Tabs
        this.renderTabs(ctx);

        if (this.isLoading) {
            this.renderLoading(ctx);
            return;
        }

        // Leaderboard table
        this.renderLeaderboard(ctx);

        // Scroll indicators
        this.renderScrollIndicators(ctx);
    }

    private renderBackground(ctx: ScreenContext): void {
        const { renderer, screenWidth, screenHeight } = ctx;

        // Dark gradient
        renderer.drawScreenRect(0, 0, screenWidth, screenHeight, '#0a0a14', 'transparent', 0);

        // Subtle animated lines
        for (let i = 0; i < 10; i++) {
            const y = (i * 60 + this.animationTime * 20) % screenHeight;
            const alpha = 0.03 + Math.sin(i + this.animationTime) * 0.01;
            renderer.drawScreenRect(0, y, screenWidth, 1, `rgba(100, 150, 255, ${alpha})`, 'transparent', 0);
        }
    }

    private renderBackButton(ctx: ScreenContext): void {
        const { renderer } = ctx;
        renderer.drawScreenRect(15, 15, 70, 30, 'rgba(50, 50, 70, 0.8)', 'rgba(100, 150, 255, 0.4)', 1);
        renderer.drawScreenText('← BACK', 50, 30, '#ffffff', 11, 'center', 'middle');
    }

    private renderTabs(ctx: ScreenContext): void {
        const { renderer, screenWidth } = ctx;
        const tabs: { key: LeaderboardType; label: string }[] = [
            { key: 'rift_tier', label: 'RIFT TIER' },
            { key: 'ranked', label: 'RANKED' },
            { key: 'kills', label: 'KILLS' },
            { key: 'wins', label: 'WINS' },
        ];

        const tabWidth = 90;
        const tabY = 65;
        const startX = screenWidth / 2 - (tabs.length * tabWidth) / 2;

        tabs.forEach((tab, index) => {
            const x = startX + index * tabWidth;
            const isActive = this.activeTab === tab.key;

            const bgColor = isActive ? 'rgba(80, 150, 255, 0.3)' : 'rgba(40, 40, 60, 0.5)';
            const borderColor = isActive ? 'rgba(100, 180, 255, 0.8)' : 'rgba(60, 60, 80, 0.5)';

            renderer.drawScreenRect(x, tabY, tabWidth - 6, 28, bgColor, borderColor, 1);
            renderer.drawScreenText(
                tab.label,
                x + (tabWidth - 6) / 2,
                tabY + 14,
                isActive ? '#ffffff' : '#888888',
                10,
                'center',
                'middle'
            );
        });
    }

    private renderLoading(ctx: ScreenContext): void {
        const { renderer, screenWidth, screenHeight } = ctx;
        const pulse = Math.sin(this.animationTime * 4) * 0.3 + 0.7;
        renderer.drawScreenText('Loading...', screenWidth / 2, screenHeight / 2, `rgba(255, 255, 255, ${pulse})`, 16, 'center', 'middle');
    }

    private renderLeaderboard(ctx: ScreenContext): void {
        const { renderer, screenWidth, screenHeight } = ctx;

        const tableY = 110;
        const rowHeight = 35;
        const tableWidth = Math.min(650, screenWidth - 40);
        const tableX = (screenWidth - tableWidth) / 2;

        // Header
        renderer.drawScreenRect(tableX, tableY, tableWidth, 28, 'rgba(40, 50, 70, 0.9)', 'rgba(80, 100, 140, 0.5)', 1);

        const columns = this.getColumns();
        let colX = tableX + 10;

        for (const col of columns) {
            renderer.drawScreenText(
                col.label,
                colX + col.width / 2,
                tableY + 14,
                '#aabbcc',
                9,
                'center',
                'middle'
            );
            colX += col.width;
        }

        // Rows
        const visibleEntries = this.entries.slice(this.scrollOffset, this.scrollOffset + this.maxVisible);

        visibleEntries.forEach((entry, index) => {
            const rowY = tableY + 28 + index * rowHeight;
            const isTop3 = entry.rank <= 3;

            // Row background
            const bgAlpha = index % 2 === 0 ? 0.15 : 0.08;
            const bgColor = isTop3
                ? `rgba(255, 200, 100, ${bgAlpha + 0.1})`
                : `rgba(60, 70, 90, ${bgAlpha})`;

            renderer.drawScreenRect(tableX, rowY, tableWidth, rowHeight - 2, bgColor, 'transparent', 0);

            // Rank highlight for top 3
            if (isTop3) {
                const medals = ['🥇', '🥈', '🥉'];
                renderer.drawScreenText(medals[entry.rank - 1], tableX + 5, rowY + rowHeight / 2 - 1, '#ffffff', 14, 'left', 'middle');
            }

            // Row data
            colX = tableX + 10;
            const rowData = this.getRowData(entry);

            for (let i = 0; i < columns.length; i++) {
                const col = columns[i];
                const value = rowData[i];

                renderer.drawScreenText(
                    value,
                    colX + col.width / 2,
                    rowY + rowHeight / 2 - 1,
                    col.color || '#ffffff',
                    col.size || 11,
                    'center',
                    'middle'
                );
                colX += col.width;
            }
        });
    }

    private getColumns(): { label: string; width: number; color?: string; size?: number }[] {
        switch (this.activeTab) {
            case 'rift_tier':
                return [
                    { label: '#', width: 40 },
                    { label: 'PLAYER', width: 160 },
                    { label: 'RIFT TIER', width: 120, color: '#00ccff' },
                    { label: 'LEVEL', width: 70 },
                    { label: 'XP', width: 100 },
                    { label: 'K/D', width: 60 },
                ];
            case 'ranked':
                return [
                    { label: '#', width: 40 },
                    { label: 'PLAYER', width: 160 },
                    { label: 'MMR', width: 80, color: '#ffcc44' },
                    { label: 'TIER', width: 100 },
                    { label: 'WINS', width: 70 },
                    { label: 'K/D', width: 60 },
                ];
            case 'kills':
                return [
                    { label: '#', width: 40 },
                    { label: 'PLAYER', width: 160 },
                    { label: 'KILLS', width: 100, color: '#ff6644' },
                    { label: 'K/D', width: 70 },
                    { label: 'RIFT TIER', width: 100 },
                ];
            case 'wins':
                return [
                    { label: '#', width: 40 },
                    { label: 'PLAYER', width: 160 },
                    { label: 'WINS', width: 100, color: '#44ff88' },
                    { label: 'WIN %', width: 80 },
                    { label: 'RIFT TIER', width: 100 },
                ];
            default:
                return [];
        }
    }

    private getRowData(entry: LeaderboardEntry): string[] {
        switch (this.activeTab) {
            case 'rift_tier':
                return [
                    `${entry.rank}`,
                    entry.playerName,
                    entry.riftTierName,
                    `${entry.accountLevel}`,
                    entry.accountXP.toLocaleString(),
                    `${entry.kdr}`,
                ];
            case 'ranked':
                return [
                    `${entry.rank}`,
                    entry.playerName,
                    `${entry.rankedMMR}`,
                    entry.rankedTier,
                    `${entry.totalWins}`,
                    `${entry.kdr}`,
                ];
            case 'kills':
                return [
                    `${entry.rank}`,
                    entry.playerName,
                    entry.totalKills.toLocaleString(),
                    `${entry.kdr}`,
                    entry.riftTierName,
                ];
            case 'wins':
                const winRate = entry.totalWins > 0 ? Math.round((entry.totalWins / (entry.totalWins + 50)) * 100) : 0;
                return [
                    `${entry.rank}`,
                    entry.playerName,
                    `${entry.totalWins}`,
                    `${winRate}%`,
                    entry.riftTierName,
                ];
            default:
                return [];
        }
    }

    private renderScrollIndicators(ctx: ScreenContext): void {
        const { renderer, screenWidth, screenHeight } = ctx;

        if (this.entries.length <= this.maxVisible) return;

        const indicatorX = screenWidth - 30;

        // Up arrow
        if (this.scrollOffset > 0) {
            renderer.drawScreenText('▲', indicatorX, 130, '#ffffff', 16, 'center', 'middle');
        }

        // Down arrow
        if (this.scrollOffset + this.maxVisible < this.entries.length) {
            renderer.drawScreenText('▼', indicatorX, screenHeight - 60, '#ffffff', 16, 'center', 'middle');
        }

        // Scroll indicator
        const progress = this.scrollOffset / (this.entries.length - this.maxVisible);
        const barHeight = 200;
        const barY = 150;
        const thumbHeight = 30;
        const thumbY = barY + progress * (barHeight - thumbHeight);

        renderer.drawScreenRect(indicatorX - 3, barY, 6, barHeight, 'rgba(50, 50, 70, 0.5)', 'transparent', 0);
        renderer.drawScreenRect(indicatorX - 3, thumbY, 6, thumbHeight, 'rgba(100, 150, 255, 0.8)', 'transparent', 0);
    }

    /**
     * Handle scroll input
     */
    scroll(direction: number): void {
        this.scrollOffset = Math.max(0, Math.min(
            this.entries.length - this.maxVisible,
            this.scrollOffset + direction
        ));
    }

    /**
     * Switch to a different tab
     */
    switchTab(tab: LeaderboardType): void {
        if (this.activeTab !== tab) {
            this.activeTab = tab;
            this.scrollOffset = 0;
            this.loadLeaderboard();
        }
    }

    /**
     * Handle click at position
     */
    handleClick(x: number, y: number, screenWidth: number, screenHeight: number): boolean {
        // Check back button
        if (x >= 15 && x <= 85 && y >= 15 && y <= 45) {
            this.navigation.goBack();
            return true;
        }

        // Check tab clicks
        const tabs: LeaderboardType[] = ['rift_tier', 'ranked', 'kills', 'wins'];
        const tabWidth = 90;
        const tabY = 65;
        const startX = screenWidth / 2 - (tabs.length * tabWidth) / 2;

        for (let i = 0; i < tabs.length; i++) {
            const tabX = startX + i * tabWidth;
            if (x >= tabX && x <= tabX + tabWidth - 6 && y >= tabY && y <= tabY + 28) {
                this.switchTab(tabs[i]);
                return true;
            }
        }

        return false;
    }

    handleBack(): void {
        this.navigation.goBack();
    }
}
