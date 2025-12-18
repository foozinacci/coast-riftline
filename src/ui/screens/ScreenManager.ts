// Screen Manager - Orchestrates all UI screens
// Handles screen transitions and input routing

import { Renderer } from '../../core/renderer';
import { getNavigationManager, NavigationManager, NavigationEvent } from '../../core/navigation';
import { AppState, ModalType, MatchStats } from '../../core/types';
import { InputManager } from '../../core/input';
import { BaseScreen, ScreenContext } from './BaseScreen';
import { TitleScreen } from './TitleScreen';
import { MainMenu } from './MainMenu';
import { PlayMenu } from './PlayMenu';
import { PauseMenu } from './PauseMenu';
import { SettingsRoot } from './SettingsRoot';
import { ControlsMenu } from './ControlsMenu';
import { QuickPlaySetup } from './QuickPlaySetup';
import { TrainingSetup } from './TrainingSetup';
import { PostMatchScreen } from './PostMatchScreen';
import { LobbyScreen } from './LobbyScreen';
import { CustomizeMenu } from './CustomizeMenu';
import { ClassSelectScreen } from './ClassSelectScreen';
import { PrivateMatch } from './PrivateMatch';
import { PartyScreen } from './PartyScreen';
import { FriendsScreen } from './FriendsScreen';
import { ProgressionScreen } from './ProgressionScreen';
import { LeaderboardScreen } from './LeaderboardScreen';
import { MKBBindingsScreen } from './MKBBindingsScreen';
import { ControllerBindingsScreen } from './ControllerBindingsScreen';
import { TouchSettingsScreen } from './TouchSettingsScreen';
import { AudioSettings } from './AudioSettings';
import { MatchmakingScreen } from './MatchmakingScreen';

import { GameMode, TrainingDifficulty } from '../../core/types';

/**
 * Callbacks for game integration.
 */
export interface GameCallbacks {
    startGame: (mode?: GameMode, difficulty?: TrainingDifficulty) => void;
    resetGame: () => void;
}

/**
 * ScreenManager - Central UI orchestrator.
 * Manages screen lifecycle, input routing, and modal display.
 */
export class ScreenManager {
    private navigation: NavigationManager;
    private screens: Map<AppState, BaseScreen>;
    private currentScreen: BaseScreen | null = null;
    private isMobile: boolean;

    // Navigation cooldown for gamepad/keyboard stick inputs
    private lastFocusTime: number = 0;
    private readonly FOCUS_COOLDOWN_MS = 200;

    // Typed screen references for setting callbacks
    private quickPlaySetup: QuickPlaySetup;
    private trainingSetup: TrainingSetup;
    private postMatchScreen: PostMatchScreen;
    private lobbyScreen: LobbyScreen;
    private mainMenu: MainMenu;
    private privateMatch: PrivateMatch;

    constructor(isMobile: boolean) {
        this.isMobile = isMobile;
        this.navigation = getNavigationManager();
        this.screens = new Map();

        // Create screen instances
        this.quickPlaySetup = new QuickPlaySetup();
        this.trainingSetup = new TrainingSetup();
        this.postMatchScreen = new PostMatchScreen();
        this.lobbyScreen = new LobbyScreen();
        this.mainMenu = new MainMenu();
        this.privateMatch = new PrivateMatch();

        // Initialize all screens
        this.initializeScreens();

        // Listen for navigation events
        this.navigation.addListener(this.onNavigationEvent.bind(this));
    }

    private initializeScreens(): void {
        // Register all screens
        this.screens.set(AppState.TITLE, new TitleScreen());
        this.mainMenu = new MainMenu();
        this.screens.set(AppState.MAIN_MENU, this.mainMenu);
        this.screens.set(AppState.PLAY_MENU, new PlayMenu());
        this.screens.set(AppState.TRAINING_SETUP, this.trainingSetup);
        this.screens.set(AppState.PAUSE_MENU, new PauseMenu());
        this.screens.set(AppState.SETTINGS_ROOT, new SettingsRoot());
        this.screens.set(AppState.CONTROLS_MENU, new ControlsMenu());
        this.screens.set(AppState.QUICK_PLAY_SETUP, this.quickPlaySetup);
        this.screens.set(AppState.POST_MATCH, this.postMatchScreen);
        this.screens.set(AppState.LOBBY, this.lobbyScreen);
        this.screens.set(AppState.CUSTOMIZE_MENU, new CustomizeMenu());
        this.screens.set(AppState.CLASS_SELECT, new ClassSelectScreen());
        this.screens.set(AppState.PRIVATE_MATCH, this.privateMatch);
        this.screens.set(AppState.PARTY, new PartyScreen());
        this.screens.set(AppState.FRIENDS, new FriendsScreen());
        this.screens.set(AppState.PROFILE, new ProgressionScreen());
        this.screens.set(AppState.LEADERBOARD, new LeaderboardScreen());
        this.screens.set(AppState.MKB_BINDINGS, new MKBBindingsScreen());
        this.screens.set(AppState.CONTROLLER_BINDINGS, new ControllerBindingsScreen());
        this.screens.set(AppState.TOUCH_SETTINGS, new TouchSettingsScreen());
        this.screens.set(AppState.AUDIO_SETTINGS, new AudioSettings());
        this.screens.set(AppState.MATCHMAKING, new MatchmakingScreen());
    }

    /**
     * Set game callbacks for starting/resetting matches.
     */
    setGameCallbacks(callbacks: GameCallbacks): void {
        this.quickPlaySetup.setStartGameCallback((mode, difficulty) => callbacks.startGame(mode, difficulty));
        this.trainingSetup.setStartTrainingCallback((mode, difficulty) => callbacks.startGame(mode, difficulty));
        this.postMatchScreen.setReplayCallback(() => callbacks.startGame());
        this.lobbyScreen.setStartMatchCallback(() => callbacks.startGame());
        // MainMenu Training button now navigates to training setup
        this.mainMenu.setStartTrainingCallback(() => this.navigation.navigateTo(AppState.TRAINING_SETUP));
    }

    /**
     * Set match result for post-match screen.
     */
    setMatchResult(isWinner: boolean, stats: MatchStats): void {
        this.postMatchScreen.setMatchResult(isWinner, stats);
    }

    private onNavigationEvent(event: NavigationEvent): void {
        console.log('[ScreenManager] Navigation event:', event.from, '->', event.to);

        // Exit current screen
        if (this.currentScreen) {
            this.currentScreen.onExit();
        }

        // Enter new screen
        const newScreen = this.screens.get(event.to);
        if (newScreen) {
            console.log('[ScreenManager] Found screen for state:', event.to);
            this.currentScreen = newScreen;
            this.currentScreen.onEnter();
        } else {
            console.log('[ScreenManager] No screen for state:', event.to);
            this.currentScreen = null;
            // Don't redirect for game states that don't need screens
            const gameStates = [AppState.IN_MATCH];
            if (!gameStates.includes(event.to)) {
                console.log('[ScreenManager] Redirecting to TITLE (state not in gameStates)');
                // Fallback: redirect to TITLE screen if state not handled
                this.navigation.forceNavigateTo(AppState.TITLE);
            } else {
                console.log('[ScreenManager] State is a game state, NOT redirecting');
            }
        }
    }

    /**
     * Check if the screen manager handles the current app state.
     */
    handlesCurrentState(): boolean {
        const state = this.navigation.getCurrentState();
        return this.screens.has(state);
    }

    /**
     * Check if currently in a game-related state (menus, not active gameplay).
     */
    isInMenuState(): boolean {
        return this.handlesCurrentState() && this.navigation.getCurrentState() !== AppState.IN_MATCH;
    }

    /**
     * Process input for current screen.
     */
    handleInput(input: InputManager): void {
        // Don't process input if modal is active
        if (this.navigation.hasActiveModal()) {
            this.handleModalInput(input);
            return;
        }

        if (!this.currentScreen) return;

        // Handle raw key input for text entry (lobby codes, etc.)
        const rawKey = input.consumeRawKey();
        if (rawKey && this.currentScreen) {
            // Check if screen has handleKeyInput method
            const screen = this.currentScreen as any;
            if (typeof screen.handleKeyInput === 'function') {
                screen.handleKeyInput(rawKey);
            }
        }

        // Handle mouse/touch focus FIRST (before confirm, so taps work on mobile)
        const mousePos = input.getMousePosition();
        if (mousePos && this.currentScreen) {
            this.currentScreen.handleMouseMove(mousePos.x, mousePos.y);
        }

        // Handle confirm (after focus so mobile taps select the tapped button)
        if (input.consumeConfirm()) {
            this.currentScreen.handleConfirm();
        }

        // Handle back
        if (input.consumeBack()) {
            this.currentScreen.handleBack();
        }

        // Handle focus navigation via keyboard/gamepad (with cooldown)
        const inputState = input.getState();
        const threshold = 0.5; // Lower threshold slightly for better feel
        const now = performance.now();

        if (now - this.lastFocusTime > this.FOCUS_COOLDOWN_MS) {
            if (inputState.moveDirection.y < -threshold) {
                this.currentScreen.navigateFocus('up');
                this.lastFocusTime = now;
            } else if (inputState.moveDirection.y > threshold) {
                this.currentScreen.navigateFocus('down');
                this.lastFocusTime = now;
            }
        }
    }

    private handleModalInput(input: InputManager): void {
        if (input.consumeConfirm()) {
            // Confirm modal action
            const confirmedModal = this.navigation.confirmModal();
            this.handleModalConfirm(confirmedModal);
        }

        if (input.consumeBack()) {
            // Dismiss modal on back/cancel
            this.navigation.dismissModal();
        }
    }

    private handleModalConfirm(modal: ModalType): void {
        switch (modal) {
            case ModalType.EXIT_MATCH_CONFIRM:
                // Leave match → Main menu
                this.navigation.forceNavigateTo(AppState.MAIN_MENU);
                break;

            case ModalType.LEAVE_LOBBY:
                // Leave lobby → Play menu
                this.navigation.forceNavigateTo(AppState.PLAY_MENU);
                break;

            case ModalType.DISBAND_LOBBY:
                // Disband lobby → Main menu
                this.navigation.forceNavigateTo(AppState.MAIN_MENU);
                break;

            case ModalType.DISCARD_CHANGES:
                // Discard and go back
                this.navigation.setDirtyState(false);
                this.navigation.goBack();
                break;

            case ModalType.ERROR:
                // Error modal with "try again" - just dismiss for now
                this.navigation.clearError();
                break;
        }
    }

    /**
     * Render current screen and any active modal.
     */
    render(renderer: Renderer, screenWidth: number, screenHeight: number): void {
        const context: ScreenContext = {
            renderer,
            screenWidth,
            screenHeight,
            focusState: this.navigation.getFocusState(),
            isMobile: this.isMobile,
        };

        // If no current screen, render a fallback (shouldn't happen in normal flow)
        if (!this.currentScreen) {
            // Fallback: just clear to dark background
            renderer.drawScreenRect(0, 0, screenWidth, screenHeight, 'rgba(15, 18, 25, 1)');
            renderer.drawScreenText(
                'Loading...',
                screenWidth / 2,
                screenHeight / 2,
                'rgba(100, 105, 115, 1)',
                18,
                'center',
                'middle'
            );
            return;
        }

        // Render current screen
        this.currentScreen.render(context);

        // Render modal overlay if active
        if (this.navigation.hasActiveModal()) {
            this.renderModal(context);
        }
    }

    private renderModal(ctx: ScreenContext): void {
        const { renderer, screenWidth, screenHeight } = ctx;
        const modal = this.navigation.getActiveModal();

        // Darken background
        renderer.drawScreenRect(0, 0, screenWidth, screenHeight, 'rgba(0, 0, 0, 0.6)');

        // Modal panel
        const panelWidth = 350;
        const panelHeight = 200;
        const panelX = (screenWidth - panelWidth) / 2;
        const panelY = (screenHeight - panelHeight) / 2;

        renderer.drawScreenRect(panelX, panelY, panelWidth, panelHeight, 'rgba(30, 33, 40, 0.98)');
        renderer.drawScreenRect(panelX, panelY, panelWidth, panelHeight, undefined, 'rgba(100, 120, 140, 0.8)', 2);

        // Modal content based on type
        let title = '';
        let message = '';

        switch (modal) {
            case ModalType.EXIT_MATCH_CONFIRM:
                title = 'LEAVE MATCH?';
                message = 'Are you sure you want to leave the current match?';
                break;

            case ModalType.LEAVE_LOBBY:
                title = 'LEAVE LOBBY?';
                message = 'Are you sure you want to leave this lobby?';
                break;

            case ModalType.DISBAND_LOBBY:
                title = 'DISBAND LOBBY?';
                message = 'This will end the lobby for all players.';
                break;

            case ModalType.DISCARD_CHANGES:
                title = 'DISCARD CHANGES?';
                message = 'You have unsaved changes. Discard them?';
                break;

            case ModalType.ERROR:
                const error = this.navigation.getErrorState();
                title = 'ERROR';
                message = error?.message || 'An error occurred.';
                break;

            default:
                title = 'CONFIRM';
                message = 'Are you sure?';
        }

        // Title
        renderer.drawScreenText(
            title,
            screenWidth / 2,
            panelY + 40,
            'rgba(255, 200, 100, 1)',
            24,
            'center',
            'middle'
        );

        // Message
        renderer.drawScreenText(
            message,
            screenWidth / 2,
            panelY + 85,
            'rgba(200, 205, 215, 1)',
            16,
            'center',
            'middle'
        );

        // Buttons
        const buttonWidth = 100;
        const buttonHeight = 40;
        const buttonY = panelY + panelHeight - 60;

        // Confirm button
        const confirmX = screenWidth / 2 - buttonWidth - 15;
        renderer.drawScreenRect(confirmX, buttonY, buttonWidth, buttonHeight, 'rgba(80, 160, 80, 0.9)');
        renderer.drawScreenRect(confirmX, buttonY, buttonWidth, buttonHeight, undefined, 'rgba(120, 200, 120, 1)', 2);
        renderer.drawScreenText(
            'CONFIRM',
            confirmX + buttonWidth / 2,
            buttonY + buttonHeight / 2,
            'rgba(255, 255, 255, 1)',
            14,
            'center',
            'middle'
        );

        // Cancel button
        const cancelX = screenWidth / 2 + 15;
        renderer.drawScreenRect(cancelX, buttonY, buttonWidth, buttonHeight, 'rgba(140, 60, 60, 0.9)');
        renderer.drawScreenRect(cancelX, buttonY, buttonWidth, buttonHeight, undefined, 'rgba(200, 100, 100, 1)', 2);
        renderer.drawScreenText(
            'CANCEL',
            cancelX + buttonWidth / 2,
            buttonY + buttonHeight / 2,
            'rgba(255, 255, 255, 1)',
            14,
            'center',
            'middle'
        );

        // Hint
        renderer.drawScreenText(
            ctx.isMobile ? 'TAP button to select' : 'ENTER = Confirm • ESC = Cancel',
            screenWidth / 2,
            panelY + panelHeight - 15,
            'rgba(100, 105, 115, 1)',
            12,
            'center',
            'middle'
        );
    }

    /**
     * Start the screen manager with the title screen.
     */
    start(): void {
        // Navigate to title screen
        this.navigation.forceNavigateTo(AppState.TITLE);
    }

    /**
     * Get current app state.
     */
    getCurrentState(): AppState {
        return this.navigation.getCurrentState();
    }

    /**
     * Navigate to a specific state.
     */
    navigateTo(state: AppState): void {
        this.navigation.forceNavigateTo(state);
    }

    /**
     * Check if a modal is active.
     */
    hasActiveModal(): boolean {
        return this.navigation.hasActiveModal();
    }
}
