// Main Menu Screen - Dashboard Layout with Inline Mode Selection
// Single-glance readiness: Squad/Social LEFT, Identity CENTER, Modes RIGHT
// Mode selection expands inline as grid cards, no separate screens

import { BaseScreen, ScreenContext, FocusableElement } from './BaseScreen';
import { AppState, GameMode, TrainingDifficulty } from '../../core/types';
import { playMusic, getAudio, stopMusic } from '../../core/audio';

const LOGO_URL = 'https://i.ibb.co/VYbnBQjD/ei-1765901346915-removebg-preview.png';

// Game mode definitions for grid display
interface ModeCard {
    id: string;
    mode: GameMode;
    label: string;
    shortDesc: string;
    players: string;
    ranked: boolean;
}

const QUICK_PLAY_MODES: ModeCard[] = [
    { id: 'main', mode: GameMode.MAIN, label: 'RIFTLINE', shortDesc: 'Relic War', players: '30', ranked: false },
    { id: '1v1', mode: GameMode.ARENA_1V1, label: 'DUEL', shortDesc: 'Showdown', players: '2', ranked: false },
    { id: '1v1v1', mode: GameMode.ARENA_1V1V1, label: 'BRAWL', shortDesc: 'Free-For-All', players: '3', ranked: false },
    { id: '3v3', mode: GameMode.ARENA_3V3, label: 'SKIRMISH', shortDesc: 'Team Arena', players: '6', ranked: false },
    { id: '3v3v3', mode: GameMode.ARENA_3V3V3, label: 'FRACAS', shortDesc: '3-Team Chaos', players: '9', ranked: false },
];

const RANKED_MODES: ModeCard[] = [
    { id: 'ranked-main', mode: GameMode.MAIN, label: 'RIFTLINE', shortDesc: 'Competitive', players: '30', ranked: true },
    { id: 'ranked-1v1v1', mode: GameMode.ARENA_1V1V1, label: 'BRAWL', shortDesc: 'Ranked FFA', players: '3', ranked: true },
    { id: 'ranked-3v3v3', mode: GameMode.ARENA_3V3V3, label: 'FRACAS', shortDesc: 'Ranked Chaos', players: '9', ranked: true },
];

// Training uses same modes as Quick Play
const TRAINING_MODES: ModeCard[] = [
    { id: 'train-main', mode: GameMode.MAIN, label: 'RIFTLINE', shortDesc: 'vs Bots', players: '30', ranked: false },
    { id: 'train-1v1', mode: GameMode.ARENA_1V1, label: 'DUEL', shortDesc: 'Practice', players: '2', ranked: false },
    { id: 'train-1v1v1', mode: GameMode.ARENA_1V1V1, label: 'BRAWL', shortDesc: 'Practice', players: '3', ranked: false },
    { id: 'train-3v3', mode: GameMode.ARENA_3V3, label: 'SKIRMISH', shortDesc: 'Team Practice', players: '6', ranked: false },
    { id: 'train-3v3v3', mode: GameMode.ARENA_3V3V3, label: 'FRACAS', shortDesc: 'Practice', players: '9', ranked: false },
];

type PlayMenuState = 'closed' | 'quickplay' | 'ranked' | 'training';

// Panel configuration
interface PanelConfig {
    x: number;
    y: number;
    width: number;
    height: number;
}

export class MainMenu extends BaseScreen {
    private animationTime: number = 0;
    private logoImage: HTMLImageElement | null = null;
    private logoLoaded: boolean = false;
    private logoLoadFailed: boolean = false;
    private startTrainingCallback: (() => void) | null = null;
    private buttonsInitialized: boolean = false;

    // State for inline mode selection
    private playMenuState: PlayMenuState = 'closed';
    private selectedMode: ModeCard | null = null;
    private hoveredModeId: string | null = null;
    private selectedDifficulty: TrainingDifficulty = TrainingDifficulty.MEDIUM;

    // Callbacks
    private startMatchCallback: ((mode: GameMode, ranked: boolean) => void) | null = null;
    private startTrainingDirectCallback: ((mode: GameMode, difficulty: TrainingDifficulty) => void) | null = null;

    // Layout panels
    private leftPanel: PanelConfig = { x: 0, y: 0, width: 0, height: 0 };
    private centerPanel: PanelConfig = { x: 0, y: 0, width: 0, height: 0 };
    private rightPanel: PanelConfig = { x: 0, y: 0, width: 0, height: 0 };

    constructor() {
        super(AppState.MAIN_MENU);
        this.loadLogo();
    }

    setStartTrainingCallback(callback: () => void): void {
        this.startTrainingCallback = callback;
    }

    setStartMatchCallback(callback: (mode: GameMode, ranked: boolean) => void): void {
        this.startMatchCallback = callback;
    }

    setStartTrainingDirectCallback(callback: (mode: GameMode, difficulty: TrainingDifficulty) => void): void {
        this.startTrainingDirectCallback = callback;
    }

    private loadLogo(): void {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            this.logoImage = img;
            this.logoLoaded = true;
        };
        img.onerror = () => {
            console.warn('Failed to load logo image');
            this.logoLoadFailed = true;
        };
        img.src = LOGO_URL;
    }

    onEnter(): void {
        this.buttonsInitialized = false;
        this.playMenuState = 'closed';
        this.selectedMode = null;
        this.clearButtons();
        super.onEnter();

        const audio = getAudio();
        const currentState = this.navigation.getCurrentState();
        if (audio.isInitialized() && !audio.isMusicPlaying() && currentState === AppState.MAIN_MENU) {
            playMusic('lobby');
        }
    }

    private calculateLayout(ctx: ScreenContext): void {
        const { screenWidth, screenHeight } = ctx;
        const padding = Math.min(20, screenWidth * 0.02);
        const topBarHeight = 55;
        const bottomBarHeight = 45;

        const contentTop = topBarHeight + padding;
        const contentBottom = screenHeight - bottomBarHeight - padding;
        const contentHeight = contentBottom - contentTop;

        const sideWidth = Math.min(260, screenWidth * 0.22);
        const centerWidth = screenWidth - sideWidth * 2 - padding * 4;

        this.leftPanel = {
            x: padding,
            y: contentTop,
            width: sideWidth,
            height: contentHeight
        };

        this.centerPanel = {
            x: sideWidth + padding * 2,
            y: contentTop,
            width: centerWidth,
            height: contentHeight
        };

        this.rightPanel = {
            x: screenWidth - sideWidth - padding,
            y: contentTop,
            width: sideWidth,
            height: contentHeight
        };
    }

    private setupButtons(ctx: ScreenContext): void {
        this.clearButtons();
        this.calculateLayout(ctx);

        const { screenWidth, screenHeight } = ctx;
        const btnHeight = 40;
        const btnGap = 6;
        const smallBtnWidth = 90;

        // === LEFT PANEL: Squad/Social ===
        const leftBtnWidth = this.leftPanel.width - 20;
        let leftY = this.leftPanel.y + 45;

        this.addButton('btn-party', 'SQUAD UP',
            this.leftPanel.x + 10, leftY, leftBtnWidth, btnHeight,
            () => this.navigation.navigateTo(AppState.PARTY));
        leftY += btnHeight + btnGap;

        this.addButton('btn-friends', 'FRIENDS',
            this.leftPanel.x + 10, leftY, leftBtnWidth, btnHeight,
            () => this.navigation.navigateTo(AppState.FRIENDS));

        // === RIGHT PANEL: Mode Selection ===
        if (this.playMenuState === 'closed') {
            this.setupClosedModeButtons(ctx, btnHeight, btnGap);
        }
        // When expanded, mode cards are rendered separately

        // === BOTTOM BAR ===
        const bottomY = screenHeight - 40;
        const bottomBtnHeight = 30;
        let bottomX = 15;

        this.addButton('btn-settings', '⚙',
            bottomX, bottomY, 40, bottomBtnHeight,
            () => this.navigation.navigateTo(AppState.SETTINGS_ROOT));
        bottomX += 50;

        this.addButton('btn-profile', 'PROFILE',
            bottomX, bottomY, smallBtnWidth, bottomBtnHeight,
            () => this.navigation.navigateTo(AppState.PROFILE));
        bottomX += smallBtnWidth + 8;

        this.addButton('btn-leaderboard', 'RANKS',
            bottomX, bottomY, smallBtnWidth - 10, bottomBtnHeight,
            () => this.navigation.navigateTo(AppState.LEADERBOARD));

        const exitX = screenWidth - 70;
        this.addButton('btn-exit', 'EXIT',
            exitX, bottomY, 55, bottomBtnHeight,
            () => this.navigation.navigateTo(AppState.EXIT_CONFIRM));

        const elementIds = this.focusableElements.map(el => el.id);
        this.navigation.setFocusableElements(elementIds);
        this.buttonsInitialized = true;
    }

    private setupClosedModeButtons(ctx: ScreenContext, btnHeight: number, btnGap: number): void {
        const rightBtnWidth = this.rightPanel.width - 20;
        let rightY = this.rightPanel.y + 45;

        // Quick Play - expands inline
        this.addButton('btn-quickplay', '▶ QUICK PLAY',
            this.rightPanel.x + 10, rightY, rightBtnWidth, btnHeight + 8,
            () => {
                this.playMenuState = 'quickplay';
                this.buttonsInitialized = false;
            });
        rightY += btnHeight + 8 + btnGap;

        // Ranked - expands inline
        this.addButton('btn-ranked', 'RANKED',
            this.rightPanel.x + 10, rightY, rightBtnWidth, btnHeight,
            () => {
                this.playMenuState = 'ranked';
                this.buttonsInitialized = false;
            });
        rightY += btnHeight + btnGap;

        // Private Match - navigates to lobby
        this.addButton('btn-private', 'PRIVATE MATCH',
            this.rightPanel.x + 10, rightY, rightBtnWidth, btnHeight,
            () => this.navigation.navigateTo(AppState.PRIVATE_MATCH));
        rightY += btnHeight + btnGap;

        // Training - expands inline (solo practice)
        this.addButton('btn-training', 'TRAINING',
            this.rightPanel.x + 10, rightY, rightBtnWidth, btnHeight,
            () => {
                this.playMenuState = 'training';
                this.buttonsInitialized = false;
            });
    }

    render(ctx: ScreenContext): void {
        const { renderer, screenWidth, screenHeight } = ctx;
        this.animationTime += 0.016;

        if (!this.buttonsInitialized) {
            this.setupButtons(ctx);
        }

        // Background
        renderer.drawScreenRect(0, 0, screenWidth, screenHeight, '#0a0d12');
        this.renderBackgroundEffect(ctx);

        // Panels
        this.renderTopBar(ctx);
        this.renderLeftPanel(ctx);
        this.renderCenterPanel(ctx);
        this.renderRightPanel(ctx);
        this.renderBottomBar(ctx);

        // Buttons
        this.renderButtons(ctx);

        // Mode grid if expanded
        if (this.playMenuState !== 'closed') {
            this.renderModeGrid(ctx);
        }
    }

    private renderModeGrid(ctx: ScreenContext): void {
        const { renderer, screenHeight } = ctx;
        const p = this.rightPanel;
        const modes = this.playMenuState === 'quickplay'
            ? QUICK_PLAY_MODES
            : this.playMenuState === 'ranked'
                ? RANKED_MODES
                : TRAINING_MODES;

        // CRITICAL: Draw opaque background for entire panel to prevent bleed-through
        // Extend to bottom of screen to cover any overflow
        renderer.drawScreenRect(
            p.x - 5, p.y - 5,
            p.width + 10, screenHeight - p.y + 10,
            '#0f1218'  // Solid dark background matching theme
        );

        // Panel border/container
        renderer.drawScreenRoundRect(
            p.x, p.y, p.width, p.height, 8,
            'rgba(20, 25, 35, 0.95)', 'rgba(60, 70, 90, 0.5)', 1
        );

        // Title
        const title = this.playMenuState === 'quickplay' ? 'QUICK PLAY'
            : this.playMenuState === 'ranked' ? 'RANKED'
                : 'TRAINING';
        renderer.drawScreenText(
            title, p.x + p.width / 2, p.y + 40,
            '#4cc9f0', 16, 'center', 'middle'
        );

        // Grid container
        const gridY = p.y + 80;
        const gridHeight = p.height - 120;

        // Cards layout - 2 columns
        const cardWidth = (p.width - 30) / 2;
        const cardHeight = 70;
        const gap = 8;

        modes.forEach((mode, i) => {
            const col = i % 2;
            const row = Math.floor(i / 2);
            const cardX = p.x + 10 + col * (cardWidth + gap);
            const cardY = gridY + row * (cardHeight + gap);

            const isSelected = this.selectedMode?.id === mode.id;
            const isHovered = this.hoveredModeId === mode.id;

            // Card background
            const bgColor = isSelected
                ? 'rgba(80, 200, 255, 0.2)'
                : isHovered
                    ? 'rgba(60, 80, 120, 0.6)'
                    : 'rgba(30, 40, 55, 0.8)';
            const borderColor = isSelected
                ? 'rgba(80, 200, 255, 0.9)'
                : 'rgba(60, 70, 90, 0.5)';

            renderer.drawScreenRoundRect(cardX, cardY, cardWidth, cardHeight, 6, bgColor, borderColor, isSelected ? 2 : 1);

            // Mode label
            renderer.drawScreenText(
                mode.label,
                cardX + cardWidth / 2, cardY + 22,
                isSelected ? '#ffffff' : 'rgba(220, 230, 255, 0.9)',
                14,
                'center', 'middle'
            );

            // Description
            renderer.drawScreenText(
                mode.shortDesc,
                cardX + cardWidth / 2, cardY + 42,
                'rgba(140, 150, 180, 0.7)',
                10,
                'center', 'middle'
            );

            // Player count
            renderer.drawScreenText(
                `${mode.players}p`,
                cardX + cardWidth / 2, cardY + 58,
                'rgba(100, 120, 150, 0.5)',
                9,
                'center', 'middle'
            );

            // Add click handler for this card
            this.addModeCardHitbox(mode, cardX, cardY, cardWidth, cardHeight);
        });

        // Back button
        const backY = gridY + Math.ceil(modes.length / 2) * (cardHeight + gap) + 10;
        this.addButton('btn-mode-back', '← BACK',
            p.x + 10, backY, p.width - 20, 35,
            () => {
                this.playMenuState = 'closed';
                this.selectedMode = null;
                this.buttonsInitialized = false;
            });

        // Difficulty toggle (for Training mode only)
        if (this.playMenuState === 'training') {
            const diffY = backY + 45;
            const diffLabel = `DIFFICULTY: ${this.selectedDifficulty.toUpperCase()}`;
            const diffColor = this.selectedDifficulty === 'easy' ? 'rgba(100, 255, 150, 0.7)' :
                this.selectedDifficulty === 'medium' ? 'rgba(255, 200, 100, 0.7)' :
                    'rgba(255, 100, 100, 0.7)';

            renderer.drawScreenRoundRect(
                p.x + 10, diffY, p.width - 20, 35, 6,
                'rgba(40, 50, 70, 0.8)', diffColor, 1
            );
            renderer.drawScreenText(
                diffLabel,
                p.x + p.width / 2, diffY + 17,
                '#ffffff', 11, 'center', 'middle'
            );

            this.addButton('btn-difficulty', '',
                p.x + 10, diffY, p.width - 20, 35,
                () => this.cycleDifficulty());
        }

        // Queue button (only shows when mode selected)
        if (this.selectedMode) {
            const queueY = this.playMenuState === 'training' ? backY + 90 : backY + 45;
            renderer.drawScreenRoundRect(
                p.x + 10, queueY, p.width - 20, 40, 6,
                'rgba(60, 180, 120, 0.3)', 'rgba(80, 220, 150, 0.8)', 2
            );

            // Different text for training vs online
            const actionText = this.playMenuState === 'training' ? '▶ START' : '▶ FIND MATCH';
            renderer.drawScreenText(
                actionText,
                p.x + p.width / 2, queueY + 20,
                '#ffffff', 14, 'center', 'middle'
            );

            this.addButton('btn-find-match', '',
                p.x + 10, queueY, p.width - 20, 40,
                () => this.startQueue());
        }
    }

    private addModeCardHitbox(mode: ModeCard, x: number, y: number, w: number, h: number): void {
        const id = `mode-${mode.id}`;
        if (!this.focusableElements.find(e => e.id === id)) {
            this.focusableElements.push({
                id,
                label: '',
                x, y, width: w, height: h,
                onSelect: () => {
                    this.selectedMode = mode;
                }
            });
        }
    }

    private startQueue(): void {
        if (!this.selectedMode) return;

        console.log(`[MainMenu] Starting ${this.playMenuState} for ${this.selectedMode.label}`);

        if (this.playMenuState === 'training') {
            // Start training directly with selected mode and difficulty
            if (this.startTrainingDirectCallback) {
                stopMusic();
                this.startTrainingDirectCallback(this.selectedMode.mode, this.selectedDifficulty);
                this.navigation.forceNavigateTo(AppState.IN_MATCH);
            } else {
                console.error('[MainMenu] No training callback set!');
            }
        } else {
            // For online play, navigate to matchmaking/lobby
            this.navigation.navigateTo(AppState.MATCHMAKING);
        }
    }

    private cycleDifficulty(): void {
        const difficulties = [TrainingDifficulty.EASY, TrainingDifficulty.MEDIUM, TrainingDifficulty.HARD];
        const idx = difficulties.indexOf(this.selectedDifficulty);
        this.selectedDifficulty = difficulties[(idx + 1) % difficulties.length];
    }

    private renderBackgroundEffect(ctx: ScreenContext): void {
        const { renderer, screenWidth, screenHeight } = ctx;

        const gradientAlpha = 0.02;
        for (let i = 0; i < 3; i++) {
            const y = (this.animationTime * 15 + i * 250) % (screenHeight + 200) - 100;
            renderer.drawScreenRect(0, y, screenWidth, 80, `rgba(60, 140, 255, ${gradientAlpha})`);
        }
    }

    private renderTopBar(ctx: ScreenContext): void {
        const { renderer, screenWidth } = ctx;
        const barHeight = 55;

        renderer.drawScreenRect(0, 0, screenWidth, barHeight, 'rgba(18, 22, 30, 0.98)');

        if (this.logoLoaded && this.logoImage) {
            const logoSize = 40;
            const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
            if (canvas) {
                const ctx2d = canvas.getContext('2d');
                if (ctx2d) {
                    ctx2d.drawImage(this.logoImage, 15, (barHeight - logoSize) / 2, logoSize, logoSize);
                }
            }
        }

        renderer.drawScreenText('RIFTLINE', 65, barHeight / 2, 'rgba(255, 255, 255, 0.95)', 20, 'left', 'middle');
        renderer.drawScreenText('PLAYER • LVL 1', screenWidth - 15, barHeight / 2, 'rgba(130, 140, 160, 0.7)', 12, 'right', 'middle');
        renderer.drawScreenRect(0, barHeight - 1, screenWidth, 1, 'rgba(80, 200, 255, 0.25)');
    }

    private renderLeftPanel(ctx: ScreenContext): void {
        const { renderer } = ctx;
        const p = this.leftPanel;

        renderer.drawScreenRoundRect(p.x, p.y, p.width, p.height, 8, 'rgba(22, 28, 38, 0.7)', 'rgba(45, 55, 75, 0.3)', 1);
        renderer.drawScreenText('SOCIAL', p.x + p.width / 2, p.y + 22, 'rgba(100, 180, 255, 0.8)', 12, 'center', 'middle');

        const statusY = p.y + 145;
        renderer.drawScreenRect(p.x + 10, statusY, p.width - 20, 1, 'rgba(50, 60, 80, 0.4)');
        renderer.drawScreenText('NO SQUAD', p.x + p.width / 2, statusY + 22, 'rgba(100, 110, 130, 0.5)', 11, 'center', 'middle');
        renderer.drawScreenText('0 Friends Online', p.x + p.width / 2, statusY + 42, 'rgba(80, 90, 110, 0.4)', 10, 'center', 'middle');
    }

    private renderCenterPanel(ctx: ScreenContext): void {
        const { renderer } = ctx;
        const p = this.centerPanel;

        const charCenterX = p.x + p.width / 2;
        const charCenterY = p.y + p.height * 0.4;
        const charRadius = Math.min(p.width * 0.2, p.height * 0.28);

        this.drawCircle(charCenterX, charCenterY, charRadius, 'rgba(28, 38, 52, 0.9)', 'rgba(80, 200, 255, 0.25)', 2);

        renderer.drawScreenText('⬡', charCenterX, charCenterY, 'rgba(80, 200, 255, 0.35)', 70, 'center', 'middle');
        renderer.drawScreenText('OPERATIVE', charCenterX, charCenterY + charRadius + 25, 'rgba(255, 255, 255, 0.9)', 22, 'center', 'middle');

        const customizeY = charCenterY + charRadius + 60;
        renderer.drawScreenRoundRect(charCenterX - 70, customizeY, 140, 32, 5, 'rgba(35, 45, 60, 0.7)', 'rgba(70, 90, 120, 0.5)', 1);
        renderer.drawScreenText('CUSTOMIZE →', charCenterX, customizeY + 16, 'rgba(180, 190, 210, 0.8)', 11, 'center', 'middle');

        // Hitbox for customize
        if (!this.focusableElements.find(e => e.id === 'btn-customize-center')) {
            this.focusableElements.push({
                id: 'btn-customize-center',
                label: '',
                x: charCenterX - 70, y: customizeY, width: 140, height: 32,
                onSelect: () => this.navigation.navigateTo(AppState.CUSTOMIZE_MENU)
            });
        }

        renderer.drawScreenText('AUTO RIFLE • FRAG • DASH', charCenterX, p.y + p.height - 50, 'rgba(100, 120, 150, 0.5)', 10, 'center', 'middle');
    }

    private renderRightPanel(ctx: ScreenContext): void {
        const { renderer } = ctx;
        const p = this.rightPanel;

        renderer.drawScreenRoundRect(p.x, p.y, p.width, p.height, 8, 'rgba(22, 28, 38, 0.7)', 'rgba(45, 55, 75, 0.3)', 1);

        const headerText = this.playMenuState === 'closed'
            ? 'PLAY'
            : this.playMenuState === 'quickplay'
                ? 'QUICK PLAY'
                : this.playMenuState === 'ranked'
                    ? 'RANKED'
                    : 'TRAINING';
        const headerColor = this.playMenuState === 'closed'
            ? 'rgba(100, 255, 180, 0.8)'
            : 'rgba(80, 200, 255, 0.9)';

        renderer.drawScreenText(headerText, p.x + p.width / 2, p.y + 22, headerColor, 12, 'center', 'middle');

        if (this.playMenuState === 'closed') {
            const statusY = p.y + 250;
            renderer.drawScreenRect(p.x + 10, statusY, p.width - 20, 1, 'rgba(50, 60, 80, 0.4)');
            renderer.drawScreenText('PLAYERS IN QUEUE: --', p.x + p.width / 2, statusY + 18, 'rgba(80, 90, 110, 0.4)', 10, 'center', 'middle');
        }
    }

    private renderBottomBar(ctx: ScreenContext): void {
        const { renderer, screenWidth, screenHeight } = ctx;
        const barHeight = 45;
        const barY = screenHeight - barHeight;

        renderer.drawScreenRect(0, barY, screenWidth, barHeight, 'rgba(12, 15, 20, 0.98)');
        renderer.drawScreenRect(0, barY, screenWidth, 1, 'rgba(45, 55, 75, 0.4)');
        renderer.drawScreenText('v0.1.0 ALPHA', screenWidth / 2, barY + barHeight / 2, 'rgba(60, 70, 90, 0.5)', 9, 'center', 'middle');
    }

    private drawCircle(cx: number, cy: number, radius: number, fill: string, stroke?: string, strokeWidth?: number): void {
        const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fillStyle = fill;
        ctx.fill();

        if (stroke && strokeWidth) {
            ctx.strokeStyle = stroke;
            ctx.lineWidth = strokeWidth;
            ctx.stroke();
        }
    }

    handleBack(): void {
        if (this.playMenuState !== 'closed') {
            this.playMenuState = 'closed';
            this.selectedMode = null;
            this.buttonsInitialized = false;
        } else {
            this.navigation.navigateTo(AppState.EXIT_CONFIRM);
        }
    }
}
