// Synth audio for CALA VERDE. One job: every sound is synthesized with WebAudio
// — engine hum, sirens, gunshots, and 3 radio stations. No audio files, no network.

import { RADIO_STATIONS } from './config.js';

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.radioGain = null;
    this.radioTimer = null;
    this.station = 0;
    this.step = 0;
    this.nextNoteAt = 0;
    this.ready = false;
  }

  init() {
    if (this.ready) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      // engine hum
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(this.engineGain).connect(this.master);
      this.engineOsc.start();
      // police siren (two-tone)
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'sine';
      this.sirenOsc.frequency.value = 700;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain).connect(this.master);
      this.sirenOsc.start();
      // radio bus
      this.radioGain = this.ctx.createGain();
      this.radioGain.gain.value = 0.16;
      this.radioGain.connect(this.master);
      this.ready = true;
      this.nextNoteAt = this.ctx.currentTime + 0.1;
    } catch {
      this.ready = false;
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  setMuted(muted) {
    if (this.master) this.master.gain.value = muted ? 0 : 0.5;
  }

  setStation(i) {
    this.station = i % RADIO_STATIONS.length;
    this.step = 0;
  }

  update(G, dt) {
    if (!this.ready || !this.ctx) return;
    // engine pitch follows speed
    const speed = Math.abs(G.player.speed || 0);
    const target = G.player.onFoot ? 0 : 0.02 + speed * 0.0016;
    this.engineGain.gain.setTargetAtTime(G.muted ? 0 : target, this.ctx.currentTime, 0.1);
    this.engineOsc.frequency.setTargetAtTime(50 + speed * 2.4, this.ctx.currentTime, 0.1);
    // siren wails while wanted
    const sirenOn = G.wanted > 0 && !G.muted;
    this.sirenGain.gain.setTargetAtTime(sirenOn ? 0.045 : 0, this.ctx.currentTime, 0.2);
    if (sirenOn) {
      this.sirenOsc.frequency.setTargetAtTime(Math.floor(G.time * 1.6) % 2 ? 880 : 660, this.ctx.currentTime, 0.05);
    }
    // radio sequencer
    if (G.radioOn && !G.muted) this.scheduleRadio(G);
  }

  scheduleRadio(G) {
    const st = RADIO_STATIONS[this.station];
    if (!st) return;
    const stepDur = 60 / st.bpm / 2; // 8th notes
    while (this.nextNoteAt < this.ctx.currentTime + 0.25) {
      const t = this.nextNoteAt;
      const step = this.step;
      // bass on beats, chord stab off-beat, sparkle every 8 steps
      if (step % 4 === 0) this.note(st.root / 2, t, stepDur * 3.4, 'triangle', 0.5);
      if (step % 2 === 1) this.note(st.root * 2, t, stepDur * 0.9, st.wave, 0.10);
      if (step % 8 === 6) this.note(st.root * 3, t, stepDur * 1.6, 'sine', 0.12);
      if (st.id === 'marina-talk' && step % 8 === 0) this.noiseBurst(t, 0.12, 0.05);
      this.step++;
      this.nextNoteAt += stepDur;
    }
  }

  note(freq, at, dur, type, vol) {
    try {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(vol, at + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, at + dur);
      o.connect(g).connect(this.radioGain);
      o.start(at);
      o.stop(at + dur + 0.05);
    } catch { /* audio is best-effort */ }
  }

  noiseBurst(at, dur, vol) {
    try {
      const len = Math.floor(this.ctx.sampleRate * dur);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const g = this.ctx.createGain();
      g.gain.value = vol;
      src.connect(g).connect(this.radioGain);
      src.start(at);
    } catch { /* best-effort */ }
  }

  gunshot(kind) {
    if (!this.ready || !this.ctx) return;
    try {
      const at = this.ctx.currentTime;
      const len = Math.floor(this.ctx.sampleRate * (kind === 'shotgun' ? 0.22 : 0.1));
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const g = this.ctx.createGain();
      g.gain.value = kind === 'shotgun' ? 0.5 : 0.3;
      src.connect(g).connect(this.master);
      src.start(at);
    } catch { /* best-effort */ }
  }
}
