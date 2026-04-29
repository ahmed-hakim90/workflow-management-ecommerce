/**
 * Short pleasant chime for a new order (no external audio asset).
 * Browsers suspend AudioContext until a user gesture; we reuse one context,
 * call resume() before playing, and prime on first pointer/key interaction.
 */

let sharedCtx: AudioContext | null = null;

function getSharedContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!sharedCtx || sharedCtx.state === "closed") {
    sharedCtx = new Ctx();
  }
  return sharedCtx;
}

let primed = false;

/** Unlock audio after the next user gesture (required by many browsers). Safe to call once at shell mount. */
export function primeOrderNotificationAudio(): void {
  if (typeof window === "undefined" || primed) return;
  primed = true;
  const unlock = () => {
    const ctx = getSharedContext();
    if (ctx?.state === "suspended") void ctx.resume();
  };
  window.addEventListener("pointerdown", unlock, { passive: true, capture: true });
  window.addEventListener("keydown", unlock, { passive: true, capture: true });
}

function playIntoContext(ctx: AudioContext): void {
  const now = ctx.currentTime;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(0.12, now + 0.02);
  g.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
  g.connect(ctx.destination);

  const freqs = [523.25, 659.25, 784];
  for (let i = 0; i < freqs.length; i++) {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freqs[i], now);
    const start = now + i * 0.08;
    const stop = start + 0.18;
    osc.connect(g);
    osc.start(start);
    osc.stop(stop);
  }
}

export function playOrderNotificationSound(): void {
  if (typeof window === "undefined") return;
  const ctx = getSharedContext();
  if (!ctx) return;

  const run = () => {
    try {
      playIntoContext(ctx);
    } catch {
      /* unsupported */
    }
  };

  if (ctx.state === "running") {
    run();
    return;
  }

  void ctx
    .resume()
    .then(run)
    .catch(() => {
      try {
        run();
      } catch {
        /* still blocked */
      }
    });
}
