/**
 * Tactile & Acoustic Micro-Feedback Utility
 * Provides native hardware vibration on mobile and synthesized micro-ticks
 * via Web Audio API for an authentic Apple-grade tactile feel.
 */

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!audioContext || audioContext.state === 'closed') {
      audioContext = new AudioCtx();
    }
    if (audioContext.state === 'suspended') {
      audioContext.resume().catch(() => {});
    }
    return audioContext;
  } catch {
    return null;
  }
}

/**
 * Triggered at the exact instant the pull crosses the threshold.
 * Arms the user's thumb before they release.
 */
export function triggerThresholdTick() {
  // 1. Hardware vibration for mobile devices
  if (typeof window !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(10);
    } catch {}
  }

  // 2. Synthesized 12ms acoustic micro-tick (resembling Apple Taptic click)
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    // Crisp pitch drop from 1200Hz to 250Hz in 12ms
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(250, now + 0.012);

    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.012);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.014);
  } catch {}
}

/**
 * Triggered when a refresh completes successfully.
 */
export function triggerSuccessHaptic() {
  if (typeof window !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([8, 30, 12]);
    } catch {}
  }
}
