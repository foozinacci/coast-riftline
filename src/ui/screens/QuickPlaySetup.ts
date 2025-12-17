// Quick Play Setup Screen
// Spec B.6: Find Match options before matchmaking

import { BaseScreen, ScreenContext } from './BaseScreen';
import { AppState } from '../../core/types';

import { GameMode, TrainingDifficulty, MatchStructure } from '../../core/types';

// Callback type for starting the game with config
type StartGameCallback = (mode: GameMode, difficulty?: TrainingDifficulty) => void;

export class QuickPlaySetup extends BaseScreen {
    private startGameCallback: StartGameCallback | null = null;
    private selectedMode: GameMode = GameMode.MAIN;
    private selectedDifficulty: TrainingDifficulty = TrainingDifficulty.MEDIUM;
    private selectedStructure: MatchStructure = MatchStructure.BEST_OF_3;
    private modes: GameMode[] = [
        GameMode.MAIN,
        GameMode.ARENA_1V1,
        GameMode.ARENA_1V1V1,
        GameMode.ARENA_3V3,
        GameMode.ARENA_3V3V3,
    ];
    private structures: MatchStructure[] = [
        MatchStructure.BEST_OF_3,
        MatchStructure.BEST_OF_5,
    ];
    private difficulties: TrainingDifficulty[] = [
        TrainingDifficulty.EASY,
        TrainingDifficulty.MEDIUM,
        TrainingDifficulty.HARD
    ];

    constructor() {
        super(AppState.QUICK_PLAY_SETUP);
    }

    /**
     * Set the callback to start the actual game.
     */
    setStartGameCallback(callback: StartGameCallback): void {
        this.startGameCallback = callback;
    }

    onEnter(): void {
        this.clearButtons(); // Force re-setup of buttons to ensure clean state
        super.onEnter();
    }

    private setupButtons(ctx: ScreenContext): void {
        // Build button list based on selected mode
        const isArenaMode = this.selectedMode !== GameMode.MAIN;

        this.layoutButtonsVertical([
            {
                id: 'btn-mode',
                label: `MODE: ${this.getModeLabel(this.selectedMode)}`,
                onSelect: () => {
                    const idx = this.modes.indexOf(this.selectedMode);
                    const nextIdx = (idx + 1) % this.modes.length;
                    this.selectedMode = this.modes[nextIdx];
                    this.clearButtons();
                },
            },
            // Structure selector only for Arena modes
            ...(isArenaMode ? [{
                id: 'btn-structure',
                label: `FORMAT: ${this.getStructureLabel(this.selectedStructure)}`,
                onSelect: () => {
                    const idx = this.structures.indexOf(this.selectedStructure);
                    const nextIdx = (idx + 1) % this.structures.length;
                    this.selectedStructure = this.structures[nextIdx];
                    this.refreshButtonLabel('btn-structure', `FORMAT: ${this.getStructureLabel(this.selectedStructure)}`);
                },
            }] : []),
            {
                id: 'btn-difficulty',
                label: `BOT DIFFICULTY: ${this.selectedDifficulty.toUpperCase()}`,
                onSelect: () => {
                    const idx = this.difficulties.indexOf(this.selectedDifficulty);
                    const nextIdx = (idx + 1) % this.difficulties.length;
                    this.selectedDifficulty = this.difficulties[nextIdx];
                    this.refreshButtonLabel('btn-difficulty', `BOT DIFFICULTY: ${this.selectedDifficulty.toUpperCase()}`);
                },
            },
            {
                id: 'btn-start',
                label: 'START MATCH',
                onSelect: () => {
                    console.log('[QuickPlaySetup] START pressed, callback exists:', !!this.startGameCallback);
                    if (this.startGameCallback) {
                        console.log('[QuickPlaySetup] Calling startGame with mode:', this.selectedMode);
                        this.startGameCallback(this.selectedMode, this.selectedDifficulty);
                        console.log('[QuickPlaySetup] Navigating to IN_MATCH');
                        this.navigation.forceNavigateTo(AppState.IN_MATCH);
                        console.log('[QuickPlaySetup] Navigation complete');
                    }
                },
            },
            {
                id: 'btn-back',
                label: 'BACK',
                onSelect: () => this.navigation.goBack(),
            },
        ], ctx, ctx.screenHeight * 0.30);
    }

    private getModeLabel(mode: GameMode): string {
        switch (mode) {
            case GameMode.MAIN: return "MAIN (RELIC)";
            case GameMode.ARENA_1V1: return "ARENA 1v1";
            case GameMode.ARENA_1V1V1: return "ARENA 1v1v1";
            case GameMode.ARENA_3V3: return "ARENA 3v3";
            case GameMode.ARENA_3V3V3: return "ARENA 3v3v3";
            default: return mode;
        }
    }

    private getStructureLabel(structure: MatchStructure): string {
        switch (structure) {
            case MatchStructure.BEST_OF_3: return "BEST OF 3";
            case MatchStructure.BEST_OF_5: return "BEST OF 5";
            default: return "SINGLE MATCH";
        }
    }

    private refreshButtonLabel(id: string, newLabel: string): void {
        const btn = this.focusableElements.find(b => b.id === id);
        if (btn) btn.label = newLabel;
    }

    render(ctx: ScreenContext): void {
        const { renderer, screenWidth, screenHeight } = ctx;

        if (this.focusableElements.length === 0) {
            this.setupButtons(ctx);
        }

        // Background
        renderer.drawScreenRect(0, 0, screenWidth, screenHeight, 'rgba(15, 18, 25, 1)');

        // Title
        this.renderTitle(ctx, 'QUICK PLAY');
        this.renderSubtitle(ctx, 'Jump into a match');

        // Render buttons
        this.renderButtons(ctx);

        // Match info
        renderer.drawScreenText(
            '10 Teams • 3 Players Each • Last Squad Standing',
            screenWidth / 2,
            screenHeight - 80,
            'rgba(120, 140, 160, 1)',
            14,
            'center',
            'middle'
        );

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
        this.navigation.goBack();
    }
}
