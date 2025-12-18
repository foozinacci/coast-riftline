// Server-Side Anti-Cheat Validation for RIFTLINE
// Validates client inputs and detects suspicious behavior

// ============================================================================
// TYPES
// ============================================================================

interface Vector2 {
    x: number;
    y: number;
}

interface PlayerInput {
    moveDirection: Vector2;
    aimDirection: Vector2;
    isFiring: boolean;
    isReloading: boolean;
    dashPressed: boolean;
    tacticalPressed: boolean;
    interactPressed: boolean;
}

interface ValidationResult {
    valid: boolean;
    reason?: string;
    severity: 'none' | 'warning' | 'kick' | 'ban';
}

interface PlayerStats {
    lastPosition: Vector2;
    lastPositionTime: number;
    lastFireTime: number;
    fireCount: number;
    consecutiveInvalidInputs: number;
    suspicionScore: number;
    lastDamageDealt: number;
    killsInWindow: number;
    killWindowStart: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_MOVE_SPEED = 400; // Max units per second
const MAX_FIRE_RATE = 20; // Max shots per second
const MAX_AIM_SNAP_SPEED = 50; // Max radians per second for aim changes
const MAX_TELEPORT_DISTANCE = 100; // Max distance change between updates
const SUSPICION_THRESHOLD = {
    warning: 50,
    kick: 100,
    ban: 200,
};
const KILL_WINDOW_SECONDS = 10;
const MAX_KILLS_IN_WINDOW = 6;

// ============================================================================
// INPUT VALIDATOR
// ============================================================================

/**
 * Validates player inputs to detect cheating
 */
export class InputValidator {
    private playerStats: Map<string, PlayerStats> = new Map();

    /**
     * Initialize tracking for a player
     */
    registerPlayer(playerId: string, startPosition: Vector2): void {
        this.playerStats.set(playerId, {
            lastPosition: startPosition,
            lastPositionTime: Date.now(),
            lastFireTime: 0,
            fireCount: 0,
            consecutiveInvalidInputs: 0,
            suspicionScore: 0,
            lastDamageDealt: 0,
            killsInWindow: 0,
            killWindowStart: Date.now(),
        });
    }

    /**
     * Remove tracking for a player
     */
    unregisterPlayer(playerId: string): void {
        this.playerStats.delete(playerId);
    }

    /**
     * Validate a player input
     */
    validateInput(playerId: string, input: PlayerInput): ValidationResult {
        const stats = this.playerStats.get(playerId);
        if (!stats) {
            return { valid: true, severity: 'none' };
        }

        // Validate move direction magnitude
        const moveMag = Math.sqrt(
            input.moveDirection.x ** 2 + input.moveDirection.y ** 2
        );
        if (moveMag > 1.1) {
            stats.suspicionScore += 5;
            stats.consecutiveInvalidInputs++;
            return {
                valid: false,
                reason: 'Invalid move direction magnitude',
                severity: this.getSeverity(stats),
            };
        }

        // Validate aim direction magnitude
        const aimMag = Math.sqrt(
            input.aimDirection.x ** 2 + input.aimDirection.y ** 2
        );
        if (aimMag > 1.1) {
            stats.suspicionScore += 5;
            stats.consecutiveInvalidInputs++;
            return {
                valid: false,
                reason: 'Invalid aim direction magnitude',
                severity: this.getSeverity(stats),
            };
        }

        // Track fire rate
        if (input.isFiring) {
            const now = Date.now();
            const timeSinceFire = now - stats.lastFireTime;

            if (timeSinceFire < 1000 / MAX_FIRE_RATE) {
                stats.fireCount++;
                if (stats.fireCount > 3) {
                    stats.suspicionScore += 10;
                    return {
                        valid: false,
                        reason: 'Fire rate too high',
                        severity: this.getSeverity(stats),
                    };
                }
            } else {
                stats.fireCount = 1;
                stats.lastFireTime = now;
            }
        }

        // Valid input, decay suspicion
        stats.consecutiveInvalidInputs = 0;
        stats.suspicionScore = Math.max(0, stats.suspicionScore - 0.5);

        return { valid: true, severity: 'none' };
    }

    /**
     * Validate position update (check for speed hacking / teleporting)
     */
    validatePosition(
        playerId: string,
        newPosition: Vector2,
        dt: number
    ): ValidationResult {
        const stats = this.playerStats.get(playerId);
        if (!stats) {
            return { valid: true, severity: 'none' };
        }

        const dx = newPosition.x - stats.lastPosition.x;
        const dy = newPosition.y - stats.lastPosition.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Check for teleporting
        if (distance > MAX_TELEPORT_DISTANCE && dt < 0.5) {
            stats.suspicionScore += 20;
            console.log(`[AntiCheat] Teleport detected for ${playerId}: ${distance.toFixed(0)} units`);
            return {
                valid: false,
                reason: 'Teleport detected',
                severity: this.getSeverity(stats),
            };
        }

        // Check for speed hacking
        const speed = distance / dt;
        if (speed > MAX_MOVE_SPEED * 1.2) {
            stats.suspicionScore += 10;
            console.log(`[AntiCheat] Speed hack detected for ${playerId}: ${speed.toFixed(0)} u/s`);
            return {
                valid: false,
                reason: 'Speed hack detected',
                severity: this.getSeverity(stats),
            };
        }

        // Update position tracking
        stats.lastPosition = newPosition;
        stats.lastPositionTime = Date.now();

        return { valid: true, severity: 'none' };
    }

    /**
     * Validate a kill (check for aimbot / impossible kills)
     */
    validateKill(
        killerId: string,
        victimId: string,
        killerPosition: Vector2,
        victimPosition: Vector2,
        weaponRange: number
    ): ValidationResult {
        const stats = this.playerStats.get(killerId);
        if (!stats) {
            return { valid: true, severity: 'none' };
        }

        const now = Date.now();

        // Check kill rate
        if (now - stats.killWindowStart > KILL_WINDOW_SECONDS * 1000) {
            stats.killWindowStart = now;
            stats.killsInWindow = 1;
        } else {
            stats.killsInWindow++;
            if (stats.killsInWindow > MAX_KILLS_IN_WINDOW) {
                stats.suspicionScore += 25;
                console.log(`[AntiCheat] Excessive kills for ${killerId}: ${stats.killsInWindow} in ${KILL_WINDOW_SECONDS}s`);
                return {
                    valid: false,
                    reason: 'Excessive kill rate',
                    severity: this.getSeverity(stats),
                };
            }
        }

        // Check kill distance
        const dx = killerPosition.x - victimPosition.x;
        const dy = killerPosition.y - victimPosition.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > weaponRange * 1.5) {
            stats.suspicionScore += 30;
            console.log(`[AntiCheat] Long-range kill by ${killerId}: ${distance.toFixed(0)} > ${weaponRange}`);
            return {
                valid: false,
                reason: 'Kill distance exceeds weapon range',
                severity: this.getSeverity(stats),
            };
        }

        return { valid: true, severity: 'none' };
    }

    /**
     * Validate damage (check for damage hacking)
     */
    validateDamage(
        attackerId: string,
        damage: number,
        maxDamage: number
    ): ValidationResult {
        const stats = this.playerStats.get(attackerId);
        if (!stats) {
            return { valid: true, severity: 'none' };
        }

        // Check for excessive damage
        if (damage > maxDamage * 1.5) {
            stats.suspicionScore += 50;
            console.log(`[AntiCheat] Damage hack by ${attackerId}: ${damage} > ${maxDamage}`);
            return {
                valid: false,
                reason: 'Damage exceeds maximum',
                severity: this.getSeverity(stats),
            };
        }

        return { valid: true, severity: 'none' };
    }

    /**
     * Get suspicion score for a player
     */
    getSuspicionScore(playerId: string): number {
        return this.playerStats.get(playerId)?.suspicionScore || 0;
    }

    /**
     * Get severity based on suspicion score
     */
    private getSeverity(stats: PlayerStats): ValidationResult['severity'] {
        if (stats.suspicionScore >= SUSPICION_THRESHOLD.ban) {
            return 'ban';
        }
        if (stats.suspicionScore >= SUSPICION_THRESHOLD.kick) {
            return 'kick';
        }
        if (stats.suspicionScore >= SUSPICION_THRESHOLD.warning) {
            return 'warning';
        }
        return 'none';
    }
}

// ============================================================================
// PACKET RATE LIMITER
// ============================================================================

/**
 * Rate limits packets to prevent flooding
 */
export class PacketRateLimiter {
    private packetCounts: Map<string, { count: number; windowStart: number }> = new Map();
    private maxPacketsPerSecond: number = 100;
    private windowMs: number = 1000;

    /**
     * Check if a packet should be allowed
     */
    allowPacket(playerId: string): boolean {
        const now = Date.now();
        let playerData = this.packetCounts.get(playerId);

        if (!playerData || now - playerData.windowStart > this.windowMs) {
            playerData = { count: 1, windowStart: now };
            this.packetCounts.set(playerId, playerData);
            return true;
        }

        playerData.count++;
        if (playerData.count > this.maxPacketsPerSecond) {
            console.log(`[AntiCheat] Packet flood from ${playerId}: ${playerData.count}/s`);
            return false;
        }

        return true;
    }

    /**
     * Remove tracking for a player
     */
    unregister(playerId: string): void {
        this.packetCounts.delete(playerId);
    }
}

// ============================================================================
// REPLAY VALIDATOR
// ============================================================================

/**
 * Validates that kills are possible based on game state
 */
export class ReplayValidator {
    /**
     * Validate that a projectile hit is physically possible
     */
    validateHit(
        shooterPosition: Vector2,
        targetPosition: Vector2,
        projectileSpeed: number,
        deltaTime: number
    ): ValidationResult {
        // Check if projectile could have traveled the distance
        const dx = targetPosition.x - shooterPosition.x;
        const dy = targetPosition.y - shooterPosition.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        const maxTravelDistance = projectileSpeed * deltaTime;

        if (distance > maxTravelDistance * 1.5) {
            return {
                valid: false,
                reason: 'Projectile could not travel that distance',
                severity: 'warning',
            };
        }

        return { valid: true, severity: 'none' };
    }

    /**
     * Validate that a player could see their target
     */
    validateLineOfSight(
        shooterPosition: Vector2,
        targetPosition: Vector2,
        obstacles: { position: Vector2; radius: number }[]
    ): ValidationResult {
        // Simple line-circle intersection check
        for (const obstacle of obstacles) {
            if (this.lineIntersectsCircle(
                shooterPosition,
                targetPosition,
                obstacle.position,
                obstacle.radius
            )) {
                return {
                    valid: false,
                    reason: 'Line of sight blocked by obstacle',
                    severity: 'warning',
                };
            }
        }

        return { valid: true, severity: 'none' };
    }

    private lineIntersectsCircle(
        lineStart: Vector2,
        lineEnd: Vector2,
        circleCenter: Vector2,
        radius: number
    ): boolean {
        const dx = lineEnd.x - lineStart.x;
        const dy = lineEnd.y - lineStart.y;
        const fx = lineStart.x - circleCenter.x;
        const fy = lineStart.y - circleCenter.y;

        const a = dx * dx + dy * dy;
        const b = 2 * (fx * dx + fy * dy);
        const c = fx * fx + fy * fy - radius * radius;

        const discriminant = b * b - 4 * a * c;
        if (discriminant < 0) return false;

        const t1 = (-b - Math.sqrt(discriminant)) / (2 * a);
        const t2 = (-b + Math.sqrt(discriminant)) / (2 * a);

        return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1);
    }
}

// ============================================================================
// ANTI-CHEAT MANAGER
// ============================================================================

/**
 * Central anti-cheat manager
 */
export class AntiCheatManager {
    private inputValidator: InputValidator;
    private rateLimiter: PacketRateLimiter;
    private replayValidator: ReplayValidator;
    private banList: Set<string> = new Set();
    private warnings: Map<string, number> = new Map();

    constructor() {
        this.inputValidator = new InputValidator();
        this.rateLimiter = new PacketRateLimiter();
        this.replayValidator = new ReplayValidator();
    }

    /**
     * Register a player
     */
    registerPlayer(playerId: string, position: Vector2): void {
        this.inputValidator.registerPlayer(playerId, position);
    }

    /**
     * Unregister a player
     */
    unregisterPlayer(playerId: string): void {
        this.inputValidator.unregisterPlayer(playerId);
        this.rateLimiter.unregister(playerId);
    }

    /**
     * Check if a player is banned
     */
    isBanned(playerId: string): boolean {
        return this.banList.has(playerId);
    }

    /**
     * Process a validation result
     */
    processResult(playerId: string, result: ValidationResult): {
        action: 'allow' | 'warn' | 'kick' | 'ban';
        message?: string;
    } {
        if (result.valid) {
            return { action: 'allow' };
        }

        switch (result.severity) {
            case 'ban':
                this.banList.add(playerId);
                console.log(`[AntiCheat] BANNED ${playerId}: ${result.reason}`);
                return { action: 'ban', message: result.reason };

            case 'kick':
                console.log(`[AntiCheat] KICKED ${playerId}: ${result.reason}`);
                return { action: 'kick', message: result.reason };

            case 'warning':
                const warnings = (this.warnings.get(playerId) || 0) + 1;
                this.warnings.set(playerId, warnings);
                console.log(`[AntiCheat] WARNING ${playerId} (${warnings}): ${result.reason}`);

                // Auto-kick after 5 warnings
                if (warnings >= 5) {
                    return { action: 'kick', message: 'Too many warnings' };
                }
                return { action: 'warn', message: result.reason };

            default:
                return { action: 'allow' };
        }
    }

    /**
     * Validate and process an input
     */
    validateInput(playerId: string, input: PlayerInput): {
        action: 'allow' | 'warn' | 'kick' | 'ban';
        message?: string;
    } {
        // Check rate limit first
        if (!this.rateLimiter.allowPacket(playerId)) {
            return { action: 'warn', message: 'Packet rate too high' };
        }

        const result = this.inputValidator.validateInput(playerId, input);
        return this.processResult(playerId, result);
    }

    /**
     * Validate position update
     */
    validatePosition(playerId: string, position: Vector2, dt: number): {
        action: 'allow' | 'warn' | 'kick' | 'ban';
        message?: string;
    } {
        const result = this.inputValidator.validatePosition(playerId, position, dt);
        return this.processResult(playerId, result);
    }

    /**
     * Validate a kill
     */
    validateKill(
        killerId: string,
        victimId: string,
        killerPosition: Vector2,
        victimPosition: Vector2,
        weaponRange: number
    ): {
        action: 'allow' | 'warn' | 'kick' | 'ban';
        message?: string;
    } {
        const result = this.inputValidator.validateKill(
            killerId,
            victimId,
            killerPosition,
            victimPosition,
            weaponRange
        );
        return this.processResult(killerId, result);
    }

    /**
     * Get the input validator for direct access
     */
    getInputValidator(): InputValidator {
        return this.inputValidator;
    }

    /**
     * Get the replay validator for hit validation
     */
    getReplayValidator(): ReplayValidator {
        return this.replayValidator;
    }
}

// Export singleton instance for use in game server
export const antiCheat = new AntiCheatManager();
