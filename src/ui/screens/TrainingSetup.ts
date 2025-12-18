// Training Setup Screen
// Solo offline practice for all game modes

import { BaseScreen, ScreenContext } from './BaseScreen';
import { AppState, GameMode, TrainingDifficulty } from '../../core/types';
import { stopMusic } from '../../core/audio';

// Callback type for starting training
type StartTrainingCallback = (mode: GameMode, difficulty: TrainingDifficulty) => void;

export class TrainingSetup extends BaseScreen {
    private startTrainingCallback: StartTrainingCallback | null = null;
    private selectedMode: GameMode = GameMode.MAIN;
    private selectedDifficulty: TrainingDifficulty = TrainingDifficulty.MEDIUM;

    // All modes available for training (offline practice)
    private modes: GameMode[] = [
        GameMode.MAIN,
        GameMode.ARENA_1V1,
        GameMode.ARENA_1V1V1,
        GameMode.ARENA_3V3,
        GameMode.ARENA_3V3V3,
    ];

    private difficulties: TrainingDifficulty[] = [
        TrainingDifficulty.EASY,
        TrainingDifficulty.MEDIUM,
        TrainingDifficulty.HARD
    ];

    constructor() {
        super(AppState.TRAINING_SETUP);
    }

    setStartTrainingCallback(callback: StartTrainingCallback): void {
        this.startTrainingCallback = callback;
    }

    onEnter(): void {
        this.clearButtons();
        super.onEnter();
    }

    private setupButtons(ctx: ScreenContext): void {
        this.layoutButtonsVertical([
            {
                id: 'btn-mode',
                label: `MODE: ${this.getModeLabel(this.selectedMode)}`,
                onSelect: () => {
                    const idx = this.modes.indexOf(this.selectedMode);
                    const nextIdx = (idx + 1) % this.modes.length;
                    this.selectedMode = this.modes[nextIdx];
                    this.clearButtons(); // Rebuild to update labels
                },
            },
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
                label: 'START TRAINING',
                onSelect: () => {
                    if (this.startTrainingCallback) {
                        // Fade out lobby music
                        stopMusic();
                        this.startTrainingCallback(this.selectedMode, this.selectedDifficulty);
                        this.navigation.forceNavigateTo(AppState.IN_MATCH);
                    }
                },
            },
            {
                id: 'btn-back',
                label: 'BACK',
                onSelect: () => this.navigation.goBack(),
            },
        ], ctx, ctx.screenHeight * 0.35);
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
        this.renderTitle(ctx, 'TRAINING');
        this.renderSubtitle(ctx, 'Practice offline against bots');

        // Render buttons
        this.renderButtons(ctx);

        // Mode description
        const modeDescription = this.getModeDescription(this.selectedMode);
        renderer.drawScreenText(
            modeDescription,
            screenWidth / 2,
            screenHeight - 100,
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

    private getModeDescription(mode: GameMode): string {
        switch (mode) {
            case GameMode.MAIN:
                return "10 Squads • 3 Players Each • Collect & Plant Relics";
            case GameMode.ARENA_1V1:
                return "1v1 Duel • Pure Elimination";
            case GameMode.ARENA_1V1V1:
                return "Free-for-All • Last Player Standing";
            case GameMode.ARENA_3V3:
                return "Team vs Team • Round-Based";
            case GameMode.ARENA_3V3V3:
                return "3-Way Team Battle • High Chaos";
            default:
                return "";
        }
    }

    handleBack(): void {
        this.navigation.goBack();
    }
}
