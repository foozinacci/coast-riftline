// Input handling system - mobile-first with keyboard/mouse support

import { Vector2, InputState, TouchState } from './types';
import { vec2, normalizeVec2, subVec2 } from './utils';

export class InputManager {
  private canvas: HTMLCanvasElement;
  private inputState: InputState;
  private touchState: TouchState;
  private keys: Set<string>;
  private mousePosition: Vector2;
  private mouseDown: boolean;
  private isMobile: boolean;

  // Pinch-zoom tracking (mobile)
  private pinchStartDist: number | null = null;
  private pinchStartZoom: number = 1;

  // Touch joystick settings
  private readonly joystickRadius = 60;
  private readonly joystickDeadzone = 10;

  // Tap detection for menu navigation
  private tapStartTime: number = 0;
  private tapStartPos: Vector2 | null = null;
  private readonly TAP_MAX_DURATION = 300; // ms
  private readonly TAP_MAX_DISTANCE = 20; // pixels

  // Pause button zone
  private readonly pauseButtonRect = { x: 30, y: 30, size: 40 };

  // Gamepad state
  private prevGamepadButtons: boolean[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.inputState = {
      moveDirection: vec2(),
      aimDirection: vec2(1, 0),
      isFiring: false,
      isReloading: false,
      interact: false,
      confirm: false,
      back: false,
      zoom: 1,
      dash: false,
      tactical: false,
    };
    this.touchState = {
      moveTouchId: null,
      aimTouchId: null,
      moveStart: null,
      aimStart: null,
    };
    this.keys = new Set();
    this.mousePosition = vec2();
    this.mouseDown = false;
    this.isMobile = this.detectMobile();

    this.setupListeners();
  }

  private detectMobile(): boolean {
    return (
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      window.matchMedia('(pointer: coarse)').matches
    );
  }

  private setupListeners(): void {
    // Keyboard events
    window.addEventListener('keydown', this.onKeyDown.bind(this));
    window.addEventListener('keyup', this.onKeyUp.bind(this));

    // Mouse events
    this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
    this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Touch events
    this.canvas.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
    this.canvas.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
    this.canvas.addEventListener('touchend', this.onTouchEnd.bind(this), { passive: false });
    this.canvas.addEventListener('touchcancel', this.onTouchEnd.bind(this), { passive: false });

    // Wheel for zoom
    this.canvas.addEventListener('wheel', this.onWheel.bind(this), { passive: false });
  }

  private onKeyDown(e: KeyboardEvent): void {
    this.keys.add(e.code);

    if (e.code === 'KeyR') {
      this.inputState.isReloading = true;
    }
    if (e.code === 'KeyE' || e.code === 'KeyF') {
      this.inputState.interact = true;
    }
    if (e.code === 'Escape') {
      this.inputState.back = true;
    }
    // Confirm actions (Enter, Space)
    if (e.code === 'Enter' || e.code === 'Space') {
      this.inputState.confirm = true;
    }
    // Keyboard zoom (=/- or +/-, per spec A6)
    if (e.code === 'Equal' || e.code === 'NumpadAdd') {
      this.inputState.zoom = Math.min(2, this.inputState.zoom + 0.1);
    }
    if (e.code === 'Minus' || e.code === 'NumpadSubtract') {
      this.inputState.zoom = Math.max(0.5, this.inputState.zoom - 0.1);
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    this.keys.delete(e.code);

    if (e.code === 'KeyR') {
      this.inputState.isReloading = false;
    }
    if (e.code === 'KeyE' || e.code === 'KeyF') {
      this.inputState.interact = false;
    }
  }

  private onMouseMove(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    this.mousePosition = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  private onMouseDown(e: MouseEvent): void {
    if (e.button === 0) {
      // Check pause button (Top Left)
      if (this.isPointInButton(this.mousePosition.x, this.mousePosition.y, this.pauseButtonRect.x, this.pauseButtonRect.y, this.pauseButtonRect.size)) {
        this.inputState.back = true;
        return;
      }

      this.mouseDown = true;
      this.inputState.isFiring = true;
      this.inputState.confirm = true;
    }
  }

  private onMouseUp(e: MouseEvent): void {
    if (e.button === 0) {
      this.mouseDown = false;
      this.inputState.isFiring = false;
    }
  }

  private onWheel(e: WheelEvent): void {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    this.inputState.zoom = Math.max(0.5, Math.min(2, this.inputState.zoom + delta));
  }

  private onTouchStart(e: TouchEvent): void {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const centerX = rect.width / 2;

    // Track tap start for proper tap detection (only first touch)
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      this.tapStartTime = performance.now();
      this.tapStartPos = {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      };
    }

    // If two touches are active, initialize pinch baseline.
    if (e.touches.length >= 2) {
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      const x0 = t0.clientX - rect.left;
      const y0 = t0.clientY - rect.top;
      const x1 = t1.clientX - rect.left;
      const y1 = t1.clientY - rect.top;
      this.pinchStartDist = Math.hypot(x1 - x0, y1 - y0);
      this.pinchStartZoom = this.inputState.zoom;
    }

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;

      // Check for zoom button taps (per spec A6 - mobile zoom buttons)
      // Buttons are positioned at: right edge - 60px, vertically centered
      const zoomButtonSize = 40;
      const buttonX = rect.width - 60;
      const buttonCenterY = rect.height / 2;
      const zoomInY = buttonCenterY - zoomButtonSize - 10;
      const zoomOutY = buttonCenterY + 10;

      // Check zoom in button (+)
      if (this.isPointInButton(x, y, buttonX, zoomInY, zoomButtonSize)) {
        this.inputState.zoom = Math.min(2, this.inputState.zoom + 0.15);
        return; // Consume this touch for zoom
      }

      // Check zoom out button (-)
      if (this.isPointInButton(x, y, buttonX, zoomOutY, zoomButtonSize)) {
        this.inputState.zoom = Math.max(0.5, this.inputState.zoom - 0.15);
        return; // Consume this touch for zoom
      }

      // Check pause button (Top Left)
      if (this.isPointInButton(x, y, this.pauseButtonRect.x, this.pauseButtonRect.y, this.pauseButtonRect.size)) {
        this.inputState.back = true;
        return;
      }

      // Mobile ability buttons (right side)
      const buttonSize = 50;
      const margin = 20;
      const rightBaseX = rect.width - margin - buttonSize;
      const rightBaseY = rect.height - margin - buttonSize;
      const fireSize = 70;

      // Fire button (bottom right, large)
      const fireX = rightBaseX - fireSize / 2 + buttonSize / 2;
      const fireY = rightBaseY - fireSize / 2 + buttonSize / 2;
      if (this.isPointInButton(x, y, fireX, fireY, fireSize)) {
        this.inputState.isFiring = true;
        return;
      }

      // Dash button (above fire)
      const dashY = rightBaseY - fireSize - margin;
      if (this.isPointInButton(x, y, rightBaseX, dashY, buttonSize)) {
        this.inputState.dash = true;
        return;
      }

      // Tactical button (above dash)
      const tacticalY = dashY - buttonSize - margin;
      if (this.isPointInButton(x, y, rightBaseX, tacticalY, buttonSize)) {
        this.inputState.tactical = true;
        return;
      }

      // Reload button (left of fire)
      const reloadX = rightBaseX - fireSize - margin;
      if (this.isPointInButton(x, y, reloadX, fireY, buttonSize)) {
        this.inputState.isReloading = true;
        return;
      }

      // Left side = movement joystick (dynamic)
      if (x < centerX && this.touchState.moveTouchId === null) {
        this.touchState.moveTouchId = touch.identifier;
        this.touchState.moveStart = { x, y };
      }
      // Right side (non-button area) = aim
      else if (x >= centerX && this.touchState.aimTouchId === null) {
        this.touchState.aimTouchId = touch.identifier;
        this.touchState.aimStart = { x, y };
      }
    }
  }

  /**
   * Check if a point is inside a button area.
   */
  private isPointInButton(px: number, py: number, buttonCenterX: number, buttonCenterY: number, size: number): boolean {
    const halfSize = size / 2;
    return (
      px >= buttonCenterX - halfSize &&
      px <= buttonCenterX + halfSize &&
      py >= buttonCenterY - halfSize &&
      py <= buttonCenterY + halfSize
    );
  }

  private onTouchMove(e: TouchEvent): void {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();

    // Pinch zoom if 2 touches are down.
    if (e.touches.length >= 2 && this.pinchStartDist !== null) {
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      const x0 = t0.clientX - rect.left;
      const y0 = t0.clientY - rect.top;
      const x1 = t1.clientX - rect.left;
      const y1 = t1.clientY - rect.top;
      const dist = Math.hypot(x1 - x0, y1 - y0);
      const scale = dist / this.pinchStartDist;
      this.inputState.zoom = Math.max(0.5, Math.min(2, this.pinchStartZoom * scale));
    }

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;

      if (touch.identifier === this.touchState.moveTouchId && this.touchState.moveStart) {
        const delta = subVec2({ x, y }, this.touchState.moveStart);
        const distance = Math.sqrt(delta.x * delta.x + delta.y * delta.y);

        if (distance > this.joystickDeadzone) {
          const normalized = normalizeVec2(delta);
          const magnitude = Math.min(distance / this.joystickRadius, 1);
          this.inputState.moveDirection = {
            x: normalized.x * magnitude,
            y: normalized.y * magnitude,
          };
        } else {
          this.inputState.moveDirection = vec2();
        }
      }

      if (touch.identifier === this.touchState.aimTouchId && this.touchState.aimStart) {
        const delta = subVec2({ x, y }, this.touchState.aimStart);
        const distance = Math.sqrt(delta.x * delta.x + delta.y * delta.y);

        if (distance > this.joystickDeadzone) {
          this.inputState.aimDirection = normalizeVec2(delta);
        }
      }
    }
  }

  private onTouchEnd(e: TouchEvent): void {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();

    // Reset pinch tracking when fewer than two touches remain
    if (e.touches.length < 2) {
      this.pinchStartDist = null;
    }

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;

      // Detect tap (quick touch without much movement) for menu confirm
      if (this.tapStartPos && e.touches.length === 0) {
        const tapDuration = performance.now() - this.tapStartTime;
        const tapDistance = Math.hypot(x - this.tapStartPos.x, y - this.tapStartPos.y);

        if (tapDuration < this.TAP_MAX_DURATION && tapDistance < this.TAP_MAX_DISTANCE) {
          // Update mouse position to tap location so menu buttons get focused
          this.mousePosition = { x, y };
          this.inputState.confirm = true;
        }
        this.tapStartPos = null;
      }

      if (touch.identifier === this.touchState.moveTouchId) {
        this.touchState.moveTouchId = null;
        this.touchState.moveStart = null;
        this.inputState.moveDirection = vec2();
      }

      if (touch.identifier === this.touchState.aimTouchId) {
        this.touchState.aimTouchId = null;
        this.touchState.aimStart = null;
        this.inputState.isFiring = false;
      }
    }
  }

  update(playerScreenPos: Vector2): void {
    // Update keyboard movement (WASD)
    if (!this.isMobile || this.touchState.moveTouchId === null) {
      const move = vec2();
      if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) move.y -= 1;
      if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) move.y += 1;
      if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) move.x -= 1;
      if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) move.x += 1;

      if (move.x !== 0 || move.y !== 0) {
        this.inputState.moveDirection = normalizeVec2(move);
      } else if (!this.isMobile) {
        this.inputState.moveDirection = vec2();
      }
    }

    // Update aim direction from mouse (desktop)
    if (!this.isMobile && playerScreenPos) {
      const delta = subVec2(this.mousePosition, playerScreenPos);
      if (delta.x !== 0 || delta.y !== 0) {
        this.inputState.aimDirection = normalizeVec2(delta);
      }
    }

    // Update dash (Shift key)
    this.inputState.dash = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');

    // Update tactical (Q key)
    this.inputState.tactical = this.keys.has('KeyQ');

    // Gamepad input
    this.updateGamepad();
  }

  private updateGamepad(): void {
    const gamepads = navigator.getGamepads();
    const gp = gamepads[0]; // Use first gamepad
    if (!gp) return;

    // Movement (Left Stick)
    const moveX = gp.axes[0];
    const moveY = gp.axes[1];
    const DEADZONE = 0.2;

    if (Math.abs(moveX) > DEADZONE || Math.abs(moveY) > DEADZONE) {
      this.inputState.moveDirection = normalizeVec2({ x: moveX, y: moveY });
    }

    // Aiming (Right Stick)
    const aimX = gp.axes[2];
    const aimY = gp.axes[3];
    if (Math.abs(aimX) > DEADZONE || Math.abs(aimY) > DEADZONE) {
      this.inputState.aimDirection = normalizeVec2({ x: aimX, y: aimY });
    }

    // Buttons (using simplified mapping for standard Xbox controller)
    // 0: A (Confirm), 1: B (Back), 2: X (Interact), 3: Y (Reload)
    // 7: RT (Fire), 9: Start (Pause)

    // Helper to check press (once) vs hold
    const isPressed = (idx: number) => gp.buttons[idx] && gp.buttons[idx].pressed;
    const justPressed = (idx: number) => isPressed(idx) && !this.prevGamepadButtons[idx];

    if (justPressed(0)) this.inputState.confirm = true; // A
    if (justPressed(1)) this.inputState.back = true;    // B
    if (justPressed(2)) this.inputState.interact = true; // X
    if (justPressed(3)) this.inputState.isReloading = true; // Y
    if (justPressed(9)) this.inputState.back = true;    // Start

    // Continuous states (Fire)
    if (isPressed(7)) {
      this.inputState.isFiring = true;
    } else if (!this.mouseDown && !this.touchState.aimTouchId) {
      // Only clear if mouse/touch aren't firing
      this.inputState.isFiring = false;
    }

    // Update previous state
    for (let i = 0; i < gp.buttons.length; i++) {
      this.prevGamepadButtons[i] = gp.buttons[i].pressed;
    }
  }

  getState(): InputState {
    return { ...this.inputState };
  }

  getMousePosition(): Vector2 {
    return { ...this.mousePosition };
  }

  getTouchState(): TouchState {
    return { ...this.touchState };
  }

  isMobileDevice(): boolean {
    return this.isMobile;
  }

  consumeInteract(): boolean {
    if (this.inputState.interact) {
      this.inputState.interact = false;
      return true;
    }
    return false;
  }

  consumeConfirm(): boolean {
    if (this.inputState.confirm) {
      this.inputState.confirm = false;
      return true;
    }
    return false;
  }

  consumeBack(): boolean {
    if (this.inputState.back) {
      this.inputState.back = false;
      return true;
    }
    return false;
  }

  consumeReload(): boolean {
    if (this.inputState.isReloading) {
      this.inputState.isReloading = false;
      return true;
    }
    return false;
  }

  consumeDash(): boolean {
    if (this.inputState.dash) {
      this.inputState.dash = false;
      return true;
    }
    return false;
  }

  consumeTactical(): boolean {
    if (this.inputState.tactical) {
      this.inputState.tactical = false;
      return true;
    }
    return false;
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown.bind(this));
    window.removeEventListener('keyup', this.onKeyUp.bind(this));
  }
}
