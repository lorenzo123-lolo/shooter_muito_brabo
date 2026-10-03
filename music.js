// Trilha sonora do Bloco de Isaac, gerada ao vivo com Web Audio (nenhum arquivo de áudio).
// Mistura um beat de hip-hop "boom bap" da era 2000s (bumbo pesado, 808, chimbal com swing,
// stabs de cordas) com o clima Frutiger Aero (pads sonhadores, sinos de vidro e bolhas).
// Composição original em Lá menor, 92 BPM, loop de 4 compassos.
(function (global) {
  'use strict';

  const BPM = 92;
  const STEP = 60 / BPM / 4;      // duração de uma semicolcheia
  const STEPS_PER_BAR = 16, BARS = 4;
  const SWING = 0.14;             // atraso das semicolcheias "fracas" (balanço do hip-hop)
  const VOLUME = 0.45;
  const SCALE = [9, 11, 0, 2, 4, 5, 7]; // Lá menor natural (classes de altura)

  const midi = n => 440 * Math.pow(2, (n - 69) / 12);

  // Am9 -> Fmaj7 -> Cmaj7 -> G6
  const CHORDS = [
    { name: 'Am9', root: 33, notes: [57, 60, 64, 67, 71] },
    { name: 'Fmaj7', root: 29, notes: [53, 57, 60, 64] },
    { name: 'Cmaj7', root: 36, notes: [55, 59, 60, 64] },
    { name: 'G6', root: 31, notes: [55, 59, 62, 64] },
  ];

  //               1 e & a 2 e & a 3 e & a 4 e & a
  const KICK =   [1,0,0,0,0,0,0,1,0,0,1,0,0,0,0,0];
  const SNARE =  [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0];
  const HAT =    [1,0,1,0,1,0,1,1,1,0,1,0,1,0,1,0];
  const OHAT =   [0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0];
  const BASS =   [1,0,0,0,0,0,0,1,0,0,1,0,0,0,0,0];
  const STAB =   [0,0,1,0,0,0,0,0,0,0,1,0,0,1,0,0];
  // sinos de vidro (pentatônica de Lá menor), dois desenhos que se alternam
  const BELLS = [
    [[0, 76], [3, 79], [6, 81], [8, 84], [11, 79], [14, 76]],
    [[0, 72], [3, 74], [6, 76], [10, 79], [14, 81]],
  ];

  // Eventos de um passo do loop. intensity 1 = luta contra chefão (mais pesado).
  function stepEvents(step, intensity) {
    const s = step % STEPS_PER_BAR, bar = Math.floor(step / STEPS_PER_BAR) % BARS;
    const chord = CHORDS[bar], ev = [];
    if (KICK[s] || (intensity && s === 14)) ev.push({ inst: 'kick' });
    if (SNARE[s]) ev.push({ inst: 'snare' });
    if (HAT[s] || intensity) ev.push({ inst: 'hat', open: false, loud: !!intensity });
    if (OHAT[s]) ev.push({ inst: 'hat', open: true });
    if (BASS[s]) ev.push({ inst: 'bass', note: chord.root + (s === 10 ? 7 : 0) });
    if (s === 0) ev.push({ inst: 'pad', notes: chord.notes });
    for (const [at, note] of BELLS[bar % 2]) if (at === s) ev.push({ inst: 'bell', note });
    if (bar === 3 && s === 15) ev.push({ inst: 'bubble' });
    if (intensity && STAB[s]) ev.push({ inst: 'stab', notes: chord.notes.slice(0, 3).map(n => n + 12) });
    return ev;
  }

  // ---------- instrumentos ----------
  const noiseCache = new WeakMap();
  function noise(ctx) {
    let b = noiseCache.get(ctx);
    if (!b) {
      b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = b.getChannelData(0);
      let seed = 12345;
      for (let i = 0; i < d.length; i++) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; d[i] = seed / 0x3fffffff - 1; }
      noiseCache.set(ctx, b);
    }
    return b;
  }

  function env(ctx, t, peak, attack, decay) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    return g;
  }

  function osc(ctx, type, freq, t, dur, dest, detune) {
    const o = ctx.createOscillator();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (detune) o.detune.setValueAtTime(detune, t);
    o.connect(dest); o.start(t); o.stop(t + dur + 0.05);
    return o;
  }

  function noiseSrc(ctx, t, dur, dest) {
    const n = ctx.createBufferSource();
    n.buffer = noise(ctx); n.connect(dest); n.start(t); n.stop(t + dur + 0.05);
    return n;
  }

  const VOICES = {
    kick(ctx, bus, t) {
      const g = env(ctx, t, 0.95, 0.003, 0.42); g.connect(bus.out);
      const o = osc(ctx, 'sine', 150, t, 0.45, g);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
      const c = env(ctx, t, 0.25, 0.001, 0.02); c.connect(bus.out); // estalo do ataque
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1500; hp.connect(c);
      noiseSrc(ctx, t, 0.03, hp);
    },
    snare(ctx, bus, t) {
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1100;
      const g = env(ctx, t, 0.42, 0.002, 0.2); hp.connect(g); g.connect(bus.out);
      noiseSrc(ctx, t, 0.25, hp);
      for (const d of [0.011, 0.022]) { // camadas de palma
        const gc = env(ctx, t + d, 0.22, 0.001, 0.05); gc.connect(bus.out);
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; bp.connect(gc);
        noiseSrc(ctx, t + d, 0.07, bp);
      }
      const body = env(ctx, t, 0.3, 0.002, 0.09); body.connect(bus.out);
      osc(ctx, 'triangle', 185, t, 0.12, body);
    },
    hat(ctx, bus, t, e) {
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7500;
      const g = env(ctx, t, e.open ? 0.12 : e.loud ? 0.15 : 0.1, 0.001, e.open ? 0.22 : 0.035);
      hp.connect(g); g.connect(bus.out);
      noiseSrc(ctx, t, e.open ? 0.3 : 0.06, hp);
    },
    bass(ctx, bus, t, e) { // 808 com glide
      const g = env(ctx, t, 0.6, 0.004, 0.85); g.connect(bus.out);
      const o = osc(ctx, 'sine', midi(e.note + 2), t, 0.9, g);
      o.frequency.exponentialRampToValueAtTime(midi(e.note), t + 0.06);
      const top = env(ctx, t, 0.07, 0.004, 0.35); top.connect(bus.out); // harmônico p/ caixinhas pequenas
      osc(ctx, 'triangle', midi(e.note + 12), t, 0.4, top);
    },
    pad(ctx, bus, t, e) { // acordes sonhadores Aero
      const len = STEP * STEPS_PER_BAR;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1300; lp.Q.value = 0.4;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.05, t + 0.5);
      g.gain.setValueAtTime(0.05, t + len - 0.35);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.2);
      lp.connect(g); g.connect(bus.out); g.connect(bus.fx);
      for (const n of e.notes) for (const d of [-7, 7]) osc(ctx, 'sawtooth', midi(n), t, len + 0.25, lp, d);
    },
    bell(ctx, bus, t, e) { // sino de vidro
      const g = env(ctx, t, 0.13, 0.004, 1.1); g.connect(bus.out); g.connect(bus.fx);
      const f = midi(e.note);
      osc(ctx, 'sine', f, t, 1.2, g);
      const g2 = env(ctx, t, 0.04, 0.002, 0.4); g2.connect(g);
      osc(ctx, 'sine', f * 2.76, t, 0.45, g2);
    },
    bubble(ctx, bus, t) {
      const g = env(ctx, t, 0.1, 0.01, 0.18); g.connect(bus.out); g.connect(bus.fx);
      const o = osc(ctx, 'sine', 320, t, 0.22, g);
      o.frequency.exponentialRampToValueAtTime(1500, t + 0.16);
    },
    stab(ctx, bus, t, e) { // stab de cordas (luta de chefão)
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
      const g = env(ctx, t, 0.12, 0.006, 0.22); lp.connect(g); g.connect(bus.out);
      for (const n of e.notes) { osc(ctx, 'sawtooth', midi(n), t, 0.3, lp, -5); osc(ctx, 'sawtooth', midi(n), t, 0.3, lp, 5); }
    },
  };

  // master -> compressor -> saída, com um eco (delay) para sinos e pads
  function buildBus(ctx, dest) {
    const master = ctx.createGain(); master.gain.value = VOLUME;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    master.connect(comp); comp.connect(dest);
    const fx = ctx.createGain(); fx.gain.value = 0.5;
    const delay = ctx.createDelay(2); delay.delayTime.value = STEP * 3;
    const fb = ctx.createGain(); fb.gain.value = 0.32;
    const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 3200;
    fx.connect(delay); delay.connect(tone); tone.connect(fb); fb.connect(delay); tone.connect(master);
    return { out: master, fx, master };
  }

  function playStep(ctx, bus, step, t, intensity) {
    const swung = t + (step % 2 ? STEP * SWING : 0);
    for (const e of stepEvents(step, intensity)) VOICES[e.inst](ctx, bus, e.inst === 'hat' ? swung : t, e);
  }

  // Renderiza N compassos fora de tempo real (usado nos testes)
  function renderOffline(bars, intensity, sampleRate) {
    const sr = sampleRate || 22050, len = bars * STEPS_PER_BAR * STEP + 1;
    const OAC = global.OfflineAudioContext || global.webkitOfflineAudioContext;
    const ctx = new OAC(1, Math.ceil(len * sr), sr);
    const bus = buildBus(ctx, ctx.destination);
    for (let i = 0; i < bars * STEPS_PER_BAR; i++) playStep(ctx, bus, i, 0.02 + i * STEP, intensity || 0);
    return ctx.startRendering();
  }

  // Tocador em tempo real (agenda alguns passos à frente)
  function createMusic(opts) {
    const AC = opts && 'AudioContext' in opts ? opts.AudioContext : (global.AudioContext || global.webkitAudioContext);
    const m = { started: false, muted: false, intensity: 0, ctx: null, bus: null, step: 0, nextTime: 0, timer: null };
    function schedule() {
      while (m.nextTime < m.ctx.currentTime + 0.15) {
        playStep(m.ctx, m.bus, m.step, m.nextTime, m.intensity);
        m.nextTime += STEP; m.step++;
      }
    }
    m.start = function () {
      if (m.started) { if (m.ctx.state === 'suspended') m.ctx.resume(); return true; }
      if (!AC) return false;
      try { m.ctx = new AC(); } catch (e) { return false; }
      m.started = true;
      m.bus = buildBus(m.ctx, m.ctx.destination);
      if (m.muted) m.bus.master.gain.value = 0;
      m.nextTime = m.ctx.currentTime + 0.1;
      m.timer = setInterval(schedule, 25);
      if (m.ctx.state === 'suspended') m.ctx.resume();
      return true;
    };
    m.toggleMute = function () {
      m.muted = !m.muted;
      if (m.bus) m.bus.master.gain.setTargetAtTime(m.muted ? 0 : VOLUME, m.ctx.currentTime, 0.05);
      return m.muted;
    };
    m.setIntensity = function (i) { m.intensity = i ? 1 : 0; };
    m.stop = function () { if (m.timer) clearInterval(m.timer); if (m.ctx) m.ctx.close(); m.started = false; m.timer = null; };
    return m;
  }

  global.BlockMusic = {
    BPM, STEP, STEPS_PER_BAR, BARS, SCALE, CHORDS, VOLUME,
    stepEvents, playStep, buildBus, renderOffline, createMusic, midi,
  };
})(typeof window !== 'undefined' ? window : globalThis);
