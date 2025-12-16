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

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.inputState = {
      moveDirection: vec2(),
      aimDirection: vec2(1, 0),
      isFiring: false,
      isReloading: false,
      interact: false,
      confirm: false,
      zoom: 1,
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

    // Any touch is a generic "confirm" tap (consumed in lobby/game-over).
    this.inputState.confirm = true;

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

      // Left side = movement joystick
      if (x < centerX && this.touchState.moveTouchId === null) {
        this.touchState.moveTouchId = touch.identifier;
        this.touchState.moveStart = { x, y };
      }
      // Right side = aim joystick / fire
      else if (x >= centerX && this.touchState.aimTouchId === null) {
        this.touchState.aimTouchId = touch.identifier;
        this.touchState.aimStart = { x, y };
        this.inputState.isFiring = true;
      }
    }
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

    // Reset pinch tracking when fewer than two touches remain
    if (e.touches.length < 2) {
      this.pinchStartDist = null;
    }

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];

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

    // Reset pinch baseline when fewer than 2 touches remain.
    if (e.touches.length < 2) {
      this.pinchStartDist = null;
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

  consumeReload(): boolean {
    if (this.inputState.isReloading) {
      this.inputState.isReloading = false;
      return true;
    }
    return false;
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown.bind(this));
    window.removeEventListener('keyup', this.onKeyUp.bind(this));
  }
}
