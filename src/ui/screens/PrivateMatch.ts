// Private Match Screen
// Create or join private lobbies with codes

import { BaseScreen, ScreenContext } from './BaseScreen';
import { AppState, GameMode } from '../../core/types';
import { supabaseService } from '../../network/supabase';

type PrivateMatchMode = 'menu' | 'create' | 'join' | 'lobby';

interface LobbyData {
    code: string;
    hostName: string;
    playerCount: number;
    maxPlayers: number;
    mode: GameMode;
    isHost: boolean;
}

export class PrivateMatch extends BaseScreen {
    private mode: PrivateMatchMode = 'menu';
    private lobbyCode: string = '';
    private inputCode: string = '';
    private codeChars: string[] = [];
    private cursorPosition: number = 0;
    private selectedGameMode: GameMode = GameMode.ARENA_1V1;
    private maxPlayers: number = 2;
    private isLoading: boolean = false;
    private errorMessage: string = '';
    private lobby: LobbyData | null = null;
    private startGameCallback: ((mode: GameMode) => void) | null = null;

    // Available game modes for private matches
    private gameModes: { mode: GameMode; label: string; maxPlayers: number }[] = [
        { mode: GameMode.ARENA_1V1, label: '1v1 DUEL', maxPlayers: 2 },
        { mode: GameMode.ARENA_1V1V1, label: '1v1v1 FFA', maxPlayers: 3 },
        { mode: GameMode.ARENA_3V3, label: '3v3 TEAM', maxPlayers: 6 },
        { mode: GameMode.ARENA_3V3V3, label: '3v3v3 CHAOS', maxPlayers: 9 },
        { mode: GameMode.MAIN, label: 'MAIN MODE', maxPlayers: 30 },
    ];

    constructor() {
        super(AppState.PRIVATE_MATCH);
    }

    setStartGameCallback(callback: (mode: GameMode) => void): void {
        this.startGameCallback = callback;
    }

    onEnter(): void {
        this.mode = 'menu';
        this.lobbyCode = '';
        this.inputCode = '';
        this.codeChars = ['', '', '', '', '', ''];
        this.cursorPosition = 0;
        this.errorMessage = '';
        this.isLoading = false;
        this.lobby = null;
        this.clearButtons();
        super.onEnter();
    }

    private setupMenuButtons(ctx: ScreenContext): void {
        this.clearButtons();
        this.layoutButtonsVertical([
            {
                id: 'btn-create',
                label: 'CREATE LOBBY',
                onSelect: () => {
                    this.mode = 'create';
                    this.clearButtons();
                },
            },
            {
                id: 'btn-join',
                label: 'JOIN WITH CODE',
                onSelect: () => {
                    this.mode = 'join';
                    this.clearButtons();
                },
            },
            {
                id: 'btn-back',
                label: 'BACK',
                onSelect: () => this.navigation.goBack(),
            },
        ], ctx, ctx.screenHeight * 0.35);
    }

    private setupCreateButtons(ctx: ScreenContext): void {
        this.clearButtons();
        const modeIndex = this.gameModes.findIndex(m => m.mode === this.selectedGameMode);
        const modeLabel = this.gameModes[modeIndex].label;

        this.layoutButtonsVertical([
            {
                id: 'btn-mode',
                label: `MODE: ${modeLabel}`,
                onSelect: () => {
                    const nextIndex = (modeIndex + 1) % this.gameModes.length;
                    this.selectedGameMode = this.gameModes[nextIndex].mode;
                    this.maxPlayers = this.gameModes[nextIndex].maxPlayers;
                    this.clearButtons();
                },
            },
            {
                id: 'btn-create-lobby',
                label: 'CREATE LOBBY',
                onSelect: () => this.createLobby(),
            },
            {
                id: 'btn-back',
                label: 'BACK',
                onSelect: () => {
                    this.mode = 'menu';
                    this.clearButtons();
                },
            },
        ], ctx, ctx.screenHeight * 0.35);
    }

    private setupJoinButtons(ctx: ScreenContext): void {
        this.clearButtons();
        this.layoutButtonsVertical([
            {
                id: 'btn-join-lobby',
                label: 'JOIN LOBBY',
                onSelect: () => this.joinLobby(),
                disabled: this.codeChars.join('').length < 6,
            },
            {
                id: 'btn-back',
                label: 'BACK',
                onSelect: () => {
                    this.mode = 'menu';
                    this.codeChars = ['', '', '', '', '', ''];
                    this.cursorPosition = 0;
                    this.errorMessage = '';
                    this.clearButtons();
                },
            },
        ], ctx, ctx.screenHeight * 0.55);
    }

    private setupLobbyButtons(ctx: ScreenContext): void {
        this.clearButtons();
        const buttons = [];

        if (this.lobby?.isHost) {
            buttons.push({
                id: 'btn-start',
                label: 'START GAME',
                onSelect: () => this.startGame(),
                disabled: (this.lobby?.playerCount || 0) < 2,
            });
        }

        buttons.push({
            id: 'btn-leave',
            label: 'LEAVE LOBBY',
            onSelect: () => this.leaveLobby(),
        });

        this.layoutButtonsVertical(buttons, ctx, ctx.screenHeight * 0.65);
    }

    private async createLobby(): Promise<void> {
        this.isLoading = true;
        this.errorMessage = '';

        try {
            // Generate lobby code
            const code = this.generateCode();

            if (supabaseService.isConfigured()) {
                // Online: Create via Supabase
                const lobby = await supabaseService.createLobby({
                    mode: this.selectedGameMode,
                    structure: 'SINGLE',
                    isPrivate: true,
                    isRanked: false,
                    maxPlayers: this.maxPlayers,
                });
                if (lobby) {
                    this.lobbyCode = lobby.code || code;
                } else {
                    throw new Error('Failed to create lobby');
                }
            } else {
                // Offline mode: Store lobby in localStorage for cross-tab sync
                this.lobbyCode = code;
                const lobbyData = {
                    code: code,
                    hostName: 'You',
                    playerCount: 1,
                    maxPlayers: this.maxPlayers,
                    mode: this.selectedGameMode,
                    createdAt: Date.now(),
                };
                localStorage.setItem(`riftline_lobby_${code}`, JSON.stringify(lobbyData));
                console.log(`[PrivateMatch] Created lobby ${code} in localStorage`);
            }

            this.lobby = {
                code: this.lobbyCode,
                hostName: 'You',
                playerCount: 1,
                maxPlayers: this.maxPlayers,
                mode: this.selectedGameMode,
                isHost: true,
            };

            this.mode = 'lobby';
            this.clearButtons();
        } catch (error) {
            console.error('Create lobby failed:', error);
            this.errorMessage = 'Failed to create lobby';
        }

        this.isLoading = false;
    }

    private async joinLobby(): Promise<void> {
        const code = this.codeChars.join('').toUpperCase();
        if (code.length < 6) {
            this.errorMessage = 'Enter a 6-character code';
            return;
        }

        this.isLoading = true;
        this.errorMessage = '';

        try {
            if (supabaseService.isConfigured()) {
                // Online: Join via Supabase
                const lobby = await supabaseService.joinByCode(code);
                if (lobby) {
                    this.lobby = {
                        code: code,
                        hostName: 'Host',
                        playerCount: 2, // Will update from realtime
                        maxPlayers: 6,
                        mode: GameMode.ARENA_1V1,
                        isHost: false,
                    };
                    this.mode = 'lobby';
                    this.clearButtons();
                } else {
                    this.errorMessage = 'Lobby not found';
                }
            } else {
                // Local broadcast mode for testing: Use localStorage to sync
                const storedLobby = localStorage.getItem(`riftline_lobby_${code}`);
                if (storedLobby) {
                    const lobbyData = JSON.parse(storedLobby);
                    this.lobby = {
                        code: code,
                        hostName: lobbyData.hostName || 'Host',
                        playerCount: (lobbyData.playerCount || 1) + 1,
                        maxPlayers: lobbyData.maxPlayers || 6,
                        mode: lobbyData.mode || GameMode.ARENA_1V1,
                        isHost: false,
                    };

                    // Update localStorage with new player count
                    lobbyData.playerCount = this.lobby.playerCount;
                    localStorage.setItem(`riftline_lobby_${code}`, JSON.stringify(lobbyData));

                    console.log(`[PrivateMatch] Joined lobby ${code}`);
                    this.mode = 'lobby';
                    this.clearButtons();
                } else {
                    this.errorMessage = 'Lobby not found - check code';
                }
            }
        } catch (error) {
            console.error('Join lobby failed:', error);
            this.errorMessage = 'Failed to join lobby';
        }

        this.isLoading = false;
    }

    private async leaveLobby(): Promise<void> {
        if (supabaseService.isConfigured() && this.lobby) {
            await supabaseService.leaveLobby(this.lobby.code);
        }

        this.lobby = null;
        this.mode = 'menu';
        this.clearButtons();
    }

    private startGame(): void {
        if (this.lobby && this.startGameCallback) {
            this.startGameCallback(this.lobby.mode);
            this.navigation.forceNavigateTo(AppState.IN_MATCH);
        }
    }

    private generateCode(): string {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    // Handle keyboard input for code entry
    handleKeyInput(key: string): void {
        if (this.mode !== 'join') return;

        if (key === 'Backspace') {
            if (this.cursorPosition > 0) {
                this.cursorPosition--;
                this.codeChars[this.cursorPosition] = '';
            }
            this.clearButtons();
        } else if (key.length === 1 && /[A-Za-z0-9]/.test(key)) {
            if (this.cursorPosition < 6) {
                this.codeChars[this.cursorPosition] = key.toUpperCase();
                this.cursorPosition++;
            }
            this.clearButtons();
        }
    }

    render(ctx: ScreenContext): void {
        const { renderer, screenWidth, screenHeight } = ctx;

        // Background
        renderer.drawScreenRect(0, 0, screenWidth, screenHeight, 'rgba(15, 18, 25, 1)');

        // Title
        this.renderTitle(ctx, 'PRIVATE MATCH');

        switch (this.mode) {
            case 'menu':
                this.renderMenuMode(ctx);
                break;
            case 'create':
                this.renderCreateMode(ctx);
                break;
            case 'join':
                this.renderJoinMode(ctx);
                break;
            case 'lobby':
                this.renderLobbyMode(ctx);
                break;
        }

        // Error message
        if (this.errorMessage) {
            renderer.drawScreenText(
                this.errorMessage,
                screenWidth / 2,
                screenHeight - 80,
                '#ff4444',
                16,
                'center',
                'middle'
            );
        }

        // Loading indicator
        if (this.isLoading) {
            renderer.drawScreenText(
                'Loading...',
                screenWidth / 2,
                screenHeight / 2,
                '#00ffcc',
                20,
                'center',
                'middle'
            );
        }
    }

    private renderMenuMode(ctx: ScreenContext): void {
        if (this.focusableElements.length === 0) {
            this.setupMenuButtons(ctx);
        }

        this.renderSubtitle(ctx, 'Play with friends using lobby codes');
        this.renderButtons(ctx);
        this.renderFooter(ctx);
    }

    private renderCreateMode(ctx: ScreenContext): void {
        const { renderer, screenWidth, screenHeight } = ctx;

        if (this.focusableElements.length === 0) {
            this.setupCreateButtons(ctx);
        }

        this.renderSubtitle(ctx, 'Choose a game mode for your lobby');
        this.renderButtons(ctx);

        // Mode description
        const modeInfo = this.gameModes.find(m => m.mode === this.selectedGameMode);
        if (modeInfo) {
            renderer.drawScreenText(
                `Max Players: ${modeInfo.maxPlayers}`,
                screenWidth / 2,
                screenHeight * 0.28,
                'rgba(150, 160, 180, 1)',
                14,
                'center',
                'middle'
            );
        }

        this.renderFooter(ctx);
    }

    private renderJoinMode(ctx: ScreenContext): void {
        const { renderer, screenWidth, screenHeight } = ctx;

        if (this.focusableElements.length === 0) {
            this.setupJoinButtons(ctx);
        }

        this.renderSubtitle(ctx, 'Enter the 6-character lobby code');

        // Code input boxes
        const boxSize = 50;
        const gap = 10;
        const totalWidth = 6 * boxSize + 5 * gap;
        const startX = (screenWidth - totalWidth) / 2;
        const boxY = screenHeight * 0.35;

        for (let i = 0; i < 6; i++) {
            const x = startX + i * (boxSize + gap);
            const isFocused = i === this.cursorPosition;
            const hasChar = this.codeChars[i] !== '';

            // Box background
            renderer.drawScreenRect(
                x, boxY, boxSize, boxSize,
                isFocused ? 'rgba(0, 255, 204, 0.1)' : 'rgba(40, 45, 60, 1)',
                isFocused ? '#00ffcc' : 'rgba(80, 90, 110, 1)',
                2
            );

            // Character
            if (hasChar) {
                renderer.drawScreenText(
                    this.codeChars[i],
                    x + boxSize / 2,
                    boxY + boxSize / 2,
                    '#ffffff',
                    28,
                    'center',
                    'middle'
                );
            }
        }

        // Input hint
        renderer.drawScreenText(
            'Type your code using keyboard',
            screenWidth / 2,
            boxY + boxSize + 30,
            'rgba(100, 105, 115, 1)',
            14,
            'center',
            'middle'
        );

        this.renderButtons(ctx);
        this.renderFooter(ctx);
    }

    private renderLobbyMode(ctx: ScreenContext): void {
        const { renderer, screenWidth, screenHeight } = ctx;

        if (this.focusableElements.length === 0) {
            this.setupLobbyButtons(ctx);
        }

        if (this.lobby) {
            // Lobby code (prominent display)
            renderer.drawScreenText(
                'LOBBY CODE',
                screenWidth / 2,
                screenHeight * 0.2,
                'rgba(100, 105, 115, 1)',
                14,
                'center',
                'middle'
            );

            // Big code display
            const codeY = screenHeight * 0.28;
            const codeBoxWidth = 280;
            const codeBoxHeight = 60;

            renderer.drawScreenRect(
                (screenWidth - codeBoxWidth) / 2,
                codeY - codeBoxHeight / 2,
                codeBoxWidth,
                codeBoxHeight,
                'rgba(0, 255, 204, 0.05)',
                '#00ffcc',
                2
            );

            renderer.drawScreenText(
                this.lobby.code,
                screenWidth / 2,
                codeY,
                '#00ffcc',
                36,
                'center',
                'middle'
            );

            // Share hint
            renderer.drawScreenText(
                'Share this code with friends to join!',
                screenWidth / 2,
                codeY + 45,
                'rgba(100, 105, 115, 1)',
                12,
                'center',
                'middle'
            );

            // Lobby info
            const modeInfo = this.gameModes.find(m => m.mode === this.lobby!.mode);
            renderer.drawScreenText(
                `Mode: ${modeInfo?.label || 'Custom'}`,
                screenWidth / 2,
                screenHeight * 0.45,
                '#ffffff',
                16,
                'center',
                'middle'
            );

            renderer.drawScreenText(
                `Players: ${this.lobby.playerCount}/${this.lobby.maxPlayers}`,
                screenWidth / 2,
                screenHeight * 0.5,
                '#ffffff',
                16,
                'center',
                'middle'
            );

            renderer.drawScreenText(
                this.lobby.isHost ? 'You are the host' : `Host: ${this.lobby.hostName}`,
                screenWidth / 2,
                screenHeight * 0.55,
                'rgba(150, 160, 180, 1)',
                14,
                'center',
                'middle'
            );
        }

        this.renderButtons(ctx);
        this.renderFooter(ctx);
    }

    private renderFooter(ctx: ScreenContext): void {
        const { renderer, screenWidth, screenHeight } = ctx;
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
        if (this.mode === 'menu') {
            this.navigation.goBack();
        } else if (this.mode === 'lobby') {
            this.leaveLobby();
        } else {
            this.mode = 'menu';
            this.clearButtons();
        }
    }
}
