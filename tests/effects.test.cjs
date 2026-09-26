const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../js/effects.js'), 'utf8');

function setup(Audio) {
  const tones = [];
  const contexts = [];
  class AudioContext {
    constructor() { this.state = 'running'; this.currentTime = 0; contexts.push(this); }
    suspend() { this.state = 'suspended'; return Promise.resolve(); }
    resume() { this.state = 'running'; return Promise.resolve(); }
    createOscillator() {
      const tone = { connected: false, frequency: { setValueAtTime() {} },
        connect() { this.connected = true; }, disconnect() { this.connected = false; },
        start() {}, stop(at = 0) { this.stopAt = at; } };
      tones.push(tone); return tone;
    }
    createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} }; }
  }
  const context = vm.createContext({ Audio, AudioContext, localStorage: { getItem() {}, setItem() {} } });
  vm.runInContext(source, context);
  return { effects: context.WordsEffects, tones, contexts };
}

test('mute cancels queued fallback tones so later feedback cannot replay the old cue', () => {
  const { effects, tones, contexts } = setup();
  effects.play('complete');
  assert.equal(tones.length, 3);
  effects.setMuted(true);
  assert.ok(tones.every(tone => tone.stopAt === 0 && !tone.connected));
  effects.play('correct');
  assert.equal(tones.length, 3);
  effects.setMuted(false);
  effects.play('wrong');
  assert.equal(tones.length, 5);
  assert.ok(tones.slice(0, 3).every(tone => !tone.connected));
  assert.equal(contexts[0].state, 'running');
});

test('a failed sample falls back once, and muting suppresses delayed sample failures', async () => {
  const instances = [];
  class Audio {
    cloneNode() { const instance = new Audio(); instance.events = {}; instances.push(instance); return instance; }
    addEventListener(type, handler) { this.events[type] = handler; }
    play() { return Promise.reject(new Error('unsupported')); }
    pause() { this.paused = true; }
  }
  const { effects, tones } = setup(Audio);
  effects.play('correct');
  instances[0].events.error();
  await Promise.resolve();
  assert.equal(tones.length, 2);
  effects.play('complete');
  effects.setMuted(true);
  instances[1].events.error();
  await Promise.resolve();
  assert.equal(instances[1].paused, true);
  assert.equal(tones.length, 2);
});
