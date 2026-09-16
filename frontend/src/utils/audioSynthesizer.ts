// Web Audio API Synthesizer for Demo Tracks & Real-time Playback

export class DemoAudioSynthesizer {
  private ctx: AudioContext | null = null;
  private currentNodes: Array<{ stop: () => void }> = [];
  private isPlaying: boolean = false;
  private volumeNode: GainNode | null = null;
  private analyserNode: AnalyserNode | null = null;

  private initContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public getAnalyser(): AnalyserNode | null {
    return this.analyserNode;
  }

  public getFrequencyData(arraySize: number = 64): Uint8Array | null {
    if (!this.analyserNode) return null;
    const buffer = new Uint8Array(this.analyserNode.frequencyBinCount);
    this.analyserNode.getByteFrequencyData(buffer);
    if (arraySize === buffer.length) return buffer;
    const res = new Uint8Array(arraySize);
    const step = buffer.length / arraySize;
    for (let i = 0; i < arraySize; i++) {
      res[i] = buffer[Math.floor(i * step)];
    }
    return res;
  }

  public getTimeDomainData(arraySize: number = 128): Uint8Array | null {
    if (!this.analyserNode) return null;
    const buffer = new Uint8Array(this.analyserNode.frequencyBinCount);
    this.analyserNode.getByteTimeDomainData(buffer);
    if (arraySize === buffer.length) return buffer;
    const res = new Uint8Array(arraySize);
    const step = buffer.length / arraySize;
    for (let i = 0; i < arraySize; i++) {
      res[i] = buffer[Math.floor(i * step)];
    }
    return res;
  }

  private currentAudioElement: HTMLAudioElement | null = null;

  public stop(): void {
    if (this.currentAudioElement) {
      try {
        this.currentAudioElement.pause();
        this.currentAudioElement.currentTime = 0;
      } catch {
        // ignore
      }
      this.currentAudioElement = null;
    }
    this.currentNodes.forEach(node => {
      try {
        node.stop();
      } catch {
        // ignore already stopped
      }
    });
    this.currentNodes = [];
    this.isPlaying = false;
  }

  public setVolume(val: number): void {
    if (this.volumeNode && this.ctx) {
      this.volumeNode.gain.setValueAtTime(Math.max(0, Math.min(1, val)), this.ctx.currentTime);
    }
    if (this.currentAudioElement) {
      this.currentAudioElement.volume = Math.max(0, Math.min(1, val));
    }
  }

  public seek(seconds: number): void {
    if (this.currentAudioElement && isFinite(seconds)) {
      try {
        this.currentAudioElement.currentTime = seconds;
      } catch {
        // ignore
      }
    }
  }

  public connectMicrophoneStream(stream: MediaStream): { 
    analyser: AnalyserNode; 
    sampleRate: number;
    getFrequencyData: (size?: number) => Uint8Array; 
    stop: () => void 
  } {
    this.stop();
    const ctx = this.initContext();
    const sourceNode = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.65;
    sourceNode.connect(analyser);
    // Do NOT connect to ctx.destination to avoid mic feedback screeching
    this.analyserNode = analyser;
    this.isPlaying = true;

    return {
      analyser,
      sampleRate: ctx.sampleRate,
      getFrequencyData: (size: number = 64) => {
        const buffer = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(buffer);
        if (size === buffer.length) return buffer;
        const res = new Uint8Array(size);
        const step = buffer.length / size;
        for (let i = 0; i < size; i++) {
          res[i] = buffer[Math.floor(i * step)];
        }
        return res;
      },
      stop: () => {
        try {
          sourceNode.disconnect();
          analyser.disconnect();
        } catch {
          // ignore
        }
        this.isPlaying = false;
        this.analyserNode = null;
      }
    };
  }

  public playNativeAudioFile(
    fileOrBlob: File | Blob, 
    volume: number = 0.8, 
    onEnded?: () => void,
    onTimeUpdate?: (currentTime: number, duration: number) => void
  ): AnalyserNode {
    this.stop();
    const ctx = this.initContext();

    this.volumeNode = ctx.createGain();
    this.volumeNode.gain.setValueAtTime(volume, ctx.currentTime);

    this.analyserNode = ctx.createAnalyser();
    this.analyserNode.fftSize = 256;
    this.analyserNode.smoothingTimeConstant = 0.8;

    const audioUrl = URL.createObjectURL(fileOrBlob);
    const audio = new Audio(audioUrl);
    audio.volume = volume;
    this.currentAudioElement = audio;

    try {
      const sourceNode = ctx.createMediaElementSource(audio);
      sourceNode.connect(this.volumeNode);
    } catch {
      // Fallback if media element source node fails
    }

    this.volumeNode.connect(this.analyserNode);
    this.analyserNode.connect(ctx.destination);

    this.isPlaying = true;

    audio.onloadedmetadata = () => {
      if (onTimeUpdate && isFinite(audio.duration) && audio.duration > 0) {
        onTimeUpdate(0, audio.duration);
      }
    };

    audio.ontimeupdate = () => {
      if (onTimeUpdate && isFinite(audio.duration) && audio.duration > 0) {
        onTimeUpdate(audio.currentTime, audio.duration);
      }
    };

    audio.onended = () => {
      this.isPlaying = false;
      this.currentAudioElement = null;
      if (onEnded) onEnded();
    };

    audio.play().catch(err => {
      console.warn('Playback error:', err);
    });

    return this.analyserNode;
  }

  public playDemoSound(trackId: string, volume: number = 0.7, onEnded?: () => void): AnalyserNode {
    this.stop();
    const ctx = this.initContext();

    this.volumeNode = ctx.createGain();
    this.volumeNode.gain.setValueAtTime(volume, ctx.currentTime);

    this.analyserNode = ctx.createAnalyser();
    this.analyserNode.fftSize = 256;
    this.analyserNode.smoothingTimeConstant = 0.8;

    this.volumeNode.connect(this.analyserNode);
    this.analyserNode.connect(ctx.destination);

    this.isPlaying = true;

    const duration = 8; // 8 seconds demo play duration

    switch (trackId) {
      case 'demo-quad-hover':
        this.synthQuadcopterHover(ctx, this.volumeNode, duration);
        break;
      case 'demo-quad-takeoff':
        this.synthQuadcopterTakeoff(ctx, this.volumeNode, duration);
        break;
      case 'demo-quad-flyover':
        this.synthQuadcopterFlyover(ctx, this.volumeNode, duration);
        break;
      case 'demo-fpv-drone':
        this.synthFPVDrone(ctx, this.volumeNode, duration);
        break;
      case 'demo-fan-noise':
        this.synthFanNoise(ctx, this.volumeNode, duration);
        break;
      case 'demo-bird-sounds':
        this.synthBirdSounds(ctx, this.volumeNode, duration);
        break;
      case 'demo-motorcycle':
        this.synthMotorcycle(ctx, this.volumeNode, duration);
        break;
      case 'demo-wind-noise':
        this.synthWindNoise(ctx, this.volumeNode, duration);
        break;
      case 'demo-silence':
        this.synthSilence(ctx, this.volumeNode, duration);
        break;
      default:
        this.synthQuadcopterHover(ctx, this.volumeNode, duration);
    }

    setTimeout(() => {
      if (this.isPlaying) {
        this.stop();
        if (onEnded) onEnded();
      }
    }, duration * 1000);

    return this.analyserNode;
  }

  // --- Quadcopter Hovering (Blade Pass Frequencies + Motor Resonance) ---
  private synthQuadcopterHover(ctx: AudioContext, destination: GainNode, duration: number) {
    const baseFreqs = [185, 370, 555, 740]; // Blade pass fundamental and harmonics
    baseFreqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = idx === 0 ? 'sine' : 'sawtooth';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      
      // Slight pitch wobble for rotor variance
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.setValueAtTime(2 + idx, ctx.currentTime);
      lfoGain.gain.setValueAtTime(3, ctx.currentTime);
      lfo.connect(osc.frequency);
      lfo.start();
      this.currentNodes.push(lfo);

      gain.gain.setValueAtTime(0.2 / (idx + 1), ctx.currentTime);
      osc.connect(gain);
      gain.connect(destination);

      osc.start();
      osc.stop(ctx.currentTime + duration);
      this.currentNodes.push(osc);
    });
  }

  // --- Quadcopter Takeoff (RPM Ramp Up) ---
  private synthQuadcopterTakeoff(ctx: AudioContext, destination: GainNode, duration: number) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(520, ctx.currentTime + duration * 0.8);

    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.35, ctx.currentTime + duration * 0.5);

    osc.connect(gain);
    gain.connect(destination);

    osc.start();
    osc.stop(ctx.currentTime + duration);
    this.currentNodes.push(osc);
  }

  // --- Quadcopter Flyover (Doppler Pitch Shift) ---
  private synthQuadcopterFlyover(ctx: AudioContext, destination: GainNode, duration: number) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(450, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(210, ctx.currentTime + duration);

    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + duration * 0.5);
    gain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + duration);

    if (panner) {
      panner.pan.setValueAtTime(-0.9, ctx.currentTime);
      panner.pan.linearRampToValueAtTime(0.9, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(panner);
      panner.connect(destination);
    } else {
      osc.connect(gain);
      gain.connect(destination);
    }

    osc.start();
    osc.stop(ctx.currentTime + duration);
    this.currentNodes.push(osc);
  }

  // --- FPV Racing Drone (High RPM Screaming Pitch) ---
  private synthFPVDrone(ctx: AudioContext, destination: GainNode, duration: number) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(650, ctx.currentTime);
    
    // Throttle variance
    for (let t = 0; t < duration; t += 1.5) {
      const targetFreq = 500 + Math.random() * 600;
      osc.frequency.linearRampToValueAtTime(targetFreq, ctx.currentTime + t + 0.8);
    }

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    osc.connect(gain);
    gain.connect(destination);

    osc.start();
    osc.stop(ctx.currentTime + duration);
    this.currentNodes.push(osc);
  }

  // --- Fan Noise (Broadband Air Turbulence) ---
  private synthFanNoise(ctx: AudioContext, destination: GainNode, duration: number) {
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(320, ctx.currentTime);
    filter.Q.setValueAtTime(0.8, ctx.currentTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.2, ctx.currentTime);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(destination);

    noise.start();
    noise.stop(ctx.currentTime + duration);
    this.currentNodes.push(noise);
  }

  // --- Bird Sounds (High Chirp Melodies) ---
  private synthBirdSounds(ctx: AudioContext, destination: GainNode, duration: number) {
    for (let t = 0.5; t < duration - 1; t += 1.8) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      const startFreq = 2800 + Math.random() * 600;
      osc.frequency.setValueAtTime(startFreq, ctx.currentTime + t);
      osc.frequency.linearRampToValueAtTime(startFreq + 800, ctx.currentTime + t + 0.15);
      osc.frequency.linearRampToValueAtTime(startFreq - 400, ctx.currentTime + t + 0.3);

      gain.gain.setValueAtTime(0.001, ctx.currentTime + t);
      gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.35);

      osc.connect(gain);
      gain.connect(destination);

      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.4);
      this.currentNodes.push(osc);
    }
  }

  // --- Motorcycle Exhaust (Low Sawtooth Engine Rumbles) ---
  private synthMotorcycle(ctx: AudioContext, destination: GainNode, duration: number) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(85, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(140, ctx.currentTime + duration * 0.6);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(350, ctx.currentTime);

    gain.gain.setValueAtTime(0.35, ctx.currentTime);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(destination);

    osc.start();
    osc.stop(ctx.currentTime + duration);
    this.currentNodes.push(osc);
  }

  // --- Wind Noise (Deep Low-Pass Pink Noise) ---
  private synthWindNoise(ctx: AudioContext, destination: GainNode, duration: number) {
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      data[i] = b0 + b1 + b2;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(160, ctx.currentTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.25, ctx.currentTime);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(destination);

    noise.start();
    noise.stop(ctx.currentTime + duration);
    this.currentNodes.push(noise);
  }

  // --- Silence ---
  private synthSilence(ctx: AudioContext, destination: GainNode, duration: number) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.00001, ctx.currentTime);
    osc.connect(gain);
    gain.connect(destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
    this.currentNodes.push(osc);
  }
}

export const audioSynthesizer = new DemoAudioSynthesizer();
