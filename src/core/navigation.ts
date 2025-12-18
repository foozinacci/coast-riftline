// Navigation Manager - App State Machine
// Implements Specification B (High-Level App States) and K (Navigation Stack)

import {
    AppState,
    ModalType,
    NavigationEntry,
    ErrorState,
    FocusState,
} from './types';

/**
 * State transition definition.
 * Each state has explicit IN, OUT, and BACK behavior per specification.
 */
interface StateTransition {
    state: AppState;
    allowedTransitions: AppState[];
    backTarget: AppState | 'caller' | 'exit_confirm';
    requiresConfirmation?: boolean;
    modalOnBack?: ModalType;
}

/**
 * Navigation event for listeners.
 */
export interface NavigationEvent {
    from: AppState;
    to: AppState;
    data?: Record<string, unknown>;
}

/**
 * NavigationManager - Central state machine for app navigation.
 * 
 * Core principles (per specification):
 * - Every screen push records its caller (K)
 * - Back pops to caller unless a modal intercepts (K)
 * - Modals trap focus until dismissed (A4)
 * - No hardcoded "Back to Main Menu" unless explicitly chosen (K)
 * - Back always dismisses modals before navigating screens (A4)
 */
export class NavigationManager {
    private currentState: AppState = AppState.BOOT;
    private navigationStack: NavigationEntry[] = [];
    private activeModal: ModalType = ModalType.NONE;
    private errorState: ErrorState | null = null;
    private focusState: FocusState;
    private listeners: Set<(event: NavigationEvent) => void> = new Set();
    private dirtyState: boolean = false; // For unsaved changes detection

    // State transition map per specification B
    private readonly stateTransitions: Map<AppState, StateTransition>;

    constructor() {
        this.focusState = {
            currentFocusId: null,
            focusableElements: [],
            focusHistory: new Map(),
        };

        this.stateTransitions = this.buildTransitionMap();

        // Initialize with BOOT state
        this.navigationStack.push({
            state: AppState.BOOT,
            caller: null,
        });
    }

    /**
     * Build the state transition map per specification B.
     */
    private buildTransitionMap(): Map<AppState, StateTransition> {
        const map = new Map<AppState, StateTransition>();

        // 1) BOOT
        map.set(AppState.BOOT, {
            state: AppState.BOOT,
            allowedTransitions: [AppState.SPLASH],
            backTarget: 'exit_confirm',
        });

        // 2) SPLASH / LOADING
        map.set(AppState.SPLASH, {
            state: AppState.SPLASH,
            allowedTransitions: [AppState.TITLE],
            backTarget: 'exit_confirm',
        });

        // 3) TITLE
        map.set(AppState.TITLE, {
            state: AppState.TITLE,
            allowedTransitions: [AppState.MAIN_MENU, AppState.SETTINGS_ROOT],
            backTarget: 'exit_confirm',
        });

        // 4) MAIN MENU
        map.set(AppState.MAIN_MENU, {
            state: AppState.MAIN_MENU,
            allowedTransitions: [
                AppState.PLAY_MENU,
                AppState.PARTY,
                AppState.FRIENDS,
                AppState.PROFILE,
                AppState.LEADERBOARD,
                AppState.TRAINING_SETUP,
                AppState.CUSTOMIZE_MENU,
                AppState.SETTINGS_ROOT,
                AppState.MATCHMAKING,
                AppState.PRIVATE_MATCH,
                AppState.EXIT_CONFIRM,
            ],
            backTarget: 'exit_confirm',
        });

        // 4b) PARTY
        map.set(AppState.PARTY, {
            state: AppState.PARTY,
            allowedTransitions: [
                AppState.MAIN_MENU,
                AppState.FRIENDS,
                AppState.PLAY_MENU,
                AppState.MATCHMAKING,
            ],
            backTarget: AppState.MAIN_MENU,
        });

        // 4c) FRIENDS
        map.set(AppState.FRIENDS, {
            state: AppState.FRIENDS,
            allowedTransitions: [
                AppState.MAIN_MENU,
                AppState.PARTY,
            ],
            backTarget: AppState.MAIN_MENU,
        });

        // 4d) PROFILE
        map.set(AppState.PROFILE, {
            state: AppState.PROFILE,
            allowedTransitions: [
                AppState.MAIN_MENU,
            ],
            backTarget: AppState.MAIN_MENU,
        });

        // 5) PLAY MENU
        map.set(AppState.PLAY_MENU, {
            state: AppState.PLAY_MENU,
            allowedTransitions: [
                AppState.QUICK_PLAY_SETUP,
                AppState.CUSTOM_GAME_BROWSER,
                AppState.PRIVATE_MATCH,
                AppState.MATCHMAKING,
                AppState.MAIN_MENU,
            ],
            backTarget: AppState.MAIN_MENU,
        });

        // 6) QUICK PLAY SETUP
        map.set(AppState.QUICK_PLAY_SETUP, {
            state: AppState.QUICK_PLAY_SETUP,
            allowedTransitions: [AppState.MATCHMAKING, AppState.PLAY_MENU, AppState.IN_MATCH],
            backTarget: AppState.PLAY_MENU,
        });

        // 6b) TRAINING SETUP
        map.set(AppState.TRAINING_SETUP, {
            state: AppState.TRAINING_SETUP,
            allowedTransitions: [AppState.IN_MATCH, AppState.MAIN_MENU],
            backTarget: AppState.MAIN_MENU,
        });

        // 7) CUSTOM GAME BROWSER
        map.set(AppState.CUSTOM_GAME_BROWSER, {
            state: AppState.CUSTOM_GAME_BROWSER,
            allowedTransitions: [
                AppState.CONNECTING,
                AppState.CREATE_CUSTOM_GAME,
                AppState.PLAY_MENU,
            ],
            backTarget: AppState.PLAY_MENU,
        });

        // 8) CREATE CUSTOM GAME
        map.set(AppState.CREATE_CUSTOM_GAME, {
            state: AppState.CREATE_CUSTOM_GAME,
            allowedTransitions: [AppState.LOBBY, AppState.CUSTOM_GAME_BROWSER],
            backTarget: AppState.CUSTOM_GAME_BROWSER,
        });

        // 9) PRIVATE MATCH
        map.set(AppState.PRIVATE_MATCH, {
            state: AppState.PRIVATE_MATCH,
            allowedTransitions: [
                AppState.CONNECTING,
                AppState.LOBBY,
                AppState.IN_MATCH,
                AppState.PLAY_MENU,
            ],
            backTarget: AppState.PLAY_MENU,
        });

        // 10) LOBBY
        map.set(AppState.LOBBY, {
            state: AppState.LOBBY,
            allowedTransitions: [
                AppState.MATCH_LOADING,
                AppState.MAIN_MENU,
                AppState.PLAY_MENU,
                AppState.DISCONNECT_RECONNECT,
            ],
            backTarget: 'caller',
            requiresConfirmation: true,
            modalOnBack: ModalType.LEAVE_LOBBY,
        });

        // 11) MATCHMAKING / CONNECTING
        map.set(AppState.MATCHMAKING, {
            state: AppState.MATCHMAKING,
            allowedTransitions: [AppState.LOBBY, AppState.MATCH_LOADING, AppState.MAIN_MENU],
            backTarget: 'caller',
        });

        map.set(AppState.CONNECTING, {
            state: AppState.CONNECTING,
            allowedTransitions: [AppState.LOBBY],
            backTarget: 'caller',
        });

        // 12) MATCH LOADING
        map.set(AppState.MATCH_LOADING, {
            state: AppState.MATCH_LOADING,
            allowedTransitions: [AppState.IN_MATCH],
            backTarget: 'caller',
            requiresConfirmation: true,
            modalOnBack: ModalType.FORFEIT_MATCH,
        });

        // 13) IN MATCH
        map.set(AppState.IN_MATCH, {
            state: AppState.IN_MATCH,
            allowedTransitions: [
                AppState.PAUSE_MENU,
                AppState.POST_MATCH,
                AppState.DISCONNECT_RECONNECT,
                AppState.DEATH_OVERLAY,
            ],
            backTarget: AppState.PAUSE_MENU,
        });

        // 14) PAUSE MENU
        map.set(AppState.PAUSE_MENU, {
            state: AppState.PAUSE_MENU,
            allowedTransitions: [
                AppState.IN_MATCH,
                AppState.SETTINGS_ROOT,
                AppState.EXIT_CONFIRM,
            ],
            backTarget: AppState.IN_MATCH,
        });

        // 15) EXIT MATCH CONFIRM (handled via modal)

        // 16) DEATH / RESPAWN OVERLAY
        map.set(AppState.DEATH_OVERLAY, {
            state: AppState.DEATH_OVERLAY,
            allowedTransitions: [AppState.IN_MATCH, AppState.POST_MATCH],
            backTarget: AppState.PAUSE_MENU,
        });

        // 17) POST MATCH
        map.set(AppState.POST_MATCH, {
            state: AppState.POST_MATCH,
            allowedTransitions: [AppState.LOBBY, AppState.MATCH_LOADING, AppState.MAIN_MENU],
            backTarget: AppState.MAIN_MENU,
        });

        // 18) CUSTOMIZE MENU
        map.set(AppState.CUSTOMIZE_MENU, {
            state: AppState.CUSTOMIZE_MENU,
            allowedTransitions: [AppState.CLASS_SELECT, AppState.MAIN_MENU],
            backTarget: AppState.MAIN_MENU,
        });

        // 19) SETTINGS ROOT
        map.set(AppState.SETTINGS_ROOT, {
            state: AppState.SETTINGS_ROOT,
            allowedTransitions: [
                AppState.CONTROLS_MENU,
                AppState.AUDIO_SETTINGS,
            ],
            backTarget: 'caller',
        });

        // 20) CONTROLS MENU
        map.set(AppState.CONTROLS_MENU, {
            state: AppState.CONTROLS_MENU,
            allowedTransitions: [
                AppState.MKB_BINDINGS,
                AppState.CONTROLLER_BINDINGS,
                AppState.TOUCH_SETTINGS,
                AppState.SETTINGS_ROOT,
            ],
            backTarget: AppState.SETTINGS_ROOT,
        });

        // 21) CONTROLLER BINDINGS
        map.set(AppState.CONTROLLER_BINDINGS, {
            state: AppState.CONTROLLER_BINDINGS,
            allowedTransitions: [AppState.CONTROLS_MENU],
            backTarget: AppState.CONTROLS_MENU,
            modalOnBack: ModalType.DISCARD_CHANGES,
        });

        // 22) MKB BINDINGS
        map.set(AppState.MKB_BINDINGS, {
            state: AppState.MKB_BINDINGS,
            allowedTransitions: [AppState.CONTROLS_MENU],
            backTarget: AppState.CONTROLS_MENU,
            modalOnBack: ModalType.DISCARD_CHANGES,
        });

        // 22) DISCONNECT / RECONNECT
        map.set(AppState.DISCONNECT_RECONNECT, {
            state: AppState.DISCONNECT_RECONNECT,
            allowedTransitions: [AppState.LOBBY, AppState.IN_MATCH, AppState.MAIN_MENU],
            backTarget: AppState.MAIN_MENU,
        });

        // 23) EXIT CONFIRM
        map.set(AppState.EXIT_CONFIRM, {
            state: AppState.EXIT_CONFIRM,
            allowedTransitions: [],
            backTarget: 'caller',
        });

        // CLASS SELECT
        map.set(AppState.CLASS_SELECT, {
            state: AppState.CLASS_SELECT,
            allowedTransitions: [AppState.CUSTOMIZE_MENU],
            backTarget: AppState.CUSTOMIZE_MENU,
        });

        // TOUCH SETTINGS
        map.set(AppState.TOUCH_SETTINGS, {
            state: AppState.TOUCH_SETTINGS,
            allowedTransitions: [AppState.CONTROLS_MENU],
            backTarget: AppState.CONTROLS_MENU,
        });

        // LEADERBOARD
        map.set(AppState.LEADERBOARD, {
            state: AppState.LEADERBOARD,
            allowedTransitions: [AppState.MAIN_MENU],
            backTarget: AppState.MAIN_MENU,
        });

        // AUDIO SETTINGS
        map.set(AppState.AUDIO_SETTINGS, {
            state: AppState.AUDIO_SETTINGS,
            allowedTransitions: [AppState.SETTINGS_ROOT],
            backTarget: AppState.SETTINGS_ROOT,
        });

        return map;
    }

    /**
     * Get current app state.
     */
    getCurrentState(): AppState {
        return this.currentState;
    }

    /**
     * Get current modal (if any).
     */
    getActiveModal(): ModalType {
        return this.activeModal;
    }

    /**
     * Get current error state (if any).
     */
    getErrorState(): ErrorState | null {
        return this.errorState;
    }

    /**
     * Check if a modal is currently active.
     */
    hasActiveModal(): boolean {
        return this.activeModal !== ModalType.NONE;
    }

    /**
     * Navigate to a new state.
     * Validates transition and updates navigation stack.
     */
    navigateTo(newState: AppState, data?: Record<string, unknown>): boolean {
        // Cannot navigate while a modal is active (must dismiss first per A4)
        if (this.hasActiveModal()) {
            console.warn(`Cannot navigate while modal ${this.activeModal} is active`);
            return false;
        }

        const transition = this.stateTransitions.get(this.currentState);
        if (!transition) {
            console.error(`No transition defined for state: ${this.currentState}`);
            return false;
        }

        // Validate transition is allowed
        if (!transition.allowedTransitions.includes(newState)) {
            console.warn(`Transition from ${this.currentState} to ${newState} not allowed`);
            return false;
        }

        // Save focus for current state (per A2 - restore when returning)
        if (this.focusState.currentFocusId) {
            this.focusState.focusHistory.set(this.currentState, this.focusState.currentFocusId);
        }

        const previousState = this.currentState;

        // Push to navigation stack (per K - every screen push records its caller)
        this.navigationStack.push({
            state: newState,
            caller: this.currentState,
            data,
        });

        this.currentState = newState;

        // Restore focus for new state if we've been here before
        const savedFocus = this.focusState.focusHistory.get(newState);
        if (savedFocus) {
            this.focusState.currentFocusId = savedFocus;
        } else {
            this.focusState.currentFocusId = null;
        }

        // Notify listeners
        this.notifyListeners({ from: previousState, to: newState, data });

        return true;
    }

    /**
     * Handle back/cancel action.
     * Per specification:
     * - Back always dismisses modals before navigating screens (A4)
     * - Back pops to caller unless a modal intercepts (K)
     */
    goBack(): boolean {
        // If modal is active, dismiss it first (per A4)
        if (this.hasActiveModal()) {
            this.dismissModal();
            return true;
        }

        const transition = this.stateTransitions.get(this.currentState);
        if (!transition) {
            console.error(`No transition defined for state: ${this.currentState}`);
            return false;
        }

        // Check if back requires confirmation modal
        if (transition.modalOnBack && this.dirtyState) {
            this.showModal(transition.modalOnBack);
            return true;
        }

        // Determine back target
        let targetState: AppState;

        if (transition.backTarget === 'exit_confirm') {
            this.showModal(ModalType.EXIT_MATCH_CONFIRM);
            return true;
        } else if (transition.backTarget === 'caller') {
            // Pop from navigation stack to get caller
            const currentEntry = this.navigationStack.pop();
            if (!currentEntry || !currentEntry.caller) {
                console.warn('No caller in navigation stack');
                return false;
            }
            targetState = currentEntry.caller;
        } else {
            targetState = transition.backTarget;
            // Still pop from stack to maintain consistency
            this.navigationStack.pop();
        }

        const previousState = this.currentState;
        this.currentState = targetState;

        // Restore focus for target state
        const savedFocus = this.focusState.focusHistory.get(targetState);
        if (savedFocus) {
            this.focusState.currentFocusId = savedFocus;
        }

        this.notifyListeners({ from: previousState, to: targetState });

        return true;
    }

    /**
     * Show a modal dialog.
     * Modals trap focus until dismissed (per A4).
     */
    showModal(modal: ModalType): void {
        this.activeModal = modal;
    }

    /**
     * Dismiss the current modal.
     */
    dismissModal(): void {
        this.activeModal = ModalType.NONE;
    }

    /**
     * Confirm the current modal action.
     * Returns the modal that was confirmed for handling.
     */
    confirmModal(): ModalType {
        const modal = this.activeModal;
        this.dismissModal();
        return modal;
    }

    /**
     * Show an error modal.
     * Per specification A5: Any failed action must present clear error with actions.
     */
    showError(error: ErrorState): void {
        this.errorState = error;
        this.showModal(ModalType.ERROR);
    }

    /**
     * Clear error state.
     */
    clearError(): void {
        this.errorState = null;
        if (this.activeModal === ModalType.ERROR) {
            this.dismissModal();
        }
    }

    /**
     * Set dirty state (unsaved changes).
     * Used to determine if back should show discard modal.
     */
    setDirtyState(dirty: boolean): void {
        this.dirtyState = dirty;
    }

    /**
     * Get focus state for UI rendering.
     */
    getFocusState(): FocusState {
        return { ...this.focusState };
    }

    /**
     * Update current focus element.
     */
    setFocus(elementId: string): void {
        this.focusState.currentFocusId = elementId;
    }

    /**
     * Alias for setFocus to match BaseScreen usage.
     */
    focusElement(elementId: string): void {
        this.setFocus(elementId);
    }

    /**
     * Register focusable elements for current screen.
     */
    setFocusableElements(elements: string[]): void {
        this.focusState.focusableElements = elements;
        // Set initial focus to first element if none set (per A2 - deterministic initial focus)
        if (!this.focusState.currentFocusId && elements.length > 0) {
            this.focusState.currentFocusId = elements[0];
        }
    }

    /**
     * Navigate focus in a direction (for controller/keyboard navigation).
     */
    navigateFocus(direction: 'up' | 'down' | 'left' | 'right'): void {
        const elements = this.focusState.focusableElements;
        if (elements.length === 0) return;

        const currentIndex = this.focusState.currentFocusId
            ? elements.indexOf(this.focusState.currentFocusId)
            : -1;

        let newIndex: number;

        // Simple linear navigation for now (can be enhanced for grid layouts)
        switch (direction) {
            case 'up':
            case 'left':
                newIndex = currentIndex > 0 ? currentIndex - 1 : elements.length - 1;
                break;
            case 'down':
            case 'right':
                newIndex = currentIndex < elements.length - 1 ? currentIndex + 1 : 0;
                break;
        }

        this.focusState.currentFocusId = elements[newIndex];
    }

    /**
     * Add a navigation event listener.
     */
    addListener(listener: (event: NavigationEvent) => void): void {
        this.listeners.add(listener);
    }

    /**
     * Remove a navigation event listener.
     */
    removeListener(listener: (event: NavigationEvent) => void): void {
        this.listeners.delete(listener);
    }

    /**
     * Notify all listeners of a navigation event.
     */
    private notifyListeners(event: NavigationEvent): void {
        for (const listener of this.listeners) {
            listener(event);
        }
    }

    /**
     * Get the navigation stack (for debugging).
     */
    getNavigationStack(): NavigationEntry[] {
        return [...this.navigationStack];
    }

    /**
     * Check if currently in a match-related state.
     */
    isInMatch(): boolean {
        return [
            AppState.IN_MATCH,
            AppState.PAUSE_MENU,
            AppState.DEATH_OVERLAY,
        ].includes(this.currentState);
    }

    /**
     * Check if currently in a menu state.
     */
    isInMenu(): boolean {
        return [
            AppState.MAIN_MENU,
            AppState.PLAY_MENU,
            AppState.CUSTOMIZE_MENU,
            AppState.SETTINGS_ROOT,
            AppState.CONTROLS_MENU,
        ].includes(this.currentState);
    }

    /**
     * Force navigate to a state (bypasses validation).
     * Use sparingly - mainly for error recovery and reconnection.
     */
    forceNavigateTo(state: AppState): void {
        const previousState = this.currentState;
        this.currentState = state;
        this.navigationStack = [{
            state,
            caller: null,
        }];
        this.dismissModal();
        this.clearError();
        this.notifyListeners({ from: previousState, to: state });
    }
}

// Singleton instance
let navigationInstance: NavigationManager | null = null;

/**
 * Get the global NavigationManager instance.
 */
export function getNavigationManager(): NavigationManager {
    if (!navigationInstance) {
        navigationInstance = new NavigationManager();
    }
    return navigationInstance;
}

/**
 * Reset the navigation manager (for testing).
 */
export function resetNavigationManager(): void {
    navigationInstance = null;
}
