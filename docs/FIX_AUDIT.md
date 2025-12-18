# RIFTLINE Fix Audit - December 18, 2024

## Critical Issues (Game-Breaking)

### 1. Navigation Loop / Audio Freeze 🔴
- **Symptom**: Console shows rapid looping between `settings_root -> audio_settings -> settings_root`
- **Impact**: Freezes audio completely
- **Root Cause**: TBD - investigating

### 2. Private Match Creation Fails 🔴  
- **Symptom**: "Failed to create lobby" error when clicking CREATE LOBBY
- **Impact**: Multiplayer completely broken
- **Root Cause**: Supabase anonymous auth may need additional RLS policies

---

## High Priority Issues (Core Gameplay)

### 3. Bubble Zones Behavior 🟡
- **Current**: Bubbles appear but don't follow design spec
- **Expected**: 
  - 5 bubbles, never touching
  - Each contains: 1 relic, 1 plant site, 2 teams, cover obstructions
  - Disappear when relic is planted
- **Status**: Partial fix (disappear on plant added)

### 4. START Button Bleeding 🟡
- **Symptom**: Button appears/disappears or has visual glitches
- **Root Cause**: Duplicate button IDs being added every frame
- **Status**: Fixed (addButton now checks for duplicates)

### 5. HUD Squad/Player Display 🟢
- **Expected**: "ALIVE: X squads / Y players"
- **Status**: FIXED

---

## Medium Priority Issues (Polish)

### 6. Relic Planting Input
- **Expected**: Press E/F to plant
- **Current**: Auto-plants when near site

### 7. Pre-Game Intel Screen
- Shows SPAWN, RELIC, CAMPFIRE, WILDCARD markers
- Needs verification that all work correctly

### 8. Ranked Bubble Voting
- **Design**: FIFO voting on bubbles before pre-game intel
- **Status**: Design documented, not implemented

---

## Verification Checklist

- [ ] Title screen loads
- [ ] Main menu navigation works
- [ ] Settings screens don't loop
- [ ] Audio plays and doesn't freeze
- [ ] Training mode starts correctly
- [ ] Bubble zones appear with correct elements
- [ ] Relics can be picked up
- [ ] Relic planting works
- [ ] Bubble disappears on plant
- [ ] HUD shows correct alive counts
- [ ] Pause menu works
- [ ] Post-match screen works
