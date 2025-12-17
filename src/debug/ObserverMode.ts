// Observer Mode - Watch matches without playing

import { Vector2 } from '../core/types';
import { InputManager } from '../core/input';
import { Renderer } from '../core/renderer';
import { Player } from '../entities/Player';

export enum ObserverMode {
    DISABLED = 'disabled',
    FREE_CAM = 'free_cam',
    FOLLOW_PLAYER = 'follow_player',
    AUTO_ROTATE = 'auto_rotate',
}

export interface ObserverState {
    mode: ObserverMode;
    cameraPosition: Vector2;
    cameraZoom: number;
    followTargetId: string | null;
    autoRotateSpeed: number;
    autoRotateTimer: number;
    playerIndex: number; // For cycling through players
}

export class ObserverController {
    private state: ObserverState;
    private players: Player[] = [];
    private moveSpeed: number = 500; // Pixels per second
    private zoomSpeed: number = 0.5;

    constructor() {
        this.state = {
            mode: ObserverMode.DISABLED,
            cameraPosition: { x: 0, y: 0 },
            cameraZoom: 1.0,
            followTargetId: null,
            autoRotateSpeed: 5000, // ms per player
            autoRotateTimer: 0,
            playerIndex: 0,
        };
    }

    isActive(): boolean {
        return this.state.mode !== ObserverMode.DISABLED;
    }

    getMode(): ObserverMode {
        return this.state.mode;
    }

    enable(initialPosition: Vector2, players: Player[]): void {
        this.state.mode = ObserverMode.FREE_CAM;
        this.state.cameraPosition = { ...initialPosition };
        this.players = players;
        this.state.playerIndex = 0;
        console.log('Observer mode: ENABLED');
    }

    disable(): void {
        this.state.mode = ObserverMode.DISABLED;
        console.log('Observer mode: DISABLED');
    }

    toggle(initialPosition: Vector2, players: Player[]): void {
        if (this.isActive()) {
            this.disable();
        } else {
            this.enable(initialPosition, players);
        }
    }

    cycleMode(): void {
        const modes = [
            ObserverMode.FREE_CAM,
            ObserverMode.FOLLOW_PLAYER,
            ObserverMode.AUTO_ROTATE,
        ];

        const currentIdx = modes.indexOf(this.state.mode);
        const nextIdx = (currentIdx + 1) % modes.length;
        this.state.mode = modes[nextIdx];

        if (this.state.mode === ObserverMode.FOLLOW_PLAYER) {
            this.followNextPlayer();
        }

        console.log(`Observer mode: ${this.state.mode}`);
    }

    setPlayers(players: Player[]): void {
        this.players = players;
    }

    followNextPlayer(): void {
        const alivePlayers = this.players.filter(p => p.state.isAlive);
        if (alivePlayers.length === 0) return;

        this.state.playerIndex = (this.state.playerIndex + 1) % alivePlayers.length;
        this.state.followTargetId = alivePlayers[this.state.playerIndex].id;
    }

    followPrevPlayer(): void {
        const alivePlayers = this.players.filter(p => p.state.isAlive);
        if (alivePlayers.length === 0) return;

        this.state.playerIndex = (this.state.playerIndex - 1 + alivePlayers.length) % alivePlayers.length;
        this.state.followTargetId = alivePlayers[this.state.playerIndex].id;
    }

    update(dt: number, input: InputManager): void {
        if (!this.isActive()) return;

        const inputState = input.getState();

        switch (this.state.mode) {
            case ObserverMode.FREE_CAM:
                this.updateFreeCam(dt, inputState);
                break;

            case ObserverMode.FOLLOW_PLAYER:
                this.updateFollowPlayer(dt);
                break;

            case ObserverMode.AUTO_ROTATE:
                this.updateAutoRotate(dt);
                break;
        }

        // Zoom control (mouse wheel or triggers)
        this.state.cameraZoom = Math.max(0.3, Math.min(2.0, inputState.zoom));
    }

    private updateFreeCam(dt: number, inputState: { moveDirection: Vector2 }): void {
        const speed = this.moveSpeed * dt;
        this.state.cameraPosition.x += inputState.moveDirection.x * speed;
        this.state.cameraPosition.y += inputState.moveDirection.y * speed;
    }

    private updateFollowPlayer(dt: number): void {
        if (!this.state.followTargetId) {
            this.followNextPlayer();
            return;
        }

        const target = this.players.find(p => p.id === this.state.followTargetId);
        if (!target || !target.state.isAlive) {
            // Target died, follow next
            this.followNextPlayer();
            return;
        }

        // Smooth follow
        const lerpFactor = 5 * dt;
        this.state.cameraPosition.x += (target.position.x - this.state.cameraPosition.x) * lerpFactor;
        this.state.cameraPosition.y += (target.position.y - this.state.cameraPosition.y) * lerpFactor;
    }

    private updateAutoRotate(dt: number): void {
        const dtMs = dt * 1000;
        this.state.autoRotateTimer += dtMs;

        if (this.state.autoRotateTimer >= this.state.autoRotateSpeed) {
            this.state.autoRotateTimer = 0;
            this.followNextPlayer();
        }

        // Still follow current player position
        this.updateFollowPlayer(dt);
    }

    getCameraPosition(): Vector2 {
        return { ...this.state.cameraPosition };
    }

    getCameraZoom(): number {
        return this.state.cameraZoom;
    }

    getFollowTarget(): Player | null {
        if (!this.state.followTargetId) return null;
        return this.players.find(p => p.id === this.state.followTargetId) || null;
    }

    /**
     * Render observer HUD overlay
     */
    renderOverlay(renderer: Renderer): void {
        if (!this.isActive()) return;

        const screen = renderer.getScreenSize();

        // Observer mode indicator
        renderer.drawScreenRect(
            screen.x / 2 - 80,
            10,
            160,
            30,
            'rgba(0, 0, 0, 0.7)',
            'rgba(100, 200, 255, 0.8)',
            2
        );
        renderer.drawScreenText(
            '👁 OBSERVER MODE',
            screen.x / 2,
            25,
            '#ffffff',
            14,
            'center',
            'middle'
        );

        // Mode indicator
        const modeName = this.state.mode.replace('_', ' ').toUpperCase();
        renderer.drawScreenText(
            modeName,
            screen.x / 2,
            50,
            'rgba(100, 200, 255, 1)',
            12,
            'center',
            'top'
        );

        // Following player info
        if (this.state.mode === ObserverMode.FOLLOW_PLAYER ||
            this.state.mode === ObserverMode.AUTO_ROTATE) {
            const target = this.getFollowTarget();
            if (target) {
                renderer.drawScreenText(
                    `Following: ${target.name}`,
                    screen.x / 2,
                    70,
                    target.color,
                    12,
                    'center',
                    'top'
                );
            }
        }

        // Controls hint
        renderer.drawScreenText(
            'F4: Exit | TAB: Cycle Mode | Q/E: Prev/Next Player | Arrows: Move | Scroll: Zoom',
            screen.x / 2,
            screen.y - 20,
            'rgba(150, 150, 150, 0.8)',
            11,
            'center',
            'middle'
        );
    }
}

// Singleton
let observerInstance: ObserverController | null = null;

export function getObserverController(): ObserverController {
    if (!observerInstance) {
        observerInstance = new ObserverController();
    }
    return observerInstance;
}
