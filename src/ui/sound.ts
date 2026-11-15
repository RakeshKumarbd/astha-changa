// Small synthesized sound effects (no audio files needed).

const MUTE_KEY = 'astha-changa:muted';

let ctx: AudioContext | null = null;
let muted = (() => {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
})();

export const isMuted = (): boolean => muted;

export function setMuted(m: boolean): void {
  muted = m;
  try {
    localStorage.setItem(MUTE_KEY, m ? '1' : '0');
  } catch {
    /* storage unavailable */
  }
}

function audio(): AudioContext | null {
  if (muted) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.15): void {
  const a = audio();
  if (!a) return;
  const t0 = a.currentTime + start;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + dur);
}

/** A short burst of noise, like a shell hitting the floor. */
function click(start: number, gain = 0.25): void {
  const a = audio();
  if (!a) return;
  const len = Math.floor(a.sampleRate * 0.03);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
  const src = a.createBufferSource();
  const filter = a.createBiquadFilter();
  const g = a.createGain();
  src.buffer = buf;
  filter.type = 'bandpass';
  filter.frequency.value = 2500 + Math.random() * 1500;
  g.gain.value = gain;
  src.connect(filter).connect(g).connect(a.destination);
  src.start(a.currentTime + start);
}

export const sfx = {
  shells(): void {
    for (let i = 0; i < 7; i++) click(i * 0.06 + Math.random() * 0.04, 0.15 + Math.random() * 0.2);
  },
  hop(): void {
    tone(520, 0, 0.07, 'triangle', 0.08);
  },
  bonus(): void {
    tone(660, 0, 0.12, 'triangle');
    tone(880, 0.1, 0.18, 'triangle');
  },
  capture(): void {
    tone(440, 0, 0.15, 'square', 0.07);
    tone(220, 0.12, 0.3, 'square', 0.07);
  },
  home(): void {
    [523, 659, 784].forEach((f, i) => tone(f, i * 0.09, 0.2, 'triangle', 0.1));
  },
  win(): void {
    [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, i * 0.13, 0.3, 'triangle', 0.12));
  },
  noMove(): void {
    tone(300, 0, 0.2, 'sine', 0.1);
    tone(250, 0.15, 0.25, 'sine', 0.1);
  },
};
