// Play Menu Screen
// Online multiplayer hub - Public, Private, and Ranked matches via Supabase

import { BaseScreen, ScreenContext } from './BaseScreen';
import { AppState } from '../../core/types';
import { supabaseService } from '../../network/supabase';

export class PlayMenu extends BaseScreen {
    private isOnline: boolean = false;
    private connectionStatus: 'checking' | 'connected' | 'offline' = 'checking';
    private statusMessage: string = 'Checking connection...';

    constructor() {
        super(AppState.PLAY_MENU);
    }

    onEnter(): void {
        super.onEnter();
        this.checkConnection();
    }

    private async checkConnection(): Promise<void> {
        this.connectionStatus = 'checking';
        this.statusMessage = 'Checking connection...';

        if (!supabaseService.isConfigured()) {
            this.connectionStatus = 'offline';
            this.statusMessage = 'Offline Mode (Supabase not configured)';
            this.isOnline = false;
            return;
        }

        try {
            // Try anonymous sign-in
            const user = await supabaseService.signInAnonymously();
            if (user) {
                this.connectionStatus = 'connected';
                this.statusMessage = `Connected as ${user.display_name}`;
                this.isOnline = true;
            } else {
                this.connectionStatus = 'offline';
                this.statusMessage = 'Connection failed';
                this.isOnline = false;
            }
        } catch (error) {
            this.connectionStatus = 'offline';
            this.statusMessage = 'Offline Mode';
            this.isOnline = false;
        }

        // Rebuild buttons based on connection status
        this.clearButtons();
    }

    private setupButtons(ctx: ScreenContext): void {
        const buttons = [];

        // Online options
        buttons.push({
            id: 'btn-quick-match',
            label: 'QUICK MATCH',
            onSelect: () => this.isOnline
                ? this.navigation.navigateTo(AppState.QUICK_PLAY_SETUP)
                : this.showOfflineMessage(),
            disabled: !this.isOnline,
        });

        buttons.push({
            id: 'btn-private-match',
            label: 'PRIVATE MATCH',
            onSelect: () => this.isOnline
                ? this.navigation.navigateTo(AppState.PRIVATE_MATCH)
                : this.showOfflineMessage(),
            disabled: !this.isOnline,
        });

        buttons.push({
            id: 'btn-ranked',
            label: 'RANKED',
            onSelect: () => this.isOnline
                ? this.startRankedQueue()
                : this.showOfflineMessage(),
            disabled: !this.isOnline,
        });

        buttons.push({
            id: 'btn-browse-games',
            label: 'BROWSE GAMES',
            onSelect: () => this.isOnline
                ? this.navigation.navigateTo(AppState.CUSTOM_GAME_BROWSER)
                : this.showOfflineMessage(),
            disabled: !this.isOnline,
        });

        buttons.push({
            id: 'btn-back',
            label: 'BACK',
            onSelect: () => this.navigation.navigateTo(AppState.MAIN_MENU),
        });

        this.layoutButtonsVertical(buttons, ctx, ctx.screenHeight * 0.32);
    }

    private showOfflineMessage(): void {
        console.log('Cannot access online features - offline mode');
    }

    private startRankedQueue(): void {
        // TODO: Implement ranked matchmaking
        console.log('Starting ranked queue...');
        this.navigation.navigateTo(AppState.MATCHMAKING);
    }

    render(ctx: ScreenContext): void {
        const { renderer, screenWidth, screenHeight } = ctx;

        // Set up buttons on first render
        if (this.focusableElements.length === 0) {
            this.setupButtons(ctx);
        }

        // Background
        renderer.drawScreenRect(0, 0, screenWidth, screenHeight, 'rgba(15, 18, 25, 1)');

        // Title
        this.renderTitle(ctx, 'PLAY ONLINE');
        this.renderSubtitle(ctx, 'Find or create a match');

        // Connection status indicator
        const statusColor = this.connectionStatus === 'connected'
            ? 'rgba(100, 255, 150, 1)'
            : this.connectionStatus === 'checking'
                ? 'rgba(255, 200, 100, 1)'
                : 'rgba(255, 100, 100, 1)';

        const statusDot = this.connectionStatus === 'connected' ? '●' :
            this.connectionStatus === 'checking' ? '◐' : '○';

        renderer.drawScreenText(
            `${statusDot} ${this.statusMessage}`,
            screenWidth / 2,
            110,
            statusColor,
            14,
            'center',
            'middle'
        );

        // Render buttons
        this.renderButtons(ctx);

        // Info text
        if (!this.isOnline && this.connectionStatus !== 'checking') {
            renderer.drawScreenText(
                'Online features require Supabase configuration.',
                screenWidth / 2,
                screenHeight - 80,
                'rgba(150, 150, 160, 1)',
                12,
                'center',
                'middle'
            );
            renderer.drawScreenText(
                'Use TRAINING for offline play.',
                screenWidth / 2,
                screenHeight - 60,
                'rgba(150, 150, 160, 1)',
                12,
                'center',
                'middle'
            );
        }

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

    handleBack(): void {
        // Per spec B.5: BACK → MAIN MENU
        this.navigation.navigateTo(AppState.MAIN_MENU);
    }
}
