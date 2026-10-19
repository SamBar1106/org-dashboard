type Cue = "select" | "alert" | "packet" | "step";

let ctx: AudioContext | null = null;
let muted = true;

export function syncMute(next: boolean): void {
  muted = next;
  if (muted || typeof window === "undefined" || typeof AudioContext === "undefined") return;
  ctx = ctx ?? new AudioContext();
  void ctx.resume();
}

export function playCue(cue: Cue): void {
  if (muted || !ctx) return;
  const spec = cueSpec(cue);
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = spec.type;
  osc.frequency.setValueAtTime(spec.freq, now);
  if (spec.to) osc.frequency.exponentialRampToValueAtTime(Math.max(spec.to, 1), now + spec.dur);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(spec.gain, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + spec.dur);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + spec.dur + 0.02);
}

function cueSpec(cue: Cue): { type: OscillatorType; freq: number; to?: number; dur: number; gain: number } {
  switch (cue) {
    case "select":
      return { type: "sine", freq: 660, dur: 0.08, gain: 0.04 };
    case "alert":
      return { type: "square", freq: 180, to: 90, dur: 0.22, gain: 0.03 };
    case "packet":
      return { type: "triangle", freq: 880, to: 1320, dur: 0.12, gain: 0.03 };
    case "step":
      return { type: "sine", freq: 440, to: 660, dur: 0.16, gain: 0.04 };
    default: {
      const neverCue: never = cue;
      return neverCue;
    }
  }
}
