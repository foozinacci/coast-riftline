import type { Role, GameScreen } from '../types';
import { ROLE_STATS } from '../types';
import { lobbyManager, SHARDS, type Shard, type Party, type PartyMember } from '../lib/lobby';

const COLORS = {
  background: '#0a0a0f',
  backgroundAlt: '#12121a',
  grid: '#1a1a25',
  primary: '#00f7ff',
  secondary: '#00ff88',
  danger: '#ff4466',
  warning: '#ffaa00',
  text: '#ffffff',
  textDim: '#888899',
  textMuted: '#555566',
  buttonBg: '#1a1a25',
  buttonHover: '#252535',
  inputBg: '#0d0d14',
  border: '#333344',
};

export interface MenuState {
  screen: GameScreen;
  selectedRole: Role;
  selectedShard: Shard;
  partyCode: string;
  isLoading: boolean;
  error: string | null;
  party: Party | null;
  queueTime: number;
  isGuest: boolean;
  username: string;
}

interface ButtonDef {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  color?: string;
  textColor?: string;
  disabled?: boolean;
}

export class MenuRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private buttons: ButtonDef[] = [];
  private animTime: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
  }

  render(state: MenuState, deltaTime: number): ButtonDef[] {
    this.buttons = [];
    this.animTime += deltaTime;

    const dpr = window.devicePixelRatio || 1;
    const width = this.canvas.width / dpr;
    const height = this.canvas.height / dpr;

    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(dpr, dpr);

    // Background
    this.renderBackground(width, height);

    // Render current screen
    switch (state.screen) {
      case 'landing':
        this.renderLanding(width, height, state);
        break;
      case 'menu':
        this.renderMainMenu(width, height, state);
        break;
      case 'shard-select':
        this.renderShardSelect(width, height, state);
        break;
      case 'lobby':
        this.renderLobby(width, height, state);
        break;
      case 'queue':
        this.renderQueue(width, height, state);
        break;
    }

    // Loading overlay
    if (state.isLoading) {
      this.renderLoading(width, height);
    }

    // Error toast
    if (state.error) {
      this.renderError(width, height, state.error);
    }

    return this.buttons;
  }

  private renderBackground(width: number, height: number): void {
    // Solid background
    this.ctx.fillStyle = COLORS.background;
    this.ctx.fillRect(0, 0, width, height);

    // Animated grid
    this.ctx.strokeStyle = COLORS.grid;
    this.ctx.lineWidth = 1;
    const gridSize = 50;
    const offset = (this.animTime * 10) % gridSize;

    for (let x = -offset; x < width + gridSize; x += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, height);
      this.ctx.stroke();
    }
    for (let y = -offset; y < height + gridSize; y += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(width, y);
      this.ctx.stroke();
    }

    // Gradient overlay
    const gradient = this.ctx.createRadialGradient(
      width / 2, height / 2, 0,
      width / 2, height / 2, Math.max(width, height) / 2
    );
    gradient.addColorStop(0, 'rgba(0, 247, 255, 0.03)');
    gradient.addColorStop(1, 'transparent');
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, width, height);
  }

  private renderLanding(width: number, height: number, state: MenuState): void {
    // Title
    this.ctx.fillStyle = COLORS.primary;
    this.ctx.font = 'bold 56px "Segoe UI", system-ui, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('RIFTLINE', width / 2, height * 0.2);

    // Subtitle
    this.ctx.fillStyle = COLORS.textDim;
    this.ctx.font = '18px "Segoe UI", system-ui, sans-serif';
    this.ctx.fillText('Squad Battle Royale', width / 2, height * 0.2 + 50);

    // Sign in options
    const buttonWidth = 280;
    const buttonHeight = 50;
    const centerX = width / 2 - buttonWidth / 2;

    // Continue as Guest button
    this.addButton({
      id: 'guest',
      x: centerX,
      y: height * 0.45,
      width: buttonWidth,
      height: buttonHeight,
      text: 'PLAY AS GUEST',
      color: COLORS.secondary,
    });

    // Divider
    this.ctx.fillStyle = COLORS.textMuted;
    this.ctx.font = '12px "Segoe UI", system-ui, sans-serif';
    this.ctx.fillText('— or sign in for full features —', width / 2, height * 0.55);

    // Sign in with email (placeholder - would integrate with Supabase Auth UI)
    this.addButton({
      id: 'signin',
      x: centerX,
      y: height * 0.62,
      width: buttonWidth,
      height: buttonHeight,
      text: 'SIGN IN',
      color: COLORS.buttonBg,
    });

    // Features list
    this.ctx.fillStyle = COLORS.textDim;
    this.ctx.font = '11px "Segoe UI", system-ui, sans-serif';
    this.ctx.textAlign = 'center';
    const features = ['• Save progress', '• Add friends', '• Join parties', '• Ranked matches'];
    features.forEach((feature, i) => {
      this.ctx.fillText(feature, width / 2, height * 0.75 + i * 18);
    });

    // Version
    this.ctx.fillStyle = COLORS.textMuted;
    this.ctx.font = '10px "Segoe UI", system-ui, sans-serif';
    this.ctx.fillText('v0.1.0 Alpha', width / 2, height - 20);
  }

  private renderMainMenu(width: number, height: number, state: MenuState): void {
    // Header with user info
    this.ctx.fillStyle = COLORS.text;
    this.ctx.font = 'bold 24px "Segoe UI", system-ui, sans-serif';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(`Welcome, ${state.username || 'Player'}`, 30, 40);

    if (state.isGuest) {
      this.ctx.fillStyle = COLORS.warning;
      this.ctx.font = '12px "Segoe UI", system-ui, sans-serif';
      this.ctx.fillText('Guest Mode', 30, 60);
    }

    // Title
    this.ctx.fillStyle = COLORS.primary;
    this.ctx.font = 'bold 42px "Segoe UI", system-ui, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('RIFTLINE', width / 2, height * 0.15);

    // Main buttons
    const buttonWidth = 300;
    const buttonHeight = 60;
    const centerX = width / 2 - buttonWidth / 2;

    // Play button
    this.addButton({
      id: 'play',
      x: centerX,
      y: height * 0.35,
      width: buttonWidth,
      height: buttonHeight,
      text: 'PLAY',
      color: COLORS.secondary,
    });

    // Join Party button
    this.addButton({
      id: 'join-party',
      x: centerX,
      y: height * 0.35 + buttonHeight + 15,
      width: buttonWidth,
      height: buttonHeight,
      text: 'JOIN PARTY',
      color: COLORS.buttonBg,
    });

    // Practice/Training button
    this.addButton({
      id: 'practice',
      x: centerX,
      y: height * 0.35 + (buttonHeight + 15) * 2,
      width: buttonWidth,
      height: buttonHeight,
      text: 'PRACTICE',
      color: COLORS.buttonBg,
    });

    // Settings button (smaller, bottom)
    this.addButton({
      id: 'settings',
      x: width - 120,
      y: height - 50,
      width: 100,
      height: 35,
      text: 'SETTINGS',
      color: COLORS.buttonBg,
    });
  }

  private renderShardSelect(width: number, height: number, state: MenuState): void {
    // Back button
    this.addButton({
      id: 'back',
      x: 20,
      y: 20,
      width: 80,
      height: 35,
      text: '← BACK',
      color: COLORS.buttonBg,
    });

    // Title
    this.ctx.fillStyle = COLORS.text;
    this.ctx.font = 'bold 28px "Segoe UI", system-ui, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('SELECT SERVER', width / 2, height * 0.12);

    // Shard buttons in a grid
    const cols = 2;
    const buttonWidth = 200;
    const buttonHeight = 70;
    const gap = 20;
    const startX = width / 2 - (cols * buttonWidth + (cols - 1) * gap) / 2;
    const startY = height * 0.25;

    SHARDS.forEach((shard, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (buttonWidth + gap);
      const y = startY + row * (buttonHeight + gap);
      const isSelected = state.selectedShard === shard.id;

      this.addButton({
        id: `shard-${shard.id}`,
        x,
        y,
        width: buttonWidth,
        height: buttonHeight,
        text: shard.name,
        color: isSelected ? COLORS.primary : COLORS.buttonBg,
        textColor: isSelected ? COLORS.background : COLORS.text,
      });

      // Ping indicator (simulated)
      if (isSelected) {
        this.ctx.fillStyle = COLORS.secondary;
        this.ctx.font = '10px "Segoe UI", system-ui, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('~45ms', x + buttonWidth / 2, y + buttonHeight - 8);
      }
    });

    // Continue button
    this.addButton({
      id: 'continue-shard',
      x: width / 2 - 150,
      y: height * 0.85,
      width: 300,
      height: 55,
      text: 'CONTINUE',
      color: COLORS.secondary,
    });
  }

  private renderLobby(width: number, height: number, state: MenuState): void {
    // Back button
    this.addButton({
      id: 'back',
      x: 20,
      y: 20,
      width: 80,
      height: 35,
      text: '← BACK',
      color: COLORS.buttonBg,
    });

    // Party code display
    if (state.party?.code) {
      this.ctx.fillStyle = COLORS.textDim;
      this.ctx.font = '12px "Segoe UI", system-ui, sans-serif';
      this.ctx.textAlign = 'right';
      this.ctx.fillText('PARTY CODE', width - 30, 25);

      this.ctx.fillStyle = COLORS.primary;
      this.ctx.font = 'bold 24px "Courier New", monospace';
      this.ctx.fillText(state.party.code, width - 30, 50);
    }

    // Title
    this.ctx.fillStyle = COLORS.text;
    this.ctx.font = 'bold 28px "Segoe UI", system-ui, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('SQUAD LOBBY', width / 2, height * 0.1);

    // Shard indicator
    const shardName = SHARDS.find(s => s.id === state.selectedShard)?.name || state.selectedShard;
    this.ctx.fillStyle = COLORS.textDim;
    this.ctx.font = '14px "Segoe UI", system-ui, sans-serif';
    this.ctx.fillText(shardName, width / 2, height * 0.1 + 25);

    // Party member slots
    const slotWidth = 180;
    const slotHeight = 200;
    const slotGap = 20;
    const slotsStartX = width / 2 - (3 * slotWidth + 2 * slotGap) / 2;
    const slotsY = height * 0.25;

    for (let i = 0; i < 3; i++) {
      const x = slotsStartX + i * (slotWidth + slotGap);
      const member = state.party?.members?.[i];

      this.renderPartySlot(x, slotsY, slotWidth, slotHeight, member, i === 0);
    }

    // Role selection
    this.ctx.fillStyle = COLORS.text;
    this.ctx.font = 'bold 16px "Segoe UI", system-ui, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('SELECT ROLE', width / 2, height * 0.65);

    const roles: Role[] = ['vanguard', 'skirmisher', 'sentinel', 'catalyst'];
    const roleButtonWidth = 140;
    const roleButtonHeight = 50;
    const roleGap = 15;
    const rolesStartX = width / 2 - (roles.length * roleButtonWidth + (roles.length - 1) * roleGap) / 2;

    roles.forEach((role, i) => {
      const x = rolesStartX + i * (roleButtonWidth + roleGap);
      const isSelected = state.selectedRole === role;

      this.addButton({
        id: `role-${role}`,
        x,
        y: height * 0.7,
        width: roleButtonWidth,
        height: roleButtonHeight,
        text: role.toUpperCase(),
        color: isSelected ? COLORS.primary : COLORS.buttonBg,
        textColor: isSelected ? COLORS.background : COLORS.text,
      });
    });

    // Ready/Find Match button
    const allReady = state.party?.members?.every(m => m.is_ready) ?? false;
    this.addButton({
      id: 'find-match',
      x: width / 2 - 150,
      y: height * 0.88,
      width: 300,
      height: 55,
      text: allReady ? 'FIND MATCH' : 'READY UP',
      color: COLORS.secondary,
    });

    // Invite friend button
    this.addButton({
      id: 'invite',
      x: width / 2 + 170,
      y: height * 0.88,
      width: 100,
      height: 55,
      text: 'INVITE',
      color: COLORS.buttonBg,
    });
  }

  private renderPartySlot(x: number, y: number, w: number, h: number, member?: PartyMember, isLeader?: boolean): void {
    // Slot background
    this.ctx.fillStyle = member ? COLORS.backgroundAlt : COLORS.buttonBg;
    this.ctx.fillRect(x, y, w, h);

    // Border
    this.ctx.strokeStyle = member?.is_ready ? COLORS.secondary : COLORS.border;
    this.ctx.lineWidth = member?.is_ready ? 3 : 1;
    this.ctx.strokeRect(x, y, w, h);

    if (member) {
      // Player avatar placeholder
      this.ctx.fillStyle = COLORS.primary;
      this.ctx.beginPath();
      this.ctx.arc(x + w / 2, y + 50, 30, 0, Math.PI * 2);
      this.ctx.fill();

      // Player name
      this.ctx.fillStyle = COLORS.text;
      this.ctx.font = 'bold 14px "Segoe UI", system-ui, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(member.profile?.display_name || 'Player', x + w / 2, y + 100);

      // Role
      this.ctx.fillStyle = COLORS.textDim;
      this.ctx.font = '12px "Segoe UI", system-ui, sans-serif';
      this.ctx.fillText(member.role.toUpperCase(), x + w / 2, y + 120);

      // Ready status
      if (member.is_ready) {
        this.ctx.fillStyle = COLORS.secondary;
        this.ctx.font = 'bold 14px "Segoe UI", system-ui, sans-serif';
        this.ctx.fillText('READY', x + w / 2, y + h - 20);
      }

      // Leader badge
      if (isLeader) {
        this.ctx.fillStyle = COLORS.warning;
        this.ctx.font = '10px "Segoe UI", system-ui, sans-serif';
        this.ctx.fillText('★ LEADER', x + w / 2, y + 15);
      }
    } else {
      // Empty slot
      this.ctx.fillStyle = COLORS.textMuted;
      this.ctx.font = '14px "Segoe UI", system-ui, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('EMPTY', x + w / 2, y + h / 2 - 10);
      this.ctx.font = '11px "Segoe UI", system-ui, sans-serif';
      this.ctx.fillText('Invite a friend', x + w / 2, y + h / 2 + 10);
    }
  }

  private renderQueue(width: number, height: number, state: MenuState): void {
    // Cancel button
    this.addButton({
      id: 'cancel-queue',
      x: 20,
      y: 20,
      width: 100,
      height: 35,
      text: 'CANCEL',
      color: COLORS.danger,
    });

    // Searching animation
    const pulseScale = 1 + Math.sin(this.animTime * 3) * 0.1;
    this.ctx.save();
    this.ctx.translate(width / 2, height * 0.35);
    this.ctx.scale(pulseScale, pulseScale);

    // Ring
    this.ctx.strokeStyle = COLORS.primary;
    this.ctx.lineWidth = 4;
    this.ctx.beginPath();
    this.ctx.arc(0, 0, 60, 0, Math.PI * 2);
    this.ctx.stroke();

    // Rotating segment
    this.ctx.strokeStyle = COLORS.secondary;
    this.ctx.lineWidth = 6;
    this.ctx.beginPath();
    this.ctx.arc(0, 0, 60, this.animTime * 2, this.animTime * 2 + Math.PI / 2);
    this.ctx.stroke();

    this.ctx.restore();

    // Status text
    this.ctx.fillStyle = COLORS.text;
    this.ctx.font = 'bold 24px "Segoe UI", system-ui, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('SEARCHING FOR MATCH', width / 2, height * 0.55);

    // Queue time
    const minutes = Math.floor(state.queueTime / 60);
    const seconds = Math.floor(state.queueTime % 60);
    this.ctx.fillStyle = COLORS.textDim;
    this.ctx.font = '18px "Segoe UI", system-ui, sans-serif';
    this.ctx.fillText(
      `${minutes}:${seconds.toString().padStart(2, '0')}`,
      width / 2,
      height * 0.62
    );

    // Estimated wait
    this.ctx.fillStyle = COLORS.textMuted;
    this.ctx.font = '14px "Segoe UI", system-ui, sans-serif';
    this.ctx.fillText('Estimated wait: ~1-2 minutes', width / 2, height * 0.68);

    // Party info
    if (state.party) {
      this.ctx.fillStyle = COLORS.textDim;
      this.ctx.font = '12px "Segoe UI", system-ui, sans-serif';
      const memberCount = state.party.members?.length || 1;
      this.ctx.fillText(`Party of ${memberCount} | ${SHARDS.find(s => s.id === state.selectedShard)?.name}`, width / 2, height * 0.78);
    }

    // Tips
    this.ctx.fillStyle = COLORS.textMuted;
    this.ctx.font = '11px "Segoe UI", system-ui, sans-serif';
    const tips = [
      'Tip: Orbs reduce your respawn time',
      'Tip: Deliver relics to score points',
      'Tip: Stay inside the riftline ring',
    ];
    const tipIndex = Math.floor(this.animTime / 5) % tips.length;
    this.ctx.fillText(tips[tipIndex], width / 2, height * 0.9);
  }

  private renderLoading(width: number, height: number): void {
    // Overlay
    this.ctx.fillStyle = 'rgba(10, 10, 15, 0.8)';
    this.ctx.fillRect(0, 0, width, height);

    // Spinner
    this.ctx.strokeStyle = COLORS.primary;
    this.ctx.lineWidth = 4;
    this.ctx.beginPath();
    this.ctx.arc(width / 2, height / 2, 30, this.animTime * 4, this.animTime * 4 + Math.PI * 1.5);
    this.ctx.stroke();

    this.ctx.fillStyle = COLORS.text;
    this.ctx.font = '16px "Segoe UI", system-ui, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('Loading...', width / 2, height / 2 + 60);
  }

  private renderError(width: number, height: number, error: string): void {
    const toastWidth = 300;
    const toastHeight = 50;
    const toastX = width / 2 - toastWidth / 2;
    const toastY = height - 80;

    this.ctx.fillStyle = COLORS.danger;
    this.ctx.fillRect(toastX, toastY, toastWidth, toastHeight);

    this.ctx.fillStyle = COLORS.text;
    this.ctx.font = '14px "Segoe UI", system-ui, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(error, width / 2, toastY + toastHeight / 2);
  }

  private addButton(button: ButtonDef): void {
    this.buttons.push(button);

    // Render button
    this.ctx.fillStyle = button.color || COLORS.buttonBg;
    this.ctx.fillRect(button.x, button.y, button.width, button.height);

    // Border
    this.ctx.strokeStyle = COLORS.border;
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(button.x, button.y, button.width, button.height);

    // Text
    this.ctx.fillStyle = button.textColor || COLORS.text;
    this.ctx.font = 'bold 14px "Segoe UI", system-ui, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(button.text, button.x + button.width / 2, button.y + button.height / 2);
  }

  // Check if point is inside any button
  hitTest(x: number, y: number): string | null {
    for (const button of this.buttons) {
      if (
        x >= button.x &&
        x <= button.x + button.width &&
        y >= button.y &&
        y <= button.y + button.height &&
        !button.disabled
      ) {
        return button.id;
      }
    }
    return null;
  }
}
