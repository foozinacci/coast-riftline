// Screen Manager - Orchestrates all UI screens
// Handles screen transitions and input routing

import { Renderer } from '../../core/renderer';
import { getNavigationManager, NavigationManager, NavigationEvent } from '../../core/navigation';
import { AppState, ModalType } from '../../core/types';
import { InputManager } from '../../core/input';
import { BaseScreen, ScreenContext } from './BaseScreen';
import { TitleScreen } from './TitleScreen';
import { MainMenu } from './MainMenu';
import { PlayMenu } from './PlayMenu';
import { PauseMenu } from './PauseMenu';

/**
 * ScreenManager - Central UI orchestrator.
 * Manages screen lifecycle, input routing, and modal display.
 */
export class ScreenManager {
    private navigation: NavigationManager;
    private screens: Map<AppState, BaseScreen>;
    private currentScreen: BaseScreen | null = null;
    private isMobile: boolean;

    constructor(isMobile: boolean) {
        this.isMobile = isMobile;
        this.navigation = getNavigationManager();
        this.screens = new Map();

        // Initialize all screens
        this.initializeScreens();

        // Listen for navigation events
        this.navigation.addListener(this.onNavigationEvent.bind(this));
    }

    private initializeScreens(): void {
        // Register all screens
        this.screens.set(AppState.TITLE, new TitleScreen());
        this.screens.set(AppState.MAIN_MENU, new MainMenu());
        this.screens.set(AppState.PLAY_MENU, new PlayMenu());
        this.screens.set(AppState.PAUSE_MENU, new PauseMenu());

        // TODO: Add more screens as they're implemented
        // this.screens.set(AppState.QUICK_PLAY_SETUP, new QuickPlaySetup());
        // this.screens.set(AppState.LOBBY, new LobbyScreen());
        // this.screens.set(AppState.SETTINGS_ROOT, new SettingsRoot());
        // this.screens.set(AppState.POST_MATCH, new PostMatchScreen());
    }

    private onNavigationEvent(event: NavigationEvent): void {
        // Exit current screen
        if (this.currentScreen) {
            this.currentScreen.onExit();
        }

        // Enter new screen
        const newScreen = this.screens.get(event.to);
        if (newScreen) {
            this.currentScreen = newScreen;
            this.currentScreen.onEnter();
        } else {
            this.currentScreen = null;
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
     * Process input for current screen.
     */
    handleInput(input: InputManager): void {
        // Don't process input if modal is active
        if (this.navigation.hasActiveModal()) {
            this.handleModalInput(input);
            return;
        }

        if (!this.currentScreen) return;

        // Handle confirm
        if (input.consumeConfirm()) {
            this.currentScreen.handleConfirm();
        }

        // Handle back
        if (input.consumeBack()) {
            this.currentScreen.handleBack();
        }

        // Handle focus navigation via keyboard
        const inputState = input.getState();
        if (inputState.moveDirection.y < -0.5) {
            this.currentScreen.navigateFocus('up');
        } else if (inputState.moveDirection.y > 0.5) {
            this.currentScreen.navigateFocus('down');
        } else if (inputState.moveDirection.x < -0.5) {
            this.currentScreen.navigateFocus('left');
        } else if (inputState.moveDirection.x > 0.5) {
            this.currentScreen.navigateFocus('right');
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
        if (!this.currentScreen) return;

        const context: ScreenContext = {
            renderer,
            screenWidth,
            screenHeight,
            focusState: this.navigation.getFocusState(),
            isMobile: this.isMobile,
        };

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
     * Check if a modal is active.
     */
    hasActiveModal(): boolean {
        return this.navigation.hasActiveModal();
    }
}
