# RIFTLINE

A fast-paced, top-down squad-based battle royale built for mobile and desktop.

## Play Now

**[Play RIFTLINE in your browser](https://coast-riftline.vercel.app)** - No download required!

---

## Quick Start (Local Development)

```bash
# Install dependencies
npm install

# Start the game
npm run dev

# Open in browser
http://localhost:3000
```

## Controls

| Action | Desktop | Mobile |
|--------|---------|--------|
| Move | WASD / Arrow Keys | Left side touch joystick |
| Aim | Mouse | Right side touch drag |
| Fire | Left Click (hold) | Right side touch (auto-fire) |
| Reload | R | Auto when empty |
| Interact | E or F | Walk over item |
| Zoom | Mouse Wheel | Pinch (planned) |

---

## What is RIFTLINE?

RIFTLINE is a squad-based battle royale where **10 teams of 3** fight to be the last squad standing. Matches last **6-10 minutes**.

### Core Loop

1. **Spawn** - Your squad picks a spawn site
2. **Loot** - Grab weapons, health, shields, and backpacks
3. **Collect Relics** - 5 relics spawn across the map
4. **Deliver to Vault** - Carry relics to the central vault
5. **Survive the Riftline** - The storm shrinks, forcing combat
6. **Win** - Last squad alive takes the match

### What Makes It Different

- **Death is Temporary** - Respawn near teammates (costs time, not items)
- **Respawn Orbs** - Killing enemies drops orbs that speed up your team's respawns
- **No Minimap** - Proximity awareness shows directional threats instead
- **Relic Pressure** - Carrying a relic slows you and periodically reveals your position
- **Class Roles** - Four classes with different weapon types and detection ranges

---

## Classes

| Class | Role | Weapon Type | Range |
|-------|------|-------------|-------|
| **Vanguard** | Tank/Cleanup | Automatic (SMG, Shotgun) | Close |
| **Skirmisher** | Balanced Fighter | Burst (Rifles, Pistols) | Mid |
| **Sentinel** | Sniper/Scout | Semi-Auto (Marksman) | Long |
| **Catalyst** | Support/Economy | Utility (Launchers) | Flexible |

---

## The Riftline (Storm)

The Riftline is the shrinking safe zone that forces engagement:

| Phase | Duration | Damage | Effect |
|-------|----------|--------|--------|
| **Open** | 2 min | Low | Large safe area, early fights |
| **Compression** | 3 min | Medium | Zone shrinks, respawns slower |
| **Convergence** | 2 min | High | Final zone at vault, endgame |

---

## Objectives

### Relics
- 5 identical relics spawn randomly each match
- Only one relic per player
- Carrying a relic:
  - 15% movement penalty
  - Position revealed every 5 seconds
  - Dropped on death

### Vault
- Central delivery point
- Deliver all 5 relics to trigger final convergence
- Vault opens only after a squad wins (reward, not objective)

---

## Respawn System

- **No spectating** - Dead players wait to respawn
- **Auto-respawn** near alive teammates
- **Respawn Orbs** drop from kills and reduce cooldowns
- **Squad Wipe** - If all 3 die and no one respawns in 15s, squad is eliminated

---

## Tech Stack

- **TypeScript** - Type-safe game logic
- **HTML5 Canvas** - 2D rendering
- **Vite** - Fast development builds
- **Mobile-first** - Touch controls with desktop support

## Project Structure

```
src/
├── core/           # Engine (input, rendering, utils)
├── entities/       # Game objects (Player, Projectile, Relic, etc.)
├── systems/        # Game systems (Riftline, Map, Squads, Awareness)
├── game/           # Main game loop and AI
└── ui/             # HUD and menus
```

## Development

```bash
# Type check
npx tsc --noEmit

# Build for production
npm run build

# Preview production build
npm run preview
```

---

## Design Pillars

1. Death is temporary
2. Respawn timing is the economy
3. Loot is match-only
4. Winning unlocks options, not power
5. Information is earned, not given
6. The Riftline forces engagement
7. Simple, readable, mobile-friendly

---

## Deploy Your Own

### Vercel (Recommended)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/foozinacci/coast-riftline)

Or manually:

1. Fork this repository
2. Go to [vercel.com](https://vercel.com)
3. Import your forked repo
4. Deploy (auto-detects Vite settings)

### Other Platforms

```bash
# Build static files
npm run build

# Output is in dist/ folder
# Upload to any static host (Netlify, GitHub Pages, etc.)
```

---

## License

MIT
