// Bubble Zone Entity
// Containment zones for Main Mode - teams fight for relic inside bubble

import { Entity } from './Entity';
import { EntityType, Vector2 } from '../core/types';
import { Renderer } from '../core/renderer';
import { distanceVec2 } from '../core/utils';

export interface BubbleZoneState {
    relicId: string;
    plantSiteId: string;
    assignedTeams: [string, string]; // Two squad IDs
    escapedTeams: string[];          // Teams that have planted and escaped
    isActive: boolean;               // False after both teams escape
}

export class BubbleZone extends Entity {
    state: BubbleZoneState;
    bubbleRadius: number;

    constructor(
        x: number,
        y: number,
        radius: number,
        relicId: string,
        plantSiteId: string,
        team1Id: string,
        team2Id: string
    ) {
        super(EntityType.SPAWN_SITE, x, y); // Reusing spawn site type for now

        this.bubbleRadius = radius;
        this.radius = radius; // For collision purposes

        this.state = {
            relicId,
            plantSiteId,
            assignedTeams: [team1Id, team2Id],
            escapedTeams: [],
            isActive: true,
        };
    }

    update(_dt: number): void {
        // Check if both teams have escaped
        if (this.state.escapedTeams.length >= 2) {
            this.state.isActive = false;
        }
    }

    /**
     * Check if a team is trapped inside this bubble
     */
    isTeamTrapped(squadId: string): boolean {
        if (!this.state.isActive) return false;
        if (!this.state.assignedTeams.includes(squadId)) return false;
        return !this.state.escapedTeams.includes(squadId);
    }

    /**
     * Check if a position is inside the bubble
     */
    isInsideBubble(pos: Vector2): boolean {
        return distanceVec2(pos, this.position) <= this.bubbleRadius;
    }

    /**
     * Check if a position is at the bubble boundary
     */
    isAtBoundary(pos: Vector2, threshold: number = 20): boolean {
        const dist = distanceVec2(pos, this.position);
        return Math.abs(dist - this.bubbleRadius) < threshold;
    }

    /**
     * Team escapes the bubble (called when relic is planted)
     */
    teamEscapes(squadId: string): boolean {
        if (!this.state.assignedTeams.includes(squadId)) return false;
        if (this.state.escapedTeams.includes(squadId)) return false;

        this.state.escapedTeams.push(squadId);
        console.log(`[BubbleZone] Team ${squadId} escaped bubble at (${this.position.x}, ${this.position.y})`);
        return true;
    }

    /**
     * Constrain a position to stay inside the bubble (for trapped teams)
     */
    constrainPosition(pos: Vector2): Vector2 {
        const dist = distanceVec2(pos, this.position);
        if (dist <= this.bubbleRadius) {
            return pos; // Already inside
        }

        // Push back to edge
        const angle = Math.atan2(pos.y - this.position.y, pos.x - this.position.x);
        return {
            x: this.position.x + Math.cos(angle) * (this.bubbleRadius - 5),
            y: this.position.y + Math.sin(angle) * (this.bubbleRadius - 5),
        };
    }

    render(renderer: Renderer): void {
        if (!this.state.isActive) return;

        const pos = this.position;

        // Main bubble wall - thin light blue pinstripe circle
        renderer.drawCircle(
            pos,
            this.bubbleRadius,
            'transparent',                    // No fill
            'rgba(100, 180, 255, 0.6)',       // Light blue stroke
            2                                  // Thin line
        );

        // Inner glow for visibility
        renderer.drawCircle(
            pos,
            this.bubbleRadius - 10,
            'transparent',
            'rgba(100, 180, 255, 0.2)',
            1
        );

        // Show escape status
        const escapedCount = this.state.escapedTeams.length;
        const statusText = escapedCount === 0 ? 'SEALED' :
            escapedCount === 1 ? '1 ESCAPED' : 'OPEN';
        const statusColor = escapedCount === 0 ? 'rgba(255, 100, 100, 0.8)' :
            escapedCount === 1 ? 'rgba(255, 200, 100, 0.8)' :
                'rgba(100, 255, 100, 0.8)';

        renderer.drawText(
            statusText,
            { x: pos.x, y: pos.y - this.bubbleRadius - 20 },
            statusColor,
            12,
            'center',
            'middle'
        );
    }
}

/**
 * Generate bubble zones for Main Mode
 * Places 5 non-overlapping bubbles, each with 1 relic and 1 plant site
 */
export function generateBubbleZones(
    mapWidth: number,
    mapHeight: number,
    bubbleCount: number,
    relicIds: string[],
    plantSiteIds: string[],
    teamPairs: [string, string][]
): BubbleZone[] {
    const zones: BubbleZone[] = [];
    const bubbleRadius = 350; // Bubble diameter ~700
    const minDistance = bubbleRadius * 2.5; // Ensure no overlap
    const margin = bubbleRadius + 100;

    for (let i = 0; i < bubbleCount && i < teamPairs.length; i++) {
        let position: Vector2 | null = null;
        let attempts = 0;

        // Find non-overlapping position
        while (attempts < 100) {
            const x = margin + Math.random() * (mapWidth - margin * 2);
            const y = margin + Math.random() * (mapHeight - margin * 2);

            let valid = true;
            for (const zone of zones) {
                if (distanceVec2({ x, y }, zone.position) < minDistance) {
                    valid = false;
                    break;
                }
            }

            if (valid) {
                position = { x, y };
                break;
            }
            attempts++;
        }

        if (position && relicIds[i] && plantSiteIds[i]) {
            const [team1, team2] = teamPairs[i];
            zones.push(new BubbleZone(
                position.x,
                position.y,
                bubbleRadius,
                relicIds[i],
                plantSiteIds[i],
                team1,
                team2
            ));
        }
    }

    console.log(`[BubbleZone] Generated ${zones.length} bubble zones`);
    return zones;
}
