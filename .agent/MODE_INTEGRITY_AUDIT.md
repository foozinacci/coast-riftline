# RIFTLINE Game Mode Integrity Audit
Generated: 2025-12-17 (Updated with Full Spec)

## Recent Fixes Applied

### ✅ Fixed Issues
1. **Duplicate Timer Display** - Removed timer rendering from Riftline.ts (HUD handles it)
2. **Mobile Start Loop** - Added `isMatchActive` guard to prevent double-start on tap
3. **Pinch Zoom** - Disabled per spec A6 (zoom via +/- buttons only)
4. **Arena Round System** - New system created at `src/systems/ArenaRoundSystem.ts`
5. **Party System** - New system created at `src/network/party.ts`
6. **Database Migration** - New migration at `supabase/migration_matchmaking.sql`

---

## Spec Reference: Shared Core Systems (ALL Modes)

### Core Combat & Movement (Non-Negotiable)
| Requirement | Status | Notes |
|-------------|--------|-------|
| Top-down perspective | ✅ Implemented | `Renderer.ts` |
| Manual aim only (no autofire baseline) | ✅ Implemented | `input.ts` |
| Manual reload (rarity exceptions) | ✅ Implemented | Weapon system |
| Cover-based gameplay | ⚠️ Partial | Obstacles exist, cover not formalized |
| Verticality via obstacles | ⚠️ Partial | Map generation has obstacles |

### Health & Survival
| Requirement | Status | Notes |
|-------------|--------|-------|
| Health + Shields | ✅ Implemented | Player class |
| Shields absorb first | ✅ Implemented | Damage calculation |
| Passive health regen (2-3s delay) | ✅ Implemented | `HealingSystem.ts` |
| Regen stops on damage/firing/objective | ✅ Implemented | HealingSystem checks |
| Shields don't regen passively (unless boosted) | ✅ Implemented | Only health regens |

### Respawn System (Wildcard-Inspired)
| Requirement | Status | Notes |
|-------------|--------|-------|
| Respawn while teammate alive | ✅ Implemented | `RespawnSystem.ts` |
| Respawn near safest teammate | ✅ Implemented | Position calculation |
| Never in enemy line of sight | ⚠️ Approximate | Checks proximity |
| Cooldown increases per phase | ⚠️ Basic | Needs phase tie-in |
| Orb collection reduces cooldown | ✅ Implemented | Orb economy |
| Respawn beacons (one-time) | ✅ Implemented | Beacon objects |

### Ring / Riftline Logic
| Requirement | Status | Notes |
|-------------|--------|-------|
| Ring always exists | ✅ Implemented | `Riftline.ts` |
| Entering ring = damage | ✅ Implemented | Environment damage |
| Layered rings = higher damage | ✅ Implemented | `RiftlineEscalation.ts` |
| Rings force forward momentum | ✅ Design correct | Convergence on vault |

---

## Current Mode Status Summary

| Mode | Config | Offline/Bots | Online Ready | Issues |
|------|--------|--------------|--------------|--------|
| MAIN | ✅ | ✅ Fixed | ❌ Not wired | - |
| ARENA 1v1 | ✅ | ✅ Fixed | ❌ Not wired | Round system ready |
| ARENA 1v1v1 | ✅ | ✅ Fixed | ❌ Not wired | Round system ready |
| ARENA 3v3 | ✅ | ✅ Fixed | ❌ Not wired | Round system ready |
| ARENA 3v3v3 | ✅ | ✅ Fixed | ❌ Not wired | Round system ready |
| TRAINING | ✅ | ✅ Fixed | N/A (Solo) | - |

---

## Critical Issues Found

### 1. ❌ Game Not Starting (Mobile Loop Issue)
**Symptom:** Tap Start → Game loops back to Title screen
**Location:** `QuickPlaySetup.ts`, `ScreenManager.ts`, `Game.ts`
**Root Cause:** Unknown - needs debug logs review

### 2. ❌ Online Lobbies Not Connected
**Current State:** 
- `PrivateMatch.ts` creates lobbies with Supabase
- BUT these lobbies are NOT connected to actual multiplayer gameplay
- `QuickPlaySetup` only starts local bot games
- No player synchronization or network state

**What's Missing:**
- `supabase.ts` lobby → actual networked game state
- Player join/leave sync
- Game state broadcasting
- Input replication

### 3. ⚠️ Mode Configs Defined But Not Fully Used
**Arena Mode Issues:**
- `isRoundBased: true` but round system not implemented
- `roundTimeLimit` not enforced
- `microRing` not implemented
- `suddenDeath` not implemented
- Win count tracking not implemented

**Main Mode Issues:**
- Vault system implemented ✅
- Riftline convergence implemented ✅
- BUT win condition check incomplete

---

## Mode-by-Mode Breakdown

### MAIN MODE (GameMode.MAIN)
**Purpose:** 10 squads, collect relics, plant them, vault spawns, last team wins
**Config:** ✅ Correct
**Implementation Status:**
- [x] 10 teams, 3 players each
- [x] 5 relics spawn
- [x] Relic pickup/carry
- [x] Plant sites
- [x] Vault spawns after 5 planted
- [x] Riftline convergence on vault
- [ ] Win condition when vault captured
- [ ] Actual 30-player online support
- [ ] Proper endgame resolution

### ARENA 1V1 (GameMode.ARENA_1V1)
**Purpose:** Pure duel, elimination, Best-of-3/5 rounds
**Config:** ✅ Correct
**Implementation Status:**
- [x] 2 teams, 1 player each
- [x] No relics
- [x] No respawns
- [ ] Round system not implemented
- [ ] Round timer (2 min) not implemented
- [ ] Micro ring (60s) not implemented
- [ ] Sudden death (90s) not implemented
- [ ] Best-of-X tracking not implemented

### ARENA 1V1V1 (GameMode.ARENA_1V1V1)
**Purpose:** Three-way FFA duel
**Implementation Status:** Same as 1v1

### ARENA 3V3 (GameMode.ARENA_3V3)
**Purpose:** Team deathmatch, 2 teams of 3
**Implementation Status:** Same as 1v1

### ARENA 3V3V3 (GameMode.ARENA_3V3V3)
**Purpose:** Three-way team battle
**Implementation Status:** Same as 1v1

### TRAINING (GameMode.TRAINING)
**Purpose:** Solo practice with bots
**Implementation Status:**
- [x] Works with bots
- [ ] Difficulty levels not affecting AI behavior
- [ ] Same mobile loop issue

---

## Online Lobby Flow (Current vs Required)

### Current Flow:
```
PLAY → QUICK MATCH → Select Mode → START
                         ↓
              startGameCallback(mode) ← Creates LOCAL bot game
                         ↓
              navigation.forceNavigateTo(IN_MATCH)
                         ↓
              ??? Loops back to TITLE on mobile ???
```

### Required Flow for Online:
```
PLAY → QUICK MATCH → START
                ↓
        supabase.startMatchmaking(mode)
                ↓
        [Searching... UI]
                ↓
        onMatch(lobbyId) ← Supabase finds players
                ↓
        All players join lobby
                ↓
        Host clicks START
                ↓
        All clients receive GAME_START event
                ↓
        Game.startOnlineMatch(lobbyId, players[])
                ↓
        Networked gameplay with state sync
```

---

## Priority Fixes

### P0 - Critical (Game Won't Start)
1. Fix mobile tap → title loop issue
2. Debug why IN_MATCH state doesn't persist

### P1 - Core Gameplay
1. Implement Arena round system
2. Implement round timers
3. Implement micro ring
4. Implement sudden death
5. Implement win condition resolution

### P2 - Online Multiplayer
1. Connect Supabase lobbies to actual game
2. Implement player state synchronization
3. Implement input replication
4. Handle disconnects/reconnects

---

## Files to Fix

| File | Changes Needed |
|------|----------------|
| `Game.ts` | Fix start flow, add round system, add online support |
| `ScreenManager.ts` | Ensure IN_MATCH persists |
| `QuickPlaySetup.ts` | Wire to matchmaking for online |
| `supabase.ts` | Add game state sync methods |
| `ArenaRoundSystem.ts` | NEW FILE - round management |
| `NetworkSync.ts` | NEW FILE - state synchronization |
