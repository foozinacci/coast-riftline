# RIFTLINE - Core Systems Specification

## 1. Team Spawn Voting (Pre-Match)

### Map Structure
- 30 total world nodes
- 5 nodes selected as Team Spawn Locations at match start
- Each spawn supports up to 2 teams
- Each spawn has two sub-spawns: **A-Side** and **B-Side** (far enough to prevent instant combat)

### Voting Flow
1. Each team (3 players) sees the same 5 spawn locations
2. Team members vote for preferred location
3. Majority vote wins
4. If no majority → system picks highest-ranked vote
5. If no vote in time → system auto-assigns to valid spawn

### Fail-safes
- If spawn fills (2 teams assigned) → team redirected to nearest valid spawn
- Players never see error screens

---

## 2. Relic Spawning

- **5 Relics** at **5 Relic Spawn Locations** (different from team spawns)
- All locations are public knowledge
- After all teams spawn:
  1. Global message: "Relic signals detected."
  2. Relics spawn
  3. Global message: "Relics have deployed."

**Key rule:** Relics are NOT hidden. They force movement and conflict.

---

## 3. Relic Carrying

### Pickup
- Any player can pick up a relic
- Only one relic per player

### While Carrying
- Cannot sprint
- More vulnerable
- High-value target

### On Carrier Death
- Relic drops at death location

---

## 4. Relic Planting

### Plant Sites
- Each relic has a valid plant site (fixed locations from world generation)

### Planting Rules
- Stand inside site radius
- Hold interact button for **5 seconds**
- During hold: cannot shoot, movement locked/slowed

### Planting Fails If
- Player releases input
- Player leaves radius
- Player is eliminated

### On Success
- Relic permanently planted
- Match progression advances

---

## 5. Progressive Relic Effects

Each planted relic **irreversibly escalates** the match.

| Relic | Effect |
|-------|--------|
| **1 Planted** | Global Riftline shrink speed increases. First Relic Ring appears at site. Respawn cooldown increases slightly. |
| **2 Planted** | Global Riftline advances to next phase. Storm damage increases. Respawns slow further (unless orbs collected). |
| **3 Planted** | Global Riftline hard shrink. Relic Rings begin to decay. Match enters mid-game. |
| **4 Planted** | Global Riftline late-game speed. Relic Rings shrink rapidly. Respawns risky. |
| **5 Planted** | All Relic Rings collapse. Vault revealed. Vault Ring = only safe zone. Global Riftline converges on vault. |

---

## 6. Vault Phase (Final Objective)

- Vault location revealed globally after 5th relic planted
- Single Vault Ring = only safe zone
- All teams forced to converge
- **Last surviving team wins**
- Vault opens → Match ends → Rewards granted

**This is the ONLY win condition.**

---

## 7. Campfires

- Heal shields first, then health
- Require standing still
- Healing interrupted by damage
- Locations are known and contestable
- Allow team reset after fights, NOT safe camping zones

---

## 8. Passive Healing

### Conditions
- No damage taken/dealt
- Not firing or using abilities
- Behind cover

### Timing
- After 2-3 seconds of inactivity → health regeneration begins

**Note:** Does not replace campfires. Allows disengage without hard reset.

---

## 9. Respawn System

### Squad Persistence
- Squad alive as long as ONE member is alive

### On Death
- Player enters respawn cooldown
- No indefinite spectating

### Respawn Location
- Near safest living teammate
- Preferably least recently engaged teammate

### Orb Economy
Orbs do two things:
1. Reduce your squad's respawn cooldowns
2. Deny enemy the same benefit

**Sources:** Dropped during combat, collected automatically

**Scaling:** Respawn cooldowns increase as relics planted. Orbs counter this.

---

## 10. Respawn Beacons

- Instantly respawn teammate (faster than cooldown)
- One-time use, destroyed after activation
- Creates high-risk rescue moments
- Prevents early snowball wipes
- Forces map control contests

---

## 11. Pre-Game Animation

When all players load in:
1. Camera pans to show all relic locations
2. Camera returns to anchored player
3. Match begins

This orients players to objectives relative to their spawn.

---

## Design Philosophy

- Spawn voting → controlled beginnings
- Relics → forced movement
- Planting → vulnerability windows
- Each relic → tightens match
- Passive healing + campfires → no dead time
- Respawns → players stay engaged
- Orbs → tempo warfare
- Vault → decisive ending

**There is no neutral state where nothing is happening.**
