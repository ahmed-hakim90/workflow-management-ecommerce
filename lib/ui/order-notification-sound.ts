/**
 * Short pleasant chime for a new order (no external audio asset).
 * May be blocked until the user has interacted with the page.
 */
export function playOrderNotificationSound() {
  if (typeof window === "undefined") return;
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
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
    setTimeout(() => {
      void ctx.close();
    }, 800);
  } catch {
    /* autoplay or unsupported */
  }
}
