// Webb Protocol - Connection Quality Tester
// Measures latency, bandwidth, jitter to determine best anchors

import { ConnectionQuality, calculateQualityScore } from './types';

/**
 * Test connection quality for anchor election
 * Uses multiple methods to get accurate measurements
 */
export class QualityTester {
    private playerId: string;
    private results: number[] = [];

    constructor(playerId: string) {
        this.playerId = playerId;
    }

    /**
     * Run full quality test
     * Returns ConnectionQuality object with scores
     */
    async runTest(durationMs: number = 3000): Promise<ConnectionQuality> {
        console.log('[QualityTester] Starting connection quality test...');

        const startTime = Date.now();

        // Run tests in parallel
        const [latencyResult, uploadResult, jitterResult] = await Promise.all([
            this.measureLatency(),
            this.measureUploadSpeed(),
            this.measureJitter(durationMs),
        ]);

        const quality: ConnectionQuality = {
            playerId: this.playerId,
            latency: latencyResult.avg,
            uploadSpeed: uploadResult,
            downloadSpeed: uploadResult * 0.8, // Estimate, usually similar
            jitter: jitterResult,
            packetLoss: latencyResult.loss,
            score: 0,
            timestamp: Date.now(),
        };

        // Calculate overall score
        quality.score = calculateQualityScore(
            quality.latency,
            quality.uploadSpeed,
            quality.jitter,
            quality.packetLoss
        );

        console.log(`[QualityTester] Test complete:`, {
            latency: `${quality.latency.toFixed(1)}ms`,
            upload: `${quality.uploadSpeed.toFixed(1)}Mbps`,
            jitter: `${quality.jitter.toFixed(1)}ms`,
            score: quality.score,
        });

        return quality;
    }

    /**
     * Measure latency using multiple methods
     */
    private async measureLatency(): Promise<{ avg: number; loss: number }> {
        const pings: number[] = [];
        const numTests = 5;
        let failures = 0;

        // Use performance.now() for high precision
        for (let i = 0; i < numTests; i++) {
            try {
                const start = performance.now();

                // Ping a fast CDN endpoint (or our Supabase)
                await fetch('https://www.gstatic.com/generate_204', {
                    method: 'HEAD',
                    mode: 'no-cors',
                    cache: 'no-store',
                });

                const end = performance.now();
                pings.push(end - start);
            } catch {
                failures++;
            }

            // Small delay between pings
            await this.delay(100);
        }

        if (pings.length === 0) {
            return { avg: 999, loss: 100 }; // Terrible connection
        }

        // Remove outliers (highest and lowest)
        pings.sort((a, b) => a - b);
        const trimmed = pings.slice(1, -1);

        const avg = trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
        const loss = (failures / numTests) * 100;

        return { avg, loss };
    }

    /**
     * Estimate upload speed
     * Uses data channel throughput simulation
     */
    private async measureUploadSpeed(): Promise<number> {
        // Create a test data blob (100KB)
        const testSize = 100 * 1024; // 100KB
        const testData = new Uint8Array(testSize);
        for (let i = 0; i < testSize; i++) {
            testData[i] = Math.random() * 256;
        }

        // Measure time to "process" the data (simulates upload)
        // In real implementation, this would send via data channel
        const start = performance.now();

        // Simulate processing
        let checksum = 0;
        for (let i = 0; i < testData.length; i++) {
            checksum += testData[i];
        }

        const end = performance.now();
        const timeSeconds = (end - start) / 1000;

        // Use navigator connection API if available
        const nav = navigator as any;
        if (nav.connection?.downlink) {
            // Use browser's network info API
            return nav.connection.downlink; // Mbps
        }

        // Fallback: estimate based on processing speed
        // Most modern connections are 10-100 Mbps
        // We'll assume decent connection and adjust when we have real data
        const estimatedMbps = Math.min(50, Math.max(5, 100 / (timeSeconds * 100)));

        return estimatedMbps;
    }

    /**
     * Measure jitter (variance in latency)
     */
    private async measureJitter(durationMs: number): Promise<number> {
        const samples: number[] = [];
        const startTime = Date.now();
        const sampleInterval = 200; // Sample every 200ms

        while (Date.now() - startTime < durationMs) {
            const pingStart = performance.now();

            try {
                await fetch('https://www.gstatic.com/generate_204', {
                    method: 'HEAD',
                    mode: 'no-cors',
                    cache: 'no-store',
                });
            } catch {
                // Ignore failures for jitter test
            }

            const pingEnd = performance.now();
            samples.push(pingEnd - pingStart);

            await this.delay(sampleInterval);
        }

        if (samples.length < 2) {
            return 50; // Default high jitter
        }

        // Calculate variance
        const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
        const variance = samples.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / samples.length;
        const jitter = Math.sqrt(variance);

        return jitter;
    }

    /**
     * Helper: delay for ms
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

/**
 * Quick quality test for ongoing monitoring
 * Lighter than full test, run periodically
 */
export async function quickQualityCheck(): Promise<{ latency: number; ok: boolean }> {
    const start = performance.now();

    try {
        await fetch('https://www.gstatic.com/generate_204', {
            method: 'HEAD',
            mode: 'no-cors',
            cache: 'no-store',
        });

        const latency = performance.now() - start;
        return { latency, ok: latency < 200 };
    } catch {
        return { latency: 999, ok: false };
    }
}
