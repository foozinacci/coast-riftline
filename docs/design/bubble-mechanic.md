# Riftline Bubble Mode - Complete Specification

## Overview
**Mode**: Bubble Riftline (Main Mode, Ranked, Training)  
**Players**: 30 (10 teams of 3 players each)  
**Objectives**: 5 relics, 5 plant sites, vault endgame

---

## Phase 1: Bubble Zone Deployment

### Zone Generation
- **5 bubble zones** generated randomly across the map
- Bubbles **never touch or overlap** (minimum 400m separation)
- Each bubble is approximately 300-400m diameter

### Bubble Contents
Each bubble zone contains:
| Item | Count |
|------|-------|
| Relic | 1 |
| Plant Site | 1 |
| Teams | 2 (forming a "pair") |

### Team Assignment
- 10 teams are paired into 5 "bubble pairs"
- Pairing can be random or based on spawn voting
- Each pair is assigned to one bubble zone

### Bubble Mechanics
| Rule | Description |
|------|-------------|
| **Containment** | Teams cannot leave their bubble until they plant the relic |
| **No Elimination Required** | Teams don't need to wipe the enemy to escape |
| **Independent Escape** | Planting unlocks the bubble for the planting team ONLY |
| **Trapped Team** | The non-planting team remains trapped until they plant their own relic |
| **Projectile Blocking** | Bullets/abilities cannot pass through bubble barriers |

### Strategic Implications
- **Race to Plant**: First team to plant escapes and gains map control
- **Combat Optional**: Teams can fight for relic control OR sneak a plant
- **Risk vs Reward**: Early plant = early escape but enemy knows your location

---

## Phase 2: Free Roam & Relic Planting

### Escaped Teams
- Move freely across the map
- Can collect additional resources/weapons
- Can position for vault endgame
- **Cannot enter other bubbles** (even as escaped team)

### Trapped Teams
- Remain in bubble zone
- Must still fight for/plant relic to escape
- Pressure increases as other teams escape

### Cross-Bubble Rules
| Action | Allowed? |
|--------|----------|
| Enter another team's bubble | ❌ No |
| Exit your bubble before planting | ❌ No |
| Roam "public" areas after planting | ✅ Yes |
| Attack trapped teams through bubble | ❌ No |

### Bubble Independence
- Each bubble zone operates independently
- Planting in Bubble A has no effect on Bubble B
- All 5 relics must be planted (one per bubble)

---

## Phase 3: Vault Endgame

### Trigger Condition
- Activated once **all 5 relics are planted**
- All remaining bubbles instantly pop

### Vault Spawn
- Vault spawns at a **random revealed location**
- All teams receive vault location notification
- Pre-game intel can hint at possible vault positions

### Convergence Ring
- Closing ring begins converging toward vault
- Storm damage applies outside ring
- Forces final confrontation at vault

### Victory Condition
- **Any team arriving at vault can claim reward**
- Last team to arrive still has a chance
- Creates high-stakes tension regardless of plant order

---

## Mode Variants

### Ranked Bubble Riftline
- Standard 30-player queue
- Matchmaking based on team MMR
- Full vault endgame with ranked rewards

### Casual/Training Bubble Riftline
- Same rules, reduced stakes
- Bots can fill empty slots
- Training difficulty affects bot behavior

---

## Implementation Checklist

### Core Systems Required
- [ ] Bubble zone entity (barrier + collision)
- [ ] Bubble zone generation (non-overlapping placement)
- [ ] Team pairing system (10 teams → 5 pairs)
- [ ] Bubble-specific relic/plant site assignment
- [ ] Per-team bubble escape tracking
- [ ] Barrier visual effects (opaque, shimmer, cracks)
- [ ] Bubble pop VFX when relic planted
- [ ] Cross-bubble entry prevention

### Integration Points
- [ ] Existing relic system (reuse with bubble context)
- [ ] Existing plant site system (reuse with bubble context)
- [ ] Existing vault system (trigger after all 5 planted)
- [ ] Existing ring/storm system (convergence toward vault)
- [ ] Pre-game intel (show bubble assignments)
- [ ] HUD updates (bubble status, escape indicators)

### UI/UX Requirements
- [ ] Bubble boundary indicator on minimap
- [ ] "TRAPPED" vs "ESCAPED" team status
- [ ] Plant progress visible to both teams in bubble
- [ ] Notification when enemy team escapes

---

## Technical Notes

### Bubble Entity Properties
```typescript
interface BubbleZone {
  id: string;
  position: Vector2;
  radius: number;
  relicId: string;
  plantSiteId: string;
  assignedTeams: [string, string]; // Pair of squad IDs
  escapedTeams: string[]; // Teams that have planted
  isActive: boolean; // False after both teams escape
}
```

### Collision Rules
- Player vs Bubble: Hard collision (cannot pass)
- Projectile vs Bubble: Blocked (no damage through)
- Visual ray vs Bubble: Partially obscured (fog of war?)

### Network Sync
- Bubble state synced to all clients
- Escape events broadcast immediately
- Ring convergence synced server-authoritative

---

## Priority: HIGH
This is the core differentiating mechanic for Riftline and should be implemented as a primary feature.

**Estimated Development Time**: 2-3 weeks
