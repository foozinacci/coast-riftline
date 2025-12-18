// Game Mode Configurations
// Defines exact rules, settings, and behaviors for each game mode

import { GameMode, MatchStructure } from './types';

/**
 * Mode configuration defines all rules for a specific game mode
 */
export interface ModeConfig {
    mode: GameMode;
    name: string;
    description: string;

    // Team/Player setup
    teamCount: number;
    playersPerTeam: number;
    totalPlayers: number;

    // Match structure
    isRoundBased: boolean;
    defaultStructure: MatchStructure;
    allowedStructures: MatchStructure[];
    roundsToWin: number; // For best-of-X formats

    // Win conditions
    // 'relic_vault' = plant all relics, vault spawns, ring closes on vault, last team wins
    winCondition: 'elimination' | 'relic_vault' | 'last_team' | 'points';


    // Relic system
    hasRelics: boolean;
    relicCount: number; // Total relics on map
    plantSiteCount: number;
    relicsToTriggerVault: number; // How many relics trigger vault spawn (Main mode: all 5)

    // Vault system (Main mode endgame)
    hasVault: boolean; // Vault spawns after required relics planted
    vaultSpawnsRandomly: boolean; // Vault position randomized each game


    // Respawn system
    respawnEnabled: boolean;
    respawnTime: number; // seconds
    respawnOrbCost: number;
    respawnsPerRound: number; // -1 for unlimited

    // Economy
    hasOrbs: boolean;
    startingOrbs: number;
    orbsPerKill: number;
    orbsPerAssist: number;

    // Timers
    matchTimeLimit: number; // seconds, 0 for no limit
    roundTimeLimit: number; // seconds, 0 for no limit
    preRoundTime: number; // countdown before round starts

    // Pressure systems
    hasMicroRing: boolean;
    microRingStartTime: number; // when ring starts closing
    microRingDuration: number; // how long until fully closed
    hasSuddenDeath: boolean;
    suddenDeathTime: number; // when sudden death activates

    // Healing
    passiveHealingEnabled: boolean;
    passiveHealingDelay: number; // seconds after last damage
    passiveHealingRate: number; // HP per second
    campfireEnabled: boolean;
    campfireHealRate: number;

    // Spawn system
    spawnVotingEnabled: boolean; // true for ranked, false for casual
    randomSpawns: boolean;

    // Pre-game
    preGameAnimationEnabled: boolean;
    showRelicLocations: boolean;

    // Bubble Zone System (Main Mode)
    hasBubbleZones: boolean;       // Enable bubble containment zones
    bubbleZoneCount: number;       // Number of bubble zones (5 for main)
    teamsPerBubble: number;        // Teams paired in each bubble (2)
    bubbleEscapeOnPlant: boolean;  // Planting relic unlocks bubble for that team only
}

/**
 * MAIN MODE - 10 squads battle royale with relic planting
 */
export const MAIN_MODE_CONFIG: ModeConfig = {
    mode: GameMode.MAIN,
    name: 'Main Mode',
    description: '10 squads compete to collect and plant relics',

    teamCount: 10,
    playersPerTeam: 3,
    totalPlayers: 30,

    isRoundBased: false,
    defaultStructure: MatchStructure.BEST_OF_3,
    allowedStructures: [MatchStructure.BEST_OF_3],
    roundsToWin: 1,

    winCondition: 'relic_vault', // Plant all relics → vault spawns → ring closes → last team wins

    hasRelics: true,
    relicCount: 5, // 5 relics on the map
    plantSiteCount: 5,
    relicsToTriggerVault: 5, // All 5 must be planted to spawn vault

    hasVault: true, // Vault spawns after all relics planted
    vaultSpawnsRandomly: true, // Vault location is random each game

    respawnEnabled: true,
    respawnTime: 10,
    respawnOrbCost: 100,
    respawnsPerRound: -1,

    hasOrbs: true,
    startingOrbs: 0,
    orbsPerKill: 50,
    orbsPerAssist: 25,

    matchTimeLimit: 0, // No time limit, ends when relics planted
    roundTimeLimit: 0,
    preRoundTime: 5,

    hasMicroRing: false,
    microRingStartTime: 0,
    microRingDuration: 0,
    hasSuddenDeath: false,
    suddenDeathTime: 0,

    passiveHealingEnabled: true,
    passiveHealingDelay: 5,
    passiveHealingRate: 10,
    campfireEnabled: true,
    campfireHealRate: 25,

    spawnVotingEnabled: false, // Random for casual
    randomSpawns: true,

    preGameAnimationEnabled: true,
    showRelicLocations: true,

    // Bubble Zone System - ENABLED for Main Mode
    hasBubbleZones: true,
    bubbleZoneCount: 5,       // 5 bubble zones
    teamsPerBubble: 2,        // 2 teams per bubble
    bubbleEscapeOnPlant: true,// Plant relic to escape
};

/**
 * ARENA 1V1 - Pure duel elimination
 */
export const ARENA_1V1_CONFIG: ModeConfig = {
    mode: GameMode.ARENA_1V1,
    name: 'Arena 1v1',
    description: 'Pure duel - Last player standing wins',

    teamCount: 2,
    playersPerTeam: 1,
    totalPlayers: 2,

    isRoundBased: true,
    defaultStructure: MatchStructure.BEST_OF_3,
    allowedStructures: [MatchStructure.BEST_OF_3, MatchStructure.BEST_OF_5],
    roundsToWin: 2, // Best of 3

    winCondition: 'elimination',

    hasRelics: false,
    relicCount: 0,
    plantSiteCount: 0,
    relicsToTriggerVault: 0,

    hasVault: false,
    vaultSpawnsRandomly: false,

    respawnEnabled: false, // No respawns in 1v1
    respawnTime: 0,
    respawnOrbCost: 0,
    respawnsPerRound: 0,

    hasOrbs: false, // No orbs in arena by default
    startingOrbs: 0,
    orbsPerKill: 0,
    orbsPerAssist: 0,

    matchTimeLimit: 0,
    roundTimeLimit: 120, // 2 minute rounds
    preRoundTime: 3,

    hasMicroRing: true,
    microRingStartTime: 60, // Ring starts at 1 minute
    microRingDuration: 30, // 30 seconds to close
    hasSuddenDeath: true,
    suddenDeathTime: 90, // Sudden death at 1:30

    passiveHealingEnabled: true,
    passiveHealingDelay: 3, // Faster heal in arena
    passiveHealingRate: 15,
    campfireEnabled: false, // No campfires in arena
    campfireHealRate: 0,

    spawnVotingEnabled: false,
    randomSpawns: true,

    preGameAnimationEnabled: false,
    showRelicLocations: false,

    hasBubbleZones: false,
    bubbleZoneCount: 0,
    teamsPerBubble: 0,
    bubbleEscapeOnPlant: false,
};

/**
 * ARENA 1V1V1 - Three-way free-for-all
 */
export const ARENA_1V1V1_CONFIG: ModeConfig = {
    mode: GameMode.ARENA_1V1V1,
    name: 'Arena 1v1v1',
    description: 'Three-way duel - Last player standing',

    teamCount: 3,
    playersPerTeam: 1,
    totalPlayers: 3,

    isRoundBased: true,
    defaultStructure: MatchStructure.BEST_OF_3,
    allowedStructures: [MatchStructure.BEST_OF_3, MatchStructure.BEST_OF_5],
    roundsToWin: 2,

    winCondition: 'last_team',

    hasRelics: false,
    relicCount: 0,
    plantSiteCount: 0,
    relicsToTriggerVault: 0,

    hasVault: false,
    vaultSpawnsRandomly: false,

    respawnEnabled: false,
    respawnTime: 0,
    respawnOrbCost: 0,
    respawnsPerRound: 0,

    hasOrbs: false,
    startingOrbs: 0,
    orbsPerKill: 0,
    orbsPerAssist: 0,

    matchTimeLimit: 0,
    roundTimeLimit: 150, // 2:30 rounds (longer for 3-way)
    preRoundTime: 3,

    hasMicroRing: true,
    microRingStartTime: 75,
    microRingDuration: 40,
    hasSuddenDeath: true,
    suddenDeathTime: 120,

    passiveHealingEnabled: true,
    passiveHealingDelay: 3,
    passiveHealingRate: 15,
    campfireEnabled: false,
    campfireHealRate: 0,

    spawnVotingEnabled: false,
    randomSpawns: true,

    preGameAnimationEnabled: false,
    showRelicLocations: false,

    hasBubbleZones: false,
    bubbleZoneCount: 0,
    teamsPerBubble: 0,
    bubbleEscapeOnPlant: false,
};

/**
 * ARENA 3V3 - Team elimination
 */
export const ARENA_3V3_CONFIG: ModeConfig = {
    mode: GameMode.ARENA_3V3,
    name: 'Arena 3v3',
    description: 'Team battle - Eliminate the enemy squad',

    teamCount: 2,
    playersPerTeam: 3,
    totalPlayers: 6,

    isRoundBased: true,
    defaultStructure: MatchStructure.BEST_OF_5,
    allowedStructures: [MatchStructure.BEST_OF_3, MatchStructure.BEST_OF_5],
    roundsToWin: 3, // Best of 5

    winCondition: 'elimination',

    hasRelics: false,
    relicCount: 0,
    plantSiteCount: 0,
    relicsToTriggerVault: 0,

    hasVault: false,
    vaultSpawnsRandomly: false,

    respawnEnabled: true, // Limited respawns per round
    respawnTime: 8,
    respawnOrbCost: 0, // Free respawns in arena
    respawnsPerRound: 1, // 1 respawn per player per round

    hasOrbs: false,
    startingOrbs: 0,
    orbsPerKill: 0,
    orbsPerAssist: 0,

    matchTimeLimit: 0,
    roundTimeLimit: 180, // 3 minute rounds
    preRoundTime: 5,

    hasMicroRing: true,
    microRingStartTime: 90,
    microRingDuration: 45,
    hasSuddenDeath: true,
    suddenDeathTime: 150,

    passiveHealingEnabled: true,
    passiveHealingDelay: 4,
    passiveHealingRate: 12,
    campfireEnabled: false,
    campfireHealRate: 0,

    spawnVotingEnabled: false,
    randomSpawns: true,

    preGameAnimationEnabled: false,
    showRelicLocations: false,

    hasBubbleZones: false,
    bubbleZoneCount: 0,
    teamsPerBubble: 0,
    bubbleEscapeOnPlant: false,
};

/**
 * ARENA 3V3V3 - Three-way team battle
 */
export const ARENA_3V3V3_CONFIG: ModeConfig = {
    mode: GameMode.ARENA_3V3V3,
    name: 'Arena 3v3v3',
    description: 'Three-way team battle - High chaos',

    teamCount: 3,
    playersPerTeam: 3,
    totalPlayers: 9,

    isRoundBased: true,
    defaultStructure: MatchStructure.BEST_OF_5,
    allowedStructures: [MatchStructure.BEST_OF_3, MatchStructure.BEST_OF_5],
    roundsToWin: 3,

    winCondition: 'last_team',

    hasRelics: false,
    relicCount: 0,
    plantSiteCount: 0,
    relicsToTriggerVault: 0,

    hasVault: false,
    vaultSpawnsRandomly: false,

    respawnEnabled: true,
    respawnTime: 10,
    respawnOrbCost: 0,
    respawnsPerRound: 1,

    hasOrbs: false,
    startingOrbs: 0,
    orbsPerKill: 0,
    orbsPerAssist: 0,

    matchTimeLimit: 0,
    roundTimeLimit: 210, // 3:30 rounds
    preRoundTime: 5,

    hasMicroRing: true,
    microRingStartTime: 105,
    microRingDuration: 50,
    hasSuddenDeath: true,
    suddenDeathTime: 180,

    passiveHealingEnabled: true,
    passiveHealingDelay: 4,
    passiveHealingRate: 12,
    campfireEnabled: false,
    campfireHealRate: 0,

    spawnVotingEnabled: false,
    randomSpawns: true,

    preGameAnimationEnabled: false,
    showRelicLocations: false,

    hasBubbleZones: false,
    bubbleZoneCount: 0,
    teamsPerBubble: 0,
    bubbleEscapeOnPlant: false,
};

/**
 * TRAINING MODE - Placeholder config, inherits from selected mode
 * All non-player slots are filled with bots
 * Use getTrainingConfig(baseMode) to get actual training config
 */
export const TRAINING_CONFIG: ModeConfig = {
    mode: GameMode.TRAINING,
    name: 'Training',
    description: 'Practice any mode vs bots (user vs environment)',

    // Default to 1v1, but this gets overridden by selected mode
    teamCount: 2,
    playersPerTeam: 1,
    totalPlayers: 2,

    isRoundBased: false,
    defaultStructure: MatchStructure.BEST_OF_3,
    allowedStructures: [MatchStructure.BEST_OF_3, MatchStructure.BEST_OF_5],
    roundsToWin: 1,

    winCondition: 'elimination',

    hasRelics: false,
    relicCount: 0,
    plantSiteCount: 0,
    relicsToTriggerVault: 0,

    hasVault: false,
    vaultSpawnsRandomly: false,

    respawnEnabled: true,
    respawnTime: 2, // Fast respawns for training
    respawnOrbCost: 0,
    respawnsPerRound: -1,

    hasOrbs: false,
    startingOrbs: 0,
    orbsPerKill: 0,
    orbsPerAssist: 0,

    matchTimeLimit: 0,
    roundTimeLimit: 0,
    preRoundTime: 3,

    hasMicroRing: false,
    microRingStartTime: 0,
    microRingDuration: 0,
    hasSuddenDeath: false,
    suddenDeathTime: 0,

    passiveHealingEnabled: true,
    passiveHealingDelay: 2,
    passiveHealingRate: 20,
    campfireEnabled: false,
    campfireHealRate: 0,

    spawnVotingEnabled: false,
    randomSpawns: true,

    preGameAnimationEnabled: false,
    showRelicLocations: false,

    hasBubbleZones: false,
    bubbleZoneCount: 0,
    teamsPerBubble: 0,
    bubbleEscapeOnPlant: false,
};

/**
 * Get training config based on selected mode
 * Inherits all settings from the base mode but marks it as training
 */
export function getTrainingConfig(baseMode: GameMode): ModeConfig {
    const base = getModeConfig(baseMode);
    return {
        ...base,
        mode: GameMode.TRAINING,
        name: `Training: ${base.name}`,
        description: `Practice ${base.name} vs bots`,
        respawnTime: Math.max(2, base.respawnTime - 2), // Faster respawns
        preGameAnimationEnabled: false, // Quick start
    };
}

/**
 * Get mode configuration by GameMode enum
 */
export function getModeConfig(mode: GameMode): ModeConfig {
    switch (mode) {
        case GameMode.MAIN:
            return MAIN_MODE_CONFIG;
        case GameMode.ARENA_1V1:
            return ARENA_1V1_CONFIG;
        case GameMode.ARENA_1V1V1:
            return ARENA_1V1V1_CONFIG;
        case GameMode.ARENA_3V3:
            return ARENA_3V3_CONFIG;
        case GameMode.ARENA_3V3V3:
            return ARENA_3V3V3_CONFIG;
        case GameMode.TRAINING:
            return TRAINING_CONFIG;
        default:
            return MAIN_MODE_CONFIG;
    }
}

/**
 * Get mode config adjusted for match structure (BO3 vs BO5)
 */
export function getModeConfigWithStructure(mode: GameMode, structure: MatchStructure): ModeConfig {
    const config = { ...getModeConfig(mode) };

    if (structure === MatchStructure.BEST_OF_5) {
        config.roundsToWin = 3;
    } else if (structure === MatchStructure.BEST_OF_3) {
        config.roundsToWin = 2;
    }

    return config;
}

/**
 * Check if a mode is an arena mode
 */
export function isArenaMode(mode: GameMode): boolean {
    return mode === GameMode.ARENA_1V1 ||
        mode === GameMode.ARENA_1V1V1 ||
        mode === GameMode.ARENA_3V3 ||
        mode === GameMode.ARENA_3V3V3;
}

/**
 * Check if a mode is a team mode (more than 1 player per team)
 */
export function isTeamMode(mode: GameMode): boolean {
    const config = getModeConfig(mode);
    return config.playersPerTeam > 1;
}
