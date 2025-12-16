import type { Vector2, InputState } from '../types';
import { vec2, vec2Normalize, vec2Sub, vec2Length } from '../utils/math';

interface TouchState {
  id: number;
  startPos: Vector2;
  currentPos: Vector2;
  startTime: number;
}

export class InputManager {
  private canvas: HTMLCanvasElement;
  private inputState: InputState = {
    moveDirection: vec2(),
    aimDirection: vec2(),
    firing: false,
    interacting: false,
    healing: false,
    reloading: false,
  };

  // Touch tracking
  private touches: Map<number, TouchState> = new Map();
  private moveTouch: number | null = null;
  private aimTouch: number | null = null;

  // Virtual joystick config
  private moveStickCenter: Vector2 | null = null;
  private aimStickCenter: Vector2 | null = null;
  private stickRadius: number = 60;
  private stickDeadzone: number = 10;

  // Gesture tracking
  private lastPinchDistance: number = 0;
  private onZoomCallback: ((delta: number) => void) | null = null;
  private onPingCallback: ((position: Vector2) => void) | null = null;

  // Screen regions (percentages)
  private moveRegionWidth: number = 0.4; // Left 40% for movement

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Touch events
    this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
    this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
    this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
    this.canvas.addEventListener('touchcancel', this.handleTouchEnd.bind(this), { passive: false });

    // Keyboard fallback for development
    window.addEventListener('keydown', this.handleKeyDown.bind(this));
    window.addEventListener('keyup', this.handleKeyUp.bind(this));

    // Mouse fallback for development
    this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
    this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
    this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
  }

  private handleTouchStart(e: TouchEvent): void {
    e.preventDefault();

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const pos = this.getTouchPosition(touch);
      const touchState: TouchState = {
        id: touch.identifier,
        startPos: pos,
        currentPos: pos,
        startTime: performance.now(),
      };

      this.touches.set(touch.identifier, touchState);

      // Determine if this is a move or aim touch
      const dpr = window.devicePixelRatio || 1;
      const logicalWidth = this.canvas.width / dpr;
      if (pos.x < logicalWidth * this.moveRegionWidth) {
        if (this.moveTouch === null) {
          this.moveTouch = touch.identifier;
          this.moveStickCenter = pos;
        }
      } else {
        if (this.aimTouch === null) {
          this.aimTouch = touch.identifier;
          this.aimStickCenter = pos;
          this.inputState.firing = true;
        }
      }
    }

    // Check for two-finger tap (ping)
    if (this.touches.size === 2) {
      this.checkForPing();
    }

    // Update pinch distance for zoom
    this.updatePinchDistance();
  }

  private handleTouchMove(e: TouchEvent): void {
    e.preventDefault();

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const touchState = this.touches.get(touch.identifier);
      if (touchState) {
        touchState.currentPos = this.getTouchPosition(touch);
      }
    }

    // Update virtual joysticks
    this.updateMoveStick();
    this.updateAimStick();

    // Check for pinch zoom
    if (this.touches.size === 2) {
      this.checkForPinchZoom();
    }
  }

  private handleTouchEnd(e: TouchEvent): void {
    e.preventDefault();

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const touchState = this.touches.get(touch.identifier);

      if (touchState) {
        // Check for double tap to reset zoom
        const elapsed = performance.now() - touchState.startTime;
        if (elapsed < 200 && vec2Length(vec2Sub(touchState.currentPos, touchState.startPos)) < 20) {
          // This could be a tap - handle double tap detection here if needed
        }
      }

      // Clean up touch tracking
      if (touch.identifier === this.moveTouch) {
        this.moveTouch = null;
        this.moveStickCenter = null;
        this.inputState.moveDirection = vec2();
      }
      if (touch.identifier === this.aimTouch) {
        this.aimTouch = null;
        this.aimStickCenter = null;
        this.inputState.firing = false;
      }

      this.touches.delete(touch.identifier);
    }

    this.lastPinchDistance = 0;
  }

  private getTouchPosition(touch: Touch): Vector2 {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    // Use logical CSS dimensions, not raw canvas dimensions
    const logicalWidth = this.canvas.width / dpr;
    const logicalHeight = this.canvas.height / dpr;
    return {
      x: (touch.clientX - rect.left) * (logicalWidth / rect.width),
      y: (touch.clientY - rect.top) * (logicalHeight / rect.height),
    };
  }

  private updateMoveStick(): void {
    if (this.moveTouch === null || this.moveStickCenter === null) return;

    const touchState = this.touches.get(this.moveTouch);
    if (!touchState) return;

    const delta = vec2Sub(touchState.currentPos, this.moveStickCenter);
    const distance = vec2Length(delta);

    if (distance < this.stickDeadzone) {
      this.inputState.moveDirection = vec2();
    } else {
      const clampedDistance = Math.min(distance, this.stickRadius);
      const normalized = vec2Normalize(delta);
      const magnitude = (clampedDistance - this.stickDeadzone) / (this.stickRadius - this.stickDeadzone);
      this.inputState.moveDirection = {
        x: normalized.x * magnitude,
        y: normalized.y * magnitude,
      };
    }
  }

  private updateAimStick(): void {
    if (this.aimTouch === null || this.aimStickCenter === null) return;

    const touchState = this.touches.get(this.aimTouch);
    if (!touchState) return;

    const delta = vec2Sub(touchState.currentPos, this.aimStickCenter);
    const distance = vec2Length(delta);

    if (distance < this.stickDeadzone) {
      // Keep last aim direction when in deadzone
    } else {
      this.inputState.aimDirection = vec2Normalize(delta);
    }
  }

  private updatePinchDistance(): void {
    if (this.touches.size !== 2) {
      this.lastPinchDistance = 0;
      return;
    }

    const touchArray = Array.from(this.touches.values());
    this.lastPinchDistance = vec2Length(
      vec2Sub(touchArray[0].currentPos, touchArray[1].currentPos)
    );
  }

  private checkForPinchZoom(): void {
    if (this.touches.size !== 2 || !this.onZoomCallback) return;

    const touchArray = Array.from(this.touches.values());
    const currentDistance = vec2Length(
      vec2Sub(touchArray[0].currentPos, touchArray[1].currentPos)
    );

    if (this.lastPinchDistance > 0) {
      const delta = (currentDistance - this.lastPinchDistance) * 0.005;
      this.onZoomCallback(delta);
    }

    this.lastPinchDistance = currentDistance;
  }

  private checkForPing(): void {
    if (this.touches.size !== 2 || !this.onPingCallback) return;

    const touchArray = Array.from(this.touches.values());
    const timeDiff = Math.abs(touchArray[0].startTime - touchArray[1].startTime);

    // Both fingers touched within 100ms
    if (timeDiff < 100) {
      const midpoint: Vector2 = {
        x: (touchArray[0].startPos.x + touchArray[1].startPos.x) / 2,
        y: (touchArray[0].startPos.y + touchArray[1].startPos.y) / 2,
      };
      this.onPingCallback(midpoint);
    }
  }

  // Keyboard handlers for development
  private keysDown: Set<string> = new Set();

  private handleKeyDown(e: KeyboardEvent): void {
    this.keysDown.add(e.code);
    this.updateKeyboardInput();

    if (e.code === 'KeyE') this.inputState.interacting = true;
    if (e.code === 'KeyH') this.inputState.healing = true;
    if (e.code === 'KeyR') this.inputState.reloading = true;
  }

  private handleKeyUp(e: KeyboardEvent): void {
    this.keysDown.delete(e.code);
    this.updateKeyboardInput();

    if (e.code === 'KeyE') this.inputState.interacting = false;
    if (e.code === 'KeyH') this.inputState.healing = false;
    if (e.code === 'KeyR') this.inputState.reloading = false;
  }

  private updateKeyboardInput(): void {
    const move = vec2();
    if (this.keysDown.has('KeyW') || this.keysDown.has('ArrowUp')) move.y -= 1;
    if (this.keysDown.has('KeyS') || this.keysDown.has('ArrowDown')) move.y += 1;
    if (this.keysDown.has('KeyA') || this.keysDown.has('ArrowLeft')) move.x -= 1;
    if (this.keysDown.has('KeyD') || this.keysDown.has('ArrowRight')) move.x += 1;
    this.inputState.moveDirection = vec2Normalize(move);
  }

  // Mouse handlers for development
  private mouseDown: boolean = false;
  private mousePosition: Vector2 = vec2();

  private handleMouseDown(e: MouseEvent): void {
    this.mouseDown = true;
    this.inputState.firing = true;
    this.updateMouseAim(e);
  }

  private handleMouseMove(e: MouseEvent): void {
    this.updateMouseAim(e);
  }

  private handleMouseUp(): void {
    this.mouseDown = false;
    this.inputState.firing = false;
  }

  private updateMouseAim(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    this.mousePosition = {
      x: (e.clientX - rect.left) * (this.canvas.width / rect.width),
      y: (e.clientY - rect.top) * (this.canvas.height / rect.height),
    };
  }

  // Public API
  getInput(): InputState {
    return { ...this.inputState };
  }

  getMousePosition(): Vector2 {
    return { ...this.mousePosition };
  }

  getMoveStickCenter(): Vector2 | null {
    return this.moveStickCenter ? { ...this.moveStickCenter } : null;
  }

  getAimStickCenter(): Vector2 | null {
    return this.aimStickCenter ? { ...this.aimStickCenter } : null;
  }

  getMoveStickRadius(): number {
    return this.stickRadius;
  }

  onZoom(callback: (delta: number) => void): void {
    this.onZoomCallback = callback;
  }

  onPing(callback: (position: Vector2) => void): void {
    this.onPingCallback = callback;
  }

  setInteracting(value: boolean): void {
    this.inputState.interacting = value;
  }

  setHealing(value: boolean): void {
    this.inputState.healing = value;
  }

  destroy(): void {
    // Remove all event listeners
    this.canvas.removeEventListener('touchstart', this.handleTouchStart.bind(this));
    this.canvas.removeEventListener('touchmove', this.handleTouchMove.bind(this));
    this.canvas.removeEventListener('touchend', this.handleTouchEnd.bind(this));
    this.canvas.removeEventListener('touchcancel', this.handleTouchEnd.bind(this));
  }
}
