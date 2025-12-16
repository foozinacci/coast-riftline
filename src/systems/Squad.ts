// Squad management system

import { Squad, PlayerClass } from '../core/types';
import { GAME_CONFIG, SQUAD_COLORS } from '../core/constants';
import { generateId } from '../core/utils';
import { Player } from '../entities/Player';

export class SquadManager {
  private squads: Map<string, Squad> = new Map();
  private players: Map<string, Player> = new Map();

  createSquad(): Squad {
    const id = generateId();
    const colorIndex = this.squads.size % SQUAD_COLORS.length;

    const squad: Squad = {
      id,
      players: [],
      color: SQUAD_COLORS[colorIndex],
      spawnSite: null,
      relicsDelivered: 0,
      isEliminated: false,
      wipeTimerRemainingMs: null,
    };

    this.squads.set(id, squad);
    return squad;
  }

  addPlayerToSquad(squadId: string, player: Player): boolean {
    const squad = this.squads.get(squadId);
    if (!squad) return false;

    if (squad.players.length >= GAME_CONFIG.playersPerTeam) return false;

    squad.players.push(player.id);
    this.players.set(player.id, player);
    player.squadId = squadId;
    player.color = squad.color;

    return true;
  }

  removePlayerFromSquad(playerId: string): void {
    const player = this.players.get(playerId);
    if (!player) return;

    const squad = this.squads.get(player.squadId);
    if (squad) {
      const index = squad.players.indexOf(playerId);
      if (index !== -1) {
        squad.players.splice(index, 1);
      }
    }

    this.players.delete(playerId);
  }

  getSquad(squadId: string): Squad | undefined {
    return this.squads.get(squadId);
  }

  getPlayer(playerId: string): Player | undefined {
    return this.players.get(playerId);
  }

  getSquadPlayers(squadId: string): Player[] {
    const squad = this.squads.get(squadId);
    if (!squad) return [];

    return squad.players
      .map(id => this.players.get(id))
      .filter((p): p is Player => p !== undefined);
  }

  getAllPlayers(): Player[] {
    return Array.from(this.players.values());
  }

  getAllSquads(): Squad[] {
    return Array.from(this.squads.values());
  }

  getAliveSquads(): Squad[] {
    return this.getAllSquads().filter(squad => !squad.isEliminated);
  }

  // Check squad status and manage wipe timer
  updateSquadStatus(squadId: string, dt: number): void {
    const squad = this.squads.get(squadId);
    if (!squad || squad.isEliminated) return;

    const players = this.getSquadPlayers(squadId);
    const alivePlayers = players.filter(p => p.state.isAlive);
    const respawningPlayers = players.filter(
      p => !p.state.isAlive && p.state.respawnTimer > 0
    );

    // All players dead?
    if (alivePlayers.length === 0) {
      if (respawningPlayers.length > 0) {
        // At least one player is respawning
        if (squad.wipeTimerRemainingMs === null) {
          squad.wipeTimerRemainingMs = GAME_CONFIG.wipeTimerDuration;
        }

        // Decrement wipe window using simulation time (avoid Date.now() timer drift)
        squad.wipeTimerRemainingMs -= dt * 1000;
        if (squad.wipeTimerRemainingMs <= 0) {
          // No one respawned in time - squad eliminated
          this.eliminateSquad(squadId);
        }
      } else {
        // No one can respawn - immediate elimination
        this.eliminateSquad(squadId);
      }
    } else {
      // At least one player alive - reset wipe timer
      squad.wipeTimerRemainingMs = null;
    }
  }

  private eliminateSquad(squadId: string): void {
    const squad = this.squads.get(squadId);
    if (!squad) return;

    squad.isEliminated = true;

    // Mark all players as inactive
    for (const playerId of squad.players) {
      const player = this.players.get(playerId);
      if (player) {
        player.isActive = false;
      }
    }
  }

  // Get respawn position for a player
  getSquadRespawnPosition(squadId: string): { x: number; y: number } | null {
    const players = this.getSquadPlayers(squadId);
    const alivePlayers = players.filter(p => p.state.isAlive);

    if (alivePlayers.length === 0) return null;

    // Respawn near a random alive teammate
    const teammate = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];

    // Offset from teammate
    const angle = Math.random() * Math.PI * 2;
    const distance = 50 + Math.random() * 50;

    return {
      x: teammate.position.x + Math.cos(angle) * distance,
      y: teammate.position.y + Math.sin(angle) * distance,
    };
  }

  // Calculate respawn time with orb economy
  calculateRespawnTime(squadId: string, baseTime: number, orbsCollected: number): number {
    let time = baseTime;

    // Reduce time based on orbs collected
    const orbReduction = orbsCollected * 500; // 0.5 seconds per orb
    time = Math.max(3000, time - orbReduction);

    return time;
  }

  // Award relic delivery to squad
  deliverRelic(squadId: string): void {
    const squad = this.squads.get(squadId);
    if (squad) {
      squad.relicsDelivered++;
    }
  }

  // Check for winner
  checkForWinner(): Squad | null {
    const aliveSquads = this.getAliveSquads();
    if (aliveSquads.length === 1) {
      return aliveSquads[0];
    }
    return null;
  }

  // Reset for new game
  reset(): void {
    this.squads.clear();
    this.players.clear();
  }
}
