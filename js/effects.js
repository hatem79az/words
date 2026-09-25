(function (root) {
  'use strict';
  const STORAGE_KEY = 'words.sound.v1';
  let muted = false;
  let audio = null;
  try { muted = localStorage.getItem(STORAGE_KEY) === 'muted'; } catch (_) { /* optional preference */ }

  function isMuted() { return muted; }

  function setMuted(value) {
    muted = Boolean(value);
    try { localStorage.setItem(STORAGE_KEY, muted ? 'muted' : 'on'); } catch (_) { /* optional preference */ }
  }

  function tone(ctx, frequency, start, duration, volume, type = 'sine') {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain); gain.connect(ctx.destination);
    oscillator.start(start); oscillator.stop(start + duration + 0.01);
  }

  function play(kind) {
    if (muted) return;
    const AudioCtor = root.AudioContext || root.webkitAudioContext;
    if (!AudioCtor) return;
    try {
      if (!audio) audio = new AudioCtor();
      if (audio.state === 'suspended') audio.resume().catch(() => {});
      const at = audio.currentTime + 0.005;
      if (kind === 'correct') {
        tone(audio, 523.25, at, 0.16, 0.035);
        tone(audio, 659.25, at + 0.085, 0.19, 0.035);
      } else if (kind === 'complete') {
        tone(audio, 523.25, at, 0.16, 0.03);
        tone(audio, 659.25, at + 0.1, 0.16, 0.03);
        tone(audio, 783.99, at + 0.2, 0.28, 0.035);
      } else if (kind === 'wrong') {
        tone(audio, 293.66, at, 0.12, 0.022, 'triangle');
        tone(audio, 246.94, at + 0.075, 0.16, 0.02, 'triangle');
      }
    } catch (_) { /* sound must never prevent the game from working */ }
  }

  function animate(element, kind) {
    if (!element || !element.animate || (root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
    for (const previous of element.getAnimations()) previous.cancel();
    const keyframes = kind === 'wrong'
      ? [{ transform: 'translateX(0)' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(4px)' }, { transform: 'translateX(0)' }]
      : kind === 'card'
        ? [{ transform: 'translateY(9px)', opacity: .55 }, { transform: 'translateY(0)', opacity: 1 }]
        : [{ transform: 'translateY(2px) scale(.97)', opacity: .7 }, { transform: 'translateY(-3px) scale(1.025)', opacity: 1 }, { transform: 'translateY(0) scale(1)', opacity: 1 }];
    element.animate(keyframes, { duration: kind === 'wrong' ? 220 : 260, easing: 'ease-out' });
  }

  root.WordsEffects = { isMuted, setMuted, play, animate };
})(globalThis);
