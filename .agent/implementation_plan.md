# RIFTLINE Navigation & UI Specification Implementation Plan

## Overview

This document tracks the implementation of the comprehensive UI/UX and navigation specification for RIFTLINE. The specification defines:

- **A. Global Navigation & Input Principles** - Universal input model, focus management, modal rules, error handling, zoom behavior
- **B. High-Level App States** - 23+ distinct states with explicit IN/OUT/BACK transitions
- **K. Navigation Stack Rules** - Every screen push records its caller
- **L. Acceptance Criteria** - Testable requirements

---

## Completed Work ✅

### 1. Merge Conflict Resolution
- [x] Fixed `types.ts` merge conflicts
- [x] Fixed `input.ts` merge conflicts
- [x] Fixed `Game.ts` merge conflicts

### 2. Core Type Definitions (`src/core/types.ts`)
- [x] `AppState` enum - All 23+ states per specification B
- [x] `ModalType` enum - Error, confirmation, and discard modals
- [x] `NavigationEntry` interface - Tracks caller for navigation stack
- [x] `ErrorState` interface - Per specification A5
- [x] `FocusState` interface - Per specification A2
- [x] `InputAction` interface - Universal input model per A1
- [x] Updated `InputState` with `confirm` and `back` actions

### 3. Input System (`src/core/input.ts`)
- [x] `InputBindings` interface - Full rebindability per A6
- [x] Default bindings for MKB, controller, mobile
- [x] Confirm/Back action handling
- [x] `consumeBack()` method
- [x] `setPinchToZoomEnabled()` - Accessibility setting per A6
- [x] Mouse wheel zoom respects bindings (silent no-op if disabled)
- [x] Pinch-to-zoom OFF by default per A6

### 4. Navigation Manager (`src/core/navigation.ts`)
- [x] State transition map for all 23+ states
- [x] `navigateTo()` with validation
- [x] `goBack()` with modal interception
- [x] Navigation stack with caller tracking
- [x] Focus state management
- [x] Modal handling (show, dismiss, confirm)
- [x] Error state management
- [x] Dirty state for unsaved changes detection
- [x] Event listener system

---

## Remaining Work 📋

### Phase 1: Menu Screens (Priority: High)

#### 1.1 Title Screen
- [ ] Create `TitleScreen` UI component
- [ ] "Press Start / Click" to enter Main Menu
- [ ] Settings shortcut
- [ ] Exit confirm on Back
- [ ] Initial focus setup

#### 1.2 Main Menu
- [ ] Create `MainMenu` UI component
- [ ] Options: Play, Training, Customize, Settings, Credits, Exit
- [ ] Focus navigation with visible highlight
- [ ] Controller support
- [ ] Exit confirm modal

#### 1.3 Play Menu
- [ ] Create `PlayMenu` UI component
- [ ] Options: Quick Play, Custom Game, Private Match, Back
- [ ] Focus navigation

#### 1.4 Settings Root
- [ ] Create `SettingsRoot` UI component
- [ ] Tabs/sections: Controls, Gameplay, Audio, Video, Accessibility
- [ ] Return to caller (context-aware)

#### 1.5 Controls Menu
- [ ] Create `ControlsMenu` UI component
- [ ] MKB Bindings option
- [ ] Controller Bindings option
- [ ] Back navigation

#### 1.6 Bindings Screens
- [ ] Create `MKBBindings` component
- [ ] Create `ControllerBindings` component
- [ ] Dirty state detection
- [ ] Discard changes modal on back if dirty
- [ ] Save/Test/Back actions

### Phase 2: Lobby & Matchmaking (Priority: High)

#### 2.1 Lobby Screen
- [ ] Create `LobbyScreen` UI component
- [ ] Host/Client distinction
- [ ] Start Match button (Host only)
- [ ] Leave Lobby confirmation modal (Client)
- [ ] Disband Lobby confirmation modal (Host)
- [ ] Ready state display

#### 2.2 Matchmaking Screen
- [ ] Create `MatchmakingScreen` UI component
- [ ] Cancel button returns to caller
- [ ] Loading/searching animation
- [ ] Error handling with retry

#### 2.3 Connecting Screen
- [ ] Create `ConnectingScreen` UI component
- [ ] Cancel functionality
- [ ] Error handling

### Phase 3: In-Match UI (Priority: High)

#### 3.1 Pause Menu
- [ ] Create `PauseMenu` UI component
- [ ] Resume option (Back also resumes)
- [ ] Settings option
- [ ] Leave Match option
- [ ] Focus management

#### 3.2 Exit Match Confirmation
- [ ] Create `ExitMatchConfirm` modal
- [ ] Confirm → Main Menu
- [ ] Cancel → Return to previous state

#### 3.3 Death/Respawn Overlay
- [ ] Create `DeathOverlay` UI component
- [ ] Respawn timer display
- [ ] Back opens Pause (if allowed)

#### 3.4 Post-Match Screen
- [ ] Create `PostMatchScreen` UI component
- [ ] Stats display
- [ ] Play Again option
- [ ] Back to Menu option

### Phase 4: Error Handling (Priority: Critical)

#### 4.1 Error Modal
- [ ] Create `ErrorModal` component
- [ ] Clear error message display
- [ ] Try Again action
- [ ] Back action
- [ ] Copy/Report Error Code (optional)
- [ ] Focus trap

#### 4.2 Disconnect/Reconnect Screen
- [ ] Create `DisconnectScreen` UI component
- [ ] Reconnect button
- [ ] Back to Main Menu option
- [ ] Auto-reconnect with timeout

### Phase 5: Zoom System (Priority: Medium)

#### 5.1 Zoom Rebinding UI
- [ ] Zoom In/Zoom Out in bindings screens
- [ ] Controller: D-Pad Up/Down defaults
- [ ] Test mode for bindings

#### 5.2 Mobile Zoom Buttons
- [ ] Create Zoom +/- UI buttons for mobile
- [ ] Position consistently (bottom-right area)
- [ ] Respect zoom limits (minZoom, maxZoom)

#### 5.3 Accessibility: Pinch-to-Zoom Toggle
- [ ] Add toggle in Accessibility settings
- [ ] Persist setting
- [ ] Update InputManager dynamically

### Phase 6: Focus & Controller Support (Priority: Medium)

#### 6.1 Visible Focus Highlight
- [ ] CSS/Canvas focus indicator style
- [ ] Consistent across all screens

#### 6.2 Controller Navigation
- [ ] D-Pad/Left Stick navigation
- [ ] A/Cross for confirm
- [ ] B/Circle for back/cancel
- [ ] Start/Options for pause

#### 6.3 Focus Restoration
- [ ] Save focus per screen
- [ ] Restore when returning to screen

### Phase 7: Testing & Validation (Priority: High)

#### 7.1 Navigation Flow Tests
- [ ] Test all state transitions
- [ ] Test back behavior for each screen
- [ ] Test modal dismissal before navigation

#### 7.2 Input Parity Tests
- [ ] Keyboard/Mouse tests
- [ ] Controller tests (if available)
- [ ] Touch tests (mobile simulation)

#### 7.3 Error State Tests
- [ ] Simulate failed matchmaking
- [ ] Simulate disconnect
- [ ] Verify no stranded states

---

## Architecture Notes

### State Machine Pattern
The `NavigationManager` implements a finite state machine with:
- **States**: Defined in `AppState` enum
- **Transitions**: Validated via `stateTransitions` map
- **Stack**: Maintains caller chain for proper Back behavior

### Modal Handling
Modals are overlays that:
1. Trap focus (no navigation while active)
2. Must be dismissed before screen navigation
3. Have explicit Confirm and Cancel actions

### Focus System
Every screen must:
1. Register focusable elements via `setFocusableElements()`
2. Have deterministic initial focus (first element)
3. Save/restore focus when navigating away/back

---

## File Structure

```
src/
├── core/
│   ├── types.ts         # ✅ Updated with AppState, Modal types
│   ├── input.ts         # ✅ Updated with rebindable inputs
│   ├── navigation.ts    # ✅ NEW - NavigationManager
│   └── index.ts         # ✅ Updated exports
├── ui/
│   ├── HUD.ts           # Existing - needs integration
│   ├── screens/         # TODO - Screen components
│   │   ├── TitleScreen.ts
│   │   ├── MainMenu.ts
│   │   ├── PlayMenu.ts
│   │   ├── LobbyScreen.ts
│   │   ├── PauseMenu.ts
│   │   ├── PostMatchScreen.ts
│   │   └── SettingsRoot.ts
│   ├── modals/          # TODO - Modal components
│   │   ├── ErrorModal.ts
│   │   ├── ConfirmModal.ts
│   │   └── DiscardModal.ts
│   └── components/      # TODO - Reusable UI components
│       ├── Button.ts
│       ├── FocusableList.ts
│       └── ZoomButtons.ts
└── game/
    └── Game.ts          # ✅ Fixed conflicts, needs NavigationManager integration
```

---

## Next Steps

1. **Create screen rendering system** - Abstract UI screen class
2. **Integrate NavigationManager with Game.ts** - Replace direct GamePhase usage
3. **Build Title Screen** - First full screen implementation
4. **Build Main Menu** - Core navigation hub
5. **Add modal system** - Focus-trapping confirmation dialogs

---

## Acceptance Criteria Checklist (Per Spec L)

- [ ] Every screen has a valid IN and OUT
- [ ] Back behavior is consistent and predictable
- [ ] Zoom is never accidental and is fully rebindable
- [ ] Controller navigation works everywhere with visible focus
- [ ] Errors and disconnects never freeze the player
- [ ] Leaving lobbies or matches always requires confirmation
