// Friends Screen - View and manage friends list
// Allows sending friend requests, viewing pending requests, and managing friends

import { BaseScreen, ScreenContext } from './BaseScreen';
import { AppState } from '../../core/types';
import { supabase, supabaseService } from '../../network/supabase';
import { partyManager } from '../../network/party';

/**
 * Friend relationship status
 */
export type FriendStatus = 'pending' | 'accepted' | 'blocked';

/**
 * Friend data
 */
export interface Friend {
    id: string;
    friendId: string;
    username: string;
    displayName: string;
    status: FriendStatus;
    isOnline?: boolean;
    createdAt: string;
    acceptedAt?: string;
}

/**
 * Friend request data
 */
export interface FriendRequest {
    id: string;
    fromId: string;
    fromUsername: string;
    fromDisplayName: string;
    createdAt: string;
}

export class FriendsScreen extends BaseScreen {
    private animationTime: number = 0;
    private errorMessage: string | null = null;
    private successMessage: string | null = null;
    private isLoading: boolean = false;
    private friendCode: string = '';
    private inputFriendCode: string = '';
    private isInputMode: boolean = false;

    // Data
    private friends: Friend[] = [];
    private pendingRequests: FriendRequest[] = [];
    private outgoingRequests: Friend[] = [];

    // UI state
    private activeTab: 'friends' | 'requests' | 'add' = 'friends';
    private selectedIndex: number = 0;

    constructor() {
        super(AppState.FRIENDS);
    }

    onEnter(): void {
        super.onEnter();
        this.errorMessage = null;
        this.successMessage = null;
        this.isLoading = false;
        this.inputFriendCode = '';
        this.isInputMode = false;
        this.selectedIndex = 0;

        // Get user's friend code
        const user = supabaseService.getCurrentUser();
        if (user?.friend_code) {
            this.friendCode = user.friend_code;
        } else {
            this.friendCode = 'NOT SET';
        }

        // Load data
        this.loadFriends();
        this.loadPendingRequests();
    }

    private async loadFriends(): Promise<void> {
        const user = supabaseService.getCurrentUser();
        if (!user) return;

        try {
            const { data, error } = await supabase
                .from('friends')
                .select('*, friend:profiles!friend_id(*)')
                .eq('player_id', user.id)
                .eq('status', 'accepted');

            if (error) throw error;

            this.friends = (data || []).map(f => ({
                id: f.id,
                friendId: f.friend_id,
                username: f.friend?.username || 'Unknown',
                displayName: f.friend?.display_name || 'Unknown',
                status: f.status,
                isOnline: false, // TODO: Real online status
                createdAt: f.created_at,
                acceptedAt: f.accepted_at,
            }));
        } catch (err) {
            console.error('[FriendsScreen] Error loading friends:', err);
        }
    }

    private async loadPendingRequests(): Promise<void> {
        const user = supabaseService.getCurrentUser();
        if (!user) return;

        try {
            // Incoming requests (where we are friend_id)
            const { data, error } = await supabase
                .from('friends')
                .select('*, sender:profiles!player_id(*)')
                .eq('friend_id', user.id)
                .eq('status', 'pending');

            if (error) throw error;

            this.pendingRequests = (data || []).map(r => ({
                id: r.id,
                fromId: r.player_id,
                fromUsername: r.sender?.username || 'Unknown',
                fromDisplayName: r.sender?.display_name || 'Unknown',
                createdAt: r.created_at,
            }));

            // Outgoing requests
            const { data: outgoing, error: outError } = await supabase
                .from('friends')
                .select('*, friend:profiles!friend_id(*)')
                .eq('player_id', user.id)
                .eq('status', 'pending');

            if (!outError) {
                this.outgoingRequests = (outgoing || []).map(f => ({
                    id: f.id,
                    friendId: f.friend_id,
                    username: f.friend?.username || 'Unknown',
                    displayName: f.friend?.display_name || 'Unknown',
                    status: 'pending' as FriendStatus,
                    createdAt: f.created_at,
                }));
            }
        } catch (err) {
            console.error('[FriendsScreen] Error loading requests:', err);
        }
    }

    private setupButtons(ctx: ScreenContext): void {
        // Tab buttons at top
        const tabY = 100;
        const tabWidth = 100;
        const tabGap = 20;
        const totalTabWidth = tabWidth * 3 + tabGap * 2;
        const tabStartX = (ctx.screenWidth - totalTabWidth) / 2;

        this.clearButtons();

        // Tab buttons
        this.addButton(
            'tab-friends',
            'FRIENDS',
            tabStartX,
            tabY,
            tabWidth,
            40,
            () => { this.activeTab = 'friends'; this.selectedIndex = 0; this.focusableElements = []; },
            false
        );

        this.addButton(
            'tab-requests',
            `REQUESTS${this.pendingRequests.length > 0 ? ` (${this.pendingRequests.length})` : ''}`,
            tabStartX + tabWidth + tabGap,
            tabY,
            tabWidth,
            40,
            () => { this.activeTab = 'requests'; this.selectedIndex = 0; this.focusableElements = []; },
            false
        );

        this.addButton(
            'tab-add',
            'ADD',
            tabStartX + (tabWidth + tabGap) * 2,
            tabY,
            tabWidth,
            40,
            () => { this.activeTab = 'add'; this.selectedIndex = 0; this.focusableElements = []; },
            false
        );

        // Back button
        this.addButton(
            'btn-back',
            'BACK',
            (ctx.screenWidth - 200) / 2,
            ctx.screenHeight - 80,
            200,
            45,
            () => this.handleBack(),
            false
        );

        const elementIds = this.focusableElements.map(el => el.id);
        this.navigation.setFocusableElements(elementIds);
    }

    private async sendFriendRequest(): Promise<void> {
        if (!this.inputFriendCode.trim()) {
            this.errorMessage = 'Please enter a friend code';
            return;
        }

        this.isLoading = true;
        this.errorMessage = null;
        this.successMessage = null;

        try {
            const user = supabaseService.getCurrentUser();
            if (!user) throw new Error('Not logged in');

            // Find user by friend code
            const { data: targetUser, error: findError } = await supabase
                .from('profiles')
                .select('id, username')
                .eq('friend_code', this.inputFriendCode.toUpperCase().trim())
                .single();

            if (findError || !targetUser) {
                throw new Error('Friend code not found');
            }

            if (targetUser.id === user.id) {
                throw new Error("You can't add yourself");
            }

            // Check if already friends or pending
            const { data: existing } = await supabase
                .from('friends')
                .select('*')
                .or(`and(player_id.eq.${user.id},friend_id.eq.${targetUser.id}),and(player_id.eq.${targetUser.id},friend_id.eq.${user.id})`);

            if (existing && existing.length > 0) {
                const status = existing[0].status;
                if (status === 'accepted') {
                    throw new Error('Already friends');
                } else if (status === 'pending') {
                    throw new Error('Request already pending');
                }
            }

            // Create friend request
            const { error: insertError } = await supabase
                .from('friends')
                .insert({
                    player_id: user.id,
                    friend_id: targetUser.id,
                    status: 'pending',
                });

            if (insertError) throw insertError;

            this.successMessage = `Friend request sent to ${targetUser.username}`;
            this.inputFriendCode = '';
            this.loadPendingRequests();
        } catch (err: unknown) {
            this.errorMessage = (err as Error).message || 'Failed to send request';
        }

        this.isLoading = false;
    }

    private async acceptRequest(requestId: string): Promise<void> {
        this.isLoading = true;
        this.errorMessage = null;

        try {
            const user = supabaseService.getCurrentUser();
            if (!user) throw new Error('Not logged in');

            // Find the request
            const request = this.pendingRequests.find(r => r.id === requestId);
            if (!request) throw new Error('Request not found');

            // Update to accepted
            const { error: updateError } = await supabase
                .from('friends')
                .update({ status: 'accepted', accepted_at: new Date().toISOString() })
                .eq('id', requestId);

            if (updateError) throw updateError;

            // Create reverse friendship
            const { error: insertError } = await supabase
                .from('friends')
                .insert({
                    player_id: user.id,
                    friend_id: request.fromId,
                    status: 'accepted',
                    accepted_at: new Date().toISOString(),
                });

            if (insertError) throw insertError;

            this.successMessage = `Accepted friend request from ${request.fromDisplayName}`;
            this.loadFriends();
            this.loadPendingRequests();
        } catch (err: unknown) {
            this.errorMessage = (err as Error).message || 'Failed to accept request';
        }

        this.isLoading = false;
    }

    private async declineRequest(requestId: string): Promise<void> {
        this.isLoading = true;
        this.errorMessage = null;

        try {
            const { error } = await supabase
                .from('friends')
                .delete()
                .eq('id', requestId);

            if (error) throw error;

            this.successMessage = 'Request declined';
            this.loadPendingRequests();
        } catch (err: unknown) {
            this.errorMessage = (err as Error).message || 'Failed to decline request';
        }

        this.isLoading = false;
    }

    private async inviteToParty(friendId: string): Promise<void> {
        try {
            await partyManager.inviteFriend(friendId);
            this.successMessage = 'Party invite sent';
        } catch (err: unknown) {
            this.errorMessage = (err as Error).message || 'Failed to send invite';
        }
    }

    private async removeFriend(friendId: string): Promise<void> {
        const user = supabaseService.getCurrentUser();
        if (!user) return;

        this.isLoading = true;
        this.errorMessage = null;

        try {
            // Delete both direction friendships
            await supabase
                .from('friends')
                .delete()
                .or(`and(player_id.eq.${user.id},friend_id.eq.${friendId}),and(player_id.eq.${friendId},friend_id.eq.${user.id})`);

            this.successMessage = 'Friend removed';
            this.loadFriends();
        } catch (err: unknown) {
            this.errorMessage = (err as Error).message || 'Failed to remove friend';
        }

        this.isLoading = false;
    }

    private copyFriendCode(): void {
        if (this.friendCode && this.friendCode !== 'NOT SET') {
            navigator.clipboard.writeText(this.friendCode).then(() => {
                this.successMessage = 'Friend code copied!';
                setTimeout(() => { this.successMessage = null; }, 2000);
            }).catch(() => {
                this.errorMessage = 'Failed to copy';
            });
        }
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
            'FRIENDS',
            screenWidth / 2,
            45,
            'rgba(100, 200, 255, 1)',
            32,
            'center',
            'middle'
        );

        // Friend code display
        const codeBoxWidth = 200;
        const codeBoxX = (screenWidth - codeBoxWidth) / 2;
        renderer.drawScreenRect(codeBoxX, 60, codeBoxWidth, 30, 'rgba(40, 50, 60, 0.6)');
        renderer.drawScreenText(
            `Your Code: ${this.friendCode}`,
            screenWidth / 2,
            75,
            'rgba(150, 255, 150, 1)',
            12,
            'center',
            'middle'
        );

        // Render tabs (using buttons)
        this.renderButtons(ctx);

        // Render tab content
        const contentY = 160;
        const contentHeight = screenHeight - 260;

        // Content background
        renderer.drawScreenRect(
            40,
            contentY,
            screenWidth - 80,
            contentHeight,
            'rgba(30, 35, 45, 0.8)',
            'rgba(60, 70, 80, 0.5)',
            1
        );

        switch (this.activeTab) {
            case 'friends':
                this.renderFriendsList(ctx, contentY + 10, contentHeight - 20);
                break;
            case 'requests':
                this.renderRequests(ctx, contentY + 10, contentHeight - 20);
                break;
            case 'add':
                this.renderAddFriend(ctx, contentY + 10, contentHeight - 20);
                break;
        }

        // Messages
        if (this.errorMessage) {
            renderer.drawScreenText(
                this.errorMessage,
                screenWidth / 2,
                screenHeight - 120,
                'rgba(255, 100, 100, 1)',
                14,
                'center',
                'middle'
            );
        }

        if (this.successMessage) {
            renderer.drawScreenText(
                this.successMessage,
                screenWidth / 2,
                screenHeight - 120,
                'rgba(100, 255, 100, 1)',
                14,
                'center',
                'middle'
            );
        }

        // Loading
        if (this.isLoading) {
            renderer.drawScreenRect(0, 0, screenWidth, screenHeight, 'rgba(0, 0, 0, 0.5)');
            renderer.drawScreenText(
                'Loading...',
                screenWidth / 2,
                screenHeight / 2,
                'rgba(255, 255, 255, 0.9)',
                18,
                'center',
                'middle'
            );
        }

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

    private renderFriendsList(ctx: ScreenContext, startY: number, height: number): void {
        const { renderer, screenWidth } = ctx;
        const itemHeight = 50;
        const padding = 20;

        if (this.friends.length === 0) {
            renderer.drawScreenText(
                'No friends yet',
                screenWidth / 2,
                startY + height / 2 - 20,
                'rgba(150, 155, 165, 1)',
                16,
                'center',
                'middle'
            );
            renderer.drawScreenText(
                'Add friends using the ADD tab',
                screenWidth / 2,
                startY + height / 2 + 10,
                'rgba(100, 105, 115, 1)',
                12,
                'center',
                'middle'
            );
            return;
        }

        for (let i = 0; i < Math.min(this.friends.length, 6); i++) {
            const friend = this.friends[i];
            const y = startY + i * itemHeight + padding;

            // Background
            renderer.drawScreenRect(
                60,
                y,
                screenWidth - 120,
                itemHeight - 5,
                'rgba(40, 45, 55, 0.6)'
            );

            // Online indicator
            const onlineColor = friend.isOnline ? 'rgba(100, 255, 100, 1)' : 'rgba(100, 100, 100, 1)';
            this.drawScreenCircle(renderer, 80, y + (itemHeight - 5) / 2, 6, onlineColor);

            // Name
            renderer.drawScreenText(
                friend.displayName,
                100,
                y + (itemHeight - 5) / 2,
                'rgba(220, 220, 220, 1)',
                14,
                'left',
                'middle'
            );

            // Username
            renderer.drawScreenText(
                `@${friend.username}`,
                100,
                y + (itemHeight - 5) / 2 + 15,
                'rgba(120, 125, 135, 1)',
                10,
                'left',
                'middle'
            );

            // Action buttons (Invite / Remove)
            // These would be interactive in a full implementation
            renderer.drawScreenText(
                'INVITE',
                screenWidth - 150,
                y + (itemHeight - 5) / 2,
                'rgba(100, 200, 255, 1)',
                12,
                'center',
                'middle'
            );
        }
    }

    private renderRequests(ctx: ScreenContext, startY: number, height: number): void {
        const { renderer, screenWidth } = ctx;
        const itemHeight = 60;
        const padding = 20;

        if (this.pendingRequests.length === 0 && this.outgoingRequests.length === 0) {
            renderer.drawScreenText(
                'No pending requests',
                screenWidth / 2,
                startY + height / 2,
                'rgba(150, 155, 165, 1)',
                16,
                'center',
                'middle'
            );
            return;
        }

        // Incoming
        if (this.pendingRequests.length > 0) {
            renderer.drawScreenText(
                'INCOMING REQUESTS',
                70,
                startY + 10,
                'rgba(100, 200, 255, 1)',
                12,
                'left',
                'top'
            );

            for (let i = 0; i < Math.min(this.pendingRequests.length, 3); i++) {
                const request = this.pendingRequests[i];
                const y = startY + 30 + i * itemHeight + padding;

                // Background
                renderer.drawScreenRect(
                    60,
                    y,
                    screenWidth - 120,
                    itemHeight - 5,
                    'rgba(40, 60, 40, 0.6)',
                    'rgba(100, 200, 100, 0.3)',
                    1
                );

                // Name
                renderer.drawScreenText(
                    request.fromDisplayName,
                    80,
                    y + 15,
                    'rgba(220, 220, 220, 1)',
                    14,
                    'left',
                    'middle'
                );

                // Username
                renderer.drawScreenText(
                    `@${request.fromUsername}`,
                    80,
                    y + 35,
                    'rgba(120, 125, 135, 1)',
                    10,
                    'left',
                    'middle'
                );

                // Accept/Decline buttons
                renderer.drawScreenText(
                    '✓ ACCEPT',
                    screenWidth - 180,
                    y + (itemHeight - 5) / 2,
                    'rgba(100, 255, 100, 1)',
                    12,
                    'center',
                    'middle'
                );

                renderer.drawScreenText(
                    '✕ DECLINE',
                    screenWidth - 90,
                    y + (itemHeight - 5) / 2,
                    'rgba(255, 100, 100, 1)',
                    12,
                    'center',
                    'middle'
                );
            }
        }

        // Outgoing
        if (this.outgoingRequests.length > 0) {
            const outgoingStartY = startY + (this.pendingRequests.length > 0 ? 30 + this.pendingRequests.length * itemHeight + 40 : 10);

            renderer.drawScreenText(
                'SENT REQUESTS',
                70,
                outgoingStartY,
                'rgba(255, 200, 100, 1)',
                12,
                'left',
                'top'
            );

            for (let i = 0; i < Math.min(this.outgoingRequests.length, 2); i++) {
                const request = this.outgoingRequests[i];
                const y = outgoingStartY + 20 + i * 40 + padding;

                renderer.drawScreenRect(
                    60,
                    y,
                    screenWidth - 120,
                    35,
                    'rgba(60, 50, 40, 0.6)'
                );

                renderer.drawScreenText(
                    `${request.displayName} - Pending`,
                    80,
                    y + 17,
                    'rgba(180, 180, 180, 1)',
                    12,
                    'left',
                    'middle'
                );
            }
        }
    }

    private renderAddFriend(ctx: ScreenContext, startY: number, height: number): void {
        const { renderer, screenWidth } = ctx;
        const centerX = screenWidth / 2;

        // Instructions
        renderer.drawScreenText(
            'Enter a friend code to send a request',
            centerX,
            startY + 30,
            'rgba(180, 185, 195, 1)',
            14,
            'center',
            'middle'
        );

        // Input field
        const inputWidth = 200;
        const inputX = (screenWidth - inputWidth) / 2;
        const inputY = startY + 70;

        renderer.drawScreenRect(
            inputX,
            inputY,
            inputWidth,
            45,
            this.isInputMode ? 'rgba(60, 80, 100, 0.8)' : 'rgba(40, 45, 55, 0.8)',
            this.isInputMode ? 'rgba(100, 180, 255, 1)' : 'rgba(80, 85, 95, 1)',
            2
        );

        renderer.drawScreenText(
            this.inputFriendCode || 'Enter code...',
            centerX,
            inputY + 22,
            this.inputFriendCode ? 'rgba(255, 255, 255, 1)' : 'rgba(100, 105, 115, 1)',
            16,
            'center',
            'middle'
        );

        // Send button
        const btnY = inputY + 60;
        renderer.drawScreenRect(
            (screenWidth - 150) / 2,
            btnY,
            150,
            40,
            'rgba(60, 120, 200, 0.8)',
            'rgba(100, 180, 255, 0.5)',
            2
        );

        renderer.drawScreenText(
            'SEND REQUEST',
            centerX,
            btnY + 20,
            'rgba(255, 255, 255, 1)',
            14,
            'center',
            'middle'
        );

        // Copy your code button
        const copyY = btnY + 70;
        renderer.drawScreenText(
            'Share your friend code with others:',
            centerX,
            copyY,
            'rgba(120, 125, 135, 1)',
            12,
            'center',
            'middle'
        );

        renderer.drawScreenRect(
            (screenWidth - 180) / 2,
            copyY + 15,
            180,
            35,
            'rgba(40, 80, 60, 0.8)',
            'rgba(100, 255, 150, 0.5)',
            1
        );

        renderer.drawScreenText(
            `📋 COPY: ${this.friendCode}`,
            centerX,
            copyY + 32,
            'rgba(150, 255, 150, 1)',
            12,
            'center',
            'middle'
        );
    }

    private renderBackgroundGrid(ctx: ScreenContext): void {
        const { renderer, screenWidth, screenHeight } = ctx;
        const gridSize = 50;
        const offset = (this.animationTime * 3) % gridSize;

        for (let x = -gridSize + offset; x < screenWidth + gridSize; x += gridSize) {
            this.drawScreenLine(renderer, x, 0, x, screenHeight, 'rgba(40, 50, 60, 0.15)', 1);
        }
        for (let y = -gridSize + offset; y < screenHeight + gridSize; y += gridSize) {
            this.drawScreenLine(renderer, 0, y, screenWidth, y, 'rgba(40, 50, 60, 0.15)', 1);
        }
    }

    handleBack(): void {
        this.navigation.goBack();
    }
}
