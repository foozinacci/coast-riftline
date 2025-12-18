// HUD System - mobile-first heads up display

import { GamePhase, RiftlinePhase, GameMode } from '../core/types';
import { COLORS } from '../core/constants';
import { formatTime, colorWithAlpha } from '../core/utils';
import { Player } from '../entities/Player';
import { Renderer } from '../core/renderer';
import { RiftlineState } from '../systems/Riftline';

/**
 * Arena HUD state for persistent round display
 */
export interface ArenaHUDState {
  mode: GameMode;
  currentRound: number;
  maxRounds: number;
  teamScores: Map<string, number>;
  teamNames: Map<string, string>;
  teamColors: Map<string, string>;
  phase: 'waiting' | 'round_start' | 'combat' | 'round_end' | 'match_end';
  timeRemaining: number;
  isActive: boolean;
}


export class HUD {
  private showTouchControls: boolean;
  private enableKillFeed: boolean = true;
  private notifications: { id: number; text: string; color: string; timestamp: number }[] = [];
  private notificationCounter: number = 0;
  private arenaState: ArenaHUDState | null = null;

  // Animation state for polish effects
  private animationTime: number = 0;
  private roundTransitionAlpha: number = 0;
  private lastRound: number = 0;
  private roundTransitionActive: boolean = false;

  // Damage indicator system
  private damageIndicators: { angle: number; intensity: number; timestamp: number }[] = [];

  // Kill streak tracking
  private currentKillStreak: number = 0;
  private killStreakTimer: number = 0;
  private lastKillTime: number = 0;

  // Score change animations
  private scoreAnimations: { value: string; x: number; y: number; color: string; timestamp: number }[] = [];

  // Low health/ammo tracking
  private lastHealth: number = 100;
  private healthFlashIntensity: number = 0;

  constructor(isMobile: boolean) {
    this.showTouchControls = isMobile;
  }

  setKillFeedEnabled(enabled: boolean): void {
    this.enableKillFeed = enabled;
  }

  /**
   * Set arena state for persistent HUD display
   */
  setArenaState(state: ArenaHUDState | null): void {
    this.arenaState = state;
  }

  /**
   * Update arena state properties without replacing entire state
   */
  updateArenaState(updates: Partial<ArenaHUDState>): void {
    if (this.arenaState) {
      Object.assign(this.arenaState, updates);
    }
  }


  addNotification(text: string, color: string = '#ffffff'): void {
    const id = this.notificationCounter++;
    this.notifications.push({
      id,
      text,
      color,
      timestamp: Date.now(),
    });

    // Keep max 5
    if (this.notifications.length > 5) {
      this.notifications.shift();
    }
  }

  /**
   * Add a damage direction indicator
   * @param angle - Direction the damage came from (radians)
   * @param intensity - How intense the indicator should be (0-1)
   */
  addDamageIndicator(angle: number, intensity: number = 1): void {
    this.damageIndicators.push({
      angle,
      intensity: Math.min(1, intensity),
      timestamp: Date.now(),
    });

    // Keep max 8 indicators
    if (this.damageIndicators.length > 8) {
      this.damageIndicators.shift();
    }
  }

  /**
   * Register a kill for kill streak tracking
   */
  registerKill(): void {
    const now = Date.now();

    // Reset streak if too much time passed (5 seconds)
    if (now - this.lastKillTime > 5000) {
      this.currentKillStreak = 0;
    }

    this.currentKillStreak++;
    this.lastKillTime = now;
    this.killStreakTimer = 3000; // Show for 3 seconds

    // Add notification for kill streaks
    if (this.currentKillStreak >= 2) {
      const streakNames: Record<number, { text: string; color: string }> = {
        2: { text: 'DOUBLE KILL', color: '#ffaa00' },
        3: { text: 'TRIPLE KILL', color: '#ff6600' },
        4: { text: 'QUAD KILL', color: '#ff3300' },
        5: { text: 'PENTA KILL', color: '#ff0000' },
      };
      const streak = streakNames[Math.min(this.currentKillStreak, 5)];
      if (streak) {
        this.addNotification(streak.text, streak.color);
      }
    }
  }

  /**
   * Add a floating score/damage number
   */
  addScoreAnimation(value: string, x: number, y: number, color: string = '#ffffff'): void {
    this.scoreAnimations.push({
      value,
      x,
      y,
      color,
      timestamp: Date.now(),
    });

    // Keep max 10
    if (this.scoreAnimations.length > 10) {
      this.scoreAnimations.shift();
    }
  }

  /**
   * Track player health for flash effects
   */
  updatePlayerHealth(currentHealth: number): void {
    if (currentHealth < this.lastHealth) {
      // Took damage - flash
      this.healthFlashIntensity = Math.min(1, (this.lastHealth - currentHealth) / 50);
    }
    this.lastHealth = currentHealth;
  }

  render(
    renderer: Renderer,
    player: Player | null,
    gamePhase: GamePhase,
    riftlineState: RiftlineState,
    aliveSquads: number,
    relicsDelivered: number,
    totalRelics: number
  ): void {
    const screen = renderer.getScreenSize();

    // Always show game info
    this.renderGameInfo(renderer, screen, gamePhase, aliveSquads);

    // Arena HUD (persistent round display for arena modes)
    if (this.arenaState?.isActive) {
      this.renderArenaStatus(renderer, screen);
    }

    // Riftline info (only show if not in arena mode)
    if (!this.arenaState?.isActive) {
      this.renderRiftlineInfo(renderer, screen, riftlineState);
    }

    // Relic counter (only for main mode)
    if (!this.arenaState?.isActive) {
      this.renderRelicCounter(renderer, screen, relicsDelivered, totalRelics);
    }

    if (player) {
      // Update health tracking
      this.updatePlayerHealth(player.state.health);

      // Player status
      this.renderPlayerStatus(renderer, screen, player);

      // Weapon info
      this.renderWeaponInfo(renderer, screen, player);

      // Respawn indicator (if dead)
      if (!player.state.isAlive) {
        this.renderRespawnOverlay(renderer, screen, player);
      }

      // Touch controls overlay
      if (this.showTouchControls) {
        this.renderTouchControls(renderer, screen, player);
      }

      // Damage direction indicators
      this.renderDamageIndicators(renderer, screen);

      // Low health damage flash
      this.renderDamageFlash(renderer, screen);
    }

    // Kill streak display
    this.renderKillStreak(renderer, screen);

    // Floating score/damage numbers
    this.renderScoreAnimations(renderer);

    // Render Notifications (Kill Feed)
    if (this.enableKillFeed) {
      this.renderNotifications(renderer, screen);
    }
  }

  private renderGameInfo(
    renderer: Renderer,
    screen: { x: number; y: number },
    gamePhase: GamePhase,
    aliveSquads: number
  ): void {
    // Render Pause Button (Top Left)
    const btnSize = 40;
    const btnX = 30;
    const btnY = 30;

    renderer.drawScreenRect(
      btnX - btnSize / 2,
      btnY - btnSize / 2,
      btnSize,
      btnSize,
      'rgba(0, 0, 0, 0.5)',
      'rgba(255, 255, 255, 0.3)',
      1
    );

    // Draw Pause Bars "||"
    const barW = 4;
    const barH = 14;
    renderer.drawScreenRect(btnX - 5, btnY - barH / 2, barW, barH, '#ffffff');
    renderer.drawScreenRect(btnX + 1, btnY - barH / 2, barW, barH, '#ffffff');

    const x = screen.x / 2;
    const y = 20;

    // Squads remaining
    renderer.drawScreenText(
      `${aliveSquads} SQUADS`,
      x,
      y,
      '#ffffff',
      16,
      'center',
      'top'
    );

    // Game phase (if not playing)
    if (gamePhase !== GamePhase.PLAYING) {
      renderer.drawScreenText(
        gamePhase.toUpperCase().replace('_', ' '),
        x,
        y + 25,
        COLORS.vault,
        14,
        'center',
        'top'
      );
    }
  }

  /**
   * Render persistent arena round/score display (supports 2 and 3 teams)
   */
  private renderArenaStatus(
    renderer: Renderer,
    screen: { x: number; y: number }
  ): void {
    if (!this.arenaState) return;

    // Update animation time
    this.animationTime += 0.016;

    // Check for round transition
    if (this.arenaState.currentRound !== this.lastRound) {
      this.lastRound = this.arenaState.currentRound;
      this.roundTransitionActive = true;
      this.roundTransitionAlpha = 1.0;
    }

    // Decay round transition
    if (this.roundTransitionActive && this.roundTransitionAlpha > 0) {
      this.roundTransitionAlpha -= 0.02;
      if (this.roundTransitionAlpha <= 0) {
        this.roundTransitionActive = false;
        this.roundTransitionAlpha = 0;
      }
    }

    const centerX = screen.x / 2;
    const topY = 60;
    const panelWidth = 300;
    const panelHeight = 100;

    // Animated border glow based on phase
    let borderGlow = 'rgba(100, 180, 255, 0.4)';
    let borderWidth = 1;

    if (this.arenaState.phase === 'round_start') {
      // Pulse effect for round start
      const pulse = Math.sin(this.animationTime * 6) * 0.3 + 0.7;
      borderGlow = `rgba(255, 200, 80, ${pulse})`;
      borderWidth = 2;
    } else if (this.arenaState.phase === 'combat' && this.arenaState.timeRemaining <= 30) {
      // Urgent pulse when time is low
      const pulse = Math.sin(this.animationTime * 8) * 0.4 + 0.6;
      borderGlow = `rgba(255, 80, 80, ${pulse})`;
      borderWidth = 2;
    } else if (this.arenaState.phase === 'round_end') {
      borderGlow = 'rgba(80, 255, 120, 0.6)';
      borderWidth = 2;
    } else if (this.arenaState.phase === 'match_end') {
      const pulse = Math.sin(this.animationTime * 4) * 0.3 + 0.7;
      borderGlow = `rgba(255, 215, 0, ${pulse})`;
      borderWidth = 3;
    }

    // Background panel with animated border
    renderer.drawScreenRect(
      centerX - panelWidth / 2,
      topY - 10,
      panelWidth,
      panelHeight,
      'rgba(10, 15, 20, 0.9)',
      borderGlow,
      borderWidth
    );

    // Round transition flash overlay
    if (this.roundTransitionActive) {
      const flashAlpha = this.roundTransitionAlpha * 0.3;
      renderer.drawScreenRect(
        centerX - panelWidth / 2,
        topY - 10,
        panelWidth,
        panelHeight,
        `rgba(255, 255, 255, ${flashAlpha})`,
        'transparent',
        0
      );
    }

    // Mode name
    const modeName = this.getArenaModeName(this.arenaState.mode);
    renderer.drawScreenText(
      modeName,
      centerX,
      topY,
      'rgba(100, 200, 255, 1)',
      14,
      'center',
      'top'
    );

    // Round counter
    renderer.drawScreenText(
      `Round ${this.arenaState.currentRound} / ${this.arenaState.maxRounds}`,
      centerX,
      topY + 20,
      '#ffffff',
      16,
      'center',
      'top'
    );

    // Team scores - support 2 or 3 teams
    const teams = Array.from(this.arenaState.teamScores.entries());
    const scoreY = topY + 45;

    if (teams.length === 3) {
      // 3-team layout (1v1v1, 3v3v3)
      const positions = [-90, 0, 90];
      const colors = ['#4488ff', '#44ff44', '#ff4444'];
      teams.forEach((team, i) => {
        const teamName = this.arenaState!.teamNames.get(team[0]) || `Team ${i + 1}`;
        const teamColor = this.arenaState!.teamColors.get(team[0]) || colors[i];

        renderer.drawScreenText(teamName, centerX + positions[i], scoreY, teamColor, 11, 'center', 'top');
        renderer.drawScreenText(`${team[1]}`, centerX + positions[i], scoreY + 15, teamColor, 22, 'center', 'top');
      });
    } else if (teams.length >= 2) {
      // 2-team layout (1v1, 3v3)
      const team1 = teams[0];
      const team2 = teams[1];
      const team1Name = this.arenaState.teamNames.get(team1[0]) || 'Team 1';
      const team2Name = this.arenaState.teamNames.get(team2[0]) || 'Team 2';
      const team1Color = this.arenaState.teamColors.get(team1[0]) || '#4488ff';
      const team2Color = this.arenaState.teamColors.get(team2[0]) || '#ff4444';

      renderer.drawScreenText(team1Name, centerX - 80, scoreY, team1Color, 12, 'center', 'top');
      renderer.drawScreenText(`${team1[1]}`, centerX - 80, scoreY + 18, team1Color, 24, 'center', 'top');

      renderer.drawScreenText('—', centerX, scoreY + 15, '#666666', 20, 'center', 'top');

      renderer.drawScreenText(team2Name, centerX + 80, scoreY, team2Color, 12, 'center', 'top');
      renderer.drawScreenText(`${team2[1]}`, centerX + 80, scoreY + 18, team2Color, 24, 'center', 'top');
    }

    // Phase/timer text with animation
    let phaseText = '';
    let phaseColor = '#888888';
    let fontSize = 14;

    switch (this.arenaState.phase) {
      case 'combat':
        phaseText = formatTime(this.arenaState.timeRemaining);
        if (this.arenaState.timeRemaining <= 10) {
          // Critical time - pulse effect and larger text
          const pulse = Math.sin(this.animationTime * 12) * 0.3 + 0.7;
          phaseColor = `rgba(255, ${Math.floor(60 * pulse)}, ${Math.floor(60 * pulse)}, 1)`;
          fontSize = 18 + Math.sin(this.animationTime * 6) * 2;
        } else if (this.arenaState.timeRemaining <= 30) {
          phaseColor = '#ff6644';
          fontSize = 16;
        } else {
          phaseColor = '#44ff88';
        }
        break;
      case 'round_start':
        phaseText = 'ROUND STARTING';
        const startPulse = Math.sin(this.animationTime * 5) * 0.3 + 0.7;
        phaseColor = `rgba(255, 200, 80, ${startPulse})`;
        fontSize = 16;
        break;
      case 'round_end':
        phaseText = 'ROUND COMPLETE';
        phaseColor = '#44ff88';
        fontSize = 15;
        break;
      case 'match_end':
        phaseText = 'MATCH COMPLETE';
        const matchPulse = Math.sin(this.animationTime * 3) * 0.2 + 0.8;
        phaseColor = `rgba(255, 215, 0, ${matchPulse})`;
        fontSize = 18;
        break;
    }

    if (phaseText) {
      renderer.drawScreenText(phaseText, centerX, topY + panelHeight - 15, phaseColor, fontSize, 'center', 'top');
    }
  }

  /**
   * Get display name for arena mode
   */
  private getArenaModeName(mode: GameMode): string {
    switch (mode) {
      case GameMode.ARENA_1V1: return 'ARENA 1v1';
      case GameMode.ARENA_1V1V1: return 'ARENA 1v1v1';
      case GameMode.ARENA_3V3: return 'ARENA 3v3';
      case GameMode.ARENA_3V3V3: return 'ARENA 3v3v3';
      default: return 'ARENA';
    }
  }

  private renderRiftlineInfo(
    renderer: Renderer,
    screen: { x: number; y: number },
    state: RiftlineState
  ): void {
    const x = screen.x / 2;
    const y = 50;

    // Phase name with color
    let phaseColor = '#44ff88';
    if (state.phase === RiftlinePhase.COMPRESSION) phaseColor = '#ffaa44';
    if (state.phase === RiftlinePhase.CONVERGENCE) phaseColor = '#ff4444';

    renderer.drawScreenText(
      state.phase.toUpperCase(),
      x,
      y,
      phaseColor,
      12,
      'center',
      'top'
    );

    // Timer
    const timeStr = formatTime(state.phaseTimer);
    renderer.drawScreenText(
      timeStr,
      x,
      y + 16,
      '#ffffff',
      18,
      'center',
      'top'
    );
  }

  private renderRelicCounter(
    renderer: Renderer,
    screen: { x: number; y: number },
    delivered: number,
    total: number
  ): void {
    const x = screen.x - 20;
    const y = 20;

    // Relic icon
    renderer.drawScreenRect(x - 50, y, 40, 24, 'rgba(0, 0, 0, 0.5)', COLORS.relic, 1);

    // Count
    renderer.drawScreenText(
      `${delivered}/${total}`,
      x - 30,
      y + 12,
      COLORS.relic,
      14,
      'center',
      'middle'
    );

    // Label
    renderer.drawScreenText(
      'RELICS',
      x - 30,
      y + 30,
      '#888888',
      10,
      'center',
      'top'
    );
  }

  private renderPlayerStatus(
    renderer: Renderer,
    screen: { x: number; y: number },
    player: Player
  ): void {
    const x = 20;
    const y = screen.y - 100;
    const barWidth = 150;
    const barHeight = 12;

    // Health bar background
    renderer.drawScreenRect(x, y, barWidth, barHeight, '#222222', '#333333', 1);

    // Health fill
    const healthPercent = player.state.health / player.state.maxHealth;
    renderer.drawScreenRect(
      x,
      y,
      barWidth * healthPercent,
      barHeight,
      COLORS.healthBar
    );

    // Health text
    renderer.drawScreenText(
      `${Math.ceil(player.state.health)}`,
      x + barWidth + 10,
      y + barHeight / 2,
      '#ffffff',
      12,
      'left',
      'middle'
    );

    // Shield bar (if has shield)
    if (player.state.maxShield > 0) {
      const shieldY = y - barHeight - 5;
      // Background rect: (x, y, w, h)
      renderer.drawScreenRect(x, shieldY, barWidth, barHeight, '#222222', '#333333', 1);

      const shieldPercent = player.state.shield / player.state.maxShield;
      renderer.drawScreenRect(
        x,
        shieldY,
        barWidth * shieldPercent,
        barHeight,
        COLORS.shieldBar
      );

      renderer.drawScreenText(
        `${Math.ceil(player.state.shield)}`,
        x + barWidth + 10,
        shieldY + barHeight / 2,
        '#ffffff',
        12,
        'left',
        'middle'
      );
    }

    // Class indicator
    renderer.drawScreenText(
      player.playerClass.toUpperCase(),
      x,
      y + barHeight + 10,
      player.color,
      12,
      'left',
      'top'
    );

    // Relic indicator
    if (player.hasRelic) {
      renderer.drawScreenRect(x + 100, y + barHeight + 5, 20, 20, COLORS.relic, '#ffffff', 1);
      renderer.drawScreenText('R', x + 110, y + barHeight + 15, '#000000', 10, 'center', 'middle');
    }
  }

  private renderWeaponInfo(
    renderer: Renderer,
    screen: { x: number; y: number },
    player: Player
  ): void {
    const x = screen.x - 20;
    const y = screen.y - 80;

    // Weapon name
    renderer.drawScreenText(
      player.weapon.config.name,
      x,
      y,
      '#ffffff',
      14,
      'right',
      'top'
    );

    // Ammo counter
    const ammoColor = player.weapon.currentAmmo <= 5 ? '#ff4444' : '#ffffff';
    renderer.drawScreenText(
      `${player.weapon.currentAmmo} / ${player.weapon.config.magazineSize}`,
      x,
      y + 20,
      ammoColor,
      18,
      'right',
      'top'
    );

    // Reload indicator
    if (player.weapon.isReloading) {
      const progress = 1 - player.weapon.reloadTimer / player.weapon.config.reloadTime;
      const barWidth = 100;

      renderer.drawScreenRect(x - barWidth, y + 45, barWidth, 6, '#333333');
      renderer.drawScreenRect(x - barWidth, y + 45, barWidth * progress, 6, '#ffaa44');

      renderer.drawScreenText(
        'RELOADING',
        x - barWidth / 2,
        y + 60,
        '#ffaa44',
        10,
        'center',
        'top'
      );
    }
  }

  private renderRespawnOverlay(
    renderer: Renderer,
    screen: { x: number; y: number },
    player: Player
  ): void {
    // Darken screen
    renderer.drawScreenRect(
      0,
      0,
      screen.x,
      screen.y,
      'rgba(0, 0, 0, 0.6)'
    );

    const centerX = screen.x / 2;
    const centerY = screen.y / 2;

    // Death message
    renderer.drawScreenText(
      'ELIMINATED',
      centerX,
      centerY - 50,
      '#ff4444',
      32,
      'center',
      'middle'
    );

    // Respawn timer
    if (player.state.respawnTimer > 0) {
      const seconds = Math.ceil(player.state.respawnTimer / 1000);
      renderer.drawScreenText(
        `Respawning in ${seconds}...`,
        centerX,
        centerY,
        '#ffffff',
        20,
        'center',
        'middle'
      );

      // Progress bar
      const barWidth = 200;
      const progress = 1 - player.state.respawnTimer / 8000; // Assume 8s base
      renderer.drawScreenRect(
        centerX - barWidth / 2,
        centerY + 30,
        barWidth,
        8,
        '#333333'
      );
      renderer.drawScreenRect(
        centerX - barWidth / 2,
        centerY + 30,
        barWidth * progress,
        8,
        COLORS.respawnOrb
      );
    } else {
      renderer.drawScreenText(
        'Waiting for teammate...',
        centerX,
        centerY,
        '#888888',
        16,
        'center',
        'middle'
      );
    }
  }

  private renderTouchControls(
    renderer: Renderer,
    screen: { x: number; y: number },
    player: Player
  ): void {
    const buttonSize = 50;
    const buttonAlpha = 0.35;
    const margin = 20;

    // Right side - ability buttons (replacing fixed joystick)
    const rightBaseX = screen.x - margin - buttonSize;
    const rightBaseY = screen.y - margin - buttonSize;

    // Fire button (largest, bottom right)
    const fireSize = 70;
    renderer.drawScreenCircle(
      { x: rightBaseX - fireSize / 2 + buttonSize / 2, y: rightBaseY - fireSize / 2 + buttonSize / 2 },
      fireSize / 2,
      colorWithAlpha('#ff4444', buttonAlpha),
      colorWithAlpha('#ff4444', buttonAlpha * 2),
      3
    );
    renderer.drawScreenText(
      'FIRE',
      rightBaseX - fireSize / 2 + buttonSize / 2,
      rightBaseY - fireSize / 2 + buttonSize / 2,
      colorWithAlpha('#ffffff', 0.5),
      14,
      'center',
      'middle'
    );

    // Dash button (above fire)
    const dashY = rightBaseY - fireSize - margin;
    renderer.drawScreenCircle(
      { x: rightBaseX - buttonSize / 2 + buttonSize / 2, y: dashY },
      buttonSize / 2,
      colorWithAlpha('#00ccff', buttonAlpha),
      colorWithAlpha('#00ccff', buttonAlpha * 2),
      2
    );
    // Show dash charges
    const dashReady = player.dashCharges > 0;
    renderer.drawScreenText(
      dashReady ? `${player.dashCharges}` : '0',
      rightBaseX,
      dashY - 5,
      colorWithAlpha(dashReady ? '#ffffff' : '#666666', dashReady ? 0.8 : 0.4),
      16,
      'center',
      'middle'
    );
    renderer.drawScreenText(
      'DASH',
      rightBaseX,
      dashY + 12,
      colorWithAlpha('#ffffff', 0.4),
      8,
      'center',
      'middle'
    );

    // Tactical button (above dash)
    const tacticalY = dashY - buttonSize - margin;
    const tacticalReady = player.isTacticalReady();
    const tacticalProgress = player.getTacticalProgress();

    // Progress ring if cooling down
    if (!tacticalReady) {
      // Draw cooldown progress as partial circle
      const ctx = renderer.getContext();
      ctx.save();
      ctx.beginPath();
      ctx.arc(rightBaseX, tacticalY, buttonSize / 2 + 3, -Math.PI / 2, -Math.PI / 2 + (tacticalProgress * Math.PI * 2), false);
      ctx.strokeStyle = colorWithAlpha('#ffcc00', 0.6);
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.restore();
    }

    renderer.drawScreenCircle(
      { x: rightBaseX, y: tacticalY },
      buttonSize / 2,
      colorWithAlpha(tacticalReady ? '#ffcc00' : '#555555', buttonAlpha),
      colorWithAlpha(tacticalReady ? '#ffcc00' : '#555555', buttonAlpha * 2),
      2
    );
    renderer.drawScreenText(
      tacticalReady ? 'Q' : `${Math.ceil((1 - tacticalProgress) * (player.tacticalCooldown / 1000))}`,
      rightBaseX,
      tacticalY,
      colorWithAlpha(tacticalReady ? '#ffffff' : '#aaaaaa', 0.6),
      tacticalReady ? 14 : 12,
      'center',
      'middle'
    );

    // Reload button (left of fire)
    const reloadX = rightBaseX - fireSize - margin;
    renderer.drawScreenCircle(
      { x: reloadX, y: rightBaseY - fireSize / 2 + buttonSize / 2 },
      buttonSize / 2,
      colorWithAlpha('#44ff44', buttonAlpha),
      colorWithAlpha('#44ff44', buttonAlpha * 2),
      2
    );
    renderer.drawScreenText(
      'R',
      reloadX,
      rightBaseY - fireSize / 2 + buttonSize / 2,
      colorWithAlpha('#ffffff', 0.5),
      14,
      'center',
      'middle'
    );

    // Left side hint - dynamic joystick area
    const leftX = 100;
    const leftY = screen.y - 120;
    renderer.drawScreenText(
      'TOUCH TO MOVE',
      leftX,
      leftY,
      colorWithAlpha('#ffffff', 0.2),
      12,
      'center',
      'middle'
    );

    // Mobile zoom buttons (per spec A6)
    this.renderZoomButtons(renderer, screen);
  }

  /**
   * Render zoom +/- buttons for mobile (per spec A6).
   * Pinch-to-zoom is disabled by default; these buttons provide explicit zoom control.
   */
  private renderZoomButtons(
    renderer: Renderer,
    screen: { x: number; y: number }
  ): void {
    const buttonSize = 40;
    const buttonSpacing = 10;
    const buttonX = screen.x - 60;
    const buttonY = screen.y / 2;

    // Zoom In button (+)
    const zoomInY = buttonY - buttonSize - buttonSpacing;
    renderer.drawScreenRect(
      buttonX - buttonSize / 2,
      zoomInY - buttonSize / 2,
      buttonSize,
      buttonSize,
      'rgba(60, 80, 100, 0.6)',
      'rgba(100, 150, 200, 0.8)',
      2
    );
    renderer.drawScreenText(
      '+',
      buttonX,
      zoomInY,
      'rgba(200, 220, 255, 0.9)',
      24,
      'center',
      'middle'
    );

    // Zoom Out button (-)
    const zoomOutY = buttonY + buttonSpacing;
    renderer.drawScreenRect(
      buttonX - buttonSize / 2,
      zoomOutY - buttonSize / 2,
      buttonSize,
      buttonSize,
      'rgba(60, 80, 100, 0.6)',
      'rgba(100, 150, 200, 0.8)',
      2
    );
    renderer.drawScreenText(
      '−',
      buttonX,
      zoomOutY,
      'rgba(200, 220, 255, 0.9)',
      24,
      'center',
      'middle'
    );

    // Label
    renderer.drawScreenText(
      'ZOOM',
      buttonX,
      buttonY + buttonSize + buttonSpacing + 5,
      colorWithAlpha('#ffffff', 0.3),
      10,
      'center',
      'top'
    );
  }

  renderGameOver(
    renderer: Renderer,
    isWinner: boolean,
    stats: { kills: number; deaths: number; damageDealt: number }
  ): void {
    const screen = renderer.getScreenSize();
    const centerX = screen.x / 2;
    const centerY = screen.y / 2;

    // Background overlay
    renderer.drawScreenRect(0, 0, screen.x, screen.y, 'rgba(0, 0, 0, 0.8)');

    // Result
    if (isWinner) {
      renderer.drawScreenText(
        'VICTORY',
        centerX,
        centerY - 80,
        COLORS.vault,
        48,
        'center',
        'middle'
      );
      renderer.drawScreenText(
        'Your squad survived the Riftline',
        centerX,
        centerY - 30,
        '#ffffff',
        16,
        'center',
        'middle'
      );
    } else {
      renderer.drawScreenText(
        'DEFEATED',
        centerX,
        centerY - 80,
        '#ff4444',
        48,
        'center',
        'middle'
      );
      renderer.drawScreenText(
        'Your squad was eliminated',
        centerX,
        centerY - 30,
        '#888888',
        16,
        'center',
        'middle'
      );
    }

    // Stats
    const statsY = centerY + 30;
    renderer.drawScreenText(
      `Kills: ${stats.kills}`,
      centerX,
      statsY,
      '#ffffff',
      14,
      'center',
      'top'
    );
    renderer.drawScreenText(
      `Deaths: ${stats.deaths}`,
      centerX,
      statsY + 25,
      '#ffffff',
      14,
      'center',
      'top'
    );
    renderer.drawScreenText(
      `Damage: ${Math.floor(stats.damageDealt)}`,
      centerX,
      statsY + 50,
      '#ffffff',
      14,
      'center',
      'top'
    );

    // Continue prompt
    renderer.drawScreenText(
      'Tap to continue',
      centerX,
      screen.y - 50,
      '#888888',
      14,
      'center',
      'middle'
    );
  }

  private renderNotifications(
    renderer: Renderer,
    screen: { x: number; y: number }
  ): void {
    const startX = screen.x - 20;
    const startY = 80; // Below Relic Counter
    const lineHeight = 20;
    const now = Date.now();
    const fadeDuration = 500; // ms
    const displayDuration = 5000; // ms

    // Filter old
    this.notifications = this.notifications.filter(n => now - n.timestamp < displayDuration + fadeDuration);

    this.notifications.forEach((note, index) => {
      const age = now - note.timestamp;
      let alpha = 1;

      // Fade in
      if (age < 200) {
        alpha = age / 200;
      }
      // Fade out
      else if (age > displayDuration) {
        alpha = 1 - (age - displayDuration) / fadeDuration;
      }

      if (alpha <= 0) return;

      const y = startY + index * lineHeight;

      renderer.drawScreenText(
        note.text,
        startX,
        y,
        colorWithAlpha(note.color, alpha),
        12,
        'right',
        'top'
      );
    });
  }

  /**
   * Render directional damage indicators around screen edge
   */
  private renderDamageIndicators(
    renderer: Renderer,
    screen: { x: number; y: number }
  ): void {
    const now = Date.now();
    const centerX = screen.x / 2;
    const centerY = screen.y / 2;
    const radius = Math.min(centerX, centerY) - 40;
    const indicatorSize = 30;

    // Filter expired indicators (1 second lifetime)
    this.damageIndicators = this.damageIndicators.filter(d => now - d.timestamp < 1000);

    for (const indicator of this.damageIndicators) {
      const age = now - indicator.timestamp;
      const alpha = (1 - age / 1000) * indicator.intensity;

      if (alpha <= 0) continue;

      // Calculate position on screen edge
      const x = centerX + Math.cos(indicator.angle) * radius;
      const y = centerY + Math.sin(indicator.angle) * radius;

      // Draw damage arrow pointing inward
      const arrowLength = indicatorSize;
      const arrowWidth = 8;
      const inwardAngle = indicator.angle + Math.PI; // Point toward center

      // Arrow head
      const tipX = x + Math.cos(inwardAngle) * arrowLength * 0.5;
      const tipY = y + Math.sin(inwardAngle) * arrowLength * 0.5;

      // Draw as red glow wedge
      const color = `rgba(255, 50, 50, ${alpha})`;

      // Simple triangle representation
      renderer.drawScreenRect(
        x - arrowWidth / 2,
        y - arrowWidth / 2,
        arrowWidth,
        arrowLength,
        color,
        'transparent',
        0
      );
    }
  }

  /**
   * Render red flash/vignette when taking damage
   */
  private renderDamageFlash(
    renderer: Renderer,
    screen: { x: number; y: number }
  ): void {
    if (this.healthFlashIntensity <= 0) return;

    // Draw vignette overlay
    const alpha = this.healthFlashIntensity * 0.4;

    // Top edge
    renderer.drawScreenRect(
      0, 0,
      screen.x, 40,
      `rgba(255, 0, 0, ${alpha * 0.8})`,
      'transparent', 0
    );

    // Bottom edge
    renderer.drawScreenRect(
      0, screen.y - 40,
      screen.x, 40,
      `rgba(255, 0, 0, ${alpha * 0.8})`,
      'transparent', 0
    );

    // Left edge
    renderer.drawScreenRect(
      0, 0,
      40, screen.y,
      `rgba(255, 0, 0, ${alpha * 0.6})`,
      'transparent', 0
    );

    // Right edge
    renderer.drawScreenRect(
      screen.x - 40, 0,
      40, screen.y,
      `rgba(255, 0, 0, ${alpha * 0.6})`,
      'transparent', 0
    );

    // Decay flash
    this.healthFlashIntensity = Math.max(0, this.healthFlashIntensity - 0.05);
  }

  /**
   * Render kill streak display in center
   */
  private renderKillStreak(
    renderer: Renderer,
    screen: { x: number; y: number }
  ): void {
    if (this.killStreakTimer <= 0 || this.currentKillStreak < 2) return;

    const centerX = screen.x / 2;
    const y = screen.y * 0.35;

    // Decay timer
    this.killStreakTimer = Math.max(0, this.killStreakTimer - 16);

    // Calculate alpha for fade out
    const alpha = Math.min(1, this.killStreakTimer / 1000);

    // Streak text
    const streakText = `${this.currentKillStreak}x KILL STREAK`;
    const colors = ['#ffcc00', '#ff8800', '#ff4400', '#ff0000'];
    const colorIndex = Math.min(this.currentKillStreak - 2, colors.length - 1);
    const color = colors[colorIndex];

    // Pulse effect
    const pulse = Math.sin(this.animationTime * 8) * 0.1 + 0.9;
    const fontSize = 20 * pulse;

    renderer.drawScreenText(
      streakText,
      centerX,
      y,
      colorWithAlpha(color, alpha),
      fontSize,
      'center',
      'middle'
    );
  }

  /**
   * Render floating damage/score numbers
   */
  private renderScoreAnimations(renderer: Renderer): void {
    const now = Date.now();
    const duration = 1500; // 1.5 seconds

    // Filter expired
    this.scoreAnimations = this.scoreAnimations.filter(a => now - a.timestamp < duration);

    for (const anim of this.scoreAnimations) {
      const age = now - anim.timestamp;
      const progress = age / duration;

      // Float upward
      const floatY = anim.y - progress * 50;

      // Fade out
      const alpha = 1 - progress;

      // Scale up then down
      const scale = progress < 0.2 ? progress / 0.2 : 1 - (progress - 0.2) * 0.3;
      const fontSize = 14 * scale;

      renderer.drawScreenText(
        anim.value,
        anim.x,
        floatY,
        colorWithAlpha(anim.color, alpha),
        Math.max(8, fontSize),
        'center',
        'middle'
      );
    }
  }
}
