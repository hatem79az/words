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

  function celebrate(host) {
    if (!host || !root.requestAnimationFrame ||
        (root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
    try {
      const width = host.clientWidth;
      const height = Math.min(host.clientHeight, 460);
      if (!width || !height) return;
      const canvas = root.document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) return;
      const ratio = Math.min(root.devicePixelRatio || 1, 2);
      canvas.className = 'celebration-confetti';
      canvas.setAttribute('aria-hidden', 'true');
      canvas.style.height = `${height}px`;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.scale(ratio, ratio);
      host.append(canvas);
      const colors = ['#5142bf', '#18a3a1', '#df765e', '#e8b34e', '#8d72dd'];
      const particles = Array.from({ length: 50 }, (_, index) => ({
        x: width / 2 + (Math.random() - .5) * 45,
        y: Math.min(height * .33, 145),
        vx: (Math.random() - .5) * Math.min(width * .9, 660),
        vy: -(110 + Math.random() * 220),
        rotation: Math.random() * Math.PI,
        spin: (Math.random() - .5) * 10,
        size: 4 + Math.random() * 5,
        color: colors[index % colors.length]
      }));
      let start = null;
      const frame = now => {
        if (!canvas.isConnected) return;
        if (start === null) start = now;
        const time = (now - start) / 1000;
        context.clearRect(0, 0, width, height);
        context.globalAlpha = Math.max(0, Math.min(1, (1.25 - time) * 3));
        for (const piece of particles) {
          const x = piece.x + piece.vx * time;
          const y = piece.y + piece.vy * time + 240 * time * time;
          if (y < -12 || y > height + 12) continue;
          context.save();
          context.translate(x, y);
          context.rotate(piece.rotation + piece.spin * time);
          context.fillStyle = piece.color;
          context.fillRect(-piece.size / 2, -piece.size / 3, piece.size, piece.size * .66);
          context.restore();
        }
        if (time < 1.25) root.requestAnimationFrame(frame);
        else canvas.remove();
      };
      root.requestAnimationFrame(frame);
    } catch (_) { /* decoration must never prevent a completed round from being recorded */ }
  }

  root.WordsEffects = { isMuted, setMuted, play, animate, celebrate };
})(globalThis);
