// Lobby Screen
// Spec B.10: Pre-match lobby with player list and ready state

import { BaseScreen, ScreenContext } from './BaseScreen';
import { AppState, ModalType, GameMode, TrainingDifficulty } from '../../core/types';

// Callback type for starting the match
type StartMatchCallback = (mode?: GameMode, difficulty?: TrainingDifficulty) => void;

interface LobbyPlayer {
    id: string;
    name: string;
    isReady: boolean;
    isHost: boolean;
    isLocal: boolean;
}

export class LobbyScreen extends BaseScreen {
    private players: LobbyPlayer[] = [];
    private isHost: boolean = false;
    private startMatchCallback: StartMatchCallback | null = null;
    private animationTime: number = 0;
    private mode: GameMode = GameMode.MAIN;
    private difficulty: TrainingDifficulty = TrainingDifficulty.MEDIUM;

    constructor() {
        super(AppState.LOBBY);
    }

    setIsHost(isHost: boolean): void {
        this.isHost = isHost;
        this.clearButtons();
    }

    setPlayers(players: LobbyPlayer[]): void {
        this.players = [...players];
    }

    setStartMatchCallback(callback: StartMatchCallback): void {
        this.startMatchCallback = callback;
    }

    setMatchConfig(mode: GameMode, difficulty: TrainingDifficulty): void {
        this.mode = mode;
        this.difficulty = difficulty;
    }

    onEnter(): void {
        this.animationTime = 0;
        // For solo test, set up default state
        if (this.players.length === 0) {
            this.isHost = true;
            this.players = [
                { id: '1', name: 'YOU', isReady: true, isHost: true, isLocal: true },
                { id: '2', name: 'Bot 1', isReady: true, isHost: false, isLocal: false },
                { id: '3', name: 'Bot 2', isReady: true, isHost: false, isLocal: false },
            ];
        }
        super.onEnter();
    }

    private setupButtons(ctx: ScreenContext): void {
        const buttons: Array<{ id: string; label: string; onSelect: () => void; disabled?: boolean }> = [];

        if (this.isHost) {
            const allReady = this.players.every(p => p.isReady);
            buttons.push({
                id: 'btn-start',
                label: 'START MATCH',
                onSelect: () => {
                    if (this.startMatchCallback) {
                        this.startMatchCallback(this.mode, this.difficulty);
                        this.navigation.forceNavigateTo(AppState.IN_MATCH);
                    }
                },
                disabled: !allReady,
            });
        }

        buttons.push({
            id: 'btn-leave',
            label: this.isHost ? 'DISBAND LOBBY' : 'LEAVE LOBBY',
            onSelect: () => {
                const modal = this.isHost ? ModalType.DISBAND_LOBBY : ModalType.LEAVE_LOBBY;
                this.navigation.showModal(modal);
            },
        });

        this.layoutButtonsVertical(buttons, ctx, ctx.screenHeight * 0.7, 200, 50);
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
        this.renderTitle(ctx, 'LOBBY');

        const modeText = this.isHost ? 'You are the Host' : 'Waiting for Host...';
        this.renderSubtitle(ctx, modeText);

        // Player list panel
        const panelX = (screenWidth - 300) / 2;
        const panelY = 160;
        const panelWidth = 300;
        const panelHeight = this.players.length * 45 + 40;

        renderer.drawScreenRect(panelX, panelY, panelWidth, panelHeight, 'rgba(25, 30, 40, 0.8)');
        renderer.drawScreenRect(panelX, panelY, panelWidth, panelHeight, undefined, 'rgba(60, 70, 90, 0.6)', 1);

        // Panel header
        renderer.drawScreenText(
            'SQUAD',
            screenWidth / 2,
            panelY + 15,
            'rgba(120, 140, 160, 1)',
            12,
            'center',
            'middle'
        );

        // Player entries
        this.players.forEach((player, index) => {
            const entryY = panelY + 40 + index * 45;

            // Player name
            const nameColor = player.isLocal ? 'rgba(100, 200, 255, 1)' : 'rgba(220, 225, 230, 1)';
            const displayName = player.isHost ? `${player.name} ★` : player.name;

            renderer.drawScreenText(
                displayName,
                panelX + 20,
                entryY,
                nameColor,
                16,
                'left',
                'middle'
            );

            // Ready status
            const statusColor = player.isReady ? 'rgba(100, 220, 130, 1)' : 'rgba(180, 180, 100, 1)';
            const statusText = player.isReady ? 'READY' : 'NOT READY';

            renderer.drawScreenText(
                statusText,
                panelX + panelWidth - 20,
                entryY,
                statusColor,
                12,
                'right',
                'middle'
            );
        });

        // Waiting indicator (animated dots)
        if (!this.isHost) {
            const dots = '.'.repeat(Math.floor(this.animationTime * 2) % 4);
            renderer.drawScreenText(
                `Waiting for host${dots}`,
                screenWidth / 2,
                panelY + panelHeight + 30,
                'rgba(120, 140, 160, 1)',
                14,
                'center',
                'middle'
            );
        }

        // Render buttons
        this.renderButtons(ctx);

        // Footer hint
        renderer.drawScreenText(
            ctx.isMobile ? 'TAP to select' : 'ENTER to select • ESC to leave',
            screenWidth / 2,
            screenHeight - 30,
            'rgba(100, 105, 115, 1)',
            14,
            'center',
            'middle'
        );
    }

    handleBack(): void {
        // Per spec B.10: BACK triggers leave/disband confirmation
        const modal = this.isHost ? ModalType.DISBAND_LOBBY : ModalType.LEAVE_LOBBY;
        this.navigation.showModal(modal);
    }
}
