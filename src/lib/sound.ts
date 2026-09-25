/**
 * Game sounds, synthesized with the Web Audio API so no audio files or
 * licences are needed. Every function is a no-op where audio is unavailable.
 */

export type SoundName = "move" | "capture" | "castle" | "check" | "promote" | "gameEnd";

let context: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined" || typeof window.AudioContext !== "function") return null;
  context ??= new window.AudioContext();
  if (context.state === "suspended") void context.resume();
  return context;
}

/** A short filtered noise burst, like a piece set down on wood. */
function knock(ctx: AudioContext, { at = 0, pitch = 1800, level = 0.6, length = 0.07 } = {}) {
  const start = ctx.currentTime + at;
  const samples = Math.floor(ctx.sampleRate * length);
  const buffer = ctx.createBuffer(1, samples, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < samples; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / samples) ** 3;
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = pitch;
  filter.Q.value = 1.2;
  const gain = ctx.createGain();
  gain.gain.value = level;
  source.connect(filter).connect(gain).connect(ctx.destination);
  source.start(start);
}

/** A soft sine tone with a quick fade. */
function tone(ctx: AudioContext, frequency: number, { at = 0, length = 0.18, level = 0.18 } = {}) {
  const start = ctx.currentTime + at;
  const oscillator = ctx.createOscillator();
  oscillator.type = "sine";
  oscillator.frequency.value = frequency;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(level, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + length + 0.02);
}

export function playSound(name: SoundName): void {
  const ctx = audio();
  if (!ctx) return;
  switch (name) {
    case "move":
      knock(ctx);
      break;
    case "capture":
      knock(ctx, { pitch: 1200, level: 0.8, length: 0.09 });
      knock(ctx, { at: 0.05, pitch: 2200, level: 0.4 });
      break;
    case "castle":
      knock(ctx);
      knock(ctx, { at: 0.09, pitch: 1500 });
      break;
    case "check":
      knock(ctx);
      tone(ctx, 988, { at: 0.02, length: 0.2 });
      break;
    case "promote":
      knock(ctx);
      tone(ctx, 784, { at: 0.03 });
      tone(ctx, 1175, { at: 0.11 });
      break;
    case "gameEnd":
      tone(ctx, 523, { length: 0.4 });
      tone(ctx, 659, { at: 0.12, length: 0.4 });
      tone(ctx, 784, { at: 0.24, length: 0.6 });
      break;
  }
}

/** Pick the sound for a move from its flags. */
export function soundForMove(move: {
  san: string;
  isCapture(): boolean;
  isPromotion(): boolean;
  isKingsideCastle(): boolean;
  isQueensideCastle(): boolean;
}): SoundName {
  if (move.san.endsWith("#")) return "gameEnd";
  if (move.san.endsWith("+")) return "check";
  if (move.isPromotion()) return "promote";
  if (move.isCapture()) return "capture";
  if (move.isKingsideCastle() || move.isQueensideCastle()) return "castle";
  return "move";
}
