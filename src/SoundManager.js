// Sons procéduraux via Web Audio API — zéro fichier externe.
// AudioContext initialisé à la première interaction (contourne l'autoplay policy).

export default class SoundManager {
  constructor() {
    this._ctx = null;
    this._vol = 0.38;
    this._musicVol = 0.12;
    this._music = null; // { interval, drone, gain }
  }

  _ctx_() {
    if (!this._ctx) this._ctx = new AudioContext();
    if (this._ctx.state === 'suspended') this._ctx.resume();
    return this._ctx;
  }

  play(name) {
    try { this[`_${name}`]?.(); } catch (_) {}
  }

  // À appeler depuis un geste utilisateur (tap/clic) pour débloquer l'audio mobile.
  resume() {
    try { this._ctx_(); } catch (_) {}
  }

  // --- Musique de fond procédurale (boucle) + drone d'ambiance ---
  startMusic(level = 1) {
    this.stopMusic();
    let ctx;
    try { ctx = this._ctx_(); } catch (_) { return; }

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(this._musicVol, ctx.currentTime + 1.5);
    gain.connect(ctx.destination);

    // Drone grave d'ambiance (plus tendu au niveau 2).
    const drone = ctx.createOscillator();
    const dGain = ctx.createGain();
    drone.type = 'sine';
    drone.frequency.value = level >= 2 ? 55 : 49;
    dGain.gain.value = 0.5;
    drone.connect(dGain); dGain.connect(gain);
    drone.start();

    // Gamme mineure + basse, tempo selon le niveau.
    const scale = level >= 2
      ? [220, 261.6, 293.7, 349.2, 392, 466.2]
      : [196, 233.1, 261.6, 293.7, 349.2, 392];
    const bass = level >= 2 ? 58.3 : 49;
    const bpm = level >= 2 ? 128 : 104;
    const beat = 60 / bpm;
    let step = 0;
    const interval = setInterval(() => {
      if (!this._music) return;
      if (step % 2 === 0) this._musNote(gain, bass, beat * 1.9, 'triangle', 0.5);
      this._musNote(gain, scale[(step * 2) % scale.length], beat * 0.9, 'sine', 0.35);
      if (step % 4 === 2) {
        this._musNote(gain, scale[step % scale.length] * 2, beat * 0.5, 'sine', 0.2);
      }
      step = (step + 1) % 16;
    }, beat * 1000);

    this._music = { interval, drone, gain };
  }

  _musNote(dest, freq, dur, type, vol) {
    const ctx = this._ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(dest);
    osc.start(t); osc.stop(t + dur + 0.05);
  }

  stopMusic() {
    if (!this._music) return;
    clearInterval(this._music.interval);
    try { this._music.drone.stop(); } catch (_) {}
    try {
      this._music.gain.gain.exponentialRampToValueAtTime(0.0001, this._ctx.currentTime + 0.3);
    } catch (_) {}
    this._music = null;
  }

  // Pas (thump grave et court).
  _step() {
    const ctx = this._ctx_(), t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuf(ctx, 0.08);
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = 320;
    const g = ctx.createGain();
    g.gain.setValueAtTime(this._vol * 0.16, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    src.connect(filt); filt.connect(g); g.connect(ctx.destination);
    src.start(t); src.stop(t + 0.08);
  }

  // Aspiration (nettoyage de tache).
  _clean() {
    const ctx = this._ctx_(), t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuf(ctx, 0.2);
    const filt = ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.setValueAtTime(500, t);
    filt.frequency.exponentialRampToValueAtTime(2200, t + 0.2);
    filt.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(this._vol * 0.22, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    src.connect(filt); filt.connect(g); g.connect(ctx.destination);
    src.start(t); src.stop(t + 0.2);
  }

  // Générateur de bruit blanc court.
  _noiseBuf(ctx, dur) {
    const n = Math.ceil(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  // Oscillateur simple avec enveloppe.
  _osc(ctx, type, freq0, freq1, dur, vol) {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq0, t);
    if (freq1 !== freq0) osc.frequency.exponentialRampToValueAtTime(freq1, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(t); osc.stop(t + dur);
  }

  // --- Sons ---

  _swing() {
    const ctx = this._ctx_(), t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuf(ctx, 0.12);
    const filt = ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.setValueAtTime(2800, t);
    filt.frequency.exponentialRampToValueAtTime(600, t + 0.12);
    filt.Q.value = 1.5;
    const g = ctx.createGain();
    g.gain.setValueAtTime(this._vol * 0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    src.connect(filt); filt.connect(g); g.connect(ctx.destination);
    src.start(t); src.stop(t + 0.12);
  }

  _hit() {
    const ctx = this._ctx_();
    this._osc(ctx, 'sine', 160, 50, 0.1, this._vol * 0.55);
    // Petite saturation ajoutée via un deuxième osc.
    this._osc(ctx, 'sawtooth', 120, 40, 0.07, this._vol * 0.18);
  }

  _hurt() {
    const ctx = this._ctx_(), t = ctx.currentTime;
    // Son rauque descendant.
    this._osc(ctx, 'sawtooth', 220, 80, 0.28, this._vol * 0.45);
    // Bruit de douleur.
    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuf(ctx, 0.18);
    const filt = ctx.createBiquadFilter();
    filt.type = 'bandpass'; filt.frequency.value = 900; filt.Q.value = 2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(this._vol * 0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    src.connect(filt); filt.connect(g); g.connect(ctx.destination);
    src.start(t); src.stop(t + 0.18);
  }

  _shoot() {
    const ctx = this._ctx_();
    this._osc(ctx, 'sawtooth', 280, 110, 0.09, this._vol * 0.22);
  }

  _pickup() {
    const ctx = this._ctx_();
    // Arpège joyeux C-E-G-C.
    [523, 659, 784, 1047].forEach((f, i) => {
      const t = ctx.currentTime + i * 0.09;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = f;
      g.gain.setValueAtTime(this._vol * 0.38, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      osc.connect(g); g.connect(ctx.destination);
      osc.start(t); osc.stop(t + 0.22);
    });
  }

  _unlock() {
    const ctx = this._ctx_(), t = ctx.currentTime;
    // Clic métallique.
    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuf(ctx, 0.05);
    const filt = ctx.createBiquadFilter();
    filt.type = 'highpass'; filt.frequency.value = 3500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(this._vol * 0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    src.connect(filt); filt.connect(g); g.connect(ctx.destination);
    src.start(t); src.stop(t + 0.05);
    // Suivi d'une tonalité grave "porte qui s'ouvre".
    setTimeout(() => this._osc(this._ctx_(), 'sine', 520, 320, 0.35, this._vol * 0.3), 60);
  }

  _coin() {
    const ctx = this._ctx_(), t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1100, t);
    osc.frequency.exponentialRampToValueAtTime(1600, t + 0.04);
    osc.frequency.exponentialRampToValueAtTime(900, t + 0.14);
    g.gain.setValueAtTime(this._vol * 0.28, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(t); osc.stop(t + 0.14);
  }

  _enemyDeath() {
    const ctx = this._ctx_(), t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuf(ctx, 0.35);
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.setValueAtTime(1200, t);
    filt.frequency.exponentialRampToValueAtTime(80, t + 0.35);
    const g = ctx.createGain();
    g.gain.setValueAtTime(this._vol * 0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    src.connect(filt); filt.connect(g); g.connect(ctx.destination);
    src.start(t); src.stop(t + 0.35);
  }

  _gameover() {
    const ctx = this._ctx_();
    // Accords mineurs descendants.
    [[330, 0], [277, 0.35], [207, 0.7]].forEach(([f, delay]) => {
      setTimeout(() => this._osc(this._ctx_(), 'sine', f, f * 0.85, 0.9, this._vol * 0.38), delay * 1000);
    });
  }

  _victory() {
    const ctx = this._ctx_();
    // Fanfare montante joyeuse.
    [[523, 0], [659, 0.12], [784, 0.24], [1047, 0.38], [1047, 0.55]].forEach(([f, delay]) => {
      setTimeout(() => this._osc(this._ctx_(), 'sine', f, f, 0.45, this._vol * 0.42), delay * 1000);
    });
  }
}
