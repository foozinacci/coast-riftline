// Player Preferences Manager
// Stores player settings in localStorage for persistence

import { PlayerClass, GameMode } from '../core/types';

export interface PlayerPreferences {
    selectedClass: PlayerClass;
    lastGameMode: GameMode;
    difficulty: 'easy' | 'medium' | 'hard';
    soundEnabled: boolean;
    musicVolume: number;
    sfxVolume: number;
}

const STORAGE_KEY = 'riftline_preferences';

const DEFAULT_PREFERENCES: PlayerPreferences = {
    selectedClass: PlayerClass.SCOUT,
    lastGameMode: GameMode.MAIN,
    difficulty: 'medium',
    soundEnabled: true,
    musicVolume: 0.7,
    sfxVolume: 1.0,
};

class PreferencesManager {
    private preferences: PlayerPreferences;

    constructor() {
        this.preferences = this.load();
    }

    private load(): PlayerPreferences {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                // Merge with defaults to handle new properties
                return { ...DEFAULT_PREFERENCES, ...parsed };
            }
        } catch (e) {
            console.warn('Failed to load preferences:', e);
        }
        return { ...DEFAULT_PREFERENCES };
    }

    private save(): void {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.preferences));
        } catch (e) {
            console.warn('Failed to save preferences:', e);
        }
    }

    // Getters
    getSelectedClass(): PlayerClass {
        return this.preferences.selectedClass;
    }

    getLastGameMode(): GameMode {
        return this.preferences.lastGameMode;
    }

    getDifficulty(): 'easy' | 'medium' | 'hard' {
        return this.preferences.difficulty;
    }

    isSoundEnabled(): boolean {
        return this.preferences.soundEnabled;
    }

    getMusicVolume(): number {
        return this.preferences.musicVolume;
    }

    getSfxVolume(): number {
        return this.preferences.sfxVolume;
    }

    // Setters
    setSelectedClass(playerClass: PlayerClass): void {
        this.preferences.selectedClass = playerClass;
        this.save();
        console.log(`[Preferences] Class set to: ${playerClass}`);
    }

    setLastGameMode(mode: GameMode): void {
        this.preferences.lastGameMode = mode;
        this.save();
    }

    setDifficulty(difficulty: 'easy' | 'medium' | 'hard'): void {
        this.preferences.difficulty = difficulty;
        this.save();
    }

    setSoundEnabled(enabled: boolean): void {
        this.preferences.soundEnabled = enabled;
        this.save();
    }

    setMusicVolume(volume: number): void {
        this.preferences.musicVolume = Math.max(0, Math.min(1, volume));
        this.save();
    }

    setSfxVolume(volume: number): void {
        this.preferences.sfxVolume = Math.max(0, Math.min(1, volume));
        this.save();
    }

    // Reset to defaults
    reset(): void {
        this.preferences = { ...DEFAULT_PREFERENCES };
        this.save();
    }
}

// Singleton instance
export const preferences = new PreferencesManager();
