// Training Setup Screen
// Solo offline practice for all game modes - select mode to instantly start

import { BaseScreen, ScreenContext } from './BaseScreen';
import { AppState, GameMode, TrainingDifficulty } from '../../core/types';
import { stopMusic } from '../../core/audio';

// Callback type for starting training
type StartTrainingCallback = (mode: GameMode, difficulty: TrainingDifficulty) => void;

export class TrainingSetup extends BaseScreen {
    private startTrainingCallback: StartTrainingCallback | null = null;
    private selectedDifficulty: TrainingDifficulty = TrainingDifficulty.MEDIUM;

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

    private startMode(mode: GameMode): void {
        if (this.startTrainingCallback) {
            stopMusic();
            this.startTrainingCallback(mode, this.selectedDifficulty);
            this.navigation.forceNavigateTo(AppState.IN_MATCH);
        }
    }

    onEnter(): void {
        this.clearButtons();
        super.onEnter();
    }

    private setupButtons(ctx: ScreenContext): void {
        this.layoutButtonsVertical([
            // Quick Play modes - click to start immediately
            {
                id: 'btn-main',
                label: 'RIFTLINE (30 Player)',
                onSelect: () => this.startMode(GameMode.MAIN),
            },
            {
                id: 'btn-1v1',
                label: 'ARENA 1v1',
                onSelect: () => this.startMode(GameMode.ARENA_1V1),
            },
            {
                id: 'btn-1v1v1',
                label: 'ARENA 1v1v1',
                onSelect: () => this.startMode(GameMode.ARENA_1V1V1),
            },
            {
                id: 'btn-3v3',
                label: 'ARENA 3v3',
                onSelect: () => this.startMode(GameMode.ARENA_3V3),
            },
            {
                id: 'btn-3v3v3',
                label: 'ARENA 3v3v3',
                onSelect: () => this.startMode(GameMode.ARENA_3V3V3),
            },
            // Difficulty toggle (optional)
            {
                id: 'btn-difficulty',
                label: `DIFFICULTY: ${this.selectedDifficulty.toUpperCase()}`,
                onSelect: () => {
                    const idx = this.difficulties.indexOf(this.selectedDifficulty);
                    const nextIdx = (idx + 1) % this.difficulties.length;
                    this.selectedDifficulty = this.difficulties[nextIdx];
                    this.refreshButtonLabel('btn-difficulty', `DIFFICULTY: ${this.selectedDifficulty.toUpperCase()}`);
                },
            },
            {
                id: 'btn-back',
                label: 'BACK',
                onSelect: () => this.navigation.goBack(),
            },
        ], ctx, ctx.screenHeight * 0.18, 200, 40, 8);
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
        this.renderSubtitle(ctx, 'Select a mode to start vs bots');

        // Render buttons
        this.renderButtons(ctx);

        // Footer hint
        renderer.drawScreenText(
            ctx.isMobile ? 'TAP mode to start' : 'SELECT mode to start • ESC to go back',
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
