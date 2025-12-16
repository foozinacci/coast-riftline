// Loot entity - weapons and items that spawn on the map

import { Entity } from './Entity';
import { EntityType, Rarity, BackpackTier } from '../core/types';
import { WEAPON_CONFIGS } from '../core/constants';
import { Renderer } from '../core/renderer';

export enum LootType {
  WEAPON = 'weapon',
  BACKPACK = 'backpack',
  HEALTH = 'health',
  SHIELD = 'shield',
  AMMO = 'ammo',
}

export interface LootData {
  type: LootType;
  itemId: string;
  rarity: Rarity;
  quantity?: number;
}

const RARITY_COLORS: Record<Rarity, string> = {
  [Rarity.COMMON]: '#888888',
  [Rarity.UNCOMMON]: '#44aa44',
  [Rarity.RARE]: '#4488ff',
  [Rarity.EPIC]: '#aa44ff',
  [Rarity.LEGENDARY]: '#ffaa00',
};

export class Loot extends Entity {
  lootData: LootData;
  decayTimer: number | null;

  constructor(x: number, y: number, lootData: LootData) {
    super(EntityType.LOOT, x, y);

    this.lootData = lootData;
    this.radius = 15;
    this.decayTimer = null;
  }

  update(dt: number): void {
    if (this.decayTimer !== null) {
      this.decayTimer -= dt * 1000;
      if (this.decayTimer <= 0) {
        this.destroy();
      }
    }
  }

  setDecayTimer(ms: number): void {
    this.decayTimer = ms;
  }

  getDisplayName(): string {
    switch (this.lootData.type) {
      case LootType.WEAPON:
        return WEAPON_CONFIGS[this.lootData.itemId]?.name || 'Unknown Weapon';
      case LootType.BACKPACK:
        return `${this.lootData.itemId} Pack`;
      case LootType.HEALTH:
        return `Health +${this.lootData.quantity || 25}`;
      case LootType.SHIELD:
        return `Shield +${this.lootData.quantity || 25}`;
      case LootType.AMMO:
        return `Ammo x${this.lootData.quantity || 30}`;
    }
  }

  render(renderer: Renderer): void {
    const pos = this.position;
    const color = RARITY_COLORS[this.lootData.rarity];

    // Glow based on rarity
    if (this.lootData.rarity !== Rarity.COMMON) {
      renderer.drawGlow(pos, 25, color, 0.3);
    }

    // Draw based on type
    switch (this.lootData.type) {
      case LootType.WEAPON:
        renderer.drawRect(pos, 24, 10, color, '#ffffff', 1);
        renderer.drawText('W', pos, '#ffffff', 10);
        break;
      case LootType.BACKPACK:
        renderer.drawRect(pos, 18, 18, color, '#ffffff', 1);
        renderer.drawText('B', pos, '#ffffff', 10);
        break;
      case LootType.HEALTH:
        renderer.drawRect(pos, 16, 6, '#44ff44', '#ffffff', 1);
        renderer.drawRect(pos, 6, 16, '#44ff44', '#ffffff', 1);
        break;
      case LootType.SHIELD:
        renderer.drawCircle(pos, 10, '#4488ff', '#ffffff', 1);
        break;
      case LootType.AMMO:
        renderer.drawRect({ x: pos.x - 4, y: pos.y }, 4, 12, '#ffaa44', '#ffffff', 1);
        renderer.drawRect({ x: pos.x + 4, y: pos.y }, 4, 12, '#ffaa44', '#ffffff', 1);
        break;
    }

    // Decay warning
    if (this.decayTimer !== null && this.decayTimer < 5000) {
      const blink = Math.sin(Date.now() * 0.02) > 0;
      if (blink) {
        renderer.drawCircle(pos, this.radius + 5, undefined, '#ff4444', 2);
      }
    }
  }
}

// Helper to create random loot
export function createRandomLoot(x: number, y: number): Loot {
  const rand = Math.random();
  let lootData: LootData;

  if (rand < 0.3) {
    const weapons = Object.keys(WEAPON_CONFIGS);
    const weaponId = weapons[Math.floor(Math.random() * weapons.length)];
    lootData = { type: LootType.WEAPON, itemId: weaponId, rarity: getRandomRarity() };
  } else if (rand < 0.4) {
    const tiers = [BackpackTier.FIELD, BackpackTier.ASSAULT];
    const tier = tiers[Math.floor(Math.random() * tiers.length)];
    lootData = { type: LootType.BACKPACK, itemId: tier, rarity: Rarity.UNCOMMON };
  } else if (rand < 0.55) {
    lootData = { type: LootType.HEALTH, itemId: 'health', rarity: Rarity.COMMON, quantity: 25 };
  } else if (rand < 0.7) {
    lootData = { type: LootType.SHIELD, itemId: 'shield', rarity: Rarity.COMMON, quantity: 25 };
  } else {
    lootData = { type: LootType.AMMO, itemId: 'ammo', rarity: Rarity.COMMON, quantity: 30 };
  }

  return new Loot(x, y, lootData);
}

function getRandomRarity(): Rarity {
  const rand = Math.random();
  if (rand < 0.5) return Rarity.COMMON;
  if (rand < 0.8) return Rarity.UNCOMMON;
  if (rand < 0.95) return Rarity.RARE;
  if (rand < 0.99) return Rarity.EPIC;
  return Rarity.LEGENDARY;
}
