/**
 * Procedural Quindar Audio & Telemetry Sonification
 * Zero-byte native Web Audio API synthesizer.
 * Recreates authentic Apollo Quindar tones (2,525 Hz intro / 2,475 Hz outro)
 * and deep cryogenic cold-trap warning telemetry.
 */

class QuindarAudioEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private coldTrapOsc: OscillatorNode | null = null;
  private coldTrapGain: GainNode | null = null;

  constructor() {
    // Load persisted mute preference if available
    try {
      const stored = localStorage.getItem('fc_audio_muted');
      if (stored !== null) {
        this.isMuted = stored === 'true';
      }
    } catch {
      // Ignore localStorage restrictions
    }
  }

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    try {
      localStorage.setItem('fc_audio_muted', String(muted));
    } catch {}

    if (muted && this.coldTrapGain && this.ctx) {
      this.coldTrapGain.gain.setValueAtTime(0, this.ctx.currentTime);
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  /**
   * Authentic 250ms Apollo Quindar Tone
   * Intro tone: 2,525 Hz (Ground-to-Space PTT enable)
   * Outro tone: 2,475 Hz (Ground-to-Space PTT release)
   */
  public playQuindar(type: 'intro' | 'outro' = 'intro') {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      const freq = type === 'intro' ? 2525 : 2475;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      // 250ms duration with smooth 15ms envelope attack & 30ms release
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.08, now + 0.015);
      gain.gain.setValueAtTime(0.08, now + 0.22);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.26);
    } catch {
      // Audio context might be restricted before first gesture
    }
  }

  /**
   * Low-frequency cryogenic cold-trap telemetry hum (55 Hz sub-bass)
   */
  public updateColdTrapHum(isInDarkness: boolean) {
    if (this.isMuted) return;
    this.initContext();
    if (!this.ctx) return;

    try {
      if (!this.coldTrapOsc) {
        this.coldTrapOsc = this.ctx.createOscillator();
        this.coldTrapGain = this.ctx.createGain();

        this.coldTrapOsc.type = 'sawtooth';
        this.coldTrapOsc.frequency.setValueAtTime(55, this.ctx.currentTime);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(120, this.ctx.currentTime);

        this.coldTrapOsc.connect(filter);
        filter.connect(this.coldTrapGain);
        this.coldTrapGain.connect(this.ctx.destination);

        this.coldTrapGain.gain.setValueAtTime(0, this.ctx.currentTime);
        this.coldTrapOsc.start();
      }

      if (this.coldTrapGain) {
        const targetGain = isInDarkness && !this.isMuted ? 0.035 : 0.0;
        this.coldTrapGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.2);
      }
    } catch {
      // Graceful silence on audio failure
    }
  }
}

export const quindar = new QuindarAudioEngine();
