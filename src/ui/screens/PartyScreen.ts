// Party Screen - Manage party and friends for queueing together
// Allows creating/joining parties and inviting friends

import { BaseScreen, ScreenContext } from './BaseScreen';
import { AppState } from '../../core/types';
import { partyManager, PartyMember, PartyStatus } from '../../network/party';
import { supabaseService } from '../../network/supabase';

export class PartyScreen extends BaseScreen {
    private animationTime: number = 0;
    private errorMessage: string | null = null;
    private isLoading: boolean = false;
    private friendCode: string = '';
    private joinCode: string = '';
    private isInputMode: boolean = false;

    constructor() {
        super(AppState.PARTY);
    }

    onEnter(): void {
        super.onEnter();
        this.errorMessage = null;
        this.isLoading = false;

        // Get user's friend code
        const user = supabaseService.getCurrentUser();
        if (user?.friend_code) {
            this.friendCode = user.friend_code;
        } else {
            this.friendCode = 'NOT SET';
        }
    }

    private setupButtons(ctx: ScreenContext): void {
        const party = partyManager.getCurrentParty();

        if (party) {
            // In party - show party management buttons
            this.layoutButtonsVertical([
                {
                    id: 'btn-invite',
                    label: 'INVITE FRIEND',
                    onSelect: () => this.showInviteInput(),
                },
                {
                    id: 'btn-ready',
                    label: partyManager.isLeader() ? 'START QUEUE' : 'TOGGLE READY',
                    onSelect: () => this.handleReadyOrQueue(),
                },
                {
                    id: 'btn-leave',
                    label: partyManager.isLeader() ? 'DISBAND PARTY' : 'LEAVE PARTY',
                    onSelect: () => this.handleLeaveParty(),
                },
                {
                    id: 'btn-back',
                    label: 'BACK',
                    onSelect: () => this.handleBack(),
                },
            ], ctx, ctx.screenHeight * 0.55);
        } else {
            // Not in party - show create/join buttons
            this.layoutButtonsVertical([
                {
                    id: 'btn-create',
                    label: 'CREATE PARTY',
                    onSelect: () => this.createParty(),
                },
                {
                    id: 'btn-join',
                    label: 'JOIN PARTY',
                    onSelect: () => this.showJoinInput(),
                },
                {
                    id: 'btn-back',
                    label: 'BACK',
                    onSelect: () => this.handleBack(),
                },
            ], ctx, ctx.screenHeight * 0.45);
        }
    }

    private async createParty(): Promise<void> {
        this.isLoading = true;
        this.errorMessage = null;

        try {
            const party = await partyManager.createParty();
            if (party) {
                // Refresh buttons
                this.focusableElements = [];
            } else {
                this.errorMessage = 'Failed to create party';
            }
        } catch (err) {
            this.errorMessage = 'Error creating party';
            console.error(err);
        }

        this.isLoading = false;
    }

    private showInviteInput(): void {
        this.isInputMode = true;
        // In a real implementation, this would show a text input for party ID
        // For now, just log
        console.log('Show invite input');
    }

    private showJoinInput(): void {
        this.isInputMode = true;
        // In a real implementation, this would show a text input for party ID
        console.log('Show join input');
    }

    private async handleReadyOrQueue(): Promise<void> {
        if (partyManager.isLeader()) {
            if (partyManager.canQueue()) {
                await partyManager.startQueue();
                this.navigation.navigateTo(AppState.MATCHMAKING);
            } else {
                this.errorMessage = 'Not all members are ready';
            }
        } else {
            const member = partyManager.getCurrentParty()?.members.find(
                m => m.playerId === supabaseService.getCurrentUser()?.id
            );
            await partyManager.setReady(!member?.isReady);
            // Refresh buttons
            this.focusableElements = [];
        }
    }

    private async handleLeaveParty(): Promise<void> {
        this.isLoading = true;

        try {
            if (partyManager.isLeader()) {
                await partyManager.disbandParty();
            } else {
                await partyManager.leaveParty();
            }
            // Refresh buttons
            this.focusableElements = [];
        } catch (err) {
            this.errorMessage = 'Error leaving party';
            console.error(err);
        }

        this.isLoading = false;
    }

    render(ctx: ScreenContext): void {
        const { renderer, screenWidth, screenHeight } = ctx;
        this.animationTime += 0.016;

        // Rebuild buttons if list is empty
        if (this.focusableElements.length === 0) {
            this.setupButtons(ctx);
        }

        // Background
        renderer.drawScreenRect(0, 0, screenWidth, screenHeight, 'rgba(15, 18, 25, 1)');
        this.renderBackgroundGrid(ctx);

        // Title
        renderer.drawScreenText(
            'PARTY',
            screenWidth / 2,
            50,
            'rgba(100, 200, 255, 1)',
            36,
            'center',
            'middle'
        );

        // Friend code display
        renderer.drawScreenText(
            `Your Friend Code: ${this.friendCode}`,
            screenWidth / 2,
            90,
            'rgba(150, 200, 150, 1)',
            14,
            'center',
            'middle'
        );

        // Party info or status
        const party = partyManager.getCurrentParty();
        if (party) {
            this.renderPartyInfo(ctx, party.members, party.status);
        } else {
            renderer.drawScreenText(
                'Not in a party',
                screenWidth / 2,
                screenHeight * 0.3,
                'rgba(150, 155, 165, 1)',
                18,
                'center',
                'middle'
            );

            renderer.drawScreenText(
                'Create or join a party to queue with friends',
                screenWidth / 2,
                screenHeight * 0.35,
                'rgba(100, 105, 115, 1)',
                14,
                'center',
                'middle'
            );
        }

        // Error message
        if (this.errorMessage) {
            renderer.drawScreenText(
                this.errorMessage,
                screenWidth / 2,
                screenHeight - 80,
                'rgba(255, 100, 100, 1)',
                14,
                'center',
                'middle'
            );
        }

        // Loading indicator
        if (this.isLoading) {
            renderer.drawScreenText(
                'Loading...',
                screenWidth / 2,
                screenHeight / 2,
                'rgba(255, 255, 255, 0.8)',
                18,
                'center',
                'middle'
            );
        }

        // Render buttons
        this.renderButtons(ctx);

        // Footer hint
        const hintText = ctx.isMobile
            ? 'TAP to select • BACK to return'
            : 'ENTER to select • ESC to go back';

        renderer.drawScreenText(
            hintText,
            screenWidth / 2,
            screenHeight - 30,
            'rgba(100, 105, 115, 1)',
            12,
            'center',
            'middle'
        );
    }

    private renderPartyInfo(ctx: ScreenContext, members: PartyMember[], status: PartyStatus): void {
        const { renderer, screenWidth, screenHeight } = ctx;

        // Party status
        let statusColor = 'rgba(150, 155, 165, 1)';
        let statusText = 'IDLE';

        if (status === PartyStatus.QUEUED) {
            statusColor = 'rgba(255, 200, 100, 1)';
            statusText = 'IN QUEUE';
        } else if (status === PartyStatus.IN_LOBBY) {
            statusColor = 'rgba(100, 255, 100, 1)';
            statusText = 'IN LOBBY';
        } else if (status === PartyStatus.IN_MATCH) {
            statusColor = 'rgba(100, 200, 255, 1)';
            statusText = 'IN MATCH';
        }

        renderer.drawScreenText(
            statusText,
            screenWidth / 2,
            120,
            statusColor,
            16,
            'center',
            'middle'
        );

        // Member list
        const startY = 160;
        const memberHeight = 40;

        for (let i = 0; i < members.length; i++) {
            const member = members[i];
            const y = startY + i * memberHeight;

            // Background
            const bgColor = member.isLeader
                ? 'rgba(80, 120, 80, 0.3)'
                : 'rgba(40, 45, 55, 0.5)';
            renderer.drawScreenRect(
                screenWidth / 2 - 150,
                y - 15,
                300,
                35,
                bgColor
            );

            // Name
            const nameColor = member.isLeader
                ? 'rgba(150, 255, 150, 1)'
                : 'rgba(200, 205, 215, 1)';
            renderer.drawScreenText(
                member.displayName || member.username,
                screenWidth / 2 - 130,
                y,
                nameColor,
                14,
                'left',
                'middle'
            );

            // Leader badge
            if (member.isLeader) {
                renderer.drawScreenText(
                    '★',
                    screenWidth / 2 - 145,
                    y,
                    'rgba(255, 200, 100, 1)',
                    14,
                    'center',
                    'middle'
                );
            }

            // Ready status
            const readyText = member.isReady ? '✓ READY' : 'NOT READY';
            const readyColor = member.isReady
                ? 'rgba(100, 255, 100, 1)'
                : 'rgba(150, 155, 165, 1)';
            renderer.drawScreenText(
                readyText,
                screenWidth / 2 + 100,
                y,
                readyColor,
                12,
                'center',
                'middle'
            );
        }

        // Party ID (for inviting)
        const party = partyManager.getCurrentParty();
        if (party) {
            renderer.drawScreenText(
                `Party ID: ${party.id.slice(0, 8)}...`,
                screenWidth / 2,
                startY + members.length * memberHeight + 20,
                'rgba(100, 105, 115, 1)',
                12,
                'center',
                'middle'
            );
        }
    }

    private renderBackgroundGrid(ctx: ScreenContext): void {
        const { renderer, screenWidth, screenHeight } = ctx;

        const gridSize = 60;
        const offset = (this.animationTime * 5) % gridSize;

        for (let x = -gridSize + offset; x < screenWidth + gridSize; x += gridSize) {
            this.drawScreenLine(renderer, x, 0, x, screenHeight, 'rgba(40, 50, 60, 0.2)', 1);
        }
        for (let y = -gridSize + offset; y < screenHeight + gridSize; y += gridSize) {
            this.drawScreenLine(renderer, 0, y, screenWidth, y, 'rgba(40, 50, 60, 0.2)', 1);
        }
    }

    handleBack(): void {
        // Leave party if in one? Or just go back?
        this.navigation.goBack();
    }
}
