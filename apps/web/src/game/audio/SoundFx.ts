import type { GameEvent } from "@bubble-battle/game-core";

class SoundFx {
  private context: AudioContext | null = null;
  private lastExplosionTime = -1;
  private muted = false;

  unlock(): void {
    if (this.context === null) {
      this.context = new AudioContext();
    }
    if (this.context.state === "suspended") {
      void this.context.resume();
    }
  }

  toggleMuted(): boolean {
    this.muted = !this.muted;
    return this.muted;
  }

  isMuted(): boolean {
    return this.muted;
  }

  playEvent(event: GameEvent): void {
    if (this.muted) {
      return;
    }

    if (event.type === "balloon-placed") {
      this.tone(210, 0.07, "sine", 0.035, 130);
    } else if (event.type === "balloon-exploded") {
      const now = this.context?.currentTime ?? 0;
      if (now - this.lastExplosionTime > 0.045) {
        this.lastExplosionTime = now;
        this.noiseBurst(0.14, 0.055);
        this.tone(105, 0.13, "square", 0.025, 62);
      }
    } else if (
      event.type === "item-picked" ||
      event.type === "item-revealed"
    ) {
      this.tone(520, 0.08, "sine", 0.03, 820);
    } else if (event.type === "player-trapped") {
      this.tone(360, 0.18, "sine", 0.04, 170);
    } else if (event.type === "player-freed") {
      this.tone(430, 0.14, "triangle", 0.04, 760);
    } else if (event.type === "player-died") {
      this.tone(240, 0.35, "sawtooth", 0.04, 82);
    } else if (event.type === "storm-advanced") {
      this.tone(92, 0.28, "sine", 0.035, 58);
    } else if (event.type === "round-ended") {
      if (event.result.winnerId === 1) {
        this.chord([523, 659, 784], 0.42);
      } else {
        this.chord([196, 247, 294], 0.38);
      }
    }
  }

  private tone(
    startFrequency: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    endFrequency: number,
  ): void {
    this.unlock();
    const context = this.context;
    if (context === null) {
      return;
    }

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(startFrequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(30, endFrequency),
      now + duration,
    );
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  private chord(frequencies: number[], duration: number): void {
    frequencies.forEach((frequency, index) => {
      window.setTimeout(() => {
        this.tone(
          frequency,
          duration,
          "triangle",
          0.025,
          frequency * 1.02,
        );
      }, index * 65);
    });
  }

  private noiseBurst(duration: number, volume: number): void {
    this.unlock();
    const context = this.context;
    if (context === null) {
      return;
    }

    const length = Math.floor(context.sampleRate * duration);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) {
      const envelope = 1 - index / length;
      data[index] = (Math.random() * 2 - 1) * envelope;
    }

    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    filter.type = "lowpass";
    filter.frequency.value = 820;
    gain.gain.value = volume;
    source.buffer = buffer;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(context.destination);
    source.start();
  }
}

export const soundFx = new SoundFx();
