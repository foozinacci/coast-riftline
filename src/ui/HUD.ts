// HUD System - mobile-first heads up display

import { GamePhase, RiftlinePhase } from '../core/types';
import { COLORS } from '../core/constants';
import { formatTime, colorWithAlpha } from '../core/utils';
import { Player } from '../entities/Player';
import { Renderer } from '../core/renderer';
import { RiftlineState } from '../systems/Riftline';

export class HUD {
  private showTouchControls: boolean;
  private enableKillFeed: boolean = true;
  private notifications: { id: number; text: string; color: string; timestamp: number }[] = [];
  private notificationCounter: number = 0;

  constructor(isMobile: boolean) {
    this.showTouchControls = isMobile;
  }

  setKillFeedEnabled(enabled: boolean): void {
    this.enableKillFeed = enabled;
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

    // Riftline info
    this.renderRiftlineInfo(renderer, screen, riftlineState);

    // Relic counter
    this.renderRelicCounter(renderer, screen, relicsDelivered, totalRelics);

    if (player) {
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
        this.renderTouchControls(renderer, screen);
      }
    }

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
    screen: { x: number; y: number }
  ): void {
    const joystickRadius = 60;
    const joystickAlpha = 0.2;

    // Left joystick (movement)
    const leftX = 100;
    const leftY = screen.y - 120;

    renderer.drawScreenCircle(
      { x: leftX, y: leftY },
      joystickRadius,
      colorWithAlpha('#ffffff', joystickAlpha),
      colorWithAlpha('#ffffff', joystickAlpha * 2),
      2
    );
    renderer.drawScreenCircle(
      { x: leftX, y: leftY },
      20,
      colorWithAlpha('#ffffff', joystickAlpha * 1.5)
    );

    // Right joystick (aim/fire)
    const rightX = screen.x - 100;
    const rightY = screen.y - 120;

    renderer.drawScreenCircle(
      { x: rightX, y: rightY },
      joystickRadius,
      colorWithAlpha('#ff4444', joystickAlpha),
      colorWithAlpha('#ff4444', joystickAlpha * 2),
      2
    );
    renderer.drawScreenCircle(
      { x: rightX, y: rightY },
      20,
      colorWithAlpha('#ff4444', joystickAlpha * 1.5)
    );

    // Labels
    renderer.drawScreenText(
      'MOVE',
      leftX,
      leftY + joystickRadius + 15,
      colorWithAlpha('#ffffff', 0.3),
      10,
      'center',
      'top'
    );
    renderer.drawScreenText(
      'AIM & FIRE',
      rightX,
      rightY + joystickRadius + 15,
      colorWithAlpha('#ff4444', 0.3),
      10,
      'center',
      'top'
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
}
