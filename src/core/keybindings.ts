// Key Bindings Configuration System
// Supports mobile touch, iOS, keyboard/mouse, and gamepad with rebindable controls

// ============================================================================
// TYPES
// ============================================================================

export type InputAction =
    | 'move_up'
    | 'move_down'
    | 'move_left'
    | 'move_right'
    | 'fire'
    | 'aim'
    | 'reload'
    | 'dash'
    | 'tactical'
    | 'interact'
    | 'pause'
    | 'confirm'
    | 'back'
    | 'zoom_in'
    | 'zoom_out';

export interface KeyBinding {
    primary: string;
    secondary?: string;
    gamepad?: number | string; // Button index or axis name
    label: string;
    category: 'movement' | 'combat' | 'abilities' | 'ui';
}

export interface TouchLayout {
    moveJoystick: { x: number; y: number; radius: number };
    aimJoystick: { x: number; y: number; radius: number };
    fireButton: { x: number; y: number; radius: number };
    reloadButton: { x: number; y: number; radius: number };
    dashButton: { x: number; y: number; radius: number };
    tacticalButton: { x: number; y: number; radius: number };
    interactButton: { x: number; y: number; radius: number };
    pauseButton: { x: number; y: number; radius: number };
}

export type InputScheme = 'keyboard' | 'gamepad' | 'touch';

// ============================================================================
// DEFAULT BINDINGS
// ============================================================================

export const DEFAULT_KEYBOARD_BINDINGS: Record<InputAction, KeyBinding> = {
    move_up: {
        primary: 'KeyW',
        secondary: 'ArrowUp',
        label: 'Move Up',
        category: 'movement',
    },
    move_down: {
        primary: 'KeyS',
        secondary: 'ArrowDown',
        label: 'Move Down',
        category: 'movement',
    },
    move_left: {
        primary: 'KeyA',
        secondary: 'ArrowLeft',
        label: 'Move Left',
        category: 'movement',
    },
    move_right: {
        primary: 'KeyD',
        secondary: 'ArrowRight',
        label: 'Move Right',
        category: 'movement',
    },
    fire: {
        primary: 'Mouse0',
        label: 'Fire',
        category: 'combat',
    },
    aim: {
        primary: 'MouseMove',
        label: 'Aim',
        category: 'combat',
    },
    reload: {
        primary: 'KeyR',
        label: 'Reload',
        category: 'combat',
    },
    dash: {
        primary: 'ShiftLeft',
        secondary: 'ShiftRight',
        label: 'Dash',
        category: 'abilities',
    },
    tactical: {
        primary: 'KeyQ',
        label: 'Tactical Ability',
        category: 'abilities',
    },
    interact: {
        primary: 'KeyE',
        secondary: 'KeyF',
        label: 'Interact / Plant',
        category: 'abilities',
    },
    pause: {
        primary: 'Escape',
        label: 'Pause',
        category: 'ui',
    },
    confirm: {
        primary: 'Enter',
        secondary: 'Space',
        label: 'Confirm',
        category: 'ui',
    },
    back: {
        primary: 'Escape',
        label: 'Back',
        category: 'ui',
    },
    zoom_in: {
        primary: 'Equal',
        secondary: 'NumpadAdd',
        label: 'Zoom In',
        category: 'ui',
    },
    zoom_out: {
        primary: 'Minus',
        secondary: 'NumpadSubtract',
        label: 'Zoom Out',
        category: 'ui',
    },
};

export const DEFAULT_GAMEPAD_BINDINGS: Record<InputAction, KeyBinding> = {
    move_up: {
        primary: 'LeftStickY-',
        gamepad: 'LeftStickY-',
        label: 'Move Up',
        category: 'movement',
    },
    move_down: {
        primary: 'LeftStickY+',
        gamepad: 'LeftStickY+',
        label: 'Move Down',
        category: 'movement',
    },
    move_left: {
        primary: 'LeftStickX-',
        gamepad: 'LeftStickX-',
        label: 'Move Left',
        category: 'movement',
    },
    move_right: {
        primary: 'LeftStickX+',
        gamepad: 'LeftStickX+',
        label: 'Move Right',
        category: 'movement',
    },
    fire: {
        primary: 'RT',
        gamepad: 7, // R2/RT
        label: 'Fire',
        category: 'combat',
    },
    aim: {
        primary: 'RightStick',
        gamepad: 'RightStick',
        label: 'Aim',
        category: 'combat',
    },
    reload: {
        primary: 'X',
        gamepad: 2, // X/Square
        label: 'Reload',
        category: 'combat',
    },
    dash: {
        primary: 'LB',
        gamepad: 4, // L1/LB
        label: 'Dash',
        category: 'abilities',
    },
    tactical: {
        primary: 'RB',
        gamepad: 5, // R1/RB
        label: 'Tactical Ability',
        category: 'abilities',
    },
    interact: {
        primary: 'A',
        gamepad: 0, // A/Cross
        label: 'Interact / Plant',
        category: 'abilities',
    },
    pause: {
        primary: 'Start',
        gamepad: 9, // Start/Options
        label: 'Pause',
        category: 'ui',
    },
    confirm: {
        primary: 'A',
        gamepad: 0, // A/Cross
        label: 'Confirm',
        category: 'ui',
    },
    back: {
        primary: 'B',
        gamepad: 1, // B/Circle
        label: 'Back',
        category: 'ui',
    },
    zoom_in: {
        primary: 'DPadUp',
        gamepad: 12,
        label: 'Zoom In',
        category: 'ui',
    },
    zoom_out: {
        primary: 'DPadDown',
        gamepad: 13,
        label: 'Zoom Out',
        category: 'ui',
    },
};

// Default touch layout (percentages of screen)
export const DEFAULT_TOUCH_LAYOUT: TouchLayout = {
    moveJoystick: { x: 0.15, y: 0.75, radius: 80 },
    aimJoystick: { x: 0.85, y: 0.75, radius: 80 },
    fireButton: { x: 0.88, y: 0.45, radius: 45 },
    reloadButton: { x: 0.78, y: 0.35, radius: 35 },
    dashButton: { x: 0.22, y: 0.45, radius: 40 },
    tacticalButton: { x: 0.12, y: 0.45, radius: 40 },
    interactButton: { x: 0.50, y: 0.85, radius: 40 },
    pauseButton: { x: 0.06, y: 0.08, radius: 25 },
};

// ============================================================================
// KEY NAMES FOR DISPLAY
// ============================================================================

export const KEY_DISPLAY_NAMES: Record<string, string> = {
    // Letters
    KeyA: 'A', KeyB: 'B', KeyC: 'C', KeyD: 'D', KeyE: 'E', KeyF: 'F',
    KeyG: 'G', KeyH: 'H', KeyI: 'I', KeyJ: 'J', KeyK: 'K', KeyL: 'L',
    KeyM: 'M', KeyN: 'N', KeyO: 'O', KeyP: 'P', KeyQ: 'Q', KeyR: 'R',
    KeyS: 'S', KeyT: 'T', KeyU: 'U', KeyV: 'V', KeyW: 'W', KeyX: 'X',
    KeyY: 'Y', KeyZ: 'Z',

    // Numbers
    Digit1: '1', Digit2: '2', Digit3: '3', Digit4: '4', Digit5: '5',
    Digit6: '6', Digit7: '7', Digit8: '8', Digit9: '9', Digit0: '0',

    // Arrows
    ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',

    // Modifiers
    ShiftLeft: 'L-Shift', ShiftRight: 'R-Shift',
    ControlLeft: 'L-Ctrl', ControlRight: 'R-Ctrl',
    AltLeft: 'L-Alt', AltRight: 'R-Alt',
    MetaLeft: 'L-Meta', MetaRight: 'R-Meta',

    // Special
    Space: 'Space', Enter: 'Enter', Escape: 'Esc', Tab: 'Tab',
    Backspace: 'Backspace', Delete: 'Delete',

    // Punctuation
    Equal: '=', Minus: '-', BracketLeft: '[', BracketRight: ']',
    Semicolon: ';', Quote: "'", Backquote: '`', Backslash: '\\',
    Comma: ',', Period: '.', Slash: '/',

    // Numpad
    NumpadAdd: 'Num+', NumpadSubtract: 'Num-', NumpadMultiply: 'Num*',
    NumpadDivide: 'Num/', NumpadEnter: 'Num Enter',
    Numpad0: 'Num0', Numpad1: 'Num1', Numpad2: 'Num2', Numpad3: 'Num3',
    Numpad4: 'Num4', Numpad5: 'Num5', Numpad6: 'Num6', Numpad7: 'Num7',
    Numpad8: 'Num8', Numpad9: 'Num9',

    // Mouse
    Mouse0: 'LMB', Mouse1: 'MMB', Mouse2: 'RMB',
    MouseMove: 'Mouse',

    // Gamepad (display names)
    'LeftStickX-': 'L-Stick ←',
    'LeftStickX+': 'L-Stick →',
    'LeftStickY-': 'L-Stick ↑',
    'LeftStickY+': 'L-Stick ↓',
    'RightStick': 'R-Stick',
};

export const GAMEPAD_BUTTON_NAMES: string[] = [
    'A', 'B', 'X', 'Y',
    'LB', 'RB', 'LT', 'RT',
    'Back', 'Start',
    'L-Stick', 'R-Stick',
    'D-Up', 'D-Down', 'D-Left', 'D-Right',
    'Guide',
];

// ============================================================================
// KEY BINDINGS MANAGER
// ============================================================================

const STORAGE_KEY = 'riftline_keybindings';
const SETTINGS_KEY = 'riftline_input_settings';

export interface InputSettings {
    sensitivity: number; // Mouse/stick sensitivity (0.5 - 2.0)
    aimAssist: boolean; // For gamepad
    invertY: boolean;
    vibration: boolean;
    touchOpacity: number; // 0.3 - 1.0
    touchScale: number; // 0.8 - 1.5
}

const DEFAULT_SETTINGS: InputSettings = {
    sensitivity: 1.0,
    aimAssist: true,
    invertY: false,
    vibration: true,
    touchOpacity: 0.7,
    touchScale: 1.0,
};

export class KeyBindingsManager {
    private static instance: KeyBindingsManager | null = null;

    private keyboardBindings: Record<InputAction, KeyBinding>;
    private gamepadBindings: Record<InputAction, KeyBinding>;
    private touchLayout: TouchLayout;
    private settings: InputSettings;
    private currentScheme: InputScheme = 'keyboard';

    private rebindingAction: InputAction | null = null;
    private rebindCallback: ((key: string) => void) | null = null;

    private constructor() {
        this.keyboardBindings = this.loadBindings('keyboard') || { ...DEFAULT_KEYBOARD_BINDINGS };
        this.gamepadBindings = this.loadBindings('gamepad') || { ...DEFAULT_GAMEPAD_BINDINGS };
        this.touchLayout = this.loadTouchLayout() || { ...DEFAULT_TOUCH_LAYOUT };
        this.settings = this.loadSettings() || { ...DEFAULT_SETTINGS };

        this.detectInputScheme();
    }

    static getInstance(): KeyBindingsManager {
        if (!KeyBindingsManager.instance) {
            KeyBindingsManager.instance = new KeyBindingsManager();
        }
        return KeyBindingsManager.instance;
    }

    // ============================================================================
    // SCHEME DETECTION
    // ============================================================================

    private detectInputScheme(): void {
        if (this.isTouchDevice()) {
            this.currentScheme = 'touch';
        } else if (this.hasGamepad()) {
            this.currentScheme = 'gamepad';
        } else {
            this.currentScheme = 'keyboard';
        }
    }

    private isTouchDevice(): boolean {
        return (
            'ontouchstart' in window ||
            navigator.maxTouchPoints > 0 ||
            window.matchMedia('(pointer: coarse)').matches
        );
    }

    private hasGamepad(): boolean {
        const gamepads = navigator.getGamepads();
        return gamepads.some(gp => gp !== null);
    }

    getCurrentScheme(): InputScheme {
        return this.currentScheme;
    }

    setCurrentScheme(scheme: InputScheme): void {
        this.currentScheme = scheme;
    }

    // ============================================================================
    // BINDING ACCESS
    // ============================================================================

    getBinding(action: InputAction): KeyBinding {
        if (this.currentScheme === 'gamepad') {
            return this.gamepadBindings[action];
        }
        return this.keyboardBindings[action];
    }

    getAllBindings(type: 'keyboard' | 'gamepad' = 'keyboard'): Record<InputAction, KeyBinding> {
        return type === 'gamepad' ? this.gamepadBindings : this.keyboardBindings;
    }

    getTouchLayout(): TouchLayout {
        return this.touchLayout;
    }

    getSettings(): InputSettings {
        return this.settings;
    }

    /**
     * Check if a key code matches an action
     */
    isKeyForAction(keyCode: string, action: InputAction): boolean {
        const binding = this.keyboardBindings[action];
        return binding.primary === keyCode || binding.secondary === keyCode;
    }

    /**
     * Check if a gamepad button matches an action
     */
    isButtonForAction(buttonIndex: number, action: InputAction): boolean {
        const binding = this.gamepadBindings[action];
        return binding.gamepad === buttonIndex;
    }

    /**
     * Get display name for a key
     */
    getKeyDisplayName(keyCode: string): string {
        return KEY_DISPLAY_NAMES[keyCode] || keyCode.replace('Key', '').replace('Digit', '');
    }

    /**
     * Get display name for a gamepad button
     */
    getButtonDisplayName(buttonIndex: number): string {
        return GAMEPAD_BUTTON_NAMES[buttonIndex] || `Button ${buttonIndex}`;
    }

    // ============================================================================
    // REBINDING
    // ============================================================================

    /**
     * Start listening for a new key binding
     */
    startRebind(action: InputAction, callback: (key: string) => void): void {
        this.rebindingAction = action;
        this.rebindCallback = callback;

        window.addEventListener('keydown', this.handleRebindKey);
        window.addEventListener('mousedown', this.handleRebindMouse);
    }

    /**
     * Cancel rebinding
     */
    cancelRebind(): void {
        this.rebindingAction = null;
        this.rebindCallback = null;

        window.removeEventListener('keydown', this.handleRebindKey);
        window.removeEventListener('mousedown', this.handleRebindMouse);
    }

    private handleRebindKey = (e: KeyboardEvent): void => {
        e.preventDefault();

        if (e.code === 'Escape') {
            this.cancelRebind();
            return;
        }

        if (this.rebindingAction && this.rebindCallback) {
            this.setKeyBinding(this.rebindingAction, e.code);
            this.rebindCallback(e.code);
            this.cancelRebind();
        }
    };

    private handleRebindMouse = (e: MouseEvent): void => {
        e.preventDefault();

        if (this.rebindingAction && this.rebindCallback) {
            const key = `Mouse${e.button}`;
            this.setKeyBinding(this.rebindingAction, key);
            this.rebindCallback(key);
            this.cancelRebind();
        }
    };

    /**
     * Set a new key binding
     */
    setKeyBinding(action: InputAction, keyCode: string, secondary: boolean = false): void {
        // Check for conflicts
        for (const [otherAction, binding] of Object.entries(this.keyboardBindings)) {
            if (otherAction !== action) {
                if (binding.primary === keyCode) {
                    binding.primary = ''; // Clear conflicting binding
                }
                if (binding.secondary === keyCode) {
                    binding.secondary = undefined;
                }
            }
        }

        if (secondary) {
            this.keyboardBindings[action].secondary = keyCode;
        } else {
            this.keyboardBindings[action].primary = keyCode;
        }

        this.saveBindings('keyboard');
    }

    /**
     * Set a gamepad binding
     */
    setGamepadBinding(action: InputAction, buttonIndex: number): void {
        this.gamepadBindings[action].gamepad = buttonIndex;
        this.saveBindings('gamepad');
    }

    /**
     * Reset bindings to defaults
     */
    resetBindings(type: 'keyboard' | 'gamepad' | 'all' = 'all'): void {
        if (type === 'keyboard' || type === 'all') {
            this.keyboardBindings = { ...DEFAULT_KEYBOARD_BINDINGS };
        }
        if (type === 'gamepad' || type === 'all') {
            this.gamepadBindings = { ...DEFAULT_GAMEPAD_BINDINGS };
        }
        this.saveBindings(type === 'all' ? 'keyboard' : type);
        if (type === 'all') {
            this.saveBindings('gamepad');
        }
    }

    // ============================================================================
    // SETTINGS
    // ============================================================================

    updateSettings(partial: Partial<InputSettings>): void {
        this.settings = { ...this.settings, ...partial };
        this.saveSettings();
    }

    resetSettings(): void {
        this.settings = { ...DEFAULT_SETTINGS };
        this.saveSettings();
    }

    // ============================================================================
    // TOUCH LAYOUT
    // ============================================================================

    updateTouchLayout(partial: Partial<TouchLayout>): void {
        this.touchLayout = { ...this.touchLayout, ...partial };
        this.saveTouchLayout();
    }

    resetTouchLayout(): void {
        this.touchLayout = { ...DEFAULT_TOUCH_LAYOUT };
        this.saveTouchLayout();
    }

    // ============================================================================
    // PERSISTENCE
    // ============================================================================

    private loadBindings(type: 'keyboard' | 'gamepad'): Record<InputAction, KeyBinding> | null {
        try {
            const data = localStorage.getItem(`${STORAGE_KEY}_${type}`);
            return data ? JSON.parse(data) : null;
        } catch {
            return null;
        }
    }

    private saveBindings(type: 'keyboard' | 'gamepad'): void {
        try {
            const bindings = type === 'keyboard' ? this.keyboardBindings : this.gamepadBindings;
            localStorage.setItem(`${STORAGE_KEY}_${type}`, JSON.stringify(bindings));
        } catch (e) {
            console.error('[KeyBindings] Failed to save:', e);
        }
    }

    private loadSettings(): InputSettings | null {
        try {
            const data = localStorage.getItem(SETTINGS_KEY);
            return data ? JSON.parse(data) : null;
        } catch {
            return null;
        }
    }

    private saveSettings(): void {
        try {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
        } catch (e) {
            console.error('[KeyBindings] Failed to save settings:', e);
        }
    }

    private loadTouchLayout(): TouchLayout | null {
        try {
            const data = localStorage.getItem(`${STORAGE_KEY}_touch`);
            return data ? JSON.parse(data) : null;
        } catch {
            return null;
        }
    }

    private saveTouchLayout(): void {
        try {
            localStorage.setItem(`${STORAGE_KEY}_touch`, JSON.stringify(this.touchLayout));
        } catch (e) {
            console.error('[KeyBindings] Failed to save touch layout:', e);
        }
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

export function getKeyBindings(): KeyBindingsManager {
    return KeyBindingsManager.getInstance();
}
