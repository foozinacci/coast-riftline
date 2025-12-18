// RIFTLINE Audio System
// Web Audio API sound effects with Kenney.nl CC0 sounds

// ============================================================================
// TYPES
// ============================================================================

export type SoundCategory = 'sfx' | 'music' | 'ui' | 'voice' | 'ambient';

export interface SoundOptions {
    volume?: number;
    loop?: boolean;
    pitch?: number; // 0.5 - 2.0
    pan?: number; // -1 (left) to 1 (right)
    category?: SoundCategory;
}

interface LoadedSound {
    buffer: AudioBuffer;
    category: SoundCategory;
}

interface PlayingSound {
    source: AudioBufferSourceNode;
    gainNode: GainNode;
    panNode: StereoPannerNode;
    startTime: number;
    loop: boolean;
}

// ============================================================================
// SOUND CONFIGURATION
// Local files from /public/audio/ (Kenney.nl CC0 assets)
// Falls back to procedural if files not found
// ============================================================================

const SOUND_CONFIG: Record<string, { path: string; category: SoundCategory }> = {
    gunshot: { path: '/audio/laserSmall_000.ogg', category: 'sfx' },
    laser: { path: '/audio/laserLarge_000.ogg', category: 'sfx' },
    explosion: { path: '/audio/explosionCrunch_000.ogg', category: 'sfx' },
    hit: { path: '/audio/impactMetal_000.ogg', category: 'sfx' },
    death: { path: '/audio/lowFrequency_explosion_000.ogg', category: 'sfx' },
    reload: { path: '/audio/switch2.ogg', category: 'sfx' },
    dash: { path: '/audio/swoosh.ogg', category: 'sfx' },
    click: { path: '/audio/click1.ogg', category: 'ui' },
    hover: { path: '/audio/rollover1.ogg', category: 'ui' },
    confirm: { path: '/audio/confirmation_001.ogg', category: 'ui' },
    pickup: { path: '/audio/switch1.ogg', category: 'sfx' },
    footstep: { path: '/audio/footstep05.ogg', category: 'sfx' },
    respawn: { path: '/audio/powerUp1.ogg', category: 'sfx' },
};

// Music tracks
const MUSIC_CONFIG: Record<string, string> = {
    lobby: '/audio/lobby_music.wav',
};

// ============================================================================
// PROCEDURAL SOUND GENERATION (Fallback)
// ============================================================================

function generateProceduralSound(ctx: AudioContext, type: string): AudioBuffer {
    const sampleRate = ctx.sampleRate;

    switch (type) {
        case 'gunshot': {
            const duration = 0.15;
            const samples = sampleRate * duration;
            const buffer = ctx.createBuffer(1, samples, sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < samples; i++) {
                const t = i / sampleRate;
                const noise = Math.random() * 2 - 1;
                const envelope = Math.exp(-t * 40);
                const thump = Math.sin(t * 150) * Math.exp(-t * 20);
                data[i] = (noise * 0.6 + thump * 0.4) * envelope * 2.0;
            }
            return buffer;
        }
        case 'laser': {
            const duration = 0.2;
            const samples = sampleRate * duration;
            const buffer = ctx.createBuffer(1, samples, sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < samples; i++) {
                const t = i / sampleRate;
                const freq = 2000 * Math.exp(-t * 10);
                const wave = Math.sin(t * freq * Math.PI * 2);
                const envelope = Math.exp(-t * 15);
                data[i] = wave * envelope * 1.5;
            }
            return buffer;
        }
        case 'explosion': {
            const duration = 0.8;
            const samples = sampleRate * duration;
            const buffer = ctx.createBuffer(1, samples, sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < samples; i++) {
                const t = i / sampleRate;
                const noise = Math.random() * 2 - 1;
                const boom = Math.sin(t * 60) * Math.exp(-t * 4);
                const crackle = noise * Math.exp(-t * 8);
                const envelope = Math.exp(-t * 3);
                data[i] = (boom * 0.6 + crackle * 0.4) * envelope * 1.5;
            }
            return buffer;
        }
        case 'hit': {
            const duration = 0.1;
            const samples = sampleRate * duration;
            const buffer = ctx.createBuffer(1, samples, sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < samples; i++) {
                const t = i / sampleRate;
                const noise = Math.random() * 2 - 1;
                const thump = Math.sin(t * 200) * Math.exp(-t * 30);
                const envelope = Math.exp(-t * 50);
                data[i] = (noise * 0.4 + thump * 0.6) * envelope * 1.5;
            }
            return buffer;
        }
        case 'click':
        case 'confirm': {
            const duration = 0.08;
            const samples = sampleRate * duration;
            const buffer = ctx.createBuffer(1, samples, sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < samples; i++) {
                const t = i / sampleRate;
                const wave = Math.sin(t * 1200 * Math.PI * 2);
                const envelope = Math.exp(-t * 60);
                data[i] = wave * envelope * 0.8;
            }
            return buffer;
        }
        default: {
            // Generic fallback
            const duration = 0.1;
            const samples = sampleRate * duration;
            const buffer = ctx.createBuffer(1, samples, sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < samples; i++) {
                const t = i / sampleRate;
                const noise = Math.random() * 2 - 1;
                const envelope = Math.exp(-t * 40);
                data[i] = noise * envelope * 0.5;
            }
            return buffer;
        }
    }
}

// ============================================================================
// AUDIO MANAGER
// ============================================================================

const SOUND_IDS = [
    'gunshot', 'laser', 'explosion', 'hit', 'death', 'reload', 'dash',
    'click', 'hover', 'confirm', 'pickup', 'footstep', 'respawn',
] as const;

type SoundId = typeof SOUND_IDS[number];

export class AudioManager {
    private static instance: AudioManager | null = null;

    private ctx: AudioContext | null = null;
    private masterGain: GainNode | null = null;
    private categoryGains: Map<SoundCategory, GainNode> = new Map();

    private sounds: Map<SoundId, LoadedSound> = new Map();
    private musicBuffers: Map<string, AudioBuffer> = new Map();
    private currentMusic: { source: AudioBufferSourceNode; gainNode: GainNode; trackId: string } | null = null;
    private playingSounds: Map<string, PlayingSound> = new Map();

    private volumes: Record<SoundCategory, number> = {
        sfx: 1.0,
        music: 0.7,
        ui: 0.8,
        voice: 1.0,
        ambient: 0.5,
    };

    private muted: boolean = false;
    private initialized: boolean = false;

    private constructor() { }

    static getInstance(): AudioManager {
        if (!AudioManager.instance) {
            AudioManager.instance = new AudioManager();
        }
        return AudioManager.instance;
    }

    // ============================================================================
    // INITIALIZATION
    // ============================================================================

    async initialize(): Promise<boolean> {
        if (this.initialized) return true;

        try {
            // Create audio context
            this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();

            // Resume if suspended
            if (this.ctx.state === 'suspended') {
                await this.ctx.resume();
            }

            // Create master gain
            this.masterGain = this.ctx.createGain();
            this.masterGain.connect(this.ctx.destination);

            // Create category gains
            for (const category of ['sfx', 'music', 'ui', 'voice', 'ambient'] as SoundCategory[]) {
                const gain = this.ctx.createGain();
                gain.gain.value = this.volumes[category];
                gain.connect(this.masterGain);
                this.categoryGains.set(category, gain);
            }

            // Load all sounds
            await this.loadAllSounds();

            this.initialized = true;
            console.log('[Audio] Initialized successfully');
            return true;
        } catch (error) {
            console.error('[Audio] Failed to initialize:', error);
            return false;
        }
    }

    private async loadAllSounds(): Promise<void> {
        if (!this.ctx) return;

        const loadPromises: Promise<void>[] = [];

        // Load sound effects
        for (const [id, config] of Object.entries(SOUND_CONFIG)) {
            loadPromises.push(this.loadSound(id as SoundId, config.path, config.category));
        }

        // Load music tracks
        for (const [id, path] of Object.entries(MUSIC_CONFIG)) {
            loadPromises.push(this.loadMusic(id, path));
        }

        await Promise.allSettled(loadPromises);
        console.log(`[Audio] Loaded ${this.sounds.size}/${SOUND_IDS.length} sounds, ${this.musicBuffers.size} music tracks`);
    }

    private async loadMusic(id: string, path: string): Promise<void> {
        if (!this.ctx) return;

        try {
            const response = await fetch(path);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);

            this.musicBuffers.set(id, audioBuffer);
            console.log(`[Audio] Loaded music: ${id}`);
        } catch (error) {
            console.warn(`[Audio] Failed to load music ${id}:`, error);
        }
    }

    private async loadSound(id: SoundId, path: string, category: SoundCategory): Promise<void> {
        if (!this.ctx) return;

        try {
            const response = await fetch(path);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);

            this.sounds.set(id, { buffer: audioBuffer, category });
            console.log(`[Audio] Loaded: ${id}`);
        } catch (error) {
            // Use procedural fallback
            console.warn(`[Audio] Using procedural fallback for: ${id}`);
            const buffer = generateProceduralSound(this.ctx, id);
            this.sounds.set(id, { buffer, category });
        }
    }

    // ============================================================================
    // PLAYBACK
    // ============================================================================

    play(soundId: SoundId, options: SoundOptions = {}): string | null {
        if (!this.initialized || !this.ctx || this.muted) return null;

        const sound = this.sounds.get(soundId);
        if (!sound) {
            console.warn(`[Audio] Sound not found: ${soundId}`);
            return null;
        }

        const {
            volume = 1.0,
            loop = false,
            pitch = 1.0,
            pan = 0,
            category = sound.category,
        } = options;

        // Create source
        const source = this.ctx.createBufferSource();
        source.buffer = sound.buffer;
        source.loop = loop;
        source.playbackRate.value = pitch;

        // Create gain
        const gainNode = this.ctx.createGain();
        gainNode.gain.value = volume;

        // Create panner
        const panNode = this.ctx.createStereoPanner();
        panNode.pan.value = pan;

        // Connect chain
        const categoryGain = this.categoryGains.get(category);
        source.connect(gainNode);
        gainNode.connect(panNode);
        panNode.connect(categoryGain || this.masterGain!);

        // Track
        const playId = `${soundId}_${Date.now()}`;
        this.playingSounds.set(playId, {
            source, gainNode, panNode,
            startTime: this.ctx.currentTime,
            loop,
        });

        source.onended = () => this.playingSounds.delete(playId);
        source.start();

        return playId;
    }

    stop(playId: string): void {
        const playing = this.playingSounds.get(playId);
        if (playing) {
            playing.source.stop();
            this.playingSounds.delete(playId);
        }
    }

    stopAll(): void {
        for (const [, playing] of this.playingSounds) {
            playing.source.stop();
        }
        this.playingSounds.clear();
    }

    // ============================================================================
    // MUSIC PLAYBACK
    // ============================================================================

    /**
     * Play background music (loops by default)
     */
    playMusic(trackId: string, fadeIn: boolean = true): void {
        if (!this.initialized || !this.ctx || this.muted) return;

        // Stop current music first
        this.stopMusic(false);

        const buffer = this.musicBuffers.get(trackId);
        if (!buffer) {
            console.warn(`[Audio] Music not found: ${trackId}`);
            return;
        }

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;

        const gainNode = this.ctx.createGain();
        const musicGain = this.categoryGains.get('music');

        // Start at 0 for fade-in or full volume
        gainNode.gain.value = fadeIn ? 0 : this.volumes.music;

        source.connect(gainNode);
        gainNode.connect(musicGain || this.masterGain!);

        this.currentMusic = { source, gainNode, trackId };
        source.start();

        // Fade in
        if (fadeIn) {
            gainNode.gain.linearRampToValueAtTime(
                this.volumes.music,
                this.ctx.currentTime + 2 // 2 second fade
            );
        }

        console.log(`[Audio] Playing music: ${trackId}`);
    }

    /**
     * Stop background music
     */
    stopMusic(fadeOut: boolean = true): void {
        if (!this.currentMusic || !this.ctx) return;

        const { source, gainNode } = this.currentMusic;

        if (fadeOut) {
            // Fade out over 1 second
            gainNode.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 1);
            setTimeout(() => {
                try { source.stop(); } catch (e) { /* already stopped */ }
            }, 1100);
        } else {
            try { source.stop(); } catch (e) { /* already stopped */ }
        }

        this.currentMusic = null;
    }

    /**
     * Check if music is playing
     */
    isMusicPlaying(): boolean {
        return this.currentMusic !== null;
    }

    /**
     * Get current music track ID
     */
    getCurrentMusicTrack(): string | null {
        return this.currentMusic?.trackId || null;
    }

    // ============================================================================
    // VOLUME CONTROL
    // ============================================================================

    setMasterVolume(volume: number): void {
        if (this.masterGain) {
            this.masterGain.gain.value = Math.max(0, Math.min(1, volume));
        }
    }

    getMasterVolume(): number {
        return this.masterGain?.gain.value || 1;
    }

    setCategoryVolume(category: SoundCategory, volume: number): void {
        this.volumes[category] = Math.max(0, Math.min(1, volume));
        const gain = this.categoryGains.get(category);
        if (gain) gain.gain.value = this.volumes[category];
    }

    getCategoryVolume(category: SoundCategory): number {
        return this.volumes[category];
    }

    /**
     * Get volume for a category (including 'master')
     */
    getVolume(category: 'master' | SoundCategory): number {
        if (category === 'master') {
            return this.getMasterVolume();
        }
        return this.getCategoryVolume(category);
    }

    /**
     * Set volume for a category (including 'master')
     */
    setVolume(category: 'master' | SoundCategory, volume: number): void {
        if (category === 'master') {
            this.setMasterVolume(volume);
        } else {
            this.setCategoryVolume(category, volume);
        }
    }

    setMuted(muted: boolean): void {
        this.muted = muted;
        if (this.masterGain) {
            this.masterGain.gain.value = muted ? 0 : 1;
        }
    }

    isMuted(): boolean {
        return this.muted;
    }

    toggleMute(): boolean {
        this.setMuted(!this.muted);
        return this.muted;
    }

    isInitialized(): boolean {
        return this.initialized;
    }

    getState(): AudioContextState | 'uninitialized' {
        return this.ctx?.state || 'uninitialized';
    }

    async resume(): Promise<void> {
        if (this.ctx?.state === 'suspended') {
            await this.ctx.resume();
        }
    }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

export function getAudio(): AudioManager {
    return AudioManager.getInstance();
}

export async function initAudio(): Promise<boolean> {
    return AudioManager.getInstance().initialize();
}

export function playSfx(id: SoundId, options?: SoundOptions): string | null {
    return AudioManager.getInstance().play(id, options);
}

export function playUI(id: 'click' | 'hover' | 'confirm'): void {
    AudioManager.getInstance().play(id, { category: 'ui' });
}

export function playWeaponFire(weaponType: string, pan: number = 0): void {
    const audio = AudioManager.getInstance();
    const pitchVariation = 0.9 + Math.random() * 0.2;

    if (weaponType.toLowerCase().includes('laser') || weaponType.toLowerCase().includes('charge')) {
        audio.play('laser', { pitch: pitchVariation, pan });
    } else {
        audio.play('gunshot', { pitch: pitchVariation, pan });
    }
}

export function playHit(damage: number, pan: number = 0): void {
    const volume = Math.min(1, 0.5 + damage / 100);
    AudioManager.getInstance().play('hit', { volume, pan });
}

/**
 * Play background music (loops automatically)
 */
export function playMusic(trackId: string): void {
    AudioManager.getInstance().playMusic(trackId);
}

/**
 * Stop background music
 */
export function stopMusic(): void {
    AudioManager.getInstance().stopMusic();
}
