# RIFTLINE — Online Matchmaking & Lobby System Audit
Generated: 2025-12-17

## Executive Summary

This document audits the current codebase against the comprehensive Matchmaking & Lobby specification. The spec defines player identity, lobby types, matchmaking pools, SBMM, team formation, queue timing, pre-match flow, spawn voting, and mode-specific rules.

---

## SPEC SECTION 1: Entry Point (Landing Page → Online Intent)

### Specification Requirements:
- Players MUST choose one of three intents: **Play Online**, **Play With Friends**, **Training/Practice**
- No demo, no auto-queue, player agency first

### Current Implementation Status: ✅ Partially Implemented

| Requirement | Status | Location |
|-------------|--------|----------|
| Intent selection screen | ✅ Exists | `PlayMenu.ts` |
| Play Online (Quick Match) | ✅ Button exists | `PlayMenu.ts` → `QuickPlaySetup.ts` |
| Play With Friends (Private) | ✅ Button exists | `PlayMenu.ts` → `PrivateMatch.ts` |
| Training / Practice | ✅ Button exists | `MainMenu.ts` → `TrainingSetup.ts` |
| No forced demos | ✅ Manual start only | All flows require explicit action |

### Gaps:
- None for entry point flow

---

## SPEC SECTION 2: Identity & Presence

### Specification Requirements:
- Each player has: **Username**, **Friend Code** (static), **Session Code** (temporary)
- Used for: Invites, Friends list, Lobby joining, Rejoining sessions

### Current Implementation Status: ⚠️ Partial

| Requirement | Status | Location |
|-------------|--------|----------|
| Username | ✅ In DB schema | `profiles.username` |
| Friend Code (static, shareable) | ❌ NOT IMPLEMENTED | Needs new column in profiles |
| Session Code (per lobby) | ✅ Exists | `lobbies.code` |
| Player profile view | ⚠️ Basic only | `supabase.ts` → `PlayerProfile` type |
| Friends list | ❌ NOT IMPLEMENTED | No table or logic |
| Invites via friend code | ❌ NOT IMPLEMENTED | No invite system |
| Rejoin on disconnect | ❌ NOT IMPLEMENTED | No reconnect logic |

### Required Schema Addition:
```sql
-- Add to profiles table
ALTER TABLE profiles ADD COLUMN friend_code TEXT UNIQUE;

-- Friends table
CREATE TABLE friends (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  friend_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, friend_id)
);
```

---

## SPEC SECTION 3: Lobby Types

### A. Public Matchmaking Lobby

| Requirement | Status | Location |
|-------------|--------|----------|
| Auto-filled via matchmaking | ⚠️ Skeleton only | `supabase.ts` → `startMatchmaking()` |
| Used for ranked/unranked modes | ⚠️ Flag exists | `lobbies.is_ranked` |
| Bot fill after timeout | ❌ NOT IMPLEMENTED | No bot fill logic in matchmaking |

### B. Private Lobby

| Requirement | Status | Location |
|-------------|--------|----------|
| Host-controlled | ✅ Implemented | `PrivateMatch.ts` + `lobbies.host_id` |
| Invite-only (code) | ✅ Implemented | `joinByCode()` in supabase.ts |
| Lock/unlock toggle | ❌ NOT IMPLEMENTED | No lock state |
| Bot fill toggle | ❌ NOT IMPLEMENTED | No bot setting per lobby |

### Missing Features:
- Lobby lock/unlock state
- Bot fill preference per lobby
- Team assignment UI

---

## SPEC SECTION 4: Matchmaking Pools

### Specification Requirements:
- Each mode has its OWN queue
- Players cannot be cross-queued

### Current Implementation Status: ✅ Design Ready, ⚠️ Incomplete Logic

| Requirement | Status | Location |
|-------------|--------|----------|
| Relic Conquest queue | ⚠️ Mode field exists | `matchmaking_tickets.mode = 'main'` |
| Arena 3v3 queue | ⚠️ Mode field exists | `matchmaking_tickets.mode = 'arena_3v3'` |
| Arena 3v3v3 queue | ⚠️ Mode field exists | `matchmaking_tickets.mode = 'arena_3v3v3'` |
| Arena 1v1 queue | ⚠️ Mode field exists | `matchmaking_tickets.mode = 'arena_1v1'` |
| Arena 1v1v1 queue | ⚠️ Mode field exists | `matchmaking_tickets.mode = 'arena_1v1v1'` |
| Cross-queue prevention | ✅ Design enforced | Single mode per ticket |

### What's Missing:
- Actual matchmaking server function to find and group players
- Queue status polling/subscription
- Match-found notification

---

## SPEC SECTION 5: Skill-Based Matchmaking (SBMM)

### Specification Requirements:
Track per mode: Games played, Wins, Kills, Deaths, K/D, Avg damage, Unlock tier
Skill bands: Bronze, Silver, Gold, Rift

### Current Implementation Status: ⚠️ Basic Only

| Requirement | Status | Location |
|-------------|--------|----------|
| Games played | ✅ Tracked | `profiles.total_matches` |
| Wins | ✅ Tracked | `profiles.wins` |
| Kills | ✅ Tracked | `profiles.kills` |
| Deaths | ✅ Tracked | `profiles.deaths` |
| K/D ratio | ❌ Derived, not stored | Calculable but not used |
| Avg damage | ❌ NOT TRACKED | Missing field |
| Unlock tier | ❌ NOT TRACKED | Missing loadout power system |
| Skill bands | ⚠️ Basic rank only | `profiles.rank` (numeric, not banded) |
| Per-mode stats | ❌ NOT IMPLEMENTED | Stats are global, not per-mode |

### Required Schema for Per-Mode Stats:
```sql
CREATE TABLE player_mode_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  mode TEXT NOT NULL,
  games_played INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  kills INTEGER DEFAULT 0,
  deaths INTEGER DEFAULT 0,
  damage_dealt INTEGER DEFAULT 0,
  skill_rating INTEGER DEFAULT 1000,
  skill_band TEXT DEFAULT 'bronze' CHECK (skill_band IN ('bronze', 'silver', 'gold', 'rift')),
  UNIQUE(player_id, mode)
);
```

---

## SPEC SECTION 6: Team Formation Rules

### Specification Requirements:
- Solo queue: Matched into teams of 3
- 2-player parties allowed, matchmaking fills third
- 3-player parties are ideal
- Parties cannot exceed team size
- Parties are NEVER split

### Current Implementation Status: ❌ NOT IMPLEMENTED

| Requirement | Status | Location |
|-------------|--------|----------|
| Solo queue team formation | ❌ Missing | No logic |
| Party system | ❌ Missing | No party table/logic |
| Party size validation | ❌ Missing | No party concept |
| Party never split | ❌ Missing | N/A without parties |

### Required New System:
```typescript
// New file: src/network/party.ts
interface Party {
  id: string;
  leader_id: string;
  members: string[];
  mode: GameMode | null;  // null if not queued
  status: 'idle' | 'queued' | 'in_lobby' | 'in_match';
}
```

### Required Schema:
```sql
CREATE TABLE parties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  leader_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  mode TEXT,
  status TEXT DEFAULT 'idle' CHECK (status IN ('idle', 'queued', 'in_lobby', 'in_match')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE party_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  party_id UUID REFERENCES parties(id) ON DELETE CASCADE,
  player_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(party_id, player_id)
);
```

---

## SPEC SECTION 7: Queue Timing & Bot Fill Logic

### Specification Requirements:
- Minimum 15 real players for Relic Conquest, arenas may start with fewer
- 0-3 min: Players only
- 3-5 min: Offer "Fill with Bots"
- 5+ min: Forced bot fill
- Bots: Never counted as players, flagged internally, difficulty scales, removed pre-match when real players join

### Current Implementation Status: ❌ NOT IMPLEMENTED

| Requirement | Status | Location |
|-------------|--------|----------|
| Queue timer tracking | ❌ Missing | Need client-side timer |
| "Fill with Bots" prompt | ❌ Missing | No UI for this |
| Forced bot fill | ❌ Missing | No forced timeout |
| Bot flagging | ⚠️ Internal only | Bots exist but no online distinction |
| Bot replacement pre-match | ❌ Missing | No hot-swap logic |

### Required Implementation:
1. Client-side queue timer
2. UI: "Searching... (X:XX)" with "Fill with Bots?" button at 3min
3. Server: Track ticket creation time, auto-close at 5min with bot fill

---

## SPEC SECTION 8: Pre-Match Lobby Flow

### Specification Requirements:
- Players load into lobby
- Teams visible, friends highlighted
- Loadouts locked
- Ready status required
- Game starts when: Lobby full (players + bots), All ready, Countdown completes

### Current Implementation Status: ⚠️ Partial

| Requirement | Status | Location |
|-------------|--------|----------|
| Lobby screen | ✅ Exists | `LobbyScreen.ts` |
| Team display | ⚠️ Basic | Shows players, not team structure |
| Friends highlight | ❌ Missing | No friends system |
| Loadout lock | ❌ Missing | No loadout display/lock in lobby |
| Ready toggle | ✅ Exists | `setReady()` in supabase.ts |
| All-ready check | ⚠️ Partial | `LobbyScreen` doesn't gate on this |
| Countdown | ❌ Missing | No countdown UI/logic |
| Start match from lobby | ❌ NOT WIRED | Lobby → Game transition broken |

### Critical Gap:
The lobby UI exists but is NOT connected to actual networked game start. `LobbyScreen.ts` and `PrivateMatch.ts` create lobbies in Supabase but don't trigger actual multiplayer gameplay.

---

## SPEC SECTION 9: Spawn Voting Phase (Main Mode Only)

### Current Implementation Status: ✅ IMPLEMENTED (Local Only)

| Requirement | Status | Location |
|-------------|--------|----------|
| 5 spawn zones generated | ✅ Implemented | `SpawnVoting.ts` |
| Each zone has A/B sides | ✅ Implemented | `SpawnVoting.ts` → sub-zones |
| Max 2 teams per zone | ✅ Implemented | Logic in place |
| Team votes | ⚠️ Local only | Not networked |
| No vote = auto-assign | ✅ Implemented | Default fallback |

### Gap:
- Voting is client-only, not synchronized across players
- Need to broadcast votes via Supabase Realtime

---

## SPEC SECTION 10: Match Start → Session Binding

### Specification Requirements:
- Players bound to match session ID
- Reconnect allowed on disconnect
- Late joins NOT allowed

### Current Implementation Status: ❌ NOT IMPLEMENTED

| Requirement | Status | Location |
|-------------|--------|----------|
| Match session ID | ⚠️ Lobby ID exists | Could reuse `lobby_id` |
| Player binding | ❌ Missing | No binding logic |
| Reconnect handling | ❌ Missing | No reconnect system |
| Late join prevention | ❌ Missing | No enforcement |

---

## SPEC SECTION 11: End of Match → Exit Paths

### Specification Requirements:
- Return to lobby with party
- Queue again
- Leave party
- View stats
- Accept rewards
- No dead ends

### Current Implementation Status: ⚠️ Partial

| Requirement | Status | Location |
|-------------|--------|----------|
| Post-match screen | ✅ Exists | `PostMatchScreen.ts` |
| Stats display | ⚠️ Basic | Shows kills/deaths/damage |
| Play Again button | ✅ Exists | Returns to menu |
| Return with party | ❌ Missing | No party system |
| Rewards UI | ❌ Missing | No rewards system |

---

## SPEC SECTION 12: Arena Mode Matchmaking Differences

### Specification Requirements:
- Faster queues
- Smaller player requirements
- No relic logic
- Best-of-3 / Best-of-5 enforced

### Current Implementation: ⚠️ Config Ready, Logic Missing

| Requirement | Status | Location |
|-------------|--------|----------|
| Arena configs defined | ✅ Complete | `modeConfig.ts` |
| Smaller team sizes | ✅ In config | `playersPerTeam`, `teamCount` |
| No relics | ✅ In config | `relicsEnabled: false` |
| Round system | ❌ NOT IMPLEMENTED | `isRoundBased: true` but no logic |
| Best-of-X tracking | ❌ NOT IMPLEMENTED | Config exists, no runtime |

---

## SPEC SECTION 13: Training Mode

### Specification Requirements:
- No queues
- No SBMM
- AI only
- Same mechanics
- Difficulty selected upfront

### Current Implementation Status: ✅ Mostly Complete

| Requirement | Status | Location |
|-------------|--------|----------|
| Training setup screen | ✅ Exists | `TrainingSetup.ts` |
| Difficulty selection | ✅ Exists | Easy/Medium/Hard options |
| No queues | ✅ Correct | Direct local game start |
| Same mechanics | ✅ Same game loop | Uses `Game.startTestGame()` |
| AI-only | ✅ Bot generation | Bots created per config |

### Gaps:
- Difficulty not actually affecting AI behavior yet
- Same mobile loop issue as other modes

---

## Priority Implementation Roadmap

### P0 — Critical (Game Won't Work Online)

1. **Fix Mobile Tap Loop** — Game returns to title instead of starting
   - Debug `ScreenManager.ts` → `QuickPlaySetup.ts` → `Game.ts` flow
   
2. **Wire Lobby → Game Transition**
   - Connect Supabase lobby state to actual game instantiation
   - Broadcast GAME_START event to all lobby players

3. **Implement Networked Game State**
   - Game state sync via Supabase Realtime or WebSockets
   - Input replication for all players

### P1 — Core Matchmaking

4. **Implement Matchmaking Service**
   - Server function (Supabase Edge Function) to match players
   - Queue timer with bot fill fallback
   
5. **Implement Party System**
   - Create/join parties
   - Party sync during matchmaking
   
6. **Per-Mode Stats Tracking**
   - `player_mode_stats` table
   - Update after each match

### P2 — Enhanced Features

7. **Friends System**
   - Friend codes
   - Add/accept/block friends
   - Friends list UI
   
8. **Reconnect Logic**
   - Detect disconnect
   - Store session state
   - Allow rejoin within timeout

9. **Arena Round System**
   - Round tracking
   - Round timers
   - Best-of-X progression

### P3 — Polish

10. **Skill Band Display**
11. **Queue Timer UI**
12. **Rewards System**
13. **Match History Browser**

---

## Files Requiring Changes

| File | Changes |
|------|---------|
| `supabase/schema.sql` | Add `friend_code`, `friends`, `parties`, `player_mode_stats` tables |
| `src/network/supabase.ts` | Add party methods, matchmaking polling, game state sync |
| `src/network/party.ts` | **NEW** — Party management |
| `src/network/matchmaking.ts` | **NEW** — Queue timer, bot fill logic |
| `src/network/gameSync.ts` | **NEW** — Multiplayer state synchronization |
| `src/game/Game.ts` | Add online match start, state broadcasting |
| `src/ui/screens/LobbyScreen.ts` | Add team display, countdown, game start |
| `src/ui/screens/QuickPlaySetup.ts` | Wire to actual matchmaking |
| `src/systems/ArenaRoundSystem.ts` | **NEW** — Round management |

---

## Schema Migration Required

```sql
-- Migration: Add online matchmaking features

-- 1. Friend codes
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS friend_code TEXT UNIQUE;

-- 2. Friends table
CREATE TABLE IF NOT EXISTS friends (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  friend_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, friend_id)
);

-- 3. Parties
CREATE TABLE IF NOT EXISTS parties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  leader_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  mode TEXT,
  status TEXT DEFAULT 'idle' CHECK (status IN ('idle', 'queued', 'in_lobby', 'in_match')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS party_members (
  party_id UUID REFERENCES parties(id) ON DELETE CASCADE,
  player_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (party_id, player_id)
);

-- 4. Per-mode stats
CREATE TABLE IF NOT EXISTS player_mode_stats (
  player_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  mode TEXT NOT NULL,
  games_played INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  kills INTEGER DEFAULT 0,
  deaths INTEGER DEFAULT 0,
  damage_dealt INTEGER DEFAULT 0,
  skill_rating INTEGER DEFAULT 1000,
  skill_band TEXT DEFAULT 'bronze' CHECK (skill_band IN ('bronze', 'silver', 'gold', 'rift')),
  PRIMARY KEY (player_id, mode)
);

-- 5. Lobby settings
ALTER TABLE lobbies ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false;
ALTER TABLE lobbies ADD COLUMN IF NOT EXISTS bot_fill_enabled BOOLEAN DEFAULT true;

-- 6. Match binding
ALTER TABLE lobby_players ADD COLUMN IF NOT EXISTS session_token TEXT;
ALTER TABLE lobby_players ADD COLUMN IF NOT EXISTS disconnected_at TIMESTAMPTZ;
```

---

## Conclusion

The current codebase has a **strong foundation** for offline/bot gameplay with:
- ✅ Mode configurations fully defined
- ✅ Core game systems (Relic, Vault, Riftline, Spawn Voting) implemented
- ✅ UI screen system in place
- ✅ Supabase schema for lobbies and matchmaking tickets

**Critical gaps for online play:**
- ❌ No actual multiplayer state synchronization
- ❌ Lobby → Game transition not wired
- ❌ No party system
- ❌ No reconnect handling
- ❌ Arena round system not implemented

**Next immediate action:** Fix the mobile tap loop issue (P0.1) to unblock all testing.
