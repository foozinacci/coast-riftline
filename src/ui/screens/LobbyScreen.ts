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
    private localPlayerId: string = '1';
    private startMatchCallback: StartMatchCallback | null = null;
    private animationTime: number = 0;
    private mode: GameMode = GameMode.MAIN;
    private difficulty: TrainingDifficulty = TrainingDifficulty.MEDIUM;
    private buttonsInitialized: boolean = false;

    constructor() {
        super(AppState.LOBBY);
    }

    setIsHost(isHost: boolean): void {
        this.isHost = isHost;
        this.buttonsInitialized = false;
    }

    setPlayers(players: LobbyPlayer[]): void {
        this.players = [...players];
        this.buttonsInitialized = false;
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
        this.buttonsInitialized = false;

        // For solo test, set up default state
        if (this.players.length === 0) {
            this.isHost = true;
            this.localPlayerId = '1';
            this.players = [
                { id: '1', name: 'YOU', isReady: false, isHost: true, isLocal: true },
                { id: '2', name: 'Squadmate 1', isReady: false, isHost: false, isLocal: false },
                { id: '3', name: 'Squadmate 2', isReady: false, isHost: false, isLocal: false },
            ];
        }
        super.onEnter();
    }

    private getLocalPlayer(): LobbyPlayer | undefined {
        return this.players.find(p => p.isLocal);
    }

    private toggleLocalReady(): void {
        const local = this.getLocalPlayer();
        if (local) {
            local.isReady = !local.isReady;
            this.buttonsInitialized = false; // Re-render buttons
            console.log(`[Lobby] Local player ready: ${local.isReady}`);
        }
    }

    private allPlayersReady(): boolean {
        return this.players.length > 0 && this.players.every(p => p.isReady);
    }

    private getReadyCount(): { ready: number; total: number } {
        return {
            ready: this.players.filter(p => p.isReady).length,
            total: this.players.length,
        };
    }

    private setupButtons(ctx: ScreenContext): void {
        this.clearButtons();
        const { screenWidth, screenHeight } = ctx;

        const local = this.getLocalPlayer();
        const isLocalReady = local?.isReady ?? false;
        const allReady = this.allPlayersReady();

        const btnWidth = 200;
        const btnHeight = 45;
        const btnX = (screenWidth - btnWidth) / 2;
        const btnGap = 55;
        let btnY = screenHeight * 0.65;

        // Ready Up / Unready button (for everyone)
        const readyLabel = isLocalReady ? '✓ READY' : 'READY UP';
        this.addButton('btn-ready', readyLabel, btnX, btnY, btnWidth, btnHeight,
            () => this.toggleLocalReady());
        btnY += btnGap;

        // Start Match button (host only, requires all ready)
        if (this.isHost) {
            this.addButton('btn-start', allReady ? '▶ START MATCH' : '⏸ WAITING...',
                btnX, btnY, btnWidth, btnHeight,
                () => {
                    if (allReady && this.startMatchCallback) {
                        this.startMatchCallback(this.mode, this.difficulty);
                        this.navigation.forceNavigateTo(AppState.IN_MATCH);
                    }
                });
            btnY += btnGap;
        }

        // Leave button
        const leaveLabel = this.isHost ? 'DISBAND LOBBY' : 'LEAVE LOBBY';
        this.addButton('btn-leave', leaveLabel, btnX, btnY, btnWidth, btnHeight,
            () => {
                const modal = this.isHost ? ModalType.DISBAND_LOBBY : ModalType.LEAVE_LOBBY;
                this.navigation.showModal(modal);
            });

        const elementIds = this.focusableElements.map(el => el.id);
        this.navigation.setFocusableElements(elementIds);
        this.buttonsInitialized = true;
    }

    render(ctx: ScreenContext): void {
        const { renderer, screenWidth, screenHeight } = ctx;
        this.animationTime += 0.016;

        if (!this.buttonsInitialized) {
            this.setupButtons(ctx);
        }

        // Background
        renderer.drawScreenRect(0, 0, screenWidth, screenHeight, '#0a0d12');

        // Title
        renderer.drawScreenText(
            'LOBBY',
            screenWidth / 2, 60,
            'rgba(255, 255, 255, 0.95)', 32, 'center', 'middle'
        );

        // Ready status summary
        const { ready, total } = this.getReadyCount();
        const allReady = this.allPlayersReady();
        const statusColor = allReady ? 'rgba(100, 220, 130, 0.9)' : 'rgba(255, 200, 100, 0.8)';
        const statusText = allReady ? '✓ ALL READY' : `${ready}/${total} READY`;

        renderer.drawScreenText(
            statusText,
            screenWidth / 2, 100,
            statusColor, 18, 'center', 'middle'
        );

        // Player list panel
        const panelWidth = Math.min(350, screenWidth * 0.8);
        const panelX = (screenWidth - panelWidth) / 2;
        const panelY = 140;
        const panelHeight = this.players.length * 50 + 50;

        renderer.drawScreenRoundRect(panelX, panelY, panelWidth, panelHeight, 8,
            'rgba(22, 28, 38, 0.9)', 'rgba(45, 55, 75, 0.4)', 1);

        // Panel header
        renderer.drawScreenText(
            'SQUAD',
            screenWidth / 2, panelY + 20,
            'rgba(100, 120, 150, 0.7)', 12, 'center', 'middle'
        );

        // Player entries
        this.players.forEach((player, index) => {
            const entryY = panelY + 55 + index * 50;

            // Player row background
            const rowBg = player.isLocal
                ? 'rgba(60, 100, 180, 0.15)'
                : 'rgba(255, 255, 255, 0.02)';
            renderer.drawScreenRect(panelX + 10, entryY - 18, panelWidth - 20, 40, rowBg);

            // Ready indicator dot
            const dotColor = player.isReady ? 'rgba(100, 220, 130, 1)' : 'rgba(100, 100, 110, 0.5)';
            renderer.drawScreenRoundRect(panelX + 25, entryY - 6, 12, 12, 6, dotColor);

            // Player name
            const nameColor = player.isLocal ? 'rgba(100, 180, 255, 1)' : 'rgba(200, 205, 215, 0.9)';
            const displayName = player.isHost ? `${player.name} ★` : player.name;
            renderer.drawScreenText(
                displayName,
                panelX + 50, entryY,
                nameColor, 16, 'left', 'middle'
            );

            // Ready status text
            const statusText = player.isReady ? 'READY' : 'NOT READY';
            const statusColor = player.isReady ? 'rgba(100, 220, 130, 0.9)' : 'rgba(150, 150, 160, 0.6)';
            renderer.drawScreenText(
                statusText,
                panelX + panelWidth - 25, entryY,
                statusColor, 11, 'right', 'middle'
            );
        });

        // Render buttons with proper styling
        for (const element of this.focusableElements) {
            const isFocused = ctx.focusState.currentFocusId === element.id;
            const isReadyBtn = element.id === 'btn-ready';
            const isStartBtn = element.id === 'btn-start';
            const allReady = this.allPlayersReady();
            const local = this.getLocalPlayer();

            let bgColor = 'rgba(40, 50, 70, 0.6)';
            let borderColor = 'rgba(80, 100, 130, 0.5)';
            let textColor = 'rgba(200, 210, 220, 0.9)';

            if (isReadyBtn) {
                if (local?.isReady) {
                    bgColor = 'rgba(60, 180, 120, 0.4)';
                    borderColor = 'rgba(100, 220, 150, 0.7)';
                    textColor = 'rgba(150, 255, 180, 1)';
                } else {
                    bgColor = 'rgba(80, 140, 200, 0.3)';
                    borderColor = 'rgba(100, 180, 255, 0.6)';
                }
            } else if (isStartBtn) {
                if (allReady) {
                    bgColor = 'rgba(80, 200, 120, 0.4)';
                    borderColor = 'rgba(120, 255, 160, 0.7)';
                    textColor = '#ffffff';
                } else {
                    bgColor = 'rgba(60, 60, 70, 0.3)';
                    borderColor = 'rgba(80, 80, 90, 0.4)';
                    textColor = 'rgba(120, 120, 130, 0.6)';
                }
            }

            if (isFocused) {
                borderColor = 'rgba(255, 255, 255, 0.8)';
            }

            renderer.drawScreenRoundRect(
                element.x, element.y, element.width, element.height, 6,
                bgColor, borderColor, isFocused ? 2 : 1
            );

            renderer.drawScreenText(
                element.label,
                element.x + element.width / 2,
                element.y + element.height / 2,
                textColor, 14, 'center', 'middle'
            );
        }

        // Host status / waiting indicator
        if (!this.isHost) {
            const dots = '.'.repeat(Math.floor(this.animationTime * 2) % 4);
            renderer.drawScreenText(
                `Waiting for host to start${dots}`,
                screenWidth / 2, screenHeight * 0.85,
                'rgba(100, 120, 150, 0.6)', 13, 'center', 'middle'
            );
        } else if (!allReady) {
            renderer.drawScreenText(
                'Waiting for all players to ready up...',
                screenWidth / 2, screenHeight * 0.85,
                'rgba(255, 180, 100, 0.7)', 13, 'center', 'middle'
            );
        }

        // Footer hint
        renderer.drawScreenText(
            ctx.isMobile ? 'TAP to select' : 'ENTER = Select • ESC = Leave',
            screenWidth / 2, screenHeight - 25,
            'rgba(80, 90, 110, 0.5)', 12, 'center', 'middle'
        );
    }

    handleBack(): void {
        // Per spec B.10: BACK triggers leave/disband confirmation
        const modal = this.isHost ? ModalType.DISBAND_LOBBY : ModalType.LEAVE_LOBBY;
        this.navigation.showModal(modal);
    }
}

