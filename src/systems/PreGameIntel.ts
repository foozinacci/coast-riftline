// Pre-Game Intel System
// Per spec: Visual-first, icon-driven intel presentation before match start
// Duration: 5-12 seconds max, skippable when all players ready

import { Vector2, GameMode, SpawnLocation, TrainingDifficulty } from '../core/types';
import { ModeConfig, isArenaMode } from '../core/modeConfig';
import { Renderer } from '../core/renderer';
import { SpawnVotingManager } from './SpawnVoting';

// ============================================================================
// INTEL PHASES
// ============================================================================

export type IntelPhase =
    | 'idle'
    | 'objective'      // Show objective layer
    | 'map'            // Show map layer
    | 'player'         // Show player layer
    | 'voting'         // Spawn voting (relic mode only)
    | 'transition'     // Transitioning to gameplay
    | 'complete';

// ============================================================================
// MODE-SPECIFIC INTEL CONTENT
// ============================================================================

export interface ObjectiveContent {
    headline: string;
    sublines: string[];
    matchFormat?: string; // e.g., "BEST OF 3"
}

export interface MapContent {
    arenaName?: string;
    arenaHint?: string;    // e.g., "Compact Arena – Fast Respawns"
    showSpawnZones: boolean;
    showRelicZones: boolean;
    showCampfires: boolean;
    showWildcards: boolean;
    coverDensity?: 'Light' | 'Medium' | 'Heavy';
}

export interface PlayerContent {
    className: string;
    classColor: string;
    passiveDescription: string;
    loadoutName: string;
}

export interface TrainingContent {
    difficulty: TrainingDifficulty;
    difficultyHint: string;
    showFullMap: boolean;
}

// ============================================================================
// PREGAME INTEL MANAGER
// ============================================================================

export class PreGameIntelManager {
    private phase: IntelPhase = 'idle';
    private phaseTimer: number = 0;
    private totalDuration: number = 8000; // 8 seconds default
    private animationProgress: number = 0;

    // Phase durations (in ms)
    private phaseDurations = {
        objective: 2500,   // 2.5s for objective
        map: 2500,         // 2.5s for map
        player: 1500,      // 1.5s for player
        voting: 8000,      // 8s for voting (if enabled)
        transition: 1000,  // 1s fade out
    };

    // Content
    private objectiveContent: ObjectiveContent | null = null;
    private mapContent: MapContent | null = null;
    private playerContent: PlayerContent | null = null;
    private trainingContent: TrainingContent | null = null;

    // Mode info
    private mode: GameMode = GameMode.MAIN;
    private modeConfig: ModeConfig | null = null;
    private difficulty: TrainingDifficulty = TrainingDifficulty.MEDIUM;

    // Voting integration
    private spawnVotingManager: SpawnVotingManager | null = null;
    private selectedSpawnId: string | null = null;
    private votingEnabled: boolean = false;

    // Callbacks
    private onComplete: (() => void) | null = null;
    private onSpawnSelected: ((spawnId: string) => void) | null = null;

    // Camera target for map panning
    private cameraTarget: Vector2 = { x: 0, y: 0 };
    private mapCenter: Vector2 = { x: 0, y: 0 };

    // Skip state
    private skipRequested: boolean = false;
    private allPlayersReady: boolean = false; // For multiplayer skip

    constructor() {
        this.reset();
    }

    // ============================================================================
    // INITIALIZATION
    // ============================================================================

    /**
     * Start the Pre-Game Intel sequence
     */
    start(
        mode: GameMode,
        modeConfig: ModeConfig,
        difficulty: TrainingDifficulty,
        mapCenter: Vector2,
        spawnVotingManager?: SpawnVotingManager
    ): void {
        this.mode = mode;
        this.modeConfig = modeConfig;
        this.difficulty = difficulty;
        this.mapCenter = mapCenter;
        this.cameraTarget = mapCenter;
        this.spawnVotingManager = spawnVotingManager || null;

        // Generate mode-specific content
        this.generateContent();

        // Calculate total duration based on mode
        this.totalDuration = this.calculateDuration();

        // Start with objective phase
        this.phase = 'objective';
        this.phaseTimer = 0;
        this.animationProgress = 0;
        this.skipRequested = false;

        console.log(`[PreGameIntel] Started for mode: ${mode}, duration: ${this.totalDuration}ms`);
    }

    /**
     * Generate content based on mode
     */
    private generateContent(): void {
        if (!this.modeConfig) return;

        // Generate Objective Content
        this.objectiveContent = this.generateObjectiveContent();

        // Generate Map Content
        this.mapContent = this.generateMapContent();

        // Generate Player Content (placeholder - would come from player state)
        this.playerContent = {
            className: 'SCOUT',
            classColor: 'rgba(100, 255, 200, 1)',
            passiveDescription: 'Momentum Trail (Speed Boost)',
            loadoutName: 'Auto Rifle',
        };

        // Generate Training Content if applicable
        if (this.mode === GameMode.TRAINING) {
            this.trainingContent = this.generateTrainingContent();
        }

        // Enable voting for ranked relic mode (currently disabled for casual)
        this.votingEnabled = this.modeConfig.spawnVotingEnabled && this.modeConfig.hasRelics;
    }

    /**
     * Generate objective content based on mode
     */
    private generateObjectiveContent(): ObjectiveContent {
        if (isArenaMode(this.mode)) {
            // Arena modes - simple elimination
            const isMultiTeam = this.mode === GameMode.ARENA_1V1V1 || this.mode === GameMode.ARENA_3V3V3;

            return {
                headline: isMultiTeam ? 'LAST TEAM STANDING' : 'ELIMINATE THE OPPOSING TEAM',
                sublines: [],
                matchFormat: this.modeConfig?.roundsToWin === 2 ? 'BEST OF 3' : 'BEST OF 5',
            };
        }

        if (this.mode === GameMode.TRAINING) {
            return {
                headline: 'TRAINING MODE',
                sublines: ['OBJECTIVE ACTIVE'],
                matchFormat: undefined,
            };
        }

        // Main/Relic mode - progressive reveal
        return {
            headline: 'SECURE RELICS',
            sublines: [
                'PLANT RELICS',
                'UNLOCK THE VAULT',
                'CONTROL THE VAULT TO WIN',
            ],
            matchFormat: undefined,
        };
    }

    /**
     * Generate map content based on mode
     */
    private generateMapContent(): MapContent {
        if (isArenaMode(this.mode)) {
            // Arena - minimal info
            return {
                arenaName: this.getArenaName(),
                arenaHint: this.getArenaHint(),
                showSpawnZones: true,
                showRelicZones: false,
                showCampfires: false,
                showWildcards: false,
                coverDensity: 'Medium',
            };
        }

        if (this.mode === GameMode.TRAINING) {
            // Training - full visibility
            return {
                showSpawnZones: true,
                showRelicZones: true,
                showCampfires: true,
                showWildcards: true,
            };
        }

        // Main/Relic mode - strategic info
        return {
            showSpawnZones: true,
            showRelicZones: true,
            showCampfires: true,
            showWildcards: true,
        };
    }

    /**
     * Generate training-specific content
     */
    private generateTrainingContent(): TrainingContent {
        const hints: Record<TrainingDifficulty, string> = {
            [TrainingDifficulty.EASY]: 'Reduced damage, slow enemies',
            [TrainingDifficulty.MEDIUM]: 'Standard behavior',
            [TrainingDifficulty.HARD]: 'Aggressive AI, faster respawns',
        };

        return {
            difficulty: this.difficulty,
            difficultyHint: hints[this.difficulty],
            showFullMap: true,
        };
    }

    /**
     * Get arena name based on mode
     */
    private getArenaName(): string {
        // In a full implementation, this would be based on actual arena selection
        const names: Record<GameMode, string> = {
            [GameMode.ARENA_1V1]: 'Duelist Arena',
            [GameMode.ARENA_1V1V1]: 'Triple Threat',
            [GameMode.ARENA_3V3]: 'Team Arena',
            [GameMode.ARENA_3V3V3]: 'Chaos Arena',
            [GameMode.MAIN]: '',
            [GameMode.TRAINING]: '',
        };
        return names[this.mode] || 'Arena';
    }

    /**
     * Get arena hint based on arena characteristics
     */
    private getArenaHint(): string {
        // Would be based on actual arena properties
        const hints = [
            'Compact Arena – Fast Respawns',
            'Wide Arena – High Mobility',
            'Cluttered Arena – Heavy Cover',
            'Open Arena – Long Sightlines',
        ];
        return hints[Math.floor(Math.random() * hints.length)];
    }

    /**
     * Calculate total duration based on mode and features
     */
    private calculateDuration(): number {
        let duration = 0;

        duration += this.phaseDurations.objective;
        duration += this.phaseDurations.map;
        duration += this.phaseDurations.player;

        if (this.votingEnabled) {
            duration += this.phaseDurations.voting;
        }

        duration += this.phaseDurations.transition;

        // Cap at 12 seconds as per spec
        return Math.min(duration, 12000);
    }

    // ============================================================================
    // UPDATE
    // ============================================================================

    /**
     * Update the intel sequence
     */
    update(deltaMs: number): void {
        if (this.phase === 'idle' || this.phase === 'complete') return;

        this.phaseTimer += deltaMs;

        // Calculate animation progress for current phase
        const phaseDuration = this.getCurrentPhaseDuration();
        this.animationProgress = Math.min(1, this.phaseTimer / phaseDuration);

        // Handle skip
        if (this.skipRequested && this.canSkip()) {
            this.complete();
            return;
        }

        // Phase transitions
        if (this.phaseTimer >= phaseDuration) {
            this.advancePhase();
        }
    }

    /**
     * Get current phase duration
     */
    private getCurrentPhaseDuration(): number {
        switch (this.phase) {
            case 'objective': return this.phaseDurations.objective;
            case 'map': return this.phaseDurations.map;
            case 'player': return this.phaseDurations.player;
            case 'voting': return this.phaseDurations.voting;
            case 'transition': return this.phaseDurations.transition;
            default: return 1000;
        }
    }

    /**
     * Advance to next phase
     */
    private advancePhase(): void {
        this.phaseTimer = 0;
        this.animationProgress = 0;

        switch (this.phase) {
            case 'objective':
                this.phase = 'map';
                break;
            case 'map':
                this.phase = 'player';
                break;
            case 'player':
                if (this.votingEnabled && this.spawnVotingManager) {
                    this.phase = 'voting';
                } else {
                    this.phase = 'transition';
                }
                break;
            case 'voting':
                // Finalize voting before transition
                this.finalizeVoting();
                this.phase = 'transition';
                break;
            case 'transition':
                this.complete();
                break;
        }

        console.log(`[PreGameIntel] Phase: ${this.phase}`);
    }

    /**
     * Complete the intel sequence
     */
    private complete(): void {
        this.phase = 'complete';
        if (this.onComplete) {
            this.onComplete();
        }
    }

    /**
     * Finalize spawn voting
     */
    private finalizeVoting(): void {
        if (!this.spawnVotingManager) return;

        // If player hasn't voted, auto-vote first available
        if (!this.selectedSpawnId) {
            const locations = this.spawnVotingManager.getLocations();
            if (locations.length > 0) {
                this.selectedSpawnId = locations[0].id;
            }
        }

        if (this.selectedSpawnId && this.onSpawnSelected) {
            this.onSpawnSelected(this.selectedSpawnId);
        }
    }

    // ============================================================================
    // RENDERING
    // ============================================================================

    /**
     * Render the intel UI
     */
    render(renderer: Renderer, screenWidth: number, screenHeight: number): void {
        if (this.phase === 'idle' || this.phase === 'complete') return;

        const ctx = renderer.getContext();

        // Dark overlay
        ctx.save();
        ctx.fillStyle = 'rgba(10, 12, 18, 0.85)';
        ctx.fillRect(0, 0, screenWidth, screenHeight);

        // Render current phase content
        switch (this.phase) {
            case 'objective':
                this.renderObjectiveLayer(ctx, screenWidth, screenHeight);
                break;
            case 'map':
                this.renderMapLayer(ctx, screenWidth, screenHeight);
                break;
            case 'player':
                this.renderPlayerLayer(ctx, screenWidth, screenHeight);
                break;
            case 'voting':
                this.renderVotingLayer(ctx, screenWidth, screenHeight);
                break;
            case 'transition':
                this.renderTransition(ctx, screenWidth, screenHeight);
                break;
        }

        // Phase indicator
        this.renderPhaseIndicator(ctx, screenWidth, screenHeight);

        // Skip hint
        this.renderSkipHint(ctx, screenWidth, screenHeight);

        ctx.restore();
    }

    /**
     * Render Objective Layer
     */
    private renderObjectiveLayer(ctx: CanvasRenderingContext2D, w: number, h: number): void {
        if (!this.objectiveContent) return;

        const centerY = h * 0.4;
        const progress = this.easeOutCubic(this.animationProgress);

        // Headline with slide-in animation
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const headlineAlpha = Math.min(1, progress * 2);
        const headlineOffset = (1 - progress) * 50;

        ctx.font = 'bold 48px "Outfit", sans-serif';
        ctx.fillStyle = `rgba(255, 255, 255, ${headlineAlpha})`;
        ctx.fillText(this.objectiveContent.headline, w / 2, centerY - headlineOffset);

        // Match format (if present)
        if (this.objectiveContent.matchFormat) {
            ctx.font = '24px "Outfit", sans-serif';
            ctx.fillStyle = `rgba(100, 200, 255, ${headlineAlpha * 0.9})`;
            ctx.fillText(this.objectiveContent.matchFormat, w / 2, centerY + 50 - headlineOffset);
        }

        // Sublines (progressive reveal for relic mode)
        const sublines = this.objectiveContent.sublines;
        if (sublines.length > 0) {
            const sublineStartProgress = 0.3;
            const sublineProgress = Math.max(0, (this.animationProgress - sublineStartProgress) / (1 - sublineStartProgress));

            ctx.font = '20px "Outfit", sans-serif';

            sublines.forEach((line, index) => {
                const lineProgress = Math.max(0, sublineProgress - (index * 0.2));
                const lineAlpha = Math.min(1, lineProgress * 3);

                ctx.fillStyle = `rgba(180, 185, 195, ${lineAlpha})`;
                ctx.fillText(line, w / 2, centerY + 80 + index * 30);
            });
        }
    }

    /**
     * Render Map Layer
     */
    private renderMapLayer(ctx: CanvasRenderingContext2D, w: number, h: number): void {
        if (!this.mapContent) return;

        const progress = this.easeOutCubic(this.animationProgress);
        const alpha = Math.min(1, progress * 2);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Arena modes show arena name and hint
        if (isArenaMode(this.mode) && this.mapContent.arenaName) {
            ctx.font = 'bold 36px "Outfit", sans-serif';
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.fillText(this.mapContent.arenaName, w / 2, h * 0.35);

            if (this.mapContent.arenaHint) {
                ctx.font = '18px "Outfit", sans-serif';
                ctx.fillStyle = `rgba(150, 180, 200, ${alpha})`;
                ctx.fillText(this.mapContent.arenaHint, w / 2, h * 0.35 + 40);
            }

            // Cover density
            if (this.mapContent.coverDensity) {
                ctx.font = '16px "Outfit", sans-serif';
                ctx.fillStyle = `rgba(100, 150, 180, ${alpha})`;
                ctx.fillText(`Cover: ${this.mapContent.coverDensity}`, w / 2, h * 0.35 + 70);
            }
        }

        // Title
        ctx.font = 'bold 24px "Outfit", sans-serif';
        ctx.fillStyle = `rgba(100, 200, 255, ${alpha})`;
        ctx.fillText('MAP INTEL', w / 2, h * 0.2);

        // Icon legend (bottom area)
        this.renderMapLegend(ctx, w, h, alpha);
    }

    /**
     * Render map legend icons
     */
    private renderMapLegend(ctx: CanvasRenderingContext2D, w: number, h: number, alpha: number): void {
        if (!this.mapContent) return;

        const legendY = h * 0.6;
        const iconSize = 24;
        const spacing = 120;
        const icons: { label: string; color: string; shown: boolean }[] = [];

        if (this.mapContent.showSpawnZones) {
            icons.push({ label: 'SPAWN', color: '#44ff88', shown: true });
        }
        if (this.mapContent.showRelicZones) {
            icons.push({ label: 'RELIC', color: '#ffaa00', shown: true });
        }
        if (this.mapContent.showCampfires) {
            icons.push({ label: 'CAMPFIRE', color: '#ff6644', shown: true });
        }
        if (this.mapContent.showWildcards) {
            icons.push({ label: 'WILDCARD', color: '#aa44ff', shown: true });
        }

        const totalWidth = (icons.length - 1) * spacing;
        const startX = (w - totalWidth) / 2;

        ctx.font = '14px "Outfit", sans-serif';
        ctx.textAlign = 'center';

        icons.forEach((icon, index) => {
            const x = startX + index * spacing;

            // Icon circle
            ctx.beginPath();
            ctx.arc(x, legendY, iconSize / 2, 0, Math.PI * 2);
            ctx.fillStyle = icon.color.replace(')', `, ${alpha})`).replace('rgb', 'rgba').replace('#', '');
            // Convert hex to rgba
            const r = parseInt(icon.color.slice(1, 3), 16);
            const g = parseInt(icon.color.slice(3, 5), 16);
            const b = parseInt(icon.color.slice(5, 7), 16);
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
            ctx.fill();

            // Label
            ctx.fillStyle = `rgba(200, 205, 215, ${alpha})`;
            ctx.fillText(icon.label, x, legendY + 30);
        });
    }

    /**
     * Render Player Layer
     */
    private renderPlayerLayer(ctx: CanvasRenderingContext2D, w: number, h: number): void {
        if (!this.playerContent) return;

        const progress = this.easeOutCubic(this.animationProgress);
        const alpha = Math.min(1, progress * 2);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Training mode extras
        if (this.mode === GameMode.TRAINING && this.trainingContent) {
            ctx.font = 'bold 28px "Outfit", sans-serif';
            ctx.fillStyle = `rgba(255, 200, 100, ${alpha})`;
            ctx.fillText(`DIFFICULTY: ${this.trainingContent.difficulty.toUpperCase()}`, w / 2, h * 0.25);

            ctx.font = '16px "Outfit", sans-serif';
            ctx.fillStyle = `rgba(180, 165, 140, ${alpha})`;
            ctx.fillText(this.trainingContent.difficultyHint, w / 2, h * 0.25 + 30);
        }

        // Class name with color
        ctx.font = 'bold 36px "Outfit", sans-serif';
        ctx.fillStyle = this.playerContent.classColor.replace('1)', `${alpha})`);
        ctx.fillText(this.playerContent.className, w / 2, h * 0.4);

        // Passive description
        ctx.font = '18px "Outfit", sans-serif';
        ctx.fillStyle = `rgba(180, 185, 195, ${alpha})`;
        ctx.fillText(this.playerContent.passiveDescription, w / 2, h * 0.4 + 40);

        // Loadout
        ctx.font = '16px "Outfit", sans-serif';
        ctx.fillStyle = `rgba(150, 155, 165, ${alpha})`;
        ctx.fillText(`Loadout: ${this.playerContent.loadoutName}`, w / 2, h * 0.4 + 70);
    }

    /**
     * Render Voting Layer
     */
    private renderVotingLayer(ctx: CanvasRenderingContext2D, w: number, h: number): void {
        if (!this.spawnVotingManager) return;

        const alpha = Math.min(1, this.animationProgress * 3);
        const locations = this.spawnVotingManager.getLocations();

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Title
        ctx.font = 'bold 28px "Outfit", sans-serif';
        ctx.fillStyle = `rgba(100, 200, 255, ${alpha})`;
        ctx.fillText('SELECT SPAWN ZONE', w / 2, h * 0.15);

        // Timer
        const timeRemaining = this.spawnVotingManager.getTimeRemaining();
        ctx.font = '20px "Outfit", sans-serif';
        ctx.fillStyle = timeRemaining < 5 ? `rgba(255, 100, 100, ${alpha})` : `rgba(255, 255, 255, ${alpha})`;
        ctx.fillText(`${Math.ceil(timeRemaining)}s`, w / 2, h * 0.15 + 35);

        // Spawn options (simplified visual - in real UI would show map)
        const optionWidth = 100;
        const optionHeight = 80;
        const totalWidth = locations.length * optionWidth + (locations.length - 1) * 20;
        const startX = (w - totalWidth) / 2;
        const optionY = h * 0.45;

        locations.forEach((loc, index) => {
            const x = startX + index * (optionWidth + 20);
            const isSelected = this.selectedSpawnId === loc.id;

            // Option box
            ctx.fillStyle = isSelected
                ? `rgba(100, 255, 200, ${alpha * 0.3})`
                : `rgba(50, 55, 65, ${alpha * 0.5})`;
            ctx.fillRect(x, optionY, optionWidth, optionHeight);

            // Border
            ctx.strokeStyle = isSelected
                ? `rgba(100, 255, 200, ${alpha})`
                : `rgba(100, 105, 115, ${alpha})`;
            ctx.lineWidth = isSelected ? 3 : 1;
            ctx.strokeRect(x, optionY, optionWidth, optionHeight);

            // Label
            ctx.font = '14px "Outfit", sans-serif';
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.fillText(`Zone ${index + 1}`, x + optionWidth / 2, optionY + optionHeight / 2);

            // Vote count (placeholder)
            const tally = this.spawnVotingManager!.getVoteTally('player_squad');
            const votes = tally.get(loc.id) || 0;
            if (votes > 0) {
                ctx.font = '12px "Outfit", sans-serif';
                ctx.fillStyle = `rgba(100, 255, 200, ${alpha})`;
                ctx.fillText(`${votes} vote${votes > 1 ? 's' : ''}`, x + optionWidth / 2, optionY + optionHeight + 15);
            }
        });

        // Hint
        ctx.font = '14px "Outfit", sans-serif';
        ctx.fillStyle = `rgba(150, 155, 165, ${alpha})`;
        ctx.fillText('Click to vote • Majority wins', w / 2, h * 0.75);
    }

    /**
     * Render transition effect
     */
    private renderTransition(ctx: CanvasRenderingContext2D, w: number, h: number): void {
        const progress = this.animationProgress;

        // Fade to game
        ctx.font = 'bold 32px "Outfit", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = `rgba(255, 255, 255, ${1 - progress})`;
        ctx.fillText('DEPLOYING...', w / 2, h / 2);
    }

    /**
     * Render phase indicator dots
     */
    private renderPhaseIndicator(ctx: CanvasRenderingContext2D, w: number, h: number): void {
        const phases = ['objective', 'map', 'player'];
        if (this.votingEnabled) phases.push('voting');

        const currentIndex = phases.indexOf(this.phase);
        const dotSize = 8;
        const dotSpacing = 20;
        const totalWidth = (phases.length - 1) * dotSpacing;
        const startX = (w - totalWidth) / 2;
        const y = h * 0.9;

        phases.forEach((_, index) => {
            const x = startX + index * dotSpacing;
            const isActive = index === currentIndex;
            const isPast = index < currentIndex;

            ctx.beginPath();
            ctx.arc(x, y, dotSize / 2, 0, Math.PI * 2);

            if (isActive) {
                ctx.fillStyle = 'rgba(100, 200, 255, 1)';
            } else if (isPast) {
                ctx.fillStyle = 'rgba(100, 200, 255, 0.5)';
            } else {
                ctx.fillStyle = 'rgba(100, 105, 115, 0.5)';
            }
            ctx.fill();
        });
    }

    /**
     * Render skip hint
     */
    private renderSkipHint(ctx: CanvasRenderingContext2D, w: number, h: number): void {
        if (this.phase === 'transition') return;

        ctx.font = '14px "Outfit", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = 'rgba(100, 105, 115, 0.7)';
        ctx.fillText('Press SPACE or ENTER to skip', w / 2, h - 20);
    }

    // ============================================================================
    // CONTROLS
    // ============================================================================

    /**
     * Request skip (only works when allowed)
     */
    skip(): void {
        this.skipRequested = true;
    }

    /**
     * Check if skip is allowed
     */
    private canSkip(): boolean {
        // Can always skip in single player
        // In multiplayer, would require all players ready
        return true;
    }

    /**
     * Select a spawn zone (for voting)
     */
    selectSpawn(spawnId: string): void {
        if (this.phase !== 'voting') return;
        this.selectedSpawnId = spawnId;

        // Cast vote
        if (this.spawnVotingManager) {
            this.spawnVotingManager.castVote('player_squad', 'local_player', spawnId);
        }
    }

    // ============================================================================
    // CALLBACKS
    // ============================================================================

    setOnComplete(callback: () => void): void {
        this.onComplete = callback;
    }

    setOnSpawnSelected(callback: (spawnId: string) => void): void {
        this.onSpawnSelected = callback;
    }

    // ============================================================================
    // STATE
    // ============================================================================

    isActive(): boolean {
        return this.phase !== 'idle' && this.phase !== 'complete';
    }

    isComplete(): boolean {
        return this.phase === 'complete';
    }

    getPhase(): IntelPhase {
        return this.phase;
    }

    getCameraTarget(): Vector2 {
        return this.cameraTarget;
    }

    reset(): void {
        this.phase = 'idle';
        this.phaseTimer = 0;
        this.animationProgress = 0;
        this.objectiveContent = null;
        this.mapContent = null;
        this.playerContent = null;
        this.trainingContent = null;
        this.selectedSpawnId = null;
        this.skipRequested = false;
    }

    // ============================================================================
    // UTILITIES
    // ============================================================================

    private easeOutCubic(t: number): number {
        return 1 - Math.pow(1 - t, 3);
    }
}
