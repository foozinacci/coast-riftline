// Private Match Panel - Inline overlay on MainMenu
// Creates or joins private lobbies without leaving the main screen

import { ScreenContext } from './BaseScreen';
import { GameMode } from '../../core/types';
import { supabaseService } from '../../network/supabase';

export type PrivateMatchState = 'closed' | 'menu' | 'create' | 'join' | 'lobby';

interface LobbyData {
    code: string;
    hostName: string;
    playerCount: number;
    maxPlayers: number;
    mode: GameMode;
    isHost: boolean;
    players: { id: string; name: string; isReady: boolean }[];
}

export interface PrivateMatchCallbacks {
    onStateChange: (state: PrivateMatchState) => void;
    onStartGame: (mode: GameMode) => void;
}

const GAME_MODES = [
    { mode: GameMode.ARENA_1V1, label: 'DUEL', maxPlayers: 2 },
    { mode: GameMode.ARENA_1V1V1, label: 'BRAWL', maxPlayers: 3 },
    { mode: GameMode.ARENA_3V3, label: 'SKIRMISH', maxPlayers: 6 },
    { mode: GameMode.ARENA_3V3V3, label: 'FRACAS', maxPlayers: 9 },
    { mode: GameMode.MAIN, label: 'RIFTLINE', maxPlayers: 30 },
];

/**
 * Private Match Panel - renders as overlay on MainMenu
 */
export class PrivateMatchPanel {
    private state: PrivateMatchState = 'closed';
    private selectedModeIndex: number = 0;
    private lobby: LobbyData | null = null;
    private codeChars: string[] = ['', '', '', '', '', ''];
    private cursorPosition: number = 0;
    private errorMessage: string = '';
    private isLoading: boolean = false;
    private callbacks: PrivateMatchCallbacks | null = null;
    private localReady: boolean = false;

    setCallbacks(callbacks: PrivateMatchCallbacks): void {
        this.callbacks = callbacks;
    }

    getState(): PrivateMatchState {
        return this.state;
    }

    open(): void {
        this.state = 'menu';
        this.resetState();
        this.callbacks?.onStateChange(this.state);
    }

    close(): void {
        this.state = 'closed';
        this.resetState();
        this.callbacks?.onStateChange(this.state);
    }

    private resetState(): void {
        this.codeChars = ['', '', '', '', '', ''];
        this.cursorPosition = 0;
        this.errorMessage = '';
        this.isLoading = false;
        this.localReady = false;
    }

    handleKeyInput(key: string): boolean {
        if (this.state === 'join') {
            if (key === 'Backspace') {
                if (this.cursorPosition > 0) {
                    this.cursorPosition--;
                    this.codeChars[this.cursorPosition] = '';
                }
                return true;
            } else if (key.length === 1 && /[A-Za-z0-9]/.test(key)) {
                if (this.cursorPosition < 6) {
                    this.codeChars[this.cursorPosition] = key.toUpperCase();
                    this.cursorPosition++;
                }
                return true;
            }
        }
        return false;
    }

    handleAction(action: string): void {
        switch (action) {
            case 'create':
                this.state = 'create';
                break;
            case 'join':
                this.state = 'join';
                this.codeChars = ['', '', '', '', '', ''];
                this.cursorPosition = 0;
                break;
            case 'back':
                if (this.state === 'lobby') {
                    this.leaveLobby();
                } else if (this.state !== 'menu') {
                    this.state = 'menu';
                } else {
                    this.close();
                }
                break;
            case 'mode-prev':
                this.selectedModeIndex = (this.selectedModeIndex - 1 + GAME_MODES.length) % GAME_MODES.length;
                break;
            case 'mode-next':
                this.selectedModeIndex = (this.selectedModeIndex + 1) % GAME_MODES.length;
                break;
            case 'create-lobby':
                this.createLobby();
                break;
            case 'join-lobby':
                this.joinLobby();
                break;
            case 'toggle-ready':
                this.toggleReady();
                break;
            case 'start-game':
                this.startGame();
                break;
        }
    }

    private toggleReady(): void {
        this.localReady = !this.localReady;
        if (this.lobby) {
            const localPlayer = this.lobby.players.find(p => p.name === 'You');
            if (localPlayer) {
                localPlayer.isReady = this.localReady;
            }
        }
    }

    private allReady(): boolean {
        return this.lobby?.players.every(p => p.isReady) ?? false;
    }

    private async createLobby(): Promise<void> {
        this.isLoading = true;
        this.errorMessage = '';

        try {
            const modeConfig = GAME_MODES[this.selectedModeIndex];
            const code = this.generateCode();

            this.lobby = {
                code,
                hostName: 'You',
                playerCount: 1,
                maxPlayers: modeConfig.maxPlayers,
                mode: modeConfig.mode,
                isHost: true,
                players: [{ id: '1', name: 'You', isReady: false }],
            };
            this.state = 'lobby';
        } catch (error) {
            this.errorMessage = 'Failed to create lobby';
        }

        this.isLoading = false;
    }

    private async joinLobby(): Promise<void> {
        const code = this.codeChars.join('');
        if (code.length < 6) {
            this.errorMessage = 'Enter complete 6-character code';
            return;
        }

        this.isLoading = true;
        this.errorMessage = '';

        try {
            // Simulate join
            this.lobby = {
                code,
                hostName: 'Host',
                playerCount: 2,
                maxPlayers: 6,
                mode: GameMode.ARENA_1V1,
                isHost: false,
                players: [
                    { id: '1', name: 'Host', isReady: false },
                    { id: '2', name: 'You', isReady: false },
                ],
            };
            this.state = 'lobby';
        } catch (error) {
            this.errorMessage = 'Failed to join lobby';
        }

        this.isLoading = false;
    }

    private async leaveLobby(): Promise<void> {
        this.lobby = null;
        this.localReady = false;
        this.state = 'menu';
    }

    private startGame(): void {
        if (this.lobby && this.allReady()) {
            this.callbacks?.onStartGame(this.lobby.mode);
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

    /**
     * Render the panel as an overlay
     */
    render(ctx: ScreenContext): void {
        if (this.state === 'closed') return;

        const { renderer, screenWidth, screenHeight } = ctx;

        // Dimmed background
        renderer.drawScreenRect(0, 0, screenWidth, screenHeight, 'rgba(0, 0, 0, 0.6)');

        // Panel dimensions
        const panelWidth = Math.min(400, screenWidth * 0.85);
        const panelHeight = this.state === 'lobby' ? 450 : 320;
        const panelX = (screenWidth - panelWidth) / 2;
        const panelY = (screenHeight - panelHeight) / 2;

        // Panel background
        renderer.drawScreenRoundRect(
            panelX, panelY, panelWidth, panelHeight, 12,
            'rgba(18, 22, 30, 0.98)',
            'rgba(80, 200, 255, 0.3)', 2
        );

        // Title
        const title = this.state === 'menu' ? 'PRIVATE MATCH'
            : this.state === 'create' ? 'CREATE LOBBY'
                : this.state === 'join' ? 'JOIN LOBBY'
                    : 'LOBBY';

        renderer.drawScreenText(
            title,
            screenWidth / 2, panelY + 30,
            'rgba(255, 255, 255, 0.95)', 22, 'center', 'middle'
        );

        // Content based on state
        switch (this.state) {
            case 'menu':
                this.renderMenu(ctx, panelX, panelY, panelWidth, panelHeight);
                break;
            case 'create':
                this.renderCreate(ctx, panelX, panelY, panelWidth, panelHeight);
                break;
            case 'join':
                this.renderJoin(ctx, panelX, panelY, panelWidth, panelHeight);
                break;
            case 'lobby':
                this.renderLobby(ctx, panelX, panelY, panelWidth, panelHeight);
                break;
        }

        // Error message
        if (this.errorMessage) {
            renderer.drawScreenText(
                this.errorMessage,
                screenWidth / 2, panelY + panelHeight - 35,
                '#ff6666', 12, 'center', 'middle'
            );
        }

        // Loading overlay
        if (this.isLoading) {
            renderer.drawScreenRect(panelX, panelY, panelWidth, panelHeight, 'rgba(0, 0, 0, 0.5)');
            renderer.drawScreenText('Loading...', screenWidth / 2, screenHeight / 2, '#00ffcc', 18, 'center', 'middle');
        }
    }

    private renderMenu(ctx: ScreenContext, px: number, py: number, pw: number, ph: number): void {
        const { renderer, screenWidth } = ctx;
        const btnWidth = pw - 60;
        const btnHeight = 45;
        const btnX = px + 30;
        let btnY = py + 80;

        // Create button
        this.renderButton(ctx, 'create', 'CREATE LOBBY', btnX, btnY, btnWidth, btnHeight);
        btnY += btnHeight + 12;

        // Join button
        this.renderButton(ctx, 'join', 'JOIN WITH CODE', btnX, btnY, btnWidth, btnHeight);
        btnY += btnHeight + 20;

        // Close button
        this.renderButton(ctx, 'back', '← CLOSE', btnX, btnY, btnWidth, 35, true);
    }

    private renderCreate(ctx: ScreenContext, px: number, py: number, pw: number, ph: number): void {
        const { renderer, screenWidth } = ctx;
        const modeConfig = GAME_MODES[this.selectedModeIndex];

        // Mode selector
        const selectorY = py + 85;
        renderer.drawScreenText('Game Mode', screenWidth / 2, selectorY, 'rgba(150, 160, 180, 0.8)', 12, 'center', 'middle');

        const modeY = selectorY + 35;
        renderer.drawScreenRoundRect(px + 30, modeY, pw - 60, 50, 6, 'rgba(40, 50, 70, 0.6)', 'rgba(80, 120, 180, 0.5)', 1);

        // Arrows
        renderer.drawScreenText('◀', px + 50, modeY + 25, 'rgba(120, 180, 255, 0.8)', 18, 'center', 'middle');
        renderer.drawScreenText('▶', px + pw - 50, modeY + 25, 'rgba(120, 180, 255, 0.8)', 18, 'center', 'middle');

        // Mode label
        renderer.drawScreenText(modeConfig.label, screenWidth / 2, modeY + 20, '#ffffff', 18, 'center', 'middle');
        renderer.drawScreenText(`${modeConfig.maxPlayers} players`, screenWidth / 2, modeY + 38, 'rgba(130, 140, 160, 0.7)', 11, 'center', 'middle');

        // Buttons
        const btnY = modeY + 70;
        this.renderButton(ctx, 'create-lobby', 'CREATE LOBBY', px + 30, btnY, pw - 60, 45);
        this.renderButton(ctx, 'back', '← BACK', px + 30, btnY + 55, pw - 60, 35, true);
    }

    private renderJoin(ctx: ScreenContext, px: number, py: number, pw: number, ph: number): void {
        const { renderer, screenWidth } = ctx;

        // Code input
        const boxSize = 42;
        const gap = 8;
        const totalWidth = 6 * boxSize + 5 * gap;
        const startX = (screenWidth - totalWidth) / 2;
        const boxY = py + 90;

        renderer.drawScreenText('Enter 6-character code', screenWidth / 2, boxY - 15, 'rgba(150, 160, 180, 0.8)', 12, 'center', 'middle');

        for (let i = 0; i < 6; i++) {
            const x = startX + i * (boxSize + gap);
            const isCurrent = i === this.cursorPosition;
            const hasChar = this.codeChars[i] !== '';

            renderer.drawScreenRoundRect(
                x, boxY, boxSize, boxSize, 6,
                isCurrent ? 'rgba(80, 200, 255, 0.15)' : 'rgba(35, 45, 60, 0.8)',
                isCurrent ? 'rgba(80, 200, 255, 0.9)' : 'rgba(60, 70, 90, 0.6)',
                isCurrent ? 2 : 1
            );

            if (hasChar) {
                renderer.drawScreenText(
                    this.codeChars[i],
                    x + boxSize / 2, boxY + boxSize / 2,
                    '#ffffff', 22, 'center', 'middle'
                );
            }
        }

        renderer.drawScreenText('Type using keyboard', screenWidth / 2, boxY + boxSize + 18, 'rgba(100, 110, 130, 0.5)', 10, 'center', 'middle');

        // Buttons
        const btnY = boxY + boxSize + 45;
        const codeComplete = this.codeChars.join('').length === 6;
        this.renderButton(ctx, 'join-lobby', 'JOIN LOBBY', px + 30, btnY, pw - 60, 45, false, !codeComplete);
        this.renderButton(ctx, 'back', '← BACK', px + 30, btnY + 55, pw - 60, 35, true);
    }

    private renderLobby(ctx: ScreenContext, px: number, py: number, pw: number, ph: number): void {
        const { renderer, screenWidth } = ctx;

        if (!this.lobby) return;

        // Code display
        const codeY = py + 70;
        renderer.drawScreenText('LOBBY CODE', screenWidth / 2, codeY, 'rgba(120, 140, 160, 0.7)', 11, 'center', 'middle');
        renderer.drawScreenRoundRect(px + 50, codeY + 10, pw - 100, 45, 6, 'rgba(0, 255, 180, 0.08)', 'rgba(0, 255, 180, 0.5)', 2);
        renderer.drawScreenText(this.lobby.code, screenWidth / 2, codeY + 32, '#00ffcc', 26, 'center', 'middle');

        // Mode info
        const modeConfig = GAME_MODES.find(m => m.mode === this.lobby!.mode);
        renderer.drawScreenText(`Mode: ${modeConfig?.label || 'Custom'}`, screenWidth / 2, codeY + 70, 'rgba(180, 190, 210, 0.9)', 14, 'center', 'middle');

        // Player list
        const listY = codeY + 100;
        const listHeight = 120;
        renderer.drawScreenRoundRect(px + 20, listY, pw - 40, listHeight, 6, 'rgba(25, 32, 45, 0.7)', 'rgba(50, 60, 80, 0.4)', 1);

        renderer.drawScreenText('PLAYERS', px + 35, listY + 15, 'rgba(100, 120, 150, 0.6)', 10, 'left', 'middle');

        this.lobby.players.forEach((player, i) => {
            const py2 = listY + 35 + i * 28;

            // Ready dot
            const dotColor = player.isReady ? 'rgba(100, 220, 130, 1)' : 'rgba(100, 100, 110, 0.4)';
            renderer.drawScreenRoundRect(px + 35, py2 - 5, 10, 10, 5, dotColor);

            // Name
            const isLocal = player.name === 'You';
            renderer.drawScreenText(
                player.name + (this.lobby?.isHost && player.name === 'You' ? ' ★' : ''),
                px + 55, py2,
                isLocal ? 'rgba(100, 180, 255, 1)' : 'rgba(200, 210, 220, 0.9)',
                13, 'left', 'middle'
            );

            // Status
            renderer.drawScreenText(
                player.isReady ? 'READY' : 'NOT READY',
                px + pw - 35, py2,
                player.isReady ? 'rgba(100, 220, 130, 0.9)' : 'rgba(140, 140, 150, 0.5)',
                10, 'right', 'middle'
            );
        });

        // Ready count
        const readyCount = this.lobby.players.filter(p => p.isReady).length;
        const allReady = this.allReady();
        renderer.drawScreenText(
            allReady ? '✓ ALL READY' : `${readyCount}/${this.lobby.players.length} Ready`,
            screenWidth / 2, listY + listHeight + 15,
            allReady ? 'rgba(100, 220, 130, 0.9)' : 'rgba(255, 200, 100, 0.8)',
            12, 'center', 'middle'
        );

        // Buttons
        let btnY = listY + listHeight + 35;

        // Ready button
        const readyLabel = this.localReady ? '✓ READY' : 'READY UP';
        this.renderButton(ctx, 'toggle-ready', readyLabel, px + 30, btnY, pw - 60, 40, false, false, this.localReady);
        btnY += 48;

        // Start button (host only, all ready required)
        if (this.lobby.isHost) {
            this.renderButton(ctx, 'start-game', allReady ? '▶ START GAME' : '⏸ WAITING...', px + 30, btnY, pw - 60, 40, false, !allReady);
            btnY += 48;
        }

        // Leave button
        this.renderButton(ctx, 'back', 'LEAVE LOBBY', px + 30, btnY, pw - 60, 35, true);
    }

    private renderButton(
        ctx: ScreenContext,
        action: string,
        label: string,
        x: number, y: number, w: number, h: number,
        isSecondary: boolean = false,
        isDisabled: boolean = false,
        isActive: boolean = false
    ): void {
        const { renderer } = ctx;

        let bg = isSecondary ? 'rgba(50, 55, 70, 0.4)' : 'rgba(60, 90, 140, 0.4)';
        let border = isSecondary ? 'rgba(80, 90, 110, 0.5)' : 'rgba(80, 140, 220, 0.6)';
        let text = isSecondary ? 'rgba(160, 170, 190, 0.8)' : 'rgba(220, 230, 255, 0.95)';

        if (isActive) {
            bg = 'rgba(60, 180, 120, 0.4)';
            border = 'rgba(100, 220, 150, 0.8)';
            text = 'rgba(150, 255, 180, 1)';
        }

        if (isDisabled) {
            bg = 'rgba(40, 45, 55, 0.3)';
            border = 'rgba(60, 65, 75, 0.3)';
            text = 'rgba(100, 105, 115, 0.4)';
        }

        renderer.drawScreenRoundRect(x, y, w, h, 6, bg, border, 1);
        renderer.drawScreenText(label, x + w / 2, y + h / 2, text, isSecondary ? 12 : 14, 'center', 'middle');
    }

    /**
     * Get button hitboxes for input handling
     */
    getHitboxes(ctx: ScreenContext): Array<{ id: string; x: number; y: number; w: number; h: number; action: string }> {
        if (this.state === 'closed') return [];

        const { screenWidth, screenHeight } = ctx;
        const panelWidth = Math.min(400, screenWidth * 0.85);
        const panelHeight = this.state === 'lobby' ? 450 : 320;
        const panelX = (screenWidth - panelWidth) / 2;
        const panelY = (screenHeight - panelHeight) / 2;
        const btnWidth = panelWidth - 60;

        const hitboxes: Array<{ id: string; x: number; y: number; w: number; h: number; action: string }> = [];

        // Add hitboxes based on state
        if (this.state === 'menu') {
            hitboxes.push({ id: 'create', x: panelX + 30, y: panelY + 80, w: btnWidth, h: 45, action: 'create' });
            hitboxes.push({ id: 'join', x: panelX + 30, y: panelY + 137, w: btnWidth, h: 45, action: 'join' });
            hitboxes.push({ id: 'back', x: panelX + 30, y: panelY + 194, w: btnWidth, h: 35, action: 'back' });
        }
        // Add more hitboxes for other states...

        return hitboxes;
    }
}
