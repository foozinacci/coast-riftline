// Arena Round System
// Manages Best-of-X round-based arena matches
// Handles round transitions, score tracking, and win conditions

import { GameMode, MatchStructure } from '../core/types';
import { getModeConfig, ModeConfig, isArenaMode } from '../core/modeConfig';

/**
 * Round state
 */
export interface RoundState {
    roundNumber: number;
    isActive: boolean;
    startTime: number;
    timeRemaining: number;  // ms remaining
    winnerTeamId: string | null;
}

/**
 * Team score in arena match
 */
export interface TeamScore {
    teamId: string;
    roundWins: number;
    totalKills: number;
    totalDeaths: number;
}

/**
 * Arena match state
 */
export interface ArenaMatchState {
    matchId: string;
    mode: GameMode;
    structure: MatchStructure;
    totalRounds: number;      // Based on structure: BO3 = 3, BO5 = 5
    requiredWins: number;     // Wins needed: BO3 = 2, BO5 = 3
    currentRound: RoundState;
    teams: Map<string, TeamScore>;
    matchWinnerId: string | null;
    isMatchOver: boolean;
}

/**
 * Arena Round Manager
 */
export class ArenaRoundSystem {
    private state: ArenaMatchState | null = null;
    private modeConfig: ModeConfig | null = null;

    // Callbacks
    private onRoundStart: ((round: number) => void) | null = null;
    private onRoundEnd: ((round: number, winnerId: string) => void) | null = null;
    private onMatchEnd: ((winnerId: string) => void) | null = null;
    private onTimeWarning: ((secondsLeft: number) => void) | null = null;
    private onRoundReset: (() => void) | null = null;

    // Time tracking
    private lastWarningTime: number = 0;
    private readonly WARNING_INTERVALS = [60, 30, 10, 5, 4, 3, 2, 1];

    /**
     * Initialize a new arena match
     */
    startMatch(
        mode: GameMode,
        structure: MatchStructure,
        teamIds: string[]
    ): boolean {
        if (!isArenaMode(mode)) {
            console.error('[ArenaRoundSystem] Cannot start arena match with non-arena mode:', mode);
            return false;
        }

        this.modeConfig = getModeConfig(mode);

        const totalRounds = structure === MatchStructure.BEST_OF_5 ? 5 : 3;
        const requiredWins = structure === MatchStructure.BEST_OF_5 ? 3 : 2;

        // Initialize teams
        const teams = new Map<string, TeamScore>();
        for (const teamId of teamIds) {
            teams.set(teamId, {
                teamId,
                roundWins: 0,
                totalKills: 0,
                totalDeaths: 0,
            });
        }

        this.state = {
            matchId: `arena_${Date.now()}`,
            mode,
            structure,
            totalRounds,
            requiredWins,
            currentRound: {
                roundNumber: 0,
                isActive: false,
                startTime: 0,
                timeRemaining: 0,
                winnerTeamId: null,
            },
            teams,
            matchWinnerId: null,
            isMatchOver: false,
        };

        // Start first round
        this.startNextRound();

        console.log(`[ArenaRoundSystem] Started ${this.modeConfig.name} match (${structure})`);
        return true;
    }

    /**
     * Start the next round
     */
    private startNextRound(): void {
        if (!this.state || !this.modeConfig) return;
        if (this.state.isMatchOver) return;

        const newRoundNumber = this.state.currentRound.roundNumber + 1;
        const roundTimeMs = this.modeConfig.roundTimeLimit * 1000;

        this.state.currentRound = {
            roundNumber: newRoundNumber,
            isActive: true,
            startTime: Date.now(),
            timeRemaining: roundTimeMs,
            winnerTeamId: null,
        };

        this.lastWarningTime = roundTimeMs;

        if (this.onRoundStart) {
            this.onRoundStart(newRoundNumber);
        }

        console.log(`[ArenaRoundSystem] Round ${newRoundNumber} started`);
    }

    /**
     * Update the round system (call every frame)
     */
    update(deltaMs: number): void {
        if (!this.state || !this.state.currentRound.isActive) return;

        // Update time remaining
        this.state.currentRound.timeRemaining -= deltaMs;

        // Check for time warnings
        const secondsLeft = Math.ceil(this.state.currentRound.timeRemaining / 1000);
        for (const warningTime of this.WARNING_INTERVALS) {
            if (secondsLeft <= warningTime && this.lastWarningTime > warningTime) {
                if (this.onTimeWarning) {
                    this.onTimeWarning(warningTime);
                }
                this.lastWarningTime = warningTime;
                break;
            }
        }

        // Check for time expiration
        if (this.state.currentRound.timeRemaining <= 0) {
            this.handleTimeExpired();
        }
    }

    /**
     * Handle when round time expires
     */
    private handleTimeExpired(): void {
        if (!this.state) return;

        // Determine winner by kills or draw rules
        // For now, we'll call it a draw if time expires (can be customized)
        console.log('[ArenaRoundSystem] Round time expired - checking for winner by kills');

        // Find team with most kills this round (simplified)
        // In a full implementation, you'd track per-round kills
        let bestTeam: string | null = null;
        let bestKills = -1;

        for (const [teamId, score] of this.state.teams) {
            if (score.totalKills > bestKills) {
                bestKills = score.totalKills;
                bestTeam = teamId;
            }
        }

        if (bestTeam) {
            this.endRound(bestTeam);
        } else {
            // True tie - no winner this round (sudden death would kick in)
            this.triggerSuddenDeath();
        }
    }

    /**
     * Trigger sudden death mode
     */
    private triggerSuddenDeath(): void {
        if (!this.state || !this.modeConfig) return;

        console.log('[ArenaRoundSystem] Sudden death activated!');

        // In sudden death, the round continues until someone dies
        // For implementation, we just extend the round with reduced time
        if (this.modeConfig.suddenDeathTime) {
            this.state.currentRound.timeRemaining = this.modeConfig.suddenDeathTime * 1000;
        } else {
            // Default 30 second sudden death
            this.state.currentRound.timeRemaining = 30000;
        }

        // Could trigger micro ring here too
        // this.activateMicroRing();
    }

    /**
     * Record a kill
     */
    recordKill(killerTeamId: string, victimTeamId: string): void {
        if (!this.state) return;

        const killerScore = this.state.teams.get(killerTeamId);
        const victimScore = this.state.teams.get(victimTeamId);

        if (killerScore) {
            killerScore.totalKills++;
        }
        if (victimScore) {
            victimScore.totalDeaths++;
        }
    }

    /**
     * Check if a team has been eliminated (all players dead)
     */
    checkTeamEliminated(teamId: string, remainingAlive: number): void {
        if (!this.state || !this.state.currentRound.isActive) return;

        if (remainingAlive === 0) {
            // This team is eliminated - find who's still standing
            const survivingTeams = this.getSurvivingTeams();

            if (survivingTeams.length === 1) {
                // One team remaining - they win the round
                this.endRound(survivingTeams[0]);
            } else if (survivingTeams.length === 0) {
                // Mutual elimination - could be a draw or last to die loses
                // For now, tie goes to whoever had more kills
                this.handleTimeExpired();
            }
        }
    }

    /**
     * Get teams that still have players alive
     * (This would be called with external game state)
     */
    private getSurvivingTeams(): string[] {
        // This is a placeholder - in actual use, Game.ts would provide this
        // by checking squadManager for alive players per team
        return [];
    }

    /**
     * Manually declare a round winner (called from Game when team eliminated)
     */
    endRound(winnerTeamId: string): void {
        if (!this.state || !this.state.currentRound.isActive) return;

        this.state.currentRound.isActive = false;
        this.state.currentRound.winnerTeamId = winnerTeamId;

        // Update score
        const winnerScore = this.state.teams.get(winnerTeamId);
        if (winnerScore) {
            winnerScore.roundWins++;
        }

        console.log(`[ArenaRoundSystem] Round ${this.state.currentRound.roundNumber} won by ${winnerTeamId}`);

        if (this.onRoundEnd) {
            this.onRoundEnd(this.state.currentRound.roundNumber, winnerTeamId);
        }

        // Check for match win
        if (winnerScore && winnerScore.roundWins >= this.state.requiredWins) {
            this.endMatch(winnerTeamId);
        } else {
            // Schedule round reset and next round after brief intermission
            setTimeout(() => {
                // First, trigger round reset callback
                if (this.onRoundReset) {
                    this.onRoundReset();
                }
                // Then start next round after reset completes
                setTimeout(() => this.startNextRound(), 1500);
            }, 2000);
        }
    }

    /**
     * End the entire match
     */
    private endMatch(winnerTeamId: string): void {
        if (!this.state) return;

        this.state.matchWinnerId = winnerTeamId;
        this.state.isMatchOver = true;
        this.state.currentRound.isActive = false;

        console.log(`[ArenaRoundSystem] Match won by ${winnerTeamId}`);

        if (this.onMatchEnd) {
            this.onMatchEnd(winnerTeamId);
        }
    }

    /**
     * Get current state
     */
    getState(): ArenaMatchState | null {
        return this.state;
    }

    /**
     * Get current round number
     */
    getCurrentRound(): number {
        return this.state?.currentRound.roundNumber || 0;
    }

    /**
     * Get time remaining in current round (seconds)
     */
    getTimeRemaining(): number {
        if (!this.state?.currentRound.isActive) return 0;
        return Math.ceil(this.state.currentRound.timeRemaining / 1000);
    }

    /**
     * Get score for a team
     */
    getTeamScore(teamId: string): TeamScore | null {
        return this.state?.teams.get(teamId) || null;
    }

    /**
     * Get all team scores
     */
    getAllScores(): TeamScore[] {
        if (!this.state) return [];
        return Array.from(this.state.teams.values());
    }

    /**
     * Check if match is over
     */
    isMatchOver(): boolean {
        return this.state?.isMatchOver || false;
    }

    /**
     * Check if a round is active
     */
    isRoundActive(): boolean {
        return this.state?.currentRound.isActive || false;
    }

    /**
     * Get the match winner (if match is over)
     */
    getMatchWinner(): string | null {
        return this.state?.matchWinnerId || null;
    }

    /**
     * Format score for display (e.g., "2 - 1")
     */
    getScoreDisplay(): string {
        if (!this.state) return '';
        const scores = this.getAllScores();
        return scores.map(s => s.roundWins).join(' - ');
    }

    /**
     * Get round status text
     */
    getRoundStatusText(): string {
        if (!this.state) return '';

        if (this.state.isMatchOver) {
            return `MATCH OVER`;
        }

        const round = this.state.currentRound.roundNumber;
        const total = this.state.totalRounds;

        if (!this.state.currentRound.isActive) {
            return `ROUND ${round} COMPLETE`;
        }

        return `ROUND ${round}/${total}`;
    }

    // Callback setters
    setOnRoundStart(callback: (round: number) => void): void {
        this.onRoundStart = callback;
    }

    setOnRoundEnd(callback: (round: number, winnerId: string) => void): void {
        this.onRoundEnd = callback;
    }

    setOnMatchEnd(callback: (winnerId: string) => void): void {
        this.onMatchEnd = callback;
    }

    setOnTimeWarning(callback: (secondsLeft: number) => void): void {
        this.onTimeWarning = callback;
    }

    setOnRoundReset(callback: () => void): void {
        this.onRoundReset = callback;
    }

    /**
     * Reset/cleanup
     */
    reset(): void {
        this.state = null;
        this.modeConfig = null;
        this.onRoundStart = null;
        this.onRoundEnd = null;
        this.onMatchEnd = null;
        this.onTimeWarning = null;
        this.onRoundReset = null;
    }
}

// Singleton instance
let arenaRoundSystemInstance: ArenaRoundSystem | null = null;

export function getArenaRoundSystem(): ArenaRoundSystem {
    if (!arenaRoundSystemInstance) {
        arenaRoundSystemInstance = new ArenaRoundSystem();
    }
    return arenaRoundSystemInstance;
}

export function resetArenaRoundSystem(): void {
    if (arenaRoundSystemInstance) {
        arenaRoundSystemInstance.reset();
    }
    arenaRoundSystemInstance = null;
}
