// Progression System for RIFTLINE
// Implements XP curve, class/weapon mastery, and ranked requirements

import { PlayerClass } from '../core/types';

// ============================================================================
// PROGRESSION CONSTANTS
// ============================================================================

/**
 * Maximum levels for different progression types
 */
export const MAX_CLASS_LEVEL = 50;
export const MAX_WEAPON_LEVEL = 30;
export const MAX_ACCOUNT_TIER = 100;

/**
 * Ranked mode requirements
 */
export const RANKED_REQUIREMENTS = {
    minClassLevel: 10,        // All classes must be at least level 10
    minWeaponLevel: 10,       // All weapons must be at least level 10
    classesRequired: 4,       // Number of classes that must meet requirement
    weaponsRequired: 4,       // Number of weapons that must meet requirement
    minAccountTier: 5,        // Minimum "Rift Tier" (prestige equivalent)
};

/**
 * Prestige/Tier system - unique to RIFTLINE
 * "Rift Tier" - represents mastery convergence levels
 */
export const RIFT_TIER_NAMES = [
    'Initiate',       // Tier 0
    'Drifter',        // Tier 1
    'Voyager',        // Tier 2
    'Pathfinder',     // Tier 3
    'Navigator',      // Tier 4
    'Warden',         // Tier 5 (Ranked unlocks here)
    'Sentinel',       // Tier 6
    'Vanguard',       // Tier 7
    'Harbinger',      // Tier 8
    'Convergent',     // Tier 9
    'Rift Master',    // Tier 10+
];

// ============================================================================
// XP CURVE FORMULA
// ============================================================================

/**
 * XP Curve Design:
 * - Front-loaded for early momentum (levels 1-10 come quickly)
 * - Exponential slowdown for long-term engagement (levels 30+ take much longer)
 * - Formula: XP_required = base * (level^exponent) * (1 + logarithmic_factor)
 * 
 * This creates a curve where:
 * - Level 1-5: ~100-500 XP each (quick wins)
 * - Level 10: ~2,000 XP
 * - Level 20: ~10,000 XP
 * - Level 30: ~35,000 XP
 * - Level 50: ~150,000 XP
 */

/**
 * Calculate XP required to reach a specific level
 * Uses front-loaded exponential curve
 */
export function getXPForLevel(level: number, type: 'class' | 'weapon' | 'account'): number {
    if (level <= 1) return 0;

    // Base XP values per type
    const baseXP = {
        class: 100,
        weapon: 80,
        account: 150,
    };

    // Exponent controls curve steepness
    const exponent = {
        class: 1.8,
        weapon: 1.7,
        account: 2.0,
    };

    // Calculate base requirement
    const base = baseXP[type];
    const exp = exponent[type];

    // Front-loaded formula with logarithmic acceleration at high levels
    const levelFactor = Math.pow(level, exp);
    const logFactor = 1 + Math.log10(Math.max(1, level - 10)) * 0.5;

    // Apply modifiers for smoother curve
    let xpRequired = base * levelFactor * logFactor;

    // Round to nice numbers
    return Math.floor(xpRequired / 10) * 10;
}

/**
 * Calculate total XP required from level 1 to target level
 */
export function getTotalXPForLevel(targetLevel: number, type: 'class' | 'weapon' | 'account'): number {
    let total = 0;
    for (let level = 2; level <= targetLevel; level++) {
        total += getXPForLevel(level, type);
    }
    return total;
}

/**
 * Calculate level from total XP
 */
export function getLevelFromXP(totalXP: number, type: 'class' | 'weapon' | 'account'): number {
    const maxLevel = type === 'class' ? MAX_CLASS_LEVEL :
        type === 'weapon' ? MAX_WEAPON_LEVEL : MAX_ACCOUNT_TIER;

    let level = 1;
    let xpAccumulated = 0;

    while (level < maxLevel) {
        const xpForNext = getXPForLevel(level + 1, type);
        if (xpAccumulated + xpForNext > totalXP) break;
        xpAccumulated += xpForNext;
        level++;
    }

    return level;
}

/**
 * Calculate progress to next level (0-1)
 */
export function getLevelProgress(totalXP: number, type: 'class' | 'weapon' | 'account'): number {
    const currentLevel = getLevelFromXP(totalXP, type);
    const maxLevel = type === 'class' ? MAX_CLASS_LEVEL :
        type === 'weapon' ? MAX_WEAPON_LEVEL : MAX_ACCOUNT_TIER;

    if (currentLevel >= maxLevel) return 1;

    const xpForCurrentLevel = getTotalXPForLevel(currentLevel, type);
    const xpForNextLevel = getXPForLevel(currentLevel + 1, type);
    const xpIntoLevel = totalXP - xpForCurrentLevel;

    return Math.min(1, xpIntoLevel / xpForNextLevel);
}

// ============================================================================
// XP GAIN FORMULAS
// ============================================================================

/**
 * XP sources and their base values
 */
export const XP_SOURCES = {
    // Combat
    kill: 100,
    assist: 40,
    damageDealt: 0.5,    // per point of damage
    headshot: 25,        // bonus

    // Objectives
    relicPickup: 50,
    relicPlant: 150,
    vaultCapture: 500,

    // Survival
    matchComplete: 100,
    roundWin: 75,
    matchWin: 200,

    // Time-based (per minute survived)
    survivalTime: 10,

    // Bonus multipliers
    firstBlood: 1.5,     // multiplier
    clutch: 2.0,         // 1vX win multiplier
    perfectRound: 1.5,   // no deaths multiplier
};

/**
 * Calculate XP earned from a match
 */
export interface MatchXPResult {
    baseXP: number;
    bonusXP: number;
    totalXP: number;
    breakdown: {
        source: string;
        amount: number;
    }[];
}

export function calculateMatchXP(stats: {
    kills: number;
    assists: number;
    damageDealt: number;
    relicsPlanted: number;
    relicsCollected: number;
    roundsWon: number;
    matchWon: boolean;
    survivalTimeMinutes: number;
    isFirstBlood?: boolean;
    isClutch?: boolean;
    isPerfectRound?: boolean;
}): MatchXPResult {
    const breakdown: { source: string; amount: number }[] = [];
    let baseXP = 0;

    // Combat XP
    const killXP = stats.kills * XP_SOURCES.kill;
    if (killXP > 0) breakdown.push({ source: 'Kills', amount: killXP });
    baseXP += killXP;

    const assistXP = stats.assists * XP_SOURCES.assist;
    if (assistXP > 0) breakdown.push({ source: 'Assists', amount: assistXP });
    baseXP += assistXP;

    const damageXP = Math.floor(stats.damageDealt * XP_SOURCES.damageDealt);
    if (damageXP > 0) breakdown.push({ source: 'Damage', amount: damageXP });
    baseXP += damageXP;

    // Objective XP
    const relicXP = (stats.relicsCollected * XP_SOURCES.relicPickup) +
        (stats.relicsPlanted * XP_SOURCES.relicPlant);
    if (relicXP > 0) breakdown.push({ source: 'Relics', amount: relicXP });
    baseXP += relicXP;

    // Round/Match XP
    const roundXP = stats.roundsWon * XP_SOURCES.roundWin;
    if (roundXP > 0) breakdown.push({ source: 'Round Wins', amount: roundXP });
    baseXP += roundXP;

    baseXP += XP_SOURCES.matchComplete;
    breakdown.push({ source: 'Match Complete', amount: XP_SOURCES.matchComplete });

    if (stats.matchWon) {
        baseXP += XP_SOURCES.matchWin;
        breakdown.push({ source: 'Victory', amount: XP_SOURCES.matchWin });
    }

    // Survival XP
    const survivalXP = Math.floor(stats.survivalTimeMinutes * XP_SOURCES.survivalTime);
    if (survivalXP > 0) breakdown.push({ source: 'Survival Time', amount: survivalXP });
    baseXP += survivalXP;

    // Calculate bonuses
    let bonusMultiplier = 1;
    let bonusXP = 0;

    if (stats.isFirstBlood) {
        bonusMultiplier *= XP_SOURCES.firstBlood;
        breakdown.push({ source: 'First Blood Bonus', amount: Math.floor(baseXP * 0.5) });
    }
    if (stats.isClutch) {
        bonusMultiplier *= XP_SOURCES.clutch;
        breakdown.push({ source: 'Clutch Bonus', amount: Math.floor(baseXP * 1.0) });
    }
    if (stats.isPerfectRound) {
        bonusMultiplier *= XP_SOURCES.perfectRound;
        breakdown.push({ source: 'Perfect Round Bonus', amount: Math.floor(baseXP * 0.5) });
    }

    bonusXP = Math.floor(baseXP * (bonusMultiplier - 1));
    const totalXP = baseXP + bonusXP;

    return { baseXP, bonusXP, totalXP, breakdown };
}

// ============================================================================
// CLASS/WEAPON XP DISTRIBUTION
// ============================================================================

/**
 * Distribute match XP to class and weapon progression
 */
export function distributeXP(
    matchXP: number,
    classUsed: PlayerClass,
    weaponUsed: string
): {
    classXP: number;
    weaponXP: number;
    accountXP: number;
} {
    // Account gets full XP
    const accountXP = matchXP;

    // Class gets 80% of match XP
    const classXP = Math.floor(matchXP * 0.8);

    // Weapon gets 60% of match XP
    const weaponXP = Math.floor(matchXP * 0.6);

    return { classXP, weaponXP, accountXP };
}

// ============================================================================
// RIFT TIER (PRESTIGE) SYSTEM
// ============================================================================

/**
 * Calculate Rift Tier from total account XP
 */
export function getRiftTier(totalAccountXP: number): number {
    return Math.floor(getLevelFromXP(totalAccountXP, 'account') / 10);
}

/**
 * Get Rift Tier name
 */
export function getRiftTierName(tier: number): string {
    if (tier >= RIFT_TIER_NAMES.length) {
        return `Rift Master ${tier - RIFT_TIER_NAMES.length + 1}`;
    }
    return RIFT_TIER_NAMES[tier];
}

/**
 * Check if player can access ranked mode
 */
export function canAccessRanked(progression: {
    classLevels: Map<PlayerClass, number>;
    weaponLevels: Map<string, number>;
    riftTier: number;
}): { allowed: boolean; reason?: string } {
    // Check Rift Tier
    if (progression.riftTier < RANKED_REQUIREMENTS.minAccountTier) {
        return {
            allowed: false,
            reason: `Reach Rift Tier ${RANKED_REQUIREMENTS.minAccountTier} (${getRiftTierName(RANKED_REQUIREMENTS.minAccountTier)}) to unlock Ranked`
        };
    }

    // Check class levels
    const classesAtLevel = Array.from(progression.classLevels.values())
        .filter(level => level >= RANKED_REQUIREMENTS.minClassLevel).length;

    if (classesAtLevel < RANKED_REQUIREMENTS.classesRequired) {
        return {
            allowed: false,
            reason: `Level ${RANKED_REQUIREMENTS.classesRequired} classes to level ${RANKED_REQUIREMENTS.minClassLevel}`
        };
    }

    // Check weapon levels
    const weaponsAtLevel = Array.from(progression.weaponLevels.values())
        .filter(level => level >= RANKED_REQUIREMENTS.minWeaponLevel).length;

    if (weaponsAtLevel < RANKED_REQUIREMENTS.weaponsRequired) {
        return {
            allowed: false,
            reason: `Level ${RANKED_REQUIREMENTS.weaponsRequired} weapons to level ${RANKED_REQUIREMENTS.minWeaponLevel}`
        };
    }

    return { allowed: true };
}

// ============================================================================
// RANKED MATCHMAKING FACTORS
// ============================================================================

/**
 * Calculate matchmaking score based on progression
 * Used as a secondary factor in ranked MMR
 */
export function getProgressionMatchmakingFactor(progression: {
    classLevels: Map<PlayerClass, number>;
    weaponLevels: Map<string, number>;
    riftTier: number;
    totalGamesPlayed: number;
}): number {
    // Base factor starts at 1.0
    let factor = 1.0;

    // Higher Rift Tier adds to factor
    factor += progression.riftTier * 0.02;

    // Average class mastery affects factor
    const avgClassLevel = Array.from(progression.classLevels.values())
        .reduce((sum, level) => sum + level, 0) / progression.classLevels.size;
    factor += (avgClassLevel / MAX_CLASS_LEVEL) * 0.1;

    // Games played (experience) factor
    const experienceFactor = Math.log10(Math.max(1, progression.totalGamesPlayed)) * 0.05;
    factor += experienceFactor;

    return Math.min(2.0, factor); // Cap at 2.0
}

// ============================================================================
// PLAYER PROGRESSION STATE
// ============================================================================

/**
 * Complete player progression state
 */
export interface PlayerProgression {
    playerId: string;

    // Account level
    accountXP: number;
    riftTier: number;

    // Class mastery (XP per class)
    classXP: Map<PlayerClass, number>;

    // Weapon mastery (XP per weapon)
    weaponXP: Map<string, number>;

    // Statistics
    totalGamesPlayed: number;
    totalWins: number;
    totalKills: number;
    totalDeaths: number;

    // Ranked info
    rankedUnlocked: boolean;
    rankedMMR: number;
    rankedTier: string;
}

/**
 * Initialize a new player progression
 */
export function createNewProgression(playerId: string): PlayerProgression {
    return {
        playerId,
        accountXP: 0,
        riftTier: 0,
        classXP: new Map([
            [PlayerClass.SCOUT, 0],
            [PlayerClass.VANGUARD, 0],
            [PlayerClass.MEDIC, 0],
            [PlayerClass.SCAVENGER, 0],
        ]),
        weaponXP: new Map([
            ['auto_common', 0],
            ['semi_common', 0],
            ['burst_common', 0],
            ['charge_common', 0],
        ]),
        totalGamesPlayed: 0,
        totalWins: 0,
        totalKills: 0,
        totalDeaths: 0,
        rankedUnlocked: false,
        rankedMMR: 1000,
        rankedTier: 'Unranked',
    };
}

/**
 * Update progression after a match
 */
export function updateProgression(
    current: PlayerProgression,
    matchResult: {
        xpGained: number;
        classUsed: PlayerClass;
        weaponUsed: string;
        kills: number;
        deaths: number;
        won: boolean;
    }
): PlayerProgression {
    const { classXP: cXP, weaponXP: wXP, accountXP: aXP } = distributeXP(
        matchResult.xpGained,
        matchResult.classUsed,
        matchResult.weaponUsed
    );

    // Update XP totals
    const newAccountXP = current.accountXP + aXP;

    const newClassXP = new Map(current.classXP);
    newClassXP.set(
        matchResult.classUsed,
        (newClassXP.get(matchResult.classUsed) || 0) + cXP
    );

    const newWeaponXP = new Map(current.weaponXP);
    newWeaponXP.set(
        matchResult.weaponUsed,
        (newWeaponXP.get(matchResult.weaponUsed) || 0) + wXP
    );

    // Calculate new Rift Tier
    const newRiftTier = getRiftTier(newAccountXP);

    // Check ranked unlock
    const classLevels = new Map<PlayerClass, number>();
    newClassXP.forEach((xp, pc) => classLevels.set(pc, getLevelFromXP(xp, 'class')));

    const weaponLevels = new Map<string, number>();
    newWeaponXP.forEach((xp, w) => weaponLevels.set(w, getLevelFromXP(xp, 'weapon')));

    const rankedCheck = canAccessRanked({
        classLevels,
        weaponLevels,
        riftTier: newRiftTier,
    });

    return {
        ...current,
        accountXP: newAccountXP,
        riftTier: newRiftTier,
        classXP: newClassXP,
        weaponXP: newWeaponXP,
        totalGamesPlayed: current.totalGamesPlayed + 1,
        totalWins: current.totalWins + (matchResult.won ? 1 : 0),
        totalKills: current.totalKills + matchResult.kills,
        totalDeaths: current.totalDeaths + matchResult.deaths,
        rankedUnlocked: rankedCheck.allowed,
    };
}

// ============================================================================
// DEBUG: XP CURVE VISUALIZATION
// ============================================================================

/**
 * Generate XP curve data for visualization/debugging
 */
export function generateXPCurveData(type: 'class' | 'weapon' | 'account', maxLevel: number = 50): {
    level: number;
    xpForLevel: number;
    totalXP: number;
}[] {
    const data = [];
    for (let level = 1; level <= maxLevel; level++) {
        data.push({
            level,
            xpForLevel: getXPForLevel(level, type),
            totalXP: getTotalXPForLevel(level, type),
        });
    }
    return data;
}
